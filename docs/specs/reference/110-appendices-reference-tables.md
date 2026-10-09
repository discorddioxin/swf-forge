# APP — Reference Tables

**Doc ID:** APP · **Status:** Draft 1.8 · **Normative:** the tables are; the notes are guidance.

---

## 1. How to use this appendix

This appendix consolidates the constants, enumerations, and tables that several specs refer to. When
a table here disagrees with an upstream source, **the upstream source wins** and this table has a bug:
file an issue. Numbers are stated as *facts* (ids, codes, equations); no text from upstream documents
is reproduced (SEC-§7).

## 2. SWF tag table (AVM1 era) and swf-forge disposition

Disposition legend:
`P` parse and model · `C` compile into emitted data/code · `T` transcode to a web format ·
`I` ignore with an `info` diagnostic · `E` error (unsupported, blocking) · `X` obsolete, ignore.

| Tag | Name | Disposition | Notes |
| --- | --- | --- | --- |
| 0 | End | P | |
| 1 | ShowFrame | C | Timeline frame boundary |
| 2 | DefineShape | C | → Vector IR |
| 4 | PlaceObject | C | Implicit replace semantics (CMP-R006) |
| 5 | RemoveObject | C | |
| 6 | DefineBits | T | JPEG using shared `JPEGTables` |
| 7 | DefineButton | C | AS1 button (no conditions) |
| 8 | JPEGTables | T | Merged into tag 6 images |
| 9 | SetBackgroundColor | C | Stage background |
| 10 | DefineFont | C | 1024 upem (SWF-R038) |
| 11 | DefineText | C | Baked into glyph quads |
| 12 | DoAction | C | AVM1 action block |
| 13 | DefineFontInfo | C | Code→glyph mapping, encoding hints |
| 14 | DefineSound | T | → Opus/AAC/MP3 |
| 15 | StartSound | C | `SOUNDINFO` semantics (AUD-§6.1) |
| 17 | DefineButtonSound | C | Per-state button sounds |
| 18 | SoundStreamHead | C/T | ADPCM-only streams |
| 19 | SoundStreamBlock | C/T | Per-frame stream data (AUD-§6.2) |
| 20 | DefineBitsLossless | T | zlib bitmaps |
| 21 | DefineBitsJPEG2 | T | JPEG/PNG/GIF sniffing |
| 22 | DefineShape2 | C | |
| 23 | DefineButtonCxform | C | |
| 24 | Protect | I | Ignored (no effect in compiled output) |
| 26 | PlaceObject2 | C | |
| 28 | RemoveObject2 | C | |
| 32 | DefineShape3 | C | RGBA fills/lines |
| 33 | DefineText2 | C | Alpha text |
| 34 | DefineButton2 | C | Button conditions (AVM1-§10.2) |
| 35 | DefineBitsJPEG3 | T | JPEG + zlib alpha |
| 36 | DefineBitsLossless2 | T | ARGB lossless |
| 37 | DefineEditText | C | Dynamic/input text (declarative) |
| 39 | DefineSprite | C | Nested timeline |
| 43 | FrameLabel | C | Label→frame map |
| 45 | SoundStreamHead2 | C/T | Full codec set |
| 46 | DefineMorphShape | C | Ratio interpolation (SWF-R034) |
| 48 | DefineFont2 | C | Layout tables, wide codes |
| 56 | ExportAssets | C | Linkage ids |
| 57 | ImportAssets | I | Cross-movie import; resolved at compile time or `SF0150` |
| 58 | EnableDebugger | I | |
| 59 | DoInitAction | C | Runs once, before frame actions |
| 60 | DefineVideoStream | T | Codec ids 2–6 (AST-§5.1) |
| 61 | VideoFrame | C/T | Timeline placement table |
| 62 | DefineFontInfo2 | C | 16-bit codes, language |
| 64 | EnableDebugger2 | I | |
| 65 | ScriptLimits | C | Max recursion/time; must be honoured or replaced with our budget (AVM1-R073) |
| 66 | SetTabIndex | C | Focus order (RT-R042) |
| 69 | FileAttributes | P | AS3/network flags; AS3 ⇒ error `SF1000` |
| 70 | PlaceObject3 | C | Filters, blend mode, class name, cache-as-bitmap |
| 71 | ImportAssets2 | I | As 57 |
| 73 | DefineFontAlignZones | I | Hinting zones; not needed for our rasteriser |
| 74 | CSMTextSettings | C | Text engine flags; mapped to our layout (documented) |
| 75 | DefineFont3 | C | 20480 upem |
| 76 | SymbolClass | C | For AVM1: export mapping; AVM2 ⇒ error |
| 77 | Metadata | C | → `movie.metadata` |
| 78 | DefineScalingGrid | C | 9-slice (GFX-§8.3) |
| 82 | DoABC | E | AVM2 ⇒ `SF1000` (exit 3) |
| 83 | DefineShape4 | C | Winding rule, non-scaling strokes |
| 84 | DefineMorphShape2 | C | |
| 86 | DefineSceneAndFrameLabelData | C | Scene collapse (AVM1-D04) |
| 87 | DefineBinaryData | P | Shipped verbatim (SEC-R003) |
| 88 | DefineFontName | I | Licence/name metadata for fonts |
| 89 | StartSound2 | C | AS3-era sound class reference; mapped or ignored |
| 90 | DefineBitsJPEG4 | T | JPEG + alpha + deblock |
| 91 | DefineFont4 | C | CFF outlines or device font |
| 93 | EnableTelemetry | I | |
| other | unknown | I | Skipped by length; `info` `SF0104` |

**Appendix B check (2026-10-04).** This table was compared against Appendix B entry by entry: the
**65 codes and names it lists match exactly**. The codes Appendix B omits — 3, 16, 25, 27, 29–31, 38,
40–42, 44, 47, 49–55, 63, 67, 68, 72, 79–81, 85, 92 and everything above 93 — are **unassigned**: they
take the `other → unknown` rule (skip by length with `SF0104`), and **no name may be invented for
them** (errata `E-025` removed six such names this table used to carry). Appendix B is the authority
for tag *values*; the chapters remain the authority for tag *bodies*.

**APP-R001** Unknown tags MUST NOT block a build; a tag that is known-but-unsupported and *affects
rendering or logic* MUST produce an `error` or `warning` rather than an `info`
(disposition `E`/`I` above is normative for the listed tags).

## 3. AVM1 action opcode table

`S` = stack effect (in → out) where the chapter states it. Codes not listed below are undefined
(including everything ≥ 0xA0) and MUST produce `SF0402` plus residual marking; the two
observed-but-undocumented opcodes (`0x89` `StrictMode`, `0x2D` `FsCommand2`) are listed in
`IMPL-050` §4.4 and are decoded with inert semantics.

| Code | Name | S | Notes |
| --- | --- | --- | --- |
| 0x00 | End | — | Terminates an action block |
| 0x01–0x03 | — | — | Undefined; residual |
| 0x04 | NextFrame | — | |
| 0x05 | PreviousFrame | — | |
| 0x06 | Play | — | |
| 0x07 | Stop | — | |
| 0x08 | ToggleQuality | — | Maps to renderer quality (GFX-R007) |
| 0x09 | StopSounds | — | Master-gain path (AUD-R074) |
| 0x0A | Add | 2→1 | String if LHS string, else numeric (AVM1-R024) |
| 0x0B | Subtract | 2→1 | |
| 0x0C | Multiply | 2→1 | |
| 0x0D | Divide | 2→1 | |
| 0x0E | Equals | 2→1 | `==` semantics |
| 0x0F | Less | 2→1 | Differs from `Less2` for strings |
| 0x10 | And | 2→1 | |
| 0x11 | Or | 2→1 | |
| 0x12 | Not | 1→1 | |
| 0x13 | StringEquals | 2→1 | |
| 0x14 | StringLength | 1→1 | |
| 0x15 | StringExtract | 3→1 | |
| 0x17 | Pop | 1→0 | |
| 0x18 | ToInteger | 1→1 | |
| 0x1C | GetVariable | 1→1 | Scope-chain lookup |
| 0x1D | SetVariable | 2→0 | |
| 0x20 | SetTarget2 | 1→0 | Block-splitting (AVM1-R034) |
| 0x21 | StringAdd | 2→1 | Forced concat |
| 0x22 | GetProperty | 2→1 | Property ids in APP-§4 |
| 0x23 | SetProperty | 3→0 | |
| 0x24 | CloneSprite | 3→0 | |
| 0x25 | RemoveSprite | 1→0 | |
| 0x26 | Trace | 1→0 | Routes to the shell's trace sink |
| 0x27 | StartDrag | 3→0 (7→0 constrained) | Pops target, lockcenter, constrain, then y2,x2,y1,x1 |
| 0x28 | EndDrag | 0→0 | |
| 0x29 | StringLess | 2→1 | |
| 0x2A | Throw | 1→0 | |
| 0x2B | CastOp | 2→1 | |
| 0x2C | ImplementsOp | 2+k→0 | Pops constructor, count, interfaces; no result |
| 0x2D | FsCommand2 | — | Mostly inert; mapped table (RT-§7) |
| 0x30 | RandomNumber | 1→1 | Uses the runtime RNG (AVM1-D06) |
| 0x31 | MBStringLength | 1→1 | |
| 0x32 | CharToASCII | 1→1 | |
| 0x33 | ASCIIToChar | 1→1 | |
| 0x34 | GetTime | 0→1 | Monotonic ms (AVM1-R008) |
| 0x35 | MBStringExtract | 3→1 | |
| 0x36 | MBCharToASCII | 1→1 | |
| 0x37 | MBASCIIToChar | 1→1 | |
| 0x3A | Delete | 1→0 | |
| 0x3B | Delete2 | 1→0 | |
| 0x3C | DefineLocal | 2→0 | |
| 0x3D | CallFunction | n+2→1 | Pops name, numArgs, then args; reverse-push order |
| 0x3E | Return | 1→0 | |
| 0x3F | Modulo | 2→1 | |
| 0x40 | NewObject | n+2→1 | Pops name, numArgs, then args |
| 0x41 | DefineLocal2 | 1→0 | |
| 0x42 | InitArray | n+1→1 | Pops count, then elements |
| 0x43 | InitObject | 2n+1→1 | Pops count, then (value, name) pairs |
| 0x44 | TypeOf | 1→1 | Returns `"movieclip"` for clips |
| 0x45 | TargetPath | 1→1 | |
| 0x46 | Enumerate | 1→k+1 | Pushes `null` then slot names; order undefined (AVM1-R045) |
| 0x47 | Add2 | 2→1 | `+` semantics |
| 0x48 | Less2 | 2→1 | |
| 0x49 | Equals2 | 2→1 | `==` |
| 0x4A | ToNumber | 1→1 | |
| 0x4B | ToString | 1→1 | Uses AVM1 formatting (AVM1-§5.3) |
| 0x4C | PushDuplicate | 1→2 | |
| 0x4D | StackSwap | 2→2 | |
| 0x4E | GetMember | 2→1 | |
| 0x4F | SetMember | 3→0 | |
| 0x50 | Increment | 1→1 | |
| 0x51 | Decrement | 1→1 | |
| 0x52 | CallMethod | n+3→1 | Pops name, object, numArgs, then args |
| 0x53 | NewMethod | n+3→1 | As CallMethod, constructing |
| 0x54 | InstanceOf | 2→1 | |
| 0x55 | Enumerate2 | 1→k+1 | As Enumerate, object operand |
| 0x60 | BitAnd | 2→1 | |
| 0x61 | BitOr | 2→1 | |
| 0x62 | BitXor | 2→1 | |
| 0x63 | BitLShift | 2→1 | |
| 0x64 | BitRShift | 2→1 | |
| 0x65 | BitURShift | 2→1 | |
| 0x66 | StrictEquals | 2→1 | `===` |
| 0x67 | Greater | 2→1 | |
| 0x68 | StringGreater | 2→1 | |
| 0x69 | Extends | 2→0 | AS2 `class B extends A`; no result |
| 0x81 | GotoFrame | — | UI16 frame, absolute |
| 0x83 | GetURL | — | Two string operands |
| 0x87 | StoreRegister | 1→1 | UI8 register index; reads WITHOUT popping |
| 0x88 | ConstantPool | — | UI16 count + strings |
| 0x89 | StrictMode | — | Toggles AS2 strict mode |
| 0x8A | WaitForFrame | — | Skip-count + frame |
| 0x8B | SetTarget | — | String target (block-splitting) |
| 0x8C | GotoLabel | — | Label string |
| 0x8D | WaitForFrame2 | 1→0 | Skip-count + dynamic frame |
| 0x8E | DefineFunction2 | 0→1 | Registers, preloads, suppression |
| 0x8F | Try | — | Catch/finally offsets, register save |
| 0x94 | With | 1→0 | Size UI16 body; depth cap 8 (SWF 5) / 16 (SWF 6+) |
| 0x96 | Push | n→n+k | Type bytes 0–9 (AVM1-R013) |
| 0x99 | Jump | — | SI16 relative |
| 0x9A | GetUrl2 | 2→0 | `METHOD`/`TARGET` flags |
| 0x9B | DefineFunction | 0→1 | Name, params, body |
| 0x9D | If | 1→0 | |
| 0x9E | Call | 1→0 | Executes a frame's actions by label, then resumes |
| 0x9F | GotoFrame2 | 1→0 | Play flag, scene offset |

