/**
 * Morph interpolation and the ratio-bake decision (`IMPL-070` §6.3, `WP-070-12`).
 *
 * `PlaceObject2`/`PlaceObject3` carry a 16-bit `Ratio`: `0` is exactly the start state, `65535`
 * exactly the end state (`IMPL-070-R023`). This module turns a decoded `MorphShapeModel` plus a
 * ratio into the same `VectorShape` IR a static shape decodes to, so the renderer has one geometry
 * type and one tessellator entry point.
 *
 * Two rules shape the implementation:
 *
 *   - **`IMPL-070-R031`** — at ratio `0` and `65535` the result MUST be bit-for-bit the endpoint
 *     geometry, so no ratio-dependent wobble appears at the ends of a tween.
 *   - **`IMPL-070-R030`** — a straight edge paired with a curve is promoted to a quadratic with
 *     `control = delta / 2`, which halves odd twip deltas. Those rational twips MUST survive
 *     interpolation and be rounded **once**, at the end, with banker's rounding.
 */

import { Codes } from '../diagnostics/codes.js';
import type { Severity } from '../diagnostics/types.js';
import type { Mat2D, Rgba } from '../io/types.js';
import type { MorphShapeModel } from '../tags/morph.js';
import type { Edge, FillStyle, Gradient, LineStyle, VectorShape } from '../tags/shape.js';

/** The subset of `Cursor.emit` this module needs; production callers pass the parse sink's. */
export type MorphEmit = (code: string, severity: Severity, message: string) => void;

const RATIO_MAX = 65535;

/**
 * Round half to **even** (`IMPL-070-R030`).
 *
 * Morph geometry is full of exact halves: every straight edge paired with a curve contributes
 * `delta / 2`, and interpolating at ratio 32767.5-equivalents lands on `.5` constantly. Rounding
 * all of them the same direction walks the shape off its anchors as the tween runs; round-half-even
 * cancels instead of accumulating. It is also symmetric about zero, so it keeps the mirror
 * invariance that `quantiseScalar` is built around.
 *
 * This is deliberately *not* `quantiseScalar` from the C2 stage, which rounds half away from zero.
 * Both tie-breaks are symmetric about the origin; only this one is unbiased, and R030 names it.
 */
export function roundTiesToEven(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const floor = Math.floor(value);
  const diff = value - floor;
  if (diff > 0.5) return floor + 1;
  if (diff < 0.5) return floor === 0 ? 0 : floor;
  const result = floor % 2 === 0 ? floor : floor + 1;
  return result === 0 ? 0 : result;
}

/**
 * Linear interpolation that is **exact at both ends**.
 *
 * `a + t * (b - a)` is the familiar form and it is wrong here: at `t === 1` it evaluates to
 * `a + (b - a)`, which is not always `b` in binary floating point. `(1 - t) * a + t * b` returns
 * `a` at `t === 0` and `b` at `t === 1` exactly, which is what `R031` demands.
 */
function lerp(a: number, b: number, t: number): number {
  return (1 - t) * a + t * b;
}

function lerpByte(a: number, b: number, t: number): number {
  const value = roundTiesToEven(lerp(a, b, t));
  return value < 0 ? 0 : value > 255 ? 255 : value;
}

function lerpColor(a: Rgba, b: Rgba, t: number): Rgba {
  return {
    r: lerpByte(a.r, b.r, t),
    g: lerpByte(a.g, b.g, t),
    b: lerpByte(a.b, b.b, t),
    a: lerpByte(a.a, b.a, t),
  };
}

function lerpMatrix(a: Mat2D, b: Mat2D, t: number): Mat2D {
  return {
    a: lerp(a.a, b.a, t),
    b: lerp(a.b, b.b, t),
    c: lerp(a.c, b.c, t),
    d: lerp(a.d, b.d, t),
    tx: lerp(a.tx, b.tx, t),
    ty: lerp(a.ty, b.ty, t),
  };
}

