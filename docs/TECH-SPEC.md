# TECH — Technical and File Specification

**Doc ID:** TECH · **Status:** Draft 1.2 · **Normative:** yes (product decomposition, repository and file layout, toolchain, cross-component rules)
**Audience:** everyone who builds or extends swf-forge.
**Companions:** `docs/specs/` (normative behaviour) · `docs/impl/` (build plans, work packages) · this document (how the parts fit, where files live, what runs them).

---

## 1. Purpose and reading order

`swf-forge` is a **source-to-source toolchain**: it compiles AS1/AS2 (AVM1) Flash games into
TypeScript projects that run on the open web. `docs/specs/` says *what the behaviour must be*;
`docs/impl/` says *how it is built, in what order, with which work packages*. This document is the
third leg: **the product structure, the file layout, the toolchain, and the rules that bind the
parts together**. A builder should be able to start from here and never wonder where a file goes or
which document owns a behaviour.

Reading order for a new builder:

| # | Read | Why |
| --- | --- | --- |
| 1 | **TECH** §2 (components), §3 (layout), §4 (toolset) | the map |
| 2 | [ARCH](specs/foundation/000-architecture.md) §2–§5 | goals, decomposition, data flow |
| 3 | [REPO](specs/foundation/010-repository-and-toolchain.md), [CMP](specs/foundation/020-compiler-pipeline.md) | package graph, pipeline stages, emitted-code contract |
| 4 | [docs/impl/000-roadmap.md](impl/000-roadmap.md) | phases P0–P13, milestones, work-package index |
| 5 | the area docs for the phase being built (`docs/impl/010…160`) | bit-level and pass-level obligations |

**TECH-R001** Where this document and a design spec disagree, the design spec wins for *behaviour*
and this document wins for *structure, naming, and toolchain*. Conflicts MUST be resolved in the
same pull request that surfaces them (see §8).

## 2. The five components

The product is five named components. Three of them are build-time tools, two are engines. Each is
a thin application in `apps/` over libraries in `packages/` (§3), each has one job, and none imports
another (§5.2).

```
                         ┌──────────────────────────────────────────────────────────────┐
   game.swf ──────────►  │  swf-forge decompiler                                        │
                         │  container → tags → dictionary → model → media → AVM1 IR     │
                         └───────────┬──────────────────────────────────┬───────────────┘
                                     │ model + IR + media previews      │ JSON dumps, reports
                                     ▼                                  ▼
                         ┌──────────────────────────────────────┐   ┌───────────────────────┐
                         │  swf-forge transpiler                │   │  swf-forge            │
                         │  analyse → emit TypeScript + assets  │   │  code-inspector       │
                         └───────────┬──────────────────────────┘   │  explore, navigate,   │
                                     │ Flash-shaped TS + manifest   │  highlight, inspect   │
                     ┌───────────────┴────────────────┐             └───────────────────────┘
                     ▼                                ▼
        ┌──────────────────────────┐     ┌──────────────────────────────┐
        │  engine-flash            │     │  engine-clean                │
        │  faithful runtime:       │     │  heuristics + refactors →    │
        │  timeline, AVM1, WebGL2, │     │  modern structured app +     │
        │  Web Audio — plays the   │     │  minimal fixed-step runtime  │
        │  transpiled game as-is   │     │  (no MovieClip, no timeline) │
        └──────────────────────────┘     └──────────────────────────────┘
```

| Component | Package / app root | Kind | Ability in one line | Spec of record |
| --- | --- | --- | --- | --- |
| **`decompiler`** | `apps/decompiler` · `@swf-forge/decompiler` | CLI + library (Node) | Reads a `.swf` and everything in it: header, tags, dictionary, timeline, AVM1 bytecode → IR, media decode, previews, JSON dumps, diffs | SWF, AVM1, APP, CMP-§4 |
| **`transpiler`** | `apps/transpiler` · `@swf-forge/transpiler` | CLI + library (Node) | Turns the decoded model + AVM1 IR into a TypeScript project, web-native assets, manifest, source maps, and reports | CMP, AVM1, GFX, AUD, AST |
| **`code-inspector`** | `apps/code-inspector` · `@swf-forge/inspector` | Browser app (static, offline-capable) + optional local server | IDE-like navigation of both the SWF and the generated project: file explorer, syntax highlighting, go-to-definition/references, SWF↔TS cross-navigation, asset preview, diagnostics | INS (new), CMP, AVM1, APP |
| **`engine-flash`** | `apps/engine-flash` · `@swf-forge/engine-flash` | Runtime bundle + types (browser) | Executes the transpiled TypeScript with **Flash semantics**: frame loop, MovieClip/timeline model, AVM1 values/objects/events, WebGL2 rendering, Web Audio mixing | RT, AVM1, GFX, AUD |
| **`engine-clean`** | `apps/engine-clean` · `@swf-forge/engine-clean` | Transformation engine (CLI) + minimal runtime (browser) | Applies declared heuristics and refactor passes to produce a **modern structured app**: no MovieClip/timeline system, explicit fixed-step game loop, classes/modules, typed state — with an auditable rewrite log | CLN (new), CMP, AVM1 |

