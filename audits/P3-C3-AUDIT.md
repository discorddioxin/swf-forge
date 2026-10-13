# P3 Checkpoint C3 — Images & Morphs (decode half)

Auditor: Arena.ai Agent Mode
Branch: `arena/07fdceae-swf-forge`
Baseline: `0b768ed` (C0–C2)
Scope: close **F-P3-04** (morph IR) and **F-P3-05** (image decode parity), per
`audits/P3-CHECKPOINTS.md` C3 and `docs/impl/decompiler/070-images-and-morphs.md`
(WP-070-01…05, 10…14). Build-side WP-070-06…09 — classification, the re-encode ladder, mips, `.sfa`
round-trip and texture budgets — are P6 and out of scope, as are `T-MOD-306`/`307`/`308`.

## 1. Verdict

C3 is **complete**. As in C2, most of the planned decoding already existed; unlike C2, the survey
turned up **three real defects in shipped code**, two of which traced back to defects in our own
specification documents. Two errata are raised: `E-028` and `E-029`.

The honest summary of where the time went:

| Area | Expected | Actual |
|---|---|---|
| Image decode | build `decodeBitmap` paths | already correct; the `JPEGTables` splice was wrong in three ways (`F-P3-15`) |
| Morph decode | build `DefineMorphShape`/`2` | already correct, except `morphGradient`'s header byte (`F-P3-13`) |
| Morph IR | new module | genuinely new (`shapes/morph-ir.ts`, 287 lines) |
| Static gradients | not in scope | an invented `0x0F` escape had to be removed first (`F-P3-12`) |

One of those defects — `F-P3-12` — was **cemented by C2's own tests**, which is the most
uncomfortable result in this record and is written up in full in §3.1.

## 2. What landed

### 2.1 New: `packages/swf/src/shapes/morph-ir.ts`

| Export | Purpose | Rule |
|---|---|---|
| `roundTiesToEven` | banker's rounding for interpolated twips | `IMPL-070-R030` |
| `interpolateMorph(model, ratio, opts)` | `MorphShapeModel` + `Ratio` → `VectorShape` | `IMPL-070-R023`/`R031` |
| `bakeMorphRatios(model, opts)` | the runtime-vs-baked decision | `IMPL-070-R032`, `GFX-D14` |
| `MorphEmit`, `MorphInterpolateOptions`, `MorphBakeOptions`, `MorphBakedFrame`, `MorphBakeResult` | types | — |

All exported from `packages/swf/src/index.ts`. This module is the live emission site for **`SF0262`**
and **`SF0263`**, which are now off `DEFERRED_DIAGNOSTIC_WPS` in `tools/audit_dev.py`.

**Endpoint exactness.** `interpolateMorph` returns `model.start` / `model.end` *by identity* at ratio
0 / 65535. That is not an optimisation — it is the rule. A straight edge paired against a curve is
promoted to a quadratic for interpolation (`control = delta / 2`), and evaluating that promotion at
`t = 0` gives a curve, not the straight edge the static shape has. Returning the original endpoint
object is the only way the IR at ratio 0 can be byte-identical to the static counterpart.

**The lerp form matters.** Interior ratios use `(1 - t) * a + t * b`, never `a + t * (b - a)`. The
second form is the familiar one and it is not exact at `t === 1` in IEEE 754. Since the endpoints are
short-circuited this is belt-and-braces, but a future caller that reaches an interior ratio of
`65534/65535` should not see the geometry overshoot.

**Rounding.** `roundTiesToEven` rounds half to even and folds `-0` to `0`. See `F-P3-14` for why this
is deliberately *not* C2's `quantiseScalar`.

**Ratio baking.** The default is `ratioBake: []` — runtime interpolation, per `GFX-D14`. `SF0262`
fires on **both** the runtime and the baked path, so silence in a report can never be confused with
"the stage did not run". Configured ratios are de-duplicated, filtered to integers in `0…65535`, and
sorted, so frame order is a pure function of the configuration rather than of argument order. The
vertex budget (`pairs.length * 2` per frame, default 65 535) reflects 16-bit index buffers on the GL
ES 2 floor; exceeding it drops the mesh with `SF0263` rather than emitting a half-baked animation.

