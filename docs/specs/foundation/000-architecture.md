# ARCH — System Architecture

**Doc ID:** ARCH · **Status:** Draft 1.1 · **Normative:** yes (for scope and decomposition)

---

## 1. Problem statement

Thousands of Flash games were authored in ActionScript 1 and 2 (AVM1) between 1999 and 2010.
They are now unplayable in browsers. Three broad rescue strategies exist:

| Strategy | What it does | Cost | Result |
| --- | --- | --- | --- |
| Emulate | Ship a SWF player (e.g. a VM + renderer) plus the original `.swf` | High runtime cost, opaque to tooling, dead code ships | Runs, but stays a black box |
| Rewrite by hand | A human reads the code and writes a new game | Very high human cost | Clean, but does not scale past a handful of titles |
| **Compile** | Transform SWF + AVM1 bytecode + assets into source code and web-native assets | High *engineering* cost once, low per-title cost | Clean TypeScript, inspectable, patchable, optimisable, scalable |

**swf-forge takes the third path.** It is a *source-to-source* toolchain, not a player.

The practical consequences of that choice:

1. **Build-time work replaces runtime work.** Decoding ADPCM, resampling audio, tessellating
   shapes, packing atlases, and normalising fonts all happen in a Node/CI environment, not in the
   player. The browser receives data in the format it consumes.
2. **The VM is a compile target, not a runtime dependency.** AVM1 semantics are preserved by the
   *emitted TypeScript*, which calls a small semantic runtime. Games whose bytecode cannot be
   statically resolved get a bounded interpreter fallback that is opt-in per title.
3. **Anything ambiguous is a porting decision.** Where Flash behaviour is under-specified,
   the compiler surfaces a diagnostic with a supported resolution (patch, override, or accept
   divergence) — it never silently "does something reasonable".
4. **The output is a normal project.** No proprietary format, no `eval`, no plugin, no WASM
   required for the core (WASM is optional where a codec demands it).

## 2. Goals

- **G1 — Fidelity.** Behaviour that Flash defined, we reproduce: number/string coercion, timeline
  semantics, depth ordering, sound loop points, gradient geometry, hit testing, etc. Fidelity
  levels are declared per requirement (spec set §Conventions).
- **G2 — Portability.** Output runs in evergreen desktop and mobile browsers via WebGL2 + Web
  Audio, with a documented degraded mode when a feature is unavailable (no silently broken frames).
- **G3 — Legibility.** A human who knows ActionScript can read the emitted TypeScript and
  understand it. Names are recovered or synthesised predictably; source maps point into SWF
  offsets *and* recovered class/function names; the emitted code has no generated-code smell
  (no `if (reg3) stack[stack.length-1] = ...` in the common case).
- **G4 — Performance.** Compiled titles meet a per-frame budget on a defined baseline device
  (TST-§7), typically *faster* than the original because batching, pre-decoding, and pre-tessellation
  move work off the hot path.
- **G5 — Determinism.** Compiling the same input twice produces byte-identical output. This
  enables caching, diffing, and reproducible builds.
- **G6 — Auditability.** Every emitted construct traces back to a SWF offset, a tag, or a
  recovered symbol. Every divergence from Flash is listed in a machine-readable report.
- **G7 — Small runtime.** The linked runtime is tree-shakeable and has a measured size budget
  (RT-§9); a simple game must not pay for video decode, XML sockets, or 3D-less shader variants it
  does not use.

## 3. Non-goals

**ARCH-R001** The non-goals below are normative. An implementation MUST NOT add a runtime path that
loads and executes an arbitrary `.swf` (a "player mode"), and MUST NOT ship AVM2 execution. Such a
feature would invalidate the fidelity strategy (ARCH-§2) and the auditability goal (ARCH-G6).

| Non-goal | Reason |
| --- | --- |
| A general SWF player that loads arbitrary `.swf` at runtime | Emulation is a different (and already served) product category; it defeats G3/G4 |
| Runtime bytecode interpretation as the *primary* execution path | Kills legibility and JIT-friendly codegen; interpreter exists only as a bounded fallback |
| AVM2/AS3 support | Separate VM; AVM1 games are the target. Detected and reported (CMP-§7.4) |
| Reproducing Flash authoring features (FLA, components, IDE) | Out of scope; MX components present in a SWF are treated as ordinary movie clips |
| Adobe-identical graphics for GPU-era effects | Filters/blends are tolerance-based (GFX-13, GFX-10) |
| Server-side rendering of gameplay | Not required; static prerender of a single frame is a possible future use |

