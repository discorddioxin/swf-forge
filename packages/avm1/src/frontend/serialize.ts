/**
 * Action-byte serializer — `IMPL-050` §5.7 (`IMPL-050-R065`–`R069`, `WP-050-18`).
 *
 * The lossless inverse of the operand decoder: `DecodedOp`s (plus, for region-bearing records,
 * their body nodes) encode back to canonical action bytes. Canonical means (§5.7 R065): the
 * header carries the exact payload `Length`, integers use the shortest encoding, strings carry
 * exactly one NUL in the file's declared encoding, branch operands hold the offset §5.4's PC
 * rule computes for their target, and nothing follows `End` inside a record.
 *
 * Refusals (R068): `unknown` (reserved/undefined) and `malformed` ops are never re-serialized —
 * they travel the residual path as raw bytes, and this module returns `null` after reporting.
 * Non-canonical sources (R067) are never silently normalized: when a node carries its source
 * record and the canonical encoding's length differs from the declared one, the defect is
 * reported (`SF0401`) and the output is the canonical form, whose own round trip is exact (a
 * second-generation fixed point). Serialization is a pure function of its input (R069).
 */

import { Codes } from '@swf-forge/swf';

import type { ActionRecord, Emit } from './record.js';
import type { DecodedOp, LegacyStringEncoding, PushValue } from './operands.js';

export interface SerializeContext {
  readonly version: number;
  readonly legacyEncoding?: LegacyStringEncoding;
  readonly emit: Emit;
}

/** A `DecodedOp` with the body nodes a region-bearing record owns past its `Length`. */
export type SerializeNode =
  | {
      readonly op: Exclude<DecodedOp, { kind: 'with' } | { kind: 'try' } | { kind: 'defineFunction' }>;
      readonly source?: ActionRecord;
    }
  | {
      readonly op: Extract<DecodedOp, { kind: 'with' }>;
      readonly source?: ActionRecord;
      readonly body: readonly SerializeNode[];
    }
  | {
      readonly op: Extract<DecodedOp, { kind: 'try' }>;
      readonly source?: ActionRecord;
      readonly tryBody: readonly SerializeNode[];
      readonly catchBody: readonly SerializeNode[];
      readonly finallyBody: readonly SerializeNode[];
    }
  | {
      readonly op: Extract<DecodedOp, { kind: 'defineFunction' }>;
      readonly source?: ActionRecord;
      readonly body: readonly SerializeNode[];
    };

const textEncoder = new TextEncoder();

/** Reverse of the legacy decode: byte → character under windows-1252, inverted once. */
const WINDOWS_1252_REVERSE: ReadonlyMap<string, number> = (() => {
  const decoder = new TextDecoder('windows-1252');
  const map = new Map<string, number>();
  for (let byte = 0; byte < 256; byte += 1) {
    const char = decoder.decode(new Uint8Array([byte]));
    if (!map.has(char)) map.set(char, byte);
  }
  return map;
})();

function encodeString(value: string, ctx: SerializeContext): number[] {
  if (ctx.version >= 6) return [...textEncoder.encode(value)];
  const encoding = ctx.legacyEncoding ?? 'windows-1252';
  const out: number[] = [];
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (encoding === 'latin1' && code <= 0xff) {
      out.push(code);
    } else {
      const byte = WINDOWS_1252_REVERSE.get(char);
      out.push(byte ?? 0x3f); // '?' — the declared encoding cannot carry this character
    }
  }
  return out;
}

function nulString(value: string, ctx: SerializeContext): number[] {
  return [...encodeString(value, ctx), 0];
}

const u16 = (value: number): number[] => [value & 0xff, (value >> 8) & 0xff];
const s16 = (value: number): number[] => u16(value & 0xffff);
const u32 = (value: number): number[] => [
  value & 0xff,
  (value >> 8) & 0xff,
  (value >> 16) & 0xff,
  (value >> 24) & 0xff,
];

function float64Bytes(value: number): number[] {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value, true);
  return [...bytes];
}

function encodePushValue(value: PushValue, ctx: SerializeContext): number[] {
  switch (value.type) {
    case 'string':
      return [0, ...nulString(value.value, ctx)];
    case 'float':
      return [1, ...u32(value.bits)];
    case 'null':
      return [2];
    case 'undefined':
      return [3];
    case 'register':
      return [4, value.index];
    case 'boolean':
      return [5, value.value ? 1 : 0];
    case 'double':
      return [6, ...float64Bytes(value.value)];
    case 'integer':
      return [7, ...u32(value.bits)];
    case 'constant8':
      return [8, value.index];
    case 'constant16':
      return [9, ...u16(value.index)];
  }
}

