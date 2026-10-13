# P4/P5 Bottleneck Investigation

- **Date:** 2026-10-11
- **Branch:** `arena/07fdceae-swf-forge`
- **Scope:** Current P4/P5 state, phase acceptance criteria, dependency graph, audit evidence, and the work needed to remove the schedule/acceptance blockers.
- **Decision status:** Route A recorded: P5 front-end acceptance; P7 executable runtime acceptance. This documents the phase boundary only; it does not close P5, waive criteria, or authorize byte-round-trip, runtime-owned, P6, or P7 implementation.

## Executive finding

There is **not a current P4 exit-gate failure**. P4 was historically bottlenecked by integration and evidence work—the production model-to-geometry path, browser surface, 20-fixture golden suite, performance expectations, and context-loss path—not by the absence of a renderer algorithm. The archived P4 diagnosis records that those gates were resolved. The remaining P4 forwards (gradients, bitmap fills, full stencil masks, filters, and WebGPU) are explicitly later-phase scope; adding them now would reopen P4 unnecessarily.

**P5 is the active phase bottleneck**, but not because the build or ordinary test suite is red. C0–C4 are complete as audit/evidence checkpoints; P5 itself remains open. The latest recorded engineering gates are green, including 62 test files / 718 tests, while the audit still records only **32/33 IMPL-050 obligations as test-cited**. A citation is not a pass: FE-030 is partial, FE-024 runtime execution is unwired, the repository corpus has no AVM1 action blocks, and P5-owned byte-round-trip/corpus evidence is missing. Runtime-owned language/interpreter/scheduling gates remain open for P7, not P5 closeout.

The original structural problem was a **phase-acceptance cycle**. P5 is defined as an AVM1 front end, and P6 depends on P5; P7 depends on P6. Yet the former roadmap P5 exit criteria included runtime semantics/interpreter work assigned to IMPL-130/P7. If P5 could not close until P7-owned tests passed, while P7 could not begin until P5 closed through P6, the phase gate could not be satisfied in the planned order. **Route A, recorded below, resolves that ownership cycle.** Separate from it, P5 still has genuine open requirements: a byte inverse surface, open-corpus/two-reviewer evidence, and an unresolved SWF≤5 `ActionStringLength` oracle.

The checkout contains no issue tracker, owner assignments, staffing history, or elapsed-time log. This investigation can identify **structural blockers and missing evidence**, but cannot calculate schedule slip or attribute it to staffing.

## Decision recorded — Route A

**Selected:** preserve the front-end/runtime phase boundary. P5 owns front-end acceptance under IMPL-050; P7/IMPL-130 owns executable runtime semantics, residual interpretation/instruction-budget, and runtime call/unwind/scheduling acceptance. The normative requirements and `T-AVM1-*` IDs in the language specification remain unchanged. No gate is waived or claimed passed.

P5 remains open for its own byte-round-trip inverse surface, open-corpus/two-reviewer evidence, and FE-030 `ActionStringLength` oracle. **Byte-round-trip scope is retained in P5, not deferred**; this follows the standing requirement that it remain a P5 blocker until resolved. Its existing fixed-point criterion remains open and FE-032 is not round-trip evidence. The runtime-owned gates remain mandatory for P7. This decision is documentation-only and does not authorize byte-round-trip, runtime, P6, or P7 implementation. The decisions are also recorded in [`P5-AUDIT-RESOLUTION.md`](P5-AUDIT-RESOLUTION.md).

## Current phase status

| Phase | Current evidence | Status and impact |
|---|---|---|
| **P4 — static render** | 20 no-script render goldens; `perf-static` draw/allocation and cold-tessellation budgets; WebGL2 demo; GL context-loss test. See [roadmap §2.2](../docs/impl/000-roadmap.md) and [P4 diagnosis](archive/P4-DIAGNOSIS.md). | **Exit gate green.** P4 is a prerequisite to P7, not a blocker to P5. Its static/no-VM scope is narrower than a playable runtime by design. |
| **P5 — AVM1 front end** | Tier-report CLI, opcode inventory/disassembly, synthetic fixtures, seeded mutation gate, restart probe, and C0–C4 audit artifacts. [P5 audit](P5-AUDIT.md) records 32/33 obligations test-cited; [P5 resolution](P5-AUDIT-RESOLUTION.md) keeps the phase open. | **Not exit-ready.** P5-owned byte round trip, open-corpus/two-reviewer evidence, and FE-030 remain open; P5 blocks P6 until those gates are resolved. |
| **P6 — emitter** | No implementation started, consistent with the current scope boundary. | Depends on P2, P5, and assets. The selected boundary lets P5 complete without pulling P7 runtime execution forward. |
| **P7 — first playable/runtime** | No runtime/interpreter execution evidence; runtime language, budget, call/unwind, and scheduling gates are owned by IMPL-130. | Depends on P4 and P6. It retains the executable runtime gates; none is claimed passed. |

