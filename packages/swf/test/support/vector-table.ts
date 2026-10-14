/**
 * `IMPL-010` §8 primitive vectors, expressed **once** so the Node lane and the browser lane assert
 * the identical cases (`IMPL-010` §11 criterion 1; `audits/P0-AUDIT-RESOLUTION.md` `R-P0-02`:
 * "reusing the same vector definitions so Node and browser run identical cases").
 *
 * This module is deliberately engine-agnostic: it imports only the production reader surface
 * (`@swf-forge/swf`, which has no `node:` imports outside `src/node/`) and no filesystem, so the
 * same rows run under `vitest.config.ts` (Node) and `vitest.browser.config.ts` (headless Chromium).
 *
 * ## Provenance of every byte in this table
 *
 * Nothing here is invented. Each row's `provenance` says where its bytes come from:
 *
 * - `doc-literal` — the hex is printed verbatim in the `IMPL-010` §8 "Bytes (hex)" column.
 * - `appendix-a` — the bytes are the committed 79-byte worked example, quoted verbatim from
 *   `IMPL-140` §2.1 (`fixtures/appendix-a.swf`, `T-TST-102`). Embedded here rather than read from
 *   disk because the browser lane has no filesystem.
 * - `derived-field-order` — §8 gives the *value* and the bit pattern but not the packed bytes; the
 *   packing is the mechanical MSB-first accumulation of `IMPL-010` §4.1, and the derivation is
 *   written out in the row's comment so a reviewer can check it without running anything.
 *
 * ## Expected values
 *
 * `expected` is the **canonical string** form of the value the specification requires, so that a
 * comparison is exact and never locale- or engine-dependent (`IMPL-010-R012`): `-0` and `0` are
 * distinct, `NaN` is named rather than compared, and `Infinity` is spelled out. `canonicalNumber`
 * is the only place that turns a `number` into text.
 *
 * `docExpected` is the §8 "Expected" column **verbatim**. Where the two disagree the row is a
 * documentation discrepancy, reported by `docTableDiscrepancies()` and asserted in the cross-lane
 * suite — it is never silently absorbed (`IMPL-R001`, `audits/P0-AUDIT-RESOLUTION.md` §3).
 */

import { Codes, Cursor, readArgb, readCxform, readMatrix, readRect } from '@swf-forge/swf';
import type { Cxform, Mat2D, Rect, Rgba } from '@swf-forge/swf';

/** Where a row's bytes come from. See the module header. */
export type VectorProvenance = 'doc-literal' | 'appendix-a' | 'derived-field-order';

/** Exact, engine-independent text form of a JS number: `-0`, `NaN` and both infinities are named. */
export function canonicalNumber(value: number): string {
  if (Number.isNaN(value)) return 'NaN';
  if (Object.is(value, -0)) return '-0';
  return String(value);
}

export const canonicalRect = (r: Rect): string =>
  `Rect(xMin=${r.xMin}, xMax=${r.xMax}, yMin=${r.yMin}, yMax=${r.yMax})`;

export const canonicalMat2D = (m: Mat2D): string =>
  `Mat2D(a=${canonicalNumber(m.a)}, b=${canonicalNumber(m.b)}, c=${canonicalNumber(m.c)}, ` +
  `d=${canonicalNumber(m.d)}, tx=${canonicalNumber(m.tx)}, ty=${canonicalNumber(m.ty)})`;

export const canonicalCxform = (c: Cxform): string =>
  `Cxform(rm=${c.rm}, gm=${c.gm}, bm=${c.bm}, am=${c.am}, ra=${c.ra}, ga=${c.ga}, ba=${c.ba}, aa=${c.aa})`;

export const canonicalRgba = (c: Rgba): string => `Rgba(r=${c.r}, g=${c.g}, b=${c.b}, a=${c.a})`;

export interface VectorRow {
  /** Stable row id, used in test names and in the cross-engine fingerprint. */
  readonly id: string;
  /** The `IMPL-010` §8 "Value" cell, verbatim. */
  readonly row: string;
  /** The `IMPL-010` §8 "Source" cell, verbatim. */
  readonly source: string;
  readonly provenance: VectorProvenance;
  /** Input bytes. */
  readonly bytes: readonly number[];
  /** Canonical value the specification requires. */
  readonly expected: string;
  /** The §8 "Expected" cell, verbatim. */
  readonly docExpected: string;
  /**
   * True when `docExpected` is a single scalar that can be compared with `expected` exactly. False
   * for rows whose Expected cell is prose, a record dump, or a value-plus-diagnostic pair.
   */
  readonly docComparable: boolean;
  /** Diagnostic codes the row must also produce (`IMPL-010-R002`: no `SF####` literal outside `codes.ts`). */
  readonly diagnostics: readonly string[];
  /** Read the row through the production reader and canonicalise the result. The caller owns the
   * `Cursor`, so it can also assert the diagnostics the row must produce. */
  readonly read: (cursor: Cursor) => string;
}

