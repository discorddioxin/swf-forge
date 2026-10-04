# AVM1 — ActionScript 1/2 Semantics and TypeScript Code Generation

**Doc ID:** AVM1 · **Status:** Draft 1.3 · **Normative:** yes

---

## 1. Scope

This document specifies:

1. the semantics of AVM1 (AS1/AS2) that the compiled output must preserve (AVM1-§5–§12),
2. how AVM1 bytecode is decoded and represented (AVM1-§4–§5),
3. how it is emitted as TypeScript and what the emitted code may call (AVM1-§6, §8),
4. the host API surface the runtime must implement (AVM1-§8),
5. the tiering rules that decide when static compilation is impossible (AVM1-§9),
6. the test obligations that pin ambiguous behaviour (AVM1-§13).

Graphics, audio, and asset specifics are delegated (GFX, AUD, AST). This document owns the
*object model, control flow, coercion, and event semantics*.

## 2. Fidelity strategy

AVM1 is specified only sketchily (the AS2 Language Reference documents the *API*, the SWF spec
documents the *bytecode*, and neither documents the semantics completely). Three sources of truth
exist, in decreasing authority:

| Source | Role |
| --- | --- |
| Flash Player / a maintained AVM1 implementation | **Oracle** for ambiguous semantics; used in tests, never shipped |
| AS2 Language Reference | API surface, argument shapes, documented returns |
| This document | Our committed interpretation, with every non-obvious choice in the Decision register |

**AVM1-R001** Every requirement derived from oracle observation rather than documentation MUST carry
the marker `[oracle-pinned]` and a fixture ID. Where we could not observe the oracle, the
requirement MUST carry a decision ID in the Decision register instead.

**AVM1-R002** Where an implementation cannot reproduce oracle behaviour, it MUST prefer
(a) preserving game *logic* correctness over (b) exact bit-for-bit output, and MUST record the
divergence with the mechanism in CMP-§9.2 (`risk` severity).

## 3. Execution model

### 3.1 Movies, levels, timelines

A swf-forge game is a forest of *movies* (the main movie plus any `loadMovie*`-ed siblings) each
with a root timeline, plus a tree of *clips* (`MovieClip`) that carry their own timelines.

- Levels: `_level0`, `_level1`, … are main-movie roots. `_level0` is `_root`.
- A clip's timeline: frames 1…N (1-based externally, 0-based in our runtime internals; see AVM1-R005).
- Frames contain placements (display list ops) and actions (`DoAction`).
- Frame labels and scenes are indices into the timeline; scenes are collapsed at compile time into
  a single frame space with a label→frame map, because scene semantics only affect
  `nextScene`/`prevScene` and `_currentframe` continuities (`AVM1-D04`).

**AVM1-R003** Actions for frame *N* MUST execute after that frame's placements have been applied,
and before the frame is rendered. This matches the observable ordering of Flash Player:
placements → actions → render ([oracle-pinned] `T-AVM1-001`).

**AVM1-R004** `DoInitAction` blocks MUST execute once, before the first `DoAction` of the same
sprite runs, and in file order among themselves. Root init actions run before the root's frame-1
actions ([oracle-pinned] `T-AVM1-002`).

**AVM1-R005** The runtime's internal frame indices are 0-based; every host API boundary converts.
`_currentframe` is 1-based on the outside, and `gotoAndStop(1)` is frame index 0 internally. Define
these conversions exactly once (a single `toFrameIndex` helper) to avoid off-by-one drift.

### 3.2 The frame clock

**AVM1-R006** The runtime MUST advance timelines on a fixed-accumulator clock derived from the SWF
frame rate, decoupled from the display refresh rate (RT-§5.2). This preserves `onEnterFrame`
frequency semantics under all display refresh rates.

**AVM1-R007** When the accumulator falls behind (tab throttling, long frames), catch-up MUST be
bounded: at most `maxCatchUpFrames` (default 2) timeline advances per rendered frame, with a
`risk`-level runtime warning (deduplicated) when the bound is hit. Unbounded catch-up makes games
with physics-in-frame-scripts behave *worse*, not better.

**AVM1-R008** `getTimer()` MUST return milliseconds since runtime start (`performance.now()` origin),
monotonic, unaffected by the frame clock, and MUST NOT reset on pause/resume.

### 3.3 Frame execution order

Per timeline advance, the runtime performs, in order:

```
1. Apply pending placements/removals for the new frame (display list mutation).
2. Fire onLoad / onEnterFrame handlers for clips whose timelines were entered.   [oracle-pinned]
3. Execute the frame's DoAction blocks in file order.
4. Execute pending "onData"/"onLoad" callbacks queued by completions (AUD/RT).
5. Advance child timelines in depth order; their step recursively performs 1–4.
6. Emit the frame to the renderer (GFX) and the stream sound position for the frame (AUD).
```

**AVM1-R009** Step 5's ordering (parents before children at the same step, children visited in
ascending depth then ascending level) is `[oracle-pinned]` (`T-AVM1-003`) and MUST be implemented by
a deterministic traversal: depth ascending, then `_name` lexicographic as the final tie-break, so
sibling ordering is stable even when depths collide (which happens after `swapDepths` races).

**AVM1-R010** A `gotoAndStop`/`gotoAndPlay` executed inside a handler MUST NOT interrupt the
currently executing action block; the remaining actions in that block still run, then the playhead
moves. This is the classic "statements after gotoAndPlay still execute" behaviour
(`[oracle-pinned]` `T-AVM1-004`).

## 4. Bytecode front end

### 4.1 Decode

AVM1 actions are a sequence of records:

```
ACTIONRECORDHEADER:
  UI8  code        // 0x00..0x7F: no length field (record length implied by the opcode)
                   // 0x80..0xFF: UI16 length follows (and length >= 2)
  if code >= 0x80: UI16 length
  bytes[payload]
```

