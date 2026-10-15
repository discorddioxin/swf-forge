/**
 * The `report` stage: `build-info.json`, `porting-notes.json` with its human projection, and `divergence.json`
 * (`WP-120-11`; `IMPL-120` §4's last three root artifacts, `CMP` §4.9's S9 Report).
 *
 * The stage is a *projection* of what the run already proved, and that one sentence decides most of the design:
 *
 * 1. **Rows come from stage artifacts, never from the live diagnostic sink.** A cached stage restores its outcome
 *    from its cache entry and its sink rows are not replayed — `CMP-R040`, and the reason
 *    `ModelArtifact.readInterruptions` exists at the model stage. A report reading `ctx.diagnostics` would print a
 *    different file for a warm build than for a cold one, and `T-CMP-003`'s proof is `diff -r` over the whole
 *    output directory, so a report byte that moves with cache state fails the determinism gate for a reason nobody
 *    can see in the compiler. Where a message is needed it comes from the code registry
 *    (`codeInfo(code).meaning`), which reads the same on either path. The gap that leaves — a diagnostic only the
 *    sink carried — is stated in the file as `diagnosticsScope` rather than hidden, and `E-051` asks P6's
 *    determinism package to move diagnostics onto the cacheable artifacts so the list can become exhaustive.
 * 2. **A value the build was not given is withheld, not zero-filled** — `SF0509`, the same rule the manifest's
 *    `SF0507` applies. `"pins": []` would say the register was consulted and came back empty, and a porter reading
 *    `openItems: 0` would ship a claim the build never made. Per-chapter pin status, the `[verify]` items
 *    (`T-TST-003` requires each to appear), the fidelity tier (`ARCH-R003`) and the expected-divergence
 *    declarations all live in documents a stage may not read — `CMP-R002` keeps the filesystem off a stage's
 *    effect set — so the CLI (`WP-120-13`) supplies them as stage options, the way it supplies `--sourcemap`.
 * 3. **`IMPL-120-R021`'s MUST NOT is checked, not trusted.** The rule forbids the host name, the absolute input
 *    path, and a wall-clock timestamp in a hashed artifact, and a prohibition nobody tests is a prohibition that
 *    returns with the next field added. `findHostLeaks` scans the composed document and the stage writes no report
 *    file when it finds one (`SF0511`): a report missing for a stated reason is a build a porter can diagnose,
 *    while a report carrying `/home/runner/work/…` is a build that cannot be reproduced in public. Refusing the
 *    stage rather than shipping two of three files is deliberate — the three are read together, and a partial set
 *    is what gets mistaken for "the build had nothing to say".
 *
 * `divergence.json` carries only what the project *declared*. It is the harness's expectation of a difference, so
 * a compiler inventing entries from its own refusals would be the compiler setting its own tolerance, which is
 * what the decision register exists to prevent; the build's omissions are `porting-notes.json`'s business, and it
 * names them. `divergenceCitations` and `checkDivergenceCompleteness` give `WP-120-12`'s `verify` the
 * "divergence list is complete with respect to decision IDs cited in emitted code" row as a pure function, in the
 * shape `checkManifestAssets` set for the manifest.
 *
 * All three files go through `emit/json.ts`, for the reason §4.3 gives for the manifest pair: sorted keys and
 * checked numbers are one policy, and a second writer is where two artifacts start disagreeing about what
 * canonical means. The markdown is generated from the same object, so the human file cannot drift from the machine
 * one — `IMPL-120-R025`'s rule for the CLI, applied to a file.
 */

import { Codes, codeInfo } from '@swf-forge/swf';

import { configHash } from '../config.js';
import type { ForgeConfig, RunSwitches } from '../config.js';
import type { EmitArtifact } from '../emit/index.js';
import { writeJson } from '../emit/json.js';
import type { JsonLike, JsonObject } from '../emit/json.js';
import type { EmittedFile, PipelineState, Stage, StageOutcome } from '../pipeline.js';