**TECH-R002** The five components are the only shipped entry points. Every user-visible capability
MUST be attributable to exactly one of them (§6), and every capability MUST have an owning spec id
(§6 matrix).

**TECH-R003** `engine-flash` and `engine-clean` are *alternative targets* over the same analysed
model, never a chain: clean output MUST NOT import, embed, or shim the flash engine.

### 2.1 What each component is not

- `decompiler` is **not** a player: it never executes AVM1 (it decodes and reports). Execution is
  the engines' job.
- `transpiler` is **not** a bundler: it writes TypeScript + assets; the user's `tsc`/Vite does the rest.
- `code-inspector` is **not** an editor by default: it is read-only unless authoring mode is explicitly
  enabled (TECH-D07), and it never mutates the source `.swf` or the user's project behind their back.
- `engine-flash` is **not** a SWF loader: it loads TypeScript, assets, and a manifest — never a `.swf`
  (ARCH-R001).
- `engine-clean` is **not** a "prettifier": it restructures programs using model knowledge and
  declares every rewrite; when a pattern cannot be restructured safely it refuses that title's clean
  build (TECH-D08) instead of guessing.

## 3. Repository and file specification

### 3.1 Top-level tree

```
swf-forge/
├─ README.md                     ← product summary, component map, reading order
├─ docs/
│  ├─ TECH-SPEC.md               ← this document
│  ├─ specs/                     ← normative design specifications (ARCH, REPO, CMP, SWF, AVM1,
│  │                                GFX, AUD, AST, RT, TST, SEC, APP, INS, CLN)
│  └─ impl/                      ← build plans: 000 roadmap, 010–160 area documents, errata, STATUS
├─ apps/                         ← the five components (§2)
│  ├─ decompiler/
│  ├─ transpiler/
│  ├─ code-inspector/
│  ├─ engine-flash/
│  └─ engine-clean/
├─ packages/                     ← libraries; apps compose them, never the reverse
│  ├─ swf/                       @swf-forge/swf        container, tags, bit IO, dictionary
│  ├─ avm1/                      @swf-forge/avm1       AVM1 front end (build time) + runtime (browser)
│  ├─ compiler/                  @swf-forge/compiler   passes, codegen, media compile, reports
│  ├─ clean/                     @swf-forge/clean      clean-code transforms + clean runtime  (new)
│  ├─ analysis/                  @swf-forge/analysis   symbol graph, indexing, source maps    (new)
│  ├─ project/                   @swf-forge/project    forge.project.json model + fs helpers  (new)
│  ├─ runtime/                   @swf-forge/runtime    shell: boot, loader, clock, input, embed API
│  ├─ gfx/                       @swf-forge/gfx        WebGL2 renderer, tessellation, text, filters
│  ├─ audio/                     @swf-forge/audio      Web Audio engine, worklet, stream sync
│  ├─ assets/                    @swf-forge/assets     manifest types, loaders, integrity
│  ├─ cli/                       @swf-forge/cli        `swfforge` umbrella executable
│  └─ testing/                   @swf-forge/testing    writer, oracle harness, golden utilities
├─ fixtures/                     ← test inputs only (synthetic committed, external by hash)
├─ tools/                        ← repo scripts: spec-verify, impl-status, spec-coverage, decisions,
│                                   table codegen, release helpers. Bootstrap today:
│                                   verify_docs.py, gen_status.py, audit_dev.py (Python 3, stdlib)
└─ examples/                     ← tiny hand-written projects exercising the engines directly
```

**TECH-R004** New code goes in `packages/` unless it is one of the five components' entry-point
concerns (CLI wiring, app shell, bundling) — those go in `apps/`. An app MUST NOT exceed 2 000
source lines outside its entry/UI layer; when it does, the logic belongs in a package.

### 3.2 App file layout (identical shape for all five)

```
apps/<component>/
├─ README.md            ← what it is, how to run it, its spec ids, its non-goals
├─ package.json         ← name, type: module, exports, bin/browser entry, sideEffects: false
├─ tsconfig.json        ← extends ../../tsconfig.base.json (browser libs only where needed)
├─ src/
│  ├─ main.ts           ← entry point (bin for CLIs, mounting function for the browser apps)
│  ├─ cli.ts            ← argument table + wiring (CLIs only); no business logic
│  └─ …                 ← entry-layer code only (TECH-R004)
└─ test/                ← vitest (node) / playwright (browser); one file per surface
```

Component-specific entries:

| Component | Extra files | Notes |
| --- | --- | --- |
| `decompiler` | `src/commands/{inspect,dump,diff,assets}.ts` | one file per CLI verb; thin over `@swf-forge/swf` + decoders |
| `transpiler` | `src/commands/{build,verify,report}.ts`, `src/pipeline.ts` | `pipeline.ts` is the only place that wires stages S0–S10 (CMP-§4) |
| `code-inspector` | `index.html`, `src/ui/**`, `src/workers/{indexer,language}.worker.ts`, `public/` | UI components, worker-side indexer; no Node APIs in the browser build |
| `engine-flash` | `src/index.ts` (re-exports `@swf-forge/runtime`, `@swf-forge/avm1/runtime`, `@swf-forge/gfx`, `@swf-forge/audio`), `src/bundle.ts` | the *pinned* engine: emitted projects import this package name only |
| `engine-clean` | `src/commands/{clean,report}.ts`, `src/runtime/index.ts`, `src/transforms/*.ts` | transforms live in `@swf-forge/clean`; the app is CLI + bundling |

### 3.3 Package file layout

```
packages/<pkg>/
├─ README.md            ← scope, exports, browser/Node matrix, spec of record
├─ package.json         ← exports map (`.` and named subpaths), sideEffects, engines
├─ tsconfig.json
├─ etc/<pkg>.api.md     ← API Extractor report (committed; REPO-§6)
├─ src/
│  ├─ index.ts          ← re-exports only (barrel); no logic
│  └─ …                 ← kebab-case modules, one primary export per file
└─ test/
   ├─ *.test.ts         ← unit (vitest)
   ├─ *.browser.test.ts ← browser-mode (vitest or playwright) for gfx/audio/runtime
   └─ fixtures/         ← package-local tiny fixtures; corpus fixtures live in /fixtures
```

**TECH-R005** File and directory names are `kebab-case`; types and classes are `PascalCase`; values,
functions, and rule ids keep their published spelling. One primary export per file; `index.ts` files
contain re-exports only. No default exports in `packages/`.

### 3.4 Generated artifacts (what the tools write — the file contract)

**(a) Transpiler output (flash target)** — owned by `IMPL-120` §4, reproduced here for the file map:

```
<out>/
  src/
    main.ts                 entry: createGame({ manifest, resources, timelines, stage })
    manifest.ts             typed manifest (generated; referenced by the runtime)
    symbols.ts              character/timeline id tables
    frames/{movie.ts, sprite_<id>.ts}
    classes/<ClassName>.ts
    buttons/button_<id>.ts
    residual/<fn>.bytecode.ts
    resources/index.ts      typed asset handles (CMP-§6.3)
  assets/                   content-hashed: ktx2 · webp · ogg/aac/mp3 · woff2 · mp4
  forge.manifest.json       runtime + tooling manifest (single source of truth)
  forge.project.json        ← new (§3.5): project workspace description
  build-info.json           tool versions, gate states, budgets
  porting-notes.json        diagnostics, decisions, [verify] items
  divergence.json           declared expected divergences (harness input)
```

**(b) Clean engine output (clean target)** — owned by `CLN`, layout fixed here:

```
<out>-clean/
  src/
    main.ts                 entry: createApp({ manifest, loop, scenes }).start()
    game/
      loop.ts               fixed-timestep loop + interpolation (the replacement for the timeline)
      state.ts              typed game state (recovered fields + explicit defaults)
      scenes/<Scene>.ts     one module per screen/level (was a timeline or a labelled section)
      entities/<Name>.ts    recovered objects (were sprites/MovieClips/attached clips)
      input.ts              typed input actions (was Key/onEnterFrame polling)
      audio.ts              typed sound handles + playback policy (was Sound/attachSound)
      assets.ts             typed asset handles (same manifest, same hashes as flash target)
    diagnostics/
      REWRITES.md           human-readable log: every heuristic applied, per file
      rewrite-log.json      machine-readable rewrite log (stable ordering)
      migration-report.json what was not modernised, with the reason and the flash-target fallback
  assets/                   byte-identical to the flash target's assets/ for shared payloads
  forge.manifest.json       same manifest schema; `target: "clean"`
  forge.project.json        same schema; `engine: "clean"`
```

**TECH-R006** Both targets MUST consume the same analysed model and MUST produce byte-identical
`assets/` for shared payloads (same content hashes). `merge` of the two targets' manifests is not
required; `diff` of their asset trees MUST be empty for shared entries.

**(c) Decompiler dumps** (used by the inspector and by humans):

```
<dump>/
  model.json               the analysed model (tags, dictionary, timeline, symbols)
  actions/<fn>.json        per-function AVM1 IR + tier + recovery notes
  media/                   previews: PNG/WebP frames, WAV clips, glyph sheets (opt-in, --media)
  report.md                human-readable summary of the dump
```

### 3.5 The project file: `forge.project.json`

One JSON file describes a workspace to every tool (decompiler, inspector, engines, `verify`).
**TECH-R007** Paths inside it MUST be relative and POSIX; it MUST NOT contain timestamps, absolute
paths, host names, or machine identifiers (REPO-R015).

