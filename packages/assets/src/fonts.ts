/** Deterministic SWF quadratic glyph IR → TrueType outlines → WOFF2. */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import opentype from 'opentype.js';
import { deriveFontMetrics } from '@swf-forge/swf';
import type { DefineFontModel, FontGlyphModel, VectorShape } from '@swf-forge/swf';

export interface FontWoff2Result {
  readonly bytes: Uint8Array;
  readonly familyName: string;
  readonly glyphCount: number;
  readonly unitsPerEm: number;
}

function safeName(name: string, fallback: string): string {
  const compact = name.replace(/[\u0000-\u001f\u007f]/g, '').trim();
  return compact.length > 0 ? compact : fallback;
}

function appendShape(path: opentype.Path, shape: VectorShape | null): void {
  if (shape === null) return;
  for (const contour of shape.paths) {
    const first = shape.edges[contour.edgeRefs[0] ?? -1];
    if (first === undefined) continue;
    path.moveTo(first.fromX, -first.fromY);
    for (const edgeIndex of contour.edgeRefs) {
      const edge = shape.edges[edgeIndex];
      if (edge === undefined) continue;
      if (edge.controlX !== undefined && edge.controlY !== undefined) {
        path.quadraticCurveTo(edge.controlX, -edge.controlY, edge.toX, -edge.toY);
      } else {
        path.lineTo(edge.toX, -edge.toY);
      }
    }
    // The SWF fill model applies implicit close; TrueType contours are always closed.
    path.closePath();
  }
}

/**
 * OpenType ascender/descender from the one derivation in `@swf-forge/swf`.
 *
 * `IMPL-080-R007` requires layout and the atlas to be fed the *same* numbers, so this must not be a
 * second implementation — it is a sign convention adapter. SWF reports descent as a positive
 * magnitude below the baseline; OpenType's `descender` is negative.
 */
function openTypeMetrics(font: DefineFontModel): { ascender: number; descender: number } {
  const metrics = deriveFontMetrics(font);
  return { ascender: metrics.ascent, descender: -metrics.descent };
}

function fallbackAdvance(glyph: FontGlyphModel): number {
  const bounds = glyph.bounds ?? glyph.shape?.recomputedBounds ?? glyph.shape?.bounds;
  return bounds ? Math.max(0, bounds.xMax - bounds.xMin) : 0;
}

function checksum(bytes: Uint8Array, start = 0, length = bytes.length - start): number {
  let sum = 0;
  for (let offset = 0; offset < length; offset += 4) {
    const word =
      ((bytes[start + offset] ?? 0) << 24) |
      ((bytes[start + offset + 1] ?? 0) << 16) |
      ((bytes[start + offset + 2] ?? 0) << 8) |
      (bytes[start + offset + 3] ?? 0);
    sum = (sum + (word >>> 0)) >>> 0;
  }
  return sum;
}

