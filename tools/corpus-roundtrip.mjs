#!/usr/bin/env node

/**
 * Corpus round-trip lane (P6 / `IMPL-120` §10 criteria 2, 3 and 4, roadmap §4.6, `registers/corpus.md`).
 *
 * `pnpm test` proves the pipeline is deterministic on the movies its own tests hand it. This lane proves it on the
 * corpus the repository owes — every committed `.swf`, the fuzz crasher corpus, and (with `--with-open`) the
 * licensed C4-c movies — and it proves the thing §10.2 says a CLI has to survive: a failing input must fail, not
 * crash. Every input therefore goes through the whole surface, in this order:
 *
 *   plan     the dry run, in a workspace nothing has been written into  → must write nothing at all
 *   inspect  every display flag                                          → must not crash on a broken movie
 *   cold     build in a fresh workspace (empty stage cache)              → writes out/
 *   warm     the same build again in the same workspace                  → same bytes, and cached stages
 *   fresh    the same build in a second workspace (empty cache)          → same bytes as the cold build
 *   verify   the emitted tree, then again with `--deep --against`        → clean, and zero determinism diffs
 *
 * Cold-versus-warm is §10.3's "cache warm/cold equivalence"; cold-versus-fresh is `T-CMP-003`'s "different cache
 * state, cwd, and environment", done as two real directory trees instead of a `diff -r` nobody runs.
 *
 * The lane calls `runCli` in one process rather than spawning a CLI per input (which is what
 * `tools/open-corpus.mjs` does for the AVM1 tier report) on purpose: a crash inside a build is what this lane is
 * looking for, and a wrapper that swallowed it into an exit code and kept going would hide the one finding that
 * matters. Exit 5 anywhere fails the lane, as does emitted-byte drift between runs that must agree.
 *
 * Usage (after `corepack pnpm build`):
 *   node tools/corpus-roundtrip.mjs run [--out FILE] [--limit N] [--with-open]
 *   node tools/corpus-roundtrip.mjs check [--with-open]   # re-run, then fail on drift or a broken invariant
 *
 * `run` writes the artifact; `check` compares bytes against it, so a gate that reads the evidence cannot quietly be
 * reading a description of a different world than the code now produces. The committed default artifact is the
 * C1 one: a CI job with no corpus cache must reproduce it exactly, so C4-c is written to a second file that only a
 * hand run with `--with-open` rewrites.
 */

import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const cliEntry = path.join(repoRoot, 'packages/cli/dist/index.js');
const committedReport = path.join(repoRoot, 'audits/P6-CORPUS-ROUNDTRIP.json');
const openReport = path.join(repoRoot, 'audits/P6-C4-ROUNDTRIP.json');
const manifestPath = path.join(repoRoot, 'fixtures/open/manifest.json');
const GENERATED_LINE = /^ {2}"generated": "[^"]*",\n/m;

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** Every `.swf` under a directory, sorted, with dot-directories skipped the way the CLI's own walk skips them. */
function moviesIn(dir) {
  if (!existsSync(dir)) return [];
  const found = [];
  const walk = (current) => {
    for (const name of readdirSync(current).sort()) {
      if (name.startsWith('.')) continue;
      const next = path.join(current, name);
      if (statSync(next).isDirectory()) walk(next);
      else if (name.endsWith('.swf')) found.push(next);
    }
  };
  walk(dir);
  return found;
}

/** Class C1: the committed conformance fixtures plus the fuzz crasher corpus (`registers/corpus.md` §1). */
function classC1() {
  const fixtures = moviesIn(path.join(repoRoot, 'fixtures')).map((file) => ({
    file,
    klass: 'C1',
    name: path.relative(repoRoot, file).split(path.sep).join('/'),
  }));
  const crashers = moviesIn(path.join(repoRoot, 'packages/swf/test/fuzz/corpus')).map((file) => ({
    file,
    klass: 'C1-fuzz',
    name: `packages/swf/test/fuzz/corpus/${path.basename(file)}`,
  }));
  return [...fixtures, ...crashers];
}