function lerpGradient(a: Gradient, b: Gradient, t: number): Gradient {
  // Paired by index. A style-level count mismatch is already reported as `SF0267` at decode time;
  // here we simply pair as far as both ramps go rather than inventing stops.
  const count = Math.min(a.stops.length, b.stops.length);
  const stops = Array.from({ length: count }, (_, i) => {
    const sa = a.stops[i] as { ratio: number; color: Rgba };
    const sb = b.stops[i] as { ratio: number; color: Rgba };
    return { ratio: lerpByte(sa.ratio, sb.ratio, t), color: lerpColor(sa.color, sb.color, t) };
  });
  const focal =
    a.focalPoint !== undefined && b.focalPoint !== undefined ? lerp(a.focalPoint, b.focalPoint, t) : a.focalPoint;
  return {
    spreadMode: a.spreadMode,
    interpolationMode: a.interpolationMode,
    stops,
    ...(focal !== undefined ? { focalPoint: focal } : {}),
  };
}

function lerpFill(a: FillStyle | null, b: FillStyle | null, t: number): FillStyle | null {
  if (a === null || b === null) return a ?? b;
  // A kind change between endpoints is malformed and already reported (`SF0268`); the start kind
  // wins so the frame still renders something recognisable.
  if (a.kind !== b.kind) return a;
  if (a.kind === 'solid' && b.kind === 'solid') return { kind: 'solid', color: lerpColor(a.color, b.color, t) };
  if (a.kind === 'gradient' && b.kind === 'gradient') {
    return {
      kind: 'gradient',
      linear: a.linear,
      matrix: lerpMatrix(a.matrix, b.matrix, t),
      gradient: lerpGradient(a.gradient, b.gradient, t),
    };
  }
  if (a.kind === 'bitmap' && b.kind === 'bitmap') {
    // The bitmap id must match between endpoints (`SF0268` when it does not); only the matrix moves.
    return { ...a, matrix: lerpMatrix(a.matrix, b.matrix, t) };
  }
  return a;
}

function lerpLine(a: LineStyle | null, b: LineStyle | null, t: number): LineStyle | null {
  if (a === null || b === null) return a ?? b;
  // `MORPHLINESTYLE2` carries one shared flag word (`IMPL-070-R026`), so caps, joins, the miter
  // limit and the hinting flags are the same object on both sides by construction; only the width,
  // the colour and any fill vary.
  return {
    ...a,
    width: roundTiesToEven(lerp(a.width, b.width, t)),
    color: lerpColor(a.color, b.color, t),
    ...(a.fill !== undefined && b.fill !== undefined ? { fill: lerpFill(a.fill, b.fill, t) ?? a.fill } : {}),
  };
}

function lerpEdge(a: Edge, b: Edge, t: number, round: boolean): Edge {
  const snap = (value: number): number => (round ? roundTiesToEven(value) : value);
  const aCurved = a.controlX !== undefined && a.controlY !== undefined;
  const bCurved = b.controlX !== undefined && b.controlY !== undefined;
  const base = {
    fromX: snap(lerp(a.fromX, b.fromX, t)),
    fromY: snap(lerp(a.fromY, b.fromY, t)),
    toX: snap(lerp(a.toX, b.toX, t)),
    toY: snap(lerp(a.toY, b.toY, t)),
  };
  if (!aCurved || !bCurved) return base;
  return {
    ...base,
    controlX: snap(lerp(a.controlX as number, b.controlX as number, t)),
    controlY: snap(lerp(a.controlY as number, b.controlY as number, t)),
  };
}

export interface MorphInterpolateOptions {
  /**
   * Round the result to integer twips (default `true`).
   *
   * Pass `false` to keep the rational twips R030 asks the IR to carry — a caller that is going to
   * transform the geometry again should round once, at the end, not here and again later.
   */
  readonly round?: boolean;
}

/**
 * Build the `VectorShape` for one ratio.
 *
 * At `0` and `65535` the **original** endpoint edges are used, not the quadratic promotions: a
 * straight edge that was promoted for pairing must come back as a straight edge so the result is
 * identical to the static shape (`R031`, `T-MOD-401`).
 */