function u16be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function u32be(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function putU32be(bytes: Uint8Array, offset: number, value: number): void {
  bytes[offset] = (value >>> 24) & 0xff;
  bytes[offset + 1] = (value >>> 16) & 0xff;
  bytes[offset + 2] = (value >>> 8) & 0xff;
  bytes[offset + 3] = value & 0xff;
}

/** Zero both OpenType head timestamps, then restore the sfnt head/table/file checksums. */
function normalizeSfntTimestamps(bytes: Uint8Array): void {
  const tableCount = u16be(bytes, 4);
  let headRecord = -1;
  let headOffset = -1;
  let headLength = 0;
  for (let index = 0; index < tableCount; index += 1) {
    const record = 12 + index * 16;
    if (String.fromCharCode(...bytes.subarray(record, record + 4)) !== 'head') continue;
    headRecord = record;
    headOffset = u32be(bytes, record + 8);
    headLength = u32be(bytes, record + 12);
    break;
  }
  if (headRecord < 0 || headOffset < 0 || headOffset + headLength > bytes.length || headLength < 36) {
    throw new Error('OpenType writer returned an invalid sfnt head table');
  }
  bytes.fill(0, headOffset + 20, headOffset + 36); // created + modified LONGDATETIME
  putU32be(bytes, headOffset + 8, 0); // head table checksum excludes checkSumAdjustment
  putU32be(bytes, headRecord + 4, checksum(bytes, headOffset, headLength));
  putU32be(bytes, headOffset + 8, (0xb1b0afba - checksum(bytes)) >>> 0);
}

function makeTrueType(fontModel: DefineFontModel): Uint8Array {
  const metrics = openTypeMetrics(fontModel);
  const fallbackFamily = `SWFFont${fontModel.id}`;
  const familyName = safeName(fontModel.name, fallbackFamily);
  const seenCodes = new Set<number>();
  const glyphs: opentype.Glyph[] = [];
  const sourceGlyphs = [...fontModel.glyphs];
  if (sourceGlyphs.length === 0) {
    glyphs.push(new opentype.Glyph({ name: '.notdef', advanceWidth: fontModel.unitsPerEm, path: new opentype.Path() }));
  } else {
    for (const source of sourceGlyphs) {
      const path = new opentype.Path();
      // A glyph quarantined by `IMPL-080-R009` (`SF0281`) keeps its index, its advance and its
      // cmap entry — removing it would renumber every later glyph and break the positional indices
      // that `DefineText` records reference — but contributes no outline. That is what the
      // quarantine buys: the defect cannot reach the emitted font, and the text still advances.
      if (source.shape !== null && !source.quarantined) appendShape(path, source.shape);
      const code = source.code;
      const unicode =
        code !== null && code >= 0 && code <= 0xffff && !(code >= 0xd800 && code <= 0xdfff) ? code : undefined;
      const mapped = unicode !== undefined && !seenCodes.has(unicode);
      if (mapped && unicode !== undefined) seenCodes.add(unicode);
      const options: opentype.GlyphOptions = {
        index: source.index,
        name: source.index === 0 ? '.notdef' : `glyph${source.index}`,
        advanceWidth: source.advance ?? fallbackAdvance(source),
        path,
        ...(mapped && unicode !== undefined ? { unicode } : {}),
      };
      glyphs.push(new opentype.Glyph(options));
    }
  }
  const font = new opentype.Font({
    familyName,
    styleName: fontModel.bold ? 'Bold' : fontModel.italic ? 'Italic' : 'Regular',
    fullName: safeName(
      `${familyName} ${fontModel.bold ? 'Bold' : fontModel.italic ? 'Italic' : 'Regular'}`,
      familyName,
    ),
    postScriptName: safeName(
      `${familyName}-${fontModel.bold ? 'Bold' : fontModel.italic ? 'Italic' : 'Regular'}`.replace(
        /[^A-Za-z0-9-]/g,
        '',
      ),
      `SWFFont${fontModel.id}`,
    ),
    unitsPerEm: fontModel.unitsPerEm,
    ascender: metrics.ascender,
    descender: metrics.descender,
    createdTimestamp: 0,
    glyphs,
  });
  font.createdTimestamp = 0;
  const bytes = new Uint8Array(font.toArrayBuffer());
  normalizeSfntTimestamps(bytes);
  return bytes;
}

function compressWoff2(ttf: Uint8Array): Uint8Array {
  const require = createRequire(import.meta.url);
  const packageEntry = require.resolve('wawoff2');
  const directory = mkdtempSync(join(tmpdir(), 'swf-forge-font-'));
  const input = join(directory, 'font.ttf');
  try {
    writeFileSync(input, ttf);
    const executable = join(dirname(packageEntry), 'bin', 'woff2_compress.js');
    const result = spawnSync(process.execPath, [executable, input, '-'], {
      timeout: 120_000,
      maxBuffer: 64 * 1024 * 1024,
    });
    const output = result.stdout;
    if (result.error) throw result.error;
    if (result.status !== 0 || !output || output.byteLength < 4 || output.toString('ascii', 0, 4) !== 'wOF2') {
      const detail =
        result.stderr?.toString('utf8').trim() || output?.toString('utf8').trim() || 'unknown WOFF2 conversion failure';
      throw new Error(detail);
    }
    return new Uint8Array(output);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

/** Build one deterministic WOFF2 asset; SWF font coordinates are kept in their declared em square. */
export function encodeFontWoff2(font: DefineFontModel): FontWoff2Result {
  const ttf = makeTrueType(font);
  const bytes = compressWoff2(ttf);
  return {
    bytes,
    familyName: safeName(font.name, `SWFFont${font.id}`),
    glyphCount: font.glyphs.length,
    unitsPerEm: font.unitsPerEm,
  };
}
