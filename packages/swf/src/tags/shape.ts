/**
 * Shape decoding — `IMPL-060` §4–§7.
 *
 * Style arrays are 1-based (`[0] === null`), the record array is one continuous bit stream, all
 * initial style indices are 0, and curved edges are quadratics with `SB[NumBits + 2]` deltas.
 */

import { Codes } from '../diagnostics/codes.js';
import type { Cursor } from '../io/cursor.js';
import { readMatrix, readRect } from '../io/records.js';
import { readRgb, readRgba } from '../io/colour.js';
import { toPixels, type Mat2D, type Rect, type Rgba } from '../io/types.js';

export type ShapeVersion = 1 | 2 | 3 | 4;

export interface GradientStop {
  /** 0..255. */
  readonly ratio: number;
  readonly color: Rgba;
}

export interface Gradient {
  /** 0 = pad, 1 = reflect, 2 = repeat, 3 = reserved. */
  readonly spreadMode: number;
  /** 0 = normal RGB, 1 = linear RGB. */
  readonly interpolationMode: number;
  readonly stops: readonly GradientStop[];
  /** `FOCALGRADIENT` only. */
  readonly focalPoint?: number;
}

export type FillStyle =
  | { readonly kind: 'solid'; readonly color: Rgba }
  | { readonly kind: 'gradient'; readonly linear: boolean; readonly gradient: Gradient; readonly matrix: Mat2D }
  | { readonly kind: 'bitmap'; readonly bitmapId: number; readonly repeat: boolean; readonly smoothed: boolean; readonly matrix: Mat2D };

export interface LineStyle {
  readonly width: number;
  readonly color: Rgba;
  /** `LINESTYLE2` extras; `undefined` for the v1/v2 `LINESTYLE`. */
  readonly caps?: { readonly start: number; readonly end: number };
  readonly join?: number;
  readonly miterLimit?: number;
  readonly noHScale?: boolean;
  readonly noVScale?: boolean;
  readonly pixelHinting?: boolean;
  readonly noClose?: boolean;
  readonly fill?: FillStyle;
}

export interface Edge {
  readonly fromX: number;
  readonly fromY: number;
  readonly toX: number;
  readonly toY: number;
  /** Quadratic control point, for curved edges. */
  readonly controlX?: number;
  readonly controlY?: number;
}

export interface FillPath {
  /** 1-based index into `styles.fills`. */
  readonly styleId: number;
  readonly edgeRefs: readonly number[];
  readonly closed: boolean;
  readonly implicitClose: boolean;
}

export interface StrokePath {
  /** 1-based index into `styles.lines`. */
  readonly styleId: number;
  readonly edgeRefs: readonly number[];
  readonly closed: boolean;
}

export interface VectorShape {
  readonly id: number;
  readonly version: ShapeVersion;
  readonly bounds: Rect;
  readonly edgeBounds: Rect | null;
  readonly recomputedBounds: Rect | null;
  readonly fillRule: 'evenOdd' | 'nonZero';
  readonly nonScalingStrokes: boolean;
  readonly scalingStrokes: boolean;
  readonly styles: {
    readonly fills: readonly (FillStyle | null)[];
    readonly lines: readonly (LineStyle | null)[];
  };
  readonly paths: readonly FillPath[];
  readonly edges: readonly Edge[];
  readonly strokes: readonly StrokePath[];
}

export interface ShapeDecodeResult {
  readonly shape: VectorShape;
  readonly consumed: number;
}

const FILL_SOLID = 0x00;
const FILL_LINEAR = 0x10;
const FILL_RADIAL = 0x12;
const FILL_FOCAL = 0x13;
const FILL_BITMAP_REPEAT = 0x40;
const FILL_BITMAP_CLIP = 0x41;
const FILL_BITMAP_REPEAT_NS = 0x42;
const FILL_BITMAP_CLIP_NS = 0x43;

