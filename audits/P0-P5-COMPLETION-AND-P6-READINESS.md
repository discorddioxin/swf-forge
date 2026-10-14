# P0–P5 Completion Audit and P6 Start Readiness

- **Date:** 2026-10-13
- **Auditor:** Arena.ai Agent Mode
- **Branch:** `arena/11541273-swf-forge` (base `475edc7`)
- **Scope:** Completion status of P0, P1, P2, P3, P4, P5 measured against their own acceptance text; every
  `Depends` supplier of every `WP-120-*` row; and the set of obligations that must be closed **before P6
  starts**. Reads `docs/impl/000-roadmap.md` §§2/3/4/7/10, `docs/impl/{foundation,decompiler,transpiler,engine-flash,harness}/*`,
  `docs/impl/registers/*`, `audits/P{0,1,2,3,5}-*`, `audits/archive/P{1,2}-*`, `tools/audit_dev.py`,
  `tools/verify_docs.py`, and the current `packages/*` + `apps/*` source and tests.
- **Method:** Read-only. No source, spec, or register was modified by this audit. Every claim below is
  either (a) a machine measurement reproducible with the command shown, or (b) a `file:line` citation.
  Nothing is inferred from untested code: where code exists but no test exercises it, that is stated as
  the finding, not as coverage.
