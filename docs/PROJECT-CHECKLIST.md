# swf-forge project completion checklist

**Status snapshot:** 2026-10-15

**Basis:** [`docs/impl/000-roadmap.md`](impl/000-roadmap.md) Draft 1.40, [`impl/registers/errata.md`](impl/registers/errata.md) 2.24 (56 entries, 16 open), [`impl/registers/corpus.md`](impl/registers/corpus.md) 1.5, [`impl/transpiler/120-compiler-and-emitter.md`](impl/transpiler/120-compiler-and-emitter.md) 1.16, [`impl/decompiler/110-video.md`](impl/decompiler/110-video.md) 1.5, and the phase audits through 2026-10-15.

This is a non-normative, phase/acceptance-level roll-up of remaining work, not a new specification or a duplicate work-package ledger. The roadmap and per-area specs remain authoritative; use their work-package and test tables for detailed breakdowns. Check an item only when its full phase-owned outcome has evidence and the relevant gate passes. Code presence or a test citation alone is not enough. This checklist does not authorize implementation.

**How this snapshot was compiled.** Every item below was re-derived from the registers or from a
mechanical check, not from a previous snapshot of this file. Three checks produced the wording: which
`T-*` ids appear in no test file (`T-SWF-009/-014/-017`, `T-AVM1-FE-034`, `T-CMP-006/-008` — all listed
as open where they are); which `Phase owner: P6` rows sit outside `IMPL-120` (six open, one delivered);
and the current gate set at the commit this file was rewritten against — `corepack pnpm build`,
`typecheck`, `test` (79 files / 1,084 tests), `lint`, `spec:verify` (0 issues), `audit:dev` (0 new
findings), `test:audit`, `tag:coverage`, `corpus:roundtrip:check` (no artifact drift), plus the three CI
jobs on `3ffb70f`.

## Current phase status

| Phase | Status | Disposition |
| --- | --- | --- |
| P0 — Foundations | **Completed** | Closed 2026-10-16: every §6 evidence obligation is in the gate set and the `UI32` ruling was taken from the upstream SWF v19 text (`E-033` closed). See [P0 closeout audit](../audits/P0-CLOSEOUT-AUDIT.md). |
| P1 — Container & dictionary | **Completed** | Exit-ready with explicit non-blocking deferrals; see [P1 audit](../audits/P1-AUDIT.md) and [resolution](../audits/P1-AUDIT-RESOLUTION.md). |
| P2 — Model & timeline | **Completed** | See [P2 audit](../audits/P2-AUDIT.md) and [resolution](../audits/P2-AUDIT-RESOLUTION.md). |
| P3 — Media decode & build assets | **Completed** | C7 checkpoint and phase closeout complete; the *asset-encode* half of P3's later packages is re-homed to P6 and is open there (`WP-070-06…09`, `WP-080-11`, `WP-090-12`). See [P3 audit](../audits/P3-AUDIT.md) and [resolution](../audits/P3-AUDIT-RESOLUTION.md). |
| P4 — Static render | **Completed** | Exit gates green; later renderer fidelity belongs to P9. See [P4 diagnosis](../audits/archive/P4-DIAGNOSIS.md). |
| P5 — AVM1 front end | **In progress** | C0–C4 complete; the byte round trip has a specified contract and an unscheduled-to-evidence package (`WP-050-18`), and two of the three highlighted criteria stay open. See [P5 resolution](../audits/P5-AUDIT-RESOLUTION.md). |
| P6 — Emitter | **In progress** | 13 of `IMPL-120`'s 14 packages delivered; `WP-120-07` open, gated on six P6-owned packages that live in docs 070/080/090/110. "13 of 14" is a per-document count, not a phase count. |
| P7 — First playable/runtime | **Not started** | Executable AVM1 semantics and runtime gates remain mandatory; `WP-130-01` also blocks P6's `strict-build` row. |
| P8 — Audio runtime | **Not started** | Playback, scheduling, synchronization remain; P3 decode/build work does not close them. |
| P9 — Fidelity hardening | **Not started** | P4 is the static baseline; P9 rendering/text fidelity work remains. |
| P10 — Video & long tail | **Not started** | `WP-110-12` (the P6-scoped header/extent read) is delivered; `WP-110-01…11` remain, including the packet validation that replaces P6's alpha estimate. |
| P11 — Release engineering | **In progress** | CI and short smoke gates exist; release gates remain open, and the corpus register's admission gates (§4 items 1–5) sit on this side of the line. |
| P12 — Inspector | **Not started** | Design exists; implementation and acceptance remain. |
| P13 — Clean engine | **Not started** | Design exists; implementation and acceptance remain. |

