/**
 * The requirement-shake pass — `WP-120-04`, and the evidence for **`T-CMP-013`**.
 *
 * One job here can be quietly wrong: select the runtime modules to emit from the union of host-API
 * requirements, and report what was dropped. Quietly wrong means dropping a group something can still call,
 * which is a runtime crash wearing a build-size win. So the tests sit on the two places a shortcut hides —
 * the call graph this phase does not have yet (selection must therefore see *every* block that survives
 * pruning, not just the entry points), and the IR's one group that the spec's vocabulary does not carry
 * (`timeline`, errata `E-045`). The dead-code interaction tests are what prove the passes compose in the
 * order `IMPL-120-R013` mandates rather than in whichever order happened to be registered.
 */

import { describe, expect, it } from 'vitest';

import { DiagnosticSink, Tag, buildMovieModel } from '@swf-forge/swf';
import { openSwfNodeSync } from '@swf-forge/swf/node';
import { analyzeMovie, type ActionIR, type HostApiGroup } from '@swf-forge/avm1';
import {
  actionBlock,
  buildSwf,
  concat,
  defineShape,
  defineSprite,
  endTag,
  showFrames,
  tag,
} from '@swf-forge/swf/test-support';

import {
  SPEC_GROUPS,
  analyzeStage,
  deadCodePass,
  modelStage,
  readStage,
  resolveForgeConfig,
  runPipeline,
  shakeDecisions,
  shakePass,
  shakeRequirements,
  type DeadCodePlan,
} from '../src/index.js';

const TRACE = 0x26;
const STOP = 0x07;
const GET_PROPERTY = [0x22]; // `ActionGetProperty`: opcode < 0x80, so no length field
const UNKNOWN = 0xfe; // no `ACTIONRECORD` of this code exists, which tiers the block T2

function rec(code: number, body: readonly number[]): number[] {
  return [code, body.length & 0xff, (body.length >> 8) & 0xff, ...body];
}

/**
 * The `Push` (0x96) payload is a list of `(type, value)` pairs and carries **no** terminator, and every
 * fixture here has to leave the stack balanced.
 *
 * Both details fail in the same direction, which is why they are called out: a `Push` the front end cannot
 * read, or a `GetProperty` popping a value nobody pushed, tiers the block T2 — and a T2 block requires every
 * group, so each assertion below would pass while measuring the wrong thing.
 */
function pushValue(type: number, value: readonly number[]): number[] {
  return rec(0x96, [type, ...value]);
}

/** Push type 7 is a signed 32-bit integer literal; `GetProperty` resolves its id only from one of those. */
function pushInt(value: number): number[] {
  const unsigned = value >>> 0;
  return pushValue(7, [unsigned & 0xff, (unsigned >> 8) & 0xff, (unsigned >> 16) & 0xff, (unsigned >> 24) & 0xff]);
}

/** The receiver half of a `GetProperty`; any value works, since only the id is resolved. */
function pushTrue(): number[] {
  return pushValue(5, [1]);
}

/** `_xscale` — the geometry group. */
const GEOMETRY_READ = [...pushTrue(), ...pushInt(2), ...GET_PROPERTY, TRACE, STOP];
/** A block that touches nothing host-visible beyond `Trace` and `Stop`. */
const PLAIN = [...pushTrue(), TRACE, STOP];

function shape(id: number): Uint8Array {
  return defineShape({
    id,
    bounds: { x0: 0, y0: 0, x1: 4, y1: 4 },
    fills: [{ r: 0, g: 0, b: 0 }],
    paths: [{ start: { x: 0, y: 0 }, segments: [{ to: { x: 4, y: 4 } }], fill: 1 }],
  });
}

function read(frames: readonly (readonly number[] | null)[]) {
  const parts: Uint8Array[] = [];
  frames.forEach((records, index) => {
    parts.push(shape(100 + index));
    if (records !== null) parts.push(tag(Tag.DoAction, Uint8Array.from(actionBlock([...records]))));
    parts.push(showFrames(1));
  });
  parts.push(endTag());
  const bytes = buildSwf({ version: 8, body: concat(...parts), frameCount: frames.length });
  const file = openSwfNodeSync(bytes, { sink: new DiagnosticSink() });
  const model = buildMovieModel(file, {});
  const analysis = analyzeMovie(file, model, { emit: () => {} });
  return { bytes, file, model, irs: analysis.blocks.map((block) => block.ir), analysis };
}

