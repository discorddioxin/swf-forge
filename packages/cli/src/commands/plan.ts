/**
 * `swfforge plan`, and what `swfforge build --dry-run` prints.
 *
 * They are the same command: `CMP-§8` defines `--dry-run` as "analyse and report, write nothing", and `IMPL-120`
 * §6 defines `plan` as "the resolved stage list, per-asset decisions, budgets, tree-shake decisions, files that
 * would be written, exit code". One code path is the only way the flag can be documented as equivalent to the
 * verb without someone having to keep two printings of the run in step. Errata `E-053` records that the two specs
 * describe the same capability in two places rather than as two features.
 *
 * A plan runs the real pipeline with `dryRun`, so the runner skips everything after the `plan` stage and records
 * each skipped stage as `dry-run-skipped`. That is why the plan can list the files a build *would* write: the
 * skipped stages are the answer, and the plan is not a second implementation of the emit stage that could drift
 * from it. The one thing a plan cannot promise is a file list, because the files come from the stage that did not
 * run — so the plan says which stages would run instead, which is the same claim one level up and cannot lie.
 */

import { createCancellationToken } from '@swf-forge/compile';
import type { CancellationToken, JsonObject, RunResult } from '@swf-forge/compile';

import type { Invocation } from '../args.js';
import type { CommandContext, CommandResult } from '../context.js';
import { EXIT, exitForRun, runFacts } from '../exit.js';
import { tick } from '../json.js';
import { runBuild } from '../run.js';

import { configToJson } from '../config.js';
import { diagnosticRows } from '../json.js';
import { prepareInvocation, type Prepared } from './prepare.js';
import { passView, runView, stageView } from '../view.js';

export interface PlanView {
  readonly lines: readonly string[];
  readonly body: JsonObject;
}

/** The plan as rows plus their text — `IMPL-120-R025`'s "the same data, projected twice". */
export function planView(result: RunResult, prepared: Prepared): PlanView {
  const skipped = result.stages.filter((stage) => stage.status === 'dry-run-skipped');
  const lines: string[] = [
    `input   ${prepared.input.name}`,
    `output  ${prepared.outDir}`,
    `config  ${prepared.configSource === null ? 'tool defaults (no forge.config.json found)' : prepared.configSource}`,
    `stages  ${result.stages.map((stage) => `${stage.id}:${stage.status}`).join(' ')}`,
  ];
  if (skipped.length > 0) {
    lines.push(`would run after plan: ${skipped.map((stage) => stage.id).join(', ')}`);
  }
  lines.push('', 'stages:', ...stageView(result.stages).text);
  lines.push('', 'passes:', ...passView(result.passes).text);
  const model = result.state.model;
  const analysis = result.state.analysis;
  if (model !== undefined) {
    lines.push(
      '',
      `movie: ${model.frameCount} frame(s), ${model.characterCount} character(s), ${model.initActionCount} init action block(s)`,
    );
  }
  if (analysis !== undefined) {
    lines.push(
      `vm: ${analysis.actionBlockCount} action block(s) — T0 ${analysis.tiers.T0}, T1 ${analysis.tiers.T1}, T2 ${analysis.tiers.T2}`,
      `host requirements: ${
        analysis.requirements.length === 0
          ? 'none'
          : analysis.requirements.map((entry) => `${entry.group} (via ${entry.via})`).join(', ')
      }`,
    );
  }
  const decisions = result.state.passes?.reduce((sum, pass) => sum + pass.decisions.length, 0) ?? 0;
  lines.push(`decisions: ${decisions} recorded by the passes, each with a reason (IMPL-120-R013)`);
  if (result.diagnostics.items.length > 0) {
    lines.push('', 'diagnostics:', ...diagnosticRows(result.diagnostics.items).text);
  }
  return {
    body: {
      config: configToJson(prepared.config),
      configSource: prepared.configSource,
      input: { bytes: prepared.input.bytes.length, file: prepared.input.name, sha256: result.state.read?.sha256 ?? '' },
      outDir: prepared.outDir,
      ...runView(result),
      wouldRun: skipped.map((stage) => stage.id),
    },
    lines,
  };
}

/**
 * `swfforge plan`: the same run as `build --dry-run`, and it never writes.
 *
 * The cache is switched off here on purpose: `fileStageCache` writes entries to `.forge/cache`, and a verb whose
 * whole promise is "nothing is written" cannot keep it while warming a cache. The cost is that a plan re-reads the
 * input every time, which for one SWF file is not a cost worth a lie.
 */
export async function planCommand(
  ctx: CommandContext,
  request: { readonly cwd: string; readonly invocation: Invocation; readonly cancel?: CancellationToken },
): Promise<CommandResult> {
  const prepared = prepareInvocation('plan', request.cwd, request.invocation);
  if ('error' in prepared) return { body: {}, exit: EXIT.unreadable, lines: [`error: ${prepared.error}`] };
  const setup = prepared.prepared;
  for (const entry of request.invocation.inert) ctx.out(`note: ${entry.name} is accepted but inert: ${entry.reason}`);
  await tick();
  try {
    const result = runBuild({
      bytes: setup.input.bytes,
      // No cache writes from a read-only verb; `--no-cache` is therefore implied and saying so beats implying it.
      cacheDir: null,
      cancel: request.cancel ?? createCancellationToken(),
      config: setup.config,
      cwd: request.cwd,
      name: setup.input.name,
      stage: setup.stage,
      switches: { ...setup.switches, dryRun: true },
    });
    const plan = planView(result, setup);
    return {
      body: { ...plan.body, note: 'a plan implies --no-cache: warming the cache would write' },
      exit: exitForRun(runFacts(result, { ...setup.switches, dryRun: true }, setup.config)).exit,
      lines: plan.lines,
    };
  } catch (cause) {
    // A plan writes nothing, so there is no directory to leave a crash report in; the stack goes to stderr.
    const stack = cause instanceof Error ? (cause.stack ?? cause.message) : String(cause);
    return { body: { crash: stack }, exit: EXIT.internal, lines: [`internal error: ${stack.split('\n')[0] ?? stack}`] };
  }
}
