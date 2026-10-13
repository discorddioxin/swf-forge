# P5 Checkpoint C4 — Corpus Evidence and Closeout Audit

- **Date:** 2026-10-11
- **Branch:** `arena/07fdceae-swf-forge`
- **Plan:** `audits/P5-CHECKPOINTS.md` C4
- **Implementation contract:** `docs/impl/transpiler/050-actions-and-avm1.md`
- **Related evidence:** `audits/P5-C0-AUDIT.md` through `audits/P5-C3-AUDIT.md`; machine-readable corpus reports in [`P5-C4-CORPUS.json`](P5-C4-CORPUS.json); non-empty restart evidence in [`P5-C4-RESTART-PROBE.json`](P5-C4-RESTART-PROBE.json)

## Verdict

**C4 evidence collection and audit work is complete; P5 is not exit-ready and is not closed.** The repository contains no ActionScript-bearing SWF in the available SWF corpus, so the built tier CLI produced 26 deterministic, valid JSON reports with zero action blocks, functions, or tier decisions. There were no T2 reason records in those reports to review. This is an empty review set, not positive evidence of corpus tier coverage.

The available corpus is local fixture and parser-crasher material—not an open corpus of real titles. Only this audit was conducted; no independent second reviewer participated. The two-person open-corpus review requirement therefore remains unmet. The full P5 disposition and remaining gates are in `audits/P5-AUDIT.md` and `audits/P5-AUDIT-RESOLUTION.md`.

## 1. Scope and method

- Rebuilt the workspace before invoking the generated CLI.
- Enumerated repository `*.swf` inputs outside `.git` and `node_modules`: **26 files**.
- Ran `node apps/decompiler/dist/main.js analyze <relative-file.swf> --tiers --json` twice per file in separate Node processes. For each pair, compared exit code, stdout bytes, and stderr bytes exactly; checked the CLI's input SHA-256 against the file.
- Preserved each CLI report, input/output hashes, source class, and process-repeat result in `P5-C4-CORPUS.json`.
- Read the AVM1 tier classifier and its FE-008 reason fixtures separately from the SWF corpus, so a corpus with no scripts would not be mistaken for complete reason coverage.
- Reconciled all 33 `T-AVM1-FE-*` obligations against `python3 tools/audit_dev.py --json --no-probe`, then reviewed test scope for known cross-phase and partially covered obligations. A machine `test-cited` status records a citation, not a judgment that the test proves every clause.

## 2. Available SWF corpus and report results

| Source class | Count | Files |
|---|---:|---|
| Appendix fixture | 1 | `fixtures/appendix-a.swf` |
| Synthetic static fixtures | 20 | `fixtures/static/*.swf` |
| Malformed parser-fuzz crashers | 5 | `packages/swf/test/fuzz/corpus/crash-*.swf` |
| **Total** | **26** | No other repository SWF input was found. |

The 20 static fixtures are expressly no-script fixtures: `packages/swf/test/static-fixtures.test.ts` asserts that their main and sprite timelines have no actions and that init actions are empty. The Appendix A fixture is a small conformance fixture, not an open-corpus title. The five `crash-*` files are malformed SWF parser regressions, not AVM1 programs. All classifications and per-file reports are preserved in the corpus JSON.

| Measurement | Result |
|---|---:|
| JSON reports produced | 26 / 26 |
| Exact report repeatability across fresh CLI processes | 26 / 26 |
| Action blocks / functions reported | 0 / 0 |
| T0 / T1 / T2 entries | 0 / 0 / 0 |
| T2 reason records | 0 |
| Diagnostics in reports | 35 total: 2 errors, 24 warnings, 9 infos |
| CLI exit codes | 25 × 0; 1 × 1 (`crash-004-zlib-invalid-stream.swf`) |

The diagnostic-bearing report output remains deterministic, including for the malformed inputs. The empty tier counts mean the CLI had no AVM1 blocks to classify; they do **not** establish correct tiering for real ActionScript. No open/third-party game SWF or broader external corpus was available in the repository scan.

### T2 review disposition

There are no individual T2 reasons in the C4 corpus reports: every report has `entries: []`, and the aggregate `t2ReasonCounts` is empty. Thus no corpus T2 entry was skipped or silently assumed safe. The corpus does not exercise a T2 decision, however, and cannot satisfy IMPL-050 §13.3's open-corpus review clause.