## Dependency analysis

The implementation dependencies form two parallel paths that merge at P7:

```text
P0 → P1 → P2 ┬→ P3 media / Vector IR → P4 static renderer ──────┐
             │                                                   ├→ P7 first playable
             └→ P5 AVM1 front end → P6 emitter ─────────────────┤
                   P2 + P5 + assets → P6                         │
                   P4 + P6 → P7                                  ┘
```

This matches [roadmap §4](../docs/impl/000-roadmap.md): P4 consumes P3 Vector IR; P6 needs P2/P5/assets; P7 integrates P4 and P6. **P4 and P5 do not depend on one another**. P4 can complete in parallel with P5, as it has here.

Before the recorded decision, the graph was cyclic at the **acceptance** layer, not at the package-import/code layer:

```text
P5 closeout → P6 can proceed → P7 runtime can execute → P7-owned AVM1 gates pass
      ▲                                                        │
      └──── former P5 phase gate included those runtime gates ──┘
```

**Route A breaks that acceptance cycle.** The roadmap now assigns `T-AVM1-008/009/012/025` to P7 runtime acceptance, `T-AVM1-027` to P7 interpreter/budget acceptance, and runtime execution of FE-024/025/027/028 to IMPL-130. The language-spec requirements remain normative. P5 retains its independent byte-round-trip, open-corpus/two-reviewer, and FE-030 criteria; P5 still blocks P6 until its own gates are resolved.

## P4 diagnosis: historical bottleneck, now resolved

The [archived P4 diagnosis](archive/P4-DIAGNOSIS.md) identifies three actual blockers at the start of P4 closeout:

| Historical gap | Why it stalled P4 | Resolution/evidence now present |
|---|---|---|
| No production `VectorShape → ShapeGeometry → draw items` bridge | The available conversion lived in a test adapter, so a user-facing golden/render path could not exercise the production boundary. | Production conversion is in `apps/decompiler/src/render/vector-ir.ts`; scene construction and render CLI feed the browser and golden path. |
| No browser surface | A CPU oracle alone did not meet the roadmap demo outcome. | `apps/engine-flash` mounts the WebGL2 renderer and loads the static-scene bundle generated by `forge-decompile render --demo`. |
| Missing bound evidence for budgets/corpus/context loss | Existing tests were not enough to prove the exact 20-scene corpus, stable budget bounds, cold tessellation, and context recovery. | 20 committed static goldens, `perf-static.expect.json`, T-GFX-051 and T-GFX-060 tests provide repeatable gates. |

The false lead was that no performance test existed: a test was already present; the real gap was canonical inputs, expectations, and documentation. This is why the diagnosis calls P4 a **last-mile integration/evidence bottleneck**, not a missing-algorithm bottleneck.

P4's current open work is intentionally deferred to P9: gradients/bitmap paints/full stencil masks (WP-130-08), filters (WP-130-09), and WebGPU (WP-130-17). The test-local adapter remains only for the Appendix-A gate; routing that fixture through the production bridge is useful cleanup, but is not listed as a P4 exit failure. P4 also does not supply an AVM1 runtime or make the no-script browser demo a “first playable” title; those are P7 integration outcomes.

Planning estimates in the roadmap are **60–90 developer-days for P4**, described as the largest single subsystem. They are estimates, not measured elapsed effort. P7's 50–75 day estimate reserves 20–30% for integration, consistent with the roadmap's warning that the P4/P6 merge is a major risk even though P4 itself is green.

## P5 diagnosis: active blockers

