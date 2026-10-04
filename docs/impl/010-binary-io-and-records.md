# IMPL-010 — Binary IO and Primitive Records

**Doc ID:** IMPL-010 · **Status:** ✅ grounded in Ch.1 · **Package:** `@swf-forge/swf`
**Format spec:** Chapter 1 — Basic Data Types (twips, integer types and byte order, fixed-point,
floating-point, encoded integers, bit values, string values, language code, RGB/RGBA/ARGB, RECT,
MATRIX, CXFORM, CXFORMWITHALPHA)
**Design specs:** SWF-§4 (bit-level IO), SWF-R016…R022, SWF-§6.1, APP-§10

---

## 1. What this document delivers

The lowest layer of the entire project: a cursor over bytes with bit-level reads, plus every primitive
record that the rest of the parser is built from. Everything above this layer (tags, shapes, actions)
depends on these behaviours being exactly right, and every bug here presents downstream as "weird
data".

Deliverables:

1. `Cursor` — a bounds-checked byte+bit reader with soft (diagnostic) and strict (throwing) modes.
2. Primitive value readers: integers (1/2/3/4/8-byte), fixed-point, floats, `EncodedU32`, bit fields
   (`UB`/`SB`/`FB`), strings, colour records, language codes.
3. Composite record readers: `RECT`, `MATRIX`, `CXFORM`, `CXFORMWITHALPHA`.
4. Data structures consumed by every later stage (`Rect`, `Mat2D`, `Cxform`, `Rgba`).
5. The diagnostic code allocation for the IO range, and the shared `DiagnosticSink`.
6. Test vectors plus property tests over a paired *writer*, so that round-trips are proven.

