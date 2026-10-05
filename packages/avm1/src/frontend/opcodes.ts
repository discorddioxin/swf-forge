/**
 * The complete AVM1 opcode table — `IMPL-050` §4, grounded in Ch.5 and APP-§3/§10.3.
 *
 * `IMPL-050-R002`: this table is the single data structure that drives decoding, tiering and the
 * `inspect --actions` disassembler; there is no second, hand-written copy of opcode knowledge.
 *
 * Payload schemas pin the byte layout (APP-§10.3); `pops`/`pushes` are the chapter's stack effects
 * with `'var'` for the `n`-argument actions (§6.3's reverse-push convention is applied by the
 * decoder, not by the table). Version windows use the section grouping of `IMPL-050` §4; the two
 * observed-but-undocumented opcodes (`0x89`, `0x2D`) are marked `observed` and decode inert
 * (`IMPL-050-R016`).
 */

/** Payload layout of a record, per APP-§10.3. The schema decides the layout — never the reverse (R003). */
export type PayloadSchema =
  | { readonly kind: 'none' }
  | { readonly kind: 'fixed'; readonly length: number }
  | { readonly kind: 'jump' } // SI16, offset relative to the end of the record
  | { readonly kind: 'if' } // SI16, ditto
  | { readonly kind: 'gotoFrame' } // Frame UI16 (length always 2)
  | { readonly kind: 'getURL' } // UrlString STRING, TargetString STRING
  | { readonly kind: 'setTarget' } // TargetName STRING
  | { readonly kind: 'gotoLabel' } // Label STRING
  | { readonly kind: 'waitForFrame' } // Frame UI16, SkipCount UI8 (length always 3; frame FIRST)
  | { readonly kind: 'waitForFrame2' } // SkipCount UI8 (length always 1; frame from the stack)
  | { readonly kind: 'storeRegister' } // RegisterNumber UI8
  | { readonly kind: 'getURL2' } // flags UI8 (length always 1)
  | { readonly kind: 'gotoFrame2' } // flags UI8 (+ SceneBias UI16 when SceneBiasFlag)
  | { readonly kind: 'constantPool' } // Count UI16, STRING[Count]
  | { readonly kind: 'push' } // (Type UI8, value)* ; Length counts all type+value bytes
  | { readonly kind: 'with' } // Size UI16 + body
  | { readonly kind: 'defineFunction' } // name, params, CodeSize UI16, body
  | { readonly kind: 'defineFunction2' } // name, params, RegisterCount, Flags, REGISTERPARAM, body
  | { readonly kind: 'try' }; // Reserved, flags, three sizes, catch name/register, three bodies

/** The five rules whose result type depends on the movie's declared version (R042). */
export type VersionSensitive = 'boolean' | 'divide' | 'if';

export interface OpcodeSpec {
  readonly code: number;
  readonly name: string;
  /** First SWF version in which the action is defined (the §4 section grouping). */
  readonly minVersion: number;
  readonly payload: PayloadSchema;
  /** Chapter stack effect, pop → push; `'var'` marks an `n`-argument action. */
  readonly pops: number | 'var';
  readonly pushes: number | 'var';
  /** Set when the result type changes between SWF 4 and SWF 5+ (R042). */
  readonly versionSensitive?: VersionSensitive;
  /** Present in the wild but absent from Ch.5 (R016): decode, report, keep semantics inert. */
  readonly observed?: boolean;
  readonly note?: string;
}

const NONE: PayloadSchema = { kind: 'none' };
const fixed = (length: number): PayloadSchema => ({ kind: 'fixed', length });

function spec(
  code: number,
  name: string,
  minVersion: number,
  payload: PayloadSchema,
  pops: number | 'var',
  pushes: number | 'var',
  extra: Partial<Pick<OpcodeSpec, 'versionSensitive' | 'observed' | 'note'>> = {},
): OpcodeSpec {
  return { code, name, minVersion, payload, pops, pushes, ...extra };
}