/** §8 `FLOAT16` rows share one reader; `SF0015` is required for every NaN/Inf payload (`IMPL-010-R019`). */
const float16Row = (
  id: string,
  bytes: readonly number[],
  expected: string,
  docExpected: string,
  special: boolean,
): VectorRow => ({
  id,
  row: `FLOAT16 \`${bytes.map((b) => b.toString(16).padStart(2, '0')).join(' ')}\``,
  source: 'E-004',
  provenance: 'doc-literal',
  bytes,
  expected,
  docExpected,
  docComparable: false,
  diagnostics: special ? [Codes.FLOAT16_SPECIAL] : [],
  read: (c) => canonicalNumber(c.float16()),
});

/**
 * The `IMPL-010` §8 vector table.
 *
 * Row order follows the document, so a reviewer can read the two side by side.
 */
export const VECTOR_ROWS: readonly VectorRow[] = [
  {
    id: 'ui32',
    row: '`UI32` `0x456e7120`',
    source: 'Ch.1',
    provenance: 'doc-literal',
    bytes: [0x20, 0x71, 0x6e, 0x45],
    // Little-endian per IMPL-010 §4.1: 0x456e7120 = 1164865824. The §8 "Expected" cell prints
    // 1163342112 (= 0x45573120), which matches neither the row's own hex nor its bytes — filed as
    // errata `E-033` (open) and pinned in VECTOR_TABLE_DISCREPANCIES. The reader is asserted against
    // the bytes, per E-025's rule that the bytes are authoritative, not against the disputed decimal.
    expected: '1164865824',
    docExpected: '1163342112',
    docComparable: true,
    diagnostics: [],
    read: (c) => canonicalNumber(c.u32()),
  },
  {
    id: 'ui16',
    row: '`UI16` `0xe712`',
    source: 'Ch.1',
    provenance: 'doc-literal',
    bytes: [0x12, 0xe7],
    expected: '59154',
    docExpected: '59154',
    docComparable: true,
    diagnostics: [],
    read: (c) => canonicalNumber(c.u16()),
  },
  {
    id: 'ui24',
    row: '`UI24` `0x123456`',
    source: 'type table',
    provenance: 'doc-literal',
    bytes: [0x56, 0x34, 0x12],
    expected: '1193046',
    docExpected: '1193046',
    docComparable: true,
    diagnostics: [],
    read: (c) => canonicalNumber(c.u24()),
  },
  {
    id: 'fixed-7.5',
    row: '`FIXED` `7.5`',
    source: 'Ch.1',
    provenance: 'doc-literal',
    bytes: [0x00, 0x80, 0x07, 0x00],
    // s32 little-endian = 0x00078000 = 491520; 491520 / 65536 = 7.5 exactly (IMPL-010 §5.3).
    expected: '7.5',
    docExpected: '7.5',
    docComparable: true,
    diagnostics: [],
    read: (c) => canonicalNumber(c.fixed()),
  },
  {
    id: 'encoded-u32-0x7f',
    row: '`EncodedU32` `0x7F`',
    source: 'derived',
    provenance: 'doc-literal',
    bytes: [0x7f],
    expected: '127',
    docExpected: '127',
    docComparable: true,
    diagnostics: [],
    read: (c) => canonicalNumber(c.encodedU32()),
  },
  {
    id: 'encoded-u32-300',
    row: '`EncodedU32` `300`',
    source: 'derived',
    provenance: 'doc-literal',
    bytes: [0xac, 0x02],
    expected: '300',
    docExpected: '300',
    docComparable: true,
    diagnostics: [],
    read: (c) => canonicalNumber(c.encodedU32()),
  },
  {
    id: 'encoded-u32-max',
    row: '`EncodedU32` `0xFFFFFFFF`',
    source: 'derived',
    provenance: 'doc-literal',
    bytes: [0xff, 0xff, 0xff, 0xff, 0x0f],
    expected: '4294967295',
    docExpected: '4294967295',
    docComparable: true,
    diagnostics: [],
    read: (c) => canonicalNumber(c.encodedU32()),
  },
  {
    id: 'encoded-u32-overlong',
    row: '`EncodedU32` overlong',
    source: 'IMPL-010-R013',
    provenance: 'doc-literal',
    bytes: [0x80, 0x80, 0x80, 0x80, 0x80],
    expected: '0',
    docExpected: '0 + `SF0009`',
    docComparable: false,
    diagnostics: [Codes.ENCODED_U32_OVERLONG],
    read: (c) => canonicalNumber(c.encodedU32()),
  },
  {
    id: 'ub4',
    row: '`UB[4]` `1110····`',
    source: 'Ch.1',
    // §8 gives the bit pattern, not the packed byte. MSB-first accumulation (§4.1) of `1110` in the
    // high nibble with zero padding gives 0b1110_0000 = 0xe0.
    provenance: 'derived-field-order',
    bytes: [0xe0],
    expected: '14',
    docExpected: '14',
    docComparable: true,
    diagnostics: [],
    read: (c) => canonicalNumber(c.ub(4)),
  },
  {
    id: 'sb4',
    row: '`SB[4]` `1110····`',
    source: 'Ch.1',
    provenance: 'derived-field-order',
    bytes: [0xe0],
    // ub(4) = 14; 14 >= 2^3 so sb(4) = 14 - 16 = -2 (IMPL-010 §5.2).
    expected: '-2',
    docExpected: '-2',
    docComparable: true,
    diagnostics: [],
    read: (c) => canonicalNumber(c.sb(4)),
  },
  {
    id: 'sb7',
    row: '`SB[7]` `0100011·`',
    source: 'Ch.1',
    // `0100011` + one padding bit = 0b0100_0110 = 0x46.
    provenance: 'derived-field-order',
    bytes: [0x46],
    expected: '35',
    docExpected: '35',
    docComparable: true,
    diagnostics: [],
    read: (c) => canonicalNumber(c.sb(7)),
  },
  {
    id: 'fb19',
    row: '`FB[19]` `0x30000`',
    source: 'Ch.1',
    // §8 and IMPL-010-R017 state the 19-bit pattern is `0x30000` = 196608. Packed MSB-first into 19
    // bits (bit18=0, bit17=1, bit16=1, bits15..0=0) => 0b0110_0000 0000_0000 0000_0000 = 60 00 00.
    // fb(19) = sb(19) / 65536 = 196608 / 65536 = 3 exactly.
    provenance: 'derived-field-order',
    bytes: [0x60, 0x00, 0x00],
    expected: '3',
    docExpected: '3.0',
    docComparable: true,
    diagnostics: [],
    read: (c) => canonicalNumber(c.fb(19)),
  },
  float16Row('float16-1.0', [0x00, 0x3c], '1', '1.0', false),
  float16Row('float16-1.5', [0x00, 0x3e], '1.5', '1.5', false),
  float16Row('float16-subnormal', [0x01, 0x00], '5.960464477539063e-8', '2^-24 ≈ 5.960464477539063e-8', false),
  float16Row('float16-pos-inf', [0x00, 0x7c], 'Infinity', '+∞', true),
  float16Row('float16-neg-inf', [0x00, 0xfc], '-Infinity', '-∞', true),
  float16Row('float16-nan', [0x00, 0x7e], 'NaN', 'NaN', true),
  float16Row('float16-neg-zero', [0x00, 0x80], '-0', '-0', false),
  {
    id: 'rect-appendix-a-frame-size',
    row: '`RECT` (Appendix A header `FrameSize`)',
    source: 'IMPL-140 §2.1 / App. A p.224',
    provenance: 'appendix-a',
    // `78 00 05 5F 00 00 0F A0 00` — 65 bits of payload + 7 zero padding bits (9 bytes), the
    // trailing-align rule of IMPL-010-R028 and errata E-001's field order.
    bytes: [0x78, 0x00, 0x05, 0x5f, 0x00, 0x00, 0x0f, 0xa0, 0x00],
    expected: 'Rect(xMin=0, xMax=11000, yMin=0, yMax=8000)',
    docExpected: '`Nbits` 15; Xmin 0, Xmax 11000, Ymin 0, Ymax 8000 twips (550×400 px)',
    docComparable: false,
    diagnostics: [],
    read: (c) => canonicalRect(readRect(c)),
  },
  {
    id: 'rect-appendix-a-shape-bounds',
    row: '`RECT` (Appendix A `DefineShape` bounds)',
    source: 'IMPL-140 §2.1 / App. A p.227',
    provenance: 'appendix-a',
    // `70 FB 49 97 0D 0C 7D 50` — Nbits 14, 61 bits of payload + 3 padding bits (8 bytes).
    bytes: [0x70, 0xfb, 0x49, 0x97, 0x0d, 0x0c, 0x7d, 0x50],
    expected: 'Rect(xMin=2010, xMax=4910, yMin=1670, yMax=4010)',
    docExpected: 'id 1; bounds `Nbits` 14 = 2010, 4910, 1670, 4010 twips',
    docComparable: false,
    diagnostics: [],
    read: (c) => canonicalRect(readRect(c)),
  },
  {
    id: 'matrix-appendix-a-empty',
    row: '`MATRIX` (Appendix A `PlaceObject2` "empty matrix byte `00`")',
    source: 'IMPL-140 §2.1 / App. A p.234',
    provenance: 'appendix-a',
    // hasScale=0, hasRotate=0, nTranslateBits=0 => 7 bits consumed, then align() (§5.7). Absent
    // scale MUST default to 1.0, not 0 (IMPL-010-R031) — the highest-frequency MATRIX bug.
    bytes: [0x00],
    expected: 'Mat2D(a=1, b=0, c=0, d=1, tx=0, ty=0)',
    docExpected: 'empty matrix byte `00`',
    docComparable: false,
    diagnostics: [],
    read: (c) => canonicalMat2D(readMatrix(c)),
  },
  {
    id: 'cxform-identity',
    row: '`CXFORM` identity',
    source: 'IMPL-010-R036',
    // §8 gives the flags (`hasMult=0, hasAdd=0`) rather than bytes. §5.8's field order is
    // hasAdd=ub(1), hasMult=ub(1), nBits=ub(4) => all zero packs to the single byte 0x00, and the
    // absent multiply terms default to 256 (8.8 domain, 256 == 1.0).
    provenance: 'derived-field-order',
    bytes: [0x00],
    expected: 'Cxform(rm=256, gm=256, bm=256, am=256, ra=0, ga=0, ba=0, aa=0)',
    docExpected: '`rm=gm=bm=am=256, add=0`',
    docComparable: false,
    diagnostics: [],
    read: (c) => canonicalCxform(readCxform(c)),
  },
  {
    id: 'string-utf8',
    row: '`STRING` UTF-8',
    source: 'Ch.1',
    provenance: 'doc-literal',
    bytes: [0x41, 0x42, 0xc3, 0xa9, 0x00],
    expected: 'ABé',
    docExpected: '"ABé"',
    docComparable: false,
    diagnostics: [],
    read: (c) => c.string({ version: 6 }),
  },
  {
    id: 'string-legacy-cp1252',
    row: '`STRING` legacy',
    source: 'IMPL-010-R023',
    provenance: 'doc-literal',
    bytes: [0x41, 0xe9, 0x00],
    expected: 'Aé',
    docExpected: '"Aé" + `SF0012`',
    docComparable: false,
    // SWF <= 5 stores no encoding selector: the decode is Windows-1252 by policy and MUST report
    // the chosen encoding once per movie (IMPL-010-R023, AVM1-D01). TextDecoder('windows-1252') is
    // a WHATWG-encoding API, present in both Node and the browser — which is exactly why this row
    // belongs in the cross-lane table.
    diagnostics: [Codes.LEGACY_STRING_ENCODING],
    read: (c) => c.string({ version: 5 }),
  },
  {
    id: 'argb',
    row: '`ARGB`',
    source: 'Ch.1',
    provenance: 'doc-literal',
    bytes: [0xff, 0x11, 0x22, 0x33],
    // Alpha first (IMPL-010 §5.5) — the trap this row exists to catch.
    expected: 'Rgba(r=17, g=34, b=51, a=255)',
    docExpected: '{r:0x11,g:0x22,b:0x33,a:0xff}',
    docComparable: false,
    diagnostics: [],
    read: (c) => canonicalRgba(readArgb(c)),
  },
];

