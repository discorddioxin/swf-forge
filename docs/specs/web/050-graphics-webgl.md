# GFX — Flash Graphics → WebGL2 Rendering Subsystem

**Doc ID:** GFX · **Status:** Draft 1.2 · **Normative:** yes
**Depends on:** SWF (parsing), CMP (pipeline), AST (fonts/bitmaps), AVM1 (display list semantics)

---

## 1. Scope and goals

This document specifies how vector art, bitmaps, gradients, text, masks, filters, and blend modes
authored in Flash are rendered with WebGL2 in a way that is (a) visually faithful, (b) fast enough
for real games, and (c) deterministic enough to test.

**Goals**

- **GFX-G1 — Flash-like output.** Fill rules, stroke joins, gradient geometry, text positioning,
  and colour handling must reproduce Flash's *geometry*, not merely "a similar look".
- **GFX-G2 — Bounded per-frame cost.** Draw calls, state changes, uploads, and CPU tessellation are
  budgeted and gated in CI (GFX-§16).
- **GFX-G3 — Work moves to build time.** Anything that can be precomputed is (tessellated static
  shapes, gradient ramps, font atlases, mip chains, sprite rects, morph deltas).
- **GFX-G4 — Composable.** The renderer is usable without the AVM1 runtime (it consumes plain data),
  so it is testable and reusable (REPO-R006).
- **GFX-G5 — Honest fidelity.** Where Flash's exact rasterisation is unreproducible or unverifiable,
  the divergence is declared, bounded, and measured (GFX-§13, Decision register).

**Non-goals**

- Canvas2D or SVG rendering backends (a `GfxDevice` seam exists so they *could* be added; v1 ships
  WebGL2 only).
- 3D APIs (`Stage` has no camera), Stage3D/`Context3D` (report as unsupported, `SF0207`).
- Reproducing Flash's exact anti-aliasing seam for every pathological self-overlapping shape;
  tolerance is defined in GFX-§13.4.

## 2. Where work happens

| Work | Build time (compiler) | Run time (renderer) |
| --- | --- | --- |
| Shape record decoding | ✅ full Vector IR | — |
| Fill/stroke style normalisation | ✅ | — |
| Gradient ramps → 256×1 RGBA textures; spread/interp modes | ✅ | sample |
| Static text → glyph quads / MSDF atlases | ✅ | sample |
| Bitmaps → KTX2/WebP + mips + sprite rects | ✅ | upload |
| Morph deltas (start→end path interpolation tables) | ✅ | interpolate |
| Tessellation of static shapes | optional (config) | ✅ default (cache on first use) |
| Tessellation of dynamic art (drawing API, morphs, scaling grids) | — | ✅ cached |
| Filter kernels, blur pyramids | kernel tables | ✅ FBO passes |
| Batching plan for static content | optional hints | ✅ per frame |
| Bounds/composite-matrix queries for `_width`/`hitTest` | — | ✅ cached per frame |

**GFX-R001** The renderer MUST produce identical output whether a shape was tessellated at build time
or at first use. Build-time tessellation is an optimisation (startup latency), never a semantic
change.

**GFX-R002** The renderer MUST NOT require the AVM1 runtime: all inputs are `VectorShape`,
`TextureHandle`, `TextLayout`, `FilterSpec`, `BlendMode`, and a display-list snapshot.

## 3. Device layer

### 3.1 Backend requirements

| Feature | Requirement | Fallback |
| --- | --- | --- |
| WebGL2 | Required baseline | If missing: report `SF0201`, show a static poster frame, do not silently fall back to 2D |
| `EXT_color_buffer_float` | Required for filter pipelines (RGBA16F targets) | Use RGBA8 targets + clamping; `risk` diagnostic |
| Compressed textures | ETC2 (core in ES 3.0) mandatory; ASTC/BC via extensions | KTX2 with ETC2 fallback always present (AST-§3.3) |
| `OES_texture_float_linear` | Optional | Nearest/linear manually in shader |
| `EXT_disjoint_timer_query_webgl2` | Optional | CPU-side timing only |
| MSAA | `antialias: true` context attribute, ≥ 4 samples | Analytic AA path (GFX-§5.6) |
| Anisotropy | `EXT_texture_filter_anisotropic` | Trilinear only |

**GFX-R003** The device layer MUST expose a capability record (`GfxCaps`) and the renderer MUST
select shader variants and paths from it once at boot, never per frame.

**GFX-R004** The renderer MUST NOT use WebGL1 or WebGL2 compatibility shims; if `getContext('webgl2')`
returns `null`, boot fails with an actionable message (RT-§4.3).

### 3.2 Surface, DPR, and resolution

**GFX-R005** The drawing buffer MUST be `floor(stageWidthPx × scale × dpr)` where `scale` implements
`Stage.scaleMode` (GFX-§4.4) and `dpr` is `min(devicePixelRatio, config.maxDpr)` (default 2).
`config.maxDpr` exists because the filters and AA quality scale with DPR and a 3× phone at 1080p
stage would otherwise render 9× the pixels of a 1× desktop.

**GFX-R006** The canvas CSS size and the drawing-buffer size MUST be decoupled: CSS size follows the
layout; drawing buffer follows GFX-R005. All input coordinates are converted through the same
`Stage → buffer` matrix used by rendering, so hit testing and rendering can never disagree.

**GFX-R007** `Stage.quality = 'LOW'|'MEDIUM'|'HIGH'|'BEST'` (AS2) and `_quality` (AS1) MUST map to
the renderer's quality modes (GFX-§15.2) without changing geometry, only AA/smoothing/filter effort.

### 3.3 Render passes per frame

```
1. Clear (or begin a full-frame layer target if the root has a non-normal blend/filter)
2. Static batch pass        — opaque content, sorted to minimise state changes where legal
3. Alpha batch pass         — blended content (still order-constrained, see GFX-R030)
4. Group passes             — masks, layer/clip groups, blend groups, filter chains (on demand)
5. Text pass (integrated into 2/3, drawn from atlases)
6. Present / resolve
```

**GFX-R008** The renderer MUST be a *retained-mode display list* renderer: it consumes a display-list
snapshot each frame (CMP-R017 placeholders resolved) and does not re-derive the list from AVM1 state.

**GFX-R009** Occlusion culling is limited to: off-stage rejection, zero-effective-alpha rejection, and
`_visible == false` pruning. No spatial index is required in v1; the display list is walked in order
because **draw order is semantic in Flash** (`swapDepths`, overlap of translucent content).

## 4. Coordinate spaces and units

### 4.1 Spaces

| Space | Unit | Y axis | Notes |
| --- | --- | --- | --- |
| Twips | 1/20 px | down | SWF file encoding |
| Stage | CSS px (float) | down | The AVM1-visible coordinate system; `_x`,`_y`,`_width`,`_height` |
| Local (clip) | px (float) | down | After applying the clip's own matrix; drawing API writes here |
| Shape | px (float) | down | Shape-space geometry, after the shape's own placement matrix |
| Device | physical px | down | Drawing buffer; `pixel = round(stage × scale × dpr + 0.5·…)` |

**GFX-R010** All conversion between spaces MUST go through one `Mat2D` implementation
(`{a,b,c,d,tx,ty}`, row-major concatenation as `M_parent × M_child`), shared with the AVM1 runtime's
`localToGlobal`/`getBounds` (AVM1-R067). Two implementations of matrix math in one codebase is a
guaranteed bug source.

