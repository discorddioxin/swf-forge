/**
 * C4 — `T-AST-023` extended to the variants the single pinned fixture does not cover:
 * `DefineFont3`'s 20480 EM, wide (non-Latin) code points, and the `SF0281` glyph quarantine.
 *
 * The existing determinism test pins one 1024-EM, one-glyph, code-65 font. That proves the writer
 * is reproducible; it does not prove it is reproducible *for the inputs the decoder actually
 * produces*, which is where a unitsPerEm or cmap bug would show.
 */

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import opentype from 'opentype.js';
import {
  Cursor,
  DiagnosticSink,
  Tag,
  decodeDefineShapeVersion,
  normaliseFontUnits,
  type DefineFontModel,
  type FontGlyphModel,
  type VectorShape,
} from '@swf-forge/swf';
import { encodeFontWoff2 } from '../src/index.js';

const require = createRequire(import.meta.url);
const woff2 = require('wawoff2') as { decompress(bytes: Uint8Array): Promise<Uint8Array> };

function glyph(overrides: Partial<FontGlyphModel> & Pick<FontGlyphModel, 'index' | 'code'>): FontGlyphModel {
  return { shape: null, advance: 600, bounds: null, quarantined: false, ...overrides };
}

function font(overrides: Partial<DefineFontModel> = {}): DefineFontModel {
  return {
    id: 7,
    version: 2,
    tagCode: Tag.DefineFont2,
    name: 'Variant Family',
    languageCode: 0,
    unitsPerEm: 1024,
    italic: false,
    bold: false,
    wideCodes: true,
    shiftJIS: false,
    ansi: false,
    smallText: false,
    codes: [65],
    glyphs: [glyph({ index: 0, code: 65 })],
    ascent: 800,
    descent: 200,
    leading: -40,
    kerning: [],
    ...overrides,
  };
}

async function parse(bytes: Uint8Array): Promise<opentype.Font> {
  const sfnt = await woff2.decompress(bytes);
  return opentype.parse(sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength));
}

describe('T-AST-023 WOFF2 across font variants', () => {
  it('carries DefineFont3 20480 units/em through to the sfnt head table', async () => {
    const result = encodeFontWoff2(font({ version: 3, tagCode: Tag.DefineFont3, unitsPerEm: 20480 }));

    expect(result.unitsPerEm).toBe(20480);
    expect((await parse(result.bytes)).unitsPerEm).toBe(20480);
  });

  it('is byte-deterministic at 20480 units/em as well as 1024', () => {
    const wide = font({ version: 3, tagCode: Tag.DefineFont3, unitsPerEm: 20480 });

    expect(encodeFontWoff2(wide).bytes).toEqual(encodeFontWoff2(wide).bytes);
  });

  it('produces different bytes for the two EM sizes, so the field is not being ignored', () => {
    const small = encodeFontWoff2(font()).bytes;
    const large = encodeFontWoff2(font({ version: 3, tagCode: Tag.DefineFont3, unitsPerEm: 20480 })).bytes;

    expect(Buffer.from(large).toString('hex')).not.toBe(Buffer.from(small).toString('hex'));
  });

  it('maps wide code points above U+00FF into the cmap', async () => {
    const result = encodeFontWoff2(
      font({
        codes: [0x3042, 0x4e2d, 0x00e9],
        glyphs: [
          glyph({ index: 0, code: 0x3042 }),
          glyph({ index: 1, code: 0x4e2d }),
          glyph({ index: 2, code: 0x00e9 }),
        ],
      }),
    );
    const parsed = await parse(result.bytes);

    expect(parsed.charToGlyphIndex('\u3042')).toBe(0);
    expect(parsed.charToGlyphIndex('\u4e2d')).toBe(1);
    expect(parsed.charToGlyphIndex('\u00e9')).toBe(2);
  });

  it('is deterministic for a wide-code font too', () => {
    const wide = font({
      codes: [0x3042, 0x4e2d],
      glyphs: [glyph({ index: 0, code: 0x3042 }), glyph({ index: 1, code: 0x4e2d })],
    });

    expect(encodeFontWoff2(wide).bytes).toEqual(encodeFontWoff2(wide).bytes);
  });

  it('skips a surrogate-range code rather than emitting an invalid cmap entry', async () => {
    const result = encodeFontWoff2(
      font({ codes: [0xd800, 65], glyphs: [glyph({ index: 0, code: 0xd800 }), glyph({ index: 1, code: 65 })] }),
    );
    const parsed = await parse(result.bytes);

    expect(parsed.charToGlyphIndex('A')).toBe(1);
    expect(result.glyphCount).toBe(2);
  });

  it('keeps the first glyph for a duplicated code instead of producing two cmap entries', async () => {
    const result = encodeFontWoff2(
      font({ codes: [65, 65], glyphs: [glyph({ index: 0, code: 65 }), glyph({ index: 1, code: 65 })] }),
    );

    expect((await parse(result.bytes)).charToGlyphIndex('A')).toBe(0);
  });
});

