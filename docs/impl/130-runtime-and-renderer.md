# IMPL-130 — Runtime, Renderer, and Interpreter

**Doc ID:** IMPL-130 · **Status:** ready (design-spec-driven; no format chapters needed) · **Packages:** `@swf-forge/runtime`, `@swf-forge/renderer`, `@swf-forge/avm1/runtime`, `@swf-forge/render-core`
**Format spec:** none (executes the emitted project; consumes the manifest from IMPL-120)
**Design specs:** RT (whole), GFX (whole), AVM1-§2–§5/§9, AUD-§5–§7, AST-§9, SEC-§3/§4, TST-§6/§7

---

## 1. Deliverables

1. `RuntimeBoot`: mount a built project into a page, load the manifest, run the frame loop.
2. The display system: display lists per timeline, placement/mutation/removal, masking (clipDepth),
   9-slice, cacheAsBitmap, blend modes, filters.
3. The renderer: Vector IR → WebGL2 (with a WebGPU path behind a flag), batching, atlases, stencils,
   resolution scaling, draw-call budgets.
4. The AVM1 runtime: object model, properties, coercion, scope chain, `with`/`SetTarget` targets,
   functions as objects, `Object.registerClass`, prototype chains, the host API surface.
5. The interpreter for residual (T2) bytecode, sharing the object model with the emitted code.
6. Input: pointer/keyboard/focus, button state machines, text input, IME, tab order.
7. Audio scheduling integration: the mixer calls the AUD-designed engine at the frame's audio boundary.
8. The DOM shell: canvas/audio elements, input capture, resize, lifecycle, CSP-safe bootstrapping, and
   the `NetworkPolicy` default-deny fetch façade.

**Non-goals:** the build tool (doc 120), and any codec/DSP implementation (packages from docs 090).

## 2. Module layout

```
packages/runtime/src/
  boot.ts              RuntimeBoot: mount(canvas, project, policy) -> RuntimeHandle
  loop.ts              frame loop, phase order, drift compensation
  display/
    display-list.ts    per-timeline lists, depth ordering, ops application
    timeline.ts        playback, goto/frame operations, frame scripts
    mask.ts            clipDepth -> stencil groups
    nine-slice.ts, cache-hint.ts
  object/
    avm1-object.ts     the AVM1 object model (slot-based, prototype chains)
    property-table.ts  property registration + getters/setters used by movie clips
    scope.ts           scope chain, with-scopes, target resolution, SetTarget regions
    coercion.ts        AVM1 coercions (number/string/bool), number->string algorithm
    functions.ts       Function values, arguments, register files, `call`/`apply`
    register-class.ts  Object.registerClass + constructor dispatch
  hostapi/
    movieclip.ts, textfield.ts, key.ts, mouse.ts, sound.ts, net.ts (policy), math.ts, …
  interp/
    vm.ts              residual bytecode interpreter (validated entry descriptors)
    ops.ts             opcode implementations (sharing hostapi + object model)
  input/
    pointer.ts, keyboard.ts, focus.ts, text-input.ts, ime.ts
  net/
    policy.ts          NetworkPolicy façade (default deny), request broker, timeouts
packages/renderer/src/
  context.ts           WebGL2 setup, capabilities, context-loss recovery
  vector/
    tessellate.ts      flat/quadratic flattening, triangulation, even-odd support
    stroke.ts          stroking (joins/caps/miter, non-scaling widths)
    fill.ts            gradients (LUT sampling), bitmap fills, pattern matrices
  batch/
    batcher.ts         draw-call grouping by state (texture, blend, stencil, shader)
    atlas.ts           runtime atlas allocation for dynamic content
  filters/
    filter-graph.ts    filter chain -> FBO passes; cache and invalidation
  shaders/             WGSL/GLSL sources, one file per effect
  webgpu/              optional backend behind `--gfx-backend=webgpu`
```

**IMPL-130-R001** The renderer MUST only consume Vector IR + asset handles (roadmap hard edge). No
module under `renderer/` may import from `packages/swf`.
**IMPL-130-R002** `interp/` and the emitted code MUST share one object model instance and one host API
registry; a T2 blob executed by the interpreter MUST be indistinguishable, from the game's point of
view, from an emitted function (same `this`, same scope chain, same error surfaces). Divergence between
the two execution paths is the single most likely source of "works except in one level" bugs, so the
shared conformance suite runs every fixture through *both* paths where a fixture is expressible in
both (`T-RT-101`).

## 3. Frame loop and phase order

