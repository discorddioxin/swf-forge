# Agent handoff — swf-forge (read this first)

You are continuing an ongoing build of `discorddioxin/swf-forge` (a SWF→modern-web transpiler
toolchain, TypeScript/pnpm monorepo). **This work reached `main` by merge before this handoff:**
the session branch it was developed on (`arena/11541273-swf-forge`) is closed and will not be
continued — start from `main`, and do your work on whatever branch your own process gives you.
This file tells you what is being worked on, what the last few steps before the merge implemented,
and exactly where to continue. It is a handoff note, not a specification — the authoritative
documents are named below. Delete or rewrite this file as it goes stale; the registers always win
over it.

## 1. Authority and working agreement (do not violate)

- **Source of truth, in order:** `docs/impl/000-roadmap.md` (phase status/sequencing),
  `docs/impl/**` per-area implementation docs (work packages `WP-*`, rules `IMPL-*-R*`, test ids
  `T-*`), `docs/impl/registers/{errata,corpus,STATUS}.md`, `docs/specs/**` (design specs),
  `audits/*.md` (evidence). `docs/PROJECT-CHECKLIST.md` is a non-normative roll-up of open gates.
  `docs/TEMP-ROADMAP-P0-P6-CLOSEOUT.md` is the **current working plan** (temporary — retires when
  P0–P6 are closed or on 2026-11-16): execute it wave by wave.
- **Closure means evidence.** Nothing is "done" because code exists or a document mentions it: an
  item closes when its named test id is wired into a gated test file (or its tool/artifact exists),
  the full gate set (§6) is green, and the owning document's changelog + `PROJECT-CHECKLIST.md`
  record it in the same commit.
- **Errata are filed, never absorbed.** Spec contradictions get an entry in
  `docs/impl/registers/errata.md` (next free number there), not a silent workaround or a corrected
  spec cell — unless a recorded ruling (see D1 below) says otherwise. Next free diagnostic code is
  `SF0512` (check `packages/swf/src/diagnostics/codes.ts` before using).
- **Never invent a numbered rule** (`IMPL-*-R###`). New obligations land as WP/test rows via the
  owning document's changelog. Docs' changelogs are **ascending** — insert a new row after the
  previous version's row (the doc gate rejects out-of-order rows). Only the roadmap header says
  `Draft x.xx`; per-area docs carry version only in their changelog.
- `tools/verify_docs.py` rejects rule ids cited in a document that doesn't define them: the
  roadmap (and this file) must reference another doc's rules by section ("doc 010 §8"), never by
  the foreign `IMPL-*-R###` id.
- Communication style the user expects: report what was *run* and what came back; when a claim
  turns out false, name which one failed; never present an unverified change as done; say plainly
  what could not be checked.

## 2. Where the project stands (2026-10-16)

| Phase | Status |
| --- | --- |
| P0 Foundations | **Completed** (roadmap Draft 1.45; re-measured in `audits/P0-CLOSEOUT-AUDIT.md`) |
| P1–P4 | **Completed** (do not re-open; deferrals in the checklist stay deferred) |
| P5 AVM1 front end | **In progress** — buildable work exhausted. Open only on two externally gated criteria: D2 (the user as second reviewer of the C4-c tier report) and D3 (FE-030 `ActionStringLength` oracle). Never re-home these to P11 |
| P6 Emitter | **In progress** — 13 of 14 `IMPL-120` packages done; `WP-120-07` (asset planner) blocked on six P6-owned supplier packages in docs 070/080/090 (`WP-070-06/07/08/09`, `WP-080-11`, `WP-090-12`). `WP-110-12` (video extents) is delivered |
| P7–P13 | Not started (P11 partially: CI exists). Out of scope until the close-out waves finish |

## 3. What the last few steps implemented (the close-out waves)

Execute against `docs/TEMP-ROADMAP-P0-P6-CLOSEOUT.md` §9. Landed and CI-green (verify, browser,
determinism jobs) before the merge; pre-merge tip commit `33199ee`, plus this handoff update:

- **Wave 0** (`75fbef4`) — doc hygiene: `WP-120-01`'s missing **Done** marker restored; the reader-fuzz
  deliverable re-pointed at its delivered home `packages/swf/test/fuzz.test.ts`.
- **P0-1** (`b89acde`) — `T-SWF-009`: `packages/swf/test/fixture-inventory.test.ts` asserts a
  checked-in inventory of the 26-file C1 corpus against the directory walk + the corpus register's
  count, with repeat-parse identity over every file.
