/** P3 production DefineMorphShape/2 endpoint decoding and Ratio-independent edge pairs. */

import { describe, expect, it } from 'vitest';

import { Tag, buildMovieModel, openSwf } from '@swf-forge/swf';
import { ByteWriter, buildSwf, concat, endTag, showFrames, tag, writeRect } from '@swf-forge/swf/test-support';

const START_BOUNDS = { xMin: 0, xMax: 200, yMin: 0, yMax: 100 };
const END_BOUNDS = { xMin: 0, xMax: 300, yMin: 0, yMax: 150 };

function edgeStream(deltaX: number): Uint8Array {
  const w = new ByteWriter();
  w.bits(0, 4).bits(0, 4); // no fills/lines
  w.bits(1, 1).bits(1, 1).bits(6, 4).bits(1, 1); // straight general edge, 8-bit deltas
  w.bits(deltaX < 0 ? 256 + deltaX : deltaX, 8).bits(0, 8);
  w.bits(0, 6).align();
  return w.toUint8Array();
}

function lineStyledStream(deltaX: number): Uint8Array {
  const w = new ByteWriter();
  w.bits(0, 4).bits(1, 4); // no fill bits; one line-index bit
  w.bits(0, 1).bits(0, 1).bits(1, 1).bits(0, 1).bits(0, 1).bits(0, 1).bits(1, 1);
  w.bits(1, 1); // LineStyle = 1
  w.bits(1, 1).bits(1, 1).bits(6, 4).bits(1, 1).bits(deltaX, 8).bits(0, 8);
  w.bits(0, 6).align();
  return w.toUint8Array();
}

function movedEdgeStream(moveX: number, deltaX: number): Uint8Array {
  const w = new ByteWriter();
  w.bits(0, 4).bits(0, 4);
  w.bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 1).bits(1, 1);
  w.bits(5, 5).bits(moveX, 5).bits(0, 5);
  w.bits(1, 1).bits(1, 1).bits(6, 4).bits(1, 1).bits(deltaX, 8).bits(0, 8);
  w.bits(0, 6).align();
  return w.toUint8Array();
}

function curveStream(controlDx: number, controlDy: number, anchorDx: number, anchorDy: number): Uint8Array {
  const w = new ByteWriter();
  w.bits(0, 4).bits(0, 4);
  w.bits(1, 1).bits(0, 1).bits(6, 4); // quadratic edge with 8-bit deltas
  for (const value of [controlDx, controlDy, anchorDx, anchorDy]) w.bits(value < 0 ? 256 + value : value, 8);
  w.bits(0, 6).align();
  return w.toUint8Array();
}

function morphBody(
  id: number,
  tagCode: typeof Tag.DefineMorphShape | typeof Tag.DefineMorphShape2,
  start: Uint8Array,
  end: Uint8Array,
  options: { offsetAdjustment?: number; flags?: number; styles?: Uint8Array } = {},
): Uint8Array {
  const styles = options.styles ?? Uint8Array.from([0, 0]); // empty MorphFillStyleArray and MorphLineStyleArray by default
  const offset = styles.length + start.length + (options.offsetAdjustment ?? 0);
  const w = new ByteWriter();
  w.u16(id);
  writeRect(w, START_BOUNDS);
  writeRect(w, END_BOUNDS);
  if (tagCode === Tag.DefineMorphShape2) {
    writeRect(w, START_BOUNDS);
    writeRect(w, END_BOUNDS);
    w.u8(options.flags ?? 0);
  }
  w.u32(offset).bytes(styles).bytes(start).bytes(end);
  return w.toUint8Array();
}

function movie(
  tagCode: typeof Tag.DefineMorphShape | typeof Tag.DefineMorphShape2,
  body: Uint8Array,
): ReturnType<typeof openSwf> {
  return openSwf(buildSwf({ version: 10, body: concat(tag(tagCode, body), showFrames(1), endTag()), frameCount: 1 }));
}

