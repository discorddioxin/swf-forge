/**
 * `DefineFunction` / `DefineFunction2` — `IMPL-050` §5.3 (R024–R028).
 *
 * The flag masks are the single sanctioned reading (R024, APP-§10.3's trap note): the eight leading
 * flags occupy bits 0–7 of the little-endian `Flags` UI16, `PreloadGlobal` is bit 8, and `0x7E00`
 * is reserved. Register allocation follows the chapter's worked example (R026): parameters first,
 * then preloads from register 1 in the order this/arguments/super/_root/_parent/_global, then
 * locals; a preload overwriting a parameter register is implemented (the player does it) and
 * reported (`SF0416`).
 */

import { Codes } from '@swf-forge/swf';
import type { Severity } from '@swf-forge/swf';

import type { ParamSlot, PreloadFlags, RegisterSlot, SuppressFlags } from './ir.js';

/** The chapter's preload order, starting at register 1 (R026). */
export const PRELOAD_ORDER: readonly { readonly key: keyof PreloadFlags; readonly name: string }[] = [
  { key: 'this', name: 'this' },
  { key: 'arguments', name: 'arguments' },
  { key: 'super', name: 'super' },
  { key: 'root', name: '_root' },
  { key: 'parent', name: '_parent' },
  { key: 'global', name: '_global' },
];

export const DF2_MASKS = {
  preloadParent: 0x0080,
  preloadRoot: 0x0040,
  suppressSuper: 0x0020,
  preloadSuper: 0x0010,
  suppressArguments: 0x0008,
  preloadArguments: 0x0004,
  suppressThis: 0x0002,
  preloadThis: 0x0001,
  preloadGlobal: 0x0100,
  reserved: 0x7e00,
} as const;

export interface FunctionDefShell {
  readonly version: 1 | 2;
  readonly name: string | null;
  readonly paramNames: readonly string[];
  readonly registerCount: number;
  readonly flags: number;
  readonly reservedBits: number;
  readonly preloads: PreloadFlags;
  readonly suppress: SuppressFlags;
  /** Per parameter: the `REGISTERPARAM` register (v2 only), `null` = named activation variable. */
  readonly paramRegisters: readonly (number | null)[];
  readonly registers: readonly RegisterSlot[];
  readonly params: readonly ParamSlot[];
  readonly bodyStart: number;
  readonly bodyEnd: number;
}

export interface ReadContext {
  readonly emit: (code: string, severity: Severity, message: string, offset: number, context?: string) => void;
  /** NUL-terminated string within `to`; `null` when the terminator is outside the range. */
  readonly string: (bytes: Uint8Array, from: number, to: number) => { value: string; end: number } | null;
  readonly offset: number;
  /** Marks the enclosing record truncated (wired to `ResidualFlags.truncated` by the caller). */
  readonly markTruncated?: () => void;
}

function readStringField(
  bytes: Uint8Array,
  from: number,
  to: number,
  ctx: ReadContext,
): { value: string; pos: number } {
  const found = ctx.string(bytes, from, to);
  if (found === null) {
    ctx.emit(
      Codes.ACTION_STREAM_TRUNCATED,
      'error',
      `unterminated string at block offset ${ctx.offset} in function definition header`,
      ctx.offset,
    );
    ctx.markTruncated?.();
    return { value: '', pos: to };
  }
  return { value: found.value, pos: found.end };
}

export interface DecodeFunctionOptions {
  readonly bytes: Uint8Array;
  /** Block-relative start of the payload (after ActionCode + Length). */
  readonly from: number;
  /** Block-relative end of the record. */
  readonly to: number;
  readonly ctx: ReadContext;
}

