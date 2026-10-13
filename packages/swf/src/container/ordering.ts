/**
 * Tag-ordering validation — `IMPL-020` §7 (Ch.2's five rules).
 *
 * The checks are *non-fatal* and *non-reordering* (`IMPL-020-R032`): their output is for the
 * porting report. "Depends only on earlier tags" is limited to *character references* that can be
 * proven from the tag's structure without full decoding (`IMPL-020-R033`): `PlaceObject*`,
 * `StartSound*`, `DoInitAction`, `DefineButton`/`DefineButton2` record ids, `DefineButtonCxform`,
 * `DefineBitsJPEG*` tables ids, `DefineText` font ids and `DefineScalingGrid` targets. Each rule
 * emits at most one diagnostic (deduplicated by rule, with the count and the first offending
 * offset).
 *
 * `container/` stays free of payload decoders (`IMPL-020-R001`): the reference extractors below
 * read only fixed positions and primitive records (`MATRIX`, strings). A `DefineButton2` record
 * whose `ButtonHasFilterList` is set carries a variable-length `FILTERLIST` whose layout is owned
 * by doc 030; such a record's references are skipped rather than decoded here.
 */

import { Codes } from '../diagnostics/codes.js';
import type { DiagnosticSink } from '../diagnostics/sink.js';
import { Cursor } from '../io/cursor.js';
import { readCxformWithAlpha, readMatrix } from '../io/records.js';
import { tagName } from '../tags/tag-codes.js';
import type { TagRef, TagStreamResult } from './tag-stream.js';

interface LevelState {
  showFrames: number;
  openHeadIndex: number | null;
  lastBlockFrame: number;
}

/** `UI16` at `body[off..off+2]`, little-endian. */
function u16At(body: Uint8Array, off: number): number {
  return (body[off] ?? 0) | ((body[off + 1] ?? 0) << 8);
}

/** Skips a null-terminated string at `off`; returns the offset just past the terminator. */
function skipString(body: Uint8Array, off: number): number {
  let i = off;
  while (i < body.length && (body[i] ?? 0) !== 0) i += 1;
  return i + 1 <= body.length ? i + 1 : body.length;
}

/**
 * Advances a cursor past a `MATRIX` using the real variable-width reader (`IMPL-010`). Used by
 * the button-record walker so ordering reference extraction stays in sync with
 * `decodeButtonRecord` — a fixed 13-byte estimate misaligns for wide translate fields, which
 * produces spurious `SF0026` reports.
 */
function skipMatrix(c: Cursor): void {
  readMatrix(c);
}

/**
 * Character ids this tag structurally references, or `null` when the references cannot be
 * determined from the structure alone (the caller then skips the tag).
 */
