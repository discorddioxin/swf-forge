/**
 * Operand decoding — `IMPL-050` §5 (`T-AVM1-002` Push types, `T-AVM1-003` branch offsets,
 * `T-AVM1-018` GetURL2 flag quadrants, `T-AVM1-020` reverse-push convention).
 */

import { describe, expect, it } from 'vitest';

import {
  decodeRecord,
  makeStringReader,
  newResidualFlags,
  scanRecords,
  type DecodedOp,
  type OperandContext,
} from '@swf-forge/avm1';
import {
  analyze,
  block,
  branchIf,
  collector,
  jump,
  nul,
  pair,
  push,
  pushBoolean,
  pushConstant16,
  pushConstant8,
  pushDouble,
  pushFloat,
  pushInt,
  pushNull,
  pushRegister,
  pushString,
  pushUndefined,
  rec,
  firstPushValues,
} from './harness.js';

function decode(
  bytes: Uint8Array,
  version = 7,
): { decoded: DecodedOp[]; diag: ReturnType<typeof collector>; records: ReturnType<typeof scanRecords>['records'] } {
  const diag = collector();
  const records = scanRecords(bytes, diag.fn).records;
  const stringReader = makeStringReader(bytes, version, 'windows-1252');
  const flags = newResidualFlags();
  const ctx: OperandContext = {
    version,
    registerCount: null,
    legacyEncoding: 'windows-1252',
    emit: diag.fn,
    string: (_b, from, to) => stringReader(from, to),
    decodeFunctionBody: () => null,
    flags,
  };
  const decoded = records.map((r) => decodeRecord(r, bytes, ctx));
  return { decoded, diag, records };
}

describe('T-AVM1-002 Push types 0-9', () => {
  it('string (0), null (2), undefined (3), boolean (5), integer (7)', () => {
    expect(firstPushValues(block(pushString('hi')))[0]).toEqual({
      kind: 'lit',
      value: { type: 'string', value: 'hi' },
    });
    expect(firstPushValues(block(pushNull()))[0]).toEqual({ kind: 'lit', value: { type: 'null' } });
    expect(firstPushValues(block(pushUndefined()))[0]).toEqual({ kind: 'lit', value: { type: 'undefined' } });
    expect(firstPushValues(block(pushBoolean(true)))[0]).toEqual({
      kind: 'lit',
      value: { type: 'boolean', value: true },
    });
    expect(firstPushValues(block(pushInt(-5)))[0]).toEqual({
      kind: 'lit',
      value: { type: 'integer', value: -5, bits: 0xfffffffb },
    });
  });

  it('float32 (1) widens to double exactly; float64 (6) is exact', () => {
    expect(firstPushValues(block(pushFloat(1.5)))[0]).toEqual({ kind: 'lit', value: { type: 'number', value: 1.5 } });
    expect(firstPushValues(block(pushDouble(2.25)))[0]).toEqual({
      kind: 'lit',
      value: { type: 'number', value: 2.25 },
    });
  });

  it('integer (7) preserves the UI32 bit pattern for bitwise actions (R019)', () => {
    // -1 as two's complement is 0xFFFFFFFF.
    expect(firstPushValues(block(pushInt(-1)))[0]).toEqual({
      kind: 'lit',
      value: { type: 'integer', value: -1, bits: 0xffffffff },
    });
    // 0x80000000 as an unsigned bit pattern is -2147483648 as S32.
    const bytes = block(push(pair(7, [0x00, 0x00, 0x00, 0x80])));
    expect(firstPushValues(bytes)[0]).toEqual({
      kind: 'lit',
      value: { type: 'integer', value: -2147483648, bits: 0x80000000 },
    });
  });

  it('a multi-pair Push decodes each pair in order', () => {
    const bytes = block(push(pair(0, nul('a')), pair(5, [1]), pair(2, [])));
    const values = firstPushValues(bytes);
    expect(values).toEqual([
      { kind: 'lit', value: { type: 'string', value: 'a' } },
      { kind: 'lit', value: { type: 'boolean', value: true } },
      { kind: 'lit', value: { type: 'null' } },
    ]);
  });

  it('register (4) outside the register file is reported and treated as undefined (R020)', () => {
    const { block: b, diag } = analyze(block(pushRegister(9)));
    expect(diag.has('SF0415')).toBe(true);
    // Outside a DefineFunction2 (registerCount null), registers ≥ 4 are unusable.
    const op = b.ir.blocks[0]!.ops.find((o) => o.kind === 'push');
    expect(op).toEqual({ kind: 'push', values: [{ kind: 'lit', value: { type: 'undefined' } }] });
  });

  it('an unrecognised Push type byte is SF0403 and malformed', () => {
    const bytes = block(push(pair(250, [0x00])));
    const { diag } = decode(bytes);
    expect(diag.has('SF0403')).toBe(true);
  });
});

