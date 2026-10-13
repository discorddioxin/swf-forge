# P5 In-Depth Audit — AVM1 Front End (C4 Closeout)

- **Date:** 2026-10-11
- **Auditor:** Arena.ai Agent Mode
- **Branch:** `arena/07fdceae-swf-forge`
- **Scope:** P5 checkpoints C0–C4, IMPL-050 §§4/10/11/13, roadmap §6 P5 criteria, current AVM1 source/tests, and the final gate stack.
- **Checkpoint evidence:** `P5-C0-AUDIT.md` … `P5-C4-AUDIT.md`; C4 per-file CLI output: [`P5-C4-CORPUS.json`](P5-C4-CORPUS.json); non-empty restart probe: [`P5-C4-RESTART-PROBE.json`](P5-C4-RESTART-PROBE.json).

## 1. Verdict

**P5 is not exit-ready and remains open.** The front-end implementation, `analyze --tiers` CLI, opcode catalog audit, and million-case action-stream mutation gate are present, and the repository test/build/documentation gates pass. Follow-up work now covers the function-only dynamic-pool case, exact reachable tier reasons, all six reverse-push call/init actions, a non-empty synthetic process-restart check, and an Adobe source citation for `WaitForFrame2`'s minimum version. The recorded phase-boundary decision makes P5 front-end-owned: its remaining P5 gates are the inverse byte-round-trip surface, open-corpus/two-reviewer evidence, and FE-030's unresolved `ActionStringLength` oracle. Runtime-owned language/interpreter/scheduling execution gates remain unwired and mandatory for P7, but are not P5 closeout gates. No runtime behavior is claimed passed.

C4 is complete as an evidence-gathering and audit checkpoint. That means the empty repository-corpus result and its limitations are recorded—not that P5's corpus criterion has passed. No P6 emitter or P7 AVM1 runtime/interpreter implementation was started.

## 2. C0–C4 checkpoint disposition

| Checkpoint | Result | Continuing limitation |
|---|---|---|
| **C0 — baseline** | Complete; recorded substantial pre-existing AVM1 front-end implementation and gaps. | Baseline evidence alone did not establish P5 completion. |
| **C1 — tier report CLI** | Complete; `forge-decompile analyze <file.swf> --tiers [--json]` reports action blocks and nested functions, preserves child T2 verdicts, and has an AVM2 exit-3 path. | User surface does not supply an open corpus or runtime. |
| **C2 — semantics/identity** | Complete; IMPL-050 IDs are `T-AVM1-FE-*`; language/runtime `T-AVM1-*` ownership is separate. | FE-030 remains a P5 open item. FE-024/025/027/028 runtime execution and language/runtime gates are P7 forwards; FE citations do not replace runtime evidence. |
| **C3 — catalog/disassembly/robustness** | Complete as a checkpoint; 102 defined / 154 reserved codes partition all 256 values; synthetic disassembly and the one-million-case gate are covered. | Byte round trip remains open. Adobe's versioned SWF 3/SWF 4 action lists now support the minimum-SWF-4 classification of `0x8D WaitForFrame2`. |
| **C4 — corpus/closeout** | Complete as an audit; 26 inputs were run twice in fresh processes and reports preserved. | Zero AVM1 blocks/functions/T2 rows; local fixtures are not an open corpus and no independent second reviewer participated. |

## 3. P5 exit-criteria ledger

Roadmap §6 P5 and IMPL-050 §13 are evaluated separately from the fact that the unit suite is green. Under the recorded Route A boundary, this ledger distinguishes P5-owned front-end criteria from mandatory P7 runtime gates.

