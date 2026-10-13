/**
 * C4 — font code maps, EM normalisation, derived metrics and the glyph fill-style rule.
 *
 * `T-MOD-501` (`DefineFont2` vs `DefineFont3` equality after EM normalisation), `T-MOD-510`
 * (UTF-8 font names measured in bytes), `T-MOD-516` (unsorted `CodeTable` → sorted lookup copy,
 * raw order kept, `SF0276`), plus `IMPL-080-R007` (`SF0275`) and `IMPL-080-R009` (`SF0281`).
 */

import { describe, expect, it } from 'vitest';

import {
  Cursor,
  DiagnosticSink,
  Tag,
  codeToGlyph,
  decodeDefineFont2or3,
  decodeDefineFontV1,
  deriveFontMetrics,
  duplicateCodes,
  normaliseFontUnits,
  serialiseVectorShape,
  type DefineFontModel,
} from '@swf-forge/swf';
import { defineFont2Body, defineFontV1Body, glyphBox, glyphEmpty } from './support/font-bytes.js';
import { buildAndDecode, writeStraightEdge, writeStyleChange } from './support/shape-bytes.js';

function decodeFont2(
  body: Uint8Array,
  tagCode: typeof Tag.DefineFont2 | typeof Tag.DefineFont3 = Tag.DefineFont2,
): { font: DefineFontModel; codes: string[]; messages: string[] } {
  const sink = new DiagnosticSink();
  const cursor = new Cursor(body, 0, body.length, { sink, version: 10, tagCode });
  const font = decodeDefineFont2or3(tagCode, cursor);
  const list = sink.list();
  return { font, codes: list.map((d) => d.code), messages: list.map((d) => d.message) };
}

function decodeFont1(body: Uint8Array): { glyphCount: number; codes: string[]; quarantined: boolean[] } {
  const sink = new DiagnosticSink();
  const cursor = new Cursor(body, 0, body.length, { sink, version: 10, tagCode: Tag.DefineFont });
  const font = decodeDefineFontV1(cursor);
  return {
    glyphCount: font.glyphCount,
    codes: sink.list().map((d) => d.code),
    quarantined: font.glyphs.map((g) => g.quarantined),
  };
}

const LAYOUT = { ascent: 800, descent: 200, leading: -40, advances: [600, 610] };

describe('T-MOD-501 DefineFont2 and DefineFont3 describe the same typeface', () => {
  // DefineFont3 is DefineFont2 with every glyph coordinate multiplied by 20.
  const body2 = defineFont2Body([glyphBox({ size: 80 }), glyphBox({ size: 60 })], { layout: LAYOUT, boundsSize: 80 });
  const body3 = defineFont2Body([glyphBox({ size: 1600 }), glyphBox({ size: 1200 })], {
    layout: { ascent: 16000, descent: 4000, leading: -800, advances: [12000, 12200] },
    boundsSize: 1600,
  });

  it('reports the two EM sizes the tags imply', () => {
    expect(decodeFont2(body2, Tag.DefineFont2).font.unitsPerEm).toBe(1024);
    expect(decodeFont2(body3, Tag.DefineFont3).font.unitsPerEm).toBe(20480);
  });

  it('normalises DefineFont3 onto the DefineFont2 EM and the glyph IR then matches exactly', () => {
    const font2 = decodeFont2(body2, Tag.DefineFont2).font;
    const font3 = decodeFont2(body3, Tag.DefineFont3).font;
    const normalised = normaliseFontUnits(font3, 1024);

    expect(normalised.unitsPerEm).toBe(1024);
    for (let index = 0; index < font2.glyphs.length; index += 1) {
      const expected = font2.glyphs[index]?.shape;
      const actual = normalised.glyphs[index]?.shape;
      expect(actual).not.toBeNull();
      expect(serialiseVectorShape(actual as never)).toBe(serialiseVectorShape(expected as never));
    }
  });

  it('scales the metrics, the advances and the glyph bounds with the outlines', () => {
    const normalised = normaliseFontUnits(decodeFont2(body3, Tag.DefineFont3).font, 1024);

    expect(normalised).toMatchObject({ ascent: 800, descent: 200, leading: -40 });
    expect(normalised.glyphs.map((g) => g.advance)).toEqual([600, 610]);
    expect(normalised.glyphs[0]?.bounds).toEqual({ xMin: 0, xMax: 80, yMin: -80, yMax: 0 });
  });

  it('comparing the raw fonts would report every glyph as different', () => {
    // The point of the normalisation step: without it the same typeface fails its own equality
    // check, which is how a ×20 bug hides.
    const font2 = decodeFont2(body2, Tag.DefineFont2).font;
    const font3 = decodeFont2(body3, Tag.DefineFont3).font;

    expect(serialiseVectorShape(font3.glyphs[0]?.shape as never)).not.toBe(
      serialiseVectorShape(font2.glyphs[0]?.shape as never),
    );
  });

  it('is a no-op when the font is already on the target EM, and round-trips upward losslessly', () => {
    const font2 = decodeFont2(body2, Tag.DefineFont2).font;

    expect(normaliseFontUnits(font2, 1024)).toBe(font2);
    expect(
      serialiseVectorShape(normaliseFontUnits(normaliseFontUnits(font2, 20480), 1024).glyphs[0]?.shape as never),
    ).toBe(serialiseVectorShape(font2.glyphs[0]?.shape as never));
  });

  it('rejects a non-positive target EM rather than producing a collapsed font', () => {
    const font2 = decodeFont2(body2, Tag.DefineFont2).font;
    expect(() => normaliseFontUnits(font2, 0)).toThrow(RangeError);
    expect(() => normaliseFontUnits(font2, Number.NaN)).toThrow(RangeError);
  });
});

