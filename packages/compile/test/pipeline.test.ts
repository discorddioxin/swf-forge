/**
 * The pipeline runner — `WP-120-01`.
 *
 * What is pinned here is the runner's own contract, not the stages' work: the order `CMP-R001` mandates
 * regardless of registration order, the state threading a stage depends on, the refusal that `CMP-R031`
 * requires, cancellation as a threaded signal rather than a special case (`IMPL-120-R003`), `--dry-run`
 * stopping after `plan` and writing nothing (`IMPL-120-R004`), an unimplemented stage being reported
 * rather than skipped silently, the pass spine of `IMPL-120` §3, the config rules `CMP-R004`/`R005`, and
 * the cache seam whose key `CMP` §12 defines.
 *
 * The three real stages run against fixtures built by `@swf-forge/swf/test-support`, including one that
 * carries an action block: the committed fixtures contain none, so a synthetic one is the only way to
 * exercise `analyze` in a unit test.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { Codes, DiagnosticSink, Tag, buildMovieModel, type SwfFile } from '@swf-forge/swf';
import { openSwfNodeSync } from '@swf-forge/swf/node';
import { actionBlock, buildSwf, concat, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

import {
  DEFAULT_FORGE_CONFIG,
  PASS_ORDER,
  PipelineCancelled,
  PipelineError,
  STAGE_ORDER,
  ConfigError,
  analyzeStage,
  configHash,
  createCancellationToken,
  linkAbortSignal,
  modelStage,
  readStage,
  resolveForgeConfig,
  runPipeline,
  serialiseConfig,
  stableStringify,
  stageCacheKey,
  type ForgeConfig,
  type Pass,
  type RunOptions,
  type RunResult,
  type Stage,
  type StageCache,
  type StageCacheEntry,
  type StageId,
} from '../src/index.js';

const FIXTURE = fileURLToPath(new URL('../../../fixtures/appendix-a.swf', import.meta.url));

/** `Stop` + the terminating `End` action byte, wrapped in a `DoAction` tag, then one frame. */
function actionBearingSwf(): Uint8Array {
  return buildSwf({ body: concat(tag(Tag.DoAction, actionBlock([0x07])), showFrames(1), endTag()), frameCount: 1 });
}

function avm2Swf(): Uint8Array {
  return buildSwf({ body: concat(tag(Tag.DoABC, new Uint8Array(4)), showFrames(1), endTag()), frameCount: 1 });
}

function fileAttributesAvm2Swf(): Uint8Array {
  // `FileAttributes.ActionScript3` — the flag value `frontend/avm2.ts` reads (0x08). The tag only exists
  // from SWF 8, so this fixture is not the default version 6.
  return buildSwf({
    version: 9,
    body: concat(tag(Tag.FileAttributes, Uint8Array.from([0x08, 0, 0, 0])), showFrames(1), endTag()),
    frameCount: 1,
  });
}

function config(overrides: Record<string, unknown> = {}): ForgeConfig {
  return resolveForgeConfig({ input: 'game.swf', outDir: 'out', ...overrides });
}

/** The three stages whose suppliers exist today (`WP-020-10`, `WP-030-09`, `WP-050-*`). */
function realStages(inputName = 'game.swf'): Stage[] {
  return [readStage(inputName), modelStage(), analyzeStage()];
}

function run(input: Uint8Array, stages: Stage[] = realStages(), extra: Partial<RunOptions> = {}): RunResult {
  return runPipeline({ input, inputName: 'game.swf', config: config(), toolVersion: 'test-1', stages, ...extra });
}

function statusOf(result: RunResult, id: StageId): string | undefined {
  return result.stages.find((stage) => stage.id === id)?.status;
}

