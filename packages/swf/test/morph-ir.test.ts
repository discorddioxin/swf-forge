/**
 * C3 — morph interpolation, endpoint identity and the ratio-bake decision.
 *
 * `T-MOD-401` (ratio 0/65535 are IR-identical to the static endpoints), `T-MOD-402` (style pairing
 * when the two endpoint arrays disagree), `IMPL-070-R030` (rational twips, one rounding) and
 * `IMPL-070-R032` (`SF0262`/`SF0263`).
 */

import { describe, expect, it } from 'vitest';

import {
  Cursor,
  DiagnosticSink,
  Tag,
  bakeMorphRatios,
  decodeDefineMorphShape,
  interpolateMorph,
  roundTiesToEven,
  serialiseVectorShape,
  vectorShapeDigest,
  type MorphShapeModel,
  type Severity,
} from '@swf-forge/swf';
import { ByteWriter, writeRect } from '@swf-forge/swf/test-support';

const START_BOUNDS = { xMin: 0, xMax: 200, yMin: 0, yMax: 100 };
const END_BOUNDS = { xMin: 0, xMax: 400, yMin: 0, yMax: 200 };

/** A bare edge stream: `NumFillBits`/`NumLineBits` header, N straight edges, `End`. */
function straightStream(deltas: readonly (readonly [number, number])[], fillBits = 0): Uint8Array {
  const w = new ByteWriter();
  w.bits(fillBits, 4).bits(0, 4);
  if (fillBits > 0) {
    // One style-change record selecting fill style 1, so the stream produces a path.
    w.bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 1).bits(1, 1).bits(0, 1);
    w.bits(1, fillBits);
  }
  for (const [dx, dy] of deltas) {
    w.bits(1, 1).bits(1, 1).bits(14, 4).bits(1, 1); // straight, general, 16-bit deltas
    w.bits(dx < 0 ? 65536 + dx : dx, 16).bits(dy < 0 ? 65536 + dy : dy, 16);
  }
  w.bits(0, 6).align();
  return w.toUint8Array();
}

/** One curved edge, so a straight/curved pair can be built. */
function curveStream(deltas: readonly [number, number, number, number]): Uint8Array {
  const w = new ByteWriter();
  w.bits(0, 4).bits(0, 4);
  w.bits(1, 1).bits(0, 1).bits(14, 4);
  for (const value of deltas) w.bits(value < 0 ? 65536 + value : value, 16);
  w.bits(0, 6).align();
  return w.toUint8Array();
}

interface MorphOptions {
  readonly version?: 1 | 2;
  readonly styles?: Uint8Array;
  readonly offsetAdjustment?: number;
}

function decodeMorph(
  start: Uint8Array,
  end: Uint8Array,
  options: MorphOptions = {},
): { model: MorphShapeModel; codes: string[] } {
  const version = options.version ?? 1;
  const tagCode = version === 2 ? Tag.DefineMorphShape2 : Tag.DefineMorphShape;
  const styles = options.styles ?? Uint8Array.from([0, 0]);
  const w = new ByteWriter();
  w.u16(7);
  writeRect(w, START_BOUNDS);
  writeRect(w, END_BOUNDS);
  if (version === 2) {
    writeRect(w, START_BOUNDS);
    writeRect(w, END_BOUNDS);
    w.u8(0);
  }
  w.u32(styles.length + start.length + (options.offsetAdjustment ?? 0));
  w.bytes(styles).bytes(start).bytes(end);
  const bytes = w.toUint8Array();
  const sink = new DiagnosticSink();
  const cursor = new Cursor(bytes, 0, bytes.length, { sink, version: 10, tagCode });
  const model = decodeDefineMorphShape(tagCode, cursor);
  return { model, codes: sink.list().map((d) => d.code) };
}

/** A solid-fill MORPHFILLSTYLEARRAY of `count` entries, plus an empty line array. */
function solidFills(count: number): Uint8Array {
  const w = new ByteWriter();
  w.u8(count);
  for (let i = 0; i < count; i += 1) {
    w.u8(0x00);
    w.u8(10 * (i + 1))
      .u8(20)
      .u8(30)
      .u8(255); // start colour
    w.u8(200).u8(100).u8(50).u8(255); // end colour
  }
  w.u8(0);
  return w.toUint8Array();
}

