/**
 * `@swf-forge/compile` — the compiler pipeline, its passes and its emitter (`IMPL-120`, P6).
 *
 * Delivered so far: `WP-120-01`, the pipeline runner — the stage and pass spines, the run context,
 * cancellation, the cache seam, and the stage adapters for the three stages whose suppliers exist
 * (`read`, `model`, `analyze`). The remaining stages arrive with their own work packages: `decode` with
 * the P6 asset chain (`WP-070-07`, `WP-080-10`/`-11`, `WP-110-12`), `plan` with `WP-120-07`, `emit` with
 * `WP-120-08`…`-11`, `report` with `WP-120-11`.
 */

export { PipelineCancelled, createCancellationToken, linkAbortSignal } from './cancel.js';
export type { CancellationToken } from './cancel.js';

export {
  CONFIG_SCHEMA_VERSION,
  ConfigError,
  DEFAULT_FORGE_CONFIG,
  DEFAULT_RUN_SWITCHES,
  RELEVANT_CONFIG_KEYS,
  configHash,
  resolveForgeConfig,
  serialiseConfig,
  stableStringify,
} from './config.js';
export type {
  ForgeAudioConfig,
  ForgeConfig,
  ForgeDiagnosticsConfig,
  ForgeGraphicsConfig,
  ForgeNetworkConfig,
  ForgeVmConfig,
  RunSwitches,
} from './config.js';

export {
  PASS_ORDER,
  PipelineError,
  STAGE_ORDER,
  nullCache,
  requireArtifact,
  runPipeline,
  stageCacheKey,
  stalenessOf,
} from './pipeline.js';
export type {
  AnalysisArtifact,
  EmittedFile,
  ModelArtifact,
  Pass,
  PassDecision,
  PassId,
  PassOutcome,
  PassReport,
  PipelineInput,
  PipelineState,
  ReadArtifact,
  RunOptions,
  RunResult,
  RunStatus,
  Stage,
  StageCache,
  StageCacheEntry,
  StageCodec,
  StageContext,
  StageEffects,
  StageId,
  StageOutcome,
  StageReport,
  StageStatus,
  PassRunReport,
} from './pipeline.js';

export { structuralStageCodec, CODEC_SCHEMA_VERSION, decode, encode, stableForm } from './codec.js';

export { CACHE_DIRNAME, CACHE_ENTRY_SCHEMA_VERSION, fileStageCache } from './cache.js';
export type { FileCacheOptions, FileStageCache } from './cache.js';

export { RESERVED_IDENTIFIERS, assignNames, buildNameTable, ownerCharacterOf, sanitiseName } from './passes/names.js';
export type {
  BuildNameTableInput,
  NameCandidate,
  NamePassResult,
  NameTable,
  NamedSymbol,
  SymbolKind,
} from './passes/names.js';

export { canonicalForm, extendNameTable, framesPass, groupFrameScripts, namesPass } from './passes/frames.js';
export type { FrameGroup, FramePlan, FrameScriptUnit, FramesPassOptions, HoistedUnit } from './passes/frames.js';

export { readStage } from './stages/read.js';
export type { ReadStageOptions } from './stages/read.js';
export { modelStage } from './stages/model.js';
export type { ModelStageOptions } from './stages/model.js';
export { analyzeStage, nestedIrs } from './stages/analyze.js';
export type { AnalyzeStageOptions } from './stages/analyze.js';
