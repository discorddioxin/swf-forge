/**
 * Display list and scene flattening — the renderer's half of `IMPL-030` §7/§8 and `GFX` §3.3.
 *
 * The op types are *structural*: they match the decoded model field-for-field without importing it,
 * which is how `IMPL-130-R001` is kept (the renderer never sees SWF bytes).
 *
 * Status: `clipDepth` masks are applied as the masker's transformed **bounds rectangle** — enough for
 * the static-render gate, with the stencil upgrade tracked by `T-GFX-015` (`WP-130-11`).
 */

import type { Pt, ShapeGeometry } from '../vector/geometry.js';
import { pointBounds } from '../vector/flatten.js';
import type { ClipRect } from '../raster/scanline.js';

export interface Transform2D {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly tx: number;
  readonly ty: number;
}

export const IDENTITY: Transform2D = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

export interface CxformLike {
  readonly rm: number;
  readonly gm: number;
  readonly bm: number;
  readonly am: number;
  readonly ra: number;
  readonly ga: number;
  readonly ba: number;
  readonly aa: number;
}

/** `parent ∘ child`: the child's point is transformed first, then the parent's. */
export function multiply(parent: Transform2D, child: Transform2D): Transform2D {
  return {
    a: parent.a * child.a + parent.c * child.b,
    b: parent.b * child.a + parent.d * child.b,
    c: parent.a * child.c + parent.c * child.d,
    d: parent.b * child.c + parent.d * child.d,
    tx: parent.a * child.tx + parent.c * child.ty + parent.tx,
    ty: parent.b * child.tx + parent.d * child.ty + parent.ty,
  };
}

export function transformPoint(m: Transform2D, p: Pt): Pt {
  return { x: m.a * p.x + m.c * p.y + m.tx, y: m.b * p.x + m.d * p.y + m.ty };
}

/** Uniform scale factor of a transform; non-uniform scales are approximated by `sqrt(|det|)`. */
export function transformScale(m: Transform2D): number {
  const det = Math.abs(m.a * m.d - m.b * m.c);
  return Math.sqrt(det);
}

export interface PlacementOpLike {
  readonly kind: 'place';
  readonly depth: number;
  readonly move: boolean;
  readonly characterId: number | null;
  readonly matrix: { a: number; b: number; c: number; d: number; tx: number; ty: number } | null;
  readonly cxform: CxformLike | null;
  readonly clipDepth: number | null;
  readonly visible: boolean | null;
}

export interface RemovalOpLike {
  readonly kind: 'remove';
  readonly depth: number;
}

export type TimelineOpLike = PlacementOpLike | RemovalOpLike | { readonly kind: 'tabIndex' };

export interface DisplayEntry {
  readonly depth: number;
  readonly characterId: number | null;
  readonly matrix: Transform2D;
  readonly cxform: CxformLike | null;
  readonly clipDepth: number | null;
  readonly visible: boolean;
  /** File order inside the frame: the tie-break when two placements share a depth. */
  readonly order: number;
}

/** Applies one frame's ops to a display list without mutating the input (`IMPL-030-R031`). */
export function applyOps(entries: readonly DisplayEntry[], ops: readonly TimelineOpLike[]): DisplayEntry[] {
  const byDepth = new Map<number, DisplayEntry>();
  for (const entry of entries) byDepth.set(entry.depth, entry);
  let order = entries.length;

  for (const op of ops) {
    if (op.kind === 'remove') {
      byDepth.delete(op.depth);
      order += 1;
      continue;
    }
    if (op.kind !== 'place') continue;
    const prior = byDepth.get(op.depth);
    const matrix: Transform2D = op.matrix
      ? { a: op.matrix.a, b: op.matrix.b, c: op.matrix.c, d: op.matrix.d, tx: op.matrix.tx, ty: op.matrix.ty }
      : (prior?.matrix ?? IDENTITY);
    byDepth.set(op.depth, {
      depth: op.depth,
      characterId: op.characterId ?? prior?.characterId ?? null,
      matrix,
      cxform: op.cxform ?? prior?.cxform ?? null,
      clipDepth: op.clipDepth ?? prior?.clipDepth ?? null,
      visible: op.visible ?? prior?.visible ?? true,
      order: order++,
    });
  }

  return [...byDepth.values()].sort((p, q) => (p.depth === q.depth ? p.order - q.order : p.depth - q.depth));
}

export interface DrawItem {
  readonly shape: ShapeGeometry;
  readonly matrix: Transform2D;
  readonly cxform: CxformLike | null;
  readonly clip: ClipRect | null;
  readonly depth: number;
}