**AVM1-R011** Opcodes below 0x80 with a defined payload (e.g. `ActionPush` is 0x96 ≥ 0x80; but
`ActionIf` 0x9D, `ActionJump` 0x99, `ActionWaitForFrame2` 0x8D carry payloads) — the decoder MUST use
the authoritative opcode table (APP-§2), not the "high bit means length" heuristic alone. The
heuristic is correct for the *presence* of the length field but not for the payload layout.

**AVM1-R012** Unknown opcodes MUST make the enclosing function residual (CMP-R010) and record the
byte range. They MUST NOT be skipped silently, because skipping desynchronises the stack.

**AVM1-R013** `ActionPush` type bytes (0 = string, 1 = float (little-endian f32), 2 = null,
3 = undefined, 4 = register, 5 = boolean, 6 = double (little-endian f64), 7 = integer (i32),
8 = constant8, 9 = constant16) MUST all be decoded. Floats MUST be widened to JS doubles without
`Math.fround` round-tripping.

**AVM1-R014** `ActionConstantPool` (0x88) is **execution state, not lexical scope**: it "creates a new
constant pool, and replaces the old constant pool if one already exists". A `DefineFunction*` body is
*not* a new realm — its `constant8`/`constant16` indices resolve against whatever pool is current when
the body *runs*. Where the pool in effect at a call site is not statically provable, the indices MUST
be modelled as dynamic (tier ≥ T1, `SF0410`) rather than guessed. (Corrected in 1.1: the original
"scoped to the enclosing block" wording contradicted Ch.5; see `IMPL-050-R022/R023`.)

**AVM1-R015** `ActionSetTarget` / `ActionSetTarget2` change the *target* for subsequent actions in
the block. The front end MUST model this as an explicit block-splitting state change; it is a
primary cause of `T1` tiering.

### 4.2 IR

```ts
export interface ActionIR {
  readonly kind: 'timeline' | 'clipEvent' | 'button' | 'function' | 'init' | 'classMethod';
  readonly id: string;                      // stable symbol name for emission
  readonly byteRange: { start: number; end: number };
  readonly blocks: readonly BasicBlock[];
  readonly registers: number;               // DefineFunction2 register count
  readonly params: readonly ParamSlot[];
  readonly locals: readonly LocalSlot[];    // recovered temporaries
  readonly constants: readonly Value[];
  readonly tier: 0 | 1 | 2;
  readonly residualReason: string | null;
  readonly requirements: readonly HostApiRequirement[];
}

export interface BasicBlock {
  readonly id: number;
  readonly ops: readonly Op[];              // partially-evaluated stack ops
  readonly terminator: Terminator;          // jump / branch / return / throw / fallthrough
  readonly stackIn: number;                 // stack depth on entry (validated)
  readonly stackOut: number;
}
```

**AVM1-R016** The front end MUST verify stack balance on every block boundary. An imbalance that
cannot be explained by a legitimate pattern (e.g. `ActionTry`'s register save) MUST make the
function residual, with the verified depth recorded for diagnostics.

**AVM1-R017** Operand-stack simulation MUST be *partial*: values with known constants are folded
into the IR as literals; unknown values become SSA temporaries. Folding MUST respect AVM1 coercion
rules exactly (AVM1-§5) — e.g. `"5" + 5` may not be folded to `10` because `ActionAdd2` semantics
depend on the *left* operand's type and string-ness.

## 5. Value model and coercion

### 5.1 Representation in TypeScript

```ts
/** An AVM1 value as seen by the emitted code. */
export type Value =
  | undefined | null | boolean | number | string
  | Avm1Object
  | Avm1Function
  | MovieClip
  | Avm1HostObject;      // Sound, Color, Date, XML, LoadVars, …

/** Dynamic object: NOT a plain JS object. */
export interface Avm1Object {
  readonly props: Map<string, PropertySlot>;   // insertion-ordered
  proto: Avm1Object | null;                    // __proto__
  readonly isHost: boolean;
}

export interface PropertySlot {
  /** Marked for getter/setter pairs. */
  readonly getter?: Avm1Function;
  readonly setter?: Avm1Function;
  value?: Value;
  /** AVM1 property attributes (addProperty / ASSetPropFlags). */
  flags: number;   // 0 = enumerable+dontdelete+read-write; see §7.4
}
```

**AVM1-R018** AVM1 objects MUST NOT be represented by plain JavaScript objects. Rationale:
enumeration order, integer-like key semantics, `__proto__` handling, prototype-chain walking, and
the "properties can be added to almost anything" model all differ; using plain objects leaks JS
semantics into game behaviour and creates prototype-pollution hazards (`__proto__`, `constructor`)
that SEC-§3 forbids.

**AVM1-R019** Primitives MUST use native JS types (`number`, `string`, `boolean`, `null`,
`undefined`). Wrapper objects (`new Number(5)`) exist only when a game explicitly constructs them,
and MUST be distinguishable (`typeof` returns `"object"` for them, `"number"` for primitives).

**AVM1-R020** Strings MUST be JS strings (UTF-16 code units). SWF string constants are decoded from
the file's declared encoding (`DefineFontInfo`/`DefineEditText` code page, SWF ≥ 6 ⇒ UTF-8 for
`ActionPush` string constants as stored in the *file*). The decoder MUST follow SWF-§6.5's
documented rules per version ([oracle-pinned] `T-AVM1-006`).

### 5.2 Conversion rules (normative)

`ToNumber(v)`:

| Input | Result |
| --- | --- |
| `undefined`, `null` | `undefined` becomes `NaN`; `null` becomes `0` |
| `true` / `false` | `1` / `0` |
| `number` | itself |
| `string` | ECMA-262 `ToNumber` on the string, with AVM1 specifics: whitespace trimmed; empty/whitespace-only → `0`; `"0x10"` → `16`; `"Infinity"` → `Infinity`; trailing junk → `NaN` |
| object | `ToNumber(ToPrimitive(v, 'number'))`, where `ToPrimitive` calls `valueOf` then `toString` |

