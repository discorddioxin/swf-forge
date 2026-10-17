/**
 * Exit codes and the output sink every verb writes through (`CMP-R029`).
 *
 * The table is the design spec's, and deliberately the same one `apps/decompiler/src/exit.ts` implements: `0`
 * success, `1` error diagnostics, `2` unreadable input, `3` AVM2 content, `4` a threshold exceeded, `5` our bug.
 * `IMPL-120-R026` printed a different set of meanings for `1`, `4` and `5` — "1 build failure (our bug) … 4 external
 * tool missing; 5 budget exceeded under `--budget-strict`" — and `errata.md` `E-053` records the contradiction.
 * Two commands in one repository cannot disagree about what `1` means, so `swfforge` follows the normative table
 * and keeps the impl doc's semantics that do not collide with it: a budget overrun under `--budget-strict` *is*
 * reported, it just lands in `4`, the threshold class, rather than in a fifth code.
 *
 * The precedence order below is the part the spec does not state and a caller depends on. A crash outranks
 * everything, because a run that threw is a bug we have to see even when the input was also bad; an unreadable
 * input outranks AVM2, because "not a SWF" explains why we never learned it was AVM2; AVM2 outranks ordinary
 * errors, because `CMP-R031` calls the refusal itself the point; and a threshold outranks nothing, because
 * warnings only matter once the build is otherwise sound.
 */

/** `CMP-R029`. The numbers are the CLI's contract, so they are named as data and tested, never inlined. */
export const EXIT = {
  ok: 0,
  /** An `error`-severity diagnostic, an `error`-severity `verify` finding, or a cancelled run. */
  failed: 1,
  /** Input unreadable, not a SWF, or a config file that does not parse. Also usage errors. */
  unreadable: 2,
  /** AVM2 content (`SF1000`). */
  avm2: 3,
  /** A budget or `--fail-on`/`--max-warnings` threshold was exceeded. */
  threshold: 4,
  /** Internal error: a bug in this program, reported with the input that triggered it. */
  internal: 5,
} as const;

export interface CliIo {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}

/** The severity floor `--fail-on` names. `risk` has no referent: the registry defines three severities. */
export type FailOn = 'error' | 'warning' | 'risk';

export interface RunFacts {
  /** `null` when the run never started: the input or the config was unusable. */
  readonly status: 'complete' | 'dry-run' | 'refused' | 'failed' | 'cancelled' | null;
  /** The run's diagnostic rows. `count` is the sink's repeat counter, and defaults to one row = one occurrence. */
  readonly diagnostics: readonly { readonly code: string; readonly count?: number; readonly severity: string }[];
  readonly failOn: FailOn;
  readonly maxWarnings: number;
  /** True when `--budget-strict` is on and a budget line exceeded its target. */
  readonly budgetExceeded: boolean;
  /** Why the run crashed, when it crashed: our bug, reported with a crash bundle. */
  readonly internal: string | null;
  /** Why the input could not be used, when it could not. */
  readonly unreadable: string | null;
  /**
   * True when the stage that failed was `read`. That is the difference between "your file is not a SWF" (exit 2,
   * the input's class) and "the compiler stopped working" (exit 1): both arrive as a failed stage, and only the
   * stage id says which one a caller should file.
   */
  readonly readFailed: boolean;
}

export interface ExitDecision {
  readonly exit: number;
  /** The one-line reason printed under `--verbose`, so a caller can see which rule chose the code. */
  readonly reason: string | null;
}

const AVM2_CODE = 'SF1000';

/** `@swf-forge/swf`'s "these bytes are not a SWF" code, which `CMP-R029` puts in class 2 by name. */
const NOT_SWF_CODE = 'SF0001';

/**
 * The run's outcome as `CMP-R029` reads it.
 *
 * `--fail-on=warning` promotes warnings into the threshold class rather than into errors: `CMP` §9.2 says a
 * `--fail-on` value "promotes", and a promoted warning is not an `error` diagnostic, so reporting it as exit 1
 * would tell a porter their build is broken when the build is fine and a knob was turned.
 */
