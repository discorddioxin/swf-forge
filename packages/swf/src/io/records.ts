/**
 * Composite records — `IMPL-010` §3.2 and §5.6–§5.8.
 *
 * Parsed by free functions so they can be unit-tested against synthetic cursors and read from any
 * position without subclassing the cursor.
 */

import { Codes } from '../diagnostics/codes.js';
import type { Cursor } from './cursor.js';
import { IDENTITY_CXFORM, type Cxform, type Mat2D, type Rect } from './types.js';

/** `RECT` — 5-bit `Nbits`, four signed fields, then byte alignment (`IMPL-010-R028`–`R030`). */
export function readRect(c: Cursor): Rect {
  const nbits = c.ub(5);
  if (nbits > 31) {
    c.emit(Codes.RECT_NBITS_INVALID, 'error', `RECT Nbits ${nbits} > 31`);
    c.align();
    return { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
  }
  const xMin = c.sb(nbits);
  const xMax = c.sb(nbits);
  const yMin = c.sb(nbits);
  const yMax = c.sb(nbits);
  c.align();
  const PLAUSIBLE = 2 ** 27;
  if (Math.abs(xMin) > PLAUSIBLE || Math.abs(xMax) > PLAUSIBLE || Math.abs(yMin) > PLAUSIBLE || Math.abs(yMax) > PLAUSIBLE) {
    c.emit(Codes.VALUE_OUT_OF_RANGE, 'info', 'RECT coordinate outside the plausible twip range');
  }
  return { xMin, xMax, yMin, yMax };
}

/**
 * `MATRIX` — absent scale defaults to 1.0 and absent rotation to 0 (`IMPL-010-R031`);
 * `fb()` already applies the fixed-point scale (`IMPL-010-R032`).
 */
export function readMatrix(c: Cursor): Mat2D {
  let a = 1;
  let d = 1;
  if (c.ub(1) === 1) {
    const nScaleBits = c.ub(5);
    a = c.fb(nScaleBits);
    d = c.fb(nScaleBits);
  }
  let b = 0;
  let cc = 0;
  if (c.ub(1) === 1) {
    const nRotateBits = c.ub(5);
    b = c.fb(nRotateBits);
    cc = c.fb(nRotateBits);
  }
  const nTranslateBits = c.ub(5);
  const tx = c.sb(nTranslateBits);
  const ty = c.sb(nTranslateBits);
  c.align();
  return { a, b, c: cc, d, tx, ty };
}

function cxform(c: Cursor, hasAlpha: boolean): Cxform {
  const hasAdd = c.ub(1) === 1;
  const hasMult = c.ub(1) === 1;
  const nbits = c.ub(4);
  const out: Cxform = { ...IDENTITY_CXFORM };
  if (hasMult) {
    out.rm = c.sb(nbits);
    out.gm = c.sb(nbits);
    out.bm = c.sb(nbits);
    if (hasAlpha) out.am = c.sb(nbits);
  }
  if (hasAdd) {
    out.ra = c.sb(nbits);
    out.ga = c.sb(nbits);
    out.ba = c.sb(nbits);
    if (hasAlpha) out.aa = c.sb(nbits);
  }
  c.align();
  if (hasMult && nbits === 0) {
    c.emit(Codes.VALUE_OUT_OF_RANGE, 'info', 'degenerate CXFORM: nBits 0 with multiply terms present (fully black)');
  }
  return out;
}

/** `CXFORM` (no alpha terms). */
export function readCxform(c: Cursor): Cxform {
  return cxform(c, false);
}

/** `CXFORMWITHALPHA`; shares one implementation with `readCxform` (`IMPL-010-R037`). */
export function readCxformWithAlpha(c: Cursor): Cxform {
  return cxform(c, true);
}
