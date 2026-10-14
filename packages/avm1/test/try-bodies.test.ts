/**
 * A `Try`'s three region bodies reach the IR — `IMPL-050-R072`, errata `E-039`.
 *
 * A `Try` owns three body scopes (`try`, `catch`, `finally`) that share a single region record. The
 * depth pass seeded one body-entry frame per region *record*, so a `Try`'s catch and finally entry
 * frames never settled an input depth, were never simulated, and their decoded records reached the IR
 * as blocks with no ops. An emitter reading `catchBlocks` would then have dropped the catch code
 * silently, which `IMPL-050-R035` forbids. `regions.test.ts` did not catch it because its assertions
 * are `not.toBeNull()`, which an empty array satisfies.
 *
 * Each body starts at the depth the player gives it, from the same oracle
 * (ruffle-rs/ruffle `core/src/avm1/activation.rs`, Apache-2.0 OR MIT): `action_try` records the stack
 * size on entry, runs the try body on it, truncates back to it before the catch body and binds the
 * thrown value to the catch variable (`set_variable`) or register (`set_current_register`) instead of
 * pushing it, and then runs the finally body with **no** truncation — on whatever stack the try or the
 * catch body left. `action_with` pops its operand before running the body, which is the depth the
 * region op records.
 *
 * Every fixture places its regions past the record's `Length`, as real content does (`IMPL-050-R071`).
 */

import { describe, expect, it } from 'vitest';

import type { AnalyzedBlock, BasicBlock, Op, TryRegion } from '../src/index.js';
import { analyze, block, defineFunction, pushString, tryRegion } from './harness.js';

function opsOf(b: AnalyzedBlock): readonly Op[] {
  return b.ir.blocks.flatMap((blk) => blk.ops);
}

/** The string literals pushed across a list of basic blocks, in block order. */
function pushed(blocks: readonly BasicBlock[] | null): string[] {
  const out: string[] = [];
  for (const blk of blocks ?? []) {
    for (const op of blk.ops) {
      if (op.kind !== 'push') continue;
      for (const operand of op.values) {
        if (operand.kind === 'lit' && operand.value.type === 'string') out.push(operand.value.value);
      }
    }
  }
  return out;
}

/** The first `try` op among a list of basic blocks, or null when there is none. */
function tryIn(blocks: readonly BasicBlock[] | null): Op | null {
  for (const blk of blocks ?? []) {
    for (const op of blk.ops) if (op.kind === 'try') return op;
  }
  return null;
}

function regionOf(b: AnalyzedBlock): TryRegion {
  const op = tryIn(b.ir.blocks);
  if (op === null || op.kind !== 'try') throw new Error('expected a try op in the analyzed block');
  return op.region;
}

/** A `Try` whose three bodies each push one distinct literal. */
function threeBodyTry(prefix = ''): number[] {
  return tryRegion({
    catchName: `${prefix}e`,
    finallyPresent: true,
    try: [...pushString(`${prefix}try`)],
    catch: [...pushString(`${prefix}catch`)],
    finally: [...pushString(`${prefix}finally`)],
  });
}

