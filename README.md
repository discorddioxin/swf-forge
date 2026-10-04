# swf-forge

**swf-forge** compiles legacy AS1/AS2 (AVM1) Flash games — `.swf` files, their assets, and their
embedded ActionScript bytecode — into **TypeScript** that runs on the open web with WebGL2 and
Web Audio, and can either **reproduce Flash semantics faithfully** or be **restructured into clean
modern code** (a real game loop; no MovieClip or timeline system).

**Status: specifications only.** No compiler, runtime, or converter code exists yet. Every document
here is a contract that implementation work must satisfy. The upstream *SWF File Format
Specification v19* is fully encoded — chapters 1–15 and Appendices A–C (see
[docs/impl/000-roadmap.md](docs/impl/000-roadmap.md) §9 and §9.1). Implementation starts at phase
**P0**; the work-package index totals **208 packages / ≈646.5 developer-days**.

---

## The five components

The product is five named components (**[docs/TECH-SPEC.md](docs/TECH-SPEC.md)** §2 is the
authority: structure, file layout, toolchain, cross-component rules).

```
  game.swf ─►[ decompiler ]─► model · AVM1 IR · media · reports
                    │
                    ├─►[ transpiler ]─► TypeScript + assets + manifest + source maps
                    │                        │
                    │        ┌───────────────┴────────────────┐
                    │        ▼                                ▼
                    │  [ engine-flash ]                 [ engine-clean ]
                    │  faithful runtime:                restructuring engine +
                    │  timeline · AVM1 · WebGL2 ·       minimal runtime: fixed-step
                    │  Web Audio — plays as-is          loop, scenes/entities, no
                    │                                   MovieClip, typed state
                    │
                    └─►[ code-inspector ]  IDE-like browsing of both sides:
                        file explorer · syntax highlighting · SWF↔TS navigation ·
                        diagnostics/rewrites panels · dev run view
```

| Component | What it is | Package / app | Spec |
| --- | --- | --- | --- |
| **`decompiler`** | Reads a `.swf`: container, tags, dictionary, timeline, AVM1 bytecode → IR, media decode, previews, JSON dumps, diffing | `apps/decompiler` · `@swf-forge/decompiler` | SWF, AVM1, APP |
| **`transpiler`** | Model + IR → TypeScript project, web-native assets, manifest, source maps, reports | `apps/transpiler` · `@swf-forge/transpiler` | CMP, GFX, AUD, AST |
| **`code-inspector`** | Browser IDE over a built project: explorer, highlighting, go-to-definition/references, SWF↔TS cross-navigation, diagnostics, dev run view | `apps/code-inspector` · `@swf-forge/inspector` | INS |
| **`engine-flash`** | The faithful runtime/executor for the transpiled TypeScript: frame loop, MovieClip/timeline model, AVM1 values/events, renderer, mixer | `apps/engine-flash` · `@swf-forge/engine-flash` | RT, AVM1, GFX, AUD |
| **`engine-clean`** | Turns the same analysed title into a modern structured app — fixed-step loop, scenes/entities, typed state, no MovieClip/timeline — with an auditable rewrite log; ships its own minimal runtime | `apps/engine-clean` · `@swf-forge/engine-clean` | CLN |

The two engines are **alternative targets** over one analysed model, never a chain: a title ships on
`engine-flash` by default and graduates to `engine-clean` when its clean gates pass
(`TECH-R030`). Both share assets byte-for-byte.

## The deliverable in one picture

```
   game.swf ──► [ transpiler ] ──► game/                     (TypeScript project)
                   │               ├─ src/movies/*.ts        emitted timeline + AVM1 logic
                   │               ├─ src/resources/*.ts     typed, hashed asset handles
                   │               └─ src/main.ts            entry point
                   │
                   ├──────────► assets/  (KTX2/WebP textures, Opus/AAC audio,
                   │                      WOFF2/MSDF fonts, MP4 video)
                   └──────────► forge.manifest.json   assets, hashes, fonts, audio map,
                                                      stream tables, sprite metadata

   game/ + assets/ ──► [ tsc / vite / your bundler ] ──► static site (no plugin, no eval)
```

