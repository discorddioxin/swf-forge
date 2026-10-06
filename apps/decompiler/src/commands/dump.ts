/**
 * `dump` — the model dump verb (`TECH-SPEC` §5.2, `IMPL-040` §3.6).
 *
 * Serialises the whole `MovieModel` plus header, dictionary and diagnostics, either to stdout (human or
 * `--json`) or to `<dir>/model.json`. Read-only towards the input, and the only file it writes is the
 * one `--out` names (`IMPL-040-R044`/`R048`).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildMovieModel, type MovieModel, type SwfFile } from '@swf-forge/swf';
import { openSwfNodeSync, sha256Hex } from '@swf-forge/swf/node';

import { EXIT, exitForDiagnostics, type CliIo } from '../exit.js';
import { buildModelDump, dumpJson, renderDump, type ModelDump } from '../dump/model-dump.js';

export interface DumpRequest {
  readonly file: string;
  readonly json: boolean;
  readonly verbose: boolean;
  readonly strict?: boolean;
  readonly strictLength?: boolean;
  readonly strictTimeline?: boolean;
  /** Directory for `model.json`, or null to write nothing. */
  readonly out: string | null;
  /** Repeatable `URL=FILE` imports for the multi-movie input set. */
  readonly imports?: readonly string[];
}

export interface DumpResult {
  readonly dump: ModelDump;
  readonly model: MovieModel;
  readonly unit: SwfFile;
}

function open(request: DumpRequest, io: CliIo): DumpResult | number {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(request.file));
  } catch (error) {
    io.err(`cannot read ${request.file}: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT.unreadable;
  }
  const openOptions = {
    mode: request.strict ? ('strict' as const) : ('soft' as const),
    strictLength: request.strictLength ?? false,
  };
  const unit = openSwfNodeSync(bytes, openOptions);
  const imports = new Map<string, SwfFile>();
  for (const specification of request.imports ?? []) {
    const separator = specification.indexOf('=');
    if (separator <= 0 || separator === specification.length - 1) {
      io.err(`invalid --import ${JSON.stringify(specification)}; expected URL=FILE`);
      return EXIT.unreadable;
    }
    const url = specification.slice(0, separator);
    const path = specification.slice(separator + 1);
    let importBytes: Uint8Array;
    try {
      importBytes = new Uint8Array(readFileSync(path));
    } catch (error) {
      io.err(`cannot read import ${path}: ${error instanceof Error ? error.message : String(error)}`);
      return EXIT.unreadable;
    }
    imports.set(url, openSwfNodeSync(importBytes, openOptions));
  }
  const model = buildMovieModel(unit, {
    strictTimeline: request.strictTimeline ?? false,
    imports,
  });
  return { dump: buildModelDump(unit, model, sha256Hex(bytes)), model, unit };
}

export function runDump(request: DumpRequest, io: CliIo): number {
  const opened = open(request, io);
  if (typeof opened === 'number') return opened;
  const { dump, unit } = opened;

  if (request.out !== null) {
    const target = join(request.out, 'model.json');
    try {
      mkdirSync(request.out, { recursive: true });
      writeFileSync(target, dumpJson(dump));
    } catch (error) {
      io.err(`cannot write ${target}: ${error instanceof Error ? error.message : String(error)}`);
      return EXIT.internal;
    }
    io.out(
      `${target} — ${dump.dictionary.length} character(s), ${dump.timeline.frames.length} frame(s), ${dump.diagnostics.total} diagnostic(s)`,
    );
  } else if (request.json) {
    io.out(JSON.stringify(dump, null, 2));
  } else {
    for (const line of renderDump(dump, request.file, request.verbose)) io.out(line);
  }

  return exitForDiagnostics(unit.diagnostics);
}
