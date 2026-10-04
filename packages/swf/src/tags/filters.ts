/**
 * `FILTERLIST` and the eight Ch.3 filter structures — `IMPL-030` §5, APP-§10.1.
 *
 * Values stay in their tag units (FIXED pixels/radians, FIXED8 gain, unnormalised colour values). An
 * unknown id has no length prefix, so its raw tail is retained and the enclosing PlaceObject3 stops
 * decoding after that filter.
 */

import { Codes } from '../diagnostics/codes.js';
import type { Cursor } from '../io/cursor.js';
import { readRgba } from '../io/colour.js';
import type { Rgba } from '../io/types.js';

export interface DropShadowFilterSpec {
  readonly kind: 'dropShadow';
  readonly color: Rgba;
  readonly blurX: number;
  readonly blurY: number;
  readonly angle: number;
  readonly distance: number;
  /** FIXED8 gain, as stored. */
  readonly strength: number;
  readonly innerShadow: boolean;
  readonly knockout: boolean;
  readonly compositeSource: boolean;
  readonly passes: number;
}

export interface BlurFilterSpec {
  readonly kind: 'blur';
  readonly blurX: number;
  readonly blurY: number;
  readonly passes: number;
  readonly reserved: number;
}

export interface GlowFilterSpec {
  readonly kind: 'glow';
  readonly color: Rgba;
  readonly blurX: number;
  readonly blurY: number;
  /** FIXED8 gain, as stored. */
  readonly strength: number;
  readonly innerGlow: boolean;
  readonly knockout: boolean;
  readonly compositeSource: boolean;
  readonly passes: number;
}

export interface BevelFilterSpec {
  readonly kind: 'bevel';
  readonly shadowColor: Rgba;
  readonly highlightColor: Rgba;
  readonly blurX: number;
  readonly blurY: number;
  readonly angle: number;
  readonly distance: number;
  /** FIXED8 gain, as stored. */
  readonly strength: number;
  readonly innerShadow: boolean;
  readonly knockout: boolean;
  readonly compositeSource: boolean;
  readonly onTop: boolean;
  readonly passes: number;
}

export interface GradientGlowFilterSpec {
  readonly kind: 'gradientGlow' | 'gradientBevel';
  readonly colors: readonly Rgba[];
  readonly ratios: readonly number[];
  readonly blurX: number;
  readonly blurY: number;
  readonly angle: number;
  readonly distance: number;
  /** FIXED8 gain, as stored. */
  readonly strength: number;
  readonly innerShadow: boolean;
  readonly knockout: boolean;
  readonly compositeSource: boolean;
  readonly onTop: boolean;
  readonly passes: number;
}

export interface ConvolutionFilterSpec {
  readonly kind: 'convolution';
  readonly matrixX: number;
  readonly matrixY: number;
  readonly divisor: number;
  readonly bias: number;
  readonly matrix: readonly number[];
  readonly defaultColor: Rgba;
  readonly reserved: number;
  readonly clamp: boolean;
  readonly preserveAlpha: boolean;
}

export interface ColorMatrixFilterSpec {
  readonly kind: 'colorMatrix';
  /** Row-major 4×5 matrix of IEEE FLOAT values. */
  readonly matrix: readonly number[];
}

export interface UnknownFilterSpec {
  readonly kind: 'unknown';
  readonly filterId: number;
  /** Bytes from the unknown FilterID through the end of the PlaceObject3 tag body. */
  readonly raw: Uint8Array;
}

export type FilterSpec =
  | DropShadowFilterSpec
  | BlurFilterSpec
  | GlowFilterSpec
  | BevelFilterSpec
  | GradientGlowFilterSpec
  | ConvolutionFilterSpec
  | ColorMatrixFilterSpec
  | UnknownFilterSpec;

export interface FilterListResult {
  readonly filters: readonly FilterSpec[];
  /** False when an unknown id made the rest of the unlength-prefixed list undecodable. */
  readonly complete: boolean;
}

function bool(c: Cursor): boolean {
  return c.ub(1) !== 0;
}

function readCompositeSource(c: Cursor): boolean {
  const compositeSource = bool(c);
  if (!compositeSource) {
    c.emit(Codes.FILTER_PARAM_RANGE, 'warning', 'CompositeSource is 0; the filter does not composite its source');
  }
  return compositeSource;
}

function readFlags3(c: Cursor): { inner: boolean; knockout: boolean; compositeSource: boolean } {
  const inner = bool(c);
  const knockout = bool(c);
  const compositeSource = readCompositeSource(c);
  return { inner, knockout, compositeSource };
}

function readFlags4(c: Cursor): {
  inner: boolean;
  knockout: boolean;
  compositeSource: boolean;
  onTop: boolean;
} {
  const inner = bool(c);
  const knockout = bool(c);
  const compositeSource = readCompositeSource(c);
  const onTop = bool(c);
  return { inner, knockout, compositeSource, onTop };
}

