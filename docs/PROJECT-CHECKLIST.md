# swf-forge project completion checklist

**Status snapshot:** 2026-10-12

**Basis:** [`docs/impl/000-roadmap.md`](impl/000-roadmap.md) Draft 1.19, phase audits through 2026-10-11, and the owning implementation/design specs linked below.

This is a non-normative, phase/acceptance-level roll-up of remaining work, not a new specification or a duplicate work-package ledger. The roadmap and per-area specs remain authoritative; use their work-package and test tables for detailed breakdowns. Check an item only when its full phase-owned outcome has evidence and the relevant gate passes. Code presence or a test citation alone is not enough. This checklist does not authorize implementation.

## Current phase status

| Phase | Status | Disposition |
| --- | --- | --- |
| P0 — Foundations | **In progress** | Acceptance evidence remains open; see [P0 audit](../audits/P0-AUDIT.md) and [resolution plan](../audits/P0-AUDIT-RESOLUTION.md). |
| P1 — Container & dictionary | **Completed** | Exit-ready with explicit non-blocking deferrals; see [P1 audit](../audits/P1-AUDIT.md) and [resolution](../audits/P1-AUDIT-RESOLUTION.md). |
| P2 — Model & timeline | **Completed** | See [P2 audit](../audits/P2-AUDIT.md) and [resolution](../audits/P2-AUDIT-RESOLUTION.md). |
| P3 — Media decode & build assets | **Completed** | C7 checkpoint and phase closeout are complete; see [P3 audit](../audits/P3-AUDIT.md) and [resolution](../audits/P3-AUDIT-RESOLUTION.md). |
| P4 — Static render | **Completed** | Exit gates are green; later renderer fidelity belongs to P9. See [P4 diagnosis](../audits/archive/P4-DIAGNOSIS.md). |
| P5 — AVM1 front end | **In progress** | C0–C4 are complete, but P5 still has the three highlighted open criteria below plus any other open P5-owned obligations; see [P5 resolution](../audits/P5-AUDIT-RESOLUTION.md). |
| P6 — Emitter | **Not started** | Phase-specific delivery and acceptance remain. |
| P7 — First playable/runtime | **Not started** | Executable AVM1 semantics and runtime gates remain mandatory. |
| P8 — Audio runtime | **Not started** | Playback, scheduling, and synchronization remain; P3 decode/build work does not close them. |
| P9 — Fidelity hardening | **Not started** | P4 is the static baseline; P9 rendering/text fidelity work remains. |
| P10 — Video & long tail | **Not started** | Video playback and system/long-tail behavior remain. |
| P11 — Release engineering | **In progress** | CI and short smoke gates exist; release gates remain open. |
| P12 — Inspector | **Not started** | Design exists; implementation and acceptance remain. |
| P13 — Clean engine | **Not started** | Design exists; implementation and acceptance remain. |

“Completed” means the audited phase exit is green, not that every work package is closed. Accepted follow-ups for a completed phase are tracked separately below. Likewise, “in progress” and “not started” are phase states, not completion percentages.

## Open phase gates

### P0 — Foundations

See the [P0 audit](../audits/P0-AUDIT.md) and follow its [ordered resolution plan](../audits/P0-AUDIT-RESOLUTION.md) for the evidence and closure procedure. Remaining work includes:

- [ ] Complete primitive-vector/browser evidence, including the missing `T-SWF-009`, `T-SWF-014`, and `T-SWF-017` obligations; complete the partial `T-SWF-015/016` recovery/error assertions.
- [ ] Measure the separate ≥5 MiB SWF-R001 payload-copy budget; do not substitute view/memoization tests or a heap-size delta.
- [ ] Deliver or formally disposition the low-level reader fuzzer in `WP-010-12`, and add the missing diagnostic-literal lint enforcement.
- [ ] Disposition the remaining low-risk `FLOAT16` consumer and `SI24` questions, then obtain a fresh P0 closeout audit.

### P5 — AVM1 front end

Sources: [IMPL-050](impl/transpiler/050-actions-and-avm1.md) §13, [P5 audit](../audits/P5-AUDIT.md), and [P5 resolution](../audits/P5-AUDIT-RESOLUTION.md).