const T: readonly OpcodeSpec[] = [
  // ---- §4.1 SWF 3 (control actions) -------------------------------------------------------------
  spec(0x00, 'End', 3, NONE, 0, 0, { note: 'terminates an action block' }),
  spec(0x04, 'NextFrame', 3, NONE, 0, 0),
  spec(0x05, 'PreviousFrame', 3, NONE, 0, 0),
  spec(0x06, 'Play', 3, NONE, 0, 0),
  spec(0x07, 'Stop', 3, NONE, 0, 0),
  spec(0x08, 'ToggleQuality', 3, NONE, 0, 0, { note: 'renderer quality (GFX-R007)' }),
  spec(0x09, 'StopSounds', 3, NONE, 0, 0, { note: 'master-gain path (AUD-R074)' }),
  spec(0x81, 'GotoFrame', 3, { kind: 'gotoFrame' }, 0, 0, {
    note: 'absolute frame index; 0-/1-basedness open (IMPL-050 §12.1)',
  }),
  spec(0x83, 'GetURL', 3, { kind: 'getURL' }, 0, 0, { note: '_level0/_level1 targets load SWFs into levels' }),
  spec(0x8a, 'WaitForFrame', 3, { kind: 'waitForFrame' }, 0, 0, {
    note: 'field order is frame-then-skip; skip freezes actions, not bytes',
  }),
  spec(0x8b, 'SetTarget', 3, { kind: 'setTarget' }, 0, 0, {
    note: 'block-splitting; empty target restores the current file',
  }),
  spec(0x8c, 'GotoLabel', 3, { kind: 'gotoLabel' }, 0, 0, { note: 'uses FrameLabel names (doc 040)' }),
  spec(0x8d, 'WaitForFrame2', 3, { kind: 'waitForFrame2' }, 1, 0, { note: 'frame from the stack' }),

  // ---- §4.2 SWF 4 (stack machine) -----------------------------------------------------------------
  spec(0x0a, 'Add', 4, NONE, 2, 1, {
    note: 'string concat when the lhs primitive is a string (AVM1-R024); result B+A',
  }),
  spec(0x0b, 'Subtract', 4, NONE, 2, 1, { note: 'B−A' }),
  spec(0x0c, 'Multiply', 4, NONE, 2, 1, { note: 'A×B' }),
  spec(0x0d, 'Divide', 4, NONE, 2, 1, {
    versionSensitive: 'divide',
    note: 'B/A; A==0 → #ERROR# in SWF 4, NaN/±Infinity in SWF 5+',
  }),
  spec(0x0e, 'Equals', 4, NONE, 2, 1, {
    versionSensitive: 'boolean',
    note: 'numeric; SWF 4 pushes 1/0, SWF 5+ true/false',
  }),
  spec(0x0f, 'Less', 4, NONE, 2, 1, { versionSensitive: 'boolean', note: 'B < A' }),
  spec(0x10, 'And', 4, NONE, 2, 1, { versionSensitive: 'boolean', note: 'non-zero test' }),
  spec(0x11, 'Or', 4, NONE, 2, 1, { versionSensitive: 'boolean', note: 'non-zero test' }),
  spec(0x12, 'Not', 4, NONE, 1, 1, { versionSensitive: 'boolean', note: 'SWF 4 numeric, SWF 5+ Boolean' }),
  spec(0x13, 'StringEquals', 4, NONE, 2, 1, { versionSensitive: 'boolean', note: 'case-sensitive' }),
  spec(0x14, 'StringLength', 4, NONE, 1, 1, { note: 'bytes, not characters (see MBStringLength)' }),
  spec(0x15, 'StringExtract', 4, NONE, 3, 1, { note: 'pops count, index, string; non-integer index/count → ""' }),
  spec(0x17, 'Pop', 4, NONE, 1, 0),
  spec(0x18, 'ToInteger', 4, NONE, 1, 1, { note: 'truncates the fraction (toward zero)' }),
  spec(0x1c, 'GetVariable', 4, NONE, 1, 1, { note: 'scope-chain lookup; /A/B:FOO prefix supported' }),
  spec(0x1d, 'SetVariable', 4, NONE, 2, 0, { note: 'same prefix rule' }),
  spec(0x20, 'SetTarget2', 4, NONE, 1, 0, { note: 'stack-based SetTarget; block-splitting' }),
  spec(0x21, 'StringAdd', 4, NONE, 2, 1, { note: 'forced concat, result BA' }),
  spec(0x22, 'GetProperty', 4, NONE, 2, 1, { note: 'property ids 0–21 (APP-§4)' }),
  spec(0x23, 'SetProperty', 4, NONE, 3, 0, { note: 'pops value, index, target' }),
  spec(0x24, 'CloneSprite', 4, NONE, 3, 0, { note: 'pops depth, target, source' }),
  spec(0x25, 'RemoveSprite', 4, NONE, 1, 0, { note: 'removes a clone' }),
  spec(0x26, 'Trace', 4, NONE, 1, 0, { note: 'no player-visible effect; routes to the shell trace sink' }),
  spec(0x27, 'StartDrag', 4, NONE, 3, 0, {
    note: 'pops target, lockcenter, constrain, then y2,x2,y1,x1 when constrained',
  }),
  spec(0x28, 'EndDrag', 4, NONE, 0, 0),
  spec(0x29, 'StringLess', 4, NONE, 2, 1, { versionSensitive: 'boolean', note: 'byte-by-byte, B < A' }),
  spec(0x30, 'RandomNumber', 4, NONE, 1, 1, { note: 'integer in 0…max−1; runtime RNG (AVM1-D06); never folded' }),
  spec(0x31, 'MBStringLength', 4, NONE, 1, 1, { note: 'characters, not bytes' }),
  spec(0x32, 'CharToAscii', 4, NONE, 1, 1, { note: 'first character of the value → code' }),
  spec(0x33, 'AsciiToChar', 4, NONE, 1, 1),
  spec(0x34, 'GetTime', 4, NONE, 0, 1, { note: 'milliseconds since player start (monotonic in our runtime)' }),
  spec(0x35, 'MBStringExtract', 4, NONE, 3, 1, { note: 'character indexes; non-integer → ""' }),
  spec(0x36, 'MBCharToAscii', 4, NONE, 1, 1, { note: 'double-byte → 16-bit code, first byte high' }),
  spec(0x37, 'MBAsciiToChar', 4, NONE, 1, 1, { note: '≥ 256 → double-byte, first byte high' }),
  spec(0x3a, 'Delete', 4, NONE, 2, 0, { note: 'pops name, then object' }),
  spec(0x3b, 'Delete2', 4, NONE, 1, 0, { note: 'scope-chain search' }),
  spec(0x3c, 'DefineLocal', 4, NONE, 2, 0, { note: 'pops value, then name' }),
  spec(0x3d, 'CallFunction', 4, NONE, 'var', 1, {
    note: 'pops name, numArgs, then args (reverse-push convention, §6.3)',
  }),
  spec(0x3e, 'Return', 4, NONE, 1, 0, { note: 'discarded when not in a function' }),
  spec(0x3f, 'Modulo', 4, NONE, 2, 1, { note: 'pops x then y; y == 0 → NaN' }),
  spec(0x40, 'NewObject', 4, NONE, 'var', 1, { note: 'pops name, numArgs, args; pushes the new object' }),
  spec(0x41, 'DefineLocal2', 4, NONE, 1, 0, { note: 'declares without a value (undefined)' }),
  spec(0x42, 'InitArray', 4, NONE, 'var', 1, { note: 'pops count then elements' }),
  spec(0x43, 'InitObject', 4, NONE, 'var', 1, { note: 'pops count then (value, name) pairs' }),
  spec(0x44, 'TypeOf', 4, NONE, 1, 1, { note: 'number/boolean/string/object/movieclip/null/undefined/function' }),
  spec(0x45, 'TargetPath', 4, NONE, 1, 1, { note: 'dot notation; undefined for non-MovieClip' }),
  spec(0x46, 'Enumerate', 4, NONE, 1, 'var', { note: 'pushes null then each slot name; order undefined (§6.4)' }),
  spec(0x47, 'Add2', 4, NONE, 2, 1, { note: 'ECMA-262 §11.6.1; concat is arg2 then arg1' }),
  spec(0x48, 'Less2', 4, NONE, 2, 1, { note: 'ECMA-262 §11.8.5; compares arg2 < arg1' }),
  spec(0x49, 'Equals2', 4, NONE, 2, 1, { note: 'ECMA-262 §11.9.3 (==)' }),
  spec(0x4a, 'ToNumber', 4, NONE, 1, 1, { note: 'object → valueOf()' }),
  spec(0x4b, 'ToString', 4, NONE, 1, 1, { note: 'object → toString() (AVM1-§5.3 formatting)' }),
  spec(0x4c, 'PushDuplicate', 4, NONE, 1, 2),
  spec(0x4d, 'StackSwap', 4, NONE, 2, 2, {
    note: 'exchanges the top two values (the 2013 post-ship fix, IMPL-050 §11)',
  }),
  spec(0x4e, 'GetMember', 4, NONE, 2, 1, { note: 'auto-wraps primitives in String/Number/Boolean wrapper objects' }),
  spec(0x4f, 'SetMember', 4, NONE, 3, 0, { note: 'pops value, name, object' }),
  spec(0x50, 'Increment', 4, NONE, 1, 1),
  spec(0x51, 'Decrement', 4, NONE, 1, 1),
  spec(0x52, 'CallMethod', 4, NONE, 'var', 1, {
    note: 'pops name, object, numArgs, args; blank name ⇒ invoke the object',
  }),
  spec(0x53, 'NewMethod', 4, NONE, 'var', 1, { note: 'constructor form of CallMethod; pushes the new object' }),
  spec(0x54, 'InstanceOf', 4, NONE, 2, 1, { note: 'pops constr, then obj; interfaces from SWF 7' }),
  spec(0x55, 'Enumerate2', 4, NONE, 1, 'var', { note: 'as Enumerate with an object operand' }),
  spec(0x60, 'BitAnd', 4, NONE, 2, 1, { note: 'operands → UI32, result S32' }),
  spec(0x61, 'BitOr', 4, NONE, 2, 1),
  spec(0x62, 'BitXor', 4, NONE, 2, 1),
  spec(0x63, 'BitLShift', 4, NONE, 2, 1, { note: 'pops count then value; count = low 5 bits' }),
  spec(0x64, 'BitRShift', 4, NONE, 2, 1, { note: 'S32 result' }),
  spec(0x65, 'BitURShift', 4, NONE, 2, 1, { note: 'UI32 result' }),
  spec(0x87, 'StoreRegister', 4, fixed(1), 1, 1, { note: 'reads without popping' }),
  spec(0x88, 'ConstantPool', 4, { kind: 'constantPool' }, 0, 0, {
    note: 'replaces any existing pool (execution state, not scope — R022)',
  }),
  spec(0x94, 'With', 4, { kind: 'with' }, 1, 0, { note: 'depth cap 8 (SWF 5) / 16 (SWF 6+); over cap ⇒ skip body' }),
  spec(0x96, 'Push', 4, { kind: 'push' }, 0, 'var', { note: 'types 0–9; Length is the total type+value bytes' }),
  spec(0x99, 'Jump', 4, { kind: 'jump' }, 0, 0, { note: 'offset relative to the next record; 0 = next' }),
  spec(0x9a, 'GetURL2', 4, { kind: 'getURL2' }, 2, 0, { note: 'pops target, then URL; flags per R040' }),
  spec(0x9b, 'DefineFunction', 4, { kind: 'defineFunction' }, 0, 1, { note: 'rare after SWF 7' }),
  spec(0x9d, 'If', 4, { kind: 'if' }, 1, 0, {
    versionSensitive: 'if',
    note: 'SWF 4 compares to 0, SWF 5+ converts to Boolean',
  }),
  spec(0x9e, 'Call', 4, NONE, 1, 0, { note: 'frame call, not a subroutine call (§6.5)' }),
  spec(0x9f, 'GotoFrame2', 4, { kind: 'gotoFrame2' }, 1, 0, {
    note: 'pops frame/label; scene bias + play flag (R039)',
  }),

  // ---- §4.3 SWF 6 ---------------------------------------------------------------------------------
  spec(0x66, 'StrictEquals', 6, NONE, 2, 1, { note: '===; types must match' }),
  spec(0x67, 'Greater', 6, NONE, 2, 1, { note: 'exact opposite of Less2; compares arg2 > arg1' }),
  spec(0x68, 'StringGreater', 6, NONE, 2, 1, { note: 'byte-by-byte arg2 > arg1' }),

  // ---- §4.4 SWF 7 ---------------------------------------------------------------------------------
  spec(0x2a, 'Throw', 7, NONE, 1, 0, { note: 'unwinds to the nearest Try; every intervening finally runs' }),
  spec(0x2b, 'CastOp', 7, NONE, 2, 1, { note: 'pops object then constructor; pushes the object or null' }),
  spec(0x2c, 'ImplementsOp', 7, NONE, 'var', 0, { note: 'pops constructor, count, then interfaces; no result' }),
  spec(0x69, 'Extends', 7, NONE, 2, 0, { note: 'pops superclass, then subclass; no result' }),
  spec(0x8e, 'DefineFunction2', 7, { kind: 'defineFunction2' }, 0, 1, {
    note: 'registers + preload/suppress flags (§5.3)',
  }),
  spec(0x8f, 'Try', 7, { kind: 'try' }, 0, 0, { note: 'try/catch/finally regions, no end tags (§5.5)' }),
  spec(0x89, 'StrictMode', 7, NONE, 0, 0, {
    observed: true,
    note: 'AS2 strict-mode toggle; decode, report, keep semantics inert',
  }),
  spec(0x2d, 'FsCommand2', 7, NONE, 0, 0, {
    observed: true,
    note: 'runtime maps it (RT-§7); decoder keeps the operand bytes',
  }),
];

