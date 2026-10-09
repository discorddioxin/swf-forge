/**
 * Static-render fixtures — the P4 golden corpus (`IMPL-140` §2/§6, `TST-R013`).
 *
 * Twenty deterministic **no-script** movies, one per rendering rule the P4 gate checks: integer
 * fills and holes, both fill rules, quadratic edges, stroke caps and joins, hairlines, `CXFORM`
 * mult/add, matrices, depth order, sprites (nested, looping), `clipDepth` masks, visibility, removal
 * and a placement grid for the draw-call counters.
 *
 * The encoders below are deliberately explicit: shape records are written bit by bit here instead of
 * reusing the decoder's layout constants, so an encoder bug cannot cancel out a decoder bug. Each
 * fixture is verified against the production decoder by `packages/swf/test/static-fixtures.test.ts`
 * before any golden is generated from it.
 */

import type { Rect } from '../io/types.js';
import { ByteWriter, buildSwf, concat, defineSprite, defineTag, endTag, showFrames, tag, writeRect } from './writer.js';

/** Stage pixels → twips. */
export const FIXTURE_TWIPS = 20;
const TW = (pixels: number): number => Math.round(pixels * FIXTURE_TWIPS);

export interface Pt {
  readonly x: number;
  readonly y: number;
}

export interface Solid {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a?: number;
}

export interface LineSpec {
  /** Stroke width in **pixels** (`0` renders as a hairline). */
  readonly width: number;
  readonly color: Solid;
  /** `DefineShape4` only: 0 = round (default), 1 = butt, 2 = square. */
  readonly startCap?: 0 | 1 | 2;
  readonly endCap?: 0 | 1 | 2;
  /** `DefineShape4` only: 0 = round (default), 1 = bevel, 2 = miter. */
  readonly join?: 0 | 1 | 2;
  /** Miter ratio (Flash's `MiterLimitFactor`; 3 is the player default). */
  readonly miterLimit?: number;
  readonly noClose?: boolean;
}

export type Segment = { readonly to: Pt } | { readonly control: Pt; readonly to: Pt };

export interface PathSpec {
  readonly start: Pt;
  readonly segments: readonly Segment[];
  /** 1-based fill style index, omitted for stroke-only paths. */
  readonly fill?: number;
  /** 1-based line style index, omitted for fill-only paths. */
  readonly line?: number;
  /** Close the subpath back to `start` (default `true`). */
  readonly closed?: boolean;
}

export interface ShapeSpec {
  readonly id: number;
  readonly bounds: { readonly x0: number; readonly y0: number; readonly x1: number; readonly y1: number };
  readonly fills?: readonly Solid[];
  readonly lines?: readonly LineSpec[];
  readonly paths: readonly PathSpec[];
  readonly version?: 1 | 2 | 3 | 4;
  /** `DefineShape4`: `UsesFillWindingRule` (bit 2 of the flags byte). */
  readonly windingRule?: boolean;
}

const TAG_CODE: Readonly<Record<1 | 2 | 3 | 4, number>> = { 1: 2, 2: 22, 3: 32, 4: 83 };

/** Minimum signed bit width that holds every value. */
function signedBits(values: readonly number[], max = 31): number {
  let bits = 1;
  for (const value of values) {
    let needed = 1;
    while (needed < max && (value >= 2 ** (needed - 1) || value < -(2 ** (needed - 1)))) needed += 1;
    if (needed > bits) bits = needed;
  }
  return bits;
}

/** One colour in a `FILLSTYLE`/`LINESTYLE` body: RGB, plus the alpha byte from `DefineShape3` on. */
function writeColor(w: ByteWriter, color: Solid, withAlpha: boolean): void {
  w.u8(color.r).u8(color.g).u8(color.b);
  if (withAlpha) w.u8(color.a ?? 255);
}