export function exitForRun(facts: RunFacts): ExitDecision {
  if (facts.internal !== null) return { exit: EXIT.internal, reason: facts.internal };
  if (facts.unreadable !== null) return { exit: EXIT.unreadable, reason: facts.unreadable };
  const codes = new Set(facts.diagnostics.map((entry) => entry.code));
  if (facts.status === 'refused' || codes.has(AVM2_CODE)) {
    return {
      exit: EXIT.avm2,
      reason: `${AVM2_CODE}: the input carries AVM2 content, which this compiler does not target`,
    };
  }
  if (facts.status === 'cancelled')
    return { exit: EXIT.failed, reason: 'the run was cancelled and nothing was written' };
  if (facts.readFailed) {
    return { exit: EXIT.unreadable, reason: 'the read stage could not parse the input, so it is not a buildable SWF' };
  }
  if (facts.status === 'failed') {
    const message = facts.diagnostics.find((entry) => entry.severity === 'error')?.code;
    return { exit: EXIT.failed, reason: `a stage failed${message === undefined ? '' : ` after reporting ${message}`}` };
  }
  const errors = facts.diagnostics.filter((entry) => entry.severity === 'error').length;
  if (errors > 0 && codes.has(NOT_SWF_CODE)) {
    // The reader recovered from a file with no SWF signature and the run went on to finish; only the diagnostic
    // says the "movie" was never a movie. Class 1 would tell a porter the compiler is broken about their file.
    return {
      exit: EXIT.unreadable,
      reason: `${NOT_SWF_CODE}: the input is not a SWF, so the project it produced is empty`,
    };
  }
  if (errors > 0) return { exit: EXIT.failed, reason: `${errors} error diagnostic(s)` };
  // A budget is measured in **occurrences**, not in rows. The sink folds a repeated diagnostic into one row with a
  // `count`, which is what makes a printable table out of a fuzz input that warns 92,680 times about one 52-byte
  // file (`E-055`) — and a limit compared against the row count would call that run within budget. The two numbers
  // are printed together below, because a porter who sees "6 warning(s)" and an exit 4 is reading a riddle.
  const warnings = occurrences(facts.diagnostics, 'warning');
  if (facts.failOn === 'warning' && warnings > 0) {
    return {
      exit: EXIT.threshold,
      reason: `--fail-on=warning and the run reported ${warnings} warning occurrence(s) in ${rows(facts.diagnostics, 'warning')} row(s)`,
    };
  }
  // The limit is read literally — `0` means every warning is fatal — which is why `DEFAULT_FORGE_CONFIG` holds
  // `CMP` §8's 200 rather than a 0 that would make the default outcome of any build with one warning an exit 4.
  if (warnings > facts.maxWarnings) {
    return {
      exit: EXIT.threshold,
      reason: `--max-warnings=${facts.maxWarnings} exceeded (${warnings} occurrence(s) in ${rows(facts.diagnostics, 'warning')} row(s))`,
    };
  }
  if (facts.budgetExceeded)
    return { exit: EXIT.threshold, reason: 'a budget line exceeded its target under --budget-strict' };
  return { exit: EXIT.ok, reason: null };
}

/** How many times a severity actually happened, counting the sink's repeat counter. */
function occurrences(items: RunFacts['diagnostics'], severity: string): number {
  return items.reduce((total, item) => (item.severity === severity ? total + (item.count ?? 1) : total), 0);
}

/** How many rows a severity occupies, which is the number the printed table shows. */
function rows(items: RunFacts['diagnostics'], severity: string): number {
  return items.filter((item) => item.severity === severity).length;
}

/** A `verify` finding is not a build diagnostic, but it is the same class of failure: 1 for errors, else 0. */
export function exitForVerify(errors: number): ExitDecision {
  if (errors > 0) return { exit: EXIT.failed, reason: `${errors} verify finding(s) at error severity` };
  return { exit: EXIT.ok, reason: null };
}

/** The code a *usage* problem gets — the same class as an unreadable input, because the caller's typed path or flag is what is wrong. */
export const USAGE_EXIT = EXIT.unreadable;

/**
 * The facts `exitForRun` reads off one run, assembled once so no two verbs can disagree about a verdict.
 *
 * `budgetExceeded` is `false` here and stays `false` for all of P6: a budget verdict needs `budgets.json`, which
 * `WP-120-07` owns, and the report stage's own `BUDGETS_WITHHELD` list is the record that nothing computes it yet.
 * A flag that can never be satisfied is worse than a flag that says so, so `--budget-strict` is carried into
 * `build-info.json`'s gates (where a porter can see it was on) rather than being given a fake verdict here.
 */
export function runFacts(
  result: {
    readonly status: 'complete' | 'dry-run' | 'refused' | 'failed' | 'cancelled';
    readonly diagnostics: {
      readonly items: readonly { readonly code: string; readonly count?: number; readonly severity: string }[];
    };
    readonly stages: readonly { readonly id: string; readonly status: string }[];
  },
  switches: { readonly dryRun?: boolean },
  config: { readonly diagnostics: { readonly failOn: FailOn; readonly maxWarnings: number } },
  extra: { readonly internal?: string | null; readonly unreadable?: string | null } = {},
): RunFacts {
  return {
    budgetExceeded: false,
    diagnostics: result.diagnostics.items,
    readFailed: result.stages.some((stage) => stage.id === 'read' && stage.status === 'failed'),
    failOn: config.diagnostics.failOn,
    internal: extra.internal ?? null,
    maxWarnings: config.diagnostics.maxWarnings,
    // `--dry-run` is a run that completed without writing, which is the status the runner reports when it skips
    // everything after `plan`; the `switches` copy covers a caller that set the switch without a status to match.
    status: switches.dryRun === true && result.status === 'complete' ? 'dry-run' : result.status,
    unreadable: extra.unreadable ?? null,
  };
}

/**
 * The worse of two exit codes, by `CMP-R029`'s precedence rather than by size.
 *
 * `inspect` over several files has to combine several verdicts, and the largest number is the wrong answer: a run
 * that both hit a threshold (4) and crashed (5) has a crash to report, while a run that hit an unreadable input (2)
 * and a threshold (4) has a *threshold* nobody asked about — the unreadable file is the reason nothing else could
 * be said, and it is the fact the caller needs. So the order is the one `exitForRun` already implements, spelled
 * out here as a table because two places deriving it separately is how a CLI ends up with codes that depend on
 * argument order.
 */
const PRECEDENCE: readonly number[] = [EXIT.internal, EXIT.unreadable, EXIT.avm2, EXIT.failed, EXIT.threshold, EXIT.ok];

export function worseExit(a: number, b: number): number {
  const rank = (code: number): number => {
    const index = PRECEDENCE.indexOf(code);
    return index === -1 ? PRECEDENCE.length : index;
  };
  return rank(a) <= rank(b) ? a : b;
}
