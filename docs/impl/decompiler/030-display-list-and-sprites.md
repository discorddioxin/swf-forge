# IMPL-030 — Display List, Placements, Filters, and Sprites

**Doc ID:** IMPL-030 · **Status:** ✅ grounded in Ch.3 + Ch.13 · **Package:** `@swf-forge/swf`
**Format spec:** Chapter 3 — The Display List (pp. 33–53 of the v19 PDF — read and reconciled);
Chapter 13 — Sprites and Movie Clips (normative for §8)
**Design specs:** SWF-§6.1–6.3, CMP-§3/§4.3, GFX-§8/§10/§11, AVM1-§10, APP-§2/§5/§6/§7/**§10.1**
**Pinned byte layouts:** APP-§10.1 (Ch.3/Ch.4 structures) — this document does not restate them.

---

## 1. What this document delivers

The display-list layer: every tag that adds, modifies, removes, or renders a character, decoded into
typed records that the emitter, renderer, and runtime all consume.

Deliverables:

1. `PlaceObject` (4, v1), `PlaceObject2` (26), `PlaceObject3` (70) decoded into `PlacementOp`.
2. `RemoveObject` (5), `RemoveObject2` (28) into `RemovalOp`; `ShowFrame` (1) as a frame boundary.
3. Filter list (`FILTERLIST` + all eight filters) into `FilterSpec[]` — decoded and carried, not
   rendered (rendering is doc 130).
4. Clip actions: `CLIPACTIONS` framing, `ClipActionRecord` records, `CLIPEVENTFLAGS` decoding.
5. Blend modes, bitmap caching, visible/opaque-background backing fields (PlaceObject3).
6. Sprite (movie clip) support: `DefineSprite` → nested `TimelineModel` (frame semantics from Ch.13
   when it lands; the framing rules already implemented here).
7. Frame assembly: tags → `FrameModel[]` with one ordered `DisplayOp` list per frame.
8. The display-list attributes the runtime needs: depth, name, matrix, colour transform, ratio,
   clip depth, blend mode, filters, cache flag, visibility, class name.

**Non-goals:** rendering (doc 130), action semantics for clip events (doc 050 decodes the bytes;
AVM1 owns behaviour), and `SetTabIndex` decoding (doc 040 — its op rides in the frame list this
document defines).

## 2. Module layout

```
packages/swf/src/display/
  place-common.ts      shared field reader: flags -> optional-field order, types, units
  place-object.ts      PlaceObject (4) v1 decoder (incl. the optional-CXFORM tail rule)
  place-object2.ts     PlaceObject2 (26) decoder
  place-object3.ts     PlaceObject3 (70) decoder (second flag byte, backing fields, filters)
  remove-object.ts     RemoveObject (5) / RemoveObject2 (28)
  show-frame.ts        ShowFrame (1)
  filters.ts           FILTERLIST + 8 filter structures -> FilterSpec
  clip-events.ts       CLIPEVENTFLAGS (2-byte / 4-byte forms)
  clip-actions.ts      CLIPACTIONS + CLIPACTIONRECORD framing, end flags, action byte ranges
  sprite.ts            DefineSprite (39) -> SpriteModel + TimelineModel
  frame-assembly.ts    tag stream -> FrameModel[] with ordered DisplayOps
  types.ts             DisplayOp, PlacementOp, RemovalOp, FilterSpec, ClipEventFlags
```

**IMPL-030-R001** The three `PlaceObject*` decoders MUST share one field reader (`place-common.ts`)
parameterised by which optional fields each tag version supports. Field *order* is now pinned by
APP-§10.1; three independent implementations would still drift on the two flag bytes.

**IMPL-030-R002** Decoders MUST be pure `(Cursor, context) => PlacementOp` functions with no side
effects on the dictionary; frame assembly is a separate step so a single tag can be decoded in
isolation in a unit test.

## 3. Data model

```ts
export type DisplayOp = PlacementOp | RemovalOp | SetTabIndexOp;   // SetTabIndexOp from doc 040

export interface PlacementOp {
  readonly kind: 'place';
  readonly tag: 'PlaceObject' | 'PlaceObject2' | 'PlaceObject3';
  readonly index: number;                 // position within the frame, from 0 (file order)
  readonly depth: number;                 // UI16; lower depth = further back
  readonly move: boolean;                 // PlaceObject2/3 Move flag; false for v1 adds
  readonly characterId: number | null;    // null => no character change ("move" of an existing object)
  readonly name: string | null;
  readonly matrix: Mat2D | null;          // null => field absent (must not be defaulted)
  readonly cxform: Cxform | null;
  readonly ratio: number | null;          // 0..65535 morph ratio
  readonly clipDepth: number | null;      // > 0 => this object masks depths (depth, clipDepth]
  readonly filters: readonly FilterSpec[] | null;
  readonly blendMode: number | null;      // raw APP-§6 byte; null => absent (see deviation note)
  readonly cacheAsBitmap: boolean;        // raw nonzero or implied by a non-empty filter list
  readonly rawCacheValue: number | null;  // original BitmapCache UI8, null when absent
  readonly visible: boolean | null;       // PlaceObject3 HasVisible; null => field absent
  readonly opaqueBackground: Rgba | null; // PlaceObject3 backing colour (E-008)
  readonly className: string | null;      // PlaceObject3 HasClassName (AVM2-era; inert in AVM1)
  readonly image: { kind: 'class' | 'characterId' } | null;   // PlaceObject3 HasImage
  readonly clipActions: ClipActions | null;
  readonly tagOffset: number;            // byte offset of the tag body (see deviation note)
}

export interface RemovalOp {
  readonly kind: 'remove';
  readonly index: number;
  readonly depth: number;                 // both tag forms carry a depth
  readonly characterId: number | null;    // RemoveObject only; null for RemoveObject2
  readonly tagOffset: number;             // byte offset of the tag body (see deviation note)
}

export interface ClipActions {
  readonly reserved: number;                      // top-level reserved word, retained verbatim
  readonly allEvents: ClipEventFlags;             // union of all record flags
  readonly records: readonly ClipActionRecord[];
  readonly endFlagWidth: 2 | 4;                   // UI16 for SWF <= 5, UI32 for SWF >= 6
  readonly endFlag: number | null;                // zero when present; null when truncated
  readonly raw: ActionBlockRef;                   // entire CLIPACTIONS body, retained verbatim
}
export interface ClipActionRecord {
  readonly events: ClipEventFlags;
  readonly keyCode: number | null;                // present iff keyPress
  readonly actions: ActionBlockRef;               // ACTIONRECORD bytes incl. ActionEndFlag; doc 050 decodes it
  readonly sizeBytes: number;                     // declared ActionRecordSize, including KeyCode when present
}
```

**Deviation (surface API — documented, not reworked; precedent: the P1 `dictionary`→`definitions`
amendment).** The three op types carry `tagOffset: number` — the byte offset of the tag body —
rather than `origin: TagRef`. The dump and source maps consume byte offsets, and a `TagRef` would
couple the op type to the container's record type for no benefit. Likewise `PlacementOp.blendMode`
is the raw APP-§6 byte (`number | null`), not a named `BlendMode` union: APP-§6's values are
recorded verbatim, and the named mapping is the renderer's job (GFX-§). `SetTabIndexOp` (doc 040)
carries the same `tagOffset: number`.

The realised `ClipActions` shape is also explicit: it retains the top-level `reserved` word, the
union `allEvents`, per-record `events`/`keyCode`/`actions`/`sizeBytes`, the versioned `endFlagWidth`,
the observed `endFlag` (zero or `null` if truncated), and a raw byte range for the whole body. Each
`ClipEventFlags` keeps the raw mask, its 2- or 4-byte width, and reserved/version-inapplicable bits.
The button and clip-action `ActionBlockRef` ranges point directly at ACTIONRECORD bytes; doc 050
analyzes those ranges without skipping a tag header.

**IMPL-030-R003** `ClipEventFlags` MUST be modelled as explicit booleans in **spec bit order**
(APP-§10.1), not as a raw mask, and MUST additionally carry `raw` plus `width: 2 | 4`. The width is
version-dependent (2 bytes for SWF ≤ 5, 4 bytes for SWF ≥ 6) and MUST come from the movie's version,
not be inferred from the tag length.

**IMPL-030-R004** Unknown/reserved bits MUST be preserved in `raw` and reported (`SF0114`, info), never
masked away: a newer authoring tool's bit may carry semantics we do not know.

**IMPL-030-R005** `visible` MUST be `boolean | null`: on a move operation, "flag absent" (no change)
and "Visible = 0" (make invisible) are different outcomes. Same rule for every optional field: absent
is `null`, never a default.

**IMPL-030-R006** `FilterSpec` MUST keep the fields in the units the tag stores (pixels for
`blurX/blurY/distance` as 16.16 FIXED; radians for `angle`; gain for `strength` as FIXED8/256;
ratios 0–255) with the unit in a per-field doc comment. Unit normalisation happens once, in the
renderer (GFX-R081, corrected — see E-009).

## 4. Placement semantics (Ch.3, normative)

### 4.1 `PlaceObject` (v1)

- **IMPL-030-R007** `PlaceObject` (v1) fields are `CharacterId` UI16, `Depth` UI16, `Matrix` MATRIX,
  then **an optional `ColorTransform` (CXFORM, no alpha) that is present iff the tag's body extends
  past the end of the matrix**. Implement the tail check against the tag length; do not "peek for
  plausible bytes".
- The tag *adds* a character (spec text); it is superseded by PlaceObject2/3 and rare in SWF 3+.
- **Tolerance (documented deviation, E-010):** real v1 content uses `CharacterId = 0` to mean
  "modify the existing character at this depth". We accept that form, treat it as a move, and report
  `SF0117` (info). The format spec does not document it; we never *generate* it.

### 4.2 `PlaceObject2` / `PlaceObject3` move matrix

| Move | HasCharacter | Meaning (spec) |
| --- | --- | --- |
| 0 | 1 | Add the character at the depth; other present fields set its attributes. |
| 1 | 0 | Modify the character at the depth; **only the fields present in this tag change**. |
| 1 | 1 | **Remove the character at the depth and place a new one** (attributes reset to the new tag's). |

- **IMPL-030-R008** The three cases MUST be implemented distinctly. In particular `Move=1,
  HasCharacter=1` resets instance state (AVM1 `onLoad` fires again); implementing it as an in-place
  mutation is a visible behaviour difference in games that swap symbols at a depth.
- **IMPL-030-R009** `Move=0, HasCharacter=0` is not defined by the spec: treat as a no-op and report
  `SF0126` (warning) — it cannot place and does not ask to modify.
- **IMPL-030-R010** "Move" does *not* mean "values accumulate": a matrix in a move tag **replaces**
  the instance matrix (spec: "Frames replace the transformation matrix of the character").

### 4.3 Depths, clipping, rendering

| Rule | Requirement |
| --- | --- |
| Depth ordering | `Depth` is UI16; lower depths render underneath higher. Exactly one character per depth; a character may be placed at several depths. `IMPL-030-R011` |
| Depth conventions | Authoring-time content conventionally uses small positive depths; ≥ 16384 is conventionally dynamic-only. Report as `SF0112` (info) when a tag uses ≥ 16384. `IMPL-030-R012` |
| Clipping layers | `ClipDepth = n > 0` means this character masks every character with depth in `(depth, n]` — *above* itself, *inclusive* of `n`. `ClipDepth = 0` (or absent) means not a clipping character. `IMPL-030-R013` |
| Mask content | A clipping layer is not drawn (spec); it still runs its timeline. The renderer turns the range into a stencil group (GFX-§8.1). `IMPL-030-R014` |
| ShowFrame | Empty body; renders the display list and "pauses the file for the duration of a single frame" — it is the frame boundary and the clock tick. `IMPL-030-R015` |
| Ratio | Applies to morph shapes: 0 = start, 65535 = end, interpolated in between. Recorded verbatim on every placement. `IMPL-030-R016` |
| Name | Used by `SetTarget` to address the instance; recorded verbatim. `IMPL-030-R017` |
| Filters imply cache | Ch.3 states that adding filters implies the object is cached as a bitmap. Our renderer may still choose its own strategy (`--gfx-cache-hints`), but `cacheAsBitmap` MUST be reported as *implied* when a filter list is present (`SF0116`). `IMPL-030-R018` |

### 4.4 `PlaceObject3` extra fields

Field order is pinned by APP-§10.1; the parts worth calling out:

- `ClassName` is read **before** `CharacterId`, present when `HasClassName` **or**
  (`HasImage` **and** `HasCharacter`). When `HasImage` + `HasCharacter`, the character id names the
  `BitmapData`-like character to place; with `HasImage` + `HasClassName` the class comes from another
  SWF. Both are AVM2-era; in AVM1 content they are decoded, recorded, and reported inert (`SF0124`).
- `BlendMode` (UI8, APP-§6), `BitmapCache` (UI8, **1–255 = enabled, 0 = disabled** — the value is not
  a boolean; preserve it as `rawCacheValue`), `Visible` (UI8, 0/1), then the backing colour.
- **`BackgroundColor` (RGBA) belongs with `PlaceFlagOpaqueBackground`, not with `HasVisible`** — the
  chapter's field table ties it to `HasVisible`, which contradicts its own flag list (E-008). Read it
  after `Visible` only when `HasOpaqueBackground` is set; if `HasVisible` is set without
  `HasOpaqueBackground`, do not consume an RGBA and report `SF0123` (info).
- `ClipActions` is last; `HasClipActions` on a non-sprite character is a violation of "valid only for
  placing sprite characters" → decode, report `SF0125`, and keep the data.

### 4.5 `RemoveObject` / `RemoveObject2`

- `RemoveObject` removes the character **with the matching character id at the given depth**; both
  fields are present. `RemoveObject2` carries only the depth. (Our earlier model assumed depth-only
  for both; corrected.)
- Removing a depth with nothing there is a no-op (report `SF0127`, info, in `--strict-timeline` mode
  only — the timeline dump uses it to flag authoring mistakes).

## 5. Filters (Ch.3, normative)

| Id | Filter | Fields in order | Types / units |
| --- | --- | --- | --- |
| 0 | DropShadow | Colour, BlurX, BlurY, Angle, Distance, Strength, InnerShadow, Knockout, CompositeSource, Passes | RGBA; FIXED (px); FIXED (rad); FIXED (px); FIXED8 (gain = v/256); 3×UB[1]; UB[5] |
| 1 | Blur | BlurX, BlurY, Passes | FIXED (px); UB[5] + Reserved UB[3] |
| 2 | Glow | Colour, BlurX, BlurY, Strength, InnerGlow, Knockout, CompositeSource, Passes | RGBA; FIXED; FIXED8; 3×UB[1]; UB[5] |
| 3 | Bevel | ShadowColour, HighlightColour, BlurX, BlurY, Angle, Distance, Strength, InnerShadow, Knockout, CompositeSource, OnTop, Passes | RGBA×2; FIXED×4; FIXED8; 4×UB[1]; UB[4] |
| 4 | GradientGlow | NumColors, GradientColors[], GradientRatio[], BlurX, BlurY, Angle, Distance, Strength, InnerShadow, Knockout, CompositeSource, OnTop, Passes | UI8; RGBA[N]; UI8[N] (0–255); FIXED×4; FIXED8; 4×UB[1]; UB[4] |
| 5 | Convolution | MatrixX, MatrixY, Divisor, Bias, Matrix[], DefaultColor, Reserved, Clamp, PreserveAlpha | UI8, UI8, FLOAT, FLOAT, FLOAT[X×Y], RGBA, UB[6], UB[1], UB[1] |
| 6 | ColorMatrix | Matrix[] | FLOAT[20], row-major 4×5; the last row is implicit `(0,0,0,0,1)` |
| 7 | GradientBevel | as GradientGlow | (GradientGlow/GradientBevel share one layout) |

- **IMPL-030-R019** `strength` is stored FIXED8 and is **normalised 1.0 at 0x0100** (spec text); do
  not divide by 100. See E-009 and the corrected GFX-R086.
- **IMPL-030-R020** `blurX/blurY/distance` are 16.16 FIXED **in pixels** (spec states distance is in
  pixels and blur shares the type/structure); they are *not* twips. See E-009.
- **IMPL-030-R021** `angle` is radians; **angle 0 puts a drop shadow to the right of the object**
  (spec). The renderer's offset convention must match this sign (GFX-§11.1).
- **IMPL-030-R022** Convolution semantics: applied per RGBA component then saturated; when
  `PreserveAlpha` is set the alpha channel is untouched; `Clamp = 0` samples `DefaultColor` outside
  the plane, `Clamp = 1` clamps to the nearest edge pixel. Matrix sizes are `MatrixX × MatrixY`
  floats read row-major.
- **IMPL-030-R023** ColorMatrix: 20 floats, the transform `R'..A' = M · [R,G,B,A,1]` with the implied
  last row; results saturated. The translation column's unit (0–255) stays `[verify]` GFX-D12 until
  oracle screenshots settle it.
- **IMPL-030-R024** Filter ids 8–255 are reserved: decode as `{ kind: 'unknown' }`, keep the raw bytes
  (`SF0121`, warning) — a title using a future filter must be visible in the report, not silently
  unfiltered.
- **IMPL-030-R025** `CompositeSource` is documented "always 1"; if a file sets it to 0 we honour it
  (don't draw the source) and report `SF0122` (warning, filter parameter out of documented range).

## 6. Clip events and clip actions

- `CLIPEVENTFLAGS` bit order and the 2-byte/4-byte split are pinned in APP-§10.1. The chapter
  lists the bits in file order (`KeyUp` … `Load`, `DragOver` … `Data`, `Reserved[5]`, `Construct`,
  `KeyPress`, `DragOut`, `Reserved[8]`), so a decoder MUST read the field **little-endian** and
  test masks — `Load 0x00000001`, `EnterFrame 0x00000002`, `KeyUp 0x00000080`, `Data 0x00000100`,
  `DragOver 0x00008000`, `DragOut 0x00010000`, `Construct 0x00040000`. Rebuilding the integer
  MSB-first inverts every assignment. The SWF 6+ events are `always 0` in a 2-byte field.
- **IMPL-030-R026** `KeyDown`/`KeyUp` are not key-specific (spec); only `KeyPress` carries a key code
  — from the `ClipActionRecord`. The model MUST NOT attach key codes to other events.
- **IMPL-030-R027** `CLIPACTIONS`: `Reserved` UI16 must be zero; `AllEventFlags` is the union used for
  fast dispatch; one or more records follow; the terminator is UI16 (SWF ≤ 5) or UI32 (SWF ≥ 6) and
  must be zero. Non-zero reserved/terminator values → `SF0119` (warning), and the decoder MUST still
  find the end by walking records (never by trusting the terminator).
- **IMPL-030-R028** `CLIPACTIONRECORD.ActionRecordSize` counts bytes **from the end of the size
  field** to the next record or the end flag. The decoder MUST use it as the authoritative record
  length: read `EventFlags`, the size, the optional key code, then exactly the remaining bytes as the
  action block. If the declared size disagrees with a plausible action parse (e.g. it would overrun
  the tag), report `SF0118` (warning) and bound the block by the tag.
- **IMPL-030-R029** Clip action blocks are handed to doc 050 as `ActionBlockRef` (byte range) — this
  document never parses action records.
- **IMPL-030-R030** Clip actions on a character that is not a sprite (per its dictionary entry) must
  still be decoded (defensive), reported (`SF0125`), and exposed so the report can name the file.

## 7. Frame assembly

```ts
export interface FrameModel {
  readonly index: number;
  readonly ops: readonly DisplayOp[];      // placements, removals and SetTabIndex ops, file order
  readonly actions: readonly ActionBlockRef[];
  readonly label: string | null;           // from FrameLabel (doc 040)
  readonly soundStreamBlock: { offset: number; length: number } | null;
  readonly videoFrames: readonly TagRef[];
}
```

**IMPL-030-R031** `ops` MUST be a single ordered list (place, remove, and tab-index ops interleaved in
file order). Two separate lists would let the runtime apply all removals before all placements; a
place-then-remove pair in one frame must end removed.
**IMPL-030-R032** Assembly MUST be a pure function of the tag index and MUST NOT mutate tags; `verify`
recomputes it from the emitted manifest and requires equality.
**IMPL-030-R033** `ShowFrame` count vs the declared `FrameCount` follows doc 020's mismatch policy
(`SF0023`; the declared count is authoritative for padding, not a reason to discard observed frames).
`observedFrameCount` is the number of frames assembled from the tag stream before padding. The final
`frames` array has `max(declaredFrameCount, observedFrameCount)` entries: if the declared count is
larger, append empty frames; if more frames were observed, retain them all.

## 8. Sprite model (Ch.13, normative)

```
DefineSprite (39, SWF 3+):
  SpriteID   UI16                     // character id, entered into the dictionary
  FrameCount UI16                     // declared frame count (declared value wins, extra observed frames append)
  ControlTags TAG[one or more]        // this sprite's own timeline
  End                                 // the sprite body is End-terminated; the tag length covers it all
```

```ts
export interface SpriteModel {
  readonly characterId: number;
  readonly declaredFrameCount: number;     // from the tag header
  readonly timeline: TimelineModel;        // frames assembled by §7
  readonly tags: readonly TagRef[];        // this sprite's slice of the index
  readonly characterName: string;          // export name, else `sprite_<id>` (a CHARACTER name)
  readonly streamSoundSpans: readonly { headTag: TagRef; blockTags: readonly TagRef[] }[];
}
```

**IMPL-030-R034** Sprites MUST NOT be flattened at decode time; flattening constant content is an
emitter/renderer optimisation (`CMP-D03`) and MUST NOT change the model.
**IMPL-030-R035** A sprite whose body does not end with `End` is a structural error reported by doc 020
(`SF0102`) — sprite definitions are terminated by `End` exactly like the file.
**IMPL-030-R036** Nested sprite depth is bounded by doc 020's index cap; assembly reuses the indexed
structure instead of re-walking.

**IMPL-030-R037** **Definition tags are not allowed inside `DefineSprite`.** A sprite's characters MUST
be defined in the file body *before* the `DefineSprite` tag; a control tag inside a sprite may not add
to the dictionary. A definition tag found inside a sprite is decoded for the report but MUST NOT enter
the dictionary (`SF0128`, warning, listing the tag code and the sprite id). This is the rule that makes
"the sprite's timeline was assembled from tags that arrived after it" a *structural* error rather than
a mysterious render-order bug.
**IMPL-030-R038** The tags valid inside a sprite are the chapter's closed set: `ShowFrame`,
`PlaceObject`, `PlaceObject2`, `RemoveObject`, `RemoveObject2`, all action tags, `StartSound`,
`FrameLabel`, `SoundStreamHead`, `SoundStreamHead2`, `SoundStreamBlock`, `End`. `PlaceObject3`,
`StartSound2`, `VideoFrame` and the sprite-metadata tags (`FrameLabel`'s siblings such as
`DefineScalingGrid` placement) are legal in real content although the chapter's list predates them:
they are decoded normally and reported as `SF0129` (info) once per sprite/tag-kind — the list is a
*permission* list, not a parser feature test.
**IMPL-030-R039** A sprite has its own streaming sound: `SoundStreamHead`/`SoundStreamBlock` inside a
sprite define an independent stream that Flash **mixes with the main sound track**. `streamSoundSpans`
records each head and its blocks so doc 090 can build the second (and further) stream segments and the
runtime mixes them (AUD-§7); a sprite's stream does not replace or interrupt the main stream.
**IMPL-030-R040** Instance naming and target paths (Ch.13): a sprite *instance* gets its name from the
`PlaceObject2`/`PlaceObject3` `Name` field, not from the sprite *character*. `SetTarget` resolves
against those instance names with this grammar:

| Path | Meaning |
| --- | --- |
| `/Jack` | absolute from the root: the instance named `Jack` on the root timeline |
| `/Jack/Bert` | absolute path through nested instances |
| `Bert` | sibling/child relative to the *current* target's timeline |
| `../Ernie` | one level up, then the instance `Ernie` |
| `../../Jill` | two levels up |
| `""` | restore the current file as the target |

Absolute paths start at the root, `..` climbs to the parent timeline, and an unqualified name is
resolved against the current timeline (never globally) — `IMPL-050-R036/R037` owns the parser and the
block-splitting; this document owns the *naming* that makes the paths meaningful, and the model MUST
expose each placement's `Name` verbatim (`T-MOD-602`).
**IMPL-030-R041** A placement's transform is concatenated with the transforms of the objects placed
inside the sprite, and the children move/scale/rotate with it; removal from the display list **stops the
sprite's timeline automatically** (it does not keep ticking off-screen) — the runtime's frame stepping
and doc 090's stream scheduling both key off this rule (RT-R021).
**IMPL-030-R042** `_totalframes` and `_currentframe` come from the assembled timeline; the declared
`FrameCount` is the non-authoritative copy (doc 020's mismatch policy, `SF0023`), and `T-MOD-601`
covers the declarations that disagree with the observed `ShowFrame` count.

## 9. Diagnostics

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0110` | warning | placement (or, via doc 100, a button state) refers to an unknown character id — placeholder inserted; shared with doc 100 |
| `SF0111` | warning | inverted/degenerate `RECT` while assembling bounds |
| `SF0112` | info | placement depth ≥ 16384 (conventionally dynamic-only) |
| `SF0113` | warning | clip-depth value does not exceed its own depth (mask is empty) |
| `SF0114` | info | unknown placement/filter/clip-event bits, preserved raw |
| `SF0115` | warning | clip actions present but no handler flags set |
| `SF0116` | info | `CacheAsBitmap` set, or implied by a filter list |
| `SF0117` | info | `PlaceObject` v1 with `CharacterId = 0` (tolerated move; E-010) |
| `SF0118` | warning | `CLIPACTIONRECORD` declared size disagrees with its content |
| `SF0119` | warning | `CLIPACTIONS` reserved field or end flag is not zero |
| `SF0120` | warning | unknown blend mode value (15–255), treated as normal |
| `SF0121` | warning | reserved/unknown filter id (8–255) |
| `SF0122` | warning | filter parameter outside its documented range |
| `SF0123` | info | PlaceObject3 backing fields present (visible/opaque background) |
| `SF0124` | warning | PlaceObject3 class-name/image fields (AVM2-era) in AVM1 content — inert |
| `SF0125` | warning | clip actions on a non-sprite character |
| `SF0126` | warning | `PlaceObject*` with neither `Move` nor `HasCharacter` (no-op) |
| `SF0127` | info | removal at a depth that is empty (strict-timeline mode) |
| `SF0128` | warning | definition tag inside a sprite (ignored for the dictionary) |
| `SF0129` | info | tag inside a sprite outside the chapter's list (decoded normally; reported once per kind) |

## 10. Test obligations

Test-id band: `T-MOD-001`–`012` (v1.0) and `T-MOD-601`–`604` (the Ch.13 and Appendix
passes). The sprite/sound obligations originally occupied `T-MOD-013`–`015`, which is `IMPL-040`'s block
(`013`–`036`); they were moved to `601`–`604` — errata `E-023` addendum.

| ID | Test | Level |
| --- | --- | --- |
| `T-MOD-001` | `PlaceObject` v1: with and without the trailing CXFORM tail; `CharacterId = 0` tolerance | F1 |
| `T-MOD-002` | Move matrix: all three defined cases; `1/1` resets instance attributes | F2 |
| `T-MOD-003` | Frame ops ordering: place + remove in one frame ends removed | F2 |
| `T-MOD-004` | Clip-depth ranges: `(depth, clipDepth]` inclusive/exclusive boundaries | F2 |
| `T-MOD-005` | All 8 filter layouts round-trip byte-for-byte from writer fixtures; FIXED/FIXED8 units asserted | F1 |
| `T-MOD-006` | Unknown filter id/unknown blend mode preserved + reported | F1 |
| `T-MOD-007` | CLIPEVENTFLAGS: SWF 5 (2-byte) and SWF 6+ (4-byte) layouts, every bit | F1 |
| `T-MOD-008` | CLIPACTIONS framing: reserved, `AllEventFlags`, record sizes, key codes, both end-flag widths | F1 |
| `T-MOD-009` | PlaceObject3 full field order incl. ClassName-before-CharacterId and backing fields | F1 |
| `T-MOD-010` | Opaque-background RGBA read per E-008; HasVisible-only must not consume 4 bytes | F1 |
| `T-MOD-011` | Sprite frame counts, empty sprites, missing `End` | F2 |
| `T-MOD-012` | Model round-trip: assemble → serialise → re-assemble identical | F1 |
| `T-MOD-601` | Sprite tag set: definition inside a sprite, out-of-list tags, missing `End`, declared-vs-observed frames | F2 |
| `T-MOD-602` | Instance naming + `SetTarget` path grammar (`/abs`, `..`, relative, `""`) over a nested fixture | F1 |
| `T-MOD-603` | Sprite streaming sound: spans recorded, mixed with the main stream, stops with the sprite | F2 |
| `T-MOD-604` | Appendix A placement walk: `86 06` short header, flags `HasMatrix | HasCharacter`, depth 1, character 1, empty matrix byte `00` (`NTranslateBits` 0) | F1 |

## 11. Work packages

| WP | Title | Depends | Est | Deliverable |
| --- | --- | --- | --- | --- |
| WP-030-01 | Shared placement field reader (order/units per APP-§10.1) | WP-010-09, WP-020-05 | 2 | `place-common.ts` |
| WP-030-02 | `PlaceObject` v1 incl. optional-CXFORM tail + tolerance | WP-030-01 | 1 | T-MOD-001 |
| WP-030-03 | `PlaceObject2` move matrix | WP-030-02 | 2 | T-MOD-002 |
| WP-030-04 | `PlaceObject3` (second flag byte, backing fields, class/image) | WP-030-03 | 3 | T-MOD-009/010 |
| WP-030-05 | Filter list + all 8 filters with exact types/units | WP-030-01 | 4 | `filters.ts`, T-MOD-005/006 |
| WP-030-06 | CLIPEVENTFLAGS + CLIPACTIONS + record framing | WP-030-01, WP-050-01 | 3 | `clip-events.ts`, `clip-actions.ts`, T-MOD-007/008 |
| WP-030-07 | Remove/ShowFrame decoders | WP-020-05 | 1.5 | `remove-object.ts`, T-MOD-003 |
| WP-030-08 | Sprite model + nested timelines | WP-030-07, WP-020-06 | 3 | `sprite.ts`, T-MOD-011 |
| WP-030-09 | Frame assembly with ordered `DisplayOp` list | WP-030-03…08 | 3.5 | `frame-assembly.ts`, T-MOD-012 |
| WP-030-10 | `inspect --timeline` model dump + goldens | WP-030-09 | 2 | first user-visible timeline view |
| WP-030-11 | Ch.3 conformance corpus (all flag combinations, all filters, both versions) | WP-030-05…09 | 2 | fixture suite + goldens |
| WP-030-12 | Sprite tag-set/naming model + stream-sound spans + path grammar fixtures | WP-030-08, WP-050-05 | 3 | `sprite.ts` additions, T-MOD-601/602/603 |
| | **Total** | | **30** | |

## 12. Open items / state of reconciliation

| # | Item | Status |
| --- | --- | --- |
| 1 | `PlaceObject3` flag/field order | **settled** (APP-§10.1; T-MOD-009) |
| 2 | Filter structures and units | **settled** (E-009 for the unit correction; T-MOD-005) |
| 3 | `ClipActions` framing and record sizes | **settled** (T-MOD-008) |
| 4 | `ClipEventFlags` bit map and widths | **settled** (APP-§10.1; T-MOD-007) |
| 5 | `PlaceObject` v1 semantics incl. the move form | **settled as documented deviation** (E-010; T-MOD-001) |
| 6 | PlaceObject3 `BackgroundColor` ↔ flag mismatch in the chapter | **resolved** (E-008; T-MOD-010) |
| 7 | Ch.13 sprite detail: naming, `_totalframes`, frame-count edge semantics, sprite-vs-clip differences | **settled** (Ch.13; §8 R037–R042; `T-MOD-013`–`015`) |
| 8 | Whether `Move=0, HasCharacter=0` should be an error rather than a warning | open (we warn, `SF0126`) |
| 9 | Definitions for filters on placements inside buttons (Ch.12 interaction) | **settled** — `BUTTONRECORD`'s `FILTERLIST` is the same structure as `PlaceObject3.SurfaceFilterList` (`IMPL-100-R010`, `T-MOD-813`) |
| 10 | Ch.3 says filters imply bitmap caching; our renderer may not cache — divergence must be declared per title | open (policy decision at P4) |

## 13. Done criteria

1. Every placement form and every filter decodes from writer fixtures with byte-exact field values.
2. A 32-combination flag corpus for PlaceObject2 and a 16-bit flag corpus for PlaceObject3 decode
   without desynchronisation.
3. Clip actions for SWF 5 and SWF 6+ round-trip, including a record whose `ActionRecordSize` is
   deliberately wrong (`SF0118` path).
4. `dump` emits every main/sprite frame as stable, diffable JSON; parsing and re-serializing that JSON preserves identical bytes (`T-MOD-012`, `T-MOD-037`). Full SWF-byte reconstruction by a `verify` verb remains a separate, unimplemented harness feature (doc 140).
5. Exit criterion for the chapter (**satisfied in v1.2**): every §12 row is settled; none is marked `pending chapter`.

## 14. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Scoped from the Ch.3/Ch.13 table of contents; layouts marked pending |
| 1.1 | Ch.3 intake | Field orders, filter layouts/units, CLIPACTIONS/CLIPEVENTFLAGS framing and the v1/CXFORM rule pinned from the chapter; new diagnostics `SF0117`–`SF0127`; errata E-008, E-009, E-010 filed; WPs 01–11 re-estimated (27 d) |
| 1.2 | 2026-10-04 | Ch.13-grounded: `DefineSprite` body and the closed sprite tag set (with the chapter's pre-`PlaceObject3` omissions reported rather than rejected), definition-tags-not-allowed rule, sprite-local streaming sound spans mixed with the main track, instance naming + `SetTarget` path grammar, removal-stops-the-timeline; diagnostics `SF0128`/`SF0129`; tests `T-MOD-601`–`603` (renumbered from `013`–`015` in v1.3 — `E-023` addendum); WP-030-12 added (30 d) |
| 1.3 | 2026-10-04 | Appendix pass: `T-MOD-604` asserts the Appendix A `PlaceObject2` walkthrough (the only upstream byte-level placement example); the sprite/naming/sound obligations move out of `IMPL-040`'s `T-MOD-013`–`036` block to `T-MOD-601`–`604` (`E-023` addendum) |
| 1.4 | 2026-10-04 | Tech-spec pass: `IMPL-030-R007` was cited in §4.1 but never defined (lost in the Ch.3 intake) — the bullet is now the numbered rule |
| 1.5 | 2026-10-05 | P2 integrity resolution (R-P2-13): §3 amended to the implemented surface API — `PlacementOp`/`RemovalOp` (and `SetTabIndexOp`, doc 040) carry `tagOffset: number` (byte offset of the tag body) instead of `origin: TagRef`, and `PlacementOp.blendMode` is the raw APP-§6 byte (`number \| null`), with the named mapping left to the renderer; documented deviation, not reworked (precedent: the P1 `definitions` amendment) |
| 1.6 | 2026-10-05 | P2 repeat-audit correction: document the realized `ClipActions`/`ClipEventFlags` surface (reserved fields, record byte sizes/ranges, end marker, and raw body); replace the stale `inspect --timeline`/`verify` done criterion with the implemented stable `dump` JSON + byte-identical JSON re-serialization (`T-MOD-012/037`); placement and sprite framing obligations now have labeled evidence in the test suite |
