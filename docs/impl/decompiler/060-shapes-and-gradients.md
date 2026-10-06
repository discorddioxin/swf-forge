# IMPL-060 — Shapes, Paths, and Gradients

**Doc ID:** IMPL-060 · **Status:** ✅ grounded in Ch.6 + Ch.7
**Package:** `@swf-forge/shapes`, `@swf-forge/geometry`
**Format spec:** Chapter 6 — Shapes (`FILLSTYLE`/`FILLSTYLEARRAY`, `LINESTYLE`/`LINESTYLE2`/
`LINESTYLEARRAY`, `SHAPE`, `SHAPEWITHSTYLE`, `SHAPERECORD`, `DefineShape`/`2`/`3`/`4`).
Chapter 7 supplies the gradient structures (`GRADIENT`, `FOCALGRADIENT`, `GRADRECORD`, spread and
interpolation modes, control-point limits) — §4.3 is grounded in it.
**Design specs:** GFX (whole), GFX-§4.2–4.4 (paths, tessellation, winding), GFX-R024/R041/R081/R086,
CMP-§4.3 (DAG extraction), REPO-R015 (determinism), APP-§10.4 (Ch.6 fixed layouts)
**Pinned byte layouts:** APP-§10.4 (Ch.6 structures) — this document carries semantics, IR, and traps.

---

## 1. Deliverables

Everything between "a tag body" and "a GPU-ready draw list" for vector art:

1. All four `DefineShape` versions (2, 22, 32, 83) with their differing style arrays, bounds and flags.
2. The full `FILLSTYLE` set (8 `FillStyleType` values) and the full `LINESTYLE`/`LINESTYLE2` sets,
   including caps, joins, miter limit, non-scaling strokes and `NoClose`.
3. `SHAPE`/`SHAPEWITHSTYLE` decoding: the four `SHAPERECORD` kinds, the bit-field widths, style-change
   semantics, and every documented decoder trap (1-based style arrays, index 0 = "no style",
   `FillStyle0`/`FillStyle1` sides, curved-edge delta widths).
4. Fill rules: the per-shape winding rule (`DefineShape4`), hole/open-figure handling, and the
   `FillStyle0`/`FillStyle1` chaining algorithm on a shared edge.
5. The unified geometry IR (`VectorShape`) that the renderer consumes — the *only* geometry type in the
   codebase — plus quantisation, simplification, and golden-stable serialisation.
6. Bounds: declared shape bounds (strokes included), `DefineShape4` edge bounds (strokes excluded), and
   the recomputed-bounds cross-check.
7. Gradients in full (Ch.7): the `GRADIENT`/`FOCALGRADIENT` structures, the shared spread/interpolation
   flags byte, control-point records and limits, and their plumbing to the sampler (GFX-R041–R047,
   doc 130).

