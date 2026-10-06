# IMPL-080 — Fonts and Text

**Doc ID:** IMPL-080 · **Status:** ✅ grounded in Ch.10 · **Package:** `@swf-forge/swf` + `@swf-forge/text`
**Format spec:** Chapter 10 — Fonts and Text (glyph vs device text, the EM square and the TrueType
conversion, `DefineFont`, `DefineFontInfo`, `DefineFontInfo2`, `DefineFont2`, `DefineFont3`,
`DefineFont4`, `DefineFontAlignZones`, `CSMTextSettings`, `DefineText`, `DefineText2`,
`DefineEditText`, `DefineFontName`, the HTML subset)
**Design specs:** AST-§4/§8 (font pipeline, `unitsPerEm`, atlases), SWF-§6.4 (`SWF-R038`…`R040`),
GFX-§5/§10 (glyph geometry, text layout), AVM1 (TextField/TextFormat), RT-§9 (text input),
CMP-§4.7 (text pipeline)
**Pinned byte layouts:** APP-§10.8 (Ch.10 structures) — this document carries semantics, the unit
model, and the traps.

---

## 1. Deliverables

1. Every font tag decoded: `DefineFont` (10), `DefineFont2` (48), `DefineFont3` (75), `DefineFont4`
   (91, CFF — detect + fall back), `DefineFontInfo` (13), `DefineFontInfo2` (62), `DefineFontName`
   (88), `DefineFontAlignZones` (73), `CSMTextSettings` (74).
2. Every text tag decoded: `DefineText` (11), `DefineText2` (33), `DefineEditText` (37).
3. A single glyph-space model (§4): glyph outlines are in **EM-square font units** — 1024 per em for
   v1/v2 fonts, 20480 for `DefineFont3` — and are scaled to the *placement's* `TextHeight` (twips) at
   layout time. Two different coordinate spaces for the same letters is the single most common source
   of "the text is huge / tiny / offset" port bugs.
4. Glyph outlines → the same `VectorShape` IR as shapes (doc 060), so one tessellator, one
   quantiser, one atlas packer.
5. Glyph→code maps (v1/v2 layouts) feeding string decoding, plus the language code that doc 010's
   string decoder uses (single source of truth).
6. Static text into `TextIR` as **glyph runs** with authored advances, runs' matrices and colours.
7. Editable text into `TextFieldModel` with all 16 flag bits and every optional field.
8. Hinting metadata (`DefineFontAlignZones`), advanced anti-aliasing settings (`CSMTextSettings`),
   and licensing strings (`DefineFontName`) recorded in the manifest.
9. Font subsetting and the glyph atlas path (AST-§4/§8).

**Non-goals:** CFF outline extraction (AST-§4's decision; `DefineFont4` degrades to a system-font
fallback and says so), the runtime layout engine (doc 130 / `packages/text`), and AVM2 text. Phase
ownership: P3 includes tag/model decode, deterministic WOFF2, and build-time atlas output; P4/P9 own
renderer fidelity and dynamic text behavior; P6 owns AVM1-dependent glyph reachability/subsetting.

## 2. Module layout

```
packages/swf/src/fonts/
  em.ts                 the EM-square model: unitsPerEm, glyph-space → twips conversion
  define-font.ts        DefineFont (10): offset table, glyph shapes, nGlyphs inference
  define-font2.ts       DefineFont2 (48) / DefineFont3 (75): codes, layout, kerning, flags
  define-font4.ts       DefineFont4 (91): CFF detection -> SF0270
  define-font-info.ts   DefineFontInfo (13), DefineFontInfo2 (62)
  font-name.ts          DefineFontName (88): name + copyright
  align-zones.ts        DefineFontAlignZones (73): ZONERECORD/ZONEDATA
  csm-settings.ts       CSMTextSettings (74): UseFlashType/GridFit/thickness/sharpness
  font-model.ts         FontModel: glyphs, code→glyph, metrics, unitsPerEm, language
  text-def.ts           DefineText (11), DefineText2 (33): TEXTRECORD state machine
  text-model.ts         TextIR: runs, glyph placements, per-run state
  edit-text.ts          DefineEditText (37) -> TextFieldModel
packages/text/src/
  layout.ts             AVM1 TextField layout: wrapping, alignment, scrolling (runtime)
  measure.ts            deterministic measurement from embedded metrics
  html.ts               the Ch.10 HTML subset (runtime parser, no DOM)
  atlas.ts              glyph rasterisation + packing → KTX2/`.sfa`
  subset.ts             glyph subsetting per title + budget reporting
```

