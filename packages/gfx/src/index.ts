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
export type { MutableRgba, RasterImage, RasterTarget, Rgb, Rgba } from './raster/image.js';
export { createFillScratch, fillPolygon, fillRun } from './raster/scanline.js';
export type { ClipRect, FillRunOptions, FillScratch } from './raster/scanline.js';
export { dedupe, strokePolygons } from './raster/stroke.js';
export type { StrokeStyle } from './raster/stroke.js';

// ---- scene and renderer -------------------------------------------------------------------------
export {
  IDENTITY,
  applyOps,
  collectDrawItems,
  intersectClip,
  multiply,
  shapeClip,
  transformPoint,
  transformScale,
} from './render/scene.js';
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
export { applyCxform, applyCxformInto, renderFrame } from './render/renderer.js';
export type { FrameOptions } from './render/renderer.js';
export { createFrameRenderer } from './render/frame-renderer.js';
export type { FrameRenderer, FrameRendererOptions } from './render/frame-renderer.js';
export {
  MeshCache,
  RunCache,
  buildMeshRuns,
  buildShapeRuns,
  cacheKey,
  coverQuad,
  meshRunsFrom,
} from './render/mesh.js';
export type { MeshOptions, ShapeRun } from './render/mesh.js';
export { beginFrame, createStats, endFrame, statsSnapshot } from './render/stats.js';
export type { RenderStats } from './render/stats.js';

// ---- static (no-VM) scene bundles ---------------------------------------------------------------
export {
  STATIC_SCENE_FORMAT,
  STATIC_SCENE_VERSION,
  SCENE_IDENTITY,
  SceneFormatError,
  parseStaticScene,
  sceneDrawItems,
  serializeStaticScene,
} from './static/scene.js';
export type { StaticScene, StaticSceneItem, StaticSceneStage } from './static/scene.js';

// ---- tessellation and the WebGL2 backend --------------------------------------------------------
export { FloatBuffer, boundsOf, coverQuadOf, fanTriangles } from './vector/tessellate.js';
export type { MeshRun } from './vector/tessellate.js';
export { GL, GlProgramError, createGlRenderer } from './gl/backend.js';
export { BatchPlanner } from './gl/batcher.js';
export type { DrawBatch } from './gl/batcher.js';
export type { GlContextLike, GlRenderer, GlRendererOptions } from './gl/backend.js';
export { FRAGMENT_SHADER, VERTEX_SHADER } from './gl/shaders.js';

// ---- output -------------------------------------------------------------------------------------
export { encodePng } from './image/png.js';
