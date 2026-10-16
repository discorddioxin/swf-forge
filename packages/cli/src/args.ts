/**
 * The argument table (`CMP-R028`, `IMPL-120-R025`'s command surface).
 *
 * One table describes every flag, and each entry says where the flag lands: a path into `ForgeConfig`, a
 * `RunSwitches` key, a stage option, or nowhere — and "nowhere" has to be written down, because `CMP-R028`'s
 * rule ("every flag MUST have a matching `forge.config.json` field") is the thing a flag like `--jobs` cannot
 * satisfy while P6 has no parallel encode to size. An entry with no target is therefore *inert with a reason*,
 * and a test asserts three things about the table: every `config` path resolves against `resolveForgeConfig`
 * without an unknown-key error, every inert flag carries a reason, and every flag appears in the help text.
 *
 * `--verbose` is not in `CMP` §8's table as a flag but §8's `R028` demands the resolved config at "level 1", so
 * it counts repetitions (`-vv` is level 2) rather than taking a value — a level is a verbosity, not a string.
 *
 * Unknown flags are an error rather than a shrug, for the `CMP-R05` reason this repo already applies to config
 * keys: the commonest cause of "the build ignored my setting" is a typo, and a typo that prints nothing is a
 * build nobody can trust.
 */

import type { RunSwitches } from '@swf-forge/compile';

/**
 * `Partial<RunSwitches>` with the `readonly` removed.
 *
 * The pipeline's own switches are immutable, and they should be — but a parser builds one up flag by flag, so the
 * CLI's *accumulator* needs to be writable. Spelling the mapped type here, once, is the alternative to a cast at
 * every assignment, which is how an accidental `switches[dryrun] = ...` typo becomes a new field on an object.
 */
export type SwitchPatch = { -readonly [K in keyof RunSwitches]?: RunSwitches[K] };

export const VERBS = ['build', 'plan', 'inspect', 'verify', 'report'] as const;
export type Verb = (typeof VERBS)[number];

export type SourceMapMode = 'file' | 'inline' | 'none';

export interface FlagSpec {
  readonly name: string;
  readonly kind: 'boolean' | 'number' | 'string';
  /** The dotted `ForgeConfig` path this flag sets (`CMP-R028`). */
  readonly config?: readonly string[];
  /** The run switch this flag turns on. */
  readonly switch?: keyof RunSwitches;
  /** A stage option rather than a config key: the stage takes it, the config does not. */
  readonly stage?: 'read' | 'model' | 'emit';
  /** The values accepted, checked here so a typo is a message and not a `ConfigError` about someone else's file. */
  readonly choices?: readonly (string | number)[];
  /** The verbs that accept this flag. Absent means every verb. */
  readonly verbs?: readonly Verb[];
  /** Why this flag changes nothing in this build; required when a flag has no target. */
  readonly inert?: string;
  /**
   * A value the spec names that this build cannot act on: it is accepted, reported inert with the reason given
   * here, and never reaches the config. `--fail-on=risk` is the case — `CMP-§8` lists the value, `IMPL-120-R0xx`'s
   * config schema allows it, and the diagnostic registry has no `risk` severity to promote, so applying it would
   * either fail validation or silently do nothing to a build that looked configured.
   */
  readonly inertValues?: Readonly<Record<string, string>>;
  /** One line, for `--help`. */
  readonly summary: string;
}

/** The operational flags: they choose a mode, not an output shape, so no config field mirrors them. */
const MODE_FLAGS: readonly FlagSpec[] = [
  { name: '--out', kind: 'string', verbs: ['build', 'plan'], summary: 'output project directory (default ./out)' },
  {
    name: '--config',
    kind: 'string',
    verbs: ['build', 'plan'],
    summary: 'config file (default: ./forge.config.json if present)',
  },
  { name: '--json', kind: 'boolean', summary: 'machine-readable output on stdout, stable field order (IMPL-120-R025)' },
  { name: '--verbose', kind: 'boolean', summary: 'print the resolved config (level 1) and per-stage detail (level 2)' },
  { name: '--quiet', kind: 'boolean', summary: 'print nothing on a clean run; verify and inspect ignore it' },
  { name: '--help', kind: 'boolean', summary: 'this text' },
  { name: '--version', kind: 'boolean', summary: 'tool name and version' },
];

