/** Embedded quadratic font outlines for DefineFont2/3 (IMPL-080 P3 decode slice). */

import { Codes } from '../diagnostics/codes.js';
import type { Code } from '../diagnostics/codes.js';
import type { Severity } from '../diagnostics/types.js';
import { Cursor } from '../io/cursor.js';
import { readRect } from '../io/records.js';
import type { Rect } from '../io/types.js';
import { Tag } from './tag-codes.js';
import { readShapeWithStyle, type VectorShape } from './shape.js';

export interface FontGlyphModel {
  readonly index: number;
  /** Character code from the authoritative code table (Font2/3 own codes or FontInfo-overridden); null for v1-without-Info. */
  readonly code: number | null;
  readonly shape: VectorShape | null;
  readonly advance: number | null;
  readonly bounds: Rect | null;
  /**
   * The glyph breaks `IMPL-080-R009`'s mandatory first fill-style record (`SF0281`).
   *
   * The outline is still decoded and still reported — discarding it would lose fidelity on exactly
   * the content the rule tells us to tolerate — but font emission (WOFF2, the atlas) skips it, so
   * the quarantine is observable rather than nominal.
   */
  readonly quarantined: boolean;
}

export interface FontKerningPair {
  readonly leftCode: number;
  readonly rightCode: number;
  readonly adjustment: number;
}

/** DefineFont (10, v1): inferred glyph count from UI16 offset table, no name/code table/layout. */
export interface DefineFontV1Model {
  readonly id: number;
  readonly version: 1;
  readonly tagCode: 10;
  /** Glyph count inferred from the offset table (per IMPL-080-R008). */
  readonly glyphCount: number;
  readonly glyphs: readonly FontGlyphModel[];
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
  readonly shiftJIS: boolean;
  readonly ansi: boolean;
  readonly smallText: boolean;
  readonly glyphs: readonly FontGlyphModel[];
  /** Glyph index → character code (from Font2/3 own code table; may be superseded by FontInfo). */
  readonly codes: readonly number[];
  readonly ascent: number | null;
  readonly descent: number | null;
  readonly leading: number | null;
  readonly kerning: readonly FontKerningPair[];
}

/** DefineFontInfo (13) / DefineFontInfo2 (62) code tables + name + encoding flags. */
export interface FontInfoModel {
  readonly id: number;
  readonly tagCode: 13 | 62;
  readonly version: 1 | 2;
  readonly name: string;
  readonly flags: {
    readonly smallText: boolean;
    readonly shiftJIS: boolean;
    readonly ansi: boolean;
    readonly italic: boolean;
    readonly bold: boolean;
    readonly wideCodes: boolean;
  };
  readonly languageCode: number | null; // null for v1; always present for v2
  readonly codes: readonly number[];
}

/** DefineFontName (88) — PostScript name + copyright for licensing reports. */
export interface FontNameModel {
  readonly id: number;
  readonly fontName: string;
  readonly copyright: string;
}

/** One ZONEDATA alignment coordinate + range pair. */
export interface FontZoneData {
  readonly alignmentCoordinate: number;
  readonly range: number;
}

/** ZONERECORD per DefineFontAlignZones. */
export interface FontZoneRecord {
  readonly zones: readonly FontZoneData[];
  readonly zoneMaskY: boolean;
  readonly zoneMaskX: boolean;
}

/** DefineFontAlignZones (73) — raw hinting records (recorded; renderer owns hinting). */
export interface FontAlignZonesModel {
  readonly id: number;
  readonly csmTableHint: number;
  readonly zones: readonly FontZoneRecord[];
}

