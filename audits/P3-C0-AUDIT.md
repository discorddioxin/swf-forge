# P3 Baseline Audit Snapshot — Checkpoint C0

Auditor: Arena.ai Agent Mode
Branch: `arena/07fdceae-swf-forge`
Baseline commit: `21cfd3e` (with P1+P2 audit fixes uncommitted in the working tree — final P1/P2 closeout will be committed at C0 commit; all measurements below are on the current working tree state so the gate numbers reflect P2-fixed reality).
Primary sources: `docs/impl/decompiler/{060-shapes-and-gradients, 070-images-and-morphs, 080-fonts-and-text, 090-sounds}.md`, SWF Reference Ch.6–11, `docs/impl/000-roadmap.md` §2 P3 row.

> **C0 is a read-only snapshot.** No source changes are made in this checkpoint. The purpose is to establish a concrete "before" baseline — test counts, deferred diagnostics, missing test ids, source line counts, and gate state — against which C1–C6 progress will be measured. Findings are recorded for tracking but are **not** fixed here; fixes happen in their owning checkpoint.

## 1. Baseline verdict

P3 is **partially implemented**. The wire/tag decoders for shapes (4 versions), bitmaps (7 tags), morphs (2 tags), fonts (v2/v3 + v4 CFF rejection), static/edit text, DefineSound, stream heads/blocks and StartSound(2) are present and decode without crash. Build-side primitives exist (`@swf-forge/audio` adpcm/pcm/mp3/resample/wav, `@swf-forge/assets` bitmap-decode+PNG+WOFF2) and the `forge-decompile assets dump` orchestrator is wired for shapes/morphs/fonts but has only partial test coverage for bitmaps and sounds, and a deterministic repeat-run golden is missing.

Open gaps (to be closed in C1–C6):
- Wire side: `DefineFont(v1)`, `DefineFontInfo/Info2`, `DefineFontName`, `DefineFontAlignZones`, `CSMTextSettings` classify by kind but have no decoder (models null). `JPEGTables` is read only by `assets/dump.ts`, not surfaced on the file model.
- Vector-IR: gradient structures, LINESTYLE2 matrix, path-building for complex fills, quantisation/determinism, bounds cross-check, and the corpus harness are absent or partial — 12 of 27 shape T-MOD-xxx tests missing.
- Images/morphs: JPEG+Tables splice, lossless corner cases (row padding, channel order, format 4), PNG/GIF passthrough parity; morph IR pairing + ratio-bake — 8 of 21 T-MOD-xxx missing.
- Fonts/text: v1 font offsets, code maps, font metrics/leading, align zones, static-text hand-computed offsets, device-only fonts, indirect names — 13 of 16 P3-owned T-MOD-xxx missing (507/508 are P9 and excluded).
- Audio: MP3 pass-through byte-identical, stream-split codec change, chunking, peak/RMS — 4 of 14 P3-owned T-AUD-xxx missing (114 is P8 excluded).
- Asset-dump: bitmap PNGs, sound WAV/MP3 previews, repeat-run determinism golden, unsupported branches test.

