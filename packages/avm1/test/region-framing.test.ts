/**
 * Region framing — `IMPL-050-R071`, the four opcodes that own bytes **past** their record's `Length`.
 *
 * - `T-AVM1-FE-037` (`E-035`): `DefineFunction` (0x9B) and `DefineFunction2` (0x8E) carry
 *   `Code[CodeSize]` after the record; `Length` covers the header alone.
 * - `T-AVM1-FE-038` (`E-036`): `With` (0x94) carries `Body[Size]` and `Try` (0x8F) carries
 *   `TryBody/CatchBody/FinallyBody` after the record.
 * - `T-AVM1-FE-039` (`E-037`): a terminating `End` closes a frame or init script only; a function body
 *   is delimited by `CodeSize` and a clip-event or button handler by its record size.
 *
 * Every fixture here places its region past `Length`, as real content does. Measured over the C4-c
 * corpus (`audits/P5-C4-CORPUS-EXTERNAL.json`, 73 licensed AVM1 conformance movies): **64 of 64**
 * `DefineFunction*` headers end exactly at `Length`, **3 of 3** `With` records declare `Length == 2`,
 * **3 of 3** `Try` headers end exactly at `Length`, and **0 of 66** function bodies end with `End`.
 * Ruffle's reader states the same rule outright: "`length` is an in-out parameter … The `length` passed
 * in should be the length excluding any sub-blocks" (`swf/src/avm1/read.rs`, Apache-2.0 OR MIT).
 *
 * The pre-fix fixtures did the opposite — they placed regions inside `Length`, matching the decoders'
 * wrong reading, so 750 green tests proved nothing about real content (`E-034`'s lesson).
 */

import { describe, expect, it } from 'vitest';

import { regionExtent, scanRecords } from '../src/index.js';
import type { ActionIR, AnalyzedBlock, BasicBlock, Op } from '../src/index.js';
import {
  analyze,
  block,
  blockNoEnd,
  defineFunction,
  defineFunction2,
  nul,
  pushInt,
  pushString,
  rec,
  tryRegion,
  withRegion,
} from './harness.js';

const NOOP_EMIT = (): void => {};

function opsOf(b: AnalyzedBlock): readonly Op[] {
  return b.ir.blocks.flatMap((blk) => blk.ops);
}

/* The string literals pushed across a list of basic blocks, in block order. */
function pushedFromBlocks(blocks: readonly BasicBlock[]): string[] {
  const out: string[] = [];
  for (const blk of blocks) {
    for (const op of blk.ops) {
      if (op.kind !== 'push') continue;
      for (const operand of op.values) {
        if (operand.kind === 'lit' && operand.value.type === 'string') out.push(operand.value.value);
      }
    }
  }
  return out;
}

/** The string literals pushed anywhere in an IR. Block order is CFG order, not offset order. */
function pushed(ir: ActionIR | null): string[] {
  return ir === null ? [] : pushedFromBlocks(ir.blocks);
}

function defines(b: AnalyzedBlock): { name: string | null; version: 1 | 2; body: ActionIR | null; size: number }[] {
  return opsOf(b)
    .filter((op): op is Extract<Op, { kind: 'define' }> => op.kind === 'define')
    .map((op) => ({
      name: op.fn.name,
      version: op.fn.version,
      body: op.fn.ir,
      size: op.fn.bodyEnd - op.fn.bodyStart,
    }));
}