`ToString(v)`:

| Input | Result |
| --- | --- |
| `undefined` | `"undefined"` |
| `null` | `"null"` |
| `true`/`false` | `"true"`/`"false"` |
| `number` | see §5.3 |
| string | itself |
| MovieClip | the clip's target path (`_level0.hero`), i.e. `_target` (`[oracle-pinned]`) |
| object | `ToPrimitive(v, 'string')` → `toString()` result |

`ToBoolean(v)`: `false` for `undefined`, `null`, `false`, `0`, `-0`, `NaN`, `""`; `true` otherwise,
**including empty objects and empty arrays** (Flash has no PHP-style falsy containers).

**AVM1-R021** `ToPrimitive` MUST probe `valueOf`/`toString` **in that order for the number hint and
reverse for the string hint**, MUST invoke user-defined overrides (games rely on
`Array.prototype.toString` being overridable), and MUST guard against infinite recursion (depth 32,
then `SF0423`).

**AVM1-R022** Equality (`==`) MUST follow ECMA-262 §11.9.3 abstract equality, with two AVM1
amendments that MUST be verified against the oracle and pinned by fixtures:
(a) objects are never equal to primitives except through `ToPrimitive`, and
(b) `undefined == null` is `true`.
`===` MUST compare without coercion and MUST compare objects by identity.

**AVM1-R023** `<`, `<=`, `>`, `>=` use numeric comparison unless *both* operands are strings, in
which case string comparison (UTF-16 code unit order) applies. `ActionLess` (0x0F) differs from
`ActionLess2` (0x48): the former coerces differently for strings
(`[oracle-pinned]` `T-AVM1-007`). Both must be implemented distinctly.

**AVM1-R024** `ActionAdd` (0x0A) and `ActionAdd2` (0x47, `+`) MUST be implemented distinctly:

```
ActionAdd(lhs, rhs):
  if ToPrimitive(lhs, 'string') is a string → string concat
  else                                      → ToNumber(lhs) + ToNumber(rhs)
ActionAdd2 (the `+` operator):
  if either ToPrimitive is a string        → string concat
  else                                     → numeric add
```

`ActionStringAdd`/`StringAdd` (0x21) MUST force string concatenation. `[oracle-pinned]`
`T-AVM1-008` covers all three with a coercion matrix fixture.

### 5.3 Number → string (`[oracle-pinned]`)

This is the single most consequential formatting difference between AVM1 and JavaScript.

**AVM1-R025** `ToString(number)` for the default (radix 10) case MUST use decimal formatting with at
most **15 significant digits** and AVM1's exponent style, not JS's shortest-round-trip algorithm.
The observable consequences every porter sees:

| Expression | AVM1 output | JavaScript output |
| --- | --- | --- |
| `0.1 + 0.2` | `0.3` | `0.30000000000000004` |
| `1 / 3` | `0.333333333333333` | `0.3333333333333333` |
| `1e21` | `1e+21` | `1e+21` |
| `1e-7` | `1e-7` | `1e-7` |
| `1234567890123456789` | `1.23456789012346e+18` | `1234567890123456800` |
| `-0` | `0` | `0` |

**AVM1-R026** Implementation MUST be a correctly-rounded decimal conversion that rounds to
15 significant digits with ties-to-even, using either a `%.15g`-equivalent routine over the exact
IEEE value or a proven library (e.g. a vendored `dtoa` with a 15-digit mode). `Number.prototype.toFixed`,
`toExponential`, and `toString(radix)` are separate methods with their own (ECMA-following) rules and
`toFixed` MUST follow ECMA-262 semantics including its 0–20 digit range check.

**AVM1-R027** `trace(v)` and string concatenation MUST use `ToString` (so `trace(0.1+0.2)` prints
`0.3`). Because JS cannot be coerced into this by configuration, the runtime MUST provide
`avm1ToString(number): string` and emitted code MUST route numeric string conversion through it
whenever the conversion is *observable* (concatenation, `trace`, `String(n)`, property keys,
`setMember` with a number). Internal numeric values stay as JS numbers; only conversion points
differ. This keeps the common arithmetic path at native speed.

### 5.4 `typeof`, `isNaN`, `parseInt`, `parseFloat`

**AVM1-R028** `typeof` MUST return: `"undefined"` (undefined), `"null"` (null), `"boolean"`,
`"number"`, `"string"`, `"function"` (functions and native methods), `"movieclip"` (MovieClip
instances), `"object"` (everything else, including arrays, `Date`, `XML`, `Sound`,
wrapper objects, and `Button`/`TextField` instances).

**AVM1-R029** `isNaN(x)`: unlike ECMA's global `isNaN`, AVM1's returns `true` only for `NaN` and
`undefined`-ish results; the committed rule is: `isNaN(v) === Number.isNaN(ToNumber(v))` with
`ToNumber(undefined) = NaN`. Fixtures cover `""`, `" "`, `"abc"`, `null`, `undefined`, `{}`.
`[oracle-pinned]` `T-AVM1-009`.

**AVM1-R030** `parseInt(string, radix)` MUST follow ECMA-262 ed.3 including the leading-`0x`
detection when radix is 0/undefined, and MUST return `NaN` when no digits parse. AVM1 additionally
accepts leading whitespace and a sign. `parseFloat` follows ECMA ed.3 (leading `Infinity` supported).

### 5.5 `NaN`, `Infinity`, and numeric edge cases

- `NaN` comparisons are false except `!=`; `NaN` is falsy; `String(NaN)` is `"NaN"`.
- `Infinity` prints as `"Infinity"`, falsy? No: truthy (non-zero). `-Infinity` prints `"-Infinity"`.
- Division by zero yields `±Infinity` (never an error); `0/0` is `NaN`.
- Bitwise operators coerce via `ToInt32`/`ToUint32` (ECMA), which turn `Infinity`/`NaN` into `0`.
- `Math.round(-0.5)` is `0` in ECMA (rounds toward +∞ for .5); AVM1 follows ECMA here
  (`[oracle-pinned]` `T-AVM1-010`).

