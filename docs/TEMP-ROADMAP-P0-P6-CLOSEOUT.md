# TEMPORARY roadmap — closing out P0 to P6

**TEMPORARY.** Created 2026-10-16. This document is a working plan, not a specification and not a
replacement for [`impl/000-roadmap.md`](impl/000-roadmap.md), which remains authoritative for phase
status, sequencing and exit criteria. Retire this file (delete it, folding any still-true sequencing
into the roadmap changelog) when every phase P0–P6 is either **Completed** or carries only externally
blocked gates with named owners, or on 2026-11-16, whichever comes first.

**Basis:** [`PROJECT-CHECKLIST.md`](PROJECT-CHECKLIST.md) as refreshed at `d70965b` (2026-10-15
snapshot, roadmap Draft 1.40, errata 2.24, corpus register 1.5), the owning documents
`impl/foundation/010-*`, `impl/transpiler/050-actions-and-avm1.md`, `impl/decompiler/070/080/090/110-*`,
`impl/transpiler/120-compiler-and-emitter.md`, and the audits `P0-AUDIT-RESOLUTION.md`,
`P5-AUDIT-RESOLUTION.md`, `P0-PHASE-DEPENDENCY-MAP.md`, `P0-P5-COMPLETION-AND-P6-READINESS.md`.

**Progress (2026-10-16):** Waves 0–2 done. P0 is **Completed** (roadmap Draft 1.45; `E-033` ruled
from the upstream SWF v19 text the user supplied). `WP-050-18` is delivered, closing P5's
byte-round-trip criterion; P5's remaining criteria are D2/D3 only. D4 was deferred by the user to
the start of Wave 3's image chain. Next: Wave 3's independent lanes (`WP-080-11`, `WP-090-12`),
then the image chain once D4 is taken.

**Scope rule.** "Closing out P0 to P6" means: every phase's own exit criteria pass on evidence, or any
criterion that cannot pass is recorded as blocked on a named external owner — never waived silently,
never re-homed to a later phase to make the count look better, and never closed from a test citation
alone. This plan deliberately does **not** pull P7–P13 work forward, with one exception already
recorded in the owning documents: nothing below re-opens P1–P4, which are Completed.

---

## 1. Where each phase actually stands

| Phase | State entering this plan | What closing it takes |
| --- | --- | --- |
| P0 — Foundations | Implementation delivered, gates green; 5 evidence items open + 1 ruling outstanding | §3, Wave 1 (+ the Wave 0 rulings) |
| P1 — Container & dictionary | **Completed** | No work. Verification sweep only (Wave 5). Deferrals in the checklist stay deferred |
| P2 — Model & timeline | **Completed** | No work. Verification sweep only |
| P3 — Media decode & build assets | **Completed** | No work. Its P6-re-homed encode packages (`WP-070-06…09`, `WP-080-11`, `WP-090-12`) are P6's, in §5 |
| P4 — Static render | **Completed** | No work. Verification sweep only |
| P5 — AVM1 front end | C0–C4 complete; 3 highlighted criteria open | §4: one buildable package (`WP-050-18`) + two externally gated items |
| P6 — Emitter | 13 of 14 `IMPL-120` packages delivered; 6 further P6-owned packages open in docs 070/080/090; 1 delivered (`WP-110-12`) | §5: the six packages, then `WP-120-07`, then its two test ids |

**The honest headline:** P0, P5's buildable half, and P6's code are closable inside this plan. Three
items are **not** closable by writing code in this repository, and this plan does not pretend
otherwise (§7): the `UI32` ruling (a human disposition), P5's two-reviewer corpus screen (needs the
user as second reviewer), and P6 criterion 1 as literally written (needs a C3 reference title and
P7's `WP-130-01`). Each gets a decision point below instead of a schedule slip discovered later.

## 2. Governing rules for executing this plan

1. **Registers first.** Before starting any item, re-derive its state from the owning document's §9/§10
   and the errata/corpus registers. If this plan and a register disagree, the register wins and this
   plan is corrected in the same commit.
2. **Estimates are the owning document's**, quoted below; do not re-estimate silently. A package that
   overruns gets a changelog note in its owning document, not a quiet slip here.
3. **Every item closes on evidence:** the named test id wired in a gated test file, the artifact
   produced, and the full gate set green (§8). Code presence is not closure.
4. **Errata are filed, not absorbed.** Spec contradictions found while building (the `E-042`/`E-043`/
   `E-048`–`E-053`/`E-055` class) stay open against the design spec unless the item below explicitly
   owns a disposition.
5. **No numbered rules are invented.** New obligations go in as work-package/test rows through the
   owning document's changelog; diagnostic codes take the next free number (`SF0512` at basis time —
   re-check before use).