The output is ordinary TypeScript: readable, tree-shakeable, debuggable, version-controlled — and
either faithful (`engine-flash`) or restructured (`engine-clean`).

## Specifications

The document set is organised for **building**: behaviour specs, then build plans grouped by the
component that owns the work, then the registers. Orientation map: [`docs/README.md`](docs/README.md).
Working on the code? Start with [`AGENTS.md`](AGENTS.md) — it states the build loop, the
non-negotiables, and how to keep these documents true.

```
docs/
  TECH-SPEC.md     structure, rules, toolset, abilities (the build blueprint)
  specs/           WHAT to build          foundation · format · language · web · quality · components · reference
  impl/            HOW and IN WHAT ORDER  000-roadmap · foundation · decompiler · transpiler · engine-flash
                                          · code-inspector · engine-clean · harness · registers
tools/             verify_docs.py (document gate) · gen_status.py (coverage snapshot)
                   audit_dev.py (code-vs-spec ledger)
```

| Doc | ID | Title |
| --- | --- | --- |
| [docs/TECH-SPEC.md](docs/TECH-SPEC.md) | TECH | **Technical and file specification** — components, repo/file layout, toolset, rules, abilities, interfaces |
| [docs/specs/README.md](docs/specs/README.md) | — | Specification index, conventions, status |
| [000-architecture.md](docs/specs/foundation/000-architecture.md) | ARCH | System architecture, scope, vocabulary, components |
| [010-repository-and-toolchain.md](docs/specs/foundation/010-repository-and-toolchain.md) | REPO | Repository layout, package graph, TypeScript & build rules |
| [020-compiler-pipeline.md](docs/specs/foundation/020-compiler-pipeline.md) | CMP | Compiler pipeline (flash + clean targets), IR, codegen contract, CLI, diagnostics |
| [030-swf-format-and-io.md](docs/specs/format/030-swf-format-and-io.md) | SWF | SWF container parsing, tag stream, bit-level IO, validation |
| [040-avm1-to-typescript.md](docs/specs/language/040-avm1-to-typescript.md) | AVM1 | AS1/AS2 semantics → TypeScript: execution model, objects, display list, host API |
| [050-graphics-webgl.md](docs/specs/web/050-graphics-webgl.md) | GFX | **SWF graphics → WebGL2**: geometry, tessellation, batching, filters, text, caching |
| [060-audio-web.md](docs/specs/web/060-audio-web.md) | AUD | **SWF audio → Web Audio**: decode, re-encode, mixer, sync, envelopes, budgets |
| [070-assets-fonts-bitmaps-video.md](docs/specs/web/070-assets-fonts-bitmaps-video.md) | AST | Bitmaps, fonts/text, video, asset container & manifest format |
| [080-runtime-shell.md](docs/specs/web/080-runtime-shell.md) | RT | Runtime shell: boot, loader, timestep, input, persistence, embedding API |
| [090-conformance-testing.md](docs/specs/quality/090-conformance-testing.md) | TST | Conformance program, oracle harness, golden tests, perf gates |
| [100-security-licensing.md](docs/specs/quality/100-security-licensing.md) | SEC | Security model, sandboxing, licenses, clean-room process |
| [110-appendices-reference-tables.md](docs/specs/reference/110-appendices-reference-tables.md) | APP | Tag/opcode/property/blend/filter/codec reference tables |
| [120-code-inspector.md](docs/specs/components/120-code-inspector.md) | INS | Code inspector: project model, navigation, highlighting, panels, run view |
| [130-engine-clean.md](docs/specs/components/130-engine-clean.md) | CLN | Clean engine: timeline→scene tiering, game loop, rewrite contract, clean runtime |

Implementation plans (how it gets built, in what order):

