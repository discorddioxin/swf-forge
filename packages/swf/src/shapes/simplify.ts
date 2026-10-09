/**
 * Simplification — stage 6 of the fixed geometry pipeline (`IMPL-060-R034`).
 *
 * `IMPL-060-R036`: simplification MUST be deterministic (no RNG, no clock, no dependence on
 * iteration order) and MUST run in this order:
 *
 *   1. drop zero-length segments
 *   2. merge collinear lines
 *   3. drop curves whose chord deviation is sub-pixel at the renderer tolerance
 *   4. drop paths that degenerate below one device pixel of area
 *
 * **The order is part of the contract**, not an implementation detail: step 2 can only see a
 * collinear run once step 1 has removed the zero-length segments sitting between its parts, and
 * step 4 can only judge a path's area once steps 1–3 have finished moving its vertices. Running
 * them in any other order gives a different — still self-consistent, but different — result, and
 * goldens recorded under one order would not reproduce under another.
 *
 * Every step is reported in `SimplifyStats` so a test can assert not just the output but that each
 * step did the work attributed to it (`T-MOD-107`).
 */

import type { Edge, FillPath, StrokePath, VectorShape } from '../tags/shape.js';
import { TWIPS_PER_PIXEL } from './quantise.js';

export interface SimplifyOptions {
  /**
   * Renderer flattening tolerance in device pixels. A curve whose maximum deviation from its own
   * chord is below this is visually a straight line, so step 3 replaces it with one. Default 0.05 px
   * — one twip, the finest distance the source format can even express.
   */
  readonly tolerancePx?: number;
  /**
   * Minimum path area in device pixels². Step 4 drops paths below it. Default 1 px², per R036's
   * "degenerate below one device pixel of area".
   */
  readonly minAreaPx2?: number;
}

export interface SimplifyStats {
  /** Step 1: segments whose two endpoints coincide. */
  readonly zeroLengthDropped: number;
  /** Step 2: line segments absorbed into a preceding collinear line. */
  readonly collinearMerged: number;
  /** Step 3: curves whose control point lies within tolerance of the chord. */
  readonly curvesFlattened: number;
  /** Step 4: fill paths whose |signed area| fell below the floor. */
  readonly pathsDropped: number;
}

export interface SimplifyResult {
  readonly shape: VectorShape;
  readonly stats: SimplifyStats;
}

const isCurve = (edge: Edge): boolean => edge.controlX !== undefined && edge.controlY !== undefined;

/** A segment is zero-length when it starts and ends at the same point (and does not bulge). */
function isZeroLength(edge: Edge): boolean {
  if (edge.fromX !== edge.toX || edge.fromY !== edge.toY) return false;
  if (!isCurve(edge)) return true;
  // A curve returning to its origin still encloses area unless the control point is there too.
  return edge.controlX === edge.fromX && edge.controlY === edge.fromY;
}

/** Twice the signed area of the triangle (a, b, c); zero exactly when the three are collinear. */
function cross(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
}

/**
 * Maximum distance from a quadratic's control point to its chord.
 *
 * For a quadratic Bézier the curve's farthest excursion from the chord is half the control point's
 * distance from it (the curve passes through the midpoint of the control-to-chord-midpoint span),
 * so the half factor is the real bound, not a fudge.
 */
function controlDeviationTwips(edge: Edge): number {
  const cx = edge.controlX ?? edge.fromX;
  const cy = edge.controlY ?? edge.fromY;
  const dx = edge.toX - edge.fromX;
  const dy = edge.toY - edge.fromY;
  const chord = Math.hypot(dx, dy);
  if (chord === 0) return Math.hypot(cx - edge.fromX, cy - edge.fromY) / 2;
  return Math.abs(cross(edge.fromX, edge.fromY, edge.toX, edge.toY, cx, cy)) / chord / 2;
}

/**
 * Can `edge` be absorbed into the straight line `previous`?
 *
 * Collinearity is tested as an exact `cross === 0` rather than "within epsilon". After
 * quantisation every coordinate is an integer twip, so the cross product is an exact integer and a
 * tolerance would only let the merge swallow genuine, if shallow, corners.
 *
 * The dot-product test rejects a reversal: `A -> B -> A` is collinear but folding it into a single
 * edge would erase a spur that the fill rule counts.
 */
function isMergeable(previous: Edge, edge: Edge): boolean {
  if (isCurve(previous) || isCurve(edge)) return false;
  if (previous.toX !== edge.fromX || previous.toY !== edge.fromY) return false;
  if (cross(previous.fromX, previous.fromY, previous.toX, previous.toY, edge.toX, edge.toY) !== 0) return false;
  const dot =
    (edge.toX - edge.fromX) * (previous.toX - previous.fromX) +
    (edge.toY - edge.fromY) * (previous.toY - previous.fromY);
  return dot > 0;
}

/** Shoelace area over a path's edge chain, in twips². Control points are ignored (chord polygon). */
function pathAreaTwips2(edgeRefs: readonly number[], edges: readonly Edge[]): number {
  let sum = 0;
  for (const ref of edgeRefs) {
    const edge = edges[ref];
    if (edge === undefined) continue;
    sum += edge.fromX * edge.toY - edge.toX * edge.fromY;
  }
  return Math.abs(sum) / 2;
}

/**
 * Run the four steps, in order, over a quantised shape.
 *
 * The edges are a single shared pool: the decoder appends each edge once and pushes its index onto
 * every run that is live at that moment (`IMPL-060-R030`), so one edge index is routinely shared by
 * a fill-left run, a fill-right run and a stroke run. Two consequences drive the implementation:
 *
 *   - a chain rewrite must never mutate a pooled edge whose *geometry* the other chains disagree
 *     about. Collinear merging is chain-local (the same edge may be mid-run in one chain and
 *     terminal in another), so a merge appends a fresh edge and re-points only that chain;
 *     flattening is a property of the edge alone, so it may be applied in place;
 *   - an edge is only really gone once no surviving chain refers to it, which is what the final
 *     compaction pass decides.
 */
