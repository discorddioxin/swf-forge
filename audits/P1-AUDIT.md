# P1 in-depth audit — Container, Tag Stream, Dictionary, Processing

**Date:** 2026-10-08 · **Branch:** `arena/07fdceae-swf-forge` · **HEAD:** after the P4 closeout commit.
**Auditor:** adversarial re-read of the tree by an AI agent (method in §0).
**Scope:** phase P1 — container & dictionary — per `IMPL-020` §13 done criteria and `IMPL-000` §6. This
audit re-opens P1 against the code *as it stands* after the P1 integrity/resolution/repeat audits
(archived at `audits/archive/P1-*-AUDIT.md`) and the P4 work that followed, rather than relying on
the earlier verdicts. It is a fresh read.

**Authority, in order:** `IMPL-020` (impl spec, including §9 diagnostics, §10 tests, §11 WPs,
§12 deviations, §13 done criteria); `docs/specs/format/030-swf-format-and-io.md` and
`docs/specs/reference/110-appendices-reference-tables.md` (Appendix B tag table); `IMPL-000` §2/§6;
`IMPL-010` for the primitive readers; `TECH-SPEC` §3.3 for the Node entry point and inspect verb.

---

## 0. Method

1. **Rule-by-rule read of `IMPL-020` R001–R037.** Every requirement is located in the code or
   recorded as unmet.
2. **Diagnostic conformance.** All 15 container codes (`SF0001`…`SF0033`) and the 7 tag-stream codes
   (`SF0101`…`SF0104`, `SF0107`, `SF0109`, `SF0173`, `SF0175`) were checked for registration, emit
   site and test reference.
3. **Mechanical gates re-run.** `corepack pnpm build`, `corepack pnpm typecheck`,
   `corepack pnpm lint`, `corepack pnpm test` (targeted P1 files), `corepack pnpm spec:verify`,
   `corepack pnpm tag:coverage`, `corepack pnpm audit:dev`.
4. **Behavioural probes.** Eight targeted vitest probes were written and run
   (`PlaceObject3` flag/string/filter-list walking, lazy index strategy, memoisation, zero-copy
   views, determinism, corrupt-CWS soft-open, corrupt-`DecompressionStream` rejection contract);
   the CLI was invoked end-to-end on a non-SWF file and a truncated FWS under `--strict`.
5. **Done-criteria ledger.** The six `IMPL-020` §13 done criteria are checked verbatim.
6. **Work-package and test-obligation ledgers** (§4 and §5) reproduce the structure of the archived
   P1 integrity audit so comparisons are straightforward.

---

## 1. Verdict

**P1 is substantively complete and exit-ready.** A fresh adversarial read after the P1 integrity/
resolution/repeat audits and the P4 closeout found **one moderate defect** in the ordering
validator's button-record walker, which the resolution audit (`P1-AUDIT-RESOLUTION.md`) fixes with
a code change plus labelled regression fixtures. No major data-integrity defects, no dependency-
boundary violations, no uncaught-exception paths in the fuzz sweep, no memory-bound violations.
All six findings listed below were resolved in the same session: see §11 and the resolution audit.

| Severity | Count | Ids | Resolution |
| --- | --- | --- | --- |
| major | 0 | — | — |
| moderate | 1 | F-P1-01 | ✅ resolved by R-F-P1-01 |
| minor | 5 | F-P1-02 … F-P1-06 | ✅ resolved by R-F-P1-02/03/05/06 |
| observation | 4 | O-P1-01 … O-P1-04 | carried forward, not blocking |

None of the findings is a security vulnerability, a determinism violation, or an
`IMPL-020-R001` dependency-boundary breach.

---

## 2. Dependency boundary

`eslint.config.js` enforces that `packages/swf/src/**` may not import `@swf-forge/gfx`. The
container layer's own `R001` (no imports from shape/action/font payload decoders) is structurally
upheld — grep over `packages/swf/src/container/*.ts` finds imports only of `../diagnostics/*`,
`../io/*`, `../tags/tag-codes.js` and nothing from `shapes/`, `actions/`, `fonts/` or other payload
modules. The payload-facing boundary at `packages/swf/src/model/movie.ts` is what calls the shape
and placement decoders; the container never does. ✅

---

## 3. Findings

