/**
 * What a command is allowed to assume, and the only channels it may write to.
 *
 * Every verb takes this object instead of touching `process`, which is what makes the CLI testable in one place:
 * a test calls `runCli(['build', file, '--out', dir], io, cwd)` and asserts on the collected lines and the returned
 * code, with no child process, no pipe buffering, and no dependency on how fast the machine is. The trade is that
 * the object has to be threaded through every function, and that is the cheaper problem.
 *
 * A command never calls `process.exit`: it returns its lines and its verdict, and `cli.ts` joins them. A verb that
 * exited itself could not report two inputs' problems (which `inspect` must), and could not be tested without
 * killing the test runner.
 */

import type { JsonObject } from '@swf-forge/compile';

import type { CliIo } from './exit.js';

export interface CommandContext extends CliIo {
  readonly cwd: string;
  /** `--json`: the payload goes to stdout as one envelope, the human lines are suppressed. */
  readonly json: boolean;
  /** The verbosity level: `1` prints the resolved config, `2` and above add per-stage detail. */
  readonly verbose: number;
  /** `--quiet`: nothing but a failure. A checker's findings are not progress, so `verify` ignores this. */
  readonly quiet: boolean;
}

/**
 * A command's answer: the lines to print, the object to put in the `--json` envelope, and the verdict.
 *
 * `exit` is `null` for the verbs whose code follows from the run (`build`, `plan`, `inspect`), and a number for
 * the ones that are their own judge (`verify`, `report`) — so `CMP-R029`'s precedence lives in exactly one
 * function, `exitForRun`, and a command never re-derives it from the same facts a second time.
 */
export interface CommandResult {
  readonly lines: readonly string[];
  readonly body: JsonObject;
  readonly exit: number | null;
}
