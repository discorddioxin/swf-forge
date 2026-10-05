# P1 repeat audit — resolution confirmation

**Date:** 2026-10-05 · **Branch:** `arena/01a10928-swf-forge` · **Auditor:** the same agent,
re-reading the tree as an adversarial reviewer
**Protocol:** `P1-INTEGRITY-AUDIT.md` §8 (ledgers re-run verbatim; a finding is *resolved* only
when its specific evidence flips). **Mapping:** `P1-RESOLUTION-AUDIT.md` §7 (what must flip).
**Inputs:** `P1-INTEGRITY-AUDIT.md` (13 findings + 5 observations), `P1-RESOLUTION-AUDIT.md`
(resolutions R-01…R-13, O-01r…O-05r, decisions D-1…D-5, gate plan G-1…G-7).

## 0. Verdict

**All 13 findings and all 5 observations are resolved** — every specific flip in §7 was verified
against the tree (test runs, probes, doc diffs, tool output below). The full gate is green
tree-wide, including the P5-WIP errors that were blocking it (G-1…G-7 landed). The repeat audit
itself caught **one new defect** the original audit's evidence did not cover — the `nodeInflateAsync`
cap bypass — which was fixed and pinned in this pass (§4). No P1-range finding remains open; the
remaining deferred items are owner-assigned to doc 140 (IMPL-140 budget work) and recorded in
doc 020 §12.

---

## 1. Findings ledger — re-run

### F-01 (major) — End-less sprite range empty → **RESOLVED**

Flip required: probe prints `end > start` for the End-less sprite; the model timeline contains its
tags.

- Code: `tag-stream.ts` — a level closed at its byte limit without an `End` now records
  `end = tags.length` (all tags indexed up to the close) instead of `now` (frozen at entry).
- Evidence (probe re-run, 2026-10-05): sprite 1, declared 2 frames, body `PlaceObject2 +
  ShowFrame`, no `End`:
  ```
  F01 range {"start":1,"end":3,"frameCount":2,"depth":1} start<end: true ops: place
  ```
  The model timeline holds the sprite's tags (`place` op present) — the regression sliced them
  away; `buildSpriteModel` now walks them.
- Tests: `container.test.ts` `T-SWF-002 / F-01` × 2 — non-empty top-level sprite range + model
  timeline; nested End-less sprite (inner range `[2,3)`, outer closed-by-End range untouched).
  Both pass.

### F-02 (moderate) — `inspect --strict` crashes → **RESOLVED**

Flip required: strict CLI on the torn file exits with the failure code, prints diagnostics, no
stack trace.

