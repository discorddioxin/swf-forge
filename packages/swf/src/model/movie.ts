/**
 * `MovieModel` assembly — the S2 "analyse" artifact of `CMP` §4.3, built from the container layer.
 *
 * Three passes over the top-level tags: control tags (background, exports, scenes, metadata,
 * script limits, file attributes, init actions), then the dictionary with one nested timeline per
 * `DefineSprite`, then the main timeline (which also reports frame labels back to the control model).
 * Nothing here re-reads a tag body twice for two different purposes, and nothing mutates the file.
 */

import type { SwfFile } from '../container/open.js';
import type { TagRef } from '../container/tag-stream.js';
import { Cursor } from '../io/cursor.js';
import { DiagnosticSink } from '../diagnostics/sink.js';
import { readRect } from '../io/records.js';
import { Codes } from '../diagnostics/codes.js';
import {
  decodeDefineBinaryData,
  decodeDefineScalingGrid,
  decodeDoInitAction,
  decodeEnableDebugger,
  decodeEnableDebugger2,
  decodeEnableTelemetry,
  decodeExportAssets,
  decodeFileAttributes,
  decodeFrameLabel,
  decodeImportAssets,
  decodeMetadata,
  decodeProtect,
  decodeSceneAndFrameLabelData,
  decodeScriptLimits,
  decodeSetBackgroundColor,
  decodeSymbolClass,
  type FileAttributesInfo,
  type PasswordState,
} from '../tags/control.js';
import {
  decodeDefineButton,
  decodeDefineButton2,
  decodeDefineButtonCxform,
  decodeDefineButtonSound,
} from '../tags/buttons.js';
import { fnv1a64Hex } from '../io/hash.js';
import { Tag, tagName } from '../tags/tag-codes.js';
import { decodeDefineShapeVersion } from '../tags/shape.js';
import { decodeDefineSound } from '../tags/sounds.js';
import { decodeDefineBitmap } from '../tags/images.js';
import { decodeDefineMorphShape } from '../tags/morph.js';
import {
  applyFontInfo,
  decodeCsmTextSettings,
  decodeDefineFont2or3,
  decodeDefineFontV1,
  decodeFontAlignZones,
  decodeFontInfo,
  decodeFontName,
} from '../tags/fonts.js';
import type { FontInfoEmit } from '../tags/fonts.js';
import { decodeDefineEditText, decodeDefineText, recoverStaticTextCodes } from '../tags/text.js';
import { openTagCursor, assembleTimeline } from './timeline.js';
import { matrixIsSingular, transformRect, unionRects, isRectDegenerate } from './buttons.js';
import type {
  ButtonModel,
  CharacterAlias,
  CharacterKind,
  CharacterModel,
  FileAttributesModel,
  ImportEntry,
  InitActionBlock,
  MovieControlModel,
  MovieModel,
  SetTabIndexOp,
  SpriteModel,
} from './types.js';
import type { Rect } from '../io/types.js';

export interface BuildMovieOptions {
  readonly mode?: 'soft' | 'strict';
  /**
   * `--strict-timeline`: a removal at an empty depth is reported (`SF0127`, info) instead of being
   * a silent no-op. Off by default — Ch.4 makes the removal a no-op; the flag is for auditing.
   */
  readonly strictTimeline?: boolean;
  /** External SWFs keyed by their exact published URL; only these files participate in import linking. */
  readonly imports?: ReadonlyMap<string, SwfFile>;
  /** Overrides the content-derived id (a caller-supplied `sha256:<hex>`, say). */
  readonly id?: string;
}

const BUTTON_TAGS: ReadonlySet<number> = new Set([Tag.DefineButton, Tag.DefineButton2]);
const BITMAP_TAGS: ReadonlySet<number> = new Set([
  Tag.DefineBits,
  Tag.DefineBitsJPEG2,
  Tag.DefineBitsJPEG3,
  Tag.DefineBitsJPEG4,
  Tag.DefineBitsLossless,
  Tag.DefineBitsLossless2,
]);
const STATIC_SHAPE_TAGS: ReadonlySet<number> = new Set([
  Tag.DefineShape,
  Tag.DefineShape2,
  Tag.DefineShape3,
  Tag.DefineShape4,
]);

function characterKindForTag(tagCode: number): Exclude<CharacterKind, 'missing'> {
  switch (tagCode) {
    case Tag.DefineShape:
    case Tag.DefineShape2:
    case Tag.DefineShape3:
      return 'shape';
    case Tag.DefineShape4:
      return 'shape4';
    case Tag.DefineMorphShape:
    case Tag.DefineMorphShape2:
      return 'morphShape';
    case Tag.DefineSprite:
      return 'sprite';
    case Tag.DefineButton:
    case Tag.DefineButton2:
      return 'button';
    case Tag.DefineText:
    case Tag.DefineText2:
      return 'text';
    case Tag.DefineEditText:
      return 'editText';
    case Tag.DefineFont:
      return 'font';
    case Tag.DefineFont2:
      return 'font2';
    case Tag.DefineFont3:
      return 'font3';
    case Tag.DefineFont4:
      return 'font4';
    case Tag.DefineBits:
    case Tag.DefineBitsJPEG2:
    case Tag.DefineBitsJPEG3:
    case Tag.DefineBitsJPEG4:
      return 'bitmap';
    case Tag.DefineBitsLossless:
    case Tag.DefineBitsLossless2:
      return 'bitmapLossless';
    case Tag.DefineSound:
      return 'sound';
    case Tag.DefineVideoStream:
      return 'video';
    case Tag.DefineBinaryData:
      return 'binaryData';
    default:
      return 'unknown';
  }
}

function rgbToNumber(color: { r: number; g: number; b: number }): number {
  return (color.r << 16) | (color.g << 8) | color.b;
}

/**
 * Fallback content id when the caller passed no `sha256`: FNV-1a 64 over the decompressed size plus a
 * bounded head/tail sample of the body. Deliberately cheap (a synchronous model build must not hash
 * tens of megabytes twice) and deliberately *content*-derived — never a timestamp or a path.
 */
export function fallbackId(body: Uint8Array, prefix: unknown): string {
  const sample = 4096;
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mix = (value: number): void => {
    hash ^= BigInt(value & 0xff);
    hash = (hash * prime) & 0xffffffffffffffffn;
  };
  for (const value of JSON.stringify(prefix)
    .split('')
    .map((ch) => ch.charCodeAt(0)))
    mix(value);
  for (let i = 0; i < body.length && i < sample; i += 1) mix(body[i] ?? 0);
  for (let i = Math.max(0, body.length - sample); i < body.length; i += 1) mix(body[i] ?? 0);
  for (let shift = 0; shift < 4; shift += 1) mix((body.length >>> (shift * 8)) & 0xff);
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}

interface RawImportEntry {
  readonly url: string;
  readonly name: string;
  readonly localId: number;
  readonly tagCode: number;
  readonly ignored: boolean;
  readonly origin: TagRef;
}

