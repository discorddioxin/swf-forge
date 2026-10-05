/**
 * Top-level orchestration (WP-050-12..15 + WP-050-16): `MovieModel` + `SwfFile.body` → one
 * `ActionIR` per action block, with tier decisions, requirements, and the schedule doc 130
 * consumes. Build-time only (IMPL-050-R001).
 *
 * The pipeline per block:
 *   scanRecords → decodeRecord (+ recursive function bodies) → pre-passes (poolAt, withDepthAt,
 *   try tiling, body scope keys) → buildBlockFrames → simulateFrames → tier → requirements → IR.
 *
 * `analyzeMovie` runs the AVM2 gate first (SF1000, exit 3 per doc 010 §7) and then analyzes every
 * `DoAction`/`DoInitAction`/clip-action block in the dictionary.
 */

import type { MovieModel, SwfFile } from '@swf-forge/swf';

import { scanRecords, type ActionRecord, type Emit } from './record.js';
import { decodeRecord, makeStringReader, newResidualFlags, type DecodedOp, type OperandContext } from './operands.js';
import type { FunctionDefShell } from './functions.js';
import { buildBlockFrames, collectBodyRanges } from './control-flow.js';
import { simulateFrames, type SimulateOptions } from './stack.js';
import { assignTier, type TierDecision } from './tier.js';
import { extractRequirements } from './requirements.js';
import { residualSlices, type ResidualSlice } from './residual.js';
import { recoverNames, type Candidate, type RecoveredNames } from './names.js';
import { detectAvm2, type Avm2Verdict } from './avm2.js';
import { buildActionSchedule, type ActionSchedule } from './blocks.js';
import type { ActionIR, BasicBlock, BlockKind, PreloadFlags, SuppressFlags, TierReason } from './ir.js';
import type { DisplayOp } from '@swf-forge/swf';

/** Hard `DefineFunction*` nesting cap (the player's); `SF0409` fires one level before it. */
const MAX_FUNCTION_DEPTH = 256;
/** `SF0409` "near the cap" threshold. */
const NEAR_FUNCTION_DEPTH = 250;

export interface AnalyzeBlockInput {
  /** The action bytes, from the first action (the 4-byte `Length` excluded). */
  readonly bytes: Uint8Array;
  /** File-absolute offset of `bytes[0]`. */
  readonly offsetBase: number;
  readonly kind: BlockKind;
  /** Stable emitted symbol base name. */
  readonly id: string;
  readonly version: number;
  readonly emit: Emit;
  /** `true` for a `DefineFunction*` body (pool references are dynamic there, R022). */
  readonly inFunction?: boolean;
  /** The shell when `kind` is `function` (registers/params/preloads/suppress). */
  readonly shell?: FunctionDefShell | null;
  /** The pool in effect at the defining point (functions), or `[]`. */
  readonly constantsAtDef?: readonly string[];
  /** Which timeline frames reference this block. */
  readonly frameAssociations?: readonly number[];
  /** `DoInitAction` only: the movie-level execution index. */
  readonly initOrder?: number | null;
  /** A recovered name, when known (filled by the name pass). */
  readonly sourceName?: string | null;
  /** The `With` nesting cap: 8 in SWF 5, 16 in SWF 6+ (R032). */
  readonly withCap?: number;
}

export interface AnalyzedBlock {
  readonly ir: ActionIR;
  readonly decision: TierDecision;
  /** The raw reason strings, in first-seen order. */
  readonly reasons: readonly string[];
  /** T2 byte slices (R057), empty below T2. */
  readonly residual: readonly ResidualSlice[];
}

const withCapFor = (version: number): number => (version <= 5 ? 8 : 16);

