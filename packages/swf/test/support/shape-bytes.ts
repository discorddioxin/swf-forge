/**
 * `DefineShape` body builders shared by the C2 shape tests.
 *
 * The existing shape suites each grew their own one-off writer, which is fine when a test pins one
 * byte layout but awkward when a test needs to vary the *shape version* while holding the geometry
 * fixed (`T-MOD-119`/`120`: the gradient header is read identically in all four versions, only the
 * colour width changes). These builders take the version as a parameter so the same fixture can be
 * emitted four ways.
 */

import { Cursor, DiagnosticSink, Tag, decodeDefineShapeVersion } from '@swf-forge/swf';
import type { ShapeVersion, VectorShape } from '@swf-forge/swf';
import { ByteWriter, writeRect } from '@swf-forge/swf/test-support';

export interface Rect {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export const TAG_FOR_VERSION: Record<ShapeVersion, number> = {
  1: Tag.DefineShape,
  2: Tag.DefineShape2,
  3: Tag.DefineShape3,
  4: Tag.DefineShape4,
};

/** Minimum signed-bit width that holds every one of `values`. */
export function signedBits(values: readonly number[]): number {
  let bits = 1;
  for (const value of values) {
    while (value < -(2 ** (bits - 1)) || value > 2 ** (bits - 1) - 1) bits += 1;
  }
  return bits;
}

export function writeSigned(w: ByteWriter, value: number, bits: number): void {
  w.bits(value < 0 ? 2 ** bits + value : value, bits);
}

/** `RGB` for shape 1/2, `RGBA` for shape 3/4 — the single rule behind every colour field. */
export function writeColor(
  w: ByteWriter,
  version: ShapeVersion,
  rgba: readonly [number, number, number, number],
): void {
  w.u8(rgba[0]).u8(rgba[1]).u8(rgba[2]);
  if (version >= 3) w.u8(rgba[3]);
}

export interface MatrixSpec {
  /** Scale factors; omitted together means `HasScale = 0`. */
  readonly scale?: readonly [number, number];
  /** Rotate/skew factors; omitted together means `HasRotate = 0`. */
  readonly rotate?: readonly [number, number];
  readonly translate?: readonly [number, number];
}

/** `MATRIX`, byte-aligned on exit exactly as `readMatrix` expects. */
export function writeMatrix(w: ByteWriter, spec: MatrixSpec = {}): void {
  if (spec.scale) {
    const fixed = spec.scale.map((value) => Math.round(value * 65536));
    const bits = signedBits(fixed);
    w.bits(1, 1).bits(bits, 5);
    for (const value of fixed) writeSigned(w, value, bits);
  } else {
    w.bits(0, 1);
  }
  if (spec.rotate) {
    const fixed = spec.rotate.map((value) => Math.round(value * 65536));
    const bits = signedBits(fixed);
    w.bits(1, 1).bits(bits, 5);
    for (const value of fixed) writeSigned(w, value, bits);
  } else {
    w.bits(0, 1);
  }
  const translate = spec.translate ?? [0, 0];
  const bits = translate[0] === 0 && translate[1] === 0 ? 0 : signedBits(translate);
  w.bits(bits, 5);
  for (const value of translate) writeSigned(w, value, bits);
  w.align();
}

export interface GradientSpec {
  /** `0x10` linear, `0x12` radial, `0x13` focal. */
  readonly type: number;
  readonly spreadMode?: number;
  readonly interpolationMode?: number;
  readonly stops: readonly (readonly [number, readonly [number, number, number, number]])[];
  /** Raw `FIXED8` word, written verbatim so a test can pin `0xFF00` / `0x0000` / `0x0100`. */
  readonly focalRaw?: number;
  /** Force the `0x0F` extended-count escape even when the stop count is below 15. */
  readonly forceExtendedCount?: boolean;
  readonly matrix?: MatrixSpec;
}

export function writeGradientFill(w: ByteWriter, version: ShapeVersion, spec: GradientSpec): void {
  w.u8(spec.type);
  writeMatrix(w, spec.matrix ?? {});
  w.bits(spec.spreadMode ?? 0, 2).bits(spec.interpolationMode ?? 0, 2);
  const extended = spec.forceExtendedCount === true || spec.stops.length >= 0x0f;
  if (extended) {
    w.bits(0x0f, 4).align();
    w.u8(spec.stops.length);
  } else {
    w.bits(spec.stops.length, 4).align();
  }
  for (const [ratio, color] of spec.stops) {
    w.u8(ratio);
    writeColor(w, version, color);
  }
  if (spec.type === 0x13) w.u16(spec.focalRaw ?? 0x0100);
}

export interface ShapeBytesSpec {
  readonly version: ShapeVersion;
  readonly id?: number;
  readonly bounds?: Rect;
  readonly edgeBounds?: Rect;
  /** Raw `DefineShape4` flag byte. */
  readonly flags?: number;
  /** Writes `FillStyleCount` and the entries. Defaults to an empty array. */
  readonly fills?: ((w: ByteWriter) => void) | undefined;
  /** Writes `LineStyleCount` and the entries. Defaults to an empty array. */
  readonly lines?: ((w: ByteWriter) => void) | undefined;
  readonly numFillBits?: number;
  readonly numLineBits?: number;
  /** Writes `SHAPERECORD`s; the terminating `End` record and padding are appended for you. */
  readonly records?: (w: ByteWriter) => void;
}

export function shapeBytes(spec: ShapeBytesSpec): Uint8Array {
  const bounds = spec.bounds ?? { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
  const w = new ByteWriter();
  w.u16(spec.id ?? 1);
  writeRect(w, bounds);
  if (spec.version === 4) {
    writeRect(w, spec.edgeBounds ?? bounds);
    w.u8(spec.flags ?? 0);
  }
  (spec.fills ?? ((writer: ByteWriter) => writer.u8(0)))(w);
  (spec.lines ?? ((writer: ByteWriter) => writer.u8(0)))(w);
  w.bits(spec.numFillBits ?? 0, 4).bits(spec.numLineBits ?? 0, 4);
  spec.records?.(w);
  w.bits(0, 6).align();
  return w.toUint8Array();
}

export interface DecodeResult {
  readonly shape: VectorShape;
  readonly sink: DiagnosticSink;
  readonly codes: string[];
  readonly bytes: Uint8Array;
  readonly consumed: number;
}

export function decodeShapeBytes(bytes: Uint8Array, version: ShapeVersion, fileVersion = 10): DecodeResult {
  const sink = new DiagnosticSink();
  const tagCode = TAG_FOR_VERSION[version];
  const cursor = new Cursor(bytes, 0, bytes.length, { sink, version: fileVersion, tagCode });
  const { shape } = decodeDefineShapeVersion(tagCode, cursor);
  return { shape, sink, codes: sink.list().map((d) => d.code), bytes, consumed: cursor.offset };
}

export function buildAndDecode(spec: ShapeBytesSpec, fileVersion = 10): DecodeResult {
  return decodeShapeBytes(shapeBytes(spec), spec.version, fileVersion);
}

// ---- shape-record helpers -----------------------------------------------------------------------

export interface StyleChangeSpec {
  readonly moveTo?: readonly [number, number];
  readonly fill0?: number;
  readonly fill1?: number;
  readonly line?: number;
  readonly numFillBits: number;
  readonly numLineBits: number;
}

/** A `StyleChangeRecord`: flags, then `MoveTo`, then fill0/fill1/line indices, in chapter order. */
export function writeStyleChange(w: ByteWriter, spec: StyleChangeSpec): void {
  w.bits(0, 1); // TypeFlag = 0
  w.bits(0, 1); // StateNewStyles
  w.bits(spec.line === undefined ? 0 : 1, 1);
  w.bits(spec.fill1 === undefined ? 0 : 1, 1);
  w.bits(spec.fill0 === undefined ? 0 : 1, 1);
  w.bits(spec.moveTo === undefined ? 0 : 1, 1);
  if (spec.moveTo !== undefined) {
    const bits = Math.max(1, signedBits(spec.moveTo));
    w.bits(bits, 5);
    writeSigned(w, spec.moveTo[0], bits);
    writeSigned(w, spec.moveTo[1], bits);
  }
  if (spec.fill0 !== undefined) w.bits(spec.fill0, spec.numFillBits);
  if (spec.fill1 !== undefined) w.bits(spec.fill1, spec.numFillBits);
  if (spec.line !== undefined) w.bits(spec.line, spec.numLineBits);
}

/** A general `StraightEdgeRecord` (both deltas always written, so the width is predictable). */
export function writeStraightEdge(w: ByteWriter, dx: number, dy: number): void {
  const bits = Math.max(2, signedBits([dx, dy]));
  w.bits(1, 1)
    .bits(1, 1)
    .bits(bits - 2, 4)
    .bits(1, 1);
  writeSigned(w, dx, bits);
  writeSigned(w, dy, bits);
}

/** A `CurvedEdgeRecord`; all four deltas share one width of `NumBits + 2`. */
export function writeCurvedEdge(w: ByteWriter, deltas: readonly [number, number, number, number]): void {
  const bits = Math.max(2, signedBits(deltas));
  w.bits(1, 1)
    .bits(0, 1)
    .bits(bits - 2, 4);
  for (const delta of deltas) writeSigned(w, delta, bits);
}
