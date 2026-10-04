# AST — Assets: Bitmaps, Fonts, Video, Manifest, and Archive

**Doc ID:** AST · **Status:** Draft 1.3 · **Normative:** yes
**Depends on:** SWF, CMP, GFX, AUD

---

## 1. Scope

This document specifies every non-shape, non-audio, non-code asset path: bitmap conversion, font
extraction and representation, video transcoding, the **asset manifest**, and the optional single-file
archive. GFX and AUD consume what this document produces.

The guiding rules:

- **AST-R001** Assets MUST be shipped in a format the browser can consume directly (no runtime
  decompression of SWF-specific formats). The only exception is an optional WASM decoder for a codec
  the browser cannot handle (SEC-§5).
- **AST-R002** Every asset MUST be content-addressed and accompanied by metadata sufficient for the
  runtime to load it without parsing the payload (`AST-§5`).
- **AST-R003** Conversion MUST be deterministic (REPO-R015): pinned codec versions, no timestamps,
  no embedded tool fingerprints, sorted metadata keys.

## 2. Asset classes and target formats

| SWF source | Target | Fallbacks | Where specified |
| --- | --- | --- | --- |
| `DefineBits` (6), `DefineBitsJPEG2` (21), `DefineBitsJPEG3` (35), `DefineBitsJPEG4` (90) | KTX2 (ETC2/BC/ASTC) | WebP lossy, PNG lossless | AST-§3 |
| `DefineBitsLossless` (20), `DefineBitsLossless2` (36) | KTX2 (lossless-ish via high quality) or PNG | WebP lossless | AST-§3 |
| `DefineFont` (10), `DefineFont2` (48), `DefineFont3` (75), `DefineFont4` (91) | WOFF2 (outlines) + bitmap/MSDF atlases (for text rendering) | — | AST-§4 |
| `DefineVideoStream` (60) + `VideoFrame` (61) | MP4 (H.264 + optional AV1) + poster frame | WebM/VP9, animated WebP for short clips | AST-§5 |
| `DefineBinaryData` (87) | Raw file, verbatim | — | AST-§6 |
| `DefineSound` (14), stream sounds | Ogg/WebM (Opus), M4A (AAC), MP3 passthrough | — | AUD-§4 |
| All others (shapes, sprites, text) | Vector IR / layout data emitted as TypeScript | — | CMP-§5, GFX |

## 3. Bitmaps

### 3.1 Source formats

| Tag | Payload | Notes |
| --- | --- | --- |
| `DefineBits` (6) | JPEG **without** its own tables (uses `JPEGTables` (8)) | Legacy; must merge tables before decoding |
| `DefineBitsJPEG2` (21) | JPEG, PNG, or GIF89a bytes | The "image type" is detected by magic bytes, not declared |
| `DefineBitsJPEG3` (35) | JPEG + zlib-compressed 8-bit alpha plane | Alpha is *separate*; must be combined |
| `DefineBitsJPEG4` (90) | JPEG + alpha + `DeblockParam` | Deblocking hint, usually ignored |
| `DefineBitsLossless` (20) | zlib, colour formats: 3 = 8-bit colormapped (`BitmapColorTableSize + 1` entries), 4 = 15-bit RGB555, 5 = 24-bit RGB | Rows padded to 32-bit words by pixel unit (1/2/4 bytes) |
| `DefineBitsLossless2` (36) | zlib, formats: 3 = 8-bit colormapped with an RGBA table, 5 = 32-bit ARGB | Only 3 and 5 are documented; the ARGB form's RGB is **premultiplied** (a classic gotcha). Format 4 appears in the wild and is decoded tolerantly |

**AST-R004** GIF/PNG sources inside `DefineBitsJPEG2` MUST be passed to a real decoder (not sniffed
into a JPEG decoder); a mixed movie is common. `SF0203` (info) records the detection.