- [ ] **Byte round trip:** define the lossless inverse format and byte-identity acceptance for every defined opcode, and add a separately scoped/estimated P5 work package. Only after that contract and implementation are explicitly authorized, implement and prove bytes → IR → disassembly → bytes. FE-032 is one-way and does not pass this gate.
- [ ] **Open corpus and two reviewers:** obtain a licensed/provenanced corpus of titles with actual AS1/AS2 action blocks, preserve per-function tier/reason reports, and have two people independently review the T2 reasons with scope/provenance recorded. Synthetic fixtures alone do not pass this criterion.
- [ ] **FE-030 oracle:** resolve SWF≤5 `ActionStringLength` units/behavior with an authoritative source or a documented original-Flash-Player probe. Emulator cross-checks are not an Adobe oracle.
- [ ] Close P5 only after the three highlighted criteria and all other P5-owned acceptance obligations in IMPL-050 pass.

**Ownership boundary:** P5 owns `T-AVM1-FE-*` front-end acceptance. P7 owns executable runtime `T-AVM1-*` obligations, including `T-AVM1-008/009/012/025/027`, interpreter/budget behavior, and runtime call/unwind/scheduling. Front-end IR or scheduling-metadata tests do not satisfy those runtime gates.

### P6 — Emitter

Sources: [roadmap](impl/000-roadmap.md), [IMPL-120](impl/transpiler/120-compiler-and-emitter.md), and [CMP](specs/foundation/020-compiler-pipeline.md).

- [ ] Deliver the compiler/emitter pipeline, analysis and asset planning, generated project/reports, `build`/`verify` CLI, cancellation, and failure handling described by IMPL-120.
- [ ] Pass P6 acceptance: strict compilation with zero suppressions, clean verification, complete manifest/reports, and deterministic output; satisfy `T-CMP-001…008` and `T-AVM1-026` as specified.

### P7 — First playable and executable runtime

Sources: [roadmap](impl/000-roadmap.md), [IMPL-130](impl/engine-flash/130-runtime-and-renderer.md), [AVM1 language spec](specs/language/040-avm1-to-typescript.md), and [runtime shell spec](specs/web/080-runtime-shell.md).

- [ ] Implement the normative AVM1 runtime object model, coercions/operators, property/prototype/enumeration behavior, and required host APIs; pass runtime `T-AVM1-008/009/012/025` and `T-RT-121`.
- [ ] Implement residual interpretation and instruction budgets; pass `T-AVM1-027`.
- [ ] Prove **execution** of frame calls/resumption, exception unwinding, and `DoInitAction`/`DoAction` ordering, plus the display-list/timeline, shell, and host integration. Decoded IR or metadata alone is not evidence.
- [ ] Reach C1 on three suitable open-corpus titles and pass the runtime/end-to-end gates, including the first-60-frames, error, and budget criteria in the owning specs.

### P8 — Audio runtime

Sources: [roadmap](impl/000-roadmap.md), [IMPL-090](impl/decompiler/090-sounds.md) runtime scope, [IMPL-130](impl/engine-flash/130-runtime-and-renderer.md), and [AUD](specs/web/060-audio-web.md).

- [ ] Deliver event/stream playback, deterministic scheduling and voice handling, Web Audio/worklet integration, and frame-boundary sync with no click artifacts.
- [ ] Pass the audio runtime suite and budget; keep stream drift **≤12 ms over 10 minutes**, including jumps (`T-AUD-027`). P3 codec decode, WAV previews, and sample-offset metadata are not playback evidence.

### P9 — Fidelity hardening

Sources: [roadmap](impl/000-roadmap.md), [IMPL-130](impl/engine-flash/130-runtime-and-renderer.md), the relevant [decompiler specs](impl/README.md), [GFX](specs/web/050-graphics-webgl.md), and [AST](specs/web/070-assets-fonts-bitmaps-video.md).

- [ ] Complete the P9 renderer fidelity scope: gradient/bitmap fills, blends, masks, filters and cache invalidation, plus the planned WebGPU backend behind its feature flag.
- [ ] Complete dynamic-text/layout, input/IME and device-font behavior; pass rendering, asset-fidelity, and hit-testing gates at their declared tolerances (`T-GFX-010…041` and applicable `T-AST-*`).

### P10 — Video and long tail

Sources: [roadmap](impl/000-roadmap.md), [IMPL-110](impl/decompiler/110-video.md), [AST](specs/web/070-assets-fonts-bitmaps-video.md), and [RT](specs/web/080-runtime-shell.md).

