# P5 Audit Resolution — C4 Closeout

- **Date:** 2026-10-11
- **Branch:** `arena/07fdceae-swf-forge`
- **Source audit:** [`P5-AUDIT.md`](P5-AUDIT.md)
- **Checkpoint evidence:** [`P5-C4-AUDIT.md`](P5-C4-AUDIT.md), [`P5-C4-CORPUS.json`](P5-C4-CORPUS.json), [`P5-C4-RESTART-PROBE.json`](P5-C4-RESTART-PROBE.json)

## 1. Resolution decision

**Decision: adopt the recommended Route A phase boundary.** P5 owns front-end acceptance under IMPL-050; executable runtime language semantics, residual interpretation/budget, and runtime call/unwind/scheduling acceptance belong to P7/IMPL-130. The normative AVM1 requirements and `T-AVM1-*` IDs in `docs/specs/language/040-avm1-to-typescript.md` are unchanged. Runtime behavior remains mandatory and open; moving its acceptance does not waive tests or claim a pass.

**Byte-round-trip scope decision: retain it as a P5 exit criterion; do not defer it.** The existing bytes→IR→disassembly→bytes fixed-point requirement remains open. FE-032 is one-way evidence only. Before implementation, define a lossless inverse format and byte-identity coverage for every defined opcode and add a separately scoped/estimated P5 work package. No parser, serializer, or round-trip test is implemented by this resolution.

**P5 remains OPEN; the phase is not closed.** C0–C4 audit/evidence checkpoints are complete, but P5-owned criteria remain open: the byte-round-trip inverse surface, an open ActionScript corpus with two-reviewer T2 evidence, and FE-030's unresolved `ActionStringLength` oracle. FE-024/025/027/028 runtime execution forwards and T-AVM1-008/009/012/025/027 are P7 gates, not P5 closeout blockers. This boundary and scope decision does not authorize byte-round-trip, P6, or P7 implementation.

The checkpoint plan must show C4 as **complete as an audit/evidence checkpoint, with P5 closeout blocked**. It must not label the P5 phase itself complete.

## 2. Resolution of C4 observations

### Corpus and T2 review

- The built CLI was run twice in fresh Node processes over all 26 repository SWFs. All 26 JSON outputs, exit codes, and standard-error bytes matched on repeat; reports are preserved in `P5-C4-CORPUS.json`.
- Every available SWF report contains zero action blocks/functions. Therefore, no C4 corpus T2 reason exists to disposition. Record this as **no applicable T2 rows in this local corpus**, not as T2 classification coverage or a P5 corpus pass.
- The repository inputs are an Appendix A conformance fixture, 20 synthetic no-script static fixtures, and five malformed parser-fuzz crashers. They do not constitute an open corpus of titles.
- Only one audit pass was conducted. A second independent human review was not obtained. The two-reviewer requirement remains open.

### IMPL-050 obligations and WPs

- `audit_dev.py --json --no-probe` reports **32/33 test-cited** after the FE-030 source/fixture follow-up; FE-024 remains scheduled/unwired. Its runtime frame-execution/resumption behavior is forwarded to P7 and does not block P5 front-end acceptance. FE-030's citation covers only the spec-bounded frontend case and does not establish the exact `ActionStringLength` result or close the P5 obligation. The mechanical citation count is not a completion percentage. The C4 snapshot, follow-up, and all 17 WP-050 rows are in `P5-C4-AUDIT.md`.
- Follow-up P5 work adds the FE-005 function-only pool case with `SF0410` and nested T1 assertions; exact FE-008 reason fixtures for every reachable non-AVM2 T1/T2 head; all six FE-020 reverse-push source-order cases; and a non-empty synthetic process-restart determinism probe. The post-End block-scan policy is also resolved under R006 and pinned at scanner and analyzer level. These improve local P5 evidence; the FE-030 follow-up changes the citation inventory from the original C4 baseline of 31/33 to 32/33, without establishing the full FE-030 behavior.
- `ActionCall` (0x9E) and dynamic-argument-count call IR are now preserved by the P5 front end so the declared tier reasons can be reached. This is front-end IR/tiering work only; FE-024 runtime frame execution/resumption remains unwired.
- FE-023 is decode/unknown-depth coverage, not emitted deterministic enumeration order/marker. FE-025 is structured-IR coverage, not runtime unwinding. FE-027/028 are schedule metadata coverage, not runtime scheduling execution. FE-032 remains one-way text conformance, not byte round trip.

