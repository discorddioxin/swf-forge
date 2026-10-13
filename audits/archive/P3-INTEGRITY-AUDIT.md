# P3 Integrity Audit

**Date:** 2026-10-05 · **Branch:** `arena/01a10cd9-swf-forge`
**Verdict:** **P3 is not exit-ready.** A substantial shape/gradient decoder exists, but it is not part of the production movie model or asset-export path. Bitmap/morph, font/text, and sound decoding are absent. The roadmap's P3 asset demo is a stub, and the required P3 conformance suites are missing.

## 1. Scope and acceptance baseline

The acceptance baseline is the P3 media-decode gate in `docs/impl/000-roadmap.md:225–232`:

1. `assets dump` emits PNGs for shapes/bitmaps, WAVs for sounds, and TTFs for fonts.
2. Shape decoding is proven for all edge sizes, both fill rules, and all style-change cases (`T-SWF-005`, `T-SWF-006`).
3. ADPCM is bit-exact against reference vectors (`T-AUD-002`).
4. JPEG/PNG/lossless bitmap decoding matches an independent decoder (`T-AST-001…004`).

This audit covers P3's Chapter 6–10 work: `IMPL-060` shapes/gradients, `IMPL-070` bitmaps/morphs, `IMPL-080` fonts/text, and `IMPL-090` sounds. Video (`IMPL-110`, Chapter 14) is **not scored as a P3 failure**: the phase table assigns it to P10. The roadmap's phase-to-document map also lists `110` under P3, so that mapping is internally inconsistent; the explicit P3 chapter range and P10 phase row are used here. P8 audio-engine/mixer behavior and P4 browser rendering are later-phase deliverables, not P3 decode gates.

There is a separate output-contract ambiguity: the P3 phase summary (`000-roadmap.md:45`) says WOFF2 previews, while the P3 exit gate (`:229`) says TTF. This audit uses the explicit exit-gate criterion (TTF); the asset/font pipeline is absent either way, so the verdict is unchanged.

## 2. Coverage snapshot

The four P3 implementation documents specify 53 work packages (166 developer-days), 71 diagnostic codes, and 77 test obligations. The counts below exclude video/`IMPL-110`.

| Area | Spec work packages / estimate | Documented diagnostics / registered in `codes.ts` | Test obligations / evidence in tests | Finding |
| --- | ---: | ---: | --- | --- |
| `060` Shapes and gradients | 14 / 42 d | 16 / **16** | 23 obligations; two SWF test files contain 12 direct tests, but only five obligation IDs appear in labels and several labels do not match their assertions | Partial decoder; gate unproven and not integrated |
| `070` Images and morphs | 14 / 47 d | 20 / **0** | 21 / **0** | No decoder or P3 test suite |
| `080` Fonts and text | 13 / 41 d | 16 / **0** | 18 / **0** | No decoder or P3 test suite |
| `090` Sounds | 12 / 36 d | 19 / **0** | 15 / **0** | No decoder or P3 test suite |
| **P3 total** | **53 / 166 d** | **71 / 16** | **77 obligations; no P3-specific test IDs in 070–090** | **Not complete** |

The diagnostic comparison is against the executable registry in `packages/swf/src/diagnostics/codes.ts`, not the range comment alone. All 16 shape-band codes (`SF0180`–`SF0195`) are assigned in `Codes`, registered, and referenced by `shape.ts`; none of the documented image (`SF0250`–`SF0269`), font/text (`SF0270`–`SF0285`), or sound (`SF0300`–`SF0309`, `SF0324`–`SF0332`) codes is registered there.

## 3. Roadmap gate results

| P3 exit criterion | Result | Evidence |
| --- | --- | --- |
| `assets dump` PNG/WAV/TTF export | **Fail** | `apps/decompiler/src/cli.ts:155–158` returns “not implemented yet” for `assets`; there is no asset-export package or command implementation. |
| Shape edge-size/fill-rule/style-change coverage (`T-SWF-005/006`) | **Partial; not proven** | A capable parser exists in `packages/swf/src/tags/shape.ts`, but the required test IDs do not occur in executable tests. Existing fixtures do not cover all edge widths, curves, bitmap `StateNewStyles`, or all style-change combinations. |
| ADPCM exactness (`T-AUD-002`) | **Fail** | No sound decoder/audio package or ADPCM implementation; no `T-AUD-002` test. |
| Independent bitmap parity (`T-AST-001…004`) | **Fail** | No SWF bitmap decoder and no `T-AST-001…004` tests. `packages/gfx/src/image/png.ts` is a PNG **encoder** for an existing `RasterImage`, not a PNG/JPEG/lossless decoder. |

