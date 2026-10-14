# tools/ — document tooling

The Python document-tooling scripts are stdlib-only, have no dependencies or network access, and are safe to run from any directory:

```bash
python3 tools/verify_docs.py            # document consistency gate — prints "ISSUES: 0" when clean
python3 tools/gen_status.py             # regenerates docs/impl/registers/STATUS.md
python3 tools/audit_dev.py              # code-vs-spec integrity ledger (pnpm audit:dev)
python3 tools/tag_coverage.py           # tag-by-tag decode coverage (pnpm tag:coverage)
python3 tools/adpcm_probe.py FILE.swf   # settles the ADPCM packet length from real files
python3 tools/adpcm_hunt.py             # goes and finds the files for it (network)
pnpm test:audit                         # unit tests for every tool above
```

The browser lane has its own Node tool:

```bash
pnpm browser:probe                      # what engine would the browser lane use? (JSON; exit 3 if none)
pnpm browser:install                    # fetch an engine where only the npm registry is reachable
pnpm test:browser                       # run packages/*/test/**/*.lanes.test.ts in that engine
```

The open-corpus lane is a third Node tool, and the only evidence in the repository that is not local
and synthetic:

```bash
pnpm corpus:fetch                       # download the pinned movies into .forge-cache/corpus/
pnpm corpus:verify                      # re-hash the cache against fixtures/open/manifest.json
pnpm corpus:report                      # build, then write audits/P5-C4-CORPUS-EXTERNAL.json
node tools/open-corpus.mjs list         # what the manifest pins, by group
```

`fixtures/open/manifest.json` is the committed half: upstream repository, pinned commit, licence, the
reuse basis, and a sha256 per file. The bytes are **never** committed — doc 020 sanctions exactly three
roles for a committed binary and an external movie is none of them — so the cache is gitignored and
`report` refuses to run on a partial corpus. Transport is `raw.githubusercontent.com`, then the
`api.github.com` contents endpoint, then the same URL through `curl`, because Node's undici ignores
`HTTPS_PROXY` and is blocked outright in some sandboxes where `curl` works. Set `GITHUB_TOKEN` to lift
the contents API off its 60-requests-per-hour unauthenticated limit. Class C4-c of
`docs/impl/registers/corpus.md` describes the selection and what the report does and does not
discharge; `E-034` and `E-035` in `docs/impl/registers/errata.md` are what running it found.

The AVM1 process-restart probe is a separate Node tool: `corepack pnpm test:avm1-restart` builds the workspace, then compares synthetic direct-analysis and CLI reports across fresh processes. The fixture includes T0, T1 (`dynamic-pool`), and T2 (`unknown-opcode`) entries, recovered names, and non-empty requirements; the evidence is local and synthetic only, not open-corpus evidence. Its hashes and report summary are recorded in `audits/P5-C4-RESTART-PROBE.json`.

`adpcm_hunt.py`, `browser-lane.mjs` and `open-corpus.mjs` are the three exceptions to "no network": the
first exists to search GitHub and npm for Flash content, the second to fetch a browser engine, the third
to fetch the licensed external corpus. Everything else is offline.

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
| 5 | `unemitted` — production sink emissions are distinguished from strict `SwfReadError` paths and mere references; test-only emits cannot claim implementation | source + tests |
| 6 | `rules` — `IMPL-NNN-Rnnn` definitions vs citations, two-part aware | docs + comments |
| 7 | `tests` — citations resolve to canonical test rows; every declared id is classified as test-cited, source-only, or scheduled/unwired and linked to a WP/document; the historical allowlist is parsed from `verify_docs.py`; errata/STATUS are not definition sources | numbered docs + source/tests |
| 8 | `imports` — cross-package restrictions, comment-stripped | `eslint.config.js`, sources |
| 9 | `determinism` — no clock/random/cwd/env on output paths | output modules |
| 10 | `version` — unreachable version-gated diagnostics | docs + modules |
| 11 | `dump` — R044–R048 run modes/bytes/order plus synthetic maps, labels, op fields and sprites, compared to IMPL-030/040 types | built CLI + temporary SWFs |
| 12 | `pins` — behavioural pins for the audit's blockers (probe) | built `swf` + fixture |
| 13 | `sources` — errata/STATUS rows cannot become definition sources and silently affect the audit | `docs/impl/registers/**` |
| 14 | `emission-ownership` — every registry code is sink-emitted, exception-reported, or explicitly deferred to a real roadmap WP; stale/unowned mappings fail | registry, source call sites, WP tables |
| 15 | `test-coverage` — emits a declared-test coverage table with executable test/source citations and WP/document owners; undeclared citations fail | numbered docs, work-package rows, source/tests |

`pnpm test:audit` unit-tests the collector's branch-aware emission scanner, exception detection,
production-vs-test distinction, deferred-WP mapping and test-id ownership parsing. The current checks
and recorded outcomes are in `audits/dev/03-mechanical-checks.md`. CI runs the docs gate, collector
unit tests and `pnpm audit:dev` after building its runtime probes.

## `adpcm_probe.py`

An evidence-gathering tool for one open question, recorded in `audits/P3-C5-AUDIT.md` §9 and
`audits/P3-ADPCM-PACKET-LENGTH.md`: does an ADPCM packet emit **4096** samples (`InitialSample`
plus 4095 coded frames — what `packages/audio` implements) or **4095** (the header sample being a
predictor seed that is never output — what `ruffle` does)?

The question is decidable without decoding any audio. The two readings need different numbers of
packets for the same declared `SoundSampleCount`, so they predict different payload lengths:

```
reading A:  packets = ceil(N / 4096)   codes = N - packets
reading B:  packets = ceil(N / 4095)   codes = N
bytes       = ceil((2 + packets*22*channels + codes*codeWidth*channels) / 8)
```

`A` always predicts fewer bytes. A real payload that is long enough for `A` but **too short for
`B`** proves `A` outright. The tool scans `DefineSound` and `SoundStreamBlock` payloads, computes
both predictions, and reports per-asset and corpus-wide verdicts. It also prints the two
"trailing packet padded out to full" predictions, which is the evidence for the *second* open
question owned by `T-AUD-102`.

```bash
python3 tools/adpcm_probe.py --census ~/swfs      # does this corpus contain any ADPCM at all?
python3 tools/adpcm_probe.py ~/swfs               # verdicts, human-readable
python3 tools/adpcm_probe.py --json ~/swfs        # same, machine-readable
python3 tools/adpcm_probe.py --quiet ~/swfs       # only files that yielded a verdict
```

Accepts files, globs or directories (scanned recursively), and reads uncompressed, zlib and LZMA
SWFs. `test_adpcm_probe.py` validates it by synthesising SWFs encoded under *each* reading and
asserting the probe names the right one — the tool is not trusted on the strength of its own
arithmetic.

## `adpcm_hunt.py`

`adpcm_probe.py` answers the question the moment it is handed a suitable file; the hard part is
*getting* one. This tool does the looking, so the question does not stall on a manual file hunt.

It searches GitHub and npm for repositories and packages that vendor Flash **content** (games,
ads, demos, archives — not player or decompiler test suites, which carry no ADPCM), streams each
archive, keeps only the `.swf` members, scans them, and runs the probe on anything containing
ADPCM. Archives are discarded as it goes and files are deduplicated by SHA-256, so a long hunt
costs little disk and a widely-vendored asset cannot manufacture false confidence by being
counted twenty times.

```bash
python3 tools/adpcm_hunt.py                       # default hunt
python3 tools/adpcm_hunt.py --max-sources 500     # wider
python3 tools/adpcm_hunt.py --repo owner/name     # a corpus you know of
python3 tools/adpcm_hunt.py --stop-on-hit         # stop as soon as a verdict is reached
```

Resumable — every source visited is recorded in a state file and re-running skips it — and
Ctrl-C still writes the report. Set `GITHUB_TOKEN`, or have `gh` logged in, and search runs at
30 requests/minute instead of 10. The report is the JSON evidence bundle for the audit record.

`test_adpcm_hunt.py` validates it offline: archives are built containing SWFs whose ADPCM content
and correct verdict are known, and the hunter must find them, keep them, dedupe them, respect its
size caps, survive corrupt input and report the right answer — including raising `CONFLICT` when
given deliberately contradictory evidence.

## `gen_status.py`

Reads every `docs/impl/**/NNN-*.md` document (plus the status column of `docs/impl/README.md`) and
writes `docs/impl/registers/STATUS.md`: per-document work packages, dev-days, open items, tests,
diagnostics, and the chapter/appendix coverage table. The output is generated — never hand-edit it;
edit the documents and re-run the script. `verify_docs.py` check 7c fails if the snapshot's totals
disagree with the documents.

## `browser-lane.mjs`

Node, standard library only (no `node_modules`, no build step), three subcommands. It exists so the
browser lane of roadmap §4.2 has a resolvable engine on hosts where the ordinary installer cannot
reach the network.

- **`probe`** — prints a JSON report of the engine the lane would use and exits 0, or prints the
  reason and exits **3** when no engine is usable. Resolution order: `SWF_FORGE_BROWSER_EXECUTABLE` →
  the cache this tool fills (`~/.cache/swf-forge-browser`) → Playwright's own registry
  (`~/.cache/ms-playwright/chromium-*/chrome-linux/{headless_shell,chrome}`, the normal CI path) →
  a system browser on `PATH` (`headless_shell`, `chromium`, `chromium-browser`, `google-chrome`,
  `google-chrome-stable`). `vitest.browser.config.ts` calls this and passes `executablePath` through
  `providerOptions.launch` only when the engine is *not* Playwright's own managed build.
- **`install`** — restricted-network fallback. Downloads `@sparticuz/chromium` from
  `registry.npmjs.org` (an allowed host), brotli-expands `bin/chromium.br` and `bin/al2023.tar.br`
  into `~/.cache/swf-forge-browser`, and verifies the engine reports a version before exiting 0.
  About 70 MB down, 203 MB on disk, ~3 s. Linux x64 only. The package's documented
  `executablePath()` API does not exist at 153.0.0, and `chromium.br` is a bare ELF despite its
  sibling's `*.tar.br` naming — both are handled here rather than in the config.
- **`env`** — prints the `LD_LIBRARY_PATH`/`SWF_FORGE_BROWSER_EXECUTABLE` exports for a shell, for
  driving the engine by hand.

Nothing is committed: `~/.cache` is outside the repository, and the engine is reproducible from the
registry, which is what `REPO-R017` requires of large binaries. The cache is disposable — deleting it
costs one `install`. Ordinary development and CI never need this tool at all: `pnpm exec playwright
install chromium` populates the registry path the probe already searches.

These tools are the first implementation work packages of the roadmap (`WP-140-08` in
`docs/impl/harness/140-conformance-harness.md`); when the full test toolchain lands they move to
`packages/testing` or stay here as CI entry points, whichever the technical specification requires.