interface ControlPass {
  control: Omit<MovieControlModel, 'labels' | 'tabIndexOps' | 'labelEntries'>;
  rawImports: RawImportEntry[];
  initActions: InitActionBlock[];
  labels: Map<string, { frame: number; namedAnchor: boolean }[]>;
  labelEntries: { name: string; frame: number; namedAnchor: boolean }[];
  protect: PasswordState | null;
  debugger: MovieControlModel['debugger'];
  telemetry: MovieControlModel['telemetry'];
  binaryData: MovieControlModel['binaryData'];
  unknownExportIds: Set<number>;
  binaryBytes: Map<number, Uint8Array>;
  jpegTables: Uint8Array | null;
}

function normalizeScenes(
  scenes: readonly { name: string; frameOffset: number }[],
  frameCount: number,
  c: ReturnType<typeof openTagCursor>,
): { name: string; frameOffset: number }[] {
  const normalized: { name: string; frameOffset: number }[] = [];
  let previousRaw = -1;
  let previousOffset = 0;
  for (let i = 0; i < scenes.length; i += 1) {
    const scene = scenes[i];
    if (!scene) continue;
    const context = { context: `scene data entry ${i}`, characterId: null };
    if (i === 0 && scene.frameOffset !== 0) {
      c.emit(
        Codes.SCENE_DATA_INCONSISTENT,
        'warning',
        `first scene starts at ${scene.frameOffset}, not 0`,
        c.offset,
        context,
      );
    }
    if (i > 0 && scene.frameOffset <= previousRaw) {
      c.emit(
        Codes.SCENE_DATA_INCONSISTENT,
        'warning',
        scene.frameOffset === previousRaw
          ? `scene "${scene.name}" repeats offset ${scene.frameOffset}`
          : `scene "${scene.name}" starts before the prior scene`,
        c.offset,
        context,
      );
    }
    if (scene.frameOffset > frameCount) {
      c.emit(
        Codes.SCENE_DATA_INCONSISTENT,
        'warning',
        `scene "${scene.name}" offset ${scene.frameOffset} exceeds frame count ${frameCount}`,
        c.offset,
        context,
      );
    }
    const bounded = Math.min(scene.frameOffset, frameCount);
    const frameOffset = i === 0 ? 0 : Math.max(previousOffset, bounded);
    normalized.push({ name: scene.name, frameOffset });
    previousRaw = scene.frameOffset;
    previousOffset = frameOffset;
  }
  return normalized;
}

