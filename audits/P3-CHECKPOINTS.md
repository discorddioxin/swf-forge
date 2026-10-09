# P3 Sequencing Breakdown — Media decode & asset build

P3 charter (`docs/impl/000-roadmap.md` §2):
> `forge-decompile assets dump <file.swf> --out <dir>` emits deterministic shape/bitmap PNG previews,
> supported-font WOFF2, PCM/ADPCM WAV previews, MP3 pass-through, and explicit diagnosed fallbacks.
> Gates: T-SWF-005/006 + P3-owned T-MOD/T-AST/T-AUD decode and asset-dump gates.

Primary docs: `docs/impl/decompiler/{060-shapes-and-gradients, 070-images-and-morphs, 080-fonts-and-text, 090-sounds}.md`.

## State of the tree at checkpoint 0

- **Baseline commit:** `c15c7d2` (P2 audit + resolution closed).
- **Gates green:** 47 files / 458 tests, typecheck 8 projects clean, `audit:dev` new=0, `spec:verify` ISSUES=0.
- **Wire decoders present** for: DefineShape/2/3/4, DefineBits*/DefineBitsLossless(+2), DefineMorphShape(+2), DefineSound, SoundStreamHead(+2)/Block, StartSound(+2), DefineFont2/3 (+ DefineFont4 CFF rejection), DefineText/2, DefineEditText. Tag-side shape/morph/bitmap/font/text/sound models all decode without crashing.
- **Build-side packages present:** `@swf-forge/audio` (adpcm/pcm/mp3-parse/resample/wav), `@swf-forge/assets` (bitmap decode+PNG encode, WOFF2 font encode), `apps/decompiler/src/assets/` (dump orchestrator + shape preview + font atlas).
- **Existing P3 regression tests:** 64 cases covering the basic decoders + asset-dump smoke for fonts/morphs (T-AST-023 WOFF2, T-AST-024 morph endpoints).
- **Known gaps at start:**
  - Wire/tag side: `DefineFont(v1)`, `DefineFontInfo/Info2`, `DefineFontName`, `DefineFontAlignZones`, `CSMTextSettings` are classified but not decoded (models are null; SF codes for these are deferred in `audit_dev.py`: SF0272/SF0273/SF0277/SF0278/SF0281/SF0283/SF0284).
  - Vector-IR simplification/determinism, fill-rule winding, gradient spread/interpolation/focal plumbing (WP-060-09/10/12/14); T-MOD-103/104/105/107–111/119–122 missing.
  - Image/morph: JPEG+Tables splice, lossless corner cases, PNG/GIF passthrough, morph IR endpoints/ratio-bake/styling parities (T-MOD-301/302/303/306/307/308/401/402 missing). WP-070-12 SF0262/SF0263 deferred.
  - Fonts/text: code maps, v1 offsets, metrics/leading, align zones, indirect name, HTML hand-off (T-MOD-501/502/503/505–508/510–518 missing).
  - Audio: MP3 pass-through byte-identical (T-AUD-105), stream split (T-AUD-108), chunking+peak/RMS (T-AUD-111/112); SF0329 transcode ledger is deferred to P6.
  - Asset-dump CLI: bitmap PNGs, WAV/MP3 previews, sorted manifest, repeat-run golden all present but need corpus expansion.

**Rule of thumb:** each checkpoint ends with (a) code committed, (b) its new tests green, (c) full gate re-run (typecheck + `pnpm test` + lint + spec:verify + audit:dev), (d) an audit mini-section appended to `audits/P3-AUDIT.md` (and flip evidence to `P3-AUDIT-RESOLUTION.md` only when a defect is found and fixed). Checkpoints are cumulative; nothing later checkpoint depends on is ever left broken.

---

## Checkpoint C0 — P3 Audit baseline (already done by this breakdown)

**Output:** `audits/P3-AUDIT.md` (initial state-of-P3 report) plus `audits/P3-AUDIT-RESOLUTION.md` placeholder. Run the full gates once to snapshot the baseline; do **no** code changes. Capture the "before" test count (458), diagnostic counts (164 emitted / 1 exception / 11 deferred / 12 unmapped), and tag coverage.

Exit criteria:
- Baseline written; known deferred-SF list recorded; missing-test-id list recorded.

