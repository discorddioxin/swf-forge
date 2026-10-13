/**
 * Steady-state reference frame renderer — `GFX-R103`'s allocation discipline (`T-GFX-021`).
 *
 * `renderFrame()` (in `renderer.ts`) is the *pure* entry point: it allocates a target per call,
 * which is the right shape for a one-off comparison. This renderer is the one a loop uses: the
 * target, the coverage plane, the crossing pool and the per-shape run lists are all created once
 * and reused, and every allocation site that could still fire is paired with a counter, so a
 * regression shows up as a non-zero `allocations` count over N frames instead of as a slow drift in
 * someone's profiler.
 *
 * Allocation discipline is asserted twice in `render.test.ts`: the counters must stay flat over 600
 * frames, and the heap delta over the same run must stay under the review budget.
 */

import { applyCxformInto } from './renderer.js';
import { beginFrame, createStats, endFrame, type RenderStats } from './stats.js';
import { RunCache, type MeshOptions } from './mesh.js';
import { createTarget, type MutableRgba, type RasterImage, type RasterTarget, type Rgba } from '../raster/image.js';
import { createFillScratch, fillRun, type ClipRect, type FillScratch } from '../raster/scanline.js';
import { encodePng } from '../image/png.js';
import type { DrawItem } from './scene.js';

export interface FrameRendererOptions {
  readonly width: number;
  readonly height: number;
  /** Stage background as `0xRRGGBB`. */
  readonly background?: number;
  /** Flattening tolerance in device px (`GFX-R022`). */
  readonly tolerance?: number;
  readonly stats?: RenderStats;
  readonly runCache?: RunCache;
}

export interface FrameRenderer {
  readonly stats: RenderStats;
  readonly image: RasterImage;
  /** Renders one frame into the reused target; returns the same (mutated) image every call. */
  render(items: readonly DrawItem[]): RasterImage;
  /** PNG of the most recent frame (allocates: encoder output is a fresh buffer by contract). */
  png(): Uint8Array;
}

export function createFrameRenderer(options: FrameRendererOptions): FrameRenderer {
  const stats = options.stats ?? createStats();
  const runCache = options.runCache ?? new RunCache();
  const tolerance = options.tolerance ?? 0.1;
  const meshOptions: MeshOptions = { tolerance };
  const target: RasterTarget = createTarget(options.width, options.height, hexToRgba(options.background ?? 0xffffff));
  const scratch: FillScratch = createFillScratch();
  const background = hexToRgba(options.background ?? 0xffffff);
  stats.allocations += 1; // the one target + scratch + cache allocation this renderer ever makes

  function clear(): void {
    const data = target.image.data;
    for (let i = 0; i < data.length; i += 4) {
      data[i] = background.r;
      data[i + 1] = background.g;
      data[i + 2] = background.b;
      data[i + 3] = 255;
    }
  }

  return {
    stats,
    get image(): RasterImage {
      return target.image;
    },
    render(items: readonly DrawItem[]): RasterImage {
      beginFrame(stats);
      clear();
      const width = target.image.width;
      const height = target.image.height;

      for (const item of items) {
        const clip: ClipRect | undefined = item.clip
          ? {
              x0: Math.max(0, Math.floor(item.clip.x0)),
              y0: Math.max(0, Math.floor(item.clip.y0)),
              x1: Math.min(width, Math.ceil(item.clip.x1)),
              y1: Math.min(height, Math.ceil(item.clip.y1)),
            }
          : undefined;
        if (clip && (clip.x1 <= clip.x0 || clip.y1 <= clip.y0)) continue;

        const runs = runCache.runs(item.shape, item.matrix, meshOptions);
        for (const run of runs) {
          for (const contour of run.contours) stats.vertices += contour.length;
          applyCxformInto(expand(run.paint), item.cxform, transformedPaint);
          fillRun(target, run.contours, run.rule, transformedPaint, {
            ...(clip ? { clip } : {}),
            scratch,
          });
          stats.drawCalls += 1;
          stats.batches += 1;
        }
      }

      endFrame(stats);
      return target.image;
    },
    png(): Uint8Array {
      return encodePng(target.image);
    },
  };
}

/** Paint as a mutable `Rgba` for the CXFORM path (no object is created per frame). */
const scratchRgba: MutableRgba = { r: 0, g: 0, b: 0, a: 0 };
const transformedPaint: MutableRgba = { r: 0, g: 0, b: 0, a: 0 };

function expand(paint: { r: number; g: number; b: number; a: number }): Rgba {
  scratchRgba.r = paint.r;
  scratchRgba.g = paint.g;
  scratchRgba.b = paint.b;
  scratchRgba.a = paint.a;
  return scratchRgba;
}

function hexToRgba(value: number): Rgba {
  return { r: (value >> 16) & 0xff, g: (value >> 8) & 0xff, b: value & 0xff, a: 255 };
}