**Overall:** 0 of 4 gate rows are fully demonstrated; the shape row has partial implementation evidence, while the asset, ADPCM, and bitmap-parity rows fail outright.

## 4. Findings by implementation area

### 4.1 Shapes and gradients — real parser, incomplete phase integration and verification

`packages/swf/src/tags/shape.ts` (637 lines) is meaningful implementation, not a stub. It defines `VectorShape`, decodes the four `DefineShape` versions, fill/line styles and gradients, straight and quadratic edges, `FillStyle0`/`FillStyle1`/stroke runs, `StateNewStyles`, Shape4 flags, and bounds. It records both `evenOdd` and `nonZero` fill rules. Its 16 diagnostic constants are all used by this module. The current shape tests (`shape-runs.test.ts` and `shape-regressions.test.ts`) pass and protect some genuine regression fixes.

However, this decoder is not wired into the production model:

- `buildMovieModel` in `packages/swf/src/model/movie.ts:1037–1065` constructs each character with a tag index, kind, and (for `DefineBinaryData` only) bytes. It does not call `decodeDefineShapeVersion` or attach a `VectorShape`; `CharacterModel` (`model/types.ts:185–201`) has no geometry field.
- A source search finds the decoder definition and public export, but no production caller. The Appendix A render test decodes raw bytes itself and uses the test-only adapter in `packages/gfx/test/adapter.ts`.
- The CLI has no `inspect --shapes` option, and there is no production shape-to-asset export path.

The shape test suite also does not establish the full documented contract. `shape-runs.test.ts` tests simple fill-side runs and an implicit-close case; it does not cover the requested edge-size matrix, curved-edge deltas, or `StateNewStyles` with bitmap fills. Several labels in `shape-regressions.test.ts` overstate coverage:

| Label in test code | What the implementation document requires | What the labeled test actually checks |
| --- | --- | --- |
| `T-MOD-111` (within a `T-MOD-111–118` range label) | Winding rule selected on the same geometry | The assertion does verify the winding-bit-to-`fillRule` mapping on the same simple fixture; however, the range label also implies coverage of 112–118, which it does not provide |
| `T-MOD-112` | `LINESTYLE2` layout, miter cutoff, and `NoClose` | Reserved Shape4 flag reporting and Shape4 in a pre-SWF-8 file |
| `T-MOD-113` | Extended counts in Shape2/3/4 plus literal 255 in v1 | Literal 255 in v1 only |
| `T-MOD-116` | Caps × joins matrix | Empty `MoveTo` / `SF0185` |
| `T-MOD-118` | Shape4 edge-bounds comparison | `SF0190` style-array duplicate ceiling |

The Appendix A test (`packages/gfx/test/appendix.test.ts`) is useful end-to-end evidence for one fixture, but it is not the bit-level `T-MOD-123` test claimed by `IMPL-060`'s §14 changelog: it checks the rendered pixels, geometry, and deterministic PNG, not every field/bit listed in §9. The curve and `StateNewStyles` paths are implemented but lack matching regression fixtures.

### 4.2 Images and morphs — absent

There is no `packages/swf/src/images/`, morph decoder, or `packages/assets/` package. No implementation was found for the seven bitmap-definition tags, `JPEGTables` reconstruction, JPEG3/4 alpha planes, lossless pixel layouts, canonical pixels, or either morph-shape tag. The model recognizes bitmap/morph tag kinds and retains tag references; classification and bounds extraction are not payload decoding. The PNG utility in `packages/gfx` only encodes RGBA raster buffers.

Consequently the 070 requirements—independent image-decoder parity, alpha handling, lossless row padding/channel order, and morph endpoint/blend correctness—have no code or corresponding `T-MOD-301…313` / `T-MOD-401…408` test evidence.

