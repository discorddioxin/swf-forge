/**
 * Production Vector IR conversion — decoded SWF geometry → the renderer's `ShapeGeometry`
 * (`IMPL-130-R001` boundary: the renderer never imports `@swf-forge/swf`, so the conversion lives
 * here, at the build-time boundary).
 *
 * This replaces the test-local adapter that used to sit in `packages/gfx/test/adapter.ts`: one
 * conversion is used by the shape previews (`assets dump`), by the static-render scene builder and
 * by the render tests, so a geometry bug cannot hide in one path (`T-GFX-071`).
 */

import type {
  Cap,
  CxformLike,
  DrawPath,
  Edge,
  FillGeometry,
  Join,
  ShapeGeometry,
  StrokeGeometry,
  Transform2D,
} from '@swf-forge/gfx';
import { TWIPS_PER_PIXEL } from '@swf-forge/swf';
import type { Cxform, FillStyle, Mat2D, StrokePath, VectorShape } from '@swf-forge/swf';

export { TWIPS_PER_PIXEL };

/** Twips → stage pixels, once, in the one place `GFX-R017` names. */
export function toPixels(twips: number): number {
  return twips / TWIPS_PER_PIXEL;
}

function toPath(
  shape: VectorShape,
  edgeRefs: readonly number[],
  closed: boolean,
  scale: number,
  originX = 0,
  originY = 0,
): DrawPath | null {
  const edges: Edge[] = [];
  for (const index of edgeRefs) {
    const edge = shape.edges[index];
    if (!edge) continue;
    const point = (x: number, y: number): { x: number; y: number } => ({
      x: (x - originX) * scale,
      y: (y - originY) * scale,
    });
    const from = point(edge.fromX, edge.fromY);
    const to = point(edge.toX, edge.toY);
    if (edge.controlX !== undefined && edge.controlY !== undefined) {
      edges.push({ kind: 'quad', from, control: point(edge.controlX, edge.controlY), to });
    } else {
      edges.push({ kind: 'line', from, to });
    }
  }
  return edges.length > 0 ? { edges, closed } : null;
}

function solidPaint(style: FillStyle | null, fallback: FillGeometry['paint']): FillGeometry['paint'] {
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

export interface GeometryOptions {
  /**
   * Scale applied to the shape's own coordinates (default: twips → px). The preview path passes
   * `scale` together with an origin so a shape can be rendered at preview resolution.
   */
  readonly scale?: number;
  readonly originX?: number;
  readonly originY?: number;
  readonly strokeScale?: number;
}

/**
 * One decoded shape → renderer geometry. Coordinates are stage pixels (`GFX-R017` step 1); style
 * arrays keep their decoded order (`GFX-R017` step 2); gradient and bitmap fills are announced by
 * their `kind` so a caller can report them rather than silently painting something else.
 */
export function shapeToGeometry(id: string, shape: VectorShape, options: GeometryOptions = {}): ShapeGeometry {
  const scale = options.scale ?? toPixels(1);
  const originX = options.originX ?? 0;
  const originY = options.originY ?? 0;
  const strokeScale = options.strokeScale ?? scale;

  const fillsByStyle = new Map<number, DrawPath[]>();
  for (const path of shape.paths) {
    const draw = toPath(shape, path.edgeRefs, path.closed, scale, originX, originY);
    if (!draw) continue;
    const list = fillsByStyle.get(path.styleId) ?? [];
    list.push(draw);
    fillsByStyle.set(path.styleId, list);
  }

  const fills: FillGeometry[] = [];
  for (const [styleId, paths] of [...fillsByStyle.entries()].sort((a, b) => a[0] - b[0])) {
    const style = shape.styles.fills[styleId] ?? null;
    // Gradient/bitmap paints arrive with `GFX` §6.3/§6.4; a mid-grey fallback keeps the geometry
    // visible meanwhile, and the caller reports it (`IMPL-060` §7 open item).
    fills.push({
      rule: shape.fillRule,
      paths,
      paint: solidPaint(style, { kind: 'solid', r: 128, g: 128, b: 128, a: 255 }),
    });
  }

  const strokesByStyle = new Map<number, DrawPath[]>();
  for (const stroke of shape.strokes as readonly StrokePath[]) {
    const draw = toPath(shape, stroke.edgeRefs, stroke.closed, scale, originX, originY);
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
      width: style.width * strokeScale,
      startCap: capOf(style.caps?.start),
      endCap: capOf(style.caps?.end),
      join: joinOf(style.join),
      miterLimit: style.miterLimit ?? 3,
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

/** SWF matrix (translation in twips) → stage-pixel transform. */
export function matrixToTransform(matrix: Mat2D): Transform2D {
  return { a: matrix.a, b: matrix.b, c: matrix.c, d: matrix.d, tx: toPixels(matrix.tx), ty: toPixels(matrix.ty) };
}

/** `CXFORM` is already unitless; the renderer's shape is identical. */
export function cxformToGfx(cxform: Cxform | null): CxformLike | null {
  return cxform ?? null;
}

/** Reports the paints the renderer cannot paint yet (gradient/bitmap), for the render manifest. */
export function unsupportedPaintCount(shape: VectorShape): number {
  let count = 0;
  for (const style of shape.styles.fills) {
    if (style && style.kind !== 'solid') count += 1;
  }
  for (const line of shape.styles.lines) {
    if (line?.fill && line.fill.kind !== 'solid') count += 1;
  }
  return count;
}
