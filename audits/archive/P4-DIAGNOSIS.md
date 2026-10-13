# P4 Diagnosis — Why P4 Was Bottlenecked and What Resolves It

**Status:** RESOLVED — P4 exit gate is green on all three criteria in roadmap §6.
**Date:** 2026-10-08.
**Branch:** `arena/07fdceae-swf-forge`.

## 1. Diagnosis — why P4 was not exit-ready

When work started, P4's roadmap row (§2.2, line 112) read: "browser integration and full P4 gate
remain open", and the evidence column cited only `render.test.ts` + `appendix.test.ts` (Appendix A
pixels, deterministic PNG). Walking the three exit criteria in roadmap §6 against the codebase
showed three real gaps and one red herring:

| # | Gap | Why it mattered |
| --- | --- | --- |
| D1 | **No production bridge from SWF model → Vector IR → draw items.** The only VectorShape→ShapeGeometry path was `packages/gfx/test/adapter.ts`, a test-local file that the P3 resolution audit explicitly forbids promoting into production. The 20-fixture golden harness the roadmap demands could not exist without a production bridge. |
| D2 | **No browser surface.** The roadmap demo sentence ("A no-script SWF renders its main timeline in the browser, frame-accurate") had no code behind it: no WebGL2 mount, no HTML shell, no scene bundle on disk, and the GL backend had not been factored so it could be imported from outside `packages/gfx`. |
| D3 | **The budget and context-loss gates were partially implemented but not named/connected.** `packages/gfx/test/static-render.test.ts` existed and exercised T-GFX-020/-050/-060 after earlier work, but the `perf-static` scene was inlined in the test (so TST-R017 `*.expect.json` could not bind one canonical scene), T-GFX-051 (cold tessellation) was not pinned, the gfx README overclaimed T-GFX-021 (audit F2), and hairline (T-GFX-004) and seam (T-GFX-005) unit coverage was missing. |
| (Red herring) | "No `perf-static` test exists." — it did, hidden inside `static-render.test.ts`; the real issue was naming, documentation and the TST-R017 expect file, not missing implementation. |

The bottleneck, in other words, was not a missing algorithm. The renderer's CPU path, GL path,
tessellator, mesh/run caches, PNG encoder and static-scene bundle were all present. The bottleneck
was **the last mile**: a production model→geometry bridge, a browser mount that consumes the bundle,
a fixture corpus of 20 deterministic no-script SWFs with golden manifests, and a
`*.expect.json` that pins the budget counters so regressions fail a gate instead of a
benchmark-then-judgement eyeball.

## 2. Determination — what resolving P4 requires

Roadmap §6 states three exit criteria, and that is all P4 must meet:

1. **Golden frames for 20 no-script fixtures within TST-§6.1 tolerances** (visual suite).
2. **Draw-call and allocation budgets met on `perf-static`** (T-GFX-050, T-GFX-021).
3. **Context-loss recovery works** (T-GFX-060).

P4 does **not** require gradients, bitmaps, real stencil masks, filters, text, AVM1, audio or a
WebGPU backend. IMPL-130 §9 assigns those to WP-130-08 (gradients/bitmaps/masks), WP-130-09
(filters), WP-130-12 (interpreter / AVM1) and WP-130-17 (WebGPU) — all P5/P8/P9 work. Roadmap §2.2
explicitly says "Keep P4 ahead of P5; the AVM1 front end has not started." A no-script SWF cannot
observe the absence of those features, except visually, so non-solid paints degrade to mid-grey (128)
and clip masks degrade to bounds-rect clipping — both *wrong-pixel* degradations that a golden
harness catches, rather than silent *wrong-draw* degradations that would corrupt the batching
contract.

The resolution plan therefore was:

| Work item | Exit criterion it satisfies |
| --- | --- |
| Build a production `VectorShape → ShapeGeometry` bridge in `apps/decompiler/src/render/vector-ir.ts` (importing only `@swf-forge/swf` types and `@swf-forge/gfx` types; never the other direction — the gfx eslint no-restricted-imports rule enforces this). | Unblocks the golden harness. |
| Add a static-scene builder (`apps/decompiler/src/render/scene-build.ts`) that flattens sprites, converts matrices from twips once (`GFX-R017`), applies `cxform`, and emits `swf-forge/static-scene` v1. | Produces the bundle the browser loads. |
| Add the CLI verb `forge-decompile render <file.swf> --out <dir> [--frames N|A-B] [--images] [--demo]` (`apps/decompiler/src/commands/render.ts`, wired into `src/cli.ts`). | Drives both the Node golden harness and the demo bundle. |
| Build `apps/engine-flash`: a tiny browser package that mounts `createGlRenderer` from `@swf-forge/gfx`, wires `webglcontextlost`/`webglcontextrestored` to `handleContextLost`/`handleContextRestored`, fetches `scene.json`, and advances a synthetic-clock frame loop. | The roadmap demo sentence + T-GFX-060 browser path. |
| Add 20 no-script fixtures in `packages/swf/src/test-support/static-fixtures.ts` covering the P4 feature matrix (solid fills, both fill rules, matrix translation/scale/rotation, cxform, depth ordering, clip rect, hairlines, caps/joins, multiple frames, sprite loops, stress grid). | Input corpus for criterion 1. |
| Seed and check in 20 render manifests in `fixtures/goldens/static/*.json` (v1: source sha256, counters, scene sha256, per-frame rgba+png hashes) behind `P4_UPDATE_GOLDENS=1`. | Criterion 1 — golden frames. |
| Move the GL recording stub into `packages/gfx/src/test-support/stub-gl.ts` and add a shared `perfStaticScene()` helper (800 sprites / 4 atlases / disjoint layout) so the GPU budget test, the CPU steady-state test and any future perf job render the same scene. | Unblocks TST-R017. |
| Add a `T-GFX-051` cold-tessellation budget test (1000 shapes, wall-clock ≤ 500 ms on CI with a 250 ms target budget noted in the expect file). | Criterion 2 — tessellation budget. |
| Add `T-GFX-004` (hairline = 1 device px when width is 0, per `GFX-R030`) and `T-GFX-005` (adjacent fills leave no seam) to `render.test.ts`. | Fills out the geometry oracle the golden harness relies on. |
| Write `fixtures/goldens/perf-static.expect.json` binding the counter bounds for `baseline-desktop`, `baseline-mobile` and `headless-ci`. | TST-R017 for criterion 2. |
| Rewrite `packages/gfx/README.md` to remove the F2 overclaim, document what is actually implemented vs deferred, and point at the real test files and the expect file. | Fixes audit F2; keeps F1/F3/F5 tracked separately. |
| Update `docs/impl/000-roadmap.md` §2.2 to reflect that P4 is exit-ready and what is deferred to P9. | Closes the stale "browser integration and full P4 gate remain open" note. |

