# Mechanical checks — the re-runnable half of the audit

`tools/audit_dev.py` is the mechanised form of `01-findings.md`: thirteen checks that decide, by reading
the code or running it, which of the audit's findings are still live. It is a **ledger**, not a report —
`audits/dev/baseline.json` records the findings that are known and accepted for now; for a valid run,
exit 1 means something *new* appeared, and a fixed finding prints as `[fixed]`. Exit 2 is reserved for
invalid invocation or missing checkout inputs.

```bash
python3 tools/audit_dev.py                  # human summary; exit 0 = no new findings
python3 tools/audit_dev.py --json           # machine-readable, for CI
python3 tools/audit_dev.py --update-baseline  # after a deliberate, reviewed change (probes required)
python3 tools/audit_dev.py --no-probe         # skip the Node probes (no build needed)
pnpm audit:dev                              # same as the first form
```

Baseline semantics: keys are `check:subject` and the value counts occurrences, so a *new site* of a
known drift is a regression too. The ledger is regenerated deterministically (no timestamps, sorted
keys) — verified by running `--update-baseline` twice and comparing bytes. The reviewed continuation
extends it from 56 keys / 62 occurrences to 65 / 71; this records the four new dump findings at field
granularity, not as an approval that the implementation is conformant.

## 1. The thirteen checks

| # | Check | What it proves | Specification behind it |
| --- | --- | --- | --- |
| 1 | `registry` | `codes.ts` parses; every constant has a severity row; code/name agree; severities are in vocabulary | `IMPL-010` §7 |
| 2 | `callsite` | every `emit(...)` site's severity equals the registry's, positional and object payloads, including branching `code:` fields | `IMPL-010` §7, doc §8 tables |
| 3 | `doc` | every per-code `§8` table severity equals the registry's | the documents' own diagnostics tables |
| 4 | `coverage` | every registry code has a specific or parent-range owner and an owning `§8` row; catches overlapping allocation rows; aggregates documented-but-unregistered codes by document | `IMPL-010` §7 range table + prose |
| 5 | `unemitted` | a code is *emitted* only if some `emit(...)` can produce it; codes that no path can emit are reported, split into never-referenced and mentioned-only | `IMPL-010` §7 (the registry is reachable or it is dead) |
| 6 | `rules` | every `IMPL-NNN-Rnnn` is defined once, and citations in code comments resolve — full form and the two-part bare `Rnnn` form attributed by the owning module | `TECH-R009`, `IMPL-140` §6 |
| 7 | `tests` | code citations resolve to canonical test rows from numbered spec/impl docs; the verifier's actual `HISTORICAL_TEST_IDS` is parsed from its AST; errata/STATUS are not declarations | `TECH-R009`, `verify_docs.py` check 8b |
| 8 | `imports` | cross-package import restrictions hold **after comment stripping**, and the check fails if `eslint.config.js` no longer encodes the same restriction | `TECH-R005`, eslint `no-restricted-imports` |
| 9 | `determinism` | no `Date`/`Math.random`/`process.cwd`/`process.env`/`performance.now` on output paths | `TECH-R010`, `IMPL-040-R045` |
| 10 | `version` | version-gated diagnostics whose owning module never reads the file version are reported as unreachable | doc `§8` rows, `IMPL-060-R005` |
| 11 | `dump` | R044–R048 run modes, exact JSON bytes, --out creation/equality, key order, synthetic map/label/sprite/diagnostic fixtures, and op fields checked against normative IMPL-030/040 interfaces | `IMPL-040-R044`–`R048`; IMPL-030 §3; IMPL-040-R024 |
| 12 | `pins` | behavioural and source pins for the audit's blockers: `DefineShape4` flag bytes, the `DefineShape` v1 `0xFF` count, sprite frame padding, documented CLI flags | `IMPL-060-R004`/`R006`, `IMPL-020-R024`, `SWF-D03` |
| 13 | `sources` | prevents generated `STATUS.md` or the errata register from becoming a silent definition source; runs after the 12 substantive checks | `verify_docs.py` numbered-document scope |

Checks 11 and 12 need a built `dist/`; they report `skipped` (not failure) when it is absent. Check 11
runs the Appendix A fixture plus two audit-local synthetic SWFs (a clean one and a dirty one) written to
temporary directories; check 12 runs the binary-reader probes from embedded `PROBE_JS`. No fixture or
probe script is left in the worktree. Check 13 guards the numbered-document source boundary: `errata.md`
is a correction log and `STATUS.md` generated output, never a declaration source.