export function analyzeActionBlock(input: AnalyzeBlockInput): AnalyzedBlock {
  const withCap = input.withCap ?? withCapFor(input.version);
  const ctx = new BlockContext(input, withCap);

  // 1+2. Framing + operands. Records inside `With`/`Try` bodies are scanned as their own record
  // streams and merged back in (R008: bodies carry no `End`), so the CFG sees them as scoped
  // records and the region ops get real body blocks.
  const merged = scanWithRegionBodies(input.bytes, input.emit, (record) =>
    decodeRecord(record, input.bytes, ctx.operandContext()),
  );
  const scan = merged;
  const records = merged.records;
  const decoded = merged.decoded;

  // 3. Pre-passes.
  const bodyRanges = merged.bodyRanges;
  const poolAt = computePoolAt(decoded);
  const withDepthAt = computeWithDepthAt(records, bodyRanges);
  const tryMalformedAt = checkTryTiling(records, decoded, input.bytes, input.emit);
  const bodyScopeKeys = computeBodyScopeKeys(bodyRanges);

  // 4. CFG.
  const { frames } = buildBlockFrames(records, decoded, input.bytes.length, input.emit);

  // 5. Stack simulation and partial evaluation.
  const sim = simulateFrames(
    {
      version: input.version,
      emit: input.emit,
      decoded,
      records: scan.records,
      poolAt,
      inFunction: input.inFunction === true,
      tryMalformedAt,
      withDepthAt,
      withCap,
      onDynamicPool: (index, offset) => ctx.noteDynamicPool(index, offset),
      onPoolOutOfRange: (index, offset) => ctx.notePoolOutOfRange(index, offset),
      onWithOverCap: (offset) =>
        input.emit(
          'SF0412',
          'warning',
          `With at block offset ${offset} exceeds the ${withCap}-deep cap; the player skips the body (R032)`,
          offset,
        ),
      onPropertyId: (id, offset) => ctx.notePropertyId(id, offset),
      bodyScopeKeys,
    } satisfies SimulateOptions,
    { frames, entryId: frames[0]?.id ?? 0 },
  );

  // 6. Tier reasons.
  collectTierReasons(ctx, scan, decoded, frames, sim);

  // 7. Tier + requirements.
  const decision = assignTier(ctx.reasons);
  const requirements = extractRequirements(sim.blocks);
  const residual = decision.tier === 2 ? residualSlices(sim.blocks) : null;

  // 8. The IR.
  const shell = input.shell ?? null;
  const ir: ActionIR = {
    kind: input.kind,
    id: input.id,
    byteRange: { start: input.offsetBase, end: input.offsetBase + input.bytes.length },
    blocks: sim.blocks,
    registers: shell?.registerCount ?? 0,
    params: shell?.params ?? [],
    preloads: shell?.preloads ?? NO_PRELOADS,
    suppress: shell?.suppress ?? NO_SUPPRESS,
    constants: input.constantsAtDef ?? [],
    poolIsDynamic: input.inFunction === true && ctx.sawPoolReference,
    tier: decision.tier,
    residualReason: decision.residualReason,
    tierReasons: ctx.tierReasonRecords(),
    requirements,
    sourceName: input.sourceName ?? null,
    frameAssociations: input.frameAssociations ?? [],
    initOrder: input.initOrder ?? null,
    terminated: scan.terminated,
    residual,
  };

  return { ir, decision, reasons: ctx.reasons, residual: residual ?? [] };
}

const NO_PRELOADS: PreloadFlags = {
  this: false,
  arguments: false,
  super: false,
  root: false,
  parent: false,
  global: false,
};
const NO_SUPPRESS: SuppressFlags = { this: false, arguments: false, super: false };

interface MergedScan {
  readonly records: readonly ActionRecord[];
  readonly decoded: readonly DecodedOp[];
  readonly bodyRanges: readonly {
    readonly kind: string;
    readonly start: number;
    readonly end: number;
    readonly recordIndex: number;
  }[];
  readonly terminated: boolean;
  readonly desync: boolean;
  readonly stoppedAt: number;
}

