/**
 * The report stage's contract (`WP-120-11`, `IMPL-120` §4's root artifacts, `CMP` §4.9).
 *
 * `T-CMP-016` is the obligation this package most needs: these files are the only build outputs whose content is a
 * *summary* of other stages, which is exactly the kind of file that silently starts reading a live sink and then
 * differs between a cold and a warm build. `T-CMP-017` covers `IMPL-120-R021`'s MUST NOT list, which until now
 * was a sentence nobody could violate without noticing.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { DiagnosticSink, Tag, codeInfo } from '@swf-forge/swf';
import {
  actionBlock,
  buildSwf,
  concat,
  defineSprite,
  defineTag,
  endTag,
  placeObject2,
  showFrames,
  tag,
} from '@swf-forge/swf/test-support';

import {
  BUILD_INFO_SCHEMA_URL,
  BUDGETS_WITHHELD,
  DIVERGENCE_SCHEMA_URL,
  PORTING_NOTES_SCHEMA_URL,
  REPORT_INPUT_NAMES,
  analyzeStage,
  buildReport,
  bytesByModuleGroup,
  checkDivergenceCompleteness,
  configHash,
  divergenceCitations,
  divergenceEntry,
  emitStage,
  fileStageCache,
  findHostLeaks,
  framesPass,
  gatesOf,
  modelStage,
  namesPass,
  readStage,
  reportDecisions,
  reportDiagnostics,
  reportStage,
  resolveForgeConfig,
  runPipeline,
} from '../src/index.js';
import type {
  ChapterPin,
  StageCache,
  DivergenceDeclaration,
  ForgeConfig,
  JsonObject,
  PipelineState,
  RunSwitches,
  VerifyItem,
} from '../src/index.js';
import type { EmittedFile } from '../src/index.js';

const STOP = 0x07;
const END = 0x00;
const TRACE = 0x26;
const GET_VARIABLE = 0x1c;
function doAction(records: readonly number[]): Uint8Array {
  return tag(Tag.DoAction, Uint8Array.from(actionBlock(records)));
}

function movieBytes(records: readonly number[]): Uint8Array {
  return buildSwf({
    version: 8,
    frameCount: 1,
    body: concat(
      defineTag(Tag.DefineShape, 10),
      defineSprite(11, 1, concat(placeObject2(10, 1), showFrames(1), endTag())),
      doAction([...records]),
      showFrames(1),
      endTag(),
    ),
  });
}

/** The lines that differ, so a determinism failure names a field instead of two long strings. */
function delta(left: string, right: string): readonly string[] {
  const before = left.split('\n');
  const after = right.split('\n');
  const size = Math.max(before.length, after.length);
  const out: string[] = [];
  for (let index = 0; index < size; index += 1) {
    if (before[index] !== after[index])
      out.push(`${index}: ${before[index] ?? '(missing)'} => ${after[index] ?? '(missing)'}`);
  }
  return out;
}

const CONFIG: ForgeConfig = resolveForgeConfig({ input: 'game.swf', outDir: 'out' });
const SWITCHES: RunSwitches = {
  dryRun: false,
  noCache: false,
  verifyCache: false,
  pruneDeadCode: false,
  budgetStrict: false,
  deep: false,
};

/** A state with the shape of a finished run but no emitter artifact, for the pure writers. */
function stateOf(extra: Partial<PipelineState> = {}): PipelineState {
  return {
    model: {
      readInterruptions: [
        { characterId: 10, code: 'SF0023' },
        { characterId: 12, code: 'SF0124' },
      ],
    },
    passes: [
      { id: 'names', decisions: [{ subject: 'symbol:10', action: 'named', reason: 'export name "hero"' }] },
      {
        id: 'dead-code',
        decisions: [{ subject: 'block:7', action: 'kept', reason: 'the front end marks it reachable' }],
      },
    ],
    ...extra,
  } as unknown as PipelineState;
}

function textOf(files: readonly EmittedFile[], path: string): string {
  const file = files.find((entry) => entry.path === path);
  if (file === undefined) throw new Error(`no ${path} was written`);
  return new TextDecoder().decode(file.bytes);
}

function jsonOf(files: readonly EmittedFile[], path: string): JsonObject {
  return JSON.parse(textOf(files, path)) as JsonObject;
}

