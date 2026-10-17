/**
 * Byte round trip — `T-AVM1-FE-034` (`IMPL-050` §5.7, `WP-050-18`): `decode → IR → serialize`
 * reproduces canonical input bytes exactly.
 *
 * The decode side is the front end's own (`scanRecords` + `decodeRecord`), never a test-local
 * reader, and the fixtures are built with the same harness DSL as the rest of the suite, so the
 * test cannot agree with the serializer against a third, wrong reading (the `E-034` trap).
 * Non-canonical input is diagnosed, not normalized, and lands on a second-generation fixed
 * point; reserved/undefined codes refuse serialization and stay residual (R067/R068).
 */

import { describe, expect, it } from 'vitest';

import {
  OPCODES,
  decodeRecord,
  makeStringReader,
  newResidualFlags,
  scanRecords,
  serializeBlock,
  type ActionRecord,
  type DecodedOp,
  type OperandContext,
  type SerializeNode,
} from '../src/index.js';
import { block, defineFunction, defineFunction2, nul, push, rec, tryRegion, withRegion } from './harness.js';

interface Diag {
  code: string;
  message: string;
}

function nodesFor(bytes: Uint8Array, version: number, diags: Diag[], topLevel: boolean): SerializeNode[] {
  const emit = (code: string, _severity: string, message: string): void => {
    diags.push({ code, message });
  };
  const scan = scanRecords(bytes, emit, topLevel ? {} : { requireEnd: false, stopAtEnd: false });
  const ctx: OperandContext = {
    version,
    registerCount: null,
    legacyEncoding: 'windows-1252',
    emit: emit as OperandContext['emit'],
    string: (_bytes, from, to) => makeStringReader(bytes, version, 'windows-1252')(from, to),
    decodeFunctionBody: () => null,
    flags: newResidualFlags(),
    limit: bytes.length,
  };
  return scan.records.map((record: ActionRecord): SerializeNode => {
    const op: DecodedOp = decodeRecord(record, bytes, ctx);
    switch (op.kind) {
      case 'with':
        return { op, source: record, body: nodesFor(bytes.subarray(op.bodyStart, op.bodyEnd), version, diags, false) };
      case 'try': {
        const h = op.header;
        const start = h.headerEnd;
        return {
          op,
          source: record,
          tryBody: nodesFor(bytes.subarray(start, start + h.trySize), version, diags, false),
          catchBody: nodesFor(
            bytes.subarray(start + h.trySize, start + h.trySize + h.catchSize),
            version,
            diags,
            false,
          ),
          finallyBody: nodesFor(
            bytes.subarray(start + h.trySize + h.catchSize, start + h.trySize + h.catchSize + h.finallySize),
            version,
            diags,
            false,
          ),
        };
      }
      case 'defineFunction':
        return {
          op,
          source: record,
          body: nodesFor(bytes.subarray(op.fn.bodyStart, op.fn.bodyEnd), version, diags, false),
        };
      default:
        return { op, source: record } as SerializeNode;
    }
  });
}

function roundTrip(bytes: Uint8Array, version = 6): { out: Uint8Array | null; diags: Diag[] } {
  const diags: Diag[] = [];
  const nodes = nodesFor(bytes, version, diags, true);
  const out = serializeBlock(nodes, {
    version,
    legacyEncoding: 'windows-1252',
    emit: (code, _severity, message) => diags.push({ code, message }),
  });
  return { out, diags };
}