To distinguish this empty result from the separate synthetic-reason gate, the current classifier and the available tests were inspected. The `T2_HEADS` set in `packages/avm1/src/frontend/tier.ts` declares ten heads:

| T2 head | Existing synthetic evidence | C4 disposition |
|---|---|---|
| `unknown-opcode` | `packages/avm1/test/tier.test.ts`; nested CLI reporting in `apps/decompiler/test/analyze.test.ts` | Exercised by synthetic tests; absent from SWF corpus. |
| `record-truncated` | `packages/avm1/test/tier.test.ts` | Exact analyzer-tier reason `record-truncated` is asserted. |
| `record-overrun` | `packages/avm1/test/tier.test.ts`; `packages/avm1/test/framing.test.ts` | Exact analyzer-tier reason `record-overrun` is asserted; scanner framing coverage remains separate. |
| `push-malformed` | `packages/avm1/test/tier.test.ts`; operand error tests | Exact analyzer-tier reason `push-malformed` is asserted. |
| `try-malformed` | `packages/avm1/test/tier.test.ts`; `packages/avm1/test/regions.test.ts` | Exact analyzer-tier reason `try-malformed` is asserted; `SF0404` region coverage remains separate. |
| `branch-out-of-bounds` | `packages/avm1/test/tier.test.ts` | Tier 2, exact reason, and invalid target are asserted. |
| `stack-mismatch` | `packages/avm1/test/tier.test.ts` | Tier 2, exact reason, diagnostic, and residual bytes are asserted. |
| `pool-index-out-of-range` | `packages/avm1/test/operands.test.ts`; `packages/avm1/test/tier.test.ts` | Tier 2 and exact reason are asserted. |
| `register-out-of-range` | `packages/avm1/test/tier.test.ts` | Nested `DefineFunction2` asserts `SF0416`, T2, and the exact reason `register-out-of-range`. |
| `avm2` | AVM2 rejection tests in `apps/decompiler/test/analyze.test.ts` / `actions.test.ts` | Separate `SF1000` exit-3 gate; `analyzeMovie` rejects before producing per-function tiers, so it is not a corpus T2 entry. |

The follow-up FE-008 fixtures now assert the exact analyzer-tier reason for every reachable non-AVM2 T2 head, including `record-overrun`, `try-malformed`, and nested `register-out-of-range`. `avm2` remains a separate `SF1000` hard-error gate, not an emitted per-function tier record; it is deliberately not represented as a synthetic analyzer-tier fixture. These tests improve synthetic reason coverage only and do not change the empty C4 corpus result.

The analogous T1 heads are `dynamic-with`, `dynamic-pool`, `call-dynamic-target`, `target-in-branch`, `dynamic-args`, `dynamic-stack`, and `frame-call-target-unresolved`. The FE-008 fixtures now assert each head exactly; the FE-005 function-only constant-pool case additionally asserts `SF0410` and the nested function's T1 `dynamic-pool` verdict. `ActionCall` (0x9E) and unknown argument-count calls are now preserved in front-end IR so their declared tier reasons are reachable. This is not runtime execution evidence and does not close FE-024.

## 3. IMPL-050 test-obligation reconciliation

At the original C4 closeout, `python3 tools/audit_dev.py --json --no-probe` reported **31/33 obligations test-cited**; FE-024 and FE-030 were then `scheduled-or-unwired`. The post-closeout FE-030 follow-up is recorded in §7. The inventory below preserves the C4 checkpoint snapshot; rows marked `test-cited` are tool citations, with scope qualifications immediately below the table.