/** The union, computed here without the pass, so a bug in the pass cannot agree with itself. */
function expectedGroups(blocks: readonly ActionIR[]): HostApiGroup[] {
  const seen = new Set<HostApiGroup>();
  for (const ir of blocks) {
    for (const requirement of ir.requirements) {
      seen.add(requirement.group === 'timeline' ? 'movie-objects' : requirement.group);
    }
  }
  return SPEC_GROUPS.filter((group) => seen.has(group));
}

/** A dead-code plan whose only content is "these blocks were removed". */
function deadPlan(pruned: readonly string[], candidates = 0): DeadCodePlan {
  return {
    characters: [],
    blocks: pruned.map((irId) => ({
      irId,
      kind: 'timeline' as const,
      state: 'pruned' as const,
      reason: 'owned by a character this pass proved dead',
      unreachableBlocks: [],
    })),
    removed: [],
    proofComplete: true,
    blockers: [],
    counts: {
      characters: 0,
      roots: 0,
      reachable: 0,
      candidates,
      removed: 0,
      blockCandidates: pruned.length + candidates,
      blocksRemoved: pruned.length,
      unreachableBasicBlocks: 0,
    },
  };
}

describe('selection (IMPL-120-R006)', () => {
  it('emits exactly the union over the blocks that can still run', () => {
    const { irs } = read([GEOMETRY_READ, PLAIN]);
    expect(irs.every((ir) => ir.tier === 0)).toBe(true); // the fixtures must not be silently T2

    const plan = shakeRequirements({ blocks: irs });

    expect(plan.used).toEqual(expectedGroups(irs));
    expect(plan.used).toEqual(['core-objects', 'movie-objects', 'geometry', 'misc-system']);
    expect(plan.counts.requirements).toBeGreaterThan(0);
    expect(plan.forcedByT2).toEqual([]);
  });

  it('never drops a group a kept block names, and reports every drop', () => {
    const { irs } = read([GEOMETRY_READ, PLAIN]);
    const plan = shakeRequirements({ blocks: irs });
    const decisions = shakeDecisions(plan);

    for (const group of plan.dropped) {
      const namedBy = irs.filter((ir) => ir.requirements.some((need) => need.group === group));
      expect(namedBy, `${group} was dropped but ${namedBy.map((ir) => ir.id).join(', ')} names it`).toEqual([]);
      expect(decisions.some((entry) => entry.subject === `group ${group}` && entry.action === 'not emitted')).toBe(
        true,
      );
    }
    expect(plan.dropped).toContain('filters');
    expect(plan.dropped).toContain('sound');
  });

  it('folds the IR-only timeline group into the spec row that owns those APIs (E-045)', () => {
    const { irs } = read([PLAIN]);
    const raw = new Set(irs.flatMap((ir) => ir.requirements.map((need) => need.group)));

    // The IR names a group AVM1-§8.1's table has no row for, and it is no corner case: `ActionStop` alone
    // maps to it, so every block that ends a timeline script requires it. A consumer treating `requirements`
    // as a module list would be handed a name with no runtime module behind it, for every movie in the
    // corpus — which is why the fold is reported rather than done quietly.
    expect(raw.has('timeline')).toBe(true);
    expect(SPEC_GROUPS).not.toContain('timeline');
    expect(SPEC_GROUPS).toHaveLength(13);

    const plan = shakeRequirements({ blocks: irs });
    expect(plan.used).toContain('movie-objects');
    expect(plan.used).not.toContain('timeline' as HostApiGroup);
    expect(plan.entryPoints.every((entry) => entry.foldedFrom.includes('timeline'))).toBe(true);
    expect(shakeDecisions(plan).some((entry) => entry.reason.includes('folded from timeline'))).toBe(true);
  });

  it('reports the per-entry-point union without letting selection use it', () => {
    const { irs } = read([GEOMETRY_READ, null, PLAIN]);
    const plan = shakeRequirements({ blocks: irs });

    expect(plan.entryPoints).toHaveLength(2);
    expect(plan.entryPoints.map((entry) => entry.id)).toEqual(
      [...plan.entryPoints.map((entry) => entry.id)].sort((a, b) => a.localeCompare(b)),
    );
    const geometry = plan.entryPoints.find((entry) => entry.groups.includes('geometry'));
    expect(geometry?.groups).toEqual(['core-objects', 'movie-objects', 'geometry', 'misc-system']);
    // The other entry point reads nothing host-visible, yet `Stop` alone reaches the timeline group — folded to
    // `movie-objects`, exactly as the fold test above pins — and `Push`/`Trace` are not free either.
    expect(plan.entryPoints.find((entry) => !entry.groups.includes('geometry'))?.groups).toEqual([
      'core-objects',
      'movie-objects',
      'misc-system',
    ]);
    // The other entry point needs nothing of the sort, yet the emitted set still carries geometry: selection
    // is movie-wide until `WP-120-08` emits a resolvable call graph, because a `CallFunction` is invisible in
    // `requirements`.
    expect(plan.used).toContain('geometry');
    expect(plan.modules.map((entry) => entry.group)).toContain('geometry');
  });

  it('requires every group when any kept block is T2', () => {
    const { irs } = read([[...rec(UNKNOWN, [1, 2, 3]), ...PLAIN]]);
    expect(new Set(irs.map((ir) => ir.tier))).toEqual(new Set([2]));

    const plan = shakeRequirements({ blocks: irs });
    expect(plan.used).toEqual([...SPEC_GROUPS]);
    expect(plan.dropped).toEqual([]);
    expect(plan.forcedByT2).toHaveLength(irs.length);
    expect(plan.assumptions.join(' ')).toContain('T2 residual');
    expect(shakeDecisions(plan).some((entry) => entry.action === 'forces every group')).toBe(true);
  });
});