| Blocker | Evidence and dependency | Why it delays P5/P7 | What resolves it |
|---|---|---|---|
| **Gate ownership / circular phase acceptance** | Formerly, the P5 roadmap row required runtime coercion/enumeration/format gates. The P5 audit assigns them to IMPL-130 (`T-AVM1-008/009/025` → WP-130-02; `T-AVM1-012` → WP-130-01/T-RT-121; `T-AVM1-027` → WP-130-12). | This was a gate dependency cycle because P5→P6→P7, while the P5 exit gate required P7 execution. | **Resolved by Route A:** P5 accepts front-end behavior; P7 owns executable runtime gates. The semantic requirements and tests remain mandatory; no runtime pass is inferred from P5 literal-fold tests. |
| **No byte inverse path** | IMPL-050 §13 and roadmap §6 require bytes→IR→disassembly→bytes; FE-032 currently proves one-way bytes→IR→text. There is no disassembly parser or action-byte serializer, and WP-050-16 explicitly does not imply one. | A retained P5 criterion has no implementation surface or owned work package yet. More tests against the current disassembler cannot satisfy it. | **Scope decision: retain this as a P5 exit gate; do not defer it.** Before implementation, define a lossless inverse format and byte-identity contract for every defined opcode, then add a separately scoped/estimated P5 work package. FE-032 remains one-way and is not a pass.
| **No open-corpus T2 review / second reviewer** | C4 ran 26 local SWFs twice, but every report has zero action blocks, functions, and T2 reasons. A targeted GitHub screen found an unlicensed AS2 SWF, source-only or non-SWF projects, and a GPL-licensed AS3 project; no candidate met the licensed/provenanced open-title criterion. No independent reviewer participated. | More runs on the empty local corpus do not help; this requires suitable licensed inputs and a second person. | Obtain a licensed/provenanced ActionScript-bearing title corpus, pin hashes/provenance, generate stable per-function tier reports, and have an independent reviewer disposition observed T2 reasons. The screen is documented in `P5-AUDIT-RESOLUTION.md`; it is not an exhaustive search or a pass. |
| **FE-030 lacks an oracle for `ActionStringLength` in SWF≤5** | Adobe SWF v19 establishes locale-dependent ANSI/Shift-JIS decoding and `MBStringLength` character counting, but does not state `StringLength` units. The raw Shift-JIS fixture pins decoding and the safe `MBStringLength` fold only. Ruffle leaves SWF-5 byte length as a TODO; Lightspark uses character count but explicitly marks `MBStringLength` unimplemented. Neither is an Adobe Flash oracle; see [P5 resolution](P5-AUDIT-RESOLUTION.md). | A test-cited FE-030 is still only partial. Guessing byte/character units would create an unsupported constant-folding claim. | Use an authoritative source or a controlled original Flash Player SWF-5 probe in a documented locale/platform, recording raw bytes, player/version, output, and `MBStringLength` control. Until then, keep non-ASCII `StringLength` dynamic and FE-030/P5 open. |
| **Runtime scheduling/call/exception behavior is stated beside front-end obligations** | FE-024/025/027/028 prove IR or schedule metadata only; frame execution, resumption, unwind, and runtime ordering remain open. | Treating metadata as execution would falsely close a runtime gate. | **Ownership resolved:** front-end representation/metadata is P5; observable execution assertions are P7/IMPL-130. The runtime work remains unimplemented and open. |
| **Progress reporting is stale/inconsistent** | Before this resolution, `docs/impl/000-roadmap.md` §2.2 said C4 was “not started” and listed an older focused-suite count; its high-level P5 row also mixed runtime gates into front-end acceptance. | Stale status could confuse checkpoint completion with phase completion and imply a false completion percentage. | **Reconciled in this step:** roadmap marks C0–C4 complete as audit/evidence checkpoints, P5 still open, and P7 runtime gates separately. The 32/33 citation count is explicitly not a completion percentage. |

### Why green tests have not removed the bottleneck

The latest recorded full suite is 62 files / 718 tests, and build/typecheck/lint/spec verification are green. Those results show that the exercised implementation is stable; they do not establish behaviors for absent runtime execution, absent byte serialization, absent real corpus T2 rows, or an unresolved legacy string oracle. The audit's 32/33 figure means “test-cited,” not “all but one passed.” FE-030 demonstrates this distinction directly: the citation is present, while the required byte/character result remains unknown.

## Resolution plan, in dependency order

### 1. Make one phase-boundary decision before adding implementation — DONE