| Obligation | `audit_dev.py` status | Test citation(s) |
|---|---|---|
| `T-AVM1-FE-001` | `test-cited` | `packages/avm1/test/framing.test.ts` |
| `T-AVM1-FE-002` | `test-cited` | `packages/avm1/test/operands.test.ts` |
| `T-AVM1-FE-003` | `test-cited` | `packages/avm1/test/operands.test.ts` |
| `T-AVM1-FE-004` | `test-cited` | `packages/avm1/test/control-flow.test.ts` |
| `T-AVM1-FE-005` | `test-cited` | `packages/avm1/test/operands.test.ts` |
| `T-AVM1-FE-006` | `test-cited` | `packages/avm1/test/regions.test.ts` |
| `T-AVM1-FE-007` | `test-cited` | `packages/avm1/test/tier.test.ts` |
| `T-AVM1-FE-008` | `test-cited` | `packages/avm1/test/tier.test.ts` |
| `T-AVM1-FE-009` | `test-cited` | `packages/avm1/test/tier.test.ts` |
| `T-AVM1-FE-010` | `test-cited` | `apps/decompiler/test/actions.test.ts`, `apps/decompiler/test/analyze.test.ts` |
| `T-AVM1-FE-011` | `test-cited` | `packages/avm1/test/movie.test.ts` |
| `T-AVM1-FE-012` | `test-cited` | `packages/avm1/test/movie.test.ts` |
| `T-AVM1-FE-013` | `test-cited` | `packages/avm1/test/functions.test.ts` |
| `T-AVM1-FE-014` | `test-cited` | `packages/avm1/test/functions.test.ts` |
| `T-AVM1-FE-015` | `test-cited` | `packages/avm1/test/functions.test.ts` |
| `T-AVM1-FE-016` | `test-cited` | `packages/avm1/test/regions.test.ts` |
| `T-AVM1-FE-017` | `test-cited` | `packages/avm1/test/framing.test.ts` |
| `T-AVM1-FE-018` | `test-cited` | `packages/avm1/test/operands.test.ts` |
| `T-AVM1-FE-019` | `test-cited` | `packages/avm1/test/semantics.test.ts` |
| `T-AVM1-FE-020` | `test-cited` | `packages/avm1/test/operands.test.ts` |
| `T-AVM1-FE-021` | `test-cited` | `packages/avm1/test/semantics.test.ts` |
| `T-AVM1-FE-022` | `test-cited` | `packages/avm1/test/semantics.test.ts` |
| `T-AVM1-FE-023` | `test-cited` | `packages/avm1/test/semantics.test.ts` |
| `T-AVM1-FE-024` | `scheduled-or-unwired` | — |
| `T-AVM1-FE-025` | `test-cited` | `packages/avm1/test/regions.test.ts` |
| `T-AVM1-FE-026` | `test-cited` | `packages/avm1/test/semantics.test.ts` |
| `T-AVM1-FE-027` | `test-cited` | `packages/avm1/test/movie.test.ts` |
| `T-AVM1-FE-028` | `test-cited` | `packages/avm1/test/movie.test.ts` |
| `T-AVM1-FE-029` | `test-cited` | `packages/avm1/test/framing.test.ts` |
| `T-AVM1-FE-030` | `scheduled-or-unwired` | — |
| `T-AVM1-FE-031` | `test-cited` | `packages/avm1/test/semantics.test.ts` |
| `T-AVM1-FE-032` | `test-cited` | `packages/avm1/test/disassembly.test.ts` |
| `T-AVM1-FE-033` | `test-cited` | `packages/avm1/test/actions-mutation.gate.test.ts` |

### Scope qualifications on cited obligations

