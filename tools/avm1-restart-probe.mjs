#!/usr/bin/env node

/**
 * Non-empty AVM1 process-restart determinism probe (P5 / IMPL-050 §13.5).
 * Run after `corepack pnpm build`, or via `corepack pnpm test:avm1-restart`.
 */

import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { analyzeMovie, extractRequirements } from '../packages/avm1/dist/index.js';
import { buildMovieModel, openSwf, Tag } from '../packages/swf/dist/index.js';
import { actionBlock, buildSwf, concat, endTag, showFrames, tag } from '../packages/swf/dist/test-support/index.js';

const scriptPath = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(scriptPath), '..');

function u16(value) {
  return [value & 0xff, (value >>> 8) & 0xff];
}

function actionRecord(code, payload = []) {
  if (code < 0x80) return [code];
  return [code, ...u16(payload.length), ...payload];
}

function pushInt(value) {
  const bits = value >>> 0;
  return actionRecord(0x96, [7, bits & 0xff, (bits >>> 8) & 0xff, (bits >>> 16) & 0xff, (bits >>> 24) & 0xff]);
}

function pushConstant8(index) {
  return actionRecord(0x96, [8, index & 0xff]);
}

function constantPool(value) {
  return actionRecord(0x88, [1, 0, ...Buffer.from(value, 'ascii'), 0]);
}

/**
 * `DefineFunction` (0x9B). `Length` covers the header alone — `FunctionName`, `NumParams`,
 * `CodeSize` — and `Code[CodeSize]` follows **past** the record, as real content does and as
 * `IMPL-050-R071` requires (`E-035`). This helper originally put the body inside `Length`, which
 * matched the decoders' then-wrong reading and so proved nothing about real files.
 */
function defineFunction(name, body) {
  const nameBytes = [...Buffer.from(name, 'ascii'), 0];
  return [...actionRecord(0x9b, [...nameBytes, ...u16(0), ...u16(body.length)]), ...body];
}