function allocateRegisters(
  version: 1 | 2,
  registerCount: number,
  paramRegisters: readonly (number | null)[],
  preloads: PreloadFlags,
  ctx: ReadContext,
): RegisterSlot[] {
  if (version === 1 || registerCount === 0) return [];
  const byIndex = new Map<number, RegisterSlot>();

  // 1. Parameters into their REGISTERPARAM registers (R025: register 0 = named variable, no slot).
  for (let i = 0; i < paramRegisters.length; i += 1) {
    const register = paramRegisters[i] ?? null;
    if (register === null || register === 0) continue;
    if (register > registerCount) {
      ctx.emit(
        Codes.REGISTER_OUT_OF_RANGE,
        'warning',
        `parameter register ${register} is outside the ${registerCount}-register file (R025)`,
        ctx.offset,
      );
      continue;
    }
    byIndex.set(register, { index: register, kind: 'param', name: `param_${i}` });
  }

  // 2. Preloads from register 1 in the chapter's order (R026), overwriting parameter registers.
  let cursor = 1;
  for (const { key, name } of PRELOAD_ORDER) {
    if (!preloads[key]) continue;
    const register = cursor;
    cursor += 1;
    if (register > registerCount) {
      ctx.emit(
        Codes.REGISTER_OUT_OF_RANGE,
        'warning',
        `preload of ${name} needs register ${register} but the file only has ${registerCount}`,
        ctx.offset,
      );
      continue;
    }
    const prior = byIndex.get(register);
    if (prior !== undefined && prior.kind === 'param') {
      ctx.emit(
        Codes.REGISTER_OUT_OF_RANGE,
        'warning',
        `parameter in register ${register} is overwritten by the ${name} preload (chapter authoring rule, R026)`,
        ctx.offset,
      );
    }
    byIndex.set(register, { index: register, kind: 'preload', name });
  }

  // 3. Remaining registers are locals (registers are 1..registerCount; 0 is the named variable).
  for (let register = cursor; register <= registerCount; register += 1) {
    if (!byIndex.has(register)) byIndex.set(register, { index: register, kind: 'local', name: `r${register}` });
  }
  return [...byIndex.values()].sort((a, b) => a.index - b.index);
}

function decodePreloads(flags: number, ctx: ReadContext): { preloads: PreloadFlags; suppress: SuppressFlags } {
  const preloads: PreloadFlags = {
    this: (flags & DF2_MASKS.preloadThis) !== 0,
    arguments: (flags & DF2_MASKS.preloadArguments) !== 0,
    super: (flags & DF2_MASKS.preloadSuper) !== 0,
    root: (flags & DF2_MASKS.preloadRoot) !== 0,
    parent: (flags & DF2_MASKS.preloadParent) !== 0,
    global: (flags & DF2_MASKS.preloadGlobal) !== 0,
  };
  const suppress: SuppressFlags = {
    this: (flags & DF2_MASKS.suppressThis) !== 0,
    arguments: (flags & DF2_MASKS.suppressArguments) !== 0,
    super: (flags & DF2_MASKS.suppressSuper) !== 0,
  };
  // R027: preload + suppress of the same variable — suppression wins for the variable, the preload
  // still fills its register (the only reading that keeps register numbering intact).
  const check = (name: string, preloaded: boolean, suppressed: boolean): void => {
    if (preloaded && suppressed) {
      ctx.emit(
        Codes.DEFINE_FUNCTION2_PRELOAD_SUPPRESS,
        'warning',
        `${name} is both preloaded and suppressed; suppression wins and the preload fills its register (R027)`,
        ctx.offset,
      );
    }
  };
  check('this', preloads.this, suppress.this);
  check('arguments', preloads.arguments, suppress.arguments);
  check('super', preloads.super, suppress.super);
  return { preloads, suppress };
}

