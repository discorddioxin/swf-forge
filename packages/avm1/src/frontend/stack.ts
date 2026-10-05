/**
 * Stack simulation and partial evaluation — `IMPL-050` §6/§7 (R042–R054, R056, WP-050-07/09/10).
 *
 * Simulates the operand stack over the block frames: known constants are folded (respecting the
 * AVM1 coercion rules — AVM1-R024's `Add` vs `Add2` are distinct, version-dependent result types
 * per R042, the reverse-push calling convention per R043), unknown values become SSA temporaries
 * (R056). Depths are verified at every join (R054): a mismatch is `SF0406` → residual, never fixed.
 * `RandomNumber` is never folded (R051).
 */

import type { EmitFn } from './control-flow.js';
import type { BlockFrame } from './control-flow.js';
import type { ActionRecord } from './record.js';
import type { DecodedOp, PushValue } from './operands.js';
import type { Avm1Value, BasicBlock, CallOp, Op, Operand, TargetRef, Terminator, TryRegion, WithRegion } from './ir.js';
import { parseTarget } from './properties.js';

export type Depth = number | 'unknown';

export interface SimResult {
  readonly blocks: readonly BasicBlock[];
  /** `true` when `SF0406` (stack mismatch/underflow) was raised → residual. */
  readonly stackMismatch: boolean;
  /** `true` when an unknown depth reached a join (T1 `dynamic-stack`, not an error). */
  readonly dynamicStack: boolean;
}

interface BlockSim {
  in: Depth | null;
  out: Depth | null;
  ops: Op[] | null;
  branchCondition: Operand | null;
  targetValue: Operand | null;
  regionDepthAt: Map<number, Depth>;
  regionPatches: RegionPatch[];
}

interface MutableWithRegion {
  object: Operand;
  withDepth: number;
  skipBody: boolean;
  bodyBlocks: BasicBlock[];
}

interface MutableTryRegion {
  catchInRegister: boolean;
  catchName: string | null;
  catchRegister: number | null;
  finallyPresent: boolean;
  tryBlocks: BasicBlock[];
  catchBlocks: BasicBlock[] | null;
  finallyBlocks: BasicBlock[] | null;
  malformed: boolean;
}

/**
 * A region op whose body blocks must be patched once all blocks exist. The placeholder is the
 * mutable object stored inside the op; `simulateFrames` fills its body lists in place.
 */
interface RegionPatch {
  readonly kind: 'with' | 'try';
  readonly with: MutableWithRegion | null;
  readonly try: MutableTryRegion | null;
  readonly bodyScopes: readonly string[];
}

export interface SimulateOptions {
  readonly version: number;
  readonly emit: EmitFn;
  readonly decoded: readonly DecodedOp[];
  readonly records: readonly ActionRecord[];
  /** The pool in effect per record index (the top-level stream, R022); `null` = no pool yet. */
  readonly poolAt: readonly (string[] | null)[];
  /** `true` inside a `DefineFunction*` body — pool references are dynamic there (R022). */
  readonly inFunction: boolean;
  /** `true` when a `Try` record's bodies do not tile (SF0404), by record index. */
  readonly tryMalformedAt: ReadonlyMap<number, boolean>;
  /** The `With` depth each record sits at (1-based), by record index. */
  readonly withDepthAt: ReadonlyMap<number, number>;
  readonly withCap: number;
  /** Reports a dynamic pool reference (SF0410, once per index by the caller). */
  readonly onDynamicPool: (index: number, offset: number) => void;
  /** Reports an out-of-range pool index (SF0411 → residual). */
  readonly onPoolOutOfRange: (index: number, offset: number) => void;
  /** Reports a `With` over the version cap (SF0412). */
  readonly onWithOverCap: (offset: number) => void;
  /** SF0417: property id ≥ 22, once per id by the caller. */
  readonly onPropertyId: (id: number, offset: number) => void;
  /** Maps a region record index to its body scope keys (with: one; try: up to three). */
  readonly bodyScopeKeys: ReadonlyMap<number, readonly string[]>;
}

export interface FrameSet {
  readonly frames: readonly BlockFrame[];
  readonly entryId: number;
}

/**
 * Runs the depth fixpoint and builds the final `BasicBlock`s for one action block (top-level
 * stream and all region bodies at once). `frames` come from `buildBlockFrames`.
 */
