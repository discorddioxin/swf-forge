# tools/ — document tooling

Three stdlib-only Python 3 scripts. No dependencies, no network, safe to run from any directory:

```bash
python3 tools/verify_docs.py            # document consistency gate — prints "ISSUES: 0" when clean
python3 tools/gen_status.py             # regenerates docs/impl/registers/STATUS.md
python3 tools/audit_dev.py              # code-vs-spec integrity ledger (pnpm audit:dev)
```

## `verify_docs.py`

Repository-wide checks that keep the specification set internally consistent. Exit code 0 = clean,
1 = issues. Run it before every commit that touches `docs/` (rule `TECH-R028`).

| # | Check |
| --- | --- |
| 1 | Changelog rows ascending and the header `Draft N.M` equals the last changelog row |
| 2 | Per-document work-package `Total` equals the sum of its rows; no duplicate `WP` numbers |
| 3 | `docs/impl/000-roadmap.md`'s work-package index and total equal the documents |
| 4 | Each diagnostic `SF####` has one owning document (010 may restate 020's container codes) |
| 5 | Each test id `T-*` is defined by exactly one document (declared shared ids excepted) |
| 6 | Test ids sit inside their document's band (`E-023`) |
| 7 | Every `<DOC>-Rnnn` / `<DOC>-Dnn` citation resolves in the owning design spec |
| 8 | `APP-R005`'s decision count equals the number of rows in the decision index |
| 8b | Every test id mentioned anywhere is defined somewhere (historical ids allow-listed) |
| 9 | No leftover "pending chapter" markers in implementation documents |
| 10 | Appendix sections 10.10–10.13 exist in the reference spec |
| 11 | Diagnostics tables are well-formed |
| 12 | Every document is listed in its layer's README and all three indexes point at `TECH-SPEC.md` |
| 13 | `TECH-SPEC.md` covers the five components, their app paths and their documents |
| 14 | Rule ids are defined exactly once and never cited without a definition |
| 15 | Every `docs/...md` path mentioned in any document exists |
| 16 | Every `specs/NNN` / `impl/NNN` id-form reference has a document |
| 17 | Every relative markdown link resolves |
| 18 | `docs/README.md` maps every document |

Add a check here whenever a new "the documents must agree" rule is introduced.

## `audit_dev.py`

The code-side companion to `verify_docs.py`: it keeps the *implementation* consistent with the
specification set and is the mechanised form of the audit in `audits/dev/`. Run it before a commit that
touches `packages/` or `apps/`.

```bash
python3 tools/audit_dev.py                    # human summary; exit 0 = no new findings
python3 tools/audit_dev.py --json             # machine-readable, for CI
python3 tools/audit_dev.py --update-baseline  # accept the current findings after a review
python3 tools/audit_dev.py --no-probe         # skip the Node probes (no build needed)
```

`audits/dev/baseline.json` is the ledger of findings that are known and accepted for now; keys are
`check:subject` and values count occurrences, so a new *site* of a known drift is a regression. Do not
combine `--update-baseline` with `--no-probe`: an incomplete run cannot rewrite the full ledger. Exit code
0 = nothing new, 1 = a finding appeared that the ledger does not record, 2 = invalid invocation or required checkout inputs missing.
The two probe checks (11, 12) need `pnpm build`; without it they report `skipped`, not failure. Output is
deterministic and every path it prints is repository-relative (`REPO-R015`).

| # | Check | Reads |
| --- | --- | --- |
| 1 | `registry` — constants, rows, severities, name/code agreement | `diagnostics/codes.ts` |
| 2 | `callsite` — every `emit(...)` severity equals the registry's | all `*.ts` |
| 3 | `doc` — the `§8` severity tables equal the registry | `docs/impl/**` |
| 4 | `coverage` — range allocation and documentation for every code | `docs/impl/**` |
| 5 | `unemitted` — codes no path can emit (dead diagnostics) | all `*.ts` |
| 6 | `rules` — `IMPL-NNN-Rnnn` definitions vs citations, two-part aware | docs + comments |
| 7 | `tests` — code citations resolve to canonical test rows in numbered spec docs; the historical allowlist is parsed from `verify_docs.py`; errata/STATUS are not declaration sources | numbered docs + source/tests |
| 8 | `imports` — cross-package restrictions, comment-stripped | `eslint.config.js`, sources |
| 9 | `determinism` — no clock/random/cwd/env on output paths | output modules |
| 10 | `version` — unreachable version-gated diagnostics | docs + modules |
| 11 | `dump` — R044–R048 run modes/bytes/order plus synthetic maps, labels, op fields and sprites, compared to IMPL-030/040 types | built CLI + temporary SWFs |
| 12 | `pins` — behavioural pins for the audit's blockers (probe) | built `swf` + fixture |
| 13 | `sources` — errata/STATUS rows cannot become definition sources and silently affect the audit | `docs/impl/registers/**` |

The check list and its current results are recorded in `audits/dev/03-mechanical-checks.md`; that
document also lists the blind spots found while building the script, which is the reason it does not
consist of greps.

## `gen_status.py`

Reads every `docs/impl/**/NNN-*.md` document (plus the status column of `docs/impl/README.md`) and
writes `docs/impl/registers/STATUS.md`: per-document work packages, dev-days, open items, tests,
diagnostics, and the chapter/appendix coverage table. The output is generated — never hand-edit it;
edit the documents and re-run the script. `verify_docs.py` check 7c fails if the snapshot's totals
disagree with the documents.

Both scripts are the first implementation work packages of the roadmap (`WP-140-08` in
`docs/impl/harness/140-conformance-harness.md`); when the real toolchain lands they move to
`packages/testing` or stay here as CI entry points, whichever the tech spec says at that point.