describe('the dead-code interaction', () => {
  it('shrinks the selection to blocks the pruning pass actually removed', () => {
    const { irs } = read([GEOMETRY_READ, PLAIN]);
    const geometryBlock = irs.find((ir) => ir.requirements.some((need) => need.group === 'geometry'));
    expect(geometryBlock).toBeDefined();

    const plan = shakeRequirements({ blocks: irs, deadCode: deadPlan([geometryBlock?.id ?? 'absent']) });

    expect(plan.skipped).toEqual([geometryBlock?.id]);
    expect(plan.used).not.toContain('geometry');
    expect(plan.dropped).toContain('geometry');
    expect(plan.counts.blocks).toBe(irs.length - 1);
  });

  it('keeps counting a candidate it was not allowed to remove, and says so', () => {
    const { irs } = read([GEOMETRY_READ, PLAIN]);
    const plan = shakeRequirements({ blocks: irs, deadCode: deadPlan([], 1) });

    expect(plan.used).toContain('geometry');
    expect(plan.skipped).toEqual([]);
    expect(plan.assumptions.join(' ')).toContain('removed nothing');
    expect(plan.assumptions.join(' ')).toContain('1 character(s)');
  });

  it('states the assumption when the dead-code pass never ran', () => {
    const { irs } = read([PLAIN]);
    expect(shakeRequirements({ blocks: irs }).assumptions.join(' ')).toContain('the dead-code pass did not run');
  });

  it('prunes a sprite-only requirement along with the sprite', () => {
    // The requirement lives in a `DoInitAction` for a sprite nothing places. `IMPL-050-R073` and errata
    // `E-040` give that tag's payload as `UI16 SpriteID` plus the action stream, with no condition field — and
    // the tag sits at *movie level*, so the owning sprite comes from the schedule, not from the tag's
    // `inSprite` (which is null). Without that link the init action would outlive the sprite it belongs to.
    const doInitAction = (spriteId: number, records: readonly number[]): Uint8Array =>
      tag(
        Tag.DoInitAction,
        concat(Uint8Array.from([spriteId & 0xff, (spriteId >> 8) & 0xff]), Uint8Array.from(actionBlock([...records]))),
      );
    const bytes = buildSwf({
      version: 8,
      body: concat(
        shape(100),
        defineSprite(110, 1, endTag()),
        doInitAction(110, GEOMETRY_READ),
        showFrames(1),
        endTag(),
      ),
      frameCount: 1,
    });

    const run = (prune: boolean) =>
      runPipeline({
        input: bytes,
        inputName: 'game.swf',
        config: resolveForgeConfig({ input: 'game.swf', outDir: 'out' }),
        ...(prune ? { switches: { pruneDeadCode: true } } : {}),
        toolVersion: 'test-1',
        stages: [readStage('game.swf'), modelStage(), analyzeStage()],
        passes: [deadCodePass(), shakePass()],
      });

    const kept = run(false);
    const pruned = run(true);
    expect(kept.status).toBe('complete');
    expect(pruned.status).toBe('complete');
    expect(kept.state.shake?.used).toContain('geometry');
    expect(kept.state.shake?.skipped).toEqual([]);

    expect(pruned.state.deadCode?.removed).toContain(110);
    // One block in, one block out: the movie's only action block was the pruned sprite's init action.
    expect([kept.state.shake?.counts.blocks, pruned.state.shake?.counts.blocks]).toEqual([1, 0]);
    expect(pruned.state.shake?.skipped).not.toEqual([]);
    expect(pruned.state.shake?.dropped).toContain('geometry');
  });
});