/**
 * Frames the top-level records, then walks every `With`/`Try` body as a self-delimited record
 * stream (BFS over the body ranges the decoded ops expose) and merges the inner records back in,
 * offset-shifted into block coordinates. Bodies contain no `End` (R008) and a body's declared
 * size delimits it, so the walk always terminates. The merged arrays stay parallel (index `i`
 * of `records` pairs with index `i` of `decoded`) and are sorted by offset.
 */
function scanWithRegionBodies(bytes: Uint8Array, emit: Emit, decode: (record: ActionRecord) => DecodedOp): MergedScan {
  const top = scanRecords(bytes, emit);
  const records: ActionRecord[] = [...top.records];
  const decoded: DecodedOp[] = top.records.map((record) => decode(record));

  let desync = top.desync;
  // BFS over the region bodies every decoded op exposes. A body's declared size delimits it, so
  // the walk always terminates.
  const queue: { readonly start: number; readonly end: number }[] = collectBodyRanges(records, decoded).map((r) => ({
    start: r.start,
    end: r.end,
  }));
  const seen = new Set(queue.map((r) => `${r.start}:${r.end}`));
  while (queue.length > 0) {
    const range = queue.shift();
    if (range === undefined) break;
    const sub = scanRecords(
      bytes.subarray(range.start, range.end),
      (code, severity, message, offset, context) => emit(code, severity, message, offset + range.start, context),
      { requireEnd: false },
    );
    if (sub.desync) desync = true;
    const newRecords: ActionRecord[] = [];
    const newDecoded: DecodedOp[] = [];
    for (const record of sub.records) {
      const shifted: ActionRecord = { ...record, offset: record.offset + range.start, end: record.end + range.start };
      newRecords.push(shifted);
      newDecoded.push(decode(shifted));
    }
    records.push(...newRecords);
    decoded.push(...newDecoded);
    for (const inner of collectBodyRanges(newRecords, newDecoded)) {
      const key = `${inner.start}:${inner.end}`;
      if (!seen.has(key)) {
        seen.add(key);
        queue.push({ start: inner.start, end: inner.end });
      }
    }
  }

  // Realign in offset order, then recompute the body ranges against the merged arrays so their
  // `recordIndex` fields are indices of the merged list (the CFG and the scope-key passes rely
  // on that).
  const order = records
    .map((record, i) => ({ record, index: i }))
    .sort((a, b) => a.record.offset - b.record.offset)
    .map((entry) => entry.index);
  const merged = order.map((i) => records[i]).filter((r): r is ActionRecord => r !== undefined);
  const mergedDecoded = order.map((i) => decoded[i]).filter((r): r is DecodedOp => r !== undefined);
  return {
    records: merged,
    decoded: mergedDecoded,
    bodyRanges: collectBodyRanges(merged, mergedDecoded),
    terminated: top.terminated,
    desync,
    stoppedAt: top.stoppedAt,
  };
}

/**
 * The per-block mutable state shared between decoding and tiering. The recursive
 * `decodeFunctionBody` callback re-enters `analyzeActionBlock` with `inFunction: true`.
 */
class BlockContext {
  readonly input: AnalyzeBlockInput;
  readonly withCap: number;
  readonly flags = newResidualFlags();
  readonly reasons: string[] = [];
  /** Diagnostics keyed by reason, for the IR's `tierReasons` records. */
  private readonly reasonDiagnostics = new Map<string, { diagnostic: string | null; offset: number | null }>();
  /** True when any operand in this block referenced the constant pool. */
  sawPoolReference = false;
  private functionDepth = 0;
  private poolReportedAt = -1;
  private readonly propertyIdsReported = new Set<number>();

  constructor(input: AnalyzeBlockInput, withCap: number) {
    this.input = input;
    this.withCap = withCap;
  }

  reason(reason: string, diagnostic: string | null, offset: number | null): void {
    if (!this.reasons.includes(reason)) this.reasons.push(reason);
    if (!this.reasonDiagnostics.has(reason)) {
      this.reasonDiagnostics.set(reason, { diagnostic, offset });
    }
  }

