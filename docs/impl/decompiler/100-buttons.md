# IMPL-100 — Buttons, Tracking, and Hit Testing

**Doc ID:** IMPL-100 · **Status:** ✅ grounded in Ch.12 · **Package:** `@swf-forge/swf` + `@swf-forge/runtime`
**Format spec:** Chapter 12 — Buttons (button states, tracking, the state-transition/event table,
`BUTTONRECORD`, `DefineButton`, `DefineButton2`, `BUTTONCONDACTION`, `DefineButtonCxform`,
`DefineButtonSound`)
**Design specs:** SWF-§6.7, AVM1-§11 (button events), RT-§8 (input and focus), GFX-§5 (state geometry),
AUD-§6.1 (button sounds), APP-§2/§6
**Pinned byte layouts:** APP-§10.10 (Ch.12 structures).

---

## 1. Deliverables

1. `DefineButton` (7, SWF 1) and `DefineButton2` (34, SWF 3+) into a `ButtonModel`.
2. `BUTTONRECORD` state records with the real flag order (`ButtonStateUp` is the **low** bit), depths,
   matrices, and the v2-only `CXFORMWITHALPHA`/`FILTERLIST`/`BlendMode` tail.
3. `BUTTONCONDACTION` (v2) into condition sets: the eight leading condition bits, the 7-bit
   `CondKeyPress` field, and the ninth condition bit that **follows** the key code.
4. `DefineButtonSound` (17): the four transition sounds, in the chapter's order — 0 = roll-out,
   1 = roll-over, 2 = press, 3 = release.
5. `DefineButtonCxform` (23): one RGB colour transform for a v1 button's characters (v2 buttons carry
   per-record colour transforms instead).
6. The tracking model: push (captures the mouse) vs menu (does not), expressed as the chapter's
   nine state transitions plus the menu-only `IdleToOverDown`/`OverDownToIdle` pair, in one table the
   runtime and the renderer share.
7. Runtime contract data for doc 130: per-condition handler symbols, the sound-per-transition table,
   hit-area geometry, and focus/`keyPress` behaviour.
8. Diagnostic/tests for every malformed shape the chapter makes possible.

**Non-goals:** pointer/focus implementation (doc 130 consumes the model), and emitted code shape (doc 120).

**P2 implementation boundary:** the dictionary decoder, data model, transition table, hit-area bounds,
button sound records, and one AVM1 analysis block per action range are implemented and covered by
`T-MOD-801`–`817`. `buttonTransitionsForTracking` selects transition data; it is not a pointer state
machine. `hitArea` is a union of transformed axis-aligned character bounds, not exact vector
hit-testing. Runtime event dispatch, focus/composite-key input, exact shape hit-testing, generated
handler symbols, and the `ButtonRuntimeSpec` remain doc 130/120 work and are not claimed as complete.

## 2. Module layout

```
packages/swf/src/tags/buttons.ts       BUTTONRECORD, DefineButton/2, CONDACTION, cxform, sounds
packages/swf/src/model/buttons.ts      shared transition table, tracking filter, state ordering,
                                       matrix singularity and transformed bounds helpers
packages/swf/src/model/movie.ts        dictionary assembly, cross-tag linking, nested hit-area bounds
packages/swf/test/buttons.test.ts      T-MOD-801–816 decoder/model fixtures
packages/avm1/src/frontend/analyze.ts  one AVM1 analysis block per button action range (doc 050)
packages/avm1/test/movie.test.ts       T-MOD-817: one analyzed block per CONDACTION range
```

**IMPL-100-R001** The transition/event table (§4) MUST exist as one shared data table
(`BUTTON_TRANSITIONS: {condition, transition, event, tracking}[]`), consumed by the model helpers and,
when implemented, the runtime's state machine and renderer's state atlas selection. The current table
lives in `packages/swf/src/model/buttons.ts`; no second runtime copy is permitted.