function recordBytes(code: number, payload: readonly number[]): number[] {
  if (code < 0x80) return [code];
  return [code, payload.length & 0xff, (payload.length >> 8) & 0xff, ...payload];
}

interface Writer {
  readonly out: number[];
}

/** Encodes one block of nodes; returns false when any node refuses (R068). */
function encodeBlock(nodes: readonly SerializeNode[], ctx: SerializeContext, w: Writer): boolean {
  const base = w.out.length;
  for (const node of nodes) {
    if (!encodeNode(node, ctx, w, base)) return false;
  }
  return true;
}

function encodeNode(node: SerializeNode, ctx: SerializeContext, w: Writer, base: number): boolean {
  const op = node.op;
  const refuse = (code: string, reason: string): false => {
    ctx.emit(code, 'error', `serializer refusal: ${reason}`, w.out.length - base);
    return false;
  };
  switch (op.kind) {
    case 'unknown':
      return refuse(Codes.UNKNOWN_OPCODE, `undefined/reserved opcode 0x${op.code.toString(16)} stays residual (R068)`);
    case 'malformed':
      return refuse(
        Codes.ACTION_STREAM_TRUNCATED,
        `malformed record 0x${op.code.toString(16)} (${op.reason}) stays residual (R068)`,
      );
    case 'end':
      w.out.push(0x00);
      return true;
    case 'inert':
    case 'simple':
      // Defined-but-payload-free: sub-0x80 codes are the bare byte; a ≥0x80 code still carries
      // its (zero) Length field, per the framing rule that the high bit decides.
      w.out.push(...(op.code >= 0x80 ? recordBytes(op.code, []) : [op.code]));
      return true;
    case 'return':
      w.out.push(0x3e);
      return true;
    case 'throw':
      w.out.push(0x2a);
      return true;
    case 'setTarget2':
      w.out.push(0x20);
      return true;
    case 'jump':
    case 'if': {
      const code = op.kind === 'jump' ? 0x99 : 0x9d;
      // The operand counts from just past this record (§5.4); the record is 5 bytes framed.
      const recordEnd = w.out.length - base + 5;
      w.out.push(...recordBytes(code, s16(op.target - recordEnd)));
      return true;
    }
    case 'gotoFrame':
      w.out.push(...recordBytes(0x81, u16(op.frame)));
      return true;
    case 'waitForFrame':
      w.out.push(...recordBytes(0x8a, [...u16(op.frame), op.skip & 0xff]));
      return true;
    case 'waitForFrame2':
      w.out.push(...recordBytes(0x8d, [op.skip & 0xff]));
      return true;
    case 'storeRegister':
      w.out.push(...recordBytes(0x87, [op.register & 0xff]));
      return true;
    case 'getURL2': {
      const methodBits = op.method === 'get' ? 0x40 : op.method === 'post' ? 0x80 : 0;
      const flag = (op.reserved & 0x3c) | methodBits | (op.loadTarget ? 0x02 : 0) | (op.loadVariables ? 0x01 : 0);
      w.out.push(...recordBytes(0x9a, [flag]));
      return true;
    }
    case 'gotoFrame2': {
      const flag = (op.reserved & 0xfc) | (op.sceneBias !== null ? 0x02 : 0) | (op.play ? 0x01 : 0);
      const payload = op.sceneBias !== null ? [flag, ...u16(op.sceneBias)] : [flag];
      w.out.push(...recordBytes(0x9f, payload));
      return true;
    }
    case 'getURL':
      w.out.push(...recordBytes(0x83, [...nulString(op.url, ctx), ...nulString(op.target, ctx)]));
      return true;
    case 'setTarget':
      w.out.push(...recordBytes(0x8b, nulString(op.target, ctx)));
      return true;
    case 'gotoLabel':
      w.out.push(...recordBytes(0x8c, nulString(op.label, ctx)));
      return true;
    case 'push': {
      const payload: number[] = [];
      for (const value of op.values) payload.push(...encodePushValue(value, ctx));
      w.out.push(...recordBytes(0x96, payload));
      return true;
    }
    case 'constantPool': {
      const payload: number[] = [...u16(op.strings.length)];
      for (const s of op.strings) payload.push(...nulString(s, ctx));
      w.out.push(...recordBytes(0x88, payload));
      return true;
    }
    case 'with': {
      const region = node as Extract<SerializeNode, { op: { kind: 'with' } }>;
      const bodyWriter: Writer = { out: [] };
      if (!encodeBlock(region.body, ctx, bodyWriter)) return false;
      w.out.push(...recordBytes(0x94, u16(bodyWriter.out.length)), ...bodyWriter.out);
      return true;
    }
    case 'try': {
      const region = node as Extract<SerializeNode, { op: { kind: 'try' } }>;
      const bodies: Writer[] = [{ out: [] }, { out: [] }, { out: [] }];
      if (!encodeBlock(region.tryBody, ctx, bodies[0] as Writer)) return false;
      if (!encodeBlock(region.catchBody, ctx, bodies[1] as Writer)) return false;
      if (!encodeBlock(region.finallyBody, ctx, bodies[2] as Writer)) return false;
      const header = op.header;
      const flag =
        ((header.reserved & 0x1f) << 3) |
        (header.catchInRegister ? 0x04 : 0) |
        (header.finallyPresent ? 0x02 : 0) |
        (header.catchPresent ? 0x01 : 0);
      const payload: number[] = [
        flag,
        ...u16((bodies[0] as Writer).out.length),
        ...u16((bodies[1] as Writer).out.length),
        ...u16((bodies[2] as Writer).out.length),
      ];
      if (header.catchPresent) {
        if (header.catchInRegister) payload.push((header.catchRegister ?? 0) & 0xff);
        else payload.push(...nulString(header.catchName ?? '', ctx));
      }
      w.out.push(...recordBytes(0x8f, payload));
      for (const body of bodies) w.out.push(...body.out);
      return true;
    }
    case 'defineFunction': {
      const region = node as Extract<SerializeNode, { op: { kind: 'defineFunction' } }>;
      const fn = op.fn;
      const bodyWriter: Writer = { out: [] };
      if (!encodeBlock(region.body, ctx, bodyWriter)) return false;
      const codeSize = u16(bodyWriter.out.length);
      const payload: number[] = [...nulString(fn.name ?? '', ctx)];
      if (fn.version === 1) {
        payload.push(...u16(fn.params.length));
        for (const param of fn.params) payload.push(...nulString(param.name, ctx));
        payload.push(...codeSize);
        w.out.push(...recordBytes(0x9b, payload), ...bodyWriter.out);
      } else {
        payload.push(...u16(fn.params.length), fn.registerCount & 0xff, ...u16(fn.flags & 0xffff));
        for (const param of fn.params) payload.push((param.register ?? 0) & 0xff, ...nulString(param.name, ctx));
        payload.push(...codeSize);
        w.out.push(...recordBytes(0x8e, payload), ...bodyWriter.out);
      }
      return true;
    }
  }
}

