/**
 * The part every verb shares: an input file, a configuration, and the decision of which stage flags apply.
 *
 * It lives in one function because the alternative is three commands each re-deriving the same three facts and
 * each getting one of them subtly different — the classic way a `plan` stops describing what `build` does. This is
 * also where `CMP-R029`'s "input unreadable" class is decided: a file that cannot be read, a directory passed
 * where a `.swf` was expected, and a config that does not parse are all the same answer, before any stage runs.
 *
 * Nothing here prints. The reasons come back as strings for `cli.ts` to report, so `inspect` over four files can
 * say which of the four failed.
 */

import { readFileSync, statSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';

import type { ForgeConfig } from '@swf-forge/compile';

import type { Invocation, StageFlags, SwitchPatch } from '../args.js';
import { loadConfigFile, resolveLayers } from '../config.js';
import { cacheDirectory } from '../run.js';

export interface Prepared {
  readonly input: { readonly absolute: string; readonly bytes: Uint8Array; readonly name: string };
  readonly config: ForgeConfig;
  readonly configSource: string | null;
  readonly stage: StageFlags;
  readonly switches: SwitchPatch;
  /** Where the files go, exactly as the user typed it (`REPO-R015`: no host path in a written artifact). */
  readonly outDir: string;
  readonly absoluteOut: string;
  readonly cacheDir: string | null;
  /** The report files only, under `--report-only`. */
  readonly filter: ((path: string) => boolean) | undefined;
}

export type PreparedResult = { readonly error: string } | { readonly prepared: Prepared };

/** The paths `swfforge report` and `--report-only` treat as the report set. `forge.config.json` is the CLI's own. */
export const REPORT_FILES: readonly string[] = [
  'build-info.json',
  'divergence.json',
  'forge.config.json',
  'porting-notes.json',
  'reports/porting-notes.md',
];

/** A path relative to the working directory, with `/` separators, as every written artifact records it. */
export function displayName(cwd: string, absolute: string): string {
  const from = relative(cwd, absolute);
  if (from === '') return '.';
  const normalised = from.split(sep).join('/');
  // A path outside the working directory has no relative form worth printing; `..`-prefixed is honest, and an
  // absolute path would put the build host's filesystem into a hashed artifact (`IMPL-120-R021`).
  return normalised.startsWith('..') || isAbsolute(normalised) ? normalised.split(sep).join('/') : normalised;
}

function readInput(
  cwd: string,
  file: string,
): { readonly error: string } | { readonly absolute: string; readonly bytes: Uint8Array; readonly name: string } {
  const absolute = resolve(cwd, file);
  let size: number;
  try {
    size = statSync(absolute).size;
  } catch {
    return { error: `${file}: no such file` };
  }
  if (size === 0) return { error: `${file}: the file is empty, so it cannot be a SWF` };
  try {
    return { absolute, bytes: new Uint8Array(readFileSync(absolute)), name: displayName(cwd, absolute) };
  } catch (cause) {
    return { error: `${file}: ${cause instanceof Error ? cause.message : String(cause)}` };
  }
}

/** One SWF in, one resolved config out. `verb` only appears in the messages. */
export function prepareInvocation(verb: string, cwd: string, invocation: Invocation): PreparedResult {
  if (invocation.files.length === 0) {
    return { error: `swfforge ${verb} needs an input .swf file` };
  }
  if (verb !== 'inspect' && invocation.files.length > 1) {
    // The pipeline runs on one input (`RunOptions.input` is one byte string); `inspect` is read-only and loops.
    // Accepting extra files silently here would mean a build whose output came from the first name typed.
    return {
      error: `swfforge ${verb} takes one input file, not ${invocation.files.length} — the pipeline compiles one SWF`,
    };
  }
  const explicit = invocation.values.get('--config') ?? null;
  const loaded = loadConfigFile(cwd, explicit);
  if (loaded.error !== null) return { error: loaded.error };
  const outDir = invocation.values.get('--out') ?? './out';
  const read = readInput(cwd, invocation.files[0] as string);
  if ('error' in read) return { error: read.error };
  const resolved = resolveLayers(loaded, invocation.configPatch, { input: read.name, outDir });
  if ('error' in resolved) return { error: `forge config: ${resolved.error}` };
  const switches: SwitchPatch = { ...invocation.switches };
  const noCache = invocation.flags.has('--no-cache');
  return {
    prepared: {
      input: read,
      config: resolved.config,
      configSource: loaded.source,
      stage: invocation.stage,
      switches,
      outDir,
      absoluteOut: resolve(cwd, outDir),
      cacheDir: noCache ? null : cacheDirectory(cwd),
      filter: invocation.flags.has('--report-only') ? (path: string) => REPORT_FILES.includes(path) : undefined,
    },
  };
}
