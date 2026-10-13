# P3 Checkpoint C4 — Fonts & text

Auditor: Arena.ai Agent Mode
Branch: `arena/07fdceae-swf-forge`
Baseline: `7fea5d9` (C3)
Scope: `audits/P3-CHECKPOINTS.md` C4 and `docs/impl/decompiler/080-fonts-and-text.md`
(WP-080-01…10, 13, 14). Runtime HTML/measure/layout/input (WP-080-12, `SF0279`) is P9 and dynamic
subset reachability (WP-080-11) needs AVM1 and is P6 — both out of scope, as are `T-MOD-507`/`508`.

## 1. Verdict

C4 is **complete**. Eight findings, of which **three are defects in shipped code** and one is a
defect in the **audit gate itself**.

The gate defect is the one worth leading with. Two diagnostics, `SF0272` and `SF0273`, had been
sitting on the deferred list under WP-080-07 — apparently unimplemented work. They were in fact
fully implemented and had been for some time. They were invisible to `tools/audit_dev.py` because
the emission used the optional-call form `emit?.(Codes.X, …)`, and the scanner's
`EMIT_START = re.compile(r"\bemit\s*\(")` does not match `emit?.(`. The deferral entry, written in
good faith, then documented the gap as intentional. **The coverage gate was reporting a tooling
blind spot as a scope decision**, and nothing in the process would have caught it.

| Area | Expected | Actual |
|---|---|---|
| `SF0272`/`SF0273` static-text recovery | implement | already implemented; invisible to the gate (`F-P3-17`) |
| `SF0281` glyph fill rule | implement | genuinely new, both decode and emission halves |
| v1 metrics derivation | implement | `SF0275` emission new; derivation existed **twice**, in two packages (finding f) |
| Glyph shape bounds | not in scope | every glyph in every font emitted a spurious `SF0187` and lost its bounds (`F-P3-18`) |
| Static text IR | implement | already correct; needed tests, not code |
| WOFF2 determinism | extend tests | already deterministic; variants were untested |

## 2. What landed

### 2.1 New: `packages/swf/src/fonts/metrics.ts` (161 lines)

| Export | Purpose | Rule |
|---|---|---|
| `codeToGlyph(font)` | character code → glyph, from a **sorted copy** | `IMPL-080-R010` |
| `duplicateCodes(font)` | codes appearing more than once, ascending | `IMPL-080-R010` |
| `normaliseFontUnits(font, upem)` | puts 1024/em and 20480/em fonts on one scale | `IMPL-080-R008` |
| `deriveFontMetrics(font)` | the **single** ascent/descent/leading derivation | `IMPL-080-R007` |
| `DerivedFontMetrics` | result type, with a `derived` flag | — |

All exported from `packages/swf/src/index.ts`.

Two decisions in here are load-bearing:

**`codeToGlyph` sorts a copy.** `IMPL-080-R010` requires an ascending code table; out-of-order
tables exist in the wild and are reported as `SF0276`. The response is to sort *for lookup only*.
Glyph **indices** are positional and are what every `DefineText` record addresses, so renumbering
them to fix the code table would corrupt the text that references the font. Duplicate codes keep the
lowest index, which makes the map a pure function of the font rather than of iteration order.

**`deriveFontMetrics` reports whether it derived.** When the font authored a `FontLayoutTable` the
function returns those numbers with `derived: false`. Callers that need to know whether they are
looking at authored or reconstructed metrics — the atlas, the dump — can tell, instead of each
re-deriving the test and drifting apart.

### 2.2 `SF0281` — the glyph fill-style rule, and what "quarantine" means

`IMPL-080-R009` requires a glyph's first `STYLECHANGERECORD` to set `StateFillStyle0` to index 1.
This was unimplemented. It is now checked in `glyphShape`, and a violating glyph is **quarantined**:
the outline is retained in the model, `quarantined` is set, and `packages/assets/src/fonts.ts`
skips `appendShape` for it while **keeping the glyph's index, `advanceWidth` and cmap entry**.