### 2.2 Changed: `packages/assets/src/images/decode.ts`

- New `removeErroneousMarkers` — a marker-walking splice of every `FFD9 FFD8` pair ahead of the frame
  header, replacing a four-byte prefix test. See `F-P3-15` and `E-029`.
- New `tablesBody` — strips the `JPEGTables` wrapper, removing the trailing `EOI` **only if it is
  there**.
- New exported `spliceJpegTables(image, tables)` — the merged stream, so `T-MOD-301` can byte-compare
  it instead of inferring it from pixels.
- `SF0258`'s message now carries the number of pairs removed.

### 2.3 Changed: `packages/swf/src/tags/shape.ts`, `packages/swf/src/tags/morph.ts`

- `readGradient` no longer implements a `0x0F` → `UI8` extended-count escape (`F-P3-12`).
- `morphGradient` reads **one** `GRADIENT`-style header byte instead of count-then-flags
  (`F-P3-13`, `E-028`), and now reports a reserved mode and an empty ramp exactly as the static path
  does.
- `readShapeWithStyle` gained a `fillRule` option; morph endpoints pass `'evenOdd'` explicitly
  (`F-P3-10`, closed).

## 3. Findings

### 3.1 `F-P3-12` — an invented `0x0F` escape in the static gradient header (**and C2's tests pinned it**)

`readGradient` treated a low nibble of `0x0F` as an escape introducing a following `UI8` count, so a
legitimate 15-stop gradient consumed one byte too many and every subsequent style in the array was
read from the wrong offset.

No such escape exists. `IMPL-060` §4.3 (`IMPL-060-R013`…`R022`) specifies `NumGradients UB[4]` with a
hard ceiling of 15 and no escape; Ruffle's `read_gradient_flags()` reads one `u8` and masks
`f & 0b1111`; the `0xFF` → `UI16` escape in SWF applies to *style array counts*, not to this nibble.
The escape appears to be a transplant from that unrelated rule.

**What makes this a process finding rather than a code finding:** C2 added two tests for the escape
— and they passed, because they were written against the implementation. `shape-bytes.ts` even grew
a `forceExtendedCount` option whose only purpose was to emit the invented byte sequence. The tests
did not catch the defect; they documented it and made it look deliberate. The C2 audit's claim that
"the shared gradient flags byte with the `0x0F` extended-count escape … existed and behaved
correctly" is **withdrawn**.

Fixed: the nibble is the literal count. `SF0191` was repointed from the dead escape path to a real
condition — a count of 9…15 in a pre-SWF 8 shape, where the legacy ceiling was 8 — honoured rather
than clamped. The `forceExtendedCount` builder option is gone, and the two bad tests were replaced by
three: 15 stops read literally **with `consumed === bytes.length`** so a stray byte cannot hide, a
pre-v8 9-stop case asserting `SF0191`, and a Shape4 12-stop case asserting `SF0191` is *not* emitted.

### 3.2 `F-P3-13` — `morphGradient` read two bytes where the format has one (`E-028`)

`morphGradient` read a `UI8` count and *then* a flags byte. The structure has a single byte with
Ch.7's `GRADIENT` layout. The extra read swallowed the first `MORPHGRADRECORD`'s `StartRatio`, so the
gradient still decoded — with one dropped stop and a wrong spread/interpolation pair — and every
later fill style in the array was shifted by one byte. The symptom appears in an unrelated style,
which is why this survived.

Our own documents were the cause, and they disagreed with each other and with themselves:

| Source | Claim |
|---|---|
| `IMPL-070-R025` | `NumGradients UI8` (1…8), no flags byte |
| `IMPL-070-R028` | one flags byte "per state", differences reported as `SF0192`-class |
| `specs/110` §10.7 | `NumGradients UI8` **then** one flags byte |
| Reality | one byte: `SpreadMode UB[2]`, `InterpolationMode UB[2]`, `NumGradients UB[4]` |

The implementation matched the appendix. All three documents are corrected under `E-028`, including
withdrawing `R028`'s per-state comparison, which describes a condition that cannot arise: there is
one header byte for the pair, so the two states' modes are equal by construction.

