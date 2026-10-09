/** DefineMorphShape/2 endpoint parsing and edge correspondence (IMPL-070 P3 decode slice). */

import { Codes } from '../diagnostics/codes.js';
import { readMatrix, readRect } from '../io/records.js';
import { readRgba } from '../io/colour.js';
import type { Cursor } from '../io/cursor.js';
import type { Mat2D, Rect, Rgba } from '../io/types.js';
import {
  readLineStyle2Header,
  readShapeWithStyle,
  type Edge,
  type FillStyle,
  type Gradient,
  type LineStyle,
  type VectorShape,
} from './shape.js';
import { Tag } from './tag-codes.js';

export interface MorphEdgePair {
  readonly index: number;
  /** Original endpoint geometry, kept losslessly for the exact ratio-0/ratio-65535 states. */
  readonly start: Edge;
  readonly end: Edge;
  /** Straight edges are promoted to quadratic curves here when paired with a curve. */
  readonly morphStart: Edge;
  readonly morphEnd: Edge;
}

export interface MorphShapeModel {
  readonly id: number;
  readonly version: 1 | 2;
  readonly startBounds: Rect;
  readonly endBounds: Rect;
  readonly startEdgeBounds: Rect | null;
  readonly endEdgeBounds: Rect | null;
  readonly start: VectorShape;
  readonly end: VectorShape;
  readonly edgeCounts: { readonly start: number; readonly end: number };
  readonly pairs: readonly MorphEdgePair[];
  readonly correspondence: 'index';
  readonly flags: { readonly nonScalingStrokes: boolean; readonly scalingStrokes: boolean };
  readonly offset: number;
  readonly offsetMatches: boolean;
}

interface MorphFillPair {
  readonly start: FillStyle | null;
  readonly end: FillStyle | null;
}

interface MorphLinePair {
  readonly start: LineStyle | null;
  readonly end: LineStyle | null;
}

function styleCount(c: Cursor): number {
  const count = c.u8();
  return count === 0xff ? c.u16() : count;
}

function solid(color: Rgba): FillStyle {
  return { kind: 'solid', color };
}

/**
 * `MORPHGRADIENT` — **one** header byte, laid out exactly like `GRADIENT`'s
 * (`SpreadMode UB[2]`, `InterpolationMode UB[2]`, `NumGradients UB[4]`), then `NumGradients`
 * interleaved `(StartRatio, StartColor, EndRatio, EndColor)` records.
 *
 * `IMPL-070-R025` described a separate `UI8` count *in addition to* R028's flags byte, which would
 * put the control-point count in the stream twice and shift every morph gradient by one byte. It
 * cannot be right, and an earlier implementation followed it literally. Corrected in errata
 * `E-028`; the two readings are byte-identical whenever spread and interpolation are 0, which is
 * why the defect survived — it only bites on SWF 8 content that sets either mode.
 */
function morphGradient(c: Cursor, focal: boolean): { readonly start: Gradient; readonly end: Gradient } {
  const spreadMode = c.ub(2);
  const interpolationMode = c.ub(2);
  const count = c.ub(4);
  if (spreadMode === 3 || interpolationMode >= 2) {
    c.emit(
      Codes.SHAPE_GRADIENT_MODE_INVALID,
      'warning',
      `reserved morph gradient mode (spread ${spreadMode}, interpolation ${interpolationMode}); value honoured`,
    );
  }
  if (count === 0) {
    c.emit(Codes.SHAPE_GRADIENT_EMPTY, 'error', 'morph MORPHGRADIENT has no control points; the fill is dropped');
  }
  const startStops: { ratio: number; color: Rgba }[] = [];
  const endStops: { ratio: number; color: Rgba }[] = [];
  for (let index = 0; index < count; index += 1) {
    startStops.push({ ratio: c.u8(), color: readRgba(c) });
    endStops.push({ ratio: c.u8(), color: readRgba(c) });
  }
  const startFocal = focal ? c.fixed8() : undefined;
  const endFocal = focal ? c.fixed8() : undefined;
  const start: Gradient = {
    spreadMode,
    interpolationMode,
    stops: startStops,
    ...(startFocal !== undefined ? { focalPoint: startFocal } : {}),
  };
  const end: Gradient = {
    spreadMode,
    interpolationMode,
    stops: endStops,
    ...(endFocal !== undefined ? { focalPoint: endFocal } : {}),
  };
  return { start, end };
}