**GFX-R011** Stage coordinates MUST be floats; `_x = 10.5` must not be rounded at the AVM1 boundary.
Rounding, if any, happens only at the final device-pixel step and only under `graphics.settle`
(GFX-§4.3).

### 4.2 Rotation and skew

**GFX-R012** `_rotation` (degrees, clockwise, Y-down) and `_xscale`/`_yscale` (percent) MUST be kept
as a decomposed transform (`TRS + skew`) alongside the matrix, per AVM1-D09. Reading `_rotation` after
setting `_xscale` and vice versa must round-trip through the *stored* TRS values, matching Flash's
behaviour where the matrix is derived, not the source of truth.

### 4.3 Settling (pixel snapping)

Flash snaps many things to integer *twips* (1/20 px) and snaps stroked edges to device pixels when
"pixel hinting" is on.

**GFX-R013** Under `graphics.settle: 'flash'` (default), the renderer MUST:
1. settle clip translation components to 1/20 px (`round(v * 20) / 20`),
2. honour `PixelHinting` line styles and `_quality == 'LOW'` by snapping stroke edges to integer
   device pixels when the accumulated scale is close to 1:1,
3. snap *static text* baselines to integer device pixels when the SWF's font flags mark small text
   (`FontFlagsSmallText`) — this is what makes 10 px Flash text crisp rather than mushy.

**GFX-R014** Under `graphics.settle: 'none'`, no snapping occurs; a `risk` diagnostic records the
deviation from Flash at build time.

### 4.4 Stage scaling and alignment

`Stage.scaleMode` ∈ {`showAll`, `noBorder`, `exactFit`, `noScale`}, `Stage.align` per AS2.

**GFX-R015** The scaling matrix MUST be computed as:

```
showAll:   s = min(vw/sw, vh/sh)
noBorder:  s = max(vw/sw, vh/sh)
exactFit:  sx = vw/sw, sy = vh/sh
noScale:   s = 1
offset    = align-based placement of the scaled stage in the viewport, rounded to device pixels
```

with `sw`,`sh` in CSS px from the SWF's `RECT` (÷20). `Stage.align` values map to fractions
(`T`=top, `B`=bottom, `L`/`R`, empty = centre on that axis). `Stage.onResize` MUST fire after the
viewport or orientation changes and after the new matrix is effective.

**GFX-R016** Because `noScale`/`exactFit` can change the effective pixel aspect, all post-process
passes (filters, blur radii) MUST operate in *device* pixels, and their parameters MUST be scaled by
the current effective scale so that a `blurX = 10` looks the same in `showAll` at 2× upscale as at 1×.

## 5. Vector geometry pipeline

### 5.1 Input: Vector IR

The compiler emits `VectorShape` (CMP-§5.1) with twips coordinates, style runs, fill rule, and
line styles. The renderer's first step is a normalisation pass:

**GFX-R017** Normalisation MUST:

1. convert twips → px (`/20`) exactly once, in a single place, producing float shape space;
2. preserve run structure (which edges share a fill, where fills start/stop);
3. compute per-path flags: `isClosed`, `isDegenerate` (all points collinear or area 0), `hasSelfIntersection`
   (only when needed; this is a per-shape one-time O(n log n) sweep);
4. pre-compute `bounds` and, for strokes, the *stroke-expanded* bounds (needed for `_width`/culling).

**GFX-R018** Paths with a fill MUST be closed for fill purposes even when the SWF record stream never
issued a closing edge (SWF-R027): the fill polygon is `[start … lastPoint → start]`. A path with a
*dangling* shape change (style change while the pen is mid-subpath) starts a new subpath at the
current pen position, not at the origin.

### 5.2 Fill rules

**GFX-R019** The fill rule MUST come from the IR: `nonzero` where `DefineShape4.UsesFillWindingRule`
is set, `evenodd` otherwise (SWF-R026). The tessellator MUST implement both.

**GFX-R020** For *strokes*, no fill rule applies; strokes are expanded to filled geometry (GFX-§5.5).

**GFX-R021** Degenerate subpaths (zero area, single point, coincident points) MUST be dropped for
fills, with no diagnostic (they are extremely common in authored assets and in drawing-API trails).

### 5.3 Fill tessellation

The renderer uses **analytic-coverage tessellation**: instead of leaving anti-aliasing to MSAA alone,
curved and thin geometry is expanded into triangles whose *fragment shader* computes exact coverage
from the original edge equations. This gives Flash-like thin-stroke quality and avoids the
"disappearing hairline at high DPI" problem.

Algorithm (per fill run):

```
1. Decompose quadratic Béziers into 2–6 line segments by a flatness criterion
   (flatness tolerance = 0.1 device px at the *current* scale, clamped to ≤ 8 segments).
2. Close the run (implicit closure, GFX-R018).
3. Triangulate the polygon:
   a. If the run is convex and simple (fast path, ~70% of authored shapes):
      fan triangulation.
   b. Otherwise: monotone-decomposition or ear-clipping with a sweep-line
      fallback for self-intersecting input (payload: 1–3 passes, worst case O(n log n)).
4. Emit vertices with, for each vertex, the *edge equations* of the two incident
   original edges (a, b, c, d = 4 floats) so the fragment shader can compute
   signed distance to each edge.
5. Store in a static VBO with an index buffer; per-shape vertices are shared across
   all instances of that shape.
```

**GFX-R022** The tessellation tolerance MUST be expressed in *device* pixels and therefore depends on
the accumulated scale. Tesselations MUST be cached per quantised scale bucket (GFX-§14.1), not per
float scale, so a tween from 1.0× to 1.01× does not invalidate the cache 60 times a second.

**GFX-R023** For self-intersecting paths, triangulation MUST NOT produce a *visible* artefact beyond
the declared tolerance; where a correct tessellation is impossible within the budget, the shape MUST
be rendered through the supersampled fallback path (GFX-§5.7) with a one-time `info` diagnostic.

**GFX-R024** Fill boundary anti-aliasing MUST use the edge-equation coverage method:

```
coverage = clamp(min over edges of (signed distance to edge) + 0.5, 0, 1)   // in device px
alpha    = coverage × styleAlpha × clipAlpha
```

with distances computed in device space (so AA width is exactly 1 device pixel, matching Flash's
scanline AA at 1× and scaling naturally at DPR > 1).