**IMPL-080-R001** Glyphs MUST become `VectorShape` IR through the same decoder as `DefineShape`
records (doc 060 §5): glyph shapes are ordinary `SHAPE` structures. Differences are *context*, not
structure: no line styles, a mandatory fill-0 style, and the glyph-space coordinate frame (§4).

**IMPL-080-R002** Measurement MUST be deterministic for embedded fonts: only embedded metrics
(`FontAscent`/`FontDescent`/`FontLeading`/`FontAdvanceTable`) may be used. Device-font fields
(`UseOutlines = 0`, or a static text block under `devicefont`) depend on the host and MUST be
reported as `[verify]` per field, never silently substituted.

## 3. Glyph space and the EM square

```
EM square                   1024 units  (DefineFont, DefineFont2)
                            20480 units (DefineFont3 — "20 times the resolution")
Glyph outlines              SHAPE records in EM-square font units (NOT twips)
Scaling to the stage        px = coordinate × (TextHeight / 20) / unitsPerEm
                            (TextHeight is in twips: "a pixel height of 50 = TextHeight 1000")
Advance values              per glyph instance (DefineText GLYPHENTRY) or per font
                            (FontAdvanceTable); kerning tables exist but Flash ≤ 7 ignores them
```

- **IMPL-080-R003** `FontModel.unitsPerEm` MUST be **1024** for `DefineFont`/`DefineFont2` and
  **20480** for `DefineFont3`, exposed once and read by every downstream stage (design `SWF-R038`).
  `DefineFont4`'s CFF data carries its own units per em and is never treated as a SWF glyph space.
  A font model without `unitsPerEm` is a type error, not a default.
- **IMPL-080-R004** Glyph outlines MUST be normalised to a canonical space at decode (`em1024`:
  v3 deltas divided by 20, exact integer division into a rational or twip-quantised IR — never a
  float round-trip) so that a v2 and a v3 export of the same font produce *identical* IR geometry
  (`T-MOD-501`). The canonical space is recorded on the font (`glyphSpace: 'em1024'`), and the
  manifest's atlas entries keep the original `unitsPerEm` for provenance.
- **IMPL-080-R005** The chapter's TrueType conversion procedure (negate y; scale the source EM to
  1024; insert an on-curve anchor at the midpoint of successive off-curve points) documents **why**
  SWF glyphs are quadratic-only, y-down, and em-normalised. We never import TrueType, but the
  rules are binding on the *emitter* path (WOFF2 output, AST-§4.4): negate-y is a property of the
  file format, not an optional convention, and a cubic in the output must be converted to
  quadratics the same way.
- **IMPL-080-R006** `TextHeight` is the **scale**, not a box height: a run's glyphs are scaled by
  `TextHeight / unitsPerEm` (§6). Applying it as a text-box height, or pre-scaling glyphs at decode
  time, both break the same way and are caught by `T-MOD-504`.
- **IMPL-080-R007** Fonts whose `SoundSampleCount`-style metrics are absent (v1 fonts have no
  metrics at all) MUST derive metrics from glyph bounds once, record the derivation (`SF0275`,
  info) and feed the *same* numbers to the layout engine and the atlas so measurement and
  rasterisation cannot disagree.

## 4. Font definitions

| Tag | Code | SWF | Body summary |
| --- | --- | --- | --- |
| `DefineFont` | 10 | 1 | `FontID UI16`, `OffsetTable UI16[nGlyphs]`, `GlyphShapeTable SHAPE[nGlyphs]` |
| `DefineFontInfo` | 13 | 1 | `FontID`, `FontNameLen UI8`, `FontName UI8[len]`, flags byte, `CodeTable` (UI8 or UI16) |
| `DefineFontInfo2` | 62 | 6 | as above + `LanguageCode LANGCODE`; `WideCodes` always 1 |
| `DefineFont2` | 48 | 3 | full body below (codes, layout, kerning, name, language) |
| `DefineFont3` | 75 | 8 | identical to `DefineFont2`; glyph SHAPE coordinates × 20 |
| `DefineFont4` | 91 | 10 | `FontID`, flags (Reserved UB[5], HasFontData, Italic, Bold), `FontName`, `FONTData[0\|1]` (CFF) |
| `DefineFontName` | 88 | 9 | `FontID`, `FontName STRING`, `FontCopyright STRING` |
| `DefineFontAlignZones` | 73 | 8 | `FontID`, `CSMTableHint UB[2]`, `Reserved UB[6]`, `ZONERECORD[glyphCount]` |
| `CSMTextSettings` | 74 | 8 | `TextID`, `UseFlashType UB[2]`, `GridFit UB[3]`, `Reserved UB[3]`, `Thickness F32`, `Sharpness F32`, `Reserved UI8` |