export function interpolateMorph(
  model: MorphShapeModel,
  ratio: number,
  options: MorphInterpolateOptions = {},
): VectorShape {
  const clamped = ratio < 0 ? 0 : ratio > RATIO_MAX ? RATIO_MAX : ratio;
  const round = options.round !== false;
  const t = clamped / RATIO_MAX;
  const atStart = clamped === 0;
  const atEnd = clamped === RATIO_MAX;

  if (atStart) return model.start;
  if (atEnd) return model.end;

  const edges = model.pairs.map((pair) => lerpEdge(pair.morphStart, pair.morphEnd, t, round));
  const fills = model.start.styles.fills.map((fill, index) => lerpFill(fill, model.end.styles.fills[index] ?? null, t));
  const lines = model.start.styles.lines.map((line, index) => lerpLine(line, model.end.styles.lines[index] ?? null, t));

  return {
    ...model.start,
    bounds: {
      xMin: roundTiesToEven(lerp(model.startBounds.xMin, model.endBounds.xMin, t)),
      xMax: roundTiesToEven(lerp(model.startBounds.xMax, model.endBounds.xMax, t)),
      yMin: roundTiesToEven(lerp(model.startBounds.yMin, model.endBounds.yMin, t)),
      yMax: roundTiesToEven(lerp(model.startBounds.yMax, model.endBounds.yMax, t)),
    },
    edgeBounds: null,
    recomputedBounds: null,
    styles: { fills, lines },
    edges,
  };
}

// ---- ratio baking (`IMPL-070-R032`) -------------------------------------------------------------

/** Upper bound on a frame's vertex buffer before welding: two endpoints per edge. */
function verticesPerFrame(model: MorphShapeModel): number {
  return model.pairs.length * 2;
}

export interface MorphBakeOptions {
  /**
   * The finite set of ratios the renderer animates through (`GFX-D14`). Default **empty**, which
   * means runtime interpolation — baking an arbitrary ratio is forbidden by `R032`.
   */
  readonly ratioBake?: readonly number[];
  /**
   * Vertex ceiling across all baked frames. Defaults to 65 535: a baked morph becomes one mesh, and
   * 16-bit index buffers are the floor of what the GL ES 2 target supports.
   */
  readonly vertexBudget?: number;
  readonly emit?: MorphEmit;
}

export interface MorphBakedFrame {
  readonly ratio: number;
  readonly shape: VectorShape;
}

export interface MorphBakeResult {
  /** `runtime` = nothing baked; `baked` = frames below; `dropped` = over budget, nothing usable. */
  readonly strategy: 'runtime' | 'baked' | 'dropped';
  readonly frames: readonly MorphBakedFrame[];
  readonly vertexCount: number;
  readonly vertexBudget: number;
}

/**
 * Decide how a morph reaches the renderer, and record the decision (`IMPL-070-R032`).
 *
 * The decision is always reported, including when nothing is baked: `SF0262` exists so a reader of
 * the report can tell "runtime interpolation" from "baked at these ratios" without re-deriving the
 * emitter's configuration. Silence would be indistinguishable from the stage not having run.
 */
export function bakeMorphRatios(model: MorphShapeModel, options: MorphBakeOptions = {}): MorphBakeResult {
  const emit = options.emit ?? ((): void => {});
  const vertexBudget = options.vertexBudget ?? 65_535;
  // De-duplicated and sorted, so the same configuration always produces the same frame order.
  const ratios = [...new Set(options.ratioBake ?? [])]
    .filter((ratio) => Number.isInteger(ratio) && ratio >= 0 && ratio <= RATIO_MAX)
    .sort((a, b) => a - b);

  if (ratios.length === 0) {
    emit(
      Codes.MORPH_RATIO_BAKED,
      'info',
      `morph ${model.id} uses runtime interpolation; no ratios baked (GFX-D14 default)`,
    );
    return { strategy: 'runtime', frames: [], vertexCount: 0, vertexBudget };
  }

  const vertexCount = ratios.length * verticesPerFrame(model);
  if (vertexCount > vertexBudget) {
    emit(
      Codes.MORPH_VERTEX_BUDGET_EXCEEDED,
      'error',
      `morph ${model.id} would bake ${ratios.length} ratio(s) to ${vertexCount} vertices, over the ${vertexBudget} budget; mesh dropped`,
    );
    return { strategy: 'dropped', frames: [], vertexCount, vertexBudget };
  }

  emit(
    Codes.MORPH_RATIO_BAKED,
    'info',
    `morph ${model.id} baked at ratio(s) ${ratios.join(', ')} (${vertexCount} vertices)`,
  );
  return {
    strategy: 'baked',
    frames: ratios.map((ratio) => ({ ratio, shape: interpolateMorph(model, ratio) })),
    vertexCount,
    vertexBudget,
  };
}
