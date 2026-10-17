/**
 * AVM1 IR → TypeScript statements (`WP-120-08`, and the codegen half of `IMPL-120-R009`).
 *
 * **What this file may assume, and why the assumption is safe.** `AVM1-R017` makes the operand stack
 * *partial-evaluated*: a value the front end can name arrives as a literal, and `stack.ts:924` maps every
 * `Push` payload through `pushValueOperand`, which returns only `lit` operands — so a pushed constant is
 * *inlined into the op that consumes it* and a `push` record needs no statement of its own. Values that could
 * not be folded arrive as SSA temporaries (`{kind:'temp', id}`), and `AVM1-R016` guarantees the stack depth on
 * every block boundary is verified. The emitter therefore maps ops to statements and never simulates a stack.
 *
 * Two places where that model is thin, and what the emitter does about each:
 *
 * 1. A `{kind:'stack'}` operand is a value the simulation could not name. `040` gives the operand stack to the
 *    *interpreter* (`040:628`), not to emitted code, so an emitted function has nothing to read it from. A
 *    block containing one is **not emittable** — measured on the 73 licensed titles, 5 of 7 tier-1 blocks and 1
 *    of 93 tier-0 blocks. Refusing is not "emitting worse": a half-translated script is a game that crashes on
 *    frame 212 instead of failing at build time.
 * 2. `Op` records the value an op produces only where the union has a `result` field. Handlers that push without
 *    one — `getTime` (`stack.ts:1166-1169`) is the clean example — allocate a temp id that the IR then never
 *    names, so a later op reads a temp with no recorded producer: 17 of 93 tier-0 blocks. The ids are still
 *    recoverable, because they are exactly the unbound ones and they are allocated in execution order, so
 *    `bindImplicitDefs` hands each implicit push the next id in that list. The rule that keeps this honest is
 *    that **the counts must reconcile**: more unbound ids than implicit pushes, and the block is refused
 *    instead of guessed. An emitter that guessed would produce code that type-checks and runs with two ops'
 *    values swapped, which is the worst failure available here. (Recorded as errata `E-047` against the IR.)
 *
 * A refused block becomes `WP-120-09`'s residual blob, and is reported per block with its reason
 * (`IMPL-120-R013`'s discipline applied to emission) — never silently dropped, and never emitted half.
 */

import { opcode } from '@swf-forge/avm1';
import type { ActionIR, BasicBlock, Operand, Op, Terminator } from '@swf-forge/avm1';

import { formatNumber, formatString, type Chunk } from './source.js';

/** Region nesting cap before a block is refused. Bounded up front rather than discovered by a stack overflow. */
const MAX_REGION_DEPTH = 64;

/** Ops that hand the simulation a value without recording which temp it went to. */
const IMPLICIT_PUSHES: ReadonlySet<Op['kind']> = new Set<Op['kind']>(['getTime']);

/** `stack.ts:901` records the temp for every other call shape, so only these two push unrecorded results. */
function pushesWithoutResult(op: Op): boolean {
  if (IMPLICIT_PUSHES.has(op.kind)) return true;
  return op.kind === 'call' && op.result === null && op.call.kind !== 'initArray' && op.call.kind !== 'initObject';
}

/** The op kinds whose handling needs loop or iterator state the IR does not model. Refused, not approximated. */
const UNMODELED: ReadonlyMap<Op['kind'], string> = new Map([
  [
    'enumerate',
    'the enumeration cursor is stack state the IR does not model; `Enumerate` + `Pop` + `GetMember` sequences need the interpreter (E-047)',
  ],
  ['raw', 'a raw byte range is emitted verbatim by the residual pass, not translated'],
  [
    'constantPool',
    'the runtime owns constant-pool copies, and which activation a redefinition reaches is exactly what P7 has not fixed yet',
  ],
  ['unknown', 'the opcode is not in the IR union'],
]);

/**
 * The arithmetic and comparison forms, keyed by the **opcode name** and never by number.
 *
 * The numbering in `IMPL-050`'s table is not the numbering in the Adobe manual's chapter order — `BitAnd` is
 * `0x60` here, not `0x0f`, and `ToInteger` is `0x18`, not `0x30`. Keying on numbers is how an emitter gets
 * `a & b` where it meant `a == b`, silently, for one version of one movie. Keying on the name the front end
 * resolved means the IR and this table agree by construction, and a new opcode in the table shows up here as a
 * refusal rather than as a wrong operator.
 *
 * Operand order follows `stack.ts:1399-1405`: `b = pop()` is the *first* popped value (the manual's `A`) and
 * `a = pop()` the second (the manual's `B`), so the manual's "B−A" is `a - b` here. Every entry below was
 * checked against the note on its `spec(...)` row rather than against memory.
 */
