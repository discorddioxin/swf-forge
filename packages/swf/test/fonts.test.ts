/** P3 DefineFont2/3 outlines, character-code mappings, metrics, and malformed offsets. */

import { describe, expect, it } from 'vitest';

import { Tag, buildMovieModel, openSwf } from '@swf-forge/swf';
import { ByteWriter, buildSwf, concat, endTag, showFrames, tag, writeRect } from '@swf-forge/swf/test-support';

function glyphShape(): Uint8Array {
  const w = new ByteWriter();
  w.bits(1, 4).bits(0, 4); // one mandatory fill style; no line styles
  w.bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 1).bits(1, 1).bits(1, 1); // fill0=1, MoveTo
  w.bits(1, 5).bits(0, 1).bits(0, 1).bits(1, 1); // MoveBits=1, move to (0, 0), then FillStyle0 index
  const line = (vertical: boolean, delta: number): void => {
    w.bits(1, 1)
      .bits(1, 1)
      .bits(6, 4)
      .bits(0, 1)
      .bits(vertical ? 1 : 0, 1); // straight, 8-bit axis delta
    w.bits(delta < 0 ? 256 + delta : delta, 8);
  };
  line(false, 80);
  line(true, 80);
  line(false, -80);
  line(true, -80);
  w.bits(0, 6).align(); // EndShapeRecord
  return w.toUint8Array();
}

function defineFont2Body(id: number, glyph: Uint8Array, code = 65): Uint8Array {
  const name = new TextEncoder().encode('Test Font');
  const w = new ByteWriter();
  w.u16(id).u8(0x84).u8(0).u8(name.length).bytes(name).u16(1);
  w.u16(4).u16(4 + glyph.length); // OffsetTable[0], CodeTableOffset, both relative to OffsetTable start
  w.bytes(glyph).u16(code);
  w.u16(800).u16(200).s16(-50).s16(600);
  writeRect(w, { xMin: 0, xMax: 80, yMin: 0, yMax: 80 });
  w.u16(0); // no kerning records
  return w.toUint8Array();
}

function fontSwf(): Uint8Array {
  return buildSwf({
    version: 10,
    body: concat(tag(Tag.DefineFont2, defineFont2Body(17, glyphShape())), showFrames(1), endTag()),
    frameCount: 1,
  });
}

describe('embedded font outline models', () => {
  it('T-MOD-117/503: decodes a DefineFont2 glyph to vector IR with codes and signed layout metrics', () => {
    const file = openSwf(fontSwf());
    const model = buildMovieModel(file);
    const font = model.characters.get(17)?.font;
    expect(font).toMatchObject({
      id: 17,
      version: 2,
      tagCode: Tag.DefineFont2,
      name: 'Test Font',
      unitsPerEm: 1024,
      ascent: 800,
      descent: 200,
      leading: -50,
      wideCodes: true,
      kerning: [],
      glyphs: [{ index: 0, code: 65, advance: 600 }],
    });
    expect(font?.glyphs[0]?.shape?.edges).toHaveLength(4);
    expect(font?.glyphs[0]?.shape?.paths).toMatchObject([{ styleId: 1, closed: true, implicitClose: false }]);
    expect(file.sink.list().filter((item) => item.severity === 'error')).toEqual([]);
  });

  it('keeps font sidecar metadata tags out of the character dictionary', () => {
    const fontInfo2 = new ByteWriter().u16(17).u8(1).u8(0x41).u8(1).u8(0).u16(65).toUint8Array();
    const alignZones = new ByteWriter().u16(17).u8(0).toUint8Array();
    const fontName = new ByteWriter().u16(17).u8(0).u8(0).toUint8Array();
    const file = openSwf(
      buildSwf({
        version: 10,
        body: concat(
          tag(Tag.DefineFont2, defineFont2Body(17, glyphShape())),
          tag(Tag.DefineFontInfo2, fontInfo2),
          tag(Tag.DefineFontAlignZones, alignZones),
          tag(Tag.DefineFontName, fontName),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    const model = buildMovieModel(file);
    expect(file.definitions.map(({ id, tagCode }) => ({ id, tagCode }))).toEqual([
      { id: 17, tagCode: Tag.DefineFont2 },
    ]);
    expect([...model.characters.keys()]).toEqual([17]);
    expect(model.characters.get(17)).toMatchObject({ kind: 'font2', tagCode: Tag.DefineFont2, font: { id: 17 } });
  });

  it('quarantines a glyph whose offset escapes the CodeTable area', () => {
    const malformed = defineFont2Body(18, glyphShape());
    const corrupt = malformed.slice();
    // FontID(2), flags(1), language(1), name length(1), name(9), glyph count(2), OffsetTable starts here.
    const offsetTable = 2 + 1 + 1 + 1 + new TextEncoder().encode('Test Font').length + 2;
    corrupt[offsetTable] = 0xff;
    corrupt[offsetTable + 1] = 0x7f;
    const file = openSwf(
      buildSwf({ version: 10, body: concat(tag(Tag.DefineFont2, corrupt), showFrames(1), endTag()), frameCount: 1 }),
    );
    const model = buildMovieModel(file);
    expect(model.characters.get(18)?.font?.glyphs[0]?.shape).toBeNull();
    expect(file.sink.codes()).toContain('SF0271');
  });
});