function readFillStyle(c: Cursor, version: ShapeVersion): FillStyle | null {
  const type = c.u8();
  const withAlpha = version >= 3;
  switch (type) {
    case FILL_SOLID:
      return { kind: 'solid', color: withAlpha ? readRgba(c) : readRgb(c) };
    case FILL_LINEAR:
    case FILL_RADIAL:
    case FILL_FOCAL: {
      const matrix = readMatrix(c);
      const gradient = readGradient(c, version, type === FILL_FOCAL);
      if (type === FILL_FOCAL && version < 4) {
        c.emit(Codes.SHAPE_FOCAL_OUTSIDE_V4, 'info', 'FOCALGRADIENT used outside DefineShape4 (tolerated)');
      }
      return { kind: 'gradient', linear: type === FILL_LINEAR, gradient, matrix };
    }
    case FILL_BITMAP_REPEAT:
    case FILL_BITMAP_CLIP:
    case FILL_BITMAP_REPEAT_NS:
    case FILL_BITMAP_CLIP_NS: {
      const bitmapId = c.u16();
      const matrix = readMatrix(c);
      return {
        kind: 'bitmap',
        bitmapId,
        repeat: type === FILL_BITMAP_REPEAT || type === FILL_BITMAP_REPEAT_NS,
        smoothed: type === FILL_BITMAP_REPEAT || type === FILL_BITMAP_CLIP,
        matrix,
      };
    }
    default:
      c.emit(Codes.SHAPE_FILL_TYPE_UNKNOWN, 'error', `unknown FillStyleType 0x${type.toString(16).padStart(2, '0')}; shape quarantined`);
      return null;
  }
}

function readGradient(c: Cursor, version: ShapeVersion, focal: boolean): Gradient {
  const spreadMode = c.ub(2);
  const interpolationMode = c.ub(2);
  let numGradients = c.ub(4);
  if (numGradients === 0x0f) {
    if (version < 3) {
      c.emit(Codes.SHAPE_RESERVED_FEATURE, 'info', 'extended gradient count used by a pre-v3 shape (tolerated)');
    }
    numGradients = c.u8();
  }
  if (spreadMode === 3 || interpolationMode >= 2) {
    c.emit(Codes.SHAPE_GRADIENT_MODE_INVALID, 'warning', `reserved gradient mode (spread ${spreadMode}, interpolation ${interpolationMode}); value honoured`);
  }
  const withAlpha = version >= 3;
  const stops: GradientStop[] = [];
  let previous = -1;
  for (let i = 0; i < numGradients; i += 1) {
    const ratio = c.u8();
    if (ratio <= previous && previous >= 0) {
      c.emit(Codes.SHAPE_GRADIENT_STOP_ORDER, 'warning', 'gradient control points out of ratio order or duplicated; normalised in the IR only');
    }
    previous = ratio;
    const color = withAlpha ? readRgba(c) : readRgb(c);
    stops.push({ ratio, color });
  }
  if (numGradients === 0) {
    c.emit(Codes.SHAPE_GRADIENT_EMPTY, 'error', 'NumGradients is 0; the fill is dropped and the stream stays aligned');
  }
  if (!focal) return { spreadMode, interpolationMode, stops };
  const focalPoint = c.fixed8();
  return { spreadMode, interpolationMode, stops, focalPoint };
}

function readFillStyleArray(c: Cursor, version: ShapeVersion): (FillStyle | null)[] {
  let count = c.u8();
  if (count === 0xff) {
    if (version === 1) {
      c.emit(Codes.SHAPE_RESERVED_FEATURE, 'info', 'extended FillStyleCount used by DefineShape (v1)');
    }
    if (version === 4) {
      c.emit(Codes.SHAPE_RESERVED_FLAG_BITS, 'info', 'extended FillStyleCount in DefineShape4 (the chapter reserves 0xFF for older tags)');
    }
    count = c.u16();
  }
  const fills: (FillStyle | null)[] = [null];
  for (let i = 0; i < count; i += 1) {
    const style = readFillStyle(c, version);
    fills.push(style);
    if (style === null) break; // unknown type: the array length is unknowable, stop cleanly
  }
  if (count >= 250) {
    c.emit(Codes.SHAPE_STYLE_DEDUPE_CEILING, 'warning', `style array has ${count} entries at the dedupe ceiling; kept verbatim`);
  }
  return fills;
}

