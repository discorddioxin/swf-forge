/**
 * P3 C1 — the font/text auxiliary tags that previously classified by kind but had no decoder:
 * `DefineFont` (10, v1), `DefineFontInfo` (13), `DefineFontInfo2` (62), `DefineFontAlignZones` (73),
 * `CSMTextSettings` (74), `DefineFontName` (88), plus `JPEGTables` (8) surfaced on the file model.
 *
 * Covers IMPL-080-R008 / R011 / R012 / R016 / R017 / R018 / R019 / R020 / R035 / R036 / R037.
 */

import { describe, expect, it } from 'vitest';

import { Tag, buildMovieModel, csmCutoffs, openSwf } from '@swf-forge/swf';
import { ByteWriter, buildSwf, concat, endTag, showFrames, tag, writeRect } from '@swf-forge/swf/test-support';

/** A closed 80×80 box glyph: one mandatory opaque fill-0 style, four straight edges. */
function glyphShape(): Uint8Array {
  const w = new ByteWriter();
  w.bits(1, 4).bits(0, 4); // NumFillBits = 1, NumLineBits = 0
  w.bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 1).bits(1, 1).bits(1, 1); // StyleChange: fill0 + MoveTo
  w.bits(1, 5).bits(0, 1).bits(0, 1).bits(1, 1); // MoveBits = 1, move to (0, 0), FillStyle0 = 1
  const line = (vertical: boolean, delta: number): void => {
    w.bits(1, 1)
      .bits(1, 1)
      .bits(6, 4)
      .bits(0, 1)
      .bits(vertical ? 1 : 0, 1);
    w.bits(delta < 0 ? 256 + delta : delta, 8);
  };
  line(false, 80);
  line(true, 80);
  line(false, -80);
  line(true, -80);
  w.bits(0, 6).align(); // EndShapeRecord
  return w.toUint8Array();
}

/**
 * `DefineFont` (10): `FontID UI16`, `OffsetTable UI16[nGlyphs]`, `GlyphShapeTable SHAPE[nGlyphs]`.
 * There is no explicit glyph count — the offset table *is* the count (IMPL-080-R008).
 */
function defineFontV1Body(id: number, glyphs: readonly Uint8Array[]): Uint8Array {
  const w = new ByteWriter();
  w.u16(id);
  const tableBytes = glyphs.length * 2;
  let running = tableBytes;
  for (const glyph of glyphs) {
    w.u16(running);
    running += glyph.length;
  }
  for (const glyph of glyphs) w.bytes(glyph);
  return w.toUint8Array();
}

/** `DefineFontInfo` (13): `FontID`, `FontNameLen UI8`, `FontName`, flags byte, `CodeTable`. */
function fontInfoBody(id: number, name: string, flagsByte: number, codes: readonly number[]): Uint8Array {
  const encoded = new TextEncoder().encode(name);
  const w = new ByteWriter();
  w.u16(id).u8(encoded.length).bytes(encoded).u8(flagsByte);
  const wide = (flagsByte & 0x01) !== 0;
  for (const code of codes) {
    if (wide) w.u16(code);
    else w.u8(code);
  }
  return w.toUint8Array();
}

/** `DefineFontInfo2` (62): as `DefineFontInfo` plus a trailing `LanguageCode` before the codes. */
function fontInfo2Body(
  id: number,
  name: string,
  flagsByte: number,
  languageCode: number,
  codes: readonly number[],
  { forceNarrow = false } = {},
): Uint8Array {
  const encoded = new TextEncoder().encode(name);
  const w = new ByteWriter();
  w.u16(id).u8(encoded.length).bytes(encoded).u8(flagsByte).u8(languageCode);
  // SWF requires UI16 codes for Info2 regardless of the flag; `forceNarrow` writes the
  // self-contradictory UI8 form the reader must report (SF0283) without desynchronising.
  for (const code of codes) {
    if (forceNarrow) w.u8(code);
    else w.u16(code);
  }
  return w.toUint8Array();
}

