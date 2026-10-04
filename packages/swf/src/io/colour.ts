/**
 * Colour records and `LanguageCode` — `IMPL-010` §5.5.
 */

import { Codes } from '../diagnostics/codes.js';
import type { Cursor } from './cursor.js';
import type { Rgba } from './types.js';

/** `RGB`: R, G, B. Alpha defaults to 255 (`IMPL-010-R026`). */
export function readRgb(c: Cursor): Rgba {
  const r = c.u8();
  const g = c.u8();
  const b = c.u8();
  return { r, g, b, a: 255 };
}

/** `RGBA`: R, G, B, A — alpha last. */
export function readRgba(c: Cursor): Rgba {
  const r = c.u8();
  const g = c.u8();
  const b = c.u8();
  const a = c.u8();
  return { r, g, b, a };
}

/** `ARGB`: A, R, G, B — alpha first. */
export function readArgb(c: Cursor): Rgba {
  const a = c.u8();
  const r = c.u8();
  const g = c.u8();
  const b = c.u8();
  return { r, g, b, a };
}

const KNOWN_LANGUAGE_CODES = new Set([0, 1, 2, 3, 4, 5]);

/** `LanguageCode` (UI8). Unknown values are preserved and reported (`IMPL-010-R027`). */
export function readLanguageCode(c: Cursor): number {
  const value = c.u8();
  if (!KNOWN_LANGUAGE_CODES.has(value)) {
    c.emit(Codes.VALUE_OUT_OF_RANGE, 'info', `unknown LanguageCode ${value} preserved`);
  }
  return value;
}