function readLineStyleArray(c: Cursor, version: ShapeVersion): (LineStyle | null)[] {
  let count = c.u8();
  if (count === 0xff) {
    if (version === 1) {
      c.emit(Codes.SHAPE_RESERVED_FEATURE, 'info', 'extended LineStyleCount used by DefineShape (v1)');
    }
    count = c.u16();
  }
  const lines: (LineStyle | null)[] = [null];
  const withAlpha = version >= 3;
  for (let i = 0; i < count; i += 1) {
    const width = c.u16();
    if (version < 4) {
      lines.push({ width, color: withAlpha ? readRgba(c) : readRgb(c) });
      continue;
    }
    const startCap = c.ub(2);
    const join = c.ub(2);
    const hasFill = c.ub(1) === 1;
    const noHScale = c.ub(1) === 1;
    const noVScale = c.ub(1) === 1;
    const pixelHinting = c.ub(1) === 1;
    c.ub(5); // reserved
    const noClose = c.ub(1) === 1;
    const endCap = c.ub(2);
    const fill = hasFill ? readFillStyle(c, version) : undefined;
    const color = hasFill ? { r: 0, g: 0, b: 0, a: 255 } : readRgba(c);
    const miterLimit = join === 2 ? c.fixed8() : undefined;
    lines.push({
      width,
      color,
      caps: { start: startCap, end: endCap },
      join,
      ...(miterLimit !== undefined ? { miterLimit } : {}),
      noHScale,
      noVScale,
      pixelHinting,
      noClose,
      ...(fill ? { fill } : {}),
    });
  }
  return lines;
}

interface Pen {
  x: number;
  y: number;
}