function report(state: PipelineState = stateOf(), options = {}, config = CONFIG): ReturnType<typeof buildReport> {
  return buildReport({
    state,
    config,
    switches: SWITCHES,
    toolVersion: 'test-1',
    inputName: 'game.swf',
    sha256: 'ab'.repeat(32),
    inputBytes: 4096,
    options,
  });
}

/** Runs the spine with the report stage registered, so the diagnostics and the effects are the real ones. */
function run(options: {
  readonly records?: readonly number[];
  readonly config?: Partial<ForgeConfig>;
  readonly report?: Parameters<typeof reportStage>[0];
  readonly cache?: StageCache;
  readonly sink?: DiagnosticSink;
}) {
  const bytes = movieBytes(options.records ?? [GET_VARIABLE, TRACE, STOP, END]);
  const config = resolveForgeConfig({ input: 'game.swf', outDir: 'out', ...options.config });
  const sink = options.sink ?? new DiagnosticSink();
  const result = runPipeline({
    input: bytes,
    inputName: 'game.swf',
    config,
    toolVersion: 'test-1',
    stages: [readStage('game.swf'), modelStage(), analyzeStage(), emitStage(), reportStage(options.report ?? {})],
    passes: [namesPass(), framesPass()],
    diagnostics: sink,
    ...(options.cache === undefined ? {} : { cache: options.cache }),
  });
  return { result, sink };
}

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'swf-forge-report-'));
  dirs.push(dir);
  return dir;
}

afterEach(() => {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
});