/** Class C4-c: the licensed external movies, and only when the cache holds every one of them at its pinned hash. */
function classC4() {
  if (!existsSync(manifestPath)) return { files: [], missing: ['manifest'] };
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const files = [];
  const missing = [];
  for (const source of manifest.sources) {
    for (const entry of source.entries) {
      const file = path.join(repoRoot, manifest.cacheDir, source.id, entry.name + path.extname(entry.path));
      if (!existsSync(file)) missing.push(entry.name);
      else if (sha256(readFileSync(file)) !== entry.sha256) missing.push(`${entry.name} (hash)`);
      else files.push({ file, klass: 'C4-c', name: `${source.id}/${entry.name}.swf` });
    }
  }
  return { files, missing };
}

/** A tree as `{path, sha256}` rows — the same view `verify` takes, so drift here is drift there. */
function treeOf(root) {
  const rows = [];
  const walk = (current, prefix) => {
    for (const name of readdirSync(current).sort()) {
      if (name.startsWith('.')) continue;
      const next = path.join(current, name);
      const rel = prefix === '' ? name : `${prefix}/${name}`;
      if (statSync(next).isDirectory()) walk(next, rel);
      else rows.push({ bytes: statSync(next).size, path: rel, sha256: sha256(readFileSync(next)) });
    }
  };
  walk(root, '');
  return rows;
}

function compareTrees(left, right) {
  const byPath = new Map(right.map((row) => [row.path, row.sha256]));
  const differing = left.filter((row) => byPath.get(row.path) !== row.sha256).map((row) => row.path);
  if (left.length !== right.length) differing.push(`<file count ${left.length} vs ${right.length}>`);
  return { differing: [...new Set(differing)].sort(), identical: differing.length === 0 };
}

/** One workspace: the input as `input.swf`, and nothing else — no config, no cache, no previous output. */
function workspace(inputFile) {
  const root = mkdtempSync(path.join(tmpdir(), 'swfforge-lane-'));
  writeFileSync(path.join(root, 'input.swf'), readFileSync(inputFile));
  return root;
}

async function invoke(runCli, cwd, argv) {
  const out = [];
  const err = [];
  const io = {
    err: (line) => err.push(line),
    out: (line) => out.push(line),
  };
  const exit = await runCli({ argv: [...argv, '--json'], cwd, io });
  let payload = null;
  try {
    payload = JSON.parse(out.join(''));
  } catch {
    payload = null;
  }
  return { argv, err: err.join('\n'), exit, payload };
}

const tally = (rows) => {
  const counts = {};
  for (const row of rows ?? []) counts[row.status] = (counts[row.status] ?? 0) + 1;
  return counts;
};

/**
 * What one run decided, in the shape the artifact promises. `payload === null` is recorded as `json: false` rather
 * than skipped: `IMPL-120-R025` makes the machine form part of the contract, so a run that exited without
 * parseable output on stdout is a lane finding.
 *
 * The two re-runs are recorded with the same shape as the cold one on purpose. A warm build's map is often
 * *smaller* than the cold one's — a cached stage does not replay the sink's rows (`CMP-R040`, and `E-051` asks the
 * pipeline to move diagnostics onto the artifacts so a report can stop depending on this) — and an artifact that
 * showed one run's diagnostics and not the other's would turn that documented asymmetry into a mystery a reader has
 * to know in advance. What proves the runs equivalent is the byte comparison over the trees they wrote, which is
 * the stronger statement and is made right next to it.
 */
function facts(run) {
  const body = run.payload;
  if (body === null) return { exit: run.exit, json: false };
  const diagnostics = body.diagnostics ?? {};
  const skipped = new Set(body.skipped ?? []);
  const written = (body.files ?? []).filter((row) => !skipped.has(row.path));
  const codes = {};
  for (const item of diagnostics.items ?? []) {
    codes[item.code] = (codes[item.code] ?? 0) + (item.count ?? 1);
  }
  return {
    diagnosticCodes: Object.fromEntries(Object.entries(codes).sort(([a], [b]) => (a < b ? -1 : 1))),
    diagnostics: {
      errors: diagnostics.errors ?? 0,
      infos: diagnostics.infos ?? 0,
      total: diagnostics.total ?? 0,
      warnings: diagnostics.warnings ?? 0,
    },
    exit: run.exit,
    json: true,
    passes: (body.passes ?? []).length,
    stages: tally(body.stages),
    status: body.status ?? 'unknown',
    written: { bytes: written.reduce((sum, row) => sum + (row.bytes ?? 0), 0), files: written.length },
  };
}