export const OPCODES: ReadonlyMap<number, OpcodeSpec> = new Map(T.map((s) => [s.code, s]));

/**
 * Every sub-0x80 code and every 0x80+ code not in the table — the undefined ranges of R016,
 * enumerated so a new opcode cannot slip in silently (done criteria §13.1). `0x89`/`0x2D` are
 * excluded: observed-but-undocumented, the only sanctioned exceptions.
 */
export const UNDEFINED_CODES: readonly number[] = (() => {
  const out: number[] = [];
  for (let code = 0x00; code <= 0xff; code += 1) {
    const entry = OPCODES.get(code);
    if (entry === undefined) out.push(code);
  }
  return out;
})();

export function opcode(code: number): OpcodeSpec | undefined {
  return OPCODES.get(code);
}

export function isDefinedCode(code: number): boolean {
  return OPCODES.has(code);
}

/** `true` for the two observed-but-undocumented opcodes (R016). */
export function isObservedCode(code: number): boolean {
  return OPCODES.get(code)?.observed === true;
}

/**
 * The payload a record with `hasLength` must declare. `null` means "varies with the content"
 * (strings, pools, Push, functions, Try/With) — the declared length then bounds the decode.
 */
export function expectedPayloadLength(code: number): number | null {
  const payload = opcode(code)?.payload;
  switch (payload?.kind) {
    case 'none':
      return 0;
    case 'fixed':
      return payload.length;
    case 'jump':
    case 'if':
      return 2;
    case 'gotoFrame':
      return 2;
    case 'waitForFrame':
      return 3;
    case 'waitForFrame2':
    case 'storeRegister':
    case 'getURL2':
      return 1;
    case 'gotoFrame2':
      return 1; // + 2 when SceneBiasFlag is set
    default:
      return null;
  }
}

/** The SWF 3-era control set — used for the `SF0408` model detection. */
export const SWF3_ONLY_CODES: ReadonlySet<number> = new Set([
  0x00, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x81, 0x83, 0x8a, 0x8b, 0x8c, 0x8d,
]);