/** CSMTextSettings (74) — advanced rendering parameters for a text/edit-text character. */
export interface CsmTextSettingsModel {
  readonly textId: number;
  readonly useFlashType: number;
  readonly gridFit: number;
  readonly thickness: number;
  readonly sharpness: number;
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

/**
 * Check a glyph `SHAPE` against `IMPL-080-R009`'s mandatory first style-change record.
 *
 * A conforming glyph opens with a `STYLECHANGERECORD` that sets `StateFillStyle0` with
 * `FillStyle0 = 1`, declares no new style arrays, and does not touch the line-style fields — the
 * chapter's way of saying "a glyph is one opaque filled outline and nothing else". Real content
 * violates it (fill *1* instead of fill 0 is the usual form), so this returns a reason rather than
 * throwing; the caller reports `SF0281` and marks the glyph.
 *
 * An immediate `EndShapeRecord` is **not** a violation: a space glyph has no outline to fill, and
 * flagging every space in a font would make `SF0281` useless.
 */
function glyphStyleViolation(raw: Uint8Array): string | null {
  let bitPos = 0;
  const bits = (count: number): number => {
    let value = 0;
    for (let i = 0; i < count; i += 1) {
      const byte = raw[bitPos >>> 3] ?? 0;
      value = (value << 1) | ((byte >>> (7 - (bitPos & 7))) & 1);
      bitPos += 1;
    }
    return value;
  };
  const available = raw.length * 8;
  const numFillBits = bits(4);
  bits(4); // NumLineBits
  if (bitPos + 6 > available) return null; // truncated; the shape decoder reports the read overrun
  if (bits(1) === 1) return 'begins with an edge record instead of a style change';
  const newStyles = bits(1);
  const lineStyle = bits(1);
  const fillStyle1 = bits(1);
  const fillStyle0 = bits(1);
  const moveTo = bits(1);
  if (newStyles === 0 && lineStyle === 0 && fillStyle1 === 0 && fillStyle0 === 0 && moveTo === 0) {
    return null; // EndShapeRecord — an empty glyph, legitimately unfilled
  }
  if (newStyles === 1) return 'declares new style arrays, which a glyph may not carry';
  if (lineStyle === 1) return 'uses the line-style fields';
  if (fillStyle0 !== 1) {
    return fillStyle1 === 1 ? 'sets StateFillStyle1 instead of StateFillStyle0' : 'does not set StateFillStyle0';
  }
  if (moveTo === 1) {
    const moveBits = bits(5);
    bits(moveBits);
    bits(moveBits);
  }
  if (bitPos + numFillBits > available) return null;
  const fill0 = bits(numFillBits);
  return fill0 === 1 ? null : `sets FillStyle0 = ${fill0}, not 1`;
}

function glyphShape(
  raw: Uint8Array,
  parent: Cursor,
  fontId: number,
  glyphIndex: number,
): { shape: VectorShape | null; quarantined: boolean } {
  if (raw.length < 1) return { shape: null, quarantined: false };
  const violation = glyphStyleViolation(raw);
  if (violation !== null) {
    // `IMPL-080-R044`: once per font. The sink folds on (code, context, characterId), and `parent`
    // carries the font tag's context, so later glyphs with the same defect fold into this one.
    parent.emit(
      Codes.FONT_GLYPH_FILL_INVALID,
      'warning',
      `font ${fontId} glyph ${glyphIndex} ${violation} (IMPL-080-R009); glyph quarantined from font emission`,
    );
  }
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
  const shape = readShapeWithStyle(
    c,
    fontId,
    1,
    { xMin: 0, xMax: 0, yMin: 0, yMax: 0 },
    {
      // A glyph SHAPE has no RECT, so these bounds are a placeholder, not a declaration. Without
      // saying so, every glyph with an outline "disagrees" with a 0x0 box: SF0187 on every glyph in
      // every font, and `recomputedBounds` nulled — which is the only bounds source
      // `IMPL-080-R007`'s metrics fallback has (F-P3-18).
      boundsAuthored: false,
      // F-P3-10: glyph streams have no fill-winding flag, so they take `DefineShape1`-`3`'s default
      // rather than inheriting `readShapeWithStyle`'s `nonZero` placeholder.
      fillRule: 'evenOdd',
    },
  );
  return { shape, quarantined: violation !== null };
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
  const shiftJIS = (flags & 0x40) !== 0;
  const smallText = (flags & 0x20) !== 0;
  const ansi = (flags & 0x10) !== 0;
  const offsetBase = c.offset;
  const offsets: number[] = [];
  for (let index = 0; index < glyphCount; index += 1) offsets.push(wideOffsets ? c.u32() : c.u16());
  const codeTableOffset = wideOffsets ? c.u32() : c.u16();
  const codeTableStart = offsetBase + codeTableOffset;
  if (codeTableStart < c.offset || codeTableStart > c.limit) {
    invalidFont(c, `CodeTableOffset ${codeTableOffset} falls outside the glyph-shape area`);
  }
  const safeCodeTableStart = Math.min(c.limit, Math.max(c.offset, codeTableStart));
  const glyphShapes: { shape: VectorShape | null; quarantined: boolean }[] = [];
  let priorGlyphStart = c.offset;
  for (let index = 0; index < glyphCount; index += 1) {
    const relativeStart = offsets[index] ?? 0;
    const relativeEnd = offsets[index + 1] ?? codeTableOffset;
    const start = offsetBase + relativeStart;
    const end = offsetBase + relativeEnd;
    if (start < offsetBase || end < start || end > safeCodeTableStart || start < priorGlyphStart) {
      invalidFont(c, `glyph ${index} has invalid offsets ${relativeStart}…${relativeEnd}`);
      glyphShapes.push({ shape: null, quarantined: false });
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
      shape: glyphShapes[index]?.shape ?? null,
      advance: advances[index] ?? null,
      bounds: bounds[index] ?? null,
      quarantined: glyphShapes[index]?.quarantined ?? false,
    })),
    codes,
    ascent,
    descent,
    leading,
    kerning,
    shiftJIS,
    ansi,
    smallText,
  };
}

