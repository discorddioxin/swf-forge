/**
 * The frame-script pass — `WP-120-06`, `IMPL-120-R009`, `R017`.
 *
 * R009 asks two things: group the frame action blocks into per-frame functions, and hoist blocks that are
 * identical across frames. Both hinge on one judgement — *when are two blocks the same?* — and that
 * judgement has a trap in it. Byte ranges, block offsets and branch targets are all part of a block, so a
 * projection that simply drops them merges a block that jumps to label A with a block that jumps to label
 * B, and hoisting those two would change what the movie does. A projection that keeps them can never hoist
 * anything, because two copies of the same code sit at different offsets by definition.
 *
 * The resolution is to **rebase** rather than drop: every offset field in the block is rewritten relative
 * to the block's own start, so "identical" means identical structure *and* identical branching, while
 * position stops mattering. Literals, operands and terminator targets all survive the projection.
 *
 * Hoisting is also gated on the tier verdict: two structurally identical blocks at different tiers are not
 * the same emitted unit (one is a residual blob), and `IMPL-050-R059`'s rule that a nested verdict does not
 * force its parent down means tier equality has to be checked explicitly rather than assumed.
 *
 * Names for the shared units are allocated through `extendNameTable`, so the whole symbol namespace stays
 * one closed, collision-checked table before emission (`IMPL-120-R012`) instead of two passes each inventing
 * identifiers.
 */

import type { ActionIR } from '@swf-forge/avm1';

import type { NameCandidate, NameTable } from './names.js';
import { assignNames, buildNameTable } from './names.js';
import type { Pass, PassDecision, PassOutcome, PipelineState, StageContext } from '../pipeline.js';
import { PipelineError } from '../pipeline.js';

/**
 * The IR's offset-bearing fields, rewritten relative to the block start instead of being dropped. The names
 * are the `ActionIR` ones (`ir.ts`), not `control-flow.ts`'s internal `TerminatorSpec` (`targetOffset`,
 * `nextOffset`) — the terminator is `{kind:'jump', target}`, `{kind:'fallthrough', next}` and
 * `{kind:'branch', ifTrue, ifFalse}`, and a projection that missed those would call two blocks that branch
 * to different places "identical" and hoist one of them away. `target` is also the name of a *reference*
 * field (`Block.target: TargetRef`); only numeric values are rebased, so that one is walked, not shifted.
 */
const OFFSET_KEYS: ReadonlySet<string> = new Set([
  'firstOffset',
  'endOffset',
  'offset',
  'next',
  'target',
  'ifTrue',
  'ifFalse',
]);
const RANGE_KEYS: ReadonlySet<string> = new Set(['byteRange']);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rebase(value: unknown, origin: number): unknown {
  if (Array.isArray(value)) return value.map((item) => rebase(item, origin));
  if (!isRecord(value)) return value;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    const item = value[key];
    if (RANGE_KEYS.has(key) && isRecord(item)) {
      const start = typeof item.start === 'number' ? item.start : 0;
      const end = typeof item.end === 'number' ? item.end : 0;
      out[key] = { start: start - origin, end: end - origin };
      continue;
    }
    if (OFFSET_KEYS.has(key) && typeof item === 'number') {
      out[key] = item - origin;
      continue;
    }
    // A block's `id` and `ir.id` are position-derived strings; keeping them would defeat the rebase.
    if (key === 'id' || key === 'sourceName' || key === 'registers' || key === 'frameAssociations') continue;
    out[key] = rebase(item, origin);
  }
  return out;
}

/**
 * A canonical, position-independent form of one root IR: the block graph with offsets rebased to the block
 * start, and the fields that merely record *where* the block was excluded. Tier is deliberately not part of
 * it — the caller compares tiers separately so the reason a pair was not hoisted stays reportable.
 */
export function canonicalForm(ir: ActionIR): string {
  const origin = ir.blocks.length > 0 ? (ir.blocks[0]?.firstOffset ?? 0) : ir.byteRange.start;
  return JSON.stringify(rebase({ blocks: ir.blocks, residual: ir.residual }, origin));
}

export interface FrameScriptUnit {
  /** The block's stable id (`block:<ir.id>`), the same key the name table uses. */
  readonly subjectId: string;
  readonly irId: string;
  readonly frame: number;
  /** Position within the frame's tag order (`ActionSchedule`), so grouping cannot reorder execution. */
  readonly order: number;
  readonly tier: 0 | 1 | 2;
  readonly canonical: string;
  /** Set by the grouping: this member is emitted once and called from here. */
  readonly hoisted?: boolean;
}

export interface HoistedUnit {
  readonly name: string;
  readonly members: readonly FrameScriptUnit[];
  /** The frames that call it, in ascending order. */
  readonly frames: readonly number[];
}

