# P5-C3 — Opcode catalog, disassembly and robustness audit

**Status:** Checkpoint complete. P5 remains in progress; this audit does not close the outstanding byte-round-trip, open-corpus, independent-review, or runtime-owned gates.

**Scope:** `audits/P5-CHECKPOINTS.md` C3; IMPL-050 §§4, 10, 13; AVM1 opcode inventory, disassembly and malformed-stream fallback only. No P6 emitter or P7 runtime work was started.

## Findings and resolutions

### 1. Defined and reserved opcode catalog

The implementation contains **102 defined codes** and **154 undefined/reserved codes**, partitioning the complete 256-byte opcode space. The audit found two documentation defects before changes:

- IMPL-050 §4 listed 101 rows and omitted `0x8D WaitForFrame2`; the source and tests had it, but incorrectly classified it as a SWF-3 action.
- R016's prose incorrectly treated defined `0x0F`, `0x87`, and `0x88` as reserved (and separately called observed `0x2D` a missing code). The prior list did not express the exact complement.

The `WaitForFrame2` row is in §4.2 (SWF 4), with its one-byte `SkipCount` payload and `1→0` effect. Its minimum version is now source-verified rather than inferred from opcode placement or stack semantics: Adobe's *SWF File Format Specification, Version 10* (published November 2008), Chapter 5, lists the SWF 3 action model on p. 67 with `WaitForFrame` but not `WaitForFrame2`, then lists `ActionWaitForFrame2` in the SWF 4 actions' Movie control group on pp. 73–74 ([p. 67](https://www.yumpu.com/en/document/view/14353079/swf-file-format-spec-v10/67), [p. 73](https://www.yumpu.com/en/document/view/14353079/swf-file-format-spec-v10/73), [p. 74](https://www.yumpu.com/en/document/view/14353079/swf-file-format-spec-v10/74)). This primary-source versioned action list supports SWF 4 as the minimum; the code/name row remains `0x8D WaitForFrame2`. The reference table §10.7 also spells out the SWF-3 high-code controls and identifies `0x8D` as SWF 4. The corrected minimum-version counts are **12 / 79 / 3 / 8** for SWF versions **3 / 4 / 6 / 7**. `opcodes.ts` sets the minimum to 4 and removes it from `SWF3_ONLY_CODES`; the Ruffle enum independently confirms the opcode number/name, not the version. R016 now enumerates the exact reserved ranges:

`0x01–0x03`, `0x16`, `0x19–0x1B`, `0x1E–0x1F`, `0x2E–0x2F`, `0x38–0x39`, `0x56–0x5F`, `0x6A–0x80`, `0x82`, `0x84–0x86`, `0x90–0x93`, `0x95`, `0x97–0x98`, `0x9C`, `0xA0–0xFF`.

`0x89 StrictMode` and `0x2D FsCommand2` remain the two observed, inert defined exceptions; neither belongs in the reserved complement. `T-AVM1-FE-001` now parses IMPL-050 §4 and R016 and checks the complete code/name/version/payload-schema/payload-length/stack-effect catalog against `OPCODES`, pins the 15 reserved ranges, and verifies the full 256-code partition. The corrected SWF-version inventory counts are **12 / 79 / 3 / 8** for minimum versions **3 / 4 / 6 / 7**, respectively.

### 2. Stack-effect detail

The table's existing `pops`/`pushes` fields use `'var'` for operand-dependent actions and are not consumed by the simulator. That representation alone loses formulas such as `n+2→1`, `2+k→0`, and `1→k+1`; `StartDrag` also has the documented conditional `3→0 (7→0 constrained)` case. Added optional `OpcodeSpec.stackEffect` metadata for these variable/conditional formulas. FE-001 checks each formula against the §4 `S` cell and verifies that its primary effect agrees with the compact `pops`/`pushes` classification. `stack.ts` remains the executable stack-semantics owner; this catalog audit does not treat declarative metadata as proof of runtime execution.

### 3. Disassembly and byte round-trip criterion

Added `T-AVM1-FE-032` synthetic goldens for escaped Push strings and nested With/Try/function output, with repeated-call determinism checks. The targeted source search found `analyzeActionBlock` and `disassembleBlock` but **no ActionIR/text parser or AVM1 action-byte serializer**. Thus there is no implemented inverse surface for `bytes→IR→disassembly→bytes`.

The specification now states this accurately: FE-032 proves only `bytes→IR→text` conformance, not a byte round trip. IMPL-050 §13 criterion 2 remains explicitly **open** until a real parser/assembler contract is specified and tested. This is a reconciliation of the criterion with the actual surface—not a text-golden substitution or a claim that P5 has passed the round-trip gate. Also corrected FE-002's old “round-trip” label to “decode/preserve,” matching its actual test surface.

### 4. Seeded mutation and truncation gate

Added `T-AVM1-FE-033` and the dedicated `pnpm test:avm1-fuzz` command. The gate uses a fixed XorShift32 seed (`0xC3F00D71`), a 12-stream synthetic corpus, and eight deterministic mutation/truncation modes. Each case checks that framing advances within the input, fatal framing records end the scan, analysis does not throw, unknown/desynchronized streams receive T2, and every T2 residual slice is non-empty and in bounds.

The required **1,000,000-case** run passed: `1 test passed`, 0 failures, about 12.0 seconds of test time on the final run. The regular suite keeps a 2,000-case deterministic smoke run; only the dedicated command runs the full million.

## Checkpoint evidence

| Area | Result | Evidence |
|---|---|---|
| Defined opcode row inventory | 102 unique rows; all 102 code/name/version entries align with source | `docs/impl/transpiler/050-actions-and-avm1.md` §4; `packages/avm1/test/framing.test.ts` FE-001 catalog test |
| Payload schemas/lengths | Every row checked for schema kind and fixed/open payload length | FE-001 catalog test; existing operand/framing tests |
| Version windows | 12 SWF 3, 79 SWF 4, 3 SWF 6, 8 SWF 7 entries; `SWF3_ONLY_CODES` equals the SWF-3 catalog rows | FE-001 catalog test |
| Stack effects | All fixed effects and detailed dynamic/conditional formulas checked against §4 | `OpcodeSpec.stackEffect`; FE-001 catalog test |
| Reserved codes | 15 exact ranges / 154 codes; disjoint complete complement | R016; FE-001 catalog test |
| Synthetic disassembly | Stable escaped strings; nested With, Try/catch/finally and function output pinned | `packages/avm1/test/disassembly.test.ts` FE-032 |
| Mutation/truncation | 1,000,000 seeded cases; zero uncaught exceptions or residual-boundary violations | `pnpm test:avm1-fuzz` FE-033 |
| Byte round-trip | **Open**; no parser or byte serializer exists | IMPL-050 §13 criterion 2; source search recorded above |

## Validation and test commands

- `corepack pnpm build` — passed.
- `corepack pnpm typecheck` — passed, including all test TypeScript projects.
- `corepack pnpm exec vitest run packages/avm1/test apps/decompiler/test/actions.test.ts apps/decompiler/test/analyze.test.ts` — **12 files, 99 tests passed**.
- `corepack pnpm test` — **62 files, 700 tests passed** (includes the regular 2,000-case AVM1 mutation smoke test).
- `corepack pnpm test:avm1-fuzz` — **1 file, 1 test passed**; the dedicated one-million-case campaign completed with no invariant failures.
- `corepack pnpm lint` — passed (ESLint and repository-wide Prettier check).
- `corepack pnpm spec:verify` — `ISSUES: 0`.
- `python3 -m unittest discover -s tools -p 'test_*.py'` — **78 tests passed**.
- `python3 tools/audit_dev.py --json --no-probe` — 31/33 IMPL-050 obligations are test-cited; FE-024 (runtime execution) and FE-030 (DBCS/code-page behavior) remain scheduled/unwired. This is an inventory, not evidence for language/runtime gates or overall P5 exit.
- `corepack pnpm spec:status` — generated the status register with FE-032/033 included.

These repository-wide checks are green but do not close the explicitly open byte-round-trip criterion, the open-corpus/two-reviewer requirement, or runtime-owned P5 gates.

## Exit disposition

C3 is complete: the catalog defects are reconciled, schema/version/stack metadata is pinned, synthetic text output is covered, the million-case robustness gate passes, and the missing inverse surface is explicitly documented. At the time this checkpoint was closed, C4 had not started; its later corpus/audit disposition is in `P5-C4-AUDIT.md`. P5 must not be closed on C3 evidence alone: §13 criterion 2 remains open, open-corpus review and the independent second reviewer remain unsatisfied, doc 130 still owns scheduling/runtime behavior, and language gates `T-AVM1-008/009/012/025` remain runtime-owned. No runtime or emitter implementation was pulled into this checkpoint.