**APP-R002** Payload layouts, flag bit positions, and the exact operand types are taken from the SWF
specification's action tables; the pinned layouts are §10.3. The table above exists to enumerate and
classify, not to replace it. `S` counts stack operands popped -> pushed, so `n+x→1` means `x`
operands besides the `n` arguments.

## 4. MovieClip property ids (`GetProperty`/`SetProperty`)

| Id | Property | Id | Property |
| --- | --- | --- | --- |
| 0 | `_x` | 11 | `_target` |
| 1 | `_y` | 12 | `_framesloaded` |
| 2 | `_xscale` | 13 | `_name` |
| 3 | `_yscale` | 14 | `_droptarget` |
| 4 | `_currentframe` | 15 | `_url` |
| 5 | `_totalframes` | 16 | `_highquality` |
| 6 | `_alpha` | 17 | `_focusrect` |
| 7 | `_visible` | 18 | `_soundbuftime` |
| 8 | `_width` | 19 | `_quality` (SWF 5+) |
| 9 | `_height` | 20 | `_xmouse` (SWF 5+) |
| 10 | `_rotation` | 21 | `_ymouse` (SWF 5+) |

**APP-R003** Values 22+ are undefined; a get returns `undefined` and a set is a no-op with a one-time
`SF0440` (warning).

## 5. Depth ranges (AVM1)

| Range | Use |
| --- | --- |
| −16384 | Reserved: content beneath all authoring content |
| −16383 … −1 | Author-time content (library placements) |
| 0 … 1048575 | Dynamic content (`attachMovie`, `createEmptyMovieClip`, …) |
| 1048575, −16383 | Sometimes reserved by component frameworks (DepthManager) |

**APP-R004** `getNextHighestDepth()` semantics are specified in AVM1-R057; the table exists so that
implementations do not invent different bounds.

## 6. Blend modes (`PlaceObject3`, `DisplayObject.blendMode`)

| Value | Mode | Value | Mode |
| --- | --- | --- | --- |
| 0, 1 | normal | 8 | add |
| 2 | layer | 9 | subtract |
| 3 | multiply | 10 | invert |
| 4 | screen | 11 | alpha |
| 5 | lighten | 12 | erase |
| 6 | darken | 13 | overlay |
| 7 | difference | 14 | hardlight |

Values 15–255 are reserved. Implementation matrix and formulas: GFX-§10.1.

## 7. Filter ids (`PlaceObject3` `SurfaceFilterList`)

| Id | Filter | Id | Filter |
| --- | --- | --- | --- |
| 0 | DropShadow | 4 | GradientGlow |
| 1 | Blur | 5 | Convolution |
| 2 | Glow | 6 | ColorMatrix |
| 3 | Bevel | 7 | GradientBevel |

Note the ordering trap: `Convolution` is 5 and `ColorMatrix` is 6 (some third-party references swap
them). Implementation rules: GFX-§11.

## 8. Sound format and rate codes

| `SoundFormat` | Meaning | | `SoundRate` | Hz |
| --- | --- | --- | --- | --- |
| 0 | Uncompressed (platform endian) | | 0 | 5512 (5512.5 truncated) |
| 1 | ADPCM | | 1 | 11025 |
| 2 | MP3 | | 2 | 22050 |
| 3 | Uncompressed little-endian | | 3 | 44100 |
| 4 | Nellymoser 16 kHz | | | |
| 5 | Nellymoser 8 kHz | | | |
| 6 | Nellymoser | | | |
| 11 | Speex | | | |

`SoundSize`: 0 = 8-bit, 1 = 16-bit. `SoundType`: 0 = mono, 1 = stereo.
`SOUNDINFO` envelope `Pos44` is a `UI32` position in 44 100 Hz samples (not a 0…32767 grid); levels
are 0…32768, where 32768 = unity gain. `SoundSampleCount` counts per-channel samples (pairs, for stereo).

## 9. ADPCM quick reference

Framing (Ch.11, errata `E-018`): `AdpcmCodeSize UB[2]` — 2 bits at the **top of the first byte**,
once per sound and once per `SoundStreamBlock` — then packets back to back in a **continuous bit
stream with no byte alignment**. A packet is `22 bits/channel + 4095 codes/channel`:

```
mono    SI16 firstSample;  UB[6] firstIndex;  4095 codes
stereo  SI16 firstSampleL; UB[6] firstIndexL; SI16 firstSampleR; UB[6] firstIndexR;
        8190 codes, interleaved L,R
```

Codes are **sign-magnitude**: the top bit is the sign; the low `bits-1` bits are the magnitude that
indexes the tables (the chapter prints only the lower half; the upper half is its duplicate because
the sign is carried separately). Decoder state per channel: `prediction` (int16),
`stepIndex` (0…88), reset from each packet header.

```
step       = STEP_TABLE[stepIndex]                     // 89 entries (standard IMA step table)
m          = code & ((1 << (bits-1)) - 1)              // magnitude (sign stripped)
delta      = DELTA_FN[bits](step, m)                   // = ((2m + 1) · step) >> (bits - 1)
prediction = clampInt16(prediction ± delta)            // − when the sign bit is set
stepIndex  = clamp(stepIndex + INDEX_TABLE[bits][m], 0, 88)
```

`INDEX_TABLE` (verified, indexed by magnitude):

```
2 bits: {-1,  2}
3 bits: {-1, -1,  2,  4}
4 bits: {-1, -1, -1, -1,  2,  4,  6,  8}
5 bits: {-1, -1, -1, -1, -1, -1, -1, -1,  1,  2,  4,  6,  8, 10, 13, 16}
```

`MULT_TABLE`/`DELTA_FN` and `STEP_TABLE` are transcribed from the SWF specification into
`adpcm-tables.ts` (AUD-R005) with a provenance note; they MUST NOT be re-derived. Stereo interleaves
code pairs; each block in a *stream* restarts the predictors and re-reads the code size with its own
header (AUD-R007).

## 10. Structural quick reference

Sub-sections: §10.1 Ch.3 display-list structures · §10.2 Ch.4 control tags · §10.3 Ch.5 actions and
scripts · §10.4 Ch.6 shapes · §10.5 Ch.7 gradients · §10.6 Ch.8 bitmaps · §10.7 Ch.9 morph shapes ·
§10.8 Ch.10 fonts and text · §10.9 Ch.11 sounds. Each is the anchor cited by the corresponding
`IMPL-` document.

**SWF header:** `FWS|CWS|ZWS` (3) + version (1) + fileLength (UI32 LE) + `RECT` frame size (twips) +
frameRate (UI16, 8.8 fixed) + frameCount (UI16).

**Tag record header:** `UI16` = `(code << 6) | len`; if `len == 0x3F`, `UI32` long length follows.

**Units:** 1 px = 20 twips. Shape/stroke widths, matrices' translations, and text bounds are in twips;
matrix scale/rotate are 16.16 fixed.

**Colour transform:** `C' = clamp((C × Mult) / 256 + Add, 0, 255)`, multiply first (SWF-R021).

**Gradient square:** (−16384, −16384) … (16384, 16384) in shape units; ratio 0 → first stop position,
255 → last.

**Font resolution:** `DefineFont`/`DefineFont2` = 1024 units per em; `DefineFont3` = 20× (20480);
`DefineFont4` = CFF's own upem.

### 10.1 Display-list structures (Ch.3)

Pinned field orders for the structures the implementation specs reference by name (`IMPL-030-§…`). Bit
fields are listed in file order (MSB first inside each byte).

**`PlaceObject` (4):** `CharacterId UI16`, `Depth UI16`, `Matrix MATRIX`, then an optional
`ColorTransform` (`CXFORM`, *no* alpha) that is present iff the body extends past the matrix.
`CharacterId = 0` is tolerated as a move (documented deviation, errata `E-010`; never emitted by us).

**`PlaceObject2` (26)** — one flag byte, then fields in a *different* order than the flags:

| Flag byte, bit 7→0 | Field when set (in body order after the flags) |
| --- | --- |
| `HasClipActions` | `ClipActions CLIPACTIONS` (last field) |
| `HasClipDepth` | `ClipDepth UI16` |
| `HasName` | `Name STRING` |
| `HasRatio` | `Ratio UI16` |
| `HasColorTransform` | `ColorTransform CXFORMWITHALPHA` |
| `HasMatrix` | `Matrix MATRIX` |
| `HasCharacter` | `CharacterId UI16` |
| `Move` | — |

Body order: `Depth UI16` (always), `CharacterId`, `Matrix`, `ColorTransform`, `Ratio`, `Name`,
`ClipDepth`, `ClipActions`.

**`PlaceObject3` (70)** — a first flag byte identical to v2's, then:

| Second flag byte, bit 7→0 | Meaning |
| --- | --- |
| Reserved | must be 0 |
| `PlaceFlagOpaqueBackground` | `BackgroundColor RGBA` (read after `Visible`; see `E-008`) |
| `PlaceFlagHasVisible` | `Visible UI8` (0/1) |
| `PlaceFlagHasImage` | modifies how `ClassName`/`CharacterId` are read |
| `PlaceFlagHasClassName` | `ClassName STRING` |
| `PlaceFlagHasCacheAsBitmap` | `BitmapCache UI8` (0 = off, 1–255 = on) |
| `PlaceFlagHasBlendMode` | `BlendMode UI8` (§6) |
| `PlaceFlagHasFilterList` | `SurfaceFilterList FILTERLIST` |

Body order: `Depth`, `ClassName`, `CharacterId`, `Matrix`, `ColorTransform`, `Ratio`, `Name`,
`ClipDepth`, `SurfaceFilterList`, `BlendMode`, `BitmapCache`, `Visible`, `BackgroundColor`,
`ClipActions`. `ClassName` is present when `HasClassName`, **or** when `HasImage` **and**
`HasCharacter`. The chapter's field table ties `BackgroundColor` to `HasVisible`; the flag list and real
content tie it to `HasOpaqueBackground` (`E-008`).

