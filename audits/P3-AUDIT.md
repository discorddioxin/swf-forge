# P3 In-Depth Audit — Media Decode & Build Assets (Checkpoint C7)

- **Auditor:** Arena.ai Agent Mode
- **Branch:** `arena/07fdceae-swf-forge`
- **Base commit:** `21cfd3e17210d30420f7a87c24987cdfc2de922b`
- **Scope:** C7 closeout across IMPL-060/070/080/090 and the C2–C6 evidence. C0 snapshot is preserved at `P3-C0-AUDIT.md`; per-checkpoint audits remain at `P3-C1-AUDIT.md` … `P3-C6-AUDIT.md`.
- **Primary sources:** the four P3 implementation docs, `audits/P3-CHECKPOINTS.md`, roadmap §2, P3 source/tests, `tools/audit_dev.py`, and the final gate outputs recorded below.

## 1. Verdict

**P3 closeout: PASS.** The P3 decode/model/build scope and C2–C6 asset-dump gate are complete. The final run verifies all eight TypeScript projects, the full test suite, lint, build, `spec:verify`, `audit:dev new=0`, tag coverage, and the 10⁴-input fuzz gate. No P3-owned diagnostic remains silently deferred: 69 codes in the four audited ranges have emission sites and the two intentional forwards name their P6/P9 work-package owners.

C7 corrected false renderer/morph citations, fixed the `SF0262` registry description and over-budget emission path to distinguish runtime, baked, and dropped strategies, clarified that font-glyph quarantine withholds only the outline, and pinned unequal-edge-count suffix padding at the shorter endpoint's final local anchor. The audit tool now requires complete module maps for all four P3 implementation docs, recognizes `T-P3-REG-*` evidence, and verifies that deferred diagnostic owners belong to P4/P6/P8/P9. All nine C7 regression rows are declared below.

The P3 model does **not** become a runtime renderer: the production morph placement caller remains P4; dynamic text/layout remains P9; audio frame subdivision remains P8. These are explicit phase boundaries, not unresolved P3 decode failures.

### C7 audit method and scope limits

- Reviewed every rule in IMPL-060/070/080/090 against its implementation/module map, test obligations, diagnostics, and named forward owner.
- Reconciled all 81 test obligations declared in the four implementation docs; separately tracked `T-AST-023`–`027` and the nine `T-P3-REG-*` regressions.
- Reconciled every registered diagnostic in the four requested SF ranges against source emission sites or an explicit later-phase owner.
- Ran targeted regression probes and the full acceptance gate stack. Counts below are measured from the final commands, not copied from the checkpoint's obsolete estimate.
- Image-parity evidence is the repository's deterministic fixture set and frozen reference-pixel assertions (including a frozen ImageMagick JPEG decode), not a broad external real-world media corpus. This is recorded as a low-severity evidence limitation, not represented as coverage from `tag:coverage` alone.

## 2. C2–C6 work-package ledger

| Checkpoint | Work packages | C7 disposition |
|---|---|---|
| **C2 — shapes** | WP-060-01…11, 13 | **Closed.** Shape decoding, VectorShape IR, shared quantise/simplify preparation, corpus/import-boundary evidence, and dedupe behavior are implemented and tested. |
| | WP-060-12, 14 | **Forward to P4.** Fill winding → tessellator and gradient spread/interpolation/focal → sampler are renderer integrations; P3 preserves the flags/specification. |
| **C3 — images & morphs** | WP-070-01…05, 10…15 | **Closed.** Bitmap decode, JPEG table splice, lossless/alpha normalization, morph decode/IR, parity fixtures, morph goldens, and C6 previews/manifests are covered. WP-070-13 is now correctly tied to the P3 decode fixtures (not P6 re-encoding). |
| | WP-070-06…09 | **Forward to P6.** Classification, re-encode/mips, `.sfa`, and texture budgets. `T-MOD-306`–`308` remain scheduled/unwired under the P6 owner. |
| | Morph placement binding | **Forward to P4.** The P3 model preserves `PlacementOp.ratio`; P4 display-list/scene integration calls the tested `morphToGeometry()` adapter. |
| **C4 — fonts & text** | WP-080-01…10, 13, 14 | **Closed.** Font/text decode, static TextIR, glyph atlas, populated-font corpus golden, deterministic WOFF2 and the glyph-slot regression are covered. The runtime-layout module is IMPL-130; P9-owned `/packages/text` is not present yet. |
| | WP-080-11 | **Forward to P6.** Dynamic glyph reachability/subsetting (`T-MOD-510` build half remains owned by the subsetter). |
| | WP-080-12 | **Forward to P9.** AVM1 layout/measurement/HTML parser; `SF0279`, `T-MOD-507` and `T-MOD-508` remain scheduled/unwired. |
| **C5 — sound** | WP-090-01…08, 10, 11 | **Closed.** Codec dispatch, ADPCM/PCM/MP3 parsing and pass-through, stream records, resampling, chunking/trim/levels are tested. |
| | WP-090-09 | **Forward to P8.** Frame-subdivision emulator; `T-AUD-114` is scheduled/unwired. |
| | WP-090-12 | **Forward to P6.** Build budget/transcode ledger; `SF0329` is explicitly assigned here. |
| **C6 — CLI integration** | WP-060-11, WP-070-15, WP-080-13, WP-090-11 | **Closed.** `assets dump` emits sorted/hash-checked multi-kind assets, preserves documented fallbacks, and has a repeat-run byte-identical golden. |

## 3. Test-obligation ledger

### IMPL-060 — Shapes & gradients (27 obligations: 26 test-cited, 1 scheduled/unwired)