/** The `CMP` §8 flag table, in the design spec's dotted spelling, each entry naming the config path it sets. */
export const CONFIG_FLAGS: readonly FlagSpec[] = [
  {
    name: '--graphics.max-draw-calls',
    kind: 'number',
    config: ['graphics', 'maxDrawCalls'],
    verbs: ['build', 'plan'],
    summary: 'batch budget target (GFX-§16)',
  },
  {
    name: '--audio.codec',
    kind: 'string',
    config: ['audio', 'codec'],
    choices: ['auto', 'opus', 'aac', 'mp3-passthrough'],
    verbs: ['build', 'plan'],
    summary: 'force codec',
  },
  {
    name: '--vm.residual',
    kind: 'string',
    config: ['vm', 'residual'],
    choices: ['forbid', 'on-demand', 'always'],
    verbs: ['build', 'plan'],
    summary: 'what the emitter does with a block it cannot lower',
  },
  {
    name: '--network.policy',
    kind: 'string',
    config: ['network', 'policy'],
    choices: ['deny', 'allowlist', 'all'],
    verbs: ['build', 'plan'],
    summary: 'URL virtualisation policy (RT-§6)',
  },
  {
    name: '--max-warnings',
    kind: 'number',
    config: ['diagnostics', 'maxWarnings'],
    verbs: ['build', 'plan'],
    summary: 'fail after n warning occurrences, not table rows (0 makes every warning fatal)',
  },
  {
    name: '--fail-on',
    kind: 'string',
    config: ['diagnostics', 'failOn'],
    choices: ['error', 'warning', 'risk'],
    inertValues: {
      risk: 'the diagnostic registry defines three severities and none of them is `risk` (E-043 is open on the design side)',
    },
    verbs: ['build', 'plan'],
    summary:
      'severity that fails the build; `risk` is accepted and reported inert, as the registry has no such severity',
  },
  {
    name: '--reproducible',
    kind: 'boolean',
    config: ['reproducible'],
    verbs: ['build', 'plan'],
    summary: 'REPO-R015: the default; pass --reproducible=false to allow a stamped build',
  },
  {
    name: '--sourcemap',
    kind: 'string',
    stage: 'emit',
    choices: ['none', 'file', 'inline'],
    verbs: ['build'],
    summary: 'none|file|inline (CMP-R014; statement maps are withheld in P6, so this is reported, not honoured)',
  },
  {
    name: '--jobs',
    kind: 'number',
    verbs: ['build'],
    inert:
      'P6 encodes no assets in parallel: `WP-120-07` owns the encode scheduler, and a worker count with nothing to feed it would be a knob that changes nothing silently',
    summary: 'worker pool size (inert until WP-120-07)',
  },
];

/** The run switches (`IMPL-120-R0xx`'s `RunSwitches`), which select a mode and so are not config fields. */
const SWITCH_FLAGS: readonly FlagSpec[] = [
  {
    name: '--dry-run',
    kind: 'boolean',
    switch: 'dryRun',
    verbs: ['build'],
    summary: 'analyse and report, write nothing',
  },
  { name: '--report-only', kind: 'boolean', verbs: ['build'], summary: 'write only the report files, not the project' },
  {
    name: '--no-cache',
    kind: 'boolean',
    switch: 'noCache',
    verbs: ['build', 'plan'],
    summary: 'ignore and skip the stage cache',
  },
  {
    name: '--verify-cache',
    kind: 'boolean',
    switch: 'verifyCache',
    verbs: ['build', 'plan'],
    summary: 'recompute a hit and diff (IMPL-120-R002)',
  },
  {
    name: '--prune-dead-code',
    kind: 'boolean',
    switch: 'pruneDeadCode',
    verbs: ['build', 'plan'],
    summary: 'remove statically unreachable action blocks',
  },
  {
    name: '--budget-strict',
    kind: 'boolean',
    switch: 'budgetStrict',
    verbs: ['build', 'plan'],
    summary: 'recorded in the report gates; inert, because only the residual-bytes budget exists in P6',
  },
  {
    name: '--deep',
    kind: 'boolean',
    switch: 'deep',
    verbs: ['verify'],
    summary: 'add the double-build determinism comparison',
  },
];