function defineFont2Body(
  id: number,
  glyphs: readonly Uint8Array[],
  codes: readonly number[],
  { name = 'Test Font', flags = 0x84, version3 = false } = {},
): Uint8Array {
  const encoded = new TextEncoder().encode(name);
  const w = new ByteWriter();
  w.u16(id).u8(flags).u8(0).u8(encoded.length).bytes(encoded).u16(glyphs.length);
  // OffsetTable + CodeTableOffset are byte distances from the START of OffsetTable (IMPL-080-R011).
  const tableBytes = (glyphs.length + 1) * 2;
  let running = tableBytes;
  for (const glyph of glyphs) {
    w.u16(running);
    running += glyph.length;
  }
  w.u16(running); // CodeTableOffset
  for (const glyph of glyphs) w.bytes(glyph);
  const wide = (flags & 0x04) !== 0;
  for (const code of codes) {
    if (wide) w.u16(code);
    else w.u8(code);
  }
  if ((flags & 0x80) !== 0) {
    w.u16(800).u16(200).s16(-50);
    for (let i = 0; i < glyphs.length; i += 1) w.s16(600);
    for (let i = 0; i < glyphs.length; i += 1) writeRect(w, { xMin: 0, xMax: 80, yMin: 0, yMax: 80 });
    w.u16(0); // KerningCount
  }
  void version3;
  return w.toUint8Array();
}

/** One ZONERECORD: `NumZoneData UI8`, `ZONEDATA[n]{coord FLOAT16, range FLOAT16}`, flags byte. */
function zoneRecord(pairs: readonly [number, number][], maskY: boolean, maskX: boolean): Uint8Array {
  const w = new ByteWriter();
  w.u8(pairs.length);
  for (const [coord, range] of pairs) {
    w.u16(coord).u16(range); // raw FLOAT16 bit patterns
  }
  w.u8((maskY ? 0x02 : 0) | (maskX ? 0x01 : 0));
  return w.toUint8Array();
}

function alignZonesBody(id: number, csmTableHint: number, records: readonly Uint8Array[]): Uint8Array {
  const w = new ByteWriter();
  w.u16(id).u8((csmTableHint & 0x03) << 6);
  for (const record of records) w.bytes(record);
  return w.toUint8Array();
}

function csmBody(textId: number, useFlashType: number, gridFit: number, thickness: number, sharpness: number) {
  const w = new ByteWriter();
  w.u16(textId);
  w.bits(useFlashType, 2).bits(gridFit, 3).bits(0, 3).align();
  // SWF FLOAT is little-endian IEEE-754 binary32.
  const floats = new DataView(new ArrayBuffer(8));
  floats.setFloat32(0, thickness, true);
  floats.setFloat32(4, sharpness, true);
  w.bytes(new Uint8Array(floats.buffer));
  w.u8(0); // reserved
  return w.toUint8Array();
}

/** `DefineFontName` (88): `FontID`, then two NUL-terminated UTF-8 strings. */
function fontNameBody(id: number, name: string, copyright: string): Uint8Array {
  const encoder = new TextEncoder();
  const w = new ByteWriter();
  w.u16(id).bytes(encoder.encode(name)).u8(0).bytes(encoder.encode(copyright)).u8(0);
  return w.toUint8Array();
}

function swfWith(body: Uint8Array, version = 10): Uint8Array {
  return buildSwf({ version, body: concat(body, showFrames(1), endTag()), frameCount: 1 });
}

