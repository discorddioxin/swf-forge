/**
 * Production P3 shape-preview bridge: SWF VectorShape -> the reference CPU coverage rasterizer.
 * This deliberately stays in the decompiler/build boundary; @swf-forge/gfx does not import SWF types.
 */

import {
  blendPixel,
  createTarget,
  encodePng,
  fillRun,
  flattenPath,
  strokePolygons,
  type DrawPath,
  type Pt,
  type RasterImage,
  type Rgba as GfxRgba,
} from '@swf-forge/gfx';
import type { FillStyle, Mat2D, VectorShape } from '@swf-forge/swf';

export interface PreviewBitmap {
  readonly width: number;
  readonly height: number;
  /** Straight-alpha row-major RGBA8. */
  readonly data: Uint8Array;
}

export interface ShapePreview {
  readonly width: number;
  readonly height: number;
  readonly image: RasterImage;
  readonly png: Uint8Array;
}

const MAX_DIMENSION = 2048;
const TRANSPARENT: GfxRgba = { r: 0, g: 0, b: 0, a: 0 };

function invert(matrix: Mat2D, x: number, y: number): Pt | null {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  if (Math.abs(determinant) < 1e-12) return null;
  const sx = x - matrix.tx;
  const sy = y - matrix.ty;
  return {
    x: (matrix.d * sx - matrix.c * sy) / determinant,
    y: (-matrix.b * sx + matrix.a * sy) / determinant,
  };
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function spread(value: number, mode: number): number {
  if (mode === 1) {
    const reflected = ((value % 2) + 2) % 2;
    return reflected <= 1 ? reflected : 2 - reflected;
  }
  if (mode === 2) return ((value % 1) + 1) % 1;
  return clamp01(value);
}

function srgbToLinear(value: number): number {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(value: number): number {
  const normalized = clamp01(value);
  const channel = normalized <= 0.0031308 ? normalized * 12.92 : 1.055 * normalized ** (1 / 2.4) - 0.055;
  return Math.round(channel * 255);
}

function sampleGradient(style: Extract<FillStyle, { kind: 'gradient' }>, x: number, y: number): GfxRgba {
  const point = invert(style.matrix, x, y);
  const stops = [...style.gradient.stops].sort((a, b) => a.ratio - b.ratio);
  if (point === null || stops.length === 0) return TRANSPARENT;
  const focal = style.gradient.focalPoint ?? 0;
  const position = style.linear
    ? (point.x + 16384) / 32768
    : Math.hypot(point.x - (focal / 256) * 16384, point.y) / 16384;
  const t = spread(position, style.gradient.spreadMode);
  const ratio = t * 255;
  let left = stops[0];
  let right = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    const a = stops[i];
    const b = stops[i + 1];
    if (a && b && ratio >= a.ratio && ratio <= b.ratio) {
      left = a;
      right = b;
      break;
    }
  }
  if (!left || !right) return TRANSPARENT;
  const distance = right.ratio - left.ratio;
  const amount = distance <= 0 ? 0 : clamp01((ratio - left.ratio) / distance);
  const interpolate = (a: number, b: number): number =>
    style.gradient.interpolationMode === 1
      ? linearToSrgb(srgbToLinear(a) * (1 - amount) + srgbToLinear(b) * amount)
      : Math.round(a * (1 - amount) + b * amount);
  return {
    r: interpolate(left.color.r, right.color.r),
    g: interpolate(left.color.g, right.color.g),
    b: interpolate(left.color.b, right.color.b),
    a: Math.round(left.color.a * (1 - amount) + right.color.a * amount),
  };
}

function wrapped(index: number, size: number): number {
  return ((index % size) + size) % size;
}

function bitmapPixel(bitmap: PreviewBitmap, x: number, y: number, repeat: boolean): GfxRgba {
  if (repeat) {
    x = wrapped(x, bitmap.width);
    y = wrapped(y, bitmap.height);
  } else if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) {
    return TRANSPARENT;
  }
  const offset = (y * bitmap.width + x) * 4;
  return {
    r: bitmap.data[offset] ?? 0,
    g: bitmap.data[offset + 1] ?? 0,
    b: bitmap.data[offset + 2] ?? 0,
    a: bitmap.data[offset + 3] ?? 0,
  };
}

function sampleBitmap(
  style: Extract<FillStyle, { kind: 'bitmap' }>,
  x: number,
  y: number,
  bitmaps: ReadonlyMap<number, PreviewBitmap>,
): GfxRgba {
  const bitmap = bitmaps.get(style.bitmapId);
  const point = invert(style.matrix, x, y);
  if (bitmap === undefined || point === null || bitmap.width <= 0 || bitmap.height <= 0) return TRANSPARENT;
  if (!style.smoothed) return bitmapPixel(bitmap, Math.floor(point.x), Math.floor(point.y), style.repeat);
  const px = point.x - 0.5;
  const py = point.y - 0.5;
  const x0 = Math.floor(px);
  const y0 = Math.floor(py);
  const fx = px - x0;
  const fy = py - y0;
  const samples = [
    bitmapPixel(bitmap, x0, y0, style.repeat),
    bitmapPixel(bitmap, x0 + 1, y0, style.repeat),
    bitmapPixel(bitmap, x0, y0 + 1, style.repeat),
    bitmapPixel(bitmap, x0 + 1, y0 + 1, style.repeat),
  ];
  const weights = [(1 - fx) * (1 - fy), fx * (1 - fy), (1 - fx) * fy, fx * fy];
  return {
    r: Math.round(samples.reduce((sum, sample, i) => sum + sample.r * (weights[i] ?? 0), 0)),
    g: Math.round(samples.reduce((sum, sample, i) => sum + sample.g * (weights[i] ?? 0), 0)),
    b: Math.round(samples.reduce((sum, sample, i) => sum + sample.b * (weights[i] ?? 0), 0)),
    a: Math.round(samples.reduce((sum, sample, i) => sum + sample.a * (weights[i] ?? 0), 0)),
  };
}

