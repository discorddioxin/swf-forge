/** Embedded quadratic font outlines for DefineFont2/3 (IMPL-080 P3 decode slice). */

import { Codes } from '../diagnostics/codes.js';
import { Cursor } from '../io/cursor.js';
import { readRect } from '../io/records.js';
import type { Rect } from '../io/types.js';
import { Tag } from './tag-codes.js';
import { readShapeWithStyle, type VectorShape } from './shape.js';

export interface FontGlyphModel {
  readonly index: number;
  readonly code: number;
  readonly shape: VectorShape | null;
  readonly advance: number | null;
  readonly bounds: Rect | null;
}

export interface FontKerningPair {
  readonly leftCode: number;
  readonly rightCode: number;
  readonly adjustment: number;
}

export interface DefineFontModel {
  readonly id: number;
  readonly version: 2 | 3;
  readonly tagCode: 48 | 75;
  readonly name: string;
  readonly languageCode: number;
  readonly unitsPerEm: 1024 | 20480;
  readonly italic: boolean;
  readonly bold: boolean;
  readonly wideCodes: boolean;
  readonly glyphs: readonly FontGlyphModel[];
  readonly ascent: number | null;
  readonly descent: number | null;
  readonly leading: number | null;
  readonly kerning: readonly FontKerningPair[];
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function glyphShape(raw: Uint8Array, parent: Cursor, fontId: number, glyphIndex: number): VectorShape | null {
  if (raw.length < 1) return null;
  // A font glyph is a SHAPE without an ID/RECT/style tables. Supply its mandatory opaque fill-0
  // style and reuse the production SHAPEWITHSTYLE record decoder, whose body begins at NumFillBits.
  const prefix = Uint8Array.from([1, 0, 0, 0, 0, 0]); // one black fill, no line styles
  const body = new Uint8Array(prefix.length + raw.length);
  body.set(prefix);
  body.set(raw, prefix.length);
  const c = new Cursor(body, 0, body.length, {
    mode: parent.mode,
    sink: parent.sink,
    context: `font ${fontId} glyph ${glyphIndex}`,
    version: parent.version,
    tagCode: parent.tagCode ?? 48,
    characterId: fontId,
  });
  return readShapeWithStyle(c, fontId, 1, { xMin: 0, xMax: 0, yMin: 0, yMax: 0 });
}

function invalidFont(c: Cursor, message: string): void {
  c.emit(Codes.FONT_OFFSET_TABLE_INVALID, 'warning', message);
}

/** `DefineFont2` (48) / `DefineFont3` (75); payloads and outlines remain in glyph IR. */
export function decodeDefineFont2or3(tagCode: number, c: Cursor): DefineFontModel {
  if (tagCode !== Tag.DefineFont2 && tagCode !== Tag.DefineFont3) {
    throw new RangeError(`tag ${tagCode} is not DefineFont2/3`);
  }
  const id = c.u16();
  const flags = c.u8();
  const languageCode = c.u8();
  const nameLength = c.u8();
  const name = decodeUtf8(c.bytes.subarray(c.offset, Math.min(c.limit, c.offset + nameLength)));
  c.skip(nameLength);
  const glyphCount = c.u16();
  const wideOffsets = (flags & 0x08) !== 0;
  const wideCodes = (flags & 0x04) !== 0;
  const hasLayout = (flags & 0x80) !== 0;
  const offsetBase = c.offset;
  const offsets: number[] = [];
  for (let index = 0; index < glyphCount; index += 1) offsets.push(wideOffsets ? c.u32() : c.u16());
  const codeTableOffset = wideOffsets ? c.u32() : c.u16();
  const codeTableStart = offsetBase + codeTableOffset;
  if (codeTableStart < c.offset || codeTableStart > c.limit) {
    invalidFont(c, `CodeTableOffset ${codeTableOffset} falls outside the glyph-shape area`);
  }
  const safeCodeTableStart = Math.min(c.limit, Math.max(c.offset, codeTableStart));
  const glyphShapes: (VectorShape | null)[] = [];
  let priorGlyphStart = c.offset;
  for (let index = 0; index < glyphCount; index += 1) {
    const relativeStart = offsets[index] ?? 0;
    const relativeEnd = offsets[index + 1] ?? codeTableOffset;
    const start = offsetBase + relativeStart;
    const end = offsetBase + relativeEnd;
    if (start < offsetBase || end < start || end > safeCodeTableStart || start < priorGlyphStart) {
      invalidFont(c, `glyph ${index} has invalid offsets ${relativeStart}…${relativeEnd}`);
      glyphShapes.push(null);
      continue;
    }
    const raw = c.bytes.subarray(start, end);
    glyphShapes.push(glyphShape(raw, c, id, index));
    priorGlyphStart = end;
  }

  c.seek(safeCodeTableStart);
  const codes: number[] = [];
  for (let index = 0; index < glyphCount; index += 1) codes.push(wideCodes ? c.u16() : c.u8());
  if (codes.some((code, index) => index > 0 && code < (codes[index - 1] ?? 0))) {
    c.emit(
      Codes.FONT_CODE_TABLE_UNSORTED,
      'warning',
      `font ${id} CodeTable is not sorted; original glyph order is preserved`,
    );
  }

  let ascent: number | null = null;
  let descent: number | null = null;
  let leading: number | null = null;
  const advances: (number | null)[] = Array.from({ length: glyphCount }, () => null);
  const bounds: (Rect | null)[] = Array.from({ length: glyphCount }, () => null);
  const kerning: FontKerningPair[] = [];
  if (hasLayout) {
    ascent = c.u16();
    descent = c.u16();
    leading = c.s16();
    for (let index = 0; index < glyphCount; index += 1) advances[index] = c.s16();
    for (let index = 0; index < glyphCount; index += 1) bounds[index] = readRect(c);
    const kerningCount = c.u16();
    for (let index = 0; index < kerningCount; index += 1) {
      const leftCode = wideCodes ? c.u16() : c.u8();
      const rightCode = wideCodes ? c.u16() : c.u8();
      const adjustment = c.s16();
      kerning.push({ leftCode, rightCode, adjustment });
    }
  } else {
    c.emit(
      Codes.FONT_METRICS_DERIVED,
      'info',
      `font ${id} has no authored FontLayoutTable; downstream metrics derive from glyph bounds`,
    );
  }

  return {
    id,
    version: tagCode === Tag.DefineFont3 ? 3 : 2,
    tagCode: tagCode as 48 | 75,
    name,
    languageCode,
    unitsPerEm: tagCode === Tag.DefineFont3 ? 20480 : 1024,
    italic: (flags & 0x02) !== 0,
    bold: (flags & 0x01) !== 0,
    wideCodes,
    glyphs: codes.map((code, index) => ({
      index,
      code,
      shape: glyphShapes[index] ?? null,
      advance: advances[index] ?? null,
      bounds: bounds[index] ?? null,
    })),
    ascent,
    descent,
    leading,
    kerning,
  };
}
