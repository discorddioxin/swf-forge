/**
 * Geometry → device-space draw runs. This is the single conversion both renderers consume: the CPU
 * reference rasteriser sweeps `ShapeRun.contours` with `raster/scanline.ts`, and the WebGL2 backend
 * fan-tessellates the same contours into the stencil-then-cover runs of `vector/tessellate.ts`
 * (`T-GFX-072`: one geometry, two backends — a divergence is a renderer bug, not an authoring
 * difference).
 *
 * Everything here is device space: points are transformed first and flattened against the device
 * tolerance (`GFX-R022`), exactly as the reference renderer does.
 */

import { flattenPath, isDegenerate } from '../vector/flatten.js';
import type { FillRule, Paint, Pt, ShapeGeometry } from '../vector/geometry.js';
import { boundsOf, coverQuadOf, fanTriangles, FloatBuffer, type MeshRun } from '../vector/tessellate.js';
import { strokePolygons } from '../raster/stroke.js';
import { transformPoint, transformScale, type Transform2D } from './scene.js';

export interface MeshOptions {
  /** Flattening tolerance in device px (`GFX-R022`, 0.1 default). */
  readonly tolerance?: number;
}

export const DEFAULT_TOLERANCE = 0.1;

/** One fill or stroke run in device space, before triangulation. */
export interface ShapeRun {
  readonly paint: Paint;
  readonly rule: FillRule;
  /** Closed-by-convention contours; strokes arrive pre-expanded as convex quads (`GFX-R029`). */
  readonly contours: readonly (readonly Pt[])[];
}

function transformed(points: readonly Pt[], matrix: Transform2D): Pt[] {
  return points.map((p) => transformPoint(matrix, p));
}

/**
 * Builds the run list for one placed shape. Fills come first (one run per fill style, in style
 * order), then strokes (one run per line style, unioned by the nonzero rule), matching the
 * reference renderer's paint order.
 */
export function buildShapeRuns(shape: ShapeGeometry, matrix: Transform2D, options: MeshOptions = {}): ShapeRun[] {
  const tolerance = options.tolerance ?? DEFAULT_TOLERANCE;
  const scale = transformScale(matrix);
  const runs: ShapeRun[] = [];

  for (const fill of shape.fills) {
    const contours: Pt[][] = [];
    for (const path of fill.paths) {
      const flat = transformed(flattenPath(path, { tolerance }), matrix);
      if (flat.length >= 3 && !isDegenerate(flat)) contours.push(flat);
    }
    if (contours.length > 0) runs.push({ paint: fill.paint, rule: fill.rule, contours });
  }

  for (const stroke of shape.strokes) {
    const contours: Pt[][] = [];
    const deviceWidth = stroke.width === 0 ? 1 : stroke.width * scale;
    for (const path of stroke.paths) {
      const flat = transformed(flattenPath(path, { tolerance }), matrix);
      contours.push(
        ...strokePolygons(flat, {
          width: deviceWidth,
          startCap: stroke.startCap,
          endCap: stroke.endCap,
          join: stroke.join,
          miterLimit: stroke.miterLimit,
          closed: path.closed && !stroke.noClose,
        }),
      );
    }
    // Strokes are a union of convex quads: nonzero is the rule the reference renderer uses.
    if (contours.length > 0) runs.push({ paint: stroke.paint, rule: 'nonZero', contours });
  }

  return runs;
}

/** Tessellates runs into the GPU form (fan triangles + cover quad). */
export function meshRunsFrom(runs: readonly ShapeRun[], scratch = new FloatBuffer(256)): MeshRun[] {
  const meshes: MeshRun[] = [];
  for (const run of runs) {
    scratch.reset();
    const points: Pt[] = [];
    let triangles = 0;
    for (const contour of run.contours) {
      if (contour.length < 3) continue;
      triangles += fanTriangles(contour, scratch);
      points.push(...contour);
    }
    if (triangles === 0) continue;
    const bounds = boundsOf(points);
    if (!bounds) continue;
    // `view()` is a subarray view of the shared scratch; copy before the next run resets it.
    meshes.push({
      paint: run.paint,
      rule: run.rule,
      positions: scratch.view().slice(),
      triangles,
      cover: { x0: bounds.x0, y0: bounds.y0, x1: bounds.x1, y1: bounds.y1 },
    });
  }
  return meshes;
}