function collectControl(file: SwfFile, topRefs: readonly TagRef[], mode: 'soft' | 'strict'): ControlPass {
  let background = 0xffffff;
  let backgroundSource: 'default' | 'tag' = 'default';
  const backgroundChanges: { frame: number; rgb: number }[] = [];
  const scenes: { name: string; frameOffset: number }[] = [];
  const labels = new Map<string, { frame: number; namedAnchor: boolean }[]>();
  const tagLabelEntries: { name: string; frame: number; namedAnchor: boolean }[] = [];
  const sceneLabelEntries: { name: string; frame: number; namedAnchor: boolean }[] = [];
  const exports = new Map<string, number>();
  const exportsById = new Map<number, string>();
  const imports: ImportEntry[] = [];
  const rawImports: RawImportEntry[] = [];
  const scalingGrids = new Map<number, Rect>();
  /** Shadowed rects from repeated `DefineScalingGrid` tags (last wins; reported per `IMPL-040-R028`). */
  const scalingGridsShadowed: { characterId: number; rect: Rect }[] = [];
  /** Export/`SymbolClass` ids not in the dictionary (`SF0174` → `missing` placeholder, R015). */
  const unknownExportIds = new Set<number>();
  /** `SymbolClass` pairs with their tag, for the `SF0179` binary-character check (R038). */
  const symbolClassPairs: { id: number; name: string; ref: TagRef }[] = [];
  let sawDoABC = false;
  /** `DefineBinaryData` payloads by character id (last wins), for the `binary` asset (R038). */
  const binaryBytes = new Map<number, Uint8Array>();
  const initActions: InitActionBlock[] = [];
  /** DoInitAction count per sprite id, for `SF0421` (duplicate) and `SF0422` (unknown sprite). */
  const doInitCounts = new Map<number, number>();
  /** `SF0422` checks the whole dictionary (`IMPL-050-R015`): an id not defined at all is dropped. */
  const definedIds = new Set(file.definitions.map((definition) => definition.id));
  let rootClassName: string | null = null;
  let scriptLimits: { maxRecursionDepth: number | null; scriptTimeout: number | null } = {
    maxRecursionDepth: null,
    scriptTimeout: null,
  };
  let attributes: FileAttributesModel | null = null;
  let metadataXmp: string | null = null;
  let metadataTag: TagRef | null = null;
  let protect: PasswordState | null = null;
  let debuggerTag: MovieControlModel['debugger'] = null;
  let telemetry: MovieControlModel['telemetry'] = null;
  let jpegTables: Uint8Array | null = null;
  let jpegTablesCount = 0;
  let jpegTablesFirstHeader = 0;
  const binaryData: {
    readonly characterId: number;
    readonly reserved: number;
    readonly length: number;
    readonly digest: string;
  }[] = [];
  let frame = 0;

  const mergeExports = (byName: ReadonlyMap<string, number>, byId: ReadonlyMap<number, string>): void => {
    for (const [name, id] of byName) {
      if (!exports.has(name)) exports.set(name, id);
    }
    for (const [id, name] of byId) exportsById.set(id, name);
  };

  for (const ref of topRefs) {
    const c = openTagCursor(file, ref, mode);
    switch (ref.code) {
      case Tag.ShowFrame:
        frame += 1;
        break;
      case Tag.SetBackgroundColor: {
        const rgb = rgbToNumber(decodeSetBackgroundColor(c).color);
        background = rgb;
        backgroundSource = 'tag';
        backgroundChanges.push({ frame, rgb });
        break;
      }
      case Tag.JPEGTables: {
        jpegTablesCount += 1;
        if (jpegTablesCount === 1) {
          jpegTables = file.body.subarray(ref.offset, ref.offset + ref.length);
          jpegTablesFirstHeader = ref.headerOffset;
        } else if (jpegTablesCount === 2) {
          c.emit(
            Codes.IMAGE_MULTIPLE_JPEG_TABLES,
            'warning',
            `multiple JPEGTables tags (first at offset ${jpegTablesFirstHeader}); first wins`,
            ref.headerOffset,
            { context: 'control tags', tagCode: ref.code, characterId: null },
          );
        }
        break;
      }
      case Tag.ExportAssets: {
        const result = decodeExportAssets(c);
        mergeExports(result.byName, result.byId);
        for (const pair of result.pairs) {
          if (!definedIds.has(pair.id) && !unknownExportIds.has(pair.id)) {
            unknownExportIds.add(pair.id);
            file.sink.emit({
              code: Codes.EXPORT_ID_UNDEFINED,
              severity: 'info',
              message: `ExportAssets names character ${pair.id}, which is not in the dictionary (missing placeholder)`,
              offset: ref.headerOffset,
              context: 'control tags',
              tagCode: Tag.ExportAssets,
            });
          }
        }
        break;
      }
      case Tag.SymbolClass: {
        const result = decodeSymbolClass(c);
        rootClassName = result.rootClassName;
        mergeExports(result.byName, result.byId);
        for (const pair of result.pairs) {
          if (!definedIds.has(pair.id) && !unknownExportIds.has(pair.id)) {
            unknownExportIds.add(pair.id);
            file.sink.emit({
              code: Codes.EXPORT_ID_UNDEFINED,
              severity: 'info',
              message: `SymbolClass names character ${pair.id}, which is not in the dictionary (missing placeholder)`,
              offset: ref.headerOffset,
              context: 'control tags',
              tagCode: Tag.SymbolClass,
            });
          }
          symbolClassPairs.push({ id: pair.id, name: pair.name, ref });
        }
        break;
      }
      case Tag.ImportAssets:
      case Tag.ImportAssets2: {
        const { url, entries, deprecated } = decodeImportAssets(c, ref.code);
        for (const entry of entries) {
          imports.push({
            url,
            name: entry.name,
            localId: entry.id,
            applied: false,
            sourceMovieId: null,
            sourceId: null,
          });
          rawImports.push({
            url,
            name: entry.name,
            localId: entry.id,
            tagCode: ref.code,
            ignored: deprecated,
            origin: ref,
          });
        }
        break;
      }
      case Tag.DefineScalingGrid: {
        const { characterId, splitter } = decodeDefineScalingGrid(c);
        if (splitter.xMax - splitter.xMin < 1 || splitter.yMax - splitter.yMin < 1) break;
        const target = [...file.definitions].reverse().find((d) => d.id === characterId);
        if (!target || (target.tagCode !== Tag.DefineSprite && !BUTTON_TAGS.has(target.tagCode))) {
          c.emit(
            Codes.SCALING_GRID_TARGET,
            'warning',
            `scaling grid target ${characterId} is ${target ? tagName(target.tagCode) : 'unknown'}; dropped`,
          );
          break;
        }
        // Repeated tags: the last one wins and the shadowed rect is reported (`IMPL-040-R028`) —
        // retained in the model the same way shadowed exports are (no dedicated code assigned).
        const prior = scalingGrids.get(characterId);
        if (prior !== undefined) scalingGridsShadowed.push({ characterId, rect: prior });
        scalingGrids.set(characterId, splitter);
        break;
      }
      case Tag.ScriptLimits: {
        const limits = decodeScriptLimits(c);
        scriptLimits = { maxRecursionDepth: limits.maxRecursionDepth, scriptTimeout: limits.scriptTimeout };
        break;
      }
      case Tag.FileAttributes: {
        const info = decodeFileAttributes(c);
        attributes = { ...info, origin: ref };
        if (file.header.version >= 8 && topRefs[0] !== ref) {
          c.emit(
            Codes.FILE_ATTRIBUTES_NOT_FIRST_MODEL,
            'warning',
            `FileAttributes is not the first tag (it is top-level tag #${topRefs.indexOf(ref) + 1})`,
            ref.headerOffset,
          );
        }
        if (info.as3) {
          c.emit(
            Codes.AVM2_CONTENT,
            'error',
            `FileAttributes AS3 flag indicates AVM2 content at tag offset ${ref.headerOffset}`,
            ref.headerOffset,
          );
        }
        break;
      }
      case Tag.DoABC:
        sawDoABC = true;
        c.emit(
          Codes.AVM2_CONTENT,
          'error',
          `DoABC tag indicates AVM2 content at offset ${ref.headerOffset}`,
          ref.headerOffset,
        );
        break;
      case Tag.Metadata: {
        const { xmp } = decodeMetadata(c);
        if (metadataTag !== null) {
          c.emit(Codes.METADATA_DUPLICATE, 'warning', 'more than one Metadata tag; the first is kept');
          break;
        }
        metadataTag = ref;
        metadataXmp = xmp;
        break;
      }
      case Tag.Protect: {
        protect = decodeProtect(c);
        break;
      }
      case Tag.EnableDebugger: {
        const state = decodeEnableDebugger(c);
        debuggerTag = { version: 1, reserved: null, passwordPresent: state.passwordPresent, digest: state.digest };
        break;
      }
      case Tag.EnableDebugger2: {
        const state = decodeEnableDebugger2(c);
        debuggerTag = {
          version: 2,
          reserved: state.reserved,
          passwordPresent: state.passwordPresent,
          digest: state.digest,
        };
        break;
      }
      case Tag.EnableTelemetry: {
        telemetry = decodeEnableTelemetry(c);
        break;
      }
      case Tag.DefineBinaryData: {
        const { characterId, reserved, bytes } = decodeDefineBinaryData(c);
        binaryData.push({ characterId, reserved, length: bytes.length, digest: fnv1a64Hex(bytes) });
        binaryBytes.set(characterId, bytes);
        break;
      }
      case Tag.DefineSceneAndFrameLabelData: {
        const data = decodeSceneAndFrameLabelData(c);
        scenes.push(...normalizeScenes(data.scenes, file.header.frameCount, c));
        for (const entry of data.labels) {
          const label = { name: entry.name, frame: entry.frame, namedAnchor: false };
          sceneLabelEntries.push(label);
          const list = labels.get(entry.name) ?? [];
          list.push({ frame: entry.frame, namedAnchor: false });
          labels.set(entry.name, list);
        }
        break;
      }
      case Tag.DoInitAction: {
        const { spriteId, block } = decodeDoInitAction(c);
        const seen = doInitCounts.get(spriteId) ?? 0;
        doInitCounts.set(spriteId, seen + 1);
        if (seen > 0) {
          // `IMPL-050-R013`: the invariant is reported, not enforced — all execute in tag order.
          file.sink.emit({
            code: Codes.DUPLICATE_DOINITACTION,
            severity: 'warning',
            message: `sprite ${spriteId} has ${seen + 1} DoInitAction tags; all execute in tag order`,
            offset: ref.headerOffset,
            context: 'control tags',
            tagCode: Tag.DoInitAction,
          });
        }
        if (!definedIds.has(spriteId)) {
          // `IMPL-050-R015`: never reachable, so it is dropped from the model.
          file.sink.emit({
            code: Codes.DOINITACTION_UNKNOWN_SPRITE,
            severity: 'warning',
            message: `DoInitAction for sprite ${spriteId}, which is not in the dictionary (dropped)`,
            offset: ref.headerOffset,
            context: 'control tags',
            tagCode: Tag.DoInitAction,
          });
          break;
        }
        initActions.push({ spriteId, block, index: ref });
        break;
      }
      case Tag.FrameLabel: {
        const { name, namedAnchor } = decodeFrameLabel(c);
        tagLabelEntries.push({ name, frame, namedAnchor });
        const list = labels.get(name) ?? [];
        list.push({ frame, namedAnchor });
        labels.set(name, list);
        break;
      }
      default:
        break;
    }
  }

  // `Metadata` and `FileAttributes.HasMetadata` are a biconditional (`IMPL-040-R035`).
  const hasMetadataTag = metadataTag !== null;
  const flagged = (attributes as FileAttributesInfo | null)?.hasMetadata ?? false;
  if (hasMetadataTag !== flagged) {
    const message = hasMetadataTag
      ? 'Metadata tag present but FileAttributes.HasMetadata is not set'
      : 'FileAttributes.HasMetadata is set but no Metadata tag is present';
    file.sink.emit({
      code: Codes.METADATA_ATTRIBUTES_MISMATCH,
      severity: 'warning',
      message,
      offset: metadataTag?.headerOffset ?? 0,
      context: 'control tags',
      ...(metadataTag ? { tagCode: Tag.Metadata } : {}),
    });
  }

  // `IMPL-040-R038`: a `SymbolClass` entry naming a `DefineBinaryData` character in AVM1 content
  // is inert and reported once (`SF0179`, info). In an AVM2 movie the class is `DoABC`'s concern
  // and `SF1000` already fired, so the check only applies to AVM1 content.
  const isAvm2Content = (attributes as FileAttributesInfo | null)?.as3 === true || sawDoABC;
  if (!isAvm2Content && symbolClassPairs.length > 0) {
    const binaryIds = new Set(file.definitions.filter((d) => d.tagCode === Tag.DefineBinaryData).map((d) => d.id));
    const reported = new Set<number>();
    for (const pair of symbolClassPairs) {
      if (binaryIds.has(pair.id) && !reported.has(pair.id)) {
        reported.add(pair.id);
        file.sink.emit({
          code: Codes.SYMBOLCLASS_BINARY_DATA,
          severity: 'info',
          message: `SymbolClass name "${pair.name}" points at binary character ${pair.id} (inert in AVM1 content)`,
          offset: pair.ref.headerOffset,
          context: 'control tags',
          tagCode: Tag.SymbolClass,
        });
      }
    }
  }

  const metadata: Record<string, string> = {};
  if (metadataXmp !== null) metadata['xmp'] = metadataXmp;
  const sceneFrameRemap = scenes.map((scene, sceneIndex) => {
    const frameOffset = Math.min(scene.frameOffset, file.header.frameCount);
    const nextOffset = scenes[sceneIndex + 1]?.frameOffset ?? file.header.frameCount;
    const endFrame = Math.min(nextOffset, file.header.frameCount);
    return { sceneIndex, frameOffset, frameCount: Math.max(0, endFrame - frameOffset) };
  });

  return {
    control: {
      background,
      backgroundSource,
      backgroundChanges,
      scenes,
      sceneFrameRemap,
      exports,
      exportsById,
      rootClassName,
      imports,
      scalingGrids,
      scalingGridsShadowed,
      scriptLimits,
      attributes,
      metadata,
      protect,
      debugger: debuggerTag,
      telemetry,
      binaryData,
      jpegTables,
    },
    initActions,
    rawImports,
    labels,
    labelEntries: [...tagLabelEntries, ...sceneLabelEntries],
    protect,
    debugger: debuggerTag,
    telemetry,
    binaryData,
    unknownExportIds,
    binaryBytes,
    jpegTables,
  };
}

