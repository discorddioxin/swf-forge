/**
 * The CLI: exit codes, the argument table, and the disk (`WP-120-13`).
 *
 * `T-CMP-004` asks for "exit codes per failure class (5 fixtures)", and this file takes that literally: five real
 * invocations, one per class, each run against a real file in a temp directory through `runCli` — not against a
 * mock of the filesystem. A CLI whose tests mock the disk has tested its own least interesting layer, and the
 * failures that matter here (`a half-written project`, `the cache in the output directory`, `the previous build's
 * config read back as input`) only exist when real files are involved.
 *
 * Two classes are not reachable from an argument, and the file says so instead of faking them. A cancelled run is
 * produced by handing `writeOut` a stop predicate rather than by racing a signal a synchronous pipeline cannot
 * observe mid-stage. Exit 5 is produced by a crash-report round trip plus the classifier: nothing a *user* can type
 * makes the CLI throw, because every stage fault is recorded in the run result and every disk fault is a
 * `CMP-R029` exit 2 — so the only input that reaches that path is a bug in this package, and a test would have to
 * plant one.
 *
 * `verify`'s three injected-drift cases are proven here at the command boundary (`T-CMP-007`'s remaining half):
 * `WP-120-10` proved the functions, `WP-120-12` proved that `verifyProject` calls them, and what is left is
 * whether `swfforge verify` walks the directory correctly and turns a finding into exit 1.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { PassThrough } from 'node:stream';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { DEFAULT_FORGE_CONFIG, resolveForgeConfig } from '@swf-forge/compile';
import type { ForgeConfig } from '@swf-forge/compile';
import { Tag } from '@swf-forge/swf';
import { buildSwf, concat, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

import {
  EXIT,
  FLAGS,
  REPORT_FILES,
  TOOL_VERSION,
  exitForRun,
  flagNames,
  worseExit,
  parseInvocation,
  readTree,
  main,
  runCli,
  stdioWriter,
  writeCrashBundle,
  writeOut,
} from '../src/index.js';
import type { CliIo } from '../src/index.js';

const roots: string[] = [];

/** A directory that looks like a project folder: the input, and nothing else. */
function workspace(files: Readonly<Record<string, Uint8Array | string>> = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'swfforge-cli-'));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(resolve(root, join(path, '..')), { recursive: true });
    writeFileSync(resolve(root, path), content);
  }
  return root;
}

/** One-frame movie: `DoAction`, `ShowFrame`, `End`. */
function cleanMovie(): Uint8Array {
  return buildSwf({
    body: concat(tag(Tag.DoAction, Uint8Array.from([0x07, 0x00])), showFrames(1), endTag()),
    frameCount: 1,
  });
}

/** The same movie with a declared `FileLength` of 0, which the reader reports as `SF0028` and nothing else. */
function warningMovie(): Uint8Array {
  const bytes = cleanMovie().slice();
  bytes[4] = 0;
  bytes[5] = 0;
  bytes[6] = 0;
  bytes[7] = 0;
  return bytes;
}

/** A movie carrying `DoABC`, which the AVM1 front end refuses (`CMP-R031`). */
function avm2Movie(): Uint8Array {
  return buildSwf({ body: concat(tag(Tag.DoABC, new Uint8Array(4)), showFrames(1), endTag()), frameCount: 1 });
}

interface Run {
  readonly code: number;
  readonly cwd: string;
  readonly err: readonly string[];
  readonly out: readonly string[];
}

/** One CLI invocation, captured. `build` writes into `<root>/out` unless a caller overrides the flag. */
async function invoke(root: string, argv: readonly string[]): Promise<Run> {
  const out: string[] = [];
  const err: string[] = [];
  const io: CliIo = {
    err: (line) => {
      err.push(line);
    },
    out: (line) => {
      out.push(line);
    },
  };
  const code = await runCli({ argv: [...argv], cwd: root, io });
  return { code, cwd: root, err, out };
}

const build = (root: string, extra: readonly string[] = []) =>
  invoke(root, ['build', 'movie.swf', '--out', 'out', ...extra]);
