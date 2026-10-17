/**
 * The content-keyed stage cache — `WP-120-02`, and the evidence for **`T-CMP-005`**: cold and warm builds
 * produce identical outputs.
 *
 * "Identical outputs" is tested as bytes, not as object identity: a stand-in consumer stage turns the
 * analysis into a file the way the report stage will, and the cold and warm runs' file bytes are compared.
 * That is what makes the test able to fail — if the codec dropped or reshaped anything, the warm run would
 * be reconstructing the consumer's input from the cache and its bytes would differ. As the emit stages land
 * (`WP-120-08`…`-11`) the subject of this test grows to the emitted project; today the outputs are the
 * report projection the analysis feeds.
 *
 * The movie is synthetic and deliberately not trivial: a sprite with a `DoInitAction`, a named
 * `DefineFunction` with a parameter, and a frame script — so the cached value carries nested function IR,
 * the schedule's number-keyed `Map` and both name tables, which is where a hand-rolled codec would lose
 * something. No committed fixture carries an action block at all (F-P5-07), which is why this is synthetic.
 *
 * The negative controls matter as much as the positive ones: a tampered payload must be *caught* by
 * `--verify-cache` (`IMPL-120-R002`'s "provably equivalent"), a changed effect set must evict (`CMP-R038`),
 * and a corrupt entry must degrade to a miss rather than break the build.
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { Codes, Tag } from '@swf-forge/swf';
import { actionBlock, buildSwf, concat, defineSprite, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

import type { ActionIR } from '@swf-forge/avm1';

import {
  CACHE_DIRNAME,
  CACHE_ENTRY_SCHEMA_VERSION,
  analyzeStage,
  decode,
  encode,
  fileStageCache,
  modelStage,
  readStage,
  resolveForgeConfig,
  runPipeline,
  stableForm,
  stalenessOf,
  type AnalysisArtifact,
  type ForgeConfig,
  type RunResult,
  type Stage,
  type StageCache,
} from '../src/index.js';

const TRACE = 0x26;
const STOP = 0x07;

function u16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function nul(text: string): number[] {
  return [...new TextEncoder().encode(text), 0];
}

/** An `ACTIONRECORD` header: code, `UI16 Length`, body. */
function rec(code: number, body: readonly number[]): number[] {
  return [code, body.length & 0xff, (body.length >> 8) & 0xff, ...body];
}

function pushString(text: string): number[] {
  return rec(0x96, [0x00, ...nul(text)]);
}

/**
 * `DefineFunction` (0x9b): `Length` covers the name, the parameter count and names and `CodeSize`; the code
 * itself follows *past* the record (doc 050's R071), and a body is not `End`-terminated (E-037).
 */
function defineFunction(name: string, params: readonly string[], body: readonly number[]): number[] {
  const header = [...nul(name), ...u16(params.length)];
  for (const param of params) header.push(...nul(param));
  header.push(...u16(body.length));
  return [...rec(0x9b, header), ...body];
}

/** A sprite with an init script, a named function and a frame script — three IRs, two name tables. */
function richMovie(): Uint8Array {
  const initBlock = actionBlock([...pushString('init'), TRACE, STOP]);
  const frameBlock = actionBlock([
    ...defineFunction('onEnterFrame', ['who'], [...pushString('hi'), TRACE, STOP]),
    ...pushString('frame 1'),
    TRACE,
    STOP,
  ]);
  return buildSwf({
    body: concat(
      defineSprite(7, 1, concat(showFrames(1), endTag())),
      tag(Tag.DoInitAction, Uint8Array.from([...u16(7), ...initBlock])),
      tag(Tag.DoAction, Uint8Array.from(frameBlock)),
      showFrames(1),
      endTag(),
    ),
    frameCount: 1,
  });
}