The retention is not conservatism. Removing the glyph would renumber every later glyph in the font,
and `DefineText` addresses glyphs positionally — a single quarantined glyph would shift every
subsequent character in every text object using that font. The emitted glyph is blank; it is not
absent. `packages/assets/test/font-variants.test.ts` pins both halves: same glyph count and same
cmap as the clean font, zero path commands.

> **Erratum candidate (C7).** The diagnostic registry's wording for `SF0281` says the glyph "was
> quarantined", which reads as *discarded*. The implementable behaviour is *outline withheld, slot
> kept*. The registry text should say so.

### 2.3 `F-P3-18` — a glyph `SHAPE` has no declared bounds

A `DefineShape`'s `SHAPEWITHSTYLE` is preceded by a `RECT`. A **glyph** `SHAPE` is not. `glyphShape`
therefore passed `readShapeWithStyle` a placeholder `{0,0,0,0}` — and `readShapeWithStyle`
unconditionally compared its recomputed outline box against that placeholder, found a disagreement
well beyond the 1% tolerance, emitted `SF0187`, and **set `recomputedBounds` to `null`**.

Consequences, all of which were live before this checkpoint:

1. **Every glyph with an outline, in every embedded font, emitted a spurious `SF0187`.** A 200-glyph
   font produced 200 false warnings, which is enough noise to bury a real bounds disagreement.
2. `recomputedBounds` was always `null` for glyphs. That is the *only* bounds source
   `IMPL-080-R007`'s metrics fallback has, so **the derivation mandated for v1 and layout-less fonts
   could not function at all** — it silently returned zeros.
3. `shape.bounds` stayed the fake `{0,0,0,0}`, so every glyph reported itself as zero-sized.

Fix: `readShapeWithStyle` gained a `boundsAuthored?: boolean` option. When `false` the comparison is
skipped, the recomputed box becomes the shape's `bounds`, and no diagnostic is raised. `glyphShape`
passes it; shape tags do not, so `SF0187` stays live where a `RECT` was actually declared —
asserted explicitly in `font-metrics.test.ts`, because a fix of this shape is one careless
generalisation away from silencing the diagnostic everywhere.

This was found only because the first run of the new `SF0275` test returned `descent: 0` for a font
whose single glyph is 80 twips tall. Nothing else would have surfaced it: no test asserted glyph
bounds, and the spurious diagnostic was a warning in a sink nobody was asserting the contents of.

### 2.4 One derivation, not two (finding f)

`packages/assets/src/fonts.ts` carried its own private `deriveFontMetrics`, independent of the one
C4 was adding to `packages/swf`. `IMPL-080-R007` exists precisely so that layout and the atlas
cannot disagree; two implementations defeat it by construction. The private copy is deleted. What
remains is `openTypeMetrics(font)`, a **sign-convention adapter** — SWF descent is a positive
distance below the baseline, OpenType's `descender` is negative — calling the shared derivation.

T-AST-023's pinned digest did **not** move, confirming the two had not yet drifted. They would
have.

### 2.5 Diagnostics now reaching the sink

`recoverStaticTextCodes` previously returned diagnostics and let `model/movie.ts` forward them,
which is why the `Codes.*` tokens never appeared at a call site. It now takes an optional
`reporter` callback and emits through it with **literal** `Codes.FONT_GLYPH_INDEX_INVALID` /
`Codes.FONT_GLYPH_CODE_MISSING` tokens. `applyFontInfo` got the same treatment, and the `emit?.(`
optional-call form is gone from the codebase.

`text-layout.test.ts` asserts the whole path end-to-end through `buildMovieModel`, so dropping the
forwarding again fails a test rather than only moving a number on the coverage gate.

## 3. `F-P3-17` — the coverage gate's blind spot

`tools/audit_dev.py` decides a diagnostic is "sink-emitted" by scanning source for
`EMIT_START = re.compile(r"\bemit\s*\(")` and reading the first argument. Three forms defeat it:

