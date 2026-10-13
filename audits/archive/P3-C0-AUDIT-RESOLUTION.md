# P3 Audit Resolution — Checkpoint C0 (baseline snapshot)

C0 is, by design, a read-only baseline. No code changes, no defect fixes, no new tests are introduced at C0. The baseline is captured in `P3-AUDIT.md` (verdicts, gate table, source inventory, test-obligation ledger, deferred-diagnostic snapshot, wire/tag coverage, findings, done-criteria status).

## 1. Per-finding disposition

All 8 C0 findings (F-P3-01…F-P3-08) are tracked but **not fixed in C0**. Each is assigned to an owning checkpoint:

| Finding | Severity | Owner checkpoint |
|---|---|---|
| F-P3-01: six font/text auxiliary tags lack decoders (10/13/62/73/74/88) | moderate | C1 |
| F-P3-02: JPEGTables not modelled (only scanned by assets dump) | moderate | C1 |
| F-P3-03: Shape Vector-IR missing gradient/LINESTYLE2/path-build/quantise/bounds-check | moderate | C2 |
| F-P3-04: morph IR endpoints/style-pairs untested, SF0262/263 deferred | minor | C3 |
| F-P3-05: JPEG-splice/lossless-padding/PNG-passthrough parity untested | minor | C3 |
| F-P3-06: MP3 pass-through/stream-split/chunk/peak-RMS untested | minor | C5 |
| F-P3-07: asset-dump goldens/determinism/unsupported branches missing | minor | C6 |
| F-P3-08: swf → audio dependency noted (observation, accepted) | observation | accepted |

## 2. Baseline gate table

| Gate | C0 result |
|---|---|
| Baseline commit | `21cfd3e` (+ uncommitted P1/P2 fixes) |
| Typecheck (8 projects) | ✅ |
| Test files / tests | **47 / 458** pass (12 P3 files / 64 P3 tests pass) |
| Lint + Prettier | ✅ |
| Build | ✅ tsc -b + 2 apps |
| `spec:verify` | ISSUES 0 |
| `tag:coverage` | 50 decoded / 7 pending / 5 retained / 3 structural = 65 |
| `audit:dev` | findings=52 / known=57 / new=0 / fixed=5 |
| P3-owned deferred SF codes | 11 (SF0262/263/272/273/277/278/279/281/283/284/329); 2 stay deferred (SF0279→P9, SF0329→P6) |
| P3 tags decoded (full / dispatched / missing) | 22 full / 2 partial (morph IR) / 7 missing decoder |

## 3. Administrative actions

- Created `audits/P3-CHECKPOINTS.md` (C0–C7 sequencing plan) in the prior turn.
- Created `audits/P3-AUDIT.md` (this snapshot's primary audit).
- Created `audits/P3-AUDIT-RESOLUTION.md` (this file).
- The existing P1/P2 audit files (`audits/P1-AUDIT*.md`, `audits/P2-AUDIT*.md`) remain in place; archived audits remain in `audits/archive/`.

## 4. Verdict

C0 is **complete**. The baseline is captured and gates are green. No fixes applied; no code churn. Proceed to **C1 — Wire/tag foundation sweep**.