describe('DefineFont v1 and the font code-map tags', () => {
  it('T-MOD-506: infers DefineFont v1 glyph count from the offset table and decodes every glyph', () => {
    const glyphs = [glyphShape(), glyphShape(), glyphShape()];
    const file = openSwf(swfWith(tag(Tag.DefineFont, defineFontV1Body(21, glyphs))));
    const model = buildMovieModel(file);
    const character = model.characters.get(21);
    // The offset table is the count: 3 UI16 entries => offsets[0] === 6 => 3 glyphs.
    expect(character?.fontV1).toMatchObject({ id: 21, version: 1, tagCode: 10, glyphCount: 3 });
    expect(character?.fontV1?.glyphs).toHaveLength(3);
    for (const glyph of character?.fontV1?.glyphs ?? []) {
      expect(glyph.shape?.edges).toHaveLength(4);
      // v1 carries no code table at all; codes stay null until a DefineFontInfo supplies them.
      expect(glyph.code).toBeNull();
    }
    // Without a DefineFontInfo the resolved view stays null — there is no code map to resolve with.
    expect(character?.font).toBeNull();
    expect(file.sink.list().filter((item) => item.severity === 'error')).toEqual([]);
  });

  it('T-MOD-506/518: DefineFontInfo supplies the v1 code map, name, and flags to the resolved font', () => {
    const glyphs = [glyphShape(), glyphShape()];
    const file = openSwf(
      swfWith(
        concat(
          tag(Tag.DefineFont, defineFontV1Body(22, glyphs)),
          // flags: Reserved UB[2], SmallText, ShiftJIS, ANSI, Italic, Bold, WideCodes (MSB-first).
          tag(Tag.DefineFontInfo, fontInfoBody(22, 'Garamond', 0x0b, [0x41, 0x42])),
        ),
      ),
    );
    const model = buildMovieModel(file);
    const font = model.characters.get(22)?.font;
    expect(font).toMatchObject({
      id: 22,
      name: 'Garamond',
      ansi: true,
      bold: true,
      wideCodes: true,
      codes: [0x41, 0x42],
    });
    expect(font?.glyphs.map((glyph) => glyph.code)).toEqual([0x41, 0x42]);
    // The pre-resolve v1 view stays available so the Info override is inspectable.
    expect(model.characters.get(22)?.fontV1?.glyphs.map((glyph) => glyph.code)).toEqual([null, null]);
    expect(model.characters.get(22)?.fontInfo).toMatchObject({ tagCode: Tag.DefineFontInfo, version: 1 });
  });

  it('T-MOD-502: narrow vs wide codes, ANSI/Shift-JIS layouts, and the Info2 LanguageCode', () => {
    const narrow = openSwf(
      swfWith(
        concat(
          tag(Tag.DefineFont, defineFontV1Body(30, [glyphShape()])),
          tag(Tag.DefineFontInfo, fontInfoBody(30, 'Narrow', 0x08, [0x7f])), // ANSI, !WideCodes
        ),
      ),
    );
    const narrowFont = buildMovieModel(narrow).characters.get(30)?.font;
    expect(narrowFont).toMatchObject({ ansi: true, shiftJIS: false, wideCodes: false, codes: [0x7f] });

    const wide = openSwf(
      swfWith(
        concat(
          tag(Tag.DefineFont, defineFontV1Body(31, [glyphShape(), glyphShape()])),
          // Info2: ShiftJIS + WideCodes, LanguageCode 2 (Japanese).
          tag(Tag.DefineFontInfo2, fontInfo2Body(31, '\u660E\u671D', 0x11, 2, [0x3042, 0x4e00])),
        ),
      ),
    );
    const wideModel = buildMovieModel(wide);
    const wideFont = wideModel.characters.get(31)?.font;
    expect(wideFont).toMatchObject({
      // IMPL-080-R018: FontNameLen counts BYTES; a 2-char Japanese name is 6 UTF-8 bytes.
      name: '\u660E\u671D',
      shiftJIS: true,
      wideCodes: true,
      languageCode: 2,
      codes: [0x3042, 0x4e00],
    });
    expect(wideModel.characters.get(31)?.fontInfo).toMatchObject({ version: 2, languageCode: 2 });
  });

  it('SF0283: DefineFontInfo2 with WideCodes clear is reported and still read as UI16', () => {
    const file = openSwf(
      swfWith(
        concat(
          tag(Tag.DefineFont, defineFontV1Body(32, [glyphShape()])),
          // WideCodes bit deliberately clear — the file contradicts itself (IMPL-080-R016).
          tag(Tag.DefineFontInfo2, fontInfo2Body(32, 'Contradiction', 0x00, 0, [0x4e2d])),
        ),
      ),
    );
    const model = buildMovieModel(file);
    expect(file.sink.codes()).toContain('SF0283');
    // Reading UI16 keeps the tag in sync; a UI8 read here would desynchronise the code table.
    expect(model.characters.get(32)?.font?.codes).toEqual([0x4e2d]);
    expect(model.characters.get(32)?.font?.wideCodes).toBe(true);
  });

  it('T-MOD-518/SF0284: indirect device-font names are recorded as indirect, not as a family', () => {
    for (const name of ['_sans', '_serif', '_typewriter']) {
      const file = openSwf(
        swfWith(
          concat(
            tag(Tag.DefineFont, defineFontV1Body(40, [glyphShape()])),
            tag(Tag.DefineFontInfo, fontInfoBody(40, name, 0x01, [0x41])),
          ),
        ),
      );
      buildMovieModel(file);
      expect(file.sink.codes()).toContain('SF0284');
      const indirect = file.sink.list().find((item) => item.code === 'SF0284');
      expect(indirect?.severity).toBe('info');
      expect(indirect?.message).toContain(name);
    }
    // An ordinary family name must NOT be flagged as indirect.
    const plain = openSwf(
      swfWith(
        concat(
          tag(Tag.DefineFont, defineFontV1Body(41, [glyphShape()])),
          tag(Tag.DefineFontInfo, fontInfoBody(41, 'Sans Imposter', 0x01, [0x41])),
        ),
      ),
    );
    buildMovieModel(plain);
    expect(plain.sink.codes()).not.toContain('SF0284');
  });

  it('T-MOD-517: a device-only font (NumGlyphs = 0) omits every per-glyph table', () => {
    const noGlyphs = defineFont2Body(50, [], [], { name: 'Device Only', flags: 0x04 });
    const file = openSwf(swfWith(tag(Tag.DefineFont2, noGlyphs)));
    const model = buildMovieModel(file);
    const font = model.characters.get(50)?.font;
    expect(font).toMatchObject({ id: 50, name: 'Device Only', glyphs: [], codes: [] });
    // Never index a zero-length table (IMPL-080-R012); the layout tables are absent, not derived.
    expect(font?.ascent).toBeNull();
    expect(file.sink.list().filter((item) => item.severity === 'error')).toEqual([]);
  });
});