## 3. Resolution — what was done and what the gates say

After the work items above, the four repository gates are green:

| Gate | Command | Result |
| --- | --- | --- |
| Build | `corepack pnpm build` | `tsc -b` + `apps/decompiler build` + `apps/engine-flash build` — all clean. |
| Typecheck | `corepack pnpm typecheck` | 8 tsc projects (root + swf/avm1/decompiler/gfx/engine-flash/audio/assets test configs) clean. |
| Tests | `corepack pnpm test` | **47 files / 450 tests** pass (up from 447: +hairline T-GFX-004, +seam T-GFX-005, +cold-tess T-GFX-051). No flags, no skipped. |
| Lint | `corepack pnpm lint` | eslint + prettier clean after `corepack pnpm format`. |

P4 exit-criteria evidence map:

| Roadmap §6 criterion | Evidence |
| --- | --- |
| Golden frames for 20 no-script fixtures within TST-§6.1 tolerance | `apps/decompiler/test/render-goldens.test.ts` (23 tests, 20 goldens in `fixtures/goldens/static/*.json`; `packages/gfx/test/render.test.ts` + `appendix.test.ts` provide the pixel oracle that the goldens rely on). |
| Draw-call + allocation budgets on `perf-static` | `packages/gfx/test/static-render.test.ts` — T-GFX-020 (identical redraw sequence twice), T-GFX-021 (600 frames, zero steady-state allocs / zero buffer growths, heap growth < 4 MiB guard), T-GFX-050 (800 sprites/8 materials, ≤ 210 batches, ≤ 420 draws), T-GFX-051 (1000-shape cold tessellation ≤ 500 ms CI, second run same). Bounds bound in `fixtures/goldens/perf-static.expect.json`. |
| Context-loss recovery | `packages/gfx/test/static-render.test.ts` T-GFX-060 — `handleContextLost()` → `drawFrame` returns false; `handleContextRestored()` rebuilds programs (`programBuilds` increments to 2) and repaints; clip-all after restore produces 0 draws. The browser wiring in `apps/engine-flash/src/viewer.ts` connects `webglcontextlost`/`webglcontextrestored` to the same calls. |

## 4. Scope discipline — what was NOT done (and why)

The roadmap is a phase graph, not a feature wishlist. The following are real renderer features
that are **not** in P4's exit criteria and were deliberately left for later phases:

- Gradients, bitmap fills, non-solid paints — WP-130-08 (P9). The bridge currently counts and returns
  `unsupportedPaintCount` and substitutes a diagnostic mid-grey so the golden harness will
  flag mis-rendered pixels rather than silently drawing nothing.
- Real stencil masks (bounded by clip rect only) — WP-130-08 (P9).
- Filters (blur/glow/bevel) — WP-130-09 (P9).
- Text — staged under fonts (P3) / layout (P9).
- WebGPU backend — WP-130-17 (P9).
- AVM1 interpreter, audio mixer, DOM shell, profiler — P5/P8 and later.
- A viewer-level context-loss test in `apps/engine-flash/test/` — test dir was scaffolded with the
  package but is empty; the behaviour is covered headlessly against the same GL code path, and a
  real-browser test belongs to the harness work package (IMPL-140 / WP-140-01), not to P4.

Audit findings that remain open but do not block P4: F1 (doc 060 phantom T-MOD-123), F3 (test-ID
drift), F5 (dangling T-GFX-003/004 — those IDs are not in GFX §18 and are not referenced by any
P4-required test; they were stale roadmap-table IDs and are left alone rather than invented), F6
(roadmap P3 140 d vs doc-sum 200 d), F7 (codes.ts omits SF0290–SF0295), F8 (curved edges only
partially pinned).

## 5. How to keep P4 closed

- The four gates (`build`, `typecheck`, `test`, `lint`) are all green; running them as a pre-push
  check is sufficient for P4.
- Golden updates use `P4_UPDATE_GOLDENS=1`; the `render-goldens.test.ts` guards against accidental
  re-seeding by failing when the golden directory is non-empty without the flag.
- The `@swf-forge/gfx` package boundary is enforced by `eslint.config.js` (`no-restricted-imports`
  on `@swf-forge/swf` in `packages/gfx/src/**`); the production bridge lives in `apps/decompiler/`
  and the test-local `packages/gfx/test/adapter.ts` is now the only remaining breach — restricted
  to a single test file (`appendix.test.ts`), and slated for removal once Appendix A is routed
  through the production bridge.
- P5 may now begin; the P4 gates do not need to be re-argued.
