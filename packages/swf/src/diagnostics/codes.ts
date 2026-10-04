/**
 * The `SF####` registry — `IMPL-010` §7. This file is the single place an `SF` number appears as a
 * literal (`IMPL-010-R002`); every other module refers to these constants.
 *
 * Ranges (owner in brackets): `SF0001`–`SF0019` IO (010) · `SF0020`–`SF0049` container (020) ·
 * `SF0100`–`SF0199` tag stream/dictionary (020) · `SF0110`–`SF0129` placements (030) ·
 * `SF0150`–`SF0179` control/metadata (040) · `SF0180`–`SF0195` shapes (060) · `SF0250`–`SF0269` images (070) · `SF0270`–`SF0289` fonts/text (080) ·
 * `SF0300`–`SF0309`/`SF0324`–`SF0332` audio (090) · `SF1000+` fatal (050).
 */

import type { Severity } from './types.js';

export interface CodeInfo {
  readonly code: string;
  readonly severity: Severity;
  readonly meaning: string;
}

export const Codes = {
  // ---- IO (010) -------------------------------------------------------------------------------
  NOT_A_SWF: 'SF0001',
  VERSION_BELOW_BASELINE: 'SF0002',
  DECOMPRESSION_FAILED: 'SF0003',
  DECOMPRESSED_LONGER: 'SF0004',
  DECOMPRESSED_SHORTER: 'SF0005',
  NO_LZMA_DECODER: 'SF0006',
  DECOMPRESSED_OVER_CAP: 'SF0007',
  PADDING_BITS_DISCARDED: 'SF0008',
  ENCODED_U32_OVERLONG: 'SF0009',
  STRING_TRUNCATED: 'SF0010',
  INVALID_UTF8: 'SF0011',
  LEGACY_STRING_ENCODING: 'SF0012',
  READ_PAST_BOUNDS: 'SF0013',
  VALUE_OUT_OF_RANGE: 'SF0014',
  FLOAT16_SPECIAL: 'SF0015',
  BIT_WIDTH_TOO_WIDE: 'SF0016',
  RECT_NBITS_INVALID: 'SF0020',
  // ---- container (020) ------------------------------------------------------------------------
  FRAME_SIZE_OFFSET: 'SF0021',
  FRAME_RATE_IMPLAUSIBLE: 'SF0022',
  FRAME_COUNT_MISMATCH: 'SF0023',
  BYTES_AFTER_END: 'SF0024',
  FILE_ATTRIBUTES_NOT_FIRST: 'SF0025',
  TAG_ORDER_VIOLATION: 'SF0026',
  ZWS_LENGTH_MISMATCH: 'SF0027',
  FILE_LENGTH_IMPLAUSIBLE: 'SF0028',
  FRAME_SIZE_NONPOSITIVE: 'SF0029',
  LONG_HEADER_UNNECESSARY: 'SF0030',
  DICTIONARY_CAP: 'SF0031',
  STREAM_SOUND_OUT_OF_ORDER: 'SF0032',
  NON_CANONICAL_COMPRESSION: 'SF0033',
  // ---- tag stream (020) -----------------------------------------------------------------------
  TAG_PAST_END: 'SF0101',
  MISSING_END: 'SF0102',
  SPRITE_DEPTH_CAP: 'SF0103',
  UNKNOWN_TAG: 'SF0104',
  DEFINITION_ID_ZERO: 'SF0107',
  DUPLICATE_CHARACTER: 'SF0109',
  // ---- placements (030) -----------------------------------------------------------------------
  UNDEFINED_CHARACTER_REF: 'SF0110',
  PLACEMENT_BOUNDS_DEGENERATE: 'SF0111',
  PLACEMENT_DEPTH_DYNAMIC: 'SF0112',
  CLIP_DEPTH_EMPTY: 'SF0113',
  PLACEMENT_RESERVED_BITS: 'SF0114',
  CLIP_ACTIONS_NO_FLAGS: 'SF0115',
  CACHE_AS_BITMAP: 'SF0116',
  PLACEOBJECT_V1_ID_ZERO: 'SF0117',
  CLIP_RECORD_SIZE_MISMATCH: 'SF0118',
  CLIP_ACTIONS_RESERVED: 'SF0119',
  BLEND_MODE_UNKNOWN: 'SF0120',
  FILTER_ID_UNKNOWN: 'SF0121',
  FILTER_PARAM_RANGE: 'SF0122',
  PLACEOBJECT3_BACKING: 'SF0123',
  PLACEOBJECT3_CLASS: 'SF0124',
  CLIP_ACTIONS_NON_SPRITE: 'SF0125',
  PLACEMENT_NOOP: 'SF0126',
  REMOVAL_EMPTY_DEPTH: 'SF0127',
  SPRITE_DEFINITION_TAG: 'SF0128',
  SPRITE_TAG_UNLISTED: 'SF0129',
  // ---- control tags (040) ---------------------------------------------------------------------
  FRAME_LABEL_DUPLICATE: 'SF0153',
  EXPORT_NAME_INVALID: 'SF0154',
  EXPORT_ID_DUPLICATE: 'SF0159',
  EXPORT_NAME_DUPLICATE: 'SF0160',
  IMPORTASSETS_DEPRECATED: 'SF0161',
  IMPORTASSETS2_RESERVED: 'SF0162',
  METADATA_ATTRIBUTES_MISMATCH: 'SF0163',
  METADATA_DUPLICATE: 'SF0164',
  NAMED_ANCHOR_BYTE_INVALID: 'SF0165',
  SETTABINDEX_NO_CHARACTER: 'SF0166',
  SCALING_GRID_BELOW_MIN: 'SF0167',
  SCALING_GRID_TARGET: 'SF0168',
  SCENE_DATA_INCONSISTENT: 'SF0169',
  SCRIPT_LIMITS_IMPLAUSIBLE: 'SF0170',
  // ---- shapes (060) ---------------------------------------------------------------------------
  SHAPE_FILL_TYPE_UNKNOWN: 'SF0180',
  SHAPE_STYLE_INDEX_RANGE: 'SF0181',
  SHAPE_INDEX_WIDTH_INVALID: 'SF0182',
  SHAPE_RECORD_DEGENERATE: 'SF0184',
  SHAPE_EMPTY_SUBPATH: 'SF0185',
  SHAPE_RESERVED_FEATURE: 'SF0191',
  SHAPE_TAG_NEWER_THAN_VERSION: 'SF0183',
  SHAPE_IMPLICIT_CLOSE: 'SF0186',
  SHAPE_BOUNDS_DISAGREE: 'SF0187',
  SHAPE_RESERVED_FLAG_BITS: 'SF0188',
  SHAPE_UNUSED_STYLE: 'SF0189',
  SHAPE_GRADIENT_MODE_INVALID: 'SF0192',
  SHAPE_GRADIENT_EMPTY: 'SF0193',
  SHAPE_GRADIENT_STOP_ORDER: 'SF0194',
  SHAPE_FOCAL_OUTSIDE_V4: 'SF0195',
  SHAPE_STYLE_DEDUPE_CEILING: 'SF0190',
  // ---- fatal (050) ---------------------------------------------------------------------------
  AVM2_CONTENT: 'SF1000',
} as const;