**AST-R005** `DefineBitsJPEG3/4` alpha MUST be composited at build time into a single RGBA texture.
The alpha plane is 8-bit, **not** premultiplied, and MUST inflate to exactly `Width x Height`; it is
only present when the colour payload is a JPEG (a PNG/GIF payload carries, or lacks, its own alpha).
Combine it with the decoded JPEG RGB **after** undistorting any JPEG chroma subsampling artefacts by a
1-pixel edge bleed (AST-R010).

**AST-R006** `DefineBitsLossless` 8-bit colormapped images MUST be expanded to RGBA at build time; the
palette has `BitmapColorTableSize + 1` entries (`BitmapColorTableSize` is one less than the count — the
inevitable off-by-one here shifts every colour). Premultiplication is a property of **format 5 of
`DefineBitsLossless2`** (its 32-bit ARGB data), not of a 15-bit format, and colormapped
(`*COLORMAPDATA`) palettes are not premultiplied; the ARGB data MUST be **un-premultiplied** before
conversion or the sprite shows dark fringes — the single most common lossless-bitmap porting bug.

**AST-R007** Row padding (every row aligned to the next 32-bit word in the SWF's lossless formats) MUST
be honoured, using the pixel unit's own size — 1 byte for indexed data, 2 for `PIX15`, 4 for `PIX24` —
so a 253-pixel 8-bit row is 256 bytes. Omitting padding produces the characteristic skewed-image defect
and, for direct-colour formats, shifts every row progressively.

**AST-R035** JPEG-bearing tags MUST be reassembled before decoding: `DefineBits` needs its `JPEGTables`
splice (at most one `JPEGTables` per file; a missing one is an error, not a silent failure), a payload
may carry the pre-SWF 8 erroneous `FFD9 FFD8` prefix before its SOI, and `DefineBitsJPEG4`'s
`DeblockParam` (8.8 fixed, 0–100 %) is recorded for provenance and never applied by us — filters belong
to the player, and applying one changes pixels.

### 3.2 Filtering, scaling, and colour

**AST-R008** `PlaceObject`'s bitmap matrix and the placement transform determine the *rendered* size;
the compiler MUST NOT bake any part of the placement transform into the texture (it is dynamic).
Exceptions where baking is legal and desirable:
- a 4×4 or larger integer minification that would otherwise alias badly (`bakeMinifiedCopy: true`),
- a bitmap used only by one placement whose transform is provably static (`SF0204`, info, reported).

**AST-R009** Mip chains MUST be generated for every texture ≥ 64×64 or intended to be minified, using
a deterministic, high-quality filter (Kaiser-windowed sinc, α = 2.0, identical implementation across
platforms).

**AST-R010** **Edge bleed (dilation) is mandatory**: before mip generation, each sprite's border pixels
MUST be extended outward by ≥ 2 texels (or the sprite's own texel colour when the sprite is a
standalone texture with transparency) so that bilinear/mip sampling cannot sample the transparent
"outside" and produce dark or bright halos (GFX-R060).

**AST-R011** Colour-space policy: SWF bitmaps are authored as sRGB-encoded (or as 8-bit palettes).
The pipeline MUST preserve authored values 1:1 (`AST-D01`) and MUST NOT apply gamma correction or
tone mapping to bitmap data; the renderer's blending happens in sRGB-encoded space, matching Flash's
behaviour (this matters: blending in linear space changes the look of every semi-transparent sprite).

### 3.3 Texture formats and the KTX2 container

**AST-R012** The primary delivery format MUST be **KTX2** with Basis Universal supercompression
enabled (`KHR_texture_basisu`-style usage):
- ETC1S for colour data with alpha (broadest support, smallest),
- UASTC + Zstd for content that must survive compression artefacts (UI, small text, crisp lines),
- the build MUST emit both when the budget allows and let the runtime choose.

**AST-R013** The fallback ladder for a device lacking compressed-texture support MUST be:
KTX2(ASTC) → KTX2(ETC2, always available in WebGL2) → WebP (lossless for UI, lossy for photos) →
PNG. Builds MUST include exactly the levels that the configured `graphics.textureFormat` policy
requires, and MUST fail the build if the *last* level is missing for a texture
(`SF0205`, error), because a missing texture is a broken game.

**AST-R014** Texture atlas pages MUST be square, power-of-two, ≤ `graphics.atlas.maxSize`, and share a
single format. Pages are grouped by *usage class* (static art, UI, particles, 8-bit art) so that a
cheap eviction policy has meaningful granularity (GFX-§14.3).

**AST-R015** Lossless sources (Lossless/Lossless2) that will be used as UI, text, or pixel art MUST
be encoded with a **lossless** path (KTX2 UASTC with lossless settings, or WebP lossless) — never
ETC1S, which visibly degrades thin 1-pixel lines (`AST-D02`).

### 3.4 Sprite packing and metadata

For each sprite, the manifest records:

```jsonc
{
  "logical": "sprite_42",
  "charId": 42,
  "atlas": "ui_0",
  "rect": [x, y, w, h],           // texel rect in the atlas page
  "originTwips": [tx, ty],        // the sprite's registration point in SWF twips
  "sourceSize": [w, h],           // original pixel size
  "scale9": [l, t, r, b] | null,  // DefineScalingGrid rect, if present
  "format": "uastc",
  "smoothing": true               // from the fill/placement (false → nearest sampling)
}
```

**AST-R016** `originTwips` MUST be preserved exactly; the sprite's registration point is where
`_x`/`_y` refer, and rounding it to pixels shifts every placement in the game.

**AST-R017** Packing MUST be deterministic and reproducible: sort sprites by (usage class, height
desc, width desc, charId asc) and place with a skyline/grid hybrid. Two builds MUST produce identical
atlases byte-for-byte. The packer MUST maintain ≥ 2 px gutters (AST-R010) and ≤ 85% fill target
(beyond that, packing time and fragmentation explode).

**AST-R018** Atlases MUST NOT mix sprites with different filtering requirements (smoothing on/off)
or different colour-space assumptions; the packer's usage classes cover this.

### 3.5 `BitmapData` and runtime drawing

**AST-R019** `flash.display.BitmapData` in AS2 has a small but real API surface (`loadBitmap`,
`draw`, `getPixel`/`setPixel`, `copyPixels`, `fillRect`, `applyFilter`, …). The runtime MUST implement
`BitmapData` **backed by a canvas/offscreen target**:
- `loadBitmap(id)` binds to the compiled texture,
- `draw(mc, matrix, colorTransform)` renders a clip subtree to the target (a real render-to-texture;
  reuse the group machinery of GFX-§10),
- pixel access (`getPixel`) MUST work by reading back a small region (documented as slow), with a
  CPU-side mirror only when a game proves hot (`SF0206`, info, suggests a build-time cache).

**AST-R020** `attachBitmap(bitmapData, depth, pixelSnapping, smoothing)` MUST create a display object
that samples the target and reflects subsequent mutations (`draw`, `fillRect`) — this means the
texture is *dynamic*: the implementation uploads on mutation with a dirty flag, bounded to one upload
per target per frame.

**AST-R021** `BitmapData` originals loaded from a SWF (`loadBitmap`) MUST share the atlas texture when
possible (zero-copy) and MUST fall back to a standalone texture when pixel access is required
(atlases cannot be read back cheaply in WebGL2).

## 4. Fonts and text assets

### 4.1 Glyph extraction

**AST-R022** For each font character (`DefineFont*`), the compiler MUST produce:
1. **Outlines** in font units, with `unitsPerEm` recorded (1024 for DefineFont/2, 20480 for
   DefineFont3, per SWF-R038; CFF fonts carry their own upem).
2. **Metrics**: ascent, descent, leading, per-glyph advance widths (from `FontAdvanceTable`), and
   kerning pairs (from `FontKerningTable`). When layout data is absent (`HasLayout = 0`), the
   compiler MUST derive metrics from glyph bounds **once**, record the derivation (`SF0211`, info),
   and use them everywhere (never mixing derived and authored metrics).
3. **A code→glyph map** from the `CodeTable` (UCS-2 for SWF ≥ 6), plus any `DefineFontInfo` mapping.

### 4.2 Font delivery

**AST-R023** Outlines MUST be delivered as **WOFF2** per font, generated deterministically:

| Aspect | Rule |
| --- | --- |
| Glyph order | original code order, then `.notdef` first if present |
| Units | normalised to 1000 or 2048 upem (record which); all metrics scaled consistently |
| Hinting | stripped (no TT hinting) — rendering hinting is *ours*, applied at rasterisation |
| Name table | minimal, deterministic strings (`name` = `forge_<fontId>`) |
| Metadata | no timestamps, no vendor strings, no `DSIG` |

**AST-R024** WOFF2 is used for: (a) DOM text (RT-§7.4), (b) fallback rendering for dynamic text at
sizes with no atlas bucket, and (c) MSDF atlas generation input.

**AST-R025** **Bitmap glyph atlases** are the primary rendering path for text (GFX-§9.2):
- one atlas page set per (font id, integer size bucket, AA bucket, device scale bucket),
- sizes come from a *census* of the SWF: static text sizes plus dynamic field sizes observed in
  `DefineEditText.FontHeight` and in `TextField` creation constants where statically known,
  plus a fallback ladder (8, 10, 12, 14, 16, 20, 24, 32, 48 px) rounded to integers,
- unknown sizes at runtime MUST use MSDF or the WOFF2 fallback and MUST report `SF0212` (info) once.

**AST-R026** Glyph rasterisation MUST be pixel-snapped in the same way Flash did for small text when
`FontFlagsSmallText` is set (GFX-R013.3); this is the difference between crisp and blurry 10 px text.

**AST-R027** MSDF generation (when enabled) MUST use a documented generator version, emit 3-channel
SDFs with a fixed 4 px range (scaled per size bucket), and MUST pass a visual check against the bitmap
atlas at 1× (`T-AST-020`).

### 4.3 Character coverage and subsets

**AST-R028** Atlases MUST include only glyphs the movie can actually display, plus:
- ASCII printable,
- the glyph set of every static text run,
- the glyph set of every dynamic field's *initial* text,
- **the full `CodeTable` of the font when the field is dynamic and unrestricted** (`restrict` is null
  and `embedFonts` is true), because game code can assign arbitrary strings. This case MUST be
  detected and reported with the estimated atlas cost (`SF0213`, info); omitting it is the cause of
  the classic "all my dynamic text shows as boxes" bug.

### 4.4 Static text

**AST-R029** `DefineText`/`DefineText2` runs MUST be compiled into glyph quads *in the emitted
timeline data* (positions, per-run colour, per-run colour transform), not into a rasterised image.
Rationale: the text then scales with the stage exactly as authored, uses the atlas, and remains
diffable in the emitted TS.

**AST-R030** `DefineText` colour transforms (`DefineText2`) apply per *run*, and MUST be preserved
per-run rather than per-instance (games recolour only part of a label).

### 4.5 `DefineEditText` (dynamic/input fields)

**AST-R031** The declarative model for an edit text field MUST be preserved in the manifest/emitted
code with all layout-affecting fields:

```jsonc
{
  "kind": "editText",
  "charId": 77,
  "boundsTwips": [x, y, w, h],
  "font": { "id": 3, "heightTwips": 240, "color": 0x000000, "bold": false, "italic": false },
  "embedFonts": true,
  "multiline": true,
  "wordWrap": true,
  "html": false,
  "autoSize": "none",
  "border": true, "background": true,
  "borderColor": 0x000000, "backgroundColor": 0xffffff,
  "variable": "score_text",
  "initialText": "Score: 0",
  "maxChars": null,
  "restrict": "0-9",
  "password": false,
  "selectable": true,
  "condenseWhite": false,
  "align": "left"
}
```

**AST-R032** `variable` MUST be compiled to a *bound* field (AVM1-R069) with the variable name resolved
through the field's scope at runtime (the name is a string in AVM1 and may be dynamic; the static
case gets a fast path).

