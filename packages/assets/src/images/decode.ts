/** Canonical build-time bitmap decoding: SWF payloads -> straight-alpha, top-left RGBA8. */

import { inflateSync } from 'node:zlib';

import { decode as decodeJpeg } from 'jpeg-js';
import { GifReader } from 'omggif';
import { PNG } from 'pngjs';

import type { BitmapAssetModel } from '@swf-forge/swf';

export interface BitmapDiagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
}

export interface CanonicalBitmap {
  readonly width: number;
  readonly height: number;
  /** Straight-alpha RGBA8, row-major, origin at the top left. */
  readonly pixels: Uint8Array;
  readonly contentType: 'jpeg' | 'png' | 'gif' | 'lossless-rgb' | 'lossless-rgba';
  readonly sourcePremultiplied: boolean;
  readonly classification: 'photo' | 'synthetic' | 'alpha-carrier';
  readonly distinctColors: number;
  readonly alphaPixels: number;
  readonly frameCount: number;
}

export interface BitmapDecodeResult {
  readonly bitmap: CanonicalBitmap;
  readonly diagnostics: readonly BitmapDiagnostic[];
}

export class BitmapDecodeError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly diagnostics: readonly BitmapDiagnostic[] = [],
  ) {
    super(message);
    this.name = 'BitmapDecodeError';
  }
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;
const GIF89A = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61] as const;
const MAX_PIXELS = 64 * 1024 * 1024;

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((byte, index) => bytes[index] === byte);
}

function dimensions(width: number, height: number): number {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    throw new BitmapDecodeError('ASSET_BITMAP_DECODE_FAILED', `invalid bitmap dimensions ${width}x${height}`);
  }
  const pixels = width * height;
  if (!Number.isSafeInteger(pixels) || pixels > MAX_PIXELS) {
    throw new BitmapDecodeError('ASSET_BITMAP_LIMIT', `bitmap ${width}x${height} exceeds ${MAX_PIXELS} pixels`);
  }
  return pixels;
}

function readU32BE(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) * 0x1000000 +
      ((bytes[offset + 1] ?? 0) << 16) +
      ((bytes[offset + 2] ?? 0) << 8) +
      (bytes[offset + 3] ?? 0)) >>
      0) >>>
    0
  );
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 24 || !startsWith(bytes, PNG_SIGNATURE)) return null;
  return { width: readU32BE(bytes, 16), height: readU32BE(bytes, 20) };
}

function gifDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 10 || !startsWith(bytes, GIF89A)) return null;
  return {
    width: (bytes[6] ?? 0) | ((bytes[7] ?? 0) << 8),
    height: (bytes[8] ?? 0) | ((bytes[9] ?? 0) << 8),
  };
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++] ?? 0;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (length < 2 || offset + length > bytes.length) return null;
    if (
      marker === 0xc0 ||
      marker === 0xc1 ||
      marker === 0xc2 ||
      marker === 0xc3 ||
      marker === 0xc5 ||
      marker === 0xc6 ||
      marker === 0xc7 ||
      marker === 0xc9 ||
      marker === 0xca ||
      marker === 0xcb ||
      marker === 0xcd ||
      marker === 0xce ||
      marker === 0xcf
    ) {
      return {
        height: ((bytes[offset + 3] ?? 0) << 8) | (bytes[offset + 4] ?? 0),
        width: ((bytes[offset + 5] ?? 0) << 8) | (bytes[offset + 6] ?? 0),
      };
    }
    offset += length;
  }
  return null;
}

function isProgressiveJpeg(bytes: Uint8Array): boolean {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    while (bytes[offset] === 0xff) offset += 1;
    const marker = bytes[offset++] ?? 0;
    if (marker === 0xc2) return true;
    if (marker === 0xd9 || marker === 0xda) return false;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    const length = ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
    if (length < 2 || offset + length > bytes.length) return false;
    offset += length;
  }
  return false;
}