| ID | Obligation | Status / owner | Evidence |
|---|---|---|---|
| `T-MOD-101` | edge decoder: all four quadrants × both edge kinds, hand-computed bytes | test-cited | `packages/swf/test/shape-conformance.test.ts` |
| `T-MOD-102` | straight-edge `GeneralLineFlag`/`VertLineFlag` combinations incl. zero-length moves | test-cited | `packages/swf/test/shape-conformance.test.ts` |
| `T-MOD-103` | fill0/fill1 chaining: rectangle, donut (hole), self-intersection | test-cited | `packages/swf/test/shape-styles.test.ts` |
| `T-MOD-104` | bitmap fill matrix: repeating vs clipped on the same shape; all four bitmap types | test-cited | `packages/swf/test/shape-styles.test.ts` |
| `T-MOD-105` | gradients: stop ordering, duplicates, focal clamp, linear-RGB flag preserved | test-cited | `packages/swf/test/shape-styles.test.ts` |
| `T-MOD-106` | `StateNewStyles` mid-stream re-scoping (fixture with two style sets) | test-cited | `packages/swf/test/shape-conformance.test.ts` |
| `T-MOD-107` | quantisation + simplification determinism over 10⁴ random shapes; fixed 4-step order | test-cited | `packages/swf/test/shape-vector-ir.test.ts` |
| `T-MOD-108` | IR stability: shape → IR byte-identical across runs, platforms and engines | test-cited | `packages/swf/test/shape-vector-ir.test.ts` |
| `T-MOD-109` | open path with fill closes; stroke keeps open semantics; `NoClose` honoured | test-cited | `packages/swf/test/shape-styles.test.ts` |
| `T-MOD-110` | integration: 200-shape corpus decodes without `SF0180`, bounds agree within 1 % | test-cited | `packages/swf/test/shape-vector-ir.test.ts` |
| `T-MOD-111` | fill rule: `UsesFillWindingRule` 1/0 selects non-zero/even-odd on the same geometry | test-cited | `packages/swf/test/shape-styles.test.ts` |
| `T-MOD-112` | `LINESTYLE2` byte layout + miter cut-off (`MiterLimitFactor × Width`) + `NoClose` | test-cited | `packages/swf/test/shape-conformance.test.ts` |
| `T-MOD-113` | `0xFF` extended counts: present in Shape2/3/4, literal 255 in v1 (both directions) | test-cited | `packages/swf/test/shape-regressions.test.ts` |
| `T-MOD-114` | `StateNewStyles` record carries its own indices before the arrays; indices re-based | test-cited | `packages/swf/test/shape-conformance.test.ts` |
| `T-MOD-115` | curved edge: all four deltas at `NumBits + 2`; boundary `NumBits == 0` | test-cited | `packages/swf/test/shape-conformance.test.ts` |
| `T-MOD-116` | caps × joins matrix (3×3) incl. miter factor absent for non-miter joins | test-cited | `packages/swf/test/shape-regressions.test.ts` |
| `T-MOD-117` | `SHAPE` (font glyph) path reuses the record decoder with an empty style set | test-cited | `packages/swf/test/fonts.test.ts` |
| `T-MOD-118` | `DefineShape4` edge bounds vs shape bounds on a stroked fixture; recompute cross-check | test-cited | `packages/swf/test/shape-regressions.test.ts` |
| `T-MOD-119` | gradient header byte: spread/interp/count decode in all four shape versions; legacy non-zero modes reported (`SF0192`) but honoured | test-cited | `packages/swf/test/shape-styles.test.ts`; `packages/swf/test/support/shape-bytes.ts` |
| `T-MOD-120` | control points: 8 vs 15 ceilings, `NumGradients == 0`, ratio sorting and duplicate retention, RGB vs RGBA by tag | test-cited | `packages/swf/test/shape-styles.test.ts` |
| `T-MOD-121` | focal gradient: `FIXED8` decode (`0xFF00`/`0x0000`/`0x0100`), Shape4-only rule (`SF0195`), clamp at the sampler | test-cited | `packages/swf/test/shape-styles.test.ts` |
| `T-MOD-122` | spread ×3 (pad/reflect/repeat) and interpolation ×2 reach the renderer config and the manifest | scheduled/unwired | Scheduled/unwired → P4; WP-060-14 |
| `T-MOD-123` | Appendix A shape walk, asserted at bit level: `FillStyleCount` 0 / `LineStyleCount` 1 (20-twip black line), `NumFillBits` 0 / `NumLineBits` 1, style-change flags `0 1 0 0 1` with `MoveBits` 14 and Δ(4900, 1680), the four 13-bit straight edges, the `End` record, and the six padding bits with **no** byte alignment between records (`T-TST-102`) | test-cited | `packages/swf/test/shape-conformance.test.ts` |
| `T-MOD-124` | Production `buildMovieModel` exposes VectorShape + decoded bounds for DefineShape/2/3/4 without a raw-tag reparse | test-cited | `packages/swf/test/model-shapes.test.ts` |
| `T-MOD-125` | `inspect --shapes` reports the model's stable static-shape summary and geometry digest only when requested | test-cited | `apps/decompiler/test/inspect.test.ts` |
| `T-MOD-126` | Shape4 reserved flags preserve the raw byte and emit one `SF0188` per file; pre-SWF-8 use reports `SF0183` | test-cited | `packages/swf/test/shape-regressions.test.ts` |
| `T-MOD-127` | `SF0190` fires at the style-array ceiling only for byte-identical fill/line duplicates; distinct styles remain quiet | test-cited | `packages/swf/test/shape-regressions.test.ts` |

### IMPL-070 — Images & morphs (21 obligations: 18 test-cited, 3 scheduled/unwired)

| ID | Obligation | Status / owner | Evidence |
|---|---|---|---|
| `T-MOD-301` | `DefineBits` + `JPEGTables` splice produces a decodable JPEG (byte-compare the merged stream) | test-cited | `packages/assets/test/bitmap-layout.test.ts` |
| `T-MOD-302` | lossless row padding: a 3×3 24-bit image with distinct rows decodes with rows in place | test-cited | `packages/assets/test/bitmap-layout.test.ts` |
| `T-MOD-303` | lossless/lossless2 colour order: corner-colour fixtures prove XRGB vs ARGB channels | test-cited | `packages/assets/test/bitmap-layout.test.ts` |
| `T-MOD-304` | JPEG3/4 alpha inflate: exact `w × h`, mismatch path, alpha-over-black composite | test-cited | `packages/assets/test/bitmap.test.ts` |
| `T-MOD-305` | PNG/GIF passthrough is byte-identical to the tag payload | test-cited | `packages/assets/test/bitmap.test.ts` |
| `T-MOD-306` | classification stability: the same input classifies identically across 100 runs | scheduled/unwired | Scheduled/unwired → P6; WP-070-06 |
| `T-MOD-307` | mip ladder residual error within the AST-R021 tolerance on the corpus | scheduled/unwired | Scheduled/unwired → P6; WP-070-07 |
| `T-MOD-308` | `.sfa` round-trip: decode → emit → decode yields identical pixels | scheduled/unwired | Scheduled/unwired → P6; WP-070-08 |
| `T-MOD-309` | row padding for all four pixel sizes (indexed 1 B, PIX15 2 B, PIX24 4 B, ARGB 4 B) incl. the 253-px example | test-cited | `packages/assets/test/bitmap.test.ts` |
| `T-MOD-310` | `ALPHABITMAPDATA` un-premultiply: round-trip, `alpha == 0` case, 255-clamp | test-cited | `packages/assets/test/bitmap.test.ts` |
| `T-MOD-311` | `PIX15` bit order (`Reserved/R/G/B` 5-bit fields) and `PIX24` zero byte | test-cited | `packages/assets/test/bitmap.test.ts` |
| `T-MOD-312` | erroneous `FFD9FFD8` prefix tolerated; multiple `JPEGTables` → first wins + `SF0257` | test-cited | `packages/assets/test/bitmap.test.ts` |
| `T-MOD-313` | `DefineBitsLossless2` format 4 decoded with `SF0259`; unknown format quarantined (`SF0260`) | test-cited | `packages/assets/test/bitmap.test.ts`; `packages/swf/test/images.test.ts` |
| `T-MOD-401` | morph endpoints: ratio 0/65535 renders identical to the static shapes (via IR diff) | test-cited | `packages/swf/test/morph-ir.test.ts` |
| `T-MOD-402` | morph style pairing on count mismatch (fill/line arrays) | test-cited | `packages/swf/test/morph-ir.test.ts` |
| `T-MOD-403` | degenerate correspondence for unequal edge counts | test-cited | `packages/swf/test/morph.test.ts` |
| `T-MOD-404` | two-stream parse: style changes only in `StartEdges`, the `EndEdges` header byte, an inconsistent `Offset` (`SF0264`) | test-cited | `packages/swf/test/morph.test.ts` |
| `T-MOD-405` | `MORPHGRADIENT`: the single `GRADIENT`-style header byte, start/end matrix order, interleaved `(ratio, colour)` pairs | test-cited | `packages/swf/test/morph.test.ts` |
| `T-MOD-406` | `MORPHLINESTYLE2`: one shared flag word, miter `× StartWidth`/`× EndWidth`, `HasFillFlag` fill pair | test-cited | `packages/swf/test/morph.test.ts` |
| `T-MOD-407` | straight↔curved pairing with odd deltas: rational twips retained, single deterministic rounding | test-cited | `packages/swf/test/morph.test.ts` |
| `T-MOD-408` | morph restriction checks: unequal edge counts, different bitmap ids, missing `MoveTo` counterpart | test-cited | `packages/swf/test/morph.test.ts` |

