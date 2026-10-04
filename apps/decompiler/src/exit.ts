/**
 * Exit codes, the output sink every verb writes through, and the diagnostics→code mapping
 * (`CMP-R029`).
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

/**
 * `CMP-R029` mapped from the diagnostics a decode produced: an unreadable container wins over AVM2
 * content, which wins over ordinary errors.
 */
export function exitForDiagnostics(
  diagnostics: readonly { readonly code: unknown; readonly severity: string }[],
): number {
  const codes = new Set(diagnostics.map((d) => String(d.code)));
  if (codes.has('SF0001')) return EXIT.unreadable;
  if (codes.has('SF1000')) return EXIT.avm2;
  if (diagnostics.some((d) => d.severity === 'error')) return EXIT.failed;
  return EXIT.ok;
}
