/**
 * C2 — fill styles, gradients and path chaining.
 *
 * Covers the decode-side obligations the earlier shape suites left open:
 * `T-MOD-103` (fill0/fill1 chaining: rectangle, donut, self-intersection), `T-MOD-104` (all four
 * bitmap fill types and the bitmap matrix), `T-MOD-105`/`119`/`120`/`121` (gradient structures),
 * `T-MOD-109` (`NoClose` and the open-fill/open-stroke asymmetry) and `T-MOD-111` (the
 * `UsesFillWindingRule` flag reaching the IR).
 */

import { describe, expect, it } from 'vitest';

import type { ShapeVersion } from '@swf-forge/swf';
import { ByteWriter } from '@swf-forge/swf/test-support';

import {
  buildAndDecode,
  writeColor,
  writeCurvedEdge,
  writeGradientFill,
  writeMatrix,
  writeStraightEdge,
  writeStyleChange,
  type GradientSpec,
} from './support/shape-bytes.js';

const RED = [255, 0, 0, 255] as const;
const ALL_VERSIONS: readonly ShapeVersion[] = [1, 2, 3, 4];

/** One solid fill, written at the colour width the version demands. */
function oneSolidFill(version: ShapeVersion) {
  return (w: ByteWriter): void => {
    w.u8(1).u8(0x00);
    writeColor(w, version, RED);
  };
}

/** One gradient fill array holding exactly `spec`. */
function oneGradientFill(version: ShapeVersion, spec: GradientSpec) {
  return (w: ByteWriter): void => {
    w.u8(1);
    writeGradientFill(w, version, spec);
  };
}

function gradientOf(version: ShapeVersion, spec: GradientSpec, fileVersion = 10) {
  const decoded = buildAndDecode({ version, fills: oneGradientFill(version, spec) }, fileVersion);
  const fill = decoded.shape.styles.fills[1];
  if (fill?.kind !== 'gradient') throw new Error(`expected a gradient fill, got ${String(fill?.kind)}`);
  return { ...decoded, fill, gradient: fill.gradient };
}

describe('T-MOD-103 fill0/fill1 chaining', () => {
  it('builds one closed path for a rectangle drawn under FillStyle1', () => {
    const { shape, codes } = buildAndDecode({
      version: 2,
      bounds: { xMin: 0, xMax: 200, yMin: 0, yMax: 200 },
      fills: oneSolidFill(2),
      numFillBits: 1,
      records: (w) => {
        writeStyleChange(w, { moveTo: [0, 0], fill1: 1, numFillBits: 1, numLineBits: 0 });
        for (const [dx, dy] of [
          [200, 0],
          [0, 200],
          [-200, 0],
          [0, -200],
        ] as const) {
          writeStraightEdge(w, dx, dy);
        }
      },
    });

    expect(shape.paths).toEqual([{ styleId: 1, edgeRefs: [0, 1, 2, 3], closed: true, implicitClose: false }]);
    expect(shape.strokes).toEqual([]);
    expect(codes).not.toContain('SF0186');
  });

  it('builds a donut as two runs of the same style: outer on FillStyle1, hole on FillStyle0', () => {
    // The hole is wound the other way round. Flash encodes it by swapping which *side* of the pen
    // the style sits on, not by reversing the point order, which is exactly why both runs have to
    // be tracked concurrently (`IMPL-060-R030`).
    const { shape, codes } = buildAndDecode({
      version: 2,
      bounds: { xMin: 0, xMax: 200, yMin: 0, yMax: 200 },
      fills: oneSolidFill(2),
      numFillBits: 1,
      records: (w) => {
        writeStyleChange(w, { moveTo: [0, 0], fill1: 1, numFillBits: 1, numLineBits: 0 });
        for (const [dx, dy] of [
          [200, 0],
          [0, 200],
          [-200, 0],
          [0, -200],
        ] as const) {
          writeStraightEdge(w, dx, dy);
        }
        writeStyleChange(w, { moveTo: [50, 50], fill0: 1, fill1: 0, numFillBits: 1, numLineBits: 0 });
        for (const [dx, dy] of [
          [0, 100],
          [100, 0],
          [0, -100],
          [-100, 0],
        ] as const) {
          writeStraightEdge(w, dx, dy);
        }
      },
    });

    expect(shape.edges).toHaveLength(8);
    expect(shape.paths).toEqual([
      { styleId: 1, edgeRefs: [0, 1, 2, 3], closed: true, implicitClose: false },
      { styleId: 1, edgeRefs: [4, 5, 6, 7], closed: true, implicitClose: false },
    ]);
    // Opposite winding: the shoelace sums have opposite signs, which is what makes the hole a hole.
    const shoelace = (refs: readonly number[]): number =>
      refs.reduce((sum, ref) => {
        const e = shape.edges[ref];
        return e === undefined ? sum : sum + (e.fromX * e.toY - e.toX * e.fromY);
      }, 0);
    expect(Math.sign(shoelace(shape.paths[0]?.edgeRefs ?? []))).toBe(
      -Math.sign(shoelace(shape.paths[1]?.edgeRefs ?? [])),
    );
    expect(codes).not.toContain('SF0186');
  });

  it('keeps a self-intersecting bowtie as a single closed run', () => {
    // (0,0) -> (100,100) -> (100,0) -> (0,100) -> (0,0): the two diagonals cross. Resolving the
    // crossing is the tessellator's job; the decoder must not split or reorder the run.
    const { shape, codes } = buildAndDecode({
      version: 2,
      bounds: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
      fills: oneSolidFill(2),
      numFillBits: 1,
      records: (w) => {
        writeStyleChange(w, { moveTo: [0, 0], fill0: 1, numFillBits: 1, numLineBits: 0 });
        for (const [dx, dy] of [
          [100, 100],
          [0, -100],
          [-100, 100],
          [0, -100],
        ] as const) {
          writeStraightEdge(w, dx, dy);
        }
      },
    });

    expect(shape.paths).toEqual([{ styleId: 1, edgeRefs: [0, 1, 2, 3], closed: true, implicitClose: false }]);
    expect(codes).not.toContain('SF0186');
  });
});

