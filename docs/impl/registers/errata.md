# Errata and cross-document corrections

Divergences found while implementing against the SWF File Format Specification v19, or between our
own documents. Each entry names what is wrong, our resolution, and the test that encodes the
resolution. Entries are never deleted; they are closed with a reference.

**Policy:** where an upstream *worked example* contradicts upstream *field definitions*, the field
definitions win. Where upstream text contradicts an *observable behaviour* that the oracle harness can
measure, the measurement wins and the entry stays open until it is recorded here.

---

## E-001 — Ch.1 `RECT` worked example swaps Xmin and Xmax

**Found in:** Ch.1, "Using bit values", the worked `RECT` example.
**What it says:** the derivation states `Xmin = 127`, `Xmax = 260`, then presents the encoded fields
as `Xmin = SB[11] = 00100000100` and `Xmax = SB[11] = 00001111111`.
**What is wrong:** `00100000100₂ = 260` and `00001111111₂ = 127`, so the two encoded values are
labelled the other way round. `Nbits = 11` and the `Y` fields (`15`, `514`) are correct.

**Resolution:** the field *definitions* in the same section (order: `Nbits`, `Xmin`, `Xmax`, `Ymin`,
`Ymax`) are authoritative. Our decoder reads in that order, with `Xmin ≤ Xmax` **not** assumed (a
negative-width rect is malformed input, reported as `SF0111`, not corrected).

**Encoded by:** `T-SWF-004` (primitive vectors) includes this rect as `Nbits=11,
Xmin=127, Xmax=260, Ymin=15, Ymax=514` and asserts the 11-bit patterns per the *values*, not per the
example's labels.

---

## E-002 — Diagnostic code range violation in design spec `030-swf-format-and-io.md`

**Found in:** our own design specs, SWF-R013/R014/R042.
**What it said:** tag-stream and nesting conditions were assigned `SF0010`, `SF0011`, `SF0012`
(also `SF0013` in APP-§2), but CMP-§9.3 reserves `SF0001–0099` for IO/container/compression and
`SF0100–0199` for tags/shapes/dictionary.
**Resolution:** renumbered in place to `SF0101` (tag length exceeds file), `SF0102` (missing `End`),
`SF0103` (sprite nesting depth), `SF0104` (unknown tag skipped). The authoritative registry is
`docs/impl/foundation/010-binary-io-and-records.md` §7, which also allocates the remaining IO-range codes.

**Encoded by:** `T-SWF-010` asserts that every diagnostic emitted by the parser is inside its
documented range.

---

## E-003 — Diagnostic naming example in `010-repository-and-toolchain.md`

**Found in:** our own design specs, REPO-§4 (naming table).
**What it said:** the example code was `SF1024`, which lives in the reserved `SF1000+`
fatal-only range, and the placeholder was written `SF<sss>` (wrong digit count).
**Resolution:** corrected to `SF####` with the example `SF0501` (emitter range).

---

## E-004 — Ch.1 `FLOAT16` exponent bias

**Found in:** Ch.1, "Floating-point numbers".
**What it says:** `FLOAT16` is "identical to the characteristics of FLOAT except … 5 bits for the
exponent, with an exponent bias of 16", while also stating that SWF 8+ floats are IEEE 754
compatible.
**What is wrong:** IEEE 754 binary16 uses an exponent bias of **15**; with a bias of 16 the
representation would be neither IEEE-compatible nor able to represent the documented range
(max finite ≈ 65504, which requires `2^15`).
**Resolution:** implement IEEE 754 binary16 (bias 15, subnormals `2^-14 × m/1024`, exponent 31 =
Inf/NaN) and treat the "bias 16" sentence as a documentation error.

**Re-opened and corrected 2026-10-13**, under this entry's own clause. The resolution originally
continued: *"`FLOAT16` does not appear in any AVM1-era tag we parse, so the risk is contained; if a
future chapter shows a structure that consumes it, this entry gets re-opened and the consuming
structure gets a fixture."* That sentence is **wrong**, and the condition it set is met:

- `DefineFontAlignZones` (tag 73, SWF 8+) carries `ZONEDATA` = `AlignmentCoordinate FLOAT16`,
  `Range FLOAT16` (`specs/110`, `IMPL-080-R035` → doc 080, P3 **Completed**).
- Tag 73 is inside the AVM1-era set this project parses — AVM2 content is rejected outright by
  `SF1000` — and it is decoded in production: `packages/swf/src/tags/fonts.ts:599–600` calls
  `c.float16()` twice inside `decodeFontAlignZones`.
- The fixture the clause asked for already exists: `packages/swf/test/font-aux-tags.test.ts` writes
  raw `FLOAT16` bit patterns and asserts `0x3C00 → 1.0`, `0x4000 → 2.0`.

The **bias-15 resolution itself is unaffected**, and is now corroborated by a working decoder over real
tag data rather than resting on the claim that nothing consumed the type. Recorded in `IMPL-010` §8's
primitive-consumer register, which closes `IMPL-010` §10 item 3 (v1.6) — the answer is positive, the
opposite of the expectation this entry was written against.

One consequential note: `specs/110` §2 dispositions tag 73 as `I` ("ignore with an `info` diagnostic")
while production decodes and records it verbatim per `IMPL-080-R035`, and `tools/tag_coverage.py`
reports it `decoded`. That wording belongs to whichever document owns the claim; it does not affect the
`FLOAT16` conclusion above.

**Encoded by:** `T-SWF-004` includes `0x3C00 → 1.0`, `0x3E00 → 1.5`, `0x0001 → 2^-24`,
`0x7C00 → +∞`, `0xFC00 → −∞`, `0x7E00 → NaN`, `0x8000 → −0`.

---

## E-005 — Ch.1 `MATRIX` rotation sign convention (open)

**Found in:** Ch.1, "MATRIX record", the operation table.
**What it says:** for a rotation, `ScaleX = cosine`, `RotateSkew0 = sine`,
`RotateSkew1 = negative sine`, `ScaleY = cosine`, i.e. the 2×2 block reads
`[[cos, +sin], [−sin, cos]]`.
**Why it is probably not what we want:** in SWF's y-down coordinate system that block rotates
*counter-clockwise on screen*, whereas the AVM1-visible `MovieClip._rotation` is documented (and
observed in every clock-hand example) as increasing **clockwise**. A shape authored at
`_rotation = 90` renders with its top pointing right, which requires the block
`[[cos, −sin], [+sin, cos]]`.
**Status: CLOSED (v1.5).** The chapter text settles it, and it agrees with us. Ch.1 gives the field
layout `[[ScaleX, RotateSkew0], [RotateSkew1, ScaleY]]` and the transform
`x' = x*ScaleX + y*RotateSkew1 + TranslateX`, `y' = x*RotateSkew0 + y*ScaleY + TranslateY`; with the
rotation row (`ScaleX = cos`, `RotateSkew0 = sin`, `RotateSkew1 = -sin`, `ScaleY = cos`) the matrix is
`[[cos, sin], [-sin, cos]]`. At `theta = +90 deg` it maps `(1,0)` (right) to `(0,1)`, which in SWF's
**y-down** space is *down* — i.e. a clockwise turn on screen, exactly what `_rotation` and the
clock-hand examples require. The earlier worry came from reading the block in a y-up mental model;
there is no divergence. Our committed convention (clockwise-positive,
`matrixFromRotationDegrees`) stays, and `T-SWF-013` gains the +90 deg fixture asserting the on-screen
direction.

**Encoded by:** `T-SWF-013` (rotation convention): parse a synthetic rotated `PlaceObject`, assert
the decomposed `_rotation` equals the authored angle, and assert the transformed corner positions.

---

## E-006 — Ch.2, "Processing a SWF file" and "File compression strategy" not yet reconciled

**Found in:** Ch.2 (the two sections following "The dictionary").
**Status:** the chapter text available to us ends at "The dictionary". Our processing-order model
(design spec AVM1-§3.3 and impl doc 020 §6) is derived from observed behaviour and our own design
specs. When the remaining pages are supplied, reconcile: the per-frame processing order, whether the
frame is displayed before or after that frame's actions, and the compression-level guidance.

**Encoded by:** `T-AVM1-001` (placement → actions → render) is the current pin; it will be re-derived
from the chapter text if the chapter contradicts it.

---

## E-007 — Our own design spec: long `RECORDHEADER` length description

