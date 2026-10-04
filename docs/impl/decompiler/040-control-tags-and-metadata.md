# IMPL-040 — Control Tags and Metadata

**Doc ID:** IMPL-040 · **Status:** ✅ grounded in Ch.4 + Ch.15 · **Package:** `@swf-forge/swf`
**Format spec:** Chapter 4 — Control Tags (`SetBackgroundColor` 9, `FrameLabel` 43, `Protect` 24, `End` 0,
`ExportAssets` 56, `ImportAssets` 57, `EnableDebugger` 58, `EnableDebugger2` 64, `ScriptLimits` 65,
`SetTabIndex` 66, `FileAttributes` 69, `ImportAssets2` 71, `SymbolClass` 76, `Metadata` 77,
`DefineScalingGrid` 78, `DefineSceneAndFrameLabelData` 86); Chapter 15 — Metadata (`DefineBinaryData` 87,
`EnableTelemetry` 93)
**Design specs:** CMP-§3/§4.2, AST-§6 (manifest), SWF-§5, RT-§7 (system tags), AVM1-§10, APP-§2/§10.2
**Pinned byte layouts:** APP-§10.2 (Ch.4 structures) — this document carries the semantics and the
decoder traps; APP-§10.2 carries the field order.

---

## 1. Deliverables

Every non-media, non-action control/meta tag resolved into the `MovieModel` or into an explicit,
reported no-op:

| Tag (code) | Version | Output | Pinned by |
| --- | --- | --- | --- |
| `SetBackgroundColor` (9) | SWF 1 | `movie.background` (RGB, 0xRRGGBB) + per-frame occurrences | Ch.4 |
| `FrameLabel` (43) | SWF 3 | label → frame index, plus the named-anchor flag (SWF 6+) | Ch.4 |
| `Protect` (24) | SWF 2 | `movie.metadata.protect` (`none` / password present); never acted on | Ch.4 |
| `End` (0) | SWF 1 | stream terminator for the file **and** for every sprite (doc 020 bounds; presence checked here) | Ch.4 |
| `ExportAssets` (56) | SWF 5 | `dictionary.exports`: name → character id (+ reverse index for recovered symbol names) | Ch.4 |
| `ImportAssets` (57) | SWF 5–7 only | import requests resolved against the multi-movie input set when the movie is SWF ≤ 7; **ignored** for SWF ≥ 8 | Ch.4 |
| `ImportAssets2` (71) | SWF 8 | same, plus the reserved-byte validation | Ch.4 |
| `EnableDebugger` (58) | SWF 5 only | recorded; never acted on (`SF0151`, info) | Ch.4 |
| `EnableDebugger2` (64) | SWF 6 | recorded; never acted on | Ch.4 |
| `ScriptLimits` (65) | SWF 7 | max recursion depth (default 256) + script timeout → interpreter budgets | Ch.4 |
| `SetTabIndex` (66) | SWF 7 | `SetTabIndexOp` in `FrameModel.ops` (doc 030) → per-character focus/accessibility order | Ch.4 |
| `FileAttributes` (69) | SWF 8 (optional earlier) | AS3 flag (**hard error `SF1000`**), `UseNetwork`, `HasMetadata`, `UseDirectBlit`, `UseGPU` | Ch.4 |
| `SymbolClass` (76) | SWF 8/9 | class-name ↔ character associations; for AVM1 an extra export-name source only | Ch.4 |
| `Metadata` (77) | SWF 1 (in practice 8+) | RDF/XMP string → `movie.metadata.xmp`; never parsed for behaviour | Ch.4 |
| `DefineScalingGrid` (78) | SWF 8 | 9-slice `Splitter` rect attached to a sprite/button character (GFX-§8.3) | Ch.4 |
| `DefineSceneAndFrameLabelData` (86) | SWF 9 | scene table + labels collapsed into the frame space (AVM1-D04) | Ch.4 |
| `DefineBinaryData` (87) | SWF 9 | `binary` asset shipped verbatim (SEC-R003) | **[Ch.15 pending]** |
| `EnableTelemetry` (93) | SWF 11 | recorded; no-op (`SF0152`, info) | **[Ch.15 pending]** |

**Non-goals:** media tags (docs 060–110) and action tags (doc 050).

## 2. Module layout

```
packages/swf/src/
  control/
    background.ts        SetBackgroundColor (9)
    frame-label.ts       FrameLabel (43) + named-anchor byte
    scenes.ts            DefineSceneAndFrameLabelData (86) -> scene table + frame remap
    end-tag.ts           End (0) presence/bounds validation (framing lives in doc 020)
    exports.ts           ExportAssets (56) / SymbolClass (76) -> export map
    imports.ts           ImportAssets (57) / ImportAssets2 (71)
    file-attributes.ts   FileAttributes (69) + AVM2 detection
    script-limits.ts     ScriptLimits (65)
    tab-index.ts         SetTabIndex (66) -> SetTabIndexOp (imported by doc 030)
    scaling-grid.ts      DefineScalingGrid (78)
    binary-data.ts       DefineBinaryData (87)
    metadata.ts          Metadata (77), Protect (24), EnableDebugger* (58/64), EnableTelemetry (93)
    kinds.ts             per-tag kind/attribute unions shared with the model
```

**IMPL-040-R001** Each tag module MUST export exactly two things: a `parse(cursor): Parsed` function and
an `apply(model, parsed): void` function, so decoding stays testable in isolation and application stays
auditable in one place (the model builder calls every `apply`).

**IMPL-040-R002** No control-tag module may import from a media module. Where a tag *references* media
(e.g. `DefineScalingGrid` → a shape; `ExportAssets` → any character), it stores the character id and
lets the dictionary resolve it later.