export function simulateFrames(options: SimulateOptions, frames: FrameSet): SimResult {
  const { emit } = options;
  const sims = new Map<number, BlockSim>();
  for (const frame of frames.frames) {
    sims.set(frame.id, {
      in: null,
      out: null,
      ops: null,
      branchCondition: null,
      targetValue: null,
      regionDepthAt: new Map(),
      regionPatches: [],
    });
  }

  let stackMismatch = false;
  let dynamicStack = false;

  const indexByStart = new Map<number, number>();
  for (const frame of frames.frames) indexByStart.set(frame.firstOffset, frame.id);

  const predEdges = new Map<number, number[]>();
  for (const frame of frames.frames) predEdges.set(frame.id, []);
  for (const frame of frames.frames) {
    const t = frame.terminator;
    const addPred = (offset: number | null): void => {
      if (offset === null) return;
      const target = indexByStart.get(offset);
      if (target !== undefined) predEdges.get(target)?.push(frame.id);
    };
    if (t.kind === 'fallthrough' || t.kind === 'target') addPred(t.nextOffset);
    else if (t.kind === 'jump') addPred(t.targetOffset);
    else if (t.kind === 'branch') {
      addPred(t.targetOffset);
      addPred(t.nextOffset);
    }
  }

  // The first block of a region-body scope is entered from its region op.
  const bodyEntryFrame = new Map<number, number>();
  for (const frame of frames.frames) {
    if (frame.regionRecord === null) continue;
    const first = frames.frames
      .filter((f) => f.scopeKey === frame.scopeKey)
      .sort((a, b) => a.firstOffset - b.firstOffset)[0];
    if (first !== undefined && bodyEntryFrame.get(frame.regionRecord) === undefined) {
      bodyEntryFrame.set(frame.regionRecord, first.id);
    }
  }
  const regionEntry = new Map<number, Depth>();

  for (let iter = 0; iter < 1000; iter += 1) {
    let changed = false;

    // 1. Propagate input depths.
    for (const frame of frames.frames) {
      const sim = sims.get(frame.id);
      if (sim === undefined || sim.in !== null) continue;
      const isEntry = frame.id === frames.entryId;
      const bodyEntry = frame.regionRecord !== null ? bodyEntryFrame.get(frame.regionRecord) : undefined;
      const preds = predEdges.get(frame.id) ?? [];

      let inDepth: Depth | null = null;
      if (isEntry) {
        inDepth = 0;
      } else if (frame.regionRecord !== null && bodyEntry === frame.id) {
        inDepth = regionEntry.get(frame.regionRecord) ?? 'unknown';
      } else if (preds.length > 0) {
        let settled = true;
        let conflict = false;
        let unknown = false;
        let value = -1;
        for (const pred of preds) {
          const out = sims.get(pred)?.out ?? null;
          if (out === null) {
            settled = false;
            break;
          }
          if (out === 'unknown') unknown = true;
          else if (value === -1) value = out;
          else if (value !== out) conflict = true;
        }
        if (settled) {
          if (conflict) {
            inDepth = 'unknown';
            stackMismatch = true;
            emit(
              'SF0406',
              'error',
              `stack-depth mismatch at the join of block ${frame.id} (predecessors disagree, R054)`,
              frame.firstOffset,
            );
          } else if (unknown) {
            inDepth = 'unknown';
            dynamicStack = true;
          } else {
            inDepth = value;
          }
        }
      }
      if (inDepth !== null) {
        sim.in = inDepth;
        changed = true;
      }
    }

    // 2. Simulate blocks whose input just settled.
    for (const frame of frames.frames) {
      const sim = sims.get(frame.id);
      if (sim === undefined || sim.in === null || sim.ops !== null) continue;
      const result = simulateOne(options, frame, sim.in);
      sim.ops = result.ops;
      sim.out = result.out;
      sim.branchCondition = result.branchCondition;
      sim.targetValue = result.targetValue;
      sim.regionDepthAt = result.regionDepthAt;
      sim.regionPatches = result.regionPatches;
      if (result.mismatch) stackMismatch = true;
      for (const [key, depth] of result.regionDepthAt) {
        if (!regionEntry.has(key)) regionEntry.set(key, depth);
      }
      changed = true;
    }
    if (!changed) break;
  }

  // Build the final blocks (region ops carry placeholder body lists that get patched next).
  const blocks: BasicBlock[] = [];
  for (const frame of frames.frames) {
    const sim = sims.get(frame.id);
    const ops = sim?.ops ?? [];
    const t = frame.terminator;
    let terminator: Terminator;
    switch (t.kind) {
      case 'jump':
        terminator = {
          kind: 'jump',
          target: t.targetOffset === null ? null : (indexByStart.get(t.targetOffset) ?? null),
        };
        break;
      case 'branch':
        terminator = {
          kind: 'branch',
          condition: sim?.branchCondition ?? { kind: 'stack' },
          ifTrue: t.targetOffset === null ? null : (indexByStart.get(t.targetOffset) ?? null),
          ifFalse: t.nextOffset === null ? null : (indexByStart.get(t.nextOffset) ?? null),
        };
        break;
      case 'return':
        terminator = { kind: 'return' };
        break;
      case 'throw':
        terminator = { kind: 'throw' };
        break;
      case 'target':
        terminator = { kind: 'target', target: t.target ?? { kind: 'file' }, value: sim?.targetValue ?? null };
        break;
      default:
        terminator = {
          kind: 'fallthrough',
          next: t.nextOffset === null ? null : (indexByStart.get(t.nextOffset) ?? null),
        };
    }
    blocks.push({
      id: frame.id,
      ops,
      terminator,
      stackIn: blockDepth(sim?.in ?? null),
      stackOut: blockDepth(sim?.out ?? null),
      unreachable: false, // filled after reachability
      target: frame.target,
      firstOffset: frame.firstOffset,
      endOffset: frame.endOffset,
    });
  }

  // Patch every region op with its body blocks, in place (the placeholders are mutable at runtime).
  const blockById = new Map<number, BasicBlock>();
  for (const block of blocks) blockById.set(block.id, block);
  for (const sim of sims.values()) {
    for (const patch of sim.regionPatches) {
      patchRegion(patch, frames, blockById);
    }
  }

  // Reachability (R055): BFS from the entry; unreachable blocks are retained and marked.
  const reachable = new Set<number>([frames.entryId]);
  const queue: number[] = [frames.entryId];
  const frameById = new Map<number, BlockFrame>();
  for (const frame of frames.frames) frameById.set(frame.id, frame);
  while (queue.length > 0) {
    const id = queue.pop();
    if (id === undefined) continue;
    const frame = frameById.get(id);
    if (frame === undefined) continue;
    const t = frame.terminator;
    const visit = (offset: number | null): void => {
      if (offset === null) return;
      const target = indexByStart.get(offset);
      if (target !== undefined && !reachable.has(target)) {
        reachable.add(target);
        queue.push(target);
      }
    };
    if (t.kind === 'fallthrough' || t.kind === 'target') visit(t.nextOffset);
    else if (t.kind === 'jump') visit(t.targetOffset);
    else if (t.kind === 'branch') {
      visit(t.targetOffset);
      visit(t.nextOffset);
    }
    const block = blockById.get(id);
    if (block !== undefined) {
      for (const op of block.ops) {
        if (op.kind !== 'with' && op.kind !== 'try') continue;
        for (const regionBlock of regionBlockIds(op.region, op.kind)) {
          if (!reachable.has(regionBlock)) {
            reachable.add(regionBlock);
            queue.push(regionBlock);
          }
        }
      }
    }
  }
  for (const block of blocks) block.unreachable = !reachable.has(block.id);

  return { blocks, stackMismatch, dynamicStack };
}

