# swf-forge specification set

This directory holds the normative specifications for the swf-forge project: a compiler and
runtime that turn AS1/AS2 (AVM1) Flash games into clean TypeScript that runs on WebGL2 and Web Audio.

The **product structure** — the five components (`decompiler`, `transpiler`, `code-inspector`,
`engine-flash`, `engine-clean`), the repository and file layout, the toolchain, and the
cross-component rules — lives in [`docs/TECH-SPEC.md`](../TECH-SPEC.md). The documents below own
*behaviour*; the tech spec owns *structure*.

## Folders

| Folder | Documents |
| --- | --- |
| `foundation/` | `000` architecture · `010` repository and toolchain · `020` compiler pipeline |
| `format/` | `030` SWF format and I/O |
| `language/` | `040` AVM1 → TypeScript |
| `web/` | `050` graphics · `060` audio · `070` assets/fonts/bitmaps/video · `080` runtime shell |
| `quality/` | `090` conformance testing · `100` security and licensing |
| `components/` | `120` code-inspector · `130` engine-clean |
| `reference/` | `110` appendices and reference tables |

A document is cited by its **id** (`specs/030`, `GFX-§5.5`), never by a path that can move; the id
columns below are stable. Orientation map: [`docs/README.md`](../README.md); how to work:
[`AGENTS.md`](../../AGENTS.md).

## Documents

| ID | File | Owns | Primary audience |
| --- | --- | --- | --- |
| ARCH | [`foundation/000-architecture.md`](foundation/000-architecture.md) | Scope, system decomposition, data flow, terminology | everyone |
| REPO | [`foundation/010-repository-and-toolchain.md`](foundation/010-repository-and-toolchain.md) | Package graph, layout, TS/build/lint/test rules | tooling + all authors |
| CMP | [`foundation/020-compiler-pipeline.md`](foundation/020-compiler-pipeline.md) | Passes, IR, codegen contract, CLI, diagnostics, determinism | compiler authors |
| SWF | [`format/030-swf-format-and-io.md`](format/030-swf-format-and-io.md) | Container, tags, bit IO, dictionary, validation policy | compiler + runtime authors |
| AVM1 | [`language/040-avm1-to-typescript.md`](language/040-avm1-to-typescript.md) | AS1/AS2 semantics, object model, display list, host API binding | VM authors, game porters |
| GFX | [`web/050-graphics-webgl.md`](web/050-graphics-webgl.md) | Vectors, fills, strokes, gradients, text, filters, batching, caching | graphics authors |
| AUD | [`web/060-audio-web.md`](web/060-audio-web.md) | Sound extraction, codecs, mixer, sync, envelopes, budgets | audio authors |
| AST | [`web/070-assets-fonts-bitmaps-video.md`](web/070-assets-fonts-bitmaps-video.md) | Bitmap/font/video conversion, manifest & archive format | asset pipeline authors |
| RT | [`web/080-runtime-shell.md`](web/080-runtime-shell.md) | Boot, loader, clock, input, persistence, embedding API | runtime authors, integrators |
| TST | [`quality/090-conformance-testing.md`](quality/090-conformance-testing.md) | Oracle harness, golden tests, metrics, perf gates, acceptance | QA + all authors |
| SEC | [`quality/100-security-licensing.md`](quality/100-security-licensing.md) | Threat model, CSP/no-eval, third-party licences, clean-room rules | security + legal-adjacent review |
| APP | [`reference/110-appendices-reference-tables.md`](reference/110-appendices-reference-tables.md) | Tag, opcode, property, blend, filter, codec tables | reference |
| INS | [`components/120-code-inspector.md`](components/120-code-inspector.md) | Project model, navigation (SWF↔TS), highlighting, panels, run view | inspector authors, porters |
| CLN | [`components/130-engine-clean.md`](components/130-engine-clean.md) | Clean target: timeline→scene tiering, game loop, rewrite contract, clean runtime | clean-engine authors, porters |