| Criterion | Disposition | Evidence and remaining work |
|---|---|---|
| Complete 256-code opcode inventory, exact reserved complement, unknown-opcode residual fallback | **Pass locally** | C3/FE-001 pins 102 defined rows and 154 reserved codes. Adobe's SWF 3/SWF 4 action lists support minimum version 4 for `WaitForFrame2`; see §7. |
| Defined-opcode bytes → IR → disassembly → bytes | **Open — retained as a P5 exit criterion** | FE-032 proves synthetic `bytes → IR → text` only. No AVM1 disassembly parser or action-byte serializer exists; byte-identity coverage for every defined opcode and a separately scoped/estimated P5 work package remain prerequisites to implementation. |
| Tier reasons exercised; tier reports reviewed on an open corpus by two people | **Not met — corpus/review clause remains open** | Follow-up FE-008 fixtures assert exact reasons for all reachable non-AVM2 T1/T2 heads, with AVM2 kept as the separate `SF1000` gate. C4's 26 local fixtures/crashers still contain zero action entries; no open-corpus or second-reviewer evidence exists. |
| 10⁶ seeded action-stream mutations/truncations, no uncaught exceptions and safe residual behavior | **Pass** | `corepack pnpm test:avm1-fuzz`: one test passed; one million seeded cases completed without invariant failures. |
| Requirements extraction and name recovery deterministic across process restarts | **Pass on the non-empty synthetic probe** | `tools/avm1-restart-probe.mjs` runs two fresh direct-analysis processes and two fresh CLI processes over a synthetic SWF containing T0, T1 (`dynamic-pool`), and T2 (`unknown-opcode`) entries. Each report is byte-identical across its two fresh processes; recovered names and non-empty requirements are preserved. Hashes and summary are in `P5-C4-RESTART-PROBE.json`. This is synthetic determinism evidence, not open-corpus review. |
| P5 `DoAction`/`DoInitAction` schedule metadata | **Front-end evidence only; P7 execution remains open** | FE-027/028 tests verify metadata/order associations. They do not execute init scripts before sprite creation or frame scripts at the ShowFrame boundary. This does not block P5 on the runtime half. |
| Residual interpreter executes T2 blocks and honors the instruction budget (`T-AVM1-027`) | **P7-owned; open, not a P5 closeout gate** | No AVM1 runtime/interpreter package or runtime-owned budget test is present. This remains mandatory under IMPL-130 WP-130-12; no pass is claimed. |
| Language coercion/enumeration/format gates (`T-AVM1-008/009/012/025`) | **P7-owned; open, not P5 closeout gates** | The P5 literal-fold test is not the runtime matrix. These remain mandatory P7 tests under IMPL-130; no pass is claimed. |

## 4. Corpus, T2 review, and independent-review result

The complete corpus inventory, report JSON, SHA-256 values, repeat hashes, diagnostics, and exit codes are in `P5-C4-CORPUS.json`. Summary: **26/26** reports are byte-identical across two fresh CLI processes; all have **0 action blocks, 0 functions, and 0 T2 entries**. The inputs are one Appendix A fixture, 20 explicitly no-script synthetic static fixtures, and five malformed parser-fuzz crashers. One invalid-zlib crasher returns exit 1 with diagnostics; the other 25 reports return exit 0.

Therefore there were **no T2 reasons in the C4 corpus reports to review**. This statement is deliberately limited to this empty local corpus. It does not mean that T2 behavior is globally absent, nor that any open-corpus T2 review has passed. Follow-up FE-008 fixtures now assert exact analyzer-tier reasons for all reachable non-AVM2 T1/T2 heads, including analyzer-level `record-overrun`, `try-malformed`, and nested `register-out-of-range`; AVM2 remains a separate fatal `SF1000` gate. See `P5-C4-AUDIT.md` §2 for the updated inventory.

**Open corpus:** not present in this checkout. **Independent review:** not obtained; this is one audit pass, not a two-person review. A targeted GitHub candidate screen found no admissible licensed/provenanced title corpus (details in `P5-AUDIT-RESOLUTION.md` §4); it does not count as corpus evidence. Both requirements remain open.

## 5. IMPL-050 test obligations and work packages

`python3 tools/audit_dev.py --json --no-probe` reports **32/33 IMPL-050 obligations test-cited** after the FE-030 source/fixture follow-up. FE-024 remains `scheduled-or-unwired`; its runtime frame-execution/resumption behavior is a P7 forward, not a P5 closeout gate under Route A. FE-030 is test-cited for a spec-bounded frontend case, but its exact `StringLength` byte-vs-character result remains unresolved and is still a P5 open item. The mechanical 32/33 citation count does not encode phase ownership or completion. The complete 33-row ID/status/test-file table and all 17 WP-050 dispositions are in `P5-C4-AUDIT.md` §§3–4, with the post-C4 follow-up in §7.

