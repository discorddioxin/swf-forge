/**
 * Small pure digests for the container/model layers.
 *
 * Password and telemetry-hash material MUST be recorded as present/absent plus a local digest, never
 * as plain text (`IMPL-040-R040`/`R041`, SEC-§4). `fnv1a64Hex` is a cheap, synchronous,
 * non-cryptographic one-way fingerprint — deliberately not reversible, so a report can prove two
 * passwords were the same without ever reproducing one.
 */

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;

/** FNV-1a 64 over `bytes`, as a 16-character hex string (no `0x`/`fnv1a64:` prefix). */
export function fnv1a64Hex(bytes: Uint8Array): string {
  let hash = FNV_OFFSET;
  for (let i = 0; i < bytes.length; i += 1) {
    hash ^= BigInt(bytes[i] ?? 0);
    hash = (hash * FNV_PRIME) & 0xffffffffffffffffn;
  }
  return hash.toString(16).padStart(16, '0');
}
