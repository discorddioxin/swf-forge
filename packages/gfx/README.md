# `@swf-forge/gfx` — vector geometry and the reference renderer

The renderer's platform-neutral half: Vector IR, curve flattening, coverage rasterisation, stroke
expansion, display-list flattening, the reference CPU frame renderer, a WebGL2 backend, and the
static-scene bundle the P4 browser demo renders.

## Boundary

The renderer consumes **Vector IR only** (`IMPL-130-R001`): this package never imports
`@swf-forge/swf`, and ESLint enforces it. The model→geometry bridge lives in the consumer packages
(the P3 debug previews in `apps/decompiler/src/assets/shape-preview.ts`, and the production
static-scene builder in `apps/decompiler/src/render/vector-ir.ts`). `test/adapter.ts` is kept
**only** for the Appendix A gate (`test/appendix.test.ts`) and will be removed once Appendix A is
re-routed through the production bridge.

## What is implemented

| Area | Spec | Notes |
| --- | --- | --- |
| Fill rules | `GFX-R019`, `GFX-R021` | `nonzero` + `evenodd`, degenerate subpaths dropped silently |
| Flattening | `GFX-R022` | flatness criterion, tolerance in device px, convex fast path for quads |
| Coverage | `GFX-R024` (reference) | analytic in x, 4× supersampled in y; the GPU path uses stencil-then-cover with the same contours (`T-GFX-072`) |
| Strokes | `GFX-R029`–`GFX-R033` | miter/bevel/round joins, butt/square/round caps, hairlines (width 0 → 1 device px, `GFX-R030`), single-run union |
| Batching / GL | `GFX-R103`, `T-GFX-020`/`050` | segment planner groups disjoint opaque runs by material; stencil INVERT (even-odd) / INCR_DECR (nonzero); context-loss hooks (`T-GFX-060`) |
| Clips | `T-GFX-015` (open) | `clipDepth` masks currently clip to the masker's bounds rect; real stencil masks land with WP-130-08 |
| Gradients, bitmaps, filters, text | `GFX` §6.3/§6.4/§9 | **not in this package yet** — non-solid paints degrade to mid-grey so they surface as wrong pixels rather than wrong draws; gradients/bitmaps/masks are WP-130-08, filters WP-130-09 |

## Status and evidence (P4 gate)

P4's three exit criteria are asserted by tests in this package and the decompiler render verbs:

| Criterion (roadmap §6) | Gate tests |
| --- | --- |
| Golden frames for 20 no-script fixtures within TST-§6.1 tolerance | `apps/decompiler/test/render-goldens.test.ts` (20 goldens under `fixtures/goldens/static/`) |
| Draw-call and allocation budgets on `perf-static` | `test/static-render.test.ts` (`T-GFX-020`/`050`/`051`), `test/render.test.ts` (`T-GFX-021` steady-state zero-alloc over 600 frames); bounds bound in `fixtures/goldens/perf-static.expect.json` (TST-R017) |
| Context-loss recovery | `test/static-render.test.ts` (`T-GFX-060`: `handleContextLost` → draw returns false → `handleContextRestored` rebuilds program and repaints; clip-all after restore draws 0 draws) |

Additional unit coverage: `T-GFX-001` (exact pixels) and `T-GFX-002` (fill rules) in `test/render.test.ts`;
`T-GFX-004` (hairline 1-device-pixel) and `T-GFX-005` (adjacent-fill seamlessness) in `test/render.test.ts`;
`T-GFX-070`/`T-GFX-072` (static-scene bundle round trip, CPU/GPU geometry parity) in `test/static-render.test.ts`;
Appendix A worked example in `test/appendix.test.ts`.

The browser surface is `@swf-forge/engine-flash` (`apps/engine-flash/`), which loads a static-scene
bundle and mounts `createGlRenderer` with the context-loss wiring. It is exercised by the CLI's
`render --demo` verb.

## Determinism

`encodePng()` writes stored-block DEFLATE and no timestamp chunk, so identical frames produce
identical bytes (`REPO-R015`) — the property the harness's image hashes rely on. The static-scene
serialiser uses fixed key order and 1/1000 px quantisation so `scene.json` is byte-reproducible.
