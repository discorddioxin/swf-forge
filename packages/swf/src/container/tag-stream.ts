/**
 * Tag stream framing and indexing — `IMPL-020` §5.
 *
 * The `TagCodeAndLength` word is a little-endian UI16 split with shifts (never a bit field);
 * `DefineSprite` bodies are walked with an explicit stack (never JS recursion), depth-capped at 32.
 */

import { Codes } from '../diagnostics/codes.js';
import type { DiagnosticSink } from '../diagnostics/sink.js';
import { Cursor } from '../io/cursor.js';
import { tagInfo, isKnownTag, tagName } from '../tags/tag-codes.js';

export interface TagRef {
  readonly code: number;
  /** Offset of the *body* in the decompressed buffer. */
  readonly offset: number;
  readonly length: number;
  /** Nesting depth: 0 = top level, 1 = inside a sprite, … */
  readonly depth: number;
  /** Character id of the enclosing sprite, or null. */
  readonly inSprite: number | null;
  /** Index into `TagIndex.tags` — stable, used as a cache key. */
  readonly index: number;
  /** Offset of the tag header (short or long) — used for source maps and reports. */
  readonly headerOffset: number;
  readonly longHeader: boolean;
}

export interface SpriteRange {
  readonly start: number;
  readonly end: number;
  readonly frameCount: number;
  readonly depth: number;
}

export interface TagIndex {
  readonly tags: readonly TagRef[];
  /** For each sprite character id: the slice of `tags` that belongs to its timeline. */
  readonly spriteRanges: ReadonlyMap<number, SpriteRange>;
  /** Tag code histogram, for reports and the tag-coverage tool. */
  readonly histogram: ReadonlyMap<number, number>;
  /** Observed `ShowFrame` counts: key 0 is the top level, other keys are sprite ids. */
  readonly frameCounts: ReadonlyMap<number, number>;
}

export interface DefinitionEntry {
  readonly id: number;
  readonly tagCode: number;
  readonly offset: number;
  readonly length: number;
  readonly tagIndex: number;
}

export interface TagStreamResult {
  readonly index: TagIndex;
  readonly definitions: readonly DefinitionEntry[];
  /** Bytes after the top-level `End` tag, if any were present. */
  readonly trailingBytes: number;
  readonly sawEnd: boolean;
}

/** `IMPL-020-R016`: the long header's length is the body length, header bytes excluded. */
export function readTagHeader(c: Cursor): {
  code: number;
  length: number;
  headerOffset: number;
  longHeader: boolean;
} {
  const headerOffset = c.offset;
  const word = c.u16();
  const code = word >> 6;
  let length = word & 0x3f;
  let longHeader = false;
  if (length === 0x3f) {
    length = c.u32();
    longHeader = true;
  }
  return { code, length, headerOffset, longHeader };
}

interface Level {
  readonly inSprite: number | null;
  readonly depth: number;
  readonly startTag: number;
  now: number;
  limit: number;
  readonly declaredFrames: number;
  showFrames: number;
  /** Tag codes already reported as not-in-sprite for this level (`SF0129`, once per kind). */
  readonly reported: Set<number>;
}

export interface TagStreamOptions {
  mode?: 'soft' | 'strict';
  maxDictionaryEntries?: number;
  /** Header `FrameCount`, for the `SF0023` cross-check. */
  declaredFrames?: number;
}

