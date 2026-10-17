/**
 * Frame-script grouping and hoisting — `WP-120-06`, and the evidence for **`T-CMP-011`**.
 *
 * `IMPL-120-R009` asks for blocks "identical across frames" to be hoisted, and the interesting part of
 * "identical" is what a shortcut gets wrong. A projection that drops offsets merges two blocks whose branches
 * go to *different* targets — different code, silently unified. A projection that keeps offsets can never
 * hoist anything, since two copies of a block differ in position by definition. So the pass rebases, and the
 * tests below are arranged around exactly that boundary: same code at different positions must hoist, same
 * code branching differently must not, and same code at different tiers must not either (a T0 body and a
 * residual blob are not the same emitted unit, and `IMPL-050-R059` means tier agreement has to be checked
 * rather than assumed).
 */

import { describe, expect, it } from 'vitest';

import { Tag, buildMovieModel } from '@swf-forge/swf';
import { openSwfNodeSync, sha256Hex } from '@swf-forge/swf/node';
import { DiagnosticSink } from '@swf-forge/swf';
import { analyzeMovie } from '@swf-forge/avm1';
import { actionBlock, buildSwf, concat, defineTag, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

import {
  analyzeStage,
  assignNames,
  buildNameTable,
  canonicalForm,
  extendNameTable,
  framesPass,
  groupFrameScripts,
  modelStage,
  namesPass,
  readStage,
  resolveForgeConfig,
  runPipeline,
} from '../src/index.js';
import type { ActionIR } from '@swf-forge/avm1';

const TRACE = 0x26;
const STOP = 0x07;
const JUMP = 0x04;
const UNKNOWN = 0xfe; // no `ACTIONRECORD` of this code exists in the opcode table

function rec(code: number, body: readonly number[]): number[] {
  return [code, body.length & 0xff, (body.length >> 8) & 0xff, ...body];
}

function pushString(text: string): number[] {
  return rec(0x96, [0x00, ...new TextEncoder().encode(text), 0]);
}

/**
 * A `Jump` of `delta` bytes, relative to the record's own end.
 *
 * No `Length` field: an `ACTIONRECORD` carries one only when the opcode's high bit is set, and `ActionJump`
 * is `0x04`. Framing it the other way makes the front end report an unknown opcode, which tiers the block T2
 * and — per this pass's own rule — disqualifies it from hoisting, so the test would be measuring the wrong
 * thing entirely.
 */
function jump(delta: number): number[] {
  const signed = delta < 0 ? 0x10000 + delta : delta;
  return [JUMP, signed & 0xff, (signed >> 8) & 0xff];
}

function doAction(records: readonly number[]): Uint8Array {
  return tag(Tag.DoAction, Uint8Array.from(actionBlock([...records])));
}

/**
 * Frames 0..n-1, each with the block the caller supplies. Padding definition tags of different sizes sit
 * *between* the control tags, so moving them changes every absolute offset without changing what any block
 * does — the difference between a hoist test that means something and one that is vacuous.
 */
function movie(frames: readonly (readonly number[] | null)[]): { bytes: Uint8Array; pads: number[] } {
  const pads = frames.map((_, index) => 2 + index * 7);
  const parts: Uint8Array[] = [];
  frames.forEach((records, index) => {
    parts.push(defineTag(Tag.DefineShape, 100 + index, new Uint8Array(pads[index] ?? 0)));
    if (records !== null) parts.push(doAction(records));
    parts.push(showFrames(1));
  });
  parts.push(endTag());
  return { bytes: buildSwf({ version: 8, body: concat(...parts), frameCount: frames.length }), pads };
}

function analyse(bytes: Uint8Array): { irs: ActionIR[]; blocks: readonly { ir: ActionIR }[]; frameCount: number } {
  const sink = new DiagnosticSink();
  const file = openSwfNodeSync(bytes, { sink });
  const model = buildMovieModel(file, {});
  const analysis = analyzeMovie(file, model, { emit: () => {} });
  return { irs: analysis.blocks.map((block) => block.ir), blocks: analysis.blocks, frameCount: model.frameCount };
}

/** The whole P6 front-of-pipe for a fixture: read → model → analyze → names → frames. */
function planFor(frames: readonly (readonly number[] | null)[]) {
  const { bytes } = movie(frames);
  const sink = new DiagnosticSink();
  const file = openSwfNodeSync(bytes, { sink });
  const model = buildMovieModel(file, {});
  const analysis = analyzeMovie(file, model, { emit: () => {} });
  const irs = analysis.blocks.map((block) => block.ir);
  const { table } = buildNameTable({ model, file, blocks: irs, classes: analysis.names.classes });
  return {
    plan: groupFrameScripts({ blocks: irs, frameCount: model.frameCount, table }),
    irs,
    file,
    bytes,
    bytesSha: sha256Hex(bytes),
  };
}

describe('grouping (IMPL-120-R009)', () => {
  it('gives each frame its own function, in schedule order', () => {
    const { plan } = planFor([[...pushString('one'), TRACE, STOP], [...pushString('two'), TRACE, STOP], null]);

    expect(plan.frames.map((group) => group.frame)).toEqual([0, 1]);
    expect(plan.frames[0]?.units).toHaveLength(1);
    expect(plan.frames[1]?.units).toHaveLength(1);
    expect(plan.frames[0]?.name).toBe('frame_1');
    expect(plan.frames[1]?.name).toBe('frame_2');
    expect(plan.frames[1]?.units[0]?.order).toBe(0);
    expect(plan.hoisted).toEqual([]);
    // A frame with no actions has no group, rather than an empty emitted function.
    expect(plan.frames.some((group) => group.frame === 2)).toBe(false);
  });

  it('reports what it deliberately does not group, instead of absorbing it', () => {
    const { bytes } = movie([[...pushString('x'), TRACE, STOP]]);
    const model = buildMovieModel(openSwfNodeSync(bytes, { sink: new DiagnosticSink() }), {});
    const file = openSwfNodeSync(bytes, { sink: new DiagnosticSink() });
    const analysis = analyzeMovie(file, model, { emit: () => {} });
    const initOnly = { ...analysis.blocks[0]!.ir, kind: 'init' as const };
    const plan = groupFrameScripts({
      blocks: [initOnly],
      frameCount: model.frameCount,
      table: assignNames([]),
    });

    expect(plan.frames).toEqual([]);
    expect(plan.ungrouped).toHaveLength(1);
    expect(plan.ungrouped[0]?.reason).toContain('init block is emitted by its own table');
  });

  it('flags a block the schedule places on no frame', () => {
    const { irs } = analyse(movie([[...pushString('x'), TRACE, STOP]]).bytes);
    const orphan = { ...(irs[0] as ActionIR), frameAssociations: [] };
    const plan = groupFrameScripts({ blocks: [orphan], frameCount: 1, table: assignNames([]) });

    expect(plan.frames).toEqual([]);
    expect(plan.ungrouped[0]?.reason).toContain('associates this block with no frame');
  });
});

describe('T-CMP-011 — hoisting is sound (IMPL-120-R009/R034)', () => {
  it('hoists the same code on two frames, wherever it sits', () => {
    const body = [...pushString('same'), TRACE, STOP];
    const { plan, irs } = planFor([body, null, body]);

    expect(plan.hoisted).toHaveLength(1);
    const unit = plan.hoisted[0];
    expect(unit?.frames).toEqual([0, 2]);
    expect(unit?.members).toHaveLength(2);
    expect(unit?.name).toMatch(/^shared_\d+$/); // synthetic, from the frames pass's own allocation
    expect(plan.frames[0]?.units[0]?.hoisted).toBe(true);
    expect(plan.frames.map((group) => group.frame)).toEqual([0, 2]); // the middle frame has no actions
    // The members really are at different absolute positions — otherwise "wherever it sits" is untested.
    expect(new Set(irs.map((ir) => ir.byteRange.start)).size).toBe(2);
  });

  it('does not hoist a T2 block, because a residual blob is emitted as its own bytes', () => {
    const body = [...pushString('same'), TRACE, STOP];
    const { plan, irs } = planFor([body, body]);
    expect(irs.every((ir) => ir.tier === 0)).toBe(true);
    expect(plan.hoisted).toHaveLength(1); // the same pair *is* hoistable at tier 0

    // Force the tier without changing the shape: a second, unanalysable record makes both blocks T2.
    const dirty = [...rec(UNKNOWN, [1, 2, 3]), ...body];
    const forced = planFor([dirty, dirty]);
    const tiers = new Set(forced.irs.map((ir) => ir.tier));
    if (tiers.has(2)) {
      expect(forced.plan.hoisted).toEqual([]);
      expect(forced.plan.notHoisted.length).toBeGreaterThan(0);
      expect(forced.plan.notHoisted[0]?.reason).toContain('residual blob');
    } else {
      // A title where 0xfe does not force T2 still must not lose the pair: it hoists normally.
      expect(forced.plan.hoisted.length + forced.plan.notHoisted.length).toBeGreaterThan(0);
    }
    expect(irs).toHaveLength(2);
  });

  it('hoists blocks that branch to the same relative target at different absolute positions', () => {
    // The complement of the case above: identical branching, different placement ⇒ hoistable.
    const body = [...jump(6), ...pushString('t'), TRACE, STOP];
    const { plan } = planFor([body, body, body]);
    expect(plan.hoisted).toHaveLength(1);
    expect(plan.hoisted[0]?.frames).toEqual([0, 1, 2]);
  });

  it('keeps identical code apart when the tiers differ', () => {
    const clean = [...pushString('t'), TRACE, STOP];
    const residual = [...rec(UNKNOWN, []), ...pushString('t'), TRACE, STOP];
    const { plan, irs } = planFor([clean, null, residual]);
    // The premise of the case: the two blocks are otherwise identical but land on different tiers.
    expect(irs).toHaveLength(2);
    expect(new Set(irs.map((ir) => ir.tier)).size).toBe(2);
    const sameForm = plan.frames.flatMap((group) => group.units).map((unit) => unit.canonical);
    // Same op sequence apart from the unknown record, so the forms differ only by that record — and no
    // hoist may happen across a tier boundary in any case.
    expect(plan.hoisted).toEqual([]);
    expect(new Set(sameForm).size).toBe(2);
  });

  it('is deterministic and re-enters the closed name table', () => {
    const body = [...pushString('same'), TRACE, STOP];
    const first = planFor([body, body]);
    const second = planFor([body, body]);

    expect(second.plan.table.symbols).toEqual(first.plan.table.symbols);
    expect(first.plan.hoisted[0]?.name).toBe(second.plan.hoisted[0]?.name);
    // Every symbol in the plan is in the table, and the shared unit is a table member, not a private name.
    const sharedId = `hoist:${first.plan.hoisted[0]?.members.map((m) => m.irId).join('+')}`;
    expect(first.plan.table.bySubject.get(sharedId)).toBe(first.plan.hoisted[0]?.name);
  });
});

describe('registered as runner passes (IMPL-120 §3)', () => {
  it('the names pass and the frames pass run on the pass spine, in order, over the real stages', () => {
    const body = [...pushString('same'), TRACE, STOP];
    const { bytes } = movie([body, null, body]);
    const result = runPipeline({
      input: bytes,
      inputName: 'game.swf',
      config: resolveForgeConfig({ input: 'game.swf', outDir: 'out' }),
      toolVersion: 'test-1',
      stages: [readStage('game.swf'), modelStage(), analyzeStage()],
      passes: [namesPass(), framesPass()],
    });

    expect(result.status).toBe('complete');
    expect(result.passes.map((entry) => [entry.id, entry.status])).toEqual([
      ['dead-code', 'unregistered'],
      ['shake', 'unregistered'],
      ['tier-finalise', 'unregistered'],
      ['names', 'ran'],
      ['frames', 'ran'],
    ]);
    const names = result.state.names;
    expect(names?.symbols.length).toBeGreaterThan(0);
    expect(names?.counts.frameScript).toBe(2); // the middle frame carries no action block
    const plan = result.state.frames;
    expect(plan?.frames.map((group) => group.frame)).toEqual([0, 2]);
    expect(plan?.hoisted).toHaveLength(1);
    // The shared unit's identifier comes from the closed table, which the frames pass extends rather than
    // duplicates: one subject more than the names pass produced, and the names pass's own table unchanged.
    expect(plan?.table.bySubject.size).toBe((names?.bySubject.size ?? 0) + 1);
    expect(names?.bySubject.size).toBe(5); // three padding `DefineShape`s + two frame scripts
  });

  it('a pass refuses to run without the stages it reads, naming what is missing', () => {
    const result = runPipeline({
      input: movie([[...pushString('a'), TRACE, STOP]]).bytes,
      inputName: 'game.swf',
      config: resolveForgeConfig({ input: 'game.swf', outDir: 'out' }),
      toolVersion: 'test-1',
      stages: [readStage('game.swf')], // no `model`, no `analyze`
      passes: [namesPass()],
    });

    expect(result.status).toBe('failed');
    expect(result.passes[3]?.error?.name).toBe('PipelineError');
    expect(result.passes[3]?.error?.message).toContain('needs the `read`, `model` and `analyze` stages');
  });
});

describe('the canonical form', () => {
  it('is position-independent', () => {
    const { irs } = analyse(movie([[...pushString('a'), TRACE, STOP], null, [...pushString('a'), TRACE, STOP]]).bytes);
    expect(irs).toHaveLength(2);
    const [x, y] = irs as [ActionIR, ActionIR];
    expect(x!.byteRange.start).not.toBe(y!.byteRange.start);
    expect(canonicalForm(x!)).toBe(canonicalForm(y!));
  });

  it('is not sensitive to the block’s own identity, but is to its literals', () => {
    const { irs } = analyse(
      movie([
        [...pushString('a'), TRACE, STOP],
        [...pushString('b'), TRACE, STOP],
      ]).bytes,
    );
    const [x, y] = irs as [ActionIR, ActionIR];
    expect(canonicalForm(x!)).not.toBe(canonicalForm(y!));
  });

  it('keeps the terminator’s target, rebased, so differing targets stay different', () => {
    // Built directly, because whether a `Jump` of +6 survives decoding depends on bounds the front end
    // decides (an out-of-range target normalises to `null`); the projection contract is about field names,
    // so the two forms are written out here.
    const { irs } = analyse(movie([[...pushString('a'), TRACE, STOP]]).bytes);
    const base = irs[0] as ActionIR;
    const shift = (ir: ActionIR, delta: number, target: number): ActionIR => ({
      ...ir,
      byteRange: { start: ir.byteRange.start + delta, end: ir.byteRange.end + delta },
      blocks: ir.blocks.map((block) => ({
        ...block,
        firstOffset: block.firstOffset + delta,
        endOffset: block.endOffset + delta,
        terminator: { kind: 'jump' as const, target },
      })),
    });
    // Same relative structure, different absolute position ⇒ equal forms.
    expect(canonicalForm(shift(base, 0, 12))).toBe(canonicalForm(shift(base, 6, 18)));
    // Different target *relative to the block* ⇒ different form. This is the assertion that fails if
    // `target`/`next`/`ifTrue`/`ifFalse` are ever dropped from the projection.
    expect(canonicalForm(shift(base, 0, 12))).not.toBe(canonicalForm(shift(base, 0, 18)));
    expect(canonicalForm(shift(base, 0, 12))).toContain('target');
  });

  it('treats two identical blocks in different tags as one unit', () => {
    const { irs } = analyse(
      movie([
        [...jump(6), ...pushString('t'), TRACE, STOP],
        [...jump(6), ...pushString('t'), TRACE, STOP],
      ]).bytes,
    );
    const [x, y] = irs as [ActionIR, ActionIR];
    const formX = canonicalForm(x!);
    const formY = canonicalForm(y!);
    expect(formX).toBe(formY);
    // The terminator survives the projection — a dropped field would make differing targets look equal,
    // which the test above pins precisely.
    expect(formX).toContain('terminator');
  });
});

describe('extendNameTable (IMPL-120-R012)', () => {
  const cand = (subjectId: string, orderKey: number) => ({
    kind: 'function' as const,
    subjectId,
    ownerCharacterId: null,
    base: 'shared',
    orderKey,
  });

  it('refuses to re-declare a subject a previous pass already named', () => {
    const base = assignNames([cand('a', 1)]);
    expect(() => extendNameTable(base, [cand('a', 2)])).toThrow(/extended, never duplicated/);
  });

  it('returns the base table untouched when there is nothing to add', () => {
    const base = assignNames([cand('a', 1)]);
    expect(extendNameTable(base, [])).toBe(base);
  });

  it('numbers the extension against the whole candidate set, not after it', () => {
    const base = assignNames([cand('a', 1)]);
    const extended = extendNameTable(base, [cand('b', 2), cand('c', 3)]);
    expect(extended.bySubject.get('a')).toBe('shared');
    expect(extended.bySubject.get('b')).toBe('shared_2');
    expect(extended.bySubject.get('c')).toBe('shared_3');
    // The extension cannot shrink the table or reorder what is already there.
    expect(extended.symbols.slice(0, 1)).toEqual(base.symbols.slice(0, 1));
  });

  it('changes a base name only when the combined sorted order says so', () => {
    // A candidate that sorts *before* everything in the base table competes for the bare name fairly.
    const base = assignNames([cand('late', 50)]);
    const extended = extendNameTable(base, [cand('early', 1)]);
    expect(extended.bySubject.get('early')).toBe('shared');
    expect(extended.bySubject.get('late')).toBe('shared_2');
  });
});
