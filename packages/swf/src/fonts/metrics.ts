/**
 * Font code maps, EM normalisation and derived metrics (`IMPL-080` §3–§5, WP-080-02/03/06).
 *
 * Three things live here because all three are shared by consumers that must not disagree:
 *
 *   - `codeToGlyph` is the lookup `IMPL-080-R010` asks for — a **sorted copy**, leaving the font's
 *     raw glyph order alone for the `inspect --fonts` dump.
 *   - `normaliseFontUnits` puts `DefineFont2` (1024/em) and `DefineFont3` (20480/em) on one scale so
 *     the same typeface exported twice can be compared (`T-MOD-501`).
 *   - `deriveFontMetrics` is the single derivation `IMPL-080-R007` requires: layout and the atlas
 *     must be fed the *same* numbers, so there can only be one function that computes them.
 */

import { roundTiesToEven } from '../shapes/morph-ir.js';
import type { Rect } from '../io/types.js';
import type { Edge, VectorShape } from '../tags/shape.js';
import type { DefineFontModel, FontGlyphModel } from '../tags/fonts.js';

/**
 * Character code → glyph, built from a **sorted copy** of the code table.
 *
 * `IMPL-080-R010` requires the code table to be ascending and positionally aligned with the glyph
 * table. Out-of-order tables occur in real files and are reported as `SF0276`; the response is to
 * sort for lookup and leave the authored order intact, because the glyph *indices* that static text
 * records reference are positional and renumbering them would corrupt every `DefineText`.
 *
 * Duplicate codes keep the **lowest glyph index**, matching the order a sorted-ascending scan would
 * encounter them, so the map is a pure function of the font rather than of iteration order.
 */
export function codeToGlyph(font: DefineFontModel): ReadonlyMap<number, FontGlyphModel> {
  const sorted = [...font.glyphs]
    .filter((glyph) => glyph.code !== null)
    .sort((a, b) => (a.code as number) - (b.code as number) || a.index - b.index);
  const map = new Map<number, FontGlyphModel>();
  for (const glyph of sorted) {
    if (!map.has(glyph.code as number)) map.set(glyph.code as number, glyph);
  }
  return map;
}

/** Codes that appear more than once in the table, ascending. Lookup keeps the lowest glyph index. */
export function duplicateCodes(font: DefineFontModel): readonly number[] {
  const seen = new Set<number>();
  const duplicates = new Set<number>();
  for (const glyph of font.glyphs) {
    if (glyph.code === null) continue;
    if (seen.has(glyph.code)) duplicates.add(glyph.code);
    seen.add(glyph.code);
  }
  return [...duplicates].sort((a, b) => a - b);
}

function scaleRect(rect: Rect, factor: number): Rect {
  return {
    xMin: roundTiesToEven(rect.xMin * factor),
    xMax: roundTiesToEven(rect.xMax * factor),
    yMin: roundTiesToEven(rect.yMin * factor),
    yMax: roundTiesToEven(rect.yMax * factor),
  };
}

function scaleEdge(edge: Edge, factor: number): Edge {
  const scaled: Edge = {
    fromX: roundTiesToEven(edge.fromX * factor),
    fromY: roundTiesToEven(edge.fromY * factor),
    toX: roundTiesToEven(edge.toX * factor),
    toY: roundTiesToEven(edge.toY * factor),
  };
  if (edge.controlX === undefined || edge.controlY === undefined) return scaled;
  return {
    ...scaled,
    controlX: roundTiesToEven(edge.controlX * factor),
    controlY: roundTiesToEven(edge.controlY * factor),
  };
}

function scaleShape(shape: VectorShape, factor: number): VectorShape {
  return {
    ...shape,
    bounds: scaleRect(shape.bounds, factor),
    edgeBounds: shape.edgeBounds === null ? null : scaleRect(shape.edgeBounds, factor),
    recomputedBounds: shape.recomputedBounds === null ? null : scaleRect(shape.recomputedBounds, factor),
    edges: shape.edges.map((edge) => scaleEdge(edge, factor)),
  };
}