**Decision recorded: select Route A, preserving the intended front-end/runtime boundary.** P5 exit criteria are front-end-owned; runtime semantics/interpreter/scheduling execution gates are P7-owned. The normative AVM1 language requirements remain unchanged. P5 does **not** automatically close: its byte-round-trip, open-corpus/two-reviewer, and FE-030 criteria remain open. The alternative route—replanning runtime foundations before P6—is not selected.

No test is waived or marked passed from frontend evidence, and no byte-round-trip, runtime, P6, or P7 implementation is authorized by this decision.

### 2. Split the remaining P5 work by kind of dependency

- **Code/design decision — scope resolved:** retain the byte-round-trip criterion in P5; it is not deferred. The current bytes→IR→disassembly→bytes fixed-point requirement remains open. Before implementation, define lossless parse/serialization details and byte-identity coverage for all defined opcodes, then add a separately scoped and estimated P5 work package. No parser, serializer, or tests are implemented in this step.
- **External evidence:** secure the scripted open corpus and an independent reviewer before reserving a T2-review closeout window.
- **Oracle/research:** resolve FE-030 from Adobe/Flash Player evidence, or preserve the conservative dynamic behavior and formally record that the exact result is deferred. Do not infer the answer from `MBStringLength`, font flags, `LanguageCode`, or Ruffle's incomplete SWF-5 path.
- **Runtime handoff:** keep frame-call execution, exception unwinding, enumeration order, coercion/formatting, and instruction-budget behavior assigned to the runtime owner. Front-end metadata is not a substitute.

These can be prepared in parallel after owners are named, but they are not interchangeable gates.

### 3. Correct the source of truth and track ownership — phase boundary/status aligned

This step updates roadmap §2/§2.2/§6, IMPL-050 §13, IMPL-130, the P5 checkpoint/audit/resolution records, and this investigation so that:

1. P4 remains closed for static/no-script rendering, with P9 forwards deferred.
2. P5 C0–C4 are marked **complete as audit/evidence checkpoints**, while the P5 phase remains **open**.
3. P5 front-end acceptance and P7 runtime acceptance are separately recorded, without changing normative AVM1 requirements or claiming runtime tests passed.
4. Remaining P5 evidence needs and P7 runtime forwards are visible. The phase owner is assigned by these docs; no individual owner or due date is invented.

The roadmap's former C4 and acceptance mismatch is corrected; this status-record change does not close P5.

### 4. Protect the P4/P6→P7 merge from becoming the next bottleneck

Do not add P9 renderer features to “finish P4.” Keep P4's no-script goldens, budget fixture, and context-loss gate stable. Before P7 integration, close the small Appendix-A test-adapter/production-bridge duplication and allocate the planned 20–30% P7 integration time. Make the first-playable acceptance use a real open-corpus title through P6 output, P4 rendering, and P7 runtime rather than a static-scene demo alone.

## Recommended immediate sequence

1. **Done — record the phase-boundary decision:** Route A is reflected in the roadmap, IMPL-050/130, and P5 checkpoint/audit/resolution records. No runtime implementation or gate closure occurred.
2. **Done — retain the byte-round-trip criterion in P5:** it is not deferred. The inverse parser/serializer remains unimplemented; define its lossless contract and add/estimate a dedicated P5 work package before implementation.
3. **Evidence work attempted; blockers remain:** the targeted GitHub screen found no admissible licensed/provenanced title corpus, and no independent reviewer was obtained. The Lightspark cross-check is not a Flash Player oracle; FE-030 remains open. Next requires an approved corpus source, a human second reviewer, and authoritative/original-player evidence. Keep the conservative analyzer behavior unchanged.
4. **Close only authorized P5-owned items:** add any implementation only after the corresponding scope is authorized and assigned; keep P5 open where evidence is still missing.
5. **Schedule downstream phases only after P5 exit:** P4 is ready, but a first playable still requires P6 emitter, P7 runtime execution, and corpus integration; reserve the planned P7 integration capacity.

## What this investigation does not conclude

- It does not estimate actual calendar delay; the repository has no staffing, issue-aging, or task-throughput data.
- It does not identify P4 as a current phase blocker. P4's exit gate is recorded green; future renderer work is either P7 integration or P9 fidelity scope.
- It does not claim P5 is complete or that its remaining requirements can be resolved by code changes alone.
- It does not implement the byte round trip, runtime-owned behavior, P6, or P7.