## 2. The recorded run

At base HEAD `73483d5` (this continuation pass's audit-tool/doc edits are the working tree), with
`pnpm build` executed and `fixtures/appendix-a.swf` present:

```text
audit_dev — 87 registry codes, 16 never referenced, 570 rules defined, 382 test ids declared
SUMMARY findings=71 known=71 new=0 fixed=0
PROBE shape4 flags ok=1/5 v1-style-count=False
DUMP keys=9 frames=1 bytes=2902 synth={'clean': [], 'dirty': ['SF0023', 'SF0124', 'SF0116', 'SF0153']}
NEW FINDINGS: 0
```

`--no-probe` was also run against that baseline: 62 analyzable findings, `NEW FINDINGS: 0`, no `fixed`
rows, and six probe-only keys explicitly printed as `[skipped]` (four synthetic dump findings plus the
two decoder-pin keys). The five static normative op-field findings remain in scope without a build.

Occurrences per check and severity:

| Check | Occurrences | Distinct keys | Severities |
| --- | --- | --- | --- |
| `callsite` | 6 | 3 | error |
| `coverage` | 10 | 10 | info |
| `doc` | 2 | 2 | error |
| `imports` | 2 | 2 | info |
| `dump` | 9 | 9 | error |
| `pins` | 8 | 5 | error, warning |
| `rules` | 16 | 16 | info |
| `unemitted` | 17 | 17 | info |
| `version` | 1 | 1 | warning |
| **total** | **71** | **65** | 23 error · 3 warning · 45 info |

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
The Appendix A dump passes its basic contract: nine top-level keys in documented order, one frame,
2902 bytes, byte-identical repeated `--json`, and exact `--out` bytes (including LF/trailing newline).
The synthetic tests go beyond that fixture: the clean SWF has no diagnostics; the dirty SWF produces
exactly `SF0023` (sprite frame-count mismatch), `SF0124` (PlaceObject3 image/class field), `SF0116`
(cache hint), and `SF0153` (duplicate label). The generated SWFs exercise descending dictionary ids,
exports and grids, same-frame labels in file order, sprites, PlaceObject3, RemoveObject, SetTabIndex,
and output ordering. They exposed four dump contract violations (F-21–F-24), all recorded below.

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
| F-21 — `SetTabIndexOp.index` dropped | `dump.op-field-dropped:DumpTabIndex:index`, `dump.synth:op-field:tabIndex:index`, `dump.synth:control-tabindex-field:index` | index is required by IMPL-040-R024 and absent from both serialized copies |
| F-22 — `control.labels` re-sorted | `dump.synth:control-labels` | same-frame `z`, then `a` are emitted as `a`, then `z`; violates R046 file order |
| F-23 — `RemoveObject.CharacterId` dropped | `dump.op-field-dropped:DumpRemoval:characterId`, `dump.synth:op-field:remove:characterId` | reader consumes it but neither model nor dump retains it |
| F-24 — documented placement fields absent | `dump.op-field-dropped:DumpPlacement:{cacheAsBitmap,filters,image}` | the current placement/dump shape omits normative fields; tracked against WP-030-04/05 (see F-24) |
| O-01 — never-emitted codes | `unemitted:*` ×17 | 16 never referenced + `SF1000` mentioned-only in the CLI mapper |
| O-02 — 10 of 382 test ids cited | `rules.uncited:*` ×16 (570 rules defined, 38 cited) and the summary line | |
| O-03 — gates cannot see code | this tool | the gap O-03 describes |

Four things the continuation pass adds to the narrative audit:

1. **A roadmap register for unregistered codes.** Check 4 aggregates, per document, the `§8` codes that
   have no registry row yet: 040 → 16, 050 → 25, 070 → 20, 080 → 16, 090 → 19, 100 → 9, 110 → 15,
   120 → 2, 150 → 9, 160 → 13. The narrative audit counted the registry-to-document direction only;
   this is the document-to-registry direction, and it is the list a future `--codes` report (WP-140-08)
   needs.
2. **`version.unreachable` as a first-class key.** The version-gate check makes the shape of F-09
   explicit: seven diagnostics in the documents are version-gated, six modules read a version, and
   `SF0183` is the one that cannot be reached.
3. **The allocation parser now follows the actual table semantics.** A first-cell range is required,
   so `§8` rows like `| SF0110 | warning |` cannot masquerade as allocations. The `SF0100–0199` prose
   parent fills gaps after the table's sub-allocations; explicit spare/reserved rows override the parent.
   All 87 registered codes have an owner and an owning diagnostics row, with no allocation overlaps.
4. **Dump checks now read the normative model interfaces, not only the TS model.** The synthetic probe
   caught the `SetTabIndex.index`, `RemoveObject.characterId`, and same-frame label-order losses; the
   static interface check records the still-incomplete PlaceObject3 fields against IMPL-030 §3. The run
   keeps roadmap gaps visible instead of calling them conformant just because code and dump share a type.

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
| 10 | A severity row looked like a range row | `SF0110` was assigned to owner `warning`; the checker tested neither table shape nor owner code | require a range in the first cell, parse range rows separately from per-code `§8`, recognize the three prose parent ranges and explicit spare/reserved rows |
| 11 | Parent and sub-allocation ranges overlap by design | treating `010`'s `SF0100–0199` as a flat owner conflicts with its 030/040/060 child blocks | assign specific table rows first; parent prose fills gaps only; use reserved rows as an override; detect conflicting specific table claims |
| 12 | Errata citations and generated STATUS rows can be mistaken for declarations | `T-RT-120` in E-023 records a correction, not a newly defined test | declarations use the same numbered-document/table surface as `verify_docs.py` check 8b; parse its live historical-id allowlist; check 13 rejects definition-shaped rows in registers |
| 13 | The Appendix A fixture is too small to prove map/sprite/op contracts | it has one character, no sprite, no exports/grids, no labels, and no ops across kinds | synthesize two temporary files with reversed keys, same-frame labels, a sprite, PlaceObject3, RemoveObject and SetTabIndex; keep clean/dirty diagnostic expectations |
| 14 | Comparing dump interfaces only to current model types is circular | both sides can omit a field required by the spec (e.g. `RemoveObject.characterId`) | compare `Dump*` directly to IMPL-030 §3 / IMPL-040-R024; transform `origin` to `tagOffset` per R047; add the new baseline keys |
| 15 | The range-overlap error path itself was untested | a one-off conflict drill exposed a three-value unpack of a two-tuple | fix the unpack and exercise the branch with an injected `SF0003` overlapping-owner claim |
| 16 | `--no-probe` made probe-only baseline rows look fixed | the follow-up baseline adds synthetic-dump keys as well as the original decoder pins | classify missing probe rows as `skipped`, not `fixed`; retain static dump/schema checks under `--no-probe` |
| 17 | `--update-baseline --no-probe` could replace the ledger with a partial run | runtime-only keys are absent when the probe is disabled | reject the combination before writing; a ledger update requires complete probe evidence |

Regression drills: injecting a wrong severity on an *unrelated* code (`SF0022` → `error`) produced
`[NEW] callsite.severity:SF0022 … NEW FINDINGS: 1` and exit 1; reverting restored exit 0. An injected
conflicting table allocation reports `coverage.overlap:SF0003` (error). A fake `T-AUDIT-9999` row in an
errata-like register is *not* declared by check 7, is reported as an undeclared code citation, and is
caught by check 13 if formatted like a definition row. The real checker matches `verify_docs.py`'s
canonical declaration set exactly: 382 IDs; historical set `{T-MOD-201, T-RT-020}` read from the
verifier, not duplicated. Mutating a finding already in the ledger remains quiet only when its key and
occurrence count stay unchanged.

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
- **Broader dump data not exercised by these two synthetic SWFs:** scenes, imports, init actions, clip
  actions, frame actions, stream-sound spans/blocks, video-frame tags, multiple metadata keys, and the
  full filter-list payload. Those stay on their WPs/fixtures; the synthetic tests do not claim complete
  SWF-tag conformance. F-24 explicitly records three fields that this dumper interface currently lacks.
- **Process** items (O-02): the script can count citations, not enforce that new work carries them.

## 6. Wiring

`tools/README.md` documents the script next to the two document gates; `pnpm audit:dev` is the entry
point. When the Node toolchain lands (`TECH-SPEC` §8.2, `WP-140-08`/`WP-140-09`), checks 1–10 and 13
port to `tools/spec-verify` as code/source checks; check 11's dump fixtures and check 12's decoder pins
become conformance-harness cases (`WP-140-05`), with the ledger as the waiver file the harness already
specifies.
