/**
 * Control and metadata tags — `IMPL-040` (Ch.4/Ch.15). Field orders pinned by APP-§10.2.
 *
 * These decoders are pure `(Cursor) => value` and never touch the dictionary; the model layer
 * (`model/movie.ts`) decides what a tag means for a movie. Diagnostics go through the cursor so the
 * report keeps the tag's byte offset.
 */

import { Codes } from '../diagnostics/codes.js';
import { readRgb } from '../io/colour.js';
import type { Cursor } from '../io/cursor.js';
import { readRect } from '../io/records.js';
import type { Rect, Rgba } from '../io/types.js';
import type { ActionBlockRef } from './place.js';

/** `SetBackgroundColor` (9) — `RGB`, exactly three bytes. */
export function decodeSetBackgroundColor(c: Cursor): { color: Rgba } {
  const color = readRgb(c);
  if (c.limit - c.offset !== 0) {
    c.emit(Codes.VALUE_OUT_OF_RANGE, 'info', 'SetBackgroundColor body has bytes after the RGB');
    c.seek(c.limit);
  }
  return { color };
}

/** `FrameLabel` (43); SWF 6+ may append the named-anchor byte (`IMPL-040-R009`). */
export function decodeFrameLabel(c: Cursor): { name: string; namedAnchor: boolean } {
  const name = c.string();
  let namedAnchor = false;
  if (c.limit - c.offset >= 1) {
    const byte = c.u8();
    namedAnchor = byte === 1;
    if (byte !== 1 && byte !== 0) {
      c.emit(Codes.NAMED_ANCHOR_BYTE_INVALID, 'warning', `FrameLabel anchor byte is ${byte}, not 1`);
    }
  }
  return { name, namedAnchor };
}

export interface FileAttributesInfo {
  readonly useNetwork: boolean;
  readonly as3: boolean;
  readonly hasMetadata: boolean;
  readonly useGPU: boolean;
  readonly useDirectBlit: boolean;
  readonly raw: number;
  readonly bitLength: number;
}

/**
 * `FileAttributes` (69) — 32 bits, or a shorter legacy form (`SEC-D09`).
 *
 * `IMPL-040-R032`: the flags are read as a **little-endian** word over the available bytes. Reading
 * the four bytes big-endian, or rebuilding the integer MSB-first from the chapter's bit-field order,
 * both invert the flag positions; the masks in `IMPL-040` §3.5 are the sanctioned reading.
 */
export function decodeFileAttributes(c: Cursor): FileAttributesInfo {
  const available = Math.min(4, Math.max(0, c.limit - c.offset));
  let raw = 0;
  for (let i = 0; i < available; i += 1) raw += (c.u8() & 0xff) * 2 ** (8 * i);
  const bitLength = available * 8;
  return {
    useNetwork: (raw & 0x00000001) !== 0,
    as3: (raw & 0x00000008) !== 0,
    hasMetadata: (raw & 0x00000010) !== 0,
    useGPU: (raw & 0x00000020) !== 0,
    useDirectBlit: (raw & 0x00000040) !== 0,
    raw,
    bitLength,
  };
}

export interface AssetPair {
  readonly id: number;
  readonly name: string;
}

export interface ExportAssetsResult {
  readonly pairs: readonly AssetPair[];
  /** name → character id; a duplicate name keeps the first id (`SF0160`). */
  readonly byName: ReadonlyMap<string, number>;
  /** character id → name; a repeated id keeps the later name (Ch.4, `SF0159`). */
  readonly byId: ReadonlyMap<number, string>;
}

function readPairs(c: Cursor, count: number, what: string): AssetPair[] {
  const pairs: AssetPair[] = [];
  for (let i = 0; i < count; i += 1) {
    if (c.limit - c.offset < 2) {
      c.emit(Codes.READ_PAST_BOUNDS, 'warning', `${what} declares ${count} entries but the body ends`);
      break;
    }
    const id = c.u16();
    const name = c.string();
    pairs.push({ id, name });
  }
  return pairs;
}

function buildExportMaps(c: Cursor, pairs: readonly AssetPair[], what: string): Pick<ExportAssetsResult, 'byName' | 'byId'> {
  const byName = new Map<string, number>();
  const byId = new Map<number, string>();
  for (const { id, name } of pairs) {
    if (name.length === 0) {
      c.emit(Codes.EXPORT_NAME_INVALID, 'warning', `${what} entry for character ${id} has an empty name`);
      continue;
    }
    if (byName.has(name)) {
      c.emit(Codes.EXPORT_NAME_DUPLICATE, 'warning', `${what} name "${name}" is exported twice; the first id wins`);
    } else {
      byName.set(name, id);
    }
    const prior = byId.get(id);
    if (prior !== undefined && prior !== name) {
      c.emit(Codes.EXPORT_ID_DUPLICATE, 'warning', `character ${id} exported as "${prior}" and "${name}"; the later name wins`);
    }
    byId.set(id, name);
  }
  return { byName, byId };
}

/** `ExportAssets` (56): `UI16 Count` + (`UI16 Tag`, `STRING Name`)…. */
export function decodeExportAssets(c: Cursor): ExportAssetsResult {
  const count = c.u16();
  const pairs = readPairs(c, count, 'ExportAssets');
  return { pairs, ...buildExportMaps(c, pairs, 'ExportAssets') };
}