`T-MOD-405`'s fixture now writes `0x92` (spread 2, interpolation 1, count 2) and asserts both modes
on **both** endpoints, so the two-byte read cannot return silently.

### 3.3 `F-P3-14` — the pipeline now has two rounding tie-breaks (**open recommendation**)

C2's `quantiseScalar` rounds **half away from zero**, chosen so that a shape and its mirror image
quantise to mirror-image results. C3's `roundTiesToEven` rounds **half to even**, which
`IMPL-070-R030` names explicitly.

Both are symmetric about the origin, so round-half-even satisfies C2's stated requirement as well —
and it is additionally unbiased, which half-away-from-zero is not. Unifying on round-half-even would
be a small improvement in principle. It is **not** done here: it would churn the pinned
`62af2e53e75759f8` digest and several C2 tests for no correctness gain on integer-twip input, where
the two functions never disagree (they differ only on exact halves, which decoded geometry does not
contain). Recorded as a recommendation for C7, not an open defect.

### 3.4 `F-P3-15` — the `JPEGTables` splice mishandled the erroneous marker pair three ways (`E-029`)

1. **The pair was only stripped from the image.** A pair on the `JPEGTables` side survived
   `tablesBody`'s SOI test (the block starts `FF D9`, not `FF D8`) and landed immediately after the
   synthesised `SOI` — the worst possible position, since every standard decoder stops at that `EOI`.