**`RemoveObject` (5):** `CharacterId UI16`, `Depth UI16`. **`RemoveObject2` (28):** `Depth UI16`.
**`ShowFrame` (1):** empty body. **`DefineSprite` (39):** `SpriteID UI16`, `FrameCount UI16`, then
`CONTROL tags`; the sprite's stream must be terminated by `End` (0).

**`CLIPACTIONS`:** `Reserved UI16 = 0`, `AllEventFlags CLIPEVENTFLAGS`, `CLIPACTIONRECORD…`,
`ClipActionEndFlag` (`UI16` if SWF ≤ 5, `UI32` if SWF ≥ 6; must be 0).

**`CLIPACTIONRECORD`:** `EventFlags CLIPEVENTFLAGS`, `ActionRecordSize UI32` (bytes from the end of this
field to the next record or the end flag), `KeyCode UI8` iff `KeyPress`, then `ACTIONRECORD…`.

**`CLIPEVENTFLAGS`** — 2 bytes (SWF ≤ 5) or 4 bytes (SWF ≥ 6). Decode by reading the field little-endian
and testing masks; this is the same bit sequence the chapter lists MSB-first inside each byte:

| Event | Mask | Form | Event | Mask | Form |
| --- | --- | --- | --- | --- | --- |
| `Load` | `0x00000001` | both | `Data` | `0x00000100` | both |
| `EnterFrame` | `0x00000002` | both | `Initialize` | `0x00000200` | SWF 6+ |
| `Unload` | `0x00000004` | both | `Press` | `0x00000400` | SWF 6+ |
| `MouseMove` | `0x00000008` | both | `Release` | `0x00000800` | SWF 6+ |
| `MouseDown` | `0x00000010` | both | `ReleaseOutside` | `0x00001000` | SWF 6+ |
| `MouseUp` | `0x00000020` | both | `RollOver` | `0x00002000` | SWF 6+ |
| `KeyDown` | `0x00000040` | both | `RollOut` | `0x00004000` | SWF 6+ |
| `KeyUp` | `0x00000080` | both | `DragOver` | `0x00008000` | SWF 6+ |
| `DragOut` | `0x00010000` | SWF 6+ | `KeyPress` | `0x00020000` | SWF 6+ |
| `Construct` | `0x00040000` | SWF 7+ | Reserved | `0x0000FE00` (2-byte form), `0xFFF80000` (4-byte form) | must be 0 |

**`FILTERLIST` / `FILTER`:** `NumberOfFilters UI8`, then per filter a `FilterID UI8` (ids 0–7, §7)
followed by that filter's struct (field layouts, types and units: `IMPL-030` §5). An id outside 0–7 makes
the rest of the list undecodable — the struct carries no length prefix — so the remainder is kept raw and
reported (`SF0121`).

### 10.2 Control tag structures (Ch.4)

Pinned field orders for the control tags, referenced by `IMPL-040-§…`.

| Tag (code) | Body (file order) |
| --- | --- |
| `End` (0) | empty; last tag of the file **and** of every sprite |
| `SetBackgroundColor` (9) | `BackgroundColor RGB` |
| `Protect` (24) | empty, or a null-terminated `STRING` (MD5-crypt password; meaningful SWF 5+) |
| `FrameLabel` (43) | `Name STRING` + optional `Named Anchor flag UI8 = 1` (SWF 6+; present iff one byte follows the string) |
| `ExportAssets` (56) | `Count UI16` + (`Tag UI16`, `Name STRING`)… |
| `ImportAssets` (57) | `URL STRING` + `Count UI16` + (`Tag UI16`, `Name STRING`)…; SWF 5–7, ignored by Flash Player 8+ |
| `EnableDebugger` (58) | null-terminated `Password STRING`; SWF 5 only |
| `EnableDebugger2` (64) | `Reserved UI16 = 0` + null-terminated `Password STRING` |
| `ScriptLimits` (65) | `MaxRecursionDepth UI16`, `ScriptTimeoutSeconds UI16` |
| `SetTabIndex` (66) | `Depth UI16`, `TabIndex UI16` |
| `FileAttributes` (69) | 32 flag bits; see the mask table below |
| `ImportAssets2` (71) | `URL STRING`, `Reserved UI8 = 1`, `Reserved UI8 = 0`, `Count UI16`, (`Tag UI16`, `Name STRING`)… |
| `SymbolClass` (76) | `NumSymbols UI16` + (`Tag U16`, `Name STRING`)…; `Tag = 0` is the main-timeline root class |
| `Metadata` (77) | `Metadata STRING` (RDF/XMP, whitespace-stripped by the authoring tool) |
| `DefineScalingGrid` (78) | `CharacterId UI16`, `Splitter RECT` (each side ≥ 1 twip, else the tag is ignored) |
| `DefineSceneAndFrameLabelData` (86) | `SceneCount EncodedU32` + (`Offset EncodedU32`, `Name STRING`)… + `FrameLabelCount EncodedU32` + (`FrameNum EncodedU32`, `FrameLabel STRING`)…; offsets and frame numbers are zero-based and global to the symbol |

**`FileAttributes` masks.** The chapter lists `Reserved UB[1]`, `UseDirectBlit`, `UseGPU`,
`HasMetadata`, `ActionScript3`, `Reserved UB[2]`, `UseNetwork`, `Reserved UB[24]`; with Ch.1's
big-endian bit order inside bytes, the first eight fields are the tag body's **first byte**, so masks on
the little-endian-read `UI32` are:

| Field | Mask | Notes |
| --- | --- | --- |
| `UseNetwork` | `0x00000001` | local vs network file access for locally loaded SWFs |
| `Reserved` | `0x00000002`, `0x00000004` | must be 0 |
| `ActionScript3` | `0x00000008` | SWF 9+ |
| `HasMetadata` | `0x00000010` | biconditional with the `Metadata` tag |
| `UseGPU` | `0x00000020` | SWF 10+; browser equivalent `wmode="gpu"` |
| `UseDirectBlit` | `0x00000040` | SWF 10+; browser equivalent `wmode="direct"` |
| `Reserved` | `0x00000080` | must be 0; the last bit of the chapter's leading `Reserved` |
| `Reserved` | `0xFFFFFF00` | must be 0 (the trailing `UB[24]`) |

Reading the four bytes as a big-endian word, or rebuilding an integer MSB-first from the bit-field
sequence, both invert this table; only the little-endian masks above are sanctioned (`IMPL-040-R031/R032`).

### 10.3 Action structures (Ch.5)

Pinned layouts for the action model (`IMPL-050-§…`). Bit fields are in file order (MSB first inside
each byte); multi-byte fields are little-endian (Ch.1 §2.1).

```
ACTIONRECORDHEADER:
  ActionCode UI8                    // the high bit says whether a Length field follows
  if ActionCode >= 0x80: Length UI16   // payload byte count, EXCLUDING ActionCode and Length
  payload                           // layout per opcode (impl/050 §4)
DoAction:      ACTIONRECORDHEADER[] then a UI8 zero (End)
DoInitAction:  SpriteID UI16, ACTIONRECORDHEADER[], UI8 zero
```

**SWF version windows:** SWF 3 = control actions `0x00`–`0x09` (plus the 0x81+ control set);
SWF 4 = stack machine `0x0A`–`0x9F` core; SWF 5 = types/math/object/stack additions and the
`_quality`/`_xmouse`/`_ymouse` property ids; SWF 6 = `DoInitAction` (59) with `InstanceOf`,
`Enumerate2`, `StrictEquals`, `Greater`, `StringGreater`; SWF 7 = `DefineFunction2`, `Extends`,
`CastOp`, `ImplementsOp`, `Try`, `Throw`; SWF 9 = `DoABC` (and `DoAction` contents are ignored when
`FileAttributes` marks ActionScript3); SWF 10 = no action changes.

```
ActionPush: (Type UI8, value)[]; 0 string(NUL-terminated) · 1 float32 · 2 null · 3 undefined ·
  4 register UI8 · 5 boolean UI8 · 6 float64 · 7 integer UI32 · 8 pool index UI8 · 9 pool index UI16
ActionConstantPool: Count UI16, STRING[Count]     // replaces any prior pool at execution time
ActionWaitForFrame:  Frame UI16, SkipCount UI8    // record length 3, frame FIRST
ActionWaitForFrame2: SkipCount UI8                // record length 1
ActionGotoFrame: Frame UI16 (length 2)            ActionGotoLabel: Label STRING
ActionGetURL: UrlString STRING, TargetString STRING
ActionStoreRegister: RegisterNumber UI8           // reads the stack WITHOUT popping
ActionJump: SI16   ActionIf: SI16                 // offset relative to the END of the branch record
ActionWith: Size UI16 + body                      // depth cap 8 (SWF 5) / 16 (SWF 6+)
ActionGetURL2: flags UI8 (length 1)   ActionGotoFrame2: flags UI8 (length 1)
```

| Bit field | Bits | Meaning |
| --- | --- | --- |
| `SendVarsMethod` | `0xC0` | 0 none, 1 GET, 2 POST (`GetURL2`) |
| `Reserved` | `0x3C` | must be 0 |
| `LoadTargetFlag` | `0x02` | load into a sprite |
| `LoadVariablesFlag` | `0x01` | variables-from-server mode |
| `Reserved` (`GotoFrame2`) | `0xFC` | must be 0 |
| `SceneBiasFlag` | `0x02` | `SceneBias UI16` follows |
| `Play` | `0x01` | 1 = play, 0 = stop |

```
DefineFunction:    FunctionName STRING, NumParams UI16, ParamName STRING[NumParams],
                   CodeSize UI16, Code[CodeSize]
DefineFunction2:   FunctionName STRING, NumParams UI16, RegisterCount UI8,
                   Flags UI16 (bit order below), ParamName STRING[NumParams],
                   REGISTERPARAM[NumParams], CodeSize UI16, Code[CodeSize]
REGISTERPARAM:     Register UI8 (0 = create a named activation variable), ParamName STRING
Try:               Reserved UB[5], CatchInRegisterFlag UB[1], FinallyBlockFlag UB[1],
                   CatchBlockFlag UB[1]; TrySize UI16, CatchSize UI16, FinallySize UI16
                   (all three ALWAYS present); then CatchName STRING (register flag 0)
                   or CatchRegister UI8 (register flag 1); then the three bodies.
DoABC:             Flags UI32, Name STRING, ABCData[remaining bytes]   // kDoAbcLazyInitializeFlag = 1
```

| `DefineFunction2` flag | Mask | | Flag | Mask |
| --- | --- | --- | --- | --- |
| `PreloadParentFlag` | `0x0080` | | `SuppressThisFlag` | `0x0002` |
| `PreloadRootFlag` | `0x0040` | | `PreloadThisFlag` | `0x0001` |
| `SuppressSuperFlag` | `0x0020` | | `PreloadGlobalFlag` | `0x0100` |
| `PreloadSuperFlag` | `0x0010` | | `Reserved` | `0x7E00` |
| `SuppressArgumentsFlag` | `0x0008` | | | |
| `PreloadArgumentsFlag` | `0x0004` | | | |

Register allocation order: parameters into their `REGISTERPARAM` registers, then the preloaded
variables starting at register 1 in the order `this`, `arguments`, `super`, `_root`, `_parent`,
`_global` (skipping the ones not preloaded); remaining registers are locals. A parameter register inside
the preload range is overwritten by the preload (as the chapter states). The naive "first flag =
bit 15" reading inverts the eight leading flags — only the masks above are sanctioned
(`IMPL-050-R024`).