  tierReasonRecords(): TierReason[] {
    return this.reasons.map((reason) => {
      const info = this.reasonDiagnostics.get(reason);
      return { reason, diagnostic: info?.diagnostic ?? null, offset: info?.offset ?? null };
    });
  }

  operandContext(): OperandContext {
    const input = this.input;
    const closedReader = makeStringReader(input.bytes, input.version, 'windows-1252');
    return {
      version: input.version,
      registerCount: input.shell?.registerCount ?? null,
      legacyEncoding: 'windows-1252',
      emit: input.emit,
      string: (_bytes, from, to) => closedReader(from, to),
      decodeFunctionBody: (shell) => this.decodeFunctionBody(shell),
      flags: this.flags,
    };
  }

  private decodeFunctionBody(shell: FunctionDefShell): ActionIR | null {
    if (this.functionDepth + 1 >= MAX_FUNCTION_DEPTH) {
      this.input.emit(
        'SF0409',
        'error',
        `DefineFunction nesting depth ${this.functionDepth + 1} exceeds the ${MAX_FUNCTION_DEPTH} cap; the body is residual`,
        this.input.offsetBase + shell.bodyStart,
      );
      this.reason('record-truncated', null, shell.bodyStart);
      return null;
    }
    if (this.functionDepth + 1 >= NEAR_FUNCTION_DEPTH) {
      this.input.emit(
        'SF0409',
        'info',
        `DefineFunction nesting depth ${this.functionDepth + 1} is near the ${MAX_FUNCTION_DEPTH} cap`,
        this.input.offsetBase + shell.bodyStart,
      );
    }
    this.functionDepth += 1;
    try {
      const bytes = this.input.bytes.subarray(shell.bodyStart, shell.bodyEnd);
      const defOffset = this.input.offsetBase + shell.bodyStart;
      const name = shell.name;
      const defId = `fn_${(this.input.offsetBase + shell.bodyStart).toString(16)}`;
      const nested = analyzeActionBlock({
        bytes,
        offsetBase: defOffset,
        kind: 'function',
        id: defId,
        version: this.input.version,
        emit: this.input.emit,
        inFunction: true,
        shell,
        constantsAtDef: this.input.constantsAtDef ?? [],
        frameAssociations: this.input.frameAssociations ?? [],
        sourceName: name,
        withCap: this.withCap,
      });
      // A nested T2 verdict does not force this block to T2 (R059); the nested IR carries it.
      return {
        ...nested.ir,
        id: defId,
        sourceName: name ?? nested.ir.sourceName,
      };
    } finally {
      this.functionDepth -= 1;
    }
  }

  noteDynamicPool(index: number, offset: number): void {
    this.sawPoolReference = true;
    if (this.poolReportedAt === offset) return;
    this.poolReportedAt = offset;
    const diagnostic = `constant${index >= 256 ? 16 : 8} reference resolves at run time in a function body (R022)`;
    this.input.emit('SF0410', 'warning', `${diagnostic} (block offset ${offset})`, offset, `pool:${index}`);
    this.reason('dynamic-pool', diagnostic, offset);
  }

  notePoolOutOfRange(index: number, offset: number): void {
    this.sawPoolReference = true;
    const diagnostic = `constant${index >= 256 ? 16 : 8} index ${index} is outside the pool`;
    this.input.emit('SF0411', 'error', `${diagnostic} (block offset ${offset})`, offset, `pool:${index}`);
    this.reason('pool-index-out-of-range', diagnostic, offset);
  }

  notePropertyId(id: number, offset: number): void {
    if (this.propertyIdsReported.has(id)) return;
    this.propertyIdsReported.add(id);
    this.input.emit(
      'SF0417',
      'warning',
      `property id ${id} is undefined (get → undefined, set → no-op)`,
      offset,
      `property:${id}`,
    );
  }
}

