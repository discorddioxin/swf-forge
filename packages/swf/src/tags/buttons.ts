/**
 * Ch.12 button tag decoders — `IMPL-100` §3–§5, layouts pinned by APP-§10.10.
 *
 * The module decodes authored records and keeps ActionScript as bounded byte ranges; model-level
 * reference resolution and hit-area assembly live in `model/movie.ts` / `model/buttons.ts`.
 */

import { Codes } from '../diagnostics/codes.js';
import type { TagRef } from '../container/tag-stream.js';
import { Cursor } from '../io/cursor.js';
import { readCxform, readCxformWithAlpha, readMatrix } from '../io/records.js';
import type {
  ButtonActionRecord,
  ButtonConditions,
  ButtonRecord,
  ButtonSoundInfo,
  ButtonSoundRecord,
} from '../model/types.js';
import { readFilterList } from './filters.js';

export interface ParsedButton {
  readonly id: number;
  readonly version: 1 | 2;
  readonly trackAsMenu: boolean;
  readonly records: readonly ButtonRecord[];
  readonly actions: readonly ButtonActionRecord[];
  /** Original UI16. Zero means no condition actions. */
  readonly actionOffset: number;
}

export interface ButtonCxformTag {
  readonly buttonId: number;
  readonly transform: ReturnType<typeof readCxform>;
}

export interface ButtonSoundTag {
  readonly buttonId: number;
  readonly sounds: readonly ButtonSoundRecord[];
  readonly truncated: boolean;
}

interface ActionScan {
  readonly count: number;
  readonly end: number | null;
}