interface LinkageIndex {
  readonly exports: ReadonlyMap<string, number>;
  readonly imports: readonly RawImportEntry[];
}

const linkageCache = new WeakMap<SwfFile, LinkageIndex>();

function stableMovieId(file: SwfFile, override?: string): string {
  return (
    override ??
    (file.sha256.length > 0
      ? `sha256:${file.sha256}`
      : fallbackId(file.body, {
          signature: file.header.compression,
          version: file.header.version,
          fileLength: file.header.fileLength,
          frames: file.header.frameCount,
        }))
  );
}

function isolatedTagCursor(file: SwfFile, ref: TagRef): Cursor {
  return new Cursor(file.body, ref.offset, ref.offset + ref.length, {
    mode: 'soft',
    sink: new DiagnosticSink(),
    context: 'import resolution',
    version: file.header.version,
    tagCode: ref.code,
  });
}

/** Build just the dictionary linkage needed to resolve an external movie; no model or actions run. */
function readLinkageIndex(file: SwfFile): LinkageIndex {
  const cached = linkageCache.get(file);
  if (cached !== undefined) return cached;
  const exports = new Map<string, number>();
  const imports: RawImportEntry[] = [];
  for (const ref of file.tagIndex.tags) {
    if (ref.inSprite !== null) continue;
    const c = isolatedTagCursor(file, ref);
    if (ref.code === Tag.ExportAssets || ref.code === Tag.SymbolClass) {
      const decoded = ref.code === Tag.ExportAssets ? decodeExportAssets(c) : decodeSymbolClass(c);
      for (const [name, id] of decoded.byName) if (!exports.has(name)) exports.set(name, id);
    } else if (ref.code === Tag.ImportAssets || ref.code === Tag.ImportAssets2) {
      const decoded = decodeImportAssets(c, ref.code);
      for (const entry of decoded.entries) {
        imports.push({
          url: decoded.url,
          name: entry.name,
          localId: entry.id,
          tagCode: ref.code,
          ignored: decoded.deprecated,
          origin: ref,
        });
      }
    }
  }
  const result = { exports, imports };
  linkageCache.set(file, result);
  return result;
}

function normalizeLinkageUrl(value: string): string {
  return value.replace(/^([A-Za-z][A-Za-z0-9+.-]*):/, (_whole, scheme: string) => `${scheme.toLowerCase()}:`);
}

function lookupImportFile(inputs: ReadonlyMap<string, SwfFile>, url: string): SwfFile | undefined {
  const normalized = normalizeLinkageUrl(url);
  for (const [candidate, file] of inputs) {
    if (normalizeLinkageUrl(candidate) === normalized) return file;
  }
  return undefined;
}

interface ResolvedSource {
  readonly state: 'resolved' | 'missing' | 'cycle';
  readonly movieId: string | null;
  readonly characterId: number | null;
  readonly cycleIds?: readonly string[];
}

function resolveImportedSymbol(
  url: string,
  name: string,
  inputs: ReadonlyMap<string, SwfFile>,
  active: readonly SwfFile[],
): ResolvedSource {
  const target = lookupImportFile(inputs, url);
  if (!target) return { state: 'missing', movieId: null, characterId: null };
  if (active.includes(target)) {
    return {
      state: 'cycle',
      movieId: null,
      characterId: null,
      cycleIds: [...active, target].map((item) => stableMovieId(item)),
    };
  }
  const linkage = readLinkageIndex(target);
  const sourceId = linkage.exports.get(name);
  if (sourceId === undefined) return { state: 'missing', movieId: null, characterId: null };

  let hasDefinition = false;
  for (let i = target.definitions.length - 1; i >= 0; i -= 1) {
    if (target.definitions[i]?.id === sourceId) {
      hasDefinition = true;
      break;
    }
  }
  if (hasDefinition) {
    return { state: 'resolved', movieId: stableMovieId(target), characterId: sourceId };
  }

  let alias: RawImportEntry | undefined;
  for (let i = linkage.imports.length - 1; i >= 0; i -= 1) {
    const candidate = linkage.imports[i];
    if (candidate?.localId === sourceId && !candidate.ignored) {
      alias = candidate;
      break;
    }
  }
  if (alias === undefined) return { state: 'missing', movieId: null, characterId: null };
  return resolveImportedSymbol(alias.url, alias.name, inputs, [...active, target]);
}