| Form | Matched? |
|---|---|
| `emit(Codes.X, …)` | yes |
| `emit?.(Codes.X, …)` | **no** — `?.` sits between `emit` and `(`, so `\s*` cannot bridge it |
| `sink(Codes.X, …)`, `report(Codes.X, …)` | **no** — the identifier must literally be `emit` |
| `emit({ code, … })` with a variable `code` | **no** — no literal token to read |

`SF0272`/`SF0273` hit forms 2 and 4 simultaneously. The practical failure mode is nastier than a
missed count: a code that is invisible gets added to `DEFERRED_DIAGNOSTIC_WPS` to make the gate
pass, and the deferral then *reads as a deliberate scope decision* to every subsequent reader. The
gate did not merely fail to report coverage — it manufactured a false record of intent.

This was confirmed empirically during the work: renaming the new local sink from `sink` to `emit`,
changing nothing else, moved `audit_dev` from `new=4` to `new=0`.

The codebase is swept, but **the gate is still fragile** — nothing prevents reintroduction.
Remedy deferred to C7: match the optional-call form, and either resolve single-assignment `code`
variables or require a literal at `emit` call sites via a lint rule.

## 4. Scope items

| # | Item | Status |
|---|---|---|
| 1 | Font v1, glyph SHAPE reuse | ✅ reuse confirmed; `SF0275` now emitted (finding g) |
| 2 | Font2/3 glyphs, metrics, kerning, v2≡v3 after normalisation | ✅ `T-MOD-501`, `T-MOD-503` |
| 3 | FontInfo/2 code maps; indirect name recorded not resolved | ✅ pre-existing `T-MOD-502`/`510`/`518` |
| 4 | Font4 CFF rejection | ✅ pre-existing `T-MOD-511` |
| 5 | FontName licensing verbatim | ✅ pre-existing; surfaced in the dump golden |
| 6 | v1 metrics derivation | ✅ `fonts/metrics.ts`; unblocked by `F-P3-18` |
| 7 | Static Text IR | ✅ `T-MOD-505`/`512`/`513` new; `504` pre-existing |
| 8 | EditText 16 flags + `HasFontClass` | ✅ pre-existing `T-MOD-514` (title corrected, finding e) |
| 9 | Align zones + CSM | ✅ pre-existing `T-MOD-515` |
| 10 | Font atlas determinism | ✅ pre-existing `T-MOD-509` + `assets-dump` goldens |
| 11 | Corpus harness goldens | ✅ new populated-font dump golden (WP-080-13) |
| 12 | Deterministic WOFF2, variants | ✅ `font-variants.test.ts` |
| 13 | WP-080-11/12 | deferred, as scoped |

Item 11 note: the checkpoint says "`inspect --fonts` goldens". No such flag exists — the corpus
harness is `dump`'s `font` summary plus the `assets-dump` atlas/WOFF2 goldens. `T-MOD-044` already
covered the summary but only for an **empty** font, so its `codeTableSha256` was the digest of `[]`.
The new golden uses a two-glyph, wide-code, laid-out font and pins the literal digest. That digest
was **computed by hand** from the intended code table and then checked against the run, not copied
out of a failing assertion — a golden lifted from the implementation pins whatever the
implementation does, including its bugs.

## 5. Tests

| Suite | Tests | Covers |
|---|---|---|
| `packages/swf/test/font-metrics.test.ts` (new) | 35 | `T-MOD-501`, `503`, `510`, `516`, `SF0281`, `SF0275`, `F-P3-10`, `F-P3-18` |
| `packages/swf/test/text-layout.test.ts` (new) | 17 | `T-MOD-505`, `512`, `513`, `SF0272`/`SF0273` end-to-end |
| `packages/assets/test/font-variants.test.ts` (new) | 10 | `T-AST-023` at 20480/em, wide codes, surrogates, quarantine |
| `apps/decompiler/test/dump.test.ts` | +1 | WP-080-13 populated-font golden |
| `packages/swf/test/support/font-bytes.ts` (new) | — | `DefineFont`/`DefineFont2` body builders |

Suite totals: **52 files / 577 tests → 55 files / 640 tests**, all passing.