describe('T-AVM1-FE-040 catch and finally bodies reach the IR', () => {
  it('carries the catch and finally ops, and keeps the sibling outside the region', () => {
    const bytes = block(threeBodyTry(), pushString('sibling'));
    const { block: b, diag } = analyze(bytes);

    expect(diag.all.filter((d) => d.severity === 'error')).toEqual([]);
    const region = regionOf(b);
    expect(region.malformed).toBe(false);
    expect(pushed(region.tryBlocks)).toEqual(['try']);
    expect(pushed(region.catchBlocks)).toEqual(['catch']);
    expect(pushed(region.finallyBlocks)).toEqual(['finally']);
    // `ir.blocks` is the flat list of every block in the scope tree, so the three bodies' pushes
    // appear there alongside the sibling; the buckets name the same blocks (R035).
    expect(pushed(b.ir.blocks).sort()).toEqual(['catch', 'finally', 'sibling', 'try']);
  });

  it('starts each body at the depth the player gives it', () => {
    const bytes = block(pushString('before'), threeBodyTry(), pushString('sibling'));
    const { block: b, diag } = analyze(bytes);

    expect(diag.all.filter((d) => d.severity === 'error')).toEqual([]);
    expect(diag.has('SF0406')).toBe(false);
    const region = regionOf(b);
    // `push 'before'` leaves depth 1 at the `Try` record. The try body enters there and leaves 2.
    // The catch body also enters at 1: the player truncates the stack back to the `Try` entry before
    // running it and binds the thrown value to a variable or register instead of pushing it. The
    // finally body runs on whatever the try body left, with no truncation, so it enters at 2.
    expect(region.tryBlocks[0]?.stackIn).toBe(1);
    expect(region.tryBlocks[0]?.stackOut).toBe(2);
    expect(region.catchBlocks?.[0]?.stackIn).toBe(1);
    expect(region.catchBlocks?.[0]?.stackOut).toBe(2);
    expect(region.finallyBlocks?.[0]?.stackIn).toBe(2);
    expect(region.finallyBlocks?.[0]?.stackOut).toBe(3);
  });

  it('makes the finally depth dynamic when the try and catch bodies disagree', () => {
    // The try body leaves one value, the catch body leaves two, so the finally body's entry depth
    // depends on the path the player took. That is not a mismatch to report: the same finally body
    // really does run after either path, so the depth is dynamic (T1) rather than `SF0406` (T2).
    const bytes = block(
      tryRegion({
        catchName: 'e',
        finallyPresent: true,
        try: [...pushString('a')],
        catch: [...pushString('b'), ...pushString('c')],
        finally: [...pushString('d')],
      }),
      pushString('sibling'),
    );
    const { block: b, diag } = analyze(bytes);

    expect(diag.has('SF0406')).toBe(false);
    const region = regionOf(b);
    expect(region.tryBlocks[0]?.stackOut).toBe(1);
    expect(region.catchBlocks?.[0]?.stackOut).toBe(2);
    expect(region.finallyBlocks?.[0]?.stackIn).toBe(-1);
    expect(b.decision.tier).toBe(1);
    expect(b.reasons).toContain('dynamic-stack');
  });

  it('delivers the catch body with CatchInRegister, and no finally when the flag is absent', () => {
    const bytes = block(
      tryRegion({
        catchInRegister: true,
        catchRegister: 4,
        try: [...pushString('try')],
        catch: [...pushString('catch')],
      }),
      pushString('sibling'),
    );
    const { block: b, diag } = analyze(bytes);

    expect(diag.all.filter((d) => d.severity === 'error')).toEqual([]);
    const region = regionOf(b);
    expect(region.catchInRegister).toBe(true);
    expect(region.catchRegister).toBe(4);
    expect(region.catchName).toBeNull();
    expect(region.finallyPresent).toBe(false);
    expect(pushed(region.catchBlocks)).toEqual(['catch']);
    expect(region.finallyBlocks).toBeNull();
  });

  it('keeps the bodies of a Try nested inside a catch body', () => {
    const bytes = block(
      tryRegion({
        catchName: 'e',
        try: [...pushString('outerTry')],
        catch: [...threeBodyTry('inner')],
      }),
      pushString('sibling'),
    );
    const { block: b, diag } = analyze(bytes);

    expect(diag.all.filter((d) => d.severity === 'error')).toEqual([]);
    const outer = regionOf(b);
    expect(pushed(outer.tryBlocks)).toEqual(['outerTry']);
    // The catch scope holds the nested `Try` record itself; that record's three bodies are scopes of
    // their own, so their pushes live one level down rather than in the catch scope's blocks.
    expect(pushed(outer.catchBlocks)).toEqual([]);
    const inner = tryIn(outer.catchBlocks);
    expect(inner).not.toBeNull();
    if (inner === null || inner.kind !== 'try') throw new Error('expected a nested try op');
    expect(pushed(inner.region.tryBlocks)).toEqual(['innertry']);
    expect(pushed(inner.region.catchBlocks)).toEqual(['innercatch']);
    expect(pushed(inner.region.finallyBlocks)).toEqual(['innerfinally']);
    expect(pushed(b.ir.blocks).sort()).toEqual(['innercatch', 'innerfinally', 'innertry', 'outerTry', 'sibling']);
  });

  it('keeps the bodies of a Try inside a function body', () => {
    // No `Return` after the region: a pop directly after a `Try` underflows against the empty stack
    // of the block holding the region op, because a body's net stack effect does not reach the code
    // that follows the region. That false positive is errata `E-040`, not this obligation.
    const bytes = block(defineFunction({ name: 'f', body: [...threeBodyTry('fn')] }), pushString('sibling'));
    const { block: b, diag } = analyze(bytes);

    expect(diag.all.filter((d) => d.severity === 'error')).toEqual([]);
    const defines = opsOf(b).filter((op): op is Extract<Op, { kind: 'define' }> => op.kind === 'define');
    expect(defines.length).toBe(1);
    const fn = defines[0]?.fn;
    expect(fn?.name).toBe('f');
    const op = tryIn(fn?.ir?.blocks ?? null);
    expect(op).not.toBeNull();
    if (op === null || op.kind !== 'try') throw new Error('expected a try op in the function body');
    expect(pushed(op.region.tryBlocks)).toEqual(['fntry']);
    expect(pushed(op.region.catchBlocks)).toEqual(['fncatch']);
    expect(pushed(op.region.finallyBlocks)).toEqual(['fnfinally']);
  });
});