/** `DefineFunction` (0x9B): name, params, CodeSize, body. */
export function decodeDefineFunction(opts: DecodeFunctionOptions): FunctionDefShell {
  const { bytes, from, to, ctx } = opts;
  let pos = from;
  const nameResult = readStringField(bytes, pos, to, ctx);
  pos = nameResult.pos;
  if (pos + 2 > to) {
    ctx.emit(
      Codes.ACTION_STREAM_TRUNCATED,
      'error',
      `DefineFunction missing NumParams at block offset ${ctx.offset}`,
      ctx.offset,
    );
    ctx.markTruncated?.();
    return {
      version: 1,
      name: nameResult.value.length > 0 ? nameResult.value : null,
      paramNames: [],
      registerCount: 0,
      flags: 0,
      reservedBits: 0,
      preloads: { this: false, arguments: false, super: false, root: false, parent: false, global: false },
      suppress: { this: false, arguments: false, super: false },
      paramRegisters: [],
      registers: [],
      params: [],
      bodyStart: to,
      bodyEnd: to,
    };
  }
  const numParams = (bytes[pos] ?? 0) | ((bytes[pos + 1] ?? 0) << 8);
  pos += 2;
  const paramNames: string[] = [];
  for (let i = 0; i < numParams; i += 1) {
    const result = readStringField(bytes, pos, to, ctx);
    paramNames.push(result.value);
    pos = result.pos;
    if (pos >= to && i < numParams - 1) break;
  }
  if (pos + 2 > to) {
    ctx.emit(
      Codes.ACTION_STREAM_TRUNCATED,
      'error',
      `DefineFunction missing CodeSize at block offset ${ctx.offset}`,
      ctx.offset,
    );
    ctx.markTruncated?.();
    return {
      version: 1,
      name: nameResult.value.length > 0 ? nameResult.value : null,
      paramNames,
      registerCount: 0,
      flags: 0,
      reservedBits: 0,
      preloads: { this: false, arguments: false, super: false, root: false, parent: false, global: false },
      suppress: { this: false, arguments: false, super: false },
      paramRegisters: [],
      registers: [],
      params: paramNames.map((name) => ({ name, register: null })),
      bodyStart: to,
      bodyEnd: to,
    };
  }
  const codeSize = (bytes[pos] ?? 0) | ((bytes[pos + 1] ?? 0) << 8);
  pos += 2;
  const bodyEnd = Math.min(to, pos + codeSize);
  if (pos + codeSize > to) {
    ctx.emit(
      Codes.ACTION_STREAM_TRUNCATED,
      'error',
      `DefineFunction body of ${codeSize} byte(s) overruns the record (R008)`,
      ctx.offset,
    );
    ctx.markTruncated?.();
  }
  return {
    version: 1,
    name: nameResult.value.length > 0 ? nameResult.value : null,
    paramNames,
    registerCount: 0,
    flags: 0,
    reservedBits: 0,
    preloads: { this: false, arguments: false, super: false, root: false, parent: false, global: false },
    suppress: { this: false, arguments: false, super: false },
    paramRegisters: paramNames.map(() => null),
    registers: [],
    params: paramNames.map((name) => ({ name, register: null })),
    bodyStart: pos,
    bodyEnd,
  };
}