function patchRegion(patch: RegionPatch, frames: FrameSet, blockById: Map<number, BasicBlock>): void {
  const collect = (scopeKey: string): BasicBlock[] => {
    const bucket: BasicBlock[] = [];
    for (const frame of frames.frames) {
      if (frame.scopeKey !== scopeKey) continue;
      const block = blockById.get(frame.id);
      if (block !== undefined) bucket.push(block);
    }
    return bucket.sort((a, b) => a.firstOffset - b.firstOffset);
  };
  for (const scopeKey of patch.bodyScopes) {
    const kind = scopeKey.split(':')[0];
    const bucket = collect(scopeKey);
    if (patch.kind === 'with' && patch.with !== null) {
      if (kind === 'with') patch.with.bodyBlocks.push(...bucket);
    } else if (patch.kind === 'try' && patch.try !== null) {
      if (kind === 'try') patch.try.tryBlocks.push(...bucket);
      else if (kind === 'catch' && patch.try.catchBlocks !== null) patch.try.catchBlocks.push(...bucket);
      else if (kind === 'finally' && patch.try.finallyBlocks !== null) patch.try.finallyBlocks.push(...bucket);
    }
  }
}

function regionBlockIds(region: WithRegion | TryRegion, kind: 'with' | 'try'): number[] {
  const ids: number[] = [];
  if (kind === 'with') {
    const withRegion = region as WithRegion;
    for (const b of withRegion.bodyBlocks) ids.push(b.id);
  } else {
    const tryRegion = region as TryRegion;
    for (const b of tryRegion.tryBlocks) ids.push(b.id);
    if (tryRegion.catchBlocks !== null) for (const b of tryRegion.catchBlocks) ids.push(b.id);
    if (tryRegion.finallyBlocks !== null) for (const b of tryRegion.finallyBlocks) ids.push(b.id);
  }
  return ids;
}

type NumberOrInteger =
  Extract<Avm1Value, { readonly type: 'number' }> | Extract<Avm1Value, { readonly type: 'integer' }>;

function blockDepth(depth: Depth | null): number {
  return depth === null || depth === 'unknown' ? -1 : depth;
}

// ---- fold-only coercion helpers (AVM1-§5.2; number→string deliberately not folded — AVM1-§5.3) ----

function toNumberLit(v: Avm1Value): number | null {
  switch (v.type) {
    case 'number':
    case 'integer':
      return v.value;
    case 'boolean':
      return v.value ? 1 : 0;
    case 'null':
      return 0;
    case 'undefined':
      return NaN;
    case 'string': {
      const trimmed = v.value.trim();
      if (trimmed === '') return 0;
      return Number(trimmed);
    }
    default:
      return null;
  }
}

function toStringLit(v: Avm1Value): string | null {
  switch (v.type) {
    case 'string':
      return v.value;
    case 'boolean':
      return v.value ? 'true' : 'false';
    case 'null':
      return 'null';
    case 'undefined':
      return 'undefined';
    default:
      return null;
  }
}

function toBooleanLit(v: Avm1Value): boolean | null {
  switch (v.type) {
    case 'number':
    case 'integer':
      return !(v.value === 0 || Number.isNaN(v.value));
    case 'boolean':
      return v.value;
    case 'null':
    case 'undefined':
      return false;
    case 'string':
      return v.value !== '';
    default:
      return null;
  }
}

const isAscii = (s: string): boolean => /^[ -~]*$/.test(s);

function int32(x: number): number {
  return Math.trunc(x) | 0;
}

const num = (value: number): Avm1Value => ({ type: 'number', value });
const str = (value: string): Avm1Value => ({ type: 'string', value });

/**
 * Folds a binary action. `a` = second pop (left operand, "B" in the chapter's wording),
 * `b` = first pop (top of stack, "A"); results are stated `B op A` (§6.1/R043).
 * Returns `null` when the fold is not provable — the value stays a temporary.
 */
