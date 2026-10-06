/** T-AST-001–004: frozen image parity vectors against independently encoded payloads. */

import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { encode as encodeJpeg } from 'jpeg-js';
import type { BitmapAssetModel } from '@swf-forge/swf';
import { BitmapDecodeError, decodeBitmap, encodeBitmapPng } from '../src/index.js';

function bitmap(overrides: Partial<BitmapAssetModel> & Pick<BitmapAssetModel, 'source' | 'payload'>): BitmapAssetModel {
  return {
    id: 1,
    tagCode: 21,
    alpha: null,
    alphaDataOffset: null,
    declaredSize: null,
    losslessFormat: null,
    bitmapFormatCode: null,
    paletteSize: null,
    deblocking: null,
    sourcePremultiplied: false,
    ...overrides,
  };
}

const PROGRESSIVE_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wgARCAACAAIDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABUBAQEAAAAAAAAAAAAAAAAAAAUH/9oADAMBAAIQAxAAAAEwZx//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAn//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AX//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AX//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/An//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IX//2gAMAwEAAgADAAAAEH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==',
  'base64',
);

function splitJpegTables(jpeg: Uint8Array): { tables: Uint8Array; image: Uint8Array } {
  const tableSegments: Uint8Array[] = [];
  const imageSegments: Uint8Array[] = [];
  let offset = 2;
  while (offset + 4 < jpeg.length) {
    if (jpeg[offset] !== 0xff) throw new Error(`invalid JPEG marker at ${offset}`);
    const start = offset;
    while (jpeg[offset] === 0xff) offset += 1;
    const marker = jpeg[offset++] ?? 0;
    if (marker === 0xd9) {
      imageSegments.push(jpeg.subarray(start, offset));
      break;
    }
    if (marker === 0xda) {
      imageSegments.push(jpeg.subarray(start));
      break;
    }
    const length = ((jpeg[offset] ?? 0) << 8) | (jpeg[offset + 1] ?? 0);
    const end = offset + length;
    const segment = jpeg.subarray(start, end);
    if (marker === 0xdb || marker === 0xc4 || marker === 0xdd) tableSegments.push(segment);
    else imageSegments.push(segment);
    offset = end;
  }
  const tableLength = 4 + tableSegments.reduce((sum, part) => sum + part.length, 0);
  const tables = new Uint8Array(tableLength);
  tables.set([0xff, 0xd8]);
  let tableOffset = 2;
  for (const part of tableSegments) {
    tables.set(part, tableOffset);
    tableOffset += part.length;
  }
  tables.set([0xff, 0xd9], tableOffset);
  const imageLength = 4 + imageSegments.reduce((sum, part) => sum + part.length, 0);
  const image = new Uint8Array(imageLength);
  image.set([0xff, 0xd8]);
  let imageOffset = 2;
  for (const part of imageSegments) {
    image.set(part, imageOffset);
    imageOffset += part.length;
  }
  image.set([0xff, 0xd9], imageOffset);
  return { tables, image };
}