- **Companion records:** [`P0-PHASE-DEPENDENCY-MAP.md`](P0-PHASE-DEPENDENCY-MAP.md) v1.2 (edge census),
  [`P5-AUDIT-RESOLUTION.md`](P5-AUDIT-RESOLUTION.md) §§3–5 (P5's open gates),
  [`P0-AUDIT-RESOLUTION.md`](P0-AUDIT-RESOLUTION.md) (P0's ordered evidence plan),
  `docs/impl/000-roadmap.md` §4.4 (inversion register).
- **Gate state at audit time:** §10. All eight gates green; `audit:dev` reports `findings=52 known=57 new=0`.

---

## 1. Verdict

**P1, P2, P3 and P4 are Completed and survive re-measurement. P0 and P5 are In progress, and neither is
what blocks P6.** P6 is blocked by four things that no phase currently owns:

1. **Two F1 obligations were forwarded to P5/P6/P7 in *archived* audit prose and never landed in a live
   document** — `T-MOD-602`'s `SetTarget` path grammar (F-P2-03) and `T-MOD-030`'s "the emitted bundle
   never reads `location`" (F-P2-04). The first sits directly on the emitter's critical path: the grammar
   is specified (`IMPL-050-R037`), implemented (`packages/avm1/src/frontend/properties.ts`), consumed by
   production code, and **owned by no test id in any phase**.
2. **`IMPL-120-R028` requires video bytes that P6 cannot compute** (F-P6-01). The video *tags* are not
   decoded anywhere; their decoder is `WP-110-01` (P10). The P6→P10 edge is registered as an accepted
   forward, but its consequence for `budgets.json` was never dispositioned.
3. **Two of P6's done criteria name artifacts that do not exist and are defined nowhere** — "the reference
   title" (§10.1) and "the whole corpus" (§10.3) (F-P6-02). "The reference title" is also the subject of
   P7's budget gate `T-RT-118` and P7's done criterion 1.
4. **P6's authoritative scope is 64 developer-days across four documents; the roadmap sizes it at 30–45**
   (F-P6-03). 18 d of P6-owned work lives in three P3-era documents that a P6-only reading never surfaces.

Under the repository's own ordering rule — *"a package may start when every `Depends` id is **reviewed**,
not necessarily complete"* (`docs/impl/000-roadmap.md:638`) — P6's start gate is a **disposition** gate,
not a completion gate. Measured against that rule: **6 of 9 distinct cross-document suppliers are delivered
and test-cited; 2 are P6's own work in other documents; 1 is P10's and undispositioned in consequence.**

**Disposition: conditional go.** P6's pipeline half (`WP-120-01…-06`, 18 d) may start once the five
documentation dispositions in §6.1 are landed (~1 d, no code). P6's emitter and asset half
(`WP-120-07…-14`, 28 d) additionally requires the five build items in §6.2. Nothing in P0's or P5's open
lists gates P6's start except `WP-010-11` (P0, 3 d) and the definition of P5's lossless inverse format —
both listed in §6.2 with their reasons. §6.3 lists what P6 must **not** wait for, so the phase is not
held hostage to P0's allocation counter, P1's four deferrals, P5's corpus gate, or P4's later-phase scope.

**Addendum, later the same day — the corpus screen ran, and P5's evidence base is no longer only local.**
Roadmap §4.6 item B's retried screen admitted class **C4-c**: 73 ActionScript-bearing AVM1 conformance
movies from `ruffle-rs/ruffle@2372a4e1` (Apache-2.0 OR MIT, each shipped with its own `test.as`/`test.fla`
source and expected trace), hash-pinned in `fixtures/open/manifest.json` and fetched into `.forge-cache/`
rather than committed. They are the first action blocks this front end has ever seen from outside the 26
committed inputs — **not one of which contains an action block** — and running them produced finding
F-P5-07: `E-034`, fixed and regression-pinned, and `E-035`, then open and blocking. P5's gate (b) is now
partly evidenced (`audits/P5-C4-CORPUS-EXTERNAL.json`) but unsigned: `E-035` had to land before the report
meant anything, and the second reviewer is still owed. **`E-035` landed later the same day**, and fixing
it found three more defects in the same family — `E-036` (`With`/`Try` own their bodies past `Length`
too, and doc 050's `Try` tiling rule asserted the opposite), `E-037` (a function body is not
`End`-terminated, so a phantom block-terminator warning fired for every function) and `E-038` (an
error-severity region overrun left its block claiming tier 0) — all fixed, and `E-039` (a `Try`'s catch
and finally bodies were decoded and then dropped from the IR) was **fixed later the same day**, which
exposed two more: `E-040` (a region body's leftover stack never reaches the code after the region) —
**fixed later still the same day**, together with the latent stall underneath it (§10.4) — and `E-041` (a
diagnostic emitted inside a nested block carries a block-relative offset), still open. The regenerated
report reads 119 blocks, **153** functions (was 93), **T0=119 T1=130 T2=23** (was T0=191 T1=3 T2=18),
error-severity diagnostics **14** (was 60, and all 14 are semantic rather than framing), and clean exits
**60 of 73** (was 21). Ten entries moved T0 → T1 not because the analysis got worse but because statements
that had been dropped from the IR are now in it.
Gate (c) is unchanged — the screen found no Adobe-authored oracle, and the one candidate that looked like
documentation (`PeerInfinity/SWFRecomp-CC`) is an unlicensed AI-generated task prompt whose claim
contradicts the specification, so it was rejected rather than cited. **The verdict above stands**: P6 is
still not blocked by P5. What changed is that §6.2's P5 items now have a measured defect attached, and
that P6's plan pass must not read function bodies from real content until `E-035` lands.

**Two of the four blockers listed above are now dispositioned at source (roadmap 1.23).** *Item 1:*
`T-MOD-602`'s `SetTarget` grammar has an owner (`T-AVM1-FE-035`, attached to `WP-050-11`) and
`T-MOD-030`'s emitter half is received by doc 120's R032 and `T-CMP-009`; both ids stay unwired, which is
the honest state — the ownership gap is closed, the tests are not yet written. *Item 2:* the video extent
model is re-homed into P6 as `WP-110-12`, so P6's supplier census is now **6 delivered and test-cited,
3 P6's own work in other documents, 0 undispositioned** — replacing the 6 / 2 / 1 split in the paragraph
above. *Item 3:* the corpus register exists (`docs/impl/registers/corpus.md` v1.1) and admits C4-c; the
reference title and a C4-t title are still owed (F-P6-02). *Item 4* — P6's 64-day authoritative scope
against the roadmap's 30–45 — is unchanged.

---

## 2. Acceptance scope and boundary

**What this audit did**

- Re-measured all 441 declared test ids against citing tests, attributed by *implementation* document
  (`/impl/` only — see §4.1 for why the naive attribution is wrong).
- Verified the delivery state of every `Depends` id of every `WP-120-*` row, down to the citing test file.
- Checked that every deferral claimed by a **Completed** phase is recorded in a *live* document (spec,
  register, or roadmap) rather than only in an audit that has since been archived.
- Re-ran the full gate stack (§10).

**What this audit did not do**

- It did not re-audit P1–P4's findings. Their resolutions stand as evidence and are cited, not repeated.
- It did not review the design specs (`docs/specs/**`) for correctness; it used them only to establish
  which obligations exist and who owns them.
- It did not resolve `E-033` (disputed `UI32` vector row) or `FE-030` (`ActionStringLength` oracle). Both
  already have owners and dispositions; §6.3 records why neither gates P6.
- It wrote no P6 code and made no specification edit. The edits §6 requires are listed, not applied.

**The acceptance rule this audit applies** is the repository's own, quoted verbatim
(`docs/impl/000-roadmap.md:116-117`):

> "Code presence or a test citation alone is not closure; an acceptance obligation is complete only when
> its full, phase-owned outcome is demonstrated by the gate evidence."

and (`:57`):

> "**Completed** requires a reviewed phase exit verdict or audited green exit gates … Completed phases can
> retain explicitly accepted non-blocking deferrals, which remain visible in the owning spec."

The second sentence is the one this audit enforces hardest: a deferral must remain **visible in the owning
spec**. Three findings below are violations of exactly that clause.

---

## 3. What has been completed (P0 → P5)

### 3.1 Phase-by-phase

| Phase | Status (roadmap §2) | Exit evidence that holds up | What remains open, and where it is recorded |
| --- | --- | --- | --- |
| **P0** byte readers | **In progress** | `packages/swf/src/io/*`; 26-row §8 vector table running in **two** lanes (Node + headless Chromium 153.0.8010.0, 31 tests, one pinned cross-engine fingerprint); `encodedU32` ≥ 2³¹ defect found *by* the browser lane and fixed with a regression (`SF0009`) | 5 ids lack evidence (`T-SWF-009`/`014`/`015`/`016`/`017`); §8 matrix incomplete for `RECT`/`MATRIX`/`CXFORMWITHALPHA` pending `WP-010-11`'s writer; `UI32` row disputed (`E-033`); `WP-010-12` reader fuzzer; diagnostic-literal lint rule. Recorded live: `docs/impl/foundation/010-…md:657-664` (§10) and `:11` criteria 1–5; roadmap `:59` |
| **P1** container/tag stream/dictionary | **Completed** | All six exit criteria green per `audits/P1-AUDIT-RESOLUTION.md` §5; 12/12 declared test ids cited | 4 explicitly deferred items + 2 observations, recorded live in `P1-AUDIT-RESOLUTION.md` §4 and pinned in `IMPL-020 §12`: standalone `swffuzz` CLI, streaming LZMA, 512 MiB absolute-RSS, synchronous-zlib partial yield |
| **P2** model & timeline | **Completed** | `P2-AUDIT-RESOLUTION.md` closes both findings, zero open; 65 of 67 declared ids cited; `dump`/`inspect` verbs evidenced | **2 uncited F1 ids** — `T-MOD-030`, `T-MOD-602`. Their disposition exists **only** in `audits/archive/P2-RESOLUTION-AUDIT.md:410-411,420-421,443-444` ("15/16", "27/28") → F-P2-03, F-P2-04 |
| **P3** media decode & build assets | **Completed** | C7 closeout, all acceptance gates green (`P3-C7-AUDIT.md`, `P3-AUDIT-RESOLUTION.md`); 74 of 81 declared ids cited | 7 uncited ids, **all** with a live later-phase owner: `T-MOD-122`→P4 (`WP-060-14`), `T-MOD-306/307/308`→P6 (`WP-070-06/07/08`), `T-MOD-507/508`→P9 (doc 080's `Phase owner` column), `T-AUD-114`→P8 (doc 090's). No P3 gap |
| **P4** static-render reference path | **Completed** | Three exit gates green; 20 goldens, no-script renderer; `packages/gfx/*`, `apps/decompiler/src/render/*`; `T-RT-111` cited | Gradient/bitmap fills, full stencil masks, filters, WebGPU are **later-phase scope by design**, not open P4 gates (roadmap `:63`) |
| **P5** AVM1 front end | **In progress** | C0–C4 complete as audit/evidence checkpoints; 102-row opcode catalog + 154 reserved codes partition all 256 values; 33 of 37 declared ids cited; `analyze --tiers` CLI; 10⁶-case seeded action-stream mutation gate | Three gates, recorded live in `P5-AUDIT-RESOLUTION.md` §§3–5: **(a)** byte round trip (no inverse format defined; `FE-032` is one-way), **(b)** open-corpus tier evidence + two independent reviewers (no admissible corpus; 26 local inputs contain no ActionScript-bearing SWF; zero T2 entries), **(c)** `FE-030` `ActionStringLength` byte-vs-char oracle. Route A defers runtime execution acceptance (`T-AVM1-008/009/012/025/027`, `FE-024/025/027/028`) to P7 |

### 3.2 The distinction that matters for P6

Four of the six phases are Completed, but "Completed" is a statement about **phase exit**, not about every
obligation in the phase's documents. P3 is the model case: 7 of its ids are uncited and *every one* carries
a live later-phase owner, so P3's completion is honest and its forwards are discoverable from the
documents alone. P2 has the same shape of leftover but its two forwards live in an **archived** audit, so
from the live record P2 looks like a Completed phase with two unexplained holes. That asymmetry — not the
hole count — is what F-P2-03/F-P2-04 and F-REG-01 are about.

---

## 4. Evidence inventory

### 4.1 Machine ledger (reproducible)

```
python3 tools/audit_dev.py --json          # 452 declared test ids, 190 registry codes
python3 tools/verify_docs.py               # ISSUES: 0
```

452 ids = **234 test-cited** + **216 scheduled-or-unwired** + **2 source-only**, re-measured 2026-10-14
after roadmap 1.28 and the `E-039`/`E-040` fixes. The one movement since 1.27 is P6's first wired
obligation: `T-CMP-005` is cited by `packages/compile/test/cache.test.ts` (`WP-120-02`, §11.2). The movement is fully accounted for: `T-RT-122`, `T-MOD-917`, `T-CMP-009` and
`T-AVM1-FE-036`/`-037` were declared (+5, of which `-036` is cited), `T-AVM1-FE-038`/`039`/`040` were
declared and the first two wired while fixing `E-035` (+3), `T-AVM1-FE-041` was declared and wired with
the `E-040` fix (+1 cited, §10.4), and the browser lane's
`packages/swf/test/io-vectors.lanes.test.ts` cites four P0/P1 ids that §4.1's first pass counted as
unwired. Earlier figures, for comparison: 441 = 227 + 212 + 2.

Attribution caveat, measured: document numbers **collide** between `docs/specs/` and `docs/impl/`
(`050` is both `specs/web/050-graphics-webgl.md` and `impl/transpiler/050-actions-and-avm1.md`; likewise
`010`, `030`, `040`, `060`–`130`). Any grouping keyed on `(\d{3})-` from a basename silently misattributes
ids — it moves P4's `T-GFX-*` evidence into P5's document. The table below is attributed by `/impl/` path
only.

| Phase (impl docs) | Cited | Unwired | Total | Unwired ids, with live owner |
| --- | --- | --- | --- | --- |
| P0 (`010`) | 7 | 3 | 10 | `T-SWF-009`, `T-SWF-014`, `T-SWF-017` — P0-owned, open by declaration (`010:657-664`). Cited rose 5 → 7 when the browser-lane vector-table test cited two ids this table had counted as unwired |
| P1 (`020`) | 14 | 0 | 14 | — (same lanes effect, 12 → 14) |
| P2 (`030`,`040`,`100`) | 65 | 2 | 67 | `T-MOD-030`, `T-MOD-602` — **both now have live owners** (roadmap 1.23): doc 120's new R032 and `T-CMP-009` receive `T-MOD-030`'s emitter half, and `T-AVM1-FE-035` owns `T-MOD-602`'s grammar. F-P2-03/F-P2-04 are disposed at source; the ids stay unwired until those tests are written |
| P3 (`060`,`070`,`080`,`090`) | 74 | 7 | 81 | all 7 owned: `T-MOD-122`→P4, `T-MOD-306/307/308`→P6, `T-MOD-507/508`→P9, `T-AUD-114`→P8 |
| P4/P7 (`130`) | 1 | 20 | 21 | `T-RT-101…122` are **P7's** (roadmap §3 splits doc 130: P4 = §5 only) → F-REG-01; `T-RT-122` was added 2026-10-13 for scope-chain/`SetTarget` resolution against a nested display tree |
| P5 (`050`) | 38 | 3 | 41 | `T-AVM1-FE-024` → P7 by Route A; `-034` → `WP-050-18` (serializer, unbuilt); `-035` → `WP-050-11` (grammar test, unwritten). `-037`/`-038`/`-039` are cited by `test/region-framing.test.ts`, `-040` by `test/try-bodies.test.ts` (landed with the `E-039` fix) and `-041` by `test/region-flow.test.ts` (landed with the `E-040` fix, §10.4) |
| P6 (`120`) | 6 | 7 | 13 | wired so far: `T-CMP-005` (`WP-120-02`), `-001`/`-010` (`WP-120-05`), `-011` (`WP-120-06`), `-012` (`WP-120-03`), `-013` (`WP-120-04`). `T-CMP-002…004`, `006…009` await their work packages (`T-CMP-009` was added 2026-10-13 to receive `T-MOD-030`'s emitter half) |
| P10 (`110`) | 0 | 17 | 17 | phase not started; `T-MOD-917` is the one P6-owned row (`WP-110-12`) |
| P11 (`140`) | 2 | 2 | 4 | phase in progress |
| P12 (`150`) / P13 (`160`) | 0 | 28 | 28 | phases not started |
| specs-only bands | 34 | 126 | 160 (+2 source-only) | design-spec obligations, distributed across phases |

**Read this table with §2's rule.** "Cited" is not "satisfied": P0's 5 cited ids include `T-SWF-015/016`,
which doc 010 itself says "do not assert their full recovery/error contracts" (roadmap `:59`), and
`T-MOD-510` is cited at P3 for its decode half while its `Phase owner` note reads "P6 for AVM1-dependent
reachability; P3 decode/code maps" (`080:…` test table). Conversely "unwired" is not "missing": re-measured, **all 16** unwired ids declared in P0–P5's impl
documents carry a live owner — a work-package row or a `Phase owner` cell — where the first pass found two
with none (`T-MOD-030`, `T-MOD-602`). Two of them had held a defect's obligation *on purpose* and were
wired when the defect was fixed, both on 2026-10-13: `T-AVM1-FE-037` for `E-035` and `T-AVM1-FE-040` for
`E-039`, which is why the count is now 15, and `T-AVM1-FE-041` for `E-040` landed the same way an hour
later (§10.4), which is why P5's cited count is now 38. No P0–P5 id is unwired by design any more. `E-041`
is the one open defect with no obligation declared — recorded in the errata, not in a test table, so that
no id claims coverage that does not exist.

### 4.2 P6's suppliers, measured to the citing test file

Every distinct `Depends` id of every `WP-120-*` row (`docs/impl/transpiler/120-compiler-and-emitter.md:189-202`):

| Supplier | Owner | Consumed by | Evidence | Audit disposition |
| --- | --- | --- | --- | --- |
| `WP-020-10` `SwfFile` facade | P1 | `WP-120-01` | `T-SWF-018`, `T-SWF-021` → `packages/swf/test/container.test.ts` | **Delivered** |
| `WP-030-09` frame assembly | P2 | `WP-120-06` | `T-MOD-012` → `apps/decompiler/test/dump.test.ts` | **Delivered** |
| `WP-050-08` tier assignment + residual extraction | P5 | `WP-120-03`, `WP-120-09` | `T-AVM1-FE-008`, `-009` → `packages/avm1/test/tier.test.ts`; corpus evidence → `audits/P5-C4-CORPUS-EXTERNAL.json` (73 licensed movies: 119 blocks, 93 functions, T0=191 T1=3 T2=18) | **Delivered**; the open-corpus report now exists, so gate (b)'s evidence half is met. It is **unsigned**: `E-035` empties every real function body, so P6 must not yet consume `bodyStart`/`bodyEnd` from real content (F-P5-07) |
| `WP-050-09` version semantics matrix | P5 | `WP-120-04` | `T-AVM1-FE-022` → `packages/avm1/test/semantics.test.ts` | **Delivered** |
| `WP-050-10` call/init + determinism | P5 | `WP-120-05` | `T-AVM1-FE-020` → `operands.test.ts`; `-023` → `semantics.test.ts` | **Delivered** |
| `WP-090-10` resample to 48 kHz | P3 | `WP-120-07` | `T-AUD-110` → `packages/audio/test/media-codecs.test.ts` | **Delivered** |
| `WP-080-10` glyph atlas | P3 (+P6 forward) | `WP-120-07` | PNG/JSON half: `T-MOD-509` → `apps/decompiler/test/assets-dump.test.ts`. KTX2/`.sfa`+mip half: **forwarded to P6** (`080:401`, `IMPL-080` v1.3) | **Partly delivered**; the P6 half is P6's own work |
| `WP-070-07` re-encode ladder + mips | **P6** (`070:450`, `Phase owner: P6`) | `WP-120-07` | `T-MOD-307` **unwired**; `packages/assets/src` has no `reencode.ts`/`mips.ts` | **Not built — intra-P6**, must be sequenced before `WP-120-07` |
| `WP-110-12` `DefineVideoStream` header + summed `VideoFrame` byte extents (was `WP-110-06`) | **P6** (doc 110 v1.4 §2, roadmap 1.23) | `WP-120-07` — which now *names* it in `Depends` | `T-MOD-917` **unwired**; no `video/*` module exists | **Not built — but re-homed into P6 per F-P6-01's recommendation, so the cross-phase inversion is gone.** The VP6/H.263 packet-header and alpha-pairing half stays P10's `WP-110-06` (`T-MOD-909`/`915`, `110:396`) and is a labelled worst-case estimate until it lands (doc 120's R031) |

P6's own 9 obligations (`T-CMP-001…009`) are all unwired, as expected for a not-started phase.

**Transitive supplier worth naming:** `WP-070-07` ← `WP-070-06` ← `WP-070-05` ← `WP-070-04` ←
`WP-070-01`, and `WP-070-01`'s `Depends` is **`WP-010-11`, `WP-020-05`** (`070:444`). `WP-010-11`
("Test writer + property tests + allocation test", `010:643`, 3 d, P0) is **unbuilt**. P3 reviewed that
edge and proceeded — legal under roadmap `:638` — but it means the only P0 work package on P6's transitive
path is `WP-010-11`, and it is also the package that supplies the §8 vector rows for `RECT`, `MATRIX` and
`CXFORMWITHALPHA` that the emitter's matrix emission rests on.

### 4.3 Gate re-run

See §10. All green; no gate was relaxed to produce this audit's conclusions.

---

## 5. Findings

### F-P2-03 (blocking) — `T-MOD-602`'s target-path grammar is orphaned across three documents and unexercised on the emitter's critical path

`T-MOD-602` is an F1 obligation: "Instance naming + `SetTarget` path grammar (`/abs`, `..`, relative,
`""`) over a nested fixture" (`docs/impl/decompiler/030-display-list-and-sprites.md:408`). It is uncited by
any test. Its disposition — "grammar is P5" — exists only in archived prose
(`audits/archive/P2-RESOLUTION-AUDIT.md:411,420,443-444`; `audits/archive/P2-INTEGRITY-AUDIT.md:95`).
Following the forward to P5:

- The grammar **is specified** in P5: `IMPL-050-R036` (block splitting, `""` restores the current file)
  and **`IMPL-050-R037`** — "Variable names and frame operands may carry a target prefix in both syntaxes:
  `"/A/B:FOO"` (slash) or the dot form … The prefix parser is `properties.ts` and is shared by
  `GetVariable`/`SetVariable`, `Call`, `GotoFrame2`, and `WaitForFrame2`" (`050:420-426`).
- The grammar **is implemented**: `packages/avm1/src/frontend/properties.ts:57 parseTarget()` and
  `:91 formatTarget()` (103 lines), consumed in production by `control-flow.ts:215,301` and `stack.ts:859`,
  and re-exported from `packages/avm1/src/index.ts:42,44`.
- **No test id in any phase owns it.** Doc 050's test table has `T-AVM1-FE-004` (`SetTarget` block
  splitting and *region extent*) and `T-AVM1-FE-021` (property ids 0–21); neither is a grammar matrix, and
  no row mentions `R037`, the dot form, `..`, or relative paths.
- **No test touches the parser directly.** `grep -rn "properties.js\|parseTarget\|targetPrefix"
  packages/avm1/test/*.ts` → empty. Indirect coverage via `T-AVM1-FE-004` (`control-flow.test.ts:11,35-40`)
  exercises only `/a`, `/a/b` and `""`.
- **P7 does not pick it up either.** `WP-130-03` "Scope chain, `with`, `SetTarget` resolution"
  (`130:236`) carries **no test id** in its deliverable cell, and doc 130 §8 has no scope/`SetTarget` row.
- A **second, divergent formatter** exists: `frontend/disassemble.ts:48` defines its own local
  `formatTarget()` while `index.ts:42` exports `properties.ts`'s.

**Impact:** `WP-120-08` ("Emitter: symbols, frames, classes, buttons") emits navigation from these paths.
The dot form, `..`, bare-relative, and `:`-suffixed variable prefixes are specified, implemented, consumed,
and never asserted — so the emitter inherits an unverified formatter, and two formatters for one `TargetRef`
can diverge without any gate noticing. This is the single clearest case in P0–P5 of the repository's own
prohibition ("code presence or a test citation alone is not closure") being violated in the *forward*
direction: the sending phase archived the disposition, and no receiving phase recorded it.

**Required before P6:** one test id owning `R037`'s full grammar matrix (either extend the `T-AVM1-FE-004`
row or add a doc-050 row), cited by a direct `parseTarget`/`formatTarget` test covering `/abs`, `..`,
relative, `""`, dot form, and the `:`-suffixed variable prefix; `disassemble.ts` delegates to the canonical
formatter; and doc 030's row gains a live `Phase owner` disposition (see F-REG-01 for the column).

### F-P2-04 (blocking) — `T-MOD-030`'s two halves have no live owner past P2

`T-MOD-030` is F1: "`NamedAnchor` navigation data reaches the shell; the emitted bundle never reads
`location`" (`docs/impl/decompiler/040-control-tags-and-metadata.md:456`). Uncited. Archived disposition:
"`T-MOD-030` shell navigation … runtime/emitter navigation" (`P2-RESOLUTION-AUDIT.md:410-411,421,443-444`;
counted as IMPL-040 "27/28").

Following both halves forward:

- **Decode half is real and tested elsewhere.** `NamedAnchor` is exercised in
  `packages/swf/test/control.test.ts`, `packages/swf/test/model.test.ts`, and
  `apps/decompiler/test/dump.test.ts` — under other ids, so the *data* exists.
- **"Reaches the shell" has no owner.** The shell is `WP-130-15` ("DOM shell, boot, CSP, lifecycle",
  `T-RT-115/017`, `130:248`); neither that row nor doc 130 §7 mentions anchors, scenes, or navigation.
- **"Never reads `location`" has no owner.** `grep -n "anchor\|Anchor\|scene\|Scene\|location"` over
  `docs/impl/transpiler/120-compiler-and-emitter.md` and `docs/impl/engine-flash/130-runtime-and-renderer.md`
  returns **two hits, both unrelated** (an atlas module name and a WebGPU scene-graph rule). There is no
  `IMPL-120-R*` requirement, no `WP-120-*` deliverable, and no `T-CMP-*` obligation for it.

**Impact:** the prohibition is an *emitter* constraint with no requirement text in the emitter's document.
P6 can emit `_root`-relative or `location`-based navigation, pass type-check, `verify`, determinism and
budgets, and satisfy every gate it has — while failing an F1 obligation that a Completed phase explicitly
handed it. Because the handoff is in an archived file, a P6 implementer reading doc 120 and the roadmap
will never see it.

**Required before P6:** the prohibition becomes an `IMPL-120` requirement attached to `WP-120-08` with a
`T-CMP-*` obligation (the natural pairing is with `WP-120-12`'s forbidden-construct lint, which already
exists to fail the build on emitter-side prohibitions); the "reaches the shell" half gets a named owner in
doc 130 (`WP-130-15` or `WP-130-05`) with a test id; doc 040's row gains a live `Phase owner`.

### F-P6-01 (blocking) — `IMPL-120-R028`'s video bytes cannot be computed by P6, and the P6→P10 forward has no dispositioned consequence

`IMPL-120-R028`: "The plan pass MUST compute: bundle bytes by module group, texture bytes, audio bytes,
**video bytes**, residual bytecode bytes, and the runtime's estimated first-frame work. These are written
to `budgets.json`" (`120:154-156`). The supplier named by `WP-120-07` is `WP-110-06` — "Packet-header
validation for H.263/VP6 (+ alpha pairing)", P10, `format.ts`/`alpha.ts`, `T-MOD-909/915` (`110:396`).

Measured state:

- **The video tags are not decoded at all.** `DefineVideoStream` (60) and `VideoFrame` (61) appear in
  source only as tag-code constants (`packages/swf/src/tags/tag-codes.ts:62-63`), minimum lengths
  (`:176-177`), and switch cases in `model/movie.ts:145` and `model/timeline.ts:337`. Their decoder is
  `WP-110-01` ("`DefineVideoStream` + `VideoFrame` + display/availability indices", `video/*`,
  `T-MOD-903/914`, `110:391`) — P10, unbuilt. So P6 has no frame count, no dimensions, no codec id, and
  no per-frame payload lengths: not even a pass-through byte total.
- **Alpha pairing doubles the emitted assets** and is only knowable from packet headers, which is precisely
  why `WP-110-06` was named as the supplier.
- **The edge is registered but its consequence is not.** Roadmap `:309` records `WP-120-07 ← WP-110-06` as
  an "Accepted forward … both phases are Not started, so the edge is a sequencing constraint, not a block;
  it is recorded here so P6 cannot be scheduled as if P10 were absent." Nothing states what `budgets.json`
  contains for video in the meantime, so R028 is either violated at P6 exit or silently reinterpreted.

**Impact:** P6's asset planner and its budget report have a required field with no possible input. Whoever
builds `WP-120-07` will improvise — either omitting video bytes (R028 violation), hard-coding zero
(silently wrong for every title with video), or pulling P10's validation forward wholesale (phase
inversion, and 3 d of P10 scope inside P6).

**Required before P6 — apply the standing re-homing rule (data owned by a later phase moves to the earliest
phase that needs it).** The earliest phase that needs *video data* is P6, and what P6 needs is **extent,
not decode**: `DefineVideoStream`'s header fields plus the summed `VideoFrame` payload lengths. That is
pure tag decode — P3-era media-model work, the same shape as `SOUNDINFO`. Recommended disposition:

1. Split `WP-110-01`'s **header + byte-extent decode** out of P10 and re-home it to the earliest phase that
   needs it (P3's media-model layer, or P6's `WP-120-07` if P3 is not reopened). Transcode driver,
   Screen Video v1/v2 decoders, packet-header validation, emission, verification and the runtime contract
   (`WP-110-02…09`) stay in P10.
2. Give `IMPL-120-R028` a P6-scoped reading: video bytes are exact **source** extents; alpha-pairing cost
   is a documented estimate surfaced with an info-severity diagnostic naming it as an estimate, replaced by
   the exact figure when `WP-110-06` lands at P10. Record that reading in doc 120 §7 and in the §4.4
   register entry at roadmap `:309`.

The weaker alternative — splitting `WP-120-07` into a non-video half (all suppliers delivered) and a video
half deferred to P10 — keeps phase boundaries tidy but leaves P6's done criterion 1 unsatisfiable for any
title containing video, so it should only be chosen if re-opening P3's media layer is refused.

**Update, later the same day — implemented as recommended, in doc 110 rather than doc 030.** Roadmap 1.23
adds **`WP-110-12`** "DefineVideoStream header + VideoFrame extents", 2 d, `video/extent.ts`,
`T-MOD-917`, **`Phase owner: P6`**, sequenced as `WP-120-07`'s own first step, with the alpha-pairing
worst case documented as an estimate per recommendation 2 (doc 120's R031). Doc 120's `WP-120-07`
`Depends` now names `WP-110-12`; the P6→P10 edge is no longer registered as an accepted inversion, and
doc 110 v1.4 records the split and why P10 was chosen over re-opening P3 (P3 is Completed, and `IMPL-110`
is the only place a media byte extent can be read coherently, since `DefineVideoStream` supplies the
codec id and frame count that `VideoFrame` lengths must be paired with). The two halves P10 keeps —
`WP-110-06`'s packet-header validation and alpha pairing — are unchanged, so this finding's *blocking*
status is discharged while its second bullet ("alpha pairing doubles the emitted assets and is only
knowable from packet headers") stays true and is now an explicitly labelled estimate instead of a silent
gap.

### F-P6-02 (blocking) — P6's done criteria name two artifacts that exist nowhere: "the reference title" and "the whole corpus"

- `120:207` (§10.1): "`swfforge build` on **the reference title** produces a project that type-checks,
  passes `verify`, and rebuilds byte-identically."
- `120:210` (§10.3): "Cache warm/cold equivalence holds over **the whole corpus**." "Corpus" appears exactly
  once in doc 120, unbounded.

Measured:

- "Reference title" occurs **four times repo-wide, always as a use, never as a definition**: `120:207`
  (P6 §10.1), `130:126` (F2 budget narrative), `130:226` (`T-RT-118`, "draw-call budget gate on the
  reference title's worst frame"), `130:258` (P7 done criterion 1, "plays from start to finish"). No spec,
  register, roadmap section, or audit names the title, its provenance, or its location.
- `examples/` — "tiny hand-written games exercising the host API directly"
  (`docs/specs/foundation/010-repository-and-toolchain.md:32`) — **does not exist**.
- `fixtures/` holds 21 committed `.swf` files plus 5 crasher-corpus files and **no `PROVENANCE.md`**, which
  `REPO-R017` requires (`…010-repository-and-toolchain.md:181`).
- The repository already knows how to fix this: `T-SWF-009`'s "every fixture" was explicitly **bounded to
  the in-repo corpus** (roadmap `:272`, `:412`; `020:513`) with three sanctioned roles for committed
  binaries (`IMPL-020-R038`). Doc 120 §10.3 never received the same treatment.

**Impact:** P6's exit is untestable as written, and so is P4/P7's F2 budget gate `T-RT-118`. Because the
subject is undefined, it will be chosen implicitly by whoever builds P6 — *after* the emitter's output
layout, the budget thresholds, the golden set and the determinism job have all been shaped around that
implicit choice. This is also the same missing artifact as P5's open gate (b): the licensed/provenanced
open-corpus title that P5's tier evidence needs and that P6's §10.1 names. Resolving one resolves both.

**Required before P6:** one register entry defining the reference title (candidate A: a
licensed/provenanced open-corpus title from P5 gate (b) / P11's corpus program; candidate B: a synthetic
reference title committed under `IMPL-020-R038`'s sanctioned roles, which keeps P6 independent of the
corpus gate but weakens §10.1's fidelity claim), pointed at from roadmap §2.1 and cited by `120:207`,
`130:126`, `130:226`, `130:258`; and a bound on "the whole corpus" in `120:210` using the same rule the
roadmap applied to `T-SWF-009`.

**Update, later the same day.** The register this finding asked for exists
([`docs/impl/registers/corpus.md`](../docs/impl/registers/corpus.md) v1.1) and its class C4 is no longer
empty — but what was admitted is **C4-c**, a licensed *conformance* corpus, not a title. C3 and the new
C4-t subclass both stay at 0, so this finding's core requirement is still open. What changed is the
blocker: the provenance *mechanism* is proven (a committed manifest carrying upstream, pin, licence,
reuse basis and a sha256 per file, with the bytes fetched into `.forge-cache/`), so C3's class (a) now
waits on a candidate rather than on paperwork. §2's requirement 3 also grew a third arm — a hash-pinned
manifest entry as an alternative to a sanctioned committed role — which is **proposed, not agreed**, and
is the register's open item 5 because it is what would let a fetched title satisfy C3 without committing
bytes.

### F-P6-03 (material) — P6's authoritative scope is 64 d across four documents; the roadmap sizes it at 30–45 d, and §7's own totals disagree with §10's

Measured by summing every `Phase owner: P6` row plus all of doc 120:

| Document | P6-owned WPs | Days |
| --- | --- | --- |
| `120-compiler-and-emitter.md` | `WP-120-01…14` (whole table) | 46 |
| `070-images-and-morphs.md` | `WP-070-06` 3, `WP-070-07` 5, `WP-070-08` 3, `WP-070-09` 2 | 13 |
| `080-fonts-and-text.md` | `WP-080-11` (subsetter) | 3 |
| `090-sounds.md` | `WP-090-12` (`budgets.json` audio section) | 2 |
| **Total** | | **64** |

Roadmap §7's P6 row says **30–45 d** (`:541`). `IMPL-R003` — "Estimates are planning placeholders: they
MUST be corrected in place when a package is completed, so the roadmap's remaining-effort numbers stay
honest" (`docs/impl/README.md:142`) — is the rule that requires this to be fixed, and §7 itself says its
figures are "to be corrected in place" (`:530`). P3's row was reconciled this way ("146 d summed from
P3-owned WPs … upper 27 d is phase integration", `:538`); P6's was not.

Two further §7 defects, both machine-checkable and both currently unchecked:

- §7's prose says the document tables total "**≈ 646.5** developer-days" (`:549`) while §10's index Total
  says "**≈ 658.5**" (`:634`) — a 12 d disagreement inside one file. `tools/verify_docs.py` validates the
  §10 index against per-document sums (658.5 is correct) but does not read §7's prose figure.
- §7's **Total 488–683** is exactly the sum of the P0–P11 rows and therefore **excludes P12 and P13**,
  whose documents sum to 41 d (`150`) and 51 d (`160`) — 92 d of scoped work with no phase row at all.
  For reference, P0's row (12–18) also sits below its authoritative sum (20), P1's (15–22) below 26, P2's
  (25–35) below 82, P10's (15–25) below 34, and P11's (20–30) below 48.5.

**Impact:** P6 would be scheduled at roughly half its authoritative size, and 18 d of P6 work sits in three
P3-era documents that a P6-only reading of the roadmap never surfaces. That is the same blind spot that
makes `WP-120-07`'s supplier `WP-070-07` look like a P3 leftover when it is P6's own row
(`070:450`, `Phase owner: P6`). The §7/§10 disagreement means the roadmap's headline number is wrong in
the document that owns sequencing.

**Required before P6:** restate §7's P6 row from the P6-owned sum (64 d + integration overhead, using P3's
row as the template); correct §7's 646.5 to the §10 figure; add P12/P13 rows or mark them explicitly
unsized; and extend `tools/verify_docs.py` to cross-check §7's prose total against the §10 index so the
two cannot drift again.

### F-P0-08 (material) — P0's open list is correctly recorded, but two of its five unevidenced ids are *cited*, which the ledger cannot express, and one P0 package is on P6's transitive path

Doc 010 §10 states its own position precisely (`010:657-664`): the open-items table is empty of
*chapter-text* rows, but "§11's done criteria are a separate list, and several are still open — the §8
vector matrix is incomplete until `WP-010-11`'s writer exists for the `RECT`/`MATRIX`/`CXFORMWITHALPHA`
rows, the `UI32` row is disputed (`E-033`), and `T-SWF-009`/`014`/`015`/`016`/`017` all lack their
evidence," with an explicit warning that `STATUS.md`'s "0 open items" must not be read as P0 being
closeable. Roadmap `:59` adds `WP-010-12`'s reader fuzzer and the diagnostic-literal lint rule.

Two measurements this audit adds:

- **`T-SWF-015` and `T-SWF-016` are in the ledger's *cited* column** (P0 shows 5 cited / 3 unwired) while
  doc 010 and roadmap `:59` both say their tests "do not assert their full recovery/error contracts". The
  machine ledger has no vocabulary for "cited but under-asserting", so P0's cited count overstates closure
  by two ids.
- **`WP-010-11` (3 d, P0) is on P6's transitive path** via `WP-070-01 → WP-070-06/07/08` (§4.2). It is
  also the package that supplies the §8 vector rows for `RECT`, `MATRIX` and `CXFORMWITHALPHA` — the record
  types the emitter writes into emitted projects — and `T-SWF-014`'s 10⁵-case `writer → reader → writer`
  fixed point. Doc 120 never mentions allocation (`grep -c alloc` → 0), so `T-SWF-017`'s counter contract
  (`IMPL-010-R043`–`R045`) is **not** a P6 dependency; it is consumed by doc 130's budgets at P4/P7.

**Impact:** P0 is the only phase below P6 with a package on P6's transitive path, and it is a *test-support*
package, so it does not block writing P6 code — it blocks **evidencing** `T-MOD-307`/`T-MOD-308`
(re-encode ladder, `.sfa` round trip) and the vector completeness that matrix emission rests on. Left
unbuilt, P6's asset half would be delivered with round-trip claims that have no property-test backing.

**Required before P6's asset half (§6.2 item 6):** build `WP-010-11`. Everything else in P0's open list
stays P0/P11-owned (§6.3).

### F-P5-06 (material, **revised** — see the update at its end) — Of P5's three open gates, exactly one is on P6's critical path

`P5-AUDIT-RESOLUTION.md` §§3–5 leaves three gates open. Dispositioned against P6:

| P5 open gate | Bears on P6? | Reasoning |
| --- | --- | --- |
| **(a) Byte round trip** — no AVM1 text parser or action-byte serializer exists; `FE-032` is explicitly one-way; the resolution requires "a lossless inverse format and byte-identity acceptance for every defined opcode … a separately scoped/estimated P5 work package" | **Yes — before `WP-120-08`** | `WP-120-09` carries **raw** residual bytecode bytes (`120:155`, `120:197`), so T2 paths are safe without a serializer. T0/T1 paths are emitted from the IR: if front-end decode is lossy, the emitter produces faithful-looking wrong code, and **no P6 gate would catch it** — P6's gates are type-check, `verify`, determinism and budgets, none of which compare against source bytes. The round trip is the only specified proof of front-end losslessness. Defining the inverse format and its acceptance is cheap and can precede the WP; the WP itself can run in parallel with P6's pipeline half |
| **(b) Open-corpus tier evidence + two independent reviewers** — no admissible corpus; the 26 local inputs contain no ActionScript-bearing SWF; zero T2 entries; one auditor | **No for start; yes for claims** | P6's milestone M4 and §10 are expressed over synthetic fixtures plus the (undefined, F-P6-02) reference title, and `WP-050-08`'s tiering is delivered and locally tested. The exposure is that tier decisions taken on content with **zero T2 entries** get re-litigated when real content arrives, and `WP-120-03` (dead code) and `WP-120-09` (residual) encode those tier assumptions. Same missing artifact as F-P6-02 |
| **(c) `FE-030` `ActionStringLength` byte-vs-char oracle** — Lightspark `9092db6` uses `numChars()`, Ruffle carries a SWF-5 TODO, Shumway shares a helper | **No** | A semantics question that Route A already placed at P7 runtime acceptance. The emitter emits the call either way; the oracle decides what the *runtime* returns |

**Impact:** treating "P5 is In progress" as a blanket P6 blocker would hold P6 for a corpus program that
P6's own milestone does not require. Treating it as no blocker at all would let `WP-120-08` emit T0/T1
function bodies against a front end whose losslessness has never been demonstrated — and retrofitting a
byte-identity proof after emission is the expensive direction.

**Required before P6:** define the lossless inverse format and its byte-identity acceptance (a spec edit,
not an implementation), and scope the round-trip WP separately, before `WP-120-08` begins emitting function
bodies. Gates (b) and (c) are recorded as P6-claim-bounding and P7-gating respectively.

**Update, later the same day — the heading's "exactly one" no longer holds, and row (b)'s premise is
gone.** Row (b) said "no admissible corpus; the 26 local inputs contain no ActionScript-bearing SWF; zero
T2 entries". The retried screen admitted 73 licensed AVM1 conformance movies (C4-c, `registers/corpus.md`
v1.1) and the report has **18 T2 entries** under six semantic reasons
(`audits/P5-C4-CORPUS-EXTERNAL.json`). Running it is what found `E-034` (fixed) and `E-035` (open), and
`E-035` left **every function in real content modelled as empty-bodied** — so gate (b) stopped being
P6-claim-bounding only: it bore directly on `WP-120-07`, which plans against function bodies, and on
`WP-120-08`, which emits them. Two P5 gates on P6's critical path, not one. **Second update, later the
same day:** `E-035` is fixed (with `E-036`/`E-037`/`E-038`), so `WP-120-07` is clear — real function
bodies are real ranges, and the corpus now reports 150 functions with tiers T0=123 T1=121 T2=25. What
keeps gate (b) on P6's path is `E-039`, still open: a `Try`'s catch and finally bodies are decoded and
then dropped from the IR, so `WP-120-08` would emit no catch code for a `Try`-bearing title. **Third
update, later still:** `E-039` is fixed — `T-AVM1-FE-040`, six cases, and reverting `frontend/stack.ts`
fails 7 tests in 3 files — so `WP-120-08`'s catch-code path is clear as well. What is left on gate (b) is
the second reviewer, plus `E-040`, which inflates the `stack-mismatch` count this report signs.
**Fourth update, later still:** `E-040` is fixed — `T-AVM1-FE-041`, five cases, and reverting
`frontend/control-flow.ts` fails 6 tests in 3 files — and the claim in the third update that it "does not
drop code" was **wrong and is corrected here**: the same fixpoint stall that dropped a region body's ops
also dropped every block downstream of any unreachable tail, so `string_coercion.swf`'s disassembly grew
from 119 lines to 654 when it was repaired (§10.4). Gate (b) now waits on the reviewer alone; `E-041`
affects where a diagnostic points, not what the IR holds. The lesson
generalises and is the reason this finding was revised twice in one day — an unsatisfied corpus gate does
not merely withhold evidence, it hides defects that only real content can show, and each fix revealed the
next one. Row (a) is unchanged and still
the reason `WP-120-08` must wait; row (c) is unchanged and still P7's. The *disposition* is nevertheless
unchanged: `WP-120-01…-06` may still start, because none of them reads a function body — §6.2 item 11 and
§6.4.

### F-P5-07 (blocking) — The committed corpus contains no action block, so the AVM1 front end had never met one; when it did, two framing defects appeared

**Where:** the 26 C1 inputs (`fixtures/` 21 + `packages/swf/test/fuzz/corpus/` 5);
`packages/avm1/src/frontend/analyze.ts`; `packages/swf/src/test-support/writer.ts`.

**The structural fact.** `audits/P5-C4-CORPUS.json` is the tier report over all 26 committed inputs, and
it records **0 action blocks, 0 functions, 0 tier entries**. Every AVM1 test in the repository therefore
builds its action bytes in-process through `test-support`'s `actionBlock()` or the harness's `block()`.
That is legitimate unit coverage, but it was all P5 had, so the *shape* of every input the front end ever
saw was chosen by our own generators.

**What that hid — `E-034` (fixed).** `actionBlock()` emitted a `UI32` length prefix before the record
bytes and cited `IMPL-050-R003`/`R006` for it; those rules describe a *per-record* `UI16` that follows a
high-bit `ActionCode`, and say nothing of the kind. `analyze.ts`'s `sliceBlock` skipped four bytes to
match, and refused any ref shorter than four. Generator and consumer were self-consistent, so the suite
was green — 750 tests — while every real `DoAction`/`DoInitAction` mis-parsed: read from its fifth byte,
`Push "// frame 3 A"` became `unknown-opcode:0x2f`, `0x72`, `0x6d` (ASCII, the string's own tail), and a
726-byte script reported as one `End` with 725 bytes dropped.

**What that hid — `E-035` (open, blocking).** `DefineFunction` (0x9B) and `DefineFunction2` (0x8E) place
`Code[CodeSize]` **past** the record's `Length`. Measured across the corpus: of the records that decoded
in sync, **89 of 89** `0x9B` and **57 of 57** `0x8E` have `headerLen == Length`, and **0 of 146** have
`headerLen + codeSize == Length`. Our decoders clamp the body to the record end and, on overrun, emit
`SF0400`, mark the block truncated, and return `bodyStart == bodyEnd` — an empty body — after which the
walker re-decodes those bytes as the function's siblings and consumes the block's real terminator, which
is what fires `SF0420` on 49 of 73 files. So **every function in real content is modelled as
empty-bodied**, and 48 of 73 files report an error that is ours, not theirs. Function bodies are the
transpiler's unit of work: this sits under `IMPL-050` §13 criterion 2 and under P6's plan pass.

No third generator could have caught it either — `tools/avm1-restart-probe.mjs` builds its
`DefineFunction` with the body *inside* `Length`, encoding the same assumption.

**Evidence.** `audits/P5-C4-CORPUS-EXTERNAL.json`: 73 files, 119 action blocks, 93 functions, T0=191
T1=3 T2=18, six semantic T2 reasons (`stack-mismatch`, `try-malformed`, `dynamic-with`,
`call-dynamic-target`, `dynamic-args`, `dynamic-stack`), **zero** `unknown-opcode` reasons, no hash
mismatch, no internal error, no AVM2 input. Two files measured before and after the `E-034` fix: `call`
T0=1/**T2=4** → **T0=7**/T2=0 with one function recovered; `goto_frame2` T0=4/**T2=11** → **T0=20**/T2=0
with five functions recovered *by name*. The restart probe's artifact was regenerated: 13 of its 17 keys
are byte-identical and the only content change is that its three function ids each moved by exactly four
(`fn_37`→`fn_33`, `fn_5b`→`fn_57`, `fn_78`→`fn_74`).

**Required before P5 closes.** Land `E-035` and re-run `pnpm corpus:report`; then have the second
reviewer sign it. `E-034` is closed — fixed, pinned by `T-AVM1-FE-036` with a reverting negative control
(restoring either half fails 3 of its 4 cases), and `IMPL-050-R070` now states the ref contract.

**Update, later the same day — `E-035` is landed, and the fix widened the finding.** Doc 050 gained a
region rule covering all four opcodes that own bytes past their record's `Length`, backed by one shared
parser (`packages/avm1/src/frontend/extents.ts`) so the framing walker and the operand decoders cannot
disagree; `ActionRecord` gained `regionEnd` and the walker continues there, so a body is decoded exactly
once and a block's `End` stays with its own block. `IMPL-050-R008` turned out to need no correction — it
already closed a block by `codeSize`; the rule that was wrong is the `Try` tiling rule, whose original
wording ("the three bodies tile the record") made **every real `Try` malformed**, which is the `Try` half
of the new `E-036`. Generalising `E-035` also produced `E-037` (a function body is not `End`-terminated:
0 of 66 real bodies end with `End`, so the phantom block-terminator warning fired once per function) and
`E-038` (a truncated region emitted an error-severity diagnostic and then tiered 0, because the reason
pass only read the truncation flag inside a desync guard). All four are fixed and wired by
`T-AVM1-FE-037`/`038`/`039` in `packages/avm1/test/region-framing.test.ts`; both fixture generators — the
AVM1 test harness and `tools/avm1-restart-probe.mjs` — moved to the real shape, region bytes past
`Length`, which is what makes them evidence rather than a mirror of the code.

Measured after (`pnpm corpus:report`, same 73 files at the same pin): the three framing diagnostic
families this finding was built on are **all at zero files** — `SF0400` 48 → 0, `SF0420` 49 → 0,
`SF0404` 5 → 0 — error-severity diagnostics 60 → **15**, and all 15 are semantic (13 stack depth at a
block join, 2 branch targets off a record boundary), which is what a T2 reason is for. Clean exits 21 →
**59 of 73**. Functions 93 → **150** (nested bodies are now found at the right depth), T1 3 → **121** —
the constant-pool-is-dynamic-inside-a-function rule became reachable for the first time and fires 132
times — and T2 18 → **25** across ten reasons instead of six. The restart probe's artifact is
byte-identical in **15 of 17** keys, including `directReportSha256`: the same three functions still tier
0/1/2 for the same reasons, so the fix changed the framing without changing the analysis.

**Fixed later the same day, and what is left of the finding:** `E-039` — a `Try`'s `catch` and `finally`
bodies were decoded and then dropped from the IR. The errata entry's first diagnosis (that the region
patch lost the bucket) was **wrong**: instrumenting the real pipeline showed the framing, the scope keys
and the patch all correct, and what was missing was an input depth. `frontend/stack.ts`'s fixpoint seeded
one region body per region *record*, so a `Try`'s catch and finally entry frames — which have no CFG
predecessors, because they are entered by unwinding rather than by a branch — never settled and were never
simulated, and their blocks reached the IR with no ops. The one body it did seed latched `unknown` in the
same iteration, before its own region op had run, so *every* region body, `With` bodies included, carried
`-1` depths. Doc 050's structured-region rule requires that an emitter reconstruct `try`/`catch`/`finally`
from the IR alone; it could not, so an emitter would have silently dropped catch code.

Both halves are fixed under doc 050's new region-entry rule: each body takes the depth the player gives it
— the `Try` entry for the try and catch bodies, the join of the try and catch bodies' exits for the
finally body, and a dynamic depth rather than an `SF0406` mismatch where those two disagree — measured
against `ruffle-rs/ruffle`'s `action_try` and `action_with`. `T-AVM1-FE-040` is wired
(`packages/avm1/test/try-bodies.test.ts`, six cases); reverting `frontend/stack.ts` fails 7 tests in 3
files, including the disassembly golden, which had baked the dropped records in. Seeding the finally body
at the `Try` entry instead — the obvious first attempt — was measured and rejected: it added three
`SF0406` errors to the corpus, because real content pushes in a try body and pops in the finally. The
regenerated report reads T0 123 → **124**, `call-dynamic-target` 9 → 3, `dynamic-args` 11 → 5,
`dynamic-stack` 13 → 10, `SF0410` warnings 132 → 145, errors **15 → 15** with `SF0406` identical file
by file. Only three files in the C4-c corpus contain a `Try`, so this corpus still cannot size the
structure's coverage — a second reviewer, and a C4-t title, still owe P5 that. **Required before P5
closes:** the reviewer's signature. `E-040`, which this measurement found, is **fixed** (§10.4) — and it
did change what the IR contains, not only tier counts: the stall underneath it had been dropping whole
statement sequences. `E-041` remains open and changes diagnostic offsets rather than IR content.

**Note for P6.** With `E-035` landed, `FunctionDef.bodyStart/bodyEnd` from real content are real ranges,
so `WP-120-07`'s plan pass can budget function bytes. `E-039` replaced it on `WP-120-08`'s path and is
now fixed too, so an emitter reading a `Try` region receives its catch and finally blocks with verified
depths. Neither is on P6's *start* gate —
`WP-120-01…-06` touches neither a function body nor a `Try` region.

### F-REG-01 (material) — The machine ledger cannot distinguish a documented deferral from a missing test, and it attributes doc 130's P7 obligations to P4

`tools/audit_dev.py` has disposition mechanisms for **edges** (`DISPOSITIONED_INVERSIONS`, `:704`),
**diagnostics** (`DEFERRED_DIAGNOSTIC_WPS`, `:587`) and **forwards** (`DEFERRED_FORWARD_PHASES`, `:673`) —
and none for **test ids**, which get a single undifferentiated status (`:999`,
`status = "scheduled-or-unwired"`). Three consequences, all measured:

1. **Documented deferrals are indistinguishable from gaps.** Only docs `080` and `090` carry a `Phase owner`
   column in their *test-obligation* tables (19 rows: `T-MOD-507/508` → "P9 runtime", `T-AUD-114` →
   "P8 runtime", `T-MOD-509` → "P3 build determinism; P4/P9 visual fidelity", `T-MOD-510` → "P6 for
   AVM1-dependent reachability; P3 decode/code maps"). The tool does not read that column — it reads the
   *work-package* table's (`:684`). So 212 ids sit in one bucket, containing P6/P7/P10/P12/P13's
   not-started ids (expected), P3's six documented forwards (expected), P0's three declared-open ids
   (expected), and P2's two **undispositioned** ids (F-P2-03, F-P2-04) — with no way to tell them apart
   without hand-joining three tables and reading archived prose.
2. **Docs 030/040/070 have no such column at all**, so their forwards are discoverable only through the WP
   table (`T-MOD-306/307/308` → `WP-070-06/07/08`, `Phase owner: P6`) or not at all (`T-MOD-030`,
   `T-MOD-602`).
3. **`DOC_PHASE[130] = P4`** (`:692`, with the comment "doc 130 spans P4 (renderer half) and P7 (runtime);
   the earlier phase is the conservative [choice]") while roadmap §3 assigns doc 130 §5 to P4 and the whole
   document to P7 (`:83`, `:86`). So 19 `T-RT-*` ids that are P7's (Not started) are counted as P4's
   (Completed). Any automated "phase complete" claim built on this ledger is wrong for P4 by 19 ids, and
   P4's real evidence is the single cited `T-RT-111` plus its golden gate.

**Impact:** this is the mechanism by which F-P2-03 and F-P2-04 stayed invisible through two phase
closeouts. The roadmap gained a machine-checked inversion register for WP edges on 2026-10-13
(`check_dependency_direction()`), and the analogous register for test-id forwards still does not exist.

**Required (not a P6 blocker, but the fix that prevents recurrence):** a test-id disposition register in
`audit_dev.py` mirroring `DISPOSITIONED_INVERSIONS`, fed by a `Phase owner` column that every
test-obligation table carries; a check that **every unwired id in a Completed phase has a disposition**, so
an undispositioned id fails the gate the way a silent inversion now does; and `DOC_PHASE` split for doc 130
by section (P4 = §5's ids, P7 = the rest), or doc 130's ids recorded as P7-owned with P4's exceptions
listed.

---

## 6. What must be completed between P0 and P5 before P6 starts

Ordered by what unblocks the most P6 work soonest. §6.1 is documentation-only and is the actual start gate;
§6.2 is build work that gates specific P6 packages; §6.3 is the do-not-wait list.

### 6.1 Dispositions to land before any P6 WP starts (~1 d, no code)

| # | Item | Owner doc(s) | Finding | Unblocks |
| --- | --- | --- | --- | --- |
| 1 | Define **the reference title** in one register entry (provenance, location, which gates cite it) and **bound "the whole corpus"** in doc 120 §10.3 using the `T-SWF-009` rule | new register entry + `120:207,210`, `130:126,226,258`, roadmap §2.1 | F-P6-02 | P6 §10.1/§10.3; P7 `T-RT-118` and §10.1; P5 gate (b) shares the artifact |
| 2 | Land `T-MOD-030`'s emitter prohibition as an `IMPL-120` requirement + `T-CMP-*` obligation paired with `WP-120-12`'s forbidden-construct lint; name the "reaches the shell" owner in doc 130 | `120` §4/§7/§8, `130:248`, `040:456` | F-P2-04 | `WP-120-08`, `WP-120-12` |
| 3 | Give `IMPL-050-R037`'s grammar **one owning test id**, add a test id to `WP-130-03`, and give doc 030's `T-MOD-602` row a live `Phase owner` | `050` §8, `130:236`, `030:408` | F-P2-03 | `WP-120-08` (navigation emission) |
| 4 | Decide and record the **video disposition**: re-home `WP-110-01`'s header/extent decode (recommended) or split `WP-120-07`; give `IMPL-120-R028` its P6-scoped reading | `110:391`, `120:154-156`, roadmap `:309` | F-P6-01 | `WP-120-07`, `budgets.json` |
| 5 | Restate roadmap §7's P6 row at the authoritative **64 d**; fix §7's 646.5 → §10's 658.5; add or explicitly mark P12/P13 as unsized; extend `verify_docs.py` to cross-check §7 against §10 | roadmap §7, `tools/verify_docs.py` | F-P6-03 | P6 scheduling; roadmap integrity |

### 6.2 Build work that gates specific P6 packages (in dependency order)

| # | Item | Phase / owner | Est | Gates which P6 WP | Why it cannot be skipped |
| --- | --- | --- | --- | --- | --- |
| 6 | **`WP-010-11`** — test writer + property tests + allocation test (`test-support/writer.ts`, `T-SWF-014`/`017`) | **P0** (`010:643`) | 3 d | `WP-120-07` transitively (via `WP-070-01 → -06/-07/-08`) | Only P0 package on P6's transitive path; supplies the §8 `RECT`/`MATRIX`/`CXFORMWITHALPHA` vector rows and the 10⁵ fixed point that back `T-MOD-307`/`T-MOD-308`'s round-trip claims |
| 7 | **`R037` grammar matrix test** on `parseTarget`/`formatTarget` (all six forms) + collapse `disassemble.ts`'s duplicate formatter | **P5** | ≤ 1 d | `WP-120-08` | The emitter navigates with these paths; today the parser has zero direct coverage (F-P2-03) |
| 8 | **P5's lossless inverse format** defined + byte-identity acceptance scoped as its own WP | **P5** | spec edit, then a separately estimated WP | `WP-120-08` (definition only; the WP may run in parallel) | T0/T1 emission is unrecoverable-wrong if the front end is lossy, and no P6 gate detects it (F-P5-06 (a)) |
| 9 | **P6's own asset chain**, sequenced inside P6 before `WP-120-07`: `WP-070-06` → `-07` → `-08` → `-09` (13 d), `WP-080-10`'s KTX2/`.sfa`+mip forward, `WP-080-11` (3 d), `WP-090-12` (2 d) | **P6** (`070:449-452`, `080:401-402`, `090`) | 18 d + the KTX2 half | `WP-120-07`, `WP-120-11` | These are P6 rows in P3-era documents, not P3 leftovers; `T-MOD-306/307/308`, `T-MOD-510` and the audio budget section are all unwired |
| 10 | **Video extent model** per §6.1 item 4 — **discharged as a document disposition**: `WP-110-12` (2 d, `video/extent.ts`, `T-MOD-917`, `Phase owner: P6`) owns it and `WP-120-07`'s `Depends` names it | **P6** (doc 110 v1.4) | 2 d | `WP-120-07` | `IMPL-120-R028` requires video bytes; nothing decodes video tags today (F-P6-01) |

| 11 | ~~**`E-035`**~~ — **discharged 2026-10-13**, and it grew: `E-036` (`With`/`Try` regions, plus the `Try` tiling rule that made every real `Try` malformed), `E-037` (function bodies are not `End`-terminated) and `E-038` (an error-severity region overrun tiered 0) were found while fixing it and are fixed too. Replaced by **`E-039`**: a `Try`'s catch and finally bodies are decoded and then dropped from the IR, so an emitter cannot reconstruct the structure | **P5** (F-P5-07) | done; `E-039` ≤ 1 d | `WP-120-07` (cleared) and `WP-120-08` (`E-039`) | The framing fix is measured: `SF0400` 48 → 0 files, `SF0420` 49 → 0, `SF0404` 5 → 0, errors 60 → 15 and all semantic, functions 93 → 150, clean exits 21 → 59 of 73. `E-039` is **fixed** (§10.3) and so is `E-040`, which the same measurement found (§10.4): a region's bodies now reach the IR *and* their leftover stack reaches the code after them, so nothing structural remains between P6's emitter and a `Try`-bearing title. `E-041` is open and affects where a diagnostic points, not what an emitter reads |
### 6.3 Explicitly **not** required before P6 starts (recorded so P6 is not held hostage)

- **P0:** the allocation counter and its `T-SWF-017` zero-allocation assertion (`IMPL-010-R043`–`R045` —
  doc 120 never mentions allocation; the consumer is doc 130's budgets at P4/P7), the 10⁵-case
  `T-SWF-014` *as a P0 exit item* (its P6-relevant part is `WP-010-11`, item 6), `T-SWF-015/016` contract
  strengthening, the `T-SWF-009` fixture inventory, `WP-010-12`'s reader fuzzer (P11 hosts it via
  `WP-140-07`), the diagnostic-literal lint rule, and `E-033`'s disputed `UI32` decimal (provisionally
  resolved bytes-authoritative per `E-025`; P6 emits TS/JSON, not raw `UI32`).
- **P1:** all four deferrals — standalone `swffuzz` CLI / crasher-corpus directory, streaming LZMA, the
  512 MiB absolute-RSS test (doc 140), and the pinned synchronous-zlib partial-yield deviation
  (`P1-AUDIT-RESOLUTION.md` §4).
- **P2:** nothing beyond items 2 and 3, which are documentation dispositions of P2's own two forwards.
- **P3:** nothing. All seven uncited ids carry live later-phase owners, and the three that are P6's
  (`T-MOD-306/307/308`) are already counted in §6.2 item 9.
- **P4:** gradient/bitmap fills, full stencil masks, filters, WebGPU — later-phase scope by design
  (roadmap `:63`), and doc 130's 19 unwired `T-RT-*` ids are **P7's**, not P4's (F-REG-01).
- **P5:** the open-corpus + two-reviewer gate (bounds P6's *claims*, and shares its artifact with
  F-P6-02) and `FE-030`'s oracle (P7-gating under Route A). Also all Route A runtime-execution forwards
  (`T-AVM1-008/009/012/025/027`, `FE-024/025/027/028`).
- **P11:** the three-engine browser matrix (extends the P0-owned lane, does not gate P6), the 24-hour fuzz
  history, and the security suite.

### 6.4 Formal P6 start gate

Applying roadmap `:638` ("a package may start when every `Depends` id is *reviewed*, not necessarily
complete"):

- **`WP-120-01…-06` (18 d) — may start once §6.1 items 1–5 are landed.** All six have every supplier
  delivered and test-cited (§4.2): `WP-020-10`, `WP-050-08`, `WP-050-09`, `WP-050-10`, `WP-030-09`. Items
  1–5 are required first not because these packages consume them, but because items 2 and 3 add
  requirements to `WP-120-08`, which `-05` feeds, and because item 5 changes what "P6" is scheduled to be.
- **`WP-120-07…-14` (28 d) — additionally require §6.2 items 6–11.** `WP-120-07` cannot be built at all
  until its P6-owned suppliers (`WP-070-07`, `WP-080-10`'s KTX2 half) and the video disposition exist;
  `WP-120-08` should not emit function bodies until items 7, 8 **and 11** are in place — item 11's framing
  half landed 2026-10-13, so real function bodies are now real, and its region half landed with it —
  `E-039` is fixed, so an emitter reading a `Try` region receives its catch and finally code; `WP-120-13`/`-14` and §10
  cannot be exited until item 1 defines their subject.
- **P5's phase status is not the gate.** P5 may remain In progress throughout P6's pipeline half, provided
  item 8's definition lands before `WP-120-08`. P0 may remain In progress throughout P6, provided item 6
  lands before P6's asset chain claims round-trip evidence.

---

## 7. Non-blocking specification questions

1. Does `WP-120-07`'s estimate of 4 d cover only `passes/assets.ts`, or was it written assuming the 18 d of
   P6-owned asset work in docs 070/080/090 was P3's? (Determines whether §6.2 item 9 is 18 d or 22 d of
   P6 scope.)
2. `T-MOD-509`'s `Phase owner` note lists two later phases for one id ("P3 build determinism; P4/P9 visual
   fidelity"). Which phase closes the visual-fidelity half — P4's golden gate or P9's tolerance work?
3. `T-MOD-510` is cited at P3 for its decode half while its note assigns the AVM1-dependent reachability
   half to P6 (`WP-080-11`). Should a split id be counted as closed at P3, or should the ledger track
   per-half status? (F-REG-01's register needs an answer to represent this at all.)
4. Is `IMPL-120-R028`'s "the runtime's estimated first-frame work" an estimate P6 computes statically, or a
   number P7's profiler supplies? If the latter, R028 has the same shape as the video-bytes problem
   (F-P6-01) and needs the same P6-scoped reading.
5. Should `E-033`'s provisional bytes-authoritative resolution be promoted to a final errata decision now
   that the browser lane pins the vector fingerprint in two engines, or does it wait for an Adobe source
   citation?
6. Roadmap §7's per-phase ranges are stale for P0, P1, P2, P6, P10 and P11 (F-P6-03). Is §7 still
   normative for planning, or should it be replaced by a generated table derived from the `Phase owner`
   cells — the way `STATUS.md` is generated?

---

## 8. Bottleneck diagnosis

Five of the seven findings are one failure mode: **dispositions recorded in prose instead of in the
record.**

A phase closes by *naming* what it forwards. The naming happens in an audit document. The audit document is
archived. The receiving phase's document never gains the requirement, the work package, or the test id — so
the obligation is live nowhere, and the next phase's implementer, reading only the roadmap and their own
document, cannot see it. `T-MOD-602` travelled P2 → "P5" → nowhere (§5, F-P2-03). `T-MOD-030` travelled
P2 → "runtime/emitter" → nowhere (F-P2-04). `IMPL-120-R028`'s video bytes were registered as an accepted
forward edge but the *consequence* was never written down (F-P6-01). "The reference title" was named in
four places and defined in none (F-P6-02).

The repository already solved this problem once, for work-package edges: on 2026-10-13 the roadmap gained a
machine-checked inversion register (`check_dependency_direction()` + `DISPOSITIONED_INVERSIONS`), and its
first live run found a real defect (`WP-080-10 → WP-070-07`, corrected at source as `IMPL-080` v1.3). The
same treatment has not been applied to the three other kinds of cross-phase promise:

| Promise type | Register today | Machine-checked? | Failure found by this audit |
| --- | --- | --- | --- |
| WP → WP dependency inversion | roadmap §4.4 + `DISPOSITIONED_INVERSIONS` | **Yes** (since 2026-10-13) | — (the check is what found `WP-080-10`) |
| Test id → later phase forward | only docs 080/090's `Phase owner` column; else archived prose | **No** | F-P2-03, F-P2-04, F-REG-01 |
| Done criterion → named artifact | none | **No** | F-P6-02 ("reference title", "whole corpus") |
| Phase scope → effort estimate | roadmap §7 prose | **No** (§10 index is checked, §7 is not) | F-P6-03 (64 d vs 30–45 d; 646.5 vs 658.5) |

The cheapest structural fix, in order of leverage: (1) a `Phase owner` column on **every** test-obligation
table plus a gate that fails when an unwired id in a Completed phase has no disposition — this converts
F-P2-03/F-P2-04 from archaeology into a red build; (2) a rule that a done criterion may not name an
artifact with no register entry; (3) generating roadmap §7 from the `Phase owner` cells instead of
maintaining it by hand.

The secondary observation is about **document boundaries, not phase boundaries**: 18 d of P6 lives in three
P3-era documents, and doc 130 belongs to two phases at once. Both are legitimate design (P3's media layer
is where the asset work belongs; P4 and P7 share a runtime document), but both defeat any reading that
equates "phase" with "document". The roadmap's §3 phase → document map is the only place that says so, and
it says it in one line per phase.

---

## 9. Recommended sequence

1. Land §6.1 items 1–5 as one documentation pass (each is a spec/register edit; each has a named finding).
   Re-run `verify_docs.py` and `audit:dev`; both must stay green, and item 5 adds a check.
2. Build §6.2 item 6 (`WP-010-11`, P0) and item 7 (`R037` grammar test, P5) — small, independent, and they
   retire the only P0/P5 items on P6's path.
3. Define P5's inverse format (item 8, spec only) and scope its WP separately; do **not** implement it
   inside P6.
4. Start P6's pipeline half (`WP-120-01…-06`).
5. Sequence P6's asset chain (item 9) and the video extent model (item 10) before `WP-120-07`.
6. Begin `WP-120-08` only after items 2, 3 and 7 are in place.
7. Close F-REG-01's ledger work in parallel — it is not a P6 blocker, but it is what keeps the next phase
   closeout from losing another forward.

---

**Sequence update, later the same day.** Two things moved to the front. `E-035` (§6.2 item 11) became the
first P5 build item, ahead of the serializer: a correctness defect on the only real-content evidence the
project has, gating `WP-120-07`/`-08`, and the thing that made the C4-c report signable. **It is now
done** — and it took `E-036`, `E-037` and `E-038` with it. `E-039` (catch/finally bodies dropped from
the IR) was the next P5 build item and is **done as well**, so the serializer is now at the front of the
queue: the last defect between the IR and the losslessness claim the serializer has to prove is fixed.
Of the two that measurement left behind, `E-040` is **fixed** too (§10.4) — and the expectation recorded
here that it would only change tier counts was wrong: it had been dropping whole statement sequences, so
fixing it roughly quintupled the IR for eight corpus files — while `E-041` really does change only where a
diagnostic points. And the
open-corpus lane is built (`WP-050-19`: `tools/open-corpus.mjs`, `fixtures/open/manifest.json`,
`pnpm corpus:fetch|verify|report`), so the remaining corpus work is a reviewer, not a mechanism — though
register open item 6 records that the lane is not yet a CI gate, which is how an `E-034`-class regression
could return unnoticed. P0's sequence is unchanged.

## 10. Gate re-run record (2026-10-13, this audit)

| Gate | Command | Result |
| --- | --- | --- |
| Docs | `python3 tools/verify_docs.py` | `ISSUES: 0` |
| Build | `corepack pnpm build` | OK (all packages + apps) |
| Typecheck | `corepack pnpm typecheck` | OK |
| Unit/integration | `corepack pnpm test` | **63 files / 750 tests passed** (39.8 s) |
| Browser lane | `corepack pnpm test:browser` | **31 tests passed**, HeadlessChrome 153.0.8010.0, same pinned fingerprint as the Node lane |
| Lint | `corepack pnpm lint` | OK (`eslint .` + Prettier clean) |
| Audit tooling self-test | `corepack pnpm test:audit` | **88 tests OK** |
| Development audit | `corepack pnpm audit:dev` | `findings=52 known=57 new=0 fixed=5`; `PROBE shape4 flags ok=5/5`; `DUMP keys=9 frames=1 bytes=3931` |

Note on reproducibility: `audit:dev`'s `PROBE` and `DUMP` checks are skipped when `packages/swf/dist` and
`apps/decompiler/dist` are absent, which changes the summary to `findings=51 … fixed=6`. The figures above
are from a full build. The sandbox environment also removes `node_modules` and `~/.cache/*` between
sessions; recovery is `node tools/browser-lane.mjs install` (3.2 s) + `corepack pnpm install
--frozen-lockfile` (3.1 s), both run before this table was produced.

No gate was relaxed, skipped, or re-baselined for this audit, and no source file was modified by it.

### 10.1 Gate re-run after the `E-034` fix and the C4-c lane (2026-10-13, later)

§10's table was produced before any source file had been modified. This one is after: `E-034`'s fix
touches `packages/avm1/src/frontend/analyze.ts` and `packages/swf/src/test-support/writer.ts`, and the
new lane adds `tools/open-corpus.mjs`, `fixtures/open/manifest.json`,
`packages/avm1/test/block-refs.test.ts` and `audits/P5-C4-CORPUS-EXTERNAL.json`.

| Gate | Command | Result |
| --- | --- | --- |
| Docs | `python3 tools/verify_docs.py` | `ISSUES: 0` |
| Status | `python3 tools/gen_status.py` | totals **214 / 666.5 / 70 / 288 / 255** (was 213 / 665.5 / 70 / 286 / 255: `WP-050-19`, +1 d, `T-AVM1-FE-036`/`-037`) |
| Typecheck | `corepack pnpm typecheck` | OK |
| Unit/integration | `corepack pnpm test` | **64 files / 754 tests passed** (was 63 / 750; +`block-refs.test.ts`) |
| Browser lane | `corepack pnpm test:browser` | **31 tests passed** |
| Lint | `corepack pnpm lint` | OK (`eslint .` + Prettier clean) |
| Audit tooling self-test | `corepack pnpm test:audit` | **100 tests OK** |
| Development audit | `corepack pnpm audit:dev` | `findings=52 known=57 new=0 fixed=5`; `PROBE shape4 flags ok=5/5`; `DUMP keys=9 frames=1 bytes=3931` |
| Restart probe | `corepack pnpm test:avm1-restart` | OK; artifact regenerated (13 of 17 keys byte-identical, three function ids −4) |
| Open-corpus lane | `node tools/open-corpus.mjs verify` / `report` | 73 of 73 hash-verified; report written, no internal error, no hash mismatch |

No gate was relaxed, skipped or re-baselined. `T-AVM1-FE-037` is deliberately **unwired** and does not
trip the disposition ledger, because P5 is In progress rather than Completed — the ledger only fails an
unwired id whose owning phase claims to be done.

### 10.2 Gate re-run after the `E-035`/`E-036`/`E-037`/`E-038` fixes (2026-10-13, later still)

Source changed in `packages/avm1/src/frontend/` — new `extents.ts`, plus `record.ts`, `functions.ts`,
`operands.ts`, `analyze.ts` and the package barrel — and in `packages/avm1/test/harness.ts` (all four
region builders now place their bytes past `Length`), `tools/avm1-restart-probe.mjs` (same), plus a new
`packages/avm1/test/region-framing.test.ts`. Documents: doc 050 v1.13 (new region rule; `End`-terminator,
block-range, `With` and `Try` tiling rules corrected; three obligations added and one filed open), errata
v2.9 (`E-035`–`E-038` fixed, `E-039` opened), corpus register v1.2, roadmap Draft 1.25. Both evidence
artifacts were regenerated from the fixed code.

| Gate | Command | Result |
| --- | --- | --- |
| Docs | `python3 tools/verify_docs.py` | `ISSUES: 0` |
| Status | `python3 tools/gen_status.py` | totals **214 / 666.5 / 70 / 291 / 255** (obligations 288 → 291: `T-AVM1-FE-038`/`039`/`040`) |
| Typecheck | `corepack pnpm typecheck` | OK |
| Unit/integration | `corepack pnpm test` | **65 files / 770 tests passed** (was 64 / 754; +`region-framing.test.ts`, 16 tests) |
| Browser lane | `corepack pnpm test:browser` | **31 tests passed** (engine cache reinstalled first: `node tools/browser-lane.mjs install`) |
| Lint | `corepack pnpm lint` | OK (`eslint .` + Prettier clean) |
| Audit tooling self-test | `corepack pnpm test:audit` | **100 tests OK** |
| Development audit | `corepack pnpm audit:dev` | `findings=52 known=57 new=0 fixed=5`; **586 rules** (+1); **451 test ids** (231 cited, 2 source-only, 218 unwired); `PROBE shape4 flags ok=5/5`; `DUMP keys=9 frames=1 bytes=3931` |
| Restart probe | `corepack pnpm test:avm1-restart` | OK; artifact regenerated — **15 of 17 keys byte-identical**, only `inputSha256` and `normalizedCliReportSha256` moved, `directReportSha256` unchanged |
| Open-corpus lane | `node tools/open-corpus.mjs verify` / `report` | 73 of 73 hash-verified; report regenerated: 119 blocks, **150** functions, **T0=123 T1=121 T2=25**, errors **15** (all semantic), clean exits **59 of 73**, `SF0400`/`SF0404`/`SF0420` all **0 files** |

No gate was relaxed, skipped or re-baselined, and no expectation was re-pointed at buggy behaviour: the
two fixtures that had encoded the wrong framing (the AVM1 harness and the restart probe) were moved to the
shape real content uses, and the four tests that had asserted the old diagnostics were re-stated against
the corrected rules — `tier.test.ts`'s malformed-`Try` case now pins the *other* `SF0404` arm (a `Length`
that over-covers), and the mutation gate's framing invariant walks `regionEnd` instead of `end`.
`T-AVM1-FE-040` was deliberately **unwired** for `E-039`, on the same reasoning as `T-AVM1-FE-037` above; it was wired later the same day, when `E-039` was fixed (§10.3).

### 10.3 Gate re-run after the `E-039` fix (2026-10-13, last of the day)

Source changed in one file, `packages/avm1/src/frontend/stack.ts`: the region-body entry map is keyed by
scope rather than by region record, a body-entry frame is left unsettled until the depth it depends on
exists, and a `finally` body takes the join of the try and catch bodies' exit depths. Tests: a new
`packages/avm1/test/try-bodies.test.ts` (six cases), `region-framing.test.ts`'s `Try` case re-stated, and
`disassembly.test.ts`'s golden corrected — it had recorded the dropped catch and finally instructions and
every region body at `stack -1→-1` as though that were conformance. Documents: doc 050 v1.14 (new
region-entry rule, `T-AVM1-FE-040` wired, §13 criterion 3 refreshed to the regenerated report), errata
v2.10 (`E-039` fixed, `E-040` and `E-041` filed), corpus register v1.3, roadmap Draft 1.26. Both evidence
artifacts were regenerated from the fixed code.

| Gate | Command | Result |
| --- | --- | --- |
| Docs | `python3 tools/verify_docs.py` | `ISSUES: 0` |
| Status | `python3 tools/gen_status.py` | totals **214 / 666.5 / 70 / 291 / 255** (unchanged: no obligation or estimate moved) |
| Typecheck | `corepack pnpm exec tsc -p packages/avm1 --noEmit` | OK |
| Unit/integration | `corepack pnpm test` | **66 files / 776 tests passed** (was 65 / 770; +`try-bodies.test.ts`, 6 tests) |
| Browser lane | `corepack pnpm test:browser` | **31 tests passed** (engine cache reinstalled first: `node tools/browser-lane.mjs install`) |
| Lint | `corepack pnpm lint` | OK (`eslint .` + Prettier clean) |
| Audit tooling self-test | `corepack pnpm test:audit` | **100 tests OK** |
| Development audit | `corepack pnpm audit:dev` | `findings=52 known=57 new=0 fixed=5`; **587 rules** (+1); **451 test ids** (232 cited, 2 source-only, 217 unwired — `T-AVM1-FE-040` moved from unwired to cited) |
| Restart probe | `corepack pnpm test:avm1-restart` | OK; `directReportsIdentical: true`, `cliReportsIdentical: true` |
| Open-corpus lane | `node tools/open-corpus.mjs verify` / `report` | 73 of 73 hash-verified; report regenerated: **T0=124 T1=120 T2=25**, errors **15** (unchanged), `SF0406` identical to the pre-fix build file by file (13 items, 22 with repeats), integrity lists empty |
| Negative control | `git stash push packages/avm1/src/frontend/stack.ts` then re-run | **7 failures in 3 files**: all six `T-AVM1-FE-040` cases except the register-flag one, `T-AVM1-FE-032`'s golden, `T-AVM1-FE-038`'s `Try` case |

No gate was relaxed, skipped or re-baselined. Two expectations were re-pointed, both at behaviour the fix
corrected rather than at the fix's convenience: the disassembly golden, which had encoded the defect, and
`region-framing.test.ts`'s flat-list assertion, which had assumed the catch and finally blocks were empty.
An intermediate version of the fix — seeding the finally body at the `Try` entry depth — was measured
against the corpus and **rejected**: it added three `SF0406` errors on real content
(`try_catch_finally.swf` 2 → 4, `try_finally_simple.swf` 1 → 2) before the join rule removed them again.

### 10.4 Gate re-run after the `E-040` fix (2026-10-13)

Source changed in two files. `packages/avm1/src/frontend/control-flow.ts` gives regions real CFG edges: a
block holding a `Try` or `With` record ends at that record and falls into the region body's first record,
and a body's fallthrough goes to the region's `finally` body when it has one and otherwise to the record
after the region op, so the code after a region is a join over the bodies' exits and reuses `E-039`'s join
machinery rather than re-simulating anything. `packages/avm1/src/frontend/stack.ts` relaxes the settle
step's treatment of a predecessor that never settled: while the fixpoint can still move, such a
predecessor blocks the join as before, but once a pass makes no progress it is ignored, and a block whose
predecessors are *all* dead stays unsettled. That second half fixes a defect older than regions and
independent of them — an unreachable tail anywhere (code after a `Return` or `Throw`) used to stall the
join downstream of it forever, and an unsettled block contributes no ops, so the code was silently absent
from the IR.

Tests: a new `packages/avm1/test/region-flow.test.ts` (five cases, `T-AVM1-FE-041`). Documents: doc 050
v1.15 (a third region rule, `T-AVM1-FE-041` wired, §13 criterion 3 refreshed), errata v2.11 (`E-040`
fixed, `E-041` still open), corpus register v1.4, roadmap Draft 1.27. The report was regenerated from the
fixed code.

| Gate | Command | Result |
| --- | --- | --- |
| Docs | `python3 tools/verify_docs.py` | `ISSUES: 0` |
| Status | `python3 tools/gen_status.py` | totals **214 / 666.5 / 70 / 292 / 255** (obligations 291 → 292 for `T-AVM1-FE-041`; estimates and cross-phase edges unchanged) |
| Typecheck | `corepack pnpm exec tsc -p packages/avm1 --noEmit` | OK |
| Unit/integration | `corepack pnpm test` | **67 files / 781 tests passed** (was 66 / 776; +`region-flow.test.ts`, 5 tests) |
| Browser lane | `corepack pnpm test:browser` | **31 tests passed** (engine cache reinstalled first: `node tools/browser-lane.mjs install`) |
| Lint | `corepack pnpm lint` | OK (`eslint .` + Prettier clean; the regenerated report and the new test file were reformatted first) |
| Audit tooling self-test | `corepack pnpm test:audit` | **100 tests OK** |
| Development audit | `corepack pnpm audit:dev` | `findings=52 known=57 new=0 fixed=5`; **588 rules** (+1); **452 test ids** (233 cited, 2 source-only, 217 unwired — `T-AVM1-FE-041` was wired on arrival) |
| Restart probe | `corepack pnpm test:avm1-restart` | OK; `directReportsIdentical: true`, `cliReportsIdentical: true` |
| Open-corpus lane | `node tools/open-corpus.mjs verify` / `report` | 73 of 73 hash-verified; report regenerated: 272 entries, **T0=119 T1=130 T2=23**, errors **14**, `SF0406` 13 items → **12** (22 → 20 with repeats), functions **153**, clean exits **60 of 73**, `unknownOpcodeReasons: 0`, framing codes all 0 files, integrity lists empty |
| Negative control | `git stash push packages/avm1/src/frontend/control-flow.ts` then re-run | **6 failures in 3 files**: four of the five `T-AVM1-FE-041` cases, `T-AVM1-FE-032`'s golden, `T-AVM1-FE-008`'s dynamic-`With` fixture |

No gate was relaxed, skipped or re-baselined. Two committed expectations were re-pointed, both at
behaviour the fix corrected: `disassembly.test.ts`'s second golden, which had recorded a region op flowing
straight past its own bodies (`block 0 @ 0..46 → end` for a 46-byte block containing a `With` and a `Try`),
now records the seven-block region CFG; and `tier.test.ts`'s dynamic-`With` fixture, which now also
expects `dynamic-stack` because `Enumerate` makes the body's entry depth unknown and the continuation is a
real join rather than a copy of the enclosing depth.

**Why the tier counts moved the way they did.** T2 fell by two and errors by one — the false residuals
this entry was filed for: `try_catch_finally.swf` went T2 2 → **0** and exit 1 → **0**, and
`try_finally_simple.swf` T2 1 → **0** and exit 1 → **0**. T0 fell by five and T1 rose by ten, and that is
recovered code, not lost fidelity: `inspect --actions` output grew `string_coercion` 119 → **654** lines,
`swf4_actions_coercion_order` 77 → **444**, `string_paths_other` 107 → **391**, `delete2` 126 → **396**,
`enumerate` 35 → **261**, `watch` 396 → **588**, `watch_virtual_property` 159 → **200**,
`prototype_enumerate` 46 → **56**. Each of those files gained `dynamic-stack`/`dynamic-args`/
`call-dynamic-target` reasons on statements that were previously dropped outright, and each statement is
genuinely dynamic (`Enumerate` and `With` results are not statically knowable) — a T1 verdict is the
correct answer for them, and the pre-fix T0 was an artefact of analysing nothing. One file moved the other
way for the same reason: `try_catch_stack.swf` went T0 → **T2**, because its continuation had been absent
from the IR (63 → 120 disassembly lines) and the content really does pop past the end of the stack. That
last claim was checked against the corpus's own oracle rather than inferred: `try_catch_stack`'s `test.as`
pushes "The stack was not preserved!", enters a `try` that pushes "The stack was preserved!" and throws,
and its expected `output.txt` traces "The stack was **not** preserved!" from inside the catch — so the
player discards a try body's pushes on a throw, confirming `E-039`'s truncation rule — and the same source
then runs `Trace; Pop; Pop` after the catch with one value on the stack, which the player tolerates
because AVM1 does not check the stack and this front end reports as `SF0406` under doc 050's
mismatch-is-reported-never-fixed rule.

**Rejected alternative.** Marking every frame after a region op as depth-unknown — three lines, no CFG
change. It is honest and would have removed the false `SF0406`s, but it ends all stack verification after
the first region in a frame, which most timeline scripts in this corpus have, and it leaves the
dropped-IR half of the defect untouched.

---

## 11. Postscript — the conditional go was exercised: P6 started (2026-10-14)

§6's conclusion was that P6 could start on `WP-120-01…-06` once §6.1's five document dispositions landed,
and that `WP-120-07…-14` additionally needed §6.2's items 6–11. All five §6.1 dispositions landed on
2026-10-13 (roadmap §4.6 rows A–F record them; rows A and F stay open as *implementation* work, which is
what §6.1 said they were not). P6 then started, and `WP-120-01` is delivered: `@swf-forge/compile`
(`packages/compile/`) holds the pipeline runner — the stage spine in the mandated order regardless of
registration order, the five post-model passes of doc 120 §3 on their own spine between `analyze` and
`plan`, a run context carrying the resolved config, the diagnostic sink and a cancellation token threaded
through every stage and loop, the cache seam the design spec's key formula requires, and `--dry-run`
stopping after `plan` without writing a file — plus stage adapters for `read`, `model` and `analyze` over
the delivered suppliers, the AVM2 refusal, and `SF0500` so an unimplemented stage is reported rather than
skipped silently. 24 tests; the whole battery re-ran green (§11.1).

**§4.2's supplier table held under consumption.** This is the first time those suppliers were consumed
rather than merely cited, which is a stronger test than the table itself: `read` needed nothing beyond
`WP-020-10`'s `SwfFile`, `model` nothing beyond `WP-030-09`'s `buildMovieModel`, and `analyze` nothing
beyond P5's `analyzeMovie` plus `extractRequirements`. No adapter reached for anything §4.2 marked
undelivered, and the three P6-owned rows §4.2 flagged (`WP-070-07`, `WP-080-10`'s KTX2 half, `WP-110-12`)
are all downstream of `decode`, which is exactly where §6.2 item 9 said they would gate.

**Two facts the table could not show, found only by consuming the suppliers.**

1. The delivered APIs do not have the design spec's stage seams. `WP-020-10`'s facade decompresses,
   validates, indexes the tag stream and collects the dictionary in one call, so S0 and S1 are one stage;
   `analyzeMovie` produces the IR *and* the tier verdicts in one pass, so S5 and S6 are one stage. The
   pipeline is therefore seven stages, not the design spec's eleven, and doc 120 v1.4 §2 now states the
   mapping instead of leaving a reader to discover it. This is not a defect — re-parsing or re-analysing to
   match a diagram would be worse — but it is a divergence between the two documents that only an
   implementer meets, so it is recorded where the next one will read it.
2. `analyze` cannot be unit-tested against any committed fixture, because none of the 26 carries an action
   block (F-P5-07's measurement). The runner's tests build a synthetic `DoAction` with
   `@swf-forge/swf/test-support`. That is the same gap that made the C4-c corpus necessary, now visible from
   the consumer side: P6's emitter will need action-bearing inputs for its own tests, and the only
   licensed supply is the fetched corpus, which is not committed.

**Two new findings, both from reading P6's governing documents.** `E-042`: the design spec's acceptance
table (§13) and doc 120's test table (§8) gave six `T-CMP-*` ids different meanings — the machine ledger was
never ambiguous (`tools/audit_dev.py` attributes the band to doc 120 alone, because the design spec puts an
id in a table cell rather than an id column) but a human starting the phase would have wired the wrong
tests. Applied: the design spec no longer mints impl test ids, each of its criteria names what carries it,
and the two that nothing carries are marked — the `requirement`/`risk` half is blocked by `E-043`, and the
build-time criterion (≤ 90 s for a 5 MiB SWF, warm cache) has **no owner in any impl document**, with P11's
budget lane as the recommended home. `E-043`: the implemented diagnostic model has three severities and no
`requirement` field, while the design spec specifies four severities and one, so `--fail-on=risk`,
`risk.json` and the design spec's CI default are unimplementable as things stand. P6 rejects the config
value loudly rather than accepting a switch nothing can honour; the model itself is `IMPL-010` §7's, so the
extension is dispositioned to P0 as its own work package — it touches every package that emits.

Neither finding blocks `WP-120-02…-06`. Both block work further along: `E-043` gates `WP-120-11`'s
`porting-notes.json` and `WP-120-13`'s `--fail-on` handling, and the unowned build-time criterion gates
nothing but should not stay unowned.

### 11.1 Gate re-run after `WP-120-01` (2026-10-14)

| Gate | Command | Result |
| --- | --- | --- |
| Docs | `python3 tools/verify_docs.py` | `ISSUES: 0` |
| Status | `python3 tools/gen_status.py` | totals **214 / 666.5 / 70 / 292 / 256** — no WP, estimate or obligation moved; the last figure is the count of codes documented in impl-doc tables, 255 → 256 for doc 120's new `SF0500` row, while the runtime registry (`audit:dev`) holds 189 |
| Typecheck | `corepack pnpm exec tsc -b` | OK, whole workspace including the new project reference |
| Unit/integration | `corepack pnpm test` | **68 files / 804 tests passed** (was 67 / 781; +`packages/compile/test/pipeline.test.ts`, 24 tests) |
| Lint | `corepack pnpm lint` | OK (`eslint .` + Prettier clean) |
| Audit tooling self-test | `corepack pnpm test:audit` | **100 tests OK** |
| Development audit | `corepack pnpm audit:dev` | `findings=52 known=57 new=0 fixed=5`; **189 registry codes** (+`SF0500`, sink-emitted); **588 rules**; **452 test ids** (233 cited, 2 source-only, 217 unwired — P6's nine are still unwired, correctly, since `WP-120-01` names no obligation id) |
| Roadmap integrity | `grep -c 'IMPL-[0-9][0-9][0-9]-R[0-9]' docs/impl/000-roadmap.md` | **0** foreign rule ids |
| Design-spec pin | `grep -c 'T-CMP-0' docs/specs/foundation/020-compiler-pipeline.md` | **0** — `E-042`'s regression pin |

Documents touched: doc 120 v1.4 (stage-spine mapping, §2.1 pipeline diagnostics, `SF0500`), CMP Draft 1.2
(§13 and `CMP-D02` stop minting ids), errata v2.12 (`E-042`, `E-043`), roadmap Draft 1.28 (P6 **In
progress**, the P6–P10 bullet split), and the `IMPL-010` §7 registry (`SF0500`, the first code in doc 120's
compile range).

### 11.2 `WP-120-02` — the stage cache, and a measurement that could not have failed

`WP-120-02` landed the same day: `packages/compile/src/cache.ts` (the content-keyed store), `codec.ts`
(the structural serialisation) and the runner's cache path, with 14 tests in `packages/compile/test/cache.test.ts`
wiring **`T-CMP-005`** — cold versus warm builds produce identical outputs, compared as *bytes* through a
consumer stage that projects the analysis into a file the way `WP-120-11` will. `analyze` became the first
cacheable real stage (the whole `MovieAnalysis` is data: nested IR plus three `ReadonlyMap`s, and no live
objects), and `read`/`model` correctly stay uncached because their outputs *are* live objects.

**The finding worth keeping is how the equivalence proof nearly went wrong.** I measured the cache over all
73 licensed corpus movies, comparing the cold and warm analyses after mapping both through the codec under
test. It reported zero mismatches. It also reported zero mismatches with a deliberately lossy codec — while
the stored payloads were measurably 11.6 KB smaller, because every `Map` entry had been dropped. Both sides
lost the same way, so the comparison was blind to the very defect it was meant to catch: `E-034`'s
"generator and consumer self-consistent and both wrong", reproduced in my own instrument rather than in the
product. Re-measuring against a projection that does not go through the codec gives the answer the control
requires:

| Codec | warm ≠ cold (73 movies) | movies carrying `Map` entries | `--verify-cache` drift |
| --- | --- | --- | --- |
| honest | **0** | 49 | 0 |
| lossy (every `Map` entry dropped) | **49** | 49 | **0** |

49 mismatches on exactly the 49 movies that have Map entries is the shape a working detector has. The
third column is the other half of the lesson: `--verify-cache` reported no drift with a lossy codec, because
it compares the *serialised* recomputation with the stored payload and cannot see a format that is
consistently lossy. R002's verify mode therefore detects a stale or tampered entry; only output equivalence
detects a lossy cache format. Both mechanisms are specified in doc 120 §2.2 as a result, and the test file
carries the same note where the next reader will meet the temptation.

Corpus-scale side effects, recorded because they are the numbers a budget conversation will want: 73 entries
for 73 movies (the store does not grow on repeat builds), **10 568 018 bytes** total — ≈145 KB of cached IR
JSON per movie — with 119 action blocks, 153 functions and 164 `Map` entries round-tripped. The
determinism rule `CMP-R040` (a hit must not change output bytes) is what the byte comparison pins, and it is
also why the codec sorts every object key rather than trusting insertion order.

| Gate | Result after `WP-120-02` |
| --- | --- |
| Docs / status | `verify_docs` **ISSUES 0**; `gen_status` **214 / 666.5 / 70 / 292 / 257** (+`SF0503` documented in doc 120 §2.1) |
| Tests | `corepack pnpm test` **69 files / 819 tests** (was 68 / 805); `packages/compile` 38 tests across two files |
| Typecheck | `pnpm typecheck` clean, incl. the new `packages/compile/tsconfig.test.json` (added to the script; the convention every other package has) |
| Development audit | `findings=52 known=57 new=0 fixed=5`; **190 registry codes**, **175 sink-emitted** (`SF0503` counts as emitted, not unmapped); 588 rules; **452 ids — 234 cited / 216 unwired** |
| Audit tooling self-test | `test:audit` **100 OK** |
| Unaffected lanes | `corpus:verify` 73/73 · `test:avm1-restart` both-identical · `test:browser` 31 · `lint` clean |
| Negative control | lossy codec ⇒ 5 test failures + 49 corpus mismatches; honest ⇒ 0 and 0 |

Also corrected in passing, from the same work: `RELEVANT_CONFIG_KEYS.analyze` was over-declared in
`WP-120-01` as `['vm.residual','vm.allow']`, but `analyzeMovie` reads neither — the residual *policy* is
consumed by the tier-finalise pass and the emitter. It is now `[]`, with the option that does affect the
stage (`legacyEncoding`) folded into that stage's input hash instead, and the test that pinned the old
behaviour re-pointed at `emit`, which does read it. `.gitignore` gained `.forge/`, which `CMP` §12 requires
to be ignored and the repository had not been ignoring.

### 11.3 `WP-120-05` + `WP-120-06` — the first passes on the pass spine, and a P5 gap they proved

`packages/compile/src/passes/names.ts` (name assignment) and `passes/frames.ts` (frame-script grouping and
hoisting) landed together, as `namesPass()` and `framesPass()` on the runner's pass spine — the first two
objects ever registered there, which is also the first end-to-end exercise of `WP-120-01`'s ordering rule
(`IMPL-120-R013`: passes run after `tier-finalise`, `shake` and `dead-code`, and the three unregistered ones
are reported `unregistered` rather than skipped). 28 tests in `names.test.ts`, 18 in `frames.test.ts`; the
package is at 84 tests across four files. Doc 120 v1.6 carries the two new rules (`R033`, `R034`), the five
decisions in the new §3.1, and the two new obligations (`T-CMP-010`, `T-CMP-011`).

**Writing the naming pass turned a stylistic reading into a measured P5 defect (`E-044`).** `AVM1-R036`
step (1) says a function's name comes from the dictionary's export map, and `IMPL-050-R062` requires the
front-end pass to run over "the IR plus the dictionary's export map". It does not: `recoverNames` ends with
`void exportMap;` under a comment asserting the map "is kept in the result for the report" — it is not kept,
and there is no field to keep it in. Measured over all 73 licensed titles: 149 recovered function names,
**0** of 20 exported character names among them; 96 of the 149 (64 %) are synthetics of the form
`avm1_fn_<hex offset>_<base36>`, so two thirds of the names in real output change when an unrelated tag
earlier in the file changes length; and `detectClasses` — the only thing that populates
`MovieAnalysis.names.classes` — has no caller outside its own test, so `IMPL-050-R063`'s "MUST … be recorded
in the report" reports zero by construction, in every movie. P6 does not patch P5's pass; it builds its own
closed table and consults the export name at its own seam (`CMP-D-CMP-N1`), so the fix stays `WP-050-10`/
`WP-050-11` work. `movie.test.ts:190` *pins* the offset-bearing form, which is why the P5 fix has to move
that pin in the same commit.

**Three traps worth carrying forward.**

- *A permutation test can be vacuous.* The first version of `T-CMP-010` shuffled the definition tags inside
  one contiguous prefix, which leaves the prefix's byte length invariant — every downstream absolute offset is
  identical, so an offset-sensitive implementation passes for the wrong reason. The test now deals the tags
  into slots **interleaved between** the control tags and asserts as a guard that the top-level `DoAction`
  offsets take more than three distinct tuples. If a stability claim is measured by shuffling, the shuffle has
  to be shown to move something.
- *Never assume another module's field names in a generic walk.* A `canonicalForm` that rebases "offset-ish"
  keys was written against `control-flow.ts`'s `TerminatorSpec` (`targetOffset`, `nextOffset`), but the IR
  terminator is `{kind:'jump', target}`, `{kind:'fallthrough', next}` and `{kind:'branch', ifTrue, ifFalse}`.
  An unknown-key walk does not error: it silently skips, and produced self-consistent wrong results — two
  blocks differing *only* in jump distance canonicalised equal and would have been hoisted into one another.
  The pair of tests now required by `R034` (differ-only-in-position ⇒ equal; differ-only-in-target ⇒ unequal,
  with the field name present in the serialised form) is what makes that class of mistake visible; dropping
  `'target'` from the key set fails exactly one test.
- *Identity for a T2 block is its bytes, not its IR.* A residual block is emitted verbatim, so two blocks with
  equal extents and different content must never merge; `R034` excludes T2 from hoisting outright, and the
  exclusion is reported per block with its reason rather than being a silent `continue`. That rule was found
  by a fixture, not by argument: a mis-framed `ActionJump` (opcode < 0x80 ⇒ no `Length` field) tiered as
  unknown, and the pass correctly refused to hoist it.

**One regression in my own gate, reported because it is the interesting kind.** `tools/test_audit_dev.py`'s
`test_phase_labels_are_read_from_the_roadmap_not_hardcoded` asserted the roadmap's then-current labels,
including `"P6": "Not started"` — so the test that exists to catch a stale ledger broke *because* the ledger
was updated correctly, and started failing the moment P6 moved to In progress. It now tests the mechanism
(a fixture roadmap with unpredictable labels must be reflected verbatim; every real label must be in the
acceptance vocabulary). `test:audit` is 100 OK again.

**One flake, recorded without a resolution.** In the run immediately after `prettier --write` and a
`tsc -b --force`, the suite reported `1 failed | 864 passed (865)`; the failing file's name was not captured
because my grep filtered it out. Five subsequent full runs were 865/865 green. What was ruled out: the compile
tests have no wall-clock or ordering dependence (no `Date.now`/`setTimeout` in `packages/compile/test/*` or
`src/cancel.ts`), the cache tests are isolated in `mkdtempSync` directories so there is no shared-directory
race, and `vitest.config.ts` aliases every workspace import to `src/*.ts`, so a concurrent `dist` rebuild
cannot be the mechanism. The only timing-sensitive file in the suite is `packages/gfx/test/static-render.test.ts`,
which this work did not touch — a plausible candidate, unproven. An unreproduced single failure with no
captured name is evidence of nothing, and is written down here rather than quietly dropped.

| Gate | Result after `WP-120-05`/`WP-120-06` |
| --- | --- |
| Docs / status | `verify_docs` **ISSUES 0**; `gen_status` **214 / 668.5 / 70 / 294 / 257** (obligations 292 → 294 for `T-CMP-010`/`011`; the P6 estimate moves 66 → 68 d because doc 120's `WP-120-02` row and the roadmap's finally agree — the §7↔§10 cross-check caught the drift) |
| Tests | `corepack pnpm test` **71 files / 865 tests** (was 69 / 819); `packages/compile` 84 across four files |
| Development audit | `findings=52 known=57 new=0 fixed=5`; **590 rules** (588 + `R033`/`R034`), **454 ids = 237 cited + 215 unwired + 2 source-only**; P6's ledger `4 cited / 6 unwired / 10` |
| Audit tooling self-test | `test:audit` **100 OK** (after the fix above) |
| Negative controls | offset-bearing synthetic name ⇒ 2 failures in `names.test.ts`; `'target'` removed from the hoist projection ⇒ 1 failure in `frames.test.ts`; both restored ⇒ green |
| Unaffected lanes | `corpus:verify` 73/73 · `test:avm1-restart` both-identical · `test:browser` 31 · `lint` clean |

P6 stands at **4 of 14 work packages delivered** (`WP-120-01`, `-02`, `-05`, `-06`), the phase **In progress**.
The blocking analysis in §6 is unchanged: `decode`, the emitter packages and everything downstream of the
serializer (`WP-050-18`) are still gated on P5 and on P6's own asset chain, and P6's exit gate — a project
that compiles with zero suppressions — is untouched by this work. What did change is that the two passes that
were specifiable entirely from P6's own documents are now code, and one of them paid for itself by finding a
defect in P5 that no P5 test could see.

### 11.4 `WP-120-03` + `WP-120-04` — the two proof-shaped passes, and three holes they had to fail closed on

`packages/compile/src/passes/dead-code.ts` and `passes/shake.ts` landed together: the first proves which
characters and action blocks nothing can reach, the second turns `ActionIR.requirements` into the set of runtime
modules the emitter may include. Both are pass objects on the spine, so `dead-code` now runs before `shake`
because `PASS_ORDER` says so and not because of registration order — which is asserted (`IMPL-120-R013`). 21
tests in `dead-code.test.ts`, 12 in `shake.test.ts`; the package is at **117 tests across six files**, and
doc 120 v1.7 carries the three new `R005` clauses, the `R006` fold rule and one new rule, `IMPL-120-R035`.

**These two passes are different in kind from the first two, and it showed.** `names` and `frames` transform
data; a pruning pass *decides what may be deleted*, so every input it cannot read has to become a blocker
rather than a gap in a table. Writing the fixtures over *decoded* movies (never hand-built model objects —
P2's field lists leak, and a hand-built `VectorShape` would have let the pass look correct while its
quarantine check was unreachable) produced three findings, all now errata:

- **`E-045` (open):** `HostApiGroup` carries a 14th value, `timeline`, that AVM1 §8.1's 13-row table cannot
  name, and it is not a corner case — `ActionStop` alone reaches it, so 17 of 119 corpus blocks across 11 of
  73 movies name a group with no runtime module behind it, and in 6 of those it is the only member of the
  movie-object pair. P6 folds it through a total map and reports the fold as a decision; §8.1 owns the durable
  fix, and the fold's deletion belongs to whichever way that goes.
- **`E-046` (open):** three reference sites the model cannot answer. `DefineFont2/3`'s `HaveBitmaps` gives every
  glyph a `BitmapCharacterID` and `DefineFontModel` has no field for it (`grep -i bitmap
  packages/swf/src/tags/fonts.ts` → nothing); `DefineVideo4`'s `DeblockCharacterID` has no video payload in
  `CharacterModel` at all; and a reader that over-runs its tag leaves no mark — measured on a 3-byte
  `DefineShape`: tag span `[0, 5)`, `vectorShape` non-null, `quarantined` **unset**, and the single signal is
  `SF0013`, a **warning**, at offset **7**, which is inside the *next* tag. So a partial payload is
  indistinguishable from a complete one, and **no offset rule can attribute it** — the cursor of an over-read
  lands past the tag that caused it, which is why a slack window or "nearest preceding tag" heuristic would be
  a guess dressed as a rule. P6 fails closed on all three: font2/font3/video are reported as incomplete
  referencers and disable pruning movie-wide, as does an unresolvable placement id, a text run with no readable
  `fontId`, or edit text naming no font by id or export name. The tests pin the *other* side too — `font` v1,
  `font4`, bitmap, sound, `binaryData`, `imported`, `missing` are allowed, because a rule that blocked on every
  font would be quietly unusable. On this corpus the font block costs 2 of 73 movies (67 characters, 2 of them
  `DefineFont2`, 0 video, 0 `unknown`, 0 quarantined).
- **`IMPL-120-R035` (new rule, from a defect in my own first draft):** the pass originally read
  `ctx.diagnostics` to learn which payloads were interrupted. A cached `model` stage re-runs nothing and
  re-emits nothing, so a warm build would have pruned what a cold build refused to — `CMP-R040`'s "a hit must
  not change output bytes" broken by an input that was never in the key, and it would not fail, it would
  disagree. The list is now derived in the stage and carried on the artifact
  (`ModelArtifact.readInterruptions`, error-severity only, intersected with each definition tag's
  `headerOffset … headerOffset + length` span), and the sink is read for reporting only.

One ordinary bug fell out of the fixtures and is worth the space because it is the common kind: a
`DoInitAction` tag lives at *movie level*, so the model's `TagRef.inSprite` is null and an ownership rule built
on it gives an init action no owner — the init action then outlives the sprite it initialises, and the group
only it required is emitted forever. Ownership comes from the schedule's `spriteId` (`IMPL-050-R073`,
`E-040`). A `DefineShape` defined *inside* a sprite, by contrast, is not in `model.characters` at all, so the
per-character verdict for a nested definition belongs to the sprite's own entry — which is why the closure test
defines its shape at top level and places it inside.

| Gate | Result after `WP-120-03`/`WP-120-04` |
| --- | --- |
| Docs / status | `verify_docs` **ISSUES 0**; doc 120 v1.6 → **v1.7**; errata v2.13 → **v2.14** (`E-045`, `E-046` filed); roadmap 1.30 → 1.31 |
| Tests | `corepack pnpm test` **73 files / 898 tests** (was 71 / 865); `packages/compile` **117** across six files (was 84 across four) |
| Development audit | `findings=52 known=57 new=0 fixed=5`; **597 rules** and **456 ids = 239 cited + 215 unwired + 2 source-only**, against `590 / 454 = 237 + 215 + 2` at `HEAD` — the +7 rules are `IMPL-120-R035` plus the six `R005`–`R010` bullets, which arrived with doc 120 v1.6 in this same uncommitted state (`HEAD` still holds v1.5), and the +2 ids are `T-CMP-012`/`013`, defined *and* cited here for the first time. P6's ledger: **6 cited / 7 unwired / 13** |
| Audit tooling self-test | `test:audit` **100 OK** |
| Negative controls | init-action ownership back to `inSprite` ⇒ 1 failure (`shake.test.ts`, the prune-alongside test); `font2` allowed to be a leaf ⇒ 2 failures (`dead-code.test.ts`, `E-046` pair); `GROUP_FOLD` emptied ⇒ 4 failures in `shake.test.ts`, including the union equality, which is the assertion that shows a fold is load-bearing rather than cosmetic |
| Unaffected lanes | `corpus:verify` 73/73 · `test:avm1-restart` both reports identical (exit 0) · `test:audit` 100 · `lint` clean |

The shake pass is the first P6 code whose *evidence* is partly synthetic by necessity: five of the 13 groups
(`data`, `drawing`, `bitmap`, `geometry`, `filters`) are named by no block anywhere in the licensed corpus, so
no admissible file can show a drop happening — the corpus measures the fold, the fixtures measure the dropping.
P6 stands at **6 of 14 work packages delivered**, the phase **In progress**, and the gating in §6 is
unchanged: `WP-120-07`…`WP-120-14` sit behind P6's own asset chain, P5's `WP-050-18` serializer, and P0's
unbuilt `WP-010-11`.