```
for each tick:
  input        — drain pointer/key events into the input model
  preSimulate  — apply queued host completions (audio ended, timers, loader events)
  simulate     — advance timelines: apply frame ops, dispatch clip events,
                 run frame scripts (in the documented order, IMPL-020-R034)
  postSimulate — commit property changes, flush pending removals
  audioSchedule— schedule envelope/stream audio for this frame's duration
  render       — draw the display lists
  postRender   — collect metrics, run housekeeping (GC hints, cache eviction)
```

- **IMPL-130-R003** The phase order MUST be exactly the one above (RT-R003); emitted code MUST NOT be
  able to observe a frame mid-simulation. Where an AVM1 quirk depends on intra-frame visibility, it MUST
  be modelled with explicit commit points (`postSimulate`) and recorded in AVM1's quirk list.
- **IMPL-130-R004** Frame duration MUST be derived from the movie's frame rate, with drift compensation
  against a monotonic clock and a catch-up cap (RT-R006: at most 3 frames per tick). The runtime MUST
  never spin frames faster than authored.
- **IMPL-130-R005** Timers and `setInterval` MUST be delivered in `preSimulate`, not on the host's
  timer queue (AVM1-R058): a timer that fires mid-`simulate` would make execution order depend on the
  browser's timer coalescing.

## 4. Display system rules

