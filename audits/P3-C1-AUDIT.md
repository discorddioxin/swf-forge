# P3 Checkpoint C1 — Wire/tag foundation sweep

Auditor: Arena.ai Agent Mode
Branch: `arena/07fdceae-swf-forge`
Baseline: `c5f76bc` (C0 snapshot)
Scope: close **F-P3-01** (six font/text auxiliary tags with no decoder) and **F-P3-02** (JPEGTables not modelled), per `audits/P3-CHECKPOINTS.md` C1 and `docs/impl/decompiler/080-fonts-and-text.md` §4–§5, §8.

## 1. Verdict

C1 is **complete**. All seven tags identified in the C0 wire-coverage matrix as "classified by kind but no decoder" now have a production decoder, a model-side resolve pass, and a labelled regression test. Tag disposition moved **50 decoded / 7 pending → 56 decoded / 1 pending**; the only remaining pending tag is `DefineVideoStream` (60), which is P11 and out of phase.

## 2. What landed

### 2.1 New decoders (`packages/swf/src/tags/fonts.ts`, 169 → 493 lines)

| Tag | Code | Function | Rules implemented |
|---|---|---|---|
| `DefineFont` | 10 | `decodeDefineFontV1` | IMPL-080-R008: glyph count inferred from `OffsetTable[0] / 2`; offsets are distances from the start of the offset table; a count that disagrees with the shapes actually present reports `SF0271` and keeps the font usable |
| `DefineFontInfo` | 13 | `decodeFontInfo` | IMPL-080-R016 flags byte (MSB-first), R017 UTF-8 name, R018 `FontNameLen` counts bytes and the name is not NUL-terminated, R019 indirect-name detection (`SF0284`) |
| `DefineFontInfo2` | 62 | `decodeFontInfo` | As above plus trailing `LanguageCode`; `WideCodes` is **forced** and `SF0283` (error) is reported when the flag is clear, so a self-contradictory file cannot desynchronise the code table |
| `DefineFontAlignZones` | 73 | `decodeFontAlignZones` | IMPL-080-R035 `ZONERECORD` = `NumZoneData UI8` + `ZONEDATA[n]{FLOAT16, FLOAT16}` + flags byte (`Reserved UB[6]`, `ZoneMaskY`, `ZoneMaskX`); records are read verbatim and never used to snap glyphs |
| `CSMTextSettings` | 74 | `decodeCsmTextSettings`, `csmCutoffs` | IMPL-080-R036: raw `UseFlashType`/`GridFit`/`Thickness F32`/`Sharpness F32` retained; cutoffs derived with the chapter's formulas, implementing errata **E-017** (formulas win over the contradictory prose) |
| `DefineFontName` | 88 | `decodeFontName` | IMPL-080-R020/R039: both strings captured verbatim for the licensing report; metadata only, never affects the decoded font |

Plus `applyFontInfo(font, info, emit?)` — merges a `DefineFontInfo`/`Info2` code table onto a v1/v2/v3 font, promoting a v1 model (which has no codes at all) into a resolved `DefineFontModel`.

### 2.2 Model wiring (`packages/swf/src/model/movie.ts`)

A **pre-pass** over top-level tags collects the auxiliary tags keyed by target id *before* characters are built, then the character pass reconciles them. This is required by IMPL-080-R037: a modifier tag may legally precede the tag it modifies, so a one-pass reader must resolve at end-of-parse.

New `CharacterModel` fields: `fontV1`, `fontInfo`, `fontAlignZones`, `fontName`, `csmTextSettings`.
New `MovieControlModel` field: `jpegTables`.

### 2.3 JPEGTables surfaced on the model (F-P3-02)

`collectControl` now captures the first `JPEGTables` (8) payload onto `control.jpegTables` and reports `SF0257` once when several exist. `apps/decompiler/src/assets/dump.ts` previously re-scanned the whole tag index to find the table; it now reads the model field, so bitmap decoding inside `buildMovieModel` can see the shared table without a second pass.

