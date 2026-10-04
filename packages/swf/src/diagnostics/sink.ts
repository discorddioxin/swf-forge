/**
 * Diagnostic sink — `IMPL-010-R041`/`R042`, `CMP-R030` (stable ordering).
 *
 * One sink per parse. Diagnostics are emitted in the order they are found; repeats of the same
 * `(code, context, characterId)` triple are folded into the first entry with an incrementing count so
 * a file with 40 000 bad strings produces one line.
 */

import type { Diagnostic, DiagnosticInput, DiagnosticSummary, Severity } from './types.js';

function keyOf(d: DiagnosticInput): string {
  return `${d.code}\u0000${d.context}\u0000${d.characterId ?? ''}`;
}

export class DiagnosticSink {
  readonly #items: Diagnostic[] = [];
  readonly #index = new Map<string, number>();

  emit(input: DiagnosticInput): void {
    const key = keyOf(input);
    const at = this.#index.get(key);
    if (at !== undefined) {
      const prior = this.#items[at];
      if (prior) {
        this.#items[at] = { ...prior, count: prior.count + 1 };
      }
      return;
    }
    this.#index.set(key, this.#items.length);
    this.#items.push({ ...input, count: 1 });
  }

  /** All diagnostics, in discovery order. */
  list(): readonly Diagnostic[] {
    return this.#items;
  }

  summary(): DiagnosticSummary {
    let errors = 0;
    let warnings = 0;
    let infos = 0;
    for (const d of this.#items) {
      if (d.severity === 'error') errors += 1;
      else if (d.severity === 'warning') warnings += 1;
      else infos += 1;
    }
    return { errors, warnings, infos, total: this.#items.length };
  }

  has(severity: Severity): boolean {
    return this.#items.some((d) => d.severity === severity);
  }

  /** Codes present, sorted — used by reports and by the harness's code-range assertions. */
  codes(): readonly string[] {
    return [...new Set(this.#items.map((d) => d.code))].sort();
  }
}