### IMPL-080 — Fonts & text (18 obligations: 16 test-cited, 2 scheduled/unwired)

| ID | Obligation | Status / owner | Evidence |
|---|---|---|---|
| `T-MOD-501` | `DefineFont2` vs `DefineFont3` same-font geometry equality after normalisation (`unitsPerEm` 1024 vs 20480) | test-cited | `packages/swf/test/font-metrics.test.ts` |
| `T-MOD-502` | code maps: ANSI/Shift-JIS/Unicode layouts; wide vs narrow codes; `DefineFontInfo2` language | test-cited | `packages/swf/test/font-aux-tags.test.ts` |
| `T-MOD-503` | `FontLeading` negative values; ascent/descent unsigned; metrics carried unscaled | test-cited | `packages/swf/test/font-metrics.test.ts` |
| `T-MOD-504` | static text: multi-run fixture (style inheritance), per-run matrix/colour, `TextHeight` scaling | test-cited | `packages/swf/test/text.test.ts` |
| `T-MOD-505` | static text placement matches a hand-computed table (X/Y offsets as absolutes) | test-cited | `packages/swf/test/text-layout.test.ts` |
| `T-MOD-506` | `DefineFont`/`2` offset-table base, `nGlyphs` inference, `CodeTableOffset` base | test-cited | `packages/swf/test/font-aux-tags.test.ts` |
| `T-MOD-507` | HTML subset parser: nesting, unknown tags, entities, quoted/unquoted attributes | scheduled/unwired | Scheduled/unwired → P9; WP-080-12 |
| `T-MOD-508` | password/`MaxLength` enforcement in the runtime input path | scheduled/unwired | Scheduled/unwired → P9; doc-080 |
| `T-MOD-509` | atlas: coverage preserved; 1-px stem; deterministic packing | test-cited | `apps/decompiler/test/assets-dump.test.ts` |
| `T-MOD-510` | subsetting reachability (static runs, field strings, IR literals); UTF-8 font names | test-cited | `packages/swf/test/font-metrics.test.ts` |
| `T-MOD-511` | `DefineFont4` CFF retains name/flags, leaves `font` null, and emits `SF0270`; app manifest is `T-AST-027` | test-cited | `packages/swf/test/font-aux-tags.test.ts` |
| `T-MOD-512` | `TextBox`/`TEXTRECORD` terminator: zero byte ends the list; `TextRecordType` always 1 | test-cited | `packages/swf/test/text-layout.test.ts` |
| `T-MOD-513` | `TEXTRECORD` field order with both offsets set (XOffset read before YOffset) — `E-017` | test-cited | `packages/swf/test/text-layout.test.ts` |
| `T-MOD-514` | `DefineEditText`: all 16 flags; `FontHeight` under `HasFontClass`; `VariableName` verbatim | test-cited | `packages/swf/test/text.test.ts` |
| `T-MOD-515` | align zones (`NumZoneData = 2`, masks) + CSM cutoffs from the chapter's formulas | test-cited | `packages/swf/test/font-aux-tags.test.ts` |
| `T-MOD-516` | `CodeTable` unsorted → sorted copy for lookup, raw order kept, `SF0276` | test-cited | `packages/swf/test/font-metrics.test.ts` |
| `T-MOD-517` | device-only font (`NumGlyphs = 0`) with and without `CodeTableOffset` | test-cited | `packages/swf/test/font-aux-tags.test.ts` |
| `T-MOD-518` | indirect font name resolution recorded as indirect (never as a literal family) | test-cited | `packages/swf/test/font-aux-tags.test.ts` |

### IMPL-090 — Sounds (15 obligations: 14 test-cited, 1 scheduled/unwired)

| ID | Obligation | Status / owner | Evidence |
|---|---|---|---|
| `T-AUD-101` | ADPCM decode vs reference vectors on 200 packets (bit-exact) | test-cited | `apps/decompiler/test/assets-dump.test.ts`; `packages/audio/test/adpcm.test.ts` |
| `T-AUD-102` | ADPCM framing: 2–5-bit codes, mono/stereo packets, 4095-code boundary, short final packet, and real-world payload lengths pinning 4096 samples per packet against `ruffle`'s 4095 (`IMPL-090-R012`/`R034`) | test-cited | `packages/audio/test/adpcm.test.ts` |
| `T-AUD-103` | formats 0/3 produce identical 8-bit PCM; both read 16-bit PCM little-endian, with `SF0302` recording format 0's assumed order | test-cited | `packages/audio/test/media-codecs.test.ts` |
| `T-AUD-104` | MP3 frame parser: sync, version/layer/rate/bitrate/padding, size formula incl. the 414-byte example | test-cited | `packages/audio/test/media-codecs.test.ts` |
| `T-AUD-105` | MP3 pass-through: bytes unchanged (hash equality), latency trim applied at scheduling | test-cited | `apps/decompiler/test/audio-assets.test.ts` |
| `T-AUD-106` | stream block → frame offset table with exact sample offsets (silent frames, empty blocks) | test-cited | `packages/swf/test/sound-stream-model.test.ts`; `packages/swf/test/sound-stream-split.test.ts`; `packages/swf/test/sounds.test.ts` |
| `T-AUD-107` | silent frames advance the timeline; audio stays in sync (`SampleCount = 0` blocks) | test-cited | `packages/swf/test/sound-stream-model.test.ts` |
| `T-AUD-108` | stream splitting on a second head tag; codec change mid-movie | test-cited | `packages/swf/test/sound-stream-split.test.ts` |
| `T-AUD-109` | `SOUNDINFO` flag byte (MSB-first), in/out points, loop count, envelope conversion | test-cited | `packages/audio/test/media-codecs.test.ts`; `packages/swf/test/sound-stream-model.test.ts`; `packages/swf/test/sounds.test.ts` |
| `T-AUD-110` | resample determinism: same input → identical bytes across runs | test-cited | `packages/audio/test/media-codecs.test.ts` |
| `T-AUD-111` | chunking at 10 s with exact sample boundaries; loop points survive trimming | test-cited | `apps/decompiler/test/audio-assets.test.ts`; `packages/audio/test/measure.test.ts` |
| `T-AUD-112` | peak/RMS metadata on fixtures with known amplitude | test-cited | `apps/decompiler/test/audio-assets.test.ts`; `packages/audio/test/measure.test.ts` |
| `T-AUD-113` | `SoundStreamHead`/`Head2` bit layout (2-byte flags block, `LatencySeek` only for MP3) | test-cited | `packages/swf/test/sounds.test.ts` |
| `T-AUD-114` | frame subdivision emulation reproduces the chapter's worked examples (343 and 131) | scheduled/unwired | Scheduled/unwired → P8; WP-090-09 |
| `T-AUD-115` | Nellymoser/Speex/reserved formats: correct duration, silent partial, manifest flag | test-cited | `apps/decompiler/test/assets-dump.test.ts` |

