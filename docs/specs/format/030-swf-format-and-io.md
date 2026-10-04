# SWF — Container, Tag Stream, Bit-Level IO, and Validation

**Doc ID:** SWF · **Status:** Draft 1.2 · **Normative:** yes

---

## 1. Scope

Everything needed to turn a byte blob into a trustworthy in-memory model of a movie:
compression, headers, the tag stream, the dictionary, the bit-packed primitive readers
(rects, matrices, colour transforms, shapes), and the validation/hardening policy for hostile or
broken input. This document owns the *front* of the pipeline (CMP S0–S3).

The authoritative structure definitions are in *SWF File Format Specification, Version 19*
("the SWF spec"). This document specifies **how we read them**, what we do with malformed input,
and the precise semantics our implementation commits to.

## 2. Design principles

**SWF-R001** Parsing MUST be zero-copy where practical: the reader holds one `Uint8Array` per movie
and hands out views (`subarray`) rather than copies. A 5 MiB SWF MUST NOT create more than one copy
of its payload bytes, except for decompressed streams (CWS/ZWS), which necessarily allocate one
buffer.

**SWF-R002** Parsing MUST be *lazy per tag*. Only the header, the tag index, and the tags demanded
by the current stage are decoded. A `DefineSprite` subtree is indexed (so it can be navigated) but
not recursively decoded.

**SWF-R003** Parsing MUST NOT trust lengths. Every read is bounds-checked against the containing
tag's declared length, and the containing tag's length is bounds-checked against the file.

**SWF-R004** No parser path may throw on malformed input unless the malformation is fatal for the
whole file. The failure model is: `Result<T, Diagnostic>` at tag granularity; exceptions only for
"file cannot be addressed at all".

**SWF-R005** The parser MUST be usable as a standalone library by third parties with the same
guarantees (no compiler imports).

## 3. Container

### 3.1 Header

| Offset | Size | Field | Notes |
| --- | --- | --- | --- |
| 0 | 3 | Signature | `FWS` uncompressed, `CWS` zlib, `ZWS` LZMA (SWF 13+) |
| 3 | 1 | Version | 1–43 observed; we accept ≥ 4 for AVM1 (v1–3 content is parsed but flagged) |
| 4 | 4 | FileLength | UI32 LE, total *decompressed* length including header |
| 8 | var | FrameSize | `RECT`, twips |
| var | 2 | FrameRate | 8.8 fixed (`UI16`; value/256 fps) |
| var | 2 | FrameCount | `UI16` |
| var | — | Tag stream | begins immediately after `FrameCount` |

**SWF-R006** The reader MUST accept `FWS`, `CWS`, and `ZWS`; for `CWS` it MUST accept zlib streams
with or without a correct `FileLength` (see SWF-R009).

**SWF-R007** Frame rate MUST be read as `raw / 256` and MUST NOT be clamped at parse time; the
runtime clamps for scheduling purposes (RT-§5.2) and records the original value.

**SWF-R008** Frame size MUST be exposed both in twips (integers) and as a computed pixel size at
stage scale (GFX-§2.4). The parser MUST NOT round to integers.

**SWF-R009** If the decompressed length disagrees with `FileLength`:
- decompressed > declared: warning `SF0004`, use the longer buffer (trailing bytes are usually a
  broken header, not data);
- decompressed < declared: warning `SF0005`, continue with what exists;
- both cases continue under `--tolerate-length`, which is the default; `--strict` turns them into
  errors.

### 3.2 Compression

| Signature | Algorithm | Notes |
| --- | --- | --- |
| `CWS` | zlib (RFC 1950) | Use `DecompressionStream('deflate')` in Node/browser; fall back to a built-in inflate |
| `ZWS` | LZMA | SWF ≥ 13; requires an LZMA implementation (see SEC-§5 dependency table) |

**SWF-R010** Decompression MUST be bounded: reject any stream whose declared output size exceeds
`--max-decompressed-bytes` (default 512 MiB) to prevent decompression bombs.