### 2.4 Glyph `code` became nullable

`FontGlyphModel.code` is now `number | null`. A `DefineFont` v1 glyph genuinely has no character code until a `DefineFontInfo` supplies one — modelling that as `0` would have silently mapped every v1 glyph to `U+0000`. Call sites updated: `recoverStaticTextCodes` skips unmapped glyphs (they report `SF0273`), `packages/assets/src/fonts.ts` leaves them out of the WOFF2 `cmap`, and `font-atlas.ts` assigns a private-use synthetic code so the glyph still gets an atlas slot without being exposed as text.

## 3. Diagnostics moved from deferred to live

| Code | Severity | Was | Now |
|---|---|---|---|
| `SF0277` FONT_HINTING_IGNORED | info | deferred → WP-080-09 | emitted once per `DefineFont3` carrying align zones |
| `SF0278` FONT_HINT_TARGET_INVALID | warning | deferred → WP-080-09 | emitted for zones on a non-v3 target, CSM on a non-text target, and (de-duplicated by id) for either tag naming an undefined character |
| `SF0283` FONT_INFO2_WIDE_CODES_MISSING | **error** | deferred → WP-080-03 | emitted when `DefineFontInfo2` has `WideCodes` clear |
| `SF0284` FONT_INDIRECT_NAME | info | deferred → WP-080-03 | emitted for `_sans` / `_serif` / `_typewriter` / `_ゴシック` / `_明朝` / `_等幅` |

`SF0283` was additionally emitted at the wrong severity (`warning`); the registry says `error` and `audit:dev`'s callsite check caught it. Fixed.

**Remaining deferred P3 codes: 11 → 7.**

| Code | WP | Owner |
|---|---|---|
| SF0262, SF0263 | WP-070-12 | C3 morph IR |
| SF0272, SF0273 | WP-080-07 | C4 static text |
| SF0281 | WP-080-01 | C4 glyph mandatory-fill quarantine |
| SF0279 | WP-080-12 | **P9** (HTML parser — stays deferred) |
| SF0329 | WP-090-12 | **P6** (transcode ledger — stays deferred) |

> Correction made during C1: the length-mismatch case between a `FontInfo` code table and the glyph table was initially given `SF0281`, whose registry meaning is *"glyph shape violates its mandatory fill style and was quarantined"*. That is a different defect (IMPL-080-R009, C4 work). The conflict case is now `SF0276` — *"font code table is unsorted **or conflicts with DefineFontInfo**"* — which is exactly what the registry describes. `SF0281` stays deferred to C4.

## 4. Tests added — `packages/swf/test/font-aux-tags.test.ts` (14 tests)

| Test | Obligation |
|---|---|
| infers v1 glyph count from the offset table, decodes 3 glyphs, codes stay null | **T-MOD-506** |
| `DefineFontInfo` supplies the v1 code map/name/flags; pre-resolve v1 view retained | **T-MOD-506 / T-MOD-518** |
| narrow vs wide codes, ANSI vs Shift-JIS, Info2 `LanguageCode`, multi-byte UTF-8 name | **T-MOD-502** |
| Info2 with `WideCodes` clear reports `SF0283` and still reads UI16 | SF0283 |
| `_sans`/`_serif`/`_typewriter` report `SF0284`; an ordinary family name does not | **T-MOD-518** |
| device-only font (`NumGlyphs = 0`) omits every per-glyph table, never indexes it | **T-MOD-517** |
| align zones: `NumZoneData = 2`, both masks, FLOAT16 decode, `SF0277` note | **T-MOD-515** |
| align zones on a non-v3 target → `SF0278`, no `SF0277` | **T-MOD-515** |
| auxiliary tags naming undefined characters → two `SF0278`, de-duplicated by id | IMPL-080-R037 |
| CSM raw floats retained; cutoffs match the formulas, `outside − inside == sharpness·size` | **T-MOD-515 / E-017** |
| `DefineFontName` captures both strings verbatim and never changes the font; absence is normal | **T-MOD-511 / R020 / R039** |
| JPEGTables surfaced on `control.jpegTables` | F-P3-02 |
| multiple JPEGTables → one `SF0257`, first wins | SF0257 |
| no JPEGTables → `null` | F-P3-02 |

