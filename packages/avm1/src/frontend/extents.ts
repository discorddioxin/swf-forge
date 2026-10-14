/**
 * Region extents — `IMPL-050-R071` (`E-035`, `E-036`).
 *
 * Four opcodes own bytes that lie **past** the record's `Length`:
 *
 * | Opcode | Record | Region after the header |
 * | --- | --- | --- |
 * | `0x9B` | `DefineFunction` | `Code[CodeSize]` |
 * | `0x8E` | `DefineFunction2` | `Code[CodeSize]` |
 * | `0x94` | `With` | `Body[Size]` |
 * | `0x8F` | `Try` | `TryBody[TrySize]`, `CatchBody[CatchSize]`, `FinallyBody[FinallySize]` |
 *
 * In every case `Length` covers only the header. A walker that stops at `Length` therefore re-decodes
 * the region as *sibling* records: the region's own ops are attributed to the enclosing block, the
 * function or region is modelled as empty, and — because a region carries no `End` of its own (R008) —
 * the enclosing block's terminator is claimed by the wrong stream (`SF0420`).
 *
 * Measured over the C4-c corpus (`audits/P5-C4-CORPUS-EXTERNAL.json`, 73 licensed AVM1 conformance
 * movies): **64 of 64** `DefineFunction*` headers end exactly at `Length`, **3 of 3** `With` records
 * declare `Length == 2`, and **3 of 3** `Try` headers end exactly at `Length`; no record had its region
 * inside `Length`. Ruffle's reader states the rule outright (`swf/src/avm1/read.rs`: "`length` is an
 * in-out parameter … The `length` passed in should be the length excluding any sub-blocks",
 * `*action_length += code_length`, `*length += try_size + catch_size + finally_size`).
 *
 * The extent is computed from the **header**, never from `Length`, and the bytes a record consumes are
 * `max(recordEnd, headerEnd + regionSize)`. That `max` is deliberate: an encoder that *does* place the
 * region inside `Length` — this repository's own fixtures did, until `E-035` was fixed — still parses,
 * because the region then ends exactly where the record does. The region is bounded by the enclosing
 * scan range (`limit`), not by the record: only a region that runs past `limit` is a defect (`SF0400`
 * for a function or `With` body, `SF0404` for `Try`'s three bodies).
 *
 * This module is deliberately free of diagnostics and of the version-sensitive string rules: it needs
 * only NUL positions, which are encoding-independent. `functions.ts` parses the same headers for their
 * *values* and must agree on the extent — `T-AVM1-FE-037` pins both readings against the same bytes.
 */

/** The four region-bearing opcodes (R071). */
export const REGION_CODES = {
  defineFunction: 0x9b,
  defineFunction2: 0x8e,
  with: 0x94,
  try: 0x8f,
} as const;

/** `true` when `code` owns a region past its `Length` (R071). */
export function isRegionCode(code: number): boolean {
  return (
    code === REGION_CODES.defineFunction ||
    code === REGION_CODES.defineFunction2 ||
    code === REGION_CODES.with ||
    code === REGION_CODES.try
  );
}

/** Where a region-bearing record's bytes end, and whether the header could be read at all. */
export interface RegionExtent {
  /** Offset of the first region byte — the offset just past the header. */
  readonly bodyStart: number;
  /** Declared region size: `CodeSize`, `Size`, or `TrySize + CatchSize + FinallySize`. */
  readonly regionSize: number;
  /** `bodyStart + regionSize`, unclamped. */
  readonly declaredEnd: number;
  /** `min(limit, declaredEnd)` — the region as the enclosing scan range actually contains it. */
  readonly bodyEnd: number;
  /**
   * Where the record walker continues: `max(recordEnd, bodyEnd)`. The `max` keeps an encoder that
   * places the region inside `Length` parseable (see the module note).
   */
  readonly consumedEnd: number;
  /** `true` when `declaredEnd > limit` — the region overruns the enclosing scan range. */
  readonly overruns: boolean;
}

