# IMPL STATUS — implementation-spec coverage

**Generated** by [`tools/gen_status.py`](../../../tools/gen_status.py) — do not hand-edit.
**Snapshot:** 2026-10-09 · source: `docs/impl/**/*.md`

State legend: ✅ grounded = written against the upstream chapter text · ✅ written / ✅ ready =
chapter-independent · ⏳ partial = open items remain (each listed in that document's §Open items).

## 1. Per-document status

| Doc | Area | WPs | Dev-days | Open items | Tests | Codes | State |
| --- | --- | --- | --- | --- | --- | --- | --- |
| [150](../code-inspector/150-code-inspector.md) | Code Inspector: Indexing, Navigation, Run View | 12 | 41 | 0 | 14 | 9 | ✅ |
| [030](../decompiler/030-display-list-and-sprites.md) | Display List, Placements, Filters, and Sprites | 12 | 30 | 9 | 16 | 20 | ✅ |
| [040](../decompiler/040-control-tags-and-metadata.md) | Control Tags and Metadata | 15 | 26 | 5 | 32 | 29 | ✅ |
| [060](../decompiler/060-shapes-and-gradients.md) | Shapes, Paths, and Gradients | 14 | 42 | 9 | 27 | 16 | ✅ |
| [070](../decompiler/070-images-and-morphs.md) | Bitmaps, Lossless Images, and Shape Morphing | 15 | 53 | 9 | 21 | 20 | ✅ |
| [080](../decompiler/080-fonts-and-text.md) | Fonts and Text | 14 | 45 | 7 | 18 | 16 | ✅ |
| [090](../decompiler/090-sounds.md) | Sounds: Event, Streaming, and Codec Paths | 12 | 36 | 6 | 15 | 19 | ✅ |
| [100](../decompiler/100-buttons.md) | Buttons, Tracking, and Hit Testing | 10 | 26 | 5 | 17 | 10 | ✅ |
| [110](../decompiler/110-video.md) | Video: Embedded Codecs and Transcoded Delivery | 11 | 34 | 6 | 16 | 16 | ✅ |
| [160](../engine-clean/160-engine-clean.md) | Clean Engine: Transforms and Runtime | 13 | 51 | 0 | 14 | 17 | ✅ |
| [130](../engine-flash/130-runtime-and-renderer.md) | Runtime, Renderer, and Interpreter | 17 | 88 | 0 | 19 | 0 | ✅ |
| [010](../foundation/010-binary-io-and-records.md) | Binary IO and Primitive Records | 12 | 20 | 2 | 10 | 30 | ✅ |
| [020](../foundation/020-container-tag-stream-dictionary.md) | Container, Tag Stream, Dictionary, and Processing | 12 | 26 | 7 | 14 | 25 | ✅ |
| [140](../harness/140-conformance-harness.md) | Conformance Harness, Fixtures, and Fuzzing | 11 | 48.5 | 0 | 4 | 0 | ✅ |
| [050](../transpiler/050-actions-and-avm1.md) | Action Decoding and the AVM1 Front End | 17 | 46 | 6 | 30 | 26 | ✅ |
| [120](../transpiler/120-compiler-and-emitter.md) | Compiler Pipeline, Emitter, and Build Output | 14 | 46 | 0 | 8 | 2 | ✅ |
| **Total** | 16 documents | **211** | **≈ 658.5** | **71** | **275** | **255** | |

`000-roadmap.md` owns the phases and the canonical work-package index; `errata.md` owns the
upstream-source corrections and is not a work-package document. Counts are the rows the document
itself declares, checksummed by `tools/verify_docs.py`; the Codes column is a sum, not a unique
count, because `010` restates the container codes it owns jointly with `020`.

## 2. Diagnostics registry (as defined in `docs/impl`)

| Doc | Codes defined | Range |
| --- | --- | --- |
| 150 | `SF0901`, `SF0902`, `SF0903`, `SF0904`, `SF0905`, `SF0906`, `SF0907`, `SF0908`, `SF0909` | SF0901–SF0909 |
| 030 | `SF0110`, `SF0111`, `SF0112`, `SF0113`, `SF0114`, `SF0115`, `SF0116`, `SF0117`, `SF0118`, `SF0119`, `SF0120`, `SF0121`, `SF0122`, `SF0123`, `SF0124`, `SF0125`, `SF0126`, `SF0127`, `SF0128`, `SF0129` | SF0110–SF0129 |
| 040 | `SF0150`, `SF0151`, `SF0152`, `SF0153`, `SF0154`, `SF0155`, `SF0157`, `SF0158`, `SF0159`, `SF0160`, `SF0161`, `SF0162`, `SF0163`, `SF0164`, `SF0165`, `SF0166`, `SF0167`, `SF0168`, `SF0169`, `SF0170`, `SF0171`, `SF0172`, `SF0173`, `SF0174`, `SF0175`, `SF0176`, `SF0177`, `SF0178`, `SF0179` | SF0150–SF0179 |
| 060 | `SF0180`, `SF0181`, `SF0182`, `SF0183`, `SF0184`, `SF0185`, `SF0186`, `SF0187`, `SF0188`, `SF0189`, `SF0190`, `SF0191`, `SF0192`, `SF0193`, `SF0194`, `SF0195` | SF0180–SF0195 |
| 070 | `SF0250`, `SF0251`, `SF0252`, `SF0253`, `SF0254`, `SF0255`, `SF0256`, `SF0257`, `SF0258`, `SF0259`, `SF0260`, `SF0261`, `SF0262`, `SF0263`, `SF0264`, `SF0265`, `SF0266`, `SF0267`, `SF0268`, `SF0269` | SF0250–SF0269 |
| 080 | `SF0270`, `SF0271`, `SF0272`, `SF0273`, `SF0274`, `SF0275`, `SF0276`, `SF0277`, `SF0278`, `SF0279`, `SF0280`, `SF0281`, `SF0282`, `SF0283`, `SF0284`, `SF0285` | SF0270–SF0285 |
| 090 | `SF0300`, `SF0301`, `SF0302`, `SF0303`, `SF0304`, `SF0305`, `SF0306`, `SF0307`, `SF0308`, `SF0309`, `SF0324`, `SF0325`, `SF0326`, `SF0327`, `SF0328`, `SF0329`, `SF0330`, `SF0331`, `SF0332` | SF0300–SF0332 |
| 100 | `SF0130`, `SF0131`, `SF0132`, `SF0133`, `SF0134`, `SF0135`, `SF0136`, `SF0137`, `SF0138`, `SF0139` | SF0130–SF0139 |
| 110 | `SF0240`, `SF0241`, `SF0242`, `SF0243`, `SF0244`, `SF0245`, `SF0246`, `SF0247`, `SF0248`, `SF0249`, `SF0290`, `SF0291`, `SF0292`, `SF0293`, `SF0294`, `SF0295` | SF0240–SF0295 |
| 160 | `SF0801`, `SF0802`, `SF0803`, `SF0810`, `SF0811`, `SF0812`, `SF0820`, `SF0821`, `SF0830`, `SF0831`, `SF0840`, `SF0841`, `SF0850`, `SF0851`, `SF0860`, `SF0870`, `SF0871` | SF0801–SF0871 |
| 010 | `SF0001`, `SF0002`, `SF0003`, `SF0004`, `SF0005`, `SF0006`, `SF0007`, `SF0008`, `SF0009`, `SF0010`, `SF0011`, `SF0012`, `SF0013`, `SF0014`, `SF0015`, `SF0016`, `SF0020`, `SF0021`, `SF0022`, `SF0023`, `SF0024`, `SF0025`, `SF0026`, `SF0027`, `SF0028`, `SF0029`, `SF0030`, `SF0031`, `SF0032`, `SF0033` | SF0001–SF0033 |
| 020 | `SF0001`, `SF0003`, `SF0004`, `SF0005`, `SF0006`, `SF0007`, `SF0021`, `SF0022`, `SF0023`, `SF0024`, `SF0025`, `SF0026`, `SF0027`, `SF0028`, `SF0029`, `SF0030`, `SF0031`, `SF0032`, `SF0033`, `SF0101`, `SF0102`, `SF0103`, `SF0104`, `SF0107`, `SF0109` | SF0001–SF0109 |
| 050 | `SF0400`, `SF0401`, `SF0402`, `SF0403`, `SF0404`, `SF0405`, `SF0406`, `SF0407`, `SF0408`, `SF0409`, `SF0410`, `SF0411`, `SF0412`, `SF0413`, `SF0414`, `SF0415`, `SF0416`, `SF0417`, `SF0418`, `SF0419`, `SF0420`, `SF0421`, `SF0422`, `SF0423`, `SF0424`, `SF1000` | SF0400–SF1000 |
| 120 | `SF0501`, `SF0502` | SF0501–SF0502 |

The authoritative range allocation (which document may define which codes) is `010` §7; `SF1000+`
is the fatal range (AVM2 content ⇒ exit 3). Codes cited across documents (e.g. `SF1000` in 040/050/120,
`SF0110` shared by 030/100) have a single owner and are listed here under that owner.

## 3. Test-id registry (per document)

| Doc | Test ids defined |
| --- | --- |
| 150 | `T-INS-101`, `T-INS-102`, `T-INS-103`, `T-INS-104`, `T-INS-105`, `T-INS-106`, `T-INS-107`, `T-INS-108`, `T-INS-109`, `T-INS-110`, `T-INS-111`, `T-INS-112`, `T-INS-113`, `T-INS-114` |
| 030 | `T-MOD-001`, `T-MOD-002`, `T-MOD-003`, `T-MOD-004`, `T-MOD-005`, `T-MOD-006`, `T-MOD-007`, `T-MOD-008`, `T-MOD-009`, `T-MOD-010`, `T-MOD-011`, `T-MOD-012`, `T-MOD-601`, `T-MOD-602`, `T-MOD-603`, `T-MOD-604` |
| 040 | `T-MOD-013`, `T-MOD-014`, `T-MOD-015`, `T-MOD-016`, `T-MOD-017`, `T-MOD-018`, `T-MOD-019`, `T-MOD-020`, `T-MOD-021`, `T-MOD-022`, `T-MOD-023`, `T-MOD-024`, `T-MOD-025`, `T-MOD-026`, `T-MOD-027`, `T-MOD-028`, `T-MOD-029`, `T-MOD-030`, `T-MOD-031`, `T-MOD-032`, `T-MOD-033`, `T-MOD-034`, `T-MOD-035`, `T-MOD-036`, `T-MOD-037`, `T-MOD-038`, `T-MOD-039`, `T-MOD-040`, `T-MOD-041`, `T-MOD-042`, `T-MOD-043`, `T-MOD-044` |
| 060 | `T-MOD-101`, `T-MOD-102`, `T-MOD-103`, `T-MOD-104`, `T-MOD-105`, `T-MOD-106`, `T-MOD-107`, `T-MOD-108`, `T-MOD-109`, `T-MOD-110`, `T-MOD-111`, `T-MOD-112`, `T-MOD-113`, `T-MOD-114`, `T-MOD-115`, `T-MOD-116`, `T-MOD-117`, `T-MOD-118`, `T-MOD-119`, `T-MOD-120`, `T-MOD-121`, `T-MOD-122`, `T-MOD-123`, `T-MOD-124`, `T-MOD-125`, `T-MOD-126`, `T-MOD-127` |
| 070 | `T-MOD-301`, `T-MOD-302`, `T-MOD-303`, `T-MOD-304`, `T-MOD-305`, `T-MOD-306`, `T-MOD-307`, `T-MOD-308`, `T-MOD-309`, `T-MOD-310`, `T-MOD-311`, `T-MOD-312`, `T-MOD-313`, `T-MOD-401`, `T-MOD-402`, `T-MOD-403`, `T-MOD-404`, `T-MOD-405`, `T-MOD-406`, `T-MOD-407`, `T-MOD-408` |
| 080 | `T-MOD-501`, `T-MOD-502`, `T-MOD-503`, `T-MOD-504`, `T-MOD-505`, `T-MOD-506`, `T-MOD-507`, `T-MOD-508`, `T-MOD-509`, `T-MOD-510`, `T-MOD-511`, `T-MOD-512`, `T-MOD-513`, `T-MOD-514`, `T-MOD-515`, `T-MOD-516`, `T-MOD-517`, `T-MOD-518` |
| 090 | `T-AUD-101`, `T-AUD-102`, `T-AUD-103`, `T-AUD-104`, `T-AUD-105`, `T-AUD-106`, `T-AUD-107`, `T-AUD-108`, `T-AUD-109`, `T-AUD-110`, `T-AUD-111`, `T-AUD-112`, `T-AUD-113`, `T-AUD-114`, `T-AUD-115` |
| 100 | `T-MOD-801`, `T-MOD-802`, `T-MOD-803`, `T-MOD-804`, `T-MOD-805`, `T-MOD-806`, `T-MOD-807`, `T-MOD-808`, `T-MOD-809`, `T-MOD-810`, `T-MOD-811`, `T-MOD-812`, `T-MOD-813`, `T-MOD-814`, `T-MOD-815`, `T-MOD-816`, `T-MOD-817` |
| 110 | `T-MOD-901`, `T-MOD-902`, `T-MOD-903`, `T-MOD-904`, `T-MOD-905`, `T-MOD-906`, `T-MOD-907`, `T-MOD-908`, `T-MOD-909`, `T-MOD-910`, `T-MOD-911`, `T-MOD-912`, `T-MOD-913`, `T-MOD-914`, `T-MOD-915`, `T-MOD-916` |
| 160 | `T-CLN-101`, `T-CLN-102`, `T-CLN-103`, `T-CLN-104`, `T-CLN-105`, `T-CLN-106`, `T-CLN-107`, `T-CLN-108`, `T-CLN-109`, `T-CLN-110`, `T-CLN-111`, `T-CLN-112`, `T-CLN-113`, `T-CLN-114` |
| 130 | `T-RT-101`, `T-RT-102`, `T-RT-103`, `T-RT-104`, `T-RT-105`, `T-RT-106`, `T-RT-107`, `T-RT-108`, `T-RT-109`, `T-RT-110`, `T-RT-111`, `T-RT-112`, `T-RT-113`, `T-RT-114`, `T-RT-115`, `T-RT-116`, `T-RT-117`, `T-RT-118`, `T-RT-120` |
| 010 | `T-SWF-001`, `T-SWF-003`, `T-SWF-004`, `T-SWF-009`, `T-SWF-013`, `T-SWF-014`, `T-SWF-015`, `T-SWF-016`, `T-SWF-017`, `T-SWF-024` |
| 020 | `T-SWF-001`, `T-SWF-002`, `T-SWF-003`, `T-SWF-007`, `T-SWF-008`, `T-SWF-010`, `T-SWF-011`, `T-SWF-012`, `T-SWF-018`, `T-SWF-019`, `T-SWF-020`, `T-SWF-021`, `T-SWF-022`, `T-SWF-023` |
| 140 | `T-TST-101`, `T-TST-102`, `T-TST-103`, `T-TST-104` |
| 050 | `T-AVM1-001`, `T-AVM1-002`, `T-AVM1-003`, `T-AVM1-004`, `T-AVM1-005`, `T-AVM1-006`, `T-AVM1-007`, `T-AVM1-008`, `T-AVM1-009`, `T-AVM1-010`, `T-AVM1-011`, `T-AVM1-012`, `T-AVM1-013`, `T-AVM1-014`, `T-AVM1-015`, `T-AVM1-016`, `T-AVM1-017`, `T-AVM1-018`, `T-AVM1-019`, `T-AVM1-020`, `T-AVM1-021`, `T-AVM1-022`, `T-AVM1-023`, `T-AVM1-024`, `T-AVM1-025`, `T-AVM1-026`, `T-AVM1-027`, `T-AVM1-028`, `T-AVM1-029`, `T-AVM1-030` |
| 120 | `T-CMP-001`, `T-CMP-002`, `T-CMP-003`, `T-CMP-004`, `T-CMP-005`, `T-CMP-006`, `T-CMP-007`, `T-CMP-008` |

`T-SWF-*` is shared by the two container documents (010 declares the primitive tests; 020 the header,
tag-stream and dictionary tests, and each cites the other explicitly). `030` owns `T-MOD-001`–`012`,
`040` the `T-MOD-0xx` block, `060` the `T-MOD-1xx` block, `070` the `3xx`/`4xx`, `080` the `5xx`,
`100` the `8xx` and `110` the `9xx`; design-spec gate ids `T-TST-001`–`006` are mirrored by the
harness's `T-TST-101`–`104` (`E-023`).

## 4. Chapter coverage

| Format-spec chapter | Grounded in | Remaining work |
| --- | --- | --- |
| Ch.1 Basic Data Types | 010 | — |
| Ch.2 SWF Structure Summary | 020 | "Processing a SWF file" / "File compression strategy" text (E-006) |
| Ch.3 The Display List | 030 | — |
| Ch.4 Control Tags | 040 | — |
| Ch.5 Actions | 050 | — (open items are oracle-pinned, not chapter gaps) |
| Ch.6 Shapes | 060 | — (record layouts, bit widths and 1-based style model grounded) |
| Ch.7 Gradients | 060 | — (structures, spread/interpolation modes and focal gradients grounded) |
| Ch.8 Bitmaps | 070 | — (all seven bitmap tags, pixel layouts and alpha model grounded) |
| Ch.9 Shape Morphing | 070 | — (two-stream morph model, styles, restrictions and rounding grounded) |
| Ch.10 Fonts and Text | 080 | — (glyph-space model, all font/text tags and the HTML subset grounded) |
| Ch.11 Sounds | 090 | — (codec table, ADPCM framing, SOUNDINFO, stream subdivision grounded) |
| Ch.12 Buttons | 100 | — (open items are oracle-pinned, not chapter gaps) |
| Ch.13 Sprites and Movie Clips | 030 | — (tag set, definition order, stream mixing and naming grounded) |
| Ch.14 Video | 110 | — (all codecs, Screen Video v1/v2 and the Appendix C palette grounded; E-021 records the chapter's own CodecID gap) |
| Ch.15 Metadata | 040 | — (both tag bodies and the root-only FileAttributes rule grounded; E-022 records the bit-name divergence) |
| App. A Worked example (pp. 223–236) | 140 | — (79-byte fixture committed, byte-exact; per-doc assertions T-SWF-022/023, T-MOD-123, T-MOD-604; the appendix's table typos are E-025) |
| App. B Reverse tag index (pp. 237–239) | 020, 110 | — (specs/110 §2 equals all 65 entries; E-026 removed six invented names; T-TST-103) |
| App. C Screen Video v2 palette (pp. 240–243) | 110 | — (128 values, appendix order, frozen in IMPL-110 §6 and specs/110 §10.12; T-TST-104) |

## 5. Next actions

1. Ch.1–Ch.15 + Appendix A–C intake is complete — every implementation document is grounded or
   chapter-independent, and the appendices live as the golden fixture (`IMPL-140` §2.1), the tag-index
   authority (`specs/110` §2) and the frozen palette (`IMPL-110` §6).
2. Reconcile the Ch.2 gap (`E-006`) when its missing section text arrives.
3. Keep `python3 tools/verify_docs.py` green: the work-package index, the diagnostic registry and the
   test registry must agree with these documents at every merge.