```jsonc
{
  "formatVersion": 1,
  "name": "alien-hominid",
  "source": { "file": "game.swf", "sha256": "…", "bytes": 1234567 },
  "engine": "flash",                        // "flash" | "clean"
  "manifest": "forge.manifest.json",
  "config": { "graphics": { "maxDrawCalls": 700 }, "vm": { "residual": "on-demand" } },
  "report": { "diagnostics": "porting-notes.json", "rewrites": "diagnostics/rewrite-log.json" },
  "sourcemaps": "map/",                     // SWF offset ↔ TS position maps
  "provenance": { "tool": "@swf-forge/transpiler", "version": "0.1.0", "specs": "docs/impl@…" }
}
```

### 3.6 Spec of record (who owns what)

| Artifact / question | Owning document |
| --- | --- |
| Product decomposition, non-goals | ARCH |
| Package graph, TS config, determinism, CI stages | REPO |
| Pipeline stages, config, emitted-code contract, CLI, diagnostics | CMP |
| Tag/bit-level decode | SWF, APP (tables) |
| AVM1 semantics → TS, host API, residual tiering | AVM1 |
| Shapes, tessellation, filters, text | GFX |
| Audio decode/mix/sync | AUD |
| Bitmaps, fonts, video, manifest | AST |
| Runtime shell, embedding, budgets | RT |
| Inspector: project model, navigation, UI surfaces, security | INS |
| Clean engine: heuristics, rewrite contract, clean runtime | CLN |
| Conformance program, oracle, gates, fixtures | TST |
| Security, licences, CSP, clean-room | SEC |
| Structure, file layout, toolchain, cross-component rules | **TECH (this document)** |
| Build order, work packages, effort | IMPL-000 and the area impl docs |

## 4. Toolset

### 4.1 Runtimes and package management

| Concern | Choice | Notes |
| --- | --- | --- |
| Node | **≥ 20 LTS** (CI: 20 and 22) | build-time tools only; `engines` field enforced |
| Browsers | evergreen Chromium, Firefox, WebKit (last 2 versions) | engines + inspector; WebGL2 + Web Audio required, AudioWorklet for the mixer |
| Package manager | **pnpm** workspaces (root `pnpm-workspace.yaml`: `apps/*`, `packages/*`, `examples/*`) | lockfile committed; `--frozen-lockfile` in CI |
| Module format | ESM only (`"type": "module"`) | no CJS build products |
| TypeScript | 5.x, project references (`tsc -b`) | settings per REPO-§5 |

**TECH-R008** Root scripts (the only documented way to run things):

```jsonc
{
  "scripts": {
    "build":        "tsc -b && pnpm -r --filter './apps/**' build",
    "test":         "vitest run",
    "test:browser": "vitest run --browser && playwright test",
    "lint":         "eslint . && prettier --check .",
    "typecheck":    "tsc -b --force",
    "spec:verify":  "node tools/spec-verify/index.js",      // §8.2
    "spec:status":  "node tools/impl-status/index.js",      // impl/registers/STATUS.md
    "fixtures":     "node tools/fetch-fixtures/index.js",
    "clean":        "pnpm -r exec rm -rf dist node_modules/.cache"
  }
}
```

### 4.2 Build, test, lint (per package)

| Concern | Tool | Policy |
| --- | --- | --- |
| Library bundling | `tsup` (esbuild) → ESM + `.d.ts` | browser packages ESM-only; CLIs ship a Node build with a `bin` shim |
| Inspector app bundling | Vite | static output; no server-side rendering |
| Unit tests | `vitest` (node, jsdom, browser mode) | colocated `*.test.ts`; coverage thresholds: compiler ≥ 90 %, gfx/audio ≥ 80 %, others ≥ 85 % |
| Visual/audio tests | Playwright + image diff, `OfflineAudioContext` | TST-§6/§7 gates |
| Lint/format | ESLint (flat config, `typescript-eslint`) + Prettier | import boundaries (REPO-R002), no-`any` (REPO-R009), unused exports |
| API surface | API Extractor (`etc/*.api.md` committed) | any change to a published type is a review event |
| Perf | `vitest bench` + Playwright perf harness | budgets are gates, not dashboards |
| Docs | `tools/spec-verify`, `tools/impl-status`, `tools/spec-coverage` | see §8 |

### 4.3 CI stages

| Stage | What runs | Blocking |
| --- | --- | --- |
| `lint` | eslint + prettier + `tsc -b --force` | yes |
| `unit` | `vitest run` (node + jsdom) | yes |
| `browser` | vitest browser mode + Playwright suites (gfx, audio, runtime, inspector smoke) | yes |
| `fixtures` | synthetic writer round-trips; Appendix A byte-exact check | yes |
| `conformance` | full external corpus, C0/C1/C2 gates (TST-§9) | yes on `main`, per-title on PRs |
| `budgets` | bundle/texture/audio/manifest budgets, clean vs flash comparison | yes |
| `spec` | `tools/spec-verify` (citations, id bands, totals, appendix tables) | yes |
| `fuzz` | bounded fuzz on the changed decoder | yes (bounded), nightly (24 h) |