## Conventions used in every document

### Requirement keywords

The words **MUST**, **MUST NOT**, **REQUIRED**, **SHOULD**, **SHOULD NOT**, **MAY**, and
**OPTIONAL** are used as defined in RFC 2119 and RFC 8174, in their uppercase forms only.
A requirement that is not uppercase is explanatory prose, not normative.

Numbered requirements are stable identifiers: `CMP-R014`, `GFX-R102`. Requirements are never
renumbered; withdrawn requirements are marked `[WITHDRAWN]` with a pointer to their replacement.

### Fidelity levels

Because Flash Player is the reference implementation for behaviour that is frequently undefined,
every behavioural requirement is tagged with one of four fidelity levels:

| Level | Name | Meaning | Verification |
| --- | --- | --- | --- |
| **F1** | Bit-exact | Byte/bit identical outcome required | exact comparison |
| **F2** | Numerically exact | Same IEEE-754 result or same integer result | exact comparison on numbers |
| **F3** | Tolerant | Visually/audibly indistinguishable within a stated tolerance | image SSIM/ΔE, audio null tests |
| **F4** | Approximate | Comparable behaviour, documented divergence | documented + reviewed |

Examples: string→number coercion is **F2**; a Gaussian blur filter is **F3** with a stated
tolerance; a device-font substitution for a missing proprietary font is **F4**.

### Decision register

Each document ends with a **Decision register**: a table of unresolved or historically
Flash-specific behaviours, each with an ID, the current default chosen by this spec, how it is
verified, and who owns it. Decision IDs look like `GFX-D04`. A decision register entry is a
*commitment to measure*, not an excuse to guess: implementations MUST cite the decision ID in
code comments where the behaviour is realised.

Rationale: a large fraction of Flash behaviour is under-specified. Encoding these as tracked
decisions prevents silent divergence and prevents endless re-litigation.

### Verification IDs

Tests are named `T-<DOC>-<nnn>`, e.g. `T-GFX-015`. The TST document defines how each taxonomy of
test is executed, and how test IDs map to fixtures.

### Cross-references

References use `DOC-§n` form, e.g. `GFX-§6.3` or `AUD-§4.1`. Where the SWF specification itself is
the authority, we cite section names from *SWF File Format Specification, Version 19* and note the
citation is to the upstream document, not a reproduction of it.

## Status of this set

All documents are drafts, written before implementation. They are expected to change as conformance
measurements replace assumptions; the Decision registers are the primary mechanism for that revision.
Documents start at Draft 1.0 and are revised through the SWF-specification chapter passes. After the
Ch.1–Ch.15 intake, the Appendix pass and the tech-spec pass (2026-10-04): `000` 1.1, `010` 1.1,
`020` 1.1, `030` 1.2, `040` 1.3, `050` 1.2, `060` 1.2, `070` 1.3, `080` 1.1, `090` 1.2, `100` 1.1,
`110` 1.7, and the new `120`/`130` at 1.0 — every section of the upstream v19 document (Ch.1–15 and
Appendices A–C) is now encoded, and the two new documents open the `INS`/`CLN` areas. Reorganised into the folders above on 2026-10-04 (ids unchanged; every path reference rewritten and
machine-checked by `tools/verify_docs.py`). Documents are versioned with the repository; a change to
a numbered requirement MUST be accompanied by a changelog entry at the bottom of the affected document,
and — where the change is forced by the upstream specification — a cross-reference to the errata entry
in `docs/impl/registers/errata.md` that records it.

## What is deliberately *not* specified here

- Tooling choices that do not affect output bytes (editor, formatter settings beyond REPO's rules).
- Business/hosting concerns (CDN choice, analytics vendors, monetisation).
- AVM2/AS3 support. Where AVM2 appears it is only as a *detection* and *reporting* concern.
- Any reproduction of Adobe's or other parties' specification text. See SEC-§7.