describe('T-MOD-104 bitmap fills', () => {
  it('decodes all four FillStyleType bitmap modes into repeat × smoothed', () => {
    const { shape, codes } = buildAndDecode({
      version: 3,
      fills: (w) => {
        w.u8(4);
        for (const type of [0x40, 0x41, 0x42, 0x43]) {
          w.u8(type).u16(0x1234);
          writeMatrix(w);
        }
      },
    });

    expect(shape.styles.fills.slice(1)).toEqual([
      {
        kind: 'bitmap',
        bitmapId: 0x1234,
        repeat: true,
        smoothed: true,
        matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
      },
      {
        kind: 'bitmap',
        bitmapId: 0x1234,
        repeat: false,
        smoothed: true,
        matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
      },
      {
        kind: 'bitmap',
        bitmapId: 0x1234,
        repeat: true,
        smoothed: false,
        matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
      },
      {
        kind: 'bitmap',
        bitmapId: 0x1234,
        repeat: false,
        smoothed: false,
        matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
      },
    ]);
    expect(codes).not.toContain('SF0180');
  });

  it('carries the bitmap matrix verbatim: it maps bitmap space into shape space, not into a unit square', () => {
    // A 20× scale is the common case — the matrix converts the bitmap's pixel grid to twips — and
    // it is the detail v1.0 of the chapter got wrong by calling the space "unit gradient space".
    const { shape } = buildAndDecode({
      version: 3,
      fills: (w) => {
        w.u8(2);
        w.u8(0x40).u16(7);
        writeMatrix(w, { scale: [20, 20], translate: [400, -260] });
        w.u8(0x41).u16(8);
        writeMatrix(w, { scale: [0.5, 2], rotate: [0.25, -0.25] });
      },
    });

    expect(shape.styles.fills[1]).toMatchObject({ bitmapId: 7, matrix: { a: 20, d: 20, tx: 400, ty: -260 } });
    // `readMatrix` maps RotateSkew0 -> c and RotateSkew1 -> b.
    expect(shape.styles.fills[2]).toMatchObject({ bitmapId: 8, matrix: { a: 0.5, d: 2, c: 0.25, b: -0.25 } });
  });

  it('quarantines an unknown FillStyleType with SF0180 instead of desynchronising the array', () => {
    const { shape, codes } = buildAndDecode({
      version: 3,
      fills: (w) => {
        w.u8(2).u8(0x7f); // 0x7f is not one of the eight defined types
        writeColor(w, 3, RED);
        w.u8(0x00);
        writeColor(w, 3, RED);
      },
    });

    expect(codes).toContain('SF0180');
    expect(shape.styles.fills).toEqual([null, null]);
  });
});