/** The reader and model stages' recovery knobs, spelled as `forge-decompile` spells them. */
const STAGE_FLAGS: readonly FlagSpec[] = [
  {
    name: '--strict',
    kind: 'boolean',
    stage: 'read',
    verbs: ['build', 'plan', 'inspect'],
    summary: 'fail on structural read errors instead of recovering',
  },
  {
    name: '--tolerate-length',
    kind: 'boolean',
    stage: 'read',
    verbs: ['build', 'plan', 'inspect'],
    summary: 'keep a FileLength mismatch a warning',
  },
  {
    name: '--strict-timeline',
    kind: 'boolean',
    stage: 'model',
    verbs: ['build', 'plan', 'inspect'],
    summary: 'report a removal at an empty depth',
  },
];

/** `inspect`'s views. `--shapes` and below need the `decode` stage, which P6 does not register. */
const VIEW_FLAGS: readonly FlagSpec[] = (
  [
    ['--tags', 'list every indexed tag (index, code, offset, length, sprite depth)'],
    ['--symbols', 'the export name table and the assigned symbol table'],
    ['--timeline', 'per-frame placement, action-block and label counts'],
    ['--actions', 'run the AVM1 front end and report tiers and block counts'],
    ['--shapes', 'decoded vector shapes (needs the decode stage)'],
    ['--images', 'bitmap and atlas inventory (needs the decode stage)'],
    ['--fonts', 'font and glyph tables (needs the decode stage)'],
    ['--sounds', 'sound streams and codec previews (needs the decode stage)'],
    ['--video', 'video stream extents (needs the decode stage)'],
  ] as const
).map(([name, summary]) => ({
  name,
  kind: 'boolean' as const,
  verbs: ['inspect'] as const,
  summary,
  ...(name === '--shapes' || name === '--images' || name === '--fonts' || name === '--sounds' || name === '--video'
    ? { inert: 'the `decode` stage is not registered in this build (WP-070-07, WP-080-10/-11, WP-110-12)' }
    : {}),
}));

/** Every flag the CLI accepts, in one list. `--help` prints this, so the help cannot drift from the parser. */
export const FLAGS: readonly FlagSpec[] = [
  ...MODE_FLAGS,
  ...CONFIG_FLAGS,
  ...SWITCH_FLAGS,
  ...STAGE_FLAGS,
  ...VIEW_FLAGS,
  {
    name: '--against',
    kind: 'string',
    verbs: ['verify'],
    summary: 'with --deep: a second build output to compare byte-for-byte',
  },
  { name: '--budgets', kind: 'boolean', verbs: ['report'], summary: 'print only the budget lines' },
  { name: '--divergence', kind: 'boolean', verbs: ['report'], summary: 'print only the divergence entries' },
];

const BY_NAME = new Map(FLAGS.map((spec) => [spec.name, spec]));

/** The flag names `--help` lists, so a flag can be added to one place only. */
export function flagHelp(): readonly string[] {
  return FLAGS.map((spec) => `  ${spec.name}${spec.kind === 'boolean' ? '' : ' <value>'}  ${spec.summary}`).sort();
}

export interface StageFlags {
  readonly strict: boolean;
  readonly strictLength: boolean;
  readonly strictTimeline: boolean;
  readonly sourceMaps: SourceMapMode;
}

export interface Invocation {
  readonly verb: Verb | null;
  readonly files: readonly string[];
  readonly flags: ReadonlySet<string>;
  readonly values: ReadonlyMap<string, string>;
  readonly verbose: number;
  readonly configPatch: Record<string, unknown>;
  readonly switches: SwitchPatch;
  readonly stage: StageFlags;
  /** Flags accepted, understood, and deliberately without effect — each with the reason printed to the user. */
  readonly inert: readonly { readonly name: string; readonly reason: string }[];
  readonly errors: readonly string[];
  readonly help: boolean;
  readonly version: boolean;
}

function setPath(target: Record<string, unknown>, path: readonly string[], value: unknown): void {
  let node = target;
  for (const [index, key] of path.entries()) {
    if (index === path.length - 1) {
      node[key] = value;
      return;
    }
    const next = node[key];
    if (next === undefined || typeof next !== 'object' || Array.isArray(next)) node[key] = {};
    node = node[key] as Record<string, unknown>;
  }
}

