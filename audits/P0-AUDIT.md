# P0 audit — Foundations acceptance bottleneck

- **Date:** 2026-10-11
- **Branch:** `arena/07fdceae-swf-forge`
- **Scope:** P0 in `docs/impl/000-roadmap.md` §§2 and 6; `docs/impl/foundation/010-binary-io-and-records.md` §§8–11; parser zero-copy contract `docs/specs/format/030-swf-format-and-io.md` SWF-R001.
- **Companion plan:** [`P0-AUDIT-RESOLUTION.md`](P0-AUDIT-RESOLUTION.md).
- **Method:** read-only comparison of normative obligations, implementation, test code, test configuration, and CI; searched for each required test ID and the declared reader-fuzz target. Ran the focused IO/container/diagnostics gate suite.

## 1. Verdict

**P0 remains in progress and is not exit-ready.** The current build and test suite are green, but several P0 obligations are absent or only partially demonstrated. The bottleneck is primarily an acceptance-evidence and measurement gap, not a known failure of the primitive-reader implementation. This audit does not infer that untested reader behavior is correct.

The focused run passed **4 files / 58 tests**:

```text
corepack pnpm test -- packages/swf/test/io.test.ts packages/swf/test/framing.test.ts \
  packages/swf/test/diagnostics.test.ts packages/swf/test/container.test.ts
```

The broader same-checkout verification snapshot also passed build, typecheck, the full suite (62 files / 718 tests), lint, and `tools/verify_docs.py` (`ISSUES: 0`). Those results establish a healthy shared gate stack; they do not close the missing P0-specific obligations below.

No reader code or tests were changed during this audit.

## 2. Acceptance scope and boundary

P0 is the binary-reader and primitive-record foundation. Its phase exit table in roadmap §6 requires:

1. `ByteReader`/`BitReader` hand-computed `T-SWF-001…004` vectors;
2. `EncodedU32`, `FLOAT16`, `FB[n]`, `RECT`, `MATRIX`, `CXFORM`, and color records;
3. a 5 MiB parser zero-copy/allocation-count check; and
4. diagnostic codes with scope.

`IMPL-010` adds explicit evidence obligations in §8 and six document done criteria in §11. Some shared tests live in doc 020 because `T-SWF-001` and `T-SWF-003` cover container framing. P1's full-SWF mutation smoke is useful but is not the missing low-level reader fuzzer in `WP-010-12`. Likewise, `T-SWF-012` and `T-SWF-021` are useful adjacent evidence, not automatic substitutes for `T-SWF-009`, `T-SWF-017`, or the 5 MiB SWF-R001 acceptance.

## 3. Evidence inventory

| Obligation | Current evidence | Audit disposition |
| --- | --- | --- |
| `T-SWF-001` header/version/compression matrix | `packages/swf/test/container.test.ts`; P1 audit-resolution records the header matrix run | Existing shared evidence; do not duplicate or misattribute its P1 ownership. |
| `T-SWF-003` short/long record-header boundary | `packages/swf/test/framing.test.ts` has the 62/63 boundary | Existing Node evidence. |
| `T-SWF-004` exact primitive vectors | `packages/swf/test/io.test.ts` labels two cases: signed 32-bit boundaries and `FB[19] = 3.0`. Other feature tests exercise some primitives, but there is no row-by-row inventory demonstrating every vector in `IMPL-010` §8. | Partial; the complete vector table and host matrix are unverified. |
| `T-SWF-009` parse determinism | No `T-SWF-009` test exists in the test tree. `T-SWF-012` opens one synthetic corpus twice and fingerprints tag refs, definitions, and diagnostics. | Not equivalent to the requirement to compare offsets and values for every fixture. |
| `T-SWF-013` MATRIX rotation | `packages/swf/test/io.test.ts` asserts +90° maps right to down in SWF's y-down coordinates | Explicit Node test passed. |
| `T-SWF-014` property fixed point | No `T-SWF-014` test or 10⁵-iteration writer/reader property gate exists. `ByteWriter` exists, but writer presence is not property evidence. | Missing. |
| `T-SWF-015` soft recovery | The two tests bearing this ID exercise an invalid bit width and out-of-bounds cursor reads/sub-cursors. They do not corrupt a bounded record, assert its diagnostic, and then prove a later record still parses. | Test citation is narrower than the obligation. |
| `T-SWF-016` strict error | The test asserts that an invalid-width call throws `SwfReadError` and that the cursor position stays unchanged. It does not assert the thrown error's `code` or `offset`, although `SwfReadError` exposes both fields. | Partial; the declared error contract is not fully tested. |
| `T-SWF-017` warm-cursor allocation gate | No `T-SWF-017` test or allocation-counter harness exists. | Missing. |
| `T-SWF-024` severity registry | `packages/swf/test/diagnostics.test.ts` checks every registered severity against the owning implementation table. | Present and passed in the focused run. |
| SWF-R001 / 5 MiB parser copy bound | `T-SWF-021` checks that one tag payload is a view into `file.body` and is memoized. It does not parse a 5 MiB file or count payload-byte copies/allocations. `Cursor.viewBytes()` uses `subarray`; `takeBytes()` and `rest()` use copying `slice` operations. | Partial implementation evidence, no phase-level memory/copy acceptance. |
| `WP-010-12` reader fuzzer | `tools/fuzz/readers.ts` is absent. `packages/swf/test/fuzz.test.ts` mutates one synthetic whole SWF through `openSwf`; that is not a per-reader target. | Work-package deliverable missing or undispositioned. |
| Browser execution of vectors | `vitest.config.ts` sets `environment: 'node'`; `.github/workflows/ci.yml` runs the Node suite and has no browser-test job. | `IMPL-010` §11 criterion 1's browser-runner half is unproven. |
| Diagnostic literal ownership | `eslint.config.js` has no rule banning `SF####` literals outside the registry. `diagnostics/types.ts` contains an `SF0001` literal, and tests contain literal expected codes. `audit_dev.py` checks registry/emission relationships but is not the specified lint rule. | Criterion 5 is unenforced and its production-vs-test scope needs to be made explicit. |