### 4.6 Device fonts and substitution

**AST-R033** `DefineFont2/3` may reference a device font rather than embedding outlines
(`FontFlags` + `FontName` with no glyph data). The compiler MUST map the requested family to the
bundled substitution table:

| Requested (typical) | Substitutes (default) | Notes |
| --- | --- | --- |
| `_sans` | Inter / system-ui fallback chain | Metric differences documented |
| `_serif` | Noto Serif / Georgia | |
| `_typewriter` | JetBrains Mono / Courier New | |
| `Arial`, `Helvetica`, `Verdana`, `Tahoma` | Inter, with per-glyph width correction | Width correction improves wrap fidelity |
| `Times New Roman`, `Georgia` | Noto Serif | |
| `Comic Sans MS`, `Impact`, `Trebuchet MS` | Closest free lookalike, listed in the table | Recorded as F4 divergence |

**AST-R034** Substitutions MUST be recorded per font with an `SF0210` (warning) naming the count of
affected text fields, and the divergence list MUST include an entry with the fidelity level F4.

**AST-R035** When `embedFonts` is false on a *dynamic* field, the runtime may use the substitute's own
metrics (unavoidable). When `embedFonts` is true, the compiler MUST embed the SWF's outlines and use
*their* metrics, even though glyph shapes came from a device font at authoring time — this is the only
way wrap points match.