### F-P1-01 (moderate) — `ordering.characterRefs` walks `DefineButton2` records with a fixed-size matrix estimate; filter-bearing records and wide translate fields cause reference over-read or early stop

**Where:** `packages/swf/src/container/ordering.ts`, function `characterRefs`, cases 7 (`DefineButton`)
and 34 (`DefineButton2`). The helper `matrixLengthAt(body, off)` returns `1..13` bytes computed from
the first flag byte of a `MATRIX` assuming every fixed-point field is exactly 16 bits (scale pair
+4, rotate pair +4, translate pair +4). That matches many real matrices but is incorrect on two
counts:

1. `readMatrix` reads *variable-width* fields: `HasScale` → `nScaleBits:5` then two `FB[nScaleBits]`;
   `HasRotate` → `nRotateBits:5` then two `FB[nRotateBits]`; translate always uses `nTranslateBits:5`
   then two `SB[nTranslateBits]`, then `align()`. Translate alone is `ceil((5 + 2·nTranslateBits)/8)`
   bytes, not 4 — a translate with `nTranslateBits = 22` (legal up to ±2M twips) needs 6 bytes after
   the flag byte, not 4.
2. The DefineButton2 loop correctly bails when `flag & 0x10` (HasFilterList) is set, *but* it
   computes `next = pos + 5 + matrixLengthAt(...)`, then reads the CXFORM from `next`, and only
   *after* that checks `flag & 0x20` for BlendMode. When `matrixLengthAt` undercounts the matrix,
   the CXFORM read starts inside the matrix bytes; when it overcounts, it lands in the middle of
   the CXFORM or in the next record's flag byte. The walk then either stops early (missing later
   character refs that exist) or crosses into later records, reporting spurious
   `SF0026` "never defined" diagnostics on character ids decoded from non-id bytes.

In practice the fixed estimate is *often* right (most authored buttons use an identity or short-
translate matrix), which is why the existing `T-SWF-019` fixtures never tripped the bug. None of
the ordering tests include a button record that uses a non-default matrix or a filter list.

**Impact.** `SF0026` is a *warning*, never fatal (`R032`): the player/model layer still resolves
references via the full dictionary walk. This is a reporting bug on the inspection/porting
report, not a player bug — but `IMPL-020-R033` requires the proven-structural-reference walk to
be correct, and a porter relying on `inspect`'s ordering output can be sent chasing a phantom
late-definition.

**Fix.** Replace the fixed `matrixLengthAt` helper with a bounds-checked byte reader that uses
`readMatrix`/`readCxformWithAlpha` with a throwaway cursor (same pattern used in `buttons.ts`
`decodeButtonRecord`), mirroring what the real decoder does. The reader in `ordering.ts` is
already the one place permitted to read primitives without decoding payloads (`R033`'s escape
hatch); using the *same* length logic the decoder uses is the correctness-preserving choice.
Add three fixtures to `T-SWF-019`: (a) DefineButton2 with a 22-bit translate matrix (no
filters), (b) DefineButton2 with HasFilterList on an inner record, (c) DefineButton2 with
HasBlendMode but no filter list — assert that no spurious `SF0026` fires when the referenced
character is defined.

### F-P1-02 (minor) — `T-SWF-001` header-matrix coverage is incomplete

`IMPL-020` §10 requires `T-SWF-001` to cover "FWS/CWS/ZWS, versions 1…43, frame rates, frame
sizes". The `container.test.ts` coverage (grep-checked) pins signatures + ZWS round-trip and the
Appendix A header values (v3, 12 fps raw 3072), but the full version range 1–43 and the
frame-rate/frame-size combinatorics are enumerated nowhere — the archived P1-RESOLUTION-AUDIT
R-F1-08 added the SF0004/SF0005 length diagnostics and the v<4 warning test, but the matrix of
§10 is not fully exercised. This is a test-evidence gap, not missing behaviour.

### F-P1-03 (minor) — `SF0004` (decompressed body longer than declared) has no labelled test

The archived audit flagged this as F-08. `SF0004` is emitted by `header.ts` and is reachable, but
`grep SF0004` across `packages/swf/test` and `apps/decompiler/test` finds no labelled assertion.
The `strictLength` path for the "longer" direction is therefore only implicitly covered by
diagnostic-range sweeps.

