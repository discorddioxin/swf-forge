/**
 * Operand readers — `IMPL-050` §5 (R017–R041).
 *
 * Every reader is table-driven from `opcodes.ts` schemas so the disassembler, the CFG builder and
 * the residual extractor cannot disagree about where a record ends (R017). Readers never throw;
 * each malformed shape emits its diagnostic and sets the matching residual flag.
 */

import { Codes, decodeString } from '@swf-forge/swf';
import type { Severity } from '@swf-forge/swf';

import type { ActionRecord } from './record.js';
import { expectedPayloadLength } from './opcodes.js';
import type { FunctionDefShell, ReadContext } from './functions.js';
import { decodeDefineFunction, decodeDefineFunction2 } from './functions.js';
import type { ActionIR } from './ir.js';
import type { FunctionDef } from './ir.js';

/** Accumulator for the conditions that make a function residual (R004/R005/R017). */
export interface ResidualFlags {
  truncated: boolean;
  overrun: boolean;
  unknownOpcode: boolean;
  pushMalformed: boolean;
  tryMalformed: boolean;
  registerOutOfRange: boolean;
}

export function newResidualFlags(): ResidualFlags {
  return {
    truncated: false,
    overrun: false,
    unknownOpcode: false,
    pushMalformed: false,
    tryMalformed: false,
    registerOutOfRange: false,
  };
}

export interface OperandContext {
  readonly version: number;
  /** The enclosing `DefineFunction2`'s register file, `null` outside one (R020: the 4-register rule). */
  readonly registerCount: number | null;
  readonly legacyEncoding: 'windows-1252' | 'latin1' | 'shift-jis';
  readonly emit: (code: string, severity: Severity, message: string, offset: number, context?: string) => void;
  readonly string: (bytes: Uint8Array, from: number, to: number) => { value: string; end: number } | null;
  /** Decodes a `DefineFunction*` body into its own IR (supplied by the pipeline; keeps this module acyclic). */
  readonly decodeFunctionBody: (shell: FunctionDefShell) => ActionIR | null;
  readonly flags: ResidualFlags;
}

export type PushValue =
  | { readonly type: 'string'; readonly value: string }
  | { readonly type: 'float'; readonly value: number; readonly bits: number }
  | { readonly type: 'null' }
  | { readonly type: 'undefined' }
  | { readonly type: 'register'; readonly index: number; readonly usable: boolean }
  | { readonly type: 'boolean'; readonly value: boolean }
  | { readonly type: 'double'; readonly value: number }
  | { readonly type: 'integer'; readonly value: number; readonly bits: number }
  | { readonly type: 'constant8'; readonly index: number }
  | { readonly type: 'constant16'; readonly index: number };

export interface TryHeader {
  readonly reserved: number;
  readonly catchInRegister: boolean;
  readonly finallyPresent: boolean;
  readonly catchPresent: boolean;
  readonly trySize: number;
  readonly catchSize: number;
  readonly finallySize: number;
  readonly catchName: string | null;
  readonly catchRegister: number | null;
  /** Block-relative offset just past the header (catch name/register included). */
  readonly headerEnd: number;
}

export type DecodedOp =
  | { readonly kind: 'end' }
  | { readonly kind: 'inert'; readonly code: number; readonly name: string }
  | { readonly kind: 'unknown'; readonly code: number }
  | { readonly kind: 'malformed'; readonly code: number; readonly reason: string }
  | { readonly kind: 'push'; readonly values: readonly PushValue[] }
  | { readonly kind: 'constantPool'; readonly count: number; readonly strings: readonly string[] }
  | { readonly kind: 'jump'; readonly offset: number; readonly target: number }
  | { readonly kind: 'if'; readonly offset: number; readonly target: number }
  | { readonly kind: 'return' }
  | { readonly kind: 'throw' }
  | { readonly kind: 'simple'; readonly code: number; readonly name: string }
  | { readonly kind: 'storeRegister'; readonly register: number; readonly usable: boolean }
  | { readonly kind: 'gotoFrame'; readonly frame: number }
  | { readonly kind: 'gotoLabel'; readonly label: string }
  | { readonly kind: 'setTarget'; readonly target: string }
  | { readonly kind: 'setTarget2' }
  | { readonly kind: 'getURL'; readonly url: string; readonly target: string }
  | {
      readonly kind: 'getURL2';
      readonly method: 'none' | 'get' | 'post';
      readonly loadTarget: boolean;
      readonly loadVariables: boolean;
      readonly reserved: number;
    }
  | {
      readonly kind: 'gotoFrame2';
      readonly play: boolean;
      readonly sceneBias: number | null;
      readonly reserved: number;
    }
  | { readonly kind: 'waitForFrame'; readonly frame: number; readonly skip: number }
  | { readonly kind: 'waitForFrame2'; readonly skip: number }
  | { readonly kind: 'with'; readonly size: number; readonly bodyStart: number; readonly bodyEnd: number }
  | { readonly kind: 'try'; readonly header: TryHeader }
  | { readonly kind: 'defineFunction'; readonly fn: FunctionDef };