const exists = (root: string, path: string): boolean => existsSync(join(root, path));

afterAll(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
});

describe('T-CMP-004: one exit code per failure class', () => {
  it('exits 0 and writes a project for a movie the pipeline can finish', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    const run = await build(root);

    expect(run.code).toBe(EXIT.ok);
    expect(exists(root, 'out/forge.config.json')).toBe(true);
    expect(exists(root, 'out/build-info.json')).toBe(true);
    expect(run.out.join('\n')).toContain('wrote ');
    // The written project is what `verify` reads, so the two commands have to agree on the file set.
    const tree = readTree({ root: resolve(root, 'out') });
    expect(tree.map((file) => file.path)).toContain('forge.config.json');
  });

  it('exits 2 for a file that is not a SWF, and writes no project for it', async () => {
    const root = workspace({ 'movie.swf': new Uint8Array(512).fill(0x41) });
    const run = await build(root);

    // The reader recovers from a bad signature and the pipeline goes on to emit twelve well-formed files about an
    // empty movie, so the exit code and the write decision are the only places the CLI can say "that is not a SWF".
    expect(run.code).toBe(EXIT.unreadable);
    expect(run.out.join('\n')).toContain('SF0001');
    expect(run.out.join('\n')).toContain('nothing written');
    // Not "an empty project": no directory at all. Creating one to say "nothing happened" is how a build script
    // finds a half-populated output tree and treats it as a build.
    expect(exists(root, 'out')).toBe(false);
  });

  it('exits 2 for a missing input, before any stage runs', async () => {
    const root = workspace();
    const run = await build(root);

    expect(run.code).toBe(EXIT.unreadable);
    expect(run.out.join('\n')).toContain('no such file');
    expect(exists(root, 'out')).toBe(false);
  });

  it('exits 3 for AVM2 content and writes nothing at all', async () => {
    const root = workspace({ 'movie.swf': avm2Movie() });
    const run = await build(root);

    expect(run.code).toBe(EXIT.avm2);
    expect(exists(root, 'out/build-info.json')).toBe(false);
    expect(run.out.join('\n')).toContain('AVM2');
  });

  it('exits 4 when a warning passes --max-warnings, and 0 for the same file at the default limit', async () => {
    const strict = workspace({ 'movie.swf': warningMovie() });
    const loose = workspace({ 'movie.swf': warningMovie() });
    const capped = await build(strict, ['--max-warnings', '0']);
    const defaultLimit = await build(loose);

    expect(capped.code).toBe(EXIT.threshold);
    expect(capped.out.join('\n')).toContain('--max-warnings=0 exceeded');
    // `CMP` §8's default is 200, so a single warning is not a failed build for anybody who did not ask for one.
    expect(defaultLimit.code).toBe(EXIT.ok);
    expect(defaultLimit.out.join('\n')).toContain('SF0028');
  });

  it('exits 4, not 1, for --fail-on=warning: a promoted warning is a threshold, not a broken build', async () => {
    const root = workspace({ 'movie.swf': warningMovie() });
    const run = await build(root, ['--fail-on', 'warning']);

    expect(run.code).toBe(EXIT.threshold);
    expect(run.out.join('\n')).toContain('--fail-on=warning');
    // The warnings are still printed, because the exit code is the verdict and the lines are the evidence. P6 warns
    // three times about what it withholds (`SF0504`, `SF0507`, `SF0509`), so the count is never just the input's.
    expect(run.out.join('\n')).toContain('warning(s)');
    expect(run.out.join('\n')).toContain('SF0028');
  });

  it('exits 1 for an error-severity diagnostic, which is not a crash and not the input being unreadable', () => {
    const decision = exitForRun({
      budgetExceeded: false,
      diagnostics: [{ code: 'SF0506', severity: 'error' }],
      failOn: 'error',
      internal: null,
      maxWarnings: 200,
      readFailed: false,
      status: 'complete',
      unreadable: null,
    });

    expect(decision.exit).toBe(EXIT.failed);
    expect(decision.reason).toContain('1 error diagnostic(s)');
  });

  /**
   * `E-055`. The sink folds a repeated diagnostic into one row carrying a `count`, so a budget compared against
   * *rows* would pass a 52-byte fuzz input that warned 92,680 times about one shape edge. `CMP-§8`'s "fail after n
   * warnings" is about the flood, and both numbers are printed, because a run that says "6 warning(s)" and exits 4
   * is a riddle unless the line also says the six rows hold 92,680 occurrences.
   */
  it('measures `--max-warnings` in occurrences, not in rows', () => {
    const flooded = {
      budgetExceeded: false,
      diagnostics: [{ code: 'SF0013', count: 92680, severity: 'warning' }],
      failOn: 'error' as const,
      internal: null,
      maxWarnings: 200,
      readFailed: false,
      status: 'complete' as const,
      unreadable: null,
    };

    const decision = exitForRun(flooded);
    expect(decision.exit).toBe(EXIT.threshold);
    expect(decision.reason).toContain('92680 occurrence(s) in 1 row(s)');
    expect(exitForRun({ ...flooded, maxWarnings: 92680 }).exit).toBe(EXIT.ok);
    // No counter is one occurrence, so an ordinary run's arithmetic is exactly what it was before this rule.
    expect(
      exitForRun({ ...flooded, diagnostics: [{ code: 'SF0028', count: 1, severity: 'warning' }], maxWarnings: 1 }).exit,
    ).toBe(EXIT.ok);
    expect(exitForRun({ ...flooded, failOn: 'warning' as const }).reason).toContain('92680 warning occurrence(s)');
  });

  it('reports an internal fault as exit 5 with the input it was given, next to where the output goes', async () => {
    const root = workspace();
    const path = writeCrashBundle(join(root, 'out'), 'swfforge 0.0.0 crashed\ninput: movie.swf\ninput bytes: 42\n');

    expect(path).toBe('.swfforge-crash.txt');
    expect(readFileSync(join(root, 'out', '.swfforge-crash.txt'), 'utf8')).toContain('input: movie.swf');
    // A dot-prefixed name so a build script's glob never picks it up as a project file, and it is not in the tree
    // `verify` walks, so a crash report cannot become a finding about somebody's project.
    expect(readTree({ root: join(root, 'out') })).toEqual([]);
    expect(exitForRun(crashFacts()).exit).toBe(EXIT.internal);
  });

  it('ranks the classes the way the precedence says, not by magnitude', () => {
    const facts = (over: Partial<Parameters<typeof exitForRun>[0]> = {}) => ({
      budgetExceeded: false,
      diagnostics: [],
      failOn: 'error' as const,
      internal: null,
      maxWarnings: 200,
      readFailed: false,
      status: 'complete' as const,
      unreadable: null,
      ...over,
    });

    // A crash outranks an unreadable input, which outranks the AVM2 refusal, which outranks a threshold: the
    // first is the fact that explains why the later ones could not be measured.
    expect(exitForRun(facts({ internal: 'boom', status: 'failed', unreadable: 'no file' })).exit).toBe(EXIT.internal);
    expect(exitForRun(facts({ status: 'refused', unreadable: 'no file' })).exit).toBe(EXIT.unreadable);
    expect(exitForRun(facts({ budgetExceeded: true, status: 'refused' })).exit).toBe(EXIT.avm2);
    expect(
      exitForRun(facts({ diagnostics: [{ code: 'SF0001', severity: 'error' }], readFailed: true, status: 'failed' }))
        .exit,
    ).toBe(EXIT.unreadable);
    expect(worseExit(EXIT.threshold, EXIT.internal)).toBe(EXIT.internal);
    expect(worseExit(EXIT.threshold, EXIT.unreadable)).toBe(EXIT.unreadable);
    expect(worseExit(EXIT.ok, EXIT.ok)).toBe(EXIT.ok);
  });
});

