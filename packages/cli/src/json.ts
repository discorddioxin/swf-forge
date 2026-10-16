/**
 * The `--json` envelope (`IMPL-120-R025`).
 *
 * One envelope shape for every verb: the tool's identity, the command, the exit code the process will use, and
 * the command's own object. `exit` is inside the payload on purpose — a machine reading stdout should not have to
 * correlate two channels to learn whether the run was good, and a wrapper that captures stdout and re-exits 0
 * (a shell pipeline, a test harness) still sees the verdict.
 *
 * Key order is `sorted` and there is no timestamp, so `--json` output is byte-stable across runs and can be
 * diffed in a fixture the way the report files can (`REPO-R015`). The exit code is in the envelope, which means a
 * golden `--json` fixture freezes the verdict too: a change to the exit table is a diff, not a silent slip.
 *
 * `writeJson` refuses a value it cannot render (a non-finite number, a function) rather than printing `null` for
 * it, and that refusal is our bug, so it is reported to the caller instead of being swallowed here.
 */

import { writeJson } from '@swf-forge/compile';
import type { JsonObject } from '@swf-forge/compile';

import { TOOL_NAME, TOOL_VERSION } from './version.js';

export const CLI_JSON_SCHEMA_VERSION = 1;

/**
 * A macrotask boundary.
 *
 * A SIGINT listener can only run when the event loop turns, and a build is one synchronous call, so the CLI yields
 * here at the two points where stopping still means something: before the run starts, and before each file is
 * written. `process.exitCode` and `main.ts`'s handler together mean a Ctrl-C during the write phase leaves the
 * already-written files rolled back rather than half a project on disk.
 */
export function tick(): Promise<void> {
  return new Promise((resolve) => {
    setImmediate(resolve);
  });
}

export type Envelope = { readonly text: string } | { readonly error: string };

/** The envelope's fixed head, so a consumer can dispatch on `command` without reading the body. */
export function envelope(command: string, exit: number, body: JsonObject): Envelope {
  const value: JsonObject = {
    command,
    exit,
    schemaVersion: CLI_JSON_SCHEMA_VERSION,
    tool: { name: TOOL_NAME, version: TOOL_VERSION },
    ...body,
  };
  return writeJson(value, { subject: 'command output' });
}

/** A diagnostic list, in the shape both the human table and the JSON array use (`CMP-§9.1`'s `file:line:col severity code message`). */
export function diagnosticRows(
  items: readonly {
    readonly code: string;
    readonly severity: string;
    readonly message: string;
    readonly offset: number;
    readonly context: string;
    readonly count: number;
  }[],
): { readonly data: readonly JsonObject[]; readonly text: readonly string[] } {
  const rows = items
    .map((item) => ({
      code: item.code,
      context: item.context,
      count: item.count,
      message: item.message,
      offset: item.offset,
      severity: item.severity,
    }))
    .sort((a, b) => (a.offset !== b.offset ? a.offset - b.offset : a.code < b.code ? -1 : 1));
  return {
    data: rows,
    text: rows.map((row) => `  ${row.severity} ${row.code} @${row.offset} [${row.context}] ${row.message}`),
  };
}
