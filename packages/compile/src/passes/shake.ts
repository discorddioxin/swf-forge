/**
 * The requirement-shake pass — `WP-120-04`, `IMPL-120-R006`.
 *
 * `IMPL-050-R061` puts a host-API requirement list on every `ActionIR`, and the promise of the shake pass is
 * that the emitted project imports only the runtime modules those lists name. Two things make that less
 * simple than a union over the blocks:
 *
 * **The union must be over everything that can still run, not just the entry points.** `requirements` does
 * not carry a call graph, so a `CallFunction` to a compiled function is invisible here: a per-entry-point
 * union would happily drop `filters` because the frame script that reaches the filter-using function does not
 * name it itself. Until `WP-120-08` emits a resolvable call graph, the *emitted* set is the union over every
 * block that survives pruning, and the per-entry-point unions are reported alongside it. They are the numbers
 * a per-scene budget wants; they are not what selection is allowed to consume.
 *
 * **Over-approximation belongs to one layer.** A T2 block requires everything, because its residual blob can
 * call anything at runtime. Widening for dynamic *operands* is already done upstream (`requirements.ts`'s own
 * rule: a non-literal member name requires the group it could reach); re-widening here would make it
 * impossible to tell which of the two conservatisms produced a set, so this pass adds exactly one rule and
 * says so.
 *
 * The IR's group vocabulary is one wider than the spec's: `HostApiGroup` carries `timeline`
 * (`_currentframe`, `_totalframes`, `play`, `stop`, `gotoAnd*`), which AVM1-§8.1's table has no row for —
 * those APIs belong to its "Movie objects" row. Folding it is `IMPL-130`'s module layout's business in the
 * long run; for now the fold happens here, is reported, and is recorded as errata `E-045`. `GROUP_FOLD` is a
 * `Record<HostApiGroup, …>`, so the compiler refuses to let a newly-added group go unmapped.
 */

import type { ActionIR, HostApiGroup } from '@swf-forge/avm1';

import type { DeadCodePlan } from './dead-code.js';
import { PipelineError } from '../pipeline.js';
import type { Pass, PassDecision, PassOutcome, PipelineState, StageContext } from '../pipeline.js';

/** AVM1-§8.1's table rows, in the table's order. This is the module-selection vocabulary. */
export const SPEC_GROUPS: readonly HostApiGroup[] = [
  'core-objects',
  'movie-objects',
  'events',
  'sound',
  'loading',
  'data',
  'drawing',
  'bitmap',
  'geometry',
  'filters',
  'colour',
  'misc-system',
  'legacy-as1',
];

/**
 * Every group the IR can name, mapped to the spec row whose module serves it. A total `Record` over the
 * union, deliberately: when `WP-050-*` widens `HostApiGroup`, this is the line that fails to typecheck.
 */
const GROUP_FOLD: Record<HostApiGroup, HostApiGroup> = {
  'core-objects': 'core-objects',
  'movie-objects': 'movie-objects',
  events: 'events',
  sound: 'sound',
  loading: 'loading',
  data: 'data',
  drawing: 'drawing',
  bitmap: 'bitmap',
  geometry: 'geometry',
  filters: 'filters',
  colour: 'colour',
  'misc-system': 'misc-system',
  'legacy-as1': 'legacy-as1',
  timeline: 'movie-objects',
};

/** The kinds that run without being called: the entry points the report is per-`id`. */
const ENTRY_POINT_KINDS: ReadonlySet<ActionIR['kind']> = new Set<ActionIR['kind']>([
  'timeline',
  'init',
  'button',
  'clipEvent',
]);

export interface EntryPointUnion {
  readonly id: string;
  readonly kind: ActionIR['kind'];
  readonly groups: readonly HostApiGroup[];
  /** True when a T2 block in this entry point's own body forces the full set. */
  readonly forcesAll: boolean;
  /** Which groups arrived folded from a name the spec table does not carry. */
  readonly foldedFrom: readonly HostApiGroup[];
}

export interface ShakePlan {
  readonly entryPoints: readonly EntryPointUnion[];
  /** The groups whose modules are emitted, in `SPEC_GROUPS` order. */
  readonly used: readonly HostApiGroup[];
  readonly dropped: readonly HostApiGroup[];
  readonly modules: readonly { readonly group: HostApiGroup; readonly module: string }[];
  /** Blocks excluded from the union because the dead-code pass proved them unreachable (flag on only). */
  readonly skipped: readonly string[];
  readonly forcedByT2: readonly string[];
  readonly assumptions: readonly string[];
  readonly counts: { readonly blocks: number; readonly requirements: number };
}

export interface ShakeInput {
  readonly blocks: readonly ActionIR[];
  /** The dead-code plan, when that pass ran; its removals shrink the union. */
  readonly deadCode?: DeadCodePlan | undefined;
}

/** Sorts by `SPEC_GROUPS` order, so the emitted import list never depends on `Map` insertion order. */
function inSpecOrder(groups: Iterable<HostApiGroup>): HostApiGroup[] {
  const seen = new Set(groups);
  return SPEC_GROUPS.filter((group) => seen.has(group));
}

