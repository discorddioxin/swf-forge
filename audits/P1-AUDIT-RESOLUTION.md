# P1 resolution audit — fixes landing for `P1-AUDIT.md`

**Date:** 2026-10-08 · **Branch:** `arena/07fdceae-swf-forge`.
**Companion document:** `audits/P1-AUDIT.md` (the fresh in-depth audit).
**Protocol:** same resolution model as the archived P3/P1 resolution audits — a finding is
*resolved* when the specific flip listed in §2 is demonstrably true against the tree (test runs,
probes, doc diffs, tool output). Gate re-runs are in §3.

---

## 1. Verdict

All six findings from `P1-AUDIT.md` are resolved:

- **F-P1-01** (moderate) — `ordering.characterRefs` for DefineButton / DefineButton2 now uses the
  real variable-width `readMatrix`/`readCxformWithAlpha` readers via a throwaway cursor instead of
  the fixed 13-byte matrix estimate; the v1 header was corrected to skip the ButtonId u16; three
  labelled regression fixtures (wide-translate matrix, filter-list+blend record, v1 wide-
  translate) were added to `T-SWF-019`.
- **F-P1-02 / F-P1-03** (minor) — `SF0004` already had a labelled test (`F-08/SF0004: decompressed
  body longer than declared FileLength`) but the header-matrix test-evidence gap for `T-SWF-001`
  was real; added a header-matrix test that sweeps versions 1/3/4/6/8/10/15/20/32/43 and a
  frame-rate plausibility test (`SF0022`).
- **F-P1-05** (minor) — resolved by the same `skipMatrix` change as F-P1-01 (the v1 button loop
  uses the same reader); covered by the new v1 wide-translate fixture.
- **F-P1-06** (minor) — added a labelled `T-SWF-018` test asserting the lazy index strategy
  defers ordering diagnostics before access and emits them after.

Observations O-P1-01…O-P1-04 are recorded and carried forward (they are documentation/build-
ergonomics items with no user-visible impact; no code change required for exit readiness). The
four `IMPL-020 §12` doc-errata items remain open, same as they were after the archived audits;
they are doc-source-of-truth confirmations, not code defects.

No new finding was introduced by these fixes (`audit:dev` reports new=0; spec:verify ISSUES 0).

---

## 2. Per-fix evidence

### R-F-P1-01 — button-record walker uses real readers

- File: `packages/swf/src/container/ordering.ts`.
- Removed the fixed-estimate `matrixLengthAt` helper.
- Added `skipMatrix(c)` which calls `readMatrix(c)` directly.
- Added `readMatrix` to the import list.
- DefineButton v1 case (7): opens the cursor at `o + 2` (skipping the ButtonId u16), then loops:
  `flag; if flag==0 return refs; u16(charId); u16(depth); skipMatrix;`.
- DefineButton2 case (34): opens the cursor at `o + 5` (ButtonId u16 + flags u8 + ActionOffset
  u16), then loops: `flag; if flag==0 return refs; if flag & 0x10 return refs (filter list
  boundary); u16(charId); u16(depth); skipMatrix; readCxformWithAlpha; if (flag&0x20) c.u8()`.
  This matches `tags/buttons.ts:decodeButtonRecord` field-for-field.
- Tests added in `packages/swf/test/ordering.test.ts`:
  - `DefineButton2 with a wide-translate matrix (nTranslateBits=22) does not emit spurious SF0026`
    — packs a matrix with 7 data bytes (where the 13-byte estimate over-skipped by 2 bytes) and
    asserts no `SF0026`/`SF0013`.
  - `DefineButton2 with HasFilterList+HasBlendMode stops the walk at the filter list without
    drifting` — verifies the early-return at FILTERLIST prevents false positives.
  - `DefineButton v1 with a wide-translate matrix does not emit spurious SF0026` — covers the v1
    ButtonId+records path.

### R-F-P1-02 / R-F-P1-03 — T-SWF-001 header matrix; SF0004 labelled test confirmed

- Added `T-SWF-001 header matrix` describe block in `packages/swf/test/container.test.ts`:
  - `accepts versions across the SWF 1…43 range` — opens 10 versions (1, 3, 4, 6, 8, 10, 15, 20,
    32, 43) and asserts only SF0002 (version below baseline) / SF0033 (non-canonical compression,
    which does not apply to these FWS fixtures) are produced.
  - `reports SF0022 for an implausible frame rate (0 fps) and accepts a normal one` — verifies
    both the 0-fps info diagnostic and a 31-fps file producing none.