/**
 * A canonical form of the analysis built from primitive accessors, deliberately *not* via `encode`.
 *
 * This is the trap this file nearly fell into: projecting the cold and warm objects with the codec under
 * test makes the comparison blind to any lossiness the codec has, because both sides lose the same way.
 * (The corpus probe I used to size this cache did exactly that, and reported a clean result while the
 * stored payloads were 11.6 KB smaller than honest ones — see the note in
 * `audits/P0-P5-COMPLETION-AND-P6-READINESS.md` §11.2.) A projection that reads the shape itself is what
 * gives the byte comparison below its power.
 */
function project(analysis: AnalysisArtifact | undefined): string {
  if (analysis === undefined) return 'none';
  const mapForm = (map: ReadonlyMap<unknown, unknown>): string =>
    [...map.entries()]
      .map(([key, value]) => `${stableForm(key)}=>${stableForm(value)}`)
      .sort()
      .join(',');
  const irForm = (ir: ActionIR): string =>
    `ir ${ir.id} tier=${ir.tier} blocks=${ir.blocks.length} ops=${ir.blocks.reduce((n, b) => n + b.ops.length, 0)} ` +
    `residual=${ir.residual === null ? 'null' : ir.residual.length} reasons=${mapForm(new Map(ir.tierReasons.map((r) => [r.reason, r.offset])))}`;
  return [
    `blocks=${analysis.actionBlockCount} functions=${analysis.functionCount} tiers=${stableForm(analysis.tiers)}`,
    `requirements=${mapForm(new Map(analysis.requirements.map((r) => [r.group, `${r.via}@${String(r.offset)}`])))}`,
    `avm2=${stableForm(analysis.analysis.avm2)}`,
    `frameScripts=${analysis.analysis.schedule.frameScripts.length}`,
    `initScripts=${analysis.analysis.schedule.initScripts.length}`,
    `initBySprite=[${mapForm(analysis.analysis.schedule.initBySprite)}]`,
    `names=[${mapForm(analysis.analysis.names.names)}]`,
    `classes=[${mapForm(
      new Map([...analysis.analysis.names.classes.entries()].map(([name, model]) => [name, mapForm(model.methods)])),
    )}]`,
    `t2FrameScripts=${stableForm(analysis.analysis.t2FrameScripts)}`,
    `irs=${analysis.analysis.blocks
      .map((block) => irForm(block.ir))
      .sort()
      .join(';')}`,
  ].join('\n');
}

/** Stands in for the report stage: turns the analysis into bytes, so "identical outputs" means bytes. */
function consumerStage(): Stage {
  return {
    id: 'report',
    effects: { reads: [], writes: ['porting-notes.json'] },
    run: (state) => ({
      files: [{ path: 'porting-notes.json', bytes: new TextEncoder().encode(`${project(state.analysis)}\n`) }],
    }),
  };
}

function config(): ForgeConfig {
  return resolveForgeConfig({ input: 'game.swf', outDir: 'out' });
}

function build(
  dir: string,
  options: { bytes?: Uint8Array; toolVersion?: string; switches?: Record<string, boolean>; stages?: Stage[] } = {},
): RunResult {
  return runPipeline({
    input: options.bytes ?? richMovie(),
    inputName: 'game.swf',
    config: config(),
    toolVersion: options.toolVersion ?? 'test-1',
    stages: options.stages ?? [readStage('game.swf'), modelStage(), analyzeStage(), consumerStage()],
    cache: fileStageCache({ dir }),
    ...(options.switches === undefined ? {} : { switches: options.switches }),
  });
}

function outputBytes(result: RunResult): string[] {
  return result.files.map((file) => `${file.path}:${new TextDecoder().decode(file.bytes)}`);
}

function statusOf(result: RunResult, id: string): string | undefined {
  return result.stages.find((stage) => stage.id === id)?.status;
}

function entryFiles(dir: string): string[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort();
}