function readDropShadow(c: Cursor): DropShadowFilterSpec {
  const color = readRgba(c);
  const blurX = c.fixed();
  const blurY = c.fixed();
  const angle = c.fixed();
  const distance = c.fixed();
  const strength = c.fixed8();
  const { inner, knockout, compositeSource } = readFlags3(c);
  const passes = c.ub(5);
  return {
    kind: 'dropShadow',
    color,
    blurX,
    blurY,
    angle,
    distance,
    strength,
    innerShadow: inner,
    knockout,
    compositeSource,
    passes,
  };
}

function readBlur(c: Cursor): BlurFilterSpec {
  const blurX = c.fixed();
  const blurY = c.fixed();
  const passes = c.ub(5);
  const reserved = c.ub(3);
  if (reserved !== 0)
    c.emit(Codes.PLACEMENT_RESERVED_BITS, 'info', `BlurFilter reserved bits 0b${reserved.toString(2)} preserved`);
  return { kind: 'blur', blurX, blurY, passes, reserved };
}

function readGlow(c: Cursor): GlowFilterSpec {
  const color = readRgba(c);
  const blurX = c.fixed();
  const blurY = c.fixed();
  const strength = c.fixed8();
  const { inner, knockout, compositeSource } = readFlags3(c);
  const passes = c.ub(5);
  return { kind: 'glow', color, blurX, blurY, strength, innerGlow: inner, knockout, compositeSource, passes };
}

function readBevel(c: Cursor): BevelFilterSpec {
  const shadowColor = readRgba(c);
  const highlightColor = readRgba(c);
  const blurX = c.fixed();
  const blurY = c.fixed();
  const angle = c.fixed();
  const distance = c.fixed();
  const strength = c.fixed8();
  const { inner, knockout, compositeSource, onTop } = readFlags4(c);
  const passes = c.ub(4);
  return {
    kind: 'bevel',
    shadowColor,
    highlightColor,
    blurX,
    blurY,
    angle,
    distance,
    strength,
    innerShadow: inner,
    knockout,
    compositeSource,
    onTop,
    passes,
  };
}

function readGradientGlow(c: Cursor, kind: 'gradientGlow' | 'gradientBevel'): GradientGlowFilterSpec {
  const count = c.u8();
  const colors: Rgba[] = [];
  for (let i = 0; i < count; i += 1) colors.push(readRgba(c));
  const ratios: number[] = [];
  for (let i = 0; i < count; i += 1) ratios.push(c.u8());
  const blurX = c.fixed();
  const blurY = c.fixed();
  const angle = c.fixed();
  const distance = c.fixed();
  const strength = c.fixed8();
  const { inner, knockout, compositeSource, onTop } = readFlags4(c);
  const passes = c.ub(4);
  return {
    kind,
    colors,
    ratios,
    blurX,
    blurY,
    angle,
    distance,
    strength,
    innerShadow: inner,
    knockout,
    compositeSource,
    onTop,
    passes,
  };
}

function readConvolution(c: Cursor): ConvolutionFilterSpec {
  const matrixX = c.u8();
  const matrixY = c.u8();
  const divisor = c.float32();
  const bias = c.float32();
  const count = matrixX * matrixY;
  const matrix: number[] = [];
  for (let i = 0; i < count; i += 1) matrix.push(c.float32());
  const defaultColor = readRgba(c);
  const reserved = c.ub(6);
  const clamp = bool(c);
  const preserveAlpha = bool(c);
  if (reserved !== 0)
    c.emit(
      Codes.PLACEMENT_RESERVED_BITS,
      'info',
      `ConvolutionFilter reserved bits 0x${reserved.toString(16)} preserved`,
    );
  return { kind: 'convolution', matrixX, matrixY, divisor, bias, matrix, defaultColor, reserved, clamp, preserveAlpha };
}

function readColorMatrix(c: Cursor): ColorMatrixFilterSpec {
  const matrix: number[] = [];
  for (let i = 0; i < 20; i += 1) matrix.push(c.float32());
  return { kind: 'colorMatrix', matrix };
}

function readKnownFilter(c: Cursor, id: number): FilterSpec | null {
  switch (id) {
    case 0:
      return readDropShadow(c);
    case 1:
      return readBlur(c);
    case 2:
      return readGlow(c);
    case 3:
      return readBevel(c);
    case 4:
      return readGradientGlow(c, 'gradientGlow');
    case 5:
      return readConvolution(c);
    case 6:
      return readColorMatrix(c);
    case 7:
      return readGradientGlow(c, 'gradientBevel');
    default:
      return null;
  }
}

/** Reads the count and all filters, retaining the unknown filter's undecodable raw tail. */
export function readFilterList(c: Cursor): FilterListResult {
  const count = c.u8();
  const filters: FilterSpec[] = [];
  for (let i = 0; i < count; i += 1) {
    const start = c.offset;
    const filterId = c.u8();
    const filter = readKnownFilter(c, filterId);
    if (filter === null) {
      const raw = c.bytes.subarray(start, c.limit);
      c.emit(
        Codes.FILTER_ID_UNKNOWN,
        'warning',
        `unknown PlaceObject3 filter id ${filterId}; ${raw.length} raw byte(s) retained to tag end`,
        start,
      );
      filters.push({ kind: 'unknown', filterId, raw });
      c.seek(c.limit);
      return { filters, complete: false };
    }
    filters.push(filter);
  }
  return { filters, complete: true };
}