function concatenate(...parts: readonly Uint8Array[]): Uint8Array {
  const length = parts.reduce((total, part) => total + part.length, 0);
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

/** The pre-SWF 8 erroneous `EOI`+`SOI` pair (`IMPL-070-R004`, SWF19 errata p.138). */
const ERRONEOUS_MARKER = [0xff, 0xd9, 0xff, 0xd8] as const;

function hasErroneousMarkerAt(bytes: Uint8Array, at: number): boolean {
  return ERRONEOUS_MARKER.every((byte, index) => bytes[at + index] === byte);
}

/**
 * Splice out every erroneous `FFD9 FFD8` pair that appears before the frame header.
 *
 * The errata describes the sequence as a *prefix*, but it also turns up in the interior of real
 * content: the pair is what `JPEGTables`' own `EOI` plus `DefineBits`' own `SOI` look like once a
 * producer has glued the two together, and Flash's decoder skips it rather than stopping. Standard
 * decoders stop at the `EOI` and return a blank or truncated image, so the pair has to go.
 *
 * The scan stops at the frame header (`SOF`) or the scan (`SOS`): past that point the bytes are
 * entropy-coded and `FF D9` inside them is data, not a marker (entropy-coded `0xFF` is stuffed as
 * `FF 00`, but restart markers and a real trailing `EOI` live there too, and rewriting that region
 * would corrupt the image).
 */
function removeErroneousMarkers(bytes: Uint8Array): { readonly bytes: Uint8Array; readonly removed: number } {
  let current = bytes;
  let removed = 0;
  let offset = 0;
  while (offset + 4 <= current.length) {
    if (hasErroneousMarkerAt(current, offset)) {
      current = concatenate(current.subarray(0, offset), current.subarray(offset + 4));
      removed += 1;
      continue;
    }
    if (current[offset] !== 0xff) break;
    const marker = current[offset + 1] ?? 0;
    // Frame header or scan: stop before the entropy-coded data.
    if (
      marker === 0xda ||
      (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc)
    ) {
      break;
    }
    // Standalone markers carry no payload.
    if (marker === 0x01 || marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    const length = ((current[offset + 2] ?? 0) << 8) | (current[offset + 3] ?? 0);
    if (length < 2 || offset + 2 + length > current.length) break;
    offset += 2 + length;
  }
  return { bytes: current, removed };
}

/**
 * Strip a `JPEGTables` payload down to the Tables/Misc segments it contributes (`IMPL-070-R005`).
 *
 * The block is a complete, image-less JPEG: `SOI`, the quantisation/Huffman tables, `EOI`. Both
 * wrappers come off before the body is glued in front of the image's scan. The trailing `EOI` is
 * removed **only if it is there** — chopping two bytes unconditionally silently truncates the last
 * table of a producer that omitted it.
 */
function tablesBody(tables: Uint8Array): Uint8Array {
  const start = tables[0] === 0xff && tables[1] === 0xd8 ? 2 : 0;
  const hasEoi = tables.length >= start + 2 && tables.at(-2) === 0xff && tables.at(-1) === 0xd9;
  return tables.subarray(start, hasEoi ? tables.length - 2 : tables.length);
}

function normalizeJpeg(
  source: Uint8Array,
  tables: Uint8Array | null,
  requiresTables: boolean,
  diagnostics: BitmapDiagnostic[],
): Uint8Array {
  const cleanedImage = removeErroneousMarkers(source);
  let image = cleanedImage.bytes;
  let removed = cleanedImage.removed;
  // The errata is ambiguous about whether the real `SOI` follows the erroneous pair
  // (`FFD9 FFD8 | FFD8 ...`, the literal reading) or whether the pair's own `FFD8` is serving as
  // it (`FFD9 | FFD8 ...`, which is what the bytes look like in some producers). Removing the pair
  // and restoring an `SOI` only when one is not already there accepts both, with no version check
  // — the errata claims this is pre-SWF 8 only, but it shows up in later files too.
  if (removed > 0 && !(image[0] === 0xff && image[1] === 0xd8)) {
    image = concatenate(Uint8Array.from([0xff, 0xd8]), image);
  }
  if (requiresTables && (tables === null || tables.length < 4)) {
    throw new BitmapDecodeError('SF0251', 'DefineBits has no JPEGTables payload');
  }
  if (image[0] !== 0xff || image[1] !== 0xd8) {
    throw new BitmapDecodeError('SF0252', 'JPEG payload has no SOI marker');
  }
  if (!image.subarray(Math.max(0, image.length - 2)).every((byte, index) => byte === (index === 0 ? 0xff : 0xd9))) {
    diagnostics.push({
      code: 'SF0255',
      severity: 'warning',
      message: 'JPEG payload is missing its EOI marker; decoder recovery attempted',
    });
  }
  if (isProgressiveJpeg(image)) {
    diagnostics.push({
      code: 'SF0256',
      severity: 'warning',
      message: 'progressive JPEG payload passed to the configured decoder',
    });
  }
  if (requiresTables) {
    // The tables block gets the same treatment: it is its own SOI/EOI-wrapped JPEG and carries the
    // erroneous pair just as often as the image does.
    const cleanedTables = removeErroneousMarkers(tables as Uint8Array);
    removed += cleanedTables.removed;
    image = concatenate(Uint8Array.from([0xff, 0xd8]), tablesBody(cleanedTables.bytes), image.subarray(2));
    // Gluing can create a fresh pair at the seam even when neither half had one.
    const cleanedMerged = removeErroneousMarkers(image);
    image = cleanedMerged.bytes;
    removed += cleanedMerged.removed;
  }
  if (removed > 0) {
    diagnostics.push({
      code: 'SF0258',
      severity: 'info',
      message: `skipped ${removed} erroneous FFD9FFD8 marker pair(s) in the JPEG stream`,
    });
  }
  return image;
}

function inflate(bytes: Uint8Array, expectedBytes: number, code: string): Uint8Array {
  try {
    return new Uint8Array(inflateSync(Buffer.from(bytes), { maxOutputLength: Math.max(1, expectedBytes + 1) }));
  } catch (error) {
    if (code === 'SF0250' && error instanceof Error && error.message.includes('larger than')) {
      throw new BitmapDecodeError(code, 'inflated lossless bitmap exceeds its padded declared size');
    }
    throw new BitmapDecodeError(code, `zlib inflate failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function aligned(value: number, boundary: number): number {
  return Math.ceil(value / boundary) * boundary;
}

function decodeLossless(model: BitmapAssetModel): CanonicalBitmap {
  const size = model.declaredSize;
  const format = model.losslessFormat;
  if (size === null || format === null) {
    throw new BitmapDecodeError('SF0260', `unknown lossless BitmapFormat ${model.bitmapFormatCode ?? 'missing'}`);
  }
  const pixelCount = dimensions(size.width, size.height);
  const bytesPerPaletteEntry = model.source === 'lossless2' ? 4 : 3;
  const paletteBytes = format === 3 ? (model.paletteSize ?? 0) * bytesPerPaletteEntry : 0;
  const bytesPerPixel = format === 3 ? 1 : format === 4 ? 2 : 4;
  const rowBytes = aligned(size.width * bytesPerPixel, 4);
  const expectedLength = paletteBytes + rowBytes * size.height;
  const inflated = inflate(model.payload, expectedLength, 'SF0250');
  if (inflated.length !== expectedLength) {
    throw new BitmapDecodeError(
      'SF0250',
      `inflated lossless data has ${inflated.length} bytes; expected ${expectedLength} including row padding`,
    );
  }
  const pixels = new Uint8Array(pixelCount * 4);
  if (format === 3) {
    const palette = new Uint8Array(model.paletteSize! * 4);
    for (let index = 0; index < model.paletteSize!; index += 1) {
      const at = index * bytesPerPaletteEntry;
      const alpha = model.source === 'lossless2' ? (inflated[at + 3] ?? 0) : 255;
      const base = index * 4;
      palette[base] = inflated[at] ?? 0;
      palette[base + 1] = inflated[at + 1] ?? 0;
      palette[base + 2] = inflated[at + 2] ?? 0;
      palette[base + 3] = alpha;
    }
    for (let y = 0; y < size.height; y += 1) {
      for (let x = 0; x < size.width; x += 1) {
        const colorIndex = inflated[paletteBytes + y * rowBytes + x] ?? 0;
        if (colorIndex >= model.paletteSize!) {
          throw new BitmapDecodeError(
            'SF0250',
            `colormap index ${colorIndex} exceeds ${model.paletteSize} palette entries`,
          );
        }
        const sourceOffset = colorIndex * 4;
        const target = (y * size.width + x) * 4;
        pixels.set(palette.subarray(sourceOffset, sourceOffset + 4), target);
      }
    }
  } else if (format === 4) {
    for (let y = 0; y < size.height; y += 1) {
      for (let x = 0; x < size.width; x += 1) {
        const offset = y * rowBytes + x * 2;
        const word = ((inflated[offset] ?? 0) << 8) | (inflated[offset + 1] ?? 0);
        const target = (y * size.width + x) * 4;
        pixels[target] = Math.floor((((word >>> 10) & 31) * 255 + 15) / 31);
        pixels[target + 1] = Math.floor((((word >>> 5) & 31) * 255 + 15) / 31);
        pixels[target + 2] = Math.floor(((word & 31) * 255 + 15) / 31);
        pixels[target + 3] = 255;
      }
    }
  } else {
    for (let y = 0; y < size.height; y += 1) {
      for (let x = 0; x < size.width; x += 1) {
        const source = y * rowBytes + x * 4;
        const target = (y * size.width + x) * 4;
        const alpha = model.source === 'lossless2' ? (inflated[source] ?? 0) : 255;
        const red = inflated[source + 1] ?? 0;
        const green = inflated[source + 2] ?? 0;
        const blue = inflated[source + 3] ?? 0;
        pixels[target] =
          model.sourcePremultiplied && alpha > 0
            ? Math.min(255, Math.floor((red * 255 + alpha / 2) / alpha))
            : model.sourcePremultiplied
              ? 0
              : red;
        pixels[target + 1] =
          model.sourcePremultiplied && alpha > 0
            ? Math.min(255, Math.floor((green * 255 + alpha / 2) / alpha))
            : model.sourcePremultiplied
              ? 0
              : green;
        pixels[target + 2] =
          model.sourcePremultiplied && alpha > 0
            ? Math.min(255, Math.floor((blue * 255 + alpha / 2) / alpha))
            : model.sourcePremultiplied
              ? 0
              : blue;
        pixels[target + 3] = alpha;
      }
    }
  }
  return canonical(
    size.width,
    size.height,
    pixels,
    format === 5 && model.source === 'lossless2' ? 'lossless-rgba' : 'lossless-rgb',
    model.sourcePremultiplied,
    1,
  );
}

function canonical(
  width: number,
  height: number,
  pixels: Uint8Array,
  contentType: CanonicalBitmap['contentType'],
  sourcePremultiplied: boolean,
  frameCount: number,
): CanonicalBitmap {
  let alphaPixels = 0;
  const colors = new Set<number>();
  for (let offset = 0; offset < pixels.length; offset += 4) {
    const r = pixels[offset] ?? 0;
    const g = pixels[offset + 1] ?? 0;
    const b = pixels[offset + 2] ?? 0;
    const a = pixels[offset + 3] ?? 0;
    if (a < 255) alphaPixels += 1;
    if (colors.size < 257) colors.add(((r << 24) | (g << 16) | (b << 8) | a) >>> 0);
  }
  const distinctColors = colors.size;
  const classification =
    alphaPixels > 0 ? 'alpha-carrier' : contentType === 'jpeg' || distinctColors > 128 ? 'photo' : 'synthetic';
  return {
    width,
    height,
    pixels,
    contentType,
    sourcePremultiplied,
    classification,
    distinctColors,
    alphaPixels,
    frameCount,
  };
}

function decodePng(bytes: Uint8Array): CanonicalBitmap {
  const dimensionsFromHeader = pngDimensions(bytes);
  if (dimensionsFromHeader === null)
    throw new BitmapDecodeError('ASSET_BITMAP_DECODE_FAILED', 'invalid PNG signature or header');
  dimensions(dimensionsFromHeader.width, dimensionsFromHeader.height);
  const png = PNG.sync.read(Buffer.from(bytes));
  if (png.width !== dimensionsFromHeader.width || png.height !== dimensionsFromHeader.height) {
    throw new BitmapDecodeError('ASSET_BITMAP_DECODE_FAILED', 'PNG decoder dimensions disagree with IHDR');
  }
  return canonical(png.width, png.height, new Uint8Array(png.data), 'png', false, 1);
}

function decodeGif(bytes: Uint8Array): CanonicalBitmap {
  const header = gifDimensions(bytes);
  if (header === null) throw new BitmapDecodeError('ASSET_BITMAP_DECODE_FAILED', 'invalid GIF89a header');
  const pixelsCount = dimensions(header.width, header.height);
  const reader = new GifReader(Buffer.from(bytes));
  const rgba = new Uint8Array(pixelsCount * 4);
  const frameCount = reader.numFrames();
  if (frameCount < 1) throw new BitmapDecodeError('ASSET_BITMAP_DECODE_FAILED', 'GIF contains no image frames');
  reader.decodeAndBlitFrameRGBA(0, rgba);
  return canonical(header.width, header.height, rgba, 'gif', false, frameCount);
}

function decodeJpegImage(
  bytes: Uint8Array,
  diagnostics: BitmapDiagnostic[],
  alpha: Uint8Array | null,
): CanonicalBitmap {
  const dimensionsFromHeader = jpegDimensions(bytes);
  if (dimensionsFromHeader === null)
    throw new BitmapDecodeError('SF0252', 'JPEG has no valid Start Of Frame dimensions');
  const expectedAlphaLength = dimensions(dimensionsFromHeader.width, dimensionsFromHeader.height);
  let decoded: ReturnType<typeof decodeJpeg>;
  try {
    decoded = decodeJpeg(Buffer.from(bytes), { useTArray: true, formatAsRGBA: true });
  } catch (error) {
    throw new BitmapDecodeError(
      'SF0252',
      `JPEG decoder failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (decoded.width !== dimensionsFromHeader.width || decoded.height !== dimensionsFromHeader.height) {
    throw new BitmapDecodeError('SF0252', 'JPEG decoder dimensions disagree with the encoded frame');
  }
  const pixels = new Uint8Array(decoded.data);
  if (alpha !== null) {
    let alphaBytes: Uint8Array | null = null;
    try {
      alphaBytes = inflate(alpha, expectedAlphaLength, 'SF0255');
    } catch (error) {
      diagnostics.push({
        code: 'SF0255',
        severity: 'warning',
        message: error instanceof Error ? error.message : String(error),
      });
    }
    if (alphaBytes !== null && alphaBytes.length !== expectedAlphaLength) {
      diagnostics.push({
        code: 'SF0253',
        severity: 'error',
        message: `JPEG alpha plane has ${alphaBytes.length} bytes; expected ${expectedAlphaLength}`,
      });
    } else if (alphaBytes !== null) {
      for (let pixel = 0; pixel < expectedAlphaLength; pixel += 1) pixels[pixel * 4 + 3] = alphaBytes[pixel] ?? 0;
    }
  }
  return canonical(decoded.width, decoded.height, pixels, 'jpeg', false, 1);
}

function decodeEmbeddedOrJpeg(
  model: BitmapAssetModel,
  jpegTables: Uint8Array | null,
  swfVersion: number,
  diagnostics: BitmapDiagnostic[],
): CanonicalBitmap {
  const payload = model.payload;
  if (startsWith(payload, PNG_SIGNATURE)) {
    if (model.alpha !== null && model.alpha.length > 0) {
      diagnostics.push({
        code: 'SF0269',
        severity: 'error',
        message: 'JPEG3/4 alpha data is ignored for embedded PNG; PNG alpha is retained',
      });
    }
    if (swfVersion < 8) {
      diagnostics.push({
        code: 'SF0203',
        severity: 'info',
        message: `embedded PNG is decoded despite SWF version ${swfVersion}`,
      });
    }
    return decodePng(payload);
  }
  if (startsWith(payload, GIF89A)) {
    if (model.alpha !== null && model.alpha.length > 0) {
      diagnostics.push({
        code: 'SF0269',
        severity: 'error',
        message: 'JPEG3/4 alpha data is ignored for embedded GIF',
      });
    }
    if (swfVersion < 8) {
      diagnostics.push({
        code: 'SF0203',
        severity: 'info',
        message: `embedded GIF is decoded despite SWF version ${swfVersion}`,
      });
    }
    return decodeGif(payload);
  }
  const jpeg = normalizeJpeg(payload, jpegTables, model.source === 'defineBits', diagnostics);
  return decodeJpegImage(jpeg, diagnostics, model.alpha);
}

/** Decode a typed bitmap model; no decoder runs during SWF parsing or model construction. */
export function decodeBitmap(
  model: BitmapAssetModel,
  options: { readonly jpegTables?: Uint8Array | null; readonly swfVersion?: number } = {},
): BitmapDecodeResult {
  const diagnostics: BitmapDiagnostic[] = [];
  let bitmap: CanonicalBitmap;
  try {
    bitmap =
      model.source === 'lossless1' || model.source === 'lossless2'
        ? decodeLossless(model)
        : decodeEmbeddedOrJpeg(model, options.jpegTables ?? null, options.swfVersion ?? 10, diagnostics);
  } catch (error) {
    if (error instanceof BitmapDecodeError) {
      throw new BitmapDecodeError(error.code, error.message, [...diagnostics, ...error.diagnostics]);
    }
    throw error;
  }
  if (model.alphaDataOffset !== null && bitmap.contentType === 'jpeg' && model.alpha === null) {
    diagnostics.push({
      code: 'SF0255',
      severity: 'warning',
      message: 'JPEG alpha data offset was present but the alpha plane is absent',
    });
  }
  return { bitmap, diagnostics };
}

/**
 * Splice a `JPEGTables` (tag 8) segment onto a `DefineBits` (tag 6) image, producing a standalone
 * JPEG stream (`IMPL-070` §3, `T-MOD-301`).
 *
 * `DefineBits` carries only the entropy-coded scan; the quantisation and Huffman tables live once
 * per file in `JPEGTables`. The merged stream is `SOI` + the tables' body (its own `SOI`/`EOI`
 * stripped) + the image's body (its `SOI` stripped) — concatenating the two files verbatim would
 * leave an `EOI` in the middle and a second `SOI` after it, which strict decoders reject.
 *
 * Also normalises the erroneous `FFD9 FFD8` marker pairs described by `IMPL-070-R004`, on either
 * half and at the seam.
 *
 * Exposed separately from `decodeBitmap` so a test can byte-compare the merged stream rather than
 * inferring it from the decoded pixels, and so a caller that wants to hand the JPEG to a different
 * decoder does not have to reimplement the splice.
 *
 * `tables === null` normalises the image alone. The "a `DefineBits` character *must* have tables"
 * rule (`SF0251`) belongs to the tag-6 caller, not to this primitive: tags 21/35/90 carry their own
 * tables and legitimately pass `null`.
 */
export function spliceJpegTables(image: Uint8Array, tables: Uint8Array | null): Uint8Array {
  return normalizeJpeg(image, tables, tables !== null, []);
}

/** Deterministic PNG output for the canonical RGBA pixel model. */
export function encodeBitmapPng(bitmap: Pick<CanonicalBitmap, 'width' | 'height' | 'pixels'>): Uint8Array {
  dimensions(bitmap.width, bitmap.height);
  if (bitmap.pixels.length !== bitmap.width * bitmap.height * 4) {
    throw new RangeError('canonical bitmap buffer does not match its dimensions');
  }
  return new Uint8Array(
    PNG.sync.write({ width: bitmap.width, height: bitmap.height, data: Buffer.from(bitmap.pixels) }),
  );
}
