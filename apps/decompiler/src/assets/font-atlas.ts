/** Deterministic monochrome glyph-atlas build output for supported embedded font outlines. */

import { createHash } from 'node:crypto';

import { encodeBitmapPng } from '@swf-forge/assets';
import type { DefineFontModel, Rect, VectorShape } from '@swf-forge/swf';

import { renderShapePreview } from './shape-preview.js';

const GUTTER = 2;
const MAX_PAGE = 2048;

export interface FontAtlasPage {
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly sha256: string;
}

export interface FontAtlasGlyph {
  readonly index: number;
  readonly code: number;
  readonly advance: number | null;
  readonly boundsEm1024: Rect | null;
  readonly page: number | null;
  readonly rect: { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null;
}

export interface FontAtlasBuild {
  readonly manifestPath: string;
  readonly manifestBytes: Uint8Array;
  readonly manifestSha256: string;
  readonly pageSize: number;
  readonly pages: readonly FontAtlasPage[];
  readonly glyphs: readonly FontAtlasGlyph[];
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function scaleRect(rect: Rect, factor: number): Rect {
  return {
    xMin: Math.round(rect.xMin * factor),
    xMax: Math.round(rect.xMax * factor),
    yMin: Math.round(rect.yMin * factor),
    yMax: Math.round(rect.yMax * factor),
  };
}

function normalizedShape(shape: VectorShape, factor: number): VectorShape {
  const sourceBounds = shape.recomputedBounds ?? shape.bounds;
  const bounds = scaleRect(sourceBounds, factor);
  return {
    ...shape,
    bounds,
    recomputedBounds: bounds,
    edges: shape.edges.map((edge) => ({
      fromX: Math.round(edge.fromX * factor),
      fromY: Math.round(edge.fromY * factor),
      toX: Math.round(edge.toX * factor),
      toY: Math.round(edge.toY * factor),
      ...(edge.controlX !== undefined ? { controlX: Math.round(edge.controlX * factor) } : {}),
      ...(edge.controlY !== undefined ? { controlY: Math.round(edge.controlY * factor) } : {}),
    })),
  };
}

function nextPowerOfTwo(value: number): number {
  let size = 1;
  while (size < value && size < MAX_PAGE) size <<= 1;
  return Math.min(size, MAX_PAGE);
}

/** Render all embedded outline glyphs to fixed 1024-em previews and pack with two-pixel edge bleed. */
export function buildFontAtlas(font: DefineFontModel): FontAtlasBuild {
  const factor = 1024 / font.unitsPerEm;
  const sourceGlyphs = [...font.glyphs].sort((left, right) => left.index - right.index);
  const renderable = sourceGlyphs.flatMap((glyph) => {
    const shape = glyph.shape;
    if (shape === null || shape.edges.length === 0 || shape.paths.length === 0) return [];
    const preview = renderShapePreview(normalizedShape(shape, factor));
    if (
      preview.width <= 0 ||
      preview.height <= 0 ||
      preview.width + 2 * GUTTER > MAX_PAGE ||
      preview.height + 2 * GUTTER > MAX_PAGE
    ) {
      return [];
    }
    return [{ glyph, preview, bounds: scaleRect(shape.recomputedBounds ?? shape.bounds, factor) }];
  });
  const estimatedSide = Math.max(512, Math.ceil(Math.sqrt(Math.max(1, renderable.length)) * 56));
  const pageSize = nextPowerOfTwo(Math.min(MAX_PAGE, estimatedSide));
  // Glyphs without a mapped character code (v1 fonts with no FontInfo, or malformed files) still
  // get an atlas slot under a synthetic private-use code so they render if the title indexes them
  // directly; downstream consumers treat `code > 0xffff` as "unmapped" and never expose it as text.
  const glyphs: FontAtlasGlyph[] = sourceGlyphs.map((glyph, position) => ({
    index: glyph.index,
    code: glyph.code ?? 0xf0000 + position,
    advance: glyph.advance,
    boundsEm1024:
      glyph.shape === null ? glyph.bounds : scaleRect(glyph.shape.recomputedBounds ?? glyph.shape.bounds, factor),
    page: null,
    rect: null,
  }));
  const pageAssignments = new Map<number, FontAtlasGlyph>();
  const pages: FontAtlasPage[] = [];
  let pageIndex = 0;
  let page = new Uint8Array(pageSize * pageSize * 4);
  let cursorX = GUTTER;
  let cursorY = GUTTER;
  let rowHeight = 0;

  const flushPage = (): void => {
    if (pageAssignments.size === 0) return;
    const path = `font-${font.id}-atlas-${pageIndex}.png`;
    const bytes = encodeBitmapPng({ width: pageSize, height: pageSize, pixels: page });
    pages.push({ path, bytes, sha256: digest(bytes) });
    pageIndex += 1;
    page = new Uint8Array(pageSize * pageSize * 4);
    pageAssignments.clear();
    cursorX = GUTTER;
    cursorY = GUTTER;
    rowHeight = 0;
  };

  for (const item of renderable) {
    const width = item.preview.width;
    const height = item.preview.height;
    if (cursorX + width + GUTTER > pageSize) {
      cursorX = GUTTER;
      cursorY += rowHeight;
      rowHeight = 0;
    }
    if (cursorY + height + GUTTER > pageSize) {
      flushPage();
    }
    const x = cursorX;
    const y = cursorY;
    const pixels = item.preview.image.data;
    for (let py = -GUTTER; py < height + GUTTER; py += 1) {
      const sourceY = Math.max(0, Math.min(height - 1, py));
      for (let px = -GUTTER; px < width + GUTTER; px += 1) {
        const sourceX = Math.max(0, Math.min(width - 1, px));
        const source = (sourceY * width + sourceX) * 4;
        const target = ((y + py) * pageSize + (x + px)) * 4;
        page[target] = pixels[source] ?? 0;
        page[target + 1] = pixels[source + 1] ?? 0;
        page[target + 2] = pixels[source + 2] ?? 0;
        page[target + 3] = pixels[source + 3] ?? 0;
      }
    }
    const syntheticCode = 0xf0000 + sourceGlyphs.findIndex((g) => g.index === item.glyph.index);
    const assignment: FontAtlasGlyph = {
      index: item.glyph.index,
      code: item.glyph.code ?? syntheticCode,
      advance: item.glyph.advance,
      boundsEm1024: item.bounds,
      page: pageIndex,
      rect: { x, y, width, height },
    };
    const glyphPosition = glyphs.findIndex((glyph) => glyph.index === item.glyph.index);
    if (glyphPosition >= 0) glyphs[glyphPosition] = assignment;
    pageAssignments.set(item.glyph.index, assignment);
    cursorX += width + 2 * GUTTER;
    rowHeight = Math.max(rowHeight, height + 2 * GUTTER);
  }
  flushPage();

  const manifestPath = `font-${font.id}-atlas.json`;
  const manifest = {
    format: 'swf-forge/font-atlas',
    formatVersion: 1,
    fontId: font.id,
    unitsPerEm: font.unitsPerEm,
    canonicalUnitsPerEm: 1024,
    pageSize,
    gutter: GUTTER,
    pages: pages.map(({ path, sha256 }) => ({ path, sha256, width: pageSize, height: pageSize })),
    glyphs,
  };
  const manifestBytes = new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
  return {
    manifestPath,
    manifestBytes,
    manifestSha256: digest(manifestBytes),
    pageSize,
    pages,
    glyphs,
  };
}
