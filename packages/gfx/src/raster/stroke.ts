/**
 * Stroke expansion — `GFX` §5.5 (`GFX-R029`…`GFX-R033`).
 *
 * A stroked run is expanded on the CPU into *primitives* — one quad per segment, one wedge/fan per
 * join, one cap per open end — and all of them are rasterised as a single `nonzero` run. That union
 * formulation is what makes `GFX-R033` hold for free: overlapping pieces of the same stroke cannot
 * double-darken because coverage is accumulated before the colour is composited.
 */

import type { Cap, Join, Pt } from '../vector/geometry.js';

export interface StrokeStyle {
  /** Device-space width; hairlines must already have been resolved to 1 device px (`GFX-R030`). */
  readonly width: number;
  readonly startCap: Cap;
  readonly endCap: Cap;
  readonly join: Join;
  readonly miterLimit: number;
  readonly closed: boolean;
}

const ROUND_SEGMENT_ANGLE = Math.PI / 6;
const MAX_ROUND_SEGMENTS = 8;

function sub(a: Pt, b: Pt): Pt {
  return { x: a.x - b.x, y: a.y - b.y };
}

function normalize(v: Pt): Pt | null {
  const length = Math.hypot(v.x, v.y);
  if (length < 1e-12) return null;
  return { x: v.x / length, y: v.y / length };
}

/** Left normal of a direction. */
function perp(d: Pt): Pt {
  return { x: -d.y, y: d.x };
}

function addScaled(p: Pt, v: Pt, scale: number): Pt {
  return { x: p.x + v.x * scale, y: p.y + v.y * scale };
}

function shortestDelta(from: number, to: number): number {
  let delta = to - from;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return delta;
}

function arc(center: Pt, radius: number, startAngle: number, delta: number): Pt[] {
  const segments = Math.min(MAX_ROUND_SEGMENTS, Math.max(1, Math.ceil(Math.abs(delta) / ROUND_SEGMENT_ANGLE)));
  const points: Pt[] = [];
  for (let i = 0; i <= segments; i += 1) {
    const angle = startAngle + (delta * i) / segments;
    points.push({ x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius });
  }
  return points;
}

/** A closed fan approximating a disc, used by round caps on isolated points and 180° reversals. */
function disc(center: Pt, radius: number): Pt[][] {
  const polygons: Pt[][] = [];
  let previous: Pt | null = null;
  for (let i = 0; i <= MAX_ROUND_SEGMENTS; i += 1) {
    const angle = (2 * Math.PI * i) / MAX_ROUND_SEGMENTS;
    const point = { x: center.x + Math.cos(angle) * radius, y: center.y + Math.sin(angle) * radius };
    if (previous) polygons.push([center, previous, point]);
    previous = point;
  }
  return polygons;
}

/** Removes consecutive duplicate points, which would produce zero-length normals (`GFX-R021`). */
export function dedupe(points: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of points) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.x - p.x) < 1e-9 && Math.abs(last.y - p.y) < 1e-9) continue;
    out.push(p);
  }
  return out;
}

/**
 * Expands a flattened polyline into fill primitives in the same space.
 */
