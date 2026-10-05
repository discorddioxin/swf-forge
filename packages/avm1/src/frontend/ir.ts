/**
 * `ActionIR` — `IMPL-050` §7 (R053–R060).
 *
 * The IR is plain serialisable data (R056): no closures, no functions, no Map/Set. Every field is
 * JSON-safe so tier decisions and requirements can be cached and diffed in goldens. The interface
 * mirrors the document's `ActionIR` contract; `BasicBlock` follows AVM1-R016's verified depths.
 */

// ---- values and operands ------------------------------------------------------------------------

/**
 * A value the partial evaluator could name. `integer` preserves the file's UI32 bit pattern so
 * bitwise actions stay exact (R019); `pool` carries the reference with `resolved` `null` when the
 * pool is dynamic (R022); `register` is a named slot of the function's register file.
 */
export type Avm1Value =
  | { readonly type: 'number'; readonly value: number }
  | { readonly type: 'string'; readonly value: string }
  | { readonly type: 'boolean'; readonly value: boolean }
  | { readonly type: 'null' }
  | { readonly type: 'undefined' }
  | { readonly type: 'integer'; readonly value: number; readonly bits: number }
  | { readonly type: 'pool'; readonly index: number; readonly resolved: string | null }
  | { readonly type: 'register'; readonly index: number }
  | { readonly type: 'object'; readonly constructor: string | null }
  | { readonly type: 'unknown' };

/** R056: an operand is a literal, an SSA temporary, or an unnamed stack slot. */
export type Operand =
  | { readonly kind: 'lit'; readonly value: Avm1Value }
  | { readonly kind: 'temp'; readonly id: number; readonly name?: string }
  | { readonly kind: 'stack' };

// ---- parameters and preloads (R024–R028) ----------------------------------------------------------

export interface PreloadFlags {
  readonly this: boolean;
  readonly arguments: boolean;
  readonly super: boolean;
  readonly root: boolean;
  readonly parent: boolean;
  readonly global: boolean;
}

export interface SuppressFlags {
  readonly this: boolean;
  readonly arguments: boolean;
  readonly super: boolean;
}

/** One parameter of `DefineFunction`/`DefineFunction2` (R025). */
export interface ParamSlot {
  readonly name: string;
  /** `null` = activation variable (v1 bodies, or a `REGISTERPARAM` register of 0). */
  readonly register: number | null;
}

/**
 * The chapter's register-allocation order (R026): parameters into their `REGISTERPARAM` registers
 * first, then the preloads from register 1 in the order this/arguments/super/_root/_parent/_global,
 * then locals. A preload overwriting a parameter register is reported, not avoided.
 */
export interface RegisterSlot {
  readonly index: number;
  readonly kind: 'param' | 'preload' | 'local';
  readonly name: string;
}

export interface FunctionDef {
  readonly version: 1 | 2;
  readonly name: string | null;
  readonly params: readonly ParamSlot[];
  readonly registerCount: number;
  /** Raw `Flags` UI16, preserved verbatim (R024). */
  readonly flags: number;
  readonly reservedBits: number;
  readonly preloads: PreloadFlags;
  readonly suppress: SuppressFlags;
  readonly registers: readonly RegisterSlot[];
  /** Body byte range, block-relative to the *defining* block. */
  readonly bodyStart: number;
  readonly bodyEnd: number;
  /** IR of the body — `null` when the body itself is untrusted (residual). */
  readonly ir: ActionIR | null;
}

// ---- call conventions (R043) ----------------------------------------------------------------------

export type CallKind = 'callFunction' | 'newObject' | 'callMethod' | 'newMethod' | 'initArray' | 'initObject';

/**
 * A call/init action, normalised *once* to source order (leftmost first) per R043. `numArgs`
 * `null` marks a runtime (non-constant) argument count.
 */
export interface CallOp {
  readonly kind: CallKind;
  readonly name: Operand | null;
  readonly object: Operand | null;
  readonly numArgs: number | null;
  readonly args: readonly Operand[];
  /** `initObject` pairs in source order; absent for the other kinds. */
  readonly pairs?: readonly { readonly value: Operand; readonly name: Operand }[];
}

// ---- timeline operands (R040/R041) -----------------------------------------------------------------

export type TimelineOp =
  | { readonly op: 'call'; readonly frame: Operand }
  | {
      readonly op: 'goto';
      readonly target:
        | { readonly kind: 'frame'; readonly value: Operand }
        | { readonly kind: 'label'; readonly value: Operand }
        | { readonly kind: 'next' }
        | { readonly kind: 'previous' }
        | {
            readonly kind: 'frame2';
            readonly value: Operand;
            readonly play: boolean;
            readonly sceneBias: number | null;
          };
    }
  | { readonly op: 'play' }
  | { readonly op: 'stop' }
  | { readonly op: 'toggleQuality' }
  | { readonly op: 'stopSounds' }
  | { readonly op: 'waitForFrame'; readonly frame: Operand; readonly skip: number }
  | { readonly op: 'waitForFrame2'; readonly skip: number }
  | {
      readonly op: 'getURL';
      readonly url: Operand;
      readonly target: Operand;
      readonly method: 'none' | 'get' | 'post';
      readonly loadTarget: boolean;
      readonly loadVariables: boolean;
    };