- C0 verdict: **baseline captured**. No major wire-protocol defects observed (decoders don't crash, fuzz 10⁴ clean, deferred SF list matches the `audit:dev` known set). No fixes in C0.

## 2. Baseline gate snapshot

| Gate | Result |
|---|---|
| Typecheck (8 projects) | ✅ exit 0 |
| Unit tests | ✅ **47 files / 458 tests pass** (0 flaky, 0 unhandled rejections) |
| P3-targeted tests (12 files) | ✅ **64/64 pass** (shape/shape-regression/shape-runs/images/morph/fonts/text/sounds/sound-stream-model/assets-fonts/assets-dump/shape-preview) |
| Lint + Prettier | ✅ "All matched files use Prettier code style!" |
| Build | ✅ `tsc -b` + 2 app builds succeed |
| `spec:verify` | ✅ ISSUES: 0 |
| `tag:coverage` | ✅ 50 decoded / 7 pending / 5 retained / 3 structural = 65 — all dispositioned |
| `audit:dev` | ✅ findings=52 / known=57 / new=0 / fixed=5 |
| Unmapped SF codes | 12, all in P5 AVM1 range (SF0405–SF0424, correct for this phase) |
| P3 deferred SF codes | 11 (see §6) |

## 3. Source inventory (P3 files only)

| File | Lines | Role | Status |
|---|---|---|---|
| `packages/swf/src/tags/shape.ts` | 689 | DefineShape 1–4 wire decoder + VectorShape IR | Partial — §4 fills/gradients/lines ok; §5 record state machine ok; §6–§7 path-build/simplify/bounds checks partial |
| `packages/swf/src/tags/images.ts` | 139 | 7 bitmap tag headers + zero-copy payload views | ✅ present (decode is in `@swf-forge/assets`) |
| `packages/swf/src/tags/morph.ts` | 371 | DefineMorphShape(+2) decoder | Partial — edges pair; IR/ratio-bake missing |
| `packages/swf/src/tags/fonts.ts` | 169 | DefineFont2/3 decoder | Partial — v1, FontInfo, FontName, AlignZones missing; glyph shapes reuse SHAPE reader |
| `packages/swf/src/tags/text.ts` | 283 | DefineText/2 + DefineEditText | Partial — runs, offsets, flags present; TEXTRECORD field order / recoveredText partial |
| `packages/swf/src/tags/sounds.ts` | 237 | DefineSound/StartSound/StreamHead/Block headers | ✅ headers present; stream integrity inspection calls into `@swf-forge/audio` |
| `packages/assets/src/images/decode.ts` | 500 | Bitmap decode + PNG encode | Present — lossless variants present; JPEG3/4 alpha/composite path needs T-MOD-304 coverage |
| `packages/assets/src/fonts.ts` | 211 | WOFF2 encoder | Present (T-AST-023 covers determinism) |
| `packages/audio/src/codecs/adpcm.ts` | 189 | SWF ADPCM decoder | Present — needs bit-exact reference vectors (T-AUD-101) |
| `packages/audio/src/codecs/pcm.ts` | 54 | PCM decoder (formats 0/3) | ✅ present |
| `packages/audio/src/codecs/mp3.ts` | 140 | MP3 frame parser + event data | Present — needs T-AUD-104 414-byte example, T-AUD-105 byte-identical pass-through |
| `packages/audio/src/codecs/resample.ts` | 70 | 48 kHz resampler | Present — needs T-AUD-110 determinism |
| `packages/audio/src/codecs/wav.ts` | 57 | WAV encoder + silent-PLaceholder | ✅ present |
| `apps/decompiler/src/assets/dump.ts` | 827 | `assets dump` orchestrator | Partial — shapes/morph/fonts/sound handlers present; bitmap PNG/WAV/MP3 branches present but only 2 CLI goldens |
| `apps/decompiler/src/assets/shape-preview.ts` | 286 | Canvas-free shape PNG preview | ✅ present (T-MOD-118-style shapes) |
| `apps/decompiler/src/assets/font-atlas.ts` | 187 | Glyph atlas packer | Present (covered by T-AST-023) |

**Total P3 production LOC:** 4,430.

## 4. R001 dependency-boundary snapshot

| Package | Allowed deps | Observed |
|---|---|---|
| `packages/swf` (tag/model) | `io`, `diagnostics`, `container` | + 1 deliberate upward import to `@swf-forge/audio` in `model/timeline.ts:10` for stream-sound integrity inspection (`parseMp3Frames`, `decodeSwfPcm`, `decodeSwfAdpcm`). This is a known design choice: `@swf-forge/audio` is runtime-neutral and depends on zero other workspace packages. It is acceptable but worth revisiting at P3 close if we want strict layering. |
| `packages/assets` | `@swf-forge/swf` types only | ✅ imports types only (no runtime dep into swf internals) |
| `packages/audio` | none | ✅ zero workspace imports |
| `apps/decompiler` | swf + assets + audio | ✅ one-way |

## 5. Test-obligation ledger

Numbers below count P3-owned tests only (P4/P6/P8/P9-excluded test ids are not listed as missing).

### IMPL-060 shapes (27 T-MOD-1xx required)
| Status | Count | IDs |
|---|---|---|
| Present | 15 | T-MOD-101, 102, 106, 112, 113, 114, 115, 116, 117, 118, 123, 124, 125, 126, 127 |
| Missing | 12 | T-MOD-103 (fill0/fill1 chaining: donut, self-intersection) · 104 (bitmap fill matrix) · 105 (gradients stop ordering/focal) · 107 (quant+simplify) · 108 (IR determinism) · 109 (open path/stroke NoClose) · 110 (200-shape corpus) · 111 (fill-rule winding) · 119 (gradient header byte legacy) · 120 (control points, RGB/RGBA) · 121 (focal FIXED8 clamp) · 122 (spread/interp→manifest) |
| Deferred to P4 | 2 | T-MOD-111 (WP-060-12 winding→tessellator plumb), T-MOD-122 (WP-060-14 gradient→sampler) — these appear "missing" but are phase-P4 and excluded from P3 exit |

### IMPL-070 images & morphs (21 T-MOD-3xx/4xx required)
| Status | Count | IDs |
|---|---|---|
| Present | 13 | T-MOD-304, 305, 309, 310, 311, 312, 313, 403, 404, 405, 406, 407, 408 |
| Missing | 8 | T-MOD-301 (Bits+JPEGTables splice) · 302 (lossless row padding) · 303 (XRGB/ARGB corner) · 306 (classification stability — P6) · 307 (mip residual — P6) · 308 (.sfa round-trip — P6) · 401 (morph endpoints IR-equality) · 402 (morph style-pair count mismatch) |
| Deferred to P6 | 3 | T-MOD-306/307/308 (WP-070-06/07/08) |

### IMPL-080 fonts & text (16 P3-owned T-MOD-5xx; 507/508 P9 excluded)
| Status | Count | IDs |
|---|---|---|
| Present | 3 | T-MOD-504, 509, 514 (plus partial 516) |
| Missing | 13 | T-MOD-501 (v2/v3 EM equality) · 502 (code maps ANSI/SJIS/Unicode+wide) · 503 (leading negative/ascent descent) · 505 (static-text hand-computed) · 506 (v1 offset table+CodeTable) · 510 (reachability decode-half) · 511 (Font4 CFF — partially covered by SF0270 in code but missing labelled test) · 512 (TEXTRECORD zero terminator) · 513 (XOffset before YOffset E-017) · 515 (align zones+CSM) · 516 (unsorted CodeTable SF0276) · 517 (device-only fonts) · 518 (indirect names) |
| Deferred to P6/P9 | 3 | T-MOD-507/508 P9, T-MOD-510 P6-subset reachability (decoder half P3) |

### IMPL-090 sounds (14 P3-owned T-AUD-1xx; 114 P8 excluded)
| Status | Count | IDs |
|---|---|---|
| Present | 10 | T-AUD-101, 102, 103, 104, 106, 107, 109, 110, 113, 115 |
| Missing | 4 | T-AUD-105 (MP3 pass-through byte-identical) · 108 (stream split codec change) · 111 (chunk 10s+loop trim) · 112 (peak/RMS metadata) |
| Deferred to P6/P8 | 2 | T-AUD-114 subdivision emulation (P8); SF0329 transcode ledger (P6) |

### Asset-dump / P3 CLI
| Test | Present |
|---|---|
| T-AST-023 WOFF2 deterministic | ✅ |
| T-AST-024 morph endpoint previews | ✅ |
| T-AST-025 multi-kind manifest golden | ❌ (C6) |
| T-AST-026 repeat-run determinism | ❌ (C6) |
| T-AST-027 unsupported/fallback | ❌ (C6) |

## 6. Deferred-diagnostic snapshot

11 P3-range SF codes are declared in `DEFERRED_DIAGNOSTIC_WPS`. C1–C5 must either (a) implement + add a fixture, removing the row, or (b) document in the checkpoint audit why the code remains deferred (with forward phase reference).

| Code | Mapped WP | Owner checkpoint | Notes |
|---|---|---|---|
| SF0262 MORPH_RATIO_BAKED | WP-070-12 | C3 morph IR | Will emit when morph ratio baking is decided |
| SF0263 MORPH_VERTEX_BUDGET_EXCEEDED | WP-070-12 | C3 morph IR | Will emit when morph vertex-budget guard is wired |
| SF0272 FONT_GLYPH_INDEX_INVALID | WP-080-07 | C4 text | Static-text glyph index validation |
| SF0273 FONT_GLYPH_CODE_MISSING | WP-080-07 | C4 text | Code-table presence |
| SF0277 FONT_HINTING_IGNORED | WP-080-09 | C4 align zones | When align zones are decoded, ignored hinting is reported |
| SF0278 FONT_HINT_TARGET_INVALID | WP-080-09 | C4 align zones | Invalid CSM target |
| SF0279 FONT_HTML_UNKNOWN_TAG | WP-080-12 | **P9** (stays deferred) | HTML parser is a runtime concern |
| SF0281 FONT_GLYPH_FILL_INVALID | WP-080-01 | C4 v1 fonts | v1 glyph SHAPE fill validation |
| SF0283 FONT_INFO2_WIDE_CODES_MISSING | WP-080-03 | C1 FontInfo/2 | Wide-code flag vs actual codes |
| SF0284 FONT_INDIRECT_NAME | WP-080-03 | C1/C4 FontName | Indirect font names |
| SF0329 SOUND_TRANSCODE_APPLIED | WP-090-12 | **P6** (stays deferred) | Transcode ledger is a build-time report |

All other P3 SF codes (SF0180–SF0195 shapes, SF0250–SF0261/64–69 images/morphs, SF0270/71/74/75/76/80/82/85 fonts, SF0300–SF0309/324–328/330–332 audio) have live emission sites (verified via `Codes.*` grep).

## 7. Wire/tag decoder coverage (P3 tags)

| Tag code | Name | Kind in model | Decoder | Status |
|---|---|---|---|---|
| 2 | DefineShape | shape | ✅ `decodeDefineShapeVersion` | Full |
| 6 | DefineBits | bitmap | ✅ `decodeDefineBitmap` | Headers ok; splice logic in dump, not model |
| 8 | JPEGTables | (control/table) | ❌ only read by `assets/dump.ts` | C1: expose on file model |
| 10 | DefineFont | font | ❌ classified `'font'` but no decoder (`font: null`) | C1 |
| 11 | DefineText | text | ✅ `decodeDefineText` | Full |
| 13 | DefineFontInfo | — | ❌ no dispatch | C1 |
| 14 | DefineSound | sound | ✅ `decodeDefineSound` | Headers ok |
| 15 | StartSound | — | ✅ timeline handles | Full |
| 18 | SoundStreamHead | — | ✅ timeline handles | Full |
| 19 | SoundStreamBlock | — | ✅ timeline handles | Full |
| 20 | DefineBitsLossless | bitmapLossless | ✅ | Full header; decode in assets |
| 21 | DefineBitsJPEG2 | bitmap | ✅ | Full |
| 22 | DefineShape2 | shape | ✅ | Full |
| 32 | DefineShape3 | shape | ✅ | Full |
| 33 | DefineText2 | text | ✅ | Full |
| 35 | DefineBitsJPEG3 | bitmap | ✅ | Full |
| 36 | DefineBitsLossless2 | bitmapLossless | ✅ | Full |
| 37 | DefineEditText | editText | ✅ `decodeDefineEditText` | Full |
| 45 | SoundStreamHead2 | — | ✅ | Full |
| 46 | DefineMorphShape | morphShape | ✅ `decodeDefineMorphShape` | Headers+edges; IR partial |
| 48 | DefineFont2 | font2 | ✅ `decodeDefineFont2or3` | Full |
| 62 | DefineFontInfo2 | — | ❌ no dispatch | C1 |
| 73 | DefineFontAlignZones | — | ❌ no dispatch | C1 |
| 74 | CSMTextSettings | — | ❌ no dispatch | C1 |
| 75 | DefineFont3 | font3 | ✅ `decodeDefineFont2or3` | Full |
| 83 | DefineShape4 | shape | ✅ | Full |
| 84 | DefineMorphShape2 | morphShape | ✅ | Headers+edges; IR partial |
| 88 | DefineFontName | — | ❌ no dispatch | C1 |
| 89 | StartSound2 | — | ✅ timeline handles (reuses StartSound decoder) | Full |
| 90 | DefineBitsJPEG4 | bitmap | ✅ | Full |
| 91 | DefineFont4 | font4 | ✅ (CFF rejection SF0270 + SF0282 device-only) | Partial but policy-correct |

Coverage: **22/31 P3 tags fully decoded; 6 auxiliary tags (FontInfo/Info2/Name/AlignZones/CSMTextSettings) and 1 table tag (JPEGTables) lack model-side decoders — C1 work; 2 morph tags need IR completion (C3).**

## 8. Behavioural probe outputs

| Probe | Result |
|---|---|
| Full test suite | 47/47 files, 458/458 tests pass |
| P3-targeted vitest (12 files) | 12/12 files, 64/64 tests pass |
| Fuzz 10⁴ seeded mutations | Zero uncaught exceptions (smoke) |
| Asset dump CLI on the bundled morph+font fixture | T-AST-023/024 pass; writes WOFF2 + morph PNG + atlas |
| R001 upward imports from swf | 1 (audio, runtime-neutral) — accepted |
| Uncommitted working-tree state | P1+P2 audit files + code fixes (SF0111 live, button self-cycle diag) are present in the working tree but not committed; they will be folded into a C0 "P2 closeout" commit before starting C1 so HEAD reflects P2-green |

## 9. Findings log (tracked, not fixed in C0)

All items below are tracked to their owning checkpoint; nothing is a stop-ship wire bug.

- **F-P3-01 (moderate) — six font/text auxiliary tags (10/13/62/73/74/88) have no decoder.** Classified by characterKind but produce null models; downstream code that looks up `font.info`, `font.alignZones`, etc. will silently get null and diagnostic SF codes that should fire are never emitted. → **C1**.
- **F-P3-02 (moderate) — JPEGTables is not modelled.** `assets/dump.ts` re-scans the tag index to find the JPEG table; bitmap decoders inside `buildMovieModel` cannot see it, so DefineBits-via-Tables is undecodable without a second pass. → **C1**.
- **F-P3-03 (moderate) — Shape Vector-IR lacks gradient/LINESTYLE2/path-build/quantise/bounds-cross-check, 12 T-MODs missing.** Any SWF using LINESTYLE2 caps/joins or non-solid fills will have partially-wrong geometry. → **C2**.
- **F-P3-04 (minor) — morph IR endpoint equality and style-pair count-mismatch diagnostics (T-MOD-401/402) untested.** SF0262/SF0263 are deferred; morph output is "best effort" without a deterministic IR guarantee. → **C3**.
- **F-P3-05 (minor) — JPEG+Tables splice, lossless row padding/channel-order, PNG/GIF passthrough parity not regression-tested.** Code exists but without T-MOD-301/302/303 we can't prove correctness. → **C3**.
- **F-P3-06 (minor) — MP3 pass-through byte-identical (T-AUD-105), stream-split codec change (T-AUD-108), chunking and peak/RMS (T-AUD-111/112) not covered.** Asset-dump sound previews have no determinism guarantee. → **C5**.
- **F-P3-07 (minor) — asset-dump has no multi-kind golden (T-AST-025), no repeat-run determinism test (T-AST-026), and no unsupported-branch fixture (T-AST-027).** End-to-end CLI cannot be said to meet the P3 exit gate without these. → **C6**.
- **F-P3-08 (observation) — `model/timeline.ts` imports three helpers from `@swf-forge/audio`.** The audio package is runtime-neutral (no workspace deps), so this doesn't violate R001 in spirit, but it means `swf` now has a non-dev dependency on `audio`. Acceptable; documenting for transparency.

## 10. Open-items ledger (carries into C1–C6)

See P3-CHECKPOINTS.md §Checkpoints for per-checkpoint exit criteria. C0 adds no new items beyond those listed there.

## 11. Done-criteria status vs P3 exit gate

Roadmap §2 P3 row: *"`forge-decompile assets dump <file.swf> --out <dir>` emits deterministic shape/bitmap PNG debug previews, supported-font WOFF2, PCM/ADPCM WAV previews, MP3 pass-through, and explicit diagnosed fallbacks."*

| Sub-criterion | C0 status | Target checkpoint |
|---|---|---|
| Shape PNG previews | ✅ deterministic per shape, no corpus harness | C2 |
| Bitmap PNG previews | ⚠️ decode+PNG code present, no CLI golden | C3+C6 |
| Supported-font WOFF2 | ✅ T-AST-023 covers determinism | C4 (broaden coverage) |
| PCM/ADPCM WAV | ⚠️ WAV encoder present, not wired as default preview, no chunk/peak | C5+C6 |
| MP3 pass-through | ⚠️ parser present, byte-identical not proven | C5 |
| Explicit diagnosed fallbacks | ⚠️ framework present, branches not fully enumerated | C6 |
| Determinism (repeat-run) | ❌ no test | C6 |
| Gates (test/typecheck/lint/spec:verify/audit:dev/tag:coverage/fuzz) | ✅ green now; must stay green through each checkpoint | all |

## 12. Next checkpoint

**C1 — Wire/tag foundation sweep.** Expected changes: add decoders for the six missing font/text auxiliary tags (DefineFont v1 offsets, FontInfo/Info2 code maps, FontName licensing, AlignZones, CSMTextSettings) and surface JPEGTables through the file model. Target +10 tests; SF0272/SF0273/SF0281/SF0283/SF0284 move from deferred to live. Full gate re-run required at end of C1.