describe('morph shape model', () => {
  it('decodes independent start/end edge streams and pairs by index', () => {
    const file = movie(Tag.DefineMorphShape, morphBody(41, Tag.DefineMorphShape, edgeStream(20), edgeStream(50)));
    const model = buildMovieModel(file);
    const morph = model.characters.get(41)?.morph;
    expect(morph).toMatchObject({
      id: 41,
      version: 1,
      startBounds: START_BOUNDS,
      endBounds: END_BOUNDS,
      startEdgeBounds: null,
      endEdgeBounds: null,
      edgeCounts: { start: 1, end: 1 },
      correspondence: 'index',
      offsetMatches: true,
      flags: { nonScalingStrokes: false, scalingStrokes: false },
      pairs: [{ index: 0, start: { fromX: 0, toX: 20 }, end: { fromX: 0, toX: 50 } }],
    });
    expect(model.characters.get(41)?.bounds).toEqual(START_BOUNDS);
    expect(file.diagnostics.some((item) => item.severity === 'error')).toBe(false);
  });

  it('T-MOD-408: reports MoveTo boundary mismatches without discarding endpoint geometry', () => {
    const file = movie(
      Tag.DefineMorphShape,
      morphBody(46, Tag.DefineMorphShape, movedEdgeStream(10, 20), edgeStream(20)),
    );
    const morph = buildMovieModel(file).characters.get(46)?.morph;
    expect(morph?.start.edges).toHaveLength(1);
    expect(morph?.end.edges).toHaveLength(1);
    expect(file.sink.codes()).toContain('SF0265');
  });

  it('records MorphShape2 bounds and stroke scaling flags', () => {
    const file = movie(
      Tag.DefineMorphShape2,
      morphBody(42, Tag.DefineMorphShape2, edgeStream(10), edgeStream(10), { flags: 0x03 }),
    );
    const morph = buildMovieModel(file).characters.get(42)?.morph;
    expect(morph).toMatchObject({
      version: 2,
      startEdgeBounds: START_BOUNDS,
      endEdgeBounds: END_BOUNDS,
      flags: { nonScalingStrokes: true, scalingStrokes: true },
      edgeCounts: { start: 1, end: 1 },
    });
  });

  it('T-MOD-405 reads the single MORPHGRADIENT header byte, both matrices, and interleaved endpoint stops', () => {
    const styles = new ByteWriter();
    styles.u8(1).u8(0x10); // one linear morph gradient fill
    const matrix = (x: number, y: number): void => {
      styles.bits(0, 1).bits(0, 1).bits(8, 5);
      styles
        .bits(x < 0 ? 256 + x : x, 8)
        .bits(y < 0 ? 256 + y : y, 8)
        .align();
    };
    matrix(10, -5);
    matrix(20, 7);
    // ONE header byte, laid out like GRADIENT's: spread 2 (repeat), interpolation 1 (linear RGB),
    // NumGradients 2. Reading a separate UI8 count here would shift every stop by a byte (E-028).
    styles.u8((2 << 6) | (1 << 4) | 2);
    styles.u8(0).u8(255).u8(0).u8(0).u8(255).u8(0).u8(0).u8(255).u8(0).u8(255);
    styles.u8(255).u8(0).u8(0).u8(255).u8(255).u8(255).u8(255).u8(255).u8(0).u8(255);
    styles.u8(0); // no morph line styles
    const emptyShape = new ByteWriter().bits(0, 4).bits(0, 4).bits(0, 6).align().toUint8Array();
    const file = movie(
      Tag.DefineMorphShape,
      morphBody(48, Tag.DefineMorphShape, emptyShape, emptyShape, { styles: styles.toUint8Array() }),
    );
    const morph = buildMovieModel(file).characters.get(48)?.morph;
    expect(morph?.start.styles.fills[1]).toMatchObject({
      kind: 'gradient',
      linear: true,
      matrix: { tx: 10, ty: -5 },
      gradient: {
        spreadMode: 2,
        interpolationMode: 1,
        stops: [
          { ratio: 0, color: { r: 255, g: 0, b: 0, a: 255 } },
          { ratio: 255, color: { r: 0, g: 0, b: 255, a: 255 } },
        ],
      },
    });
    expect(morph?.end.styles.fills[1]).toMatchObject({
      kind: 'gradient',
      linear: true,
      matrix: { tx: 20, ty: 7 },
      gradient: {
        spreadMode: 2,
        interpolationMode: 1,
        stops: [
          { ratio: 0, color: { r: 0, g: 255, b: 0, a: 255 } },
          { ratio: 255, color: { r: 255, g: 255, b: 0, a: 255 } },
        ],
      },
    });
  });

  it('T-MOD-406 shares LINESTYLE2 flags and decodes one paired MORPHFILLSTYLE after the miter limit', () => {
    const styles = new ByteWriter();
    styles.u8(0).u8(1); // no morph fills; one MorphLineStyle2
    styles.u16(100).u16(200);
    styles.bits(1, 2).bits(2, 2).bits(1, 1).bits(1, 1).bits(0, 1).bits(1, 1);
    styles.bits(0, 5).bits(1, 1).bits(2, 2);
    styles.u16(0x0380); // 3.5 shared 8.8 miter factor
    styles.u8(0x00).u8(240).u8(20).u8(10).u8(255).u8(10).u8(50).u8(245).u8(255);
    const file = movie(
      Tag.DefineMorphShape2,
      morphBody(47, Tag.DefineMorphShape2, lineStyledStream(50), edgeStream(80), {
        flags: 0,
        styles: styles.toUint8Array(),
      }),
    );
    const morph = buildMovieModel(file).characters.get(47)?.morph;
    expect(morph?.start.strokes).toEqual([{ styleId: 1, edgeRefs: [0], closed: false }]);
    expect(morph?.start.styles.lines[1]).toMatchObject({
      width: 100,
      join: 2,
      miterLimit: 3.5,
      fill: { kind: 'solid', color: { r: 240, g: 20, b: 10, a: 255 } },
    });
    expect(morph?.end.styles.lines[1]).toMatchObject({
      width: 200,
      fill: { kind: 'solid', color: { r: 10, g: 50, b: 245, a: 255 } },
    });
  });

  it('T-MOD-404: treats Offset as a hint and diagnoses stale offsets while continuing the parse', () => {
    const file = movie(
      Tag.DefineMorphShape,
      morphBody(43, Tag.DefineMorphShape, edgeStream(20), edgeStream(50), { offsetAdjustment: 3 }),
    );
    const morph = buildMovieModel(file).characters.get(43)?.morph;
    expect(morph?.start.edges).toHaveLength(1);
    expect(morph?.end.edges).toHaveLength(1);
    expect(morph?.offsetMatches).toBe(false);
    expect(file.sink.codes()).toContain('SF0264');
  });

  it('T-MOD-407: promotes straight/curved pairs without rounding half-twip controls', () => {
    const file = movie(
      Tag.DefineMorphShape,
      morphBody(45, Tag.DefineMorphShape, edgeStream(5), curveStream(8, 10, 12, 14)),
    );
    const pair = buildMovieModel(file).characters.get(45)?.morph?.pairs[0];
    expect(pair).toMatchObject({
      start: { fromX: 0, fromY: 0, toX: 5, toY: 0 },
      morphStart: { fromX: 0, fromY: 0, controlX: 2.5, controlY: 0, toX: 5, toY: 0 },
      end: { controlX: 8, controlY: 10, toX: 20, toY: 24 },
      morphEnd: { controlX: 8, controlY: 10, toX: 20, toY: 24 },
    });
    expect(file.sink.codes()).toContain('SF0266');
  });

  it('T-MOD-403: inserts degenerate counterparts for unequal endpoint edge counts', () => {
    const file = movie(
      Tag.DefineMorphShape,
      morphBody(
        44,
        Tag.DefineMorphShape,
        edgeStream(20),
        new ByteWriter().bits(0, 4).bits(0, 4).bits(0, 6).align().toUint8Array(),
      ),
    );
    const morph = buildMovieModel(file).characters.get(44)?.morph;
    expect(morph).toMatchObject({ edgeCounts: { start: 1, end: 0 }, pairs: [{ index: 0 }] });
    expect(morph?.end.edges).toHaveLength(1);
    expect(morph?.end.edges[0]).toMatchObject({ fromX: 0, fromY: 0, toX: 0, toY: 0 });
    expect(file.sink.codes()).toContain('SF0261');
  });
});