export function simplifyShape(shape: VectorShape, options: SimplifyOptions = {}): SimplifyResult {
  const tolerancePx = options.tolerancePx ?? 0.05;
  const minAreaPx2 = options.minAreaPx2 ?? 1;
  const toleranceTwips = tolerancePx * TWIPS_PER_PIXEL;
  const minAreaTwips2 = minAreaPx2 * TWIPS_PER_PIXEL * TWIPS_PER_PIXEL;

  const pool: Edge[] = [...shape.edges];
  let collinearMerged = 0;
  let curvesFlattened = 0;
  let pathsDropped = 0;

  // ---- step 1: drop zero-length segments ------------------------------------------------------
  // Decided per pooled edge, not per reference: "has no length" is a property of the edge, and an
  // edge that is zero-length for the fill run is zero-length for the stroke run sharing it.
  const keepEdge = pool.map((edge) => !isZeroLength(edge));
  const zeroLengthDropped = keepEdge.filter((keep) => !keep).length;
  const dropZeroLength = (refs: readonly number[]): number[] => refs.filter((ref) => keepEdge[ref] === true);

  /**
   * Step 2: merge collinear lines along one chain.
   *
   * Only straight edges merge, and only when they are exactly collinear *and* continue in the same
   * direction — a spur that doubles back is a real feature of the outline, not redundancy, and
   * folding it away would change the winding.
   *
   * The merged edge is appended to the pool rather than written over its predecessor, because the
   * predecessor may still be referenced by a concurrent run that did not reach the same merge.
   */
  const mergeCollinear = (refs: readonly number[]): number[] => {
    const out: number[] = [];
    for (const ref of refs) {
      const edge = pool[ref];
      if (edge === undefined) continue;
      const previousRef = out[out.length - 1];
      const previous = previousRef === undefined ? undefined : pool[previousRef];
      if (previous !== undefined && isMergeable(previous, edge)) {
        pool.push({ fromX: previous.fromX, fromY: previous.fromY, toX: edge.toX, toY: edge.toY });
        out[out.length - 1] = pool.length - 1;
        collinearMerged += 1;
        continue;
      }
      out.push(ref);
    }
    return out;
  };

  const runSteps1And2 = (refs: readonly number[]): number[] => mergeCollinear(dropZeroLength(refs));

  const paths: FillPath[] = shape.paths.map((path) => ({ ...path, edgeRefs: runSteps1And2(path.edgeRefs) }));
  const strokes: StrokePath[] = shape.strokes.map((stroke) => ({
    ...stroke,
    edgeRefs: runSteps1And2(stroke.edgeRefs),
  }));

  // ---- step 3: flatten sub-tolerance curves ----------------------------------------------------
  // Applied after step 2, per the fixed order. Flattening can expose a fresh collinear run, and we
  // deliberately do not go back for it: a second merge pass would make the output depend on how
  // many times the loop ran, and R036 asks for a fixed order, not a fixed point.
  const referencedAfterStep2 = new Set<number>();
  for (const path of paths) for (const ref of path.edgeRefs) referencedAfterStep2.add(ref);
  for (const stroke of strokes) for (const ref of stroke.edgeRefs) referencedAfterStep2.add(ref);
  for (const ref of [...referencedAfterStep2].sort((a, b) => a - b)) {
    const edge = pool[ref];
    if (edge === undefined || !isCurve(edge)) continue;
    if (controlDeviationTwips(edge) > toleranceTwips) continue;
    pool[ref] = { fromX: edge.fromX, fromY: edge.fromY, toX: edge.toX, toY: edge.toY };
    curvesFlattened += 1;
  }

  // ---- step 4: drop degenerate fill paths ------------------------------------------------------
  // Fills only. A stroke with no area is a line, which is the whole point of a stroke; dropping it
  // would erase every straight rule and underline in the movie. An emptied stroke still goes, since
  // there is nothing left to draw.
  const keptPaths = paths.filter((path) => {
    if (path.edgeRefs.length === 0 || pathAreaTwips2(path.edgeRefs, pool) < minAreaTwips2) {
      pathsDropped += 1;
      return false;
    }
    return true;
  });
  const keptStrokes = strokes.filter((stroke) => stroke.edgeRefs.length > 0);

  // ---- compaction: renumber the pool so the IR carries no orphan edges -------------------------
  // Ascending source order, so the mapping is a function of the input alone and two runs over the
  // same shape produce identical indices — the basis for the byte-stable golden (`T-MOD-108`).
  const referenced = new Set<number>();
  for (const path of keptPaths) for (const ref of path.edgeRefs) referenced.add(ref);
  for (const stroke of keptStrokes) for (const ref of stroke.edgeRefs) referenced.add(ref);
  const order = [...referenced].sort((a, b) => a - b);
  const remap = new Map<number, number>();
  order.forEach((ref, index) => remap.set(ref, index));
  const edges = order.map((ref) => pool[ref] as Edge);

  return {
    shape: {
      ...shape,
      edges,
      paths: keptPaths.map((path) => ({ ...path, edgeRefs: path.edgeRefs.map((ref) => remap.get(ref) as number) })),
      strokes: keptStrokes.map((stroke) => ({
        ...stroke,
        edgeRefs: stroke.edgeRefs.map((ref) => remap.get(ref) as number),
      })),
    },
    stats: { zeroLengthDropped, collinearMerged, curvesFlattened, pathsDropped },
  };
}
