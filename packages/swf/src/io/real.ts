/**
 * Fixed-point and IEEE float readers — `IMPL-010` §5.3.
 *
 * `FIXED` is 32-bit 16.16 and `FIXED8` is 16-bit 8.8; both are decoded by exact division
 * (a power of two), never by multiplying with a rounded reciprocal.
 */

export type Float16Special = 'none' | 'nan' | 'inf';

/** The special class of a binary16 pattern, without allocating a result object. */
export function float16Special(bits: number): Float16Special {
  const exp = (bits >> 10) & 0x1f;
  if (exp !== 31) return 'none';
  return (bits & 0x3ff) === 0 ? 'inf' : 'nan';
}

/** The numeric value of a binary16 pattern, without allocating a result object. */
export function float16Value(bits: number): number {
  const sign = (bits >> 15) & 1;
  const exp = (bits >> 10) & 0x1f;
  const man = bits & 0x3ff;
  let value: number;
  if (exp === 0) value = man * 2 ** -24;
  else if (exp === 31) value = man === 0 ? Number.POSITIVE_INFINITY : Number.NaN;
  else value = (1 + man / 1024) * 2 ** (exp - 15);
  return sign === 1 ? -value : value;
}

/** IEEE 754 binary16 expansion (`E-004`). `0x8000` is `-0`. */
export function float16(bits: number): { value: number; special: Float16Special } {
  return { value: float16Value(bits), special: float16Special(bits) };
}

/** 32-bit 16.16 fixed point. */
export function fixed16_16(raw: number): number {
  return raw / 65536;
}

/** 16-bit 8.8 fixed point. */
export function fixed8_8(raw: number): number {
  return raw / 256;
}