---

## Checkpoint C1 — Wire/tag foundation sweep (tag decoders)

**Goal:** close every P3 tag-code path that the dispatcher (`model/movie.ts` characterKind switch + timeline sound handlers) classifies but doesn't yet fully decode. End state: every P3 tag has a non-throwing decoder with tests; unknown/subset payloads are quarantined with the documented SF code rather than being silently null.

Scope:
1. `DefineFont` (10) v1: offsets table, nGlyphs inference, `CodeTableOffset` base → reuses SHAPE glyph reader from WP-080-01.
2. `DefineFontInfo` (13) / `DefineFontInfo2` (62): flags, code maps, ANSI/Shift-JIS/Unicode layouts, wide codes, language code → `FontInfoModel`.
3. `DefineFontName` (88): font name + copyright capture.
4. `DefineFontAlignZones` (73) + `CSMTextSettings` (74): zone data + CSM cutoffs per the chapter's formulas (data-only; render hinting is P9, but we must decode+report).
5. `JPEGTables` (8) parsing hook in `model/movie.ts` (currently only `assets/dump.ts` reads it) — expose on `file.control` like other shared tables so bitmap decoding doesn't need a second pass.
6. Verify no other P3 tag (per tag-codes §P3 list) is silently dropped: DefineBitsJPEG2/3/4 alphas, DefineBitsLossless 3/4/5 format dispatch, MorphShape2 edge-bounds/stroke flags, SoundStreamHead2 vs Head, StartSound2.
7. Stitch the new models into `CharacterModel`/`MovieModel` so the asset-dump stage in C5 can consume them.

Tests to add: T-MOD-501, T-MOD-502, T-MOD-506, T-MOD-511, T-MOD-512, T-MOD-514, T-MOD-515, T-MOD-516, T-MOD-517, T-MOD-518 (tag-decoder halves).

Exit criteria:
- All P3 tags decode end-to-end without crash on the fuzz 10⁴ set.
- SF0272/SF0273/SF0281/SF0283/SF0284 move out of the deferred list into live emissions.
- `audit:dev new=0`, full test count +10 expected.

---

## Checkpoint C2 — Shapes (WP-060-01 through WP-060-13)

**Goal:** complete the Shape Vector-IR path to the P3 done-criteria bar (four versions decode, style indices validated, determinism, bounds agreement, fill-rule pinned). Renderer-facing items WP-060-12/14 (winding→tessellator, gradient→sampler plumbing) belong to P4 and are **not** in scope.

Scope:
1. Gradient structures (WP-060-04): flags byte, RGB vs RGBA per version, spread/interp, focal FIXED8 for Shape4; clamp policy and SF0192/SF0193/SF0194/SF0195 emission.
2. `LINESTYLE2` (WP-060-05): caps × joins matrix, miter cut-off, NoClose, pixel hinting flags → model retained verbatim.
3. Path building (WP-060-08): fill0/fill1 chaining for donut/self-intersection, rewinds, `NoClose` → `SHAPE_IMPLICIT_CLOSE` vs open stroke (T-MOD-103/109).
4. Vector IR (WP-060-09): quantisation, simplification, fixed 4-step deterministic order (T-MOD-107/108).
5. Bounds cross-check (WP-060-10): decoded-edge bounds vs header bounds; emit `SF0187` on >1 % disagreement.
6. Bitmap fill matrix rule (WP-060-03, T-MOD-104); `StateNewStyles` re-scoping (T-MOD-106/114, already partially covered); 0xFF extended counts (T-MOD-113, partially covered); gradient stop ordering + duplicates + focal clamp (T-MOD-105/119/120/121).
7. Dedupe ceiling (WP-060-13): SF0190 only fires on byte-identical duplicates (T-MOD-127).
8. 200-shape corpus harness (WP-060-11): `inspect --shapes` goldens, import-boundary lint.
9. Skip (P4): WP-060-12 (fill-winding to tessellator), WP-060-14 (gradient plumbing to sampler).

Tests to add: T-MOD-103/104/105/107/108/109/110/111/119/120/121.

Exit criteria:
- `VectorShape` is the single geometry type exported (no duplicate raw re-parse).
- IR is byte-identical across 10⁴ runs × 3 environments in CI (T-MOD-108).
- T-MOD-123 Appendix-A walk still passes (regression guard).
- audit:dev new=0; no new SF codes deferred.