describe('font licensing, hinting, and advanced-rendering sidecars', () => {
  it('T-MOD-515: DefineFontAlignZones records NumZoneData = 2 pairs and both zone masks verbatim', () => {
    const records = [
      zoneRecord(
        [
          [0x3c00, 0x4000],
          [0x4200, 0x4400],
        ],
        true,
        false,
      ),
      zoneRecord(
        [
          [0x4500, 0x4600],
          [0x4700, 0x4800],
        ],
        false,
        true,
      ),
    ];
    const file = openSwf(
      swfWith(
        concat(
          tag(Tag.DefineFont3, defineFont2Body(60, [glyphShape(), glyphShape()], [0x41, 0x42])),
          tag(Tag.DefineFontAlignZones, alignZonesBody(60, 2, records)),
        ),
      ),
    );
    const model = buildMovieModel(file);
    const zones = model.characters.get(60)?.fontAlignZones;
    expect(zones?.csmTableHint).toBe(2);
    expect(zones?.zones).toHaveLength(2);
    expect(zones?.zones[0]?.zones).toHaveLength(2);
    expect(zones?.zones[0]).toMatchObject({ zoneMaskY: true, zoneMaskX: false });
    expect(zones?.zones[1]).toMatchObject({ zoneMaskY: false, zoneMaskX: true });
    // FLOAT16 0x3C00 == 1.0, 0x4000 == 2.0 — decoded, not re-encoded.
    expect(zones?.zones[0]?.zones[0]).toMatchObject({ alignmentCoordinate: 1, range: 2 });
    // IMPL-080-R035: recorded, never used to snap glyphs — the manifest says so via SF0277.
    expect(file.sink.codes()).toContain('SF0277');
  });

  it('T-MOD-515/SF0278: align zones on a non-DefineFont3 target are recorded but not applied', () => {
    const file = openSwf(
      swfWith(
        concat(
          tag(Tag.DefineFont2, defineFont2Body(61, [glyphShape()], [0x41])),
          tag(Tag.DefineFontAlignZones, alignZonesBody(61, 0, [zoneRecord([[0x3c00, 0x3c00]], true, true)])),
        ),
      ),
    );
    const model = buildMovieModel(file);
    expect(model.characters.get(61)?.fontAlignZones?.zones).toHaveLength(1);
    expect(file.sink.codes()).toContain('SF0278');
    // The zones are present but the hinting-ignored note is only for valid v3 targets.
    expect(file.sink.codes()).not.toContain('SF0277');
  });

  it('SF0278: an auxiliary tag naming an undefined character is ignored, de-duplicated by id', () => {
    const file = openSwf(
      swfWith(
        concat(
          tag(Tag.DefineFont3, defineFont2Body(70, [glyphShape()], [0x41])),
          tag(Tag.DefineFontAlignZones, alignZonesBody(999, 0, [zoneRecord([[0x3c00, 0x3c00]], true, true)])),
          tag(Tag.CSMTextSettings, csmBody(998, 1, 2, 0.25, 0.5)),
        ),
      ),
    );
    buildMovieModel(file);
    const orphans = file.sink.list().filter((item) => item.code === 'SF0278');
    expect(orphans).toHaveLength(2);
    expect(orphans.map((item) => item.characterId).sort((a, b) => (a ?? 0) - (b ?? 0))).toEqual([998, 999]);
  });

  it('T-MOD-515: CSMTextSettings keeps the raw floats and derives the chapter E-017 cutoffs', () => {
    const file = openSwf(
      swfWith(
        concat(
          tag(Tag.DefineFont2, defineFont2Body(80, [glyphShape()], [0x41])),
          tag(Tag.DefineEditText, editTextBody(81, 80)),
          tag(Tag.CSMTextSettings, csmBody(81, 1, 2, 0.25, 0.5)),
        ),
      ),
    );
    const model = buildMovieModel(file);
    const settings = model.characters.get(81)?.csmTextSettings;
    expect(settings).toMatchObject({ textId: 81, useFlashType: 1, gridFit: 2 });
    expect(settings?.thickness).toBeCloseTo(0.25, 6);
    expect(settings?.sharpness).toBeCloseTo(0.5, 6);
    // outside = (0.5·sharpness − thickness)·size; inside = (−0.5·sharpness − thickness)·size.
    // The formulas give outside − inside === sharpness·size (errata E-017).
    const cutoffs = csmCutoffs(settings!, 12);
    expect(cutoffs.outsideCutoff).toBeCloseTo((0.5 * 0.5 - 0.25) * 12, 6);
    expect(cutoffs.insideCutoff).toBeCloseTo((-0.5 * 0.5 - 0.25) * 12, 6);
    expect(cutoffs.outsideCutoff - cutoffs.insideCutoff).toBeCloseTo(0.5 * 12, 6);
  });

  it('T-MOD-511/IMPL-080-R020: DefineFontName captures both licensing strings verbatim', () => {
    const file = openSwf(
      swfWith(
        concat(
          tag(Tag.DefineFont2, defineFont2Body(90, [glyphShape()], [0x41])),
          tag(Tag.DefineFontName, fontNameBody(90, 'Garamond Premier Pro Regular', '\u00A9 2004 Foundry')),
        ),
      ),
    );
    const model = buildMovieModel(file);
    expect(model.characters.get(90)?.fontName).toEqual({
      id: 90,
      fontName: 'Garamond Premier Pro Regular',
      copyright: '\u00A9 2004 Foundry',
    });
    // Metadata only — it must never change the decoded font (IMPL-080-R039).
    expect(model.characters.get(90)?.font?.name).toBe('Test Font');
    // A font without DefineFontName is normal, not an error.
    const unnamed = openSwf(swfWith(tag(Tag.DefineFont2, defineFont2Body(91, [glyphShape()], [0x41]))));
    expect(buildMovieModel(unnamed).characters.get(91)?.fontName).toBeNull();
  });
});

