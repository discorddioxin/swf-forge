# swf-forge — document map

Two layers, plus one blueprint:

| Layer | Folder | Question it answers | Authority |
| --- | --- | --- | --- |
| **Design specs** | [`docs/specs/`](specs/) | *What must the product do, at which fidelity?* | Behaviour: RFC 2119 requirements `<DOC>-Rnnn`, decisions `<DOC>-Dnn`, fidelity levels F1–F4 |
| **Implementation specs** | [`docs/impl/`](impl/) | *How do we build it, in what order?* | Execution: modules, algorithms, diagnostics `SF####`, tests `T-<AREA>-nnn`, work packages `WP-0nn-nn` |
| **Tech spec** | [`TECH-SPEC.md`](TECH-SPEC.md) | *How do the parts fit?* | Structure: apps/packages, file contracts, toolchain, rules, interfaces, abilities matrix |
| **Upstream** | SWF File Format Specification v19 | *What do the bytes mean?* | Byte layout. Cited by chapter/section; never redistributed (see `specs/100`) |

Start with [`../AGENTS.md`](../AGENTS.md) (how to work), then
[`impl/000-roadmap.md`](impl/000-roadmap.md) (what to build first). `specs/030` and `impl/060` in
prose are **document ids**, not paths — resolve them in the tables below.

## 1. Design specs — `docs/specs/`

| Id | Document | Owns | Serves |
| --- | --- | --- | --- |
| ARCH | [`foundation/000-architecture.md`](specs/foundation/000-architecture.md) | Scope, system decomposition, data flow, terminology, the five components | everyone |
| REPO | [`foundation/010-repository-and-toolchain.md`](specs/foundation/010-repository-and-toolchain.md) | Package graph, layout, TS/build/lint/test rules, release | tooling |
| CMP | [`foundation/020-compiler-pipeline.md`](specs/foundation/020-compiler-pipeline.md) | Passes, IR, codegen contract, CLI, diagnostics policy, determinism | transpiler |
| SWF | [`format/030-swf-format-and-io.md`](specs/format/030-swf-format-and-io.md) | Container, tags, bit I/O, dictionary, validation policy | decompiler |
| AVM1 | [`language/040-avm1-to-typescript.md`](specs/language/040-avm1-to-typescript.md) | AS1/AS2 semantics, object model, display list, host API binding | transpiler, engines |
| GFX | [`web/050-graphics-webgl.md`](specs/web/050-graphics-webgl.md) | Vectors, fills, strokes, gradients, text, filters, batching, caching | engine-flash |
| AUD | [`web/060-audio-web.md`](specs/web/060-audio-web.md) | Sound extraction, codecs, mixer, sync, envelopes, budgets | engine-flash |
| AST | [`web/070-assets-fonts-bitmaps-video.md`](specs/web/070-assets-fonts-bitmaps-video.md) | Bitmap/font/video conversion, manifest and archive format | decompiler, transpiler |
| RT | [`web/080-runtime-shell.md`](specs/web/080-runtime-shell.md) | Boot, loader, clock, input, persistence, embedding API | engine-flash |
| TST | [`quality/090-conformance-testing.md`](specs/quality/090-conformance-testing.md) | Oracle harness, golden tests, metrics, perf gates, acceptance | harness |
| SEC | [`quality/100-security-licensing.md`](specs/quality/100-security-licensing.md) | Threat model, CSP/no-eval, third-party licences, clean-room rules | everyone |
| APP | [`reference/110-appendices-reference-tables.md`](specs/reference/110-appendices-reference-tables.md) | Tag, opcode, property, blend, filter, codec tables; decision index | reference |
| INS | [`components/120-code-inspector.md`](specs/components/120-code-inspector.md) | Inspector project model, SWF↔TS navigation, highlighting, panels, run view | code-inspector |
| CLN | [`components/130-engine-clean.md`](specs/components/130-engine-clean.md) | Clean target: timeline→scene tiering, game loop, rewrite contract, clean runtime | engine-clean |

## 2. Implementation specs — `docs/impl/`

Order = build order. Every document declares its design-spec sources, modules, algorithms,
diagnostics, tests and work packages.