function u16(bytes: Uint8Array, at: number): number {
  return (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
}

/** Offset just past a NUL-terminated string inside `[from, to)`; `null` when there is no NUL. */
function skipString(bytes: Uint8Array, from: number, to: number): number | null {
  let pos = from;
  while (pos < to && (bytes[pos] ?? 0) !== 0) pos += 1;
  return pos < to ? pos + 1 : null;
}

/**
 * `DefineFunction` (v1) / `DefineFunction2` (v2) header: `FunctionName`, `NumParams`,
 * (v2: `RegisterCount`, `Flags`), the `NumParams` parameter entries (v2 prefixes each with its
 * `REGISTERPARAM` register byte), then `CodeSize`. Returns the offset just past `CodeSize`, or `null`
 * when a field does not fit inside the record's payload.
 */
function functionHeaderEnd(bytes: Uint8Array, from: number, recordEnd: number, version2: boolean): number | null {
  let pos = from;
  const name = skipString(bytes, pos, recordEnd);
  if (name === null) return null;
  pos = name;
  if (pos + 2 > recordEnd) return null;
  const numParams = u16(bytes, pos);
  pos += 2;
  if (version2) {
    // RegisterCount UI8 + Flags UI16.
    if (pos + 3 > recordEnd) return null;
    pos += 3;
  }
  for (let i = 0; i < numParams; i += 1) {
    if (version2) {
      if (pos + 1 > recordEnd) return null;
      pos += 1;
    }
    const end = skipString(bytes, pos, recordEnd);
    if (end === null) return null;
    pos = end;
  }
  if (pos + 2 > recordEnd) return null;
  return pos + 2;
}

/**
 * `Try` header: `Flags`, `TrySize`, `CatchSize`, `FinallySize` (all three UI16 always present, R033),
 * then `CatchRegister UI8` (`CatchInRegisterFlag`) or `CatchName STRING`. Returns the offset just past
 * the header and the summed body sizes, or `null` when the header does not fit (Ruffle treats a
 * `Length` below 7 as a bogus opcode and yields an empty `Try`).
 */
function tryHeader(
  bytes: Uint8Array,
  from: number,
  recordEnd: number,
): { headerEnd: number; regionSize: number } | null {
  if (from + 7 > recordEnd) return null;
  const flags = bytes[from] ?? 0;
  const regionSize = u16(bytes, from + 1) + u16(bytes, from + 3) + u16(bytes, from + 5);
  let headerEnd = from + 7;
  const catchPresent = (flags & 0x01) !== 0;
  const catchInRegister = (flags & 0x04) !== 0;
  if (catchPresent) {
    if (catchInRegister) {
      if (headerEnd + 1 > recordEnd) return null;
      headerEnd += 1;
    } else {
      const end = skipString(bytes, headerEnd, recordEnd);
      if (end === null) return null;
      headerEnd = end;
    }
  }
  return { headerEnd, regionSize };
}

/**
 * The region a record owns past its `Length`, or `null` when `code` is not region-bearing or its header
 * cannot be read inside `[payloadStart, recordEnd)`. All offsets are in the caller's coordinate system
 * (block-relative for a block scan, region-relative for a `With`/`Try` body scan).
 *
 * @param payloadStart offset of the first payload byte (after `ActionCode` + `Length`)
 * @param recordEnd    `payloadStart + Length`
 * @param limit        end of the enclosing scan range — the bound the region must fit inside
 */
export function regionExtent(
  bytes: Uint8Array,
  code: number,
  payloadStart: number,
  recordEnd: number,
  limit: number,
): RegionExtent | null {
  let bodyStart: number;
  let regionSize: number;
  if (code === REGION_CODES.defineFunction || code === REGION_CODES.defineFunction2) {
    const headerEnd = functionHeaderEnd(bytes, payloadStart, recordEnd, code === REGION_CODES.defineFunction2);
    if (headerEnd === null) return null;
    bodyStart = headerEnd;
    regionSize = u16(bytes, headerEnd - 2);
  } else if (code === REGION_CODES.with) {
    if (payloadStart + 2 > recordEnd) return null;
    bodyStart = payloadStart + 2;
    regionSize = u16(bytes, payloadStart);
  } else if (code === REGION_CODES.try) {
    const header = tryHeader(bytes, payloadStart, recordEnd);
    if (header === null) return null;
    bodyStart = header.headerEnd;
    regionSize = header.regionSize;
  } else {
    return null;
  }
  const declaredEnd = bodyStart + regionSize;
  const bodyEnd = Math.min(limit, declaredEnd);
  return {
    bodyStart,
    regionSize,
    declaredEnd,
    bodyEnd,
    consumedEnd: Math.max(recordEnd, bodyEnd),
    overruns: declaredEnd > limit,
  };
}
