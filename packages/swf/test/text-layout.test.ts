/**
 * C4 — static text record structure and placement.
 *
 * `T-MOD-512` (the `TEXTRECORD` list terminates on a zero byte; `TextRecordType` is always 1),
 * `T-MOD-513` (`XOffset` is read **before** `YOffset` — errata `E-017`), and `T-MOD-505` (glyph
 * placement matches a hand-computed table), plus the `SF0272`/`SF0273` reporting path.
 */

import { describe, expect, it } from 'vitest';

import {
  Cursor,
  DiagnosticSink,
  Tag,
  buildMovieModel,
  decodeDefineFont2or3,
  decodeDefineText,
  openSwf,
  recoverStaticTextCodes,
  type DefineFontModel,
  type StaticTextModel,
} from '@swf-forge/swf';
import { ByteWriter, buildSwf, concat, endTag, showFrames, tag, writeRect } from '@swf-forge/swf/test-support';
import { defineFont2Body, glyphBox } from './support/font-bytes.js';

interface RunSpec {
  readonly fontId?: number;
  readonly color?: readonly [number, number, number];
  readonly xOffset?: number;
  readonly yOffset?: number;
  readonly textHeight?: number;
  readonly glyphs: readonly (readonly [number, number])[];
}

const GLYPH_BITS = 4;
const ADVANCE_BITS = 12;

function textBody(runs: readonly RunSpec[], options: { id?: number; terminator?: boolean } = {}): Uint8Array {
  const w = new ByteWriter();
  w.u16(options.id ?? 22);
  writeRect(w, { xMin: 0, xMax: 4000, yMin: 0, yMax: 1000 });
  w.bits(0, 1).bits(0, 1).bits(0, 5).align(); // identity TextMatrix
  w.u8(GLYPH_BITS).u8(ADVANCE_BITS);
  for (const run of runs) {
    const hasFont = run.fontId !== undefined;
    const hasColor = run.color !== undefined;
    const hasY = run.yOffset !== undefined;
    const hasX = run.xOffset !== undefined;
    w.bits(1, 1) // TextRecordType — always 1 for a style record
      .bits(0, 3) // StyleFlagsReserved
      .bits(hasFont ? 1 : 0, 1)
      .bits(hasColor ? 1 : 0, 1)
      .bits(hasY ? 1 : 0, 1)
      .bits(hasX ? 1 : 0, 1)
      .align();
    if (hasFont) w.u16(run.fontId as number);
    if (hasColor)
      w.u8(run.color?.[0] ?? 0)
        .u8(run.color?.[1] ?? 0)
        .u8(run.color?.[2] ?? 0);
    // E-017: XOffset precedes YOffset in the record, even though the chapter's prose lists the
    // flags in the opposite order.
    if (hasX) w.s16(run.xOffset as number);
    if (hasY) w.s16(run.yOffset as number);
    if (hasFont) w.u16(run.textHeight ?? 200);
    w.u8(run.glyphs.length);
    for (const [index, advance] of run.glyphs) {
      w.bits(index, GLYPH_BITS);
      w.bits(advance < 0 ? (1 << ADVANCE_BITS) + advance : advance, ADVANCE_BITS);
    }
    w.align();
  }
  if (options.terminator !== false) w.u8(0);
  return w.toUint8Array();
}

function decodeText(body: Uint8Array): { text: StaticTextModel; codes: string[] } {
  const sink = new DiagnosticSink();
  const cursor = new Cursor(body, 0, body.length, { sink, version: 10, tagCode: Tag.DefineText });
  const text = decodeDefineText(Tag.DefineText, cursor);
  return { text, codes: sink.list().map((d) => d.code) };
}