**GFX-R025** Where two filled subpaths share an edge (very common in Flash art: "two shapes butted
together"), the coverage formulation above still causes a visible 1 px dark/light seam because both
sides anti-alias independently. The renderer MUST mitigate this by drawing adjacent fills from the
same run through a shared *coverage conflation* pass when `graphics.antialias === 'analytic'`
(dilate towards the shared edge by 0.5 px and use `max` coverage blending **within a group**, or
render the group to an offscreen target and composite once). The exact seam behaviour is
oracle-pinned (`T-GFX-005`); a documented tolerance applies (GFX-§13.4).

### 5.4 Drawing-API geometry

**GFX-R026** Drawing-API commands (`beginFill`, `moveTo`, `lineTo`, `curveTo`, `endFill`,
`beginGradientFill`, `beginBitmapFill`, `lineStyle`, `lineGradientStyle`, `clear`) MUST be recorded
into the *same* Vector IR structures the compiler emits for authored shapes, and MUST flow through the
same tessellator. Recorded commands are appended to a per-clip program; the program is compiled to
GPU buffers lazily (on first render after a change) and cached until the next mutating call.

**GFX-R027** Drawing-API fills are `nonzero` (Flash's drawing API does not expose a rule); runs are
closed implicitly at `endFill`, matching the Flash behaviour that an unclosed trail still fills
closed. `[oracle-pinned]` `T-GFX-006`.

**GFX-R028** Tessellation of drawing-API geometry MUST be cached per (program hash, scale bucket).
A clip that redraws every frame (common for debug overlays and radar screens) MUST be bounded:
if a clip's program exceeds `maxDynamicVertices` (default 20 000) it is rendered via the
supersampled fallback (GFX-§5.7) to keep the CPU cost predictable.

### 5.5 Stroke expansion

SWF strokes are centreline geometry with:
- width in twips (0 = hairline),
- start caps: round (0), butt (1), square (2),
- joins: round (0), bevel (1), miter (2) with miter limit (FIXED8, default 3.0),
- flags: `PixelHinting`, `NoHScale`, `NoVScale`, `NoClose`, `NonScalingStroke`,
- optional fill style instead of colour (`LINESTYLE2`).

**GFX-R029** Stroke expansion MUST be performed on the CPU (not via GPU distance fields) so that
joins, miter limits, caps, and *dashes are absent* (SWF has no dashes) behave deterministically.
The algorithm:

```
for each subpath of the run:
  offset the polyline by ±w/2 along per-vertex normals (miter-joined):
     - compute the join at each interior vertex:
         miter: if 1/sin(θ/2) ≤ miterLimit  → miter vertex
                else                        → bevel (two points)
         round: insert an arc fan (segments ∝ radius in device px, capped at maxRoundSegments)
         bevel: two points
  emit start cap and end cap (unless closed or NoClose):
     round: half-disc fan;  square: extend by w/2 along the tangent;  butt: nothing
  emit the resulting outline as a fill polygon (nonzero) into the same VBO layout as fills
```

**GFX-R030** Hairlines (width 0) MUST be rendered as a 1 *device pixel* wide line regardless of
scale (Flash's hairline semantics), implemented as a device-space expansion each frame (cheap: the
geometry is tiny) rather than a cached shape-space expansion.

**GFX-R031** `NonScalingStroke` (Shape4) and `NoHScale`/`NoVScale` (LineStyle2) MUST be implemented by
expanding in *stage* space: the path is transformed first, then offset by a constant width. This is
the difference between "thin line at any zoom" and "line that fattens when zoomed".

**GFX-R032** Round joins/caps MUST be analytic (arc fans) below 8 device px radius and degenerate to
bevels above a configurable segment cap, so that a 400 px thick round-capped line does not emit
thousands of segments.

**GFX-R033** Stroke alpha uses the same coverage formulation as fills; overlapping strokes of the same
style within one run MUST be drawn as a single nonzero fill polygon (self-overlap then does not
double-darken), which matches Flash.

### 5.6 Anti-aliasing strategy

| Mode | When | Quality | Cost |
| --- | --- | --- | --- |
| `analytic` (default) | All vector content | 1 device-px coverage AA; thin strokes stay crisp | ~10–20% over raw fill |
| `msaa4` | When analytic coverage is disabled by config | 4× MSAA | Cheap, but thin geometry aliases |
| `msaa8` | High quality devices | 8× MSAA | Higher bandwidth |
| `supersample2x` | Fallback: pathological shapes, dynamic geometry over budget, filters with `quality: 3` | 2×2 supersample into a target | 4× fill cost, used sparingly |

**GFX-R034** The default configuration MUST be `analytic` + 4× MSAA on the *boundary* triangles only
(the coverage shader handles interiors). This combination is the fidelity/perf sweet spot: MSAA
covers the polygon-boundary case, analytic coverage covers thin/degenerate cases.

**GFX-R035** The renderer MUST NOT enable MSAA context-wide *and* use full-screen supersampling at
the same time (wasted bandwidth).

**GFX-R036** Text MUST be rendered with analytic coverage or MSDF (GFX-§10), never with MSAA alone —
MSAA on textured glyph quads gives the classic mushy-text look.

### 5.7 Supersampled fallback path

For geometry that cannot be tessellated correctly within budget (GFX-R023, GFX-R028) the renderer:

1. allocates (or reuses from a pool) an offscreen target sized to the shape's device bounds × 2,
2. renders the shape again through a simple fan tessellation with coverage, at 2× scale,
3. downsamples with a 4-tap box into the destination with premultiplied alpha.

**GFX-R037** The fallback MUST be invisible in the API (callers do not choose it) and MUST emit a
one-time `info` diagnostic naming the character id, so that porters can fix the asset.

## 6. Colour, gradients, and colour transforms

### 6.1 Solid fills and premultiplied alpha

**GFX-R038** All rendering MUST use **premultiplied alpha** internally (the standard GPU-friendly
model), and every conversion point (texture upload, uniform set, colour transform application) MUST be
explicit about premultiplication. Textures are stored premultiplied (`texStorage2D` + upload with
premultiply in the decode path) so that bilinear filtering of alpha-matted sprites cannot produce the
classic bright/dark halo.

**GFX-R039** The preview canvas (`canvas.getContext('webgl2', { premultipliedAlpha: true })`) MUST be
created with `premultipliedAlpha: true` and `alpha: false` unless the integrator requests a
transparent stage (RT-§8.4), in which case `alpha: true` requires the compositor path.

### 6.2 Colour transforms (CXFORM)

**GFX-R040** A clip's colour transform MUST be applied in the shader, not baked into vertex colours,
so that `_alpha` and `Color.setRGB` are dynamic and free. The shader receives
`mult: vec4`, `add: vec4` (already normalised: `mult/256`, `add/255`) and computes, in
premultiplied space:

```
c' = clamp(c * mult + add * a, 0, 1)
a' = clamp(a * mult.a + add.a, 0, 1)
```

where the `add` term is scaled by the *incoming* alpha (this is what makes Flash's
"additive colour on a transparent sprite" look right instead of glowing outside the sprite).

**GFX-R041** Colour transforms MUST compose multiplicatively down the display list once per frame
(parent × child), computed in 32-bit float with the rounding behaviour of SWF-R021
(`mult/256`, truncating integer path for the AVM1-visible arithmetic).

**GFX-R042** When a colour transform is *static* for a whole batch (identical mult/add across many
quads), it MUST be folded into vertex colours or a per-instance attribute to avoid one uniform set
per draw call.

### 6.3 Gradients

SWF gradients are defined in the **gradient square**: a coordinate space from (−16384,−16384) to
(16384,16384) in shape units (twips), mapped into shape space by the fill's matrix. A stop ratio of
0 maps to the left edge (linear) or the centre (radial); 255 maps to the right edge or the largest
inscribed circle.

**GFX-R043** Linear gradients MUST be implemented as a 256×1 RGBA ramp texture sampled through the
gradient matrix:

```
uv = (inverse(gradientMatrix) × shapePos + 16384) / 32768      // 0..1 across the gradient square
color = texture(rampTexture, vec2(uv.x, 0.5))
```

plus a *coordinate derived* fade at the texture edges for `pad` spread (the ramp is padded with the
edge stops — texel 0 and 255 hold the endpoint colours, no filtering artefacts).

**GFX-R044** The ramp texture MUST be generated at build time (AST-§3.6) with:
- stop interpolation performed in the declared colour space: `interpolationMode = 0` (normal RGB)
  interpolates sRGB-encoded values linearly; `interpolationMode = 1` (linear RGB) converts to linear
  light first (this is a *visible* difference in dark gradients and MUST be implemented),
- alpha interpolated linearly in both modes,
- 256 entries, computed by exact stop-scanning (no resampling), so the ramp is deterministic and
  cacheable by its content hash.

**GFX-R045** Radial gradients MUST be evaluated analytically in the fragment shader (a single texture
cannot represent the non-affine mapping):

```
// gradient space, after inverse matrix: p (in units where the square is ±16384)
t = length(p) / 16384          // centred radial
t = spread(t)                  // pad | repeat | reflect
color = texture(ramp, vec2(clamp(t, 0, 1), 0.5))
```

**GFX-R046** Focal radial gradients (`0x13`) MUST be evaluated with the point-focus formulation.
With gradient space centred at the origin, focus `F = focal × 16384` on the +x axis, and the
gradient's radius `R = 16384`, the parameter `t` for a point `P` solves:

```
u = P − F                       // vector from focus to sample point
v = C − F = −F                  // centre − focus
(|v|² − R²)·t² − 2(u·v)·t + |u|² = 0

disc = (u·v)² − (|v|² − R²)·|u|²

t₊ = ((u·v) + sqrt(disc)) / (|v|² − R²)
t₋ = ((u·v) − sqrt(disc)) / (|v|² − R²)
```

**Root selection (normative):** the gradient parameter is the **smallest non-negative root**; when
both roots are non-negative, take the smaller. Equivalently, select `t₋` when `|v|² − R² < 0`
(focus inside the unit circle, the common case) and `t₊` when `|v|² − R² > 0`, but an implementation
MUST verify the chosen root is non-negative and fall back to the other root, because
`|v|² − R²` changes sign as the focal point crosses the gradient square's inscribed circle at
`|focal| = 1`. Additional rules: when `focal == 0`, use the centred form (GFX-R045); when
`| |v|² − R² | < ε` (parabolic degeneration, `|focal|` near 1) use a linear approximation along `v`;
points with no real root take the *last* stop (matching Flash's observed behaviour) or the spread
mode's corresponding value under `repeat`/`reflect`. Computations MUST use the numerically stable
form `t = |u|² / ((u·v) ∓ sqrt(disc))` (the "citardauq" form) for the large-root cases to avoid
catastrophic cancellation. `[oracle-pinned]` `T-GFX-010`.

**GFX-R047** Spread modes (`pad`, `repeat`, `reflect`) MUST be applied to `t` with exact integer
arithmetic for `repeat`/`reflect` (so a 20× repeated gradient does not accumulate float drift):
`repeat: t = t − floor(t)`, `reflect: t = triangleWave(t)`.

**GFX-R048** Gradient fills MUST support alpha per stop and the style's own `_alpha`; the ramp's
RGBA entries are premultiplied at generation time.

**GFX-R049** Gradient ramps MUST be deduplicated by content hash across the whole movie (a common
Flash pattern is the same gradient reused with different matrices), and count against the texture
budget (GFX-§16).

### 6.4 Bitmap fills

**GFX-R050** `beginBitmapFill` / bitmap fill styles MUST sample the texture through the fill matrix
(including the fill's own scale/rotation/translate and the `clipped` vs `repeating` mode) with
`ClampToEdge` for clipped and `Repeat` for repeating — *except* that Flash clamps, not wraps, for
non-power-of-two textures, so atlases (which are NPOT) MUST be handled by an in-shader
clamp/`fract` on the *atlas sub-rectangle* (AST-§3.4) rather than relying on `Repeat` wrap modes.

**GFX-R051** `smoothing = false` (non-smoothed bitmap fills and 8-bit textures) MUST use nearest
sampling and MUST be resolved at the *tessellation* level for correctness: with mipmaps, "nearest"
still blurs; therefore non-smoothed textures MUST be sampled from a single mip level
(`TEXTURE_MIN_FILTER = NEAREST`) and the geometry must not be minified below 1 texel/px without a
one-time `risk` diagnostic.

**GFX-R052** 8-bit textures (colour-mapped lossless bitmaps) MUST be expanded to RGBA at build time
(AST-§3.2); Flash's palette animation via `Color` on 8-bit bitmaps is rare and handled by the
colour-transform path (GFX-R040), not by palette mutation.

## 7. Batching and draw-call discipline

Flash content has thousands of tiny quads (tiles, particles, text glyphs). Naïve per-object draws
destroy performance. The renderer uses a batcher with a strict ordering rule.

### 7.1 Material keys and legal reordering

**GFX-R053** Two draws may be merged into one `drawElementsInstanced` call only if they share:
program variant, texture (or texture array layer), blend mode and blend group, filter chain (none),
depth relationship (non-overlapping *and* both in the same "order-independent" class), and
colour-transform representation (uniform vs per-instance).

**GFX-R054** Reordering is legal only when it cannot change the result:

| Content class | May be sorted? | Rationale |
| --- | --- | --- |
| Opaque (effective alpha == 1) non-overlapping quads | yes, by material | Order is unobservable |
| Opaque quads *overlapping* | yes, if depth order preserved | Overlap of opaque content is still order-sensitive when shapes have holes and AA edges |
| Any alpha < 1 content | no reordering among themselves | Overlap is a composite |
| `add`/`multiply`/`screen`/… blended content | no reordering | Non-commutative with alpha |
| Masked / grouped content | no reordering with non-group content | Group boundaries are semantic |

**GFX-R055** Therefore the frame is planned as **runs**: maximal sequences of display-list items in
order that map to the same material *and* whose ordering constraints allow merging. The planner walks
the display list once (O(n)) and emits batches. Target: ≤ 700 draw calls for a typical C1 title,
≤ 40 for simple animation titles (GFX-§16).

**GFX-R056** The planner MUST be *deterministic*: identical frames produce identical batch sequences
(T-GFX-020), so that perf tests can assert draw-call counts exactly.

### 7.2 Instance data

```ts
/** Per-instance attributes for one batched quad/triangle-set draw. */
interface Instance {
  /** Affine transform: 2x3 packed as 6 floats (a,b,c,d,tx,ty). */
  transform: Float32Array;      // 6 floats, interleaved in a shared buffer
  /** Premultiplied colour multiplier (baked cxform or tint). */
  tint: Uint32Array;            // RGBA8
  /** Atlas/sprite index (when the batch uses a texture array). */
  layer: Uint16Array;
  /** UV rectangle for quads (sprites, glyphs). */
  texRect: Uint16Array;         // 4 × u16 in texel units
}
```

**GFX-R057** All dynamic instance data MUST live in growable, pre-allocated buffers that are reused
across frames (double-buffered and orphaned with `bufferData(null, DYNAMIC_DRAW)` per frame to avoid
GPU sync stalls). Per-frame allocations MUST be zero after the first 120 frames (T-GFX-021 asserts
zero growth in a steady-state heap profile).

**GFX-R058** Static content (tilesets, HUD plates, background art) MUST be *pre-transformed* into a
cached batch the first time it is drawn and reused verbatim while the display list, transforms, and
colour transforms are unchanged. Cache key: a structural hash of the static subtree plus the
accumulated transform/cxform (GFX-§14.2).

### 7.3 Texture arrays and atlases

**GFX-R059** Quads that share a sampler but differ in texture MUST be batched using **texture arrays**
(`TEXTURE_2D_ARRAY`) rather than re-binding atlases per quad. Slice count is a build-time constant
per atlas group (AST-§3.4); all slices share size/format (they are atlas pages of the same
dimensions).

**GFX-R060** Sprite sheets with non-power-of-two members MUST be padded by at least 2 texels of
edge-bleed (dilation) per sprite; the packer owns this (AST-§3.4). Without it, bilinear + mip
sampling bleeds neighbouring sprites — the single most common "why does my port look dirty" cause.

## 8. Masks, clipping, and 9-slice

### 8.1 `setMask`

**GFX-R061** `MovieClip.setMask(maskClip)` MUST be implemented with the stencil buffer (preferred) or
an offscreen A8 target (fallback):

1. push a stencil state; render the mask clip's *alpha coverage* into the stencil plane
   (thresholded at 0.5 alpha, or with 4 stencil bits for multi-level AA where available),
2. render the masked clip with `STENCIL_TEST` (equal-to-reference),
3. pop.

**GFX-R062** Masking affects *rendering only*: it MUST NOT affect hit testing, `_width`/`_height`,
or `getBounds`, matching Flash ([oracle-pinned] `T-GFX-015`).

**GFX-R063** A mask clip that is currently displaying (has a parent) must also be drawn normally;
Flash's `setMask` does *not* remove the mask from the display list. Similarly, the mask's own
visibility follows Flash's rules (a mask clip that is `_visible = false` still masks, because masks
are evaluated on content, not on visibility) — `[oracle-pinned]` and a classic porting trap
(`GFX-D09`).

### 8.2 `scrollRect` and scroll panes

**GFX-R064** `scrollRect` MUST clip to a rectangle in the clip's local space, implemented as a
scissor where the clip's transform is axis-aligned, and as a stencil rect otherwise (rotated clip).

### 8.3 9-slice (`DefineScalingGrid`)

**GFX-R065** A character with a scaling grid MUST be rendered by splitting its geometry into 9
regions and scaling only the middle regions by the placement scale. Implementation: build three
scaled (non-uniform) instance transforms per axis and emit up to 9 sub-draws from a *single* static
VBO whose index ranges are pre-split at build time (AST-§3.7). This is cheap, exact, and preserves
stroke widths in the unscaled regions.

## 9. Text rendering

### 9.1 Static text (`DefineText`)

**GFX-R066** Static text MUST be converted at build time into glyph quads referencing font atlases,
positioned exactly as authored. No layout engine is involved, so no font metric divergence can occur
— a property that makes static text the *most* faithful subsystem.

### 9.2 Font representation

| Representation | Use | Notes |
| --- | --- | --- |
| Bitmap glyph atlas (per (font, size, style) bucket) | Static text and dynamic text with `embedFonts` | Reference-grade fidelity for small sizes |
| MSDF atlas | Dynamic text needing arbitrary scale/rotation | No size buckets; slightly different AA |
| Signed-distance/vector (`Path2D`-like) runtime rasterisation | Editor-quality previews, huge text | Build-time only, or for `--quality=printer` |

**GFX-R067** The compiler MUST produce bitmap atlases at *device-pixel-aware* sizes: for each
(font id, integer pixel size, anti-alias mode) used by the SWF, rasterise at the device scale
buckets 1×, 2×, 3× (configurable via `graphics.text.scaleBuckets`). Text rendered at 1.37× device
scale uses the 2× bucket scaled down, never nearest-neighbour upscaling.

**GFX-R068** Glyph rasterisation at build time MUST be deterministic and reproducible across
platforms: the rasteriser MUST be a vendored, fixed-version FreeType-like path (or an in-repo
scanline rasteriser over the extracted outlines) so that a build on macOS and a build on Linux
produce identical atlases (REPO-R015). *Hinting must be pinned to a fixed hinting mode*; font
auto-hinting (platform-dependent) is forbidden.

**GFX-R069** Dynamic text with `embedFonts = false` (device fonts, `_sans`, `_serif`, `_typewriter`)
MUST map through a documented substitution table to bundled web fonts (AST-§4.6). The mismatch
between the authored device font metrics and the substitute is a declared F4 divergence, and dynamic
text using device fonts is the single largest source of layout drift in Flash ports; the compiler
MUST warn (`SF0210`) with the count of affected fields.

### 9.3 Dynamic text layout

**GFX-R070** The layout engine MUST implement Flash's line-breaking algorithm: greedy word wrap on
space boundaries, breaking at explicit `<br>`/newline, honouring `wordWrap`, `multiline`, and
`autoSize` (`none|left|center|right` for the horizontal axis and the vertical growth rule). Long
words with no break opportunity MUST overflow the field rather than character-wrap, matching Flash
`[oracle-pinned]` (`T-GFX-028`).

**GFX-R071** Layout MUST run on a *deterministic* measurement path using the built-in advance tables
from the SWF's font (`FontAdvanceTable`, `FontKerningTable` when present) scaled by the font height,
not by measuring rendered glyphs. Measuring the atlas would quantise advances to texel positions and
accumulate rounding drift.

**GFX-R072** Text field geometry, `textWidth`/`textHeight`, and `maxscroll`/`scroll` MUST be derived
from that same layout pass so API values and pixels cannot disagree.

### 9.4 Selection, caret, and input

**GFX-R073** Input text fields MUST render a caret and selection using the same layout boxes; the
offscreen editing model (clipboard, composition/IME) MUST follow the browser's native text input when
possible by overlaying a hidden `<input>`/`contenteditable` element positioned over the field
(RT-§5.7). The visual caret is drawn by the renderer, not the DOM, to keep z-order correct.

**GFX-R074** `restrict`, `maxChars`, `password`, `condenseWhite`, `mouseWheelEnabled`, and
`selectable` MUST be enforced at the input boundary, not by post-filtering events.

## 10. Blend modes and compositing

### 10.1 Blend mode implementation matrix

| Mode (SWF value) | Implementation | Cost |
| --- | --- | --- |
| `normal` (0/1) | Fixed-function premultiplied `ONE, ONE_MINUS_SRC_ALPHA` | 0 |
| `add` (8) | `ONE, ONE` | 0 |
| `alpha` (11) | Group + `dst.a = src.a` via shader | group |
| `erase` (12) | Group + `dst.a *= (1 − src.a)` | group |
| `multiply` (3) | Group; composite pass reads destination texture and emits `src*dst + src*(1-dst.a) + dst*(1-src.a)` | group + 1 pass |
| `screen` (4) | As above with `src + dst − src*dst` | group + 1 pass |
| `lighten` (5) / `darken` (6) | As above with `max`/`min` on unpremultiplied components | group + 1 pass |
| `difference` (7) | As above with `\|src − dst\|` | group + 1 pass |
| `subtract` (9) | `max(dst − src, 0)` | group + 1 pass |
| `invert` (10) | `1 − dst` masked by src alpha | group + 1 pass |
| `overlay` (13) / `hardlight` (14) | Piecewise multiply/screen | group + 1 pass |
| `layer` (2) | Forces an offscreen group for the subtree (a *structural* mode, not a colour mode) | group |

**GFX-R075** WebGL2 has no programmable blending; therefore any mode other than `normal`/`add`
MUST be implemented by rendering the affected subtree to an offscreen target and compositing it with
a shader that reads the destination (ping-pong or `copyTexSubImage2D` of the destination region
before the composite pass; **never** sample the target you are writing to).

**GFX-R076** Group boundaries MUST be derived from the display list: a group spans the subtree of the
clip that carries the blend mode, and *stops* at any sibling that must be composited beneath it in
order. The planner MUST compute group extents as the union of the subtree's device bounds, expanded
by the filter radius (GFX-§11).

**GFX-R077** `alpha`/`erase` (and Flash's "mask-like" blend modes) require the parent to be rendered
into a group; when the parent is the root, the group is the full stage. Games using `erase` for
spotlights and fog are common; correctness here is worth the cost, and the cost is bounded by
`GFX-§16`'s group budget.

**GFX-R078** All blend-mode maths MUST be performed on **unpremultiplied** components where the
formula requires it, and result alpha MUST be recomputed and stored premultiplied. Getting this
wrong produces the classic "50% grey instead of bright red" multiply bug; a dedicated shader
library with per-mode unit tests (`T-GFX-040`) is required.

### 10.2 Caching blend groups

**GFX-R079** A group whose contents and transforms are unchanged between frames MUST be cacheable
(key includes subtree hash + device bounds + DPR + blend mode). This is the difference between a
playable and an unplayable game for titles that use `multiply` on a large background.

## 11. Filters

SWF filters (tag ids 0–7, APP-§4) attach to placements via `PlaceObject3` and to clips at runtime via
`MovieClip.filters`.

**GFX-R080** Filter pipeline shape: render the *filtered subtree* into an offscreen target sized to
the subtree's bounds expanded by the filter's `blurX/blurY × quality + distance + strength` margin,
apply the filter chain in order, then composite with the clip's blend mode. Chain evaluation MUST be
left-to-right, each filter reading the previous result (Flash semantics).

**GFX-R081** Filter parameters MUST be scaled from the SWF/AS units to device pixels exactly once:
`blurPx = blurValue × effectiveScale × dpr`, with **no** 1/20 factor. Ch.3 stores `BlurX`/`BlurY` as
16.16 `FIXED` values in the same pixel units the AS `flash.filters` classes use ("the distance is
measured in pixels"; the blur is a sub-pixel box/median filter whose window sits in pixel space and
whose `BlurX`/`BlurY` are odd pixel counts), so the tag → AS surface → renderer chain carries one unit
only. See errata `E-009`, which retires the earlier twips reading; `GFX-D11` is settled by it.

### 11.1 Blur family (drop shadow, glow, bevel, gradient glow, gradient bevel)

**GFX-R082** Blur MUST be approximated by a **3-pass box blur** (a well-known close approximation to a
Gaussian) with σ = blurRadius/2 per axis, executed separably (horizontal then vertical), using a
downsampled intermediate for radii > 8 device px (half-resolution pyramid, two levels max).

**GFX-R083** The exact mapping between the SWF's `blurX/blurY` and our σ, plus the treatment of
`quality`/`passes` (SWF filter `NumPasses`, AS `quality` 1–3), is declared in `GFX-D01` and MUST be
verified against oracle screenshots with the GFX-§13.4 tolerance. Implementations MUST NOT "improve"
on the approximation without updating the decision entry.

**GFX-R084** Drop shadow / glow / bevel / gradient-glow / gradient-bevel MUST be implemented as a
shared "area effect" routine parameterised by:
`{ source = (outer | inner), colourStops, distance, angle, strength, knockout, onTop, compositeSource }`.
The algorithms are the standard Flash semantics:

| Filter | Behaviour |
| --- | --- |
| Drop shadow | Extract alpha, offset by `(cos θ, sin θ) × distance`, blur, tint with colour, composite *under* the source (or over, if `InnerShadow`) |
| Glow | Blur the alpha (no offset), tint, under/over per `InnerShadow` |
| Bevel | Two highlights: highlight colour offset by `+angle·distance`, shadow colour by `−angle·distance`; composite per `OnTop`; `Strength` multiplies the effect |
| Gradient glow/bevel | As above with a *gradient* tint (ramp textured, 1-D along the blur direction) |

**GFX-R085** `Knockout` MUST zero the source's own pixels where the effect applied (Flash's knockout
mode shows only the effect), and `CompositeSource` MUST be honoured (false = do not draw the original
content).

**GFX-R086** `Strength` is stored `FIXED8` and is **normalised so that 1.0 is `0x0100`** (Ch.3: "the
strength of the shadow normalized is 1.0 in fixed point; the strength value is applied by multiplying
each value in the shadow pixel plane"). It MUST be applied as `gain = strength / 256` on the effect's
plane — `effectAlpha' = clamp(effectAlpha × strength / 256, 0, 1)` — and MUST NOT be divided by 100 or
treated as a percentage. See errata `E-009`.

### 11.2 Blur filter (`FilterID 1`)

**GFX-R087** `BlurFilter` (and `blurFilter` on AS2 `flash.filters`) MUST blur the *premultiplied*
RGBA, including alpha, with edge handling `ClampToEdge` on the group's expanded bounds — Flash's blur
fades content out at the group edges rather than repeating it.

### 11.3 Convolution (`FilterID 5`)

**GFX-R088** Convolution MUST be implemented as a generic matrix pass (`columns × rows`, `divisor`,
`bias`, `defaultColor` for out-of-bounds samples, `clamp`/`preserveAlpha` flags) executed
per-pixel in the fragment shader with unrolled loops for the common 3×3 case (a specialised shader)
and a general loop otherwise. Kernel size is bounded by `maxConvolutionSize` (default 15×15);
larger kernels fall back to a two-pass separable form when the kernel is separable (tested by rank
at runtime, cached) or to a CPU reference with a `risk` diagnostic.

### 11.4 Colour matrix (`FilterID 6`)

**GFX-R089** `ColorMatrixFilter` MUST be a single-pass shader. The SWF/AS matrix has 20 floats in
4 rows × 5 columns: rows are `R,G,B,A` outputs, the first four columns are unit-scale multipliers, and
**the fifth column is a translation expressed in 0…255**, which the runtime MUST divide by 255 before
use (`[verify]` `GFX-D12`). Alpha output is `dot(row4, [r,g,b,a]) + t4/255`, with the alpha term in
unpremultiplied space.

**GFX-R090** When a colour matrix filter and a colour transform coexist, both MUST apply in the
documented order (transform first, filter second) — Flash applies the filter to the transformed
content.

### 11.5 Filter caching and invalidation

**GFX-R091** Filtered groups MUST be cached by
`(subtree structural hash, device bounds, dpr, filter chain id, blend mode)`, and invalidated by:
content change, transform change of any descendant, colour-transform change of any descendant,
filter parameter change, viewport/DPR change, or texture-cache eviction.

**GFX-R092** A filtered group MUST NOT be cached when its subtree contains any clip whose content is
time-varying and changes every frame (the cache would thrash); the planner detects this via the
"mutated this frame" flag the display list sets (GFX-§14.2).

## 12. Hit testing and bounds

**GFX-R093** The renderer MUST maintain, per clip per frame: `localBounds`, `deviceBounds`
(after transform, before clipping), `compositeMatrix`, and `effectiveAlpha`
(AVM1-R052, AVM1-R053, AVM1-R062).

**GFX-R094** Pixel-accurate `hitTest(x, y, true)` MUST query a *coverage* representation of the clip's
content: the renderer maintains (lazily, on demand, LRU-bounded) an 8-bit coverage mask per shape at
the current scale bucket, or renders the clip's subtree into an A8 target when shapes are not
individually maskable (e.g. filtered groups). `hitTest` semantics:

```
shapeFlag=false → bounding box test on the *rendered content* bounds (not the authored shape bounds)
shapeFlag=true  → coverage at the transformed point > alphaThreshold (default 0)
```

`[oracle-pinned]` `T-GFX-030` — Flash's threshold and edge handling are the kind of detail that must
be measured, not assumed.

**GFX-R095** `hitTest` MUST be *side-effect free* and MUST NOT force a GPU flush in the middle of a
frame: coverage queries are answered from CPU-side data (analytic coverage sampled on the CPU) or from
a target that was already rendered this frame.

## 13. Fidelity limits and their measurement

### 13.1 What is F1/F2 (must be exact)

- Geometry: fill polygons for straight-edged shapes, stroke polygon vertices (modulo float rounding),
  gradient square mapping, text positions for static text, mask rectangles.
- Ordering: draw order, group boundaries, depth order.
- Colour: transforms in the integer path where SWF-R021's arithmetic is used.

### 13.2 What is F3 (tolerance)

- Anti-aliased edges: 1 device-pixel coverage model vs Flash's scanline AA.
- Blur/glow/bevel appearance: box-blur approximation.
- Curved-edge flattening: 2–6 segments per curve.
- Mipmap filtering of minified bitmaps.

### 13.3 What is F4 (approximate, declared)

- Font substitution for device fonts (AST-§4.6).
- Filters on very large content where the downsampled pyramid changes the tail of the blur.
- `quality = 'LOW'` rendering (Flash's low-quality mode is not reproducible; we render normal
  quality and note it).

### 13.4 Tolerance definitions

| Metric | Scope | Threshold | Test |
| --- | --- | --- | --- |
| Exact pixel match | Straight-edged, opaque, integer-positioned fixtures | 100% of pixels | T-GFX-001…005 |
| SSIM | Curved/AA-heavy fixtures at matched resolution | ≥ 0.995 | T-GFX-010…019 |
| Per-pixel alpha RMS | Thin strokes, hairline, small text | ≤ 3/255 RMS | T-GFX-020…029 |
| Draw-call count | Deterministic scene | exact equality with recorded value | T-GFX-050 |

**GFX-R096** Every tolerance used in tests MUST be declared here and MUST be justified by a comment
naming the fidelity limit it covers. A test that passes "because the tolerance is 0.9" is a bug.

## 14. Caching, invalidation, and memory

### 14.1 Tessellation cache

```
Key:   (characterId | drawingProgramHash, fillRule, scaleBucket, qualityMode, strokeParamsHash)
Value: { vertexBuffer, indexBuffer, vertexCount, bounds, strokeBounds }
Policy: LRU2 with byte accounting; eviction target 256 MiB total GPU-side geometry (configurable)
```

Scale buckets (quantised, geometric): `[0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12]` with each bucket
covering `[b, b·1.25)`. Descending below 0.5 and above 12 is clamped with a `risk` diagnostic if the
content is large enough that tessellation quantisation becomes visible.

### 14.2 Static batch cache

```
Key:   (structuralHash(staticSubtree), accumulatedMatrixBucket, accumulatedCxform, dpr, stageScale)
```

**GFX-R097** The cache MUST be invalidated by an epoch counter that any mutation of the display list
increments (`addChild`, `removeChild`, transform set, property set, timeline advance into the subtree).
A correct-but-coarse invalidation is acceptable; a missed invalidation is a visible flicker bug.

### 14.3 Texture cache

- Textures are uploaded lazily, streamed by priority (visible first, then preload hints from the
  manifest: `AST-§5.3`).
- **GFX-R098** Texture memory MUST be bounded by `graphics.textureBudgetMb` (default: 256 MB desktop,
  128 MB mobile), enforced at the *atlas page* granularity: evicting one texture evicts its page's
  siblings unless the page is a "resident" page marked by the manifest.
- **GFX-R099** Upload work per frame MUST be bounded (`maxUploadBytesPerFrame`, default 8 MiB);
  exceeding it defers uploads to later frames and reports a one-time `info`.

### 14.4 Per-frame allocation discipline

**GFX-R100** The renderer MUST be allocation-free in steady state: plan objects, instance buffers,
and uniform blocks are pooled and reused. Any per-frame allocation is a bug caught by T-GFX-021's
heap-growth assertion.

## 15. Quality modes and feature fallbacks

### 15.1 Quality mode mapping

| RenderQuality | AA | Bitmap filtering | Filters | Gradients | Dithering |
| --- | --- | --- | --- | --- | --- |
| `low` | none (hard edges) | nearest | skipped (draw unfiltered) | banded (16 steps) | off |
| `medium` | analytic | bilinear, mips from 1× | radius ≥ 4 px, 1 pass | full | off |
| `high` (default) | analytic + 4× MSAA | trilinear | full | full | on (ordered 4×4) |
| `best` | analytic + 8× MSAA or 2× SS | trilinear + aniso | full + pyramid | full | on |

**GFX-R101** Rendering at lower quality MUST NOT change geometry, positions, depths, or hit-testing —
only shading. Games that use `hitTest(true)` and then render at `low` must not diverge.

**GFX-R102** `System.capabilities`/`Stage.quality` reads by game code MUST observe the *authoritative*
quality mode (so a game that lowers quality for performance sees the value it set), while the
renderer may internally exceed it for text legibility (small text is never rendered with hard edges
unless `low` is explicitly confirmed by the game).

### 15.2 Feature fallbacks

| Missing capability | Fallback | Declared |
| --- | --- | --- |
| MSAA | analytic only | `GFX-D02` |
| `EXT_color_buffer_float` | RGBA8 filter targets, clamped | `risk` at boot |
| Compressed texture support | WebP/PNG atlas pages (AST-§3.3) | `info` at boot |
| STENCIL buffer unavailable (context loss recovery) | A8 mask targets | `risk` |
| Anisotropy | trilinear | `info` |
| Timer queries | CPU frame timing | n/a |

## 16. Performance budgets

Budgets apply to the baseline device defined in TST-§7 (2020 mid-range laptop, integrated GPU,
Chromium, 1920×1080 canvas at DPR 1; and a 2020 mid-range phone at 2× DPR).

| Budget | Desktop target | Mobile target | Measurement |
| --- | --- | --- | --- |
| Draw calls / frame (typical scene) | ≤ 700 | ≤ 350 | `renderer.stats.drawCalls` |
| Draw calls / frame (worst-case fixture) | ≤ 2000 | ≤ 1200 | T-GFX-050 |
| Triangles / frame | ≤ 300 k | ≤ 150 k | stats |
| State changes (program/texture/blend) | ≤ 1500 | ≤ 900 | stats |
| CPU: display-list walk + planning | ≤ 1.5 ms | ≤ 3 ms | `stagePerf` markers |
| CPU: tessellation (steady state, cached) | ≤ 0.5 ms | ≤ 1 ms | markers |
| CPU: tessellation (one-off, cold, 1000-shape scene) | ≤ 250 ms total, ≤ 8 ms/frame slice | ≤ 500 ms total | T-GFX-051 |
| GPU: frame time | ≤ 8 ms at 1080p | ≤ 12 ms at 1440×720×2 | timer query / CPU proxy |
| Texture memory | ≤ 256 MB | ≤ 128 MB | accounting |
| Uploads / frame | ≤ 8 MiB | ≤ 4 MiB | accounting |
| Filter passes / frame | ≤ 12 groups | ≤ 6 groups | stats |
| Steady-state allocations | 0 bytes/frame | 0 bytes/frame | heap profile delta |

**GFX-R103** The runtime MUST expose `renderer.stats` (draw calls, triangles, programs, textures,
groups, uploads, cache hit ratios) with ≤ 0.05 ms overhead when disabled (null-checked counters), and
the debug overlay (GFX-§17) surfaces it.

**GFX-R104** Cold-start budget: a 1 000-shape scene MUST reach first-rendered-frame in ≤ 900 ms on the
baseline desktop, with progressive uploading so the first frame is not blocked on all textures
(RT-§5.8).

## 17. Debug and validation tooling

**GFX-R105** The renderer MUST provide:

| Tool | Behaviour |
| --- | --- |
| Stats overlay | draw calls, batches, triangles, groups, cache hit rate, upload bytes, frame ms |
| Batch inspect | colour-code draw calls for one frame; list of batch keys |
| Shape atlas dump | export tessellated geometry to SVG/JSON for a given character id |
| Capture/compare | screenshot at a deterministic frame index; used by TST-§6 |
| Validation layer | with `--gfx-validate`, assert: no unbounded buffers, no sampling of the bound target, no NaN vertices, texture budget respected, every draw call accounted for |

**GFX-R106** A NaN/Inf vertex or uniform MUST be detected (cheap `!=` self-compare on a sampled vertex
in the validation layer, or a full scan in tests) and reported once with the character id, then the
draw MUST be skipped rather than corrupting the frame buffer.

## 18. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| T-GFX-001 | Solid rectangle at integer position: exact pixels | F1 |
| T-GFX-002 | Multiple fills with `stateNewStyles`, holes (even-odd vs nonzero) | F1 |
| T-GFX-003 | (reserved — roadmap P4 table previously listed this id; no behaviour was specified; intentionally left vacant so reuse is explicit) | — |
| T-GFX-004 | Hairline stroke (width 0) renders as exactly one device-pixel row/column regardless of transform scale (`GFX-R030`) | F1 |
| T-GFX-005 | Adjacent fills sharing an edge: seam within tolerance | F3 |
| T-GFX-006 | Drawing API: open trail fills closed; `clear()` erases only drawing | F2 |
| T-GFX-010 | Radial + focal gradient ramp vs oracle (sampled grid) | F3 |
| T-GFX-011 | Spread modes repeat/reflect at 20× frequency | F3 |
| T-GFX-015 | Mask visibility and hit-test independence | F2 |
| T-GFX-020 | Deterministic batching: draw-call count exact, twice | F1 |
| T-GFX-021 | Zero steady-state allocation over 600 frames | F1 |
| T-GFX-028 | Word wrap, overflow, `autoSize`, `maxscroll` | F2 |
| T-GFX-030 | `hitTest` matrix: bounding and shape, nested transforms, negative scale | F3 |
| T-GFX-031 | CXFORM arithmetic vs oracle on a ramp of mult/add values | F3 |
| T-GFX-035 | Non-smoothed bitmap sampling is single-mip nearest, no mip interpolation (`GFX-D10`) | F3 |
| T-GFX-040 | All blend modes on a standard 2-layer test image | F3 |
| T-GFX-041 | Filter chain order and caching invalidation | F2 |
| T-GFX-050 | Draw-call budget on the standard scene set | F1 |
| T-GFX-051 | Cold tessellation budget | F1 |
| T-GFX-060 | Context loss / restore (RT-§5.9): caches rebuild, no crash | F1 |
| T-GFX-061 | Quality mode switch does not change geometry or hit tests | F2 |
| T-GFX-062 | Button hit area: no `ButtonStateHitTest` record ⇒ union of the `up` geometry with each record's matrix applied (`GFX-D16`) | F2 |
| T-GFX-070 | Static-scene bundle (`swf-forge/static-scene` v1): round-trip serialise/parse, validation errors, out-of-range frames | F1 |
| T-GFX-071 | Static-scene builder: sprite flattening, playhead wrap, matrix twips→px, clip rect quantisation | F1 |
| T-GFX-072 | CPU and GPU paths consume the same `ShapeRun`/`MeshRun` contour list (one geometry, two backends) — triangle/vertex parity per run | F1 |

## 19. Decision register

| ID | Decision | Default | Verification | Notes |
| --- | --- | --- | --- | --- |
| GFX-D01 | Blur approximation: box passes, σ mapping, `quality` handling | 3-pass box, σ = r/2, downsample > 8 px | T-GFX-041 vs oracle | Documented divergence F3 |
| GFX-D02 | Fill rule when `DefineShape4` flag absent | even-odd | T-GFX-002 | Only Shape4 states a rule |
| GFX-D03 | Fill tessellation: monotone vs ear-clip vs both | convex fast path + monotone, ear-clip fallback | T-GFX-051 | Determinism matters more than which |
| GFX-D04 | Analytic AA + MSAA hybrid as the default | Yes | Budgets | Alternative: SSAA 2× (rejected: bandwidth) |
| GFX-D05 | Text atlas scale buckets | 1×, 2×, 3× | T-GFX-028 | Configurable |
| GFX-D06 | Device-font substitution table | Bundled metric-compatible set; document per-font deltas | AST-§4.6 | Biggest layout-drift source |
| GFX-D07 | Static batch cache granularity | Per clip subtree, coarse invalidation | T-GFX-020 | Miss = flicker, so coarse is safe |
| GFX-D08 | Group (FBO) resolution: stage-scale or device-scale? | Device-scale (full res) | Budgets | Half-res option for effects: rejected for correctness |
| GFX-D09 | Mask clip visibility semantics | Pathological cases resolved per spec text | T-GFX-015 | Flash's real behaviour must be measured |
| GFX-D10 | Non-smoothed bitmap sampling | Single-mip nearest | T-GFX-035 | Mips + nearest is a known trap |
| GFX-D11 | Filter parameter units at the AS API boundary | Tag-sourced filters: `FIXED` **pixels** (16.16) and `Strength` `FIXED8` (1.0 = `0x0100`) as written; AS-constructed filters: px at the API, converted to the file representation exactly once | T-GFX-041 | Errata `E-009` retires the earlier "1/20 px twips" reading; double-scaling is the common bug |
| GFX-D12 | ColorMatrix translation column scale | 0…255 | T-GFX-040 | Verify against oracle |
| GFX-D13 | Shadow/glow `strength` semantics | Alpha gain, not colour multiply | T-GFX-041 | Visible difference |
| GFX-D14 | Gradient ramp dithering | 4×4 ordered dither on 8-bit targets, off for 16F targets | T-GFX-010 | Prevents banding Flash also had |
| GFX-D15 | Supersampled fallback threshold | 20 000 vertices or 3 failed tessellation attempts | Budgets | Must be logged once |
| GFX-D16 | Button hit area when no `ButtonStateHitTest` record exists | Union of the `up` state's geometry with each record's matrix applied | T-GFX-062 | Ch.12 defines the hit state, not the fallback; `IMPL-100` R015 pins it against player behaviour |

## 20. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | First draft |
| 1.1 | 2026-10-04 | Errata `E-009` applied: `GFX-R081` blur is `blurValue × effectiveScale × dpr` (tag values are `FIXED` pixels, not twips); `GFX-R086` `gain = strength/256` with 1.0 = `0x0100`; `GFX-D11` restated to match (no twips conversion) |
| 1.2 | 2026-10-04 | Ch.12 ripple: decision `GFX-D16` (button hit-area fallback) and test `T-GFX-062` added for `IMPL-100` §4; the `T-GFX-035` cited by `GFX-D10` is now defined |