## 5. Video

### 5.1 Source codecs

| `DefineVideoStream.CodecID` | Codec | Notes |
| --- | --- | --- |
| 2 | H.263 (Sorenson Spark) | Very old; frame sizes 128/176/352/704/1408 |
| 3 | Screen video | Lossless-ish screen capture; palette blocks |
| 4 | VP6 | Spark successor; alpha variant = 5 |
| 5 | VP6 with alpha | Separate alpha plane stream |
| 6 | Screen video v2 | |

**AST-R036** Video MUST be transcoded at build time. There is no browser path for Spark/VP6/Screen
video. Transcoding MUST preserve frame count and timestamps exactly so that `VideoFrame` placement and
the timeline's `_currentframe`-based video logic keep working.

**AST-R037** Default target is **H.264 (High profile, yuv420p, `+faststart`) in MP4**, with an
optional VP9/WebM or AV1/MP4 additional variant under `target: 'modern'`. Alpha video MUST be
composited into a *paired* stream technique (side-by-side alpha or a chroma-key encode) because
H.264/VP9 alpha is not universally supported; the runtime MUST handle the chosen technique
transparently (`AST-D04`).

**AST-R038** Transcode settings MUST be recorded (`EncodeReport`) and MUST be quality-bounded: the
build MUST check SSIM/PSNR against the decoded source and warn (`SF0249`, owned by `IMPL-110`) when a frame's SSIM falls
below 0.98 — evidence of over-aggressive settings on the source's characteristic content (old Flash
video is heavily compressed; a second lossy generation shows immediately).

