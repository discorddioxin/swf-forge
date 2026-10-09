/**
 * C2 — the tail of the geometry pipeline: quantisation, simplification and IR stability.
 *
 * `T-MOD-107` quantisation + simplification determinism over 10⁴ random shapes and the fixed
 * 4-step order; `T-MOD-108` IR stability (byte-identical serialisation across runs); `T-MOD-110`
 * the 200-shape corpus decoding clean with bounds agreeing inside 1 %.
 */

import { describe, expect, it } from 'vitest';

import {
  TWIPS_PER_PIXEL,
  isQuantised,
  quantiseScalar,
  quantiseShape,
  serialiseVectorShape,
  simplifyShape,
  vectorShapeDigest,
} from '@swf-forge/swf';
import type { Edge, FillPath, ShapeVersion, StrokePath, VectorShape } from '@swf-forge/swf';
import type { ByteWriter } from '@swf-forge/swf/test-support';

import {
  buildAndDecode,
  decodeShapeBytes,
  shapeBytes,
  writeColor,
  writeCurvedEdge,
  writeMatrix,
  writeStraightEdge,
  writeStyleChange,
} from './support/shape-bytes.js';

// ---- synthetic IR -------------------------------------------------------------------------------

/**
 * A bare `VectorShape` around a given edge pool.
 *
 * Built by hand rather than decoded, because the decoder can only ever produce integer twips
 * (`IMPL-060-R037`) and the quantiser's whole job is the fractional geometry that *later* stages —
 * morph interpolation, curve subdivision, matrix application — hand it.
 */
function irShape(
  edges: readonly Edge[],
  paths: readonly FillPath[] = [],
  strokes: readonly StrokePath[] = [],
): VectorShape {
  return {
    id: 1,
    version: 3,
    rawShape4Flags: null,
    bounds: { xMin: 0, xMax: 1000, yMin: 0, yMax: 1000 },
    edgeBounds: null,
    recomputedBounds: null,
    fillRule: 'evenOdd',
    nonScalingStrokes: false,
    scalingStrokes: false,
    styles: { fills: [null, { kind: 'solid', color: { r: 1, g: 2, b: 3, a: 255 } }], lines: [null] },
    paths,
    edges,
    strokes,
  };
}

const line = (fromX: number, fromY: number, toX: number, toY: number): Edge => ({ fromX, fromY, toX, toY });
const curve = (fromX: number, fromY: number, controlX: number, controlY: number, toX: number, toY: number): Edge => ({
  fromX,
  fromY,
  toX,
  toY,
  controlX,
  controlY,
});
const fill = (edgeRefs: readonly number[]): FillPath => ({ styleId: 1, edgeRefs, closed: true, implicitClose: false });
const stroke = (edgeRefs: readonly number[]): StrokePath => ({ styleId: 1, edgeRefs, closed: true });

/** A big square, comfortably above the 1 px² floor, so step 4 never deletes a fixture by surprise. */
const SQUARE: readonly Edge[] = [
  line(0, 0, 400, 0),
  line(400, 0, 400, 400),
  line(400, 400, 0, 400),
  line(0, 400, 0, 0),
];

/** xorshift32 — a seeded PRNG, so "random" shapes are the same random shapes on every machine. */
function rng(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x1_0000_0000;
  };
}

// ---- T-MOD-107 ----------------------------------------------------------------------------------

