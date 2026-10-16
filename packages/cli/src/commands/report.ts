/**
 * `swfforge report` — a printer over the report files a build left behind.
 *
 * It reads `build-info.json` and `divergence.json` rather than re-running the pipeline, for the reason `IMPL-120`
 * §6 gives the verb: the question is usually "what did the build I just ran decide", and an answer from a second
 * run is a different measurement — it can disagree with the project on disk if the tree or the tool changed
 * between the two, and then the report is a rumour about the build instead of a record of it.
 *
 * So `report` is a printer, not a judge. The exit codes it can return are `CMP-R029`'s `0` and `2`: `2` when the
 * files it was pointed at are missing or do not parse, because that is the same class as an unreadable input, and
 * `0` otherwise. A build's own verdict is in the exit code the build returned and in `verify`'s findings; a report
 * that re-derived them from a JSON file would be a second, weaker copy of both, and the two would drift.
 *
 * `--budgets` and `--divergence` select a section. Both can print a *withheld* list, and the withheld list is the
 * interesting output: `budgetSummary.withheld` is the record that `WP-120-07` has not produced budget lines yet,
 * and printing it is what stops a reader from concluding "the numbers are fine" from an empty table.
 */

import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type { JsonObject } from '@swf-forge/compile';

import type { Invocation } from '../args.js';
import type { CommandContext, CommandResult } from '../context.js';
import { EXIT } from '../exit.js';
import { insideOutDir } from '../config.js';
import { formatSize, tableView } from '../view.js';

interface ReadResult {
  readonly error?: string;
  readonly key?: string;
  readonly value?: JsonObject;
}

function readJson(root: string, key: string): ReadResult {
  const path = `${key}.json`;
  if (!insideOutDir(root, path)) return { error: `${path}: not a path inside the project`, key };
  const target = resolve(root, path);
  if (!existsSync(target))
    return {
      error: `${path} is missing — this directory is not a swfforge project, or the build did not complete`,
      key,
    };
  try {
    const parsed: unknown = JSON.parse(readFileSync(target, 'utf8')) as unknown;
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed))
      return { error: `${path} is not a JSON object`, key };
    return { key, value: parsed as JsonObject };
  } catch (cause) {
    return { error: `${path} does not parse: ${cause instanceof Error ? cause.message : String(cause)}`, key };
  }
}

/** A scalar leaf of a nested object, for the one-line tables. Objects deeper than that are summarised, not dumped. */
function scalarRows(value: JsonObject | undefined, prefix: string): readonly (readonly [string, string])[] {
  if (value === undefined) return [];
  const rows: (readonly [string, string])[] = [];
  for (const key of Object.keys(value).sort()) {
    const node = value[key];
    const label = prefix === '' ? key : `${prefix}.${key}`;
    if (node === null || typeof node !== 'object') {
      rows.push([label, String(node)]);
      continue;
    }
    if (Array.isArray(node)) {
      rows.push([
        label,
        node
          .map((item) => (item === null || typeof item !== 'object' ? String(item) : JSON.stringify(item)))
          .join(', '),
      ]);
      continue;
    }
    rows.push(...scalarRows(node as JsonObject, label));
  }
  return rows;
}