/** A solid `FILLSTYLE`: the type byte plus the colour. A `LINESTYLE` has no type byte. */
function writeSolid(w: ByteWriter, color: Solid, withAlpha: boolean): void {
  w.u8(0x00);
  writeColor(w, color, withAlpha);
}

/** `DefineShape`/`2`/`3`/`4` body: bounds, style arrays, style-change + edge records. */
export function defineShape(spec: ShapeSpec): Uint8Array {
  const version = spec.version ?? 2;
  const withAlpha = version >= 3;
  const fills = spec.fills ?? [];
  const lines = spec.lines ?? [];

  const w = new ByteWriter();
  // `defineTag` writes the `UI16` character id itself: the body starts at the bounds rectangle.
  const bounds: Rect = {
    xMin: TW(spec.bounds.x0),
    xMax: TW(spec.bounds.x1),
    yMin: TW(spec.bounds.y0),
    yMax: TW(spec.bounds.y1),
  };
  writeRect(w, bounds);
  if (version === 4) {
    writeRect(w, bounds);
    w.u8(spec.windingRule === true ? 0x04 : 0x00);
  }

  w.u8(fills.length);
  for (const fill of fills) writeSolid(w, fill, withAlpha);
  w.u8(lines.length);
  for (const line of lines) {
    w.u16(TW(line.width));
    if (version === 4) {
      const join = line.join ?? 0;
      w.bits(line.startCap ?? 0, 2)
        .bits(join, 2)
        .bits(0, 1) // HasFillFlag: solid styles only in this corpus
        .bits(0, 1) // NoHScale
        .bits(0, 1) // NoVScale
        .bits(0, 1) // PixelHinting
        .bits(0, 5) // Reserved
        .bits(line.noClose === true ? 1 : 0, 1)
        .bits(line.endCap ?? 0, 2);
      if (join === 2) w.u16(Math.round((line.miterLimit ?? 3) * 256));
    }
    writeColor(w, line.color, withAlpha);
  }

  const fillBits = signedBits([fills.length], 5);
  const lineBits = signedBits([lines.length], 5);
  w.bits(fillBits, 4).bits(lineBits, 4);

  for (const path of spec.paths) {
    const moveX = TW(path.start.x);
    const moveY = TW(path.start.y);
    const moveBits = signedBits([moveX, moveY]);
    w.bits(0, 1) // TypeFlag: style change
      .bits(0, 1) // StateNewStyles
      .bits(path.line === undefined ? 0 : 1, 1) // StateLineStyle
      .bits(path.fill === undefined ? 0 : 1, 1) // StateFillStyle1
      .bits(0, 1) // StateFillStyle0
      .bits(1, 1) // StateMoveTo
      .bits(moveBits, 5)
      .bits(moveX, moveBits)
      .bits(moveY, moveBits);
    if (path.fill !== undefined) w.bits(path.fill, fillBits);
    if (path.line !== undefined) w.bits(path.line, lineBits);

    let penX = moveX;
    let penY = moveY;
    const segments: Segment[] = path.closed === false ? [...path.segments] : [...path.segments, { to: path.start }];
    for (const segment of segments) {
      if ('control' in segment) {
        const controlX = TW(segment.control.x);
        const controlY = TW(segment.control.y);
        const toX = TW(segment.to.x);
        const toY = TW(segment.to.y);
        const bits = signedBits([controlX - penX, controlY - penY, toX - controlX, toY - controlY], 17) + 2;
        w.bits(1, 1) // TypeFlag: edge
          .bits(0, 1) // StraightFlag
          .bits(bits - 2, 4)
          .bits(controlX - penX, bits)
          .bits(controlY - penY, bits)
          .bits(toX - controlX, bits)
          .bits(toY - controlY, bits);
        penX = toX;
        penY = toY;
      } else {
        const toX = TW(segment.to.x);
        const toY = TW(segment.to.y);
        const bits = signedBits([toX - penX, toY - penY], 17) + 2;
        w.bits(1, 1) // TypeFlag: edge
          .bits(1, 1) // StraightFlag
          .bits(bits - 2, 4)
          .bits(1, 1) // GeneralLine
          .bits(toX - penX, bits)
          .bits(toY - penY, bits);
        penX = toX;
        penY = toY;
      }
    }
  }
  w.bits(0, 6); // EndShapeRecord
  w.align();
  return defineTag(TAG_CODE[version], spec.id, w.toUint8Array());
}

