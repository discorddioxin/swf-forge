/**
 * Little-endian integer primitives and `EncodedU32` — `IMPL-010` §5.1.
 *
 * These functions are pure `(bytes, offset) => value` so they can be unit-tested without a cursor.
 */

export function u8(bytes: Uint8Array, at: number): number {
  return bytes[at] ?? 0;
}

export function s8(bytes: Uint8Array, at: number): number {
  const v = u8(bytes, at);
  return v >= 0x80 ? v - 0x100 : v;
}

export function u16(bytes: Uint8Array, at: number): number {
  return (u8(bytes, at) | (u8(bytes, at + 1) << 8)) >>> 0;
}

export function s16(bytes: Uint8Array, at: number): number {
  const v = u16(bytes, at);
  return v >= 0x8000 ? v - 0x10000 : v;
}

export function u24(bytes: Uint8Array, at: number): number {
  return (u8(bytes, at) | (u8(bytes, at + 1) << 8) | (u8(bytes, at + 2) << 16)) >>> 0;
}

export function u32(bytes: Uint8Array, at: number): number {
  const lo = u16(bytes, at);
  const hi = u16(bytes, at + 2);
  return (lo + hi * 0x10000) >>> 0;
}

export function s32(bytes: Uint8Array, at: number): number {
  const v = u32(bytes, at);
  return v >= 0x80000000 ? v - 0x100000000 : v;
}

/** `UI64`/`SI64` — `bigint` preserves the full range (`IMPL-010` §3.1). */
export function u64(bytes: Uint8Array, at: number): bigint {
  let v = 0n;
  for (let i = 7; i >= 0; i -= 1) {
    v = (v << 8n) | BigInt(u8(bytes, at + i));
  }
  return v;
}

export function s64(bytes: Uint8Array, at: number): bigint {
  const v = u64(bytes, at);
  return v >= 1n << 63n ? v - (1n << 64n) : v;
}

export interface EncodedU32Result {
  readonly value: number;
  readonly bytesRead: number;
  /** Set when the encoding is longer than necessary or overflows 32 bits (`SF0009`). */
  readonly overlong: boolean;
  readonly overflow: boolean;
  readonly danglingContinuation: boolean;
}

/**
 * Little-endian base-128 (`IMPL-010-R013`–`R015`).
 *
 * The 5th byte contributes only 4 significant bits; the result is always an unsigned 32-bit number.
 */
export function encodedU32(bytes: Uint8Array, at: number): EncodedU32Result {
  let value = 0;
  let shift = 0;
  let count = 0;
  let overlong = false;
  let overflow = false;
  let danglingContinuation = false;
  let i = at;

  for (;;) {
    const byte = u8(bytes, i);
    i += 1;
    count += 1;
    if (count === 5) {
      if ((byte & 0x7f) > 0x0f) {
        overflow = true;
      }
      value |= (byte & 0x0f) << 28;
      if ((byte & 0x80) !== 0) {
        danglingContinuation = true;
      }
      break;
    }
    value |= (byte & 0x7f) << shift;
    if ((byte & 0x80) === 0) {
      break;
    }
    shift += 7;
  }

  // The encoding is longer than necessary when the value fits in fewer group bits
  // (e.g. `80 00` for zero, or `81 00` for one).
  if (count > 1 && value < 2 ** (7 * (count - 1))) {
    overlong = true;
  }

  return { value: value >>> 0, bytesRead: count, overlong, overflow, danglingContinuation };
}
