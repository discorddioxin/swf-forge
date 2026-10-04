# Implementation specifications

`docs/specs/` defines **what the system must do**. `docs/impl/` defines **how we build it**: module
boundaries, TypeScript APIs, algorithms, task breakdowns, test vectors, and the order of work.

This directory is the execution plan for the project. Every document here is written to be handed to
an engineer (or an agent) as a work order.

---

## 1. How these documents relate to the other two authorities

| Authority | Answers | Location |
| --- | --- | --- |
| **SWF File Format Specification v19** ("the format spec") | What the bytes mean | Upstream document; chapters referenced by number/section |
| **Tech spec** | How the parts fit: the five components, repo/file layout, toolchain, cross-component rules | This repo, [docs/TECH-SPEC.md](../TECH-SPEC.md) |
| **Design specs** (`docs/specs/`) | What the product must do, at which fidelity | This repo, `docs/specs/` |
| **Implementation specs** (this directory) | How we build it, in what order | This repo, `docs/impl/` |

Rules of engagement:

1. **The format spec is authoritative for byte layout.** Where our design specs assert something the
   format spec contradicts, the format spec wins and the design spec gets a correction (REPO-R019).
2. **The design specs are authoritative for behaviour.** The format spec says nothing about, e.g.,
   TypeScript emission or mixers; those are ours.
3. **These documents never restate byte layouts in full.** They give the parse order, the data
   structure it lands in, the edge cases that bite, and the tests that prove it. The field tables stay
   upstream (also per SEC-§7: we cite, we do not reproduce).
4. **Every task has an ID** (`WP-<doc>-<nn>`), dependencies, an estimate, and a definition of done.
5. **The tech spec owns structure.** Where a document here needs a new package, app, or top-level
   directory, `TECH-SPEC.md` §3 is updated in the same change (`TECH-R028`).

## 2. Document map

Documents are grouped by the component that owns the work (`foundation/`, `decompiler/`, `transpiler/`,
`engine-flash/`, `code-inspector/`, `engine-clean/`, `harness/`), with the roadmap at the top and the
registers (`errata.md`, generated `STATUS.md`) in `registers/`. **Document numbers are the identity** —
`impl/060` stays `impl/060` whatever folder it lives in; citations use the number, and the tables below
are the id→path map.

| Doc | Covers | Format-spec chapters | Design specs | Status |
| --- | --- | --- | --- | --- |
| [000-roadmap.md](000-roadmap.md) | Phases, milestones, critical path, staffing, risk order | all | all | ✅ |
| [`foundation/010-binary-io-and-records.md`](foundation/010-binary-io-and-records.md) | Byte/bit readers, all primitive records | Ch.1 | SWF-§4 | ✅ grounded |
| [`foundation/020-container-tag-stream-dictionary.md`](foundation/020-container-tag-stream-dictionary.md) | Header, compression, tag stream, dictionary, ordering, processing | Ch.2 | SWF-§3, CMP-§4 | ✅ grounded (2 sections pending) |
| [`decompiler/030-display-list-and-sprites.md`](decompiler/030-display-list-and-sprites.md) | Display list, PlaceObject/2/3, filters metadata, clip events, sprites | Ch.3, Ch.13 | GFX-§3, AVM1-§3 | ✅ grounded in Ch.3 + Ch.13 |
| [`decompiler/040-control-tags-and-metadata.md`](decompiler/040-control-tags-and-metadata.md) | Control tags, exports, scaling grid, scenes, binary data, telemetry | Ch.4, Ch.15 | CMP-§4, AST-§6 | ✅ grounded in Ch.4 + Ch.15 |
| [`transpiler/050-actions-and-avm1.md`](transpiler/050-actions-and-avm1.md) | Action decoding, IR, tiering, semantics hosts | Ch.5 | AVM1 (whole) | ✅ grounded in Ch.5 |
| [`decompiler/060-shapes-and-gradients.md`](decompiler/060-shapes-and-gradients.md) | Shape records, fill/line styles, gradients | Ch.6, Ch.7 | GFX-§5, GFX-§6 | ✅ grounded in Ch.6 + Ch.7 |
| [`decompiler/070-images-and-morphs.md`](decompiler/070-images-and-morphs.md) | JPEG/lossless bitmaps, morph shapes | Ch.8, Ch.9 | AST-§3, GFX-§5.5 | ✅ grounded in Ch.8 + Ch.9 |
| [`decompiler/080-fonts-and-text.md`](decompiler/080-fonts-and-text.md) | Fonts, glyphs, EM square, static/dynamic text | Ch.10 | AST-§4, GFX-§9 | ✅ grounded in Ch.10 |
| [`decompiler/090-sounds.md`](decompiler/090-sounds.md) | Event/stream sounds, ADPCM, MP3, Nellymoser, Speex | Ch.11 | AUD (whole) | ✅ grounded in Ch.11 |
| [`decompiler/100-buttons.md`](decompiler/100-buttons.md) | Button records, states, transitions, button sounds | Ch.12 | AVM1-§10, AUD-§6.1 | ✅ grounded in Ch.12 |
| [`decompiler/110-video.md`](decompiler/110-video.md) | Video codecs, stream tags, frame tables | Ch.14 | AST-§5, RT-§5 | ✅ grounded in Ch.14 |
| [`transpiler/120-compiler-and-emitter.md`](transpiler/120-compiler-and-emitter.md) | Pipeline wiring, IR→TS emission, CLI, reports, verify | — | CMP, REPO, AST | ✅ ready |
| [`engine-flash/130-runtime-and-renderer.md`](engine-flash/130-runtime-and-renderer.md) | Shell, AVM1 runtime, WebGL2 renderer, audio engine | — | RT, GFX, AUD, AVM1 | ✅ ready |
| [`harness/140-conformance-harness.md`](harness/140-conformance-harness.md) | Synthetic SWF writer, oracle harness, goldens, perf gates | App. A–C | TST, SEC | ✅ ready |
| [`code-inspector/150-code-inspector.md`](code-inspector/150-code-inspector.md) | Project model, worker indexer, navigation, panels, run view | — | INS, CMP-§7, RT-§10 | ✅ ready |
| [`engine-clean/160-engine-clean.md`](engine-clean/160-engine-clean.md) | Clean transforms, tiering, rewrite log, clean runtime | — | CLN, AVM1-§6/§9, CMP | ✅ ready |

