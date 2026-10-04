/**
 * Fixed-point and IEEE float readers — `IMPL-010` §5.3.
 *
 * `FIXED` is 32-bit 16.16 and `FIXED8` is 16-bit 8.8; both are decoded by exact division
 * (a power of two), never by multiplying with a rounded reciprocal.
 */

/** IEEE 754 binary16 expansion (`E-004`). `0x8000` is `-0`. */
export function float16(bits: number): { value: number; special: 'none' | 'nan' | 'inf' } {
  const sign = (bits >> 15) & 1;
  const exp = (bits >> 10) & 0x1f;
  const man = bits & 0x3ff;
  let value: number;
  let special: 'none' | 'nan' | 'inf' = 'none';
  if (exp === 0) {
    value = man * 2 ** -24;
  } else if (exp === 31) {
    if (man === 0) {
      value = Number.POSITIVE_INFINITY;
      special = 'inf';
    } else {
      value = Number.NaN;
      special = 'nan';
    }
  } else {
    value = (1 + man / 1024) * 2 ** (exp - 15);
  }
  return { value: sign === 1 ? -value : value, special };
}

/** 32-bit 16.16 fixed point. */
export function fixed16_16(raw: number): number {
  return raw / 65536;
}

/** 16-bit 8.8 fixed point. */
export function fixed8_8(raw: number): number {
  return raw / 256;
}
