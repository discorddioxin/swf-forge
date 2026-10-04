# `@swf-forge/gfx` — vector geometry and the reference renderer

The renderer's platform-neutral half: Vector IR, curve flattening, coverage rasterisation, stroke
expansion, display-list flattening and the reference frame renderer that the conformance harness uses
to compare frames without a browser.

## Boundary

The renderer consumes **Vector IR only** (`IMPL-130-R001`): this package never imports
`@swf-forge/swf`, and ESLint enforces it. The compiler/emitter converts the decoded model into
`ShapeGeometry`; the runtime feeds draw items to the WebGL2 backend (`GFX` §3.1) or, in tests and
Node tooling, to `renderFrame()`.

## What is implemented

| Area | Spec | Notes |
| --- | --- | --- |
| Fill rules | `GFX-R019`, `GFX-R021` | `nonzero` + `evenodd`, degenerate subpaths dropped silently |
| Flattening | `GFX-R022` | flatness criterion, ≤ 8 segments, tolerance in device px |
| Coverage | `GFX-R024` (reference) | analytic in x, 4× supersampled in y; the GPU path uses exact edge equations |
| Strokes | `GFX-R029`–`GFX-R033` | miter/bevel/round joins, butt/square/round caps, hairlines, single-run union |
| Clips | `T-GFX-015` (open) | `clipDepth` masks currently clip by the masker's bounds rect |
| Gradients, bitmaps, filters, text | `GFX` §6.3/§6.4/§9 | not in this package yet |

## Status and evidence

The reference path is complete and tested (`T-GFX-001`…`T-GFX-002`, `T-GFX-021`):

| Suite | Covers |
| --- | --- |
| `test/render.test.ts` | exact rectangle coverage, even-odd vs non-zero, degenerate drop, flattening criterion and cap, clip rect, CXFORM, butt/square/round caps, miter limit vs bevel, PNG determinism |
| `test/appendix.test.ts` | the P4 gate: `fixtures/appendix-a.swf` decoded through the model, flattened and rendered to a 550×400 frame — the stroke lands as the half-covered rows/columns the appendix describes |

`test/adapter.ts` is **test-local**: it maps the decoder's `VectorShape` onto `ShapeGeometry`. The real
conversion belongs to the compiler/emitter (it runs outside this package for the reason above), so the
gate can run before that package exists. When the compiler lands, the adapter is deleted and this suite
imports the production conversion instead.

## Determinism

`encodePng()` writes stored-block DEFLATE and no timestamp chunk, so identical frames produce
identical bytes (`REPO-R015`) — the property the harness's image hashes rely on.
