/**
 * Small control tags needed by the foundation slice — `IMPL-040` §3 (Ch.4).
 *
 * Only the tags the first vertical slice consumes are decoded here; the rest of the chapter's tags
 * follow their own work packages (`WP-040-*`).
 */

import type { Cursor } from '../io/cursor.js';
import { readRgb } from '../io/colour.js';
import type { Rgba } from '../io/types.js';

/** `SetBackgroundColor` (9). */
export function decodeSetBackgroundColor(c: Cursor): { color: Rgba } {
  const color = readRgb(c);
  if (c.limit - c.offset !== 0) {
    c.seek(c.limit);
  }
  return { color };
}

/** `FrameLabel` (43); SWF 6+ may append the named-anchor byte. */
export function decodeFrameLabel(c: Cursor): { name: string; namedAnchor: boolean; version: number } {
  const name = c.string();
  let namedAnchor = false;
  if (c.limit - c.offset >= 1) {
    const byte = c.u8();
    namedAnchor = (byte & 0x01) !== 0;
  }
  return { name, namedAnchor, version: c.version };
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

/** `FileAttributes` (69) — 32 bits, or a shorter legacy form (`SEC-D09`). */
export function decodeFileAttributes(c: Cursor): FileAttributesInfo {
  const available = c.limit - c.offset;
  const bitLength = Math.min(32, available * 8);
  const raw = c.ub(bitLength);
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