### 4.3 Fonts and text — absent

There is no font/text decoder module under `packages/swf`, no `packages/text/` or font-atlas/subsetting pipeline, and no TTF/WOFF2 output path. The model assigns `font`, `font2`–`font4`, `text`, and `editText` kinds from tag codes, but does not decode glyphs, code maps, static text runs, or editable-text fields. None of `T-MOD-501…518` is present in executable test labels.

### 4.4 Sounds — P2 references exist; P3 media decode is absent

There is no `packages/swf/src/sounds/`, `packages/audio/`, codec dispatch, PCM/MP3/ADPCM decoder, or WAV-emission pipeline. `DefineSound` is classified as a `sound` character, and P2 timeline models retain `SoundStreamHead`/`SoundStreamBlock` references; this preserves structure but does not decode audio payloads. Button-sound records and stream ordering are likewise not evidence of the P3 `DefineSound`/ADPCM work. No `T-AUD-101…115` or `T-AUD-002` test is present.

## 5. Ranked integrity findings

| ID | Severity | Finding | Evidence / impact |
| --- | --- | --- | --- |
| F1 | **HIGH** | **The P3 asset-export demo is unimplemented.** | `assets` is a CLI stub (`cli.ts:155–158`); there is no production path that writes the required PNG/WAV/font outputs. The primary P3 demo and the first roadmap gate row fail. |
| F2 | **HIGH** | **Three of four P3 media areas have no decoder implementation.** | No bitmap/morph, font/text, or sound decoder packages/modules; their 55 documented diagnostics and 54 test obligations have no implementation/test evidence. ADPCM and bitmap parity gates fail. |
| F3 | **MEDIUM** | **The shape decoder is not connected to the production model or asset pipeline.** | `decodeDefineShapeVersion` is exported but not called by `buildMovieModel`; the only end-to-end conversion is in a GFX test adapter. This leaves P3 shape data unavailable to downstream production commands. |
| F4 | **MEDIUM** | **Shape conformance evidence is incomplete and test-ID mapping is unreliable.** | Required `T-SWF-005/006` are absent; curve/`StateNewStyles` cases are untested; several `T-MOD` labels map to unrelated assertions, and the changelog's `T-MOD-123` claim is not present as a test. |
| F5 | **LOW** | **Roadmap P3 boundaries and outputs conflict.** | P3 summary says WOFF2, the exit gate says TTF; the phase-document map places video doc 110 in P3 while the phase table places Chapter 14 video in P10; the effort model says P3 is 45–70 d (including video) while docs 060–090 sum to 166 d. This needs clarification for future tracking, but it does not change the failed verdict. |

## 6. Verification run

- `corepack pnpm test` — **29 files, 295 tests passed**.
- `corepack pnpm typecheck` — **passed**.
- P3-focused subset (`shape-runs`, `shape-regressions`, GFX `appendix`, GFX `render`) — **4 files, 26 tests passed**.

These green checks show the currently implemented shape and reference-raster code is stable under its existing tests. They do not satisfy missing P3 gates: the required P3 acceptance IDs and media decoder fixtures are not in those suites. The worktree contained existing P2 changes during verification; this audit did not alter them.

## 7. Audit disposition and next closure steps

**Disposition: keep P3 open.** The shape/gradient parser is a useful foundation; do not treat its passing tests as completion of media decode. A P3 resolution effort should, in order:

1. Reconcile the roadmap's P3 output contract (TTF vs WOFF2) and document/video mapping.
2. Connect shape decoding to the model/export path and add the explicitly required shape edge-size/style-change tests; correct or split the misleading `T-MOD` labels.
3. Implement bitmap/morph decoding and independent decoder parity (`T-AST-001…004` plus the 070 tests).
4. Implement font/glyph and text decoding plus the agreed font artifact output.
5. Implement sound payload decode/ADPCM and the bit-exact `T-AUD-002` vectors, then add WAV emission.

Video decoding remains P10; browser/WebGL static rendering remains P4; audio mixing/runtime scheduling remains P8. None should be used to blur the P3 exit criteria above.