- **FE-005:** `operands.test.ts` now defines a function whose only pool reference is in its body and asserts `SF0410`, `poolIsDynamic`, nested T1, and the exact `dynamic-pool` reason. Top-level pool resolution/replacement and out-of-range coverage remain.
- **FE-008:** `tier.test.ts` now has exact reason arrays for all reachable T1 and non-AVM2 T2 heads. The `avm2` classifier head remains covered by the separate `SF1000` rejection gate, not as a per-function analyzer reason.
- **FE-020:** `operands.test.ts` now asserts source-order arguments for CallFunction, CallMethod, NewMethod, NewObject, and InitArray, and source-order (name, value) pairs for InitObject.
- **FE-023:** the tests prove `Enumerate`/`Enumerate2` decode and leave an unknown stack depth. They do not prove deterministic materialization order or the emitted `sortedForDeterminism` marker; the latter is not present in the current front-end report surface and requires later emitter/report ownership.
- **FE-024:** a new front-end-only check verifies that ActionCall (0x9E) is retained as `timeline.call` IR and that a dynamic frame selector receives T1 `frame-call-target-unresolved`. It does not execute the called frame's script or resume at the next instruction; the runtime-owned FE-024 behavior remains unwired (doc 130 / WP-130-05), and no test is claimed as full FE-024 evidence.
- **FE-025:** the current cases prove structured Try/Catch/Finally IR and a Throw terminator, not execution/unwinding through nested functions. Runtime unwinding remains a later interpreter obligation.
- **FE-027/028:** `movie.test.ts` verifies schedule metadata (init order, sprite association, frame association, tag order). It does not execute the runtime boot/frame loop or independently prove once-only execution before implicit sprite creation / execution at the ShowFrame boundary. The doc-130 runtime acceptance remains open.
- **FE-030 (at C4 closeout):** no test was cited in the original C4 snapshot; the DBCS fixture and encoding authority were still open. The later source/fixture follow-up in §7 supersedes this current-state note without claiming the exact `StringLength` runtime result.
- **FE-032:** the synthetic golden proves `bytes → IR → disassembly text`, not `bytes → IR → disassembly → bytes`. No AVM1 text parser or byte serializer exists.
- **FE-033:** the dedicated one-million-case action-stream mutation/truncation gate is run and passes; this is P5 front-end robustness evidence, not corpus evidence.

## 4. IMPL-050 work-package reconciliation

| Work package | Current implementation/evidence | C4 disposition |
|---|---|---|
| WP-050-01 — framing, bounds, End policy | `frontend/record.ts`; FE-001 and framing regressions | First End terminates a block-level scan; suffix bytes are ignored and the boundary is pinned by tests. Region bodies remain bound-delimited; the million-case gate is WP-050-17. |
| WP-050-02 — opcode table, schemas, stack effects | `frontend/opcodes.ts`; FE-001/029; 102 defined rows and 154 reserved codes | Implemented and locally cross-checked. Adobe's versioned action lists support the SWF-4 minimum for `WaitForFrame2`; see §5. |
| WP-050-03 — operand readers | `frontend/operands.ts`; FE-002/003/005/017/018 and related cases | P5 front-end implemented; the function-only pool reference now asserts `SF0410` and the nested T1 `dynamic-pool` reason. |
| WP-050-04 — DefineFunction/DefineFunction2 | `frontend/functions.ts`; FE-013/014/015 | P5 front-end implemented and cited. |
| WP-050-05 — CFG/basic blocks/SetTarget | `frontend/control-flow.ts`, `targets.ts`; FE-003/004/009 | P5 front-end implemented and cited. |
| WP-050-06 — Try/With structuring | `frontend/operands.ts`, `control-flow.ts`, `stack.ts`; FE-006/016/025 | Structural IR and exact malformed-Try T2 reason are covered; runtime unwind is not proven. |
| WP-050-07 — stack simulation and partial evaluation | `frontend/stack.ts`, `ir.ts`; FE-007/022/031 | Front-end semantics and static-fold boundary covered; does not satisfy the runtime coercion gates. |
| WP-050-08 — tier reasons/residual extraction | `frontend/tier.ts`, `residual.ts`; FE-008/009 | Exact fixtures now cover all reachable non-AVM2 T1/T2 reason heads; AVM2 remains a separate hard gate, and no corpus entry was available to review. |
| WP-050-09 — SWF 4/5 front-end semantics | `frontend/stack.ts`; FE-022 | Front-end fold semantics are cited/tested; runtime behavior remains separately owned. |
| WP-050-10 — calling convention and Enumerate | `frontend/stack.ts`; FE-020/023 | FE-020 now asserts source order for all six listed call/init actions; FE-023 still does not prove emitter ordering/marker. |
| WP-050-11 — properties, target paths, timeline actions | `frontend/properties.ts`, `stack.ts`; FE-019/021/024 | `ActionCall` now preserves its frame operand as `timeline.call` IR for tiering; runtime frame execution/resume remains with WP-130-05. |
| WP-050-12 — scheduling handoff | `frontend/blocks.ts`; FE-027/028 | Front-end schedule metadata is implemented; doc-130 runtime consumption/execution remains open. |
| WP-050-13 — requirements extraction | `frontend/requirements.ts`; FE-011 | Front-end extraction is cited/tested; a non-empty function-bearing two-process comparison now passes in `P5-C4-RESTART-PROBE.json`. |
| WP-050-14 — name/class recovery | `frontend/names.ts`; FE-012/026 | Deterministic shuffle/class-recovery tests plus the non-empty fresh-process report comparison pass; this remains synthetic evidence, not open-corpus review. |
| WP-050-15 — AVM2 detection/exit 3 | `frontend/avm2.ts`, decompiler CLI; FE-010 | Implemented as the separate fatal gate; not a per-function tier record. |
| WP-050-16 — disassembler + synthetic conformance | `frontend/disassemble.ts`; FE-032 | One-way synthetic output is covered. A real inverse parser/serializer is absent by design and the byte round-trip criterion remains open. |
| WP-050-17 — action-stream mutation gate | `actions-mutation.gate.test.ts`; FE-033 | Dedicated 10⁶ run passes; no claim beyond tested front-end invariants. |