```
DefineFont2/3 body:
  FontID UI16
  flags byte (MSB-first): HasLayout, ShiftJIS, SmallText, ANSI, WideOffsets, WideCodes, Italic, Bold
  LanguageCode LANGCODE          // 0 in SWF ≤ 5
  FontNameLen UI8, FontName UI8[FontNameLen]
  NumGlyphs UI16                 // may be 0 for a device-only font
  OffsetTable     UI32[NumGlyphs] if WideOffsets else UI16[NumGlyphs]
  CodeTableOffset UI32|UI16      // byte count from the START of OffsetTable to CodeTable
  GlyphShapeTable SHAPE[NumGlyphs]
  CodeTable       UI16[NumGlyphs] (UCS-2 in SWF 6+; UI8 when !WideCodes)
  if HasLayout:
    FontAscent  UI16   FontDescent UI16   FontLeading SI16        // leading may be negative
    FontAdvanceTable SI16[NumGlyphs]
    FontBoundsTable  RECT[NumGlyphs]      // unused by Flash ≤ 7, must be present
    KerningCount UI16                     // always 0 in practice
    FontKerningTable KERNINGRECORD[KerningCount]   // {code1, code2, adjustment SI16}
```

- **IMPL-080-R008** `DefineFont`'s `OffsetTable` entries are byte distances **from the start of the
  offset table** to each glyph's `SHAPE`. The glyph count is *inferred* as `OffsetTable[0] / 2`
  (the table immediately precedes the shapes when offsets are 16-bit). A file whose inferred count
  disagrees with the number of shapes parsed before the tag body ends is malformed: decode the
  shapes that are actually present, report `SF0271`, and keep the font usable
  (`DefineFont` has no explicit count — the offset table *is* the count).
- **IMPL-080-R009** In `DefineFont`/`DefineFont2`/`DefineFont3`, the **first `STYLECHANGERECORD` of
  every glyph shape must not use the line-style fields** and must set both `StateFillStyle0` and
  `FillStyle0 = 1`. The decoder MUST accept files that violate this (quarantine the glyph,
  `SF0281`), but MUST emit it on the writer path (WP-140-02's synthetic SWF writer).
- **IMPL-080-R010** `CodeTable` entries are **sorted ascending by code point** and are positionally
  aligned with the glyph table (glyph *i* ↔ `CodeTable[i]`). An out-of-order table is a real-world
  defect: sort a *copy* for `codeToGlyph`, keep the raw order for the `inspect --fonts` dump, and
  report `SF0276`. `DefineFontInfo`'s `CodeTable` must match the corresponding `DefineFont`'s glyph
  order for the same reason.
- **IMPL-080-R011** `CodeTableOffset` is measured from the start of `OffsetTable` (not the tag body,
  not the shape table) — an off-by-one-header read walks the shape table from the wrong byte and
  produces plausible-looking garbage. `T-MOD-506` pins both bases.
- **IMPL-080-R012** `NumGlyphs == 0` (device-only fonts) MUST omit every `NumGlyphs`-sized table.
  `CodeTableOffset` may still be present in files written by some tools; the reader MUST tolerate
  both forms (try-read, report `SF0282` at most once per file) and never index a zero-length table.
- **IMPL-080-R013** `FontLeading` is `SI16` (negative values are normal); `FontAscent`/`FontDescent`
  are `UI16`. Reading leading as unsigned shifts every multi-line layout by up to 65535 units
  (`T-MOD-503`).
- **IMPL-080-R014** `KERNINGRECORD`s are read (and re-emitted) faithfully but MUST NOT be applied by
  the renderer: Flash ≤ 7 ignores them, static text carries authored advances, and dynamic text uses
  `FontAdvanceTable` alone. Applying them double-advances text (`IMPL-080-R021`).
- **IMPL-080-R015** `DefineFont2/3`'s `FontBoundsTable` is present but unused: read its `RECT`s
  (validation + the `inspect` dump) and never use them as metrics or as atlas bounds.

## 5. Code maps, names, and licensing

- **IMPL-080-R016** `DefineFontInfo`'s flags byte is MSB-first (`Reserved UB[2]`, `SmallText UB[1]`,
  `ShiftJIS UB[1]`, `ANSI UB[1]`, `Italic UB[1]`, `Bold UB[1]`, `WideCodes UB[1]`); `DefineFontInfo2`
  is the same **plus a trailing `LanguageCode`** and requires `WideCodes = 1`
  (`SF0283`-class error if clear — the file is self-contradictory, and reading UI8 codes there
  desynchronises the tag).
