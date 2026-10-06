# IMPL-070 — Bitmaps, Lossless Images, and Shape Morphing

**Doc ID:** IMPL-070 · **Status:** ✅ grounded in Ch.8 + Ch.9 · **Package:** `@swf-forge/swf` + `@swf-forge/assets`
**Format spec:** Chapter 8 — Bitmaps (`DefineBits`, `JPEGTables`, `DefineBitsJPEG2/3/4`,
`DefineBitsLossless`/`2`, `COLORMAPDATA`/`ALPHACOLORMAPDATA`/`BITMAPDATA`/`ALPHABITMAPDATA`,
`PIX15`/`PIX24`); Chapter 9 — Shape Morphing (`DefineMorphShape`/`2`, `MORPHFILLSTYLEARRAY`/
`MORPHFILLSTYLE`, `MORPHGRADIENT`/`MORPHGRADRECORD`, `MORPHLINESTYLEARRAY`/`MORPHLINESTYLE`/
`MORPHLINESTYLE2`, start/end edge streams, morph ratio semantics)
**Design specs:** AST-§3–§5 (decode, re-encode, KTX2 upload ladder), AST-§7 (`.sfa`), GFX-§5 (IR),
GFX-R041–R047 (gradient sampling), GFX-R052/R053 (morph rendering), GFX-§12 (texture budget)
**Pinned byte layouts:** APP-§10.6 (Ch.8 bitmap structures) and APP-§10.7 (Ch.9 morph structures) — this document carries semantics, tolerance
policy, and the pixel model.

---

## 1. Deliverables

1. All seven bitmap definition tags (6, 8, 20, 21, 35, 36, 90) decoded into a single `BitmapAsset`
   model with provenance, keeping pixels compressed until the asset worker runs.
2. JPEG handling: the `JPEGTables` splice for `DefineBits`, the pre-SWF 8 erroneous
   `0xFFD9 0xFFD8` prefix, complete `DefineBitsJPEG2` images, and the separate alpha planes of
   `DefineBitsJPEG3`/`4` including the `DeblockParam` capture.
3. Lossless handling: 8-bit colormapped, 15-bit, 24-bit and 32-bit-ARGB forms, with the chapter's
   row-padding rule, correct channel order, and un-premultiplication of ARGB sources.
4. A single canonical pixel model (straight-alpha RGBA8) at the model boundary, with every
   format-specific conversion performed exactly once (§4).
5. Intent classification (photographic / synthetic / alpha carrier) that drives the lossy/lossless
   re-encode choice deterministically (AST-§4).
6. Morph shapes: `DefineMorphShape`/`2` decoded into paired start/end `VectorShape` IR plus edge-pair
   correspondence, with the Ch.9 morph model (ratio 0…65535, per-index interpolation, same-fill-type
   and same-edge-count restrictions) enforced or reported.
7. Byte-exactness tests for every container-level payload (JPEG splice, alpha plane length, lossless
   row layout, morph style interleaving).

**Non-goals:** choosing how many KTX2 variants to ship (AST-§4 decision), the renderer's atlas packing
(doc 130), and applying JPEG deblocking (R022). P3 owns decode models, the CPU preview path, and the
`assets dump` integration (WP-070-15); P6 owns production re-encoding, `.sfa`, and budget integration
(WP-070-06…09); P4 owns browser/GPU rendering. Video is P10 (`IMPL-110`), not part of this document's
P3 closure.

## 2. Module layout

```
packages/swf/src/images/
  define-bits.ts         DefineBits (6) — JPEG without tables
  jpeg-tables.ts         JPEGTables (8) — single-table rule, splice, tolerance
  define-bits-jpeg2.ts   DefineBitsJPEG2 (21) — complete JPEG or PNG/GIF passthrough
  define-bits-jpeg3.ts   DefineBitsJPEG3 (35) — AlphaDataOffset + zlib alpha plane
  define-bits-jpeg4.ts   DefineBitsJPEG4 (90) — alpha + DeblockParam
  define-bits-lossless.ts  DefineBitsLossless (20) — formats 3/4/5
  define-bits-lossless2.ts DefineBitsLossless2 (36) — formats 3/5 (+ observed 4)
  lossless-layout.ts     row padding, PIX15/PIX24, colormap and alpha-colormap readers
  pixel-model.ts         canonical straight-alpha RGBA8 conversion + un-premultiply
  image-model.ts         BitmapAsset classification + provenance
  jpeg-extract.ts        JPEG dimension/table parsing without a full decoder
  png-gif-pass.ts        embedded PNG/GIF detection in JPEG2/3/4
packages/assets/src/images/
  decode.ts              native decode (createImageBitmap) in the asset worker
  classify.ts            photographic vs synthetic heuristics (AST-§4)
  reencode.ts            KTX2/UASTC/ETC1S + WebP/PNG fallback ladder
  mips.ts                mip ladder generation and residual-error check (AST-R021)
packages/swf/src/morph/
  morph-def.ts           DefineMorphShape/2 headers, bounds pairs, offsets, flags
  morph-edges.ts         the two SHAPE edge streams + style-change consistency
  morph-styles.ts        MORPHFILLSTYLE / MORPHGRADIENT / MORPHLINESTYLE(2)
  morph-ir.ts            MorphShape IR, edge-pair correspondence, rounding policy
```