- [ ] Complete video decoding/transcode delivery with provenance and preserved frame timing; pass `T-AST-021` (including the roadmap's SSIM ≥0.98 comparison against source decode).
- [ ] Resolve and test supported codec/player cases and the `fscommand`, `System.capabilities`, and `ExternalInterface` mappings (`T-RT-013`); unsupported behavior must remain explicit and diagnosed.

### P11 — Release engineering and conformance harness

Sources: [roadmap](impl/000-roadmap.md), [IMPL-140](impl/harness/140-conformance-harness.md), [TST](specs/quality/090-conformance-testing.md), and [SEC](specs/quality/100-security-licensing.md).

- [ ] Complete the full harness/oracle metrics, gate and waiver flows, provenance-aware goldens, fuzz coverage, and coverage accountability required by IMPL-140; short PR smoke is not a substitute for full-duration evidence.
- [ ] Establish 24-hour fuzz history with zero crashes; pass the full security suite and complete the third-party/license record.
- [ ] Enforce bundle, texture, audio, and manifest budgets on both baselines; complete three-engine browser CI, release docs/examples, and C2 acceptance for three titles of differing profiles. Keep divergence decisions and waivers recorded.

### P12 — Inspector

Sources: [IMPL-150](impl/code-inspector/150-code-inspector.md), [INS](specs/components/120-code-inspector.md), and the [CMP source-map contract](specs/foundation/020-compiler-pipeline.md).

- [ ] Deliver project open/validation and provenance-aware model/indexing for supported directory, ZIP, and served-project inputs, with worker budgets and cancellation.
- [ ] Deliver explorer/editor/highlighting, SWF↔TypeScript navigation, timeline and diagnostics/report views, run view/frame stepping, and the `forge-inspect serve` workflow.
- [ ] Pass `T-INS-101…114`, three-browser budget tests, security hygiene, and the required golden/degradation cases.

### P13 — Clean engine

Sources: [IMPL-160](impl/engine-clean/160-engine-clean.md) and [CLN](specs/components/130-engine-clean.md).

- [ ] Deliver the evidence-bearing transformation/tiering policy, clean-project emitters, rewrite log, migration report, and refusal behavior.
- [ ] Deliver the fixed-step clean runtime and `forge-clean` CLI; preserve the Flash target on refusal and prove deterministic/identical output across the supported input paths.
- [ ] Pass the clean-engine vocabulary, refusal, runtime budget, determinism, hygiene, and probe gates `T-CLN-101…114` on declared clean-ready titles.

## Accepted completed-phase deferrals

These are tracked follow-ups, **not open P1 exit gates**. Respect the recorded owner/trigger; do not silently claim them implemented.

| Follow-up | Current disposition | Trigger / next action |
| --- | --- | --- |
| Standalone `swffuzz` CLI/tooling (`WP-020-11`) | Deferred; the in-repo 10⁴ mutation smoke gate runs | Revisit under doc 140, or retain the reviewed deferral with an owner. |
| Streaming LZMA | Pinned deviation; input-size pre-bound mitigation exists | Revisit if a suitable streaming dependency is approved. |
| Full-scale 512 MiB absolute-RSS test | Deferred to doc 140; marginal-RSS test is the accepted current gate | Add only with an agreed CI memory/stability budget. |
| Synchronous-zlib partial yield | Platform limitation is pinned; async path supplies partial bytes | Revisit only if the platform/API or acceptance contract changes. |
| Chapter 2 source-confirmation errata | Explicit doc-only open items in IMPL-020 §12 | Resolve when authoritative chapter wording is available. |

## Release-level completion

The product is not ready for v1.0 until the roadmap's release definition is satisfied:

- [ ] Three titles of differing profiles reach C2 with divergences and decision IDs recorded.
- [ ] Clean-checkout build succeeds in one command and produces deterministic output.
- [ ] Performance and bundle budgets pass on desktop and mobile baselines, or have documented waivers.
- [ ] Three-engine browser matrix is green, with skips documented.
- [ ] Security suite is green and `THIRD_PARTY.md` is complete.
- [ ] Every design decision is settled or explicitly accepted; no un-triaged decision remains.
- [ ] `docs/impl/registers/errata.md` is current.

## Source of truth and update rules

- Use [`000-roadmap.md`](impl/000-roadmap.md) for phase status, sequencing, dependencies, and exit criteria.
- Use the owning specs' work-package and test tables for detailed engineering tasks; this roll-up does not track individual WPs.
- Treat [`impl/registers/STATUS.md`](impl/registers/STATUS.md) as generated spec-coverage information, not an implementation completion percentage.
- Update this roll-up alongside relevant evidence/audits. Never reclassify runtime work as front-end coverage or close a phase from a test citation alone.