export type CodeName = keyof typeof Codes;
export type Code = (typeof Codes)[CodeName];

const REGISTRY: Record<string, CodeInfo> = {
  SF0001: { code: 'SF0001', severity: 'error', meaning: 'not a SWF (signature mismatch)' },
  SF0002: { code: 'SF0002', severity: 'warning', meaning: 'SWF version below the AVM1 baseline (< 4)' },
  SF0003: { code: 'SF0003', severity: 'error', meaning: 'decompression failed / stream unusable' },
  SF0004: { code: 'SF0004', severity: 'warning', meaning: 'decompressed longer than declared FileLength' },
  SF0005: { code: 'SF0005', severity: 'warning', meaning: 'decompressed shorter than declared FileLength' },
  SF0006: { code: 'SF0006', severity: 'error', meaning: 'ZWS present but no LZMA decoder available' },
  SF0007: { code: 'SF0007', severity: 'error', meaning: 'decompressed output exceeds the configured cap' },
  SF0008: { code: 'SF0008', severity: 'warning', meaning: 'non-zero padding bits discarded by align()' },
  SF0009: { code: 'SF0009', severity: 'info', meaning: 'overlong or 5-byte-overflowing EncodedU32' },
  SF0010: { code: 'SF0010', severity: 'warning', meaning: 'string truncated at the configured cap' },
  SF0011: { code: 'SF0011', severity: 'warning', meaning: 'invalid UTF-8 replaced with U+FFFD' },
  SF0012: { code: 'SF0012', severity: 'info', meaning: 'legacy (<= SWF 5) string decoded with the fallback encoding' },
  SF0013: { code: 'SF0013', severity: 'warning', meaning: 'read beyond the declared bounds (soft mode; value zeroed)' },
  SF0014: { code: 'SF0014', severity: 'info', meaning: 'value outside the documented range' },
  SF0015: { code: 'SF0015', severity: 'info', meaning: 'FLOAT16 NaN/Inf payload canonicalised' },
  SF0016: { code: 'SF0016', severity: 'warning', meaning: 'bit-field width > 32 requested' },
  SF0020: { code: 'SF0020', severity: 'error', meaning: 'RECT Nbits > 31 (corrupt header or shape bounds)' },
  SF0021: { code: 'SF0021', severity: 'warning', meaning: 'header FrameSize has non-zero Xmin/Ymin' },
  SF0022: { code: 'SF0022', severity: 'info', meaning: 'frame rate outside the plausible range (1..240)' },
  SF0023: { code: 'SF0023', severity: 'warning', meaning: 'FrameCount disagrees with the observed ShowFrame count' },
  SF0024: { code: 'SF0024', severity: 'info', meaning: 'trailing bytes after the End tag' },
  SF0025: { code: 'SF0025', severity: 'warning', meaning: 'FileAttributes is not the first tag (SWF >= 8)' },
  SF0026: { code: 'SF0026', severity: 'warning', meaning: 'tag ordering rule violated' },
  SF0027: { code: 'SF0027', severity: 'warning', meaning: 'ZWS compressedLength disagrees with the bytes present' },
  SF0028: { code: 'SF0028', severity: 'warning', meaning: 'FileLength implausible (< 8 or > 2 GiB)' },
  SF0029: { code: 'SF0029', severity: 'error', meaning: 'FrameSize has non-positive width or height' },
  SF0030: { code: 'SF0030', severity: 'info', meaning: 'long header used although the body is < 63 bytes' },
  SF0031: { code: 'SF0031', severity: 'error', meaning: 'dictionary entry cap exceeded' },
  SF0032: { code: 'SF0032', severity: 'warning', meaning: 'streaming sound tags out of order' },
  SF0033: { code: 'SF0033', severity: 'info', meaning: 'non-canonical compression (e.g. CWS below version 6)' },
  SF0101: { code: 'SF0101', severity: 'warning', meaning: 'tag body extends past the end of the stream' },
  SF0102: { code: 'SF0102', severity: 'info', meaning: 'missing End tag (end inferred from the stream length)' },
  SF0103: { code: 'SF0103', severity: 'warning', meaning: 'sprite nesting deeper than 32 (sub-stream abandoned)' },
  SF0104: { code: 'SF0104', severity: 'info', meaning: 'unknown tag code skipped by length' },
  SF0107: { code: 'SF0107', severity: 'warning', meaning: 'definition tag with character id 0 (ignored)' },
  SF0109: {
    code: 'SF0109',
    severity: 'warning',
    meaning: 'duplicate character id (last definition wins; earlier definition remains reachable as a shadowed entry)',
  },
  SF0110: { code: 'SF0110', severity: 'warning', meaning: 'placement references an undefined character' },
  SF0111: { code: 'SF0111', severity: 'warning', meaning: 'inverted/degenerate RECT while assembling bounds' },
  SF0113: {
    code: 'SF0113',
    severity: 'warning',
    meaning: 'clip-depth value does not exceed its own depth (mask is empty)',
  },
  SF0114: { code: 'SF0114', severity: 'info', meaning: 'unknown placement/filter/clip-event bits, preserved raw' },
  SF0116: { code: 'SF0116', severity: 'info', meaning: 'CacheAsBitmap set, or implied by a filter list' },
  SF0112: {
    code: 'SF0112',
    severity: 'info',
    meaning: 'placement depth in the conventionally dynamic range (>= 16384)',
  },
  SF0115: { code: 'SF0115', severity: 'warning', meaning: 'clip actions present but no handler flags set' },
  SF0118: { code: 'SF0118', severity: 'warning', meaning: 'CLIPACTIONRECORD declared size disagrees with its content' },
  SF0119: { code: 'SF0119', severity: 'warning', meaning: 'CLIPACTIONS reserved field or end flag is not zero' },
  SF0121: { code: 'SF0121', severity: 'warning', meaning: 'reserved/unknown filter id (8-255)' },
  SF0122: { code: 'SF0122', severity: 'warning', meaning: 'filter parameter outside its documented range' },
  SF0117: { code: 'SF0117', severity: 'info', meaning: 'PlaceObject v1 with CharacterId = 0 (tolerated move; E-010)' },
  SF0120: { code: 'SF0120', severity: 'warning', meaning: 'unknown blend mode value (15-255), treated as normal' },
  SF0123: {
    code: 'SF0123',
    severity: 'info',
    meaning: 'PlaceObject3 backing fields present (visible/opaque background)',
  },
  SF0124: {
    code: 'SF0124',
    severity: 'warning',
    meaning: 'PlaceObject3 class-name/image fields in AVM1 content - inert',
  },
  SF0125: { code: 'SF0125', severity: 'warning', meaning: 'clip actions on a non-sprite character' },
  SF0126: { code: 'SF0126', severity: 'warning', meaning: 'PlaceObject* with neither Move nor HasCharacter (no-op)' },
  SF0127: { code: 'SF0127', severity: 'info', meaning: 'removal at a depth that is empty (strict-timeline mode)' },
  SF0128: {
    code: 'SF0128',
    severity: 'warning',
    meaning: 'definition tag inside a sprite (ignored for the dictionary)',
  },
  SF0129: {
    code: 'SF0129',
    severity: 'info',
    meaning: 'tag inside a sprite outside the chapter list (decoded normally)',
  },
  SF0153: { code: 'SF0153', severity: 'warning', meaning: 'duplicate frame label (first wins for lookups)' },
  SF0154: {
    code: 'SF0154',
    severity: 'warning',
    meaning: 'export/SymbolClass name empty or invalid (sanitised for the manifest)',
  },
  SF0159: { code: 'SF0159', severity: 'warning', meaning: 'duplicate export character id (later name wins, per Ch.4)' },
  SF0160: { code: 'SF0160', severity: 'warning', meaning: 'duplicate export name (first id wins, our policy)' },
  SF0161: {
    code: 'SF0161',
    severity: 'warning',
    meaning: 'ImportAssets (57) in a SWF 8+ file: deprecated and ignored by FP 8+',
  },
  SF0162: { code: 'SF0162', severity: 'warning', meaning: 'ImportAssets2 reserved bytes are not 1, 0' },
  SF0163: { code: 'SF0163', severity: 'warning', meaning: 'Metadata tag and FileAttributes.HasMetadata disagree' },
  SF0164: { code: 'SF0164', severity: 'warning', meaning: 'more than one Metadata tag (first kept)' },
  SF0165: {
    code: 'SF0165',
    severity: 'warning',
    meaning: 'FrameLabel named-anchor byte present with a value other than 1',
  },
  SF0166: { code: 'SF0166', severity: 'info', meaning: 'SetTabIndex at a depth with no character (ignored, per Ch.4)' },
  SF0167: {
    code: 'SF0167',
    severity: 'warning',
    meaning: 'DefineScalingGrid splitter below one twip per side (ignored)',
  },
  SF0168: {
    code: 'SF0168',
    severity: 'warning',
    meaning: 'DefineScalingGrid target is not a sprite/button or is unknown (dropped)',
  },
  SF0169: {
    code: 'SF0169',
    severity: 'warning',
    meaning: 'scene data inconsistent (offsets out of order or beyond the frame count)',
  },
  SF0170: {
    code: 'SF0170',
    severity: 'warning',
    meaning: 'ScriptLimits value outside the supported window (clamped/recorded)',
  },
  SF0180: { code: 'SF0180', severity: 'error', meaning: 'unknown FillStyleType (shape quarantined)' },
  SF0181: { code: 'SF0181', severity: 'error', meaning: 'style index beyond the array (clamped to 0)' },
  SF0182: { code: 'SF0182', severity: 'error', meaning: 'shape style index width greater than 16' },
  SF0184: { code: 'SF0184', severity: 'warning', meaning: 'degenerate or version-inconsistent shape record' },
  SF0185: { code: 'SF0185', severity: 'info', meaning: 'shape subpath with no edges (dropped)' },
  SF0190: {
    code: 'SF0190',
    severity: 'warning',
    meaning: 'style array at the extended-count ceiling with byte-identical styles (dedupe deferred)',
  },
  SF0191: { code: 'SF0191', severity: 'info', meaning: 'chapter-reserved feature used by a later shape version' },
  SF0183: { code: 'SF0183', severity: 'info', meaning: 'shape tag newer than the declared SWF version (tolerated)' },
  SF0186: { code: 'SF0186', severity: 'warning', meaning: 'style run not explicitly closed; implicit close applied' },
  SF0187: { code: 'SF0187', severity: 'warning', meaning: 'declared bounds disagree with recomputed bounds beyond 1%' },
  SF0188: { code: 'SF0188', severity: 'info', meaning: 'reserved DefineShape4 flag bits non-zero (preserved)' },
  SF0189: { code: 'SF0189', severity: 'info', meaning: 'unused style, or the practical edge-count ceiling exceeded' },
  SF0192: { code: 'SF0192', severity: 'warning', meaning: 'gradient modes invalid for the tag version or reserved' },
  SF0193: { code: 'SF0193', severity: 'error', meaning: 'NumGradients == 0 (empty ramp; fill dropped)' },
  SF0194: { code: 'SF0194', severity: 'warning', meaning: 'gradient control points out of ratio order or duplicated' },
  SF0195: { code: 'SF0195', severity: 'info', meaning: 'FOCALGRADIENT used outside DefineShape4 (tolerated)' },
  SF1000: { code: 'SF1000', severity: 'error', meaning: 'AVM2 content (DoABC) — hard error, exit 3' },
};

export function codeInfo(code: string): CodeInfo | undefined {
  return REGISTRY[code];
}

export function registeredCodes(): readonly string[] {
  return Object.keys(REGISTRY).sort();
}
