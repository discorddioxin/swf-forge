/**
 * Deterministic PNG writer for the reference path (`REPO-R015`: no timestamps, no ancillary chunks
 * that carry a clock).
 *
 * The DEFLATE stream uses *stored* blocks, so encoding is pure arithmetic with no compressor state:
 * two encodes of the same image are byte-identical on every platform and every Node version. That is
 * what lets the harness compare frames by hash; size is not a concern for test images, and the paid
 * path (`fflate`/canvas) is a decision for the emitter, not for the reference renderer.
 */

import type { RasterImage } from '../raster/image.js';

const SIGNATURE = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_STORED_BLOCK = 65535;

const CRC_TABLE: number[] = (() => {
  const table: number[] = [];
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table.push(c >>> 0);
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function adler32(bytes: Uint8Array): number {
  let a = 1;
  let b = 0;
  for (const byte of bytes) {
    a = (a + byte) % 65521;
    b = (b + a) % 65521;
  }
  return ((b << 16) | a) >>> 0;
}

function u32be(value: number): number[] {
  return [(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff];
}

function chunk(type: string, data: Uint8Array): number[] {
  const typeBytes = [...type].map((ch) => ch.charCodeAt(0));
  const body = Uint8Array.from([...typeBytes, ...data]);
  return [...u32be(data.length), ...body, ...u32be(crc32(body))];
}

function zlibStored(raw: Uint8Array): Uint8Array {
  const out: number[] = [0x78, 0x01];
  for (let offset = 0; offset < raw.length || offset === 0; offset += MAX_STORED_BLOCK) {
    const end = Math.min(raw.length, offset + MAX_STORED_BLOCK);
    const length = end - offset;
    const final = end >= raw.length ? 1 : 0;
    out.push(final, length & 0xff, (length >>> 8) & 0xff, ~length & 0xff, (~length >>> 8) & 0xff);
    for (let i = offset; i < end; i += 1) out.push(raw[i] ?? 0);
    if (raw.length === 0) break;
  }
  out.push(...u32be(adler32(raw)));
  return Uint8Array.from(out);
}

/** Encodes an RGBA8 image as a PNG (8-bit, colour type 6, no interlace). */
export function encodePng(image: RasterImage): Uint8Array {
  const raw = new Uint8Array((image.width * 4 + 1) * image.height);
  for (let y = 0; y < image.height; y += 1) {
    const rowStart = y * (image.width * 4 + 1);
    raw[rowStart] = 0; // filter: none
    raw.set(image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4), rowStart + 1);
  }

  const ihdr = Uint8Array.from([
    ...u32be(image.width),
    ...u32be(image.height),
    8, // bit depth
    6, // colour type: RGBA
    0, // compression: deflate
    0, // filter method
    0, // interlace: none
  ]);

  const bytes = [
    ...SIGNATURE,
    ...chunk('IHDR', ihdr),
    ...chunk('IDAT', zlibStored(raw)),
    ...chunk('IEND', new Uint8Array(0)),
  ];
  return Uint8Array.from(bytes);
}