### Meta documents

| Doc | What it is |
| --- | --- |
| [errata.md](registers/errata.md) | Every divergence found between the upstream format spec and our documents (or between our documents), with the resolution and the test that encodes it (`E-001`…). Upstream *examples* that contradict upstream *fields* are recorded here, not silently followed. |
| [STATUS.md](registers/STATUS.md) | Generated coverage snapshot: per-document state, diagnostics and test registries, chapter/appendix coverage, WP totals. Regenerated by `tools/impl-status` (WP-140-08); never hand-edited. |

**Status legend**

| Mark | Meaning |
| --- | --- |
| ✅ grounded | Written against the upstream chapter text, or independent of it |
| ✅ written | Complete and reviewable from the design specs alone (the chapter-independent documents 120–140) |
| ⏳ partial | Work packages, modules, APIs, and tests are specified; **byte-level details are marked as open items** to be reconciled when the chapter text is supplied. Every such item appears in the document's §Open items table. |
| ⛔ blocked | Cannot proceed without the chapter |

Nothing here is blocked; the partial documents are deliberately structured so that implementation
work that does not depend on the un-reconciled details (module scaffolding, interfaces, tests,
fixtures) can start immediately.

## 3. Conventions used in these documents

### Requirement and task IDs

| Prefix | Meaning | Example |
| --- | --- | --- |
| `WP-<doc>-<nn>` | Work package (a shippable, testable unit) | `WP-060-03` |
| `T-...` | Test, as defined in the design specs (TST-§2) | `T-SWF-005` |
| `SF####` | Diagnostic code, per CMP-§9.3 | `SF0010` |
| `<DOC>-R###` / `<DOC>-D##` | Design requirement / decision register entry | `SWF-R021`, `GFX-D01` |

### Work package table format

Every implementation document ends its task section with a table in exactly this shape so the roadmap
index can be generated mechanically:

```
| WP | Title | Depends | Est | Deliverable |
| --- | --- | --- | --- | --- |
| WP-060-01 | `DefineShape*` headers + bounds + version dispatch | WP-010-09, WP-020-05 | 2 | `define-shape.ts`, T-MOD-118 |
```

`Est` is in **developer-days** for a single engineer familiar with the codebase, and covers
implementation + unit tests + documentation of the unit. Integration, conformance, and perf work is
estimated separately in the roadmap.

### Definition of done (applies to every work package)

A work package is done when **all** of the following hold:

1. The public API is documented in code and matches this spec (or the spec is corrected in the same PR).
2. Unit tests cover the happy path, all edge cases listed in the document, and each error path.
3. No `any`, no suppressions (REPO-R009, REPO-R011).
4. Diagnostics use the assigned `SF` codes with scope information populated.
5. Determinism holds: running the unit twice in the same process and in two processes yields identical
   output (REPO-R015).
