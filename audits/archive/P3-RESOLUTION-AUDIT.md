# P3 Resolution Audit

**Date:** 2026-10-05 · **Branch:** `arena/01a10cd9-swf-forge`
**Status:** Partial implementation; **P3 remains open**. Current source changes and gate evidence are recorded in §6; remaining format, ratio-rendering, sound-metadata and integrated-bundle gates prevent closure.
**Input:** [`P3-INTEGRITY-AUDIT.md`](P3-INTEGRITY-AUDIT.md), findings F1–F5.
**Authorities:** `docs/impl/000-roadmap.md`; `IMPL-060`, `IMPL-070`, `IMPL-080`, `IMPL-090`; AST (`docs/specs/web/070-assets-fonts-bitmaps-video.md`); AUD (`docs/specs/web/060-audio-web.md`); the SWF format tests and diagnostic allocations.

---

## 1. Resolution principles and phase boundary

The resolutions preserve the existing phase architecture: P3 decodes SWF media and emits inspectable build-time assets; it does **not** claim the later browser renderer, runtime, mixer, or video work is complete.

| Capability | Resolution owner | Explicitly not part of this P3 closure |
| --- | --- | --- |
| Shape, bitmap/morph, font/text, and sound tag decoding; deterministic asset previews and build artifacts | **P3** (`IMPL-060/070/080` plus the decode/asset portion of `IMPL-090`) | — |
| Browser/WebGL rendering of a complete no-script timeline | P4 | P3's per-shape preview PNG is not the P4 movie renderer |
| AVM1 analysis/emission and runtime text behavior | P5–P7/P9 | P3 parses text/font records and preserves their decoded model only |
| Audio mixer, Web Audio scheduling, real-time stream sync | P8 | P3 parses/decodes media and prepares assets; no mixer claim |
| Video decode | P10 / `IMPL-110` | Not a P3 failure or P3 completion item |

There are two roadmap boundary defects to resolve before re-scoring. First, P3's phase row says Chapters 6–10, while its document map includes `IMPL-090` (Chapter 11); P8 also lists Chapter 11. Resolution: describe P3 as Chapters 6–10 **plus the Chapter 11 media-decode/build subset** (sound tag decoding, ADPCM, MP3 framing/pass-through, stream-block association and build assets); P8 owns the runtime audio engine and its playback/sync gates. Second, the document map lists video doc 110 under P3 even though the phase table places Chapter 14 video in P10. Remove 110 from the P3 row and keep it under P10.

## 2. Contract decisions

These decisions settle the output and CLI ambiguities before implementation. They intentionally align the roadmap with the normative asset/audio specifications rather than silently weakening those specifications or claiming that incompatible formats are equivalent.

| Question | Resolution | Authority / consequence |
| --- | --- | --- |
| CLI name and form | Implement `forge-decompile assets dump <file.swf> --out <dir>` using the existing decompiler binary. Update the roadmap's `swfforge assets dump` wording to the actual command; do not add a second product binary as part of P3. | `apps/decompiler/package.json` exposes `forge-decompile`; P2 resolution already aligned the roadmap's `dump` command with it. |
| Font artifact: TTF or WOFF2? | **WOFF2 is the required artifact.** A deterministic WOFF2 is emitted for fonts whose outlines are supported; `DefineFont4` CFF follows the specified `SF0270` fallback. TTF may be an optional developer conversion later, not the P3 pass condition. | AST-R023 mandates WOFF2; IMPL-080-R005 names WOFF2 output. Amend the roadmap's TTF gate and phase summary; add a WOFF2 determinism test. |
| Audio artifact: WAV for every sound? | **Do not transcode every sound to WAV.** `assets dump` emits a WAV preview for decoded PCM/ADPCM and duration-correct silent fallbacks where the codec is intentionally unsupported; MP3 payloads remain byte-identical `.mp3` with trim/seek metadata. Production assets follow AUD's codec variants (Opus/WebM or Ogg, AAC fallback, MP3 pass-through). | AUD's codec ladder makes WAV a short-SFX/test-build format and preserves MP3. Forcing MP3→WAV would add a decoder contrary to IMPL-090's pass-through design. Amend the literal “WAV for every sound” gate to these per-codec outputs. |
| Why PNG for shapes if shapes are vector data? | Keep `VectorShape` as the model/production representation, and also emit one local-bounds PNG as a **debug preview** from the deterministic CPU reference raster path. Support the decoded solid, gradient, and bitmap fill cases; do not replace vector IR with baked pixels. | The roadmap asks for previews; AST/CMP require vector/layout data as the actual asset representation. P4 remains the full timeline/browser renderer. |
| P3 versus runtime text/audio | P3 owns parsing, model/asset generation and deterministic decode tests. Move dynamic text input/layout behavior, AVM1-driven font subsetting, Web Audio playback/sync, and browser rendering to their downstream owners. | IMPL-080 names runtime layout as a non-goal; roadmap places audio engine at P8 and fidelity hardening at P9. Add a phase annotation to the shared doc/test map so these are not used to mark P3 complete or to block the P3 decoder gate. |
| P3 effort estimate | Reconcile the 45–70 day roadmap estimate against per-document WP totals only after classifying decode versus P4/P6/P8/P9 work. Do not adopt 166 days as a remaining-effort estimate: that is the full 060–090 WP sum and includes work already implemented or owned by later phases. | Update the roadmap effort row and P3 document map after the split; make the estimate auditable by WP. |

