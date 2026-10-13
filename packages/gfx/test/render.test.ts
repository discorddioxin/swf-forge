/**
 * Reference renderer behaviour — `T-GFX-001` (exact pixels), `T-GFX-002` (fill rules),
 * `GFX-R019`/`R021`/`R022`/`R024`/`R029`–`R033`.
 *
 * Everything here is geometry → pixels with no SWF bytes involved: the renderer's contract is Vector
 * IR, and these tests are the ones that fail when a rule (winding, clamping, caps) drifts.
 */

import { describe, expect, it } from 'vitest';

import {
  applyCxform,
  createTarget,
  encodePng,
  fillRun,
  flattenPath,
  isDegenerate,
  readPixel,
  renderFrame,
  segmentsForQuadratic,
  strokePolygons,
  type DrawPath,
  type DrawItem,
  type Pt,
  type ShapeGeometry,
} from '@swf-forge/gfx';

const WHITE = { r: 255, g: 255, b: 255, a: 255 };
const IDENTITY_MATRIX = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
const RED = { r: 255, g: 0, b: 0, a: 255 };
const BLACK = { r: 0, g: 0, b: 0, a: 255 };

function rect(x0: number, y0: number, x1: number, y1: number): Pt[] {
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
}

function linePath(points: readonly Pt[]): DrawPath {
  const edges = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const from = points[i];
    const to = points[i + 1];
    if (from && to) edges.push({ kind: 'line' as const, from, to });
  }
  return { edges, closed: false };
}

function rectangleGeometry(id: string, x0: number, y0: number, x1: number, y1: number): ShapeGeometry {
  return {
    id,
    fills: [
      {
        rule: 'evenOdd',
        paths: [{ ...linePath([...rect(x0, y0, x1, y1), { x: x0, y: y0 }]) }],
        paint: { kind: 'solid', ...RED },
      },
    ],
    strokes: [],
  };
}

describe('fill geometry', () => {
  it('T-GFX-001: a rectangle at integer coordinates fills exactly its pixels', () => {
    const image = renderFrame(
      [
        {
          shape: rectangleGeometry('r', 10, 10, 20, 20),
          matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
          cxform: null,
          clip: null,
          depth: 0,
        },
      ],
      {
        width: 32,
        height: 32,
      },
    );
    expect(readPixel(image, 10, 10)).toEqual(RED);
    expect(readPixel(image, 19, 19)).toEqual(RED);
    expect(readPixel(image, 9, 10)).toEqual(WHITE);
    expect(readPixel(image, 20, 10)).toEqual(WHITE);
    expect(readPixel(image, 10, 20)).toEqual(WHITE);
    expect(readPixel(image, 15, 15)).toEqual(RED);
  });

  it('T-GFX-002: even-odd punches a hole where non-zero fills it', () => {
    const outer = rect(0, 0, 20, 20);
    const inner = rect(5, 5, 15, 15);
    const evenOdd = createTarget(24, 24, WHITE);
    fillRun(evenOdd, [outer, inner], 'evenOdd', BLACK);
    expect(readPixel(evenOdd.image, 10, 10)).toEqual(WHITE);
    expect(readPixel(evenOdd.image, 2, 10)).toEqual(BLACK);

    const nonZero = createTarget(24, 24, WHITE);
    fillRun(nonZero, [outer, inner], 'nonZero', BLACK);
    expect(readPixel(nonZero.image, 10, 10)).toEqual(BLACK);
    expect(readPixel(nonZero.image, 22, 22)).toEqual(WHITE);
  });

  it('GFX-R021: degenerate subpaths are dropped without changing the result', () => {
    const base = createTarget(24, 24, WHITE);
    fillRun(base, [rect(0, 0, 20, 20)], 'nonZero', BLACK);
    const withJunk = createTarget(24, 24, WHITE);
    fillRun(
      withJunk,
      [
        rect(0, 0, 20, 20),
        [
          { x: 5, y: 5 },
          { x: 5, y: 5 },
        ],
        [
          { x: 1, y: 1 },
          { x: 2, y: 2 },
          { x: 3, y: 3 },
        ],
      ],
      'nonZero',
      BLACK,
    );
    expect(Array.from(withJunk.image.data)).toEqual(Array.from(base.image.data));
    expect(
      isDegenerate([
        { x: 1, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 3 },
      ]),
    ).toBe(true);
  });

  it('applies CXFORM multiply/add per channel and clamps', () => {
    expect(
      applyCxform(
        { r: 255, g: 128, b: 0, a: 255 },
        { rm: 128, gm: 256, bm: 256, am: 256, ra: 32, ga: 0, ba: 0, aa: 0 },
      ),
    ).toEqual({
      r: 160,
      g: 128,
      b: 0,
      a: 255,
    });
  });

  it('clips draw items to a half-open device rectangle', () => {
    const image = renderFrame(
      [
        {
          shape: rectangleGeometry('r', 0, 0, 20, 20),
          matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
          cxform: null,
          clip: { x0: 10, y0: 0, x1: 20, y1: 20 },
          depth: 0,
        },
      ],
      { width: 24, height: 24 },
    );
    expect(readPixel(image, 5, 10)).toEqual(WHITE);
    expect(readPixel(image, 15, 10)).toEqual(RED);
  });
});