function syntheticMovie() {
  const arithmeticBody = [...pushInt(3), ...pushInt(4), ...actionRecord(0x0a), 0x00];
  const dynamicPoolBody = [...pushConstant8(0), 0x00];
  const unknownBody = [0x01, 0x00]; // Undefined opcode; analysis classifies this function as T2.
  const actions = [
    ...constantPool('pool-entry'),
    ...pushInt(1),
    ...pushInt(2),
    ...actionRecord(0x0a),
    ...defineFunction('tick', arithmeticBody),
    ...defineFunction('poolReader', dynamicPoolBody),
    ...defineFunction('unknownBytecode', unknownBody),
    0x07, // Stop
    0x00, // End
  ];
  const body = concat(
    tag(Tag.DoAction, actionBlock(actions)),
    showFrames(1),
    endTag(),
  );
  return buildSwf({ version: 7, body, frameCount: 1 });
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function failProcess(label, result) {
  if (result.error !== undefined) throw result.error;
  assert.equal(
    result.status,
    0,
    `${label} exited ${String(result.status)}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  );
  assert.equal(result.stderr, '', `${label} wrote to stderr:\n${result.stderr}`);
}

function reportFromAnalysis(filePath) {
  const bytes = new Uint8Array(readFileSync(filePath));
  const file = openSwf(bytes);
  const model = buildMovieModel(file);
  const diagnostics = [];
  const analysis = analyzeMovie(file, model, {
    emit: (...diagnostic) => diagnostics.push(diagnostic),
  });
  const names = analysis.names.names;
  const functions = [];
  const visited = new Set();

  const visitBlocks = (blocks) => {
    for (const block of blocks) {
      for (const op of block.ops) {
        if (op.kind === 'define' && op.fn.ir !== null) {
          const fn = op.fn.ir;
          if (visited.has(fn.id)) continue;
          visited.add(fn.id);
          functions.push({
            id: fn.id,
            name: names.get(fn.id) ?? fn.sourceName,
            tier: fn.tier,
            reasons: fn.tierReasons.map((reason) => reason.reason),
            requirements: extractRequirements(fn.blocks),
          });
          visitBlocks(fn.blocks);
        } else if (op.kind === 'with') {
          visitBlocks(op.region.bodyBlocks);
        } else if (op.kind === 'try') {
          visitBlocks([
            ...op.region.tryBlocks,
            ...(op.region.catchBlocks ?? []),
            ...(op.region.finallyBlocks ?? []),
          ]);
        }
      }
    }
  };

  const blocks = analysis.blocks.map(({ ir, decision }) => {
    visitBlocks(ir.blocks);
    return {
      id: ir.id,
      kind: ir.kind,
      tier: decision.tier,
      reasons: [...ir.tierReasons.map((reason) => reason.reason)],
      requirements: extractRequirements(ir.blocks),
    };
  });

  return {
    avm2: analysis.avm2,
    names: [...names.entries()].sort(([a], [b]) => a.localeCompare(b)),
    blocks,
    functions,
    diagnostics,
  };
}

function worker(filePath) {
  process.stdout.write(`${JSON.stringify(reportFromAnalysis(filePath))}\n`);
}

function runFreshNodeWorker(filePath) {
  const result = spawnSync(process.execPath, [scriptPath, '--worker', filePath], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  failProcess('direct analysis worker', result);
  return result.stdout;
}

function runCli(filePath) {
  const cliPath = path.join(repoRoot, 'apps/decompiler/dist/main.js');
  const result = spawnSync(process.execPath, [cliPath, 'analyze', filePath, '--tiers', '--json'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  failProcess('analyze --tiers --json', result);
  return result.stdout;
}

function main() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'swf-forge-avm1-restart-'));
  const filePath = path.join(tempDir, 'function-bearing.swf');
  try {
    const bytes = syntheticMovie();
    writeFileSync(filePath, bytes);

    const directFirst = runFreshNodeWorker(filePath);
    const directSecond = runFreshNodeWorker(filePath);
    assert.equal(directFirst, directSecond, 'direct names/requirements/reports differ across fresh processes');
    const direct = JSON.parse(directFirst);
    assert.equal(direct.avm2.present, false);
    assert.equal(direct.blocks.length, 1, 'synthetic report must include an action block');
    assert.equal(direct.blocks[0].tier, 0, 'the action block must provide a T0 entry');
    assert.equal(direct.functions.length, 3, 'synthetic report must include three nested functions');
    assert.ok(direct.names.some(([, name]) => name === 'tick'), 'the declared function name must be recovered');
    assert.ok(direct.blocks[0].requirements.length > 0, 'action-block requirements must be non-empty');
    assert.deepEqual(
      direct.functions.map(({ name, tier, reasons }) => ({ name, tier, reasons })),
      [
        { name: 'tick', tier: 0, reasons: [] },
        { name: 'poolReader', tier: 1, reasons: ['dynamic-pool'] },
        { name: 'unknownBytecode', tier: 2, reasons: ['unknown-opcode:0x01'] },
      ],
      'the direct report must preserve one function at each tier and each exact reason',
    );
    assert.ok(direct.functions.find((fn) => fn.name === 'tick').requirements.length > 0);
    assert.ok(direct.functions.find((fn) => fn.name === 'poolReader').requirements.length > 0);

    const cliFirst = runCli(filePath);
    const cliSecond = runCli(filePath);
    assert.equal(cliFirst, cliSecond, 'CLI tier reports differ across fresh processes');
    const cli = JSON.parse(cliFirst);
    assert.equal(cli.counts.actionBlocks, 1, 'CLI report must contain one action block');
    assert.equal(cli.counts.functions, 3, 'CLI report must contain all nested functions');
    assert.deepEqual(
      { T0: cli.counts.T0, T1: cli.counts.T1, T2: cli.counts.T2 },
      { T0: 2, T1: 1, T2: 1 },
      'CLI tier counts must include the T0 block and a function at each tier',
    );
    assert.deepEqual(
      cli.entries
        .filter((entry) => entry.role === 'function')
        .map(({ name, tier, reasons }) => ({ name, tier, reasons: reasons.map(({ reason }) => reason) })),
      [
        { name: 'tick', tier: 0, reasons: [] },
        { name: 'poolReader', tier: 1, reasons: ['dynamic-pool'] },
        { name: 'unknownBytecode', tier: 2, reasons: ['unknown-opcode:0x01'] },
      ],
      'the CLI report must expose each function tier and exact reason',
    );

    const normalizedCli = {
      ...cli,
      file: { ...cli.file, path: '<synthetic-function-bearing.swf>' },
    };
    process.stdout.write(
      `${JSON.stringify(
        {
          probe: 'synthetic-t0-t1-t2-avm1-process-restart-determinism',
          evidenceClass: 'synthetic-local-only',
          freshDirectProcessesCompared: 2,
          directReportsIdentical: true,
          directReportSha256: sha256(Buffer.from(directFirst)),
          freshCliProcessesCompared: 2,
          cliReportsIdentical: true,
          normalizedCliReportSha256: sha256(Buffer.from(JSON.stringify(normalizedCli, null, 2))),
          inputSha256: sha256(bytes),
          actionBlocks: cli.counts.actionBlocks,
          functions: cli.counts.functions,
          tierCounts: { T0: cli.counts.T0, T1: cli.counts.T1, T2: cli.counts.T2 },
          diagnostics: {
            total: cli.diagnostics.total,
            errors: cli.diagnostics.errors,
            warnings: cli.diagnostics.warnings,
            infos: cli.diagnostics.infos,
          },
          cliEntries: cli.entries.map((entry) => ({
            id: entry.id,
            role: entry.role,
            name: entry.name,
            tier: entry.tier,
            reasons: entry.reasons.map((reason) => reason.reason),
          })),
          recoveredNames: direct.names.map(([, name]) => name),
          actionRequirements: direct.blocks[0].requirements,
          functionReports: direct.functions.map((fn) => ({
            name: fn.name,
            tier: fn.tier,
            reasons: fn.reasons,
            requirements: fn.requirements,
          })),
        },
        null,
        2,
      )}\n`,
    );
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
}

if (process.argv[2] === '--worker') {
  const filePath = process.argv[3];
  assert.ok(filePath, 'worker requires an SWF file path');
  worker(filePath);
} else {
  main();
}