**Non-goals:** tag framing and the dictionary (doc 020), shape/action decoding (docs 060/050), and any
interpretation of what the values *mean* (e.g. whether a scale is 0.5 means "half size" — that is the
renderer's business).

## 2. Module layout

```
packages/swf/src/
  io/
    cursor.ts          Cursor: position, bounds, alignment, soft/strict, sub-readers
    integers.ts        u8/s8/u16/s16/u24/u32/s32/u64 + EncodedU32
    real.ts            fixed16_16, fixed8_8, float16, float32, float64
    bits.ts            readUb / readSb / readFb + padding policy
    strings.ts         readString + UTF-8 / legacy decoding, caps
    colour.ts          readRgb / readRgba / readArgb, LanguageCode
    records.ts         readRect / readMatrix / readCxform / readCxformWithAlpha
    types.ts           Rect, Mat2D, MatrixDecomposition, Cxform, Rgba, LanguageCode
  diagnostics/
    codes.ts           SF code registry (single source of truth for the numeric allocation)
    sink.ts            DiagnosticSink (collect, dedupe, order), severity, scope
  test-support/
    writer.ts          bit/byte writer used only by tests and the fixture generator (doc 140)
```

**IMPL-010-R001** `test-support/writer.ts` MUST NOT be importable from production entry points; it is
exported from a `./test-support` subpath that the packaging step excludes from the type bundle's
public API surface.

**IMPL-010-R002** `codes.ts` MUST be the only place where an `SF` number appears as a literal. Every
other module refers to `Codes.IO_STRING_TRUNCATED` style constants, so renumbering is mechanical
(see errata E-002, which was exactly this kind of change).

## 3. Public API

### 3.1 Cursor

```ts
/** A bounds-checked reader over a byte buffer. One instance per parse (never shared across tags). */
export class Cursor {
  constructor(
    readonly bytes: Uint8Array,
    offset?: number,
    /** Exclusive upper bound. Defaults to bytes.length. */
    limit?: number,
    opts?: CursorOptions,
  );

  /** Absolute byte offset of the next unread byte. */
  get offset(): number;
  /** Bits already consumed inside the current byte (0..7). */
  get bitOffset(): number;
  /** Bytes remaining from the current position (fractional bytes count as 1). */
  get remaining(): number;
  /** Diagnostics collected since construction. */
  get diagnostics(): readonly Diagnostic[];

  /** A bounded window sharing this buffer (zero copy). The parent position is untouched. */
  subCursor(length: number, opts?: CursorOptions): Cursor;
  /** A copy of the next `length` bytes (used for payloads handed to workers/decoders). */
  takeBytes(length: number): Uint8Array;
  /** A view of the next `length` bytes (no copy) — for large payloads (images, audio, action bytecode). */
  viewBytes(length: number): Uint8Array;
  /** A copy of the whole remaining buffer and advance to the limit. */
  rest(): Uint8Array;

  seek(absoluteOffset: number): void;
  skip(bytes: number): void;
  /** Discard remaining bits in the current byte (padding per Ch.1). */
  align(): void;
  /** True when positioned exactly on a byte boundary. */
  get isByteAligned(): boolean;

  // byte-aligned readers
  u8(): number;  s8(): number;
  u16(): number; s16(): number;
  u24(): number;                 // little-endian 24-bit; the spec's UI24 arrays
  u32(): number; s32(): number;
  u64(): bigint;                 // UI64 arrays; bigint preserves the full range
  fixed(): number;               // 32-bit 16.16  → float64
  fixed8(): number;              // 16-bit 8.8    → float64
  float16(): number;             // IEEE binary16 → float64
  float32(): number;
  float64(): number;
  encodedU32(): number;          // 1..5 bytes, little-endian base-128
  string(opts?: StringReadOptions): string;

  // bit readers
  ub(bits: number): number;      // unsigned
  sb(bits: number): number;      // two's complement
  fb(bits: number): number;      // signed fixed point with `bits - 16` integer bits
}

export interface CursorOptions {
  /** 'soft' (default) records a diagnostic and yields 0; 'strict' throws SwfReadError. */
  mode?: 'soft' | 'strict';
  /** Diagnostics sink to append to (defaults to the cursor's own). */
  sink?: DiagnosticSink;
  /** Used in diagnostic scopes for messages like "while reading RECT inside PlaceObject2". */
  context?: string;
}

export interface StringReadOptions {
  /** Movie version; decides UTF-8 (≥ 6) vs legacy encoding (≤ 5). */
  version?: number;
  /** How to decode when version ≤ 5 and no better signal exists. Default 'windows-1252'. */
  legacyEncoding?: 'windows-1252' | 'latin1' | 'shift-jis';
  /** Hard cap on decoded bytes. Default 65536. */
  maxBytes?: number;
}
```

### 3.2 Composite readers (free functions, not methods)

Records are parsed by functions so they can be unit-tested against synthetic cursors and so a caller
can parse a record out of any position without subclassing the cursor.

```ts
export function readRect(c: Cursor): Rect;
export function readMatrix(c: Cursor): Mat2D;
export function readCxform(c: Cursor): Cxform;
export function readCxformWithAlpha(c: Cursor): Cxform;
export function readRgb(c: Cursor): Rgba;
export function readRgba(c: Cursor): Rgba;
export function readArgb(c: Cursor): Rgba;
export function readLanguageCode(c: Cursor): LanguageCode;
```

## 4. Contract details

### 4.1 Byte order and bit order

| Aspect | Rule |
| --- | --- |
| Multi-byte integers | little-endian (least significant byte first) |
| Bit order within a byte | most significant bit first |
| Bit-field values | accumulated MSB-first across bytes |
| Alignment | integer/float/fixed types are byte-aligned by the format; bit fields are not |
| Padding | after a bit field, an alignment to the next byte discards the remaining low bits of the current byte |

**IMPL-010-R003** All multi-byte reads MUST go through a cached `DataView` on the underlying
`ArrayBuffer` (`DataView.getUint16(offset, true)` etc.). Hand-rolled shifts are permitted only where a
`DataView` cannot express the operation (`u24`, `u64`, bit fields).

**IMPL-010-R004** `u24()` MUST read `b0 | (b1 << 8) | (b2 << 16)`; the spec's type table lists
`UI24[n]` arrays and no `SI24`, so no signed 24-bit reader is provided. (If a future chapter shows one,
add `s24()` and extend this document.)

**IMPL-010-R005** `u64()` MUST return `bigint`. `UI64[n]` arrays exist in the type table but do not
appear in AVM1-era tags; a `number` reader would silently lose precision and is therefore forbidden.

### 4.2 Alignment and padding policy

**IMPL-010-R006** `align()` MUST NOT validate that the discarded bits are zero by default (real files
routinely violate the padding rule). With `--strict-bits`, a non-zero padding byte MUST produce
`SF0008` (warning) naming the offset — never an error.

**IMPL-010-R007** Bit readers MUST accept `bits === 0` and return `0` without moving the cursor. This
occurs legitimately (e.g. an empty `Nbits` field on a degenerate record) and is a favourite crash site
of naïve implementations.

**IMPL-010-R008** Bit readers MUST reject `bits > 32` with `SF0003`-class strictness (error in strict
mode, zero + `SF0014` in soft mode). No structure in AVM1-era SWF uses more than 32 bits in one field;
a request for more indicates a corrupted length field, and silently reading 60 bits would desynchronise
the whole parse.

### 4.3 Bounds and failure model

**IMPL-010-R009** Every read MUST satisfy `offset + size ≤ limit` **before** reading. On violation:

| Mode | Behaviour |
| --- | --- |
| `soft` (parser default) | append `SF0013` (warning) with the requested size and the enclosing context, return `0`/`''`, and leave the cursor at `limit` |
| `strict` (tests, fuzzing, `--strict`) | throw `SwfReadError { code: 'SF0013', offset, requested, context }` |

**IMPL-010-R010** A cursor MUST be usable after a soft violation (reads that fit continue to work), so
that a damaged tag does not prevent reading its siblings. This is what makes partial recovery in
`swfforge inspect` possible.

**IMPL-010-R011** `subCursor(length)` MUST clamp `length` to the remaining bytes, record `SF0013` when
it clamps, and produce a child whose diagnostics are appended to the *parent's* sink (one sink per
movie, not per tag) unless an explicit sink is passed.

### 4.4 Determinism