describe('curve flattening', () => {
  // A pathological curve: the control point sits 100 px off the chord, so the flatness criterion
  // wants 23 segments while `GFX-R022` clamps the fan to 8.
  const curve = {
    kind: 'quad' as const,
    from: { x: 0, y: 0 },
    control: { x: 50, y: 100 },
    to: { x: 100, y: 0 },
  };
  // A gentle curve whose criterion fits inside the cap.
  const gentle = {
    kind: 'quad' as const,
    from: { x: 0, y: 0 },
    control: { x: 50, y: 10 },
    to: { x: 100, y: 0 },
  };

  function worstDeviation(edge: typeof curve, tolerance: number): number {
    const points = flattenPath({ edges: [edge], closed: false }, { tolerance });
    let worst = 0;
    for (let i = 0; i <= 100; i += 1) {
      const t = i / 100;
      const mt = 1 - t;
      const px = mt * mt * edge.from.x + 2 * mt * t * edge.control.x + t * t * edge.to.x;
      const py = mt * mt * edge.from.y + 2 * mt * t * edge.control.y + t * t * edge.to.y;
      let best = Infinity;
      for (let k = 0; k < points.length - 1; k += 1) {
        const a = points[k];
        const b = points[k + 1];
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const lengthSq = dx * dx + dy * dy;
        const u = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / lengthSq));
        best = Math.min(best, Math.hypot(px - (a.x + u * dx), py - (a.y + u * dy)));
      }
      worst = Math.max(worst, best);
    }
    return worst;
  }

  it('uses fewer segments as the tolerance grows, and never more than the cap', () => {
    const coarse = segmentsForQuadratic(curve, { tolerance: 10 });
    const fine = segmentsForQuadratic(curve, { tolerance: 0.1 });
    expect(coarse).toBeLessThan(fine);
    expect(fine).toBeLessThanOrEqual(8);
    expect(fine).toBeGreaterThanOrEqual(2);
    expect(segmentsForQuadratic(gentle, { tolerance: 0.1 })).toBe(8);
    expect(segmentsForQuadratic(curve, { tolerance: 0.1, maxSegments: 3 })).toBeLessThanOrEqual(3);
  });

  it('honours the tolerance while the segment cap does not bind (GFX-R022)', () => {
    expect(worstDeviation(gentle, 0.1)).toBeLessThanOrEqual(0.1);
    // Past the cap the tolerance gives way to the frame budget, but the deviation stays bounded.
    expect(worstDeviation(curve, 0.1)).toBeLessThan(1);
  });
});