### 5.6 Integer-keyed members and array indices

**AVM1-R031** Property keys MUST be the `ToString` of the key *except* that integer-like keys
(`1`, `-2`) use AVM1's number formatting (`"1"`, `"-2"`; never `"1.0"`). `a[1.0]` and `a["1"]`
address the same slot, and `a[1.5]` addresses the key `"1.5"`.

## 6. Code generation

### 6.1 Emission shapes

**AVM1-R032** T0 functions MUST be emitted as plain TypeScript statements. A representative mapping:

| AVM1 | Emitted TypeScript |
| --- | --- |
| `ActionPush 5` | `5` (literal, folded) |
| `ActionGetVariable "x"` | `scope.get('x')` |
| `ActionSetVariable "x"` | `scope.set('x', value)` |
| `ActionGetMember` | `obj.getMember(key)` |
| `ActionSetMember` | `obj.setMember(key, value)` |
| `ActionCallFunction` | `avm1.callFunction(fn, thisArg, args)` |
| `ActionCallMethod` | `obj.callMethod(name, args)` (or direct if provably typed) |
| `ActionNewObject` | `avm1.construct(ctor, args)` |
| `ActionDefineFunction2` | `function name(params…) { … }` with registers as `let r1…` |
| `ActionIf` / `ActionJump` | `if`/`else`, `while`, `break`/`continue` where reducible |
| `ActionTry` | `try/catch/finally` with AVM1 error values |
| `ActionWith` (0x94) | `avm1.withScope(scopeObj, () => { … })` — forces T1 if the object is not statically known |
| `ActionEnumerate`/`Enumerate2` | `for (const key of avm1.keys(obj))` |
| `ActionRandomNumber` | `avm1.randomInt(n)` |
| `ActionGetProperty`/`SetProperty` | `clip.getProperty(id)` / `clip.setProperty(id, v)` |

**AVM1-R033** Register-based code (`DefineFunction2` with `RegisterCount > 0`) MUST map registers to
`let` locals named `r0…rN`, and `ActionStoreRegister` to assignment. Registers are per-invocation and
MUST NOT be hoisted or shared. Parameter registers (preloaded params) MUST be bound by the emitter's
prologue, not by the runtime.

**AVM1-R034** `ActionSetTarget`-based targeting MUST NOT be implemented by mutating a global "current
target"; the front end MUST rewrite the affected block into a form whose target is an explicit
argument (`withTarget(targetPath, () => { … })`). Global target state breaks reentrancy
(event handlers firing during script execution) — a real failure mode in games with `onEnterFrame`
inside `on(press)` chains.

**AVM1-R035** Emitted functions MUST be *pure with respect to runtime state*: they receive their
scope, target self, root, and `_global` as explicit parameters (or capture them from a generated
closure) — no ambient lookups, so an emitted function can be unit-tested directly.

### 6.2 Determinism of emitted names

**AVM1-R036** Name recovery order: (1) linkage/export name, (2) `Object.registerClass` string
literal, (3) `__proto__` construction site name, (4) frame label or symbol name from the authoring
tool's `Metadata` if present, (5) deterministic synthetic name. Synthetic names use the pattern
`<kind><CharacterId>_<n>` (e.g. `Sprite12_03`, `fn41_01`) — never hashes, never timestamps.

### 6.3 What the emitted code may not do

- **AVM1-R037** No `Proxy`, no `eval`, no `with`, no `Function` constructor, no `arguments.callee`,
  no mutation of `Object.prototype`/`Array.prototype` (AVM1 games that *do* this are supported
  through the AVM1 object model, which has its own prototype objects — see §7.2).
- **AVM1-R038** No reliance on JS property enumeration order for AVM1 semantics: enumeration MUST go
  through the ordered `props` map (§7.3).
- **AVM1-R039** No `async`/`await` or promise-based control flow inside emitted AVM1 logic; AVM1 is
  synchronous. Asynchronous host operations (loading, sounds, timers) MUST surface as *queued events*
  dispatched at defined points in the frame loop (§10.4, RT-§5.4).

## 7. Object model

### 7.1 Prototypes and `__proto__`

**AVM1-R040** Every object has a prototype link. The prototype of a constructed object is the
`prototype` property of its constructor at construction time. Assignment to `obj.__proto__` MUST
re-link the chain (with a cycle check; `SF0424` on cycle).

**AVM1-R041** The chain used for member lookup is `props` → `proto` → … → `Object.prototype` →
`null`. Proxy-style `__resolve` MUST be consulted *after* the whole chain misses (§7.2).

**AVM1-R042** Built-in prototypes (`Object`, `Array`, `String`, `Number`, `Boolean`, `Function`,
`MovieClip`, `TextField`, `Button`, `Color`, `Sound`, `Date`, `Math`, `XML`, `XMLNode`, `LoadVars`,
`XMLSocket`, `LocalConnection`, `SharedObject`, `MovieClipLoader`, `Selection`, `Stage`, `Key`,
`Mouse`, `System`, `TextSnapshot`, `flash.geom.*`, `flash.filters.*`) MUST be **per-runtime-instance**
objects, not JS globals, and MUST be mutable (games routinely monkey-patch
`MovieClip.prototype.foo = function(){…}`).

### 7.2 `__resolve` and friends

**AVM1-R043** If a member lookup misses, and the object (or its prototype chain) defines
`__resolve` as a function, it MUST be called as `__resolve(name)` with `this` bound to the object;
a return value of the correct kind is used, `undefined` means "still missing". A missing member read
MUST return `undefined` (no exception). `[oracle-pinned]` `T-AVM1-011`.