**IMPL-010-R012** Readers MUST NOT depend on locale, time, or ambient state; `string()` decoding MUST
use explicit codecs (`TextDecoder('utf-8')` constructed once per process and reused), never
platform-specific fallbacks.

## 5. Primitive implementations

### 5.1 `EncodedU32` (little-endian base-128)

```
value = 0; shift = 0; count = 0
loop:
  byte = u8()
  count += 1
  if count == 5:
      value |= (byte & 0x0F) << 28          // only 4 significant bits remain (32 total)
      if (byte & 0x7F) > 0x0F -> SF0009 (overlong / value exceeds 32 bits), mask the excess
      if (byte & 0x80)        -> SF0009 (continuation after 5 bytes) and stop
      break
  value |= (byte & 0x7F) << shift
  if (byte & 0x80) == 0: break
  shift += 7
return value >>> 0
```

Rules:

- **IMPL-010-R013** The result MUST be an unsigned 32-bit `number` (`>>> 0`) — never a signed result.
  `(b << 28)` with `b ≥ 8` overflows into the sign bit; masking the 5th byte to 4 bits and finishing
  with `>>> 0` is mandatory. This is the single most common bug in hand-written `EncodedU32` readers.
- **IMPL-010-R014** Encodings longer than necessary (e.g. `0x80 0x00` for zero) MUST be accepted but
  reported once per movie with `SF0009` (info), because they are a fingerprint of a misbehaving writer
  and of certain obfuscators.
- **IMPL-010-R015** This reader MUST NOT be shared with the AVM2 `u30` decoder. They look alike but
  differ in length limits and semantics; sharing them couples our AVM1 parser to a format we do not
  support (ARCH-§3).

### 5.2 Bit fields

```
ub(n)  = MSB-first accumulation of n bits, zero-extended
sb(n)  = v = ub(n); v >= 2^(n-1) ? v - 2^n : v            // sign extension
fb(n)  = sb(n) / 65536                                    // fixed point, `n - 16` integer bits
```

- **IMPL-010-R016** `sb(32)` MUST be special-cased: `2^32` is not exactly representable via shifts, and
  `v - 2**32` must be computed with `2**32` as a `number` (exact) rather than `1 << 32` (which is `1`).
  A unit test with `sb(32)` values `0x7FFFFFFF`, `0x80000000`, `0xFFFFFFFF` is required.
- **IMPL-010-R017** `fb(n)` MUST be `sb(n) / 65536`, using the *signed* interpretation first. For
  `n < 16` the value has fewer than 16 fractional bits and lies in `(-2^(n-16), 2^(n-16))`; for
  `n = 19`, the bit pattern `0x30000` MUST yield exactly `3.0` (Ch.1 example).
- **IMPL-010-R018** `ub`/`sb`/`fb` MUST read across byte boundaries without extra bookkeeping (the
  cursor keeps `bitOffset`), and MUST be capped at 32 bits per call (IMPL-010-R008).

### 5.3 Fixed-point and floats

| Type | Implementation | Notes |
| --- | --- | --- |
| `FIXED` (16.16) | `s32() / 65536` | Division is exact (power of two); never use `* 1/65536` with a rounded constant |
| `FIXED8` (8.8) | `s16() / 256` | Exact; used for miter limits (`Ch.6`) and focal points (`Ch.7`) |
| `FLOAT` | `getFloat32(o, true)` | |
| `DOUBLE` | `getFloat64(o, true)` | |
| `FLOAT16` | explicit expansion (below) | IEEE 754 binary16 per errata E-004 |

```
float16(h):
  sign = (h >> 15) & 1
  exp  = (h >> 10) & 0x1F
  man  = h & 0x3FF
  if exp == 0:            value = man * 2^-24                  // subnormal; man == 0 → ±0
  else if exp == 31:      value = man == 0 ? Infinity : NaN
  else:                   value = (1 + man / 1024) * 2^(exp - 15)
  return sign ? -value : value
```

- **IMPL-010-R019** `float16` MUST preserve the sign of zero (`0x8000 → -0`) and MUST produce a NaN
  (payload canonicalised to the platform NaN) for `exp == 31 && man != 0`, reporting `SF0015` (info)
  once per movie. Comparing NaN must never be used for control flow in the readers.
- **IMPL-010-R020** Readers MUST NEVER narrow a value to `float32` (`Math.fround`) on the way to the
  model (REPO-R010); narrowing happens only where a GPU upload requires it, and is documented there.

### 5.4 Strings

- **IMPL-010-R021** A string is a NUL-terminated byte sequence. Termination is on the first `0x00`
  byte, never on a decoded character.
- **IMPL-010-R022** For `version ≥ 6`, decode as UTF-8 with `fatal: false`; an invalid sequence is
  replaced with U+FFFD and reported once per movie with `SF0011` (warning).
- **IMPL-010-R023** For `version ≤ 5` the encoding is not recorded in the file (the player guessed from
  the running locale). Our policy, in priority order:
  1. explicit config `legacyStringEncoding`;
  2. Shift-JIS when the movie contains a `DefineFontInfo` with the ShiftJIS flag (doc 080 supplies
     this signal through a pre-scan);
  3. otherwise Windows-1252 (a superset of Latin-1 for the printable range).
  Every legacy decode reports `SF0012` (info) once per movie, naming the chosen encoding, so a porter
  can see why their "é" is right or wrong. (Design spec AVM1-D01.)
