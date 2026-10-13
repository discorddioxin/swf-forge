/**
 * C3 — `T-MOD-301` (JPEGTables splice, byte-compared), `T-MOD-302` (row padding for every pixel
 * size) and `T-MOD-303` (XRGB vs ARGB channel order).
 *
 * `bitmap.test.ts` already proves the splice produces the *same pixels* as an unsplit JPEG. That is
 * a decoder-mediated check: a decoder lenient about a stray `EOI`/`SOI` in the middle of the stream
 * would let a wrong splice pass. These tests compare the merged bytes directly and build the
 * lossless payloads by hand so the padding and channel order are asserted against the layout rules
 * rather than against the decoder's own idea of them.
 */

import { deflateSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';

import { encode as encodeJpeg } from 'jpeg-js';

import type { BitmapAssetModel } from '@swf-forge/swf';
import { BitmapDecodeError, decodeBitmap, spliceJpegTables } from '../src/index.js';

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

const SOI = [0xff, 0xd8];
const EOI = [0xff, 0xd9];

/** A `JPEGTables` payload: `SOI`, one `DQT`-shaped segment, `EOI` — the shape tag 8 really has. */
function tablesBlock(marker = 0xdb): Uint8Array {
  return Uint8Array.from([...SOI, 0xff, marker, 0x00, 0x05, 1, 2, 3, ...EOI]);
}

/** A `DefineBits` payload: `SOI`, a scan-shaped segment, `EOI`. */
function imageBlock(): Uint8Array {
  return Uint8Array.from([...SOI, 0xff, 0xda, 0x00, 0x04, 9, 8, 0x77, 0x66, ...EOI]);
}

const hex = (bytes: Uint8Array): string => Buffer.from(bytes).toString('hex');

describe('T-MOD-301 DefineBits + JPEGTables splice', () => {
  it('produces exactly one SOI, the table body, the image body and one EOI', () => {
    const merged = spliceJpegTables(imageBlock(), tablesBlock());

    // SOI, DQT segment from the tables (its own SOI/EOI stripped), scan from the image, EOI.
    expect(hex(merged)).toBe(
      hex(Uint8Array.from([...SOI, 0xff, 0xdb, 0x00, 0x05, 1, 2, 3, 0xff, 0xda, 0x00, 0x04, 9, 8, 0x77, 0x66, ...EOI])),
    );
  });

  it('leaves no interior EOI or second SOI, which naive concatenation would', () => {
    const merged = spliceJpegTables(imageBlock(), tablesBlock());
    const interior = merged.subarray(2, merged.length - 2);

    for (let i = 0; i + 1 < interior.length; i += 1) {
      const pair = [interior[i], interior[i + 1]];
      expect(pair).not.toEqual(SOI);
      expect(pair).not.toEqual(EOI);
    }
    // The failure mode this guards against: `concat(tables, image)` is byte-different.
    const naive = Uint8Array.from([...tablesBlock(), ...imageBlock()]);
    expect(hex(merged)).not.toBe(hex(naive));
  });

  it('tolerates the pre-SWF 8 erroneous FFD9FFD8 prefix without copying it into the stream', () => {
    const prefixed = Uint8Array.from([...EOI, ...SOI, 0xff, 0xda, 0x00, 0x04, 9, 8, 0x77, 0x66, ...EOI]);

    expect(hex(spliceJpegTables(prefixed, tablesBlock()))).toBe(hex(spliceJpegTables(imageBlock(), tablesBlock())));
  });

  it('tolerates the same erroneous prefix on the JPEGTables block', () => {
    const prefixed = Uint8Array.from([...EOI, ...SOI, 0xff, 0xdb, 0x00, 0x05, 1, 2, 3, ...EOI]);

    expect(hex(spliceJpegTables(imageBlock(), prefixed))).toBe(hex(spliceJpegTables(imageBlock(), tablesBlock())));
  });

  it('accepts both readings of the errata: with and without a second SOI after the pair', () => {
    // The spec says the pair sits *before* the SOI; some producers let the pair's own FFD8 be the
    // SOI. Both must land on the same stream rather than one of them losing the SOI entirely.
    const withSecondSoi = Uint8Array.from([...EOI, ...SOI, ...SOI, 0xff, 0xda, 0x00, 0x04, 9, 8, 0x77, 0x66, ...EOI]);
    const pairIsSoi = Uint8Array.from([...EOI, ...SOI, 0xff, 0xda, 0x00, 0x04, 9, 8, 0x77, 0x66, ...EOI]);

    const expected = hex(spliceJpegTables(imageBlock(), tablesBlock()));
    expect(hex(spliceJpegTables(withSecondSoi, tablesBlock()))).toBe(expected);
    expect(hex(spliceJpegTables(pairIsSoi, tablesBlock()))).toBe(expected);
  });

  it('removes an erroneous pair in the interior of the stream, not just at the front', () => {
    // The pair is what a producer's own glue leaves behind, so it appears mid-stream in real files.
    const interior = Uint8Array.from([
      ...SOI,
      0xff,
      0xdb,
      0x00,
      0x05,
      1,
      2,
      3,
      ...EOI,
      ...SOI,
      0xff,
      0xda,
      0x00,
      0x04,
      9,
      8,
      0x77,
      0x66,
      ...EOI,
    ]);

    expect(hex(spliceJpegTables(interior, null))).toBe(
      hex(Uint8Array.from([...SOI, 0xff, 0xdb, 0x00, 0x05, 1, 2, 3, 0xff, 0xda, 0x00, 0x04, 9, 8, 0x77, 0x66, ...EOI])),
    );
  });

  it('keeps the last table when the JPEGTables block has no trailing EOI', () => {
    // Chopping two bytes unconditionally truncates the final table instead of an absent EOI.
    const noEoi = Uint8Array.from([...SOI, 0xff, 0xdb, 0x00, 0x05, 1, 2, 3]);

    expect(hex(spliceJpegTables(imageBlock(), noEoi))).toBe(hex(spliceJpegTables(imageBlock(), tablesBlock())));
  });

  it('leaves entropy-coded FFD9FFD8 bytes after the scan header alone', () => {
    // Past SOS the bytes are image data; rewriting them there would corrupt the picture.
    const scanData = Uint8Array.from([...SOI, 0xff, 0xda, 0x00, 0x04, 9, 8, ...EOI, ...SOI, 0x11, ...EOI]);

    expect(hex(spliceJpegTables(scanData, null))).toBe(hex(scanData));
  });

  it('reports the skipped pairs once per asset as SF0258 and still decodes the image', () => {
    const jpeg = encodeJpeg({ width: 1, height: 1, data: Uint8Array.from([200, 100, 50, 255]) }, 100).data;
    const prefixed = Uint8Array.from([...EOI, ...SOI, ...jpeg]);
    const clean = decodeBitmap(bitmap({ source: 'jpeg2', tagCode: 21, payload: jpeg }));
    const result = decodeBitmap(bitmap({ source: 'jpeg2', tagCode: 21, payload: prefixed }));

    expect(result.diagnostics.filter((d) => d.code === 'SF0258')).toHaveLength(1);
    expect(result.diagnostics.find((d) => d.code === 'SF0258')?.severity).toBe('info');
    expect(result.bitmap.pixels).toEqual(clean.bitmap.pixels);
    expect(clean.diagnostics.map((d) => d.code)).not.toContain('SF0258');
  });

  it('rejects a DefineBits image with no tables at all as SF0251', () => {
    expect(() => decodeBitmap(bitmap({ source: 'defineBits', tagCode: 6, payload: imageBlock() }))).toThrowError(
      expect.objectContaining({ code: 'SF0251' }),
    );
  });
});

describe('T-MOD-302 lossless row padding (IMPL-070-R009)', () => {
  /** Build a `BITMAPDATA` block of `PIX24` rows, each padded to a 32-bit boundary. */
  function pix24(rows: readonly (readonly (readonly [number, number, number])[])[]): Uint8Array {
    const width = rows[0]?.length ?? 0;
    const rowBytes = Math.ceil((width * 4) / 4) * 4;
    const raw = new Uint8Array(rowBytes * rows.length);
    rows.forEach((row, y) => {
      row.forEach(([r, g, b], x) => {
        const at = y * rowBytes + x * 4;
        raw[at] = 0x00; // PIX24 reserved byte
        raw[at + 1] = r;
        raw[at + 2] = g;
        raw[at + 3] = b;
      });
    });
    return raw;
  }

  it('decodes a 3x3 PIX24 image with every row in place', () => {
    // PIX24 is 4 bytes wide, so a 3-pixel row is already 12 bytes: no padding, and a decoder that
    // wrongly assumed 3 bytes per pixel would need 9-byte rows and smear diagonally.
    const rows = [
      [
        [255, 0, 0],
        [0, 255, 0],
        [0, 0, 255],
      ],
      [
        [10, 20, 30],
        [40, 50, 60],
        [70, 80, 90],
      ],
      [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ],
    ] as const;
    const decoded = decodeBitmap(
      bitmap({
        source: 'lossless1',
        tagCode: 20,
        payload: new Uint8Array(deflateSync(pix24(rows))),
        declaredSize: { width: 3, height: 3 },
        losslessFormat: 5,
        bitmapFormatCode: 5,
      }),
    ).bitmap;

    expect(Array.from(decoded.pixels)).toEqual(rows.flatMap((row) => row.flatMap(([r, g, b]) => [r, g, b, 255])));
  });

  it('pads a 253-pixel 8-bit row to 256 bytes, the chapter example', () => {
    const width = 253;
    const rowBytes = 256;
    expect(Math.ceil((width * 1) / 4) * 4).toBe(rowBytes);

    const palette = Uint8Array.from([0, 0, 0, 255, 255, 255]); // two RGB entries
    const raw = new Uint8Array(palette.length + rowBytes * 2);
    raw.set(palette);
    for (let x = 0; x < width; x += 1) {
      raw[palette.length + x] = x % 2; // row 0 alternates
      raw[palette.length + rowBytes + x] = 1 - (x % 2); // row 1 is its inverse
    }
    // Garbage in the three padding bytes must not reach the pixels.
    raw[palette.length + 253] = 0xaa;
    raw[palette.length + 254] = 0xbb;
    raw[palette.length + 255] = 0xcc;

    const decoded = decodeBitmap(
      bitmap({
        source: 'lossless1',
        tagCode: 20,
        payload: new Uint8Array(deflateSync(raw)),
        declaredSize: { width, height: 2 },
        losslessFormat: 3,
        bitmapFormatCode: 3,
        paletteSize: 2,
      }),
    ).bitmap;

    expect(decoded.pixels.length).toBe(width * 2 * 4);
    // Row 1 pixel 0 is white; a flat-array read would land three bytes early and give black.
    expect(Array.from(decoded.pixels.subarray(0, 4))).toEqual([0, 0, 0, 255]);
    expect(Array.from(decoded.pixels.subarray(width * 4, width * 4 + 4))).toEqual([255, 255, 255, 255]);
    expect(Array.from(decoded.pixels.subarray(width * 4 + 4, width * 4 + 8))).toEqual([0, 0, 0, 255]);
  });

  it('pads a 3-pixel PIX15 row to 8 bytes', () => {
    const rowBytes = Math.ceil((3 * 2) / 4) * 4;
    expect(rowBytes).toBe(8);
    const raw = new Uint8Array(rowBytes * 2);
    const put = (y: number, x: number, r: number, g: number, b: number): void => {
      const word = (r << 10) | (g << 5) | b;
      raw[y * rowBytes + x * 2] = word >>> 8;
      raw[y * rowBytes + x * 2 + 1] = word & 0xff;
    };
    put(0, 0, 31, 0, 0);
    put(0, 2, 0, 31, 0);
    put(1, 0, 0, 0, 31);
    raw[6] = 0xde; // padding
    raw[7] = 0xad;

    const decoded = decodeBitmap(
      bitmap({
        source: 'lossless1',
        tagCode: 20,
        payload: new Uint8Array(deflateSync(raw)),
        declaredSize: { width: 3, height: 2 },
        losslessFormat: 4,
        bitmapFormatCode: 4,
      }),
    ).bitmap;

    expect(Array.from(decoded.pixels.subarray(0, 4))).toEqual([255, 0, 0, 255]);
    expect(Array.from(decoded.pixels.subarray(8, 12))).toEqual([0, 255, 0, 255]);
    expect(Array.from(decoded.pixels.subarray(12, 16))).toEqual([0, 0, 255, 255]); // first pixel of row 1
  });

  it('reports a byte count that ignores the padding as SF0250 rather than smearing', () => {
    // 3 bytes per pixel x 3 x 3 = 27 bytes: what a decoder that forgot PIX24's reserved byte and the
    // row alignment would produce.
    expect(() =>
      decodeBitmap(
        bitmap({
          source: 'lossless1',
          tagCode: 20,
          payload: new Uint8Array(deflateSync(new Uint8Array(27))),
          declaredSize: { width: 3, height: 3 },
          losslessFormat: 5,
          bitmapFormatCode: 5,
        }),
      ),
    ).toThrowError(expect.objectContaining({ code: 'SF0250' }));
  });
});

describe('T-MOD-303 channel order (IMPL-070-R010)', () => {
  const corners = (pixels: Uint8Array, width: number, height: number): number[][] =>
    [
      [0, 0],
      [width - 1, 0],
      [0, height - 1],
      [width - 1, height - 1],
    ].map(([x, y]) =>
      Array.from(
        pixels.subarray(((y as number) * width + (x as number)) * 4, ((y as number) * width + (x as number)) * 4 + 4),
      ),
    );

  it('reads PIX24 as X R G B, not B G R X', () => {
    // A single pixel whose four bytes are all different: if the reserved byte were treated as red
    // the result would be [0, 200, 100, 255] instead of [200, 100, 50, 255].
    const raw = Uint8Array.from([0x00, 200, 100, 50]);
    const decoded = decodeBitmap(
      bitmap({
        source: 'lossless1',
        tagCode: 20,
        payload: new Uint8Array(deflateSync(raw)),
        declaredSize: { width: 1, height: 1 },
        losslessFormat: 5,
        bitmapFormatCode: 5,
      }),
    ).bitmap;

    expect(Array.from(decoded.pixels)).toEqual([200, 100, 50, 255]);
  });

  it('reads ALPHABITMAPDATA as A R G B and un-premultiplies', () => {
    // alpha 128, premultiplied RGB = (64, 32, 16) -> straight (128, 64, 32).
    const raw = Uint8Array.from([128, 64, 32, 16]);
    const decoded = decodeBitmap(
      bitmap({
        source: 'lossless2',
        tagCode: 36,
        payload: new Uint8Array(deflateSync(raw)),
        declaredSize: { width: 1, height: 1 },
        losslessFormat: 5,
        bitmapFormatCode: 5,
        sourcePremultiplied: true,
      }),
    ).bitmap;

    expect(Array.from(decoded.pixels)).toEqual([128, 64, 32, 128]);
  });

  it('distinguishes XRGB from ARGB on the same bytes', () => {
    // The identical payload decodes to opaque colour under Lossless (format 5 = PIX24, leading byte
    // reserved) and to a translucent pixel under Lossless2 (format 5 = ARGB, leading byte = alpha).
    const raw = new Uint8Array(deflateSync(Uint8Array.from([128, 64, 32, 16])));
    const asXrgb = decodeBitmap(
      bitmap({
        source: 'lossless1',
        tagCode: 20,
        payload: raw,
        declaredSize: { width: 1, height: 1 },
        losslessFormat: 5,
        bitmapFormatCode: 5,
      }),
    ).bitmap;
    const asArgb = decodeBitmap(
      bitmap({
        source: 'lossless2',
        tagCode: 36,
        payload: raw,
        declaredSize: { width: 1, height: 1 },
        losslessFormat: 5,
        bitmapFormatCode: 5,
      }),
    ).bitmap;

    expect(Array.from(asXrgb.pixels)).toEqual([64, 32, 16, 255]);
    expect(Array.from(asArgb.pixels)).toEqual([64, 32, 16, 128]);
  });

  it('places four distinct corner colours at the four corners, proving row-major order', () => {
    const width = 3;
    const height = 3;
    const rowBytes = 12;
    const raw = new Uint8Array(rowBytes * height);
    const put = (x: number, y: number, r: number, g: number, b: number): void => {
      const at = y * rowBytes + x * 4;
      raw[at + 1] = r;
      raw[at + 2] = g;
      raw[at + 3] = b;
    };
    put(0, 0, 255, 0, 0); // top-left red
    put(2, 0, 0, 255, 0); // top-right green
    put(0, 2, 0, 0, 255); // bottom-left blue
    put(2, 2, 255, 255, 0); // bottom-right yellow

    const decoded = decodeBitmap(
      bitmap({
        source: 'lossless1',
        tagCode: 20,
        payload: new Uint8Array(deflateSync(raw)),
        declaredSize: { width, height },
        losslessFormat: 5,
        bitmapFormatCode: 5,
      }),
    ).bitmap;

    expect(corners(decoded.pixels, width, height)).toEqual([
      [255, 0, 0, 255],
      [0, 255, 0, 255],
      [0, 0, 255, 255],
      [255, 255, 0, 255],
    ]);
  });

  it('reads the palette as RGB for Lossless and RGBA for Lossless2', () => {
    const indexRow = (width: number): number[] =>
      Array.from({ length: Math.ceil(width / 4) * 4 }, (_, i) => (i < width ? i : 0));
    const rgbPalette = [10, 20, 30, 40, 50, 60];
    const rgbaPalette = [10, 20, 30, 128, 40, 50, 60, 255];

    const one = decodeBitmap(
      bitmap({
        source: 'lossless1',
        tagCode: 20,
        payload: new Uint8Array(deflateSync(Uint8Array.from([...rgbPalette, ...indexRow(2)]))),
        declaredSize: { width: 2, height: 1 },
        losslessFormat: 3,
        bitmapFormatCode: 3,
        paletteSize: 2,
      }),
    ).bitmap;
    const two = decodeBitmap(
      bitmap({
        source: 'lossless2',
        tagCode: 36,
        payload: new Uint8Array(deflateSync(Uint8Array.from([...rgbaPalette, ...indexRow(2)]))),
        declaredSize: { width: 2, height: 1 },
        losslessFormat: 3,
        bitmapFormatCode: 3,
        paletteSize: 2,
      }),
    ).bitmap;

    expect(Array.from(one.pixels)).toEqual([10, 20, 30, 255, 40, 50, 60, 255]);
    // Palette alpha is used as written: ALPHACOLORMAPDATA entries are not premultiplied (R011).
    expect(Array.from(two.pixels)).toEqual([10, 20, 30, 128, 40, 50, 60, 255]);
  });

  it('refuses an unknown BitmapFormat rather than guessing a layout', () => {
    expect(() =>
      decodeBitmap(
        bitmap({
          source: 'lossless1',
          tagCode: 20,
          payload: new Uint8Array(deflateSync(new Uint8Array(4))),
          declaredSize: { width: 1, height: 1 },
          losslessFormat: null,
          bitmapFormatCode: 7,
        }),
      ),
    ).toThrowError(BitmapDecodeError);
  });
});
