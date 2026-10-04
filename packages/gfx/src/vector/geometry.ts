/**
 * Vector IR as the renderer sees it — `GFX` §5.1. Curves are *not* flattened here: a shape arrives
 * with quadratics intact so flattening happens at draw time against the accumulated device scale
 * (`GFX-R022`), and one geometry cache entry can serve every instance of a character.
 *
 * This package MUST NOT import `@swf-forge/swf` (`IMPL-130-R001`): the compiler/emitter converts the
 * decoded model into these structures, and the boundary is lint-enforced.
 */

export interface Pt {
  readonly x: number;
  readonly y: number;
}

/** Straight edge; `to` is the next edge's `from`. */
export interface LinearEdge {
  readonly kind: 'line';
  readonly from: Pt;
  readonly to: Pt;
}

/** Quadratic edge in the SWF sense (`GFX` §5.1): control point then anchor. */
export interface QuadraticEdge {
  readonly kind: 'quad';
  readonly from: Pt;
  readonly control: Pt;
  readonly to: Pt;
}

export type Edge = LinearEdge | QuadraticEdge;

/** One drawing run: a sequence of edges, closed or not (`GFX-R018` closes fills implicitly). */
export interface DrawPath {
  readonly edges: readonly Edge[];
  readonly closed: boolean;
}

export type FillRule = 'evenOdd' | 'nonZero';

/** Solid paint. Gradient/bitmap paints arrive with their own work packages (`GFX` §6.3/§6.4). */
export interface SolidPaint {
  readonly kind: 'solid';
  /** 0..255 per channel. */
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export type Paint = SolidPaint;

export interface FillGeometry {
  readonly rule: FillRule;
  readonly paths: readonly DrawPath[];
  readonly paint: Paint;
}

export type Cap = 'round' | 'butt' | 'square';
export type Join = 'round' | 'bevel' | 'miter';

export interface StrokeGeometry {
  readonly paths: readonly DrawPath[];
  /** In the geometry's own units (twips for decoded shapes); 0 = hairline (`GFX-R030`). */
  readonly width: number;
  readonly startCap: Cap;
  readonly endCap: Cap;
  readonly join: Join;
  /** `miterLimit` as a plain ratio (FIXED8 already divided by 256). */
  readonly miterLimit: number;
  readonly paint: Paint;
  /** `true` for `LINESTYLE2.NoClose` / `NoHScale`+`NoVScale` handling (`GFX-R031`). */
  readonly noClose: boolean;
}

export interface ShapeGeometry {
  /** Stable id for cache keys: the character id, or a drawing-API program hash (`GFX-R028`). */
  readonly id: string;
  readonly fills: readonly FillGeometry[];
  readonly strokes: readonly StrokeGeometry[];
}