### `WaitForFrame2` minimum-version evidence

- Adobe Systems, *SWF File Format Specification, Version 10* (published November 2008), Chapter 5, p. 67 lists `WaitForFrame` but not `WaitForFrame2` in the SWF 3 action model; pp. 73–74 list `ActionWaitForFrame2` under SWF 4 Movie control actions ([p. 67](https://www.yumpu.com/en/document/view/14353079/swf-file-format-spec-v10/67), [p. 73](https://www.yumpu.com/en/document/view/14353079/swf-file-format-spec-v10/73), [p. 74](https://www.yumpu.com/en/document/view/14353079/swf-file-format-spec-v10/74)). This versioned primary-source evidence supports minimum SWF 4 and is recorded in `P5-C3-AUDIT.md` §1 and IMPL-050 §4.
- The Ruffle enum remains a separate code/name cross-check (`WaitForFrame2 = 0x8D`); it is not cited for the minimum-version conclusion.

### FE-030 DBCS source and fixture scope (partial; still open)

- Adobe's *SWF File Format Specification, Version 19*, Ch. 1 p. 20 says SWF 5 and earlier `STRING` values may use ANSI or Shift-JIS, carry no in-file encoding selector, and are decoded according to Flash Player locale; SWF 6+ uses UTF-8, and `LanguageCode` does not specify text encoding ([p. 20](https://www.yumpu.com/en/document/view/16539946/swf-file-format-specification-version-19-adobe/20)). Font code-table flags are not selectors for `ActionPush` strings.
- Ch. 5 p. 75 describes `ActionStringLength` as calculating a string's length without stating byte-vs-character units ([p. 75](https://www.yumpu.com/en/document/view/16539946/swf-file-format-specification-version-19-adobe/77)); p. 77 says `ActionMBStringLength` counts characters and counts a DBCS double-byte character as one on a DBCS-capable system ([p. 77](https://www.yumpu.com/en/document/view/16539946/swf-file-format-specification-version-19-adobe/79)).
- The P5 frontend now accepts an explicit `legacyEncoding` for SWF ≤5, defaulting to Windows-1252 as a deterministic porting assumption. A raw SWF-5 Shift-JIS fixture `[0x82, 0xA0, 0x00]` decodes to `あ`; the test verifies `MBStringLength` folds to 1 and `StringLength` remains dynamic. No exact runtime `StringLength` byte result is asserted.
- A pinned Ruffle source cross-check is informative but not an Adobe oracle: at commit [`ba92d5a`](https://github.com/ruffle-rs/ruffle/commit/ba92d5af0a9981b322b67c68ef58f59342f843fe), `ActionStringLength` calls `.len()`, comments that SWF 6+ returns UTF-16 code-unit length, and explicitly leaves SWF 5 byte-length behavior as a TODO ([handler](https://github.com/ruffle-rs/ruffle/blob/ba92d5af0a9981b322b67c68ef58f59342f843fe/core/src/avm1/activation.rs#L2211-L2217)). Its `ActionMBStringLength` handler also calls `.len()` ([handler](https://github.com/ruffle-rs/ruffle/blob/ba92d5af0a9981b322b67c68ef58f59342f843fe/core/src/avm1/activation.rs#L1762-L1766)); Ruffle documents that `WStr::len()` counts code units ([definition](https://github.com/ruffle-rs/ruffle/blob/ba92d5af0a9981b322b67c68ef58f59342f843fe/wstr/src/common.rs#L157-L162)). This identifies Ruffle's current implementation gap; it does not establish Flash Player's SWF ≤5 result.
- This makes FE-030 `test-cited` in the inventory, not passed. Keep FE-030 and P5 open until an authoritative/runtime oracle resolves `ActionStringLength` units/behavior on the scoped DBCS case.

## 3. Previously open P5 gates — current disposition

| Gate / item | Current evidence/disposition | Current decision / remaining action |
|---|---|---|
| Real open-corpus tier evidence + two reviewers | No ActionScript-bearing SWF is present among the 26 local inputs; zero T2 entries; one auditor only. | Obtain an appropriate open SWF corpus, preserve stable per-function reports, review every observed T2 reason with a second independent reviewer, and record provenance/reviewer scope. Do not count synthetic fixtures as open-corpus evidence. |
| Complete synthetic tier-reason coverage | Follow-up FE-008 fixtures assert exact reason arrays for all reachable non-AVM2 T1/T2 heads, including the formerly missing `record-overrun`, `try-malformed`, `register-out-of-range`, `dynamic-args`, and `frame-call-target-unresolved` paths. | **Addressed locally with synthetic fixtures.** Keep AVM2's `SF1000` hard-error gate distinct from function-tier output; open-corpus T2 review and two reviewers remain outstanding. |
| Function-only dynamic pool case (FE-005) | `operands.test.ts` defines a function whose body references the preceding pool and asserts `SF0410`, `poolIsDynamic`, nested T1, and exact `dynamic-pool`. | **Addressed locally.** No runtime behavior is claimed. |
| All six reverse-push call/init cases (FE-020) | `operands.test.ts` now covers CallFunction, CallMethod, NewMethod, NewObject, InitArray, and InitObject with source-order assertions. | **Addressed locally.** |
| Process-restart determinism | `tools/avm1-restart-probe.mjs` compares direct-analysis and CLI reports for a synthetic SWF containing a T0 block/function, a T1 `dynamic-pool` function, and a T2 `unknown-opcode` function, using two fresh processes for each report path. Names, non-empty requirements, tier counts, and exact per-function reasons are preserved. Hashes and summary are in `P5-C4-RESTART-PROBE.json`. | **Addressed for the synthetic restart gate.** This does not supply open-corpus/two-reviewer evidence. |
| Byte round trip | **Retained as a P5 exit criterion; still open.** No AVM1 text parser or action-byte serializer exists; FE-032 is explicitly one-way. | Before implementation, define a lossless inverse format and byte-identity acceptance for every defined opcode, then add a separately scoped/estimated P5 work package. Do not treat text goldens as equivalent; no implementation is authorized here. |
| Runtime coercion/enumeration/format gates | `T-AVM1-008/009/012/025` are runtime-owned and unwired. | **P7 gate, not P5 closeout.** Keep the normative language fixtures; resolve under IMPL-130 and do not substitute FE-031 or decoder tests. |
| Residual interpreter and instruction budget | `T-AVM1-027` is not implemented/tested in this P5 tree. | **P7 gate, not P5 closeout.** Resolve under IMPL-130 WP-130-12; do not report a pass now. |
| Frame call, exception unwind, and scheduling execution | FE-024 is unwired; FE-025/027/028 tests stop at front-end structures/schedules. | **P7 gate, not P5 closeout.** Resolve under IMPL-130 WP-130-05/12; runtime execution evidence must go beyond IR and metadata tests. |
| DBCS/code-page string behavior | Adobe establishes that SWF ≤5 strings have no in-file ANSI/Shift-JIS selector and locale determines decoding; `MBStringLength` counts DBCS characters. A raw Shift-JIS fixture now cites FE-030 for the safe frontend fold boundary. | **Partially evidenced; FE-030 remains open.** The specification does not state `ActionStringLength` byte-vs-character units; obtain an authoritative/runtime oracle before claiming the full obligation. |
| `WaitForFrame2` version citation | Adobe's versioned action lists put `WaitForFrame2` under SWF 4 and omit it from the SWF 3 list; source pages are preserved by link in IMPL-050 §4 and `P5-C3-AUDIT.md` §1. | **Resolved for the SWF-4 minimum classification.** The Ruffle enum remains only a code/name cross-check. |
| Bytes after `End` scan policy | IMPL-050-R006 now specifies that block scans include the first `End`, stop immediately afterward, and ignore the suffix; bounded region bodies retain their bound-based scan. Focused scanner/analyzer tests and the one-million mutation gate pass. | **Addressed locally.** `stoppedAt` identifies the first byte after the terminator; suffix bytes are neither decoded nor tiered. |

## 4. Phase-boundary decision

**Selected route: preserve the P5 front-end/P7 runtime boundary.** P5 exit acceptance is limited to front-end obligations in IMPL-050. IMPL-130/P7 owns executable runtime acceptance for `T-AVM1-008/009/012/025/027`, plus runtime execution of the frame-call, exception-unwind, and `DoInitAction`/`DoAction` scheduling contracts forwarded by FE-024/025/027/028. FE-027/028 metadata evidence remains valid only for the front-end portion.

The language requirements in `docs/specs/language/040-avm1-to-typescript.md` remain normative and the existing IDs are retained. No test is waived, no runtime gate is claimed green, and the front-end citations do not substitute for runtime evidence. This decision changes acceptance ownership only; it does not implement or authorize P6/P7/runtime work.

- The byte round trip is retained as a P5 gate and remains open; the open-corpus/two-reviewer review and FE-030 also remain P5 blockers.
- No emitter implementation (P6) or AVM1 runtime/interpreter/scheduler implementation (P7) was started.
- Keep `P5-AUDIT.md` and `P5-C4-AUDIT.md` as the evidence record. The build, typecheck, unit tests, fuzz, lint, spec verification, and Python tooling checks passing do not supersede the open gates.

### External-evidence follow-up — targeted GitHub screen, 2026-10-11

This was a read-only candidate search, not corpus acceptance. No binaries were downloaded or added to the repository.

| Candidate | Pinned evidence | Disposition |
|---|---|---|
| [HexOfZen](https://github.com/RLeePfeil/HexOfZen/tree/d05eb34a13b3d0f4016f65200225d86e311d398a) | The repo describes an AS2 game and contains `HexesOfZen.swf` (Git blob `910f103534a7ab4986076fe1421d626fed434436`, 19,937 bytes) at the pinned commit. GitHub reports no detected license and the root has no license file. | **Not admitted.** A public binary without clear reuse terms does not meet the licensed-corpus requirement. |
| [Downhill-Frenzy](https://github.com/aleded32/Downhill-Frenzy/tree/fb8f8656f950733c05a9624431f283212f7dbac1) | Despite the repository description, the pinned tree is a Unity project (`Assets/`, `Packages/`, `ProjectSettings/`); no `.swf` is present. GitHub reports no detected license. | **Not admitted.** No SWF corpus entry or clear license. |
| [AS2-Platform-Game](https://github.com/AthulDilip/AS2-Platform-Game/tree/f8460be0518250c4444e5e34d389301aa5438b89) | The pinned tree contains `platform game.fla`, but no compiled `.swf`; GitHub reports no detected license. | **Not admitted.** No distributable SWF or clear license. |
| [XiangQi Wizard Light](https://github.com/xqbase/xqwlight/tree/6221733f1f79b3acb44cce6f83dc6100443cb2c9) | GPL-2.0 source, but `Flash/XQWLight.as` is AS3 (`package`/`flash.*` imports) and the pinned tree contains no `.swf`. | **Not admitted.** Wrong VM generation and no SWF. |
| [Ruffle AVM1 `add` fixture](https://github.com/ruffle-rs/ruffle/tree/ba92d5af0a9981b322b67c68ef58f59342f843fe/tests/tests/swfs/avm1/add) | The pinned Ruffle repository is dual MIT/Apache (`LICENSE.md`) and includes a small source-backed AVM1 test SWF. | **Supplemental fixture only.** It is a generated conformance test, not an open-corpus title; it does not replace the P5 open-title corpus criterion. |

The search was targeted, not exhaustive. **No suitable licensed/provenanced title corpus was admitted, and no independent second reviewer was obtained.** The open-corpus and two-reviewer requirements remain open; the agent's own screening is not a second-person review.

### FE-030 oracle follow-up

A third emulator cross-check was located in [Lightspark at commit `9092db6`](https://github.com/lightspark/lightspark/commit/9092db6dbbdea7763a174e81ceaca3ea9626cd2a). Its [AVM1 interpreter](https://github.com/lightspark/lightspark/blob/9092db6dbbdea7763a174e81ceaca3ea9626cd2a/src/scripting/avm1_interpreter.cpp#L3274-L3302) returns `tiny_string::numChars()` for `ActionStringLength`; the `ActionMBStringLength` path is explicitly marked not implemented and also uses `numChars()`. This is an emulator implementation, not an original Flash Player oracle, so it does **not** establish SWF≤5 byte-versus-character behavior. Together with Ruffle's SWF-5 TODO and Shumway's unresolved shared helper, FE-030 remains open and the frontend must keep the result dynamic.

## 5. Final status

**Resolution: C4 audit artifacts accepted; P5 phase remains open.** The adopted boundary removes P7 runtime behavior from P5 acceptance but does not close P5. Closeout still requires the P5-owned byte-round-trip contract and evidence, open-corpus/two-reviewer evidence, and FE-030 disposition. The targeted corpus screen admitted no candidate, and the additional emulator cross-check did not resolve FE-030. P7 runtime gates remain open for their own phase. No P6/P7 implementation or phase transition is authorized by this resolution.