export interface FrameGroup {
  readonly frame: number;
  /** The units to run for this frame, in execution order; hoisted ones appear as shared calls. */
  readonly units: readonly FrameScriptUnit[];
  readonly name: string;
}

export interface FramePlan {
  readonly frames: readonly FrameGroup[];
  readonly hoisted: readonly HoistedUnit[];
  /** Blocks the pass could not place on a frame, with the reason — never silent. */
  readonly ungrouped: readonly { readonly subjectId: string; readonly reason: string }[];
  /** Blocks that looked hoistable but were left alone, with the reason (R013's discipline). */
  readonly notHoisted: readonly { readonly subjectId: string; readonly reason: string }[];
  readonly table: NameTable;
}

export interface GroupInput {
  /** The root IRs (`MovieAnalysis.blocks`); region bodies and functions are reached through them. */
  readonly blocks: readonly ActionIR[];
  readonly frameCount: number;
  readonly table: NameTable;
}

function frameOf(ir: ActionIR): number | null {
  // `frameAssociations` is the block's own record of which timeline frames run it; the schedule is the
  // execution authority. This pass groups by the association and preserves schedule order within a frame.
  const associated = ir.frameAssociations;
  if (associated.length === 0) return null;
  return associated[0] ?? null;
}

/**
 * Groups main-timeline frame scripts by frame and hoists blocks that repeat across frames.
 *
 * Only `kind === 'timeline'` blocks are grouped. A clip-event or button block belongs to a character's own
 * handler table (doc 120 §4's `classes/` and `buttons/` trees, emitted by `WP-120-08`), and an init block is
 * once-only per sprite; treating either as a frame script would duplicate a function the emitter already
 * emits elsewhere, so they are reported as out-of-scope-for-this-pass instead of being absorbed.
 */
export function groupFrameScripts(input: GroupInput): FramePlan {
  const byFrame = new Map<number, FrameScriptUnit[]>();
  const ungrouped: { subjectId: string; reason: string }[] = [];
  const notHoisted: { subjectId: string; reason: string }[] = [];
  const grouped: FrameScriptUnit[] = [];

  for (const ir of input.blocks) {
    if (ir.kind !== 'timeline') {
      ungrouped.push({
        subjectId: `block:${ir.id}`,
        reason: `a ${ir.kind} block is emitted by its own table, not as a main-timeline frame script`,
      });
      continue;
    }
    const frame = frameOf(ir);
    if (frame === null) {
      ungrouped.push({ subjectId: `block:${ir.id}`, reason: 'the schedule associates this block with no frame' });
      continue;
    }
    const unit: FrameScriptUnit = {
      subjectId: `block:${ir.id}`,
      irId: ir.id,
      frame,
      order: byFrame.get(frame)?.length ?? 0,
      tier: ir.tier,
      canonical: canonicalForm(ir),
    };
    byFrame.set(frame, [...(byFrame.get(frame) ?? []), unit]);
    grouped.push(unit);
  }

  // Hoist: same canonical form, same tier, on at least two frames. A block used twice *within* one frame is
  // not a hoist candidate — the frame function runs it once per occurrence, and merging it would change what
  // the frame does.
  const byForm = new Map<string, FrameScriptUnit[]>();
  for (const unit of grouped) {
    const key = `${unit.tier}\u0000${unit.canonical}`;
    byForm.set(key, [...(byForm.get(key) ?? []), unit]);
  }
  const hoistable = [...byForm.entries()]
    .filter(
      ([key, members]) =>
        members.length > 1 && new Set(members.map((member) => member.frame)).size > 1 && !key.startsWith('2\u0000'),
    )
    .sort((a, b) => (a[1][0]?.frame ?? 0) - (b[1][0]?.frame ?? 0) || a[0].localeCompare(b[0]))
    .map(([, members]) => members);

  const hoistCandidates: NameCandidate[] = hoistable.map((members, index) => ({
    kind: 'hoistedBlock' as const,
    subjectId: `hoist:${members.map((member) => member.irId).join('+')}`,
    ownerCharacterId: null,
    base: null,
    orderKey: index,
  }));
  const extended = extendNameTable(input.table, hoistCandidates);

  const hoisted: HoistedUnit[] = hoistable.map((members) => ({
    name: extended.bySubject.get(`hoist:${members.map((member) => member.irId).join('+')}`) ?? 'unallocated',
    members,
    frames: [...new Set(members.map((member) => member.frame))].sort((a, b) => a - b),
  }));

  for (const unit of grouped) {
    if (unit.tier !== 2) continue;
    notHoisted.push({
      subjectId: unit.subjectId,
      reason:
        'a T2 block is emitted as a residual blob of its own bytes (IMPL-050-R057), so IR equality is not enough to merge it',
    });
  }

  const shared = new Set(hoisted.flatMap((unit) => unit.members.map((member) => member.subjectId)));
  const frames: FrameGroup[] = [...byFrame.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([frame, units]) => ({
      frame,
      // `R017`: the frame function is the runtime's unit of invocation; hoisted members are *calls* to the
      // shared unit in the same order, so execution sequence is preserved, not merely represented.
      units: units.map((unit, index) => ({ ...unit, order: index, hoisted: shared.has(unit.subjectId) })),
      name: `frame_${frame + 1}`,
    }));

  return { frames, hoisted, ungrouped, notHoisted, table: extended };
}