function morphFill(c: Cursor): MorphFillPair {
  const type = c.u8();
  switch (type) {
    case 0x00:
      return { start: solid(readRgba(c)), end: solid(readRgba(c)) };
    case 0x10:
    case 0x12:
    case 0x13: {
      const startMatrix: Mat2D = readMatrix(c);
      const endMatrix: Mat2D = readMatrix(c);
      const gradients = morphGradient(c, type === 0x13);
      return {
        start: { kind: 'gradient', linear: type === 0x10, matrix: startMatrix, gradient: gradients.start },
        end: { kind: 'gradient', linear: type === 0x10, matrix: endMatrix, gradient: gradients.end },
      };
    }
    case 0x40:
    case 0x41:
    case 0x42:
    case 0x43: {
      const bitmapId = c.u16();
      const startMatrix = readMatrix(c);
      const endMatrix = readMatrix(c);
      const repeat = type === 0x40 || type === 0x42;
      const smoothed = type === 0x40 || type === 0x41;
      return {
        start: { kind: 'bitmap', bitmapId, matrix: startMatrix, repeat, smoothed },
        end: { kind: 'bitmap', bitmapId, matrix: endMatrix, repeat, smoothed },
      };
    }
    default:
      c.emit(
        Codes.SHAPE_FILL_TYPE_UNKNOWN,
        'error',
        `unknown MORPHFILLSTYLE type 0x${type.toString(16)}; morph shape quarantined`,
      );
      c.seek(c.limit);
      return { start: null, end: null };
  }
}

function morphFillArrays(c: Cursor): { start: (FillStyle | null)[]; end: (FillStyle | null)[] } {
  const count = styleCount(c);
  const start: (FillStyle | null)[] = [null];
  const end: (FillStyle | null)[] = [null];
  for (let index = 0; index < count; index += 1) {
    const pair = morphFill(c);
    start.push(pair.start);
    end.push(pair.end);
    if (c.offset >= c.limit) break;
  }
  return { start, end };
}

function readMorphLineStyle(c: Cursor, version: 1 | 2): MorphLinePair {
  const startWidth = c.u16();
  const endWidth = c.u16();
  if (version === 1) {
    return {
      start: { width: startWidth, color: readRgba(c) },
      end: { width: endWidth, color: readRgba(c) },
    };
  }
  const header = readLineStyle2Header(c);
  const fills = header.hasFill ? morphFill(c) : null;
  const startFill = fills?.start;
  const endFill = fills?.end;
  const startColor = header.hasFill ? { r: 0, g: 0, b: 0, a: 255 } : readRgba(c);
  const endColor = header.hasFill ? { r: 0, g: 0, b: 0, a: 255 } : readRgba(c);
  const common = {
    caps: header.caps,
    join: header.join,
    ...(header.miterLimit !== undefined ? { miterLimit: header.miterLimit } : {}),
    noHScale: header.noHScale,
    noVScale: header.noVScale,
    pixelHinting: header.pixelHinting,
    noClose: header.noClose,
  };
  return {
    start: {
      width: startWidth,
      color: startColor,
      ...common,
      ...(startFill !== undefined && startFill !== null ? { fill: startFill } : {}),
    },
    end: {
      width: endWidth,
      color: endColor,
      ...common,
      ...(endFill !== undefined && endFill !== null ? { fill: endFill } : {}),
    },
  };
}

function morphLineArrays(c: Cursor, version: 1 | 2): { start: (LineStyle | null)[]; end: (LineStyle | null)[] } {
  const count = styleCount(c);
  const start: (LineStyle | null)[] = [null];
  const end: (LineStyle | null)[] = [null];
  for (let index = 0; index < count; index += 1) {
    const pair = readMorphLineStyle(c, version);
    start.push(pair.start);
    end.push(pair.end);
  }
  return { start, end };
}