/**
 * `DefineFont` (10, v1) — UI16 OffsetTable[numGlyphs] followed by GlyphShapeTable. The glyph count is
 * inferred from the first offset (IMP-080-R008: offsets[0]/2 == count of entries preceding the shapes).
 * V1 carries no code table or metrics; those come from `DefineFontInfo`/`Info2` (resolved later).
 */
export function decodeDefineFontV1(c: Cursor): DefineFontV1Model {
  const id = c.u16();
  const offsetBase = c.offset;
  // Peek first UI16 to infer count.
  if (c.limit - c.offset < 2) {
    c.emit(Codes.FONT_OFFSET_TABLE_INVALID, 'warning', `DefineFont ${id} has no offset table`);
    return { id, version: 1, tagCode: 10, glyphCount: 0, glyphs: [] };
  }
  const firstOffset = c.u16();
  if ((firstOffset & 1) !== 0 || firstOffset < 2) {
    c.emit(
      Codes.FONT_OFFSET_TABLE_INVALID,
      'warning',
      `DefineFont ${id} first offset ${firstOffset} is inconsistent with a UI16 offset table`,
    );
  }
  const glyphCount = Math.max(0, Math.floor(firstOffset / 2));
  c.seek(offsetBase);
  const offsets: number[] = [];
  const safeCount = Math.min(glyphCount, Math.floor((c.limit - c.offset) / 2));
  for (let index = 0; index < safeCount; index += 1) offsets.push(c.u16());
  if (safeCount < glyphCount) {
    c.emit(
      Codes.FONT_OFFSET_TABLE_INVALID,
      'warning',
      `DefineFont ${id} declares ${glyphCount} glyphs but only ${safeCount} offsets fit the body`,
    );
  }
  const glyphShapes: { shape: VectorShape | null; quarantined: boolean }[] = [];
  let priorStart = c.offset;
  const tagEnd = c.limit;
  for (let index = 0; index < safeCount; index += 1) {
    const relativeStart = offsets[index] ?? 0;
    const relativeEnd = offsets[index + 1] ?? tagEnd - offsetBase;
    const start = offsetBase + relativeStart;
    const end = Math.min(offsetBase + relativeEnd, tagEnd);
    if (start < offsetBase || end < start || end > tagEnd || start < priorStart) {
      c.emit(Codes.FONT_OFFSET_TABLE_INVALID, 'warning', `DefineFont ${id} glyph ${index} has invalid offsets`);
      glyphShapes.push({ shape: null, quarantined: false });
      continue;
    }
    const raw = c.bytes.subarray(start, end);
    glyphShapes.push(glyphShape(raw, c, id, index));
    priorStart = end;
  }
  // `IMPL-080-R007`: a v1 font carries no metrics at all — no ascent, descent, leading or advance
  // table. Everything downstream has to come from glyph bounds, and the report has to say so, or a
  // reader cannot tell authored metrics from derived ones.
  c.emit(
    Codes.FONT_METRICS_DERIVED,
    'info',
    `DefineFont ${id} (v1) carries no metrics; ascent, descent, leading and advances derive from glyph bounds`,
  );
  return {
    id,
    version: 1,
    tagCode: 10,
    glyphCount: safeCount,
    glyphs: glyphShapes.map((glyph, index) => ({
      index,
      code: null, // v1 carries no codes; FontInfo fills these in
      shape: glyph.shape,
      advance: null,
      bounds: null,
      quarantined: glyph.quarantined,
    })),
  };
}

/**
 * Apply a `DefineFontInfo`/`Info2` code table to a previously-decoded v1/v2/v3 font model, returning
 * an updated font view. Reports `SF0276` when the code table disagrees with the glyph table in
 * length or ordering (`IMPL-080-R010` — a conflict between the two tags is the same defect class as
 * an unsorted table) and `SF0283` when `DefineFontInfo2` has `WideCodes` clear. `SF0281` is the
 * glyph fill-style rule and is reported at glyph-decode time, not here.
 */