describe('T-MOD-510 font names are UTF-8 counted in bytes (IMPL-080-R018)', () => {
  it('decodes a multi-byte name whose byte length exceeds its character count', () => {
    const name = 'ゴシック体'; // 5 characters, 15 UTF-8 bytes
    expect(new TextEncoder().encode(name)).toHaveLength(15);
    const { font } = decodeFont2(defineFont2Body([glyphBox()], { name, layout: null }));

    expect(font.name).toBe(name);
    expect(font.name).toHaveLength(5);
  });

  it('does not stop the name at an interior NUL', () => {
    // Truncating at a NUL is the classic bug; FontNameLen is the only terminator (R018).
    const raw = Uint8Array.from([0x41, 0x00, 0x42]);
    const name = new TextDecoder().decode(raw);
    const { font } = decodeFont2(defineFont2Body([glyphBox()], { name, layout: null }));

    expect([...font.name].map((c) => c.codePointAt(0))).toEqual([0x41, 0x00, 0x42]);
  });

  it('keeps the glyph and code tables aligned after a multi-byte name', () => {
    // A name length read as characters instead of bytes desynchronises everything after it.
    const { font } = decodeFont2(
      defineFont2Body([glyphBox(), glyphBox({ size: 40 })], { name: '明朝', codes: [0x3042, 0x3044], layout: null }),
    );

    expect(font.codes).toEqual([0x3042, 0x3044]);
    expect(font.glyphs.map((g) => g.shape !== null)).toEqual([true, true]);
  });
});

describe('T-MOD-516 unsorted CodeTable (IMPL-080-R010)', () => {
  const unsorted = defineFont2Body([glyphBox(), glyphBox({ size: 40 }), glyphBox({ size: 20 })], {
    codes: [67, 65, 66],
    layout: null,
  });

  it('reports SF0276 and keeps the authored glyph order untouched', () => {
    const { font, codes } = decodeFont2(unsorted);

    expect(codes).toContain('SF0276');
    // Raw order is what `inspect --fonts` prints and what DefineText glyph indices address.
    expect(font.codes).toEqual([67, 65, 66]);
    expect(font.glyphs.map((g) => g.code)).toEqual([67, 65, 66]);
  });

  it('builds the lookup from a sorted copy without renumbering the glyphs', () => {
    const { font } = decodeFont2(unsorted);
    const map = codeToGlyph(font);

    expect([...map.keys()]).toEqual([65, 66, 67]);
    // Crucially the glyph *indices* are unchanged: index 0 is still the glyph for code 67.
    expect(map.get(65)?.index).toBe(1);
    expect(map.get(66)?.index).toBe(2);
    expect(map.get(67)?.index).toBe(0);
  });

  it('does not report SF0276 for a correctly sorted table', () => {
    const { codes } = decodeFont2(defineFont2Body([glyphBox(), glyphBox()], { codes: [65, 66], layout: null }));
    expect(codes).not.toContain('SF0276');
  });

  it('resolves a duplicated code to the lowest glyph index and names the duplicate', () => {
    const { font } = decodeFont2(
      defineFont2Body([glyphBox(), glyphBox({ size: 40 })], { codes: [65, 65], layout: null }),
    );

    expect(duplicateCodes(font)).toEqual([65]);
    expect(codeToGlyph(font).get(65)?.index).toBe(0);
  });
});