export function buildTagIndex(body: Uint8Array, sink: DiagnosticSink, opts: TagStreamOptions = {}): TagStreamResult {
  const tags: TagRef[] = [];
  const definitions: DefinitionEntry[] = [];
  const definitionsById = new Map<number, DefinitionEntry>();
  const spriteRanges = new Map<number, SpriteRange>();
  const frameCounts = new Map<number, number>();
  const maxEntries = opts.maxDictionaryEntries ?? 2_000_000;
  let trailingBytes = 0;
  let sawEnd = false;

  const top: Level = {
    inSprite: null,
    depth: 0,
    startTag: 0,
    now: 0,
    limit: body.length,
    declaredFrames: opts.declaredFrames ?? 0,
    showFrames: 0,
    reported: new Set<number>(),
  };
  const stack: Level[] = [top];
  let pos = 0;

  while (stack.length > 0) {
    const level = stack[stack.length - 1] as Level;
    const cursor = new Cursor(body, pos, level.limit, {
      mode: opts.mode ?? 'soft',
      sink,
      context: level.inSprite === null ? 'tag stream' : `sprite ${level.inSprite}`,
      ...(level.inSprite !== null ? { characterId: level.inSprite } : {}),
    });
    let descend: Level | null = null;
    let closed = false;

    while (cursor.offset < level.limit) {
      const headerOffset = cursor.offset;
      const { code, length, longHeader } = readTagHeader(cursor);
      const bodyOffset = cursor.offset;
      const bodyEnd = bodyOffset + length;

      if (longHeader && length < 0x3f) {
        cursor.emit(
          Codes.LONG_HEADER_UNNECESSARY,
          'info',
          `tag ${code} (${tagName(code)}) uses a long header though its body is ${length} byte(s)`,
          headerOffset,
          { tagCode: code },
        );
      }

      if (bodyEnd > level.limit) {
        cursor.emit(
          Codes.TAG_PAST_END,
          'warning',
          `tag ${code} (${tagName(code)}) body needs ${length} byte(s) but only ${Math.max(0, level.limit - bodyOffset)} remain — keeping the bytes present`,
          headerOffset,
          { tagCode: code },
        );
        tags.push({
          code,
          offset: bodyOffset,
          length: Math.max(0, level.limit - bodyOffset),
          depth: level.depth,
          inSprite: level.inSprite,
          index: tags.length,
          headerOffset,
          longHeader,
        });
        pos = level.limit;
        closed = true;
        break;
      }

      const ref: TagRef = {
        code,
        offset: bodyOffset,
        length,
        depth: level.depth,
        inSprite: level.inSprite,
        index: tags.length,
        headerOffset,
        longHeader,
      };
      tags.push(ref);

      if (!isKnownTag(code)) {
        cursor.emit(Codes.UNKNOWN_TAG, 'info', `unknown tag code ${code} skipped by length`, headerOffset, {
          tagCode: code,
          context: `unknown tag ${code}`,
        });
      } else {
        const info = tagInfo(code);
        if (level.inSprite !== null && info !== undefined && !info.inSprite && !level.reported.has(code)) {
          level.reported.add(code);
          cursor.emit(
            Codes.SPRITE_TAG_UNLISTED,
            'info',
            `tag ${code} (${tagName(code)}) is outside the chapter's sprite list (decoded normally)`,
            headerOffset,
            { tagCode: code },
          );
        }
        if (info?.definition && level.inSprite !== null) {
          cursor.emit(
            Codes.SPRITE_DEFINITION_TAG,
            'warning',
            `${info.name} inside sprite ${level.inSprite} does not enter the dictionary`,
            headerOffset,
            { tagCode: code },
          );
        } else if (info?.definition) {
          const id = length >= 2 ? (body[bodyOffset] ?? 0) | ((body[bodyOffset + 1] ?? 0) << 8) : 0;
          const prior = definitionsById.get(id);
          if (definitions.length + 1 > maxEntries) {
            cursor.emit(Codes.DICTIONARY_CAP, 'error', `dictionary entry cap ${maxEntries} exceeded`, headerOffset, {
              tagCode: code,
            });
          } else if (id === 0) {
            cursor.emit(
              Codes.DEFINITION_ID_ZERO,
              'warning',
              `${info.name} defines character id 0 (ignored)`,
              headerOffset,
              { tagCode: code },
            );
          } else {
            if (prior) {
              cursor.emit(
                Codes.DUPLICATE_CHARACTER,
                'warning',
                `character id ${id} defined twice at body offsets ${prior.offset} and ${bodyOffset}; the last definition wins and the earlier entry remains in stream order`,
                headerOffset,
                { tagCode: code, characterId: id },
              );
            }
            const entry: DefinitionEntry = {
              id,
              tagCode: code,
              offset: bodyOffset,
              length,
              tagIndex: ref.index,
            };
            definitions.push(entry);
            definitionsById.set(id, entry);
          }
        }
      }

      if (code === 0) {
        level.now = tags.length - 1;
        level.limit = bodyEnd;
        pos = bodyEnd;
        closed = true;
        if (level.inSprite === null) {
          sawEnd = true;
          trailingBytes = Math.max(0, body.length - bodyEnd);
          if (trailingBytes > 0) {
            cursor.emit(Codes.BYTES_AFTER_END, 'info', `${trailingBytes} byte(s) after the End tag ignored`, bodyEnd);
          }
        }
        break;
      }

      if (code === 1) {
        level.showFrames += 1;
        frameCounts.set(level.inSprite ?? 0, level.showFrames);
      }

      if (code === 39) {
        const spriteId = length >= 2 ? (body[bodyOffset] ?? 0) | ((body[bodyOffset + 1] ?? 0) << 8) : 0;
        const declared = length >= 4 ? (body[bodyOffset + 2] ?? 0) | ((body[bodyOffset + 3] ?? 0) << 8) : 0;
        if (level.depth >= 32) {
          cursor.emit(
            Codes.SPRITE_DEPTH_CAP,
            'warning',
            `sprite nesting deeper than 32 at sprite ${spriteId}; sub-stream skipped`,
            headerOffset,
            { tagCode: code, characterId: spriteId },
          );
          pos = bodyEnd;
          cursor.seek(bodyEnd);
          continue;
        }
        const child: Level = {
          inSprite: spriteId,
          depth: level.depth + 1,
          startTag: tags.length,
          now: tags.length,
          limit: Math.min(bodyEnd, level.limit),
          declaredFrames: declared,
          showFrames: 0,
          reported: new Set<number>(),
        };
        pos = bodyOffset + 4;
        descend = child;
        break;
      }

      cursor.seek(bodyEnd);
      pos = bodyEnd;
    }

    if (descend) {
      stack.push(descend);
      continue;
    }

    if (!closed && cursor.offset >= level.limit) {
      closed = true;
      level.limit = Math.max(level.limit, cursor.offset);
      pos = level.limit;
    }

    if (closed && level !== top) {
      spriteRanges.set(level.inSprite ?? -1, {
        start: level.startTag,
        end: level.now,
        frameCount: level.declaredFrames,
        depth: level.depth,
      });
      frameCounts.set(level.inSprite ?? -1, level.showFrames);
      if (level.declaredFrames !== level.showFrames) {
        sink.emit({
          code: Codes.FRAME_COUNT_MISMATCH,
          severity: 'warning',
          message: `sprite ${level.inSprite} declares ${level.declaredFrames} frame(s) but contains ${level.showFrames} ShowFrame tag(s)`,
          offset: 0,
          context: `sprite ${level.inSprite}`,
          ...(level.inSprite !== null ? { characterId: level.inSprite } : {}),
          tagCode: 39,
        });
      }
      stack.pop();
      continue;
    }

    if (closed && level === top) {
      stack.pop();
      break;
    }
  }

  if (!sawEnd) {
    sink.emit({
      code: Codes.MISSING_END,
      severity: 'info',
      message: 'no End tag; the tag stream ends at the end of the body',
      offset: body.length,
      context: 'tag stream',
    });
  }
  if (top.declaredFrames !== 0 && top.declaredFrames !== top.showFrames) {
    sink.emit({
      code: Codes.FRAME_COUNT_MISMATCH,
      severity: 'warning',
      message: `header declares ${top.declaredFrames} frame(s) but the top level contains ${top.showFrames} ShowFrame tag(s)`,
      offset: 0,
      context: 'header',
    });
  }
  frameCounts.set(0, top.showFrames);

  const histogram = new Map<number, number>();
  for (const t of tags) histogram.set(t.code, (histogram.get(t.code) ?? 0) + 1);

  return {
    index: { tags, spriteRanges, histogram, frameCounts },
    definitions,
    trailingBytes,
    sawEnd,
  };
}
