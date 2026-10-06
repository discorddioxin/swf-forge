/** Bitmap tag metadata; large compressed pixel payloads remain zero-copy views. */

import { Codes } from '../diagnostics/codes.js';
import type { Cursor } from '../io/cursor.js';

export type BitmapSource = 'defineBits' | 'jpeg2' | 'jpeg3' | 'jpeg4' | 'lossless1' | 'lossless2';
export type LosslessBitmapFormat = 3 | 4 | 5;

export interface BitmapAssetModel {
  readonly id: number;
  readonly tagCode: number;
  readonly source: BitmapSource;
  /** JPEG/PNG/GIF bytes or compressed lossless pixel bytes, as a view into the SWF body. */
  readonly payload: Uint8Array;
  /** JPEG3/4 zlib alpha bytes as a view into the SWF body, else null. */
  readonly alpha: Uint8Array | null;
  /** JPEG3/4 declared image-byte count before the alpha plane. */
  readonly alphaDataOffset: number | null;
  readonly declaredSize: { readonly width: number; readonly height: number } | null;
  readonly losslessFormat: LosslessBitmapFormat | null;
  readonly bitmapFormatCode: number | null;
  /** Actual palette entries (encoded size plus one), for formats 3. */
  readonly paletteSize: number | null;
  readonly deblocking: number | null;
  readonly sourcePremultiplied: boolean;
}

function payload(c: Cursor): Uint8Array {
  const bytes = c.bytes.subarray(c.offset, c.limit);
  c.skip(c.remaining);
  return bytes;
}

/** Decode one bitmap definition header while leaving pixel decoding to `@swf-forge/assets`. */
export function decodeDefineBitmap(tagCode: number, c: Cursor): BitmapAssetModel {
  const id = c.u16();
  if (tagCode === 6) {
    return {
      id,
      tagCode,
      source: 'defineBits',
      payload: payload(c),
      alpha: null,
      alphaDataOffset: null,
      declaredSize: null,
      losslessFormat: null,
      bitmapFormatCode: null,
      paletteSize: null,
      deblocking: null,
      sourcePremultiplied: false,
    };
  }
  if (tagCode === 21 || tagCode === 35 || tagCode === 90) {
    let alphaDataOffset: number | null = null;
    let deblocking: number | null = null;
    if (tagCode === 35 || tagCode === 90) {
      alphaDataOffset = c.u32();
      if (tagCode === 90) {
        deblocking = c.u16();
        if (deblocking !== 0) {
          c.emit(Codes.IMAGE_DEBLOCK_RECORDED, 'info', `DeblockParam ${deblocking} recorded and not applied`);
        }
      }
      const start = c.offset;
      const available = c.remaining;
      const split = Math.min(alphaDataOffset, available);
      const image = c.bytes.subarray(start, start + split);
      const alpha = c.bytes.subarray(start + split, c.limit);
      if (alphaDataOffset > available) {
        c.emit(
          Codes.IMAGE_JPEG_MARKER_MISSING,
          'warning',
          `AlphaDataOffset ${alphaDataOffset} exceeds remaining JPEG/alpha payload ${available}`,
        );
      }
      c.skip(c.remaining);
      return {
        id,
        tagCode,
        source: tagCode === 35 ? 'jpeg3' : 'jpeg4',
        payload: image,
        alpha,
        alphaDataOffset,
        declaredSize: null,
        losslessFormat: null,
        bitmapFormatCode: null,
        paletteSize: null,
        deblocking,
        sourcePremultiplied: false,
      };
    }
    return {
      id,
      tagCode,
      source: 'jpeg2',
      payload: payload(c),
      alpha: null,
      alphaDataOffset,
      declaredSize: null,
      losslessFormat: null,
      bitmapFormatCode: null,
      paletteSize: null,
      deblocking,
      sourcePremultiplied: false,
    };
  }
  if (tagCode === 20 || tagCode === 36) {
    const bitmapFormatCode = c.u8();
    const width = c.u16();
    const height = c.u16();
    const encodedPaletteSize = bitmapFormatCode === 3 ? c.u8() : null;
    const recognized = bitmapFormatCode === 3 || bitmapFormatCode === 4 || bitmapFormatCode === 5;
    if (!recognized) {
      c.emit(
        Codes.IMAGE_FORMAT_UNKNOWN,
        'error',
        `unknown BitmapFormat ${bitmapFormatCode}; bitmap preserved but quarantined`,
      );
    }
    if (tagCode === 36 && bitmapFormatCode === 4) {
      c.emit(Codes.IMAGE_LOSSLESS2_FORMAT4, 'info', 'observed DefineBitsLossless2 BitmapFormat 4 decoded as PIX15');
    }
    return {
      id,
      tagCode,
      source: tagCode === 20 ? 'lossless1' : 'lossless2',
      payload: payload(c),
      alpha: null,
      alphaDataOffset: null,
      declaredSize: { width, height },
      losslessFormat: recognized ? (bitmapFormatCode as LosslessBitmapFormat) : null,
      bitmapFormatCode,
      paletteSize: encodedPaletteSize === null ? null : encodedPaletteSize + 1,
      deblocking: null,
      sourcePremultiplied: tagCode === 36 && bitmapFormatCode === 5,
    };
  }
  throw new RangeError(`tag ${tagCode} is not a bitmap definition`);
}