function resolveMovieImports(
  file: SwfFile,
  entries: readonly RawImportEntry[],
  inputs: ReadonlyMap<string, SwfFile>,
): ImportEntry[] {
  return entries.map((entry) => {
    if (entry.ignored) {
      return {
        url: entry.url,
        name: entry.name,
        localId: entry.localId,
        applied: false,
        sourceMovieId: null,
        sourceId: null,
      };
    }
    const resolved = resolveImportedSymbol(entry.url, entry.name, inputs, [file]);
    if (resolved.state === 'cycle') {
      file.sink.emit({
        code: Codes.IMPORT_ALIAS_CYCLE,
        severity: 'error',
        message: `import ${entry.name} from ${entry.url} participates in an alias cycle: ${(resolved.cycleIds ?? []).join(' -> ')}`,
        offset: entry.origin.headerOffset,
        context: 'control tags',
        tagCode: entry.tagCode,
        characterId: entry.localId,
      });
    } else if (resolved.state === 'missing') {
      file.sink.emit({
        code: Codes.IMPORT_UNRESOLVED,
        severity: 'warning',
        message: `import "${entry.name}" from "${entry.url}" is unresolved; local id ${entry.localId} is a missing placeholder`,
        offset: entry.origin.headerOffset,
        context: 'control tags',
        tagCode: entry.tagCode,
        characterId: entry.localId,
      });
    }
    return {
      url: entry.url,
      name: entry.name,
      localId: entry.localId,
      applied: resolved.state === 'resolved',
      sourceMovieId: resolved.movieId,
      sourceId: resolved.characterId,
    };
  });
}

function characterBounds(
  file: SwfFile,
  definition: SwfFile['definitions'][number],
  mode: 'soft' | 'strict',
): Rect | null {
  const ref = file.tagIndex.tags[definition.tagIndex];
  if (!ref) return null;
  const morphTags: ReadonlySet<number> = new Set([Tag.DefineMorphShape, Tag.DefineMorphShape2]);
  if (!morphTags.has(definition.tagCode)) return null;
  const c = openTagCursor(file, ref, mode);
  c.u16();
  const start = readRect(c);
  return unionRects([start, readRect(c)]);
}

function missingCharacter(id: number): CharacterModel {
  return {
    id,
    kind: 'missing',
    tagCode: null,
    tagName: 'missing',
    index: null,
    sprite: null,
    button: null,
    bounds: null,
    vectorShape: null,
    morph: null,
    bitmap: null,
    font: null,
    fontV1: null,
    fontInfo: null,
    fontAlignZones: null,
    fontName: null,
    text: null,
    editText: null,
    csmTextSettings: null,
    sound: null,
    alias: null,
    bytes: null,
  };
}

function emitButtonReferenceMissing(file: SwfFile, origin: TagRef, ownerId: number, characterId: number): void {
  file.sink.emit({
    code: Codes.UNDEFINED_CHARACTER_REF,
    severity: 'warning',
    message: `button ${ownerId} references undefined character ${characterId}; missing placeholder created`,
    offset: origin.headerOffset,
    context: 'button character reference',
    tagCode: origin.code,
    characterId,
  });
}

function emitButtonAuxTargetError(file: SwfFile, origin: TagRef, buttonId: number, message: string): void {
  file.sink.emit({
    code: Codes.BUTTON_AUX_TARGET_NOT_BUTTON,
    severity: 'warning',
    message,
    offset: origin.headerOffset,
    context: 'button auxiliary tag',
    tagCode: origin.code,
    characterId: buttonId,
  });
}