describe('T-MOD-107 quantisation', () => {
  it("snaps to the 1-twip grid, which is the chapter's 1/20-px grid", () => {
    expect(TWIPS_PER_PIXEL).toBe(20);
    expect(quantiseScalar(0.4)).toBe(0);
    expect(quantiseScalar(0.5)).toBe(1);
    expect(quantiseScalar(1.49)).toBe(1);
    expect(quantiseScalar(12.7)).toBe(13);
  });

  it('rounds half away from zero, so a shape survives being mirrored', () => {
    // `Math.round` breaks this: it sends +0.5 to 1 but -0.5 to -0, and a reflected shape would then
    // not be the reflection of the quantised shape.
    for (const value of [0.5, 1.5, 2.5, 7.5, 0.75]) {
      expect(quantiseScalar(-value)).toBe(-quantiseScalar(value));
    }
  });

  it('normalises negative zero so the serialised bytes cannot differ by sign of zero', () => {
    expect(Object.is(quantiseScalar(-0.2), 0)).toBe(true);
    expect(Object.is(quantiseScalar(-0), 0)).toBe(true);
  });

  it('moves points without touching styles, paths, strokes or edge indices', () => {
    const before = irShape([curve(0.4, -0.6, 10.5, 10.4, 20.5, 20.5)], [fill([0])], [stroke([0])]);
    const after = quantiseShape(before);

    expect(after.edges).toEqual([curve(0, -1, 11, 10, 21, 21)]);
    expect(after.paths).toEqual(before.paths);
    expect(after.strokes).toEqual(before.strokes);
    expect(after.styles).toBe(before.styles);
  });

  it('is idempotent and self-reports via isQuantised', () => {
    const once = quantiseShape(irShape([curve(0.4, -0.6, 10.5, 10.4, 20.5, 20.5)]));
    expect(isQuantised(once)).toBe(true);
    expect(quantiseShape(once)).toEqual(once);
  });

  it('honours a finer grid when one is asked for', () => {
    const shape = quantiseShape(irShape([line(0.26, 0, 0.74, 0)]), { gridTwips: 0.5 });
    expect(shape.edges[0]).toMatchObject({ fromX: 0.5, toX: 0.5 });
  });

  it('leaves freshly decoded geometry untouched, because the decoder already emits integer twips', () => {
    const { shape } = buildAndDecode({
      version: 3,
      bounds: { xMin: 0, xMax: 400, yMin: 0, yMax: 400 },
      fills: (w: ByteWriter) => {
        w.u8(1).u8(0x00);
        writeColor(w, 3, [255, 0, 0, 255]);
      },
      numFillBits: 1,
      records: (w) => {
        writeStyleChange(w, { moveTo: [0, 0], fill0: 1, numFillBits: 1, numLineBits: 0 });
        writeStraightEdge(w, 400, 0);
        writeCurvedEdge(w, [0, 200, 0, 200]);
        writeStraightEdge(w, -400, 0);
        writeStraightEdge(w, 0, -400);
      },
    });

    expect(isQuantised(shape)).toBe(true);
    expect(quantiseShape(shape).edges).toEqual(shape.edges);
  });
});

