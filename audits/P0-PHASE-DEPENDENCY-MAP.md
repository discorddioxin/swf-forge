# P0 phase dependency map — does Foundations need data from undeveloped phases?

- **Date:** 2026-10-13
- **Branch:** `arena/11541273-swf-forge`
- **Question asked:** map the dependencies between roadmap phases, and determine whether **P0 (Foundations)** — which is `In progress` and bottlenecked — requires information or data produced by **undeveloped phases such as P6 (Emitter)**.
- **Scope:** `docs/impl/000-roadmap.md` §§2, 4, 6; `docs/impl/foundation/010-binary-io-and-records.md` §§8–11; `docs/impl/harness/140-conformance-harness.md`; `docs/specs/{format/030, foundation/010, quality/090}`; `audits/P0-AUDIT.md`, `audits/P0-AUDIT-RESOLUTION.md`, `audits/P3-AUDIT-RESOLUTION.md`, `audits/P3-C7-AUDIT.md`, `audits/P4-P5-BOTTLENECK-INVESTIGATION.md`; the whole `docs/impl` work-package graph; and the current test/tooling/CI configuration.
- **Method:** read-only. The work-package dependency graph was extracted mechanically from all 16 implementation documents (211 WP rows, every `Depends` cell) rather than read from the roadmap's prose diagram — see Appendix B for the exact reproduction commands. Test-id ownership was cross-checked against `docs/impl/registers/STATUS.md` §3 and the test tree. No code, test, spec, or audit record was modified.
- **Evidence limitation (superseded):** §1–§9 were written read-only, with `node_modules` absent, so no suite had been executed and gate claims were quoted from roadmap §2's 2026-10-11 snapshot. **§10 was added after the toolchain was installed and the gates re-measured**, and its claims are executed, not quoted: `build`, `typecheck`, `test` (63 files / 750 tests), `test:browser` (31 cases in headless Chromium 153.0.8010.0), `lint`, `spec:verify` (`ISSUES: 0`), `test:audit` (78 tests), `audit:dev` (`NEW FINDINGS: 0`), `tag:coverage`. §1–§9 are otherwise unchanged, so the analysis still reads as it did before any of it was acted on.
- **Companion documents:** [`P0-AUDIT.md`](P0-AUDIT.md) (what is missing), [`P0-AUDIT-RESOLUTION.md`](P0-AUDIT-RESOLUTION.md) (how to close it), [`P4-P5-BOTTLENECK-INVESTIGATION.md`](P4-P5-BOTTLENECK-INVESTIGATION.md) (the precedent analysis this document follows).
- **Status:** analysis and disposition proposal; **§10 records which dispositions have since been adopted into `IMPL-000` Draft 1.20 and which were delivered as working code.** §1–§9 close no P0 finding, waive no criterion, and authorize no implementation.

---

## 1. Verdict

**No. P0 does not require information or data from P6, or from any other undeveloped phase's implementation.** Every input P0's open obligations need already exists in this repository, or is work P0 owns itself.

The measured work-package graph makes this unambiguous: **doc 010 (P0) has out-degree 0.** Across 211 work packages and 70 cross-document dependency edges, not one P0 work package declares a dependency on any other document. P0 is a pure source node — one of only two in the graph (the other is doc 130, `P4/P7`).

| Question | Answer | Basis |
| --- | --- | --- |
| Does any P0 work package depend on a P6 work package? | **No** | Doc 010's 12 WP rows reference only `WP-010-*` (§3.3) |
| Does any P0 acceptance obligation consume a P6 artifact (emitted TS, manifest, `build`/`verify` output)? | **No** | §5.1 — the only P6 reference in `IMPL-010` is the `SF0500–0599` range reservation, which is P0 *supplying* to P6 |
| Does P0 need an external oracle (Adobe Flash Player), the way P5's FE-030 does? | **No** | P0's vectors are hand-computed from Ch.1 and byte-exact from Appendix A (`T-TST-102`) |
| Does P0 need the open/licensed corpus that blocked P5? | **No — but only if "every fixture" is scoped to the in-repo corpus** | §6 B4; `fixtures/open/` and `fixtures/external/` do not exist (`REPO-R017`) |
| Does P0 need anything from a *later-scheduled* phase at all? | **Yes — infrastructure, not data** (and now relocated: §10) | §6 B1–B3: doc 140 harness, the browser CI lane, and the perf/allocation-counter mechanism were all scheduled at **P11**; roadmap §4.2 moves the minimal form of each into P0 and names P11 as extender |
| Does P0 need information from later-phase *documents*? | **Yes, two items — and both are already answered in-repo** | §6 B6: `IMPL-010` §10 items 3–4 resolve from doc 080 (P3, Completed) and doc 110 (P10) |

**What is actually blocking P0** is therefore not a missing upstream dependency. It is three things, all internal to the project's own process:

1. **Unowned cross-cutting infrastructure.** Four P0 obligations are gated on harness/CI capability that the roadmap schedules at P11 (doc 140) while assigning the *obligation* to P0.
2. **Two undefined acceptance contracts.** "Every fixture" (`T-SWF-009`) and "allocation counter" (`T-SWF-017`, 5 MiB `SWF-R001`) have no pinned definition, so no test can be written that is provably the right test.
3. **One internal contradiction in the resolution plan.** `R-P0-07` requires exercising the read paths that own payload bytes; those paths live in doc 020 (P1), while guardrail §1.5 forbids pulling in P1 container work (§6 B5).

The precedent is exact. The P4/P5 investigation found that the P5→P6→P7 deadlock was **an acceptance-layer cycle, not a code-layer cycle**, and broke it with a phase-boundary decision (Route A) rather than with implementation. P3 hit the same class of problem from the other direction — its C7 closeout records that it *"fixed WP-070-13's accidental P6 dependency"* ([`P3-C7-AUDIT.md`](P3-C7-AUDIT.md)) — and closed anyway by declaring explicit later-phase forwards. P0 has **no accidental P6 dependency to remove**; it needs the same forward-declaration treatment P3 got, applied to P11.

---

## 2. How to read a dependency in this project

A "dependency between phases" is not one thing here. The P4/P5 investigation's central lesson is that the four layers below can disagree, and a phase blocks only when the layer that gates its **exit** is unsatisfied.

| Layer | What it is | Where it is written | How it blocks |
| --- | --- | --- | --- |
| **L1 — Code/import** | Package graph, `no-restricted-imports` edges | `eslint.config.js`, `REPO-R005/R006` | Compile-time. Cycles forbidden. |
| **L2 — Work package** | `WP-<doc>-<nn>` `Depends` cells | each impl doc's §Work packages | Sequencing: "a package may start when every `Depends` id is *reviewed*" (roadmap §10). |
| **L3 — Acceptance / test-id** | Which phase's exit gate cites which doc's `T-*` ids | roadmap §6, `IMPL-010` §8/§11, `STATUS.md` §3 | **Phase exit.** This is where P5 deadlocked and where P0 is stuck. |
| **L4 — Infrastructure & information** | CI stages, harness, fixture program, counters, errata/open items | `REPO-§10`, `TST-§3/§7/§8`, `IMPL-140`, `errata.md` | Silent. Nobody owns it until a phase gate demands it. |

P0's L1 and L2 layers are clean. **All of P0's blockers are at L3 and L4.** That distinction is what makes the answer to the P6 question "no" while the answer to "why is P0 stuck" is still "cross-phase".

---

## 3. The measured phase dependency graph

### 3.1 Extraction

All 211 work-package rows in `docs/impl/**` were parsed; every `WP-\d{3}-\d{2}` reference in a `Depends` cell became a directed edge. Document → phase attribution uses roadmap §2's phase-to-document map.

```
211 work packages · 183 intra-document edges · 70 cross-document edges
0 edges point at an undefined work package (the graph is closed)
```

### 3.2 Phase-level degree table

"Out" = work packages in this phase that depend on another document. "In" = work packages elsewhere that depend on this phase.

| Phase | Doc(s) | Out-edges | In-edges | Reading |
| --- | --- | --- | --- | --- |
| **P0** | 010 | **0** | **7** → **8** | Pure source. Depended on by P1, P2, P3, P11. The eighth inbound edge is the newly *declared* `WP-140-07 → WP-010-12` (§10.6) — P11 hosting a P0 deliverable, which is the legal direction |
| P1 | 020 | 2 | 15 | The most-depended-on phase after P0's primitives. |
| P2 | 030, 040, 100 | 18 | 7 | Wide consumer; contains 6 inversion edges (§3.4). |
| P3 | 060, 070, 080, 090 | 19 | 14 | Widest; already closed with declared forwards. |
| P4/P7 | 130 | 0 | 5 | Pure consumer of Vector IR / model. |
| P5 | 050 | 3 | 12 | Front end; heavily consumed by P6/P12/P13. |
| P6 | 120 | 10 | 7 | Consumes P1/P2/P3/P5/P10. Consumed by P12/P13. |
| P10 | 110 | 1 | 1 | Nearly isolated. |
| P11 | 140 | 1 → **2** | 2 | **Both out-edges point into P0**: `WP-140-01 → WP-010-12` and, since §10.6, `WP-140-07 → WP-010-12`. Both are legal forwards — a later phase consuming an earlier phase's deliverable |
| P12 | 150 | 8 | 0 | Terminal. |
| P13 | 160 | 8 | 0 | Terminal. |