## 5. Rules

### 5.1 Global

- **TECH-R009** Every behavioural requirement carries an id (`ARCH-R…`, `SWF-R…`, …) and a test id,
  and appears in the owning document's test table. Untested rules are documentation bugs.
- **TECH-R010** Determinism: any tool that writes files MUST be byte-deterministic for identical
  inputs and MUST NOT embed timestamps, absolute paths, host names, or `Math.random()` (REPO-R015).
- **TECH-R011** Diagnostics use the `SF####` registry (`IMPL-010` §7). New areas allocate from their
  own block: **`SF0800`–`0899` = clean engine**, **`SF0900`–`0999` = code-inspector**. No code is
  ever re-used across owners.
- **TECH-R012** Test ids follow the banding convention (`E-023`): design specs own `001…0nn`,
  implementation docs own `1xx`–`9xx`. The new areas: `T-INS-001…0nn` (specs/120) vs `T-INS-1xx`
  (impl/150); `T-CLN-001…0nn` (specs/130) vs `T-CLN-1xx` (impl/160).
- **TECH-R013** No component may load or execute a `.swf` at runtime (ARCH-R001). The decompiler
  reads SWF at build time; the engines only ever see emitted TS, assets, and a manifest.

### 5.2 Boundaries

- **TECH-R014** Dependency direction: `apps/*` → `packages/*` → nothing outside `packages/`.
  `packages/*` MUST NOT import `apps/*`; apps MUST NOT import other apps; `packages/swf` MUST NOT
  import runtime packages (REPO-R004).
- **TECH-R015** The emitted/clean code's only permitted imports are: the engine package
  (`@swf-forge/engine-flash` or `@swf-forge/engine-clean`), the standard library, and the project's
  own relative modules (REPO-R013). Deep imports into other `@swf-forge/*` packages are forbidden in
  generated code.
- **TECH-R016** The engines MUST NOT import the build-time front end (`@swf-forge/swf`,
  `@swf-forge/compiler`); build-time code MUST NOT import `@swf-forge/runtime`,
  `@swf-forge/gfx`, or `@swf-forge/audio` except in tests.
- **TECH-R017** `code-inspector` MAY import `@swf-forge/swf`, `@swf-forge/analysis`, and
  `@swf-forge/project` (read-only decoders), and MUST NOT import `@swf-forge/compiler`'s emitter or
  any engine. Its only write path is authoring mode (§7.3).

### 5.3 Code and output

- **TECH-R018** `strict` everywhere; `any` only at FFI boundaries with an inline justification
  (REPO-R009). Emitted code contains zero suppressions (REPO-R011).
- **TECH-R019** Public package APIs are reviewed through `etc/*.api.md`; a breaking change to a
  published type requires a minor/major bump and a changelog line in the owning design spec.
- **TECH-R020** Emitted and clean code MUST be formatted ASCII-clean: no BOM, LF endings, two-space
  indent (via Prettier defaults), ≤ 100 columns.
- **TECH-R021** Clean output MUST NOT reference `MovieClip`, `Timeline`, `_root`, `_parent`,
  `onEnterFrame`, depth lists, or frame scripts, and MUST NOT import the flash engine. These names
  appearing in clean output is a test failure (`T-CLN-101`), not a style warning.
- **TECH-R022** Clean output MUST have exactly one loop owner (a fixed-timestep loop with
  interpolation) and MUST NOT poll input inside render code; the loop file is the only place that
  reads the clock.
- **TECH-R023** Both engines MUST expose an explicit lifecycle: `create…()` returns an unstarted
  object; `start()`/`run()` begins; `dispose()` releases GPU/audio/worker resources. Importing an
  engine entry MUST NOT start a loop (`CMP-R023` analogue for clean).

### 5.4 Security and safety

- **TECH-R024** The inspector decodes untrusted `.swf` files: decoding MUST run in a worker with no
  DOM/network privileges, time-bounded (SEC-§7), and the UI MUST NOT `innerHTML` any decoded string.
- **TECH-R025** No component may fetch network resources on behalf of a decoded file: all URLs in
  emitted code go through the runtime's policy layer (RT-§6, CMP-§10).
- **TECH-R026** Assets produced by either engine path are served with content hashes and are treated
  as inert data (no scripts, no SVG, no HTML) — `SEC-§4`.

## 6. Abilities matrix

Each cell names the component that owns the capability; the last two columns name the spec and the
test family that proves it.