**Non-goals:** rasterisation and draw-call batching (GFX/doc 130), font glyph geometry (doc 080 owns
the `SHAPE`-in-font path), bitmap decoding (doc 070), morph interpolation (doc 070 owns `DefineMorphShape`
and consumes this document's edge model).

## 2. Module layout

```
packages/shapes/src/
  define-shape.ts    tag headers: bounds, edge bounds, flags, version dispatch
  style-arrays.ts    FILLSTYLEARRAY / LINESTYLEARRAY incl. extended counts and the dedupe ceiling
  fill-style.ts      all eight FillStyleType values + bitmap matrix
  gradient.ts        GRADIENT / FOCALGRADIENT: flags byte, control points, focal point (Ch.7)
  line-style.ts      LINESTYLE + LINESTYLE2 bit fields, caps, joins, miter model
  shaperecord.ts     SHAPERECORD state machine (the four record kinds)
  edge-math.ts       delta decoding, quadrant reconstruction, on-curve/off-curve handling
  path-build.ts      fill0/fill1 chaining, rewinds, open/closed figures
  winding.ts         even-odd vs non-zero per style layer (DefineShape4 rule)
  vector-ir.ts       VectorShape/VectorPath/FillPath/StrokePath types + serialisation
  quantise.ts        1/20 px (and 0.05 px) snapping at the correct pipeline stage
  simplify.ts        deterministic 4-step simplification
  bounds.ts          declared vs recomputed vs edge bounds
  corpus.ts          corpus loader used by doc 140's golden runner
packages/geometry/src/
  curve.ts           quadratic/cubic conversion (1/3 rule + recursive subdivision)
  flatten.ts         adaptive flattening with a deterministic tolerance ladder
```

**IMPL-060-R001** `@swf-forge/geometry` MUST contain **no SWF knowledge**: no twips, no style ids,
no bit readers. It is pure geometry maths so the runtime (doc 130), the tessellator, and the compiler
all share one implementation.

**IMPL-060-R002** `VectorShape` MUST be the only geometry type crossing into the renderer; the
import-boundary lint rule (WP-060-11) enforces it. Renderer-side types are built from it, never
alongside it.

## 3. Tag set and versions

| Tag | Code | SWF | Colours | Style arrays | Extras |
| --- | --- | --- | --- | --- | --- |
| `DefineShape` | 2 | 1 | RGB | `LINESTYLE`, `FILLSTYLE` | — |
| `DefineShape2` | 22 | 2 | RGB | extended counts (`0xFF`) | — |
| `DefineShape3` | 32 | 3 | RGBA | extended counts | — |
| `DefineShape4` | 83 | 8 | RGBA | extended counts, `LINESTYLE2` | `EdgeBounds`, `UsesFillWindingRule`, `UsesNonScalingStrokes`, `UsesScalingStrokes` |

- **IMPL-060-R003** The version dispatch MUST be by tag code, never by the movie's declared version:
  a SWF 8 movie may contain `DefineShape` (v1) tags, and the colour type follows the *tag*, not the
  file. Getting this wrong silently splits alpha channels into garbage (a classic bug:
  `DefineShape3`'s RGBA read as RGB shifts every subsequent byte).
- **IMPL-060-R004** `DefineShape4` is `DefineShape3` plus `EdgeBounds` ("bounds of the shape,
  excluding strokes") and the flag byte; the reserved five bits MUST be preserved (reported once per
  file, `SF0188`), `UsesFillWindingRule` selects the fill rule for that shape (§6.2) and is documented
  as **SWF 10+** (bits in a SWF 8 file are still honoured, with `SF0183`), and
  `UsesNonScalingStrokes`/`UsesScalingStrokes` record whether the shape contains at least one
  non-scaling / scaling stroke. `UsesNonScalingStrokes`/`UsesScalingStrokes` MUST be recorded in the
  IR and the report (they change the renderer's geometry pipeline, GFX-R072) but MUST NOT be silently
  coerced.
- **IMPL-060-R005** `DefineShape4` MUST be accepted in files declaring SWF < 8 with `SF0183` (info);
  the player tolerates newer tags in older files, and refusing them breaks real content.

## 4. Style arrays and fills

### 4.1 `FILLSTYLEARRAY`

```
FILLSTYLEARRAY:
  FillStyleCount UI8                    1..255, or 0xFF as the escape
  if FillStyleCount == 0xFF:             // DefineShape2 and DefineShape3/4 only
    FillStyleCountExtended UI16         1..65535
  FillStyle[FillStyleCount]
```

- **IMPL-060-R006** The `0xFF` escape cannot appear in `DefineShape` (v1): there `0xFF` is a literal
  count of 255 and no `UI16` follows; decoding the escape desynchronises the whole tag and is a known
  reason shapes "explode" into noise. The chapter's field table says the extended count is "supported
  only for Shape2 and Shape3"; `DefineShape4` reuses the same structure, so we accept the escape there
  too as a tolerated extension (`SF0191`, info, once per file) — a Shape4 encoder that emits the
  extension is real, and the alternative mis-reads the array.
- **IMPL-060-R007** Arrays are **1-based**: the first style in the file is index **1**, and index **0**
  is reserved to mean "no style". Every `FillStyle0`/`FillStyle1`/`LineStyle` value MUST be validated
  against `1..count`; `0` is legal and means "no fill/stroke"; anything larger is `SF0181` (error,
  clamped to 0) and the shape is quarantined (doc 150's skip policy).
- **IMPL-060-R008** Each style array MUST be stored in the IR as an explicitly 1-based lookup
  (`styles[0] = null`) so off-by-one handling lives in exactly one place.

### 4.2 `FILLSTYLE`

| `FillStyleType` | Meaning |
| --- | --- |
| `0x00` | solid |
| `0x10` | linear gradient |
| `0x12` | radial gradient |
| `0x13` | focal radial gradient |
| `0x40` | repeating `BitmapId` fill |
| `0x41` | clipped `BitmapId` fill |
| `0x42` | non-smoothed repeating `BitmapId` fill |
| `0x43` | non-smoothed clipped `BitmapId` fill |

- **IMPL-060-R009** Any other byte is `SF0180` (error) and the fill becomes a magenta debug style
  (never a crash, never a silent skip that shifts the stream — the field widths are known because the
  unknown type still has no defined payload, but a `BitmapId`-bearing type has more fields, so the tag
  is quarantined rather than half-read; `[verify]` §11 #1).
- **IMPL-060-R010** Solid fills MUST carry a colour whose component count comes from the tag version
  (RGB for `DefineShape`/`DefineShape2`, RGBA for `DefineShape3`/`4`) — see R003.
- **IMPL-060-R011** `BitmapMatrix` maps **bitmap space → shape space**: a point is transformed into the
  bitmap's unit square and then sampled. This is why a repeating fill tiles at the bitmap's native
  pixel size regardless of the shape's bounding box, and why clipped fills take the *edge colour* of
  the bitmap outside the tile (they do not repeat). The IR MUST store the matrix as written (no
  normalisation, no inversion) plus the repeat mode; inverting at decode time is a defect.
  Pinned by `T-MOD-104`.
- **IMPL-060-R012** The four bitmap fill types map to `repeat` × {smooth, nearest} × {clipped,
  repeating} exactly:
  `0x40` = repeating+smooth, `0x41` = clipped+smooth, `0x42` = repeating+nearest,
  `0x43` = clipped+nearest. `clipped` MUST NOT be modelled as "repeat with clamp-to-edge" unless the
  renderer's wrap mode produces the bitmap's edge pixels in *bitmap space* (GL `CLAMP_TO_EDGE` does),
  and the choice MUST be recorded in the manifest (REPO-R015: the wrap mode is part of the output
  contract, not a renderer detail).

### 4.3 Gradient fills (Ch.7)

```
GRADIENT:
  GradientMatrix MATRIX       // maps the gradient square to display space (stored in the FILLSTYLE)
  SpreadMode UB[2]            // 0 = pad, 1 = reflect, 2 = repeat, 3 = reserved
  InterpolationMode UB[2]     // 0 = normal RGB, 1 = linear RGB, 2/3 = reserved
  NumGradients UB[4]          // 1..8 for DefineShape/2/3, 1..15 for DefineShape4 (SWF 8+)
  GradientRecords GRADRECORD[NumGradients]
GRADRECORD:
  Ratio UI8                   // 0..255, ascending in the file
  Color RGB (Shape1 or Shape2) | RGBA (Shape3 or Shape4)
FOCALGRADIENT = GRADIENT + FocalPoint FIXED8      // DefineShape4 only; value range -1.0 .. 1.0
```

- **IMPL-060-R013** The three header fields are **one byte for every shape version**: the chapter's
  `SpreadMode`/`InterpolationMode`/`NumGradients` bit list is exactly the byte an SWF 8+ writer emits,
  and for `DefineShape`/`2`/`3` the same byte must carry `SpreadMode = 0`, `InterpolationMode = 0` and
  `NumGradients ≤ 8`. Our reader therefore reads `UB[2] spread`, `UB[2] interpolation`, `UB[4] count`
  in all versions, validates the legacy constraints, and **does not** re-interpret the high nibble as
  padding in old files (the count is the low nibble, and the whole byte is consumed either way).
  Violations are `SF0192` (warning) and the values are honoured — real SWF 6/7 content does set them.
- **IMPL-060-R014** The gradient square is centred at `(0,0)` and extends to `(±16384, ±16384)`;
  `GradientMatrix` maps it into shape space and is stored **verbatim** (no normalisation, no inversion).
  The chapter's worked example is a good sanity check for the transform code: a linear gradient mapped
  onto a 4096-unit circle centred at `(2048,2048)` needs `scale = 32768/4096 = 0.125` and
  `translate = (2048, 2048)`.
- **IMPL-060-R015** Ratio semantics: for a **linear** gradient `0` maps to the left side and `255` to
  the right side of the gradient square; for a **radial** gradient `0` maps to the centre and `255` to
  the largest circle inscribed in the square. `Ratio` is a position, not a distance: the sampler's `t`
  is `ratio/255` (GFX-R042) and the Renderer MUST NOT rescale it against the shape's bounds.
- **IMPL-060-R016** Colour: RGB in `DefineShape`/`DefineShape2`, RGBA in `DefineShape3`/`4` —
  `GRADRECORD`'s colour width follows the **tag** version (R003's rule), and alpha `0` = fully
  transparent / `255` = fully opaque. A gradient with an alpha ramp is a first-class fill (the
  "diamond shows through" case in the chapter) and MUST survive into KTX2/atlas sampling unchanged.
- **IMPL-060-R017** Control-point count: **1–8** in `DefineShape`/`2`/`3`, **1–15** in SWF 8+
  (`NumGradients` is 4 bits, so 15 is the hard ceiling). `NumGradients == 0` is malformed:
  `SF0193` (error) and the fill is dropped (transparent), but the record stream stays aligned because
  zero records follow.
- **IMPL-060-R018** Control points are **sorted by ratio ascending, smallest first** (chapter). The
  decoder MUST validate this (`SF0194`, warning on out-of-order or duplicate ratios) and MUST normalise
  **only** in the IR — a stable sort with duplicates kept at their declared order — while the raw list
  is retained for `inspect --shapes`. Dropping duplicates at decode time would change the ramp.
- **IMPL-060-R019** `InterpolationMode`: `0` = normal RGB, `1` = linear RGB, `2`/`3` reserved. The mode
  MUST be preserved into the IR and the manifest (`interpolation: 'rgb' | 'linearRgb'`); if the renderer
  cannot honour `linearRgb` we decline it *once*, in the report (GFX-R086), never silently as `rgb`.
- **IMPL-060-R020** `SpreadMode` maps 1:1 to the sampler's spread function (GFX-R047):
  `0 = pad`, `1 = reflect`, `2 = repeat`; the reserved value `3` is `SF0192` and behaves as `pad`.
  Spread applies to `t` **after** the matrix transform and before ramp lookup.
- **IMPL-060-R021** `FOCALGRADIENT` is `GRADIENT` plus `FocalPoint FIXED8` (16-bit 8.8; `1.0 = 0x0100`,
  `0.0 = 0x0000`, `-1.0 = 0xFF00`), documented as `DefineShape4`-only. We decode it in older tags too
  and report `SF0195` (info), because the value is unambiguous and observed content uses it; the focal
  point feeds the two-circle focal sampler (`F = focal × 16384`, GFX-R041/R044) and is clamped there.
  A focal point of exactly `±1.0` is the degenerate case the renderer must handle (GFX-R045).
- **IMPL-060-R022** The same `GRADIENT` structure is reached through `FILLSTYLE` **and** through
  `LINESTYLE2.HasFillFlag = 1`; both paths MUST produce the same IR (`GradientSpec`) so the renderer has
  one gradient implementation.

### 4.4 `LINESTYLE` and `LINESTYLE2`

`LINESTYLE` (all shape versions before `DefineShape4`): `Width UI16` (twips) followed by the tag's
colour type. It has **no** cap/join/miter fields: pre-SWF 8 lines are round-join/round-cap by
definition, and dashed/dotted strokes are not expressible in the file format at all (they are
authoring-tool constructions or separate art).

`LINESTYLE2` (`DefineShape4` only), field order and traps:

```
LINESTYLE2:
  Width UI16                     // 0 = hairline: 1 px regardless of transform
  StartCapStyle UB[2]            // 0 = round, 1 = none, 2 = square
  JoinStyle UB[2]                // 0 = round, 1 = bevel, 2 = miter
  HasFillFlag UB[1]              // 1 = the style carries a FILLSTYLE instead of a colour
  NoHScaleFlag UB[1]
  NoVScaleFlag UB[1]
  PixelHintingFlag UB[1]
  Reserved UB[5]                 // must be 0
  NoClose UB[1]                  // 1 = the stroke never closes a subpath
  EndCapStyle UB[2]              // as StartCapStyle, but for the far end
  if JoinStyle == 2: MiterLimitFactor UI16     // 8.8 fixed point
  if HasFillFlag: FILLSTYLE else: colour       // colour = tag's colour type
```

- **IMPL-060-R046** The bit fields are read **in the order listed, MSB-first within the byte**
  (Ch.1 §2.1). Reordering `Width` and the cap byte, or reading the caps before `JoinStyle`, is the
  single most common `LINESTYLE2` bug; `T-MOD-112` pins the byte-level layout.
- **IMPL-060-R047** Caps: `0` = round, `1` = none (butt), `2` = square. **Joins: `0` = round,
  `1` = bevel, `2` = miter** — note that the join numbering is *not* the same as the cap numbering's
  "1 = none" convention, and a file with `JoinStyle == 2` is the only case carrying the miter factor
  (absent otherwise; do not read a zero).
- **IMPL-060-R048** `MiterLimitFactor` is 8.8 fixed point; the **maximum miter length is
  `MiterLimitFactor × Width`**, beyond which the join is cut off (beveled). We model this exactly
  (GFX-R073): no hidden default, no `10.0`-only approximation. The chapter gives `Width = 0` no
  special case; treating it as a one-device-pixel hairline is *our* renderer decision (GFX-R074),
  recorded here so it is not mistaken for spec text.
- **IMPL-060-R049** `HasFillFlag = 1` means a `FILLSTYLE` follows (a gradient-tinted stroke); the
  stroke's geometry is unaffected, but the renderer must switch to a shaded stroke shader.
- **IMPL-060-R050** `NoHScaleFlag`/`NoVScaleFlag`/`PixelHintingFlag` MUST be preserved into the IR and
  forwarded to the renderer's stroke pipeline; an unsupported combination is a renderer *decline*
  (reported, GFX-§7), never silently dropped. `NoClose = 1` MUST be honoured when chaining: if the
  stroke's last point matches its first, the player **applies caps instead of a join** and does not
  close the stroke, even when the fill path is closed (`T-MOD-112`).

## 5. `SHAPE` and `SHAPEWITHSTYLE`

```
SHAPE:                                  SHAPEWITHSTYLE:
  NumFillBits UB[4]                       FillStyles  FILLSTYLEARRAY
  NumLineBits UB[4]                       LineStyles  LINESTYLEARRAY (LINESTYLE2 in v4)
  SHAPERECORD[]                           NumFillBits UB[4]
                                          NumLineBits UB[4]
                                          SHAPERECORD[]
```

- **IMPL-060-R051** `SHAPE` (no style arrays) is used **only for font glyphs**; doc 080 owns that
  path and MUST reuse this decoder by passing a synthetic empty style set (index 0 for every style).
  Duplicating the record decoder inside doc 080 is forbidden.
- **IMPL-060-R052** `NumFillBits`/`NumLineBits` are the widths of the style *indices* in the following
  records (design §5.3). They MUST be ≤ 16; a larger value is `SF0182` (error). The record array is a
  **continuous bit stream**: nothing aligns between records, and one record routinely spans several
  bytes. Appendix A's worked example proves it field by field (`T-MOD-123`): from body bit 144 the
  `StyleChange` (6 bits), its move delta (5 + 14 + 14), the line-style index (1 bit) and all four
  straight edges (21 bits each) run unbroken to the `End` record, ending at body bit 274; only the
  shape's **final** byte is completed, with six zero padding bits. `§11 #2` is closed by this.

### 5.1 The four record kinds

| Kind | Flags | Payload |
| --- | --- | --- |
| `End` | `TypeFlag 0` + all five state flags 0 | — (terminates the shape) |
| `StyleChange` | `TypeFlag 0` + one or more of `StateNewStyles`/`StateLineStyle`/`StateFillStyle1`/`StateFillStyle0`/`StateMoveTo` | moves, indices, optionally new arrays |
| `StraightEdge` | `TypeFlag 1`, `StraightFlag 1` | `NumBits = UB[4] + 2`; 1 or 2 signed deltas |
| `CurvedEdge` | `TypeFlag 1`, `StraightFlag 0` | `NumBits = UB[4] + 2`; 4 signed deltas → quadratic |

- **IMPL-060-R023** The `TypeFlag`/`StraightFlag` values are `UB[1]`; the five state flags are `UB[1]`
  each and are read **only when `TypeFlag == 0`**. A record that sets any state flag but no move/index
  and is not `End` is degenerate (`SF0184`, warning) and MUST be tolerated.
- **IMPL-060-R024** `StyleChange` state (bit order `StateNewStyles`, `StateLineStyle`,
  `StateFillStyle1`, `StateFillStyle0`, `StateMoveTo`):
  `StateMoveTo` → `MoveBits UB[5]` followed by `MoveDeltaX`/`MoveDeltaY` as `SB[MoveBits]` twips
  **relative to the shape origin** (note the *different* width rule: `MoveBits`, not `NumBits + 2`);
  `StateFillStyle0` → `FillStyle0 UB[NumFillBits]`; `StateFillStyle1` → `FillStyle1 UB[NumFillBits]`;
  `StateLineStyle` → `LineStyle UB[NumLineBits]`. When `StateNewStyles` is set (chapter: "used by
  `DefineShape2` and `DefineShape3` only"; tolerated in Shape4 with `SF0191`, reported in v1 with
  `SF0184`), the record **first** carries its own `FillStyle0`/`FillStyle1`/`LineStyle` values if those
  state bits are also set, **then** the new `FillStyles`/`LineStyles` arrays and the new
  `NumFillBits`/`NumLineBits`. The new arrays become active from that record onward; the stable VectorShape IR
  retains earlier entries for already-flushed runs and appends the new entries. Non-zero local indices
  are rebased by the previous style count, while zero remains the no-style sentinel; pinned by
  `T-MOD-114` and `T-SWF-006`.
- **IMPL-060-R025** **All initial style indices are 0** (no fill, no stroke) — the chapter states this
  explicitly. A shape whose first edge arrives before any `StyleChange` therefore draws nothing;
  emitting it anyway (e.g. with a default black fill) is a defect.
- **IMPL-060-R026** Straight edges: `GeneralLineFlag = 0` + `VertLineFlag = 0/1` means a horizontal or
  vertical line whose single delta is signed (`SB[NumBits+2]`); `GeneralLineFlag = 1` carries both
  deltas in x-then-y order. The `NumBits` field is **4 bits**, and the delta width is `NumBits + 2`.
- **IMPL-060-R027** Curved edges: **all four** deltas (`ControlDeltaX`, `ControlDeltaY`,
  `AnchorDeltaX`, `AnchorDeltaY`, in that order) are `SB[NumBits+2]` — the same width as straight
  deltas. The *control point* is relative to the current pen position and the *anchor* is relative to
  the control point (each accumulates). Any decoder-family rule that narrows the anchor to
  `NumBits − 2` is a deviation and MUST be re-derived before use (§11 #3; `T-MOD-115`).
- **IMPL-060-R028** Curved edges are **quadratic** Béziers (one control point); SF2 cubics only exist
  in the IR when a converter introduces them. Conversions use the chapter-endorsed rules
  (`@swf-forge/geometry`): a quadratic maps to a cubic with control points at
  `P0 + 2/3·(C − P0)` and `P2 + 2/3·(C − P2)` (**the 1/3 rule**, exact), and cubic → quadratic uses
  recursive subdivision to the renderer's tolerance (lossy, tolerance ladder fixed in GFX-R075).
- **IMPL-060-R029** A shape MAY contain multiple move-tos with no intervening edges (empty subpaths);
  they MUST be dropped with an info diagnostic (`SF0185`) and MUST NOT create zero-area paths.

**Worked example (Appendix A).** The appendix's 79-byte file contains exactly one shape: `ShapeId` 1;
bounds `Nbits` 14 = 2010/4910/1670/4010 twips; `FillStyleCount` 0; `LineStyleCount` 1 (width 20 twips,
RGB black); `NumFillBits` 0 / `NumLineBits` 1; one `StyleChange` (`StateLineStyle | StateMoveTo`,
`MoveBits` 14, Δ(4900, 1680) twips, line style 1); four straight edges with a 4-bit `NumBits` field of
11 (13-bit deltas: +2320 vertical, −2880 horizontal, −2320 vertical, +2880 horizontal); the six-bit
`End` record; six padding bits — 35 body bytes exactly, with a **long** tag header (6-bit length field
`0x3F`). `T-MOD-123` asserts every value and the byte-for-byte round trip. Appendix A's printed *tables*
carry typesetting defects (errata `E-025`): its bytes are authoritative, its table prose is not.

## 6. Fills, winding, and path building

### 6.1 `FillStyle0` / `FillStyle1` semantics

- **IMPL-060-R030** `FillStyle0` is the fill on the **left** of the directed vector; `FillStyle1` is
  the fill on the **right**. A closed figure filled with one style sets the style on one side of every
  edge; a shape with a hole uses the other side for the hole's style, or the even-odd rule within one
  style layer. The chaining algorithm MUST be implemented from this rule (design §5.4): edges are
  accumulated per style, oriented, and joined at shared endpoints.
- **IMPL-060-R031** Figures MUST be **explicitly closed**: the chapter's example closes the path by
  returning to the start point, and there is no "auto-close" flag for fills (the authoring tool writes
  the closing edge). When a style's edge run is not closed, the IR records `closed: false` *and*
  builds the fill as an implicit close — but the report marks the shape (`SF0186`, warning) because
  the rendering of the stroke (caps, miter) differs, and the file is technically malformed.
- **IMPL-060-R032** A shared edge between two styles (the donut case) MUST NOT duplicate geometry: the
  IR stores one `Edge` list and per-style path references (design §5.4). This is what keeps the
  draw-call budget (GFX-R030) reachable on decorative art.
- **IMPL-060-R033** `evenOdd` vs `nonZero`: the chapter's fill rules are per-shape and the switch is
  `DefineShape4.UsesFillWindingRule` — **1 = non-zero, 0 = even-odd** for that shape. The IR MUST
  record the rule per path, defaulting to `evenOdd` for `DefineShape`/`2`/`3`, and the tessellator
  MUST honour it. (The v1.0 text claimed "even-odd always"; that is true for the older tags and false
  for v4. Pinned by `T-MOD-111`; design `GFX-R024` untouched, it already specifies the rule per path.)

### 6.2 Geometry pipeline order

**IMPL-060-R034** The pipeline order is fixed and golden-visible:
decode → edge reconstruction (absolute pen positions, integer twips) → style chaining (per-style
oriented runs) → IR (floats in px) → quantise (1/20 px at smoothing 0, 0.05 px above) → simplify
(4 steps, fixed order) → flatten.

- **IMPL-060-R035** Quantisation applies to the **input** of simplification so the result stays
  grid-aligned and deterministic (`T-MOD-107`; the v1.0 reference to `T-MOD-201` was a typo).
- **IMPL-060-R036** Simplification MUST be deterministic (no RNG, no time, no iteration-order
  dependence) and MUST run in this order: (1) drop zero-length segments, (2) merge collinear lines,
  (3) drop curves whose chord deviation is sub-pixel at the renderer tolerance, (4) drop paths that
  degenerate below one device pixel of area. The order is part of the contract.
- **IMPL-060-R037** All coordinates MUST be computed in **integer twips** until the IR conversion;
  accumulating deltas in floats produces drift that differs between engines (REPO-R015).

## 7. IR

```ts
export interface VectorShape {
  readonly id: number;                        // character id
  readonly version: 1 | 2 | 3 | 4;            // source tag version
  readonly bounds: Rect;                      // from the tag (strokes included), twips -> px
  readonly edgeBounds: Rect | null;           // DefineShape4 only (strokes excluded)
  readonly recomputedBounds: Rect | null;     // from edges; null if it disagrees (SF0187)
  readonly fillRule: 'evenOdd' | 'nonZero';
  readonly nonScalingStrokes: boolean;
  readonly scalingStrokes: boolean;
  readonly styles: {
    readonly fills: readonly (FillStyle | null)[];   // 1-based; [0] === null
    readonly lines: readonly (LineStyle | null)[];   // 1-based; [0] === null
  };
  readonly paths: readonly FillPath[];
  readonly edges: readonly Edge[];            // shared, referenced by paths
  readonly strokes: readonly StrokePath[];
}

export interface FillPath {
  readonly styleId: number;                   // 1-based index into styles.fills
  readonly edgeRefs: readonly number[];       // into edges, in winding order
  readonly closed: boolean;                   // explicit close present in the file
  readonly implicitClose: boolean;            // we closed it for filling (SF0186)
}
```

- **IMPL-060-R038** `VectorShape` MUST serialise as plain data (no typed arrays, no class instances)
  in a canonical key order, so goldens are diffable and byte-stable across platforms.
- **IMPL-060-R039** `Edge` stores absolute endpoints and, for curves, the quadratic control point —
  deltas MUST NOT survive into the IR. A decoder bug and a renderer bug are then distinguishable in
  the goldens.
- **IMPL-060-R040** Unused styles (declared, never referenced) MUST be retained and reported
  (`SF0189`, info): the report's style table is used by the asset optimiser and by artists debugging
  exports.

## 8. Diagnostics

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0180` | error | unknown `FillStyleType` (shape quarantined) |
| `SF0181` | error | style index beyond the array (clamped to 0) |
| `SF0182` | error | `NumFillBits`/`NumLineBits` > 16 |
| `SF0183` | info | tag newer than the declared SWF version (tolerated) |
| `SF0184` | warning | degenerate `StyleChange` (no move, no index, not `End`) |
| `SF0185` | info | empty subpath (move-to with no edges) dropped |
| `SF0186` | warning | style run not explicitly closed; implicit close applied |
| `SF0187` | warning | declared bounds disagree with recomputed bounds beyond 1 % |
| `SF0188` | info | reserved `DefineShape4` flag bits non-zero (preserved) |
| `SF0189` | info | unused style / practical edge-count ceiling exceeded (> 65535 edges in v1/v2) |
| `SF0190` | warning | style array at the extended-count ceiling with duplicates (dedupe deferred) |
| `SF0191` | info | chapter-reserved feature used by a later shape version (`0xFF` counts or `StateNewStyles` in `DefineShape4`) |
| `SF0192` | warning | gradient modes invalid for the tag version or reserved (`SpreadMode = 3`, `InterpolationMode ≥ 2`, or non-zero modes in Shape1/2/3); value honoured |
| `SF0193` | error | `NumGradients == 0` (empty ramp; fill dropped, stream stays aligned) |
| `SF0194` | warning | gradient control points out of ratio order or duplicated (normalised in the IR only) |
| `SF0195` | info | `FOCALGRADIENT` used outside `DefineShape4` (tolerated; focal sampler still applies) |

**IMPL-060-R041** `SF0190` is the **dedupe ceiling**: when a style array has ≥ 250 entries *and*
byte-identical styles, we keep the array verbatim (indices must not shift) and report; a later,
opt-in dedupe pass (WP-060-13) may rewrite indices only when the whole shape is reprocessed as a unit.

## 9. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| `T-MOD-101` | edge decoder: all four quadrants × both edge kinds, hand-computed bytes | F1 |
| `T-MOD-102` | straight-edge `GeneralLineFlag`/`VertLineFlag` combinations incl. zero-length moves | F1 |
| `T-MOD-103` | fill0/fill1 chaining: rectangle, donut (hole), self-intersection | F1 |
| `T-MOD-104` | bitmap fill matrix: repeating vs clipped on the same shape; all four bitmap types | F1 |
| `T-MOD-105` | gradients: stop ordering, duplicates, focal clamp, linear-RGB flag preserved | F1 |
| `T-MOD-106` | `StateNewStyles` mid-stream re-scoping (fixture with two style sets) | F1 |
| `T-MOD-107` | quantisation + simplification determinism over 10⁴ random shapes; fixed 4-step order | F1 |
| `T-MOD-108` | IR stability: shape → IR byte-identical across runs, platforms and engines | F1 |
| `T-MOD-109` | open path with fill closes; stroke keeps open semantics; `NoClose` honoured | F2 |
| `T-MOD-110` | integration: 200-shape corpus decodes without `SF0180`, bounds agree within 1 % | F2 |
| `T-MOD-111` | fill rule: `UsesFillWindingRule` 1/0 selects non-zero/even-odd on the same geometry | F1 |
| `T-MOD-112` | `LINESTYLE2` byte layout + miter cut-off (`MiterLimitFactor × Width`) + `NoClose` | F1 |
| `T-MOD-113` | `0xFF` extended counts: present in Shape2/3/4, literal 255 in v1 (both directions) | F1 |
| `T-MOD-114` | `StateNewStyles` record carries its own indices before the arrays; indices re-based | F1 |
| `T-MOD-115` | curved edge: all four deltas at `NumBits + 2`; boundary `NumBits == 0` | F1 |
| `T-MOD-116` | caps × joins matrix (3×3) incl. miter factor absent for non-miter joins | F1 |
| `T-MOD-117` | `SHAPE` (font glyph) path reuses the record decoder with an empty style set | F2 |
| `T-MOD-118` | `DefineShape4` edge bounds vs shape bounds on a stroked fixture; recompute cross-check | F2 |
| `T-MOD-119` | gradient header byte: spread/interp/count decode in all four shape versions; legacy non-zero modes reported (`SF0192`) but honoured | F1 |
| `T-MOD-120` | control points: 8 vs 15 ceilings, `NumGradients == 0`, ratio sorting and duplicate retention, RGB vs RGBA by tag | F1 |
| `T-MOD-121` | focal gradient: `FIXED8` decode (`0xFF00`/`0x0000`/`0x0100`), Shape4-only rule (`SF0195`), clamp at the sampler | F1 |
| `T-MOD-122` | spread ×3 (pad/reflect/repeat) and interpolation ×2 reach the renderer config and the manifest | F2 |
| `T-MOD-123` | Appendix A shape walk, asserted at bit level: `FillStyleCount` 0 / `LineStyleCount` 1 (20-twip black line), `NumFillBits` 0 / `NumLineBits` 1, style-change flags `0 1 0 0 1` with `MoveBits` 14 and Δ(4900, 1680), the four 13-bit straight edges, the `End` record, and the six padding bits with **no** byte alignment between records (`T-TST-102`) | F1 |
| `T-MOD-124` | Production `buildMovieModel` exposes VectorShape + decoded bounds for DefineShape/2/3/4 without a raw-tag reparse | F1 |
| `T-MOD-125` | `inspect --shapes` reports the model's stable static-shape summary and geometry digest only when requested | F1 |
| `T-MOD-126` | Shape4 reserved flags preserve the raw byte and emit one `SF0188` per file; pre-SWF-8 use reports `SF0183` | F1 |
| `T-MOD-127` | `SF0190` fires at the style-array ceiling only for byte-identical fill/line duplicates; distinct styles remain quiet | F1 |

## 10. Work packages

| WP | Title | Depends | Est | Deliverable | Phase owner |
| --- | --- | --- | --- | --- | --- |
| WP-060-01 | `DefineShape*` headers + bounds + version dispatch | WP-010-09, WP-020-05 | 2 | `define-shape.ts`, T-MOD-118/126 | P3 |
| WP-060-02 | Style arrays incl. extended counts + 1-based model | WP-060-01 | 3 | `style-arrays.ts`, T-MOD-113 | P3 |
| WP-060-03 | Fill styles (8 kinds) + bitmap fills + matrices | WP-060-02, WP-070-01 | 3 | `fill-style.ts`, T-MOD-104 | P3 |
| WP-060-04 | Gradient structures (Ch.7): flags byte, records, limits, matrix | WP-060-03 | 4 | `gradient.ts`, T-MOD-105/119/120/121 | P3 |
| WP-060-05 | `LINESTYLE`/`LINESTYLE2`: bits, caps, joins, miter model | WP-060-02 | 3 | `line-style.ts`, T-MOD-112/116 | P3 |
| WP-060-06 | Shape record state machine (4 kinds, bit widths) | WP-060-02 | 5 | `shaperecord.ts`, T-MOD-101/102/115 | P3 |
| WP-060-07 | Edge maths: absolute pen, quadratics, quadrant tables | WP-060-06 | 3 | `edge-math.ts` | P3 |
| WP-060-08 | Path building: fill0/fill1 chaining, rewinds, `NoClose` | WP-060-07 | 5 | `path-build.ts`, T-MOD-103/109 | P3 |
| WP-060-09 | Vector IR + quantisation + simplification | WP-060-08 | 4 | `vector-ir.ts`, `simplify.ts`, T-MOD-107/108 | P3 |
| WP-060-10 | Bounds cross-check + reporting | WP-060-09 | 1 | `bounds.ts`, T-MOD-110 | P3 |
| WP-060-11 | Shape corpus harness + IR goldens + import lint | WP-060-09 | 3 | CI corpus, `inspect --shapes` | P3 |
| WP-060-12 | Fill-rule plumbing: `UsesFillWindingRule` → IR → tessellator | WP-060-09, WP-130-04 | 2 | `winding.ts`, T-MOD-111 | P4 |
| WP-060-13 | Style-array ceiling + opt-in dedupe pass (`SF0190`) | WP-060-02 | 2 | dedupe pass + report, T-MOD-127 | P3 |
| WP-060-14 | Spread/interpolation/focal plumbing (IR → manifest → sampler) | WP-060-04, WP-130-04 | 2 | `GradientSpec` handoff, T-MOD-122 | P4 |
| | **Total** | | **42** | | |

## 11. Open items

| # | Item | Impact |
| --- | --- | --- |
| 1 | Unknown `FillStyleType` payload: whether an unknown bitmap-like type can be length-determined without the type table (we quarantine; oracle would let us skip) | low |
| 2 | Whether each `SHAPERECORD` is byte-aligned | **resolved (v1.3)** — no: Appendix A's worked example (130 record bits, one padding run) is only reproducible as a continuous bit stream; the `End` record is followed by zero bits to complete the body byte. Design assumption reversed in `R022`, guarded by `T-MOD-123` |
| 3 | The curved-edge `NumBits − 2` aggressive-anchor encoding used by some decoders: confirm the exact bit-width rule against synthetic files before adopting as an *extension* (spec says `NumBits + 2` for all four deltas) | medium |
| 4 | Legacy non-zero `SpreadMode`/`InterpolationMode` in Shape1/2/3 content: how common, and whether any player ignores them (we honour them, `SF0192`) | medium |
| 5 | `FocalPoint` values outside `±1.0` in the wild (the raw 8.8 range is ±128): clamp policy and report threshold (GFX-R041) | low |
| 6 | Whether `NumGradients == 0` appears in real files (we drop the fill and stay aligned) | low |
| 7 | `DefineShape4`'s `UsesNonScalingStrokes`/`UsesScalingStrokes` renderer pipeline (GFX-§7 decline policy) — which combinations we support | medium (WP-060-12) |
| 8 | `DefineShape4` + the `0xFF` extended count / `StateNewStyles`: the chapter restricts both to Shape2/Shape3; we accept them in Shape4 as an extension — confirm against oracle content | medium (`SF0191`) |
| 9 | Exact semantics of `PixelHintingFlag` on non-integer transforms | low |
| 10 | Whether the practical edge ceiling (`SF0189`) ever fires in the wild at 65535 | low (report-only) |

The v1.0 open items (style-array layouts, `SHAPERECORD` bit layouts, `DefineShape4` extras, the
even-odd question, `NumEdges`) are **settled** — see §4, §5 and APP-§10.4. Note that **`NumEdges` is
not a Chapter 6 field**: the shape tags carry no edge count (the v1.0 open item #8 conflated it with
the `EndOfShape` terminator, which is the 6-zero-bit record). A decoder MUST discover the end of the
record list from the `End` record, and the "more than 65535 edges" ceiling in `SF0189` is our own
practical guard, not a file field.

## 12. Done criteria

1. All four shape versions decode; the corpus runs clean; every style index is validated.
2. Vector IR is the sole geometry type in the renderer (import-boundary lint green).
3. Determinism: IR identical across runs, platforms, and JS engines (Node 18/20 + one browser engine).
4. Bounds agreement within 1 % on the corpus; every disagreement reported.
5. Bitmap-fill matrix rule pinned by `T-MOD-104`; fill rule pinned by `T-MOD-111`; miter model pinned
   by `T-MOD-112`; gradient structures pinned by `T-MOD-119`–`T-MOD-121` and plumbed to the sampler by
   `T-MOD-122`.
6. Font glyphs (`SHAPE`) decode through the same record decoder (`T-MOD-117`).

## 13. Integration with the renderer

- **IMPL-060-R042** The renderer consumes `VectorShape` and MUST NOT re-read SWF bytes. Tessellation
  keys must be derived from IR hashes (design GFX-R050), so two shapes with identical geometry share
  a mesh.
- **IMPL-060-R043** Strokes are a separate draw unit from fills; a shape with N fills and M strokes
  produces ≤ N+M geometry groups (GFX-R030's budget is enforced by WP-130-05).
- **IMPL-060-R044** `nonZero` shapes MUST be tessellated with the non-zero rule in the same pass as
  even-odd ones (the rule is a per-path parameter, not a separate pipeline) — GFX-R024's wording is
  the contract.
- **IMPL-060-R045** Non-scaling strokes change the flattening tolerance selection but never the IR;
  the renderer picks the tolerance at draw time (`[verify]` §11 #5).

## 14. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Scoped from Ch.6/Ch.7 structure; record layouts and fill/winding rules marked pending |
| 1.1 | 2026-10-04 | Ch.6-grounded: tag/version table with per-tag colour types; `FILLSTYLEARRAY`/`LINESTYLEARRAY` extended counts (Shape2+ only) and the 1-based/reserved-index-0 model; all eight `FillStyleType` values with the four bitmap modes; `BitmapMatrix` maps bitmap→shape space (corrects v1.0's "unit gradient space" wording); `LINESTYLE2` exact field order, caps/joins (0/1/2), miter = `MiterLimitFactor × Width`, `NoClose`; `SHAPE` vs `SHAPEWITHSTYLE`; the four `SHAPERECORD` kinds with `NumBits+2` for **all** curved deltas (reclassifies the `NumBits−2` family belief as an extension, not spec); `StyleChange`/`StateNewStyles` ordering; all initial indices 0; `FillStyle0` left / `FillStyle1` right and explicit closure; `DefineShape4` `EdgeBounds` (strokes excluded) + winding/non-scaling flags → IR; `NumEdges` removed as a non-field; `StateChange` `MoveBits`/`SB[MoveBits]` (not `NumBits+2`) and `NoClose` = caps-instead-of-join corrected from the chapter text; `SF0190` dedupe ceiling and `SF0191` reserved-feature use; tests `T-MOD-111`–`118`; WPs 01–13 = 39 d |
| 1.2 | 2026-10-04 | Ch.7-grounded: §4.3 rewritten with the `GRADIENT`/`FOCALGRADIENT`/`GRADRECORD` structures, the shared spread/interpolation/count byte (read identically in all versions, legacy constraints validated), the 8-vs-15 control-point ceilings, ratio semantics and the chapter's matrix example, `FIXED8` focal point, ordering/duplicate policy, spread ↔ `pad\|reflect\|repeat` and interpolation ↔ `rgb\|linearRgb` plumbing; diagnostics `SF0192`–`SF0195`; tests `T-MOD-119`–`122`; WP-060-04 raised to 4 d and WP-060-14 added (42 d total) |
| 1.3 | 2026-10-04 | Appendix and tech-spec pass: `T-MOD-123` pins the Appendix A shape bit walk; duplicate rule ids in the line-style/shape sections are renumbered to `R046`–`R052` (no outside citations existed) |
| 1.4 | 2026-10-05 | Production `StateNewStyles` now byte-aligns before style arrays and rebases non-zero local fill/line indices into stable IR tables; adds straight/curved bit-width vectors, bitmap-style rebasing, production preview and inspect coverage (`T-MOD-124/125`) |
| 1.5 | 2026-10-05 | Repeat conformance pass: add executable `T-MOD-116/118/123/126/127` fixtures, extend `T-MOD-113` to Shape2/3/4, and correct the shape-regression citations to match the test registry |
