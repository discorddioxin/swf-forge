/**
 * Build configuration — `CMP` §3, `CMP-R004`, `CMP-R005`, `CMP-R003`.
 *
 * The runner takes a *resolved* configuration: defaults filled in, unknown keys rejected, values checked
 * against the enums the design spec names. Two rules shape this module.
 *
 * `CMP-R005` — an unknown key is an **error**, not a warning, because a typo in a config file is the most
 * common cause of "the build ignored my setting". Validation is therefore schema-driven and exhaustive:
 * every level of every section is checked, and the failure names the offending dotted paths.
 *
 * `CMP-R003`/§12 — a stage's cache key is `sha256(stageId ‖ stageInputHash ‖ toolVersion ‖
 * relevantConfigHash)`, so each stage declares the config paths it actually reads. A change to
 * `audio.codec` must not invalidate a cached `read` stage, and a stage that reads nothing config-derived
 * declares an empty list rather than the whole object.
 */

import { sha256Hex } from '@swf-forge/swf/node';

import type { StageId } from './pipeline.js';

/** Bumped when the resolved-config shape changes; written into `forge.config.json` (`CMP-R004`). */
export const CONFIG_SCHEMA_VERSION = 1;

export interface ForgeGraphicsConfig {
  readonly maxDrawCalls: number;
  readonly textureFormat: 'auto' | 'ktx2-etc2' | 'ktx2-astc' | 'webp' | 'png';
  readonly atlas: { readonly enabled: boolean; readonly maxSize: 2048 | 4096 | 8192; readonly padding: number };
  readonly settle: 'flash' | 'none';
  readonly antialias: 'msaa4' | 'msaa8' | 'analytic';
  readonly filters: 'on' | 'off' | 'tolerance';
}

export interface ForgeAudioConfig {
  readonly sampleRate: 44100 | 48000;
  readonly codec: 'auto' | 'opus' | 'aac' | 'mp3-passthrough';
  readonly bitrate: { readonly music: number; readonly sfx: number };
  readonly resampler: 'swr' | 'internal';
  readonly loudness: 'off' | 'ebu';
  readonly streamLookaheadMs: number;
}

export interface ForgeVmConfig {
  readonly residual: 'forbid' | 'on-demand' | 'always';
  readonly allow: readonly string[];
}

export interface ForgeNetworkConfig {
  readonly policy: 'deny' | 'allowlist' | 'all';
  readonly allowlist?: readonly string[];
}

export interface ForgeDiagnosticsConfig {
  readonly maxWarnings: number;
  readonly failOn: 'error' | 'warning' | 'risk';
}

/** The resolved build configuration (`CMP` §3). `input`/`outDir` are required; everything else defaults. */
export interface ForgeConfig {
  readonly input: string | { readonly main: string; readonly others?: readonly string[] };
  readonly outDir: string;
  readonly target: 'baseline-2020' | 'modern';
  readonly graphics: ForgeGraphicsConfig;
  readonly audio: ForgeAudioConfig;
  readonly vm: ForgeVmConfig;
  readonly network: ForgeNetworkConfig;
  readonly diagnostics: ForgeDiagnosticsConfig;
  readonly reproducible: boolean;
}

/** Run-time switches that are *not* part of `ForgeConfig`: they select a mode, not an output shape. */
export interface RunSwitches {
  readonly dryRun: boolean;
  readonly noCache: boolean;
  readonly verifyCache: boolean;
  readonly pruneDeadCode: boolean;
  readonly budgetStrict: boolean;
  readonly deep: boolean;
}

export const DEFAULT_RUN_SWITCHES: RunSwitches = {
  dryRun: false,
  noCache: false,
  verifyCache: false,
  pruneDeadCode: false,
  budgetStrict: false,
  deep: false,
};

/**
 * The tool version's own defaults — the values `serialiseConfig` omits (`CMP-R004`). `input` and
 * `outDir` have no default and are always written.
 */
