/**
 * Batch planner — `GFX-R053`/`R054`/`R055`/`R056` (the draw-call discipline the P4 budget gates,
 * `T-GFX-020`/`T-GFX-050`, measure).
 *
 * The planner walks the frame's runs once (`GFX-R055`) and groups them into batches. Two legality
 * rules from `GFX-R054` are implemented:
 *
 * 1. **Same material, in order.** Runs that share a material key — colour after `CXFORM`, fill rule,
 *    scissor rect — merge while they are consecutive; consecutive merging cannot reorder anything.
 * 2. **Opaque, non-overlapping, order-independent class.** A maximal consecutive sequence of opaque
 *    runs whose *bounds do not intersect* forms a segment inside which order is unobservable
 *    (opaque, disjoint content), so the segment is grouped **by material** even when the materials
 *    alternate. Translucent runs, clip changes, overlapping runs and a full occupancy list all end
 *    the segment — the conservative reading of `GFX-R054`'s "any alpha < 1 content: no reordering"
 *    and "masks/grouped content: no reordering" rows.
 *
 * Overlap is tested on run **bounds**: a false positive only costs a merge (never correctness), which
 * is the right direction for a gate that compares pixels.
 *
 * What is deliberately not here: texture/atlas keys and the sort rule for *overlapping* opaque
 * content. Both arrive with texture atlases (P9); the material key below is one function away.
 *
 * Allocation discipline (`T-GFX-021`): batch records, their stencil buffers and the segment's bucket
 * and occupancy lists are pooled and reused; every grow is counted in `RenderStats.bufferGrowths`,
 * so a steady-state frame allocates nothing.
 */

import type { Rgba } from '../raster/image.js';
import type { ClipRect } from '../raster/scanline.js';
import type { FillRule } from '../vector/geometry.js';
import type { MeshRun } from '../vector/tessellate.js';
import { FloatBuffer } from '../vector/tessellate.js';
import type { RenderStats } from '../render/stats.js';

/** One batch: a merged stencil pass plus one cover quad, both in device space. */
export interface DrawBatch {
  readonly paint: Rgba;
  readonly rule: FillRule;
  readonly clip: ClipRect | null;
  /** Merged stencil triangles (`TRIANGLES`, 2 floats per vertex). */
  readonly positions: Float32Array;
  /** Cover quad of the batch's union bounds (`TRIANGLES`, 6 vertices). */
  readonly cover: Float32Array;
  readonly runs: number;
  readonly triangles: number;
  readonly vertices: number;
}

interface BatchState {
  readonly paint: { r: number; g: number; b: number; a: number };
  rule: FillRule;
  clip: ClipRect | null;
  readonly stencil: FloatBuffer;
  readonly cover: Float32Array;
  readonly bounds: { x0: number; y0: number; x1: number; y1: number };
  runs: number;
  triangles: number;
  vertices: number;
  opaque: boolean;
  open: boolean;
}

interface Bucket {
  key: number;
  rule: FillRule;
  batch: number;
}

/** Occupancy boxes beyond this end the segment: the planner is O(n·k), it may not become O(n²). */
const MAX_OCCUPANCY = 64;
/** Distinct materials inside one segment before the segment is flushed (keeps buffer reuse bounded). */
const MAX_BUCKETS = 8;

function sameClip(a: ClipRect | null, b: ClipRect | null): boolean {
  if (a === null || b === null) return a === b;
  return a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1;
}

/** Material key as one integer: colour bytes plus the fill rule. */
function paintKey(paint: Rgba, rule: FillRule): number {
  const colour = ((paint.r & 0xff) << 24) | ((paint.g & 0xff) << 16) | ((paint.b & 0xff) << 8) | (paint.a & 0xff);
  return (colour ^ (rule === 'evenOdd' ? 0x5a5a : 0)) >>> 0;
}

/**
 * Reusable batch planner. One instance is owned by a renderer; `begin()` starts a frame, `addRun()`
 * appends runs in draw order and `forEach()` walks the planned batches.
 */
