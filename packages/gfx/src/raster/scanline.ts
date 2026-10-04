/**
 * Coverage rasteriser for one fill run — the reference implementation of `GFX` §5.2/§5.3.
 *
 * All polygons of a run are swept *together*, so:
 * - the fill rule (`nonzero` / `evenodd`, `GFX-R019`) is evaluated once over the whole run;
 * - self-overlapping geometry inside one run cannot double-darken (`GFX-R033` for strokes);
 * - a degenerate subpath contributes nothing and needs no special case (`GFX-R021`).
 *
 * Coverage is analytic along x and supersampled 4× along y. The GPU path computes exact per-edge
 * coverage in the fragment shader (`GFX-R024`); this path exists so geometry, fill rules and clips
 * can be asserted pixel-exactly without a browser, and both must agree within `GFX-§13.4`'s tolerance.
 */

import type { FillRule, Pt } from '../vector/geometry.js';
import { blendPixel, type RasterTarget, type Rgba } from './image.js';

export interface ClipRect {
  /** Device pixels, half-open: `[x0, x1) × [y0, y1)`. */
  readonly x0: number;
  readonly y0: number;
  readonly x1: number;
  readonly y1: number;
}

export interface FillRunOptions {
  readonly clip?: ClipRect;
  /** Extra alpha multiplier (1 by default); colour alpha is applied on top. */
  readonly alpha?: number;
}

/** Vertical samples per pixel row. */
const SUB = 4;
const WEIGHT = 1 / SUB;

interface Crossing {
  x: number;
  dir: 1 | -1;
}

/**
 * Fills one run: accumulates coverage for every polygon, then composites the colour once.
 */
export function fillRun(
  target: RasterTarget,
  polygons: readonly (readonly Pt[])[],
  rule: FillRule,
  color: Rgba,
  options: FillRunOptions = {},
): void {
  const { image, coverage } = target;
  const alphaScale = (color.a / 255) * (options.alpha ?? 1);
  if (alphaScale <= 0) return;

  const clip = options.clip ?? { x0: 0, y0: 0, x1: image.width, y1: image.height };
  const rowStart = Math.max(0, Math.floor(clip.y0));
  const rowEnd = Math.min(image.height, Math.ceil(clip.y1));
  coverage.fill(0);

  const crossings: Crossing[] = [];
  let touched = false;

  for (let sy = rowStart * SUB; sy < rowEnd * SUB; sy += 1) {
    const y = (sy + 0.5) / SUB;
    if (y < clip.y0 || y >= clip.y1) continue;
    crossings.length = 0;

    for (const polygon of polygons) {
      const n = polygon.length;
      if (n < 3) continue;
      for (let i = 0; i < n; i += 1) {
        const a = polygon[i];
        const b = polygon[(i + 1) % n];
        if (!a || !b || a.y === b.y) continue;
        const yMin = a.y < b.y ? a.y : b.y;
        const yMax = a.y < b.y ? b.y : a.y;
        if (y < yMin || y >= yMax) continue;
        const t = (y - a.y) / (b.y - a.y);
        crossings.push({ x: a.x + t * (b.x - a.x), dir: b.y > a.y ? 1 : -1 });
      }
    }

    if (crossings.length < 2) continue;
    crossings.sort((p, q) => p.x - q.x);

    let winding = 0;
    for (let i = 0; i < crossings.length - 1; i += 1) {
      const crossing = crossings[i];
      const next = crossings[i + 1];
      if (!crossing || !next) continue;
      winding += crossing.dir;
      const inside = rule === 'nonZero' ? winding !== 0 : (winding & 1) === 1;
      if (!inside) continue;
      const x0 = Math.max(crossing.x, clip.x0);
      const x1 = Math.min(next.x, clip.x1);
      if (!(x1 > x0)) continue;
      const row = Math.floor(y);
      touched = addSpan(coverage, image.width, row, x0, x1) || touched;
    }
  }

  if (!touched) return;
  for (let y = rowStart; y < rowEnd; y += 1) {
    for (let x = Math.max(0, Math.floor(clip.x0)); x < Math.min(image.width, Math.ceil(clip.x1)); x += 1) {
      const c = coverage[y * image.width + x] ?? 0;
      if (c <= 0) continue;
      blendPixel(image, x, y, color, Math.min(1, c) * alphaScale);
    }
  }
}

/** Adds an x-span at one sub-row to the coverage plane; `true` when anything was touched. */
function addSpan(coverage: Float32Array, width: number, row: number, x0: number, x1: number): boolean {
  const first = Math.floor(x0);
  const last = Math.ceil(x1) - 1;
  let touched = false;
  for (let px = first; px <= last; px += 1) {
    const overlap = Math.min(x1, px + 1) - Math.max(x0, px);
    if (overlap <= 0) continue;
    const at = row * width + px;
    coverage[at] = (coverage[at] ?? 0) + overlap * WEIGHT;
    touched = true;
  }
  return touched;
}

/** Convenience for a single closed polygon. */
export function fillPolygon(
  target: RasterTarget,
  polygon: readonly Pt[],
  rule: FillRule,
  color: Rgba,
  options: FillRunOptions = {},
): void {
  fillRun(target, [polygon], rule, color, options);
}