function characterRefs(body: Uint8Array, tag: TagRef): number[] | null {
  const o = tag.offset;
  switch (tag.code) {
    case 4: {
      // PlaceObject: CharacterId UI16 (0 = no character change).
      const id = u16At(body, o);
      return id === 0 ? [] : [id];
    }
    case 26: {
      // PlaceObject2: flags, Depth, [CharacterId].
      const flags = body[o] ?? 0;
      if ((flags & 0x02) === 0) return [];
      return [u16At(body, o + 3)];
    }
    case 70: {
      // PlaceObject3: two flag bytes, Depth, [ClassName], [CharacterId].
      const f2 = body[o] ?? 0;
      const f3 = body[o + 1] ?? 0;
      if ((f2 & 0x02) === 0) return [];
      let pos = o + 4;
      if ((f3 & 0x08) !== 0 || ((f3 & 0x10) !== 0 && (f2 & 0x02) !== 0)) pos = skipString(body, pos);
      return [u16At(body, pos)];
    }
    case 15:
    case 89: {
      // StartSound/StartSound2: SoundId UI16 (0 = stop, not a reference).
      const id = u16At(body, o);
      return id === 0 ? [] : [id];
    }
    case 59: {
      // DoInitAction: SpriteID UI16.
      const id = u16At(body, o);
      return id === 0 ? [] : [id];
    }
    case 23:
    case 78: {
      // DefineButtonCxform / DefineScalingGrid: CharacterId UI16.
      const id = u16At(body, o);
      return id === 0 ? [] : [id];
    }
    case 21:
    case 35:
    case 90: {
      // DefineBitsJPEG2/3/4: JPEGTablesId UI16.
      return [u16At(body, o)];
    }
    case 7: {
      // DefineButton (v1): ButtonId UI16, then records of (flag, CharacterID, PlaceDepth, MATRIX).
      // Walk with the real Matrix reader (fixed estimates drift on wide translate fields, which
      // would turn later bytes into spurious CharacterIDs and false SF0026 reports).
      const refs: number[] = [];
      const c = new Cursor(body, o + 2, body.length, { mode: 'soft' }); // skip ButtonId
      while (c.offset < body.length) {
        const flag = c.u8();
        if (flag === 0) return refs;
        refs.push(c.u16());
        c.u16(); // PlaceDepth
        skipMatrix(c);
      }
      return null;
    }
    case 34: {
      // DefineButton2 (v2): header (Id, reserved, ActionOffset UI16), then records of flag,
      // CharacterID, PlaceDepth, MATRIX, CXFORMWITHALPHA?, FilterList?, BlendMode?.
      // We mirror `decodeButtonRecord`'s exact layout (see `tags/buttons.ts`): HasFilterList
      // (0x10) terminates the record for ordering purposes (FILTERLIST layout is doc-030-owned
      // and contains no further character refs to dictionary ids), and we read the matrix and
      // cxform with the same readers the decoder uses.
      const refs: number[] = [];
      const c = new Cursor(body, o + 5, body.length, { mode: 'soft' }); // skip ButtonId(u16) + flags(u8) + ActionOffset(u16)
      while (c.offset < body.length) {
        const flag = c.u8();
        if (flag === 0) return refs;
        if (flag & 0x10) return refs; // FILTERLIST — no further dictionary refs in this record
        refs.push(c.u16());
        c.u16(); // PlaceDepth
        skipMatrix(c);
        // CXFORMWITHALPHA is present for v2 records unconditionally (Ch.13).
        readCxformWithAlpha(c);
        if (flag & 0x20) c.u8(); // BlendMode byte
      }
      return null;
    }
    case 11: {
      // DefineText: NumTextRecords UI16, then TEXTRECORDs (style, [text, FontId]).
      const count = u16At(body, o);
      const refs: number[] = [];
      let pos = o + 2;
      for (let i = 0; i < count; i += 1) {
        if (pos + 2 > body.length) return null;
        const flags = u16At(body, pos);
        pos += 2;
        if (flags & 0x01) pos += 10; // TextStyle
        if (flags & 0x02) {
          pos = skipString(body, pos);
          if (pos + 2 > body.length) return null;
          const font = u16At(body, pos);
          if (font !== 0) refs.push(font);
          pos += 2;
        }
      }
      return refs;
    }
    default:
      return [];
  }
}

export interface OrderingViolation {
  readonly rule: string;
  readonly count: number;
  readonly firstOffset: number;
}

/**
 * Runs Ch.2's five ordering rules over the tag index and reports one diagnostic per violated rule.
 *
 * | Rule | Diagnostic |
 * | --- | --- |
 * | `FileAttributes` is the first tag (SWF ≥ 8) | `SF0025` |
 * | definition-before-use for character references | `SF0026` |
 * | streaming sound tags in order (head before blocks, frames ascending) | `SF0032` |
 * | `End` is last (trailing bytes reported) | `SF0024` (emitted by the tag stream) |
 */
