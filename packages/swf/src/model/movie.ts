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
  decodeDefineScalingGrid,
  decodeDoInitAction,
  decodeExportAssets,
  decodeFileAttributes,
  decodeFrameLabel,
  decodeImportAssets,
  decodeMetadata,
  decodeSceneAndFrameLabelData,
  decodeScriptLimits,
  decodeSetBackgroundColor,
  decodeSymbolClass,
  type FileAttributesInfo,
} from '../tags/control.js';
import { Tag, tagName } from '../tags/tag-codes.js';
import { openTagCursor, assembleTimeline } from './timeline.js';
import type {
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
  /** Overrides the content-derived id (a caller-supplied `sha256:<hex>`, say). */
  readonly id?: string;
}

const BUTTON_TAGS: ReadonlySet<number> = new Set([Tag.DefineButton, Tag.DefineButton2]);

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
  for (const value of JSON.stringify(prefix).split('').map((ch) => ch.charCodeAt(0))) mix(value);
  for (let i = 0; i < body.length && i < sample; i += 1) mix(body[i] ?? 0);
  for (let i = Math.max(0, body.length - sample); i < body.length; i += 1) mix(body[i] ?? 0);
  for (let shift = 0; shift < 4; shift += 1) mix((body.length >>> (shift * 8)) & 0xff);
  return `fnv1a64:${hash.toString(16).padStart(16, '0')}`;
}

interface ControlPass {
  control: Omit<MovieControlModel, 'labels' | 'tabIndexOps'>;
  initActions: InitActionBlock[];
  labels: Map<string, { frame: number; namedAnchor: boolean }[]>;
}

function collectControl(file: SwfFile, topRefs: readonly TagRef[], mode: 'soft' | 'strict'): ControlPass {
  let background = 0xffffff;
  let backgroundSource: 'default' | 'tag' = 'default';
  const backgroundChanges: { frame: number; rgb: number }[] = [];
  const scenes: { name: string; startFrame: number }[] = [];
  const labels = new Map<string, { frame: number; namedAnchor: boolean }[]>();
  const exports = new Map<string, number>();
  const exportsById = new Map<number, string>();
  const imports: ImportEntry[] = [];
  const scalingGrids = new Map<number, Rect>();
  const initActions: InitActionBlock[] = [];
  let rootClassName: string | null = null;
  let scriptLimits: { maxRecursionDepth: number | null; scriptTimeout: number | null } = {
    maxRecursionDepth: null,
    scriptTimeout: null,
  };
  let attributes: FileAttributesModel | null = null;
  let metadataXmp: string | null = null;
  let metadataTag: TagRef | null = null;
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
        break;
      }
      case Tag.SymbolClass: {
        const result = decodeSymbolClass(c);
        rootClassName = result.rootClassName;
        mergeExports(result.byName, result.byId);
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
        const target = file.definitions.find((d) => d.id === characterId);
        if (!target || (target.tagCode !== Tag.DefineSprite && !BUTTON_TAGS.has(target.tagCode))) {
          c.emit(
            Codes.SCALING_GRID_TARGET,
            'warning',
            `scaling grid target ${characterId} is ${target ? tagName(target.tagCode) : 'unknown'}; dropped`,
          );
          break;
        }
        scalingGrids.set(characterId, splitter);
        break;
      }
      case Tag.ScriptLimits: {
        const limits = decodeScriptLimits(c);
        scriptLimits = { maxRecursionDepth: limits.maxRecursionDepth, scriptTimeout: limits.scriptTimeout };
        break;
      }
      case Tag.FileAttributes:
        attributes = { ...decodeFileAttributes(c), origin: ref };
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
      case Tag.DefineSceneAndFrameLabelData: {
        const data = decodeSceneAndFrameLabelData(c);
        for (const scene of data.scenes) scenes.push({ name: scene.name, startFrame: scene.startFrame });
        for (const entry of data.labels) {
          const list = labels.get(entry.name) ?? [];
          list.push({ frame: entry.frame, namedAnchor: false });
          labels.set(entry.name, list);
        }
        break;
      }
      case Tag.DoInitAction: {
        const { spriteId, block } = decodeDoInitAction(c);
        initActions.push({ spriteId, block, index: ref });
        break;
      }
      case Tag.FrameLabel: {
        const { name, namedAnchor } = decodeFrameLabel(c);
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

  const metadata: Record<string, string> = {};
  if (metadataXmp !== null) metadata['xmp'] = metadataXmp;

  return {
    control: {
      background,
      backgroundSource,
      backgroundChanges,
      scenes,
      exports,
      exportsById,
      rootClassName,
      imports,
      scalingGrids,
      scriptLimits,
      attributes,
      metadata,
    },
    initActions,
    labels,
  };
}

function buildSpriteModel(
  file: SwfFile,
  id: number,
  exportName: string | undefined,
  mode: 'soft' | 'strict',
): SpriteModel | null {
  const range = file.tagIndex.spriteRanges.get(id);
  if (!range) return null;
  const tags = file.tagIndex.tags.slice(range.start, range.end);
  const timeline = assembleTimeline(file, tags, {
    declaredFrameCount: range.frameCount,
    padToDeclared: false,
    mode,
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
  const topRefs = file.tagIndex.tags.filter((tag) => tag.inSprite === null);

  const { control, initActions, labels } = collectControl(file, topRefs, mode);
  const characters = new Map<number, CharacterModel>();
  for (const definition of file.definitions) {
    const ref = file.tagIndex.tags[definition.tagIndex];
    if (!ref) continue;
    const sprite =
      definition.tagCode === Tag.DefineSprite
        ? buildSpriteModel(file, definition.id, control.exportsById.get(definition.id), mode)
        : null;
    characters.set(definition.id, {
      id: definition.id,
      tagCode: definition.tagCode,
      tagName: tagName(definition.tagCode),
      index: ref,
      sprite,
    });
  }

  const mainTimeline = assembleTimeline(file, topRefs, {
    declaredFrameCount: file.header.frameCount,
    padToDeclared: true,
    mode,
    onFrameLabel: (name, namedAnchor, frame) => {
      const list = labels.get(name) ?? [];
      if (!list.some((entry) => entry.frame === frame && entry.namedAnchor === namedAnchor)) {
        list.push({ frame, namedAnchor });
        labels.set(name, list);
      }
    },
  });

  // `IMPL-040-R043`: the tab-index ops live in the frame op lists; the control model mirrors them.
  const tabIndexOps: SetTabIndexOp[] = [];
  for (const timeline of [mainTimeline, ...[...characters.values()].flatMap((ch) => (ch.sprite ? [ch.sprite.timeline] : []))]) {
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
    control: { ...control, labels, tabIndexOps },
  };
}