- **IMPL-010-R024** Decoded length is capped by `maxBytes` (default 64 KiB) measuring *raw* bytes;
  exceeding it yields a truncated string plus `SF0010` (warning). This bounds memory on hostile input
  and never triggers on real content.
- **IMPL-010-R025** `string()` MUST NOT be used for byte payloads that merely happen to be
  NUL-terminated (e.g. action bytecode); those use `viewBytes`/`takeBytes`.

### 5.5 Colour records and language code

| Record | Layout | Trap |
| --- | --- | --- |
| `RGB` | R, G, B (UI8 ×3) | — |
| `RGBA` | R, G, B, **A** | alpha last |
| `ARGB` | **A**, R, G, B | alpha first; `DefineBitsLossless2` ARGB4444 is *premultiplied* (doc 070) |

- **IMPL-010-R026** Colour readers MUST return `Rgba` with `a = 255` when the source record has no
  alpha; returning `a = 0` (the "uninitialised struct" bug) makes entire movies invisible.
- **IMPL-010-R027** `LanguageCode` values `0…5` are known (`0` = none/locale-dependent, `1` Latin,
  `2` Japanese, `3` Korean, `4` Simplified Chinese, `5` Traditional Chinese). Unknown values MUST
  return the raw number and report `SF0014` (info); they MUST NOT be clamped, because a future version
  may add codes and the value is round-tripped into the model.

### 5.6 `RECT`

```
Nbits  = ub(5)
Xmin   = sb(Nbits); Xmax = sb(Nbits); Ymin = sb(Nbits); Ymax = sb(Nbits)
align()
```

- **IMPL-010-R028** `readRect` MUST `align()` before returning: the record is followed by byte-aligned
  fields in every consumer (the header's `FrameRate` is the first example). Appendix A confirms both
  the *start*-aligned reading and the trailing padding: its `FrameSize` rect is 65 bits of payload
  followed by 7 zero padding bits (9 bytes), and its shape-bounds rect 61 bits followed by 3 (8 bytes) —
  the same rule as `E-001`'s field order, and `T-TST-102` asserts both.
- **IMPL-010-R029** `Nbits > 31` MUST be rejected as corruption (`SF0020`, error) — 5 bits can express
  0…31, and a 31-bit *signed* coordinate is already outside the twip range any real movie uses
  (±2^30 twips ≈ ±53 000 km). Values beyond our plausibility bound (`|coord| > 2^27` twips ≈ 6.7 M px)
  are reported with `SF0014` (info) and kept as-is.
- **IMPL-010-R030** `readRect` MUST NOT normalise the rect (no swapping `min`/`max`, no zeroing
  negative extents). Consumers that require a normalised box (e.g. bounds culling) do so explicitly,
  recording `SF0111` (warning) when they had to (see errata E-001).
  **Appendix A corroboration.** The Appendix A worked example's header `RECT` (`Nbits` 15; Xmin 0,
  Xmax 11000, Ymin 0, Ymax 8000 twips) and its shape-bounds `RECT` (`Nbits` 14; 2010/4910/1670/4010)
  both put **Xmin first** with no byte swap, which is the resolution `E-001` chose; the fixture
  (`T-TST-102`) therefore doubles as the regression test for this reader.


### 5.7 `MATRIX`

```
hasScale  = ub(1)
if hasScale:  nScaleBits = ub(5); scaleX = fb(nScaleBits); scaleY = fb(nScaleBits)
else:         scaleX = scaleY = 1.0
hasRotate = ub(1)
if hasRotate: nRotateBits = ub(5); rotateSkew0 = fb(nRotateBits); rotateSkew1 = fb(nRotateBits)
else:         rotateSkew0 = rotateSkew1 = 0.0
nTranslateBits = ub(5); translateX = sb(nTranslateBits); translateY = sb(nTranslateBits)
align()
```

Result mapping (our `Mat2D`):

| Mat2D | MATRIX field | Default when absent |
| --- | --- | --- |
| `a` | `ScaleX` | `1` |
| `b` | `RotateSkew0` | `0` |
| `c` | `RotateSkew1` | `0` |
| `d` | `ScaleY` | `1` |
| `tx` / `ty` | `TranslateX` / `TranslateY` (twips) | `0` |

Point mapping: `x' = a·x + b·y + tx`, `y' = c·x + d·y + ty` (row-major, as printed in Ch.1's
2×3 table).

- **IMPL-010-R031** Absent scale MUST default to `1.0`, not `0`. This is the single highest-frequency
  MATRIX bug: translation-only matrices are the most common matrix in the format, and defaulting the
  scale to zero makes every such object invisible and its bounds empty.
- **IMPL-010-R032** `fb(n)` values are already in the fixed-point domain; readers MUST NOT re-apply a
  `/65536` conversion (double-scaling turns everything into a speck).