## 4. Findings

### F-P0-01 (blocking) — The primitive-vector obligation has no complete, cross-host ledger

`IMPL-010` §8 defines a concrete vector table and §11 criterion 1 requires exact equality in both Node and a browser test runner. The `T-SWF-004`-labelled coverage in `io.test.ts` is only two cases; feature-level tests do not provide a row-by-row proof that every primitive vector passes. The configured Vitest environment and CI are Node-only. Existing `T-SWF-001`/`003` and `T-SWF-013` evidence should be retained, but it does not fill this gap.

**Impact:** roadmap P0 gate and `IMPL-010` done criterion 1 cannot be marked complete based on the current citations.

### F-P0-02 (blocking) — `T-SWF-009` is absent; `T-SWF-012` is a narrower test

`T-SWF-012` compares two opens of one generated synthetic corpus. Its fingerprint covers tag refs, definitions, and diagnostics, but not every fixture and every decoded value required by `T-SWF-009`. The test is useful and must remain; it does not close the all-fixture repeat-parse obligation.

**Impact:** deterministic offsets/values across the declared fixture corpus are not yet acceptance evidence.

### F-P0-03 (blocking) — The 10⁵ fixed-point property gate is missing

There is no `T-SWF-014` test. The existing writer utilities and the general fuzz smoke do not establish a seeded writer → reader → writer fixed point over 10⁵ values or the required counterexample report.

**Impact:** `IMPL-010` §11 criterion 2 and `WP-010-11` remain open.

### F-P0-04 (blocking) — The soft/strict test IDs do not prove their full contracts

The `T-SWF-015` cases test cursor-level invalid widths and bounds recovery, not a deliberately corrupt record followed by successful parsing of a later record. The `T-SWF-016` case checks the error class, but not `SwfReadError.code` and `SwfReadError.offset`.

**Impact:** the test IDs currently overstate what is demonstrated; `IMPL-010` §11 criterion 3 and the strict error contract remain open. This is an evidence gap, not a finding that runtime behavior is necessarily wrong.

### F-P0-05 (blocking) — Neither allocation obligation has a measured acceptance test

`T-SWF-017`'s zero-allocation warm-cursor test is absent. Separately, the roadmap's 5 MiB SWF-R001 gate has no test that measures the declared payload-copy/allocation bound. `T-SWF-021` proves view identity for one payload, not the whole-file 5 MiB budget. The implementation has both view-producing and copy-producing cursor APIs, so the measurement must distinguish payload-byte copies from ordinary setup/diagnostic-object allocations.

**Impact:** `IMPL-010` §11 criterion 4 and the roadmap's P0 zero-copy criterion remain open. The exact counter/metric is not specified tightly enough to accept a noisy heap-size delta as proof.

### F-P0-06 (material) — The P0 raw-reader fuzz work package is not delivered

`IMPL-010` §9 lists `WP-010-12` as `tools/fuzz/readers.ts`, wired into the doc 140 harness. No such file exists. The current 10⁴-mutation gate targets `openSwf` with one synthetic movie; it does not systematically call the primitive readers with malformed byte buffers, offsets, bounds, and bit widths.

**Impact:** the work-package index has an undispositioned P0 deliverable. The phase owner must either complete this target or record an explicit, reviewed forward/deferral; do not count the whole-SWF fuzz test as the same target.

### F-P0-07 (material) — Diagnostic-code literal ownership is not enforced as specified

`IMPL-010` §11 criterion 5 requires a build-failing lint rule for `SF\d{4}` outside `codes.ts`. The current ESLint config has no such rule. The criterion's scope is also ambiguous because expected diagnostic strings appear in tests and `diagnostics/types.ts` contains a literal type member.

**Impact:** the registry currently has positive consistency evidence (`T-SWF-024`), but the stated source-ownership invariant is not enforced. Resolve its scope and add the specified guard before claiming the document's done criteria all pass.

## 5. Non-blocking specification questions

`IMPL-010` §10 items 3 and 4 remain open at low risk: whether an AVM1-era structure consumes `FLOAT16`, and whether `SI24` exists in scope. This audit did not resolve either question. Carry them through closeout as explicitly open/non-blocking only after checking the consuming-format tables and recording that disposition; do not silently mark them solved by the current absence of a grep result.

The already-resolved FLOAT16 and MATRIX errata, and the `T-SWF-024` registry-severity test, are not P0 bottlenecks in this audit.

## 6. Bottleneck diagnosis

The codebase has the reader primitives, a synthetic `ByteWriter`, a bounded full-SWF fuzz smoke, and passing general validation. The phase is blocked because the acceptance contract is not fully operationalized: some obligations have no tests, some cited IDs cover weaker behaviors than their normative rows, the browser lane is absent, and the two allocation requirements lack a reproducible measurement definition. The bottleneck is therefore **spec-to-test traceability plus a missing measurement/test harness**, not simply a red CI run.

No T-SWF obligation is waived by this diagnosis. P0 should remain **In progress** until the companion plan is carried out or any contract change is explicitly reviewed and recorded in the owning spec's changelog/errata.
