# Findings — development integrity audit

Twenty findings, ordered by severity then by package. Line numbers are at HEAD `a76f2ea`. Each finding
names the specification sentence it violates and the exact change that closes it. Where a finding is a
*defect in the documents* rather than in the code, it says so explicitly and the fix belongs in `docs/`.

Severity legend: **blocker** wrong output for legal input · **major** a `MUST` missing, inverted or
mis-wired with user-visible effect · **minor** one diagnostic, flag, field name or dead-code divergence.

---

## F-01 — `DefineShape4` flag bits are read at the wrong offsets (blocker)

**Rule:** `IMPL-060-R004` · **File:** `packages/swf/src/tags/shape.ts:556`, `:561`, `:572`–`:574`

```ts
556  const reservedBits = flags & 0b0001_1111;
557  if (reservedBits !== 0) { … Codes.SHAPE_RESERVED_FLAG_BITS, 'info', … }
572  fillRule: (flags & 0b0010_0000) !== 0 ? 'nonZero' : 'evenOdd',
573  nonScalingStrokes: (flags & 0b0001_0000) !== 0,
574  scalingStrokes: (flags & 0b0000_1000) !== 0,
```

**Specification.** SWF Specification 19, `DefineShape4` field table (Ch.6):

> `Reserved` UB[5] *Must be 0.*
> `UsesFillWindingRule` UB[1] *If 1, use fill winding rule. Minimum file format version is SWF 10*
> `UsesNonScalingStrokes` UB[1] *If 1, the shape contains at least one non-scaling stroke.*
> `UsesScalingStrokes` UB[1] *If 1, the shape contains at least one scaling stroke.*

Bit fields are read MSB-first, so the five reserved bits are bits 7…3 and the three named flags are
bits 2, 1, 0 (`0b0000_0100`, `0b0000_0010`, `0b0000_0001`). `IMPL-060-R004` restates it:

> the reserved five bits MUST be preserved (reported once per file, `SF0188`), `UsesFillWindingRule`
> selects the fill rule for that shape … `UsesNonScalingStrokes`/`UsesScalingStrokes` MUST be recorded in
> the IR and the report … but MUST NOT be silently coerced.

Independent corroboration (not normative): `ruffle-rs/ruffle`, `swf/src/types.rs:655-658` —
`HAS_SCALING_STROKES = 1 << 0`, `HAS_NON_SCALING_STROKES = 1 << 1`, `NON_ZERO_WINDING_RULE = 1 << 2`.

**What the code does.** Every mask is shifted three bits and mirrored: the reserved mask covers bits
0…4, `fillRule` reads bit 5, `nonScalingStrokes` bit 4, `scalingStrokes` bit 3. Consequence, verbatim
from the probe in `README.md` §6: a legal flag byte of `0x04` (`UsesFillWindingRule`) decodes to
`fillRule: 'evenOdd'` **and** raises `SF0188` ("reserved bits non-zero"); `0x01`
(`UsesScalingStrokes`) raises `SF0188` as well. Three of the eight meaningful bits are consequently
mis-assigned in both directions: real flags are reported as reserved, and real reserved bits are
recorded as stroke hints.

