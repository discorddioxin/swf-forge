# IMPL-110 — Video: Embedded Codecs and Transcoded Delivery

**Doc ID:** IMPL-110 · **Status:** ✅ grounded in Ch.14 · **Package:** `@swf-forge/swf` + `@swf-forge/assets`
**Format spec:** Chapter 14 — Video (`DefineVideoStream`, `VideoFrame`, the codec ids and what each
packet contains, Sorenson H.263, Screen Video, Screen Video v2, On2 VP6/VP6-alpha, deblocking and
smoothing flags) and Appendix C (the default Screen Video v2 palette)
**Design specs:** AST-§3.3/§5 (video assets, transcode quality gate), CMP-§4.9 (video pipeline),
RT-§10 (video playback), SEC-§5 (codec licensing), MS-§3 (external tools)
**Pinned byte layouts:** APP-§10.12 (Ch.14 structures + the palette table).

---

## 1. Deliverables

1. `DefineVideoStream` (60, SWF 6+) and `VideoFrame` (61) into a `VideoStreamModel`:
   `NumFrames` = the number of `VideoFrame` tags that make up the stream, `Width`/`Height` = the size
   the stream is *placed* at, the deblocking level and smoothing flag, and the codec id.
2. Codec dispatch, with the chapter's ids and the one gap in the chapter's own tables:

| `CodecID` | Codec | Min SWF | Our path |
| --- | --- | --- | --- |
| 2 | Sorenson H.263 (Spark) | 6 | **Build-time transcode** (external tool) → VP9/AV1/WebM, H.264/MP4 fallback |
| 3 | Screen Video (zlib blocks) | 7 | **Native TS decoder** → lossless frames (WebP/PNG or VP9 lossless) |
| 4 | On2 VP6 | 8 | **Build-time transcode** |
| 5 | On2 VP6 with alpha | 8 | **Build-time transcode**, alpha preserved from the second stream |
| 6 | Screen Video v2 | 8 | Native TS decoder (15/7-bit colours, palettes, diff blocks) — **accepted although `DefineVideoStream`'s `CodecID` table omits it** (`SF0290`, errata `E-021`) |
| 0, 1, 7–255 | unknown | — | `SF0240` (error): stream dropped, the timeline keeps its length |