“Completed” means the audited phase exit is green, not that every work package is closed. Accepted
follow-ups for a completed phase are tracked separately below. Likewise, “in progress” and “not
started” are phase states, not completion percentages.

## Open phase gates

### P0 — Foundations

- [x] ~~`IMPL-010` §8's `UI32` row needs its ruling~~ — ruled 2026-10-16 from the upstream SWF v19
      Chapter 1 text (user-supplied): upstream prints the hex value and the bytes with no decimal, so
      the cell was our own miscomputation. Corrected to `1164865824`, the `ui32` pin removed, `E-033`
      closed (errata 2.25, doc 010 v1.12).
- [x] ~~Allocation and copy counts measured by a **named, deterministic counter**~~ — delivered
      2026-10-16: `allocationCounter` (`packages/swf/src/io/counter.ts`, `IMPL-010-R043`) asserted in
      `packages/swf/test/io-allocations.test.ts` — 0 primitive allocations over 10⁶ warm reads, exactly
      1 result object per record read, ≤ 1 payload copy over a ≥ 5 MiB `FWS` parse. Three hot paths
      (`float16`, `encodedU32`, `float32`/`float64`) were made allocation-free to earn the 0 (doc 010
      v1.11).
- [x] ~~`T-SWF-009`'s "every fixture" as a **checked-in inventory artifact**~~ — delivered 2026-10-16:
      `packages/swf/test/fixture-inventory.test.ts` carries the id, asserts the 26-file C1 inventory
      against the directory walk and the register's count line, and asserts repeat-parse identity over
      every file (doc 010 v1.8, roadmap Draft 1.42).
- [x] ~~`T-SWF-014/015/016` evidence completed~~ — delivered 2026-10-16: `T-SWF-014` wired in
      `packages/swf/test/io-property.test.ts` (10⁵ seeded values over 12 kinds, fixed-point bytes with
      counterexample reporting; `ByteWriter` gained the six missing encoders), and `-015`/`-016`
      strengthened there to their full recovery/error contracts (doc 010 v1.10).
- [x] ~~The diagnostic-literal lint of `IMPL-010` §11.5~~ — delivered 2026-10-16: `tools/check_codes.py`
      (`pnpm code:lint`, CI-wired, unit-tested in `tools/test_check_codes.py`), scope ruled
      production-only in `IMPL-010` §11.5 (doc 010 v1.9). Its first run migrated the 10 raw `code:`
      literals in `packages/assets/src/images/decode.ts` to `Codes.*` constants.
- [x] ~~Fresh P0 closeout audit~~ — [`audits/P0-CLOSEOUT-AUDIT.md`](../audits/P0-CLOSEOUT-AUDIT.md),
      2026-10-16: §11's six criteria re-measured; **P0 Completed** (roadmap Draft 1.45).

The fuzz target is **done** in substance and mis-described in the ledger: it lives in the gated tree as
`packages/swf/test/fuzz.test.ts` (with `packages/swf/test/fuzz/corpus/`) and runs under `pnpm test:fuzz`,
not at the `packages/swf/test/fuzz/readers.*.test.ts` path roadmap §6 names — see the drift item under
"Cross-cutting" below rather than re-opening the work.

### P5 — AVM1 front end

