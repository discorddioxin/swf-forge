/**
 * Canonical `VectorShape` serialisation (`IMPL-060-R038`).
 *
 * The IR must serialise as plain data — no typed arrays, no class instances — in a **fixed key
 * order**, so goldens are diffable and byte-stable across platforms (`T-MOD-108`, `REPO-R015`).
 *
 * `JSON.stringify` on the decoder's output is not good enough for a golden:
 *
 *   - key order follows object construction order, which differs between the decode path and any
 *     path that rebuilds a shape with spread syntax;
 *   - optional members (`controlX`, `miterLimit`, `focalPoint`) are present on some edges and
 *     absent on others, so two geometrically identical shapes can stringify differently;
 *   - `-0` stringifies as `0` but compares unequal under `Object.is`, and
 *   - floats print with whatever precision the platform's shortest-round-trip algorithm picks.
 *
 * This module pins all four: every key is written in a declared order, optional members are
 * normalised to an explicit `null`, `-0` is folded to `0`, and non-integers are fixed to six
 * decimals (a twip is 1/20, so six decimals is far beyond anything the format can express).
 */

import type { Edge, FillStyle, Gradient, LineStyle, VectorShape } from '../tags/shape.js';
import type { Mat2D, Rect, Rgba } from '../io/types.js';

function num(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value === 0) return 0; // folds -0
  return Number.isInteger(value) ? value : Number(value.toFixed(6));
}

function rect(value: Rect | null): unknown {
  if (value === null) return null;
  return { xMin: num(value.xMin), xMax: num(value.xMax), yMin: num(value.yMin), yMax: num(value.yMax) };
}

function rgba(value: Rgba): unknown {
  return { r: value.r, g: value.g, b: value.b, a: value.a };
}

function matrix(value: Mat2D): unknown {
  return { a: num(value.a), b: num(value.b), c: num(value.c), d: num(value.d), tx: num(value.tx), ty: num(value.ty) };
}

function gradient(value: Gradient): unknown {
  return {
    spreadMode: value.spreadMode,
    interpolationMode: value.interpolationMode,
    focalPoint: value.focalPoint === undefined ? null : num(value.focalPoint),
    stops: value.stops.map((stop) => ({ ratio: stop.ratio, color: rgba(stop.color) })),
  };
}

function fillStyle(value: FillStyle | null): unknown {
  if (value === null) return null;
  switch (value.kind) {
    case 'solid':
      return { kind: 'solid', color: rgba(value.color) };
    case 'gradient':
      return {
        kind: 'gradient',
        linear: value.linear,
        matrix: matrix(value.matrix),
        gradient: gradient(value.gradient),
      };
    case 'bitmap':
      return {
        kind: 'bitmap',
        bitmapId: value.bitmapId,
        repeat: value.repeat,
        smoothed: value.smoothed,
        matrix: matrix(value.matrix),
      };
  }
}

function lineStyle(value: LineStyle | null): unknown {
  if (value === null) return null;
  return {
    width: num(value.width),
    color: rgba(value.color),
    caps: value.caps === undefined ? null : { start: value.caps.start, end: value.caps.end },
    join: value.join ?? null,
    miterLimit: value.miterLimit === undefined ? null : num(value.miterLimit),
    noHScale: value.noHScale ?? null,
    noVScale: value.noVScale ?? null,
    pixelHinting: value.pixelHinting ?? null,
    noClose: value.noClose ?? null,
    fill: value.fill === undefined ? null : fillStyle(value.fill),
  };
}

function edge(value: Edge): unknown {
  return {
    fromX: num(value.fromX),
    fromY: num(value.fromY),
    toX: num(value.toX),
    toY: num(value.toY),
    controlX: value.controlX === undefined ? null : num(value.controlX),
    controlY: value.controlY === undefined ? null : num(value.controlY),
  };
}

/** The canonical plain-data form. Key order here *is* the contract. */
export function canonicalVectorShape(shape: VectorShape): unknown {
  return {
    id: shape.id,
    version: shape.version,
    rawShape4Flags: shape.rawShape4Flags,
    bounds: rect(shape.bounds),
    edgeBounds: rect(shape.edgeBounds),
    recomputedBounds: rect(shape.recomputedBounds),
    fillRule: shape.fillRule,
    nonScalingStrokes: shape.nonScalingStrokes,
    scalingStrokes: shape.scalingStrokes,
    styles: {
      fills: shape.styles.fills.map(fillStyle),
      lines: shape.styles.lines.map(lineStyle),
    },
    edges: shape.edges.map(edge),
    paths: shape.paths.map((path) => ({
      styleId: path.styleId,
      edgeRefs: [...path.edgeRefs],
      closed: path.closed,
      implicitClose: path.implicitClose,
    })),
    strokes: shape.strokes.map((stroke) => ({
      styleId: stroke.styleId,
      edgeRefs: [...stroke.edgeRefs],
      closed: stroke.closed,
    })),
  };
}

/**
 * Canonical JSON. Deliberately excludes `recordTrace`: it is a decoder-internal breadcrumb for the
 * morph conformance checker, not geometry, and hand-built IR does not carry it — including it would
 * make a decoded shape and an identical hand-built one serialise differently.
 */
export function serialiseVectorShape(shape: VectorShape): string {
  return JSON.stringify(canonicalVectorShape(shape));
}

/**
 * Stable 64-bit FNV-1a digest of the canonical form, as 16 lowercase hex digits.
 *
 * FNV-1a rather than a cryptographic hash: this identifies geometry for golden comparison and cache
 * keys, it is not a security boundary, and it keeps the package free of a `node:crypto` import so
 * the IR stays usable in the browser runtime.
 */
export function vectorShapeDigest(shape: VectorShape): string {
  const text = serialiseVectorShape(shape);
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    hash = ((hash ^ BigInt(code & 0xff)) * prime) & mask;
    if (code > 0xff) hash = ((hash ^ BigInt(code >> 8)) * prime) & mask;
  }
  return hash.toString(16).padStart(16, '0');
}