describe('T-AVM1-FE-037 DefineFunction* carry Code[CodeSize] past the record Length', () => {
  const body = [...pushString('inner'), 0x3e]; // Push "inner"; Return

  it('decodes the body once, from the bytes past the record, and leaves the sibling outside it', () => {
    const bytes = block(defineFunction({ name: 'f', body }), pushString('sibling'));
    const { block: b, diag } = analyze(bytes);

    expect(diag.has('SF0400')).toBe(false);
    expect(diag.has('SF0420')).toBe(false);
    const fns = defines(b);
    expect(fns.length).toBe(1);
    expect(fns[0]).toMatchObject({ name: 'f', version: 1, size: body.length });
    // The body's ops belong to the function's own IR…
    expect(pushed(fns[0]?.body ?? null)).toEqual(['inner']);
    // …and are *not* attributed to the enclosing block, which sees only its own sibling record.
    expect(pushed(b.ir)).toEqual(['sibling']);
  });

  it('frames the region: the walker continues past the body, so the sibling is a sibling', () => {
    const bytes = block(defineFunction({ name: 'f', body }), pushString('sibling'));
    const scan = scanRecords(bytes, NOOP_EMIT);

    expect(scan.records.map((r) => r.code)).toEqual([0x9b, 0x96, 0x00]);
    const fn = scan.records[0];
    const sibling = scan.records[1];
    expect(fn?.end).toBe(3 + nul('f').length + 2 + 2); // Length covers the header only
    expect(fn?.regionEnd).toBe((fn?.end ?? 0) + body.length);
    expect(sibling?.offset).toBe(fn?.regionEnd);
    expect(scan.terminated).toBe(true);
    expect(scan.desync).toBe(false);
  });

  it('does the same for DefineFunction2, keeping its register file', () => {
    const bytes = block(
      defineFunction2({ name: 'g', params: ['a'], paramRegisters: [1], registerCount: 4, body }),
      pushString('sibling'),
    );
    const { block: b, diag } = analyze(bytes);

    expect(diag.has('SF0400')).toBe(false);
    const fns = defines(b);
    expect(fns[0]).toMatchObject({ name: 'g', version: 2, size: body.length });
    expect(pushed(fns[0]?.body ?? null)).toEqual(['inner']);
    expect(pushed(b.ir)).toEqual(['sibling']);
  });

  it('reports SF0400 only for a body that overruns the enclosing block, and tiers it residual', () => {
    // Header declares CodeSize 40; the block holds none of those bytes.
    const header = [...nul('h'), 0, 0, 40, 0];
    const { block: b, diag } = analyze(block(rec(0x9b, header)));

    expect(diag.has('SF0400')).toBe(true);
    expect(diag.all.find((d) => d.code === 'SF0400')?.message).toMatch(/overruns the enclosing block/);
    expect(b.decision.tier).toBe(2);
    expect(b.reasons).toContain('record-truncated');
  });

  it('still parses an encoder that places the body inside Length (the max() rule)', () => {
    const header = [...nul('f'), 0, 0, body.length & 0xff, (body.length >> 8) & 0xff];
    const bytes = block(rec(0x9b, [...header, ...body]), pushString('sibling'));
    const { block: b, diag } = analyze(bytes);

    expect(diag.has('SF0400')).toBe(false);
    expect(pushed(defines(b)[0]?.body ?? null)).toEqual(['inner']);
    expect(pushed(b.ir)).toEqual(['sibling']);
  });
});

describe('T-AVM1-FE-038 With and Try own their bodies past the record Length', () => {
  it('With: Length is 2, the body is scoped inside the region, and the sibling survives', () => {
    const inner = [...pushString('inWith'), 0x26]; // Push "inWith"; Trace
    const bytes = block(withRegion(inner.length, inner), pushString('sibling'));
    const { block: b, diag } = analyze(bytes);

    expect(diag.has('SF0400')).toBe(false);
    expect(opsOf(b).filter((op) => op.kind === 'with').length).toBe(1);
    // Merged once: the region's own records plus the sibling, never a duplicate of either. (`With`
    // bodies stay inline in the enclosing IR, so both pushes are visible there.)
    expect(pushed(b.ir).sort()).toEqual(['inWith', 'sibling']);

    const scan = scanRecords(bytes, NOOP_EMIT);
    expect(scan.records.map((r) => r.code)).toEqual([0x94, 0x96, 0x00]);
    expect(scan.records[0]?.end).toBe(5); // 0x94 + Length(2) + Size(2)
    expect(scan.records[0]?.regionEnd).toBe(5 + inner.length);
  });

  it('Try: the three bodies tile the region past the header, with no SF0404', () => {
    const bytes = block(
      tryRegion({
        catchName: 'e',
        finallyPresent: true,
        try: [...pushString('try')],
        catch: [...pushString('catch')],
        finally: [...pushString('finally')],
      }),
      pushString('sibling'),
    );
    const { block: b, diag } = analyze(bytes);

    expect(diag.has('SF0404')).toBe(false);
    expect(diag.has('SF0400')).toBe(false);
    const tries = opsOf(b).filter((op): op is Extract<Op, { kind: 'try' }> => op.kind === 'try');
    expect(tries.length).toBe(1);
    // `ir.blocks` is the flat list of every block in the scope tree, so all four pushes appear there
    // and the region buckets name the same blocks (R035).
    expect(pushed(b.ir).sort()).toEqual(['catch', 'finally', 'sibling', 'try']);
    const region = tries[0]?.region;
    expect(region?.malformed).toBe(false);
    expect(pushedFromBlocks(region?.tryBlocks ?? [])).toEqual(['try']);
    // Framing is all this file pins: the buckets exist rather than being `null`. That the catch and
    // finally bodies carry their decoded records at the right stack depth is `E-039`, measured in
    // `try-bodies.test.ts`.
    expect(region?.catchBlocks).not.toBeNull();
    expect(region?.finallyBlocks).not.toBeNull();
  });

  it('reports SF0404 for a Try region that overruns the enclosing block', () => {
    // CatchByName flag, TrySize 60, no catch/finally — and none of those 60 bytes are present.
    const header = [0x01, 60, 0, 0, 0, 0, 0, ...nul('e')];
    const { block: b, diag } = analyze(blockNoEnd(rec(0x8f, header)));

    expect(diag.has('SF0404')).toBe(true);
    expect(diag.all.find((d) => d.code === 'SF0404')?.message).toMatch(/overrun/);
    expect(b.decision.tier).toBe(2);
    expect(b.reasons).toContain('try-malformed');
  });

  // The other SF0404 arm — a `Length` that covers bytes past the header *and* the bodies, so those
  // bytes belong to no region — is pinned by `tier.test.ts`'s "malformed Try body tiling" fixture.
});

