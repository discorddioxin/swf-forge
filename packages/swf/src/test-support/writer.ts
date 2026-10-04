/**
 * Test-support byte writer — `IMPL-140` §2 (deterministic fixtures).
 *
 * Tests build their SWF bytes through this writer rather than pasting hex, so a fixture stays
 * readable and a spec change is a one-line edit here. Nothing in `src/` imports this module: it is a
 * separate entry point (`./test-support`) and ships only to the test graph.
 */

import type { Rect } from '../io/types.js';

/** MSB-first bit writer with byte-level helpers. Little-endian for `u16`/`u32`. */
export class ByteWriter {
  readonly #out: number[] = [];
  #partial = 0;
  #bitCount = 0;

  get length(): number {
    return this.#out.length + (this.#bitCount > 0 ? 1 : 0);
  }

  u8(value: number): this {
    this.align();
    this.#out.push(value & 0xff);
    return this;
  }

  u16(value: number): this {
    return this.u8(value & 0xff).u8((value >>> 8) & 0xff);
  }

  s16(value: number): this {
    return this.u16(value & 0xffff);
  }

  u32(value: number): this {
    return this.u16(value & 0xffff).u16((value >>> 16) & 0xffff);
  }

  s32(value: number): this {
    return this.u32(value >>> 0);
  }

  bytes(source: ArrayLike<number>): this {
    this.align();
    for (let i = 0; i < source.length; i += 1) {
      this.#out.push((source[i] ?? 0) & 0xff);
    }
    return this;
  }

  /** NUL-terminated ASCII/Latin-1 string. */
  text(value: string): this {
    for (let i = 0; i < value.length; i += 1) {
      this.u8(value.charCodeAt(i));
    }
    return this.u8(0);
  }

  /** `count` bits of `value`, most-significant first. */
  bits(value: number, count: number): this {
    for (let i = count - 1; i >= 0; i -= 1) {
      this.#partial = ((this.#partial << 1) | ((value >> i) & 1)) & 0xff;
      this.#bitCount += 1;
      if (this.#bitCount === 8) {
        this.#out.push(this.#partial);
        this.#partial = 0;
        this.#bitCount = 0;
      }
    }
    return this;
  }

  align(): this {
    if (this.#bitCount > 0) {
      this.#out.push((this.#partial << (8 - this.#bitCount)) & 0xff);
      this.#partial = 0;
      this.#bitCount = 0;
    }
    return this;
  }

  toUint8Array(): Uint8Array {
    const aligned = this.#bitCount > 0 ? this.#out.concat((this.#partial << (8 - this.#bitCount)) & 0xff) : this.#out;
    return Uint8Array.from(aligned);
  }
}

const NBITS_MIN = 1;

/** `RECT` (`IMPL-010` §5.6): `Nbits UB[5]` then four `SB[Nbits]`, zero-padded to a byte. */
export function writeRect(w: ByteWriter, rect: Rect): ByteWriter {
  const values = [rect.xMin, rect.xMax, rect.yMin, rect.yMax];
  let bits = NBITS_MIN;
  for (const value of values) {
    let needed = 1;
    while (needed < 32 && (value >= 1 << (needed - 1) || value < -(1 << (needed - 1)))) needed += 1;
    if (needed > bits) bits = needed;
  }
  w.bits(bits, 5);
  for (const value of values) w.bits(value < 0 ? value + (1 << bits) : value, bits);
  return w.align();
}

/**
 * A tag: `UI16` little-endian (`code << 6 | length`), with the long form when the body does not fit
 * in the six-bit length field (`IMPL-020` §4.1).
 */
export function tag(
  code: number,
  body: Uint8Array = new Uint8Array(0),
  options: { forceLong?: boolean } = {},
): Uint8Array {
  const w = new ByteWriter();
  const long = options.forceLong === true || body.length >= 0x3f;
  if (long) {
    w.u16((code << 6) | 0x3f).u32(body.length);
  } else {
    w.u16((code << 6) | body.length);
  }
  return w.bytes(body).toUint8Array();
}

export function showFrames(count: number): Uint8Array {
  const w = new ByteWriter();
  for (let i = 0; i < count; i += 1) w.bytes(tag(1));
  return w.toUint8Array();
}

export function endTag(): Uint8Array {
  return tag(0);
}

export interface SwfFixtureOptions {
  readonly version?: number;
  /** Header frame size in twips; defaults to 550 × 400 px. */
  readonly frameSize?: Rect;
  /** Frames per second as written (`8.8` fixed) — 12 by default. */
  readonly frameRateRaw?: number;
  readonly frameCount?: number;
  /** Tag stream, including the `End` tag. */
  readonly body: Uint8Array;
}

/** Builds an uncompressed (`FWS`) file whose `FileLength` matches the bytes produced. */
export function buildSwf(options: SwfFixtureOptions): Uint8Array {
  const version = options.version ?? 6;
  const frameSize = options.frameSize ?? { xMin: 0, xMax: 11000, yMin: 0, yMax: 8000 };
  const frameRateRaw = options.frameRateRaw ?? 12 * 256;
  const frameCount = options.frameCount ?? 1;

  const w = new ByteWriter();
  w.u8(0x46).u8(0x57).u8(0x53).u8(version); // 'F','W','S'
  w.u32(0); // patched below — FileLength
  writeRect(w, frameSize);
  w.u16(frameRateRaw);
  w.u16(frameCount);
  const headerAndBody = w.bytes(options.body).toUint8Array();
  const total = headerAndBody.length;
  const out = new ByteWriter();
  out.bytes(headerAndBody);
  const bytes = out.toUint8Array();
  bytes[4] = total & 0xff;
  bytes[5] = (total >>> 8) & 0xff;
  bytes[6] = (total >>> 16) & 0xff;
  bytes[7] = (total >>> 24) & 0xff;
  return bytes;
}

/** Minimal valid file: header, one `ShowFrame`, `End`. */
export function minimalSwf(options: Omit<SwfFixtureOptions, 'body'> = {}): Uint8Array {
  return buildSwf({ ...options, body: concat(showFrames(1), endTag()) });
}

export function concat(...parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