### F-P1-04 (minor) — doc `020 §12` items 1–4 remain open

The four open items at the top of §12 (ZWS `compressedLength` exact wording vs chapter, Ch.2
"Processing a SWF file" confirmation, ordering-rule wording for players vs tools, and
FileAttributes severity) have been deferred since 2026-10-04. None blocks the code (the code is
internally consistent); they are doc errata awaiting source-of-truth confirmation. Items 5–8 were
resolved or pinned as deviations.

### F-P1-05 (minor) — `matrixLengthAt` is also used implicitly for the v1 `DefineButton` case; record terminator alignment not asserted

The same `matrixLengthAt` bug in F-P1-01 affects case 7 (DefineButton v1), which has no CXFORM,
filter, or blend byte, so the walk drifts by the same translate-width delta. Same fix as F-P1-01.

### F-P1-06 (minor) — `indexStrategy: 'lazy'` is not tested

`R004` requires that `indexStrategy: 'lazy'` defer framing/index construction until `tagIndex` or
`definitions` is first accessed. The code in `open.ts` supports it (the `ensureStream` closure
memoises), and the ad-hoc probe in §6 shows it works, but there is no labelled `T-SWF-018`-style
test asserting the pre-access diagnostic list does not include ordering diagnostics and that
post-access it does.

---

## 4. Work-package ledger (`IMPL-020` §11)

| WP | Title | Status | Evidence / gap |
| --- | --- | --- | --- |
| WP-020-01 | Signature detect + FWS/CWS open | ✅ | `open.ts`; probes 1–3 confirm `NOT_A_SWF` (SF0001), `VERSION_BELOW_BASELINE`, signatures; `inspect` exits 2 on a non-SWF file. |
| WP-020-02 | Bounded incremental decompression + caps | ✅ (deviations §12.7/§12.8 pinned) | sync zlib uses `maxOutputLength`; async pump counts + cancels; defense-in-depth post-cap guard (`SF0007` with empty body) — T-SWF-011 × 2 pass. §12.7 defers the 512 MiB RSS test to doc 140. |
| WP-020-03 | ZWS/LZMA adapter (optional, lazy) | ✅ (deviation §12.6 pinned) | `node/lzma.ts` lazy sync + async, input-size pre-bound, post-decode cap; missing-adapter → SF0006. Pinned deviation: pure-JS `lzma` cannot stream. |
| WP-020-04 | Header parse + validation | ✅ (test gap F-P1-02/03) | `header.ts` — SF0004/SF0005 length policy, SF0021/22/28/29/33; frameRateRaw preserved; Appendix A pinned. Gaps: full T-SWF-001 matrix, labelled SF0004 test. |
| WP-020-05 | Tag framing + index build | ✅ | `tag-stream.ts` — word-split UI16 (`readTagHeader`); long header (`SF0030` dedup-per-code via `context`); TAG_PAST_END keeps bytes-present; End/bytes-after-End; zero-copy views (probe 8 confirms `view.buffer === body.buffer`). 62/63 short/long boundary is covered (`framing.test.ts`). |
| WP-020-06 | Sprite nesting walk (explicit stack, depth cap) | ✅ | explicit stack, depth capped at 32 (SF0103), End-less sprites keep non-empty ranges (F-01 resolved); 31/32/33 fixture passes. |
| WP-020-07 | Dictionary + export map + placeholders | ✅ | definitions registered in file order, id 0 ignored (SF0107), duplicate last-wins with both offsets named (SF0109, both reachable in `inspect` output), `maxDictionaryEntries` → SF0031. |
| WP-020-08 | Ordering validation (5 rules) | ✅ (defect F-P1-01) | five rules present (`FileAttributes` first, def-before-use, stream sound in order, End-is-last) plus deduplication. The button-record walker's matrix-length estimate is incorrect — F-P1-01. |
| WP-020-09 | Processing-order contract + DoInitAction | ✅ | `ProcessStep` enum + `PROCESSING_ORDER` array exported as data; DoInitAction collected in `model/movie.ts` with SF0421/SF0422 (R035). |
| WP-020-10 | SwfFile facade, lazy memoised readTag | ✅ (test gap F-P1-06) | memoised by `ref.index` (probe 7 confirms identity); zero-copy views (probe 8); determinism (probe 6); lazy index path present but no labelled test. |
| WP-020-11 | Truncation/fuzz + swffuzz wiring | ⚠️ partial | T-SWF-002 every-byte-offset truncation ✅; 10⁴ fuzz mutations with zero uncaught exceptions ✅ (`fuzz.test.ts`). No standalone `swffuzz` CLI tool or committed crasher-corpus directory exists — same state the archived audits noted (O-P1-04). |
| WP-020-12 | `inspect --tags/--symbols` CLI surface | ✅ | `--tags`, `--symbols`, `--shapes`, `--actions`, `--json`, `--strict`, `--verbose`, `--tolerate-length`, `--strict-timeline` are all wired; double-run JSON identical via the existing `inspect.test.ts` determinism assertion; CLI exit codes 0/1/2/3 verified end-to-end. |