describe('strokes', () => {
  const horizontal = [
    { x: 10, y: 50 },
    { x: 90, y: 50 },
  ];

  it('expands to the authored width, with butt caps by default', () => {
    const polygons = strokePolygons(horizontal, {
      width: 4,
      startCap: 'butt',
      endCap: 'butt',
      join: 'miter',
      miterLimit: 3,
      closed: false,
    });
    const target = createTarget(100, 100, WHITE);
    fillRun(target, polygons, 'nonZero', BLACK);
    expect(readPixel(target.image, 50, 48)).toEqual(BLACK);
    expect(readPixel(target.image, 50, 51)).toEqual(BLACK);
    expect(readPixel(target.image, 50, 47)).toEqual(WHITE);
    expect(readPixel(target.image, 50, 52)).toEqual(WHITE);
    expect(readPixel(target.image, 9, 50)).toEqual(WHITE);
  });

  it('butt, square and round caps differ exactly where the spec says they do', () => {
    const render = (cap: 'butt' | 'square' | 'round'): ReturnType<typeof createTarget> => {
      const target = createTarget(100, 100, WHITE);
      fillRun(
        target,
        strokePolygons(horizontal, {
          width: 4,
          startCap: cap,
          endCap: cap,
          join: 'miter',
          miterLimit: 3,
          closed: false,
        }),
        'nonZero',
        BLACK,
      );
      return target;
    };
    const butt = render('butt');
    expect(readPixel(butt.image, 9, 50)).toEqual(WHITE); // no extension along the path
    expect(readPixel(butt.image, 10, 50)).toEqual(BLACK);

    const square = render('square');
    expect(readPixel(square.image, 8, 50)).toEqual(BLACK); // extended by half the width
    expect(readPixel(square.image, 8, 48)).toEqual(BLACK); // including the corners
    expect(readPixel(square.image, 9, 52)).toEqual(WHITE);

    // The round cap is the half-disc: the corners of the square are only partially covered, and the
    // pixels just inside the end (9, 48) are nearly covered — the signature of a curved edge.
    const round = render('round');
    expect(readPixel(round.image, 8, 50).r).toBeGreaterThan(0);
    expect(readPixel(round.image, 8, 50).r).toBeLessThan(255);
    expect(readPixel(round.image, 8, 48).r).toBeGreaterThan(0);
    expect(readPixel(round.image, 8, 48).r).toBeLessThan(240);
    expect(readPixel(round.image, 9, 48).r).toBeLessThan(60);
    expect(readPixel(round.image, 8, 52)).toEqual(WHITE);
  });

  it('T-GFX-004: a hairline (width 0) renders as exactly one device pixel row', () => {
    const hairline: ShapeGeometry = {
      id: 'hairline',
      fills: [],
      strokes: [
        {
          paths: [
            {
              ...linePath([
                { x: 10, y: 50.5 },
                { x: 90, y: 50.5 },
              ]),
              closed: false,
            },
          ],
          width: 0, // `GFX-R030`: 0 means hairline, resolved to one device pixel, not invisible
          startCap: 'butt',
          endCap: 'butt',
          join: 'miter',
          miterLimit: 3,
          paint: { kind: 'solid', ...BLACK },
          noClose: true,
        },
      ],
    };
    const items: DrawItem[] = [{ shape: hairline, matrix: IDENTITY_MATRIX, cxform: null, clip: null, depth: 1 }];
    const image = renderFrame(items, { width: 100, height: 100, background: 0xffffff });
    expect(readPixel(image, 50, 50)).toEqual(BLACK); // the single covered row
    expect(readPixel(image, 50, 49)).toEqual(WHITE); // never widened by scaling
    expect(readPixel(image, 50, 51)).toEqual(WHITE);
    expect(readPixel(image, 9, 50)).toEqual(WHITE); // butt caps: no extension along the path
    expect(readPixel(image, 89, 50)).toEqual(BLACK);
  });

  it('honours the miter limit: a low limit bevels the corner', () => {
    const corner = [
      { x: 20, y: 20 },
      { x: 60, y: 20 },
      { x: 60, y: 60 },
    ];
    const render = (miterLimit: number): ReturnType<typeof createTarget> => {
      const target = createTarget(100, 100, WHITE);
      fillRun(
        target,
        strokePolygons(corner, {
          width: 8,
          startCap: 'butt',
          endCap: 'butt',
          join: 'miter',
          miterLimit,
          closed: false,
        }),
        'nonZero',
        BLACK,
      );
      return target;
    };
    const mitered = render(3); // ratio sqrt(2) = 1.414 < 3: the corner keeps its point
    const beveled = render(1.01); // ratio > limit: the point is cut off by the chord
    expect(readPixel(mitered.image, 63, 17)).toEqual(BLACK); // the miter point is filled
    expect(readPixel(beveled.image, 63, 17)).toEqual(WHITE); // the bevel cuts it off
    expect(readPixel(mitered.image, 62, 18)).toEqual(BLACK);
    expect(readPixel(beveled.image, 62, 18).r).toBeGreaterThan(0); // the chord crosses this pixel
    expect(readPixel(beveled.image, 62, 18).r).toBeLessThan(255);
    expect(readPixel(mitered.image, 64, 17)).toEqual(WHITE); // the miter does not overshoot its tip
  });
});

describe('composition', () => {
  it('T-GFX-005: adjacent fills sharing an edge leave no seam', () => {
    const left = rectangleGeometry('left', 20, 20, 50, 60);
    const right = rectangleGeometry('right', 50, 20, 80, 60);
    const image = renderFrame(
      [
        { shape: left, matrix: IDENTITY_MATRIX, cxform: null, clip: null, depth: 1 },
        { shape: right, matrix: IDENTITY_MATRIX, cxform: null, clip: null, depth: 2 },
      ],
      { width: 100, height: 100, background: 0xffffff },
    );
    // The shared column is covered by both quads; a seam would leave the background showing.
    for (let y = 25; y < 55; y += 1) {
      expect(readPixel(image, 49, y).r).toBe(255);
      expect(readPixel(image, 50, y).r).toBe(255);
    }
    expect(readPixel(image, 19, 40)).toEqual(WHITE);
    expect(readPixel(image, 80, 40)).toEqual(WHITE);
  });
});

describe('PNG output', () => {
  it('is byte-identical across encodes and carries the right header', () => {
    const image = renderFrame(
      [
        {
          shape: rectangleGeometry('r', 4, 4, 12, 12),
          matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
          cxform: null,
          clip: null,
          depth: 0,
        },
      ],
      {
        width: 16,
        height: 12,
      },
    );
    const first = encodePng(image);
    const second = encodePng(image);
    expect(Array.from(first.subarray(0, 8))).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(first.length).toBe(second.length);
    expect(Array.from(first)).toEqual(Array.from(second));
    // IHDR width/height are big-endian at offsets 16..23.
    const width = (first[16] ?? 0) * 2 ** 24 + (first[17] ?? 0) * 2 ** 16 + (first[18] ?? 0) * 256 + (first[19] ?? 0);
    const height = (first[20] ?? 0) * 2 ** 24 + (first[21] ?? 0) * 2 ** 16 + (first[22] ?? 0) * 256 + (first[23] ?? 0);
    expect([width, height]).toEqual([16, 12]);
  });
});