// ---- structured regions (R032–R035, R053) -----------------------------------------------------------

export interface TryRegion {
  readonly catchInRegister: boolean;
  /** Present when `catchInRegister` is false. */
  readonly catchName: string | null;
  /** Present when `catchInRegister` is true. There is no "finally register". */
  readonly catchRegister: number | null;
  readonly finallyPresent: boolean;
  /** The three bodies as nested block groups (no `End` terminators inside — R008). */
  readonly tryBlocks: readonly BasicBlock[];
  readonly catchBlocks: readonly BasicBlock[] | null;
  readonly finallyBlocks: readonly BasicBlock[] | null;
  /** `true` when the sizes do not tile the record (SF0404 → residual). */
  readonly malformed: boolean;
}

export interface WithRegion {
  readonly object: Operand;
  /** The depth this `With` occupies (1-based within the dynamic-scope stack). */
  readonly withDepth: number;
  /** `true` when the depth exceeded the version cap and the player skips the body (R032). */
  readonly skipBody: boolean;
  readonly bodyBlocks: readonly BasicBlock[];
}

// ---- ops (R057: `raw` only in T2) -------------------------------------------------------------------

export type Op =
  | { readonly kind: 'end' }
  | { readonly kind: 'inert'; readonly code: number; readonly name: string }
  | { readonly kind: 'unknown'; readonly code: number }
  | { readonly kind: 'push'; readonly values: readonly Operand[] }
  | { readonly kind: 'constantPool'; readonly count: number }
  | {
      readonly kind: 'binop';
      readonly code: number;
      readonly a: Operand;
      readonly b: Operand;
      readonly result: Operand;
    }
  | { readonly kind: 'unop'; readonly code: number; readonly a: Operand; readonly result: Operand }
  | {
      readonly kind: 'strExtract';
      readonly code: number;
      readonly str: Operand;
      readonly index: Operand;
      readonly count: Operand;
      readonly result: Operand;
    }
  | { readonly kind: 'call'; readonly call: CallOp; readonly result: Operand | null }
  | { readonly kind: 'define'; readonly fn: FunctionDef }
  | { readonly kind: 'storeRegister'; readonly register: number; readonly value: Operand }
  | { readonly kind: 'pop'; readonly value: Operand }
  | { readonly kind: 'duplicate'; readonly value: Operand }
  | { readonly kind: 'swap'; readonly a: Operand; readonly b: Operand }
  | { readonly kind: 'getVariable'; readonly name: Operand; readonly result: Operand }
  | { readonly kind: 'setVariable'; readonly name: Operand; readonly value: Operand }
  | { readonly kind: 'getMember'; readonly name: Operand; readonly object: Operand; readonly result: Operand }
  | { readonly kind: 'setMember'; readonly name: Operand; readonly object: Operand; readonly value: Operand }
  | { readonly kind: 'getProperty'; readonly id: Operand; readonly target: Operand; readonly result: Operand }
  | { readonly kind: 'setProperty'; readonly id: Operand; readonly target: Operand; readonly value: Operand }
  | { readonly kind: 'delete'; readonly name: Operand; readonly object: Operand }
  | { readonly kind: 'delete2'; readonly name: Operand }
  | { readonly kind: 'defineLocal'; readonly name: Operand; readonly value: Operand }
  | { readonly kind: 'defineLocal2'; readonly name: Operand; readonly result: Operand }
  | { readonly kind: 'cloneSprite'; readonly depth: Operand; readonly target: Operand; readonly source: Operand }
  | { readonly kind: 'removeSprite'; readonly target: Operand }
  | { readonly kind: 'trace'; readonly value: Operand }
  | {
      readonly kind: 'startDrag';
      readonly target: Operand;
      readonly lockcenter: Operand;
      readonly constrain: Operand;
      /** `y2, x2, y1, x1` — present when `constrain` is a known `true`. */
      readonly bounds?: readonly [Operand, Operand, Operand, Operand];
    }
  | { readonly kind: 'endDrag' }
  | { readonly kind: 'instanceof'; readonly obj: Operand; readonly constr: Operand; readonly result: Operand }
  | { readonly kind: 'castOp'; readonly obj: Operand; readonly constr: Operand; readonly result: Operand }
  | { readonly kind: 'extends'; readonly superclass: Operand; readonly subclass: Operand }
  | {
      readonly kind: 'implementsOp';
      readonly constr: Operand;
      readonly numInterfaces: number | null;
      readonly interfaces: readonly Operand[];
    }
  | { readonly kind: 'enumerate'; readonly code: number; readonly obj: Operand }
  | { readonly kind: 'getTime' }
  | { readonly kind: 'timeline'; readonly timeline: TimelineOp }
  | { readonly kind: 'target'; readonly target: TargetRef; readonly value: Operand | null }
  | { readonly kind: 'return'; readonly value: Operand }
  | { readonly kind: 'throw'; readonly value: Operand }
  | { readonly kind: 'try'; readonly region: TryRegion }
  | { readonly kind: 'with'; readonly region: WithRegion }
  | { readonly kind: 'raw'; readonly offset: number; readonly length: number; readonly code: number };