/** `verify`'s answer, reduced to what a gate reads: was the project clean, and how much did it have to say. */
function verdict(run) {
  if (run === null) return null;
  const body = run.payload;
  if (body === null) return { exit: run.exit, json: false };
  return {
    checks: (body.checks ?? []).length,
    clean: body.clean === true,
    exit: run.exit,
    findings: (body.findings ?? []).length,
    json: true,
    notRun: (body.notRun ?? []).length,
    scannedBytes: body.scannedBytes ?? 0,
  };
}

/**
 * Do the two report files tell the same story, and does that story stay inside the three namespaces `gatesOf`
 * writes? `IMPL-120` §10.5's "every gate and its state" is only worth claiming if the gate list is one object
 * rendered twice rather than two lists that can drift apart.
 */
function reportTruth(root) {
  try {
    const info = JSON.parse(readFileSync(path.join(root, 'build-info.json'), 'utf8'));
    const notes = JSON.parse(readFileSync(path.join(root, 'porting-notes.json'), 'utf8'));
    const gates = info.gates ?? {};
    const names = Object.keys(gates);
    return {
      agree: JSON.stringify(notes.gates ?? null) === JSON.stringify(gates),
      gates: names.length,
      unowned: names
        .filter((gate) => !/^(config|switches|emit)\./u.test(gate))
        .sort(),
    };
  } catch {
    return null;
  }
}

async function roundTrip(runCli, input) {
  const bytes = readFileSync(input.file);
  const first = workspace(input.file);
  const second = workspace(input.file);
  const firstOut = path.join(first, 'out');
  const kept = path.join(first, 'cold-copy');
  try {
    const plan = await invoke(runCli, first, ['plan', 'input.swf', '--out', 'out']);
    const planWrote = existsSync(firstOut);
    const inspect = await invoke(runCli, first, [
      'inspect',
      'input.swf',
      '--actions',
      '--symbols',
      '--tags',
      '--timeline',
    ]);

    const cold = await invoke(runCli, first, ['build', 'input.swf', '--out', 'out']);
    const wroteProject = existsSync(path.join(firstOut, 'build-info.json'));
    if (wroteProject) cpSync(firstOut, kept, { recursive: true });

    const warm = await invoke(runCli, first, ['build', 'input.swf', '--out', 'out']);
    const fresh = await invoke(runCli, second, ['build', 'input.swf', '--out', 'out']);
    const warmWasWritten = existsSync(path.join(firstOut, 'build-info.json'));

    // Warm/cold is a byte comparison of the two runs in this workspace; cold/fresh is the second workspace's tree,
    // and `verify --deep --against` is the same comparison through the tool's own checker, so the CLI is proved by
    // its own verdict and not only by a hash this script printed.
    const warmCold = wroteProject && warmWasWritten ? compareTrees(treeOf(kept), treeOf(firstOut)) : null;
    const freshVs = wroteProject ? compareTrees(treeOf(kept), treeOf(path.join(second, 'out'))) : null;
    const verify = warmWasWritten ? await invoke(runCli, first, ['verify', 'out']) : null;
    const deep =
      warmWasWritten && existsSync(path.join(second, 'out', 'build-info.json'))
        ? await invoke(runCli, first, ['verify', 'out', '--deep', '--against', path.join(second, 'out')])
        : null;

    const reports = wroteProject ? reportTruth(firstOut) : null;
    const runs = [plan, inspect, cold, warm, fresh, verify, deep];
    return {
      bytes: bytes.length,
      class: input.klass,
      crashes: runs.filter((run) => run !== null && run.exit === 5).map((run) => run.argv.join(' ')),
      deep: deep === null ? null : verdict(deep),
      fresh: facts(fresh),
      inspect: { exit: inspect.exit, json: inspect.payload !== null },
      name: input.name,
      plan: { exit: plan.exit, json: plan.payload !== null, wroteProject: planWrote },
      reports,
      sha256: sha256(bytes),
      stderrNoise: runs.filter((run) => run !== null && run.err.trim() !== '').map((run) => run.argv[0]),
      verify: verify === null ? null : verdict(verify),
      warmCold: warmCold === null ? null : warmCold,
      coldVsFresh: freshVs === null ? null : freshVs,
      warm: facts(warm),
      cold: facts(cold),
    };
  } finally {
    for (const root of [first, second]) rmSync(root, { force: true, recursive: true });
  }
}