| # | Ability | decompiler | transpiler | inspector | engine-flash | engine-clean | Spec | Tests |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Read container, tags, dictionary, ordering | ● | | ○ (view) | | | SWF | `T-SWF-*` |
| 2 | Decode all AVM1-era tags & media to IR | ● | ○ (uses) | ○ (view) | | | SWF · GFX · AUD · AST | `T-MOD-*` |
| 3 | AVM1 bytecode → IR, tiers, recovery notes | ● | ○ (uses) | ○ (view) | | | AVM1 | `T-AVM1-*` |
| 4 | JSON dumps, `diff a b`, structural reports | ● | | ● | | ○ (report) | CMP-§9 | `T-CMP-*` |
| 5 | Media previews (textures, sounds, fonts, video) | ● (`assets dump`) | | ● (inline) | ○ (runtime) | ○ (runtime) | AST · GFX | `T-AST-*` |
| 6 | Recover names, classes, prototypes | ○ | ● | ○ | | ● (further) | AVM1-§6 | `T-AVM1-0xx` |
| 7 | Emit TypeScript + source maps + manifest | | ● | ○ (consume) | | ● (clean re-emit) | CMP-§6/§7 | `T-CMP-001…008`, `T-CLN-104` |
| 8 | Compile/normalise media to web formats | ● (decode) | ● (encode) | | ○ (load) | ○ (load) | GFX · AUD · AST | `T-GFX-*`, `T-AUD-*`, `T-AST-*` |
| 9 | Play transpiled game with Flash semantics | | | | ● | | RT · AVM1 · GFX · AUD | `T-RT-*`, `T-AUD-*` |
| 10 | Fixed-step modern loop with interpolation | | | | | ● | CLN-§3 | `T-CLN-103` |
| 11 | Remove MovieClip/timeline systems | | | | | ● | CLN-§4 | `T-CLN-101` |
| 12 | Synthesise scenes, entities, typed state | | | | | ● | CLN-§5 | `T-CLN-105`, `T-CLN-108` |
| 13 | Auditable rewrite log + migration report | | ○ (notes) | ● (display) | | ● | CLN-§6 | `T-CLN-112` |
| 14 | File explorer, syntax highlighting, outline | | | ● | | | INS-§3 | `T-INS-101`, `T-INS-114` |
| 15 | Go-to-definition / find references / SWF↔TS | | ○ (maps) | ● | | | INS-§4 | `T-INS-104`, `T-INS-105` |
| 16 | Diagnostics browsing, jump-to-source | | ○ (report) | ● | | | INS-§5 | `T-INS-113` |
| 17 | Step/observe a running game (frame, VM state) | | | ● | ● (hooks) | ● (hooks) | INS-§6 | `T-INS-110` |
| 18 | Budgets & gate reports | ○ (media) | ● (bundle) | ● (display) | ● (runtime) | ● (clean vs flash) | TST-§7 | `T-TST-*` |

● owns · ○ participates.

## 7. Interfaces

### 7.1 Command-line surface

The umbrella `swfforge` stays the documented entry point (CMP-§8); each component also ships its own
binary so it can be used alone. The umbrella delegates; it contains no logic (TECH-R004).

| Binary | Verbs | Notes |
| --- | --- | --- |
| `swfforge` | `build`, `inspect`, `verify`, `report`, `diff`, `clean`, `serve`, `fetch-fixtures` | prints the resolved config at `--verbose` |
| `forge-decompile` | `inspect`, `dump`, `diff`, `assets` | `--json`, `--verbose`, `--out <dir>`, `--strict`, `--tolerate-length` |
| `forge-transpile` | `build`, `verify`, `report` | identical flags to `swfforge build` |
| `forge-clean` | `clean`, `report`, `apply` | `--from <flash-out>`, `--policy <file>`, `--strict` |
| `forge-inspect` | `serve <projectDir>` | optional local server for the browser inspector |

Exit codes are shared (`CMP-R029`): `0` ok · `1` build/verify failed · `2` unreadable input ·
`3` AVM2 content · `4` threshold exceeded · `5` internal error (with crash bundle). `forge-clean`
adds `6` = *not cleanable under the current policy* (report written, flash target unaffected).

### 7.2 Engine contracts

```ts
// engine-flash (faithful)
import { createGame } from '@swf-forge/engine-flash';
const game = createGame({ manifest, resources, timelines, stage });   // RT-§8
game.run();                                                           // does not start on import

// engine-clean (modern)
import { createApp } from '@swf-forge/engine-clean';
const app = createApp({ manifest, scenes, loop: { fixedStepMs: 1000 / 60, interpolate: true } });
app.start();                                                          // fixed-step loop; TEST-R023
```

**TECH-R027** Both engines take the *same manifest schema* and the *same typed resource handles*;
only the program model differs (`timelines` vs `scenes`). A title's assets are portable between the
two engines by construction (TECH-R006).

### 7.3 Inspector surfaces

