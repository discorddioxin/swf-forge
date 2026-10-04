/**
 * Exit codes and the output sink every verb writes through (`CMP-R029`).
 *
 * Kept in its own module so a verb never has to import the dispatcher that imports the verb.
 */
export const EXIT = {
  ok: 0,
  /** Error-severity diagnostics. */
  failed: 1,
  /** Input unreadable, or not a SWF. */
  unreadable: 2,
  /** AVM2 content (`SF1000`). */
  avm2: 3,
  /** A budget or `--fail-on` threshold was exceeded. */
  threshold: 4,
  /** Internal error: a bug in this program, reported with the input that triggered it. */
  internal: 5,
  /** `clean` only: the project is not cleanable (`CLN` §6). */
  notCleanable: 6,
} as const;

export interface CliIo {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
}