## 5. Tooling self-test repairs

`tools/test_tag_coverage.py` and `tools/test_audit_dev.py` both asserted the *pre-C1* world and had to be updated:

- `test_p3_decoder_progress_is_not_reported_as_pending` asserted the six C1 tags were still `pending:080`; inverted to assert `decoded` so they cannot regress. Added `test_only_out_of_phase_tags_remain_pending` pinning the pending set to exactly `["DefineVideoStream"]`.
- `test_pending_p3_diagnostics_are_owned_by_their_decoder_or_runtime_work_package` updated to the post-C1 deferred set, and tightened from a subset check to an exact-equality check on the whole map, with a one-line owner comment per code.
- `test_deferred_mapping_becomes_stale_when_the_code_is_emitted` **was already failing before C1** — it hard-coded `SF0111`, which P2 made live and removed from the deferred map, so the synthetic "stale" scenario could never fire. Rewritten to pull a genuinely-deferred code out of the live map, so it stays correct as future checkpoints land. This is a pre-existing P2 defect fixed here.

## 6. Gate results

| Gate | C0 baseline | C1 result |
|---|---|---|
| Typecheck (8 projects) | ✅ | ✅ |
| Unit tests | 47 files / 458 tests | ✅ **48 files / 472 tests** (+1 file, +14 tests) |
| Lint + Prettier | ✅ | ✅ |
| Build | ✅ | ✅ |
| `spec:verify` | ISSUES 0 | ✅ ISSUES 0 |
| `tag:coverage` | 50 decoded / 7 pending | ✅ **56 decoded / 1 pending** |
| `audit:dev` | findings=52 new=0 | ✅ findings=52 new=0 |
| `tools/test_tag_coverage.py` | 11 tests (1 stale-by-design) | ✅ 12 tests OK |
| `tools/test_audit_dev.py` | 8 tests, **1 failing** | ✅ 8 tests OK |
| Deferred P3 SF codes | 11 | ✅ **7** |
| Fuzz 10⁴ | ✅ | ✅ |

## 7. Findings status

| Finding | Status |
|---|---|
| F-P3-01 six font/text auxiliary tags lack decoders | ✅ **closed** |
| F-P3-02 JPEGTables not modelled | ✅ **closed** |
| F-P3-03 shape Vector-IR gaps | open → C2 |
| F-P3-04 morph IR | open → C3 |
| F-P3-05 image decode parity | open → C3 |
| F-P3-06 audio coverage | open → C5 |
| F-P3-07 asset-dump goldens | open → C6 |
| F-P3-08 swf → audio dependency | accepted (observation) |

New observation recorded: **F-P3-09 (minor)** — `decodeFontAlignZones` reads zone records until the tag body is exhausted because the record count is implied by the target font's glyph count, which is not available at decode time. The model layer records the zones but does not yet assert `zones.length === font.glyphs.length`. That reconciliation belongs with the C4 font work; a short record now reports `SF0278` and stops cleanly rather than over-reading.

## 8. Next checkpoint

**C2 — Shapes Vector-IR.** Closes F-P3-03: gradient structures (control points, RGB/RGBA, focal FIXED8 clamp, spread/interp), LINESTYLE2 matrix/caps/joins, fill0/fill1 path chaining, quantisation + simplification determinism, bounds cross-check, and the 200-shape corpus harness. Target: 12 missing `T-MOD-1xx` minus the 2 P4-owned (T-MOD-111, T-MOD-122) = **10 tests**.
