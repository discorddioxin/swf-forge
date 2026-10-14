/**
 * The pipeline runner — `WP-120-01`, `IMPL-120` §2, `CMP` §2/§12.
 *
 * Stage spine. `IMPL-120` §2 names the build stages and who supplies each one; `CMP` §2 numbers them
 * S0–S10. The mapping is not one-to-one and the runner states it explicitly rather than hiding it:
 *
 * | stage     | IMPL-120 §2                        | CMP §2          | supplied by |
 * | --------- | ---------------------------------- | --------------- | ----------- |
 * | `read`    | read → `openSwf`, index, dictionary | S0 Load + S1 Parse | `WP-020-10` (P1) — the delivered `SwfFile` facade builds the tag index and dictionary in the same pass, so S0 and S1 are one call, not two |
 * | `model`   | model → frames, sprites, control    | S2 Analyse      | `WP-030-09` (P2) |
 * | `decode`  | decode → shapes, images, fonts, sounds, video, buttons | S3 Media decode + S4 Media encode | `WP-060…110` (P3) plus P6's own `WP-070-07`/`WP-080-10`/`WP-080-11`/`WP-110-12`. `CMP-R001` lets S3 and S4 interleave per asset as long as the observable output is as if they were ordered, which is why they share a stage |
 * | `analyze` | analyze → AVM1 front end → IR → tiers → requirements | S5 VM front end + S6 VM analyse | `WP-050-*` (P5) — the delivered `analyzeMovie` produces the IR and the tier verdicts in one pass |
 * | `plan`    | plan → assets plan, budgets, tree-shake decisions | (S8 scheduling) | `WP-120-07` |
 * | `emit`    | emit → TS sources + manifest + assets + reports | S7 Emit TS + S8 Emit assets | `WP-120-08…-11` |
 * | `report`  | (the report files of §4)            | S9 Report       | `WP-120-11` |
 *
 * S10 `verify` is deliberately **not** a build stage: `IMPL-120` §6 makes it its own command over an
 * emitted project (`WP-120-12`), and it must be runnable against output this process did not produce.
 *
 * The five post-model passes of `IMPL-120` §3 (dead code, requirement shake, tier finalise, name
 * assignment, frame scripts) are not stages: they are pure functions over the model and the IR whose
 * decisions land in `plan` and `emit`. They run on their own spine, in `PASS_ORDER`, after `analyze`.
 *
 * Purity (`IMPL-120-R001`, `CMP-R002`). A stage is a function of its declared inputs, the resolved
 * config and the previous stages' outputs. It may not read the clock, the environment, or the filesystem
 * outside its declared effect set — which is why the runner takes the input *bytes* rather than a path,
 * returns the files a stage wants written rather than writing them, and records no durations. Timing is
 * telemetry, and `IMPL-120-R021` keeps it out of any hashed output.
 */

import {
  Codes,
  DiagnosticSink,
  type Diagnostic,
  type DiagnosticSummary,
  type MovieModel,
  type SwfFile,
} from '@swf-forge/swf';
import { sha256Hex } from '@swf-forge/swf/node';
import type { HostApiRequirement, MovieAnalysis } from '@swf-forge/avm1';

import type { FramePlan } from './passes/frames.js';
import type { NameTable } from './passes/names.js';
import { PipelineCancelled, createCancellationToken, type CancellationToken } from './cancel.js';
import { stableForm } from './codec.js';
import { configHash, type ForgeConfig, type RunSwitches, DEFAULT_RUN_SWITCHES } from './config.js';

export type StageId = 'read' | 'model' | 'decode' | 'analyze' | 'plan' | 'emit' | 'report';

/** `CMP-R001`: stages execute in this order. The runner sorts by it, ignoring registration order. */
export const STAGE_ORDER: readonly StageId[] = ['read', 'model', 'decode', 'analyze', 'plan', 'emit', 'report'];