**Found in:** `docs/specs/format/030-swf-format-and-io.md` SWF-§3.3.
**What it said:** the long-form tag length field "includes the 4 bytes itself".
**What is wrong:** the body length excludes the tag header in *both* header forms. Independent formal
grammars of the format state it explicitly ("the size does not count the tag header itself, only the
tag body"), and every mainstream parser behaves that way. Our sentence would have added 4 bytes to
every long tag's body, which is the kind of bug that presents as "bitmaps decode as noise".
**Resolution:** corrected in the design spec; the implementation contract is IMPL-020-R016.

**Encoded by:** `T-SWF-003` (a 63-byte body encoded in long form must parse with `length === 63`).

---


---

## E-008 — Ch.3 `PlaceObject3` field table ties `BackgroundColor` to the wrong flag

**Found in:** Ch.3, `PlaceObject3` field table (pp. 42–43).
**What it says:** the field row reads `Background Color | If PlaceFlagHasVisible | RGBA`, i.e. the
4-byte colour is consumed whenever the *visibility* flag is set.
**What is wrong:** the same table's own flag list has a separate `PlaceFlagOpaqueBackground` bit
("Has opaque background. SWF 11 and higher"), and real SWF 11+ content sets `HasVisible` without
`HasOpaqueBackground` (placing a visible object needs no backing colour at all). A decoder that follows
the field table consumes four bytes that are not there and then mis-parses the rest of the tag —
typically turning `ClipActions` into garbage.
**Resolution:** `BackgroundColor` is read **iff `PlaceFlagOpaqueBackground` is set**, after `Visible`.
A tag with `HasVisible` but no `HasOpaqueBackground` consumes nothing and reports `SF0123` (info). We
never emit the ambiguous form.

**Encoded by:** `IMPL-030` §4.4 (`T-MOD-010` in doc 030 — "HasVisible-only must not consume 4 bytes").

---

## E-009 — Filter units: blur/distance are 16.16 FIXED **pixels**; `Strength` is FIXED8 with 1.0 = `0x0100`

**Found in:** our own design spec `docs/specs/web/050-graphics-webgl.md` `GFX-R081`/`GFX-R086`, reconciled
against Ch.3's filter sections (pp. 46–48).
**What it said:** `GFX-R081` scaled blur as `blurValue / 20` ("SWF stores blur in twips"), and
`GFX-R086` applied `Strength` as a percentage (`strength/100`).
**What is wrong:** the chapter's blur is a *sub-pixel box/median filter* in pixel space ("the filter
window is always centered on a pixel"; `BlurX`/`BlurY` are described as odd *pixel* counts), and the
drop shadow section states outright that "the distance is measured in pixels". Nothing in the filter
sections uses twips. `Strength` is `FIXED8` and the chapter is explicit: "the strength of the shadow
normalized is 1.0 in fixed point; the strength value is applied by multiplying each value in the shadow
pixel plane" — so the gain is `value / 256` (1.0 = `0x0100`), never a percentage.
**Resolution:** corrected both requirements in the design spec (no 1/20 factor; gain = `strength/256`).
The tag → AS surface → renderer chain carries pixel units only; the implementation-side contract lives
in `IMPL-030-R019`/`R020`.

**Encoded by:** `IMPL-030` §5 and its `T-MOD-005` (FIXED/FIXED8 units asserted through all eight
filter layouts).

---

## E-010 — Ch.3 `PlaceObject` v1 `CharacterId = 0` used as a "move" (documented deviation)

**Found in:** Ch.3, `PlaceObject` (p. 36) and `PlaceObject2`'s comparison table.
**What it says:** `PlaceObject` *adds* a character; the `Move` flag and the modify-existing-character
form only arrive with `PlaceObject2`.
**What is wrong:** SWF 3-era content (and some authoring tools' exports) emits v1 tags with
`CharacterId = 0` meaning "modify the character already at this depth". Following the chapter literally
would create a bogus character 0 at that depth and leave the existing instance untouched.
**Resolution:** tolerate the form, treat it as a move (attributes present are applied; no new instance,
no `onLoad` re-fire), report `SF0117` (info), and **never generate it**. This is a documented deviation
from the chapter, not an upstream erratum.

**Encoded by:** `IMPL-030` §4.1 (`T-MOD-001`).

---

## E-011 — Our own documents placed diagnostics outside their declared ranges

**Found in:** `docs/specs/foundation/020-compiler-pipeline.md` §9.3 (the authoritative range table) versus
`docs/specs/web/080-runtime-shell.md` and `docs/impl/decompiler/060-shapes-and-gradients.md`,
`docs/impl/decompiler/110-video.md`.
**What it said:** the range table assigns `SF0200–0299` to bitmaps/fonts/video, `SF0500–0599` to the
emitter/codegen and `SF0600–0699` to the runtime contract; the shell doc used `SF0201` for a WebGL2
capability failure (a runtime condition), the shape doc allocated `SF0600–0609` (runtime range) and the
video doc `SF0500–0508` (emitter range).
**What is wrong:** two different conditions would eventually share a code, and the registry's promise of
one meaning per code would be broken.
**Resolution:** shell doc `SF0201` → `SF0631` (runtime); shapes `SF0600–0609` → `SF0180–0189`
(tag/shape range); video `SF0500–0508` → `SF0240–0248` (media range). `IMPL-010` §7 now carries the
per-document sub-allocation table for `SF0100–0199` and `SF0200–0299` so the next allocation is checked
against one place.

The same pass found the audio range double-booked: `IMPL-090` had re-used `SF0301`–`SF0309` with
different meanings than the audio design spec (`docs/specs/web/060-audio-web.md`) already published for
those codes. The design spec's meanings were kept (it is the upstream allocation) and the
implementation-only conditions moved to the next free block, `SF0324`–`SF0329` (`IMPL-090` §7),
leaving the design spec's runtime conditions in `SF0320`–`SF0323` untouched.

**Encoded by:** `IMPL-010-R0xx` registry rule (§7) and the range check in the `impl-status` tool
(`WP-140-08`), which fails if two documents allocate the same code.

---

## E-012 — Ch.5's `PushDuplicate`/`StackSwap`/`StoreRegister` prose is written from the stack's point of view

**Found in:** SWF Spec 19, Ch.5 (PDF pp. 106–107), sections *ActionPushDuplicate*, *ActionStackSwap*,
*ActionStoreRegister*.
**What it says:**
- *ActionPushDuplicate* — "pushes a duplicate of top of stack (the current return value) to the stack".
- *ActionStackSwap* — "swaps the top two ScriptAtoms on the stack", described as "1. Pops `Item1` and
  then `Item2` off of the stack. 2. Pushes `Item1` and then `Item2` back to the stack."
- *ActionStoreRegister* — "stores it in one of four registers. If `ActionDefineFunction2` is used, up
  to 256 registers are available."

**What is wrong:** read as *net stack effects* rather than as narration, all three descriptions invert
or contradict the obvious intent. `ActionPushDuplicate` grows the stack by one (1→2) but the
parenthetical "(the current return value)" is an example artefact, not a restriction.
`ActionStackSwap`'s numbered list reads as an identity operation unless the reader trusts the summary
("swaps") — the correct reading is that the value popped **first** is pushed back **last**, so the two
items exchange places. `StoreRegister`'s "four registers" describes the SWF 4-era convention; with
`DefineFunction2` the register count is `RegisterCount` (UI8), and the chapter's "up to 256" is its own
off-by-one (indices are 0…255, i.e. 256 slots, with the count itself in a `UI8`).
**Resolution:** all three are treated as stack-effect definitions in `IMPL-050-§4`/§5.3 (§4: 1→2 for
`PushDuplicate`, 2→2 for `StackSwap`, 1→1 for `StoreRegister`; the latter *reads without popping*), the
"four registers" prose applies only where no `DefineFunction2` register file is in scope, and the
`PushDuplicate` parenthetical is not modelled. The same pass also notes that
`ACTIONRECORDHEADER.Length`'s comment ("the number of bytes in the `ACTIONRECORDHEADER`, not counting
the `ActionCode` and `Length` fields") really means the *payload* length, since the header itself is
exactly the two or four bytes it excludes.
**Encoded by:** `IMPL-050-R003`, `IMPL-050-R025`, `APP-§10.3`, and tests `T-AVM1-FE-001`/`T-AVM1-FE-002`/`T-AVM1-FE-015`.

---

## E-013 — Ch.7 gradient flags are one shared byte, and the chapter's own limits contradict its field widths

**Found in:** Ch.7 (PDF pp. 136–138), `GRADIENT` and `FOCALGRADIENT` field tables, and our `IMPL-060` v1.0
§4.3 / design spec `GFX-R041`–`R047`.
**What it says / what is wrong:**
- The chapter defines `SpreadMode UB[2]`, `InterpolationMode UB[2]` and `NumGradients UB[4]` as three
  separate field *rows* but they are the **same byte**, so it "cannot exceed 8" prose (Shape1/2/3) and
  the "1 to 15" column (Shape4) only make sense when read as one packed byte, MSB-first.
- A `NumGradients` of `0` is outside the documented `1..15` range and is not discussed.
- The `FOCALGRADIENT` `FocalPoint FIXED8` encodes `-1.0` as `0xFF00`, i.e. a signed 8.8 value; read as an
  unsigned fraction it becomes `255.0`.
- The chapter requires `SpreadMode = 0`/`InterpolationMode = 0` for Shape1/2/3, but later toolchains
  write non-zero modes there.

**Resolution:** one shared flags byte read identically in all shape versions (`IMPL-060-R013`); legacy
non-zero modes are honoured with `SF0192` (never silently replaced); `NumGradients == 0` renders nothing
(`SF0193`, fill dropped, stream alignment preserved); the focal point is decoded as a signed 8.8 value
clamped to `[-1, 1]` at the sampler and is Shape4-only (`SF0195`); gradient records are sorted by ratio
for the IR with out-of-order/duplicate ratios reported (`SF0194`).

**Encoded by:** `IMPL-060-R013`–`R022`, `APP-§10.5`, tests `T-MOD-119`–`122`.

---

## E-014 — Ch.8: `DefineBitsLossless2` has no format 4, and premultiplication belongs to `ALPHABITMAPDATA`

**Found in:** Ch.8 (PDF pp. 139–145) and our design spec `docs/specs/web/070-assets-fonts-bitmaps-video.md`
(`AST-R006`, §3.1 source-format table) plus `IMPL-070` v1.0.
**What it said:** "`DefineBitsLossless2` … formats: 3 = 8-bit colormapped + alpha, 4 = ARGB4444,
5 = ARGB8888. Alpha is premultiplied in ARGB4444 (a classic gotcha)."
**What is wrong:** the chapter lists `BitmapFormat` values **3 and 5 only** for `DefineBitsLossless2`
(8-bit colormapped with an RGBA table, and 32-bit ARGB). The premultiplication rule is attached to the
`ALPHABITMAPDATA` field of format 5 ("The RGB data must already be multiplied by the alpha channel
value"), not to a 15-bit format; `ALPHACOLORMAPDATA` palettes are not premultiplied. `IMPL-070` v1.0
carried the same error into its format list.
**Additional Ch.8 facts that superseded assumptions in both documents:** `AlphaDataOffset` is a byte
**count**; alpha is available only when the payload is a JPEG (PNG/GIF carry their own alpha); row
padding is 32-bit and depends on the pixel unit (1/2/4 bytes); `DeblockParam` is an 8.8 fixed-point
0–100 % strength, recorded but never applied; JPEG payloads may carry the pre-SWF 8 erroneous
`FFD9 FFD8` prefix and `JPEGTables` may appear at most once.

**Resolution:** `IMPL-070` v1.1 defines Lossless2 as formats 3 and 5, keeps a tolerant reader for the
observed-but-undocumented format 4 (`SF0259`, decoded as 15-bit RGB) and treats unknown formats as
quarantined errors (`SF0260`); the design spec's `AST-R006` and §3.1 table are corrected in `v1.1` to
state the premultiplication rule per field and to add the byte-count/row-padding/deblocking facts.

**Encoded by:** `IMPL-070-R008`–`R012`, `R018`, `R019`, `APP-§10.6`, tests `T-MOD-309`–`313`.

---

## E-015 — Ch.9 morph model divergences, and the `IMPL-070` diagnostic block re-allocation

**Found in:** Ch.9 (PDF pp. 146–153), `IMPL-070` v1.0, and `IMPL-010` §7's range table.
**What it said / what is wrong:**
- `IMPL-070` v1.0 modelled a morph as one interleaved edge stream, permitted differing start/end style
  counts (its `R013`), treated differing edge counts as "degenerate padding" (`R015`) and modelled a
  `hasScalingGrid` flag (`R011`). The chapter instead defines `StartEdges`/`EndEdges` as **two
  independent `SHAPE` streams** carrying the **same style-change records**, requires the **same edge
  count** in both, and gives `DefineMorphShape2` no scaling-grid member at all
  (`DefineScalingGrid` is a separate Ch.4 tag).
- The `Offset UI32` field points at `EndEdges`, but parsers must not depend on it: it is a hint.
- Our own diagnostic allocation: `IMPL-070` v1.0 claimed `SF0200`–`SF0213`, a span the design specs had
  already published codes inside (`GFX` `SF0201`/`SF0207`/`SF0210`; `AST` `SF0203`–`SF0206`,
  `SF0211`–`SF0213`, `SF0220`, `SF0230`/`SF0231`), the same class of collision as `E-011`.

**Resolution:** `IMPL-070` v1.1 rebuilds §6 around the two-stream model and the chapter's restrictions
(equal edge counts, same style-change records, same fill type/bitmap per index), treats `Offset` as a
validated hint (`SF0264`), drops `hasScalingGrid` and adds the v2 edge bounds and the two stroke flags,
and allocates a clean contiguous block `SF0250`–`SF0269` (`IMPL-070` §7, `IMPL-010` §7). Straight edges
paired with curved ones follow the chapter's *treat both as curves* rule, keeping rational twips until
tessellation (floor on control, ceil on anchor) so endpoints stay exact.

**Encoded by:** `IMPL-070-R020`–`R034`, `APP-§10.7`, tests `T-MOD-401`–`408`, and the range check in the
`impl-status` tool (`WP-140-08`), which now also fails when a document allocates a code another document
already published.

---

## E-016 — Cross-document diagnostic registry reconciliation

**Found in:** our own documents, during the Ch.7–Ch.9 pass: the design specs (Phase 1) and the
implementation docs (Phase 2) allocate the same `SF` codes to different conditions in five places.

**What was wrong (one meaning per code is the registry's promise, `E-011` / `IMPL-010` §7):**
- `specs/030` `SWF-R023`/`SWF-R024` cited `SF0121`/`SF0122` for duplicate/missing character ids, but
  `IMPL-030` owns those codes for filter ids and filter parameters.
- `specs/030` `SWF-R034` cited `SF0130` for a morph style-count mismatch, but `SF0130` belongs to the
  button range (`IMPL-100`), and Ch.9 makes the condition it described impossible (one interleaved
  style array).
- `specs/040` cited `SF0420`/`SF0421` for the `ToPrimitive` recursion guard and a prototype-chain
  cycle; `IMPL-050` defines them as block-terminator and duplicate-`DoInitAction` conditions.
- `specs/070` cited `SF0220` for a video quality gate and `SF0230`/`SF0231` for byte/atlas-page
  budgets; `IMPL-080` owns those codes for font/text conditions.
- `IMPL-020` §9's prose cited `SF0110` for a dictionary-level undefined reference while `IMPL-030`
  owns `SF0110`; the two meanings are the same condition seen from the dictionary and placement
  sides, so the citation is now stated as shared rather than renumbered.

**Resolution:** each condition keeps the code of the document that owns it, and the citing document is
corrected: `SF0121` -> `SF0109`, `SF0122` -> `SF0110` (both `IMPL-020`/`IMPL-030`), the morph clause
in `SWF-R034` -> `IMPL-070` `SF0261`/`SF0265`, `SF0420`/`SF0421` -> `SF0423`/`SF0424` (new rows in
`IMPL-050`), `SF0220` -> `SF0249` (new row in `IMPL-110`), `SF0230`/`SF0231` -> `SF0501`/`SF0502` (new
`IMPL-120` §7.1 in the emitter range). `IMPL-010` §7 now lists `SF0240–0249`, `SF0400–0424` and the
two emitter budget codes.

**Encoded by:** the `impl-status` range check (`WP-140-08`), which already fails when two documents
define the same code; this pass is the last set of exceptions it would have caught.

---

## E-017 — Ch.10 text gaps and traps (fonts and text)

**Found in:** Ch.10 and our own documents during the Ch.10 pass.

**What the chapter settles, and where our text was wrong or silent:**

- **`FontHeight` presence on `DefineEditText`.** The flag table says "fontClass and Height specified"
  for `HasFontClass`, the field table says `FontHeight` is present "if `HasFont`" only. Every shipping
  reader (Ruffle's `read_define_edit_text`, and the open-source SWF tools) reads it for
  `HasFont || HasFontClass`; reading it only under `HasFont` desynchronises the rest of the tag.
- **`TEXTRECORD` field order.** The flag listing orders the bits `…HasYOffset, HasXOffset`, but the
  field table (and every implementation) reads **`XOffset` then `YOffset`**. A reader that follows the
  flag order swaps the two offsets on every record that carries both.
- **`DefineFont`'s glyph count.** There is no count field: it is inferred as `OffsetTable[0] / 2`. The
  chapter does not say what to do when that disagrees with the shapes actually present.
- **Zero-glyph `DefineFont2`.** The chapter says the tables that depend on `NumGlyphs` are omitted, but
  files exist that still write `CodeTableOffset`; readers must tolerate both forms.
- **`DefineFontAlignZones` purpose.** The zones exist for **pixel snapping in the advanced text
  rendering engine**, not for hit testing; the earlier wording in our own Ch.10-scoping notes said
  "hit zones for device fonts" and is corrected.
- **`CSMTextSettings` cutoffs.** The prose describes the outside cutoff as the smaller one, but the
  formulas give `outside − inside = sharpness` at equal font sizes; the formulas are the actionable
  text and the prose is internally inconsistent.

**Resolution:** `IMPL-080` v1.1 reads `FontHeight` under either flag (`SF0285`, info), reads `XOffset`
before `YOffset` (`T-MOD-513`), infers `DefineFont`'s glyph count with `SF0271` on disagreement,
tolerates both zero-glyph forms (`SF0282`), records align zones as pixel-snapping metadata it does not
apply (`SF0277`), and implements the CSM formulas verbatim (`T-MOD-515`). `APP-§10.8` pins the layouts.

**Encoded by:** `IMPL-080` §3–§8, `APP-§10.8`, tests `T-MOD-506`, `T-MOD-513`–`515`.

---

## E-018 — Ch.11 text errors and gaps (sounds)

**Found in:** Ch.11 and our own documents during the Ch.11 pass.

**What the chapter settles, and where our text was wrong or silent:**

- **ADPCM framing.** `ADPCMSOUNDDATA` begins with a **2-bit** `AdpcmCodeSize` (`bits = field + 2`), not
  a byte; a packet is one header sample **plus 4095 codes** (4096 samples), and packets are
  **bit-packed with no byte alignment** (`22·channels + 4095·channels·bits` bits per packet — the same
  arithmetic FFmpeg uses for `ADPCM_SWF`). Codes are **sign-magnitude**, which is why the chapter prints
  only the lower half of the index/multiplier tables ("the upper half being an exact duplicate").
  Our `AUD-§3.2` said "byte 0: `UI8 encoding`" and "4096 codes" and byte-aligned packets — all three
  were wrong. For streams, **each `SoundStreamBlock` restarts the codec** (its own code size and fresh
  predictors; Ruffle's `AdpcmSubstreamDecoder` recreates the decoder per block).
- **`SoundSampleCount`** is a **per-channel** count: for stereo it is the number of sample pairs, not
  the interleaved frame count.
- **MP3 `ChannelMode`.** The header table prints "2" for both "dual channel" and "mono"; mono is **3**
  (errata-class typo, not a dependency of any other field).
- **`LatencySeek`.** The chapter says it "should match the first block's `SeekSamples`" but leaves the
  behaviour undefined when a writer omits it (lengths vary in the wild). We read it when present and
  otherwise trust the first block, reporting `SF0330`.
- **`StartSound2`'s prose** is a copy of `StartSound`'s and never describes the class-name field; the
  field table is authoritative (`SoundClassName STRING` replaces `SoundId`).
- **`SOUNDINFO.Pos44`** is a `UI32` 44 100 Hz sample position, not a 0…32767 grid; levels are 0…32768
  with 32768 = unity. `AUD-R042` asserted the grid and is corrected here and in `specs/060`.
- **Frame subdivision** gives worked examples (seek 343 for the second block; seek 131 with an encoder
  latency of 940) that become the acceptance vectors for our writer/emulator.

**Resolution:** `IMPL-090` v1.1 rebuilds §4.1/§6 around the corrected framing and stream rules,
`specs/060` v1.1 corrects `AUD-§3.2`, the envelope rule (`AUD-R042`) and the `SF0307` scope, and
`APP-§9`/`APP-§10.9` pin the framing and the tags.

**Encoded by:** `IMPL-090` §4–§6, `specs/060` §3.2/`AUD-R042`, `APP-§9`, `APP-§10.9`, tests
`T-AUD-102`, `T-AUD-109`, `T-AUD-113`/`114`.

---

## E-019 — Diagnostic and test-id allocation for the Ch.10/Ch.11 pass

**Found in:** our own documents: two new diagnostic blocks were needed, and the "natural" ones were
already taken.

**What was wrong:** `IMPL-080` v1.0 drew `SF0220`–`SF0234`, a span the design specs publish codes inside
(`AST` `SF0220` video-quality gate (re-pointed to `SF0249`), `SF0230`/`SF0231` byte/page budgets
(re-pointed to `SF0501`/`SF0502`)) — the same class of collision as `E-011`/`E-015`. `IMPL-090` v1.0
also used `T-AUD-001`–`012` for its own test obligations, which are the design spec's test ids.

**Resolution:** `IMPL-080` v1.1 allocates the free contiguous block `SF0270`–`SF0289` (16 codes in use;
`SF0286`–`SF0289` reserved for the font corpus work), `IMPL-090` v1.1 keeps `SF0300`–`SF0309` where the
design spec shares them and uses `SF0324`–`SF0332` for its decode-side conditions (`E-011`), and
`IMPL-090`'s test obligations move to the `T-AUD-1xx` band so a test report can never confuse them with
`T-AUD-001…027`. `IMPL-010` §7 names `050` as the owner of the fatal `SF1000+` range, and `IMPL-020` §9
now tabulates its tag-level codes (`SF0101`–`SF0109`, with `SF0105`/`SF0106`/`SF0108` unassigned).

**Encoded by:** `IMPL-010` §7, `IMPL-020` §9, `IMPL-080` §10, `IMPL-090` §8/§9.

---

## E-020 — `SF0130` reassigned; `DefineButton` v1 carries a plain `ACTIONRECORD[]`

**Found in:** Ch.12, against `IMPL-100` v1.0.

**What v1.0 said:** `DefineButton` (7) carried "v1 action condition records", and `SF0130` meant
"v1 actions present" (informational).

**What is wrong:** Ch.12's `DefineButton` body is `ButtonId UI16`, `BUTTONRECORD[]`,
`CharacterEndFlag UI8 = 0`, then a **plain `ACTIONRECORD[]`** terminated by `ActionEndFlag UI8 = 0` —
the actions run when the button is "clicked and released". There are no condition records in v1; the
conditional form (`BUTTONCONDACTION`, with `CondActionSize`, the condition bits and `CondKeyPress`) is
`DefineButton2`-only, and its framing is not what v1.0 guessed: `CondActionSize` is measured from the
start of its **own** field, a size of 0 ends the chain, and the ninth condition bit
(`CondOverDownToIdle`) sits **after** the 7-bit key code (an inference from the transition table, not
chapter text).

**Resolution:** `SF0130` is reassigned to "`BUTTONCONDACTION` chain malformed (size does not advance,
overruns the tag, or lands mid-record)"; the withdrawn "v1 actions present" meaning is dead — nothing
shipped ever emitted it. v1's single trigger is modelled as `OverDownToOverUp`, and the four
`DefineButtonSound` transitions are ordered roll-out/roll-over/press/release (0/1/2/3), *not* the
authoring tool's up/over/down order.

**Encoded by:** `IMPL-100` v1.1 §3/§4/§7, tests `T-MOD-813`–`816`.

---

## E-021 — Ch.14 `CodecID = 6` (Screen Video v2) omitted from the tag's own table; `SF0290`–`SF0299` allocated

**Found in:** Ch.14 — the `DefineVideoStream` tag description versus the Screen Video v2 section.

**What it says:** the `DefineVideoStream` `CodecID` table stops at 5 (2 = H.263, 3 = Screen Video,
4 = VP6, 5 = VP6-alpha), yet the chapter documents **Screen Video v2** in full (15/7-bit colours,
per-packet palettes, diff blocks, zlib priming) and lists codec 6 as Flash 8+. One of the two is a
chapter bug.

**Resolution:** accept `CodecID = 6` and decode Screen Video v2 (reported as `SF0290`, info, naming the
gap); the documented packet format is the authority, the enum table is the gap. `IMPL-110` v1.2
allocates `SF0290`–`SF0299` for video extensions (`SF0296`/`SF0298` spare) and `IMPL-010` §7 records the
block next to `SF0240`–`SF0249`. Appendix C's 128-colour table is the **default** palette only: a packet
that carries its own palette block is decoded against that palette for that packet alone.

**Encoded by:** `IMPL-110` v1.2 §3/§4.3/§6/§7, `APP-§10.12`, tests `T-MOD-911`/`T-MOD-912`.

---

## E-022 — Ch.15's `FileAttributes` bit names diverge from the tag description

**Found in:** Ch.15 (`FileAttributes` restatement) versus Ch.4's `FileAttributes` tag description.

**What each says:** Ch.15 lists bits 7–5 as `Reserved UB[3]}, bit 4 `HasMetaData`, bit 3
`SWFFlagsAS3`, bit 2 `SWFFlagsNoCrossDomainCache`, bit 1 reserved, bit 0 `SWFFlagsUseNetwork` — eight
bits, no `UseDirectBlit`/`UseGPU`. The tag description (SWF 10+) names bits 6/5
`UseDirectBlit`/`UseGPU` and leaves bit `0x00000004` reserved.

**Resolution:** the tag description's masks stay the decoder's truth (`IMPL-040` R031/R032); bit
`0x00000004` is decoded and reported as the **legacy SWF 9 `NoCrossDomainCache` flag** (`SF0176`, info)
and never changes behaviour — the browser's own cache and origin rules govern, recorded as decision
`SEC-D09`. Ch.15's names appear in the report, not in the masks. The same chapter also pins two bodies
v1.0 only guessed at: `DefineBinaryData` (87) = `Tag UI16` + `Reserved UI32 = 0` + `Data` to the end of
the tag (`T-MOD-036`, no type byte — the "is resizable" field v1.0 expected does not exist), and
`EnableTelemetry` (93) = `Reserved UB[16]` + optional `PasswordHash UI8[32]` (SHA-256 of the UTF-8
password; absent = opt-in to advanced telemetry). The hash is credential material: recorded as
present/absent plus a local digest, never reproduced (`SEC-§4`, `SEC-D08`).

**Encoded by:** `IMPL-040` v1.2 §3.5/§4, diagnostics `SF0175`–`SF0179`, tests `T-MOD-034`–`036`,
`APP-§10.13`.

---

## E-023 — `IMPL-130`'s test ids collided with the design spec's `T-RT-00x` block

**Found in:** our own documents, during the Ch.12–Ch.15 pass — the runtime doc's test obligations.

**What was wrong:** `IMPL-130` §10 defined `T-RT-001`–`T-RT-018`, the same ids `specs/web/080-runtime-shell.md`
§11 uses for its shell tests (boot ordering, frame-rate fidelity, `SharedObject`, error surface) — two
different suites wearing the same ids, and the runtime doc also referenced an `T-RT-020` that it never
defined (`IMPL-130` R021 and `WP-130-01`). The repository convention is that implementation docs own the
`1xx`–`9xx` bands and design specs own `001…0nn` (`IMPL-090` was banded the same way in `E-019`).

**Resolution:** `IMPL-130`'s obligations move to `T-RT-101`–`T-RT-120` (the shift preserves the mapping
and the docs' cross-references were rewritten in place); the dangling object-model test becomes the
defined `T-RT-120`. `specs/080` keeps `T-RT-001`–`T-RT-018`, which is the block the roadmap's phase map
already cites (its `T-RT-013` is the capabilities-mapping test).

**Encoded by:** `IMPL-130` v1.1 §10 (id note + table + WP deliverables).

**Addendum (2026-10-04, Appendix pass).** The same class of collision was still live between `IMPL-030`
and `IMPL-040`: the sprite/display-list obligations `T-MOD-013`–`016` sat inside `IMPL-040`'s published
`T-MOD-013`–`036` block, so two suites shared four ids. `IMPL-030`'s four tests move to
`T-MOD-601`–`604` (the free `6xx` sub-band); the ids are updated in its §10 table, its prose references,
its WP deliverable and its changelog. With that, `T-MOD` has one owner per id, and the repository's
duplicate-id check is clean without any `T-MOD` exception.

---

## E-024 — Dangling cross-document citations in the Ch.12–Ch.15 pass

**Found in:** our own documents, by a citation scan that resolves every `<DOC>-Rnnn`/`<DOC>-Dnn` token
against the document it names.

**What was wrong:** three citations pointed at identifiers that did not exist:

- `IMPL-100` cited `GFX-D21`; the graphics decision register ends at `GFX-D15` (the button hit-area
  fallback is now `GFX-D16`, added to `specs/050` §19 and the consolidated index).
- `IMPL-110` cited `RT-R062`, and no `RT` rule above `RT-R056` existed; the video runtime contract is
  now `RT-R057`–`R059` in `specs/080` §7.1.
- `IMPL-120` R020 cited `REPO-D09`; the repository register ends at `REPO-D05`. The deduplication policy
  it describes is now `REPO-D06`.

**Resolution:** each citation either got the identifier it should have had, or the missing rule/decision
was written where it belongs (design specs first, then the citation). The scan is repeatable: a citation
that cannot be resolved is a bug, not a typo to be shrugged off.

**Encoded by:** `specs/050` §19 (`GFX-D16`), `specs/080` §7.1/§12 (`RT-R057`–`R059`, `RT-D12`),
`specs/010` §11 (`REPO-D06`), `specs/110` §12 (all five new decisions).

---

## E-025 — Appendix A's worked-example tables contain typesetting defects (its bytes are correct)

**Found in:** Appendix A, "SWF Uncovered: A Simple SWF File Dissected" (pp. 223–236), `STRAIGHTEDGERECORD`
and header prose. The 79-byte fixture itself parses **exactly** (all 79 bytes consumed, `DefineShape`
body 35/35) — every defect below is in the *printed explanation*, not in the bytes.

**What was wrong:**

- `STRAIGHTEDGERECORD`'s `VertLineFlag` row is typed `SB[1]` and conditioned "If `GeneralLineFlag`".
  The field is `UB[1]` and is present when `GeneralLineFlag == 0` (the appendix's own narrative walk
  reads it correctly; Ch.6's field list is authoritative). `IMPL-060-R026` is the rule.
- The two `DeltaX`/`DeltaY` rows beneath it are both conditioned "If `VertLineFlag`", implying a
  hor/vert edge carries two deltas. It carries exactly **one**: `DeltaX` when the line is horizontal
  (`VertLineFlag == 0`), `DeltaY` when vertical (`== 1`). The narrative again reads it correctly.
- The style-change walk calls `MoveDeltaX`/`MoveDeltaY` "unsigned numbers". Both are `SB[MoveBits]`
  (Ch.6; `IMPL-060-R024`). The fixture's two values happen to be positive, so its byte walk is unaffected.
- The header prose says `FrameRate`'s "first byte … is completely ignored". The field is a 16-bit
  **8.8 fixed** value stored little-endian: `0x0C00 / 256 = 12.0`. The low byte is the *fraction*
  (`0x0680` = 6.5), not padding; `IMPL-020-R012` implements `raw / 256`. (The appendix's own arithmetic
  `0x000C → 0x0C00 → 0x0C → 12` is right for this fixture only because the fraction is zero.)
- The three bits that complete the shape-bounds rect are labelled "fill bits"; they are **alignment
  padding** (Ch.6 has no such field). The counts themselves are right: 3 there, 7 after the header
  rect, and 6 after the shape's `End` record.

**Resolution:** the tables are not copied anywhere in our documents; the bytes are encoded as the
committed fixture with a full assertion table (`IMPL-140` §2.1, `T-TST-101`/`T-TST-102`, `T-MOD-123`,
`T-SWF-022`/`T-SWF-023`, `T-MOD-604`). Appendix A's **bytes** are authoritative; its prose is not.
No reading in `IMPL-010`/`IMPL-020`/`IMPL-030`/`IMPL-060`/`IMPL-110` changes.

## E-026 — Appendix B is the tag-index authority: six invented names removed

**Found in:** our own `specs/110` §2, by a machine comparison against Appendix B (the reverse tag index).

**What was wrong:** the disposition table listed 71 codes; Appendix B lists **65**. Six rows carried
plausible-sounding names that appear nowhere upstream — `3 FreeCharacter (obsolete)`,
`16 — Reserved`, `25 PathsArePostscript (obsolete)`, `40 NameCharacter`, `41 ProductInfo / SerialNumber`,
`42 GeneratorText` — and their dispositions (`X`/`I`) made a reader believe we had a documented reading
for them. Appendix B assigns no names to those codes; the chapters do not define them either.

**Resolution:** the six rows are deleted, the table is exactly Appendix B (65 entries, same codes, same
names), and the unassigned codes are stated as a group: they take the `other → unknown` path (skipped by
length, `info` `SF0104`, `APP-R001`) and no name may be invented for them. `TST-R025` / `T-TST-103` make
the equality machine-checked. Tag *bodies* remain the chapters' business; Appendix B governs tag
*values* only.

---

## E-027 — `IMPL-060-R034`'s quantisation grid is one grid written twice

**Found in:** our own `docs/impl/decompiler/060-shapes-and-gradients.md` §6.2 / `IMPL-060-R034`,
while implementing the quantise stage (P3 checkpoint C2).

**What it says:** coordinates are snapped to "1/20 px at smoothing 0, 0.05 px above", which reads as
two grids selected by a smoothing level.

**What is wrong:** 1/20 px **is** 0.05 px. The sentence states the same spacing in two notations, so
there is no smoothing-dependent switch to implement and no second grid to choose. A reader
implementing the rule literally would invent a `smoothing` parameter that can only ever take one
effective value.

A second, smaller defect sits beside it: the same section says the IR holds "floats in px", while
`IMPL-060-R037` — and the decoder — keep **integer twips** end to end. Quantising freshly decoded
geometry is therefore a no-op by construction. The stage is not redundant; it earns its place on
geometry that has been through arithmetic (morph ratio interpolation, curve subdivision, matrix
application), which is where two engines actually drift apart.

**Resolution:** one grid, expressed in the unit the IR is stored in. `quantiseShape` takes a single
`gridTwips` option defaulting to `1` (= 1/20 px = 0.05 px) and no smoothing flag. `quantiseScalar`
rounds **half away from zero** rather than using `Math.round`, which rounds half toward +∞ and would
make the grid asymmetric about the origin, so a shape would not survive being mirrored; `-0` is
normalised to `0` so the canonical serialisation stays byte-stable. The "floats in px" phrasing is
superseded by `IMPL-060-R037`: the IR is integer twips.

**Encoded by:** `T-MOD-107` (`packages/swf/test/shape-vector-ir.test.ts`) — grid spacing, mirror
symmetry, `-0` folding, idempotence, and the explicit assertion that decoded geometry is already
quantised. The quantiser lives at `packages/swf/src/shapes/quantise.ts`.

## E-028 — `MORPHGRADIENT`'s header: our own documents gave two wrong answers

**Found in:** `IMPL-070-R025` and `specs/110` §10.7 (both ours, not upstream), implementing P3 C3.
**What they say:** `IMPL-070-R025` — *"`MORPHGRADIENT` uses a **`UI8` count** (1…8) — not the nibble
form of Ch.7's `GRADIENT`"*. `specs/110` §10.7 — *"`NumGradients UI8` (1..8), one flags byte (as
GRADIENT), `MORPHGRADRECORD[]`"*. `IMPL-070-R028` added a third variant, describing the flags as
existing *"per state"* and requiring an `SF0192`-class report when the two states' modes differ.

**What is wrong:** all three. `MORPHGRADIENT` opens with **one** byte with Ch.7's exact `GRADIENT`
layout — `SpreadMode UB[2]`, `InterpolationMode UB[2]`, `NumGradients UB[4]` — and nothing else.

- The `UI8`-count reading loses the spread and interpolation modes entirely and reads the count from
  the wrong bits (a count of 2 with `pad`/`reflect` encodes as `0x92`, which the `UI8` reading sees
  as 146 records).
- The count-then-flags reading consumes **one byte too many**. That is the more dangerous error: the
  gradient itself still decodes, having swallowed the first `MORPHGRADRECORD`'s `StartRatio` as a
  flags byte, and every subsequent fill style in the array is shifted. The failure surfaces as
  garbage colours in an unrelated style, far from its cause.
- "Per state" modes cannot differ, because there is only one header byte for the pair; the
  `SF0192`-class comparison it mandates has no inputs.

Cross-checked against Ruffle's `read_gradient_flags()` (`swf/src/read.rs`), which both the static and
the morph paths call, and against `IMPL-060` §4.3 (`IMPL-060-R013`…`R022`) for the static form. The
chapter's own `MORPHGRADIENT` table is the source of the confusion: it prints `NumGradients` as a
standalone field without the enclosing bit layout that Ch.7 shows for `GRADIENT`.

**Resolution:** one byte, read with the same code path as the static `GRADIENT` header. The spread
and interpolation modes belong to the style and are **copied** to both endpoints, never interpolated.
A reserved mode (value 3) and an empty ramp are reported exactly as the static path reports them.
`IMPL-070-R025` rewritten, `IMPL-070-R028` withdrawn and restated, `IMPL-070` §6.2 and `specs/110`
§10.7 layouts corrected (`IMPL-070` 1.2, `specs/110` 1.8).

**Encoded by:** `T-MOD-405` (`packages/swf/test/morph.test.ts`) — the fixture writes `0x92`
(`spread = 2`, `interpolation = 1`, `count = 2`) and the test asserts both modes on **both**
endpoints, so a two-byte read cannot pass by consuming a record byte. `morphGradient` lives at
`packages/swf/src/tags/morph.ts`.

---

## E-029 — the erroneous `FFD9FFD8` pair is not a prefix, and not pre-SWF 8

**Found in:** Ch.8 via SWF19 errata p.138, restated in `IMPL-070-R004`, implementing P3 C3.
**What it says:** *"Before version 8 of the SWF file format, SWF files could contain an erroneous
header of 0xFF, 0xD9, 0xFF, 0xD8 before the JPEG SOI marker."*
**What is wrong:** two things, both of which make a literal implementation fail on real content.

1. **"before the SOI"** — the sequence appears at *any* point before the frame header, not only at
   the front. It is exactly what `JPEGTables`' trailing `EOI` plus `DefineBits`' leading `SOI` look
   like once a producer has glued them together, and Flash's decoder skips the pair wherever it
   lands. A standard decoder stops at the interior `EOI` and returns a blank or truncated image.
2. **"before version 8"** — the sequence is not version-gated in observed content; SWF 9 files carry
   it. A version check around the skip reintroduces the bug for later files.

The chapter is also silent on which payload carries the pair. Our own implementation stripped it from
the `DefineBits` image only, so a pair on the `JPEGTables` side survived the splice and landed
immediately after the `SOI` we synthesise — the worst position, since every decoder stops there.

A third, smaller divergence: the errata's wording is ambiguous about whether the real `SOI` *follows*
the pair (`FFD9 FFD8 | FFD8 …`, the literal reading) or whether the pair's own `FFD8` **is** the
`SOI`. Both byte patterns exist. Ruffle strips all four bytes; our earlier code stripped two. Each is
correct for one reading and wrong for the other.

**Resolution:** every `FFD9 FFD8` pair ahead of the `SOF`/`SOS` marker is spliced out of the image,
the `JPEGTables` payload, and the merged stream — with no version check. Bytes at or after the scan
header are entropy-coded and are left untouched. After the splice, an `SOI` is restored only if one
is not already present, which accepts both readings without guessing. `SF0258` (info) is reported
once per asset with the number of pairs removed. `IMPL-070-R004` and `IMPL-070-R005` corrected
(`IMPL-070` 1.2); `IMPL-070-R005`'s `EOI` removal is now conditional, since chopping two bytes
unconditionally truncated the last table of a producer that omitted its `EOI`.

**Encoded by:** `T-MOD-301` (`packages/assets/test/bitmap-layout.test.ts`) — merged-stream byte
compares covering a pair on the image, on the tables, in the interior, both `SOI` readings, the
missing-`EOI` tables block, and the negative case that entropy-coded bytes after `SOS` are preserved.
`removeErroneousMarkers` lives at `packages/assets/src/images/decode.ts`.

## E-030 — "native endian" is not a decodable instruction, and 8-bit PCM is unsigned

**Found in:** Ch.11 `DefineSound` / `SoundData`, restated in `IMPL-090-R006`, implementing P3 C5.
**What it says:** sound format 0 is *"uncompressed, native-endian"*, and the chapter never states
the sample representation for `SoundSize = 0` (8-bit).
**What is wrong:** one omission and one instruction that cannot be followed.

1. **"native-endian"** names the endianness of the *authoring* machine, which is not recoverable
   from the file. A decoder must pick an order. `REPO-R013` forbids picking the *host's*, because
   that makes output host-dependent — but it does not say which fixed order to pick, and the choice
   is not arbitrary: pick wrong and every 16-bit format-0 sound decodes to byte-swapped noise.
   `ruffle` resolves it by assuming little-endian unconditionally, with the comment *"Cross fingers
   that it's little endian"* (`core/src/backend/audio/decoders.rs`), routing
   `UncompressedUnknownEndian` into the same little-endian `PcmDecoder` as format 3. Format 3 exists
   precisely because format 0 was unusable, and Flash wrote little-endian from SWF 4 onward.
2. **8-bit sample representation is omitted.** It is **unsigned** (0…255, `0x80` = silence), as in
   RIFF/WAV and as `ruffle`'s `PcmDecoder` reads it. Nothing in Ch.11 says so, and the symmetric
   assumption — that 8-bit is two's complement like 16-bit — is wrong in the worst way: it maps
   silence to full-scale negative and inverts the waveform.

**Resolution:** format 0 and format 3 are decoded identically — 16-bit little-endian, 8-bit
unsigned expanded as `(byte - 128) * 256`. `SF0302` (info) is reported once per format-0 asset to
record that the endianness was assumed rather than read. We expand 8-bit by 256 rather than
`ruffle`'s `(byte - 127) * 128`, which spans half scale; 256 is the standard full-scale expansion
and these samples go straight into a WAV preview. `IMPL-090-R006` corrected (`IMPL-090` 1.2), and
`SF0302`'s registry wording — which claimed 8-bit had an endianness — reworded.

**Encoded by:** `T-AUD-103` (`packages/audio/test/media-codecs.test.ts`), which previously pinned
both defects.

---

## E-031 — `ruffle` emits 4095 samples per ADPCM packet; shipped content says 4096

**Found in:** `ruffle`'s `core/src/backend/audio/decoders/adpcm.rs` versus Ch.11's `ADPCMPACKET`,
implementing P3 C5. Not an upstream defect — upstream is right; this records a *player* divergence
that our decoder must not copy.
**What Ch.11 says:** `ADPCMMONOPACKET` is `InitialSample SI16`, `InitialIndex UB[6]`, then
`AdpcmCodeData UB[4095 × bits]`. Read as written, a packet yields 4096 output samples: the header
sample plus 4095 decoded from codes.
**What `ruffle` does:** treats `InitialSample` as a predictor seed only. Its `sample_num` cycles
`(sample_num + 1) % 4095`, and the call that returns the header sample also consumes a code, so
the header value is overwritten before any output — 4095 samples per packet.

**Why it is not resolvable by inspection:** both readings consume *identical bits*, so neither
desynchronises, and the difference is one sample in 4096 (≈0.09 ms) with identical predictor state
afterwards. No hex dump of a packet and no listening test separates them.

**How it was settled:** by payload arithmetic over real files. The readings need different packet
counts for the same declared `SoundSampleCount` and so predict different payload lengths:

| | packets | coded frames | payload bytes |
| --- | --- | --- | --- |
| 4096/packet (ours) | `ceil(N/4096)` | `N − packets` | `ceil((2 + packets·22·ch + codes·bits·ch)/8)` |
| 4095/packet (`ruffle`) | `ceil(N/4095)` | `N` | same formula, more codes |

4096/packet always predicts **fewer** bytes, so a payload sized for it is *too short* for the other
reading — which is decidable with no reference decoder. `tools/adpcm_hunt.py` harvested 71
ADPCM-bearing SWFs from 11 unrelated repositories of shipped Flash content; of 623 distinct
`DefineSound` measurements spanning code widths 2–5, mono and stereo, and declared counts from
1,931 to 4,587,840 samples, **412 match the 4096 prediction exactly and 0 match 4095**. 4095 was
outright impossible — the payload physically shorter than the data it needs — in 556 of them.

**Resolution:** `InitialSample` is an output sample; a packet emits 4096. `IMPL-090-R012` states
this as measured rather than inferred, and `IMPL-090-R034` records the corollary the same corpus
established: encoders do not pad the trailing partial packet. Our decoder was already correct, so
nothing changed in `packages/audio` beyond citing the evidence. Content decoded by `ruffle` is one
sample per 4096 shorter than it should be; if a future oracle harness diffs against `ruffle`, this
is an expected divergence, not a regression.

**Caveat for anyone re-running the measurement:** `SoundStreamBlock` payloads cannot settle this.
`SoundStreamHead.StreamSoundSampleCount` is an *average* (see `IMPL-090` §5 on one-under block
sizes), so a block's predicted length carries a ±1-sample uncertainty the same size as the effect.
A first pass that counted stream blocks appeared to prove 4095 from one looping sound; the block
declared 229 samples and held 147 bytes, which 4095/packet predicts at N=229 — but 4096/packet
predicts the same 147 at N=230, which the average permits. Only `DefineSound`, whose count is exact
for that sound, is admissible evidence.

**Encoded by:** `T-AUD-102` (`packages/audio/test/adpcm.test.ts`), which pins ten real
`(N, channels, bits, payload)` measurements from the corpus and asserts each payload is *minimal* —
one byte shorter no longer decodes — which is what excludes 4095. Full evidence and the reproduction
in `audits/P3-ADPCM-PACKET-LENGTH.md`.

---

## E-032 — `IMPL-090-R013` gave one diagnostic code two severities, and it fired on a quarter of real content

**Found in:** our own `IMPL-090-R013`, while characterising the short-payload residual left open by
`E-031`. An internal inconsistency, not an upstream defect.
**What it said:** a payload ending inside its final packet should "report `SF0328` (warning)", while
a payload that cannot be split into whole packets is "`SF0328` (error)" — the same code at two
severities.
**What is wrong:** three things, compounding.

1. **A code has one severity.** `SF0328` is registered `error`, and `audit_dev` check 2 enforces
   that every call site's severity equals the registry's. The warning arm was unimplementable, so
   the implementation emitted `error` for both.
2. **The common arm is the benign one.** Measured over the `E-031` corpus: **165 of 643 ADPCM event
   sounds (26%) end 1–6 frames short** of their declared `SoundSampleCount`. The largest observed
   gap is under 0.28 ms at 22.05 kHz. Every one was being reported as a hard error — a quarter of
   shipped, playable Flash content declared malformed, which makes the error signal worthless.
3. **The registry already disagreed with R013.** `SF0328`'s own wording is "code size outside 2–5
   bits, or a packet truncated *before the last one*" — which excludes a short final packet. R013's
   warning arm contradicted the code it was citing.

**Characterisation:** the shortfall is not random. It essentially never happens when
`SoundSampleCount` is a multiple of 4 (1 of 165 short sounds, against 284 of 478 complete ones);
`emitted = 4·floor(N/4)` reproduces 92 of 165 exactly, but does not explain every case. The residual
is concentrated in 22 kHz mono (43%) and absent from stereo, suggesting a default-settings
authoring path rather than a format rule. This is a correlation, not a proven encoder algorithm.

**Resolution:** the decoder distinguishes the cases by packet position. `DecodedSwfAdpcm.shortFinalPacket`
is true only when code reading stops inside the **last packet required by `sampleCount`**, after
that packet's header was complete. Callers report this as an `ASSET_SOUND_TRUNCATED` warning and do
not emit `SF0328`. A truncated code stream in an earlier required packet, or a missing/incomplete
packet header, still emits `SF0328` (error). `IMPL-090-R013` now states that boundary explicitly;
the stream-block call site in `packages/swf/src/model/timeline.ts` is fixed too, where the error was
doubly wrong because `SoundStreamHead` declares an *average* sample count (`E-031`).

The initial decoder replay on the 71-file corpus measured the false-error rate falling from **165
of 643 (25.7%) to 0**. A subsequent C5 exit recheck narrowed the predicate from "fewer than one
packet of frames missing" to an explicit comparison with the final required packet's start. The
corpus files are not present in this checkout for a post-refinement replay; the observed residuals
are only 1–3 bytes short and had complete final headers, so the strict predicate is expected to
retain those 165 benign cases. This remaining corpus replay limitation is recorded in
`audits/P3-ADPCM-PACKET-LENGTH.md`.

**Encoded by:** `T-AUD-102` (`packages/audio/test/adpcm.test.ts` and
`apps/decompiler/test/assets-dump.test.ts`), which pins a short final packet, a missing second
packet header, a truncated earlier packet with fewer than 4096 frames left, an empty payload and a
complete sound against the expected classifications.

---

## E-033 — `IMPL-010` §8's `UI32` vector row contradicts its own bytes (open)

**Found in:** `IMPL-010` §8, "Vector table", first row — on 2026-10-13, while building the shared
cross-lane vector table for the browser lane (roadmap §4.2). This is the first time §8 was executed
row by row against the readers rather than transcribed.

**What it says:** `| UI32 0x456e7120 | 20 71 6e 45 | 1163342112 | Ch.1 |`

**What is wrong:** the three cells cannot all be right. `20 71 6e 45` read little-endian is
`0x456E7120` = **1164865824**, which agrees with the row's own hex label. The Expected cell prints
**1163342112** = `0x45573120`, matching neither the bytes nor the label. Every other mechanically
checkable row in §8 is self-consistent — `UI16`, `UI24`, `FIXED`, all four `EncodedU32`, `UB[4]`,
`SB[4]`, `SB[7]`, `FB[19]`, all seven `FLOAT16`, `ARGB`, and both `STRING` rows — so the defect is
isolated to this one cell rather than systemic.

**Why it is not settled here:** deciding whether the *decimal* or the *bytes* are the transcription
error needs the upstream Ch.1 text, which this repository does not contain. Two readings are possible
and they are not equivalent: either our transcription of the decimal is wrong (the bytes and the hex
label corroborate each other, which is what the in-repo evidence favours), or upstream's own worked
example is internally inconsistent — the `E-025` class, where Appendix A's printed tables carry
typesetting defects and its bytes are authoritative.

**Provisional resolution (applied, entry stays open):** apply the rule `E-025` already established for
upstream worked examples — **the bytes are authoritative** — which gives `1164865824`. That is the
value the vector table encodes and both lanes assert. The §8 row is annotated `⚠ disputed, E-033` with
the byte-derived value printed beside the transcribed one, so the transcription is preserved rather
than silently overwritten and the disagreement stays visible in the document that carries it. If the
upstream decimal is later confirmed as printed, then the bytes and hex label are the transcription
error instead and the vector flips; that is a one-cell change, and this entry records which way it went.

A second, **benign** difference was found in the same pass and is recorded so it is not mistaken for a
disagreement: `FB[19]`'s Expected cell prints `3.0` where the canonical form of the same value is `3`.
Not a defect; the vector table canonicalises it.

**Encoded by:** `packages/swf/test/support/vector-table.ts` — the `ui32` row carries the byte-derived
value with the document's cell kept as `docExpected`, and `VECTOR_TABLE_DISCREPANCIES` records the
pair. `docTableDiscrepancies()` derives the list mechanically from the rows, and
`packages/swf/test/io-vectors.lanes.test.ts` asserts in **both** lanes that every derived discrepancy
has a pinned disposition naming what the bytes require and what the document prints. Settling §8
therefore forces the entry to be removed, and a new discrepancy forces it to be declared — neither can
happen silently.

---

## E-034 — `DoAction`/`DoInitAction` payloads have no block-level length prefix, and our generator invented one (fixed)

**Found in:** the open-corpus screen of 2026-10-13 (`IMPL-050` §13 criterion 3; roadmap §4.6 item B),
running `analyze --tiers`
over 73 licensed AVM1 conformance movies fetched from `ruffle-rs/ruffle@2372a4e1` — the first time the
front end saw an action block from outside this repository. The committed corpus cannot catch this
class of defect: all 26 of its inputs contain **zero** action blocks (`audits/P5-C4-CORPUS.json`
records 0 action blocks, 0 functions, 0 tier entries).

**What the format says:** `DoAction`'s payload *is* the `ACTIONRECORD` stream, and `DoInitAction`'s is
`UI16 SpriteID` followed by that stream — and `decodeDoInitAction` consumes the id, so the
`ActionBlockRef` the container hands over (`IMPL-030-R029`) already points at the first record byte in
both cases. `IMPL-050-R003`'s `Length` is the *per-record* `UI16` that follows an `ActionCode` whose
high bit is set. The only `UI32` size in this area is `CLIPACTIONRECORD.ActionRecordSize`, which
belongs to clip actions.

**What we did:** two mistakes that cancelled each other out inside the suite.
`frontend/analyze.ts`'s `sliceBlock` started at `ref.offset + 4` and refused any ref shorter than four
bytes, and `test-support/writer.ts`'s `actionBlock()` emitted a `UI32` length prefix for that slicer to
skip — citing `IMPL-050-R003`/`R006`, which say no such thing. Generator and consumer agreed with each
other, so 750 tests passed while every real file mis-parsed.

**Measured effect** (`tests/tests/swfs/avm1/` in `ruffle-rs/ruffle@2372a4e1`):

| Input | Before | After |
| --- | --- | --- |
| `call/test.swf` | 5 blocks, T0=1 **T2=4**, reasons `unknown-opcode:0x2f/0x72/0x6d`; a 726-byte script reported as a single `End` with 725 bytes dropped | 6 blocks, **T0=7 T2=0**, 1 function recovered |
| `goto_frame2/test.swf` | 15 blocks, T0=4 **T2=11**, 11–19 residual bytes each | 15 blocks, **T0=20 T2=0**, 5 functions recovered by name (`gotoPlay`, `gotoStop`, `gotoPlayScene`, `gotoStopScene`) |
| 73-file corpus | not runnable | 119 action blocks, 93 functions, T0=191 T1=3 T2=18, **0** `unknown-opcode` reasons |

The phantom reasons were ASCII: `2f 2f 20 66 72 61 6d 65` is `// frame`, the tail of a
`Push "// frame 3 A"` record read from its fifth byte.

**Resolution:** one slicer for all five block kinds, starting at `ref.offset` with no minimum length —
a block may legally be a single `End` — and `actionBlock()` emits records only. **Test:**
`T-AVM1-FE-036` (`packages/avm1/test/block-refs.test.ts`) pins the generator's bytes, both ref kinds,
and the one-byte block. Negative control: reverting either half of the fix fails 3 of its 4 cases
(`[1,0,0,0,0]` against `[0]`, block start 6 against 2, init start 18 against 14).

**Why it matters beyond P5:** `actionBlock()` is the AVM1 analogue of `IMPL-020-R038`'s "materialised
output of a committed generator". A generator that encodes a defect makes every byte-exactness
obligation leaning on it circular, which is the same failure mode `E-033` sits in.

## E-035 — `DefineFunction`/`DefineFunction2` carry their `Code` body *past* the record's `Length` (fixed)

**Found in:** the same screen, from the diagnostics rather than the tiers: `SF0400` (error, "action
stream truncated mid-record") on **48 of 73** files and `SF0420` (warning, "missing/non-zero block
terminator") on **49 of 73**. Toolchain output does not leave half its blocks unterminated, so the rate
was itself the evidence.

**Measurement** — an independent walk of every `DoAction`/`DoInitAction` payload in the corpus,
decoding each record by its own `Length`:

| Opcode | `headerLen == Length` (body outside) | `headerLen + codeSize == Length` (body inside) |
| --- | --- | --- |
| `0x9B` `DefineFunction` | **89** | **0** |
| `0x8E` `DefineFunction2` | **57** | **0** |

`headerLen` is `FunctionName` + `NumParams` + (`RegisterCount` + `Flags` for `0x8E`) + `Parameters` +
`CodeSize` — the field order `frontend/functions.ts` already uses. All 146 records that decoded in sync
agree, and neither opcode has a single counter-example. The 9 `0x9B` records that matched neither
hypothesis were reached *after* the walker desynchronised and report `codeSize` values that are ASCII
text (25972, 29811, 12656, and 111 = `o`), so they are artifacts of the bug rather than evidence
against it. Worked example — `add/test.swf`, payload offset 219: `9b 05 00 | 00 | 00 00 | 0f 00`, i.e.
`Length` 5 = empty name + `NumParams` 0 + `CodeSize` 15, and the 15 bytes that follow the record decode
exactly as `Push pool[2]; Trace; Push 1; Return`.

**What we do instead:** both decoders clamp to the record end (`bodyEnd = Math.min(to, pos + codeSize)`)
and, on overrun, emit `SF0400`, call `markTruncated()` and return `bodyStart: to, bodyEnd: to` — an
**empty function body**. The record walker then advances by `3 + Length`, so the body's records are
decoded a second time as siblings of the function, and the block's real terminating `End` is consumed
inside that second pass, which is what fires `SF0420`.

**Consequence:** every function in real content is modelled as empty-bodied with its body duplicated
into the enclosing block. Function bodies are the transpiler's unit of work, so this blocks `IMPL-050`
§13 criterion 2 and the P6 plan built on it. `IMPL-050-R008` is the rule needing correction: a function
body is closed by `codeSize` **and bounded by the enclosing block**, not by the record's `Length`.

A third generator encodes the same assumption and so cannot catch it either:
`tools/avm1-restart-probe.mjs` builds its `DefineFunction` as `name + UI16 0 + UI16 bodyLength + body`
inside one `ACTIONRECORD`, i.e. with the body *inside* `Length`. Fixing this entry has to move that
fixture too, or the probe will keep measuring a shape no toolchain emits.

**Resolution (applied 2026-10-13, `IMPL-050-R071`).** `DecodeFunctionOptions` gained `limit` — the end of
the enclosing *scan range*, which for a record inside a `With`/`Try` body is that region's end, not the
block's — and both decoders now set `bodyEnd = min(limit, bodyStart + codeSize)`, emitting `SF0400`
("overruns the enclosing block") only when the body really does run past it. The framing half is a new
module, `frontend/extents.ts`: one context-free parser computes the region extent of all four
region-bearing opcodes (see `E-036`), `ActionRecord` gained `regionEnd`, and the walker continues there,
so a body is decoded exactly once and the block's `End` stays with its own block. The extent is
`max(record end, header end + region size)`, which keeps an encoder that places the body inside `Length`
parseable — that tolerance is why this repository's fixtures never exposed the bug. Both generators moved
to the real shape: `packages/avm1/test/harness.ts`'s `defineFunction`/`defineFunction2` and
`tools/avm1-restart-probe.mjs`'s `defineFunction`. `IMPL-050-R008` needed no correction — it already
closes a block by `codeSize`; the rule that was wrong is R034 (`E-036`), and R006/R008/R032 now
cross-reference R071.

**Measured after the fix** (`pnpm corpus:report`, same 73 files, same pinned commit): `SF0400` **48 → 0
files**, `SF0420` **49 → 0** (`E-037`), `SF0404` **5 → 0** (`E-036`), error-severity diagnostics **60 →
15** — and all 15 are semantic, not framing (`SF0406` ×13 stack depth at a block join, `SF0405` ×2 branch
target off a record boundary). Clean exits **21 → 59 of 73**. Entries 212 → 269, functions **93 → 150**
(nested bodies are now visible at the right depth), tiers T0 191 → 123, **T1 3 → 121**, T2 18 → 25, with
`SF0410` (`CONSTANT_POOL_DYNAMIC`, R022) reaching **132** warnings for the first time: a function body's
pool reference really is dynamic, and until now no body was ever decoded to find out. The restart probe's
artifact changed in 2 of 17 keys (`inputSha256`, `normalizedCliReportSha256` — the fixture moved);
`directReportSha256` is byte-identical, so the same three functions still tier 0/1/2 for the same
reasons. **Test:** `T-AVM1-FE-037`, wired in `packages/avm1/test/region-framing.test.ts`.

## E-036 — `With` and `Try` own their bodies past `Length` too, and `IMPL-050-R034` said the opposite (fixed)

**Found in:** the same screen, while generalising `E-035`. If `DefineFunction` puts its body outside
`Length`, the other region-bearing opcodes are suspect by construction — and the tier report's
`try-malformed` reason on 5 files was already pointing at it.

**Measurement** — an independent walk of the corpus (not our decoders), classifying every region-bearing
record by where its header ends:

| Opcode | header ends at `Length` (body outside) | body inside `Length` | neither |
| --- | --- | --- | --- |
| `0x94` `With` | **3** (all with `Length == 2`) | 0 | 0 |
| `0x8F` `Try` | **3** | 0 | 0 |

Worked example — `try_catch_stack.swf`, block offset 138: `Length` 9 = `Flags` + three sizes + a
two-byte catch name, and the 49 bytes the sizes declare (37/12/0) follow the record. Ruffle's reader
agrees and says so in terms: `read_with(length)`/`read_try(length)` take `length` as an in-out parameter
and do `*length += try_size + catch_size + finally_size` (`swf/src/avm1/read.rs`).

**What we did instead:** `With` clamped its body to the record (`bodyEnd = min(to, bodyStart + size)`), so
every `With` was modelled empty and emitted `SF0400` ("extends past the record (R032)"); `Try` asserted
`headerEnd + trySize + catchSize + finallySize == record end`, so every real `Try` was `SF0404`
("do not tile the payload") and residual. **`IMPL-050-R034` was the rule encoding the error** — "the
three bodies tile the record" — which is why the code looked correct: it matched its specification.

**Resolution (applied 2026-10-13).** R071 covers all four opcodes with one parser; `With`'s body is
bounded by the enclosing scan range; R034 is restated so the bodies tile the *region*, with two `SF0404`
arms that cannot both fire on one record (a region clamped by the block, reported while decoding; a
`Length` that covers bytes past the header *and* the bodies, reported by `checkTryTiling`). R032 now says
 outright that `Length` is 2. `SF0404` **5 → 0 files**, `try-malformed` **5 → 0** tier reasons, and the
three real `Try` records in the corpus now report `malformed: false` with their bodies attached.
**Test:** `T-AVM1-FE-038`.

## E-037 — a function body is not `End`-terminated, so `SF0420` fired for every function in real content (fixed)

**Found in:** `SF0420` staying pinned at **49 of 73 files** across the `E-035` fix. Before the fix the 49
were empty function bodies; after it they were real ones — the same count from a different cause, which is
what made it visible.

**Measurement:** of **66** function bodies in the corpus (nested bodies included), **0** end with `End`
and **64** contain at least one interior zero byte. `IMPL-050` §3.2's own terminator column already said
so: a function body is terminated by its *byte count*, and a clip-event or button handler by its *record
size*; only frame and init scripts are `End`-terminated. R006 carved out `With`/`Try` bodies but not
function bodies, and `decodeFunctionBody` re-entered `analyzeActionBlock` with the default
`requireEnd: true`.

**Consequence:** one spurious `SF0420` per function — a warning, so it never changed an exit code, but it
is the single loudest code in the corpus report and it taught readers to ignore `SF0420`, which is the
diagnostic that *should* be noticed on a truncated frame script.

**Resolution (applied 2026-10-13).** `analyzeActionBlock` picks its scan options from the block kind:
`requireEnd`/`stopAtEnd` stay on for `timeline` and `init`, and both go off for `function`,
`classMethod`, `clipEvent` and `button` — the same reading R008 already gave `With`/`Try` bodies.
`stopAtEnd: false` matters independently of the diagnostic: with 64 of 66 bodies holding interior zero
bytes, a body that stopped at one would truncate at a payload byte that happens to land on a record
boundary. R006 now names the kinds an `End` closes. `SF0420` **49 → 0 files**; a `timeline` block with no
`End` still reports it. **Test:** `T-AVM1-FE-039`.

## E-038 — an error-severity region overrun left the block claiming tier 0 (fixed)

**Found in:** writing `T-AVM1-FE-037`'s overrun case. A `DefineFunction` whose declared `CodeSize` runs
past the end of the block emitted `SF0400` (error) and set `flags.truncated`, and the block still tiered
**0** with an empty reason list.

**Cause:** the reason pass read `flags.truncated` and `flags.overrun` only inside `if (scan.desync)`.
A region overrun does not desynchronise the walk — R071 clamps the region and carries on — so the flag was
set and then ignored. The block reported itself fully compilable while 40 bytes of its function body did
not exist.

**Consequence:** any truncated region produced an error diagnostic with no tier consequence, so the
emitter would have been handed a T0 block whose function body was missing. R004's reading is the one that
applies here: an overrun marks the enclosing function residual.

**Resolution (applied 2026-10-13).** Both flags are honoured unconditionally. No existing fixture changed
tier — the two flags were previously only ever set alongside a desync — and the overrun case now tiers 2
with `record-truncated`. **Test:** `T-AVM1-FE-037`'s fourth case.

## E-039 — a `Try`'s `catch` and `finally` bodies are decoded and then dropped from the IR (fixed)

**Found in:** `T-AVM1-FE-038`'s `Try` case, once `E-036` made the regions readable at all.

**Measurement:** a synthetic `Try` with `catchName: 'e'`, a `finally` flag and one `Push` in each of the
three bodies. The framing is correct — no diagnostic, `malformed: false`, the region skipped by the
walker, the try body's `Push` inline in the enclosing IR and also present in `tryBlocks`. But
`catchBlocks` and `finallyBlocks` come back **empty arrays**, and the catch and finally `Push` records
appear nowhere in the IR. The same emptiness reproduces with the bodies placed *inside* `Length` (the
pre-`E-036` fixture shape), so the gap predates this register entry and is not a framing artifact: it
sits in the region patch that buckets frames into a region's block groups (`frontend/stack.ts`'s
`patchRegion`, keyed by the scope keys `frontend/control-flow.ts` computes).

**Consequence:** `IMPL-050-R035` requires that "`try`/`catch`/`finally` become explicit nested regions in
the IR … Emitters must be able to reconstruct the structure from the IR alone". They cannot: an emitter
reading `catchBlocks` would emit no catch code at all, silently. `regions.test.ts` never caught it because
its two assertions are `not.toBeNull()`, which an empty array satisfies, and `disassembly.test.ts`'s
golden (`T-AVM1-FE-032`) had baked the emptiness in: it listed the catch and finally blocks with no
instructions under them and every region body at `stack -1→-1`. Only three files in the C4-c corpus
contain a `Try`, so the corpus report cannot size the impact either.

**Cause (two, both in `frontend/stack.ts`'s depth fixpoint).** The first diagnosis above — that
`patchRegion` lost the bucket — was wrong: the buckets were filled, with blocks that had never been
simulated. Instrumenting the real pipeline showed the framing and the CFG were right all along
(`buildBlockFrames` produced `catch:0:20` and `finally:0:30` scopes and `computeBodyScopeKeys` named them
correctly). What was missing was an input depth:

1. `bodyEntryFrame`, the map that seeds a region body's depth from its region op, was keyed by **region
   record** and held one frame id. A `Try`'s three body scopes share one region record, so only the try
   body's first frame was seeded. The catch and finally entry frames have no CFG predecessors — nothing
   branches into them, they are entered by unwinding — so their `inDepth` never settled, they were never
   simulated, and their blocks reached the IR with `ops: []`.
2. Even the seeded body latched the wrong depth. The settle step read
   `regionEntry.get(recordIndex) ?? 'unknown'` in the same iteration in which the region op's own block
   was still waiting to be simulated, and `sim.in` is never revisited, so *every* region body — `With`
   bodies included — carried `stackIn`/`stackOut` of `-1` for good.

**Resolution (applied 2026-10-13).** `IMPL-050-R072`. `bodyEntryFrame` is keyed by `scopeKey`, so each of
a `Try`'s three bodies is seeded, and a body-entry frame is left unsettled until the depth it depends on
exists instead of latching `unknown`. Those depths are the player's: `action_try` records the stack size
on entry, runs the try body on it, truncates back to it before the catch body and binds the thrown value
with `set_variable`/`set_current_register` rather than pushing it, then runs the finally body with **no**
truncation, on whatever the try or catch body left; `action_with` pops its operand before running the body
(`ruffle-rs/ruffle` `core/src/avm1/activation.rs`, Apache-2.0 OR MIT). A finally body therefore takes the
join of the try and catch scopes' exit depths, and where those disagree the depth is dynamic (T1
`dynamic-stack`) rather than an `SF0406` mismatch — the same finally body really does run after both
paths.

Seeding the finally body at the `Try` entry depth instead — the obvious first attempt — was measured and
rejected: it added three `SF0406` errors to the corpus (`try_catch_finally.swf` 2 → 4,
`try_finally_simple.swf` 1 → 2), because real content pushes in the try body and pops in the finally.

**Evidence.** `T-AVM1-FE-040` (`test/try-bodies.test.ts`, six cases: the three buckets filled; each body
at the depth the player gives it; a finally depth that goes dynamic when try and catch disagree;
`CatchInRegister`; a `Try` nested in a catch body; a `Try` in a function body). Negative control:
reverting `frontend/stack.ts` fails 7 tests in 3 files, including `T-AVM1-FE-032`'s golden, which now
prints the catch body's `Stop` and the finally body's `Play` and `stack 0→0` where it used to print
`-1→-1`. C4-c re-run (`audits/P5-C4-CORPUS-EXTERNAL.json`): T0 123 → **124**, T1 121 → 120, T2 25 → 25;
`call-dynamic-target` 9 → 3, `dynamic-args` 11 → 5, `dynamic-stack` 13 → 10; `SF0410` 132 → 145 warnings
(constant-pool pushes inside catch and finally bodies that have no pool in effect — newly visible, and
honest: `computePoolAt` walks the merged records in offset order, so a body inherits the pool set before
its region op); **errors 15 → 15**; `SF0406` identical to `HEAD` file by file (13 items, 22 with repeat
counts); exit codes `{0: 59, 1: 14}` and the integrity lists unchanged. `test:avm1-restart` still reports
`directReportsIdentical` and `cliReportsIdentical`.

Two defects this measurement exposed are filed separately and stay open: `E-040` (a region body's net
stack effect never reaches the code after the region) and `E-041` (a diagnostic emitted inside a nested
block carries a block-relative offset).

## E-040 — a region body's net stack effect never reaches the code after the region (fixed)

**Found in:** writing `T-AVM1-FE-040`'s function-body case, which ended the body with a `Return` after the
`Try`, and then measuring the corpus's `SF0406` errors to size the `E-039` fix.

**Measurement (synthetic).** A block whose records are a `Try` (three bodies, one `Push` each) followed by
`Pop` (0x17) tiers **2** with reason `stack-mismatch` and one `SF0406` error, "operand stack underflow in
block 0 at offset 0". The same region inside a `DefineFunction` body followed by `Return` (0x3E) tiers the
*function* **2** with `tierReasons: [{reason: 'stack-mismatch', diagnostic: 'stack-depth mismatch at a
block join', offset: null}]` and marks all four of its blocks residual, while the enclosing timeline block
stays T0 with no reasons — that last part is `IMPL-050-R059` working as designed, not this defect. Both
reproduce identically with `frontend/stack.ts` at the pre-`E-039` revision, so the gap predates that fix.

**Measurement (corpus).** Of the C4-c corpus's 13 `SF0406` items (22 counting repeats), 11 are underflows
and 2 are join mismatches. `inspect --actions` on `try_catch_finally.swf` shows the shape directly: inside
one function body, `block 0 @ 0..69 stack 0→-1` holds `Push`/`Trace` and a `Try` whose try-body scope
leaves a value (`block 1 @ 16..50 stack 0→1`), and the first action after the region is `Trace (stack)` —
a pop against a stack the model believes is empty. `try_finally_simple.swf` is the same shape
(`block 0 @ 0..457 stack 0→-1`, `Try catch (none) finally`, then a run of `Trace (stack)`). The other
underflowing files are *not* this defect: `this_swf5.swf`'s is a `CallFunction`/`Pop`/`Pop` sequence and
its two `With` bodies are balanced at `stack 1→1`, and `delete2.swf`'s is a `Delete2`/`Trace`/`Trace`
sequence inside a function body.

**Cause:** a region body is its own scope (`IMPL-050-R035`), so its frames are not CFG predecessors of the
frame that follows the region op and their net depth never reaches it. The player does not work that way:
`action_try` runs the try body and then the catch or finally body on one continuous stack, and
`action_with` runs its body the same way, so whatever a body leaves is there for the next action.

**Consequence:** a stack-consuming action directly after a `Try` or `With` region is reported as an
underflow (`IMPL-050-R054`, `SF0406`, error), which tiers the block or the function body **2** with
`stack-mismatch` and hands `WP-050-18`'s serializer a residual it must refuse. Two of the corpus's 15
error diagnostics are this shape, so P5's tier report overstates how much real content is untranspilable —
in the two `Try` files the affected function bodies are otherwise clean.

**Fix (2026-10-13, `IMPL-050-R073`).** Two halves, because the measurement found a second, older defect
underneath the first.

1. `packages/avm1/src/frontend/control-flow.ts` — regions now have real CFG edges. A block holding a
   `Try` or `With` record ends at that record and falls into the region body's first record; a body's
   fallthrough goes to the region's `finally` body when it has one and otherwise to the record after the
   region op, in the body's own scope first and then in the enclosing one. The continuation is therefore a
   genuine join over the bodies' exits and reuses `IMPL-050-R072`'s join machinery: no re-simulation, no
   special case in the stack pass. `With` has one path, so its exit applies directly; a `Try` whose try and
   catch exits disagree leaves the continuation dynamic (T1 `dynamic-stack`) rather than inventing a depth.
2. `packages/avm1/src/frontend/stack.ts` — the settle step treated a predecessor that never settled as a
   permanent block on the join. That is a latent defect with nothing to do with regions: any unreachable
   tail — code after a `Return` or `Throw` inside a body — held every block downstream of it unsettled, and
   an unsettled block contributes no ops, so the code was simply absent from the IR. Once a fixpoint pass
   makes no progress, dead predecessors are now ignored; if *all* of a block's predecessors are dead the
   block stays unsettled, so genuinely unreachable code is still not simulated.

**Evidence (synthetic).** `T-AVM1-FE-041` (`packages/avm1/test/region-flow.test.ts`, five cases): the
`Pop`-after-`Try` fixture that opened this entry now tiers **0** with no diagnostics; the `With` case shows
the leftover crossing the region boundary in the disassembly (`block 15..22 stack 0→1` for the body,
`block 22..36 stack 1→1` for the continuation, whose `Pop` consumes what the body pushed); a `Try` with a
`finally` enters the continuation from the finally body's depth (2), not from the `Try` record's (0);
mismatched try and catch exits still report `SF0406` and tier 2 — `IMPL-050-R054` reports a mismatch, it
never fixes one; and a dead tail inside a try body no longer drops the code after the region.
Negative control: reverting only `control-flow.ts` fails **6 tests in 3 files** (four of the five
`T-AVM1-FE-041` cases, `T-AVM1-FE-032`'s golden, `T-AVM1-FE-008`'s dynamic-`With` fixture). Two committed
expectations were re-pointed, both at behaviour the fix corrected: the golden, which had recorded the
region op as flowing straight past its bodies, and `tier.test.ts`'s dynamic-`With` fixture, which now also
expects `dynamic-stack` because `Enumerate` makes the body's entry depth unknown and the continuation is a
real join.

**Evidence (oracle).** Ruffle's own `try_catch_stack` test settles the semantics from the player's side.
Its `test.as` pushes "The stack was not preserved!", enters a `try` that pushes "The stack was preserved!"
and throws, and its expected `output.txt` traces "The stack was **not** preserved!" from inside the catch —
so the player discards the try body's pushes on a throw, exactly as `action_try`'s `truncate_stack` does
and as `IMPL-050-R072` states. The same source then runs `Trace; Pop; Pop` after the catch with one value
on the stack, so the underflow this fix now reports there is the content's own, and the player tolerates it
because AVM1 does not check the stack.

**Evidence (corpus, C4-c re-run).** **T0=124 T1=120 T2=25 → T0=119 T1=130 T2=23**, error-severity
diagnostics **15 → 14**, functions **150 → 153**, clean exits **59 → 60 of 73**, `SF0406` **13 items (22
with repeats) → 12 (20)**, `SF0410` warnings 145 → 161. The two files this entry named are cleared:
`try_catch_finally.swf` T2 2 → **0** and exit 1 → **0**, `try_finally_simple.swf` T2 1 → **0** and exit
1 → **0**. `try_catch_stack.swf` moved the other way, T0 → **T2**, and that is the fix working: its
continuation was absent from the IR before (the disassembly grows 63 → 120 lines) and the content really
does pop past empty.

The T0 → T1 moves are recovered IR, not lost fidelity. `inspect --actions` line counts, pre-fix → post-fix:
`string_coercion` 119 → **654**, `swf4_actions_coercion_order` 77 → **444**, `string_paths_other`
107 → **391**, `delete2` 126 → **396**, `enumerate` 35 → **261**, `watch` 396 → **588**,
`watch_virtual_property` 159 → **200**, `prototype_enumerate` 46 → **56**. Every one of those files gains
`dynamic-stack`/`dynamic-args`/`call-dynamic-target` reasons for statements that were previously dropped
outright, and each is genuinely dynamic (`Enumerate` and `With` results are unknowable statically) — which
is what a T1 verdict exists to say.

**Rejected alternative.** Marking every frame after a region op as depth-unknown (three lines, no CFG
change). It is honest and would have removed the false `SF0406`s, but it stops all stack verification after
the first region in a frame — most timeline scripts in the corpus have one — and it leaves the
dropped-IR half untouched.

## E-041 — a diagnostic emitted inside a nested block carries a block-relative offset (open)

**Found in:** reading the `E-040` measurements: `try_catch_finally.swf` reports
`SF0406 error @0 x4 operand stack underflow in block 0 at offset 0` — four times, at the same offset.

**Measurement.** `analyzeActionBlock` takes an `offsetBase`, uses it for the IR's `byteRange`
(`{start: offsetBase, end: offsetBase + bytes.length}`) and for the `fn_<hex>` block id, and the nested
call for a function body passes `offsetBase: this.input.offsetBase + shell.bodyStart`
(`frontend/analyze.ts:359-365`). Every `emit` *inside* an analysis, though, passes a frame- or
record-relative offset straight through — `SF0406`'s is `frame.firstOffset` (`frontend/stack.ts:682`) —
while the diagnostics the outer pass emits *about* a nested body add the base (`SF0409` at
`analyze.ts:344` and `:354`). One file therefore mixes coordinate systems. A synthetic `DefineFunction`
whose body starts at file offset 10 and underflows reports `offset: 0` while its own IR says
`byteRange: {start: 10, end: 41}`; the four `SF0406` items above are four different function bodies, each
reporting its own block 0.

**Consequence:** a diagnostic offset cannot locate the problem in the file for any block that does not
start at 0 — every function body, clip-event handler, button handler and `DoInitAction` script, and every
`DoAction` past the start of the tag stream. Tools that group by `(code, offset)` also collapse distinct
diagnostics into one line with a repeat count, which is how four separate underflows became `x4` in
`inspect` and a single item in `audits/P5-C4-CORPUS-EXTERNAL.json`. That is why neither the corpus report
nor `E-040`'s measurement can attribute an `SF0406` to a file position.

**Resolution direction (not yet applied):** wrap `emit` once at the top of `analyzeActionBlock` so every
diagnostic leaves with `input.offsetBase` added, keep block-relative offsets inside the IR (where
`byteRange` and `residual` already disambiguate them), and state the coordinate system in the rule that
owns diagnostics so the two cannot drift again. **Test:** to be declared with the fix.

## E-042 — the CMP design spec's acceptance table and doc 120's test table give the same `T-CMP-*` ids different meanings (open)

**Found in:** starting P6 (`WP-120-01`). The first thing a new phase has to know is which obligation its
tests satisfy, and the two documents that name P6's obligations disagree about six of them.

**Measurement.** `docs/specs/foundation/020-compiler-pipeline.md` §13 (`CMP-R041`) and
`docs/impl/transpiler/120-compiler-and-emitter.md` §8 both mint `T-CMP-*` ids:

| Criterion the design spec meant | id | CMP §13 (design spec) | doc 120 §8 (impl doc) |
| --- | --- | --- | --- |
| Determinism | `T-CMP-001` | two clean builds byte-identical | name assignment stable across 100 shuffled dictionary orders |
| Emitted TS quality | `T-CMP-002` | zero suppressions, zero `any` | forbidden-construct lint over emitted output |
| Diagnostics | `T-CMP-003` | every `risk`/`warning` carries a decision or requirement id | double build → `diff -r` empty |
| Residual reporting | `T-CMP-004` | every T2 function has a reason string and byte range | exit codes per failure class |
| Verify pass | `T-CMP-005` | `verify` clean on all C1 fixture builds | cache equivalence, cold vs warm |
| Build time | `T-CMP-006` | ≤ 90 s for a 5 MiB SWF, warm cache | cancellation inside an asset encode |
| Name conflicts | `T-CMP-007` | cited by `CMP-D02` for the `_2`/`_3` suffix rule | `verify --deep` detects injected drift |

Only the second row means nearly the same thing in both documents. (The comparison leads with the
criterion rather than the id on purpose: `tools/audit_dev.py`'s `check_sources()` treats a table row whose
first cell is a bare test id as a definition, and a register may not define one.) The machine ledger is
*not* ambiguous:
`tools/audit_dev.py` attributes all nine ids to doc 120 alone, because CMP §13 puts the id in a table
*cell* rather than an id column, so it is never parsed as a declaration — `python3 tools/audit_dev.py
--json` reports `declared_in: ['docs/impl/transpiler/120-compiler-and-emitter.md']` for every one. The
defect is for a human reader, and it is on the critical path of the phase that has to write the tests.

**Cause:** the design spec was drafted first and sketched its acceptance criteria with the ids it expected
the impl doc to use; doc 120 then assigned the band from scratch, in its own order, and roadmap §4.6 item D
extended it with `T-CMP-009`. Nobody re-read §13 afterwards.

**Resolution (documents, applied with this entry):** the impl doc owns impl test ids. CMP §13's table no
longer mints them — each criterion now names the doc 120 obligation that actually carries it, and the two
criteria that no obligation carries are marked as gaps rather than silently re-pointed:

- "every `risk`/`warning` carries a decision ID or requirement ID" — `IMPL-120` §10 criterion 5 carries
  the reporting half (`porting-notes.json` names every diagnostic); the `requirement` half cannot be
  carried at all until `E-043` is fixed.
- "≤ 90 s for a 5 MiB SWF on the CI baseline runner, warm cache" — **no owner in any impl document**. It is
  a CI property rather than a compiler output, so the recommended home is P11's budget/CI lane; until a
  work package takes it, it is an unowned design-spec target and this entry is its record.

**Test:** none — this is a document defect. Its regression pin is that the design spec cites no specific
id from the band after the fix: `grep -c 'T-CMP-0' docs/specs/foundation/020-compiler-pipeline.md` is **0**
(the two remaining `T-CMP-*` mentions are the wildcard, in the sentence that says the band belongs to
`IMPL-120` §8 and in the changelog row).

## E-043 — the implemented diagnostic model has three severities and no `requirement` field; CMP §9 specifies four and one (open)

**Found in:** starting P6 (`WP-120-01`), wiring `diagnostics.failOn` from `CMP` §3's config shape.

**Measurement.** `CMP` §9.1 declares `severity: 'error' | 'warning' | 'risk' | 'info'` plus `detail`,
`scope`, `requirement`, `hints` and `docs` on every diagnostic, and §9.2's policy table gives `risk` its
own build outcome ("compiles, but a known fidelity risk exists; counted in `risk.json`; `--fail-on=risk`
promotes"). `packages/swf/src/diagnostics/types.ts` — the model `IMPL-010` §7 owns and every phase
consumes — has `Severity = 'error' | 'warning' | 'info'` and `Diagnostic` with `offset`, `context`,
`characterId`, `tagCode`, `decision`, `count`: no `risk`, no `requirement`, no `hints`, no `scope`.
`grep -rn "'risk'" packages/*/src apps/*/src` returns nothing, so no code can produce one.

**Consequence.** Three P6 contracts depend on a severity that cannot exist: `IMPL-120-R029` and `CMP-R029`
(`--budget-strict` and `--fail-on=risk`), `CMP-D05` (`--fail-on=risk` is the default in CI for `main`), and
`CMP` §13's diagnostics criterion. A config that sets `failOn: 'risk'` would be accepted and then honoured
by nothing — precisely the silent-ignore failure `CMP-R005` makes unknown keys an error to prevent. P6's
report stage (`WP-120-11`) also cannot write `requirement` into `porting-notes.json` per diagnostic.

**Resolution applied now (P6 side):** `resolveForgeConfig` accepts the enum member `CMP` §3 declares but
rejects `'risk'` with a `ConfigError` naming this entry, so the value fails loudly today instead of being
silently unhonourable. `packages/compile/test/pipeline.test.ts` pins that.

**Resolution direction (not yet applied, P0 side):** the model is `IMPL-010` §7's (`IMPL-010-R041`) and the
registry is the single place a diagnostic's shape is defined, so extending `Severity` with `'risk'` and
`Diagnostic` with `requirement?`/`hints`/`docs?` is P0-owned work that P6 consumes — the same supply
direction as every other model field. It is small (a union member, three optional fields, the sink's
severity ordering, and `CMP-R030`'s sort) but it touches every package that emits, so it wants its own work
package and its own gate re-run rather than a drive-by edit inside P6. Until it lands, `risk.json`,
`--fail-on=risk` and `CMP-D05`'s CI default are unimplementable, and P6's budget gating stays at
`--budget-strict` (`IMPL-120-R029`'s exit 5), which needs no new severity.

**Test:** `packages/compile/test/pipeline.test.ts` (the rejection). The P0-side extension is unwired and
must not be named in a test file until it exists.

## E-044 — `WP-050-10`'s name-recovery pass discards the export map it documents, and its synthetic names embed a byte offset, so neither `AVM1-R036`'s order nor `IMPL-120-R011`'s determinism holds (open)

**Found in:** implementing `WP-120-05`, doc 120 §3's name-assignment pass, which has to produce a symbol table
that is closed and stable *before* emission. `AVM1-R036` gives that table's three-step order — export name,
then declared name, then a synthesised one — and step (1) is P5's job.

**Measurement,** over all 73 licensed corpus titles (`audits/P5-C4-CORPUS-EXTERNAL.json`'s lane), read from
the analysed IR of each movie:

| measurement | value |
| --- | --- |
| functions given a recovered name | 149 |
| …whose synthetic name embeds a byte offset | **96 (64 %)** |
| recovered classes reported (`MovieAnalysis.names.classes`) | **0**, in all 73 |
| exported characters available (11 movies carry `ExportAssets`) | 20 |
| export names appearing among the 149 recovered names | **0** |

Three separate defects sit behind those numbers, all in `packages/avm1/src/frontend/names.ts`:

1. **The export map is discarded.** `IMPL-050-R062` requires the pass to run over "the IR plus the
   dictionary's export map"; `analyze.ts:758` obligingly passes `model.exported`, and `recoverNames` throws
   it away — `void exportMap;` at `names.ts:71`. The comment above that line says the map "is kept in the
   result for the report", which is doubly wrong: it is neither kept nor reported, and `RecoveredNames` has
   no field to carry it. (Same failure mode as the `sanitiseName` docstring found while writing
   `WP-120-05`: the prose describes an intention the code abandoned. Check which of the two is wrong before
   "fixing" the code to match.)
2. **The synthetic name embeds a position.** `syntheticName` yields `avm1_fn_<hex offset>_<base36>`, so 96 of
   149 real function names change when an unrelated tag earlier in the file grows by a byte. A recovered
   name is a *user-facing* output (`IMPL-120-R011`: "instability across runs is a bug"), and the pass's
   determinism argument — sort by (offset, id) — makes the *order* stable while leaving the *string*
   unstable, which is precisely the gap `T-CMP-001` exists to close.
3. **Class recovery is dead code in production.** `detectClasses` (`names.ts:82`) is exported from the
   package root and exercised by `movie.test.ts:208`, but the only other reference is its own declaration:
   no caller. `recoverNames` returns a `classes` map it never populates, so `IMPL-050-R063`'s "MUST … be
   recorded in the report" is unimplemented by construction — not flakily, always, hence the 0.

**Why no existing test sees this.** `T-AVM1-FE-012` is specified as "100 shuffles of dictionary order", but
the test shuffles the *candidate array* with an **empty** export map, and the candidate order is what the
sort key already fixes; the dictionary it should be permuting is the one argument the code ignores. Permuting
the dictionary is also the only construction that moves byte offsets at all, and P6's version therefore
deals the definition tags into slots interleaved between the control tags and asserts that the resulting
top-level `DoAction` offsets really take several distinct tuples — without that guard the claim is vacuous.
`movie.test.ts:190` goes further and *pins* the offset form (`expect(names.get('fn03')).toBe('avm1_fn_12c_3')`
— "synthetic: offset 0x12c, index 3"), so P5's suite currently requires the defect.

**Evidence from the other side.** Registering `WP-120-05`'s table against a deliberately offset-bearing
synthetic name fails exactly two tests in `packages/compile/test/names.test.ts` — the permutation-stability
test and the check that no name leaks a hex offset — and reverting makes all 28 pass. That is
`IMPL-120-R033`'s third leg measured rather than argued.

**Resolution.** P6 does **not** patch P5's pass. It builds its own closed table in
`packages/compile/src/passes/names.ts`, consulting the export name at its own seam (`CMP-D-CMP-N1`,
doc 120 §3.1) and never embedding a position (new `IMPL-120-R033`). The P5-side work, which this entry
leaves open:

- `WP-050-10`: make `recoverNames` implement step (1) over `model.exported`, and change the synthetic base to
  `IMPL-120-R008`'s `<kind><CharacterId>_<n>` shape; update `movie.test.ts:190`'s pin in the same commit, or
  the suite will defend the old form.
- `WP-050-11`: give `detectClasses` a caller in `analyze.ts` so `MovieAnalysis.names.classes` means something,
  or delete it and drop `R063`'s reporting clause to a later phase — a unit-tested function nothing runs is
  the worse of the two.
- re-specify `T-AVM1-FE-012` as a permutation of the *export dictionary* with non-empty maps, so it tests the
  clause `R062` actually states.

**Status:** open, owned by P5 (doc 050 §13 criteria 2 and 3 are the gates that would notice). P6 is not
blocked: its table is correct either way, and when the P5 fix lands the consulted name arrives through
`recoveredName` instead of through this pass's own dictionary lookup.

## E-045 — the AVM1 IR's requirement groups carry a 14th value that AVM1-§8.1's table cannot name (open)

**Found in:** implementing `WP-120-04`, the requirement-shake pass, whose sole input is
`ActionIR.requirements` and whose output is the list of runtime modules the emitter will include.

**What the documents say:** `docs/specs/language/040-avm1-to-typescript.md` §8.1 enumerates **13** host-API
groups — core-objects, movie-objects, events, sound, loading, data, drawing, bitmap, geometry, filters,
colour, misc-system, legacy-as1 — and `IMPL-120-R006` says the pass selects "the union of `HostApiGroup`
values over kept blocks", which presumes the IR's vocabulary and the spec's table are the same set.

**What is wrong:** they are not. `HostApiGroup` in `packages/avm1/src/frontend/requirements.ts` has **14**
values; the extra one, `timeline`, covers the frame-control and `_currentframe`/`_totalframes` surface that
§8.1 files inside the "Movie objects" row without giving it a group of its own. Nothing is *unsound* about
that — the IR is allowed a finer partition than the spec's module list — but a consumer that reads
`requirements` as a module list, which is exactly what `R006` instructs, is handed a name with no runtime
module behind it.

**Measurement**, over the 73 licensed corpus titles (`pnpm corpus:verify` passes on all of them):

| measurement | value |
| --- | --- |
| action blocks analysed | 119 |
| …naming `timeline` | **17 (14 %)**, in 11 of 73 movies |
| …naming `timeline` but *not* `movie-objects` | 6 |
| group frequency | core-objects 115, movie-objects 87, misc-system 84, timeline 17, loading 7, legacy-as1 6, events 1, sound 1, colour 1 |

So the mismatch is not a corner of one malformed file: it reaches a seventh of the corpus's blocks, and for
6 blocks `timeline` is the *only* group in the movie-object pair, which is where a naive fold-into-nothing
would drop a module something still calls. The frequency row is also why `T-CMP-013`'s fixtures are synthetic:
five groups (data, drawing, bitmap, geometry, filters) are named by **no** block in the licensed corpus, so no
real file can show a drop happening.

**Resolution:** P6 folds `timeline` into `movie-objects` at its own boundary — `GROUP_FOLD` in
`packages/compile/src/passes/shake.ts`, a total map over all 14 values, with one decision entry per entry
point saying so (`IMPL-120-R006`). The fold is the *interim* shape; the durable fix is one line either way:

- P5/`specs/040`: either add a "Timeline" row to §8.1 (and let `WP-120-07`'s runtime layout grow a 14th module),
  or rename the IR value `movie-objects` and delete the fold. Which of the two is a spec decision, not a P6
  one, because §8.1's row list is also what doc 120's emission order (`IMPL-120-R008`) is indexed against.
- Whichever way it goes, `GROUP_FOLD` and this entry's test are deleted in the same change, not left as a
  second source of truth.

**Encoded by:** `packages/compile/test/shake.test.ts`, "folds the IR-only timeline group into the spec row that
owns those APIs (`E-045`)", which asserts the raw IR names `timeline`, that `SPEC_GROUPS` does not contain it,
that the selection contains `movie-objects`, and that the fold is reported rather than silent.

---

## E-046 — three payloads a dead-code proof cannot read, one of them from our own reader (open)

**Found in:** implementing `WP-120-03`, whose rule is that a character is prunable only when *every* payload
that could name it has been read. `IMPL-040`/`IMPL-120-R005` list the reference sites; three of them turn out
not to exist in the model P2 publishes, and one is not detectable at all.

1. **`DefineFont2`/`3` bitmap glyphs.** With `HaveBitmaps` set, every glyph outline in the font carries a
   `BitmapCharacterID` naming a `DefineBitsJPEG`-family character. `DefineFontModel`
   (`packages/swf/src/tags/fonts.ts:46–64`) decodes glyphs, codes, metrics and kerning and has **no** field for
   it — `grep -i bitmap packages/swf/src/tags/fonts.ts` returns nothing, so the flag is neither recorded nor
   reported. A bitmap pruned out from under such a font draws as nothing, with no diagnostic anywhere in the
   build.
2. **`DefineVideo4`'s `DeblockCharacterID`.** Same shape of hole, bigger: `CharacterModel` carries no video
   payload field at all, so the tag's own trailing character id cannot be read by any consumer.
3. **A payload our reader over-ran.** A `DefineShape` whose declared size is smaller than its content is the
   case the proof most needs to catch, and it is invisible. Measured on a 3-byte body: the tag spans
   `[0, 5)`, `buildMovieModel` returns `kind: 'shape'` with a non-null `vectorShape` and `quarantined`
   **unset**, and the only signal is `SF0013` — a *warning*, at offset **7**, which is inside the *next* tag's
   span. Two consequences follow. A partial payload is indistinguishable from a complete one, so a proof over
   the model is not a proof. And no rule can attribute the diagnostic: the cursor position of an over-read
   lands past the tag that caused it, so both "nearest preceding tag" and any slack window are guesses. What
   is sound is the narrow version: an **error**-severity diagnostic whose offset falls inside a definition tag's
   span (`headerOffset … headerOffset + length`) means that payload was interrupted — which is what P6 uses.

**Measurement**, over the 73 licensed titles (67 characters in total): 2 `DefineFont2` characters in 2 movies,
0 video characters, 0 `unknown` kinds, 0 quarantined shapes. The font block therefore disables pruning for
**2 of 73 movies** — cheap on this corpus, and the honest direction for a real one, where a bitmap font is
normal.

**Resolution:** P6 fails closed, and says so. `font2`/`font3`/`video` are reported as incomplete referencers
(`font` v1, `font4`, bitmap, sound, `binaryData`, `imported` and `missing` are *not* — their payloads contain no
character id, and the tests pin that half too, because a rule that blocked on every font would be quietly
unusable); an unresolvable placement id, a text run with no readable `fontId`, and edit text naming no font by
id or export name are each incomplete; and a character whose payload was interrupted is treated as an
incomplete *referencer*, which disables pruning movie-wide rather than for that one character. The
interruption list is derived in the `model` stage and carried on the artifact
(`ModelArtifact.readInterruptions`), never read from the live diagnostic sink — see `IMPL-120-R035`. The three
underlying gaps are P2's:

- `WP-020-*`: record `HaveBitmaps`' per-glyph character ids on `DefineFontModel`, and a `DefineVideo4` payload
  view with its `DeblockCharacterID`, so a reference a file makes is a field a consumer can read.
- `WP-020-*`: an over-read must mark the payload it truncated. `quarantined` is the existing field for "this
  payload is not trustworthy"; reusing it for a soft truncation needs no new model type, and it makes every
  downstream proof — not just this one — able to fail closed.
- `WP-020-*`: if `SF0013` keeps a warning severity for an over-read that changes what a payload *contains*,
  then severity is carrying information the model does not otherwise expose. Either promote the over-read to an
  error, or expose the truncation as a field; a consumer should not have to infer model state from diagnostic
  severity.

**Encoded by:** `packages/compile/test/dead-code.test.ts`, "what a payload can hide (`E-046`)" — both the
blocking and the non-blocking kinds, plus the movie-wide disable driven from a real `DefineFont2` tag that is a
root (a dead referencer cannot hold anything alive, which is why the first version of that fixture proved
nothing) — and "PINS a gap: a silently truncated payload still reads as complete", which asserts the *wrong*
side on purpose so the suite fails when the reader starts marking partial payloads.

---

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | E-001…E-006 recorded |
| 1.1 | chapter-2 pass | E-007 added (our own long-header wording); E-006 extended with the phase-2 note |
| 1.2 | chapter-3/4 pass | E-008 (PlaceObject3 `BackgroundColor` flag), E-009 (filter units, `GFX-R081`/`R086` corrected), E-010 (`PlaceObject` v1 `CharacterId = 0`, documented deviation), E-011 (diagnostic range violations in our own docs: `SF0201`→`SF0631`, shapes `SF0180–0189`, video `SF0240–0248`) |
| 1.3 | chapter-5/6 pass | E-012 (Ch.5 `PushDuplicate`/`StackSwap`/`StoreRegister` prose read as stack effects; `ACTIONRECORDHEADER.Length` = payload); `IMPL-050` v1.1 and `IMPL-060` v1.1 grounded; `specs/040-avm1` `AVM1-R014` corrected; `specs/110` §10.3/§10.4 added |
| 1.4 | chapter-7/8/9 pass | E-013 (Ch.7 gradient flags byte, `NumGradients == 0`, signed `FIXED8` focal point, legacy non-zero modes), E-014 (Ch.8 `DefineBitsLossless2` has no format 4; premultiplication is `ALPHABITMAPDATA`'s rule — design spec `AST-R006`/§3.1 corrected in v1.1; `AlphaDataOffset` is a byte count; JPEG-only alpha; row padding by pixel unit; deblocking recorded not applied), E-015 (Ch.9 two-stream morph edges, `Offset` is a hint, equal edge counts and identical style-change records required, no scaling grid on `DefineMorphShape2`; `IMPL-070` diagnostics re-allocated to `SF0250`–`SF0269`); `IMPL-060` v1.2 and `IMPL-070` v1.1 grounded; `specs/110` §10.5–§10.7 added |
| 1.5 | 2026-10-04 | Cross-document registry reconciliation (`E-016`: `SF0121` -> `SF0109`, `SF0122` -> `SF0110`, morph clause -> `SF0261`/`SF0265`, `SF0420`/`SF0421` -> `SF0423`/`SF0424`, `SF0220` -> `SF0249`, `SF0230`/`SF0231` -> `SF0501`/`SF0502`); `E-005` closed from the Ch.1 rotation table (clockwise-positive confirmed); `IMPL-010` open item 2 resolved |
| 1.6 | 2026-10-04 | Ch.10/Ch.11 pass: `E-017` (Ch.10 `FontHeight` under `HasFontClass`, `TEXTRECORD` field order, `DefineFont` count inference, zero-glyph fonts, align-zone purpose, CSM cutoffs), `E-018` (Ch.11 ADPCM framing corrected — 2-bit code size, 4095-code unaligned sign-magnitude packets, per-block stream restart; `SoundSampleCount` pairs; MP3 mono `ChannelMode`; `LatencySeek`; `StartSound2` prose; `Pos44`; frame-subdivision examples), `E-019` (diagnostic blocks `SF0270`–`SF0289` and `SF0324`–`SF0332`, `T-AUD-1xx` band, fatal-range owner); `IMPL-080` v1.1 and `IMPL-090` v1.1 grounded; `specs/060` v1.1 corrected; `specs/110` §10.8/§10.9 added |
| 1.7 | 2026-10-04 | Ch.12–Ch.15 pass: `E-020` (`SF0130` reassigned — `DefineButton` v1 actions are a plain `ACTIONRECORD[]`; `DefineButton2`'s condition chain), `E-021` (Ch.14 omits `CodecID = 6` from the tag's own table; `SF0290`–`SF0299` allocated; Appendix C is the default palette only), `E-022` (Ch.15 `FileAttributes` bit names vs the tag description; `DefineBinaryData`/`EnableTelemetry` bodies pinned) |
| 1.8 | 2026-10-04 | `E-023`: `IMPL-130` test ids re-banded to `T-RT-1xx` (collision with the design spec's `T-RT-00x` block; the undefined `T-RT-020` is now the defined `T-RT-120`) |
| 1.9 | 2026-10-04 | `E-024`: dangling citations repaired (`GFX-D21` -> `GFX-D16`, `RT-R062` -> `RT-R057`…`R059`, `REPO-D09` -> `REPO-D06`), each missing decision/rule written into its owning design spec |
| 2.0 | 2026-10-04 | Appendix pass: `E-025` (Appendix A's printed tables: `VertLineFlag` type/condition, the swapped hor/vert delta labels, `MoveDelta*` called unsigned, the "first byte ignored" frame-rate prose, the "fill bits" label for padding) and `E-026` (six invented tag names removed from `specs/110` §2 — Appendix B is the index authority) |
| 2.1 | 2026-10-09 | `E-027`: `IMPL-060-R034`'s quantisation grid ("1/20 px at smoothing 0, 0.05 px above") is one grid stated twice — a single `gridTwips` option replaces the non-existent smoothing switch; the IR is integer twips per `IMPL-060-R037`, not "floats in px" |
| 2.3 | 2026-10-09 | `E-030`: sound format 0's "native endian" is undecodable — formats 0 and 3 both read little-endian (`ruffle` does the same) — and Ch.11 never states that 8-bit `SoundData` is unsigned, which it is; `IMPL-090-R006` corrected and `SF0302` reworded |
| 2.4 | 2026-10-09 | `E-031`: `ruffle` emits 4095 samples per ADPCM packet where Ch.11's `ADPCMPACKET` and shipped content both say 4096 (`InitialSample` is output, not just a predictor seed) — settled by payload arithmetic over 623 real `DefineSound` measurements from 71 files in 11 repositories, 412 exact matches to 0; `IMPL-090-R012` restated as measured and `IMPL-090-R034` added (no trailing-packet padding) |
| 2.5 | 2026-10-09 | `E-032`: `IMPL-090-R013` assigned `SF0328` two severities, which a single registered code cannot carry, so the implementation emitted `error` for both arms — reporting 165 of 643 real ADPCM sounds (26%) as malformed over a 1–6 frame, sub-0.28 ms shortfall. The decoder distinguishes a partial final packet from a truncated earlier packet; `SF0328` remains for missing headers and incomplete earlier packets. Initial corpus replay measured false errors 25.7% -> 0%; a stricter final-packet-position check was added afterward and its non-final case is regression-pinned, but the ephemeral corpus was unavailable for another replay |
| 2.6 | 2026-10-09 | C5 exit-readiness refinement to `E-032`: only a shortfall inside the packet at `floor((N-1)/4096)*4096` is benign; a first-packet code truncation with <4096 samples left remains `SF0328` (T-AUD-102 unit and asset-dump regressions). Corrected residual count to 165 raw tags / 163 distinct measurements, 1–6 frames. Replayed corpus is not present to rerun the newer predicate |
| 2.2 | 2026-10-09 | `E-028`: `MORPHGRADIENT` is a single Ch.7-style `GRADIENT` header byte — `IMPL-070-R025` (`UI8` count) and `specs/110` §10.7 (count *then* flags) were both wrong, the latter consuming a byte too many and shifting every later morph fill style; `IMPL-070-R028`'s per-state modes withdrawn. `E-029`: the erroneous `FFD9FFD8` pair occurs anywhere before the frame header, is not version-gated, and must be removed from the `JPEGTables` payload and the merged stream as well as the image |
| 2.7 | 2026-10-13 | `E-004` re-opened under its own clause and corrected: `FLOAT16` **is** consumed by an AVM1-era tag we parse — `DefineFontAlignZones` (tag 73), decoded at `packages/swf/src/tags/fonts.ts:599–600` with a fixture in `font-aux-tags.test.ts`; the bias-15 resolution is unaffected and better corroborated. `E-033` filed (open): `IMPL-010` §8's `UI32` row prints `1163342112` while its own bytes `20 71 6e 45` and hex label `0x456E7120` give `1164865824`; provisional resolution applies `E-025`'s bytes-authoritative rule, the §8 row is annotated rather than overwritten, and both test lanes assert the discrepancy stays pinned until settled. Found by executing §8 row-by-row for the first time |
| 2.8 | 2026-10-13 | `E-034` (fixed): `DoAction`/`DoInitAction` payloads carry no block-level length prefix, but `sliceBlock` skipped four bytes and `test-support`'s `actionBlock()` emitted a `UI32` prefix for it to skip — self-consistent, and both wrong, so 750 tests passed while every real file mis-parsed. Found by the open-corpus screen (`IMPL-050` §13 criterion 3; roadmap §4.6 item B) over 73 licensed AVM1 movies from `ruffle-rs/ruffle@2372a4e1`: `goto_frame2` went from T0=4/**T2=11** with phantom `unknown-opcode:0x2f` reasons to T0=**20**/T2=0 with five named functions; the corpus yields 119 blocks, 93 functions, T0=191 T1=3 T2=18 and zero phantom reasons. Pinned by `T-AVM1-FE-036` with a reverting negative control. `E-035` filed (open): `SF0400` on 48 of 73 and `SF0420` on 49 of 73 led to a measurement showing `DefineFunction` (89 records) and `DefineFunction2` (57) both place `Code[CodeSize]` **past** the record's `Length` — 146 of 146 in-sync records, no counter-example — while our decoders clamp the body to the record end and return an empty body, then re-decode those bytes as siblings. Blocks `IMPL-050` §13 criterion 2; `IMPL-050-R008` needs the correction |
| 2.9 | 2026-10-13 | `E-035` fixed (`IMPL-050-R071`, `frontend/extents.ts`, `T-AVM1-FE-037`) and three defects found while fixing it: `E-036` (`With`/`Try` own their bodies past `Length` too; `IMPL-050-R034` said the opposite — fixed, `T-AVM1-FE-038`), `E-037` (a function body is not `End`-terminated, so `SF0420` fired 49 times — fixed, `T-AVM1-FE-039`), `E-038` (an error-severity region overrun left the block at tier 0 — fixed), and `E-039` (**open**: a `Try`'s catch/finally bodies are decoded and then dropped from the IR, `T-AVM1-FE-040`). Corpus lane after the fixes: `SF0400` 48→0 files, `SF0420` 49→0, `SF0404` 5→0, errors 60→15 (all semantic), clean exits 21→59 of 73, functions 93→150, T1 3→121. |
| 2.10 | 2026-10-13 | `E-039` fixed (`IMPL-050-R072`, `frontend/stack.ts`, `T-AVM1-FE-040`): a region body's entry frame was seeded one per region *record*, so a `Try`'s catch and finally bodies were never simulated and reached the IR with no ops, and the seeded body latched `unknown` before its region op had run. Each body now takes the depth the player gives it — the `Try` entry for the try and catch bodies, the join of the try and catch exits for the finally — and the C4-c re-run is diagnostic-neutral on errors (15 → 15) with T0 123 → 124. Two defects the measurement exposed are filed: `E-040` (a region body's net stack effect never reaches the code after the region, so a pop after a `Try` is a false `SF0406` and a false T2) and `E-041` (diagnostics emitted inside a nested block carry block-relative offsets, so four distinct underflows report `@0`) |
| 2.11 | 2026-10-13 | `E-040` fixed (`IMPL-050-R073`, `frontend/control-flow.ts` + `frontend/stack.ts`, `T-AVM1-FE-041`): a region op now falls into its body, a body falls into the region's `finally` and then into the record after the region, so the continuation is a real join over the bodies' exits; and a predecessor that never settled no longer blocks a join forever, which had been dropping every block downstream of unreachable code from the IR. Corpus: T0 124 → 119, T1 120 → 130, T2 25 → **23**, errors 15 → **14**, functions 150 → **153**, clean exits 59 → **60 of 73**, with `string_coercion`'s disassembly growing 119 → 654 lines of recovered IR. `E-041` stays open |
| 2.12 | 2026-10-14 | P6 started (`WP-120-01`, `@swf-forge/compile`) and the first two documents it had to read disagreed with each other or with the code: `E-042` (CMP §13's acceptance table and doc 120 §8 give six `T-CMP-*` ids different meanings — the impl doc owns the band, CMP §13 stops minting ids, and two of its criteria are recorded as gaps, one with no owner anywhere) and `E-043` (the implemented diagnostic model has three severities and no `requirement` field, while CMP §9 specifies four and one, so `--fail-on=risk`, `risk.json` and `CMP-D05` are unimplementable; P6 now rejects `failOn: 'risk'` loudly, and the model extension is dispositioned to P0) |
| 2.13 | 2026-10-14 | `E-044` recorded while implementing `WP-120-05` (doc 120's name-assignment pass): P5's `recoverNames` discards the export map its own rule requires (`void exportMap;` under a comment claiming the opposite), 96 of 149 corpus function names embed a byte offset, and `detectClasses` has no production caller so class recovery reports zero everywhere by construction. Measured across all 73 licensed titles and pinned from both sides; dispositioned to `WP-050-10`/`WP-050-11` rather than patched from P6, which builds its own closed table under the new `IMPL-120-R033` |
## E-047 — `ActionIR` records no def site for some values it binds, and no offsets for the ops inside a block, so a statement-level emitter cannot be total (open)

**Found in:** implementing `WP-120-08`. The emitter's contract is that every statement it prints is attributable
to something the IR actually says, and two places the IR stops short of that.

1. **A pushed value with no `result`.** Handlers record the temp they bind under a field named `result` —
   `binop`, `call` (`stack.ts:901`), and the rest — but `GetTime` (`stack.ts:1166-1169`), `PushDuplicate` and
   `Enumerate` push an id without recording it anywhere. Measured across the 73 licensed titles: **17 of 93
   T0 root blocks read a temp that no op in the movie binds** (28 distinct ids). An emitter that prints
   `t = <expr>` per op therefore has a use with no declaration for those blocks, and the emitted project's own
   `strict` build — the one the emitter writes — would reject it. The `enumerate` case is the one a reader can
   see coming: the enumeration cursor is *iteration state*, and `Enumerate`'s `1→k+1` stack effect means the
   number of temps pushed is a property of the runtime value, not of the bytes (37 occurrences across root and
   nested IRs in the corpus).
2. **No per-op offsets.** `BasicBlock` carries `firstOffset`/`endOffset`; the ops inside it carry nothing. So
   `CMP-R014`'s statement-level source maps cannot be built: the finest mapping available is
   *statement → the whole block's byte range*, which is a map that attributes a line to an offset it did not
   come from. That is worse than no map, because a debugger using it lies with confidence.

**P6's resolution (in code, this phase).** A block is lowered only when its temp uses and def sites reconcile:
`lower.ts`'s `bindImplicitDefs`/`unboundDiagnosis` walk the ops in order, hand each op with a declared push but
no recorded `result` the next unbound id, and **refuse the block when the counts do not match** — more unbound
ids than implicit pushes, or an id read before the push that would have bound it. A refused block is reported
per block with its reason and deferred to `WP-120-09`'s residual-blob path, so no movie silently loses a
statement. `Enumerate`/`Enumerate2` are refused outright rather than lowered into an invented `avm1.nextKey()`
loop, because the cursor belongs to the interpreter. For the maps, the stage emits **no** `.map` file and
reports `SF0504` (warning) naming what is missing and why, rather than writing a file whose granularity is a
lie. `lower.ts`'s header states the rule so a reader of the emitter finds it there too.

**Asked of P5 (owner: `WP-050-*`, the stack model).** Record a `result` for every value a handler pushes, so
"which temp does this op bind" is a question `ActionIR` answers without reconstruction; the three handlers above
are the whole gap. Adding per-op offsets is *not* asked for here — `CMP-R014` needs a decision about map
granularity first, and it is doc 020's to make, not P6's to assume.

| 2.14 | 2026-10-14 | `E-045` and `E-046`, both from `WP-120-03`/`WP-120-04`: `E-045` (open) — `HostApiGroup` carries a 14th value `timeline` that AVM1-§8.1's 13-row table cannot name, reaching 17 of 119 corpus blocks in 11 of 73 movies, so `requirements` cannot be read as a module list; P6 folds it and reports it, and §8.1 owns the durable fix. `E-046` (open) — three reference sites the model cannot answer (`DefineFont2/3` bitmap glyph ids, `DefineVideo4`'s `DeblockCharacterID`, and a reader that over-ran its tag: `SF0013` is a warning at an offset inside the *next* tag, `quarantined` unset, so a partial payload is indistinguishable from a complete one and no offset rule can attribute it); P6 fails closed on all three and moves the derived signal onto the stage artifact under the new `IMPL-120-R035` |
## E-048 — `CMP-R018`'s worked example contradicts doc 120 §4's tree, `IMPL-120-R017`'s signature, and doc 130's contract module (open)

**Found in:** implementing `WP-120-08`, which has to write the very file the example shows. Four lines of
`// src/movies/Main.actions.ts (generated)`, and each disagrees with a normative rule:

| The example says | The rule says | What P6 emitted |
| --- | --- | --- |
| path `src/movies/Main.actions.ts` | doc 120 §4's tree: `src/frames/movie.ts`, one module per timeline | the tree's path |
| `frame12Actions(self, root, _global)` | `IMPL-120-R017`: `frame<N>(vm, target, frame)`-shaped functions | `(vm: Vm, target: Clip, frame: FrameCtx)` |
| `import type { Clip } from '@swf-forge/avm1'` | doc 130 owns the runtime contract module; `@swf-forge/avm1` is the front end | `@swf-forge/runtime/contract` |
| `$.getTimer()` | `AVM1-R035` names a script's four inputs and no timer accessor; `GetTime` is the op that needs one | `avm1.getTime()`, recorded as a proposal in `emit/surface.ts` |

**Why the example cannot simply be followed.** Two of the four disagreements are not stylistic. `AVM1-R035`'s
three extra parameters are redundant state: the runtime owns the scope chain, the root and `_global` per
activation, so passing them alongside `vm` lets a caller hand a script a root from another movie — a
miscompilation the generated project should be unable to express. And the import line does not resolve: `Clip`
is not in `@swf-forge/avm1`'s public surface (`grep -rn "export type Clip\b|export interface Clip\b"
packages/avm1/src` returns nothing), so copying the example emits a project that fails its own `tsc`.

**Resolution for P6 (in code, this phase).** The normative rules win, and the reasoning is written where a
reader of the emitter will find it — doc 120's new §4.1 — including the mapping from `AVM1-R035`'s four inputs
onto the delivered parameter set (`frame.scope`, `frame.root`, `frame.global`, `target` as self). `$.getTimer`
is the one place the emitter needed a name the specs do not carry, so it became a labelled proposal in the
surface contract rather than an invented runtime method.

**Asked of the spec owners.** `CMP` §5's example restated against the tree and signature doc 120 owns (or the
two rules changed to match the example) — a joint decision for doc 020 and doc 120, not P6's. The runtime half
(`Clip`'s home, the timer accessor, whether `$` reaches globals) belongs to `WP-120-10`'s contract review,
which is where the surface list gets either ratified or corrected.

## E-049 — "residual" is defined twice, by tier in `IMPL-050-R057` and by lowering outcome in `IMPL-120-R018`, and on the corpus the two differ by 68 blocks (open)

**Found in:** implementing `WP-120-09`, which has to decide, for every block, whether a blob exists.

`IMPL-050-R057` makes `ActionIR.residual` — the block-relative slices an interpreter enters — a **tier-2** field,
null otherwise. `IMPL-120-R018` makes the blob the answer to "a block this phase cannot lower", and the emitter's
refusals are not tier verdicts. Over the 73 corpus inputs (119 root blocks) the two readings disagree on most of
the set:

| Measure | Count |
| --- | --- |
| blocks tiered T2, which is what `R057` gives a `residual` list for | 19 |
| blocks the emitter refuses and therefore writes a blob for (`R018`'s set) | 87 |
| refused T0/T1 blocks whose `ir.residual` is `null` | 68 |
| refusal reasons behind those 87 | `unmodeled-op` 68, `tier-2` 19 |

Neither number is wrong; they answer different questions, and the specs let a report line mean either. A runtime
sized by the tier verdict — which is what `AVM1-D03` ("ship the interpreter only if something is residual") and
`IMPL-050-R060`'s `forbid` failure both read against — would see 19 functions while the build that ships carries
87, and `AVM1-R071`'s per-function tier entry in `divergence.json` is written from one of them.

**Resolution for P6 (in code, this phase).** The emitter keeps both answers and states which it used: slices are
recomputed from the CFG for every block (the only way the 68 get a blob at all), the front end's `residual` list is
a cross-check whose disagreement is `SF0505` rather than the source of truth, and `state.emit.residual` carries
bytes plus reason per entry so the `CMP-R026` line can name the set it is counting. `IMPL-120-R018`'s wording is
what `emit/residual.ts` implements.

**Asked of the spec owners.** `IMPL-050-R057` should widen `residual` to "tier 2, **or** a block whose lowering was
refused": the field is already derived from the CFG, so dropping the tier condition costs nothing and removes a
second derivation from the emitter. `IMPL-120-R018` should then say which of the two sets `--vm.residual=forbid`
gates, since `CMP-R026`'s "a T2 function MUST be accompanied by…" is written against the tier set while the flag
is what makes a build fail. A joint decision for doc 050 and doc 120, not P6's.
| 2.15 | 2026-10-14 | `E-047`, from `WP-120-08`: the IR binds some pushed values without recording a `result` (`GetTime`, `PushDuplicate`, `Enumerate`), leaving 17 of 93 corpus T0 root blocks reading a temp nothing defines, and it carries no per-op offsets, so statement-level source maps are unavailable. P6 reconciles the def sites and refuses a block it cannot account for (`WP-120-09` takes the blob), refuses `Enumerate` rather than invent an iteration cursor, and reports `SF0504` for the withheld maps instead of writing a block-granular one |
| 2.16 | 2026-10-14 | `E-048`, from `WP-120-08`: `CMP-R018`'s worked example contradicts doc 120 §4's output tree, `IMPL-120-R017`'s frame-script signature, and doc 130's contract module — and it imports `Clip` from `@swf-forge/avm1`, which publishes no such type, so copying the example emits a project that fails its own build. P6 follows the normative rules, records the resolution in doc 120's new §4.1, and leaves the example to the spec owners; the timer accessor the example assumes became a labelled proposal in `emit/surface.ts` |
| 2.17 | 2026-10-14 | `E-049`, from `WP-120-09`: the residual set is the tier-2 set in `IMPL-050-R057` and the lowering-refusal set in `IMPL-120-R018`, and on the corpus 68 of 87 refused blocks are T0/T1 with `residual: null` — the emitter recomputes slices from the CFG and treats the front end's list as a cross-check (`SF0505`), while `AVM1-D03`, `IMPL-050-R060` and `AVM1-R071` all read a number the specs never pin down |