**IMPL-100-R002** v1 and v2 records MUST share one `button-record.ts` reader with an explicit version
parameter. The differences are *structural*, not cosmetic: v2 adds `CXFORMWITHALPHA` to **every**
record, the blend/filter flags are only meaningful in v2, and v2's action list is a separate
`BUTTONCONDACTION` chain reached by `ActionOffset` rather than a trailing array.

## 3. Tag bodies (normative)

```
DefineButton (7, SWF 1):
  ButtonId UI16
  BUTTONRECORD[]           // one or more; each carries at least one state flag
  CharacterEndFlag UI8 = 0
  Actions ACTIONRECORD[]   // performed when the button is CLICKED AND RELEASED
  ActionEndFlag UI8 = 0

DefineButton2 (34, SWF 3+):
  ButtonId UI16
  ReservedFlags UB[7] = 0   TrackAsMenu UB[1]
  ActionOffset UI16         // bytes from the START OF THIS FIELD to the first BUTTONCONDACTION,
                            // or 0 when the button has no condition actions
  BUTTONRECORD[]            // v2 form (always CxformWithAlpha); ends with the zero byte
  CharacterEndFlag UI8 = 0
  BUTTONCONDACTION[]        // at ActionOffset; absent when ActionOffset = 0
```

**BUTTONRECORD** (MSB-first flag byte — the state bits are the *low* four bits):

```
ButtonReserved     UB[2] = 0
ButtonHasBlendMode UB[1]      // SWF 8+; earlier players ignore the field
ButtonHasFilterList UB[1]     // SWF 8+; earlier players ignore the field
ButtonStateHitTest UB[1]
ButtonStateDown    UB[1]
ButtonStateOver    UB[1]
ButtonStateUp      UB[1]
CharacterID        UI16
PlaceDepth         UI16
PlaceMatrix        MATRIX
ColorTransform     CXFORMWITHALPHA          // present in DefineButton2 records only
FilterList         FILTERLIST               // v2 + ButtonHasFilterList
BlendMode          UI8                      // v2 + ButtonHasBlendMode
```

**BUTTONCONDACTION** (the layout the v1.0 document guessed at; the key code sits *between* the
condition bits):

```
CondActionSize          UI16   // bytes from the start of this field to the next BUTTONCONDACTION,
                               // 0 when this is the last one
CondIdleToOverDown      UB[1]  //  8 condition bits, MSB-first
CondOutDownToIdle       UB[1]
CondOutDownToOverDown   UB[1]
CondOverDownToOutDown   UB[1]
CondOverDownToOverUp    UB[1]
CondOverUpToOverDown    UB[1]
CondOverUpToIdle        UB[1]
CondIdleToOverUp        UB[1]
CondKeyPress            UB[7]  // SWF 4+: 1/2/3/4/5/6 = left/right/home/end/insert/delete,
                               // 8 = backspace, 13 = enter, 14/15 = up/down arrow,
                               // 16/17 = page up/page down, 18 = tab, 19 = escape,
                               // 32–126 = ASCII; SWF 3 files carry 0
CondOverDownToIdle      UB[1]  // the NINTH condition bit — after the key code, not in the first byte
Actions                 ACTIONRECORD[]
ActionEndFlag           UI8 = 0
```