export const DEFAULT_FORGE_CONFIG: Omit<ForgeConfig, 'input' | 'outDir'> = {
  target: 'baseline-2020',
  graphics: {
    // `CMP` §8 prints 700 for `--graphics.max-draw-calls` (GFX-§16's batch budget target), and P6 only ever
    // *records* the number — no draw calls exist to count until the renderer measures them — which is precisely
    // why the default has to be the table's: a budget nobody reads is also a budget nobody will notice drifting
    // (`E-056`, and the test that now pins the table).
    maxDrawCalls: 700,
    textureFormat: 'auto',
    atlas: { enabled: true, maxSize: 4096, padding: 2 },
    settle: 'flash',
    antialias: 'msaa4',
    filters: 'on',
  },
  audio: {
    sampleRate: 48000,
    codec: 'auto',
    bitrate: { music: 128, sfx: 96 },
    resampler: 'internal',
    loudness: 'off',
    streamLookaheadMs: 50,
  },
  vm: { residual: 'on-demand', allow: [] },
  network: { policy: 'deny' },
  // `maxWarnings` is `CMP` §8's default for `--max-warnings`, and the CLI reads the number literally: a limit of
  // 0 makes the first warning fatal, so a *default* of 0 would exit 4 on any build that warned at all.
  diagnostics: { maxWarnings: 200, failOn: 'error' },
  reproducible: true,
};

/** A validation failure. The CLI maps it to exit 2 (`IMPL-120-R026`: input invalid). */
export class ConfigError extends Error {
  readonly unknownKeys: readonly string[];
  readonly invalidValues: readonly string[];

  constructor(unknownKeys: readonly string[], invalidValues: readonly string[]) {
    const parts: string[] = [];
    if (unknownKeys.length > 0) parts.push(`unknown key(s): ${unknownKeys.join(', ')}`);
    if (invalidValues.length > 0) parts.push(`invalid value(s): ${invalidValues.join('; ')}`);
    super(`forge config is not valid — ${parts.join(' · ')}`);
    this.name = 'ConfigError';
    this.unknownKeys = unknownKeys;
    this.invalidValues = invalidValues;
  }
}

type LeafSpec =
  | { readonly kind: 'string' }
  | { readonly kind: 'boolean' }
  | { readonly kind: 'number' }
  | { readonly kind: 'enum'; readonly values: readonly (string | number)[] }
  | { readonly kind: 'stringList' }
  | { readonly kind: 'input' };

interface SectionSpec {
  readonly kind: 'section';
  readonly keys: Readonly<Record<string, LeafSpec | SectionSpec>>;
}

const section = (keys: Record<string, LeafSpec | SectionSpec>): SectionSpec => ({ kind: 'section', keys });
const enumOf = (...values: readonly (string | number)[]): LeafSpec => ({ kind: 'enum', values });