**AVM1-R044** `ASSetPropFlags`, `addProperty`, `watch`, `unwatch`, `isPropertyEnumerable`,
`hasOwnProperty`, `isPrototypeOf`, `Object.registerClass` MUST all be implemented with their AVM1
semantics. `registerClass` associates a constructor with an exported symbol so that
`attachMovie`/timeline placement constructs the class instance.

### 7.3 Enumeration

**AVM1-R045** `for (k in obj)` MUST enumerate own enumerable properties in insertion order, then walk
the prototype chain (each prototype's own enumerable properties, in insertion order), skipping
duplicates by name and skipping non-enumerable properties. The iteration order MUST be stable and
independent of JS engine object layout. `[oracle-pinned]` `T-AVM1-012`.

**AVM1-R046** Mutating an object while enumerating MUST be defined: keys added after enumeration
begins are not visited; deleted keys are skipped; a key deleted then re-added is visited once at its
original position if it was already visited, otherwise skipped. Implementations MUST snapshot the
key list at enumeration start (this matches oracle behaviour in the common cases and is fully
deterministic).

### 7.4 Property attributes

**AVM1-R047** The default property attributes are `enumerable`, `dontDelete` = false,
read-write. `ASSetPropFlags(obj, names, set, clear)` bits: `1 = dontDelete`, `2 = dontEnum`,
`4 = dontExecute`(? no-op), `8 = readOnly`. The runtime MUST implement bits 1, 2, 8 and treat
unknown bits as no-ops with a one-time `info` diagnostic. `[oracle-pinned]` `T-AVM1-013`.

## 8. Host API surface

The host API is the contract between emitted code and the runtime. It is large but shallow: each
entry is a typed TS function/class with the AVM1-visible semantics.

### 8.1 Groups and priority tiers

| Group | Examples | Tier | Notes |
| --- | --- | --- | --- |
| Core objects | `Object`, `Function`, `String`, `Number`, `Boolean`, `Array`, `Math`, `Date` | 1 | Needed by nearly every game |
| Movie objects | `MovieClip`, `Button`, `TextField`, `Stage`, `Selection`, `TextSnapshot` | 1 | Display + timeline |
| Events | `Key`, `Mouse`, `onEnterFrame`/`onMouse*`, `updateAfterEvent` | 1 | Input |
| Sound | `Sound`, `stopAllSounds` | 1 | AUD-§5 |
| Loading | `loadMovie*`, `MovieClipLoader`, `loadVariables`, `LoadVars`, `getURL` | 2 | RT-§6 |
| Data | `XML`, `XMLNode`, `XMLSocket`, `LocalConnection`, `SharedObject` | 2 | RT-§6.3 |
| Drawing | `MovieClip` drawing API (`beginFill`…`lineGradientStyle`, `clear`) | 1 | GFX-§5.4 |
| Bitmap | `flash.display.BitmapData`, `MovieClip.attachBitmap`, `beginBitmapFill` | 2 | AST-§3.5 |
| Geometry | `flash.geom.Matrix`, `Point`, `Rectangle`, `ColorTransform`, `transform` | 1 | GFX/AST |
| Filters | `flash.filters.*`, `filters` property | 3 | GFX-§10 |
| Colour | `Color` (AS1-era) | 1 | CXFORM semantics |
| Misc/system | `System.*`, `Locale`, `fscommand`, `ExternalInterface`, `print` | 3 | RT-§7 |
| Legacy/AS1 | `duplicateMovieClip`, `removeMovieClip`, `tellTarget`, `ifFrameLoaded` | 1 | Compiler lowers `tellTarget`/`with` |

**AVM1-R048** Tier 1 groups MUST be complete before any C1 rating is claimed. Tier 3 entries MAY
degrade to no-ops *only* with a boot-time capability report and a `risk` diagnostic naming the
missing entry.

### 8.2 Signature and return-value policy

**AVM1-R049** Host functions MUST accept the argument shapes tolerated by Flash: missing arguments
are `undefined`; extra arguments are ignored; numeric arguments accept numeric strings; booleans
coerce. Where Flash documents `Number`, the runtime MUST `ToNumber`; where it documents `int` for
properties, the runtime MUST clamp as Flash does (`_alpha` 0–100, `_xscale` unbounded but NaN-safe,
depth integers, `_rotation` unbounded modulo 360 in output).

**AVM1-R050** Return values MUST match the AS2 Language Reference, including the documented
"returns `undefined`" cases (`gotoAndPlay`, `setMask`, `startDrag`, …). Games test
`if (mc.someMethod() == undefined)`; sloppy `return null` breaks them.

**AVM1-R051** Property accessors on MovieClip (`_x`, `_width`, `_alpha`, `_rotation`, `_parent`, …)
MUST be implemented as real getters/setters participating in the AVM1 property model, so
`addProperty`/`watch`/`__resolve` compose with them
(overriding `_x` on a clip instance is legal AVM1).

### 8.3 The fixed property set

`_x _y _xmouse _ymouse _xscale _yscale _rotation _alpha _visible _width _height _currentframe
_totalframes _framesloaded _name _target _droptarget _url _root _parent _quality _highquality
_focusrect _soundbuftime _lockroot _level0..N`

**AVM1-R052** `_width`/`_height` MUST reflect the bounding box of the clip's *rendered content in
its own coordinate space*, recomputed after content changes, which means the renderer must expose
per-clip bounds (GFX-§11.5). This is a real coupling and a common source of wrong collision boxes;
it MUST be implemented, not approximated by the authored shape bounds when children changed.

**AVM1-R053** `_xmouse`/`_ymouse` MUST be in the clip's local coordinate space, converted from the
pointer's stage position through the inverse of the clip's concatenated matrix, and MUST return the
values from the *last input sample* (not recomputed per read) so that reads inside a single action
block are consistent.

**AVM1-R054** `_rotation` MUST be exposed in degrees, clockwise, and MUST preserve the
"rotation-only" representation independently of skew (`AVM1-D09`).

### 8.4 Timeline control

`play stop gotoAndPlay gotoAndStop nextFrame prevFrame nextScene prevScene` plus AS1-era
`tellTarget`/`with` (lowered at compile time), `ifFrameLoaded`.

**AVM1-R055** `gotoAndPlay(frame)` argument dispatch: number → 1-based frame index; string → frame
label; missing/`undefined` → frame 1. Out-of-range numbers clamp to `[1, _totalframes]`.
A label that does not exist MUST be a no-op with a one-time runtime warning (`AVM1-D11`).

**AVM1-R056** `_currentframe` MUST update *immediately* after a `gotoAndStop` within the same action
block (`[oracle-pinned]` `T-AVM1-014`), even though rendering happens later.

### 8.5 Dynamic instance creation

`attachMovie duplicateMovieClip createEmptyMovieClip createTextField removeMovieClip swapDepths
getDepth getInstanceAtDepth getNextHighestDepth attachBitmap`

**AVM1-R057** Depth semantics: valid range −16384…1048575 (APP-§3). `getNextHighestDepth()` MUST
return the smallest non-negative depth greater than every occupied depth in the clip:
`max(occupied ∩ [0, ∞)) + 1`, or **`0` when nothing occupies a non-negative depth** (an empty clip
returns `0`; it does not start at `1`). Occupied depths include authoring-time content, dynamic
clips, text fields, and buttons; depths reserved by component frameworks are *not* ignored (the
framework reserves them because the value matters). Occupancy MUST be tracked even for clips whose depths were set by the
timeline, and MUST include `TextField`/`Button` instances. `[oracle-pinned]` `T-AVM1-015`.

**AVM1-R058** `attachMovie(id, name, depth, initObject)`: replaces any existing occupant of `depth`
(removing it and firing `onUnload`), constructs the class registered via `registerClass` or the
symbol's exported class, applies `initObject` as properties *after* construction and *after*
frame-1 actions of the attached clip have been scheduled but before the next frame advance
([oracle-pinned]; see `T-AVM1-016`).

**AVM1-R059** `duplicateMovieClip` copies *current* property values (position, alpha, scale, rotation,
colour transform) and starts the copy at frame 1 of the source's timeline, per the AS2 reference.
It MUST NOT deep-copy children.

**AVM1-R060** `swapDepths(a, b)` accepts depths or clips; swapping with a non-existent depth is a
move. `_name` uniqueness: two clips may share a `_name` at different depths; name lookup uses the
*lowest depth* match first. `[oracle-pinned]` `T-AVM1-017`.

### 8.6 Colour and transforms

**AVM1-R061** `Color.setRGB` sets the colour transform's multiply terms to 0/1 equivalents (add =
RGB, mult = 0) per Flash's actual implementation, and `getRGB()` returns the *current effective*
add terms (not the original colour). `setTransform`/`getTransform` use the AS2 percentage form
(−100…100 for mult, −255…255 for add) with the documented conversion
(`mult8_8 = percent * 2.56`). `[oracle-pinned]` `T-AVM1-018`.