/** Report sink for `applyFontInfo`, which resolves outside any single tag cursor. */
export type FontInfoEmit = (code: Code, severity: Severity, message: string) => void;

export function applyFontInfo(
  font: DefineFontModel | DefineFontV1Model,
  info: FontInfoModel,
  reporter?: FontInfoEmit,
): DefineFontModel {
  const flags = info.flags;
  // A plain binding called `emit`, not `reporter?.(…)`: the optional-call form hides the site from
  // the diagnostic-coverage scanner, which looks for `emit(Codes.NAME, 'severity'` (F-P3-17).
  const emit: FontInfoEmit = reporter ?? ((): void => {});
  // IMPL-080-R010: a FontInfo CodeTable must be positionally aligned with the glyph table. A length
  // disagreement is a conflict between the two tags, not an unsorted table — same code, SF0276.
  if (info.codes.length !== font.glyphs.length) {
    emit(
      Codes.FONT_CODE_TABLE_UNSORTED,
      'warning',
      `FontInfo for font ${font.id} carries ${info.codes.length} code(s) for ${font.glyphs.length} glyph(s); codes are aligned by position, extras dropped and gaps left unmapped`,
    );
  }
  const codes = font.glyphs.map((_, i) => info.codes[i] ?? null);
  const numericCodes = codes.map((c) => (c === null ? 0 : c));
  const unsorted = numericCodes.some((code, i) => i > 0 && code < (numericCodes[i - 1] ?? 0));
  if (unsorted) {
    emit(
      Codes.FONT_CODE_TABLE_UNSORTED,
      'warning',
      `FontInfo for font ${font.id} merged code table is not sorted; a sorted copy is used for lookup and the raw order is kept`,
    );
  }
  // Promote a v1 model to a shape-only DefineFontModel with codes from Info.
  if (font.version === 1) {
    return {
      id: font.id,
      version: 2, // treated as a v2-equivalent code table (glyphs already decoded)
      tagCode: 48,
      name: info.name,
      languageCode: info.languageCode ?? 0,
      unitsPerEm: 1024,
      italic: flags.italic,
      bold: flags.bold,
      wideCodes: flags.wideCodes,
      shiftJIS: flags.shiftJIS,
      ansi: flags.ansi,
      smallText: flags.smallText,
      glyphs: font.glyphs.map((g, i) => ({ ...g, code: codes[i] ?? null })),
      codes: numericCodes,
      ascent: null,
      descent: null,
      leading: null,
      kerning: [],
    };
  }
  return {
    ...(font as DefineFontModel),
    name: font.name.length === 0 ? info.name : font.name,
    glyphs: font.glyphs.map((g, i) => ({ ...g, code: codes[i] ?? g.code })),
    codes: numericCodes,
    italic: flags.italic || font.italic,
    bold: flags.bold || font.bold,
    shiftJIS: flags.shiftJIS || font.shiftJIS,
    ansi: flags.ansi || font.ansi,
    smallText: flags.smallText || font.smallText,
    wideCodes: flags.wideCodes || font.wideCodes,
  };
}

/** `DefineFontInfo` (13) / `DefineFontInfo2` (62): flags + name + code table. */
export function decodeFontInfo(tagCode: number, c: Cursor): FontInfoModel {
  if (tagCode !== Tag.DefineFontInfo && tagCode !== Tag.DefineFontInfo2) {
    throw new RangeError(`tag ${tagCode} is not DefineFontInfo/2`);
  }
  const id = c.u16();
  const nameLength = c.u8();
  const name = decodeUtf8(c.bytes.subarray(c.offset, Math.min(c.limit, c.offset + nameLength)));
  c.skip(nameLength);
  const flagsByte = c.u8();
  const flags = {
    smallText: (flagsByte & 0x20) !== 0,
    shiftJIS: (flagsByte & 0x10) !== 0,
    ansi: (flagsByte & 0x08) !== 0,
    italic: (flagsByte & 0x04) !== 0,
    bold: (flagsByte & 0x02) !== 0,
    wideCodes: (flagsByte & 0x01) !== 0,
  };
  let languageCode: number | null = null;
  if (tagCode === Tag.DefineFontInfo2) {
    languageCode = c.u8();
    if (!flags.wideCodes) {
      c.emit(
        Codes.FONT_INFO2_WIDE_CODES_MISSING,
        'error',
        `DefineFontInfo2 ${id} has WideCodes clear but SWF requires UI16 codes; reading as UI16 to stay in sync`,
      );
    }
    // Force wideCodes for Info2 regardless of the (malformed) flag.
    flags.wideCodes = true;
  }
  const codes: number[] = [];
  while (c.offset < c.limit) codes.push(flags.wideCodes ? c.u16() : c.u8());
  // Detect unsorted here; emit once but do not reorder (preserve authored mapping).
  if (codes.some((code, i) => i > 0 && code < (codes[i - 1] ?? 0))) {
    c.emit(Codes.FONT_CODE_TABLE_UNSORTED, 'warning', `FontInfo for font ${id} has an unsorted CodeTable`);
  }
  const indirect = /^_(sans|serif|typewriter|ゴシック|明朝|等幅)/.test(name);
  if (indirect) {
    c.emit(
      Codes.FONT_INDIRECT_NAME,
      'info',
      `font ${id} name "${name}" is an indirect (device-stack) alias; recorded as indirect`,
    );
  }
  return {
    id,
    tagCode: tagCode as 13 | 62,
    version: tagCode === Tag.DefineFontInfo2 ? 2 : 1,
    name,
    flags,
    languageCode,
    codes,
  };
}