/** `SetBackgroundColor` (tag 9). */
export function backgroundColor(color: Solid): Uint8Array {
  return tag(9, new ByteWriter().u8(color.r).u8(color.g).u8(color.b).toUint8Array());
}

/** `RemoveObject2` (tag 28). */
export function removeObject2(depth: number): Uint8Array {
  return tag(28, new ByteWriter().u16(depth).toUint8Array());
}

export interface PlacementSpec {
  readonly depth: number;
  /** Omitted for a move-only placement. */
  readonly characterId?: number;
  readonly move?: boolean;
  /** Translation in pixels. */
  readonly offset?: Pt;
  /** Scale/skew (`1.0` = identity). */
  readonly matrix?: {
    readonly scaleX?: number;
    readonly scaleY?: number;
    readonly rotateSkew0?: number;
    readonly rotateSkew1?: number;
  };
  /** `mult` channels are multipliers around 1.0; `add` channels are −1…1 fractions of full scale. */
  readonly cxform?: {
    readonly mult?: { readonly r?: number; readonly g?: number; readonly b?: number; readonly a?: number };
    readonly add?: { readonly r?: number; readonly g?: number; readonly b?: number; readonly a?: number };
  };
  readonly clipDepth?: number;
  readonly visible?: boolean;
  readonly ratio?: number;
}

/** `PlaceObject2` (26), or `PlaceObject3` (70) when the placement needs `visible`. */
export function place(spec: PlacementSpec): Uint8Array {
  const v3 = spec.visible !== undefined;
  const flags =
    (spec.move === true ? 0x01 : 0) |
    (spec.characterId === undefined ? 0 : 0x02) |
    (spec.matrix !== undefined || spec.offset !== undefined ? 0x04 : 0) |
    (spec.cxform !== undefined ? 0x08 : 0) |
    (spec.ratio !== undefined ? 0x10 : 0) |
    (spec.clipDepth !== undefined ? 0x40 : 0);
  const w = new ByteWriter();
  w.u8(flags);
  if (v3) w.u8(0x40 | 0x20); // HasOpaqueBackground | HasVisible
  w.u16(spec.depth);
  if (spec.characterId !== undefined) w.u16(spec.characterId);
  if (spec.matrix !== undefined || spec.offset !== undefined) writeMatrix(w, spec);
  if (spec.cxform !== undefined) writeCxform(w, spec.cxform);
  if (spec.ratio !== undefined) w.u16(spec.ratio);
  if (spec.clipDepth !== undefined) w.u16(spec.clipDepth);
  if (v3) {
    w.u8(spec.visible === true ? 1 : 0);
    w.u8(0).u8(0).u8(0).u8(0); // OpaqueBackground — decoded and ignored by the static path
  }
  return tag(v3 ? 70 : 26, w.toUint8Array());
}