**AVM1-R062** `MovieClip.transform` (AS2) exposes `matrix` and `colorTransform` objects with
`flash.geom` semantics; `concatenatedMatrix`, `concatenatedColorTransform`, and `pixelBounds` MUST be
derived from the live display list (GFX-§11.5), not cached across frames.

### 8.7 Drawing API

`beginFill beginGradientFill beginBitmapFill moveTo lineTo curveTo endFill lineStyle
lineGradientStyle clear`

**AVM1-R063** Drawing API geometry is *quadratic* (`curveTo(cx, cy, x, y)`), accumulated into a
per-clip vector program in *clip-local* coordinates, and rendered through the same Vector IR path as
authored shapes (GFX-§5.4). Drawing MUST invalidate the clip's cached geometry and bounds.

**AVM1-R064** `clear()` removes drawing-API geometry only; it MUST NOT remove child clips or
timeline content.

**AVM1-R065** Drawing state (`lineStyle`, fill) MUST be per-clip and survive frames until changed;
`endFill` with no open path is a no-op; a new `beginFill` implicitly ends the previous fill
(`[oracle-pinned]` `T-AVM1-019`).

### 8.8 Hit testing and coordinate conversion

**AVM1-R066** `hitTest` MUST support all four call shapes: `(x, y)`, `(x, y, shapeFlag)`,
`(target)`, `(target, x, y, shapeFlag)`. Default `shapeFlag = false` means bounding-box testing;
`true` means pixel-accurate shape testing against the clip's rendered content (GFX-§12 provides the
coverage query). The result MUST match the oracle at the bounding-box level exactly (F2) and at shape
level within the raster tolerance (F3).

**AVM1-R067** `localToGlobal`, `globalToLocal`, `getBounds(target)`, `getRect(target)` MUST use the
same matrix pipeline as rendering (one implementation, no parallel math), and MUST be correct for
nested transforms with negative scale (flipped) content.

### 8.9 Text fields

**AVM1-R068** `createTextField(name, depth, x, y, width, height)` MUST create a real `TextField`
participating in the display list and in `getNextHighestDepth`. Text fields expose `text`,
`htmlText`, `html`, `variable`, `autoSize`, `wordWrap`, `multiline`, `restrict`, `maxChars`,
`password`, `border`, `background`, `backgroundColor`, `borderColor`, `selectable`, `embedFonts`,
`styleSheet`, `type`, `textHeight`, `textWidth`, `length`, `maxscroll`, `scroll`, `hscroll`,
`condenseWhite`, `mouseWheelEnabled`, `onChanged`, `onSetFocus`, `onKillFocus`, `onScroller`.

**AVM1-R069** `variable` binding MUST be implemented: assigning `tf.variable = "score"` makes the
field display the current value of the named variable in the field's scope and write back on user
edit (input fields). This requires the runtime to observe writes into the scope; the implementation
MUST use the scope's `set` hook rather than polling all scopes each frame (`AVM1-D08`).