/** `DefineFunction2` (0x8E): name, params, RegisterCount, Flags, REGISTERPARAM, CodeSize, body. */
export function decodeDefineFunction2(opts: DecodeFunctionOptions): FunctionDefShell {
  const { bytes, from, to, ctx } = opts;
  let pos = from;
  const nameResult = readStringField(bytes, pos, to, ctx);
  pos = nameResult.pos;
  if (pos + 3 > to) {
    ctx.emit(
      Codes.ACTION_STREAM_TRUNCATED,
      'error',
      `DefineFunction2 missing NumParams/RegisterCount at block offset ${ctx.offset}`,
      ctx.offset,
    );
    ctx.markTruncated?.();
    return {
      version: 2,
      name: nameResult.value.length > 0 ? nameResult.value : null,
      paramNames: [],
      registerCount: 0,
      flags: 0,
      reservedBits: 0,
      preloads: { this: false, arguments: false, super: false, root: false, parent: false, global: false },
      suppress: { this: false, arguments: false, super: false },
      paramRegisters: [],
      registers: [],
      params: [],
      bodyStart: to,
      bodyEnd: to,
    };
  }
  const numParams = (bytes[pos] ?? 0) | ((bytes[pos + 1] ?? 0) << 8);
  const registerCount = bytes[pos + 2] ?? 0;
  pos += 3;
  if (pos + 2 > to) {
    ctx.emit(
      Codes.ACTION_STREAM_TRUNCATED,
      'error',
      `DefineFunction2 missing Flags at block offset ${ctx.offset}`,
      ctx.offset,
    );
    ctx.markTruncated?.();
    return {
      version: 2,
      name: nameResult.value.length > 0 ? nameResult.value : null,
      paramNames: [],
      registerCount,
      flags: 0,
      reservedBits: 0,
      preloads: { this: false, arguments: false, super: false, root: false, parent: false, global: false },
      suppress: { this: false, arguments: false, super: false },
      paramRegisters: [],
      registers: [],
      params: [],
      bodyStart: to,
      bodyEnd: to,
    };
  }
  const flags = (bytes[pos] ?? 0) | ((bytes[pos + 1] ?? 0) << 8);
  pos += 2;

  const reservedBits = flags & DF2_MASKS.reserved;
  if (reservedBits !== 0) {
    ctx.emit(
      Codes.DEFINE_FUNCTION2_RESERVED_BITS,
      'info',
      `DefineFunction2 reserved flag bits 0x${reservedBits.toString(16)} are non-zero (preserved, R024)`,
      ctx.offset,
    );
  }
  const { preloads, suppress } = decodePreloads(flags, ctx);

  // REGISTERPARAM[NumParams]: each is `Register UI8, ParamName STRING` (APP-§10.3). Register 0
  // means "create the named activation variable"; non-zero copies the param into that register.
  const paramNames: string[] = [];
  const paramRegisters: (number | null)[] = [];
  for (let i = 0; i < numParams; i += 1) {
    if (pos + 1 > to) {
      ctx.emit(
        Codes.ACTION_STREAM_TRUNCATED,
        'error',
        `DefineFunction2 REGISTERPARAM ${i} missing register byte`,
        ctx.offset,
      );
      ctx.markTruncated?.();
      paramNames.push('');
      paramRegisters.push(null);
      break;
    }
    const register = bytes[pos] ?? 0;
    pos += 1;
    const nameResult = readStringField(bytes, pos, to, ctx);
    pos = nameResult.pos;
    paramNames.push(nameResult.value.length > 0 ? nameResult.value : `param_${i}`);
    paramRegisters.push(register === 0 ? null : register);
  }

  if (pos + 2 > to) {
    ctx.emit(
      Codes.ACTION_STREAM_TRUNCATED,
      'error',
      `DefineFunction2 missing CodeSize at block offset ${ctx.offset}`,
      ctx.offset,
    );
    ctx.markTruncated?.();
    return {
      version: 2,
      name: nameResult.value.length > 0 ? nameResult.value : null,
      paramNames,
      registerCount,
      flags,
      reservedBits,
      preloads,
      suppress,
      paramRegisters,
      registers: [],
      params: paramNames.map((name, i) => ({ name, register: paramRegisters[i] ?? null })),
      bodyStart: to,
      bodyEnd: to,
    };
  }
  const codeSize = (bytes[pos] ?? 0) | ((bytes[pos + 1] ?? 0) << 8);
  pos += 2;
  const bodyEnd = Math.min(to, pos + codeSize);
  if (pos + codeSize > to) {
    ctx.emit(
      Codes.ACTION_STREAM_TRUNCATED,
      'error',
      `DefineFunction2 body of ${codeSize} byte(s) overruns the record (R008)`,
      ctx.offset,
    );
    ctx.markTruncated?.();
  }

  const registers = allocateRegisters(2, registerCount, paramRegisters, preloads, ctx);
  return {
    version: 2,
    name: nameResult.value.length > 0 ? nameResult.value : null,
    paramNames,
    registerCount,
    flags,
    reservedBits,
    preloads,
    suppress,
    paramRegisters,
    registers,
    params: paramNames.map((name, i) => ({ name, register: paramRegisters[i] ?? null })),
    bodyStart: pos,
    bodyEnd,
  };
}