## 5. Process determinism, source evidence, and scope limits

- **Report repeatability:** the 26 C4 corpus reports remain byte-identical across two fresh CLI processes each, but those inputs have no action entries. Separately, `tools/avm1-restart-probe.mjs` analyzes a synthetic SWF containing a T0 action block/function, a T1 `dynamic-pool` function, and a T2 `unknown-opcode` function in two fresh direct-analysis processes and two fresh `analyze --tiers --json` CLI processes. The direct reports match each other byte-for-byte, as do the CLI reports; hashes and all three tier entries are preserved in `P5-C4-RESTART-PROBE.json`.
- **Requirement/name restart gate:** the synthetic probe recovers the names `tick`, `poolReader`, and `unknownBytecode`, and non-empty action-block/static-function/dynamic-pool requirements. It establishes the local synthetic restart-determinism check in IMPL-050 §13.5; it is not open-corpus evidence and does not replace the still-missing open-corpus/two-reviewer review.
- **Independent review:** exactly one audit pass is recorded here. No second independent human reviewer was obtained. Do not represent this as two-person review.
- **Open corpus:** all 26 inputs are repository conformance fixtures or malformed parser-fuzz regressions. None is evidence from a real open-corpus title. The open-corpus criterion remains unsatisfied.
- **`WaitForFrame2` minimum version:** Adobe's *SWF File Format Specification, Version 10*, Ch. 5, p. 67, lists the SWF 3 action model with `WaitForFrame` but not `WaitForFrame2`; pp. 73–74 list `ActionWaitForFrame2` under SWF 4 Movie control actions ([p. 67](https://www.yumpu.com/en/document/view/14353079/swf-file-format-spec-v10/67), [p. 73](https://www.yumpu.com/en/document/view/14353079/swf-file-format-spec-v10/73), [p. 74](https://www.yumpu.com/en/document/view/14353079/swf-file-format-spec-v10/74)). This supports minimum SWF 4. Ruffle remains a code/name cross-check only, not the version authority; see `P5-C3-AUDIT.md` §1.
- **`scanRecords` after End:** follow-up resolved the P5 policy under IMPL-050-R006: block scans include the first End and stop there; any suffix is ignored, not decoded or tiered. Length-delimited region bodies scan to their declared bound. Focused tests and the one-million mutation gate pin this behavior.
- **Phase boundary:** the follow-up added only P5 front-end IR/tiering support for `ActionCall` and unknown call argument counts, plus tests and a restart probe. No P6 emitter, AVM1 runtime/interpreter, or P7 scheduling implementation was started.

## 6. C4 exit disposition

The follow-up P5-owned evidence is recorded in this C4 audit: the synthetic FE-005/008/020 gaps now have exact fixtures, and `P5-C4-RESTART-PROBE.json` records deterministic direct-analysis and CLI reports across fresh processes for a synthetic T0/T1/T2 SWF, including names and requirements. The probe uses only P5 front-end analysis; it is not corpus evidence, and the ActionCall IR addition is not frame execution or a P7 runtime.

Post-change validation passed: `corepack pnpm build`, `corepack pnpm typecheck`, focused AVM1/decompiler tests (12 files / 116 tests), the full unit suite (62 files / 717 tests), the one-million AVM1 mutation gate, `corepack pnpm lint`, `corepack pnpm spec:verify` (`ISSUES: 0`), 78 Python tooling tests, `audit_dev.py --json --no-probe` (31/33 obligations test-cited), and `corepack pnpm test:avm1-restart`. The detailed gate stack is in `P5-AUDIT.md` §6.

