/**
 * The config file, and why auto-detection looks only at the working directory (`CMP-R004`, `CMP-R028`).
 *
 * `CMP-R004` has the build write its resolved configuration into the *output* as `forge.config.json`, so the
 * project carries the settings that produced it. That makes the same filename an input candidate in a naive
 * reader: point `--out` at a previous build's directory, and the previous build's pruned config becomes this
 * build's file layer, sitting underneath the flags you just typed and silently re-adding whatever you changed.
 * Auto-detection therefore looks at the working directory only, and `--config -` means "read none".
 *
 * A file that does not parse is exit 2, the same class as an unreadable input. It is never *repaired*: a config
 * with a trailing comma is a file someone edited, and a CLI that guesses what they meant has then built a project
 * whose recorded config is not the file on disk.
 */

import { readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';

import { ConfigError, resolveForgeConfig, serialiseConfig } from '@swf-forge/compile';
import type { ForgeConfig, JsonObject } from '@swf-forge/compile';

export const CONFIG_FILENAME = 'forge.config.json';

export interface LoadedConfig {
  /** The file's own object, or `{}` when there is none. */
  readonly value: Record<string, unknown>;
  /** The path read, relative to the working directory; `null` when no file was read. */
  readonly source: string | null;
  /** Why the configuration could not be used. Non-null means exit 2, before any stage runs. */
  readonly error: string | null;
}

/** Read `--config <file>`, or auto-detect `./forge.config.json`. `-` disables detection. */
export function loadConfigFile(cwd: string, explicit: string | null): LoadedConfig {
  if (explicit === '-') return { value: {}, source: null, error: null };
  const target = explicit === null ? resolve(cwd, CONFIG_FILENAME) : resolve(cwd, explicit);
  if (explicit === null) {
    let text: string;
    try {
      text = readFileSync(target, 'utf8');
    } catch {
      // No file and no request for one is the ordinary case: the defaults are the configuration.
      return { value: {}, source: null, error: null };
    }
    return parseInto(text, relative(cwd, target) || CONFIG_FILENAME);
  }
  try {
    return parseInto(readFileSync(target, 'utf8'), relative(cwd, target) || explicit);
  } catch {
    return { value: {}, source: null, error: `--config ${explicit} could not be read` };
  }
}

function parseInto(text: string, source: string): LoadedConfig {
  let value: unknown;
  try {
    value = JSON.parse(text) as unknown;
  } catch (cause) {
    return {
      value: {},
      source,
      error: `${source} does not parse as JSON: ${cause instanceof Error ? cause.message : String(cause)}`,
    };
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return { value: {}, source, error: `${source} must contain a JSON object` };
  }
  return { value: value as Record<string, unknown>, source, error: null };
}

/** Deep-merge a flag patch over a file layer. Arrays and scalars replace; objects of objects merge. */
export function mergeConfig(
  base: Readonly<Record<string, unknown>>,
  patch: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    const prior = out[key];
    const bothPlain =
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      prior !== null &&
      typeof prior === 'object' &&
      !Array.isArray(prior);
    out[key] = bothPlain ? mergeConfig(prior as Record<string, unknown>, value as Record<string, unknown>) : value;
  }
  return out;
}

/**
 * The three layers — defaults, file, flags — resolved once.
 *
 * `input` and `outDir` are supplied by the caller (they are the command's operands, not config the user should
 * set in a file they forgot about), and a config file that names them is *overridden*, because the operand is the
 * thing the user just typed.
 */
export function resolveLayers(
  loaded: LoadedConfig,
  patch: Readonly<Record<string, unknown>>,
  operands: { readonly input: string; readonly outDir: string },
): { readonly config: ForgeConfig } | { readonly error: string } {
  const merged = mergeConfig(mergeConfig(loaded.value, patch), { ...operands });
  try {
    return { config: resolveForgeConfig(merged) };
  } catch (cause) {
    if (cause instanceof ConfigError) return { error: cause.message };
    throw cause;
  }
}

/**
 * What goes into `<out>/forge.config.json` (`CMP-R004`): the resolved config minus the values this tool version's
 * defaults would reproduce, plus the schema version. The out-dir copy is an output, never an input — see the
 * module header — and its keys are sorted by `serialiseConfig`, so two runs on the same input write the same
 * bytes (`REPO-R015`).
 */
export function configArtifact(config: ForgeConfig): string {
  return `${JSON.stringify(serialiseConfig(config), null, 2)}\n`;
}

/**
 * The config as a plain JSON object, for `--verbose` and for every envelope's `config` field.
 *
 * The cast is deliberate and is the only one in this package: `serialiseConfig` and `resolveForgeConfig` prove
 * structurally that a `ForgeConfig` is JSON — every leaf is a string, number, boolean or array of them — but
 * `ForgeConfig` is an interface, and an interface has no implicit index signature, so TypeScript cannot see what
 * the runtime guarantees. Widening through `unknown` says "the guarantee is elsewhere" without `any`.
 */
export function configToJson(config: ForgeConfig): JsonObject {
  return config as unknown as JsonObject;
}

/** A path a build may write, guarded against escaping the output directory. */
export function insideOutDir(outDir: string, path: string): boolean {
  if (isAbsolute(path) || /^[A-Za-z]:[\\/]/u.test(path)) return false;
  const target = relative(outDir, resolve(outDir, path));
  return target === '' || (!target.startsWith('..') && !isAbsolute(target));
}