**AST-R039** Frame timing MUST come from the SWF's `VideoFrame` sequence and the timeline's frame
rate: the compiler MUST compute, for each video frame, the timeline frame index it is shown on, and
emit a `videoFrames` table. Players must not rely on timestamps in the container to place frames.

**AST-R040** Audio embedded in `DefineVideoStream` (audio is a separate stream sound in AVM1 videos)
MUST be reconstructed by the AUD pipeline and played in sync with the video by the runtime
(RT-§5.5); the manifest MUST link them (`video.audio: "stream_<id>"`, `video.frameTableId`).

**AST-R041** Seeking: the runtime MUST support `NetStream`-like behaviour only to the extent AS2 games
use it (`attachVideo`, `NetStream.play`/`pause`/`seek`); see RT-§7.3. The manifest MUST include
keyframe indices per second so `seek` is an index lookup, not a full scan.

### 5.2 Poster and first frame

**AST-R042** Every video MUST have a poster frame (the first `VideoFrame`) emitted as a compressed
texture so that a paused or not-yet-playing video renders correctly on frame 1 (Flash shows
the current frame, which for a stopped stream is the first decoded frame).

## 6. Manifest

`forge.manifest.json` is the runtime's complete declarative view of the game. Schema:

```jsonc
{
  "$schema": "https://swf-forge.dev/schema/manifest-1.json",
  "schemaVersion": 1,
  "tool": { "name": "swf-forge", "version": "0.1.0", "configHash": "…" },
  "movie": {
    "file": "game.swf", "sha256": "…",
    "stage": { "widthPx": 550, "heightPx": 400, "widthTwips": 11000, "heightTwips": 8000 },
    "frameRate": 24, "frameCount": 240,
    "background": 16711680,
    "scaleMode": "showAll", "align": "center",
    "metadata": { /* SWF MetaData/XMP, if any */ }
  },
  "textures": {
    "sprite_42": {
      "atlas": "ui_0", "rect": [0, 0, 32, 32], "originTwips": [-160, -160],
      "format": "uastc", "smoothing": true, "scale9": null
    }
  },
  "atlases": {
    "ui_0": {
      "size": [2048, 2048],
      "variants": [
        { "format": "ktx2-etc2", "file": "assets/tex/ab12….ktx2", "bytes": 1048576, "sha256": "…" },
        { "format": "ktx2-astc", "file": "assets/tex/cd34….ktx2", "bytes": 2097152, "sha256": "…" }
      ],
      "mips": 12
    }
  },
  "gradients": {
    "grad_7": { "kind": "linear", "stops": [[0,16711680,255],[255,255,255,255]],
                "spread": "pad", "interpolation": "srgb", "ramp": "assets/ramp/g7.ktx2" }
  },
  "fonts": {
    "font_3": {
      "family": "forge_3", "unitsPerEm": 20480, "ascent": 1600, "descent": 400, "leading": 0,
      "woff2": "assets/font/font_3.woff2",
      "atlases": [
        { "sizePx": 12, "scale": 2, "a8": "assets/font/font_3_12_2.ktx2",
          "glyphs": { "65": { "rect": [0,0,8,10], "advance": 8.4 } } }
      ],
      "substitution": { "requested": "Arial", "used": "forge_sub_inter", "fidelity": "F4" }
    }
  },
  "sounds": {
    "sound_12": {
      "kind": "event", "frameCount": 22050, "sampleRate": 48000, "channels": 2,
      "loop": { "start": 0, "end": 22050 },
      "variants": [
        { "codec": "opus", "container": "webm", "file": "assets/aud/9f3c21a0b7d4e8f1.webm",
          "bytes": 12345, "sha256": "…", "codecDelayFrames": 312, "endPaddingFrames": 96 }
      ]
    },
    "stream_intro": {
      "kind": "stream", "frameCount": 4320000, "sampleRate": 48000, "channels": 2,
      "frameTable": { "kind": "rle", "fps": 24, "data": "…" },
      "chunks": [ { "startFrame": 0, "file": "assets/aud/chunk_0.webm", "sha256": "…" } ]
    }
  },
  "videos": {
    "video_5": { "file": "assets/vid/4c8e02b6a1d95f37.mp4", "size": [320, 240], "frameCount": 300,
                 "alpha": false, "keyframesMs": [0, 2000, 4000],
                 "poster": "video_5_poster", "audio": "stream_6" }
  },
  "binary": { "data_9": { "file": "assets/bin/70b1ae44c9d3f206.bin", "sha256": "…", "bytes": 4096 } },
  "streams": { "main": { "frameTable": "…", "sound": "stream_intro" } },
  "budgets": { "textureBytes": 12345678, "audioBytes": 2345678, "totalBytes": 34567890 }
}
```

