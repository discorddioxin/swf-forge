/**
 * Test harness for the AVM1 front end: builds raw action-byte blocks from a small record DSL.
 *
 * A record is either a single sub-0x80 opcode byte, or `0x80+` code + 16-bit little-endian
 * `Length` + payload (`IMPL-050-R003`). Helpers assemble the common payloads (Push pairs, pools,
 * branches, `Try`/`With` bodies, `DefineFunction2`) so the tests read like pseudocode.
 */

import { analyzeActionBlock, type AnalyzedBlock, type BlockKind, type Operand } from '../src/index.js';

// ---- byte primitives --------------------------------------------------------------------------------------

export function rec(code: number, payload: readonly number[] = []): number[] {
  if (code < 0x80) return [code];
  const p = [...payload];
  return [code, p.length & 0xff, (p.length >> 8) & 0xff, ...p];
}

export function block(...records: readonly number[][]): Uint8Array {
  return Uint8Array.from([...records.flat(), 0x00]);
}

/** A block with no terminating `End` (R006: tolerated, `SF0420`). */
export function blockNoEnd(...records: readonly number[][]): Uint8Array {
  return Uint8Array.from(records.flat());
}

// ---- strings ----------------------------------------------------------------------------------------------

export function ascii(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i += 1) out.push(s.charCodeAt(i) & 0xff);
  return out;
}

/** A NUL-terminated string as raw bytes (without the Push type byte). */
export function nul(s: string): number[] {
  return [...ascii(s), 0];
}

// ---- Push (0x96) --------------------------------------------------------------------------------------------

/** One `(type, value)` pair as raw bytes. The value excludes the type byte. */
export function pair(type: number, value: readonly number[]): number[] {
  return [type, ...value];
}

/** A full `Push` record carrying one or more pairs. `rec` derives the Length from the pair bytes. */
export function push(...pairs: readonly number[][]): number[] {
  return rec(0x96, pairs.flat());
}

export function pushString(s: string): number[] {
  return push(pair(0, nul(s)));
}

export function pushDouble(value: number): number[] {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setFloat64(0, value, true);
  return push(pair(6, [...bytes]));
}

export function pushInt(value: number): number[] {
  const b = value >>> 0;
  return push(pair(7, [b & 0xff, (b >> 8) & 0xff, (b >> 16) & 0xff, (b >> 24) & 0xff]));
}

export function pushNull(): number[] {
  return push(pair(2, []));
}

export function pushUndefined(): number[] {
  return push(pair(3, []));
}

export function pushBoolean(value: boolean): number[] {
  return push(pair(5, [value ? 1 : 0]));
}

export function pushRegister(index: number): number[] {
  return push(pair(4, [index & 0xff]));
}

export function pushFloat(value: number): number[] {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setFloat32(0, value, true);
  return push(pair(1, [...bytes]));
}

export function pushConstant8(index: number): number[] {
  return push(pair(8, [index & 0xff]));
}

export function pushConstant16(index: number): number[] {
  return push(pair(9, [index & 0xff, (index >> 8) & 0xff]));
}

/** A `Push` whose declared `Length` is wrong by `delta` (positive = overrun, negative = short). */
export function pushMalformed(pairs: readonly number[][], delta: number): number[] {
  const body = pairs.flat();
  const declared = body.length + delta;
  // Raw bytes: rec would recompute Length from the payload, so emit the header by hand.
  return [0x96, declared & 0xff, (declared >> 8) & 0xff, ...body];
}

// ---- constant pool (0x88) ------------------------------------------------------------------------------------

export function constantPool(...strings: readonly string[]): number[] {
  const body = strings.flatMap((s) => nul(s));
  const count = strings.length;
  return rec(0x88, [count & 0xff, (count >> 8) & 0xff, ...body]);
}

// ---- branches (offsets are relative to the record's END) --------------------------------------------------------

export function jump(delta: number): number[] {
  const v = delta & 0xffff;
  return rec(0x99, [v & 0xff, (v >> 8) & 0xff]);
}

export function branchIf(delta: number): number[] {
  const v = delta & 0xffff;
  return rec(0x9d, [v & 0xff, (v >> 8) & 0xff]);
}

// ---- targets ----------------------------------------------------------------------------------------------

export function setTarget(s: string): number[] {
  return rec(0x8b, nul(s));
}

export function gotoLabel(s: string): number[] {
  return rec(0x8c, nul(s));
}

export function gotoFrame(frame: number): number[] {
  return rec(0x81, [frame & 0xff, (frame >> 8) & 0xff]);
}

export function getURL(url: string, target: string): number[] {
  return rec(0x83, [...nul(url), ...nul(target)]);
}

// ---- regions ----------------------------------------------------------------------------------------------

/** A `With` record: `Size UI16` then `Size` body bytes. */
export function withRegion(size: number, body: readonly number[]): number[] {
  return rec(0x94, [size & 0xff, (size >> 8) & 0xff, ...body]);
}

export interface TrySpec {
  catchInRegister?: boolean;
  catchName?: string;
  catchRegister?: number;
  finallyPresent?: boolean;
  try: readonly number[];
  catch?: readonly number[];
  finally?: readonly number[];
}