/**
 * Rows whose §8 "Expected" cell does not match the value its own bytes require.
 *
 * These are **documentation** discrepancies, not reader defects: the reader is asserted against the
 * bytes, and the disagreement is surfaced here so it is resolved through the errata process
 * (`IMPL-R001`, `docs/impl/registers/errata.md`) instead of being encoded into a test as though the
 * document were right. `docTableDiscrepancies()` derives this list mechanically, so fixing §8 makes
 * the cross-lane suite fail until the entry is removed — the table cannot rot silently.
 */
export interface VectorTableDiscrepancy {
  readonly id: string;
  readonly row: string;
  readonly docExpected: string;
  readonly requiredByBytes: string;
  readonly note: string;
}

/** Every row whose verbatim §8 Expected cell disagrees with the value its bytes require. */
export function docTableDiscrepancies(): readonly VectorRow[] {
  return VECTOR_ROWS.filter((v) => v.docComparable && v.docExpected.trim() !== v.expected);
}

/**
 * Pinned discrepancies, with the resolution each needs. Asserted by the cross-lane suite: adding a
 * new one fails the suite until it is dispositioned here and in the owning document.
 */
export const VECTOR_TABLE_DISCREPANCIES: readonly VectorTableDiscrepancy[] = [
  {
    id: 'ui32',
    row: '`UI32` `0x456e7120` / `20 71 6e 45`',
    docExpected: '1163342112',
    requiredByBytes: '1164865824 (= 0x456e7120, the row\'s own "Value" cell)',
    note:
      "The Expected decimal equals 0x45573120, which matches neither the row's hex label nor its " +
      'byte pattern, so the decimal is the inconsistent field. Filed as errata `E-033` (open): ' +
      'whether upstream Ch.1 prints the same mismatch (an E-025-class typesetting defect) or this is ' +
      "our transcription cannot be settled without the chapter text. Until it is, E-025's rule " +
      'applies provisionally — the bytes are authoritative — `IMPL-010` §8 carries the row annotated ' +
      'as disputed rather than overwritten, and this row is reported rather than absorbed.',
  },
  {
    id: 'fb19',
    row: '`FB[19]` `0x30000`',
    docExpected: '3.0',
    requiredByBytes: '3',
    note:
      'Not a defect: the same real number, printed with a trailing ".0" in the document and by ' +
      'canonicalNumber() without one. Listed so the mechanical check in the cross-lane suite has an ' +
      'explicit, reviewed disposition instead of a silent string mismatch.',
  },
];