6. **Corpus artifacts are regenerated, never hand-edited.** Any change to what `verify` or the exit
   codes report regenerates `audits/P6-CORPUS-ROUNDTRIP.json` / `audits/P6-C4-ROUNDTRIP.json` in the
   same commit.
7. **One package per commit series**, gates green at each landing, pushed to
   `arena/11541273-swf-forge` with CI watched to completion before the next wave starts.

## 3. P0 — Foundations (Wave 1)

Owner document: `impl/foundation/010-binary-io-and-records.md` (§8, §11.5); evidence plan in
`audits/P0-AUDIT-RESOLUTION.md`.

| # | Item | Closes when | Blocked on |
| --- | --- | --- | --- |
| P0-1 | `T-SWF-009` "every fixture" wired to the corpus register ↔ directory comparison (`registers/corpus.md` §1, 26 C1 inputs, already walked by `tools/corpus-roundtrip.mjs`) | A gated test carries `T-SWF-009` and fails if register and directory drift | Nothing — buildable now |
| P0-2 | `T-SWF-014` evidence (currently no test file); `-015`/`-016` completed to their full obligation (one file each today) | Each id's stated obligation is asserted, not merely cited | Nothing — buildable now |
| P0-3 | Allocation/copy counts by a **named, deterministic counter** (`T-SWF-017`, `SWF-R001`'s 5 MiB payload-copy budget) | The counter exists, is named in doc 010, and `T-SWF-017` asserts the budget. A heap delta or memoization test does not count | Nothing — buildable now; the counter design is the work |
| P0-4 | Diagnostic-literal lint (`IMPL-010` §11.5): a `check_codes`-class tool proving no `sink.record(...)` takes a computed code | Tool exists, a root script invokes it in the gate set, and its scope (production only vs tests too) is ruled in doc 010 | The scope ruling — small, taken at Wave 0 |
| P0-5 | `UI32` vector ruling (`E-033`): `0x456e7120` printing `1163342112` — bytes-authoritative (the `E-025` class) or a transcription error in our table | Disposition recorded in `registers/errata.md`; `VECTOR_TABLE_DISCREPANCIES` then shrinks or is re-pinned to the ruling. Until then no row-by-row exact-equality matrix is asserted | **Human ruling (Decision D1, §7)** |
| P0-6 | Fresh P0 closeout audit; roadmap §6 rows re-read against evidence | Audit filed; roadmap §6 P0 rows no longer read Open/Partly for delivered items | P0-1…P0-5 |

Order inside the wave: P0-1 and P0-2 first (small, mechanical), P0-3 next (the only design work),
P0-4 with its ruling, P0-6 last.

## 4. P5 — AVM1 front end (Wave 2, parallel with Wave 3)

Owner document: `impl/transpiler/050-actions-and-avm1.md` (§5.7, §12–§13); gates kept at P5 by
recorded instruction — nothing here re-homes P5's gates to P11.

| # | Item | Closes when | Blocked on |
| --- | --- | --- | --- |
| P5-1 | **`WP-050-18`** — action-byte serializer: canonical encoding (§5.7), byte-identity gate, residual refusal (`frontend/serialize.ts`, est. 5 d) | `T-AVM1-FE-034` wired: canonical input reproduces its bytes; non-canonical input is diagnosed, not normalized; reserved/undefined codes refuse and stay residual. `T-AVM1-FE-032` is **not** cited (the disassembly leg was removed from the byte-identity path) | Nothing — buildable now. Its contract (`IMPL-050-R065`–`R069`) is already normative |
| P5-2 | Two-reviewer screen on the open corpus (C4-c: 73 hash-pinned conformance movies; `registers/corpus.md` §4 item 3 records "one auditor at most") | A second reviewer signs the tier report; the C4-c lane's invariants are asserted by a test rather than run by hand (corpus §4 item 6, `WP-050-19`) | **The user as second reviewer (Decision D2, §7)**. The lane-wiring half is buildable now |
| P5-3 | FE-030 oracle: SWF≤5 `ActionStringLength` units/behavior | Resolved from an authoritative source or a documented original-Flash-Player probe. Emulator cross-checks do not discharge this | **External oracle (Decision D3, §7)** |
| P5-4 | P5 closeout: §13 criteria re-read, phase marked per the roadmap | All §13 criteria pass or carry named external blockers (P5-2/P5-3) | P5-1…P5-3 |

Ownership boundary (unchanged): P5 owns `T-AVM1-FE-*`; executable runtime obligations
(`T-AVM1-008/009/012/025/027` etc.) stay P7's and are out of scope here.

## 5. P6 — Emitter (Waves 3–4)

Owner documents: `impl/transpiler/120-compiler-and-emitter.md` (§7–§10) plus the P6-owned rows in
docs 070/080/090/110. `WP-110-12` is delivered and is not re-opened.

### Wave 3 — the six supplier packages (dependency order)

| # | Package | Depends on | Est. | Output / test id |
| --- | --- | --- | --- | --- |
| P6-1 | `WP-070-06` classification heuristics + manifest recording | `WP-070-05` (delivered) | 3 d | `assets/src/images/classify.ts`, `T-MOD-306` (stability across 100 runs) |
| P6-2 | `WP-070-07` re-encode ladder + mip generation + residual check | P6-1 | 5 d | `reencode.ts`, `mips.ts`, `T-MOD-307`. **Needs the external-encoder decision** (`MS-§3` tool table) incl. tool-missing/unavailable reporting — Decision D4, taken at Wave 0 so it cannot stall the ladder |
| P6-3 | `WP-070-08` `.sfa` writer/reader + round-trip test | P6-2 | 3 d | `T-MOD-308` (decode → emit → decode yields identical pixels) |
| P6-4 | `WP-070-09` texture budget accounting into `budgets.json` | P6-2 | 2 d | `AST-§4` integration — composes with P6-7 |
| P6-5 | `WP-080-11` glyph subsetter (static + dynamic reachability) | `WP-080-10`, `WP-050-08` (both delivered) | 3 d | `subset.ts`, `T-MOD-510`. Independent of the image chain — may run parallel to P6-1…P6-4 |
| P6-6 | `WP-090-12` `budgets.json` audio section + transcode reporting | `WP-090-11` | 2 d | `AST` integration — composes with P6-7. Independent lane — parallel-safe |

### Wave 4 — the planner that consumes them

| # | Package | Closes when |
| --- | --- | --- |
| P6-7 | **`WP-120-07`** asset planner + encoding scheduler (`packages/compile/src/passes/assets.ts`, `IMPL-120-R010`, est. 4 d; depends on `WP-070-07`, `WP-080-10`, `WP-090-10`, `WP-110-12`) | Encode order, parallelism cap, budget accounting and fallback-ladder selection implemented; `--jobs` stops being inert; `budgets.json` is written (P6-4 + P6-6 sections compose here); the five withheld `build-info.json` rows and `SF0507`'s withheld manifest sections are emitted instead of withheld; `--budget-strict` becomes decisive; `IMPL-120-R031`'s video line reads from `WP-110-12` extents with the alpha clause still labelled an estimate (measured facts stay `WP-110-06`, P10) |
| P6-8 | `T-CMP-006` (SIGINT during an asset encode returns within 2 s, no partial files) | Wired against a real encode from P6-7 |
| P6-9 | `T-CMP-008` (`plan` output matches the real build's `budgets.json` within tolerance) | Wired against the `budgets.json` P6-7 writes. Until then §7's recorded measurements stand |
| P6-10 | Regenerate both corpus-roundtrip artifacts; re-run the full lane (`corpus:roundtrip:check` + `--with-open`) | No artifact drift; gate-row agreement re-recorded |
| P6-11 | P6 closeout audit | §10 criteria re-read: criteria closable at P6 pass; criterion 1 recorded **not measurable** with its two named blockers (C3 admission, `WP-130-01`) — see §7, Decision D5 — not waived |

Delivered and **not** to be re-opened: pipeline runner, cache/`--verify-cache`, the five §3 passes,
both emitters, manifest pair + drift check, the three reports, `verify`, the CLI, the corpus lane,
and the `CMP-§8` flag-default pin (`CMP-R028`).

## 6. Wave 0 — decisions and doc hygiene (before Wave 1, ~0.5 d of edits)

These are cheap now and expensive if discovered mid-build:

1. **Doc hygiene (buildable, no ruling needed):** give `WP-120-01`'s row in `IMPL-120` §9 the **Done**
   marker its shipped `pipeline.ts` earned; re-point roadmap §6's fuzz row from
   `packages/swf/test/fuzz/readers.*.test.ts` to the delivered `packages/swf/test/fuzz.test.ts`.
2. **Decisions D1–D5 (§7) requested from the user in one batch.** D4 (external encoder) and the
   P0-4 lint scope are on the critical path; D1, D2, D3, D5 gate phase *closure*, not phase *work*,
   so a slow answer stalls audits, not code.
3. Confirm the gate set (§8) is green at the starting commit and record the numbers in the first
   closeout commit. Any red gate at start is a finding, not background noise.

## 7. Decision points — what only the user / an external source can close

| ID | Decision | Needed by | Default if unanswered |
| --- | --- | --- | --- |
| D1 | `UI32` row: bytes-authoritative vs transcription error (`E-033`) | P0-5, P0 closeout | P0 stays In progress; the discrepancy stays pinned and mechanically derived. No code workaround |
| D2 | Act as (or name) the **second reviewer** for the C4-c tier report; also dispositions `E-035`–`E-040`'s register entry if still unsigned | P5-2, P5 closeout | P5's criterion stays open; the lane wiring (P5-2's buildable half) still lands |
| D3 | FE-030 oracle source: authoritative document or a documented original-Player probe session | P5-3 | Criterion stays open and named; no emulator result is substituted |
| D4 | External encoder selection for `WP-070-07` (the `MS-§3` tool table's candidate set), and behaviour when it is missing/unavailable | P6-2 (critical path) | P6-2 does not start; P6-1, P6-5, P6-6 still proceed |
| D5 | C3 reference title: name/admit a title (`registers/corpus.md` §2's six requirements, `fixtures/PROVENANCE.md` per `REPO-R017`), or formally record `IMPL-120` §10 criterion 1 as *blocked-on-P11-corpus + `WP-130-01`* for P6's closeout | P6-11, P6 closeout | Criterion 1 stays "not measurable, recorded" — P6 closes on its other criteria only if the roadmap's phase definition accepts a recorded blocker; otherwise P6 closes when P7/P11 unblock it, and this plan's P6 deliverable is the code + the recorded blocker |

## 8. Gate set — run at every landing, in full

```sh
corepack pnpm install --prefer-offline   # after any sandbox restore; node_modules does not persist
corepack pnpm build
corepack pnpm corpus:fetch               # required before the --with-open lane
corepack pnpm typecheck
corepack pnpm test
corepack pnpm lint
corepack pnpm spec:verify
corepack pnpm test:audit
corepack pnpm tag:coverage
corepack pnpm corpus:verify
corepack pnpm corpus:roundtrip:check
python3 tools/verify_docs.py
python3 tools/audit_dev.py
```

Plus: CI (`verify`, `browser`, `determinism`) watched to green on the pushed tip before a wave is
called done; corpus artifacts regenerated in-commit whenever reported behaviour changed; the
checklist and the owning document's changelog updated in the same commit as the evidence they cite.

## 9. Sequence summary

| Wave | Content | Rough size | Exits when |
| --- | --- | --- | --- |
| 0 | §6 hygiene + decisions requested | ~0.5 d edits | D1–D5 asked; markers fixed; gates recorded green |
| 1 | P0-1…P0-4 builds, then P0-6 audit | counter design is the long pole | P0 rows close or D1 alone remains |
| 2 | P5-1 (`WP-050-18`) + P5-2's lane wiring | 5 d + lane | `T-AVM1-FE-034` wired; closure waits only on D2/D3 |
| 3 | P6-1→P6-2→{P6-3, P6-4}; P6-5, P6-6 in parallel | 3+5+5 d image chain; 5 d parallel lanes | All six supplier packages delivered |
| 4 | P6-7…P6-11 | 4 d + tests/regeneration | `budgets.json` real; `T-CMP-006/-008` wired; P6 audit filed |
| 5 | P1–P4 verification sweep (gates + audits re-read, no re-opening), `PROJECT-CHECKLIST.md` refresh, **this file retired** | ~1 d | P0–P6 Completed or externally blocked with named owners |

Waves 2 and 3 may interleave (no shared files); Wave 4 is strictly after Wave 3; Wave 1 is
independent of both and can run first or alongside.

## 10. What this plan refuses to do

- Re-home P5's gates (b)/(c) to P11, or P6's criterion 1 to a later phase, to manufacture closure.
- Close P6 criterion 1, P5's reviewer criterion, or P0's `UI32` row on synthetic or single-reviewer
  evidence.
- Type-check an emitted project in this repository or CI (`strict-build` stays `notRun`, owner
  `WP-130-01`, until P7 ships the runtime contract).
- Substitute heap measurements for P0-3's deterministic counter, or cite `T-AVM1-FE-032` for the
  byte round trip.
- Carry this file past its retirement condition. A temporary roadmap that becomes permanent is a
  second source of truth, which is the defect class this repository's registers exist to prevent.