describe('a quarantined glyph (SF0281) contributes no outline', () => {
  // The decoder's side of the rule is pinned in `packages/swf/test/font-metrics.test.ts`. What the
  // asset package owes is the other half: a glyph the decoder marked must not reach the font.
  const outline = squareShape();

  function withQuarantine(quarantined: boolean): DefineFontModel {
    return font({ glyphs: [glyph({ index: 0, code: 65, shape: outline, quarantined })] });
  }

  it('drops the quarantined outline while keeping the glyph, its index and its cmap entry', async () => {
    const cleanFont = await parse(encodeFontWoff2(withQuarantine(false)).bytes);
    const dirtyFont = await parse(encodeFontWoff2(withQuarantine(true)).bytes);

    // Same glyph count and same cmap, so DefineText glyph indices still resolve...
    expect(dirtyFont.glyphs.length).toBe(cleanFont.glyphs.length);
    expect(dirtyFont.charToGlyphIndex('A')).toBe(cleanFont.charToGlyphIndex('A'));
    // ...but the defective outline does not reach the emitted font.
    expect(cleanFont.glyphs.get(0).path.commands.length).toBeGreaterThan(0);
    expect(dirtyFont.glyphs.get(0).path.commands).toHaveLength(0);
  });

  it('keeps the advance, so a quarantined glyph still occupies its width', async () => {
    const dirtyFont = await parse(encodeFontWoff2(withQuarantine(true)).bytes);
    expect(dirtyFont.glyphs.get(0).advanceWidth).toBe(600);
  });

  it('normalising the EM preserves the quarantine flag', () => {
    const normalised = normaliseFontUnits(withQuarantine(true), 20480);
    expect(normalised.glyphs[0]?.quarantined).toBe(true);
    expect(normalised.glyphs[0]?.shape).not.toBeNull();
  });
});

/** An 80x80 square as a decoded `VectorShape`, built through the production shape decoder. */
function squareShape(): VectorShape {
  const bits: number[] = [];
  const put = (value: number, count: number): void => {
    for (let i = count - 1; i >= 0; i -= 1) bits.push((value >>> i) & 1);
  };
  const bytes: number[] = [];
  const flush = (): void => {
    while (bits.length % 8 !== 0) bits.push(0);
    for (let i = 0; i < bits.length; i += 8) {
      let byte = 0;
      for (let b = 0; b < 8; b += 1) byte = (byte << 1) | (bits[i + b] as number);
      bytes.push(byte);
    }
    bits.length = 0;
  };
  bytes.push(0x00, 0x01); // ShapeId
  put(0, 5); // RECT Nbits = 0 -> a 0x0 declared box
  flush();
  bytes.push(1, 0x00, 0, 0, 0); // one solid black fill
  bytes.push(0); // no line styles
  put(1, 4); // NumFillBits
  put(0, 4); // NumLineBits
  put(0, 1); // STYLECHANGERECORD
  put(0, 1);
  put(0, 1);
  put(0, 1);
  put(1, 1); // StateFillStyle0
  put(1, 1); // StateMoveTo
  put(1, 5);
  put(0, 1);
  put(0, 1);
  put(1, 1); // FillStyle0 = 1
  const edges: readonly (readonly [number, number])[] = [
    [80, 0],
    [0, 80],
    [-80, 0],
    [0, -80],
  ];
  for (const [dx, dy] of edges) {
    put(1, 1);
    put(1, 1);
    put(14, 4);
    put(1, 1);
    put(dx < 0 ? 65536 + dx : dx, 16);
    put(dy < 0 ? 65536 + dy : dy, 16);
  }
  put(0, 6);
  flush();
  const body = Uint8Array.from(bytes);
  const cursor = new Cursor(body, 0, body.length, {
    sink: new DiagnosticSink(),
    version: 10,
    tagCode: Tag.DefineShape,
  });
  return decodeDefineShapeVersion(Tag.DefineShape, cursor).shape;
}