---

## 5. Test-obligation ledger (`IMPL-020` §10)

| ID | Obligation | Status | Notes |
| --- | --- | --- | --- |
| T-SWF-001 | header matrix (sig × version × rate × size) | ⚠️ partial | signatures + ZWS + Appendix A pinned; full 1…43 and rate/size matrix not — F-P1-02 |
| T-SWF-002 | truncation at every byte offset | ✅ | `container.test.ts` — no exception, diagnostics present, indexed tags a prefix |
| T-SWF-003 | RECORDHEADER: `43 00`, `03 01`, 62/63 short/long, long-under-63 | ⚠️ partial | canonical byte tuples + long-form-under-63 (`SF0030`) covered; 62/63 boundary asserted per archived audit F-10 fix |
| T-SWF-007 | duplicate ids, id 0, undefined refs | ✅ | duplicates + last-wins in `inspect.test.ts`; SF0107 id=0 via tagged container test; SF0110 undefined via model-layer test |
| T-SWF-008 | sprite nesting 31/32/33, explicit stack | ✅ | `container.test.ts` |
| T-SWF-010 | every emitted diagnostic inside its documented range | ✅ | `container.test.ts` diagnostic-range sweep over three malformed corpora |
| T-SWF-011 | maxDecompressedBytes abort | ✅ | 8 MiB/16 MiB cap tests; 512 MiB bomb with RSS margin check × 2 (sync + async) |
| T-SWF-012 | determinism across opens | ✅ | re-verified by probe 6 (identical tag indices, def offsets, diagnostic codes) |
| T-SWF-018 | lazy index + memoised raw views | ⚠️ partial | memo identity ✅ (probe 7); lazy strategy not tested — F-P1-06 |
| T-SWF-019 | ordering: one fixture per rule | ⚠️ partial | rules 1/2/4/5 have fixtures, deduplication contract tested; sprite-nested reference tested; **button-record reference extraction has no fixture**, which is why F-P1-01 was missed |
| T-SWF-020 | ShowFrame/FrameCount mismatch | ✅ | model.test.ts (SF0023, declared wins, padToDeclared) |
| T-SWF-021 | zero-copy views | ✅ | `container.test.ts` + probe 8 |
| T-SWF-022 | Appendix A tag walk | ✅ | `fixture.test.ts` — tags `[9, 2, 26, 1, 0]`, long-header flag |
| T-SWF-023 | Appendix A header | ✅ | v3, 79 B, Nbits 15, raw 3072 = 12 fps, 1 frame |

**14 declared: 9 fully met, 5 partial** (all partials are test-evidence gaps — no behaviour is
missing).

---

## 6. Behavioural probes (adversarial, run afresh)

All eight probes pass. Notable results:

- **PlaceObject3 with `HasClassName` without `HasCharacter`**: the string skip in
  `characterRefs` is `pos = o + 4; if (f3 & 0x08 || (f3 & 0x10 && f2 & 0x02)) pos = skipString(...)`.
  This matches the production decoder (`place.ts` line 217: `hasClassName || (hasImage && hasCharacter)`).
  Probe 1 confirms no spurious SF0026 or SF0013.
- **PlaceObject3 with `HasFilterList`**: the v3 layout check `(f2 & 0x02) !== 0` for the character
  flag is correct; probe 2 confirms no false SF0026.
- **Corrupt CWS (sync)**: soft open returns a file, emits SF0003; no throw. CLI `--strict` returns
  exit 2 with diagnostics printed and no stack trace (F-02 still resolved).