function padEdges(shape: VectorShape, targetCount: number): VectorShape {
  if (shape.edges.length >= targetCount) return shape;
  const edges = [...shape.edges];
  const last = edges[edges.length - 1];
  const x = last?.toX ?? 0;
  const y = last?.toY ?? 0;
  while (edges.length < targetCount) edges.push({ fromX: x, fromY: y, toX: x, toY: y });
  return { ...shape, edges };
}

function compatibleStyles(
  start: readonly (FillStyle | null)[],
  end: readonly (FillStyle | null)[],
  c: Cursor,
  id: number,
): void {
  const count = Math.max(start.length, end.length);
  for (let index = 1; index < count; index += 1) {
    const a = start[index];
    const b = end[index];
    if (a?.kind !== b?.kind) {
      c.emit(
        Codes.MORPH_STYLE_RESTRICTION,
        'warning',
        `morph ${id} fill style ${index} changes fill kind between endpoints`,
      );
      continue;
    }
    if (a?.kind === 'bitmap' && b?.kind === 'bitmap' && a.bitmapId !== b.bitmapId) {
      c.emit(Codes.MORPH_STYLE_RESTRICTION, 'warning', `morph ${id} bitmap fill ${index} changes character id`);
    }
    if (a?.kind === 'gradient' && b?.kind === 'gradient' && a.gradient.stops.length !== b.gradient.stops.length) {
      c.emit(
        Codes.MORPH_GRADIENT_COUNT_MISMATCH,
        'warning',
        `morph ${id} gradient fill ${index} has different stop counts`,
      );
    }
  }
}

