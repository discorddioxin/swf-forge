/** P3 regression coverage for the shared deterministic static-geometry preparation boundary. */

import { describe, expect, it } from 'vitest';

import { interpolateMorph } from '@swf-forge/swf';
import type { MorphShapeModel, VectorShape } from '@swf-forge/swf';

import { prepareStaticShape } from '../src/geometry/prepare.js';
import { renderShapePreview } from '../src/assets/shape-preview.js';
import { morphToGeometry, shapeToGeometry } from '../src/render/vector-ir.js';

const subject: VectorShape = {
  id: 901,
  version: 3,
  rawShape4Flags: null,
  bounds: { xMin: 0, xMax: 20, yMin: 0, yMax: 20 },
  edgeBounds: null,
  recomputedBounds: null,
  fillRule: 'evenOdd',
  nonScalingStrokes: false,
  scalingStrokes: false,
  styles: {
    fills: [null, { kind: 'solid', color: { r: 20, g: 80, b: 140, a: 255 } }],
    lines: [null],
  },
  paths: [{ styleId: 1, edgeRefs: [0, 1, 2, 3, 4, 5], closed: true, implicitClose: false }],
  edges: [
    { fromX: 0.5, fromY: 0.5, toX: 0.5, toY: 0.5 }, // zero-length, removed by step 1
    { fromX: 0.5, fromY: 0.5, toX: 10.5, toY: 0.5 },
    { fromX: 10.5, fromY: 0.5, toX: 20.5, toY: 0.5 }, // merged with the previous line by step 2
    { fromX: 20.5, fromY: 0.5, toX: 20.5, toY: 20.5 },
    { fromX: 20.5, fromY: 20.5, toX: 0.5, toY: 20.5 },
    { fromX: 0.5, fromY: 20.5, toX: 0.5, toY: 0.5 },
  ],
  strokes: [],
};

describe('shared static geometry preparation', () => {
  it('T-P3-REG-007 applies morph ties-to-even at the VectorShape-to-GFX tessellation boundary', () => {
    const bounds = { xMin: 0, xMax: 40, yMin: 0, yMax: 40 };
    const edges: VectorShape['edges'] = [
      { fromX: 0, fromY: 0, toX: 40, toY: 0 },
      { fromX: 40, fromY: 0, toX: 40, toY: 40 },
      { fromX: 40, fromY: 40, toX: 0, toY: 40 },
      { fromX: 0, fromY: 40, toX: 0, toY: 0 },
    ];
    const start: VectorShape = {
      ...subject,
      id: 902,
      bounds,
      recomputedBounds: null,
      paths: [{ styleId: 1, edgeRefs: [0, 1, 2, 3], closed: true, implicitClose: false }],
      edges,
    };
    const end: VectorShape = { ...start };
    const promoted = { ...edges[0]!, controlX: 20, controlY: 4.5 };
    const pairs = edges.map((edge, index) => ({
      index,
      start: edge,
      end: edge,
      morphStart: index === 0 ? promoted : edge,
      morphEnd: index === 0 ? promoted : edge,
    }));
    const morph: MorphShapeModel = {
      id: 902,
      version: 1,
      startBounds: bounds,
      endBounds: bounds,
      startEdgeBounds: null,
      endEdgeBounds: null,
      start,
      end,
      edgeCounts: { start: 4, end: 4 },
      pairs,
      correspondence: 'index',
      flags: { nonScalingStrokes: false, scalingStrokes: false },
      offset: 0,
      offsetMatches: true,
    };

    const rational = interpolateMorph(morph, 32768);
    const morphGeometry = morphToGeometry('morph-902', morph, 32768);
    const genericStaticGeometry = shapeToGeometry('static-902', rational);
    expect(morphGeometry.fills[0]?.paths[0]?.edges[0]).toMatchObject({
      kind: 'quad',
      control: { x: 1, y: 0.2 }, // 4.5 twips rounds to 4 (even), before the static quantise/simplify adapter
    });
    expect(genericStaticGeometry.fills[0]?.paths[0]?.edges[0]).toMatchObject({
      kind: 'quad',
      control: { x: 1, y: 0.25 }, // the static half-away tie would choose 5 twips
    });
  });

  it('T-P3-REG-004 quantises before simplification for preview and SWF-to-GFX conversion', () => {
    const prepared = prepareStaticShape(subject);
    expect(prepared.simplifyStats).toMatchObject({ zeroLengthDropped: 1, collinearMerged: 1 });
    expect(prepared.shape.edges).toHaveLength(4);
    expect(
      prepared.shape.edges.every((edge) =>
        [edge.fromX, edge.fromY, edge.toX, edge.toY, edge.controlX, edge.controlY]
          .filter((coordinate): coordinate is number => coordinate !== undefined)
          .every(Number.isInteger),
      ),
    ).toBe(true);

    // Both independent raster/renderer adapters must consume the same prepared geometry; calling
    // them with the already-prepared shape is therefore an idempotent operation.
    expect(renderShapePreview(subject).png).toEqual(renderShapePreview(prepared.shape).png);
    expect(shapeToGeometry('shape-901', subject)).toEqual(shapeToGeometry('shape-901', prepared.shape));
    // Preparation is at the adapter boundary: the authoritative decoded IR is not mutated.
    expect(subject.edges).toHaveLength(6);
    expect(subject.edges[0]?.fromX).toBe(0.5);
  });
});