describe('T-MOD-107 simplification: each step, in isolation', () => {
  it('step 1 drops a zero-length segment', () => {
    const edges = [...SQUARE.slice(0, 2), line(400, 400, 400, 400), ...SQUARE.slice(2)];
    const { shape, stats } = simplifyShape(irShape(edges, [fill([0, 1, 2, 3, 4])]));

    expect(stats.zeroLengthDropped).toBe(1);
    expect(shape.edges).toHaveLength(4);
    expect(shape.paths[0]?.edgeRefs).toEqual([0, 1, 2, 3]);
  });

  it('step 1 keeps a loop whose control point leaves the origin — it still encloses area', () => {
    const { stats } = simplifyShape(irShape([curve(0, 0, 200, 200, 0, 0), ...SQUARE], [fill([0, 1, 2, 3, 4])]));
    expect(stats.zeroLengthDropped).toBe(0);
  });

  it('step 2 merges a collinear run into one segment', () => {
    const edges = [line(0, 0, 200, 0), line(200, 0, 400, 0), ...SQUARE.slice(1)];
    const { shape, stats } = simplifyShape(irShape(edges, [fill([0, 1, 2, 3, 4])]));

    expect(stats.collinearMerged).toBe(1);
    expect(shape.paths[0]?.edgeRefs).toHaveLength(4);
    expect(shape.edges.some((edge) => edge.fromX === 0 && edge.fromY === 0 && edge.toX === 400 && edge.toY === 0)).toBe(
      true,
    );
  });

  it('step 2 refuses to fold a spur that doubles back, which would change the winding', () => {
    const edges = [line(0, 0, 400, 0), line(400, 0, 200, 0), ...SQUARE.slice(1)];
    const { stats } = simplifyShape(irShape(edges, [fill([0, 1, 2, 3, 4])]));
    expect(stats.collinearMerged).toBe(0);
  });

  it('step 3 flattens a curve whose control point sits on its own chord', () => {
    const edges = [curve(0, 0, 200, 0, 400, 0), ...SQUARE.slice(1)];
    const { shape, stats } = simplifyShape(irShape(edges, [fill([0, 1, 2, 3])]));

    expect(stats.curvesFlattened).toBe(1);
    expect(shape.edges[0]).toEqual(line(0, 0, 400, 0));
  });

  it('step 3 keeps a curve that bulges past the tolerance', () => {
    const edges = [curve(0, 0, 200, 40, 400, 0), ...SQUARE.slice(1)];
    const { shape, stats } = simplifyShape(irShape(edges, [fill([0, 1, 2, 3])]));

    expect(stats.curvesFlattened).toBe(0);
    expect(shape.edges[0]?.controlY).toBe(40);
  });

  it('step 4 drops a fill path below one device pixel of area', () => {
    // A 4×4-twip triangle is 8 twips² = 0.02 px², well under the 400 twips² floor.
    const sliver = [line(0, 0, 4, 0), line(4, 0, 4, 4), line(4, 4, 0, 0)];
    const { shape, stats } = simplifyShape(irShape([...SQUARE, ...sliver], [fill([0, 1, 2, 3]), fill([4, 5, 6])]));

    expect(stats.pathsDropped).toBe(1);
    expect(shape.paths).toHaveLength(1);
    expect(shape.edges).toHaveLength(4); // the sliver's edges are compacted away with it
  });

  it('step 4 never area-drops a stroke: a zero-area stroke is a line, which is the point', () => {
    const rule = [line(0, 0, 2000, 0), line(2000, 0, 0, 0)];
    const { shape, stats } = simplifyShape(irShape(rule, [], [stroke([0, 1])]));

    expect(stats.pathsDropped).toBe(0);
    expect(shape.strokes).toHaveLength(1);
  });
});

describe('T-MOD-107 simplification: the fixed 4-step order is contractual', () => {
  it('does not re-merge a curve that step 3 turned into a collinear line', () => {
    // 0: a curve from (0,0) to (200,0) whose control lies on the chord — step 3 will flatten it.
    // 1: a straight continuation to (400,0), collinear with it.
    // Under the mandated 1-2-3-4 order, step 2 sees a *curve* at index 0 and declines to merge, so
    // two edges survive. Had the order been 1-3-2 the two would have collapsed into one. Asserting
    // the two-edge outcome is therefore an assertion about the order itself.
    const edges = [curve(0, 0, 100, 0, 200, 0), line(200, 0, 400, 0), ...SQUARE.slice(1)];
    const { shape, stats } = simplifyShape(irShape(edges, [fill([0, 1, 2, 3, 4])]));

    expect(stats.curvesFlattened).toBe(1);
    expect(stats.collinearMerged).toBe(0);
    expect(shape.paths[0]?.edgeRefs).toHaveLength(5);
  });

  it('lets step 2 see a collinear run only step 1 could expose', () => {
    // The zero-length segment between the two halves hides the collinearity from step 2 until
    // step 1 has removed it.
    const edges = [line(0, 0, 200, 0), line(200, 0, 200, 0), line(200, 0, 400, 0), ...SQUARE.slice(1)];
    const { stats } = simplifyShape(irShape(edges, [fill([0, 1, 2, 3, 4, 5])]));

    expect(stats.zeroLengthDropped).toBe(1);
    expect(stats.collinearMerged).toBe(1);
  });

  it('judges area only after steps 1-3 have finished moving the vertices', () => {
    // Without step 3 the bulging control point would not matter, but the chord polygon this path
    // reduces to is a sliver. Step 4 must see the post-step-3 geometry.
    const sliver = [curve(0, 0, 2, 0, 4, 0), line(4, 0, 4, 4), line(4, 4, 0, 0)];
    const { stats } = simplifyShape(irShape(sliver, [fill([0, 1, 2])]));

    expect(stats.curvesFlattened).toBe(1);
    expect(stats.pathsDropped).toBe(1);
  });

  it('does not corrupt a stroke that shares its edges with a fill run merged differently', () => {
    // The decoder pushes one edge index onto every live run, so the fill and the stroke below share
    // edges 0-1. The fill run covers both and merges them; the stroke run covers only the first and
    // cannot. An in-place merge would silently stretch the stroke to (400,0).
    const edges = [line(0, 0, 200, 0), line(200, 0, 400, 0), line(400, 0, 400, 400), line(400, 400, 0, 0)];
    const { shape } = simplifyShape(irShape(edges, [fill([0, 1, 2, 3])], [stroke([0])]));

    const strokeRefs = shape.strokes[0]?.edgeRefs ?? [];
    expect(strokeRefs).toHaveLength(1);
    expect(shape.edges[strokeRefs[0] as number]).toEqual(line(0, 0, 200, 0));
  });
});

