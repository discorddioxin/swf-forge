/**
 * Deterministic AVM1 mutation/truncation gate — `IMPL-050` §13.4 (`T-AVM1-FE-033`).
 *
 * Normal test runs execute a quick 2,000-case smoke pass. `pnpm test:avm1-fuzz` sets
 * `AVM1_FUZZ_1M=1` and runs the required one-million-case campaign with the same fixed seed.
 */

import { describe, expect, it } from 'vitest';

import { analyzeActionBlock, residualByteCount, scanRecords } from '@swf-forge/avm1';
import type { Emit } from '@swf-forge/avm1';
import {
  block,
  constantPool,
  defineFunction,
  pushConstant8,
  pushInt,
  pushString,
  rec,
  tryRegion,
  withRegion,
} from './harness.js';

const SEED = 0xc3f00d71;
const FULL_CAMPAIGN = process.env.AVM1_FUZZ_1M === '1';
const ITERATIONS = FULL_CAMPAIGN ? 1_000_000 : 2_000;
const NOOP_EMIT: Emit = () => undefined;

class XorShift32 {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9;
  }

  next(): number {
    let x = this.state;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.state = x >>> 0;
    return this.state;
  }

  int(maxExclusive: number): number {
    return maxExclusive <= 0 ? 0 : this.next() % maxExclusive;
  }
}

const CORPUS: readonly Uint8Array[] = [
  block(),
  block(rec(0x0a), rec(0x0b), rec(0x17)),
  block(pushString('mutate me'), pushInt(0x76543210), rec(0x0a)),
  block(rec(0x8a, [0x01, 0x00, 0x02]), rec(0x8d, [0x03])),
  block(constantPool('alpha', 'beta'), pushConstant8(1), rec(0x17)),
  block(pushString('scope'), withRegion(1, [0x07])),
  block(tryRegion({ try: [0x06], catchName: 'e', catch: [0x07], finallyPresent: true, finally: [0x06] })),
  block(defineFunction({ name: 'f', params: ['x'], body: [0x07, 0x00] }), rec(0x17)),
  Uint8Array.from([0x01, 0x00]), // Undefined short opcode, followed by End.
  Uint8Array.from([0x99, 0x02]), // Truncated high-opcode length field.
  Uint8Array.from([0x96, 0x08, 0x00, 0x07, 0x01]), // Push payload overrun.
  Uint8Array.from([0x99, 0xff, 0x7f, 0x00]), // Declared branch payload overrun.
];

function mutate(seed: Uint8Array, rng: XorShift32, mode: number): Uint8Array {
  const bytes = Uint8Array.from(seed);
  if (mode === 0 || mode === 1) {
    // Always cut before the seed's end so both arbitrary and boundary truncations are exercised.
    const cut = bytes.length === 0 ? 0 : rng.int(bytes.length);
    return bytes.slice(0, cut);
  }
  if (mode === 2) {
    const inserted = 1 + rng.int(3);
    const at = rng.int(bytes.length + 1);
    const result = new Uint8Array(bytes.length + inserted);
    result.set(bytes.subarray(0, at));
    for (let i = 0; i < inserted; i += 1) result[at + i] = rng.next() & 0xff;
    result.set(bytes.subarray(at), at + inserted);
    return result;
  }
  if (mode === 3) {
    if (bytes.length === 0) return Uint8Array.from([rng.next() & 0xff]);
    const at = rng.int(bytes.length);
    const count = 1 + rng.int(Math.min(4, bytes.length - at));
    const result = new Uint8Array(bytes.length - count);
    result.set(bytes.subarray(0, at));
    result.set(bytes.subarray(at + count), at);
    return result;
  }
  if (mode === 4 || mode === 5) {
    if (bytes.length === 0) return Uint8Array.from([rng.next() & 0xff]);
    const at = rng.int(bytes.length);
    bytes[at] = mode === 4 ? (bytes[at] ?? 0) ^ (1 << rng.int(8)) : rng.next() & 0xff;
    return bytes;
  }
  if (mode === 6) {
    const highOpcodes: number[] = [];
    for (let i = 0; i + 2 < bytes.length; i += 1) if ((bytes[i] ?? 0) >= 0x80) highOpcodes.push(i);
    if (highOpcodes.length > 0) {
      const at = highOpcodes[rng.int(highOpcodes.length)] ?? 0;
      bytes[at + 1] = rng.next() & 0xff;
      bytes[at + 2] = rng.next() & 0xff;
    } else if (bytes.length > 0) {
      bytes[rng.int(bytes.length)] = rng.next() & 0xff;
    }
    return bytes;
  }
  // Cut at a high-opcode header boundary when possible, otherwise truncate at any byte.
  const headerStarts: number[] = [];
  for (let i = 0; i < bytes.length; i += 1) if ((bytes[i] ?? 0) >= 0x80) headerStarts.push(i);
  if (headerStarts.length > 0) {
    const at = headerStarts[rng.int(headerStarts.length)] ?? 0;
    return bytes.slice(0, Math.min(bytes.length - 1, at + 1 + rng.int(2)));
  }
  return bytes.slice(0, bytes.length === 0 ? 0 : rng.int(bytes.length));
}