| Surface | Input | Output |
| --- | --- | --- |
| Project view | `forge.project.json` + project directory (FS Access API or `forge-inspect serve`) | file tree, editors, outline |
| SWF view | the source `.swf` (decoded in a worker) | tag tree, dictionary, timeline scrubber, media previews |
| Cross-view navigation | source maps in `map/` | jump SWF tag/offset ↔ generated TS position ↔ symbol |
| Diagnostics view | `porting-notes.json`, `rewrite-log.json` | filterable list with jump-to-source |
| Run view | a served project | embedded flash/clean engine with frame stepping (dev builds only) |
| Authoring mode (opt-in, TECH-D07) | user edits | write-back through the file-system layer only; never rewrites assets |

## 8. Governance: keeping the documents true

### 8.1 Document set and id conventions

| Prefix | Owner | Meaning |
| --- | --- | --- |
| `ARCH` `REPO` `CMP` `SWF` `AVM1` `GFX` `AUD` `AST` `RT` `TST` `SEC` `APP` `INS` `CLN` | `docs/specs/*` | requirements (`-Rnnn`), decisions (`-Dnn`), tests (`T-<PFX>-nnn`) |
| `IMPL-0nn` | `docs/impl/*` | implementation rules (`IMPL-0nn-Rnnn`), diagnostics (`SF####`), tests (`T-<AREA>-nnn`) |
| `INS` (area docs) | `docs/specs/components/120-code-inspector.md` + `docs/impl/code-inspector/150-code-inspector.md` | inspector behaviour, then its build plan |
| `CLN` (area docs) | `docs/specs/components/130-engine-clean.md` + `docs/impl/engine-clean/160-engine-clean.md` | clean-engine behaviour, then its build plan |
| `TECH` | this document | structure, layout, toolchain, cross-component rules (`TECH-Rnnn`, `TECH-Dnn`) |

### 8.2 Checks that must stay green

**Bootstrap tooling.** Until the Node toolchain of §4.1 exists, the repository ships three stdlib
Python scripts that implement the checks below, the STATUS projection and the code-side integrity
ledger: `python3 tools/verify_docs.py` (the `spec-verify` checks, plus path/link/id resolution),
`python3 tools/gen_status.py` (the `impl-status` projection, writing
`docs/impl/registers/STATUS.md`) and `python3 tools/audit_dev.py` (`pnpm audit:dev`), which applies the
same spirit to the *code*: registry and severity agreement, emission coverage, rule/test citation
coverage, cross-package import restrictions, output determinism, version-gated diagnostics and the
model dump's documented contract. Its baseline ledger lives in `audits/dev/baseline.json` and its
recorded results in `audits/dev/03-mechanical-checks.md`. They are the gate from now on — a commit that
touches `docs/` MUST leave `verify_docs.py` at `ISSUES: 0`, and a commit that touches `packages/` or
`apps/` MUST leave `audit_dev.py` reporting no new findings. When `tools/spec-verify` and the harness
land they must implement at least the same checks and may absorb these scripts; the check list below is
the contract either way.

`tools/spec-verify` MUST implement, at minimum:

1. every `<DOC>-R/-D` citation resolves to a defined id in the owning document;
2. every cited test id is defined exactly once, and inside its owner's band;
3. changelogs are ascending and the header version equals the last changelog row;
4. `docs/impl/registers/STATUS.md` totals equal the regenerated totals;
5. the Appendix A fixture bytes in `impl/140` equal the upstream 79 bytes;
6. the Appendix B/C tables match their `specs/110` copies entry-for-entry;
7. the registry in `impl/010` §7 has no overlapping ranges;
8. every `docs/` file has a `**Doc ID:**` header and appears in its index (`docs/specs/README.md` or
   `docs/impl/README.md`).

**TECH-R028** A change to any rule that another document cites MUST update the citing documents in
the same pull request: implementation doc → design spec → errata → roadmap → STATUS → this document.

### 8.3 Ripple checklist for a new capability

1. Design spec: requirement + decision ids, test obligations, changelog row, version bump.
2. `docs/impl/150`-style implementation doc: module layout, diagnostics block, WPs, done criteria.
3. Registry rows (`impl/010` §7) for diagnostics; band check for tests (`TECH-R012`).
4. `docs/impl/000-roadmap.md`: phase, phase→doc map, WP index row, totals, changelog.
5. `SPEC` index (`docs/specs/README.md`) and `docs/impl/README.md` rows; decision index in
   `specs/110` §12 if a `-D` id was added.
6. `STATUS.md` regenerated; `tools/spec-verify` green.

## 9. Build order and the first vertical slice

The phase plan lives in `impl/000-roadmap.md` §2; P0–P11 build the compiler and the faithful engine;
this document reserves **P12 (inspector)** and **P13 (clean engine)**. The first vertical slice that
proves the whole product is:

```
P0 readers → P1 container/dictionary → P2 model/timeline → P4 static render
          → P5 AVM1 front end → P6 transpiler → P7 first playable (engine-flash)
          → P12 inspector (navigation over the P2/P6 artifacts)
          → P13 clean engine (game loop + de-timeline over the same model)
```