describe('T-MOD-512 TEXTRECORD list structure', () => {
  it('ends the list on the zero byte and does not read past it', () => {
    const body = concat(textBody([{ fontId: 17, glyphs: [[0, 10]] }]), Uint8Array.from([0xff, 0xff, 0xff, 0xff]));
    const { text } = decodeText(body);

    // The trailing garbage is after the terminator and must not become a second run.
    expect(text.runs).toHaveLength(1);
    expect(text.runs[0]?.glyphs).toHaveLength(1);
  });

  it('treats an empty record list as a text object with no runs', () => {
    const { text } = decodeText(textBody([]));
    expect(text.runs).toEqual([]);
  });

  it('stops at the end of the tag body when the terminator is missing', () => {
    // A truncated tag must terminate rather than spin; the guard is the body length, not the byte.
    const { text } = decodeText(textBody([{ fontId: 17, glyphs: [[0, 10]] }], { terminator: false }));
    expect(text.runs.length).toBeGreaterThanOrEqual(1);
  });

  it('carries the glyph and advance bit widths from the header, not per record', () => {
    const { text } = decodeText(textBody([{ fontId: 17, glyphs: [[3, 600]] }]));

    expect(text).toMatchObject({ glyphBits: GLYPH_BITS, advanceBits: ADVANCE_BITS });
    expect(text.runs[0]?.glyphs[0]).toEqual({ glyphIndex: 3, advance: 600 });
  });
});

describe('T-MOD-513 TEXTRECORD field order (E-017)', () => {
  it('reads XOffset before YOffset when both are present', () => {
    // The two fields are both SI16 and adjacent, so a swapped read produces a plausible-looking
    // result that is simply mirrored — the reason this needs its own test.
    const { text } = decodeText(textBody([{ fontId: 17, xOffset: 120, yOffset: -45, glyphs: [[0, 10]] }]));

    expect(text.runs[0]).toMatchObject({ xOffset: 120, yOffset: -45 });
  });

  it('reads TextHeight after the offsets, not before them', () => {
    const { text } = decodeText(textBody([{ fontId: 17, xOffset: 7, yOffset: 9, textHeight: 440, glyphs: [[0, 10]] }]));

    expect(text.runs[0]).toMatchObject({ xOffset: 7, yOffset: 9, textHeight: 440 });
  });

  it('defaults a missing offset to 0 rather than inheriting the previous run', () => {
    const { text } = decodeText(
      textBody([
        { fontId: 17, xOffset: 100, yOffset: 50, glyphs: [[0, 10]] },
        { xOffset: 250, glyphs: [[1, 10]] },
      ]),
    );

    expect(text.runs[0]).toMatchObject({ xOffset: 100, yOffset: 50 });
    // An offset is an absolute position, so an absent YOffset means 0, not "keep 50".
    expect(text.runs[1]).toMatchObject({ xOffset: 250, yOffset: 0 });
  });

  it('inherits font, colour and height across runs while offsets reset', () => {
    const { text } = decodeText(
      textBody([
        { fontId: 17, color: [0x12, 0x34, 0x56], textHeight: 200, xOffset: 0, glyphs: [[0, 10]] },
        { xOffset: 300, glyphs: [[1, 10]] },
      ]),
    );

    expect(text.runs[1]).toMatchObject({
      fontId: 17,
      textHeight: 200,
      color: { r: 0x12, g: 0x34, b: 0x56, a: 255 },
    });
  });
});