### 3.3 P0's exact position

**Outbound: none.** All twelve `WP-010-*` rows depend only on other `WP-010-*` rows (`010` §9, lines 586–597):

```
WP-010-01 (diagnostics sink + SF registry)   depends: —
WP-010-02 (Cursor core)                      depends: WP-010-01
WP-010-03…07 (integers, bits, reals, strings, colour)  depends: WP-010-02
WP-010-08 (RECT)   depends: WP-010-04        WP-010-09 (MATRIX)  depends: WP-010-05
WP-010-10 (CXFORM) depends: WP-010-04        WP-010-11 (writer + property + allocation tests) depends: WP-010-03…10
WP-010-12 (reader fuzz target)               depends: WP-010-02
```

**Inbound: 7 edges from 4 phases** (8 after §10.6 declared the harness-hosting edge). These are the phases P0 gates:

| Dependent WP | Phase | Depends on |
| --- | --- | --- |
| `WP-020-01` signature detect + `FWS`/`CWS` open | P1 | `WP-010-02` |
| `WP-020-04` header parse + validation | P1 | `WP-010-08` |
| `WP-030-01` shared placement field reader | P2 | `WP-010-09` |
| `WP-060-01` `DefineShape*` headers + bounds | P3 | `WP-010-09` |
| `WP-070-01` `BitmapAsset` + `DefineBitsJPEG2/3/4` | P3 | `WP-010-11` |
| `WP-080-03` `DefineFontInfo`/`2` | P3 | `WP-010-11` |
| **`WP-140-01` writer core: movie/tag builders, defect application** | **P11** | **`WP-010-12`** |
| `WP-140-07` fuzzers: container, tags, actions, **primitive readers (hosted)** | **P11** | **`WP-010-12`** *(added 2026-10-13, §10.6)* |

The `WP-140-01` row is the only structural oddity in P0's neighbourhood, and it is the seed of
bottleneck **B1**. The second P11 row did not exist when this analysis was written: it was added to
declare the harness-hosting relationship in a `Depends` cell instead of leaving it in prose, which is
what made the coupling invisible (§3.5).

### 3.4 Measured inversions (an earlier phase depending on a later one)

Eleven cross-phase edges run *against* the roadmap's phase order. **None of them has P0 on the depending side.**