| Doc | Document | Covers | Format-spec chapters |
| --- | --- | --- | --- |
| — | [`000-roadmap.md`](impl/000-roadmap.md) | Phases P0–P13, milestones, critical path, work-package index, risk order | all |
| 010 | [`foundation/010-binary-io-and-records.md`](impl/foundation/010-binary-io-and-records.md) | Byte/bit readers, primitives, `RECT`/`MATRIX`/`CXFORM`, strings, code allocation table | Ch.1 |
| 020 | [`foundation/020-container-tag-stream-dictionary.md`](impl/foundation/020-container-tag-stream-dictionary.md) | Header, compression, tag stream, dictionary, processing order | Ch.2 |
| 030 | [`decompiler/030-display-list-and-sprites.md`](impl/decompiler/030-display-list-and-sprites.md) | Display list, PlaceObject/2/3, filters, clip events, sprites | Ch.3, Ch.13 |
| 040 | [`decompiler/040-control-tags-and-metadata.md`](impl/decompiler/040-control-tags-and-metadata.md) | Control tags, exports, scaling grid, scenes, binary data, telemetry | Ch.4, Ch.15 |
| 050 | [`transpiler/050-actions-and-avm1.md`](impl/transpiler/050-actions-and-avm1.md) | Action decoding, IR, tiering, semantics hosts | Ch.5 |
| 060 | [`decompiler/060-shapes-and-gradients.md`](impl/decompiler/060-shapes-and-gradients.md) | Shape records, fill/line styles, gradients, tessellation interface | Ch.6, Ch.7 |
| 070 | [`decompiler/070-images-and-morphs.md`](impl/decompiler/070-images-and-morphs.md) | JPEG/lossless bitmaps, morph shapes | Ch.8, Ch.9 |
| 080 | [`decompiler/080-fonts-and-text.md`](impl/decompiler/080-fonts-and-text.md) | Fonts, glyphs, EM square, static/dynamic text | Ch.10 |
| 090 | [`decompiler/090-sounds.md`](impl/decompiler/090-sounds.md) | Event/stream sounds, ADPCM, MP3, Nellymoser, Speex | Ch.11 |
| 100 | [`decompiler/100-buttons.md`](impl/decompiler/100-buttons.md) | Button records, states, transitions, button sounds | Ch.12 |
| 110 | [`decompiler/110-video.md`](impl/decompiler/110-video.md) | Video codecs, stream tags, frame tables | Ch.14 |
| 120 | [`transpiler/120-compiler-and-emitter.md`](impl/transpiler/120-compiler-and-emitter.md) | Pipeline wiring, IR→TS emission, CLI, reports, verify | — |
| 130 | [`engine-flash/130-runtime-and-renderer.md`](impl/engine-flash/130-runtime-and-renderer.md) | Shell, AVM1 runtime, WebGL2 renderer, audio engine | — |
| 140 | [`harness/140-conformance-harness.md`](impl/harness/140-conformance-harness.md) | Synthetic SWF writer, oracle harness, goldens, perf gates | App. A–C |
| 150 | [`code-inspector/150-code-inspector.md`](impl/code-inspector/150-code-inspector.md) | Project model, worker indexer, navigation, panels, run view | — |
| 160 | [`engine-clean/160-engine-clean.md`](impl/engine-clean/160-engine-clean.md) | Clean transforms, tiering, rewrite log, clean runtime | — |

Registers (not work-package documents):

| Document | What it is |
| --- | --- |
| [`registers/errata.md`](impl/registers/errata.md) | Every divergence found between the upstream spec and our documents (or between our documents), with the resolution and the test that encodes it (`E-001`…) |
| [`registers/STATUS.md`](impl/registers/STATUS.md) | Generated coverage snapshot: per-document state, diagnostics and test registries, chapter coverage, totals. Regenerate with `python3 tools/gen_status.py`; never hand-edit |
| [`deps.md`](deps.md) | Dependency review record (`SEC-D04`): every third-party dependency that ships, its licence, obligations and removal path. A register, not a spec |

The per-document index with status columns and changelogs lives in
[`specs/README.md`](specs/README.md) and [`impl/README.md`](impl/README.md); this file is the
orientation map, those are the catalogues.

## 3. Reading order

1. [`../README.md`](../README.md) — what the product is, in one screen.
2. [`TECH-SPEC.md`](TECH-SPEC.md) §1–§3 — components, repository and file layout.
3. [`impl/000-roadmap.md`](impl/000-roadmap.md) §2–§4 — phases, milestones, first slice.
4. The implementation documents for the phase you are working on, then the design-spec sections
   and format-spec chapters they cite.
5. [`registers/errata.md`](impl/registers/errata.md) — before touching byte-level parsing: it lists
   every place where the upstream spec's prose and our documents disagree, and what we do instead.

## 4. Keeping the map true

- A new document is added to the table above, to the catalogue (`specs/README.md` or
  `impl/README.md`), and to the folder that matches its component (`TECH-R028`).
- Document ids never change; filenames keep their `NNN-` prefix. Moving a document between folders
  is allowed, but the `docs/…md` paths and id-form references in every other document must move with
  it — `python3 tools/verify_docs.py` (checks 15–17) proves they did.
- The generated [`impl/registers/STATUS.md`](impl/registers/STATUS.md) is a projection of the
  documents; regenerate it in the same change as any work-package edit.
