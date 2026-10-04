/**
 * Placement tags — `IMPL-030` §4 (Ch.3), field order pinned by `APP-§10.1`.
 *
 * `PlaceObject` (v1) carries a `CXFORM` (no alpha) iff the body extends past the matrix;
 * `PlaceObject2`/`3` read one or two flag bytes and then the fields in an order *different* from the
 * flag order. `Ratio` is UI16, not UI8. A matrix in a *move* tag replaces the previous transform.
 *
 * Filters (`FILTERLIST`), clip actions and the PlaceObject3 backing fields are separate work packages
 * (`WP-030-04`, `WP-030-05`); until they land, clip actions are handed on as a byte range
 * (`ActionBlockRef`) and a filter list stops the walk with an explicit diagnostic.
 */

import { Codes } from '../diagnostics/codes.js';
import type { Cursor } from '../io/cursor.js';
import { readCxform, readCxformWithAlpha, readMatrix } from '../io/records.js';
import type { Cxform, Mat2D, Rgba } from '../io/types.js';

/** Byte range handed to the AVM1 front end (`IMPL-030-R029`). */
export interface ActionBlockRef {
  readonly offset: number;
  readonly length: number;
}

export type PlacementTag = 'PlaceObject' | 'PlaceObject2' | 'PlaceObject3';

export interface PlacementOp {
  readonly kind: 'place';
  readonly tag: PlacementTag;
  readonly index: number;
  readonly depth: number;
  readonly move: boolean;
  /** null => no character change ("move" of an existing object). */
  readonly characterId: number | null;
  readonly name: string | null;
  readonly matrix: Mat2D | null;
  readonly cxform: Cxform | null;
  /** 0..65535 morph ratio. */
  readonly ratio: number | null;
  readonly clipDepth: number | null;
  readonly className: string | null;
  readonly blendMode: number | null;
  readonly bitmapCache: number | null;
  readonly visible: boolean | null;
  readonly opaqueBackground: Rgba | null;
  /** Byte range of the CLIPACTIONS block, for doc 050; null when absent. */
  readonly clipActions: ActionBlockRef | null;
  /** Offset of the tag body, for reports and source maps. */
  readonly tagOffset: number;
}

export interface RemovalOp {
  readonly kind: 'remove';
  readonly index: number;
  readonly tag: 'RemoveObject' | 'RemoveObject2';
  readonly depth: number;
  readonly tagOffset: number;
}

export type TimelineOp = PlacementOp | RemovalOp;

export const BLEND_MODES = [
  'normal', 'normal', 'layer', 'multiply', 'screen', 'lighten', 'darken', 'difference', 'add',
  'subtract', 'invert', 'alpha', 'erase', 'overlay', 'hardlight',
] as const;

interface DecodeContext {
  readonly c: Cursor;
  readonly index: number;
  readonly tagOffset: number;
  /** True when the placed character is known to be a sprite (doc 030 §8); null when unknown. */
  readonly characterIsSprite?: boolean | null;
}

function placementBase(ctx: DecodeContext, tag: PlacementTag): Omit<PlacementOp, 'depth' | 'move'> {
  return {
    kind: 'place',
    tag,
    index: ctx.index,
    characterId: null,
    name: null,
    matrix: null,
    cxform: null,
    ratio: null,
    clipDepth: null,
    className: null,
    blendMode: null,
    bitmapCache: null,
    visible: null,
    opaqueBackground: null,
    clipActions: null,
    tagOffset: ctx.tagOffset,
  };
}