Property ids (`GetProperty`/`SetProperty`) are §4 above. Branch offsets are relative to the *end* of
the branch record (PC = the following action). A binary action's "value A" is the top of the stack.

### 10.4 Shape structures (Ch.6)

```
DefineShape  (2,  SWF 1): ShapeId UI16, ShapeBounds RECT, SHAPEWITHSTYLE (RGB)
DefineShape2 (22, SWF 2): as above, extended style counts allowed
DefineShape3 (32, SWF 3): as above, RGBA colours
DefineShape4 (83, SWF 8): ShapeId, ShapeBounds (strokes INCLUDED), EdgeBounds (edges only),
  Reserved UB[5], UsesFillWindingRule UB[1], UsesNonScalingStrokes UB[1],
  UsesScalingStrokes UB[1], SHAPEWITHSTYLE (RGBA, LINESTYLE2)

FILLSTYLEARRAY:  FillStyleCount UI8 (0xFF escape -> FillStyleCountExtended UI16, DefineShape2+ only),
                 FILLSTYLE[count]
LINESTYLEARRAY:  LineStyleCount UI8 (0xFF escape -> UI16, DefineShape2+ only), LINESTYLE[count]
                 (LINESTYLE2 when the tag is DefineShape4)
SHAPE:           NumFillBits UB[4], NumLineBits UB[4], SHAPERECORD[]        // font glyphs
SHAPEWITHSTYLE:  FillStyles, LineStyles, NumFillBits UB[4], NumLineBits UB[4], SHAPERECORD[]
```

| `FillStyleType` | Meaning | | `FillStyleType` | Meaning |
| --- | --- | --- | --- | --- |
| `0x00` | solid | | `0x41` | clipped bitmap |
| `0x10` | linear gradient | | `0x42` | repeating bitmap, non-smoothed |
| `0x12` | radial gradient | | `0x43` | clipped bitmap, non-smoothed |
| `0x13` | focal radial gradient | | | |
| `0x40` | repeating bitmap | | | |

`BitmapMatrix` maps bitmap space → shape space. Style arrays are **1-based**: index 0 means "no
style"; the first style written is index 1.

```
LINESTYLE:   Width UI16, colour (RGB or RGBA per tag)          // no caps/joins before SWF 8
LINESTYLE2:  Width UI16, StartCapStyle UB[2], JoinStyle UB[2], HasFillFlag UB[1],
             NoHScaleFlag UB[1], NoVScaleFlag UB[1], PixelHintingFlag UB[1], Reserved UB[5],
             NoClose UB[1], EndCapStyle UB[2],
             MiterLimitFactor UI16 (8.8 fixed, only when JoinStyle == 2),
             FILLSTYLE if HasFillFlag else colour
Caps: 0 round, 1 none, 2 square      Joins: 0 round, 1 bevel, 2 miter
Maximum miter length = MiterLimitFactor x Width; Width 0 = hairline (1 px)

SHAPERECORD (TypeFlag UB[1]):
  TypeFlag 0 + five UB[1] state flags (StateNewStyles, StateLineStyle, StateFillStyle1,
  StateFillStyle0, StateMoveTo) -> StyleChange, or EndOfShape when all six bits are 0
      MoveBits UB[5] + MoveDeltaX/MoveDeltaY SB[MoveBits] (StateMoveTo, relative to the shape
      origin), FillStyle0/FillStyle1 UB[NumFillBits], LineStyle UB[NumLineBits]; when
      StateNewStyles (Shape2/Shape3 only per the chapter): the record's own indices come FIRST,
      then the new style arrays and the new NumFillBits/NumLineBits
  TypeFlag 1 + StraightFlag UB[1], NumBits UB[4] (delta width = NumBits + 2):
      straight: GeneralLineFlag/VertLineFlag + 1 or 2 SB[NumBits+2] deltas
      curved:   ControlDeltaX, ControlDeltaY, AnchorDeltaX, AnchorDeltaY, ALL SB[NumBits+2]
```

Inside a `StyleChange`, move deltas are relative to the shape origin (the pen accumulates);
`NumBits` is 4 bits. Straight-edge flags are `GeneralLineFlag UB[1]`, `VertLineFlag UB[1]`.
Curved edges are **quadratic** Béziers; quadratic → cubic is exact via the 1/3 rule, cubic → quadratic
uses recursive subdivision. All initial style indices are 0; `FillStyle0` is the fill on the **left**
of the directed vector and `FillStyle1` the fill on the **right**; closed figures must be closed by an
explicit edge (there is no auto-close flag in the file). **There is no `NumEdges` field**: the record
list ends at the all-zero `End` record.

### 10.5 Gradient structures (Ch.7)

```
GRADIENT        (inside FILLSTYLE, FillStyleType 0x10 linear / 0x12 radial):
                SpreadMode UB[2], InterpolationMode UB[2], NumGradients UB[4],   // ONE flags byte
                GRADRECORD[NumGradients]
FOCALGRADIENT   (FillStyleType 0x13; DefineShape4 only): as GRADIENT plus
                FocalPoint FIXED8 (8.8 signed; -1.0 .. +1.0, 0x0100 = 1.0, 0xFF00 = -1.0)
GRADRECORD:     Ratio UI8, Color RGB (Shape1/Shape2) | RGBA (Shape3/Shape4)
```

- Spread modes: `0` pad, `1` reflect, `2` repeat, `3` reserved (we treat 3 as pad).
  Interpolation: `0` normal RGB, `1` linear RGB, `2`/`3` reserved.
- The **gradient square** is centred at `(0,0)` and spans `(-16384,-16384)` to `(16384,16384)`; the
  `MATRIX` stored in the `FILLSTYLE` maps it onto the display surface. The chapter's example: a linear
  gradient scaled to one eighth (`32768 / 4096 = 8`) and translated gives
  `| 0.125 0.000 | 0.000 0.125 | 2048.000 2048.000 |`.
- Control-point ratios are `0`–`255` and are **sorted ascending**; for a linear gradient `0` maps to the
  left side of the gradient square and `255` to the right side, for a radial gradient `0` maps to the
  centre and `255` to the largest circle inscribed in the square.
- DefineShape/2/3 may not exceed **8** control points; DefineShape4 allows up to **15**. The chapter
  requires `SpreadMode = 0` and `InterpolationMode = 0` for Shape1/2/3; files from later toolchains
  violate this and are honoured with a report (impl `SF0192`).

### 10.6 Bitmap structures (Ch.8)

```
DefineBits (6, SWF 1):    CharacterId UI16, ImageData (JPEG, SOI..EOI, tables from JPEGTables)
JPEGTables (8, SWF 1):    ImageData (the Tables/Misc segment, SOI..EOI) — at most ONE per file
DefineBitsJPEG2 (21):     CharacterId UI16, ImageData (JPEG | PNG | GIF89a; PNG/GIF need SWF 8+)
DefineBitsJPEG3 (35):     CharacterId UI16, AlphaDataOffset UI32, ImageData, BitmapAlphaData (zlib)
DefineBitsJPEG4 (90):     CharacterId UI16, AlphaDataOffset UI32, DeblockParam UI16, ImageData,
                          BitmapAlphaData (zlib)
DefineBitsLossless  (20): CharacterId UI16, BitmapFormat UI8 (3/4/5), Width UI16, Height UI16,
                          BitmapColorTableSize UI8 (format 3 only) = colours - 1, ZlibBitmapData
DefineBitsLossless2 (36): as above with RGBA tables / 32-bit ARGB (BitmapFormat 3 or 5)

COLORMAPDATA      : ColorTableRGB RGB[BitmapColorTableSize + 1], ColormapPixelData UI8[W*H]
ALPHACOLORMAPDATA : ColorTableRGB RGBA[BitmapColorTableSize + 1], ColormapPixelData UI8[W*H]
BITMAPDATA        : PIX15[W*H] (format 4) | PIX24[W*H] (format 5)
ALPHABITMAPDATA   : ARGB[W*H]  (Lossless2 format 5); RGB is PREMULTIPLIED by alpha
PIX15: Pix15Reserved UB[1] = 0, Pix15Red UB[5], Pix15Green UB[5], Pix15Blue UB[5]   // 2 bytes
PIX24: Pix24Reserved UI8 = 0, Pix24Red UI8, Pix24Green UI8, Pix24Blue UI8           // 4 bytes
```

- Non-JPEG pixel data is **row-major** ("reading like English text"), and every row is rounded up to the
  next **32-bit word** using the pixel structure's own size: 1 byte for indexed data, 2 for `PIX15`,
  4 for `PIX24`/ARGB. The chapter's example: a 253-pixel 8-bit row pads to 256 bytes.
- `AlphaDataOffset` is a **byte count**, not an offset; `BitmapAlphaData` is one byte per pixel and must
  inflate to exactly `Width x Height`. It is only supported when `ImageData` is a JPEG — PNG/GIF payloads
  carry their own alpha (GIF has none), so a trailing plane there is an error.
- `DeblockParam` is a `UI16` 8.8 fixed-point deblocking strength (0–100 %) applied to JPEG only;
  we record it and never apply it.
- JPEG payloads start at `FFD8` and end at `FFD9`; a pre-SWF 8 erroneous `FFD9 FFD8` prefix may precede
  the SOI. PNG magic is `89 50 4E 47 0D 0A 1A 0A`, GIF89a is `47 49 46 38 39 61`.

### 10.7 Morph-shape structures (Ch.9)

```
DefineMorphShape (46, SWF 3):
  CharacterId UI16, StartBounds RECT, EndBounds RECT, Offset UI32,
  MorphFillStyles MORPHFILLSTYLEARRAY, MorphLineStyles MORPHLINESTYLEARRAY,
  StartEdges SHAPE, EndEdges SHAPE

DefineMorphShape2 (84, SWF 8):
  CharacterId UI16, StartBounds RECT, EndBounds RECT, StartEdgeBounds RECT, EndEdgeBounds RECT,
  Reserved UB[6], UsesNonScalingStrokes UB[1], UsesScalingStrokes UB[1], Offset UI32,
  MorphFillStyles, MorphLineStyles, StartEdges SHAPE, EndEdges SHAPE

MORPHFILLSTYLE: type UI8 then per type —
  0x00 solid        : StartColor RGBA, EndColor RGBA
  0x10/0x12/0x13    : StartGradientMatrix MATRIX, EndGradientMatrix MATRIX, MORPHGRADIENT
                      (+ StartFocalPoint/EndFocalPoint FIXED8 for 0x13)
  0x40/0x41/0x42/0x43: BitmapId UI16, StartBitmapMatrix MATRIX, EndBitmapMatrix MATRIX
MORPHGRADIENT : SpreadMode UB[2], InterpolationMode UB[2], NumGradients UB[4] (1..8),
                MORPHGRADRECORD[]        // ONE byte total, identical to Ch.7 GRADIENT (E-028)
MORPHGRADRECORD: StartRatio UI8, StartColor RGBA, EndRatio UI8, EndColor RGBA
MORPHLINESTYLE  (v1): StartWidth UI16, EndWidth UI16, StartColor RGBA, EndColor RGBA
MORPHLINESTYLE2 (v2): StartWidth UI16, EndWidth UI16, ONE LINESTYLE2 flag word
                      (StartCapStyle, JoinStyle, HasFillFlag, NoHScaleFlag, NoVScaleFlag,
                       PixelHintingFlag, Reserved, NoClose, EndCapStyle),
                      MiterLimitFactor UI16 (8.8) iff JoinStyle == 2,
                      then StartColor+EndColor RGBA or one MORPHFILLSTYLE (HasFillFlag = 1)
```