2. **Only a prefix was recognised.** The pair occurs anywhere before the frame header; it is the seam
   a producer's own glue leaves behind. Ruffle's `remove_invalid_jpeg_data` documents the same
   conclusion from observed content (ruffle-rs/ruffle#8775), and also notes the errata's "before
   version 8" qualifier does not hold — a v9 SWF can carry it.
3. **The trailing `EOI` was chopped unconditionally.** `tables.subarray(start, length - 2)` removes
   two real bytes from the final table of any producer that omitted its `EOI`.

There is also a genuine ambiguity in the errata, now handled rather than guessed: the real `SOI` may
*follow* the pair (`FFD9 FFD8 | FFD8 …`) or the pair's own `FFD8` may be serving as it. Ruffle strips
four bytes, our old code stripped two; each is correct for one reading. We now remove the pair and
restore an `SOI` only when one is not already present, which accepts both.

The scan deliberately stops at `SOF`/`SOS`: past that point the bytes are entropy-coded, and
rewriting `FF D9` there would corrupt the picture. A negative test pins that.

### 3.5 `F-P3-10` — morph endpoints' fill-winding rule (**closed**)

Carried over from the C2 audit. `readShapeWithStyle` returned `fillRule: 'nonZero'` as a placeholder
that `decodeDefineShapeVersion` overwrote; morph endpoints bypass that function and inherited the
placeholder. Neither morph tag has a fill-winding flag — `DefineMorphShape2`'s flag byte carries only
`UsesNonScalingStrokes`/`UsesScalingStrokes` and six reserved bits — so the endpoints take
`DefineShape1`–`3`'s default, **even-odd**. `readShapeWithStyle` now accepts an explicit `fillRule`
and `tags/morph.ts` passes it. This matters directly to C3's exit criterion: `fillRule` is part of
the canonical serialisation, so a morph endpoint carrying `nonZero` could not be IR-identical to the
static shape it is supposed to equal. (Font glyphs still inherit the placeholder; no consumer reads
it on that path, and the decision belongs with C4.)

## 4. Errata raised

- **`E-028`** — `MORPHGRADIENT` is one Ch.7-style `GRADIENT` header byte. Corrects `IMPL-070-R025`,
  withdraws `IMPL-070-R028`'s per-state modes, fixes the §6.2 and `specs/110` §10.7 layouts.
  (`IMPL-070` 1.2, `specs/110` 1.8, errata 2.2.)
- **`E-029`** — the erroneous `FFD9FFD8` pair is not restricted to a prefix, is not version-gated,
  and must be removed from the `JPEGTables` payload and the merged stream too. Corrects
  `IMPL-070-R004`; makes `IMPL-070-R005`'s `EOI` removal conditional.

## 5. Tests added — 43 across 2 new files, plus 4 corrected in place

### 5.1 `packages/swf/test/morph-ir.test.ts` (22 tests) — `T-MOD-401`, `T-MOD-402`

| Group | Covers |
|---|---|
| `roundTiesToEven` (3) | ties to even in both directions; unbiased over 100 halves where `Math.round` drifts by exactly 50; no `-0` |
| `T-MOD-401` (6) | ratio 0/65535 serialise **and digest** identically to `model.start`/`model.end`; a promoted straight edge comes back straight; style endpoints exact; monotone interior; out-of-range ratios clamp; `fillRule` stated |
| `R030` rational twips (3) | an odd delta halves to 50.5 with `SF0266`; `round: false` preserves it; the interpolation rounds once rather than per component |
| `T-MOD-402` (4) | fill styles pair by index with index 0 reserved; a kind change keeps the start kind; line width/colour interpolate from the shared flag word; a short endpoint array falls back rather than holing |
| `R032` baking (6) | runtime default emits `SF0262`; configured ratios bake and report; de-dup + sort make frame order configuration-independent; over-budget drops with `SF0263`; out-of-range ratios rejected; baked frames equal `interpolateMorph` |

### 5.2 `packages/assets/test/bitmap-layout.test.ts` (20 tests) — `T-MOD-301`, `302`, `303`

| Group | Covers |
|---|---|
| `T-MOD-301` (10) | exact merged bytes; no interior `EOI`/`SOI` and ≠ naive concatenation; the pair on the image, on the tables, in the interior; both `SOI` readings; tables without `EOI`; entropy-coded bytes after `SOS` preserved; `SF0258` once per asset; `SF0251` with no tables |
| `T-MOD-302` (4) | 3×3 `PIX24` rows in place; the 253-px 8-bit row padding to 256 with garbage in the pad bytes; a 3-px `PIX15` row padding to 8; a 27-byte payload (3 B/px, no padding) rejected as `SF0250` rather than smeared |
| `T-MOD-303` (6) | `PIX24` as `X R G B`; `ALPHABITMAPDATA` as `A R G B` + un-premultiply; **the same four bytes** decoding differently under `DefineBitsLossless` vs `2`; four corner colours proving row-major order; `RGB` vs `RGBA` palettes; unknown format refused |

The `T-MOD-303` "same bytes, two tags" case is the one worth keeping: `[128, 64, 32, 16]` must give
`[64, 32, 16, 255]` as `PIX24` and `[64, 32, 16, 128]` as `ARGB`. A decoder with the channel order
wrong in a *consistent* way passes most single-tag fixtures.

### 5.3 Corrected in place

`packages/swf/test/shape-styles.test.ts` (2 bad tests → 3 good), `packages/swf/test/morph.test.ts`
(`T-MOD-405` rewritten), `packages/swf/test/support/shape-bytes.ts` (`forceExtendedCount` removed).

### 5.4 Already covered, verified not re-added

`T-MOD-305` (PNG/GIF passthrough + the SWF 8 gate) and `T-MOD-304` (alpha-plane rules) are in
`packages/assets/test/bitmap.test.ts`. `T-MOD-403`…`408` (edge pairing, `Offset`/`SF0264`,
`MORPHLINESTYLE2`) are in `packages/swf/test/morph.test.ts`.

## 6. Gate results

| Gate | Result |
|---|---|
| `pnpm typecheck` | pass (8 projects) |
| `pnpm lint` | pass (eslint + prettier) |
| `pnpm test` | **577 passed / 577**, 52 files (baseline `0b768ed`: 534) |
| `pnpm audit:dev` | `findings=52 known=57 new=0 fixed=5`; **`NEW FINDINGS: 0`** |
| `pnpm tag:coverage` | 65/65 dispositioned; 56 decoded, all evidence verifies |
| `pnpm spec:verify` | `ISSUES: 0` |
| `pnpm test:audit` | 20/20 |

`audit_dev` now reports **5 deferred** diagnostics, down from 7: `SF0262` and `SF0263` have live
emission sites in `shapes/morph-ir.ts`. `tools/test_audit_dev.py`'s expected map was updated in the
same change, so the two files cannot drift apart silently.

Test delta is **+43** against the checkpoint plan's **+8**. The overshoot is `F-P3-12`/`F-P3-15`:
both defects needed negative tests (the stray byte, the interior pair, the preserved scan data) that
the plan had no reason to anticipate.

## 7. C3 exit criteria

| Criterion | Status |
|---|---|
| All seven bitmap tags decode on the corpus | ✅ `tag:coverage` 65/65; tags 6, 8, 20, 21, 35, 36, 90 dispositioned |
| `SF0262`/`SF0263` live and off the stale list | ✅ emitted from `shapes/morph-ir.ts`; removed from `DEFERRED_DIAGNOSTIC_WPS` and its test |
| PNG/GIF passthrough byte-identical | ✅ `T-MOD-305`; the payload is held as a view and asserted identical by reference |
| Lossless pixels within AST-R03 tolerances | ✅ exact, not merely within tolerance: all `T-MOD-302`/`303` cases assert literal RGBA |
| Morph endpoints IR-identical to static | ✅ `T-MOD-401` compares both `serialiseVectorShape` and `vectorShapeDigest`; `F-P3-10` closed so `fillRule` agrees |
| `SF0250`–`SF0260` emit sites verified | ✅ none deferred, none unmapped in `audit:dev` |

## 8. Findings status

| Finding | Status |
|---|---|
| F-P3-01 font/text auxiliary tags | ✅ closed (C1) |
| F-P3-02 JPEGTables not modelled | ✅ closed (C1) |
| F-P3-03 shape Vector-IR gaps | ✅ closed (C2) |
| **F-P3-04 morph IR** | ✅ **closed** |
| **F-P3-05 image decode parity** | ✅ **closed** |
| F-P3-06 audio coverage | open → C5 |
| F-P3-07 asset-dump goldens | open → C6 |
| F-P3-08 swf → audio dependency | accepted (observation) |
| F-P3-09 align-zone count reconciliation | open → C4 |
| **F-P3-10 morph/glyph fill-winding default** | ✅ **closed for morphs**; glyph path → C4 |
| F-P3-11 `quantiseShape`/`simplifyShape` unwired | still unwired; `morph-ir.ts` does its own rounding, so no consumer appeared in C3 |
| **F-P3-12 invented `0x0F` gradient escape** | ✅ **closed** (and C2's claim withdrawn) |
| **F-P3-13 `morphGradient` two-byte header** | ✅ **closed** (`E-028`) |
| **F-P3-14 two rounding tie-breaks** | open recommendation → C7 |
| **F-P3-15 `JPEGTables` splice marker handling** | ✅ **closed** (`E-029`) |

## 9. Open items carried forward

- **`IMPL-070-R027`/`R034` cite `SF0260` for morph concerns**, but `SF0260` is registered as "unknown
  lossless `BitmapFormat`". `R034`'s "same fill *type* per style index" is almost certainly `SF0268`,
  which `compatibleStyles` already emits. Not raised as errata yet — the citation needs checking
  against `R027`'s separate concern (style *count* mismatch, currently `SF0181`) before a correction
  is written. → C7.
- **`padEdges` pads at the last edge's endpoint**, whereas `IMPL-070-R029` says "zero-length at the
  neighbouring anchor". Equivalent for a tail deficit, not obviously right for an interior one.
  `T-MOD-403` passes, but it only exercises the tail case. → C7.
- **The duplicated `T-MOD-401`…`408` rows** in `IMPL-070` §9's test table are a documentation
  artifact, not two sets of obligations. Harmless; worth tidying in C7's doc pass.

## 10. Next checkpoint

**C4 — Fonts & text (WP-080-01…10, 13, 14).** Closes `F-P3-09`, takes `SF0272`/`SF0273`/`SF0281` off
the deferred list, and owns the glyph half of `F-P3-10`. Runtime HTML/layout/input (WP-080-12,
`SF0279`) and dynamic subsetting (WP-080-11) stay out.