export function checkTagOrdering(
  body: Uint8Array,
  version: number,
  stream: TagStreamResult,
  sink: DiagnosticSink,
): void {
  const tags = stream.index.tags;

  // Rule 1: FileAttributes first (SWF ≥ 8).
  if (version >= 8 && tags.length > 0 && (tags[0]?.code ?? 0) !== 69) {
    const first = tags[0] as TagRef;
    sink.emit({
      code: Codes.FILE_ATTRIBUTES_NOT_FIRST,
      severity: 'warning',
      message: `SWF ${version} files require FileAttributes as the first tag; the first tag is ${first.code} (${tagName(first.code)})`,
      offset: first.headerOffset,
      context: 'tag ordering',
      tagCode: first.code,
    });
  }

  // Rules 2–3: definition-before-use. First (minimum) definition index per character id.
  const firstDefIndex = new Map<number, number>();
  for (const definition of stream.definitions) {
    const prior = firstDefIndex.get(definition.id);
    if (prior === undefined || definition.tagIndex < prior) firstDefIndex.set(definition.id, definition.tagIndex);
  }
  const late: { tag: TagRef; id: number; kind: 'later' | 'never' }[] = [];
  for (const tag of tags) {
    const refs = characterRefs(body, tag);
    if (refs === null) continue;
    for (const id of refs) {
      const def = firstDefIndex.get(id);
      if (def === undefined) late.push({ tag, id, kind: 'never' });
      else if (def >= tag.index) late.push({ tag, id, kind: 'later' });
    }
  }
  if (late.length > 0) {
    const first = late[0] as { tag: TagRef; id: number; kind: 'later' | 'never' };
    sink.emit({
      code: Codes.TAG_ORDER_VIOLATION,
      severity: 'warning',
      message: `${late.length} character reference(s) ${late.length === 1 ? 'does' : 'do'} not precede their definition; first: tag ${first.tag.code} (${tagName(first.tag.code)}) @ offset ${first.tag.headerOffset} references character ${first.id} ${first.kind === 'later' ? 'defined later in the file' : 'never defined'}`,
      offset: first.tag.headerOffset,
      context: 'tag ordering',
      tagCode: first.tag.code,
    });
  }

  // Rule 4: streaming sound tags in order. Each level's tags are visited contiguously by the
  // indexer, so per-level state stays consistent over one flat pass.
  const levels = new Map<number, LevelState>();
  const soundIssues: { offset: number; detail: string }[] = [];
  for (const tag of tags) {
    const key = tag.inSprite ?? 0;
    let state = levels.get(key);
    if (state === undefined) {
      state = { showFrames: 0, openHeadIndex: null, lastBlockFrame: 0 };
      levels.set(key, state);
    }
    if (tag.code === 1) {
      state.showFrames += 1;
      continue;
    }
    if (tag.code === 18 || tag.code === 45) {
      state.openHeadIndex = tag.index;
      state.lastBlockFrame = 0;
      continue;
    }
    if (tag.code === 19) {
      const frame = state.showFrames;
      if (state.openHeadIndex === null) {
        soundIssues.push({
          offset: tag.headerOffset,
          detail: `SoundStreamBlock @ offset ${tag.headerOffset} has no preceding SoundStreamHead`,
        });
      } else if (frame < state.lastBlockFrame) {
        soundIssues.push({
          offset: tag.headerOffset,
          detail: `SoundStreamBlock @ offset ${tag.headerOffset} is out of frame order (frame ${frame} after frame ${state.lastBlockFrame})`,
        });
      }
      state.lastBlockFrame = Math.max(state.lastBlockFrame, frame);
    }
  }
  if (soundIssues.length > 0) {
    const first = soundIssues[0] as { offset: number; detail: string };
    sink.emit({
      code: Codes.STREAM_SOUND_OUT_OF_ORDER,
      severity: 'warning',
      message: `${soundIssues.length} streaming sound ordering violation(s); first: ${first.detail}`,
      offset: first.offset,
      context: 'tag ordering',
      tagCode: 19,
    });
  }

  // Rule 5 (End is last) is enforced structurally: the tag stream terminates at the first top-level
  // `End`, trailing bytes are `SF0024` and a missing `End` is `SF0102` — both emitted by the
  // indexer, so there is nothing further to check here.
}