**Subtotal:** 81 IMPL obligations: 74 test-cited and 7 scheduled/unwired. This is document-obligation coverage, not the full Vitest test count.

### Separate asset-dump obligations — C6

| ID | Obligation | Status | Test file |
|---|---|---|---|
| `T-AST-023` | Deterministic WOFF2/font atlas variants, including wide-code cases. | pass | `apps/decompiler/test/assets-dump.test.ts`; `packages/assets/test/font-variants.test.ts`; `packages/assets/test/fonts.test.ts` |
| `T-AST-024` | Morph endpoint shape previews. | pass | `apps/decompiler/test/assets-dump.test.ts` |
| `T-AST-025` | Sorted multi-kind asset manifest, media outputs, hashes and pinned tree hash. | pass | `apps/decompiler/test/assets-dump.test.ts` |
| `T-AST-026` | Repeat-run output names and SHA-256 tree identity. | pass | `apps/decompiler/test/assets-dump.test.ts` |
| `T-AST-027` | Unsupported/quarantine and silent-fallback branches remain explicit and non-throwing. | pass | `apps/decompiler/test/assets-dump.test.ts` |

### C7 regression tests — namespaced and gate-declared

| ID | Regression pinned | Status / test file |
|---|---|---|
| `T-P3-REG-001` | Unknown static fill payload is quarantined at the owning tag boundary; no invented geometry. | pass · `packages/swf/test/shape-styles.test.ts` |
| `T-P3-REG-002` | Unknown root and LINESTYLE2 morph fills are quarantined without secondary parse errors. | pass · `packages/swf/test/morph.test.ts` |
| `T-P3-REG-003` | Unsupported shape asset writes no placeholder PNG and does not block the next valid shape. | pass · `apps/decompiler/test/assets-dump.test.ts` |
| `T-P3-REG-004` | Shared static quantise-before-simplify path is idempotent for preview and VectorShape→GFX conversion. | pass · `apps/decompiler/test/geometry-prepare.test.ts` |
| `T-P3-REG-005` | Static half-away rounding and morph final ties-to-even are separate policies. | pass · `packages/swf/test/morph-ir.test.ts` |
| `T-P3-REG-006` | Glyph quarantine withholds only outline; slot, code, advance and bounds remain in atlas output. | pass · `apps/decompiler/test/assets-dump.test.ts` |
| `T-P3-REG-007` | Morph adapter applies ties-to-even once at the GFX tessellation boundary. | pass · `apps/decompiler/test/geometry-prepare.test.ts` |
| `T-P3-REG-008` | Short morph endpoint suffix is zero-padded at its last local anchor; `SF0261` remains emitted. | pass · `packages/swf/test/morph.test.ts` |
| `T-P3-REG-009` | A finite bake strategy emits `SF0262` even when `SF0263` then drops the over-budget mesh. | pass · `packages/swf/test/morph-ir.test.ts` |

**Total evidence inventory:** 81 IMPL obligations + 5 additive C6 asset obligations + 9 C7 regression rows. The 9 regression IDs are also recognized by `audit:dev`; they are not counted as IMPL test obligations.

**Counting rule:** the 81 rows above are the four P3 IMPL-document obligations only. The five C6 `T-AST-023`–`027` obligations and nine C7 `T-P3-REG-*` regressions are additive, not folded into the 81. The seven scheduled/unwired IMPL obligations are P4/P6/P8/P9 forwards listed explicitly in the WP ledger.

## 4. Diagnostic ledger

**Status semantics:** `emitted` means a production-source diagnostic sink site is present and recognized by `audit:dev`; it does not imply a P4/P8/P9 consumer is already wired. In particular `SF0262`/`SF0263` have a tested P3 API emission path, while the production placement caller is P4. The two genuinely deferred codes carry explicit later-phase owners.

### SF0180–SF0195

| Code | Severity | Registry meaning | Status / forward owner | Source emission site |
|---|---|---|---|---|
| `SF0180` | error | `SHAPE_FILL_TYPE_UNKNOWN` | emitted | `packages/swf/src/tags/morph.ts`, `packages/swf/src/tags/shape.ts` |
| `SF0181` | error | `SHAPE_STYLE_INDEX_RANGE` | emitted | `packages/swf/src/tags/shape.ts` |
| `SF0182` | error | `SHAPE_INDEX_WIDTH_INVALID` | emitted | `packages/swf/src/tags/shape.ts` |
| `SF0183` | info | `SHAPE_TAG_NEWER_THAN_VERSION` | emitted | `packages/swf/src/tags/shape.ts` |
| `SF0184` | warning | `SHAPE_RECORD_DEGENERATE` | emitted | `packages/swf/src/tags/shape.ts` |
| `SF0185` | info | `SHAPE_EMPTY_SUBPATH` | emitted | `packages/swf/src/tags/shape.ts` |
| `SF0186` | warning | `SHAPE_IMPLICIT_CLOSE` | emitted | `packages/swf/src/tags/shape.ts` |
| `SF0187` | warning | `SHAPE_BOUNDS_DISAGREE` | emitted | `packages/swf/src/tags/shape.ts` |
| `SF0188` | info | `SHAPE_RESERVED_FLAG_BITS` | emitted | `packages/swf/src/tags/shape.ts` |
| `SF0189` | info | `SHAPE_UNUSED_STYLE` | emitted | `packages/swf/src/tags/shape.ts` |
| `SF0190` | warning | `SHAPE_STYLE_DEDUPE_CEILING` | emitted | `packages/swf/src/tags/shape.ts` |
| `SF0191` | info | `SHAPE_RESERVED_FEATURE` | emitted | `packages/swf/src/tags/morph.ts`, `packages/swf/src/tags/shape.ts` |
| `SF0192` | warning | `SHAPE_GRADIENT_MODE_INVALID` | emitted | `packages/swf/src/tags/morph.ts`, `packages/swf/src/tags/shape.ts` |
| `SF0193` | error | `SHAPE_GRADIENT_EMPTY` | emitted | `packages/swf/src/tags/morph.ts`, `packages/swf/src/tags/shape.ts` |
| `SF0194` | warning | `SHAPE_GRADIENT_STOP_ORDER` | emitted | `packages/swf/src/tags/shape.ts` |
| `SF0195` | info | `SHAPE_FOCAL_OUTSIDE_V4` | emitted | `packages/swf/src/tags/shape.ts` |

### SF0250–SF0269