- **IMPL-010-R033** `readMatrix` MUST `align()` before returning (matrices are followed by
  byte-aligned fields in `PlaceObject*`, `DefineText`, gradients, and bitmap fills).
- **IMPL-010-R034** Translation MUST be exposed in twips (the stored unit) with a derived
  `translatePx` accessor; twips→px conversion happens exactly once, in the renderer's normalisation
  pass (GFX-R017).
- **IMPL-010-R035** Where a *rotation* is required, the decomposition MUST come from
  `decomposeMatrix()` (below), which encodes the committed sign convention of errata E-005 in one
  place. A unit test MUST assert a +90° rotation maps the local +x axis to the screen +y axis
  (clockwise-positive in y-down space).

```ts
export function decomposeMatrix(m: Mat2D): MatrixDecomposition;
// rotationDeg = atan2(c, a) in degrees          [clock-positive in y-down space; see E-005]
// scaleX      = hypot(a, c)
// det         = a*d - b*c
// scaleY      = det / scaleX                     [signed: preserves reflection]
// skewXDeg    = atan2(a*b + c*d, det)            [0 when the axes are perpendicular]
```

### 5.8 `CXFORM` and `CXFORMWITHALPHA`

```
hasAdd  = ub(1); hasMult = ub(1); nBits = ub(4)
if hasMult: rMul = sb(nBits); gMul = sb(nBits); bMul = sb(nBits) [; aMul = sb(nBits)]
if hasAdd:  rAdd = sb(nBits); gAdd = sb(nBits); bAdd = sb(nBits) [; aAdd = sb(nBits)]
align()
```

Defaults: absent multiply terms = **256** (1.0 in 8.8), absent add terms = **0**; alpha terms default
the same way.

- **IMPL-010-R036** The multiplier domain is 8.8 with `256 == 1.0`. Readers MUST store the raw integers
  (`rm`…`aa`) so that the arithmetic in SWF-R021 keeps full fidelity, and MUST additionally expose the
  float view used by the shader path: `mult = m / 256`, `add = a / 255` (note the different
  denominators — a classic porting mistake).
- **IMPL-010-R037** `CXFORM` and `CXFORMWITHALPHA` MUST share one implementation parameterised by
  `hasAlpha`; two copies will drift, and the failure mode (alpha silently ignored on text) is subtle.
- **IMPL-010-R038** A CXFORM with `nBits == 0` and `hasMult == 1` is legal-but-degenerate (all terms
  read as 0 → fully black); report `SF0014` (info) and keep the values.
- **IMPL-010-R039** `readCxform*` MUST `align()` before returning.

## 6. Data structures

```ts
/** Twips unless a name says otherwise. */
export interface Rect { xMin: number; xMax: number; yMin: number; yMax: number; }

/** Affine 2×3. tx/ty are in twips; a,b,c,d are unitless. */
export interface Mat2D { a: number; b: number; c: number; d: number; tx: number; ty: number; }

export interface MatrixDecomposition {
  rotationDeg: number;   // clock-positive in y-down space (E-005)
  scaleX: number;
  scaleY: number;        // signed
  skewXDeg: number;      // 0 for perpendicular axes
  translatePx: { x: number; y: number };
}

/** Colour transform: `m` terms are 8.8 (256 = 1.0); `a` terms are raw 0..255 offsets. */
export interface Cxform {
  rm: number; gm: number; bm: number; am: number;
  ra: number; ga: number; ba: number; aa: number;
}

export interface Rgba { r: number; g: number; b: number; a: number; }

export const enum LanguageCode {
  None = 0, Latin = 1, Japanese = 2, Korean = 3,
  SimplifiedChinese = 4, TraditionalChinese = 5,
}

export const TWIPS_PER_PIXEL = 20;
export const toPixels = (twips: number): number => twips / TWIPS_PER_PIXEL;
```

**IMPL-010-R040** `TWIPS_PER_PIXEL` and `toPixels` MUST be defined once per package lineage
(REPO-R008) and re-exported, never re-declared.

## 7. Diagnostics

IO-range allocation (`SF0001–0019`); container-range (`SF0020–0049`) and tag-level range
(`SF0100–0199`) are owned by doc 020 and declared here so there is exactly one registry. Doc 020's
§9 carries the tag-level table (`SF0101`–`SF0109` today).

Per-document sub-allocations inside the tag and media ranges (one owner per range; **a new code MUST be
taken from the owning document's range, and a range MAY only be extended by taking the next free block
and recording it here**). Errata `E-011` records the two corrections that produced this table:

| Range | Owner | Contents |
| --- | --- | --- |
| `SF0100–0109` | 020 | tag framing, dictionary, stream order (the block's owner allocates `SF0100`–`0199`; the rows below sub-allocate from it) |
| `SF0110–0129` | 030 | placements, filters, clip events (100 cites `SF0110`, owned here by 030) |
| `SF0130–0139` | 100 | buttons and hit testing |
| `SF0150–0179` | 040 | control tags, metadata, scenes, file attributes |
| `SF0180–0195` | 060 | shape record streams, styles, gradients (`SF0190` dedupe ceiling, `SF0191` reserved-feature use, `SF0192`–`SF0195` gradient modes/ramps/focal) |
| `SF0140–0149` | spare | — (020's block, unallocated) |
| `SF0196–0199` | spare | — (020's block, unallocated) |
| `SF0200–0239` | design specs | **not ours**: `GFX` `SF0201`/`SF0207`/`SF0210`, `AST` `SF0203`–`SF0206`, `SF0211`–`SF0213`, `SF0220`, `SF0230`/`SF0231` (Ch.9 pass, errata `E-015`); impl ranges deliberately skip this block |
| `SF0240–0249` | 110 | video codecs, stream tags (`SF0249` = transcode quality gate) |
| `SF0250–0269` | 070 | bitmaps, lossless images, morph shapes |
| `SF0270–0289` | 080 | fonts, glyphs, text (`SF0286`–`SF0288` spare in-block) |
| `SF0290–0299` | 110 | video extensions (Screen Video v2 and codec additions, Ch.14/`E-021`; `SF0296`/`SF0298` spare) |
| `SF0300–0309`, `SF0324–0332` | 090 | audio (`SF0301`–`SF0309` meanings shared with `docs/specs/060-audio-web.md`; `SF0320`–`SF0323` are that spec's runtime codes) |
| `SF0400–0424` | 050 | AVM1 decode/analysis (`SF0411`–`SF0422` added in the Ch.5 pass; `SF0423`/`SF0424` are the design spec's `ToPrimitive` recursion guard and prototype-chain cycle) |
| `SF0500–0599` | 120 | emitter/codegen (range reserved by CMP-§9.3; `SF0501`/`SF0502` = budget diagnostics) |
| `SF0600–0699` | 130 | runtime contract, manifest, shell (the emitter writes the manifest but the contract's codes are the runtime doc's) |
| `SF0700–0799` | — | security/policy (SEC) |
| `SF0800–0899` | 160 | clean-engine transforms and runtime (`SF0801`–`SF0871`; `SF0880`–`0899` spare) |
| `SF0900–0999` | 150 | code-inspector loading, indexing, navigation, run view (`SF0901`–`SF0909`; `SF0910`–`0999` spare) |
| `SF1000+` | 050 | fatal, non-recoverable: `SF1000` is the AVM2 gate (`IMPL-050` §9), raised by 020/040 and propagated by 120; exit 3 |

| Code | Severity | Meaning | Design ref |
| --- | --- | --- | --- |
| `SF0001` | error | not a SWF (signature mismatch) | — |
| `SF0002` | warning | SWF version below the AVM1 baseline (< 4) | SWF-D01 |
| `SF0003` | error | decompression failed / stream unusable | — |
| `SF0004` | warning | decompressed longer than declared `FileLength` | SWF-R009 |
| `SF0005` | warning | decompressed shorter than declared `FileLength` | SWF-R009 |
| `SF0006` | error | `ZWS` present but no LZMA decoder available | SWF-D02 |
| `SF0007` | error | decompressed output exceeds the configured cap | SWF-R010 |
| `SF0008` | warning | non-zero padding bits discarded by `align()` (`--strict-bits`) | IMPL-010-R006 |
| `SF0009` | warning / info | overlong or 5-byte-overflowing `EncodedU32` | IMPL-010-R013/014 |
| `SF0010` | warning | string truncated at the configured cap | IMPL-010-R024 |
| `SF0011` | warning | invalid UTF-8 replaced with U+FFFD | IMPL-010-R022 |
| `SF0012` | info | legacy (≤ SWF 5) string decoded with the fallback encoding | AVM1-D01 |
| `SF0013` | warning | read beyond the declared bounds (soft mode; value zeroed) | SWF-R004 |
| `SF0014` | info | value outside the documented range (degenerate `Nbits`, unknown `LanguageCode`) | — |
| `SF0015` | info | `FLOAT16` NaN/Inf payload canonicalised | E-004 |
| `SF0016` | warning | bit-field width > 32 requested | IMPL-010-R008 |
| `SF0020` | error | `RECT` `Nbits > 31` (corrupt header or shape bounds) | IMPL-010-R029 |
| `SF0021` | warning | header `FrameSize` has non-zero `Xmin`/`Ymin` | doc 020 |
| `SF0022` | info | frame rate outside the plausible range (1…240) | doc 020 |
| `SF0023` | warning | `FrameCount` disagrees with the observed `ShowFrame` count | doc 020 |
| `SF0024` | info | trailing bytes after the `End` tag | doc 020 |
| `SF0025` | warning | `FileAttributes` is not the first tag (SWF ≥ 8) | doc 020 |
| `SF0026` | warning | tag ordering rule violated (definition after use, stream sound out of order) | doc 020 |
| `SF0027` | warning | `ZWS` `compressedLength` disagrees with the bytes present | doc 020 |
| `SF0028` | warning | `FileLength` implausible (< 8 or > 2 GiB) | doc 020 |
| `SF0029` | error | `FrameSize` has non-positive width or height | doc 020 |
| `SF0030` | info | long header used although the body is < 63 bytes | doc 020 |
| `SF0031` | error | dictionary entry cap exceeded | doc 020 |
| `SF0032` | warning | streaming sound tags out of order | doc 020 |
| `SF0033` | info | non-canonical compression (e.g. `CWS` below version 6) | doc 020 |

**IMPL-010-R041** Every diagnostic MUST carry: `code`, `severity`, `message` (one sentence, no trailing
period), `offset` (absolute), `context` (the enclosing structure, e.g. `"RECT in FrameSize"`), and —
where applicable — `characterId`, `tagCode`, and `decision`.

**IMPL-010-R042** The sink MUST deduplicate by `(code, context, characterId)` and count repeats, so a
file with 40 000 bad strings produces one `SF0011` line with a count (CMP-R030's ordering rule still
applies).

## 8. Test obligations and vectors

| ID | Test | Level |
| --- | --- | --- |
| `T-SWF-001` | header/version/compression matrix (in doc 020) | F1 |
| `T-SWF-003` | `RECORDHEADER` short/long boundary at 62/63 bytes (doc 020) | F1 |
| `T-SWF-004` | primitive vectors below, exact equality | F1 |
| `T-SWF-009` | two parses of every fixture produce identical offsets and values | F1 |
| `T-SWF-013` | MATRIX rotation convention round-trip (E-005) | F2 |
| `T-SWF-014` | property test: `writer → reader → writer` is a fixed point for 10⁵ random values | F1 |
| `T-SWF-015` | soft-mode recovery: a corrupt record yields a diagnostic and later records still parse | F1 |
| `T-SWF-016` | strict mode throws `SwfReadError` with the documented code and offset | F1 |
| `T-SWF-017` | zero allocations from a warm cursor over 10⁶ reads (allocation counter) | F1 |

### Vector table

| Value | Bytes (hex) | Expected | Source |
| --- | --- | --- | --- |
| `UI32` `0x456e7120` | `20 71 6e 45` | `1163342112` | Ch.1 |
| `UI16` `0xe712` | `12 e7` | `59154` | Ch.1 |
| `UI24` `0x123456` | `56 34 12` | `1193046` | type table |
| `FIXED` `7.5` | `00 80 07 00` | `7.5` | Ch.1 |
| `EncodedU32` `0x7F` | `7f` | `127` | derived |
| `EncodedU32` `300` | `ac 02` | `300` | derived |
| `EncodedU32` `0xFFFFFFFF` | `ff ff ff ff 0f` | `4294967295` | derived |
| `EncodedU32` overlong | `80 80 80 80 80` | `0` + `SF0009` | IMPL-010-R013 |
| `UB[4]` | `1110····` | `14` | Ch.1 |
| `SB[4]` | `1110····` | `-2` | Ch.1 |
| `SB[7]` | `0100011·` | `35` | Ch.1 |
| `FB[19]` | `0 1100 0000 0000 0000 0000` → `0x30000` | `3.0` | Ch.1 |
| `FLOAT16` | `00 3c` | `1.0` | E-004 |
| `FLOAT16` | `00 3e` | `1.5` | E-004 |
| `FLOAT16` | `01 00` | `2^-24 ≈ 5.960464477539063e-8` | E-004 |
| `FLOAT16` | `00 7c` / `00 fc` | `+∞` / `-∞` | E-004 |
| `FLOAT16` | `00 7e` | `NaN` | E-004 |
| `FLOAT16` | `00 80` | `-0` | E-004 |
| `RECT` | `Nbits=11`, `127/260/15/514` | per values (labels are wrong upstream: E-001) | Ch.1 + E-001 |
| `MATRIX` translation-only | `hasScale=0, hasRotate=0, nTrans=13, tx=800, ty=-400` | `a=d=1, b=c=0` | IMPL-010-R031 |
| `MATRIX` rotation 90° | `fb ≈ (0, ±0.7071)` | `decompose().rotationDeg === 90`, local +x → screen +y | E-005 / T-SWF-013 |
| `CXFORM` identity | `hasMult=0, hasAdd=0` | `rm=gm=bm=am=256, add=0` | IMPL-010-R036 |
| `CXFORMWITHALPHA` 50% alpha | `mult` terms absent, `alpha add = 0`, `alpha mult = 128` | `am = 128` | derived |
| `STRING` UTF-8 | `41 42 c3 a9 00` | `"ABé"` | Ch.1 |
| `STRING` legacy | `41 e9 00` (SWF 5, Windows-1252) | `"Aé"` + `SF0012` | IMPL-010-R023 |
| `ARGB` | `ff 11 22 33` | `{r:0x11,g:0x22,b:0x33,a:0xff}` | Ch.1 |

## 9. Work packages

| WP | Title | Depends | Est | Deliverable |
| --- | --- | --- | --- | --- |
| WP-010-01 | Diagnostic sink + `SF` code registry | — | 1.5 | `diagnostics/{codes,sink}.ts`, dedupe + ordering tests |
| WP-010-02 | `Cursor` core: position, bounds, soft/strict, sub-cursors | WP-010-01 | 3 | `io/cursor.ts` + T-SWF-015/016 |
| WP-010-03 | Integer readers incl. `u24`, `u64`, `EncodedU32` | WP-010-02 | 2 | `io/integers.ts` + vectors |
| WP-010-04 | Bit readers `ub`/`sb`/`fb`, alignment, padding policy | WP-010-02 | 2 | `io/bits.ts` + T-SWF-004 bit rows |
| WP-010-05 | Fixed-point + float readers incl. `FLOAT16` | WP-010-02 | 1.5 | `io/real.ts` + E-004 vectors |
| WP-010-06 | Strings: UTF-8 + legacy policy + caps | WP-010-02 | 2 | `io/strings.ts` + T-SWF-004 string rows |
| WP-010-07 | Colour records + `LanguageCode` | WP-010-02 | 0.5 | `io/colour.ts` |
| WP-010-08 | `RECT` | WP-010-04 | 0.5 | `io/records.ts` + T-SWF-004 rect row |
| WP-010-09 | `MATRIX` + `decomposeMatrix` | WP-010-05 | 2 | `io/records.ts` + T-SWF-013 |
| WP-010-10 | `CXFORM` / `CXFORMWITHALPHA` (shared impl) | WP-010-04 | 1 | `io/records.ts` + T-SWF-004 cxform rows |
| WP-010-11 | Test writer + property tests + allocation test | WP-010-03…10 | 3 | `test-support/writer.ts`, T-SWF-014/017 |
| WP-010-12 | Reader fuzz target (in-process, no I/O) | WP-010-02 | 1 | `tools/fuzz/readers.ts`, wired into doc 140's harness |
| | **Total** | | **20** | |

## 10. Open items to pin from the chapter text

| # | Item | Status |
| --- | --- | --- |
| 1 | `FLOAT16` exponent bias (E-004): implement IEEE (bias 15); re-check if a consuming structure appears | resolved, re-open on new evidence |
| 2 | `MATRIX` rotation sign convention (E-005) | **resolved (v1.1)** — the chapter's rotation row (`ScaleX = cos`, `RotateSkew0 = sin`, `RotateSkew1 = -sin`, `ScaleY = cos`) with `x' = x*ScaleX + y*RotateSkew1`, `y' = x*RotateSkew0 + y*ScaleY` maps `(1,0)` to `(0,1)` at +90 deg, i.e. right -> down = **clockwise on screen** in SWF's y-down space: the chapter and our committed convention agree. Keep `T-SWF-013` as the regression check, extended with the +90 deg fixture asserting the on-screen direction (right -> down) |
| 3 | Confirm no AVM1-era structure consumes `FLOAT16` | open (low risk) |
| 4 | Confirm `SI24` does not exist (only `UI24[n]` appears in the type table) | open (low risk) |
| 5 | Ch.1 states `RECT` "must be byte aligned" — *starts* aligned with consumers aligning after | **resolved (v1.3)** — Appendix A's two rects (`FrameSize` 65+7 bits, shape bounds 61+3 bits) are byte-aligned at the start and zero-padded to the next byte boundary; `R028` is the rule, `T-TST-102` the check |

## 11. Done criteria

1. Every vector in §8 passes with exact equality (F1) on Node and in the browser test runner.
2. Property tests pass at 10⁵ iterations with a fixed seed; failures print the counterexample bytes.
3. `T-SWF-015` demonstrates recovery after a deliberately corrupted record with no exception.
4. Zero-allocation assertion passes for steady-state reads.
5. `codes.ts` contains every `SF00xx` literal; a lint rule fails the build on `SF\d{4}` outside it.
6. This document's changelog records any divergence found while implementing, and errata entries are
   filed for anything that is upstream's fault rather than ours.

## 12. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Written against Ch.1; E-001…E-005 filed; IO code range allocated |
| 1.1 | 2026-10-04 | Open item 2 (`MATRIX` rotation sign, E-005) closed by derivation from the Ch.1 operation table; registry rows extended for `SF0249` (video), `SF0423`/`SF0424` (AVM1) and `SF0501`/`SF0502` (emitter budgets); errata `E-016` |
| 1.2 | 2026-10-04 | Ch.12–Ch.15 pass: registry rows re-derived (`SF0200`–`0239` design-owned, `SF0270`–`0289` 080, `SF0290`–`0299` 110, `SF0324`–`0332` 090) |
| 1.3 | 2026-10-04 | Appendix pass: Appendix A added as the independent corroboration of the `RECT` field order settled in `E-001` (the fixture `T-TST-102` doubles as the regression test) |
| 1.4 | 2026-10-04 | Tech-spec pass: registry rows for the two new areas — `SF0800–0899` (clean engine, doc 160) and `SF0900–0999` (code inspector, doc 150); no existing range moved |
| 1.5 | 2026-10-04 | Rule-id and cross-reference hygiene after the area pass: `IMPL-060`'s `R046`–`R052`, `IMPL-030-R007`, `IMPL-120-R015`; registry row for 080 corrected to `SF0270`–`0289` and the design-owned `SF0200`–`0239` block documented as not-free |
