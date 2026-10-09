/** P3 static glyph-run and editable-field tag decoding. */

import { describe, expect, it } from 'vitest';

import {
  Cursor,
  Tag,
  buildMovieModel,
  decodeDefineEditText,
  decodeDefineText,
  openSwf,
  recoverStaticTextCodes,
} from '@swf-forge/swf';
import { ByteWriter, buildSwf, concat, endTag, showFrames, tag, writeRect } from '@swf-forge/swf/test-support';
import type { DefineFontModel } from '@swf-forge/swf';

function staticTextBody(tagCode: typeof Tag.DefineText | typeof Tag.DefineText2 = Tag.DefineText): Uint8Array {
  const w = new ByteWriter();
  w.u16(22);
  writeRect(w, { xMin: 0, xMax: 400, yMin: 0, yMax: 200 });
  w.bits(0, 1).bits(0, 1).bits(0, 5).align(); // identity TextMatrix
  w.u8(1).u8(7); // GlyphBits, AdvanceBits
  w.bits(1, 1).bits(0, 3).bits(1, 1).bits(1, 1).bits(1, 1).bits(1, 1).align();
  w.u16(17); // FontID
  w.u8(0x12).u8(0x34).u8(0x56); // RGB (DefineText) / RGBA follows below for DefineText2
  if (tagCode === Tag.DefineText2) w.u8(0x80);
  w.s16(5).s16(-10).u16(200); // XOffset, YOffset, TextHeight
  w.u8(1).bits(0, 1).bits(10, 7).align(); // glyph 0, advance +10
  w.bits(1, 1).bits(0, 3).bits(0, 1).bits(0, 1).bits(0, 1).bits(1, 1).align(); // XOffset only; styles persist
  w.s16(9).u8(1).bits(1, 1).bits(125, 7).align(); // glyph 1, advance -3
  w.u8(0); // EndOfRecordsFlag
  return w.toUint8Array();
}

function embeddedFont(): DefineFontModel {
  return {
    id: 17,
    version: 2,
    tagCode: Tag.DefineFont2,
    name: 'Test Font',
    languageCode: 0,
    unitsPerEm: 1024,
    italic: false,
    bold: false,
    wideCodes: true,
    shiftJIS: false,
    ansi: false,
    smallText: false,
    codes: [65, 66],
    glyphs: [
      { index: 0, code: 65, shape: null, advance: 600, bounds: null },
      { index: 1, code: 66, shape: null, advance: 610, bounds: null },
    ],
    ascent: 800,
    descent: 200,
    leading: 0,
    kerning: [],
  };
}

function emptyGlyphShape(): Uint8Array {
  const w = new ByteWriter();
  w.bits(1, 4).bits(0, 4);
  w.bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 1).bits(1, 1).bits(0, 1).bits(1, 1);
  w.bits(0, 6).align();
  return w.toUint8Array();
}

function defineTwoGlyphFont(): Uint8Array {
  const glyph = emptyGlyphShape();
  const name = new TextEncoder().encode('Mapped Font');
  const w = new ByteWriter();
  w.u16(17).u8(0x04).u8(0).u8(name.length).bytes(name).u16(2);
  w.u16(6)
    .u16(6 + glyph.length)
    .u16(6 + glyph.length * 2);
  w.bytes(glyph).bytes(glyph).u16(65).u16(66);
  return w.toUint8Array();
}

