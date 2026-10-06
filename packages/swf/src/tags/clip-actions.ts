/**
 * `CLIPEVENTFLAGS` and `CLIPACTIONS` framing — `IMPL-030` §6, APP-§10.1.
 *
 * Action bytes remain opaque `ActionBlockRef`s for doc 050. This module only interprets the
 * little-endian event masks and the size-bounded record envelope.
 */

import { Codes } from '../diagnostics/codes.js';
import type { Cursor } from '../io/cursor.js';
import type { ActionBlockRef } from './place.js';

export interface ClipEventFlags {
  readonly load: boolean;
  readonly enterFrame: boolean;
  readonly unload: boolean;
  readonly mouseMove: boolean;
  readonly mouseDown: boolean;
  readonly mouseUp: boolean;
  readonly keyDown: boolean;
  readonly keyUp: boolean;
  readonly data: boolean;
  readonly initialize: boolean;
  readonly press: boolean;
  readonly release: boolean;
  readonly releaseOutside: boolean;
  readonly rollOver: boolean;
  readonly rollOut: boolean;
  readonly dragOver: boolean;
  readonly dragOut: boolean;
  readonly keyPress: boolean;
  readonly construct: boolean;
  /** Original little-endian field value, including reserved bits. */
  readonly raw: number;
  readonly width: 2 | 4;
  /** Reserved/version-inapplicable bits, retained verbatim. */
  readonly reserved: number;
}

export interface ClipActionRecord {
  readonly events: ClipEventFlags;
  readonly keyCode: number | null;
  /** The ACTIONRECORD bytes, including their terminating ActionEndFlag. */
  readonly actions: ActionBlockRef;
  /** `ActionRecordSize`, including KeyCode when present. */
  readonly sizeBytes: number;
}

export interface ClipActions {
  readonly reserved: number;
  /** Union used for fast dispatch. */
  readonly allEvents: ClipEventFlags;
  readonly records: readonly ClipActionRecord[];
  readonly endFlagWidth: 2 | 4;
  /** Zero when the CLIPEVENTFLAGS terminator was found, null when truncated. */
  readonly endFlag: number | null;
  /** Entire raw CLIPACTIONS body, retained alongside the decoded envelope. */
  readonly raw: ActionBlockRef;
}

const EVENT_MASKS = {
  load: 0x00000001,
  enterFrame: 0x00000002,
  unload: 0x00000004,
  mouseMove: 0x00000008,
  mouseDown: 0x00000010,
  mouseUp: 0x00000020,
  keyDown: 0x00000040,
  keyUp: 0x00000080,
  data: 0x00000100,
  initialize: 0x00000200,
  press: 0x00000400,
  release: 0x00000800,
  releaseOutside: 0x00001000,
  rollOver: 0x00002000,
  rollOut: 0x00004000,
  dragOver: 0x00008000,
  dragOut: 0x00010000,
  keyPress: 0x00020000,
  construct: 0x00040000,
} as const;

/** Reads one CLIPEVENTFLAGS record using the SWF version, not the tag length. */
export function decodeClipEventFlags(c: Cursor): ClipEventFlags {
  const width: 2 | 4 = (c.version ?? 6) <= 5 ? 2 : 4;
  const raw = width === 2 ? c.u16() : c.u32();
  const version = c.version ?? 6;
  const validMask = width === 2 ? 0x000001ff : version >= 7 ? 0x0007ffff : 0x0003ffff;
  const reserved = (raw & ~validMask) >>> 0;
  if (reserved !== 0) {
    c.emit(
      Codes.PLACEMENT_RESERVED_BITS,
      'info',
      `CLIPEVENTFLAGS reserved/version-inapplicable bits 0x${reserved.toString(16)} preserved`,
    );
  }
  return {
    load: (raw & EVENT_MASKS.load) !== 0,
    enterFrame: (raw & EVENT_MASKS.enterFrame) !== 0,
    unload: (raw & EVENT_MASKS.unload) !== 0,
    mouseMove: (raw & EVENT_MASKS.mouseMove) !== 0,
    mouseDown: (raw & EVENT_MASKS.mouseDown) !== 0,
    mouseUp: (raw & EVENT_MASKS.mouseUp) !== 0,
    keyDown: (raw & EVENT_MASKS.keyDown) !== 0,
    keyUp: (raw & EVENT_MASKS.keyUp) !== 0,
    data: (raw & EVENT_MASKS.data) !== 0,
    initialize: (raw & EVENT_MASKS.initialize) !== 0,
    press: (raw & EVENT_MASKS.press) !== 0,
    release: (raw & EVENT_MASKS.release) !== 0,
    releaseOutside: (raw & EVENT_MASKS.releaseOutside) !== 0,
    rollOver: (raw & EVENT_MASKS.rollOver) !== 0,
    rollOut: (raw & EVENT_MASKS.rollOut) !== 0,
    dragOver: (raw & EVENT_MASKS.dragOver) !== 0,
    dragOut: (raw & EVENT_MASKS.dragOut) !== 0,
    keyPress: (raw & EVENT_MASKS.keyPress) !== 0,
    construct: (raw & EVENT_MASKS.construct) !== 0,
    raw,
    width,
    reserved,
  };
}

