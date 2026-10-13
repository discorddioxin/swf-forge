# P2 Repeat Integrity Audit

**Date:** 2026-10-05 · **Branch:** `arena/01a10cd9-swf-forge` · **Auditor:** agent
**Baseline:** [`P2-INTEGRITY-AUDIT.md`](P2-INTEGRITY-AUDIT.md) — 15 findings
**Resolution plan:** [`P2-RESOLUTION-AUDIT.md`](P2-RESOLUTION-AUDIT.md)
**Purpose:** re-run the P2 evidence adversarially after implementation; confirm each finding's specific
flip, re-check the roadmap exit criteria, and record residuals rather than counting runtime/P5 work as
finished P2 model work.

The original integrity audit header records its historical branch as `arena/01a10928-swf-forge`; its
15-item ledger is preserved as the baseline. This repeat audit and its resolution execution evidence
were checked on the session branch `arena/01a10cd9-swf-forge`.

## 0. Verdict

**All 15 P2 findings are resolved for the P2 model/tooling acceptance scope.** All four roadmap §6 P2
exit criteria pass, all 18 formerly-dead P2 diagnostics now have source and test references, the
`SF0156` doc error is absent from its owning specification and registry, and the final gates are green.
No P2-owned finding remains open.

The resolution and audit artifacts are in the repository's `audits/` directory:

- `audits/P2-INTEGRITY-AUDIT.md` — original P2 issue ledger.
- `audits/P2-RESOLUTION-AUDIT.md` — resolution plan based on that ledger, now with execution records.
- `audits/P2-REPEAT-AUDIT.md` — this verification pass.

**Scope boundary:** this verdict does not claim the later runtime, renderer, emitter, or AVM1 work is
complete. In particular, IMPL-100's pointer/event execution and exact shape hit testing remain open for
docs 120/130; the P5 `SetTarget`/interpreter-budget items are called out in §5.

---

## 1. Findings ledger — re-run