**IMPL-040-R003** `tab-index.ts` MUST export the `SetTabIndexOp` interface (see §3.4) and nothing that
imports from doc 030: the dependency is one-way, **doc 030 → doc 040** (doc 030's `DisplayOp` union
imports the type and its frame assembler stamps the `index`). This is the only cross-document type
dependency in the control layer and MUST be a type-only import so no runtime cycle can form.

## 3. Behavioural rules

### 3.1 Background and stage

- **IMPL-040-R004** `SetBackgroundColor` MUST set `movie.background` (`RGB`, no alpha). The body is
  exactly 3 bytes; a tag with any other body length is malformed (`SF0114`-style warning, bytes kept,
  colour not applied).
- **IMPL-040-R005** Multiple occurrences: the value in effect at the first `ShowFrame` is the initial
  paint; every occurrence is recorded in file order with its frame index and re-applied by the runtime
  at the same point in playback (Flash applies the tag where it is processed, which is exactly "at that
  point in the timeline"). Design decision — the chapter states no dedupe rule.
- **IMPL-040-R006** If no `SetBackgroundColor` exists, the background is white (`0xFFFFFF`) with
  `backgroundSource: 'default'`. The chapter does not state a default; this matches Flash's observed
  behaviour (`[oracle-pinned]`, `T-MOD-013`) and MUST be reported as a decision in the movie report.

### 3.2 `End`, frames, and labels

- **IMPL-040-R007** `End` (tag 0) MUST be the last tag of the file **and** of every sprite's tag stream
  (Ch.4: "also required to end a sprite definition"). A missing `End` at either level is `SF0173`
  (warning) and MUST NOT stop decoding: doc 020's bounds are the authority for where the stream ends.
- **IMPL-040-R008** `FrameLabel` MUST associate a name with the *next* `ShowFrame` (the frame about to be
  shown — Ch.4: "gives the specified Name to the current frame"). A duplicate label MUST be reported
  (`SF0153`, warning) and resolve to the **first** occurrence for name lookups; the model keeps every
  occurrence with its frame index so `verify` can list the shadowed ones.
- **IMPL-040-R009** The **named-anchor** extension (SWF 6+) MUST be detected by *one remaining byte
  after the string's null terminator* — that byte is the `UI8` anchor flag spelled out in Ch.4's
  `NamedAnchor` form table, and it is always `1`. An anchor byte with another value is `SF0165`
  (warning) and is still treated as an anchor (the byte is present, so the frame is anchored).
  Trailing bytes beyond that single flag are unknown data (`SF0114`-style, preserved in the report).
  `NamedAnchor` ≠ `FrameLabel` for navigation purposes: `ActionGoToLabel` uses the *name*, scene
  navigation uses anchors (design `AVM1-D04`).
- **IMPL-040-R010** The player-visible anchor semantics are data we publish, not behaviour we perform:
  the host shell (RT-§7) MUST be able to read the current frame's anchor name and jump to a named anchor
  requested from the page URL. Compilation stores `{name, frame, namedAnchor}`; nothing in the emitted
  bundle may touch `window.location` itself (the shell owns the URL, SEC-R011).
- **IMPL-040-R011** `DefineSceneAndFrameLabelData` MUST produce a scene table (`{name, frameOffset}[]`,
  offsets zero-based and global to the timeline) and a **frame remap** from scene-relative to absolute
  frame indices. `TimelineModel.frames` stays absolute; `nextScene`/`prevScene` compute from the scene
  table at runtime (emitted as data, doc 120).
- **IMPL-040-R012** The tag's frame-label list (`FrameNum` zero-based, global to the symbol) is a second
  label source. Labels from it and from `FrameLabel` tags share one namespace with the §3.2 first-wins
  rule; both lists MUST be merged deterministically (tag order first, then the scene data's list) so two
  identical inputs cannot produce two different models.
- **IMPL-040-R013** Scenes are **main-timeline only** (Ch.4). Scene data found inside a sprite MUST be
  recorded as a single implicit scene covering that sprite's timeline and reported (`SF0169`); scene
  offsets that are decreasing, that repeat, that do not start at 0, or that exceed the frame count MUST
  be reported (`SF0169`, warning) and clamped to the frame space for navigation.
- **IMPL-040-R014** Scene data MUST NOT renumber frames in a way that changes `_currentframe`: Flash's
  `_currentframe` is absolute within the timeline, so the remap is used only for scene navigation.

### 3.3 Exports, imports, classes

- **IMPL-040-R015** `ExportAssets` entries MUST be validated: empty names (`SF0154`), duplicate
  **character ids** (`SF0159` — Ch.4 states the later name replaces the earlier one for the same
  character id, so the last name wins, and the shadowed one is kept for the report), duplicate **names**
  (`SF0160`, warning — the chapter is silent; we keep the **first** id because name-keyed lookups such as
  recovered symbol names must be deterministic), and ids not in the dictionary (`SF0174`, info,
  resolved through doc 020's `missing` placeholder policy). Export names are the primary source of
  recovered *symbol* names (AVM1-R036) and therefore matter far beyond linkage.
- **IMPL-040-R016** `ExportAssets` names MUST be treated as opaque strings apart from the manifest
  sanitisation in `SF0154`; no name may be used to build a filesystem path or an emitted identifier
  without going through the identifier-mangling rules of CMP-§7.
- **IMPL-040-R017** `SymbolClass` (SWF 8+, AVM2-era) MUST be decoded in every movie. Its associations
  are an **export-name source only** in AVM1 content (Ch.4: the class must have been declared by a
  `DoABC` tag, which AVM1 content does not have); we MUST NOT attempt to instantiate AVM2 classes.
  Character id **0** is the main-timeline root class (Ch.4) and MUST be recorded as
  `movie.control.rootClassName` rather than as an asset export. If `FileAttributes.AS3` is set anywhere,
  `SF1000` (error) is raised at open (doc 020) and `SymbolClass` is not reached.
- **IMPL-040-R018** `ImportAssets`/`ImportAssets2` MUST attempt resolution against the multi-movie input
  set (`forge.config.input.others`) **only when the movie's declared version is ≤ 7**: Ch.4 states that
  `ImportAssets` was deprecated in SWF 8 and is ignored by Flash Player 8 and later, and its version
  window is "minimum SWF 5, maximum SWF 7". A `57` tag in a SWF 8+ file is therefore decoded, reported
  (`SF0161`, warning) and **has no effect** — the referenced characters fall under the dictionary's
  `missing` placeholder policy so that logic referencing them still runs, exactly as in the player.
- **IMPL-040-R019** `ImportAssets2` reserved bytes MUST be validated (`1` then `0`, Ch.4); any other
  values are `SF0162` (warning) and decoding continues.
- **IMPL-040-R020** Unresolved imports produce `SF0150` (warning) listing the url and names, and the
  character becomes a `missing` placeholder (doc 020's policy). Import urls MUST NOT be fetched: the
  resolution is a lookup in the supplied input set (default-deny `NetworkPolicy`, SEC-§4).
- **IMPL-040-R021** A resolved import MUST alias the imported character id to the local one **without
  copying the payload**; the model records `{localId, sourceMovie, sourceId}` and downstream stages
  follow the alias exactly once (no chains: an alias of an alias resolves transitively with a cycle
  check, `SF0155` on a cycle).

### 3.4 Script limits, tab index, scaling grid

- **IMPL-040-R022** `ScriptLimits` MUST be recorded as authored: `MaxRecursionDepth` (default 256 at the
  time the chapter was written; the chapter's default may change) and `ScriptTimeoutSeconds` (platform
  default 15–20 s, subject to change). Values MUST NOT be copied into the model as "the" limits: the
  model keeps `maxRecursionDepth: number | null` and lets the budget mapping derive the interpreter
  budget (AVM1-R073), so a future default change touches one function. A depth of `0` (Ch.4 requires
  "greater than zero") or a timeout outside our supported window is `SF0170` (warning) and clamped.
- **IMPL-040-R023** The `ScriptLimits` override MUST win over our default budget for that movie, with a
  hard ceiling still enforced: a legacy limit is not a reason to hang a browser tab. The reported budget
  MUST state both values when they differ.
- **IMPL-040-R024** `SetTabIndex` MUST NOT be applied during parsing. `tab-index.ts` validates the body
  (`Depth` UI16, `TabIndex` UI16), and the frame assembler (doc 030) puts a `SetTabIndexOp` into the
  ordered `FrameModel.ops` list so the value is applied to whatever character occupies that depth **at
  that point in the timeline**:

  ```ts
  export interface SetTabIndexOp {
    readonly kind: 'tabIndex';
    readonly index: number;     // file order within the frame; stamped by doc 030's assembler
    readonly depth: number;     // UI16, as authored
    readonly tabIndex: number;  // UI16; lower = earlier in the tab order
    readonly origin: TagRef;
  }
  ```

  **IMPL-040-R025** Ch.4: "If no character is currently placed at the specified depth, this tag is
  ignored." The assembler MUST therefore call the shared predicate `tabIndexApplies(opsSoFar, depth)`
  exported by `tab-index.ts` and report `SF0166` (info) when it returns false — the tag is *not* an
  error and MUST NOT be applied to a later placement.
  **IMPL-040-R026** The runtime's focus order (RT-R042) consumes the applied per-character indices, sorted
  by `(tabIndex, depth)`; `TabIndex` is a UI16, so `-1` does not exist in the tag and "not focusable" is
  expressed only by the absence of a tag (the AS `tabIndex = -1` path is an AVM1 concern, doc 050).
  **IMPL-040-R027** Static text is the reason this tag exists (Ch.4): the tag is the only way to give a
  static text object an accessibility order, so the runtime MUST expose static-text tab stops to the
  accessibility layer (RT-§7) and MUST NOT drop them because static text "cannot be focused".
- **IMPL-040-R028** `DefineScalingGrid` MUST attach `{left, top, right, bottom}` (**twips**) to the target
  character in the model. Validation: the splitter's width and height MUST each be **at least one twip**
  (Ch.4: otherwise Flash Player ignores the tag) → `SF0167` (warning, attachment dropped); a
  non-sprite/button target or an unknown character id → `SF0168` (warning, attachment dropped). The
  renderer consumes the rect (GFX-R065); the *bitmap* pipeline also consumes it for sprite metadata
  (AST-R016). Repeated tags for one character: the last one wins and the shadowed rect is reported.
- **IMPL-040-R029** The 9-slice semantics are the renderer's (GFX-§8.3) but MUST follow Ch.4 exactly:
  corners unscaled; children and text inside the character transform normally; fills stretched; bounds
  and origin unaffected; **a rotated or skewed 9-slice character reverts to normal scaling** (parents' and
  children's rotation still apply normally); below the original size the scaling regions are consumed
  until they are very small, after which the character reverts to normal scaling. The last two rules are
  the ones implementations get wrong and MUST be covered by `T-MOD-020`.

### 3.5 Anatomy of `FileAttributes`, metadata, binary data

- **IMPL-040-R030** `FileAttributes` is **required for SWF 8 and later and MUST be the first tag**;
  it may optionally appear in earlier versions (Ch.4). Doc 020 owns the "is the first tag" check at the
  stream level; this document consumes it (`SF0172`, warning, with the tag offset named) and records the
  flags verbatim. Ch.15 adds a second, *root-only* rule: `FileAttributes` "is only interpreted on the
  root SWF", so an occurrence inside a sprite is ignored (decoded for `inspect`, `SF0175`, info) even if
  it is the first tag of that sprite's body.
- **IMPL-040-R031** The flags MUST be decoded per the chapter's bit-field order. The chapter lists the
  fields in this order: `Reserved` `UB[1]`, `UseDirectBlit`, `UseGPU`,
  `HasMetadata`, `ActionScript3`, `Reserved` `UB[2]`, `UseNetwork`, `Reserved` `UB[24]`. Because Ch.1
  packs bit fields MSB-first *within the byte stream*, the first eight fields are exactly the **first
  byte of the tag body**, and reading that byte as the low byte of a little-endian `UI32` gives:

  | Field (chapter order) | Mask on the LE-read `UI32` | Version notes |
  | --- | --- | --- |
  | `Reserved` (bit 7 of the first byte) | `0x00000080` | must be 0 |
  | `UseDirectBlit` | `0x00000040` | SWF 10+; browser equivalent `wmode="direct"` |
  | `UseGPU` | `0x00000020` | SWF 10+; browser equivalent `wmode="gpu"` |
  | `HasMetadata` | `0x00000010` | |
  | `ActionScript3` | `0x00000008` | SWF 9+; `SF1000` |
  | `Reserved` (2 bits) | `0x00000004`, `0x00000002` | must be 0; some authoring tools set them → `SF0171` (info, recorded verbatim) |
  | `UseNetwork` | `0x00000001` | any version |
  | `Reserved` (24 bits) | `0xFFFFFF00` | must be 0; the remaining three bytes |

  Ch.15 restates the same byte with different names for three bits, and the difference is itself a
  documented upstream inconsistency (`E-022`): Ch.15 calls bits 6 and 5 `Reserved UB[3]` (they are
  `UseDirectBlit`/`UseGPU` in the authoritative tag description, SWF 10+) and names bit 2
  `SWFFlagsNoCrossDomainCache`, which the tag description lists as reserved. Our reader follows the
  tag description and therefore treats bit `0x00000004` as the **legacy SWF 9 `NoCrossDomainCache`
  flag**: recorded verbatim and named (`SF0176`, info), never used to change behaviour (the browser's
  own cross-origin rules are the only cache policy we have, SEC-§4).

  **IMPL-040-R032** The masks above are the *only* sanctioned reading. Three traps MUST be documented in
  the decoder's unit tests (`T-MOD-021`): (a) reading the four bytes as a **big-endian** word inverts the
  flag positions; (b) building an integer MSB-first from the bit-field sequence inverts them a second
  way; (c) the `Reserved UB[24]` tail occupies the remaining three bytes and is not "the rest of an
  integer". Unknown/reserved bits are preserved in `raw` and never masked away from the report.
- **IMPL-040-R033** `UseDirectBlit`/`UseGPU` matter only in the standalone player (Ch.4). In the browser
  they are the `direct`/`gpu` wmode equivalents, so our shell MUST translate them into *rendering hints*
  (RT-§3: `direct` ⇒ no full-frame compositing; `gpu` ⇒ GPU-composited layers where available) and MUST
  NOT treat them as permissions.
- **IMPL-040-R034** `UseNetwork` MUST be recorded as a **declared policy**: it chooses local-file access
  vs network access for a locally loaded SWF (Ch.4). Our shell is always network-default-deny
  (SEC-§4); the flag only ever *strengthens* the local posture of the report and MUST NOT grant network
  access that the compile-time `NetworkPolicy` denies.
- **IMPL-040-R035** `HasMetadata` and the `Metadata` tag are a **biconditional** in Ch.4: a `Metadata`
  tag requires `FileAttributes.HasMetadata` to be set, and a set flag requires the tag to exist. Either
  violation is `SF0163` (warning). `Metadata` MAY occur at most once; a second occurrence is `SF0164`
  (warning) and the **first** is kept (the chapter states only "can only be in the SWF file one time").
- **IMPL-040-R036** The `Metadata` string is RDF/XMP that the SWF stores "with all unnecessary white
  space removed"; whitespace stripping is therefore an *authoring* concern. We MUST store the string
  verbatim for provenance and MUST NOT reformat it, parse it, or act on anything inside it (design
  `SWF-D07`; the manifest exposes it per AST-§6/`AST-D07`). Any URL inside is inert text — SEC-R011's
  principle applied to non-DOM sinks.
- **IMPL-040-R037** `AS3` and the presence of `DoABC` are **two independent AVM2 signals**; either one
  triggers `SF1000`. Reporting only on `DoABC` misses AVM2 files whose script was stripped, and
  reporting only on the flag misses malformed hybrid files. For an `AS3`-flagged movie, the error MUST
  name the `FileAttributes` offset.
- **IMPL-040-R038** `DefineBinaryData` (87, SWF 9+) is a **definition tag**: `Tag UI16` (the character id),
  `Reserved UI32` (must be 0), then `Data` to the end of the tag. It MUST register a `binary` asset
  (`{id, bytes}`) in the dictionary and MUST NOT be inlined into generated code as a string or data URL
  (SEC-R003); payload access is by `ArrayBuffer`/`Uint8Array` only. Non-zero reserved bytes are recorded
  verbatim (`SF0171`-style, `SF0178`); a `SymbolClass` entry naming the character in an AVM1 content file
  is inert and reported once (`SF0179`, info). `T-MOD-036` pins the layout, including a zero-length
  `Data` (legal: "up to the end of the tag").
- **IMPL-040-R039** `Protect` semantics MUST be recorded exactly as Ch.4 states them: length 0 ⇒ the file
  "cannot be imported" by an authoring tool; a non-empty null-terminated body is an MD5-crypt password
  (SWF 5+, same algorithm as `EnableDebugger`). A password present in a SWF < 5 file is `SF0170`-style
  (warning, recorded). We are not an authoring tool: we MUST NOT verify the password, MUST NOT refuse to
  compile, and MUST surface the state in the report ("this file was marked non-importable"). `Protect`,
  `EnableDebugger(2)` and `EnableTelemetry` MUST NEVER alter parsing behaviour.
- **IMPL-040-R040** `EnableDebugger2`'s `Reserved` field MUST be zero; anything else is `SF0171`-style
  (info, recorded verbatim). Passwords are recorded as *present/absent* plus a digest, never in the
  manifest's plain text: they are credentials from the original content and MUST NOT be reproduced in
  reports or bundle sources (SEC-§4).
- **IMPL-040-R041** `EnableTelemetry` (93) is `Reserved UB[16]` (must be 0) followed by an **optional**
  `PasswordHash UI8[32]` (SHA-256 of the UTF-8 password). Its presence is the *only* thing that matters
  to us: the tag opts the movie into advanced telemetry profile data, so it is decoded, reported
  (`SF0152`, info, "telemetry opt-in present") and otherwise inert. The hash is credential-derived and
  MUST be treated like the other password material — recorded as present/absent plus a local digest,
  never reproduced in the manifest or reports — with `SF0177` (info) noting that a hash was present.
  A body whose length is neither 2 nor 34 bytes is `SF0171`-style (reserved/extra bytes recorded).

### 3.6 The model dump (`forge-decompile dump`)

`inspect` answers "what is in this file"; `dump` answers "what does the pipeline see". It serialises the
whole `MovieModel` (CMP-§3) together with the header, the dictionary and the diagnostics, and it is the
artefact the inspector's tag view renders (`INS-D03`: "source maps + model dump") and the shape
`verify` re-parses.

**IMPL-040-R044** The verb has three modes and writes **nothing else**: human summary (default, stdout),
`--json` (the dump object, stdout), `--out <dir>` (the same JSON written to `<dir>/model.json`). It never
extracts media (`assets` owns that), never writes outside `--out`, and never opens the input for writing.

**IMPL-040-R045** The JSON dump MUST be byte-deterministic (`REPO-R015`): the field order below is the
emission order, and no field may carry a timestamp, an absolute path, a host name or a random value. Two
runs over the same input bytes produce identical bytes on any machine. The human summary may name the
input file it was given; the JSON dump never does.

Top-level fields, in order: `format` (`"swf-forge/model-dump"`), `formatVersion` (`1`), `source`
(`bytes`, `sha256`, `compression`, `version`, `fileLength`, `frameRate`, `stage`), `model` (`id`,
`background`, `backgroundSource`, `metadata`), `dictionary`, `timeline` (the main timeline),
`initActions`, `control`, `diagnostics`.

**IMPL-040-R046** Everything derived from a map MUST be emitted as an array **sorted by key**: the
dictionary by character id, `control.exports` by name, `control.scalingGrids` by id, timeline `labels`
by name, `control.metadata` by key. Sequences that exist in file order keep file order: frames, `ops`,
`actions`, `videoFrames`, `control.labels` (duplicates kept), `control.backgroundChanges`,
`control.imports`, `control.tabIndexOps`, `initActions`, stream-sound spans. No field may depend on
`Map` insertion order or on object key order.

**IMPL-040-R047** The timeline object is doc 030 §7's frame-by-frame form: `declaredFrameCount`,
`observedFrameCount`, `frames[]` (`index`, `label`, `ops[]`, `actions[]`, `soundStreamBlock`,
`videoFrames[]`), `labels[]` (`name`, `frame`, `namedAnchor` — first occurrence per name, the map doc 030
builds) and `streamSoundSpans[]` (`head`, `blocks`). An op is `{ kind: "place", … }` with every
`PlacementOp` field, `{ kind: "remove", … }` or `{ kind: "tabIndex", … }`; each carries its `tagOffset`,
and `null` is emitted for every absent optional field of its kind. `SetTabIndex` therefore appears twice
by design: in `control.tabIndexOps` and in the owning frame's `ops` (`IMPL-040-R043`). A sprite
character's `dictionary[].sprite` carries the same timeline object plus the sprite's character name and
tag count.

**IMPL-040-R048** `--out` writes exactly one file, `<dir>/model.json`: UTF-8, LF line endings, a
2-space indent and one trailing newline — the same bytes `--json` prints. The directory is created when
missing, a write failure is an internal error (exit `5`) naming the path, and a partial file is never
left behind. Exit codes are `CMP-R029`'s: `SF0001` → `2`, `SF1000` → `3`, any error-severity diagnostic
→ `1`, otherwise `0`; the summary goes to stdout, errors to stderr.

## 4. Ch.4 pinned layouts (normative, mirrors APP-§10.2)

Field order is pinned in APP-§10.2; the table below records the version windows and the decoder-relevant
traps, so a decoder review can be done inside this document.

| Tag | Version window | Body | Traps called out here |
| --- | --- | --- | --- |
| `End` (0) | SWF 1+ | empty | last tag of file **and** sprite |
| `SetBackgroundColor` (9) | SWF 1+ | `RGB` | 3 bytes exactly; no alpha |
| `Protect` (24) | SWF 2+ | empty, or null-terminated password string | password only meaningful SWF 5+ |
| `FrameLabel` (43) | SWF 3+ | `STRING Name` + optional `UI8 = 1` | the anchor byte is detected by *one remaining byte*, not by the version alone |
| `ExportAssets` (56) | SWF 5+ | `UI16 Count` + (`UI16 Tag`, `STRING Name`)… | duplicate **Tag** ⇒ later `Name` wins (spec) |
| `ImportAssets` (57) | SWF 5–7 (max 7) | `STRING URL` + `UI16 Count` + (`UI16 Tag`, `STRING Name`)… | ignored when the file declares SWF 8+ |
| `EnableDebugger` (58) | SWF 5 only | null-terminated password | deprecated in SWF 6; ignored by FP 6+ |
| `EnableDebugger2` (64) | SWF 6+ | `UI16 Reserved = 0` + password | reserved must be 0 |
| `ScriptLimits` (65) | SWF 7+ | `UI16 MaxRecursionDepth`, `UI16 ScriptTimeoutSeconds` | defaults 256 / 15–20 s are *defaults*, not magic |
| `SetTabIndex` (66) | SWF 7+ | `UI16 Depth`, `UI16 TabIndex` | ignored if no character at that depth |
| `FileAttributes` (69) | SWF 8+ (optional earlier) | 32 flag bits, see §3.5 | bit-order traps of R032; first-tag rule; root-SWF-only (Ch.15) |
| `ImportAssets2` (71) | SWF 8+ | `STRING URL` + `UI8 = 1` + `UI8 = 0` + `UI16 Count` + pairs | reserved pair validated |
| `SymbolClass` (76) | SWF 8+/9 | `UI16 NumSymbols` + (`U16 Tag`, `STRING Name`)… | `Tag = 0` ⇒ main-timeline root class; class must be declared by `DoABC` |
| `Metadata` (77) | SWF 1+ (in practice 8+) | `STRING` RDF/XMP | biconditional with `HasMetadata`; at most once |
| `DefineScalingGrid` (78) | SWF 8+ | `UI16 CharacterId` + `RECT Splitter` | splitter ≥ 1 twip each side; sprite/button targets only |
| `DefineSceneAndFrameLabelData` (86) | SWF 9+ | `EncodedU32 SceneCount` + (`EncodedU32 Offset`, `STRING Name`)… + `EncodedU32 FrameLabelCount` + (`EncodedU32 FrameNum`, `STRING FrameLabel`)… | offsets and frame numbers are **zero-based and global to the symbol**; scenes are main-timeline only |

**IMPL-040-R042** No decoder in this document may infer a value from the tag's body length except for the
two cases Ch.4 *defines* that way: the `FrameLabel` anchor byte (R009) and the `Protect` empty body
(R039). Any other length mismatch is `SF0114`-style and MUST NOT change the decoded fields.

## 5. Model additions

```ts
export interface MovieControlModel {
  readonly background: number;                       // 0xRRGGBB
  readonly backgroundSource: 'default' | 'tag';
  readonly backgroundChanges: readonly { frame: number; rgb: number }[];
  readonly scenes: readonly { name: string; startFrame: number }[];
  readonly labels: ReadonlyMap<string, { frame: number; namedAnchor: boolean }[]>;
  readonly exports: ReadonlyMap<string, number>;
  readonly exportsById: ReadonlyMap<number, string>;  // Ch.4's Tag-keyed dedupe
  readonly rootClassName: string | null;              // SymbolClass Tag 0
  readonly imports: readonly { url: string; name: string; localId: number; applied: boolean }[];
  readonly scalingGrids: ReadonlyMap<number, Rect>;
  readonly tabIndexOps: readonly SetTabIndexOp[];     // mirrored into FrameModel.ops by doc 030
  readonly scriptLimits: { maxRecursionDepth: number | null; scriptTimeout: number | null };
  readonly attributes: FileAttributesModel;           // raw + decoded + origin offset
  readonly metadata: Record<string, string>;
}
```

**IMPL-040-R043** This structure MUST be part of `MovieModel` (CMP-§3) and MUST be emitted into the
manifest where the runtime needs it (background and background changes, scenes and anchors for
navigation, tab-index ops for focus order, scaling grids on sprite/character metadata, metadata for
provenance). `attributes.raw` and the `origin` offsets MUST survive into the report so `verify` can name
the exact tag a decision came from.

## 6. Diagnostics

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0150` | warning | unresolved `ImportAssets`/`ImportAssets2` entry |
| `SF0151` | info | debugger tag present (recorded, ignored) |
| `SF0152` | info | telemetry tag present (recorded, ignored) |
| `SF0153` | warning | duplicate frame label (first wins for lookups) |
| `SF0154` | warning | export/`SymbolClass` name empty or invalid (sanitised for the manifest) |
| `SF0155` | error | import alias cycle |
| `SF0156` | warning | invalid scaling grid (dropped: < 1 twip, bad rect order) |
| `SF0157` | info | `SymbolClass` in an AVM2-flagged movie would have been an error (unreachable in practice) |
| `SF0158` | info | scene data collapsed; navigation remapped |
| `SF0159` | warning | duplicate export **character id** (later name wins, per Ch.4; shadowed entry kept) |
| `SF0160` | warning | duplicate export **name** (first id wins, our policy — the chapter is silent) |
| `SF0161` | warning | `ImportAssets` (57) in a SWF 8+ file: deprecated and ignored by Flash Player 8+ |
| `SF0162` | warning | `ImportAssets2` reserved bytes are not `1`, `0` |
| `SF0163` | warning | `Metadata` tag and `FileAttributes.HasMetadata` disagree |
| `SF0164` | warning | more than one `Metadata` tag (first kept) |
| `SF0165` | warning | `FrameLabel` named-anchor byte present with a value other than `1` |
| `SF0166` | info | `SetTabIndex` at a depth with no character (ignored, per Ch.4) |
| `SF0167` | warning | `DefineScalingGrid` splitter below one twip per side (ignored, per Ch.4) |
| `SF0168` | warning | `DefineScalingGrid` target is not a sprite/button or is unknown (dropped) |
| `SF0169` | warning | scene data inconsistent (offsets out of order/beyond the frame count, or inside a sprite) |
| `SF0170` | warning | `ScriptLimits` value outside the supported window, or a `Protect` password below SWF 5 (clamped/recorded) |
| `SF0171` | info | reserved bits/bytes of a control tag are non-zero (recorded verbatim, tag + offset named) |
| `SF0172` | warning | `FileAttributes` is not the first tag in a SWF 8+ file |
| `SF0173` | warning | missing `End` tag at file end or sprite end |
| `SF0174` | info | export/`SymbolClass` entry names a character id that is not in the dictionary |
| `SF0175` | info | `FileAttributes` inside a sprite (ignored: root-SWF-only tag, Ch.15) |
| `SF0176` | info | legacy `NoCrossDomainCache` bit set (SWF 9 layout; recorded, no behaviour) |
| `SF0177` | info | `EnableTelemetry` carries a password hash (opt-in present; hash not reproduced) |
| `SF0178` | warning | `DefineBinaryData` reserved field non-zero, or payload exceeds the configured blob cap |
| `SF0179` | info | `SymbolClass` names a `DefineBinaryData` character in AVM1 content (inert) |

`SF0157` is unreachable while `SF1000` is fatal; it exists so the diagnostic registry stays stable if
AVM2 content ever moves from "refuse" to "report".

## 7. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| `T-MOD-013` | background default vs tag, and mid-timeline changes | F2 |
| `T-MOD-014` | frame label association, duplicates, named anchors (byte present/absent/≠1) | F2 |
| `T-MOD-015` | scene collapse: `nextScene` frame targets correct for a 3-scene fixture | F2 |
| `T-MOD-016` | export map: duplicate ids, duplicate names, empty names, unknown ids | F1 |
| `T-MOD-017` | import resolution against a 2-movie input set; unresolved → placeholder + `SF0150` | F2 |
| `T-MOD-018` | alias cycle detection | F1 |
| `T-MOD-019` | `ScriptLimits` overrides interpreter budget, hard ceiling still enforced | F2 |
| `T-MOD-020` | scaling grid attach/validate + rotation/skew and shrink-below-original reversion | F1 |
| `T-MOD-021` | AVM2 detection via either signal; `FileAttributes` flag masks round-trip a table of known-good bodies | F1 |
| `T-MOD-022` | `DefineBinaryData` shipped as bytes, never as a string in emitted code | F1 |
| `T-MOD-023` | metadata (XMP) stored verbatim, whitespace preserved, biconditional reported | F1 |
| `T-MOD-024` | `End` required at file end and inside a sprite; a missing terminator is a warning, not a decode stop | F1 |
| `T-MOD-025` | `SetTabIndex` becomes a `SetTabIndexOp`, lands in `FrameModel.ops` in file order, and no-ops at an empty depth | F1 |
| `T-MOD-026` | an `ImportAssets` tag in a SWF 8+ file has **no effect** (characters stay missing) while the same tag in a SWF 7 file resolves | F1 |
| `T-MOD-027` | `SymbolClass` Tag 0 → `rootClassName`; other tags → export names; no AVM2 instantiation attempted | F1 |
| `T-MOD-028` | `Metadata` at most once; `HasMetadata`/tag biconditional both directions | F1 |
| `T-MOD-029` | frame-label merge order (tag labels first) is byte-for-byte reproducible over 100 runs | F2 |
| `T-MOD-030` | `NamedAnchor` navigation data reaches the shell; the emitted bundle never reads `location` | F1 |
| `T-MOD-031` | `Protect` password recorded as present/absent only; never reproduced in report or bundle | F1 |
| `T-MOD-032` | reserved bits of `FileAttributes` and `EnableDebugger2` are recorded verbatim and never mask behaviour | F1 |
| `T-MOD-033` | version windows: `EnableDebugger` (58) only in SWF 5, `ImportAssets` (57) max SWF 7, `FileAttributes` (69) required in SWF 8+ | F1 |
| `T-MOD-034` | `FileAttributes` bit-naming divergences (`E-022`): legacy `0x04`, `UseDirectBlit`/`UseGPU` bits, root-only occurrence | F1 |
| `T-MOD-035` | `EnableTelemetry`: 2-byte and 34-byte bodies; hash redaction; reserved non-zero recorded | F1 |
| `T-MOD-036` | `DefineBinaryData` layout: character id, reserved `UI32`, zero-length and large payloads, `ArrayBuffer` access | F1 |
| `T-MOD-037` | model dump JSON: field order is the documented order, maps are sorted arrays, and 100 runs are byte-identical (`IMPL-040-R045`/`R046`) | F1 |
| `T-MOD-038` | `dump --out <dir>` writes exactly `<dir>/model.json`, creates the directory, and its bytes equal `--json`'s stdout (`IMPL-040-R048`) | F1 |
| `T-MOD-039` | dump of `fixtures/appendix-a.swf`: dictionary, one frame, the stroke character, `SetTabIndex` in both places, empty diagnostics (`IMPL-040-R047`) | F2 |
| `T-MOD-040` | exit codes for the verb: unreadable input → `2`, error diagnostics → `1`, AVM2 content → `3`, clean file → `0` | F1 |

## 8. Work packages

| WP | Title | Depends | Est | Deliverable |
| --- | --- | --- | --- | --- |
| WP-040-01 | Background + defaults + change list | WP-020-10 | 1 | `control/background.ts`, T-MOD-013 |
| WP-040-02 | Frame labels + named anchors + shell anchor data | WP-030-09 | 2 | `control/frame-label.ts`, T-MOD-014/027 |
| WP-040-03 | Scenes + frame/label data + merge order | WP-040-02 | 2 | `control/scenes.ts`, T-MOD-015/026 |
| WP-040-04 | Export map hardening (with doc 020 dictionary) | WP-020-07 | 1.5 | `control/exports.ts`, T-MOD-016 |
| WP-040-05 | Imports + multi-movie resolution + alias cycle + version window | WP-040-04 | 3 | `control/imports.ts`, T-MOD-017/015/023 |
| WP-040-06 | `FileAttributes` bit decode + dual AVM2 detection + first-tag/root-only consumption | WP-020-04 | 2.5 | `control/file-attributes.ts`, T-MOD-021/029/030/034 |
| WP-040-07 | `ScriptLimits` → budget mapping | WP-040-06 | 1 | `control/script-limits.ts`, T-MOD-019 |
| WP-040-08 | `SetTabIndexOp` + frame-op wiring + focus-order data | WP-030-07, WP-040-06 | 1.5 | `control/tab-index.ts`, T-MOD-025 |
| WP-040-09 | `DefineScalingGrid` attach/validate + renderer handoff | WP-040-06, WP-130-08 | 1.5 | `control/scaling-grid.ts`, T-MOD-020 |
| WP-040-10 | `DefineBinaryData` asset + manifest entry (exact layout, blob cap) | WP-040-06 | 2 | `control/binary-data.ts`, T-MOD-022/036 |
| WP-040-11 | Metadata/Protect/debugger/telemetry recording + redaction (hash handling) | WP-040-06 | 2.5 | `control/metadata.ts`, T-MOD-023/028/035 |
| WP-040-12 | `SymbolClass` + root class + export-name source | WP-040-04 | 1 | `control/exports.ts`, T-MOD-027 |
| WP-040-13 | `End` validation at file and sprite level | WP-020-03 | 0.5 | `control/end-tag.ts`, T-MOD-024 |
| WP-040-14 | Model integration + `MovieControlModel` in the dump + report rows | WP-040-01…13 | 2 | model wiring, goldens |
| | **Total** | | **24** | |

## 9. Open items

| # | Item | Impact |
| --- | --- | --- |
| 1 | `EnableTelemetry` (93) body | **settled** (Ch.15: 2 bytes + optional 32-byte hash; `SF0152`/`SF0177`) |
| 2 | `DefineBinaryData` (87) exact layout ("is resizable"/type byte) | **settled** — Ch.15 gives id / `Reserved UI32` / data-to-end; no type byte exists (`T-MOD-036`) |
| 3 | Ch.15's restatement of `Metadata`/`FileAttributes` (if it adds rules) | **settled** — it adds the root-only rule and the legacy bit names; differences filed as `E-022` |
| 4 | Whether Flash's initial background without `SetBackgroundColor` is white in every player generation | low (`T-MOD-013` oracle pin) |
| 5 | Whether a second `Metadata` tag is "first wins" or "last wins" in Flash (chapter only says "one time") | low |

The Ch.4 items in v1.0's open list (`FrameLabel` anchor field, `ExportAssets`/`ImportAssets2` layouts,
`DefineSceneAndFrameLabelData` encoding, `FileAttributes` bit assignments, `DefineScalingGrid` field
order, `EnableTelemetry`, `DefineBinaryData`, `Protect` handling) are **settled** — see §3, §4 and
APP-§10.2.

## 10. Done criteria

1. Every tag in §1 has a decoder, an `apply`, and a fixture; ignored tags produce their documented
   info diagnostics; the Ch.15 rows stay marked pending until the chapter arrives.
2. `FileAttributes` decodes per R031/R032 with the three bit-order traps covered by tests, and AVM2
   detection trips on either signal, with the offset named, exiting with code 3 (CMP-R029).
3. Multi-movie imports resolve without copying payloads; the SWF 8+ deprecation is honoured; a cycle is
   detected.
4. `SetTabIndexOp` is exported by this document, imported type-only by doc 030, and appears in
   `FrameModel.ops` in file order with the empty-depth no-op reported.
5. The manifest carries background + changes, scenes, anchors, metadata (verbatim), tab-index ops,
   scaling grids, and binary assets; `verify` checks every reference resolves.
6. No password, and no reserved-bit value, is lost from the report or leaks into emitted sources.

## 11. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Scoped from Ch.4/Ch.15 structure; layouts marked pending |
| 1.1 | 2026-10-04 | Ch.4-grounded: version windows, duplicate-key rules, named-anchor byte, `End` at sprite level, `ImportAssets` SWF 8+ no-effect rule, `FileAttributes` mask table + bit-order traps, `SymbolClass` root class, `Metadata` biconditional, `DefineScalingGrid` twip rule, scene offset semantics; `SetTabIndexOp` export contract with doc 030 (R003/R024–R027); new diagnostics `SF0160`–`SF0174`; tests `T-MOD-013`–`T-MOD-033` (v1.1 added `T-MOD-024`–`T-MOD-033`); WPs 01–14 = 21.5 d; open items cut to the Ch.15 residue |
| 1.2 | 2026-10-04 | Ch.15-grounded: `DefineBinaryData` exact layout (`Tag UI16`, `Reserved UI32`, data to end) and `EnableTelemetry` (2 bytes + optional SHA-256 `PasswordHash`, redacted), the root-SWF-only `FileAttributes` rule, and the Ch.15 bit-name divergences (`E-022`: bits 6/5 `Reserved` vs `UseDirectBlit`/`UseGPU`; bit 2 `NoCrossDomainCache` vs reserved) with the legacy bit now named (`SF0176`); diagnostics `SF0175`–`SF0179`; tests `T-MOD-034`–`036`; §3 rules `R041`–`R043` added (telemetry, then the ordering/framing rules shifted from `R041`/`R042`); WPs re-estimated to 24 d |
| 1.3 | 2026-10-04 | §3.6 added: the `forge-decompile dump` contract (`R044`–`R048`) — three modes, the byte-deterministic JSON dump, sorted-map/fixed-order rules, the timeline form doc 030 §7 defines, and the `--out` file/exit-code rules; tests `T-MOD-037`–`T-MOD-040`; covered by the existing `WP-040-14` |