The amended artifact contract supersedes the original audit's literal TTF/WAV wording; the original baseline remains historical evidence. The current repeat audit scores the revised WOFF2 and codec-appropriate output gates from observed tests rather than treating either format as a silent substitute for the earlier wording.

## 3. Resolution designs

### R-P3-01 ← P3-F5 (LOW): reconcile roadmap outputs, chapters, and estimates

1. Update `docs/impl/000-roadmap.md` P3 summary and exit-gate rows to the contract in §2:
   - actual CLI: `forge-decompile assets dump`;
   - deterministic PNG previews for each shape/bitmap;
   - WOFF2 font outputs per AST-R023, with documented CFF fallback;
   - audio output per codec (PCM/ADPCM WAV preview, MP3 pass-through, duration-correct silent fallback plus diagnostic).
2. Define P3 as `IMPL-060/070/080` plus the build/decode subset of `IMPL-090`. Put video doc 110 in P10 only. Split Chapter 11 decode work (P3) from the runtime audio engine (P8) in the phase table, dependency graph, and status map.
3. Add a phase-owner column or explicit labels to `IMPL-080`/`IMPL-090` obligations. P3 tests stop at decoded models and deterministic asset outputs. Runtime-only text and sound assertions remain tracked under P7–P9/P8 rather than disappearing.
4. Reconcile the effort table from the P3-owned WPs after that split; identify any new CLI/preview WP in the owning implementation document and include it in the estimate. Regenerate `docs/impl/registers/STATUS.md` and run `tools/verify_docs.py` after doc edits.

### R-P3-02 ← P3-F3 (MEDIUM): connect the existing shape decoder to the production model

- **Model:** add a nullable decoded-geometry field (proposed name `vectorShape: VectorShape | null`) to `CharacterModel`; retain the existing `TagRef` for provenance and raw access. Set the shape's decoded bounds on shape characters. Do not eagerly rasterize shapes in `buildMovieModel`.
- **Dictionary pass:** in `buildMovieModel`, dispatch `DefineShape`/`2`/`3`/`4` through `decodeDefineShapeVersion` once per definition using the bounded tag cursor. Preserve the existing lazy-by-reference policy for bitmap/audio payloads; do not copy compressed media bytes into the model. Morph/font tags get their own typed decoders in their WPs rather than being misclassified as shapes.
- **Public inspection:** implement the shape detail/reporting promised by WP-060-11 (`inspect --shapes`) and keep `dump` deterministic. `dump` must not inline raster buffers or compressed payloads; expose stable metadata and a geometry digest/summary if full IR serialization is too large. Update model-dump field order and goldens if its schema changes.
- **Preview adapter:** move the test-only `VectorShape`→raster conversion into a production build-time boundary (for example `apps/decompiler/src/assets/shape-preview.ts` or the asset package). Keep `packages/gfx` free of SWF imports; do not promote `packages/gfx/test/adapter.ts` into production unchanged. The preview uses shape-local bounds and the reference CPU raster path, not a browser/WebGL or full-timeline path.
- **Coverage:** finish P3-owned parts of WP-060-09/11, including stable IR serialization/quantization/simplification and a corpus hook. P4-only sampler/browser integration stays separately gated.