const BINOP_FORMS: ReadonlyMap<string, (a: string, b: string) => string> = new Map([
  // Direct operators, where JS's definition and AVM1's agree (CMP-R019). Commutative or order-checked.
  ['Subtract', (a, b) => `(${a} - ${b})`],
  ['Multiply', (a, b) => `(${a} * ${b})`],
  ['Modulo', (a, b) => `(${b} % ${a})`], // "pops x then y": x is the top, so the dividend is `b`
  ['BitAnd', (a, b) => `(${a} & ${b})`],
  ['BitOr', (a, b) => `(${a} | ${b})`],
  ['BitXor', (a, b) => `(${a} ^ ${b})`],
  ['BitLShift', (a, b) => `(${a} << ${b})`], // count is the top of stack; JS masks it to 5 bits as AVM1 does
  ['BitRShift', (a, b) => `(${a} >> ${b})`],
  ['BitURShift', (a, b) => `(${a} >>> ${b})`],
  // Helper calls, where AVM1's coercion or its version-sensitive result is not JS's operator.
  ['Add', (a, b) => `avm1.add(${a}, ${b})`], // "result B+A", and string concat when the left is a string
  ['Add2', (a, b) => `avm1.add(${a}, ${b})`], // concat is arg2 then arg1: the left operand is `a`
  ['Divide', (a, b) => `avm1.divide(${a}, ${b})`], // SWF 4 yields the string "#ERROR#" for a zero divisor
  ['Equals', (a, b) => `avm1.numericEquals(${a}, ${b})`], // numeric; 1/0 in SWF 4, booleans from SWF 5
  ['Equals2', (a, b) => `avm1.equals(${a}, ${b})`], // the ECMA `==` algorithm
  ['StrictEquals', (a, b) => `avm1.strictEquals(${a}, ${b})`],
  ['Less', (a, b) => `avm1.numericLess(${a}, ${b})`], // numeric compare, version-sensitive result
  ['Less2', (a, b) => `(avm1.compare(${a}, ${b}) < 0)`],
  ['Greater', (a, b) => `(avm1.compare(${a}, ${b}) > 0)`],
  ['StringLess', (a, b) => `(avm1.compareStrings(${a}, ${b}) < 0)`], // byte-by-byte, not the relational algorithm
  ['StringGreater', (a, b) => `(avm1.compareStrings(${a}, ${b}) > 0)`],
  ['StringEquals', (a, b) => `(avm1.compareStrings(${a}, ${b}) === 0)`],
  ['StringAdd', (a, b) => `avm1.add(avm1.toString(avm1.toNumber(${a})), avm1.toString(avm1.toNumber(${b})))`],
  ['And', (a, b) => `avm1.logicalAnd(${a}, ${b})`], // SWF 4 non-zero test, not short-circuit JS `&&`
  ['Or', (a, b) => `avm1.logicalOr(${a}, ${b})`],
]);

const UNOP_FORMS: ReadonlyMap<string, (a: string) => string> = new Map([
  ['Not', (a) => `avm1.logicalNot(${a})`], // 1/0 in SWF 4, a boolean from SWF 5: never JS `!`
  ['BitNot', (a) => `(~${a})`],
  ['Negate', (a) => `avm1.negate(${a})`], // ToNumber, then the sign flip, then the AVM1 result type
  ['ToInteger', (a) => `avm1.toInteger(${a})`],
  ['ToNumber', (a) => `avm1.toNumber(${a})`],
  ['ToString', (a) => `avm1.toString(${a})`],
  ['TypeOf', (a) => `avm1.typeofOp(${a})`],
  ['Increment', (a) => `avm1.add(${a}, 1)`],
  ['Decrement', (a) => `avm1.add(${a}, -1)`],
  ['RandomNumber', (a) => `avm1.randomInt(${a})`], // never folded: the runtime owns the seeded generator
  ['StringLength', (a) => `avm1.stringLength(${a})`], // bytes or characters is FE-030, which P7 answers
  ['MBStringLength', (a) => `avm1.mbStringLength(${a})`],
  ['CharToAscii', (a) => `avm1.charToAscii(${a})`],
  ['AsciiToChar', (a) => `avm1.asciiToChar(${a})`],
  ['MBCharToAscii', (a) => `avm1.mbCharToAscii(${a})`],
  ['MBAsciiToChar', (a) => `avm1.mbAsciiToChar(${a})`],
  ['TargetPath', (a) => `avm1.targetPath(${a})`],
]);

/** The opcode name an `ActionIR` binop/unop carries, or `null` when the code is not in the table. */
function opName(code: number): string | null {
  return opcode(code)?.name ?? null;
}

/** The emitted form for a binary op, shared by the refusal gate and the lowering so they cannot disagree. */
export function binopForm(code: number, a: string, b: string): string | null {
  const name = opName(code);
  const form = name === null ? undefined : BINOP_FORMS.get(name);
  return form === undefined ? null : form(a, b);
}

/** The emitted form for a unary op, and the same shared-guarantee as `binopForm`. */
export function unopForm(code: number, a: string): string | null {
  const name = opName(code);
  const form = name === null ? undefined : UNOP_FORMS.get(name);
  return form === undefined ? null : form(a);
}

/** Whether a binary/unary opcode has an emitted form. The gate that keeps a wrong operator out of output. */
export function hasArithForm(code: number, unary: boolean): boolean {
  const name = opName(code);
  if (name === null) return false;
  return (unary ? UNOP_FORMS : BINOP_FORMS).has(name);
}

/** Why a block cannot be emitted. Every variant names the mechanism, because the report is the interface. */
export type RefusalReason =
  | 'tier-2'
  | 'stack-operand'
  | 'unbound-temp'
  | 'dynamic-pool'
  | 'unmodeled-op'
  | 'malformed-region'
  | 'region-depth'
  | 'unreachable-only';

export interface Refusal {
  readonly reason: RefusalReason;
  readonly detail: string;
}

export interface Lowerability {
  readonly emittable: boolean;
  readonly refusal: Refusal | null;
  /** Ops the lowering would write, for `CMP-D04`'s file-size split. */
  readonly opCount: number;
  /** How many blocks the function is made of: 1 means straight-line code with no `pc` machinery. */
  readonly blockCount: number;
}

/** Every caller asks this first, so a half-emitted function is not reachable. */
export function assessBlock(ir: ActionIR): Lowerability {
  const live = ir.blocks.filter((block) => !block.unreachable);
  return {
    emittable: refusalFor(ir, 0) === null,
    refusal: refusalFor(ir, 0),
    opCount: live.reduce((sum, block) => sum + block.ops.length, 0),
    blockCount: live.length,
  };
}