describe('JPEGTables on the file model', () => {
  it('surfaces the shared JPEG table so bitmap decoding needs no second tag scan', () => {
    const table = Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x04, 0x00, 0x00, 0xff, 0xd9]);
    const file = openSwf(swfWith(tag(Tag.JPEGTables, table)));
    const model = buildMovieModel(file);
    expect(model.control.jpegTables).toEqual(table);
  });

  it('SF0257: multiple JPEGTables tags report once and the first table wins', () => {
    const first = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
    const second = Uint8Array.from([0xff, 0xd8, 0x00, 0x11, 0xff, 0xd9]);
    const file = openSwf(swfWith(concat(tag(Tag.JPEGTables, first), tag(Tag.JPEGTables, second))));
    const model = buildMovieModel(file);
    expect(model.control.jpegTables).toEqual(first);
    expect(file.sink.list().filter((item) => item.code === 'SF0257')).toHaveLength(1);
  });

  it('reports no table when the movie carries none', () => {
    const file = openSwf(swfWith(tag(Tag.DefineFont2, defineFont2Body(95, [glyphShape()], [0x41]))));
    expect(buildMovieModel(file).control.jpegTables).toBeNull();
  });
});

/** Minimal `DefineEditText` body: bounds, no-flag byte pair, a font id, and empty strings. */
function editTextBody(id: number, fontId: number): Uint8Array {
  const w = new ByteWriter();
  w.u16(id);
  writeRect(w, { xMin: 0, xMax: 2000, yMin: 0, yMax: 400 });
  // flags byte 1: HasText, WordWrap, Multiline, Password, ReadOnly, HasTextColor, HasMaxLength, HasFont
  w.u8(0x01); // HasFont only
  w.u8(0x00); // flags byte 2
  w.u16(fontId).u16(240); // FontID + FontHeight (HasFont implies both)
  w.text('field').u8(0); // VariableName
  return w.toUint8Array();
}