describe('canonical bitmap decoder', () => {
  it('T-AST-001: DefineBits + JPEGTables splice yields the same RGBA pixels as a complete JPEG', () => {
    const jpeg = encodeJpeg(
      {
        width: 2,
        height: 1,
        data: Uint8Array.from([240, 10, 20, 255, 20, 220, 40, 255]),
      },
      100,
    ).data;
    const direct = decodeBitmap(bitmap({ source: 'jpeg2', tagCode: 21, payload: jpeg })).bitmap;
    const split = splitJpegTables(jpeg);
    const spliced = decodeBitmap(bitmap({ source: 'defineBits', tagCode: 6, payload: split.image }), {
      jpegTables: split.tables,
    }).bitmap;
    expect(spliced.width).toBe(direct.width);
    expect(spliced.height).toBe(direct.height);
    expect(spliced.pixels).toEqual(direct.pixels);
  });

  it('reports DefineBits without a JPEGTables segment as SF0251', () => {
    const jpeg = encodeJpeg({ width: 1, height: 1, data: Uint8Array.from([40, 80, 120, 255]) }, 100).data;
    const imageOnly = splitJpegTables(jpeg).image;
    expect(() => decodeBitmap(bitmap({ source: 'defineBits', tagCode: 6, payload: imageOnly }))).toThrowError(
      expect.objectContaining({ code: 'SF0251' }),
    );
  });

  it('T-AST-002: JPEG3 alpha composes as straight coverage without premultiplying JPEG colour', () => {
    const jpeg = encodeJpeg({ width: 1, height: 1, data: Uint8Array.from([180, 90, 30, 255]) }, 100).data;
    const direct = decodeBitmap(bitmap({ source: 'jpeg2', tagCode: 21, payload: jpeg })).bitmap;
    const alpha = new Uint8Array(deflateSync(Uint8Array.from([128])));
    const withAlpha = decodeBitmap(
      bitmap({
        source: 'jpeg3',
        tagCode: 35,
        payload: jpeg,
        alpha,
        alphaDataOffset: jpeg.length,
      }),
    ).bitmap;
    expect(withAlpha.pixels.subarray(0, 3)).toEqual(direct.pixels.subarray(0, 3));
    expect(withAlpha.pixels[3]).toBe(128);
    expect(withAlpha.sourcePremultiplied).toBe(false);
  });

  it('T-AST-003: Lossless2 premultiplied ARGB is un-premultiplied into canonical straight-alpha RGBA', () => {
    const compressed = new Uint8Array(deflateSync(Uint8Array.from([128, 64, 32, 16])));
    const decoded = decodeBitmap(
      bitmap({
        source: 'lossless2',
        tagCode: 36,
        payload: compressed,
        declaredSize: { width: 1, height: 1 },
        losslessFormat: 5,
        bitmapFormatCode: 5,
        sourcePremultiplied: true,
      }),
    ).bitmap;
    expect(Array.from(decoded.pixels)).toEqual([128, 64, 32, 128]);
    expect(decoded.sourcePremultiplied).toBe(true);
  });

  it('T-AST-004: lossless colormap padding is applied per row, not at the end of the image', () => {
    const raw = Uint8Array.from([
      255,
      0,
      0,
      0,
      255,
      0, // two RGB palette entries
      0,
      1,
      0,
      99, // row 0 + one padding byte
      1,
      0,
      1,
      88, // row 1 + one padding byte
    ]);
    const decoded = decodeBitmap(
      bitmap({
        source: 'lossless1',
        tagCode: 20,
        payload: new Uint8Array(deflateSync(raw)),
        declaredSize: { width: 3, height: 2 },
        losslessFormat: 3,
        bitmapFormatCode: 3,
        paletteSize: 2,
      }),
    ).bitmap;
    expect(Array.from(decoded.pixels)).toEqual([
      255, 0, 0, 255, 0, 255, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255, 255, 0, 0, 255, 0, 255, 0, 255,
    ]);
    expect(encodeBitmapPng(decoded)).toEqual(encodeBitmapPng(decoded));
  });

  it('T-MOD-309: applies row padding to indexed, PIX15, PIX24, and ARGB data including 253-pixel rows', () => {
    const indexedRaw = new Uint8Array(3 + 256 * 2);
    indexedRaw.set([255, 0, 0]); // one RGB palette entry
    for (let row = 0; row < 2; row += 1) indexedRaw.fill(0, 3 + row * 256, 3 + row * 256 + 253);
    const indexed = decodeBitmap(
      bitmap({
        source: 'lossless1',
        tagCode: 20,
        payload: new Uint8Array(deflateSync(indexedRaw)),
        declaredSize: { width: 253, height: 2 },
        losslessFormat: 3,
        bitmapFormatCode: 3,
        paletteSize: 1,
      }),
    ).bitmap;
    expect(Array.from(indexed.pixels.subarray(0, 4))).toEqual([255, 0, 0, 255]);
    expect(Array.from(indexed.pixels.subarray(indexed.pixels.length - 4))).toEqual([255, 0, 0, 255]);

    const pix15Raw = Uint8Array.from([0x7c, 0x00, 0xee, 0xee, 0x03, 0xe0, 0xdd, 0xdd]);
    const pix15 = decodeBitmap(
      bitmap({
        source: 'lossless1',
        tagCode: 20,
        payload: new Uint8Array(deflateSync(pix15Raw)),
        declaredSize: { width: 1, height: 2 },
        losslessFormat: 4,
        bitmapFormatCode: 4,
      }),
    ).bitmap;
    expect(Array.from(pix15.pixels)).toEqual([255, 0, 0, 255, 0, 255, 0, 255]);

    const pix24Raw = Uint8Array.from([0x00, 12, 34, 56, 0x99, 78, 90, 123]);
    const pix24 = decodeBitmap(
      bitmap({
        source: 'lossless1',
        tagCode: 20,
        payload: new Uint8Array(deflateSync(pix24Raw)),
        declaredSize: { width: 1, height: 2 },
        losslessFormat: 5,
        bitmapFormatCode: 5,
      }),
    ).bitmap;
    expect(Array.from(pix24.pixels)).toEqual([12, 34, 56, 255, 78, 90, 123, 255]);

    const argb = decodeBitmap(
      bitmap({
        source: 'lossless2',
        tagCode: 36,
        payload: new Uint8Array(deflateSync(Uint8Array.from([255, 1, 2, 3, 255, 4, 5, 6]))),
        declaredSize: { width: 2, height: 1 },
        losslessFormat: 5,
        bitmapFormatCode: 5,
        sourcePremultiplied: true,
      }),
    ).bitmap;
    expect(Array.from(argb.pixels)).toEqual([1, 2, 3, 255, 4, 5, 6, 255]);
  });

  it('T-MOD-310: un-premultiplies zero-alpha and over-range channels deterministically', () => {
    const decoded = decodeBitmap(
      bitmap({
        source: 'lossless2',
        tagCode: 36,
        payload: new Uint8Array(deflateSync(Uint8Array.from([0, 90, 80, 70, 1, 255, 128, 1]))),
        declaredSize: { width: 2, height: 1 },
        losslessFormat: 5,
        bitmapFormatCode: 5,
        sourcePremultiplied: true,
      }),
    ).bitmap;
    expect(Array.from(decoded.pixels)).toEqual([0, 0, 0, 0, 255, 255, 255, 1]);
  });

  it('T-MOD-311: reads PIX15 Reserved/R/G/B fields and skips the PIX24 reserved byte', () => {
    const pix15 = decodeBitmap(
      bitmap({
        source: 'lossless1',
        tagCode: 20,
        payload: new Uint8Array(deflateSync(Uint8Array.from([0x7c, 0x1f, 0, 0]))),
        declaredSize: { width: 1, height: 1 },
        losslessFormat: 4,
        bitmapFormatCode: 4,
      }),
    ).bitmap;
    expect(Array.from(pix15.pixels)).toEqual([255, 0, 255, 255]);
    const pix24 = decodeBitmap(
      bitmap({
        source: 'lossless1',
        tagCode: 20,
        payload: new Uint8Array(deflateSync(Uint8Array.from([0xfe, 9, 19, 29]))),
        declaredSize: { width: 1, height: 1 },
        losslessFormat: 5,
        bitmapFormatCode: 5,
      }),
    ).bitmap;
    expect(Array.from(pix24.pixels)).toEqual([9, 19, 29, 255]);
  });

  it('decodes ALPHACOLORMAPDATA as straight RGBA rather than premultiplying palette channels', () => {
    const decoded = decodeBitmap(
      bitmap({
        source: 'lossless2',
        tagCode: 36,
        payload: new Uint8Array(deflateSync(Uint8Array.from([64, 32, 16, 128, 0, 0, 0, 0]))),
        declaredSize: { width: 1, height: 1 },
        losslessFormat: 3,
        bitmapFormatCode: 3,
        paletteSize: 1,
      }),
    ).bitmap;
    expect(Array.from(decoded.pixels)).toEqual([64, 32, 16, 128]);
    expect(decoded.sourcePremultiplied).toBe(false);
    expect(decoded.classification).toBe('alpha-carrier');
  });

  it('reports incorrect lossless byte counts and invalid palette indexes as SF0250', () => {
    const sizeMismatch = bitmap({
      source: 'lossless1',
      tagCode: 20,
      payload: new Uint8Array(deflateSync(Uint8Array.from([0, 1, 2]))),
      declaredSize: { width: 1, height: 1 },
      losslessFormat: 5,
      bitmapFormatCode: 5,
    });
    expect(() => decodeBitmap(sizeMismatch)).toThrowError(
      expect.objectContaining({ code: 'SF0250' } satisfies Partial<BitmapDecodeError>),
    );
    const badIndex = bitmap({
      source: 'lossless1',
      tagCode: 20,
      payload: new Uint8Array(deflateSync(Uint8Array.from([255, 0, 0, 1, 0, 0, 0]))),
      declaredSize: { width: 1, height: 1 },
      losslessFormat: 3,
      bitmapFormatCode: 3,
      paletteSize: 1,
    });
    expect(() => decodeBitmap(badIndex)).toThrowError(
      expect.objectContaining({ code: 'SF0250' } satisfies Partial<BitmapDecodeError>),
    );
  });

  it('T-MOD-305/T-MOD-304: preserves embedded PNG/GIF payloads, pixels, and JPEG3/4 alpha rules', () => {
    const png = encodeBitmapPng({ width: 1, height: 1, pixels: Uint8Array.from([12, 34, 56, 128]) });
    const pngModel = bitmap({ source: 'jpeg2', tagCode: 21, payload: png });
    const pngDecoded = decodeBitmap(pngModel, { swfVersion: 8 });
    expect(pngModel.payload).toBe(png);
    expect(Array.from(pngDecoded.bitmap.pixels)).toEqual([12, 34, 56, 128]);
    expect(pngDecoded.bitmap.contentType).toBe('png');

    const gif = Uint8Array.from([
      0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0xff, 0x00, 0xff,
      0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00, 0x00, 0xff, 0x00, 0xff, 0x02, 0x02, 0x4c,
      0x01, 0x00, 0x3b,
    ]);
    const gifDecoded = decodeBitmap(bitmap({ source: 'jpeg2', tagCode: 21, payload: gif }), { swfVersion: 8 });
    expect(Array.from(gifDecoded.bitmap.pixels)).toEqual([255, 0, 255, 255]);
    expect(gifDecoded.bitmap).toMatchObject({ contentType: 'gif', frameCount: 1, width: 1, height: 1 });

    const pngWithIgnoredAlpha = decodeBitmap(
      bitmap({
        source: 'jpeg3',
        tagCode: 35,
        payload: png,
        alpha: Uint8Array.from([0xff]),
        alphaDataOffset: png.length,
      }),
      { swfVersion: 7 },
    );
    expect(Array.from(pngWithIgnoredAlpha.bitmap.pixels)).toEqual([12, 34, 56, 128]);
    expect(pngWithIgnoredAlpha.diagnostics.map((item) => item.code)).toEqual(['SF0269', 'SF0203']);
    const gifWithIgnoredAlpha = decodeBitmap(
      bitmap({
        source: 'jpeg4',
        tagCode: 90,
        payload: gif,
        alpha: Uint8Array.from([0xff]),
        alphaDataOffset: gif.length,
      }),
    );
    expect(Array.from(gifWithIgnoredAlpha.bitmap.pixels)).toEqual([255, 0, 255, 255]);
    expect(gifWithIgnoredAlpha.diagnostics.map((item) => item.code)).toContain('SF0269');
  });

  it('T-MOD-312 tolerates the legacy JPEG prefix and reports progressive JPEGs', () => {
    const jpeg = encodeJpeg({ width: 1, height: 1, data: Uint8Array.from([180, 90, 30, 255]) }, 100).data;
    const legacy = new Uint8Array(jpeg.length + 2);
    legacy.set([0xff, 0xd9]);
    legacy.set(jpeg, 2);
    const legacyResult = decodeBitmap(bitmap({ source: 'jpeg2', payload: legacy }));
    const direct = decodeBitmap(bitmap({ source: 'jpeg2', payload: jpeg })).bitmap;
    expect(legacyResult.bitmap.pixels).toEqual(direct.pixels);
    expect(legacyResult.diagnostics.map((item) => item.code)).toContain('SF0258');

    const progressive = decodeBitmap(bitmap({ source: 'jpeg2', payload: new Uint8Array(PROGRESSIVE_JPEG) }));
    expect(progressive.bitmap).toMatchObject({ contentType: 'jpeg', width: 2, height: 2 });
    expect(progressive.diagnostics.map((item) => item.code)).toContain('SF0256');
  });

  it('T-MOD-304 drops malformed JPEG alpha planes without damaging the usable JPEG pixels', () => {
    const jpeg = encodeJpeg({ width: 1, height: 1, data: Uint8Array.from([180, 90, 30, 255]) }, 100).data;
    const short = decodeBitmap(
      bitmap({
        source: 'jpeg4',
        tagCode: 90,
        payload: jpeg,
        alpha: new Uint8Array(deflateSync(Uint8Array.from([64, 128]))),
        alphaDataOffset: jpeg.length,
        deblocking: 0x0180,
      }),
    );
    expect(short.bitmap.pixels[3]).toBe(255);
    expect(short.diagnostics).toEqual([
      { code: 'SF0253', severity: 'error', message: 'JPEG alpha plane has 2 bytes; expected 1' },
    ]);
    const invalid = decodeBitmap(
      bitmap({
        source: 'jpeg3',
        tagCode: 35,
        payload: jpeg,
        alpha: Uint8Array.from([0x78]),
        alphaDataOffset: jpeg.length,
      }),
    );
    expect(invalid.bitmap.pixels[3]).toBe(255);
    expect(invalid.diagnostics.map((item) => item.code)).toContain('SF0255');
  });

  it('T-MOD-313 decodes observed Lossless2 format 4 and quarantines unsupported formats', () => {
    const format4 = decodeBitmap(
      bitmap({
        source: 'lossless2',
        tagCode: 36,
        payload: new Uint8Array(deflateSync(Uint8Array.from([0x7c, 0x00, 0, 0]))),
        declaredSize: { width: 1, height: 1 },
        losslessFormat: 4,
        bitmapFormatCode: 4,
      }),
    ).bitmap;
    expect(Array.from(format4.pixels)).toEqual([255, 0, 0, 255]);
    expect(format4.contentType).toBe('lossless-rgb');
    const unknown = bitmap({
      source: 'lossless1',
      tagCode: 20,
      payload: new Uint8Array(),
      declaredSize: { width: 1, height: 1 },
      losslessFormat: null,
      bitmapFormatCode: 9,
    });
    expect(() => decodeBitmap(unknown)).toThrowError(expect.objectContaining({ code: 'SF0260' }));
  });

  it('T-AST-001: stays within a two-channel tolerance of an independent JPEG decoder', () => {
    const jpeg = encodeJpeg(
      {
        width: 2,
        height: 1,
        data: Uint8Array.from([240, 10, 20, 255, 20, 220, 40, 255]),
      },
      100,
    ).data;
    const actual = decodeBitmap(bitmap({ source: 'jpeg2', tagCode: 21, payload: jpeg })).bitmap.pixels;
    // Frozen ImageMagick 6.9.11-60 Q16 reference decode of this independently encoded JPEG.
    const reference = Uint8Array.from([240, 10, 20, 255, 21, 220, 41, 255]);
    expect(actual).toHaveLength(reference.length);
    for (let channel = 0; channel < reference.length; channel += 1) {
      expect(Math.abs((actual[channel] ?? 0) - (reference[channel] ?? 0))).toBeLessThanOrEqual(2);
    }
  });
});