- **IMPL-080-R017** SWF 6+ conventions are enforced softly: `CodeTable` is UCS-2 little-endian,
  `ShiftJIS`/`ANSI` must be clear, and font **names are UTF-8**; before SWF 6 both the code page and
  the name encoding are platform-dependent, so a SWF ≤ 5 font name MUST be recorded with the
  encoding used for the rest of the movie (doc 010's string configuration, AVM1-D01) and flagged
  `[verify]` in the report.
- **IMPL-080-R018** `FontNameLen` counts **bytes**, not characters, and the name is **not
  null-terminated**; a UTF-8 name with multi-byte characters is the common case in Japanese titles
  (`T-MOD-510`). Truncating at `FontNameLen` and decoding as UTF-8 is the whole rule; trimming at a
  NUL is the bug.
- **IMPL-080-R019** The indirect font names (`_sans`, `_serif`, `_typewriter`, and the Japanese
  `_ゴシック` / `_明朝` / `_等幅`) MUST be recorded as *indirect* in the manifest, with the resolved
  platform stack supplied by AST-§8. They are not ordinary family names: treating `_sans` as a
  literal family name selects nothing on a browser and silently changes metrics (`SF0284`, info).
- **IMPL-080-R020** `DefineFontName`'s strings (PostScript full name / `name` ID 4, then copyright)
  MUST be captured for the licensing report (SEC-§6) and surfaced in `porting-notes.json`. A missing
  `DefineFontName` for an embedded font is not an error, but it MUST be listed as
  `licensing: unknown`.

## 6. Static text (`DefineText` / `DefineText2`)

```
DefineText (11) / DefineText2 (33):
  CharacterID UI16   TextBounds RECT   TextMatrix MATRIX
  GlyphBits UI8      AdvanceBits UI8
  TEXTRECORD[]  ...  EndOfRecordsFlag UI8 (0)

TEXTRECORD (byte-aligned; first byte MSB-first):
  TextRecordType UB[1] = 1   StyleFlagsReserved UB[3] = 0
  HasFont UB[1]   HasColor UB[1]   HasYOffset UB[1]   HasXOffset UB[1]
  FontID      if HasFont         UI16
  TextColor   if HasColor        RGB (DefineText) | RGBA (DefineText2)
  XOffset     if HasXOffset      SI16      // NOTE: X before Y, the opposite of the flag listing
  YOffset     if HasYOffset      SI16
  TextHeight  if HasFont         UI16      // twips; 50 px = 1000
  GlyphCount  UI8
  GLYPHENTRY[GlyphCount]: GlyphIndex UB[GlyphBits], GlyphAdvance SB[AdvanceBits]
```

- **IMPL-080-R021** A `TEXTRECORD` is **one** record carrying styles *and* glyphs — there is no
  "style record" vs "glyph record" type split. `TextRecordType` is always 1; the list ends at the
  tag's zero byte (`EndOfRecordsFlag = 0`, which reads as `TextRecordType = 0`). Styles persist
  until the next record changes them, so the model is a *run* list, and a run's state must be
  inherited, not re-initialised (`T-MOD-504`).
- **IMPL-080-R022** The field order after the flags is `FontID`, `TextColor`, **`XOffset`,
  `YOffset`**, `TextHeight`. The flag listing order (…HasYOffset, HasXOffset) contradicts the field
  table; the *field table wins* (errata `E-017`) and `T-MOD-514` pins a record with both offsets
  present.
- **IMPL-080-R023** `XOffset` is measured from the **left of `TextBounds`** to the glyph reference
  point, `YOffset` from the **top of `TextBounds`**; absent offsets mean zero. Both are absolute per
  record (they reset the pen), which is exactly how line breaks are encoded — a layout engine that
  treats them as increments will smear every wrapped line down the page.
- **IMPL-080-R024** `GlyphAdvance` MUST be used verbatim (`IMPL-080-R011`): it is the distance
  between reference points, not ink width, and authors tune it. Recomputing it from font metrics
  changes kerning-heavy layouts and is the second-most-common text port bug after `TextHeight`.
- **IMPL-080-R025** Text MUST be modelled as **glyph runs**, never as a string (design AVM1-R044):
  the tag stores glyph indices, and several code points can share a glyph. `TextIR` carries
  `(fontId, glyphIndex, advance)` per entry plus `recoveredText` only where the font's code map
  makes the mapping 1:1 and unambiguous.
- **IMPL-080-R026** `TextMatrix` composes with (and is applied before) the placement's own matrix;
  the composition order is part of the contract (`T-MOD-505`).
- **IMPL-080-R027** A `GlyphIndex` outside the referenced font's glyph table MUST render as
  `.notdef` (an empty advance is wrong — it shifts the rest of the line) and report `SF0272` once
  per font/run.

## 7. Editable text (`DefineEditText`)

```
DefineEditText (37):
  CharacterID UI16   Bounds RECT
  flags: UI16 (16 flags, MSB-first in each byte; byte 0 = low byte)
    byte0: HasText, WordWrap, Multiline, Password, ReadOnly, HasTextColor, HasMaxLength, HasFont
    byte1: HasFontClass, AutoSize, HasLayout, NoSelect, Border, WasStatic, HTML, UseOutlines
  FontID       if HasFont        UI16
  FontClass    if HasFontClass   STRING
  FontHeight   if HasFont || HasFontClass   UI16   // twips
  TextColor    if HasTextColor   RGBA
  MaxLength    if HasMaxLength   UI16
  Align, LeftMargin, RightMargin, Indent, Leading   if HasLayout
  VariableName STRING
  InitialText  if HasText        STRING            // HTML when the HTML flag is set
```

- **IMPL-080-R028** The flag word is **16 bits**, read as a little-endian `UI16` (so byte 0 holds
  `HasFont`…`HasText` and byte 1 holds `HasFontClass`…`UseOutlines`). The bit values are pinned in
  APP-§10.8; `T-MOD-514` checks all 16 against a hand-built fixture. A one-bit shift here produces a
  text field that is, e.g., `Password` instead of `Multiline`.
- **IMPL-080-R029** `FontHeight` is present when **either** `HasFont` *or* `HasFontClass` is set.
  The flag table says so ("fontClass and Height specified"), the field table says "If HasFont" —
  the field table is incomplete, and the flag text plus every shipping implementation agree (errata
  `E-017`). Missing this byte desynchronises the whole tag; `SF0285` (info) records the tolerance.
- **IMPL-080-R030** `VariableName` is the AVM1 two-way binding. Dot/slash syntax is preserved
  verbatim (it is resolved at runtime against the owning clip), and the model MUST NOT normalise it.
  A field with a variable name but no `InitialText` is *not* empty: the variable's value wins
  (`T-MOD-516`).
- **IMPL-080-R031** `HTML = 1` content is the documented subset only: `<p align>`, `<br>`, `<a
  href target>`, `<font face size color>`, `<b>`, `<i>`, `<u>`, `<li>`, `<textformat …>`, `<tab>`.
  Unknown tags MUST be rendered as text (never executed, never dropped) and reported once per
  distinct tag (`SF0279`). The parser lives in the **runtime** (`text/html.ts`, RT-§9) because the
  string can change at any time; the model only carries the initial string.
- **IMPL-080-R032** `AutoSize` is SWF 6+ and, when set, sizes the field to its content: the layout
  engine must treat `Bounds` as a hint, and the manifest MUST record that the field is auto-sized so
  the renderer does not clip to the authored box (`T-MOD-514`).
- **IMPL-080-R033** `UseOutlines = 0` (device text) and `WasStatic = 1` are recorded per field and
  surfaced in the report; `NoSelect`, `Border`, and `Password` are runtime behaviours (RT-§9) that
  the model must carry but never interpret.
- **IMPL-080-R034** A field with no font, no font class, and no `HasLayout` renders with the
  runtime's default font at the default size. The default is a *runtime* decision (RT-§9); the model
  records "unspecified" and the report marks the field `[verify]`.

## 8. Hinting, advanced anti-aliasing, and metadata tags

- **IMPL-080-R035** `DefineFontAlignZones` (SWF 8+, optional but recommended, applies to
  `DefineFont3`) carries alignment zones whose purpose is **pixel snapping in the advanced text
  rendering engine**, not hit testing: `ZONERECORD[]` per glyph, each with `NumZoneData` (always 2),
  `ZONEDATA[]{AlignmentCoordinate FLOAT16, Range FLOAT16}`, then `Reserved UB[6]`, `ZoneMaskY UB[1]`,
  `ZoneMaskX UB[1]`. We record them verbatim and do not snap with them (the browser rasteriser owns
  glyph hinting); the manifest note says so (`SF0277`). The current doc's "hit zones for device
  fonts" wording was wrong.
- **IMPL-080-R036** `CSMTextSettings` (SWF 8+) modifies a previously streamed
  `DefineText`/`DefineText2`/`DefineEditText`: `UseFlashType` (0 normal renderer, 1 advanced),
  `GridFit` (0 none, 1 pixel grid, 2 sub-pixel/1/3-pixel), `Reserved`, `Thickness F32`,
  `Sharpness F32`, `Reserved UI8`. The model keeps the raw floats and derives the cutoffs with the
  chapter's formulas for the report: `outsideCutoff = (0.5·sharpness − thickness)·fontSize`,
  `insideCutoff = (−0.5·sharpness − thickness)·fontSize`. Note the upstream inconsistency (the prose
  says outside ≤ inside; the formulas give outside − inside = sharpness) — errata `E-017`; we
  implement the formulas.
- **IMPL-080-R037** A `CSMTextSettings`/`DefineFontAlignZones` tag whose target is missing, is not a
  text/font character, or (for zones) is not a `DefineFont3` MUST be ignored with `SF0278` (warning)
  by id-deduplicated. Resolution is deferred: a tag may precede the tag it modifies in odd files,
  so a one-pass reader resolves at end-of-parse.
- **IMPL-080-R038** `DefineFont4` is SWF 10+ and exists for the Flash Text Engine (AVM2) with CFF
  data; its required tables are `'CFF '`, `'cmap'`, `'head'`, `'maxp'`, `'OS/2'`, `'post'` plus
  either `'hhea'`/`'hmtx'` or `'vhea'`/`'vmtx'`/`'VORG'`, and its `cmap` must contain a Unicode
  subtable. For an AS1/AS2 title this font is unusable (AST-§4): report `SF0270` (error), select the
  system fallback, keep the name/flags for the report, and never let the CFF payload reach a glyph
  decoder.
- **IMPL-080-R039** `DefineFontName`'s absence is normal; its presence must never change rendering
  (it is metadata only), and both strings are emitted verbatim into the licensing report.

## 9. Text IR, runtime contract, and atlas integration

- **IMPL-080-R040** `TextIR` is shared by static text (decoded from the tag) and dynamic text
  (built by the runtime). One layout engine, one measurement path, one set of metrics — a second
  implementation for static text is how "static text is right, dynamic text is wrong" bugs happen.
- **IMPL-080-R041** Glyph rasterisation (build time, asset worker) uses the same tessellation code as
  the renderer at a small size ladder derived from the title's actual text heights, and the manifest
  keys atlases by `(fontId, pxSize, hinting)`.
- **IMPL-080-R042** Alpha coverage in atlases must survive minification: no filtered downsampling of
  1-px stems; the residual-error check (AST-R021) applies with a stricter tolerance (`T-MOD-509`).
- **IMPL-080-R043** Subsetting MUST include every glyph reachable from static runs, editable-field
  initial strings, and every AVM1 IR string literal assigned to a text-adjacent API. Where a title
  builds strings from arbitrary code points, include ASCII + the font's own coverage and say so in
  the report (`T-MOD-510`).

## 10. Diagnostics

Codes `SF0270`–`SF0289` are this document's block. `IMPL-010` §7 records the allocation; the
`SF0200`–`SF0239` codes published by the design specs (`GFX` `SF0201`/`SF0207`/`SF0210`, `AST`
`SF0203`–`SF0206`, `SF0211`–`SF0213`, `SF0220`, `SF0230`/`SF0231`) are **not** ours to reuse
(errata `E-019`).

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0270` | error | `DefineFont4`/CFF geometry unsupported → system fallback selected |
| `SF0271` | warning | `DefineFont` offset table inconsistent (inferred glyph count ≠ parsed shapes) |
| `SF0272` | warning | glyph index outside the font's table (rendered as `.notdef`) |
| `SF0273` | warning | glyph referenced by text has no code mapping (cannot be recovered as text) |
| `SF0274` | warning | `TextHeight` zero/absent on a run (font metrics used instead) |
| `SF0275` | info | font metrics derived, not authored (v1 font or absent layout tables) |
| `SF0276` | warning | `CodeTable` not sorted / `DefineFontInfo` map conflicts with the font's own table |
| `SF0277` | info | align zones / CSM settings recorded, not implemented (documented deviation) |
| `SF0278` | warning | align-zone/CSM tag targets a missing, wrong-kind, or non-`DefineFont3` character |
| `SF0279` | warning | HTML subset tag outside the documented set (rendered as text) |
| `SF0280` | warning | editable text with `UseOutlines = 0` (platform-dependent rendering), per field |
| `SF0281` | warning | glyph shape violates the mandatory first fill-style rule (quarantined) |
| `SF0282` | info | device-only font (`NumGlyphs = 0`): tables omitted or `CodeTableOffset` present |
| `SF0283` | error | `DefineFontInfo2` with `WideCodes` clear (self-contradictory codes) |
| `SF0284` | info | indirect font name (`_sans`/`_serif`/`_typewriter`/Japanese set) resolved to a stack |
| `SF0285` | info | `FontHeight` present under `HasFontClass` (upstream field-table gap, tolerated) |

**IMPL-080-R044** `SF0271`/`SF0276`/`SF0281` are emitted once per font (deduplicated by font id),
with the first offending glyph index in the message; a 30 000-glyph font must not produce 30 000
report lines.

## 11. Test obligations

| ID | Test | Level | Phase owner |
| --- | --- | --- | --- |
| `T-MOD-501` | `DefineFont2` vs `DefineFont3` same-font geometry equality after normalisation (`unitsPerEm` 1024 vs 20480) | F1  P3 decode/model | P3 decode/model |
| `T-MOD-502` | code maps: ANSI/Shift-JIS/Unicode layouts; wide vs narrow codes; `DefineFontInfo2` language | F1  P3 decode/model | P3 decode/model |
| `T-MOD-503` | `FontLeading` negative values; ascent/descent unsigned; metrics carried unscaled | F1  P3 decode/model | P3 decode/model |
| `T-MOD-504` | static text: multi-run fixture (style inheritance), per-run matrix/colour, `TextHeight` scaling | F1  P3 decode/model | P3 decode/model |
| `T-MOD-505` | static text placement matches a hand-computed table (X/Y offsets as absolutes) | F1  P3 decode/model | P3 decode/model |
| `T-MOD-506` | `DefineFont`/`2` offset-table base, `nGlyphs` inference, `CodeTableOffset` base | F1  P3 decode/model | P3 decode/model |
| `T-MOD-507` | HTML subset parser: nesting, unknown tags, entities, quoted/unquoted attributes | F1 | P9 runtime |
| `T-MOD-508` | password/`MaxLength` enforcement in the runtime input path | F2 | P9 runtime |
| `T-MOD-509` | atlas: coverage preserved; 1-px stem; deterministic packing | F1 | P3 build determinism; P4/P9 visual fidelity |
| `T-MOD-510` | subsetting reachability (static runs, field strings, IR literals); UTF-8 font names | F2 | P6 for AVM1-dependent reachability; P3 decode/code maps |
| `T-MOD-511` | `DefineFont4` → `SF0270`, fallback selected, manifest note present | F1  P3 decode/model | P3 decode/model |
| `T-MOD-512` | `TextBox`/`TEXTRECORD` terminator: zero byte ends the list; `TextRecordType` always 1 | F1  P3 decode/model | P3 decode/model |
| `T-MOD-513` | `TEXTRECORD` field order with both offsets set (XOffset read before YOffset) — `E-017` | F1  P3 decode/model | P3 decode/model |
| `T-MOD-514` | `DefineEditText`: all 16 flags; `FontHeight` under `HasFontClass`; `VariableName` verbatim | F1  P3 decode/model | P3 decode/model |
| `T-MOD-515` | align zones (`NumZoneData = 2`, masks) + CSM cutoffs from the chapter's formulas | F2  P3 decode/model | P3 decode/model |
| `T-MOD-516` | `CodeTable` unsorted → sorted copy for lookup, raw order kept, `SF0276` | F1  P3 decode/model | P3 decode/model |
| `T-MOD-517` | device-only font (`NumGlyphs = 0`) with and without `CodeTableOffset` | F1  P3 decode/model | P3 decode/model |
| `T-MOD-518` | indirect font name resolution recorded as indirect (never as a literal family) | F2  P3 decode/model | P3 decode/model |

## 12. Work packages

| WP | Title | Depends | Est | Deliverable | Phase owner |
| --- | --- | --- | --- | --- | --- |
| WP-080-01 | EM-square model + `DefineFont` v1 (offsets, glyphs, inference) | WP-060-09 | 3 | `em.ts`, `define-font.ts`, T-MOD-506 | P3 |
| WP-080-02 | `DefineFont2`/`DefineFont3` (codes, layout, kerning, flags) | WP-080-01 | 5 | `define-font2.ts`, T-MOD-501/502/503 | P3 |
| WP-080-03 | `DefineFontInfo`/`2` (flags, code maps, language, names) | WP-080-02, WP-010-11 | 3 | `define-font-info.ts`, T-MOD-502/510 | P3 |
| WP-080-04 | `DefineFont4` detection + fallback path | WP-080-02 | 1 | T-MOD-511 | P3 |
| WP-080-05 | `DefineFontName` + licensing capture | WP-080-02 | 1 | `font-name.ts` | P3 |
| WP-080-06 | Metrics model + derivation for v1 fonts | WP-080-02 | 2 | `font-model.ts`, T-MOD-503 | P3 |
| WP-080-07 | `DefineText`/`2` record stream → TextIR | WP-080-06 | 4 | `text-def.ts`, `text-model.ts`, T-MOD-504/505/512/513 | P3 |
| WP-080-08 | `DefineEditText` → TextFieldModel (16 flags, all fields, HTML hand-off) | WP-080-03 | 3 | `edit-text.ts`, T-MOD-514 | P3 |
| WP-080-09 | Align zones + CSM settings (decode, resolve, report) | WP-080-02 | 2 | `align-zones.ts`, `csm-settings.ts`, T-MOD-515 | P3 |
| WP-080-10 | Glyph atlas pipeline (raster, pack, KTX2/`.sfa`) | WP-080-02, WP-070-07 | 5 | `text/src/atlas.ts`, T-MOD-509 | P3 |
| WP-080-11 | Subsetter (static + dynamic reachability) | WP-080-10, WP-050-08 | 3 | `subset.ts`, T-MOD-510 | P6 |
| WP-080-12 | AVM1 layout/measure/HTML parser (runtime) | WP-080-08 | 6 | `text/src/layout.ts`, `measure.ts`, `html.ts`, T-MOD-507/508 | P9 |
| WP-080-13 | Font corpus + IR goldens (v1/v2/v3, device fonts, exotic names) | WP-080-07 | 3 | CI corpus, `inspect --fonts` | P3 |
| WP-080-14 | Deterministic WOFF2 emitter (stable names, normalized metrics, no timestamps) | WP-080-01/02/06 | 4 | WOFF2 artifact + T-AST-023 | P3 |
| | **Total** | | **45** | | |

## 13. Open items

| # | Item | Impact |
| --- | --- | --- |
| 1 | `DefineFont` files in the wild whose `OffsetTable[0] / 2` disagrees with the offset count — how tolerant to be before the shapes are misparsed | medium (`SF0271`) |
| 2 | Whether any shipping tool writes `CodeTableOffset` when `NumGlyphs = 0`, and whether it is 0 or omitted | low (`SF0282`) |
| 3 | `FontHeight` when `HasFontClass` is set: the field table and the flag text disagree (we read it); a corpus sweep would quantify how often it appears | low (`SF0285`, `E-017`) |
| 4 | Whether CSM `Thickness`/`Sharpness` ever reach us non-zero in AS1/AS2 content, and whether any title's look depends on them | low (`SF0277`) |
| 5 | `DefineFontInfo` before `DefineFont` in malformed files (ordering rule violated) — current policy: defer resolution to end-of-parse | low |
| 6 | The exact `TextBounds` semantics for right-aligned/justified runs (`Align` ≠ 0 with `XOffset`) — pin against the oracle | medium (`T-MOD-505`) |
| 7 | Whether device-text metrics should come from the manifest stack (deterministic) or the host (accurate) when they disagree | medium (`[verify]` policy, `SF0280`) |

The v1.0 open items (all the byte layouts) are **settled** — see §3–§8 and APP-§10.8.

## 14. Done criteria

1. Every font and text tag decodes; the font corpus renders glyph geometry identical to the
   reference within the GFX tolerances, with v2/v3 pairs producing identical IR.
2. Static text placement matches the hand-computed table on the layout fixtures, including runs with
   both offsets and negative leading.
3. Edit fields: all 16 flags round-trip into the model, the manifest, and the runtime binding.
4. Atlas + subset: a 400-glyph title ships inside the atlas budget with no missing glyph in the
   playthrough corpus.
5. Every diagnostic in §10 has a fixture; every `[verify]` decision has a golden vector or a
   documented reason.

## 15. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Scoped from Ch.10; record bit layouts marked pending with a declarative-table mitigation |
| 1.1 | 2026-10-04 | Ch.10-grounded: **glyph-space model** (EM square 1024 units for v1/v2, 20480 for `DefineFont3`, `TextHeight` as the scale — corrects v1.0's "coordinates are twips" wording and fixes `IMPL-080-R005`); full `DefineFont`/`2`/`3`/`4` bodies with flag bit order, offset-table and `CodeTableOffset` bases, `nGlyphs` inference, code-table sorting, negative `FontLeading`, unused `FontBoundsTable`/kerning policy, device-only fonts; `DefineFontInfo`/`2` flags, `FontNameLen` bytes-not-chars and UTF-8/UCS-2 rules, indirect font names; the real `TEXTRECORD` (single record type, XOffset before YOffset, absolute offsets, zero-byte terminator) replacing v1.0's incorrect two-type model; `DefineEditText`'s 16-flag word, field order and the `FontHeight`/`HasFontClass` upstream gap; align zones (pixel snapping, not hit zones) and `CSMTextSettings` formulas incl. the upstream inconsistency; diagnostics re-allocated to `SF0270`–`SF0289` (errata `E-019`) with new `SF0280`–`SF0285`; tests `T-MOD-512`–`518`; WPs 01–13 = 41 d |
