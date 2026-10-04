# Conformance record — verified audit remediation

Companion to [`01-findings.md`](01-findings.md) and [`03-mechanical-checks.md`](03-mechanical-checks.md).
This records the current worktree evidence for F-01–F-24 and O-01–O-03; it does not replace the
normative rules in `docs/specs/` or `docs/impl/`. A green local run is evidence for the listed fixtures
and gates only, not proof of complete SWF conformance.

## 1. Verification run

Verified locally on 2026-10-04 after a successful build. Commands and outcomes:

| Gate | Result | Evidence |
| --- | --- | --- |
| `pnpm spec:verify` | PASS | `ISSUES: 0` |
| `pnpm test:audit` | PASS | 7 collector unit tests |
| `pnpm typecheck` | PASS | workspace and test TypeScript projects compile |
| `pnpm test` | PASS | 12 files, 83 tests |
| `pnpm build` | PASS | TypeScript projects and decompiler build |
| `pnpm lint` | PASS | ESLint and Prettier checks |
| `pnpm audit:dev --verbose` | PASS; 0 new findings | full built probes: Shape4 flags 5/5, v1 style-count probe true; dump probes pass |

The full-probe audit reports **87** registry codes: **77** sink-emitted, **1** exception-only
(`SF0016`, owned by `WP-010-02`), **9** explicitly deferred to existing work packages, and **0**
unmapped. `SF0013` is also raised on a strict exception path, but is classified as sink-emitted because
its soft path emits the diagnostic. The audit reports 570 implementation rules and 383 declared test ids. The dump probe reports 9
ordered top-level keys, one Appendix A frame and 3,023 bytes; its clean synthetic SWF has no diagnostics,
and the dirty synthetic SWF reports exactly `SF0023`, `SF0116`, `SF0124`, and `SF0153`.

After the full-probe run, `audits/dev/baseline.json` was refreshed from observed output. Its 28 entries
are informational only: 10 documented-but-not-yet-registered diagnostic-code ranges, 2 package-name
mentions found only in comments, and 16 implementation-rule groups with no code-comment citation. The
subsequent full audit reports `findings=28 known=28 new=0 fixed=0`; none is a remaining F-01–F-24 defect.
A known/clean baseline is not itself conformance evidence.

## 2. Findings F-01–F-24

Each original finding remains in `01-findings.md` with its normative rule and original defect evidence.
The following remediation evidence was exercised by the passing unit/integration suite, full runtime
probes, or document gate above.

| Finding | Verified resolution evidence |
| --- | --- |
| F-01 | `packages/swf/test/shape-regressions.test.ts` (`T-MOD-111–118`) and built Shape4 probe: all five meaningful/reserved-byte vectors pass. |
| F-02 | `shape-regressions.test.ts` (`T-MOD-113`) and built v1 `0xFF` probe: the count is literal 255 and the tag is consumed without an extended-count read. |
| F-03 | `packages/swf/test/framing.test.ts` (`T-SWF-001`): unavailable ZWS decoding reports `SF0006`. |
| F-04 | `apps/decompiler/test/inspect.test.ts` (`T-SWF-007`): duplicate definitions remain inspectable and the last definition wins lookup. |
| F-05 | `packages/swf/test/diagnostics.test.ts` (`T-SWF-024`) checks registry severity rows against implementation §8 tables; call sites agree. |
| F-06 | `packages/swf/test/fixture.test.ts` (`T-SWF-018`) pins lazy indexing and memoized tag-payload access. |
| F-07 | `packages/swf/test/model.test.ts` checks missing referenced characters are represented as `kind: 'missing'` and report `SF0110`. |
| F-08 | `packages/swf/test/io.test.ts` (`T-SWF-015`, `T-SWF-016`) pins soft zero/no-consumption and strict rejection for invalid bit widths. |
| F-09 | `shape-regressions.test.ts` (`T-MOD-112`, `T-MOD-116`) pins the pre-version diagnostic and dropping empty subpaths. |
| F-10 | `io.test.ts` (`T-SWF-015`) pins the soft cursor-at-limit post-condition and `subCursor` clamp diagnostic. |
| F-11 | `diagnostics.test.ts` (`T-SWF-024`) checks the narrowed `SF0009` severity; the overlong-value call site remains `info`. |
| F-12 | `docs/impl/foundation/020-container-tag-stream-dictionary.md` now agrees with `IMPL-020-R028`; `pnpm spec:verify` passes. |
| F-13 | `packages/swf/test/model.test.ts` (`T-MOD-601`) pins sprite padding to declared `FrameCount` and preserves the mismatch diagnostic. |
| F-14 | `model.test.ts` checks `frameOffset` and the scene-relative remap against the assembled model. |
| F-15 | `shape-regressions.test.ts` (`T-MOD-118`) checks byte-identical duplicates at the named ceiling for fill and line arrays. |
| F-16 | `model.test.ts` (`T-MOD-025`) checks `SF0166` only when `SetTabIndex` targets an empty depth. |
| F-17 | `apps/decompiler/test/inspect.test.ts` covers the CLI path; built audit pins verify `--strict` and `--tolerate-length` remain exposed. |
| F-18 | `packages/swf/test/io.test.ts` adds the `T-SWF-004`, `T-SWF-013`, `T-SWF-015`, and `T-SWF-016` numeric-reader vectors. |
| F-19 | `diagnostics.test.ts` (`T-SWF-024`) compares every exported registry code against the owning implementation severity table, not a hand-picked range. |
| F-20 | `fixedFromSigned` is absent from source and the public barrel; the dead identity helper is removed. |
| F-21 | `apps/decompiler/test/dump.test.ts` (`T-MOD-039`) and the synthetic dump probe verify `SetTabIndexOp.index` in both serialized locations. |
| F-22 | `dump.test.ts` (`T-MOD-029`) and the synthetic probe preserve same-frame `control.labels` file order while keeping the timeline label map sorted. |
| F-23 | `packages/swf/test/place-filters.test.ts` (`T-MOD-003`) checks `RemoveObject.characterId` and `null` for `RemoveObject2`; the dump probe checks the serialized field. |
| F-24 | `place-filters.test.ts` (`T-MOD-009`) checks PlaceObject3 image/class, filters and cache/backing metadata; the built dump probe compares emitted op fields to the normative interfaces. |

