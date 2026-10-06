# P2 Resolution Audit

**Date:** 2026-10-05 · **Auditor:** agent · **Branch:** `arena/01a10cd9-swf-forge`
**Inputs:** `audits/P2-INTEGRITY-AUDIT.md` (15 findings: 2 H, 4 M, 6 L, 3 I); spec authority per finding
(`IMPL-030` v1.4, `IMPL-040` v1.3, `IMPL-100` v1.1, `IMPL-000` §6, `IMPL-140`, roadmap §6 P2).
**Purpose:** prescribe a concrete, spec-referenced resolution for every finding, decide the open design
questions, and fix the execution order in batches so that **every finding appears in exactly one batch**
(the P1 lesson: a ledger item without a batch never runs).

---

## 1. Resolution designs

### R-P2-01 ← P2-01 (H): doc 100 buttons — full implementation

Implement doc 100 end-to-end per its §3 (data model), §4–§6 (WPs 01–10), §7 (diagnostics), §8 (tests):

- **New modules** `packages/swf/src/tags/buttons/` (or a single `tags/buttons.ts` if the record readers
  are compact — decision: single file `tags/buttons.ts`, matching the consolidation pattern the prior
  audit §4.3 accepted for docs 020/030):
  1. `decodeButtonRecord` — BUTTONRECORD v1/v2 per doc 100 §4.1: state bits (up/over/down/Hit, low
     bits), shape id, `Matrix`, v2-only tail (`CxformWithAlpha`, `FilterList`, `BlendMode`) with parity
     to PlaceObject3 (reuse `readFilterList`; `SF0120`-style unknown blend → `SF0114`? **no** — doc 100
     §7 owns `SF0131`–`SF0138`; unknown blend in a button record → record raw + no new code, doc 100
     §4.1 says the blend byte is a `UI8` like APP-§6 — follow APP-§6's `normal` default with an
     `SF0114`-style info via the shared placement path only if doc 100 assigns it; if unassigned, keep
     the raw value verbatim and note it in the dump).
  2. `decodeDefineButton` (7) — record array + v1-only trailing `ACTIONRECORD` list (per doc 100 v1.1
     changelog: trailing action records + `ActionEndFlag`, NOT "action condition records");
     `ActionEndFlag = 1` terminates; `SF0138` (v1 actions present, info — recorded, handed to AVM1).
  3. `decodeDefineButton2` (34) — header (`TrackAsMenu` bit), records, `BUTTONCONDACTION` chain:
     `CondActionSize` + `COND` + `COND`-chained `ACTIONRECORD`s; `SF0130` malformed chain (broken
     size chain past the body end), `SF0137` condition empty (all-zero condition with a non-empty
     action), `SF0133` button2 in an AVM2 movie (unreachable — SF1000 first; keep the code for the
     model-level check), `SF0135` undocumented key code (outside keys 1–19 / ASCII 32–126).
  4. Condition/key table per doc 100 §4.3: nine transitions (mouse-over/out, press, release,
     release-outside, key-down, key-up, key-press), `CondTrackState` (push vs menu), `CondKeyPress`
     7-bit field + **the ninth condition bit after it** (v1.1 layout), composite-shift semantics
     (shift/ctrl/alt), no-focus firing for keyPress.
  5. `decodeDefineButtonSound` (17) — `SoundID` + four-transition order (0 = roll-out … 3 = release);
     unknown/undefined sound id → `SF0132`.
  6. `decodeDefineButtonCxform` (23) — `RGB` (no alpha, v1-only per Ch.12); applied to the button's
     state records; `SF0134` (record with no state bits set → nothing to colour, info).
- **Model** (`model/buttons.ts` or folded into `movie.ts`): `ButtonModel` per doc 100 §3 — state
  records in authored order, condition table, sounds, hit-area = the `Hit` state's shape bounds
  (`SF0131` singular/degenerate hit matrix → hit area = full button bounds fallback, per doc 100 §3.4),
  `nested buttons` recorded (a button placed inside a button's state — `SF0136` when the aux target
  of a menu-tracking state is not a button), `trackAsMenu` flag.
- **Dictionary**: button characters get `CharacterModel.kind: 'button'` (already the case) plus
  `button: ButtonModel | null` — add the field to `CharacterModel` (`model/types.ts`).
