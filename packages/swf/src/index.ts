/**
 * `@swf-forge/swf` — the reader package (`TECH-SPEC` §3.3).
 *
 * Barrel only: no logic lives here. Every name below is re-exported from the module that owns it, so
 * the public surface is one reviewable list (`IMPL-020-R001`). Consumers outside this package import
 * from `@swf-forge/swf` and never from a deep path.
 */

// ---- diagnostics (`IMPL-010` §7) ---------------------------------------------------------------
export { Codes, codeInfo, registeredCodes } from './diagnostics/codes.js';
export { DiagnosticSink } from './diagnostics/sink.js';
export type { Code, CodeInfo, CodeName } from './diagnostics/codes.js';
export type { Diagnostic, DiagnosticInput, DiagnosticSummary, Severity } from './diagnostics/types.js';

// ---- binary IO (`IMPL-010`) ---------------------------------------------------------------------
export { Cursor } from './io/cursor.js';
export { SwfReadError } from './io/errors.js';
export { fixed8_8, fixed16_16, float16 } from './io/real.js';
export { maskFor, signExtend } from './io/bits.js';
export { encodedU32 } from './io/integers.js';
export { readMatrix, readCxform, readCxformWithAlpha, readRect } from './io/records.js';
export { readArgb, readRgb, readRgba, readLanguageCode } from './io/colour.js';
export { decodeLegacy, decodeString, decodeUtf8 } from './io/strings.js';
export {
  IDENTITY_CXFORM,
  IDENTITY_MATRIX,
  LanguageCode,
  TWIPS_PER_PIXEL,
  decomposeMatrix,
  toPixels,
} from './io/types.js';
export type { CursorOptions } from './io/cursor.js';
export type { EncodedU32Result } from './io/integers.js';
export type { DecodedString, StringReadOptions } from './io/strings.js';
export type { Cxform, Mat2D, MatrixDecomposition, Rect, Rgba } from './io/types.js';

// ---- container (`IMPL-020`) ---------------------------------------------------------------------
export { openSwf, openSwfAsync } from './container/open.js';
export { buildTagIndex, readTagHeader } from './container/tag-stream.js';
export { SIGNATURES, compressionOf, parseHeader } from './container/header.js';
export type { SwfFile, SwfOpenOptions, TagPayload, InflateResult } from './container/open.js';
export type { Compression, HeaderResult, SwfHeader } from './container/header.js';
export type {
  DefinitionEntry,
  SpriteRange,
  TagIndex,
  TagRef,
  TagStreamOptions,
  TagStreamResult,
} from './container/tag-stream.js';

// ---- tag codes ----------------------------------------------------------------------------------
export { Tag, isKnownTag, tagInfo, tagName } from './tags/tag-codes.js';
export type { TagInfo } from './tags/tag-codes.js';

// ---- shapes (`IMPL-060`) ------------------------------------------------------------------------
export { decodeDefineShapeVersion, readShapeWithStyle } from './tags/shape.js';
export type {
  DefineShapeResult,
  Edge,
  FillPath,
  FillStyle,
  Gradient,
  GradientStop,
  LineStyle,
  ShapeDecodeResult,
  ShapeVersion,
  StrokePath,
  VectorShape,
} from './tags/shape.js';

// ---- placement and control tags (`IMPL-030`, `IMPL-040`) ----------------------------------------
export {
  BLEND_MODES,
  decodePlaceObject,
  decodePlaceObject2,
  decodePlaceObject3,
  decodeRemoveObject,
  decodeRemoveObject2,
} from './tags/place.js';
export { decodeFileAttributes, decodeFrameLabel, decodeSetBackgroundColor } from './tags/control.js';
export type { ActionBlockRef, PlacementOp, PlacementTag, RemovalOp, TimelineOp } from './tags/place.js';
export type { FileAttributesInfo } from './tags/control.js';