describe('determinism and the runner', () => {
  it('is independent of the block order it is handed', () => {
    const { irs } = read([GEOMETRY_READ, PLAIN]);
    const forward = shakeRequirements({ blocks: irs });
    const backward = shakeRequirements({ blocks: [...irs].reverse() });

    expect(JSON.stringify(backward)).toBe(JSON.stringify(forward));
    expect(backward.entryPoints).toEqual(forward.entryPoints);
    expect(backward.used).toEqual(forward.used);
  });

  it('runs dead-code before shake on the pass spine and agrees with the analyze artifact', () => {
    const { bytes } = read([GEOMETRY_READ, PLAIN]);
    const result = runPipeline({
      input: bytes,
      inputName: 'game.swf',
      config: resolveForgeConfig({ input: 'game.swf', outDir: 'out' }),
      toolVersion: 'test-1',
      stages: [readStage('game.swf'), modelStage(), analyzeStage()],
      passes: [deadCodePass(), shakePass()],
    });

    expect(result.status).toBe('complete');
    expect(result.passes.slice(0, 2).map((entry) => [entry.id, entry.status])).toEqual([
      ['dead-code', 'ran'],
      ['shake', 'ran'],
    ]);
    const shake = result.state.shake;
    expect(shake?.used).toContain('geometry');
    expect(shake?.modules.map((entry) => entry.module)).toEqual((shake?.used ?? []).map((group) => `runtime/${group}`));

    const analysisGroups = new Set((result.state.analysis?.requirements ?? []).map((need) => need.group));
    expect(analysisGroups.has('timeline')).toBe(true);
    // Every group the pass selected must be in the artifact's own union, with the single exception the fold
    // creates. A group present in the selection but absent from the artifact would be an invented module.
    for (const group of shake?.used ?? []) {
      const fromTimeline = group === 'movie-objects' && analysisGroups.has('timeline');
      expect(analysisGroups.has(group) || fromTimeline).toBe(true);
    }
  });

  it('names the stage it needs when analyze did not run', () => {
    const { bytes } = read([PLAIN]);
    const result = runPipeline({
      input: bytes,
      inputName: 'game.swf',
      config: resolveForgeConfig({ input: 'game.swf', outDir: 'out' }),
      toolVersion: 'test-1',
      stages: [readStage('game.swf'), modelStage()],
      passes: [shakePass()],
    });

    expect(result.status).toBe('failed');
    expect(result.passes[1]?.error?.message).toContain('needs the `analyze` stage');
  });
});
