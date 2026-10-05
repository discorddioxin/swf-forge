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
import { fnv1a64Hex } from '../io/hash.js';
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

/**
 * `FrameLabel` (43); SWF 6+ may append the named-anchor byte (`IMPL-040-R009`).
 *
 * Presence is defined by **one byte remaining after the string's null terminator** — that byte is
 * the `UI8` anchor flag and it is always `1`. Any other value is `SF0165` (warning) but the frame
 * is *still* anchored: the byte's presence, not its value, is the anchor marker.
 */
export function decodeFrameLabel(c: Cursor): { name: string; namedAnchor: boolean } {
  const name = c.string();
  let namedAnchor = false;
  if (c.limit - c.offset >= 1) {
    const byte = c.u8();
    namedAnchor = true;
    if (byte !== 1) {
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
/**
 * The reserved bit fields of `FileAttributes` (`IMPL-040-R031`). `0x00000004` is handled separately
 * as the legacy SWF 9 `NoCrossDomainCache` flag (`SF0176`); every other reserved bit is `SF0171`.
 */
const FILE_ATTRIBUTES_RESERVED = 0x80 | 0x02 | 0xffffff00;
const FILE_ATTRIBUTES_NOCROSSDOMAINCACHE = 0x04;

export function decodeFileAttributes(c: Cursor): FileAttributesInfo {
  const start = c.offset;
  const available = Math.min(4, Math.max(0, c.limit - c.offset));
  let raw = 0;
  for (let i = 0; i < available; i += 1) raw += (c.u8() & 0xff) * 2 ** (8 * i);
  const bitLength = available * 8;
  if ((raw & FILE_ATTRIBUTES_RESERVED) !== 0) {
    c.emit(
      Codes.RESERVED_FIELD_NONZERO,
      'info',
      `FileAttributes reserved bits 0x${(raw & FILE_ATTRIBUTES_RESERVED).toString(16)} are set (recorded verbatim)`,
      start,
    );
  }
  if ((raw & FILE_ATTRIBUTES_NOCROSSDOMAINCACHE) !== 0) {
    c.emit(
      Codes.FILE_ATTRIBUTES_LEGACY_NOCROSSDOMAINCACHE,
      'info',
      'FileAttributes legacy SWF 9 NoCrossDomainCache bit is set (recorded; no behaviour change)',
      start,
    );
  }
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

function buildExportMaps(
  c: Cursor,
  pairs: readonly AssetPair[],
  what: string,
): Pick<ExportAssetsResult, 'byName' | 'byId'> {
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
      c.emit(
        Codes.EXPORT_ID_DUPLICATE,
        'warning',
        `character ${id} exported as "${prior}" and "${name}"; the later name wins`,
      );
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
    c.emit(
      Codes.IMPORTASSETS_DEPRECATED,
      'warning',
      'ImportAssets (57) in a SWF 8+ file is ignored by Flash Player 8+',
    );
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
    c.emit(
      Codes.SCALING_GRID_BELOW_MIN,
      'warning',
      `scaling grid for character ${characterId} is below one twip per side`,
    );
  }
  return { characterId, splitter };
}

/** `DefineSceneAndFrameLabelData` (86) — zero-based, main-timeline only (`SF0169`). */
export function decodeSceneAndFrameLabelData(c: Cursor): {
  scenes: readonly { name: string; frameOffset: number }[];
  labels: readonly { name: string; frame: number }[];
} {
  const sceneCount = c.encodedU32();
  const scenes: { name: string; frameOffset: number }[] = [];
  for (let i = 0; i < sceneCount; i += 1) {
    const frameOffset = c.encodedU32();
    const name = c.string();
    scenes.push({ name, frameOffset });
  }
  const labelCount = c.encodedU32();
  const labels: { name: string; frame: number }[] = [];
  for (let i = 0; i < labelCount; i += 1) {
    const frame = c.encodedU32();
    const name = c.string();
    labels.push({ name, frame });
  }
  return { scenes, labels };
}

/** `DoInitAction` (59): `UI16 SpriteID` then the action bytes handed to the AVM1 front end. */
export function decodeDoInitAction(c: Cursor): { spriteId: number; block: ActionBlockRef } {
  const spriteId = c.u16();
  const offset = c.offset;
  return { spriteId, block: { offset, length: Math.max(0, c.limit - offset) } };
}

/**
 * A password-bearing control tag's recorded state (`IMPL-040-R039`/`R040`): present/absent plus a
 * one-way digest — the password is credential material and MUST NOT be reproduced.
 */
export interface PasswordState {
  /** The tag (or its password field) is present. */
  readonly present: boolean;
  /** A non-empty password body was carried. */
  readonly passwordPresent: boolean;
  /** FNV-1a 64 hex over the password bytes; null when absent. */
  readonly digest: string | null;
}

/**
 * Reads a null-terminated password's **raw bytes** (advancing the cursor past the terminator) and
 * folds them into a {@link PasswordState}. The text is never returned or retained — only a digest.
 */
function readPasswordState(c: Cursor): PasswordState {
  if (c.limit - c.offset === 0) return { present: true, passwordPresent: false, digest: null };
  const start = c.offset;
  let end = c.limit;
  while (end > start && (c.bytes[end] ?? 0) !== 0) end += 1;
  const raw = c.bytes.subarray(start, end);
  c.skip(Math.max(0, end - start) + (end < c.limit ? 1 : 0)); // consume the bytes + the terminator
  const present = raw.length > 0;
  return { present: true, passwordPresent: present, digest: present ? fnv1a64Hex(raw) : null };
}

/** `Protect` (24): empty (file marked non-importable) or a null-terminated password (SWF 5+). */
export function decodeProtect(c: Cursor): PasswordState & { swf5Password: boolean } {
  const state = readPasswordState(c);
  // A password in a SWF < 5 file is recorded but clamped to a warning (`IMPL-040-R039`).
  const swf5Password = state.passwordPresent && (c.version ?? 0) < 5;
  if (swf5Password) {
    c.emit(
      Codes.SCRIPT_LIMITS_IMPLAUSIBLE,
      'warning',
      `Protect password is only meaningful from SWF 5 (file claims SWF ${c.version})`,
      c.offset,
    );
  }
  return { ...state, swf5Password };
}

/** `EnableDebugger` (58, SWF 5 only): a null-terminated password; recorded, never acted on. */
export function decodeEnableDebugger(c: Cursor): PasswordState {
  c.emit(Codes.DEBUGGER_TAG_PRESENT, 'info', 'EnableDebugger (58) present; recorded and ignored', c.offset);
  return readPasswordState(c);
}

/** `EnableDebugger2` (64): `UI16 Reserved` (must be 0) then a null-terminated password. */
export function decodeEnableDebugger2(c: Cursor): PasswordState & { reserved: number } {
  const reserved = c.u16();
  if (reserved !== 0) {
    c.emit(
      Codes.RESERVED_FIELD_NONZERO,
      'info',
      `EnableDebugger2 Reserved is ${reserved} (recorded verbatim)`,
      c.offset - 2,
    );
  }
  return { ...readPasswordState(c), reserved };
}

/**
 * `EnableTelemetry` (93, SWF 11): `Reserved UB[16]` (2 bytes, must be 0) then an optional
 * `PasswordHash` (32 bytes). Only the presence of the hash matters to us (`IMPL-040-R041`).
 */
export function decodeEnableTelemetry(c: Cursor): {
  readonly reserved: number;
  readonly hashPresent: boolean;
  readonly digest: string | null;
} {
  c.emit(Codes.TELEMETRY_OPT_IN, 'info', 'EnableTelemetry present; advanced telemetry opt-in (inert)', c.offset);
  const start = c.offset;
  const reserved = c.u16();
  if (reserved !== 0) {
    c.emit(
      Codes.RESERVED_FIELD_NONZERO,
      'info',
      `EnableTelemetry reserved word is 0x${reserved.toString(16)} (recorded verbatim)`,
      start,
    );
  }
  const remaining = c.limit - c.offset;
  if (remaining === 0) return { reserved, hashPresent: false, digest: null };
  if (remaining !== 32) {
    c.emit(
      Codes.RESERVED_FIELD_NONZERO,
      'info',
      `EnableTelemetry body has ${remaining} trailing byte(s), not 32 (recorded verbatim)`,
      start,
    );
  }
  const hash = c.takeBytes(remaining);
  c.emit(
    Codes.TELEMETRY_HASH_PRESENT,
    'info',
    'EnableTelemetry carries a password hash (redacted; digest only)',
    start,
  );
  return { reserved, hashPresent: true, digest: fnv1a64Hex(hash) };
}

/**
 * `DefineBinaryData` (87, SWF 9+): `CharacterID UI16`, `Reserved UI32` (must be 0), then `Data`
 * to the end of the tag. The payload is shipped verbatim as bytes, never as a string (`SEC-R003`).
 */
export function decodeDefineBinaryData(
  c: Cursor,
  maxBytes: number = 16 * 1024 * 1024,
): {
  readonly characterId: number;
  readonly reserved: number;
  readonly bytes: Uint8Array;
} {
  const characterId = c.u16();
  const reserved = c.u32();
  if (reserved !== 0) {
    c.emit(
      Codes.BINARY_DATA_RESERVED_NONZERO,
      'warning',
      `DefineBinaryData for character ${characterId} has reserved ${reserved} (recorded verbatim)`,
      c.offset - 6,
    );
  }
  const remaining = c.limit - c.offset;
  if (remaining > maxBytes) {
    c.emit(
      Codes.BINARY_DATA_RESERVED_NONZERO,
      'warning',
      `DefineBinaryData payload is ${remaining} bytes, exceeding the configured blob cap of ${maxBytes}; truncated`,
      c.offset,
    );
  }
  const bytes = c.takeBytes(Math.min(remaining, maxBytes));
  return { characterId, reserved, bytes };
}