- Both style arrays use the `0xFF` -> `UI16` extended-count escape and pair start/end **by index**;
  the model is 1-based with index 0 = no style.
- The two edge arrays are **independent SHAPE streams**: `StartEdges` carries the style-change records,
  `EndEdges` an 8-bit `NumFillBits`/`NumLineBits` header (writers emit zeros) followed by edges only.
  `Offset` is a hint to `EndEdges`, not the only way to find it; parsing must work from the shape
  records alone.
- The start and end shapes must have the **same edge count** and the **same style-change records**;
  morph styles must keep the same fill type and bitmap id per index.
- `PlaceObject2`/`PlaceObject3` `Ratio` drives the blend: `0` = start state, `65535` = end state.
- Straight edges paired with curved ones are both treated as curves (`control = delta / 2`,
  `anchor = delta / 2`), which is why the interpolation keeps rational twips until tessellation.

### 10.8 Font and text structures (Ch.10)

**Glyph space.** Glyphs are `SHAPE` records in EM-square font units — **1024** upem for
`DefineFont`/`DefineFont2`, **20480** for `DefineFont3` (20× resolution, so divide v3 deltas by 20 to
compare). A run's scale is `TextHeight / unitsPerEm` with `TextHeight` in twips (50 px = 1000).
TrueType→SWF conversion: negate y, scale to 1024, insert an on-curve anchor at the midpoint of every
pair of successive off-curve points.

**Font tags.**

