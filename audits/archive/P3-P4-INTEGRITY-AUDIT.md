# P3 / P4 Integrity Audit

**Date:** 2026-10-05 · **Auditor:** agent · **Branch:** `arena/01a10928-swf-forge`
**Scope:** P3 (Media decode — `IMPL-060`, `IMPL-070`, `IMPL-080`, `IMPL-090`, `IMPL-110`) and P4 (Static
render — `IMPL-130` §5 renderer half, `specs/web/050-graphics-webgl.md`)
**Authorities:** `docs/impl/000-roadmap.md` (§2 phase table, §2.2 "implemented so far", §6 exit criteria),
`docs/impl/decompiler/060|070|080|090|110-*.md` (work packages, test obligations, diagnostics, done criteria),
`docs/impl/engine-flash/130-runtime-and-renderer.md` (§5, §8, §9, §10), `docs/specs/web/050-graphics-webgl.md` (§18),
`docs/impl/registers/STATUS.md`, `packages/swf/src/diagnostics/codes.ts`.

**Method:** every work package, diagnostic row, and test obligation in the five P3 docs and the P4
spec sections was cross-referenced against code (`packages/swf/src/tags/`, `packages/gfx/src/**`,
`apps/decompiler/src/**`), tests (`packages/*/test/**`, `apps/*/test/**`), the diagnostic registry
(`codes.ts` — parsed programmatically), and then executed: `vitest run` (repo-wide) →
**170/175 pass (22 files)**. The 5 failures are 4 pre-existing P5 AVM1 region tests
(`T-AVM1-016` ×2, `T-AVM1-025` ×2 — known, tracked under P5) and 1 in-flight P2 dump golden
(`T-MOD-037`, broken by the current session's `model-dump.ts` control-fields edit, not a P3/P4 issue).

---

## 1. Verdict summary

| Phase | Verdict | Exit criteria met (roadmap §6) |
| --- | --- | --- |
| **P3** Media decode | **Shapes only, and only at the decoder level.** Doc 060 has a real, well-tested shape/gradient decoder (`shape.ts`, 637 L) with all 16 `SF0180`–`SF0195` diagnostics registered *and* emitted. Docs 070/080/090/110 are **0%**: no decoders, 0 of 71 documented diagnostics registered, 0 of 70 labeled tests, no `assets` pipeline (the `assets` CLI verb prints "not implemented yet"). The decoder is also **not wired into any production path** — the model, `inspect`, and `dump` treat shapes as opaque payloads. | **0 of 5**: `assets dump` PNG/WAV/TTF ❌ · T-SWF-005/006 ❌ · T-AUD-002 ❌ · T-AST-001…004 ❌ |
| **P4** Static render | **A correct CPU reference oracle for one fixture.** `packages/gfx` (1,059 L src) is a solid platform-neutral rasterizer (fills, both fill rules, full cap/join/miter stroke model, flattening, CXFORM, deterministic PNG) with a real end-to-end Appendix A test. But the P4 deliverable — *a no-script SWF rendered in the browser* — does not exist: no WebGL/DOM code at all, 1 of 20 required golden fixtures, no budgets, no context-loss path, and the shape-decode half of the render path lives in a test-local harness. | **0 of 4**: 20 no-script golden frames ❌ · T-GFX-050/021 budgets ❌ · T-GFX-060 context loss ❌ · browser render ❌ |

**Bottom line:** P3 is roughly one-fifth of its documented scope in code (shapes; 16 of 87
documented diagnostics; 5 of 93 labeled test obligations), and even that fifth is not integrated
into the decompiler pipeline. P4 is a well-built reference rasterizer that proves the
pixel/PNG oracle on a single fixture — explicitly a *substitute* for the P4 demo, as roadmap §2.2
itself admits. The roadmap's §2.2 self-report is **accurate** on both counts.

---

## 2. P3 — Media decode

### 2.1 Measurement table (all figures verified programmatically)

| Doc | WPs (days) | Diagnostics documented / registered / emitted | Test obligations labeled in code | Verdict |
| --- | --- | --- | --- | --- |
| 060 shapes/gradients | 14 (42 d) | **16 / 16 / 16** (`SF0180`–`SF0195`) | **5 of 23** (T-MOD-111, 112, 113, 116, 118 — see §2.2 for the label/content mismatch) | ⚠️ decode layer only |
| 070 images/morphs | 14 (47 d) | 20 / **0** / — (`SF0250`–`SF0269`) | **0 of 21** (T-MOD-301…313, 401…408) | ❌ absent |
| 080 fonts/text | 13 (41 d) | 16 / **0** / — (`SF0270`–`SF0285`) | **0 of 18** (T-MOD-501…518) | ❌ absent |
| 090 sounds | 12 (36 d) | 19 / **0** / — (`SF0300`–`SF0309`, `SF0324`–`SF0332`) | **0 of 15** (T-AUD-101…115) | ❌ absent |
| 110 video | 11 (34 d) | 16 / **0** / — (`SF0240`–`SF0249`, `SF0290`–`SF0295`) | **0 of 16** (T-MOD-901…916) | ❌ absent |
| **Total** | **64 (200 d)** | **87 / 16** | **5 of 93** | |

The tag *tables* already recognize every media tag (`tag-codes.ts` lists DefineBits/JPEG2-4,
Lossless/Lossless2, DefineFont1-4, DefineText/2, DefineEditText, DefineMorphShape/2,
DefineSound, SoundStreamHead/2/Block, DefineVideoStream, VideoFrame, JPEGTables with versions),
and the model classifies their kinds (`movie.ts` `characterKindForTag`: `bitmap`, `bitmapLossless`,
`font2/3/4`, `sound`, `video`, `morphShape`, `text`, …) — but **no decoder for any of them exists**.
Every media character in the model is an opaque raw-bytes payload.

### 2.2 Doc 060 — shapes & gradients (the only doc with code)

**What is genuinely implemented** (`packages/swf/src/tags/shape.ts`, 637 L):

| Area | Evidence |
| --- | --- |
| All four DefineShape versions + dispatch (R003) | `decodeDefineShapeVersion` dispatches on tag code; version floors → `SF0183` |
| Style arrays + `0xFF` extended counts | counts at :218/:244; `0xFF` in v1 = literal 255 (`T-MOD-113` tested) |
| All 8 `FillStyleTypes` incl. 4 bitmap modes | `Gradient` (spread/interpolation/focal), `BitmapFill` |
| `GRADIENT`/`FOCALGRADIENT` | spread↔pad/reflect/repeat, interpolation↔rgb/linearRgb, `FIXED8` focal, `SF0192`–`SF0195` |
| `LINESTYLE2` full | caps/join/miter/`NoHScale`/`NoVScale`/`PixelHinting`/`NoClose` |
| All 4 `SHAPERECORD` kinds | straight + quadratic curves (`SB[NumBits+2]` deltas) |
| Style-change state | `StateNewStyles` (v1 tolerated w/ `SF0184`, Shape4 chapter-reserved → `SF0191`), fill0/fill1 run chaining + explicit closure (R030/R031), implicit close → `SF0186` |
| DefineShape4 extras | `EdgeBounds`, `UsesFillWindingRule`, non-scaling strokes |
| Dedupe ceiling | `SF0190` byte-identical style dedupe (tested both fill and line sides) |
| IR | `VectorShape`: fills, lineStyles, edges (from/to + control), `FillPath`/`StrokePath` (1-based `styleId`, `edgeRefs`, `closed`, `implicitClose`), bounds/edgeBounds, `fillRule`, `nonScalingStrokes` |

**Diagnostics: the strongest part of P3.** All 16 `SF0180`–`SF0195` are registered with
severities matching doc §8 (enforced by the `T-SWF-024` registry↔doc test), and — unlike most of
the repo — **all 16 are actually emitted** (verified by usage scan; no dead codes in the shape band).

**Test obligations (doc 060 §9, 23 tests): 5 labeled IDs, 2 partial, 16 absent.**

| Obligation | Status | Where / why |
| --- | --- | --- |
| T-MOD-101…102 (edge decoder: all quadrants, all flag combos, curved deltas) | ❌ | **No curved-edge test exists anywhere** in the shape suite (grep `curve/delta/control` = 0). Curves are implemented but untested |
| T-MOD-103 (fill0/fill1 chaining: rect, donut, self-intersect) | ⚠️ partial | `shape-runs.test.ts` pins rect-style chaining both sides (R030) and the unclosed-run case (R031); donut/self-intersect absent |
| T-MOD-104 (bitmap-fill matrix, all 4 modes) | ❌ | — |
| T-MOD-105 (gradient stop ordering/dup/focal clamping/linear-RGB) | ❌ | decode exists, untested |
| T-MOD-106 (StateNewStyles mid-stream) | ❌ | handled in decoder, untested |
| T-MOD-107/108 (quantisation/simplification determinism, IR stability) | ❌ | **`simplify.ts` does not exist** (WP-060-09's second half) |
| T-MOD-109 (open path with fill closes) | ⚠️ partial | unclosed *fill run* → `SF0186` is tested; the open-subpath close itself is not |
| T-MOD-110 (200-shape corpus, clean run) | ❌ | no shape corpus; only 1 shape-bearing fixture in the repo (`fixtures/appendix-a.swf`) |
| T-MOD-111 (fill rule: winding flag) | ❌ | the *labeled* "T-MOD-111" test is actually Shape4 flag-bit coverage (see finding F3) |
| T-MOD-112 (LINESTYLE2 byte layout + miter cutoff) | ❌ | labeled "T-MOD-112" tests are reserved-mask/Shape4-pre-v8 coverage |
| T-MOD-113 (`0xFF` extended counts) | ✅ | `shape-regressions.test.ts:130` |
| T-MOD-114/115/116/117 | ❌ | 116: labeled test is MoveTo-no-edges (`SF0185`), not the caps×joins matrix; 117 (font-glyph `SHAPE` reuse) impossible — no font decoder |
| T-MOD-118 (DefineShape4 edge bounds vs shape bounds) | ❌ | labeled "T-MOD-118" tests are the `SF0190` dedupe ceiling |
| T-MOD-119…122 (gradient structures → sampler plumbing) | ❌ | — |
| T-MOD-123 (Appendix A shape walk end-to-end) | ❌ | **claimed by the doc's own changelog (v1.3) — see finding F1.** The un-labeled walk exists in `packages/gfx/test/appendix.test.ts` |

**Wired-in? No.** `decodeDefineShapeVersion` has exactly one production caller count: **zero**.
It is exported from `packages/swf/src/index.ts` and called only by `shape-runs.test.ts`,
`shape-regressions.test.ts`, and the P4 gate harness `packages/gfx/test/appendix.test.ts`
(which re-decodes raw tag bytes itself via a test-local `adapter.ts`). `buildMovieModel` records
shapes as opaque characters; `inspect` has no `--shapes` flag (WP-060-11 deliverable absent);
`dump` prints characters without geometry. See finding F4.

### 2.3 Docs 070 / 080 / 090 / 110 — 0%

Nothing exists for any of the four: no decoder files, no model structures, no diagnostics
(0 of 71 registered), no tests (0 of 70 labeled), no tooling. Spot-checked deliverables:

- **070**: no `DefineBits*`/`JPEG*`/`Lossless*` decoder, no morph decode, no `.sfa` writer, no
  re-encode ladder, no texture budget accounting. The `assets` CLI verb is a stub
  (`cli.ts:129`: "not implemented yet (see docs/impl/decompiler/070)").
- **080**: no `DefineFont1-4`/`DefineText`/`DefineEditText` decode, no glyph atlas, no subsetter.
- **090**: no `DefineSound`, no ADPCM (exit gate **T-AUD-002** unmet), no MP3 parser, no stream
  heads/blocks, no resample/peak-RMS.
- **110**: no `DefineVideoStream`/`VideoFrame` decode, no transcoder driver, no Screen Video
  decoders.

Each doc's own done criteria (e.g. 070 §11 "all seven bitmap tags and both morph tags decode; the
corpus runs clean", 090 §12 "ADPCM is bit-exact against reference vectors") are unmet in their
entirety. The 200 person-days of P3 work outside doc 060 are unstarted.

### 2.4 P3 exit criteria (roadmap §6) — 0 of 5

| Criterion | Status |
| --- | --- |
| `swfforge assets dump` writes PNG (shapes/bitmaps) / WAV (sounds) / TTF (fonts) + golden hashes | ❌ verb is a stub; no asset pipeline of any kind |
| Shape decoder handles all edge sizes, both fill rules, all style-change cases (T-SWF-005/006) | ❌ tests absent (decoder itself handles all versions/records — the *gate* is missing) |
| ADPCM bit-exact vs reference vectors (T-AUD-002) | ❌ no ADPCM decoder |
| Bitmap decode parity for JPEG/PNG/lossless (T-AST-001…004) | ❌ no bitmap decoders |

---

## 3. P4 — Static render

### 3.1 What exists: `packages/gfx` (1,059 L src, 9 files) — a CPU reference rasterizer

| Module | Contents |
| --- | --- |
| `vector/geometry.ts` (80 L) | `ShapeGeometry` IR. **`Paint = SolidPaint` only** — "Gradient/bitmap paints arrive with their own work packages" (code comment) |
| `vector/flatten.ts` (99 L) | curve flattening: flatness criterion, ≤ 8 segments, device-px tolerance (GFX-R022) |
| `raster/scanline.ts` (135 L) | fill: analytic in x, 4× supersampled in y; even-odd + non-zero |
| `raster/stroke.ts` (199 L) | stroke expansion: butt/square/round caps, miter/bevel/round joins, miter limit, hairlines, single-run union |
| `render/scene.ts` (215 L) | `DisplayEntry`, `applyOps` (R031), `applyCxform`, `collectDrawItems` |
| `render/renderer.ts` (104 L) | `renderFrame`: rect-clip, scanline fill, stroke raster, PNG hand-off |
| `image/png.ts` (94 L) | deterministic PNG encoder |

Tests (14 total, all passing): `render.test.ts` (11) pins exact-pixel rectangle (`T-GFX-001`),
even-odd vs non-zero hole (`T-GFX-002`), degenerate-subpath drop, flattening criterion/cap,
rect clip, CXFORM mult/add, the three cap types, miter-limit bevel, PNG byte-determinism;
`appendix.test.ts` (3) runs the **end-to-end P4 gate path**: `openSwf` → `buildMovieModel` →
test-local `adapter.ts` (`VectorShape`→`ShapeGeometry`) → `collectDrawItems` → `renderFrame` →
PNG for `fixtures/appendix-a.swf`, asserting the black rectangle outline lands on the appendix's
half-covered rows/columns, the geometry report (1 stroke run, 4 edges, no fills), and deterministic
encoding.

**The honest part:** the package README states exactly this — CPU reference, `SolidPaint` only,
masks "currently clip by the masker's bounds rect", gradients/bitmaps/filters/text "not in this
package yet", and the adapter is explicitly **test-local** pending a production conversion.
Roadmap §2.2 says the same: "browser integration and full P4 gate remain open".

### 3.2 P4 exit criteria (roadmap §6) — 0 of 4

| Criterion | Status | Evidence |
| --- | --- | --- |
| No-script SWF renders its main timeline **in the browser**, frame-accurate (demo) | ❌ | **No browser code anywhere**: grep for `webgl/canvas/document` in `packages/gfx/src` + `apps/decompiler/src` = 0 hits. The only "render a SWF" path is the Node CPU oracle inside a test file |
| Golden frames for 20 no-script fixtures within TST-§6.1 tolerances | ❌ | **1 fixture** (`fixtures/appendix-a.swf`), and its PNG is asserted for cross-call determinism only — no committed golden hash |
| Draw-call + allocation budgets on the standard scene set (T-GFX-050/021) | ❌ | `renderFrame` has no draw-call counting and no allocation measurement; no budget fixture set |
| Context-loss recovery (T-GFX-060) | ❌ | no context, no GL, nothing to lose |

### 3.3 Test obligations

| Suite | Defined | Labeled in code | Notes |
| --- | --- | --- | --- |
| `specs/web/050` §18 (T-GFX-001…060) | **18** | **2** (T-GFX-001 ✅, T-GFX-002 ⚠️ — holes yes, the `stateNewStyles` half no) | An unlabeled CXFORM test ≈ T-GFX-031 content. T-GFX-015 (masks) explicitly open per README. Everything else — seams (005), gradients (010/011), batching (020), allocation (021), text (028), hitTest (030), bitmap sampling (035), blends (040), filters (041), budgets (050/051), context loss (060) — absent |
| `IMPL-130` §8 (T-RT-101…120) | **20** | **0** | runtime-level obligations; P5+ owners per the id-note, but none started |

Renderer work packages `WP-130-06` (renderer, 8 d), `-07` (tessellation, 6 d), `-08`
(gradients/bitmap/masks, 5 d), `-09` (filters, 5 d), `-16` (budgets, 3 d), `-17` (WebGPU, 6 d):
**none implemented.**

---

## 4. Cross-cutting integrity findings (doc ↔ code)

| # | Sev | Finding | Evidence |
| --- | --- | --- | --- |
| F1 | **HIGH** | **Doc 060's changelog v1.3 (2026-10-04) claims "T-MOD-123 asserts the Appendix A shape walk end-to-end" — no such test exists anywhere in the repo.** The *content* partially lives in `packages/gfx/test/appendix.test.ts` (unlabeled), so the claim is a phantom citation rather than a fully missing behavior — but the changelog does not match the code | `grep -r T-MOD-123` = 0 hits in `packages/*/test`, `apps/*/test`; `docs/impl/decompiler/060-shapes-and-gradients.md` §14 |
| F2 | **MED** | **gfx README claims the reference path is "complete and tested (T-GFX-001…T-GFX-002, T-GFX-021)". T-GFX-021 ("zero steady-state allocation over 600 frames") has no test, and no allocation measurement exists in the package.** The claim overstates evidence | `packages/gfx/README.md`; `grep -rn "budget\|5000\|drawCall" packages/gfx` = 1 unrelated comment |
| F3 | **MED** | **Test-ID drift in the shape suite.** Code labels do not match doc 060 §9 contents: code "T-MOD-111" = Shape4 flag bits (doc 111 = fill-rule winding); code "T-MOD-116" = MoveTo-without-edges `SF0185` (doc 116 = caps×joins matrix); code "T-MOD-118" = `SF0190` dedupe (doc 118 = DefineShape4 edge bounds). The labels make 23 obligations look more covered than they are | `shape-regressions.test.ts:82-153` vs doc 060 §9 |
| F4 | **MED** | **The shape decoder is dead in the production pipeline.** `decodeDefineShapeVersion` is called only by tests and the gfx test harness; `buildMovieModel`/`inspect`/`dump` treat shapes as opaque. P3's "decode" therefore does not reach any user-facing surface, and P4's render path depends on a test-local adapter the README concedes must be replaced by a production conversion | `grep -rn decodeDefineShapeVersion packages/swf/src` = definition + re-export only; `movie.ts` has no call |
| F5 | LOW | **Dangling gate IDs.** Roadmap §2's P4 gate row says "T-GFX-001…005, 020, 021", but T-GFX-003/004 are defined in no document (web/050 §18 has 001, 002, 005 in that band) | `docs/specs/web/050-graphics-webgl.md:943-956` |
| F6 | LOW | **Workload mismatch.** Roadmap §2.1 lists P3 at **140 d**, but the five P3 docs' WP tables sum to **200 d** (42+47+41+36+34) | `docs/impl/000-roadmap.md:68` vs each doc's WP table |
| F7 | LOW | **Registry header omits doc 110's second band.** `codes.ts` header lists ranges up to `SF0270`–`SF0289` and jumps to `SF0300`+; `SF0290`–`SF0295` (doc 110, present in STATUS.md as "SF0240–SF0295") is missing from the comment. No code impact (the band is unregistered anyway) | `codes.ts:5-8` vs `STATUS.md` doc-110 row |
| F8 | INFO | **Curved edges are implemented but have zero test coverage** — the single largest untested decode path in `shape.ts` (quadratic `SB[NumBits+2]` deltas, T-MOD-102/115 territory) | `shape.ts:5,62`; shape test suite has no curve fixture |

**Roadmap §2.2 accuracy: ✅.** Its two P3/P4 status lines ("shape/gradient decoding only … image/
font/sound export pipeline and the P3 asset demo remain incomplete"; "platform-neutral reference
renderer over the Appendix A fixture … browser integration and full P4 gate remain open") are
precisely correct.

---

## 5. Ranked gap list (what "done" still requires)

**P3 — in priority order:**

1. **Doc 070 images/morphs** (14 WP, 47 d, 20 codes, 21 tests) — 0%. Unblocks T-AST-001…004,
   the `assets dump` bitmap half, and P4's bitmap paints.
2. **Doc 080 fonts/text** (13 WP, 41 d, 16 codes, 18 tests) — 0%. Unblocks TTF emission and
   P4 text rendering.
3. **Doc 090 sounds** (12 WP, 36 d, 19 codes, 15 tests) — 0%. Exit gate T-AUD-002 (ADPCM
   bit-exact) is the single most self-contained gate left in P3.
4. **Doc 110 video** (11 WP, 34 d, 16 codes, 16 tests) — 0%. Lowest P4 coupling; P10 can absorb it.
5. **060 integration (small, high-leverage):** wire `decodeDefineShapeVersion` into
   `buildMovieModel` (character `geometry` field), add `inspect --shapes` (WP-060-11), and build
   the `assets dump` PNG path for shapes — this converts the decoder from test-only to a real
   pipeline and removes findings F4/F2's downstream effects.
6. **060 test completion:** curved-edge fixtures (T-MOD-102/115 — F8), bitmap-fill matrix
   (T-MOD-104), gradient structures (T-MOD-105/119-122), 200-shape corpus + T-SWF-005/006
   (WP-060-10/14), IR determinism (T-MOD-107/108), and relabel or reassign the drifted
   T-MOD IDs (F3) + retire the phantom T-MOD-123 changelog line (F1).
7. **060 WP-060-09 second half:** `simplify.ts` (quantisation + simplification) — absent.

**P4 — in priority order:**

1. **Production model→`ShapeGeometry` conversion** (replaces test-local `adapter.ts`; the README
   and roadmap already commit to this handoff).
2. **Browser + WebGL2 integration** — the actual P4 demo ("renders in the browser"); nothing
   exists.
3. **Golden-frame suite: 1 → 20 no-script fixtures** with committed hashes (TST-§6.1); the
   Appendix A deterministic-PNG test is the template.
4. **Gradients + bitmaps in the renderer** (`Paint` is solid-only today) — T-GFX-010/011/035,
   WP-130-08.
5. **Real masks** (currently bounds-rect clip per README) — T-GFX-015.
6. **Budgets + context loss** — draw-call counting (T-GFX-020/050), allocation measurement
   (T-GFX-021), context-loss rebuild (T-GFX-060, WP-130-16/17).
7. **Fix the README's T-GFX-021 claim** (F2) when the real test lands.

---

## 6. What is genuinely solid (protect from regression)

- **The `shape.ts` decoder** — complete across all four DefineShape versions, all eight fill
  types, gradients, LINESTYLE2, style-change state, dedupe ceiling, and bounds validation. It is
  the highest-quality media-decode code in the repo.
- **The `SF0180`–`SF0195` band** — the only P3 band where 100% of documented diagnostics are
  registered *and* emitted, with severities pinned by the `T-SWF-024` registry↔doc test.
- **The shape test core** (13 tests): 0xFF count semantics, reserved-flag capture, v1 0xFF
  literal, MoveNoEdges, the `SF0190` dedupe on both style arrays, and the R030/R031 run-chaining
  regressions — each pins a real past decoder bug.
- **The gfx CPU oracle** — exact-pixel fill, even-odd/non-zero, the full cap/join/miter matrix,
  flattening criterion + cap, CXFORM arithmetic, and byte-deterministic PNG. This is the correct
  foundation for every future golden comparison; it should not be rewritten, only fed better
  data (gradients, bitmaps, masks) and more fixtures.
- **The `IMPL-130-R001` import boundary** — ESLint-enforced both directions (`packages/gfx/src`
  may not import `@swf-forge/swf`; `packages/swf/src` may not import `@swf-forge/gfx`), which is
  what keeps the decoder/renderer split clean.
- **Roadmap §2.2** — accurate self-reporting on P3/P4 (contrast with findings F1/F2, where
  *secondary* documents overclaim).