describe('T-AVM1-FE-039 an End closes a frame or init script only', () => {
  const noEnd = blockNoEnd(pushString('x'));

  it('SF0420 fires for the End-terminated kinds and for nothing else', () => {
    expect(analyze(noEnd, { kind: 'timeline' }).diag.has('SF0420')).toBe(true);
    expect(analyze(noEnd, { kind: 'init' }).diag.has('SF0420')).toBe(true);
    for (const kind of ['function', 'classMethod', 'clipEvent', 'button'] as const) {
      expect(analyze(noEnd, { kind }).diag.has('SF0420')).toBe(false);
    }
  });

  it('a function body neither requires nor stops at an interior End byte', () => {
    // 0 of 66 real function bodies end with `End`, and 64 of 66 contain interior zero bytes: a
    // size-delimited body must be scanned to its `CodeSize`, terminator or not (R008/R071).
    const body = [...pushString('before'), 0x00, ...pushString('after')];
    const bytes = block(defineFunction({ name: 'f', body }));
    const { block: b, diag } = analyze(bytes);

    expect(diag.has('SF0420')).toBe(false);
    expect(defines(b)[0]?.size).toBe(body.length);
    expect(pushed(defines(b)[0]?.body ?? null)).toEqual(['before', 'after']);
  });

  it('a block-level scan still stops at its End and ignores the suffix (R006)', () => {
    const bytes = Uint8Array.from([...pushString('kept'), 0x00, ...pushInt(255)]);
    const scan = scanRecords(bytes, NOOP_EMIT);

    expect(scan.terminated).toBe(true);
    expect(scan.stoppedAt).toBe(pushString('kept').length + 1);
    expect(scan.records.map((r) => r.code)).toEqual([0x96, 0x00]);
  });
});

describe('R071 regionExtent: the framing-level reading of the four region opcodes', () => {
  it('returns null for a code that owns no region', () => {
    const bytes = Uint8Array.from(pushString('x'));
    expect(regionExtent(bytes, 0x96, 3, bytes.length, bytes.length)).toBeNull();
  });

  it('reads With as Size UI16 and the body that follows', () => {
    const bytes = Uint8Array.from(withRegion(4, [1, 2, 3, 4]));
    const extent = regionExtent(bytes, 0x94, 3, 5, bytes.length);
    expect(extent).toMatchObject({
      bodyStart: 5,
      regionSize: 4,
      declaredEnd: 9,
      bodyEnd: 9,
      consumedEnd: 9,
      overruns: false,
    });
  });

  it('clamps a region that runs past the enclosing scan range and flags the overrun', () => {
    const bytes = Uint8Array.from(withRegion(40, [1, 2]));
    const extent = regionExtent(bytes, 0x94, 3, 5, bytes.length);
    expect(extent).toMatchObject({ regionSize: 40, declaredEnd: 45, bodyEnd: bytes.length, overruns: true });
    expect(extent?.consumedEnd).toBe(bytes.length);
  });

  it('gives no region at all when a function header does not fit inside the payload', () => {
    // CodeSize is missing: the payload ends after NumParams.
    const bytes = Uint8Array.from(rec(0x9b, [...nul('f'), 0, 0]));
    expect(regionExtent(bytes, 0x9b, 3, bytes.length - 1, bytes.length)).toBeNull();
  });

  it('takes the region end from the header, so a Length that over-covers still consumes its record', () => {
    const body = [...pushString('inner')];
    const header = [...nul('f'), 0, 0, body.length & 0xff, (body.length >> 8) & 0xff];
    const inside = Uint8Array.from(rec(0x9b, [...header, ...body]));
    const outside = Uint8Array.from([...rec(0x9b, header), ...body]);

    const a = regionExtent(inside, 0x9b, 3, inside.length, inside.length);
    const b = regionExtent(outside, 0x9b, 3, header.length + 3, outside.length);
    expect(a?.regionSize).toBe(body.length);
    expect(b?.regionSize).toBe(body.length);
    // Same consumed extent either way: the record's bytes plus its region.
    expect(a?.consumedEnd).toBe(b?.consumedEnd);
  });
});