/** All three files carry one version, so a reader needs one rule to know whether it may parse them. */
export const REPORT_SCHEMA_VERSION = 1;
export const BUILD_INFO_SCHEMA_URL = 'https://swf-forge.dev/schema/build-info-1.json';
export const PORTING_NOTES_SCHEMA_URL = 'https://swf-forge.dev/schema/porting-notes-1.json';
/** `CMP` §4.9 prints this URL in its example, so it is quoted rather than invented. */
export const DIVERGENCE_SCHEMA_URL = 'https://swf-forge.dev/schema/divergence-1.json';

/**
 * `IMPL-120-R028`'s budget lines whose inputs belong to the asset planner. Residual bytecode bytes *are* known —
 * `WP-120-09` counted them — so that one is stated and the rest withheld: the difference between an unfinished
 * report and a false one.
 */
export const BUDGETS_WITHHELD: readonly string[] = [
  'audioBytes',
  'bundleBytesByModuleGroup',
  'firstFrameWork',
  'textureBytes',
  'videoBytes',
];

/** The inputs a report cannot obtain for itself, named in the order a reader checks them. */
export const REPORT_INPUT_NAMES: readonly ('pins' | 'verifyItems' | 'tier' | 'divergences')[] = [
  'pins',
  'verifyItems',
  'tier',
  'divergences',
];

/** A document's pin state, as `gen_status`'s table records it: ✅ is `done`, ⏳ is `partial`. */
export interface ChapterPin {
  readonly doc: string;
  readonly state: 'done' | 'partial';
  readonly openItems?: number;
}

/** One `[verify]` item from the specs; `T-TST-003` requires each to appear in the run summary. */
export interface VerifyItem {
  readonly id: string;
  readonly source: string;
  readonly summary: string;
}

/** `ARCH-R003`'s tier claim (as printed in `000-architecture.md` §6): the tier and what is supposed to back it. */
export interface TierClaim {
  readonly tier: 'C0' | 'C1' | 'C2';
  readonly backing?: readonly string[];
}

/** One expected divergence, in `CMP` §4.9's shape. `F1`…`F4` are `docs/specs/README.md`'s fidelity levels. */
export interface DivergenceDeclaration {
  readonly decision: string;
  readonly fidelity: 'F1' | 'F2' | 'F3' | 'F4';
  readonly scope: {
    readonly kind: string;
    readonly id?: number;
    readonly name?: string;
    readonly offset?: number;
  };
  readonly summary: string;
  readonly measured?: { readonly metric: string; readonly value: number; readonly threshold: number };
  readonly actionRequired?: boolean;
}

export interface ReportOptions {
  readonly pins?: readonly ChapterPin[];
  readonly verifyItems?: readonly VerifyItem[];
  readonly tier?: TierClaim;
  readonly divergences?: readonly DivergenceDeclaration[];
  /** The build host's name, when the caller knows it — the only way the leak check can look for that string. */
  readonly hostName?: string;
}

export interface ReportFinding {
  readonly subject: string;
  readonly error: string;
}

/** What the stage recorded for the CLI (`WP-120-13`) and for `swfforge report`'s exit verdict. */
export interface ReportArtifact {
  readonly fileCount: number;
  readonly bytes: number;
  readonly withheldInputs: readonly string[];
  readonly withheldBudgets: readonly string[];
  readonly invalidDivergences: readonly ReportFinding[];
  /** True when `SF0511` stopped the stage, so a caller can tell "no report" from "nothing to report". */
  readonly refused: boolean;
  readonly manifestWithheld: readonly string[];
}

export interface ReportResult {
  readonly files: readonly EmittedFile[];
  readonly buildInfo: JsonObject;
  readonly portingNotes: JsonObject;
  readonly divergence: JsonObject;
  readonly withheldInputs: readonly string[];
  readonly withheldBudgets: readonly string[];
  readonly invalidDivergences: readonly ReportFinding[];
  /** Why no report was written, or `null`. Non-`null` means `files` is empty. */
  readonly leak: string | null;
  readonly manifestWithheld: readonly string[];
}

const encoder = new TextEncoder();