/** `SHAPEWITHSTYLE` — the body of `DefineShape` 1–4 (`IMPL-060` §5). */
export function readShapeWithStyle(
  c: Cursor,
  id: number,
  version: ShapeVersion,
  declaredBounds: Rect,
  opts: { recomputeBounds?: boolean } = {},
): VectorShape {
  const fills = readFillStyleArray(c, version);
  const lines = readLineStyleArray(c, version);

  let numFillBits = c.ub(4);
  let numLineBits = c.ub(4);
  if (numFillBits > 16 || numLineBits > 16) {
    c.emit(Codes.SHAPE_INDEX_WIDTH_INVALID, 'error', `style index width too large (fill ${numFillBits}, line ${numLineBits})`);
    numFillBits = Math.min(numFillBits, 16);
    numLineBits = Math.min(numLineBits, 16);
  }

  const edges: Edge[] = [];
  const paths: FillPath[] = [];
  const strokes: StrokePath[] = [];
  const pen: Pen = { x: 0, y: 0 };
  let fill0 = 0;
  let fill1 = 0;
  let line = 0;
  let runEdges: number[] = [];
  let runStart: { x: number; y: number } | null = null;
  const usedFill = new Set<number>();
  const usedLine = new Set<number>();

  const closeRun = (styleId: number, isStroke: boolean): void => {
    if (styleId === 0 || runEdges.length === 0) {
      runEdges = [];
      runStart = null;
      return;
    }
    const closed = runStart !== null && pen.x === runStart.x && pen.y === runStart.y;
    if (isStroke) {
      strokes.push({ styleId, edgeRefs: runEdges, closed });
      usedLine.add(styleId);
    } else {
      paths.push({ styleId, edgeRefs: runEdges, closed, implicitClose: !closed });
      usedFill.add(styleId);
      if (!closed) {
        c.emit(Codes.SHAPE_IMPLICIT_CLOSE, 'warning', 'style run not explicitly closed; implicit close applied');
      }
    }
    runEdges = [];
    runStart = null;
  };

  let guard = 0;
  for (;;) {
    guard += 1;
    if (guard > 1_000_000) {
      c.emit(Codes.SHAPE_UNUSED_STYLE, 'info', 'shape record ceiling reached; stopping the walk');
      break;
    }
    const typeFlag = c.ub(1);
    if (typeFlag === 0) {
      const newStyles = c.ub(1) === 1;
      const lineStyleBit = c.ub(1) === 1;
      const fillStyle1Bit = c.ub(1) === 1;
      const fillStyle0Bit = c.ub(1) === 1;
      const moveTo = c.ub(1) === 1;
      if (!newStyles && !lineStyleBit && !fillStyle1Bit && !fillStyle0Bit && !moveTo) {
        break; // End record
      }
      if (moveTo) {
        const moveBits = c.ub(5);
        closeRun(fill0, false);
        closeRun(line, true);
        pen.x += c.sb(moveBits);
        pen.y += c.sb(moveBits);
        runStart = { x: pen.x, y: pen.y };
      }
      if (fillStyle0Bit) {
        const next = c.ub(numFillBits);
        if (next !== fill0) {
          closeRun(fill0, false);
          fill0 = next;
          runStart = { x: pen.x, y: pen.y };
        }
      }
      if (fillStyle1Bit) {
        const next = c.ub(numFillBits);
        if (next !== fill1) {
          fill1 = next;
        }
      }
      if (lineStyleBit) {
        const next = c.ub(numLineBits);
        if (next !== line) {
          closeRun(line, true);
          line = next;
          runStart = { x: pen.x, y: pen.y };
        }
      }
      if (newStyles) {
        if (version < 2) {
          c.emit(Codes.SHAPE_RECORD_DEGENERATE, 'warning', 'StateNewStyles used by DefineShape (v1); tolerated');
        }
        if (version === 4) {
          c.emit(Codes.SHAPE_RESERVED_FEATURE, 'info', 'StateNewStyles used by DefineShape4 (chapter-reserved)');
        }
        const moreFills = readFillStyleArray(c, version);
        const moreLines = readLineStyleArray(c, version);
        fills.length = 0;
        fills.push(...moreFills);
        lines.length = 0;
        lines.push(...moreLines);
        numFillBits = c.ub(4);
        numLineBits = c.ub(4);
        if (numFillBits > 16 || numLineBits > 16) {
          c.emit(Codes.SHAPE_INDEX_WIDTH_INVALID, 'error', 'style index width too large after StateNewStyles');
        }
        fill0 = 0;
        fill1 = 0;
        line = 0;
        runStart = { x: pen.x, y: pen.y };
      }
      if (!moveTo && !lineStyleBit && !fillStyle0Bit && !fillStyle1Bit && !newStyles) {
        c.emit(Codes.SHAPE_RECORD_DEGENERATE, 'warning', 'degenerate style-change record');
      }
      continue;
    }

    const straight = c.ub(1) === 1;
    let numBits = c.ub(4);
    numBits += 2;
    if (straight) {
      const general = c.ub(1) === 1;
      let dx = 0;
      let dy = 0;
      if (general) {
        dx = c.sb(numBits);
        dy = c.sb(numBits);
      } else if (c.ub(1) === 1) {
        dy = c.sb(numBits);
      } else {
        dx = c.sb(numBits);
      }
      const edge: Edge = { fromX: pen.x, fromY: pen.y, toX: pen.x + dx, toY: pen.y + dy };
      edges.push(edge);
      runEdges.push(edges.length - 1);
      pen.x = edge.toX;
      pen.y = edge.toY;
    } else {
      const controlDx = c.sb(numBits);
      const controlDy = c.sb(numBits);
      const anchorDx = c.sb(numBits);
      const anchorDy = c.sb(numBits);
      const controlX = pen.x + controlDx;
      const controlY = pen.y + controlDy;
      const edge: Edge = {
        fromX: pen.x,
        fromY: pen.y,
        toX: controlX + anchorDx,
        toY: controlY + anchorDy,
        controlX,
        controlY,
      };
      edges.push(edge);
      runEdges.push(edges.length - 1);
      pen.x = edge.toX;
      pen.y = edge.toY;
    }
  }

  closeRun(fill0, false);
  closeRun(line, true);

  for (const id of usedFill) if (id >= fills.length) c.emit(Codes.SHAPE_STYLE_INDEX_RANGE, 'error', `fill style index ${id} beyond the array (clamped to 0)`);
  for (const id of usedLine) if (id >= lines.length) c.emit(Codes.SHAPE_STYLE_INDEX_RANGE, 'error', `line style index ${id} beyond the array (clamped to 0)`);

  const unused = fills.length - 1 - usedFill.size;
  if (unused > 0) {
    c.emit(Codes.SHAPE_UNUSED_STYLE, 'info', `${unused} declared fill style(s) never referenced`);
  }

  let recomputed: Rect | null = null;
  if (opts.recomputeBounds !== false && edges.length > 0) {
    let xMin = Number.POSITIVE_INFINITY;
    let xMax = Number.NEGATIVE_INFINITY;
    let yMin = Number.POSITIVE_INFINITY;
    let yMax = Number.NEGATIVE_INFINITY;
    for (const e of edges) {
      for (const [x, y] of [
        [e.fromX, e.fromY],
        [e.toX, e.toY],
        ...(e.controlX !== undefined && e.controlY !== undefined ? [[e.controlX, e.controlY] as const] : []),
      ] as const) {
        xMin = Math.min(xMin, x);
        xMax = Math.max(xMax, x);
        yMin = Math.min(yMin, y);
        yMax = Math.max(yMax, y);
      }
    }
    const declaredW = declaredBounds.xMax - declaredBounds.xMin;
    const declaredH = declaredBounds.yMax - declaredBounds.yMin;
    const computed: Rect = { xMin, xMax, yMin, yMax };
    const dw = Math.abs(computed.xMax - computed.xMin - declaredW) / Math.max(1, declaredW);
    const dh = Math.abs(computed.yMax - computed.yMin - declaredH) / Math.max(1, declaredH);
    if (dw > 0.01 || dh > 0.01) {
      c.emit(
        Codes.SHAPE_BOUNDS_DISAGREE,
        'warning',
        `declared bounds (${declaredW} x ${declaredH} twips) disagree with recomputed bounds (${computed.xMax - computed.xMin} x ${computed.yMax - computed.yMin}) beyond 1%`,
      );
      recomputed = null;
    } else {
      recomputed = computed;
    }
  }

  return {
    id,
    version,
    bounds: declaredBounds,
    edgeBounds: null,
    recomputedBounds: recomputed,
    fillRule: 'nonZero',
    nonScalingStrokes: false,
    scalingStrokes: false,
    styles: { fills, lines },
    paths,
    edges,
    strokes,
  };
}