const u16 = (bytes: Uint8Array, at: number): number => (bytes[at] ?? 0) | ((bytes[at + 1] ?? 0) << 8);
const s16 = (bytes: Uint8Array, at: number): number => {
  const value = u16(bytes, at);
  return (value & 0x8000) !== 0 ? value - 0x10000 : value;
};

function readStringAt(
  bytes: Uint8Array,
  from: number,
  to: number,
  ctx: OperandContext,
  what: string,
): { value: string; end: number } {
  const found = ctx.string(bytes, from, to);
  if (found !== null) return found;
  ctx.emit(
    Codes.ACTION_STREAM_TRUNCATED,
    'error',
    `unterminated ${what} string at block offset ${from} (SF0400)`,
    from,
  );
  ctx.flags.truncated = true;
  return { value: '', end: to };
}

/**
 * Validates a register index against the enclosing register file (R020). Returns `true` when the
 * register is usable.
 */
export function validateRegister(index: number, offset: number, what: string, ctx: OperandContext): boolean {
  if (ctx.registerCount === null) {
    if (index >= 4) {
      ctx.emit(
        Codes.REGISTER_OUTSIDE_FUNCTION,
        'warning',
        `${what}: register ${index} ≥ 4 outside a DefineFunction2 register file (treated as undefined, R020)`,
        offset,
      );
      return false;
    }
    return true;
  }
  if (index >= ctx.registerCount) {
    ctx.emit(
      Codes.REGISTER_OUT_OF_RANGE,
      'warning',
      `${what}: register ${index} is outside the ${ctx.registerCount}-register file (R020)`,
      offset,
    );
    ctx.flags.registerOutOfRange = true;
    return false;
  }
  return true;
}

