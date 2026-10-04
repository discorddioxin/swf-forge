# IMPL-020 — Container, Tag Stream, Dictionary, and Processing

**Doc ID:** IMPL-020 · **Status:** ✅ grounded in Ch.2 (two sections pending, see §12) · **Package:** `@swf-forge/swf`
**Format spec:** Chapter 2 — SWF Structure Summary (header, file structure, tag format, definition and
control tags, tag ordering, the dictionary, processing, compression strategy)
**Design specs:** SWF-§3 (container), SWF-§5 (dictionary/character model), CMP-§4.1–4.3 (`inspect`),
APP-§2 (tag disposition table)

---

## 1. What this document delivers

The container layer: turning a file into `(header, tag index, dictionary)` such that every later stage
can fetch exactly the tags it needs, lazily, with bounded memory and complete diagnostics.

Deliverables:

1. `openSwf(bytes, opts): SwfFile` — signature detection, decompression, header parse, tag index build.
2. `SwfFile` — header accessors, tag iteration, dictionary access, sprite ranges, payload reader.
3. Tag framing: short/long `RECORDHEADER`, unknown-tag skipping, nested sprite walking.
4. Dictionary: character ids, duplicate policy, lazy payload decoding with memoisation, the character
   kind table from APP-§2.
5. Tag-ordering validation (Ch.2's five rules) with scoped diagnostics.
6. The processing model contract that the runtime and `inspect` share.
7. Compressed-container support: `FWS`, `CWS` (zlib), `ZWS` (LZMA), with bounded decompression.

**Non-goals:** interpreting tag payloads (each has its own impl doc), building the `MovieModel`
(doc 120 owns pipeline wiring; the model type is defined in CMP-§3 and populated from this layer), and
emitting anything.

## 2. Module layout

```
packages/swf/src/
  container/
    open.ts            openSwf(): signature detect, decompress, header, index
    header.ts          SwfHeader parse + validation
    compress.ts        inflate (zlib) and lzma adapters, bounded + incremental
    tag-index.ts       TagIndex construction, sprite ranges, lazily decoded tag records
    tag-reader.ts      RECORDHEADER framing, payload access, unknown tags, long-form warnings
    dictionary.ts      Dictionary, CharacterModel, kind table, duplicate policy
    ordering.ts        Ch.2 ordering rule checks
    processing.ts      the documented processing model + per-frame order contract
    decompress/
      zlib.ts          platform DecompressionStream first, vendored inflate fallback
      lzma.ts          optional LZMA adapter (SEC-§5 dependency table)
```

**IMPL-020-R001** `container/` MUST NOT import from `shapes/`, `actions/`, `fonts/`, or any other
payload decoder. The dependency runs *from* those modules *to* the container, never back.

**IMPL-020-R002** The LZMA adapter MUST be lazily imported (`await import('./decompress/lzma.js')`) so
that a build without the optional dependency still parses `FWS`/`CWS` files and reports `SF0006` only
when a `ZWS` file is actually opened. Node's `zlib` and the browser's `DecompressionStream` are
similarly behind adapters so the same code runs in both.

## 3. Public API

```ts
export interface SwfOpenOptions {
  /** Hard cap on decompressed bytes. Default 512 MiB (design SWF-R043). */
  maxDecompressedBytes?: number;
  /** Hard cap on dictionary entries. Default 2_000_000. */
  maxDictionaryEntries?: number;
  /** Parser mode: 'soft' recovers, 'strict' throws on the first structural error. */
  mode?: 'soft' | 'strict';
  /** Diagnostics sink; one per movie. */
  sink?: DiagnosticSink;
  /** Whether to build the full tag index eagerly (default) or stream it on demand. */
  indexStrategy?: 'eager' | 'lazy'; // lazy builds the same full index on first `tagIndex`/`definitions` access
}

export function openSwf(bytes: Uint8Array, opts?: SwfOpenOptions): SwfFile;

export interface SwfFile {
  readonly header: SwfHeader;
  /** The decompressed body, i.e. everything after the 8-byte header. Views, not copies. */
  readonly body: Uint8Array;
  readonly tagIndex: TagIndex;
  readonly dictionary: Dictionary;
  /** Ordered diagnostics from open + later reads (the sink is shared). */
  readonly diagnostics: readonly Diagnostic[];
  /** Raw file size and decompressed size, for reporting. */
  readonly sizes: { file: number; decompressed: number; ratio: number };
  /** Content hash of the *input file* (stable id for caches and manifests). */
  readonly sha256: string;
  /** Convenience: version this file claims (header.version). */
  readonly version: number;
  /** Re-reads a tag payload lazily; memoised per TagRef. */
  readTag(ref: TagRef): TagPayload;
}

export interface SwfHeader {
  readonly compression: 'none' | 'zlib' | 'lzma';
  readonly version: number;
  /** Total length including the header, as declared. */
  readonly fileLength: number;
  /** Frame size in twips (Ch.2: Xmin/Ymin are 0 by construction). */
  readonly frameSize: Rect;
  /** Frame size in CSS px at 1× (twips / 20), for the stage. */
  readonly frameSizePx: { width: number; height: number };
  /** Frames per second from the 8.8 fixed field. */
  readonly frameRate: number;
  /** Raw 8.8 value, preserved for reporting and for `_quality`-era behaviour. */
  readonly frameRateRaw: number;
  readonly frameCount: number;
}

export interface TagRef {
  readonly code: number;
  /** Absolute offset of the *body* in the decompressed buffer. */
  readonly offset: number;
  readonly length: number;
  /** Nesting depth: 0 = top level, 1 = inside a sprite, … */
  readonly depth: number;
  /** Character id of the enclosing sprite, or null. */
  readonly inSprite: number | null;
  /** Index into tagIndex.tags — stable, used as a cache key. */
  readonly index: number;
}

export type TagPayload =
  | { kind: 'bytes'; view: Uint8Array }          // undecoded, for payloads handed to other stages
  | { kind: 'skipped'; reason: 'unknown' | 'unsupported' | 'not-requested' | 'not-a-swf' };

export interface TagIndex {
  readonly tags: readonly TagRef[];
  /** For each sprite character id: the slice of `tags` that belongs to its timeline. */
  readonly spriteRanges: ReadonlyMap<number, { start: number; end: number; frameCount: number }>;
  /** Tag code histogram, for reports and the tag-coverage tool. */
  readonly histogram: ReadonlyMap<number, number>;
}
```

**IMPL-020-R003** `TagIndex` MUST store `TagRef`s in file order, always. Consumers that want a
different order sort a copy.

**IMPL-020-R004** `readTag()` MUST return a zero-copy raw byte view and be idempotent/memoised by
`TagRef.index`; two calls for the same tag MUST return the identical payload object. `indexStrategy: 'lazy'`
MUST defer framing/index construction until `tagIndex` or `definitions` is first accessed. Tag decoding is
owned by each tag/model stage; the `decoded` payload variant remains deferred until a shared decode owner
exists, rather than advertising an unused API surface.

## 4. Container: signature, decompression, header

### 4.1 Signature detection

| Bytes 0–2 | Compression | Version floor | Action |
| --- | --- | --- | --- |
| `46 57 53` (`FWS`) | none | 1 | body = bytes[8…] |
| `43 57 53` (`CWS`) | zlib | 6 | inflate bytes[8…] |
| `5a 57 53` (`ZWS`) | LZMA | 13 | see §4.3 |
| anything else | — | — | `SF0001` (error); `openSwf` returns a file with header undefined in soft mode, throws in strict |

**IMPL-020-R005** The signature MUST be matched on all three bytes, case-sensitively. Files with a
lowercase signature or a `FWS` prefix padded differently are reported, not guessed.

### 4.2 `CWS` (zlib)

- Body starts at byte 8 and runs to end-of-file; there is **no** length field in the compressed stream.
- Decompress with the platform `DecompressionStream('deflate')` where available (Node ≥ 18, all
  evergreen browsers), falling back to a vendored inflate (SEC-§5).
- **IMPL-020-R006** Decompression MUST be incremental and MUST enforce `maxDecompressedBytes` *while*
  producing output, aborting as soon as the cap is exceeded (`SF0007`, error, fatal for that file). A
  cap checked only after decompression is a memory-exhaustion vector.
- **IMPL-020-R007** A truncated or corrupt stream MUST yield the bytes decoded so far plus `SF0003`
  (error), not an exception (design SWF-R011). Partial movies are useful; `inspect` can still be run.

### 4.3 `ZWS` (LZMA)

Layout after the 8-byte base header (verified against independent implementations; see §12 item 1):

```
bytes 8..11   UI32  compressedLength      // length of the compressed payload that follows the props
bytes 12..16  UI8×5 LZMA properties       // standard LZMA property bytes (lc/lp/pb + dictionary size)
bytes 17..n   LZMA-compressed data        // may end with an LZMA end marker
```

- **IMPL-020-R008** `compressedLength` MUST be treated as advisory: the decoder consumes
  `min(compressedLength, remaining)` bytes and reports `SF0027` (warning) when the two disagree. Real
  files disagree (some writers count the 5 property bytes, some omit the end marker), and refusing to
  read them would fail on otherwise-fine content.
- **IMPL-020-R009** The five property bytes MUST be fed to the LZMA decoder as configuration (they are
  not part of the stream); if the adapter is unavailable, emit `SF0006` (error) and return an empty
  body so that the caller can still report header facts.
- **IMPL-020-R010** As with zlib, decompression MUST be streaming and bounded, and MUST tolerate a
  missing LZMA end marker.

### 4.4 Header

Parse order (Ch.2): `Signature` (3) → `Version` (UI8) → `FileLength` (UI32) → `FrameSize` (`RECT`) →
`FrameRate` (UI16, 8.8) → `FrameCount` (UI16).

- **IMPL-020-R011** `FileLength` vs actual size policy (design SWF-R009, `--tolerate-length`
  default on); `--strict` promotes either mismatch to an error and returns failure after producing the report:

| Situation | Diagnostic | Behaviour |
| --- | --- | --- |
| `FWS` and `fileLength != fileSize` | `SF0005`/`SF0004` (warning by default, error under `--strict`) | use the actual bytes present |
| `CWS`/`ZWS` and decompressed > `fileLength` | `SF0004` (warning by default, error under `--strict`) | keep the extra bytes (usually a padded writer) |
| `CWS`/`ZWS` and decompressed < `fileLength` | `SF0005` (warning by default, error under `--strict`) | continue with what exists |
| `fileLength` absurd (< 8 or > 2 GiB) | `SF0028` (warning) | ignore the field, use actual sizes |

- **IMPL-020-R012** `FrameRate` MUST be stored raw and derived as `raw / 256` (the Appendix A fixture's
  bytes `00 0C` are raw 3072 = 12.0 fps — the little-endian 8.8 reading both independent players use;
  `T-SWF-023`). Do not clamp at parse
  time (RT-§4.2 clamps for scheduling and reports separately): a title at 31 fps must keep 31 fps.
  A raw value of 0 or above 240×256 triggers `SF0022` (info).
- **IMPL-020-R013** `FrameSize` MUST be parsed with `readRect()` (doc 010) and MUST be validated:
  `Xmin == 0 && Ymin == 0` (Ch.2 states this is guaranteed); violations report `SF0021` (warning) and
  the rect is preserved. Non-positive width/height report `SF0029` (error) but parsing continues.
- **IMPL-020-R014** The derived `frameSizePx` MUST use `twips / 20` in floats (design GFX-R011); the
  stage's integer rounding happens once, in the renderer, and is reported there.

## 5. Tag stream

### 5.1 Framing

```
word    = UI16 little-endian                       // NOT a bit field: read it as a 16-bit word
code    = word >> 6
length  = word & 0x3F
if length == 0x3F:
    length = UI32 little-endian                    // body length, EXCLUDING the 6-byte header
body    = bytes[offset + headerSize .. + length]
```

- **IMPL-020-R015** The `TagCodeAndLength` field MUST be read as a little-endian `UI16` and then split
  with shifts (Ch.2 calls this out explicitly: the bit-field reading is different because of the byte
  order). Reading 10 bits then 6 bits with a bit cursor produces swapped tag codes on ~all real files;
  unit test `T-SWF-003` pins it with the bytes `43 00` → code 1, length 3 and `03 01` → code 4, length 3.
- **IMPL-020-R016** The long-header `Length` MUST be interpreted as the **body length excluding the
  header** (both header forms agree on this). The 4 length bytes are not counted. *(Correction to our
  own design spec SWF-§3.3, which said otherwise — errata E-007.)*
- **IMPL-020-R017** A tag with `length == 0x3F` in the short field but a long `Length` below 63 MUST be
  accepted (some writers always use long form for bitmap and `SoundStreamBlock` tags). Emit `SF0030`
  (info, once per tag code) so the coverage report can note non-canonical writers.
- **IMPL-020-R018** Unknown tag codes (no entry in APP-§2) MUST be skipped by length with `SF0104`
  (info, deduplicated by code with a count). They MUST NOT be treated as errors (Ch.2: forward
  compatibility is a feature).
- **IMPL-020-R019** A tag whose declared body extends past the end of the buffer MUST terminate the tag
  stream with `SF0101` (warning), keeping every tag already indexed. This is the most common
  truncation mode in the wild.
- **IMPL-020-R020** `End` (code 0) MUST terminate the top-level stream; missing `End` yields
  `SF0102` (info). Bytes after `End` yield `SF0024` (info) and are ignored.
- **IMPL-020-R021** Tag bodies MUST be exposed as views into the decompressed buffer (zero copy). Only
  payloads that cross a worker boundary or outlive the file buffer may be copied, and then explicitly
  (`takeBytes`).

### 5.2 Sprite nesting

`DefineSprite` (39) contains `SpriteId` (UI16), `FrameCount` (UI16), then its own tag stream, itself
terminated by `End`.

- **IMPL-020-R022** The indexer MUST walk into sprites recursively, recording `depth` and `inSprite`
  for every contained tag, and MUST record the sprite's tag range plus its own `frameCount`.
- **IMPL-020-R023** Nesting depth MUST be capped at 32 (`SF0103`, warning, and the sub-stream is
  skipped as an opaque body). Recursion MUST be implemented with an explicit stack, never JS recursion
  — hostile files nest thousands deep and a stack overflow is not an acceptable failure mode
  (design SWF-R042).
- **IMPL-020-R024** A `ShowFrame` count that disagrees with the sprite's declared `FrameCount` MUST be
  reported as `SF0023` (warning) with the sprite id; the declared value wins for model construction
  (missing frames are empty, extra frames are appended) because timelines index by declared length.
- **IMPL-020-R025** Top-level `ShowFrame` count vs header `FrameCount`: same rule (`SF0023`), and the
  *declared* value wins.

### 5.3 Definition versus control tags

Split per APP-§2's disposition column:

| Class | Examples | Index-time handling |
| --- | --- | --- |
| Definition | `DefineShape*`, `DefineSprite`, `DefineFont*`, `DefineSound`, `DefineBits*` | Registered in the dictionary with their character id |
| Control | `PlaceObject*`, `RemoveObject*`, `ShowFrame`, `DoAction`, `StartSound`, `FrameLabel`, `SetBackgroundColor` | Left in the tag stream, consumed by the model builder |
| Metadata/global | `FileAttributes`, `Metadata`, `ScriptLimits`, `SetTabIndex`, `DefineSceneAndFrameLabelData` | Recorded on the model; some affect interpretation |
| Stream | `SoundStreamHead*`, `SoundStreamBlock`, `VideoFrame` | Indexed with frame association by their owning modules (docs 090/110) |

**IMPL-020-R026** Definition tags MUST be registered in file order; a control tag that references a
character defined *later* is a violation of Ch.2's ordering rule and MUST be reported by
`ordering.ts` (`SF0026`, warning) while still being resolved if the character exists at the end of the
file. Rejecting the file would break real (if sloppy) content; silently accepting it would hide a
tooling bug in whoever produced it.

## 6. Dictionary

```ts
export interface Dictionary {
  readonly size: number;
  get(id: number): CharacterModel | undefined;
  /** All characters in definition order. */
  entries(): IterableIterator<CharacterModel>;
  /** Export name → character id (ExportAssets / SymbolClass-in-AVM1). */
  readonly exports: ReadonlyMap<string, number>;
  /** Characters whose payload could not be decoded at all. */
  readonly failed: readonly number[];
}

export interface CharacterModel {
  readonly id: number;
  readonly kind: CharacterKind;          // the union from CMP-§5, including `missing`
  readonly definitionTag: TagRef | null; // null only for a placement-created missing placeholder
  readonly exportNames: readonly string[];
  /** Lazily decoded payload; memoised; returns undefined if the payload is malformed. */
  payload<T>(): T | undefined;
}
```

- **IMPL-020-R027** Character id `0` is the null character and MUST NOT be registered (Ch.2); a
  definition tag with id 0 is reported as `SF0107` (warning) and ignored.
- **IMPL-020-R028** Duplicate ids: Ch.2 says duplicates are not allowed; real files have them.
  Policy (design SWF-R023): the **last** definition wins for lookups, both offsets are named in
  `SF0109` (warning), and the first definition remains reachable through `entries()` so `inspect` can
  show the shadowed one.
- **IMPL-020-R029** A referenced-but-undefined character id MUST produce a placeholder character
  (`kind: 'missing'`) so that timeline and event semantics still see a named object at the right depth
  (design SWF-R024), with `SF0110` (warning) naming the referencing tag.
- **IMPL-020-R030** `exports` MUST merge `ExportAssets` and `SymbolClass` (AVM1-era usage); a name that
  maps to two ids reports `SF0159` (warning; the control-tag range, owned by doc 040) and the last wins, deterministically.
- **IMPL-020-R031** Dictionary construction MUST respect `maxDictionaryEntries` (`SF0031`, error when
  exceeded) measured in *registered* definitions, not total tags.

## 7. Tag ordering validation

Ch.2 states five rules. `ordering.ts` MUST check all five and report per violation (deduplicated by
rule, with a count and the first offending offset):

| Rule | Check | Diagnostic |
| --- | --- | --- |
| `FileAttributes` is the first tag (SWF ≥ 8) | scan index | `SF0025` (warning) |
| A tag depends only on earlier tags | definition-before-use for character references in control tags | `SF0026` (warning) |
| Definitions precede the control tags that use them | same scan as above | `SF0026` |
| Streaming sound tags are in order | `SoundStreamHead*` precedes its `SoundStreamBlock`s; blocks ascending by frame | `SF0032` (warning) |
| `End` is last | index-level | `SF0024` (info) |

**IMPL-020-R032** Ordering checks MUST be *non-fatal* and MUST NOT reorder anything. Their output is
for the porting report: a title whose tags are out of order may still play correctly, and the porter
needs to know why our tooling disagrees with the player.

**IMPL-020-R033** The check for "depends only on earlier tags" MUST be limited to *character
references* (what it can prove from the tag's structure without full decoding): `PlaceObject*.CharacterId`,
`StartSound.SoundId`, `DefineButton/DefineSprite` character references, `DefineText` font ids, and
`DefineBits*` bitmap references. Deeper semantic dependencies (action scripts addressing `_root`) are
out of scope.

## 8. Processing model

The per-frame order that the runtime and the compiler's frame model must share (design AVM1-§3.3;
pending confirmation of Ch.2's two un-retrieved sections, errata E-006):

```
1. Apply the frame's display-list operations in file order (PlaceObject*/RemoveObject*).
2. Dispatch clip events for objects entering/leaving the frame (onLoad/onUnload/onEnterFrame).
3. Execute the frame's DoAction blocks in file order.
4. Dispatch queued asynchronous completions and timers.
5. Advance child timelines (depth order), each recursively performing 1–4.
6. Present the frame; the stream sound position for this frame is committed.
```

**IMPL-020-R034** `processing.ts` MUST export this order as data (an enum + a documented sequence) and
both the model builder and the runtime MUST consume it rather than re-deriving an order locally.
Duplicated ordering logic between build and run time is how "it plays differently than it was
compiled" bugs happen.

**IMPL-020-R035** `DoInitAction` MUST be collected separately from `DoAction` and MUST be associated
with its target sprite id; the model exposes `initActions` per movie and per sprite
(design AVM1-R004).

**IMPL-020-R036** Parsing MUST NOT execute anything and MUST NOT resolve control-tag semantics beyond
indexing and ordering: `openSwf` is a structural operation.

## 9. Diagnostics (container range)

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0001` | error | not a SWF (signature mismatch) |
| `SF0003` | error | decompression failed or stream corrupt (partial body kept) |
| `SF0004` | warning | decompressed body longer than declared `FileLength` |
| `SF0005` | warning | decompressed body shorter than declared `FileLength` |
| `SF0006` | error | `ZWS` present but no LZMA decoder available |
| `SF0007` | error | decompressed output exceeded the configured cap (aborted) |
| `SF0021` | warning | `FrameSize` has non-zero `Xmin`/`Ymin` |
| `SF0022` | info | frame rate outside the plausible range |
| `SF0023` | warning | declared `FrameCount` disagrees with observed `ShowFrame` count |
| `SF0024` | info | bytes after `End` |
| `SF0025` | warning | `FileAttributes` not first (SWF ≥ 8) |
| `SF0026` | warning | tag ordering violation (definition after use, …) |
| `SF0027` | warning | `ZWS` `compressedLength` disagrees with the bytes present |
| `SF0028` | warning | `FileLength` implausible (< 8 or > 2 GiB) |
| `SF0029` | error | `FrameSize` has non-positive width or height |
| `SF0030` | info | tag encoded with a long header although its body is < 63 bytes |
| `SF0031` | error | dictionary entry cap exceeded |
| `SF0032` | warning | streaming sound tags out of order |
| `SF0033` | info | non-canonical compression (e.g. `CWS` on a version < 6) |

Tag-level codes (`SF0100`–`SF0199`) are allocated by this document and registered in doc 010 §7
alongside the container range:

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0101` | warning | tag body extends past the end of the stream (last tag kept, truncated) |
| `SF0102` | info | missing `End` tag (end inferred from the stream length) |
| `SF0103` | warning | sprite nesting deeper than 32 (sub-stream abandoned) |
| `SF0104` | info | unknown tag code skipped by length |
| `SF0107` | warning | definition tag with character id 0 (ignored) |
| `SF0109` | warning | duplicate character id (last definition wins; earlier definition remains reachable as a shadowed entry) |

`SF0105`, `SF0106` and `SF0108` are unassigned inside this block; `SF0110` is shared with `IMPL-030`
for an undefined character reference seen from the placement side (`E-016`).

## 10. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| `T-SWF-001` | header matrix: `FWS`/`CWS`/`ZWS`, versions 1…43, frame rates, frame sizes | F1 |
| `T-SWF-002` | truncation at *every* byte offset of a synthetic file: no exception, diagnostics present, indexed tags are a prefix | F1 |
| `T-SWF-003` | `RECORDHEADER` framing: `43 00`, `03 01`, short/long boundary at 62/63, long-form-under-63 | F1 |
| `T-SWF-007` | duplicate character ids, id 0, referenced-but-undefined character | F1 |
| `T-SWF-008` | sprite nesting at depths 31/32/33 with an explicit-stack walk | F1 |
| `T-SWF-010` | every diagnostic code emitted is inside its documented range (catches E-002-class bugs) | F1 |
| `T-SWF-011` | `maxDecompressedBytes` abort: a 512 MiB bomb is rejected without exhausting memory | F1 |
| `T-SWF-012` | determinism: two opens of the same bytes produce identical tag indices, dictionary order, and diagnostics | F1 |
| `T-SWF-018` | first-access lazy tag indexing and memoized raw payload views (identical object for a repeated read) | F1 |
| `T-SWF-019` | ordering checks: one fixture per rule violation, correct code and count | F2 |
| `T-SWF-020` | `showFrame`/`FrameCount` mismatch policy (declared wins, frames padded/truncated) | F2 |
| `T-SWF-021` | zero-copy: tag bodies are views (`byteOffset` inside the decompressed buffer) | F1 |
| `T-SWF-022` | Appendix A tag-stream walk: tag 9 (3-byte body), tag 2 with a **long header** (6-bit field 63, 35-byte body), tag 26, tag 1, tag 0 (`T-TST-102`) | F1 |
| `T-SWF-023` | Appendix A header: version 3, `FileLength` 79, `RECT` `Nbits` 15 = 0/11000/0/8000, `FrameRate` raw 3072 = 12.0, `FrameCount` 1 (`T-TST-102`) | F1 |

### Fixture construction

All container fixtures are generated by the synthetic writer (doc 140), not committed as opaque
binaries, so every byte's intent is visible in a review:

```ts
const bytes = swf({
  version: 6, compression: 'zlib', frameRate: 24, frameCount: 2, frameSize: [200, 100],
  tags: [
    fileAttributes({ as3: false }),
    defineShape(1, rect(0, 0, 100, 100).solid(0xff0000)),
    defineSprite(2, 2, [ placeObject(1, 1), showFrame(), showFrame() ]),
    placeObject(2, 1),
    doAction(0, [actionStop()]),
    showFrame(), showFrame(),
  ],
});
```

**IMPL-020-R037** The writer MUST be able to emit deliberately *invalid* files (bad lengths, missing
`End`, wrong order, overlong `EncodedU32`, out-of-order stream blocks) via an explicit
`defects: [...]` option, so malformed-input tests stay declarative.

## 11. Work packages

| WP | Title | Depends | Est | Deliverable |
| --- | --- | --- | --- | --- |
| WP-020-01 | Signature detect + `FWS`/`CWS` open path | WP-010-02 | 2 | `container/open.ts`, `compress/zlib.ts` |
| WP-020-02 | Bounded, incremental decompression + caps | WP-020-01 | 2 | T-SWF-011 |
| WP-020-03 | `ZWS`/LZMA adapter (optional, lazy) | WP-020-01 | 3 | `compress/lzma.ts`, `SF0006`/`SF0027` handling |
| WP-020-04 | Header parse + validation | WP-010-08, WP-020-01 | 2 | `container/header.ts`, T-SWF-001 |
| WP-020-05 | Tag framing + index build | WP-020-04 | 3 | `container/tag-reader.ts`, T-SWF-003 |
| WP-020-06 | Sprite nesting walk (explicit stack, depth cap) | WP-020-05 | 2 | T-SWF-008 |
| WP-020-07 | Dictionary + export map + placeholders | WP-020-05 | 3 | `container/dictionary.ts`, T-SWF-007 |
| WP-020-08 | Ordering validation (5 rules) | WP-020-07 | 2 | `container/ordering.ts`, T-SWF-019 |
| WP-020-09 | Processing-order contract + `DoInitAction` collection | WP-020-05 | 1 | `container/processing.ts` |
| WP-020-10 | `SwfFile` facade, lazy memoised `readTag` | WP-020-05…08 | 2 | T-SWF-018/021 |
| WP-020-11 | Truncation/fuzz corpus generator + `swffuzz` wiring | WP-020-05 | 2 | T-SWF-002, doc 140 harness |
| WP-020-12 | `swfforge inspect --tags/--symbols` CLI surface | WP-020-10 | 2 | user-visible: the first demoable artefact |
| | **Total** | | **26** | |

## 12. Open items to pin from the chapter text

| # | Item | Status |
| --- | --- | --- |
| 1 | `ZWS` layout: `UI32 compressedLength` + 5 property bytes + data (verified against independent implementations, not yet against the chapter) — confirm field order and whether `compressedLength` counts the property bytes | open (advisory handling makes it low-risk) |
| 2 | Ch.2 "Processing a SWF file" and "File compression strategy" sections were not in the supplied excerpt (errata E-006); confirm our per-frame order (§8) and any compression-level guidance | **open** |
| 3 | Confirm the exact wording of the ordering rules (we implement five checks) and whether any rule is normative for *players* rather than tools | open |
| 4 | Confirm whether `FileAttributes` violation is an error for SWF ≥ 8 or a tolerated warning | open (we warn) |
| 5 | Confirm the long-header body-length semantics (we now exclude the header; see E-007) | **resolved** by cross-checking formal grammars; re-confirm on receipt |

## 13. Done criteria

1. `openSwf` runs over the whole fixture corpus in both modes with no uncaught exception, and
   `T-SWF-002` proves recovery at every truncation offset.
2. `swfforge inspect --tags --symbols` prints a stable, diffable report for every synthetic fixture.
3. All five ordering rules have a fixture that trips exactly one of them.
4. Memory bound: a 512 MiB decompression bomb is rejected with peak RSS under 256 MiB.
5. Every diagnostic code in §9 is emitted by at least one test, and none outside the range.
6. The design-spec correction for E-007 is applied to `docs/specs/format/030-swf-format-and-io.md`.

## 14. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Written against Ch.2 (minus two sections); container code range allocated; E-006/E-007 filed |
| 1.1 | 2026-10-04 | Appendix pass: the Appendix A fixture is wired into the header and tag-stream obligations (`T-SWF-022`/`T-SWF-023`), including the canonical long-header case (`DefineShape`, length field 63) and the little-endian 8.8 `FrameRate` reading |