**SWF-R011** Decompression MUST be incremental so that a truncated stream yields a partial movie
plus a diagnostic, rather than nothing.

### 3.3 Tag stream

```
RECORDHEADER:
  UI16  codeAndLength
        code   = codeAndLength >> 6
        length = codeAndLength & 0x3F          // 0x3F means "long form"
        if length == 0x3F: UI32 longLength     // body length, EXCLUDES the 6-byte header (E-007)
  bytes[length] payload
```

**SWF-R012** Tag codes are `0..1023`; unknown codes MUST be reported as `info` and skipped using the
declared length (forward compatibility is a feature: newer players ignore unknown tags).

**SWF-R013** A tag whose declared length exceeds the remaining file MUST terminate the tag stream
with diagnostic `SF0101`; the tags read so far MUST remain usable.

**SWF-R014** `End` (code 0) MUST terminate the top-level stream. The reader MUST also tolerate
missing `End` (some tools omit it) with `info` `SF0102`, inferring the end from file length.

**SWF-R015** Sprite `DefineSprite` (39) payloads are recursively walked by the indexer: a sprite
contains its own `frameCount` then a tag stream with its own `ShowFrame`s. Depth limits apply
(SWF-R031).

The tag index:

```ts
export interface TagRef {
  readonly code: number;
  /** Absolute offset of the payload in the decompressed buffer. */
  readonly offset: number;
  readonly length: number;
  /** Nesting: 0 = top level, 1 = inside a sprite, … */
  readonly depth: number;
  /** Character id of the enclosing sprite, if any. */
  readonly inSprite: number | null;
}

export interface TagIndex {
  readonly tags: readonly TagRef[];
  /** First index into `tags` for each sprite id (sprites have their own frameCount too). */
  readonly spriteRanges: ReadonlyMap<number, { start: number; end: number }>;
}
```

## 4. Bit-level IO

SWF packs many structures into bit fields. All bit reads are **most-significant-bit first within
each byte**, and multi-byte values are **little-endian at the byte level**.

```ts
export interface BitReader {
  readonly byteOffset: number;      // absolute offset of the next unread byte
  readonly bitOffset: number;       // 0..7 within the byte at byteOffset
  readUb(bits: number): number;     // unsigned big-endian bit read
  readSb(bits: number): number;     // signed two's-complement bit read
  align(): void;                    // skip to the next byte boundary
}
```