function collectTierReasons(
  ctx: BlockContext,
  scan: { readonly records: readonly ActionRecord[]; readonly desync: boolean; readonly terminated: boolean },
  decoded: readonly DecodedOp[],
  frames: readonly {
    readonly id: number;
    readonly firstOffset: number;
    readonly terminator: { readonly valid: boolean };
  }[],
  sim: { readonly stackMismatch: boolean; readonly dynamicStack: boolean; readonly blocks: readonly BasicBlock[] },
): void {
  // Framing-level.
  if (scan.desync) {
    if (ctx.flags.truncated) ctx.reason('record-truncated', 'action stream truncated mid-record', null);
    if (ctx.flags.overrun) ctx.reason('record-overrun', 'action record overruns its block', null);
  }
  for (let i = 0; i < scan.records.length; i += 1) {
    const record = scan.records[i];
    if (record === undefined) continue;
    if (record.truncated)
      ctx.reason('record-truncated', `record at block offset ${record.offset} is truncated`, record.offset);
    if (record.overrun)
      ctx.reason('record-overrun', `record at block offset ${record.offset} overruns the block`, record.offset);
    if (record.name === 'Unknown' && !record.observed) {
      ctx.reason(
        `unknown-opcode:0x${record.code.toString(16).padStart(2, '0')}`,
        `unknown opcode 0x${record.code.toString(16)}`,
        record.offset,
      );
    }
  }

  // Operand-level.
  if (ctx.flags.pushMalformed) ctx.reason('push-malformed', 'malformed Push pair / unrecognised type byte', null);
  if (ctx.flags.tryMalformed) ctx.reason('try-malformed', 'Try bodies do not tile the record', null);
  if (ctx.flags.registerOutOfRange) ctx.reason('register-out-of-range', 'register number out of range', null);
  for (let i = 0; i < decoded.length; i += 1) {
    const op = decoded[i];
    if (op === undefined) continue;
    if (op.kind === 'malformed') {
      const record = scan.records[i];
      const offset = record?.offset ?? null;
      if (op.reason === 'overrun') ctx.reason('record-overrun', `record at ${offset} overruns the block`, offset);
      else if (op.reason === 'short-payload' || op.reason === 'truncated')
        ctx.reason('record-truncated', `record at ${offset} is truncated`, offset);
      else ctx.reason('push-malformed', `record at ${offset}: ${op.reason}`, offset);
    }
  }

  // CFG-level.
  for (const frame of frames) {
    if (frame.terminator.valid === false) {
      ctx.reason(
        'branch-out-of-bounds',
        `branch at block offset ${frame.firstOffset} leaves the block`,
        frame.firstOffset,
      );
    }
  }

  // Simulation-level.
  if (sim.stackMismatch) ctx.reason('stack-mismatch', 'stack-depth mismatch at a block join', null);
  if (sim.dynamicStack) ctx.reason('dynamic-stack', 'unknown stack depth reached a join', null);

  // Dynamic-value reasons (T1) from the built IR ops.
  for (const block of sim.blocks) {
    for (const op of block.ops) {
      if (op.kind === 'with' && op.region.object.kind !== 'lit') {
        ctx.reason('dynamic-with', 'With over a non-literal object', block.firstOffset);
      }
      if (op.kind === 'target' && op.target.kind === 'dynamic') {
        ctx.reason('target-in-branch', 'SetTarget2 (stack-based target)', block.firstOffset);
      }
      if (op.kind === 'call') {
        const call = op.call;
        if (
          (call.kind === 'callFunction' || call.kind === 'newObject') &&
          call.name !== null &&
          call.name.kind !== 'lit'
        ) {
          ctx.reason('call-dynamic-target', `${call.kind} with a non-literal name`, block.firstOffset);
        }
        if (call.numArgs === null)
          ctx.reason('dynamic-args', `${call.kind} with a non-constant argument count`, block.firstOffset);
      }
      if (op.kind === 'timeline' && op.timeline.op === 'call' && op.timeline.frame.kind !== 'lit') {
        ctx.reason('frame-call-target-unresolved', 'Call (0x9E) with a non-literal frame', block.firstOffset);
      }
    }
  }
}