**Acceptance for R-P3-02:** production `buildMovieModel` exposes decoded `VectorShape` for all four static shape tags; a caller needs no raw-tag reparse; model/dump output is deterministic; a CLI preview uses the production bridge; the import-boundary lint remains green.

### R-P3-03 ← P3-F4 (MEDIUM): repair shape conformance tests and IDs

Create/extend synthetic fixtures in the SWF test-support writer and attach the documented test IDs to the behavior they actually assert:

| Test / obligation | Resolution |
| --- | --- |
| `T-SWF-005` | Hand-computed edge fixtures for the required 2/4/8/16-bit widths, both straight and curved records, positive/negative deltas and quadrant/flag combinations. Assert consumed bit positions and decoded coordinates. |
| `T-SWF-006` | `StateNewStyles` fixture with new style arrays, rebased indices, bitmap fills and the record's style-index fields before the arrays. Assert cursor alignment, old/new style visibility per the final IMPL-060 rule, and no unexpected diagnostics. |
| `T-MOD-101/102/115` | Cover four quadrants, straight flags, zero-length edges, and all four curved-edge deltas at `NumBits + 2`, including the zero `NumBits` boundary. |
| `T-MOD-103/109` | Keep the existing fill0/fill1 regression coverage; add a donut/self-intersection fixture and assert open-fill closure, stroke-open semantics and `NoClose`. |
| `T-MOD-104/105/106/111/112/114/116/119–122` | Add the bitmap-fill matrix, gradient stop/focal/mode cases, new-style re-scoping, winding, `LINESTYLE2`/miter/NoClose, caps×joins, and sampler-config fixtures described verbatim in IMPL-060 §9. Split sampler-only assertions to the P4 owner. |
| `T-MOD-107/108/110` | Test deterministic quantization/simplification, repeatable IR serialization, and the 200-shape bounds corpus. |
| `T-MOD-113` | Retain the v1 literal-255 regression and add the extended-count cases in Shape2/3/4; do not label the v1-only fixture as the complete obligation. |
| `T-MOD-117/118` | Test glyph `SHAPE` reuse when the font decoder lands; test `EdgeBounds` vs shape bounds and the recomputed-bounds diagnostic on a stroked fixture. |
| `T-MOD-123` | Add the promised bit-level Appendix A assertion (header/style counts, continuous record bits, four 13-bit edges, End record, and final six padding bits). Keep the GFX pixel/PNG test as separate P4 evidence. |

Correct the existing labels in `shape-regressions.test.ts`: split the combined Shape4 flag loop so `T-MOD-111` names only the winding-bit mapping, and document a new `T-MOD-124` for the remaining named/reserved flag preservation; move the pre-SWF-8 Shape4 version case to a new documented `T-MOD-125`. Remove `T-MOD-112` from reserved-flag tests and use it only for the required `LINESTYLE2` fixture. Move the empty-MoveTo diagnostic test to a new documented `T-MOD-126`, and the `SF0190` dedupe tests to a new documented `T-MOD-127`. Add those new IDs to IMPL-060 §9 before using them. Never count an ID merely because it appears in a range comment.

For every documented shape diagnostic, maintain a code→fixture matrix. The 16 existing shape codes are already registered and emitted; retain them, assert their severities, and add trigger coverage rather than duplicating or renumbering them.

### R-P3-04 ← P3-F2 (HIGH, images/morphs): implement IMPL-070 as specified

Use the existing module plan in IMPL-070 rather than inventing a second bitmap format:

1. Add `BitmapAsset`/provenance models and tag-body readers for `DefineBits`, `JPEGTables`, JPEG2/3/4, and Lossless/Lossless2. Compressed payload stays a view until the asset worker runs (`IMPL-070-R001/002`).
2. Implement JPEG table splice/first-table policy/prefix tolerance; PNG/GIF magic passthrough; JPEG3/4 alpha offset/length and DeblockParam capture; all lossless formats, palette sizing, per-row word padding, channel order and ARGB un-premultiplication. Normalize once to straight-alpha RGBA8.
3. Implement both morph tag headers, edge streams, styles, offset check and paired `MorphShape` IR. Preserve rational twips through pairing; apply one deterministic rounding at the documented boundary; report restrictions/diagnostics instead of silently fabricating valid geometry.
4. Add the `packages/assets` decode/preview worker and corpus parity harness. Compare against an independent decoder; do not validate a decoder by reusing its own encoder. Implement the P3 PNG preview path; defer GPU texture upload and browser rendering.
5. Register the 070-owned diagnostics (`SF0250`–`SF0269`) in `Codes` and the executable registry, respecting shared AST-owned codes such as `SF0203`; add one fixture for every code.