export class BatchPlanner {
  readonly #pool: BatchState[] = [];
  readonly #buckets: Bucket[] = [];
  readonly #occupancy: number[] = [];
  readonly #stats: RenderStats | null;
  #count = 0;
  #bucketCount = 0;
  #occupancyCount = 0;
  #segmentClip: ClipRect | null = null;
  #segmentOpen = false;

  constructor(stats?: RenderStats) {
    this.#stats = stats ?? null;
  }

  /** Number of batches planned for the frame being built. */
  get count(): number {
    return this.#count;
  }

  get capacity(): number {
    return this.#pool.length;
  }

  begin(): void {
    this.#count = 0;
    this.#bucketCount = 0;
    this.#occupancyCount = 0;
    this.#segmentClip = null;
    this.#segmentOpen = false;
  }

  /**
   * Adds one run. `paint` is copied into the batch, so callers may reuse one scratch colour object
   * across runs (the GL backend does).
   */
  addRun(run: MeshRun, paint: Rgba, clip: ClipRect | null): void {
    const opaque = paint.a === 255;
    const key = paintKey(paint, run.rule);
    const { x0, y0, x1, y1 } = run.cover;
    const orderSafe =
      opaque &&
      (!this.#segmentOpen || sameClip(this.#segmentClip, clip)) &&
      this.#occupancyCount + 4 <= MAX_OCCUPANCY * 4 &&
      !this.#overlaps(x0, y0, x1, y1);

    if (!opaque) {
      // Translucent content is its own batch: it composites one run at a time (`GFX-R054`).
      this.#flushSegment();
      const single = this.#pool[this.#create(paint, run.rule, clip, false)];
      if (single) this.#append(single, run);
      return;
    }

    if (!orderSafe) {
      // Overlap, a clip change or a full occupancy list ends the segment; the run opens the next one.
      this.#flushSegment();
      this.#openSegment(clip);
    } else if (!this.#segmentOpen) {
      this.#openSegment(clip);
    }

    let bucket: Bucket | undefined;
    for (let i = 0; i < this.#bucketCount; i += 1) {
      const candidate = this.#buckets[i];
      if (candidate && candidate.key === key && candidate.rule === run.rule) {
        bucket = candidate;
        break;
      }
    }
    if (!bucket && this.#bucketCount >= MAX_BUCKETS) {
      // Only *new* materials are refused here: an existing bucket keeps absorbing runs, so a frame
      // with k materials costs k batches per segment rather than one batch per run.
      this.#flushSegment();
      this.#openSegment(clip);
    }
    if (!bucket) {
      const index = this.#create(paint, run.rule, clip, true);
      bucket = this.#buckets[this.#bucketCount] ?? { key: 0, rule: 'nonZero', batch: 0 };
      bucket.key = key;
      bucket.rule = run.rule;
      bucket.batch = index;
      this.#buckets[this.#bucketCount] = bucket;
      this.#bucketCount += 1;
    }
    const target = this.#pool[bucket.batch];
    if (target) this.#append(target, run);
    this.#occupancy[this.#occupancyCount] = x0;
    this.#occupancy[this.#occupancyCount + 1] = y0;
    this.#occupancy[this.#occupancyCount + 2] = x1;
    this.#occupancy[this.#occupancyCount + 3] = y1;
    this.#occupancyCount += 4;
  }

  /** Walks the planned batches in draw order. `callback` must not retain the batch objects. */
  forEach(callback: (batch: DrawBatch) => void): void {
    this.#flushSegment();
    let runs = 0;
    for (let i = 0; i < this.#count; i += 1) {
      const batch = this.#pool[i];
      if (!batch) continue;
      runs += batch.runs;
      const { x0, y0, x1, y1 } = batch.bounds;
      const cover = batch.cover;
      cover[0] = x0;
      cover[1] = y0;
      cover[2] = x1;
      cover[3] = y0;
      cover[4] = x0;
      cover[5] = y1;
      cover[6] = x1;
      cover[7] = y0;
      cover[8] = x1;
      cover[9] = y1;
      cover[10] = x0;
      cover[11] = y1;
      callback({
        paint: batch.paint,
        rule: batch.rule,
        clip: batch.clip,
        positions: batch.stencil.view(),
        cover,
        runs: batch.runs,
        triangles: batch.triangles,
        vertices: batch.vertices,
      });
    }
    if (this.#stats) this.#stats.runMerges += runs - this.#count;
  }

  #openSegment(clip: ClipRect | null): void {
    this.#segmentClip = clip;
    this.#segmentOpen = true;
    this.#bucketCount = 0;
    this.#occupancyCount = 0;
  }

  /** Closes the open segment; its batches keep their buffers until the next `begin()`. */
  #flushSegment(): void {
    if (!this.#segmentOpen) return;
    this.#segmentOpen = false;
    this.#bucketCount = 0;
    this.#occupancyCount = 0;
  }

  /** AABB test against the segment's occupancy list (bounds, not pixels: conservative). */
  #overlaps(x0: number, y0: number, x1: number, y1: number): boolean {
    for (let i = 0; i < this.#occupancyCount; i += 4) {
      const ox0 = this.#occupancy[i] ?? 0;
      const oy0 = this.#occupancy[i + 1] ?? 0;
      const ox1 = this.#occupancy[i + 2] ?? 0;
      const oy1 = this.#occupancy[i + 3] ?? 0;
      if (x0 < ox1 && ox0 < x1 && y0 < oy1 && oy0 < y1) return true;
    }
    return false;
  }