C4's requested artifacts and reconciliations are delivered. C4 does **not** close the P5 phase. Under the Route A boundary recorded in `P5-AUDIT-RESOLUTION.md`, the byte-round-trip criterion is retained as a P5 gate and remains open, along with open-corpus/two-reviewer evidence and FE-030's exact `ActionStringLength` unit/result. Runtime language/interpreter/scheduling execution gates remain open and mandatory for P7/IMPL-130, but are not P5 closeout criteria. The SWF ≤5 locale/code-page rule and a spec-bounded DBCS frontend fixture were established in the post-C4 follow-up (§7); they do not prove the unresolved runtime result. The post-End scan policy has been resolved locally under R006 and pinned by tests; Adobe's versioned action lists now support the SWF-4 minimum for `WaitForFrame2`.

## 7. Post-C4 FE-030 source and fixture follow-up (2026-10-11)

- Adobe's *SWF File Format Specification, Version 19*, Ch. 1 p. 20 says SWF 5 and earlier `STRING` values may use ANSI or Shift-JIS, carry no in-file selector, and are decoded according to Flash Player locale; SWF 6+ uses UTF-8, and `LanguageCode` is not a text-encoding selector ([p. 20](https://www.yumpu.com/en/document/view/16539946/swf-file-format-specification-version-19-adobe/20)). This supersedes the prior assumption that a font tag declares the `ActionPush` string code page.
- Ch. 5 p. 75 describes `ActionStringLength` as calculating length but does not state byte-vs-character units ([p. 75](https://www.yumpu.com/en/document/view/16539946/swf-file-format-specification-version-19-adobe/77)). Ch. 5 p. 77 says `ActionMBStringLength` counts characters and treats a DBCS double-byte character as one on a system with double-byte support ([p. 77](https://www.yumpu.com/en/document/view/16539946/swf-file-format-specification-version-19-adobe/79)).
- `AnalyzeBlockInput` and `AnalyzeMovieOptions` now accept an explicit `legacyEncoding` for SWF ≤ 5; the default remains Windows-1252 as a deterministic porting choice, not a format-declared code page. Nested function blocks inherit the selected decoder.
- The new `T-AVM1-FE-030` test uses raw SWF-5 `ActionPush` bytes `[0x82, 0xA0, 0x00]` under explicit Shift-JIS, verifies the decoded BMP character `あ`, confirms `MBStringLength` folds to one, and confirms `StringLength` stays dynamic. It does **not** assert a byte result the specification does not state, and FE-030 remains open pending an authoritative/runtime oracle for that operation.
- A pinned Ruffle implementation check is not an Adobe oracle: commit [`ba92d5a`](https://github.com/ruffle-rs/ruffle/commit/ba92d5af0a9981b322b67c68ef58f59342f843fe) implements `ActionStringLength` through `.len()`, describes SWF 6+ as UTF-16 code-unit length, and explicitly leaves SWF 5 byte-length behavior as a TODO ([handler](https://github.com/ruffle-rs/ruffle/blob/ba92d5af0a9981b322b67c68ef58f59342f843fe/core/src/avm1/activation.rs#L2211-L2217)). Its current code therefore does not resolve Flash Player's legacy result.
- The current development audit moves FE-030 from `scheduled-or-unwired` to `test-cited` (32/33 total) because the scoped test exists; this is a citation inventory only, not a claim that the full obligation or P5 exit gate passes.
- Post-follow-up verification: focused `vitest` on `semantics.test.ts`, `operands.test.ts`, and `framing.test.ts` passed **3 files / 51 tests**; the full unit suite passed **62 files / 718 tests**. Build, typecheck, lint, `spec:verify` (`ISSUES: 0`), 78 Python tooling tests, the one-million AVM1 mutation gate, the process-restart probe, `audit_dev.py --json --no-probe` (32/33 FE obligations test-cited), and `git diff --check` also passed. FE-030 remains partial and P5 remains open. Under Route A, runtime-owned gates are P7 forwards; the follow-up did not implement byte round-trip or any runtime, P6, or P7 work.