/** Convenience: geometry straight to GPU meshes (used by tests and the stats counters). */
export function buildMeshRuns(shape: ShapeGeometry, matrix: Transform2D, options: MeshOptions = {}): MeshRun[] {
  return meshRunsFrom(buildShapeRuns(shape, matrix, options));
}

/** Cover quad for a run (kept here so the GL backend imports one geometry module). */
export function coverQuad(run: MeshRun): Float32Array {
  return coverQuadOf(run.cover);
}

/**
 * Run cache keyed by `(shape id, transform)` — the tessellation cache of `GFX` §14.1 reduced to
 * what a static (no-script) scene needs. Hits, misses and evictions are counted for the budget
 * gates; the CPU renderer and the GL backend hold their own cache shape (runs vs meshes).
 */
export class RunCache {
  #entries = new Map<string, ShapeRun[]>();
  #capacity: number;
  #evictions = 0;
  #hits = 0;
  #misses = 0;

  constructor(capacity = 512) {
    this.#capacity = capacity;
  }

  get size(): number {
    return this.#entries.size;
  }

  get evictions(): number {
    return this.#evictions;
  }

  get hits(): number {
    return this.#hits;
  }

  get misses(): number {
    return this.#misses;
  }

  /** Runs for `(shape, matrix)`; identical inputs return the cached array (no allocation). */
  runs(shape: ShapeGeometry, matrix: Transform2D, options: MeshOptions = {}): ShapeRun[] {
    const key = cacheKey(shape.id, matrix);
    const hit = this.#entries.get(key);
    if (hit) {
      this.#hits += 1;
      return hit;
    }
    this.#misses += 1;
    const runs = buildShapeRuns(shape, matrix, options);
    if (this.#entries.size >= this.#capacity) {
      const oldest = this.#entries.keys().next();
      if (!oldest.done) {
        this.#entries.delete(oldest.value);
        this.#evictions += 1;
      }
    }
    this.#entries.set(key, runs);
    return runs;
  }

  clear(): void {
    this.#entries.clear();
  }
}

/** Mesh cache: `RunCache` + tessellation, for the GL backend's upload path. */
export class MeshCache {
  #runs = new RunCache();
  #meshes = new Map<string, MeshRun[]>();
  #scratch = new FloatBuffer(256);
  #hits = 0;
  #misses = 0;

  get hits(): number {
    return this.#hits;
  }

  get misses(): number {
    return this.#misses;
  }

  get evictions(): number {
    return this.#runs.evictions;
  }

  get size(): number {
    return this.#meshes.size;
  }

  runs(shape: ShapeGeometry, matrix: Transform2D, options: MeshOptions = {}): MeshRun[] {
    const key = cacheKey(shape.id, matrix);
    const hit = this.#meshes.get(key);
    if (hit) {
      this.#hits += 1;
      return hit;
    }
    this.#misses += 1;
    const meshes = meshRunsFrom(this.#runs.runs(shape, matrix, options), this.#scratch);
    this.#meshes.set(key, meshes);
    return meshes;
  }

  clear(): void {
    this.#runs.clear();
    this.#meshes.clear();
  }
}

/** Stable cache key for `(shape, transform)`. Coordinates are quantised to 1/1000 px. */
export function cacheKey(shapeId: string, matrix: Transform2D): string {
  const q = (value: number): string => (Math.round(value * 1000) / 1000).toFixed(3);
  return `${shapeId}|${q(matrix.a)},${q(matrix.b)},${q(matrix.c)},${q(matrix.d)},${q(matrix.tx)},${q(matrix.ty)}`;
}
