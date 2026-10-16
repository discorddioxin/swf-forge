/**
 * `swfforge build` — the only verb that writes.
 *
 * The shape is fixed by `CMP-§2` and `IMPL-120-R023`: the pipeline produces the files, this module puts them on
 * disk in sorted order through temp names, and nothing else. Two rules are worth naming because they are the ones
 * a later change would be tempted to break:
 *
 * **Only a clean run writes.** A `refused` run (AVM2, exit 3), a `failed` run (a stage threw, exit 1) and a run
 * that reported an `error` diagnostic all leave the output directory as they found it. The tempting alternative —
 * write what the stages managed before they stopped, "so the user has something to look at" — produces a project
 * that half-exists, and a half-project is the one artifact a porter will try to run. `CMP-§4`'s layout is
 * all-or-nothing for that reason, and the recovery ladder in `CMP-§5` is about a *movie* with problems, not about
 * bytes that were never a movie: an input the reader called `SF0001` still produces twelve well-formed files, all
 * of them describing an empty movie, which is the worst possible way to be told your file is not a SWF.
 *
 * **`--dry-run` is `plan`.** Both call `planView` on the same run, so the flag and the verb cannot drift.
 *
 * The inert flags are printed, not swallowed: `CMP-R028` requires a config field per flag and `--jobs` has none to
 * set until `WP-120-07` builds a parallel encode, so the honest move is to accept the flag, say that it changed
 * nothing, and let the user decide whether they needed it.
 */

import { createCancellationToken } from '@swf-forge/compile';
import type { CancellationToken, RunResult } from '@swf-forge/compile';

import type { Invocation } from '../args.js';
import { EXIT, exitForRun, runFacts } from '../exit.js';
import type { CommandContext, CommandResult } from '../context.js';
import { configArtifact, configToJson } from '../config.js';
import { writeCrashBundle, writeOut, WriteCancelled } from '../disk.js';
import { diagnosticRows, tick } from '../json.js';
import { runBuild } from '../run.js';
import { formatSize, runSummary, runView } from '../view.js';
import { planView } from './plan.js';
import { prepareInvocation } from './prepare.js';
import { TOOL_NAME, TOOL_VERSION } from '../version.js';

export interface BuildOutcome {
  readonly result: RunResult;
  readonly written: readonly string[];
  readonly skipped: readonly string[];
}

export interface BuildRequest {
  readonly cwd: string;
  readonly invocation: Invocation;
  readonly cancel?: CancellationToken;
}

