/**
 * `Try`/`With` structured regions — `IMPL-050` §5.5 (`T-AVM1-006` Try field order and tiling,
 * `T-AVM1-016` With depth caps and skip-body, `T-AVM1-025` try/throw/finally shape).
 */

import { describe, expect, it } from 'vitest';

import { analyze, block, collector, pushString, rec, tryRegion, withRegion } from './harness.js';
import type { TryRegion, WithRegion } from '../src/index.js';

function regionOps(
  bytes: Uint8Array,
  version?: number,
): { try: TryRegion[]; with: WithRegion[]; diag: ReturnType<typeof collector> } {
  const { block: b, diag } = analyze(bytes, { ...(version !== undefined ? { version } : {}) });
  const tryR: TryRegion[] = [];
  const withR: WithRegion[] = [];
  for (const blk of b.ir.blocks) {
    for (const op of blk.ops) {
      if (op.kind === 'try') tryR.push(op.region);
      if (op.kind === 'with') withR.push(op.region);
    }
  }
  return { try: tryR, with: withR, diag };
}

describe('T-AVM1-006 Try field order and body tiling', () => {
  it('catch-by-name: the name is decoded and the three sizes are all present', () => {
    const bytes = block(tryRegion({ catchName: 'e', try: [0x0a], catch: [0x0b], finally: [] }));
    const { try: regions } = regionOps(bytes);
    expect(regions.length).toBe(1);
    expect(regions[0]).toMatchObject({
      catchInRegister: false,
      catchName: 'e',
      catchRegister: null,
      finallyPresent: false,
    });
  });

  it('catch-by-register: the register byte is decoded, not a name', () => {
    const bytes = block(tryRegion({ catchInRegister: true, catchRegister: 3, try: [0x0a], catch: [0x0b] }));
    const { try: regions } = regionOps(bytes);
    expect(regions[0]).toMatchObject({ catchInRegister: true, catchName: null, catchRegister: 3 });
  });

  it('finally is present when flagged', () => {
    const bytes = block(
      tryRegion({ catchName: 'e', finallyPresent: true, try: [0x0a], catch: [0x0b], finally: [0x0c] }),
    );
    const { try: regions } = regionOps(bytes);
    expect(regions[0]).toMatchObject({ finallyPresent: true });
    expect(regions[0]?.finallyBlocks).not.toBeNull();
  });

  it('bodies that do not tile the record are SF0404 and make the function residual', () => {
    // Hand-rolled Try whose declared sizes leave a 1-byte gap before the record end.
    const header = [
      0x01, // flags: catch by name
      1,
      0, // trySize 1
      1,
      0, // catchSize 1
      0,
      0, // finallySize 0
      101,
      0, // catch name "e"
    ];
    const body = [0x0a, 0x0b, 0x00]; // try body, catch body, + 1 gap byte
    const payload = [...header, ...body];
    const handRolled = Uint8Array.from([0x8f, payload.length & 0xff, (payload.length >> 8) & 0xff, ...payload, 0x00]);
    const { try: regions, diag } = regionOps(handRolled);
    expect(diag.has('SF0404')).toBe(true);
    expect(regions[0]?.malformed).toBe(true);
  });
});

describe('T-AVM1-016 With depth caps and skip-body', () => {
  function nestedWith(depth: number): number[] {
    // Innermost body is an Add; each level wraps `With { push "o", <body> }`. The outermost With
    // is depth 1; the innermost is depth `depth`.
    let body: number[] = [0x0a];
    for (let i = 0; i < depth; i += 1) {
      const payload = [...rec(0x96, [0, 111, 0]), ...body];
      body = withRegion(payload.length, payload);
    }
    return body;
  }

  it('SWF 5 caps With nesting at 8; a single With is depth 1', () => {
    const bytes = block(pushString('o'), withRegion(1, [0x0a]));
    const { with: regions } = regionOps(bytes, 5);
    expect(regions[0]?.withDepth).toBe(1);
    expect(regions[0]?.skipBody).toBe(false);
  });

  it('the with depth is counted from the enclosing With bodies', () => {
    // Outer With (depth 1) containing an inner With (depth 2) around an Add.
    const inner = withRegion(1, [0x0a]); // With size 1 { Add }
    const outerBody = [...rec(0x96, [0, 111, 0]), ...inner]; // push "o", inner With
    const bytes = block(withRegion(outerBody.length, outerBody));
    const { with: regions } = regionOps(bytes, 7);
    expect(regions.length).toBe(2);
    const depths = regions.map((r) => r.withDepth).sort((a, b) => a - b);
    expect(depths).toEqual([1, 2]);
  });

  it('exceeding the cap sets skipBody and reports SF0412', () => {
    // 9 nested With in SWF 5 → the 9th exceeds the cap of 8.
    const bytes = block(nestedWith(9));
    const { with: regions, diag } = regionOps(bytes, 5);
    expect(regions.length).toBe(9);
    const over = regions.find((r) => r.withDepth > 8);
    expect(over?.skipBody).toBe(true);
    expect(diag.has('SF0412')).toBe(true);
  });
});

describe('T-AVM1-025 Try/Throw/finally structure', () => {
  it('a Try with catch and finally exposes three body groups (model shape)', () => {
    const bytes = block(
      tryRegion({ catchName: 'e', finallyPresent: true, try: [0x0a, 0x2a], catch: [0x0b], finally: [0x0c] }),
    );
    const { try: regions } = regionOps(bytes);
    expect(regions[0]?.tryBlocks.length).toBeGreaterThanOrEqual(1);
    expect(regions[0]?.catchBlocks).not.toBeNull();
    expect(regions[0]?.finallyBlocks).not.toBeNull();
  });

  it('Throw unwinds: a throw inside a Try body is a throw terminator', () => {
    // [Add, Throw] inside a Try's try-body.
    const bytes = block(tryRegion({ catchName: 'e', try: [0x0a, 0x2a], catch: [0x0b] }));
    const { block: b } = analyze(bytes);
    // Somewhere in the region's try bodies there is a throw terminator.
    const region = b.ir.blocks[0]?.ops.find((o) => o.kind === 'try');
    expect(region).toBeDefined();
    if (region && region.kind === 'try') {
      const hasThrow = region.region.tryBlocks.some((blk) => blk.terminator.kind === 'throw');
      expect(hasThrow).toBe(true);
    }
  });
});