A test citation is not necessarily full obligation evidence. The C4 scope review found these material qualifications:

- FE-005 now has a function-body-only pool reference asserting `SF0410`, nested T1, `poolIsDynamic`, and exact `dynamic-pool`.
- FE-008 now asserts exact reason arrays for each reachable non-AVM2 T1/T2 head; AVM2 remains a distinct `SF1000` hard-error gate.
- FE-020 now asserts source order for CallFunction, CallMethod, NewMethod, NewObject, InitArray, and InitObject.
- FE-023 proves enumeration decoding/unknown stack depth, not deterministic emitted key order or the marker.
- FE-024 has a front-end-only `ActionCall` IR/T1 check; it does not execute the target frame or resume the caller. FE-025 proves structured IR/Throw shape, not runtime unwinding.
- `P5-C4-RESTART-PROBE.json` records deterministic non-empty direct-analysis and CLI reports across fresh Node processes for a synthetic SWF with T0, T1, and T2 entries; this establishes synthetic restart determinism but not open-corpus evidence.
- FE-027/028 prove schedule metadata, not runtime execution ordering.
- FE-030 now has a partial, test-cited Shift-JIS DBCS frontend case: `MBStringLength` folds to one character and `StringLength` remains dynamic. Adobe does not specify the latter's byte-vs-character unit in Ch. 5, so FE-030 remains open; FE-032 is one-way text conformance only.

The work-package ledger marks front-end modules that are present as implemented at their front-end boundary; it does not infer completion of later runtime/emitter work. Under Route A, the following remain mandatory P7 gates and are explicitly not waived or claimed green by moving them out of P5 acceptance:

| Gate | Required behavior | Owner / current disposition |
|---|---|---|
| `T-AVM1-008` | Runtime `Add`/`Add2`/`StringAdd` coercion matrix | IMPL-130 WP-130-02; scheduled/unwired, no pass claim. FE-031 is static folding only. |
| `T-AVM1-009` | Runtime AVM1 `isNaN` / ToNumber matrix | IMPL-130 WP-130-02; scheduled/unwired. |
| `T-AVM1-012` | Runtime `for…in` own/prototype order, shadowing, and snapshot semantics | IMPL-130 WP-130-01 / T-RT-121; scheduled/unwired. FE-023 is decode-only. |
| `T-AVM1-025` | Observable 15-significant-digit runtime formatting | IMPL-130 WP-130-02; scheduled/unwired. |
| `T-AVM1-027` | Residual interpreter instruction-budget behavior | IMPL-130 WP-130-12; no interpreter/runtime evidence in P5. |
| FE-024 / FE-025 / FE-027 / FE-028 | Frame-call execution, exception unwinding, init/frame scheduling | Runtime/integration handoff in doc 130; current P5 tests preserve ActionCall IR/schedule metadata but do not execute these behaviors. |
| FE-030 | DBCS byte/character string behavior | Shift-JIS SWF-5 frontend fixture is partially cited; no in-file encoding selector exists. Exact `ActionStringLength` units/runtime result remain unproven; FE-030 is still open. |

No P6 or P7 implementation has been pulled into this audit to make these rows appear green.

## 6. Final P5 gate stack