export function strokePolygons(points: readonly Pt[], style: StrokeStyle): Pt[][] {
  const pts = dedupe(points);
  const polygons: Pt[][] = [];
  const half = style.width / 2;
  if (half <= 0) return polygons;

  if (pts.length === 1) {
    const only = pts[0];
    if (only && (style.startCap === 'round' || style.endCap === 'round')) polygons.push(...disc(only, half));
    return polygons;
  }

  const segmentCount = style.closed ? pts.length : pts.length - 1;
  for (let i = 0; i < segmentCount; i += 1) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (!a || !b) continue;
    const d = normalize(sub(b, a));
    if (!d) continue;
    const n = perp(d);
    polygons.push([addScaled(a, n, half), addScaled(b, n, half), addScaled(b, n, -half), addScaled(a, n, -half)]);
  }

  const joinCount = style.closed ? pts.length : pts.length - 2;
  for (let i = 0; i < joinCount; i += 1) {
    const vertex = style.closed ? pts[i] : pts[i + 1];
    const prev = style.closed ? pts[(i - 1 + pts.length) % pts.length] : pts[i];
    const next = style.closed ? pts[(i + 1) % pts.length] : pts[i + 2];
    if (!vertex || !prev || !next) continue;
    const d0 = normalize(sub(vertex, prev));
    const d1 = normalize(sub(next, vertex));
    if (!d0 || !d1) continue;
    const cross = d0.x * d1.y - d0.y * d1.x;
    const dot = d0.x * d1.x + d0.y * d1.y;
    if (Math.abs(cross) < 1e-9) {
      // Collinear: nothing to fill. A 180° reversal degenerates into a cap at the vertex.
      if (dot < 0 && style.join === 'round') polygons.push(...disc(vertex, half));
      continue;
    }
    // Only the *outer* side of the turn needs filling: the two segment quads already cover the inner
    // side up to the vertex, so a wedge there would be invisible (`GFX-R029`, `GFX-R032`).
    const side = cross > 0 ? -1 : 1;
    const n0 = addScaled({ x: 0, y: 0 }, perp(d0), side);
    const n1 = addScaled({ x: 0, y: 0 }, perp(d1), side);
    const startAngle = Math.atan2(n0.y, n0.x);
    const endAngle = Math.atan2(n1.y, n1.x);
    const delta = shortestDelta(startAngle, endAngle);
    if (style.join === 'round') {
      const outer = arc(vertex, half, startAngle, delta);
      for (let k = 0; k < outer.length - 1; k += 1) {
        const a = outer[k];
        const b = outer[k + 1];
        if (a && b) polygons.push([vertex, a, b]);
      }
      continue;
    }
    const bisector = normalize({ x: n0.x + n1.x, y: n0.y + n1.y });
    const cosHalf = bisector ? bisector.x * n0.x + bisector.y * n0.y : 0;
    const ratio = cosHalf > 1e-6 ? 1 / cosHalf : Infinity;
    if (style.join === 'miter' && bisector && ratio <= style.miterLimit) {
      polygons.push([
        vertex,
        addScaled(vertex, n0, half),
        addScaled(vertex, bisector, half * ratio),
        addScaled(vertex, n1, half),
      ]);
      continue;
    }
    polygons.push([vertex, addScaled(vertex, n0, half), addScaled(vertex, n1, half)]);
  }

  if (!style.closed) {
    const first = pts[0];
    const last = pts[pts.length - 1];
    if (first && last) {
      const dStart = normalize(sub(first, pts[1] ?? first));
      const dEnd = normalize(sub(last, pts[pts.length - 2] ?? last));
      if (dStart) polygons.push(...cap(first, dStart, half, style.startCap));
      if (dEnd) polygons.push(...cap(last, dEnd, half, style.endCap));
    }
  }

  return polygons.filter((polygon) => polygon.length >= 3);
}

/** Cap primitives; `d` points *along* the stroke, away from the end being capped. */
function cap(at: Pt, d: Pt, half: number, kind: Cap): Pt[][] {
  if (kind === 'butt') return [];
  const n = perp(d);
  if (kind === 'square') {
    return [
      [
        addScaled(at, n, half),
        addScaled(addScaled(at, n, half), d, half),
        addScaled(addScaled(at, n, -half), d, half),
        addScaled(at, n, -half),
      ],
    ];
  }
  const startAngle = Math.atan2(n.y, n.x);
  const midAngle = startAngle + Math.PI / 2;
  const mid = { x: Math.cos(midAngle), y: Math.sin(midAngle) };
  const delta = mid.x * d.x + mid.y * d.y >= 0 ? Math.PI : -Math.PI;
  const outer = arc(at, half, startAngle, delta);
  const polygons: Pt[][] = [];
  for (let i = 0; i < outer.length - 1; i += 1) {
    const a = outer[i];
    const b = outer[i + 1];
    if (a && b) polygons.push([at, a, b]);
  }
  return polygons;
}