- Code: `inspect.ts` — the command now owns a `DiagnosticSink` and catches the open: a
  `SwfReadError` prints the accumulated diagnostics plus `inspect: strict mode aborted: …` and
  returns `EXIT.failed` (1); the strict not-a-SWF plain-`Error` path prints the diagnostics and
  returns `EXIT.unreadable` (2) — matching its soft-mode counterpart (previously it fell into
  `runCli`'s `internal error: <stack>` + exit 5; probed verbatim before the fix).
- Evidence (CLI probe re-run):
  ```
  F02 strict exit 1 ===EXIT MATCH
  F02 err:  SF0003  error   @0  unexpected end of file |  SF0013  warning @0  bit read of 5 bit(s)
            at offset 0 past limit 0 | inspect: strict mode aborted: SF0013 @0 (header): …
  F02 stacktrace? false
  ```
- Tests: `inspect.test.ts` `F-02` × 2 (structurally torn CWS → exit 1, diagnostics printed,
  `internal error`/stack-trace absence asserted; non-SWF `--strict` → exit 2, `SF0001` printed,
  no stack). Both pass.

### F-03 (moderate) — LZMA cap checked post-hoc → **RESOLVED**

Flip required: input bound in place **or** the pinned §12 deviation with the risk statement.

- Code: `node/lzma.ts` — compressed input over the cap is refused **before any decode**
  (`refusing to decompress`, `SF0007`); the pure-JS decoder cannot stream, which is the pinned
  deviation.
- Doc: `020-container-tag-stream-dictionary.md` §12 item 6 — pinned deviation with the risk
  statement (small highly-compressible ZWS can still allocate over the cap before rejection;
  deterministic; ZWS pre-Flash-8) and the input pre-bound mitigation; streaming decoder deferred
  to doc 140.
- Test: `container.test.ts` `F-03` — CWS-style bomb with cap 4 → `SF0007` + `refusing to
  decompress`. Passes.

### F-04 (minor) — async cap abort zero-pads → **RESOLVED** (+ new defect found, §4)

Flip required: capped async body length equals the bytes actually produced (no zero tail).

- Code: `container/open.ts` — the `DecompressionStream` pump's cap abort now yields an **empty**
  body + `truncated` (was zero-padded to `total`); `openSwf` emits `SF0007` and assembles nothing.
  The repeat audit additionally found and closed the `nodeInflateAsync` cap bypass (§4) and added
  a container-level guard so **no** inflater can feed an over-cap body.
- Tests: `container.test.ts` `F-04` × 2 — `openSwfAsync` (DecompressionStream) and
  `openSwfNodeAsync` (Node pump): 1 MiB bomb, 256 KiB cap → `SF0007` (error), `body.length ===
  0`, `sizes.decompressed === 0`, zero tags. Both pass.

### F-05 (minor) — sync corrupt-CWS discards partial → **RESOLVED** (pinned deviation, §12 item 8)

Flip required: corrupt CWS yields partial body + `SF0003`, tags a prefix, no throw.

- Executed per the resolution's design, with the sync half landing as the **pinned platform
  deviation** (its own adaptation note, R-05): Node's synchronous zlib throws on every truncated
  prefix (probed across cut points), so no sync partial output exists.
  - Async (`openSwfNodeAsync` → `nodeInflateAsync`): partial decode + `SF0003`, **no rejection**.
    Probe: 90 %-corrupted ~20 KiB CWS → 16 371 partial bytes / 8 186 tags, indexed tags a prefix
    of the intact file's (final tag = the cut, kept truncated), `SF0003` present.
  - Sync (`openSwfNodeSync` → `nodeInflate`): `SF0003` + empty body, no throw. T-SWF-002's
    recovery obligation is unaffected (tag-stream byte-limit handling is independent of
    decompression).
  - Pinned: doc 020 §12 item 8 with the risk statement; CLI verbs remain synchronous by
    construction and report the sync behaviour.
- Tests: `container.test.ts` `F-05` × 3 (async partial + prefix assertion; sync empty + `SF0003`;
  intact async ≡ sync parity). All pass.

### F-06 (minor) — SF0030 folds across tag codes → **RESOLVED**

Flip required: two different long-under-63 tag codes → two `SF0030` entries (per-code contexts).

- Code: `tag-stream.ts` — the `SF0030` emit now carries `{ tagCode, context: "long header
  <code>" }` in its metadata, so the sink dedups per (code, context, characterId) — per tag code,
  not per level.
- Test: `framing.test.ts` `F-06` — two distinct force-long codes → exactly two `SF0030` entries
  with the distinct per-code `context`; a repeat of the same code dedups. Passes.

### F-07 (minor, doc) — R030 contradicts registry → **RESOLVED**

Flip required: R030 text cites SF0160/first-wins + SF0159/later-name.

- Doc diff: `020-container-tag-stream-dictionary.md` R030 now reads "maps to two ids reports
  `SF0160` (warning; … doc 040, R015) and the **first id wins**, deterministically; an id that
  maps to two names reports `SF0159`, and the later name wins" — matching the registry and doc
  040 R015; the code already implemented the corrected rule. Changelog 1.3 records it.

### F-08 (minor) — seven P1 codes untested → **RESOLVED**

Flip required: SF0004 / 0021 / 0022 / 0028 / 0031 / 0101 / 0107 each asserted ≥ 1×.

- Tests: `container.test.ts` `F-08` — one labelled test per code
  (`F-08/SF0004`, `F-08/SF0021`, `F-08/SF0022`, `F-08/SF0028`, `F-08/SF0031`, `F-08/SF0101`,
  `T-SWF-007 (id 0) / F-08/SF0107`). All seven pass; `audit_dev.py` reports none of them
  unemitted/untested.

### F-09 (minor) — T-SWF-001 header matrix missing → **RESOLVED**

Flip required: the labelled matrix (versions / fps / frame sizes / signatures) passes.

- Test: `container.test.ts` `T-SWF-001` — versions 1/4/7/13/43 (with `SF0002` at v1), frame-rate
  edges (raw 0, 0xffff, 61439 → `SF0022`; 12 fps clean), frame-size edges (non-zero Xmin/Ymin →
  `SF0021`, non-positive → `SF0029`), FWS/CWS/ZWS signatures. Passes.

### F-10 (minor) — 62/63 framing boundary unpinned → **RESOLVED**

Flip required: boundary tests (62 short / 63 long / 62 forced-long → SF0030) pass.

- Test: `framing.test.ts` `T-SWF-003 boundary` × 3. Passes.

### F-11 (minor) — T-SWF-007 halves unlabelled → **RESOLVED**

Flip required: id-0 test labelled T-SWF-007; undefined-ref test cross-labelled.

- `container.test.ts:480` — `it('T-SWF-007 (id 0) / F-08/SF0107: a definition tag with character
  id 0 is ignored')`.
- `model.test.ts:73` — `it('T-MOD-601 / T-SWF-007 (referenced-but-undefined): … an undefined
  character is a missing placeholder with SF0110')` — the cross-label on the referenced-but-
  undefined half. Both pass.

### F-12 (minor) — no `--tags`/`--symbols`; names never printed → **RESOLVED**

Flip required: the flags exist; export names appear in the default output; JSON fields.

- Code: `cli.ts` parses `--tags`/`--symbols` (usage text updated); `inspect.ts` — default
  human report prints one line per exported character (`#<id> <name>`); `--symbols` prints the
  export table (id, name, kind) and the import table; `--tags` lists every indexed tag (index,
  code, depth, sprite, offset, length); `--json` carries `exports` always and `symbols`/
  `tagIndex` **only** when requested (default JSON shape unchanged).
- Evidence (CLI probe re-run):
  ```
  F12 default export line:     #2  mySprite
  F12 symbols line:     export  #2  mySprite  (sprite)
  F12 tag index lines: 7
  ```
- Tests: `inspect.test.ts` `F-12` × 3 (default names; `--symbols`+`--tags` sections; JSON
  flag-gating + default stability). All pass.

### F-13 (minor) — bomb + RSS untested → **RESOLVED** (scaled per D-4)

Flip required: bomb test present (`SF0007` + empty body + RSS margin < 256 MiB); full scale
deferred to IMPL-140 with an owner.

- Test: `container.test.ts` `T-SWF-011 (512 MiB bomb / RSS)` × 2 — a 512 MiB-zero bomb
  (deflate ≈ 0.5 MiB) against a 64 MiB cap: sync (`nodeInflate`, `ERR_BUFFER_TOO_LARGE`) and
  async paths → `SF0007`, empty body, and the open's **marginal** RSS (`postOpen − preOpen`)
  under 256 MiB. Passes.
- Doc: §12 item 7 records the deferral of the default-cap full-scale variant (≥ 1 GiB potential
  output; CI memory flakiness) — owner: doc 140.

---

## 2. Observations ledger — re-run

| Obs | Flip required | Evidence | Status |
| --- | --- | --- | --- |
| O-01 | 020 §9 cross-layer note + STATUS.md prose | doc 020 §9 note (SF0128/0129 owned by 030, SF0173/0175 owned by 040, emitted by `tag-stream.ts`); `STATUS.md` L59-60 ("Four further codes are **emitted by the container**… but **allocated to other documents**") | **RESOLVED** |
| O-02 | checker silent on SF0025/0026/0027 | the three `DEFERRED_DIAGNOSTIC_WPS` entries removed; `audit_dev.py` run: **0** `ownership.stale` | **RESOLVED** |
| O-03 | roadmap L213 cites the real codes | L213 now reads `new diagnostics SF0024–SF0026, SF0032 (020 §9)` | **RESOLVED** |
| O-04 | corpus dir + ≥ 1 seed + non-vacuous assertion | **executed in this pass** (missed by the batch plan — see §4.2): `packages/swf/test/fuzz/corpus/` created with `README.md` (naming convention + provenance) and seed `0001-seed-mutation.swf` (LCG `SEED = 0x534F_5746`, mutation index 1, 59 bytes, trips `SF0023`+`SF0101`+`SF0173`); `fuzz.test.ts` now asserts `files.length ≥ 1` — the regression suite fails on an empty corpus instead of passing vacuously. Suite passes (2/2). | **RESOLVED** |
| O-05 | §3 note block (6 items) + §2 note + changelog | doc 020 §3 API note extended with the six surface deviations (stream-relative `TagRef.offset`, `headerOffset`/`longHeader`, `frameCounts`/`spriteRanges.depth`, `SwfFile.sink`, `SwfOpenOptions` extras, consolidated module layout); changelog 1.3 records it | **RESOLVED** |

---

## 3. Gate — re-run (2026-10-05, this pass)

| Check | Before the resolution pass | After |
| --- | --- | --- |
| `pnpm typecheck` (tree-wide, incl. test tsconfigs) | 18 errors — all P5 WIP (7 `inspect.ts`, 5 `analyze.ts`, 6 `disassemble.ts`) | **green** (G-1…G-7 landed: `analyze.ts` merge guard, `disassemble.ts` `formatOperand`/`waitForFrame2`/`getURL`/`formatCall` + `ir.ts` union, `inspect.ts` `G-5` restructure, residual lint) |
| `pnpm lint` (eslint + prettier) | 3 expected eslint problems in `inspect.ts` | **green** |
| `pnpm test` (vitest) | 208 / 208 (25 files) | **238 / 238 (25 files)** — +30 new labelled tests (F-01 ×2, F-02 ×2, F-03, F-04 ×2, F-05 ×3, F-06, F-08 ×7, F-12 ×3, T-SWF-001 ×4, T-SWF-003 ×3, T-SWF-011 bomb ×2) |
| `packages/swf` standalone `tsc --noEmit` | clean | **clean** |
| `python3 tools/audit_dev.py` | 3 `ownership.stale` (P1) + 56 P3/P5-range "new" | `findings=81 known=81 new=0 fixed=0` — **zero `ownership.stale`, zero new**; shape4 probe 5/5; dump synth clean fixture diagnostic-free. Baseline re-recorded via `--update-baseline` (81 keys; all P3/P5-range) |

The gate defined in `P1-RESOLUTION-AUDIT.md` §6 — `pnpm typecheck && pnpm lint && pnpm test`
green tree-wide, no P1-range `ownership.stale`, swf standalone clean, 208+ tests (≥ 15 new
labelled) — **passes**.

---

## 4. New items found by the repeat audit

### 4.1 `nodeInflateAsync` cap bypass (fixed + pinned in this pass)

The original F-04 test exercised `openSwfAsync` (the platform `DecompressionStream` pump), not
`openSwfNodeAsync`. Probing the Node path showed `createInflate({ maxOutputLength })` does
**not** error when the limit is exceeded on Node 22 (it keeps emitting to `end`): a 1 MiB bomb
passed a 256 KiB cap with the full body and **no** `SF0007`. Fixed: the pump now counts its
output and aborts at the cap (D-1 shape), and `openSwf` gained a container-level guard — any
inflater result longer than the cap is refused with `SF0007` and an empty body, so the cap
contract holds at the container boundary regardless of inflater behaviour. New `F-04` test case
pins the Node path. Recorded as an execution note on R-04 in `P1-RESOLUTION-AUDIT.md`.

### 4.2 O-04r was not in the execution plan (fixed in this pass)

The batch plan in `P1-RESOLUTION-AUDIT.md` §6 assigned R-07/O-01r/O-02r/O-03r/O-05r to Batch 1 —
**O-04r was missing from every batch**, so the corpus fix never ran. Executed now: seed corpus
file + README + non-vacuous assertion (§2, O-04). The fuzz suite and the corpus live in
`packages/swf/test/fuzz/`.

### 4.3 Gate-measurement correction

An earlier pass measured "tree-wide tsc" with a bare `tsc --noEmit` against the root
`tsconfig.json`, which holds only project references (`"files": []`) and therefore checked
nothing — the P5-WIP errors were not actually cleared by Batch 2. The authoritative check is
`pnpm typecheck` (`tsc -b --force` + the four test tsconfigs), which is now green for real
(§3). No P1 behaviour was affected; this is a measurement note.

---

## 5. Remaining (deferred, owner-assigned) items

All deferrals are recorded with owners in doc 020 §12 — none is ownerless:

1. §12 items 1–5 — chapter-text confirmations pending the missing Ch.2 sections (errata E-006);
   low-risk pins already in place (advisory ZWS length, five ordering checks, etc.).
2. §12 item 6 — streaming LZMA decoder (new-dependency decision) → **doc 140**.
3. §12 item 7 — T-SWF-011 default-cap full-scale variant (≥ 1 GiB) → **doc 140** (CI memory
   budget work).
4. P3/P5-range codes in the `audits/dev` baseline (81 entries: buttons, AVM1) — out of P1
   scope, accepted for the time being; the checker re-checks them every run.

## 6. Disposition

- **P1 is closed.** All 13 findings and 5 observations resolved on their specific flips; the
  gate is green tree-wide; the two repeat-audit discoveries were fixed and pinned in the same
  pass.
- After this file is written, `P1-INTEGRITY-AUDIT.md` and `P1-RESOLUTION-AUDIT.md` move to
  `audits/archive/` (protocol §8.3). `audits/dev/baseline.json` was re-recorded in this pass.