let dir = '';

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'forge-cache-'));
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('T-CMP-005 — cold and warm builds produce identical outputs', () => {
  it('serves the analysis from the cache and reproduces the same bytes', () => {
    const cold = build(dir);
    expect(statusOf(cold, 'analyze')).toBe('ran');
    expect(cold.state.analysis?.actionBlockCount).toBe(2); // frame script + the sprite's init script
    expect(cold.state.analysis?.functionCount).toBe(1); // onEnterFrame
    expect(cold.files).toHaveLength(1);

    const warm = build(dir);
    expect(statusOf(warm, 'analyze')).toBe('cached');
    expect(statusOf(warm, 'report')).toBe('ran'); // the consumer always runs; only `analyze` is cacheable
    expect(outputBytes(warm)).toEqual(outputBytes(cold));
    expect(project(warm.state.analysis)).toBe(project(cold.state.analysis));
    expect(entryFiles(dir)).toHaveLength(1);
  });

  it('reconstructs the parts a hand-rolled codec would drop: nested IR, number-keyed Maps, name tables', () => {
    const cold = build(dir);
    const warm = build(dir);
    // The reconstruction is checked against the *live* cold object, not against a re-encoded copy.
    expect(project(warm.state.analysis)).toBe(project(cold.state.analysis));
    const coldAnalysis = cold.state.analysis?.analysis;
    const warmAnalysis = warm.state.analysis?.analysis;
    expect(coldAnalysis).toBeDefined();
    expect(warmAnalysis).toBeDefined();
    if (coldAnalysis === undefined || warmAnalysis === undefined) return;

    // The schedule's sprite index is keyed by number, which an object-shaped encoding would stringify.
    const coldKey = [...coldAnalysis.schedule.initBySprite.keys()][0];
    const warmKey = [...warmAnalysis.schedule.initBySprite.keys()][0];
    expect(typeof warmKey).toBe('number');
    expect(warmKey).toBe(coldKey);
    expect([...warmAnalysis.schedule.initBySprite.entries()]).toEqual([
      ...coldAnalysis.schedule.initBySprite.entries(),
    ]);

    // The recovered name table is a Map of Maps-of-strings; a lossy codec empties it silently.
    expect(warmAnalysis.names.names.size).toBeGreaterThan(0);
    expect([...warmAnalysis.names.names.entries()]).toEqual([...coldAnalysis.names.names.entries()]);
    expect(stableForm(warmAnalysis.names.classes)).toBe(stableForm(coldAnalysis.names.classes));

    // The nested function body survived: its IR is reachable from the frame script's block ops.
    const irs = warmAnalysis.blocks.map((block) => block.ir.id);
    expect(irs).toEqual(coldAnalysis.blocks.map((block) => block.ir.id));
    expect(stableForm(warmAnalysis.blocks)).toBe(stableForm(coldAnalysis.blocks));
  });

  it('re-runs cold when any part of the key moves: input, tool version, or a stage option', () => {
    const cold = build(dir);
    expect(statusOf(build(dir), 'analyze')).toBe('cached');

    // A different movie is a different input hash.
    expect(statusOf(build(dir, { bytes: richMovie() }), 'analyze')).toBe('cached'); // same bytes → same key
    const other = buildSwf({ body: concat(showFrames(1), endTag()), frameCount: 1 });
    expect(statusOf(build(dir, { bytes: other }), 'analyze')).toBe('ran');

    // A tool upgrade invalidates everything (CMP §12 puts toolVersion in the key).
    expect(statusOf(build(dir, { toolVersion: 'test-2' }), 'analyze')).toBe('ran');

    // A stage option is an input: `legacyEncoding` changes what the front end decodes.
    const stages: Stage[] = [
      readStage('game.swf'),
      modelStage(),
      analyzeStage({ legacyEncoding: 'shift-jis' }),
      consumerStage(),
    ];
    expect(statusOf(build(dir, { stages }), 'analyze')).toBe('ran');
    expect(statusOf(build(dir, { stages }), 'analyze')).toBe('cached');
    expect(cold.status).toBe('complete');
  });

  it('honours --no-cache: nothing is written and the stage always runs (CMP-R039)', () => {
    const result = build(dir, { switches: { noCache: true } });

    expect(statusOf(result, 'analyze')).toBe('ran');
    expect(result.stages.find((stage) => stage.id === 'analyze')?.cacheKey).toBeNull();
    expect(readdirSync(dir)).toEqual([]);
  });
});