function computePoolAt(decoded: readonly DecodedOp[]): (string[] | null)[] {
  const out: (string[] | null)[] = [];
  let current: string[] | null = null;
  for (const op of decoded) {
    out.push(current);
    if (op.kind === 'constantPool') current = [...op.strings];
  }
  return out;
}

function computeWithDepthAt(
  records: readonly ActionRecord[],
  bodyRanges: readonly {
    readonly kind: string;
    readonly start: number;
    readonly end: number;
    readonly recordIndex: number;
  }[],
): Map<number, number> {
  const out = new Map<number, number>();
  const withRanges = bodyRanges.filter((r) => r.kind === 'with');
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    if (record === undefined) continue;
    if (record.code !== 0x94) continue;
    let depth = 1;
    for (const range of withRanges) {
      if (range.start < record.offset && record.offset < range.end) depth += 1;
    }
    out.set(i, depth);
  }
  return out;
}

function checkTryTiling(
  records: readonly ActionRecord[],
  decoded: readonly DecodedOp[],
  bytes: Uint8Array,
  emit: Emit,
): Map<number, boolean> {
  const out = new Map<number, boolean>();
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    const op = decoded[i];
    if (record === undefined || op === undefined || op.kind !== 'try') continue;
    const payloadStart = record.offset + (record.hasLength ? 3 : 1);
    const bodies = op.header;
    const expectedEnd = bodies.headerEnd + bodies.trySize + bodies.catchSize + bodies.finallySize;
    const malformed = expectedEnd !== record.end;
    out.set(i, malformed);
    if (malformed) {
      emit(
        'SF0404',
        'error',
        `Try at block offset ${record.offset}: header + bodies end at ${expectedEnd} but the record ends at ${record.end} (R034)`,
        record.offset,
      );
    }
    void payloadStart;
    void bytes;
  }
  return out;
}

function computeBodyScopeKeys(
  bodyRanges: readonly { readonly kind: string; readonly start: number; readonly recordIndex: number }[],
): Map<number, readonly string[]> {
  const out = new Map<number, string[]>();
  for (const range of bodyRanges) {
    const key = `${range.kind}:${range.recordIndex}:${range.start}`;
    const list = out.get(range.recordIndex);
    if (list === undefined) out.set(range.recordIndex, [key]);
    else list.push(key);
  }
  for (const list of out.values()) {
    // Preserve the try/catch/finally order the region op expects.
    const order = new Map<string, number>([
      ['try', 0],
      ['catch', 1],
      ['finally', 2],
      ['with', 0],
    ]);
    list.sort(
      (a, b) => (order.get(a.split(':')[0] ?? '') ?? 9) - (order.get(b.split(':')[0] ?? '') ?? 9) || a.localeCompare(b),
    );
  }
  return out;
}

// ---- movie level --------------------------------------------------------------------------------------

export interface MovieAnalysis {
  readonly avm2: Avm2Verdict;
  readonly schedule: ActionSchedule;
  readonly blocks: readonly AnalyzedBlock[];
  readonly names: RecoveredNames;
  /** The first T2 frame-script verdict (R059: listed in the porting notes). */
  readonly t2FrameScripts: readonly { readonly id: string; readonly reason: string | null }[];
}

export interface AnalyzeMovieOptions {
  readonly emit: Emit;
}

/**
 * Analyzes every action block in the movie. The AVM2 gate runs first (SF1000 → fatal, exit 3);
 * when it fires, `blocks` is empty and the caller must stop the pipeline.
 */