---

## Checkpoint C3 — Images & morphs (decode half, WP-070-01..05, 10..14)

**Goal:** decode all seven bitmap tags and both morph tags into canonical in-memory models with byte-exact pixel parity where the format allows it; emit the diagnostic for every failure path. Build-side re-encode/mips/sfa/budget (WP-070-06..09) are P6 and **not** in scope.

Scope (images):
1. `DefineBits`+`JPEGTables` splice (WP-070-02): single-table wins, `FFD9FFD8` prefix tolerated, `SF0257` on multiple tables (T-MOD-301/312).
2. PNG/GIF passthrough (WP-070-03): magic-byte detection, SWF8 gate, byte-identical output (T-MOD-305).
3. Lossless (WP-070-04): row padding for all four pixel sizes (indexed 1B / PIX15 2B / PIX24 4B / ARGB 4B), XRGB vs ARGB channel order, 253-px example (T-MOD-302/309/311/313).
4. Alpha plane (WP-070-05): zlib inflate, un-premultiply, alpha-over-black composite, length-mismatch diagnostic (T-MOD-304/310).
5. JPEG parsing diagnostics: missing markers, progressive JPEG info, deblock recorded, format unknown (SF0250–SF0260 emit sites all verified).

Scope (morphs):
6. `DefineMorphShape`/`2` decode (WP-070-10): start/end bounds, both edge streams, `EndEdges` header, `Offset` validation with SF0264.
7. Morph styles (WP-070-11): `MORPHFILLSTYLE`, `MORPHGRADIENT` (interleaved ratios/colours), `MORPHLINESTYLE2` (one shared flag word, miter ×Start/EndWidth, HasFill pair) (T-MOD-405/406).
8. Morph IR (WP-070-12): pairing start/end edges, straight↔curved odd-delta rational twips, single deterministic rounding, ratio-bake policy → emit SF0262/SF0263 as appropriate (remove from deferred list) (T-MOD-402/403/407/408).
9. Morph goldens (WP-070-14): endpoint-identical-to-static IR at ratio 0/65535 (T-MOD-401).
10. Skip (P6): WP-070-06/07/08/09 (classification/re-encode/mips/sfa/budgets).

Tests to add: T-MOD-301/302/303/305/401/402 (306/307/308 are P6 re-encode).

Exit criteria:
- All seven bitmap tags decode on the corpus; SF0262/SF0263 become live (or documented as deferred-with-rationale) and removed from the stale list.
- PNG/GIF passthrough byte-identical; lossless decoded bitmaps reproduce the reference pixels within AST-R03 tolerances.
- Morph endpoints are IR-identical to their static counterparts.

---

## Checkpoint C4 — Fonts & text (WP-080-01..10, 13, 14)

**Goal:** every font and text tag decodes into a model that can drive WOFF2 emission + static-text layout; supported WOFF2 assets are byte-deterministic. Runtime HTML/layout/input (WP-080-12) and dynamic subsetting (WP-080-11) are P9/P6 and out of scope.

Scope:
1. Font v1 (WP-080-01): ties to C1's v1 decoder; verify glyph SHAPE reuse for v1 as well.
2. Font2/3 (WP-080-02): glyph shapes, metrics (ascent/descent/leading unsigned w/ negative leading SF0274), wide codes, bold/italic flags, kerning pairs; v2 vs v3 same-font equality after EM normalisation (T-MOD-501/503).
3. FontInfo/2 code maps (WP-080-03, T-MOD-502/510); indirect font name resolution recorded but not resolved (SF0284, T-MOD-518).
4. Font4 CFF rejection (WP-080-04, already present, T-MOD-511).
5. FontName licensing (WP-080-05) captured verbatim.
6. Metrics derivation (WP-080-06) for v1 fonts (SF0275).
7. Static Text IR (WP-080-07): TEXTRECORD terminator, field order (YOffset after XOffset per E-017), multi-run style inheritance, TextHeight scaling, per-run matrix/colour; recoveredText only when code map is bijective (T-MOD-504/505/512/513).
8. EditText (WP-080-08): all 16 flags + HasFontClass branch, VariableName verbatim, password/MaxLength fields recorded (T-MOD-514; enforcement is P9).
9. Align zones + CSM (WP-080-09): decode+emit SF0277/SF0278 on invalid targets (T-MOD-515).
10. Font atlas (WP-080-10): deterministic raster + packing (T-MOD-509 already exists; extend coverage).
11. Corpus harness (WP-080-13): `inspect --fonts` goldens.
12. Deterministic WOFF2 (WP-080-14): T-AST-023 already exists; extend to cover variable-upem and wide-code variants.
13. Skip (P6/P9): WP-080-11 subset reachability, WP-080-12 HTML/measure/layout.

