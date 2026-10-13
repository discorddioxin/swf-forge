# IMPL-050 — Action Decoding and the AVM1 Front End

**Doc ID:** IMPL-050 · **Status:** ✅ grounded in Ch.5 · **Package:** `@swf-forge/avm1`
**Format spec:** Chapter 5 — Actions (SWF 3/4/5/6/7/9 action models: `ACTIONRECORD` framing, the program
counter, the SWF 3 action set, the SWF 4 stack machine, the SWF 5 script-object/type/math/stack
actions, the SWF 6 additions, SWF 7 `DefineFunction2`/`Extends`/`CastOp`/`ImplementsOp`/`Try`/`Throw`,
`DoABC` + the SWF 9/10 statements)
**Design specs:** AVM1 (whole), CMP-§4.5–4.6 (front end and analysis), CMP-§6.1 (emitted action
functions), CMP-§7 (tiering), APP-§3 (opcode table), APP-§4 (property ids), APP-§10.3 (pinned layouts)
**Pinned byte layouts:** APP-§10.3 (Ch.5 action structures) — this document carries the semantics and
decoder traps; the appendix carries the field order and bit masks.

---

## 1. Deliverables

The compiler half of the virtual machine: everything needed to turn an action byte stream into
`ActionIR` that can be tiered and emitted (or handed to the interpreter). Semantics live in the design
spec; this document is about decoding, structuring, and classifying.

1. `ACTIONRECORD` framing and the **complete** AVM1 opcode table (100 defined opcodes plus `End`),
   including per-opcode operand layouts, minimum SWF version, and the documented stack effect.
2. Operand decoding: `Push` value types 0–9, `ConstantPool`, register indices, `DefineFunction`/
   `DefineFunction2` bodies, `Try`/`With` regions, `GetURL2`/`GotoFrame2` flag words, `WaitForFrame*`,
   property ids 0–21, target-path prefixes.
3. Block formation: the five kinds of action block (frame script, `DoInitAction`, clip-event handler,
   button handler, function body) and, within a block, basic blocks with a CFG.
4. The **action-list scheduling contract**: when the runtime executes each block kind (doc 130 owns the
   loop; this document pins the ordering rules the chapter states).
5. Stack simulation with a typed partial-evaluation model, including the version-dependent result
   types (SWF 4 numbers vs SWF 5 booleans) and the reverse-push calling convention.
6. Tier assignment (T0/T1/T2) with reasons, plus residual byte-range extraction for the interpreter.
7. Requirement extraction (which host-API groups a function touches) for tree-shaking and budgets.
8. `DoABC` detection and reporting (`SF1000`) with the tag offset.

**Non-goals:** executing anything (CMP-R004: the compiler never runs game code), the runtime object
model (doc 130 implements it), and the emitted code shape (doc 120).

## 2. Module layout

```
packages/avm1/src/frontend/
  record.ts          ACTIONRECORD framing (opcode, optional length, payload bounds, End flag)
  opcodes.ts         opcode table: name, code, min SWF version, operand schema, stack effect, verified
  operands.ts        operand readers (push types, pools, registers, branches, strings)
  properties.ts      property ids 0–21 + target-path/sprite-path parsing for operands
  functions.ts       DefineFunction / DefineFunction2 bodies, register files, preloads, REGISTERPARAM
  control-flow.ts    basic blocks, branch retargeting, try/catch regions, with-ranges
  blocks.ts          block kinds + the scheduling contract of §3.4
  stack.ts           stack-depth simulation and partial evaluation
  ir.ts              ActionIR types (final shape below)
  constants.ts       ConstantPool replacement/scoping model
  targets.ts         SetTarget/SetTarget2 block splitting and target-path modelling
  tier.ts            tier assignment rules + reasons
  requirements.ts    host-API requirement extraction
  avm2.ts            DoABC detection and the `SF1000` report
  residual.ts        byte-range extraction + interpreter program encoding
```

**IMPL-050-R001** `@swf-forge/avm1` MUST be split into `frontend/` (build-time only, no DOM, no host
API) and `runtime/` (browser only). Shared value/coercion types live in
`@swf-forge/runtime/contract` (REPO-R007) so the front end never imports the runtime.

**IMPL-050-R002** The opcode table MUST be a single data structure (`opcodes.ts`) that drives decoding,
tiering, and the `inspect --actions` disassembler. A hand-written `switch` per consumer is forbidden;
three copies of the opcode knowledge is how disassemblers and emitters disagree.

## 3. Action records and action blocks

### 3.1 Framing

```
ActionCode = u8()
if ActionCode >= 0x80: Length = u16(); payload = bytes[Length]   // Length excludes code + length
else:                  payload length comes from the opcode table (0 for every AVM1 opcode today)
```

- **IMPL-050-R003** The chapter's rule is exactly this: *"If the action also carries data, the
  ActionCode's high bit will be set, which indicates that the ActionCode is followed by a 16-bit
  length and a data payload."* The high bit therefore decides whether the length field exists, and the
  **table** decides the payload layout — never the reverse. `Length` counts only the payload bytes
  (the chapter's wording, "the number of bytes in the `ACTIONRECORDHEADER`, not counting the
  `ActionCode` and `Length` fields", is a wording bug we must not implement literally).
- **IMPL-050-R004** The declared `Length` MUST be validated against the enclosing block's bounds; an
  overrun terminates the block with `SF0401` (error) and marks the *whole* enclosing function residual
  (a desynchronised stream cannot be trusted from that point on).
- **IMPL-050-R005** Unknown opcodes MUST produce `SF0402` (warning) with the code and a ≤ 32-byte hex
  dump, and mark the enclosing function residual (CMP-R010/R011, design AVM1-R012).
- **IMPL-050-R006** Zero-length records, a record whose length covers to the exact end of the block,
  and a stream with no terminating `End` (0x00) MUST all be accepted with the appropriate diagnostic
  (`SF0420`): some authoring tools omit the terminator, and refusing them helps nobody. A block-level
  scan MUST include the first `End` record and stop immediately after it; any remaining bytes in the
  enclosing byte slice are ignored, not decoded or tiered (`stoppedAt` is the first byte after `End`).
  Length-delimited `With`/`Try` bodies are not block-level scans: they scan to their declared bound
  with `stopAtEnd: false`, and R008 forbids `End` in those bodies.
- **IMPL-050-R007** Sub-0x80 opcodes other than `0x00` (`End`) carry **no** payload. If the table has
  no entry for a sub-0x80 code, it is an unknown opcode (R005), not a length field (the SWF 3-era
  actions 0x04–0x09 and 0x81+ are the only defined ones below/around the boundary; see §4).

### 3.2 The five block kinds

| Block kind | Source | Terminator | Executed |
| --- | --- | --- | --- |
| Frame script | `DoAction` (12) — `ACTIONRECORD[zero or more]` + `UI8 = 0` | `End` | once per frame visit, at the `ShowFrame` boundary (§3.3) |
| Init script | `DoInitAction` (59) — `UI16 SpriteID`, actions, end flag | `End` | once, before the frame's normal actions (§3.4) |
| Clip-event handler | `CLIPACTIONRECORD.Actions` (doc 030 §6) | record size | on the sprite event |
| Button handler | `BUTTONCONDACTION` (doc 100) | record size | on the button state transition |
| Function body | `DefineFunction`/`DefineFunction2` `codeSize` bytes (or `Try`/`With` bodies) | byte count | on call |

**IMPL-050-R008** A block's byte range MUST be closed by the *declared* structure (tag length, record
size, `codeSize`, `Size`, or `TrySize/CatchSize/FinallySize`), not by scanning for a zero byte: `End`
is a legitimate value only where the chapter makes it the terminator, and `Try`/`With` bodies contain
records that are not terminated by `End` at all.