**AVM1-R070** `htmlText` MUST support the AS2 HTML subset: `<b> <i> <u> <br> <p> <font face size
color> <a href> <span class> <li> <textformat …> <img …>` (the last two with the documented
limitations), computed via `TextField.StyleSheet` for CSS classes. Unsupported tags MUST render
literally, not disappear (`[oracle-pinned]` `T-AVM1-020`).

### 8.10 Sounds, loading, data, system

Specified in AUD-§6, RT-§6, RT-§7. The AVM1 binding obligations are: exact method signatures,
`onLoad`/`onComplete`/`onSoundComplete` firing at the documented moments, and correct
`position`/`duration` units (milliseconds, integers).

## 9. Tiering, residual code, and the interpreter

**AVM1-R071** Tier assignment MUST be conservative and MUST be reported (`reports/divergence.json`,
`tier` field per function).

**AVM1-R072** The interpreter MUST execute AVM1 semantics by delegating to the *same* runtime
primitives the emitted code uses (`getMember`, `setMember`, coercion helpers, property model), so
there is exactly one implementation of semantics and no "second VM" divergence. The interpreter owns
only the instruction loop, operand stack, and register file.

**AVM1-R073** The interpreter MUST be bounded: an action budget per frame (default 2 000 000
instructions) after which execution is suspended to the next frame with a `risk` diagnostic. This
prevents an infinite loop in residual code from freezing the browser tab.

**AVM1-R074** Interpreter state (stack, registers, block position) MUST be serialisable so that
suspension and resume is exact (RT-§5.5 covers save/restore of a suspended interpreter).

## 10. Events

### 10.1 Clip events

`onLoad onInitialize onUnload onEnterFrame onMouseDown onMouseUp onMouseMove onMouseEnter
onMouseLeave onMouseWheel onPress onRelease onReleaseOutside onRollOver onRollOut onDragOver onDragOut
onKeyDown onKeyUp onData onConstruct onSetFocus onKillFocus onResize(Stage)`

`onInitialize` (SWF 6+) and `onConstruct` (SWF 7+) are the two clip events that only exist in the
4-byte `CLIPEVENTFLAGS` form; their bit assignments — like every other clip event's — are pinned in
APP-§10.1, and a handler for either MUST be wired to the same dispatch path as the rest (an
`onConstruct`-only sprite was one of the compatibility gaps this list exists to close).

**AVM1-R075** `onEnterFrame` MUST fire once per timeline advance, for clips whose timeline is
playing, *before* the clip's own frame actions (AVM1-R008). Ordering across sibling clips follows
AVM1-R009.

**AVM1-R076** Mouse event delivery MUST follow the display-list hit order (front to back, deepest
first), fire `onRollOver`/`onRollOut` transitions when the hovered clip changes, and MUST NOT fire
`onMouseMove` handlers more than once per input sample. `updateAfterEvent()` MUST force an immediate
render + input resample, and MUST be a no-op when called outside an input handler
(`[oracle-pinned]` `T-AVM1-021`).

**AVM1-R077** `Mouse.addListener`/`removeListener` and `Key.addListener` MUST dispatch to all
listeners in registration order, snapshotting the list per dispatch.

**AVM1-R078** `onPress`/`onRelease` for *buttons* are compiled from `DefineButton2` conditions
(hit-test state machine: `OverUpToIdle`, `IdleToOverUp`, etc.). The compiler MUST emit the exact
state machine from the button record conditions, not a simplified "on click" approximation
(button animations and "press-and-hold" behaviours depend on it).

### 10.2 Button conditions

| Condition fields | Meaning |
| --- | --- |
| `IdleToOverUp` | press |
| `OverUpToIdle` | release while hovering (button "click") |
| `OverUpToOverDown` | release outside (cancel) |
| `OverDownToOverUp` | drag-over release |
| `OverDownToIdle` | drag-out of a pressed button |
| `IdleToOverDown` / `OutDownToIdle` / `OutDownToOverDown` / `OverDownToOutDown` | drag/track variants |
| `keyPress` | key press with a key code |

**AVM1-R079** The compiler MUST lower each condition into an emitted handler invoked from the
runtime's button state machine (RT-§5.6), and MUST NOT re-encode conditions as ad-hoc booleans.

### 10.3 Timers

`setInterval`, `clearInterval`, `setTimeout`, `clearTimeout`, `updateAfterEvent`, `getTimer`.

**AVM1-R080** Timers MUST be driven by the frame clock with millisecond accuracy bounded by the
frame period (Flash timers are serviced between frames). Timer callbacks MUST run in a defined slot
in the frame loop (AVM1-R008 step 4) and MUST NOT interleave with a running action block.

**AVM1-R081** Timers MUST NOT accumulate drift: schedule from an absolute origin (`start + n *
period`), not by repeated addition of the period.

### 10.4 Asynchronous completions

**AVM1-R082** Every asynchronous host operation (asset load, sound load, `MovieClipLoader`,
`LoadVars.sendAndLoad`, `XML.load`) MUST complete by queueing an event on the *current runtime
thread's* event queue, dispatched at step 4 of the frame loop. Completion MUST NOT be delivered from
a microtask in the middle of an action block, because game code is not reentrancy-safe
(a very common way naive ports break).

## 11. Known-skew list

The compiler classifies patterns it cannot faithfully reproduce; each has a diagnostic and a
recommended action:

| Pattern | Diagnostic | Default action |
| --- | --- | --- |
| Computed `eval`-like code construction | `SF0430` | Residual interpreter |
| `call()` / `Function.prototype.call` with computed target | `SF0431` | Residual or T1 |
| `with` over a computed object | `SF0432` | T1 |
| `for…in` over an object mutated during iteration | `SF0433` | Warning; snapshot semantics applied |
| `sort(comparator)` with a non-total comparator | `SF0434` | Warning; stable sort used |
| `new Function`-style construction | `SF0435` | Error unless residual allowed |
| Direct `_root.x` writes across `lockroot` boundaries | `SF0436` | Warning |
| `XMLSocket` / `LocalConnection` / `SharedObject` | `SF0437` | Shim + warning (RT-§6.3) |
| Cross-domain `getURL`/`loadMovie` | `SF0438` | Policy-gated (CMP-§10) |
| `MovieClip.prototype` monkey-patching of host methods | `SF0439` | Supported; no warning |

