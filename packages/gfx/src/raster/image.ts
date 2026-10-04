/**
 * The reference raster target (`GFX` §3.2): a straight-alpha RGBA8 buffer plus one scratch coverage
 * plane.
 *
 * The GPU path composites in premultiplied alpha (`GFX-R0xx` §6.1); this CPU path is the *reference*
 * used by tests and the conformance harness to check geometry, fill rules and coverage without a
 * browser. Straight alpha is exact for the opaque-background case every SWF frame starts from.
 */

export interface RasterImage {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8ClampedArray;
}

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

export interface Rgba extends Rgb {
  readonly a: number;
}

/** Image + reusable coverage plane, so a frame does not allocate per fill run. */
export interface RasterTarget {
  readonly image: RasterImage;
  readonly coverage: Float32Array;
}

export function createTarget(width: number, height: number, background: Rgba): RasterTarget {
  const image: RasterImage = { width, height, data: new Uint8ClampedArray(width * height * 4) };
  for (let i = 0; i < width * height; i += 1) {
    image.data[i * 4] = background.r;
    image.data[i * 4 + 1] = background.g;
    image.data[i * 4 + 2] = background.b;
    image.data[i * 4 + 3] = background.a;
  }
  return { image, coverage: new Float32Array(width * height) };
}

export function readPixel(image: RasterImage, x: number, y: number): Rgba {
  const at = (y * image.width + x) * 4;
  return {
    r: image.data[at] ?? 0,
    g: image.data[at + 1] ?? 0,
    b: image.data[at + 2] ?? 0,
    a: image.data[at + 3] ?? 0,
  };
}

/** Composites one colour over one pixel with straight-alpha source-over. */
export function blendPixel(image: RasterImage, x: number, y: number, color: Rgba, alpha: number): void {
  if (alpha <= 0) return;
  const at = (y * image.width + x) * 4;
  const dstR = image.data[at] ?? 0;
  const dstG = image.data[at + 1] ?? 0;
  const dstB = image.data[at + 2] ?? 0;
  const dstA = image.data[at + 3] ?? 0;
  const sa = Math.min(1, Math.max(0, alpha));
  image.data[at] = color.r * sa + dstR * (1 - sa);
  image.data[at + 1] = color.g * sa + dstG * (1 - sa);
  image.data[at + 2] = color.b * sa + dstB * (1 - sa);
  image.data[at + 3] = Math.min(255, dstA + sa * 255);
}

export function toHex(color: number): Rgb {
  return { r: (color >> 16) & 0xff, g: (color >> 8) & 0xff, b: color & 0xff };
}