describe('T-MOD-105 gradient stops', () => {
  it('preserves stop order, duplicate ratios and the linear-RGB interpolation flag', () => {
    const { gradient, codes } = gradientOf(3, {
      type: 0x10,
      interpolationMode: 1,
      stops: [
        [0, [0, 0, 0, 255]],
        [128, [255, 0, 0, 128]],
        [128, [0, 255, 0, 64]],
        [255, [255, 255, 255, 255]],
      ],
    });

    expect(gradient.interpolationMode).toBe(1);
    // Duplicates are retained verbatim — the IR is a record of the file, not a tidied-up copy.
    expect(gradient.stops.map((stop) => stop.ratio)).toEqual([0, 128, 128, 255]);
    expect(gradient.stops[2]?.color).toEqual({ r: 0, g: 255, b: 0, a: 64 });
    expect(codes).toContain('SF0194');
  });

  it('reports descending ratios once per offending stop but keeps the file order', () => {
    const { gradient, codes } = gradientOf(3, {
      type: 0x10,
      stops: [
        [200, [0, 0, 0, 255]],
        [100, [255, 255, 255, 255]],
      ],
    });

    expect(gradient.stops.map((stop) => stop.ratio)).toEqual([200, 100]);
    expect(codes.filter((code) => code === 'SF0194')).toHaveLength(1);
  });

  it('stays quiet for a well-ordered gradient', () => {
    const { gradient, codes } = gradientOf(3, {
      type: 0x12,
      stops: [
        [0, [0, 0, 0, 255]],
        [255, [255, 255, 255, 255]],
      ],
    });

    expect(gradient.stops).toHaveLength(2);
    // SF0189 only says the fixture never draws with the style; no gradient diagnostic fires.
    expect(codes).toEqual(['SF0189']);
  });
});

describe('T-MOD-119 gradient header byte', () => {
  it('reads spread, interpolation and count identically in all four shape versions', () => {
    for (const version of ALL_VERSIONS) {
      const { gradient, fill } = gradientOf(version, {
        type: 0x10,
        spreadMode: 2,
        interpolationMode: 1,
        stops: [
          [0, [1, 2, 3, 4]],
          [255, [5, 6, 7, 8]],
        ],
      });

      expect(gradient.spreadMode, `spread for shape ${version}`).toBe(2);
      expect(gradient.interpolationMode, `interpolation for shape ${version}`).toBe(1);
      expect(gradient.stops, `stop count for shape ${version}`).toHaveLength(2);
      expect(fill.linear).toBe(true);
    }
  });

  it('reports a reserved spread mode with SF0192 and still honours the value', () => {
    const { gradient, codes } = gradientOf(3, {
      type: 0x10,
      spreadMode: 3,
      stops: [[0, [0, 0, 0, 255]]],
    });

    expect(codes).toContain('SF0192');
    expect(gradient.spreadMode).toBe(3); // honoured, not clamped to pad
  });

  it('reports a reserved interpolation mode with SF0192 and still honours the value', () => {
    const { gradient, codes } = gradientOf(3, {
      type: 0x12,
      interpolationMode: 3,
      stops: [[0, [0, 0, 0, 255]]],
    });

    expect(codes).toContain('SF0192');
    expect(gradient.interpolationMode).toBe(3);
  });
});