/**
 * Serializes a block of decoded nodes to canonical action bytes, or returns `null` when any
 * node refuses (reserved/undefined/malformed — R068). When a node carries its source record,
 * a declared-vs-canonical length disagreement is reported (R067) and the canonical form is
 * still produced.
 */
export function serializeBlock(nodes: readonly SerializeNode[], ctx: SerializeContext): Uint8Array | null {
  checkCanonical(nodes, ctx);
  const w: Writer = { out: [] };
  if (!encodeBlock(nodes, ctx, w)) return null;
  return Uint8Array.from(w.out);
}

/**
 * R067 canonicality reporting for callers that hold the source records: compares each node's
 * declared source length against the canonical payload length implied by its op, and reports
 * the difference through `SF0401`. Kept separate from encoding so the check is testable on its
 * own; `serializeBlock` remains a pure function of the nodes (R069).
 */
export function checkCanonical(nodes: readonly SerializeNode[], ctx: SerializeContext): void {
  for (const node of nodes) {
    const source = node.source;
    if (source === undefined || !source.hasLength) continue;
    // Region-bearing records declare only their header's length (R071); their canonicality is
    // the bodies' own round trip, checked when those bodies are themselves serialized.
    if (node.op.kind === 'with' || node.op.kind === 'try' || node.op.kind === 'defineFunction') continue;
    // Canonical payload length = the encoded record minus its 3-byte header. Encoding one node
    // into a scratch writer gives exactly that.
    const scratch: Writer = { out: [] };
    if (!encodeNode(node, ctx, scratch, 0)) continue;
    const canonicalPayload = scratch.out.length - (source.code >= 0x80 ? 3 : 1);
    if (canonicalPayload !== source.length) {
      ctx.emit(
        Codes.ACTION_RECORD_OVERRUN,
        'error',
        `non-canonical record 0x${source.code.toString(16)} at block offset ${source.offset}: declared Length ${source.length}, canonical encoding is ${canonicalPayload} — re-serialized canonically (second-generation fixed point, R067)`,
        source.offset,
      );
    }
  }
}
