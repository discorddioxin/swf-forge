/**
 * Residual extraction (IMPL-050-R057, R058, R060).
 *
 * A T2 function is executed by `@swf-forge/avm1/interp` against the *original* bytes. The bytes are
 * contiguous per basic block (R057), so the residual artifact is just the list of per-block byte
 * slices in the action-stream coordinates. Nothing is re-derived at run time: the interpreter runs
 * slice by slice, following the terminator structure the front end already built.
 */

import type { BasicBlock } from './ir.js';

/** A contiguous raw slice of the action stream, in block-relative coordinates. */
export interface ResidualSlice {
  readonly blockId: number;
  /** Offset of the first record byte, relative to the action stream start. */
  readonly offset: number;
  /** Slice length in bytes (`endOffset - firstOffset`). */
  readonly length: number;
  /** True when the player may never reach this slice (R055, kept for faithfulness). */
  readonly unreachable: boolean;
}

/**
 * The residual byte slices for one T2 action block. Blocks are returned in `id` order (schedule
 * order); a slice with `length === 0` (an empty block, e.g. after a target terminator) is omitted —
 * there is nothing to execute.
 */
export function residualSlices(blocks: readonly BasicBlock[]): ResidualSlice[] {
  const slices: ResidualSlice[] = [];
  const sorted = [...blocks].sort((a, b) => a.id - b.id);
  for (const block of sorted) {
    const length = block.endOffset - block.firstOffset;
    if (length <= 0) continue;
    slices.push({ blockId: block.id, offset: block.firstOffset, length, unreachable: block.unreachable });
  }
  return slices;
}

/** The total residual byte count (for reports and budget checks). */
export function residualByteCount(slices: readonly ResidualSlice[]): number {
  let total = 0;
  for (const slice of slices) total += slice.length;
  return total;
}