describe('T-MOD-107 determinism over 10\u2074 random shapes', () => {
  /** A closed random polygon with a scattering of curves, zero-length spurs and collinear runs. */
  function randomShape(next: () => number): VectorShape {
    const vertexCount = 3 + Math.floor(next() * 6);
    const points: (readonly [number, number])[] = [];
    for (let i = 0; i < vertexCount; i += 1) {
      points.push([(next() * 2000 - 1000) / 7, (next() * 2000 - 1000) / 7]);
    }
    const edges: Edge[] = [];
    for (let i = 0; i < points.length; i += 1) {
      const [fromX, fromY] = points[i] as readonly [number, number];
      const [toX, toY] = points[(i + 1) % points.length] as readonly [number, number];
      const roll = next();
      if (roll < 0.25) {
        edges.push(curve(fromX, fromY, (fromX + toX) / 2 + next() * 10, (fromY + toY) / 2 + next() * 10, toX, toY));
      } else if (roll < 0.35) {
        edges.push(line(fromX, fromY, fromX, fromY)); // zero-length spur
        edges.push(line(fromX, fromY, toX, toY));
      } else if (roll < 0.45) {
        const midX = (fromX + toX) / 2;
        const midY = (fromY + toY) / 2;
        edges.push(line(fromX, fromY, midX, midY)); // split into a collinear pair
        edges.push(line(midX, midY, toX, toY));
      } else {
        edges.push(line(fromX, fromY, toX, toY));
      }
    }
    const refs = edges.map((_, index) => index);
    return irShape(edges, [fill(refs)], next() < 0.5 ? [stroke(refs)] : []);
  }

  it('produces byte-identical IR on two independent passes over the same 10\u2074 shapes', () => {
    const run = (): string[] => {
      const next = rng(0x5eed_1234);
      const digests: string[] = [];
      for (let i = 0; i < 10_000; i += 1) {
        const { shape } = simplifyShape(quantiseShape(randomShape(next)));
        digests.push(vectorShapeDigest(shape));
      }
      return digests;
    };

    const first = run();
    const second = run();
    expect(first).toHaveLength(10_000);
    expect(second).toEqual(first);
  });

  it('always emits grid-aligned, orphan-free, in-range IR', () => {
    const next = rng(0xc0ffee);
    for (let i = 0; i < 10_000; i += 1) {
      const { shape } = simplifyShape(quantiseShape(randomShape(next)));

      // Post-condition 1: simplification never knocks a point off the grid it was given on.
      expect(isQuantised(shape)).toBe(true);

      // Post-condition 2: every reference is in range, and every pooled edge is referenced.
      const seen = new Set<number>();
      for (const path of [...shape.paths, ...shape.strokes]) {
        for (const ref of path.edgeRefs) {
          expect(ref).toBeGreaterThanOrEqual(0);
          expect(ref).toBeLessThan(shape.edges.length);
          seen.add(ref);
        }
      }
      expect(seen.size).toBe(shape.edges.length);
    }
  });

  it('reaches a fixed point: simplifying an already-simplified shape changes nothing', () => {
    const next = rng(0xabcd_01);
    for (let i = 0; i < 500; i += 1) {
      const once = simplifyShape(quantiseShape(randomShape(next))).shape;
      const twice = simplifyShape(once);
      expect(twice.shape.edges).toEqual(once.edges);
      expect(twice.shape.paths).toEqual(once.paths);
      expect(twice.stats.zeroLengthDropped).toBe(0);
      expect(twice.stats.curvesFlattened).toBe(0);
    }
  });
});