describe('IMPL-080-R009 glyph fill-style rule (SF0281)', () => {
  it('accepts the conforming form without a diagnostic', () => {
    const { font, codes } = decodeFont2(defineFont2Body([glyphBox({ fillState: 'fill0' })], { layout: null }));

    expect(codes).not.toContain('SF0281');
    expect(font.glyphs[0]?.quarantined).toBe(false);
    expect(font.glyphs[0]?.shape).not.toBeNull();
  });

  it('quarantines a glyph that sets StateFillStyle1 instead, and keeps the outline readable', () => {
    const { font, codes, messages } = decodeFont2(
      defineFont2Body([glyphBox({ fillState: 'fill1' })], { layout: null }),
    );

    expect(codes).toContain('SF0281');
    expect(messages.join(' ')).toContain('StateFillStyle1');
    expect(font.glyphs[0]?.quarantined).toBe(true);
    // The shape is still decoded: discarding it would lose fidelity on content R009 tells us to
    // tolerate. The quarantine flag is what font emission acts on.
    expect(font.glyphs[0]?.shape).not.toBeNull();
  });

  it('quarantines a glyph whose FillStyle0 index is not 1', () => {
    const { font, messages } = decodeFont2(
      defineFont2Body([glyphBox({ fillState: 'fill0', fillIndex: 2 })], { layout: null }),
    );

    expect(font.glyphs[0]?.quarantined).toBe(true);
    expect(messages.join(' ')).toContain('FillStyle0 = 2');
  });

  it('quarantines a glyph that uses the line-style fields', () => {
    const { font, messages } = decodeFont2(defineFont2Body([glyphBox({ fillState: 'line' })], { layout: null }));

    expect(font.glyphs[0]?.quarantined).toBe(true);
    expect(messages.join(' ')).toContain('line-style');
  });

  it('does not flag an empty glyph — a space has no outline to fill', () => {
    const { font, codes } = decodeFont2(defineFont2Body([glyphEmpty(), glyphBox()], { codes: [32, 65], layout: null }));

    expect(codes).not.toContain('SF0281');
    expect(font.glyphs.map((g) => g.quarantined)).toEqual([false, false]);
  });

  it('reports once per font even when several glyphs violate the rule (IMPL-080-R044)', () => {
    const { font, codes } = decodeFont2(
      defineFont2Body([glyphBox({ fillState: 'fill1' }), glyphBox({ fillState: 'fill1', size: 40 })], {
        layout: null,
      }),
    );

    expect(codes.filter((code) => code === 'SF0281')).toHaveLength(1);
    // Both glyphs are still marked, so the per-glyph fact survives the per-font report.
    expect(font.glyphs.map((g) => g.quarantined)).toEqual([true, true]);
  });

  it('applies to v1 fonts too, which share the glyph decoder', () => {
    const result = decodeFont1(defineFontV1Body([glyphBox({ fillState: 'fill1' })]));

    expect(result.codes).toContain('SF0281');
    expect(result.quarantined).toEqual([true]);
  });
});

describe('T-MOD-503 FontLayoutTable metric signedness and scaling', () => {
  function laidOut(layout: { ascent: number; descent: number; leading: number; advances: number[] }) {
    return decodeFont2(defineFont2Body([glyphBox(), glyphBox({ size: 40 })], { codes: [65, 66], layout })).font;
  }

  it('reads FontLeading as signed, so a negative value survives', () => {
    // Ascent and descent are UI16 but Leading is SI16; reading all three the same way turns a small
    // negative leading into ~65 000.
    const font = laidOut({ ascent: 880, descent: 120, leading: -40, advances: [600, 300] });

    expect(font.leading).toBe(-40);
  });

  it('reads ascent and descent as unsigned, so neither wraps negative near 0xFFFF', () => {
    const font = laidOut({ ascent: 0xfff0, descent: 0xff00, leading: 0, advances: [0, 0] });

    expect(font.ascent).toBe(0xfff0);
    expect(font.descent).toBe(0xff00);
  });

  it('carries advances signed and unscaled, in the font EM', () => {
    const font = laidOut({ ascent: 880, descent: 120, leading: 0, advances: [600, -300] });

    expect(font.glyphs.map((g) => g.advance)).toEqual([600, -300]);
    expect(font.unitsPerEm).toBe(1024);
  });

  it('marks authored metrics as not derived, unlike the R007 fallback', () => {
    const font = laidOut({ ascent: 880, descent: 120, leading: -40, advances: [600, 300] });

    expect(deriveFontMetrics(font)).toEqual({ ascent: 880, descent: 120, leading: -40, derived: false });
  });

  it('scales every metric, including a negative leading, when the EM is normalised', () => {
    const font = normaliseFontUnits(laidOut({ ascent: 880, descent: 120, leading: -40, advances: [600, 300] }), 2048);

    expect(font).toMatchObject({ unitsPerEm: 2048, ascent: 1760, descent: 240, leading: -80 });
    expect(font.glyphs.map((g) => g.advance)).toEqual([1200, 600]);
  });
});