/** `MATRIX`: scale (a, d), then rotate/skew (c, b), then the translation, all in `FIXED 16.16`. */
function writeMatrix(w: ByteWriter, spec: PlacementSpec): void {
  const a = spec.matrix?.scaleX ?? 1;
  const d = spec.matrix?.scaleY ?? 1;
  const c = spec.matrix?.rotateSkew0 ?? 0;
  const b = spec.matrix?.rotateSkew1 ?? 0;
  const tx = TW(spec.offset?.x ?? 0);
  const ty = TW(spec.offset?.y ?? 0);
  const scale = [a, d].map((value) => Math.round(value * 65536));
  const rotate = [c, b].map((value) => Math.round(value * 65536));
  const scaleBits = signedBits(scale, 31);
  const rotateBits = signedBits(rotate, 31);
  w.bits(1, 1)
    .bits(scaleBits, 5)
    .bits(scale[0] ?? 0, scaleBits)
    .bits(scale[1] ?? 0, scaleBits);
  w.bits(1, 1)
    .bits(rotateBits, 5)
    .bits(rotate[0] ?? 0, rotateBits)
    .bits(rotate[1] ?? 0, rotateBits);
  const translateBits = signedBits([tx, ty], 31);
  w.bits(translateBits, 5).bits(tx, translateBits).bits(ty, translateBits);
  w.align();
}

/** `CXFORMWITHALPHA`: `HasAddTerms`, `HasMultTerms`, `Nbits`, then the terms that are present. */
function writeCxform(w: ByteWriter, cxform: NonNullable<PlacementSpec['cxform']>): void {
  const mult = cxform.mult ?? {};
  const add = cxform.add ?? {};
  const multValues = [mult.r ?? 1, mult.g ?? 1, mult.b ?? 1, mult.a ?? 1].map((value) => Math.round(value * 256));
  const addValues = [add.r ?? 0, add.g ?? 0, add.b ?? 0, add.a ?? 0].map((value) => Math.round(value * 256));
  const hasMult = multValues.some((value) => value !== 256);
  const hasAdd = addValues.some((value) => value !== 0);
  const bits = Math.max(1, Math.min(15, Math.max(signedBits(multValues, 15), signedBits(addValues, 15))));
  w.bits(hasAdd ? 1 : 0, 1)
    .bits(hasMult ? 1 : 0, 1)
    .bits(bits, 4);
  if (hasMult) for (const value of multValues) w.bits(value, bits);
  if (hasAdd) for (const value of addValues) w.bits(value, bits);
  w.align();
}

export interface StaticFixture {
  readonly name: string;
  /** One line naming the rendering rule the fixture exists to pin. */
  readonly covers: string;
  readonly frameCount: number;
  readonly bytes: Uint8Array;
}

const STAGE: Rect = { xMin: 0, xMax: TW(200), yMin: 0, yMax: TW(150) };

const BLACK: Solid = { r: 0, g: 0, b: 0 };
const RED: Solid = { r: 220, g: 40, b: 40 };
const GREEN: Solid = { r: 30, g: 160, b: 70 };
const BLUE: Solid = { r: 40, g: 80, b: 220 };
const YELLOW: Solid = { r: 250, g: 210, b: 40 };
/** 45° in `FIXED 16.16`: hard-coded so the fixture bytes cannot depend on `Math.cos` rounding. */
const COS45 = 46341 / 65536;

function fixture(
  body: readonly Uint8Array[],
  options: { readonly frameCount: number; readonly background?: Solid },
): Uint8Array {
  // `FileAttributes` (69) must be the first tag from SWF 8 on; zero flags is plain AVM1 content.
  const head = [tag(69, new ByteWriter().u32(0).toUint8Array())];
  if (options.background) head.push(backgroundColor(options.background));
  return buildSwf({
    version: 10,
    frameSize: STAGE,
    frameRateRaw: 12 * 256,
    frameCount: options.frameCount,
    body: concat(...head, ...body, endTag()),
  });
}

function rectPath(x0: number, y0: number, x1: number, y1: number, style: { fill?: number; line?: number }): PathSpec {
  return {
    start: { x: x0, y: y0 },
    segments: [{ to: { x: x1, y: y0 } }, { to: { x: x1, y: y1 } }, { to: { x: x0, y: y1 } }],
    ...style,
    closed: true,
  };
}