/** `IMPL-120` §3, in the order the passes must run: pruning before shaking, names before frames. */
export type PassId = 'dead-code' | 'shake' | 'tier-finalise' | 'names' | 'frames';

export const PASS_ORDER: readonly PassId[] = ['dead-code', 'shake', 'tier-finalise', 'names', 'frames'];

/** A build failure: our bug, not the input's (`IMPL-120-R026`, exit 1). */
export class PipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PipelineError';
  }
}

/**
 * The files a stage reads and writes (`CMP-R003`). Declaring them is what makes a stage's cache key
 * computable from content hashes alone, and what lets `--verify-cache` detect a stale entry.
 *
 * Paths are relative to the project (inputs) or to `outDir` (outputs); absolute paths would leak the
 * build host into a hashed artifact (`IMPL-120-R021`).
 */
export interface StageEffects {
  readonly reads: readonly string[];
  readonly writes: readonly string[];
}

/** A file a stage wants written. The runner collects them; the writer is `WP-120-13`'s. */
export interface EmittedFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface ReadArtifact {
  readonly file: SwfFile;
  readonly bytes: Uint8Array;
  readonly sha256: string;
  readonly version: number;
  readonly compression: string;
  readonly tagCount: number;
  readonly definitionCount: number;
  readonly spriteRangeCount: number;
}

export interface ModelArtifact {
  readonly model: MovieModel;
  readonly frameCount: number;
  readonly characterCount: number;
  readonly initActionCount: number;
}

export interface AnalysisArtifact {
  readonly analysis: MovieAnalysis;
  /** The host-API requirement union (`IMPL-120-R006`'s input; the shake pass consumes it). */
  readonly requirements: readonly HostApiRequirement[];
  readonly actionBlockCount: number;
  readonly functionCount: number;
  readonly tiers: { readonly T0: number; readonly T1: number; readonly T2: number };
}

/**
 * One pass's decisions, in the shape `IMPL-120-R013` demands: per subject, with a reason, never silent.
 * A pass's own detailed artifact arrives through `PassOutcome.state` when its work package lands.
 */
export interface PassDecision {
  readonly subject: string;
  readonly action: string;
  readonly reason: string;
}

export interface PassReport {
  readonly id: PassId;
  readonly decisions: readonly PassDecision[];
}

/** Everything a run has produced so far. Each field appears when its stage or pass has run. */
export interface PipelineState {
  readonly read?: ReadArtifact;
  readonly model?: ModelArtifact;
  readonly analysis?: AnalysisArtifact;
  /** The closed symbol namespace (`WP-120-05`); `IMPL-120-R012` requires it before emission. */
  readonly names?: NameTable;
  /** The frame-script grouping and hoists (`WP-120-06`). */
  readonly frames?: FramePlan;
  readonly passes?: readonly PassReport[];
}

export interface PipelineInput {
  readonly bytes: Uint8Array;
  /** Display name for effect sets and diagnostic scope; never an absolute path (`IMPL-120-R021`). */
  readonly name: string;
  readonly sha256: string;
}

export interface StageContext {
  readonly config: ForgeConfig;
  readonly switches: RunSwitches;
  readonly diagnostics: DiagnosticSink;
  readonly cancel: CancellationToken;
  readonly input: PipelineInput;
  readonly outDir: string;
  /** Tool identity for cache keys and `build-info.json` (`CMP` §12, `IMPL-120-R021`). */
  readonly toolVersion: string;
}

export interface StageOutcome {
  /** Merged into the pipeline state; a stage that produces no artifact returns none. */
  readonly state?: Partial<PipelineState>;
  readonly files?: readonly EmittedFile[];
  /**
   * `refused` stops the run with the input's own verdict — AVM2 content, `SF1000`, exit 3
   * (`CMP-R031`, `IMPL-120-R026`) — because silently compiling nothing is worse than refusing.
   */
  readonly stop?: 'refused';
  readonly stopReason?: string;
}