Tests to add: T-MOD-501/502/503/505/510/515/516/517/518.

Exit criteria:
- SF0272/SF0273 (glyph index/code missing) and SF0277/SF0278/SF0281/SF0283/SF0284 all become live (or stay deferred with clear test-cited rationale).
- WOFF2 output is byte-deterministic across runs (T-AST-023) with the timestamp zeroed.
- Static text placement matches hand-computed offset table on a fixture (T-MOD-505).

---

## Checkpoint C5 — Audio decode + asset emit (WP-090-01..08, 10, 11)

**Goal:** every DefineSound decodes to sample-accurate PCM (or byte-identical MP3 pass-through) and the asset-dump writes a stable WAV/MP3 preview with peak/RMS metadata and chunked 10s boundaries. Frame-subdivision emulation (WP-090-09) is P8 and budget transcode reporting (WP-090-12) is P6 — both out of scope.

Scope:
1. Codec dispatch (WP-090-01): lazy payload, format reserved SF0301.
2. ADPCM (WP-090-02): bit-exact against reference vectors (T-AUD-101); 2–5-bit codes, mono/stereo packets, 4095-code boundary, short final packet (T-AUD-102).
3. PCM (WP-090-03): format 0 big-endian vs format 3 little-endian (T-AUD-103); existing stream-block inspector verified.
4. MP3 (WP-090-04): frame header parse (version/layer/rate/bitrate/padding, 414-byte example) (T-AUD-104).
5. MP3 pass-through (WP-090-05): byte-identical hash, latency SeekSamples trim metadata surfaced (T-AUD-105).
6. Nellymoser/Speex/reserved fallback (WP-090-06): correct-duration silent WAV, manifest flag (T-AUD-115). SF0303/SF0307.
7. SOUNDINFO (WP-090-07): MSB-first flag byte, in/out points, loop count, envelope conversion (T-AUD-109).
8. Stream model (WP-090-08): offset table, sample-count exactness, silent/empty blocks, second-head codec change (T-AUD-106/107/108/113).
9. Resample to 48 kHz (WP-090-10): deterministic same-input → same-bytes (T-AUD-110).
10. Chunking + loop/trim + peak/RMS (WP-090-11): 10s boundaries exact, loop points survive trim, metadata stable (T-AUD-111/112).
11. Skip (P8/P6): WP-090-09 frame-subdivision emulation, WP-090-12 transcode/budgets (SF0329 stays deferred).

Tests to add: T-AUD-105/108/111/112.

Exit criteria:
- ADPCM bit-exact against reference; MP3 bytes hash-equal; WAV PCM decodes to the expected sample count.
- Stream blocks produce sample-accurate offsets (≤12 ms drift / 10 min is a runtime gate — P3 guarantees exact offset tables only).
- Every supported codec writes a preview file; unsupported codecs write a silent placeholder + manifest flag.

---

## Checkpoint C6 — `forge-decompile assets dump` integration (WP-060-11, 070-15, 080-13, 090-11)

**Goal:** end-to-end CLI produces a deterministic, sorted, repeatable asset bundle against a corpus fixture. Each media kind has a preview file; the manifest records sha256, output type, status (written/fallback/unsupported) and per-asset diagnostics; running the command twice yields byte-identical output.