`T-MOD-505` is a hand-computed offset table, per the exit criteria: one run at x=100 with advances
600/300/450 placing glyphs at 100, 700, 1000, and a second run at x=2000 that must be **absolute** —
accumulating instead would put it at 3450. `T-MOD-513` exists because `XOffset` and `YOffset`
(errata `E-017`) are adjacent `SI16`s: reading them in the wrong order produces a mirrored but
entirely plausible-looking layout, which no smoke test would notice.

## 6. Diagnostic census

| | before | after |
|---|---|---|
| sink-emitted | 170 | **173** |
| deferred | 5 | **2** |
| unmapped | 14 | **12** |
| exception-reported | 1 | 1 |
| registry total | 188 | 188 |

Removed from `DEFERRED_DIAGNOSTIC_WPS`: `SF0272`, `SF0273` (never actually deferred — `F-P3-17`),
`SF0281` (now implemented). Remaining: `SF0279` (WP-080-12, HTML subset parser → P9) and `SF0329`
(WP-090-12, transcode ledger → P6), both legitimately outside P3.

Exit-criteria codes `SF0277`, `SF0278`, `SF0283`, `SF0284` were already live and test-cited.

## 7. Gate sweep

| Gate | Result |
|---|---|
| `typecheck` | clean |
| `lint` (eslint + prettier) | clean |
| `vitest run` | 55 files, 640 tests, all pass |
| `spec:verify` | `ISSUES: 0` |
| `tag:coverage` | all 65 tags dispositioned |
| `test:audit` | 20 tests, OK |
| `audit:dev` | `findings=52 known=57 new=0 fixed=5` |

## 8. Findings ledger

| # | Finding | Status |
|---|---|---|
| a | Diagnostics emitted through a variable `code:` escape the call-site scan | ✅ fixed — `SF0272`/`SF0273` sink-emitted |
| b | `SF0281` (`IMPL-080-R009`) unimplemented | ✅ implemented, both halves |
| c | Stale `applyFontInfo` comment claimed `SF0281` for a glyph-count disagreement | ✅ corrected |
| d | No `codeToGlyph` sorted-copy lookup existed, though `SF0276`'s message claims one | ✅ written |
| e | `T-MOD-516` misattributed to an EditText flag test | ✅ id moved to a real test |
| f | `deriveFontMetrics` duplicated across two packages, against `IMPL-080-R007` | ✅ single implementation |
| g | `decodeDefineFontV1` never emitted `SF0275` | ✅ implemented |
| h | `F-P3-10` glyph half: `glyphShape` inherited `nonZero` winding | ✅ closed |
| **F-P3-17** | `audit_dev` is blind to `emit?.(` and to non-`emit` sink names; a live emission can sit on the deferred list indefinitely, misrecorded as a scope decision | swept; **gate hardening → C7** |
| **F-P3-18** | Glyph `SHAPE`s compared against a placeholder `RECT`: spurious `SF0187` per glyph, `recomputedBounds` nulled, `IMPL-080-R007` derivation non-functional | ✅ closed |

`F-P3-09` is closed. `F-P3-10` is now closed in full (morph half in C3, glyph half here).

## 9. Open items carried forward

- **`SF0281` registry wording** says the glyph "was quarantined", implying discard; the behaviour is
  outline-withheld-slot-kept. Erratum → C7.
- **`F-P3-17` gate hardening** — `audit_dev` should match optional-call syntax, or a lint rule
  should ban `emit?.(`. Until then the deferred list remains trust-on-faith. → C7.
- C3 items still open: `IMPL-070-R027`/`R034` `SF0260` citations, `padEdges` anchor choice,
  duplicated `T-MOD-401`…`408` rows, `F-P3-11` unwired `quantiseShape`/`simplifyShape`,
  `F-P3-14` rounding tie-breaks. All → C7.

## 10. Next checkpoint

**C5 — Audio decode + asset emit (WP-090-01…08, 10, 11).** Frame-subdivision emulation (WP-090-09)
is P8 and transcode budgets (WP-090-12, `SF0329`) are P6; both stay out.