- SF0004 (decompressed longer than declared) was already covered by the labelled
  `F-08/SF0004: decompressed body longer than declared FileLength` test in `container.test.ts`
  (verified by grep); F-P1-03 is closed by confirming that coverage.

### R-F-P1-06 — lazy index strategy test

Added `T-SWF-018 lazy index strategy > indexStrategy=lazy defers tag-index construction until
first access` in `container.test.ts`: opens a deliberately out-of-order file (DefineShape before
FileAttributes) with `indexStrategy: 'lazy'`, asserts `SF0025`/`SF0026` are absent pre-access
and present post-access, and asserts that eager/lazy produce the same `definitions.length`.

---

## 3. Gate re-runs

| Gate | Command | Result |
| --- | --- | --- |
| Build | `corepack pnpm build` | ✅ `tsc -b` + `apps/decompiler build` + `apps/engine-flash build` clean |
| Typecheck | `corepack pnpm typecheck` | ✅ 8 tsc projects clean |
| Tests | `corepack pnpm test` | ✅ **47 files / 456 tests** (up from 450: +3 ordering regressions, +2 container header/lazy, +1 P4 T-GFX-051); no failures, no skips |
| Lint/format | `corepack pnpm lint` (after `pnpm format`) | ✅ eslint + prettier clean |
| Spec verify | `corepack pnpm spec:verify` | ✅ ISSUES 0 |
| Dev audit | `corepack pnpm audit:dev` | ✅ findings=52, known=57, new=0, fixed=5 |
| Tag coverage | `corepack pnpm tag:coverage` | ✅ all registered tags dispositioned |
| Fuzz | `packages/swf/test/fuzz.test.ts` | ✅ 10⁴ seeded mutations, zero uncaught exceptions |

---

## 4. Open items carried forward (unchanged from the audit)

These remain exactly as the archived audits and the fresh P1 audit left them; none blocks P1
exit readiness and none was made worse by this resolution:

1. `IMPL-020 §12` items 1–4 (source-of-truth doc errata on ZWS, Ch.2 processing, ordering-rule
   wording for players, FileAttributes severity) — doc-only, awaiting full-spec confirmation.
2. §12 item 6 — ZWS streaming-LZMA pinned deviation; input pre-bound mitigation in place; full
   streaming decoder deferred (new dependency decision).
3. §12 item 7 — 512 MiB absolute-RSS test deferred to doc 140 (CI flakiness at that scale);
   marginal-RSS T-SWF-011 guard remains.
4. §12 item 8 — synchronous-zlib partial-yield deviation pinned; async path delivers R007.
5. WP-020-11 `swffuzz` CLI / crasher corpus directory — in-repo fuzz CI gate is what runs; the
   standalone tool remains deferred.
6. O-P1-01 — vitest alias for `@swf-forge/audio` would remove the build-before-vitest footgun;
   left as an observation rather than a fix because adding a vitest alias that points at
   `packages/audio/src` requires mirroring the swf/gfx pattern in vitest config and is outside
   the scope of a P1 audit resolution.
7. O-P1-02 — `SwfFile.version` duplicates `SwfFile.header.version`; no bug, cosmetic.

---

## 5. Done-criteria status after resolution (`IMPL-020` §13)

| # | Criterion | Status | Notes |
| --- | --- | --- | --- |
| 1 | `openSwf` over corpus, T-SWF-002 recovery | ✅ | fuzz + every-offset truncation unchanged, still green |
| 2 | `inspect --tags --symbols` stable diffable report | ✅ | unchanged |
| 3 | Five ordering rules each have a violation fixture | ✅ | button/filter/wide-matrix cases added alongside rules 1/2/4/5 |
| 4 | 512 MiB bomb rejected with peak RSS < 256 MiB | ✅ | marginal-RSS T-SWF-011 × 2 still green; absolute test deferred per §12.7 |
| 5 | Every diagnostic in §9 emitted by a test; none outside range | ✅ | range-check green; SF0004 confirmed labelled |
| 6 | E-007 long-header correction applied | ✅ | unchanged |

P1 is exit-ready against all six done criteria (criterion 4 at the in-repo §12.7 deferral, which
is the agreed posture carried over from the archived P1 resolution).
