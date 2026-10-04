/**
 * Reference frame renderer — `GFX` §3.3 (pass order) and §5.2–§5.5 (fills, strokes, coverage).
 *
 * Draw order comes entirely from the caller's item list (the display list sorted by depth, `GFX`'s
 * pass 5); this function only turns geometry into pixels. Everything is done in *device* space:
 * geometry is transformed first, then flattened with the 0.1-device-pixel tolerance (`GFX-R022`) and
 * rasterised, which is also what makes non-scaling strokes (`GFX-R031`) expressible.
 */

import { blendPixel, createTarget, toHex, type RasterImage, type Rgba } from '../raster/image.js';
import { fillRun, type ClipRect } from '../raster/scanline.js';
import { strokePolygons } from '../raster/stroke.js';
import { flattenPath, isDegenerate } from '../vector/flatten.js';
import type { Paint, Pt, SolidPaint } from '../vector/geometry.js';
import { transformPoint, transformScale, type CxformLike, type DrawItem, type Transform2D } from './scene.js';

export interface FrameOptions {
  readonly width: number;
  readonly height: number;
  /** Stage background as `0xRRGGBB`; SWF frames always start from an opaque stage. */
  readonly background?: number;
  /** Flattening tolerance in device pixels (`GFX-R022`). */
  readonly tolerance?: number;
}

/** `c' = clamp(c × m/256 + a)`, the CXFORM arithmetic of `GFX-R0xx` §6.2. */
export function applyCxform(color: Rgba, cxform: CxformLike | null): Rgba {
  if (!cxform) return color;
  const channel = (value: number, mult: number, add: number): number =>
    Math.max(0, Math.min(255, Math.round((value * mult) / 256 + add)));
  return {
    r: channel(color.r, cxform.rm, cxform.ra),
    g: channel(color.g, cxform.gm, cxform.ga),
    b: channel(color.b, cxform.bm, cxform.ba),
    a: channel(color.a, cxform.am, cxform.aa),
  };
}

function transformPolyline(points: readonly Pt[], matrix: Transform2D): Pt[] {
  return points.map((p) => transformPoint(matrix, p));
}

function paintColor(paint: Paint): Rgba {
  const solid: SolidPaint = paint;
  return { r: solid.r, g: solid.g, b: solid.b, a: solid.a };
}

/** Renders draw items back-to-front onto an opaque background. */
export function renderFrame(items: readonly DrawItem[], options: FrameOptions): RasterImage {
  const background = toHex(options.background ?? 0xffffff);
  const target = createTarget(options.width, options.height, { ...background, a: 255 });
  const tolerance = options.tolerance ?? 0.1;

  for (const item of items) {
    const scale = transformScale(item.matrix);
    const clip: ClipRect | undefined = item.clip
      ? {
          x0: Math.max(0, Math.floor(item.clip.x0)),
          y0: Math.max(0, Math.floor(item.clip.y0)),
          x1: Math.min(options.width, Math.ceil(item.clip.x1)),
          y1: Math.min(options.height, Math.ceil(item.clip.y1)),
        }
      : undefined;
    if (clip && (clip.x1 <= clip.x0 || clip.y1 <= clip.y0)) continue;

    for (const fill of item.shape.fills) {
      const polygons: Pt[][] = [];
      for (const path of fill.paths) {
        const flat = transformPolyline(flattenPath(path, { tolerance }), item.matrix);
        if (flat.length >= 3 && !isDegenerate(flat)) polygons.push(flat);
      }
      if (polygons.length === 0) continue;
      fillRun(target, polygons, fill.rule, applyCxform(paintColor(fill.paint), item.cxform), {
        ...(clip ? { clip } : {}),
      });
    }

    for (const stroke of item.shape.strokes) {
      const deviceWidth = stroke.width === 0 ? 1 : stroke.width * scale;
      const polygons: Pt[][] = [];
      for (const path of stroke.paths) {
        const flat = transformPolyline(flattenPath(path, { tolerance }), item.matrix);
        polygons.push(
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
      if (polygons.length === 0) continue;
      fillRun(target, polygons, 'nonZero', applyCxform(paintColor(stroke.paint), item.cxform), {
        ...(clip ? { clip } : {}),
      });
    }
  }

  return target.image;
}

export { blendPixel };
