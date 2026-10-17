# P0 Closeout Audit — Foundations (temporary close-out roadmap, Wave 1 / P0-6)

- **Date:** 2026-10-16
- **Auditor:** Arena.ai Agent Mode
- **Branch:** `arena/11541273-swf-forge` at `8f24d89` (plus this audit)
- **Scope:** `IMPL-010` §8 test obligations and §11 done criteria, roadmap §6's P0 rows, measured
  after Wave 1 items P0-1…P0-4 landed. This audit re-measures; it does not re-open P1–P4.

## 1. Gate state at audit time

`corepack pnpm build`, `typecheck`, `test` (**82 files / 1,095 tests**), `lint`, `spec:verify`
(ISSUES 0), `audit:dev` (NEW FINDINGS 0), `test:audit`, `tag:coverage`, `code:lint`,
`corpus:verify` (73/73), `corpus:roundtrip:check` (no drift; 26 files / 25 projects / 800 gate
rows / exits `{"0":24,"1":1,"4":1}`) — all green locally at `8f24d89`.

## 2. `IMPL-010` §11 done criteria

| # | Criterion | Verdict | Evidence |
| --- | --- | --- | --- |
| 1 | Every §8 vector passes with exact equality (F1) on Node and in the browser runner | **Open — one row** | The shared vector table runs in both lanes with one pinned fingerprint (`io-vectors.lanes.test.ts`, CI `browser` job). `RECT`/`MATRIX`/`CXFORM` rows are asserted via the Appendix A rows and `T-SWF-014`'s `RECT` round trip. The sole blocker is the `UI32` row, whose Expected cell contradicts its own bytes — pinned in `VECTOR_TABLE_DISCREPANCIES`, filed as `E-033`, **awaiting a ruling (D1)**. The `fb19` entry is a reviewed non-defect (formatting of the same number) |
| 2 | Property tests pass at 10⁵ iterations with a fixed seed; failures print the counterexample bytes | **Pass** | `io-property.test.ts` (`T-SWF-014`, v1.10): 100,000 seeded values over 12 reader kinds, mismatches throw with kind, value and bytes |
| 3 | `T-SWF-015` demonstrates recovery after a deliberately corrupted record with no exception | **Pass** | `io.test.ts` + the strengthened `io-property.test.ts` cases: later values parse exactly after an invalid-width soft read and after an overlong `EncodedU32` mid-stream |
| 4 | Zero-allocation assertion for steady-state reads, by the §8 instrumented counter contract | **Pass** | `allocationCounter` (`io/counter.ts`, v1.11), `io-allocations.test.ts`: 0 primitive allocations over 10⁶ warm reads (byte- and bit-aligned classes), exactly 1 result object per record read, `SWF-R001` ≤ 1 payload copy over a ≥ 5 MiB in-memory `FWS` parse. Earned by making `float16`, `encodedU32` and `float32`/`float64` allocation-free on the hot path, not by exempting them |
| 5 | `codes.ts` contains every `SF00xx` literal; a lint rule fails the build on `SF\d{4}` outside it | **Pass, as scoped in §11.5** | `tools/check_codes.py` (`pnpm code:lint`, CI, unit-tested), scope ruled production-only (§11.5, v1.9): R1 registry membership, R2 no raw `code:` literal outside `codes.ts`, R3 no computed code. First run migrated the 10 raw literals in `packages/assets/src/images/decode.ts` |
| 6 | Changelog records divergences; errata filed for upstream's faults | **Pass** | Doc 010 at v1.11 with per-wave changelog rows; `E-033` is the standing example and remains open by design until D1 |

## 3. Roadmap §6 P0 rows

All rows now read **Delivered** except: the `UI32`/vector row (blocked on D1, above) — every other
row (browser lane vectors, zero-copy contract, allocation counter, `T-SWF-009` inventory, reader
fuzz target in the gated tree, diagnostic-literal lint) carries a test id or a tool in the gate
set. `WP-010-11` and `WP-010-12` are Done; doc 010's WP table has no open P0 package.

## 4. What still blocks the phase

Exactly one item, and it is not code:

- **D1 — the `UI32` ruling (`E-033`).** `1163342112` (the §8 Expected cell) is `0x45573120`,
  matching neither the row's hex label `0x456e7120` nor its bytes `20 71 6e 45` (both requiring
  `1164865824`). Options: (a) rule bytes-are-authoritative (the `E-025` class) — correct the cell
  to `1164865824`, remove the `ui32` pin, close `E-033`; (b) rule our transcription of the bytes
  is wrong — that requires the chapter text showing different bytes, which nobody in this
  repository has produced. The reader already implements the byte-derived value; option (a)
  changes one doc cell and one pin, no code.

**Recommendation:** P0 remains **In progress** until D1 is ruled. On an (a) ruling, the phase is
exit-ready on this audit's evidence and the roadmap §2 status can move to Completed in the same
commit that corrects the cell. No other P0 work is outstanding, and nothing in P1–P6 is blocked by
P0 in the meantime (the reader's behaviour is already the byte-derived one).

## 5. Non-findings (checked, correctly open elsewhere)

- `fixtures/PROVENANCE.md` (`registers/corpus.md` §4 item 1) is a corpus-register item feeding
  C3/C4 admission; the `T-SWF-009` inventory does not depend on it and does not discharge it.
- `E-005` (`MATRIX` rotation sign) stays open in the register but is dispositioned `resolved
  (v1.1)` in doc 010 §10 item 2 with `T-SWF-013` as its regression check; register reconciliation
  is a register edit, not P0 evidence.

---

**Addendum (2026-10-16, same day).** The user supplied the upstream SWF v19 specification, and
ruling D1 was taken from its Chapter 1 text rather than held for a decision meeting: upstream
prints the hex value and bytes with no decimal, so the disputed cell was our own miscomputation.
`E-033` is closed (errata 2.25; doc 010 v1.12; the `ui32` pin removed), §11 criterion 1 now passes
in full, and **P0 is marked Completed** (roadmap Draft 1.45). This addendum supersedes §4's
recommendation above, which was written before the text was available.