- **P0-4** (`a515d8c`) — diagnostic-literal lint (`IMPL-010` §11.5, scope ruled production-only):
  `tools/check_codes.py` (`pnpm code:lint`, in CI, unit tests `tools/test_check_codes.py`) enforces
  (R1) every production `SFdddd` literal is registered in `codes.ts` or doc 010 §7, (R2) no raw
  `code:` literal outside `codes.ts`, (R3) no computed codes. It migrated 10 raw literals in
  `packages/assets/src/images/decode.ts` to `Codes.*`.
- **P0-2/P0-3** (`8f24d89`) — `WP-010-11` finished: `ByteWriter` gained `u24`/`encodedU32`/
  `fixed`/`fixed8`/`float32`/`float64` encoders; `packages/swf/test/io-property.test.ts` proves
  `writer→reader→writer` byte fixed-point over 100,000 seeded values (`T-SWF-014`) and strengthens
  `T-SWF-015/016`; new named counter `allocationCounter` (`packages/swf/src/io/counter.ts`) proves
  `T-SWF-017`/`SWF-R001`: 0 primitive allocations over 10⁶ warm reads (after making `float16`,
  `encodedU32`, `float32/float64` allocation-free on the hot path), exactly 1 object per record
  read, ≤1 payload copy on a ≥5 MiB FWS parse.
- **P0-6 + D1** (`5413788`, `233086b`) — closeout audit; then the last P0 blocker (`E-033`, the §8
  `UI32` cell) was ruled from the **upstream SWF v19 spec text the user supplied**
  (`open-flash.github.io/mirrors/swf-spec-19.pdf`, Ch.1: the spec prints `0x456e7120` and bytes
  `20 71 6e 45`, *no decimal* — our Expected cell `1163342112` was a miscomputation). Cell
  corrected to `1164865824`, discrepancy pin removed, `E-033` closed (errata → v2.25, doc 010 →
  v1.12). Bonus from the same PDF: upstream's FLOAT16 "bias of 16" is a misprint vs `E-004`'s
  settled bias 15 — noted, not re-opened. **P0 marked Completed.**
- **Wave 2** (`33199ee`) — `WP-050-18`: canonical action-byte serializer
  `packages/avm1/src/frontend/serialize.ts` (`serializeBlock`, `checkCanonical`) + gate
  `packages/avm1/test/serialize.test.ts` wiring `T-AVM1-FE-034`: every defined opcode round-trips
  byte-identically (iterated mechanically from `OPCODES`, a `ReadonlyMap`), all 10 `Push` types,
  nested `With`/`Try`/`DefineFunction(2)` regions, branch offsets recomputed from targets,
  non-canonical padding diagnosed (`SF0401`) onto a second-generation fixed point,
  reserved/undefined codes refuse and stay residual. Doc 050 → v1.16; **P5 §13 criterion 2 closed.**

## 4. Where to continue (next steps, in order)

From the temporary roadmap's Wave 3. Suggested first item: **`WP-080-11`** — the glyph subsetter
(static + dynamic reachability, `subset.ts`, `T-MOD-510`, est. 3 d, owner doc
`docs/impl/decompiler/080-fonts-and-text.md`; both deps `WP-080-10` and `WP-050-08` are delivered).
Then **`WP-090-12`** (`budgets.json` audio section + transcode reporting, owner doc 090, est. 2 d).
These two lanes are independent of the external-encoder decision. Before starting any package:
re-read its owning document's §1/§2 (acceptance), §3 (rules), §7 (diagnostics range it owns),
§8/§9 (test + WP tables), §10/§11 (open items, done criteria) and check the errata register for
entries touching it.

Then the image chain needs **D4 — the external encoder decision**, deferred by the user to exactly
this point: ask the user which encoder `WP-070-07`'s re-encode ladder drives (the `MS-§3` tool
table's candidate set) and what its missing/unavailable reporting should be. Then
`WP-070-06 → WP-070-07 → {WP-070-08, WP-070-09}` (docs/impl/decompiler/070), and finally
**`WP-120-07`** (doc 120, est. 4 d), which writes `budgets.json`, un-inerts `--jobs`, makes
`--budget-strict` decisive, emits the five withheld `build-info.json` rows and `SF0507`'s withheld
manifest sections, and wires `T-CMP-006`/`T-CMP-008`. Then regenerate both corpus-roundtrip
artifacts, file the P6 closeout audit, update `PROJECT-CHECKLIST.md`, and retire the temporary
roadmap (Wave 5, which also re-verifies P1–P4 without re-opening them).

