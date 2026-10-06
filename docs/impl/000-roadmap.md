# IMPL-000 — Implementation Roadmap

**Doc ID:** IMPL-000 · **Status:** Draft 1.13 · **Audience:** everyone building swf-forge
**Companion docs:** the per-area implementation specs in this directory; design specs in `docs/specs/`

---

## 1. What "the app" is

swf-forge ships as one product with two halves that are released together:

```
swfforge (CLI, Node ≥ 20)          @swf-forge/* (runtime, browser)
  parse → analyse → emit   ───────► shell + AVM1 runtime + WebGL2 renderer + Web Audio engine
```

A release is "done" when a real AS1/AS2 game can be turned into a TypeScript project that compiles,
boots, plays its critical path, and reports its divergences — on three browser engines, inside the
performance and bundle budgets of the design specs.

The roadmap below is ordered so that **every phase produces something demonstrable**, and so that the
riskiest unknowns (the AVM1 front end and the renderer) are attacked with the cheapest possible
apparatus in place first.

### 1.1 The five components (TECH-SPEC §2)

The product ships as five named components; the roadmap builds the libraries they compose, then the
components themselves. Each is a thin app over `packages/` (`TECH-SPEC.md` §3):

| Component | Package / app | Built by | Phase |
| --- | --- | --- | --- |
| `decompiler` | `apps/decompiler` | 010, 020, 030, 040, 050, 060, 070, 080, 090, 100, 110 | P0–P3 |
| `transpiler` | `apps/transpiler` | 120 (+ the decoders' outputs) | P5–P6 |
| `code-inspector` | `apps/code-inspector` + `@swf-forge/analysis`, `@swf-forge/project` | 150 | **P12** |
| `engine-flash` | `apps/engine-flash` + `runtime`/`gfx`/`audio`/`avm1` | 130 | P4, P7–P10 |
| `engine-clean` | `apps/engine-clean` + `@swf-forge/clean` | 160 | **P13** |

## 2. Phase plan

| Phase | Name | Format-spec chapters | Primary outcome (the demo) | Exit gate |
| --- | --- | --- | --- | --- |
| **P0** | Foundations | Ch.1 | `swfforge inspect game.swf` prints header + tag list; byte readers proven | T-SWF-001…004, T-SWF-009 |
| **P1** | Container & dictionary | Ch.2 | `inspect --tags --symbols` prints dictionary, sprites, exports, ordering violations | T-SWF-002, 003, 007, 008, 010–012 |
| **P2** | Model & timeline | Ch.3, 4, 12, 13, 15 | `forge-decompile dump` prints stable, diffable model JSON; ordered placements, sprites, control tags, button records/conditions, and tag dispositions have tests | T-MOD-001–040/601–604/801–817 + `tools/tag_coverage.py` |
| **P3** | Media decode and build assets | Ch.6–10 + Ch.11 decode/build subset | `forge-decompile assets dump <file.swf> --out <dir>` emits deterministic shape/bitmap PNG debug previews, supported-font WOFF2, PCM/ADPCM WAV previews, MP3 pass-through, and explicit diagnosed fallbacks | T-SWF-005/006 + P3-owned T-MOD/T-AST/T-AUD decode and asset-dump gates |
| **P4** | Static render (no VM) | — | A no-script SWF renders its main timeline in the browser, frame-accurate | T-GFX-001…005, 020, 021 |
| **P5** | AVM1 front end | Ch.5 | `swfforge analyze --tiers` reports T0/T1/T2 per function; coercion suite passes | T-AVM1-008, 009, 012, 025 |
| **P6** | Emitter | — | `swfforge build` emits a project that compiles with zero suppressions | T-CMP-001…005, T-AVM1-026 |
| **P7** | First playable | — | A real open-corpus game boots and plays its first 60 frames | C1 gate (TST-§9.1) |
| **P8** | Audio runtime | Ch.11 playback/sync | Music + SFX play, Web Audio scheduling and stream sound stay in sync for 10 minutes | T-AUD-001…010, 020…027 (runtime gates only; decode/build tests are P3) |
| **P9** | Fidelity hardening | all | Filters, blends, masks, dynamic text, hit testing, device fonts | T-GFX-010…041, T-AST-* |
| **P10** | Video & long tail | Ch.14 | Video plays; controls/metadata/system tags resolved | T-AST-021, T-RT-* |
| **P11** | Release engineering | App. A–C | Fuzzing, budgets, three-engine CI, docs, example titles | TST-§9.2, SEC-§9 |
| **P12** | Inspector | — | Open a built project: file explorer, highlighting, SWF↔TS navigation, diagnostics panels, dev run view | T-INS-101…114 |
| **P13** | Clean engine | — | The same title runs on a fixed-step loop with no MovieClip/timeline, with a rewrite log and probes | T-CLN-101…114 |

Each phase's document-level detail lives in the per-area implementation specs; this document owns
sequencing, dependencies, and the definition of done at phase granularity.

**Phase → implementation documents.** The phases above are sequencing; the work packages live in the
per-area documents. This table is the map between them:

| Phase | Primary doc(s) | Supporting docs |
| --- | --- | --- |
| P0 | [010](foundation/010-binary-io-and-records.md) | 140 (writer) |
| P1 | [020](foundation/020-container-tag-stream-dictionary.md) | 140 |
| P2 | [030](decompiler/030-display-list-and-sprites.md), [040](decompiler/040-control-tags-and-metadata.md), [100](decompiler/100-buttons.md) | 140 |
| P3 | [060](decompiler/060-shapes-and-gradients.md), [070](decompiler/070-images-and-morphs.md), [080](decompiler/080-fonts-and-text.md), [090](decompiler/090-sounds.md) (decode/build subset only) | 140 |
| P4 | [130](engine-flash/130-runtime-and-renderer.md) §5 (renderer half) | 060 (Vector IR), 080 (atlases) |
| P5 | [050](transpiler/050-actions-and-avm1.md) | 130 §6 (object model) |
| P6 | [120](transpiler/120-compiler-and-emitter.md) | 130 §6 |
| P7 | [130](engine-flash/130-runtime-and-renderer.md) | 120 |
| P8 | 090 (runtime/playback subset) + [130](engine-flash/130-runtime-and-renderer.md) §7 | AUD design spec |
| P9 | 030, 060, 080, 100 (fidelity/runtime text paths) | 130, 140 |
| P10 | [110](decompiler/110-video.md) | 040, P3 media models, P4 renderer |
| P11 | [140](harness/140-conformance-harness.md) | 120, 130 |
| P12 | [150](code-inspector/150-code-inspector.md) | 120 (maps, reports), 020/050 (model, disassembly) |
| P13 | [160](engine-clean/160-engine-clean.md) | 050 (IR, tiers), 120 (emitter contract), 130 (renderer/audio bridges) |

A phase is not a document: several phases draw on the same document, and one document (130) spans two
phases. The dependency graph in §4 and the work-package tables in each document are the authority for
what can start when.

### 2.1 Why this order

| Ordering decision | Rationale |
| --- | --- |
| Byte readers first (P0) | Every other subsystem's bugs look like "weird data" if the readers are wrong. Cheap to over-test. |
| Container before anything semantic (P1) | Enables `inspect`, which becomes the debugging tool for every later phase. Also unlocks fuzz testing early. |
| Dictionary/model before media (P2) | Media work needs somewhere to put results; the model dump provides the stable inspection and comparison surface. |
| Media decode before renderer (P3) | You cannot debug a renderer against data you cannot see. PNG/WAV dumps are the fastest feedback loop in the project. |
| Static render before the VM (P4) | Isolates renderer bugs from VM bugs. A no-script SWF has a deterministic expected output, which makes the golden harness possible. |
| AVM1 front end before emitter (P5) | The emitter's hardest decisions (tiering, host-API binding) are made in the front end. Emitting before the analysis is right produces throwaway code. |
| Emitter before runtime polish (P6) | Emitted code is the runtime's test input. Building the runtime against hand-written examples first is a dead end (see `examples/` note in REPO-§2). |
| Audio after first playable (P8) | Game logic and rendering dominate "is this game playable"; audio is a large subsystem that can follow without blocking C1. |
| Fidelity hardening late (P9) | Filters/blends/text need the golden harness to be built and trustworthy, which requires P4–P7. |

### 2.2 Implemented so far (code ↔ spec)

This table records which slice of the plan exists as code and where its evidence lives. It is a
progress note, not a second contract: the work-package tables in each document remain the authority for
what is open, and a package is only "done" for the phase gate when its gate tests run green.

| Slice | Code | Owning docs | Evidence |
| --- | --- | --- | --- |
| P0 byte readers | `packages/swf/src/io/*` | [010](foundation/010-binary-io-and-records.md) | `io.test.ts`, `framing.test.ts` (bit-width limits, soft/strict bounds, matrix rotation, primitive records) |
| P1 container, tag stream, dictionary | `packages/swf/src/container/*` | [010](foundation/010-binary-io-and-records.md), [020](foundation/020-container-tag-stream-dictionary.md) | `framing.test.ts`, `fixture.test.ts`, `diagnostics.test.ts` (headers, lazy tag index/payload, length handling, missing `End`, duplicate ids); ordering and LZMA adapter WPs remain open |
| P2 model & timeline | `packages/swf/src/model/*`, `src/tags/{place,clip-actions,control,buttons}.ts` | [030](decompiler/030-display-list-and-sprites.md), [040](decompiler/040-control-tags-and-metadata.md), [100](decompiler/100-buttons.md) | `model.test.ts`, `placement-corpus.test.ts`, `place-filters.test.ts`, `clip-actions.test.ts`, `control.test.ts`, `buttons.test.ts`, `imports.test.ts` (ordered display ops, exhaustive PO2/PO3 flags, sprites/End, labels/anchors, scenes, imports, button records/conditions/sounds, metadata, binary assets); `tools/tag_coverage.py` and `apps/decompiler/test/dump.test.ts` cover tag disposition and deterministic dump round-trip |
| `inspect` verb | `apps/decompiler/src/commands/inspect.ts` | [060](decompiler/060-shapes-and-gradients.md) §5 reporting | `apps/decompiler/test/inspect.test.ts` (duplicate definitions, strict length handling, exit codes, `--json`) |
| `dump` verb | `apps/decompiler/src/commands/dump.ts`, `src/dump/model-dump.ts` | [040](decompiler/040-control-tags-and-metadata.md) §3.6 | `apps/decompiler/test/dump.test.ts` and audit synthetic probes (field order, sorted maps, file-order labels, op fields, `--out` bytes) |
| P3 media decode | `packages/swf/src/tags/shape.ts` (shape/gradient decoding only) | [060](decompiler/060-shapes-and-gradients.md) | `shape-runs.test.ts`, `shape-regressions.test.ts`; image/font/sound export pipeline and the P3 asset demo remain incomplete |
| P4 static-render reference path | `packages/gfx/*` | [130](engine-flash/130-runtime-and-renderer.md) §5, [`specs/web/050`](../specs/web/050-graphics-webgl.md) | `packages/gfx/test/render.test.ts` + `appendix.test.ts` (Appendix A pixels, deterministic PNG); browser integration and full P4 gate remain open |
| P5 onward | — | — | not started; do not begin P5 before the P4 gate |

Current gate notes (evidence is local and synthetic; this does not claim the open-corpus exit gates):

- The Appendix-A gate found a style-run defect in the shape decoder (only the `FillStyle0` run was
  closed, and the final run was flushed before the end record was read): a fill-less, stroke-only shape
  decoded to four edges and zero runs. `IMPL-060` §6.1 already specifies the correct behaviour; the
  decoder was fixed and `packages/swf/test/shape-runs.test.ts` pins closed runs, `FillStyle1` runs, and
  `SF0186` on an unclosed fill run.
- P0–P2 regression gates now include shape flags/counts, duplicate definitions, missing-character
  placeholders, ordered timeline ops/labels, control metadata, strict FileLength diagnostics and the
  model dump. `SF1000` is emitted independently for `FileAttributes.ActionScript3` and `DoABC`; the CLI
  still maps it to exit 3. The open corpus and fuzz harness remain outstanding (`WP-140-01` and related
  harness work), so this is not a claim that all phase gates are complete.
- The current P4 evidence is a platform-neutral reference renderer over the Appendix A fixture through
  a test-local `VectorShape` → `ShapeGeometry` adapter (`packages/gfx/test/adapter.ts`). It proves the
  pixel/PNG oracle, not browser integration, a production conversion path or the full P4 gate. Keep
  P4 ahead of P5; the AVM1 front end has not started.
- PlaceObject3 filter/image/cache metadata is now decoded and dumped in P2's model, but the renderer
  does not implement filters. Rendering fidelity remains gated by P4/P9 requirements; parsing this
  metadata is not evidence that those visual effects are supported.

## 3. Milestones

| Milestone | Definition | Phase | Verifiable by |
| --- | --- | --- | --- |
| **M0 — Reader** | `swfforge inspect` runs over the whole fixture corpus without an uncaught exception, prints a tag list, and diffs clean twice | P0–P2 | CI job `inspect-corpus` |
| **M1 — Model complete** | Every AVM1-era tag in the corpus is either modelled or explicitly reported (`I`/`E` per APP-§2) | P2 | coverage report: 0 unknown-tag warnings on synthetic corpus |
| **M2 — Pixels** | The static-render demo matches archival captures within TST-§6.1 tolerances for 20 fixtures | P4 | visual golden suite |
| **M3 — Language** | AVM1 coercion/format/timeline suites pass; tier report on the open corpus | P5 | T-AVM1 suite |
| **M4 — Compile** | `swfforge build` output compiles under `strict` with zero suppressions for all synthetic fixtures; `swfforge verify` clean | P6 | `emit` CI stage |
| **M5 — Play** | Three titles from the open corpus reach C1 (scripted play-through, no errors) | P7 | `conformance` CI job |
| **M6 — Sound** | Stream sync ≤ 12 ms drift over 10 minutes; no click artifacts in the transition suite | P8 | T-AUD-027, T-AUD-022 |
| **M7 — Faithful** | Corpus reaches C2 on the declared tolerances; perf and bundle budgets met on both baselines | P9–P11 | TST-§7, TST-§9 |
| **M8 — Inspect** | A built project opens in the inspector: provenance badges, SWF↔TS jumps resolve, diagnostics export | P12 | T-INS-101…114 |
| **M9 — Clean** | One open-corpus title runs on the clean engine with probes passing and a rewrite log | P13 | T-CLN-101…114 |

Milestones are cumulative gates: M4 cannot be claimed while M2 is failing.

## 4. Dependency graph

```
P0 readers ──► P1 container ──► P2 model/timeline ──┬──► P3 shapes/gradients ──┐
                                                   ├──► P3 bitmaps/fonts ─────┤
                                                   ├──► P3 sounds ────────────┤
                                                   └──► P5 AVM1 front end ────┤
                                                                              │
                        P4 renderer (needs shapes/bitmaps/text) ◄─────────────┤
                        P6 emitter   (needs P2 + P5 + assets)   ◄─────────────┤
                        P7 first playable (needs P4 + P6)       ◄─────────────┘
                        P8 audio runtime (needs P3 sound assets + AUD runtime contract)
                        P9 fidelity (needs P4 + P7 + golden harness)
                        P10 video (video decode/build owned here; needs P3 infrastructure + P4 renderer)
                        P11 release (needs everything)
```

Hard edges that are easy to get wrong:

- **P6 emitter → P2 model**: emitted code is generated *from the Movie Model*, not from re-parsing tags.
  If the model is lossy, the emitter invents workarounds that later become permanent. Get the model
  right (CMP-§3 `MovieModel`).
- **P4 renderer → P3 Vector IR**: the renderer consumes `VectorShape` (CMP-§5.1), never SWF bytes.
  This boundary is what makes the renderer testable and reusable (REPO-R006). Do not breach it.
- **P7 → P6 + P4 together**: "first playable" is an integration milestone, not a component milestone.
  Budget integration time; it is consistently the largest single line item in projects of this shape.
- **P9 → P2**: filter/blend *metadata* comes from `PlaceObject3` in the model (Ch.3), even though the
  implementation lands in P9. Do not defer parsing it — defer *rendering* it.

## 5. Parallelisation

The graph above is deliberately wide after P2. Recommended splits:

| Team size | Plan |
| --- | --- |
| **1 engineer** | Strictly sequential P0→P11. Do not start P4 before P3 lands; the renderer needs data. |
| **2 engineers** | A: P0→P2→P5→P6 (compile path). B: P3→P4→P8 (media path). Merge at P7. |
| **3 engineers** | A: P0→P2→P5. B: P3 (shapes/bitmaps/fonts)→P4. C: P6→runtime shell (RTP) + harness, then P8. |
| **4+** | Add a dedicated harness/testing owner from day one (the synthetic SWF writer pays for itself by P3), and a separate owner for audio from P8. |

Cross-cutting roles that must exist regardless of team size: an **owner for the conformance harness**
(140) from P1 onward, and a **decision-register maintainer** (the design specs' decision tables) who
ensures every measurement lands in the table it belongs to.

## 6. Phase exit criteria detail

### P0 — Foundations

| Criterion | Evidence |
| --- | --- |
| `ByteReader`/`BitReader` pass T-SWF-001…004 with hand-computed vectors | unit tests |
| EncodedU32, FLOAT16, FB[n], RECT, MATRIX, CXFORM, RGBA/ARGB all implemented | unit tests incl. the §10 erratum case |
| Zero-copy contract honoured (REPO/R001 equivalent for the parser) | a test that allocates a 5 MiB buffer and asserts allocation count |
| Diagnostic framework emits `SF` codes with scope | unit tests |

### P1 — Container & dictionary

| Criterion | Evidence |
| --- | --- |
| FWS/CWS/ZWS all parse; length mismatch policy matches SWF-R009 | unit + fixture tests |
| Tag index built lazily; sprite ranges recorded | unit tests |
| Ordering rule violations detected and reported (Ch.2 rules) | new diagnostics `SF0024`–`SF0026`, `SF0032` (020 §9) |
| Fuzz smoke: 10⁴ mutations, zero uncaught exceptions | CI job |

### P2 — Model & timeline

| Criterion | Evidence |
| --- | --- |
| `PlaceObject`/`2`/`3` produce ordered `PlacementOp[]` per frame | unit + model-dump golden |
| Sprite tree, frame labels, scenes, exports resolved | model dump on synthetic corpus |
| Buttons decoded into records + conditions | unit tests |
| Tag coverage report: every AVM1-era tag dispositioned | `tools/tag-coverage` output |

### P3 — Media decode and build assets

| Criterion | Evidence |
| --- | --- |
| `forge-decompile assets dump <file.swf> --out <dir>` emits deterministic shape/bitmap debug PNGs, supported-font WOFF2, PCM/ADPCM WAV previews, MP3 pass-through, and explicit diagnosed fallbacks | CLI golden: manifest schema, hashes, and two-run byte comparison |
| Production model exposes decoded `VectorShape`; edge widths, fill rules, and style-change records are covered | T-SWF-005/006; P3-owned T-MOD-101…123 |
| P3-owned image/morph tags, font/text records, and sound metadata decode into typed models | T-MOD-301…313/401…408/501…506/511…518; T-AUD-103…115 decode/build cases |
| SWF ADPCM output matches independent reference vectors at every bit width; JPEG/PNG/lossless output matches an independent decoder | T-AUD-002; T-AST-001…004 |
| WOFF2 and supported build-time atlas outputs are reproducible; CFF and intentionally unsupported codecs are explicit fallbacks | T-AST-023; font/audio fallback fixtures |
| Runtime text/input, audio playback/sync, full-timeline rendering, and video are not P3 criteria | P7–P9/P8/P4/P10 gates respectively |

### P4 — Static render

| Criterion | Evidence |
| --- | --- |
| Golden frames for 20 no-script fixtures within tolerance | visual suite (TST-§6.1) |
| Draw-call and allocation budgets met on `perf-static` | T-GFX-050, T-GFX-021 |
| Context-loss recovery works | T-GFX-060 |

### P5 — AVM1 front end

| Criterion | Evidence |
| --- | --- |
| Opcode table complete for 0x00–0x9F; unknown opcodes make functions residual | unit + fuzz |
| Coercion suites pass (Add/Add2/StringAdd, isNaN, ToString 15-digit) | T-AVM1-008/009/025 |
| Tier report for the open corpus with reasons per T2 function | `swfforge analyze --tiers --json` |
| Interpreter executes residual blocks and honours the instruction budget | T-AVM1-027 |

### P6 — Emitter

| Criterion | Evidence |
| --- | --- |
| Emitted projects compile under `strict` with zero suppressions | `emit` CI stage |
| Determinism: two clean builds byte-identical | T-CMP-001 |
| `swfforge verify` clean; manifest hash checks pass | T-CMP-005 |
| Golden diffs reviewed and small | golden suite |

### P7 — First playable (integration)

| Criterion | Evidence |
| --- | --- |
| Three open-corpus titles reach C1 | `conformance` job |
| No placeholder assets rendered in the first 60 frames | instrumentation assertion |
| Denied-URL count matches the build report | runtime vs build cross-check |

### P8 — Audio runtime

| Criterion | Evidence |
| --- | --- |
| Runtime selection/scheduling and playback are deterministic over the prepared P3 assets | T-AUD-010 and runtime playback suite |
| Stream sync drift ≤ 12 ms over 10 min with jumps | T-AUD-027 |
| No clicks across start/stop/steal/loop/re-anchor | T-AUD-025 |
| Web Audio/worklet mixer budgets met | TST-§7.2 `perf-audio` |

P3 owns sound tag/model decoding, ADPCM/PCM conversion, MP3 framing/pass-through, codec-appropriate
preview artifacts, and deterministic build metadata. P8 owns playback, voice management, mixer/DSP,
real-time scheduling, and stream-sync behavior; P3 does not close those runtime gates.

### P9 — Fidelity hardening

| Criterion | Evidence |
| --- | --- |
| Filters/blends/masks/text within declared tolerances | T-GFX-010…041, T-AST-020 |
| Hit testing parity at bbox level exactly and shape level within tolerance | T-GFX-030 |
| Device-font substitution table complete and reported | AST-§4.6 report |

### P10 — Video & long tail

| Criterion | Evidence |
| --- | --- |
| Video frame timing preserved; SSIM ≥ 0.98 vs source decode | T-AST-021 |
| `fscommand`, `System.capabilities`, `ExternalInterface` mappings documented and tested | T-RT-013 |

### P11 — Release engineering

| Criterion | Evidence |
| --- | --- |
| 24 h fuzz with zero crashes | nightly job history |
| Security suite green (T-SEC-001…011) | CI |
| Bundle, texture, audio, manifest budgets met | `budgets.json` |
| Decision register: 0 un-triaged entries | `tools/decisions status` |

## 7. Effort model

Planning figures, to be corrected in place as packages complete (IMPL-R003). Developer-days,
implementation + unit tests:

| Phase | Content | Est. (d) | Notes |
| --- | --- | --- | --- |
| P0 | readers, records, diagnostics skeleton | 12–18 | Highest leverage per line of code in the project |
| P1 | container, compression, tag index, dictionary | 15–22 | LZMA is optional; zlib is 2 d |
| P2 | model, timeline, place/remove, sprites, buttons, control tags | 25–35 | Wide but shallow |
| P3 | shapes/gradients, bitmaps/morphs, font/text decode + WOFF2/atlas build, and sound decode/build assets | 146–173 | 146 d summed from P3-owned WPs: 060 (38), 070 (40 incl. asset-dump integration), 080 (36), 090 (32); upper 27 d is phase integration/conformance overhead. Video is P10; runtime audio is P8. This is gross phase scope, not remaining effort. |
| P4 | renderer core: tessellation, batching, text, atlases | 60–90 | The largest single subsystem |
| P5 | AVM1 decode, IR, tiers, host binding | 45–65 | Front end only; runtime semantics are P7 |
| P6 | emitter, resources, manifest, CLI, reports, verify | 30–45 | |
| P7 | runtime shell + AVM1 runtime + integration | 50–75 | Integration alone is typically 20–30% of this |
| P8 | audio build pipeline + worklet mixer + sync | 35–50 | |
| P9 | filters, blends, masks, dynamic text, hit testing | 35–55 | Tolerance-driven; expect iteration |
| P10 | video, system/long-tail API | 15–25 | |
| P11 | fuzz, security, budgets, docs, examples | 20–30 | |
| **Total** | | **≈ 488–683** | One engineer: 23–33 months. Three: 10–15 months. |

The work-package tables in the per-area documents (indexed in §10) total **≈ 646.5 developer-days**
for implementation plus unit tests. P3's corrected phase estimate is derived from the P3-owned WP
slices (148 d gross) after removing P4/P8/P9/P10 work; it is not a claim about remaining effort.
Phase ranges also include integration, conformance, and release-engineering overhead that is not
attributed to any single package.

These numbers assume the harness (doc 140) is built as part of P0–P2 rather than retrofitted; retrofitting
a corpus + oracle harness costs roughly the same as building it, but only after you have already paid
for the bugs it would have caught.

## 8. Risk-ordered work

| Risk | Probability | Impact | Mitigation | Owning doc |
| --- | --- | --- | --- | --- |
| AVM1 semantics unknowable for some patterns | high | high | Decision registers + oracle harness; tiering keeps failures local; residual interpreter as a correctness floor | 050, 140 |
| Renderer cannot reach Flash fidelity on AA/curves | medium | high | Tolerance policy declared up front; supersampled fallback; goldens from archival captures | 130 |
| Filter/blend performance cliffs | medium | medium | Group budgets; cache keys; degrade to unfiltered with a reported risk | 130 |
| Stream audio sync drift | medium | medium | Sample-accurate scheduling + frame table + drift instrumentation from day one | 090, 130 |
| Obsolete codecs (VP6/Nellymoser/Speex) | high | low | Decode-only at build time; per-asset failure with stub policy | 090, 110 |
| Corpus licensing | medium | medium | Synthetic writer first; external fixtures fetched by hash, never committed | 140 |
| Scope creep into "player" | medium | high | ARCH-R001 is normative: no runtime SWF loading path | 000 (design) |
| Chapter intake slows implementation | medium | low | Partial documents carry explicit open-item tables; work that does not depend on them proceeds | all |

## 9. Chapter intake process

Chapters of the format spec arrive incrementally. The intake procedure is fixed so that receiving a
chapter is a mechanical, reviewable event:

1. **Locate** the affected implementation docs via §2's document map (chapter → doc).
2. **Reconcile** each row of the doc's §Open items table: confirm, correct, or add. Corrections to
   byte layout go into *our* tables; the reasoning goes in the doc's changelog.
3. **Correct the design specs** if the chapter contradicts them (IMPL-R001), including any decision
   register entry that the chapter settles — mark it `[SETTLED: <ref>]`.
4. **Adjust work packages** if the chapter reveals work that was not scoped (record it; do not silently
   absorb it).
5. **Fold erratum findings** into `docs/impl/registers/errata.md`: upstream examples that contradict upstream
   field definitions, with our resolution and the test that encodes it. (The RECT worked example in
   Ch.1 already provides one entry.)

### 9.1 Appendix intake (complete, 2026-10-04)

The v19 document ends with three appendices. They are not narrative chapters, and each lands where its
content belongs rather than in a new doc:

1. **Appendix A — the worked example (pp. 223–236).** A complete 79-byte `FWS` v3 file, annotated
   bit by bit. It becomes the **committed golden fixture** (`IMPL-140` §2.1): the writer must re-emit
   the bytes exactly, and the readers must reproduce every annotated value — asserted by `T-TST-101`/
   `T-TST-102` and decomposed into `T-SWF-022`/`T-SWF-023` (header, tag framing, long header),
   `T-MOD-604` (placement walk) and `T-MOD-123` (shape walk, including the resolution of the
   shape-record alignment question). Its printed *tables* carry typesetting defects, recorded in
   `E-025`; the bytes are authoritative.
2. **Appendix B — the reverse tag index (pp. 237–239).** The tag-value authority: `specs/110` §2 is
   now exactly its 65 entries (`E-026` removed six invented names), unknown codes take the skip-by-length
   path, and `T-TST-103` machine-checks the equality.
3. **Appendix C — the Screen Video v2 palette (pp. 240–243).** 128 default colours, shipped as a frozen
   constant by `IMPL-110` §6 and mirrored in `specs/110` §10.12; `T-TST-104` compares all 128 values in
   appendix order.

With §9.1 done, **every section of the v19 document — Ch.1–Ch.15 and Appendices A–C — is encoded**
in `docs/specs` + `docs/impl`. Remaining open items are oracle-, corpus- or policy-pinned, never
"chapter not read yet".

## 10. Work package index

Generated from the per-area documents. Regenerate with `tools/impl-status --index`.

<!-- WP-INDEX:BEGIN -->
| Doc | Area | WPs | Dev-days |
| --- | --- | --- | --- |
| [010](foundation/010-binary-io-and-records.md) | Binary IO and Primitive Records | 12 | 20 |
| [020](foundation/020-container-tag-stream-dictionary.md) | Container, Tag Stream, Dictionary, and Processing | 12 | 26 |
| [030](decompiler/030-display-list-and-sprites.md) | Display List, Placements, Filters, and Sprites | 12 | 30 |
| [040](decompiler/040-control-tags-and-metadata.md) | Control Tags and Metadata | 15 | 26 |
| [050](transpiler/050-actions-and-avm1.md) | Action Decoding and the AVM1 Front End | 17 | 46 |
| [060](decompiler/060-shapes-and-gradients.md) | Shapes, Paths, and Gradients | 14 | 42 |
| [070](decompiler/070-images-and-morphs.md) | Bitmaps, Lossless Images, and Shape Morphing | 15 | 53 |
| [080](decompiler/080-fonts-and-text.md) | Fonts and Text | 14 | 45 |
| [090](decompiler/090-sounds.md) | Sounds: Event, Streaming, and Codec Paths | 12 | 36 |
| [100](decompiler/100-buttons.md) | Buttons and Hit Testing | 10 | 26 |
| [110](decompiler/110-video.md) | Video: Embedded Codecs and Transcoded Delivery | 11 | 34 |
| [120](transpiler/120-compiler-and-emitter.md) | Compiler Pipeline, Emitter, and Build Output | 14 | 46 |
| [130](engine-flash/130-runtime-and-renderer.md) | Runtime, Renderer, and Interpreter | 17 | 88 |
| [140](harness/140-conformance-harness.md) | Conformance Harness, Fixtures, and Fuzzing | 11 | 48.5 |
| [150](code-inspector/150-code-inspector.md) | Code Inspector: Indexing, Navigation, Run View | 12 | 41 |
| [160](engine-clean/160-engine-clean.md) | Clean Engine: Transforms and Runtime | 13 | 51 |
| **Total** | | **211** | **≈ 658.5** |

These 211 work packages are the buildable units. The roadmap's phase table adds integration, conformance, and release-engineering work on top; the total remains inside the class estimate in §7. Test ids and per-document work totals are summarized in `docs/impl/registers/STATUS.md`, regenerated with `python3 tools/gen_status.py`.

**Ordering rule:** a package may start when every `Depends` id is *reviewed*, not necessarily complete; the roadmap's phases (§2) already encode the cross-document ordering.
<!-- WP-INDEX:END -->

## 11. Release definition

v1.0 is released when, for at least three titles of differing character (timeline animation with light
scripting; bitmap-heavy action game with streamed music; UI-heavy title with dynamic text and vector
art):

| Requirement | Source |
| --- | --- |
| C2 tier with all divergences listed and decision IDs cited | ARCH-§9, TST-§9.1 |
| Compiles from a clean checkout with one command, deterministic output | REPO-§5, CMP-R041 |
| Perf and bundle budgets met on `baseline-desktop` and `baseline-mobile` | TST-§7, RT-§9 |
| Three-engine browser matrix green with skips documented | TST-§8 |
| Security suite green; `THIRD_PARTY.md` complete | SEC-§9 |
| Every design-spec decision entry either settled or explicitly accepted | APP-§12, IMPL-R002 |
| `docs/impl/registers/errata.md` current | §9.5 |

## 12. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Roadmap created; chapters 1–2 grounded; phases P0–P11 defined |
| 1.1 | 2026-10-04 | Ch.3/Ch.4 pass folded in: WP index re-derived for 030 (11/27) and 040 (14/21.5); totals 165 WPs / ≈495.5 d |
| 1.2 | 2026-10-04 | Ch.5/Ch.6 pass folded in: 050 (17/46) and 060 (13/39) re-derived; totals 171 WPs / ≈508.5 d; chapter-intake notes updated to the Ch.7 backlog |
| 1.3 | 2026-10-04 | Ch.7/Ch.8/Ch.9 pass folded in: 060 re-derived (14/42) with the gradient structures, 070 rewritten against Ch.8/Ch.9 (14/47); totals 174 WPs / ≈520.5 d; chapter-intake notes now point at Ch.10–Ch.15 as the remaining input |
| 1.4 | 2026-10-04 | Ch.10/Ch.11 pass folded in: 080 rewritten against Ch.10 (13/41) and 090 against Ch.11 (12/36); totals 176 WPs / ≈529.5 d; remaining input is Ch.12–Ch.15 (buttons, sprites, video, metadata) |
| 1.5 | 2026-10-04 | Ch.12–Ch.15 pass folded in — the final chapter batch: 100 re-derived against Ch.12 (10/26), 110 against Ch.14 (11/34), 030 gains the Ch.13 sprite model (12/30), 040 the Ch.15 tag bodies (14/24); totals 181 WPs / ≈551 d; the chapter map is complete for Ch.1–Ch.15 |
| 1.6 | 2026-10-04 | Appendix pass: §9.1 added (Appendix A golden fixture, Appendix B tag-index authority, Appendix C palette — the upstream document is now fully encoded); `IMPL-140` gains WP-140-10/11 (11 WPs / 48.5 d), totals re-derived to 183 WPs / ≈554.5 d |
| 1.7 | 2026-10-04 | Tech-spec pass: the five components are mapped in §1.1; phases **P12 (inspector)** and **P13 (clean engine)** added with their doc-map rows and milestones; WP index gains 150 (12/41) and 160 (13/51); totals re-derived to 208 WPs / ≈646.5 d |
| 1.8 | 2026-10-04 | Folder reorganisation: the document map now points at `foundation/`, `decompiler/`, `transpiler/`, `engine-flash/`, `code-inspector/`, `engine-clean/`, `harness/` and the registers directory; document ids, work packages and totals unchanged; verification moved to `tools/verify_docs.py` + `tools/gen_status.py` |
| 1.9 | 2026-10-04 | Implementation started (Phase 10): §2.2 added to record the code that exists and where its evidence lives — P0 readers, P1 container/dictionary, P2 model, the `inspect` verb and the P4 reference renderer (`packages/gfx`), with the Appendix-A gate and the shape style-run defect it found; the phase tables and the work-package index are unchanged |
| 1.10 | 2026-10-04 | `dump` implemented (`WP-040-14`): §2.2 gains its row; the P0–P2 gate note records what is closed locally and what still needs the corpus harness and the AVM2 signals |
| 1.11 | 2026-10-05 | P1 resolution pass: the P1 exit-criteria row for ordering-rule diagnostics cited a nonexistent `SF0120`-range; corrected to `SF0024`–`SF0026`, `SF0032` (020 §9 — `SF0120` belongs to doc 100) |
| 1.12 | 2026-10-05 | P2 integrity resolutions (R-P2-15): the P2 demo/exit rows now cite the `forge-decompile dump` verb instead of the never-built `inspect --timeline`/`verify`; §2.2 records the `control.test.ts` evidence and that buttons (doc 100) remain open until their resolution lands |
| 1.13 | 2026-10-05 | P2 repeat audit: mark the model/data-level button criterion resolved with `buttons.test.ts` + AVM1 action-block integration evidence; add the exhaustive placement corpus, clip-action/import model suites, and tag-coverage tool to the §2.2 evidence row; retain runtime pointer/hit-test work as a P4/P7 boundary, not as a P2 decoder gap |