/**
 * Serialisation for a cacheable stage's outcome (`CMP-R038`). A stage whose output is a live object —
 * `SwfFile.readTag` is a function, `MovieModel` holds lazy views — declares no codec and is not cached.
 * `structuralStageCodec` in `codec.ts` is the codec a data-shaped stage adopts; it walks the value rather
 * than enumerating fields, so a field added to the IR next month cannot be silently dropped.
 */
export interface StageCodec {
  serialise(outcome: StageOutcome): unknown;
  deserialise(payload: unknown): StageOutcome;
}

/**
 * A stored entry, with the metadata that makes it falsifiable (`CMP-R038`). The key covers the stage, the
 * input hash, the tool version and the relevant config, so a mismatch on any of them means the store was
 * moved between projects or the key derivation changed. The effect set is deliberately *not* in the key:
 * comparing it is what detects a stage that now writes a file it did not write when the entry was made.
 */
export interface StageCacheEntry {
  readonly stage: StageId;
  readonly key: string;
  readonly toolVersion: string;
  readonly inputHash: string;
  readonly configHash: string;
  readonly effects: StageEffects;
  readonly payload: unknown;
}

/** The cache seam. `fileStageCache` in `cache.ts` is the on-disk store; tests substitute a memory one. */
export interface StageCache {
  get(key: string): StageCacheEntry | null;
  put(key: string, entry: StageCacheEntry): void;
  /** Evicts an entry: stale metadata, or drift found by `--verify-cache` (`CMP-R038`). */
  delete(key: string): void;
}

/** A cache that never holds anything — the default, and what `--no-cache` effectively gives a stage. */
export function nullCache(): StageCache {
  return {
    get: (): StageCacheEntry | null => null,
    put: (): void => {},
    delete: (): void => {},
  };
}

/** Why a stored entry is not the entry this run asked for, or `null` when it is (`CMP-R038`). */
export function stalenessOf(stored: StageCacheEntry, expected: StageCacheEntry): string | null {
  if (stored.stage !== expected.stage) return `the entry records stage ${stored.stage}`;
  if (stored.toolVersion !== expected.toolVersion) return `the entry was written by tool version ${stored.toolVersion}`;
  if (stored.inputHash !== expected.inputHash) return 'the entry records a different input hash';
  if (stored.configHash !== expected.configHash) return 'the entry records a different relevant-config hash';
  if (stableForm(stored.effects) !== stableForm(expected.effects)) {
    return 'the stage effect set changed since the entry was written';
  }
  return null;
}

/** `CMP` §12's key: `sha256(stageId ‖ stageInputHash ‖ toolVersion ‖ relevantConfigHash)`. */
export function stageCacheKey(
  stage: StageId,
  inputHash: string,
  toolVersion: string,
  relevantConfigHash: string,
): string {
  const material = `${stage}\u0000${inputHash}\u0000${toolVersion}\u0000${relevantConfigHash}`;
  return sha256Hex(new TextEncoder().encode(material));
}

export interface Stage {
  readonly id: StageId;
  readonly effects: StageEffects;
  /** Present only when the stage's outcome is serialisable; see `StageCodec`. */
  readonly codec?: StageCodec;
  /** Hash of the stage's declared inputs. Absent ⇒ not cacheable. */
  readonly inputHash?: (state: PipelineState, ctx: StageContext) => string;
  run(state: PipelineState, ctx: StageContext): StageOutcome;
}

export interface PassOutcome {
  readonly report: PassReport;
  readonly state?: Partial<PipelineState>;
}

export interface Pass {
  readonly id: PassId;
  run(state: PipelineState, ctx: StageContext): PassOutcome;
}

export type StageStatus =
  'ran' | 'cached' | 'unregistered' | 'dry-run-skipped' | 'refused' | 'cancelled' | 'failed' | 'not-run';