function paintAt(style: FillStyle | null, x: number, y: number, bitmaps: ReadonlyMap<number, PreviewBitmap>): GfxRgba {
  if (style === null) return TRANSPARENT;
  if (style.kind === 'solid') return style.color;
  if (style.kind === 'gradient') return sampleGradient(style, x, y);
  return sampleBitmap(style, x, y, bitmaps);
}

function toDrawPath(
  shape: VectorShape,
  refs: readonly number[],
  closed: boolean,
  originX: number,
  originY: number,
  scale: number,
): DrawPath | null {
  const edges: DrawPath['edges'][number][] = [];
  for (const index of refs) {
    const edge = shape.edges[index];
    if (edge === undefined) continue;
    const point = (x: number, y: number): Pt => ({ x: (x - originX) * scale, y: (y - originY) * scale });
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

function maskFill(
  target: ReturnType<typeof createTarget>,
  polygons: readonly (readonly Pt[])[],
  fillRule: VectorShape['fillRule'],
  sampler: (x: number, y: number) => GfxRgba,
  originX: number,
  originY: number,
  pixelsPerTwip: number,
): void {
  const mask = createTarget(target.image.width, target.image.height, TRANSPARENT);
  fillRun(mask, polygons, fillRule, { r: 255, g: 255, b: 255, a: 255 });
  for (let y = 0; y < target.image.height; y += 1) {
    for (let x = 0; x < target.image.width; x += 1) {
      const offset = (y * target.image.width + x) * 4;
      const coverage = (mask.image.data[offset + 3] ?? 0) / 255;
      if (coverage <= 0) continue;
      const twipX = originX + (x + 0.5) / pixelsPerTwip;
      const twipY = originY + (y + 0.5) / pixelsPerTwip;
      const paint = sampler(twipX, twipY);
      blendPixel(target.image, x, y, paint, coverage * (paint.a / 255));
    }
  }
}

/** Rasterizes one static shape in its local bounds at a deterministic, capped preview resolution. */
export function renderShapePreview(
  shape: VectorShape,
  bitmaps: ReadonlyMap<number, PreviewBitmap> = new Map(),
): ShapePreview {
  const bounds = shape.bounds;
  const widthTwips = Math.max(1, bounds.xMax - bounds.xMin);
  const heightTwips = Math.max(1, bounds.yMax - bounds.yMin);
  const requestedScale = 1 / 20; // 1 preview pixel per SWF pixel
  const scale = Math.min(requestedScale, MAX_DIMENSION / widthTwips, MAX_DIMENSION / heightTwips);
  const width = Math.max(1, Math.ceil(widthTwips * scale));
  const height = Math.max(1, Math.ceil(heightTwips * scale));
  const target = createTarget(width, height, TRANSPARENT);
  const flattenOptions = { tolerance: 0.12, maxSegments: 16 };

  const fillGroups = new Map<number, Pt[][]>();
  for (const path of shape.paths) {
    const draw = toDrawPath(shape, path.edgeRefs, path.closed, bounds.xMin, bounds.yMin, scale);
    if (draw === null) continue;
    const polygon = flattenPath(draw, flattenOptions);
    const group = fillGroups.get(path.styleId) ?? [];
    group.push(polygon);
    fillGroups.set(path.styleId, group);
  }
  for (const [styleId, polygons] of [...fillGroups.entries()].sort((a, b) => a[0] - b[0])) {
    const style = shape.styles.fills[styleId] ?? null;
    maskFill(
      target,
      polygons,
      shape.fillRule,
      (x, y) => paintAt(style, x, y, bitmaps),
      bounds.xMin,
      bounds.yMin,
      scale,
    );
  }

  const strokeGroups = new Map<number, Pt[][]>();
  for (const stroke of shape.strokes) {
    const draw = toDrawPath(shape, stroke.edgeRefs, stroke.closed, bounds.xMin, bounds.yMin, scale);
    if (draw === null) continue;
    const points = flattenPath(draw, flattenOptions);
    const style = shape.styles.lines[stroke.styleId];
    if (style === null || style === undefined) continue;
    const polygons = strokePolygons(points, {
      width: style.width === 0 ? 1 : style.width * scale,
      startCap: style.caps?.start === 1 ? 'butt' : style.caps?.start === 2 ? 'square' : 'round',
      endCap: style.caps?.end === 1 ? 'butt' : style.caps?.end === 2 ? 'square' : 'round',
      join: style.join === 1 ? 'bevel' : style.join === 2 ? 'miter' : 'round',
      miterLimit: style.miterLimit ?? 3,
      closed: stroke.closed && !(style.noClose ?? false),
    });
    const group = strokeGroups.get(stroke.styleId) ?? [];
    group.push(...polygons);
    strokeGroups.set(stroke.styleId, group);
  }
  for (const [styleId, polygons] of [...strokeGroups.entries()].sort((a, b) => a[0] - b[0])) {
    const style = shape.styles.lines[styleId];
    if (!style) continue;
    const paintStyle = style.fill ?? { kind: 'solid' as const, color: style.color };
    maskFill(
      target,
      polygons,
      'nonZero',
      (x, y) => paintAt(paintStyle, x, y, bitmaps),
      bounds.xMin,
      bounds.yMin,
      scale,
    );
  }

  return { width, height, image: target.image, png: encodePng(target.image) };
}
