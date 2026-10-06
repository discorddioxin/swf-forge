/** Deterministic build-time raster adapter coverage; VectorShape remains the authoritative IR. */

import { describe, expect, it } from 'vitest';

import { readPixel } from '@swf-forge/gfx';
import type { FillStyle, VectorShape } from '@swf-forge/swf';

import { renderShapePreview } from '../src/assets/shape-preview.js';

const bounds = { xMin: 0, xMax: 40, yMin: 0, yMax: 40 };
const matrix = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };
const edges: VectorShape['edges'] = [
  { fromX: 0, fromY: 0, toX: 40, toY: 0 },
  { fromX: 40, fromY: 0, toX: 40, toY: 40 },
  { fromX: 40, fromY: 40, toX: 0, toY: 40 },
  { fromX: 0, fromY: 40, toX: 0, toY: 0 },
];

function square(fill: FillStyle): VectorShape {
  return {
    id: 1,
    version: 3,
    rawShape4Flags: null,
    bounds,
    edgeBounds: null,
    recomputedBounds: bounds,
    fillRule: 'nonZero',
    nonScalingStrokes: false,
    scalingStrokes: false,
    styles: { fills: [null, fill], lines: [null] },
    paths: [{ styleId: 1, edgeRefs: [0, 1, 2, 3], closed: true, implicitClose: false }],
    edges,
    strokes: [],
  };
}

describe('production shape preview adapter', () => {
  it('rasterizes solid fills and emits byte-identical PNGs without replacing VectorShape', () => {
    const shape = square({ kind: 'solid', color: { r: 240, g: 24, b: 12, a: 255 } });
    const first = renderShapePreview(shape);
    const second = renderShapePreview(shape);

    expect(first.width).toBe(2);
    expect(first.height).toBe(2);
    expect(first.png.slice(0, 8)).toEqual(Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(first.png).toEqual(second.png);
    expect(readPixel(first.image, 0, 0)).toEqual({ r: 240, g: 24, b: 12, a: 255 });
    expect(shape.edges).toHaveLength(4);
    expect(shape.paths[0]?.edgeRefs).toEqual([0, 1, 2, 3]);
  });

  it('samples gradient fills in local coordinates', () => {
    const preview = renderShapePreview(
      square({
        kind: 'gradient',
        linear: true,
        matrix,
        gradient: {
          spreadMode: 0,
          interpolationMode: 0,
          stops: [
            { ratio: 0, color: { r: 255, g: 0, b: 0, a: 255 } },
            { ratio: 255, color: { r: 0, g: 0, b: 255, a: 255 } },
          ],
        },
      }),
    );
    const center = readPixel(preview.image, 1, 1);
    expect(center.a).toBe(255);
    expect(center.r).toBeGreaterThan(120);
    expect(center.r).toBeLessThan(136);
    expect(center.b).toBeGreaterThan(120);
    expect(center.b).toBeLessThan(136);
  });

  it('samples repeated bitmap fills using their decoded bitmap matrix', () => {
    const bitmap: FillStyle = {
      kind: 'bitmap',
      bitmapId: 9,
      repeat: true,
      smoothed: false,
      matrix: { a: 20, b: 0, c: 0, d: 20, tx: 0, ty: 0 },
    };
    const preview = renderShapePreview(
      square(bitmap),
      new Map([
        [
          9,
          {
            width: 2,
            height: 2,
            data: Uint8Array.from([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 255, 255, 255, 255]),
          },
        ],
      ]),
    );
    expect(readPixel(preview.image, 0, 0)).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    expect(readPixel(preview.image, 1, 0)).toEqual({ r: 0, g: 255, b: 0, a: 255 });
    expect(readPixel(preview.image, 0, 1)).toEqual({ r: 0, g: 0, b: 255, a: 255 });
    expect(readPixel(preview.image, 1, 1)).toEqual({ r: 255, g: 255, b: 255, a: 255 });
  });
});