export function foldBin(code: number, a: Avm1Value, b: Avm1Value, version: number): Avm1Value | null {
  const bool = (result: boolean): Avm1Value => (version < 5 ? num(result ? 1 : 0) : { type: 'boolean', value: result });
  switch (code) {
    case 0x0a: {
      // AVM1-R024: string concat when the *left* operand's primitive is a string; else numeric.
      if (a.type === 'string') {
        const bStr = toStringLit(b);
        return bStr === null ? null : str(a.value + bStr);
      }
      const aN = toNumberLit(a);
      const bN = toNumberLit(b);
      if (aN === null || bN === null) return null;
      return num(aN + bN);
    }
    case 0x47: {
      const aStr = toStringLit(a);
      const bStr = toStringLit(b);
      if (aStr !== null || bStr !== null) {
        if (aStr === null || bStr === null) return null;
        return str(aStr + bStr);
      }
      const aN = toNumberLit(a);
      const bN = toNumberLit(b);
      if (aN === null || bN === null) return null;
      return num(aN + bN);
    }
    case 0x21: {
      const aStr = toStringLit(a);
      const bStr = toStringLit(b);
      return aStr === null || bStr === null ? null : str(aStr + bStr);
    }
    case 0x0b:
    case 0x0c:
    case 0x0d:
    case 0x3f: {
      const aN = toNumberLit(a);
      const bN = toNumberLit(b);
      if (aN === null || bN === null) return null;
      if (code === 0x0b) return num(aN - bN);
      if (code === 0x0c) return num(aN * bN);
      if (code === 0x3f) return num(bN % aN); // pops x (b) then y (a): x mod y; y == 0 → NaN (JS agrees)
      if (bN === 0 && version < 5) return str('#ERROR#'); // Divide's SWF 4 zero rule (R042)
      return num(aN / bN);
    }
    case 0x0e: {
      const aN = toNumberLit(a);
      const bN = toNumberLit(b);
      if (aN === null || bN === null) return null;
      if (Number.isNaN(aN) || Number.isNaN(bN)) return null; // NaN equality is oracle-pinned
      return bool(aN === bN);
    }
    case 0x0f:
    case 0x48:
    case 0x67: {
      if (a.type === 'string' && b.type === 'string') {
        if (code === 0x67) return bool(a.value > b.value);
        return bool(a.value < b.value);
      }
      const aN = toNumberLit(a);
      const bN = toNumberLit(b);
      if (aN === null || bN === null) return null;
      if (code === 0x67) return bool(aN > bN);
      return bool(aN < bN);
    }
    case 0x13:
    case 0x29:
    case 0x68: {
      if (a.type !== 'string' || b.type !== 'string') return null;
      if (code === 0x13) return bool(a.value === b.value);
      if (!isAscii(a.value) || !isAscii(b.value)) return null; // byte order needs the code page (R048)
      if (code === 0x29) return bool(a.value < b.value);
      return bool(a.value > b.value);
    }
    case 0x10:
    case 0x11: {
      const aB = toBooleanLit(a);
      const bB = toBooleanLit(b);
      if (aB === null || bB === null) return null;
      return bool(code === 0x10 ? aB && bB : aB || bB);
    }
    case 0x49: {
      if (a.type === 'string' && b.type === 'string') return bool(a.value === b.value);
      if ((a.type === 'null' || a.type === 'undefined') && (b.type === 'null' || b.type === 'undefined')) {
        return bool(true);
      }
      const aN = toNumberLit(a);
      const bN = toNumberLit(b);
      if (aN === null || bN === null) return null;
      if (Number.isNaN(aN) || Number.isNaN(bN)) return null;
      return bool(aN === bN);
    }
    case 0x66: {
      const isNum = (x: Avm1Value): x is NumberOrInteger => x.type === 'number' || x.type === 'integer';
      if (isNum(a) && isNum(b)) {
        if (Number.isNaN(a.value) || Number.isNaN(b.value)) return null;
        return bool(a.value === b.value);
      }
      if (a.type === 'boolean' && b.type === 'boolean') return bool(a.value === b.value);
      if (a.type === 'string' && b.type === 'string') return bool(a.value === b.value);
      if ((a.type === 'null' || a.type === 'undefined') && a.type === b.type) return bool(true);
      return null;
    }
    case 0x60:
    case 0x61:
    case 0x62:
    case 0x63:
    case 0x64:
    case 0x65: {
      const aN = toNumberLit(a);
      const bN = toNumberLit(b);
      if (aN === null || bN === null) return null;
      const a32 = int32(aN);
      if (code === 0x60) return num(a32 & int32(bN));
      if (code === 0x61) return num(a32 | int32(bN));
      if (code === 0x62) return num(a32 ^ int32(bN));
      const shift = int32(bN) & 31; // shift counts use the low 5 bits
      if (code === 0x63) return num(a32 << shift);
      if (code === 0x64) return num(a32 >> shift);
      return num(int32(aN) >>> shift); // BitURShift: UI32 result
    }
    case 0x50:
    case 0x51: {
      const aN = toNumberLit(a);
      return aN === null ? null : num(code === 0x50 ? aN + 1 : aN - 1);
    }
    default:
      return null;
  }
}

