/**
 * Tier assignment and residual extraction — `IMPL-050` §7 (`T-AVM1-FE-007` stack mismatch,
 * `T-AVM1-FE-008` one fixture per tier reason, `T-AVM1-FE-009` out-of-bounds branch).
 */

import { describe, expect, it } from 'vitest';

import {
  analyze,
  block,
  branchIf,
  constantPool,
  defineFunction2,
  jump,
  pushBoolean,
  pushConstant8,
  pushInt,
  pushRegister,
  pushString,
  rec,
  withRegion,
} from './harness.js';

describe('T-AVM1-FE-007 stack mismatch -> residual with reason, no crash', () => {
  it('an Add over one pushed value is SF0406, tier 2, residual slice present', () => {
    const bytes = block(pushInt(1), rec(0x0a)); // Push 1; Add (needs two)
    const { block: b, diag } = analyze(bytes);
    expect(diag.has('SF0406')).toBe(true);
    expect(b.decision.tier).toBe(2);
    expect(b.reasons).toContain('stack-mismatch');
    expect(b.residual).not.toBeNull();
    // The residual byte range covers the offending record.
    expect(b.residual.length).toBeGreaterThan(0);
  });
});

describe('T-AVM1-FE-008 tier assignment: one fixture per reason', () => {
  const cases: {
    readonly label: string;
    readonly tier: 0 | 1 | 2;
    readonly expectedReasons: readonly string[];
    readonly bytes: Uint8Array;
    readonly inFunction?: boolean;
  }[] = [
    { label: 'clean block', tier: 0, expectedReasons: [], bytes: block(pushInt(1)) },
    {
      label: 'unknown opcode 0x01',
      tier: 2,
      expectedReasons: ['unknown-opcode:0x01'],
      bytes: block([0x01]),
    },
    {
      label: 'record truncated in the payload',
      tier: 2,
      expectedReasons: ['record-truncated'],
      bytes: Uint8Array.from([0x96, 5]),
    },
    {
      label: 'record overrun',
      tier: 2,
      expectedReasons: ['record-overrun'],
      bytes: Uint8Array.from([0x99, 5, 0, 0x01, 0x02, 0x00]),
    },
    {
      label: 'malformed Push type byte',
      tier: 2,
      expectedReasons: ['push-malformed'],
      bytes: block([0x96, 2, 0, 0xff]),
    },
    {
      label: 'malformed Try body tiling',
      tier: 2,
      expectedReasons: ['try-malformed'],
      // Try header declares three empty bodies, but `Length` covers one byte past them: that byte
      // belongs to no region, so the record does not tile (`SF0404`, R034/R071).
      bytes: block(rec(0x8f, [0, 0, 0, 0, 0, 0, 0, 0])),
    },
    {
      label: 'out-of-range constant-pool index',
      tier: 2,
      expectedReasons: ['pool-index-out-of-range'],
      bytes: block(constantPool('only'), pushConstant8(5)),
    },
    {
      label: 'stack mismatch',
      tier: 2,
      expectedReasons: ['stack-mismatch'],
      bytes: block(pushInt(1), rec(0x0a)),
    },
    {
      label: 'branch leaves the block',
      tier: 2,
      expectedReasons: ['branch-out-of-bounds'],
      bytes: block(jump(5)),
    },
    {
      label: 'dynamic With object',
      tier: 1,
      // `dynamic-stack` rides along: Enumerate makes the value dynamic, so the With body is entered
      // at an unknown depth, and the block after the region is now a real join with that body as its
      // predecessor (errata E-040) — the continuation's depth really is unknown here.
      expectedReasons: ['dynamic-stack', 'dynamic-with'],
      // Enumerate makes its result dynamic; With encloses one Push and one Pop (9 bytes).
      bytes: block(pushString('s'), rec(0x46), withRegion(9, [...pushInt(1), ...rec(0x17)])),
    },
    {
      label: 'function constant-pool reference',
      tier: 1,
      expectedReasons: ['dynamic-pool'],
      bytes: block(pushConstant8(0)),
      inFunction: true,
    },
    {
      label: 'dynamic CallFunction target',
      tier: 1,
      expectedReasons: ['call-dynamic-target'],
      bytes: block(pushInt(0), pushString('target'), rec(0x1c), rec(0x3d)),
    },
    {
      label: 'stack-based SetTarget2',
      tier: 1,
      expectedReasons: ['target-in-branch'],
      bytes: block(pushString('target'), rec(0x1c), rec(0x20)),
    },
    {
      label: 'runtime CallFunction argument count',
      tier: 1,
      expectedReasons: ['dynamic-args'],
      bytes: block(pushString('count'), rec(0x1c), pushString('f'), rec(0x3d)),
    },
    {
      label: 'runtime ActionCall frame target',
      tier: 1,
      expectedReasons: ['frame-call-target-unresolved'],
      bytes: block(pushString('frame'), rec(0x1c), rec(0x9e)),
    },
    {
      label: 'unknown stack depth at a control-flow join',
      tier: 1,
      expectedReasons: ['dynamic-stack'],
      bytes: block(pushBoolean(true), branchIf(12), pushString('s'), rec(0x46), jump(8), pushInt(1), rec(0x17)),
    },
  ];

  for (const { label, tier, expectedReasons, bytes, inFunction } of cases) {
    it(`${label}`, () => {
      const { block: b } = analyze(bytes, inFunction === undefined ? {} : { inFunction });
      expect(b.decision.tier).toBe(tier);
      expect(b.reasons).toEqual(expectedReasons);
    });
  }

  it('a nested DefineFunction2 reports its own out-of-range register reason', () => {
    const bytes = block(defineFunction2({ name: 'registerUser', registerCount: 1, body: [...pushRegister(1), 0x00] }));
    const { block: b, diag } = analyze(bytes);
    const definition = b.ir.blocks.flatMap((basic) => basic.ops).find((op) => op.kind === 'define');

    expect(diag.has('SF0416')).toBe(true);
    expect(definition?.kind).toBe('define');
    if (definition?.kind !== 'define') return;
    expect(definition.fn.ir?.tier).toBe(2);
    expect(definition.fn.ir?.tierReasons.map((reason) => reason.reason)).toEqual(['register-out-of-range']);
  });

  it('ActionCall is preserved as front-end timeline IR (this does not test runtime execution)', () => {
    const { block: b } = analyze(block(pushString('frame'), rec(0x1c), rec(0x9e)));
    const call = b.ir.blocks
      .flatMap((basic) => basic.ops)
      .find((op) => op.kind === 'timeline' && op.timeline.op === 'call');

    expect(call?.kind).toBe('timeline');
    if (call?.kind === 'timeline' && call.timeline.op === 'call') {
      expect(call.timeline.frame.kind).toBe('temp');
    }
  });
});

describe('T-AVM1-FE-009 out-of-bounds branch', () => {
  it('a Jump past the block end is SF0405, reported, and makes the block residual', () => {
    const bytes = block(jump(5)); // Jump +5 lands past the block end.
    const { block: b, diag } = analyze(bytes);
    expect(diag.has('SF0405')).toBe(true);
    expect(b.decision.tier).toBe(2);
    expect(b.reasons).toContain('branch-out-of-bounds');
    // The terminator records the invalid target.
    expect(b.ir.blocks[0]?.terminator.kind).toBe('jump');
    expect((b.ir.blocks[0]?.terminator as { target: number | null }).target).toBeNull();
  });
});