| Code | Severity | Registry meaning | Status / forward owner | Source emission site |
|---|---|---|---|---|
| `SF0250` | error | `IMAGE_LOSSLESS_SIZE_MISMATCH` | emitted | `apps/decompiler/src/assets/dump.ts` |
| `SF0251` | error | `IMAGE_JPEG_TABLES_MISSING` | emitted | `apps/decompiler/src/assets/dump.ts` |
| `SF0252` | error | `IMAGE_JPEG_UNDECODABLE` | emitted | `apps/decompiler/src/assets/dump.ts` |
| `SF0253` | error | `IMAGE_ALPHA_LENGTH_MISMATCH` | emitted | `apps/decompiler/src/assets/dump.ts` |
| `SF0254` | info | `IMAGE_DEBLOCK_RECORDED` | emitted | `apps/decompiler/src/assets/dump.ts`, `packages/swf/src/tags/images.ts` |
| `SF0255` | warning | `IMAGE_JPEG_MARKER_MISSING` | emitted | `apps/decompiler/src/assets/dump.ts`, `packages/swf/src/tags/images.ts` |
| `SF0256` | warning | `IMAGE_PROGRESSIVE_JPEG` | emitted | `apps/decompiler/src/assets/dump.ts` |
| `SF0257` | warning | `IMAGE_MULTIPLE_JPEG_TABLES` | emitted | `apps/decompiler/src/assets/dump.ts`, `packages/swf/src/model/movie.ts` |
| `SF0258` | info | `IMAGE_JPEG_PREFIX_SKIPPED` | emitted | `apps/decompiler/src/assets/dump.ts` |
| `SF0259` | info | `IMAGE_LOSSLESS2_FORMAT4` | emitted | `apps/decompiler/src/assets/dump.ts`, `packages/swf/src/tags/images.ts` |
| `SF0260` | error | `IMAGE_FORMAT_UNKNOWN` | emitted | `apps/decompiler/src/assets/dump.ts`, `packages/swf/src/tags/images.ts` |
| `SF0261` | warning | `MORPH_EDGE_COUNT_MISMATCH` | emitted | `packages/swf/src/tags/morph.ts` |
| `SF0262` | info | `MORPH_STRATEGY_RECORDED` | emitted† (P3 API; production caller P4) | `packages/swf/src/shapes/morph-ir.ts` |
| `SF0263` | error | `MORPH_VERTEX_BUDGET_EXCEEDED` | emitted† (P3 API; production caller P4) | `packages/swf/src/shapes/morph-ir.ts` |
| `SF0264` | warning | `MORPH_OFFSET_MISMATCH` | emitted | `packages/swf/src/tags/morph.ts` |
| `SF0265` | warning | `MORPH_STYLE_MISMATCH` | emitted | `packages/swf/src/tags/morph.ts` |
| `SF0266` | info | `MORPH_RATIONAL_HALVED` | emitted | `packages/swf/src/tags/morph.ts` |
| `SF0267` | warning | `MORPH_GRADIENT_COUNT_MISMATCH` | emitted | `packages/swf/src/tags/morph.ts` |
| `SF0268` | warning | `MORPH_STYLE_RESTRICTION` | emitted | `packages/swf/src/tags/morph.ts` |
| `SF0269` | error | `IMAGE_ALPHA_ON_PNG_GIF` | emitted | `apps/decompiler/src/assets/dump.ts` |

### SF0270–SF0289

| Code | Severity | Registry meaning | Status / forward owner | Source emission site |
|---|---|---|---|---|
| `SF0270` | error | `FONT_CFF_UNSUPPORTED` | emitted | `packages/swf/src/model/movie.ts` |
| `SF0271` | warning | `FONT_OFFSET_TABLE_INVALID` | emitted | `packages/swf/src/tags/fonts.ts` |
| `SF0272` | warning | `FONT_GLYPH_INDEX_INVALID` | emitted | `packages/swf/src/tags/text.ts` |
| `SF0273` | warning | `FONT_GLYPH_CODE_MISSING` | emitted | `packages/swf/src/tags/text.ts` |
| `SF0274` | warning | `FONT_TEXT_HEIGHT_MISSING` | emitted | `packages/swf/src/tags/text.ts` |
| `SF0275` | info | `FONT_METRICS_DERIVED` | emitted | `packages/swf/src/tags/fonts.ts` |
| `SF0276` | warning | `FONT_CODE_TABLE_UNSORTED` | emitted | `packages/swf/src/tags/fonts.ts` |
| `SF0277` | info | `FONT_HINTING_IGNORED` | emitted | `packages/swf/src/model/movie.ts` |
| `SF0278` | warning | `FONT_HINT_TARGET_INVALID` | emitted | `packages/swf/src/model/movie.ts`, `packages/swf/src/tags/fonts.ts` |
| `SF0279` | warning | `FONT_HTML_UNKNOWN_TAG` | forward → `WP-080-12` | — |
| `SF0280` | warning | `FONT_DEVICE_FIELD_UNSUPPORTED` | emitted | `packages/swf/src/tags/text.ts` |
| `SF0281` | warning | `FONT_GLYPH_FILL_INVALID` | emitted | `packages/swf/src/tags/fonts.ts` |
| `SF0282` | info | `FONT_DEVICE_ONLY` | emitted | `packages/swf/src/model/movie.ts` |
| `SF0283` | error | `FONT_INFO2_WIDE_CODES_MISSING` | emitted | `packages/swf/src/tags/fonts.ts` |
| `SF0284` | info | `FONT_INDIRECT_NAME` | emitted | `packages/swf/src/tags/fonts.ts` |
| `SF0285` | info | `FONT_HEIGHT_CLASS_TOLERATED` | emitted | `packages/swf/src/tags/text.ts` |

### SF0300–SF0332

