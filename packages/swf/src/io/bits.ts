/**
 * Bit-field helpers — `IMPL-010` §5.2. Bits run MSB-first inside each byte; fields may span bytes and
 * padding bits are discarded at the end of a bit-packed structure (`align()`).
 */

/** Mask for `n` bits (n <= 31; 32 is handled by the caller through `2 ** 32`). */
export function maskFor(bits: number): number {
  return bits >= 32 ? 0xffffffff : (1 << bits) - 1;
}

/** Two's-complement sign extension of an unsigned value read with `bits` bits. */
export function signExtend(value: number, bits: number): number {
  if (bits === 0) return 0;
  const half = 2 ** (bits - 1);
  return value >= half ? value - 2 ** bits : value;
}