| Gate | Command | Result |
|---|---|---|
| Build | `corepack pnpm build` | **Pass** — root TypeScript build and both applications build. |
| Typecheck | `corepack pnpm typecheck` | **Pass** — workspace and test TypeScript projects. |
| Focused AVM1/decompiler tests | `corepack pnpm exec vitest run packages/avm1/test apps/decompiler/test/actions.test.ts apps/decompiler/test/analyze.test.ts` | **Pass — 12 files / 116 tests.** |
| Full unit suite | `corepack pnpm test` | **Pass — 62 files / 718 tests** on the post-FE-030 rerun. |
| One-million AVM1 mutation gate | `corepack pnpm test:avm1-fuzz` | **Pass — 1 test; 1,000,000 seeded cases.** |
| ESLint + Prettier | `corepack pnpm lint` | **Pass.** |
| Spec/document cross-check | `corepack pnpm spec:verify` | **Pass — `ISSUES: 0`.** |
| Python tooling tests | `python3 -m unittest discover -s tools -p 'test_*.py'` | **Pass — 78 tests.** |
| Development audit inventory at C4 closure | `python3 tools/audit_dev.py --json --no-probe` | C4 baseline: **31/33** obligations test-cited; FE-024/030 were then scheduled/unwired. After the FE-030 follow-up, current status is 32/33 cited; the citation is partial and does not close FE-030. The repo-wide audit also reports 12 unmapped diagnostics and 5 unemitted registry rows; `--no-probe` skips the CLI dump probe. |
| FE-030 source/fixture follow-up | `vitest` focused AVM1 tests | Pass — raw SWF-5 Shift-JIS fixture decodes and pins only the Adobe-specified MBStringLength character fold; StringLength stays dynamic. This does not establish runtime byte units. |
| Generated status register | `corepack pnpm spec:status` | **Pass** — wrote `docs/impl/registers/STATUS.md`. |
| Corpus CLI reports | 26 inputs × 2 fresh CLI processes | **Pass for report repeatability: 26/26 identical; zero action/function entries.** |
| Non-empty process-restart probe | `corepack pnpm test:avm1-restart` | **Pass** — two fresh direct-analysis processes and two fresh CLI processes; one action block plus three functions covering T0/T1/T2 (tier counts 2/1/1); recovered names and non-empty requirements; each report identical across fresh processes. Synthetic-only hashes and summary are in `P5-C4-RESTART-PROBE.json`. |
| Whitespace/error check | `git diff --check` | **Pass.** |

Green engineering gates establish only the behaviors their tests exercise. They do not close the open P5 criteria in §§3–5.

## 7. Source and behavior caveats carried forward

- `WaitForFrame2` (`0x8D`) is minimum SWF 4 in `opcodes.ts` and IMPL-050. Adobe's *SWF File Format Specification, Version 10*, Ch. 5, pp. 67 and 73–74, lists `WaitForFrame` in the SWF 3 model (not `WaitForFrame2`) and `ActionWaitForFrame2` in the SWF 4 Movie control actions. The cited versioned primary source supports the minimum; the Ruffle enum is used only to confirm the opcode number/name. See the source links and reconciliation in `P5-C3-AUDIT.md` §1.
- The post-End action-scan policy is now explicit under IMPL-050-R006: block-level scanning includes the first `End`, stops at the following byte, and ignores any suffix without decoding or tiering it. Length-delimited region bodies retain their bound-based scan mode. Focused framing/analyzer tests and the one-million mutation gate pass.
- C4's original corpus process comparison is over empty action reports. The separate `P5-C4-RESTART-PROBE.json` establishes byte-identical direct-analysis and CLI reports across fresh processes for a synthetic function-bearing SWF with T0, T1, and T2 entries; it is not open-corpus evidence.
- A further implementation cross-check at [Lightspark commit `9092db6`](https://github.com/lightspark/lightspark/commit/9092db6dbbdea7763a174e81ceaca3ea9626cd2a) uses `tiny_string::numChars()` for `ActionStringLength`, while explicitly marking `ActionMBStringLength` not implemented and also using `numChars()` ([source](https://github.com/lightspark/lightspark/blob/9092db6dbbdea7763a174e81ceaca3ea9626cd2a/src/scripting/avm1_interpreter.cpp#L3274-L3302)). This is emulator behavior, not an original Flash Player oracle; FE-030 remains open. See `P5-AUDIT-RESOLUTION.md` §4.

## 8. Overall disposition

**P5 status: OPEN / closeout blocked by P5-owned criteria.** C0–C4 audit artifacts exist and their checkpoint work is recorded. P5 remains open for the byte round trip, open-corpus/two-reviewer T2 review, and FE-030's unresolved `ActionStringLength` oracle. Runtime-owned coercion/enumeration/format/interpreter and call/unwind/scheduling execution are mandatory P7 gates, not P5 closeout criteria; their ownership change neither waives them nor claims them passed. The post-End scanning policy is resolved locally under R006 with focused tests, and the `WaitForFrame2` SWF-4 minimum is now supported by Adobe's versioned action lists; neither change removes the P5 blockers. Synthetic reason fixtures and restart determinism do not replace open-corpus review. No P6/P7 implementation was started.
