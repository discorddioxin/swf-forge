# P5 Checkpoint C0 — Baseline Audit

- **Date:** 2026-10-10
- **Branch:** `arena/07fdceae-swf-forge`
- **Baseline commit:** `236bc0c` (`P3 media decode + asset build + audit closeout`)
- **Authorization:** P4 is recorded resolved in `audits/archive/P4-DIAGNOSIS.md`; P5 is next.
- **Scope:** Read-only snapshot of existing AVM1 front-end code/tests and roadmap/IMPL-050 gates. No P5 implementation edits had been made at the time of this snapshot.

## Verdict

**P5 is authorized but not exit-ready.** A substantial front-end implementation already exists in the baseline checkout; the roadmap's statement that “P5 onward” is not started is stale. Existing code must be audited against the P5 contract rather than treated as phase completion.

## Baseline evidence

| Area | Observed state |
|---|---|
| Front-end implementation | `packages/avm1/src/frontend/` contains record framing, opcode table, operand readers, function decoding, CFG, region handling, stack simulation, tiering/residual extraction, requirements, name recovery, movie analysis, scheduling and disassembly. |
| User-facing AVM1 surface | `inspect --actions` and deterministic `disassembleMovie()` exist, with an AVM2 hard-error path. The roadmap's separate `analyze --tiers` command does not exist. |
| Focused tests | After `corepack pnpm install --frozen-lockfile` and `corepack pnpm build`, the focused P5 set passed: **9 files / 88 tests** (`packages/avm1/test/**` plus `apps/decompiler/test/actions.test.ts`). This is a baseline run, not a full P5 gate. |
| IMPL-050 test obligations | At baseline, `audit_dev.py --json --no-probe` reported **28 of 30 front-end obligations test-cited**. C2 gives those original obligations IDs `T-AVM1-FE-001`…`T-AVM1-FE-030` and adds `T-AVM1-FE-031` for constant-fold coercion. The current report cites **29 of 31**; `T-AVM1-FE-024` (runtime Call/GotoFrame2 behavior) and `T-AVM1-FE-030` (DBCS StringLength behavior) remain scheduled/unwired. |
| Robustness | The repository's existing fuzz command mutates SWF inputs (P3 closeout: 10,000 seeded cases); no dedicated action-stream 10^6 campaign is evidenced by the current P5 tests. |
| Corpus evidence | No `analyze --tiers` output or independent two-reviewer report for an open corpus is present. The current fixtures are synthetic; they do not establish an open-corpus review. |
| Round-trip claim | The current disassembler prints text from IR; there is no bytes-from-disassembly encoder/parser surface in the inspected AVM1 front end. The IMPL-050 bytes→IR→disassembly→bytes fixed-point criterion needs a concrete, testable resolution, not a text golden presented as equivalent evidence. |

## Audit findings to carry forward

1. **Tier-report CLI gap and naming mismatch:** the roadmap asks for `swfforge analyze --tiers`; the repository's existing executable is `forge-decompile`, and at baseline neither name had an `analyze` command. `inspect --actions` is only a disassembly surface, not the promised per-function tier report. The P5 CLI uses the established `forge-decompile` binary name.
2. **Stale phase status:** roadmap §2.2 says P5 onward is “not started,” while the baseline has a large AVM1 library and test suite. Update the status to distinguish existing implementation from phase exit acceptance.
3. **Test-ID collisions (resolved in C2):** baseline `docs/specs/language/040-avm1-to-typescript.md` and `docs/impl/transpiler/050-actions-and-avm1.md` reused identifiers such as language `T-AVM1-008` (coercion matrix) versus front-end tiering `T-AVM1-008`, and language `T-AVM1-025` (15-digit formatting) versus front-end nested Try. The IMPL-050 suite is now namespaced `T-AVM1-FE-001`…`T-AVM1-FE-030`; the language-spec `T-AVM1-*` identifiers remain unchanged. `verify_docs.py` now rejects any future cross-document AVM1 test-ID collision.
4. **Cross-phase ownership (disposition in C2):** `T-AVM1-FE-024` explicitly expects runtime timeline execution, owned by P7; `T-AVM1-FE-030` depends on DBCS/code-page authority from the font/text path. Neither is P5 proof. C2 recorded these forwards rather than pulling runtime/code-page work into the front end.
5. **Missing P5 robustness/corpus closeout:** IMPL-050 §13 requires 10^6 action-stream mutations with zero uncaught exceptions, tier reasons reviewed on an open corpus by two people, deterministic recovery across restarts, and opcode coverage/round-trip evidence. These are not established by the focused 88-test baseline.

## C1 authorization

C1 is limited to the roadmap's explicitly required `analyze --tiers` surface: stable JSON/human tier reporting for top-level executable action blocks and recursively nested function bodies, with each T2 reason visible, plus an AVM2 exit-3 regression. It does not implement the emitter or residual interpreter and does not claim open-corpus completion.
