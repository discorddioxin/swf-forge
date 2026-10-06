# P3 Repeat Integrity Audit

**Date:** 2026-10-05 · **Branch:** `arena/01a10cd9-swf-forge` · **Auditor:** agent
**Baseline:** [`P3-INTEGRITY-AUDIT.md`](P3-INTEGRITY-AUDIT.md) — findings F1–F5
**Resolution record:** [`P3-RESOLUTION-AUDIT.md`](P3-RESOLUTION-AUDIT.md)
**Purpose:** adversarially re-check the original findings and revised P3 gates after the implementation pass. This is a completed repeat audit with an **open verdict**; it does not declare P3 closed.

---

## 1. Scope and acceptance baseline

The current roadmap defines P3 as IMPL-060/070/080 plus the Chapter 11 audio decode/build subset. The accepted artifact and phase boundaries are:

- Decoded `VectorShape` IR remains in the production model; shape PNGs are previews, not a replacement.
- Supported embedded-font output is deterministic WOFF2 (AST-R023); TTF is not the P3 gate. Unsupported DefineFont4 CFF outlines receive an explicit fallback.
- Sound outputs remain codec-appropriate: PCM/ADPCM WAV, unchanged MP3 frames, and duration-correct diagnosed silent fallbacks for unavailable codecs.
- P8 owns playback/mixing/Web Audio and runtime sync; P10 owns video; P4 owns the full browser/timeline renderer.

The repeat evaluates the current roadmap rows for the real `forge-decompile assets dump` command; production shape/model conformance; typed image, morph, font/text and sound models; independent image parity and ADPCM reference tests; deterministic supported-font assets; and the downstream phase boundaries. P8/P10/P4 work is not scored as a P3 failure.

---

## 2. Coverage snapshot

The four P3 implementation documents list **81 test obligations**: IMPL-060 27, IMPL-070 21, IMPL-080 18 and IMPL-090 15. The implementation registry contains the **71 documented P3 diagnostic codes** (16 + 20 + 16 + 19). Registration is not the same as a production emission or passing trigger fixture; the audit ledger below distinguishes those states.

| Area | Test obligations | Diagnostic codes registered | Current executable evidence / open coverage |
| --- | ---: | ---: | --- |
| `060` Shapes/gradients | 27 | 16 / 16 | Production model and previews; `T-SWF-005/006`, Appendix A `T-MOD-123`, and newer Shape4/count/cap tests pass. Other documented conformance IDs remain unwired or incompletely demonstrated. |
| `070` Images/morphs | 21 | 20 / 20 | Bitmap decoder, morph endpoint model, image parity and previews exist. Ratio interpolation/baking and `T-MOD-401/402` are not established. |
| `080` Fonts/text | 18 | 16 / 16 | DefineFont2/3, static/editable text, WOFF2 and atlas paths exist. DefineFont v1 and several sidecar metadata tags remain pending; some registry obligations lack a matching fixture. |
| `090` Sounds | 15 | 19 / 19 | Event sounds, stream spans/sample offsets, PCM/ADPCM, MP3 pass-through and unsupported-format fallbacks exist. Ten-second chunk/loop and peak/RMS build metadata remain open; P8 runtime work is separate. |
| **Total** | **81** | **71 / 71** | **Substantial P3 implementation; multiple feature/test obligations remain open.** |

`corepack pnpm tag:coverage` reports **65 registered tags: 50 decoded, 7 pending, 5 retained and 3 structural**. The six P3-pending tags are `DefineFont`, `DefineFontInfo`, `DefineFontInfo2`, `DefineFontAlignZones`, `CSMTextSettings` and `DefineFontName`; the seventh is `DefineVideoStream`, owned by P10. Font-sidecar tags are no longer treated as dictionary character definitions, preventing metadata from overwriting font characters. `DefineFont4` has a diagnosed unsupported-CFF fallback; its CFF outlines are not decoded.

---