**Why the WP table did not catch it.** `WP-060-12` ("Fill-rule plumbing: `UsesFillWindingRule` → IR →
tessellator", doc 060 §table) is open, so the winding rule *looks* like a scheduled item — but the defect
is in the flag-byte decode inside `WP-060-01` ("`DefineShape*` headers + bounds + version dispatch"),
which is treated as done. `WP-060-12` cannot be completed while the decode is wrong, because `fillRule`
never becomes `'nonZero'` for any input.

**Impact.** Silent wrong geometry for every `DefineShape4` shape that sets `UsesFillWindingRule`:
`packages/gfx` selects `nonzero` iff `fillRule === 'nonZero'` (`GFX-R072`, doc 060 §6.2), so these
shapes render with even-odd and self-overlapping paths fill with holes. In addition `SF0188` becomes
noise on legal files, and `SF0183`'s sibling rule (`R005` — winding rule in a pre-SWF-10 file) can never
be judged correctly. This is the single most consequential defect in the slice.

**Fix.** Correct the four masks to `0b1111_1000`, `0b0000_0100`, `0b0000_0010`, `0b0000_0001`; add a
unit test that decodes the eight flag bytes `0x00`…`0x07` and asserts `fillRule`/`nonScaling`/`scaling`
plus the absence of `SF0188`, and one that sets `0b1111_1000` and asserts `SF0188` *with* the raw value
preserved (`T-MOD-111`–`118`, doc 060 §9).

---

## F-02 — `0xFF` style count decoded as an extended count in `DefineShape` v1 (blocker)

**Rule:** `IMPL-060-R006` · **File:** `packages/swf/src/tags/shape.ts:197`–`208`, `:228`–`232`

```ts
197  if (count === 0xff) {
199      c.emit(Codes.SHAPE_RESERVED_FEATURE, 'info', 'extended FillStyleCount used by DefineShape (v1)');
208    count = c.u16();          // ← two extra bytes consumed, for a v1 tag
```

**Specification** (`IMPL-060-R006`):

> The `0xFF` escape cannot appear in `DefineShape` (v1): there `0xFF` is a literal count of 255 and no
> `UI16` follows; decoding the escape desynchronises the whole tag and is a known reason shapes "explode"
> into noise. The chapter's field table says the extended count is "supported only for Shape2 and
> Shape3"; `DefineShape4` reuses the same structure, so we accept the escape there too …

The doc echoes the chapter's §4.1 pseudo-code: `if FillStyleCount == 0xFF: // DefineShape2 and
DefineShape3/4 only`.

**What the code does.** For `version === 1` it emits an info diagnostic and then reads the `UI16` at
`:208` anyway — exactly the desynchronisation the rule names. The same shape of code exists for the line
style array at `:230`/`:232`.

**Impact.** A `DefineShape` (tag 2) with 255 styles — legal, and produced by old authoring tools — has
its style array and every subsequent shape record mis-parsed. The diagnostic is also wrong: this is not
"a chapter-reserved feature used by a later shape version" (`SF0191`'s meaning in doc 060 §8); it is a
plain v1 file being mis-decoded.

**Fix.** Branch on version first: for `version === 1`, treat `0xFF` as the literal 255 and never consume
the `UI16`; keep the escape for versions 2–4 only. Add a fixture with a v1 shape and a 255-entry style
array asserting that the style array, the shape records and the tag length all survive round-trip
(`T-MOD-111`).

---

## F-03 — `ZWS` without a decoder reports `SF0003` instead of `SF0006` (major)

**Rule:** `IMPL-020` §5.2, `SF0006` · **File:** `packages/swf/src/container/open.ts:177`–`186`

**Specification** (`docs/impl/foundation/020-container-tag-stream-dictionary.md:183`):

> if the adapter is unavailable, emit `SF0006` (error) and return an empty [body]

and the §8 table: `SF0006 | error | ZWS present but no LZMA decoder available`. The design spec makes the
split explicit (`specs/format/030`): the optional LZMA dependency may legitimately be absent, and the
*only* symptom of that is `SF0006`. Registry row: `codes.ts:125`.

**What the code does.** When `opts.inflate` is missing it emits `Codes.DECOMPRESSION_FAILED` (`SF0003`,
"decompression failed or stream corrupt") with the message "ZWS payload needs an inflater". `SF0006` is
therefore in the never-emitted set (`02-conformance.md` §2) even though the case it names is reachable
today with any `ZWS` file. The `CWS` half of the same branch is also affected — `SF0003` is defensible
for a `CWS` file with no inflater only because `SF0006` is `ZWS`-specific, but a distinct diagnostic
would be closer to the spirit of the table.

**Impact.** A real defect is reported as stream corruption, so the decompiler tells the user the file is
broken when the build simply lacks a decoder. Exit code is 1 either way, so this is a report-accuracy
defect, not a behavioural one.

**Fix.** Select the code by compression: `lzma` → `SF0006`, `zlib` → `SF0003` (or the §5.2 wording,
which is silent for `CWS` and should be tightened in the same edit). Add the `ZWS`-without-inflate case
to `framing.test.ts` (`T-SWF-001`).

---

## F-04 — Duplicate character-id policy is inverted (major)

**Rule:** `IMPL-020-R028` · **File:** `packages/swf/src/container/tag-stream.ts:212`–`242`

**Specification** (`020:309-312`):

> **IMPL-020-R028** Duplicate ids: … Policy (design SWF-R023): the **last** definition wins for lookups,
> both offsets are named in `SF0109` (warning), and the first definition remains reachable through
> `entries()` so `inspect` can show the shadowed one.

**What the code does.** On a duplicate id it emits `SF0109` with the message "the first definition
wins", keeps the existing entry (`definitionsById` is only `set` for a new id, `:242`), and records no
shadowed entry or second offset. Three separate clauses of `R028` are therefore violated: the winner,
the offset list, and `entries()` reachability.

**Impact.** For the real-world files the rule exists to serve, lookups resolve to a different character
than the player would use, and `inspect` cannot show the shadowed definition. Nothing crashes, which is
why the current tests pass.

**Fix.** Store the last definition in `definitionsById`, retain earlier entries with their offsets, and
emit `SF0109` naming both offsets; expose the shadowed entries from the dictionary iteration that
`entries()` will grow into. `T-SWF-007` already names this case.

---

## F-05 — `SF0190` and `SF0191` registry severities are swapped (major)

**Rule:** `IMPL-060` §8 severity table · **File:** `packages/swf/src/diagnostics/codes.ts:247`, `:248`

| Code | Doc 060 §8 (`:419`, `:420`) | Registry (`codes.ts`) | Call site |
| --- | --- | --- | --- |
| `SF0190` | **warning** "style array at the extended-count ceiling with duplicates" | `info` | `warning` (`shape.ts:219`) |
| `SF0191` | **info** "chapter-reserved feature used by a later shape version" | `warning` | `info` (`shape.ts:199`, `:230`, `:406`) |

**Impact.** `codeInfo()` and every generated status surface report the wrong severity, so a consumer that
filters by severity — a report, a `fail-on` threshold, `--json` output — classifies the two cases the
other way round. The registry is also the machine-checkable copy of §8, so a drift here makes the next
conformance check disagree with the doc.

**Fix.** Swap the two registry rows so the registry matches the doc and both call sites, then extend the
severity regression test (see F-19) to cover the whole registry rather than only `SF0001`–`SF0020`.

---

## F-06 — The lazy/demand-driven decode contract is a stub (major)

**Rule:** `IMPL-020-R004` (with §3's `TagPayload`) · **File:** `packages/swf/src/container/open.ts:93`,
`:120`–`:125`, `:166`

**Specification** (`020:139`):

> **IMPL-020-R004** `readTag()` MUST be idempotent and memoised by `TagRef.index`; two calls for the same
> tag MUST NOT decode twice, and MUST return the identical object (this is what makes the pipeline's
> lazy, demand-driven decode affordable).

and §3's payload union: `{ kind: 'bytes' } | { kind: 'decoded'; value: unknown } // memoised decode by
the owning module | { kind: 'skipped'; … }`. `SwfOpenOptions.indexStrategy` is documented as "Whether to
build the full tag index eagerly (default) or stream it on demand" (`:69`).

**What the code does.** Three gaps: `indexStrategy: 'lazy'` short-circuits to `emptyIndex()` with zero
definitions, no sprite ranges and no diagnostics (`:93`–`:94`); `readTag()` always fabricates
`{ kind: 'bytes', view }` (`:123`) so `kind: 'decoded'` is never produced and no owning module ever gets
a memoised decode; and the not-a-SWF sentinel returns
`{ kind: 'skipped', reason: 'not-requested' }` (`:166`), which is a third meaning for the same word and
is *not* a `not-requested` case. The memoisation itself is correct — same `TagRef.index` returns the
identical object — so only the decoded-payload half of the rule is missing.

**Impact.** The stated purpose of the rule (affordable demand-driven decode) is unmet, and the `lazy`
option silently produces a file with no characters, which is worse than not offering it: a consumer that
sets it today gets an empty model and no diagnostic.

**Fix.** Either implement the lazy index (tag framing only, `definitions` filled from the control pass)
or remove the option and delete `TagPayload`'s unused variant until the decode stage exists; if
implemented, route stage decoders through `readTag` so `kind: 'decoded'` is produced once per
`TagRef.index` (`T-SWF-018`).

---

## F-07 — `kind: 'missing'` placeholder and `SF0110` do not exist (major)

**Rule:** `IMPL-020-R029` · **File:** `packages/swf/src/model/types.ts:120` (character union),
`packages/swf/src/tags/place.ts`

**Specification** (`020:313-315`):

> **IMPL-020-R029** A referenced-but-undefined character id MUST produce a placeholder character
> (`kind: 'missing'`) so that timeline and event semantics still see a named object at the right depth
> (design SWF-R024), with `SF0110` (warning) naming the referencing tag.

**What the code does.** `CharacterModel` has no `kind` discriminator at all (only `id`, `tagCode`,
`tagName`, `index`, `sprite`), and `SF0110` is never emitted from anywhere (`02-conformance.md` §2).
A `PlaceObject` naming an id that no definition provides yields a placement whose character reference
is simply absent, with no diagnostic. Doc 030 §8 defines the same code, and doc 100 (buttons) cites it,
so the rule is load-bearing for two later documents.

**Impact.** A broken or stripped dictionary produces a silently incomplete model — the exact failure
mode the rule exists to prevent, because timelines and event handlers would see `undefined` where the
player sees an empty object at a known depth.

**Fix.** Add the `'missing'` kind (or an equivalent placeholder record) to the character model, create it
from the placement path in `tags/place.ts`/`model/timeline.ts`, and emit `SF0110` once per referencing
tag with the id and offset. `T-SWF-007` covers the referenced-but-undefined case.

---

## F-08 — `bits > 32` takes neither documented branch (major)

**Rule:** `IMPL-010-R008` · **File:** `packages/swf/src/io/cursor.ts:352`–`355`

```ts
352  ub(bits: number): number {
353    if (bits === 0) return 0;
354    if (bits > 32) {
355      this.emit(Codes.BIT_WIDTH_TOO_WIDE, 'warning', `bit field width ${bits} > 32 requested`);
356      bits = 32;                      // …then reads 32 bits from the stream
```

**Specification** (`010:187-190`):

> **IMPL-010-R008** Bit readers MUST reject `bits > 32` with `SF0003`-class strictness (error in strict
> mode, zero + `SF0014` in soft mode). No structure in AVM1-era SWF uses more than 32 bits in one field;
> a request for more indicates a corrupted length field, and silently reading 60 bits would desynchronise
> the whole parse.

**What the code does.** It warns with the *wrong* code (`SF0016`, "bit-field width > 32 requested" —
which the §8 table also assigns to this rule but whose meaning the table's own wording ties to strict
rejection) and then reads 32 bits. In soft mode the doc wants `0` plus `SF0014`; in strict mode it wants
an error. The current behaviour consumes stream bytes in a case the doc says must not consume any.

**Impact.** A corrupt `NumBits` that the doc calls out as *the* desynchronisation hazard still
desynchronises the parse, and strict mode (tests, fuzzing) does not fail.

**Fix.** Follow the mode table: strict → throw `SwfReadError` with `SF0014`/`SF0016` as the doc's §8 row
settles; soft → emit `SF0014` (`info`) and return `0` without touching the cursor. Also accept `bits < 0`
defensively. `T-SWF-016` (strict) and `T-SWF-015` (soft recovery) cover the shape of the test.

---

## F-09 — `SF0183` and `SF0185` are dead codes (major)

**Rule:** `IMPL-060-R005`, doc 060 §8 · **File:** `packages/swf/src/tags/shape.ts:546`
(`decodeDefineShapeVersion`), `:216` (style arrays)

**Specification** (`060:91`):

> **IMPL-060-R005** `DefineShape4` MUST be accepted in files declaring SWF < 8 with `SF0183` (info); the
> player tolerates newer tags in older files, and refusing them breaks real content.

and §8 `:414`:

> `SF0185` | info | empty subpath (move-to with no edges) dropped

**What the code does.** `decodeDefineShapeVersion` never consults `c.version`, so a `DefineShape4` in a
SWF 5 file is decoded silently; `SF0183` is in the never-emitted set. Separately, nothing detects or
drops a move-to with no following edges, so `SF0185` is never emitted either and an empty subpath
reaches the IR (the doc pairs the diagnostic with the drop: "they MUST be dropped with an info
diagnostic (`SF0185`) and MUST NOT create zero-area paths", `:317`).

**Impact.** Both are tolerances that exist to explain real content: without `SF0183` a pre-8 file with
Shape4 content looks clean while its flag semantics may not be honoured by the declared version, and
without `SF0185` the renderer may receive degenerate subpaths that `packages/gfx` must drop by other
means (it does drop degenerates, so the impact today is a missing diagnostic rather than wrong pixels).

**Fix.** In `decodeDefineShapeVersion`, compare the tag's minimum version with `c.version` and emit
`SF0183` once per file when the tag is newer; in the shape-record loop, close a move-to run with zero
edges into an `SF0185` info instead of pushing an empty path. Both belong to `T-MOD-112`/`T-MOD-116`.

---

## F-10 — Soft out-of-bounds post-condition and `subCursor` clamping (minor)

**Rule:** `IMPL-010-R009` (mode table) and `R011` · **File:** `packages/swf/src/io/cursor.ts:150`–`157`
(`#outOfBounds`), `:87`–`89` (`subCursor`)

**Specification** (`010:199`):

> `soft` (parser default) | append `SF0013` (warning) with the requested size and the enclosing context,
> return `0`/`''`, and leave the cursor at `limit`

and (`010:206-208`):

> **IMPL-010-R011** `subCursor(length)` MUST clamp `length` to the remaining bytes, record `SF0013` when
> it clamps, …

**What the code does.** `#outOfBounds` warns and throws in strict mode but never moves `#pos` to
`limit`, so the documented post-condition does not hold; a caller that loops on remaining bytes and
reads a multi-byte field at the tail can make no progress. `subCursor` computes
`end = Math.min(this.limit, start + Math.max(0, length))` and clamps silently — no `SF0013` — so an
over-long sub-cursor (a common symptom of an over-declared tag body) is invisible.

**Impact.** Diagnostic-only in both cases, plus a theoretical non-termination path in a consumer that
trusts "cursor is at limit after a soft violation". `R010` (cursor stays usable) is satisfied by the
current code, so the fix must not throw.

**Fix.** Set `#pos = this.limit` at the end of `#outOfBounds` (the doc's literal reading) after recording
the diagnostic, and emit `SF0013` in `subCursor` when `start + length > this.limit`, with the requested
and clamped sizes in the message.

---

## F-11 — `SF0009` registry severity disagrees with the only sentence that assigns one (minor)

**Rule:** `IMPL-010` §8 · **File:** `packages/swf/src/diagnostics/codes.ts:128`

| Source | Severity |
| --- | --- |
| Registry (`codes.ts:128`) | `warning` |
| Doc 010 §8 row (`:505`) | "warning / info" (ambiguous by design) |
| Doc 010 `:242` — the case the code implements ("reported once per movie with `SF0009` (info), because they are a fingerprint of a misbehaving writer") | `info` |
| Call site (`io/cursor.ts:313`, `EncodedU32` overlong) | `info` |

**Impact.** Same class as F-05 but with a doc-side contributor: the §8 row allows two severities, so the
registry cannot be machine-checked against it. `info` is right for the fingerprint case, and the
implementation is correct.

**Fix.** Narrow the §8 row to `info` (with a note that a future strict-mode overlong remains `warning`),
set the registry row to `info`, and keep `cursor.ts` as is.

---

## F-12 — Doc 020 §8 contradicts `IMPL-020-R028` (minor, documentation defect)

**File:** `docs/impl/foundation/020-container-tag-stream-dictionary.md:404`

The §8 diagnostics table says:

> `SF0109` | warning | duplicate character id (**first** definition wins)

while `R028` (`:309`) says "the **last** definition wins for lookups … and the first definition remains
reachable through `entries()`". The code follows the table, not the rule (F-04), so the table is the
sentence a reader would trust. This is a documents defect: the fix is to correct the §8 row to
"duplicate character id (last definition wins; first kept as shadowed entry)" so the two places agree and
the machine-checkable tables stop contradicting the prose.

---

## F-13 — Sprite timelines ignore the declared `FrameCount` (major)

**Rule:** `IMPL-030-R033` (and doc 020 `R024`) · **File:** `packages/swf/src/model/movie.ts:253`
(`padToDeclared: false`), compared with `:291` (`padToDeclared: true`)

**Specification** (doc 020 `:260-262`):

> **IMPL-020-R024** A `ShowFrame` count that disagrees with the sprite's declared `FrameCount` MUST be
> reported as `SF0023` (warning) with the sprite id; the declared value wins for model construction
> (missing frames are empty, extra frames are appended) because timelines index by declared length.

and doc 030 `:267`:

> **IMPL-030-R033** `ShowFrame` count vs the declared `FrameCount` follows doc 020's policy (`SF0023`;
> declared value wins). Extra `ShowFrame`s are appended as empty frames.

**What the code does.** The main timeline pads to the declared count (`padToDeclared: true`), but every
sprite is assembled with `padToDeclared: false`, and the comment on the sprite model's
`declaredFrameCount` field reads "ShowFrame count wins, doc 020 policy" — the opposite of both documents
and of the sibling call three functions later. `SF0023` is emitted in both paths, so only the padding
differs.

**Impact.** A sprite whose declared `FrameCount` exceeds its `ShowFrame` count — legal, and common when
frames are emitted by a tool that counts differently — ends up shorter than the player's timeline.
Anything indexed by declared length (`_totalframes`, frame-driven state, label remapping) is off by the
missing frames. Because the two paths disagree, one of them must be wrong, and the docs name the sprite
path.

**Fix.** Pass `padToDeclared: true` for sprites and correct the comment. If the team decides observed
wins instead, then doc 020 `R024`, doc 030 `R033` **and** the main-timeline call must change together —
but the documents as written are unambiguous, so the code change is the conformant one. `T-MOD-601`
already covers "declared-vs-observed frames".

---

## F-14 — Scene table field name and missing remap (minor)

**Rule:** `IMPL-040-R011` · **File:** `packages/swf/src/model/types.ts:119`,
`packages/swf/src/model/movie.ts:177`

**Specification** (`040:111-114`):

> **IMPL-040-R011** `DefineSceneAndFrameLabelData` MUST produce a scene table (`{name, frameOffset}[]`,
> offsets zero-based and global to the timeline) and a **frame remap** from scene-relative to absolute
> frame indices. `TimelineModel.frames` stays absolute; `nextScene`/`prevScene` compute from the scene
> table at runtime (emitted as data, doc 120).

**What the code does.** The model exposes
`scenes: readonly { readonly name: string; readonly startFrame: number }[]` — the documented field name
is `frameOffset` — and no remap is produced anywhere; the later clauses ("`nextScene`/`prevScene` compute
from the scene table at runtime") are satisfied by the offset alone, which is why this is minor. The
zero-based/global encoding itself is decoded correctly (`decodeSceneAndFrameLabelData`, doc 040 table
row 11).

**Fix.** Rename to `frameOffset` for consistency with the document, or amend the document if `startFrame`
is the better name — but do one of the two, and record the decision, since doc 120 will emit this shape
as data.

---

## F-15 — `SF0190` ceiling fires without the duplicate condition (minor)

**Rule:** `IMPL-060-R041` · **File:** `packages/swf/src/tags/shape.ts:216`–`223`

**Specification** (`060:426-428`):

> **IMPL-060-R041** `SF0190` is the **dedupe ceiling**: when a style array has ≥ 250 entries *and*
> byte-identical styles, we keep the array verbatim (indices must not shift) and report; a later, opt-in
> dedupe pass (WP-060-13) may rewrite indices only when the whole shape is reprocessed as a unit.

**What the code does.** Emits when `count >= 250`, with no duplicate check, and only from
`readFillStyleArray` — the line style array has no equivalent branch, although the rule says "a style
array". The threshold is also a literal (`250`) with no named constant.

**Impact.** Diagnostic precision and report noise: a 250-entry array with all-distinct styles is not a
dedupe candidate and should not warn. The message says "at the dedupe ceiling", which is accurate.

**Fix.** Compute a cheap duplicate check (a set of serialised style keys) and require it before emitting;
extract the ceiling as a named constant; add the same branch to `readLineStyleArray`. No behaviour change
beyond the diagnostic.

---

## F-16 — `SF0166` never emitted (minor)

**Rule:** doc 040 §6/§8 · **File:** `packages/swf/src/model/timeline.ts:110`

**Specification** (`040:188`):

> exported by `tab-index.ts` and report `SF0166` (info) when it returns false — the tag is *not* an
> error

and §8 `:412`: `SF0166 | info | SetTabIndex at a depth with no character (ignored, per Ch.4)`.

**What the code does.** `SetTabIndex` is decoded into `SetTabIndexOp { depth, tabIndex }` with no check
against the display-list depth, so a tab index for an empty depth is silently accepted and `SF0166` is
never emitted. The "returns false" helper (`tab-index.ts`) does not exist yet.

**Impact.** One missing info diagnostic; a later consumer would apply a tab index to a depth that has no
character. Behaviourally harmless today.

**Fix.** When the display-list model exists (doc 030's placement pass), resolve the depth and emit
`SF0166` for a miss; until then, mark the check in the code as deferred to avoid the code reading as
"decided".

---

## F-17 — Documented CLI flags do not exist (minor)

**Rule:** `SWF-D03` / `specs/format/030:66`, `:397`; cited in `specs/reference/110:1086` ·
**Files:** `apps/decompiler/src/cli.ts`, `src/commands/*`

**Specification** (`specs/format/030:66`):

> both cases continue under `--tolerate-length`, which is the default; `--strict` turns them into …

**What the code does.** `parseArgs` recognises only `VALUE_FLAGS = new Set(['--out'])` plus the verbs;
`grep -rn "tolerate-length\|--strict" apps/` returns nothing. The *behaviour* is implemented (wrong
`FileLength` warns and continues, `SF0004`/`SF0005`/`SF0028`), which is why this is minor: the documented
opt-out is absent, so a user cannot make a length mismatch fatal.

**Impact.** A documented interface is missing; no wrong output. `TECH-SPEC` §7.1's per-verb flag list
should be re-checked at the same time, since it lists the CLI's flags as a contract.

**Fix.** Add `--strict` (fatal length mismatch, and strict-mode cursors where the reader supports it) and
`--tolerate-length` (the default, accepted as a no-op for symmetry) to `parseArgs`, record them in the
`USAGE` text, `apps/decompiler/README.md` and `TECH-SPEC` §7.1, with a CLI test asserting exit 1 for
`--strict` on a wrong-length file.

---

## F-18 — The numeric IO test obligations have no tests (minor)

**Rule:** `IMPL-010` §10 · **Files:** `packages/swf/test/` (no `io`-level test file)

`docs/impl/foundation/010` §10 defines `T-SWF-004` ("primitive vectors below, exact equality"),
`T-SWF-013` (`MATRIX` +90°), `T-SWF-015` (soft-mode recovery) and `T-SWF-016` (strict throw). The
`packages/swf/test` directory contains fixture, framing, diagnostics, model and shape-runs tests — no
test file exercises `io/cursor.ts` or `io/bits.ts` directly. The three vectors the document names
explicitly (`sb(32)` for `0x7FFFFFFF`/`0x80000000`/`0xFFFFFFFF`; `fb(19) 0x30000 → 3.0`;
`decomposeMatrix` +90° → right-down) are therefore unverified except indirectly through fixture parses.

**Impact.** F-08 and F-10 are defects in exactly the code this gap leaves untested; the indirect
fixture tests cannot pin a numeric vector's exact value.

**Fix.** Add `packages/swf/test/io.test.ts` implementing `T-SWF-004`/`013`/`015`/`016` from the §10
table, starting with the four vectors above, and cite the ids in the test names (`TECH-R009`).

---

## F-19 — The severity regression test covers 20 of 87 codes (minor)

**Rule:** `TECH-R009` (rule/test linkage) · **File:** `packages/swf/test/diagnostics.test.ts:27`–`31`

The test named "keeps the SF0001-SF0020 IO/header range at the documented severities" asserts four
individual codes (`SF0001`, `SF0002`, `SF0013`, `SF0020`) despite its name. No test compares the registry
against the owning impl doc's §8 tables, which is why F-05 and F-11 shipped.

**Fix.** Make the registry itself the test: export the §8 tables' `(code, severity)` pairs from a single
source of truth (or parse the doc tables in a test-only helper) and assert the whole registry matches,
plus a "every registry code is emitted or explicitly deferred" check to keep O-01 from growing silently.

---

## F-20 — `fixedFromSigned()` is dead code (minor)

**Rule:** — (dead-code hygiene) · **File:** `packages/swf/src/io/bits.ts:19`

`export function fixedFromSigned(value: number, bits: number): number` is an identity helper with no
caller anywhere in `src`, `apps` or `test` (`grep -rn fixedFromSigned` matches only its definition and
the build output). It sits on the public barrel `packages/swf/src/index.ts`, so it is also part of the
package's API surface for no reason.

**Fix.** Delete it, or give it the meaning its name implies (signed fixed-point conversion) and a test.

---

## O-01 — Seventeen registry codes are never emitted or matched (observation)

Excluding `codes.ts` itself, 70 of the 87 codes are referenced; the following 17 are not:
`SF0006`, `SF0025`, `SF0026`, `SF0027`, `SF0110`, `SF0111`, `SF0115`, `SF0118`, `SF0119`, `SF0121`,
`SF0122`, `SF0125`, `SF0127`, `SF0166`, `SF0183`, `SF0185`, `SF1000`.

Most are legitimately unimplemented and owned by a roadmap item (`02-conformance.md` §2 maps each to its
WP). Three are *not*: `SF0006`'s case is reachable today (F-03), `SF0110`'s is reachable today (F-07),
and `SF0166`/`SF0183`/`SF0185` are reachable in the implemented shape/tab readers (F-09, F-16). Nine of
the 17 have no `WP-` item at all, which is how a code drifts from "planned" to "forgotten". The audit
recommends a generated coverage table (the `docs/impl/registers/STATUS.md` generator already knows how
to walk the docs) so the set is reported on every build rather than discovered by audit.

## O-02 — Test-id traceability is 10 of 382 (observation)

382 distinct `T-XXX-nnn` ids are defined across `docs/specs` and `docs/impl`; **10** are cited in code or
tests (`T-GFX-001`, `T-GFX-002`, `T-GFX-015`, `T-TST-101`, `T-MOD-021`, `T-MOD-037`, `T-MOD-038`,
`T-MOD-039`, `T-MOD-040`, `T-SWF-003`). `TECH-R009` requires every behavioural requirement to carry a
rule id **and** a test id, so the mechanism exists but is not being applied as the code grows — the
slices that were written with ids (`dump`, some gfx oracles) are the exception. This is the process cause
behind F-18/F-19 and should be treated as a standing requirement for the P5 AVM1 slice onward.

## O-03 — The review gates cannot see code (observation)

`tools/verify_docs.py` scans `docs/**`, the root `README.md` and `TECH-SPEC.md`; `eslint` (non-type-aware)
and `prettier` are the only code gates, and `pnpm typecheck && pnpm test` are green while all 20 findings
are live. The doc gate even carries a two-entry historical allowlist (`T-MOD-201`, `T-RT-020`), which is
correct for the doc set but reinforces the same point: a green gate is not conformance evidence. The
audit's evidence is the probe scripts and the registry scan in this folder, not the CI status.