function assembleButtons(
  file: SwfFile,
  topRefs: readonly TagRef[],
  control: ControlPass['control'],
  characters: Map<number, CharacterModel>,
  mode: 'soft' | 'strict',
): void {
  const parsed = new Map<
    number,
    { definition: ReturnType<typeof decodeDefineButton> | ReturnType<typeof decodeDefineButton2>; origin: TagRef }
  >();
  const cxforms = new Map<
    number,
    { transform: ReturnType<typeof decodeDefineButtonCxform>['transform']; origin: TagRef }
  >();
  const sounds = new Map<number, { records: ReturnType<typeof decodeDefineButtonSound>['sounds']; origin: TagRef }>();

  for (const ref of topRefs) {
    if (ref.code !== Tag.DefineButton && ref.code !== Tag.DefineButton2) continue;
    const c = openTagCursor(file, ref, mode);
    const definition = ref.code === Tag.DefineButton ? decodeDefineButton(c, ref) : decodeDefineButton2(c, ref);
    parsed.set(definition.id, { definition, origin: ref });
  }

  for (const ref of topRefs) {
    if (ref.code === Tag.DefineButtonCxform) {
      const c = openTagCursor(file, ref, mode);
      const decoded = decodeDefineButtonCxform(c);
      const target = parsed.get(decoded.buttonId);
      if (target === undefined) {
        emitButtonAuxTargetError(
          file,
          ref,
          decoded.buttonId,
          `DefineButtonCxform targets non-button character ${decoded.buttonId}`,
        );
      } else if (target.definition.version !== 1) {
        emitButtonAuxTargetError(
          file,
          ref,
          decoded.buttonId,
          `DefineButtonCxform targets DefineButton2 character ${decoded.buttonId}; the tag applies only to v1 buttons`,
        );
      } else {
        cxforms.set(decoded.buttonId, { transform: decoded.transform, origin: ref });
      }
    } else if (ref.code === Tag.DefineButtonSound) {
      const c = openTagCursor(file, ref, mode);
      const decoded = decodeDefineButtonSound(c);
      const target = parsed.get(decoded.buttonId);
      if (target === undefined) {
        emitButtonAuxTargetError(
          file,
          ref,
          decoded.buttonId,
          `DefineButtonSound targets non-button character ${decoded.buttonId}`,
        );
      } else {
        sounds.set(decoded.buttonId, { records: decoded.sounds, origin: ref });
      }
    }
  }

  // Resolve all referenced dictionary ids only after the full dictionary pass.
  for (const [buttonId, entry] of parsed) {
    for (const record of entry.definition.records) {
      const referenced = characters.get(record.characterId);
      if (referenced === undefined || referenced.kind === 'missing') {
        emitButtonReferenceMissing(file, entry.origin, buttonId, record.characterId);
        if (referenced === undefined) characters.set(record.characterId, missingCharacter(record.characterId));
      }
    }
  }

  const soundIds = new Set(
    [...characters.values()].filter((character) => character.kind === 'sound').map((character) => character.id),
  );
  for (const [buttonId, entry] of sounds) {
    for (const record of entry.records) {
      if (!soundIds.has(record.soundId)) {
        file.sink.emit({
          code: Codes.BUTTON_SOUND_INVALID,
          severity: 'warning',
          message: `DefineButtonSound for button ${buttonId} references character ${record.soundId}, which is not a sound`,
          offset: entry.origin.headerOffset,
          context: 'button sound reference',
          tagCode: entry.origin.code,
          characterId: buttonId,
        });
      }
    }
  }

  const geometryCache = new Map<number, { bounds: Rect | null; source: 'hitTest' | 'up' | null }>();
  const activeGeometry = new Set<number>();
  const computeGeometry = (buttonId: number): { bounds: Rect | null; source: 'hitTest' | 'up' | null } => {
    const cached = geometryCache.get(buttonId);
    if (cached !== undefined) return cached;
    const entry = parsed.get(buttonId);
    if (entry === undefined) return { bounds: null, source: null };
    if (activeGeometry.has(buttonId)) {
      // Self/cyclic hit-area reference (F-P2-02): bail out with a diagnostic instead of infinite
      // recursion or silently null hit area. The outer depth cap already prevents tag-level loops.
      file.sink.emit({
        code: Codes.PLACEMENT_BOUNDS_DEGENERATE,
        severity: 'warning',
        message: `button ${buttonId} references itself (or an ancestor) in its hit-area records; hit area cannot be assembled`,
        offset: entry.origin.headerOffset,
        context: 'button hit-area',
        tagCode: entry.origin.code,
        characterId: buttonId,
      });
      return { bounds: null, source: null };
    }
    activeGeometry.add(buttonId);
    const hitRecords = entry.definition.records.filter((record) => record.states.includes('hitTest'));
    const useRecords =
      hitRecords.length > 0 ? hitRecords : entry.definition.records.filter((record) => record.states.includes('up'));
    const source: 'hitTest' | 'up' | null = hitRecords.length > 0 ? 'hitTest' : useRecords.length > 0 ? 'up' : null;
    const rects: Rect[] = [];
    for (const record of useRecords) {
      if (matrixIsSingular(record.matrix)) {
        file.sink.emit({
          code: Codes.BUTTON_MATRIX_SINGULAR,
          severity: 'warning',
          message: `button ${buttonId} hit-area record at depth ${record.depth} has a singular matrix and is non-interactive`,
          offset: entry.origin.headerOffset,
          context: 'button hit-area',
          tagCode: entry.origin.code,
          characterId: buttonId,
        });
        continue;
      }
      const character = characters.get(record.characterId);
      let childBounds: Rect | null = null;
      if (character?.kind === 'button') {
        childBounds = computeGeometry(record.characterId).bounds;
      } else if (character !== undefined) {
        childBounds = character.bounds;
        if (
          childBounds === null &&
          (character.kind === 'shape' || character.kind === 'shape4' || character.kind === 'morphShape')
        ) {
          const definition = [...file.definitions].reverse().find((candidate) => candidate.id === record.characterId);
          if (definition !== undefined) {
            childBounds = characterBounds(file, definition, mode);
            if (childBounds !== null) characters.set(record.characterId, { ...character, bounds: childBounds });
          }
        }
      }
      if (childBounds !== null) {
        const transformed = transformRect(childBounds, record.matrix);
        if (isRectDegenerate(transformed)) {
          file.sink.emit({
            code: Codes.PLACEMENT_BOUNDS_DEGENERATE,
            severity: 'warning',
            message: `button ${buttonId} hit-area record at depth ${record.depth} produced a degenerate RECT after transform; record excluded from hit area`,
            offset: entry.origin.headerOffset,
            context: 'button hit-area',
            tagCode: entry.origin.code,
            characterId: buttonId,
          });
        } else {
          rects.push(transformed);
        }
      }
    }
    activeGeometry.delete(buttonId);
    const union = unionRects(rects);
    if (source !== null && useRecords.length > 0 && union === null) {
      file.sink.emit({
        code: Codes.PLACEMENT_BOUNDS_DEGENERATE,
        severity: 'warning',
        message: `button ${buttonId} hit-area records did not produce a usable RECT (all degenerate); hit area is null`,
        offset: entry.origin.headerOffset,
        context: 'button hit-area',
        tagCode: entry.origin.code,
        characterId: buttonId,
      });
    }
    const result = { bounds: union, source };
    geometryCache.set(buttonId, result);
    return result;
  };

  for (const [buttonId, entry] of parsed) {
    const existing = characters.get(buttonId) ?? missingCharacter(buttonId);
    const geometry = computeGeometry(buttonId);
    const model: ButtonModel = {
      id: buttonId,
      version: entry.definition.version,
      trackAsMenu: entry.definition.trackAsMenu,
      records: entry.definition.records,
      characterCxform: entry.definition.version === 1 ? (cxforms.get(buttonId)?.transform ?? null) : null,
      actions: entry.definition.actions,
      sounds: sounds.get(buttonId)?.records ?? [],
      hitArea: geometry.bounds,
      hitAreaSource: geometry.source,
      keyPressRequiresFocus: false,
      origin: entry.origin,
    };
    if (control.attributes?.as3 === true && entry.definition.version === 2 && entry.definition.actionOffset !== 0) {
      file.sink.emit({
        code: Codes.BUTTON2_AVM2_ACTIONS,
        severity: 'warning',
        message: `DefineButton2 character ${buttonId} has condition actions in an ActionScript 3 file (inert under AVM2)`,
        offset: entry.origin.headerOffset,
        context: 'button tag',
        tagCode: entry.origin.code,
        characterId: buttonId,
      });
    }
    characters.set(buttonId, { ...existing, button: model, bounds: geometry.bounds ?? existing.bounds });
  }
}

function buildSpriteModel(
  file: SwfFile,
  id: number,
  exportName: string | undefined,
  mode: 'soft' | 'strict',
  strictTimeline: boolean,
  importedCharacterIds: ReadonlySet<number>,
  soundChannels: (soundId: number) => 1 | 2 | null,
): SpriteModel | null {
  const range = file.tagIndex.spriteRanges.get(id);
  if (!range) return null;
  const tags = file.tagIndex.tags.slice(range.start, range.end);
  const timeline = assembleTimeline(file, tags, {
    declaredFrameCount: range.frameCount,
    padToDeclared: true,
    mode,
    strictTimeline,
    importedCharacterIds,
    soundChannels,
  });
  return {
    characterId: id,
    declaredFrameCount: range.frameCount,
    timeline,
    tags,
    characterName: exportName ?? `sprite_${id}`,
    streamSoundSpans: timeline.streamSoundSpans,
  };
}