function decodePush(bytes: Uint8Array, from: number, to: number, ctx: OperandContext): PushValue[] {
  const values: PushValue[] = [];
  let pos = from;
  while (pos < to) {
    const type = bytes[pos] ?? 0;
    pos += 1;
    switch (type) {
      case 0: {
        const found = ctx.string(bytes, pos, to);
        if (found === null) {
          ctx.emit(
            Codes.PUSH_MALFORMED,
            'error',
            `Push type 0 (string) is not NUL-terminated within the record (R018)`,
            pos,
          );
          ctx.flags.pushMalformed = true;
          return values;
        }
        values.push({ type: 'string', value: found.value });
        pos = found.end;
        break;
      }
      case 1: {
        if (pos + 4 > to) {
          ctx.emit(
            Codes.PUSH_MALFORMED,
            'error',
            `Push type 1 (float32) needs 4 bytes; the record ends first (R018)`,
            pos,
          );
          ctx.flags.pushMalformed = true;
          return values;
        }
        const bits =
          (bytes[pos] ?? 0) |
          ((bytes[pos + 1] ?? 0) << 8) |
          ((bytes[pos + 2] ?? 0) << 16) |
          ((bytes[pos + 3] ?? 0) << 24);
        // R019: widen to a JS double exactly — DataView yields the float32 value as a float64.
        const value = new DataView(
          new Uint8Array([bytes[pos] ?? 0, bytes[pos + 1] ?? 0, bytes[pos + 2] ?? 0, bytes[pos + 3] ?? 0]).buffer,
        ).getFloat32(0, true);
        values.push({ type: 'float', value, bits: bits >>> 0 });
        pos += 4;
        break;
      }
      case 2:
        values.push({ type: 'null' });
        break;
      case 3:
        values.push({ type: 'undefined' });
        break;
      case 4: {
        if (pos + 1 > to) {
          ctx.emit(
            Codes.PUSH_MALFORMED,
            'error',
            `Push type 4 (register) needs 1 byte; the record ends first (R018)`,
            pos,
          );
          ctx.flags.pushMalformed = true;
          return values;
        }
        const index = bytes[pos] ?? 0;
        pos += 1;
        values.push({ type: 'register', index, usable: validateRegister(index, pos - 1, 'Push type 4', ctx) });
        break;
      }
      case 5: {
        if (pos + 1 > to) {
          ctx.emit(
            Codes.PUSH_MALFORMED,
            'error',
            `Push type 5 (boolean) needs 1 byte; the record ends first (R018)`,
            pos,
          );
          ctx.flags.pushMalformed = true;
          return values;
        }
        values.push({ type: 'boolean', value: (bytes[pos] ?? 0) !== 0 });
        pos += 1;
        break;
      }
      case 6: {
        if (pos + 8 > to) {
          ctx.emit(
            Codes.PUSH_MALFORMED,
            'error',
            `Push type 6 (float64) needs 8 bytes; the record ends first (R018)`,
            pos,
          );
          ctx.flags.pushMalformed = true;
          return values;
        }
        const value = new DataView(
          new Uint8Array([
            bytes[pos] ?? 0,
            bytes[pos + 1] ?? 0,
            bytes[pos + 2] ?? 0,
            bytes[pos + 3] ?? 0,
            bytes[pos + 4] ?? 0,
            bytes[pos + 5] ?? 0,
            bytes[pos + 6] ?? 0,
            bytes[pos + 7] ?? 0,
          ]).buffer,
        ).getFloat64(0, true);
        values.push({ type: 'double', value });
        pos += 8;
        break;
      }
      case 7: {
        if (pos + 4 > to) {
          ctx.emit(
            Codes.PUSH_MALFORMED,
            'error',
            `Push type 7 (integer) needs 4 bytes; the record ends first (R018)`,
            pos,
          );
          ctx.flags.pushMalformed = true;
          return values;
        }
        const bits = u16(bytes, pos) | (u16(bytes, pos + 2) << 16);
        // R019: stored as UI32, interpreted two's-complement; the bit pattern is preserved.
        values.push({ type: 'integer', value: bits | 0, bits: bits >>> 0 });
        pos += 4;
        break;
      }
      case 8: {
        if (pos + 1 > to) {
          ctx.emit(
            Codes.PUSH_MALFORMED,
            'error',
            `Push type 8 (constant8) needs 1 byte; the record ends first (R018)`,
            pos,
          );
          ctx.flags.pushMalformed = true;
          return values;
        }
        values.push({ type: 'constant8', index: bytes[pos] ?? 0 });
        pos += 1;
        break;
      }
      case 9: {
        if (pos + 2 > to) {
          ctx.emit(
            Codes.PUSH_MALFORMED,
            'error',
            `Push type 9 (constant16) needs 2 bytes; the record ends first (R018)`,
            pos,
          );
          ctx.flags.pushMalformed = true;
          return values;
        }
        values.push({ type: 'constant16', index: u16(bytes, pos) });
        pos += 2;
        break;
      }
      default: {
        ctx.emit(
          Codes.PUSH_MALFORMED,
          'error',
          `Push type byte 0x${type.toString(16)} is unrecognised (R018)`,
          pos - 1,
        );
        ctx.flags.pushMalformed = true;
        return values;
      }
    }
  }
  return values;
}

function decodeConstantPool(
  bytes: Uint8Array,
  from: number,
  to: number,
  ctx: OperandContext,
): { count: number; strings: string[] } {
  if (from + 2 > to) {
    ctx.emit(Codes.ACTION_STREAM_TRUNCATED, 'error', 'ConstantPool is missing its Count', from);
    ctx.flags.truncated = true;
    return { count: 0, strings: [] };
  }
  const count = u16(bytes, from);
  let pos = from + 2;
  const strings: string[] = [];
  for (let i = 0; i < count; i += 1) {
    const found = ctx.string(bytes, pos, to);
    if (found === null) {
      ctx.emit(
        Codes.PUSH_MALFORMED,
        'error',
        `ConstantPool declares ${count} string(s); #${i} is not NUL-terminated within the record`,
        pos,
      );
      ctx.flags.pushMalformed = true;
      break;
    }
    strings.push(found.value);
    pos = found.end;
  }
  return { count, strings };
}