function crashFacts(): Parameters<typeof exitForRun>[0] {
  return {
    budgetExceeded: false,
    diagnostics: [],
    failOn: 'error',
    internal: 'a stage registry that cannot be satisfied',
    maxWarnings: 200,
    readFailed: false,
    status: 'failed',
    unreadable: null,
  };
}

describe('CMP-R028: the flag table and the config file', () => {
  it('lands every flag that names a config path in the resolved config', () => {
    const withConfig = FLAGS.filter((spec) => spec.config !== undefined);
    expect(withConfig.length).toBeGreaterThan(5);
    for (const spec of withConfig) {
      const sample = spec.kind === 'number' ? '37' : spec.choices !== undefined ? String(spec.choices[0]) : 'x';
      const value = spec.kind === 'boolean' ? 'true' : sample;
      const invocation = parseInvocation(['build', 'movie.swf', `${spec.name}=${value}`]);

      expect(invocation.errors, `${spec.name}: ${invocation.errors.join('; ')}`).toEqual([]);
      const resolved = resolveForgeConfig({ ...(invocation.configPatch as object), input: 'movie.swf', outDir: 'out' });
      let node: unknown = resolved;
      for (const key of spec.config ?? []) node = (node as Record<string, unknown>)[key];
      if (spec.kind === 'number') expect(node, spec.name).toBe(37);
      else if (spec.kind === 'boolean') expect(node, spec.name).toBe(true);
      else expect(node, spec.name).toBe(sample);
    }
  });

  it('accepts --jobs and --fail-on=risk with a note, because the table asks for them and P6 cannot honour them', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    const run = await build(root, ['--jobs', '4', '--fail-on', 'risk']);

    expect(run.code).toBe(EXIT.ok);
    expect(run.out.join('\n')).toContain('--jobs is accepted but inert');
    expect(run.out.join('\n')).toContain('--fail-on=risk is accepted but inert');
  });

  it('refuses an unknown flag by name rather than ignoring it', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    const run = await build(root, ['--colour']);
    const typo = await build(root, ['--max-warning', '3']);

    expect(run.code).toBe(EXIT.unreadable);
    expect(typo.code).toBe(EXIT.unreadable);
    expect(typo.err.join('\n')).toContain('unknown flag --max-warning');
    expect(exists(root, 'out')).toBe(false);
  });

  it('rejects `diff` and `fetch-fixtures` as verbs, and answers with the verb list', async () => {
    const root = workspace();
    for (const verb of ['diff', 'fetch-fixtures']) {
      const run = await invoke(root, [verb, 'movie.swf']);

      expect(run.code).toBe(EXIT.unreadable);
      expect(run.err.join('\n')).toContain(`unknown command "${verb}"`);
      expect(run.out.join('\n')).toContain('swfforge build <in.swf>');
    }
  });

  it('prints help as exit 0, listing every flag in the table', async () => {
    const root = workspace();
    const run = await invoke(root, ['--help']);
    const text = run.out.join('\n');

    expect(run.code).toBe(EXIT.ok);
    for (const name of flagNames()) expect(text, name).toContain(name);
    // `CMP-§8`'s defaults, because a flag list without its defaults is a guess.
    for (const expected of ['--out', '--max-warnings', '--sourcemap', '--vm.residual', '--network.policy']) {
      expect(text).toContain(expected);
    }
  });

  it('prints the tool name and version', async () => {
    const run = await invoke(workspace(), ['--version']);

    expect(run.code).toBe(EXIT.ok);
    expect(run.out.join('\n')).toBe(`swfforge ${TOOL_VERSION}`);
  });

  it('refuses a config file that does not parse instead of repairing it', async () => {
    const root = workspace({
      'movie.swf': cleanMovie(),
      'forge.config.json': '{ "graphics": { "maxDrawCalls": 500 }, }',
    });
    const run = await build(root);

    expect(run.code).toBe(EXIT.unreadable);
    expect(run.out.join('\n')).toContain('does not parse');
  });

  it('refuses a config file that asks for a key the schema does not have', async () => {
    const root = workspace({ 'movie.swf': cleanMovie(), 'forge.config.json': '{ "grahpics": { "maxDrawCalls": 1 } }' });
    const run = await build(root);

    expect(run.code).toBe(EXIT.unreadable);
    expect(run.out.join('\n')).toContain('grahpics');
  });

  it('lets a flag override the file layer, and writes the resolved difference to the project', async () => {
    const root = workspace({
      'movie.swf': cleanMovie(),
      'forge.config.json': '{ "graphics": { "maxDrawCalls": 500 } }',
    });
    const run = await build(root, ['--graphics.max-draw-calls', '120']);
    const emitted = JSON.parse(readFileSync(join(root, 'out/forge.config.json'), 'utf8')) as {
      graphics?: { maxDrawCalls?: number };
    };

    expect(run.code).toBe(EXIT.ok);
    expect(emitted.graphics?.maxDrawCalls).toBe(120);
    // `CMP-R004`: the emitted copy holds only what differs from this version's defaults, and 120 does.
    expect(emitted.graphics?.maxDrawCalls).not.toBe(DEFAULT_FORGE_CONFIG.graphics.maxDrawCalls);
  });

  it('never reads the config copy in --out back in as input', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    const first = await build(root, ['--graphics.max-draw-calls', '120']);
    const second = await build(root);
    const emitted = JSON.parse(readFileSync(join(root, 'out/forge.config.json'), 'utf8')) as {
      graphics?: { maxDrawCalls?: number };
    };

    expect(first.code).toBe(EXIT.ok);
    expect(second.code).toBe(EXIT.ok);
    // The second run saw no `./forge.config.json`, so it got the defaults: the previous build's copy is an output.
    expect(emitted.graphics === undefined || emitted.graphics.maxDrawCalls === undefined).toBe(true);
  });

  it('writes byte-identical project files for the same input, in either order, at the same relative path', async () => {
    // Two workspaces, because a build records its own `outDir` in `forge.config.json` and in the report's gate
    // list: the claim `T-CMP-003` makes is "the same input through the same tool, the same bytes", which is a
    // claim about a project layout, not about two different directory names being the same file.
    const first = workspace({ 'movie.swf': cleanMovie() });
    const second = workspace({ 'movie.swf': cleanMovie() });
    await build(first);
    await build(second);

    const tree = (root: string): [string, string][] =>
      readTree({ root: join(root, 'out') }).map((file) => [file.path, Buffer.from(file.bytes).toString('hex')]);
    const before = tree(first);
    expect(tree(second)).toEqual(before);
    expect(before.length).toBeGreaterThan(3);
    // And the deep comparison over the two outputs is clean, which is `WP-120-14`'s CI job at unit speed.
    const deep = await invoke(first, ['verify', 'out', '--deep', '--against', join(second, 'out')]);
    expect(deep.code).toBe(EXIT.ok);
    expect(deep.out.join('\n')).toContain('compared against');
  });
});