export function shakeRequirements(input: ShakeInput): ShakePlan {
  const { blocks, deadCode } = input;
  const pruned = new Set(
    (deadCode?.blocks ?? []).filter((verdict) => verdict.state === 'pruned').map((verdict) => verdict.irId),
  );
  const assumptions: string[] = [];
  if (deadCode === undefined) {
    assumptions.push(
      'the dead-code pass did not run, so every block counts toward the union (no candidate was excluded)',
    );
  } else if (deadCode.counts.removed === 0) {
    assumptions.push(
      `the dead-code pass reported ${deadCode.counts.candidates} character(s) and ${deadCode.counts.blockCandidates} block(s) but removed nothing (default is report-only), so they still contribute requirements`,
    );
  }

  const kept = [...blocks].filter((ir) => !pruned.has(ir.id)).sort((a, b) => a.id.localeCompare(b.id));
  const skipped = blocks.filter((ir) => pruned.has(ir.id)).map((ir) => ir.id);

  const union = new Set<HostApiGroup>();
  const folded = new Set<HostApiGroup>();
  const forcedByT2: string[] = [];
  for (const ir of kept) {
    for (const requirement of ir.requirements) {
      union.add(GROUP_FOLD[requirement.group]);
      if (requirement.group !== GROUP_FOLD[requirement.group]) folded.add(requirement.group);
    }
    if (ir.tier === 2 && !forcedByT2.includes(ir.id)) forcedByT2.push(ir.id);
  }
  if (forcedByT2.length > 0) {
    assumptions.push(
      `${forcedByT2.length} block(s) carry a T2 residual, which can call any host API at runtime: every group is required`,
    );
  }

  const used = forcedByT2.length > 0 ? [...SPEC_GROUPS] : inSpecOrder(union);
  const usedSet = new Set(used);
  const dropped = SPEC_GROUPS.filter((group) => !usedSet.has(group));

  const entryPoints: EntryPointUnion[] = kept
    .filter((ir) => ENTRY_POINT_KINDS.has(ir.kind))
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((ir) => {
      const own = new Set<HostApiGroup>();
      const ownFolded = new Set<HostApiGroup>();
      for (const requirement of ir.requirements) {
        own.add(GROUP_FOLD[requirement.group]);
        if (requirement.group !== GROUP_FOLD[requirement.group]) ownFolded.add(requirement.group);
      }
      return {
        id: ir.id,
        kind: ir.kind,
        groups: inSpecOrder(own),
        forcesAll: ir.tier === 2,
        foldedFrom: [...ownFolded].sort(
          (a, b) => SPEC_GROUPS.indexOf(GROUP_FOLD[a]) - SPEC_GROUPS.indexOf(GROUP_FOLD[b]),
        ),
      };
    });

  return {
    entryPoints,
    used,
    dropped,
    modules: used.map((group) => ({ group, module: `runtime/${group}` })),
    skipped,
    forcedByT2,
    assumptions,
    counts: {
      blocks: kept.length,
      requirements: kept.reduce((total, ir) => total + ir.requirements.length, 0),
    },
  };
}

/**
 * The report. `IMPL-120-R006`'s output is a *selection*, so the decisions name what was dropped rather than
 * what was kept: an empty module list is a build-size win only if the reason it is empty is visible.
 */
export function shakeDecisions(plan: ShakePlan): PassDecision[] {
  const decisions: PassDecision[] = [];
  for (const group of plan.dropped) {
    decisions.push({
      subject: `group ${group}`,
      action: 'not emitted',
      reason: 'no block that can still run names it (per-entry-point unions are reported so a reader can disagree)',
    });
  }
  for (const id of plan.skipped) {
    decisions.push({
      subject: `action block ${id}`,
      action: 'excluded from the union',
      reason: 'the dead-code pass proved it unreachable and was allowed to remove it',
    });
  }
  for (const id of plan.forcedByT2) {
    decisions.push({
      subject: `action block ${id}`,
      action: 'forces every group',
      reason: 'its T2 residual blob is interpreted, so its host-API calls are not statically known',
    });
  }
  for (const entry of plan.entryPoints) {
    decisions.push({
      subject: `entry point ${entry.id}`,
      action: `${entry.groups.length} group(s)`,
      reason: entry.forcesAll
        ? 'T2: requires everything; reported per entry point for the budget, never for selection'
        : `${entry.groups.join(', ') || 'none'}${entry.foldedFrom.length > 0 ? ` (folded from ${entry.foldedFrom.join(', ')})` : ''}`,
    });
  }
  for (const assumption of plan.assumptions) {
    decisions.push({ subject: 'shake', action: 'assumption', reason: assumption });
  }
  decisions.push({
    subject: 'runtime modules',
    action: `${plan.modules.length} emitted, ${plan.dropped.length} dropped`,
    reason:
      plan.dropped.length === 0
        ? 'nothing is dropped; the union covers the whole AVM1-§8.1 table'
        : `selected from ${plan.counts.blocks} block(s) carrying ${plan.counts.requirements} requirement(s)`,
  });
  return decisions;
}

export interface ShakePassOptions {
  readonly blocks?: readonly ActionIR[] | undefined;
  readonly deadCode?: DeadCodePlan | undefined;
}

export function shakePass(options: ShakePassOptions = {}): Pass {
  return {
    id: 'shake',
    run: (state: PipelineState, _ctx: StageContext): PassOutcome => {
      const blocks = options.blocks ?? state.analysis?.analysis.blocks.map((block) => block.ir);
      if (blocks === undefined) {
        throw new PipelineError('the shake pass needs the `analyze` stage');
      }
      const deadCode = options.deadCode ?? state.deadCode;
      const plan = shakeRequirements({ blocks, deadCode });
      return { report: { id: 'shake', decisions: shakeDecisions(plan) }, state: { shake: plan } };
    },
  };
}