**IMPL-070-R001** Bitmap payloads MUST NOT be decoded at parse time. `DefineBits*` produces a
`BitmapAsset` holding the compressed bytes *as a view*; decoding happens in the asset worker (AST-§3)
so that parsing a 200 MB SWF does not decode 400 images eagerly.

**IMPL-070-R002** `images/` MUST NOT import from `packages/assets` (build-time image pipeline); the
dependency is one-way. The `BitmapAsset` model is the interface.

## 3. Bitmap tags and payloads (Ch.8)

| Tag | Code | SWF | Body (file order) |
| --- | --- | --- | --- |
| `DefineBits` | 6 | 1 | `CharacterID UI16`, `JPEGData` (SOI…EOI; **no tables** — they come from `JPEGTables`) |
| `JPEGTables` | 8 | 1 | `JPEGData` = the Tables/Misc segment, SOI…EOI; **one per file** |
| `DefineBitsJPEG2` | 21 | 2 | `CharacterID UI16`, `ImageData` = JPEG **or** PNG **or** GIF89a (PNG/GIF need SWF 8+) |
| `DefineBitsJPEG3` | 35 | 3 | `CharacterID UI16`, `AlphaDataOffset UI32`, `ImageData`, `BitmapAlphaData` (zlib) |
| `DefineBitsJPEG4` | 90 | 10 | `CharacterID UI16`, `AlphaDataOffset UI32`, `DeblockParam UI16`, `ImageData`, `BitmapAlphaData` |
| `DefineBitsLossless` | 20 | 2 | `CharacterID UI16`, `BitmapFormat UI8`, `BitmapWidth UI16`, `BitmapHeight UI16`, `[BitmapColorTableSize UI8]`, `ZlibBitmapData` |
| `DefineBitsLossless2` | 36 | 3 | as above with RGBA/ARGB forms (format 4 not documented — see R018) |

**IMPL-070-R003** `AlphaDataOffset` is the **byte count of `ImageData`**, not an offset: the alpha
plane that follows can only be located with it, so a wrong value must be detected (the zlib stream
would not start with `0x78`) and reported (`SF0255`-class, error) rather than shifted past.

**IMPL-070-R004** JPEG payload rules, applied to tags 6, 21, 35 and 90:
- the data begins with the **SOI marker `0xFFD8`** and ends with **EOI `0xFFD9`**;
- a **pre-SWF 8 erroneous header `0xFFD9 0xFFD8`** may precede the SOI and MUST be skipped
  (`SF0258`, info) — this is the chapter's own bug note, and it appears in real SWF 6/7 content;
- a missing EOI is `SF0255` (warning); the image is still handed to the decoder;
- failing to find an SOI at all means the decoder is given the payload as-is, with the failure
  reported once per asset.