/** The schema `CMP` §3 states, level by level. Adding a config key means adding it here. */
const SCHEMA: SectionSpec = section({
  input: { kind: 'input' },
  outDir: { kind: 'string' },
  target: enumOf('baseline-2020', 'modern'),
  graphics: section({
    maxDrawCalls: { kind: 'number' },
    textureFormat: enumOf('auto', 'ktx2-etc2', 'ktx2-astc', 'webp', 'png'),
    atlas: section({
      enabled: { kind: 'boolean' },
      maxSize: enumOf(2048, 4096, 8192),
      padding: { kind: 'number' },
    }),
    settle: enumOf('flash', 'none'),
    antialias: enumOf('msaa4', 'msaa8', 'analytic'),
    filters: enumOf('on', 'off', 'tolerance'),
  }),
  audio: section({
    sampleRate: enumOf(44100, 48000),
    codec: enumOf('auto', 'opus', 'aac', 'mp3-passthrough'),
    bitrate: section({ music: { kind: 'number' }, sfx: { kind: 'number' } }),
    resampler: enumOf('swr', 'internal'),
    loudness: enumOf('off', 'ebu'),
    streamLookaheadMs: { kind: 'number' },
  }),
  vm: section({ residual: enumOf('forbid', 'on-demand', 'always'), allow: { kind: 'stringList' } }),
  network: section({ policy: enumOf('deny', 'allowlist', 'all'), allowlist: { kind: 'stringList' } }),
  diagnostics: section({ maxWarnings: { kind: 'number' }, failOn: enumOf('error', 'warning', 'risk') }),
  reproducible: { kind: 'boolean' },
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkLeaf(spec: LeafSpec, value: unknown, path: string, invalid: string[]): unknown {
  switch (spec.kind) {
    case 'string':
      if (typeof value !== 'string') invalid.push(`${path} must be a string`);
      return value;
    case 'boolean':
      if (typeof value !== 'boolean') invalid.push(`${path} must be a boolean`);
      return value;
    case 'number':
      if (typeof value !== 'number' || !Number.isFinite(value)) invalid.push(`${path} must be a finite number`);
      return value;
    case 'stringList':
      if (!Array.isArray(value) || value.some((item) => typeof item !== 'string')) {
        invalid.push(`${path} must be a list of strings`);
      }
      return value;
    case 'enum':
      if (!spec.values.includes(value as string | number)) {
        invalid.push(`${path} must be one of ${spec.values.map((v) => JSON.stringify(v)).join(', ')}`);
      }
      return value;
    case 'input': {
      if (typeof value === 'string') return value;
      if (!isRecord(value) || typeof value.main !== 'string') {
        invalid.push(`${path} must be a path or { main, others? }`);
        return value;
      }
      const known = new Set(['main', 'others']);
      for (const key of Object.keys(value)) if (!known.has(key)) invalid.push(`${path}.${key} is not a known key`);
      if (
        value.others !== undefined &&
        (!Array.isArray(value.others) || value.others.some((o) => typeof o !== 'string'))
      ) {
        invalid.push(`${path}.others must be a list of strings`);
      }
      return value;
    }
  }
}

/**
 * Validates a partial config object against the schema and merges it over the defaults.
 *
 * Unknown keys at *any* level are collected and reported together (`CMP-R005`), so one run names every
 * typo instead of revealing them one rebuild at a time.
 */
export function resolveForgeConfig(input: unknown): ForgeConfig {
  const unknownKeys: string[] = [];
  const invalidValues: string[] = [];

  const merge = (
    spec: SectionSpec,
    source: unknown,
    base: Record<string, unknown>,
    path: string,
  ): Record<string, unknown> => {
    if (source === undefined) return base;
    if (!isRecord(source)) {
      invalidValues.push(`${path || 'config'} must be an object`);
      return base;
    }
    const out: Record<string, unknown> = { ...base };
    for (const key of Object.keys(source).sort()) {
      const childSpec = spec.keys[key];
      const childPath = path === '' ? key : `${path}.${key}`;
      if (childSpec === undefined) {
        unknownKeys.push(childPath);
        continue;
      }
      const value = source[key];
      if (childSpec.kind === 'section') {
        out[key] = merge(childSpec, value, isRecord(base[key]) ? base[key] : {}, childPath);
      } else if (value !== undefined) {
        out[key] = checkLeaf(childSpec, value, childPath, invalidValues);
      }
    }
    return out;
  };

  const merged = merge(SCHEMA, input, { ...DEFAULT_FORGE_CONFIG }, '');
  if (unknownKeys.length > 0 || invalidValues.length > 0) throw new ConfigError(unknownKeys, invalidValues);
  if (typeof merged.input !== 'string' && !isRecord(merged.input)) {
    throw new ConfigError([], ['input is required: a path or { main, others? }']);
  }
  if (typeof merged.outDir !== 'string' || merged.outDir === '') {
    throw new ConfigError([], ['outDir is required']);
  }
  // `CMP` §3 declares this value and §9.2 gives it a build outcome, but the implemented diagnostic model
  // has three severities and no code can produce a fourth (errata `E-043`). Accepting it would mean
  // honouring nothing — exactly the silent ignore `CMP-R005` makes unknown keys an error to prevent — so
  // it is rejected until the model carries the severity.
  const diagnosticsSection = merged.diagnostics;
  if (isRecord(diagnosticsSection) && diagnosticsSection.failOn === 'risk') {
    throw new ConfigError(
      [],
      ["diagnostics.failOn: 'risk' cannot be honoured yet — the diagnostic model has no risk severity (errata E-043)"],
    );
  }
  return merged as unknown as ForgeConfig;
}

/**
 * The resolved config as written to `forge.config.json` in the output (`CMP-R004`): `$schemaVersion` plus
 * only the values this tool version's defaults would not reproduce. Omitting defaults is what keeps the
 * file stable across tool versions that add defaults, and what makes a diff between two projects mean
 * something.
 */
export function serialiseConfig(config: ForgeConfig): Record<string, unknown> {
  const differs = (a: unknown, b: unknown): boolean => stableStringify(a) !== stableStringify(b);

  const prune = (value: Record<string, unknown>, base: Record<string, unknown>): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      const current = value[key];
      const default_ = base[key];
      if (isRecord(current) && isRecord(default_)) {
        const nested = prune(current, default_);
        if (Object.keys(nested).length > 0) out[key] = nested;
      } else if (differs(current, default_)) {
        out[key] = current;
      }
    }
    return out;
  };

  const asRecord = config as unknown as Record<string, unknown>;
  const written = prune(asRecord, DEFAULT_FORGE_CONFIG as unknown as Record<string, unknown>);
  return { $schemaVersion: CONFIG_SCHEMA_VERSION, ...written };
}