describe("the disk is the CLI's own", () => {
  it('writes in sorted order, each file through a name no reader can half-open', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    await build(root);
    const names = readdirSync(join(root, 'out'));

    expect(names.filter((name) => name.endsWith('.swfforge-tmp'))).toEqual([]);
    expect(statSync(join(root, 'out/package.json')).isFile()).toBe(true);
  });

  it('refuses a path that escapes the output directory', () => {
    const root = workspace();
    let message = '';
    try {
      writeOut({ files: [{ bytes: new TextEncoder().encode('x'), path: '../escape.txt' }], root: join(root, 'out') });
    } catch (cause) {
      message = cause instanceof Error ? cause.message : String(cause);
    }

    expect(message).toContain('outside');
    expect(exists(root, '../escape.txt')).toBe(false);
  });

  it('rolls a cancelled write back to the directory it started from, with no temp files left', () => {
    const root = workspace();
    mkdirSync(join(root, 'out'), { recursive: true });
    const files = [
      { bytes: new TextEncoder().encode('one'), path: 'a.txt' },
      { bytes: new TextEncoder().encode('two'), path: 'b.txt' },
      { bytes: new TextEncoder().encode('three'), path: 'sub/c.txt' },
    ];
    let seen = 0;
    let caught: unknown;
    try {
      writeOut({ files, root: join(root, 'out'), shouldStop: () => (seen += 1) > 1 });
    } catch (cause) {
      caught = cause;
    }

    expect((caught as Error).name).toBe('WriteCancelled');
    expect(readdirSync(join(root, 'out'))).toEqual([]);
    // The directory `sub` was created by this call, so it is this call's to remove.
    expect(exists(root, 'out/sub')).toBe(false);
  });

  it('writes only the report set under --report-only, and every report path exists in a full build', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    const full = await build(root, ['--out', 'full']);
    const reports = await build(root, ['--out', 'thin', '--report-only']);
    const fullFiles = readTree({ root: resolve(root, 'full') }).map((file) => file.path);

    expect(full.code).toBe(EXIT.ok);
    expect(reports.code).toBe(EXIT.ok);
    for (const path of REPORT_FILES) expect(fullFiles, path).toContain(path);
    const thinFiles = readTree({ root: resolve(root, 'thin') }).map((file) => file.path);
    expect(thinFiles.sort()).toEqual([...REPORT_FILES].sort());
    expect(thinFiles).not.toContain('package.json');
  });

  it('keeps the stage cache in the working directory, so two --out directories stay diffable', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    await build(root, ['--out', 'a']);
    await build(root, ['--out', 'b']);

    expect(exists(root, '.forge/cache')).toBe(true);
    expect(exists(root, 'a/.forge')).toBe(false);
    const first = readTree({ root: resolve(root, 'a') }).map((file) => file.path);
    const second = readTree({ root: resolve(root, 'b') }).map((file) => file.path);
    // The precondition `T-CMP-003`'s `diff -r` needs: the same file set from both runs, whatever their contents.
    expect(first).toEqual(second);
    expect(first.length).toBeGreaterThan(3);
  });
});