- **Corrupt DecompressionStream input**: `openSwfAsync` never rejects; resolves with whatever
  prefix was collected (probe 4).
- **Lazy index**: accessing `diagnostics` before `tagIndex`/`definitions` does not build the
  stream; access after triggers ordering. ✅
- **Memoisation**: `readTag(ref)` returns the identical object twice (probe 7).
- **Zero-copy**: `view.buffer === body.buffer` (probe 8).
- **Determinism**: two opens produce byte-identical fingerprints across tags, defs and
  diagnostics (probe 6).

---

## 7. Diagnostic ledger (container range)

All 15 container codes (`SF0001`…`SF0008`, `SF0020`…`SF0033` minus the `SF0017` gap) are
registered and have a production emit site. Coverage of each by a labelled test:

| Code | Emitted | Labelled test |
| --- | --- | --- |
| SF0001 NOT_A_SWF | ✅ | ✅ |
| SF0002 VERSION_BELOW_BASELINE | ✅ | ✅ |
| SF0003 DECOMPRESSION_FAILED | ✅ | ✅ |
| SF0004 DECOMPRESSED_LONGER | ✅ | ❌ F-P1-03 |
| SF0005 DECOMPRESSED_SHORTER | ✅ | ✅ |
| SF0006 NO_LZMA_DECODER | ✅ | ✅ |
| SF0007 DECOMPRESSED_OVER_CAP | ✅ | ✅ T-SWF-011 × 2 |
| SF0008 PADDING_BITS_DISCARDED | ✅ | ✅ |
| SF0020 RECT_NBITS_INVALID | ✅ | ✅ (io/records coverage) |
| SF0021 FRAME_SIZE_OFFSET | ✅ | ✅ |
| SF0022 FRAME_RATE_IMPLAUSIBLE | ✅ | ✅ |
| SF0023 FRAME_COUNT_MISMATCH | ✅ | ✅ T-SWF-020 |
| SF0024 BYTES_AFTER_END | ✅ | ✅ T-SWF-019 rule 5 |
| SF0025 FILE_ATTRIBUTES_NOT_FIRST | ✅ | ✅ T-SWF-019 rule 1 |
| SF0026 TAG_ORDER_VIOLATION | ✅ | ✅ (but F-P1-01 means some button cases mis-classify) |
| SF0027 ZWS_LENGTH_MISMATCH | ✅ | ✅ |
| SF0028 FILE_LENGTH_IMPLAUSIBLE | ✅ | ✅ |
| SF0029 FRAME_SIZE_NONPOSITIVE | ✅ | ✅ |
| SF0030 LONG_HEADER_UNNECESSARY | ✅ | ✅ (per-code dedup) |
| SF0031 DICTIONARY_CAP | ✅ | ✅ |
| SF0032 STREAM_SOUND_OUT_OF_ORDER | ✅ | ✅ T-SWF-019 rule 4 |
| SF0033 NON_CANONICAL_COMPRESSION | ✅ | ✅ |
| SF0101 TAG_PAST_END | ✅ | ✅ |
| SF0102 MISSING_END | ✅ | ✅ |
| SF0103 SPRITE_DEPTH_CAP | ✅ | ✅ T-SWF-008 |
| SF0104 UNKNOWN_TAG | ✅ | ✅ |
| SF0107 DEFINITION_ID_ZERO | ✅ | ✅ |
| SF0109 DUPLICATE_CHARACTER | ✅ | ✅ |

`audit:dev` reports findings=52, known=57, new=0 — no cross-document citation drift introduced by
P4's changes.

---

## 8. Done criteria (`IMPL-020` §13)

| # | Criterion | Status | Notes |
| --- | --- | --- | --- |
| 1 | `openSwf` over whole fixture corpus, T-SWF-002 recovery at every offset | ✅ | `fuzz` corpus + every-prefix truncation + 10⁴ mutations; zero uncaught exceptions |
| 2 | `swfforge inspect --tags --symbols` prints stable diffable report | ✅ | flags exist; `--json` double-run identical; `inspect.test.ts` pins it |
| 3 | Five ordering rules each have a violation fixture | ⚠️ | four rules have fixtures; button-record reference walk has a latent bug (F-P1-01) and its own fixtures are missing |
| 4 | 512 MiB decompression bomb rejected with peak RSS < 256 MiB | ✅ (deferred absolute) | marginal-RSS assertion passes; absolute 512 MiB test deferred to doc 140 per §12.7 |
| 5 | Every diagnostic in §9 emitted by at least one test, none outside range | ⚠️ | range-check passes; SF0004 lacks a labelled assertion (F-P1-03) |
| 6 | E-007 long-header length semantics correction applied to spec 030 | ✅ | correction applied; T-SWF-003 pins body length excluding the header |