describe('text tag models', () => {
  it('T-MOD-504/514: preserves inherited run styles, absolute offsets, glyph indices, and authored advances', () => {
    const text = decodeDefineText(Tag.DefineText, new Cursor(staticTextBody(), 0, staticTextBody().length));
    expect(text).toMatchObject({
      id: 22,
      version: 1,
      bounds: { xMin: 0, xMax: 400, yMin: 0, yMax: 200 },
      glyphBits: 1,
      advanceBits: 7,
      runs: [
        {
          fontId: 17,
          color: { r: 0x12, g: 0x34, b: 0x56, a: 255 },
          xOffset: 5,
          yOffset: -10,
          textHeight: 200,
          glyphs: [{ glyphIndex: 0, advance: 10 }],
        },
        {
          fontId: 17,
          color: { r: 0x12, g: 0x34, b: 0x56, a: 255 },
          xOffset: 9,
          yOffset: 0,
          textHeight: 200,
          glyphs: [{ glyphIndex: 1, advance: -3 }],
        },
      ],
    });
    const recovered = recoverStaticTextCodes(text, new Map([[17, embeddedFont()]]));
    expect(recovered.text.runs.map((run) => run.recoveredText)).toEqual(['A', 'B']);
    expect(recovered.diagnostics).toEqual([]);
  });

  it('T-MOD-504: buildMovieModel resolves static glyph runs against the embedded font dictionary', () => {
    const source = buildSwf({
      version: 10,
      body: concat(
        tag(Tag.DefineFont2, defineTwoGlyphFont()),
        tag(Tag.DefineText, staticTextBody()),
        showFrames(1),
        endTag(),
      ),
      frameCount: 1,
    });
    const file = openSwf(source);
    const model = buildMovieModel(file);
    const text = model.characters.get(22)?.text;
    expect(text?.runs.map((run) => run.recoveredText)).toEqual(['A', 'B']);
    expect(text?.bounds).toEqual({ xMin: 0, xMax: 400, yMin: 0, yMax: 200 });
    expect(file.diagnostics.some((diagnostic) => diagnostic.severity === 'error')).toBe(false);
  });

  it('T-MOD-514: handles RGBA in DefineText2 and retains invalid glyph diagnostics', () => {
    const body = staticTextBody(Tag.DefineText2);
    const text = decodeDefineText(Tag.DefineText2, new Cursor(body, 0, body.length));
    expect(text.runs[0]?.color).toEqual({ r: 0x12, g: 0x34, b: 0x56, a: 0x80 });
    const badRun = { ...text.runs[0]!, glyphs: [{ glyphIndex: 99, advance: 7 }] };
    const recovery = recoverStaticTextCodes({ ...text, runs: [badRun] }, new Map([[17, embeddedFont()]]));
    expect(recovery.text.runs[0]?.recoveredText).toBeNull();
    expect(recovery.diagnostics).toMatchObject([{ code: 'SF0272' }]);
  });

  it('T-MOD-514/516: decodes all editable-text flag bits, optional fields, and raw variable paths', () => {
    const w = new ByteWriter();
    w.u16(23);
    writeRect(w, { xMin: -10, xMax: 510, yMin: 0, yMax: 300 });
    w.u16(0xffff).u16(17).text('_sans').u16(240);
    w.u8(0x10).u8(0x20).u8(0x30).u8(0x40).u16(80);
    w.u8(2).u16(10).u16(11).u16(12).s16(-2);
    w.text('clip/field').text('<b>hello</b>');
    const body = w.toUint8Array();
    const cursor = new Cursor(body, 0, body.length);
    const edit = decodeDefineEditText(cursor);
    expect(edit).toMatchObject({
      id: 23,
      fontId: 17,
      fontClass: '_sans',
      fontHeight: 240,
      color: { r: 0x10, g: 0x20, b: 0x30, a: 0x40 },
      maxLength: 80,
      layout: { align: 2, leftMargin: 10, rightMargin: 11, indent: 12, leading: -2 },
      variableName: 'clip/field',
      initialText: '<b>hello</b>',
      flags: {
        hasText: true,
        wordWrap: true,
        multiline: true,
        password: true,
        readOnly: true,
        hasTextColor: true,
        hasMaxLength: true,
        hasFont: true,
        hasFontClass: true,
        autoSize: true,
        hasLayout: true,
        noSelect: true,
        border: true,
        wasStatic: true,
        html: true,
        useOutlines: true,
      },
    });
    expect(cursor.sink.codes()).toContain('SF0285');
  });
});