3. Frame association: `VideoFrame` tags are attached to the SWF frames they fall in, and each carries
   its own `FrameNum`; the model produces both the *availability* index (which coded frames exist) and
   the *display* index (what the placement's `Ratio` selects per SWF frame) — §3.
4. Screen Video v1 and v2 decoders with the chapter's block/grid rules, including the default palette
   (Appendix C, §6) and the 15/7-bit colour decode.
5. A transcode driver with pinned, byte-deterministic arguments and provenance for H.263/VP6.
6. Emission: one seekable container per stream, keyframe interval ≤ 1 s, **no audio muxed in**, alpha
   preserved or explicitly dropped.
7. Runtime contract data for doc 130: per-stream display index, smoothing, and the policy-blocked
   autoplay retry.
8. Diagnostics and tests for every malformed shape the chapter makes possible (grids that exceed the
   image, palettes that arrive mid-stream, alpha streams that are missing, frames that never arrive).

**Non-goals:** implementing H.263 or VP6 decoders in TypeScript (they are large and patent-encumbered,
the browser cannot decode them, and the design spec already chose external transcoding, AST-R036), and
FLV containers (the same packet structures appear in FLV's `VIDEODATA`, so the native decoders are
reusable if a future phase accepts `.flv` input; the SWF path never sees an FLV).

## 2. Module layout

```
packages/swf/src/video/
  define-video-stream.ts   DefineVideoStream (60): flags, codec id, declared size
  video-frame.ts           VideoFrame (61): FrameNum ordering, duplicate/overrun checks
  video-model.ts           VideoStreamModel, availability + display indices, codec routing
packages/assets/src/video/
  transcode.ts             external-tool driver (ffmpeg), pinned args, provenance
  format.ts                codec-id dispatch and packet header validation (H.263/VP6/Screen*)
  screenvideo1.ts          Screen Video (v1) block decoder
  screenvideo2.ts          Screen Video v2 decoder (palette, 15/7-bit, diff/prime blocks)
  palette.ts               Appendix C default palette + palette application
  alpha.ts                 VP6-alpha stream pair handling
  emit.ts                  frame sequence → WebM/MP4 (+ display index); mux mtime = 0
  verify.ts                decode-the-output check (frame count, duration, dimensions, alpha)
```

**IMPL-110-R001** The transcoder is an **external tool dependency** (ffmpeg), declared in REPO-§3's
tool table and probed at build start: missing tool → `SF0241` (error) naming the codec and the affected
streams, with the rest of the build continuing. A build that cannot transcode video MUST still produce
a playable game wherever possible; the missing stream is reported in `porting-notes.json`.
**IMPL-110-R002** Transcode invocations MUST pin every parameter that affects output (fixed
GOP/bitrate/quality policy from the manifest profile, frame-timing handling, `-map_metadata -1`,
`-fflags +bitexact`, zeroed container mtime). Two builds of the same input MUST produce byte-identical
video output (REPO-R016).
**IMPL-110-R003** Codec licensing is a first-class report item: the manifest's video entries record the
source codec, the output codec, and the tool version, and SEC-§5's notes are surfaced in the licensing
report (upstream H.263/VP6 material carries its own considerations; the *output* codec choice is ours).

## 3. Stream structure, frames, and display (normative)

```
DefineVideoStream (60, SWF 6+):
  CharacterID UI16
  NumFrames   UI16      // number of VideoFrame tags that make up this stream
  Width       UI16      // size the stream is PLACED at (stage pixels)
  Height      UI16
  VideoFlagsReserved  UB[4] = 0
  VideoFlagsDeblocking UB[3]   // 000 = use the VIDEOPACKET value; 001 = off; 010 = Level 1 (fast);
                               // 011 = Level 2 (VP6 only); 100 = Level 3 (VP6 only);
                               // 101 = Level 4 (VP6 only); 110/111 = reserved
  VideoFlagsSmoothing  UB[1]   // 0 = smoothing off (faster); 1 = smoothing on (higher quality)
  CodecID     UI8

VideoFrame (61):
  StreamID  UI16
  FrameNum  UI16        // sequence number of this frame WITHIN its stream
  VideoData             // dispatch by the stream's CodecID:
                        //   2 → H263VIDEOPACKET        3 → SCREENVIDEOPACKET
                        //   4 → VP6SWFVIDEOPACKET      5 → VP6SWFALPHAVIDEOPACKET
                        //   6 → SCREENV2VIDEOPACKET
```

- **IMPL-110-R004** A `VideoFrame` tag **sets data for a frame number; it does not display anything by
  itself**. Display is driven by the placement's `Ratio` field (`PlaceObject2`/`PlaceObject3`), whose
  value is the video frame number. The model therefore exposes `frameAt(swfFrame)` = the `FrameNum`
  selected by the placement in that SWF frame, distinct from `hasFrame(frameNum)` = whether a
  `VideoFrame` with that number was seen (`T-MOD-914`).
- **IMPL-110-R005** Timing is the **movie's frame rate only**: every timing mechanism inside the video
  payload is ignored. The emitted media is built to the enclosing timeline's frame boundaries, with
  repeated frames materialised, and the `frameToSource` index is the source of truth (not the container
  timestamps).
- **IMPL-110-R006** `NumFrames` is the count of `VideoFrame` tags for the stream; a mismatch with the
  number actually present is `SF0242` (warning), extra frames are kept, and missing frame numbers are
  *freezes* (the previous decoded frame is displayed) rather than gaps (`SF0248`, info).
- **IMPL-110-R007** `FrameNum`s MUST be non-decreasing within a stream; a duplicate or backwards
  `FrameNum` is `SF0294` (warning) and the first occurrence wins.
- **IMPL-110-R008** `Width`/`Height` are the *placement* size: if the coded frame's own dimensions
  differ (H.263 `PictureSize`, Screen Video grid, VP6 stream header), the frame is scaled to
  `Width`×`Height` at playback, and `SF0243` (warning) records the difference. `VideoFlagsSmoothing`
  selects the scaling filter (nearest vs linear), not whether to scale.
- **IMPL-110-R009** `VideoFlagsDeblocking` is the stream's deblocking level, with the packet-level
  H.263 `DeblockingFlag` as the fallback when the stream level is `000`. Our decode path
  (external transcoder or native decoder) does not implement codec-side deblocking: the level is
  recorded in the manifest (`SF0244`, info) and passed to the transcoder as a documented hint only.
- **IMPL-110-R010** Video in a SWF is **streamed**: frames are stored in the SWF frames they are
  temporally associated with, and Flash may begin playback before the whole stream has arrived. Our
  build reconstructs the whole stream (`NumFrames` known from the tag), but the *association* is
  preserved: a `VideoFrame` in a SWF frame is available only from that frame onward, and a placement
  asking for a not-yet-available frame shows the last available one (`SF0247` counts overruns past the
  sprite's last frame at build time).
- **IMPL-110-R011** Video tags inside sprites are legal (Ch.13's tag list predates them; the video
  chapter assumes sprite placement) — decoding and association are identical, and the display index is
  per enclosing timeline.

## 4. The codecs (what each packet guarantees)

### 4.1 Sorenson H.263 (`CodecID` 2)

The format is H.263v1 (May-1996 draft) with the GOB layer removed and these feature deltas: no
split-screen/document-camera indicators, no picture-freeze release, no syntax-based arithmetic coding,
no PB frames, no continuous-presence multipoint, no overlapped block motion compensation; **added**:
disposable frames, arbitrary width/height up to 65535 px, always-on unrestricted motion vectors, and an
advisory deblocking flag. Two format versions: 0 = block layer identical to H.263; 1 = transform
coefficient escape codes encoded differently (a format bit after the `0000 011` escape chooses 7- or
11-bit LEVEL tables).

```
H263VIDEOPACKET:
  PictureStartCode   UB[17]   // 0000 0000 0000 0000 1
  Version            UB[5]    // 0 or 1
  TemporalReference  UB[8]
  PictureSize        UB[3]    // 000 custom (UB[8] w/h), 001 custom (UB[16] w/h),
                              // 010 CIF 352x288, 011 QCIF 176x144, 100 SQCIF 128x96,
                              // 101 320x240, 110 160x120, 111 reserved
  CustomWidth/Height          // note: UB[16] is a 16-bit BIG-ENDIAN bit field, NOT a UI16 —
                              // there is no byte swapping
  PictureType        UB[2]    // 00 intra, 01 inter, 10 disposable inter, 11 reserved
  DeblockingFlag     UB[1]    // advisory
  Quantizer          UB[5]
  ExtraInformationFlag UB[1], ExtraInformation UB[8] … repeated while the flag is 1
  … macroblock/block layers per H.263 §5.3/§5.4
```

- **IMPL-110-R012** Our reader validates the packet header (start code, version, size table, custom
  dimensions, the bit-field `UB[16]` rule) and hands the payload to the transcoder unchanged. A header
  that does not parse is `SF0292` (warning) and the frame is skipped; the decoder never guesses a size.
- **IMPL-110-R013** Disposable frames (`PictureType = 10`) MAY be dropped when a later frame supersedes
  them (`SF0297`, info, with the count per stream); they are never used as references.

### 4.2 Screen Video (`CodecID` 3, SWF 7+)

Lossless sequential bitmaps with blocked interframing, zlib-compressed per block.

```
SCREENVIDEOPACKET:
  BlockWidth  UB[4]     // (actualWidth / 16) - 1  → 16…256, multiples of 16
  ImageWidth  UB[12]
  BlockHeight UB[4]     // (actualHeight / 16) - 1 → 16…256
  ImageHeight UB[12]
  ImageBlocks IMAGEBLOCK[]

IMAGEBLOCK:
  DataSize UB[16]       // UB[16], not UI16 — no byte swapping
  Data     UI8[DataSize] // zlib; pixels bottom-left → top-right, row-major, 3 bytes B,G,R
                         // DataSize = 0 → block unchanged since the previous frame (Data absent)
```

- **IMPL-110-R014** The block grid is fixed for a given (image, block) size: `ceil(width / blockWidth)`
  columns × `ceil(height / blockHeight)` rows, ordered **bottom-left to top-right in rows**, with the
  right/bottom edge blocks partial. Partial blocks must be decoded with implicit knowledge of their
  real width/height — the pixels are *not* padded to the nominal block size (`T-MOD-910`).
- **IMPL-110-R015** `DataSize = 0` keeps the previous block image (inter-frame); block size may only
  change at a keyframe. A block whose zlib stream fails to inflate, or whose decoded pixel count does
  not match the block's rectangle, is `SF0245` (error) and the frame falls back to the previous frame
  (`T-MOD-905`).

### 4.3 Screen Video v2 (`CodecID` 6, FP 8+)

Keyblocks and interblocks, a 24-bit or 15/7-bit hybrid colour space, per-packet palettes, zlib priming
and row-range diff blocks.

```
SCREENV2VIDEOPACKET:
  BlockWidth/ImageWidth/BlockHeight/ImageHeight   // as v1
  Reserved      UB[6] = 0
  HasIFrameImage UB[1]
  HasPaletteInfo UB[1]
  PaletteInfo   IMAGEBLOCK        // if HasPaletteInfo: a v1 IMAGEBLOCK carrying the palette
  ImageBlocks   IMAGEBLOCKV2[]    // keyblocks and interblocks combined
  IFrameImage   IMAGEBLOCKV2[]    // if HasIFrameImage: interblocks to combine with the last keyframe

IMAGEBLOCKV2:
  DataSize UB[16]                 // covers Format + ImageBlockHeader + Data
  Format   IMAGEFORMAT
  ImageBlockHeader                // IMAGEDIFFPOSITION if HasDiffBlocks,
                                  // IMAGEPRIMEPOSITION if ZlibPrimeCompressCurrent
  Data     UI8[…]

IMAGEFORMAT:
  Reserved UB[3]  ColorDepth UB[2]  // 00 = 24-bit RGB; 10 = 15/7-bit hybrid; 01/11 reserved
  HasDiffBlocks UB[1]               // data covers a row range, not the whole block
  ZlibPrimeCompressCurrent  UB[1]
  ZlibPrimeCompressPrevious UB[1]

IMAGEDIFFPOSITION:  RowStart UI8, Height UI8      // first scan line + contiguous row count
IMAGEPRIMEPOSITION: BlockColumn UI8, BlockRow UI8 // the priming source block
```

- **IMPL-110-R016** Palettes are **per packet, not per block**: a v2 packet may define a new palette at
  any time, transmitted as a *v1* `IMAGEBLOCK`; in the absence of a stream-defined palette the decoder
  uses Appendix C's 128-entry default (§6). A palette block that is malformed or has the wrong size
  falls back to the previous (or default) palette with `SF0291` (warning) (`T-MOD-901`).
- **IMPL-110-R017** The 15/7-bit colour space is a **byte stream of mixed 1- and 2-byte pixels**: a byte
  with its high bit set introduces a 15-bit colour (clear the bit, take the next byte, form
  `(low7 << 8) | next`, expand 5-5-5 to RGB); a byte with the high bit clear is a 7-bit palette index.
  A decoder that assumes fixed 3-byte pixels passes its own fixtures and fails on real screen captures
  (`T-MOD-911`).
- **IMPL-110-R018** `HasDiffBlocks` data covers `IMAGEDIFFPOSITION.RowStart … +Height` scan lines of the
  block; a range outside the block is `SF0291`-class (frame falls back, `T-MOD-912`).
- **IMPL-110-R019** Zlib priming: when `ZlibPrimeCompressCurrent` is set, `IMAGEPRIMEPOSITION` names the
  block used as the zlib dictionary; when the named block is unavailable (first frame, changed grid) the
  decoder MUST fall back to a non-primed inflate and report `SF0291` (warning), never fail the frame.
  `ZlibPrimeCompressPrevious` describes the *previous* block's compression and is metadata for the
  decoder's dictionary handling.

### 4.4 On2 VP6 and VP6 with alpha (`CodecID` 4/5)

VP6 is a motion-compensated, DCT-based codec with context-adaptive entropy coding; Flash Player 8+
decodes it. Colour is BT.601 YCbCr 4:2:2, 8-bit unsigned. The alpha variant (`CodecID` 5) is **two VP6
streams**: the colour stream plus a second stream whose luma carries alpha with `U = V = 0`.

```
VP6SWFVIDEOPACKET:       Data UI8[n]                       // raw VP6 frame
VP6SWFALPHAVIDEOPACKET:  OffsetToAlpha UI24,
                         Data UI8[OffsetToAlpha],          // colour stream
                         AlphaData UI8[n]                  // alpha stream
```

- **IMPL-110-R020** The alpha decode follows the chapter: with the colour stream's `Y1, U1, V1` and the
  alpha stream's `Y2`, the result is **premultiplied ARGB** —
  `R = MIN(Y2, SATURATE(1.164(Y1-16) + 1.596(V1-128)))`, `G = MIN(Y2, SATURATE(1.164(Y1-16) - 0.813(V1-128) - 0.391(U1-128)))`,
  `B = MIN(Y2, SATURATE(1.164(Y1-16) + 2.018(U1-128)))`, `A = Y2`; `U2`/`V2` are unused. Premultiplied
  values MUST be un-premultiplied before emission (the same canonical-straight-alpha rule as doc 070),
  and `Y2` is sampled per pixel, not per chroma pair (`T-MOD-915`).
- **IMPL-110-R021** `OffsetToAlpha` is a byte offset from the start of the packet's `Data` field to the
  alpha stream. A value of 0, a value past the tag end, or a missing `AlphaData` is `SF0293` (warning):
  the colour stream still decodes and the alpha channel is dropped with the manifest flag set
  (`SF0246` names the drop for reporting).
- **IMPL-110-R022** The encoder-side keyframe rule (each key frame of the colour stream forces a key
  frame in the alpha stream, so the pair stays seekable) is a *producer* obligation; our transcoder MUST
  verify it before cutting the output (both streams must have key frames at the same timestamps —
  otherwise the transcode is rejected and reported, not silently desynchronised), `T-MOD-915`.
- **IMPL-110-R023** The `VP6FLV*` packet variants (with the 4-bit horizontal/vertical adjustments) are
  FLV-only; if the FLV path is ever added, the adjustments crop the coded frame to the stage size. The
  SWF path never sees them.

## 5. Emission and runtime contract

```ts
export interface VideoAsset {
  readonly id: string;                        // video_<streamId>
  readonly streamId: number;
  readonly sourceCodec: 'h263' | 'screenVideo' | 'vp6' | 'vp6alpha' | 'screenVideo2' | 'unknown';
  readonly output: { url: string; container: 'webm' | 'mp4'; codec: 'vp9' | 'av1' | 'h264'; sizeBytes: number };
  readonly width: number; readonly height: number;        // the stream's declared placement size
  readonly codedWidth: number; readonly codedHeight: number;
  readonly frameRate: number;                             // the movie's rate
  readonly frameCount: number;
  readonly frameToSource: readonly number[];              // SWF frame -> coded frame number (or -1 = freeze)
  readonly hasAlpha: boolean;
  readonly smoothing: boolean;
  readonly deblocking: number;                            // 0..5 as decoded (see §3)
  readonly provenance: { tool: string; toolVersion: string; argsHash: string; transcoded: boolean };
}
```

- **IMPL-110-R024** One seekable file per stream with a keyframe interval ≤ 1 s, and **no audio muxed
  in** — a SWF's audio is a separate stream in the SWF timeline (AUD-§7), and muxing two independently
  produced assets desynchronises them.
- **IMPL-110-R025** Alpha-capable sources (VP6-with-alpha) MUST be emitted with alpha (VP9+alpha in
  WebM, or AV1 with alpha, or an explicit frame+mask pair) or reported (`SF0246`, manifest
  `alphaDropped: true`). Silently flattening alpha onto black is a rendering bug in 8-bit content.
- **IMPL-110-R026** Output MUST be verified by decoding it back: container parses, frame count and
  dimensions match, alpha present when declared, and a spot-check decode of the first and last frames
  via the platform decoder in CI (`T-MOD-902`).
- **IMPL-110-R027** The runtime maps the timeline frame to a media position through `frameToSource`
  only (seek-then-play for large jumps, same-position for repeats), MUST NOT autoplay on load (browser
  policy), and MUST retry a policy-blocked play on the first user gesture (RT-R058) with the failure
  counted in the divergence report.
- **IMPL-110-R028** Streams that could not be produced (missing transcoder, unsupported codec) render
  nothing and are counted once per stream (`SF0240`/`SF0241` at build time; a runtime counter in the
  divergence report).

## 6. Appendix C — default Screen Video v2 palette

128 entries, `0x00rrggbb`, used when a v2 packet has no valid palette (verbatim transcription;
provenance note in `palette.ts`). Index = palette slot.

```
0x00000000, 0x00333333, 0x00666666, 0x00999999, 0x00CCCCCC, 0x00FFFFFF, 0x00330000, 0x00660000,
0x00990000, 0x00CC0000, 0x00FF0000, 0x00003300, 0x00006600, 0x00009900, 0x0000CC00, 0x0000FF00,
0x00000033, 0x00000066, 0x00000099, 0x000000CC, 0x000000FF, 0x00333300, 0x00666600, 0x00999900,
0x00CCCC00, 0x00FFFF00, 0x00003333, 0x00006666, 0x00009999, 0x0000CCCC, 0x0000FFFF, 0x00330033,
0x00660066, 0x00990099, 0x00CC00CC, 0x00FF00FF, 0x00FFFF33, 0x00FFFF66, 0x00FFFF99, 0x00FFFFCC,
0x00FF33FF, 0x00FF66FF, 0x00FF99FF, 0x00FFCCFF, 0x0033FFFF, 0x0066FFFF, 0x0099FFFF, 0x00CCFFFF,
0x00CCCC33, 0x00CCCC66, 0x00CCCC99, 0x00CCCCFF, 0x00CC33CC, 0x00CC66CC, 0x00CC99CC, 0x00CCFFCC,
0x0033CCCC, 0x0066CCCC, 0x0099CCCC, 0x00FFCCCC, 0x00999933, 0x00999966, 0x009999CC, 0x009999FF,
0x00993399, 0x00996699, 0x0099CC99, 0x0099FF99, 0x00339999, 0x00669999, 0x00CC9999, 0x00FF9999,
0x00666633, 0x00666699, 0x006666CC, 0x006666FF, 0x00663366, 0x00669966, 0x0066CC66, 0x0066FF66,
0x00336666, 0x00996666, 0x00CC6666, 0x00FF6666, 0x00333366, 0x00333399, 0x003333CC, 0x003333FF,
0x00336633, 0x00339933, 0x0033CC33, 0x0033FF33, 0x00663333, 0x00993333, 0x00CC3333, 0x00FF3333,
0x00003366, 0x00336600, 0x00660033, 0x00006633, 0x00330066, 0x00663300, 0x00336699, 0x00669933,
0x00993366, 0x00339966, 0x00663399, 0x00996633, 0x006699CC, 0x0099CC66, 0x00CC6699, 0x0066CC99,
0x009966CC, 0x00CC9966, 0x0099CCFF, 0x00CCFF99, 0x00FF99CC, 0x0099FFCC, 0x00CC99FF, 0x00FFCC99,
0x00111111, 0x00222222, 0x00444444, 0x00555555, 0x00AAAAAA, 0x00BBBBBB, 0x00DDDDDD, 0x00EEEEEE,
```

- **IMPL-110-R029** `palette.ts` MUST ship this table as a frozen constant with the citation, and
  `T-MOD-911` MUST assert **all 128 entries**, in appendix order, against the Appendix C transcription
  (with the first/last/mid-table landmark values kept as readable spot checks) so neither a
  transcription typo nor a permutation can hide. 15-bit colours are expanded `r5 << 3 | r5 >> 2` per channel (the
  chapter's conversion), not by a fitted curve.

## 7. Diagnostics

Codes `SF0240`–`SF0249` are this document's primary block; the Screen Video v2 additions take
`SF0290`–`SF0299` (errata `E-021`; `IMPL-010` §7).

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0240` | error | unknown/unsupported `CodecID`; stream dropped |
| `SF0241` | error | transcoder unavailable (codec named, build continues) |
| `SF0242` | warning | `VideoFrame` count disagrees with `NumFrames` |
| `SF0243` | warning | coded frame dimensions differ from the stream's declared size |
| `SF0244` | info | deblocking level recorded, not applied by our decode path |
| `SF0245` | error | Screen Video block ill-formed (zlib failure or wrong pixel count); previous frame retained |
| `SF0246` | warning | alpha channel dropped for an alpha-capable source |
| `SF0247` | warning | frame data arrives after the enclosing timeline ended (display index clamps) |
| `SF0248` | info | repeated frames materialised in the display index |
| `SF0249` | warning | transcoded quality below the configured SSIM threshold (design `AST-§3.3`) |
| `SF0290` | info | `CodecID = 6` (Screen Video v2) accepted although `DefineVideoStream`'s table omits it (`E-021`) |
| `SF0291` | warning | Screen Video v2 anomaly: palette block, diff range, or zlib priming fallback |
| `SF0292` | warning | H.263 packet header invalid (start code/size/version); frame skipped |
| `SF0293` | warning | VP6-alpha stream missing or `OffsetToAlpha` out of range; colour stream only |
| `SF0294` | warning | duplicate or non-monotonic `FrameNum` within a stream |
| `SF0295`–`SF0299` | — | reserved for the video block |

## 8. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| `T-MOD-901` | Screen Video v2 palette update mid-stream (v1 `IMAGEBLOCK`) + default-palette fallback | F1 |
| `T-MOD-902` | transcode verification: output decodes, frame count/dimensions/alpha match | F2 |
| `T-MOD-903` | display index: contiguous frames, missing frames (freeze), overrun frames | F1 |
| `T-MOD-904` | determinism: two transcodes produce identical bytes (all pinned flags) | F1 |
| `T-MOD-905` | Screen Video hostile block headers/zlib failures rejected, previous frame retained | F1 |
| `T-MOD-906` | alpha preservation (VP6-alpha source, premultiplied → straight) | F2 |
| `T-MOD-907` | coded-vs-declared dimensions: scale + smoothing filter selection recorded | F2 |
| `T-MOD-908` | missing-ffmpeg path: streams reported, build still succeeds | F1 |
| `T-MOD-909` | H.263 packet header: version, size table incl. both custom forms, `UB[16]` ≠ `UI16`, disposable frames | F1 |
| `T-MOD-910` | Screen Video v1: grid math, partial edge blocks, BGR order, unchanged block (`DataSize 0`) | F1 |
| `T-MOD-911` | Screen Video v2 15/7-bit stream (mixed 1-/2-byte pixels); all 128 palette entries equal Appendix C in appendix order (`T-TST-104`) | F1 |
| `T-MOD-912` | Screen Video v2 diff blocks (row ranges) and zlib priming incl. the non-primed fallback | F1 |
| `T-MOD-913` | `CodecID` dispatch: 2/3/4/5/6, `SF0290` for 6, `SF0240` for 0/1/7+ | F1 |
| `T-MOD-914` | `Ratio`-driven display vs `FrameNum` availability (incl. duplicate/non-monotonic) | F1 |
| `T-MOD-915` | VP6-alpha: `OffsetToAlpha` bounds, dual-stream decode with `MIN` clamp, keyframe pairing | F2 |
| `T-MOD-916` | deblocking level + smoothing flag round-trip into the manifest | F1 |

## 9. Work packages

| WP | Title | Depends | Est | Deliverable |
| --- | --- | --- | --- | --- |
| WP-110-01 | `DefineVideoStream` + `VideoFrame` + display/availability indices | WP-020-05 | 4 | `video/*`, T-MOD-903/914 |
| WP-110-02 | Transcoder driver + pinned args + provenance | WP-110-01, REPO tooling | 3 | `transcode.ts` |
| WP-110-03 | Determinism hardening (`-fflags +bitexact`, mtime=0, args hash) | WP-110-02 | 2 | T-MOD-904 |
| WP-110-04 | Screen Video v1 native decoder (grid, partial blocks, BGR) | WP-110-01 | 4 | `screenvideo1.ts`, T-MOD-910 |
| WP-110-05 | Screen Video v2 decoder (palette, 15/7-bit, diff/prime blocks) | WP-110-01 | 5 | `screenvideo2.ts`, `palette.ts`, T-MOD-901/911/912 |
| WP-110-06 | Packet-header validation for H.263/VP6 (+ alpha pairing) | WP-110-01 | 3 | `format.ts`, `alpha.ts`, T-MOD-909/915 |
| WP-110-07 | Emission: WebM/MP4 + display index + alpha handling | WP-110-02, WP-110-06 | 4 | `emit.ts`, T-MOD-906 |
| WP-110-08 | Output verification step | WP-110-07 | 2 | `verify.ts`, T-MOD-902 |
| WP-110-09 | Runtime contract (`frameToSource` seek/play, policy-blocked retry) | WP-110-07, RT | 3 | RT-R058 wiring |
| WP-110-10 | Licensing/attribution report entries | WP-110-02 | 1 | SEC-§5 integration |
| WP-110-11 | Video corpus: synthetic streams per codec + App C palette fixture | WP-110-05 | 3 | CI fixtures, `inspect --video`, T-MOD-916 |
| | **Total** | | **34** | |

## 10. Open items

| # | Item | Impact |
| --- | --- | --- |
| 1 | Whether Flash applies `VideoFlagsDeblocking` on playback or only consults the H.263 packet flag — the chapter calls both "suggestions" | low (`SF0244`) |
| 2 | Screen Video v2 `ColorDepth = 01/11`: reserved in the chapter; real files? (fixtures so far show 00/10 only) | low (`SF0291`) |
| 3 | The exact zlib dictionary length used by Flash's priming implementation (the chapter names the source block, not the window size) — pinned by decoding a stream produced by the reference authoring tool | medium (`SF0291`) |
| 4 | Whether a palette `IMAGEBLOCK` is also affected by zlib priming | low |
| 5 | VP6 profile/version constraints (the chapter describes the format, not the required profile) — the transcoder must accept what Flash-authored files contain | medium |
| 6 | Screen Video v2 `IFrameImage` interaction with the *next* packet when packets are dropped from the timeline (frame-skipping titles) | medium (`SF0247`/`SF0248`) |

The v1.0 open items (tag layouts, `FrameNum` role, Screen Video block layout, palette encoding,
deblocking/smoothing semantics, alpha definition) are **settled** — see §3–§6 and APP-§10.12.

## 11. Done criteria

1. All five codecs route correctly; unknown ids fail with `SF0240`, and the `CodecID = 6` gap is
   handled without a warning storm.
2. Deterministic transcodes (byte-identical across runs and machines with the pinned ffmpeg).
3. Display index accurate for freeze/overrun/duplicate-`FrameNum` fixtures, verified against a
   reference playthrough (drift ≤ 1 frame, TST-§7).
4. Native Screen Video decoders reproduce reference frames bit-exactly on the corpus (v1 24-bit, v2
   24-bit, v2 15/7-bit, diff, primed).
5. Every stream's provenance (source codec, tool version, args hash) appears in the manifest and the
   licensing report.

## 12. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Scoped from Ch.14 + App C; frame/palette layouts marked pending with a config gate |
| 1.1 | 2026-10-04 | `SF0249` added for the quality gate the design spec used to cite as `SF0220` (a font code); errata `E-016` |
| 1.2 | 2026-10-04 | Ch.14-grounded rewrite: `DefineVideoStream` flags/codec table with the **`CodecID = 6` gap** (`SF0290`); `VideoFrame` is `FrameNum`-addressed and display is `Ratio`-driven, with timing from the movie's frame rate only (replaces v1.0's "order encountered" model); two indices (availability + display); H.263 packet headers, the Sorenson feature deltas and the `UB[16]` ≠ `UI16` rule; Screen Video v1 grid/partial-block/BGR/unchanged-block rules; **Screen Video v2 corrected** (per-*packet* palettes via a v1 `IMAGEBLOCK`, 15/7-bit mixed 1-/2-byte pixel stream, diff blocks, zlib priming and its fallback) replacing v1.0's "per-block palettes" model; VP6/VP6-alpha with the chapter's premultiplied-ARGB decode, `OffsetToAlpha` validation and the keyframe-pairing rule; Appendix C's 128-entry palette transcribed; diagnostics `SF0290`–`SF0294`; tests `T-MOD-909`–`916`; WPs 01–11 = 34 d |
| 1.3 | 2026-10-04 | Appendix pass: the palette obligation is upgraded from spot values to an order-sensitive 128-entry comparison against Appendix C (`T-MOD-911`, cited as `T-TST-104`) |
