# AGENTS.md — how to build this project from these specifications

This repository is **specification-first**. The product it describes is `swf-forge`: a set of tools
that turn AS1/AS2 (AVM1) Flash games (SWF) into clean, modern, structured TypeScript that runs on
WebGL2 and Web Audio. Implementation happens *after* the specs, and every implementation change is
expected to keep the specs true.

If you are an AI agent (or an engineer) starting a work session, read this file, then
[`docs/README.md`](docs/README.md) (the document map), then
[`docs/impl/000-roadmap.md`](docs/impl/000-roadmap.md) (the build order).

---

## 1. What the product is

Five components, one per app in `apps/` (structure: [`docs/TECH-SPEC.md`](docs/TECH-SPEC.md) §2–§3):

| Component | Job | Design spec | Implementation spec |
| --- | --- | --- | --- |
| `decompiler` | SWF → project files + decoded model + diagnostics | `docs/specs/format/030-swf-format-and-io.md` | `docs/impl/decompiler/` (030, 040, 060–110) |
| `transpiler` | ActionScript/AVM1 → TypeScript (faithful) | `docs/specs/language/040-avm1-to-typescript.md`, `docs/specs/foundation/020-compiler-pipeline.md` | `docs/impl/transpiler/` (050, 120) |
| `code-inspector` | IDE-like inspection: file explorer, SWF↔TS navigation, syntax highlighting, run view | `docs/specs/components/120-code-inspector.md` | `docs/impl/code-inspector/150-code-inspector.md` |
| `engine-flash` | Runtime/executor for the transpiled TypeScript (faithful, timeline-preserving) | `docs/specs/web/080-runtime-shell.md`, `docs/specs/web/050-graphics-webgl.md`, `docs/specs/web/060-audio-web.md` | `docs/impl/engine-flash/130-runtime-and-renderer.md` |
| `engine-clean` | Better heuristics/tooling → clean modern structured code: no MovieClip/Timeline, real game loop | `docs/specs/components/130-engine-clean.md` | `docs/impl/engine-clean/160-engine-clean.md` |

Shared packages, the CLI surface, the file contracts (`forge.project.json`, the generated clean tree)
and the toolchain are all specified in [`docs/TECH-SPEC.md`](docs/TECH-SPEC.md).

## 2. Where everything lives

```
README.md                     project overview (human-facing)
AGENTS.md                     this file: the agent/engineer operating manual
docs/
  README.md                   document map: every document, folder by folder
  TECH-SPEC.md                structure, rules, toolset, abilities, interfaces (build blueprint)
  specs/                      WHAT to build — behaviour, RFC 2119, fidelity levels F1–F4
    foundation/   000 architecture · 010 repo+toolchain · 020 compiler pipeline
    format/       030 SWF format and I/O
    language/     040 AVM1 → TypeScript
    web/          050 graphics · 060 audio · 070 assets/fonts/bitmaps/video · 080 runtime shell
    quality/      090 conformance testing · 100 security and licensing
    components/   120 code-inspector · 130 engine-clean
    reference/    110 appendices and reference tables (tags, opcodes, codecs)
  impl/                       HOW and IN WHAT ORDER to build — work packages, algorithms, tests
    000-roadmap.md            phases P0–P13, milestones, the work-package index (start here)
    foundation/   010 binary I/O · 020 container/tag stream/dictionary
    decompiler/   030 display list · 040 control tags · 060 shapes · 070 images/morphs
                  080 fonts/text · 090 sounds · 100 buttons · 110 video
    transpiler/   050 actions/AVM1 · 120 compiler and emitter
    engine-flash/ 130 runtime and renderer
    code-inspector/ 150    engine-clean/ 160    harness/ 140 conformance harness
    registers/    errata.md (E-001…) · STATUS.md (generated)
tools/
  verify_docs.py              repository-wide consistency checks (run before every commit)
  gen_status.py               regenerates docs/impl/registers/STATUS.md
```

**Document references.** `specs/030` and `impl/060` are *document ids* (the number is the identity),
not filesystem paths — resolve them through the tables in [`docs/README.md`](docs/README.md).
Requirement ids are `GFX-R081`, `CMP-R014`, …; decisions are `GFX-D16`; diagnostics are `SF0123`;
tests are `T-MOD-123`; work packages are `WP-060-02`.

## 3. How to work (the loop)