function collect(): { emit: (code: string, severity: Severity, message: string) => void; codes: string[] } {
  const codes: string[] = [];
  return { emit: (code) => void codes.push(code), codes };
}

describe('roundTiesToEven (IMPL-070-R030)', () => {
  it('sends exact halves to the nearest even integer, in both directions', () => {
    expect([0.5, 1.5, 2.5, 3.5, 4.5].map(roundTiesToEven)).toEqual([0, 2, 2, 4, 4]);
    expect([-0.5, -1.5, -2.5, -3.5].map(roundTiesToEven)).toEqual([0, -2, -2, -4]);
  });

  it('is unbiased over a run of halves, which half-up is not', () => {
    // This is the whole reason R030 names banker's rounding: a tween walks through long runs of
    // exact halves, and a directional tie-break drifts the geometry a twip at a time.
    const halves = Array.from({ length: 100 }, (_, i) => i + 0.5);
    const exact = halves.reduce((sum, value) => sum + value, 0);

    expect(halves.reduce((sum, value) => sum + roundTiesToEven(value), 0)).toBe(exact);
    expect(halves.reduce((sum, value) => sum + Math.round(value), 0)).toBe(exact + 50);
  });

  it('leaves non-ties and integers alone, and never produces negative zero', () => {
    expect(roundTiesToEven(2.4)).toBe(2);
    expect(roundTiesToEven(2.6)).toBe(3);
    expect(roundTiesToEven(-2.4)).toBe(-2);
    expect(Object.is(roundTiesToEven(-0.4), 0)).toBe(true);
  });
});

describe('T-MOD-401 morph endpoints are IR-identical to the static shapes', () => {
  const start = straightStream([
    [100, 0],
    [0, 100],
    [-100, -100],
  ]);
  const end = straightStream([
    [200, 0],
    [0, 200],
    [-200, -200],
  ]);

  it('returns the exact start geometry at ratio 0 and the exact end geometry at ratio 65535', () => {
    const { model } = decodeMorph(start, end);

    expect(serialiseVectorShape(interpolateMorph(model, 0))).toBe(serialiseVectorShape(model.start));
    expect(serialiseVectorShape(interpolateMorph(model, 65535))).toBe(serialiseVectorShape(model.end));
    expect(vectorShapeDigest(interpolateMorph(model, 0))).toBe(vectorShapeDigest(model.start));
    expect(vectorShapeDigest(interpolateMorph(model, 65535))).toBe(vectorShapeDigest(model.end));
  });

  it('keeps a promoted straight edge straight at the endpoints', () => {
    // Pairing a straight edge with a curve turns the straight one into a quadratic for
    // interpolation. At ratio 0 the *original* straight edge must come back, or the endpoint would
    // render through a different code path than the static shape (R031).
    const { model } = decodeMorph(straightStream([[100, 0]]), curveStream([50, 50, 50, -50]));

    expect(model.pairs[0]?.morphStart.controlX).toBe(50);
    expect(interpolateMorph(model, 0).edges[0]).toEqual({ fromX: 0, fromY: 0, toX: 100, toY: 0 });
    expect(interpolateMorph(model, 0).edges[0]?.controlX).toBeUndefined();
  });

  it('states the fill-winding rule instead of inheriting a placeholder (F-P3-10)', () => {
    // Neither morph tag has a fill-winding flag, so the endpoints take DefineShape1-3's even-odd
    // default. Before C3 they silently carried `nonZero`, which would have made a morph endpoint
    // serialise differently from the static shape it is supposed to equal.
    const { model } = decodeMorph(start, end);

    expect(model.start.fillRule).toBe('evenOdd');
    expect(model.end.fillRule).toBe('evenOdd');
    expect(interpolateMorph(model, 32768).fillRule).toBe('evenOdd');
  });

  it('is exact at the endpoints for every style kind, not just geometry', () => {
    const { model } = decodeMorph(straightStream([[100, 0]], 1), straightStream([[200, 0]], 1), {
      styles: solidFills(1),
    });

    expect(interpolateMorph(model, 0).styles.fills[1]).toEqual({
      kind: 'solid',
      color: { r: 10, g: 20, b: 30, a: 255 },
    });
    expect(interpolateMorph(model, 65535).styles.fills[1]).toEqual({
      kind: 'solid',
      color: { r: 200, g: 100, b: 50, a: 255 },
    });
  });

  it('moves monotonically between the endpoints at intermediate ratios', () => {
    const { model } = decodeMorph(start, end);
    const xs = [0, 16384, 32768, 49152, 65535].map((ratio) => interpolateMorph(model, ratio).edges[0]?.toX ?? 0);

    expect(xs[0]).toBe(100);
    expect(xs.at(-1)).toBe(200);
    for (let i = 1; i < xs.length; i += 1) expect(xs[i] as number).toBeGreaterThan(xs[i - 1] as number);
  });

  it('clamps a ratio outside 0..65535 instead of extrapolating the shape', () => {
    const { model } = decodeMorph(start, end);

    expect(serialiseVectorShape(interpolateMorph(model, -5))).toBe(serialiseVectorShape(model.start));
    expect(serialiseVectorShape(interpolateMorph(model, 70000))).toBe(serialiseVectorShape(model.end));
  });
});