**DefineButtonCxform (23, SWF 2):** `ButtonId UI16`, `ButtonColorTransform CXFORM` — **RGB only, no
alpha** (design `SWF-R021`'s colour transform). It is not used for `DefineButton2`.

**DefineButtonSound (17, SWF 2):** `ButtonId UI16`, then four `(ButtonSoundCharN UI16,
ButtonSoundInfoN SOUNDINFO if ButtonSoundCharN != 0)` pairs, in this order:

| N | Transition | Event |
| --- | --- | --- |
| 0 | `OverUpToIdle` | Roll Out |
| 1 | `IdleToOverUp` | Roll Over ("over" sound in the authoring tool) |
| 2 | `OverUpToOverDown` | Press |
| 3 | `OverDownToOverUp` | Release |

- **IMPL-100-R003** The four-sound order is **not** the authoring tool's up/over/down order: index 0 is
  roll-*out* and index 1 is roll-*over*. A table keyed "0 = over" makes every button play its sound on
  the wrong transition, and it is invisible in a single-transition test — `T-MOD-815` checks all four.
- **IMPL-100-R004** `CharacterID`/`ButtonId` that reference a non-button, a missing character, or reuse
  another button's id MUST be reported (`SF0132`, `SF0136`) and the data kept for `inspect`.
- **IMPL-100-R005** `BUTTONCONDACTION`'s chain is followed by `CondActionSize` from its own start:
  `next = start + CondActionSize`. A size of 0 ends the chain. A size that does not move forward, that
  overruns the tag, or that lands mid-action-record is `SF0130` (warning) and the chain is truncated
  rather than iterated further (a malformed size must never loop the decoder).
- **IMPL-100-R006** `ActionOffset` in `DefineButton2` is measured from the **`ActionOffset` field
  itself**, not from the tag body or the `ButtonId`. Reading it from the wrong base is the classic bug
  that produces plausible-but-shifted actions; `T-MOD-813` pins both bases.
- **IMPL-100-R007** Records may cover several states at once (`ButtonStateUp | ButtonStateOver | …`)
  and a state may have many records; both are legal and MUST NOT be normalised away. The model stores
  records once with a state *set*, and `statesFor()` derives per-state ordered lists.
- **IMPL-100-R008** A record with **no** state flag set is legal in the byte grammar but meaningless: it
  is dropped with `SF0134` (warning) naming the character id, because it cannot be rendered or tested.
- **IMPL-100-R009** Definition order is not free: a button record may reference any character defined
  anywhere in the file (Ch.12 does not require "before", unlike sprites); references are resolved after
  the dictionary pass, and unresolvable ones become placeholders (`SF0110`, shared with doc 030).
- **IMPL-100-R010** v2 blend/filter fields: `BlendMode` uses the same 0–14 table as `PlaceObject3`
  (APP-§6); `FILTERLIST` uses the same structure as `PlaceObject3.SurfaceFilterList` (doc 030 §5)
  — one decoder, two callers. Values 15–255 are reserved and recorded (`SF0114`-class, shared).
- **IMPL-100-R011** AS3-era violation: when `FileAttributes.ActionScript3` is set, a `DefineButton2`
  with `ActionOffset != 0` or with `BUTTONCONDACTION` records is malformed content — report `SF0133`
  and decode the actions anyway (they are inert under AVM2, but the structural report must be
  accurate).

## 4. States, transitions, and tracking (normative)

**States.** `up` (default; mouse outside), `over` (mouse inside), `down` (pressed inside), and the
invisible `hitTest` state that defines the active area. The hit area need not be rectangular and need
not match the visible shape. There is no "checked"/selected state and no way to group buttons into
mutually exclusive sets — radio/checkbox behaviour is authoring-side imitation via actions, not a
property of the format.

**Transition/event table** (the chapter's tables, one row per condition bit):

| Condition bit | Transition | Event | Tracking |
| --- | --- | --- | --- |
| `CondIdleToOverUp` | Idle → OverUp | Roll Over | both |
| `CondOverUpToIdle` | OverUp → Idle | Roll Out | both |
| `CondOverUpToOverDown` | OverUp → OverDown | Press | both |
| `CondOverDownToOverUp` | OverDown → OverUp | Release | both |
| `CondOutDownToOverDown` | OutDown → OverDown | Drag Over | push only |
| `CondOverDownToOutDown` | OverDown → OutDown | Drag Out | push only |
| `CondOutDownToIdle` | OutDown → Idle | Release Outside | push only |
| `CondIdleToOverDown` | Idle → OverDown | Drag Over | menu only |
| `CondOverDownToIdle` | OverDown → Idle | Drag Out | menu only |

- **IMPL-100-R012** Tracking is data, not code: a push button captures the mouse on press, so a drag
  outside shows the **over** state and keeps the pointing-hand cursor; a menu button does not capture,
  so a drag outside returns to the **up** state and the arrow cursor. The model exposes
  `trackAsMenu`; the runtime implements the capture rule (RT-R044) from the table above.
- **IMPL-100-R013** `CondKeyPress` handlers fire **even when the button does not have input focus**
  (that is the chapter's wording, and the reason `keyPress` is used for menu shortcuts). For ASCII
  32–126 the trapped code is the *composite* (Shift-aware) key; raw key events are what clip-event
  handlers are for. The decoder keeps the raw code and the build-time mapping to named `Key` constants
  (AVM1-R080); the runtime compares both, and only one handler may fire per keystroke per button.
- **IMPL-100-R014** A `BUTTONCONDACTION` with **no** condition bit set and **no** key code never fires;
  that is legal content but dead weight — `SF0137` (info) once per button names the count.
- **IMPL-100-R015** Hit-area resolution, in order: (1) the geometry of records with
  `ButtonStateHitTest`; (2) otherwise the union of the `up` state's record geometry, with each
  record's matrix applied (a scaled/rotated child changes the area) and alpha-0-but-present geometry
  still counting. Rule (2) is a documented design decision (`GFX-D16`): the chapter defines the hit
  state but does not state the fallback; it is pinned by `T-MOD-801` against player behaviour.
- **IMPL-100-R016** Hit testing is done in the button's own coordinate space with the inverse of the
  composed placement matrix; a singular matrix makes the button non-interactive (`SF0131`) rather than
  dividing by zero.
- **IMPL-100-R017** Nesting: a button inside a sprite (or inside another button's states) is legal and
  MUST NOT be flattened; hit testing resolves innermost-first (RT-R045, design decision).
- **IMPL-100-R018** A button whose state geometry is empty for the *current* state is not interactive
  in that state (nothing to draw, nothing to hit); the runtime consults the hit area only.
- **IMPL-100-R019** v1 buttons have exactly one action trigger — "clicked and released" — modelled as
  the single condition `OverDownToOverUp` on a v1 `ButtonActionRecord`. The v1.0 document's talk of
  "v1 action condition records" was wrong: `DefineButton` just carries a plain `ACTIONRECORD` array
  terminated by `ActionEndFlag` (`SF0130` is *not* an informational "v1 actions present" code any
  more; the code was reassigned — see §7 and errata `E-020`).

## 5. Model

```ts
export interface ButtonModel {
  readonly id: number;
  readonly version: 1 | 2;
  readonly trackAsMenu: boolean;                        // v2 only; false in v1
  readonly records: readonly ButtonRecord[];            // authored order; state names are arrays
  readonly characterCxform: Cxform | null;              // v1 only: DefineButtonCxform (no alpha)
  readonly actions: readonly ButtonActionRecord[];      // v1: one record; v2: the CONDACTION chain
  readonly sounds: readonly ButtonSoundRecord[];        // from DefineButtonSound, if any
  readonly hitArea: Rect | null;                        // transformed axis-aligned bounds, not a hit-test shape
  readonly hitAreaSource: 'hitTest' | 'up' | null;      // explicit HitTest records win; up-state fallback otherwise
  readonly keyPressRequiresFocus: false;                // Chapter 12 condition handlers are focus-independent
  readonly origin: TagRef;
}

export interface ButtonRecord {
  readonly states: readonly ButtonState[];              // up/over/down/hitTest; low flag bits
  readonly depth: number;
  readonly characterId: number;
  readonly matrix: Mat2D;                               // relative to the button character
  readonly cxform: Cxform | null;                       // v2 records only
  readonly blendMode: number | null;                    // raw v2 UI8 when flagged
  readonly filters: readonly FilterSpec[] | null;       // v2 + flag
  readonly rawFlags: number;
  readonly tagOffset: number;
}

export interface ButtonActionRecord {
  readonly conditions: ButtonConditions;                // nine transition bits + 7-bit CondKeyPress
  readonly rawConditionWord: number;                    // both condition bytes, preserved
  readonly keyCode: number | null;                      // retained even when undocumented; null when 0
  readonly actionBytes: ActionBlockRef;                  // exact ACTIONRECORD byte range, handed to doc 050
  readonly tagOffset: number;
  readonly origin: TagRef;
}

export interface ButtonConditions {
  readonly idleToOverUp: boolean; readonly overUpToIdle: boolean;
  readonly overUpToOverDown: boolean; readonly overDownToOverUp: boolean;
  readonly outDownToOverDown: boolean; readonly overDownToOutDown: boolean;
  readonly outDownToIdle: boolean; readonly idleToOverDown: boolean;
  readonly overDownToIdle: boolean;
}

export interface ButtonSoundRecord {
  readonly transition: 'overUpToIdle' | 'idleToOverUp' | 'overUpToOverDown' | 'overDownToOverUp';
  readonly soundId: number;
  readonly info: ButtonSoundInfo | null;
}

export interface ButtonSoundInfo {
  readonly rawFlags: number; readonly reserved: number;
  readonly syncStop: boolean; readonly syncNoMultiple: boolean;
  readonly inPoint: number | null; readonly outPoint: number | null;
  readonly loopCount: number | null;
  readonly envelope: readonly { readonly position44: number; readonly leftLevel: number; readonly rightLevel: number }[];
}
```

- **IMPL-100-R020** `buttonRecordsForState(records, state)` returns the records whose state list includes `state`, ordered by `depth` (lowest first), with equal depths broken by file order (doc 030's rule). This helper is implemented; the renderer's button atlas and runtime draw order MUST call this same function when those stages are implemented.
- **IMPL-100-R021** `ButtonSoundRecord.info` MUST follow the `SOUNDINFO` field order and raw units in
  IMPL-090 §5 (start/out sample positions, loops, `Pos44` envelope points). At the time this decoder
  was added, no shared production `StartSound` decoder existed; `tags/buttons.ts` therefore records
  these fields directly. When doc 090 adds its decoder, both paths MUST converge on one shared helper
  before runtime sample/loop conversion (AUD-§6.1).
- **IMPL-100-R022** `actions` MUST carry raw byte ranges, not decoded IR: doc 050 owns action decoding,
  and a button action block is just another action block to it (with `this` bound to the button's
  parent clip, AVM1-R063).

## 6. Runtime contract

```ts
export interface ButtonRuntimeSpec {
  readonly id: number;
  readonly transitions: readonly {
    readonly condition: keyof ButtonConditions | 'keyPress';
    readonly keyCode: number | null;
    readonly fn: string;                 // emitted handler symbol
  }[];
  readonly sounds: readonly { transition: string; soundId: number; soundInfo: SoundInfo }[];
  readonly trackAsMenu: boolean;
  readonly hitAreaRef: string;             // geometry handle, resolved at load
  readonly states: Record<ButtonState, readonly { depth: number; characterId: number;
    matrix: Mat4; cxform: Cxform | null; blend: BlendMode | null; filters: FilterSpec[] | null }[]>;
}
```

- **IMPL-100-R023** Handlers MUST be grouped by shared action block at build time: one symbol per
  `BUTTONCONDACTION`, carrying its condition bitmask and key code. The emitter MUST NOT emit one
  closure per condition bit, and MUST NOT emit a `switch` over all nine bits at runtime.
- **IMPL-100-R024** The runtime's transition function MUST be the §4 table applied to the pointer
  state + `trackAsMenu`, not a per-title heuristic; divergences (a handler that never fires in the
  conformance corpus) are reported as content bugs, not patched.
- **IMPL-100-R025** Button sounds are frame-independent (like `StartSound`): they start on the
  transition's audio boundary with the shared mixer's voice accounting (AUD-R052).
- **IMPL-100-R026** `addListener`/`on(…)`-era button objects, `_focusrect`, and tab order are covered
  by RT-§8; this document's obligation ends at the decoded model and the handler/transition table.

## 7. Diagnostics

Codes `SF0130`–`SF0139` are this document's block (`IMPL-010` §7). `SF0110` (missing character) is
shared with doc 030.

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0130` | warning | `BUTTONCONDACTION` chain malformed (`CondActionSize` zero-length advance or overrun) — chain truncated |
| `SF0131` | warning | singular placement matrix → button non-interactive in that state |
| `SF0132` | warning | `DefineButtonSound` truncated or references a sound id that is not a sound |
| `SF0133` | warning | AS3-flagged file with `DefineButton2` condition actions (inert under AVM2) |
| `SF0134` | warning | button record with no state flag set (dropped) |
| `SF0135` | info | `CondKeyPress` outside the documented set (kept raw, never fires) |
| `SF0136` | warning | `DefineButtonCxform`/`DefineButtonSound` target is not a button character |
| `SF0137` | info | condition action with no condition and no key code (never fires) |
| `SF0138` | info | v1 button action array present (legal; recorded for the report) |
| `SF0139` | — | reserved for this block |

## 8. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| `T-MOD-801` | hit-area union from `up` geometry, scaled and semi-transparent children | F1 |
| `T-MOD-802` | explicit `hitTest` records override; multi-state records render in both states | F1 |
| `T-MOD-803` | every condition bit fires exactly one handler on its mapped transition | F1 |
| `T-MOD-804` | `keyPress`: documented special keys + ASCII 32–126 retained; focus-independent data contract (modifier routing is runtime work) | F1 |
| `T-MOD-805` | `DefineButton` v1: records, `CharacterEndFlag`, action array, `ActionEndFlag` | F1 |
| `T-MOD-806` | button sounds: all four transitions, truncated record, non-sound id | F1 |
| `T-MOD-807` | nested-button transformed bounds resolve through child records without flattening; handler bubbling is runtime work | F2 |
| `T-MOD-808` | `TrackAsMenu` selects menu-only versus push-only transition data; pointer-sequence execution is runtime work | F2 |
| `T-MOD-809` | singular matrix does not crash hit testing | F1 |
| `T-MOD-810` | `BUTTONCONDACTION` bit layout incl. the ninth bit after the key code and `CondActionSize` chaining | F1 |
| `T-MOD-811` | `DefineButton2` `ActionOffset` base (field start), zero-offset buttons, AS3-flag violation | F1 |
| `T-MOD-812` | `DefineButtonCxform` RGB transform applies to v1 button characters and is absent for v2 | F1 |
| `T-MOD-813` | blend mode/filter list in v2 records match `PlaceObject3` decoding for the same payload | F1 |
| `T-MOD-814` | push/menu transition-table membership and order; full press/drag/release simulation is runtime work | F2 |
| `T-MOD-815` | button sound transition order (0 roll-out, 1 roll-over, 2 press, 3 release) | F1 |
| `T-MOD-816` | empty-state record and empty-condition action produce the documented info codes only | F2 |
| `T-MOD-817` | handler grouping: one symbol per CONDACTION, key code preserved | F1 |

## 9. Work packages

| WP | Title | Depends | Est | Deliverable |
| --- | --- | --- | --- | --- |
| WP-100-01 | `BUTTONRECORD` shared reader (v1/v2, flag order, CXFORM/filters/blend) | WP-030-01 | 3 | `button-record.ts`, T-MOD-802/813 |
| WP-100-02 | `DefineButton` (v1) + action array + `ActionEndFlag` | WP-100-01 | 2 | `define-button.ts`, T-MOD-805 |
| WP-100-03 | `DefineButton2` header, `ActionOffset`, records | WP-100-01 | 3 | `define-button2.ts`, T-MOD-811 |
| WP-100-04 | `BUTTONCONDACTION` chain + condition/key table | WP-100-03, WP-050-03 | 4 | `button-cond-action.ts`, `conditions.ts`, T-MOD-803/810/816 |
| WP-100-05 | `ButtonModel` state resolution + hit-area computation | WP-100-03 | 3 | `button-model.ts`, T-MOD-801/809 |
| WP-100-06 | `DefineButtonSound` (four transitions, SOUNDINFO reuse) | WP-100-03, WP-090-07 | 2 | `button-sounds.ts`, T-MOD-806/815 |
| WP-100-07 | `DefineButtonCxform` (v1 colour transform) | WP-100-02 | 1 | `button-cxform.ts`, T-MOD-812 |
| WP-100-08 | Transition/tracking table + runtime spec emission | WP-100-04, WP-100-05 | 3 | `ButtonRuntimeSpec`, T-MOD-814/817 |
| WP-100-09 | Input/focus integration (`keyPress` without focus, tab order) | WP-100-08, WP-040-08 | 3 | RT-R042/R044 wiring, T-MOD-804 |
| WP-100-10 | Button corpus (v1/v2, menu, nested, sounds, malformed chains) | WP-100-05 | 2 | CI fixtures + `inspect --buttons` |
| | **Total** | | **26** | |

## 10. Open items

| # | Item | Impact |
| --- | --- | --- |
| 1 | The `up`-geometry fallback for the hit area is **not** in the chapter — pinned as design decision `GFX-D16` against player behaviour | medium (`SF`-free; `T-MOD-801`) |
| 2 | Whether `DefineButtonSound` is legal on a `DefineButton2` character in Flash (the chapter documents it as a separate tag and never restricts it to v1) — current policy: accept, report `SF0138`-class info | low |
| 3 | Overlapping records at the *same* depth inside a state (legal per the grammar; render order then depends on file order) — confirm against the oracle | low |
| 4 | `ButtonStateHitTest` combined with visible-state flags on the same record (legal; the hit area then also renders) | low |
| 5 | Whether Flash applies the v2 `BlendMode` on pre-SWF 8 exports that nevertheless carry the flags | low |

The v1.0 open items (condition-bit assignments, v1/v2 flag layouts, v1 trailing actions, sound record
placement, hit-area rule, menu semantics) are **settled** — see §3/§4 and APP-§10.10. Item 1 remains
open *by specification silence*, not by missing chapter text.

## 11. Done criteria and current status

1. **P2 model criterion — met:** both button versions decode; each of the nine condition bits and
   push/menu transition data has a labeled fixture (`T-MOD-801`–`817`).
2. **Runtime criterion — open:** exact hit-area computation against the reference player is not
   established; the current model exposes axis-aligned transformed bounds only.
3. **Runtime/input criterion — open:** nested-event propagation, pointer sequences, composite-key
   dispatch, and focus integration require doc 130's runtime and interaction suite.
4. **Emitter/harness criterion — open:** no emitted `ButtonRuntimeSpec` or `verify` command exists;
   doc 120/140 owns generated symbols, resource validation, and serialization checks.

## 12. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Scoped from Ch.12; condition/flag layouts marked pending |
| 1.1 | 2026-10-04 | Ch.12-grounded: real `BUTTONRECORD` flag order (state bits low) and v2-only CXFORM/FILTERLIST/BlendMode tail; `DefineButton`'s trailing `ACTIONRECORD` array + `ActionEndFlag` (v1.0's "action condition records" were wrong); `DefineButton2` header with `TrackAsMenu` and the `ActionOffset` base; **`BUTTONCONDACTION` exact layout incl. the ninth condition bit after the 7-bit `CondKeyPress` field** and `CondActionSize` chaining; the nine-transition/event table with push-vs-menu tracking; `DefineButtonCxform` (RGB, v1-only) and `DefineButtonSound`'s four-transition order (0 = roll-out … 3 = release); keys 1–19 + ASCII 32–126 with composite-shift semantics and no-focus firing; diagnostics `SF0130`–`SF0138` re-scoped; tests `T-MOD-810`–`817`; WPs 01–10 = 26 d |