describe('T-MOD-120 gradient control points', () => {
  it('reads eight stops from the 4-bit count without the extended escape', () => {
    const stops = Array.from({ length: 8 }, (_, i) => [i * 32, [i, i, i, 255]] as const);
    const { gradient, codes } = gradientOf(2, { type: 0x10, stops });

    expect(gradient.stops).toHaveLength(8);
    expect(codes).toEqual(['SF0189']); // the unused-style note only; no extended-count escape read
  });

  it('reads the 0x0F escape as an extended UI8 count, up to the 15+ ceiling', () => {
    const stops = Array.from({ length: 20 }, (_, i) => [i * 12, [i, 0, 0, 255]] as const);
    const { gradient } = gradientOf(4, { type: 0x10, stops });

    expect(gradient.stops).toHaveLength(20);
    expect(gradient.stops.at(-1)?.ratio).toBe(19 * 12);
  });

  it('flags the extended count as a reserved feature when a pre-v3 shape uses it', () => {
    const stops = Array.from({ length: 16 }, (_, i) => [i * 16, [i, 0, 0, 255]] as const);
    const { gradient, codes } = gradientOf(2, { type: 0x10, stops });

    expect(gradient.stops).toHaveLength(16);
    expect(codes).toContain('SF0191');
  });

  it('errors on NumGradients == 0 and leaves the stream aligned for the next style', () => {
    const { shape, codes } = buildAndDecode({
      version: 3,
      fills: (w) => {
        w.u8(2);
        writeGradientFill(w, 3, { type: 0x10, stops: [] });
        w.u8(0x00);
        writeColor(w, 3, RED);
      },
    });

    expect(codes).toContain('SF0193');
    expect(shape.styles.fills[1]).toMatchObject({ kind: 'gradient' });
    // Alignment proof: the solid fill *after* the empty gradient still decodes to red.
    expect(shape.styles.fills[2]).toEqual({ kind: 'solid', color: { r: 255, g: 0, b: 0, a: 255 } });
  });

  it('reads RGB stops for shape 1/2 and RGBA stops for shape 3/4', () => {
    for (const version of ALL_VERSIONS) {
      const { gradient } = gradientOf(version, { type: 0x10, stops: [[0, [10, 20, 30, 40]]] });
      expect(gradient.stops[0]?.color, `colour width for shape ${version}`).toEqual({
        r: 10,
        g: 20,
        b: 30,
        a: version >= 3 ? 40 : 255,
      });
    }
  });
});

describe('T-MOD-121 focal gradients', () => {
  it.each([
    ['0xFF00', 0xff00, -1],
    ['0x0000', 0x0000, 0],
    ['0x0100', 0x0100, 1],
    ['0x0080', 0x0080, 0.5],
  ])('decodes FIXED8 %s as %s', (_label, raw, expected) => {
    const { gradient } = gradientOf(4, {
      type: 0x13,
      focalRaw: raw as number,
      stops: [
        [0, [0, 0, 0, 255]],
        [255, [255, 255, 255, 255]],
      ],
    });

    expect(gradient.focalPoint).toBe(expected);
  });

  it('leaves an out-of-range focal point unclamped — clamping belongs at the sampler', () => {
    const { gradient } = gradientOf(4, {
      type: 0x13,
      focalRaw: 0x0200, // 2.0, outside the legal [-1, 1]
      stops: [[0, [0, 0, 0, 255]]],
    });

    // Rounding the value here would silently lose the evidence that the file is out of spec.
    expect(gradient.focalPoint).toBe(2);
  });

  it('reports SF0195 when a focal gradient appears outside DefineShape4', () => {
    const { gradient, codes } = gradientOf(3, {
      type: 0x13,
      focalRaw: 0x0100,
      stops: [[0, [0, 0, 0, 255]]],
    });

    expect(codes).toContain('SF0195');
    expect(gradient.focalPoint).toBe(1); // tolerated, not dropped
  });

  it('does not report SF0195 for a focal gradient in DefineShape4', () => {
    const { codes } = gradientOf(4, { type: 0x13, stops: [[0, [0, 0, 0, 255]]] });
    expect(codes).not.toContain('SF0195');
  });

  it('omits focalPoint entirely for linear and radial gradients', () => {
    for (const type of [0x10, 0x12]) {
      const { gradient } = gradientOf(4, { type, stops: [[0, [0, 0, 0, 255]]] });
      expect(gradient.focalPoint).toBeUndefined();
    }
  });
});

