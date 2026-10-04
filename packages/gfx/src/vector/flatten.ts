/**
 * Curve flattening — `GFX` §5.3 step 1.
 *
 * A quadratic deviates from its chord by at most `d/2`, where `d` is the distance from the control
 * point to the chord, and that deviation falls as `1/n²` with `n` segments: `n = ceil(sqrt(dev/tol))`.
 * The tolerance arrives in **device pixels** (0.1 by default), so the caller flattens *after*
 * transforming to device space; the segment count is clamped to `maxSegments` (8) so a pathological
 * curve cannot stall a frame.
 */

import type { DrawPath, Edge, Pt, QuadraticEdge } from './geometry.js';

export interface FlattenOptions {
  /** Maximum permitted deviation, in the units of the points handed in (device px after transform). */
  readonly tolerance: number;
  readonly maxSegments?: number;
}

const DEFAULT_MAX_SEGMENTS = 8;

function midpoint(a: Pt, b: Pt): Pt {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** Perpendicular distance from `p` to the line through `a` and `b` (0 when the line is degenerate). */
export function distanceToLine(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / length;
}

/** Segment count for one quadratic, per `GFX-R022`'s flatness criterion. */
export function segmentsForQuadratic(edge: QuadraticEdge, options: FlattenOptions): number {
  const max = options.maxSegments ?? DEFAULT_MAX_SEGMENTS;
  const tolerance = options.tolerance > 0 ? options.tolerance : 0.1;
  const deviation = distanceToLine(edge.control, edge.from, edge.to) / 2;
  if (deviation <= tolerance) return 1;
  const needed = Math.ceil(Math.sqrt(deviation / tolerance));
  return Math.min(max, Math.max(2, needed));
}

export function quadPointAt(edge: QuadraticEdge, t: number): Pt {
  const mt = 1 - t;
  return {
    x: mt * mt * edge.from.x + 2 * mt * t * edge.control.x + t * t * edge.to.x,
    y: mt * mt * edge.from.y + 2 * mt * t * edge.control.y + t * t * edge.to.y,
  };
}

/** Flattens one edge into points *excluding* its start (so a path is a chain without duplicates). */
export function flattenEdge(edge: Edge, options: FlattenOptions): Pt[] {
  if (edge.kind === 'line') return [edge.to];
  const segments = segmentsForQuadratic(edge, options);
  const points: Pt[] = [];
  for (let i = 1; i <= segments; i += 1) points.push(quadPointAt(edge, i / segments));
  return points;
}

/** Flattens a path into a polyline starting at the first edge's `from`. */
export function flattenPath(path: DrawPath, options: FlattenOptions): Pt[] {
  const first = path.edges[0];
  if (!first) return [];
  const points: Pt[] = [first.from];
  for (const edge of path.edges) points.push(...flattenEdge(edge, options));
  return points;
}

/** Axis-aligned bounds of a point list, or `null` for an empty list. */
export function pointBounds(points: readonly Pt[]): { x0: number; y0: number; x1: number; y1: number } | null {
  if (points.length === 0) return null;
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    if (p.x < x0) x0 = p.x;
    if (p.y < y0) y0 = p.y;
    if (p.x > x1) x1 = p.x;
    if (p.y > y1) y1 = p.y;
  }
  return { x0, y0, x1, y1 };
}

/** True when a flattened path encloses no area (`GFX-R021`: dropped for fills, no diagnostic). */
export function isDegenerate(points: readonly Pt[]): boolean {
  if (points.length < 3) return true;
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    if (!a || !b) continue;
    area += a.x * b.y - b.x * a.y;
  }
  return Math.abs(area / 2) < 1e-9;
}

export { midpoint };