  #create(paint: Rgba, rule: FillRule, clip: ClipRect | null, opaque: boolean): number {
    const index = this.#count;
    const batch = this.#pool[index] ?? this.#growPool();
    batch.paint.r = paint.r;
    batch.paint.g = paint.g;
    batch.paint.b = paint.b;
    batch.paint.a = paint.a;
    batch.rule = rule;
    batch.clip = clip;
    batch.opaque = opaque;
    batch.open = true;
    batch.stencil.reset();
    batch.runs = 0;
    batch.triangles = 0;
    batch.vertices = 0;
    batch.bounds.x0 = Infinity;
    batch.bounds.y0 = Infinity;
    batch.bounds.x1 = -Infinity;
    batch.bounds.y1 = -Infinity;
    this.#count += 1;
    if (this.#stats) this.#stats.batches += 1;
    return index;
  }

  #growPool(): BatchState {
    const created: BatchState = {
      paint: { r: 0, g: 0, b: 0, a: 0 },
      rule: 'nonZero',
      clip: null,
      stencil: new FloatBuffer(1024),
      cover: new Float32Array(12),
      bounds: { x0: 0, y0: 0, x1: 0, y1: 0 },
      runs: 0,
      triangles: 0,
      vertices: 0,
      opaque: true,
      open: false,
    };
    this.#pool.push(created);
    if (this.#stats) this.#stats.allocations += 1;
    return created;
  }

  #append(batch: BatchState, run: MeshRun): void {
    const before = batch.stencil.growths;
    for (let i = 0; i < run.positions.length; i += 2) {
      batch.stencil.push(run.positions[i] ?? 0, run.positions[i + 1] ?? 0);
    }
    if (this.#stats && batch.stencil.growths !== before) this.#stats.bufferGrowths += batch.stencil.growths - before;
    const { x0, y0, x1, y1 } = run.cover;
    if (x0 < batch.bounds.x0) batch.bounds.x0 = x0;
    if (y0 < batch.bounds.y0) batch.bounds.y0 = y0;
    if (x1 > batch.bounds.x1) batch.bounds.x1 = x1;
    if (y1 > batch.bounds.y1) batch.bounds.y1 = y1;
    batch.runs += 1;
    batch.triangles += run.triangles;
    batch.vertices += run.positions.length / 2;
  }
}