/** Read, resolve, run, write. Every failure returns a line and a code rather than throwing. */
export async function buildCommand(ctx: CommandContext, request: BuildRequest): Promise<CommandResult> {
  const prepared = prepareInvocation('build', request.cwd, request.invocation);
  if ('error' in prepared) {
    return { body: {}, exit: EXIT.unreadable, lines: [`error: ${prepared.error}`] };
  }
  const setup = prepared.prepared;
  const cancel = request.cancel ?? createCancellationToken();
  const inert = request.invocation.inert;
  for (const entry of inert) ctx.out(`note: ${entry.name} is accepted but inert: ${entry.reason}`);

  await tick();
  let result: RunResult;
  try {
    result = runBuild({
      bytes: setup.input.bytes,
      cacheDir: setup.cacheDir,
      cancel,
      config: setup.config,
      cwd: request.cwd,
      name: setup.input.name,
      stage: setup.stage,
      switches: setup.switches,
    });
  } catch (cause) {
    // An error that escaped the runner is our bug by `IMPL-120-R026`'s own definition: a stage that throws inside
    // a runner that records failures is not a crash, so the only thing that can get here is a wiring fault.
    const stack = cause instanceof Error ? (cause.stack ?? cause.message) : String(cause);
    const bundle = writeCrashBundle(setup.absoluteOut, crashReport(setup.input, stack));
    return {
      body: { crash: { bundle, stack } },
      exit: EXIT.internal,
      lines: [
        `internal error: ${stack.split('\n')[0]}`,
        ...(bundle === null ? [] : [`crash report written to ${setup.outDir}/${bundle}`]),
      ],
    };
  }

  const dryRun = result.status === 'dry-run' || setup.switches.dryRun === true;
  const plan = planView(result, setup);
  if (dryRun) {
    return {
      body: plan.body,
      exit: exitForRun(runFacts(result, { ...setup.switches, dryRun: true }, setup.config)).exit,
      lines: plan.lines,
    };
  }

  const files = [
    ...result.files,
    { path: 'forge.config.json', bytes: new TextEncoder().encode(configArtifact(setup.config)) },
  ];
  let written: readonly string[] = [];
  let skipped: readonly string[] = [];
  const clean = result.status === 'complete' && result.diagnostics.summary.errors === 0;
  // Only a clean run writes: see the module header.
  if (clean) {
    try {
      const outcome = writeOut({
        files,
        ...(setup.filter === undefined ? {} : { filter: setup.filter }),
        root: setup.absoluteOut,
        shouldStop: () => cancel.cancelled,
      });
      written = outcome.written;
      skipped = outcome.skipped;
    } catch (cause) {
      if (cause instanceof WriteCancelled) {
        return {
          body: { cancelReason: cancel.reason, rolledBack: true },
          exit: EXIT.failed,
          lines: [`cancelled: ${cause.message}`],
        };
      }
      // A build that could not write its own output is not the input's fault, and it is not our bug either: an
      // unwritable directory is the environment refusing, which is `CMP-R029`'s exit 2 class.
      const message = cause instanceof Error ? cause.message : String(cause);
      return {
        body: { writeError: message },
        exit: EXIT.unreadable,
        lines: [`error: could not write ${setup.outDir}: ${message}`],
      };
    }
  } else {
    skipped = clean ? [] : files.map((file) => file.path);
  }

  const decision = exitForRun(runFacts(result, setup.switches, setup.config));
  const lines: string[] = [
    `${setup.input.name}: ${runSummary(result)}`,
    ...(written.length === 0
      ? clean
        ? ['nothing was written']
        : [
            `nothing written: ${result.status === 'complete' ? `${result.diagnostics.summary.errors} error diagnostic(s)` : `the run ${result.status}`}${result.cancelReason === null ? '' : ` (${result.cancelReason})`}`,
          ]
      : [`wrote ${written.length} file(s) to ${setup.outDir} (${formatSize(totalBytes(files, written))})`]),
    ...(skipped.length === 0
      ? []
      : [
          `${skipped.length} file(s) not written${request.invocation.flags.has('--report-only') ? ' (--report-only)' : ''}`,
        ]),
    ...(result.diagnostics.items.length === 0
      ? []
      : ['', 'diagnostics:', ...diagnosticRows(result.diagnostics.items).text]),
    ...plan.lines.slice(3),
  ];
  // A non-zero exit is printed with the rule that chose it, and under `--quiet` it is the only line: `CMP-R029`'s
  // numbers tell a CI which class of thing happened, and "exit 4" without "you set --max-warnings=0" is a riddle.
  if (decision.exit !== EXIT.ok && decision.reason !== null) {
    lines.push(`verdict: exit ${decision.exit} — ${decision.reason}`);
  }
  return {
    body: {
      config: configToJson(setup.config),
      configSource: setup.configSource,
      files: written,
      input: { bytes: setup.input.bytes.length, file: setup.input.name },
      inert: inert.map((entry) => ({ name: entry.name, reason: entry.reason })),
      outDir: setup.outDir,
      ...runView(result),
      skipped,
    },
    exit: decision.exit,
    lines,
  };
}

function totalBytes(files: readonly { path: string; bytes: Uint8Array }[], written: readonly string[]): number {
  const done = new Set(written);
  return files.filter((file) => done.has(file.path)).reduce((sum, file) => sum + file.bytes.length, 0);
}

/**
 * What a crash leaves behind. The input's hash and size let a maintainer ask for the file without guessing which
 * of a dozen `.swf`s in a folder was the one; the tool version is what `build-info.json` would have carried.
 */
export function crashReport(input: { readonly name: string; readonly bytes: Uint8Array }, stack: string): string {
  return [
    `${TOOL_NAME} ${TOOL_VERSION} crashed`,
    `input: ${input.name}`,
    `input bytes: ${input.bytes.length}`,
    '',
    stack,
    '',
  ].join('\n');
}