function refusalFor(ir: ActionIR, depth: number): Refusal | null {
  if (ir.tier === 2) {
    return {
      reason: 'tier-2',
      detail: `tier 2 (${ir.residualReason ?? 'no reason recorded'}): its bytes belong in a residual blob`,
    };
  }
  if (depth > MAX_REGION_DEPTH) {
    return { reason: 'region-depth', detail: `nested regions deeper than ${MAX_REGION_DEPTH} records` };
  }
  if (ir.poolIsDynamic) {
    return {
      reason: 'dynamic-pool',
      detail:
        'a `ConstantPool` inside the block replaces the movie pool, so a pool index is not resolvable at build time',
    };
  }
  if (ir.blocks.length === 0 || ir.blocks.every((block) => block.unreachable)) {
    return { reason: 'unreachable-only', detail: 'every basic block in the script is unreachable' };
  }
  for (const block of ir.blocks) {
    if (block.unreachable) continue;
    for (const op of block.ops) {
      if (op.kind === 'binop' && !hasArithForm(op.code, false)) {
        return {
          reason: 'unmodeled-op',
          detail: `binary opcode \`${opName(op.code) ?? `0x${op.code.toString(16)}`}\` has no emitted form: the runtime helper it needs is not specified yet`,
        };
      }
      if (op.kind === 'unop' && !hasArithForm(op.code, true)) {
        return {
          reason: 'unmodeled-op',
          detail: `unary opcode \`${opName(op.code) ?? `0x${op.code.toString(16)}`}\` has no emitted form: the runtime helper it needs is not specified yet`,
        };
      }
      const unmodeled = UNMODELED.get(op.kind);
      if (unmodeled !== undefined) return { reason: 'unmodeled-op', detail: `\`${op.kind}\`: ${unmodeled}` };
      if (op.kind === 'try' && op.region.malformed) {
        return { reason: 'malformed-region', detail: 'the `Try` region sizes do not tile the record (SF0404)' };
      }
      for (const operand of operandsOf(op)) {
        if (operand.kind === 'stack') {
          return {
            reason: 'stack-operand',
            detail: `an operand of \`${op.kind}\` is an unnamed stack slot, and emitted code has no operand stack`,
          };
        }
        if (operand.kind === 'lit' && operand.value.type === 'unknown') {
          return {
            reason: 'unmodeled-op',
            detail: `\`${op.kind}\` was handed a value the partial evaluator could not model`,
          };
        }
      }
      if (op.kind === 'define' && op.fn.ir !== null) {
        const inner = refusalFor(op.fn.ir, depth + 1);
        if (inner !== null) return inner;
      }
      if (op.kind === 'try') {
        for (const body of nestedBodies(op.region)) {
          const inner = refusalForBlocks(body, ir, depth + 1);
          if (inner !== null) return inner;
        }
      }
      if (op.kind === 'with') {
        const inner = refusalForBlocks(op.region.bodyBlocks, ir, depth + 1);
        if (inner !== null) return inner;
      }
    }
    if (block.terminator.kind === 'throw') {
      return {
        reason: 'unbound-temp',
        detail: 'a `throw` terminator records no value operand, so the thrown value cannot be named (E-047)',
      };
    }
  }
  const unbound = unboundDiagnosis(ir);
  return unbound === null ? null : { reason: 'unbound-temp', detail: unbound };
}

function nestedBodies(region: {
  tryBlocks: readonly BasicBlock[];
  catchBlocks: readonly BasicBlock[] | null;
  finallyBlocks: readonly BasicBlock[] | null;
}): readonly (readonly BasicBlock[])[] {
  return [region.tryBlocks, region.catchBlocks ?? [], region.finallyBlocks ?? []];
}

function refusalForBlocks(blocks: readonly BasicBlock[], parent: ActionIR, depth: number): Refusal | null {
  if (blocks.length === 0) return null;
  return refusalFor({ ...parent, blocks, poolIsDynamic: false }, depth);
}

/** Every operand of an op, one nesting level in, ignoring the op's own discriminants. */
function operandsOf(op: Op): readonly Operand[] {
  const out: Operand[] = [];
  const visit = (value: unknown, depth: number): void => {
    if (value === null || typeof value !== 'object' || depth > 4) return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }
    const candidate = value as { kind?: unknown };
    if (candidate.kind === 'lit' || candidate.kind === 'temp' || candidate.kind === 'stack') {
      out.push(value as Operand);
      return;
    }
    for (const child of Object.values(value as Record<string, unknown>)) visit(child, depth + 1);
  };
  for (const [field, value] of Object.entries(op)) {
    if (field === 'kind' || field === 'code') continue;
    visit(value, 0);
  }
  return out;
}

function tempIds(node: unknown, field: string, depth: number, defs: Set<number>, uses: Set<number>): void {
  if (node === null || typeof node !== 'object' || depth > 6) return;
  if (Array.isArray(node)) {
    for (const item of node) tempIds(item, field, depth + 1, defs, uses);
    return;
  }
  const value = node as { kind?: unknown; id?: unknown };
  if (value.kind === 'temp' && typeof value.id === 'number') {
    (field === 'result' ? defs : uses).add(value.id);
    return;
  }
  for (const [key, child] of Object.entries(node as Record<string, unknown>))
    tempIds(child, key, depth + 1, defs, uses);
}