function solidRect(id: number, x0: number, y0: number, x1: number, y1: number, fill: Solid): Uint8Array {
  return defineShape({
    id,
    bounds: { x0, y0, x1, y1 },
    fills: [fill],
    paths: [rectPath(x0, y0, x1, y1, { fill: 1 })],
  });
}

interface Recipe {
  readonly name: string;
  readonly covers: string;
  readonly frameCount: number;
  build(): Uint8Array;
}

/** The twenty recipes, in golden order. Every movie is scriptless and ends with its `ShowFrame`s. */
const RECIPES: readonly Recipe[] = [
  {
    name: 'solid-rect',
    covers: 'T-GFX-001: integer-positioned opaque fill, exact pixels',
    frameCount: 1,
    build: () =>
      fixture([solidRect(1, 20, 20, 120, 90, RED), place({ depth: 1, characterId: 1 }), showFrames(1)], {
        frameCount: 1,
      }),
  },
  {
    name: 'two-fills-hole',
    covers: 'T-GFX-002: even-odd hole inside one fill style',
    frameCount: 1,
    build: () =>
      fixture(
        [
          defineShape({
            id: 1,
            bounds: { x0: 20, y0: 10, x1: 160, y1: 130 },
            fills: [BLUE],
            paths: [rectPath(20, 10, 160, 130, { fill: 1 }), rectPath(60, 40, 120, 100, { fill: 1 })],
          }),
          place({ depth: 1, characterId: 1 }),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
  {
    name: 'nonzero-hole',
    covers: 'DefineShape4 winding rule fills the hole a second time',
    frameCount: 1,
    build: () =>
      fixture(
        [
          defineShape({
            id: 1,
            version: 4,
            windingRule: true,
            bounds: { x0: 20, y0: 10, x1: 160, y1: 130 },
            fills: [GREEN],
            paths: [rectPath(20, 10, 160, 130, { fill: 1 }), rectPath(60, 40, 120, 100, { fill: 1 })],
          }),
          place({ depth: 1, characterId: 1 }),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
  {
    name: 'quad-curves',
    covers: 'quadratic edges flatten deterministically',
    frameCount: 1,
    build: () =>
      fixture(
        [
          defineShape({
            id: 1,
            bounds: { x0: 20, y0: 20, x1: 180, y1: 130 },
            fills: [GREEN],
            paths: [
              {
                start: { x: 20, y: 90 },
                segments: [
                  { control: { x: 60, y: 20 }, to: { x: 100, y: 90 } },
                  { control: { x: 140, y: 20 }, to: { x: 180, y: 90 } },
                  { to: { x: 100, y: 130 } },
                ],
                fill: 1,
                closed: true,
              },
            ],
          }),
          place({ depth: 1, characterId: 1 }),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
  {
    name: 'stroke-round-caps',
    covers: 'stroke geometry with round caps and joins',
    frameCount: 1,
    build: () =>
      fixture(
        [
          defineShape({
            id: 1,
            version: 4,
            bounds: { x0: 20, y0: 30, x1: 180, y1: 120 },
            lines: [{ width: 8, color: BLACK, startCap: 0, endCap: 0, join: 0 }],
            paths: [
              {
                start: { x: 30, y: 40 },
                segments: [{ to: { x: 170, y: 40 } }, { to: { x: 170, y: 110 } }],
                line: 1,
                closed: false,
              },
            ],
          }),
          place({ depth: 1, characterId: 1 }),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
  {
    name: 'stroke-square-caps',
    covers: 'square caps extend past the endpoint',
    frameCount: 1,
    build: () =>
      fixture(
        [
          defineShape({
            id: 1,
            version: 4,
            bounds: { x0: 20, y0: 30, x1: 180, y1: 120 },
            lines: [{ width: 8, color: BLACK, startCap: 2, endCap: 2, join: 1 }],
            paths: [
              {
                start: { x: 30, y: 40 },
                segments: [{ to: { x: 170, y: 40 } }, { to: { x: 170, y: 110 } }],
                line: 1,
                closed: false,
              },
            ],
          }),
          place({ depth: 1, characterId: 1 }),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
  {
    name: 'stroke-miter-join',
    covers: 'IMPL-130-R015: miter joins honour MiterLimitFactor (ratio units)',
    frameCount: 1,
    build: () =>
      fixture(
        [
          defineShape({
            id: 1,
            version: 4,
            bounds: { x0: 20, y0: 30, x1: 180, y1: 120 },
            lines: [{ width: 10, color: RED, startCap: 1, endCap: 1, join: 2, miterLimit: 3 }],
            paths: [
              {
                start: { x: 40, y: 30 },
                segments: [{ to: { x: 40, y: 110 } }, { to: { x: 160, y: 110 } }],
                line: 1,
                closed: false,
              },
            ],
          }),
          place({ depth: 1, characterId: 1 }),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
  {
    name: 'stroke-bevel-join',
    covers: 'bevel joins cut the corner',
    frameCount: 1,
    build: () =>
      fixture(
        [
          defineShape({
            id: 1,
            version: 4,
            bounds: { x0: 20, y0: 30, x1: 180, y1: 120 },
            lines: [{ width: 10, color: BLUE, startCap: 1, endCap: 1, join: 1 }],
            paths: [
              {
                start: { x: 40, y: 30 },
                segments: [{ to: { x: 40, y: 110 } }, { to: { x: 160, y: 110 } }],
                line: 1,
                closed: false,
              },
            ],
          }),
          place({ depth: 1, characterId: 1 }),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
  {
    name: 'hairline-stroke',
    covers: 'IMPL-130-R015: width-0 hairline renders one device pixel',
    frameCount: 1,
    build: () =>
      fixture(
        [
          defineShape({
            id: 1,
            bounds: { x0: 10, y0: 10, x1: 190, y1: 140 },
            lines: [{ width: 0, color: BLACK }],
            paths: [rectPath(20, 20, 180, 130, { line: 1 })],
          }),
          place({ depth: 1, characterId: 1 }),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
  {
    name: 'cxform-mult',
    covers: 'CXFORM multiply terms scale every channel (alpha included)',
    frameCount: 1,
    build: () =>
      fixture(
        [
          solidRect(1, 20, 20, 120, 120, RED),
          place({ depth: 1, characterId: 1, cxform: { mult: { r: 1, g: 1, b: 1, a: 0.5 } } }),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
  {
    name: 'cxform-add',
    covers: 'CXFORM add terms lighten a black fill',
    frameCount: 1,
    build: () =>
      fixture(
        [
          solidRect(1, 20, 20, 120, 120, BLACK),
          place({ depth: 1, characterId: 1, cxform: { add: { r: 0.4, g: 0.6, b: 0.8, a: 0 } } }),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
  {
    name: 'matrix-scale',
    covers: 'scale matrix: 2× at an integer translation',
    frameCount: 1,
    build: () =>
      fixture(
        [
          solidRect(1, 0, 0, 30, 20, YELLOW),
          place({ depth: 1, characterId: 1, offset: { x: 40, y: 40 }, matrix: { scaleX: 2, scaleY: 2 } }),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
  {
    name: 'matrix-rotate',
    covers: 'rotation matrix: 45° about the shape centre',
    frameCount: 1,
    build: () =>
      fixture(
        [
          solidRect(1, -20, -20, 20, 20, BLUE),
          place({
            depth: 1,
            characterId: 1,
            offset: { x: 100, y: 75 },
            matrix: { scaleX: COS45, scaleY: COS45, rotateSkew0: COS45, rotateSkew1: -COS45 },
          }),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
  {
    name: 'depth-order',
    covers: 'depth order decides which opaque fill wins',
    frameCount: 1,
    build: () =>
      fixture(
        [
          solidRect(1, 20, 20, 140, 120, GREEN),
          solidRect(2, 60, 40, 180, 140, RED),
          place({ depth: 2, characterId: 2 }),
          place({ depth: 5, characterId: 1 }),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
  {
    name: 'sprite-nested',
    covers: 'nesting: a sprite in a sprite composes both matrices',
    frameCount: 1,
    build: () =>
      fixture(
        [
          solidRect(1, 0, 0, 40, 30, RED),
          defineSprite(
            5,
            1,
            concat(place({ depth: 1, characterId: 1, offset: { x: 5, y: 5 } }), showFrames(1), endTag()),
          ),
          defineSprite(
            6,
            1,
            concat(place({ depth: 1, characterId: 5, offset: { x: 10, y: 10 } }), showFrames(1), endTag()),
          ),
          place({ depth: 1, characterId: 6, offset: { x: 30, y: 30 } }),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
  {
    name: 'sprite-loop',
    covers: 'sprite playhead wraps independently of the parent timeline',
    frameCount: 5,
    build: () =>
      fixture(
        [
          solidRect(1, 0, 0, 40, 40, RED),
          solidRect(2, 0, 0, 40, 40, BLUE),
          defineSprite(
            5,
            2,
            concat(
              place({ depth: 1, characterId: 1 }),
              showFrames(1),
              removeObject2(1),
              place({ depth: 1, characterId: 2 }),
              showFrames(1),
              endTag(),
            ),
          ),
          place({ depth: 1, characterId: 5, offset: { x: 20, y: 20 } }),
          showFrames(5),
        ],
        { frameCount: 5 },
      ),
  },
  {
    name: 'clip-mask',
    covers: 'T-GFX-015: a clipDepth masker bounds the depths it covers',
    frameCount: 1,
    build: () =>
      fixture(
        [
          solidRect(1, 0, 0, 60, 50, YELLOW),
          solidRect(2, 0, 0, 160, 120, GREEN),
          place({ depth: 1, characterId: 1, offset: { x: 40, y: 30 }, clipDepth: 4 }),
          place({ depth: 2, characterId: 2, offset: { x: 10, y: 10 } }),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
  {
    name: 'invisible-placement',
    covers: 'PlaceObject3 visible=0 is pruned',
    frameCount: 1,
    build: () =>
      fixture(
        [solidRect(1, 20, 20, 140, 120, RED), place({ depth: 1, characterId: 1, visible: false }), showFrames(1)],
        {
          frameCount: 1,
        },
      ),
  },
  {
    name: 'timeline-frames',
    covers: 'three frames: place, move, remove',
    frameCount: 3,
    build: () =>
      fixture(
        [
          solidRect(1, 0, 0, 40, 40, GREEN),
          place({ depth: 1, characterId: 1, offset: { x: 20, y: 20 } }),
          showFrames(1),
          place({ depth: 1, characterId: 1, move: true, offset: { x: 100, y: 80 } }),
          showFrames(1),
          removeObject2(1),
          showFrames(1),
        ],
        { frameCount: 3 },
      ),
  },
  {
    name: 'stress-grid',
    covers: 'T-GFX-020: 24 placements exercise the batcher and the counters',
    frameCount: 1,
    build: () =>
      fixture(
        [
          solidRect(1, 0, 0, 28, 22, GREEN),
          ...Array.from({ length: 24 }, (_, index) =>
            place({
              depth: index + 1,
              characterId: 1,
              offset: { x: 8 + (index % 6) * 32, y: 8 + Math.floor(index / 6) * 34 },
            }),
          ),
          showFrames(1),
        ],
        { frameCount: 1 },
      ),
  },
];

/** The twenty fixture files, in golden order. Rebuilt deterministically on every call. */
export function staticFixtures(): readonly StaticFixture[] {
  return RECIPES.map((recipe) => ({
    name: recipe.name,
    covers: recipe.covers,
    frameCount: recipe.frameCount,
    bytes: recipe.build(),
  }));
}