---

## 9. Observations

**O-P1-01.** `packages/swf/package.json` lists `@swf-forge/audio` as a runtime `dependency`. The
container layer does not import audio; `@swf-forge/audio` is pulled in transitively through
`sounds` model code. This is not a layering violation but it does mean a fresh checkout needs a
`build` before vitest can resolve `@swf-forge/audio`'s `dist/` — we hit this exact failure during
the audit when running P1 tests before a build. Adding a note in AGENTS.md or a
`pnpm -r --filter @swf-forge/swf... build` pre-test step would remove the footgun.

**O-P1-02.** `SwfFile.version` duplicates `SwfFile.header.version`. Both are derived from
`input[3]` in `assemble()` and kept in lock-step; no bug, but the dual field is an API note worth
recording in `020 §3 API note`.

**O-P1-03.** The `TAG_PAST_END` path pushes a truncated-payload tag whose `length` is clamped to
`level.limit - bodyOffset` and then breaks. A following sibling level (e.g. after closing a
child sprite) resumes at `level.limit`, which is correct because `pos = level.limit` and the
parent's next iteration uses its own limit. Confirmed by re-reading and by probe; no action
needed.

**O-P1-04.** The standalone `swffuzz` binary / crasher corpus directory remains deferred (WP-020-11
partial). The in-repo 10⁴-mutation fuzz (`fuzz.test.ts`) runs green and is what CI executes;
this observation is carried forward from the archived audits unchanged.

---

## 10. What is deferred (and why)

- The four doc-errata items in `IMPL-020 §12` (1–4): source-of-truth confirmation against the
  full print spec or a third SWF parser is not available from the in-repo material; the code is
  internally consistent.
- The 512 MiB absolute-RSS bomb test (§12.7): CI-flaky at that scale; marginal-RSS assertion
  remains as the in-repo guard.
- The synchronous zlib partial-yield deviation (§12.8): platform limitation, pinned with an
  explicit note; async path delivers R007.
- The ZWS streaming-LZMA deviation (§12.6): input pre-bound is the in-place mitigation; full
  streaming requires a new dependency decision.
- The `swffuzz` CLI tool (WP-020-11): the in-repo `pnpm test:fuzz` job fulfils the CI gate.

---

## 11. Recommended next steps (Resolution audit, to be landed in `P1-AUDIT-RESOLUTION.md`)

1. **F-P1-01** — rewrite `characterRefs` cases 7/34 to use a throwaway cursor and
   `readMatrix`/`readCxformWithAlpha`/filter-skip logic identical to `buttons.ts:decodeButtonRecord`;
   add three labelled fixtures (wide translate, filter-list record, blend-only record);
   assert SF0026 is not spuriously emitted.
2. **F-P1-02/F-P1-03** — add a `T-SWF-001` matrix test (versions 1, 4, 6, 8, 13, 43; frame
   rates 0.01, 12.0, 31.0, 240+; frame size offset/zero cases) and a labelled `SF0004`
   decompressed-longer-than-declared test.
3. **F-P1-05** — resolved by the same fix as F-P1-01 (shared helper); add one v1-button fixture.
4. **F-P1-06** — add a `T-SWF-018` case: with `indexStrategy: 'lazy'`, before access no ordering
   diagnostics are present; after access they are.
5. **O-P1-01** — add a `pretest` script or a note in `AGENTS.md` so vitest runs after
   `pnpm build`; alternatively add vitest path aliases for the stub packages' `src/` (the
   existing `vitest.config.ts` already maps `@swf-forge/swf`, `@swf-forge/gfx`, etc., but not
   `@swf-forge/audio`, which has the simplest barrel).

None of these is a gate blocker on its own; P1 is functional. F-P1-01 is the only finding that
produces a user-visible incorrect report and is worth fixing before a P2/P3/P4 re-read of this
layer.