/** Every scalar leaf under `node`, dotted and prefixed, so a config key cannot be forgotten out of the gate list. */
function scalarLeaves(node: unknown, prefix: string, into: JsonObject = {}): JsonObject {
  if (node === null || typeof node !== 'object') {
    into[prefix] =
      typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean' ? node : String(node);
    return into;
  }
  if (Array.isArray(node)) {
    into[prefix] = node.map((item) => String(item)).join(',');
    return into;
  }
  for (const key of Object.keys(node).sort()) {
    const child = (node as JsonObject)[key];
    if (child === undefined) continue;
    scalarLeaves(child, `${prefix}.${key}`, into);
  }
  return into;
}

/** The gates as one flat map: every config leaf, every run switch, and the emit stage's two source-map answers. */
export function gatesOf(config: ForgeConfig, switches: RunSwitches, emit?: EmitArtifact): JsonObject {
  const gates = { ...scalarLeaves(config, 'config'), ...scalarLeaves(switches, 'switches') };
  if (emit !== undefined) {
    gates['emit.sourcemapRequested'] = emit.sourceMapRequested;
    gates['emit.sourcemapWritten'] = emit.sourceMapWritten;
  }
  return gates;
}

/** A diagnostic row rebuilt from the code registry, the only severity-and-sentence source a warm run also has. */
export function registryRow(code: string, origin: string, extra: JsonObject): JsonObject {
  const info = codeInfo(code);
  return {
    code,
    origin,
    severity: info?.severity ?? 'error',
    // The run's own sentence is gone after a cache hit; the registry's meaning says what the code asserts, which
    // is what a porter needs from a file, and it says the same thing on both paths.
    message: info?.meaning ?? 'no registry meaning for this code',
    ...extra,
  };
}

/**
 * Every diagnostic the run can prove from its artifacts: the model's read interruptions, the descriptors that
 * would have lied, and a manifest the emitter refused to serialize. A refused block is not here, because a refusal
 * is a *decision* the emitter already lists — and `SF0506`'s errors are the report's `summary`, not a second copy.
 */