function coerce(spec: FlagSpec, raw: string, errors: string[]): string | number | boolean | null {
  if (spec.kind === 'boolean') {
    if (raw === '' || raw === 'true') return true;
    if (raw === 'false') return false;
    errors.push(
      `${spec.name} is a boolean: pass --${spec.name.replace(/^--/u, '')} or --${spec.name.replace(/^--/u, '')}=false`,
    );
    return null;
  }
  if (spec.kind === 'number') {
    const value = Number(raw);
    if (!Number.isFinite(value)) {
      errors.push(`${spec.name} needs a number, got ${JSON.stringify(raw)}`);
      return null;
    }
    return value;
  }
  // A flag with no `choices` takes any string — `--out` has one value and it is a path. Where a list exists, an
  // inert value is a *known* value: it passes the check here and is reported by the loop below, so only a value
  // neither list contains is a typo worth stopping for.
  if (spec.choices !== undefined || spec.inertValues !== undefined) {
    const allowed = [...(spec.choices ?? []), ...Object.keys(spec.inertValues ?? {})];
    if (!allowed.includes(raw)) {
      errors.push(`${spec.name} must be one of ${allowed.join(', ')}`);
      return null;
    }
  }
  return raw;
}

/** Every `--flag` the table knows, for the completeness test. */
export function flagNames(): readonly string[] {
  return FLAGS.map((spec) => spec.name).sort();
}

/**
 * Split argv into a verb, files, flags and a config patch.
 *
 * A flag may be written `--x v`, `--x=v`, or (for booleans) bare. A value that begins with `--` is not swallowed,
 * so `--out --json` is reported as a missing value rather than silently writing to a directory named `--json`.
 */
export function parseInvocation(argv: readonly string[]): Invocation {
  const errors: string[] = [];
  const files: string[] = [];
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const configPatch: Record<string, unknown> = {};
  const switches: SwitchPatch = {};
  const inert: { name: string; reason: string }[] = [];
  const verb = (argv[0] !== undefined && !argv[0].startsWith('-') ? argv[0] : null) as Verb | null;
  if (verb !== null && !VERBS.includes(verb)) {
    errors.push(`unknown command "${verb}" — expected one of ${VERBS.join(', ')}`);
  }

  let verbose = 0;
  for (let index = verb === null ? 0 : 1; index < argv.length; index += 1) {
    const token = argv[index] as string;
    if (!token.startsWith('--')) {
      files.push(token);
      continue;
    }
    const equals = token.indexOf('=');
    const name = equals === -1 ? token : token.slice(0, equals);
    const spec = BY_NAME.get(name);
    if (spec === undefined) {
      errors.push(`unknown flag ${name}`);
      continue;
    }
    if (spec.verbs !== undefined && verb !== null && !spec.verbs.includes(verb)) {
      errors.push(`${name} applies to ${spec.verbs.join('/')}, not to ${verb}`);
      continue;
    }
    let raw = equals === -1 ? '' : token.slice(equals + 1);
    if (spec.kind !== 'boolean' && raw === '') {
      const next = argv[index + 1];
      if (next === undefined || next.startsWith('--')) {
        errors.push(`${name} needs a value`);
        continue;
      }
      raw = next;
      index += 1;
    }
    if (name === '--verbose') {
      verbose += 1;
      flags.add(name);
      continue;
    }
    const value = coerce(spec, raw, errors);
    if (value === null) continue;
    flags.add(name);
    values.set(name, typeof value === 'string' ? value : String(value));
    if (spec.inertValues !== undefined && typeof value === 'string' && spec.inertValues[value] !== undefined) {
      inert.push({ name: `${name}=${value}`, reason: spec.inertValues[value] as string });
      continue;
    }
    if (spec.inert !== undefined) {
      inert.push({ name, reason: spec.inert });
      continue;
    }
    if (spec.config !== undefined) setPath(configPatch, spec.config, value);
    if (spec.switch !== undefined) switches[spec.switch] = value === true;
  }

  const stage: StageFlags = {
    strict: flags.has('--strict'),
    // `--strict` turns a FileLength mismatch into an error; `--tolerate-length` is the explicit opt-out that
    // wins for that one check, exactly as `forge-decompile` reads the pair.
    strictLength: flags.has('--strict') && !flags.has('--tolerate-length'),
    strictTimeline: flags.has('--strict-timeline'),
    sourceMaps: (values.get('--sourcemap') ?? 'file') as SourceMapMode,
  };
  return {
    verb,
    files,
    flags,
    values,
    verbose,
    configPatch,
    switches,
    stage,
    inert,
    errors,
    help: flags.has('--help') || verb === null,
    version: flags.has('--version'),
  };
}