describe('IMPL-080-R007 metrics derivation (SF0275)', () => {
  it('reports SF0275 for a v1 font, which carries no metrics at all', () => {
    expect(decodeFont1(defineFontV1Body([glyphBox()])).codes).toContain('SF0275');
  });

  it('reports SF0275 for a DefineFont2 without a FontLayoutTable', () => {
    expect(decodeFont2(defineFont2Body([glyphBox()], { layout: null })).codes).toContain('SF0275');
  });

  it('does not report SF0275 when the font authored its layout table', () => {
    const { codes } = decodeFont2(defineFont2Body([glyphBox(), glyphBox()], { layout: LAYOUT }));
    expect(codes).not.toContain('SF0275');
  });

  it('returns the authored numbers unchanged, flagged as not derived', () => {
    const { font } = decodeFont2(defineFont2Body([glyphBox(), glyphBox()], { layout: LAYOUT }));

    expect(deriveFontMetrics(font)).toEqual({ ascent: 800, descent: 200, leading: -40, derived: false });
  });

  it('derives ascent and descent from glyph bounds with SWF y-down signs', () => {
    // glyphBox draws from (0,0) to (size,size) with y increasing downward, so the whole outline
    // sits *below* the baseline: ascent 0, descent = size.
    const { font } = decodeFont2(defineFont2Body([glyphBox({ size: 80 })], { layout: null }));

    expect(deriveFontMetrics(font)).toEqual({ ascent: 0, descent: 80, leading: 0, derived: true });
  });

  it('does not invent a leading value', () => {
    // There is no bounds-based estimate for leading; guessing one shifts every multi-line layout.
    const { font } = decodeFont2(defineFont2Body([glyphBox()], { layout: null }));
    expect(deriveFontMetrics(font).leading).toBe(0);
  });
});

describe('F-P3-18 a glyph SHAPE has no declared bounds', () => {
  it('does not report SF0187 against the synthesised placeholder box', () => {
    const { codes } = decodeFont2(defineFont2Body([glyphBox({ size: 80 })], { layout: null }));
    expect(codes).not.toContain('SF0187');
  });

  it('uses the recomputed outline box as the glyph shape bounds', () => {
    const { font } = decodeFont2(defineFont2Body([glyphBox({ size: 80 })], { layout: null }));

    expect(font.glyphs[0]?.shape?.bounds).toEqual({ xMin: 0, xMax: 80, yMin: 0, yMax: 80 });
    expect(font.glyphs[0]?.shape?.recomputedBounds).toEqual({ xMin: 0, xMax: 80, yMin: 0, yMax: 80 });
  });

  it('still reports a genuine disagreement on a DefineShape, which does declare its bounds', () => {
    // The suppression is scoped to callers that pass `boundsAuthored: false`. A shape tag declares
    // a real RECT, so the check must stay live there — this is not a blanket silencing of SF0187.
    const { codes } = buildAndDecode({
      version: 1,
      bounds: { xMin: 0, xMax: 0, yMin: 0, yMax: 0 },
      fills: (w) => w.u8(1).u8(0x00).u8(0).u8(0).u8(0),
      numFillBits: 1,
      records: (w) => {
        writeStyleChange(w, { fill0: 1, numFillBits: 1, numLineBits: 0, moveTo: [0, 0] });
        writeStraightEdge(w, 80, 0);
        writeStraightEdge(w, 0, 80);
      },
    });

    expect(codes).toContain('SF0187');
  });
});

describe('F-P3-10 glyph fill-winding default', () => {
  it('states evenOdd rather than inheriting the nonZero placeholder', () => {
    // Glyph streams carry no fill-winding flag, so they take DefineShape1-3's default.
    const { font } = decodeFont2(defineFont2Body([glyphBox()], { layout: null }));
    expect(font.glyphs[0]?.shape?.fillRule).toBe('evenOdd');
  });
});