| Code | Severity | Registry meaning | Status / forward owner | Source emission site |
|---|---|---|---|---|
| `SF0300` | warning | `SOUND_MP3_NONCANONICAL` | emitted | `packages/swf/src/tags/sounds.ts` |
| `SF0301` | error | `SOUND_FORMAT_RESERVED` | emitted | `apps/decompiler/src/assets/dump.ts`, `packages/swf/src/tags/sounds.ts` |
| `SF0302` | info | `SOUND_PCM_ENDIAN_ASSUMED` | emitted | `packages/swf/src/tags/sounds.ts` |
| `SF0303` | warning | `SOUND_SPEEX_UNAVAILABLE` | emitted | `apps/decompiler/src/assets/dump.ts` |
| `SF0304` | warning | `SOUND_DATA_TRUNCATED` | emitted | `packages/swf/src/model/timeline.ts`, `packages/swf/src/tags/sounds.ts` |
| `SF0305` | info | `SOUND_MP3_PARAMETER_CHANGE` | emitted | `apps/decompiler/src/assets/dump.ts`, `packages/swf/src/model/timeline.ts` |
| `SF0306` | warning | `SOUND_MP3_SEEK_DISCONTINUITY` | emitted | `apps/decompiler/src/assets/dump.ts`, `packages/swf/src/model/timeline.ts` |
| `SF0307` | warning | `SOUND_NELLYMOSER_UNAVAILABLE` | emitted | `apps/decompiler/src/assets/dump.ts` |
| `SF0308` | warning | `SOUND_MP3_SYNC_LOST` | emitted | `apps/decompiler/src/assets/dump.ts`, `packages/swf/src/model/timeline.ts` |
| `SF0309` | info | `SOUND_CLASS_UNSUPPORTED` | emitted | `packages/swf/src/tags/sounds.ts` |
| `SF0324` | warning | `SOUND_SAMPLE_COUNT_MISMATCH` | emitted | `apps/decompiler/src/assets/dump.ts`, `packages/swf/src/model/timeline.ts` |
| `SF0325` | info | `SOUND_STREAM_SPLIT` | emitted | `packages/swf/src/model/timeline.ts` |
| `SF0326` | info | `SOUND_RATE_MISMATCH` | emitted | `packages/swf/src/tags/sounds.ts` |
| `SF0327` | warning | `SOUND_ZERO_PAYLOAD` | emitted | `apps/decompiler/src/assets/dump.ts`, `packages/swf/src/model/timeline.ts` |
| `SF0328` | error | `SOUND_ADPCM_MALFORMED` | emitted | `apps/decompiler/src/assets/dump.ts`, `packages/swf/src/model/timeline.ts` |
| `SF0329` | info | `SOUND_TRANSCODE_APPLIED` | forward → `WP-090-12` | — |
| `SF0330` | warning | `SOUND_LATENCY_SEEK_MISMATCH` | emitted | `packages/swf/src/model/timeline.ts` |
| `SF0331` | info | `SOUND_ZERO_BLOCK` | emitted | `packages/swf/src/tags/sounds.ts` |
| `SF0332` | info | `SOUND_MONO_ENVELOPE_MISMATCH` | emitted | `packages/swf/src/tags/sounds.ts` |

**Census:** 71 registered codes in the four requested ranges; 69 emission sites, 2 explicit forwards (`SF0279` → WP-080-12/P9, `SF0329` → WP-090-12/P6), 0 P3-range unmapped codes. The global audit also retains known P5 AVM1-range diagnostic gaps; those are outside P3 and are not counted as P3 failures.

## 5. Rule-by-rule audit of the four P3 implementation documents

The table has one row per declared rule. “P3 pass” means the decoding/model/build part is implemented and its local evidence is cited; where the rule also describes later behavior, that portion is marked as an explicit phase forward rather than silently claimed complete.

### IMPL-060 (52 rules)

| Rule | C7 disposition | Evidence / forward owner |
|---|---|---|
| `IMPL-060-R001` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R002` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R003` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R004` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R005` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R006` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R007` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R008` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R009` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R010` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R011` | P3 pass | `T-MOD-104` |
| `IMPL-060-R012` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R013` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R014` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R015` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R016` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R017` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R018` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R019` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R020` | P3 representation pass; renderer behavior forwards to P4 | module-map/source review; no unique test ID declared on this rule; WP-060-12/14 or IMPL-130 geometry integration |
| `IMPL-060-R021` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R022` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R046` | P3 pass | `T-MOD-112` |
| `IMPL-060-R047` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R048` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R049` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R050` | P3 pass | `T-MOD-112` |
| `IMPL-060-R051` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R052` | P3 pass | `T-MOD-123` |
| `IMPL-060-R023` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R024` | P3 pass | `T-MOD-114` |
| `IMPL-060-R025` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R026` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R027` | P3 pass | `T-MOD-115` |
| `IMPL-060-R028` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R029` | P3 pass | `T-MOD-123` |
| `IMPL-060-R030` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R031` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R032` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R033` | P3 representation pass; renderer behavior forwards to P4 | `T-MOD-111`; WP-060-12/14 or IMPL-130 geometry integration |
| `IMPL-060-R034` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R035` | P3 pass | `T-MOD-107`, `T-MOD-201` |
| `IMPL-060-R036` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R037` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R038` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R039` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R040` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-060-R041` | P3 pass | `T-MOD-101`, `T-MOD-102`, `T-MOD-103`, `T-MOD-104` (+23 further citations; see test ledger) |
| `IMPL-060-R042` | P3 representation pass; renderer behavior forwards to P4 | module-map/source review; no unique test ID declared on this rule; WP-060-12/14 or IMPL-130 geometry integration |
| `IMPL-060-R043` | P3 representation pass; renderer behavior forwards to P4 | module-map/source review; no unique test ID declared on this rule; WP-060-12/14 or IMPL-130 geometry integration |
| `IMPL-060-R044` | P3 representation pass; renderer behavior forwards to P4 | module-map/source review; no unique test ID declared on this rule; WP-060-12/14 or IMPL-130 geometry integration |
| `IMPL-060-R045` | P3 representation pass; renderer behavior forwards to P4 | `T-MOD-103`, `T-MOD-111`, `T-MOD-113`, `T-MOD-116` (+3 further citations; see test ledger); WP-060-12/14 or IMPL-130 geometry integration |

### IMPL-070 (35 rules)

| Rule | C7 disposition | Evidence / forward owner |
|---|---|---|
| `IMPL-070-R001` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R002` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R003` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R004` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R005` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R006` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R007` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R008` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R009` | P3 pass | `T-MOD-302`, `T-MOD-309` |
| `IMPL-070-R010` | P3 pass | `T-MOD-303`, `T-MOD-311` |
| `IMPL-070-R011` | P3 pass | `T-MOD-310` |
| `IMPL-070-R012` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R013` | P3 pass | `T-AST-002`, `T-MOD-304` |
| `IMPL-070-R014` | P3 pass | `T-MOD-306` |
| `IMPL-070-R015` | P6 forward (classification/manifest heuristics) | module-map/source review; no unique test ID declared on this rule; WP-070-06/P6 |
| `IMPL-070-R016` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R017` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R018` | P3 pass | `T-MOD-313` |
| `IMPL-070-R019` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R020` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R021` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R022` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R023` | P3 model/API pass; production placement binding forwards to P4 | module-map/source review; no unique test ID declared on this rule; IMPL-130 WP-130-04/05 |
| `IMPL-070-R024` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R025` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R026` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R027` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R028` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R029` | P3 pass; C7 anchor semantics pinned | module-map/source review; no unique test ID declared on this rule; `T-P3-REG-008` |
| `IMPL-070-R030` | P3 pass | `T-MOD-407` |
| `IMPL-070-R031` | P3 pass | `T-MOD-401` |
| `IMPL-070-R032` | P3 model/API pass; production placement binding forwards to P4 | R032 cases in `packages/swf/test/morph-ir.test.ts`, including `T-P3-REG-009`; IMPL-130 WP-130-04/05 |
| `IMPL-070-R033` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R034` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-070-R035` | P3 pass | `T-AST-001`, `T-MOD-301`, `T-MOD-302`, `T-MOD-303` (+18 further citations; see test ledger) |

### IMPL-080 (44 rules)

| Rule | C7 disposition | Evidence / forward owner |
|---|---|---|
| `IMPL-080-R001` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R002` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R003` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R004` | P3 pass | `T-MOD-501` |
| `IMPL-080-R005` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R006` | P3 pass | `T-MOD-504` |
| `IMPL-080-R007` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R008` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R009` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R010` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R011` | P3 pass | `T-MOD-506` |
| `IMPL-080-R012` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R013` | P3 pass | `T-MOD-503` |
| `IMPL-080-R014` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R015` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R016` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R017` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R018` | P3 pass | `T-MOD-510` |
| `IMPL-080-R019` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R020` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R021` | P3 pass | `T-MOD-504` |
| `IMPL-080-R022` | P3 pass | `T-MOD-514` |
| `IMPL-080-R023` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R024` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R025` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R026` | P3 pass | `T-MOD-505` |
| `IMPL-080-R027` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R028` | P3 pass | `T-MOD-514` |
| `IMPL-080-R029` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R030` | P3 pass | `T-MOD-516` |
| `IMPL-080-R031` | P3 field/model pass; runtime layout behavior forwards to P9 | module-map/source review; no unique test ID declared on this rule; WP-080-12/P9 |
| `IMPL-080-R032` | P3 field/model pass; runtime layout behavior forwards to P9 | `T-MOD-514`; WP-080-12/P9 |
| `IMPL-080-R033` | P3 field/model pass; runtime layout behavior forwards to P9 | module-map/source review; no unique test ID declared on this rule; WP-080-12/P9 |
| `IMPL-080-R034` | P3 field/model pass; runtime layout behavior forwards to P9 | module-map/source review; no unique test ID declared on this rule; WP-080-12/P9 |
| `IMPL-080-R035` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R036` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R037` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R038` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R039` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R040` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R041` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-080-R042` | P3 pass | `T-MOD-509` |
| `IMPL-080-R043` | static/P3 model pass; dynamic reachability forwards to P6 | `T-MOD-510`; WP-080-11/P6 |
| `IMPL-080-R044` | P3 pass | `T-AST-023`, `T-AST-027`, `T-MOD-501`, `T-MOD-502` (+16 further citations; see test ledger) |