function decodeTry(bytes: Uint8Array, from: number, to: number, ctx: OperandContext): TryHeader | null {
  if (from + 8 > to) {
    ctx.emit(Codes.ACTION_STREAM_TRUNCATED, 'error', 'Try is missing its flag byte or body sizes', from);
    ctx.flags.truncated = true;
    return null;
  }
  const flagByte = bytes[from] ?? 0;
  interface TryDraft {
    reserved: number;
    catchInRegister: boolean;
    finallyPresent: boolean;
    catchPresent: boolean;
    trySize: number;
    catchSize: number;
    finallySize: number;
    catchName: string | null;
    catchRegister: number | null;
  }
  const header: TryDraft = {
    reserved: (flagByte & 0xf8) >> 3,
    catchInRegister: (flagByte & 0x04) !== 0,
    finallyPresent: (flagByte & 0x02) !== 0,
    catchPresent: (flagByte & 0x01) !== 0,
    trySize: u16(bytes, from + 1),
    catchSize: u16(bytes, from + 3),
    finallySize: u16(bytes, from + 5),
    catchName: null,
    catchRegister: null,
  };
  let pos = from + 7;
  if (header.catchPresent) {
    if (header.catchInRegister) {
      if (pos + 1 > to) {
        ctx.emit(Codes.ACTION_STREAM_TRUNCATED, 'error', 'Try catch register byte missing', pos);
        ctx.flags.truncated = true;
        return null;
      }
      header.catchRegister = bytes[pos] ?? 0;
      pos += 1;
    } else {
      const found = ctx.string(bytes, pos, to);
      if (found === null) {
        ctx.emit(Codes.ACTION_STREAM_TRUNCATED, 'error', 'Try catch name is not NUL-terminated within the record', pos);
        ctx.flags.truncated = true;
        return null;
      }
      header.catchName = found.value;
      pos = found.end;
    }
  }
  return { ...header, headerEnd: pos };
}

/**
 * Decodes one record's payload. The payload range is `[from, to)` — the record's declared bytes;
 * the caller passes `record.offset + (record.hasLength ? 3 : 1)` and `record.end`.
 */