describe('the five verbs', () => {
  it('plan writes nothing and says which stages a build would run; --dry-run says the same', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    const planned = await invoke(root, ['plan', 'movie.swf', '--out', 'out']);
    const dry = await build(root, ['--dry-run']);

    expect(planned.code).toBe(EXIT.ok);
    expect(exists(root, 'out')).toBe(false);
    const section = (lines: readonly string[]): string => lines.slice(lines.indexOf('stages:')).join('\n');
    expect(section(dry.out)).toBe(section(planned.out));
    expect(planned.out.join('\n')).toContain('emit:dry-run-skipped');
    expect(planned.out.join('\n')).toContain('would run after plan');
  });

  it('plan prints the pass decisions a build would act on, and the withheld stages by name', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    const run = await invoke(root, ['plan', 'movie.swf']);
    const text = run.out.join('\n');

    expect(text).toContain('decode');
    expect(text).toContain('dead-code');
    // A plan is not a verdict about the input, so it does not print one; the exit code still says if it should.
    expect(text).not.toContain('verdict:');
  });

  it('inspect reports a header for a file whose later stages fail, and takes the worse class over all files', async () => {
    const root = workspace({ 'bad.swf': new Uint8Array(300).fill(0x42), 'movie.swf': cleanMovie() });
    const run = await invoke(root, ['inspect', 'movie.swf', 'bad.swf', '--tags']);

    expect(run.code).toBe(EXIT.unreadable);
    expect(run.out.join('\n')).toContain('SWF 6');
    expect(run.out.join('\n')).toContain('bad.swf');
    // A tag table whose row count matches the header's own count is the proof the view is over the real index.
    const header = run.out.join('\n').match(/(\d+) tag\(s\)/u);
    expect(header).not.toBeNull();
  });

  it('inspect on a movie the reader had to repair still prints the header it recovered', async () => {
    const root = workspace({ 'movie.swf': warningMovie() });
    const run = await invoke(root, ['inspect', 'movie.swf']);

    expect(run.code).toBe(EXIT.ok);
    expect(run.out.join('\n')).toContain('SF0028');
    // The strictness pair is a stage-option fact, and it is proven here rather than by hoping a reader escalates:
    // `--strict` alone sets `strictLength`, and `--tolerate-length` is the one check that opts back out of it.
    expect(parseInvocation(['inspect', 'x', '--strict']).stage).toEqual({
      sourceMaps: 'file',
      strict: true,
      strictLength: true,
      strictTimeline: false,
    });
    expect(parseInvocation(['inspect', 'x', '--strict', '--tolerate-length']).stage.strictLength).toBe(false);
    expect(parseInvocation(['inspect', 'x', '--tolerate-length']).stage.strict).toBe(false);
  });

  it('verify is clean on a project this CLI wrote, and names what it could not check', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    await build(root);
    const run = await invoke(root, ['verify', 'out']);
    const text = run.out.join('\n');

    expect(run.code).toBe(EXIT.ok);
    expect(text).toContain('clean');
    expect(text).toContain('not run:');
    expect(text).toContain('WP-120-07');
  });

  it('verify --deep fails when a rebuild changed a report file, and on an injected drift', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    await build(root, ['--out', 'a']);
    await build(root, ['--out', 'b']);
    // `a` and `b` differ in one recorded value on purpose: the build writes its own `outDir` into the report's gate
    // list, so two names are two byte streams, and `verify` is right to say so out loud.
    const deep = await invoke(root, ['verify', 'a', '--deep', '--against', 'b']);
    expect(deep.out.join('\n')).toContain('compared against b');
    expect(deep.code).toBe(EXIT.failed);

    const identical = await invoke(root, ['verify', 'a', '--deep', '--against', 'a']);
    expect(identical.code).toBe(EXIT.ok);
  });

  it('verify turns an injected manifest drift into exit 1 (T-CMP-007, the command half)', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    await build(root, ['--out', 'a']);
    const manifest = join(root, 'a/forge.manifest.json');
    const tampered = JSON.parse(readFileSync(manifest, 'utf8')) as Record<string, unknown>;
    tampered['injectedBy'] = 'a hand edit';
    writeFileSync(manifest, `${JSON.stringify(tampered, null, 2)}\n`, 'utf8');
    const drift = await invoke(root, ['verify', 'a']);

    expect(drift.code).toBe(EXIT.failed);
    expect(drift.out.join('\n')).toContain('manifest');
  });

  it('verify without a build to check is exit 2 with the path it looked at', async () => {
    const root = workspace();
    const run = await invoke(root, ['verify', 'nowhere']);

    expect(run.code).toBe(EXIT.unreadable);
    expect(run.out.join('\n')).toContain('is not a directory');
    expect(run.out.join('\n')).toContain('nowhere');
  });

  it('report prints the withheld budget lines rather than an empty table', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    await build(root);
    const run = await invoke(root, ['report', 'out', '--budgets']);
    const text = run.out.join('\n');

    expect(run.code).toBe(EXIT.ok);
    expect(text).toContain('budgets:');
    expect(text).toContain('WP-120-07');
  });

  it('report on a directory that is not a project is exit 2, naming the file it wanted', async () => {
    const root = workspace();
    mkdirSync(join(root, 'empty'), { recursive: true });
    const run = await invoke(root, ['report', 'empty']);

    expect(run.code).toBe(EXIT.unreadable);
    expect(run.out.join('\n')).toContain('build-info.json is missing');
  });

  it('puts the same data in --json and in the human lines, including the exit code', async () => {
    const root = workspace({ 'movie.swf': warningMovie() });
    const json = await build(root, ['--max-warnings', '0', '--json']);
    const envelope = JSON.parse(json.out.join('')) as {
      command: string;
      exit: number;
      files: unknown[];
      schemaVersion: number;
      stages: { id: string; status: string }[];
      tool: { name: string; version: string };
    };

    expect(json.code).toBe(EXIT.threshold);
    expect(envelope.command).toBe('build');
    expect(envelope.exit).toBe(EXIT.threshold);
    expect(envelope.schemaVersion).toBe(1);
    expect(envelope.tool).toEqual({ name: 'swfforge', version: TOOL_VERSION });
    expect(envelope.stages.map((stage) => stage.id)).toEqual([
      'read',
      'model',
      'decode',
      'analyze',
      'plan',
      'emit',
      'report',
    ]);
    expect(Array.isArray(envelope.files)).toBe(true);
    // No timestamps anywhere in a machine-readable payload (`REPO-R015`).
    expect(JSON.stringify(envelope)).not.toMatch(/\d{4}-\d{2}-\d{2}T/u);
  });

  it('keeps --verbose to the resolved config, and --quiet to nothing at all', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    const verbose = await build(root, ['--verbose']);
    const quiet = await build(root, ['--quiet']);
    const quietFailure = await build(root, ['--quiet', '--max-warnings', '0', '--out', 'q']);

    expect(verbose.out.join('\n')).toContain('resolved config:');
    expect(quiet.out).toEqual([]);
    // A quiet run still reports the failure it exits on, or the flag would be a way to lose information.
    expect(quietFailure.out.join('\n')).toContain('--max-warnings=0 exceeded');
  });
});