- PNG/GIF magic (for tags 21/35/90): PNG = `89 50 4E 47 0D 0A 1A 0A`, GIF89a = `47 49 46 38 39 61`.
  Per the chapter these forms are allowed from **SWF 8**; a SWF < 8 file using them is `SF0203` (info,
  the design spec's code) and is still decoded. A PNG/GIF payload MUST be passed to a real decoder
  untouched (never through a JPEG decoder, never re-encoded to JPEG).

**IMPL-070-R005** `DefineBits` + `JPEGTables` splice: the tables payload supplies the
Tables/Misc segments the image lacks. Reconstruct as
`0xFFD8` + *(tables payload with its own SOI and EOI removed)* + *(image payload with its SOI and any
erroneous prefix removed)*, then decode. A `DefineBits` character with no `JPEGTables` in the file is
`SF0251` (error): the asset is preserved but marked undecodable. **Only one `JPEGTables` tag is
allowed per file**; when several appear, the **first** wins deterministically and `SF0257` (warning)
names the asset.

**IMPL-070-R006** `DefineBitsJPEG3`/`4` alpha: `BitmapAlphaData` is a zlib stream of **one byte per
pixel** whose inflated length must equal `width × height` exactly (mismatch = `SF0253`, error, alpha
dropped, image still usable). The plane is coverage, not premultiplied colour; combining it with the
decoded JPEG colour is the asset pipeline's job (R013). **When `ImageData` is PNG or GIF89a, the alpha
data is not supported** (chapter) — a trailing alpha plane is `SF0263`-class (error), ignored, and the
payload's own alpha (PNG) or lack thereof (GIF) is used instead.

**IMPL-070-R007** `DefineBitsJPEG4`'s `DeblockParam` is a `UI16` **8.8 fixed-point** value expressing a
relative deblocking strength of **0–100 %**. It MUST be captured and echoed into the manifest for
provenance (`SF0254`, info when non-zero) and MUST NOT be applied by us: it is a player-side filter,
and applying it would change pixels against the reference (GFX/AST tolerance decision).

### 3.1 Lossless layouts

```
DefineBitsLossless (20):   BitmapFormat 3 = 8-bit colormapped, 4 = 15-bit RGB, 5 = 24-bit RGB
DefineBitsLossless2 (36):  BitmapFormat 3 = 8-bit colormapped + RGBA table, 5 = 32-bit ARGB
                           (format 4 is not documented for this tag — R018)

COLORMAPDATA:      ColorTableRGB RGB[BitmapColorTableSize + 1], ColormapPixelData UI8[W*H]
ALPHACOLORMAPDATA: ColorTableRGB RGBA[BitmapColorTableSize + 1], ColormapPixelData UI8[W*H]
BITMAPDATA:        PIX15[W*H]  (format 4)   |   PIX24[W*H]  (format 5)
ALPHABITMAPDATA:   ARGB[W*H]   (format 5 of Lossless2; RGB is PREMULTIPLIED by alpha)
PIX15:             Reserved UB[1] = 0, Red UB[5], Green UB[5], Blue UB[5]      // 2 bytes/pixel
PIX24:             Reserved UI8 = 0, Red UI8, Green UI8, Blue UI8              // 4 bytes/pixel
```

- **IMPL-070-R008** `BitmapColorTableSize` is **one less than** the number of entries (up to 256);
  the palette is therefore `size + 1` colours and the pixel indices address it directly. Off-by-one
  here shifts every colour in the image.
- **IMPL-070-R009** Row padding: every row of `COLORMAPDATA`/`ALPHACOLORMAPDATA`/`BITMAPDATA` is
  rounded up to the next **32-bit word boundary**, computed with the pixel structure's own size —
  **1 byte** for indexed data, **2 bytes** for `PIX15`, **4 bytes** for `PIX24`/ARGB. The chapter's
  example: a 253-pixel 8-bit row pads to 256 bytes. `ALPHABITMAPDATA` rows are always aligned (4-byte
  pixels). Treating the block as a flat array shifts every row progressively left — the classic
  "diagonal smear". Pinned by `T-MOD-302`/`T-MOD-309`.
- **IMPL-070-R010** Channel order MUST be normalised to straight-alpha RGBA8 exactly once, at the model
  boundary: `PIX15` is `X R G B` (5 bits each, MSB-first inside its 16 bits), `PIX24` and
  `ALPHABITMAPDATA` are `X R G B` / `A R G B` in **byte** order. No later stage may shuffle channels;
  fixtures with distinct corner colours prove each layout (`T-MOD-303`/`T-MOD-311`).
- **IMPL-070-R011** `ALPHABITMAPDATA` is **premultiplied** ("The RGB data must already be multiplied by
  the alpha channel value", chapter). We un-premultiply into the canonical straight-alpha model:
  `r = a == 0 ? 0 : min(255, round(r × 255 / a))` (same for g, b), and record
  `sourcePremultiplied: true` on the asset. Skipping this leaves dark fringes on every alpha bitmap
  (AST-R006); over-brightening (rounding up past 255) is the opposite bug — the clamp is mandatory
  (`T-MOD-310`). Palette colours (`ALPHACOLORMAPDATA`) are **not** premultiplied by the chapter and are
  read as written.
- **IMPL-070-R012** Pixel order in all non-JPEG arrays is row-major: left to right within a row, rows
  top to bottom (chapter). A vertical flip at decode time is a defect, not a preference — the reference
  tools agree, and goldens pin it.

## 4. Alpha and the canonical pixel model

**IMPL-070-R013** The build pipeline's canonical image is **straight-alpha RGBA8**, top-left origin.
`DefineBitsJPEG3`/`4` colour is taken from the decoded JPEG and its coverage from the inflated plane;
because JPEG colour for fully transparent pixels is undefined-but-nonzero in practice, the pipeline
MUST composite the colour over black **before** combining (so that a later un-premultiply cannot
amplify JPEG noise), and MUST record the operation in the report. The chapter is silent on this step;
it is our fidelity decision (AST-§3), verified visually against the oracle (`T-MOD-304`, `T-AST-002`).

**IMPL-070-R014** Alpha-bearing lossless images (`ALPHABITMAPDATA`, `ALPHACOLORMAPDATA`) MUST go through
the same canonicalisation path as JPEG3 alpha, so classification and re-encoding see identical inputs
regardless of source tag. The un-premultiply of R011 happens **before** classification computes alpha
coverage, or the heuristic sees clamped colours (`T-MOD-306`).

**IMPL-070-R015** `BitmapAsset.kind` classification (AST-§4) MUST be deterministic and MUST record its
inputs (dimensions, entropy estimate, distinct-colour count, alpha coverage, source format). A
classification that changes between two runs of the same build is a defect (AST-R016), not a tolerable
diff.

## 5. The `BitmapAsset` model

```ts
export interface BitmapAsset {
  readonly id: number;
  readonly source: 'defineBits' | 'jpeg2' | 'jpeg3' | 'jpeg4' | 'lossless1' | 'lossless2';
  readonly payload: Uint8Array;              // view into the decompressed buffer (image data)
  readonly alpha: Uint8Array | null;         // inflated alpha plane (jpeg3/4) as stored, else null
  readonly alphaDataOffset: number | null;   // jpeg3/4: declared ImageData byte count
  readonly declaredSize: { width: number; height: number } | null;   // lossless: from the header
  readonly losslessFormat: 3 | 4 | 5 | null; // bit depth / palette form
  readonly paletteSize: number | null;       // entries (size + 1), formats 3 only
  readonly jpegTables: Uint8Array | null;    // DefineBits only
  readonly deblocking: number | null;        // jpeg4, 8.8 raw
  readonly contentType: 'jpeg' | 'png' | 'gif' | 'lossless-rgb' | 'lossless-rgba' | 'unknown';
  readonly sourcePremultiplied: boolean;     // true for ALPHABITMAPDATA (R011)
  readonly kind: 'photo' | 'synthetic' | 'alpha-carrier' | 'unknown';   // classified in AST-§4
  readonly origin: TagRef;
}
```

**IMPL-070-R016** `declaredSize` MUST be cross-checked against the inflated lossless byte count
(including row padding): a mismatch is `SF0250` (error) and the asset is kept with its declared size but
flagged unusable. Silent acceptance of a short buffer is how a bitmap decode takes down the asset
worker.

**IMPL-070-R017** All fields above MUST be derivable without inflating the zlib payload; inflation is
lazy and belongs to the asset worker. `paletteSize`, `losslessFormat` and `declaredSize` come from the
tag header alone (R001).

**IMPL-070-R018** `DefineBitsLossless2` with `BitmapFormat = 4` (15-bit) is **not documented** for this
tag; Flash Player has been observed to display it. We decode it through the 15-bit reader with
`SF0259` (info) rather than failing the tag — a documented deviation, pinned by `T-MOD-313`.

**IMPL-070-R019** An unknown `BitmapFormat` is `SF0260`-class (error, tag quarantined): the payload
length cannot be derived without knowing the pixel size, so nothing after it can be trusted.

## 6. Morph shapes (Ch.9)

### 6.1 Tag bodies

```
DefineMorphShape (46, SWF 3):
  CharacterId UI16
  StartBounds RECT            EndBounds RECT
  Offset UI32                 // "indicates offset to EndEdges"
  MorphFillStyles MORPHFILLSTYLEARRAY
  MorphLineStyles MORPHLINESTYLEARRAY
  StartEdges SHAPE            // style changes + edges for the start state
  EndEdges SHAPE              // edges only, no style changes (except MoveTo)

DefineMorphShape2 (84, SWF 8):
  CharacterId UI16
  StartBounds RECT            EndBounds RECT
  StartEdgeBounds RECT        EndEdgeBounds RECT      // strokes excluded
  Reserved UB[6] = 0
  UsesNonScalingStrokes UB[1] UsesScalingStrokes UB[1]
  Offset UI32
  MorphFillStyles ...         MorphLineStyles ...
  StartEdges SHAPE            EndEdges SHAPE
```

**IMPL-070-R020** The two edge arrays are **two independent SHAPE streams**, not one interleaved stream:
`StartEdges` carries the `NumFillBits`/`NumLineBits` header followed by both style-change records and
start-state edges; `EndEdges` carries its own 8-bit `NumFillBits`/`NumLineBits` header (writers emit
zeros for it) followed by end-state edges only. Both streams terminate at their own `End` record, and
the start stream's records end byte-aligned before the end stream's header byte. Parsing MUST NOT
"share" style state between the streams — style-change records are defined once, in `StartEdges`
(R021).

**IMPL-070-R021** Style-change consistency: the chapter requires the start and end shapes to have the
**same style-change records** (they are stored only in `StartEdges`) and the **same number of edges**.
A `MoveTo` in one stream without the counterpart in the other (and vice versa) is `SF0265` (warning);
we synthesise the missing move from the neighbouring stream so the pairing stays defined.

**IMPL-070-R022** `Offset` is a **hint**, and our parser MUST be able to place `EndEdges` by parsing
`StartEdges` to its `End` record alone. When `Offset` disagrees with the parsed position by more than
the record-granularity tolerance, report `SF0264` (warning) and continue with the parsed layout —
never seek to a wrong offset and desynchronise the tag. Locating `EndEdges` through `Offset` alone is
forbidden (real files exist where the field is stale).

**IMPL-070-R023** `PlaceObject2`'s `Ratio` drives the morph: `0` = exactly the start state, `65535` =
exactly the end state, values in between interpolate (chapter). Our model accepts `Ratio` from
`PlaceObject2` *and* `PlaceObject3` (the field is shared) and passes it through as a 16-bit value; the
renderer writes the interpolated geometry (GFX-R052). The IIR MUST NOT bake a single ratio into the
character.

### 6.2 Morph styles

```
MORPHFILLSTYLEARRAY: FillStyleCount UI8 (0xFF → UI16), MORPHFILLSTYLE[count]
MORPHFILLSTYLE: FillStyleType UI8, then per type:
  solid     (0x00): StartColor RGBA, EndColor RGBA
  gradient  (0x10/0x12/0x13): StartGradientMatrix MATRIX, EndGradientMatrix MATRIX, MORPHGRADIENT
  bitmap    (0x40–0x43): BitmapId UI16, StartBitmapMatrix MATRIX, EndBitmapMatrix MATRIX
MORPHGRADIENT: NumGradients UI8 (1..8), MORPHGRADRECORD[NumGradients]
MORPHGRADRECORD: StartRatio UI8, StartColor RGBA, EndRatio UI8, EndColor RGBA
MORPHLINESTYLEARRAY: LineStyleCount UI8 (0xFF → UI16), MORPHLINESTYLE[count] (v1) | MORPHLINESTYLE2[count] (v2)
MORPHLINESTYLE:  StartWidth UI16, EndWidth UI16, StartColor RGBA, EndColor RGBA
MORPHLINESTYLE2: StartWidth UI16, EndWidth UI16,
                 ONE flag word: StartCapStyle UB[2], JoinStyle UB[2], HasFillFlag UB[1],
                 NoHScaleFlag UB[1], NoVScaleFlag UB[1], PixelHintingFlag UB[1], Reserved UB[5],
                 NoClose UB[1], EndCapStyle UB[2],
                 MiterLimitFactor UI16 (8.8) iff JoinStyle == 2,
                 then: StartColor RGBA + EndColor RGBA   (HasFillFlag = 0)
                    or: one MORPHFILLSTYLE                (HasFillFlag = 1, itself a start/end pair)
```

- **IMPL-070-R024** Morph fill/line style arrays pair start and end **by index**; both arrays use the
  same count and the same `0xFF` extended-count escape as static shapes (R006 in doc 060). `FillStyle`
  index `0` still means "no style" (1-based model, doc 060 §4.1).
- **IMPL-070-R025** `MORPHGRADIENT` uses a **`UI8` count** (1…8) — not the nibble form of Ch.7's
  `GRADIENT` — followed by interleaved `(StartRatio, StartColor, EndRatio, EndColor)` records. Both
  matrices are read before the count. A start/end control-point count mismatch is impossible by
  construction; a *style-level* mismatch (different ramp lengths between two styles) is `SF0267`
  (warning) and paired with the shorter list.
- **IMPL-070-R026** `MORPHLINESTYLE2` carries **one** flag word and **one** miter limit shared by both
  states, exactly as the chapter's table lists (only the widths and the colours/fill pair vary). The
  flag word uses the LINESTYLE2 layout (doc 060 §4.4), so the same bit-field reader MUST be reused;
  a second hand-rolled layout is forbidden. Maximum miter length is `MiterLimitFactor × StartWidth`
  and `MiterLimitFactor × EndWidth` — one per state, since the widths differ.
- **IMPL-070-R027** Morph style counts that differ between the two style *kinds* (e.g. a v2 file whose
  fill count and line count disagree, or a `StartEdges` style index pointing past the array) follow
  doc 060's index-validation rules: clamp to 0 and report (`SF0181`), never re-number.
- **IMPL-070-R028** Morph gradients inherit Ch.7's spread/interpolation flags per state (each
  `MORPHGRADIENT` has one flags byte, read exactly like `GRADIENT`'s, before the records — see
  APP-§10.6/§10.7); a difference between the two states' modes is reported (`SF0192`-class).

### 6.3 Morph IR and correspondence

```ts
export interface MorphShape {
  readonly id: number;
  readonly version: 1 | 2;
  readonly start: VectorShape;
  readonly end: VectorShape;
  readonly startBounds: Rect;
  readonly endBounds: Rect;
  readonly startEdgeBounds: Rect | null;      // v2 only
  readonly endEdgeBounds: Rect | null;        // v2 only
  readonly edgeCounts: { start: number; end: number };
  readonly pairs: readonly EdgePair[];        // index-correlated start/end edges
  readonly correspondence: MorphCorrespondence | null;   // null => ratio-baked meshes (GFX-D14)
  readonly flags: { nonScalingStrokes: boolean; scalingStrokes: boolean };
}
```

- **IMPL-070-R029** Morph geometry MUST be decoded into the same `VectorShape` IR as static shapes, plus
  an explicit `pairs` list. Where the edge counts differ (malformed), `SF0261` (warning) and the extra
  edges are paired with a degenerate counterpart (zero-length at the neighbouring anchor) so
  interpolation stays defined.
- **IMPL-070-R030** **Straight ↔ curved pairing** (chapter): when one state's edge is straight and the
  other's is curved, *both* are treated as quadratic curves; the straight edge becomes a curve with
  `control = delta / 2` and `anchor = delta / 2`. Odd delta components therefore halve to fractional
  twips: the IR MUST keep rational twips for morph pairs and round **once** at tessellation (banker's
  rounding, deterministic), rather than rounding each half independently (`T-MOD-407`; the naive
  round-half-up of both halves loses the endpoint by a twip).
- **IMPL-070-R031** A morph with `Ratio == 0` MUST render exactly the `start` shape and `Ratio == 65535`
  exactly the `end` shape, bit-for-bit with the static geometry path for the same edge set — the
  tessellator MUST be invoked with the same inputs so no ratio-dependent wobble appears at the
  endpoints (`T-MOD-401`).
- **IMPL-070-R032** Baking is allowed only for a *finite set of ratios* the renderer uses for whole-clip
  ratio animation (`ratioBake: number[]`, default empty; decision `GFX-D14`). Arbitrary ratios require
  runtime interpolation or a shader-side morph (GFX-R052), and the emitter MUST record which one it
  chose (`SF0262`, info).
- **IMPL-070-R033** `DefineMorphShape2`'s `UsesNonScalingStrokes`/`UsesScalingStrokes` and the
  edge-bounds pairs MUST be captured; the flags feed the same stroke pipeline as `DefineShape4`
  (doc 060 §3) and MUST NOT be re-derived from the edge list.
- **IMPL-070-R034** Morph restrictions from the chapter are **checked and reported**, not assumed:
  equal edge counts (`SF0261`), same fill *type* per style index (`SF0260`), same bitmap id when
  bitmap-filled (`SF0268`, warning), same style-change records (`SF0265`). A morph that violates them
  still decodes — the endpoints remain usable even when the blend is nonsense.

## 7. Diagnostics

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0250` | error | lossless bitmap byte count does not match declared size + row padding |
| `SF0251` | error | `DefineBits` without an available `JPEGTables` (asset preserved, undecodable) |
| `SF0252` | error | JPEG payload undecodable (no SOI found); asset preserved for the report |
| `SF0253` | error | JPEG3/4 alpha plane length ≠ `width × height` (alpha dropped) |
| `SF0254` | info | non-zero deblocking parameter recorded, not applied |
| `SF0255` | warning | JPEG missing EOI marker, or `AlphaDataOffset` does not delimit a zlib stream |
| `SF0256` | warning | progressive JPEG detected (decode support is platform-dependent) |
| `SF0257` | warning | multiple `JPEGTables` tags in one file (the first wins) |
| `SF0258` | info | pre-SWF 8 erroneous `FFD9FFD8` prefix before the SOI (skipped) |
| `SF0259` | info | `DefineBitsLossless2` with format 4 (undocumented, observed) — decoded anyway |
| `SF0260` | error | unknown `BitmapFormat` (pixel size unknown; tag quarantined) |
| `SF0261` | warning | morph edge counts differ; degenerate pairs synthesised |
| `SF0262` | info | morph ratio bake set selected (decision `GFX-D14`) |
| `SF0263` | error | morph IR would exceed the vertex budget (reported, mesh dropped) |
| `SF0264` | warning | morph `Offset` inconsistent with the parsed `EndEdges` position (hint ignored) |
| `SF0265` | warning | morph style-change/`MoveTo` records differ between the two edge streams |
| `SF0266` | info | morph straight↔curved pairing halved an odd delta (rational twips retained) |
| `SF0267` | warning | morph gradient control-point counts differ between the paired states |
| `SF0268` | warning | morph restriction violated: paired states differ in bitmap id or fill type per style index |
| `SF0269` | error | alpha plane present on a PNG/GIF payload (ignored; the payload's own alpha wins) |

The block is `SF0250`–`SF0269` rather than interleaved into `SF0200`–`SF0249`, which the design specs
already publish scattered codes in (`GFX-050` owns `SF0201`/`SF0207`/`SF0210`; `AST-070` owns
`SF0203`–`SF0206`, `SF0211`–`SF0213`) — see errata `E-015`; the media/emitter codes those specs
published inside `SF0200`–`SF0249` were re-pointed to their owning documents in `E-016`. The PNG/GIF
passthrough record deliberately reuses the design spec's `SF0203` (`AST-R004`) instead of defining a
second code for the same condition.

**IMPL-070-R035** The morph codes `SF0261`–`SF0268` are emitted **per character**, deduplicated,
so a 300-morph movie produces a readable report rather than 300 identical lines.

## 8. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| `T-MOD-301` | `DefineBits` + `JPEGTables` splice produces a decodable JPEG (byte-compare the merged stream) | F1 |
| `T-MOD-302` | lossless row padding: a 3×3 24-bit image with distinct rows decodes with rows in place | F1 |
| `T-MOD-303` | lossless/lossless2 colour order: corner-colour fixtures prove XRGB vs ARGB channels | F1 |
| `T-MOD-304` | JPEG3/4 alpha inflate: exact `w × h`, mismatch path, alpha-over-black composite | F1 |
| `T-MOD-305` | PNG/GIF passthrough is byte-identical to the tag payload | F1 |
| `T-MOD-306` | classification stability: the same input classifies identically across 100 runs | F1 |
| `T-MOD-307` | mip ladder residual error within the AST-R021 tolerance on the corpus | F2 |
| `T-MOD-308` | `.sfa` round-trip: decode → emit → decode yields identical pixels | F1 |
| `T-MOD-309` | row padding for all four pixel sizes (indexed 1 B, PIX15 2 B, PIX24 4 B, ARGB 4 B) incl. the 253-px example | F1 |
| `T-MOD-310` | `ALPHABITMAPDATA` un-premultiply: round-trip, `alpha == 0` case, 255-clamp | F1 |
| `T-MOD-311` | `PIX15` bit order (`Reserved/R/G/B` 5-bit fields) and `PIX24` zero byte | F1 |
| `T-MOD-312` | erroneous `FFD9FFD8` prefix tolerated; multiple `JPEGTables` → first wins + `SF0257` | F1 |
| `T-MOD-313` | `DefineBitsLossless2` format 4 decoded with `SF0259`; unknown format quarantined (`SF0260`) | F1 |
| `T-MOD-401` | morph endpoints: ratio 0/65535 renders identical to the static shapes (via IR diff) | F1 |
| `T-MOD-402` | morph style pairing on count mismatch (fill/line arrays) | F1 |
| `T-MOD-403` | degenerate correspondence for unequal edge counts | F1 |
| `T-MOD-404` | two-stream parse: style changes only in `StartEdges`, the `EndEdges` header byte, an inconsistent `Offset` (`SF0264`) | F1 |
| `T-MOD-405` | `MORPHGRADIENT`: `UI8` count, start/end matrix order, interleaved `(ratio, colour)` pairs | F1 |
| `T-MOD-406` | `MORPHLINESTYLE2`: one shared flag word, miter `× StartWidth`/`× EndWidth`, `HasFillFlag` fill pair | F1 |
| `T-MOD-407` | straight↔curved pairing with odd deltas: rational twips retained, single deterministic rounding | F1 |
| `T-MOD-408` | morph restriction checks: unequal edge counts, different bitmap ids, missing `MoveTo` counterpart | F2 |

## 9. Work packages

| WP | Title | Depends | Est | Deliverable | Phase owner |
| --- | --- | --- | --- | --- | --- |
| WP-070-01 | `BitmapAsset` model + `DefineBitsJPEG2/3/4` bodies | WP-010-11, WP-020-05 | 4 | `define-bits-jpeg*.ts`, T-MOD-303 | P3 |
| WP-070-02 | `DefineBits` + `JPEGTables` splice, single-table rule, prefix tolerance | WP-070-01 | 3 | `jpeg-tables.ts`, T-MOD-301/312 | P3 |
| WP-070-03 | PNG/GIF passthrough detection (magic bytes, SWF 8 gate) | WP-070-01 | 1 | T-MOD-305 | P3 |
| WP-070-04 | `DefineBitsLossless`(+2): header, padding, palette, channel order | WP-070-01 | 4 | `lossless-layout.ts`, T-MOD-302/309/311/313 | P3 |
| WP-070-05 | Alpha plane inflate + canonical straight-alpha model (un-premultiply) | WP-070-04 | 3 | `pixel-model.ts`, T-MOD-304/310 | P3 |
| WP-070-06 | Classification heuristics + manifest recording | WP-070-05 | 3 | `assets/src/images/classify.ts`, T-MOD-306 | P6 |
| WP-070-07 | Re-encode ladder + mip generation + residual check | WP-070-06 | 5 | `reencode.ts`, `mips.ts`, T-MOD-307 | P6 |
| WP-070-08 | `.sfa` writer/reader + round-trip test | WP-070-07 | 3 | T-MOD-308 | P6 |
| WP-070-09 | Texture budget accounting into `budgets.json` | WP-070-07 | 2 | AST-§4 integration | P6 |
| WP-070-10 | Morph tag decode: headers, bounds, both edge streams, `Offset` check | WP-060-09 | 5 | `morph-def.ts`, `morph-edges.ts`, T-MOD-401/404 | P3 |
| WP-070-11 | Morph styles: `MORPHFILLSTYLE`, `MORPHGRADIENT`, `MORPHLINESTYLE2` | WP-070-10, WP-060-04 | 4 | `morph-styles.ts`, T-MOD-405/406 | P3 |
| WP-070-12 | Morph IR: pairing, straight↔curved rounding, ratio-bake decision | WP-070-11 | 3 | `morph-ir.ts`, T-MOD-402/403/407/408 | P3 |
| WP-070-13 | Image corpus harness (decode parity vs a reference decoder) | WP-070-07 | 4 | CI corpus, parity report | P3 |
| WP-070-14 | Morph corpus + endpoint/blend goldens | WP-070-12, WP-140-03 | 3 | morph goldens, T-MOD-401 | P3 |
| WP-070-15 | `assets dump` CLI integration, local PNG previews, sorted manifest + repeat-run golden | WP-060-11, WP-070-05/13/14, WP-080-14, WP-090-11 | 6 | `forge-decompile assets dump`, CLI golden, stable hashes | P3 |
| | **Total** | | **53** | | |

## 10. Open items

| # | Item | Impact |
| --- | --- | --- |
| 1 | `DefineBits` payloads in the wild: do they always start with SOI, or sometimes only with the frame header (the chapter says both)? We accept either — pin with corpus evidence | low (R004/R005) |
| 2 | JPEG3/4 colour-over-black compositing before alpha combination: the chapter is silent; our decision needs oracle visual confirmation | medium (AST-R005, `T-MOD-304`) |
| 3 | `Offset`'s reference base (tag body vs the field itself) and how tolerant real players are — we validate loosely and never seek | low (`SF0264`) |
| 4 | `EndEdges`' 8-bit `NumFillBits`/`NumLineBits` header: confirm every writer emits it (a missing byte would break the parse) | medium (R020) |
| 5 | Straight↔curved morph pairing with odd deltas: fractional-twip handling in other players (we keep rationals and round once) | medium (`T-MOD-407`) |
| 6 | Whether `ALPHACOLORMAPDATA` palettes are ever written premultiplied by tools despite the chapter | low (R011) |
| 7 | `numpy`-style ramp differences: how morph gradients with differing modes across states render (we report and interpolate modes) | low (`SF0192`-class) |
| 8 | Applying `DeblockParam`: we ignore it by decision; the residual difference on the corpus is unmeasured | low (R007) |
| 9 | Whether `DefineBitsLossless2` format 4 content is common enough to keep a dedicated fixture | low (`SF0259`) |

The v1.0 open items (lossless header layout, JPEG3 alpha semantics, JPEG4 units, the splice rule,
`DefineMorphShape2` extras, morph style-count behaviour, morph `Offset`) are **settled** — see §3, §6
and APP-§10.6/§10.7. In particular: the lossless header and its padding are fully specified (R008–R012), the
JPEG4 deblocking parameter is an 8.8 fixed-point strength (R007), the morph `Offset` is a hint we
validate but never depend on (R022), and morph style arrays pair by index (R024).

## 11. Done criteria

1. All seven bitmap tags and both morph tags decode; the corpus runs clean.
2. Pixel parity with a reference decoder within the AST-§3 tolerances (byte-exact for passthrough).
3. Alpha images look correct against the reference renderer, including the un-premultiply path.
4. Morph endpoints are IR-identical to their static equivalents, and blends are stable across engines
   (rational twips, single rounding).
5. Texture budget accounting is live and reported in `budgets.json`.
6. Every diagnostic in §7 has at least one fixture that triggers it, and every fixture decodes without
   an uncaught exception.

## 12. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Scoped from Ch.8/Ch.9; pixel-affecting layouts marked pending |
| 1.1 | 2026-10-04 | Ch.8/Ch.9-grounded rewrite: exact tag bodies for all seven bitmap tags; JPEG SOI/EOI rule with the pre-SWF 8 erroneous `FFD9FFD8` prefix; single-`JPEGTables` splice rule; PNG/GIF exact magic and SWF 8 gate; `AlphaDataOffset` = byte count, alpha unsupported with PNG/GIF; `DeblockParam` 8.8 0–100 %; lossless formats 3/4/5 with palette = size + 1, per-row 32-bit padding by pixel size, `PIX15`/`PIX24` bit fields and XRGB/ARGB order; **`ALPHABITMAPDATA` premultiplied** → canonical straight-alpha with un-premultiply; two-stream morph edge model with the `Offset` hint rule; morph style interleaving incl. `MORPHGRADIENT` (`UI8` count) and `MORPHLINESTYLE2` (one shared flag word, per-state miter); morph restrictions, straight↔curved pairing and rational-twip rounding; diagnostics `SF0250`–`SF0269`; tests `T-MOD-309`–`313` and `T-MOD-404`–`408`; WPs 01–14 = 47 d |