function fail(iteration: number, bytes: Uint8Array, message: string): never {
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join(' ');
  throw new Error(`seed=0x${SEED.toString(16)} iteration=${iteration} bytes=[${hex}]: ${message}`);
}

function assertFramingInvariants(iteration: number, bytes: Uint8Array): ReturnType<typeof scanRecords> {
  const scan = scanRecords(bytes, NOOP_EMIT);
  let cursor = 0;
  for (let i = 0; i < scan.records.length; i += 1) {
    const record = scan.records[i];
    if (record === undefined) fail(iteration, bytes, `missing scan record ${i}`);
    if (record.offset !== cursor) fail(iteration, bytes, `record ${i} starts at ${record.offset}, expected ${cursor}`);
    if (record.end < record.offset || record.end > bytes.length) {
      fail(iteration, bytes, `record ${i} ends outside the byte stream at ${record.end}`);
    }
    if (record.overrun || record.truncated) {
      if (i !== scan.records.length - 1) fail(iteration, bytes, 'fatal framing record was not last');
    } else {
      const expectedEnd = record.offset + (record.code >= 0x80 ? 3 + record.length : 1);
      if (record.end !== expectedEnd)
        fail(iteration, bytes, `record ${i} end ${record.end} != expected ${expectedEnd}`);
    }
    cursor = record.end;
  }
  if (scan.stoppedAt !== cursor) fail(iteration, bytes, `stoppedAt ${scan.stoppedAt} != consumed boundary ${cursor}`);
  if (scan.terminated !== scan.records.some((record) => record.code === 0)) {
    fail(iteration, bytes, 'terminator flag disagrees with framed records');
  }
  if (scan.terminated) {
    if (scan.records[scan.records.length - 1]?.code !== 0) {
      fail(iteration, bytes, 'End did not terminate the framed record sequence');
    }
  } else if (cursor !== bytes.length) {
    fail(iteration, bytes, `unterminated framing stopped at ${cursor}/${bytes.length}`);
  }
  return scan;
}

describe('T-AVM1-FE-033 seeded action-stream mutation/truncation gate', () => {
  it(
    `${FULL_CAMPAIGN ? 'one-million' : 'smoke'} seeded mutations preserve framing and residual invariants`,
    () => {
      const rng = new XorShift32(SEED);
      for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
        const seed = CORPUS[rng.int(CORPUS.length)];
        if (seed === undefined) fail(iteration, new Uint8Array(), 'empty mutation corpus');
        const bytes = mutate(seed, rng, iteration % 8);
        const scan = assertFramingInvariants(iteration, bytes);
        const analyzed = analyzeActionBlock({
          bytes,
          offsetBase: 0,
          kind: 'timeline',
          id: `fuzz_${iteration}`,
          version: 7,
          emit: NOOP_EMIT,
        });
        const hasUnknownOrDesync =
          scan.desync || scan.records.some((record) => record.name === 'Unknown' && !record.observed);
        if (hasUnknownOrDesync && analyzed.decision.tier !== 2) {
          fail(iteration, bytes, `unknown/desynchronised input was not T2: ${analyzed.decision.tier}`);
        }
        if (analyzed.decision.tier === 2 && bytes.length > 0 && analyzed.residual.length === 0) {
          fail(iteration, bytes, `T2 ${analyzed.decision.residualReason ?? ''} has no residual fallback`);
        }
        for (const slice of analyzed.residual) {
          if (
            !Number.isInteger(slice.offset) ||
            !Number.isInteger(slice.length) ||
            slice.offset < 0 ||
            slice.length <= 0 ||
            slice.offset + slice.length > bytes.length
          ) {
            fail(iteration, bytes, `residual slice is outside the input: ${JSON.stringify(slice)}`);
          }
        }
        if (residualByteCount(analyzed.residual) !== analyzed.residual.reduce((sum, slice) => sum + slice.length, 0)) {
          fail(iteration, bytes, 'residual byte count disagrees with its slices');
        }
      }
      expect(ITERATIONS).toBe(FULL_CAMPAIGN ? 1_000_000 : 2_000);
    },
    15 * 60 * 1000,
  );
});
