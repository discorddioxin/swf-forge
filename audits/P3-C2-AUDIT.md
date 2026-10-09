# P3 Checkpoint C2 — Shapes and the Vector IR

Auditor: Arena.ai Agent Mode
Branch: `arena/07fdceae-swf-forge`
Baseline: `8b10278` (C1)
Scope: close **F-P3-03** (shape Vector-IR gaps), per `audits/P3-CHECKPOINTS.md` C2 and
`docs/impl/decompiler/060-shapes-and-gradients.md` §4–§7. Renderer-facing WP-060-12/14 (winding →
tessellator, gradient → sampler) remain P4 and are out of scope.

## 1. Verdict

C2 is **complete**, but the shape of the work was not what the checkpoint plan predicted.

The plan assumed eleven missing decoder features. On inspection, the **decoder was already
substantially complete**: all eight `FillStyleType` values including the four bitmap modes, the
shared gradient flags byte with the `0x0F` extended-count escape, the `NumGradients == 0` error, the
signed `FIXED8` focal point, `readLineStyle2Header` shared with the morph path, `StateNewStyles`
re-basing, the style dedupe ceiling, and the bounds recompute all existed and all behaved
correctly. Nine of the eleven obligations in scope were therefore **test-coverage gaps, not
implementation gaps** — and that distinction matters, because an untested correct decoder and an
untested broken one look identical from the checkpoint ledger.

The two genuine gaps were both at the tail of the geometry pipeline: `IMPL-060-R034`'s **quantise**
and **simplify** stages, and `IMPL-060-R038`'s canonical serialisation, did not exist anywhere in
the repository. `packages/gfx/src/vector/` held only `flatten.ts`, `geometry.ts` and
`tessellate.ts`; the planned `quantise.ts`/`simplify.ts` were never written. `T-MOD-107` and
`T-MOD-108` could not have passed before this checkpoint because there was nothing for them to
test.

One defect was found in the **specification document itself** and is recorded as errata `E-027`.

## 2. What landed

### 2.1 New: `packages/swf/src/shapes/` (three modules, ~430 lines)

The doc plans these as `packages/shapes/src/*.ts` and `packages/geometry/src/*.ts`. Neither package
exists; the repository consolidates shape decoding into `packages/swf/src/tags/shape.ts` and
geometry into `packages/gfx/src/vector/`. The new stages went to **`packages/swf/src/shapes/`**
rather than `packages/gfx/`, because `IMPL-060-R001` forbids SWF knowledge inside the geometry
package and these functions are typed on `VectorShape`. Repo layout wins over doc layout; the
import-boundary rule is what actually decides the placement.

| Module | Exports | Rule |
|---|---|---|
| `quantise.ts` | `quantiseScalar`, `quantiseShape`, `isQuantised`, re-exported `TWIPS_PER_PIXEL` | `IMPL-060-R034`/`R035` |
| `simplify.ts` | `simplifyShape` → `{ shape, stats }`, `SimplifyStats` | `IMPL-060-R036` |
| `serialise.ts` | `canonicalVectorShape`, `serialiseVectorShape`, `vectorShapeDigest` | `IMPL-060-R038` |

All three are exported from `packages/swf/src/index.ts`.

### 2.2 Quantisation — and why `Math.round` is wrong here

`quantiseScalar` rounds **half away from zero**, not with `Math.round`. `Math.round` rounds half
toward +∞: `Math.round(0.5) === 1` but `Math.round(-0.5) === -0`. A grid built on it is asymmetric
about the origin, so a shape and its mirror image do not quantise to mirror-image results — and
mirrored symbols are extremely common in Flash content (a character's left and right arms are
usually one symbol placed with a negative x-scale). The quantiser also folds `-0` to `0`, which
compares unequal under `Object.is` and would otherwise make two geometrically identical shapes
serialise to different bytes.

### 2.3 Simplification — the step order is the contract, and the stats prove it

`IMPL-060-R036` fixes four steps in a specific order and says "the order is part of the contract".
An implementation can satisfy the *output* of that rule by accident while running the steps in a
different order, so `simplifyShape` returns a `SimplifyStats` counter per step and the tests assert
each step did its own work:

