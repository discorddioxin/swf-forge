/**
 * `@swf-forge/gfx` — vector geometry, coverage rasterisation and the reference frame renderer
 * (`GFX`). The GPU backend (`GFX` §3.1) plugs into the same draw items; this package keeps the
 * geometry, fill-rule and coverage rules in one place so both backends can be checked against them.
 *
 * The renderer consumes Vector IR only: importing `@swf-forge/swf` here is a lint error
 * (`IMPL-130-R001`).
 */

// ---- vector IR ----------------------------------------------------------------------------------
export {
  distanceToLine,
  flattenEdge,
  flattenPath,
  isDegenerate,
  pointBounds,
  quadPointAt,
  segmentsForQuadratic,
} from './vector/flatten.js';
export type { FlattenOptions } from './vector/flatten.js';
export type {
  Cap,
  DrawPath,
  Edge,
  FillGeometry,
  FillRule,
  Join,
  LinearEdge,
  Paint,
  Pt,
  QuadraticEdge,
  ShapeGeometry,
  SolidPaint,
  StrokeGeometry,
} from './vector/geometry.js';

// ---- rasterisation ------------------------------------------------------------------------------
export { blendPixel, createTarget, readPixel, toHex } from './raster/image.js';
export type { RasterImage, RasterTarget, Rgb, Rgba } from './raster/image.js';
export { fillPolygon, fillRun } from './raster/scanline.js';
export type { ClipRect, FillRunOptions } from './raster/scanline.js';
export { dedupe, strokePolygons } from './raster/stroke.js';
export type { StrokeStyle } from './raster/stroke.js';

// ---- scene and renderer -------------------------------------------------------------------------
export { IDENTITY, applyOps, collectDrawItems, multiply, transformPoint, transformScale } from './render/scene.js';
export type {
  CharacterResolver,
  CxformLike,
  DisplayEntry,
  DrawItem,
  FlattenSceneOptions,
  PlacementOpLike,
  RemovalOpLike,
  ResolvedCharacter,
  TimelineOpLike,
  Transform2D,
} from './render/scene.js';
export { applyCxform, renderFrame } from './render/renderer.js';
export type { FrameOptions } from './render/renderer.js';

// ---- output -------------------------------------------------------------------------------------
export { encodePng } from './image/png.js';