export async function reportCommand(
  // `report` has nothing to print outside its own lines, so the context is unused by design: printing through it
  // would put `--quiet` handling in two places.
  _ctx: CommandContext,
  request: { readonly cwd: string; readonly invocation: Invocation },
): Promise<CommandResult> {
  const dir = request.invocation.files[0] ?? '.';
  const root = resolve(request.cwd, dir);
  const wanted = request.invocation.flags.has('--budgets')
    ? ['build-info']
    : request.invocation.flags.has('--divergence')
      ? ['divergence']
      : ['build-info', 'divergence', 'porting-notes'];
  const documents = new Map<string, JsonObject>();
  const errors: string[] = [];
  for (const key of wanted) {
    const read = readJson(root, key);
    if (read.error !== undefined) {
      // Only the files the reader asked for are required: `--divergence` works on a project whose notes were not
      // written, and `report` over a whole project reports every file it could not read at once.
      errors.push(read.error);
      continue;
    }
    documents.set(key, read.value as JsonObject);
  }
  if (errors.length > 0) {
    return { body: { errors }, exit: EXIT.unreadable, lines: errors.map((error) => `error: ${error}`) };
  }
  const buildInfo = documents.get('build-info');
  const lines: string[] = [`${dir}: swfforge report`];
  const input = buildInfo?.['input'];
  if (input !== null && typeof input === 'object' && input !== undefined) {
    const row = input as JsonObject;
    lines.push(
      `  input   ${String(row['file'] ?? '?')} (${formatSize(Number(row['bytes'] ?? 0))}), sha256 ${String(row['sha256'] ?? '?').slice(0, 16)}…`,
    );
  }
  const output = buildInfo?.['output'];
  if (output !== null && typeof output === 'object' && output !== undefined) {
    const row = output as JsonObject;
    lines.push(`  output  ${String(row['files'] ?? 0)} file(s), ${formatSize(Number(row['bytes'] ?? 0))}`);
    const manifest = row['manifest'];
    if (manifest !== null && typeof manifest === 'object' && manifest !== undefined) {
      const withheld = (manifest as JsonObject)['withheldSections'];
      lines.push(
        `  manifest ${String((manifest as JsonObject)['artifacts'] ?? 0)} artifact(s)${
          Array.isArray(withheld) && withheld.length > 0 ? `, withheld: ${withheld.join(', ')}` : ''
        }`,
      );
    }
  }
  for (const [key, value] of [...documents].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    if (key === 'build-info') continue;
    // Field counts, not a dump: the file is the dump, and a report that re-prints it invents a second format for
    // the same data that nothing will keep in step.
    const entries = value['entries'];
    lines.push(
      `  ${key}: ${Array.isArray(entries) ? `${entries.length} declared entr${entries.length === 1 ? 'y' : 'ies'}, ` : ''}${Object.keys(value).length} top-level field(s)`,
    );
  }
  const budget = buildInfo?.['budgetSummary'];
  if (budget !== null && typeof budget === 'object' && budget !== undefined) {
    const rows = scalarRows(budget as JsonObject, '');
    lines.push(
      '',
      'budgets:',
      ...tableView(
        ['value', 'note'],
        rows.map(([label, value]) => [label, value]),
      ).map((line) => `  ${line}`),
    );
  }
  const divergence = documents.get('divergence');
  const entries = divergence?.['entries'];
  if (Array.isArray(entries)) {
    lines.push(
      '',
      'divergences:',
      ...tableView(
        ['decision', 'kind', 'detail'],
        entries.map((entry) => {
          const row: JsonObject = entry === null || typeof entry !== 'object' ? {} : (entry as JsonObject);
          return [
            String(row['decision'] ?? '?'),
            String(row['kind'] ?? row['divergence'] ?? ''),
            String(row['detail'] ?? row['summary'] ?? ''),
          ];
        }),
      ).map((line) => `  ${line}`),
    );
  }
  const gates = buildInfo?.['gates'];
  if (gates !== null && typeof gates === 'object' && gates !== undefined) {
    lines.push('', `gates: ${Object.keys(gates as JsonObject).length} recorded (resolved config and run switches)`);
  }
  const decisions = buildInfo?.['decisions'];
  if (decisions !== null && typeof decisions === 'object' && decisions !== undefined) {
    lines.push(`decisions: ${String((decisions as JsonObject)['count'] ?? 0)} recorded by the passes`);
  }
  if (buildInfo?.['pins'] !== undefined) {
    const pins = buildInfo['pins'];
    lines.push(
      `pins: ${pins === null || typeof pins !== 'object' ? String(pins) : 'withheld' in (pins as JsonObject) ? 'withheld' : 'declared'}`,
    );
  }
  return {
    body: {
      documents: Object.fromEntries([...documents].sort((a, b) => (a[0] < b[0] ? -1 : 1))),
      project: dir,
    },
    exit: EXIT.ok,
    lines,
  };
}