## 4. Decomposition

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ BUILD TIME (Node ≥ 20)                                     @swf-forge/*     │
│                                                                              │
│  030 SWF reader ──► tag stream, dictionary, shapes, sounds, fonts, AVM1 blob  │
│        │                                                                     │
│        ├──► 040 AVM1 front end: decode → IR → dataflow/type recovery         │
│        │         │                          └─► 020 emitter: TypeScript      │
│        │         └─► host-API resolution (MovieClip/Sound/Math/… → imports)  │
│        │                                                                     │
│        ├──► 050 shape/image compiler: paths, styles, texts, filters metadata │
│        ├──► 060 audio compiler: decode, resample, encode, loop tables        │
│        ├──► 070 asset compiler: KTX2/WebP, WOFF2/MSDF, MP4, manifest         │
│        └──► risk/diagnostic reports, porting notes, override points          │
│                                                                              │
│   OUTPUT: TS sources + manifest + assets + reports   (all files, no bundles)  │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │  tsc / vite / esbuild (the user's toolchain)
                                    ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│ RUN TIME (browser)                                            @swf-forge/*   │
│                                                                              │
│  080 shell: boot, asset loading, clock, input, storage, embed API            │
│    │                                                                         │
│    ├── 040 AVM1 semantic runtime: values, objects, scopes, display list      │
│    ├── 050 GFX: WebGL2 renderer (tessellation cache, batching, filters)      │
│    ├── 060 AUD: Web Audio engine (AudioWorklet mixer, stream sync)           │
│    └── platform adapters: Canvas size/DPR, fullscreen, pointer lock, pause    │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 4.1 Build-time components

| Component | Package | Responsibility | Spec |
| --- | --- | --- | --- |
| SWF reader | `@swf-forge/swf` | Container, tags, bit IO, dictionary, decompression | SWF |
| AVM1 front end | `@swf-forge/avm1` (front end) | Bytecode decode, CFG, SSA-ish IR, escape analysis, name recovery | AVM1, CMP |
| TypeScript emitter | `@swf-forge/compiler` | IR → TS text, source maps, project scaffolding | CMP |
| Graphics compiler | `@swf-forge/compiler` | Shapes → path/style IR, text → layout IR, filter metadata | GFX, AST |
| Audio compiler | `@swf-forge/compiler` | Sound decode/normalise/encode, stream tables, loop metadata | AUD |
| Asset compiler | `@swf-forge/compiler` | Bitmaps, fonts, video, atlases, manifest, hashing | AST |
| Reporter | `@swf-forge/compiler` | Diagnostics, porting notes, divergence list, budget report | CMP, TST |
| CLI | `@swf-forge/cli` | `swfforge build\|inspect\|verify\|report` and config loading | CMP |

### 4.2 Run-time components

| Component | Package | Responsibility | Spec |
| --- | --- | --- | --- |
| Shell | `@swf-forge/runtime` | Boot, assets, clock, input, persistence, embedding | RT |
| AVM1 runtime | `@swf-forge/avm1` (runtime) | Value model, objects, scopes, globals, display list, events | AVM1 |
| Renderer | `@swf-forge/gfx` | WebGL2 pipeline, tessellation cache, batching, filters, text | GFX |
| Audio engine | `@swf-forge/audio` | Voice mixer (worklet), stream sync, envelopes, positions | AUD |
| Interpreter fallback | `@swf-forge/avm1/interp` | Executes residual bytecode for unresolvable constructs | AVM1-§9 |

### 4.3 The two-way contract

The compiler and runtime meet at exactly three interfaces, each fully specified:

1. **Asset manifest** (`forge.manifest.json`, AST-§5): a declarative description of every asset the
   runtime may load, including integrity hashes, decoded metadata, and semantic extras (loop
   points, stream tables, sprite rectangles).
2. **Resource module contract** (`src/resources/*.ts`, CMP-§9.3): generated TypeScript modules
   that expose typed handles (`TextureHandle<'hero'>`, `SoundHandle<'music_loop'>`) so that
   mis-typed asset references fail at `tsc` time, not at runtime.
3. **Host API surface** (AVM1-§8): the typed set of functions/objects the emitted code is allowed
   to call (`MovieClip`, `Sound`, `Stage`, `Key`, …). The compiler emits calls only into this
   surface; the runtime guarantees those calls are total (no `undefined is not a function`).

**ARCH-R002** These three interfaces are the only permitted coupling between build-time and
run-time code. A change to any of them requires updating: the contract types
(`@swf-forge/runtime/contract`), the emitter that produces values of those types, and the runtime
consumers — in the same pull request (REPO-R005, REPO-R019).

Because the third interface is a *compile-time* contract, an emitted game that violates it is a
compiler bug, not a runtime condition. This is a deliberate design property: **no dynamic feature
detection in emitted game logic** (feature detection belongs to boot, RT-§4).

### 4.4 Product components

The decomposition above is *technical*. The product is shipped as five named components, defined in
`docs/TECH-SPEC.md` §2 (structure authority), each a thin app over the packages of §4.1–§4.2:

| Component | Is | Spec |
| --- | --- | --- |
| `decompiler` | SWF → decoded model, IR, media previews, dumps, diffs (build time) | SWF, AVM1, APP |
| `transpiler` | model + IR → TypeScript project, assets, manifest, reports (build time) | CMP, GFX, AUD, AST |
| `code-inspector` | IDE-like browsing and navigation of both sides (browser app) | INS |
| `engine-flash` | faithful runtime/executor for the transpiled TypeScript | RT, AVM1, GFX, AUD |
| `engine-clean` | restructuring target: modern app with a real game loop, no MovieClip/timeline | CLN |

**ARCH-R003** A capability MUST belong to exactly one component (`TECH-R002`); the engines are
alternative targets over one analysed model and MUST NOT be chained (`TECH-R003`).

## 5. Data flow for a single title

```
1. swfforge build game.swf --out ./ported-hero
2. SWF reader produces an in-memory model (never a full-file copy; views over the file buffer).
3. Passes run in fixed order (CMP-§4); each pass is pure w.r.t. its inputs and is cached by
   content hash. Intermediates are written to .forge/cache only when --debug-cache is set.
4. Emitters write a TypeScript project:
     ported-hero/
       forge.config.json          resolved build configuration (echoed for reproducibility)
       forge.manifest.json        asset manifest
       assets/                    KTX2, WebP, WOFF2, MP4, Ogg/WebM, MP3
       src/movies/Main.ts         frame scripts, timelines, symbols
       src/movies/Main.symbols.ts exported characters (linkage ids)
       src/classes/*.ts           recovered AS2 classes as TS classes
       src/resources/*.ts         typed asset handles
       src/main.ts                entry: createGame({ ... })
       reports/porting-notes.md   human-readable divergences and decisions
       reports/divergence.json    machine-readable equivalents
5. Nothing is bundled by swf-forge; `npm i && npm run build` uses the project's own toolchain.
```

Steps 2–4 are deterministic (G5). Cache keys are content hashes of the *inputs to that pass*,
never wall-clock time, absolute paths, or environment variables (REPO-§7).

## 6. Compatibility model

Three concentric definitions of "works", all reported by the tool:

| Tier | Name | Definition | Gate |
| --- | --- | --- | --- |
| **C0** | Loads | SWF parses, all tags consumed, no fatal diagnostics, runtime boots and renders frame 1 | `swfforge verify` |
| **C1** | Plays | A scripted play-through of the title's critical path completes with no runtime errors, no NaN geometry, no silent asset misses | RT-§10 self-checks + TST-§5 |
| **C2** | Faithful | Play-through matches the oracle within the declared per-subsystem tolerances (TST-§6) | golden tests + per-title acceptance |

**ARCH-R003** A build MUST state its tier in `reports/porting-notes.md`, and the tier claim MUST be
backed by the corresponding CI artefacts (TST-§9.1). Shipping a C0 build as a finished port
is forbidden by process, not by code.

## 7. Vocabulary

| Term | Definition |
| --- | --- |
| **AVM1** | ActionScript Virtual Machine 1; the VM used by AS1 and AS2 content |
| **Character** | A SWF dictionary definition (`DefineShape`, `DefineSprite`, `DefineFont`, …) |
| **Clip** | A `MovieClip` instance: a timeline-bearing display object |
| **Depth** | Integer z-order within a display list; AVM1 range −16384…1048575 (APP-§3) |
| **Edge** | A line or quadratic-curve segment in a SWF shape |
| **Fill run** | The maximal set of edges drawn with one fill style without interruption |
| **Fidelity level** | F1–F4 declaration attached to a behavioural requirement |
| **Forge project** | The emitted TypeScript project + assets for one title |
| **Host API** | The typed TS surface the emitted code may call (AVM1-§8) |
| **Manifest** | `forge.manifest.json`, the runtime's declarative view of assets (AST-§5) |
| **Oracle** | Flash Player (baseline) or a maintained open-source AVM1 player (differential), used only for testing |
| **Recovery** | Static inference of names, types, and structure from bytecode |
| **Residual code** | AVM1 constructs the compiler cannot safely compile; handled by the interpreter |
| **Settlement** | Sub-pixel coordinate convention; SWF stores twips (1/20 px), Flash settles to 1/20 px |
| **Stage** | The root display object and its pixel surface |
| **Stream sound** | Audio interleaved with frames via `SoundStreamHead*`/`SoundStreamBlock` |
| **Twip** | 1/20 CSS pixel; SWF's primary unit |
| **Tier** | Codegen tier: T0 direct TS, T1 block-state-machine TS, T2 interpreter |
| **Vector IR** | The intermediate representation of a shape's paths and styles (GFX-§4) |

## 8. Risks and their mitigations

| Risk | Impact | Mitigation |
| --- | --- | --- |
| AVM1 behaviours documented nowhere | Silent divergence | Decision register + oracle harness (TST-§4); per-title acceptance |
| Obfuscated bytecode defeats static recovery | Residual interpreter required | Tiering (AVM1-§9); interpreter is small, bounded, and still correct |
| Filters/blends cannot be matched exactly | Visual deltas | Tolerance conformance + shader implementations with documented error (GFX-10) |
| Audio codec licensing/support | Assets unavailable | Codec matrix with per-browser fallbacks (AUD-§4) |
| Performance cliffs from per-clip draws | Frame misses | Draw-call budgets, static batching, cache keys (GFX-§11, GFX-§16) |
| Cross-origin asset URLs in old games | Broken loads | URL virtualisation + explicit network policy (CMP-§10, RT-§6) |
| Scope creep into "player" territory | Project loses its advantage | ARCH-§3 non-goals are normative (ARCH-R001) |
| Under-specified Flash behaviour silently assumed | Divergence discovered by players | Decision registers (every doc) + oracle harness |

## 9. Acceptance of the architecture

**ARCH-R004** The criteria below are the architecture's acceptance gate; they are checked by TST-§9
before any v1 release claim and are re-checked whenever a new subsystem is added to ARCH-§4.

**ARCH-R005** Every risk in ARCH-§8 that names a requirement MUST have an owner (the requirement's
document) and MUST be re-reviewed once per release in the porting-notes risk summary.

The architecture is accepted when, for at least three real AS1/AS2 titles of differing character
(pure timeline animation with light scripting; a physics-y action game with bitmap-heavy assets and
streamed music; a UI-heavy title with dynamic text and vector art), a build:

1. produces a TypeScript project that compiles with `strict` and zero suppressions (REPO-§5),
2. passes C1 in CI on Chromium, Firefox, and WebKit (TST-§8),
3. meets the frame-time budget of TST-§7 on the baseline device, and
4. reports its divergences in `reports/porting-notes.md` with every decision ID cited.

## 10. Decision register

| ID | Decision | Default | Verification | Notes |
| --- | --- | --- | --- | --- |
| ARCH-D01 | Is the interpreter fallback allowed in the shipped bundle? | Yes, only if residual code exists; tree-shaken otherwise | Bundle size gate RT-§9 | Games without residual code must not contain it |
| ARCH-D02 | Are emitted files one-per-symbol or one-per-timeline? | One per timeline + one per recovered class | CMP-§9.2 review | Split threshold: 4000 lines per file (CMP-D04) |
| ARCH-D03 | Is a WebGPU backend in scope? | No for v1; renderer abstraction must permit it | GFX-§3 interface review | Requires `GfxDevice` seam |
| ARCH-D04 | Support `--legacy-positioning` (Flash Player pixel snapping) by default? | On | GFX-§8 fixtures | Affects sub-pixel drift |
| ARCH-D05 | Distribute assets per-file or in a single archive? | Per-file + optional `.sfa` archive | AST-§6 | Per-file is cache-friendly and CDN-friendly |
| ARCH-D06 | Do we ship `reports/` in the emitted project? | Yes (advisory, not part of build) | CMP-§11 | Porters rely on it |

## 11. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | First draft |
| 1.1 | 2026-10-04 | Tech-spec pass: §4.4 added — the five shipped components (`decompiler`, `transpiler`, `code-inspector`, `engine-flash`, `engine-clean`) mapped onto the technical decomposition, with `ARCH-R003` (one owner per capability; engines are alternatives) |
