/**
 * The corpus round trip: every committed `.swf` in this repository, built, re-built, and verified (T-CMP-003,
 * T-CMP-005, `IMPL-120` §10 criteria 2 and 3).
 *
 * The unit tests in `cli.test.ts` hand the CLI movies this file writes. That is the right way to pin one behavior
 * and the wrong way to answer "does a build of anything at all round-trip": a synthetic one-frame movie cannot
 * exercise a sprite timeline, a truncated record, an inflated zlib stream or a `PlaceObject` at a depth nobody uses.
 * So this file runs the whole surface over class C1 of
 * [`registers/corpus.md`](../../../docs/impl/registers/corpus.md) — every `.swf` under `fixtures/` and every
 * crasher in the fuzz corpus — through the sequence
 *
 *   plan → inspect → cold build → warm build → build in a second workspace → verify → verify --deep
 *
 * and asserts four properties on each. **No input may crash**: exit 5 is the tool's own failure, and §10.2's whole
 * point is that a failing input fails rather than throws. **`plan` writes nothing**, into the same directory
 * `build` was told to write into. **Three runs of one input agree byte-for-byte** — `R022`'s claim and
 * `T-CMP-005`'s, stated as data rather than as a `diff -r` somebody might run. And **a project that was written at
 * all verifies silent**: zero findings, not zero errors, because `E-054` closed the warnings a clean build used to
 * carry and a check that warns on every emitted project is a check that gets switched off.
 *
 * What this file deliberately does not do is reach for the corpus it cannot have. Class C3 — the reference title —
 * is OPEN in that register, and C4's licensed movies live in a cache CI does not have, so the bound here is exactly
 * C1 and no claim is made past it. The wider sweep, including C4-c when the cache is present and hash-matched, is
 * `node tools/corpus-roundtrip.mjs`, which writes `audits/P6-CORPUS-ROUNDTRIP.json`.
 */

import { createHash } from 'node:crypto';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';

import { EXIT, runCli } from '../src/index.js';
import type { CliIo } from '../src/index.js';

const REPO = resolve(fileURLToPath(new URL('../../../fixtures/', import.meta.url)), '..');
const FIXTURES = join(REPO, 'fixtures');
const CRASHERS = join(REPO, 'packages/swf/test/fuzz/corpus');

/** Every `.swf` under a directory, sorted, so the run order is a property of the repo rather than of the filesystem. */
function moviesIn(dir: string): string[] {
  const found: string[] = [];
  const walk = (current: string): void => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (entry.name.startsWith('.')) continue;
      const next = join(current, entry.name);
      if (entry.isDirectory()) walk(next);
      else if (entry.name.endsWith('.swf')) found.push(next);
    }
  };
  if (existsSync(dir)) walk(dir);
  return found;
}

const MOVIES: readonly { readonly file: string; readonly name: string }[] = [
  ...moviesIn(FIXTURES),
  ...moviesIn(CRASHERS),
].map((file) => ({ file, name: file.slice(REPO.length + 1) }));

/** The envelope fields this lane reads. `IMPL-120-R025` is the contract; the rest of the payload is not our concern. */
interface Envelope {
  readonly clean?: boolean;
  readonly config?: Record<string, unknown>;
  readonly diagnostics?: { readonly errors: number };
  readonly findings?: readonly { readonly check: string }[];
  readonly files?: readonly { readonly bytes: number; readonly path: string }[];
  readonly skipped?: readonly string[];
  readonly stages?: readonly { readonly status: string }[];
}

interface Run {
  readonly body: Envelope;
  readonly code: number;
  readonly err: readonly string[];
}

const roots: string[] = [];

/** A workspace holding nothing but `input.swf`, copied in so the CLI's own path handling is what is measured. */
function workspace(source: string): string {
  const root = mkdtempSync(join(tmpdir(), 'swfforge-corpus-'));
  roots.push(root);
  writeFileSync(join(root, 'input.swf'), readFileSync(source));
  return root;
}

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
  const code = await runCli({ argv: [...argv, '--json'], cwd: root, io });
  const body = out.length === 0 ? {} : (JSON.parse(out.join('')) as Envelope);
  return { body, code, err };
}