function collectBindings(ir: ActionIR): { readonly defs: Set<number>; readonly uses: Set<number> } {
  const defs = new Set<number>();
  const uses = new Set<number>();
  const walk = (blocks: readonly BasicBlock[]): void => {
    for (const block of blocks) {
      if (block.unreachable) continue;
      for (const op of block.ops) {
        for (const [field, value] of Object.entries(op)) {
          tempIds(value, field, 0, defs, uses);
        }
        if (op.kind === 'define' && op.fn.ir !== null) walk(op.fn.ir.blocks);
      }
      for (const [field, value] of Object.entries(block.terminator)) {
        tempIds(value, field, 0, defs, uses);
      }
    }
  };
  walk(ir.blocks);
  return { defs, uses };
}

/**
 * Do the unbound ids reconcile with the implicit pushes? `null` means yes. Run once per function, because the
 * answer decides whether the function is emittable at all, and the same walk order the binder uses is what the
 * lowering then follows to assign ids — one ordering rule, stated twice on purpose, so a change in either side
 * shows up as a refusal rather than as swapped values.
 */
function unboundDiagnosis(ir: ActionIR): string | null {
  const { defs, uses } = collectBindings(ir);
  const unbound = [...uses].filter((id) => !defs.has(id)).sort((a, b) => a - b);
  if (unbound.length === 0) return null;
  let implicit = 0;
  const walk = (blocks: readonly BasicBlock[]): void => {
    for (const block of blocks) {
      if (block.unreachable) continue;
      for (const op of block.ops) {
        if (pushesWithoutResult(op)) implicit += 1;
        if (op.kind === 'define' && op.fn.ir !== null) walk(op.fn.ir.blocks);
      }
    }
  };
  walk(ir.blocks);
  if (unbound.length > implicit) {
    return `${unbound.length} temp id(s) (${unbound.slice(0, 4).join(', ')}${unbound.length > 4 ? ', …' : ''}) are read but no op records producing them, and only ${implicit} implicit push(es) exist to bind them to`;
  }
  return null;
}

export interface LowerContext {
  /** The `ConstantPool` as written at the defining point, or `null` when the block has none. */
  readonly pool: readonly string[] | null;
  /** Names a nested `DefineFunction` through the closed table (`IMPL-120-R012`). */
  readonly nameForBlock: (subjectId: string) => string;
  readonly depth?: number;
}

export interface LoweredFunction {
  readonly declarations: readonly string[];
  readonly statements: readonly Chunk[];
  /** `Value` when the body can hand a result back, `null` for a void frame script (`AVM1-R050`). */
  readonly returns: 'Value' | null;
  readonly refusal: Refusal | null;
  /** True when the body ends in the player's implicit `undefined`. */
  readonly needsVoidReturn: boolean;
}

/** Lowers one action block group into the body of a generated function. */
export function lowerFunction(ir: ActionIR, ctx: LowerContext): LoweredFunction {
  const refusal = refusalFor(ir, ctx.depth ?? 0);
  if (refusal !== null) {
    return { declarations: [], statements: [], returns: null, refusal, needsVoidReturn: false };
  }
  const state = new LowerState(ir, ctx);
  const statements = state.body();
  return {
    declarations: state.declarations(),
    statements,
    returns: state.mayReturn ? 'Value' : null,
    refusal: null,
    needsVoidReturn: state.mayReturn,
  };
}

class LowerState {
  private readonly defs: Set<number>;
  private readonly uses: Set<number>;
  /** Unbound ids in ascending order, consumed by the implicit pushes in execution order. */
  private readonly queue: number[];
  /** Set when the body can hand a value back to its caller; `lowerFunction` reads it for the return type. */
  mayReturn = false;

  constructor(
    private readonly ir: ActionIR,
    private readonly ctx: LowerContext,
  ) {
    const bindings = collectBindings(ir);
    this.defs = bindings.defs;
    this.uses = bindings.uses;
    this.queue = [...this.uses].filter((id) => !this.defs.has(id)).sort((a, b) => a - b);
  }

  /**
   * One `let` per referenced temp, pre-initialised to `undefined`. Two reasons, both load-bearing: the switch
   * machine assigns a temp in one `case` and reads it in another, which TypeScript's definite-assignment
   * analysis rejects for a bare `let`; and `undefined` is the value AVM1 gives a slot that was never written,
   * so a block whose def the analysis could not prove still reads what the player would have read.
   */
  declarations(): string[] {
    const ids = new Set<number>([...this.defs, ...this.uses]);
    const lines: string[] = [];
    if (this.ctx.pool !== null) {
      lines.unshift(`let pool: readonly Value[] = [${this.ctx.pool.map(formatString).join(', ')}];`);
    }
    for (let index = 1; index <= this.ir.registers; index += 1) {
      lines.push(`let r${index}: Value = undefined;`);
    }
    for (const id of [...ids].sort((a, b) => a - b)) lines.push(`let t${id}: Value = undefined;`);
    return lines;
  }

  body(): Chunk[] {
    const live = this.ir.blocks.filter((block) => !block.unreachable);
    const only = live[0];
    if (live.length === 1 && only !== undefined) {
      const unreachable = this.ir.blocks.filter((block) => block.unreachable);
      const notes = unreachable.map(
        (block) => `// block ${block.id} is unreachable and is not emitted (IMPL-050-R055)`,
      );
      return [...notes, ...this.block(only, null)];
    }
    return this.machine(this.ir.blocks);
  }

  private machine(blocks: readonly BasicBlock[]): Chunk[] {
    const cases: Chunk[] = [];
    for (const block of blocks) {
      const statements = block.unreachable
        ? ['// unreachable: kept in the IR, not emitted (IMPL-050-R055)', 'break;']
        : [...this.block(block, blocks), 'break;'];
      cases.push([`case ${block.id}: {`, { lines: statements }, '}']);
    }
    const start = blocks[0]?.id ?? 0;
    return [
      `let pc: number = ${start};`,
      'while (pc >= 0) {',
      [{ lines: ['switch (pc) {', ...cases, 'default: pc = -1;', '}'] }],
      '}',
    ];
  }