| Finding | Repeat evidence | Status |
| --- | --- | --- |
| **P2-01 (H)** — buttons absent | `packages/swf/src/tags/buttons.ts` decodes v1/v2 records, condition chains, v1 actions, cxforms and button sounds; `model/buttons.ts`/`model/movie.ts` build button records, transitions and hit-area bounds. `buttons.test.ts` has all `T-MOD-801`–`817` labels, including the 9 condition bits, key-code corpus, malformed chain and each `SF0130`–`SF0138` path. `analyzeMovie` now emits one `kind: 'button'` AVM1 block per raw button action range; v1/v2 offset/grouping regressions are in `packages/avm1/test/movie.test.ts`. | **RESOLVED — P2 model + block discovery.** Runtime interaction remains out of P2 scope (§5). |
| **P2-02 (H)** — no tag-coverage report | `python3 tools/tag_coverage.py` exits 0 and reports 65 registered tags: 32 decoded, 25 pending a later owning doc, 5 retained for another stage and 3 structural. Every row has a disposition and evidence reference. CI runs `pnpm tag:coverage`; the tool's 10 unit tests pass. | **RESOLVED.** |
| **P2-03 (M)** — clip actions opaque | `tags/clip-actions.ts` decodes 2/4-byte `CLIPEVENTFLAGS`, versioned/reserved bits, the `CLIPACTIONS` record envelope, key code, bounded `ActionRecordSize`, and the End marker while preserving the raw range. `clip-actions.test.ts` (4 tests, `T-MOD-007/008`) exercises both widths, mismatch, reserved/empty flags and `SF0125` target validation. `SF0115`, `SF0118`, `SF0119`, `SF0125` each have a production emitter and test. | **RESOLVED.** |
| **P2-04 (M)** — imports cannot resolve across movies | `buildMovieModel` accepts an explicit URL→`SwfFile` input map; `dump --import <url>=<file.swf>` is repeatable. `imports.test.ts` covers resolved aliases without payload copying, unresolved placeholders/`SF0150`, transitive aliases, cycles/`SF0155`, and SWF 8+ deprecation (`T-MOD-017/018/026`); CLI provenance is asserted in `dump.test.ts`. | **RESOLVED.** |
| **P2-05 (M)** — PO3 misses depth/clip-depth diagnostics | `decodePlaceObject3` now mirrors the PO2 `SF0112`/`SF0113` checks. `T-MOD-004` writer cases cover PO2/PO3 boundaries, legal controls, plus the form-agnostic PO1 depth check. | **RESOLVED.** |
| **P2-06 (M)** — test process exits 1 from unhandled decompression teardown | `container/open.ts` observes writer `write`/`close` teardown rejections and guards reader cancellation. Re-running the full Vitest command produces no unhandled-rejection output and exits 0: **295/295 tests, 29 files**. The annotation in `P1-REPEAT-AUDIT.md` §3 corrects the historical gate record without rewriting its test count. | **RESOLVED.** |
| **P2-07 (L)** — unknown export IDs silent | `buildMovieModel` emits `SF0174` and adds a `missing` placeholder for unknown `ExportAssets`/`SymbolClass` IDs. `T-MOD-016` asserts the diagnostic and placeholder; a second `T-MOD-016` fixture covers duplicate id/name policies. | **RESOLVED.** |
| **P2-08 (L)** — scene data inside sprites dropped | `assembleTimeline` records a sprite-local `implicitScene`, uses the first scene name (or empty name), and emits `SF0169`; the main timeline still normalizes scene data once. Both paths have `T-MOD-015` tests. | **RESOLVED.** |
| **P2-09 (L)** — trailing frame label dangles | A trailing `FrameLabel` now creates an empty labelled frame instead of retroactively renaming an earlier frame. `T-MOD-014` covers the trailing label and mid-timeline next-`ShowFrame` association. | **RESOLVED.** |
| **P2-10 (L)** — repeated scaling grid silently overwrites | Last rect still wins; the displaced rect is appended to `MovieControlModel.scalingGridsShadowed` and serialized in the dump. `T-MOD-020` asserts both values. | **RESOLVED.** |
| **P2-11 (L)** — named-anchor byte semantics wrong | Any byte after the null terminator means anchored; non-1 values remain anchored and emit `SF0165`. Four `T-MOD-014` cases cover byte 1, byte 0, another non-1 byte and absent byte. | **RESOLVED.** |
| **P2-12 (L)** — binary bytes discarded / `SF0179` dead | `CharacterModel.bytes` carries exact `DefineBinaryData` payload bytes; JSON carries length/digest/presence, not payload bytes. AVM1 `SymbolClass` naming a binary character emits `SF0179`. `T-MOD-036` checks byte equality and the diagnostic. | **RESOLVED.** |
| **P2-13 (I)** — surface API differs from IMPL-030 | IMPL-030 §3/changelog now documents `tagOffset`, raw numeric `blendMode`, the complete `ClipActions`/`ClipEventFlags` fields and byte ranges. The structural `clipActions` mismatch is fixed in the type itself; remaining deviations are documented rather than churned. | **RESOLVED.** |
| **P2-14 (I)** — unlabeled obligations/corpora/strict mode | PO1, PO2/PO3 flag corpora, clip-depth, HasVisible-only, dump JSON round-trip and sound-span tests are labeled; `--strict-timeline` now reports `SF0127`; test-label coverage improved to IMPL-030 **15/16**, IMPL-040 **27/28**, IMPL-100 **17/17**. The three absent cross-phase labels (`T-MOD-602`, `T-MOD-030`, and `T-MOD-019`'s interpreter-enforcement half) are explicitly assigned to P5/runtime, not represented as closed behavior. | **RESOLVED for P2-owned scope; residual cross-phase work is listed in §5.** |
| **P2-15 (I)** — doc/roadmap inconsistencies | IMPL-040 no longer defines the unregistered duplicate `SF0156`; roadmap P2 rows show button-model and tag-coverage evidence, and the demo references the implemented `dump` verb rather than nonexistent `inspect --timeline`/`verify`. `gen_status.py` + `verify_docs.py` report zero issues. | **RESOLVED.** |

---

## 2. Roadmap P2 exit criteria — re-run

| Criterion | Evidence | Result |
| --- | --- | --- |
| Ordered `PlaceObject`/`PlaceObject2`/`PlaceObject3` operations per frame | Timeline model and dump fixtures; all 256 PO2 flag values and all 65,536 PO3 flag-byte pairs consume exactly their generated bodies; P2/PO3 depth checks pinned by `T-MOD-004`. | **PASS** |
| Sprite tree, labels, scenes and exports resolved | Sprite padding/End tests, in-sprite scene test, trailing/mid-frame labels, export collision/unknown-id policies, root class and imports. | **PASS** |
| Buttons decoded into records and conditions | `buttons.test.ts` covers `T-MOD-801`–`817`; AVM1 front end exposes each action range as a button block. | **PASS — model-level criterion.** |
| Every registered AVM1-era tag dispositioned | `tools/tag_coverage.py`: 65/65 rows dispositioned; CI step present. Later-doc tags are explicitly `pending:<doc>`, not unclassified. | **PASS** |

---

## 3. P2 diagnostic sweep — re-run

The original integrity audit's 18 P2-range dead-code findings were swept against source and test trees.
All 18 now have both a production source reference and test reference: `SF0115`, `SF0118`, `SF0119`,
`SF0125`, `SF0127`, `SF0130`–`SF0138`, `SF0150`, `SF0155`, `SF0174`, `SF0179`. **No P2-scoped dead
code remains.** `SF0111` stays excluded as renderer-owned work. `SF0156` is absent from the registry and
IMPL-040 §6; references remain only in historical audit/resolution notes describing its removal.

---

## 4. Gate — re-run (2026-10-05)

| Check | Result |
| --- | --- |
| `corepack pnpm typecheck` (package + test configs) | **PASS** |
| `corepack pnpm lint` (ESLint + Prettier) | **PASS** |
| `corepack pnpm test` | **295/295 tests, 29 files; process exit 0** |
| `corepack pnpm -r --filter './apps/**' build` | **PASS** |
| `corepack pnpm test:audit` | **17/17 Python tests** |
| `python3 tools/tag_coverage.py` | **PASS**, 65/65 dispositions; CI wired |
| `python3 -m unittest discover -s tools -p 'test_tag_coverage.py'` | **10/10 tests** |
| `python3 tools/audit_dev.py` | **findings=57 known=57 new=0 fixed=0**; shape4 probe 5/5; dump synth clean and dirty probes pass |
| `corepack pnpm spec:status && corepack pnpm spec:verify` | **PASS**, zero doc issues |

`audits/dev/baseline.json` was re-recorded at 57 keys after the P2-owned diagnostic and dump-schema
changes; the normal audit run immediately after reports zero new findings.

---

## 5. Residual gaps — explicit, not P2 findings

1. **IMPL-100 runtime:** the P2 model computes transformed axis-aligned bounds, not exact vector hit
   contours. Pointer transitions, nested-button event bubbling, focus/composite-key input, generated
   handler symbols/`ButtonRuntimeSpec`, and player-interaction goldens remain docs 120/130 work.
2. **P5 cross-phase tests:** `T-MOD-019` currently proves `ScriptLimits` is stored but not that it changes
   an interpreter budget; `T-MOD-030` shell/emitted-bundle anchor navigation and `T-MOD-602` nested
   `SetTarget` path grammar are not implemented/tested in this P2 pass.
3. **Writer/verification:** `T-MOD-012` proves the model dump JSON parses and re-serializes byte-identically;
   it does not re-encode the SWF or prove full frame reconstruction. The writer/`verify` harness remains
   doc 140 work. Clip-action tests prove bounded framing and retain original action ranges, not a new
   SWF encoder round-trip.
4. **Scaling-grid runtime:** parser/model validation and shadow reporting are covered. Rotation/skew and
   below-original-size 9-slice reversion require renderer tests (IMPL-040-R029) and are not claimed here.

These limits do not reopen any of the 15 P2 findings or the four P2 roadmap exit criteria. The unresolved
doc/test rows remain owner-aligned with P5/runtime/renderer/harness stages.

---

## 6. Disposition

**P2 model/tooling findings are closed on `arena/01a10cd9-swf-forge`.** The source changes, tests, tool,
roadmap/spec updates and gate evidence all pass on this checkout. The two source audit artifacts are
`audits/P2-INTEGRITY-AUDIT.md` and `audits/P2-RESOLUTION-AUDIT.md`; this file is the repeat verification
requested after their implementation pass.

## 7. Current-tree revalidation — 2026-10-05

Current shared gates pass: `corepack pnpm test` (43 files / 382 tests), `typecheck`, `lint`, `build`,
`spec:verify`, tag coverage, and 19 Python audit tests. `audit:dev` reports **0 new findings**; the
remaining 12 unmapped AVM1-range codes are baseline-known and outside the P2 resolution ledger, while
newly visible P3 diagnostics have explicit open-WP owners. No P2-scoped regression was found. These
updated repository-wide results supersede the older 295-test count in §4; that count remains the
historical run recorded at the time of the original repeat audit.