// ---- target paths (R036/R037) -----------------------------------------------------------------------

/** A parsed target: clip path + optional local name; `dynamic` for `SetTarget2` stack values. */
export type TargetRef =
  | { readonly kind: 'file' } // the current file (empty target)
  | { readonly kind: 'path'; readonly clips: readonly string[]; readonly name: string | null }
  | { readonly kind: 'dynamic'; readonly value: Operand };

// ---- basic blocks -----------------------------------------------------------------------------------

export type Terminator =
  | { readonly kind: 'fallthrough'; readonly next: number | null }
  | { readonly kind: 'jump'; readonly target: number | null }
  | {
      readonly kind: 'branch';
      readonly condition: Operand;
      readonly ifTrue: number | null;
      readonly ifFalse: number | null;
    }
  | { readonly kind: 'return' }
  | { readonly kind: 'throw' }
  | { readonly kind: 'target'; readonly target: TargetRef; readonly value: Operand | null };

export interface BasicBlock {
  readonly id: number;
  readonly ops: readonly Op[];
  readonly terminator: Terminator;
  /** Verified stack depth on entry (`-1` = unknown, e.g. after a variable-push op). */
  readonly stackIn: number;
  /** Verified stack depth on exit (`-1` = unknown). R054: a mismatch is `SF0406`, never fixed. */
  readonly stackOut: number;
  /** R055: retained and marked; pruning is a separate opt-in pass. */
  unreachable: boolean;
  /** The current target for this block (null = the current file), a region parameter (R036). */
  readonly target: TargetRef | null;
  /** Block-relative byte range of the records in this block (contiguous, R057). */
  readonly firstOffset: number;
  readonly endOffset: number;
}

// ---- tiering (R058) ---------------------------------------------------------------------------------

export interface TierReason {
  /** Machine-readable: `unknown-opcode:0x8b`, `dynamic-with`, `branch-out-of-bounds`, … */
  readonly reason: string;
  /** The diagnostic that triggered it, if any. */
  readonly diagnostic: string | null;
  /** Block-relative offset, when known. */
  readonly offset: number | null;
}

// ---- requirements (R061) -----------------------------------------------------------------------------

/** A host-API group id, from AVM1-§8.1's table. */
export type HostApiGroup =
  | 'core-objects'
  | 'movie-objects'
  | 'events'
  | 'sound'
  | 'loading'
  | 'data'
  | 'drawing'
  | 'bitmap'
  | 'geometry'
  | 'filters'
  | 'colour'
  | 'misc-system'
  | 'legacy-as1'
  | 'timeline';

export interface HostApiRequirement {
  readonly group: HostApiGroup;
  /** The op that needs it, for the report. */
  readonly via: string;
  readonly offset: number | null;
}

// ---- the block ---------------------------------------------------------------------------------------

export type BlockKind = 'timeline' | 'init' | 'clipEvent' | 'button' | 'function' | 'classMethod';

export interface ActionIR {
  readonly kind: BlockKind;
  /** Stable emitted symbol base name. */
  readonly id: string;
  /** Byte range of the block, in the coordinates the caller passed (usually file-absolute). */
  readonly byteRange: { readonly start: number; readonly end: number };
  readonly blocks: readonly BasicBlock[];
  /** `DefineFunction2` RegisterCount (0 for v1 and non-function blocks). */
  readonly registers: number;
  readonly params: readonly ParamSlot[];
  readonly preloads: PreloadFlags;
  readonly suppress: SuppressFlags;
  /** The pool as written at the defining point (the last `ConstantPool` in the block). */
  readonly constants: readonly string[];
  /** R022: `true` when a constant8/16 inside a function body is modelled dynamic. */
  readonly poolIsDynamic: boolean;
  readonly tier: 0 | 1 | 2;
  /** The first T2 reason, when tier is 2 (R058). */
  readonly residualReason: string | null;
  readonly tierReasons: readonly TierReason[];
  readonly requirements: readonly HostApiRequirement[];
  readonly sourceName: string | null;
  /** Which timeline frames reference this block (frame scripts, init frames). */
  readonly frameAssociations: readonly number[];
  /** `DoInitAction` only: the movie-level execution index. */
  readonly initOrder: number | null;
  /** R006: whether the block carried its terminating `End`. */
  readonly terminated: boolean;
  /** Block-relative byte slices for the interpreter, when tier is 2 (R057). */
  readonly residual: readonly { readonly blockId: number; readonly offset: number; readonly length: number }[] | null;
}

export const NO_PRELOADS: PreloadFlags = {
  this: false,
  arguments: false,
  super: false,
  root: false,
  parent: false,
  global: false,
};

export const NO_SUPPRESS: SuppressFlags = { this: false, arguments: false, super: false };
