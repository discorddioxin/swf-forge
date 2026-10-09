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
Inf/NaN) and treat the "bias 16" sentence as a documentation error. `FLOAT16` does not appear in any
AVM1-era tag we parse, so the risk is contained; if a future chapter shows a structure that consumes
it, this entry gets re-opened and the consuming structure gets a fixture.

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
**Encoded by:** `IMPL-050-R003`, `IMPL-050-R025`, `APP-§10.3`, and tests `T-AVM1-001`/`T-AVM1-002`/`T-AVM1-015`.

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
| 2.2 | 2026-10-09 | `E-028`: `MORPHGRADIENT` is a single Ch.7-style `GRADIENT` header byte — `IMPL-070-R025` (`UI8` count) and `specs/110` §10.7 (count *then* flags) were both wrong, the latter consuming a byte too many and shifting every later morph fill style; `IMPL-070-R028`'s per-state modes withdrawn. `E-029`: the erroneous `FFD9FFD8` pair occurs anywhere before the frame header, is not version-gated, and must be removed from the `JPEGTables` payload and the merged stream as well as the image |