/** The tree a run left behind, as `path → sha256`, with the CLI's own dot-file rule so a crash report is not content. */
function fingerprint(root: string): Record<string, string> {
  const rows: Record<string, string> = {};
  const walk = (dir: string, prefix: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (entry.name.startsWith('.')) continue;
      const absolute = join(dir, entry.name);
      const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) walk(absolute, path);
      else rows[path] = createHash('sha256').update(readFileSync(absolute)).digest('hex');
    }
  };
  if (existsSync(root) && statSync(root).isDirectory()) walk(root, '');
  return rows;
}

/** How many of the files the run produced actually reached the disk. */
function writtenCount(body: Envelope): number {
  return projected(body).length;
}

/** The paths the run reported, minus the ones it withheld (`--report-only` and an unclean run both withhold). */
function projected(body: Envelope): string[] {
  const skipped = new Set(body.skipped ?? []);
  return (body.files ?? []).map((file) => file.path).filter((path) => !skipped.has(path));
}

/** The gate map's own rendering of a value, so the comparison is between like things. */
function stated(value: unknown): unknown {
  return Array.isArray(value) ? value.map((item) => String(item)).join(',') : value;
}

/** Resolve `config.audio.codec` against the config object the CLI printed, one segment at a time. */
function lookedUp(source: Record<string, unknown>, dotted: string): unknown {
  let current: unknown = source;
  for (const part of dotted.split('.').slice(1)) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

afterAll(() => {
  for (const root of roots) rmSync(root, { force: true, recursive: true });
});

describe('T-CMP-003: the committed corpus round-trips through the CLI', () => {
  it.each(MOVIES)('$name', async ({ file, name }) => {
    const first = workspace(file);
    const second = workspace(file);
    const out = join(first, 'out');

    // The read-only verbs run first, into a directory nothing has created yet: a `plan` that wrote its own report
    // would pass a check made afterwards and still fail §10's "writes nothing".
    const planned = await invoke(first, ['plan', 'input.swf', '--out', 'out']);
    expect(planned.code, `plan crashed on ${name}`).not.toBe(EXIT.internal);
    expect(existsSync(out), `plan wrote a project (${name})`).toBe(false);

    const inspected = await invoke(first, ['inspect', 'input.swf', '--actions', '--symbols', '--tags', '--timeline']);
    expect(inspected.code, `inspect crashed on ${name}`).not.toBe(EXIT.internal);
    expect(inspected.err, `inspect wrote to stderr on ${name}`).toEqual([]);

    const cold = await invoke(first, ['build', 'input.swf', '--out', 'out']);
    expect(cold.code, `build crashed on ${name}`).not.toBe(EXIT.internal);
    expect(cold.err, `build wrote to stderr on ${name}`).toEqual([]);
    // A movie the pipeline cannot finish is exit 1, 2 or 3, and a movie it can finish but considers too noisy to
    // pass a budget is 4; only a 5 is a bug, which the line above already took. Exit 4 is the corpus teaching
    // something: `crash-005-shape-edge-past-limit.swf` is 52 bytes that warn 92,680 times about reads past the
    // declared bounds, which is exactly what `--max-warnings` exists to make a porter notice (`E-055`).
    expect([EXIT.ok, EXIT.failed, EXIT.unreadable, EXIT.avm2, EXIT.threshold], `${name}: exit ${cold.code}`).toContain(
      cold.code,
    );
    if (cold.code === EXIT.threshold) {
      // A threshold is a verdict about noise, not about corruption: the project is still written and still audited.
      expect(writtenCount(cold.body), `${name} failed a budget and lost its project too`).toBeGreaterThan(0);
    }

    if (writtenCount(cold.body) === 0) {
      // `build` creates `--out` before it reads, so the directory may exist. What must not exist is a project.
      expect(existsSync(join(out, 'build-info.json')), `a refused run left a project behind (${name})`).toBe(false);
      return;
    }

    // A project is written only by a run that reported no error diagnostic, so the two facts are one assertion.
    expect(cold.body.diagnostics?.errors ?? 0, `a project was written by a run with errors (${name})`).toBe(0);
    const baseline = fingerprint(out);
    // The disk holds exactly what the run reported, plus the one file the CLI writes itself: `forge.config.json`
    // is the resolved-config echo `CMP-R004` and is not part of the pipeline's file set.
    expect(Object.keys(baseline).sort(), `the project on disk is not the file set the run reported (${name})`).toEqual(
      [...new Set([...projected(cold.body), 'forge.config.json'])].sort(),
    );

    // Warm: the same input in the same workspace, so the stage cache this run populated is the only difference.
    const warm = await invoke(first, ['build', 'input.swf', '--out', 'out']);
    expect(warm.code).toBe(cold.code);
    expect(fingerprint(out), `the warm build emitted different bytes (${name})`).toEqual(baseline);
    const statuses = (warm.body.stages ?? []).map((stage) => stage.status);
    expect(statuses, `the warm build re-ran every stage, so the cache never hit (${name})`).toContain('cached');

    // Fresh: a second workspace with its own empty cache proves the bytes did not come from this run's history.
    const fresh = await invoke(second, ['build', 'input.swf', '--out', 'out']);
    expect(fresh.code).toBe(cold.code);
    expect(fingerprint(join(second, 'out')), `two workspaces disagree (${name})`).toEqual(baseline);

    const verified = await invoke(first, ['verify', 'out']);
    expect(verified.code, `verify failed a project the build reported clean (${name})`).toBe(EXIT.ok);
    expect(verified.err).toEqual([]);
    expect(verified.body.findings ?? [], `a clean project verified non-silent (${name})`).toEqual([]);
    expect(verified.body.clean).toBe(true);

    const deep = await invoke(first, ['verify', 'out', '--deep', '--against', join(second, 'out')]);
    expect(deep.code).toBe(EXIT.ok);
    const drift = (deep.body.findings ?? []).filter((finding) => finding.check === 'determinism');
    expect(drift, `the two builds of one input disagreed (${name})`).toEqual([]);

    // §10.5, over the corpus rather than over one fixture: the report files have to agree with each other and with
    // the config this run actually resolved. `build-info.json` states each gate with its value,
    // `porting-notes.json` names the same set, and the values are compared against the resolved config the CLI
    // printed for this invocation — not against a snapshot, which is how a report rots into decoration.
    const info = JSON.parse(readFileSync(join(out, 'build-info.json'), 'utf8')) as {
      gates: Record<string, unknown>;
    };
    const notes = JSON.parse(readFileSync(join(out, 'porting-notes.json'), 'utf8')) as {
      gates: Record<string, unknown>;
    };
    expect(notes.gates, `the two report files disagree (${name})`).toEqual(info.gates);
    // Three namespaces and no more: every config leaf, every run switch, and the emit stage's two source-map
    // answers, which `CMP-R028` makes the one flag that is a stage option rather than a config key.
    const outside = Object.keys(info.gates)
      .filter((gate) => !gate.startsWith('config.') && !gate.startsWith('switches.'))
      .sort();
    expect(outside, `a gate is neither a config leaf nor a run switch (${name})`).toEqual([
      'emit.sourcemapRequested',
      'emit.sourcemapWritten',
    ]);
    for (const [gate, value] of Object.entries(info.gates)) {
      if (gate.startsWith('config.')) {
        // The gate map is a scalar map, so an array-valued config key is stated as one comma-joined row rather
        // than skipped: `config.vm.allow` has to appear in the report even when the only honest answer is that it
        // is empty. `gatesOf`'s flattening is the thing being mirrored here, and it is asserted in both directions.
        expect(
          stated(lookedUp(cold.body.config ?? {}, gate)),
          `${gate} is reported with a value this run did not use (${name})`,
        ).toEqual(value);
      } else if (gate.startsWith('switches.')) {
        // This invocation passed no switch at all, so anything but `false` here is the report inventing a flag.
        expect(value, `${gate} is reported as set by a run that set nothing (${name})`).toBe(false);
      } else if (gate === 'emit.sourcemapRequested') {
        // The one flag that is a stage option rather than a config key (`CMP-R028`), and its default is `file`.
        expect(value, `the report states a source-map policy this run did not ask for (${name})`).toBe('file');
      } else {
        // …and the policy it states is honoured by nothing, because P6 withholds statement maps (§6.1).
        expect(value, `a map was written by a build that withholds them (${name})`).toBe(false);
      }
    }
  });
});