## 3. Roadmap P3 gate results — repeat

| Revised P3 criterion | Result | Evidence and remaining condition |
| --- | --- | --- |
| `forge-decompile assets dump <file.swf> --out <dir>` writes agreed previews/assets and a deterministic manifest | **PARTIAL** | Production paths exist for static shapes, morph endpoints, supported bitmaps, supported font WOFF2/atlas, PCM/ADPCM WAV, MP3 pass-through and diagnosed silent fallbacks. Per-type tests assert deterministic output. There is not yet one synthetic all-media movie whose complete files and manifest are compared byte-for-byte across two full CLI runs. |
| Production model exposes static `VectorShape` and shape conformance is proven | **PARTIAL** | `buildMovieModel` covers all four static shape tags. `T-SWF-005/006`, continuous bit-level Appendix A `T-MOD-123`, `T-MOD-113/116/118/126/127`, and corrected label cases pass. Not all 27 IMPL-060 obligations have executable evidence; e.g. the full gradient/simplification/corpus obligations remain. |
| P3 image/morph/font/text/sound metadata decodes into typed models | **PARTIAL** | Bitmap/morph, DefineFont2/3, static/editable text and sound event/stream models are implemented. Font v1/sidecars and morph ratio rendering/parity remain open. IMPL-090 `T-AUD-111/112` chunk/loop/peak/RMS metadata is not implemented. |
| ADPCM reference and independent image parity | **PASS for the named tests** | `T-AUD-002/101` covers all ADPCM code widths, mono/stereo and the 200-seeded-packet independent integer reference; `T-AST-001…004` includes frozen external JPEG-reference and alpha/row-padding checks. This does not certify unrelated open media obligations. |
| Supported WOFF2/build outputs are deterministic | **PASS for supported DefineFont2/3 inputs** | `T-AST-023` repeats WOFF2 bytes and validates stable font metadata; the asset test also repeats the glyph-atlas/manifest output. DefineFont v1, sidecar tags and the direct `DefineFont4` fallback obligation remain open. |
| P8/P10/P4 boundaries remain explicit | **PASS — boundary only** | Roadmap and implementation docs keep playback/mixer/runtime sync at P8, video at P10, and full browser/timeline rendering at P4. No later-phase completion is claimed. |

**Overall:** P3 is **not exit-ready**. The amended phase boundary is consistent and several major P3 paths now pass; the partial feature, conformance and integrated-bundle gaps below still block closure.

---

## 4. Findings by implementation area

### 4.1 Shapes and gradients — production integration resolved; conformance ledger still open

The original F3 defect no longer reproduces for static shapes. `buildMovieModel` decodes `DefineShape`/2/3/4 into `CharacterModel.vectorShape`; model dumps include stable summaries/digests; `inspect --shapes` reports the model geometry; and `assets dump` writes local-bounds PNG previews through the production bridge without replacing vector IR. `packages/gfx` remains independent of SWF imports.

Repeat evidence now includes `T-SWF-005/006`, 2/4/8/16-bit straight and curved record fixtures, continuous Appendix A bit consumption (`T-MOD-123`), `StateNewStyles` alignment and bitmap-style rebasing, caps×joins (`T-MOD-116`), stroked Shape4 bounds (`T-MOD-118`), Shape2/3/4 extended counts (`T-MOD-113`), and Shape4 reserved/version flags plus the `SF0190` dedupe ceiling (`T-MOD-126/127`). Stale broad or mismatched labels were removed/corrected.

This does not prove the full 060 registry. In particular, `T-MOD-104`, `T-MOD-107…110` and `T-MOD-119…122` still need careful test-to-obligation review or implementation evidence; several gradient/simplification/corpus assertions are not represented by current test IDs. F4 therefore remains partially resolved, not closed.

### 4.2 Images and morphs — implemented with ratio-gate gaps

