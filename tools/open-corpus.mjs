#!/usr/bin/env node

/**
 * Open-corpus lane (P5 / `IMPL-050` §13 criterion 3, roadmap §4.6 item B, `registers/corpus.md`).
 *
 * The committed corpus (class C1) is 26 files and **not one of them contains an action block**, so
 * it cannot exercise the AVM1 front end at all: the 2026-10-11 tier report recorded 0 action blocks,
 * 0 functions and 0 T2 entries. This lane adds class C4 — real, ActionScript-bearing SWFs from a
 * licensed upstream, pinned by commit and verified by hash.
 *
 * `IMPL-020-R038` sanctions exactly three roles for a *committed* binary and an externally sourced
 * movie is none of them, and `.gitignore` already says "never commit fixtures derived from
 * copyrighted SWFs". So nothing here is committed but the manifest: bytes are fetched into
 * `.forge-cache/corpus/` and hash-verified against `fixtures/open/manifest.json`.
 *
 * Usage (after `corepack pnpm build`):
 *   node tools/open-corpus.mjs fetch [--pin]   download into the cache; --pin rewrites the manifest hashes
 *   node tools/open-corpus.mjs verify          hash-check the cache against the manifest
 *   node tools/open-corpus.mjs report [--out audits/P5-C4-CORPUS-EXTERNAL.json]
 *   node tools/open-corpus.mjs list
 *
 * Transport: `raw.githubusercontent.com` first, then the `api.github.com` contents endpoint (base64),
 * which needs no auth for public repos and is the only one reachable from some sandboxes.
 */

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(repoRoot, 'fixtures/open/manifest.json');
const defaultReport = path.join(repoRoot, 'audits/P5-C4-CORPUS-EXTERNAL.json');

const readManifest = () => JSON.parse(readFileSync(manifestPath, 'utf8'));
const cachePathFor = (manifest, source, entry) =>
  path.join(repoRoot, manifest.cacheDir, source.id, entry.name + path.extname(entry.path));

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/** `GITHUB_TOKEN`/`GH_TOKEN` lifts the contents API from 60 to 5000 requests per hour. */
const headers = () => {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  return {
    accept: 'application/vnd.github.raw+json',
    'user-agent': 'swf-forge-open-corpus',
    ...(token === undefined || token === '' ? {} : { authorization: `Bearer ${token}` }),
  };
};

async function fetchUrl(url) {
  const res = await fetch(url, { headers: headers() });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Three transports, in order:
 *
 * 1. `raw.githubusercontent.com` — the obvious URL, but some networks do not route it.
 * 2. `api.github.com` contents with the `raw` accept header — no auth needed for a public repo.
 * 3. the same URL through `curl` — Node's undici ignores `HTTPS_PROXY` and is blocked outright in
 *    some sandboxes and CI runners where `curl`, which honours the environment's TLS and proxy
 *    configuration, works fine. A corpus lane that only ran on the author's machine would be worth
 *    nothing, so the fallback is part of the tool and not a local workaround.
 */
function curlBytes(url) {
  const token = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  const args = [
    '-fsSL',
    '--max-time',
    '60',
    '-H',
    'accept: application/vnd.github.raw+json',
    ...(token === undefined || token === '' ? [] : ['-H', `authorization: Bearer ${token}`]),
    url,
  ];
  const run = spawnSync('curl', args, { maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0 || run.stdout === null || run.stdout.length === 0) {
    throw new Error(`curl exited ${run.status ?? 'null'}${run.error === undefined ? '' : ` (${run.error.message})`}`);
  }
  return new Uint8Array(run.stdout);
}

async function download(source, entry) {
  const rel = `${source.pathPrefix}${entry.path}`;
  const raw = `https://raw.githubusercontent.com/${source.owner}/${source.repo}/${source.commit}/${rel}`;
  const api = `https://api.github.com/repos/${source.owner}/${source.repo}/contents/${rel}?ref=${source.commit}`;
  const failures = [];
  for (const [label, attempt] of [
    ['raw', () => fetchUrl(raw)],
    ['api', () => fetchUrl(api)],
    ['curl', async () => curlBytes(api)],
  ]) {
    try {
      return await attempt();
    } catch (error) {
      failures.push(`${label}: ${error.message}`);
    }
  }
  throw new Error(`${entry.name}: all transports failed — ${failures.join('; ')}`);
}

async function cmdFetch(pin) {
  const manifest = readManifest();
  let fetched = 0;
  let verified = 0;
  const failures = [];
  for (const source of manifest.sources) {
    for (const entry of source.entries) {
      const dest = cachePathFor(manifest, source, entry);
      mkdirSync(path.dirname(dest), { recursive: true });
      try {
        const bytes = await download(source, entry);
        const hash = sha256(bytes);
        if (pin || !entry.sha256) {
          entry.sha256 = hash;
          entry.bytes = bytes.length;
        } else {
          assert.equal(hash, entry.sha256, `${entry.name}: sha256 differs from the pinned manifest`);
          assert.equal(bytes.length, entry.bytes, `${entry.name}: size differs from the pinned manifest`);
          verified += 1;
        }
        writeFileSync(dest, bytes);
        fetched += 1;
      } catch (error) {
        failures.push(error.message);
      }
    }
  }
  if (pin) {
    manifest.pinned = new Date().toISOString().slice(0, 10);
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`pinned ${fetched} entr(y|ies) into ${path.relative(repoRoot, manifestPath)}`);
  } else {
    console.log(`fetched ${fetched}, hash-verified ${verified}`);
  }
  if (failures.length > 0) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
  }
}