Sources: [`impl/transpiler/050-actions-and-avm1.md`](impl/transpiler/050-actions-and-avm1.md) §12–§13,
[P5 audit](../audits/P5-AUDIT.md), [resolution](../audits/P5-AUDIT-RESOLUTION.md).

- [ ] **Byte round trip — evidence only.** The lossless inverse format and byte-identity acceptance are
      normative (`IMPL-050-R065`–`R069`, §5.7) and the package is scoped and estimated
      (**`WP-050-18`**, 5 d, `frontend/serialize.ts`, `T-AVM1-FE-034`); nothing references
      `T-AVM1-FE-034` yet. The `→ disassembly →` leg was removed from the byte-identity path by the
      recorded scope decision, so `T-AVM1-FE-032` must not be cited here. Closes when canonical input
      reproduces its bytes, non-canonical input is diagnosed rather than normalized, and
      reserved/undefined codes refuse serialization and stay residual.
- [ ] **Two-reviewer screen on the open corpus.** C4-c exists (73 hash-pinned AVM1 conformance movies) and
      the tier report runs over it, but `registers/corpus.md` §4 item 3 records "one auditor at most", and
      no C4-t open title is admitted. Synthetic fixtures alone do not pass this criterion.
- [ ] **FE-030 oracle:** resolve SWF≤5 `ActionStringLength` units/behavior from an authoritative source or a
      documented original-Flash-Player probe. Emulator cross-checks are not an Adobe oracle.
- [ ] Close P5 only after the three criteria above and the rest of `IMPL-050` §13 pass.

**Ownership boundary:** P5 owns `T-AVM1-FE-*` front-end acceptance. P7 owns executable runtime
`T-AVM1-*` obligations, including `T-AVM1-008/009/012/025/027`, interpreter/budget behavior, and runtime
call/unwind/scheduling. Front-end IR or scheduling-metadata tests do not satisfy those runtime gates.

### P6 — Emitter

Sources: [`impl/transpiler/120-compiler-and-emitter.md`](impl/transpiler/120-compiler-and-emitter.md) §8–§10
and the four decompiler documents that carry P6-owned rows.