**AST-R043** The manifest MUST be JSON with **sorted keys**, integer arrays compacted when
`--manifest=compact` (default: pretty with 2-space indent for diffability), and no absolute paths.

**AST-R044** Every entry MUST be loadable independently: no entry may require parsing another asset's
bytes to be understood. This is what makes lazy loading, integrity checking, and budget reporting
possible.

**AST-R045** The runtime MUST validate `schemaVersion` and fail fast with an actionable error when it
is newer than the runtime understands (RT-§4.5).

## 7. Archive (`.sfa`)

**AST-R046** An optional single-file container (`forge.sfa`) MAY be produced for offline/embedded
distribution:

```
header:   magic "SFA1", version u16, flags u16, entryCount u32, tocOffset u64, tocLength u64
toc:      entries sorted by path; each: { path (utf8, len-prefixed), offset u64, length u64,
                                           sha256[32], kind u8, compression u8 }
payload:  per-entry data; compression ∈ {none, deflate, brotli}
```

**AST-R047** The archive MUST be streamable: the TOC is at the end (like ZIP), and the runtime MUST
be able to serve individual entries via `Range` requests so that a large archive does not need to be
downloaded whole. Per-file distribution (AST-R002) stays the default because HTTP/2 + CDN caching is
usually better; the archive exists for single-artifact delivery (USB sticks, kiosks, itch-style
uploads).