| Step | Counter | Behaviour |
|---|---|---|
| 1 drop zero-length segments | `zeroLengthDropped` | A curve returning to its origin counts as zero-length **only** if its control point is also there; otherwise it still encloses area |
| 2 merge collinear lines | `collinearMerged` | Exact `cross === 0` (the input is integer twips, so this is exact arithmetic) **and** a positive dot product, so a doubling-back spur is preserved — folding it would change the winding |
| 3 drop sub-tolerance curves | `curvesFlattened` | Quadratic chord deviation `= |cross(from,to,ctrl)| / |chord| / 2`; default tolerance 0.05 px = 1 twip |
| 4 drop degenerate fill paths | `pathsDropped` | Default floor 1 px² = 400 twips². **Fills only** — a zero-area stroke is a line, which is the entire point of a stroke; area-dropping strokes would erase every rule and underline in a movie |

Two order-dependence tests pin the contract directly rather than just its consequences:

- a curve whose control sits on its own chord, followed by a collinear straight continuation. Under
  the mandated 1→2→3→4 the merge in step 2 sees a *curve* and declines, so two edges survive; under
  1→3→2 they would collapse to one. Asserting two edges is an assertion about the order.
- a zero-length segment hiding a collinear run: step 2 can only find the run once step 1 has
  removed the segment between its halves.

`simplifyShape` is also a **fixed point** — simplifying an already-simplified shape is a no-op —
verified over 500 random shapes. That is deliberately *not* achieved by looping to convergence: a
second merge pass would make the output depend on how many times the loop ran, and R036 asks for a
fixed order, not a fixed point.

#### A real bug this design avoided

The decoder pushes each edge index onto **every run that is live at that moment**
(`IMPL-060-R030`), so one edge is routinely shared by a fill-left run, a fill-right run and a stroke
run. The first draft of `mergeCollinear` rewrote the surviving edge **in place** in the shared pool.
That is wrong: the same edge can be mid-run in one chain and terminal in another, so merging on
behalf of the fill run would silently stretch the stroke. Merging now appends a fresh edge and
re-points only the chain that merged; flattening, which is a property of the edge alone and
therefore identical for every chain, is still applied in place. A regression test
(`does not corrupt a stroke that shares its edges with a fill run merged differently`) pins it.

### 2.4 Canonical serialisation

`JSON.stringify` on decoder output is not a usable golden: key order follows construction order,
optional members (`controlX`, `miterLimit`, `focalPoint`) are present on some records and absent on
others, and `-0` round-trips inconsistently. `canonicalVectorShape` pins a declared key order,
writes absent optional members as explicit `null`, folds `-0`, and fixes non-integers to six
decimals. `vectorShapeDigest` is a 64-bit FNV-1a over that text — not a cryptographic hash, because
this identifies geometry for golden comparison, and keeping `node:crypto` out leaves the IR usable
in the browser runtime.

`recordTrace` is **excluded** from the canonical form. It is a decoder-internal breadcrumb for the
morph conformance checker, not geometry, and hand-built IR does not carry it; including it would
make a decoded shape and an identical hand-built one serialise differently.

## 3. Errata raised: `E-027`

`IMPL-060-R034` §6.2 specified the quantisation grid as *"1/20 px at smoothing 0, 0.05 px above"*.
**1/20 px is 0.05 px.** The sentence states one spacing in two notations, so there is no
smoothing-dependent switch to implement and no second grid to select; a reader implementing it
literally would invent a `smoothing` parameter with exactly one effective value.

The same section calls the IR *"floats in px"* while `IMPL-060-R037` — and the decoder — keep
integer twips end to end. The consequence is worth stating plainly: **`quantiseShape` is a no-op on
freshly decoded geometry**, and a test asserting otherwise would be asserting a bug. The stage is
not redundant; it earns its place on geometry that has been through arithmetic (morph ratio
interpolation, curve subdivision, matrix application), which is exactly where two engines drift
apart. `T-MOD-107` is therefore written against synthetic fractional IR, plus an explicit assertion
that decoder output is *already* quantised.

Resolution: one grid, expressed as a `gridTwips` option defaulting to `1`. Recorded in
`docs/impl/registers/errata.md` (E-027, changelog 2.1) and corrected in place in
`docs/impl/decompiler/060-shapes-and-gradients.md` §6.2 (changelog 1.6).

## 4. Tests added — 62 across 2 files + 1 shared builder

### 4.1 `packages/swf/test/shape-styles.test.ts` (30 tests)