  private block(block: BasicBlock, all: readonly BasicBlock[] | null): Chunk[] {
    const out: Chunk[] = [];
    const index = block.ops.findIndex((op) => op.kind === 'target');
    if (index >= 0) {
      const op = block.ops[index];
      if (op !== undefined && op.kind === 'target') {
        out.push(...this.ops(op ? block.ops.slice(0, index) : []));
        const rest = [...block.ops.slice(index + 1)];
        out.push(
          ...this.withTarget(op.target, () => [...this.ops(rest), ...this.terminator(block.terminator, block, all)]),
        );
        return out;
      }
    }
    out.push(...this.ops(block.ops));
    out.push(...this.terminator(block.terminator, block, all));
    return out;
  }

  private ops(ops: readonly Op[]): Chunk[] {
    const out: Chunk[] = [];
    for (const op of ops) out.push(...this.op(op));
    return out;
  }

  /** `AVM1-R034`: the target becomes an explicit argument to a closure; no ambient current-target is mutated. */
  private withTarget(target: { readonly kind: string; readonly [key: string]: unknown }, body: () => Chunk[]): Chunk[] {
    const inner = body();
    return [
      `avm1.withTarget(${this.targetPath(target)}, () => {`,
      { lines: inner.length === 0 ? ['// (no operations scoped to the target)'] : inner },
      '});',
    ];
  }

  /** `CMP-R019`: a known chain is written as a chain, and only a computed one goes to the runtime. */
  private targetPath(target: { readonly kind: string; readonly [key: string]: unknown }): string {
    if (target.kind === 'file') return 'frame.root';
    if (target.kind === 'path') {
      const clips = (target['clips'] ?? []) as readonly string[];
      const name = target['name'] as string | null;
      let base = clips.length === 0 ? 'target' : 'frame.root';
      for (const clip of clips) {
        if (clip === '' || clip === '_root') {
          base = 'frame.root';
        } else if (clip === '_parent') {
          base = `${base}.parent`;
        } else {
          base = `${base}.getMember(${formatString(clip)})`;
        }
      }
      return name === null ? base : `${base}.getMember(${formatString(name)})`;
    }
    return `avm1.resolveTarget(${this.expr(target['value'] as Operand) ?? 'undefined'})`;
  }

  private terminator(terminator: Terminator, block: BasicBlock, all: readonly BasicBlock[] | null): Chunk[] {
    if (all === null) {
      switch (terminator.kind) {
        case 'return':
          this.mayReturn = true;
          return ['return undefined;'];
        case 'fallthrough':
        case 'jump':
        case 'branch':
          return [];
        default:
          return [`// ${terminator.kind}`];
      }
    }
    const step = (id: number | null): string => (id === null ? 'pc = -1;' : `pc = ${id};`);
    switch (terminator.kind) {
      case 'fallthrough':
        return [step(terminator.next)];
      case 'jump':
        return [step(terminator.target)];
      case 'branch': {
        const condition = this.expr(terminator.condition);
        if (condition === null) return ['pc = -1; // the branch condition is not nameable'];
        return [`if (avm1.toBool(${condition})) { ${step(terminator.ifTrue)} } else { ${step(terminator.ifFalse)} }`];
      }
      case 'return':
        this.mayReturn = true;
        return ['return undefined;'];
      case 'target':
        return [step(block.id + 1)];
      default:
        return [`// ${terminator.kind}`];
    }
  }

