/**
 * Block formation — `IMPL-050` §3.2/§7 (R008, R029–R036, R053–R055, WP-050-05/06).
 *
 * Groups the framed records into basic blocks (single entry, single exit) per scope: the top-level
 * stream plus the bodies of `With`/`Try` regions, which tile their payloads and never cross. A
 * block ends at a branch, `Return`, `Throw`, or a target change (`SetTarget`/`SetTarget2`, R036);
 * a branch target on a record boundary starts a new block (R029/R031). The stack pass
 * (`stack.ts`) fills the ops, verifies depths and resolves the terminators into block ids.
 */

import type { ActionRecord } from './record.js';
import type { DecodedOp, TryHeader } from './operands.js';
import type { TargetRef } from './ir.js';
import { parseTarget } from './properties.js';

export type EmitFn = (
  code: string,
  severity: 'error' | 'warning' | 'info',
  message: string,
  offset: number,
  context?: string,
) => void;

/** The byte range of one region body (`With` body, or a `Try` try/catch/finally body). */
export interface BodyRange {
  readonly kind: 'with' | 'try' | 'catch' | 'finally';
  readonly start: number;
  readonly end: number;
  /** Index of the owning region record. */
  readonly recordIndex: number;
}

export interface TryBodies {
  readonly headerEnd: number;
  readonly try: { readonly start: number; readonly end: number };
  readonly catch: { readonly start: number; readonly end: number };
  readonly finally: { readonly start: number; readonly end: number };
}

/** The three `Try` body ranges, tiling from the header end (R033/R034). */
export function tryBodyRanges(_record: ActionRecord, header: TryHeader): TryBodies {
  const headerEnd = header.headerEnd;
  const tryStart = headerEnd;
  const tryEnd = tryStart + header.trySize;
  const catchStart = tryEnd;
  const catchEnd = catchStart + header.catchSize;
  const finallyStart = catchEnd;
  const finallyEnd = finallyStart + header.finallySize;
  return {
    headerEnd,
    try: { start: tryStart, end: tryEnd },
    catch: { start: catchStart, end: catchEnd },
    finally: { start: finallyStart, end: finallyEnd },
  };
}

/** Collects every region body range in the block (one per `With`, three per `Try`). */
export function collectBodyRanges(records: readonly ActionRecord[], decoded: readonly DecodedOp[]): BodyRange[] {
  const ranges: BodyRange[] = [];
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    const op = decoded[i];
    if (record === undefined || op === undefined) continue;
    if (op.kind === 'with') {
      ranges.push({ kind: 'with', start: op.bodyStart, end: op.bodyEnd, recordIndex: i });
    } else if (op.kind === 'try') {
      const bodies = tryBodyRanges(record, op.header);
      ranges.push({ kind: 'try', start: bodies.try.start, end: bodies.try.end, recordIndex: i });
      if (op.header.catchPresent) {
        ranges.push({ kind: 'catch', start: bodies.catch.start, end: bodies.catch.end, recordIndex: i });
      }
      if (op.header.finallyPresent) {
        ranges.push({ kind: 'finally', start: bodies.finally.start, end: bodies.finally.end, recordIndex: i });
      }
    }
  }
  return ranges;
}

/** The scope key of a record: the innermost body range containing its start, or `null` (top). */
export function scopeOf(offset: number, ranges: readonly BodyRange[]): BodyRange | null {
  let best: BodyRange | null = null;
  for (const range of ranges) {
    if (range.start <= offset && offset < range.end) {
      if (best === null || range.start >= best.start) best = range;
    }
  }
  return best;
}

export interface TerminatorSpec {
  readonly kind: 'fallthrough' | 'jump' | 'branch' | 'return' | 'throw' | 'target';
  /** Jump/branch target offset; `null` when invalid (SF0405) or absent. */
  readonly targetOffset: number | null;
  /** The next record's start for a fallthrough, or a branch's fallthrough side; `null` at scope end. */
  readonly nextOffset: number | null;
  readonly valid: boolean;
  readonly target: TargetRef | null;
}

