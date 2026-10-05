/**
 * Tier assignment and residual extraction — `IMPL-050` §7 (`T-AVM1-007` stack mismatch,
 * `T-AVM1-008` one fixture per tier reason, `T-AVM1-009` out-of-bounds branch).
 */

import { describe, expect, it } from 'vitest';

import { analyze, block } from './harness.js';

describe('T-AVM1-007 stack mismatch -> residual with reason, no crash', () => {
  it('an Add over one pushed value is SF0406, tier 2, residual slice present', () => {
    const bytes = block([0x96, 5, 0, 7, 1, 0, 0, 0], [0x0a]); // Push 1; Add (needs two)
    const { block: b, diag } = analyze(bytes);
    expect(diag.has('SF0406')).toBe(true);
    expect(b.decision.tier).toBe(2);
    expect(b.reasons).toContain('stack-mismatch');
    expect(b.residual).not.toBeNull();
    // The residual byte range covers the offending record.
    expect(b.residual.length).toBeGreaterThan(0);
  });
});

describe('T-AVM1-008 tier assignment: one fixture per reason', () => {
  const cases: { readonly reason: string; readonly tier: 0 | 1 | 2; readonly bytes: number[] }[] = [
    { reason: 'clean: Push; End', tier: 0, bytes: [0x96, 5, 0, 7, 1, 0, 0, 0, 0x00] },
    { reason: 'unknown-opcode:0x01 (undefined sub-0x80)', tier: 2, bytes: [0x01, 0x00] },
    { reason: 'record-truncated (length field cut off)', tier: 2, bytes: [0x96, 5] },
    { reason: 'push-malformed (bad type byte)', tier: 2, bytes: [0x96, 2, 0, 0xff, 0x00] },
    { reason: 'stack-mismatch', tier: 2, bytes: [0x96, 5, 0, 7, 1, 0, 0, 0, 0x0a, 0x00] },
    { reason: 'branch-out-of-bounds (obfuscated jump past the end)', tier: 2, bytes: [0x99, 2, 0, 5, 0x00] },
    {
      reason: 'dynamic-with (With over a non-literal value)',
      tier: 1,
      // Push "s"; Enumerate; With { Push 1, Pop } — the With object is an unverified stack
      // value (Enumerate's result), not a literal.
      bytes: [
        0x96,
        3,
        0,
        0,
        0x73,
        0, // Push "s"
        0x46, // Enumerate
        0x94,
        11,
        0,
        9,
        0, // With, size 9
        0x96,
        5,
        0,
        7,
        1,
        0,
        0,
        0, // Push 1
        0x17, // Pop
        0x00, // End
      ],
    },
  ];

  for (const { reason, tier, bytes } of cases) {
    it(`${reason}`, () => {
      const { block: b } = analyze(Uint8Array.from(bytes));
      expect(b.decision.tier).toBe(tier);
      if (tier === 0) {
        expect(b.reasons).toEqual([]);
      } else {
        expect(b.reasons.length).toBeGreaterThan(0);
      }
    });
  }

  it('the reason strings are machine-stable (exact head match)', () => {
    const { block: b } = analyze(Uint8Array.from([0x01, 0x00]));
    expect(b.reasons.some((r) => r.startsWith('unknown-opcode:0x01'))).toBe(true);
  });
});

describe('T-AVM1-009 out-of-bounds branch', () => {
  it('a Jump past the block end is SF0405, reported, and makes the block residual', () => {
    const bytes = [0x99, 2, 0, 5, 0x00]; // Jump +5 lands at offset 8; the block ends at 5.
    const { block: b, diag } = analyze(Uint8Array.from(bytes));
    expect(diag.has('SF0405')).toBe(true);
    expect(b.decision.tier).toBe(2);
    expect(b.reasons).toContain('branch-out-of-bounds');
    // The terminator records the invalid target.
    expect(b.ir.blocks[0]?.terminator.kind).toBe('jump');
    expect((b.ir.blocks[0]?.terminator as { target: number | null }).target).toBeNull();
  });
});