Scope:
1. Shape PNG previews via `renderShapePreview` for every VectorShape (incl. morph start/end via T-AST-024).
2. Bitmap PNG previews via `decodeBitmap` → `encodeBitmapPng`; JPEG passthrough writes the (merged) JPEG bytes directly; PNG/GIF passthrough writes the bytes verbatim.
3. WOFF2 for DefineFont2/3 with normalized upem + zeroed sfnt timestamps (extend T-AST-023).
4. WAV for PCM/ADPCM decoded streams, MP3 pass-through for MP3 sounds, silent placeholder WAV for Nellymoser/Speex/reserved.
5. Morph previews for ratio 0 and 1 (T-AST-024 already present).
6. Deterministic ordering in the manifest (sorted by characterId); stable sha256; source metadata (bytes, source sha256, compression, version).
7. Repeat-run golden test: run twice on a fixture, assert the two output directories byte-identical.
8. Unsupported media (DefineBits without JPEGTables, unknown lossless format, font4 with CFF, etc.) writes a record with status `unsupported`/`fallback` and the documented diagnostic — never crashes.

Tests to add:
- T-AST-025 asset-dump golden (sorted manifest + one preview per media kind).
- T-AST-026 repeat-run byte-identical determinism.
- T-AST-027 unsupported/fallback path covers each documented quarantine branch.

Exit criteria:
- `forge-decompile assets dump` on a multi-kind fixture produces a complete bundle with no unhandled exceptions.
- Two runs produce sha256-identical output (tree hash).
- `audit:dev new=0`; spec:verify ISSUES=0; tag:coverage still 65/65 dispositioned.

---

## Checkpoint C7 — P3 in-depth audit + closeout

**Goal:** write the P3 audit (`audits/P3-AUDIT.md`) and resolution doc, modelled on P1/P2: verdict, WP ledger (C2–C6), test-obligation ledger, diagnostic ledger (SF0180–SF0195, SF0250–SF0269, SF0270–SF0289, SF0300–SF0332), rule-by-rule read against the four IMPL docs, behavioural probe outputs, findings with severity, open-items ledger, done-criteria status. Fix any new defects found; add labelled regression tests labelled `T-P3-REG-*`; re-run the full gate stack.

Exit criteria:
- Audits saved at `audits/P3-AUDIT.md` and `audits/P3-AUDIT-RESOLUTION.md`.
- All P3-owned deferred SF codes either now emit or carry a documented forward-reference to P4/P6/P8/P9.
- Final gates: typecheck 8 projects, `pnpm test` (target ~495–510 tests), lint, build, spec:verify ISSUES=0, audit:dev new=0, tag:coverage clean, fuzz 10⁴ zero uncaught.
- Commit "P3 media decode + asset build + audit closeout" on `arena/07fdceae-swf-forge`.

---

## Suggested execution order & rough sizing

| # | Checkpoint | Depends on | New tests (est.) | New SF codes live (est.) |
|---|---|---|---|---|
| C0 | Baseline audit snapshot | — | 0 | 0 |
| C1 | Wire/tag foundation sweep | C0 | +10 | 5–7 (SF0272/73/81/83/84) |
| C2 | Shapes / Vector IR | C0 | +12 | 0 (already all registered) |
| C3 | Images & morphs decode | C1 | +8 | 2 (SF0262/63) |
| C4 | Fonts & text | C1 | +8 | 0 (codes already deferred) |
| C5 | Audio decode + previews | C0 | +4 | 0 |
| C6 | Asset-dump CLI integration | C2, C3, C4, C5 | +3 | 0 |
| C7 | P3 audit + closeout | C1–C6 | 0–5 (regressions) | any discovered defects |

Total expected test delta: ~+45 → final suite ≈ **503–510 tests**.

## Explicitly deferred out of P3 (owned by later phases)

These items are listed in the P3 impl docs but their phase column says P4/P6/P8/P9; they are **not** in scope for this breakdown and must not block C7:

- WP-060-12 (fill winding → tessellator), WP-060-14 (gradient plumbing to sampler) → P4.
- WP-070-06/07/08/09 (classification, re-encode ladder, mips, .sfa round-trip, budgets) → P6.
- WP-080-11 (dynamic subset reachability, requires AVM1) → P6; WP-080-12 (HTML/layout/input runtime) → P9.
- WP-090-09 (frame-subdivision emulation for runtime sync) → P8; WP-090-12 (transcode/budgets ledger) → P6 (SF0329 remains deferred).
- Runtime audio sync (T-AUD-114 subdiv emulator) → P8; SF0405–SF0424 (AVM1 opcodes) → P5.