/** Builds the model for one opened file. */
export function buildMovieModel(file: SwfFile, options: BuildMovieOptions = {}): MovieModel {
  const mode = options.mode ?? 'soft';
  const strictTimeline = options.strictTimeline ?? false;
  const topRefs = file.tagIndex.tags.filter((tag) => tag.inSprite === null);

  const {
    control: collectedControl,
    initActions,
    labels,
    labelEntries,
    unknownExportIds,
    binaryBytes,
    rawImports,
    jpegTables: collectedJpegTables,
  } = collectControl(file, topRefs, mode);
  void collectedJpegTables; // surfaced via control.jpegTables below
  const resolvedImports = resolveMovieImports(file, rawImports, options.imports ?? new Map());
  const control = { ...collectedControl, imports: resolvedImports };
  const importedCharacterIds = new Set(resolvedImports.filter((entry) => entry.applied).map((entry) => entry.localId));
  const characters = new Map<number, CharacterModel>();
  const soundModels = new Map<number, ReturnType<typeof decodeDefineSound>>();
  for (const definition of file.definitions) {
    if (definition.tagCode !== Tag.DefineSound) continue;
    const ref = file.tagIndex.tags[definition.tagIndex];
    if (ref) soundModels.set(definition.id, decodeDefineSound(openTagCursor(file, ref, mode)));
  }
  const soundChannels = (soundId: number): 1 | 2 | null => soundModels.get(soundId)?.channels ?? null;

  // Pre-pass: collect auxiliary font/text metadata tags (FontInfo/Info2, FontName, AlignZones,
  // CSMTextSettings) keyed by their target id. Tags may appear either before or after their
  // target, so we reconcile below on the second pass (IMPL-080-R037).
  type FontInfoT = import('../tags/fonts.js').FontInfoModel;
  type FontNameT = import('../tags/fonts.js').FontNameModel;
  type FontAlignT = import('../tags/fonts.js').FontAlignZonesModel;
  type CsmT = import('../tags/fonts.js').CsmTextSettingsModel;
  type FontV1T = import('../tags/fonts.js').DefineFontV1Model;
  const fontInfoById = new Map<number, { model: FontInfoT; refHeaderOffset: number }>();
  const fontNameById = new Map<number, FontNameT>();
  const fontAlignZonesById = new Map<number, FontAlignT>();
  const csmByTextId = new Map<number, CsmT>();
  const fontV1ById = new Map<number, FontV1T>();
  for (const ref of file.tagIndex.tags) {
    if (ref.inSprite !== null) continue;
    switch (ref.code) {
      case Tag.DefineFont: {
        const model = decodeDefineFontV1(openTagCursor(file, ref, mode));
        fontV1ById.set(model.id, model);
        break;
      }
      case Tag.DefineFontInfo:
      case Tag.DefineFontInfo2: {
        const model = decodeFontInfo(ref.code, openTagCursor(file, ref, mode));
        if (!fontInfoById.has(model.id)) fontInfoById.set(model.id, { model, refHeaderOffset: ref.headerOffset });
        break;
      }
      case Tag.DefineFontName: {
        const m = decodeFontName(openTagCursor(file, ref, mode));
        fontNameById.set(m.id, m);
        break;
      }
      case Tag.DefineFontAlignZones: {
        const m = decodeFontAlignZones(openTagCursor(file, ref, mode));
        fontAlignZonesById.set(m.id, m);
        break;
      }
      case Tag.CSMTextSettings: {
        const m = decodeCsmTextSettings(openTagCursor(file, ref, mode));
        csmByTextId.set(m.textId, m);
        break;
      }
      default:
        break;
    }
  }
  for (const definition of file.definitions) {
    const ref = file.tagIndex.tags[definition.tagIndex];
    if (!ref) continue;
    const sprite =
      definition.tagCode === Tag.DefineSprite
        ? buildSpriteModel(
            file,
            definition.id,
            control.exportsById.get(definition.id),
            mode,
            strictTimeline,
            importedCharacterIds,
            soundChannels,
          )
        : null;
    // `IMPL-040-R038`: a `DefineBinaryData` character registers its `binary` asset `{id, bytes}`
    // in the dictionary — payload access is by `Uint8Array` only, never a string (SEC-R003).
    const vectorShape = STATIC_SHAPE_TAGS.has(definition.tagCode)
      ? decodeDefineShapeVersion(definition.tagCode, openTagCursor(file, ref, mode)).shape
      : null;
    const morph =
      definition.tagCode === Tag.DefineMorphShape || definition.tagCode === Tag.DefineMorphShape2
        ? decodeDefineMorphShape(definition.tagCode, openTagCursor(file, ref, mode))
        : null;
    const bitmap = BITMAP_TAGS.has(definition.tagCode)
      ? decodeDefineBitmap(definition.tagCode, openTagCursor(file, ref, mode))
      : null;
    let font: import('../tags/fonts.js').DefineFontModel | null = null;
    const infoRefOffset = fontInfoById.get(definition.id)?.refHeaderOffset ?? ref.headerOffset;
    const fontInfoEmit: FontInfoEmit = (code, severity, message) => {
      file.sink.emit({
        code,
        severity,
        message,
        offset: infoRefOffset,
        context: 'font info',
        tagCode: Tag.DefineFontInfo,
        characterId: definition.id,
      });
    };
    const infoEntry = fontInfoById.get(definition.id) ?? null;
    const infoModel = infoEntry?.model ?? null;
    if (definition.tagCode === Tag.DefineFont2 || definition.tagCode === Tag.DefineFont3) {
      const model = decodeDefineFont2or3(definition.tagCode, openTagCursor(file, ref, mode));
      font = infoModel !== null ? applyFontInfo(model, infoModel, fontInfoEmit) : model;
    } else if (definition.tagCode === Tag.DefineFont) {
      const v1 = fontV1ById.get(definition.id) ?? null;
      if (v1 !== null && infoModel !== null) font = applyFontInfo(v1, infoModel, fontInfoEmit);
    }
    const fontV1 = definition.tagCode === Tag.DefineFont ? (fontV1ById.get(definition.id) ?? null) : null;
    const fontInfo = infoModel;
    const fontAlignZones = fontAlignZonesById.get(definition.id) ?? null;
    const fontName = fontNameById.get(definition.id) ?? null;
    if (definition.tagCode === Tag.DefineFont4) {
      const fontCursor = openTagCursor(file, ref, mode);
      fontCursor.u16();
      const flags = fontCursor.u8();
      if ((flags & 0x04) !== 0) {
        fontCursor.emit(
          Codes.FONT_CFF_UNSUPPORTED,
          'error',
          `DefineFont4 ${definition.id} contains CFF outlines; glyph conversion is unsupported`,
          fontCursor.offset,
          { characterId: definition.id },
        );
      } else {
        fontCursor.emit(
          Codes.FONT_DEVICE_ONLY,
          'info',
          `DefineFont4 ${definition.id} has no embedded CFF outlines`,
          fontCursor.offset,
          { characterId: definition.id },
        );
      }
    }
    if (fontAlignZones !== null && definition.tagCode !== Tag.DefineFont3) {
      file.sink.emit({
        code: Codes.FONT_HINT_TARGET_INVALID,
        severity: 'warning',
        message: `DefineFontAlignZones targets character ${definition.id} which is not DefineFont3; zones recorded but not applied`,
        offset: ref.headerOffset,
        context: 'font zones',
        tagCode: Tag.DefineFontAlignZones,
        characterId: definition.id,
      });
    }
    const text =
      definition.tagCode === Tag.DefineText || definition.tagCode === Tag.DefineText2
        ? decodeDefineText(definition.tagCode, openTagCursor(file, ref, mode))
        : null;
    const editText =
      definition.tagCode === Tag.DefineEditText ? decodeDefineEditText(openTagCursor(file, ref, mode)) : null;
    const csmTextSettings = csmByTextId.get(definition.id) ?? null;
    if (
      csmTextSettings !== null &&
      definition.tagCode !== Tag.DefineText &&
      definition.tagCode !== Tag.DefineText2 &&
      definition.tagCode !== Tag.DefineEditText
    ) {
      file.sink.emit({
        code: Codes.FONT_HINT_TARGET_INVALID,
        severity: 'warning',
        message: `CSMTextSettings targets character ${definition.id} which is not a text/edit-text character; recorded but ignored`,
        offset: ref.headerOffset,
        context: 'CSM text settings',
        tagCode: Tag.CSMTextSettings,
        characterId: definition.id,
      });
    }
    const sound = soundModels.get(definition.id) ?? null;
    const bounds =
      vectorShape?.bounds ??
      text?.bounds ??
      editText?.bounds ??
      morph?.startBounds ??
      characterBounds(file, definition, mode);
    const bytes = definition.tagCode === Tag.DefineBinaryData ? (binaryBytes.get(definition.id) ?? null) : null;
    characters.set(definition.id, {
      id: definition.id,
      kind: characterKindForTag(definition.tagCode),
      tagCode: definition.tagCode,
      tagName: tagName(definition.tagCode),
      index: ref,
      sprite,
      button: null,
      bounds,
      vectorShape,
      morph,
      bitmap,
      font,
      fontV1,
      fontInfo,
      fontAlignZones,
      fontName,
      text,
      editText,
      csmTextSettings,
      sound,
      alias: null,
      bytes,
    });
  }

  // IMPL-080-R037: an auxiliary font/text tag whose target is absent from the dictionary is ignored
  // with SF0278, de-duplicated by id. Resolution happens here (end of parse) because a tag may
  // legally precede the tag it modifies.
  for (const [targetId] of fontAlignZonesById) {
    if (characters.has(targetId)) continue;
    file.sink.emit({
      code: Codes.FONT_HINT_TARGET_INVALID,
      severity: 'warning',
      message: `DefineFontAlignZones targets undefined character ${targetId}; the tag is ignored`,
      offset: 0,
      context: 'font zones',
      tagCode: Tag.DefineFontAlignZones,
      characterId: targetId,
    });
  }
  for (const [targetId] of csmByTextId) {
    if (characters.has(targetId)) continue;
    file.sink.emit({
      code: Codes.FONT_HINT_TARGET_INVALID,
      severity: 'warning',
      message: `CSMTextSettings targets undefined character ${targetId}; the tag is ignored`,
      offset: 0,
      context: 'CSM text settings',
      tagCode: Tag.CSMTextSettings,
      characterId: targetId,
    });
  }
  // IMPL-080-R035: zones are recorded verbatim and never used to snap glyphs — the browser
  // rasteriser owns hinting. Report once per font that carries them so the manifest can say so.
  for (const [targetId, zones] of fontAlignZonesById) {
    const character = characters.get(targetId);
    if (character === undefined || character.tagCode !== Tag.DefineFont3) continue;
    file.sink.emit({
      code: Codes.FONT_HINTING_IGNORED,
      severity: 'info',
      message: `font ${targetId} carries ${zones.zones.length} alignment zone record(s); recorded verbatim and not applied (the rasteriser owns hinting)`,
      offset: character.index?.headerOffset ?? 0,
      context: 'font zones',
      tagCode: Tag.DefineFontAlignZones,
      characterId: targetId,
    });
  }

  const embeddedFonts = new Map<number, NonNullable<CharacterModel['font']>>();
  for (const character of characters.values()) {
    if (character.font !== null) embeddedFonts.set(character.id, character.font);
  }
  for (const [id, character] of characters) {
    if (character.text === null) continue;
    const origin = character.index;
    const recovered = recoverStaticTextCodes(character.text, embeddedFonts, (code, severity, message) => {
      file.sink.emit({
        code,
        severity,
        message,
        offset: origin?.headerOffset ?? 0,
        context: 'static text glyph mapping',
        ...(character.tagCode !== null ? { tagCode: character.tagCode } : {}),
        characterId: id,
      });
    });
    characters.set(id, { ...character, text: recovered.text });
  }

  // Imported aliases are explicit dictionary entries, but do not copy the source payload.
  for (const entry of resolvedImports) {
    if (characters.has(entry.localId)) continue;
    if (!entry.applied || entry.sourceMovieId === null || entry.sourceId === null) {
      characters.set(entry.localId, missingCharacter(entry.localId));
      continue;
    }
    const origin =
      rawImports.find((raw) => raw.localId === entry.localId && raw.name === entry.name && raw.url === entry.url)
        ?.origin ?? null;
    const alias: CharacterAlias = { sourceMovieId: entry.sourceMovieId, sourceId: entry.sourceId };
    characters.set(entry.localId, {
      id: entry.localId,
      kind: 'imported',
      tagCode: null,
      tagName: 'imported',
      index: origin,
      sprite: null,
      button: null,
      bounds: null,
      vectorShape: null,
      morph: null,
      bitmap: null,
      font: null,
      fontV1: null,
      fontInfo: null,
      fontAlignZones: null,
      fontName: null,
      text: null,
      editText: null,
      csmTextSettings: null,
      sound: null,
      alias,
      bytes: null,
    });
  }

  const mainTimeline = assembleTimeline(file, topRefs, {
    declaredFrameCount: file.header.frameCount,
    padToDeclared: true,
    mode,
    strictTimeline,
    importedCharacterIds,
    soundChannels,
    onFrameLabel: (name, namedAnchor, frame) => {
      const list = labels.get(name) ?? [];
      if (!list.some((entry) => entry.frame === frame && entry.namedAnchor === namedAnchor)) {
        list.push({ frame, namedAnchor });
        labels.set(name, list);
      }
    },
  });

  const timelines = [
    mainTimeline,
    ...[...characters.values()].flatMap((character) => (character.sprite ? [character.sprite.timeline] : [])),
  ];
  for (const timeline of timelines) {
    for (const frameModel of timeline.frames) {
      for (const op of frameModel.ops) {
        if (op.kind === 'place' && op.characterId !== null && !characters.has(op.characterId)) {
          characters.set(op.characterId, missingCharacter(op.characterId));
        }
      }
    }
  }
  // `IMPL-040-R015`: export/`SymbolClass` entries naming an undefined id resolve through the same
  // `missing` placeholder policy as placements (`SF0174` was reported at collection time).
  for (const characterId of unknownExportIds) {
    if (!characters.has(characterId)) {
      characters.set(characterId, missingCharacter(characterId));
    }
  }

  assembleButtons(file, topRefs, control, characters, mode);

  // `IMPL-040-R043`: the tab-index ops live in the frame op lists; the control model mirrors them.
  const tabIndexOps: SetTabIndexOp[] = [];
  for (const timeline of timelines) {
    for (const frameModel of timeline.frames) {
      for (const op of frameModel.ops) if (op.kind === 'tabIndex') tabIndexOps.push(op);
    }
  }

  const stage = {
    widthTwips: file.header.frameSize.xMax - file.header.frameSize.xMin,
    heightTwips: file.header.frameSize.yMax - file.header.frameSize.yMin,
    frameRate: file.header.frameRateRaw,
  };

  const id = stableMovieId(file, options.id);

  return {
    id,
    stage,
    frameCount: file.header.frameCount,
    background: control.background,
    characters,
    exported: control.exports,
    mainTimeline,
    initActions,
    metadata: control.metadata,
    control: { ...control, labels, labelEntries, tabIndexOps },
  };
}