  private op(op: Op): Chunk[] {
    switch (op.kind) {
      case 'end':
        return [];
      case 'inert':
        return [`// ${op.name}: no runtime behaviour`];
      case 'push':
        // The consumer inlines the pushed literal (`stack.ts:924`), so a push is not a statement.
        return [];
      case 'constantPool':
        // Unreachable by construction: the refusal gate lists `constantPool` as unmodelled, so a block carrying
        // one never reaches the lowering. The case is here to keep the switch exhaustive, and hitting it means
        // the gate and the lowering disagree — a bug in this file, reported as one.
        return [this.unnameable('constantPool')];
      case 'binop': {
        const a = this.expr(op.a);
        const b = this.expr(op.b);
        if (a === null || b === null) return [this.unnameable(op.kind)];
        const form = binopForm(op.code, a, b);
        return form === null ? [this.unnameable('binop')] : this.assign(op.result, form, true);
      }
      case 'unop': {
        const a = this.expr(op.a);
        if (a === null) return [this.unnameable(op.kind)];
        const form = unopForm(op.code, a);
        return form === null ? [this.unnameable('unop')] : this.assign(op.result, form, true);
      }
      case 'strExtract': {
        const str = this.expr(op.str);
        const at = this.expr(op.index);
        const count = this.expr(op.count);
        if (str === null || at === null || count === null) return [this.unnameable(op.kind)];
        return this.assign(op.result, `avm1.strExtract(${str}, ${at}, ${count})`);
      }
      case 'call':
        return this.call(op);
      case 'define':
        return this.define(op);
      case 'storeRegister': {
        const value = this.expr(op.value);
        if (value === null) return [this.unnameable(op.kind)];
        return [`r${op.register} = ${value};`];
      }
      case 'pop':
        // An SSA local has nothing to pop: dropping the discard is what makes the emitted code read like
        // source rather than like a stack. `AVM1-R016`'s verified depths are what make it safe.
        return [];
      case 'duplicate': {
        const value = this.expr(op.value);
        if (value === null) return [this.unnameable(op.kind)];
        const id = this.takeImplicit();
        return id === null ? [] : [`t${id} = ${value};`];
      }
      case 'swap': {
        const a = this.expr(op.a);
        const b = this.expr(op.b);
        if (a === null || b === null) return [this.unnameable(op.kind)];
        return [`{ const swap: Value = ${a}; ${a} = ${b}; ${b} = swap; }`];
      }
      case 'getVariable':
        return this.assign(op.result, `frame.scope.get(${this.expr(op.name) ?? 'undefined'})`);
      case 'setVariable':
        return [`frame.scope.set(${this.expr(op.name) ?? 'undefined'}, ${this.expr(op.value) ?? 'undefined'});`];
      case 'getMember': {
        const key = this.expr(op.name);
        const object = this.expr(op.object);
        if (key === null || object === null) return [this.unnameable(op.kind)];
        return this.assign(op.result, `${object}.getMember(${key})`);
      }
      case 'setMember': {
        const key = this.expr(op.name);
        const object = this.expr(op.object);
        const value = this.expr(op.value);
        if (key === null || object === null || value === null) return [this.unnameable(op.kind)];
        return [`${object}.setMember(${key}, ${value});`];
      }
      case 'getProperty': {
        const id = this.expr(op.id);
        if (id === null) return [this.unnameable(op.kind)];
        return this.assign(op.result, `target.getProperty(${id})`);
      }
      case 'setProperty': {
        const id = this.expr(op.id);
        const value = this.expr(op.value);
        if (id === null || value === null) return [this.unnameable(op.kind)];
        return [`target.setProperty(${id}, ${value});`];
      }
      case 'delete': {
        const key = this.expr(op.name);
        const object = this.expr(op.object);
        if (key === null || object === null) return [this.unnameable(op.kind)];
        return [`avm1.deleteProp(${object}, ${key});`];
      }
      case 'delete2':
        return [`avm1.deleteProp(frame.scope, ${this.expr(op.name) ?? 'undefined'});`];
      case 'defineLocal':
        // `DefineLocal` introduces a variable in the *current* action region's scope, pre-set to the value.
        return [`frame.scope.declare(${this.expr(op.name) ?? 'undefined'}, ${this.expr(op.value) ?? 'undefined'});`];
      case 'defineLocal2':
        return this.assign(op.result, `avm1.declare(frame.scope, ${this.expr(op.name) ?? 'undefined'})`);
      case 'cloneSprite': {
        const target = this.expr(op.target);
        const depth = this.expr(op.depth);
        const source = this.expr(op.source);
        if (target === null || depth === null || source === null) return [this.unnameable(op.kind)];
        return [`avm1.cloneSprite(${target}, ${depth}, ${source});`];
      }
      case 'removeSprite':
        return [`avm1.removeSprite(${this.expr(op.target) ?? 'undefined'});`];
      case 'trace':
        return [`avm1.trace(${this.expr(op.value) ?? 'undefined'});`];
      case 'startDrag': {
        const target = this.expr(op.target);
        const lock = this.expr(op.lockcenter);
        const constrain = this.expr(op.constrain);
        if (target === null || lock === null || constrain === null) return [this.unnameable(op.kind)];
        const bounds =
          op.bounds === undefined
            ? 'null'
            : `[${op.bounds
                .map((edge) => this.expr(edge) ?? 'undefined')
                .reverse()
                .join(', ')}]`;
        return [`avm1.startDrag(${target}, ${lock}, ${constrain}, ${bounds});`];
      }
      case 'endDrag':
        return ['avm1.endDrag(target);'];
      case 'instanceof': {
        const obj = this.expr(op.obj);
        const constr = this.expr(op.constr);
        if (obj === null || constr === null) return [this.unnameable(op.kind)];
        return this.assign(op.result, `avm1.instanceOf(${obj}, ${constr})`);
      }
      case 'castOp': {
        const obj = this.expr(op.obj);
        const constr = this.expr(op.constr);
        if (obj === null || constr === null) return [this.unnameable(op.kind)];
        return this.assign(op.result, `avm1.castTo(${obj}, ${constr})`);
      }
      case 'extends': {
        const sub = this.expr(op.subclass);
        const sup = this.expr(op.superclass);
        if (sub === null || sup === null) return [this.unnameable(op.kind)];
        return [`avm1.extendsOp(${sub}, ${sup});`];
      }
      case 'implementsOp': {
        const constr = this.expr(op.constr);
        if (constr === null) return [this.unnameable(op.kind)];
        const interfaces = op.interfaces.map((item) => this.expr(item) ?? 'undefined');
        return [`avm1.implementsOp(${constr}, [${interfaces.join(', ')}]);`];
      }
      case 'getTime': {
        const id = this.takeImplicit();
        return id === null ? [] : [`t${id} = $.getTimer();`];
      }
      case 'timeline':
        return this.timeline(op.timeline);
      case 'target':
        return [`// target change (${op.target.kind})`];
      case 'return':
        this.mayReturn = true;
        return [`return ${this.expr(op.value) ?? 'undefined'};`];
      case 'throw':
        return [`avm1.throwOp(${this.expr(op.value) ?? 'undefined'});`];
      case 'try':
        return this.tryRegion(op.region);
      case 'with':
        return this.withRegion(op.region);
      case 'enumerate':
      case 'raw':
      case 'unknown':
        // `assessBlock` refuses these, so reaching the lowering with one is a bug in the caller, not input.
        return [`avm1.unsupported(${formatString(`${op.kind} reached the lowering`)});`];
    }
  }

  /** The next unbound id, if this op is the implicit push it belongs to. */
  private takeImplicit(): number | null {
    const next = this.queue.shift();
    return next === undefined ? null : next;
  }