export interface ResolvedCharacter {
  readonly geometry: ShapeGeometry | null;
  /** For sprites: the child timeline's current display list. */
  readonly timeline?: readonly DisplayEntry[];
}

export type CharacterResolver = (characterId: number) => ResolvedCharacter | null;

export interface FlattenSceneOptions {
  readonly transform?: Transform2D;
  readonly cxform?: CxformLike | null;
  readonly clip?: ClipRect | null;
  /** Guard against a sprite that (illegally) contains itself; `SF0103` caps real nesting at 32. */
  readonly maxDepth?: number;
}

/**
 * Depth-first flatten of a display list into draw items, parents applied to children.
 *
 * `clipDepth` (`IMPL-030` §7, `GFX-R046`) is applied as a *clip range*: a placement with
 * `clipDepth = c` masks every entry with a depth in `(depth, c]`, which is the semantics the chapter
 * states. The mask itself is not drawn. The clip is the masker's transformed bounds rectangle —
 * enough for the static gate and for fixtures whose masks are rectangles, with the stencil upgrade
 * tracked by `T-GFX-015` (`WP-130-11`); a bounds clip is deliberately conservative about what it
 * hides, never about what it shows.
 */
export function collectDrawItems(
  entries: readonly DisplayEntry[],
  resolve: CharacterResolver,
  options: FlattenSceneOptions = {},
): DrawItem[] {
  const parent = options.transform ?? IDENTITY;
  const maxDepth = options.maxDepth ?? 32;
  const items: DrawItem[] = [];
  // Masks are expressed as depth ranges over the *sorted* list, so one linear scan suffices.
  let maskClip: ClipRect | null = null;
  let maskEndDepth: number | null = null;

  for (const entry of entries) {
    if (maskEndDepth !== null && entry.depth > maskEndDepth) {
      maskClip = null;
      maskEndDepth = null;
    }
    if (!entry.visible || entry.characterId === null) continue;
    const resolved = resolve(entry.characterId);
    if (!resolved) continue;
    const matrix = multiply(parent, entry.matrix);
    const cxform = entry.cxform ?? options.cxform ?? null;
    const baseClip = options.clip ?? null;
    const clip = maskClip ? intersectClip(baseClip, maskClip) : baseClip;

    if (entry.clipDepth !== null) {
      // The masker defines the clip for the following range; it is not rendered itself.
      maskClip = resolved.geometry ? shapeClip(resolved.geometry, matrix) : null;
      maskEndDepth = entry.clipDepth;
    }

    if (resolved.geometry) {
      items.push({ shape: resolved.geometry, matrix, cxform, clip, depth: entry.depth });
    }
    if (resolved.timeline && maxDepth > 0) {
      items.push(
        ...collectDrawItems(resolved.timeline, resolve, {
          transform: matrix,
          cxform,
          clip,
          maxDepth: maxDepth - 1,
        }),
      );
    }
  }

  return items;
}

/** Clips a shape to a rectangle (`clipDepth` masks; the bounds-rect approximation of `GFX-R046`). */
export function shapeClip(shape: ShapeGeometry, matrix: Transform2D): ClipRect {
  let bounds: { x0: number; y0: number; x1: number; y1: number } | null = null;
  const consider = (points: readonly Pt[]): void => {
    const b = pointBounds(points.map((p) => transformPoint(matrix, p)));
    if (!b) return;
    bounds = bounds
      ? {
          x0: Math.min(bounds.x0, b.x0),
          y0: Math.min(bounds.y0, b.y0),
          x1: Math.max(bounds.x1, b.x1),
          y1: Math.max(bounds.y1, b.y1),
        }
      : b;
  };
  for (const fill of shape.fills) {
    for (const path of fill.paths) consider(path.edges.map((edge) => edge.from));
  }
  for (const stroke of shape.strokes) {
    for (const path of stroke.paths) consider(path.edges.map((edge) => edge.from));
  }
  return bounds ?? { x0: 0, y0: 0, x1: 0, y1: 0 };
}

/** Intersection of two clip rectangles; `null` means "no clip". */
export function intersectClip(a: ClipRect | null, b: ClipRect): ClipRect {
  if (!a) return b;
  return {
    x0: Math.max(a.x0, b.x0),
    y0: Math.max(a.y0, b.y0),
    x1: Math.min(a.x1, b.x1),
    y1: Math.min(a.y1, b.y1),
  };
}