// ---- T-MOD-108 ----------------------------------------------------------------------------------

describe('T-MOD-108 IR serialisation stability', () => {
  function decodedSquare() {
    return buildAndDecode({
      version: 4,
      bounds: { xMin: 0, xMax: 400, yMin: 0, yMax: 400 },
      flags: 0b0000_0100,
      fills: (w: ByteWriter) => {
        w.u8(1).u8(0x00);
        writeColor(w, 4, [10, 20, 30, 40]);
      },
      numFillBits: 1,
      records: (w) => {
        writeStyleChange(w, { moveTo: [0, 0], fill0: 1, numFillBits: 1, numLineBits: 0 });
        writeStraightEdge(w, 400, 0);
        writeCurvedEdge(w, [0, 200, 0, 200]);
        writeStraightEdge(w, -400, 0);
        writeStraightEdge(w, 0, -400);
      },
    }).shape;
  }

  it('serialises the same bytes on every decode of the same input', () => {
    const digests = new Set<string>();
    const texts = new Set<string>();
    for (let i = 0; i < 100; i += 1) {
      const shape = decodedSquare();
      texts.add(serialiseVectorShape(shape));
      digests.add(vectorShapeDigest(shape));
    }
    expect(texts.size).toBe(1);
    expect(digests.size).toBe(1);
  });

  it('pins the digest to a literal, so a drift on any platform or engine fails here', () => {
    expect(vectorShapeDigest(decodedSquare())).toBe('62af2e53e75759f8');
  });

  it("does not depend on the order the object's keys were constructed in", () => {
    const shape = decodedSquare();
    // Spread into a deliberately different insertion order; `JSON.stringify` alone would change.
    const reordered = {
      strokes: shape.strokes,
      edges: shape.edges,
      paths: shape.paths,
      styles: shape.styles,
      scalingStrokes: shape.scalingStrokes,
      nonScalingStrokes: shape.nonScalingStrokes,
      fillRule: shape.fillRule,
      recomputedBounds: shape.recomputedBounds,
      edgeBounds: shape.edgeBounds,
      bounds: shape.bounds,
      rawShape4Flags: shape.rawShape4Flags,
      version: shape.version,
      id: shape.id,
    } as VectorShape;

    expect(JSON.stringify(reordered)).not.toBe(JSON.stringify(shape));
    expect(serialiseVectorShape(reordered)).toBe(serialiseVectorShape(shape));
  });

  it('writes absent optional members as explicit nulls rather than omitting them', () => {
    const withCurve = serialiseVectorShape(irShape([curve(0, 0, 1, 1, 2, 0)]));
    const withLine = serialiseVectorShape(irShape([line(0, 0, 2, 0)]));

    expect(withLine).toContain('"controlX":null');
    expect(withLine).toContain('"controlY":null');
    expect(withCurve).toContain('"controlX":1');
    // Same key set either way, so a diff between two shapes is a diff of values only.
    const keys = (text: string): string[] => [...text.matchAll(/"([A-Za-z0-9]+)":/g)].map((m) => m[1] as string);
    expect(keys(withLine)).toEqual(keys(withCurve));
  });

  it('folds negative zero, which compares unequal but must not serialise differently', () => {
    expect(serialiseVectorShape(irShape([line(-0, -0, 2, 0)]))).toBe(serialiseVectorShape(irShape([line(0, 0, 2, 0)])));
  });

  it('excludes recordTrace: a decoded shape and an identical hand-built one agree', () => {
    const decoded = decodedSquare();
    expect(decoded.recordTrace).toBeDefined();
    const handBuilt: VectorShape = { ...decoded };
    delete (handBuilt as { recordTrace?: unknown }).recordTrace;

    expect(serialiseVectorShape(handBuilt)).toBe(serialiseVectorShape(decoded));
  });

  it('distinguishes shapes that differ only in geometry, style or winding rule', () => {
    const base = decodedSquare();
    const variants: VectorShape[] = [
      base,
      { ...base, fillRule: 'evenOdd' },
      { ...base, edges: [...base.edges.slice(1), base.edges[0] as Edge] },
      { ...base, styles: { ...base.styles, fills: [null, { kind: 'solid', color: { r: 10, g: 20, b: 30, a: 41 } }] } },
    ];
    expect(new Set(variants.map(vectorShapeDigest)).size).toBe(variants.length);
  });
});