**AST-R048** The archive MUST NOT be a compression layer for *uncompressed* asset formats the browser
already compresses (Opus/AAC/JXL/WebP are already compressed); `deflate` there is wasted CPU.
The packer MUST apply per-kind policy (AST-§7 table) and record it in the TOC.

## 8. Budgets and reporting

| Budget | Target (desktop) | Target (mobile) | Enforced |
| --- | --- | --- | --- |
| Total transferred bytes (first playable) | ≤ 8 MB | ≤ 5 MB | report + warn |
| Total transferred bytes (all assets) | ≤ 60 MB | ≤ 40 MB | `SF0501` warning |
| Texture memory | ≤ 256 MB | ≤ 128 MB | boot check |
| Atlas pages | ≤ 64 | ≤ 32 | `SF0502` info |
| Font atlases | ≤ 8 per font | ≤ 4 per font | warn |
| Manifest size | ≤ 512 KB (compressed) | — | warn |
| Video bytes per minute | ≤ 8 MB (H.264, 480p) | ≤ 5 MB | warn |

**AST-R049** `reports/budgets.json` MUST include per-class byte totals, the largest 20 assets, and an
estimate of the *first-playable* set (assets referenced by frame 1 and by the main timeline's first N
frames, N = `--first-playable-frames`, default 30).

## 9. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| T-AST-001 | JPEG2 with merged `JPEGTables` decodes identically to a direct JPEG decode | F1 |
| T-AST-002 | JPEG3 alpha composition (no premultiplication, no fringes) | F1 |
| T-AST-003 | Lossless2 ARGB4444 un-premultiply round-trip | F1 |
| T-AST-004 | Lossless row padding boundaries | F1 |
| T-AST-005 | Atlas determinism: identical bytes across two builds | F1 |
| T-AST-006 | Edge bleed present on every atlas sprite (no halo fixture) | F3 |
| T-AST-007 | Lossless path used for UI/pixel-art content (`AST-D02`) | F2 |
| T-AST-008 | Font metrics match authored advance table exactly (no derived metrics mixed in) | F2 |
| T-AST-009 | Static text glyph positions match the SWF's placement matrices | F2 |
| T-AST-010 | Dynamic text with unrestricted field includes the full code table | F1 |
| T-AST-011 | BitmapData draw/fillRect dirty-flag upload (one upload per frame max) | F1 |
| T-AST-012 | Archive: TOC sorted, hashes match, range-served entries correct | F1 |
| T-AST-020 | MSDF vs bitmap atlas comparison at 1× and 4× | F3 |
| T-AST-021 | Video: frame count/timestamps preserved; SSIM ≥ 0.98 | F3 |
| T-AST-022 | Screen Video v2 (`CodecID = 6`): decodes with a per-packet palette and the Appendix C fallback (`AST-D11`) | F2 |

