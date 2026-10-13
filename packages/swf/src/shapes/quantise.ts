/**
 * Quantisation — stage 5 of the fixed geometry pipeline (`IMPL-060-R034`):
 *
 *   decode -> edge reconstruction -> style chaining -> IR -> **quantise** -> simplify -> flatten
 *
 * `IMPL-060-R035`: quantisation applies to the *input* of simplification, so simplify always sees
 * grid-aligned coordinates and its output is reproducible (`T-MOD-107`).
 *
 * `IMPL-060-R037`: coordinates stay in **integer twips** right through the IR. Our decoder already
 * satisfies that — it accumulates pen deltas as integers and never touches a float — so quantising
 * freshly-decoded geometry is a no-op by construction. The stage earns its keep on geometry that
 * did go through arithmetic: morph ratio interpolation, curve subdivision, and matrix application
 * all produce fractional twips, and those are exactly the paths where two engines drift apart.
 */

import type { Edge, VectorShape } from '../tags/shape.js';
// One pixel is twenty twips; a 1-twip grid is the 1/20-px grid the chapter asks for. Re-exported
// here so the quantiser and its callers agree on the unit without reaching across to the io layer.
export { TWIPS_PER_PIXEL } from '../io/types.js';

export interface QuantiseOptions {
  /**
   * Grid spacing in twips. Defaults to `1` — the 1/20-px grid.
   *
   * The chapter writes the grid two ways in the same sentence ("1/20 px at smoothing 0, 0.05 px
   * above"); 1/20 px *is* 0.05 px, so both phrasings denote one grid and there is nothing to
   * switch on. We take the single grid and expose the spacing rather than a smoothing flag, so a
   * caller that genuinely needs a finer grid asks for it in the unit the IR is stored in. See the
   * C2 audit note for the errata.
   */
  readonly gridTwips?: number;
}

/**
 * Round half away from zero.
 *
 * `Math.round` rounds half *up* (toward +∞), so `Math.round(-0.5)` is `-0` while `Math.round(0.5)`
 * is `1` — the grid would be asymmetric about the origin and a shape would not survive being
 * mirrored. Away-from-zero keeps |q(-x)| === |q(x)| for every x, which is what makes a quantised
 * shape and its reflection produce identical geometry.
 */
function roundHalfAwayFromZero(value: number): number {
  return value < 0 ? -Math.round(-value) : Math.round(value);
}

/** Snap one scalar to the grid. `-0` is normalised to `0` so serialisation stays byte-stable. */
export function quantiseScalar(value: number, gridTwips = 1): number {
  if (!Number.isFinite(value)) return 0;
  if (gridTwips <= 0) return value;
  const snapped = roundHalfAwayFromZero(value / gridTwips) * gridTwips;
  return snapped === 0 ? 0 : snapped;
}

function quantiseEdge(edge: Edge, grid: number): Edge {
  const fromX = quantiseScalar(edge.fromX, grid);
  const fromY = quantiseScalar(edge.fromY, grid);
  const toX = quantiseScalar(edge.toX, grid);
  const toY = quantiseScalar(edge.toY, grid);
  if (edge.controlX === undefined || edge.controlY === undefined) {
    return { fromX, fromY, toX, toY };
  }
  return {
    fromX,
    fromY,
    toX,
    toY,
    controlX: quantiseScalar(edge.controlX, grid),
    controlY: quantiseScalar(edge.controlY, grid),
  };
}

/**
 * Snap every coordinate in the shape to the grid.
 *
 * Styles, path membership, winding order and edge indices are untouched — quantisation moves
 * points, it never changes topology. Dropping the segments this collapses is simplification's job
 * (step 1), which is why the two stages are separate and ordered.
 */
export function quantiseShape(shape: VectorShape, options: QuantiseOptions = {}): VectorShape {
  const grid = options.gridTwips ?? 1;
  return { ...shape, edges: shape.edges.map((edge) => quantiseEdge(edge, grid)) };
}

/** True when every coordinate already sits on the grid — the post-condition of `quantiseShape`. */
export function isQuantised(shape: VectorShape, gridTwips = 1): boolean {
  const onGrid = (value: number): boolean => quantiseScalar(value, gridTwips) === value;
  return shape.edges.every(
    (edge) =>
      onGrid(edge.fromX) &&
      onGrid(edge.fromY) &&
      onGrid(edge.toX) &&
      onGrid(edge.toY) &&
      (edge.controlX === undefined || onGrid(edge.controlX)) &&
      (edge.controlY === undefined || onGrid(edge.controlY)),
  );
}