**Required tests:** `T-MOD-301…313`, `T-MOD-401…408`, and roadmap `T-AST-001…004`; also the documented alpha, passthrough, `.sfa`, corpus, and morph endpoint/bounds criteria. No test is marked done solely because its fixture parses without throwing.

### R-P3-05 ← P3-F2 (HIGH, fonts/text): implement IMPL-080 with phase-owned outputs

1. Add the `FontModel`/glyph-space readers and decode `DefineFont`/2/3/4, `DefineFontInfo`/2, `DefineFontName`, `DefineFontAlignZones`, `CSMTextSettings`, `DefineText`/2, and `DefineEditText`. Route glyph `SHAPE` records through the shared shape-record reader with the mandatory fill style and EM-space normalization; do not duplicate the shape bit parser.
2. Store authored metrics, code maps/language, raw order for reports, static glyph runs, per-run matrices/colors/advances, editable-text fields and metadata. Keep device/CFF cases explicit with the prescribed diagnostic/fallback; do not silently substitute host metrics.
3. Emit deterministic WOFF2 per AST-R023 (record the normalized units-per-em and provenance) and the build-time atlas artifact required for the P3 asset pipeline. Keep dynamic runtime layout/input and browser text fidelity under their later owners.
4. Register `SF0270`–`SF0285`, exercise each documented condition, and add a deterministic WOFF2 output assertion (proposed new `T-AST-023`, registered in the AST test table before use).
5. Add decoder/model tests for `T-MOD-501…506`, `511…518` as applicable. Split phase-crossing obligations explicitly: `T-MOD-507` HTML/runtime parsing and `508` input enforcement are runtime work; the AVM1-dependent part of `510` waits for P5/P6; `509`'s build-time atlas determinism belongs here, while its renderer fidelity is P4/P9. Do not leave these IDs marked “P3 complete” or block the P3 tag-decode gate on runtime-only behavior.

### R-P3-06 ← P3-F2 (HIGH, sounds): implement the P3 decode/build slice of IMPL-090

1. Add `DefineSound`/codec metadata and zero-copy payload views, `SOUNDINFO`/`StartSound` models, stream-head/block decoding and frame association in `packages/swf/src/sounds/`.
2. Implement PCM 0/3 and the SWF ADPCM decoder in `packages/audio`; implement the exact packet/predictor reset semantics and bit widths. Decode MP3 frame headers and retain MP3 frame bytes unchanged with seek/trim metadata. Generate duration-correct silent partials for codecs the implementation document deliberately does not decode.
3. Prepare deterministic build assets/metadata at the documented canonical sample rate/chunk boundaries where applicable. Keep mixing, voice priority/stealing, Web Audio scheduling and 10-minute real-time sync in P8.
4. Register decode-side sound codes. Keep P8 runtime-only `SF0320`–`SF0323` out of the P3 decode registry work; reuse the shared audio-design codes exactly as IMPL-090 directs.
5. Pin `T-AUD-002` itself (all four ADPCM widths, mono/stereo, reference-vector equality) in addition to `T-AUD-101/102`; add IMPL-090's `T-AUD-103…115` decode/build cases, with runtime-only assertions explicitly reassigned. Each decode diagnostic must have a fixture.

### R-P3-07 ← P3-F1 (HIGH): deliver `assets dump` as a deterministic preview bundle

With typed model data available for supported asset types, keep the implemented `assets dump` command aligned with these requirements and close the remaining bundle-level gaps. It must:

- accept the real CLI syntax `forge-decompile assets dump <file.swf> --out <dir>` and return a documented nonzero error for malformed inputs instead of the current generic “not implemented” path;
- emit stable per-character files (`shape-<id>.png`, `bitmap-<id>.png`, `font-<id>.woff2`, and codec-appropriate sound files), plus a sorted manifest with character id/kind/source tag, output type/path, status, digest and diagnostics;
- preserve MP3 bytes for MP3 pass-through; write WAV previews for decoded PCM/ADPCM and explicit silent fallbacks only when required by the selected preview policy; never label a missing/unsupported decode as a successful WAV;
- use relative paths, stable ordering and content hashes only—no timestamps, absolute paths, or raw media bytes in JSON;
- prove shape/bitmap/font/audio coverage using a synthetic SWF fixture with at least one of each applicable type, plus separate malformed/unsupported cases. Run it twice and compare every output byte/hash.

Add a CLI golden test and update the P3 roadmap evidence row to reference that test and its generated manifest/hash assertions. The preview command is a developer tool; production asset formats and runtime consumers remain governed by AST/AUD.

---

## 4. Execution batches

Each integrity finding is assigned to one batch; batch B has independent media tracks but one shared finding/exit condition.

| Batch | Findings / resolutions | Scope | Gate after batch |
| --- | --- | --- | --- |
| **0 — contract and phase map** | F5 / R-P3-01 | Correct P3/P8/P10 boundary, CLI spelling, artifact contract and WP-based estimate. | `verify_docs.py` reports 0 issues; STATUS and roadmap agree; no output-format conflict remains. |
| **A — shape production path and proof** | F3/F4 / R-P3-02/03 | CharacterModel integration, production preview bridge, `inspect --shapes`, complete shape tests and corrected labels. | `T-SWF-005/006`, P3-owned `T-MOD-101…123`, shape diagnostic fixtures, SWF/GFX import-boundary lint and deterministic model tests pass. |
| **B — media decoders** | F2 / R-P3-04/05/06 | Parallel 070 bitmap/morph, 080 font/text decode/build assets, and 090 audio decode/build assets. | All P3-owned T-MOD/T-AST/T-AUD decode tests pass; independent image parity and diagnostic registry/fixture coverage are green. P4/P8/P9-only tests remain assigned to those phases. |
| **C — asset dump integration** | F1 / R-P3-07 | CLI subcommand, per-character previews, manifest, diagnostics and deterministic golden bundle. | Synthetic multi-media SWF produces the expected files; second run is byte-identical; malformed inputs have bounded, reported failures. |
| **D — P3 exit audit** | All gates (no new finding) | Re-run full quality gates and perform a fresh integrity check against the amended P3 gate. | Every revised P3 gate row passes; P3 can be closed only in this audit record after observed execution evidence is added. |

**Cross-check:** F1 → C · F2 → B · F3 → A · F4 → A · F5 → 0. No integrity finding is left unassigned.

## 5. Final acceptance checklist

P3 is not resolved until all applicable checks below have observed execution evidence:

1. **Roadmap:** P3/P8/P10 ownership, CLI name, supported artifact types, and estimate are reconciled; video is P10; P8 runtime behavior is not claimed as P3.
2. **Shape:** production model contains decoded static `VectorShape`; no production path reparses shape bytes; `T-SWF-005/006` and the P3-owned `T-MOD` suite pass; test labels describe the behavior asserted.
3. **Images/morphs:** all seven bitmap tags and both morph tags decode; independent JPEG/PNG/lossless parity, alpha and row-padding tests pass; all 070 diagnostics have registry entries and fixtures.
4. **Fonts/text:** P3 font/text records decode; WOFF2 output is deterministic under AST-R023; metrics/code maps/static runs/edit-text fields and supported fallbacks are tested; runtime-only work is separately tracked.
5. **Sounds:** ADPCM passes `T-AUD-002` bit-exact vectors; PCM and MP3 parser/pass-through paths are verified; build metadata/unsupported fallbacks are deterministic; P8 playback/mixer gates remain separate.
6. **Asset dump:** real `forge-decompile assets dump` emits the agreed previews and manifest for a synthetic multi-media movie; no timestamps/absolute paths; hashes are stable across repeated runs.
7. **Repository:** full test, typecheck, lint, build and documentation gates pass on the implementation branch; `tools/tag_coverage.py` and diagnostic registry checks recognize the newly decoded media tags/codes.

## 6. Execution record — partial implementation, not a closure audit

The phase/artifact decisions in §2 remain in force: video is P10; runtime audio/playback is P8; WOFF2 is the required font artifact; audio outputs are codec-appropriate; and shape PNGs are debug previews alongside retained vector IR.