1. **Pick work from the roadmap.** `docs/impl/000-roadmap.md` §3 lists the phases; its work-package
   index gives the per-document totals. Dependencies are stated per work package in each document's
   §Work packages table — do the upstream work package first.
2. **Read the owning implementation document** for the work package, then the design spec sections it
   cites ("Design specs" column of the document map) and, where the document cites it, the upstream
   SWF File Format Specification v19 chapter. The implementation documents never restate all byte
   layouts: they state parse order, data structures, edge cases and tests.
3. **Implement** in the packages/apps named by the document. Byte-level behaviour comes from the
   format spec; product behaviour comes from `docs/specs`; structure comes from `docs/TECH-SPEC.md`.
4. **Test** with the test ids the document declares (`T-*` tables). A work package is done when its
   tests exist and pass and its "Done when" line holds.
5. **Register what you found.** New diagnostic codes go in the document's §Diagnostics table *and*
   in the range allocation table of `docs/impl/foundation/010-binary-io-and-records.md` §7. Any
   divergence discovered in the upstream spec or in our documents is recorded in
   `docs/impl/registers/errata.md` with the test that encodes the resolution.
6. **Update the documents in the same change** (rule `TECH-R028`): the owning implementation doc, its
   changelog row, `docs/impl/README.md` if the status changed, and — if a new package, app or file
   appears — `docs/TECH-SPEC.md` §3. Then run the tools below.

```bash
python3 tools/gen_status.py      # regenerate the coverage snapshot after work-package edits
python3 tools/verify_docs.py     # must print: ISSUES: 0
```

## 4. Non-negotiables (they are checkable)

- No player mode, no AVM2: `ARCH-R001`; AVM2 content is a hard error (`SF1000`, exit 3).
- Emitted code MUST NOT contain `eval`/`Function`, `with`, `Proxy`, plain-object stand-ins for AVM1
  objects, global current-target state, promise/microtask delivery of host completions, timestamps,
  absolute paths or `Math.random` (`IMPL-120-R016`; `CMP-R021`; `AVM1-R030`; `SEC-R0xx`).
- The clean engine produces **structured** code: no MovieClip class, no Timeline machinery, an
  explicit fixed-step game loop (`specs/130` §4, `CLN-R001`–`CLN-R022`); when a movie cannot be
  cleaned within its deviation budget, `forge-clean` **refuses** (exit 6) rather than emit lies.
- Determinism: identical inputs ⇒ identical bytes; no wall-clock, no absolute paths, no unseeded
  randomness anywhere in build output (`CMP-R030`, `REPO-R0xx`).
- Fidelity levels F1–F4 are stated per requirement; do not silently downgrade one.
- Third-party code (Ruffle, FFmpeg, …) is **corroboration only**, never normative, and never copied:
  clean-room rules in `specs/100`; citations, not reproductions (the format spec is not redistributed
  here — chapter numbers and section names only).

## 5. First slice (when starting the build)

`docs/TECH-SPEC.md` §9 defines the vertical slice: workspace + toolchain, then the decompiler's
foundation path — header, `RECT`, tag stream, `ShowFrame`/`End` — proved against the Appendix A
golden fixture (`docs/impl/harness/140-conformance-harness.md` §2.1, 79 bytes, byte-exact), then
shapes (060) so the first SWF renders. Work packages: `WP-010-01…`, `WP-020-01…`, `WP-060-01…`,
`WP-140-01…` — see the roadmap for the exact dependency order.

## 6. Conventions cheat-sheet

| Thing | Form | Owner |
| --- | --- | --- |
| Requirement | `<DOC>-Rnnn` (e.g. `GFX-R081`), never renumbered | design specs (`docs/specs`) |
| Implementation rule | `IMPL-0nn-Rnnn` | impl docs (`docs/impl`) |
| Decision | `<DOC>-Dnn`, indexed in `specs/110` §12 (`APP-R005` counts them) | design specs |
| Diagnostic | `SFnnnn`, one owner per range, allocated in `impl/010` §7 | impl docs |
| Test id | `T-<AREA>-nnn`, banded per document (`E-023`) | impl docs (`1xx`+ bands) |
| Work package | `WP-0nn-nn` with deps, estimate, modules, tests, done-when | impl docs |
| Erratum | `E-nnn` in `docs/impl/registers/errata.md` | anyone who finds a divergence |
| Status header | `**Doc ID:** X · **Status:** ✅ … · Draft N.M` + changelog row at EOF | every doc |