function cmdVerify() {
  const manifest = readManifest();
  let ok = 0;
  const missing = [];
  for (const source of manifest.sources) {
    for (const entry of source.entries) {
      const file = cachePathFor(manifest, source, entry);
      if (!existsSync(file)) {
        missing.push(entry.name);
        continue;
      }
      const bytes = readFileSync(file);
      assert.equal(sha256(bytes), entry.sha256, `${entry.name}: cache hash differs from the manifest`);
      ok += 1;
    }
  }
  console.log(`verified ${ok} cached file(s) against the manifest`);
  if (missing.length > 0) {
    console.error(`missing ${missing.length}: run \`node tools/open-corpus.mjs fetch\` — ${missing.slice(0, 6).join(', ')}`);
    process.exitCode = 1;
  }
}

/** One fresh CLI process per input, exactly as the committed C1 tier report does. */
function analyze(file) {
  const run = spawnSync(
    process.execPath,
    [path.join(repoRoot, 'apps/decompiler/dist/main.js'), 'analyze', file, '--tiers', '--json'],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return { status: run.status, json: run.stdout === '' ? null : JSON.parse(run.stdout), stderr: run.stderr };
}

function cmdReport(outPath) {
  const manifest = readManifest();
  const files = [];
  const missing = [];
  for (const source of manifest.sources) {
    for (const entry of source.entries) {
      const file = cachePathFor(manifest, source, entry);
      if (!existsSync(file)) missing.push(entry.name);
      else files.push({ source, entry, file });
    }
  }
  if (missing.length > 0) {
    console.error(`refusing to report on a partial corpus: ${missing.length} file(s) not fetched`);
    process.exit(1);
  }

  const summary = {
    files: files.length,
    entries: 0,
    actionBlocks: 0,
    functions: 0,
    tiers: { T0: 0, T1: 0, T2: 0 },
    t2ReasonCounts: {},
    reasonCounts: {},
    unknownOpcodeReasons: 0,
    diagnosticCodes: {},
    diagnostics: { total: 0, errors: 0, warnings: 0, infos: 0 },
    exitCodes: {},
    perGroup: {},
  };
  /** `CMP-R029`: 1 = error diagnostics, 2 = unreadable, 3 = AVM2. Only 5 (an internal bug) is fatal. */
  const internalErrors = [];
  const unreadable = [];
  const avm2 = [];
  const stderrNoise = [];
  const hashMismatch = [];
  const perFile = [];

  for (const { source, entry, file } of files) {
    const { status, json, stderr } = analyze(file);
    summary.exitCodes[status] = (summary.exitCodes[status] ?? 0) + 1;
    if (json === null) {
      internalErrors.push(`${entry.name}: no JSON on stdout (exit ${status})`);
      continue;
    }
    if (status === 5) internalErrors.push(entry.name);
    if (status === 2) unreadable.push(entry.name);
    if (status === 3) avm2.push(entry.name);
    if (stderr.trim() !== '') stderrNoise.push(entry.name);
    // The CLI hashes its own input, so the artifact can prove it analyzed the pinned bytes.
    if (json.file?.sha256 !== entry.sha256) hashMismatch.push(entry.name);

    const entries = json.entries ?? [];
    const tiers = { T0: 0, T1: 0, T2: 0 };
    const reasons = [];
    let functions = 0;
    for (const item of entries) {
      const tier = `T${item.tier ?? 0}`;
      tiers[tier] = (tiers[tier] ?? 0) + 1;
      // A serialized TierReason is `{ reason, offset }`; the head before ':' is the reason class.
      for (const item2 of item.reasons ?? []) {
        reasons.push(typeof item2 === 'string' ? item2 : String(item2?.reason ?? JSON.stringify(item2)));
      }
      if (item.kind === 'function') functions += 1;
    }
    const diagSummary = json.diagnostics?.summary ?? json.diagnostics ?? {};
    summary.entries += entries.length;
    summary.actionBlocks += entries.filter((item) => item.kind !== 'function').length;
    summary.functions += functions;
    for (const tier of ['T0', 'T1', 'T2']) summary.tiers[tier] += tiers[tier];
    for (const diagnostic of json.diagnostics?.items ?? []) {
      const code = String(diagnostic.code ?? diagnostic);
      summary.diagnosticCodes[code] = (summary.diagnosticCodes[code] ?? 0) + 1;
    }
    for (const reason of reasons) {
      const head = reason.split(':')[0] ?? reason;
      summary.reasonCounts[head] = (summary.reasonCounts[head] ?? 0) + 1;
      if (head.startsWith('unknown-opcode')) summary.unknownOpcodeReasons += 1;
      if (tiers.T2 > 0) summary.t2ReasonCounts[head] = (summary.t2ReasonCounts[head] ?? 0) + 1;
    }
    summary.diagnostics.total += diagSummary.total ?? 0;
    summary.diagnostics.errors += diagSummary.errors ?? 0;
    summary.diagnostics.warnings += diagSummary.warnings ?? 0;
    summary.diagnostics.infos += diagSummary.infos ?? 0;

    const group = entry.group ?? 'ungrouped';
    const bucket = (summary.perGroup[group] ??= { files: 0, entries: 0, functions: 0, T0: 0, T1: 0, T2: 0 });
    bucket.files += 1;
    bucket.entries += entries.length;
    bucket.functions += functions;
    for (const tier of ['T0', 'T1', 'T2']) bucket[tier] += tiers[tier];
    perFile.push({
      name: entry.name,
      group,
      source: source.id,
      exit: status,
      sha256: entry.sha256,
      entries: entries.length,
      functions,
      tiers,
      reasons: [...new Set(reasons.map((reason) => reason.split(':')[0] ?? reason))],
    });
  }

  const report = {
    schemaVersion: 1,
    command: 'node apps/decompiler/dist/main.js analyze <cached-file.swf> --tiers --json',
    buildCommand: 'corepack pnpm build',
    fetchCommand: 'node tools/open-corpus.mjs fetch',
    exitCodePolicy: 'CMP-R029: 0 ok, 1 error-severity diagnostics, 2 unreadable, 3 AVM2 (SF1000), 5 internal bug. Only 5 fails this lane.',
    corpusClass: 'C4 (licensed external conformance corpus; fetched into .forge-cache, never committed)',
    policy: 'IMPL-020-R038 sanctions three committed-binary roles and an external movie is none of them.',
    corpusScope: manifest.sources.map((source) => ({
      sourceClass: `licensed-external-conformance (${source.owner}/${source.repo}@${source.commit.slice(0, 12)})`,
      licence: source.licence,
      reuseBasis: source.reuseBasis,
      count: source.entries.length,
    })),
    generated: new Date().toISOString().slice(0, 10),
    integrity: { hashMismatches: hashMismatch, internalErrors, unreadable, avm2, stderrNoise },
    summary,
    files: perFile,
  };
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    `${summary.files} file(s): ${summary.actionBlocks} action block(s), ${summary.functions} function(s), ` +
      `T0=${summary.tiers.T0} T1=${summary.tiers.T1} T2=${summary.tiers.T2}, ` +
      `unknown-opcode reasons=${summary.unknownOpcodeReasons}, exit codes=${JSON.stringify(summary.exitCodes)} ` +
      `\u2192 ${path.relative(repoRoot, outPath)}`,
  );
  if (internalErrors.length > 0 || hashMismatch.length > 0) {
    console.error(`FATAL: ${internalErrors.length} internal error(s), ${hashMismatch.length} hash mismatch(es)`);
    process.exitCode = 1;
  }
}

function cmdList() {
  const manifest = readManifest();
  for (const source of manifest.sources) {
    console.log(`${source.id}: ${source.owner}/${source.repo}@${source.commit.slice(0, 12)} (${source.licence})`);
    for (const entry of source.entries) {
      console.log(`  ${entry.group.padEnd(20)} ${entry.name.padEnd(34)} ${entry.bytes ?? '?'} B`);
    }
  }
}

const [command, ...rest] = process.argv.slice(2);
const pin = rest.includes('--pin');
const outIndex = rest.indexOf('--out');
const outPath = outIndex >= 0 ? path.resolve(repoRoot, rest[outIndex + 1]) : defaultReport;

if (command === 'fetch') await cmdFetch(pin);
else if (command === 'verify') cmdVerify();
else if (command === 'report') cmdReport(outPath);
else if (command === 'list') cmdList();
else {
  console.error('usage: open-corpus.mjs <fetch [--pin] | verify | report [--out <file>] | list>');
  process.exit(2);
}