export interface DefineShapeResult {
  readonly shape: VectorShape;
  readonly boundsPx: { xMin: number; xMax: number; yMin: number; yMax: number };
}

/** Version-aware entry point used by the tag dispatcher. */
export function decodeDefineShapeVersion(tagCode: number, c: Cursor): DefineShapeResult {
  const version: ShapeVersion = tagCode === 2 ? 1 : tagCode === 22 ? 2 : tagCode === 32 ? 3 : 4;
  const start = c.offset;
  const id = c.u16();
  const bounds = readRect(c);
  let edgeBounds: Rect | null = null;
  let flags = 0;
  if (version === 4) {
    edgeBounds = readRect(c);
    flags = c.u8();
  }
  const shape = readShapeWithStyle(c, id, version, bounds);
  const reservedBits = flags & 0b0001_1111;
  if (reservedBits !== 0) {
    c.emit(Codes.SHAPE_RESERVED_FLAG_BITS, 'info', `reserved DefineShape4 flag bits 0x${reservedBits.toString(16)} non-zero (preserved)`);
  }
  const used = c.offset - start;
  if (used === 0) {
    c.emit(Codes.SHAPE_RECORD_DEGENERATE, 'warning', 'empty shape body');
  }
  return {
    shape: {
      ...shape,
      edgeBounds,
      fillRule: (flags & 0b0010_0000) !== 0 ? 'nonZero' : 'evenOdd',
      nonScalingStrokes: (flags & 0b0001_0000) !== 0,
      scalingStrokes: (flags & 0b0000_1000) !== 0,
    },
    boundsPx: {
      xMin: toPixels(bounds.xMin),
      xMax: toPixels(bounds.xMax),
      yMin: toPixels(bounds.yMin),
      yMax: toPixels(bounds.yMax),
    },
  };
}