describe('--verify-cache: a hit is provably equivalent (IMPL-120-R002)', () => {
  it('recomputes and reports a match on an honest cache', () => {
    build(dir);
    const verified = build(dir, { switches: { verifyCache: true } });
    const report = verified.stages.find((stage) => stage.id === 'analyze');

    expect(report?.status).toBe('ran'); // verification means running it again
    expect(report?.cacheVerified).toBe('match');
    expect(verified.diagnostics.items.filter((item) => item.code === Codes.CACHE_DRIFT)).toHaveLength(0);
  });

  it('catches a tampered payload, warns, evicts it, and keeps the recomputed output', () => {
    const cold = build(dir);
    const [name] = entryFiles(dir);
    const path = join(dir, name ?? '');
    const stored = JSON.parse(readFileSync(path, 'utf8')) as { payload: unknown };
    stored.payload = { v: 1, outcome: { state: { analysis: { tiers: { T0: 99, T1: 0, T2: 0 } } } } };
    writeFileSync(path, JSON.stringify(stored), 'utf8');

    const verified = build(dir, { switches: { verifyCache: true } });
    const report = verified.stages.find((stage) => stage.id === 'analyze');

    expect(report?.cacheVerified).toBe('drift');
    const drift = verified.diagnostics.items.filter((item) => item.code === Codes.CACHE_DRIFT);
    expect(drift).toHaveLength(1);
    expect(drift[0]?.severity).toBe('warning');
    expect(drift[0]?.message).toContain('analyze');
    // The cache never wins over the compiler: the run kept the recomputed analysis.
    expect(verified.state.analysis?.tiers).toEqual(cold.state.analysis?.tiers);
    expect(outputBytes(verified)).toEqual(outputBytes(cold));

    // The entry was replaced, so the next plain run is served correct bytes.
    const after = build(dir);
    expect(statusOf(after, 'analyze')).toBe('cached');
    expect(outputBytes(after)).toEqual(outputBytes(cold));
  });
});

describe('staleness and robustness (CMP-R038)', () => {
  function cacheAt(dir_: string): StageCache & { deleted: string[] } {
    const inner = fileStageCache({ dir: dir_ });
    const deleted: string[] = [];
    return {
      deleted,
      get: inner.get,
      put: inner.put,
      delete: (key) => {
        deleted.push(key);
        inner.delete(key);
      },
    };
  }

  it('evicts an entry whose effect set no longer matches the stage', () => {
    const cache = cacheAt(dir);
    const cold = runPipeline({
      input: richMovie(),
      inputName: 'game.swf',
      config: config(),
      toolVersion: 'test-1',
      stages: [readStage('game.swf'), modelStage(), analyzeStage()],
      cache,
    });
    expect(statusOf(cold, 'analyze')).toBe('ran');
    const key = cold.stages.find((stage) => stage.id === 'analyze')?.cacheKey ?? '';
    const stored = cache.get(key);
    expect(stored).not.toBeNull();
    if (stored === null) return;

    // A stage that starts writing a file keeps the same key, so the effect set is what detects the entry.
    cache.put(key, { ...stored, effects: { reads: [], writes: ['analysis.json'] } });
    expect(stalenessOf({ ...stored, effects: { reads: [], writes: ['analysis.json'] } }, stored)).toContain(
      'effect set',
    );
    expect(stalenessOf(stored, stored)).toBeNull();

    const warm = runPipeline({
      input: richMovie(),
      inputName: 'game.swf',
      config: config(),
      toolVersion: 'test-1',
      stages: [readStage('game.swf'), modelStage(), analyzeStage()],
      cache,
    });
    const report = warm.stages.find((stage) => stage.id === 'analyze');
    expect(report?.status).toBe('ran');
    expect(report?.cacheEvicted).toContain('effect set changed');
    expect(cache.deleted).toEqual([key]);
  });

  it('treats a corrupt entry as a miss and evicts it, without failing the build', () => {
    build(dir);
    const [name] = entryFiles(dir);
    writeFileSync(join(dir, name ?? ''), '{ this is not json', 'utf8');

    const result = build(dir);
    expect(result.status).toBe('complete');
    expect(statusOf(result, 'analyze')).toBe('ran');
    expect(entryFiles(dir)).toHaveLength(1); // rebuilt, not left corrupt
    expect(JSON.parse(readFileSync(join(dir, entryFiles(dir)[0] ?? ''), 'utf8')).$schemaVersion).toBe(
      CACHE_ENTRY_SCHEMA_VERSION,
    );
  });

  it('writes atomically and keys entries by content, leaving no temp files', () => {
    build(dir);
    expect(readdirSync(dir).filter((name) => name.includes('.tmp-'))).toEqual([]);
    expect(entryFiles(dir)).toHaveLength(1);
    expect(entryFiles(dir)[0]).toMatch(/^[0-9a-f]{64}\.json$/);
    // The same input twice is the same key, so the store does not grow.
    build(dir);
    expect(entryFiles(dir)).toHaveLength(1);
  });

  it('prunes entries from an older schema', () => {
    build(dir);
    const [name] = entryFiles(dir);
    const path = join(dir, name ?? '');
    const stored = JSON.parse(readFileSync(path, 'utf8')) as { $schemaVersion: number };
    stored.$schemaVersion = 99;
    writeFileSync(path, JSON.stringify(stored), 'utf8');

    expect(fileStageCache({ dir }).prune()).toBe(1);
    expect(entryFiles(dir)).toEqual([]);
    expect(statusOf(build(dir), 'analyze')).toBe('ran');
  });

  it('defaults to CMP §12’s directory, which the repository ignores', () => {
    expect(CACHE_DIRNAME).toBe('.forge/cache');
    const ignore = readFileSync(new URL('../../../.gitignore', import.meta.url), 'utf8');
    expect(ignore.split('\n').some((line) => line.trim() === '.forge/')).toBe(true);
  });
});