| Resolution | Current implementation state | Evidence / remaining work |
| --- | --- | --- |
| R-P3-01 — phase and artifact contract | Roadmap phase map, CLI spelling, output policy, P3/P8/P10 boundaries, WOFF2 requirement and WP estimates have been revised. | `docs/impl/000-roadmap.md`; `corepack pnpm spec:status && corepack pnpm spec:verify` reports `ISSUES: 0`. |
| R-P3-02/03 — production shapes and proof | Static `VectorShape` is exposed by `buildMovieModel`; shape IR/digests appear in model dumps; `inspect --shapes` and deterministic PNG previews use the production model path. `StateNewStyles`, bit-width, Appendix A, caps/joins, Shape4 bounds and extended-count fixtures are present. | Full test suite passes. `T-SWF-005/006`, `T-MOD-123`, `T-MOD-116/118/113/126/127` are now executable; remaining IMPL-060 obligations and test-ID coverage still prevent complete P3 shape-conformance sign-off. |
| R-P3-04 — bitmap/morph | Implemented typed bitmap and morph decoders, canonical pixel handling, production asset previews and endpoint-pair IR; WOFF2/fonts not included here. | `images.test.ts`, `morph.test.ts`, `packages/assets/test/bitmap.test.ts`, `T-AST-001…004`, and `T-AST-024` pass. Morph ratio interpolation/baking/static parity (`T-MOD-401/402`) and the complete all-media repeat-bundle proof remain open. |
| R-P3-05 — fonts/text | Partial implementation: `DefineFont2/3`, static text and editable-text models, deterministic WOFF2/atlas assets, and explicit `DefineFont4` unsupported fallback exist. | `T-AST-023` and supported-font output tests pass. `DefineFont` v1, font-info/name/align-zone/CSM sidecars, direct `DefineFont4` fallback coverage, and related P3 test obligations remain open. |
| R-P3-06 — audio | Typed `DefineSound`, `StartSound`/`StartSound2`, stream heads/blocks and frame/sample associations are in the model; PCM/ADPCM decode, MP3 pass-through, deterministic resampling and duration-correct unsupported-codec fallbacks are implemented. | `T-AUD-002/101/102` reference/framing cases, event/stream model tests, and audio-output tests pass. `T-AUD-111` 10-second chunk/loop trimming and `T-AUD-112` peak/RMS metadata remain absent; P8 runtime `T-AUD-114` stays outside P3. |
| R-P3-07 — asset bundle | `forge-decompile assets dump` writes deterministic shape/morph/bitmap/font/audio previews and a sorted manifest; codec-appropriate audio output and unsupported fallbacks are preserved. | Asset types are covered by separate fixtures; no single synthetic all-media fixture yet compares every file and manifest byte across two complete runs. |

**Observed gates (2026-10-05, current implementation):** `corepack pnpm install --frozen-lockfile`, `corepack pnpm build`, `corepack pnpm typecheck`, `corepack pnpm lint`, `corepack pnpm test`, `corepack pnpm spec:status && corepack pnpm spec:verify`, `corepack pnpm test:audit`, `corepack pnpm tag:coverage`, and `corepack pnpm audit:dev` all pass. The current full-suite counts and audit details are recorded in [`P3-REPEAT-AUDIT.md`](P3-REPEAT-AUDIT.md) §6. `audit:dev` reports no new findings after unresolved P3 diagnostic codes were assigned to their actual open work packages; this is explicit ownership, not feature completion or baseline refresh. `audits/dev/baseline.json` was not refreshed in this P3 pass.

These gates establish repository health but do not close the remaining P3 work. **Current disposition:** R-P3-01 and R-P3-02/03 are implemented at the stated model/preview/test slices; R-P3-04 is implemented with morph ratio rendering/parity still open; R-P3-05 is partial pending the remaining font formats/sidecar metadata; R-P3-06 is partial pending chunk/loop/peak/RMS build metadata; R-P3-07 is partial pending an all-media repeated-bundle gate. The evidence-led repeat audit is [`P3-REPEAT-AUDIT.md`](P3-REPEAT-AUDIT.md): F3 and F5 are resolved at their original scope; F1/F2 are partial and F4 remains open. P3 remains **not exit-ready**.