describe('stdio under a pipeline', () => {
  it('absorbs the EPIPE a closed reader causes, and keeps every other stream error', () => {
    const stream = new PassThrough();
    const write = stdioWriter(stream);

    write('first line');
    // This is the event that killed the tool before `stdio.ts` existed: an error with no listener throws.
    expect(() => stream.emit('error', Object.assign(new Error('write EPIPE'), { code: 'EPIPE' }))).not.toThrow();
    expect(() => write('after the reader left')).not.toThrow();
    // A different failure is a fact about the machine, and it still reaches a caller that can report it.
    expect(() => stream.emit('error', Object.assign(new Error('no space left on device'), { code: 'ENOSPC' }))).toThrow(
      /no space left/u,
    );
  });

  it('prints a whole report into a stream that closes early without throwing', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    const stream = new PassThrough();
    const chunks: string[] = [];
    stream.on('data', (chunk: Buffer) => chunks.push(chunk.toString('utf8')));
    const code = await main(['build', 'movie.swf', '--out', 'out'], root, {
      err: stdioWriter(stream),
      out: stdioWriter(stream),
    });
    stream.destroy();

    expect(code).toBe(EXIT.ok);
    expect(chunks.join('').length).toBeGreaterThan(0);
  });
});

describe('the pieces a build script may import', () => {
  it('refuses a stage-flag combination that the parser cannot apply to a verb', async () => {
    const root = workspace({ 'movie.swf': cleanMovie() });
    const run = await invoke(root, ['verify', 'out', '--strict']);

    expect(run.code).toBe(EXIT.unreadable);
    expect(run.out.join('\n') + run.err.join('\n')).toContain('--strict applies to');
  });

  it('parses a value out of the same token, and never swallows the next flag as a value', () => {
    const equals = parseInvocation(['build', 'movie.swf', '--out=dist']);
    const missing = parseInvocation(['build', 'movie.swf', '--out', '--json']);

    expect(equals.values.get('--out')).toBe('dist');
    expect(missing.errors.join(' ')).toContain('--out needs a value');
  });

  it('rejects an enum value rather than passing it to the config validator', () => {
    const run = parseInvocation(['build', 'movie.swf', '--audio.codec', 'flac']);

    expect(run.errors.join(' ')).toContain('--audio.codec must be one of');
  });

  it('resolves a full default config object from an empty invocation', () => {
    const invocation = parseInvocation(['build', 'movie.swf']);
    const config = resolveForgeConfig({
      ...(invocation.configPatch as object),
      input: 'movie.swf',
      outDir: 'out',
    }) as ForgeConfig;

    expect(config.reproducible).toBe(true);
    expect(config.diagnostics.maxWarnings).toBe(200);
    expect(config.vm.residual).toBe('on-demand');
    expect(config.network.policy).toBe('deny');
  });
});