/** Folds a unary action (opcode-table notes, R046–R050). */
export function foldUn(code: number, a: Avm1Value, version: number): Avm1Value | null {
  const bool = (result: boolean): Avm1Value => (version < 5 ? num(result ? 1 : 0) : { type: 'boolean', value: result });
  switch (code) {
    case 0x12: {
      const b = toBooleanLit(a);
      return b === null ? null : bool(!b);
    }
    case 0x18: {
      const n = toNumberLit(a);
      return n === null ? null : num(Math.trunc(n));
    }
    case 0x4a: {
      const n = toNumberLit(a);
      return n === null ? null : num(n);
    }
    case 0x4b: {
      const s = toStringLit(a);
      return s === null ? null : str(s);
    }
    case 0x44: {
      switch (a.type) {
        case 'number':
        case 'integer':
          return str('number');
        case 'boolean':
          return str('boolean');
        case 'string':
          return str('string');
        case 'null':
          return str('null');
        case 'undefined':
          return str('undefined');
        case 'object':
          return str('object');
        default:
          return null;
      }
    }
    case 0x14:
      if (a.type !== 'string' || !isAscii(a.value)) return null; // byte counts depend on the code page (R048)
      return num(a.value.length);
    case 0x31:
      return a.type === 'string' ? num(a.value.length) : null;
    case 0x32:
      return a.type === 'string' && a.value.length > 0 ? num(a.value.charCodeAt(0)) : null;
    case 0x33: {
      const n = toNumberLit(a);
      return n === null || !Number.isInteger(n) || n < 0 || n >= 0x10000 ? null : str(String.fromCharCode(n));
    }
    case 0x36:
      return a.type === 'string' && a.value.length >= 2
        ? num((a.value.charCodeAt(0) << 8) | a.value.charCodeAt(1))
        : null;
    case 0x37: {
      const n = toNumberLit(a);
      if (n === null || !Number.isInteger(n) || n < 0 || n >= 0x1000000) return null;
      return n >= 256 ? str(String.fromCharCode((n >> 8) & 0xff, n & 0xff)) : str(String.fromCharCode(n));
    }
    default:
      return null;
  }
}

// ---- the simulator --------------------------------------------------------------------------------

interface SimulateOneResult {
  readonly ops: Op[];
  readonly out: Depth;
  readonly mismatch: boolean;
  readonly branchCondition: Operand | null;
  readonly targetValue: Operand | null;
  readonly regionDepthAt: Map<number, Depth>;
  readonly regionPatches: RegionPatch[];
}

