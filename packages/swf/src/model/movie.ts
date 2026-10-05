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
import { fnv1a64Hex } from '../io/hash.js';
import { Tag, tagName } from '../tags/tag-codes.js';
import { openTagCursor, assembleTimeline } from './timeline.js';
import type {
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
  /** Overrides the content-derived id (a caller-supplied `sha256:<hex>`, say). */
  readonly id?: string;
}

const BUTTON_TAGS: ReadonlySet<number> = new Set([Tag.DefineButton, Tag.DefineButton2]);

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

interface ControlPass {
  control: Omit<MovieControlModel, 'labels' | 'tabIndexOps' | 'labelEntries'>;
  initActions: InitActionBlock[];
  labels: Map<string, { frame: number; namedAnchor: boolean }[]>;
  labelEntries: { name: string; frame: number; namedAnchor: boolean }[];
  protect: PasswordState | null;
  debugger: MovieControlModel['debugger'];
  telemetry: MovieControlModel['telemetry'];
  binaryData: MovieControlModel['binaryData'];
  unknownExportIds: Set<number>;
  binaryBytes: Map<number, Uint8Array>;
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
        const { url, entries } = decodeImportAssets(c, ref.code);
        for (const entry of entries) {
          imports.push({ url, name: entry.name, localId: entry.id, applied: false });
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
    },
    initActions,
    labels,
    labelEntries: [...tagLabelEntries, ...sceneLabelEntries],
    protect,
    debugger: debuggerTag,
    telemetry,
    binaryData,
    unknownExportIds,
    binaryBytes,
  };
}

function buildSpriteModel(
  file: SwfFile,
  id: number,
  exportName: string | undefined,
  mode: 'soft' | 'strict',
  strictTimeline: boolean,
): SpriteModel | null {
  const range = file.tagIndex.spriteRanges.get(id);
  if (!range) return null;
  const tags = file.tagIndex.tags.slice(range.start, range.end);
  const timeline = assembleTimeline(file, tags, {
    declaredFrameCount: range.frameCount,
    padToDeclared: true,
    mode,
    strictTimeline,
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

  const { control, initActions, labels, labelEntries, unknownExportIds, binaryBytes } = collectControl(
    file,
    topRefs,
    mode,
  );
  const characters = new Map<number, CharacterModel>();
  for (const definition of file.definitions) {
    const ref = file.tagIndex.tags[definition.tagIndex];
    if (!ref) continue;
    const sprite =
      definition.tagCode === Tag.DefineSprite
        ? buildSpriteModel(file, definition.id, control.exportsById.get(definition.id), mode, strictTimeline)
        : null;
    // `IMPL-040-R038`: a `DefineBinaryData` character registers its `binary` asset `{id, bytes}`
    // in the dictionary — payload access is by `Uint8Array` only, never a string (SEC-R003).
    const bytes = definition.tagCode === Tag.DefineBinaryData ? (binaryBytes.get(definition.id) ?? null) : null;
    characters.set(definition.id, {
      id: definition.id,
      kind: characterKindForTag(definition.tagCode),
      tagCode: definition.tagCode,
      tagName: tagName(definition.tagCode),
      index: ref,
      sprite,
      bytes,
    });
  }

  const mainTimeline = assembleTimeline(file, topRefs, {
    declaredFrameCount: file.header.frameCount,
    padToDeclared: true,
    mode,
    strictTimeline,
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
          characters.set(op.characterId, {
            id: op.characterId,
            kind: 'missing',
            tagCode: null,
            tagName: 'missing',
            index: null,
            sprite: null,
            bytes: null,
          });
        }
      }
    }
  }
  // `IMPL-040-R015`: export/`SymbolClass` entries naming an undefined id resolve through the same
  // `missing` placeholder policy as placements (`SF0174` was reported at collection time).
  for (const characterId of unknownExportIds) {
    if (!characters.has(characterId)) {
      characters.set(characterId, {
        id: characterId,
        kind: 'missing',
        tagCode: null,
        tagName: 'missing',
        index: null,
        sprite: null,
        bytes: null,
      });
    }
  }

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

  const id =
    options.id ??
    (file.sha256.length > 0
      ? `sha256:${file.sha256}`
      : fallbackId(file.body, {
          signature: file.header.compression,
          version: file.header.version,
          fileLength: file.header.fileLength,
          frames: file.header.frameCount,
        }));

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