export function decodeRecord(record: ActionRecord, bytes: Uint8Array, ctx: OperandContext): DecodedOp {
  const from = record.offset + (record.hasLength ? 3 : 1);
  const to = record.end;
  const offset = record.offset;

  if (record.overrun) {
    ctx.flags.overrun = true;
    return { kind: 'malformed', code: record.code, reason: 'overrun' };
  }

  if (record.truncated) {
    ctx.flags.truncated = true;
    return { kind: 'malformed', code: record.code, reason: 'truncated' };
  }

  if (record.code === 0x00) return { kind: 'end' };
  if (record.name === 'Unknown' && !record.observed) return { kind: 'unknown', code: record.code };
  if (record.observed) return { kind: 'inert', code: record.code, name: record.name };

  // Fixed-size payload opcodes: the declared length may exceed the table's (trailing payload
  // bytes are skipped), but never falls short (a mid-record truncation is SF0400).
  const expected = expectedPayloadLength(record.code);
  if (record.hasLength && expected !== null && record.length < expected) {
    ctx.emit(
      Codes.ACTION_STREAM_TRUNCATED,
      'error',
      `${record.name} declares ${record.length} payload byte(s); the table needs ${expected}`,
      offset,
    );
    ctx.flags.truncated = true;
    return { kind: 'malformed', code: record.code, reason: 'short-payload' };
  }

  const readU16 = (at: number): number => {
    if (at + 2 > to) {
      ctx.emit(Codes.ACTION_STREAM_TRUNCATED, 'error', `${record.name} body is truncated at block offset ${at}`, at);
      ctx.flags.truncated = true;
      return 0;
    }
    return u16(bytes, at);
  };

  switch (record.code) {
    case 0x2a: // Throw
      return { kind: 'throw' };
    case 0x3e: // Return
      return { kind: 'return' };
    case 0x99: // Jump
    case 0x9d: {
      // If
      const value = s16(bytes, from);
      const target = record.end + value;
      if (record.code === 0x99) return { kind: 'jump', offset: value, target };
      return { kind: 'if', offset: value, target };
    }
    case 0x81:
      return { kind: 'gotoFrame', frame: readU16(from) };
    case 0x8a:
      return { kind: 'waitForFrame', frame: readU16(from), skip: to - from >= 3 ? (bytes[from + 2] ?? 0) : 0 };
    case 0x8d:
      return { kind: 'waitForFrame2', skip: to - from >= 1 ? (bytes[from] ?? 0) : 0 };
    case 0x87: {
      const register = to - from >= 1 ? (bytes[from] ?? 0) : 0;
      return { kind: 'storeRegister', register, usable: validateRegister(register, offset, 'StoreRegister', ctx) };
    }
    case 0x9a: {
      const flag = to - from >= 1 ? (bytes[from] ?? 0) : 0;
      const method = (flag & 0xc0) === 0x40 ? 'get' : (flag & 0xc0) === 0x80 ? 'post' : 'none';
      return {
        kind: 'getURL2',
        method,
        loadTarget: (flag & 0x02) !== 0,
        loadVariables: (flag & 0x01) !== 0,
        reserved: flag & 0x3c,
      };
    }
    case 0x9f: {
      const flag = to - from >= 1 ? (bytes[from] ?? 0) : 0;
      let sceneBias: number | null = null;
      if ((flag & 0x02) !== 0) sceneBias = readU16(from + 1);
      return { kind: 'gotoFrame2', play: (flag & 0x01) !== 0, sceneBias, reserved: flag & 0xfc };
    }
    case 0x83: {
      const urlResult = readStringAt(bytes, from, to, ctx, 'GetURL url');
      const targetResult = readStringAt(bytes, urlResult.end, to, ctx, 'GetURL target');
      void targetResult;
      return { kind: 'getURL', url: urlResult.value, target: targetResult.value };
    }
    case 0x8b:
      return { kind: 'setTarget', target: readStringAt(bytes, from, to, ctx, 'SetTarget').value };
    case 0x20:
      return { kind: 'setTarget2' };
    case 0x8c:
      return { kind: 'gotoLabel', label: readStringAt(bytes, from, to, ctx, 'GotoLabel').value };
    case 0x96:
      return { kind: 'push', values: decodePush(bytes, from, to, ctx) };
    case 0x88: {
      const pool = decodeConstantPool(bytes, from, to, ctx);
      return { kind: 'constantPool', count: pool.count, strings: pool.strings };
    }
    case 0x94: {
      const size = readU16(from);
      const bodyStart = from + 2;
      const bodyEnd = Math.min(to, bodyStart + size);
      if (bodyStart + size > to) {
        ctx.emit(
          Codes.ACTION_STREAM_TRUNCATED,
          'error',
          `With body of ${size} byte(s) extends past the record (R032)`,
          offset,
        );
        ctx.flags.truncated = true;
      }
      return { kind: 'with', size, bodyStart, bodyEnd };
    }
    case 0x8f: {
      const header = decodeTry(bytes, from, to, ctx);
      if (header === null) return { kind: 'malformed', code: record.code, reason: 'try-header' };
      // R034 tiling: header + three bodies must consume exactly the record's payload.
      const total = header.trySize + header.catchSize + header.finallySize;
      if (header.headerEnd + total !== to) {
        ctx.emit(
          Codes.TRY_BODIES_DONT_TILE,
          'error',
          `Try bodies (header ${header.headerEnd - from} + sizes ${header.trySize}/${header.catchSize}/${header.finallySize}) do not tile the ${to - from}-byte payload (R034)`,
          offset,
        );
        ctx.flags.tryMalformed = true;
      }
      return { kind: 'try', header };
    }
    case 0x9b: {
      const fnCtx: ReadContext = {
        ...ctx,
        offset,
        markTruncated: () => {
          ctx.flags.truncated = true;
        },
      };
      const shell = decodeDefineFunction({ bytes, from, to, ctx: fnCtx });
      const ir = ctx.decodeFunctionBody(shell);
      return { kind: 'defineFunction', fn: { ...shell, ir } as FunctionDef };
    }
    case 0x8e: {
      const fnCtx: ReadContext = {
        ...ctx,
        offset,
        markTruncated: () => {
          ctx.flags.truncated = true;
        },
      };
      const shell = decodeDefineFunction2({ bytes, from, to, ctx: fnCtx });
      const ir = ctx.decodeFunctionBody(shell);
      return { kind: 'defineFunction', fn: { ...shell, ir } as FunctionDef };
    }
    default:
      return { kind: 'simple', code: record.code, name: record.name };
  }
}

/** Decodes a NUL-terminated string from the block bytes, with the swf package's version rules. */
export function makeStringReader(
  bytes: Uint8Array,
  version: number,
  legacyEncoding: 'windows-1252' | 'latin1' | 'shift-jis',
): (from: number, to: number) => { value: string; end: number } | null {
  return (from: number, to: number) => {
    let end = from;
    while (end < to && (bytes[end] ?? 0) !== 0) end += 1;
    if (end >= to) return null;
    const { decoded } = decodeString(bytes.subarray(from, end), { version, legacyEncoding });
    return { value: decoded.value, end: end + 1 };
  };
}
