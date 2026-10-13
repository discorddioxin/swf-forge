/**
 * Render statistics — `GFX-R103` (`renderer.stats`) and the P4 budget gates (`T-GFX-020`,
 * `T-GFX-021`, `T-GFX-050`).
 *
 * The counters are plain mutable numbers in one object so the renderers can bump them on a hot path
 * with a single increment and an off hot path with none at all: the GL backend's `enabled` flag is
 * checked once per frame, and when stats are disabled the increment sites are skipped. Every
 * allocation site in the steady-state paths is paired with a counter on purpose — a renderer that
 * allocates per frame cannot hide behind a clean heap profile in CI.
 */

export interface RenderStats {
  /** Frames rendered since creation. */
  frames: number;
  /** Draw calls issued this frame / total (per-frame value is reset by `beginFrame`). */
  drawCalls: number;
  /** Draw calls over the lifetime of the counter. */
  drawCallsTotal: number;
  /** Batches (state groups) this frame. */
  batches: number;
  /** Fill/stroke runs planned this frame, before batching. */
  runs: number;
  /** Runs a batch absorbed beyond its first (i.e. `runs - batches`): the batching win. */
  runMerges: number;
  /** Triangles this frame (GPU paths; the CPU scanline path is not triangle-based). */
  triangles: number;
  /** Triangles over the lifetime of the counter. */
  trianglesTotal: number;
  /** Vertices submitted this frame — comparable across the CPU and GPU paths (`T-GFX-072`). */
  vertices: number;
  /** Buffer/geometry uploads this frame. */
  uploads: number;
  /** Uploaded bytes this frame. */
  uploadBytes: number;
  /** Times a scratch buffer had to grow (steady state must stay 0, `T-GFX-021`). */
  bufferGrowths: number;
  /** Mesh-cache hits / misses. */
  meshCacheHits: number;
  meshCacheMisses: number;
  /** Explicitly counted allocations in the steady-state path (`T-GFX-021`). */
  allocations: number;
}

export function createStats(): RenderStats {
  return {
    frames: 0,
    drawCalls: 0,
    drawCallsTotal: 0,
    batches: 0,
    runs: 0,
    runMerges: 0,
    triangles: 0,
    trianglesTotal: 0,
    vertices: 0,
    uploads: 0,
    uploadBytes: 0,
    bufferGrowths: 0,
    meshCacheHits: 0,
    meshCacheMisses: 0,
    allocations: 0,
  };
}

/** Resets the per-frame counters; lifetime counters survive. */
export function beginFrame(stats: RenderStats): void {
  stats.drawCalls = 0;
  stats.batches = 0;
  stats.runs = 0;
  stats.runMerges = 0;
  stats.triangles = 0;
  stats.vertices = 0;
  stats.uploads = 0;
  stats.uploadBytes = 0;
}

export function endFrame(stats: RenderStats): void {
  stats.frames += 1;
  stats.drawCallsTotal += stats.drawCalls;
  stats.trianglesTotal += stats.triangles;
}

/** Snapshot helper for tests, goldens and the stats overlay (stable key order). */
export function statsSnapshot(stats: RenderStats): Readonly<RenderStats> {
  return { ...stats };
}