describe('T-MOD-109 closure semantics', () => {
  /** One `LINESTYLE2`, 20 twips wide, with the flag bits the test cares about. */
  function lineStyle2(noClose: boolean) {
    return (w: ByteWriter): void => {
      w.u8(1).u16(20);
      w.bits(0, 2).bits(0, 2).bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 1);
      w.bits(0, 5)
        .bits(noClose ? 1 : 0, 1)
        .bits(0, 2);
      w.u8(0).u8(0).u8(0).u8(255);
    };
  }

  function openTriangle(noClose: boolean, withFill: boolean) {
    return buildAndDecode({
      version: 4,
      bounds: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
      fills: withFill ? oneSolidFill(4) : undefined,
      lines: lineStyle2(noClose),
      numFillBits: withFill ? 1 : 0,
      numLineBits: 1,
      records: (w) => {
        writeStyleChange(w, {
          moveTo: [0, 0],
          ...(withFill ? { fill0: 1 } : {}),
          line: 1,
          numFillBits: withFill ? 1 : 0,
          numLineBits: 1,
        });
        writeStraightEdge(w, 100, 0);
        writeStraightEdge(w, 0, 100);
        // Deliberately no closing edge back to the origin.
      },
    });
  }

  it('closes an open fill run implicitly and reports SF0186', () => {
    const { shape, codes } = openTriangle(false, true);

    expect(shape.paths).toEqual([{ styleId: 1, edgeRefs: [0, 1], closed: false, implicitClose: true }]);
    expect(codes).toContain('SF0186');
  });

  it('leaves the stroke of the same run open and unreported', () => {
    const { shape } = openTriangle(false, true);
    expect(shape.strokes).toEqual([{ styleId: 1, edgeRefs: [0, 1], closed: false }]);
  });

  it('keeps NoClose on the line style so the renderer caps the ends instead of joining them', () => {
    const closed = openTriangle(false, false);
    const open = openTriangle(true, false);

    expect(closed.shape.styles.lines[1]).toMatchObject({ noClose: false });
    expect(open.shape.styles.lines[1]).toMatchObject({ noClose: true });
    // NoClose is a stroke-rendering instruction; it must not change the decoded geometry.
    expect(open.shape.edges).toEqual(closed.shape.edges);
    expect(open.shape.strokes).toEqual(closed.shape.strokes);
  });
});

describe('T-MOD-111 fill winding rule', () => {
  function shapeWithFlags(flags: number) {
    return buildAndDecode({
      version: 4,
      bounds: { xMin: 0, xMax: 100, yMin: 0, yMax: 100 },
      flags,
      fills: oneSolidFill(4),
      numFillBits: 1,
      records: (w) => {
        writeStyleChange(w, { moveTo: [0, 0], fill0: 1, numFillBits: 1, numLineBits: 0 });
        writeCurvedEdge(w, [50, 0, 50, 50]);
        writeStraightEdge(w, -100, 50);
        writeStraightEdge(w, 0, -100);
      },
    });
  }

  it('selects non-zero when UsesFillWindingRule is set and even-odd when it is clear', () => {
    const nonZero = shapeWithFlags(0b0000_0100);
    const evenOdd = shapeWithFlags(0b0000_0000);

    expect(nonZero.shape.fillRule).toBe('nonZero');
    expect(evenOdd.shape.fillRule).toBe('evenOdd');
    // Same geometry either way: the flag chooses an interpretation, not a decode path.
    expect(nonZero.shape.edges).toEqual(evenOdd.shape.edges);
    expect(nonZero.shape.paths).toEqual(evenOdd.shape.paths);
  });

  it('defaults pre-Shape4 geometry to even-odd, since the flag byte does not exist there', () => {
    for (const version of [1, 2, 3] as const) {
      const { shape } = buildAndDecode({ version, fills: oneSolidFill(version) });
      expect(shape.fillRule, `fill rule for shape ${version}`).toBe('evenOdd');
      expect(shape.rawShape4Flags).toBeNull();
    }
  });
});