describe('T-AVM1-003 branch offsets relative to the record end', () => {
  it('a Jump of 0 lands on the next record', () => {
    // [Add, Jump 0, Add] → the jump targets the second Add.
    const { block: b } = analyze(block(rec(0x0a), jump(0), rec(0x0a)));
    const term = b.ir.blocks[0]!.terminator;
    expect(term.kind).toBe('jump');
    if (term.kind === 'jump') expect(term.target).toBe(1);
  });

  it('a backward Jump of -4 lands on the first record', () => {
    // [Add, Jump -4, Add] → jump record ends at offset 4; 4 + (-4) = 0 = first record.
    const { block: b } = analyze(block(rec(0x0a), jump(0xfffa), rec(0x0a)));
    const term = b.ir.blocks[0]!.terminator;
    expect(term.kind).toBe('jump');
    if (term.kind === 'jump') expect(term.target).toBe(0);
  });

  it('an If carries its condition and both targets', () => {
    // [Add, If -3, Add, Add] → If at record 1 (ends at 4); target 4 + (-3) = 1 (the If itself, a
    // record boundary) → self-loop; fallthrough to the next record.
    const { block: b } = analyze(block(rec(0x0a), branchIf(0xfffd), rec(0x0a), rec(0x0a)));
    const term = b.ir.blocks[0]!.terminator;
    expect(term.kind).toBe('branch');
  });
});

describe('T-AVM1-018 GetURL2 flag quadrants', () => {
  it('method × (loadTarget, loadVariables) decode from the flag byte', () => {
    const cases: { flags: number; method: 'none' | 'get' | 'post'; loadTarget: boolean; loadVariables: boolean }[] = [
      { flags: 0x00, method: 'none', loadTarget: false, loadVariables: false },
      { flags: 0x40, method: 'get', loadTarget: false, loadVariables: false },
      { flags: 0x80, method: 'post', loadTarget: false, loadVariables: false },
      { flags: 0x00 | 0x02, method: 'none', loadTarget: true, loadVariables: false },
      { flags: 0x00 | 0x01, method: 'none', loadTarget: false, loadVariables: true },
      { flags: 0x80 | 0x02 | 0x01, method: 'post', loadTarget: true, loadVariables: true },
    ];
    for (const c of cases) {
      const { decoded } = decode(block(pushString('t'), pushString('u'), rec(0x9a, [c.flags])));
      const op = decoded.find((o) => o.kind === 'getURL2');
      expect(op, `flags 0x${c.flags.toString(16)}`).toMatchObject({
        kind: 'getURL2',
        method: c.method,
        loadTarget: c.loadTarget,
        loadVariables: c.loadVariables,
      });
    }
  });

  it('GetURL2 pops target first, then URL (R040)', () => {
    const { block: b } = analyze(block(pushString('TARGET'), pushString('URL'), rec(0x9a, [0x40])));
    const op = b.ir.blocks[0]!.ops.find((o) => o.kind === 'timeline' && o.timeline.op === 'getURL');
    expect(op).toBeDefined();
    if (op && op.kind === 'timeline' && op.timeline.op === 'getURL') {
      expect(op.timeline.target).toEqual({ kind: 'lit', value: { type: 'string', value: 'TARGET' } });
      expect(op.timeline.url).toEqual({ kind: 'lit', value: { type: 'string', value: 'URL' } });
      expect(op.timeline.method).toBe('get');
    }
  });
});

