/**
 * Test-local adapter: decoded model → Vector IR.
 *
 * The real conversion belongs to the compiler/emitter (the runtime loads a manifest); keeping it here
 * is what lets `@swf-forge/gfx` stay free of SWF types (`IMPL-130-R001`) while the P4 gate still runs
 * end to end over a real file.
 */

import {
  TWIPS_PER_PIXEL,
  type Cxform,
  type FillStyle as SwfFill,
  type Mat2D,
  type StrokePath,
  type VectorShape,
} from '@swf-forge/swf';
import type {
  CxformLike,
  DrawPath,
  FillGeometry,
  FillRule,
  Paint,
  Pt,
  ShapeGeometry,
  StrokeGeometry,
  Transform2D,
} from '@swf-forge/gfx';
import type { Cap, Edge as GfxEdge, Join } from '@swf-forge/gfx';

const PX = (twips: number): number => twips / TWIPS_PER_PIXEL;

function toPath(shape: VectorShape, edgeRefs: readonly number[], closed: boolean): DrawPath | null {
  const edges: GfxEdge[] = [];
  for (const index of edgeRefs) {
    const edge = shape.edges[index];
    if (!edge) continue;
    const from: Pt = { x: PX(edge.fromX), y: PX(edge.fromY) };
    const to: Pt = { x: PX(edge.toX), y: PX(edge.toY) };
    if (edge.controlX !== undefined && edge.controlY !== undefined) {
      edges.push({ kind: 'quad', from, control: { x: PX(edge.controlX), y: PX(edge.controlY) }, to });
    } else {
      edges.push({ kind: 'line', from, to });
    }
  }
  return edges.length > 0 ? { edges, closed } : null;
}

function solidPaint(style: SwfFill | null, fallback: Paint): Paint {
  if (style && style.kind === 'solid') {
    return { kind: 'solid', r: style.color.r, g: style.color.g, b: style.color.b, a: style.color.a };
  }
  return fallback;
}

function capOf(value: number | undefined): Cap {
  return value === 1 ? 'butt' : value === 2 ? 'square' : 'round';
}

function joinOf(value: number | undefined): Join {
  return value === 1 ? 'bevel' : value === 2 ? 'miter' : 'round';
}

/** One decoded shape → the renderer's geometry (coordinates in stage pixels). */
export function shapeToGeometry(id: string, shape: VectorShape): ShapeGeometry {
  const fillsByStyle = new Map<number, DrawPath[]>();
  for (const path of shape.paths) {
    const draw = toPath(shape, path.edgeRefs, path.closed);
    if (!draw) continue;
    const list = fillsByStyle.get(path.styleId) ?? [];
    list.push(draw);
    fillsByStyle.set(path.styleId, list);
  }

  const fills: FillGeometry[] = [];
  for (const [styleId, paths] of [...fillsByStyle.entries()].sort((a, b) => a[0] - b[0])) {
    const style = shape.styles.fills[styleId] ?? null;
    // Gradient and bitmap fills arrive with `GFX` §6.3/§6.4; a solid fallback keeps the geometry
    // visible meanwhile instead of dropping the path.
    fills.push({
      rule: shape.fillRule as FillRule,
      paths,
      paint: solidPaint(style, { kind: 'solid', r: 128, g: 128, b: 128, a: 255 }),
    });
  }

  const strokesByStyle = new Map<number, DrawPath[]>();
  for (const stroke of shape.strokes as readonly StrokePath[]) {
    const draw = toPath(shape, stroke.edgeRefs, stroke.closed);
    if (!draw) continue;
    const list = strokesByStyle.get(stroke.styleId) ?? [];
    list.push(draw);
    strokesByStyle.set(stroke.styleId, list);
  }

  const strokes: StrokeGeometry[] = [];
  for (const [styleId, paths] of [...strokesByStyle.entries()].sort((a, b) => a[0] - b[0])) {
    const style = shape.styles.lines[styleId] ?? null;
    if (!style) continue;
    strokes.push({
      paths,
      width: PX(style.width),
      startCap: capOf(style.caps?.start),
      endCap: capOf(style.caps?.end),
      join: joinOf(style.join),
      miterLimit: (style.miterLimit ?? 768) / 256,
      paint: solidPaint(style.fill ?? null, {
        kind: 'solid',
        r: style.color.r,
        g: style.color.g,
        b: style.color.b,
        a: style.color.a,
      }),
      noClose: style.noClose ?? false,
    });
  }

  return { id, fills, strokes };
}

/** SWF matrix (twips translation) → stage-pixel transform. */
export function matrixToTransform(matrix: Mat2D): Transform2D {
  return { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, tx: PX(matrix.tx), ty: PX(matrix.ty) };
}

export function cxformToGfx(cxform: Cxform | null): CxformLike | null {
  return cxform ?? null;
}