/**
 * Adds candidates to a closed table by re-running the one sorted pass over the *combined* list
 * (`IMPL-120-R012`): the namespace stays a single table every later pass reads, and a later pass cannot
 * quietly invent an identifier that collides with an earlier one. Re-running rather than appending is what
 * keeps `_2`/`_3` numbering a property of the whole candidate set.
 */
export function extendNameTable(base: NameTable, extra: readonly NameCandidate[]): NameTable {
  if (extra.length === 0) return base;
  const duplicate = extra.find((candidate) => base.bySubject.has(candidate.subjectId));
  if (duplicate !== undefined) {
    throw new PipelineError(
      `a later pass re-declared the subject ${duplicate.subjectId}; name tables are extended, never duplicated`,
    );
  }
  const existing: NameCandidate[] = base.symbols.map((symbol) => ({
    kind: symbol.kind,
    subjectId: symbol.subjectId,
    ownerCharacterId: symbol.ownerCharacterId,
    base: symbol.source === 'synthetic' ? null : symbol.name,
    orderKey: symbol.orderKey,
  }));
  return assignNames([...existing, ...extra]);
}

export interface FramesPassOptions {
  /** Test seam: the root IRs and the table, when the pipeline stages have not run. */
  readonly blocks?: readonly ActionIR[];
  readonly table?: NameTable;
}

/** The `names` pass of `IMPL-120` §3, as a runner-registered pass. */
export function namesPass(): Pass {
  return {
    id: 'names',
    run: (state: PipelineState, _ctx: StageContext): PassOutcome => {
      const model = state.model;
      const read = state.read;
      const analysis = state.analysis;
      if (model === undefined || read === undefined || analysis === undefined) {
        throw new PipelineError('the names pass needs the `read`, `model` and `analyze` stages');
      }
      const { table, decisions } = buildNameTable({
        model: model.model,
        file: read.file,
        blocks: analysis.analysis.blocks.map((block) => block.ir),
        classes: analysis.analysis.names.classes,
      });
      return { report: { id: 'names', decisions }, state: { names: table } };
    },
  };
}

/** The `frames` pass of `IMPL-120` §3, as a runner-registered pass. */
export function framesPass(options: FramesPassOptions = {}): Pass {
  return {
    id: 'frames',
    run: (state: PipelineState, _ctx: StageContext): PassOutcome => {
      const model = state.model;
      const analysis = state.analysis;
      const names = state.names ?? options.table;
      const blocks = options.blocks ?? analysis?.analysis.blocks.map((block) => block.ir);
      if (model === undefined || analysis === undefined || names === undefined || blocks === undefined) {
        throw new PipelineError('the frames pass needs the `model` and `analyze` stages and the names table');
      }
      const plan = groupFrameScripts({ blocks, frameCount: model.frameCount, table: names });
      const decisions: PassDecision[] = [];
      for (const group of plan.frames) {
        const calls = group.units.filter((unit) => unit.hoisted).length;
        decisions.push({
          subject: `frame ${group.frame + 1}`,
          action: `grouped into ${group.name}`,
          reason:
            group.units.length === 0
              ? 'every block on this frame was hoisted; the frame function is an empty entry point'
              : `${group.units.length} unit(s) in schedule order${calls === 0 ? '' : `, ${calls} shared call(s)`}`,
        });
      }
      for (const unit of plan.hoisted) {
        decisions.push({
          subject: unit.members.map((member) => member.irId).join(', '),
          action: `hoisted into ${unit.name}`,
          reason: `identical structure and branching (tier ${unit.members[0]?.tier ?? 0}) on frames ${unit.frames
            .map((frame) => frame + 1)
            .join(', ')}`,
        });
      }
      for (const orphan of plan.ungrouped) {
        decisions.push({ subject: orphan.subjectId, action: 'not grouped', reason: orphan.reason });
      }
      for (const skipped of plan.notHoisted) {
        decisions.push({ subject: skipped.subjectId, action: 'not hoisted', reason: skipped.reason });
      }
      return { report: { id: 'frames', decisions }, state: { frames: plan } };
    },
  };
}