export interface BlockFrame {
  readonly id: number;
  /** Scope 0 = the top-level stream; 1+ = a region body. */
  readonly scope: number;
  readonly scopeKey: string;
  /** Indices into the caller's record array. */
  readonly recordIndices: readonly number[];
  readonly firstOffset: number;
  readonly endOffset: number;
  readonly terminator: TerminatorSpec;
  /** The target in force when the block starts (R036: a region parameter, never ambient). */
  readonly target: TargetRef | null;
  /** For region-body scopes: the owning region record index. */
  readonly regionRecord: number | null;
}

interface ScopeRecords {
  readonly key: string;
  regionRecord: number | null;
  readonly indices: number[];
}

const isTerminating = (op: DecodedOp): boolean => {
  switch (op.kind) {
    case 'jump':
    case 'if':
    case 'return':
    case 'throw':
    case 'setTarget':
    case 'setTarget2':
      return true;
    default:
      return false;
  }
};

/**
 * Builds the block frames for one action block. `length` is the block's byte length; a branch
 * target outside `[0, length)` or off a record boundary is reported with `SF0405` (R031) and
 * carried as `valid: false` so the pipeline can mark the function residual.
 */
export function buildBlockFrames(
  records: readonly ActionRecord[],
  decoded: readonly DecodedOp[],
  length: number,
  emit: EmitFn,
): { readonly frames: BlockFrame[]; readonly bodyRanges: readonly BodyRange[] } {
  const bodyRanges = collectBodyRanges(records, decoded);
  const scopeKeys: (string | null)[] = records.map((record) => {
    const scope = scopeOf(record.offset, bodyRanges);
    return scope === null ? null : `${scope.kind}:${scope.recordIndex}:${scope.start}`;
  });
  const scopeKeyOf = (i: number): string => scopeKeys[i] ?? 'top';

  // Offset → record index, for branch-target validation and block lookup (R031).
  const indexByOffset = new Map<number, number>();
  for (let i = 0; i < records.length; i += 1) {
    const record = records[i];
    if (record !== undefined) indexByOffset.set(record.offset, i);
  }

  // Group records by scope, preserving file order.
  const scopes = new Map<string, ScopeRecords>();
  for (let i = 0; i < records.length; i += 1) {
    const key = scopeKeyOf(i);
    let scope = scopes.get(key);
    if (scope === undefined) {
      scope = { key, regionRecord: null, indices: [] };
      const range = bodyRanges.find((r) => `${r.kind}:${r.recordIndex}:${r.start}` === key);
      if (range !== undefined) scope.regionRecord = range.recordIndex;
      scopes.set(key, scope);
    }
    scope.indices.push(i);
  }

  // Branch targets that land inside a given scope open a new block there.
  const targetsByScope = new Map<string, Set<number>>();
  for (let i = 0; i < records.length; i += 1) {
    const op = decoded[i];
    if (op === undefined) continue;
    if (op.kind !== 'jump' && op.kind !== 'if') continue;
    const offset = op.target;
    const owner = indexByOffset.get(offset);
    if (owner === undefined) continue; // invalid target; validated per-terminator below
    const key = scopeKeyOf(owner);
    let set = targetsByScope.get(key);
    if (set === undefined) {
      set = new Set<number>();
      targetsByScope.set(key, set);
    }
    set.add(offset);
  }

  let nextId = 0;
  const frames: BlockFrame[] = [];

  const nextRecordStart = (scope: ScopeRecords, lastIndex: number): number | null => {
    const position = scope.indices.indexOf(lastIndex);
    const next = position + 1 < scope.indices.length ? scope.indices[position + 1] : undefined;
    if (next === undefined) return null;
    const record = records[next];
    return record === undefined ? null : record.offset;
  };

  const buildScope = (scope: ScopeRecords, scopeIndex: number): void => {
    const targets = targetsByScope.get(scope.key) ?? new Set<number>();

    // The target in force at each record (R036): a SetTarget/SetTarget2 changes it for the
    // records that follow.
    const targetAt = new Map<number, TargetRef | null>();
    let pending: TargetRef | null = null;
    for (const i of scope.indices) {
      const op = decoded[i];
      if (op === undefined) continue;
      if (op.kind === 'setTarget') pending = parseTarget(op.target);
      else if (op.kind === 'setTarget2') pending = { kind: 'dynamic', value: { kind: 'stack' } };
      targetAt.set(i, pending);
    }

    // Segment into blocks: a new block at the first record, at every branch target, and after
    // every terminating record.
    const blockIndices: number[][] = [];
    let current: number[] = [];
    for (let k = 0; k < scope.indices.length; k += 1) {
      const i = scope.indices[k];
      if (i === undefined) continue;
      const record = records[i];
      if (record === undefined) continue;
      const previous = k > 0 ? scope.indices[k - 1] : undefined;
      const previousOp = previous !== undefined ? decoded[previous] : undefined;
      const previousTerminates = previousOp !== undefined && isTerminating(previousOp);
      if (k === 0 || targets.has(record.offset) || previousTerminates) {
        if (current.length > 0) blockIndices.push(current);
        current = [];
      }
      current.push(i);
    }
    if (current.length > 0) blockIndices.push(current);

    for (const indices of blockIndices) {
      const first = indices[0];
      const last = indices[indices.length - 1];
      if (first === undefined || last === undefined) continue;
      const firstRecord = records[first];
      const lastRecord = records[last];
      const lastOp = decoded[last];
      if (firstRecord === undefined || lastRecord === undefined || lastOp === undefined) continue;

      let terminator: TerminatorSpec;
      switch (lastOp.kind) {
        case 'jump': {
          const valid = lastOp.target >= 0 && lastOp.target < length && indexByOffset.has(lastOp.target);
          if (!valid) {
            emit(
              'SF0405',
              'error',
              `Jump at block offset ${lastRecord.offset} targets ${lastOp.target}, not a record boundary inside the block (R031)`,
              lastRecord.offset,
            );
          }
          terminator = {
            kind: 'jump',
            targetOffset: valid ? lastOp.target : null,
            nextOffset: null,
            valid,
            target: null,
          };
          break;
        }
        case 'if': {
          const valid = lastOp.target >= 0 && lastOp.target < length && indexByOffset.has(lastOp.target);
          if (!valid) {
            emit(
              'SF0405',
              'error',
              `If at block offset ${lastRecord.offset} targets ${lastOp.target}, not a record boundary inside the block (R031)`,
              lastRecord.offset,
            );
          }
          terminator = {
            kind: 'branch',
            targetOffset: valid ? lastOp.target : null,
            nextOffset: nextRecordStart(scope, last),
            valid,
            target: null,
          };
          break;
        }
        case 'return':
          terminator = { kind: 'return', targetOffset: null, nextOffset: null, valid: true, target: null };
          break;
        case 'throw':
          terminator = { kind: 'throw', targetOffset: null, nextOffset: null, valid: true, target: null };
          break;
        case 'setTarget':
          terminator = {
            kind: 'target',
            targetOffset: null,
            nextOffset: nextRecordStart(scope, last),
            valid: true,
            target: parseTarget(lastOp.target),
          };
          break;
        case 'setTarget2':
          terminator = {
            kind: 'target',
            targetOffset: null,
            nextOffset: nextRecordStart(scope, last),
            valid: true,
            target: { kind: 'dynamic', value: { kind: 'stack' } },
          };
          break;
        default:
          terminator = {
            kind: 'fallthrough',
            targetOffset: null,
            nextOffset: nextRecordStart(scope, last),
            valid: true,
            target: null,
          };
      }

      frames.push({
        id: nextId++,
        scope: scopeIndex,
        scopeKey: scope.key,
        recordIndices: indices,
        firstOffset: firstRecord.offset,
        endOffset: lastRecord.end,
        terminator,
        target: targetAt.get(first) ?? null,
        regionRecord: scope.regionRecord,
      });
    }
  };

  // Top scope first (its ids come first), then region bodies in document order.
  const top = scopes.get('top');
  if (top !== undefined) buildScope(top, 0);
  const bodyScopes = [...scopes.values()].filter((s) => s.key !== 'top');
  bodyScopes.sort((a, b) => {
    const ra = bodyRanges.find((r) => `${r.kind}:${r.recordIndex}:${r.start}` === a.key);
    const rb = bodyRanges.find((r) => `${r.kind}:${r.recordIndex}:${r.start}` === b.key);
    return (ra?.start ?? 0) - (rb?.start ?? 0) || (a.regionRecord ?? 0) - (b.regionRecord ?? 0);
  });
  bodyScopes.forEach((scope, i) => buildScope(scope, i + 1));

  return { frames, bodyRanges };
}

export { isTerminating };
