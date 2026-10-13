/** Shared static-shape preparation at both build-time geometry consumers (`IMPL-060-R034`). */

import { quantiseShape, simplifyShape } from '@swf-forge/swf';
import type { SimplifyStats, VectorShape } from '@swf-forge/swf';

export interface PreparedStaticShape {
  readonly shape: VectorShape;
  readonly simplifyStats: SimplifyStats;
}

/**
 * Prepare decoded static geometry for flattening/tessellation in the mandated order:
 * one-twip quantisation, then the four deterministic simplification steps. This helper is shared by
 * the shape-preview rasterizer and the SWF-to-GFX adapter so their geometry cannot drift.
 *
 * Morph interpolation is deliberately a different boundary: rational half-twips must remain intact
 * until the morph-specific ties-to-even tessellation step (`IMPL-070-R030`).
 */
export function prepareStaticShape(shape: VectorShape): PreparedStaticShape {
  if (shape.quarantined === true) throw new Error(`shape ${shape.id} is quarantined and has no renderable geometry`);
  const quantised = quantiseShape(shape);
  const simplified = simplifyShape(quantised);
  return { shape: simplified.shape, simplifyStats: simplified.stats };
}
