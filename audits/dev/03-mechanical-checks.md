# Mechanical checks — the re-runnable half of the audit

`tools/audit_dev.py` is the code-side companion to `tools/verify_docs.py`. It mechanically checks the
findings in [`01-findings.md`](01-findings.md), emits per-code and per-test traceability tables, and
probes the built CLI/model where static scans are insufficient. It is a **ledger, not a conformance
certificate**: `audits/dev/baseline.json` stores known informational findings; a clean baseline is not
proof that the implementation conforms.

```bash
python3 tools/audit_dev.py                     # human summary; exit 0 = no new findings
python3 tools/audit_dev.py --json              # machine-readable coverage tables, for CI
python3 tools/audit_dev.py --update-baseline   # after review; requires full runtime probes
python3 tools/audit_dev.py --no-probe          # skip runtime probes; incomplete coverage only
pnpm test:audit                                # unit-test the collector
```

Exit codes: `0` means no findings beyond the reviewed baseline; `1` means a new finding; `2` means an
invalid invocation or required checkout input is missing. Do not combine `--update-baseline` with
`--no-probe`. Findings are keyed by `check:subject` and counted, so a new occurrence site for a known
key is still a regression.

## 1. Checks

| # | Check | What it verifies |
| --- | --- | --- |
| 1 | `registry` | Diagnostic constants, registry rows, severities, and name/code agreement. |
| 2 | `callsite` | Every statically recognized `emit(...)` severity agrees with the registry, including positional and object payloads, branching code expressions, and strict-length overrides. |
| 3 | `doc` | Per-code implementation §8 severity tables agree with the registry. |
| 4 | `coverage` | Registry codes have a single owning allocation and §8 row; overlaps are reported; documented-but-unregistered codes are counted by document. |
| 5 | `unemitted` | Production sink emissions, strict `SwfReadError` paths, source/test-only mentions, and unreferenced codes are distinct. Test-only calls cannot claim a production implementation. |
| 6 | `rules` | `IMPL-NNN-Rnnn` definitions and code-comment citations, including two-part `Rnnn` citations attributed by module ownership. |
| 7 | `tests` | Test citations resolve to canonical numbered-document declarations; declarations and the verifier's historical allowlist are parsed from their source of truth. Errata and generated STATUS are not declaration sources. |
| 8 | `imports` | Cross-package import restrictions match `eslint.config.js` after comments are stripped. |
| 9 | `determinism` | Output paths do not read clocks, randomness, working directory, or environment state. |
| 10 | `version` | Version-gated diagnostics are reachable from the owning implementation module. |
| 11 | `dump` | Dump run modes, exact JSON/`--out` bytes, key/order contracts, synthetic map/label/sprite/diagnostic fixtures, and emitted op fields against normative interfaces. |
| 12 | `pins` | Runtime pins for `DefineShape4` flags, v1 `0xFF` styles, declared sprite frames, and documented CLI flags. |
| 13 | `sources` | Errata and generated status registers cannot silently become rule, test, or diagnostic definition sources. |
| 14 | `emission-ownership` | Every registry code is emitted, exception-reported, or mapped to an existing roadmap WP; stale, missing, or nonexistent mappings fail. |
| 15 | `test-coverage` | Every declared test id is classified and reported with executable test/source citations and a work-package or document owner. |

Checks 11 and 12 need a build (`pnpm build`) for their runtime probes. `--no-probe` marks probe-only
keys as skipped, not fixed; static schema/interface checks still run. Temporary synthetic SWFs and
probe outputs are written outside the repository and removed when the run ends.

## 2. Verified current run

Verified on 2026-10-04 after `pnpm build`:

```text
audit_dev — 87 registry codes; 77 sink-emitted, 1 exception-reported, 9 deferred, 0 unmapped;
570 rules; 383 test ids (30 test-cited, 1 source-only, 352 scheduled/unwired)
SUMMARY findings=28 known=28 new=0 fixed=0
PROBE shape4 flags ok=5/5 v1-style-count=True
DUMP keys=9 frames=1 bytes=3023 synth={'clean': [], 'dirty': ['SF0023', 'SF0124', 'SF0116', 'SF0153']}
NEW FINDINGS: 0
```

The 28 baseline findings are informational: 10 `coverage.unregistered` rows for planned code ranges,
2 comment-only package-name mentions, and 16 `rules.uncited` document groups. They are visible in
verbose output; none masks a new F-01–F-24 defect. The baseline was regenerated from the full-probe
run, not copied forward from the earlier 71-occurrence ledger.

The registry-wide `emission_coverage` JSON table contains one row per code (code/name/severity/status,
owner, and source sites). Current exclusive statuses are 77 `emitted`, 1 `exception` (`SF0016`, owned by `WP-010-02`), 9
`deferred`, and 0 `unmapped`. `SF0013` also has a strict throw path, but remains `emitted` because it
has a soft sink-emission path. Deferred owners are validated against actual work-package rows in the
numbered implementation documents.

The `test_coverage` JSON table contains one row per declared test id, its declaration document, status,
test/source citation paths, and owning WP/document. Current totals are 30 `test-cited`, 1 `source-only`,
and 352 `scheduled-or-unwired`. The last category remains roadmap/test debt; an owner is traceability,
not evidence that the test already runs.

## 3. Collector regression coverage

`tools/test_audit_dev.py` contains seven passing unit tests covering:

- positional and object-form emissions, ternary code/severity branches, literals, comments, and strict
  exception paths;
- the distinction between a test-only emission and a production diagnostic path;
- real deferred-WP ownership and rejection of stale mappings after a code gains a producer; and
- attribution of declared tests to their owning work-package rows.

The collector intentionally derives its source sets and allowlists from `verify_docs.py` and numbered
specification tables instead of maintaining a second hand-edited test declaration list. It compares
`Dump*` output interfaces directly with the normative IMPL-030/040 field lists rather than only with the
current TypeScript model, avoiding a circular check in which both model and dump could omit the same
required field.

## 4. Baseline and remaining scope

`baseline.json` currently has 28 keys / 28 occurrences, all informational. To update it, first review a
full run with probes enabled; then run `python3 tools/audit_dev.py --update-baseline`. Baseline updates
must not be used to waive product defects or phase gates.

The collector exercises the Appendix A fixture and two purpose-built temporary SWFs. These probes do
not replace the corpus/fuzz harness, browser integration, or the open phase gates in
`docs/impl/000-roadmap.md` §2.2. In particular, P3 media export remains partial, P4's full/browser gate
is open, and P5 has not started. Test-id attribution also does not convert the 352 scheduled/unwired
requirements into executed tests.

`tools/README.md` documents the entry points and CI integration. The workflow at
`.github/workflows/ci.yml` runs the document gate, collector unit tests, typecheck, project tests, build,
lint, and the full audit; hosted CI results are not claimed by this local record.
