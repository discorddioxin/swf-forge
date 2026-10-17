/**
 * `swfforge verify` — the checks over an emitted project (`IMPL-120-R024`, `CMP` §4.10).
 *
 * The checks live in `@swf-forge/compile/verify.ts`, which is pure on purpose; this command is the disk half: walk
 * a directory, hand the files over, fold the findings into `CMP-R029`'s codes. Two things are worth stating
 * because they are the two ways this command could quietly become worthless:
 *
 * **A missing check is reported, never skipped silently.** `verifyProject` returns `notRun` rows for the checks it
 * cannot perform here (the T2 validator, the budget file, `tsc --strict`), and this command prints them as its
 * first section, because a reviewer trusts the summary of a command that says what it did not look at.
 *
 * **`--deep` without a second build is a note, not a pass.** `IMPL-120-R024`'s determinism claim needs two
 * builds; comparing one project with itself would print "identical" and mean nothing.
 *
 * Text is decoded strictly: a source file with invalid UTF-8 is passed as bytes and no text, so the manifest-drift
 * check compares hashes rather than a string that `TextDecoder` repaired with replacement characters — a repaired
 * character in a `verbatim`-compared string is exactly the kind of drift a check should not invent.
 */

import { resolve } from 'node:path';

import { verifyProject } from '@swf-forge/compile';
import type { JsonObject, VerifyFile } from '@swf-forge/compile';
import { sha256Hex } from '@swf-forge/swf/node';

import type { Invocation } from '../args.js';
import type { CommandContext, CommandResult } from '../context.js';
import { EXIT, exitForVerify } from '../exit.js';
import { ProjectTreeError, readTree } from '../disk.js';
import { tick } from '../json.js';
import { tableView } from '../view.js';

function toVerifyFile(path: string, bytes: Uint8Array): VerifyFile {
  const base: VerifyFile = { bytes, path, sha256: sha256Hex(bytes) };
  try {
    return { ...base, text: new TextDecoder('utf-8', { fatal: true }).decode(bytes) };
  } catch {
    return base;
  }
}

function load(dir: string): { readonly error: string } | { readonly files: VerifyFile[] } {
  try {
    return {
      files: readTree({ root: dir }).map((file) => toVerifyFile(file.path, file.bytes)),
    };
  } catch (cause) {
    if (cause instanceof ProjectTreeError) return { error: cause.message };
    throw cause;
  }
}

export async function verifyCommand(
  // Findings are `verify`'s output, and they are always printed: `--quiet` suppresses a build's progress, not a
  // checker's errors, so the context is unused here by design.
  _ctx: CommandContext,
  request: { readonly cwd: string; readonly invocation: Invocation },
): Promise<CommandResult> {
  const dir = request.invocation.files[0] ?? '.';
  const root = resolve(request.cwd, dir);
  const current = load(root);
  if ('error' in current) return { body: {}, exit: EXIT.unreadable, lines: [`error: ${current.error}`] };
  const against = request.invocation.values.get('--against');
  let previous: VerifyFile[] | undefined;
  if (against !== undefined) {
    const loaded = load(resolve(request.cwd, against));
    if ('error' in loaded) {
      return { body: {}, exit: EXIT.unreadable, lines: [`error: --against ${against}: ${loaded.error}`] };
    }
    previous = loaded.files;
  }
  await tick();

  const deep = request.invocation.flags.has('--deep') || previous !== undefined;
  const result = verifyProject({
    deep,
    files: current.files,
    ...(previous === undefined ? {} : { previous }),
  });

  const errors = result.findings.filter((finding) => finding.severity === 'error');
  const warnings = result.findings.filter((finding) => finding.severity === 'warning');
  const lines: string[] = [
    `${dir}: ${result.files.inspected} file(s) inspected (${result.files.sources} source(s), ${result.files.assets} asset(s))`,
    result.clean ? 'clean' : `${errors.length} error(s), ${warnings.length} warning(s)`,
  ];
  if (result.notRun.length > 0) {
    lines.push('', 'not run:', ...result.notRun.map((row) => `  ${row.check}: ${row.reason} (owner: ${row.owner})`));
  }
  if (result.findings.length > 0) {
    lines.push(
      '',
      ...tableView(
        ['severity', 'check', 'location', 'detail', 'rule'],
        result.findings.map((finding) => [
          finding.severity,
          finding.check,
          finding.path + (finding.line === undefined ? '' : `:${finding.line}`),
          finding.detail,
          finding.rule,
        ]),
      ).map((line) => `  ${line}`),
    );
  }
  if (previous !== undefined) {
    lines.push('', `deep: compared against ${against} (${previous.length} file(s))`);
  } else if (deep) {
    lines.push('', 'deep: requested without --against, so the double-build comparison had nothing to compare');
  }
  const body: JsonObject = {
    checks: result.ran,
    clean: result.clean,
    deep,
    files: { assets: result.files.assets, inspected: result.files.inspected, sources: result.files.sources },
    findings: result.findings.map((finding) => ({
      check: finding.check,
      detail: finding.detail,
      path: finding.path,
      ...(finding.line === undefined ? {} : { line: finding.line }),
      rule: finding.rule,
      severity: finding.severity,
    })),
    notRun: result.notRun.map((row) => ({ check: row.check, owner: row.owner, reason: row.reason })),
    project: dir,
    // A byte count of what was looked at, so a `--json` reader can tell "verified a small project" from
    // "verified nothing".
    scannedBytes: current.files.reduce((sum, file) => sum + (file.bytes?.length ?? 0), 0),
  };
  return { body, exit: exitForVerify(errors.length).exit, lines };
}