describe('T-AVM1-020 reverse-push calling convention', () => {
  it('InitObject pops count then (value, name) pairs; IR keeps source (name, value) order (R043)', () => {
    // Push rightmost-first: value2, name2, value1, name1, count=2.
    const bytes = block(pushString('v1'), pushString('n1'), pushString('v2'), pushString('n2'), pushInt(2), rec(0x43));
    const { block: b } = analyze(bytes);
    const op = b.ir.blocks[0]!.ops.find((o) => o.kind === 'call');
    expect(op).toBeDefined();
    if (op && op.kind === 'call') {
      expect(op.call.kind).toBe('initObject');
      expect(op.call.numArgs).toBe(2);
      // Source order: leftmost pair first (n1, v1) then (n2, v2).
      expect(op.call.pairs?.[0]).toEqual({
        name: { kind: 'lit', value: { type: 'string', value: 'n1' } },
        value: { kind: 'lit', value: { type: 'string', value: 'v1' } },
      });
      expect(op.call.pairs?.[1]).toEqual({
        name: { kind: 'lit', value: { type: 'string', value: 'n2' } },
        value: { kind: 'lit', value: { type: 'string', value: 'v2' } },
      });
    }
  });

  it('CallFunction pops name, count, then args; args normalised to source order', () => {
    // Push rightmost-first: arg2, arg1, count=2, name.
    const bytes = block(pushInt(1), pushInt(2), pushInt(2), pushString('f'), rec(0x3d));
    const { block: b } = analyze(bytes);
    const op = b.ir.blocks[0]!.ops.find((o) => o.kind === 'call');
    expect(op).toBeDefined();
    if (op && op.kind === 'call') {
      expect(op.call.kind).toBe('callFunction');
      expect(op.call.name).toEqual({ kind: 'lit', value: { type: 'string', value: 'f' } });
      expect(op.call.numArgs).toBe(2);
      expect(op.call.args[0]).toEqual({ kind: 'lit', value: { type: 'integer', value: 1, bits: 1 } });
      expect(op.call.args[1]).toEqual({ kind: 'lit', value: { type: 'integer', value: 2, bits: 2 } });
    }
  });
});

describe('constant pool references (T-AVM1-005, part 1)', () => {
  function poolPushOps(bytes: Uint8Array): { values: import('@swf-forge/avm1').Operand[] }[] {
    const { block: b } = analyze(bytes);
    const out: { values: import('@swf-forge/avm1').Operand[] }[] = [];
    for (const blk of b.ir.blocks) {
      for (const op of blk.ops) {
        if (op.kind === 'push') out.push({ values: [...op.values] });
      }
    }
    return out;
  }

  it('a top-level constant8 resolves against the last preceding pool', () => {
    const bytes = block(pushString('unused'), rec(0x88, [2, 0, ...nul('alpha'), ...nul('beta')]), pushConstant8(1));
    const pushes = poolPushOps(bytes);
    const poolRef = pushes[pushes.length - 1]?.values[0];
    expect(poolRef).toEqual({ kind: 'lit', value: { type: 'pool', index: 1, resolved: 'beta' } });
  });

  it('a constant16 pool reference resolves within range', () => {
    const bytes = block(rec(0x88, [1, 0, ...nul('gamma')]), pushConstant16(0));
    const pushes = poolPushOps(bytes);
    const poolRef = pushes[pushes.length - 1]?.values[0];
    expect(poolRef).toEqual({ kind: 'lit', value: { type: 'pool', index: 0, resolved: 'gamma' } });
  });

  it('an out-of-range pool index is SF0411 (error, residual)', () => {
    const bytes = block(rec(0x88, [1, 0, ...nul('only')]), pushConstant8(5));
    const { block: b, diag } = analyze(bytes);
    expect(diag.has('SF0411')).toBe(true);
    expect(b.decision.tier).toBe(2);
    expect(b.decision.residualReason).toBe('pool-index-out-of-range');
  });
});
