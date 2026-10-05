/**
 * `DefineFunction`/`DefineFunction2` — `IMPL-050` §5.3 (`T-AVM1-013` mask table, `T-AVM1-014`
 * register allocation, `T-AVM1-015` REGISTERPARAM register 0).
 */

import { describe, expect, it } from 'vitest';

import { DF2_MASKS, type FunctionDef } from '@swf-forge/avm1';
import { analyze, block, defineFunction2 } from './harness.js';

function definedFn(bytes: Uint8Array): FunctionDef | null {
  const { block: b } = analyze(bytes);
  for (const blk of b.ir.blocks) {
    for (const op of blk.ops) {
      if (op.kind === 'define') return op.fn;
    }
  }
  return null;
}

describe('T-AVM1-013 DF2 flag mask table', () => {
  const flags = [
    { mask: DF2_MASKS.preloadThis, check: (fn: FunctionDef) => fn.preloads.this === true },
    { mask: DF2_MASKS.preloadArguments, check: (fn: FunctionDef) => fn.preloads.arguments === true },
    { mask: DF2_MASKS.preloadSuper, check: (fn: FunctionDef) => fn.preloads.super === true },
    { mask: DF2_MASKS.preloadRoot, check: (fn: FunctionDef) => fn.preloads.root === true },
    { mask: DF2_MASKS.preloadParent, check: (fn: FunctionDef) => fn.preloads.parent === true },
    { mask: DF2_MASKS.preloadGlobal, check: (fn: FunctionDef) => fn.preloads.global === true },
    { mask: DF2_MASKS.suppressThis, check: (fn: FunctionDef) => fn.suppress.this === true },
    { mask: DF2_MASKS.suppressArguments, check: (fn: FunctionDef) => fn.suppress.arguments === true },
    { mask: DF2_MASKS.suppressSuper, check: (fn: FunctionDef) => fn.suppress.super === true },
  ];

  for (const { mask, check } of flags) {
    it(`0x${mask.toString(16)} alone sets exactly its flag`, () => {
      const fn = definedFn(block(defineFunction2({ name: 'f', registerCount: 4, flags: mask, body: [0x00] })));
      expect(fn).not.toBeNull();
      if (fn === null) return;
      check(fn);
      // Every other flag must be clear.
      const all = [
        fn.preloads.this,
        fn.preloads.arguments,
        fn.preloads.super,
        fn.preloads.root,
        fn.preloads.parent,
        fn.preloads.global,
        fn.suppress.this,
        fn.suppress.arguments,
        fn.suppress.super,
      ];
      expect(all.filter(Boolean).length).toBe(1);
    });
  }

  it('reserved bits are preserved and reported (SF0413)', () => {
    const diag = analyze(block(defineFunction2({ name: 'f', registerCount: 0, flags: 0x2000, body: [0x00] })));
    expect(diag.diag.has('SF0413')).toBe(true);
    const fn = definedFn(block(defineFunction2({ name: 'f', registerCount: 0, flags: 0x2000, body: [0x00] })));
    expect(fn?.reservedBits).toBe(0x2000);
  });
});

describe('T-AVM1-014 register allocation order', () => {
  it('params into their registers, then preloads from 1, then locals (the chapter example)', () => {
    // Two params in registers 3 and 4; this (0x01) + _root (0x40) preloaded; 6 registers total.
    const fn = definedFn(
      block(
        defineFunction2({
          name: 'f',
          params: ['a', 'b'],
          paramRegisters: [3, 4],
          registerCount: 6,
          flags: DF2_MASKS.preloadThis | DF2_MASKS.preloadRoot,
          body: [0x00],
        }),
      ),
    );
    expect(fn).not.toBeNull();
    if (fn === null) return;
    const byIndex = new Map(fn.registers.map((r) => [r.index, r]));
    expect(byIndex.get(1)).toMatchObject({ kind: 'preload', name: 'this' });
    expect(byIndex.get(2)).toMatchObject({ kind: 'preload', name: '_root' });
    expect(byIndex.get(3)).toMatchObject({ kind: 'param', name: 'param_0' });
    expect(byIndex.get(4)).toMatchObject({ kind: 'param', name: 'param_1' });
    expect(byIndex.get(5)?.kind).toBe('local');
    expect(byIndex.get(6)?.kind).toBe('local');
  });
});

describe('T-AVM1-015 REGISTERPARAM register 0', () => {
  it('register 0 = named activation variable (no register slot); non-zero = copied to that register', () => {
    const fn = definedFn(
      block(
        defineFunction2({
          name: 'f',
          params: ['x', 'y'],
          paramRegisters: [0, 2],
          registerCount: 4,
          flags: 0,
          body: [0x00],
        }),
      ),
    );
    expect(fn).not.toBeNull();
    if (fn === null) return;
    // Param x (register 0) is a named variable — not in the register file.
    expect(fn.params[0]).toEqual({ name: 'x', register: null });
    // Param y (register 2) is copied into register 2.
    expect(fn.params[1]).toEqual({ name: 'y', register: 2 });
    expect(fn.registers.some((r) => r.kind === 'param' && r.name === 'param_1' && r.index === 2)).toBe(true);
    expect(fn.registers.some((r) => r.name === 'param_0')).toBe(false);
  });

  it('a param register inside the preload range is overwritten and reported (SF0416)', () => {
    const { block: b, diag } = analyze(
      block(
        defineFunction2({
          name: 'f',
          params: ['a'],
          paramRegisters: [1],
          registerCount: 3,
          flags: DF2_MASKS.preloadThis,
          body: [0x00],
        }),
      ),
    );
    expect(diag.has('SF0416')).toBe(true);
    void b;
  });
});