/**
 * The config paths each stage reads (`CMP-R003`). A stage that reads no config declares `[]`, and its
 * cache key then depends only on its inputs and the tool version.
 *
 * These lists are the contract `--verify-cache` checks: a stage whose output changes when a path outside
 * its list changes is mis-declared, and the recomputation diff (`IMPL-120-R002`) is what catches it.
 */
export const RELEVANT_CONFIG_KEYS: Readonly<Record<StageId, readonly string[]>> = {
  read: [],
  model: [],
  decode: ['graphics.textureFormat', 'graphics.atlas', 'audio.sampleRate', 'audio.resampler'],
  // `analyzeMovie` reads no configuration: its one caller-selected input (`legacyEncoding`) is a stage
  // option, folded into that stage's input hash. The residual *policy* is consumed by the tier-finalise
  // pass and the emitter, not by the front end. A stage that starts reading a config path must extend its
  // list here — `--verify-cache` catches the mistake, because recomputing under the new config would no
  // longer match the entry the old key still points at.
  analyze: [],
  plan: ['graphics', 'audio', 'vm.residual', 'network.policy', 'diagnostics.failOn'],
  emit: ['target', 'graphics', 'audio', 'vm', 'network', 'reproducible'],
  report: ['diagnostics', 'reproducible'],
};

function selectPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const key of path.split('.')) {
    if (!isRecord(current)) return undefined;
    current = current[key];
  }
  return current;
}

/** Deterministic JSON: object keys sorted at every level, so hashing never depends on insertion order. */
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (isRecord(value)) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  if (typeof value === 'bigint') return JSON.stringify(value.toString());
  return JSON.stringify(value) ?? 'null';
}

/** `relevantConfigHash` from `CMP` §12: the hash of exactly the paths a stage declares it reads. */
export function configHash(config: ForgeConfig, stage: StageId): string {
  const paths = RELEVANT_CONFIG_KEYS[stage];
  const selected = paths.map((path) => [path, selectPath(config, path)] as const);
  return sha256Hex(new TextEncoder().encode(stableStringify(selected)));
}
