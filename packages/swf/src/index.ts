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
export { checkTagOrdering } from './container/ordering.js';
export { ProcessStep, PROCESSING_ORDER } from './container/processing.js';
export type { ProcessStep as ProcessStepName } from './container/processing.js';
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
export { readFilterList } from './tags/filters.js';
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
// Geometry pipeline stages 5 and 6 (`IMPL-060-R034`-`R038`).
export { isQuantised, quantiseScalar, quantiseShape } from './shapes/quantise.js';
export type { QuantiseOptions } from './shapes/quantise.js';
export { simplifyShape } from './shapes/simplify.js';
export type { SimplifyOptions, SimplifyResult, SimplifyStats } from './shapes/simplify.js';
export { canonicalVectorShape, serialiseVectorShape, vectorShapeDigest } from './shapes/serialise.js';
export { decodeDefineBitmap } from './tags/images.js';
export type { BitmapAssetModel, BitmapSource, LosslessBitmapFormat } from './tags/images.js';
export {
  applyFontInfo,
  csmCutoffs,
  decodeCsmTextSettings,
  decodeDefineFont2or3,
  decodeDefineFontV1,
  decodeFontAlignZones,
  decodeFontInfo,
  decodeFontName,
} from './tags/fonts.js';
export type {
  CsmTextSettingsModel,
  DefineFontModel,
  DefineFontV1Model,
  FontAlignZonesModel,
  FontGlyphModel,
  FontInfoModel,
  FontKerningPair,
  FontNameModel,
  FontZoneData,
  FontZoneRecord,
} from './tags/fonts.js';
export { decodeDefineMorphShape } from './tags/morph.js';
export type { MorphEdgePair, MorphShapeModel } from './tags/morph.js';
// Morph interpolation + the ratio-bake decision (`IMPL-070-R030`-`R032`).
export { bakeMorphRatios, interpolateMorph, roundTiesToEven } from './shapes/morph-ir.js';
export type {
  MorphBakeOptions,
  MorphBakeResult,
  MorphBakedFrame,
  MorphEmit,
  MorphInterpolateOptions,
} from './shapes/morph-ir.js';
export { decodeDefineEditText, decodeDefineText, recoverStaticTextCodes } from './tags/text.js';
export type {
  EditTextFlags,
  EditTextLayoutModel,
  EditTextModel,
  StaticTextModel,
  StaticTextRunModel,
  TextGlyphModel,
  TextRecoveryDiagnostic,
  TextRecoveryResult,
} from './tags/text.js';
export {
  SOUND_SAMPLE_RATES,
  decodeDefineSound,
  decodeStartSound,
  decodeSoundStreamHead,
  decodeSoundStreamBlock,
} from './tags/sounds.js';
export type {
  DefineSoundModel,
  SoundEnvelopePoint,
  SoundFormat,
  SoundInfoModel,
  SoundStreamBlockModel,
  SoundStreamHeadModel,
  StartSoundModel,
  TimelineSoundEvent,
} from './tags/sounds.js';

// ---- model (`CMP` §3, `IMPL-030` §7/§8, `IMPL-040` §5) ------------------------------------------
export { assembleTimeline, buildMovieModel, fallbackId, openTagCursor } from './model/index.js';
export type {
  ButtonActionRecord,
  ButtonConditions,
  ButtonModel,
  ButtonRecord,
  ButtonSoundInfo,
  ButtonSoundRecord,
  ButtonState,
  CharacterAlias,
  CharacterKind,
  CharacterModel,
  DisplayOp,
  FileAttributesModel,
  Fixed8_8,
  FrameModel,
  ImportEntry,
  InitActionBlock,
  MovieControlModel,
  MovieModel,
  SetTabIndexOp,
  SpriteModel,
  StageModel,
  StreamSoundBlockRecord,
  StreamSoundModel,
  StreamSoundSpan,
  TimelineModel,
} from './model/index.js';
export type { AssembleTimelineOptions } from './model/index.js';
export type { BuildMovieOptions } from './model/index.js';
export {
  BUTTON_TRANSITIONS,
  buttonRecordsForState,
  buttonTransitionsForTracking,
  matrixIsSingular,
  transformRect,
  unionRects,
} from './model/buttons.js';
export type { ButtonTransition } from './model/buttons.js';

// ---- placement and control tags (`IMPL-030`, `IMPL-040`) ----------------------------------------
export { decodeClipActions, decodeClipEventFlags } from './tags/clip-actions.js';
export {
  decodeDefineButton,
  decodeDefineButton2,
  decodeButtonRecord,
  decodeDefineButtonCxform,
  decodeDefineButtonSound,
  isDocumentedButtonKeyCode,
} from './tags/buttons.js';
export {
  BLEND_MODES,
  decodePlaceObject,
  decodePlaceObject2,
  decodePlaceObject3,
  decodeRemoveObject,
  decodeRemoveObject2,
} from './tags/place.js';
export {
  decodeDefineScalingGrid,
  decodeDoInitAction,
  decodeExportAssets,
  decodeFileAttributes,
  decodeFrameLabel,
  decodeImportAssets,
  decodeMetadata,
  decodeProtect,
  decodeSceneAndFrameLabelData,
  decodeScriptLimits,
  decodeSetBackgroundColor,
  decodeSetTabIndex,
  decodeSymbolClass,
} from './tags/control.js';
export type { ActionBlockRef, PlacementOp, PlacementTag, RemovalOp, TimelineOp } from './tags/place.js';
export type { ClipActionRecord, ClipActions, ClipEventFlags } from './tags/clip-actions.js';
export type { ButtonCxformTag, ButtonSoundTag, ParsedButton } from './tags/buttons.js';
export type {
  BevelFilterSpec,
  BlurFilterSpec,
  ColorMatrixFilterSpec,
  ConvolutionFilterSpec,
  DropShadowFilterSpec,
  FilterListResult,
  FilterSpec,
  GlowFilterSpec,
  GradientGlowFilterSpec,
  UnknownFilterSpec,
} from './tags/filters.js';
export type { AssetPair, ExportAssetsResult, FileAttributesInfo } from './tags/control.js';