F-01–F-24 are resolved in the current worktree. The checks do not close unrelated phase gates: in
particular, parsed PlaceObject3 filter metadata does not mean filters are rendered.

## 3. Systemic observations O-01–O-03

### O-01 — Registry diagnostic ownership

The re-runnable collector now classifies every registry code as sink-emitted, strict-exception-reported,
or deferred to a real roadmap work package. Current coverage is 77 / 1 / 9 / 0 unmapped across 87 codes.
The nine deferred rows are `SF0025` and `SF0026` → `WP-020-08`; `SF0027` → `WP-020-03`; `SF0111` →
`WP-030-01`; `SF0115`, `SF0118`, and `SF0119` → `WP-030-06`; `SF0125` → `WP-030-06`; and `SF0127` →
`WP-030-07`. `SF0016` is separately reported through a strict `SwfReadError` path owned by `WP-010-02`.
The formerly reachable defects (`SF0006`, `SF0110`, `SF0166`, `SF0183`, `SF0185`, `SF1000`) now have
production paths. Check 14 emits the per-code `emission_coverage` table in JSON and fails on unmapped,
stale, or nonexistent work-package ownership.

**Assessment:** the former silent/unowned gap is addressed. Deferred codes remain roadmap work, not
claimed as implemented.

### O-02 — Test-id traceability

The current numbered specifications declare 383 test ids. The generated `test_coverage` table classifies
30 as `test-cited`, 1 as `source-only`, and 352 as `scheduled-or-unwired`; every row is attributed to its
owning work package or, if no work-package row exists, its defining document. Code/test citations with
no declaration still fail the collector. `pnpm test:audit` covers citation parsing and work-package
ownership, and CI runs it.

**Assessment:** traceability is now observable and checked on every audit run, but the table is not a
claim that 383 tests execute. The 352 scheduled/unwired rows remain implementation/test debt owned by the
roadmap. Future work must add tests at the owning phase gate; attribution alone does not make an
untested behavior conformant.

### O-03 — Code-aware review gates

`.github/workflows/ci.yml` now runs the document verifier, audit-tool unit tests, typecheck, project
tests, build, lint/format check, and the full development-integrity audit. The build precedes the audit's
runtime probes. All equivalent commands passed locally as listed in §1.

**Assessment:** code-aware gates are wired for pushes and pull requests. No hosted GitHub Actions result
is asserted by this local record; the workflow must still run in GitHub after the PR is opened.

## 4. SWF Specification 19 cross-checks retained

The implementation documents remain normative for repository behavior; the upstream cross-check was
used only to resolve the two relevant Ch.6 ambiguities:

| SWF Spec 19 text | Finding | Verified interpretation |
| --- | --- | --- |
| Ch.6 `DefineShape4`: reserved `UB[5]` followed by `UsesFillWindingRule`, `UsesNonScalingStrokes`, and `UsesScalingStrokes` | F-01 | Bit fields are consumed MSB-first; the low bits `0x04`, `0x02`, and `0x01` hold the three named flags. |
| Ch.6 `FILLSTYLEARRAY` / `LINESTYLEARRAY`: `0xFF` extension applies to Shape2/3/4, not `DefineShape` v1 | F-02 | In v1, `0xFF` is the literal count 255 and no `UI16` extension follows. |
| Ch.6 minimum-version notes for `DefineShape4` and `UsesFillWindingRule` | F-09 | The implementation diagnostic uses the tag's minimum version and the declared SWF version. |
| Ch.2 duplicate dictionary ids | F-04 | The chapter does not prescribe the repository's tolerant duplicate policy; `IMPL-020-R028` is the repository-level rule and remains authoritative. |

## 5. Phase and component gates

`docs/impl/000-roadmap.md` §2.2 remains the progress authority. P0–P2 have local regression coverage for
the listed reader/container/model slices, but open-corpus and fuzz gates remain outstanding. P3 media
work remains partial. P4 has Appendix A reference-renderer evidence only; browser integration and the full
P4 gate remain open. P5 AVM1 work has not started and must not begin before the P4 gate. No finding
remediation here promotes a work package or component to complete status.
