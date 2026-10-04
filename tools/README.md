# tools/ — document tooling

Two stdlib-only Python 3 scripts. No dependencies, no network, safe to run from any directory:

```bash
python3 tools/verify_docs.py            # consistency gate — prints "ISSUES: 0" when clean
python3 tools/gen_status.py             # regenerates docs/impl/registers/STATUS.md
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

## `gen_status.py`

Reads every `docs/impl/**/NNN-*.md` document (plus the status column of `docs/impl/README.md`) and
writes `docs/impl/registers/STATUS.md`: per-document work packages, dev-days, open items, tests,
diagnostics, and the chapter/appendix coverage table. The output is generated — never hand-edit it;
edit the documents and re-run the script. `verify_docs.py` check 7c fails if the snapshot's totals
disagree with the documents.

Both scripts are the first implementation work packages of the roadmap (`WP-140-08` in
`docs/impl/harness/140-conformance-harness.md`); when the real toolchain lands they move to
`packages/testing` or stay here as CI entry points, whichever the tech spec says at that point.
