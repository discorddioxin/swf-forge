/**
 * The shared projections: one row set per kind of data, rendered twice.
 *
 * `IMPL-120-R025`'s "plain text MUST be the human-readable projection of the same data" is only worth the words
 * if a command cannot produce a table for stdout and a different object for `--json`. So every verb builds its
 * rows here or in its own module as `{data, text}` pairs and never as a printed sentence: the `text` half is the
 * row with its values formatted, the `data` half is the row with its values still typed, and a test that changes
 * one and not the other fails. The alternative — building a string and then re-parsing it for JSON — is how a CLI
 * ends up with a `--json` mode whose numbers are the ones some `toFixed` produced.
 *
 * `tableView` pads for a terminal. Alignment is deliberately *not* part of any file the build writes: a golden
 * fixture of an aligned table is a fixture that breaks when a stage id grows a letter.
 */

import type { JsonObject, PassRunReport, RunResult, StageReport } from '@swf-forge/compile';

import { diagnosticRows } from './json.js';

export interface View {
  readonly data: readonly JsonObject[];
  readonly text: readonly string[];
}

export function rows<T>(items: readonly T[], project: (item: T) => JsonObject, render: (item: T) => string[]): View {
  const data = items.map(project);
  const text = items.flatMap(render);
  return { data, text };
}

/** `id status files cache` — what the run did, per stage, in `CMP-§2`'s order. */
export function stageView(stages: readonly StageReport[]): View {
  return rows(
    stages,
    (stage) => ({
      cache: stage.cacheKey === null ? null : stage.cacheKey.slice(0, 12),
      ...(stage.cacheEvicted === undefined ? {} : { cacheEvicted: stage.cacheEvicted }),
      ...(stage.cacheVerified === undefined ? {} : { cacheVerified: stage.cacheVerified }),
      effects: { reads: stage.effects.reads.length, writes: stage.effects.writes.length },
      ...(stage.error === undefined ? {} : { error: `${stage.error.name}: ${stage.error.message}` }),
      files: stage.files,
      id: stage.id,
      ...(stage.stopReason === undefined ? {} : { stopReason: stage.stopReason }),
      status: stage.status,
    }),
    (stage) => {
      // `cache:hit` for a stage that did not run, `cache:stored` for one that ran and was worth storing. They are
      // opposite facts, and printing either for the other is how a cache log becomes a document nobody believes.
      const cache =
        stage.status === 'cached'
          ? ' cache:hit'
          : stage.cacheVerified === 'match'
            ? ' cache:verified'
            : stage.cacheVerified === 'drift'
              ? ' cache:drift'
              : stage.cacheKey === null
                ? ''
                : ' cache:stored';
      const suffix = [
        cache,
        stage.cacheEvicted === undefined ? '' : ` cache-evicted (${stage.cacheEvicted})`,
        stage.error === undefined ? '' : ` ERROR ${stage.error.name}: ${stage.error.message}`,
        stage.stopReason === undefined ? '' : ` stop: ${stage.stopReason}`,
      ].join('');
      return [`  ${stage.id.padEnd(8)} ${stage.status.padEnd(16)} ${String(stage.files).padStart(4)} file(s)${suffix}`];
    },
  );
}

/** `id status decisions` — the post-model passes, including the ones nothing supplies. */
export function passView(passes: readonly PassRunReport[]): View {
  return rows(
    passes,
    (pass) => ({
      decisions: pass.decisions,
      ...(pass.error === undefined ? {} : { error: `${pass.error.name}: ${pass.error.message}` }),
      id: pass.id,
      status: pass.status,
    }),
    (pass) => [
      `  ${pass.id.padEnd(14)} ${pass.status.padEnd(14)} ${String(pass.decisions).padStart(4)} decision(s)${
        pass.error === undefined ? '' : ` ERROR ${pass.error.name}: ${pass.error.message}`
      }`,
    ],
  );
}

/** What one run is, in the shape every verb that runs the pipeline puts in its envelope. */
export function runView(result: RunResult): JsonObject {
  return {
    cancelReason: result.cancelReason,
    diagnostics: {
      errors: result.diagnostics.summary.errors,
      infos: result.diagnostics.summary.infos,
      items: diagnosticRows(result.diagnostics.items).data,
      total: result.diagnostics.summary.total,
      warnings: result.diagnostics.summary.warnings,
    },
    files: result.files.map((file) => ({ bytes: file.bytes.length, path: file.path })),
    outputBytes: result.files.reduce((sum, file) => sum + file.bytes.length, 0),
    passes: passView(result.passes).data,
    stages: stageView(result.stages).data,
    status: result.status,
  };
}

/** A run's headline line, used by every verb so "the build did X" reads the same in all three places. */
export function runSummary(result: RunResult): string {
  const summary = result.diagnostics.summary;
  return [
    `status: ${result.status}`,
    `${result.files.length} file(s), ${formatSize(result.files.reduce((sum, file) => sum + file.bytes.length, 0))}`,
    `${summary.errors} error(s), ${summary.warnings} warning(s), ${summary.infos} info diagnostic(s)`,
  ].join(', ');
}

/** Aligned columns for a terminal, from rows that are already strings. */
export function tableView(header: readonly string[], body: readonly (readonly string[])[]): readonly string[] {
  if (body.length === 0) return [];
  const widths = header.map((label, index) =>
    Math.max(label.length, ...body.map((line) => (line[index] ?? '').length)),
  );
  const line = (cells: readonly string[]): string =>
    cells
      .map((cell, index) => (cell ?? '').padEnd(widths[index] ?? 0))
      .join('  ')
      .trimEnd();
  return [line(header), widths.map((width) => '-'.repeat(width)).join('  '), ...body.map(line)];
}

/**
 * A size for a terminal. Display-only — never written into a file the build produces, where a byte count is
 * printed as an integer so a fixture diff stays exact (`REPO-R015`).
 */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`;
}