function merge(target, source) {
  for (const [key, value] of Object.entries(source ?? {})) target[key] = (target[key] ?? 0) + value;
}

function summarise(rows) {
  const summary = {
    classes: {},
    diagnosticCodes: {},
    diagnostics: { errors: 0, infos: 0, total: 0, warnings: 0 },
    exits: {},
    files: rows.length,
    noProject: 0,
    projects: 0,
    stages: {},
    reportGates: 0,
    reportsAgree: 0,
    verify: { clean: 0, findings: 0, notRun: 0 },
    warmColdIdentical: 0,
    writtenBytes: 0,
    writtenFiles: 0,
  };
  for (const row of rows) {
    summary.classes[row.class] = (summary.classes[row.class] ?? 0) + 1;
    summary.exits[row.cold.exit] = (summary.exits[row.cold.exit] ?? 0) + 1;
    merge(summary.diagnostics, row.cold.diagnostics);
    merge(summary.diagnosticCodes, row.cold.diagnosticCodes);
    merge(summary.stages, row.cold.stages);
    if (row.cold.written === undefined) continue;
    summary.writtenFiles += row.cold.written.files;
    summary.writtenBytes += row.cold.written.bytes;
    if (row.cold.written.files === 0) {
      summary.noProject += 1;
      continue;
    }
    summary.projects += 1;
    if (row.verify?.clean === true) summary.verify.clean += 1;
    summary.verify.findings += row.verify?.findings ?? 0;
    summary.verify.notRun += row.verify?.notRun ?? 0;
    if (row.warmCold?.identical === true && row.coldVsFresh?.identical === true) summary.warmColdIdentical += 1;
    if (row.reports !== null) {
      summary.reportGates += row.reports.gates;
      if (row.reports.agree) summary.reportsAgree += 1;
    }
  }
  return summary;
}

/** The lane's verdict. Every list here is a defect in the tool, never in the input. */
function integrity(rows) {
  const list = (pick) =>
    rows
      .filter(pick)
      .map((row) => row.name)
      .sort();
  return {
    crashes: list((row) => row.crashes.length > 0),
    jsonMissing: list((row) => Object.values([row.cold, row.warm, row.fresh]).some((run) => run.json === false)),
    noDeterminism: list((row) => row.cold.written?.files > 0 && (row.warmCold?.identical !== true || row.coldVsFresh?.identical !== true)),
    nonSilentVerify: list((row) => row.cold.written?.files > 0 && row.cold.diagnostics?.errors === 0 && (row.verify?.findings ?? 0) > 0),
    reportsDisagree: list((row) => row.reports !== null && (row.reports.agree !== true || row.reports.unowned.length > 0)),
    planWrote: list((row) => row.plan.wroteProject === true),
    stderrNoise: list((row) => row.stderrNoise.length > 0),
    unverifiedProject: list((row) => row.cold.written?.files > 0 && row.cold.diagnostics?.errors === 0 && row.verify?.clean !== true),
  };
}

function buildReport(rows, scope) {
  return {
    buildCommand: 'corepack pnpm build',
    command: 'node tools/corpus-roundtrip.mjs run',
    corpusClasses:
      'C1 = every committed .swf plus the fuzz crashers; C1-fuzz = the crasher corpus; C4-c = the licensed external movies (--with-open only). C3, the reference title, is OPEN in registers/corpus.md §2, so §10.1 is not measurable by this lane.',
    exitCodePolicy:
      'CMP-R029: 0 ok, 1 error-severity diagnostics, 2 unreadable or bad usage, 3 AVM2 (SF1000), 4 threshold, 5 internal bug. An input may legitimately exit 1, 2 or 3; only 5 fails this lane, with drift between runs that must agree and an unclean verify on a project that reported no errors.',
    files: rows,
    generated: new Date().toISOString().slice(0, 10),
    integrity: integrity(rows),
    protocol:
      'plan, inspect, a cold build in a fresh workspace, the same build again on a warm cache, the same build in a second workspace, then verify and verify --deep --against on what the first workspace wrote',
    schemaVersion: 1,
    syntheticSet:
      'C2 is the movies the fixture writers build in-process, and `IMPL-120` §10.3 counts them in "the whole corpus". They are ' +
      'round-tripped by the test lane — `packages/cli/test/cli.test.ts` (its four builders) and `packages/compile/test/verify.test.ts` ' +
      '(a sprite-and-action movie, emitted and verified) — not by this script, because the writers live in `test/support/` and no built ' +
      'module exports them. `registers/corpus.md` open item 4 (C2 is not enumerated as an artifact) is the register\'s to close.',
    summary: summarise(rows),
    ...scope,
  };
}