/**
 * Rescale a font's glyph geometry and metrics to `targetUnitsPerEm`.
 *
 * `DefineFont3` is `DefineFont2` with every glyph coordinate multiplied by 20 (`IMPL-080` §4), so
 * the two tags describe the same typeface at different resolutions. Comparing them — or feeding
 * both to one atlas — requires putting them on a common EM first; comparing raw coordinates would
 * report every glyph as different.
 *
 * Scaling **up** is lossless; scaling 20480 → 1024 divides by 20 and is not, which is the point of
 * doing it deliberately in one place with one tie-break rather than wherever a consumer happens to
 * need it. Kerning adjustments and advances are in the same units as the outlines and scale with
 * them; `languageCode`, flags and codes do not.
 */
export function normaliseFontUnits(font: DefineFontModel, targetUnitsPerEm: number): DefineFontModel {
  if (!Number.isFinite(targetUnitsPerEm) || targetUnitsPerEm <= 0) {
    throw new RangeError(`targetUnitsPerEm must be a positive number, received ${targetUnitsPerEm}`);
  }
  if (targetUnitsPerEm === font.unitsPerEm) return font;
  const factor = targetUnitsPerEm / font.unitsPerEm;
  const scaleOrNull = (value: number | null): number | null =>
    value === null ? null : roundTiesToEven(value * factor);
  return {
    ...font,
    // `unitsPerEm` is typed to the two values the tags can produce; a normalised font keeps the
    // field honest by reporting the EM it is actually expressed in.
    unitsPerEm: targetUnitsPerEm as DefineFontModel['unitsPerEm'],
    glyphs: font.glyphs.map((glyph) => ({
      ...glyph,
      shape: glyph.shape === null ? null : scaleShape(glyph.shape, factor),
      advance: scaleOrNull(glyph.advance),
      bounds: glyph.bounds === null ? null : scaleRect(glyph.bounds, factor),
    })),
    ascent: scaleOrNull(font.ascent),
    descent: scaleOrNull(font.descent),
    leading: scaleOrNull(font.leading),
    kerning: font.kerning.map((pair) => ({ ...pair, adjustment: roundTiesToEven(pair.adjustment * factor) })),
  };
}

export interface DerivedFontMetrics {
  readonly ascent: number;
  readonly descent: number;
  readonly leading: number;
  /** `false` when the font authored a `FontLayoutTable` and these are its numbers, not ours. */
  readonly derived: boolean;
}

/**
 * The one metrics derivation (`IMPL-080-R007`).
 *
 * `DefineFont` v1 carries no metrics at all and a `DefineFont2`/`3` without `HasLayout` carries
 * none either. Both cases have to fall back to glyph bounds, and the rule is explicit that layout
 * and the atlas must receive the *same* numbers — two independent fallbacks that round differently
 * put the measured text box and the rasterised glyphs out of step, which looks like a kerning bug
 * and is not one.
 *
 * SWF glyph space is y-down with the baseline at y = 0, so a glyph above the baseline has negative
 * `yMin`: ascent is `max(-yMin)` and descent is `max(yMax)`, both reported as positive magnitudes
 * to match `FontAscent`/`FontDescent`'s `UI16` encoding. Leading has no bounds-based estimate and
 * is 0 when underived — guessing it would silently change every multi-line layout.
 */
export function deriveFontMetrics(font: DefineFontModel): DerivedFontMetrics {
  if (font.ascent !== null && font.descent !== null) {
    return { ascent: font.ascent, descent: font.descent, leading: font.leading ?? 0, derived: false };
  }
  let ascent = 0;
  let descent = 0;
  for (const glyph of font.glyphs) {
    const bounds = glyph.bounds ?? glyph.shape?.recomputedBounds ?? glyph.shape?.bounds ?? null;
    if (bounds === null) continue;
    ascent = Math.max(ascent, -bounds.yMin);
    descent = Math.max(descent, bounds.yMax);
  }
  return { ascent, descent, leading: font.leading ?? 0, derived: true };
}
