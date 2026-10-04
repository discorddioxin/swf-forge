# Mechanical checks — the re-runnable half of the audit

`tools/audit_dev.py` is the mechanised form of `01-findings.md`: twelve checks that decide, by reading
the code or running it, which of the audit's findings are still live. It is a **ledger**, not a report —
`audits/dev/baseline.json` records the findings that are known and accepted for now, the script exits
non-zero only when something *new* appears, and a fixed finding prints as `[fixed]`.

```bash
python3 tools/audit_dev.py                  # human summary; exit 0 = no new findings
python3 tools/audit_dev.py --json           # machine-readable, for CI
python3 tools/audit_dev.py --update-baseline  # after a deliberate, reviewed change
python3 tools/audit_dev.py --no-probe       # skip the Node probes (no build needed)
pnpm audit:dev                              # same as the first form
```

Baseline semantics: keys are `check:subject` and the value counts occurrences, so a *new site* of a
known drift is a regression too. The ledger is regenerated deterministically (no timestamps, sorted
keys) — verified by running `--update-baseline` twice and comparing bytes.

## 1. The twelve checks

| # | Check | What it proves | Specification behind it |
| --- | --- | --- | --- |
| 1 | `registry` | `codes.ts` parses; every constant has a severity row; code/name agree; severities are in vocabulary | `IMPL-010` §7 |
| 2 | `callsite` | every `emit(...)` site's severity equals the registry's, positional and object payloads, including branching `code:` fields | `IMPL-010` §7, doc §8 tables |
| 3 | `doc` | every per-code `§8` table severity equals the registry's | the documents' own diagnostics tables |
| 4 | `coverage` | every registry code is covered by a range allocation (table **or prose**) and documented in a `§8` table; aggregates documented-but-unregistered codes per document | `IMPL-010` §7 allocation block |
| 5 | `unemitted` | a code is *emitted* only if some `emit(...)` can produce it; codes that no path can emit are reported, split into never-referenced and mentioned-only | `IMPL-010` §7 (the registry is reachable or it is dead) |
| 6 | `rules` | every `IMPL-NNN-Rnnn` is defined once, and citations in code comments resolve — full form and the two-part bare `Rnnn` form attributed by the owning module | `TECH-R009`, `IMPL-140` §6 |
| 7 | `tests` | `T-XXX-nnn` citations in code are declared by a document; the `HISTORICAL_TEST_IDS` allowlist is still needed | `TECH-R009`, `verify_docs.py` checks 5/8b |
| 8 | `imports` | cross-package import restrictions hold **after comment stripping**, and the check fails if `eslint.config.js` no longer encodes the same restriction | `TECH-R005`, eslint `no-restricted-imports` |
| 9 | `determinism` | no `Date`/`Math.random`/`process.cwd`/`process.env`/`performance.now` on output paths | `TECH-R010`, `IMPL-040-R045` |
| 10 | `version` | version-gated diagnostics whose owning module never reads the file version are reported as unreachable | doc `§8` rows, `IMPL-060-R005` |
| 11 | `dump` | the model dump's documented key order, key sets, op shape, determinism, `--out` byte equality and file set | `IMPL-040-R044`–`R048` |
| 12 | `pins` | behavioural and source pins for the audit's blockers: `DefineShape4` flag bytes, the `DefineShape` v1 `0xFF` count, sprite frame padding, documented CLI flags | `IMPL-060-R004`/`R006`, `IMPL-020-R024`, `SWF-D03` |

Checks 11 and 12 run Node probes against the built `dist/` and against `fixtures/appendix-a.swf`; they
report `skipped` (not failure) when the package has not been built, so the script is usable from a fresh
clone. The probe source is embedded in the Python file (`PROBE_JS`) and written to a temporary
directory, so nothing is left in the worktree.

## 2. The recorded run

At HEAD `1167257`, `pnpm build` executed, `fixtures/appendix-a.swf` present:

```text
audit_dev — 87 registry codes, 16 never referenced, 570 rules defined, 382 test ids declared
SUMMARY findings=62 known=62 new=0 fixed=0
PROBE shape4 flags ok=1/5 v1-style-count=False
DUMP keys=9 frames=1 bytes=2902
NEW FINDINGS: 0
```

Occurrences per check and severity:

| Check | Occurrences | Distinct keys | Severities |
| --- | --- | --- | --- |
| `callsite` | 6 | 3 | error |
| `coverage` | 10 | 10 | info |
| `doc` | 2 | 2 | error |
| `imports` | 2 | 2 | info |
| `pins` | 8 | 5 | error, warning |
| `rules` | 16 | 16 | info |
| `unemitted` | 17 | 17 | info |
| `version` | 1 | 1 | warning |
| **total** | **62** | **56** | 14 error · 3 warning · 45 info |

The two decisive probe rows, verbatim (this is the evidence that `F-01` and `F-02` are live, produced
by the same binary the tests run):

```text
DefineShape4 flag byte 0x01: got {f: evenOdd, ns: false, sc: false, warn: true}
                            want {f: evenOdd, ns: false, sc: true,  warn: false}
DefineShape4 flag byte 0x02: got {f: evenOdd, ns: false, sc: false, warn: true}
                            want {f: evenOdd, ns: true,  sc: false, warn: false}
DefineShape4 flag byte 0x04: got {f: evenOdd, ns: false, sc: false, warn: true}
                            want {f: nonZero, ns: false, sc: false, warn: false}
DefineShape4 flag byte 0xf8: got {f: nonZero, ns: true, sc: true, warn: true}
                            want {f: evenOdd, ns: false, sc: false, warn: true}
DefineShape v1 with 0xFF styles: decoded 1 styles and consumed 252/1028 bytes
```

`0x04` is `UsesFillWindingRule` and must select `nonZero`; `0xf8` is five reserved bits and must warn
*without* setting stroke hints. Neither holds, and the v1 decoder consumes 252 bytes of a 1028-byte tag.
The dump probe, by contrast, passes every documented property: nine top-level keys in the documented
order, one frame, 2902 bytes, byte-identical across two runs of `--json` and equal to the `--out` file.

## 3. Reconciliation with `01-findings.md`

| Audit finding | Mechanical key(s) | Note |
| --- | --- | --- |
| F-01 blocker — `DefineShape4` flag bits | `pins.shape4-flags` ×4 | runtime probe, four flag bytes |
| F-02 blocker — v1 `0xFF` count | `pins.v1-style-count` | runtime probe, bytes consumed prove the desync |
| F-03 — `ZWS` reports `SF0003` | `unemitted:SF0006` | the dead-code key *is* the pin: emitting `SF0006` flips it to `fixed` |
| F-04 — duplicate-id policy | — | needs a two-definition fixture; not yet written |
| F-05 — `SF0190`/`SF0191` severities | `doc.severity:SF0190`, `doc.severity:SF0191`, `callsite.severity:SF0190`, `callsite.severity:SF0191` ×4 | registry is the wrong side of all six rows |
| F-06 — lazy `readTag` | — | no source-level invariant; would need a behavioural test |
| F-07 — `kind: 'missing'` / `SF0110` | `unemitted:SF0110` | |
| F-08 — `bits > 32` | — | needs the cursor unit test `T-SWF-016` (F-18) |
| F-09 — `SF0183`/`SF0185` dead | `version.unreachable:SF0183`, `unemitted:SF0185` | check 10 was written for this finding |
| F-10 — cursor post-condition, `subCursor` | — | needs a cursor unit test |
| F-11 — `SF0009` severity | `callsite.severity:SF0009` | check 3 cannot see it: the doc's `§8` row says "warning / info", so it is recorded as ambiguous. The fix must narrow the row (as `01-findings.md` says) before check 3 covers it |
| F-12 — `§8` row contradicts `R028` | — | prose-vs-prose contradiction; a future check could compare a rule's prose with its table row |
| F-13 — sprite `padToDeclared: false` | `pins.declared-frame-count` | source pin; every `assembleTimeline` call must pad |
| F-14 — scene field name | — | name-only divergence, no behaviour |
| F-15 — `SF0190` duplicate condition | — | needs a fixture; `unemitted` cannot help (the code *is* emitted) |
| F-16 — `SF0166` | `unemitted:SF0166` | |
| F-17 — CLI flags | `pins.cli-flag:--strict`, `pins.cli-flag:--tolerate-length` | |
| F-18 — missing IO tests | `rules.uncited:010` (26 of 42) | proxy only: the rules are uncited *because* the tests are missing |
| F-19 — severity test range | superseded | check 3 covers all 87 codes against the documents, which is what the test was missing |
| F-20 — dead helper | — | a future symbol-level check could cover exported-but-unused code |
| O-01 — never-emitted codes | `unemitted:*` ×17 | 16 never referenced + `SF1000` referenced by the CLI mapper only |
| O-02 — 10 of 382 test ids cited | `rules.uncited:*` ×16 (570 rules defined, 38 cited) and the summary line | |
| O-03 — gates cannot see code | this tool | the gap O-03 describes |