export interface StageReport {
  readonly id: StageId;
  readonly status: StageStatus;
  readonly effects: StageEffects;
  readonly cacheKey: string | null;
  readonly files: number;
  /** Present when `status` is `failed`: the thrown error's name and message, never its stack. */
  readonly error?: { readonly name: string; readonly message: string };
  readonly stopReason?: string;
  /** Under `--verify-cache`: whether recomputing produced the stored bytes (`IMPL-120-R002`). */
  readonly cacheVerified?: 'match' | 'drift';
  /** Why a stored entry was evicted instead of used (`CMP-R038`). */
  readonly cacheEvicted?: string;
}

export interface PassRunReport {
  readonly id: PassId;
  readonly status: 'ran' | 'unregistered' | 'cancelled' | 'failed' | 'not-run';
  readonly decisions: number;
  readonly error?: { readonly name: string; readonly message: string };
}

export type RunStatus = 'complete' | 'dry-run' | 'refused' | 'failed' | 'cancelled';

export interface RunResult {
  readonly status: RunStatus;
  readonly state: PipelineState;
  /** Every file the run wanted written, in stage order. Nothing has been written to disk. */
  readonly files: readonly EmittedFile[];
  readonly stages: readonly StageReport[];
  readonly passes: readonly PassRunReport[];
  readonly diagnostics: { readonly summary: DiagnosticSummary; readonly items: readonly Diagnostic[] };
  readonly cancelReason: string | null;
}

export interface RunOptions {
  readonly input: Uint8Array;
  /** Relative display name; the runner declares it as the `read` stage's input effect. */
  readonly inputName: string;
  readonly config: ForgeConfig;
  readonly toolVersion: string;
  readonly stages?: readonly Stage[];
  readonly passes?: readonly Pass[];
  readonly switches?: Partial<RunSwitches>;
  readonly diagnostics?: DiagnosticSink;
  readonly cancel?: CancellationToken;
  readonly cache?: StageCache;
}

/** Everything after `plan` is skipped by `--dry-run` (`IMPL-120-R004`). */
const DRY_RUN_STOP_AFTER: StageId = 'plan';

function effectError(a: StageId, b: StageId, path: string): PipelineError {
  return new PipelineError(`stages ${a} and ${b} both declare the write effect ${path}; effect sets must be disjoint`);
}

/**
 * Runs the pipeline.
 *
 * The runner is the only place that knows about ordering, cancellation, caching and refusal; a stage
 * knows only its own work. It never writes a file, never reads the clock, and never swallows an error:
 * a stage that throws ends the run with `failed` and its message in the stage report.
 */