6. The relevant design-spec requirement IDs are referenced from the test names.

## 4. Status tracking

`docs/impl/registers/STATUS.md` (generated, not hand-edited) records, per work package: owner, state
(`todo`/`doing`/`done`/`blocked`), PR link, and the date of the last state change. The generator is
`tools/impl-status` (bootstrap today: `python3 tools/gen_status.py`, which writes
[`registers/STATUS.md`](registers/STATUS.md)) and it reads the work-package tables from these documents plus the merged PR list
from `gh`. This keeps planning and reality in one place without a project-management tool.

## 5. Reading order

- **Planning or reviewing:** `000-roadmap.md` only.
- **Starting work:** the roadmap for sequencing, then your area's document end-to-end before writing code.
- **Reconciling a newly supplied chapter:** the matching document's §Open items table, top-down.

## 6. Change management

**IMPL-R001** When an upstream chapter is supplied, the affected implementation document MUST be
updated in the same PR that consumes it, and the §Open items rows it resolves MUST be struck through
with the resolving commit referenced.

**IMPL-R002** A work package MUST NOT be marked done while any byte-level detail it depends on is still
in an §Open items table. "It seemed to work on our fixtures" is not reconciliation.

**IMPL-R003** Estimates are planning placeholders: they MUST be corrected in place when a package is
completed, so the roadmap's remaining-effort numbers stay honest.

## 7. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Set created with chapters 1–2 grounded; chapters 3–15 scoped |
| 1.1 | 2026-10-04 | Chapter passes 3–6 folded in: 030/040 verified, 050/060 rewritten against Ch.5/Ch.6; document-map statuses updated; `WP-060-01` example refreshed |
| 1.2 | 2026-10-04 | Chapter pass 7–9 folded in: 060 re-derived against Ch.7 (gradient structures, `SF0192`–`SF0195`, WPs now 14/42) and 070 rewritten against Ch.8/Ch.9 (all seven bitmap tags, morph model, `SF0250`–`SF0269`, WPs now 14/47); document-map statuses updated; totals regenerated |
| 1.3 | 2026-10-04 | Chapter pass 10–11 folded in: 080 rewritten against Ch.10 (glyph-space/EM model, all font and text tags, `SF0270`–`SF0289`, WPs now 13/41) and 090 rewritten against Ch.11 (codec table, ADPCM packet framing, MP3/stream rules, `SF0330`–`SF0332`, WPs now 12/36); `T-AUD` obligations moved to the `1xx` band; 100/110 remain partial |
| 1.4 | 2026-10-04 | Chapter pass 12–15 folded in — the final chapter batch: 100 rewritten against Ch.12 (buttons, 10/26), 110 against Ch.14 (video, 11/34), 030 gains the Ch.13 sprite model (12/30) and 040 the Ch.15 tag bodies (14/24); document-map statuses updated; totals 181 WPs / ≈551 d |
| 1.5 | 2026-10-04 | Appendix pass: Appendix A's worked example is now a committed golden fixture (`140` §2.1, `T-TST-101`/`102`) with per-doc assertions (`T-SWF-022`/`023`, `T-MOD-123`, `T-MOD-604`), Appendix B is machine-checked against `specs/110` §2 (`T-TST-103`, `E-026`) and Appendix C against `IMPL-110` §6 (`T-TST-104`); every upstream section is now encoded |
| 1.6 | 2026-10-04 | Tech-spec pass: the five components are mapped to `apps/` + `packages/` (`TECH-SPEC.md`); document map gains 150 (code-inspector) and 160 (clean engine); the tech spec is named as the structural authority |
| 1.7 | 2026-10-04 | Meta-document section added (errata + generated `STATUS.md` named with their update rules); rule-id hygiene: `IMPL-030-R007` and `IMPL-120-R015` defined where they were cited-but-missing, `IMPL-060-R046`–`R052` split off the duplicated shape/line-style block, and `IMPL-040`'s Ch.15 rules logged |
| 1.8 | 2026-10-04 | Folder reorganisation: documents grouped by owning component (`foundation/`, `decompiler/`, `transpiler/`, `engine-flash/`, `code-inspector/`, `engine-clean/`, `harness/`), registers moved to `registers/`; ids unchanged, every path reference rewritten and checked by `tools/verify_docs.py`; bootstrap tooling recorded (`tools/verify_docs.py`, `tools/gen_status.py`) |
