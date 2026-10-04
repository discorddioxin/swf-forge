/**
 * Diagnostic model — `IMPL-010` §7 (`IMPL-010-R041`).
 *
 * Every diagnostic carries code, severity, message, absolute offset, context and — where the parser
 * knows them — the character id, tag code and the design decision that governs the behaviour.
 */

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  /** `SF####`, from the registry in `codes.ts`. */
  readonly code: 'SF0001' | `SF${number}`;
  readonly severity: Severity;
  /** One sentence, no trailing period. */
  readonly message: string;
  /** Absolute offset in the *decompressed* body (or in the input file for container-level facts). */
  readonly offset: number;
  /** Enclosing structure, e.g. `"RECT in FrameSize"`. */
  readonly context: string;
  readonly characterId?: number;
  readonly tagCode?: number;
  /** Design decision id that explains the tolerance, e.g. `"SWF-R009"`. */
  readonly decision?: string;
  /** How many times the same (code, context, characterId) triple was reported. */
  readonly count: number;
}

/** A diagnostic before the sink has folded repeats into it. */
export type DiagnosticInput = Omit<Diagnostic, 'count'>;

export interface DiagnosticSummary {
  readonly errors: number;
  readonly warnings: number;
  readonly infos: number;
  readonly total: number;
}