export function runPipeline(options: RunOptions): RunResult {
  const diagnostics = options.diagnostics ?? new DiagnosticSink();
  const cancel = options.cancel ?? createCancellationToken();
  const cache = options.cache ?? nullCache();
  const switches: RunSwitches = { ...DEFAULT_RUN_SWITCHES, ...options.switches };
  const input: PipelineInput = {
    bytes: options.input,
    name: options.inputName,
    sha256: sha256Hex(options.input),
  };

  const registered = new Map<StageId, Stage>();
  for (const stage of options.stages ?? []) {
    if (registered.has(stage.id)) throw new PipelineError(`stage ${stage.id} is registered twice`);
    registered.set(stage.id, stage);
  }
  const passes = new Map<PassId, Pass>();
  for (const pass of options.passes ?? []) {
    if (passes.has(pass.id)) throw new PipelineError(`pass ${pass.id} is registered twice`);
    passes.set(pass.id, pass);
  }

  // CMP-R003: a write effect belongs to exactly one stage, or two stages could produce the same file
  // with different content and the cache key would not distinguish them.
  const writers = new Map<string, StageId>();
  for (const id of STAGE_ORDER) {
    const stage = registered.get(id);
    if (stage === undefined) continue;
    for (const path of stage.effects.writes) {
      const owner = writers.get(path);
      if (owner !== undefined && owner !== id) throw effectError(owner, id, path);
      writers.set(path, id);
    }
  }

  const ctx: StageContext = {
    config: options.config,
    switches,
    diagnostics,
    cancel,
    input,
    outDir: options.config.outDir,
    toolVersion: options.toolVersion,
  };

  let state: PipelineState = {};
  const files: EmittedFile[] = [];
  const stageReports: StageReport[] = [];
  const passReports: PassRunReport[] = [];
  const unregistered: StageId[] = [];
  let status: RunStatus = switches.dryRun ? 'dry-run' : 'complete';
  let stopped = false;
  let passPhaseDone = false;

  const runPasses = (): void => {
    if (passPhaseDone) return;
    passPhaseDone = true;
    for (const id of PASS_ORDER) {
      const pass = passes.get(id);
      if (pass === undefined) {
        // Passes are opt-in by design (IMPL-120 §3: pruning is opt-in), so an absent pass is reported
        // in the run result but is not a diagnostic — unlike an absent stage, which is.
        passReports.push({ id, status: 'unregistered', decisions: 0 });
        continue;
      }
      if (cancel.cancelled) {
        passReports.push({ id, status: stopped ? 'not-run' : 'cancelled', decisions: 0 });
        if (!stopped) {
          stopped = true;
          status = 'cancelled';
        }
        continue;
      }
      if (stopped) {
        passReports.push({ id, status: 'not-run', decisions: 0 });
        continue;
      }
      try {
        const outcome = pass.run(state, ctx);
        state = { ...state, ...outcome.state, passes: [...(state.passes ?? []), outcome.report] };
        passReports.push({ id, status: 'ran', decisions: outcome.report.decisions.length });
      } catch (error) {
        if (error instanceof PipelineCancelled) {
          passReports.push({ id, status: 'cancelled', decisions: 0 });
          status = 'cancelled';
        } else {
          passReports.push({ id, status: 'failed', decisions: 0, error: describeError(error) });
          status = 'failed';
        }
        stopped = true;
      }
    }
  };

  for (const id of STAGE_ORDER) {
    if (id === 'plan') runPasses();
    const stage = registered.get(id);
    const effects: StageEffects = stage?.effects ?? { reads: [], writes: [] };

    if (stopped) {
      stageReports.push({ id, status: 'not-run', effects, cacheKey: null, files: 0 });
      continue;
    }
    if (cancel.cancelled) {
      stageReports.push({ id, status: 'cancelled', effects, cacheKey: null, files: 0 });
      stopped = true;
      status = 'cancelled';
      continue;
    }
    if (stage === undefined) {
      unregistered.push(id);
      stageReports.push({ id, status: 'unregistered', effects, cacheKey: null, files: 0 });
      continue;
    }
    if (switches.dryRun && STAGE_ORDER.indexOf(id) > STAGE_ORDER.indexOf(DRY_RUN_STOP_AFTER)) {
      stageReports.push({ id, status: 'dry-run-skipped', effects, cacheKey: null, files: 0 });
      continue;
    }

    const inputHash = stage.inputHash?.(state, ctx) ?? '';
    const relevantConfig = configHash(ctx.config, id);
    const cacheable = stage.codec !== undefined && stage.inputHash !== undefined;
    const key = cacheable && !switches.noCache ? stageCacheKey(id, inputHash, ctx.toolVersion, relevantConfig) : null;
    const expected: StageCacheEntry | null =
      key === null
        ? null
        : {
            stage: id,
            key,
            toolVersion: ctx.toolVersion,
            inputHash,
            configHash: relevantConfig,
            effects,
            payload: null,
          };
    const base = { id, effects, cacheKey: key } as const;

    let hit: StageCacheEntry | null = null;
    let evicted: string | undefined;
    if (key !== null && expected !== null) {
      const stored = cache.get(key);
      if (stored !== null) {
        const stale = stalenessOf(stored, expected);
        if (stale === null) hit = stored;
        else {
          cache.delete(key);
          evicted = stale;
        }
      }
    }
    const evictedField = evicted === undefined ? {} : { cacheEvicted: evicted };

    if (hit !== null && stage.codec !== undefined && !switches.verifyCache) {
      const outcome = stage.codec.deserialise(hit.payload);
      state = { ...state, ...outcome.state };
      const produced = outcome.files ?? [];
      for (const file of produced) files.push(file);
      const reason = outcome.stopReason === undefined ? {} : { stopReason: outcome.stopReason };
      if (outcome.stop === 'refused') {
        stopped = true;
        status = 'refused';
        stageReports.push({ ...base, status: 'refused', files: produced.length, ...reason, ...evictedField });
      } else {
        stageReports.push({ ...base, status: 'cached', files: produced.length, ...evictedField });
      }
      continue;
    }

    try {
      const outcome = stage.run(state, ctx);
      state = { ...state, ...outcome.state };
      const produced = outcome.files ?? [];
      for (const file of produced) files.push(file);

      // `IMPL-120-R002`: under `--verify-cache` a hit is recomputed and diffed, so equivalence is proved
      // rather than assumed. Drift warns, evicts, and the run keeps the recomputed output — the cache
      // never wins over the compiler.
      let verified: 'match' | 'drift' | undefined;
      if (key !== null && expected !== null && stage.codec !== undefined) {
        const payload = stage.codec.serialise(outcome);
        if (hit !== null) {
          verified = stableForm(payload) === stableForm(hit.payload) ? 'match' : 'drift';
          if (verified === 'drift') {
            cache.delete(key);
            diagnostics.emit({
              code: Codes.CACHE_DRIFT,
              severity: 'warning',
              message: `stage ${id}: the cached output did not match a recomputation; the entry was evicted`,
              offset: 0,
              context: 'cache',
            });
          }
        }
        cache.put(key, { ...expected, payload });
      }
      const verifiedField = verified === undefined ? {} : { cacheVerified: verified };

      if (outcome.stop === 'refused') {
        stopped = true;
        status = 'refused';
        const reason = outcome.stopReason === undefined ? {} : { stopReason: outcome.stopReason };
        stageReports.push({
          ...base,
          status: 'refused',
          files: produced.length,
          ...reason,
          ...verifiedField,
          ...evictedField,
        });
        continue;
      }
      stageReports.push({ ...base, status: 'ran', files: produced.length, ...verifiedField, ...evictedField });
    } catch (error) {
      if (error instanceof PipelineCancelled) {
        stageReports.push({ id, status: 'cancelled', effects, cacheKey: key, files: 0 });
        status = 'cancelled';
      } else {
        stageReports.push({ id, status: 'failed', effects, cacheKey: key, files: 0, error: describeError(error) });
        status = 'failed';
      }
      stopped = true;
    }
  }
  runPasses();

  if (unregistered.length > 0) {
    // Never silent (IMPL-120-R013's principle, applied to the build itself): a run that cannot emit
    // says so, naming what is missing, instead of reporting success over an empty output directory.
    diagnostics.emit({
      code: Codes.STAGE_UNIMPLEMENTED,
      severity: 'info',
      message: `pipeline stage(s) with no implementation in this build: ${unregistered.join(', ')}`,
      offset: 0,
      context: 'pipeline',
    });
  }

  return {
    status,
    state,
    files,
    stages: stageReports,
    passes: passReports,
    diagnostics: { summary: diagnostics.summary(), items: diagnostics.list() },
    cancelReason: cancel.reason,
  };
}

/**
 * A stage whose supplier stage did not run. That is a wiring bug rather than an input defect — the runner
 * only starts a stage after its predecessors — so it is a `PipelineError`, exit 1 (`IMPL-120-R026`).
 */
export function requireArtifact<T>(value: T | undefined, stage: StageId, needs: StageId): T {
  if (value === undefined) throw new PipelineError(`stage ${stage} ran without the output of stage ${needs}`);
  return value;
}

function describeError(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: 'Error', message: String(error) };
}