## 10. Decision register

| ID | Decision | Default | Verification | Notes |
| --- | --- | --- | --- | --- |
| AST-D01 | Colour-space handling of bitmaps | Preserve authored sRGB values; blend in sRGB space | T-GFX-031 | Linear-space blending changes every translucent sprite |
| AST-D02 | Lossless sources: which formats get lossless encoding | UI, text, pixel art → lossless; photographic → lossy | T-AST-007 | ETC1S destroys thin lines |
| AST-D03 | Atlas page grouping policy | By usage class (static/UI/particles/8-bit) | T-AST-005 | Balances eviction and draw calls |
| AST-D04 | Alpha video technique | Side-by-side alpha in H.264; chroma-key for very small clips | T-AST-021 | Alpha codecs unsupported broadly |
| AST-D05 | Default video target | H.264 High, CRF 20, `faststart` | T-AST-021 | Conservative for old sources |
| AST-D06 | WOFF2 upem normalisation | 2048 for CFF/TTF output | T-AST-008 | Must not double-scale metrics |
| AST-D07 | MSDF enabled by default? | Off; bitmap atlases + WOFF2 fallback | T-AST-020 | MSDF adds a shader path and ~40% size |
| AST-D08 | `--manifest=compact` default | Pretty (diffable) | — | Compact in release builds |
| AST-D09 | `DefineBinaryData` shipped verbatim (no re-compression) | Yes, verbatim + optional deflate wrapper | T-AST-012 | Games read these bytes at runtime |
| AST-D10 | BitmapData CPU mirror | Off by default; enabled per-game by config |
| AST-D11 | Screen Video v2 (`CodecID = 6`, omitted by the tag's own `CodecID` table) | Accept and decode natively; per-packet palette, Appendix C fallback | T-AST-022 | Errata `E-021`; stream dropped only if the packet itself is malformed | AST-R019 | Avoids slow readbacks in the common case |

## 11. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | First draft |
| 1.1 | 2026-10-04 | Ch.8-grounded: `DefineBitsLossless2` documents formats 3 and 5 only (the v1.0 "format 4 = ARGB4444 premultiplied" line was wrong — premultiplication is the format-5 `ALPHABITMAPDATA` rule and palettes are not premultiplied), palette size = `BitmapColorTableSize + 1`, row padding by pixel unit, JPEG3/4 alpha must inflate to `Width x Height` and needs a JPEG payload, `AlphaDataOffset` is a byte count, `JPEGTables` is single-per-file, plus new `AST-R035` (JPEG reassembly, the erroneous `FFD9 FFD8` prefix, `DeblockParam` recorded-not-applied); errata `E-014` |
| 1.2 | 2026-10-04 | Diagnostic citations re-pointed to the owning implementation docs: video SSIM `SF0220` -> `SF0249` (`IMPL-110`), byte budget `SF0230` -> `SF0501` and atlas pages `SF0231` -> `SF0502` (`IMPL-120`; the codes previously named are taken by `IMPL-080` font conditions); errata `E-016` |
| 1.3 | 2026-10-04 | Ch.14 ripple: decision `AST-D11` (Screen Video v2 accepted although the tag's `CodecID` table omits it; per-packet palette with the Appendix C fallback) and test `T-AST-022` added for `IMPL-110` §4.3 |