function scanActionEnd(bytes: Uint8Array, start: number, end: number): number | null {
  let at = start;
  while (at < end) {
    const opcode = bytes[at] ?? 0;
    at += 1;
    if (opcode === 0) return at;
    if (opcode >= 0x80) {
      if (at + 2 > end) return null;
      const length = (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
      at += 2;
      if (at + length > end) return null;
      at += length;
    }
  }
  return null;
}

/** Reads `CLIPACTIONS` through its zero EventFlags terminator. */
export function decodeClipActions(c: Cursor): ClipActions {
  const start = c.offset;
  const width: 2 | 4 = (c.version ?? 6) <= 5 ? 2 : 4;
  const reserved = c.u16();
  if (reserved !== 0) {
    c.emit(Codes.CLIP_ACTIONS_RESERVED, 'warning', `CLIPACTIONS Reserved is ${reserved}, not zero`, start);
  }

  const allEvents = decodeClipEventFlags(c);
  const records: ClipActionRecord[] = [];
  let endFlag: number | null = null;
  let stoppedOnSizeMismatch = false;

  while (c.remaining >= width) {
    const flags = decodeClipEventFlags(c);
    if (flags.raw === 0) {
      endFlag = 0;
      break;
    }

    const sizeOffset = c.offset;
    if (c.remaining < 4) {
      c.emit(
        Codes.CLIP_RECORD_SIZE_MISMATCH,
        'warning',
        'CLIPACTIONRECORD has no complete ActionRecordSize field; remaining bytes retained raw',
        sizeOffset,
      );
      stoppedOnSizeMismatch = true;
      c.seek(c.limit);
      break;
    }
    const sizeBytes = c.u32();
    const payloadStart = c.offset;
    const declaredEnd = payloadStart + sizeBytes;
    const recordEnd = Math.min(declaredEnd, c.limit);
    const overrunsTag = declaredEnd > c.limit;

    let keyCode: number | null = null;
    let keyBytes = 0;
    if (flags.keyPress) {
      if (sizeBytes < 1 || payloadStart >= recordEnd) {
        c.emit(
          Codes.CLIP_RECORD_SIZE_MISMATCH,
          'warning',
          `KeyPress CLIPACTIONRECORD size ${sizeBytes} does not include its KeyCode`,
          sizeOffset,
        );
        stoppedOnSizeMismatch = true;
        c.seek(c.limit);
        break;
      }
      keyCode = c.u8();
      keyBytes = 1;
    }

    const actions = { offset: c.offset, length: Math.max(0, recordEnd - c.offset) };
    const actionEnd = scanActionEnd(c.bytes, actions.offset, recordEnd);
    const hasBadActionFraming = actionEnd === null || actionEnd !== recordEnd;
    if (overrunsTag || hasBadActionFraming) {
      c.emit(
        Codes.CLIP_RECORD_SIZE_MISMATCH,
        'warning',
        overrunsTag
          ? `CLIPACTIONRECORD ActionRecordSize ${sizeBytes} extends past the tag; action bytes bounded by the tag`
          : `CLIPACTIONRECORD ActionRecordSize ${sizeBytes} disagrees with the ACTIONRECORD end marker`,
        sizeOffset,
      );
      stoppedOnSizeMismatch = true;
    }

    records.push({ events: flags, keyCode, actions, sizeBytes });
    c.seek(recordEnd);
    if (stoppedOnSizeMismatch) break;
    // Keep this arithmetic explicit: `sizeBytes` includes the optional key byte and the actions.
    // A record with zero action bytes is bounded, but cannot carry an ActionEndFlag.
    if (sizeBytes < keyBytes) break;
  }

  if (endFlag === null) {
    c.emit(Codes.CLIP_ACTIONS_RESERVED, 'warning', 'CLIPACTIONS ClipActionEndFlag is missing or truncated', c.offset);
  } else if (c.remaining > 0) {
    c.emit(Codes.CLIP_ACTIONS_RESERVED, 'warning', 'CLIPACTIONS has bytes after ClipActionEndFlag', c.offset);
    c.seek(c.limit);
  }
  if (allEvents.raw === 0) {
    c.emit(
      Codes.CLIP_ACTIONS_NO_FLAGS,
      'warning',
      'clip actions are present but AllEventFlags has no handler flags set',
      start,
    );
  }

  return {
    reserved,
    allEvents,
    records,
    endFlagWidth: width,
    endFlag,
    raw: { offset: start, length: Math.max(0, c.offset - start) },
  };
}