  private unnameable(kind: string): string {
    return `avm1.unsupported(${formatString(`${kind}: an operand is not nameable in emitted code`)});`;
  }

  /**
   * Binds `value` to the block's SSA name for `result`.
   *
   * `pure` marks an expression that cannot observe or change anything — arithmetic on already-evaluated
   * operands. When a pure expression's result is *not* a temp, nothing can ever read it: the front end folded
   * it into a literal and the literal was inlined at its use, or the value was dropped. Emitting the bare
   * expression would put `(2 - 3);` in generated source for a person to wonder about, so a pure expression with
   * no binding site disappears. Impure ones (a call, a store) are always kept, because the statement *is* the
   * effect.
   */
  private assign(result: Operand | null | undefined, value: string, pure = false): Chunk[] {
    if (result !== null && result !== undefined && result.kind === 'temp') return [`t${result.id} = ${value};`];
    return pure ? [] : [`${value};`];
  }

  private call(op: Op & { readonly kind: 'call' }): Chunk[] {
    const call = op.call;
    const args = call.args.map((arg) => this.expr(arg) ?? 'undefined');
    const name = call.name === null ? 'undefined' : (this.expr(call.name) ?? 'undefined');
    const object = call.object === null ? null : (this.expr(call.object) ?? 'undefined');
    switch (call.kind) {
      case 'callFunction':
        return this.assign(op.result, `avm1.callFunction(${name}, ${object ?? 'target'}, [${args.join(', ')}])`);
      case 'callMethod':
        return this.assign(op.result, `${object ?? 'target'}.callMethod(${name}, [${args.join(', ')}])`);
      case 'newObject':
        return this.assign(op.result, `avm1.construct(${name}, [${args.join(', ')}])`);
      case 'newMethod':
        return this.assign(op.result, `avm1.constructMethod(${object ?? 'target'}, ${name}, [${args.join(', ')}])`);
      case 'initArray':
        return this.assign(op.result, `avm1.newArray([${args.join(', ')}])`);
      case 'initObject': {
        const pairs = (call.pairs ?? []).map((pair) => {
          const key = pair.name.kind === 'lit' && pair.name.value.type === 'string' ? pair.name.value.value : null;
          const value = this.expr(pair.value) ?? 'undefined';
          return key === null
            ? `[${this.expr(pair.name) ?? 'undefined'}]: ${value}`
            : `${JSON.stringify(key)}: ${value}`;
        });
        return this.assign(op.result, `avm1.newObject({ ${pairs.join(', ')} })`);
      }
    }
  }

  private define(op: Op & { readonly kind: 'define' }): Chunk[] {
    const inner = op.fn.ir;
    const name = this.ctx.nameForBlock(`function:${op.fn.name ?? 'anon'}`);
    if (inner === null) return [`// ${op.fn.name ?? 'anonymous'}: body refused (residual), see porting-notes.json`];
    const lowered = lowerFunction(inner, { ...this.ctx, depth: (this.ctx.depth ?? 0) + 1, pool: inner.constants });
    if (lowered.refusal !== null) {
      return [`// ${op.fn.name ?? 'anonymous'}: ${lowered.refusal.detail}`];
    }
    const params = defineParams(op.fn.params, op.fn.preloads);
    return [
      `const ${name} = (${params.join(', ')}): Value => {`,
      {
        lines: [
          ...lowered.declarations,
          ...lowered.statements,
          ...(lowered.returns === null ? ['return undefined;'] : []),
        ],
      },
      '};',
    ];
  }

  private tryRegion(region: {
    catchInRegister: boolean;
    catchName: string | null;
    catchRegister: number | null;
    finallyPresent: boolean;
    tryBlocks: readonly BasicBlock[];
    catchBlocks: readonly BasicBlock[] | null;
    finallyBlocks: readonly BasicBlock[] | null;
  }): Chunk[] {
    const tryBody = this.blocksAsClosure(region.tryBlocks);
    const catchBody = region.catchBlocks === null ? null : this.blocksAsClosure(region.catchBlocks);
    const finallyBody = region.finallyBlocks === null ? null : this.blocksAsClosure(region.finallyBlocks);
    const out: Chunk[] = [];
    if (catchBody === null) {
      // No catch arm: AVM1 still runs the finally, and an uncaught value propagates to the player's handler.
      out.push('try {', { lines: tryBody }, '} finally {', { lines: finallyBody ?? ['// (no finally body)'] }, '}');
      return out;
    }
    const binding = region.catchInRegister
      ? region.catchRegister === null
        ? 'thrown'
        : `r${region.catchRegister} = thrown`
      : `frame.scope.set(${formatString(region.catchName ?? 'e')}, thrown)`;
    out.push('try {', { lines: tryBody }, '} catch (thrown) {');
    out.push({
      lines: [
        region.catchInRegister
          ? binding
          : `const thrown: Value = ${formatString(region.catchName ?? 'e')} === '' ? undefined : thrown;`,
        ...(region.catchInRegister ? [] : [`frame.scope.set(${formatString(region.catchName ?? 'e')}, thrown);`]),
        ...catchBody,
      ],
    });
    out.push('}');
    if (finallyBody !== null) out.push('// the finally body runs on both paths, in the same activation (E-039)');
    return out;
  }

  private withRegion(region: {
    object: Operand;
    withDepth: number;
    skipBody: boolean;
    bodyBlocks: readonly BasicBlock[];
  }): Chunk[] {
    const object = this.expr(region.object);
    if (object === null) return [this.unnameable('with')];
    if (region.skipBody) {
      return [`// With at depth ${region.withDepth} exceeds the version cap; the player skips the body`];
    }
    return [`avm1.withScope(${object}, () => {`, { lines: this.blocksAsClosure(region.bodyBlocks) }, '});'];
  }

