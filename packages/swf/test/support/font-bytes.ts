/** Shared `DefineFont`/`DefineFont2`/`DefineFont3` byte builders for the C4 font and text tests. */

import { ByteWriter, writeRect } from '@swf-forge/swf/test-support';

export interface GlyphBoxOptions {
  /** Box side length in the font's own units. */
  readonly size?: number;
  /**
   * Which fill-state bit the mandatory first `STYLECHANGERECORD` sets (`IMPL-080-R009`).
   * `'fill0'` conforms; the others are the real-world violations `SF0281` reports.
   */
  readonly fillState?: 'fill0' | 'fill1' | 'none' | 'line';
  /** Value written into the `FillStyle0` field; anything but 1 violates R009. */
  readonly fillIndex?: number;
}

/**
 * One square outline as a glyph `SHAPE` — `NumFillBits`/`NumLineBits`, a style-change record, four
 * straight edges, `EndShapeRecord`.
 *
 * Coordinates are written with 16-bit deltas so a `DefineFont3`-scale box (×20) fits the same
 * builder as a `DefineFont2` one.
 */
export function glyphBox(options: GlyphBoxOptions = {}): Uint8Array {
  const size = options.size ?? 80;
  const fillState = options.fillState ?? 'fill0';
  const fillIndex = options.fillIndex ?? 1;
  const w = new ByteWriter();
  const fillBits = 4;
  w.bits(fillBits, 4).bits(fillState === 'line' ? 4 : 0, 4);
  // STYLECHANGERECORD: TypeFlag=0, StateNewStyles, StateLineStyle, StateFillStyle1, StateFillStyle0, StateMoveTo
  w.bits(0, 1)
    .bits(0, 1)
    .bits(fillState === 'line' ? 1 : 0, 1)
    .bits(fillState === 'fill1' ? 1 : 0, 1)
    .bits(fillState === 'fill0' ? 1 : 0, 1)
    .bits(1, 1);
  w.bits(1, 5).bits(0, 1).bits(0, 1); // MoveBits = 1, move to (0, 0)
  if (fillState === 'fill0' || fillState === 'fill1') w.bits(fillIndex, fillBits);
  if (fillState === 'line') w.bits(1, 4);
  const line = (dx: number, dy: number): void => {
    w.bits(1, 1).bits(1, 1).bits(14, 4).bits(1, 1); // straight, general, 16-bit deltas
    w.bits(dx < 0 ? 65536 + dx : dx, 16).bits(dy < 0 ? 65536 + dy : dy, 16);
  };
  line(size, 0);
  line(0, size);
  line(-size, 0);
  line(0, -size);
  w.bits(0, 6).align();
  return w.toUint8Array();
}

/** An empty glyph: a `SHAPE` whose first record is `EndShapeRecord` — a space, not a defect. */
export function glyphEmpty(): Uint8Array {
  const w = new ByteWriter();
  w.bits(1, 4).bits(0, 4);
  w.bits(0, 6).align();
  return w.toUint8Array();
}

export interface Font2Options {
  readonly id?: number;
  readonly name?: string;
  readonly codes?: readonly number[];
  readonly wideCodes?: boolean;
  readonly languageCode?: number;
  readonly layout?: { ascent: number; descent: number; leading: number; advances: readonly number[] } | null;
  readonly boundsSize?: number;
  readonly italic?: boolean;
  readonly bold?: boolean;
}

/**
 * A `DefineFont2`/`DefineFont3` body.
 *
 * `OffsetTable` entries and `CodeTableOffset` are byte distances from the **start of the offset
 * table** (`IMPL-080-R011`), which is what makes the two bases easy to get wrong; the builder
 * computes them rather than taking them as literals so a fixture cannot drift from the rule.
 */
export function defineFont2Body(glyphs: readonly Uint8Array[], options: Font2Options = {}): Uint8Array {
  const id = options.id ?? 17;
  const wideCodes = options.wideCodes ?? true;
  const codes = options.codes ?? glyphs.map((_, index) => 65 + index);
  const layout = options.layout === undefined ? null : options.layout;
  const name = new TextEncoder().encode(options.name ?? 'Test Font');
  const w = new ByteWriter();
  const flags =
    (layout !== null ? 0x80 : 0) | (wideCodes ? 0x04 : 0) | (options.italic ? 0x02 : 0) | (options.bold ? 0x01 : 0);
  w.u16(id)
    .u8(flags)
    .u8(options.languageCode ?? 0)
    .u8(name.length)
    .bytes(name)
    .u16(glyphs.length);

  // The offset table is `glyphs.length + 1` UI16 entries (the extra one is CodeTableOffset).
  const tableBytes = (glyphs.length + 1) * 2;
  let running = tableBytes;
  for (const glyph of glyphs) {
    w.u16(running);
    running += glyph.length;
  }
  w.u16(running); // CodeTableOffset
  for (const glyph of glyphs) w.bytes(glyph);
  for (const code of codes) {
    if (wideCodes) w.u16(code);
    else w.u8(code);
  }
  if (layout !== null) {
    w.u16(layout.ascent).u16(layout.descent).s16(layout.leading);
    for (let index = 0; index < glyphs.length; index += 1) w.s16(layout.advances[index] ?? 0);
    const size = options.boundsSize ?? 80;
    for (let index = 0; index < glyphs.length; index += 1) {
      writeRect(w, { xMin: 0, xMax: size, yMin: -size, yMax: 0 });
    }
    w.u16(0); // no kerning records
  }
  return w.toUint8Array();
}

/** A `DefineFont` (v1) body: `FontID`, `OffsetTable UI16[n]`, then the glyph shapes. */
export function defineFontV1Body(glyphs: readonly Uint8Array[], id = 17): Uint8Array {
  const w = new ByteWriter();
  w.u16(id);
  let running = glyphs.length * 2;
  for (const glyph of glyphs) {
    w.u16(running);
    running += glyph.length;
  }
  for (const glyph of glyphs) w.bytes(glyph);
  return w.toUint8Array();
}