export function analyzeMovie(file: SwfFile, model: MovieModel, options: AnalyzeMovieOptions): MovieAnalysis {
  const emit = options.emit;
  const avm2 = detectAvm2(file, model);
  if (avm2.present) {
    emit(
      'SF1000',
      'error',
      `AVM2 content detected: ${avm2.reason}; the AVM1 front end refuses this movie (exit 3)`,
      avm2.offset ?? 0,
      'avm2',
    );
    return {
      avm2,
      schedule: buildActionSchedule(file, model, emit),
      blocks: [],
      names: { names: new Map(), classes: new Map() },
      t2FrameScripts: [],
    };
  }

  const schedule = buildActionSchedule(file, model, emit);
  const blocks: AnalyzedBlock[] = [];

  // Frame scripts (main timeline + sprite timelines) via the schedule.
  for (const entry of schedule.frameScripts) {
    const ref = entry.block;
    const bytes = sliceBlock(file, ref);
    if (bytes === null) continue;
    blocks.push(
      analyzeActionBlock({
        bytes,
        offsetBase: ref.offset + 4,
        kind: 'timeline',
        id: `frame_${entry.frame}_${entry.order}`,
        version: file.version,
        emit,
        frameAssociations: [entry.frame],
      }),
    );
  }

  // Init scripts.
  for (const entry of schedule.initScripts) {
    if (entry.unknownSprite) continue; // dropped (SF0422)
    const ref = entry.block;
    const bytes = sliceBlock(file, ref);
    if (bytes === null) continue;
    blocks.push(
      analyzeActionBlock({
        bytes,
        offsetBase: ref.offset + 4,
        kind: 'init',
        id: `init_${entry.spriteId}_${entry.initOrder}`,
        version: file.version,
        emit,
        initOrder: entry.initOrder,
        frameAssociations: [entry.frame],
      }),
    );
  }

  // Clip-event handlers from placement tags (main + sprite timelines).
  let clipIndex = 0;
  const takeClipActions = (ops: readonly DisplayOp[]): void => {
    for (const op of ops) {
      if (op.kind !== 'place') continue;
      const ref = op.clipActions;
      if (ref === null) continue;
      const bytes = sliceBlock(file, ref);
      if (bytes === null) continue;
      blocks.push(
        analyzeActionBlock({
          bytes,
          offsetBase: ref.offset + 4,
          kind: 'clipEvent',
          id: `clip_${clipIndex++}`,
          version: file.version,
          emit,
        }),
      );
      void op.name;
      void op.depth;
    }
  };
  for (const frame of model.mainTimeline.frames) takeClipActions(frame.ops);
  for (const character of model.characters.values()) {
    const sprite = character.sprite;
    if (sprite === null) continue;
    for (const frame of sprite.timeline.frames) takeClipActions(frame.ops);
  }

  // Name recovery over the functions the blocks defined.
  const candidates: Candidate[] = [];
  const pushCandidates = (block: AnalyzedBlock): void => {
    for (const basic of block.ir.blocks) {
      for (const op of basic.ops) {
        if (op.kind !== 'define') continue;
        const fn = op.fn;
        candidates.push({
          id: fn.ir?.id ?? `fn_${basic.firstOffset.toString(16)}`,
          declared: fn.name,
          offset: block.ir.byteRange.start + basic.firstOffset,
          index: candidates.length,
        });
      }
    }
  };
  for (const block of blocks) pushCandidates(block);
  const names = recoverNames(candidates, model.exported);

  const t2FrameScripts = blocks
    .filter((b) => b.ir.kind === 'timeline' && b.decision.tier === 2)
    .map((b) => ({ id: b.ir.id, reason: b.decision.residualReason }));

  return { avm2, schedule, blocks, names, t2FrameScripts };
}

/** The action bytes of a block ref (`offset` points at the 4-byte `Length`). */
function sliceBlock(file: SwfFile, ref: { readonly offset: number; readonly length: number }): Uint8Array | null {
  if (ref.length < 4) return null;
  const start = ref.offset + 4;
  const end = ref.offset + ref.length;
  if (start < 0 || end > file.body.length || start >= end) return null;
  return file.body.subarray(start, end);
}
