/**
 * Dispatch: one entry point, one exit code, no `process` anywhere in this file.
 *
 * `runCli(argv, io, cwd)` is the whole CLI. `main.ts` is the six lines that make it a program, and every test
 * calls `runCli` directly — which is the only reason the crash handler, the SIGINT path and the stdout formats
 * are testable at all. The trade is that the io object has to reach every command, so the commands take a context
 * instead of printing; that indirection is also what lets a test assert on the exact line a threshold produced.
 *
 * Usage errors return `2` before anything is read (`CMP-R029`: "input unreadable", which is what a typo'd path
 * is). Help is `0`, including when it was reached by an unknown verb — a person who typed the wrong word and got
 * the verb list has been helped, and a CLI that answers help with a failure makes scripts that run `--help` in a
 * pipeline misbehave for no reason.
 */

import type { JsonObject } from '@swf-forge/compile';

import { VERBS, flagHelp, parseInvocation, type Invocation } from './args.js';
import type { CommandContext } from './context.js';
import { buildCommand } from './commands/build.js';
import { inspectCommand } from './commands/inspect.js';
import { planCommand } from './commands/plan.js';
import { reportCommand } from './commands/report.js';
import { verifyCommand } from './commands/verify.js';
import { EXIT, USAGE_EXIT, type CliIo } from './exit.js';
import { envelope } from './json.js';
import { TOOL_NAME, TOOL_VERSION } from './version.js';

/** One line per verb, so `--help` reads as a manual and not as a dump. */
const VERB_HELP: Readonly<Record<string, string>> = {
  build: 'swfforge build <in.swf> [--out DIR] [--report-only] [--dry-run] [flags]',
  inspect: 'swfforge inspect <in.swf>… [--tags] [--symbols] [--timeline] [--actions] [--strict]',
  plan: 'swfforge plan <in.swf> [--config FILE] [flags] — what a build would do, and it writes nothing',
  report: 'swfforge report [DIR] [--budgets | --divergence] — print the report files a build left behind',
  verify: 'swfforge verify [DIR] [--deep [--against DIR]] — check an emitted project',
};

export function usageText(): readonly string[] {
  return [
    `usage: ${TOOL_NAME} <command> [flags]`,
    '',
    'commands:',
    ...VERBS.map((verb) => `  ${VERB_HELP[verb] ?? verb}`),
    '',
    'flags:',
    ...flagHelp(),
    '',
    'Exit codes (CMP-R029): 0 ok, 1 error, 2 input unreadable or bad usage, 3 AVM2 content,',
    '4 budget or threshold exceeded, 5 internal error. A crash in a build also leaves a',
    `report naming the input it was given, at <out>/.${TOOL_NAME}-crash.txt; the read-only verbs`,
    'print the stack and write nothing at all.',
  ];
}

export interface CliRequest {
  readonly argv: readonly string[];
  readonly cwd: string;
  readonly io: CliIo;
}

function contextFor(io: CliIo, invocation: Invocation, cwd: string): CommandContext {
  return {
    cwd,
    err: io.err,
    json: invocation.flags.has('--json'),
    out: io.out,
    quiet: invocation.flags.has('--quiet'),
    verbose: invocation.verbose,
  };
}

/** Print a command's answer. Returns the code to exit with, which is the run's unless rendering failed. */
function emit(
  ctx: CommandContext,
  invocation: Invocation,
  verb: string,
  exit: number,
  result: { readonly lines: readonly string[]; readonly body: JsonObject },
): number {
  if (ctx.json) {
    const built = envelope(verb, exit, result.body);
    if ('text' in built) {
      ctx.out(built.text);
      return exit;
    }
    // A body this program built that it cannot render is a bug in this program, whatever the run decided — and
    // the run's verdict cannot be trusted to a stdout that is now an error message, so the code changes to 5.
    ctx.err(
      `${TOOL_NAME}: internal error (exit ${EXIT.internal}): the ${verb} output could not be rendered as JSON: ${built.error}`,
    );
    return EXIT.internal;
  }
  if (ctx.quiet && exit === EXIT.ok) return exit;
  for (const line of result.lines) ctx.out(line);
  if (invocation.verbose > 0 && result.body['config'] !== undefined) {
    ctx.out(`resolved config: ${JSON.stringify(result.body['config'])}`);
  }
  return exit;
}

/**
 * Run one invocation.
 *
 * A throw from a command is not a build failure — a stage that throws is recorded in the run result and turns
 * into exit 1 — so anything reaching here is a fault in the CLI itself: exit 5 with the stack, per `CMP-R029`.
 */
export async function runCli(request: CliRequest): Promise<number> {
  const invocation: Invocation = parseInvocation(request.argv);
  const io = request.io;
  if (invocation.flags.has('--version')) {
    io.out(`${TOOL_NAME} ${TOOL_VERSION}`);
    return EXIT.ok;
  }
  if (invocation.errors.length > 0 && invocation.verb !== null) {
    for (const error of invocation.errors) io.err(`${TOOL_NAME}: ${error}`);
    // An unknown verb has to see the verb list; telling someone to run `swfforge diff --help` when `diff` is not
    // a verb is a message that cannot be acted on.
    if (invocation.errors.some((error) => error.startsWith('unknown command'))) {
      for (const line of usageText()) io.out(line);
    } else {
      io.err(`run \`${TOOL_NAME} ${invocation.verb} --help\` for the flags`);
    }
    return USAGE_EXIT;
  }
  if (invocation.verb === null || invocation.flags.has('--help') || invocation.errors.length > 0) {
    for (const line of usageText()) io.out(line);
    for (const error of invocation.errors) io.err(`${TOOL_NAME}: ${error}`);
    return invocation.errors.length > 0 && !invocation.flags.has('--help') ? USAGE_EXIT : EXIT.ok;
  }

  const ctx = contextFor(io, invocation, request.cwd);
  try {
    const result =
      invocation.verb === 'build'
        ? await buildCommand(ctx, { cwd: request.cwd, invocation })
        : invocation.verb === 'plan'
          ? await planCommand(ctx, { cwd: request.cwd, invocation })
          : invocation.verb === 'inspect'
            ? await inspectCommand(ctx, { cwd: request.cwd, invocation })
            : invocation.verb === 'verify'
              ? await verifyCommand(ctx, { cwd: request.cwd, invocation })
              : await reportCommand(ctx, { cwd: request.cwd, invocation });
    // The exit code is decided before anything is printed, because `--json` puts the number inside the payload.
    const exit = result.exit ?? EXIT.ok;
    return emit(ctx, invocation, invocation.verb, exit, result);
  } catch (cause) {
    const stack = cause instanceof Error ? (cause.stack ?? cause.message) : String(cause);
    io.err(
      `${TOOL_NAME}: internal error (exit ${EXIT.internal}) — this is a bug in ${TOOL_NAME}, please report it with the input file and this stack:`,
    );
    for (const line of stack.split('\n')) io.err(line);
    return EXIT.internal;
  }
}