/** `DefineFontName` (88): two NUL-terminated strings (PostScript name, copyright). */
export function decodeFontName(c: Cursor): FontNameModel {
  const id = c.u16();
  const fontName = c.string();
  const copyright = c.string();
  return { id, fontName, copyright };
}

/**
 * `DefineFontAlignZones` (73): `FontID`, `CSMTableHint UB[2]`, `Reserved UB[6]`, then one
 * `ZONERECORD` per glyph (IMPL-080-R035). A ZONERECORD is `NumZoneData UI8` (always 2 in practice),
 * `ZONEDATA[NumZoneData]{AlignmentCoordinate FLOAT16, Range FLOAT16}`, then a flags byte carrying
 * `Reserved UB[6]`, `ZoneMaskY UB[1]`, `ZoneMaskX UB[1]`.
 *
 * The record count is implied by the target font's glyph count, which this decoder does not have:
 * read records until the body is exhausted and let the model layer reconcile the count.
 */
export function decodeFontAlignZones(c: Cursor): FontAlignZonesModel {
  const id = c.u16();
  const csmTableHint = c.ub(2);
  c.ub(6); // reserved
  c.align();
  const records: FontZoneRecord[] = [];
  while (c.offset < c.limit) {
    const numZoneData = c.u8();
    // Each ZONEDATA is 4 bytes; the trailing flags byte makes the record 1 + 4n + 1 bytes long.
    if (c.limit - c.offset < numZoneData * 4 + 1) {
      c.emit(
        Codes.FONT_HINT_TARGET_INVALID,
        'warning',
        `font ${id} alignment zone record ${records.length} declares ${numZoneData} zone(s) but the tag body ends early`,
      );
      break;
    }
    const zones: FontZoneData[] = [];
    for (let index = 0; index < numZoneData; index += 1) {
      const alignmentCoordinate = c.float16();
      const range = c.float16();
      zones.push({ alignmentCoordinate, range });
    }
    const zoneMask = c.u8();
    records.push({
      zones,
      zoneMaskY: (zoneMask & 0x02) !== 0,
      zoneMaskX: (zoneMask & 0x01) !== 0,
    });
  }
  return { id, csmTableHint, zones: records };
}

/**
 * `CSMTextSettings` (74): `TextID`, `UseFlashType UB[2]`, `GridFit UB[3]`, `Reserved UB[3]`,
 * `Thickness F32`, `Sharpness F32`, `Reserved UI8` (IMPL-080-R036).
 */
export function decodeCsmTextSettings(c: Cursor): CsmTextSettingsModel {
  const textId = c.u16();
  const useFlashType = c.ub(2);
  const gridFit = c.ub(3);
  c.ub(3); // reserved
  c.align();
  const thickness = c.float32();
  const sharpness = c.float32();
  c.u8(); // reserved UI8
  return { textId, useFlashType, gridFit, thickness, sharpness };
}

/**
 * The chapter's advanced-anti-aliasing cutoffs for a `CSMTextSettings` record at a given font size
 * (IMPL-080-R036, errata `E-017`: the prose claims outside ≤ inside, the formulas give
 * `outside − inside = sharpness`; we implement the formulas).
 */
export function csmCutoffs(
  settings: CsmTextSettingsModel,
  fontSize: number,
): {
  readonly outsideCutoff: number;
  readonly insideCutoff: number;
} {
  return {
    outsideCutoff: (0.5 * settings.sharpness - settings.thickness) * fontSize,
    insideCutoff: (-0.5 * settings.sharpness - settings.thickness) * fontSize,
  };
}