describe('T-CMP-016 — the report files are deterministic, cache-invariant, and complete by construction', () => {
  it('writes one strict-JSON artifact per §4 entry plus the markdown projection, at the paths §4 names', () => {
    const built = report();
    expect(built.files.map((file) => file.path).sort()).toEqual([
      'build-info.json',
      'divergence.json',
      'porting-notes.json',
      'reports/porting-notes.md',
    ]);
    const files = built.files;
    for (const [path, url] of [
      ['build-info.json', BUILD_INFO_SCHEMA_URL],
      ['porting-notes.json', PORTING_NOTES_SCHEMA_URL],
      ['divergence.json', DIVERGENCE_SCHEMA_URL],
    ] as const) {
      const parsed = jsonOf(files, path);
      expect(parsed['$schema']).toBe(url);
      expect(parsed['schemaVersion']).toBe(1);
    }
    // The `.md` is a projection, so it carries the HTML comment rather than a `//` header a markdown reader shows.
    expect(textOf(files, 'reports/porting-notes.md').startsWith('<!--')).toBe(true);
  });

  it('sorts keys at every depth, so no report byte depends on which object literal wrote it', () => {
    const built = report();
    const text = textOf(built.files, 'build-info.json');
    const keys = text
      .split('\n')
      .filter((line) => /^ {2}"/u.test(line))
      .map((line) => line.trim().slice(1, line.indexOf('":')));
    expect(keys).toEqual([...keys].sort());
    // A permutation of the same data is byte-identical, which is what `T-CMP-003`'s `diff -r` needs to be about
    // the movie rather than about the order a register table was read in.
    const pins: ChapterPin[] = [
      { doc: '120', openItems: 0, state: 'done' },
      { doc: '050', openItems: 4, state: 'partial' },
    ];
    const flipped = report(stateOf(), { pins: [...pins].reverse() });
    expect(textOf(flipped.files, 'build-info.json')).toBe(textOf(report(stateOf(), { pins }).files, 'build-info.json'));
  });

  it('reads its rows from stage artifacts, so a warm build prints the same file as a cold one', () => {
    const dir = tempDir();
    const cache = fileStageCache({ dir: join(dir, '.forge/cache') });
    const cold = run({ cache });
    expect(cold.result.stages.find((stage) => stage.id === 'analyze')?.status).toBe('ran');
    const warm = run({ cache });
    expect(warm.result.stages.find((stage) => stage.id === 'analyze')?.status).toBe('cached');
    for (const path of ['build-info.json', 'porting-notes.json', 'divergence.json', 'reports/porting-notes.md']) {
      const before = textOf(cold.result.files, path);
      const after = textOf(warm.result.files, path);
      expect(delta(before, after), `${path} differs on a warm build`).toEqual([]);
    }
    // The rule under the equality: the report never consults the live sink. A diagnostic that was already in the
    // sink when the stage ran — which is what a cached stage's un-replayed rows look like — stays out of the file,
    // because the file has to mean the same thing on both paths (`CMP-R040`).
    const polluted = new DiagnosticSink();
    // `info`, not `error`: an error already in the sink when the run starts is a different story, because the
    // model stage attributes *any* error-severity diagnostic whose offset falls in a character's span, which is how
    // a container-level fact at offset 0 can reach a dictionary entry's row. `E-051` asks the sink to record which
    // stage spoke; until then this test proves only what the report owns.
    // `SF0500`, an info-severity code the registry agrees is info — a callsite may not claim a severity the
    // registry denies.
    polluted.emit({ code: 'SF0500', context: 'compile', message: 'not a build result', offset: 0, severity: 'info' });
    const withExtra = run({ sink: polluted });
    expect(
      delta(textOf(cold.result.files, 'porting-notes.json'), textOf(withExtra.result.files, 'porting-notes.json')),
    ).toEqual([]);
    // The row the caller put in the sink is still there, and the run's own rows joined it — the report simply
    // never looked, which is the whole point: `ctx.diagnostics` is a terminal concern, not an artifact.
    expect(polluted.list().find((entry) => entry.message === 'not a build result')).toBeDefined();
    expect(polluted.list().length).toBeGreaterThan(1);
    // The asymmetry the rule exists for, stated as data: `analyze` ran cold and was a hit warm, so its own error
    // row is in one sink and not the other. A report reading `ctx.diagnostics` would print two different files for
    // one movie; this one prints the same file, and `SF0406` stays in the terminal where it belongs.
    expect(cold.sink.list().some((entry) => entry.code === 'SF0406')).toBe(true);
    expect(warm.sink.list().some((entry) => entry.code === 'SF0406')).toBe(false);
  });

  it('lists every gate the config and the switches can carry, so a new key cannot skip the report', () => {
    const gates = gatesOf(CONFIG, SWITCHES);
    const paths: string[] = [];
    const walk = (node: unknown, prefix: string): void => {
      if (node === null || typeof node !== 'object') {
        paths.push(prefix);
        return;
      }
      if (Array.isArray(node)) {
        // A list is a leaf to `scalarLeaves`, which joins it into one string, so the walk ends here too.
        paths.push(prefix);
        return;
      }
      for (const key of Object.keys(node).sort()) {
        const child = (node as JsonObject)[key];
        // The report skips an absent optional key rather than stating it, so the walk has to as well or the
        // completeness assertion below is a test of `resolveForgeConfig`'s defaults instead of of the gate list.
        if (child === undefined) continue;
        walk(child, `${prefix}.${key}`);
      }
    };
    walk(CONFIG, 'config');
    walk(SWITCHES, 'switches');
    expect(paths.length).toBeGreaterThan(12);
    for (const path of paths) {
      const leaf = path
        .split('.')
        .slice(1)
        .reduce<unknown>(
          (node, key) => (node as JsonObject)[key],
          path.startsWith('switches') ? (SWITCHES as unknown as JsonObject) : (CONFIG as unknown as JsonObject),
        );
      const stated = Array.isArray(leaf) ? leaf.map((item) => String(item)).join(',') : leaf;
      expect(gates[path], `${path} should be stated`).toBe(stated);
    }
    // Without an emit artifact the gate list is exactly the config and the switches; the two source-map rows
    // are the emit stage's echo, so they arrive only when there is a stage to have run.
    expect(Object.keys(gates).sort()).toEqual([...paths].sort());
    const withEmit = gatesOf(CONFIG, SWITCHES, {
      sourceMapRequested: 'inline',
      sourceMapWritten: true,
    } as unknown as Parameters<typeof gatesOf>[2]);
    expect(Object.keys(withEmit).sort()).toEqual([...paths, 'emit.sourcemapRequested', 'emit.sourcemapWritten'].sort());
    expect(withEmit['emit.sourcemapRequested']).toBe('inline');
  });

  it('states the source-map pair the emit stage echoed, because CMP-R014 asks for a file this phase refuses', () => {
    const { result } = run({});
    const built = jsonOf(result.files, 'build-info.json');
    const gates = built['gates'] as JsonObject;
    expect(gates['emit.sourcemapRequested']).toBe('file');
    expect(gates['emit.sourcemapWritten']).toBe(false);
    // The report says it, and `SF0504` says why: the same fact in a file and in a terminal, from one source.
    expect(result.diagnostics.items.some((entry) => entry.code === 'SF0504')).toBe(true);
  });

  it('groups emitted bytes by module group without pretending to be a budget', () => {
    const files = [
      { path: 'src/frames/movie.ts', text: 'aaa' },
      { path: 'src/frames/sprite_11.ts', text: 'bb' },
      { path: 'src/symbols.ts', text: 'c' },
      { path: 'tsconfig.json', text: '{}' },
    ];
    // A file directly under a directory groups under that directory: the group is what a bundler splits on, so
    // `src/symbols.ts` and `src/manifest.ts` belong in one bucket rather than each in a bucket of one.
    expect(bytesByModuleGroup(files)).toEqual({ src: 1, 'src/frames': 5, 'tsconfig.json': 2 });
    const { result } = run({});
    const built = jsonOf(result.files, 'build-info.json');
    const output = built['output'] as JsonObject;
    const groups = output['moduleGroupBytes'] as JsonObject;
    // The report's own bytes are not part of what it counts, so the sum is the emit stage's total exactly.
    const total = Object.values(groups).reduce<number>(
      (sum, value) => sum + (typeof value === 'number' ? value : 0),
      0,
    );
    expect(total).toBe(output['bytes']);
    const budgets = built['budgetSummary'] as JsonObject;
    expect(budgets['withheld']).toEqual([...BUDGETS_WITHHELD].sort());
    expect(budgets['residualBytecodeBytes']).toBe(result.state.emit?.residualBytes);
  });
});

describe('T-CMP-017 — IMPL-120-R021 keeps host identity out of a hashed artifact, and the build checks it', () => {
  it('names an absolute path, a clock, and the host name, and leaves a hash and a byte count alone', () => {
    expect(findHostLeaks({ p: '/home/runner/work/swf-forge/game.swf' })).toEqual([
      '$.p looks like an absolute path on the build host',
    ]);
    expect(findHostLeaks({ p: 'C:\\Users\\me\\game.swf' })[0]).toContain('absolute path');
    expect(findHostLeaks({ p: 'built 2026-10-15T09:12:00Z' })[0]).toContain('wall-clock timestamp');
    expect(findHostLeaks({ n: 1_700_000_000 })[0]).toContain('epoch timestamp');
    expect(findHostLeaks({ n: 1_700_000_000_123 })[0]).toContain('epoch timestamp');
    expect(findHostLeaks({ who: 'build-box-7' }, 'build-box-7')[0]).toContain("host's name");
    // What the reports legitimately carry: hex digests, small counts, and a big one that is not clock-shaped.
    expect(findHostLeaks({ sha: 'ab'.repeat(32), frames: 240, bytes: 105_283, negative: -0 })).toEqual([]);
    expect(findHostLeaks({ nested: [{ ok: 'assets/tex/ab12cd34.ktx2' }] })).toEqual([]);
  });

  it('refuses the whole report rather than shipping the files that happened to be clean', () => {
    // A leak is a defect in what the build tried to say, and the three files are read together: two of three is
    // what a porter mistakes for "the build had nothing to report".
    const leaked = report(stateOf(), { hostName: 'swf-forge' });
    expect(leaked.files).toEqual([]);
    expect(leaked.leak).toContain('contains the build');
    const pathLeak = report(stateOf(), { pins: [{ doc: '/home/me/120', state: 'done' }] });
    expect(pathLeak.files).toEqual([]);
    expect(pathLeak.leak).toContain('absolute path');
    const { result } = run({ report: { hostName: 'swf-forge' } });
    const error = result.diagnostics.items.find((entry) => entry.code === 'SF0511');
    expect(error?.severity).toBe('error');
    expect(error?.message).toContain('no report file was written');
    expect(result.files.filter((file) => file.path.includes('porting-notes'))).toEqual([]);
    expect(result.state.report?.refused).toBe(true);
    expect(result.status).toBe('complete');
  });

  it('carries no clock at all: two builds a run apart are the same bytes', () => {
    const first = textOf(report(stateOf()).files, 'build-info.json');
    const second = textOf(report(stateOf()).files, 'build-info.json');
    expect(second).toBe(first);
    expect(first).not.toMatch(/\d{4}-\d{2}-\d{2}/u);
    expect(first).not.toContain(tmpdir());
  });
});

describe('what the report may not claim', () => {
  it('withholds an input it was not given, and says so with SF0509 naming each one', () => {
    const built = report();
    expect(built.withheldInputs).toEqual([...REPORT_INPUT_NAMES]);
    expect(textOf(built.files, 'build-info.json')).toContain('"state": "withheld"');
    const notes = built.portingNotes['tier'] as JsonObject;
    expect(notes['reason']).toContain('ARCH-R003');
    expect((built.portingNotes['verifyItems'] as JsonObject)['total']).toBeUndefined();
    const { result } = run({});
    const warning = result.diagnostics.items.find((entry) => entry.code === 'SF0509');
    expect(warning?.severity).toBe('warning');
    for (const name of REPORT_INPUT_NAMES) expect(warning?.message).toContain(name);
    // Supplied inputs stop the warning, because the file now says something.
    const quiet = run({
      report: {
        divergences: [],
        pins: [{ doc: '120', state: 'done' }],
        tier: { tier: 'C1' },
        verifyItems: [],
      },
    });
    expect(quiet.result.diagnostics.items.some((entry) => entry.code === 'SF0509')).toBe(false);
    // An explicitly empty list is a claim, and it is carried as one rather than as a gap.
    const divergence = jsonOf(quiet.result.files, 'divergence.json');
    expect(divergence['entries']).toEqual([]);
    expect((divergence['declarations'] as JsonObject)['total']).toBe(0);
  });

  it('names the manifest sections it withheld, so the report and the manifest tell one story', () => {
    const { result } = run({});
    const built = jsonOf(result.files, 'build-info.json');
    const manifest = built['output'] as JsonObject;
    const section = manifest['manifest'] as JsonObject;
    expect(section['artifacts']).toBe(2);
    expect(section['withheldSections']).toEqual(result.state.emit?.plan.manifest?.withheld ?? []);
    expect((section['withheldSections'] as string[]).length).toBeGreaterThan(0);
    expect(result.state.report?.manifestWithheld).toEqual(section['withheldSections']);
  });

  it('rebuilds each row from the code registry, so the file says the same thing a cache hit cannot erase', () => {
    const rows = reportDiagnostics(stateOf());
    expect(rows.map((row) => row['code'])).toEqual(['SF0023', 'SF0124']);
    for (const row of rows) {
      const info = codeInfo(String(row['code']));
      expect(row['message']).toBe(info?.meaning);
      expect(row['severity']).toBe(info?.severity);
    }
    const decisions = reportDecisions(stateOf());
    expect(decisions.map((row) => `${String(row['source'])}:${String(row['subject'])}`)).toEqual([
      'dead-code:block:7',
      'names:symbol:10',
    ]);
    expect(reportDiagnostics({})).toEqual([]);
    expect(reportDecisions({})).toEqual([]);
  });

  it('hashes the two stages that produced what it prints, not the whole pipeline', () => {
    const built = jsonOf(report().files, 'build-info.json');
    expect(built['configHashes']).toEqual({
      emit: configHash(CONFIG, 'emit'),
      report: configHash(CONFIG, 'report'),
    });
  });

  it('refuses a divergence declaration that does not fit CMP-§4.9, and carries the ones that do', () => {
    const good: DivergenceDeclaration = {
      decision: 'GFX-D04',
      fidelity: 'F3',
      scope: { id: 42, kind: 'character', name: 'heroIdle' },
      summary: 'Gaussian blur approximated by 3 box passes; σ=blurX/2',
      measured: { metric: 'ssim', threshold: 0.99, value: 0.997 },
    };
    const good_out = divergenceEntry(good);
    expect('entry' in good_out && good_out.entry['decision']).toBe('GFX-D04');
    expect('error' in good_out).toBe(false);
    for (const bad of [
      { ...good, decision: 'blur' },
      { ...good, decision: 'GFX-D4' },
      { ...good, fidelity: 'F5' as 'F4' },
      { ...good, summary: '  ' },
      { ...good, scope: { kind: ' ' } },
      { ...good, measured: { metric: 'ssim', threshold: Number.NaN, value: 1 } },
    ]) {
      const out = divergenceEntry(bad);
      expect('error' in out, JSON.stringify(bad)).toBe(true);
    }
    const { result } = run({
      report: { divergences: [good, { ...good, actionRequired: true, decision: 'AVM1-D07', fidelity: 'F4' }] },
    });
    const file = jsonOf(result.files, 'divergence.json');
    expect((file['entries'] as readonly JsonObject[]).map((entry) => entry['decision'])).toEqual([
      'AVM1-D07',
      'GFX-D04',
    ]);
    expect(result.diagnostics.items.some((entry) => entry.code === 'SF0510')).toBe(false);

    const broken = run({ report: { divergences: [{ ...good, decision: 'made-up' }] } });
    const errors = broken.result.diagnostics.items.filter((entry) => entry.code === 'SF0510');
    expect(errors).toHaveLength(1);
    expect(errors[0]?.severity).toBe('error');
    expect(broken.result.state.report?.invalidDivergences[0]?.error).toContain('decision-register id');
    // The harness is not told to forgive a divergence it cannot check, so the file still carries the valid entry.
    expect(jsonOf(broken.result.files, 'divergence.json')['entries'] as readonly unknown[]).toEqual([]);
  });

  it('reports a cited decision id with no declaration, and a declared id nothing cites', () => {
    const cited = divergenceCitations([
      { path: 'src/frames/movie.ts', text: '  // GFX-D04 approximates the blur\n  go();\n' },
      { path: 'src/symbols.ts', text: 'export const NAME = "AVM1-D07";\n' },
      { path: 'src/classes/Hero.ts', text: '/**\n * AVM1-D12 keeps the slot order.\n */\n' },
    ]);
    // Only comments are citations: a string constant that looks like an id is the movie's data, not a claim.
    expect(cited).toEqual(['AVM1-D12', 'GFX-D04']);
    expect(checkDivergenceCompleteness([{ decision: 'GFX-D04' }], cited)).toEqual({
      undeclared: ['AVM1-D12'],
      unreferenced: [],
    });
    expect(checkDivergenceCompleteness([{ decision: 'CMP-D01' }], cited).unreferenced).toEqual(['CMP-D01']);
    const { result } = run({ report: { divergences: [] } });
    expect(jsonOf(result.files, 'divergence.json')['undeclaredCitations']).toEqual([]);
    // The emitter cites no decision ids in emitted source today, so a build with nothing declared is complete:
    // the check is what makes the day that stops being true a report row rather than a silent divergence.
    expect(divergenceCitations(result.state.emit?.plan.files ?? [])).toEqual([]);
  });

  it('renders the markdown from the same object, so the human file cannot contradict the machine file', () => {
    const { result } = run({
      report: {
        pins: [{ doc: '120', openItems: 0, state: 'done' }],
        tier: { backing: ['T-CMP-003'], tier: 'C1' },
        verifyItems: [{ id: 'AVM1-R021', source: '050 §11', summary: 'GotoFrame base' } satisfies VerifyItem],
      },
    });
    const notes = jsonOf(result.files, 'porting-notes.json');
    const markdown = textOf(result.files, 'reports/porting-notes.md');
    expect(markdown).toContain('Claimed **C1**');
    expect(markdown).toContain('`T-CMP-003`');
    expect(markdown).toContain('- `AVM1-R021` (050 §11): GotoFrame base');
    for (const row of notes['diagnostics'] as readonly JsonObject[]) {
      expect(markdown).toContain(String(row['code']));
    }
    const gates = notes['gates'] as JsonObject;
    for (const key of Object.keys(gates).sort()) expect(markdown).toContain(`| \`${key}\``);
    expect(markdown.split('\n').filter((line) => line.startsWith('| ')).length).toBeGreaterThan(4);
    // The gate row count matches the object exactly, which is what makes the table a projection and not a summary.
    expect(markdown.split('\n').filter((line) => /^\| `[a-z]/u.test(line))).toHaveLength(Object.keys(gates).length);
  });

  it('writes nothing before its own inputs exist, and reports the stage as the runner would without it', () => {
    const dir = tempDir();
    writeFileSync(join(dir, 'keep'), '');
    const without = runPipeline({
      input: movieBytes([STOP, END]),
      inputName: 'game.swf',
      config: CONFIG,
      toolVersion: 'test-1',
      stages: [readStage('game.swf'), modelStage(), analyzeStage()],
      diagnostics: new DiagnosticSink(),
    });
    expect(without.stages.find((stage) => stage.id === 'report')?.status).toBe('unregistered');
    expect(without.files.some((file) => file.path === 'build-info.json')).toBe(false);
  });
});