The tree now includes typed bitmap payload readers and model integration, JPEG table handling, PNG/GIF passthrough, lossless pixel layouts and alpha normalization, and production bitmap previews. MorphShape/2 tags decode both endpoint streams, styles, bounds/flags and paired edge geometry. Asset previews include deterministic start/end morph PNGs. `T-AST-001…004` and the bitmap decoder tests provide independent/reference and pixel-layout evidence; `T-AST-024` identifies the morph preview test.

The endpoint decoder does **not** establish ratio interpolation/baking, ratio-zero/ratio-one parity with static-shape IR, or the style-array mismatch contract. `T-MOD-401/402` are not proven by the current endpoint/degeneration tests. During the repeat ID audit, misleading `T-MOD-301/303` labels were removed from negative-JPEGTables/tag-metadata and ALPHACOLORMAPDATA tests; the positive byte-exact table-splice and XRGB/ARGB corner-color obligations still need correctly scoped evidence. `SF0262`/`SF0263` remain explicitly deferred to `WP-070-12`; ownership is not implementation. Those gaps keep this area open.

### 4.3 Fonts and text — supported subset implemented; format/metadata gaps remain

`DefineFont2/3` glyph outlines, code/metrics for the tested form, static text runs and editable-text fields are connected to typed character models. Supported fonts have deterministic WOFF2 and glyph-atlas outputs (`T-AST-023`, `T-MOD-509`). The dictionary classifier now treats font info, alignment-zone and font-name sidecars as metadata references, not character definitions; a regression test ensures they do not create or overwrite characters. `DefineFont4` produces an unsupported-asset fallback rather than pretending to decode CFF geometry.

P3 remains incomplete for `DefineFont` v1, `DefineFontInfo`/`2`, `DefineFontName`, `DefineFontAlignZones`, `CSMTextSettings`, and the corresponding code-map/licensing/alignment model. No direct `T-MOD-511` test pins the DefineFont4 fallback. The corrected font test labels no longer claim the DefineFont2 fixture proves v2/v3 equality or the full v1/v2 offset-table obligation; `T-MOD-501/502/506` remain open.

### 4.4 Sounds — decode/build slice present; chunk metadata remains open

The model decodes `DefineSound`, `StartSound`/`StartSound2`, stream heads/blocks, timeline sound events, stream spans, frame/block association and cumulative sample offsets. `packages/audio` provides PCM, SWF ADPCM, MP3 framing/pass-through, deterministic resampling and WAV output. `assets dump` preserves MP3 frames, emits codec-appropriate PCM/ADPCM WAVs, and writes duration-targeted silent fallbacks for Nellymoser, Speex and reserved formats. The new `T-AUD-115` fixture covers all three fallback classes and their diagnostic severities/output bytes. Independent ADPCM reference tests cover the 200-packet case.

`T-AUD-111` (10-second chunk boundaries and loop points surviving trim) and `T-AUD-112` (known-amplitude peak/RMS metadata) remain P3 build gaps. `T-AUD-114` frame-subdivision emulation is P8 runtime scope and is not a P3 blocker. The tests do not assert the P8 playback/mixer/Web Audio runtime.

### 4.5 Diagnostics and audit tooling — explicit ownership, open work remains visible

The P3 diagnostic definitions are registered, but not all have production trigger paths or fixtures. `audit:dev` now maps the ten outstanding P3 codes to their existing open owners (`SF0262/0263` → `WP-070-12`; glyph/text/font cases → the corresponding `WP-080` decode/runtime packages). This is explicit deferral for planned work, not acceptance or closure. The normal audit run has zero new findings without refreshing the audit baseline. It still reports 12 pre-existing unmapped AVM1-range codes outside P3; they remain baseline-known.

---

## 5. Ranked integrity findings — repeat ledger