/**
 * A single stable string summarising every row's result, in table order.
 *
 * Both lanes compute it and compare it against `EXPECTED_FINGERPRINT`, so cross-engine agreement is
 * one assertion rather than a per-row coincidence: if Chromium and Node disagreed about `-0`, `NaN`,
 * `TextDecoder('windows-1252')`, `DataView` endianness or `>>> 0`, the fingerprint would differ.
 */
export function vectorFingerprint(): string {
  return VECTOR_ROWS.map((row) => `${row.id}=${row.read(new Cursor(Uint8Array.from(row.bytes)))}`).join('|');
}

/**
 * The fingerprint produced by the production readers. Pinned from the Node lane and asserted
 * unchanged by the browser lane (`IMPL-010` §11 criterion 1). Regenerate deliberately, with a
 * rationale, if a reader's behaviour is corrected — never to make a red lane green
 * (`audits/P0-AUDIT-RESOLUTION.md` §3).
 */
export const EXPECTED_FINGERPRINT =
  'ui32=1164865824|ui16=59154|ui24=1193046|fixed-7.5=7.5|encoded-u32-0x7f=127|encoded-u32-300=300|' +
  'encoded-u32-max=4294967295|encoded-u32-overlong=0|ub4=14|sb4=-2|sb7=35|fb19=3|float16-1.0=1|' +
  'float16-1.5=1.5|float16-subnormal=5.960464477539063e-8|float16-pos-inf=Infinity|' +
  'float16-neg-inf=-Infinity|float16-nan=NaN|float16-neg-zero=-0|' +
  'rect-appendix-a-frame-size=Rect(xMin=0, xMax=11000, yMin=0, yMax=8000)|' +
  'rect-appendix-a-shape-bounds=Rect(xMin=2010, xMax=4910, yMin=1670, yMax=4010)|' +
  'matrix-appendix-a-empty=Mat2D(a=1, b=0, c=0, d=1, tx=0, ty=0)|' +
  'cxform-identity=Cxform(rm=256, gm=256, bm=256, am=256, ra=0, ga=0, ba=0, aa=0)|' +
  'string-utf8=ABé|string-legacy-cp1252=Aé|argb=Rgba(r=17, g=34, b=51, a=255)';

/**
 * Which JavaScript host the current lane is running in, without referencing DOM types (the package
 * tsconfig compiles with `lib: ["ES2022"]`, `REPO-R012`, so `window`/`navigator` are not declared).
 */
export function laneName(): 'browser' | 'node' {
  const globals = globalThis as Record<string, unknown>;
  return typeof globals['window'] === 'object' && typeof globals['Buffer'] === 'undefined' ? 'browser' : 'node';
}
