#!/usr/bin/env node
/**
 * The bin (`swfforge`). Six responsibilities, and the file is short because everything else lives behind them.
 *
 * **`process.exitCode`, never `process.exit`.** `exit` truncates a piped stdout: the writer is async, and a
 * process that exits while bytes are in flight loses them. That is exactly the failure a CI log shows as a
 * half-printed `--json` payload, and it is why this CLI keeps the event loop's own shutdown order.
 *
 * **SIGINT, once and twice.** The pipeline is synchronous, so a signal handler can only run when the stack unwinds
 * to the loop — which means a Ctrl-C during a build is observed at the next write boundary, and the run reports
 * itself cancelled rather than half-written. Installing a listener also takes over the default action, so the
 * second Ctrl-C is the escape hatch: it exits `130`, the shell's convention for "died of SIGINT", rather than
 * pretending to be one of `CMP-R029`'s verdicts — and it says out loud that the write rollback was skipped.
 *
 * **Stdio that survives `| head`.** Both writers are made by `stdio.ts`, which absorbs the `EPIPE` a closed
 * reader produces; without it the first CLI in this repository that printed a long report into `head` died with an
 * error stack, which is a crash on the reader's behaviour rather than the tool's.
 *
 * **Nothing here reads the environment.** No colour, no `NO_COLOR`, no `$FORGE_CONFIG`, and no `cwd` but
 * `process.cwd()` — `IMPL-120-R021`'s "no environment reads" rule is what makes a cache key mean the same thing on
 * a laptop and a runner. The one exception in the package is the report's host-name leak check, which reads
 * `os.hostname()` because finding that name is its job (`run.ts`).
 *
 * **A module-level guard, so the entry point is testable.** `main()` is a function over `argv` and a `cwd`; the
 * line that runs it checks the process's own script name first. Without that check, `import { main } from
 * '../src/index.js'` in a test file would execute a real invocation with vitest's arguments, which is a
 * self-inflicted version of the bug every "importable CLI" has: the tests for a tool are the tool running itself.
 */

import { createCancellationToken } from '@swf-forge/compile';

import { runCli } from './cli.js';
import { EXIT, type CliIo } from './exit.js';
import { stdioWriter } from './stdio.js';
import { TOOL_NAME } from './version.js';

/** The shell's convention for a process that died to SIGINT, and the only code here that is not `CMP-R029`'s. */
export const KILLED_BY_INTERRUPT = 130;

/**
 * One CLI invocation, with the interrupt handling that only a process owns.
 *
 * `io` is injectable so a test can call `main(['--version'])` and read what the bin would have printed; the
 * default is the real stdout/stderr, and it is the only place in the package that names them.
 */
export async function main(
  argv: readonly string[] = process.argv.slice(2),
  cwd: string = process.cwd(),
  io: CliIo = { err: stdioWriter(process.stderr), out: stdioWriter(process.stdout) },
): Promise<number> {
  const cancel = createCancellationToken();
  const onInterrupt = (): void => {
    if (cancel.cancelled) {
      // The polite interrupt has already been requested and the run is still going, so this one means "stop now".
      // `process.exit` is the only thing that can pre-empt a synchronous stage, and it skips the write rollback:
      // files already renamed are complete (the writer never leaves a half-written file), but the project may be
      // missing the files that had not been reached. That is the trade a second Ctrl-C is asking for.
      io.err(
        `${TOOL_NAME}: exiting on the second SIGINT without rolling back; files already written are complete, the project may be incomplete`,
      );
      process.exit(KILLED_BY_INTERRUPT);
    }
    cancel.cancel('SIGINT');
    io.err(
      `${TOOL_NAME}: interrupt received — finishing the current step, then writing nothing. Press Ctrl-C again to kill.`,
    );
  };
  process.once('SIGINT', onInterrupt);
  try {
    const code = await runCli({ argv, cwd, io });
    return code;
  } finally {
    process.removeListener('SIGINT', onInterrupt);
  }
}

/** True when this module is the script Node was pointed at, i.e. someone ran the bin. */
export function invokedAsBin(argv: readonly string[] = process.argv): boolean {
  const entry = argv[1];
  return entry !== undefined && /(^|[/\\])main\.(?:js|mjs|cjs|ts)$/u.test(entry);
}

if (invokedAsBin()) {
  void main().then(
    (code) => {
      process.exitCode = code === EXIT.ok ? 0 : code;
    },
    (cause: unknown) => {
      // Reaching here is a fault in the CLI: every input and disk error is caught by a command. Node's default
      // for a rejection is exit 1, which in this tool means "the build reported errors" — the wrong report to file.
      stdioWriter(process.stderr)(cause instanceof Error ? (cause.stack ?? cause.message) : String(cause));
      process.exitCode = EXIT.internal;
    },
  );
}