/** `PlaceObject` (4) — v1. */
export function decodePlaceObject(c: Cursor, index: number, tagOffset: number): PlacementOp {
  const ctx: DecodeContext = { c, index, tagOffset };
  const base = placementBase(ctx, 'PlaceObject');
  const characterId = c.u16();
  const depth = c.u16();
  const matrix = readMatrix(c);
  let cxform: Cxform | null = null;
  const remaining = c.limit - c.offset;
  if (remaining >= 3) {
    cxform = readCxform(c);
  } else if (remaining !== 0) {
    c.emit(Codes.VALUE_OUT_OF_RANGE, 'info', `PlaceObject tail has ${remaining} byte(s); not enough for a CXFORM`);
    c.seek(c.limit);
  }
  let move = false;
  if (characterId === 0) {
    c.emit(Codes.PLACEOBJECT_V1_ID_ZERO, 'info', 'PlaceObject v1 with CharacterId 0 tolerated as a move (E-010)');
    move = true;
  }
  return { ...base, depth, move, characterId: characterId === 0 ? null : characterId, matrix, cxform };
}

/** `PlaceObject2` (26). */
export function decodePlaceObject2(c: Cursor, index: number, tagOffset: number): PlacementOp {
  const ctx: DecodeContext = { c, index, tagOffset };
  const base = placementBase(ctx, 'PlaceObject2');
  const flags = c.u8();
  const hasClipActions = (flags & 0x80) !== 0;
  const hasClipDepth = (flags & 0x40) !== 0;
  const hasName = (flags & 0x20) !== 0;
  const hasRatio = (flags & 0x10) !== 0;
  const hasCxform = (flags & 0x08) !== 0;
  const hasMatrix = (flags & 0x04) !== 0;
  const hasCharacter = (flags & 0x02) !== 0;
  const move = (flags & 0x01) !== 0;

  const depth = c.u16();
  const characterId = hasCharacter ? c.u16() : null;
  const matrix = hasMatrix ? readMatrix(c) : null;
  const cxform = hasCxform ? readCxformWithAlpha(c) : null;
  const ratio = hasRatio ? c.u16() : null;
  const name = hasName ? c.string() : null;
  const clipDepth = hasClipDepth ? c.u16() : null;

  if (clipDepth !== null && clipDepth !== 0 && clipDepth <= depth) {
    c.emit(Codes.CLIP_DEPTH_EMPTY, 'warning', `ClipDepth ${clipDepth} does not exceed Depth ${depth}; the mask range is empty`);
  }
  if (depth >= 16384) {
    c.emit(Codes.PLACEMENT_DEPTH_DYNAMIC, 'info', `placement depth ${depth} is in the conventionally dynamic range`);
  }
  if (!move && characterId === null) {
    c.emit(Codes.PLACEMENT_NOOP, 'warning', 'PlaceObject* with neither Move nor HasCharacter is a no-op');
  }

  const start = c.offset;
  const clipActions: ActionBlockRef | null = hasClipActions ? { offset: start, length: Math.max(0, c.limit - start) } : null;
  return { ...base, depth, move, characterId, matrix, cxform, ratio, name, clipDepth, clipActions };
}

const BLEND_MODE_MAX = 14;

