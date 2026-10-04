# Conformance record — what was checked, what passed, what is not yet due

Companion to `01-findings.md`. This file exists so the audit is falsifiable in both directions: it
records the checks that **passed** (§1) with the same rigour as the findings, the registry codes that are
not yet reachable and who owns them (§2), the documents that no code claims yet (§3), the SWF
Specification 19 cross-checks made during the audit (§4) and the traceability numbers (§5).

## 1. Checks that passed

Each row was verified by reading the cited code against the cited rule. "✓" means the code is conformant
as written; no change is requested for any row in this table.

| # | Rule / requirement | Evidence | Result |
| --- | --- | --- | --- |
| 1 | `IMPL-010-R007` `bits === 0` returns `0` without moving the cursor | `io/cursor.ts` `ub()` first branch | ✓ |
| 2 | `IMPL-010-R013` `EncodedU32` uses `>>> 0` and accepts a 4-bit fifth byte | `io/integers.ts` | ✓ |
| 3 | `IMPL-010-R016` `sb(32)` special-cases `2**32` (not `1 << 32`) | `io/cursor.ts` | ✓ |
| 4 | `IMPL-010-R017` `fb(n)` is signed-then-scaled arithmetic | `io/bits.ts`; probe: `0x30000 @ 19 → 3.0` | ✓ |
| 5 | `IMPL-010-R019` `-0` and canonical `NaN`, with `SF0015` | `io/real.ts` | ✓ |
| 6 | `IMPL-010-R020` no `Math.fround` in the float path | `io/real.ts` | ✓ |
| 7 | `IMPL-010-R021`/`R024` string termination and the 64 KiB cap | `io/strings.ts`; `STRING_TRUNCATED` | ✓ |
| 8 | `IMPL-010-R042` duplicate-string dedupe in the string table | `io/strings.ts` | ✓ |
| 9 | `IMPL-020-R012` `FrameRate` stored raw, derived `raw / 256`, `SF0022` outside the plausible band | `container/header.ts:94-122` — the code compares the derived fps against `240`, which is exactly the doc's `> 240×256` raw test | ✓ |
| 10 | `IMPL-020-R017` long-header-used-for-a-short-body → `SF0030` | `container/tag-stream.ts` | ✓ |
| 11 | `IMPL-020-R019` body past end of stream → `SF0101`, last tag kept | `container/tag-stream.ts` | ✓ |
| 12 | `IMPL-020-R020` missing `End` → `SF0102`; trailing bytes → `SF0024` | `container/tag-stream.ts` | ✓ |
| 13 | `IMPL-020-R022` the tag slice excludes `End` | `container/tag-stream.ts` | ✓ |
| 14 | `IMPL-020-R023` sprite nesting depth cap of 32, sub-stream abandoned with `SF0103` | `container/tag-stream.ts` | ✓ |
| 15 | `IMPL-020-R024` declared vs observed `ShowFrame` count → `SF0023` (main timeline) | `model/movie.ts:291`, `T-MOD` model tests | ✓ (sprite path is F-13) |
| 16 | `IMPL-020-R027` character id `0` not registered, `SF0107` | `container/tag-stream.ts` | ✓ |
| 17 | `IMPL-020-R031` `maxDictionaryEntries` counted in registered definitions, `SF0031` | `container/tag-stream.ts` | ✓ |
| 18 | `IMPL-020-R036` `sha256`/`fnv1a64` id policy | `node/hash.ts`, `model/movie.ts` | ✓ |
| 19 | `IMPL-020-R035` `SwfFile` exposes sizes and version for reports | `container/open.ts:113-118` | ✓ |
| 20 | `IMPL-020` §3 sprite ranges and per-sprite tag slices | `TagIndex.spriteRanges` | ✓ |
| 21 | `IMPL-030-R003` version dispatch by tag code, never by declared version | `tags/shape.ts:546` | ✓ (colour follows the tag) |
| 22 | `IMPL-060-R008` style arrays stored 1-based with `styles[0] = null` | `tags/shape.ts:194-200` | ✓ |
| 23 | `IMPL-060-R014` `StateNewStyles` diagnostic split: v1 → `SF0184`, Shape4 → `SF0191` | `tags/shape.ts:400-407` | ✓ |
| 24 | `IMPL-060-R016`–`R022` rule-band aliasing for `SF0192`–`SF0195` gradient cases | `tags/shape.ts` | ✓ |
| 25 | `IMPL-060-R030` shape record state machine closes runs over one `Edge` list, `flushAll` at MoveTo/End/StateNewStyles | `tags/shape.ts` + `test/shape-runs.test.ts` (F-05 of the earlier slice, fixed in `257d99f`) | ✓ |
| 26 | `IMPL-060` §8 `SF0186` unclosed run / `SF0187` bounds > 1 % / `SF0189` unused style | `tags/shape.ts`; tests | ✓ |
| 27 | `IMPL-060` §8 `SF0192`–`SF0195` gradient mode/ramp/focal diagnostics | `tags/shape.ts` | ✓ |
| 28 | `IMPL-060` 1e6 edge guard | `tags/shape.ts` | ✓ |
| 29 | `IMPL-040-R035` `Metadata` ⇔ `FileAttributes.HasMetadata` biconditional | `model/movie.ts:200-206` | ✓ |
| 30 | doc 040 §8 `SF0163`/`SF0164`/`SF0167`/`SF0168`/`SF0169` | `model/movie.ts`, `tags/control.ts` | ✓ |
| 31 | doc 030 §8 `SF0162`, `SF0165`, `SF0170` (with the dead `> 65535` branch noted as minor in the slice notes) | `tags/control.ts` | ✓ |
| 32 | Frame-label and scene frame indices share one zero-based frame space | `model/movie.ts:190-195` (`frame` counter) vs `model/timeline.ts:113-127` (`at = frames.length`) — both count preceding `ShowFrame`s at the same tag position | ✓ (this was on the audit's suspicion list; the two indexes are consistent) |
| 33 | `GFX` fill-rule key is driven by the model's `fillRule` | `packages/gfx/src/render/renderer.ts` (`nonzero` iff `nonZero`) | ✓ (blocked upstream by F-01) |
| 34 | Analytic AA coverage within the `GFX-§13.4` budget | probe: max 0.5/255, RMS 0.09/255 vs ≤ 3/255 | ✓ |
| 35 | Degenerate geometry dropped before tessellation | `packages/gfx/src/vector/geometry.ts` | ✓ |
| 36 | `TECH-R010` determinism: no `Date`/`Math.random`/absolute paths in emitted output | `dump` byte-identical across runs (`--json` vs `--out`, 2902 B) | ✓ |
| 37 | `TECH-R029` gate order: no component started before its phase | `apps/` contains only `decompiler`; roadmap §2.2 matches | ✓ |
| 38 | `ARCH-R001` no player mode / no AVM2 execution surface in `gfx` or `swf` | import rules in `eslint.config.js` + source scan | ✓ |
| 39 | Diagnostics sink folds repeats by `(code, context, characterId)` with a count | `diagnostics/sink.ts:5-30` | ✓ |
| 40 | `SF0186` alone for an unclosed fill, `SF0189` only for unused styles | `test/shape-runs.test.ts` fixtures | ✓ |

## 2. Registry codes that are never emitted or matched

Scan: every `codes.ts` key, searched across `packages/**` and `apps/**` excluding `codes.ts` itself.
An "owning WP" of `—` means the code is not reachable from any implemented or scheduled work item.

| Code | Severity | Meaning (registry) | Owning work item | Reachable today? |
| --- | --- | --- | --- | --- |
| `SF0006` | error | `ZWS` present but no LZMA decoder available | WP-020-03 | **yes — wrong code emitted (F-03)** |
| `SF0025` | warning | `FileAttributes` not first (SWF ≥ 8) | WP-020-08 | no (`ordering.ts` absent) |
| `SF0026` | warning | tag ordering violation (definition after use) | WP-020-08 | no |
| `SF0027` | warning | `ZWS` `compressedLength` disagrees with the bytes present | WP-020-03 | no (no `ZWS` path) |
| `SF0110` | warning | undefined character reference | WP-020-07 | **yes — no placeholder (F-07)** |
| `SF0111` | warning | inverted/degenerate `RECT` while assembling bounds | doc 030 bounds (WP-030) | no |
| `SF0115` | warning | filter/matrix block out of range | doc 030 filters (WP-030) | no |
| `SF0118` | warning | `CLIPACTIONRECORD` declared size disagrees with its content | doc 030 clip actions (WP-030) | no |
| `SF0119` | warning | `CLIPACTIONRECORD` type/flags invalid | doc 030 clip actions | no |
| `SF0121` | warning | clip-event key code outside its mask width | doc 030 clip actions | no |
| `SF0122` | warning | clip-action key code exceeds the documented range | doc 030 clip actions | no |
| `SF0125` | warning | filter count/kind invalid | doc 030 filters | no |
| `SF0127` | warning | filter parameter outside the documented range | doc 030 filters | no |
| `SF0166` | info | `SetTabIndex` at a depth with no character | WP-040-08 | **yes — check missing (F-16)** |
| `SF0183` | info | shape tag newer than the declared SWF version | WP-060-01 | **yes — check missing (F-09)** |
| `SF0185` | info | shape subpath with no edges (dropped) | WP-060-06/08 | **yes — drop not reported (F-09)** |
| `SF1000` | error | AVM2 content (DoABC / ActionScript3 flag) | WP-040-06 | no (decoder-side trigger absent; the CLI mapper already exits 3 for it) |

Twelve of the seventeen are candidates for the "not yet due" category and are owned; five are reachable
in shipped code and are filed as findings (F-03, F-07, F-09, F-16). The distinction matters for the
roadmap: the five should not wait for their WP.

## 3. Documents with no implemented code yet

Listed so a reader does not mistake roadmap for defect. None of these produced a finding beyond the ones
already in the index.

| Document | Status in code |
| --- | --- |
| `impl/decompiler/070` (bitmaps, text, fonts) | not started; `Shape4` bitmap fills decoded as styles only |
| `impl/decompiler/080` (sounds, video) | not started |
| `impl/decompiler/090` (framing/streaming) | not started |
| `impl/decompiler/100` (buttons) | not started; `SF0110` shared with doc 030 applies (F-07) |
| `impl/decompiler/110` (fonts/text edges) | not started |
| `impl/transpiler/050`, `/120` | not started (`apps/transpiler` absent — roadmap-correct) |
| `impl/engine-flash/130` | not started |
| `impl/harness/140` | not started |
| `impl/code-inspector/150` | not started (model dump exists as its substrate, `INS-D03`) |
| `impl/engine-clean/160` | not started |
| `impl/foundation/010` §10, `020` §7 | partially: the numeric test file and `ordering.ts` are missing (F-18, O-01) |

## 4. SWF Specification 19 cross-checks made during this audit

The audit revisited the chapter text only where an impl doc's own wording was ambiguous; in every case the
impl doc was found to agree with the chapter.

| Chapter text | Re-read because | Outcome |
| --- | --- | --- |
| Ch.6 `DefineShape4` field table (`Reserved UB[5]`, `UsesFillWindingRule UB[1]`, `UsesNonScalingStrokes UB[1]`, `UsesScalingStrokes UB[1]`) | The code's bit offsets were under suspicion | Confirms F-01: the offsets are MSB-first as the impl doc implies; corroborated by `ruffle` `types.rs:655-658` |
| Ch.6 `FILLSTYLEARRAY`/`LINESTYLEARRAY` pseudo-code (`if FillStyleCount == 0xFF: // DefineShape2 and DefineShape3/4 only`) | F-02 | Confirms `IMPL-060-R006`: no `UI16` for v1 |
| Ch.6 `DefineShape4` "Minimum file format version is SWF 8" / `UsesFillWindingRule` "Minimum … SWF 10" | F-09 (`SF0183`) | Confirms `IMPL-060-R005` |
| Ch.2 dictionary rules (duplicates not allowed) | F-04 | The chapter is silent on real-world duplicates, which is why `R028` exists; no change to the finding |

The remaining chapters were not re-extracted: `docs/specs` and `docs/impl` are the encoded copy of
Ch.1–15 and Appendices A–C, and the audit treated them as normative.

## 5. Traceability numbers (as measured at `a76f2ea`)

| Metric | Value | Note |
| --- | --- | --- |
| Registry codes defined | 87 | `diagnostics/codes.ts` |
| Registry codes referenced outside `codes.ts` | 70 | §2 lists the 17 that are not |
| Codes cited anywhere in `docs/**` | 316 | the remainder are later-document codes |
| Rule ids defined (`IMPL-NNN-Rnnn`, docs only) | ~500 across 16 documents | per-document counts: transpiler/050 63, decompiler/060 52, 040 48, foundation/010 42, 080 44, 020 37, 070 35, 030 34, 090 33, engine-flash/130 32, engine-clean/160 29, decompiler/110 29, 100 26, transpiler/120 24, harness/140 21, code-inspector/150 21 |
| Test ids defined (`T-XXX-nnn`, docs only) | 382 | |
| Test ids cited in code or tests | 10 | `T-GFX-001/002/015`, `T-TST-101`, `T-MOD-021/037/038/039/040`, `T-SWF-003` |
| Automated tests executed at HEAD | 56 across 9 files | `pnpm test` |
| Source lines under `packages`/`apps` | ~8 000 | plus ~900 test lines |

Method notes worth keeping:

- `codes.ts` registry rows wrap across lines for long meanings; parse `\bSF(\d{4}): \{ … \}` blocks
  rather than the `^ *NAME: 'SF\d{4}'` shape, and exclude `codes.ts` from "is it referenced" scans or all
  87 codes look used.
- `tools/verify_docs.py` scans `docs/**`, the root `README.md` and `TECH-SPEC.md` only, so a green doc
  gate is not evidence about code (O-03). It also carries the deliberate two-entry historical allowlist
  `{T-MOD-201, T-RT-020}`.
- The doc-verifier's own traps were avoided: changelog rows ascend, header `Draft X.Y` matches the last
  row, and no document cites another document's rule id (this audit cites `DOC-§n` style references for
  that reason).