**Pending human decisions (ask, don't assume; work proceeds around them):**
- D2 — P5's second corpus reviewer (the user, or a name they give). Blocks P5 closeout only.
- D3 — FE-030 `ActionStringLength` oracle: an authoritative source or a documented original
  Flash Player probe. The user already supplied spec PDFs once (see D1) — asking for the
  relevant excerpt is a proven path. Emulator cross-checks do **not** discharge this.
- D4 — external encoder for `WP-070-07` (above). Blocks only the image chain.
- D5 — C3 reference-title admission, or a formal *blocked* record for `IMPL-120` §10 criterion 1
  (also needs P7's `WP-130-01` for its type-check clause; `strict-build` stays `notRun` until then —
  never type-check an emitted project in this repo/CI). Blocks P6's paperwork closure only.

## 5. Sandbox survival (hard-won; read before your first command)

- **Sandboxes in this workflow may restore aggressively.** Symptoms seen on the session branch
  this work was developed on: `HEAD` rewound to the branch's base commit, branch work showing as
  thousands of uncommitted diffs, and/or `node_modules`, `dist`, `.forge-cache` gone, sometimes
  mid-turn. The defence generalises to any branch: habit, before every commit and at session
  start — `git fetch origin <your-branch>; git log --oneline -1; git log --oneline -1 FETCH_HEAD;
  git status --short`; if rewound, recover with `git reset --hard FETCH_HEAD` (pushed commits are
  the safety net — uncommitted work is only safe in `/tmp` copies), and re-run
  `git diff --stat <last-pushed-sha>` right before `git push`. Never leave finished work
  uncommitted at the end of a turn.
- **Toolchain is not on PATH.** From the repo root, always `corepack pnpm …` (install first with
  `--prefer-offline` after any restore). `./node_modules/.bin/{vitest,tsc,prettier}` work when
  `node_modules` survived. `tools/*.mjs` import built output by relative path, so
  `corepack pnpm build` precedes corpus lanes.
- `--with-open` corpus lanes need `corepack pnpm corpus:fetch` after a restore or they refuse.
- Fixture/test idioms that bit before: `ByteWriter.bits(value, count)` — value *first* (opposite of
  `Cursor.ub`); soft-mode reads yield 0 and record `SF0013` rather than throwing; vitest's
  `toEqual`/`toContain` take no message arg; running vitest against a wrong path prints nothing —
  use `./node_modules/.bin/vitest run <repo-relative-path>`.

## 6. Full gate set (all must be green before any push)

```sh
corepack pnpm install --prefer-offline   # after a restore
corepack pnpm build
corepack pnpm typecheck
corepack pnpm test            # at tip: 83 files / 1,102 tests
corepack pnpm lint            # eslint + prettier --check
corepack pnpm spec:verify     # python3 tools/verify_docs.py → ISSUES: 0
corepack pnpm test:audit      # python unittest over tools/test_*.py
corepack pnpm tag:coverage
corepack pnpm code:lint       # python3 tools/check_codes.py
corepack pnpm corpus:verify   # needs corpus:fetch first
corepack pnpm corpus:roundtrip:check   # compares audits/P6-CORPUS-ROUNDTRIP.json; no drift
python3 tools/audit_dev.py    # NEW FINDINGS: 0
```

Corpus artifacts (`audits/P6-CORPUS-ROUNDTRIP.json`, `audits/P6-C4-ROUNDTRIP.json`) store gate
counts and agreement: regenerate in the same commit if (and only if) behaviour they measure
changed. CI = `.github/workflows/ci.yml` jobs `verify`, `browser`, `determinism`; watch the run
to completion (`gh run list --branch <your-branch> --limit 1`, or `--branch main` for merges)
done. Commit messages state the WP/test id and what the evidence is; one package per commit
series (doc updates + evidence together).

## 7. Map of the territory

- `docs/impl/000-roadmap.md` (Draft 1.46) — phases; `docs/impl/foundation/010-*` (v1.12) — P0
  readers/diagnostics, §7 code registry, §11.5 the lint; `docs/impl/transpiler/050-*` (v1.16) —
  AVM1 front end, §5.7 the byte-identity contract; `docs/impl/decompiler/{070,080,090,110}-*` —
  P6's supplier packages; `docs/impl/transpiler/120-*` (v1.17) — compiler/emitter, §7 budgets,
  §9 WP table; `docs/impl/registers/` — errata (v2.25, **15 open**), corpus (C1=26, C4-c=73,
  C3/C4-t=0), STATUS (generated; date-only churn is normal — revert it).
- Code: `packages/swf` (readers, container, model; `io/counter.ts`, `test-support/writer.ts`),
  `packages/avm1` (front end; newest: `src/frontend/serialize.ts`), `packages/assets`,
  `packages/audio`, `packages/compile` (pipeline/passes/emit), `packages/cli` (`swfforge`),
  `apps/decompiler`.
- Evidence: `audits/P0-CLOSEOUT-AUDIT.md`, `audits/P0-P5-COMPLETION-AND-P6-READINESS.md`,
  `audits/P6-*.json`.