/** `SymbolClass` (76): `UI16 NumSymbols` + (`UI16 Tag`, `STRING Name`)…; `Tag = 0` is the root class. */
export function decodeSymbolClass(c: Cursor): ExportAssetsResult & { rootClassName: string | null } {
  const count = c.u16();
  const pairs = readPairs(c, count, 'SymbolClass');
  let rootClassName: string | null = null;
  for (const { id, name } of pairs) {
    if (id === 0 && rootClassName === null) rootClassName = name;
  }
  const nonRoot = pairs.filter((p) => p.id !== 0);
  return { pairs: nonRoot, ...buildExportMaps(c, nonRoot, 'SymbolClass'), rootClassName };
}

/** `ImportAssets` (57) / `ImportAssets2` (71). */
export function decodeImportAssets(
  c: Cursor,
  tagCode: number,
): { url: string; entries: readonly AssetPair[]; deprecated: boolean } {
  const url = c.string();
  if (tagCode === 71) {
    const first = c.u8();
    const second = c.u8();
    if (first !== 1 || second !== 0) {
      c.emit(Codes.IMPORTASSETS2_RESERVED, 'warning', `ImportAssets2 reserved bytes are ${first}, ${second}`);
    }
  }
  const count = c.u16();
  const entries = readPairs(c, count, tagCode === 71 ? 'ImportAssets2' : 'ImportAssets');
  const deprecated = tagCode === 57 && c.version >= 8;
  if (deprecated) {
    c.emit(Codes.IMPORTASSETS_DEPRECATED, 'warning', 'ImportAssets (57) in a SWF 8+ file is ignored by Flash Player 8+');
  }
  return { url, entries, deprecated };
}

/** `Metadata` (77): a single RDF/XMP `STRING`. */
export function decodeMetadata(c: Cursor): { xmp: string } {
  const xmp = c.string();
  if (c.limit - c.offset !== 0) {
    c.emit(Codes.VALUE_OUT_OF_RANGE, 'info', 'Metadata body has bytes after the string');
    c.seek(c.limit);
  }
  return { xmp };
}

/** `ScriptLimits` (65): `UI16 MaxRecursionDepth`, `UI16 ScriptTimeoutSeconds`. */
export function decodeScriptLimits(c: Cursor): { maxRecursionDepth: number; scriptTimeout: number } {
  const maxRecursionDepth = c.u16();
  const scriptTimeout = c.u16();
  if (maxRecursionDepth === 0 || maxRecursionDepth > 65535) {
    c.emit(Codes.SCRIPT_LIMITS_IMPLAUSIBLE, 'warning', `MaxRecursionDepth ${maxRecursionDepth} is out of range`);
  }
  if (scriptTimeout === 0) {
    c.emit(Codes.SCRIPT_LIMITS_IMPLAUSIBLE, 'warning', 'ScriptTimeoutSeconds 0 is out of range');
  }
  return { maxRecursionDepth, scriptTimeout };
}

/** `SetTabIndex` (66): `UI16 Depth`, `UI16 TabIndex`. */
export function decodeSetTabIndex(c: Cursor): { depth: number; tabIndex: number } {
  return { depth: c.u16(), tabIndex: c.u16() };
}

/** `DefineScalingGrid` (78): `UI16 CharacterId`, `RECT Splitter`. */
export function decodeDefineScalingGrid(c: Cursor): { characterId: number; splitter: Rect } {
  const characterId = c.u16();
  const splitter = readRect(c);
  if (splitter.xMax - splitter.xMin < 1 || splitter.yMax - splitter.yMin < 1) {
    c.emit(Codes.SCALING_GRID_BELOW_MIN, 'warning', `scaling grid for character ${characterId} is below one twip per side`);
  }
  return { characterId, splitter };
}

/** `DefineSceneAndFrameLabelData` (86) — zero-based, main-timeline only (`SF0169`). */
export function decodeSceneAndFrameLabelData(c: Cursor): {
  scenes: readonly { name: string; startFrame: number }[];
  labels: readonly { name: string; frame: number }[];
} {
  const sceneCount = c.encodedU32();
  const scenes: { name: string; startFrame: number }[] = [];
  for (let i = 0; i < sceneCount; i += 1) {
    const startFrame = c.encodedU32();
    const name = c.string();
    scenes.push({ name, startFrame });
  }
  const labelCount = c.encodedU32();
  const labels: { name: string; frame: number }[] = [];
  for (let i = 0; i < labelCount; i += 1) {
    const frame = c.encodedU32();
    const name = c.string();
    labels.push({ name, frame });
  }
  for (let i = 1; i < scenes.length; i += 1) {
    const prior = scenes[i - 1];
    const here = scenes[i];
    if (prior && here && here.startFrame < prior.startFrame) {
      c.emit(Codes.SCENE_DATA_INCONSISTENT, 'warning', `scene "${here.name}" starts before scene "${prior.name}"`);
    }
  }
  return { scenes, labels };
}

/** `DoInitAction` (59): `UI16 SpriteID` then the action bytes handed to the AVM1 front end. */
export function decodeDoInitAction(c: Cursor): { spriteId: number; block: ActionBlockRef } {
  const spriteId = c.u16();
  const offset = c.offset;
  return { spriteId, block: { offset, length: Math.max(0, c.limit - offset) } };
}

/** `Protect` (24): empty, or a null-terminated password (meaningful from SWF 5). */
export function decodeProtect(c: Cursor): { password: string | null } {
  if (c.limit - c.offset === 0) return { password: null };
  const password = c.string();
  return { password: password.length > 0 ? password : null };
}