// ---- T-MOD-110 ----------------------------------------------------------------------------------

describe('T-MOD-110 200-shape corpus', () => {
  interface CorpusEntry {
    readonly index: number;
    readonly version: ShapeVersion;
    readonly bytes: Uint8Array;
    readonly declared: { xMin: number; xMax: number; yMin: number; yMax: number };
  }

  /**
   * 200 shapes spread over all four tag versions, mixing straight and curved edges, solid and
   * gradient fills, strokes, multi-subpath figures and closed/open runs. Declared bounds are
   * computed from the same points the records are generated from, so any disagreement the decoder
   * reports is a decoder bug rather than a fixture bug.
   */
  function corpus(): CorpusEntry[] {
    const next = rng(0x1234_5678);
    const entries: CorpusEntry[] = [];
    for (let index = 0; index < 200; index += 1) {
      const version = ((index % 4) + 1) as ShapeVersion;
      const subpaths = 1 + (index % 3);
      const useCurves = index % 5 !== 0;
      const useGradient = index % 7 === 0;
      const useStroke = index % 3 === 0;

      interface Sub {
        readonly origin: readonly [number, number];
        readonly steps: readonly (readonly [number, number, number, number])[];
      }
      const subs: Sub[] = [];
      const points: (readonly [number, number])[] = [];
      for (let s = 0; s < subpaths; s += 1) {
        const originX = Math.round(next() * 2000) - 1000;
        const originY = Math.round(next() * 2000) - 1000;
        let x = originX;
        let y = originY;
        points.push([x, y]);
        const steps: (readonly [number, number, number, number])[] = [];
        const sideCount = 3 + Math.floor(next() * 4);
        for (let e = 0; e < sideCount; e += 1) {
          const dx = Math.round(next() * 600) - 300;
          const dy = Math.round(next() * 600) - 300;
          if (useCurves && e % 2 === 1) {
            const cdx = Math.round(next() * 300) - 150;
            const cdy = Math.round(next() * 300) - 150;
            points.push([x + cdx, y + cdy], [x + cdx + dx, y + cdy + dy]);
            steps.push([cdx, cdy, dx, dy]);
            x += cdx + dx;
            y += cdy + dy;
          } else {
            points.push([x + dx, y + dy]);
            steps.push([dx, dy, Number.NaN, Number.NaN]);
            x += dx;
            y += dy;
          }
        }
        subs.push({ origin: [originX, originY], steps });
      }

      const declared = {
        xMin: Math.min(...points.map(([px]) => px)),
        xMax: Math.max(...points.map(([px]) => px)),
        yMin: Math.min(...points.map(([, py]) => py)),
        yMax: Math.max(...points.map(([, py]) => py)),
      };

      const bytes = shapeFromSubs(version, index + 1, declared, subs, { useGradient, useStroke });
      entries.push({ index, version, bytes, declared });
    }
    return entries;
  }

  function shapeFromSubs(
    version: ShapeVersion,
    id: number,
    declared: { xMin: number; xMax: number; yMin: number; yMax: number },
    subs: readonly {
      origin: readonly [number, number];
      steps: readonly (readonly [number, number, number, number])[];
    }[],
    options: { useGradient: boolean; useStroke: boolean },
  ): Uint8Array {
    const gradient = options.useGradient && version >= 2;
    return shapeBytes({
      version,
      id,
      bounds: declared,
      fills: (w: ByteWriter) => {
        w.u8(1);
        if (gradient) {
          writeGradient(w, version);
        } else {
          w.u8(0x00);
          writeColor(w, version, [200, 100, 50, 255]);
        }
      },
      lines: options.useStroke
        ? (w: ByteWriter) => {
            w.u8(1).u16(20);
            if (version === 4) {
              w.bits(0, 2).bits(0, 2).bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 1);
              w.bits(0, 5).bits(0, 1).bits(0, 2);
              w.u8(0).u8(0).u8(0).u8(255);
            } else {
              writeColor(w, version, [0, 0, 0, 255]);
            }
          }
        : undefined,
      numFillBits: 1,
      numLineBits: options.useStroke ? 1 : 0,
      records: (w: ByteWriter) => {
        let penX = 0;
        let penY = 0;
        for (const [subIndex, sub] of subs.entries()) {
          writeStyleChange(w, {
            moveTo: [sub.origin[0] - penX, sub.origin[1] - penY],
            ...(subIndex === 0 ? { fill0: 1, ...(options.useStroke ? { line: 1 } : {}) } : {}),
            numFillBits: 1,
            numLineBits: options.useStroke ? 1 : 0,
          });
          penX = sub.origin[0];
          penY = sub.origin[1];
          for (const [a, b, c, d] of sub.steps) {
            if (Number.isNaN(c)) {
              writeStraightEdge(w, a, b);
              penX += a;
              penY += b;
            } else {
              writeCurvedEdge(w, [a, b, c, d]);
              penX += a + c;
              penY += b + d;
            }
          }
        }
      },
    });
  }

  function writeGradient(w: ByteWriter, version: ShapeVersion): void {
    w.u8(0x10);
    writeMatrix(w, { scale: [20, 20] });
    w.bits(0, 2).bits(0, 2).bits(2, 4);
    w.u8(0);
    writeColor(w, version, [0, 0, 0, 255]);
    w.u8(255);
    writeColor(w, version, [255, 255, 255, 255]);
  }

  it('decodes 200 shapes with no SF0180 and bounds agreeing inside 1 %', () => {
    const entries = corpus();
    expect(entries).toHaveLength(200);

    const failures: string[] = [];
    for (const entry of entries) {
      const { shape, codes } = decodeShapeBytes(entry.bytes, entry.version, 10);

      if (codes.includes('SF0180')) failures.push(`#${entry.index}: SF0180 unknown fill type`);
      if (codes.includes('SF0187')) failures.push(`#${entry.index}: SF0187 bounds disagree`);
      if (shape.recomputedBounds === null) failures.push(`#${entry.index}: bounds were not recomputed`);
      if (shape.edges.length === 0) failures.push(`#${entry.index}: decoded to no edges`);

      const recomputed = shape.recomputedBounds;
      if (recomputed !== null) {
        const declaredW = entry.declared.xMax - entry.declared.xMin;
        const declaredH = entry.declared.yMax - entry.declared.yMin;
        const dw = Math.abs(recomputed.xMax - recomputed.xMin - declaredW) / Math.max(1, declaredW);
        const dh = Math.abs(recomputed.yMax - recomputed.yMin - declaredH) / Math.max(1, declaredH);
        if (dw > 0.01 || dh > 0.01) failures.push(`#${entry.index}: bounds off by ${dw.toFixed(4)}/${dh.toFixed(4)}`);
      }
    }

    expect(failures).toEqual([]);
  });

  it('runs the whole corpus through quantise + simplify without losing a shape', () => {
    for (const entry of corpus()) {
      const { shape } = decodeShapeBytes(entry.bytes, entry.version, 10);
      const { shape: simplified } = simplifyShape(quantiseShape(shape));

      expect(isQuantised(simplified), `shape #${entry.index} stayed on the grid`).toBe(true);
      // Simplification removes redundancy, never the figure itself.
      expect(simplified.edges.length, `shape #${entry.index} kept geometry`).toBeGreaterThan(0);
      expect(simplified.edges.length).toBeLessThanOrEqual(shape.edges.length);
    }
  });

  it('serialises the corpus identically on a second pass', () => {
    const digest = (): string[] =>
      corpus().map((entry) => {
        const { shape } = decodeShapeBytes(entry.bytes, entry.version, 10);
        return vectorShapeDigest(simplifyShape(quantiseShape(shape)).shape);
      });

    expect(digest()).toEqual(digest());
  });
});