/**
 * A `Try` record: one flag byte (Reserved UB[5] + CatchInRegister UB[1] + Finally UB[1] +
 * Catch UB[1]), TrySize/CatchSize/FinallySize (all UI16, always present), then catch name
 * (register flag 0) or register (register flag 1), then the three bodies tiled.
 */
export function tryRegion(spec: TrySpec): number[] {
  const flags =
    (spec.catchInRegister === true ? 0x04 : 0) |
    (spec.finallyPresent === true ? 0x02 : 0) |
    (spec.catch !== undefined ? 0x01 : 0);
  const trySize = spec.try.length;
  const catchSize = spec.catch?.length ?? 0;
  const finallySize = spec.finally?.length ?? 0;
  const body: number[] = [flags];
  body.push(trySize & 0xff, (trySize >> 8) & 0xff);
  body.push(catchSize & 0xff, (catchSize >> 8) & 0xff);
  body.push(finallySize & 0xff, (finallySize >> 8) & 0xff);
  if (spec.catch !== undefined) {
    if (spec.catchInRegister === true) body.push(spec.catchRegister ?? 0);
    else body.push(...nul(spec.catchName ?? ''));
  }
  body.push(...spec.try, ...(spec.catch ?? []), ...(spec.finally ?? []));
  return rec(0x8f, body);
}

// ---- DefineFunction2 (0x8e) ------------------------------------------------------------------------------------

export interface DF2Spec {
  name?: string;
  params?: readonly string[];
  registerCount?: number;
  flags?: number;
  /** `REGISTERPARAM` register per param (length must equal params.length). */
  paramRegisters?: readonly (number | null)[];
  body: readonly number[];
}

export function defineFunction2(spec: DF2Spec): number[] {
  const params = spec.params ?? [];
  const regCount = spec.registerCount ?? 0;
  const flags = spec.flags ?? 0;
  const code = spec.body;
  const body: number[] = [];
  body.push(...nul(spec.name ?? '')); // FunctionName STRING
  body.push(params.length & 0xff, (params.length >> 8) & 0xff); // NumParams UI16
  body.push(regCount & 0xff); // RegisterCount UI8
  body.push(flags & 0xff, (flags >> 8) & 0xff); // Flags UI16
  // REGISTERPARAM[NumParams]: Register UI8, ParamName STRING
  for (let i = 0; i < params.length; i += 1) {
    body.push((spec.paramRegisters?.[i] ?? 0) & 0xff);
    body.push(...nul(params[i] ?? ''));
  }
  body.push(code.length & 0xff, (code.length >> 8) & 0xff); // CodeSize UI16
  body.push(...code);
  return rec(0x8e, body);
}

/** A `DefineFunction` (0x9b): name, NumParams UI16, param names, CodeSize UI16, body. */
export function defineFunction(spec: { name?: string; params?: readonly string[]; body: readonly number[] }): number[] {
  const params = spec.params ?? [];
  const code = spec.body;
  const body: number[] = [];
  body.push(...nul(spec.name ?? ''));
  body.push(params.length & 0xff, (params.length >> 8) & 0xff);
  for (const p of params) body.push(...nul(p));
  body.push(code.length & 0xff, (code.length >> 8) & 0xff);
  body.push(...code);
  return rec(0x9b, body);
}

// ---- diagnostics ----------------------------------------------------------------------------------------

export interface Diag {
  code: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  offset: number;
  context?: string | undefined;
}

export type EmitFn = (
  code: string,
  severity: 'error' | 'warning' | 'info',
  message: string,
  offset: number,
  context?: string,
) => void;

/** A collecting `Emit` for tests: `diag.fn` to pass in, `diag.all` to assert on. */
export function collector(): { fn: EmitFn; all: Diag[]; has: (code: string) => boolean; codes: () => string[] } {
  const all: Diag[] = [];
  const fn: EmitFn = (code, severity, message, offset, context) => {
    all.push({ code, severity, message, offset, context });
  };
  return { fn, all, has: (code) => all.some((d) => d.code === code), codes: () => all.map((d) => d.code) };
}

// ---- analyze wrapper --------------------------------------------------------------------------------------

export interface AnalyzeOpts {
  version?: number;
  inFunction?: boolean;
  id?: string;
  kind?: BlockKind;
}

/** Runs the full front end over a block of action bytes with a collecting emitter. */
export function analyze(
  bytes: Uint8Array,
  opts: AnalyzeOpts = {},
): { block: AnalyzedBlock; diag: ReturnType<typeof collector> } {
  const diag = collector();
  const base: import('../src/index.js').AnalyzeBlockInput = {
    bytes,
    offsetBase: 0,
    kind: opts.kind ?? 'timeline',
    id: opts.id ?? 'test',
    version: opts.version ?? 7,
    emit: diag.fn,
  };
  const input = opts.inFunction !== undefined ? { ...base, inFunction: opts.inFunction } : base;
  const block = analyzeActionBlock(input);
  return { block, diag };
}

/** The first `push` op's literal values in the analyzed block, in file order. */
export function firstPushValues(bytes: Uint8Array, opts: AnalyzeOpts = {}): Operand[] {
  const { block } = analyze(bytes, opts);
  for (const b of block.ir.blocks) {
    for (const op of b.ops) {
      if (op.kind === 'push') return [...op.values];
    }
  }
  return [];
}