function memoryCache(): StageCache & { readonly entries: Map<string, StageCacheEntry>; readonly deleted: string[] } {
  const entries = new Map<string, StageCacheEntry>();
  const deleted: string[] = [];
  return {
    entries,
    deleted,
    get: (key) => entries.get(key) ?? null,
    put: (key, entry) => {
      entries.set(key, entry);
    },
    delete: (key) => {
      deleted.push(key);
      entries.delete(key);
    },
  };
}

describe('stage spine (CMP-R001, IMPL-120 §2)', () => {
  it('runs stages in the mandated order whatever order they were registered in', () => {
    const result = run(actionBearingSwf(), [analyzeStage(), readStage('game.swf'), modelStage()]);

    expect(result.status).toBe('complete');
    expect(result.stages.map((stage) => stage.id)).toEqual([...STAGE_ORDER]);
    expect(result.stages.map((stage) => stage.status)).toEqual([
      'ran',
      'ran',
      'unregistered',
      'ran',
      'unregistered',
      'unregistered',
      'unregistered',
    ]);
    expect(STAGE_ORDER).toEqual(['read', 'model', 'decode', 'analyze', 'plan', 'emit', 'report']);
  });

  it('threads each stage output into the next, over a real action-bearing movie', () => {
    const result = run(actionBearingSwf());
    const { read, model, analysis } = result.state;

    expect(read?.version).toBeGreaterThanOrEqual(4);
    expect(read?.tagCount).toBe(3); // DoAction, ShowFrame, End
    expect(read?.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(model?.frameCount).toBe(1);
    expect(analysis?.actionBlockCount).toBe(1);
    expect(analysis?.functionCount).toBe(0);
    expect(analysis?.tiers).toEqual({ T0: 1, T1: 0, T2: 0 });
    expect(result.diagnostics.summary.errors).toBe(0);
  });

  it('runs the same three stages over a committed fixture', () => {
    const bytes = new Uint8Array(readFileSync(FIXTURE));
    const result = run(bytes, realStages('fixtures/appendix-a.swf'));

    expect(result.status).toBe('complete');
    expect(result.stages[0]?.effects.reads).toEqual(['fixtures/appendix-a.swf']);
    expect(result.state.analysis?.actionBlockCount).toBe(0); // no committed fixture carries an action block
  });

  it('reports an unimplemented stage instead of skipping it silently (SF0500)', () => {
    const result = run(actionBearingSwf());
    const codes = result.diagnostics.items.map((item) => item.code);

    expect(codes.filter((code) => code === Codes.STAGE_UNIMPLEMENTED)).toHaveLength(1);
    const message = result.diagnostics.items.find((item) => item.code === Codes.STAGE_UNIMPLEMENTED)?.message ?? '';
    expect(message).toContain('decode, plan, emit, report');
    expect(result.diagnostics.items.every((item) => item.severity !== 'error')).toBe(true);
  });

  it('stops with `refused` on AVM2 content, from either detection source (CMP-R031)', () => {
    for (const bytes of [avm2Swf(), fileAttributesAvm2Swf()]) {
      const result = run(bytes);

      expect(result.status).toBe('refused');
      expect(statusOf(result, 'analyze')).toBe('refused');
      expect(statusOf(result, 'plan')).toBe('not-run');
      expect(result.stages.find((stage) => stage.id === 'analyze')?.stopReason).not.toBe('');
      expect(result.diagnostics.items.some((item) => item.code === Codes.AVM2_CONTENT)).toBe(true);
    }
  });

  it('records a throwing stage as failed and runs nothing after it', () => {
    const broken: Stage = {
      id: 'model',
      effects: { reads: [], writes: [] },
      run: () => {
        throw new Error('model exploded');
      },
    };
    const result = run(actionBearingSwf(), [readStage('game.swf'), broken, analyzeStage()]);

    expect(result.status).toBe('failed');
    expect(statusOf(result, 'model')).toBe('failed');
    expect(result.stages.find((stage) => stage.id === 'model')?.error).toEqual({
      name: 'Error',
      message: 'model exploded',
    });
    expect(statusOf(result, 'analyze')).toBe('not-run');
  });

  it('stops a stage that runs without its supplier, as a wiring bug', () => {
    const result = run(actionBearingSwf(), [analyzeStage()]);

    expect(result.status).toBe('failed');
    expect(result.stages.find((stage) => stage.id === 'analyze')?.error?.name).toBe('PipelineError');
  });

  it('refuses two stages that declare the same write effect (CMP-R003)', () => {
    const a: Stage = { id: 'emit', effects: { reads: [], writes: ['src/manifest.ts'] }, run: () => ({}) };
    const b: Stage = { id: 'report', effects: { reads: [], writes: ['src/manifest.ts'] }, run: () => ({}) };

    expect(() => run(actionBearingSwf(), [...realStages(), a, b])).toThrow(PipelineError);
    expect(() => run(actionBearingSwf(), [...realStages(), a, { ...a }])).toThrow(/registered twice/);
  });

  it('runs through `plan` and no further under --dry-run, writing nothing (IMPL-120-R004)', () => {
    const invoked: string[] = [];
    const sentinel = (id: StageId, path: string): Stage => ({
      id,
      effects: { reads: [], writes: [path] },
      run: () => {
        invoked.push(id);
        return { files: [{ path, bytes: new Uint8Array(1) }] };
      },
    });
    const result = run(
      actionBearingSwf(),
      [...realStages(), sentinel('emit', 'src/manifest.ts'), sentinel('report', 'build-info.json')],
      {
        switches: { dryRun: true },
      },
    );

    expect(result.status).toBe('dry-run');
    expect(statusOf(result, 'plan')).toBe('unregistered'); // nothing implements `plan` yet (WP-120-07)
    expect(statusOf(result, 'emit')).toBe('dry-run-skipped');
    expect(statusOf(result, 'report')).toBe('dry-run-skipped');
    expect(invoked).toEqual([]);
    expect(result.files).toEqual([]);
  });

  it('collects the files a stage produces instead of writing them', () => {
    const emitStage: Stage = {
      id: 'emit',
      effects: { reads: [], writes: ['src/manifest.ts'] },
      run: () => ({ files: [{ path: 'src/manifest.ts', bytes: Uint8Array.from([1, 2, 3]) }] }),
    };
    const result = run(actionBearingSwf(), [...realStages(), emitStage]);

    expect(result.files).toEqual([{ path: 'src/manifest.ts', bytes: Uint8Array.from([1, 2, 3]) }]);
    expect(result.stages.find((stage) => stage.id === 'emit')?.files).toBe(1);
  });
});

describe('cancellation (IMPL-120-R003)', () => {
  it('checkpoints at a stage boundary: the stage it stops at is cancelled, the rest not-run', () => {
    const cancel = createCancellationToken();
    const result = run(actionBearingSwf(), realStages(), { cancel });
    // Re-run with the token already cancelled before `model`.
    const token = createCancellationToken();
    const read: Stage = {
      id: 'read',
      effects: { reads: ['game.swf'], writes: [] },
      run: (state, ctx) => {
        token.cancel('user pressed Ctrl-C');
        return readStage('game.swf').run(state, ctx);
      },
    };
    const cancelled = run(actionBearingSwf(), [read, modelStage(), analyzeStage()], { cancel: token });

    expect(result.status).toBe('complete');
    expect(cancelled.status).toBe('cancelled');
    expect(statusOf(cancelled, 'read')).toBe('ran');
    expect(statusOf(cancelled, 'model')).toBe('cancelled');
    expect(statusOf(cancelled, 'analyze')).toBe('not-run');
    expect(cancelled.cancelReason).toBe('user pressed Ctrl-C');
  });

  it('is a signal threaded through the stage: a loop that checkpoints stops mid-stage', () => {
    const token = createCancellationToken();
    const seen: number[] = [];
    const looping: Stage = {
      id: 'decode',
      effects: { reads: [], writes: [] },
      run: (_state, ctx) => {
        for (let item = 0; item < 100; item += 1) {
          ctx.cancel.throwIfCancelled();
          seen.push(item);
          if (item === 4) ctx.cancel.cancel('asset encode interrupted');
        }
        return {};
      },
    };
    const result = run(actionBearingSwf(), [readStage('game.swf'), modelStage(), looping], { cancel: token });

    expect(result.status).toBe('cancelled');
    expect(statusOf(result, 'decode')).toBe('cancelled');
    expect(seen).toEqual([0, 1, 2, 3, 4]); // stopped at the next checkpoint, not after the loop
    expect(token.reason).toBe('asset encode interrupted');
  });

  it('bridges an AbortSignal, and detaches again', () => {
    const token = createCancellationToken();
    const controller = new AbortController();
    const unlink = linkAbortSignal(token, controller.signal);

    expect(token.cancelled).toBe(false);
    unlink();
    controller.abort();
    expect(token.cancelled).toBe(false); // detached: the abort no longer reaches the token

    const second = createCancellationToken();
    const controller2 = new AbortController();
    linkAbortSignal(second, controller2.signal);
    controller2.abort();
    expect(second.cancelled).toBe(true);
    expect(second.reason).toBe('interrupted');
    expect(() => second.throwIfCancelled()).toThrow(PipelineCancelled);

    const already = new AbortController();
    already.abort();
    const third = createCancellationToken();
    linkAbortSignal(third, already.signal, 'task killed');
    expect(third.reason).toBe('task killed');
  });
});

describe('the pass spine (IMPL-120 §3)', () => {
  function pass(id: Pass['id'], log: string[]): Pass {
    return {
      id,
      run: () => {
        log.push(id);
        return { report: { id, decisions: [{ subject: 'character 7', action: 'pruned', reason: 'unreferenced' }] } };
      },
    };
  }

  it('runs registered passes after `analyze` and before `plan`, in PASS_ORDER', () => {
    const log: string[] = [];
    const result = run(actionBearingSwf(), realStages(), {
      passes: [pass('names', log), pass('dead-code', log), pass('frames', log)],
    });

    expect(log).toEqual(['dead-code', 'names', 'frames']);
    expect(PASS_ORDER).toEqual(['dead-code', 'shake', 'tier-finalise', 'names', 'frames']);
    expect(result.passes.map((entry) => [entry.id, entry.status, entry.decisions])).toEqual([
      ['dead-code', 'ran', 1],
      ['shake', 'unregistered', 0],
      ['tier-finalise', 'unregistered', 0],
      ['names', 'ran', 1],
      ['frames', 'ran', 1],
    ]);
    expect(result.state.passes?.map((report) => report.id)).toEqual(['dead-code', 'names', 'frames']);
    // An absent pass is a configuration fact, not a defect: no diagnostic for it (unlike SF0500).
    expect(result.diagnostics.items.filter((item) => item.code === Codes.STAGE_UNIMPLEMENTED)).toHaveLength(1);
  });

  it('runs no pass once a stage has failed', () => {
    const log: string[] = [];
    const broken: Stage = {
      id: 'analyze',
      effects: { reads: [], writes: [] },
      run: () => {
        throw new Error('no IR today');
      },
    };
    const result = run(actionBearingSwf(), [readStage('game.swf'), modelStage(), broken], {
      passes: [pass('dead-code', log)],
    });

    expect(result.status).toBe('failed');
    expect(log).toEqual([]);
    expect(result.passes[0]?.status).toBe('not-run');
  });
});

describe('configuration (CMP-R004, CMP-R005, CMP-R003)', () => {
  it('fills defaults and rejects an unknown key at any level, naming every path', () => {
    const resolved = config();
    expect(resolved.target).toBe(DEFAULT_FORGE_CONFIG.target);
    expect(resolved.audio.sampleRate).toBe(48000);
    expect(resolved.vm.residual).toBe('on-demand');

    expect(() => resolveForgeConfig({ input: 'a.swf', outDir: 'out', targt: 'modern' })).toThrow(ConfigError);
    try {
      resolveForgeConfig({
        input: 'a.swf',
        outDir: 'out',
        targt: 'modern',
        graphics: { atlas: { maxSize: 1024 }, settle: 'maybe' },
      });
      throw new Error('should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const failure = error as ConfigError;
      expect(failure.unknownKeys).toEqual(['targt']);
      // `maxSize: 1024` is a known key with a value outside the enum, so it is invalid, not unknown.
      expect(failure.invalidValues.join(' · ')).toContain('graphics.atlas.maxSize must be one of 2048, 4096, 8192');
      expect(failure.invalidValues.join(' · ')).toContain('graphics.settle must be one of');
    }
  });

  it("rejects failOn: 'risk' loudly instead of honouring nothing (errata E-043)", () => {
    // CMP §3 declares the value and CMP §9.2 gives it an outcome, but no diagnostic can be a `risk`
    // today: the implemented model has three severities. A switch that cannot fire is an invalid value.
    expect(() => config({ diagnostics: { failOn: 'risk' } })).toThrow(ConfigError);
    try {
      config({ diagnostics: { failOn: 'risk' } });
      throw new Error('should have thrown');
    } catch (error) {
      expect((error as ConfigError).invalidValues.join(' ')).toContain('E-043');
    }
    expect(config({ diagnostics: { failOn: 'warning' } }).diagnostics.failOn).toBe('warning');
  });

  it('requires input and outDir', () => {
    expect(() => resolveForgeConfig({ outDir: 'out' })).toThrow(/input is required/);
    expect(() => resolveForgeConfig({ input: 'a.swf' })).toThrow(/outDir is required/);
    expect(resolveForgeConfig({ input: { main: 'a.swf', others: ['b.swf'] }, outDir: 'out' }).input).toEqual({
      main: 'a.swf',
      others: ['b.swf'],
    });
  });

  it('writes only what the defaults would not reproduce, plus $schemaVersion (CMP-R004)', () => {
    const written = serialiseConfig(config());
    expect(written.$schemaVersion).toBe(1);
    expect(written.input).toBe('game.swf');
    expect(written.outDir).toBe('out');
    expect(written.graphics).toBeUndefined();
    expect(written.audio).toBeUndefined();

    const tuned = serialiseConfig(config({ audio: { sampleRate: 44100 }, graphics: { atlas: { padding: 4 } } }));
    expect(tuned.audio).toEqual({ sampleRate: 44100 });
    expect(tuned.graphics).toEqual({ atlas: { padding: 4 } });
  });

  it('hashes only the config a stage declares it reads (CMP-R003)', () => {
    const base = config();
    expect(configHash(base, 'read')).toBe(configHash(base, 'read'));
    expect(configHash(base, 'read')).not.toBe(configHash(base, 'emit')); // different relevant sets
    // `read` and `analyze` read no config at all, so nothing about the config can move their keys.
    // (`analyze`'s one caller-selected input, `legacyEncoding`, is a stage option and travels in that
    // stage's input hash instead — see `stages/analyze.ts`.)
    expect(configHash(config({ audio: { codec: 'opus' } }), 'read')).toBe(configHash(base, 'read'));
    expect(configHash(config({ vm: { residual: 'forbid' } }), 'analyze')).toBe(configHash(base, 'analyze'));
    // `emit` reads the vm policy, so that one does move it.
    expect(configHash(config({ vm: { residual: 'forbid' } }), 'emit')).not.toBe(configHash(base, 'emit'));
    expect(stableStringify({ b: 1, a: { d: 4, c: 3 } })).toBe(stableStringify({ a: { c: 3, d: 4 }, b: 1 }));
  });

  it('computes CMP §12 keys: stage, input hash, tool version and relevant config each move the key', () => {
    const key = stageCacheKey('read', 'aa', 'test-1', 'cc');
    expect(key).toMatch(/^[0-9a-f]{64}$/);
    expect(stageCacheKey('model', 'aa', 'test-1', 'cc')).not.toBe(key);
    expect(stageCacheKey('read', 'bb', 'test-1', 'cc')).not.toBe(key);
    expect(stageCacheKey('read', 'aa', 'test-2', 'cc')).not.toBe(key);
    expect(stageCacheKey('read', 'aa', 'test-1', 'dd')).not.toBe(key);
  });
});

describe('the cache seam (CMP-R038, IMPL-120-R002)', () => {
  /** A stage that is cacheable: it declares an input hash and a codec for its own outcome. */
  function cacheableStage(runs: string[]): Stage {
    return {
      id: 'plan',
      effects: { reads: [], writes: ['budgets.json'] },
      inputHash: (state) => state.read?.sha256 ?? '',
      codec: {
        serialise: (outcome) => outcome,
        deserialise: (payload) => payload as ReturnType<Stage['run']>,
      },
      run: (state) => {
        runs.push(state.read?.sha256 ?? '');
        return {
          files: [{ path: 'budgets.json', bytes: Uint8Array.from([9]) }],
        };
      },
    };
  }

  it('serves a hit without running the stage, and reproduces the same files', () => {
    const runs: string[] = [];
    const cache = memoryCache();
    const bytes = actionBearingSwf();
    const stages = (): Stage[] => [...realStages(), cacheableStage(runs)];

    const cold = run(bytes, stages(), { cache });
    const warm = run(bytes, stages(), { cache });

    expect(cold.status).toBe('complete');
    expect(statusOf(cold, 'plan')).toBe('ran');
    expect(statusOf(warm, 'plan')).toBe('cached');
    expect(runs).toHaveLength(1); // the second run never invoked the stage
    expect(warm.files).toEqual(cold.files);
    // Both cacheable stages stored an entry: `analyze` (the real one) and this synthetic `plan`.
    expect([...cache.entries.values()].map((entry) => entry.stage).sort()).toEqual(['analyze', 'plan']);
    expect(warm.stages.find((stage) => stage.id === 'plan')?.cacheKey).toMatch(/^[0-9a-f]{64}$/);
  });

  it('honours --no-cache (CMP-R039) and leaves an uncacheable stage alone', () => {
    const runs: string[] = [];
    const cache = memoryCache();
    const bytes = actionBearingSwf();

    run(bytes, [...realStages(), cacheableStage(runs)], { cache });
    run(bytes, [...realStages(), cacheableStage(runs)], { cache, switches: { noCache: true } });

    expect(runs).toHaveLength(2);
    // `read` declares no codec: its output is a live `SwfFile`, so it is never cached.
    const result = run(bytes, realStages(), { cache });
    expect(result.stages.find((stage) => stage.id === 'read')?.cacheKey).toBeNull();
  });
});

describe('the supplied stages are the real suppliers', () => {
  it('reads what WP-020-10 delivered, models what WP-030-09 delivered', () => {
    const bytes = actionBearingSwf();
    const sink = new DiagnosticSink();
    const file: SwfFile = openSwfNodeSync(bytes, { sink });
    const model = buildMovieModel(file, {});

    const result = run(bytes);
    expect(result.state.model?.characterCount).toBe(model.characters.size);
    expect(result.state.read?.definitionCount).toBe(file.definitions.length);
    expect(result.state.read?.spriteRangeCount).toBe(file.tagIndex.spriteRanges.size);
    // `Stop` is not free of host API: it is a timeline control requirement the shake pass must keep.
    expect(result.state.analysis?.requirements).toEqual([{ group: 'timeline', offset: null, via: 'timeline:stop' }]);
  });
});