function simulateOne(options: SimulateOptions, frame: BlockFrame, inDepth: Depth): SimulateOneResult {
  const { emit, decoded, records } = options;
  const stack: Operand[] = [];
  if (inDepth !== 'unknown') for (let i = 0; i < inDepth; i += 1) stack.push({ kind: 'stack' });
  let nextTemp = 0;
  let variable = false;
  let mismatch = false;
  const ops: Op[] = [];
  const regionDepthAt = new Map<number, Depth>();
  const regionPatches: RegionPatch[] = [];
  let branchCondition: Operand | null = null;
  let targetValue: Operand | null = null;

  const pop = (): Operand => {
    if (inDepth === 'unknown' || variable) return { kind: 'stack' };
    if (stack.length === 0) {
      emit(
        'SF0406',
        'error',
        `operand stack underflow in block ${frame.id} at offset ${frame.firstOffset} (R054)`,
        frame.firstOffset,
      );
      mismatch = true;
      variable = true;
      return { kind: 'stack' };
    }
    return stack.pop() ?? { kind: 'stack' };
  };
  const push = (operand: Operand): void => {
    if (variable) return;
    stack.push(operand);
  };
  const top = (): Operand =>
    inDepth === 'unknown' || variable ? { kind: 'stack' } : (stack[stack.length - 1] ?? { kind: 'stack' });
  const temp = (name?: string): Operand => ({ kind: 'temp', id: nextTemp++, ...(name !== undefined ? { name } : {}) });
  const lit = (value: Avm1Value): Operand => ({ kind: 'lit', value });

  const pushValueOperand = (value: PushValue, recordIndex: number): Operand => {
    switch (value.type) {
      case 'string':
        return lit({ type: 'string', value: value.value });
      case 'float':
        return lit({ type: 'number', value: value.value });
      case 'null':
        return lit({ type: 'null' });
      case 'undefined':
        return lit({ type: 'undefined' });
      case 'register':
        return value.usable ? lit({ type: 'register', index: value.index }) : lit({ type: 'undefined' });
      case 'boolean':
        return lit({ type: 'boolean', value: value.value });
      case 'double':
        return lit({ type: 'number', value: value.value });
      case 'integer':
        return lit({ type: 'integer', value: value.value, bits: value.bits });
      case 'constant8':
      case 'constant16': {
        if (options.inFunction) {
          options.onDynamicPool(value.index, frame.firstOffset);
          return lit({ type: 'pool', index: value.index, resolved: null });
        }
        const pool = options.poolAt[recordIndex] ?? null;
        const resolved = pool !== null && value.index < pool.length ? (pool[value.index] ?? null) : null;
        if (resolved === null) options.onPoolOutOfRange(value.index, frame.firstOffset);
        return lit({ type: 'pool', index: value.index, resolved });
      }
    }
  };

  /** Pops a `numArgs`-style count; `null` marks a runtime value (the block's exit is unknown). */
  const popCount = (): number | null => {
    const operand = pop();
    if (
      operand.kind === 'lit' &&
      (operand.value.type === 'integer' || operand.value.type === 'number') &&
      Number.isInteger(operand.value.value) &&
      operand.value.value >= 0 &&
      operand.value.value <= 255
    ) {
      return Math.trunc(operand.value.value);
    }
    variable = true;
    return null;
  };
  const popArgs = (count: number | null): Operand[] | null => {
    if (count === null) return null;
    const args: Operand[] = [];
    for (let i = 0; i < count; i += 1) args.push(pop());
    return args;
  };

  const finishCall = (
    code: number,
    name: Operand | null,
    object: Operand | null,
    count: number,
    args: readonly Operand[],
  ): Op => {
    const sourceOrder = [...args].reverse(); // R043: normalise once to source order
    switch (code) {
      case 0x52:
      case 0x53: {
        const call: CallOp = {
          kind: code === 0x52 ? 'callMethod' : 'newMethod',
          name,
          object,
          numArgs: count,
          args: sourceOrder,
        };
        const result = temp();
        push(result);
        return { kind: 'call', call, result };
      }
      case 0x42: {
        const call: CallOp = { kind: 'initArray', name: null, object: null, numArgs: count, args: sourceOrder };
        const result = temp();
        push(result);
        return { kind: 'call', call, result };
      }
      case 0x43: {
        const pairs = [];
        for (let i = 0; i + 1 < sourceOrder.length; i += 2) {
          pairs.push({ value: sourceOrder[i] ?? { kind: 'stack' }, name: sourceOrder[i + 1] ?? { kind: 'stack' } });
        }
        const call: CallOp = { kind: 'initObject', name: null, object: null, numArgs: count, args: [], pairs };
        const result = temp();
        push(result);
        return { kind: 'call', call, result };
      }
      case 0x40: {
        const call: CallOp = { kind: 'newObject', name, object: null, numArgs: count, args: sourceOrder };
        const result = temp();
        push(result);
        return { kind: 'call', call, result };
      }
      default: {
        const call: CallOp = { kind: 'callFunction', name, object: null, numArgs: count, args: sourceOrder };
        const result = temp();
        push(result);
        return { kind: 'call', call, result };
      }
    }
  };

  for (const recordIndex of frame.recordIndices) {
    const record = records[recordIndex];
    const d = decoded[recordIndex];
    if (record === undefined || d === undefined) continue;

    switch (d.kind) {
      case 'end':
        ops.push({ kind: 'end' });
        break;
      case 'inert':
        ops.push({ kind: 'inert', code: d.code, name: d.name });
        break;
      case 'unknown':
      case 'malformed':
        ops.push({ kind: 'unknown', code: d.code });
        break;
      case 'push': {
        const values = d.values.map((value) => pushValueOperand(value, recordIndex));
        for (const value of values) push(value);
        ops.push({ kind: 'push', values });
        break;
      }
      case 'constantPool':
        ops.push({ kind: 'constantPool', count: d.count });
        break;
      case 'jump':
        // The terminator carries the branch; no op is emitted (R057: `raw` is T2-only).
        break;
      case 'if': {
        branchCondition = top();
        pop();
        break;
      }
      case 'return':
        ops.push({ kind: 'return', value: pop() });
        break;
      case 'throw':
        ops.push({ kind: 'throw', value: pop() });
        break;
      case 'storeRegister': {
        const value = pop();
        push(value); // reads without popping
        ops.push({ kind: 'storeRegister', register: d.register, value });
        break;
      }
      case 'gotoFrame':
        ops.push({
          kind: 'timeline',
          timeline: {
            op: 'goto',
            target: { kind: 'frame', value: lit({ type: 'integer', value: d.frame, bits: d.frame }) },
          },
        });
        break;
      case 'gotoLabel':
        ops.push({
          kind: 'timeline',
          timeline: { op: 'goto', target: { kind: 'label', value: lit({ type: 'string', value: d.label }) } },
        });
        break;
      case 'setTarget':
      case 'setTarget2': {
        const value = pop();
        targetValue = value;
        const target: TargetRef = d.kind === 'setTarget' ? parseTarget(d.target) : { kind: 'dynamic', value };
        ops.push({ kind: 'target', target, value });
        break;
      }
      case 'getURL':
        ops.push({
          kind: 'timeline',
          timeline: {
            op: 'getURL',
            url: lit({ type: 'string', value: d.url }),
            target: lit({ type: 'string', value: d.target }),
            method: 'none',
            loadTarget: false,
            loadVariables: false,
          },
        });
        break;
      case 'getURL2': {
        const url = pop();
        const target = pop();
        ops.push({
          kind: 'timeline',
          timeline: {
            op: 'getURL',
            url,
            target,
            method: d.method,
            loadTarget: d.loadTarget,
            loadVariables: d.loadVariables,
          },
        });
        break;
      }
      case 'gotoFrame2': {
        const value = pop();
        ops.push({
          kind: 'timeline',
          timeline: { op: 'goto', target: { kind: 'frame2', value, play: d.play, sceneBias: d.sceneBias } },
        });
        break;
      }
      case 'waitForFrame':
        ops.push({
          kind: 'timeline',
          timeline: {
            op: 'waitForFrame',
            frame: lit({ type: 'integer', value: d.frame, bits: d.frame }),
            skip: d.skip,
          },
        });
        break;
      case 'waitForFrame2': {
        const frameValue = pop();
        ops.push({ kind: 'timeline', timeline: { op: 'waitForFrame', frame: frameValue, skip: d.skip } });
        break;
      }
      case 'with': {
        const object = pop();
        const depth = options.withDepthAt.get(recordIndex) ?? 1;
        if (depth > options.withCap) options.onWithOverCap(record.offset);
        const placeholder: MutableWithRegion = {
          object,
          withDepth: depth,
          skipBody: depth > options.withCap,
          bodyBlocks: [],
        };
        const op: Op = { kind: 'with', region: placeholder };
        ops.push(op);
        regionPatches.push({
          kind: 'with',
          with: placeholder,
          try: null,
          bodyScopes: options.bodyScopeKeys.get(recordIndex) ?? [],
        });
        regionDepthAt.set(recordIndex, inDepth === 'unknown' || variable ? 'unknown' : stack.length);
        break;
      }
      case 'try': {
        const placeholder: MutableTryRegion = {
          catchInRegister: d.header.catchInRegister,
          catchName: d.header.catchName,
          catchRegister: d.header.catchRegister,
          finallyPresent: d.header.finallyPresent,
          tryBlocks: [],
          catchBlocks: d.header.catchPresent ? [] : null,
          finallyBlocks: d.header.finallyPresent ? [] : null,
          malformed: options.tryMalformedAt.get(recordIndex) === true,
        };
        const op: Op = { kind: 'try', region: placeholder };
        ops.push(op);
        regionPatches.push({
          kind: 'try',
          with: null,
          try: placeholder,
          bodyScopes: options.bodyScopeKeys.get(recordIndex) ?? [],
        });
        regionDepthAt.set(recordIndex, inDepth === 'unknown' || variable ? 'unknown' : stack.length);
        break;
      }
      case 'defineFunction': {
        ops.push({ kind: 'define', fn: d.fn });
        push(temp(d.fn.name ?? undefined));
        break;
      }
      default:
        handleSimple(
          options,
          d.code,
          record,
          {
            pop,
            push,
            temp,
            lit,
            popCount,
            popArgs,
            finishCall,
            setVariable: (v: boolean) => {
              variable = v;
            },
          },
          { ops },
        );
        break;
    }
  }

  return {
    ops,
    out: inDepth === 'unknown' || variable ? 'unknown' : stack.length,
    mismatch,
    branchCondition,
    targetValue,
    regionDepthAt,
    regionPatches,
  };
}