### 3.3 `DoAction` and frame-script scheduling

- **IMPL-050-R009** `DoAction` bodies are performed **when the `ShowFrame` tag is encountered,
  regardless of where in the frame the tag appears** (chapter). The front end MUST therefore record
  each frame script's position in the frame's tag order but hand doc 130 a single "frame scripts" list;
  the runtime runs them at the frame boundary, in tag order, after the display-list ops of that frame.
- **IMPL-050-R010** The SWF 3 model's deferred action list is part of the contract: an action can
  queue further actions, and "actions are processed until the action list is empty". Doc 130 MUST NOT
  interleave rendering between queued actions from one drain.
- **IMPL-050-R011** Starting with SWF 9, a `DoAction`/`DoInitAction` in a movie whose
  `FileAttributes.ActionScript3` is 1 has its contents **ignored** by the player. We refuse such
  movies anyway (`SF1000`, exit 3), so the rule exists in the report text — and it is why the AVM2
  check must run before action decoding (doc 020's open path).

### 3.4 `DoInitAction` (SWF 6)

- **IMPL-050-R012** `DoInitAction` carries a `SpriteID` (UI16) and defines actions that run **once**,
  **before the normal actions of the frame in which the tag appears**, and — per the chapter — before
  the implicit steps Flash Player takes at the start of a `DoAction` (most relevantly, the creation of
  the ActionScript objects that represent sprites). This is the `#initclip` mechanism and the reason
  `Object.registerClass` can work.
- **IMPL-050-R013** A movie may contain **only one `DoInitAction` per sprite**; multiple tags for the
  same sprite are `SF0421` (warning) and all of them are executed in tag order (the invariant is
  reported, not enforced). Multiple tags in one frame for *different* sprites run in tag order.
- **IMPL-050-R014** Revisiting a frame MUST NOT re-run its init scripts. The emitted model carries
  `initOrder` (a movie-level list) and a per-frame flag; the runtime's boot sequence (RT-§4) consumes
  both, and the "before implicit sprite creation" rule is expressed as a phase boundary, not as a
  special case inside frame execution.
- **IMPL-050-R015** An init script whose `SpriteID` is not in the dictionary is `SF0422` (warning) and
  is dropped; it can never become reachable.

## 4. The opcode table (Ch.5, complete)

`S` = stack effect (pop → push) where the chapter states it; `—` means "no stack effect documented".

**Version evidence (C3):** Adobe Systems, *SWF File Format Specification, Version 10* (published November 2008), Chapter 5, lists `WaitForFrame` but not `WaitForFrame2` in its SWF 3 action model (p. 67), then lists `ActionWaitForFrame2` under the SWF 4 actions' Movie control group (pp. 73–74). [Adobe spec, p. 67](https://www.yumpu.com/en/document/view/14353079/swf-file-format-spec-v10/67) · [Adobe spec, p. 73](https://www.yumpu.com/en/document/view/14353079/swf-file-format-spec-v10/73) · [Adobe spec, p. 74](https://www.yumpu.com/en/document/view/14353079/swf-file-format-spec-v10/74). This versioned primary-source listing supports SWF 4 as the minimum for `WaitForFrame2` (`0x8D`); its stack-selector semantics are corroborative, not the basis for assigning the version. The linked page images/text are a hosted copy of Adobe's specification.
**String/DBCS evidence (FE-030):** Adobe Systems, *SWF File Format Specification, Version 19*, Ch. 1
p. 20 says SWF 5 and earlier `STRING` values use ANSI or Shift-JIS, the file does not indicate which,
and Flash Player selects decoding according to locale; SWF 6+ uses UTF-8, and `LanguageCode` is not a
text-encoding selector ([p. 20](https://www.yumpu.com/en/document/view/16539946/swf-file-format-specification-version-19-adobe/20)).
Ch. 5 p. 75 says `ActionStringLength` calculates a string's length but does not state its units
([p. 75](https://www.yumpu.com/en/document/view/16539946/swf-file-format-specification-version-19-adobe/77)); p. 77 says
`ActionMBStringLength` counts characters and a double-byte character counts as one on a DBCS-capable
system ([p. 77](https://www.yumpu.com/en/document/view/16539946/swf-file-format-specification-version-19-adobe/79)).
This grounds a SWF-5 Shift-JIS fixture and the MBStringLength fold, but not a claimed byte result for
StringLength; FE-030 remains open for that exact runtime behavior.

Every defined row is checked against `opcodes.ts` by `T-AVM1-FE-001`; the per-row `verified` audit
flag stays for future docs, and the disassembler prints any unverified row with a `?`. `var` in the
implementation's compact stack metadata marks an operand-dependent effect; exact formulas are shown here.

### 4.1 SWF 3 (`DoAction`/`DoInitAction`-era control actions)

| Code | Name | Payload | S | Notes |
| --- | --- | --- | --- | --- |
| 0x00 | `End` | — | — | Terminates an action block; the SWF 3 example ends with `SetTarget ""` then `End` |
| 0x04 | `NextFrame` | — | — | |
| 0x05 | `PreviousFrame` | — | — | |
| 0x06 | `Play` | — | — | |
| 0x07 | `Stop` | — | — | |
| 0x08 | `ToggleQuality` | — | — | Renderer quality (GFX-R007) |
| 0x09 | `StopSounds` | — | — | Master-gain path (AUD-R074) |
| 0x81 | `GotoFrame` | `Frame UI16` (length always 2) | — | Absolute frame index; `[verify]` 0- vs 1-basedness (§11) |
| 0x83 | `GetURL` | `UrlString STRING`, `TargetString STRING` | — | `_level0`/`_level1` targets load SWFs into levels |
| 0x8A | `WaitForFrame` | `Frame UI16`, `SkipCount UI8` (length always 3) | — | **Field order is frame-then-skip**; skip frozen actions, not bytes |
| 0x8B | `SetTarget` | `TargetName STRING` | — | Block-splitting; `""` restores the current file |
| 0x8C | `GotoLabel` | `Label STRING` | — | Uses `FrameLabel` names (doc 040) |

### 4.2 SWF 4 (stack machine)

| Code | Name | Payload | S | Notes |
| --- | --- | --- | --- | --- |
| 0x0A | `Add` | — | 2→1 | Floats; non-numeric → 0; result `B+A` |
| 0x0B | `Subtract` | — | 2→1 | `B−A` |
| 0x0C | `Multiply` | — | 2→1 | `A×B` |
| 0x0D | `Divide` | — | 2→1 | `B/A`; `A==0` → `#ERROR#` string in SWF 4, NaN/±Infinity in SWF 5+ |
| 0x0E | `Equals` | — | 2→1 | Numeric; SWF 4 pushes 1/0, SWF 5+ `true`/`false` |
| 0x0F | `Less` | — | 2→1 | `B < A` |
| 0x10 | `And` | — | 2→1 | Non-zero test |
| 0x11 | `Or` | — | 2→1 | Non-zero test |
| 0x12 | `Not` | — | 1→1 | SWF 4 numeric, SWF 5+ Boolean |
| 0x13 | `StringEquals` | — | 2→1 | Case-sensitive; SWF 4 pushes 1/0 |
| 0x14 | `StringLength` | — | 1→1 | Ch. 5 says “length” without specifying byte vs. character units; non-ASCII is not folded (R048) |
| 0x15 | `StringExtract` | — | 3→1 | Pops count, index, string; non-integer index/count → `""` |
| 0x17 | `Pop` | — | 1→0 | |
| 0x18 | `ToInteger` | — | 1→1 | Truncates the fraction (toward zero) |
| 0x1C | `GetVariable` | — | 1→1 | Scope-chain lookup; `"/A/B:FOO"` prefix supported |
| 0x1D | `SetVariable` | — | 2→0 | Same prefix rule |
| 0x20 | `SetTarget2` | — | 1→0 | Stack-based `SetTarget`; block-splitting |
| 0x21 | `StringAdd` | — | 2→1 | Forced concat, result `BA` |
| 0x22 | `GetProperty` | — | 2→1 | Property ids 0–21 (APP-§4) |
| 0x23 | `SetProperty` | — | 3→0 | Pops value, index, target |
| 0x24 | `CloneSprite` | — | 3→0 | Pops depth, target, source |
| 0x25 | `RemoveSprite` | — | 1→0 | Removes a clone |
| 0x26 | `Trace` | — | 1→0 | No player-visible effect; routes to the shell's trace sink |
| 0x27 | `StartDrag` | — | 3→0 (7→0 constrained) | Pops target, lockcenter, constrain, then `y2,x2,y1,x1` when constrained |
| 0x28 | `EndDrag` | — | 0→0 | |
| 0x29 | `StringLess` | — | 2→1 | Byte-by-byte, `B < A` |
| 0x30 | `RandomNumber` | — | 1→1 | Integer in `0…max−1`; runtime RNG (AVM1-D06) |
| 0x31 | `MBStringLength` | — | 1→1 | Characters, not bytes |
| 0x32 | `CharToAscii` | — | 1→1 | First character of the value → code |
| 0x33 | `AsciiToChar` | — | 1→1 | |
| 0x34 | `GetTime` | — | 0→1 | Milliseconds since player start (monotonic in our runtime) |
| 0x35 | `MBStringExtract` | — | 3→1 | Character indexes; non-integer → `""` |
| 0x36 | `MBCharToAscii` | — | 1→1 | Double-byte → 16-bit code, first byte high |
| 0x37 | `MBAsciiToChar` | — | 1→1 | ≥ 256 → double-byte, first byte high |
| 0x3A | `Delete` | — | 2→0 | Pops name, then object |
| 0x3B | `Delete2` | — | 1→0 | Scope-chain search |
| 0x3C | `DefineLocal` | — | 2→0 | Pops value, then name |
| 0x3D | `CallFunction` | — | n+2→1 | Pops name, `numArgs`, then args (reverse-push convention, §6) |
| 0x3E | `Return` | — | 1→0 | Discarded when not in a function |
| 0x3F | `Modulo` | — | 2→1 | Pops `x` then `y`; `y == 0` → NaN (`0x7FC00000`) |
| 0x40 | `NewObject` | — | n+2→1 | Pops name, `numArgs`, args; pushes the new object |
| 0x41 | `DefineLocal2` | — | 1→0 | Declares without a value (`undefined`) |
| 0x42 | `InitArray` | — | n+1→1 | Pops count then elements |
| 0x43 | `InitObject` | — | 2n+1→1 | Pops count then (value, name) pairs |
| 0x44 | `TypeOf` | — | 1→1 | Returns `number`/`boolean`/`string`/`object`/`movieclip`/`null`/`undefined`/`function` |
| 0x45 | `TargetPath` | — | 1→1 | Dot notation; `undefined` for non-MovieClip |
| 0x46 | `Enumerate` | — | 1→k+1 | Pushes `null` then each slot name; **order undefined** (§6.4) |
| 0x47 | `Add2` | — | 2→1 | ECMA-262 §11.6.1; concat is `arg2` then `arg1` |
| 0x48 | `Less2` | — | 2→1 | ECMA-262 §11.8.5; compares `arg2 < arg1` |
| 0x49 | `Equals2` | — | 2→1 | ECMA-262 §11.9.3 (`==`) |
| 0x4A | `ToNumber` | — | 1→1 | Object → `valueOf()` |
| 0x4B | `ToString` | — | 1→1 | Object → `toString()` (AVM1-§5.3 formatting) |
| 0x4C | `PushDuplicate` | — | 1→2 | |
| 0x4D | `StackSwap` | — | 2→2 | Exchanges the top two values (the 2013 post-ship fix; §11) |
| 0x4E | `GetMember` | — | 2→1 | Auto-wraps primitives in `String`/`Number`/`Boolean` wrapper objects |
| 0x4F | `SetMember` | — | 3→0 | Pops value, name, object |
| 0x50 | `Increment` | — | 1→1 | |
| 0x51 | `Decrement` | — | 1→1 | |
| 0x52 | `CallMethod` | — | n+3→1 | Pops name, object, `numArgs`, args; blank name ⇒ invoke the object |
| 0x53 | `NewMethod` | — | n+3→1 | Constructor form of `CallMethod`; pushes the new object |
| 0x54 | `InstanceOf` | — | 2→1 | Pops `constr`, then `obj`; interfaces from SWF 7 |
| 0x55 | `Enumerate2` | — | 1→k+1 | As `Enumerate` with an object operand |
| 0x60 | `BitAnd` | — | 2→1 | Operands → UI32, result S32 |
| 0x61 | `BitOr` | — | 2→1 | As above |
| 0x62 | `BitXor` | — | 2→1 | As above |
| 0x63 | `BitLShift` | — | 2→1 | Pops count then value; count = low 5 bits |
| 0x64 | `BitRShift` | — | 2→1 | S32 result |
| 0x65 | `BitURShift` | — | 2→1 | UI32 result |
| 0x87 | `StoreRegister` | `RegisterNumber UI8` | 1→1 | **Reads without popping** |
| 0x88 | `ConstantPool` | `Count UI16`, `STRING[Count]` | — | **Replaces** any existing pool |
| 0x8D | `WaitForFrame2` | `SkipCount UI8` (length always 1) | 1→0 | Frame from the stack; skip frozen actions, not bytes |
| 0x94 | `With` | `Size UI16` + body | 1→0 | Depth cap 8 (SWF 5) / 16 (SWF 6+); over cap ⇒ skip body |
| 0x96 | `Push` | 1..n (Type,value) pairs | 0→k | Types 0–9; `Length` is the total type+value bytes |
| 0x99 | `Jump` | `SI16` | — | Offset relative to the next record; 0 = next |
| 0x9A | `GetURL2` | flags (length always 1) | 2→0 | Pops target, then URL; flags §5.6 |
| 0x9B | `DefineFunction` | name, params, `codeSize`, body | 0→1 | Rare after SWF 7 |
| 0x9D | `If` | `SI16` | 1→0 | SWF 4 compares to 0, SWF 5+ converts to Boolean |
| 0x9E | `Call` | — | 1→0 | **Frame call**, not a subroutine call (§6.5) |
| 0x9F | `GotoFrame2` | flags (length always 1) | 1→0 | Pops frame/label; scene bias + play flag |

### 4.3 SWF 6 additions

| Code | Name | S | Notes |
| --- | --- | --- | --- |
| 0x66 | `StrictEquals` | 2→1 | `===`; types must match |
| 0x67 | `Greater` | 2→1 | Exact opposite of `Less2`; compares `arg2 > arg1` |
| 0x68 | `StringGreater` | 2→1 | Byte-by-byte `arg2 > arg1` |

### 4.4 SWF 7 additions

| Code | Name | Payload | S | Notes |
| --- | --- | --- | --- | --- |
| 0x2A | `Throw` | — | 1→0 | Unwinds to the nearest `Try`; every intervening `finally` runs |
| 0x2B | `CastOp` | — | 2→1 | Pops object then constructor; pushes the object or `null` |
| 0x2C | `ImplementsOp` | — | 2+k→0 | Pops constructor, count, then the interfaces; **no result** |
| 0x69 | `Extends` | — | 2→0 | Pops superclass, then subclass; **no result** |
| 0x8E | `DefineFunction2` | see §5.3 | 0→1 | Registers + preload/suppress flags |
| 0x8F | `Try` | see §5.5 | 0→0 | try/catch/finally regions, no end tags |
| 0x89 | `StrictMode` | — | — | **[observed, not in Ch.5]** AS2 strict-mode toggle; decode, report, keep semantics inert |
| 0x2D | `FsCommand2` | — | — | **[observed, not in Ch.5]** runtime maps it (RT-§7); decoder keeps the operand bytes |

### 4.5 Undefined ranges

**IMPL-050-R016** The reserved opcode ranges are exactly `0x01–0x03`, `0x16`, `0x19–0x1B`,
`0x1E–0x1F`, `0x2E–0x2F`, `0x38–0x39`, `0x56–0x5F`, `0x6A–0x80`, `0x82`, `0x84–0x86`,
`0x90–0x93`, `0x95`, `0x97–0x98`, `0x9C`, and `0xA0–0xFF`. These are the complete complement of
§4's defined rows, MUST be reported (`SF0402`), and make the enclosing function residual. The only
observed-but-undocumented exceptions are `0x89` and `0x2D`; they are defined rows above because real
authoring tools emit them, and their semantics remain inert. `T-AVM1-FE-001` pins this partition
against both this list and the 256-code opcode space.

## 5. Operands and structures

**IMPL-050-R017** Every operand reader MUST be table-driven from `opcodes.ts` schemas, so the
disassembler, the CFG builder, and the residual extractor cannot disagree about where a record ends.

### 5.1 `ActionPush` (0x96)

| Type | Value | Width | Version |
| --- | --- | --- | --- |
| 0 | string literal | NUL-terminated `STRING` | SWF 4 |
| 1 | float32 (little-endian) | 4 | SWF 4 |
| 2 | `null` | 0 | SWF 5 |
| 3 | `undefined` | 0 | SWF 5 |
| 4 | register | `UI8` | SWF 5 |
| 5 | Boolean | `UI8` | SWF 5 |
| 6 | float64 (little-endian) | 8 | SWF 5 |
| 7 | integer | `UI32` little-endian | SWF 5 |
| 8 | constant-pool index < 256 | `UI8` | SWF 5 |
| 9 | constant-pool index ≥ 256 | `UI16` | SWF 5 |

- **IMPL-050-R018** One `ActionPush` record may carry **multiple** (Type, value) pairs; the `Length`
  field is the total number of type+value bytes that follow. Decoding stops on byte exhaustion, and a
  pair that would overrun the record is `SF0403` (error, residual).
- **IMPL-050-R019** Type 1 MUST be widened to a JS double exactly (no `Math.fround` round-trip), and
  type 6 read as a little-endian IEEE double. Type 7 is stored as `UI32` in the file and interpreted
  as the two's-complement 32-bit integer; the *bit pattern* is preserved for bitwise actions.
- **IMPL-050-R020** Type 4 (`register`) MUST be validated against the enclosing function's register
  file when one is statically known (`SF0416`, warning when out of range → residual); in the top
  level (no register file) register numbers ≥ 4 are `SF0415` (warning, treated as `undefined`), since
  "Flash Player supports up to 4 registers" outside `DefineFunction2`.
- **IMPL-050-R021** Types 8/9 indexes resolve against the *current* constant pool (§5.2); an index
  outside the pool is `SF0411` (error) and the value becomes `undefined` (residual).

### 5.2 `ActionConstantPool` (0x88)

- **IMPL-050-R022** The pool is **execution state, not lexical scope**: the action "creates a new
  constant pool, and replaces the old constant pool if one already exists". A `DefineFunction*` body
  is not a new realm — its `constant8/16` indices resolve against whatever pool is current when the
  body *runs*. Where the pool in effect at a call site is not statically provable, the referenced
  constants MUST be modelled as dynamic (`SF0410`, warning; tier ≥ T1) rather than guessed.
- **IMPL-050-R023** **Correction to the design spec:** `AVM1-R014`'s "a `DefineFunction` body does not
  inherit the pool of its parent" is **not** what the chapter says (and not what the player does); v1.2
  of the design spec replaces it with the rule above. The tiering consequence is real: a pool used only
  from inside a function is a dynamic dependency.

### 5.3 Registers and `DefineFunction2` (0x8E)

Flags are two bytes read as a little-endian `UI16`; because Ch.1 packs bit fields MSB-first, the masks
are:

| Field | Mask | Meaning |
| --- | --- | --- |
| `PreloadParentFlag` | `0x0080` | preload `_parent` into a register |
| `PreloadRootFlag` | `0x0040` | preload `_root` |
| `SuppressSuperFlag` | `0x0020` | do not create `super` |
| `PreloadSuperFlag` | `0x0010` | preload `super` |
| `SuppressArgumentsFlag` | `0x0008` | do not create `arguments` |
| `PreloadArgumentsFlag` | `0x0004` | preload `arguments` |
| `SuppressThisFlag` | `0x0002` | do not create `this` |
| `PreloadThisFlag` | `0x0001` | preload `this` |
| `Reserved` | `0x7E00` | must be 0 |
| `PreloadGlobalFlag` | `0x0100` | preload `_global` |

- **IMPL-050-R024** The mask table is the only sanctioned reading; the naive "first flag = bit 15"
  reading inverts the eight leading flags (APP-§10.3's trap note). Reserved bits are preserved in the
  report (`SF0413`, info) and never masked away from the model.
- **IMPL-050-R025** `RegisterCount` (UI8) sizes the register file; the chapter's prose says
  `DefineFunction2` makes "up to 256 registers" available and `StoreRegister` "stores it in one of
  four registers" outside it — read together, the register file is indices `0…RegisterCount−1` and
  only the *preload/parameter* semantics are version-dependent (the "four" refers to the fixed
  SWF 4-era convention, not a clamp; see E-012). `REGISTERPARAM` (`Register UI8`, `ParamName STRING`) per parameter decides whether the
  parameter lands in a register or in the activation object: **register 0 means "create the named
  variable"**, non-zero means "copy into that register and create no variable" (so it is reachable
  only through `Push`/`StoreRegister`).
- **IMPL-050-R026** Register allocation MUST follow the chapter's order: parameters first (each into
  its `REGISTERPARAM` register), then the preloaded variables **starting at register 1 in the order
  `this`, `arguments`, `super`, `_root`, `_parent`, `_global`**, skipping the ones not preloaded;
  remaining registers are locals. The chapter's worked example is the contract: `RegisterCount = 6`,
  `NumParams = 2`, both parameters in registers (`this` → 1, `_root` → 2, params → 3 and 4, locals 5
  and 6). A parameter register inside the preload range is overwritten by the
  preload — the chapter calls this out as a file-authoring requirement, so we report it
  (`SF0416`, warning, per collision) and implement the overwrite, because that is what the player does.
- **IMPL-050-R027** A flag pair that both preloads and suppresses the same variable is invalid
  (`SF0414`, warning): suppression wins (no variable is created) and the preload still fills its
  register, which is the only reading that keeps register numbering intact.
- **IMPL-050-R028** `ActionGetVariable`/`ActionSetVariable` cannot address register-based parameters
  (chapter). The front end MUST NOT synthesise named locals for them; the emitter keeps them as
  registers (doc 120) and the interpreter's register file is the single source of truth (doc 130).

### 5.4 Branches and the program counter

- **IMPL-050-R029** The PC is "the address of the action that follows the action currently being
  executed". `Jump`/`If` add their signed `SI16` to that PC, so an offset of **0 targets the record
  immediately after the branch record**; offsets are `−32768…32767` bytes.
- **IMPL-050-R030** SWF 4's `If` does not convert the condition to Boolean: it compares to 0. We
  implement the file's declared version's rule (§6.6) and the difference is covered by `T-AVM1-FE-022`.
- **IMPL-050-R031** Branch targets MUST land on record boundaries and inside the block
  (`SF0405`, error → residual; design AVM1-R017). Out-of-bounds jumps in obfuscated files are a known
  real-world case and MUST become residual, never a crash.

### 5.5 `With` (0x94) and `Try` (0x8F)

- **IMPL-050-R032** `With`'s `Size UI16` delimits the body; the object comes off the stack. The
  dynamic-scope depth cap is **8 in SWF 5 and 16 in SWF 6+**; when exceeded, the player *skips the
  next `Size` bytes* rather than executing them — the IR must express this as a guarded region
  (`withDepth`, and a `skipBody` flag), not as a jump, so the interpreter behaves identically
  (`SF0412`, warning, when a file exceeds the cap).
- **IMPL-050-R033** `Try`'s fields are `Reserved UB[5]`, `CatchInRegisterFlag`, `FinallyBlockFlag`,
  `CatchBlockFlag`, then `TrySize`, `CatchSize`, `FinallySize` (**all three UI16 always present,
  even when the corresponding flag is 0**), then either `CatchName STRING` (flag = 0) or
  `CatchRegister UI8` (flag = 1), then the three bodies. There is **no** "finally register"; the
  catch target is a name or a register, never both.
- **IMPL-050-R034** The three bodies tile the record: `TrySize + CatchSize + FinallySize` plus the
  header must equal the record's payload length. Gaps or overlaps are `SF0404` (error) and make the
  function residual. Bodies have no `End` terminator (they are length-delimited).
- **IMPL-050-R035** Structured regions: `try`/`catch`/`finally` become explicit nested regions in the
  IR after CFG construction (design AVM1-R011), with `Throw` unwinding to the nearest enclosing catch
  and running every intervening `finally`. Emitters must be able to reconstruct the structure from the
  IR alone.

### 5.6 Target, property, and timeline operands

- **IMPL-050-R036** `SetTarget`/`SetTarget2` set the *current context* for subsequent actions; the
  empty target restores the current file. Both end a basic block and start a new *target region*
  (design AVM1-R034) whose target is a parameter of the region — never ambient parser state.
- **IMPL-050-R037** Variable names and frame operands may carry a target prefix in both syntaxes:
  `"/A/B:FOO"` (slash) or the dot form for `SetTarget2`/`GotoFrame2`. The prefix parser is
  `properties.ts` and is shared by `GetVariable`/`SetVariable`, `Call`, `GotoFrame2`, and
  `WaitForFrame2`.
- **IMPL-050-R038** `GetProperty`/`SetProperty` use property ids 0–21 (APP-§4): `_quality`, `_xmouse`
  and `_ymouse` are SWF 5+; ids ≥ 22 are undefined (`SF0417`, warning, get → `undefined`, set →
  no-op, one diagnostic per id).
- **IMPL-050-R039** `GotoFrame2`'s flags are `Reserved UB[6]`, `SceneBiasFlag UB[1]`, `Play UB[1]`,
  then `SceneBias UI16` when the flag is set; the bias is **added to the frame resolved from the
  stack** (this is how scene navigation reaches frame numbers). `Play = 1` starts playback, `0` stops.
- **IMPL-050-R040** `GetURL2`'s flags are `SendVarsMethod UB[2]` (0 none, 1 GET, 2 POST),
  `Reserved UB[4]`, `LoadTargetFlag UB[1]`, `LoadVariablesFlag UB[1]`; the operands pop as **target
  first, URL second**. `LoadVariablesFlag` selects variables-from-server (`x-www-form-urlencoded`
  response) while a set `LoadTargetFlag` without it loads a SWF *into a sprite*; the compiler records
  the quadruple as the network operation's shape (SEC-§4 policy applies; doc 130 owns the fetch).
- **IMPL-050-R041** Frame scripts reach the timeline lazily: `Call` (0x9E) executes the actions of the
  frame named by its operand (label or number, optional target prefix) and then **resumes at the next
  instruction** — it is a frame call, not a subroutine call. `GotoFrame`/`NextFrame`/`PreviousFrame`/
  `Play`/`Stop`/`GotoLabel` and the `GotoFrame2` forms are timeline *state* changes (doc 130's state
  machine), while `Call` is the one that executes another frame's script inline.

## 6. Stack-machine semantics the front end must model

### 6.1 Pop order and operand naming

The chapter always says "pops value A, then value B": **A is the top of the stack**. Binary results are
stated as `B op A` for the SWF 4 arithmetic/comparison set; the front end's `binop` op keeps that
order explicitly (`a` = first pop = top).

### 6.2 Version-dependent result types

| Action class | SWF 4 | SWF 5+ |
| --- | --- | --- |
| `Equals`/`Less`/`And`/`Or`/`StringEquals`/`StringLess` | `1`/`0` | `true`/`false` |
| `Not` | numeric | Boolean |
| `Divide` by zero | `"#ERROR#"` string | `NaN`/`±Infinity` |
| `If`'s condition | compared to 0 | converted to Boolean |

**IMPL-050-R042** The tier/semantics layer MUST branch on the movie's declared version for these five
rules; a single "AVM1 is like JS" implementation produces visibly different text in SWF 4 titles
(T-AVM1-FE-022).

### 6.3 The reverse-push calling convention

**IMPL-050-R043** For `CallFunction`, `CallMethod`, `NewMethod`, `NewObject`, `InitArray` and
`InitObject`, arguments are pushed **rightmost first** and popped first-to-last. The IR's `call` op
must normalise to source order (leftmost first) *once*, and the residual interpreter must implement the
chapter's order, so both agree.

### 6.4 Determinism where the chapter declares none

**IMPL-050-R044** `Enumerate`/`Enumerate2` push `null` followed by slot names "in an undefined order".
For byte-identical output (REPO-R015) the **compiler** MUST impose a deterministic order (sorted by
code-unit order) whenever it materialises a key list at build time, and the emitted key-list literal
MUST carry a `sortedForDeterminism: true` marker in the report. The interpreter must not rely on
insertion order either: object models expose one canonical ordering (doc 130, AVM1-R045).

### 6.5 Frames, targets, and the `Call` action

**IMPL-050-R045** `Call` executes another frame's script and returns; `GotoFrame2`/`GotoLabel` move the
playhead. The IR keeps them distinct (`timeline.call` vs `timeline.goto`) because one can re-enter and
the other cannot.

### 6.6 Numeric, string, and object semantics pinned by the chapter

- **IMPL-050-R046** `Add`/`Subtract`/`Multiply`/`Divide`/comparisons/`And`/`Or` convert operands to
  floating point with non-numeric values evaluating to 0. `Add2`/`Less2`/`Equals2`/`StrictEquals`/
  `Greater` use the ECMA-262 algorithms the chapter names (§11.6.1, §11.8.5, §11.9.3, and the `===`
  same-type rule).
- **IMPL-050-R047** Bitwise actions convert operands to 32-bit values first (`BitAnd`/`BitOr`/`BitXor`
  to UI32 with an S32 result; shifts take the low 5 bits of the count; `BitURShift` yields a UI32
  number). `~`/`>>>` semantics must not be re-derived in the emitter — the IR carries the action.
- **IMPL-050-R048** `ActionMBStringLength` is multi-byte-aware: it counts characters, with a DBCS
  double-byte character counted as one on a system with double-byte support (Adobe SWF v19 Ch. 5,
  p. 77). `ActionStringLength` is described as calculating string length, but Ch. 5 does not specify
  whether its unit is encoded bytes or characters. Do not infer a movie string's encoding from
  `DefineFontInfo`/`LanguageCode`: SWF 5 and earlier `STRING` values may be ANSI or Shift-JIS, have no
  in-file selector, and Flash Player chooses according to locale; SWF 6+ strings are UTF-8 (Adobe SWF
  v19 Ch. 1, p. 20). The AVM1 analyzer accepts a caller-selected `legacyEncoding` for SWF ≤ 5 and
  defaults to Windows-1252 as a deterministic porting policy. The front end leaves non-ASCII
  `StringLength` dynamic; FE-030 pins the Shift-JIS DBCS `MBStringLength` character fold but does not
  claim the unresolved `StringLength` runtime result. `StringExtract`/`MBStringExtract` likewise stay
  separate operations; non-integer index/count yields `""` in both.
- **IMPL-050-R049** `GetMember` on a primitive creates a temporary wrapper object, so
  `"abc".length` is legal; the IR keeps the wrapper rule explicit (a `getMember` whose object could be
  a primitive MUST NOT be constant-folded to a property lookup on a raw JS primitive without the same
  coercion path).
- **IMPL-050-R050** `TargetPath` returns dot notation for MovieClips and `undefined` otherwise;
  `TypeOf` returns exactly the eight documented strings (including `movieclip`).
- **IMPL-050-R051** `RandomNumber` returns an integer in `0…max−1` and is the one action that must
  *not* be constant-folded or made deterministic: it routes to the runtime RNG (`AVM1-D06`), is
  excluded from goldens via the seeded-RNG harness, and the compiler records its presence as a
  divergence class (`divergence.json` → `nondeterminism`).
- **IMPL-050-R052** `GetTime` is monotonic from player start (not wall-clock), `Trace` has no
  player-visible effect (shell trace sink only), and `ToggleQuality`/`StopSounds` map to renderer and
  audio commands (doc 130/090), never to compiler-time behaviour.

## 7. Block formation, IR, and tiering

```
ActionBlock (one per DoAction / DoInitAction / button handler / clip action record / function body)
  └── BasicBlock[] (single entry, single exit, ends at a branch/return/throw/target-change)
        └── Op[] (partially evaluated; constants folded, unknown values as SSA temporaries)
```

- **IMPL-050-R053** `SetTarget`/`SetTarget2` MUST end a basic block (R036); `Try` regions MUST be
  structured (§5.5); `With` becomes a region with `withDepth` and an optional `skipBody`.
- **IMPL-050-R054** Stack depth MUST be verified at every block boundary and at every join (design
  AVM1-R016). A mismatch is `SF0406` (error) → function becomes residual. Do not "fix" the depth.
- **IMPL-050-R055** Unreachable blocks MUST be retained in the IR and marked `unreachable`; pruning is
  a separate, opt-in pass (`--prune-dead-code`, CMP-§4.6) and MUST be reported.

```ts
export interface ActionIR {
  readonly kind: 'timeline' | 'init' | 'clipEvent' | 'button' | 'function' | 'classMethod';
  readonly id: string;                         // stable emitted symbol base name
  readonly byteRange: { start: number; end: number };
  readonly blocks: readonly BasicBlock[];
  readonly registers: number;                  // DefineFunction2 RegisterCount
  readonly params: readonly ParamSlot[];       // name, register? (0 = activation variable), preloaded?
  readonly preloads: PreloadFlags;             // this/super/root/parent/global/arguments
  readonly suppress: SuppressFlags;            // this/super/arguments not created
  readonly constants: readonly Value[];        // pool as written at the defining point
  readonly poolIsDynamic: boolean;             // constant8/16 resolved at run time (R022)
  readonly tier: 0 | 1 | 2;
  readonly residualReason: string | null;
  readonly requirements: readonly HostApiRequirement[];
  readonly sourceName: string | null;          // recovered name, if any (AVM1-R036)
  readonly frameAssociations: readonly number[];  // which timeline frames reference this block
  readonly initOrder: number | null;           // DoInitAction only: movie-level execution index
}
```

**IMPL-050-R056** `Operand` is either a literal, an SSA temporary, or a "stack slot" marker for values
the partial evaluator could not name. The IR MUST remain serialisable (plain data, no closures) so tier
decisions and requirements can be cached and diffed in goldens.

**IMPL-050-R057** `raw` ops MUST only appear in T2 functions, and their bytes MUST be contiguous per
basic block so the interpreter can execute them without re-deriving structure.

| Tier | Condition | Emitted as |
| --- | --- | --- |
| T0 | Fully static control flow; every operand resolvable; no `with` over dynamic scope; no `call()` with dynamic target | Straight-line TypeScript statements |
| T1 | Static CFG, dynamic values (loops, dynamic member access, dynamic `with`, dynamic constant pool) | TypeScript block state machine |
| T2 | `eval`-like or unresolvable: unknown opcodes, out-of-bounds branches, `call()`/`with` over unprovable targets, stack-verify failure, malformed `Try` | Bytecode blob + `@swf-forge/avm1/interp` |

- **IMPL-050-R058** Tier assignment MUST be conservative and MUST record a machine-readable reason
  (`unknown-opcode:0x8B`, `dynamic-with`, `dynamic-pool`, `branch-out-of-bounds`, `stack-mismatch`,
  `try-malformed`, `call-dynamic-target`). The reason strings are part of the report contract
  (`divergence.json`).
- **IMPL-050-R059** A single T2 verdict in a function MUST NOT force its *callers* to T2, but a T2
  verdict in a *frame script* MUST be listed in the porting notes (frame-script performance is on the
  critical path).
- **IMPL-050-R060** `--vm.residual=forbid` MUST fail the build at the first T2 verdict, listing every
  function and reason (CMP-R026).

## 8. Requirements extraction and name recovery

- **IMPL-050-R061** `requirements` MUST be computed per `ActionIR` as a set of host-API group ids
  (AVM1-§8.1 tiers). The emitter uses it for tree-shaking and `budgets.json`.
- **IMPL-050-R062** Name recovery (AVM1-R036 order) MUST be a separate pass over the IR plus the
  dictionary's export map, producing `sourceName` per function and per recovered class. It MUST be
  deterministic: the same input yields the same names regardless of Map iteration order (REPO-R015) —
  sort by (source range, then id) before assigning suffixes.
- **IMPL-050-R063** Recovered class detection (`Object.registerClass` + prototype chains, including
  the `ActionExtends` form, §5.3/Ch.5) MUST produce a `ClassModel` with methods and constructor and be
  recorded in the report; unrecognised patterns stay as plain objects with an info diagnostic.
- **IMPL-050-R064** Constant folding MUST preserve AVM1-R024's distinct `ActionAdd`, `ActionAdd2`, and
  `StringAdd` branch conditions. `ActionAdd` concatenates only when its left primitive is a string;
  `ActionAdd2` concatenates only when either primitive is a string; `StringAdd` always concatenates.
  Boolean, `null`, and `undefined` literals stringify only after a string operand selects the
  `ActionAdd2` concatenation path. A number-to-string conversion requiring AVM1-R025 formatting MUST
  remain dynamic unless that runtime conversion is independently proven. `T-AVM1-FE-031` covers the
  static literal matrix and the conservative boundary.

## 9. Diagnostics

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0400` | error | action stream truncated mid-record |
| `SF0401` | error | action record overruns its block |
| `SF0402` | warning | unknown opcode (function becomes residual) |
| `SF0403` | error | malformed `Push` pair / unrecognised type byte |
| `SF0404` | error | `Try` bodies do not tile the record (gap/overlap) |
| `SF0405` | error | branch target not on a record boundary |
| `SF0406` | error | stack-depth mismatch at a block join |
| `SF0407` | warning | `SetTarget` inside a loop/conditional produces a target region requiring T1 |
| `SF0408` | info | SWF 3-era action model detected |
| `SF0409` | info | `DefineFunction*` nesting depth near the cap |
| `SF0410` | warning | constant-pool dependency not statically provable → dynamic (tier ≥ T1) |
| `SF0411` | error | `constant8/16` index outside the pool |
| `SF0412` | warning | `With` nesting exceeds the version cap (body skipped by the player) |
| `SF0413` | info | reserved `DefineFunction2` flag bits non-zero (preserved) |
| `SF0414` | warning | `DefineFunction2` preloads *and* suppresses the same variable |
| `SF0415` | warning | register number ≥ 4 outside `DefineFunction2` (treated as `undefined`) |
| `SF0416` | warning | register number out of range, or a parameter register inside the preload range (overwritten) |
| `SF0417` | warning | property id ≥ 22 (get → `undefined`, set → no-op, once per id) |
| `SF0418` | info | `Call` target frame was not found (action does nothing) |
| `SF0419` | info | action newer than the movie's declared version (version-window violation) |
| `SF0420` | warning | missing/non-zero block terminator (`End` flag), tolerated |
| `SF0421` | warning | more than one `DoInitAction` for one sprite |
| `SF0422` | warning | `DoInitAction` for an unknown sprite id (dropped) |
| `SF0423` | warning | `ToPrimitive` recursion guard tripped (depth 32) — `AVM1-R021` |
| `SF0424` | warning | prototype chain cycle broken at assignment — `AVM1-R040` |
| `SF1000` | error | AVM2 content detected (`DoABC` / `FileAttributes.ActionScript3`) — fatal, exit 3 |

## 10. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| `T-AVM1-FE-001` | framing: every opcode's payload length matches the table (table-driven over all defined codes and the undefined ranges) | F1 |
| `T-AVM1-FE-002` | `Push` types 0–9 decode, including multi-pair records and preservation of type 7's bit pattern | F1 |
| `T-AVM1-FE-003` | branch offsets relative to the *next* record (constructed jumps, both signs) | F1 |
| `T-AVM1-FE-004` | `SetTarget` block splitting and **region extent**: a target region ends only at the closing `SetTarget ""`, and regions nest correctly | F1 |
| `T-AVM1-FE-005` | constant-pool semantics: replacement, and a pool used only from inside a function → dynamic (`SF0410`) | F1 |
| `T-AVM1-FE-006` | `Try` field order, all three sizes present, catch name vs register, body tiling | F1 |
| `T-AVM1-FE-007` | stack mismatch → residual with reason; no crash | F1 |
| `T-AVM1-FE-008` | tier assignment table: one fixture per reason | F2 |
| `T-AVM1-FE-009` | out-of-bounds branch (obfuscated case) → residual, reported | F1 |
| `T-AVM1-FE-010` | `DoABC` / `ActionScript3` → `SF1000`, exit code 3, offset named | F1 |
| `T-AVM1-FE-011` | requirement extraction matches a hand-written expectation per fixture | F2 |
| `T-AVM1-FE-012` | name recovery determinism: 100 shuffles of dictionary order yield identical names | F1 |
| `T-AVM1-FE-013` | `DefineFunction2` mask table: each of the nine flags alone sets exactly its mask | F1 |
| `T-AVM1-FE-014` | register allocation: the chapter's NumParams/RegisterCount example (this=1, _root=2, params 3–4, locals 5–6) | F1 |
| `T-AVM1-FE-015` | `REGISTERPARAM` register 0 vs non-zero: activation variable created or not | F1 |
| `T-AVM1-FE-016` | `With` depth caps 8 (SWF 5) and 16 (SWF 6+), and the skip-body behaviour over the cap | F1 |
| `T-AVM1-FE-017` | `WaitForFrame` (frame-then-skip, length 3) and `WaitForFrame2` (length 1) decode | F1 |
| `T-AVM1-FE-018` | `GetURL2` flag quadrants ×2 (method × target/variables) | F1 |
| `T-AVM1-FE-019` | `GotoFrame2` play flag + scene bias resolution | F2 |
| `T-AVM1-FE-020` | reverse-push convention for all six call/init actions | F1 |
| `T-AVM1-FE-021` | property ids 0–21 and the ≥22 policy | F1 |
| `T-AVM1-FE-022` | SWF 4 vs SWF 5 result types for `Equals`/`Less`/`And`/`Or`/`Not`/`Divide`/`If` | F1 |
| `T-AVM1-FE-023` | `Enumerate`/`Enumerate2`: `null` terminator, deterministic compiler order, marker in the report | F1 |
| `T-AVM1-FE-024` | `Call` executes a frame script and resumes; `GotoFrame2` does not | F2 |
| `T-AVM1-FE-025` | `Try`/`Throw`/`finally` unwinding through nested functions | F2 |
| `T-AVM1-FE-026` | `Extends`/`ImplementsOp` stack effects (no result pushed) and `CastOp` null result | F1 |
| `T-AVM1-FE-027` | `DoInitAction` ordering: once, sprite-scoped, before the frame's `DoAction`, before sprite creation | F2 |
| `T-AVM1-FE-028` | `DoAction` executes at the `ShowFrame` boundary regardless of tag position | F2 |
| `T-AVM1-FE-029` | observed-but-undocumented opcodes (0x89, 0x2D) decode with inert semantics + diagnostics | F1 |
| `T-AVM1-FE-030` | SWF-5 raw Shift-JIS DBCS fixture: decode under explicit encoding; pin `MBStringLength`'s character fold and leave `StringLength` dynamic until its byte/character result is oracle-pinned | F1 |
| `T-AVM1-FE-031` | `Add`/`Add2`/`StringAdd` literal-fold matrix; preserve opcode-specific coercion and leave AVM1 number-to-string formatting dynamic | F1 |
| `T-AVM1-FE-032` | Synthetic `bytes→IR→disassembly` conformance: stable, escaped text for operands and structured regions; this is not a byte round-trip | F1 |
| `T-AVM1-FE-033` | Seeded 10⁶ action-stream mutations/truncations; zero uncaught exceptions and safe residual fallback for unknown or malformed records | F1 (dedicated gate) |

**Cross-phase acceptance note.** FE-024/025/027/028 include runtime behavior in their obligation text. P5 evidence may establish front-end IR or schedule metadata only; it does not prove frame-call execution/resumption, exception unwinding, or runtime scheduling. Those observable runtime behaviors are accepted under P7/IMPL-130. The FE IDs and normative language-spec requirements are retained; no obligation is waived or claimed passed by this ownership split.

## 11. Work packages

| WP | Title | Depends | Est | Deliverable |
| --- | --- | --- | --- | --- |
| WP-050-01 | Action record framing + bounds + `End`-flag policy | WP-020-05 | 2 | `frontend/record.ts`, T-AVM1-FE-001 |
| WP-050-02 | Opcode table (data) + operand schemas + stack effects | WP-050-01 | 5 | `frontend/opcodes.ts`, T-AVM1-FE-029 |
| WP-050-03 | Operand readers (push types, pools, registers, branches, strings) | WP-050-02 | 3 | `frontend/operands.ts`, T-AVM1-FE-002/003 |
| WP-050-04 | `DefineFunction`/`DefineFunction2`: registers, preloads, masks | WP-050-03 | 3 | `frontend/functions.ts`, T-AVM1-FE-013/014/015 |
| WP-050-05 | CFG + basic blocks + `SetTarget` splitting | WP-050-04 | 4 | `frontend/control-flow.ts`, `targets.ts`, T-AVM1-FE-004 |
| WP-050-06 | `Try`/`With` region structuring, caps and skip-body | WP-050-05 | 3 | T-AVM1-FE-006/016/025 |
| WP-050-07 | Stack simulation + partial evaluation → IR ops | WP-050-06 | 5 | `frontend/stack.ts`, `ir.ts`, T-AVM1-FE-007/031 |
| WP-050-08 | Tier assignment + reasons + residual extraction | WP-050-07 | 3 | `frontend/tier.ts`, `residual.ts`, T-AVM1-FE-008/009 |
| WP-050-09 | Version semantics matrix (SWF 4 vs 5 result types, `If`) | WP-050-07 | 2 | T-AVM1-FE-022 |
| WP-050-10 | Call/init conventions + determinism pass (`Enumerate`) | WP-050-07 | 2 | T-AVM1-FE-020/023 |
| WP-050-11 | Property ids + target-path operands + timeline actions | WP-050-03 | 2 | `frontend/properties.ts`, T-AVM1-FE-019/021/024 |
| WP-050-12 | Block scheduling contract for doc 130 (`DoAction`/`DoInitAction`) | WP-050-05 | 1 | `frontend/blocks.ts`, T-AVM1-FE-027/028 |
| WP-050-13 | Requirements extraction | WP-050-08 | 2 | `frontend/requirements.ts` |
| WP-050-14 | Name/class recovery pass (incl. `Extends`) | WP-050-08, WP-020-07 | 4 | `frontend/names.ts`, T-AVM1-FE-012/026 |
| WP-050-15 | AVM2 detection (`DoABC` + flag) + hard error path | WP-020-04 | 1 | `frontend/avm2.ts`, T-AVM1-FE-010 |
| WP-050-16 | `inspect --actions` disassembler + synthetic conformance | WP-050-03 | 2 | user-visible disassembly; no parser/assembler is implied |
| WP-050-17 | Seeded action-stream mutation/truncation gate | WP-050-01 | 2 | T-AVM1-FE-033; 10⁶ cases with residual invariants |
| | **Total** | | **46** | |

## 12. Open items

| # | Item | Impact |
| --- | --- | --- |
| 1 | `GotoFrame`'s `Frame` operand: 0- vs 1-based first frame (the chapter says only "frame index"); pin with oracle fixtures | medium (`T-AVM1-FE-021`) |
| 2 | Semantics of the two observed-but-undocumented opcodes (0x89 `StrictMode`, 0x2D `FsCommand2`) | low (inert today) |
| 3 | Whether a zero `Length` on a ≥ 0x80 record is legal (the chapter implies data follows, so zero-length is malformed by construction) | low |
| 4 | SWF ≤5 string encoding is locale-selected ANSI/Shift-JIS with no in-file selector; `ActionStringLength`'s exact DBCS result is not specified in Ch. 5 and needs a runtime oracle | medium (FE-030; do not infer encoding from font flags/`LanguageCode`) |
| 5 | `ActionEnumerate` ordering *at run time* in Flash Player (the compiler is deterministic by decision, R044) | low |
| 6 | `RandomNumber`'s behaviour for `max ≤ 0` (undocumented) | low (runtime RNG policy) |
| 7 | **Retained P5 gate:** define the lossless inverse/disassembly grammar and byte-identity contract for every defined opcode; add a separately scoped/estimated P5 work package before implementation (WP-050-16 explicitly does not include a parser/assembler) | high — blocks P5 closeout (§13.2) |

The v1.0 open items (complete operand layouts, the per-version action-model differences, the `Push`
type table, the flag encodings, `StackSwap`'s corrected order, `StringExtract` argument order,
`DoABC` framing, constant-pool scoping) are **settled** — see §4, §5 and APP-§10.3. The v1.0 item
that claimed the chapter promises a "post-ship change list" for `SetTarget2` is **withdrawn**: that
list is a PDF changelog artefact, not Ch.5 text, and no `verified:false` gate on `SetTarget2`
remains (see errata `E-012`). `StackSwap`'s
post-ship correction is confirmed by the chapter text: the action exchanges the top two values
(pops Item1, then Item2; pushes Item1, then Item2).

## 13. Done criteria

1. Every code in §4 is in `opcodes.ts` with operand schema, version window, and stack-effect
   classification; R016's exact reserved ranges are pinned against the table and all 256 byte values.
2. **Open — retained as a P5 exit criterion; not deferred.** The synthetic corpus must round-trip
   bytes → IR → disassembly → bytes for every defined opcode. The current AVM1 surface has a decoder,
   `ActionIR`, and a human-readable disassembler, but no disassembly parser or action-byte serializer.
   `T-AVM1-FE-032` therefore proves only bytes→IR→text conformance and MUST NOT be cited as byte
   round-trip evidence. Before implementation, specify the lossless inverse format and byte-identity
   coverage, then add a separately scoped and estimated P5 work package. Keep this criterion open; no
   parser, serializer, or round-trip test is implemented by this scope decision.
3. Every tier reason has a fixture; the tier report on the open corpus is reviewed by two people.
4. Fuzzing: 10⁶ seeded action-stream mutations/truncations, zero uncaught exceptions, and safe
   residual fallback for malformed or unknown records.
5. Requirement extraction and name recovery are deterministic across process restarts.
6. The P5 front end preserves the `DoAction`/`DoInitAction` schedule metadata in §3; FE-027/028 evidence is limited to that frontend boundary. Observable once/order/ShowFrame execution is a P7/IMPL-130 runtime gate, not a P5 acceptance criterion.

## 14. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Scoped from Ch.5 structure; opcode details flagged pending with a verification mechanism |
| 1.1 | 2026-10-04 | Ch.5-grounded: complete 101-code opcode table with versions, payloads and stack effects; `ACTIONRECORD` length rule; the five block kinds + `DoAction`/`DoInitAction` scheduling contract; `Push` type table; constant pool as execution state (correction to `AVM1-R014`); `DefineFunction2` mask table (bit-order trap) and register allocation order; `With` depth caps and skip-body; `Try` field order (no finally register); `GetURL2`/`GotoFrame2`/`WaitForFrame*` flag layouts; property ids and target prefixes; version-dependent result types; reverse-push convention; `Enumerate` determinism; observed-but-undocumented 0x89/0x2D; diagnostics `SF0411`–`SF0422`; tests `T-AVM1-FE-013`–`T-AVM1-FE-030`; WPs 01–17 = 46 d |
| 1.2 | 2026-10-04 | `SF0423`/`SF0424` added so the design spec `AVM1-R021`/`AVM1-R040` conditions have codes that are not already the block-terminator/`DoInitAction` codes (`SF0420`/`SF0421`); errata `E-016` |
| 1.3 | 2026-10-10 | Namespace front-end obligations as `T-AVM1-FE-001`–`031`; define R064 for opcode-specific literal folding and add the coercion regression matrix T-AVM1-FE-031 |
| 1.4 | 2026-10-10 | Reconcile §4 with all 102 source rows (including SWF-4 `WaitForFrame2`); correct its minimum-version window and pin the exact reserved complement; add FE-032/033; clarify that the current disassembler cannot satisfy the still-open bytes→IR→disassembly→bytes criterion |
| 1.5 | 2026-10-10 | Resolve the action-stream post-End policy under R006: block-level scanning stops after the first End and ignores the suffix; pin the scanner boundary and tier behavior with focused tests |
| 1.6 | 2026-10-11 | Cite Adobe's SWF 3 and SWF 4 action lists for the `WaitForFrame2` minimum-version classification; the local SWF-4 assignment is no longer an uncited inference |
| 1.7 | 2026-10-11 | Ground the SWF ≤5 ANSI/Shift-JIS locale rule and DBCS `MBStringLength` behavior in Adobe SWF v19; correct the unsupported `StringLength` byte claim; add explicit analyzer encoding selection and scope FE-030 to the established behavior while leaving the runtime `StringLength` result open |
| 1.8 | 2026-10-11 | Record the P5/P7 acceptance boundary: frontend metadata/IR stays in P5; runtime execution of frame calls, exception unwinding, and scheduling is P7/IMPL-130. Preserve FE test IDs and normative AVM1 semantics; clarify §13 exit criteria without claiming any runtime gate passed. |
| 1.9 | 2026-10-11 | Record the byte-round-trip scope decision: retain the existing inverse criterion as a P5 exit gate, leave it open, and require a lossless contract plus a separately scoped/estimated work package before implementation. |