function hex(bytes: Uint8Array | null): string {
  return bytes === null ? 'null' : [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

/** A canonical one-record block per opcode, by payload schema. */
function canonicalRecordFor(code: number, payloadKind: string): number[] {
  switch (payloadKind) {
    case 'none':
      return rec(code);
    case 'fixed':
      return rec(code, [0]);
    case 'jump':
    case 'if':
      return rec(code, [0, 0]);
    case 'gotoFrame':
      return rec(code, [0x34, 0x12]);
    case 'getURL':
      return rec(code, [...nul('http://example.invalid/'), ...nul('_self')]);
    case 'setTarget':
      return rec(code, nul('/clip'));
    case 'gotoLabel':
      return rec(code, nul('label'));
    case 'waitForFrame':
      return rec(code, [0x34, 0x12, 2]);
    case 'waitForFrame2':
      return rec(code, [2]);
    case 'storeRegister':
      return rec(code, [1]);
    case 'getURL2':
      return rec(code, [0x42]);
    case 'gotoFrame2':
      return rec(code, [0x03, 0x10, 0x00]); // SceneBiasFlag + Play, bias 16
    case 'constantPool':
      return rec(code, [2, 0, ...nul('alpha'), ...nul('beta')]);
    case 'push':
      return push([0, ...nul('s')], [7, 0xff, 0xff, 0xff, 0xff], [3]);
    case 'with':
      return withRegion(1, [0x04]);
    case 'defineFunction':
      return defineFunction({ name: 'f', params: ['a'], body: [0x3e, 0x00] });
    case 'defineFunction2':
      return defineFunction2({ name: 'g', params: ['x'], registerCount: 4, flags: 0x0101, body: [0x3e, 0x00] });
    case 'try':
      return tryRegion({ catchName: 'e', try: [0x04], catch: [0x05], finally: [0x06], finallyPresent: true });
    default:
      throw new Error(`no canonical fixture for payload kind ${payloadKind}`);
  }
}

describe('byte round trip (IMPL-050 §5.7)', () => {
  it('T-AVM1-FE-034: every defined opcode round-trips byte-identically at least once', () => {
    const failures: string[] = [];
    for (const spec of OPCODES.values()) {
      if (spec.code === 0x00) continue; // End terminates every block below instead
      const bytes = block(canonicalRecordFor(spec.code, spec.payload.kind));
      const { out, diags } = roundTrip(bytes);
      if (out === null || hex(out) !== hex(bytes)) {
        failures.push(
          `${spec.name} (0x${spec.code.toString(16)}): in=[${hex(bytes)}] out=[${hex(out)}] diags=${diags.map((d) => d.code).join(',')}`,
        );
      }
    }
    expect(failures).toEqual([]);
    expect(OPCODES.size).toBeGreaterThan(90);
  });

  it('T-AVM1-FE-034: every Push type (§5.1 schema) round-trips in one record', () => {
    const doubleBytes = new Uint8Array(8);
    new DataView(doubleBytes.buffer).setFloat64(0, Math.PI, true);
    const record = push(
      [0, ...nul('text')],
      [1, 0x00, 0x00, 0xc0, 0x3f], // float32 1.5, bit pattern preserved
      [2],
      [3],
      [4, 2],
      [5, 1],
      [6, ...doubleBytes],
      [7, 0x78, 0x56, 0x34, 0x12],
      [8, 0x2a],
      [9, 0x2a, 0x01],
    );
    const bytes = block(record);
    const { out } = roundTrip(bytes);
    expect(out === null ? null : hex(out)).toBe(hex(bytes));
  });

  it('T-AVM1-FE-034: branch operands are recomputed from targets, and unicode strings survive (UTF-8 file)', () => {
    // Jump over a Push, then a string with non-ASCII text outside a Push (a label).
    const jumpOver = rec(0x99, [3, 0]); // +3: skips the 3-byte NextFrame region below (record-relative)
    const bytes = block(jumpOver, [0x04], rec(0x8c, [...new TextEncoder().encode('étiquette'), 0]), [0x06]);
    const { out } = roundTrip(bytes, 6);
    expect(out === null ? null : hex(out)).toBe(hex(bytes));
  });

  it('T-AVM1-FE-034: nested regions (function in a With, Try in a function) round-trip', () => {
    const tryBytes = tryRegion({
      catchInRegister: true,
      catchRegister: 1,
      try: [0x04],
      catch: [0x3e],
      finally: [0x06],
      finallyPresent: true,
    });
    const fn = defineFunction2({
      name: 'outer',
      params: ['p'],
      registerCount: 3,
      flags: 0,
      body: [...tryBytes, 0x3e, 0x00],
    });
    const bytes = block(withRegion(fn.length, fn), [0x07]);
    const { out } = roundTrip(bytes);
    expect(out === null ? null : hex(out)).toBe(hex(bytes));
  });

  it('T-AVM1-FE-034: non-canonical padding is diagnosed and lands on a second-generation fixed point', () => {
    // GotoFrame declaring 4 payload bytes (2 real + 2 padding): decodable, not canonical (R065).
    const bytes = block(rec(0x81, [0x34, 0x12, 0x00, 0x00]));
    const first = roundTrip(bytes);
    expect(first.out).not.toBeNull();
    expect(hex(first.out)).not.toBe(hex(bytes));
    expect(first.diags.some((d) => d.code === 'SF0401')).toBe(true);
    const second = roundTrip(first.out as Uint8Array);
    expect(second.out === null ? null : hex(second.out)).toBe(hex(first.out));
  });

  it('T-AVM1-FE-034: reserved/undefined codes refuse serialization and stay residual (R068)', () => {
    const bytes = block([0x01]); // an undefined sub-0x80 code (UNDEFINED_CODES): zero-payload unknown record
    const { out, diags } = roundTrip(bytes);
    expect(out).toBeNull();
    expect(diags.some((d) => d.code === 'SF0402')).toBe(true);
  });

  it('T-AVM1-FE-034: serialization is a pure function of the decoded nodes (R069)', () => {
    const bytes = block(push([0, ...nul('x')], [8, 1]), rec(0x9d, [0, 0]), [0x07]);
    const diags: Diag[] = [];
    const nodes = nodesFor(bytes, 6, diags, true);
    const ctx = { version: 6, legacyEncoding: 'windows-1252' as const, emit: () => undefined };
    const a = serializeBlock(nodes, ctx);
    const b = serializeBlock(nodes, ctx);
    expect(a === null || b === null ? null : hex(a)).toBe(b === null ? null : hex(b));
    expect(a === null ? null : hex(a)).toBe(hex(bytes));
  });
});