| Stage | Component | Demo (the thing you can show) | Gate |
| --- | --- | --- | --- |
| P0–P2 | decompiler | `forge-decompile inspect` + `dump` over the corpus, no uncaught errors | `T-SWF-001…004`, `T-MOD-*` |
| P4 | engine-flash (renderer half) | a scriptless SWF renders frame-accurately | `T-GFX-001…` |
| P5–P6 | transpiler | emitted project compiles under `strict` with zero suppressions | `T-CMP-001…005` |
| P7 | engine-flash | an open-corpus title boots and plays 60 frames | C1 (TST-§9) |
| P12 | code-inspector | open a built project, navigate SWF→TS, highlight and jump | `T-INS-101…` |
| P13 | engine-clean | the same title runs on the clean engine with a real game loop and no MovieClip | `T-CLN-101…` |

**TECH-R029** No component may be started before its spec's phase gate: the inspector's indexer
requires P2's model and P6's source maps; the clean engine requires P5's IR and P6's emitter
contract. The roadmap is the ordering authority.

**TECH-R030** The clean engine is opt-in per title. Default builds target `engine-flash`; a title
moves to `engine-clean` when its `T-CLN` suite passes and its `migration-report.json` lists no
blocking pattern (TECH-D08).

## 10. Decision register

| ID | Decision | Default | Rationale |
| --- | --- | --- | --- |
| `TECH-D01` | The five components are `apps/` over shared `packages/` | Accepted | thin products, one library graph, no logic duplication |
| `TECH-D02` | Inspector is a browser app plus an optional local `serve` process | Static/offline build; `serve` for directory access | matches the browser-first ethos; no Electron dependency |
| `TECH-D03` | Clean engine is a separate **target** with its own runtime, not a mode of the flash engine | `--target flash` default; `clean` opt-in per title | fidelity and structure are opposed goals; keep both honest |
| `TECH-D04` | Engines are pinned, versioned bundles re-exported by `@swf-forge/engine-*` | Published with the runtime packages | generated code imports exactly one engine name |
| `TECH-D05` | `forge.project.json` is the single workspace description | JSON, relative POSIX paths, no machine state | one file to open in inspector, `verify`, both engines |
| `TECH-D06` | Clean rewrites are deterministic and logged | `rewrite-log.json` + `REWRITES.md` | auditability (ARCH-G6) survives modernisation |
| `TECH-D07` | Inspector is read-only unless authoring mode is enabled | Read-only | decoded/untrusted content must not mutate a project implicitly |
| `TECH-D08` | Un-restructurable patterns fail the clean build instead of guessing | `forge-clean` exit code 6 + report | a wrong modernisation is worse than a faithful build |
| `TECH-D09` | Diagnostics blocks `SF0800–0899` (clean) and `SF0900–0999` (inspector) | Reserved | one owner per range |
| `TECH-D10` | Clean transformations consume the analysed model/IR, not emitted TS text | Model-driven passes (+ optional TS-formatting pass) | text rewriting is fragile; the model already knows the semantics |
| `TECH-D11` | The inspector's indexer runs in a worker over `@swf-forge/analysis` | Worker, time-bounded | untrusted input (SEC-§7) and UI responsiveness |
| `TECH-D12` | `tools/spec-verify` is a blocking CI stage | Required | documents are the product; they get tests too |

## 11. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-10-04 | Initial technical and file specification: the five components (`decompiler`, `transpiler`, `code-inspector`, `engine-flash`, `engine-clean`), repository and file layout (apps/packages/tools, generated artifact trees, `forge.project.json`), toolset (Node 20+, pnpm, tsup/Vite, vitest/Playwright, ESLint/Prettier, API Extractor, CI stages), cross-component rules (`TECH-R001`–`R030`), abilities matrix, interfaces (CLIs, engine contracts, inspector surfaces), governance and the ripple checklist, build order with the reserved P12/P13 phases, and the `TECH-D01`–`D12` register |
| 1.2 | 2026-10-04 | Bootstrap tooling extended with the code-side integrity ledger (`tools/audit_dev.py`, `pnpm audit:dev`, baseline `audits/dev/baseline.json`, results `audits/dev/03-mechanical-checks.md`): registry/severity agreement, emission coverage, rule and test citation coverage, comment-stripped import restrictions, output determinism, version-gated diagnostics, the model-dump contract and behavioural pins, with a no-new-findings gate for commits under `packages/`/`apps/` |
| 1.1 | 2026-10-04 | Document layout reorganised (`docs/specs/<domain>/`, `docs/impl/<component>/`, registers in `docs/impl/registers/`); the tree in §3.1 and the tool note in §8.2 record the bootstrap Python gates `tools/verify_docs.py` and `tools/gen_status.py` that implement the §8.2 checks until `tools/spec-verify`/`tools/impl-status` exist |
