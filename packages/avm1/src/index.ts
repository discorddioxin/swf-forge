/**
 * `@swf-forge/avm1` — the AVM1 front end (`IMPL-050`).
 *
 * Barrel only (TECH-R005): no logic lives here. The front end is build-time only (IMPL-050-R001):
 * no DOM, no host API — the browser half (`runtime/`) is a later work package (doc 130).
 */

// ---- opcode table (IMPL-050-R002) -----------------------------------------------------------------
export {
  OPCODES,
  UNDEFINED_CODES,
  SWF3_ONLY_CODES,
  expectedPayloadLength,
  isDefinedCode,
  isObservedCode,
  opcode,
} from './frontend/opcodes.js';
export type { OpcodeSpec, PayloadSchema, VersionSensitive } from './frontend/opcodes.js';

// ---- framing (WP-050-01) ----------------------------------------------------------------------------
export { scanRecords } from './frontend/record.js';
export type { ActionRecord, Emit, ScanResult } from './frontend/record.js';

// ---- operands (WP-050-03) -----------------------------------------------------------------------------
export { decodeRecord, makeStringReader, newResidualFlags, validateRegister } from './frontend/operands.js';
export type { DecodedOp, OperandContext, PushValue, ResidualFlags, TryHeader } from './frontend/operands.js';

// ---- functions (WP-050-04) -----------------------------------------------------------------------------
export { DF2_MASKS, PRELOAD_ORDER, decodeDefineFunction, decodeDefineFunction2 } from './frontend/functions.js';
export type { DecodeFunctionOptions, FunctionDefShell, ReadContext } from './frontend/functions.js';

// ---- properties and targets (WP-050-11) ------------------------------------------------------------------
export {
  PROPERTY_NAMES,
  formatTarget,
  isDefinedPropertyId,
  parseTarget,
  propertyIsMouse,
  propertyName,
} from './frontend/properties.js';

// ---- control flow (WP-050-05/06) -----------------------------------------------------------------------
export { buildBlockFrames, collectBodyRanges, isTerminating, scopeOf, tryBodyRanges } from './frontend/control-flow.js';
export type { BodyRange, BlockFrame, EmitFn, TerminatorSpec, TryBodies } from './frontend/control-flow.js';

// ---- stack and partial evaluation (WP-050-07/09/10) ------------------------------------------------------
export { foldBin, foldUn, simulateFrames } from './frontend/stack.js';
export type { Depth, FrameSet, SimResult, SimulateOptions } from './frontend/stack.js';

// ---- tiering and residual (WP-050-08) ---------------------------------------------------------------------
export { assignTier, reasonIsT2 } from './frontend/tier.js';
export type { TierDecision } from './frontend/tier.js';
export { residualByteCount, residualSlices } from './frontend/residual.js';
export type { ResidualSlice } from './frontend/residual.js';

// ---- requirements (WP-050-13) ------------------------------------------------------------------------------
export { extractRequirements } from './frontend/requirements.js';

// ---- names and classes (WP-050-14) --------------------------------------------------------------------------
export { candidatesFromFunctions, detectClasses, recoverNames } from './frontend/names.js';
export type { Candidate, ClassModel, RecoveredNames } from './frontend/names.js';

// ---- AVM2 gate (WP-050-15) -----------------------------------------------------------------------------------
export { detectAvm2 } from './frontend/avm2.js';
export type { Avm2Verdict } from './frontend/avm2.js';

// ---- scheduling (WP-050-12) -----------------------------------------------------------------------------------
export { buildActionSchedule } from './frontend/blocks.js';
export type { ActionSchedule, FrameScriptEntry, InitScriptEntry } from './frontend/blocks.js';

// ---- orchestration -------------------------------------------------------------------------------------------
export { analyzeActionBlock, analyzeMovie } from './frontend/analyze.js';
export type { AnalyzeBlockInput, AnalyzedBlock, AnalyzeMovieOptions, MovieAnalysis } from './frontend/analyze.js';

// ---- disassembly (WP-050-16) -----------------------------------------------------------------------------------
export { disassembleBlock, disassembleMovie } from './frontend/disassemble.js';

// ---- IR (WP-050-07) ---------------------------------------------------------------------------------------
export { NO_PRELOADS, NO_SUPPRESS } from './frontend/ir.js';
export type {
  ActionIR,
  Avm1Value,
  BasicBlock,
  BlockKind,
  CallKind,
  CallOp,
  FunctionDef,
  HostApiGroup,
  HostApiRequirement,
  Op,
  Operand,
  ParamSlot,
  PreloadFlags,
  RegisterSlot,
  SuppressFlags,
  TargetRef,
  Terminator,
  TierReason,
  TimelineOp,
  TryRegion,
  WithRegion,
} from './frontend/ir.js';