- **IMPL-130-R006** Depth ordering: ascending depth, ties broken by *placement order* within the frame.
  The display list is a sorted structure with a stable comparator; re-sorting on every mutation is
  acceptable only if measured (T-RT-102's perf gate).
- **IMPL-130-R007** `swapDepths`/`getNextHighestDepth` MUST follow AVM1's documented depth ranges and
  the negative-depth semantics (AVM1-R057/R092): the runtime's depth space is the flat integer domain,
  and `getNextHighestDepth` returns the next free depth above the current maximum within the legal range.
- **IMPL-130-R008** Clip-depth masking MUST be implemented with stencil groups sized to the mask's
  bounds, and MUST support nested masks and masks that are themselves inside masked content
  (GFX-R046's nesting rule: stencil ref counting, not boolean state).
- **IMPL-130-R009** `_visible=false` MUST still run the object's timeline and scripts (Flash semantics);
  only rendering is skipped. Optimising invisible subtrees away is not permitted for dynamic timelines.
- **IMPL-130-R010** Property changes through the AVM1 API and through frame ops MUST funnel into the
  same mutation path (`DisplayNode` setters) so that ordering rules apply uniformly; no direct field
  pokes from host API implementations.
- **IMPL-130-R011** Cache invalidation: filters/9-slice/cacheAsBitmap caches MUST be invalidated by
  *geometry, transform, and filter parameters*, with a version counter per node; a cache that misses an
  invalidation renders stale pixels, which the visual conformance suite detects but only with a
  deliberate fixture (`T-RT-110`).

## 5. Renderer rules

- **IMPL-130-R012** Draw-call budget: the batcher MUST group by (program, texture(s), blend, stencil
  state) and MUST report per-frame draw calls in the profiler; the GFX-§16 budget (≤ 700 desktop /
  ≤ 350 mobile) is a CI gate on the reference title's worst frame.
- **IMPL-130-R013** Tessellation MUST be deterministic given the same inputs and tolerance (GFX-R031);
  the build-time glyph rasteriser and the runtime share `render-core`, so a glyph tessellated for the
  atlas and the same glyph drawn at a different size MUST agree at the shared tolerance
  (`T-RT-111`).
- **IMPL-130-R014** Gradients MUST be evaluated in the shape's gradient space via a LUT texture whose
  resolution is fixed (256 entries) and whose sampling follows the stop-interpolation rule
  (`linearRgb` honoured where authored); no per-pixel analytic evaluation (cost, and it would drift from
  the LUT on the build path).
- **IMPL-130-R015** Strokes MUST be drawn with the authored join/cap/miter rules; `hairline` widths
  (0.05 px) MUST render as a 1-device-pixel line at any zoom (GFX-R044), which means they bypass the
  scaling transform.
- **IMPL-130-R016** Resolution scaling (`--scale=n` / DPR) MUST NOT change *layout*: all layout,
  hit testing and text metrics stay in CSS px; only rasterisation resolution scales. Device-pixel
  snapping happens for strokes and hairlines only.
- **IMPL-130-R017** Context loss MUST be survivable: on `webglcontextlost`, stop the loop, recreate all
  GPU resources from CPU-side descriptions on restore, and resume at the same frame
  (`T-RT-112`). CPU-side descriptions MUST therefore never be discarded after upload (they are the
  source of truth).
- **IMPL-130-R018** WebGPU MUST be a backend swap behind the same scene/command interface, not a second
  renderer: the command list (draw items + state) is backend-agnostic and the WebGL2 backend is the
  reference implementation (`T-RT-113` compares frames pixel-wise at the GFX tolerance).

## 6. AVM1 runtime rules

- **IMPL-130-R019** AVM1 objects MUST be `Avm1Object` instances (a slot table + prototype link), never
  plain JS objects; there is no operation exposed at the AVM1 level that can observe or create a bare JS
  object (AVM1-R003's no-leak rule).
- **IMPL-130-R020** Coercions MUST be implemented once in `coercion.ts` and used by emitted code and
  interpreter alike: `ToNumber`, `ToString` (with the pinned display algorithm, AVM1-R025/R026),
  `ToBoolean`, plus the comparison/equality operators' asymmetric rules (AVM1-R018/R019).
- **IMPL-130-R021** Property lookup MUST follow the AVM1 order: own slot → prototype chain → display
  object's generated properties (e.g. `_x` on a clip) → scope chain for free identifiers. The order is
  observable and MUST be pinned by fixtures (`T-RT-120`).
- **IMPL-130-R022** `with` scopes and `SetTarget` regions MUST be compiled to explicit scope objects
  (`{base, targetPath}`), and resolution MUST go through one `resolve(name)` entry point; `Proxy` is
  forbidden (performance and the "no exotic traps" rule).
- **IMPL-130-R023** Host API calls MUST complete **synchronously** with respect to the AVM1 program:
  any genuinely async work (asset load, network, audio decode) is modelled as a *pending completion*
  delivered in a later frame's `preSimulate`, and the AVM1-visible object state reflects "not yet
  complete" until then (AVM1-R060). No promise may ever be handed to game code.
- **IMPL-130-R024** Errors MUST be catchable exactly where AVM1 allows: `try`/`catch` in AVM1 is
  statement-level, host errors become AVM1 errors of the right class (`TypeError`-equivalent), and an
  uncaught error is recovered per the design's policy (log once, cancel the affected block) rather than
  killing the frame (AVM1-R070).
- **IMPL-130-R025** The interpreter MUST validate its entry descriptors once, at load, and MUST refuse
  to run a blob that fails validation (`SF0600`-style runtime error, counted in the divergence report) —
  the blob comes from our own build, so a failure means memory corruption or a tampered file.

## 7. Input, audio, and DOM shell

- **IMPL-130-R026** Pointer events MUST be converted to AVM1's coordinate space with the *same* inverse
  matrices used for hit testing (one implementation, `input/pointer.ts`); `_xmouse` derives from the
  same path so it cannot disagree with what the game hit-tests.
- **IMPL-130-R027** Keyboard input MUST be captured only while the canvas holds focus, and MUST map
  through the movie's key table (AVM1-R080). `Key.isDown` reflects the same state as the event dispatch
  (one input model).
- **IMPL-130-R028** Text input MUST support IME composition, paste, and selection, and MUST enforce
  `password`/`maxLength` (doc 080's rules) in the input path before the value reaches `variableName`.
- **IMPL-130-R029** Audio scheduling MUST occur exactly once per frame, at the frame's audio boundary,
  with the mixer's lookahead (AUD-R052); the runtime MUST NOT schedule from `render` or from a
  microtask.
- **IMPL-130-R030** The DOM shell MUST work under a strict CSP (`script-src 'self'`, no `unsafe-eval`,
  `blob:` only where declared) and MUST size the canvas by CSS while keeping the internal resolution
  under the renderer's control. Boot MUST work from a `<script type="module">` tag with no inline
  script (SEC-R021).
- **IMPL-130-R031** All network access MUST go through `NetworkPolicy` (default deny, design
  `SEC-R030`); every blocked attempt is counted and reported, and no host API may call `fetch`,
  `XMLHttpRequest`, `WebSocket`, `sendBeacon`, or `Image.src` directly (lint-enforced).
- **IMPL-130-R032** Lifecycle: pause on page hide, resume on visible, and clamp the frame delta to the
  catch-up cap so a background tab does not fast-forward the game (RT-R011).

## 8. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| `T-RT-101` | emitted vs interpreter equivalence on the shared fixture set (same observable state) | F2 |
| `T-RT-102` | depth ordering + `swapDepths` semantics, incl. negative depths | F2 |
| `T-RT-103` | phase order observable through a fixture that reads state at each phase | F2 |
| `T-RT-104` | timers delivered in `preSimulate`; no mid-simulate delivery under load | F2 |
| `T-RT-105` | `_visible=false` subtrees still run scripts | F2 |
| `T-RT-106` | nested masking with stencil ref counting | F2 |
| `T-RT-107` | hit testing vs `_xmouse` consistency under scale/rotate | F2 |
| `T-RT-108` | `variableName` binding two-way (field ↔ variable) | F2 |
| `T-RT-109` | IME/paste/maxLength/password enforcement | F2 |
| `T-RT-110` | cache invalidation: transform/filter/geometry changes each force a redraw | F1 |
| `T-RT-111` | glyph tessellation agreement between atlas path and runtime path | F1 |
| `T-RT-112` | context loss/restore mid-play returns to the same frame with correct pixels | F2 |
| `T-RT-113` | WebGL2 vs WebGPU frame parity within the GFX tolerance (where WebGPU is enabled) | F3 |
| `T-RT-114` | audio scheduling happens once per frame at the audio boundary (instrumented mixer) | F1 |
| `T-RT-115` | CSP-clean boot: no inline script, no `eval`, no `blob:` beyond the policy | F1 |
| `T-RT-116` | network façade: every blocked request counted, no direct fetch/XHR anywhere | F1 |
| `T-RT-117` | frame-rate fidelity: 24 fps title runs at 24 fps ± drift bound; tab-hide clamped | F2 |
| `T-RT-118` | draw-call budget gate on the reference title's worst frame | F2 |
| `T-RT-120` | AVM1 object model: slot/prototype/display-property lookup order pinned by fixtures (R021) | F2 |

## 9. Work packages

| WP | Title | Depends | Est | Deliverable |
| --- | --- | --- | --- | --- |
| WP-130-01 | Object model (slots, prototypes, properties) | model | 6 | `object/avm1-object.ts`, T-RT-120 |
| WP-130-02 | Coercions + operators | WP-130-01 | 4 | `coercion.ts` |
| WP-130-03 | Scope chain, `with`, `SetTarget` resolution | WP-130-01 | 4 | `object/scope.ts` |
| WP-130-04 | Display node + display list + depth ops | manifest | 6 | `display/*` |
| WP-130-05 | Timeline playback + frame scripts + clip events | WP-130-04 | 5 | `display/timeline.ts` |
| WP-130-06 | Renderer: context, batching, basic fills/strokes | GFX design | 8 | `renderer/*` |
| WP-130-07 | Tessellation/stroking in `render-core` | WP-130-06 | 6 | `vector/*`, T-RT-111 |
| WP-130-08 | Gradients/bitmap fills/masks/9-slice | WP-130-07 | 5 | T-RT-106 |
| WP-130-09 | Filter graph + cache invalidation | WP-130-08 | 5 | `filters/*`, T-RT-110 |
| WP-130-10 | Host API: MovieClip/TextField/Key/Mouse/Math | WP-130-03 | 8 | `hostapi/*` |
| WP-130-11 | Host API: Sound/Net(policy)/system | WP-130-10 | 4 | T-RT-116 |
| WP-130-12 | Interpreter + validator | WP-130-02 | 6 | `interp/*`, T-RT-101 |
| WP-130-13 | Input: pointer/keyboard/focus/text+IME | WP-130-05 | 5 | `input/*`, T-RT-107/009 |
| WP-130-14 | Audio scheduling integration | AUD design | 3 | T-RT-114 |
| WP-130-15 | DOM shell, boot, CSP, lifecycle | WP-130-06 | 4 | `boot.ts`, T-RT-115/017 |
| WP-130-16 | Profiler + budgets instrumentation | WP-130-06 | 3 | T-RT-118 |
| WP-130-17 | WebGPU backend behind the flag | WP-130-08 | 6 | `webgpu/`, T-RT-113 |
| | **Total** | | **88** | |

The runtime+renderer is the largest single package; the estimate assumes the emitted-code contract
(doc 120) and the shared `render-core` package already exist.

## 10. Done criteria

1. The reference title plays from start to finish with no uncaught exception and no counter above its
   declared divergence budget.
2. Both execution paths (emitted/interpreter) pass the shared fixture suite identically.
3. Visual conformance gates (GFX-§13.4, TST C1/C2) pass on the reference corpus.
4. Audio gates (null-RMS, click, drift) pass; video sync within 1 frame.
5. Draw-call, bundle, and texture budgets are met or explicitly waived in `build-info.json`.
6. Context loss, tab-hide, and input edge cases (IME, paste, blur) all behave per the rules above.

**Id note.** These obligations are banded `T-RT-1xx`; the `T-RT-00x` block belongs to the *design*
spec (`specs/080-runtime-shell.md` §11, whose ids `T-RT-001`–`018` cover boot, lifecycle, input and
budgets). The two suites are different tests with different owners, and the band makes that mechanical
(`E-023`).

## 11. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Runtime/renderer/interpreter specification derived from RT/GFX/AVM1/AUD design specs |
| 1.1 | 2026-10-04 | Test obligations re-banded to `T-RT-1xx` (`T-RT-101`–`120`) so they no longer collide with the design spec's `T-RT-00x` block; the object-model lookup test referenced by `R021`/`WP-130-01` is now defined as `T-RT-120`; errata `E-023` |