Two things the mechanical pass adds to the narrative audit:

1. **A roadmap register for unregistered codes.** Check 4 aggregates, per document, the `§8` codes that
   have no registry row yet: 040 → 16, 050 → 25, 070 → 20, 080 → 16, 090 → 19, 100 → 9, 110 → 15,
   120 → 2, 150 → 9, 160 → 13. The narrative audit counted the registry-to-document direction only;
   this is the document-to-registry direction, and it is the list a future `--codes` report (WP-140-08)
   needs.
2. **`version.unreachable` as a first-class key.** The version-gate check makes the shape of F-09
   explicit: seven diagnostics in the documents are version-gated, six modules read a version, and
   `SF0183` is the one that cannot be reached.

## 4. Checker defects found and fixed while hardening

The first runs of the script produced false findings and missed real ones. Each defect below was found by
disbelieving the output and re-reading the code; they are recorded because the same blind spots would
recur in any grep-based audit.

| # | Blind spot | Symptom | Fix |
| --- | --- | --- | --- |
| 1 | Rule ids are two-part (`IMPL-060` + `R004`) | `rules_defined` reported 17 instead of 570: the definition scan collected the *document* group | collect the rule group; attribute bare `Rnnn` citations by the file's owning document |
| 2 | `emit(...)` calls wrap across lines | the SF0190 severity drift was invisible; only 2 of 6 call-site drifts found | scan the whole comment-stripped file, map offsets to line numbers |
| 3 | Emits use the object form `emit({ code, severity })` | 12 codes that *are* emitted looked dead, including `SF0022`, `SF0023`, `SF0102`, `SF0163` | parse a bounded window after each `emit(` for the `code:`/`severity:` pair |
| 4 | `code:` may be a ternary | `SF0004`/`SF0005` (`a > b ? Codes.LONGER : Codes.SHORTER`) looked dead | collect every code token between `code:` and `severity:` |
| 5 | Range allocation is sometimes prose | `coverage.no-owner:SF0009` — false: doc 010 §7 allocates `SF0001–0019` in a sentence, not a table row | parse `IO|container|tag-level -range (\`SF…–…\`)` prose with a labelled owner |
| 6 | `formatVersion` is a constant reference | `dump.format-version` failed on `formatVersion: DUMP_FORMAT_VERSION` | resolve the constant in the same file before judging |
| 7 | Package names appear in comments | a naive scan reports `packages/gfx/src/index.ts` as importing `@swf-forge/swf` | strip comments before judging imports; the two surviving `imports.comment-only` rows are the proof that mentions are not imports |
| 8 | Own probe read the wrong field | the v1 probe reported `styles: -1` (read `shape.fills`, the field is `shape.styles.fills`) | fixed; the probe now reports `styles: 1` and the byte counts that matter |
| 9 | `--update-baseline` exited 1 | the update run computed "new" before writing, so it could not be chained | the update path returns 0 after writing the ledger |

Regression drill: injecting a wrong severity on an *unrelated* code (`SF0022` → `error`) produced
`[NEW] callsite.severity:SF0022 … NEW FINDINGS: 1` and exit 1; reverting restored exit 0. Mutating a
finding that is *already* in the ledger correctly stays quiet — the key is unchanged.

## 5. What stays manual, and why

- Findings that need a **fixture**: F-04 (two definitions with one id), F-15 (250 duplicate styles),
  and any future emission-coverage test (WP-140-02/07).
- Findings that need a **unit test**: F-08 and F-10 (cursor semantics, `T-SWF-015`/`016`), which is
  F-18's subject.
- Findings that are **prose contradictions**: F-12, and the doc half of F-11; comparing a rule's prose
  with its own table is a different class of check (`verify_docs.py`'s territory).
- **Judgement calls** the script deliberately refuses to make: whether an unregistered code is roadmap or
  an omission (check 4 reports the count per document and stops); whether a version-gated code is
  reachable through another module (check 10 reads the owning document's modules only).
- **Process** items (O-02): the script can count citations, not enforce that new work carries them.

## 6. Wiring

`tools/README.md` documents the script next to the two document gates; `pnpm audit:dev` is the entry
point. When the Node toolchain lands (`TECH-SPEC` §8.2, `WP-140-08`/`WP-140-09`), checks 1–10 port to
`tools/spec-verify` as code-side checks and 11/12 become part of the conformance harness
(`WP-140-05`), with the ledger as the waiver file the harness already specifies.