- **Placement interplay**: button placements go through the normal `PlacementOp` path; a button state
  referencing an unknown shape → `SF0110` (shared, per doc 030 §6 row: "or, via doc 100, a button
  state").
- **Dump**: `model-dump.ts` gains the button shape (records, conditions, sounds, hit-area) in the
  character entries; field order per the existing dump convention; T-MOD-801–817 all attached to new
  tests in `packages/swf/test/buttons.test.ts`.
- **Tests (17)**: per doc 100 §8 — T-MOD-801…817 verbatim (v1/v2 records, per-bit condition table
  fixtures, per tracking mode, malformed chain, empty condition, unknown key, v1 actions, sound
  transitions, cxform, nested buttons + `trackAsMenu` + keyPress-without-focus hit-area interaction
  cases at known coordinates).
- **Exit criterion 3** ("Buttons decoded into records + conditions — unit tests") is met by this item
  alone; the §11 done criteria 1–4 are the acceptance test.

### R-P2-02 ← P2-02 (H): `tools/tag-coverage`

- New `tools/tag_coverage.py` (Python, stdlib-only, matching the `tools/` convention):
  - Input: every AVM1-era tag code with a name from the canonical table (the same table
    `tag-codes.ts` registers, `Tag` + `tagName`); the accepted-in-sprite set (doc 030 §6 /
    `SPRITE_TAG_UNLISTED` logic); the decoder disposition per code.
  - Source of truth for disposition: parse `packages/swf/src/tags/tag-codes.ts` (registered codes +
    names) and cross-reference the decoder modules (`place.ts`, `control.ts`, `filters.ts`,
    `shape.ts`, `buttons.ts` once R-P2-01 lands, `tag-stream.ts` for structural tags) for the tag
    constant's use in a decode switch — a tag is **decoded** if a switch case calls its decoder,
    **structural** if only `tag-stream.ts` frames it, **pending-phase** if registered to a later
    doc's range (060–110) with a doc pointer, **ignored-by-design** if the doc marks it inert
    (e.g. `Protect` semantics).
  - Output: a markdown report — every tag: code, name, version window, disposition
    (decoded / structural / pending `<doc>` / ignored), owning doc + rule, and a FAIL line for any
    tag with no disposition. Exit non-zero on any undischarged tag (CI-able).
  - Wire into CI: add a `tag-coverage` step to the `audit` job in `.github/workflows/ci.yml`
    (run the tool, assert exit 0). No baseline file needed — the spec (doc pointers) is the baseline.
- Acceptance: `python3 tools/tag_coverage.py` exits 0 with a complete disposition table covering
  every AVM1-era tag code registered in `tag-codes.ts`.

### R-P2-03 ← P2-03 (M): clip events/actions (WP-030-06)

- **Decoders** in `tags/place.ts` (or `tags/clip-actions.ts` if > ~120 lines — decision: separate
  file `tags/clip-actions.ts`):
  1. `CLIPEVENTFLAGS` — 2 bytes (SWF 5) or 4 bytes (SWF 6+); decode the 26 handler bits into a
     `ClipEventFlags` struct (per doc 030 §5); all-zero with clip actions present → `SF0115`
     (warning); reserved bits set → `SF0119` (info, recorded verbatim).
  2. `CLIPACTIONS` framing — `EncodedU16 ClipEventCount` + per-event
     (`EncodedU16 ActionRecordSize`, `EncodedU16 ActionRecordCount`, `ACTIONRECORD`s) +
     `ActionEndFlag`; `ActionRecordSize` mismatch vs. the actual record bytes → `SF0118` (warning,
     framing desynchronises — stop the event, keep the rest of the tag decodable per the doc's
     recovery rule).
- **Model**: replace `clipActions: ActionBlockRef | null` on `PlacementOp` with
  `clipActions: ClipActions | null` where `ClipActions = { flags: ClipEventFlags; events: readonly { flags: number; actions: ActionBlockRef }[]; raw: ActionBlockRef }`
  — keep the raw range (the AVM1 stage still consumes raw bytes, doc 050) *and* the decoded
  framing, matching doc 030 §3's `ClipActions` contract (resolves the P2-13 `clipActions` half).
  `SF0125`: clip actions on a non-sprite character — the model layer knows the placed character's
  kind (`movie.ts` has the definitions); emit `SF0125` (warning) + keep.
- **PO1/PO2/PO3**: all three placement forms carry clip actions (v1: raw `CLIPACTIONS` without
  event flags per Ch.3 — the `ClipEventFlags` are absent in v1; represent as `flags: null`);
  SWF 5 vs 6+ event-flags width by file version.
- **Tests**: T-MOD-007 (2/4-byte layouts, all 26 bits), T-MOD-008 (framing round-trip incl. a
  deliberately wrong `ActionRecordSize` → `SF0118`), plus `SF0115`/`SF0119`/`SF0125` fixtures —
  done-criterion 030#3 met.

### R-P2-04 ← P2-04 (M): multi-movie imports

- **Surface decision**: `buildMovieModel(file, opts)` gains `opts.imports?: ReadonlyMap<string, SwfFile>`
  — URL → another opened movie (the "multi-movie input set" of IMPL-040 §3.3, `forge.config.input.others`
  materialised as an explicit argument; the CLI `dump` gains a repeatable
  `--import <url>=<file.swf>` that opens the referenced files with the same open path). No new
  config file — keeps the model layer pure and testable (T-MOD-017/018 can build two `SwfFile`s
  in-process).
- **Resolution** (model layer, `movie.ts`): for each `ImportAssets(2)` entry of a **SWF ≤ 7** movie:
  - look up `url` in the input set (exact string match — Ch.4 imports are file URLs; no
    normalisation beyond case-folding the scheme per SEC-§4 default-deny);
  - resolved: the imported character is referenced **by alias, not copy** —
    `ImportEntry = { url, name, localId, applied: true, sourceMovieId, sourceId }` (add the two
    fields; the payload stays in the source movie's bytes — R021 "without copying the payload");
  - not found in the set → `SF0150` (warning: unresolved, url + name listed) + `applied: false`
    + a `missing` placeholder for `localId` (doc 020 placeholder policy, shared `SF0110`);
  - alias chain: resolve transitively; if the resolution revisits a movie in the current chain →
    `SF0155` (error) — the model still builds (the cycle is reported; downstream stages see
    `applied: false` for the cycled entries).
  - SWF ≥ 8: `SF0161` already marks the tag no-effect; no resolution is attempted (R017).
- **Tests**: T-MOD-017 (2-movie input set, resolved + unresolved cases), T-MOD-018 (A→B→A cycle →
  `SF0155`; transitive A→B→C resolves exactly once, no copy — assert source movie bytes untouched /
  alias shape in the model), plus the SWF 8+ no-effect fixture (relabel the existing
  `SF0161` content as T-MOD-026).
- **Dump**: `control.imports` entries gain `sourceMovieId`/`sourceId`/`applied` in the JSON
  (field order appended, `--json` byte-determinism preserved; T-MOD-037 golden updates).

### R-P2-05 ← P2-05 (M): PO3 placement checks

- In `decodePlaceObject3` (`tags/place.ts`), mirror the PO2 checks at the same points:
  - after reading `Depth`: `if (depth >= 16384) emit(SF0112, 'info', …)` (R012);
  - after reading `ClipDepth` (when `HasClipDepth`): `if (clipDepth > 0 && clipDepth <= depth)
    emit(SF0113, 'warning', …)` (R013, "mask is empty").
- Two writer fixtures (PO3 depth 16384; PO3 clipDepth ≤ depth) asserting both codes; attach as
  T-MOD-002-adjacent PO3 cases in `place-filters.test.ts` (label T-MOD-002b or fold into a new
  T-MOD-004 test — decision: the clip-depth boundary fixture is exactly T-MOD-004, the
  depth-convention case joins it; T-MOD-004 becomes the clip/depth-boundary test for all forms).

### R-P2-06 ← P2-06 (M): test-process red exit

- Root cause (verified by stack traces): in `openSwfAsync` (`container/open.ts:295–335`) the writer
  side is fire-and-forget — `void writer.write(input.subarray(8))` and `void writer.close()`. When
  the reader cancels after the cap trip (or after a corrupt-stream error), the pipeline tears down
  and the pending `write`/`close` promises reject with `AbortError` — nothing handles them → 3
  unhandled rejections across the cap tests (`container.test.ts:355`, `:564` and one more in the
  fuzz/async path).
- **Fix**: make the writer side teardown-tolerant:
  ```ts
  const writeDone = writer.write(input.subarray(8)).catch(() => { /* teardown after cancel is expected */ });
  void writer.close().catch(() => { /* ditto */ });
  await writeDone; // keep back-pressure semantics for the non-cancelling path
  ```
  plus guard the `reader.cancel()` callsites the same way (`await reader.cancel().catch(() => {})`)
  — cancelling an already-destroyed stream must not throw out of the R007 pump.
- Acceptance: `corepack pnpm test` exits **0** with `Unhandled Rejection` count 0; all 238 (or more,
  post-fix) tests still pass; the F-04 cap behaviour (SF0007, `body.length === 0`) unchanged.
- Also corrects the gate record in `audits/P1-REPEAT-AUDIT.md` §3 (annotation, not a rewrite).

### R-P2-07 ← P2-07 (L): `SF0174` unknown export id

- In `buildExportMaps` (`tags/control.ts`) — which already iterates pairs with the cursor — the
  unknown-id check needs the dictionary, which the pure decoder does not see; therefore move the
  check to the **model layer** (`movie.ts` export merge): for each export pair whose `id` is not in
  `file.definitions`, `emit(SF0174, 'info', …)` and register a `missing` placeholder character
  (kind `'missing'`, per doc 020's policy — the same placeholder `SF0110` placements create).
- `SymbolClass` pairs go through the same path (they share `buildExportMaps`-shaped data).
- Fixture: `ExportAssets` naming an undefined id → `SF0174` + placeholder in the dictionary
  (relabel/extend the existing export test; attach T-MOD-016).

### R-P2-08 ← P2-08 (L): in-sprite scene data

- In `assembleTimeline`'s tag loop, add an explicit case for `Tag.DefineSceneAndFrameLabelData`
  (currently falls to `default` and is dropped):
  - `ref.inSprite !== null` (sprite timeline): `emit(SF0169, 'warning',
    'DefineSceneAndFrameLabelData inside sprite <id>; recorded as a single implicit scene')` and set
    a flag on the sprite's timeline; the sprite gets the implicit scene — **model shape decision**:
    add `sceneData: { implicit: true } | { implicit: false; scenes; labels } | null` to
    `SpriteModel` (main timeline keeps the normalized `control.scenes`; the implicit scene "covers
    that sprite's timeline" per R013 — i.e. one scene, offset 0, name `""` unless the sprite data
    named one — use the first scene name if present, else `""`).
  - `ref.inSprite === null`: existing behaviour (already handled by `collectControl` at model
    level; the timeline case must NOT double-emit — decision: sprite-level case in
    `assembleTimeline`, main-level stays in `collectControl`).
- Fixture: a sprite containing `DefineSceneAndFrameLabelData` → `SF0169` + `sceneData.implicit`
  (relabel as T-MOD-015b or fold into the scenes test — decision: extend the existing
  `collects scenes…` test with the sprite case, relabel the pair T-MOD-015).

### R-P2-09 ← P2-09 (L): trailing `FrameLabel`

- Decision (documented in the resolution note): per R008 a label names the frame the **next**
  `ShowFrame` shows. A trailing label after the final `ShowFrame` therefore names a frame that is
  never shown — to keep the `labels` map resolvable (no dangling index) without contradicting R008,
  **push the new empty frame** carrying the label:
  - `timeline.ts` end-of-loop: the push condition becomes
    `ops.length > 0 || actions.length > 0 || videoFrames.length > 0 || soundStreamBlock !== null || label !== null`;
  - **delete the else-if retroactive-rename branch** (and its comment) — the label stays on frame
    N, which now exists; `observedFrameCount` reflects it.
- No diagnostic is specified for this shape (the file is well-formed; it just ends after a label) —
  none added.
- Fixtures: (a) `[Label, ShowFrame, Label]` → 2 frames, second labelled, `labels` resolves;
  (b) regression guard: `[ShowFrame, Label, ShowFrame]` still labels frame 1 (not frame 0).
  Attach to the T-MOD-014 relabel (label association/duplicates/anchor test).

### R-P2-10 ← P2-10 (L): shadowed scaling-grid rect

- R028 says "the last one wins **and the shadowed rect is reported**". No diagnostic code is
  assigned to the shadow case (the `SF0156` row is the doc-error duplicate — see R-P2-15), so
  "reported" is satisfied the same way R015 satisfies it for exports: **retain the shadowed entry**
  in the model. `MovieControlModel` gains
  `scalingGridsShadowed: readonly { characterId: number; left: number; top: number; right: number; bottom: number }[]`
  (append order; last-wins in `scalingGrids` unchanged).
- Dump: `control.scalingGridsShadowed` in the JSON (field order appended; T-MOD-037 golden update).
- Fixture: two grids for one character → model has the last + the shadowed list (fold into the
  T-MOD-020 relabel — the scaling-grid test).

### R-P2-11 ← P2-11 (L): named-anchor byte semantics

- `decodeFrameLabel` (`tags/control.ts`): replace the `byte === 1` logic with the R009 rule —
  **presence** is defined by one byte remaining after the null terminator; that byte is the anchor
  flag and is always `1`; any other value is `SF0165` (warning) **and the frame is still anchored**:
  ```ts
  if (c.limit - c.offset >= 1) {
    const byte = c.u8();
    namedAnchor = true;                    // the byte is present → anchored
    if (byte !== 1) emit(SF0165, 'warning', `FrameLabel anchor byte is ${byte}, not 1`);
  }
  ```
- Fixtures: anchor byte `1` (anchored, no diagnostic), anchor byte `0` (anchored + `SF0165`),
  anchor byte `7` (anchored + `SF0165`), no byte (not anchored). Attach to T-MOD-014.

### R-P2-12 ← P2-12 (L): `binary` asset registration + `SF0179`

- **Asset registration (R038)**: `CharacterModel` gains `bytes: Uint8Array | null` (non-null only
  for `kind: 'binaryData'` — the payload, up to the 16 MiB cap already enforced at decode).
  `movie.ts` stores the decoded bytes on the definition's character model; the dump carries
  `length` + `digest` (NOT the bytes — dump stays JSON; T-MOD-037 golden unchanged in that field,
  plus a `bytesPresent: true` flag so the contract is visible).
- **`SF0179`**: in the `SymbolClass` handling (`movie.ts`), when a non-root pair's `id` is a
  `binaryData` character and the movie is **not** AVM2 (AS3 flag absent — in an AVM2 movie the
  class is DoABC's concern and SF1000 already fired) → `emit(SF0179, 'info', …)` — "inert; the
  name is recorded anyway".
- Fixtures: `DefineBinaryData` → character model carries the exact bytes (T-MOD-036 extension:
  assert `character.bytes` equality, not just digest); `SymbolClass` naming a binary character in
  an AVM1 movie → `SF0179`.

### R-P2-13 ← P2-13 (I): surface API deviations — document, don't churn

- Precedent (P1 audit §4.4 / its resolution): the `SwfFile.dictionary` → `definitions` deviation
  was documented, not reworked. Same disposition here:
  - `tagOffset: number` vs `origin: TagRef`: keep the implementation; amend IMPL-030 §3 (v1.5
    changelog entry) to state `PlacementOp`/`RemovalOp`/`SetTabIndexOp` carry `tagOffset: number`
    (byte offset of the tag body — the dump and source maps consume offsets, not TagRefs, and
    TagRef would couple the op type to the container).
  - `clipActions`: resolved structurally by R-P2-03 (the doc's `ClipActions` shape is adopted).
  - `blendMode: number | null` vs `BlendMode` union: keep the raw number (APP-§6 values are
    recorded verbatim; the named mapping is the renderer's, GFX-§) — same §3 amendment.
- Cost ≈ 0.2 d (doc edit + changelog row).

### R-P2-14 ← P2-14 (I): test labels + missing corpora + `--strict-timeline`

- **Relabel** (mechanical, no behaviour change): attach T-MOD ids to the existing tests —
  doc 030: T-MOD-010 (E-008, dedicated fixture), T-MOD-011 (sprite edge: padding + SF0173 pair),
  T-MOD-603 (sound-span fixture — write it: a sprite with head + blocks, assert `streamSoundSpans`);
  doc 040: T-MOD-013 (background), 014 (labels + R-P2-09/R-P2-11 fixtures), 015 (scenes + sprite
  case), 016 (exports + SF0174), 020 (scaling grid + shadow), 023/028 (metadata pair), 024 (End
  pair), 026 (ImportAssets 8+), 027 (root class), 034 (FileAttributes placement/legacy).
- **Write the genuinely missing ones**:
  - T-MOD-001: PlaceObject v1 writer fixture — matrix + tail CXFORM (≥ 3 bytes) + the 3-byte
    boundary (no CXFORM) + `SF0117` id-0 move;
  - T-MOD-002: **32-combination PO2 flag corpus** — a loop over all 8-flag combinations (each
    field present/absent) decoding a generated body without desynchronisation (assert cursor at
    end, no unexpected diagnostic); T-MOD-002b: **16-bit PO3 corpus** — same over the PO3 flag
    bytes (16 bits → generate the 2^16 bodies with fields present per flag; assert no
    desync) — done-criterion 030#2 met;
  - T-MOD-004: clip-depth boundary (0/1/depth/depth+1/16384) + the R-P2-05 PO3 cases;
  - T-MOD-012: model round-trip — `buildMovieModel` → dump JSON → re-parse → re-dump byte-identical
    (the dump is the serialisation; this pins "reconstitutes identical frames" of done-criterion
    030#4 in a test).
- **`--strict-timeline`**: add the mode (cheap — `AssembleTimelineOptions.mode` already exists):
  in strict mode, `RemoveObject(2)` at a depth with no current character → `SF0127` (info);
  `buildMovieModel` gains `strictTimeline?: boolean`; CLI `inspect`/`dump` gain `--strict-timeline`.
  Fixture: removal at empty depth, soft (silent) vs strict (`SF0127`).
- Done-criterion 030#4's `inspect --timeline`/`verify` naming is handled by R-P2-15c (roadmap
  amendment), not a new verb.

### R-P2-15 ← P2-15 (I): doc/registry fixes

- **(a)** IMPL-040 §6: **remove the `SF0156` row** (v1.4 changelog entry: "SF0156 row removed —
  duplicated the `SF0167` case assigned by R028; inverted-rect inputs are caught by the < 1 twip
  width check"). STATUS.md regens from the docs (`gen_status.py`) — rerun.
- **(b)** Roadmap §2.2 P2 row: append "buttons (doc 100) remain open" until R-P2-01 lands, then
  flip to the implemented evidence (the row's test column gains `buttons.test.ts`).
- **(c)** Roadmap §6 P2 row 1 & demo lines: rename `inspect --timeline` / `verify` to the `dump`
  verb (or note "satisfied by `forge-decompile dump`").

---

## 2. Design decisions recorded (so the resolutions are unambiguous)

1. **Buttons** live in `tags/buttons.ts` + model fields, not a package (consolidation precedent).
2. **Import input set** = `buildMovieModel` option + `dump --import url=file` CLI flag; no config
   file (purity + testability; IMPL-040 §3.3's `forge.config.input.others` materialised as an
   explicit map).
3. **Trailing label** → push the empty labelled frame (R008-faithful; no dangling map entries).
4. **Shadowed scaling-grid rects** → retained in the model (report), no new diagnostic code.
5. **`SF0156`** → removed from doc 040 (doc error), not registered in code.
6. **Surface API** → documented deviation (doc amendment), except `clipActions` which is fixed
   structurally by R-P2-03.
7. **Binary bytes** → on `CharacterModel.bytes`; the dump carries size + digest + presence flag
   only (JSON dump stays serialisable).

## 3. Execution batches (every finding in exactly one batch)

| Batch | Findings | Est. | Gate after batch |
| --- | --- | --- | --- |
| **A** — small rule completions + test gate | P2-05, P2-06, P2-07, P2-08, P2-09, P2-10, P2-11, P2-12, P2-14 (strict-timeline half) | ≈ 3 d | typecheck/lint/test exit 0 + audit_dev |
| **B** — tooling + docs + remaining labels | P2-02, P2-13, P2-15, P2-14 (relabelling + T-MOD-001/002/004/012/603 corpora) | ≈ 3.5 d | + `tag-coverage` in CI |
| **C** — clip actions | P2-03 | ≈ 3 d | + T-MOD-007/008, SF0115/0118/0119/0125 alive |
| **D** — multi-movie imports | P2-04 | ≈ 2.5 d | + T-MOD-017/018, SF0150/0155 alive |
| **E** — buttons (doc 100) | P2-01 | ≈ 26 d | + T-MOD-801–817, SF0130–0138 alive; exit criterion 3 |

Ordering rationale: A clears the red gate first (P2-06) so every later batch is measured against a
green baseline; B lands the exit-criterion-4 tool before C/D/E add decoders the tool must
disposition; C and D are independent and can run in either order (C first — it changes the
`PlacementOp.clipActions` type that D's dump golden touches); E is last because it is the largest
and its dump/registry additions benefit from the final golden state.

**Cross-check (P1 lesson):** P2-01 ✓E · P2-02 ✓B · P2-03 ✓C · P2-04 ✓D · P2-05 ✓A · P2-06 ✓A ·
P2-07 ✓A · P2-08 ✓A · P2-09 ✓A · P2-10 ✓A · P2-11 ✓A · P2-12 ✓A · P2-13 ✓B · P2-14 ✓A+ ✓B ·
P2-15 ✓B — all 15 findings have a batch.

## 4. Execution record — Batch A

### Batch A — small rule completions + test gate — **DONE 2026-10-05**

| Resolution | Execution note |
| --- | --- |
| R-P2-05 | `decodePlaceObject2`'s two checks mirrored into `decodePlaceObject3` (same positions: after `Depth`, after `ClipDepth`) **and** the depth check added to `decodePlaceObject` v1 (the §4 "Depth conventions" row is form-agnostic). Fixtures: 4 T-MOD-004 tests in `place-filters.test.ts` (PO3 SF0112, PO3 SF0113, PO3 legal-depth control, PO1 SF0112). |
| R-P2-06 | Root cause confirmed by stack trace: the fire-and-forget `void writer.write(…)`/`void writer.close()` promises reject with `AbortError` when the reader cancels (cap trip / corrupt stream) and tore the pipeline down. Fix: swallow the teardown rejections on the writer side + `reader.cancel().catch(…)` in the cap path (`container/open.ts`). `corepack pnpm test` now exits **0** with 0 unhandled rejections (was: exit 1, 3 rejections). |
| R-P2-07 | `SF0174` emitted per pair at collection time (`ExportAssets`/`SymbolClass` cases in `collectControl`); unknown ids registered as `missing` placeholders in `buildMovieModel` (same policy as placements). Test: T-MOD-016 in `model.test.ts`. |
| R-P2-08 | `assembleTimeline` gained a `DefineSceneAndFrameLabelData` case: in-sprite form decodes the body, records `implicitScene: {name}` on the timeline (first scene name, else `""`), emits `SF0169`; main-timeline form stays with `collectControl` (no double emission). `TimelineModel.implicitScene` field; dump carries it. Tests: 2 T-MOD-015 tests in `control.test.ts`. Note: the rule fires during model assembly, so assertions run after `buildMovieModel`. |
| R-P2-09 | Trailing `FrameLabel` now pushes the empty labelled frame (push condition gained `‖ label !== null`); the retroactive-rename else-if and its comment deleted. Tests: trailing case + mid-timeline regression guard in `model.test.ts`. |
| R-P2-10 | `scalingGridsShadowed` on `MovieControlModel` (append order; last-wins in `scalingGrids` unchanged); dump carries it (field order appended after `scalingGrids`; T-MOD-037 key-order assertion updated). Test in `model.test.ts`. Fixture note: RECT coordinates are packed **contiguously from bit 5** (IMPL-010-R028 — no padding after Nbits); the first fixture attempt used byte-aligned coordinates and mis-decoded. |
| R-P2-11 | `decodeFrameLabel` now: any remaining byte → `namedAnchor = true`; `byte !== 1` → `SF0165` (the `byte === 0` special case deleted). Tests: 4 T-MOD-014 decoder-level cases in `control.test.ts`. |
| R-P2-12 | `CharacterModel.bytes: Uint8Array ‖ null` populated from the decoded payload (last definition wins, matching the dictionary's duplicate policy); dump `control.binaryData` entries gain `bytesPresent` (payload never serialised to JSON). `SF0179` emitted once per binary character named by a `SymbolClass` pair in non-AVM2 content (the AVM2 decision uses the AS3 flag **or** a seen `DoABC`). Tests: T-MOD-036 bytes-equality extension + SF0179 case in `model.test.ts`. |
| R-P2-14 (strict-timeline half) | `BuildMovieOptions.strictTimeline` + `AssembleTimelineOptions.strictTimeline` (separate from the cursor `mode`); `SF0127` (info) on removals at empty depths in strict mode; CLI `--strict-timeline` on `inspect` + `dump` (USAGE line added). Test: soft-vs-strict pair in `model.test.ts`. |

**Gate after Batch A:** typecheck ✅ · lint ✅ · test **255/255, process exit 0, 0 unhandled rejections** (17 new tests) · `audit_dev` findings=80 known=80 new=0 fixed=0 (baseline re-recorded: dump key lists gained `implicitScene`/`scalingGridsShadowed`; SF0127's deferred mapping removed — it now has a production report path).
Execution deviations from §1: (1) the v1 `PlaceObject` depth check was added beyond the resolution's PO3 wording (the rule is form-agnostic); (2) the doc 030 rule numbers R012/R013 are cited by the §4 table but not defined as numbered rule bullets (the doc jumps R010→R019) — code comments therefore cite the §4 rows / §6 diagnostic rows instead, keeping `audit_dev`'s rule-citation check clean.

## 5. Execution record — remaining batches

**Date:** 2026-10-05 · **Branch:** `arena/01a10cd9-swf-forge`

### Batch B — tooling, docs, and resolution-audit test debt — **DONE**

| Resolution | Execution evidence |
| --- | --- |
| R-P2-02 | Added `tools/tag_coverage.py` (stdlib-only) and wired `pnpm tag:coverage` into CI. Re-run: 65 registered AVM1-era tags dispositioned (32 decoded, 25 pending, 5 retained, 3 structural); all evidence references validate. `python3 -m unittest discover -s tools -p 'test_tag_coverage.py'`: 10 tests pass. |
| R-P2-13 | `IMPL-030` §3 now documents the realized `tagOffset`, raw-number `blendMode`, complete `ClipActions`/`ClipEventFlags`, and action-byte range surfaces; `IMPL-100` records its consolidated implementation modules and actual model types. No type churn. |
| R-P2-15 | Confirmed the `SF0156` row is absent from IMPL-040 §6; updated roadmap §2/§6 to show the resolved P2 evidence and real `dump` verb (no nonexistent `inspect --timeline`/`verify` claim). `gen_status.py` and `verify_docs.py` pass. |
| R-P2-14 | Added/finished labels and fixtures: PlaceObject v1 optional-CXFORM/id-zero/depth boundary (`T-MOD-001`); exhaustive PlaceObject2 and PlaceObject3 corpora (`T-MOD-002`, 256 and 65,536 flag patterns respectively); PO1/2/3 clip-depth/depth boundaries (`T-MOD-004`); HasVisible-only (`T-MOD-010`); dump JSON parse/re-serialize (`T-MOD-012`); main/sprite sound spans (`T-MOD-603`); root class, scaling-grid shadow, metadata duplicate, export collision, sprite End, anchor, and FileAttributes labels. |

### Batch C — clip actions — **DONE**

`tags/clip-actions.ts` decodes versioned 2/4-byte CLIPEVENTFLAGS, all handler bits, reserved fields,
CLIPACTIONS union/records, optional key code, bounded `ActionRecordSize`, and width-matched End marker;
raw bytes remain available for the action front end. Emits `SF0115`, `SF0118`, `SF0119`; model assembly
emits `SF0125` for non-sprite targets. Four `clip-actions.test.ts` cases cover both widths, valid and
invalid records, reserved/empty masks, and target validation. AVM1 analysis slices clip and button
`ActionBlockRef` ranges directly at the first ACTIONRECORD byte (no tag-header skip).

### Batch D — multi-movie imports — **DONE**

`buildMovieModel` accepts `imports: ReadonlyMap<string, SwfFile>`; `dump --import <url>=<file.swf>` is
repeatable and opens each supplied file through the same SWF reader. Model linking uses aliases without
copying source payloads; unresolved aliases become placeholders + `SF0150`; transitive chains resolve;
cycles produce `SF0155`; SWF 8+ deprecated `ImportAssets` remains inert. `imports.test.ts` has five
labeled cases (`T-MOD-017/018/026`); `dump.test.ts` covers CLI provenance output.

### Batch E — button data model — **P2 portion DONE; runtime criteria remain open**

`tags/buttons.ts` decodes v1/v2 records, action arrays/CONDACTION chains, key codes, button sounds and
cxforms; `model/buttons.ts` owns the shared transition table/state ordering and hit-area bounds;
`model/movie.ts` links records, aux tags, binary/filter metadata and nested button bounds. All `SF0130`–
`SF0138` report paths have fixtures. `buttons.test.ts` pins each condition bit, key corpus, menu/push
transition data, sound order/truncation, hit-area bounds, nested data, malformed chains, and auxiliary
tags. `analyzeMovie` now emits one `kind: 'button'` AVM1 block per button action range, pinned by the
v1 and v2 tests in `packages/avm1/test/movie.test.ts` (`T-MOD-817` verifies one block per CONDACTION).

**Batch E boundary:** the pointer state machine, exact vector hit testing, event bubbling, composite-key
runtime routing, generated button symbols/`ButtonRuntimeSpec`, and player-interaction goldens are not
implemented here; they are explicit doc 130/120 work, not claimed as P2 model completion.

### Execution deviations / residual test scope

- The tag-coverage tool is named `tools/tag_coverage.py` (underscore, matching the repository's existing
  Python module convention), rather than the hyphenated name in the initial plan.
- `T-MOD-012` validates deterministic JSON re-serialization, not byte-for-byte SWF reconstruction; the
  latter would need the deferred writer/`verify` harness.
- `T-MOD-019` tests storage of `ScriptLimits`, not interpreter budget enforcement; `T-MOD-030` shell
  navigation and `T-MOD-602` SetTarget grammar are P5/runtime obligations and remain untested here.
- IMPL-100 §11 runtime criteria 2–4 remain open as described above. The P2 roadmap's button criterion is
  specifically the decoded record/condition model, which is now tested.

## 6. Acceptance — repeat audit result

1. All four roadmap §6 P2 exit criteria are met with the named evidence.
2. The dead-code sweep returns **zero P2-scoped dead codes** (`SF0111` excluded — renderer scope;
   `SF0156` absent from the doc and registry).
3. The P2-owned model/decoder tests pass and are labeled: IMPL-030 15/16 (`T-MOD-602` is P5
   SetTarget grammar); IMPL-040 27/28 (`T-MOD-030` is runtime/emitter navigation); IMPL-100 17/17
   at the data/analysis-block level. `T-MOD-019` pins model storage only; interpreter budget
   enforcement remains P5.
4. `tools/tag_coverage.py` exits 0 and is wired into CI.
5. `audit_dev.py` reports new findings = 0 after the P2 surface update (baseline re-recorded).

### Final gate — 2026-10-05, current branch

| Gate | Result |
| --- | --- |
| `corepack pnpm typecheck` (all package and test configs) | **pass** |
| `corepack pnpm lint` (ESLint + Prettier) | **pass** |
| `corepack pnpm test` | **295/295, 29 files, exit 0**; no unhandled rejections |
| `corepack pnpm -r --filter './apps/**' build` | **pass** |
| `corepack pnpm test:audit` | **17 Python tests pass** |
| `python3 tools/tag_coverage.py` | **pass**; 65 registered tags fully dispositioned; CI step present |
| `python3 -m unittest discover -s tools -p 'test_tag_coverage.py'` | **10 tests pass** |
| `python3 tools/audit_dev.py` | **findings=57 known=57 new=0 fixed=0**; shape4 5/5; dump synth clean/dirty probes pass; baseline has 57 keys |
| `corepack pnpm spec:status && corepack pnpm spec:verify` | **pass**; `verify_docs.py` reports 0 issues |

**Scope correction for criterion 3:** the P2-owned model/decoder obligations are required to pass.
Three broader rows are intentionally not treated as P2 failures: `T-MOD-019` interpreter-budget
*enforcement* (P5; its model-level `ScriptLimits` storage is tested), `T-MOD-030` shell/emitted-bundle
navigation (runtime/emitter), and `T-MOD-602` nested `SetTarget` path grammar (AVM1 front end). The
button interaction clauses in IMPL-100 §11 (exact vector hit testing, event bubbling, pointer/focus
execution, generated handler symbols) are also runtime/emitter work; only the P2 data model and
AVM1 block discovery are claimed complete. These are listed as residuals in `P2-REPEAT-AUDIT.md`,
not silently marked as resolved.
