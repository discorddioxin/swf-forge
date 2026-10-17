/**
 * Control flow through a region — `IMPL-050-R073`, errata `E-040`.
 *
 * A region body is its own scope (`IMPL-050-R035`), but it is not a detour the enclosing stream skips:
 * the player runs the body on the same stack and then continues after the region, so whatever a body
 * leaves is there for the next action. `action_try` runs the try body, then the catch body on a throw,
 * then the finally body, all on one continuous stack; `action_with` runs its body the same way
 * (ruffle-rs/ruffle `core/src/avm1/activation.rs`, Apache-2.0 OR MIT).
 *
 * The CFG used to model a region op as stack-neutral and the records after it as its plain successor,
 * so a body's net effect never reached them: a `Pop` directly after a `Try` underflowed against a stack
 * the model believed was empty, reported `SF0406`, and tiered the block **2** with `stack-mismatch` —
 * a false residual on content the player runs happily. Now the block holding a region op falls into the
 * body, a body falls into the region's `finally` when it has one, and the last body falls back to the
 * record after the region op, so the continuation is a real join over the bodies' exits.
 *
 * Two consequences are pinned here as well: a genuine disagreement between the try and catch exits is
 * still `SF0406` (R054 reports a mismatch, it never fixes one), and an unreachable tail inside a region
 * body does not hold that join — and everything after it — hostage forever.
 *
 * Every fixture places its regions past the record's `Length`, as real content does (`IMPL-050-R071`).
 */

import { describe, expect, it } from 'vitest';

import type { AnalyzedBlock, BasicBlock, Op } from '../src/index.js';
import { analyze, block, pushString, rec, tryRegion, withRegion } from './harness.js';

const POP = rec(0x17);
const RETURN = 0x3e;

function opsOf(b: AnalyzedBlock): readonly Op[] {
  return b.ir.blocks.flatMap((blk) => blk.ops);
}

/** The string literals pushed anywhere in the IR. Block order is CFG order, not offset order. */
function pushed(b: AnalyzedBlock): string[] {
  const out: string[] = [];
  for (const blk of b.ir.blocks) {
    for (const op of blk.ops) {
      if (op.kind !== 'push') continue;
      for (const operand of op.values) {
        if (operand.kind === 'lit' && operand.value.type === 'string') out.push(operand.value.value);
      }
    }
  }
  return out;
}

function errors(b: { diag: { all: readonly { severity: string; code: string }[] } }): string[] {
  return b.diag.all.filter((d) => d.severity === 'error').map((d) => d.code);
}

/** The entry depths present in the IR, so a test can name the continuation without an offset. */
function depthsIn(b: AnalyzedBlock): number[] {
  return b.ir.blocks.map((blk: BasicBlock) => blk.stackIn);
}

describe('T-AVM1-FE-041 the code after a region is entered from the region bodies', () => {
  it("hands a Try body's leftover to the record after the region", () => {
    // Both bodies leave one value, so the continuation enters at 1 and its `Pop` is satisfied: before
    // `IMPL-050-R073` this block reported `SF0406` and tiered 2 with `stack-mismatch`.
    const bytes = block(
      tryRegion({
        catchName: 'e',
        try: [...pushString('v')],
        catch: [...pushString('c')],
      }),
      POP,
      pushString('sibling'),
    );
    const { block: b, diag } = analyze(bytes);

    expect(errors({ diag })).toEqual([]);
    expect(b.decision.tier).toBe(0);
    expect(b.reasons).toEqual([]);
    expect(pushed(b).sort()).toEqual(['c', 'sibling', 'v']);
    expect(depthsIn(b)).toContain(1); // the continuation, entered from the bodies
  });

  it('enters the continuation from the finally body, not from the Try record', () => {
    // The try and catch bodies both leave 1, so the finally enters at 1 (R072) and leaves 2: the code
    // after the region inherits the finally's depth, which is neither the Try record's depth nor the
    // try body's.
    const bytes = block(
      tryRegion({
        catchName: 'e',
        finallyPresent: true,
        try: [...pushString('v')],
        catch: [...pushString('c')],
        finally: [...pushString('f')],
      }),
      pushString('sibling'),
    );
    const { block: b, diag } = analyze(bytes);

    expect(errors({ diag })).toEqual([]);
    expect(b.decision.tier).toBe(0);
    expect(pushed(b).sort()).toEqual(['c', 'f', 'sibling', 'v']);
    expect(depthsIn(b)).toContain(2);
  });

  it("hands a With body's leftover to the record after the region", () => {
    const body = [...pushString('in')];
    const bytes = block(pushString('scope'), withRegion(body.length, body), POP, pushString('sibling'));
    const { block: b, diag } = analyze(bytes);

    expect(errors({ diag })).toEqual([]);
    expect(b.decision.tier).toBe(0);
    expect(pushed(b).sort()).toEqual(['in', 'scope', 'sibling']);
    expect(depthsIn(b)).toContain(1);
  });

  it('still reports SF0406 when the try and catch bodies leave different depths', () => {
    // R054: a mismatch is reported, never fixed. The try body leaves one value and the catch body
    // leaves two, and with no finally between them the code after the region really is ill-defined.
    const bytes = block(
      tryRegion({
        catchName: 'e',
        try: [...pushString('v')],
        catch: [...pushString('c'), ...pushString('d')],
      }),
      pushString('sibling'),
    );
    const { block: b, diag } = analyze(bytes);

    expect(diag.has('SF0406')).toBe(true);
    expect(diag.all.find((d) => d.code === 'SF0406')?.message).toMatch(/join/);
    expect(b.decision.tier).toBe(2);
    expect(b.reasons).toContain('stack-mismatch');
  });

  it('does not let a dead tail inside a region body drop the code after it', () => {
    // The try body returns, so the records after that `Return` form a block nothing can reach. It is
    // still a successor of the region body's scope, and waiting for a depth it will never get used to
    // stall the join — which dropped every record after the region from the IR.
    const bytes = block(
      tryRegion({
        catchName: 'e',
        try: [...pushString('v'), RETURN, ...pushString('dead')],
        catch: [...pushString('c'), ...POP],
      }),
      pushString('sibling'),
    );
    const { block: b, diag } = analyze(bytes);

    expect(errors({ diag })).toEqual([]);
    expect(b.decision.tier).toBe(0);
    expect(pushed(b)).toContain('sibling');
    expect(opsOf(b).some((op) => op.kind === 'end')).toBe(true);
  });
});