export function reportDiagnostics(state: PipelineState): readonly JsonObject[] {
  const rows: JsonObject[] = [];
  for (const entry of state.model?.readInterruptions ?? []) {
    rows.push(
      registryRow(
        entry.code,
        // The row is what the model stage *attributed*, not necessarily what the reader claimed: attribution is by
        // offset span, and a container-level diagnostic carries an offset in the input file rather than in the
        // decompressed body, so it can fall inside a character's span. The row names its own origin instead of
        // letting a reader infer a claim the reader never made (`E-051`).
        'model stage: read interruption attributed to a dictionary entry',
        { characterId: entry.characterId },
      ),
    );
  }
  const emit: EmitArtifact | undefined = state.emit;
  if (emit !== undefined) {
    for (const invalid of emit.plan.invalidResidual) {
      rows.push(
        registryRow(Codes.RESIDUAL_DESCRIPTOR_INVALID, 'emit stage: residual descriptor refused', {
          subject: invalid.subjectId,
          reason: invalid.error,
        }),
      );
    }
    if (emit.plan.manifestError !== null) {
      rows.push(
        registryRow(Codes.MANIFEST_UNSERIALIZABLE, 'emit stage: manifest refused', {
          reason: emit.plan.manifestError,
        }),
      );
    }
  }
  return rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/** Every decision the run made, tagged with the pass or stage that made it, so a report row has an author. */
export function reportDecisions(state: PipelineState): readonly JsonObject[] {
  const rows: JsonObject[] = [];
  for (const pass of state.passes ?? []) {
    for (const decision of pass.decisions) {
      rows.push({ source: pass.id, subject: decision.subject, action: decision.action, reason: decision.reason });
    }
  }
  for (const decision of state.emit?.plan.decisions ?? []) {
    rows.push({ source: 'emit', subject: decision.subject, action: decision.action, reason: decision.reason });
  }
  return rows.sort((a, b) =>
    `${String(a['source'])}/${String(a['subject'])}`.localeCompare(`${String(b['source'])}/${String(b['subject'])}`),
  );
}

/** Bytes per module group — an accounting fact about this build, not `IMPL-120-R028`'s budget claim. */
export function bytesByModuleGroup(files: readonly { path: string; text: string }[]): JsonObject {
  const totals = new Map<string, number>();
  for (const file of files) {
    const segments = file.path.split('/');
    const group = segments.length > 2 ? `${segments[0]}/${segments[1]}` : (segments[0] ?? '');
    totals.set(group, (totals.get(group) ?? 0) + encoder.encode(file.text).length);
  }
  const out: JsonObject = {};
  for (const group of [...totals.keys()].sort()) out[group] = totals.get(group) ?? 0;
  return out;
}

/**
 * `CMP` §4.9's entry, validated. A declaration that does not fit is refused rather than carried: the harness reads
 * this file as its expectation, so a half-validated entry makes the harness accept the very divergence it was
 * written to catch.
 */
export function divergenceEntry(
  declaration: DivergenceDeclaration,
): { readonly entry: JsonObject } | { readonly error: string } {
  const problems: string[] = [];
  if (!/^[A-Z][A-Z0-9]{1,6}-D\d{2,3}$/u.test(declaration.decision)) {
    problems.push('`decision` must be a decision-register id such as `GFX-D04`');
  }
  if (!['F1', 'F2', 'F3', 'F4'].includes(declaration.fidelity)) {
    problems.push('`fidelity` must be one of the four levels docs/specs/README.md defines');
  }
  if (declaration.summary.trim() === '') {
    problems.push('`summary` must say what differs, not only that something does');
  }
  if (declaration.scope.kind.trim() === '') {
    problems.push('`scope.kind` is what stops a divergence applying to the whole movie by accident');
  }
  const measured = declaration.measured;
  if (measured !== undefined) {
    if (measured.metric.trim() === '') problems.push('`measured.metric` names the metric');
    if (!Number.isFinite(measured.value) || !Number.isFinite(measured.threshold)) {
      problems.push('`measured` numbers must be finite, or the comparison decides nothing');
    }
  }
  if (problems.length > 0) return { error: problems.join('; ') };
  return {
    entry: {
      actionRequired: declaration.actionRequired === true,
      decision: declaration.decision,
      fidelity: declaration.fidelity,
      ...(measured === undefined
        ? {}
        : {
            measured: { metric: measured.metric, threshold: measured.threshold, value: measured.value },
          }),
      scope: {
        ...(declaration.scope.id === undefined ? {} : { id: declaration.scope.id }),
        kind: declaration.scope.kind,
        ...(declaration.scope.offset === undefined ? {} : { offset: declaration.scope.offset }),
        ...(declaration.scope.name === undefined ? {} : { name: declaration.scope.name }),
      },
      summary: declaration.summary,
    },
  };
}

/**
 * Decision ids cited in emitted code — `CMP` §4.10's phrase, made into a scan. Only comment text counts, because a
 * citation is a comment about a choice and a string constant that happens to look like an id is the movie's data
 * rather than the build's claim.
 */
export function divergenceCitations(files: readonly { path: string; text: string }[]): readonly string[] {
  const found = new Set<string>();
  for (const file of files) {
    for (const line of file.text.split('\n')) {
      const marker = line.indexOf('//');
      const comment = marker >= 0 ? line.slice(marker) : /^\s*\*/u.test(line) ? line : '';
      if (comment === '') continue;
      for (const match of comment.matchAll(/\b[A-Z][A-Z0-9]{1,6}-D\d{2,3}\b/gu)) found.add(match[0]);
    }
  }
  return [...found].sort();
}

/**
 * `CMP` §4.10's completeness row as data: an id the emitted code cites without a declaration is an undocumented
 * divergence, and an id declared with nothing citing it is a stale expectation the harness still forgives.
 */
export function checkDivergenceCompleteness(
  declarations: readonly { decision: string }[],
  citations: readonly string[],
): { readonly undeclared: readonly string[]; readonly unreferenced: readonly string[] } {
  const declared = new Set(declarations.map((entry) => entry.decision));
  const cited = new Set(citations);
  return {
    undeclared: [...cited].filter((id) => !declared.has(id)).sort(),
    unreferenced: [...declared].filter((id) => !cited.has(id)).sort(),
  };
}

/**
 * `IMPL-120-R021`'s MUST NOT, as a check. Three shapes: an absolute path on either host family, a wall-clock
 * timestamp (ISO-8601 to the second, or the 10- and 13-digit epoch forms a `Date.now()` leaves behind), and the
 * host name where the caller knows it. Nothing legitimate in these files is a path or a clock — a `sha256` is hex,
 * a frame count is small, a byte total is not 1.6×10⁹ — so the patterns are allowed to be strict.
 */
export function findHostLeaks(value: JsonLike, hostName?: string): readonly string[] {
  const absolutePath =
    /(?:^|["'\s(=])(?:\/(?:home|Users|mnt|private|Volumes|var|etc|workspace|actions-runner)\b|[A-Za-z]:[\\/])/u;
  const clock = /\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/u;
  const epoch = /(?<![\d.])1[6-9]\d{8}(?:\d{3})?(?![\d.])/u;
  const problems: string[] = [];
  const walk = (node: JsonLike, path: string): void => {
    if (typeof node === 'string') {
      if (absolutePath.test(node)) problems.push(`${path} looks like an absolute path on the build host`);
      if (clock.test(node)) problems.push(`${path} looks like a wall-clock timestamp`);
      if (hostName !== undefined && hostName !== '' && node.includes(hostName)) {
        problems.push(`${path} contains the build host's name`);
      }
      return;
    }
    if (typeof node === 'number') {
      if (epoch.test(String(node))) problems.push(`${path} looks like an epoch timestamp`);
      return;
    }
    if (node === null || typeof node !== 'object') return;
    if (Array.isArray(node)) {
      node.forEach((item, index) => walk(item, `${path}[${index}]`));
      return;
    }
    for (const key of Object.keys(node).sort()) walk((node as JsonObject)[key] as JsonLike, `${path}.${key}`);
  };
  walk(value, '$');
  return problems;
}

/** The `IMPL-120-R021`/§4 vocabulary for a gap: what is missing, why, and that it is a gap and not a zero. */
function withheld(what: string, why: string): JsonObject {
  return { reason: why, state: 'withheld', what };
}

/** The report files, as data. Pure over the state and the options: no clock, no filesystem, no environment. */
export function buildReport(input: {
  readonly state: PipelineState;
  readonly config: ForgeConfig;
  readonly switches: RunSwitches;
  readonly toolVersion: string;
  readonly inputName: string;
  readonly sha256: string;
  readonly inputBytes: number;
  readonly options?: ReportOptions;
  readonly compact?: boolean;
}): ReportResult {
  const options: ReportOptions = input.options ?? {};
  const state = input.state;
  const emit: EmitArtifact | undefined = state.emit;
  const compact = input.compact === true;

  const withheldInputs = REPORT_INPUT_NAMES.filter((name) => options[name] === undefined);
  const gates = gatesOf(input.config, input.switches, emit);
  const decisions = reportDecisions(state);
  const diagnostics = reportDiagnostics(state);

  const invalidDivergences: ReportFinding[] = [];
  const entries: JsonObject[] = [];
  for (const declaration of options.divergences ?? []) {
    const built = divergenceEntry(declaration);
    if ('error' in built) {
      invalidDivergences.push({ subject: declaration.decision, error: built.error });
      continue;
    }
    entries.push(built.entry);
  }

  const buildInfo: JsonObject = {
    $schema: BUILD_INFO_SCHEMA_URL,
    budgetSummary: {
      ...{ residualBytecodeBytes: emit?.residualBytes ?? 0 },
      source: 'WP-120-07 (the asset planner) computes the rest; this phase has not built it',
      withheld: [...BUDGETS_WITHHELD],
    },
    configHashes: { emit: configHash(input.config, 'emit'), report: configHash(input.config, 'report') },
    decisions: { count: decisions.length, bySource: countBy(decisions, 'source') },
    gates,
    input: { bytes: input.inputBytes, file: input.inputName, sha256: input.sha256 },
    output: {
      bytes: emit?.bytes ?? 0,
      files: emit?.fileCount ?? 0,
      manifest: {
        artifacts: emit?.plan.manifest === null || emit === undefined ? 0 : 2,
        error: emit?.plan.manifestError ?? null,
        withheldSections: emit?.plan.manifest?.withheld ?? [],
      },
      moduleGroupBytes: bytesByModuleGroup(emit?.plan.files ?? []),
    },
    pins:
      options.pins === undefined
        ? withheld(
            'per-chapter pin status',
            'the register is docs/impl/registers/STATUS.md, which a stage may not read (CMP-R002)',
          )
        : {
            chapters: options.pins
              .map((pin) => ({
                doc: pin.doc,
                openItems: pin.openItems ?? 0,
                state: pin.state,
              }))
              .sort((a, b) => a.doc.localeCompare(b.doc)),
            source: 'the generated register, supplied by the caller (WP-120-13)',
          },
    residual: {
      blobs: emit?.residualCount ?? 0,
      bytes: emit?.residualBytes ?? 0,
      deferred: emit?.hasDeferred === true,
      invalidDescriptors: emit?.plan.invalidResidual.length ?? 0,
      policy: emit?.residualPolicy ?? input.config.vm.residual,
    },
    schemaVersion: REPORT_SCHEMA_VERSION,
    tool: { name: 'swf-forge', version: input.toolVersion },
  };

  const portingNotes: JsonObject = {
    $schema: PORTING_NOTES_SCHEMA_URL,
    decisions,
    diagnostics,
    diagnosticsScope:
      'stage artifacts only: a cached stage does not replay its sink rows (CMP-R040), so a report that read the live sink would differ between a cold and a warm build (E-051 asks P6 to move diagnostics onto the artifacts)',
    gates,
    movie: { file: input.inputName, sha256: input.sha256 },
    schemaVersion: REPORT_SCHEMA_VERSION,
    summary: {
      decisions: decisions.length,
      diagnostics: diagnostics.length,
      errors: countBySeverity(diagnostics, 'error'),
      infos: countBySeverity(diagnostics, 'info'),
      warnings: countBySeverity(diagnostics, 'warning'),
    },
    tier:
      options.tier === undefined
        ? withheld(
            'the fidelity tier',
            'ARCH-R003 requires a build to state its tier, and the claim is a project decision rather than a compiler result',
          )
        : { backing: options.tier.backing ?? [], tier: options.tier.tier },
    verifyItems:
      options.verifyItems === undefined
        ? withheld(
            'every [verify] item',
            'T-TST-003 checks the list is complete; the markers live in the spec tables, which a stage may not read (CMP-R002)',
          )
        : {
            items: options.verifyItems
              .map((item) => ({ id: item.id, source: item.source, summary: item.summary }))
              .sort((a, b) => a.id.localeCompare(b.id)),
            total: options.verifyItems.length,
          },
  };

  const divergence: JsonObject = {
    $schema: DIVERGENCE_SCHEMA_URL,
    // `entries: []` alone cannot tell "the project declared none" from "nobody asked", and the harness treats the
    // two differently: an empty expectation list forgives every divergence the build shows.
    declarations:
      options.divergences === undefined
        ? withheld(
            'the expected-divergence declarations',
            'CMP-§4.9 asks the porter to declare them, and a compiler that invents its own tolerance is the divergence nobody catches',
          )
        : { source: 'declared by the project, supplied by the caller (WP-120-13)', total: options.divergences.length },
    entries: entries.sort((a, b) => String(a['decision']).localeCompare(String(b['decision']))),
    movie: { file: input.inputName, sha256: input.sha256 },
    schemaVersion: REPORT_SCHEMA_VERSION,
    // Reported rather than enforced here: `verify` owns the verdict, the report owns the data.
    undeclaredCitations: checkDivergenceCompleteness(
      entries.map((entry) => ({ decision: String(entry['decision'] ?? '') })),
      divergenceCitations(emit?.plan.files ?? []),
    ).undeclared,
  };

  const documents: readonly { value: JsonObject; subject: string; paths: readonly string[] }[] = [
    { value: buildInfo, subject: 'build-info', paths: ['build-info.json'] },
    { value: portingNotes, subject: 'porting notes', paths: ['porting-notes.json', 'reports/porting-notes.md'] },
    { value: divergence, subject: 'divergence list', paths: ['divergence.json'] },
  ];

  const problems: string[] = [];
  for (const document of documents) {
    for (const problem of findHostLeaks(document.value, options.hostName)) {
      problems.push(`${document.subject}: ${problem}`);
    }
  }
  const texts = new Map<string, string>();
  if (problems.length === 0) {
    for (const document of documents) {
      const out = writeJson(document.value, { subject: document.subject, compact });
      if ('error' in out) {
        problems.push(`${document.subject}: ${out.error}`);
        continue;
      }
      for (const path of document.paths) {
        texts.set(path, path.endsWith('.md') ? renderPortingNotesMarkdown(document.value) : `${out.text}\n`);
      }
    }
  }

  return {
    buildInfo,
    divergence,
    files:
      problems.length > 0 ? [] : [...texts.entries()].map(([path, text]) => ({ path, bytes: encoder.encode(text) })),
    invalidDivergences,
    leak: problems.length === 0 ? null : problems.join('; '),
    manifestWithheld: emit?.plan.manifest?.withheld ?? [],
    portingNotes,
    withheldBudgets: [...BUDGETS_WITHHELD],
    withheldInputs,
  };
}

function countBy(rows: readonly JsonObject[], key: string): JsonObject {
  const counts: JsonObject = {};
  for (const row of rows) {
    const value = String(row[key] ?? '');
    const prior = counts[value];
    counts[value] = (typeof prior === 'number' ? prior : 0) + 1;
  }
  return counts;
}

function countBySeverity(rows: readonly JsonObject[], severity: string): number {
  return rows.filter((row) => row['severity'] === severity).length;
}

/** The human projection `CMP` §4.9 describes, from the same object: a section per list, nothing re-derived. */
export function renderPortingNotesMarkdown(notes: JsonObject): string {
  const cell = (value: JsonLike | undefined): string =>
    value === undefined ? '' : String(value).replace(/\|/gu, '\\|').replace(/\n/gu, ' ');
  const lines: string[] = [];
  lines.push(
    '<!-- AUTO-GENERATED by swf-forge (WP-120-11). Regenerate with `swfforge build <input.swf> --out <dir>`. -->',
  );
  lines.push('');
  lines.push('# Porting notes');
  lines.push('');
  const movie = notes['movie'] as JsonObject | undefined;
  lines.push(`Movie: \`${cell(movie?.['file'])}\` (sha256 \`${cell(movie?.['sha256'])}\`)`);
  lines.push('');
  lines.push('## Porting tier');
  lines.push('');
  const tier = notes['tier'] as JsonObject | undefined;
  if (tier?.['tier'] !== undefined) {
    const backing = (tier['backing'] as readonly string[] | undefined) ?? [];
    lines.push(
      `Claimed **${cell(tier['tier'])}**, backed by ${
        backing.length === 0
          ? 'no CI artefacts — the claim is unverified, and `ARCH-R003` says shipping it as a finished port is forbidden by process'
          : backing.map((entry) => `\`${cell(entry)}\``).join(', ')
      }.`,
    );
  } else {
    lines.push(
      `This build states no tier: ${cell(tier?.['reason'])}. \`ARCH-R003\` requires the claim, so run the CLI with the register inputs supplied.`,
    );
  }
  lines.push('');
  const summary = notes['summary'] as JsonObject | undefined;
  lines.push('## Run summary');
  lines.push('');
  lines.push('| diagnostics | errors | warnings | infos | decisions |');
  lines.push('| --- | --- | --- | --- | --- |');
  lines.push(
    `| ${cell(summary?.['diagnostics'])} | ${cell(summary?.['errors'])} | ${cell(summary?.['warnings'])} | ${cell(summary?.['infos'])} | ${cell(summary?.['decisions'])} |`,
  );
  lines.push('');
  lines.push(String(notes['diagnosticsScope'] ?? ''));
  lines.push('');
  for (const [heading, key, columns] of [
    ['Diagnostics', 'diagnostics', ['code', 'severity', 'origin', 'subject', 'characterId', 'message']],
    ['Decisions', 'decisions', ['source', 'subject', 'action', 'reason']],
  ] as const) {
    const rows = (notes[key] as readonly JsonObject[] | undefined) ?? [];
    lines.push(`## ${heading}`);
    lines.push('');
    if (rows.length === 0) {
      lines.push('None.');
      lines.push('');
      continue;
    }
    lines.push(`| ${columns.join(' | ')} |`);
    lines.push(`| ${columns.map(() => '---').join(' | ')} |`);
    for (const row of rows) lines.push(`| ${columns.map((column) => cell(row[column])).join(' | ')} |`);
    lines.push('');
  }
  const verify = notes['verifyItems'] as JsonObject | undefined;
  lines.push('## Open `[verify]` items');
  lines.push('');
  if (verify?.['items'] === undefined) {
    lines.push(
      `Not supplied to this build: ${cell(verify?.['reason'])}. \`T-TST-003\` checks the harness sees every item.`,
    );
  } else {
    for (const item of verify['items'] as readonly JsonObject[]) {
      lines.push(`- \`${cell(item['id'])}\` (${cell(item['source'])}): ${cell(item['summary'])}`);
    }
  }
  lines.push('');
  lines.push('## Gates');
  lines.push('');
  lines.push('| gate | value |');
  lines.push('| --- | --- |');
  const gates = (notes['gates'] as JsonObject | undefined) ?? {};
  for (const key of Object.keys(gates).sort()) lines.push(`| \`${key}\` | ${cell(gates[key])} |`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

const REPORT_EFFECTS = {
  reads: [],
  writes: ['build-info.json', 'porting-notes.json', 'divergence.json', 'reports/porting-notes.md'],
} as const;

/** The `report` stage. Registered by `WP-120-13`'s CLI the way the other stages are; a run without it is `SF0500`. */
export function reportStage(options: ReportOptions = {}): Stage {
  return {
    id: 'report',
    effects: REPORT_EFFECTS,
    run(state, ctx): StageOutcome {
      const built = buildReport({
        state,
        config: ctx.config,
        switches: ctx.switches,
        toolVersion: ctx.toolVersion,
        inputName: ctx.input.name,
        sha256: ctx.input.sha256,
        inputBytes: ctx.input.bytes.length,
        options,
      });
      for (const finding of built.invalidDivergences) {
        ctx.diagnostics.emit({
          code: Codes.DIVERGENCE_DECLARATION_INVALID ?? 'SF0510',
          severity: 'error',
          message: `the declaration for ${finding.subject} is not carried into divergence.json: ${finding.error}`,
          offset: 0,
          context: 'compile',
        });
      }
      if (built.leak !== null) {
        ctx.diagnostics.emit({
          code: Codes.REPORT_HOST_LEAK ?? 'SF0511',
          severity: 'error',
          message: `no report file was written, because one of them would carry build-host identity: ${built.leak}`,
          offset: 0,
          context: 'compile',
        });
      } else if (built.withheldInputs.length > 0) {
        ctx.diagnostics.emit({
          code: Codes.REPORT_INPUTS_WITHHELD ?? 'SF0509',
          severity: 'warning',
          message:
            `the report states a gap instead of a value for ${built.withheldInputs.join(', ')}: those inputs come ` +
            'from the registers and spec tables the CLI supplies (WP-120-13), and an empty list would read as "the build looked and found nothing"',
          offset: 0,
          context: 'compile',
        });
      }
      const refused = built.leak !== null;
      const artifact: ReportArtifact = {
        bytes: built.files.reduce((total, file) => total + file.bytes.byteLength, 0),
        fileCount: built.files.length,
        invalidDivergences: built.invalidDivergences,
        manifestWithheld: built.manifestWithheld,
        refused,
        withheldBudgets: built.withheldBudgets,
        withheldInputs: built.withheldInputs,
      };
      // A leaked report is a builder defect, not an input problem: the stage still returns its artifact, because
      // the run's verdict comes from the error diagnostic, and a stage that stops the run would hide which file
      // the porter has to fix.
      return { state: { report: artifact }, files: refused ? [] : built.files };
    },
  };
}