| Tag | Code | Body (after `CharacterID`) |
| --- | --- | --- |
| `DefineFont` | 10 | `OffsetTable UI16[nGlyphs]` (byte offsets from the table's start), `GlyphShapeTable SHAPE[nGlyphs]`; `nGlyphs` inferred as `OffsetTable[0] / 2` |
| `DefineFontInfo` | 13 | `FontNameLen UI8`, `FontName UI8[len]`, flags byte (`Reserved UB[2]`, SmallText, ShiftJIS, ANSI, Italic, Bold, `WideCodes UB[1]`), `CodeTable UI8\|UI16[nGlyphs]` |
| `DefineFontInfo2` | 62 | as above + `LanguageCode LANGCODE` (SWF 6+), `WideCodes` always 1 |
| `DefineFont2` | 48 | flags byte MSB-first (`HasLayout, ShiftJIS, SmallText, ANSI, WideOffsets, WideCodes, Italic, Bold`), `LanguageCode`, `FontNameLen`/`FontName`, `NumGlyphs UI16`, `OffsetTable UI32\|UI16`, `CodeTableOffset UI32\|UI16` (from the start of `OffsetTable`), `GlyphShapeTable`, `CodeTable UI16` (UCS-2, SWF 6+); if `HasLayout`: `FontAscent UI16`, `FontDescent UI16`, `FontLeading SI16`, `FontAdvanceTable SI16[NumGlyphs]`, `FontBoundsTable RECT[NumGlyphs]`, `KerningCount UI16`, `KERNINGRECORD[KerningCount]` (`Code1 UI16`, `Code2 UI16`, `Adjustment SI16`) |
| `DefineFont3` | 75 | identical to `DefineFont2`; glyph coordinates ×20 |
| `DefineFont4` | 91 | flags (`Reserved UB[5]`, `HasFontData UB[1]`, `Italic UB[1]`, `Bold UB[1]`), `FontName STRING`, CFF data when `HasFontData` (needs `CFF `/`cmap`/`head`/`maxp`/`OS/2`/`post` + `hhea`+`hmtx` or `vhea`+`vmtx`+`VORG`; a Unicode `cmap` subtable) |
| `DefineFontName` | 88 | `FontName STRING`, `FontCopyright STRING` (SWF 9+) |
| `DefineFontAlignZones` | 73 | `CSMTableHint UB[2]` (0 thin/1 medium/2 thick) + `Reserved UB[6]`, `ZONERECORD[glyphCount]` = `NumZoneData UI8` (= 2) + `ZONEDATA[2]` + `Reserved UB[6]` + `ZoneMaskY UB[1]` + `ZoneMaskX UB[1]`; `ZONEDATA` = `AlignmentCoordinate FLOAT16`, `Range FLOAT16` |
| `CSMTextSettings` | 74 | `UseFlashType UB[2]` (0 normal/1 advanced) + `GridFit UB[3]` (0 none/1 pixel/2 sub-pixel) + `Reserved UB[3]`, `Thickness F32`, `Sharpness F32`, `Reserved UI8`; cutoffs `outside = (0.5·sharpness − thickness)·fontSize`, `inside = (−0.5·sharpness − thickness)·fontSize` |

**Rules:** `CodeTable` is sorted ascending and positionally mirrors the glyph table; SWF 6+ forces
UCS-2 codes and UTF-8 font names; `FontLeading` is signed; `FontBoundsTable` and kerning records are
unused by Flash ≤ 7 (present in the body all the same); `NumGlyphs = 0` omits every `NumGlyphs`-sized
table (a writer may still emit `CodeTableOffset`); every glyph's first `STYLECHANGERECORD` must set
`StateFillStyle0`/`FillStyle0 = 1` and must not use the line-style fields.

**`DefineText` (11) / `DefineText2` (33).** `TextBounds RECT`, `TextMatrix MATRIX`,
`GlyphBits UI8`, `AdvanceBits UI8`, then `TEXTRECORD`s and a terminating **zero byte**
(`EndOfRecordsFlag`). A record (byte-aligned, MSB-first):

| Bits | Field |
| --- | --- |
| `UB[1]` | `TextRecordType` = 1 |
| `UB[3]` | `StyleFlagsReserved` = 0 |
| `UB[1]` each | `HasFont`, `HasColor`, `HasYOffset`, `HasXOffset` |
| `UI16` if `HasFont` | `FontID` |
| `RGB`/`RGBA` if `HasColor` | `TextColor` (`DefineText2` is RGBA) |
| `SI16` if `HasXOffset` | `XOffset` (absolute from the left of `TextBounds`) |
| `SI16` if `HasYOffset` | `YOffset` (absolute from the top) |
| `UI16` if `HasFont` | `TextHeight` (twips) |
| `UI8` | `GlyphCount` |
| per glyph | `GlyphIndex UB[GlyphBits]`, `GlyphAdvance SB[AdvanceBits]` (signed) |

Field order after the flags is **`FontID`, colour, `XOffset`, `YOffset`, `TextHeight`** — X before Y,
despite the flag order (errata `E-017`). Styles persist across records; advances are used verbatim.

**`DefineEditText` (37).** `Bounds RECT` + a 16-bit flag word read little-endian
(byte 0: `HasText`, `WordWrap`, `Multiline`, `Password`, `ReadOnly`, `HasTextColor`, `HasMaxLength`,
`HasFont`; byte 1: `HasFontClass`, `AutoSize`, `HasLayout`, `NoSelect`, `Border`, `WasStatic`,
`HTML`, `UseOutlines`), then `FontID` (if `HasFont`), `FontClass` (if `HasFontClass`),
**`FontHeight` if `HasFont` or `HasFontClass`** (errata `E-017`), `TextColor RGBA` (if
`HasTextColor`), `MaxLength UI16`, `Align`/`LeftMargin`/`RightMargin`/`Indent`/`Leading` (if
`HasLayout`), `VariableName STRING`, `InitialText` (if `HasText`; HTML when the flag is set).
`Align`: 0 left, 1 right, 2 center, 3 justify. HTML subset: `<p align>`, `<br>`, `<a href target>`,
`<font face size color>`, `<b>`, `<i>`, `<u>`, `<li>`, `<textformat …>`, `<tab>`.

### 10.9 Sound structures (Ch.11)

**Rate/format codes** are §8's tables. Format minimums: 0/1 ⇒ SWF 1; 2/3 ⇒ SWF 4; 6 ⇒ SWF 6; 4/5/11
⇒ SWF 10. Nellymoser/Speex ignore `SoundRate`/`SoundType` (Speex is always 16 kHz mono); the 5.5 kHz
rate is never valid for MP3; `SoundSize` applies only to uncompressed.

**`DefineSound` (14):** `SoundId UI16`, `SoundFormat UB[4]`, `SoundRate UB[2]`, `SoundSize UB[1]`,
`SoundType UB[1]`, `SoundSampleCount UI32` (**per-channel** sample count: sample *pairs* for stereo),
`SoundData`. MP3 payload is `MP3SOUNDDATA` = `SeekSamples SI16` + `MP3FRAME[]` (no count field).

**ADPCM:** see §9 for the corrected framing (`AdpcmCodeSize UB[2]` once per sound / per stream block;
packets of `22·ch + 4095·ch·bits` bits, bit-packed and unaligned; sign-magnitude codes).

**`StartSound` (15) / `StartSound2` (89) and `SOUNDINFO`:**

```
SOUNDINFO flags byte (MSB-first): Reserved UB[2] = 0, SyncStop, SyncNoMultiple,
                                  HasEnvelope, HasLoops, HasOutPoint, HasInPoint
InPoint   if HasInPoint  UI32   // samples to skip
OutPoint  if HasOutPoint UI32   // sample position of the LAST sample to play
LoopCount if HasLoops    UI16
EnvPoints if HasEnvelope UI8, then SOUNDENVELOPE[]: Pos44 UI32, LeftLevel UI16, RightLevel UI16
```

`StartSound2` replaces `SoundId` with `SoundClassName STRING`; its prose section is a copy of
`StartSound`'s (errata `E-018`). Levels are 0…32768 (unity = 32768); `Pos44` is a 44 100 Hz sample
position; a mono envelope whose L/R levels differ is averaged.

**Streaming:**

| Tag | Code | Body |
| --- | --- | --- |
| `SoundStreamHead` | 18 | `Reserved UB[4]`, `PlaybackSoundRate UB[2]`, `PlaybackSoundSize UB[1]`, `PlaybackSoundType UB[1]`, `StreamSoundCompression UB[4]`, `StreamSoundRate UB[2]`, `StreamSoundSize UB[1]`, `StreamSoundType UB[1]`, `StreamSoundSampleCount UI16`, `LatencySeek SI16` (only when compression is MP3) |
| `SoundStreamHead2` | 45 | same fields; allows stream compression/size to differ from the playback fields (SWF 3+) |
| `SoundStreamBlock` | 19 | long tag-header form; `StreamSoundData` for exactly one frame. MP3: `SampleCount UI16` then `MP3SOUNDDATA` |

`PlaybackSoundSize` is always 1 for `SoundStreamHead`; playback fields are advisory. `LatencySeek`
"should match the first block's `SeekSamples`" but is omitted by some writers (errata `E-018`).
Streams: one per timeline (one per sprite allowed), one block per frame, silent/empty blocks keep the
timeline (`SampleCount 0`, `SeekSamples 0`).

**MP3 frame (`MP3FRAME`):** `Syncword UB[11]` all ones; `MpegVersion UB[2]` (0 = 2.5, 1 = reserved,
2 = MPEG 2, 3 = MPEG 1); `Layer UB[2]` (always 1 = Layer III in SWF); protection bit; `Bitrate UB[4]`
(index × 1000, index 15 = bad); `SamplingRate UB[2]` (0 = 44.1/22.05/11.025 kHz, 1 = 48/24/12,
2 = 32/16/8); `PaddingBit`; `ChannelMode UB[2]` (**0 stereo, 1 joint stereo, 2 dual channel, 3 mono**
— the chapter's table prints "2" for mono; errata `E-018`); mode extension, copyright, original,
emphasis. Frame size `= ((MPEG1 ? 144 : 72) × bitrateBps) / rate + paddingBit`; sample data
`= size − 4` bytes (128 kbps/44.1 kHz/padding ⇒ 414).

**Frame subdivision:** ideal samples per SWF frame = `rate / frameRate`; MP3 blocks carry whole
frames (576 or 1152 samples) so real block sizes alternate around the ideal; `SeekSamples` is
`ideal − actual` measured at the end of the previous frame, encoder latency goes in the first block's
`SeekSamples` and is added to every later one. Nellymoser frames are 256 samples; Speex is always
16 kHz mono (Speex 1.2 beta 3 in FP 10.0.12).

### 10.10 Button structures (Ch.12)

Tags: `DefineButton` (7, SWF 1), `DefineButton2` (34, SWF 3+), `DefineButtonCxform` (23, SWF 2+),
`DefineButtonSound` (17, SWF 2+). Semantics, model and tests: `IMPL-100`; hit-area fallback decision:
`GFX-D16`.

```text
DefineButton (7):
  ButtonId UI16
  BUTTONRECORD[]              // v1 form: no colour transform, no filter/blend tail
  CharacterEndFlag UI8 = 0
  Actions ACTIONRECORD[]      // run when the button is CLICKED AND RELEASED
  ActionEndFlag UI8 = 0

DefineButton2 (34):
  ButtonId UI16
  ReservedFlags UB[7] = 0   TrackAsMenu UB[1]
  ActionOffset UI16           // bytes from the START OF ActionOffset to the first BUTTONCONDACTION;
                              // 0 = the button has no condition actions at all
  BUTTONRECORD[]              // v2 form (colour transform always present)
  CharacterEndFlag UI8 = 0
  BUTTONCONDACTION[]          // at ActionOffset when non-zero
```

`BUTTONRECORD` — flag byte is MSB-first; the four **state** bits are the low four:

| Bits | Field | Notes |
| --- | --- | --- |
| 7–6 | `ButtonReserved UB[2]` | must be 0 |
| 5 | `ButtonHasBlendMode` | SWF 8+; v2 records only |
| 4 | `ButtonHasFilterList` | SWF 8+; v2 records only |
| 3 | `ButtonStateHitTest` | defines the active area; need not be visible geometry |
| 2 | `ButtonStateDown` | |
| 1 | `ButtonStateOver` | |
| 0 | `ButtonStateUp` | |

Field order after the flags: `CharacterID UI16`, `PlaceDepth UI16`, `PlaceMatrix MATRIX`, then — v2
records only — `ColorTransform CXFORMWITHALPHA`, `FilterList FILTERLIST` (when `ButtonHasFilterList`;
same structure as §10.1's placement filter list, §7) and `BlendMode UI8` (when `ButtonHasBlendMode`;
§6). A record may set several state bits at once, and one state may hold several records.

`BUTTONCONDACTION` — the key code sits **between** the condition bits and the ninth condition bit:

```text
CondActionSize        UI16   // bytes from the START OF THIS FIELD to the next record; 0 = last one
CondIdleToOverDown    UB[1]  // eight MSB-first condition bits
CondOutDownToIdle     UB[1]
CondOutDownToOverDown UB[1]
CondOverDownToOutDown UB[1]
CondOverDownToOverUp  UB[1]
CondOverUpToOverDown  UB[1]
CondOverUpToIdle      UB[1]
CondIdleToOverUp      UB[1]
CondKeyPress          UB[7]  // SWF 4+: 1/2/3/4/5/6 = left/right/home/end/insert/delete, 8 =
                             // backspace, 13 = enter, 14/15 = up/down, 16/17 = page up/down,
                             // 18 = tab, 19 = escape, 32–126 = ASCII; 0 in SWF 3 content
CondOverDownToIdle    UB[1]  // ninth condition bit — after the key code (inference; see below)
Actions               ACTIONRECORD[]
ActionEndFlag         UI8 = 0
```

**Chapter gap:** the transition table names nine conditions but only eight bit fields precede
`CondKeyPress`. The ninth (`CondOverDownToIdle`) is placed after the key code — the only layout that
keeps the documented eight-bit group, the 7-bit key and a byte-aligned action array (`IMPL-100` R005,
`T-MOD-814`). Treat its position as an inference until a fixture pins it.

**Transitions and events** (one row per condition bit; "tracking" = the button's `TrackAsMenu` mode):

| Condition bit | Transition | Event | Tracking |
| --- | --- | --- | --- |
| `CondIdleToOverUp` | Idle → OverUp | Roll Over | push + menu |
| `CondOverUpToIdle` | OverUp → Idle | Roll Out | push + menu |
| `CondOverUpToOverDown` | OverUp → OverDown | Press | push + menu |
| `CondOverDownToOverUp` | OverDown → OverUp | Release | push + menu |
| `CondOutDownToOverDown` | OutDown → OverDown | Drag Over | push only |
| `CondOverDownToOutDown` | OverDown → OutDown | Drag Out | push only |
| `CondOutDownToIdle` | OutDown → Idle | Release Outside | push only |
| `CondIdleToOverDown` | Idle → OverDown | Drag Over | menu only |
| `CondOverDownToIdle` | OverDown → Idle | Drag Out | menu only |

A **push** button captures the pointer on press (a drag outside keeps the *over* state and the
pointing-hand cursor); a **menu** button does not (a drag outside returns to *up* and the arrow
cursor). `CondKeyPress` handlers fire **without input focus**, and ASCII 32–126 are the composite
(Shift-aware) codes. The format has no checked/radio state; mutual exclusion is authoring-side
actions.

**`DefineButtonCxform` (23):** `ButtonId UI16`, `ButtonColorTransform CXFORM` — RGB only, no alpha
(the v1 counterpart of the per-record `CXFORMWITHALPHA`; not used by `DefineButton2`).

**`DefineButtonSound` (17):** `ButtonId UI16`, then four `(ButtonSoundCharN UI16, SOUNDINFO)` pairs —
the info present only when the id is non-zero — in this order, which is **not** the authoring tool's
up/over/down order:

| N | Transition | Event |
| --- | --- | --- |
| 0 | `OverUpToIdle` | Roll Out |
| 1 | `IdleToOverUp` | Roll Over |
| 2 | `OverUpToOverDown` | Press |
| 3 | `OverDownToOverUp` | Release |

### 10.11 Sprite structures (Ch.13)

```text
DefineSprite (39, SWF 3+):
  SpriteID   UI16
  FrameCount UI16
  ControlTags TAG[]     // the sprite's own timeline
  End                   // the body is End-terminated; the tag Length covers the whole body
```

- **Valid control tags inside a sprite:** `ShowFrame`, `PlaceObject`, `PlaceObject2`, `RemoveObject`,
  `RemoveObject2`, all action tags, `StartSound`, `FrameLabel`, `SoundStreamHead`,
  `SoundStreamHead2`, `SoundStreamBlock`, `End`.
- **Definition tags are not allowed inside a sprite:** every character a sprite references MUST be
  defined in the file body *before* the `DefineSprite` tag. A definition tag inside a sprite is
  reported (`SF0128`) and MUST NOT enter the dictionary.
- **Tags outside the list** (`PlaceObject3`, `VideoFrame`, …) occur in later real content: decoded
  normally, reported once per kind (`SF0129`).
- **Streaming sound:** a sprite may carry its own `SoundStreamHead`/`SoundStreamBlock` stream. It is
  **mixed with the main track**, not a replacement, and stops when the sprite leaves the display list.
- **Lifetime and transform:** a sprite's children move/scale/rotate with it, and removal from the
  display list stops its timeline.
- **Naming and `SetTarget`:** the `Name` on the sprite's placement names the *instance*; `SetTarget`
  resolves against instance names with this grammar:

| Path | Meaning |
| --- | --- |
| `/Jack` | absolute from the root timeline |
| `/Jack/Bert` | absolute through nested instances |
| `Bert` | relative to the current target's timeline |
| `../Ernie` | one level up, then the instance `Ernie` |
| `../../Jill` | two levels up |
| `""` | restore the current file as the target |

Model, diagnostics and tests: `IMPL-030` §8; the parser and scope rules: `IMPL-050`.

### 10.12 Video structures (Ch.14)

```text
DefineVideoStream (60, SWF 6+):
  CharacterID UI16
  NumFrames   UI16      // number of VideoFrame tags for this stream
  Width       UI16      // the size the stream is PLACED at
  Height      UI16
  VideoFlagsReserved   UB[4] = 0
  VideoFlagsDeblocking UB[3]   // 000 = use the packet value; 001 off; 010 level 1; 011–101 level
                               // 2–4 (VP6 only); 110/111 reserved
  VideoFlagsSmoothing  UB[1]   // scaling filter: 0 nearest, 1 linear
  CodecID     UI8

VideoFrame (61):
  StreamID  UI16
  FrameNum  UI16        // sequence number WITHIN the stream
  VideoData             // by the stream's CodecID — see the codec table
```

| `CodecID` | Codec | Min SWF | Packet structure |
| --- | --- | --- | --- |
| 2 | Sorenson H.263 (Spark) | 6 | `H263VIDEOPACKET`: `PictureStartCode UB[17]`, `Version UB[5]` (0/1), `TemporalReference UB[8]`, `PictureSize UB[3]` (+ custom `UB[8]`/`UB[16]` sizes; `UB[16]` is a bit field, not `UI16`), `PictureType UB[2]`, `DeblockingFlag UB[1]`, `Quantizer UB[5]`, extra-info loop, then the block layer |
| 3 | Screen Video | 7 | `SCREENVIDEOPACKET`: `BlockWidth UB[4]`/`ImageWidth UB[12]`/`BlockHeight UB[4]`/`ImageHeight UB[12]` (block = 16…256 px as `(actual / 16) − 1`) + `IMAGEBLOCK[]` (`DataSize UB[16]`, zlib data, B,G,R rows bottom-left → top-right; `0` = unchanged) |
| 4 | On2 VP6 | 8 | `VP6SWFVIDEOPACKET` |
| 5 | On2 VP6 with alpha | 8 | `VP6SWFALPHAVIDEOPACKET`: `OffsetToAlpha UI24` (byte offset from the start of the packet's `Data` to the alpha stream), then the colour stream, then the alpha stream — `A = Y2`, colour from `Y1`/`U1`/`V1` with `R/G/B = MIN(Y2, SATURATE(1.164(Y1 − 16) ± …))`; `U2`/`V2` are unused. A colour key frame forces an alpha key frame |
| 6 | Screen Video v2 | 8 | `SCREENV2VIDEOPACKET` — see below and the palette |
| 0, 1, 7–255 | unknown | — | reported (`SF0240`); the stream is dropped |

**Screen Video v2 (`CodecID` 6).** The tag's own `CodecID` table omits codec 6 although the chapter
documents the packet (errata `E-021`); it is accepted (`SF0290`, `IMPL-110`). Packets may carry a
palette (transmitted as a v1 `IMAGEBLOCK`) which applies to that packet only; without one, the
Appendix C table below is the default. Pixels are a mixed stream: a byte with its high bit set
supplies 15-bit colour (this byte's low 7 bits + the next byte, expanded `r5 << 3 | r5 >> 2`);
without the high bit, the low 7 bits are a **palette index**. Blocks may be diff blocks
(`RowStart`/`Height`) and the zlib stream may be primed (`BlockColumn`/`BlockRow`) with a
non-primed fallback.

**Frame and display rules.** Display is driven by the placement's `Ratio` field, not by `FrameNum`
order; timing is the movie's frame rate only (payload timestamps are ignored); `NumFrames` is the
count of `VideoFrame` tags; missing frame numbers are freezes; `Width`/`Height` are the placement
size, so a coded frame of another size is scaled (smoothing flag chooses the filter).

**Appendix C — default Screen Video v2 palette** (128 × `0x00RRGGBB`, appendix-body order):

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

If a packet's own palette block is present it overrides this table **for that packet only**.
The table above was compared against Appendix C entry-for-entry on 2026-10-04 (128/128, appendix
order, `T-TST-006`); `IMPL-110` §6 ships the same values as a frozen constant and `T-MOD-911` asserts
the equality so a transcription typo or a permutation cannot survive review.

### 10.13 Metadata structures (Ch.15)

**`FileAttributes` (69):** MUST immediately follow the SWF header, and is interpreted **only on the
root SWF** (an occurrence inside a sprite is ignored — `SF0175`). The authoritative 32-bit mask table
is §10.2; Ch.15 restates the byte with these names, and the differences are errata `E-022`:

| Bit | Ch.15 name | Meaning |
| --- | --- | --- |
| 7 | `Reserved UB[3]` (7–5) | the tag description calls bits 6/5 `UseDirectBlit`/`UseGPU` (`0x0040`/`0x0020`) |
| 4 | `HasMetaData` | a `Metadata` tag exists (used by search engines; the player ignores it) |
| 3 | `SWFFlagsAS3` | AVM-2 / Tamarin byte code |
| 2 | `SWFFlagsNoCrossDomainCache` | legacy SWF 9 bit; the tag description lists it as reserved (`SEC-D09`) |
| 1 | `Reserved = 0` | |
| 0 | `SWFFlagsUseNetwork` | local-drive SWF gets network access instead of local access |

Where Ch.15 and the tag description disagree, §10.2's masks are what the decoder implements; the
Ch.15 names are recorded in the report.

**`DefineBinaryData` (87, SWF 9+):** `Tag UI16` (character id, entered into the dictionary),
`Reserved UI32` = 0, `Data` to the end of the tag. A `SymbolClass` entry makes it an AS3
`ByteArray` subclass in the original player; for us it is a `binary` asset shipped verbatim
(`AST-D09`, `SEC-D06`).

**`EnableTelemetry` (93):** `Reserved UB[16]` = 0, then an **optional** `PasswordHash UI8[32]`
(SHA-256 of the UTF-8 password). The tag opts the file into advanced telemetry profile data; its
absence from the file means only basic profile information. We decode and report it and never emit
telemetry (`SEC-D08`, `RT-R056`); the hash is credential material and is recorded as present/absent
plus a local digest, never reproduced (`SEC-§4`).

## 11. Fidelity levels

| Level | Meaning | Typical verification |
| --- | --- | --- |
| F1 | Bit-exact | Binary/pixel equality |
| F2 | Numerically exact | Same numbers/indices |
| F3 | Tolerant | SSIM / null RMS / drift bounds |
| F4 | Approximate, declared | Divergence list entry with a decision id |

## 12. Consolidated decision index

<!-- DECISION-INDEX:BEGIN -->
| Doc | Decision id | Decision | Default |
| --- | --- | --- | --- |
| 000 | `ARCH-D01` | Is the interpreter fallback allowed in the shipped bundle? | Yes, only if residual code exists; tree-shaken otherwise |
| 000 | `ARCH-D02` | Are emitted files one-per-symbol or one-per-timeline? | One per timeline + one per recovered class |
| 000 | `ARCH-D03` | Is a WebGPU backend in scope? | No for v1; renderer abstraction must permit it |
| 000 | `ARCH-D04` | Support `--legacy-positioning` (Flash Player pixel snapping) by default? | On |
| 000 | `ARCH-D05` | Distribute assets per-file or in a single archive? | Per-file + optional `.sfa` archive |
| 000 | `ARCH-D06` | Do we ship `reports/` in the emitted project? | Yes (advisory, not part of build) |
| 010 | `REPO-D01` | pnpm vs npm workspaces | pnpm |
| 010 | `REPO-D02` | Emit one file per timeline even for 1000-frame timelines? | Yes, with `//#region frame N` markers |
| 010 | `REPO-D03` | `--stamp` default off but always on for release builds? | Off by default |
| 010 | `REPO-D04` | Committed examples must compile in CI? | Yes |
| 010 | `REPO-D05` | Are `etc/*.api.md` review files committed? | Yes |
| 010 | `REPO-D06` | How are duplicate asset payloads stored? | Content-hashed once; instances reference the single blob |
| 020 | `CMP-D01` | Placements emitted as data vs. imperative calls | Data |
| 020 | `CMP-D02` | Name-recovery conflict resolution | Deterministic suffixes `_2`, `_3` by definition order |
| 020 | `CMP-D03` | Are sprites' timelines pre-flattened when statically constant? | No (v1) |
| 020 | `CMP-D04` | Max emitted file size before splitting | 4000 lines |
| 020 | `CMP-D05` | `--fail-on=risk` default in CI? | Yes for `main` |
| 020 | `CMP-D06` | Interpreter blob encoding (base64 vs. Uint8Array literal) | Uint8Array literal (smaller after gzip) |
| 020 | `CMP-D07` | Tolerate `FileLength` mismatch by re-scanning tags? | Yes with `warning` (SWF-D03) |
| 030 | `SWF-D01` | Accept SWF versions 1–3 (pre-AVM1-v5 semantics)? | Parse and warn `SF0002`; games below v6 may misbehave |
| 030 | `SWF-D02` | ZWS/LZMA support behind a flag? | On if the LZMA dep is available, else `error` `SF0006` |
| 030 | `SWF-D03` | Tolerate wrong `FileLength` | Yes (`--tolerate-length`) |
| 030 | `SWF-D04` | `DefineShape4` winding flag handling | Honour the flag; default `evenodd` when absent |
| 030 | `SWF-D05` | CXFORM multiply division: truncate vs round | Truncate (`>> 8`) on integer paths, shader float path uses `*1/2 |
| 030 | `SWF-D06` | `unitsPerEm` exposure | Explicit field per font (1024 or 20480) |
| 030 | `SWF-D07` | Carry `Metadata`/XMP into the emitted project? | Yes, as `movie.metadata` in the manifest |
| 030 | `SWF-D08` | Path sanitisation for emitted asset names | Only content hashes and sanitised linkage ids |
| 030 | `SWF-D09` | Tags inside a sprite outside Ch.13's list | Decode normally + `SF0129` (info) once per kind; definition tags are ignored for the dictionary (`SF0128`) |
| 040 | `AVM1-D01` | String constant encoding for SWF 4–5 content | Latin-1/code-page per `DefineFontInfo` |
| 040 | `AVM1-D02` | `Add` vs `Add2` distinct implementations | Both implemented |
| 040 | `AVM1-D03` | Include the interpreter when any function is residual | Yes |
| 040 | `AVM1-D04` | Scene semantics | Collapse scenes into label map; `nextScene`/`prevScene` computed |
| 040 | `AVM1-D05` | `Date` implementation | Full ECMA-like `Date` with Flash's local-time behaviour and `get |
| 040 | `AVM1-D06` | `Math.random` seeding | Non-deterministic by default; `--seed` available for tests |
| 040 | `AVM1-D07` | Residual bytecode policy for `eval`-like code | Interpreter, warned |
| 040 | `AVM1-D08` | `TextField.variable` write-back mechanism | Scope write hooks |
| 040 | `AVM1-D09` | Rotation/skew round-trip fidelity | Keep decomposed TRS alongside matrix |
| 040 | `AVM1-D10` | `_alpha` and `_visible` inheritance | Values are per-clip; effective alpha multiplies up the parent ch |
| 040 | `AVM1-D11` | Missing frame label behaviour | No-op + one-time warning |
| 040 | `AVM1-D12` | Iteration snapshot semantics for `for…in` | Snapshot keys at start |
| 050 | `GFX-D01` | Blur approximation: box passes, σ mapping, `quality` handling | 3-pass box, σ = r/2, downsample > 8 px |
| 050 | `GFX-D02` | Fill rule when `DefineShape4` flag absent | even-odd |
| 050 | `GFX-D03` | Fill tessellation: monotone vs ear-clip vs both | convex fast path + monotone, ear-clip fallback |
| 050 | `GFX-D04` | Analytic AA + MSAA hybrid as the default | Yes |
| 050 | `GFX-D05` | Text atlas scale buckets | 1×, 2×, 3× |
| 050 | `GFX-D06` | Device-font substitution table | Bundled metric-compatible set; document per-font deltas |
| 050 | `GFX-D07` | Static batch cache granularity | Per clip subtree, coarse invalidation |
| 050 | `GFX-D08` | Group (FBO) resolution: stage-scale or device-scale? | Device-scale (full res) |
| 050 | `GFX-D09` | Mask clip visibility semantics | Pathological cases resolved per spec text |
| 050 | `GFX-D10` | Non-smoothed bitmap sampling | Single-mip nearest |
| 050 | `GFX-D11` | Filter parameter units at the AS API boundary | `FIXED` pixels for tag-sourced filters, px at the AS API, converted once (`E-009`) |
| 050 | `GFX-D12` | ColorMatrix translation column scale | 0…255 |
| 050 | `GFX-D13` | Shadow/glow `strength` semantics | Alpha gain, not colour multiply |
| 050 | `GFX-D14` | Gradient ramp dithering | 4×4 ordered dither on 8-bit targets, off for 16F targets |
| 050 | `GFX-D15` | Supersampled fallback threshold | 20 000 vertices or 3 failed tessellation attempts |
| 050 | `GFX-D16` | Button hit area when no `ButtonStateHitTest` record exists | Union of the `up` geometry with each record's matrix applied (`IMPL-100` R015, `T-MOD-801`) |
| 060 | `AUD-D01` | `LoopCount = 0` semantics in `SOUNDINFO` vs AS `Sound.start(loops=0)` | SOUNDINFO 0 = forever; AS 0 = once |
| 060 | `AUD-D02` | Pan law | Equal-power |
| 060 | `AUD-D03` | MP3 stream block 4-byte header (`sampleCount`, `seekSamples`) | Applied to MP3 only |
| 060 | `AUD-D04` | Canonical sample rate | 48000 |
| 060 | `AUD-D05` | Codec ladder default (Opus primary, AAC fallback) | Opus/WebM + optional AAC |
| 060 | `AUD-D06` | Native `AudioBufferSourceNode.loop` for plain ambient beds | Allowed only without envelope/sync |
| 060 | `AUD-D07` | Loop crossfade default | 3 ms, on |
| 060 | `AUD-D08` | Peak guard on the master bus | On (1 ms/50 ms, ≤ 6 dB) |
| 060 | `AUD-D09` | `Sound.position` update source | Audio clock arithmetic (not callbacks) |
| 060 | `AUD-D10` | Stream re-anchor policy | Hard seek + 2 ms crossfade, tolerance 12 ms |
| 060 | `AUD-D11` | Chunk size default | 10 s |
| 060 | `AUD-D12` | MP3 passthrough when only loop metadata changes | Allowed (offsets are metadata) |
| 060 | `AUD-D13` | Nellymoser/Speex decoders | Optional dependency, fail per-asset with `--audio.missing=stub` |
| 060 | `AUD-D14` | Loudness normalisation | Off |
| 070 | `AST-D01` | Colour-space handling of bitmaps | Preserve authored sRGB values; blend in sRGB space |
| 070 | `AST-D02` | Lossless sources: which formats get lossless encoding | UI, text, pixel art → lossless; photographic → lossy |
| 070 | `AST-D03` | Atlas page grouping policy | By usage class (static/UI/particles/8-bit) |
| 070 | `AST-D04` | Alpha video technique | Side-by-side alpha in H.264; chroma-key for very small clips |
| 070 | `AST-D05` | Default video target | H.264 High, CRF 20, `faststart` |
| 070 | `AST-D06` | WOFF2 upem normalisation | 2048 for CFF/TTF output |
| 070 | `AST-D07` | MSDF enabled by default? | Off; bitmap atlases + WOFF2 fallback |
| 070 | `AST-D08` | `--manifest=compact` default | Pretty (diffable) |
| 070 | `AST-D09` | `DefineBinaryData` shipped verbatim (no re-compression) | Yes, verbatim + optional deflate wrapper |
| 070 | `AST-D10` | BitmapData CPU mirror | Off by default; enabled per-game by config |
| 070 | `AST-D11` | Screen Video v2 (`CodecID = 6`, omitted by the tag's own table) | Accept and decode; per-packet palette, Appendix C fallback (`SF0290`, `E-021`) |
| 080 | `RT-D01` | `pauseOnBlur` default | `false` (keep running, matching a windowed Flash game) |
| 080 | `RT-D02` | `runInBackground` default | `false` |
| 080 | `RT-D03` | `loader.blockOnFirstPlayable` | `true` with the budget escape (RT-R010) |
| 080 | `RT-D04` | `SharedObject` backend | `localStorage` < 64 KB, IndexedDB above |
| 080 | `RT-D05` | `System.capabilities` mapping table | Documented in the compatibility record |
| 080 | `RT-D06` | Touch emulation of mouse | On (`emulate`) |
| 080 | `RT-D07` | Keyboard capture scope | Capture only while the canvas has focus; `Tab` free unless the g |
| 080 | `RT-D08` | Default `network.policy` | `deny` |
| 080 | `RT-D09` | Telemetry | Off, opt-in, documented fields only |
| 080 | `RT-D10` | Error recovery limit | 50 errors / 10 s, then stop |
| 080 | `RT-D11` | Stats overhead when disabled | ≤ 0.05 ms/frame |
| 080 | `RT-D12` | Video autoplay blocked by browser policy | Keep the timeline advancing, show the last frame or poster, retry `play()` on the next user gesture |
| 090 | `TST-D01` | Committed goldens vs generated-on-demand | Committed (reviewable) |
| 090 | `TST-D02` | Oracle for visual baselines | Archival captures |
| 090 | `TST-D03` | Differential oracle for behaviour | Optional open-source player, non-blocking by default |
| 090 | `TST-D04` | Default SSIM threshold | 0.995 |
| 090 | `TST-D05` | Frame sampling indices | 0,1,2,5,10,30,60,120 then every 60 |
| 090 | `TST-D06` | Perf job cadence | Every PR (counters), 4×/day (wall-clock) |
| 090 | `TST-D07` | Fuzz budget per PR | 60 s per target |
| 090 | `TST-D08` | Soak duration | 45 min per title |
| 090 | `TST-D09` | Accepted-divergence budget per fixture | ≤ 3 entries, each with a decision ID |
| 090 | `TST-D10` | Spec coverage gate | ≥ 95% of requirements mapped |
| 100 | `SEC-D01` | Network default | Deny |
| 100 | `SEC-D02` | WASM decoders allowed? | Yes, same-origin, hash-pinned, per-feature opt-in |
| 100 | `SEC-D03` | Bundling source maps in production builds | Off by default; `--sourcemap=external` opt-in |
| 100 | `SEC-D04` | Dependency review record | `docs/deps.md` updated per dependency |
| 100 | `SEC-D05` | AAC fallback default | Off |
| 100 | `SEC-D06` | `DefineBinaryData` serving | Verbatim bytes, `application/octet-stream`, no preview |
| 100 | `SEC-D07` | Copyleft tool usage | Allowed as an external tool only |
| 100 | `SEC-D08` | Telemetry | Off; documented fields only |
| 100 | `SEC-D09` | Legacy `NoCrossDomainCache` bit (`FileAttributes` bit `0x00000004`) | Recorded and reported, never acted on; the browser's own cache rules govern |
| 120 | `INS-D01` | Write policy | Read-only; authoring mode is explicit, per-file, session-logged |
| 120 | `INS-D02` | Index location | `.forge-cache/` inside the project, disposable and never committed |
| 120 | `INS-D03` | Navigation substrate | Source maps + model dump; no bespoke binary index |
| 120 | `INS-D04` | Highlighting engine | Shipped grammars (token-based), not a plugin ecosystem |
| 120 | `INS-D05` | Language service | TypeScript compiler API in a worker, project-scoped |
| 120 | `INS-D06` | Run view availability | Dev builds only, same-origin |
| 120 | `INS-D07` | Keyboard model | VS Code conventions where they exist |
| 120 | `INS-D08` | Editing | Plain text edits with generated-file guard rails |
| 120 | `INS-D09` | Reference-kind labels | Fixed four kinds (TS, resource, SWF, diagnostic) |
| 130 | `CLN-D01` | Clean output is generated from the analysed model/IR, not by rewriting emitted TS text | Model-driven passes; optional Prettier/import pass last |
| 130 | `CLN-D02` | Residual AVM1 in clean output | Forbidden; `--allow-residual` (off) wraps blobs as isolated modules with warnings |
| 130 | `CLN-D03` | Loop semantics | Fixed step (60 Hz default) + interpolation + `maxSubSteps` 5 |
| 130 | `CLN-D04` | Timeline tiering | T-A/T-B/T-C as in CLN-§4.1; no tier ⇒ refuse |
| 130 | `CLN-D05` | Dynamic property bags | Keep as typed `Record<string, unknown>` + accessors, reported |
| 130 | `CLN-D06` | Naming | Recovered AS names first; deterministic synthesis otherwise; never order-dependent |
| 130 | `CLN-D07` | Formatting/lint | Prettier + project ESLint config; clean output lints clean |
| 130 | `CLN-D08` | Assets | Byte-identical to the flash target's shared payloads |
| 130 | `CLN-D09` | Sound | Event sounds → mixer calls; stream sound → scene music state (declared timing deviation) |
| 130 | `CLN-D10` | Where transforms live | `@swf-forge/clean` (library); the app is CLI + bundle |
| 130 | `CLN-D11` | Policy file | `forge.clean.json`: rule on/off, tolerances, refusal policy |

**APP-R005** There are 132 tracked decisions at Draft 1.8. Every one MUST be either measured and
settled (with the test that settled it recorded in the entry) or explicitly accepted as an open
risk in the release notes. A decision is never *deleted*; it is marked `[SETTLED: <test id>]` or
`[WITHDRAWN: <replacement>]`.
<!-- DECISION-INDEX:END -->

## 13. Glossary additions

Terms defined in ARCH-§7 are not repeated here.

| Term | Meaning |
| --- | --- |
| **Atlas page** | A single GPU texture holding many sprites/glyphs (AST-§3.4) |
| **Chunk table** | Per-chunk frame offsets for streaming audio (AUD-§4.2) |
| **Coverage** | Per-pixel fraction of a shape covering the pixel (GFX-§5.3) |
| **Divergence** | A measured difference from Flash behaviour, recorded with a fidelity level |
| **Golden** | A committed expected artefact compared byte-for-byte in tests |
| **Group** | An offscreen render target containing a subtree, required for masks/filters/blends |
| **Loop region** | `{loopStart, loopEnd}` frames in canonical sample rate (AUD-§4.4) |
| **Manifest** | `forge.manifest.json`; the runtime's complete asset description (AST-§6) |
| **Oracle** | An external reference implementation or recording used for conformance |
| **Placeholder** | A defined substitute for a broken asset that keeps the game runnable |
| **Poster frame** | The still image shown for a video that has not started |
| **Residual** | AVM1 code retained for the interpreter (T2) |
| **Settle** | Sub-pixel snapping to twips/device pixels (GFX-§4.3) |
| **Stream sound** | Audio interleaved with frames and locked to the playhead (AUD-§6.2) |
| **Tier** | Codegen class T0/T1/T2 (AVM1-§9) |

## 14. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | First draft |
| 1.1 | 2026-10-04 | §10.1 (Ch.3 display-list structures incl. `CLIPEVENTFLAGS` masks) and §10.2 (Ch.4 control-tag structures incl. `FileAttributes` masks) added; these are the anchors cited by `IMPL-030` and `IMPL-040` |
| 1.2 | 2026-10-04 | §10.3 (Ch.5 action structures: framing, `Push` types, `DefineFunction2` masks, `Try`, flag bytes) and §10.4 (Ch.6 shape structures: style arrays, `LINESTYLE2`, `SHAPERECORD` bit fields) added; anchors cited by `IMPL-050` and `IMPL-060` |
| 1.3 | 2026-10-04 | §10.5 (Ch.7 gradient structures: shared spread/interpolation/count byte, gradient square and the chapter's matrix example, ratio semantics, 8-vs-15 control-point ceilings, `FOCALGRADIENT` `FIXED8`), §10.6 (Ch.8 bitmap structures: all seven tags, `AlphaDataOffset` = byte count, lossless formats + palette size + row padding, `PIX15`/`PIX24`, premultiplied `ALPHABITMAPDATA`, `DeblockParam`), §10.7 (Ch.9 morph structures: both tags, `MORPHFILLSTYLE`/`MORPHGRADIENT`/`MORPHLINESTYLE2`, the two independent edge streams, `Offset` as a hint, morph restrictions and the `Ratio` range) |
| 1.4 | 2026-10-04 | §10.8 (Ch.10 font/text structures: EM-square and trueType conversion rule, all ten font tags incl. `DefineFont2` layout block and `DefineFont3` ×20, code-table/offset bases, the real `TEXTRECORD`, `DefineEditText`'s 16-flag word and `FontHeight` rule, align zones and CSM cutoffs) and §10.9 (Ch.11 sounds: format minimums, `DefineSound`, `SOUNDINFO`, stream heads/blocks, MP3 frame fields and the size formula, frame subdivision) added; §9 ADPCM quick reference corrected to the chapter's bit-packed sign-magnitude framing and §8's envelope note corrected (`Pos44` is a 44 100 Hz `UI32`, levels 0…32768) |
| 1.5 | 2026-10-04 | §10.10 (Ch.12 buttons: records, `BUTTONCONDACTION` incl. the ninth-bit inference, the nine-transition table, `DefineButtonCxform`/`DefineButtonSound`), §10.11 (Ch.13 sprites: tag set, definitions-before-use, stream mixing, `SetTarget` grammar), §10.12 (Ch.14 video: both tags, the codec/packet table, Screen Video v2 packet rules and the full Appendix C palette), §10.13 (Ch.15 `FileAttributes` root-only rule and the Ch.15 bit names, `DefineBinaryData`, `EnableTelemetry`) added; decision index +`GFX-D16`, `SWF-D09`, `AST-D11`, `SEC-D09`, `RT-D12` (111 total) |
| 1.6 | 2026-10-04 | Appendix pass: §2's table verified against Appendix B (65/65 exact) and six invented tag names removed (`E-026`), with the unassigned-code rule stated; §10.12's palette verified entry-for-entry against Appendix C (128/128, `T-TST-006`); the missing `REPO-D06` row added to §12 (`APP-R005` now 112) |
| 1.7 | 2026-10-04 | Tech-spec pass: the consolidated decision index gains the new areas' registers — `INS-D01`–`D09` (`specs/120`) and `CLN-D01`–`D11` (`specs/130`); `APP-R005` count 112 → 132 |
| 1.8 | 2026-10-09 | §10.7 `MORPHGRADIENT` corrected (`E-028`): the structure opens with a **single** Ch.7-style `GRADIENT` header byte, not a `UI8` count followed by a flags byte — the printed form consumed one byte too many and shifted every subsequent morph fill style |