/** `PlaceObject3` (70) — first flag byte (v2's), then the second flag byte, then the body. */
export function decodePlaceObject3(c: Cursor, index: number, tagOffset: number): PlacementOp {
  const ctx: DecodeContext = { c, index, tagOffset };
  const v2 = c.u8();
  const hasClipActions = (v2 & 0x80) !== 0;
  const hasClipDepth = (v2 & 0x40) !== 0;
  const hasName = (v2 & 0x20) !== 0;
  const hasRatio = (v2 & 0x10) !== 0;
  const hasCxform = (v2 & 0x08) !== 0;
  const hasMatrix = (v2 & 0x04) !== 0;
  const hasCharacter = (v2 & 0x02) !== 0;
  const move = (v2 & 0x01) !== 0;

  const v3 = c.u8();
  const reserved = (v3 & 0x80) !== 0;
  const hasOpaqueBackground = (v3 & 0x40) !== 0;
  const hasVisible = (v3 & 0x20) !== 0;
  const hasImage = (v3 & 0x10) !== 0;
  const hasClassName = (v3 & 0x08) !== 0;
  const hasCacheAsBitmap = (v3 & 0x04) !== 0;
  const hasBlendMode = (v3 & 0x02) !== 0;
  const hasFilterList = (v3 & 0x01) !== 0;
  if (reserved) {
    c.emit(Codes.PLACEMENT_RESERVED_BITS, 'info', 'PlaceObject3 reserved flag bit set (preserved)');
  }

  const depth = c.u16();
  const className = hasClassName || (hasImage && hasCharacter) ? c.string() : null;
  if (className !== null) {
    c.emit(Codes.PLACEOBJECT3_CLASS, 'warning', 'PlaceObject3 class-name/image fields are AVM2-era; decoded and inert in AVM1 content');
  }
  const characterId = hasCharacter ? c.u16() : null;
  const matrix = hasMatrix ? readMatrix(c) : null;
  const cxform = hasCxform ? readCxformWithAlpha(c) : null;
  const ratio = hasRatio ? c.u16() : null;
  const name = hasName ? c.string() : null;
  const clipDepth = hasClipDepth ? c.u16() : null;

  if (hasFilterList) {
    c.emit(
      Codes.PLACEOBJECT3_BACKING,
      'info',
      'PlaceObject3 filter list present; the remaining backing fields are decoded by WP-030-04 — the rest of this body is left undecoded',
    );
    return {
      ...placementBase(ctx, 'PlaceObject3'),
      depth,
      move,
      characterId,
      matrix,
      cxform,
      ratio,
      name,
      clipDepth,
      className,
    };
  }

  const blendMode = hasBlendMode ? c.u8() : null;
  if (blendMode !== null && blendMode > BLEND_MODE_MAX) {
    c.emit(Codes.BLEND_MODE_UNKNOWN, 'warning', `unknown blend mode value ${blendMode} treated as normal`);
  }
  const bitmapCache = hasCacheAsBitmap ? c.u8() : null;
  if (bitmapCache !== null && bitmapCache !== 0) {
    c.emit(Codes.CACHE_AS_BITMAP, 'info', 'CacheAsBitmap set on this placement');
  }
  const visible = hasVisible ? c.u8() !== 0 : null;
  let opaqueBackground: Rgba | null = null;
  if (hasOpaqueBackground) {
    const r = c.u8();
    const g = c.u8();
    const b = c.u8();
    const a = c.u8();
    opaqueBackground = { r, g, b, a };
  } else if (hasVisible) {
    c.emit(Codes.PLACEOBJECT3_BACKING, 'info', 'HasVisible without OpaqueBackground: no colour consumed (E-008)');
  }
  if (opaqueBackground || visible !== null) {
    c.emit(Codes.PLACEOBJECT3_BACKING, 'info', 'PlaceObject3 backing fields present (visible/opaque background)');
  }
  const start = c.offset;
  const clipActions: ActionBlockRef | null = hasClipActions ? { offset: start, length: Math.max(0, c.limit - start) } : null;

  return {
    ...placementBase(ctx, 'PlaceObject3'),
    depth,
    move,
    characterId,
    matrix,
    cxform,
    ratio,
    name,
    clipDepth,
    className,
    blendMode,
    bitmapCache,
    visible,
    opaqueBackground,
    clipActions,
  };
}

/** `RemoveObject` (5): `CharacterId UI16`, `Depth UI16`. */
export function decodeRemoveObject(c: Cursor, index: number, tagOffset: number): RemovalOp {
  const characterId = c.u16();
  const depth = c.u16();
  if (characterId !== 0 && c.limit - c.offset >= 2) {
    c.emit(Codes.VALUE_OUT_OF_RANGE, 'info', 'RemoveObject body carries trailing bytes');
    c.seek(c.limit);
  }
  return { kind: 'remove', index, tag: 'RemoveObject', depth, tagOffset };
}

/** `RemoveObject2` (28): `Depth UI16`. */
export function decodeRemoveObject2(c: Cursor, index: number, tagOffset: number): RemovalOp {
  const depth = c.u16();
  return { kind: 'remove', index, tag: 'RemoveObject2', depth, tagOffset };
}