describe('the structural codec', () => {
  it('round-trips the three shapes JSON does not carry', () => {
    const value = {
      map: new Map<number, readonly string[]>([
        [7, ['a', 'b']],
        [3, []],
      ]),
      set: new Set(['z', 'a']),
      bytes: Uint8Array.from([0, 1, 254, 255]),
      nested: { list: [null, true, 1.5, { deep: new Map([['k', new Set([1])]]) }] },
      nulled: null,
    };
    const back = decode(encode(value)) as typeof value;

    expect(back.map).toBeInstanceOf(Map);
    expect([...back.map.entries()]).toEqual([
      [3, []],
      [7, ['a', 'b']],
    ]); // sorted by key on the way out
    expect(back.set).toBeInstanceOf(Set);
    expect([...back.set]).toEqual(['a', 'z']);
    expect(back.bytes).toBeInstanceOf(Uint8Array);
    expect([...back.bytes]).toEqual([0, 1, 254, 255]);
    const deep = (back.nested.list[3] as { deep: Map<string, Set<number>> }).deep;
    expect(deep).toBeInstanceOf(Map);
    expect([...(deep.get('k') ?? [])]).toEqual([1]);
    expect(back.nulled).toBeNull();
  });

  it('is order-independent, so two runs that build the same value write the same bytes', () => {
    const a = { alpha: 1, beta: { x: [1, 2], y: null } };
    const b = { beta: { y: null, x: [1, 2] }, alpha: 1 };
    expect(JSON.stringify(encode(a))).toBe(JSON.stringify(encode(b)));
    expect(stableForm(a)).toBe(stableForm(b));
    expect(
      stableForm(
        new Map([
          ['a', 1],
          ['b', 2],
        ]),
      ),
    ).toBe(
      stableForm(
        new Map([
          ['b', 2],
          ['a', 1],
        ]),
      ),
    );
  });

  it('keeps a Map key’s type, which an object-shaped encoding would not', () => {
    const back = decode(encode(new Map([[7, 'seven']]))) as Map<unknown, unknown>;
    expect([...back.keys()][0]).toBe(7);
    expect(typeof [...back.keys()][0]).toBe('number');
  });
});