### IMPL-090 (34 rules)

| Rule | C7 disposition | Evidence / forward owner |
|---|---|---|
| `IMPL-090-R001` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R002` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R003` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R004` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R005` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R006` | P3 pass | `T-AUD-103` |
| `IMPL-090-R007` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R008` | P3 MP3 pass-through pass; transcode ledger forwards to P6 | `T-AUD-105`; WP-090-12/P6 (`SF0329`) |
| `IMPL-090-R009` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R010` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R011` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R012` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R013` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R034` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R014` | P3 pass | `T-AUD-101` |
| `IMPL-090-R015` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R016` | P3 pass | `T-AUD-109` |
| `IMPL-090-R017` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R018` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R019` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R020` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R021` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R022` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R023` | P3 pass | `T-AUD-113` |
| `IMPL-090-R024` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R025` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R026` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R027` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R028` | P8 forward (frame subdivision) | module-map/source review; no unique test ID declared on this rule; WP-090-09/P8 (`T-AUD-114`) |
| `IMPL-090-R029` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R030` | P3 pass | `T-AUD-110`, `T-AUD-111` |
| `IMPL-090-R031` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R032` | P3 pass | module-map/source review; no unique test ID declared on this rule |
| `IMPL-090-R033` | P3 loop metadata pass; runtime cross-fade forwards to P8/P9 | `T-AUD-001`, `T-AUD-101`, `T-AUD-102`, `T-AUD-103` (+12 further citations; see test ledger); WP-090-09/P8 |

## 6. Behavioral probe results

| Probe | Result / oracle |
|---|---|
| Unknown static fill, unknown morph fill, and unknown LINESTYLE2 fill | `T-P3-REG-001/002`: each returns the owning-tag quarantine (`SF0180`), consumes the owning payload exactly once, and does not emit secondary parse errors or placeholder geometry. |
| Asset-dump quarantine | `T-P3-REG-003`: the invalid shape is `unsupported` with `SF0180`; no placeholder PNG is written, while a following valid shape still emits. |
| Static geometry pipeline | `T-P3-REG-004`: quantise precedes simplification; the preview and VectorShape→GFX adapter share an idempotent prepared shape; authored IR is not mutated. |
| Static vs morph rounding | `T-P3-REG-005/007`: static geometry keeps half-away-from-zero grid symmetry; rational morph twips use ties-to-even exactly once at the final GFX tessellation boundary. At 4.5 twips the morph adapter emits 4 twips while the static tie would choose 5. |
| Quarantined glyph outline | `T-P3-REG-006`: the outline is withheld, but the glyph index, code, authored advance, and bounds remain in the atlas manifest; the atlas keeps the slot and does not shift later glyph/cmap indices. |
| Unequal morph edge counts | `T-P3-REG-008`: a missing suffix edge is zero-length at the shorter endpoint's last decoded local anchor (or `(0,0)` if it has no edges); later edge indices remain stable and `SF0261` is emitted. |
| `SF0262` strategy meaning | The R032 cases in `packages/swf/test/morph-ir.test.ts` confirm default runtime interpolation, successful finite baking, and an over-budget finite bake all emit `SF0262`; a dropped mesh additionally emits `SF0263`. The registry meaning and constant name now describe strategy selection, not baking-only. |
| JPEG and lossless parity | `T-AST-001`–`004` and `T-MOD-301`–`313`: frozen payloads, explicit byte layouts, literal expected RGBA outputs, and a frozen ImageMagick 6.9.11-60 reference JPEG result. |
| PCM source behavior | C5's independently sourced Ruffle decoder references establish little-endian 16-bit PCM for formats 0 and 3; Ruffle's 8-bit conversion is `(u8 − 127) × 128`. This repository deliberately uses full-scale unsigned expansion `(u8 − 128) × 256` and pins its chosen mapping in `T-AUD-103`; it does not claim amplitude-level parity with that Ruffle implementation. |
| Morph path caller | `morphToGeometry()` is unit-probed at the adapter boundary; it remains uncalled by the current static scene builder by design. P4 owns production placement binding (IMPL-070-R023, WP-130-04/05). |

### `audit:dev` behavioral probe

| Check | Output |
|---|---|
| Shape4 flag combinations | `ok=5/5`; the DefineShape-v1 literal-255 style-count probe is `True`. |
| Synthetic model/diagnostic dump | `keys=9`, `frames=1`, `bytes=3931`; clean path has no synthetic diagnostics; dirty path reports `SF0023`, `SF0124`, `SF0116`, `SF0153` as expected. |
| Audit decision | `audit:dev` reports `NEW FINDINGS: 0`; P3 audit rows are declared and later-phase diagnostics resolve to WP-080-12/P9 and WP-090-12/P6. |

## 7. Severity-ranked findings

| Finding | Severity | Resolution / disposition |
|---|---|---|
| **F-P3-23 — false morph/render cross-references in IMPL-070** | Moderate documentation defect | **Fixed.** GFX-D14 is gradient-ramp dithering, and GFX-R052 is 8-bit texture expansion; neither defines morph rendering. IMPL-070-R023/R032 now cite the P3 placement ratio and P4 caller boundary. `SF0262` no longer attributes its strategy to the unrelated GFX decision. |
| **F-P3-24 — false renderer-cache/draw-budget/stroke references in IMPL-060** | Moderate documentation defect | **Fixed.** IMPL-060-R042/R043/R045 now distinguish identity-based mesh caching, draw-call coalescing, hairline width, device-pixel flatten tolerance, and stage-space stroke expansion. |
| **F-P3-25 — SF0262 registry wording did not match emitted runtime strategy** | Moderate diagnostic-contract defect | **Fixed.** The symbolic code is now `MORPH_STRATEGY_RECORDED`; registry/message describe strategy selection. The over-budget branch now emits this info decision before `SF0263`, so runtime, successful bake, and dropped finite bake are all distinguishable; `T-P3-REG-009` pins the previously silent branch. |
| **F-P3-26 — glyph quarantine language implied whole-glyph removal** | Moderate data-integrity risk | **Fixed and regression-pinned.** `SF0281` says only the outline is withheld; slot/index, code map, authored advance and bounds remain, so atlas/preview indices do not shift. |
| **F-P3-28 — audit evidence could be hidden by missing P3 module/test ownership maps** | Moderate audit-integrity defect | **Fixed.** `audit_dev.py` requires all 060/070/080/090 implementation modules, validates forward-owner phases, recognizes namespaced `T-P3-REG-*` declarations, and tests the failure modes. |
| **F-P3-27 — unequal-edge suffix anchor was underspecified** | Low behavior-contract ambiguity | **Fixed and regression-pinned.** IMPL-070-R029 identifies the shorter endpoint's last local anchor, with `(0,0)` fallback; `T-P3-REG-008` covers a one-edge vs two-edge case. |
| **F-P3-29 — WP-070-13 pointed at a P6 dependency despite being P3 decode parity** | Low traceability defect | **Fixed.** The WP now depends on P3 image decode packages and names the existing frozen fixture/reference-pixel suite; P6 re-encode/mipmap obligations remain WP-070-06…09. |
| **F-P3-30 — C5 endian summary could be read as implying Ruffle amplitude equivalence** | Low evidence-precision issue | **Fixed in the checkpoint wording.** Little-endian source behavior is distinguished from the repository's explicitly chosen 8-bit full-scale amplitude expansion; `T-AUD-103` pins the local contract. |

Earlier findings F-P3-01…22 are closed or explicitly carried by the C1–C6 mini-audits. The former F-P3-11 quantise/simplify wiring and F-P3-14 morph rounding items are closed by the shared geometry boundary and final ties-to-even adapter tests; F-P3-17's emission-scanner blind spot is closed by the C7 audit-tool hardening.

## 8. Open-items ledger (explicit later-phase ownership)

| Item | Owner | Status / impact |
|---|---|---|
| Fill winding to tessellator; gradient mode/focal plumbing to sampler | WP-060-12/14, P4 | Open by design; P3 preserves the inputs. `T-MOD-111` covers the P3 fill-rule model; tessellator consumption is P4. `T-MOD-122` is the scheduled sampler hand-off. |
| Morph timeline placement → `morphToGeometry()` | IMPL-130 WP-130-04/05, P4 | Open integration edge; endpoint/interpolation adapter is tested, but the current static scene builder does not pass placement ratios. |
| Image classification, re-encode/mips, `.sfa`, texture budgets | WP-070-06…09, P6 | Open by design; `T-MOD-306`–`308` remain scheduled. |
| Dynamic font subset reachability | WP-080-11, P6 | Open by design. |
| Runtime text measurement/layout/HTML | WP-080-12, P9 | Open by design; `SF0279`, `T-MOD-507`/`508` are explicit P9 items. Runtime layout is doc 130; P9-owned `/packages/text` is not yet present. |
| Frame-subdivision audio writer/emulator | WP-090-09, P8 | Open by design; `T-AUD-114` remains scheduled. |
| Transcode/budget reporting | WP-090-12, P6 | Open by design; `SF0329` is the only sound-range deferred diagnostic. |
| Broader external bitmap corpus | P3 evidence follow-up (non-gating) | The repository currently has frozen deterministic fixture/reference-pixel tests rather than a broad external real-world bitmap corpus. Do not treat the 65-tag registry coverage as pixel-parity evidence; the current P3 literal/reference vectors are the evidence. |
| AVM1 diagnostic gaps | P5 | Global `audit:dev` known set; outside the four P3 diagnostic ranges. No P3-owned deferred code is hidden in this list. |

## 9. P3 done-criteria status

| Roadmap criterion | Status | Evidence |
|---|---|---|
| `forge-decompile assets dump` emits deterministic shape/bitmap previews, supported-font WOFF2, PCM/ADPCM WAV, MP3 pass-through and diagnosed fallbacks | **Pass** | `T-AST-023`–`027`; C6 multi-kind manifest, hashes, unsupported/fallback cases, and two-run tree identity. |
| Production model exposes decoded `VectorShape`; edge widths, fill rules and style-change records are covered | **Pass for P3 model.** Tessellator consumption is P4. | T-SWF-005/006; P3 shape obligations; C7 fill quarantine and shared static-preparation regressions. |
| P3 image/morph, font/text and sound tags decode into typed models | **Pass** | 81 IMPL test obligations, with seven explicit later-phase scheduled items; C7 rule and diagnostic ledgers. |
| ADPCM matches independent reference vectors; bitmap output matches independent/reference pixel data | **Pass with evidence scope noted** | T-AUD-101/102 independent vectors; T-AST-001–004 and T-MOD-301–313 frozen/reference fixtures. |
| WOFF2 and supported build-time atlas outputs are reproducible; CFF/unsupported codecs are diagnosed | **Pass** | T-AST-023–027, `T-P3-REG-006`, font/audio quarantine probes. |
| Runtime text/input, audio sync, full-timeline rendering and video remain outside P3 | **Pass / explicitly deferred** | P9/P8/P4/P10 owners, not P3 acceptance criteria. |

## 10. Final acceptance gates

| Gate | Command | Final result |
|---|---|---|
| Typecheck | `corepack pnpm typecheck` | **Pass** — 8 workspace projects; root build and all project test tsconfigs typecheck. |
| Full test suite | `corepack pnpm test` | **Pass — 59 files / 689 tests.** |
| Lint + formatting | `corepack pnpm lint` | **Pass** — ESLint and Prettier clean. |
| Build | `corepack pnpm build` | **Pass** — `tsc -b` plus both app builds. |
| Spec verification | `corepack pnpm spec:verify` | **Pass — ISSUES: 0.** |
| Development audit | `corepack pnpm audit:dev` | **Pass — findings=52, known=57, new=0, fixed=5.** Registry: 188 total; 173 sink-emitted, 1 exception-reported, 2 deferred, 12 unmapped (P5 AVM1). |
| Tag coverage | `corepack pnpm tag:coverage` | **Pass — 56 decoded + 1 pending + 5 retained + 3 structural = 65/65 dispositioned; all evidence verifies.** |
| Audit-tool tests | `corepack pnpm test:audit` | **Pass — 78 Python tests.** |
| 10⁴-fuzz | `corepack pnpm test:fuzz` | **Pass — 2 tests; 10,000 seeded mutations, zero uncaught exceptions.** |
| Whitespace check | `git diff --check` | **Pass.** |

Final acceptance is based on the actual C7 runs above. The checkpoint's earlier ~495–510 test estimate is obsolete; C6's 58-file / 681-test baseline and the measured C7 total are the comparison points.
