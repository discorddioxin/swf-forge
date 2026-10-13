# P5 Checkpoint C1 — Per-Function Tier Report CLI

- **Date:** 2026-10-10
- **Branch:** `arena/07fdceae-swf-forge`
- **Baseline:** P5 C0 snapshot at `audits/P5-C0-AUDIT.md`
- **Scope:** Roadmap P5's missing `analyze --tiers` user surface. No P6 emitter or P7 AVM1 runtime work.

## Verdict

**C1 complete.** `forge-decompile analyze <file.swf> --tiers [--json]` now reports tier decisions for all analyzed top-level action blocks and recursively nested `DefineFunction*` bodies. Nested T2 decisions remain distinct from their parents, as required by IMPL-050-R059. The command is read-only and routes AVM2 movies through the existing `SF1000` / exit-3 gate.

This closes only the P5 **reporting CLI** gap. It is not P5 phase closeout and makes no claim about the open corpus, coercion suite, action-stream fuzzing, a residual interpreter, or P5's remaining test obligations.

## Delivered behavior

- Added `analyze <file.swf> --tiers`; `--json` emits a stable schema-versioned report with source digest, SWF metadata, per-entry ID/kind/role/name/parent, byte range, frame associations, T0/T1/T2, reason records, residual-byte count, and diagnostic summary.
- Reports include top-level timeline/init/clip-event/button action blocks and nested function bodies. Nested T2 bodies get their own row and do not force the containing action block to T2.
- Human output lists the same tier counts and reasons. Output order follows schedule order, then nested-function depth-first order.
- AVM2 reports identify the `DoABC`/`FileAttributes.ActionScript3` source and offset; `SF1000` yields exit code 3. `--help`, missing `--tiers`, missing input, strict open errors and unreadable inputs have explicit paths.
- Added `apps/decompiler/test/analyze.test.ts` for parent/child tier independence, residual reasons/bytes, deterministic JSON, human output, AVM2, help and argument/input errors.
- Refreshed the roadmap and CLI README to distinguish the pre-existing P5 library from phase completion and document the new command.

## Acceptance evidence

| Gate | Result |
|---|---|
| Focused P5 AVM1 + CLI tests | Pass — **10 files / 92 tests** |
| Full Vitest suite | Pass — **60 files / 693 tests** |
| `corepack pnpm typecheck` | Pass — all workspace and test TypeScript projects |
| `corepack pnpm build` | Pass — root build plus both applications |
| `corepack pnpm lint` | Pass — ESLint + Prettier |
| `corepack pnpm spec:verify` | Pass — `ISSUES: 0` |
| `corepack pnpm audit:dev` | Pass — `findings=52 known=57 new=0 fixed=5` |
| `git diff --check` | Pass |
| Built CLI smoke: `analyze fixtures/appendix-a.swf --tiers --json` | Pass — parses as JSON; 0 action blocks/functions, no AVM2, exit 0 |

The full audit still reports 12 unmapped diagnostics, including AVM1 `SF0405`–`SF0412`, `SF0417`–`SF0418`, and `SF0423`–`SF0424`. They are pre-existing known audit findings (`new=0`), but remain P5 audit-tool work rather than evidence that the AVM1 diagnostic catalog is fully reconciled.

## Checkpoint status after C2

- C2 is complete: the language/runtime gates and their owners are reconciled, and IMPL-050 IDs use `T-AVM1-FE-*`; see `P5-C2-AUDIT.md`. The language gates remain unwired and are not being claimed as P5 evidence.
- C3: audit opcode row completeness, synthetic disassembly/round-trip contract, and a dedicated action-stream fuzz target at the documented 10^6 mutation scale.
- C4: report/review tier reasons against the available open corpus and complete the P5 audit/resolution. Do not count synthetic fixtures as corpus evidence or invent a second reviewer.
- Keep runtime execution/budget obligations with their documented runtime owner unless an authority document explicitly moves them into P5.
