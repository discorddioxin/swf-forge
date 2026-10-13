/**
 * Fill/stroke tessellation — `GFX` §5.3, decision `GFX-D03`.
 *
 * The GPU path renders fills **stencil-then-cover** (`GFX` §5.6's analytic-AA path without a
 * per-triangle ear-clip library): every contour of a run is decomposed into a triangle *fan* from
 * its first point, drawn with depth/colour writes off and the stencil doing the fill-rule
 * arithmetic (`INVERT` for even-odd, `INCR_WRAP`/`DECR_WRAP` on front/back faces for nonzero), and
 * a covering quad for the run's bounds then paints the pixels the stencil selected. Fan
 * decomposition is exact for the stencil rules: the fan's signed areas sum to the contour's, so
 * nonzero winding and even-odd parity match the reference rasteriser (`scanline.ts`) contour for
 * contour, including self-overlapping runs, without a monotone/ear-clip tessellator.
 *
 * The CPU reference renderer stays authoritative for pixels; this module produces the same geometry
 * the GPU consumes, and both are generated from one `ShapeGeometry` so they cannot drift
 * (`T-GFX-072`).
 */

import type { FillRule, Paint, Pt } from './geometry.js';

/** A run of triangles in device space, ready for one stencil pass + one cover pass. */
export interface MeshRun {
  readonly paint: Paint;
  readonly rule: FillRule;
  /** `x, y` pairs; 3 vertices per triangle, drawn as `TRIANGLES`. */
  readonly positions: Float32Array;
  /** Triangle count (`positions.length / 6`). */
  readonly triangles: number;
  /** Cover quad in device space (`TRIANGLES`, 6 vertices); the stencil test limits it to the run. */
  readonly cover: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };
}

/** Growable float buffer used by every tessellation site (growth is counted, not silent). */
export class FloatBuffer {
  #data: Float32Array;
  #length = 0;
  #growths = 0;

  constructor(capacity = 0) {
    this.#data = new Float32Array(Math.max(0, capacity));
  }

  get length(): number {
    return this.#length;
  }

  get growths(): number {
    return this.#growths;
  }

  /** Appends one point; returns the index of the appended pair. */
  push(x: number, y: number): number {
    if (this.#length + 2 > this.#data.length) this.#grow(Math.max(8, (this.#length + 2) * 2));
    const at = this.#length;
    this.#data[at] = x;
    this.#data[at + 1] = y;
    this.#length = at + 2;
    return at;
  }

  /** Appends a triangle `(a, b, c)` from point pairs already pushed. */
  pushTriangleFromPoints(a: Pt, b: Pt, c: Pt): void {
    this.push(a.x, a.y);
    this.push(b.x, b.y);
    this.push(c.x, c.y);
  }

  reset(): void {
    this.#length = 0;
  }

  view(): Float32Array {
    return this.#data.subarray(0, this.#length);
  }

  #grow(capacity: number): void {
    const next = new Float32Array(capacity);
    next.set(this.#data);
    this.#data = next;
    this.#growths += 1;
  }
}

/**
 * Fan-decomposes one closed contour into triangles (`n - 2`). Open input is treated as closed, per
 * `GFX-R018` (a path with a fill is closed for fill purposes).
 */
export function fanTriangles(points: readonly Pt[], out: FloatBuffer): number {
  if (points.length < 3) return 0;
  const first = points[0];
  if (!first) return 0;
  let triangles = 0;
  for (let i = 1; i + 1 < points.length; i += 1) {
    const b = points[i];
    const c = points[i + 1];
    if (!b || !c) continue;
    out.pushTriangleFromPoints(first, b, c);
    triangles += 1;
  }
  return triangles;
}

/** Bounds of a point list in device space, or `null` when empty. */
export function boundsOf(points: readonly Pt[]): { x0: number; y0: number; x1: number; y1: number } | null {
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

/** Expands a bounds rectangle to a cover quad (2 triangles), with a hairline floor for AA. */
export function coverQuadOf(bounds: { x0: number; y0: number; x1: number; y1: number }): Float32Array {
  const { x0, y0, x1, y1 } = bounds;
  return Float32Array.from([x0, y0, x1, y0, x0, y1, x1, y0, x1, y1, x0, y1]);
}