const text = (report) => `${JSON.stringify(report, null, 2)}\n`;

async function main() {
  const [command = 'run', ...rest] = process.argv.slice(2);
  if (command !== 'run' && command !== 'check') {
    console.error('usage: node tools/corpus-roundtrip.mjs <run|check> [--out FILE] [--limit N] [--with-open]');
    process.exit(1);
  }
  if (!existsSync(cliEntry)) {
    console.error('refusing to run unbuilt: corepack pnpm build first');
    process.exit(1);
  }
  const outIndex = rest.indexOf('--out');
  const limitIndex = rest.indexOf('--limit');
  const withOpen = rest.includes('--with-open');
  const outPath =
    outIndex >= 0
      ? path.resolve(repoRoot, rest[outIndex + 1])
      : withOpen
        ? openReport
        : committedReport;

  const inputs = classC1();
  let uncached = 0;
  if (withOpen) {
    const open = classC4();
    uncached = open.missing.length;
    if (open.files.length === 0 && uncached > 0) {
      console.error(`refusing to report on a partial corpus: ${uncached} C4 file(s) not in the cache (pnpm corpus:fetch)`);
      process.exit(1);
    }
    inputs.push(...open.files);
  }
  const bounded = limitIndex >= 0 ? inputs.slice(0, Number(rest[limitIndex + 1])) : inputs;
  if (bounded.length === 0) {
    console.error('no inputs found — this lane does not measure an empty corpus');
    process.exit(1);
  }

  const { runCli } = await import(pathToFileURL(cliEntry).href);
  const rows = [];
  for (const input of bounded) {
    rows.push(await roundTrip(runCli, input));
    process.stdout.write('.');
  }
  process.stdout.write('\n');

  // The scope block is part of the artifact, so `check` has to rebuild it exactly as `run` wrote it — otherwise
  // the gate compares the report against a document missing two keys and reports drift that is not drift.
  const scope = {
    corpusScope: bounded.reduce((counts, input) => {
      counts[input.klass] = (counts[input.klass] ?? 0) + 1;
      return counts;
    }, {}),
    openCorpus: withOpen
      ? { included: true, uncached }
      : { included: false, reason: 'run with --with-open after pnpm corpus:fetch' },
  };
  const report = buildReport(rows, scope);

  const failures = Object.entries(integrity(rows)).filter(([, names]) => names.length > 0);
  if (command === 'check') {
    if (!existsSync(outPath)) {
      console.error(`no committed artifact at ${path.relative(repoRoot, outPath)} to check against`);
      process.exit(1);
    }
    const strip = (value) => value.replace(GENERATED_LINE, '');
    if (strip(readFileSync(outPath, 'utf8')) !== strip(text(report))) {
      failures.push(['reportDrift', [path.relative(repoRoot, outPath)]]);
    }
  } else {
    writeFileSync(outPath, text(report));
  }

  const summary = summarise(rows);
  console.log(
    `${summary.files} file(s) [${Object.entries(summary.classes).map(([klass, count]) => `${klass}=${count}`).join(' ')}]: ` +
      `${summary.projects} project(s) written (${summary.writtenFiles} file(s), ${summary.writtenBytes} bytes), ` +
      `${summary.noProject} wrote nothing, verify clean ${summary.verify.clean}/${summary.projects}, ` +
      `runs byte-identical ${summary.warmColdIdentical}/${summary.projects}, ` +
      `report files agreeing ${summary.reportsAgree}/${summary.projects} (${summary.reportGates} gate rows), ` +
      `verify findings ${summary.verify.findings}, exits ${JSON.stringify(summary.exits)} → ${path.relative(repoRoot, outPath)}`,
  );
  for (const [name, names] of failures) console.error(`FATAL ${name}: ${names.join(', ')}`);
  if (failures.length > 0) process.exitCode = 1;
}

await main();
