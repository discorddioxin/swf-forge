/**
 * Button state/transition helpers — data-only pieces of `IMPL-100` §4/§5.
 *
 * The decompiler publishes these tables for later runtime stages; it does not execute handlers.
 */

import type { Mat2D, Rect } from '../io/types.js';
import type { ButtonRecord, ButtonState } from './types.js';

export interface ButtonTransition {
  readonly condition: keyof import('./types.js').ButtonConditions;
  readonly transition: string;
  readonly event: string;
  readonly tracking: 'both' | 'push' | 'menu';
}

/** One canonical condition → event mapping, shared by menu and push tracking modes. */
export const BUTTON_TRANSITIONS: readonly ButtonTransition[] = [
  { condition: 'idleToOverUp', transition: 'Idle → OverUp', event: 'Roll Over', tracking: 'both' },
  { condition: 'overUpToIdle', transition: 'OverUp → Idle', event: 'Roll Out', tracking: 'both' },
  { condition: 'overUpToOverDown', transition: 'OverUp → OverDown', event: 'Press', tracking: 'both' },
  { condition: 'overDownToOverUp', transition: 'OverDown → OverUp', event: 'Release', tracking: 'both' },
  { condition: 'outDownToOverDown', transition: 'OutDown → OverDown', event: 'Drag Over', tracking: 'push' },
  { condition: 'overDownToOutDown', transition: 'OverDown → OutDown', event: 'Drag Out', tracking: 'push' },
  { condition: 'outDownToIdle', transition: 'OutDown → Idle', event: 'Release Outside', tracking: 'push' },
  { condition: 'idleToOverDown', transition: 'Idle → OverDown', event: 'Drag Over', tracking: 'menu' },
  { condition: 'overDownToIdle', transition: 'OverDown → Idle', event: 'Drag Out', tracking: 'menu' },
];

export function buttonTransitionsForTracking(trackAsMenu: boolean): readonly ButtonTransition[] {
  const mode = trackAsMenu ? 'menu' : 'push';
  return BUTTON_TRANSITIONS.filter((entry) => entry.tracking === 'both' || entry.tracking === mode);
}

/** Records for one state, low depth first and authored order for ties. */
export function buttonRecordsForState(records: readonly ButtonRecord[], state: ButtonState): readonly ButtonRecord[] {
  return records
    .map((record, order) => ({ record, order }))
    .filter(({ record }) => record.states.includes(state))
    .sort((a, b) => a.record.depth - b.record.depth || a.order - b.order)
    .map(({ record }) => record);
}

export function matrixIsSingular(matrix: Mat2D): boolean {
  return matrix.a * matrix.d - matrix.b * matrix.c === 0;
}

/** Transforms all four corners, returning the axis-aligned bounds in the button's coordinate space. */
export function transformRect(bounds: Rect, matrix: Mat2D): Rect {
  const points = [
    [bounds.xMin, bounds.yMin],
    [bounds.xMin, bounds.yMax],
    [bounds.xMax, bounds.yMin],
    [bounds.xMax, bounds.yMax],
  ] as const;
  const transformed = points.map(([x, y]) => ({
    x: matrix.a * x + matrix.c * y + matrix.tx,
    y: matrix.b * x + matrix.d * y + matrix.ty,
  }));
  return {
    xMin: Math.min(...transformed.map((point) => point.x)),
    xMax: Math.max(...transformed.map((point) => point.x)),
    yMin: Math.min(...transformed.map((point) => point.y)),
    yMax: Math.max(...transformed.map((point) => point.y)),
  };
}

/** True when the rectangle has an inverted extent (`xMax < xMin` or `yMax < yMin`) per `SF0111`. */
export function isRectDegenerate(rect: Rect): boolean {
  return rect.xMax < rect.xMin || rect.yMax < rect.yMin;
}

/**
 * Returns the axis-aligned union of the given rects. `null` when the input list is empty or every
 * member was degenerate after normalisation. Callers are responsible for emitting `SF0111` when
 * they had to clamp an inverted input (per `IMPL-010` errata E-001).
 */
export function unionRects(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  let xMin = Infinity;
  let xMax = -Infinity;
  let yMin = Infinity;
  let yMax = -Infinity;
  for (const rect of rects) {
    // Tolerate inverted extents by taking min/max across both corners (a future caller that cares
    // about the degenerate case calls isRectDegenerate itself before unioning).
    const rxLo = Math.min(rect.xMin, rect.xMax);
    const rxHi = Math.max(rect.xMin, rect.xMax);
    const ryLo = Math.min(rect.yMin, rect.yMax);
    const ryHi = Math.max(rect.yMin, rect.yMax);
    if (rxLo < xMin) xMin = rxLo;
    if (rxHi > xMax) xMax = rxHi;
    if (ryLo < yMin) yMin = ryLo;
    if (ryHi > yMax) yMax = ryHi;
  }
  if (!Number.isFinite(xMin) || !Number.isFinite(yMin)) return null;
  return { xMin, xMax, yMin, yMax };
}