| Finding | Repeat evidence | Status |
| --- | --- | --- |
| **F1 (HIGH)** — P3 asset-export demo absent | The CLI now writes shape/morph/bitmap/font/audio outputs and deterministic per-type manifests. A single all-media, full-bundle repeat comparison is absent. | **PARTIALLY RESOLVED — OPEN.** |
| **F2 (HIGH)** — bitmap/morph, font/text and sound decode gaps | Bitmap/morph/font2/3/text/sound decode/build paths now exist. Font v1/sidecars, morph ratio behavior, audio chunk/loop/peak/RMS and some diagnostic triggers remain. | **PARTIALLY RESOLVED — OPEN.** |
| **F3 (MEDIUM)** — shape decoder not connected to production model/export path | All four static tags produce model `VectorShape`; dump/inspect/preview paths use it and are covered. | **RESOLVED for the original static-shape integration finding.** |
| **F4 (MEDIUM)** — shape conformance evidence and IDs unreliable | `T-SWF-005/006`, Appendix A `T-MOD-123` and corrected/new Shape4 obligations are executable; substantial other 060 obligations still lack evidence. | **PARTIALLY RESOLVED — OPEN.** |
| **F5 (LOW)** — roadmap phase/output contradictions | Roadmap and docs agree on CLI, WOFF2, codec-appropriate sounds, vector IR plus previews, P8 runtime audio and P10 video. Documentation verifier reports zero issues. | **RESOLVED.** |

**Repeat verdict:** F3 and F5 are resolved at their stated scope; F1/F2 are partial and F4 remains open. P3 remains **not exit-ready**.

---

## 6. Verification run

Current-tree verification on `arena/01a10cd9-swf-forge`:

| Check | Result |
| --- | --- |
| `corepack pnpm install --frozen-lockfile` | **PASS** |
| `corepack pnpm test` | **PASS — 43 files / 382 tests** |
| `corepack pnpm typecheck` | **PASS** |
| `corepack pnpm lint` | **PASS** — ESLint and Prettier |
| `corepack pnpm build` | **PASS** |
| `corepack pnpm spec:status && corepack pnpm spec:verify` | **PASS — `ISSUES: 0`** |
| `corepack pnpm tag:coverage` | **PASS — 65 tags: 50 decoded, 7 pending, 5 retained, 3 structural** |
| `corepack pnpm test:audit` | **PASS — 19 Python tests** |
| `corepack pnpm audit:dev` | **PASS — 188 codes; 163 emitted, 1 exception, 12 deferred, 12 unmapped; 393 test IDs; 0 new findings, 5 fixed against 57 known** |
| `git diff --check` | **PASS** |

The audit baseline was not refreshed during this P3 repeat. The 12 P3 diagnostic deferrals are visible with owners and do not constitute passing feature gates; the 12 unmapped rows are pre-existing AVM1-range codes outside this audit scope. P1/P2-specific findings remain resolved; the global check has no newly introduced finding.

---

## 7. Audit disposition and closure steps

**Disposition: P3 remains open.** This repeat audit records current results; it is not a pass-by-deferral.

Before a P3 closure audit:

1. Implement and test the remaining shape obligations; re-check every T-MOD citation against its assertion.
2. Implement morph ratio behavior or document the approved renderer/build ownership decision and prove endpoint/static parity and style pairing (`T-MOD-401/402`).
3. Add DefineFont v1 and font-info/name/align-zone/CSM decoding, test the DefineFont4 fallback, and close applicable font/code-map obligations.
4. Implement IMPL-090 `T-AUD-111/112` chunk/loop/trim and peak/RMS metadata. Keep runtime playback, mixer and `T-AUD-114` at P8.
5. Add a synthetic all-media asset-dump fixture and compare the complete output tree and manifest byte-for-byte across two runs.
6. Replace the ten deferred P3 diagnostic mappings with production emission paths and direct trigger fixtures as the owning WPs land; do not remove mappings or refresh the baseline to imply completion.
7. Re-run the full repository gates and conduct a new evidence-led audit. Preserve P10 video, WOFF2, codec-appropriate sound outputs and vector IR alongside shape previews.

**No P3 closure is claimed.**