describe('IMPL-070-R030 rational twips survive to a single rounding', () => {
  it('halves an odd delta into a half-twip control point and reports SF0266', () => {
    // 101 twips halves to 50.5. Rounding at promotion time would lose the endpoint by a twip.
    const { model, codes } = decodeMorph(straightStream([[101, 0]]), curveStream([50, 50, 51, -50]));

    expect(codes).toContain('SF0266');
    expect(model.pairs[0]?.morphStart.controlX).toBe(50.5);
  });

  it('keeps the unrounded value when the caller asks to round later', () => {
    const { model } = decodeMorph(straightStream([[101, 0]]), curveStream([50, 50, 51, -50]));
    const exact = interpolateMorph(model, 32768, { round: false });
    const rounded = interpolateMorph(model, 32768);

    expect(Number.isInteger(exact.edges[0]?.controlX ?? 0)).toBe(false);
    expect(Number.isInteger(rounded.edges[0]?.controlX ?? 0)).toBe(true);
  });

  it('rounds once at the end rather than accumulating a per-component error', () => {
    const { model } = decodeMorph(straightStream([[101, 0]]), curveStream([50, 50, 51, -50]));
    const atHalf = interpolateMorph(model, 32768, { round: false });
    const control = atHalf.edges[0]?.controlX ?? 0;

    // The interpolated value is the average of the two exact half-twip controls, not the average of
    // two already-rounded ones.
    const startControl = model.pairs[0]?.morphStart.controlX ?? 0;
    const endControl = model.pairs[0]?.morphEnd.controlX ?? 0;
    const t = 32768 / 65535;
    expect(control).toBeCloseTo((1 - t) * startControl + t * endControl, 10);
  });
});

describe('T-MOD-402 morph style pairing', () => {
  it('pairs fill styles by index across both endpoint arrays', () => {
    const { model } = decodeMorph(straightStream([[100, 0]], 1), straightStream([[200, 0]], 1), {
      styles: solidFills(3),
    });

    expect(model.start.styles.fills).toHaveLength(4); // index 0 is the reserved "no style"
    expect(model.end.styles.fills).toHaveLength(4);
    expect(model.start.styles.fills[0]).toBeNull();
    expect(model.start.styles.fills[2]).toEqual({ kind: 'solid', color: { r: 20, g: 20, b: 30, a: 255 } });
    expect(model.end.styles.fills[2]).toEqual({ kind: 'solid', color: { r: 200, g: 100, b: 50, a: 255 } });
  });

  it('reports a fill kind that changes between endpoints and keeps both sides usable', () => {
    // One MORPHFILLSTYLE whose start is solid and end is solid is the legal case; a *gradient*
    // paired against a solid cannot be encoded in one MORPHFILLSTYLE, so the restriction check has
    // to run on the decoded pair rather than on the byte stream.
    const w = new ByteWriter();
    w.u8(1).u8(0x00);
    w.u8(1).u8(2).u8(3).u8(255);
    w.u8(4).u8(5).u8(6).u8(255);
    w.u8(0);
    const { model } = decodeMorph(straightStream([[100, 0]], 1), straightStream([[200, 0]], 1), {
      styles: w.toUint8Array(),
    });

    const patched: MorphShapeModel = {
      ...model,
      end: {
        ...model.end,
        styles: {
          ...model.end.styles,
          fills: [
            null,
            {
              kind: 'bitmap',
              bitmapId: 9,
              repeat: true,
              smoothed: true,
              matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
            },
          ],
        },
      },
    };

    // A kind change cannot be interpolated; the start kind wins so the frame still draws.
    expect(interpolateMorph(patched, 32768).styles.fills[1]).toMatchObject({ kind: 'solid' });
  });

  it('interpolates line width and colour from the shared MORPHLINESTYLE flag word', () => {
    const styles = new ByteWriter();
    styles.u8(0); // no fills
    styles.u8(1); // one MORPHLINESTYLE (v1: widths then two RGBA)
    styles.u16(20).u16(120);
    styles.u8(0).u8(0).u8(0).u8(255);
    styles.u8(255).u8(255).u8(255).u8(255);
    const { model } = decodeMorph(straightStream([[100, 0]]), straightStream([[200, 0]]), {
      styles: styles.toUint8Array(),
    });

    expect(model.start.styles.lines[1]).toMatchObject({ width: 20 });
    expect(model.end.styles.lines[1]).toMatchObject({ width: 120 });
    const mid = interpolateMorph(model, 32768).styles.lines[1];
    expect(mid?.width).toBe(70);
    expect(mid?.color.r).toBe(128);
  });

  it('pads the shorter endpoint array rather than dropping the extra styles', () => {
    const { model } = decodeMorph(straightStream([[100, 0]], 1), straightStream([[200, 0]], 1), {
      styles: solidFills(2),
    });
    const trimmed: MorphShapeModel = {
      ...model,
      end: { ...model.end, styles: { ...model.end.styles, fills: [null] } },
    };

    // The missing counterpart falls back to the start style instead of producing a hole.
    expect(interpolateMorph(trimmed, 32768).styles.fills[1]).toMatchObject({ kind: 'solid' });
    expect(interpolateMorph(trimmed, 32768).styles.fills).toHaveLength(3);
  });
});