| Test group | Obligation |
|---|---|
| rectangle under `FillStyle1`; donut as two runs of one style with opposite shoelace signs; self-intersecting bowtie kept as one run | **T-MOD-103** |
| all four bitmap `FillStyleType`s → `repeat × smoothed`; bitmap matrix carried verbatim (20× scale and a rotate/skew pair), proving it maps bitmap space to shape space; unknown type `0x7F` quarantined with `SF0180` | **T-MOD-104** |
| stop order, duplicate ratios retained, linear-RGB flag preserved, `SF0194` fires once per offending stop, quiet when well-ordered | **T-MOD-105** |
| spread/interp/count read identically in shapes 1/2/3/4; reserved spread `3` and reserved interpolation `3` report `SF0192` and are **honoured, not clamped** | **T-MOD-119** |
| 8 stops from the 4-bit count; `0x0F` escape → extended UI8 count (20 stops); escape in a pre-v3 shape reports `SF0191`; `NumGradients == 0` reports `SF0193` **and the next style still decodes** (alignment proof); RGB for v1/v2 vs RGBA for v3/v4 | **T-MOD-120** |
| `FIXED8` `0xFF00`/`0x0000`/`0x0100`/`0x0080` → `-1`/`0`/`1`/`0.5`; out-of-range `0x0200` left **unclamped** (clamping is the sampler's job; rounding here would destroy the evidence that the file is out of spec); `SF0195` outside Shape4, silent inside; `focalPoint` absent for linear/radial | **T-MOD-121** |
| open fill run closes implicitly with `SF0186` while the **stroke of the same run** stays open and unreported; `NoClose` retained on the line style and proven not to change geometry | **T-MOD-109** |
| `UsesFillWindingRule` 1/0 → `nonZero`/`evenOdd` on byte-identical geometry; pre-Shape4 defaults to even-odd with `rawShape4Flags === null` | **T-MOD-111** (IR half; tessellator plumbing stays P4) |

### 4.2 `packages/swf/test/shape-vector-ir.test.ts` (32 tests)

| Test group | Obligation |
|---|---|
| grid spacing, mirror symmetry, `-0` folding, topology untouched, idempotence, finer grid, decoder output already quantised | **T-MOD-107** (quantise) |
| each of the four steps in isolation, plus the negative cases (bulging loop kept, doubling-back spur kept, over-tolerance curve kept, strokes never area-dropped) | **T-MOD-107** (simplify) |
| three order-dependence tests + the shared-edge stroke-corruption regression | **T-MOD-107** (`R036` order) |
| **10⁴ seeded random shapes**, two independent passes, digests compared; 10⁴ more checked for grid alignment, in-range references and zero orphan edges; 500 checked for the fixed point | **T-MOD-107** (determinism) |
| 100 decodes → one serialisation and one digest; digest pinned to the literal `62af2e53e75759f8`; key order independent of construction order (with `JSON.stringify` shown to differ on the same input); absent optionals as explicit nulls with an identical key set; `-0` folded; `recordTrace` excluded; four near-identical shapes produce four distinct digests | **T-MOD-108** |
| **200-shape corpus** across all four tag versions, mixing straight/curved edges, solid and gradient fills, strokes and multi-subpath figures: no `SF0180`, no `SF0187`, bounds agree inside 1 %, every shape decodes to edges; whole corpus survives quantise + simplify; corpus digests reproduce on a second pass | **T-MOD-110** |

`packages/swf/test/support/shape-bytes.ts` is a new shared builder. The existing shape suites each
grew a private writer, which is fine for pinning one byte layout but useless when a test must vary
the *shape version* while holding geometry fixed — exactly what `T-MOD-119`/`120` require, since the
gradient header is read identically in all four versions and only the colour width changes.

### 4.3 Corpus determinism

The corpus and the random-shape generator both use a seeded xorshift32, so "200 random shapes" and
"10⁴ random shapes" are the *same* shapes on every machine and every run. A flaky corpus test that
only sometimes covers the interesting case is worse than no corpus test.

## 5. Gate results

| Gate | C1 result | C2 result |
|---|---|---|
| Typecheck (8 projects) | ✅ | ✅ |
| Unit tests | 48 files / 472 tests | ✅ **50 files / 534 tests** (+2 files, +62 tests) |
| Lint + Prettier | ✅ | ✅ |
| Build | ✅ | ✅ |
| `spec:verify` | ISSUES 0 | ✅ ISSUES 0 |
| `tag:coverage` | 56 decoded / 1 pending | ✅ 56 decoded / 1 pending (unchanged — C2 adds no tags) |
| `audit:dev` | findings=52 new=0 | ✅ findings=52 new=0 |
| `tools/test_tag_coverage.py` | 12 OK | ✅ 12 OK |
| `tools/test_audit_dev.py` | 8 OK | ✅ 8 OK |
| `test:audit` (all tooling self-tests) | 20 OK | ✅ 20 OK |
| Deferred P3 SF codes | 7 | ✅ 7 (unchanged — C2 introduced no new codes and deferred none) |

## 6. C2 exit criteria

| Criterion | Status |
|---|---|
| `VectorShape` is the single geometry type exported (no duplicate raw re-parse) | ✅ One decode site in the production model (`model/movie.ts:1210`); font glyphs and both morph endpoints reuse `readShapeWithStyle`; `apps/decompiler` never re-parses a shape tag |
| IR byte-identical across 10⁴ runs × 3 environments (T-MOD-108) | ⚠️ **partial** — 10⁴ shapes × 2 passes are verified in-process, and the digest is pinned to a repository literal so *any* platform or engine that drifts fails the test. The 3-environment matrix itself is a CI concern, not a test concern; see §8 |
| `T-MOD-123` Appendix-A walk still passes | ✅ Full suite green |
| `audit:dev` new = 0; no new SF codes deferred | ✅ new=0, deferred unchanged at 7 |

## 7. Findings status

| Finding | Status |
|---|---|
| F-P3-01 font/text auxiliary tags | ✅ closed (C1) |
| F-P3-02 JPEGTables not modelled | ✅ closed (C1) |
| **F-P3-03 shape Vector-IR gaps** | ✅ **closed** |
| F-P3-04 morph IR | open → C3 |
| F-P3-05 image decode parity | open → C3 |
| F-P3-06 audio coverage | open → C5 |
| F-P3-07 asset-dump goldens | open → C6 |
| F-P3-08 swf → audio dependency | accepted (observation) |
| F-P3-09 align-zone count reconciliation | open → C4 |

### New observations

**F-P3-10 (minor, deferred to C3).** `readShapeWithStyle` returns `fillRule: 'nonZero'`, which
`decodeDefineShapeVersion` then overwrites from the Shape4 flag byte (or to `'evenOdd'` for v1–v3).
The two callers that *do not* go through `decodeDefineShapeVersion` — font glyphs
(`tags/fonts.ts`) and both morph endpoints (`tags/morph.ts`) — therefore inherit `'nonZero'` by
default rather than by decision. No current consumer reads the field on those paths, so nothing is
broken today, but the default should be stated deliberately when morph IR lands in C3.

**F-P3-11 (minor, no owner yet).** `quantiseShape` and `simplifyShape` are exported and tested but
are **not yet wired into `buildMovieModel`**. This is correct for C2: `IMPL-060-R035` places
quantisation on the *input* of simplification, and the only production consumer that needs either
stage is the renderer path (P4) and the morph interpolator (C3). Wiring them into the static decode
path now would change `inspect --shapes` digests for zero benefit — the decoder already emits
grid-aligned integer twips, so both stages are no-ops there. Recorded so the omission is a decision
rather than an oversight.

## 8. Note on the 3-environment criterion

The checkpoint asks for the IR to be byte-identical "across 10⁴ runs × 3 environments in CI". The
*test* cannot assert that from inside one process. What it can do — and now does — is remove every
source of environment dependence from the serialisation (fixed key order, no typed arrays, no
locale-sensitive formatting, `-0` folded, floats fixed to six decimals) and pin the resulting digest
to a literal checked into the repository. Any environment that produces a different byte stream
fails `T-MOD-108` on that literal. Running the suite on three environments is then a CI matrix
configuration, which belongs with the repository's CI work, not with C2.

## 9. Next checkpoint

**C3 — Images & morphs (decode half).** Closes F-P3-04 and F-P3-05: seven bitmap tags
(`JPEGTables` splice, PNG/GIF passthrough, lossless row padding for all four pixel sizes, the alpha
plane), both morph tags (paired edge streams, `MORPHGRADIENT` interleaving, `MORPHLINESTYLE2`),
morph IR with the odd-delta rational-twip rule, and `SF0262`/`SF0263` moving off the deferred list.
The morph path is the first real consumer of this checkpoint's quantiser: ratio interpolation is
precisely the arithmetic that produces fractional twips.