**SWF-R016** `readSb(n)` MUST return `v - (1 << n)` when the top bit of an `n`-bit field is set
(two's complement in `n` bits). A 0-bit read MUST return 0 without advancing.

**SWF-R017** The reader MUST expose a *byte-aligned* path for payloads where the spec is byte
aligned (audio data, JPEG/PNG data, action bytecode) to avoid the classic "bit reader drift" bug.

**SWF-R018** Every bit read MUST be asserted against the enclosing tag bounds in debug builds
(`--strict-bounds`), and MUST saturate to zero in release builds with a single deduplicated
diagnostic per tag.

### 4.1 Primitive structures

| Structure | Encoding | Notes |
| --- | --- | --- |
| `RECT` | 5-bit `Nbits`, then 4 × `SB[Nbits]` (minX, maxX, minY, maxY) in twips | Y grows downward |
| `MATRIX` | flags: `HasScale`(1), `HasRotate`(1), then 5-bit counts; `ScaleX/ScaleY` as `FB[n]` fixed 16.16; `RotateSkew0/1` same | Absent values default to 1.0 / 0.0 |
| `CXFORM` | 4×mult + 4×add as `SB[Nbits]`, flags `HasAdd`, `HasMult`, 4-bit `Nbits` | mult is 8.8 fixed, add is raw |
| `CXFORMWITHALPHA` | as `CXFORM` plus alpha terms | Alpha mult is 8.8 as well |
| `RGB` / `RGBA` | `UI8`×3 / ×4 | Non-premultiplied |
| `LINEARGRADIENT` / `RADIALGRADIENT` | matrix + stop count/records | Gradient "square" is (−16384,−16384)…(16384,16384) |
| `FOCALGRADIENT` | as radial + `FIXED8` focal point | Focal in gradient space, −1.0…1.0 |

**SWF-R019** `MATRIX` decomposition MUST be exposed as both the raw 2×3 and a decomposed
`{ rotation: number; scaleX: number; scaleY: number; skewX: number; translate: {x,y} }` view.
The AVM1 runtime needs the decomposed view because `_rotation`, `_xscale`, `_yscale` are
independently settable and Flash's round-trip through the matrix loses information
(AVM1-D09).

**SWF-R020** Colour transform values MUST be stored exactly as authored (signed integers) and MUST
NOT be normalised at parse time. Normalisation (mult/256, add) happens in the renderer
(GFX-§7.4) and in `Color`-API semantics (AVM1-§8.6).

### 4.2 Colour transform arithmetic (normative for all consumers)

For a pixel/vertex with components `C ∈ {R,G,B,A}` in 0…255:

```
C' = clamp0_255( floor_or_round( (C * Mult_C) / 256 ) + Add_C )
```

**SWF-R021** The contract is: multiplication first, then addition, then clamp. Whether the
intermediate division rounds or truncates is a **decision** (`SWF-D05`); until pinned by the oracle
harness, the renderer MUST use the platform-consistent form `(C * Mult) >> 8` for integer paths and
document the choice; tests compare against oracle screenshots under tolerance T3 (TST-§6).

**SWF-R022** Alpha multiplies MUST be applied in the same operation as colour multiplies (never as
a separate pass) so that premultiplied-alpha renderers cannot introduce fringes.

## 5. Dictionary and character model

```ts
export interface CharacterModel {
  readonly id: number;
  readonly kind: CharacterKind;
  /** Linkage name(s): ExportAssets, SymbolClass (AVM1 exports), DefineButton names. */
  readonly exportNames: readonly string[];
  /** File offset of the defining tag, for diagnostics and reports. */
  readonly origin: { tagOffset: number };
  /** Lazily-decoded payload, memoised. */
  readonly get: <K extends CharacterKind>(kind: K) => Extract<Character, { kind: K }>;
}

export type CharacterKind =
  | 'shape' | 'shape4' | 'morphShape' | 'sprite' | 'button' | 'text' | 'editText'
  | 'font' | 'font2' | 'font3' | 'font4' | 'bitmap' | 'bitmapLossless'
  | 'sound' | 'video' | 'binaryData' | 'missing' | 'unknown';
```

**SWF-R023** Duplicate character ids MUST be resolved as "last definition wins" (Flash behaviour),
with a `warning` `SF0109` (owned by `IMPL-020`) that names both offsets.

**SWF-R024** A character referenced but never defined (missing `PlaceObject` id) MUST produce
`warning` `SF0110` (owned by `IMPL-030`, shared with buttons) and a placeholder that renders nothing
but preserves depth/name semantics, so
timeline logic still observes `_name` and `_depth`.

**SWF-R025** `DefineScalingGrid` (78) MUST attach to its target character and be preserved into the
Vector IR for 9-slice rendering (GFX-§9.6). Scaling-grid semantics apply to the *timeline*
placement transform, which is what games use for button plates and window chrome.

## 6. Definitions most relevant to later stages

### 6.1 Shapes

A SWF shape (`DefineShape` 2 / `DefineShape2` 22 / `DefineShape3` 32 / `DefineShape4` 83) is:

```
SHAPE = SHAPEWITHSTYLE:  [bounds RECT]
                         [fill styles][line styles]
                         [shape records]
```

`DefineShape4` adds edge bounds, `usesFillWindingRule` (a 1-bit *winding rule* flag!), and
`usesNonScalingStrokes`/`usesScalingStrokes`.

**SWF-R026** The `UsesFillWindingRule` bit (SWF ≥ 8, `DefineShape4`) MUST be read and carried into
the Vector IR as `fillRule: 'nonzero' | 'evenodd'`. When absent (older shapes), the rule MUST be
treated as `evenodd` (see GFX-D02 — this is the spec's only explicit statement on the matter, and
matches the historical default).

Shape records:

| Record | Flags (2-bit type) | Payload |
| --- | --- | --- |
| `EndShapeRecord` | `00` | `5 bits` of zero flags |
| `StyleChangeRecord` | `10` | see below |
| `StraightEdgeRecord` | `11` | 4-bit (`NumBits=2` → `GeneralLineFlag`, …), delta X/Y with 2/4/8/16-bit sizes |
| `CurvedEdgeRecord` | `01` | 4-bit counts, control delta, anchor delta |

`STYLECHANGERECORD` carries: `StateNewStyles`(1), `StateLineStyle`(1), `StateFillStyle1`(1),
`StateFillStyle0`(1), `StateMoveTo`(1), then optional move delta (5-bit `Nbits` + `SB` pairs),
optional fill/line style indices (UI16), and, when `StateNewStyles`, complete new style lists.

**SWF-R027** Edge records MUST be accumulated into runs: consecutive edges belong to the same run
until a style change, an `EndShapeRecord`, or a `MoveTo` occurs. Run closure is **implicit**: if a
run's last point ≠ its first point, the consumer MUST auto-close (GFX-§5.3) unless the run was
terminated by an explicit move that left a dangling path (`closed: false` in the Vector IR).

**SWF-R028** Coordinate values are twips (`1/20` CSS px). All edge deltas are relative to the last
pen position. The pen position is part of the shape state and MUST survive style changes that do
not move it.

**SWF-R029** Style indices are 1-based; `0` means "none". The Vector IR MUST use `null` for none and
preserve the 1-based index space (`fill0: 1..n`) to keep diagnostics readable.

**SWF-R030** Fill styles:

| Type | Meaning | Requires |
| --- | --- | --- |
| 0x00 | solid, `RGB`/`RGBA` (alpha only in Shape3/4) | — |
| 0x10 | linear gradient | matrix + stops |
| 0x12 | radial gradient | matrix + stops |
| 0x13 | focal radial gradient | + focal point (FIXED8, −1…1) |
| 0x40 | repeating bitmap | bitmap id + matrix (Shape3: also smoothing via the matrix's scale bits — see note) |
| 0x41 | clipped bitmap | as above |
| 0x42 | non-smoothed repeating bitmap | `DefineShape3+` (the "no smoothing" variants) |
| 0x43 | non-smoothed clipped bitmap | as above |

**SWF-R031** Bitmap fill matrix scale bits are overloaded: for `DefineShape`/`DefineShape2`
(SWF < 3 semantics) they follow the standard `MATRIX` layout, which historically confused
implementations; the reader MUST expose the scaling factor as a float and let GFX decide
(GFX-§9.5).

Line styles:

| Type | Structure | Notes |
| --- | --- | --- |
| `LINESTYLE` | width UI16 (twips), RGB | width 0 = hairline |
| `LINESTYLE2` | width, start cap, join, `HasFill`, `NoHScale`, `NoVScale`, `PixelHinting`, `NoClose`, miter limit (FIXED8), optional fill | caps: 0 round, 1 butt, 2 square; joins: 0 round, 1 bevel, 2 miter |

**SWF-R032** `PixelHinting` MUST be carried into the IR and honoured under
`graphics.settle: 'flash'` (GFX-§8.3).

**SWF-R033** `NoVScale`/`NoHScale` (stroke does not scale with the object) and
`NonScalingStroke` (Shape4) are semantically distinct; both MUST be represented explicitly, and
GFX MUST implement them by transforming stroke geometry in *stage* space rather than shape space.

### 6.2 Morph shapes

`DefineMorphShape` (46) / `DefineMorphShape2` (84) carry start and end shape editions plus a
per-placement `Ratio` (0–65535) on the `PlaceObject*` tag.

**SWF-R034** Morphing MUST be implemented by interpolating the *shape state* (fill/line style
values, edge coordinates) at the placement ratio, not by blending two renderings. Ch.9 defines
**one** interleaved morph style array, so style *counts* cannot differ; what the chapter does
require — and what the reader MUST assert — is that both editions have the **same edge count** and
the **same style-change records**, with the style arrays paired by index (`IMPL-070` `SF0261`/
`SF0265`; the earlier "style counts must match, `SF0130`" wording predates the Ch.9 read and the
code it named belongs to the button range).

**SWF-R035** Interpolation is linear on each coordinate in twips, in shape space, with no
re-tessellation of that interpolation at build time (GFX-§5.5 handles per-frame morph cost).

### 6.3 Text

`DefineText` (11) / `DefineText2` (33): a text matrix, optional colour transform, and text records
of glyph instances positioned by an advance matrix; `DefineEditText` (37) is the dynamic/input
field character.

**SWF-R036** Static text MUST be converted into glyph-quad geometry *at compile time* (AST-§4),
preserving the authored positioning (including authoring-tool kerning baked into the advance
matrix). It is not re-laid-out.

**SWF-R037** `DefineEditText` MUST be preserved declaratively (not baked) because its layout depends
on runtime variables (`variable`, `text`, `html`, `autoSize`, `wordWrap`, `embedFonts`,
`border`/`background`, `maxChars`, `restrict`, `multiline`, `password`). The declarative model lives
in AST-§4.4 and the layout engine in GFX-§10.

### 6.4 Fonts

`DefineFont` (10) / `DefineFont2` (48) / `DefineFont3` (75) / `DefineFont4` (91, CFF).

**SWF-R038** Glyph shape coordinates are in font units where the em square is **1024 units**
(`DefineFont`, `DefineFont2`) and glyphs in `DefineFont3` are expressed at **20× resolution**
(so 20480 units per em, i.e. 1/20 of a `DefineFont2` unit). The reader MUST expose a single
`unitsPerEm` per font so downstream stages never re-derive it (`SWF-D06`).

**SWF-R039** `DefineFont4` (CFF outlines, `HasFontData`) MUST be parsed for metadata and, when
outlines are present, converted to outlines by a CFF parser; when only a device-font reference is
present, `SF0140` (info) records the substitution decision (AST-§4.6).

**SWF-R040** Font layout info (`FontAscent`, `FontDescent`, `FontLeading`, `FontAdvanceTable`,
`FontBoundsTable`, `FontKerningTable`) MUST be carried through uncompressed and unscaled. Layout
bugs downstream are almost always a scale applied twice.

## 7. Hardening

SWF files in the wild are (a) frequently malformed and (b) a historic attack surface. Since
swf-forge runs these parsers in Node at build time on untrusted input, hardening is a requirement,
not a nicety.

**SWF-R041** Every loop MUST have a bounded iteration count derived from the containing tag length.
There MUST be no `while (true)` on input data anywhere.

**SWF-R042** Recursion MUST be bounded: sprite nesting depth ≤ 32 (`SF0103`), shape recursion is
impossible by construction, action-block nesting (`DefineFunction` inside `DefineFunction`) ≤ 64.

**SWF-R043** Total memory MUST be bounded by two knobs: `--max-decompressed-bytes` (512 MiB default)
and `--max-dictionary-entries` (2 000 000 default). Exceeding either is a fatal error, not a warning.

**SWF-R044** All integer arithmetic on user data MUST use `Math.imul`/`>>> 0` where overflow is
possible, and MUST NOT rely on `| 0` for correctness (it silently truncates 64-bit file offsets).

**SWF-R045** The parser MUST NOT execute anything: no `eval`, no dynamic import, no plugin loading.

**SWF-R046** Fuzzing is required before 1.0: a `swffuzz` target feeding mutated corpora to S0–S3,
run in CI for a fixed budget per PR, with longer nightly runs. Crashes (uncaught exceptions) are
always bugs, even when the input is nonsense.

**SWF-R047** Diagnostics from malicious input MUST NOT be used to build paths (no filename
derivation from SWF string tables without sanitisation; see SEC-§4).

## 8. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| T-SWF-001 | Header/version/compression matrix, incl. `ZWS` | F1 |
| T-SWF-002 | Truncated file at every tag boundary: no throw, diagnostics present | F1 |
| T-SWF-003 | `RECORDHEADER` long form at exactly 62/63 bytes | F1 |
| T-SWF-004 | `RECT`/`MATRIX`/`CXFORM` round-trip against hand-computed vectors | F2 |
| T-SWF-005 | Shape record decoding for all edge sizes (2/4/8/16-bit) | F1 |
| T-SWF-006 | Style-change-into-new-styles with bitmap fills | F1 |
| T-SWF-007 | Duplicate character ids, missing characters | F1 |
| T-SWF-008 | Sprite nesting depth boundary (31/32/33) | F1 |
| T-SWF-009 | Bit-reader drift: every fixture parses to identical offsets twice | F1 |
| T-SWF-010 | Fuzz corpus: 10⁶ mutations, zero uncaught exceptions | F1 |
| T-SWF-011 | Memory bound: 512 MiB bomb rejected without OOM | F1 |
| T-SWF-012 | Determinism: two parses produce identical tag indices | F1 |

## 9. Decision register

| ID | Decision | Default | Verification | Notes |
| --- | --- | --- | --- | --- |
| SWF-D01 | Accept SWF versions 1–3 (pre-AVM1-v5 semantics)? | Parse and warn `SF0002`; games below v6 may misbehave | T-SWF-015 | AVM1 semantics differ (`Add` vs `Add2`) |
| SWF-D02 | ZWS/LZMA support behind a flag? | On if the LZMA dep is available, else `error` `SF0006` | SEC-§5 | Determinism unaffected |
| SWF-D03 | Tolerate wrong `FileLength` | Yes (`--tolerate-length`) | SWF-R009 | Real-world necessity |
| SWF-D04 | `DefineShape4` winding flag handling | Honour the flag; default `evenodd` when absent | GFX-D02 | Only Shape4 states it |
| SWF-D05 | CXFORM multiply division: truncate vs round | Truncate (`>> 8`) on integer paths, shader float path uses `*1/256` | T-GFX-031 | Oracle compare |
| SWF-D06 | `unitsPerEm` exposure | Explicit field per font (1024 or 20480) | T-SWF-020 | Unit bugs are the #1 text bug |
| SWF-D07 | Carry `Metadata`/XMP into the emitted project? | Yes, as `movie.metadata` in the manifest | AST-§5 | Useful provenance |
| SWF-D08 | Path sanitisation for emitted asset names | Only content hashes and sanitised linkage ids | SEC-§4 | Never raw SWF strings |
| SWF-D09 | Tags inside a sprite outside Ch.13's valid set (`PlaceObject3`, `VideoFrame`, …) | Decode normally + `SF0129` (info) once per kind; definition tags inside a sprite are ignored for the dictionary (`SF0128`) | T-SWF-021 | The chapter's list predates the later tags; rejecting them would refuse real content |

## 10. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | First draft |
| 1.1 | 2026-10-04 | Diagnostic citations re-pointed to the owning implementation docs (`SF0121` -> `SF0109`, `SF0122` -> `SF0110`); `SWF-R034` rewritten to the Ch.9 morph model (one interleaved style array; equal edge counts and identical style-change records required) so it no longer cites the button-range `SF0130`; errata `E-016` |
| 1.2 | 2026-10-04 | Ch.13 ripple: decision `SWF-D09` (tolerate tags inside sprites outside the chapter's list; ignore definition tags there) and test `T-SWF-021` added, matching `IMPL-030` §8 (`SF0128`/`SF0129`) |