interface SimpleHandlers {
  readonly pop: () => Operand;
  readonly push: (operand: Operand) => void;
  readonly temp: (name?: string) => Operand;
  readonly lit: (value: Avm1Value) => Operand;
  readonly popCount: () => number | null;
  readonly popArgs: (count: number | null) => Operand[] | null;
  readonly finishCall: (
    code: number,
    name: Operand | null,
    object: Operand | null,
    count: number,
    args: readonly Operand[],
  ) => Op;
  readonly setVariable: (value: boolean) => void;
}

const BINARY_CODES = new Set([
  0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x13, 0x21, 0x29, 0x3f, 0x47, 0x48, 0x49, 0x60, 0x61, 0x62, 0x63,
  0x64, 0x65, 0x66, 0x67, 0x68,
]);

function handleSimple(
  options: SimulateOptions,
  code: number,
  record: ActionRecord,
  h: SimpleHandlers,
  out: { ops: Op[] },
): void {
  const { version, emit } = options;
  const ops = out.ops;
  const pushValue = (operand: Operand): void => h.push(operand);
  void emit;

  switch (code) {
    case 0x04:
      ops.push({ kind: 'timeline', timeline: { op: 'goto', target: { kind: 'next' } } });
      return;
    case 0x05:
      ops.push({ kind: 'timeline', timeline: { op: 'goto', target: { kind: 'previous' } } });
      return;
    case 0x06:
      ops.push({ kind: 'timeline', timeline: { op: 'play' } });
      return;
    case 0x07:
      ops.push({ kind: 'timeline', timeline: { op: 'stop' } });
      return;
    case 0x08:
      ops.push({ kind: 'timeline', timeline: { op: 'toggleQuality' } });
      return;
    case 0x09:
      ops.push({ kind: 'timeline', timeline: { op: 'stopSounds' } });
      return;
    case 0x34:
      ops.push({ kind: 'getTime' });
      pushValue(h.temp());
      return;
    case 0x30: {
      const max = h.pop();
      const result = h.temp(); // R051: never folded
      pushValue(result);
      ops.push({ kind: 'unop', code, a: max, result });
      return;
    }
    case 0x17: {
      ops.push({ kind: 'pop', value: h.pop() });
      return;
    }
    case 0x4c: {
      const value = h.pop();
      pushValue(value);
      pushValue(value);
      ops.push({ kind: 'duplicate', value });
      return;
    }
    case 0x4d: {
      const a = h.pop();
      const b = h.pop();
      pushValue(a);
      pushValue(b);
      ops.push({ kind: 'swap', a, b });
      return;
    }
    case 0x1c: {
      const name = h.pop();
      const result = h.temp(name.kind === 'lit' && name.value.type === 'string' ? name.value.value : undefined);
      pushValue(result);
      ops.push({ kind: 'getVariable', name, result });
      return;
    }
    case 0x1d: {
      const name = h.pop();
      const value = h.pop();
      ops.push({ kind: 'setVariable', name, value });
      return;
    }
    case 0x22: {
      const id = h.pop();
      const target = h.pop();
      if (id.kind === 'lit' && (id.value.type === 'number' || id.value.type === 'integer') && id.value.value >= 22) {
        options.onPropertyId(Math.trunc(id.value.value), record.offset);
      }
      const result = h.temp();
      pushValue(result);
      ops.push({ kind: 'getProperty', id, target, result });
      return;
    }
    case 0x23: {
      const value = h.pop();
      const id = h.pop();
      const target = h.pop();
      if (id.kind === 'lit' && (id.value.type === 'number' || id.value.type === 'integer') && id.value.value >= 22) {
        options.onPropertyId(Math.trunc(id.value.value), record.offset);
      }
      ops.push({ kind: 'setProperty', id, target, value });
      return;
    }
    case 0x24: {
      const depth = h.pop();
      const target = h.pop();
      const source = h.pop();
      ops.push({ kind: 'cloneSprite', depth, target, source });
      return;
    }
    case 0x25: {
      ops.push({ kind: 'removeSprite', target: h.pop() });
      return;
    }
    case 0x26: {
      ops.push({ kind: 'trace', value: h.pop() });
      return;
    }
    case 0x27: {
      const target = h.pop();
      const lockcenter = h.pop();
      const constrain = h.pop();
      let bounds: readonly [Operand, Operand, Operand, Operand] | undefined;
      if (constrain.kind === 'lit' && constrain.value.type === 'boolean') {
        if (constrain.value.value) {
          const y2 = h.pop();
          const x2 = h.pop();
          const y1 = h.pop();
          const x1 = h.pop();
          bounds = [x1, y1, x2, y2];
        }
      } else {
        h.setVariable(true); // the constraint decides four more pops
      }
      ops.push({ kind: 'startDrag', target, lockcenter, constrain, ...(bounds !== undefined ? { bounds } : {}) });
      return;
    }
    case 0x28:
      ops.push({ kind: 'endDrag' });
      return;
    case 0x3a: {
      const name = h.pop();
      const object = h.pop();
      ops.push({ kind: 'delete', name, object });
      return;
    }
    case 0x3b: {
      ops.push({ kind: 'delete2', name: h.pop() });
      return;
    }
    case 0x3c: {
      const value = h.pop();
      const name = h.pop();
      ops.push({ kind: 'defineLocal', name, value });
      return;
    }
    case 0x41: {
      const name = h.pop();
      const result = h.temp(name.kind === 'lit' && name.value.type === 'string' ? name.value.value : undefined);
      pushValue(result);
      ops.push({ kind: 'defineLocal2', name, result });
      return;
    }
    case 0x4e: {
      const name = h.pop();
      const object = h.pop();
      const result = h.temp();
      pushValue(result);
      ops.push({ kind: 'getMember', name, object, result });
      return;
    }
    case 0x4f: {
      const value = h.pop();
      const name = h.pop();
      const object = h.pop();
      ops.push({ kind: 'setMember', name, object, value });
      return;
    }
    case 0x54: {
      const constr = h.pop();
      const obj = h.pop();
      const result = h.temp();
      pushValue(result);
      ops.push({ kind: 'instanceof', obj, constr, result });
      return;
    }
    case 0x2b: {
      const constr = h.pop();
      const obj = h.pop();
      const result = h.temp();
      pushValue(result);
      ops.push({ kind: 'castOp', obj, constr, result });
      return;
    }
    case 0x69: {
      const superclass = h.pop();
      const subclass = h.pop();
      ops.push({ kind: 'extends', superclass, subclass });
      return;
    }
    case 0x2c: {
      const constr = h.pop();
      const count = h.popCount();
      const interfaces = h.popArgs(count) ?? [];
      ops.push({ kind: 'implementsOp', constr, numInterfaces: count, interfaces });
      return;
    }
    case 0x46:
    case 0x55: {
      const obj = h.pop();
      h.setVariable(true); // pushes null + k names; k is unknown (R044)
      ops.push({ kind: 'enumerate', code, obj });
      return;
    }
    case 0x3d:
    case 0x40: {
      const name = h.pop();
      const count = h.popCount();
      const args = count === null ? null : h.popArgs(count);
      if (args === null || count === null) return;
      ops.push(h.finishCall(code, name, null, count, args));
      return;
    }
    case 0x52:
    case 0x53: {
      const name = h.pop();
      const object = h.pop();
      const count = h.popCount();
      const args = count === null ? null : h.popArgs(count);
      if (args === null || count === null) return;
      ops.push(h.finishCall(code, name, object, count, args));
      return;
    }
    case 0x42:
    case 0x43: {
      const count = h.popCount();
      const elements = h.popArgs(count === null ? null : count * (code === 0x43 ? 2 : 1));
      if (elements === null) return;
      ops.push(h.finishCall(code, null, null, count ?? elements.length, elements));
      return;
    }
    case 0x45: {
      const a = h.pop();
      const result = h.temp();
      pushValue(result);
      ops.push({ kind: 'unop', code, a, result });
      return;
    }
    case 0x15:
    case 0x35: {
      const count = h.pop();
      const index = h.pop();
      const strOp = h.pop();
      let folded: Avm1Value | null = null;
      const isIntLit = (
        o: Operand,
      ): o is Extract<Operand, { kind: 'lit' }> & { value: { type: 'number' | 'integer' } } =>
        o.kind === 'lit' && (o.value.type === 'number' || o.value.type === 'integer');
      if (strOp.kind === 'lit' && strOp.value.type === 'string' && isIntLit(index) && isIntLit(count)) {
        const i = Number.isInteger(index.value.value) ? Math.trunc(index.value.value) : -1;
        const n = Number.isInteger(count.value.value) ? Math.trunc(count.value.value) : -1;
        const s = strOp.value.value;
        if (i >= 0 && n >= 0 && i + n <= s.length) folded = { type: 'string', value: s.slice(i, i + n) };
      }
      const result = folded === null ? h.temp() : h.lit(folded);
      pushValue(result);
      ops.push({ kind: 'strExtract', code, str: strOp, index, count, result });
      return;
    }
    default:
      break;
  }

  if (BINARY_CODES.has(code)) {
    const b = h.pop();
    const a = h.pop();
    const folded = a.kind === 'lit' && b.kind === 'lit' ? foldBin(code, a.value, b.value, version) : null;
    const result = folded === null ? h.temp() : h.lit(folded);
    pushValue(result);
    ops.push({ kind: 'binop', code, a, b, result });
    return;
  }
  const a = h.pop();
  const folded = a.kind === 'lit' ? foldUn(code, a.value, version) : null;
  const result = folded === null ? h.temp() : h.lit(folded);
  pushValue(result);
  ops.push({ kind: 'unop', code, a, result });
}