| Doc | Title |
| --- | --- |
| [docs/impl/000-roadmap.md](docs/impl/000-roadmap.md) | Roadmap: phases P0–P13, milestones, dependencies, work-package index |
| [010](docs/impl/foundation/010-binary-io-and-records.md) … [110](docs/impl/decompiler/110-video.md) | Per-area build plans (bit IO → video) |
| [120](docs/impl/transpiler/120-compiler-and-emitter.md) | Compiler pipeline, emitter, reports |
| [130](docs/impl/engine-flash/130-runtime-and-renderer.md) | Runtime, renderer, interpreter (engine-flash) |
| [140](docs/impl/harness/140-conformance-harness.md) | Conformance harness, fixtures, fuzzing |
| [150](docs/impl/code-inspector/150-code-inspector.md) | Code inspector: indexer, navigation, panels, run view |
| [160](docs/impl/engine-clean/160-engine-clean.md) | Clean engine: transforms, tiering, rewrite log, clean runtime |
| [errata.md](docs/impl/registers/errata.md) · [STATUS.md](docs/impl/registers/STATUS.md) | Upstream divergences and our resolutions · generated coverage snapshot |

## Reading order

0. **[AGENTS.md](AGENTS.md)** + **[docs/README.md](docs/README.md)** — how to work, where everything is.
1. **[TECH](docs/TECH-SPEC.md)** — components, files, toolchain, rules (start here if you are building).
2. **[ARCH](docs/specs/foundation/000-architecture.md)** — what the system is and is not.
3. **[REPO](docs/specs/foundation/010-repository-and-toolchain.md)** + **[CMP](docs/specs/foundation/020-compiler-pipeline.md)** —
   package graph and how a SWF becomes TypeScript.
4. **[SWF](docs/specs/format/030-swf-format-and-io.md)** + **[AVM1](docs/specs/language/040-avm1-to-typescript.md)** —
   the fidelity-critical front half.
5. **[GFX](docs/specs/web/050-graphics-webgl.md)** + **[AUD](docs/specs/web/060-audio-web.md)** — the two large
   media subsystems.
6. **[impl/000-roadmap.md](docs/impl/000-roadmap.md)** — phases and work packages, then the area docs.

## Toolchain (planned; authoritative in TECH-SPEC §4)

Verification: `python3 tools/verify_docs.py` must print `ISSUES: 0` before any commit that touches
the documents; `python3 tools/gen_status.py` regenerates `docs/impl/registers/STATUS.md` after any
work-package edit. `python3 tools/audit_dev.py` (`pnpm audit:dev`) is the code-side ledger: it must
print `NEW FINDINGS: 0`, which means no drift has appeared beyond the findings recorded in
`audits/dev/` (see `audits/dev/03-mechanical-checks.md`).

Node ≥ 20 LTS · pnpm workspaces · TypeScript 5 `strict` with project references (`tsc -b`) · `tsup`
for libraries, Vite for the inspector · `vitest` (node/jsdom/browser) + Playwright for visual/audio
gates · ESLint flat config + Prettier · API Extractor reports · CI stages `lint`, `unit`, `browser`,
`fixtures`, `conformance`, `budgets`, `spec`, `fuzz` — including `tools/spec-verify`, which keeps
this document set internally consistent (citations, id bands, WP totals, appendix tables).

## Non-goals (v1)

- ActionScript 3 / AVM2 (`DoABC`): detected and reported, not compiled.
- Flash video codecs other than as *source* material (Sorenson Spark/VP6 are transcoded at build
  time; nothing proprietary ships to the browser).
- Emulating Flash Player security sandboxes, `SharedObject` cross-domain rules, or DRM.
- Pixel-perfect parity with Flash Player for GPU-era features (filters, blend modes) — these are
  *tolerance-based* conformance targets, see GFX-§13 and TST-§6.
- A SWF *player*: nothing in this project loads and executes a `.swf` at runtime (ARCH-R001).

## License

Specifications in this repository: see [SEC](docs/specs/quality/100-security-licensing.md) — documents are
original work under the repository license; referenced third-party specifications retain their own
terms and are cited, not reproduced verbatim.