/** Production decoder for morph tags 46 and 84; `Offset` is checked, never trusted for seeking. */
export function decodeDefineMorphShape(tagCode: number, c: Cursor): MorphShapeModel {
  if (tagCode !== Tag.DefineMorphShape && tagCode !== Tag.DefineMorphShape2) {
    throw new RangeError(`tag ${tagCode} is not DefineMorphShape/2`);
  }
  const version: 1 | 2 = tagCode === Tag.DefineMorphShape2 ? 2 : 1;
  const id = c.u16();
  const startBounds = readRect(c);
  const endBounds = readRect(c);
  const startEdgeBounds = version === 2 ? readRect(c) : null;
  const endEdgeBounds = version === 2 ? readRect(c) : null;
  const flags = version === 2 ? c.u8() : 0;
  if (version === 2 && (flags & 0xfc) !== 0) {
    c.emit(
      Codes.SHAPE_RESERVED_FEATURE,
      'info',
      `DefineMorphShape2 ${id} has reserved flag bits 0x${(flags & 0xfc).toString(16)} set`,
    );
  }
  const offset = c.u32();
  const offsetBase = c.offset;
  const fillArrays = morphFillArrays(c);
  const lineArrays = morphLineArrays(c, version);
  compatibleStyles(fillArrays.start, fillArrays.end, c, id);
  const shapeVersion = version === 2 ? 4 : 3;
  const start = readShapeWithStyle(c, id, shapeVersion, startBounds, {
    initialStyles: { fills: fillArrays.start, lines: lineArrays.start },
    // F-P3-10: neither morph tag has a fill-winding flag. `DefineMorphShape2`'s flag byte carries
    // only `UsesNonScalingStrokes`/`UsesScalingStrokes` plus six reserved bits, so morph endpoints
    // follow the same default as `DefineShape1`-`3` — even-odd — rather than inheriting
    // `readShapeWithStyle`'s `nonZero` placeholder by accident. Stated here so the endpoints and
    // their static counterparts agree in the IR (`IMPL-070-R031`).
    fillRule: 'evenOdd',
  });
  const actualEndEdges = c.offset;
  const expectedEndEdges = offsetBase + offset;
  const offsetMatches = actualEndEdges === expectedEndEdges;
  if (!offsetMatches) {
    c.emit(
      Codes.MORPH_OFFSET_MISMATCH,
      'warning',
      `morph ${id} Offset resolves to ${expectedEndEdges}, parsed EndEdges begin at ${actualEndEdges}`,
    );
  }
  const endRaw = readShapeWithStyle(c, id, shapeVersion, endBounds, {
    initialStyles: { fills: fillArrays.end, lines: lineArrays.end },
    fillRule: 'evenOdd',
  });
  const startMoves = start.recordTrace?.moveToEdgeIndices ?? [];
  const endMoves = endRaw.recordTrace?.moveToEdgeIndices ?? [];
  const sameMoves =
    startMoves.length === endMoves.length && startMoves.every((edgeIndex, index) => edgeIndex === endMoves[index]);
  if (!sameMoves || (endRaw.recordTrace?.styleChangeEdgeIndices.length ?? 0) > 0) {
    c.emit(
      Codes.MORPH_STYLE_MISMATCH,
      'warning',
      `morph ${id} StartEdges/EndEdges MoveTo or style-change records do not correspond`,
    );
  }
  const startCount = start.edges.length;
  const endCount = endRaw.edges.length;
  if (startCount !== endCount) {
    c.emit(
      Codes.MORPH_EDGE_COUNT_MISMATCH,
      'warning',
      `morph ${id} has ${startCount} start edge(s) and ${endCount} end edge(s); degenerate pairs inserted`,
    );
  }
  const pairCount = Math.max(startCount, endCount);
  const paddedStart = padEdges(start, pairCount);
  const paddedEndRaw = padEdges(endRaw, pairCount);
  const endEdges = paddedEndRaw.edges;
  const endPaths = start.paths.map((path) => {
    const first = path.edgeRefs.length > 0 ? endEdges[path.edgeRefs[0] ?? -1] : undefined;
    const lastRef = path.edgeRefs[path.edgeRefs.length - 1];
    const last = lastRef === undefined ? undefined : endEdges[lastRef];
    const closed = first !== undefined && last !== undefined && first.fromX === last.toX && first.fromY === last.toY;
    return { ...path, closed, implicitClose: !closed };
  });
  const endStrokes = start.strokes.map((stroke) => {
    const first = stroke.edgeRefs.length > 0 ? endEdges[stroke.edgeRefs[0] ?? -1] : undefined;
    const lastRef = stroke.edgeRefs[stroke.edgeRefs.length - 1];
    const last = lastRef === undefined ? undefined : endEdges[lastRef];
    return {
      ...stroke,
      closed: first !== undefined && last !== undefined && first.fromX === last.toX && first.fromY === last.toY,
    };
  });
  const end: VectorShape = {
    ...paddedEndRaw,
    paths: endPaths,
    strokes: endStrokes,
    styles: { fills: fillArrays.end, lines: lineArrays.end },
  };
  const pairs = Array.from({ length: pairCount }, (_, index): MorphEdgePair => {
    const startEdge = paddedStart.edges[index] ?? { fromX: 0, fromY: 0, toX: 0, toY: 0 };
    const endEdge = end.edges[index] ?? { fromX: 0, fromY: 0, toX: 0, toY: 0 };
    const startCurved = startEdge.controlX !== undefined && startEdge.controlY !== undefined;
    const endCurved = endEdge.controlX !== undefined && endEdge.controlY !== undefined;
    let morphStart = startEdge;
    let morphEnd = endEdge;
    if (startCurved !== endCurved) {
      const straight = startCurved ? endEdge : startEdge;
      const dx = straight.toX - straight.fromX;
      const dy = straight.toY - straight.fromY;
      if (Math.abs(dx % 2) === 1 || Math.abs(dy % 2) === 1) {
        c.emit(
          Codes.MORPH_RATIONAL_HALVED,
          'info',
          `morph ${id} edge ${index} halves an odd straight-edge delta; exact half-twips are retained for interpolation`,
        );
      }
      const quadratic: Edge = {
        ...straight,
        controlX: (straight.fromX + straight.toX) / 2,
        controlY: (straight.fromY + straight.toY) / 2,
      };
      if (startCurved) morphEnd = quadratic;
      else morphStart = quadratic;
    }
    return { index, start: startEdge, end: endEdge, morphStart, morphEnd };
  });
  return {
    id,
    version,
    startBounds,
    endBounds,
    startEdgeBounds,
    endEdgeBounds,
    start: paddedStart,
    end,
    edgeCounts: { start: startCount, end: endCount },
    pairs,
    correspondence: 'index',
    flags: { nonScalingStrokes: (flags & 0x02) !== 0, scalingStrokes: (flags & 0x01) !== 0 },
    offset,
    offsetMatches,
  };
}