**Correction added 2026-10-13 (§10.6):** this table was measured at *document* granularity, which
hides any inversion created by a `Phase owner` re-attribution — two rows in P3-era documents can sit
in different phases. Re-measured at *effective* granularity (the row's `Phase owner` cell when it has
one, otherwise its document's phase), three of the eleven below are **already resolved**
(`WP-060-12`, `WP-060-14` → P4; `WP-080-11` → P6) and a **twelfth** inversion appears that
document-level measurement cannot see: `WP-080-10` (P3) → `WP-070-07` (P6). Eight remain, all
dispositioned in roadmap §4.3, and `check_dependency_direction()` in `tools/audit_dev.py` now
re-derives the list on every run.

| Depending phase | Later phase | Edges | Detail |
| --- | --- | --- | --- |
| P2 | P5 | 3 | `WP-030-06`←`WP-050-01`, `WP-030-12`←`WP-050-05`, `WP-100-04`←`WP-050-03` |
| P2 | P3 | 2 | `WP-040-15`←`WP-090-07`, `WP-100-06`←`WP-090-07` |
| P2 | P4/P7 | 1 | `WP-040-09`←`WP-130-08` |
| P3 | P4/P7 | 2 | `WP-060-12`←`WP-130-04`, `WP-060-14`←`WP-130-04` |
| P3 | P5 | 1 | `WP-080-11`←`WP-050-08` |
| P3 | P11 | 1 | `WP-070-14`←`WP-140-03` (oracle runner) |
| P3 | P6 | 1 | `WP-080-10`←`WP-070-07` — **only visible at effective-phase granularity**; found by the automated check and corrected as a *false* edge (§10.6) |
| P6 | P10 | 1 | `WP-120-07`←`WP-110-06` |

P3 resolved its six inversions without reopening the phase: the `Phase owner` column in docs 060/070/080/090 re-attributes individual work packages to `P4` (2), `P6` (6), `P8` (1), `P9` (1), and the closeout lists them as explicit forwards ([`P3-AUDIT-RESOLUTION.md`](P3-AUDIT-RESOLUTION.md) §4). **Doc 010 has no `Phase owner` column**, so P0 currently has no vocabulary for the same move — that is the mechanical fix proposed in §7.

### 3.5 Declared graph vs measured graph

Roadmap §4 declares the phase graph in prose:

```
declared:   P0 → P1 → P2 → {P3, P5} ; P4 ← P3 ; P6 ← P2+P5+assets ; P7 ← P4+P6 ; P8 ← P3 ; P9 ← P4+P7 ; P10 ← P3+P4 ; P11 ← everything
```

```
measured:   the same spine, plus
            P11 ──(WP-140-01 → WP-010-12)──► P0          ← the harness depends on a P0 deliverable
            P0  ┄┄(prose only: "wired into doc 140's harness")┄┄► P11   ← and P0's deliverable points back
            P2 ──► P5, P3, P4/P7     P3 ──► P4/P7, P5, P11     P6 ──► P10
```

The dotted edge is the important one: **it exists only in prose, inside a `Deliverable` cell, and therefore does not appear in any dependency table the project's own tooling reads.** `tools/audit_dev.py`'s `work_package_phases()` only reads a `Phase owner` column, which doc 010 lacks. So the reciprocal P0↔P11 coupling is invisible to every mechanical check in the repo.

---

## 4. P0 obligation-by-obligation input audit

Every open P0 obligation, its required inputs, and who owns those inputs. "Exists?" is the state of this checkout on 2026-10-13.

| # | Obligation | Required input(s) | Input owner → phase | Exists? | Cross-phase? | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `T-SWF-004` complete vector matrix (`R-P0-02`) | The 25-row vector table in `IMPL-010` §8; Ch.1 byte layouts; errata `E-001/E-004/E-005` | 010 → **P0** | ✅ all rows written | No | **Self-sufficient** |
| 2 | Same vectors in a **browser** runner (`R-P0-02`, `IMPL-010` §11.1) | A browser test project + CI `browser` stage | `REPO-§6/§10`, `TECH-SPEC` §4.1–§4.3, `TST-§8` → **P11** (three-engine matrix) | ❌ `vitest.config.ts` is `environment: 'node'`; `ci.yml` has no browser job | **Yes — infra** | **B2** |
| 3 | `T-SWF-009` all-fixture repeat parse (`R-P0-03`) | A pinned definition of "every fixture"; the fixture inventory | `TST-§3.1`, `REPO-R017` → **P11** corpus program; fixtures themselves are P0/P4-era | ⚠️ 21 committed `.swf` + generated families exist; no inventory artifact; no `fixtures/open/`, no `fixtures/external/`, no `PROVENANCE.md` | **Yes — definitional** | **B4** |
| 4 | `T-SWF-014` 10⁵ writer→reader→writer fixed point (`R-P0-04`) | Primitive writers for `MATRIX`, `CXFORM`, `EncodedU32`, `FIXED`/`FIXED8`, `FLOAT16/32/64`, `u24`, `u64`, colours | 010 `WP-010-11` → **P0** | ⚠️ `ByteWriter` has `u8/u16/s16/u32/s32/bytes/text/bits/align` + `writeRect` only | No | **Self-sufficient** (writer extension is P0's own WP) |
| 5 | `T-SWF-015` soft recovery (`R-P0-05`) | A declarative defect on a bounded record + a valid later record | 010 + `IMPL-140-R002`/`IMPL-020-R037` defect model → **P0/P1** | ✅ `WriterDefect` already exists in `test-support/writer.ts` | No | **Self-sufficient** |
| 6 | `T-SWF-016` strict error contract (`R-P0-05`) | `SwfReadError.code` / `.offset` | 010 → **P0** | ✅ both fields exposed | No | **Self-sufficient** |
| 7 | `T-SWF-017` zero allocations over 10⁶ warm reads (`R-P0-06`) | A *named, deterministic* allocation-count mechanism | Unspecified. Nearest analogue: `TST-R016` CI counters → **P11**; working precedent: P4's instrumented `stats.allocations` (`packages/gfx/src/render/stats.ts`, `T-GFX-021`) → **P4, Completed** | ⚠️ mechanism undefined in every doc; precedent exists and is delivered | **Yes — but satisfied** | **B3** |
| 8 | 5 MiB `SWF-R001` payload-copy budget (`R-P0-07`) | A ≥5 MiB uncompressed `FWS` input; instrumentation at the parser boundary that owns payload bytes | `SWF-R001` (`specs/format/030` lines 20–23) → P0 contract; payload-owning read paths (`viewBytes`/`takeBytes`, tag payload memoization) → **doc 020, P1, Completed** | ⚠️ no such test; no ≥5 MiB fixture; `T-SWF-021` covers one payload view only | **Yes — into a Completed phase** | **B5** (plan contradiction) |
| 9 | `WP-010-12` reader fuzz target (`R-P0-08`) | `tools/fuzz/readers.ts` **wired into doc 140's harness** | 010 → **P0**; the harness → doc 140 → **P11** | ❌ file absent; `tools/` is not a TS project (root `tsconfig.json` references only `packages/*` and `apps/*`) and `eslint.config.js` ignores `tools/**`; doc 140 has **no WP that hosts a raw-reader fuzz target** (`WP-140-07` covers container/tags/actions) | **Yes — infra + ownership hole** | **B1** |
| 10 | Diagnostic-literal lint rule (`R-P0-09`, `IMPL-010` §11.5) | ESLint flat-config rule + a scope ruling (production only, or tests too) | `REPO-§5/§6` toolchain → **P0/P1-era** | ❌ no such rule; `SF0001` literal in `diagnostics/types.ts` | No | **Self-sufficient** (needs a scope decision) |
| 11 | `IMPL-010` §10 item 3 — "confirm no AVM1-era structure consumes `FLOAT16`" (`R-P0-10`) | The consumer tables of the media/font/video documents | doc 080 → **P3, Completed**; `specs/110` line 726 | ✅ **Answer found, and it is positive** | **Yes — documentation only** | **B6** |
| 12 | `IMPL-010` §10 item 4 — "confirm `SI24` does not exist" (`R-P0-10`) | The tag/field tables across all documents | doc 110 → **P10, Not started**; `specs/110` §2 | ✅ **Answer found: no `SI24` anywhere; the only 24-bit field is `OffsetToAlpha UI24`** | **Yes — documentation only** | **B6** |
| 13 | `T-SWF-001`, `T-SWF-003` (roadmap §6 P0 row) | Header/framing tests **defined in doc 020** | 020 → **P1, Completed** | ✅ present in `container.test.ts`, `framing.test.ts` | Yes — satisfied | Already closed by P1's exit |

**Score: 5 obligations fully self-sufficient, 2 already satisfied by completed phases, 6 with a cross-phase touch — and of those 6, none needs an artifact that does not already exist in documentation or in completed-phase code.**

---

## 5. The P6 question, answered directly

### 5.1 Negative evidence

Searching P0's own normative text and its audit trail for any emitter/P6 coupling:

- `IMPL-010` mentions doc 120 exactly **once**, at line 488: `| SF0500–0599 | 120 | emitter/codegen (range reserved by CMP-§9.3 …) |`. That row is P0 **allocating a diagnostic range on P6's behalf** — the registry in `IMPL-010` §7 is the single source of truth for the whole `SF` number space. The dependency runs *from* P6 *to* P0, and it is satisfied today.
- `IMPL-010` mentions doc 140 twice: line 49 (`writer.ts` is the fixture generator's writer) and line 597 (`WP-010-12` wiring). Both are harness couplings, not emitter couplings.
- Neither `P0-AUDIT.md` nor `P0-AUDIT-RESOLUTION.md` names P6 as an input. The only P6 references are **prohibitions**: "P0 closure does not authorize P5 AVM1 semantics, byte-round-trip work, P6, or P7" (§3) and "Do not pull in P1 container work, P5 AVM1 behavior, P6/P7, or runtime implementation" (§1.5).
- No P0 test id appears in doc 120's `T-CMP-*` table, and no `T-CMP-*` id appears in doc 010's §8 table (`STATUS.md` §3).

### 5.2 Direction reversal — what P6 actually needs from P0

The real P0↔P6 relationship is the opposite of the one asked about. P6's emitter consumes P0-era outputs, transitively:

```
P6 (doc 120) ──► WP-120-01 ← WP-020-10 (P1 SwfFile facade)
             ──► WP-120-06 ← WP-030-09 (P2 frame assembly)
             ──► WP-120-07 ← WP-070-07, WP-080-10, WP-090-10, WP-110-06 (P3/P10 asset paths)
             ──► WP-120-03/04/05/09 ← WP-050-08/09/10 (P5 front end)
                                        all of which rest on WP-010-02…11 (P0 primitives + writer)
```

P6 is 4 hops downstream of P0 and has zero influence upstream. Emitting P6 work early could not unblock a single P0 criterion, and no P0 criterion can be satisfied by a P6 deliverable.

### 5.3 The one place this project *did* have an accidental P6 dependency

`audits/P3-C7-AUDIT.md` records that P3's closeout *"fixed WP-070-13's accidental P6 dependency"* — an earlier-phase work package citing a P6-owned one. The fix was to remove the citation, not to wait for P6. Two conclusions follow:

1. The project already treats "earlier phase cites P6" as a **specification defect to be corrected**, not a schedule constraint to be absorbed.
2. P0 has been checked for the same defect and is clean: its `Depends` cells contain no `WP-120-*`, `WP-130-*`, `WP-150-*`, or `WP-160-*` reference.

### 5.4 Contrast with P5 — why the question is a reasonable one to ask

P5 *is* genuinely blocked on inputs the project cannot produce itself, which is presumably why the same question was asked of P0:

| | P5 (blocked) | P0 (blocked) |
| --- | --- | --- |
| External oracle needed | **Yes** — FE-030 needs an authoritative Adobe Flash Player `ActionStringLength` result for SWF ≤ 5; Ruffle and Lightspark are explicitly not oracles | **No** — every vector is hand-computed from Ch.1 or byte-exact from Appendix A |
| Licensed third-party corpus needed | **Yes** — a provenanced AS1/AS2 title corpus plus two independent reviewers; a targeted GitHub screen found no admissible candidate | **No** — the in-repo synthetic/committed corpus suffices, if scoped that way (B4) |
| Undeveloped-phase code needed | No (after Route A moved runtime gates to P7) | No |
| Nature of the block | **Information that does not exist in the repo and cannot be manufactured** | **Definitions and infrastructure that the repo has not yet pinned or built** |

That difference is the actionable conclusion: **P0 is unblockable by internal decision and ordinary engineering; P5 is not.** No amount of P6 work changes either.

---

## 6. The real bottlenecks, ranked

### B1 — The doc-140 harness ownership hole (P0 ↔ P11), blocking `WP-010-12`

`WP-010-12`'s deliverable is *"`tools/fuzz/readers.ts`, wired into doc 140's harness"* (`IMPL-010` §9, line 597). Three facts make this unwirable as written:

1. **Doc 140 has no work package for it.** Its fuzzer inventory is `WP-140-07` — "Fuzzers: container, tags, actions" — and §1 deliverable 6 lists container/tag/action-stream/emitter-verify targets. A *raw primitive-reader* target appears nowhere in doc 140. The integration point named by P0 does not exist as a P11 deliverable.
2. **The dependency is reciprocal and undeclared.** `WP-140-01` (writer core) declares `Depends: WP-010-12` (`IMPL-140` line 201). So P11's writer waits on a P0 target whose own deliverable waits on P11's harness. Only one direction is in a `Depends` cell; the other is prose in a `Deliverable` cell, so `tools/audit_dev.py` and the roadmap index cannot see it.
3. **The declared path is outside the quality gates.** `tools/**` is ignored by `eslint.config.js` and is not referenced by the root `tsconfig.json` (which lists only `packages/*` and `apps/*`). A TypeScript file at `tools/fuzz/readers.ts` would be neither linted nor typechecked, contradicting `REPO-R009` and the work-package DoD (`docs/impl/README.md` §3).

*Owner:* P0 phase owner for the target; P11/doc-140 owner for the wiring. *Unblocks:* `R-P0-08`, and incidentally `WP-140-01`.

### B2 — The browser test lane is unowned, blocking `IMPL-010` §11 criterion 1

Criterion 1 requires every §8 vector to pass "on Node **and in the browser test runner**". The browser lane is specified in three places — `REPO-§10` (`browser` CI stage: "vitest browser mode + Playwright smoke, zero failures"), `REPO-§6`/`TECH-SPEC` §4.2 (`vitest` node + jsdom + browser mode, with `*.browser.test.ts` files per §3.2–§3.3 and a `test:browser` script per §4.1), and `TST-§8` (the three-engine matrix) — and is scheduled at **P11** ("three-engine CI" in the roadmap's P11 row; `PROJECT-CHECKLIST.md` lists it under P11). No work package in any document delivers it. Current state: `vitest.config.ts` sets `environment: 'node'` with a single project; `.github/workflows/ci.yml` has no browser job.

Note the scope trap: P0 needs *a* browser runner executing the vector table, not P11's three-engine matrix with `engine-skip` annotations and `reports/engine-matrix.md` (`TST-R020/R021`). The minimal lane is a few hours of work; the P11 gate is not. Conflating them would import P11's whole release-engineering scope into P0's exit.

*Owner:* P0 (minimal lane) with a forward to P11 (matrix). *Unblocks:* `R-P0-02`.

**Resolved 2026-10-13 — delivered, not just dispositioned.** See §10.1 for what was built, what it
proved, and the reader defect it caught.

### B3 — The allocation-counter contract is undefined, blocking `T-SWF-017` and the 5 MiB budget

`IMPL-010` §8 requires "zero allocations from a warm cursor over 10⁶ reads (**allocation counter**)"; roadmap §6 requires "a test that allocates a 5 MiB buffer and **asserts allocation count**". No document anywhere in `docs/specs` or `docs/impl` names a mechanism. `R-P0-06` correctly forbids the obvious fudge ("Do not use an unbounded RSS or noisy `heapUsed` delta as proof of exactly zero allocations") and instructs the agent to **stop** if no exact counter exists.

The good news — and the reason this is B3 rather than B1 — is that **a completed phase already solved this problem in-repo.** P4's `T-GFX-021` ("600 frames allocate nothing after warm-up") uses an *instrumented, explicitly-counted* counter: `stats.allocations += 1` at each allocation site in the steady-state path (`packages/gfx/src/render/stats.ts` line 41, `gl/backend.ts:320`, `gl/batcher.ts:285`), snapshotted before and after the measured loop, with a coarse `heapUsed` delta used only as a gross guard — never as the proof. `TST-R016` sanctions exactly this shape: "CI runs deterministic *counters* (draw calls, allocations, bundle bytes) on headless".

So the mechanism question is answerable by adopting P4's precedent into `IMPL-010` as a normative contract. It is a documentation decision, not a dependency on P11.

*Owner:* P0 phase owner (record the contract in `IMPL-010` + changelog). *Unblocks:* `R-P0-06`, `R-P0-07`.

### B4 — "Every fixture" is undefined, and the naive reading imports P11's corpus program

`T-SWF-009` requires "two parses of **every fixture** produce identical offsets and values". `R-P0-01` demands this be pinned "using a deterministic inventory", and `R-P0-03` says to "include committed fixtures and the declared deterministic synthetic fixtures".

The in-repo corpus is enumerable today:

| Class | Content | Count |
| --- | --- | --- |
| Committed binaries | `fixtures/appendix-a.swf` + `fixtures/static/*.swf` | **21** |
| Generated static fixtures | `test-support/static-fixtures.ts` (`name:` entries) | **20** (the same 20, materialized on disk) |
| Crasher corpus | `packages/swf/test/fuzz/corpus/crash-00{1..5}-*.swf` | **5** |
| In-test synthetic fixtures | built per test file via `ByteWriter`/`buildSwf` across the 32 `packages/swf/test/*.test.ts` files (plus 10 in `apps/decompiler/test/`) | not currently enumerable |

But `TST-§3.1` defines **three** fixture classes — `synthetic`, `open`, `archive` — and `REPO-R017` requires `fixtures/open/` with `fixtures/PROVENANCE.md`, plus `fixtures/external/*.md` hash records fetched into a gitignored cache. **None of that scaffolding exists.** If "every fixture" is read against `TST-§3.1`, `T-SWF-009` inherits the open-corpus acquisition and licensing program — the same program whose failure is recorded as an open **P5** criterion ("a targeted GitHub screen found an unlicensed AS2 SWF, source-only or non-SWF projects, and a GPL-licensed AS3 project; no candidate met the licensed/provenanced open-title criterion"). That would convert P0 from internally-blocked to externally-blocked, for no engineering reason.

There is also a live contradiction to settle while pinning this: `IMPL-020` §10 states "All container fixtures are generated by the synthetic writer (doc 140), **not committed as opaque binaries**", yet 21 binaries are committed under `fixtures/`. Either the policy or the tree is wrong; `T-SWF-009`'s inventory cannot be defined until that is resolved.

*Owner:* P0 phase owner (pin the inventory); doc 140/P11 for the corpus program. *Unblocks:* `R-P0-01`, `R-P0-03`.

### B5 — `R-P0-07` contradicts the resolution plan's own guardrail

`R-P0-07` requires a test that parses a ≥5 MiB `FWS` input and "exercise[s] **the actual read paths that own payload bytes**". In this codebase those paths are not in `io/` alone:

- `Cursor.viewBytes()` (zero-copy `subarray`) and `Cursor.takeBytes()`/`rest()` (copying `slice`) live in `packages/swf/src/io/cursor.ts` — P0.
- **Tag payload ownership, lazy indexing, and memoization live in `packages/swf/src/container/*` (doc 020 → P1)**, which is what `T-SWF-021` asserts on.
- Real payload consumers that copy — e.g. `packages/swf/src/tags/control.ts:371` (`takeBytes` for a binary-asset hash) and `:412` — live in P2/P3-era tag decoders.

Meanwhile guardrail §1.5 says: *"Keep P0 work scoped to binary IO, primitive records, diagnostics, and their acceptance harness. Do not pull in P1 container work."* A `SWF-R001` copy-budget measurement that only touches `io/` cannot observe the payload path that `SWF-R001` is actually about ("the reader holds one `Uint8Array` per movie and hands out views"), and one that does observe it necessarily drives P1's container. P1 is `Completed`, so nothing is *blocked* — but the plan needs an explicit ruling, or the resolving agent will either write a vacuous test or violate its own guardrail.

The same ruling must cover fixture size: `REPO-R017` caps committed fixtures at 20 MiB and pushes larger ones to the external fetch mechanism, so a 5 MiB input should be **generated in memory** by the writer rather than committed — which also keeps it out of the repository's binary budget.

*Owner:* P0 phase owner. *Unblocks:* `R-P0-07`.

### B6 — `IMPL-010` §10 items 3–4 are answerable now, from documents P0 does not own

`R-P0-10` requires checking "the format/implementation consumer tables" for a `FLOAT16` consumer and for `SI24`, and forbids closing either item "solely because a repository search returns no match". Both searches were run over the full encoded spec set (roadmap §9.1: Ch.1–Ch.15 + Appendices A–C are all encoded). Results:

**Item 3 — `FLOAT16` consumer: FOUND, positive, and already implemented.**

- `specs/reference/110-appendices-reference-tables.md:726` — `DefineFontAlignZones` (tag 73): `ZONEDATA` = `AlignmentCoordinate FLOAT16`, `Range FLOAT16`.
- `docs/impl/decompiler/080-fonts-and-text.md:294` (`IMPL-080-R035`, doc 080 → **P3, Completed**) — same layout, "we record them verbatim and do not snap with them".
- **Production code:** `packages/swf/src/tags/fonts.ts:599–600` calls `c.float16()` twice inside `decodeFontAlignZones`; `tools/tag_coverage.py` dispositions tag 73 as `decoded` (min version 8).
- **Test:** `packages/swf/test/font-aux-tags.test.ts` writes raw `FLOAT16` bit patterns and asserts `0x3C00 → 1.0`, `0x4000 → 2.0`.

This **falsifies** two currently-committed statements and triggers a documented re-open clause:

1. `errata.md` `E-004` (line 65) asserts *"`FLOAT16` does not appear in any AVM1-era tag we parse, so the risk is contained; if a future chapter shows a structure that consumes it, this entry gets re-opened and the consuming structure gets a fixture."* The consuming structure is in scope (SWF 8+, well inside the AVM1-era set — AVM2 content is rejected outright by `SF1000`), is parsed, and has a fixture. **E-004 must be re-opened and its risk sentence corrected.** The bias-15 resolution itself is unaffected and is corroborated by the working decoder.
2. `IMPL-010` §10 item 3 is stated as "Confirm no AVM1-era structure consumes `FLOAT16` — open (low risk)". The answer is the opposite of the expectation the row was written against. Closing it requires a `IMPL-010` changelog row and a cross-reference to doc 080's fixture.

Minor consistency note found on the way: `specs/110` §2 gives tag 73 disposition `I` ("ignore with an `info` diagnostic") while the implementation decodes and records it verbatim per `IMPL-080-R035`. Worth a one-line reconciliation in whichever document owns the claim; it does not affect the `FLOAT16` conclusion.

**Item 4 — `SI24`: NOT FOUND, and the negative is provable across the encoded set.**

- `SI24` appears nowhere in `docs/specs` or `docs/impl` except `IMPL-010-R004` and §10 item 4 themselves.
- The only 24-bit field in the entire encoded spec set is `VP6SWFALPHAVIDEOPACKET: OffsetToAlpha UI24` (`docs/impl/decompiler/110-video.md:252`, mirrored at `specs/110:981`) — **unsigned**, owned by doc 110 → **P10, Not started**.
- Consistently, `Cursor.u24()` has **no production consumer** in this checkout; it exists for that future P10 path.

So item 4 closes as: no `SI24` exists in scope; the sole 24-bit consumer is doc 110's VP6 alpha-offset field, which uses the existing unsigned reader. The information came from a *not-started* phase's document — which is precisely why the distinction between "documentation from an undeveloped phase" and "data from an undeveloped phase" matters. Doc 110 is fully grounded in Ch.14 (`STATUS.md` §4); its bytes are known even though its code is not written.

*Owner:* P0 phase owner. *Unblocks:* `R-P0-10`, and removes the last item on `PROJECT-CHECKLIST.md`'s P0 list that could be mistaken for an external dependency.

---

## 7. Recommended dispositions, in dependency order

These mirror the P3 closeout pattern (declare the phase owner, record the forward, close the phase on its own scope) and the P4/P5 Route A pattern (make the boundary decision before writing code). **All are documentation/decision changes; none authorizes implementation and none waives a P0 criterion.**

| # | Decision | Effect | Unblocks |
| --- | --- | --- | --- |
| **D-P0-DEP-01** | **Rule that P0's exit gate is bounded by the in-repo corpus.** Define "every fixture" for `T-SWF-009` as: the 21 committed `.swf` files + the 5 crasher-corpus files + an enumerated, deterministic registry of generated synthetic fixtures, checked in as an inventory artifact. State explicitly that `TST-§3.1`'s `open`/`archive` classes are **out of P0 scope** and are picked up by the P11 corpus program, with a forward recorded. | Removes the only path by which P0 could inherit P5's corpus/licensing failure. | B4 → `R-P0-01`, `R-P0-03` |
| **D-P0-DEP-02** | **Adopt P4's instrumented-counter pattern as the normative allocation contract in `IMPL-010`**, with a changelog row: exact per-site counted allocations as the proof, a coarse heap-delta guard permitted only as a secondary check, warm-up and measured-interval protocol stated, and the counted allocation classes enumerated separately for `T-SWF-017` (hot-read object allocations) and `SWF-R001` (payload-byte copies). | Converts two "impossible" gates into specified, testable ones using an already-accepted in-repo precedent. | B3 → `R-P0-06`, `R-P0-07` |
| **D-P0-DEP-03** | **Add a `Phase owner` column to `IMPL-010` §9**, matching docs 060/070/080/090, and split the two cross-phase halves out: `WP-010-12`'s *harness wiring* → P11 forward (target itself stays P0); `WP-010-11`'s *allocation-test mechanism* → P0 once D-P0-DEP-02 lands. Then extend `tools/audit_dev.py`'s `DEFERRED_FORWARD_PHASES` (currently `{P4, P6, P8, P9}`) to admit **P11**, or record the forward in the roadmap so the tool's phase check stays satisfiable. | Gives P0 the same vocabulary P3 used to close with forwards, and makes the P0↔P11 coupling visible to mechanical checks instead of living in prose. | B1 → `R-P0-08`; §3.5 |
| **D-P0-DEP-04** | **Re-site the reader fuzz target inside the gated tree** — e.g. `packages/swf/test/fuzz/readers.*.test.ts` beside the existing crasher corpus — and record the divergence from `WP-010-12`'s declared `tools/fuzz/readers.ts` path in the `IMPL-010` changelog, or add `tools/` to a TS project and lift its ESLint ignore. Keep it in-process and I/O-free as the WP title requires, so the same target can run in both the Node and browser lanes. | Makes the deliverable typechecked, linted, and CI-runnable today, without waiting for doc 140's harness. | B1 → `R-P0-08` |
| **D-P0-DEP-05** | **Ask doc 140 for a host work package** (or record that `WP-140-07` is amended to include the raw-reader target), and note the reciprocal `WP-140-01 → WP-010-12` edge in both documents so the cycle is declared rather than implicit. | Closes the ownership hole at its source; prevents the same inversion recurring for P1/P2 fuzz targets. | B1 |
| **D-P0-DEP-06** | **Scope the browser lane minimally for P0**: one browser test project running the shared §8 vector definitions, added to `ci.yml` as its own job, with P11's three-engine matrix and `engine-skip` reporting recorded as a forward. Reuse the identical vector module in both lanes so Node and browser cannot drift (`R-P0-02` already requires this). | Satisfies `IMPL-010` §11.1 without importing P11's release-engineering scope. | B2 → `R-P0-02` |
| **D-P0-DEP-07** | **Rule on the `R-P0-07` / guardrail-§1.5 conflict**: the 5 MiB `SWF-R001` measurement is permitted to *drive* P1's container read paths (P1 is `Completed`; no P1 behavior may change), and the input must be **generated in memory** by the writer, not committed (`REPO-R017`). Record the ruling in the resolution plan so the resolving agent is not forced to choose between a vacuous test and a guardrail violation. | Removes the plan's only internal contradiction. | B5 → `R-P0-07` |
| **D-P0-DEP-08** | **Close `IMPL-010` §10 items 3–4 on the evidence in §6 B6**: item 3 with the positive `DefineFontAlignZones` finding, **re-opening errata `E-004`** per its own clause and citing doc 080's fixture; item 4 with the negative result plus doc 110's `OffsetToAlpha UI24` as the only 24-bit consumer. Add `IMPL-010` changelog rows and reconcile the tag-73 `I`-vs-`decoded` wording. | Clears the two open items that look like external dependencies but are not. | B6 → `R-P0-10` |

Sequence: **D-P0-DEP-01 → 02 → 07** are pure decisions and can be recorded in one pass; they unblock five of the eleven resolution steps. **03 → 04 → 05** are the harness-ownership set and should land together. **06** is independent. **08** is independent and can land immediately.

**Status of each disposition as of 2026-10-13 — see §10.2.** All eight are adopted as roadmap
decisions in `IMPL-000` Draft 1.20; D-P0-DEP-06 is additionally delivered as working code, and the
per-document edits each decision still requires are itemised in roadmap §4.4.

---

## 8. Tripwires — what *would* make P0 depend on an undeveloped phase

Monitor these; each is a falsifiable condition that would change §1's verdict.

| Tripwire | Why it matters | Current state |
| --- | --- | --- |
| `T-SWF-009`'s inventory is written to include `fixtures/open/` or `fixtures/external/` | Imports P11's corpus program and P5's licensing failure into P0's exit | Not yet written — D-P0-DEP-01 prevents it |
| The allocation gate is specified in terms of a browser/engine-provided profiler | Would couple P0 to P11's three-engine matrix and to `TST-§8` skips | Instrumented-counter precedent (P4) is engine-independent |
| `WP-010-12` is closed by citing the `openSwf` 10⁴ mutation smoke | Already prohibited by `P0-AUDIT-RESOLUTION.md` §3; would also silently mark P11's `WP-140-01` unblocked | `packages/swf/test/fuzz.test.ts` cites `WP-020-11`, not `WP-010-12` — the distinction is currently held |
| Any `WP-010-*` row gains a `Depends` cell naming `WP-120-*`/`WP-130-*`/`WP-140-*`/`WP-150-*`/`WP-160-*` | Would create the first real L2 inversion out of P0 — the P3/`WP-070-13` defect class | None exist |
| A new `FLOAT16`/`SI24`/`SI16`-class consumer appears in a chapter not yet encoded | Would reopen `IMPL-010` §10 legitimately | Roadmap §9.1 records Ch.1–15 + App. A–C as fully encoded; the chapter-intake risk is closed |
| The 5 MiB measurement is implemented by changing container/`Cursor` copy semantics | Would reopen P1's `Completed` exit gate through a P0 test | Guardrail §1.5 forbids it; D-P0-DEP-07 keeps the prohibition and fixes the measurement scope instead |

---

## 9. What this document does not conclude

- It does **not** close any P0 finding. `P0-AUDIT.md`'s F-P0-01…07 all stand; `P0-AUDIT-RESOLUTION.md`'s ordered plan and §4 closeout checklist remain the procedure, and roadmap §2's status policy still requires a fresh P0 audit before the row may change from **In progress** to **Completed**.
- It does **not** claim any test passes. No suite was executed in this checkout (`node_modules` absent); gate state is quoted from the recorded 2026-10-11 snapshot and the P0/P3/P5 audit records.
- It does **not** weaken a criterion. Every disposition in §7 either supplies a missing definition, re-attributes ownership, or records a forward with a named phase — the P3 pattern. None substitutes a narrower test for a wider obligation, which `P0-AUDIT-RESOLUTION.md` §3 forbids.
- It does **not** estimate calendar delay or attribute the bottleneck to staffing. As with the P4/P5 investigation, this checkout contains no issue tracker, owner assignments, or elapsed-time log.
- It does **not** re-open P1, P2, P3, or P4. Those exits stay green; where P0's evidence touches their code (B5), the requirement is to *drive* it, not to change it.
- It does **not** authorize P6, P7, or any later-phase implementation, and it does not address P5's separate open criteria beyond the contrast in §5.4.

---

## 10. Resolution record (2026-10-13)

§1–§9 are the analysis exactly as written. This section records what has since been decided and
delivered, so no recommendation here is left standing as if it were still only a proposal.

### 10.1 The browser lane (B2 / D-P0-DEP-06) — delivered

| Artifact | Role |
| --- | --- |
| `packages/swf/test/support/vector-table.ts` | The §8 rows defined **once**: bytes, expected value, required diagnostic codes, provenance (`doc-literal` / `appendix-a` / `derived`), and the document cell each row came from. No filesystem, no `node:` imports, no DOM types |
| `packages/swf/test/io-vectors.lanes.test.ts` | The `*.lanes.test.ts` suite, collected by **both** configs so the lanes cannot drift. Asserts each row's value *and* its exact diagnostic set, plus one pinned cross-engine fingerprint |
| `vitest.browser.config.ts` | The browser lane: `@vitest/browser` + Playwright, headless Chromium, source-resolved aliases (never needs a prior `pnpm build`), injected lane marker |
| `tools/browser-lane.mjs` | `probe` / `install` / `env`: engine resolution order, plus a registry-only installer for restricted networks (~3 s) |
| `.github/workflows/ci.yml` | New `browser` job — `R-P0-02`'s "the CI log identifies both jobs" |
| `package.json` | `test:browser`, `browser:probe`, `browser:install` |

**Measured, not quoted.** Node lane: 63 files / 750 tests. Browser lane: 31 cases, with the engine
naming itself in-lane from `navigator.userAgent` as `HeadlessChrome/153.0.8010.0`. Both lanes reduce
the same 26 rows to the same pinned fingerprint, so signed zero, NaN/±Infinity, `>>> 0`, and
`TextDecoder('windows-1252')` are now proven equal between V8-on-Node and V8-in-Chromium rather than
assumed equal because the code is shared.

Two design points exist specifically because F-P0-01's failure mode is a *silent* absence of
evidence: a missing engine is a hard, explained failure (the config throws with three named fixes;
`probe` exits 3), never a skip; and the injected marker makes a browser lane that quietly ran under
Node **fail** instead of passing as browser evidence.

Engine reproducibility was tested by accident and is worth recording: the sandbox restored on
2026-10-13 and deleted both `node_modules` and the 203 MB engine cache. `pnpm install` (2.5 s) +
`node tools/browser-lane.mjs install` (3.2 s) + `pnpm build` restored the whole lane to green. No
binary is committed, per `REPO-R017`.

**What this does not claim.** `R-P0-02` is *not* closed. It also requires a row-by-row table from
**every** value in §8, and three row families need a paired writer that does not exist yet (`RECT` at
arbitrary `Nbits`, `MATRIX` scale/rotate, `CXFORMWITHALPHA`) — that is `WP-010-11`. `T-SWF-004` and
F-P0-01 therefore stay open; the browser lane is simply no longer the reason they are open.

### 10.2 The reader defect the lane caught (new finding — found and fixed)

Executing §8 row-by-row against the production readers found a real defect on the first pass:

| | |
| --- | --- |
| Input | `ff ff ff ff 0f` (the maximal `EncodedU32`) |
| `IMPL-010` §8 expects | `4294967295`, no diagnostic — five groups carry exactly 32 bits, so the encoding is minimal |
| Code returned | `4294967295` **plus a spurious `SF0009`** ("encoding longer than necessary") |
| Cause | `packages/swf/src/io/integers.ts` accumulated with `|=`, which yields a **signed int32**, then tested minimality (`value < 2 ** (7 * (count - 1))`) *before* the `>>> 0` normalisation. The maximal value compared as `-1`, so every value ≥ 2³¹ was misreported |
| Fix | Compare the unsigned result; one-line change with the reasoning recorded at the site |
| Evidence | Regression case in `packages/swf/test/io.test.ts` (all four §8 `EncodedU32` rows, asserting the diagnostic set exactly) + the `encoded-u32-max` row of the shared vector table, executed in both lanes |

No existing test asserted either behaviour — the overlong path had **zero** coverage. That is
F-P0-01's "the vector matrix has never been run" claim demonstrated rather than argued, and it is the
concrete answer to the question this document was written to address: P0 was not blocked by a missing
upstream dependency, and the first thing that happened when the missing infrastructure arrived was
that it found a bug.

### 10.3 Disposition status

| # | Adopted as a roadmap decision (`IMPL-000` 1.20) | Delivered in code | Still required |
| --- | --- | --- | --- |
| D-P0-DEP-01 fixture inventory bounded to the in-repo corpus | ✅ §4.2 | — | `010` §8 inventory artifact; `020` §10 committed-binary contradiction settled (§4.4 items 3, 6) |
| D-P0-DEP-02 P4 instrumented counter as the normative allocation contract | ✅ §4.2, §6 P0 | — | Contract text in `010` §8 (§4.4 item 2) |
| D-P0-DEP-03 `Phase owner` column for doc 010 + tool admission of P11 | ✅ §4.3, §4.4 | — | Column in `010` §9; `audit_dev.py` inversion check (§4.4 items 1, 8) |
| D-P0-DEP-04 re-site the fuzz target inside the gated tree | ✅ §4.2 | — | `packages/swf/test/fuzz/readers.*.test.ts` (§4.4 item 1) |
| D-P0-DEP-05 doc 140 host package + declared reciprocal edge | ✅ §4.2, §4.3 | — | `WP-140-07` amendment (§4.4 item 5) |
| **D-P0-DEP-06 minimal browser lane at P0, P11 matrix as forward** | ✅ §4.2, §6 P0/P11 | ✅ **delivered** | `010` §11.1 citation; `REPO-§10`/`TECH-SPEC` §4.3 note (§4.4 items 4, 9) |
| D-P0-DEP-07 ruling on `R-P0-07` vs guardrail §1.5 | ✅ §4.2 (drive, never change, P1; input generated in memory) | — | The 5 MiB measurement itself |
| D-P0-DEP-08 close `010` §10 items 3–4; re-open `E-004` | ✅ §4.1 (primitive-consumer register, P0-owned) | — | `010` §8/§10 register; `errata.md` `E-004`; tag-73 wording (§4.4 items 3, 7) |

**Superseded for every row above whose "Still required" entry named a roadmap §4.4 follow-up:** all
ten were applied on 2026-10-13, with one extra item found in the process. See §10.6. What genuinely
remains is implementation work, not documentation.

### 10.4 A new blocking item: the §8 `UI32` row is internally inconsistent

Reported, **not** resolved, and deliberately not absorbed into a test.

The row's bytes are `20 71 6e 45` = `0x456E7120` = **1164865824**, and the row's own hex label agrees
with the bytes. Its "Expected" cell prints **1163342112** = `0x45573120`, which matches neither. Every
other mechanically checkable §8 row is self-consistent (`UI16`, `UI24`, `FIXED`, all four
`EncodedU32`, `UB[4]`, `SB[4]`, `SB[7]`, `FB[19]`, all seven `FLOAT16`, `ARGB`, `STRING`), so this is
isolated rather than systemic. A literal row-by-row exact-equality matrix cannot be pinned until it is
dispositioned: either an upstream typesetting defect — the `E-025` class, whose rule is that the bytes
are authoritative — or an error in our transcription. That ruling belongs in `errata.md` and needs the
upstream Ch.1 text, which this repository does not contain.

The vector table therefore encodes the **byte-derived** value, carries the discrepancy explicitly
(`VECTOR_TABLE_DISCREPANCIES`, with `docTableDiscrepancies()` deriving it mechanically), and asserts in
both lanes that every derived discrepancy has a pinned disposition — so fixing §8 forces the entry to
be removed, and a new discrepancy forces it to be declared. One further, benign difference: `FB[19]`'s
cell prints `3.0` where the canonical form is `3`.

Roadmap §4.4 item 10 carries this forward as a required `010`/`errata.md` edit.

### 10.6 The per-document follow-ups, applied

Roadmap §4.4 listed ten edits the roadmap's decisions required in documents it does not own. All ten
landed, each with a changelog row in the document it changed:

| # | Document | What landed | Version |
| --- | --- | --- | --- |
| 1 | `IMPL-010` §9 | `Phase owner` column added (all twelve rows P0, so this document has no later-phase work); `WP-010-12` re-sited from `tools/fuzz/readers.ts` — which is outside both `eslint.config.js` and the root `tsconfig.json`, so it would be neither linted nor typechecked — to `packages/swf/test/fuzz/`, with long-run hosting named as a P11 forward on `WP-140-07` | v1.6 |
| 2 | `IMPL-010` §8 | The normative allocation/copy counter contract: `R043` (an instrumented per-site counter is the proof; a heap delta is a secondary guard only), `R044` (measured interval, warm-up and exclusions stated in the test), `R045` (counted classes enumerated separately for `T-SWF-017`'s hot-read objects and `SWF-R001`'s payload copies; the 5 MiB input generated in memory; the measurement may drive but not change P1) | v1.6 |
| 3 | `IMPL-010` §8, §10 | The primitive-consumer register — `FLOAT16` → tag 73, `UI24` unconsumed with **P10 consuming the register**, `SI24` does not exist, `UI64`/`FLOAT64` have no consumer — and §10 items 3–4 closed on it | v1.6 |
| 4 | `IMPL-010` §11 | Criterion 1 records the delivered browser lane and names what is still open; criterion 4 cites the counter contract instead of an unnamed "allocation counter" | v1.6 |
| 5 | `IMPL-140` §1, §10 | Deliverable 6 and `WP-140-07` now **host** the raw-reader target, and `Depends` names `WP-010-12` — so the reciprocal coupling sits in a table both tools read instead of in prose | v1.2 |
| 6 | `IMPL-020` §10 | `IMPL-020-R038` replaces the sentence that contradicted the 21 committed binaries: three sanctioned roles for a committed fixture (upstream byte-exact authority; materialised output of a committed generator; retained crasher), forbidding only *unaccounted-for* opaque bytes. All 20 `fixtures/static/*.swf` verified byte-identical to `static-fixtures.ts`'s output — and the fact that **no test asserts that equality** is recorded as the inventory artifact's job, not glossed over | v1.5 |
| 7 | `errata.md` | `E-004` re-opened under its own clause and corrected; `E-033` filed (**open**) for the §8 `UI32` row | 2.7 |
| 8 | `tools/audit_dev.py` | `check_dependency_direction()` with `DOC_PHASE` and `DISPOSITIONED_INVERSIONS`: fails on an undispositioned inversion, a stale disposition, a dangling `Depends` id, or a row with no resolvable phase. Ten unit tests including the negative controls. `DEFERRED_FORWARD_PHASES` deliberately **not** widened to P11 — that set validates deferred *diagnostic* ownership and no entry maps to a P11 work package, so widening it would weaken the check for no consumer | — |
| 9 | `REPO` §6/§10, `TECH` §4.2/§4.3 | The `browser` CI stage recorded as delivered in its P0-owned minimal form with P11's matrix as the named extension; `TECH-R008`'s `test:browser` corrected to the command that actually exists (the documented `--browser && playwright test` form implies a separate Playwright suite that was never built — the lane runs inside vitest via `@vitest/browser`), plus `browser:probe`/`browser:install` | REPO 1.2, TECH 1.3 |
| 10 | `IMPL-010` §8 + `E-033` | The row is annotated `⚠ disputed, E-033` with the byte-derived value printed beside the transcribed one — annotated, never silently overwritten | v1.6, errata 2.7 |

Item 8's check then found an eleventh thing that was on nobody's list, on its first run:

| — | `IMPL-080` §11 | `WP-080-10`'s `Depends: WP-070-07` was **false**, not merely early. The delivered atlas pipeline (`apps/decompiler/src/assets/font-atlas.ts`) rasterises glyph outlines and packs deterministic monochrome PNG pages + JSON (`T-MOD-509`/`T-AST-023`) with no KTX2, no `.sfa` and no mip generation, so it consumes nothing from `WP-070-07`'s P6-owned re-encode ladder. The edge is removed and the KTX2/`.sfa` + mip half recorded as an explicit P6 forward — the same defect class P3's closeout removed from `WP-070-13` | v1.3 |

That is the argument for mechanising §4.3 rather than writing it down once: the hand measurement in
§3.4 was careful and still missed an edge, because it measured documents where the gate measures
*ownership*.

**What is left is implementation, not documentation.** After this pass every P0 blocker has an owner,
a definition, and a home in a document the gates check. Unchanged and still open: §8 vector
*completeness* (`WP-010-11`'s writer for `RECT`/`MATRIX`/`CXFORMWITHALPHA`), `T-SWF-009`'s inventory
artifact and `fixtures/PROVENANCE.md`, the reader fuzz target itself, the 10⁵ property test, the
`T-SWF-015/016` contract strengthening, the counter implementation, the 5 MiB measurement, the
diagnostic-literal lint rule, `E-033`'s upstream confirmation, and P11's three-engine matrix. **P0
remains In progress**, and roadmap §2's policy still requires a fresh P0 audit before that row moves.

### 10.5 What changed in the roadmap

`IMPL-000` Draft 1.19 → **1.20**, applying the supply-forward principle the user directed — a gate
input owned by a later phase is re-homed in the phase that needs it, and the later phase becomes a
consumer:

- **§4.1** the normative **supply-forward rule** and its five corollaries, with the P0←P10 case as the
  worked example: the 24-bit field inventory is P0-owned, `OffsetToAlpha UI24` is recorded there as the
  sole 24-bit consumer, and P10 consumes the register instead of supplying it. P0 waits on nobody.
- **§4.2** the four relocated capabilities with each later extender's scope named, plus the two scope
  rulings (the 5 MiB measurement may drive but not change P1; P0 does not inherit P11's matrix or
  corpus program).
- **§4.3** all eleven measured inversions dispositioned individually, and the undeclared P0↔P11 cycle
  broken by relocation rather than by declaration — leaving only the legal forward edge
  `WP-140-01` (P11) → `WP-010-12` (P0).
- **§4.4** the ten matching per-document edits, each traced to its disposition id.
- **§4.5** the `EncodedU32` defect of §10.2.
- **§4 graph** corrected to carry P12/P13, the inversions, and the relocations.
- **§6** P0/P10/P11 exit criteria rewritten against the new ownership; **§10** gains the direction
  rule; **§5** gains the P0-side test-infrastructure owner role; **§2** rows, bullets, and the
  verification snapshot re-measured to 2026-10-13.

**No phase status changed.** P0 remains **In progress**: roadmap §2's policy requires a fresh P0 audit
before that row may move, and §10.1–§10.4 leave `R-P0-02`'s vector completeness, `T-SWF-009/014/015/
016/017`, `WP-010-12`, and the diagnostic-literal rule open. Gates re-run after every edit above:
`spec:verify` `ISSUES: 0`, `test:audit` 78 OK, `audit:dev` `NEW FINDINGS: 0`, `tag:coverage` clean,
`lint` clean, `build`/`typecheck` clean, both test lanes green.

## Appendix A — the complete measured cross-document edge list

All 70 cross-document work-package edges, grouped by depending phase. `<=` reads "depends on".

```
P1  → P0    WP-020-01 'Signature detect + FWS/CWS open path'      <= WP-010-02 'Cursor core'
            WP-020-04 'Header parse + validation'                 <= WP-010-08 'RECT'
P2  → P0    WP-030-01 'Shared placement field reader'             <= WP-010-09 'MATRIX + decomposeMatrix'
P2  → P1    WP-030-01 <= WP-020-05 · WP-030-07 <= WP-020-05 · WP-030-08 <= WP-020-06
            WP-040-01 <= WP-020-10 · WP-040-04 <= WP-020-07 · WP-040-06 <= WP-020-04
            WP-040-13 <= WP-020-03
P2  → P3    WP-040-15 'StartSound controls + stream offsets'      <= WP-090-07 'SOUNDINFO + StartSound'   [inversion]
            WP-100-06 'DefineButtonSound'                         <= WP-090-07                            [inversion]
P2  → P4/P7 WP-040-09 'DefineScalingGrid + renderer handoff'      <= WP-130-08 'Gradients/fills/masks'    [inversion]
P2  → P5    WP-030-06 'CLIPEVENTFLAGS + CLIPACTIONS'              <= WP-050-01 'Action record framing'    [inversion]
            WP-030-12 'Sprite tag-set/naming model'               <= WP-050-05 'CFG + basic blocks'       [inversion]
            WP-100-04 'BUTTONCONDACTION chain'                    <= WP-050-03 'Operand readers'          [inversion]
P3  → P0    WP-060-01 'DefineShape* headers + bounds'             <= WP-010-09
            WP-070-01 'BitmapAsset + DefineBitsJPEG2/3/4'         <= WP-010-11 'Test writer + property tests'
            WP-080-03 'DefineFontInfo/2'                          <= WP-010-11
P3  → P1    WP-060-01 <= WP-020-05 · WP-070-01 <= WP-020-05 · WP-090-01 <= WP-020-05
P3  → P2    WP-090-07 <= WP-030-09 'Frame assembly'
P3  → P4/P7 WP-060-12 'Fill-rule plumbing → tessellation'         <= WP-130-04 'Display node/list'        [inversion]
            WP-060-14 'Spread/interpolation/focal plumbing'       <= WP-130-04                            [inversion]
P3  → P5    WP-080-11 'Subsetter (static + dynamic reachability)' <= WP-050-08 'Tier assignment'          [inversion]
P3  → P11   WP-070-14 'Morph corpus + endpoint/blend goldens'     <= WP-140-03 'Oracle runner'            [inversion]
P5  → P1    WP-050-01 <= WP-020-05 · WP-050-14 <= WP-020-07 · WP-050-15 <= WP-020-04
P6  → P1    WP-120-01 'Pipeline runner'                           <= WP-020-10 'SwfFile facade'
P6  → P2    WP-120-06 'Frame-script grouping/hoisting'            <= WP-030-09
P6  → P3    WP-120-07 'Asset planner + encoding scheduler'        <= WP-070-07, WP-080-10, WP-090-10
P6  → P5    WP-120-03 <= WP-050-08 · WP-120-04 <= WP-050-09 · WP-120-05 <= WP-050-10 · WP-120-09 <= WP-050-08
P6  → P10   WP-120-07                                             <= WP-110-06 'Packet-header validation' [inversion]
P10 → P1    WP-110-01 'DefineVideoStream + VideoFrame'            <= WP-020-05
P11 → P0    WP-140-01 'Writer core: movie/tag builders, defects'  <= WP-010-12 'Reader fuzz target'       ← B1
P12 → P4/P7 WP-150-10 <= WP-130-16
P12 → P5    WP-150-09 <= WP-050-16
P12 → P6    WP-150-01 <= WP-120-10, WP-120-11 · WP-150-02 <= WP-120-08 · WP-150-03 <= WP-120-05
            WP-150-04 <= WP-120-08 · WP-150-08 <= WP-120-11
P13 → P2    WP-160-05 <= WP-100-05        P13 → P3   WP-160-06 <= WP-090-07
P13 → P4/P7 WP-160-10 <= WP-130-08        P13 → P5   WP-160-01/03/04 <= WP-050-08/11/14
P13 → P6    WP-160-01 <= WP-120-01        P13 → P11  WP-160-12 <= WP-140-03
P0  → (nothing)
```

Phase-owner annotations already present in the P3 documents (`060`/`070`/`080`/`090`), which doc 010 lacks:

```
P3: 45 WPs   P4: 2 (WP-060-12, WP-060-14)   P6: 6 (WP-070-06…09, WP-080-11, WP-090-12)
P8: 1 (WP-090-09)   P9: 1 (WP-080-12)
```

## Appendix B — reproduction and evidence index

**Regenerate the graph** (no dependencies required; standard library only):

```bash
cd /home/user/swf-forge
grep -rn "^| WP-" docs/impl/*/*.md | wc -l                    # 211 work-package rows
grep -rn "^| WP-.*WP-010" docs/impl/*/*.md                     # every edge into doc 010 (7 dependents)
grep -n "^| WP-010" docs/impl/foundation/010-binary-io-and-records.md   # P0's own rows: no external Depends
```

Parse each row's `Depends` cell for `WP-\d{3}-\d{2}`, map the 3-digit document number to a phase via roadmap §2's phase→document table, then count edges where the depending phase precedes the depended-on phase. `tools/audit_dev.py::work_package_phases()` already performs the row parse and reads the `Phase owner` column; it is the natural home for a permanent inversion check (see D-P0-DEP-03).

**Key evidence, by claim:**

| Claim | Location |
| --- | --- |
| P0 out-degree 0 | `docs/impl/foundation/010-binary-io-and-records.md` lines 586–597 |
| `WP-140-01` depends on `WP-010-12` | `docs/impl/harness/140-conformance-harness.md` line 201 |
| Doc 140 has no raw-reader fuzz WP | same file, §1 deliverable 6 and `WP-140-07` (line 207) |
| `tools/**` ungated | `eslint.config.js` `ignores`; root `tsconfig.json` `references` |
| Browser lane specified but unscheduled at P0 | `docs/specs/foundation/010-repository-and-toolchain.md` lines 139 (§6 tooling), 205 (§10 CI stages); `docs/TECH-SPEC.md` lines 295 (§4.1 `test:browser`), 312 (§4.2 browser mode), 325 (§4.3 `browser` stage); `vitest.config.ts`; `.github/workflows/ci.yml` |
| `IMPL-010` §11.1 browser requirement | `docs/impl/foundation/010-binary-io-and-records.md` line 612 |
| Allocation counter unspecified | `docs/impl/foundation/010-binary-io-and-records.md` line 548; roadmap §6 P0 row line 218 |
| P4's instrumented counter precedent | `packages/gfx/src/render/stats.ts` line 41; `packages/gfx/test/static-render.test.ts` lines 299–315 (`T-GFX-021`) |
| CI counters sanctioned | `docs/specs/quality/090-conformance-testing.md` line 229 (`TST-R016`) |
| `SWF-R001` 5 MiB copy bound | `docs/specs/format/030-swf-format-and-io.md` lines 20–23 |
| Payload-owning paths | `packages/swf/src/io/cursor.ts` lines 186–197 (`takeBytes`/`viewBytes`); `packages/swf/src/container/*`; `packages/swf/src/tags/control.ts` lines 371, 412 |
| Guardrail against P1 work | `audits/P0-AUDIT-RESOLUTION.md` §1 item 5 |
| Fixture classes / committed-fixture policy | `docs/specs/quality/090-conformance-testing.md` §3.1, lines 48, 68; `docs/specs/foundation/010-repository-and-toolchain.md` line 177 (`REPO-R017`) |
| "not committed as opaque binaries" | `docs/impl/foundation/020-container-tag-stream-dictionary.md` §10 Fixture construction |
| In-repo corpus counts | `fixtures/` (21 `.swf`), `packages/swf/src/test-support/static-fixtures.ts` (20 names), `packages/swf/test/fuzz/corpus/` (5) |
| `FLOAT16` consumer | `docs/specs/reference/110-appendices-reference-tables.md` lines 71, 726; `docs/impl/decompiler/080-fonts-and-text.md` line 294; `packages/swf/src/tags/fonts.ts` lines 599–600; `packages/swf/test/font-aux-tags.test.ts` lines 120–125, 336 |
| `E-004` re-open clause | `docs/impl/registers/errata.md` line 65 |
| `SI24` negative / only `UI24` consumer | `docs/impl/decompiler/110-video.md` line 252; `docs/specs/reference/110-appendices-reference-tables.md` line 981; `packages/swf/src/io/integers.ts` line 25 (`u24`, unconsumed) |
| P3's forward-declaration pattern | `audits/P3-AUDIT-RESOLUTION.md` §4; `audits/P3-C7-AUDIT.md` ("fixed WP-070-13's accidental P6 dependency") |
| `DEFERRED_FORWARD_PHASES` excludes P11 | `tools/audit_dev.py` line 673 |
| Acceptance-layer cycle precedent | `audits/P4-P5-BOTTLENECK-INVESTIGATION.md` §"Dependency analysis" |
| P5's genuine external blocks | `audits/P4-P5-BOTTLENECK-INVESTIGATION.md` §"P5 diagnosis"; roadmap §2 P5 bullet |

## Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-10-13 | Created. Four-layer dependency model; measured 211-WP / 70-edge cross-document graph with P0 out-degree 0; obligation-by-obligation input audit for all open P0 items; direct answer on P6 (no dependency, with negative evidence and the P3 `WP-070-13` precedent); six ranked bottlenecks B1–B6 (doc-140 ownership hole, unowned browser lane, undefined allocation contract, undefined fixture inventory, `R-P0-07` guardrail contradiction, `IMPL-010` §10 items 3–4); eight documentation-only dispositions D-P0-DEP-01…08; tripwires; evidence index. |
| 1.1 | 2026-10-13 | §10 resolution record added after the toolchain was installed and the gates re-measured: B2/D-P0-DEP-06 delivered as a working two-lane browser test lane (26 shared §8 vectors, pinned cross-engine fingerprint, CI `browser` job, registry-only engine installer); the `EncodedU32` ≥ 2³¹ spurious-`SF0009` reader defect it found, with cause, fix, and regression evidence; disposition status for all eight D-P0-DEP items; the new blocking §8 `UI32` documentation inconsistency, reported and carried forward rather than absorbed; and the `IMPL-000` Draft 1.20 roadmap changes (§4.1 supply-forward rule, §4.2 relocations, §4.3 inversion dispositions, §4.4 follow-ups, §4.5 defect). Front-matter evidence limitation and §1 verdict row updated to match. No phase status changed. |
| 1.2 | 2026-10-13 | §10.6 added: all ten roadmap §4.4 per-document follow-ups applied (`IMPL-010` v1.6, `IMPL-140` v1.2, `IMPL-020` v1.5, errata 2.7, `REPO` 1.2, `TECH` 1.3), plus the new automated `dependency-direction` check in `tools/audit_dev.py` with ten unit tests. That check found a twelfth inversion the §3.4 hand measurement could not see — `WP-080-10` (P3) → `WP-070-07` (P6) — and the delivered code showed the edge was false, so it was removed and the KTX2/mip half forwarded to P6 (`IMPL-080` v1.3). §3.2/§3.3/§3.4 corrected for the changed graph: doc 010 keeps out-degree 0 and gains an eighth *inbound* edge (`WP-140-07 → WP-010-12`, the harness-hosting relationship now declared in a table instead of prose); three of the eleven inversions are already resolved by `Phase owner` re-attribution and eight remain, all dispositioned. §10.3 marked superseded where it named a follow-up |