- [ ] **`WP-120-07`** — asset planner + encoding scheduler (`packages/compile/src/passes/assets.ts`,
      `IMPL-120-R010`): encode order, parallelism cap, budget accounting, fallback-ladder selection. It is
      the last undelivered row in `IMPL-120` §9 and the sole consumer of the budget machinery P6 already
      ships. It also owns `--jobs`, `budgets.json`, and the five `build-info.json` rows currently listed
      under `withheld` (`IMPL-120-R031`'s reading is available; see the video item below).
- [ ] **`WP-070-06`** — image classification heuristics + manifest recording (`assets/src/images/classify.ts`,
      `T-MOD-306`).
- [ ] **`WP-070-07`** — re-encode ladder + mip generation + residual check (`reencode.ts`, `mips.ts`,
      `T-MOD-307`). Requires the external-encoder decision (`MS-§3` tool table) and its
      tool-missing/unavailable reporting; `WP-120-07` names this row as a dependency.
- [ ] **`WP-070-08`** — `.sfa` writer/reader + round-trip test (`T-MOD-308`).
- [ ] **`WP-070-09`** — texture budget accounting into `budgets.json` (`AST-§4` integration).
- [ ] **`WP-080-11`** — glyph subsetter, static + dynamic reachability (`subset.ts`, `T-MOD-510`).
- [ ] **`WP-090-12`** — `budgets.json` audio section + transcode reporting (`AST` integration).
- [x] ~~**`WP-110-12`** — `DefineVideoStream` header + summed `VideoFrame` byte extents~~ — delivered
      2026-10-15 (`packages/swf/src/video/extent.ts`, `T-MOD-917`, 13 tests). No codec validation and no
      `NumFrames` judgement happen in that pass, by requirement.
- [ ] **`T-CMP-006`** (cancellation: SIGINT during an asset encode returns within 2 s, no partial files) and
      **`T-CMP-008`** (`plan` output matches the real build's `budgets.json` within tolerance) are wired in
      no test file. Both are `WP-120-07`'s to close: the first needs an encode to interrupt, the second
      needs the artifact it compares against. `IMPL-120` §7 records what P6 measures meanwhile.
- [ ] **`IMPL-120` §10 criterion 1** (the reference title builds, type-checks, verifies, rebuilds
      byte-identically) stays **not measurable**, and is recorded rather than waived: C3's reference title
      is unadmitted (`registers/corpus.md` §2, and §4 item 1 — no `fixtures/PROVENANCE.md` exists, so
      nothing can be admitted with the record `REPO-R017` requires), and its type-check clause needs
      `@swf-forge/runtime/contract`, i.e. **`WP-130-01`** (P7). `verify`'s `strict-build` row stays
      `notRun` with that owner named; type-checking an emitted project in this repository or in CI is a
      documented non-goal.
- [ ] **`IMPL-120-R031`'s alpha clause** stays a labelled worst-case estimate until **`WP-110-06`** (P10)
      supplies measured packet-header facts; `budgets.json` must keep recording which of the two it holds.

Delivered and *not* to be re-opened here: the pipeline runner (`WP-120-01`), cache and `--verify-cache`,
the five §3 passes, both emitters, the manifest pair + drift check, the three reports, `verify`, the CLI,
and the corpus/double-build lane (`tools/corpus-roundtrip.mjs`, `audits/P6-CORPUS-ROUNDTRIP.json`,
`audits/P6-C4-ROUNDTRIP.json`). Exit codes, budget gating and the `CMP-§8` flag table are pinned by
`packages/cli/test/cli.test.ts`, `corpus.test.ts` and `packages/compile/test/pipeline.test.ts`.

### P7–P13

Sources: [roadmap §2/§6](impl/000-roadmap.md) and the owning specs listed there.

- [ ] **P7** — normative AVM1 runtime object model, coercions/operators, property/prototype/enumeration and
      required host APIs; `T-AVM1-008/009/012/025`, `T-RT-121`; residual interpretation and instruction
      budgets (`T-AVM1-027`); **execution** of frame calls/resumption, exception unwinding,
      `DoInitAction`/`DoAction` ordering, display-list/timeline and shell integration; C1 on three suitable
      open-corpus titles with the first-60-frames, error and budget criteria. Start with **`WP-130-01`**,
      which unblocks P6's `strict-build`.
- [ ] **P8** — event/stream playback, deterministic scheduling and voice handling, Web Audio/worklet
      integration, frame-boundary sync with no click artifacts; `T-AUD-027` drift ≤ 12 ms over 10 minutes
      including jumps. P3 codec decode, WAV previews and sample-offset metadata are not playback evidence.
- [ ] **P9** — gradient/bitmap fills, blends, masks, filters and cache invalidation, the feature-flagged
      WebGPU backend; dynamic text/layout, input/IME and device-font behavior; `T-GFX-010…041` and the
      applicable `T-AST-*` at declared tolerances.
- [ ] **P10** — `WP-110-01…11`: stream model, transcoder driver with pinned args and provenance, determinism
      hardening, both native Screen Video decoders, packet-header validation, emission, output verification,
      runtime `frameToSource` wiring, licensing entries, the video corpus; `T-AST-021` with SSIM ≥ 0.98
      against source decode; `fscommand`, `System.capabilities`, `ExternalInterface` mappings (`T-RT-013`)
      with unsupported behavior explicit and diagnosed.
- [ ] **P11** — full harness/oracle metrics, gate and waiver flows, provenance-aware goldens, fuzz coverage,
      coverage accountability (`IMPL-140`); 24-hour fuzz history with zero crashes; the full security suite
      and `THIRD_PARTY.md`; bundle/texture/audio/manifest budgets on both baselines; three-engine browser
      CI; release docs/examples; C2 acceptance for three titles of differing profiles. Short PR smoke is not
      full-duration evidence.
- [ ] **P12** — inspector project open/validation, provenance-aware model/indexing for directory, ZIP and
      served inputs with worker budgets and cancellation; explorer/editor/highlighting, SWF↔TypeScript
      navigation, timeline and diagnostics/report views, run view/frame stepping, `forge-inspect serve`;
      `T-INS-101…114`, three-browser budget tests, security hygiene, golden/degradation cases.
- [ ] **P13** — clean-engine transformation/tiering policy, clean-project emitters, rewrite log, migration
      report, refusal behavior; fixed-step clean runtime and `forge-clean` CLI; Flash target preserved on
      refusal; `T-CLN-101…114` on declared clean-ready titles.

## Cross-cutting items no phase table owns

- [x] ~~`IMPL-120` §9's delivery markers are inconsistent~~ — fixed 2026-10-16 (doc 120 v1.17):
      `WP-120-01`'s row now carries its **Done** marker. (The misreading it caused is recorded in the
      temporary close-out roadmap, Wave 0.)
- [x] ~~Roadmap §6's fuzz row names `packages/swf/test/fuzz/readers.*.test.ts`~~ — re-pointed 2026-10-16
      (roadmap Draft 1.41, doc 010 v1.7) at the delivered `packages/swf/test/fuzz.test.ts`; §6's P0 fuzz
      row now reads Delivered. The `T-SWF-009` half is *not* closed by this edit — it needs the id wired
      to the inventory (P0-1 in the temporary close-out roadmap).
- [ ] `--budget-strict` is accepted, gate-mapped and **non-decisive** at P6 by the recorded §7 decision; it
      becomes decisive when `WP-120-07` gives it something to decide about. Nothing today marks this
      provisional state in the CLI's own output beyond the gate row.
- [ ] The five withheld `build-info.json` budget rows and `porting-notes.json`'s `tier`/`verifyItems`/`pins`
      are withheld *with owners named*; `SF0507`'s withheld manifest sections stay gated on `WP-120-07`
      too. Next free diagnostic code is `SF0512`; a new code must take that number and be documented.
- [ ] `registers/corpus.md` §4's six open items — (1) no `fixtures/PROVENANCE.md`, so no binary can be
      admitted with the record `REPO-R017` requires; (2) no C3 reference title named; (3) no C4-t open title
      admitted and the two-reviewer requirement has one auditor at most, with `E-035`–`E-040` awaiting
      disposition; (4) C2 is not enumerated as an artifact, so "the deterministic synthetic set" is whatever
      the writers generate per test; (5) §2 requirement 3's hash-pinned-manifest arm is proposed, not agreed;
      (6) the C4-c lane is run by hand (`tools/open-corpus.mjs report`) and no test asserts its invariants,
      so a regression like `E-034` could return unnoticed.
- [ ] 15 errata entries stay open in [`impl/registers/errata.md`](impl/registers/errata.md): `E-005`,
      `E-041`–`E-053`, `E-055`, plus `E-056`'s spec-ask half. The ones that bear on P6's
      acceptance are `E-042` (`CMP`'s acceptance table and `IMPL-120` §8 give the same `T-CMP-*` ids
      different meanings), `E-043` (three severities implemented, four plus a `requirement` field
      specified), `E-046` (three payloads a dead-code proof cannot read), `E-048`–`E-051` (artifact and
      report shapes the specs print incompatibly, including a rule that names a gate flag which exists
      nowhere), `E-052` (three `verify` checks an emitted project cannot answer), `E-053` (exit-table
      contradiction plus five `CMP-§8` flags with no config home), and `E-055` (what "a warning" is, after
      the sink's dedupe made the gap four orders of magnitude).
- [ ] Two asks against the design spec, both recorded rather than absorbed: `CMP-§8` should mark which of
      its numbers are targets recorded for another phase rather than bounds this phase enforces
      (`E-056`), and `CMP-§8`'s "Fail after n warnings" should say whether it counts rows or occurrences
      (`E-055` — the CLI counts occurrences and prints both numbers in the meantime).
- [ ] `docs/impl/registers/STATUS.md` re-derives a newer snapshot date on every run with no content change
      (its per-doc columns do not read delivery markers). Regenerating it as date-only churn is
      deliberately avoided; if it should track delivery, `tools/gen_status.py` needs a marker rule first.

## Accepted completed-phase deferrals

These are tracked follow-ups, **not open P1 exit gates**. Respect the recorded owner/trigger; do not
silently claim them implemented.

| Follow-up | Current disposition | Trigger / next action |
| --- | --- | --- |
| Standalone `swffuzz` CLI/tooling (`WP-020-11`) | Deferred; the in-repo 10⁴ mutation smoke gate runs | Revisit under doc 140, or retain the reviewed deferral with an owner. |
| Streaming LZMA | Pinned deviation; input-size pre-bound mitigation exists | Revisit if a suitable streaming dependency is approved. |
| Full-scale 512 MiB absolute-RSS test | Deferred to doc 140; marginal-RSS test is the accepted current gate | Add only with an agreed CI memory/stability budget. |
| Synchronous-zlib partial yield | Platform limitation is pinned; async path supplies partial bytes | Revisit only if the platform/API or acceptance contract changes. |
| Chapter 2 source-confirmation errata | Explicit doc-only open items in IMPL-020 §12 | Resolve when authoritative chapter wording is available. |
| Emitted-project type-check (`strict-build`) | `notRun`, owner `WP-130-01`; never type-check or lint an emitted project in this repository or in CI | Revisit when P7 ships the runtime contract package; `T-CMP-011` covers the emitted `tsconfig` strictness meanwhile. |
| C4-c corpus lane evidence | `audits/P6-C4-ROUNDTRIP.json` is regenerated by hand and records counts + agreement, not per-file payloads | Wire the invariant assertions in when `registers/corpus.md` §4 item 6 is dispositioned. |

## Release-level completion

The product is not ready for v1.0 until the roadmap's release definition is satisfied:

- [ ] Three titles of differing profiles reach C2 with divergences and decision IDs recorded.
- [ ] Clean-checkout build succeeds in one command and produces deterministic output. *(The double-build
      determinism gate exists and is green; the clean-checkout-on-a-fresh-machine claim is P11's.)*
- [ ] Performance and bundle budgets pass on desktop and mobile baselines, or have documented waivers.
- [ ] Three-engine browser matrix is green, with skips documented. *(One headless-Chromium lane is wired;
      the other two engines are P11's.)*
- [ ] Security suite is green and `THIRD_PARTY.md` is complete.
- [ ] Every design decision is settled or explicitly accepted; no un-triaged decision remains.
- [ ] [`impl/registers/errata.md`](impl/registers/errata.md) is current — 15 open entries as of
      2026-10-16 (`E-033` closed by ruling D1), and each of them is triaged rather than un-triaged.

## Source of truth and update rules

- Use [`000-roadmap.md`](impl/000-roadmap.md) for phase status, sequencing, dependencies, and exit criteria.
- Use the owning specs' work-package and test tables for detailed engineering tasks; this roll-up does not
  track individual work packages beyond the ones named above as gates.
- Treat [`impl/registers/STATUS.md`](impl/registers/STATUS.md) as generated spec-coverage information, not an
  implementation completion percentage.
- Phase counts are per-document unless the register says otherwise. `IMPL-120`'s "13 of 14" excludes six
  P6-owned packages in `IMPL-070`, `IMPL-080`, `IMPL-090` and `IMPL-110`; a phase-closure claim must sum
  every row whose `Phase owner` is that phase.
- Update this roll-up alongside relevant evidence/audits. Never reclassify runtime work as front-end
  coverage, close a phase from a test citation alone, or check an item whose only evidence is that a
  document mentions it.