describe('IMPL-070-R032 ratio baking', () => {
  function model(): MorphShapeModel {
    return decodeMorph(
      straightStream([
        [100, 0],
        [0, 100],
      ]),
      straightStream([
        [200, 0],
        [0, 200],
      ]),
    ).model;
  }

  it('records the default runtime-interpolation decision with SF0262', () => {
    const sink = collect();
    const result = bakeMorphRatios(model(), { emit: sink.emit });

    expect(result.strategy).toBe('runtime');
    expect(result.frames).toEqual([]);
    expect(sink.codes).toEqual(['SF0262']);
  });

  it('bakes the configured finite ratio set and reports it', () => {
    const sink = collect();
    const result = bakeMorphRatios(model(), { ratioBake: [0, 32768, 65535], emit: sink.emit });

    expect(result.strategy).toBe('baked');
    expect(result.frames.map((frame) => frame.ratio)).toEqual([0, 32768, 65535]);
    expect(sink.codes).toEqual(['SF0262']);
  });

  it('deduplicates and sorts the ratio set, so the frame order is configuration-independent', () => {
    const a = bakeMorphRatios(model(), { ratioBake: [65535, 0, 32768, 0] });
    const b = bakeMorphRatios(model(), { ratioBake: [0, 32768, 65535] });

    expect(a.frames.map((f) => f.ratio)).toEqual([0, 32768, 65535]);
    expect(a.frames.map((f) => vectorShapeDigest(f.shape))).toEqual(b.frames.map((f) => vectorShapeDigest(f.shape)));
  });

  it('drops the mesh with SF0263 when the baked frames exceed the vertex budget', () => {
    const sink = collect();
    const result = bakeMorphRatios(model(), { ratioBake: [0, 32768, 65535], vertexBudget: 4, emit: sink.emit });

    expect(result.strategy).toBe('dropped');
    expect(result.frames).toEqual([]);
    expect(result.vertexCount).toBeGreaterThan(result.vertexBudget);
    expect(sink.codes).toEqual(['SF0263']);
  });

  it('rejects out-of-range ratios instead of baking a clamped duplicate', () => {
    const result = bakeMorphRatios(model(), { ratioBake: [-1, 70000, 1.5, 100] });
    expect(result.frames.map((f) => f.ratio)).toEqual([100]);
  });

  it('bakes frames that match interpolateMorph exactly', () => {
    const subject = model();
    const result = bakeMorphRatios(subject, { ratioBake: [12345] });

    expect(serialiseVectorShape(result.frames[0]?.shape as never)).toBe(
      serialiseVectorShape(interpolateMorph(subject, 12345)),
    );
  });
});