describe('T-MOD-505 static text placement against a hand-computed table', () => {
  // One run at x = 100, three glyphs advancing 600, 300 and 450 twips. Offsets are absolutes, and
  // each glyph's pen position is the run origin plus the sum of the advances *before* it.
  const { text } = decodeText(
    textBody([
      {
        fontId: 17,
        xOffset: 100,
        yOffset: 800,
        textHeight: 200,
        glyphs: [
          [0, 600],
          [1, 300],
          [2, 450],
        ],
      },
      // A second run starts at a new absolute x, not at the first run's pen.
      { xOffset: 2000, yOffset: 800, glyphs: [[3, 500]] },
    ]),
  );

  function penPositions(model: StaticTextModel): number[][] {
    const positions: number[][] = [];
    for (const run of model.runs) {
      let pen = run.xOffset;
      for (const glyph of run.glyphs) {
        positions.push([pen, run.yOffset]);
        pen += glyph.advance;
      }
    }
    return positions;
  }

  it('places each glyph at the hand-computed pen position', () => {
    expect(penPositions(text)).toEqual([
      [100, 800],
      [700, 800],
      [1000, 800],
      [2000, 800],
    ]);
  });

  it('treats the second run offset as absolute, not relative to the first run pen', () => {
    // Accumulating would put the fourth glyph at 1450 + 2000 = 3450.
    expect(penPositions(text).at(-1)).toEqual([2000, 800]);
    expect(text.runs[1]?.xOffset).toBe(2000);
  });

  it('keeps TextHeight as a scale, not a pre-applied transform on the advances', () => {
    // IMPL-080-R006: glyphs scale by TextHeight / unitsPerEm at render time. The decoded advances
    // stay in font units, so halving TextHeight must not change them.
    const half = decodeText(textBody([{ fontId: 17, xOffset: 100, textHeight: 100, glyphs: [[0, 600]] }])).text;

    expect(half.runs[0]?.textHeight).toBe(100);
    expect(half.runs[0]?.glyphs[0]?.advance).toBe(600);
    expect(text.runs[0]?.glyphs[0]?.advance).toBe(600);
  });

  it('carries negative advances, which kerned text uses', () => {
    const { text: kerned } = decodeText(
      textBody([
        {
          fontId: 17,
          glyphs: [
            [0, 600],
            [1, -120],
          ],
        },
      ]),
    );
    expect(kerned.runs[0]?.glyphs.map((g) => g.advance)).toEqual([600, -120]);
  });

  it('reports TextHeight 0 as SF0274 rather than silently dividing by zero downstream', () => {
    const { codes } = decodeText(textBody([{ fontId: 17, textHeight: 0, glyphs: [[0, 10]] }]));
    expect(codes).toContain('SF0274');
  });
});

describe('SF0272 / SF0273 reach the sink, not just the return value', () => {
  function font(): DefineFontModel {
    const body = defineFont2Body([glyphBox(), glyphBox({ size: 40 })], { codes: [65, 66], layout: null });
    const cursor = new Cursor(body, 0, body.length, {
      sink: new DiagnosticSink(),
      version: 10,
      tagCode: Tag.DefineFont2,
    });
    return decodeDefineFont2or3(Tag.DefineFont2, cursor);
  }

  it('invokes the reporter callback for an out-of-range glyph index', () => {
    const reported: string[] = [];
    const { text } = decodeText(textBody([{ fontId: 17, glyphs: [[9, 10]] }]));
    recoverStaticTextCodes(text, new Map([[17, font()]]), (code) => void reported.push(code));

    expect(reported).toContain('SF0272');
  });

  it('invokes the reporter callback when the run references a font that is not embedded', () => {
    const reported: string[] = [];
    const { text } = decodeText(textBody([{ fontId: 99, glyphs: [[0, 10]] }]));
    recoverStaticTextCodes(text, new Map(), (code) => void reported.push(code));

    expect(reported).toEqual(['SF0273']);
  });

  it('stays silent and recovers the text when every glyph maps one-to-one', () => {
    const reported: string[] = [];
    const { text } = decodeText(
      textBody([
        {
          fontId: 17,
          glyphs: [
            [0, 10],
            [1, 10],
          ],
        },
      ]),
    );
    const result = recoverStaticTextCodes(text, new Map([[17, font()]]), (code) => void reported.push(code));

    expect(reported).toEqual([]);
    expect(result.text.runs[0]?.recoveredText).toBe('AB');
  });

  it('surfaces the diagnostics through buildMovieModel, end to end', () => {
    // The emission used to be computed here and forwarded by the caller; this asserts the whole
    // path, so dropping the forward again fails a test rather than only the coverage gate.
    const movie = openSwf(
      buildSwf({
        version: 10,
        body: concat(
          tag(Tag.DefineFont2, defineFont2Body([glyphBox()], { codes: [65], layout: null })),
          tag(Tag.DefineText, textBody([{ fontId: 17, glyphs: [[7, 10]] }])),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    buildMovieModel(movie);

    expect(movie.sink.list().map((d) => d.code)).toContain('SF0272');
  });
});