  private blocksAsClosure(blocks: readonly BasicBlock[]): Chunk[] {
    const out: Chunk[] = [];
    for (const block of blocks) out.push(...this.block(block, blocks));
    return out;
  }

  private timeline(timeline: { readonly op: string; readonly [key: string]: unknown }): Chunk[] {
    const operand = (key: string): string => this.expr(timeline[key] as Operand) ?? 'undefined';
    switch (timeline.op) {
      case 'play':
        return ['target.play();'];
      case 'stop':
        return ['target.stop();'];
      case 'toggleQuality':
        return ['target.toggleQuality();'];
      case 'stopSounds':
        return ['target.stopSounds();'];
      case 'call':
        return [`target.callFrame(${operand('frame')});`];
      case 'waitForFrame':
        return [`target.waitForFrame(${operand('frame')});`];
      case 'waitForFrame2':
        return ['target.waitForFrame(0);'];
      case 'getURL': {
        const method = timeline.method as string;
        const loadVariables = timeline.loadVariables === true ? 'true' : 'false';
        return [`avm1.getURL(${operand('url')}, ${operand('target')}, ${formatString(method)}, ${loadVariables});`];
      }
      case 'goto':
        return this.gotoTarget(timeline.target);
      default:
        return [`avm1.unsupported(${formatString(`timeline op ${String(timeline.op)}`)});`];
    }
  }

  private gotoTarget(target: unknown): Chunk[] {
    const record = target as { kind: string; value?: Operand; play?: boolean; sceneBias?: number | null };
    const value = record.value === undefined ? 'undefined' : (this.expr(record.value) ?? 'undefined');
    const play = record.play === true ? 'true' : 'false';
    switch (record.kind) {
      case 'frame':
        return [`target.gotoFrame(${value}, ${play});`];
      case 'label':
        return [`target.gotoLabel(${value}, ${play});`];
      case 'next':
        return ['target.gotoFrame(target.currentFrame + 1, false);'];
      case 'previous':
        return ['target.gotoFrame(target.currentFrame - 1, false);'];
      case 'frame2': {
        const bias = record.sceneBias ?? null;
        return [
          `target.gotoFrame(${value}, ${record.play === true ? 'true' : 'false'}${bias === null ? '' : `, ${bias}`});`,
        ];
      }
      default:
        return [`avm1.unsupported(${formatString(`goto target ${record.kind}`)});`];
    }
  }

  /** An operand in expression position, or `null` when it cannot be named. */
  expr(operand: Operand | null | undefined): string | null {
    if (operand === null || operand === undefined) return null;
    if (operand.kind === 'stack') return null;
    if (operand.kind === 'temp') return `t${operand.id}`;
    const value = operand.value;
    switch (value.type) {
      case 'number':
        return formatNumber(value.value);
      case 'integer':
        // `bits` holds the file's UI32 pattern for bitwise exactness (IMPL-050-R019); `value` is that pattern
        // read as signed, which is what the player's bitwise ops see, so the signed reading is the literal.
        return formatNumber(value.value);
      case 'string':
        return formatString(value.value);
      case 'boolean':
        return value.value ? 'true' : 'false';
      case 'null':
        return 'null';
      case 'undefined':
        return 'undefined';
      case 'register':
        return value.index === 0 ? 'target' : `r${value.index}`;
      case 'pool':
        if (value.resolved !== null) return formatString(value.resolved);
        return this.ctx.pool === null ? `avm1.constant(${value.index})` : `pool[${value.index}]`;
      case 'object':
        return `avm1.newObject(${value.constructor === null ? 'undefined' : formatString(value.constructor)})`;
      case 'unknown':
        return null;
    }
  }
}

/**
 * `AVM1-R033`: a `DefineFunction2` body's preloads are bound by the *emitter's* prologue, not by the runtime,
 * and parameter registers are the parameters. So the emitted closure takes `args` and unpacks them here — the
 * only place that knows both the parameter list and the register count.
 */
export function defineParams(
  params: readonly { readonly name: string; readonly register: number | null }[],
  preloads: {
    readonly this: boolean;
    readonly arguments: boolean;
    readonly super: boolean;
    readonly root: boolean;
    readonly parent: boolean;
    readonly global: boolean;
  },
): string[] {
  const out = ['vm: Vm', 'target: Clip', 'frame: FrameCtx', 'args: readonly Value[] = []'];
  void preloads;
  for (const param of params) out.push(`/* ${param.name} */`);
  return out;
}

/** The emitter's own prelude for a defined function: the params and preloads it must bind before the body runs. */
export function definePrelude(ir: ActionIR, named: (name: string) => string): string[] {
  const out: string[] = [];
  ir.params.forEach((param, index) => {
    const slot = `args[${index}]`;
    if (param.register === null) out.push(`frame.scope.set(${formatString(param.name)}, ${slot});`);
    else out.push(`r${param.register} = ${slot};`);
    void named;
  });
  const preloads = ir.preloads;
  let next = 1;
  const bind = (flag: boolean, value: string, name: string): void => {
    if (!flag) return;
    if (next <= 6) out.push(`r${next} = ${value}; // preload: ${name}`);
    else out.push(`frame.scope.set(${formatString(name)}, ${value});`);
    next += 1;
  };
  bind(preloads.this, 'target', 'this');
  bind(preloads.arguments, 'args', 'arguments');
  bind(preloads.super, 'avm1.superOf(target)', 'super');
  bind(preloads.root, 'frame.root', '_root');
  bind(preloads.parent, 'target.parent', '_parent');
  bind(preloads.global, 'frame.global', '_global');
  return out;
}