## 12. Performance requirements

| Requirement | Target |
| --- | --- |
| AVM1-R083 | A T0 frame script of 10 000 AVM1 actions MUST execute in ≤ 1.0 ms on the baseline device |
| AVM1-R084 | Member access on a hot loop MUST NOT allocate (no per-access object/tuple creation) |
| AVM1-R085 | Enumeration MUST be allocation-bounded: ≤ 2 arrays per `for…in` start, none per iteration |
| AVM1-R086 | The interpreter (T2) MUST sustain ≥ 2 000 000 simple instructions/second on the baseline device |
| AVM1-R087 | Event dispatch for 200 clips MUST cost ≤ 0.2 ms/frame |

These are measured by TST-§7's `avm1` scene.

## 13. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| T-AVM1-001 | Placement → action → render ordering | F2 |
| T-AVM1-002 | `DoInitAction` before frame-1 actions | F2 |
| T-AVM1-003 | Sibling traversal order incl. depth collisions | F2 |
| T-AVM1-004 | Statements after `gotoAndPlay` still execute | F2 |
| T-AVM1-008 | Add/Add2/StringAdd coercion matrix (60+ cases) | F2 |
| T-AVM1-009 | `isNaN` matrix | F2 |
| T-AVM1-012 | Enumeration order incl. prototype chain + shadowing | F2 |
| T-AVM1-015 | `getNextHighestDepth` after mixed timeline/dynamic content | F2 |
| T-AVM1-018 | `Color` round-trips | F2 |
| T-AVM1-021 | `updateAfterEvent` no-op outside handlers | F2 |
| T-AVM1-025 | 15-significant-digit formatting: 200 golden vectors | F2 |
| T-AVM1-026 | Emitted fixture project compiles with zero suppressions | F1 |
| T-AVM1-027 | Interpreter budget suspends a hostile infinite loop | F1 |
| T-AVM1-028 | Frame-script microbenchmark within AVM1-R083 | F3 |
| T-AVM1-031 | `Date` local-time and DST behaviour documented against the oracle (`AVM1-D05`) | F3 |
| T-AVM1-032 | `Math.random` non-deterministic by default; `--seed` reproduces a sequence (`AVM1-D06`) | F2 |
| T-AVM1-033 | `TextField.variable` write-back through scope hooks, no per-frame polling (`AVM1-D08`) | F2 |
| T-AVM1-034 | `_rotation`/skew round-trip: decomposed TRS does not drift (`AVM1-D09`) | F2 |
| T-AVM1-035 | Missing frame label: no-op plus one warning, never a throw (`AVM1-D11`) | F2 |

## 14. Decision register

| ID | Decision | Default | Verification | Notes |
| --- | --- | --- | --- | --- |
| AVM1-D01 | String constant encoding for SWF 4–5 content | Latin-1/code-page per `DefineFontInfo` | T-AVM1-006 | Old games with accents mis-render otherwise |
| AVM1-D02 | `Add` vs `Add2` distinct implementations | Both implemented | T-AVM1-008 | Compiler must not merge them |
| AVM1-D03 | Include the interpreter when any function is residual | Yes | bundle gate | `--vm.residual=forbid` for purists |
| AVM1-D04 | Scene semantics | Collapse scenes into label map; `nextScene`/`prevScene` computed | T-AVM1-030 | Scenes are rare in games |
| AVM1-D05 | `Date` implementation | Full ECMA-like `Date` with Flash's local-time behaviour and `getTime()` in ms | T-AVM1-031 | DST behaviour is locale-dependent; document |
| AVM1-D06 | `Math.random` seeding | Non-deterministic by default; `--seed` available for tests | T-AVM1-032 | Determinism must be opt-in for gameplay reasons |
| AVM1-D07 | Residual bytecode policy for `eval`-like code | Interpreter, warned | CMP-D06 | Named in porting notes |
| AVM1-D08 | `TextField.variable` write-back mechanism | Scope write hooks | T-AVM1-033 | Avoids per-frame polling |
| AVM1-D09 | Rotation/skew round-trip fidelity | Keep decomposed TRS alongside matrix | T-AVM1-034 | `_rotation` must not drift |
| AVM1-D10 | `_alpha` and `_visible` inheritance | Values are per-clip; effective alpha multiplies up the parent chain at render time | T-GFX-040 | Flash-compatible |
| AVM1-D11 | Missing frame label behaviour | No-op + one-time warning | T-AVM1-035 | Flash silently ignores some cases |
| AVM1-D12 | Iteration snapshot semantics for `for…in` | Snapshot keys at start | AVM1-R046 | Deterministic; documented divergence risk |

## 15. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | First draft |
| 1.1 | 2026-10-04 | §10.1 clip-event list extended with `onInitialize` (SWF 6+) and `onConstruct` (SWF 7+); `AVM1-R014` corrected to the Ch.5 constant-pool rule (execution state, not lexical scope) |
| 1.2 | 2026-10-04 | Diagnostic citations re-pointed to the `IMPL-050` registry: `ToPrimitive` recursion guard `SF0420` -> `SF0423`, prototype-chain cycle `SF0421` -> `SF0424` (the codes previously named belong to AVM1 decode conditions in `IMPL-050`); errata `E-016` |
| 1.3 | 2026-10-04 | Test obligations `T-AVM1-031`–`035` — cited by `AVM1-D05`/`D06`/`D08`/`D09`/`D11` but never defined — are now enumerated in §13 |