function scanActionRecords(bytes: Uint8Array, start: number, limit: number): ActionScan {
  let offset = start;
  let count = 0;
  while (offset < limit) {
    const opcode = bytes[offset] ?? 0;
    offset += 1;
    if (opcode === 0) return { count, end: offset };
    count += 1;
    if (opcode >= 0x80) {
      if (offset + 2 > limit) return { count, end: null };
      const length = (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
      offset += 2;
      if (offset + length > limit) return { count, end: null };
      offset += length;
    }
  }
  return { count, end: null };
}

function statesFromFlags(flags: number): ButtonRecord['states'] {
  const states: ButtonRecord['states'][number][] = [];
  if ((flags & 0x01) !== 0) states.push('up');
  if ((flags & 0x02) !== 0) states.push('over');
  if ((flags & 0x04) !== 0) states.push('down');
  if ((flags & 0x08) !== 0) states.push('hitTest');
  return states;
}

/** Reads one BUTTONRECORD, including the zero-byte CharacterEndFlag sentinel. */
export function decodeButtonRecord(
  c: Cursor,
  version: 1 | 2,
  buttonId: number,
): { readonly record: ButtonRecord | null; readonly terminated: boolean; readonly complete: boolean } {
  const tagOffset = c.offset;
  const flags = c.u8();
  if (flags === 0) return { record: null, terminated: true, complete: true };

  const reservedMask = version === 1 ? 0xf0 : 0xc0;
  const reserved = flags & reservedMask;
  if (reserved !== 0) {
    c.emit(
      Codes.PLACEMENT_RESERVED_BITS,
      'info',
      `BUTTONRECORD reserved flags 0x${reserved.toString(16)} preserved`,
      tagOffset,
      { characterId: buttonId },
    );
  }

  const states = statesFromFlags(flags);
  const characterId = c.u16();
  const depth = c.u16();
  const matrix = readMatrix(c);
  const cxform = version === 2 ? readCxformWithAlpha(c) : null;
  let filters: ButtonRecord['filters'] = null;
  let complete = true;
  if (version === 2 && (flags & 0x10) !== 0) {
    const list = readFilterList(c, 'BUTTONRECORD');
    filters = list.filters;
    complete = list.complete;
  }
  let blendMode: number | null = null;
  if (version === 2 && complete && (flags & 0x20) !== 0) {
    blendMode = c.u8();
    if (blendMode > 14) {
      c.emit(
        Codes.BLEND_MODE_UNKNOWN,
        'warning',
        `unknown button blend mode value ${blendMode} retained`,
        c.offset - 1,
        {
          characterId: buttonId,
        },
      );
    }
  }

  if (states.length === 0) {
    c.emit(
      Codes.BUTTON_RECORD_NO_STATE,
      'warning',
      `BUTTONRECORD for character ${characterId} has no state bits set; dropped`,
      tagOffset,
      { characterId: buttonId },
    );
    return { record: null, terminated: false, complete };
  }

  return {
    record: { states, depth, characterId, matrix, cxform, blendMode, filters, rawFlags: flags, tagOffset },
    terminated: false,
    complete,
  };
}

function readButtonRecords(c: Cursor, version: 1 | 2, buttonId: number): ButtonRecord[] {
  const records: ButtonRecord[] = [];
  while (c.remaining > 0) {
    const result = decodeButtonRecord(c, version, buttonId);
    if (result.terminated) return records;
    if (result.record !== null) records.push(result.record);
    if (!result.complete) break;
  }
  return records;
}

function emptyConditions(): ButtonConditions {
  return {
    idleToOverUp: false,
    overUpToIdle: false,
    overUpToOverDown: false,
    overDownToOverUp: false,
    outDownToOverDown: false,
    overDownToOutDown: false,
    outDownToIdle: false,
    idleToOverDown: false,
    overDownToIdle: false,
  };
}

function cursorAt(c: Cursor, offset: number, buttonId: number): Cursor {
  return new Cursor(c.bytes, offset, c.limit, {
    mode: c.mode,
    sink: c.sink,
    context: c.context,
    version: c.version,
    legacyEncoding: c.legacyEncoding,
    ...(c.tagCode !== undefined ? { tagCode: c.tagCode } : {}),
    characterId: buttonId,
  });
}

const DOCUMENTED_KEYS = new Set([1, 2, 3, 4, 5, 6, 8, 13, 14, 15, 16, 17, 18, 19]);

export function isDocumentedButtonKeyCode(keyCode: number): boolean {
  return DOCUMENTED_KEYS.has(keyCode) || (keyCode >= 32 && keyCode <= 126);
}

function decodeButtonConditions(first: number, second: number): ButtonConditions {
  return {
    idleToOverDown: (first & 0x80) !== 0,
    outDownToIdle: (first & 0x40) !== 0,
    outDownToOverDown: (first & 0x20) !== 0,
    overDownToOutDown: (first & 0x10) !== 0,
    overDownToOverUp: (first & 0x08) !== 0,
    overUpToOverDown: (first & 0x04) !== 0,
    overUpToIdle: (first & 0x02) !== 0,
    idleToOverUp: (first & 0x01) !== 0,
    overDownToIdle: (second & 0x01) !== 0,
  };
}

function decodeButtonConditionActions(c: Cursor, buttonId: number, origin: TagRef): ButtonActionRecord[] {
  const actions: ButtonActionRecord[] = [];
  let emptyConditions = 0;

  while (c.remaining > 0) {
    const recordStart = c.offset;
    if (c.remaining < 4) {
      c.emit(
        Codes.CONDACTION_CHAIN_MALFORMED,
        'warning',
        `BUTTONCONDACTION at ${recordStart} has fewer than four header bytes; chain truncated`,
        recordStart,
        { characterId: buttonId },
      );
      break;
    }

    const size = c.u16();
    const firstConditions = c.u8();
    const secondConditions = c.u8();
    const conditions = decodeButtonConditions(firstConditions, secondConditions);
    const rawConditionWord = (firstConditions << 8) | secondConditions;
    const keyValue = secondConditions >>> 1;
    const keyCode = keyValue === 0 ? null : keyValue;
    const actionStart = c.offset;

    if (keyCode !== null && ((c.version ?? 6) < 4 || !isDocumentedButtonKeyCode(keyCode))) {
      c.emit(
        Codes.BUTTON_KEYCODE_UNDOCUMENTED,
        'info',
        `CondKeyPress ${keyCode} is unavailable in SWF ${c.version ?? 6} or outside the documented key set; retained but never fires`,
        recordStart,
        { characterId: buttonId },
      );
    }
    const hasCondition = Object.values(conditions).some(Boolean);
    if (!hasCondition && keyCode === null) emptyConditions += 1;

    if (size === 0) {
      actions.push({
        conditions,
        rawConditionWord,
        keyCode,
        actionBytes: { offset: actionStart, length: c.remaining },
        tagOffset: recordStart,
        origin,
      });
      c.seek(c.limit);
      break;
    }

    const recordEnd = recordStart + size;
    if (size < 4 || recordEnd <= recordStart || recordEnd > c.limit) {
      const boundedEnd = Math.min(c.limit, Math.max(actionStart, recordEnd));
      c.emit(
        Codes.CONDACTION_CHAIN_MALFORMED,
        'warning',
        `BUTTONCONDACTION CondActionSize ${size} is invalid or extends past the tag; chain truncated`,
        recordStart,
        { characterId: buttonId },
      );
      actions.push({
        conditions,
        rawConditionWord,
        keyCode,
        actionBytes: { offset: actionStart, length: Math.max(0, boundedEnd - actionStart) },
        tagOffset: recordStart,
        origin,
      });
      c.seek(c.limit);
      break;
    }

    const actionLength = recordEnd - actionStart;
    actions.push({
      conditions,
      rawConditionWord,
      keyCode,
      actionBytes: { offset: actionStart, length: actionLength },
      tagOffset: recordStart,
      origin,
    });
    if (actionLength > 0) {
      const actionEnd = scanActionRecords(c.bytes, actionStart, recordEnd).end;
      if (actionEnd === null || actionEnd !== recordEnd) {
        c.emit(
          Codes.CONDACTION_CHAIN_MALFORMED,
          'warning',
          `BUTTONCONDACTION CondActionSize ${size} disagrees with the action end marker; chain truncated`,
          recordStart,
          { characterId: buttonId },
        );
        c.seek(c.limit);
        break;
      }
    }
    c.seek(recordEnd);
  }

  if (emptyConditions > 0) {
    c.emit(
      Codes.BUTTON_CONDITION_EMPTY,
      'info',
      `button ${buttonId} has ${emptyConditions} condition action(s) with no condition bit or key code`,
      actions[0]?.tagOffset ?? c.offset,
      { characterId: buttonId },
    );
  }
  return actions;
}

/** `DefineButton` (7): records followed by a plain v1 action array. */
export function decodeDefineButton(c: Cursor, origin: TagRef): ParsedButton {
  const id = c.u16();
  const records = readButtonRecords(c, 1, id);
  const actionStart = c.offset;
  const scan = scanActionRecords(c.bytes, actionStart, c.limit);
  const actions: ButtonActionRecord[] = [];
  if (scan.count > 0) {
    c.emit(
      Codes.BUTTON_V1_ACTIONS_PRESENT,
      'info',
      `DefineButton ${id} carries a v1 action array (click-and-release)`,
      actionStart,
      { characterId: id },
    );
    const conditions = emptyConditions();
    actions.push({
      conditions: { ...conditions, overDownToOverUp: true },
      rawConditionWord: 0,
      keyCode: null,
      actionBytes: { offset: actionStart, length: c.limit - actionStart },
      tagOffset: actionStart,
      origin,
    });
  }
  c.seek(c.limit);
  return { id, version: 1, trackAsMenu: false, records, actions, actionOffset: 0 };
}

/** `DefineButton2` (34), including ActionOffset-from-field-start and the chained conditions. */
export function decodeDefineButton2(c: Cursor, origin: TagRef): ParsedButton {
  const id = c.u16();
  const headerFlags = c.u8();
  const reserved = headerFlags & 0xfe;
  if (reserved !== 0) {
    c.emit(
      Codes.PLACEMENT_RESERVED_BITS,
      'info',
      `DefineButton2 reserved flags 0x${reserved.toString(16)} preserved`,
      c.offset - 1,
      { characterId: id },
    );
  }
  const trackAsMenu = (headerFlags & 0x01) !== 0;
  const actionOffsetField = c.offset;
  const actionOffset = c.u16();
  const records = readButtonRecords(c, 2, id);
  const recordsEnd = c.offset;
  let actions: ButtonActionRecord[] = [];

  if (actionOffset !== 0) {
    const actionStart = actionOffsetField + actionOffset;
    if (actionStart < recordsEnd || actionStart >= c.limit) {
      c.emit(
        Codes.CONDACTION_CHAIN_MALFORMED,
        'warning',
        `DefineButton2 ActionOffset ${actionOffset} from field ${actionOffsetField} does not point after the record terminator inside the tag`,
        actionOffsetField,
        { characterId: id },
      );
    } else {
      actions = decodeButtonConditionActions(cursorAt(c, actionStart, id), id, origin);
    }
  }

  c.seek(c.limit);
  return { id, version: 2, trackAsMenu, records, actions, actionOffset };
}

/** `DefineButtonCxform` (23): `ButtonId UI16`, RGB-only `CXFORM`. */
export function decodeDefineButtonCxform(c: Cursor): ButtonCxformTag {
  const buttonId = c.u16();
  const transform = readCxform(c);
  return { buttonId, transform };
}

function readButtonSoundInfo(c: Cursor, buttonId: number): { info: ButtonSoundInfo | null; truncated: boolean } {
  if (c.remaining < 1) return { info: null, truncated: true };
  const rawFlags = c.u8();
  const reserved = rawFlags >>> 6;
  if (reserved !== 0) {
    c.emit(
      Codes.PLACEMENT_RESERVED_BITS,
      'info',
      `button SOUNDINFO reserved flags ${reserved} preserved`,
      c.offset - 1,
      { characterId: buttonId },
    );
  }
  const syncStop = (rawFlags & 0x20) !== 0;
  const syncNoMultiple = (rawFlags & 0x10) !== 0;
  const hasEnvelope = (rawFlags & 0x08) !== 0;
  const hasLoops = (rawFlags & 0x04) !== 0;
  const hasOutPoint = (rawFlags & 0x02) !== 0;
  const hasInPoint = (rawFlags & 0x01) !== 0;
  const fixedBytes = (hasInPoint ? 4 : 0) + (hasOutPoint ? 4 : 0) + (hasLoops ? 2 : 0);
  if (c.remaining < fixedBytes + (hasEnvelope ? 1 : 0)) {
    c.seek(c.limit);
    return { info: null, truncated: true };
  }

  const inPoint = hasInPoint ? c.u32() : null;
  const outPoint = hasOutPoint ? c.u32() : null;
  const loopCount = hasLoops ? c.u16() : null;
  const envelope: { position44: number; leftLevel: number; rightLevel: number }[] = [];
  if (hasEnvelope) {
    const count = c.u8();
    if (c.remaining < count * 8) {
      c.seek(c.limit);
      return { info: null, truncated: true };
    }
    for (let i = 0; i < count; i += 1) {
      envelope.push({ position44: c.u32(), leftLevel: c.u16(), rightLevel: c.u16() });
    }
  }
  return {
    info: { rawFlags, reserved, syncStop, syncNoMultiple, inPoint, outPoint, loopCount, envelope },
    truncated: false,
  };
}

const SOUND_TRANSITIONS: readonly ButtonSoundRecord['transition'][] = [
  'overUpToIdle',
  'idleToOverUp',
  'overUpToOverDown',
  'overDownToOverUp',
];

/** `DefineButtonSound` (17): four transitions in Ch.12 order. */
export function decodeDefineButtonSound(c: Cursor): ButtonSoundTag {
  const buttonId = c.u16();
  const sounds: ButtonSoundRecord[] = [];
  let truncated = false;
  for (const transition of SOUND_TRANSITIONS) {
    if (c.remaining < 2) {
      c.emit(Codes.BUTTON_SOUND_INVALID, 'warning', `DefineButtonSound for button ${buttonId} is truncated`, c.offset, {
        characterId: buttonId,
      });
      truncated = true;
      break;
    }
    const soundId = c.u16();
    if (soundId === 0) continue;
    const decoded = readButtonSoundInfo(c, buttonId);
    if (decoded.truncated) {
      c.emit(
        Codes.BUTTON_SOUND_INVALID,
        'warning',
        `DefineButtonSound for button ${buttonId} has truncated SOUNDINFO`,
        c.offset,
        {
          characterId: buttonId,
        },
      );
      sounds.push({ transition, soundId, info: null });
      truncated = true;
      break;
    }
    sounds.push({ transition, soundId, info: decoded.info });
  }
  c.seek(c.limit);
  return { buttonId, sounds, truncated };
}
