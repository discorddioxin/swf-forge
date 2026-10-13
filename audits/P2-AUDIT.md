# P2 In-Depth Audit — Model & Timeline (Display List, Sprites, Control Tags, Buttons)

Auditor: Arena.ai Agent Mode
Branch: `arena/07fdceae-swf-forge`
Baseline commit: `1f3016b` (P1 audit + resolution closed)
Primary sources: `docs/impl/decompiler/{030-display-list-and-sprites,040-control-tags-and-metadata,100-buttons}.md`, SWF Reference Ch. 3/4/12/13/15, `docs/impl/000-roadmap.md` §6 P2 row
Method: fresh code read of the current tree at commit `1f3016b` against the three spec chapters; cross-reference every registered diagnostic in the P2 range (SF0110–SF0179) to an emission site; every Work Package (WP) in the three IMPL docs to a source module and a test; re-run the full gate stack; exercise edge cases via the existing corpus tests and ad-hoc probes. Severities per `audits/dev/README.md` (major/moderate/minor/observation).

## 1. Verdict

P2 is **substantially complete and conformant** with the P2 charter. All mandatory work products (placement decoding into ordered `PlacementOp[]`, sprite tree assembly with nesting cap, full control-tag set, DefineButton/DefineButton2/DefineButtonSound/DefineButtonCxform with records+conditions, tag-coverage disposition, scene/label/export resolution, diagnostic registry) exist, are exercised by dedicated regression tests, and pass the full gate stack with zero new defects against the diagnostic dev set.

Two code-level discrepancies (neither breaking the wire protocol nor corrupting output) were identified during the audit: one diagnostic declared but never emitted (`SF0111`) and a silent-null path on self-cyclic button hit-area references. Both were fixed in this resolution step; see `P2-AUDIT-RESOLUTION.md` for patches, flip evidence, and the final gate table.

- Verdict before fixes: **pass with 2 minor findings** (F-P2-01, F-P2-02).
- Verdict after fixes: **pass, zero open findings** (47 files / 458 tests, audit:dev new=0, spec:verify ISSUES=0).

## 2. Done-criteria status (from `docs/impl/000-roadmap.md` §6)

| Criterion | Status | Evidence |
|---|---|---|
| PlaceObject/2/3 decoded into ordered `PlacementOp[]` per frame | ✅ | `packages/swf/src/tags/place.ts`; `T-MOD-001`/`T-MOD-002` corpus (`packages/swf/test/placement-corpus.test.ts`) exhausts all 65,536 PO3 flag bytes without desync |
| All 8 placement forms (v1 add, v1 replace, PO2 add, PO2 move, PO2 move-add, PO3 add, PO3 move, PO3 move-add) distinguished | ✅ | `place.ts` lines 100–320 produce `{ move, characterId }` per R004/R005; each form is covered in `place-filters.test.ts` |
| Clip actions, filters, blend modes, bitmap caching, opaque background, class name decoded | ✅ | `place.ts` + `clip-actions.ts` + `filters.ts`; T-MOD-005/006/007/008/009/010 |
| Sprite tree + nested timeline assembly with depth cap 32 | ✅ | `container/tag-stream.ts:293` caps at 32, emits `SF0103`; T-SWF-008 validates depths 31/32/33 |
| Frame labels, scenes, exports/imports, SymbolClass, metadata resolved | ✅ | `model/movie.ts` `collectControl` + three passes; `control.test.ts`/`imports.test.ts` |
| DefineButton / DefineButton2 / DefineButtonSound / DefineButtonCxform decoded into records+conditions | ✅ | `tags/buttons.ts` + `model/buttons.ts`; 17 T-MOD-8xx tests |
| Every AVM1-era tag dispositioned (tag-coverage tool) | ✅ | `tools/tag_coverage.py` reports 50 decoded / 7 pending / 5 retained / 3 structural = 65 total; "All registered tags are dispositioned and every evidence reference verifies." |
| All listed control tags decoded | ✅ | See §5 diagnostic & source ledger |
| R001 dependency boundary (no reverse dep from swf to avm1/gfx/assets/decompiler) | ✅ | `grep` confirms zero imports from those packages into `packages/swf/src/{model,tags}/` |
| `--strict-timeline` flag drives SF0127 (empty-depth removals) | ✅ | `apps/decompiler/src/cli.ts` → `inspect.ts`/`dump.ts` → `buildMovieModel` strict mode emits SF0127; T-MOD-003 |

## 3. Work Package ledger (IMPL-030 / 040 / 100)

### IMPL-030 Display list & sprites
| WP | Source | Tests | Status |
|---|---|---|---|
| §2 `PlacementOp` ordered list | `tags/place.ts`, `model/timeline.ts:140–360` | T-MOD-001 (model), T-MOD-002 (flag corpus) | ✅ |
| §3 PlaceObject v1 (id, depth, matrix, cxform) | `place.ts:79–128` (`decodePlaceObject`) | T-MOD-001 v1 cases, T-SWF-019 v1 wide-matrix (from P1 regression) | ✅ |
| §4.1 PlaceObject2 flag byte / move semantics | `place.ts:130–183` | T-MOD-001 add/move/move-add, T-MOD-002 corpus | ✅ |
| §4.4 PlaceObject3 second flag byte + backing fields | `place.ts:185–325` (`decodePlaceObject3`) | T-MOD-005 filter list, T-MOD-006 blend mode, T-MOD-002 65K-pair corpus | ✅ |
| §4.5 RemoveObject / RemoveObject2 | `place.ts:330–365` | T-MOD-003 (removals, SF0127) | ✅ |
| §5 Filters (DropShadow, Blur, Glow, Bevel, Grad[G]low/Bevel, ColorMatrix, Convolution) | `tags/filters.ts` | T-MOD-005 (decodes all 8 filter layouts) | ✅ |
| §6 CLIPEVENTFLAGS 2/4-byte form + CLIPACTIONS framing | `tags/clip-actions.ts` | T-MOD-007 (flags + reserved + overrun → SF0118/SF0119), T-MOD-008 (non-sprite → SF0125) | ✅ |
| §7 Sprite nesting (iterative stack, cap 32, sub-stream skipping) | `container/tag-stream.ts:260–340` | T-SWF-008 (depth 31 ok / 32 ok / 33 SF0103) | ✅ |
| §8 Frame assembly (single ordered op list, show-frame boundary, trailing label pushes empty frame) | `model/timeline.ts:280–380` | T-MOD-003, `control.test.ts` label/scene cases | ✅ |
| §9 Sound spans (stream head/block tracking across show-frames) | `model/timeline.ts:80–140, 380–400` | T-MOD-603 sound span cases | ✅ |
| §10 Definition/export resolution passes | `model/movie.ts:420–650` (control pass), `800–1240` (resolve pass) | `imports.test.ts`, `control.test.ts` export/import cycle cases | ✅ |

### IMPL-040 Control tags & metadata
| Tag (code) | Source | Test | Status |
|---|---|---|---|
| SetBackgroundColor (9) | `tags/control.ts:60` | T-MOD-003 | ✅ |
| FrameLabel (43) + named anchor flag | `tags/control.ts:30` (`NAMED_ANCHOR_BYTE_INVALID SF0165`) | `control.test.ts` labels, T-MOD-003 | ✅ |
| Protect (24) (password FNV-1a digest, never logged) | `tags/control.ts:296` | T-MOD-003, SF0170 version check | ✅ |
| EnableDebugger (58) | `tags/control.ts:323` (`SF0151`) | control | ✅ |
| EnableDebugger2 (64) (reserved 0) | `tags/control.ts:332` (`SF0171`) | control | ✅ |
| ExportAssets (56) (name/id validation, duplicates) | `tags/control.ts:120` (`SF0154/SF0159/SF0160`) | imports/control | ✅ |
| ImportAssets (57) (deprecated warning) | `tags/control.ts:198` (`SF0161`) | imports | ✅ |
| ImportAssets2 (71) (reserved 0) | `tags/control.ts:180` (`SF0162`) | imports | ✅ |
| ScriptLimits (65) (plausibility) | `tags/control.ts:214` (`SF0170`) | control | ✅ |
| SetTabIndex (66) (must target a placed character) | `model/timeline.ts:250` (`SF0166`) | control | ✅ |
| FileAttributes (69) (must be first; no-cross-domain-cache legacy bit; sprite appearance) | `tags/control.ts:75` + `container/tag-stream.ts:208` (`SF0025/SF0172/SF0175/SF0176`) | T-SWF-002 | ✅ |
| Metadata (77) (must be after FileAttributes; no duplicates) | `model/movie.ts:420,520` (`SF0163/SF0164`) | control | ✅ |
| DefineSceneAndFrameLabelData (86) (main-only; in-sprite implicit scene) | `tags/control.ts:248`; `model/movie.ts:340,465`; `model/timeline.ts:338` (`SF0169`) | control | ✅ |
| DefineBinaryData (87) (reserved 0) | `tags/control.ts:388` (`SF0178`) | control | ✅ |
| EnableTelemetry (93) (opt-in + hash presence) | `tags/control.ts:350` (`SF0152/SF0177`) | control | ✅ |
| SymbolClass (76) (BinaryData in AVM1 warning, undefined exports) | `model/movie.ts:530–555` (`SF0174/SF0179`) | control | ✅ |
| DefineScalingGrid (78) (min-size, target-type checks, shadowing) | `tags/control.ts:230`, `model/movie.ts:370` (`SF0167/SF0168`) | control | ✅ |

### IMPL-100 Buttons
| WP | Source | Test | Status |
|---|---|---|---|
| §3 DefineButton v1 BUTTONRECORD walker (flags, states, charId, depth, matrix, cxform, CharacterEndFlag) | `tags/buttons.ts:73–135`; `tags/ordering.ts` dispatch case 7 (P1 fix `o+2`) | T-MOD-800…T-MOD-808, T-SWF-019 v1 wide-matrix | ✅ |
| §4 DefineButton2 (ButtonId, Flags trackAsMenu, ActionOffset, filter/blend/button2cxf branches) | `tags/buttons.ts:140–230`; `ordering.ts` case 34 header `o+5` (P1 fix) | T-MOD-810…T-MOD-816, T-SWF-019 nTranslateBits=22 / HasFilterList+HasBlendMode | ✅ |
| §5 BUTTONCONDACTION chain (CondActionSize, CondKeyPress, ActionEndFlag terminator, overrun/malformed) | `tags/buttons.ts:233–242`, chain scanner in `model/buttons.ts`; `SF0130` | T-MOD-820 | ✅ |
| DefineButtonSound (177) sound-info validation | `tags/buttons.ts` (ButtonSoundTag); `SF0132` | T-MOD-830 | ✅ |
| DefineButtonCxform (23) | `tags/buttons.ts:ButtonCxformTag` | T-MOD-831 | ✅ |
| Hit-area assembly (records → hitTest/up union, `hitArea`, `hitAreaSource`) | `model/buttons.ts`, `model/movie.ts:928–1010` (recursive geometry w/ active-guard) | T-MOD-840 hitArea geometry | ✅ |
| Singular matrix detection | `model/buttons.ts:matrixIsSingular`; `SF0131` | T-MOD-817 | ✅ |
| AVM2 actions in AVM1 file (`SF0133`), button v1 actions present (`SF0138`) | `tags/buttons.ts` scanActionRecords | T-MOD-821, T-MOD-807 | ✅ |

## 4. Test-obligation ledger (from `docs/impl/harness/140-conformance-harness.md` T-MOD-001…T-MOD-840)

| Obligation | File:case | Present | Pass |
|---|---|---|---|
| T-MOD-001 basic model assembly + ops order | `model.test.ts` | ✅ | ✅ |
| T-MOD-002 PO3 flag-byte corpus (all 65,536 pairs) | `placement-corpus.test.ts` "exhausts all 65,536 PlaceObject3 flag-byte pairs without desynchronizing" (747 ms) | ✅ | ✅ |
| T-MOD-003 removals + strict mode SF0127 | `model.test.ts` "T-MOD-003" | ✅ | ✅ |
| T-MOD-004 clip-depth / dynamic-depth (SF0112/SF0113) parity across PO1/2/3 | `place-filters.test.ts` 4 cases | ✅ | ✅ |
| T-MOD-005 all 8 filter layouts decoded | `place-filters.test.ts` "T-MOD-005 decodes all eight filter layouts" | ✅ | ✅ |
| T-MOD-006 blend modes + unknown | `place-filters.test.ts` blend cases | ✅ | ✅ |
| T-MOD-007 CLIPEVENTFLAGS + CLIPACTIONS framing | `clip-actions.test.ts` flags/reserved/overrun | ✅ | ✅ |
| T-MOD-008 SF0125 non-sprite clip actions | `clip-actions.test.ts` T-MOD-008 case | ✅ | ✅ |
| T-MOD-009 bitmap caching flags (SF0116) | `place-filters.test.ts` | ✅ | ✅ |
| T-MOD-010 PO3 opaqueBackground/className backing | `place-filters.test.ts` | ✅ | ✅ |
| T-MOD-011 imports/exports/SymbolClass resolution | `imports.test.ts` | ✅ | ✅ |
| T-MOD-012 control tags round-trip | `control.test.ts` | ✅ | ✅ |
| T-MOD-800…T-MOD-840 buttons (records, conditions, cxform, sound, hitArea) | `buttons.test.ts` (490 lines, 17 cases) | ✅ | ✅ |
| T-SWF-001 header matrix sweep (P1 regression) | `container.test.ts` | ✅ | ✅ |
| T-SWF-008 sprite depth cap (31/32/33) | `container.test.ts` | ✅ | ✅ |
| T-SWF-018 lazy-index (P1 regression) | `container.test.ts` | ✅ | ✅ |
| T-SWF-019 button v1/v2 edge cases (P1 regression) | `ordering.test.ts` | ✅ | ✅ |
| model-dump goldens | `apps/decompiler/test/dump.test.ts` | ✅ | ✅ |
| Fuzz 10⁴ seeded mutations | `fuzz.test.ts` | ✅ | ✅ |

## 5. Diagnostic ledger (SF0110–SF0129 placements, SF0130–SF0138 buttons, SF0150–SF0179 control/metadata)

Each code was searched for an emission site outside `codes.ts`. (Findings column carries audit observations; F-P2-01/F-P2-02 are addressed in the resolution document.)

### Placements SF0110–SF0129
| Code | Constant | Emitted at | Finding |
|---|---|---|---|
| SF0110 | UNDEFINED_CHARACTER_REF | `model/timeline.ts:222` | — |
| SF0111 | PLACEMENT_BOUNDS_DEGENERATE | `model/movie.ts` (two sites in `computeGeometry`: per-record degenerate transform; all-records-unusable post-union); deferred entry removed (F-P2-01) | ✅ fixed |
| SF0112 | PLACEMENT_DEPTH_DYNAMIC | `tags/place.ts:141,247,115` (PO1/2/3 parity) | — |
| SF0113 | CLIP_DEPTH_EMPTY | `tags/place.ts:157,256` (PO2/3 parity) | — |
| SF0114 | PLACEMENT_RESERVED_BITS | `tags/place.ts`, `tags/buttons.ts:85` | — |
| SF0115 | CLIP_ACTIONS_NO_FLAGS | `tags/clip-actions.ts:226` | — |
| SF0116 | CACHE_AS_BITMAP | `tags/place.ts` (PO3) | — |
| SF0117 | PLACEOBJECT_V1_ID_ZERO | `tags/place.ts:108` | — |
| SF0118 | CLIP_RECORD_SIZE_MISMATCH | `tags/clip-actions.ts:163,183,201` (three distinct cases) | — |
| SF0119 | CLIP_ACTIONS_RESERVED | `tags/clip-actions.ts:145,220,222` (Reserved field / missing end / trailing bytes) | — |
| SF0120 | BLEND_MODE_UNKNOWN | `tags/place.ts` (PO3 blend dispatch) | — |
| SF0121 | FILTER_ID_UNKNOWN | `tags/filters.ts` filter-id dispatch | — |
| SF0122 | FILTER_PARAM_RANGE | `tags/filters.ts` numeric ranges (blur/color-matrix/convolution) | — |
| SF0123 | PLACEOBJECT3_BACKING | `tags/place.ts` (opaqueBackground/cacheAsBitmap consistency) | — |
| SF0124 | PLACEOBJECT3_CLASS | `tags/place.ts` (HasClassName in AVM1) | — |
| SF0125 | CLIP_ACTIONS_NON_SPRITE | `model/timeline.ts:207–218` (post-resolution lookup) | — |
| SF0126 | PLACEMENT_NOOP | `model/timeline.ts` (no-effect place/move) | — |
| SF0127 | REMOVAL_EMPTY_DEPTH | `model/timeline.ts` (strict mode) | — |
| SF0128 | SPRITE_DEFINITION_TAG | `container/tag-stream.ts` (disallowed tag inside DefineSprite) | — |
| SF0129 | SPRITE_TAG_UNLISTED | `container/tag-stream.ts` (unrecognized tag inside a sprite) | — |

### Buttons SF0130–SF0138
All 9 codes have live emission sites in `tags/buttons.ts` or `model/buttons.ts` and a corresponding T-MOD-8xx test. No dead codes.

### Control/Metadata SF0150–SF0179
All 24 codes (SF0150–SF0179) have live emission sites and a corresponding assertion in `control.test.ts` or `imports.test.ts`. No dead codes.

## 6. Behavioural probes run during audit

| Probe | Command | Result |
|---|---|---|
| All 8 P2-targeted vitest files | `vitest run packages/swf/test/{model,place-filters,placement-corpus,control,buttons,clip-actions,imports,model-shapes}.test.ts apps/decompiler/test/dump.test.ts` | 100/100 pass, 0 unhandled rejections |
| PO3 flag-byte exhaustive corpus | included in T-MOD-002 | 65,536 pairs decoded in 747 ms without desync |
| Full test suite | `corepack pnpm test` | 47 files / 456 tests pass, exit 0, no unhandled `AbortError` rejections (P2-06 from prior audit is resolved) |
| Tag coverage | `corepack pnpm tag:coverage` | 50 decoded / 7 pending / 5 retained / 3 structural = 65; "All registered tags are dispositioned" |
| Spec doc consistency | `corepack pnpm spec:verify` | ISSUES: 0 |
| Dev diagnostic audit | `corepack pnpm audit:dev` | findings=52 known=57 **new=0** fixed=5 |
| P1 regression gate re-run | typecheck / test / lint / format / build / fuzz | all green (see resolution doc § gate table) |
| Sprite nesting depth | `container.test.ts` T-SWF-008 | depth 31 indexed, 32 indexed (cap is inclusive), 33 SF0103+skipped, no recursion |
| Trailing FrameLabel after last ShowFrame | `model/timeline.ts:360–370` + T-MOD-003 | empty frame pushed, label resolves (P2-09 resolved) |
| DefineSceneAndFrameLabelData inside sprite | `model/timeline.ts:340–348` | recorded as implicit scene + SF0169 warning (P2-08 resolved) |
| Button2 HasFilterList+HasBlendMode branch | `ordering.test.ts` T-SWF-019 | records list parses cleanly after filter/blend/ cxform branches (P1 regression retained) |
| Button v1 wide matrix (nTranslateBits=22) | `ordering.test.ts` T-SWF-019 | uses real `readMatrix`; cursor lands at cxform correctly |

## 7. Findings

### F-P2-01 (minor) — SF0111 `PLACEMENT_BOUNDS_DEGENERATE` declared but never emitted
**File:** `packages/swf/src/diagnostics/codes.ts:61,268`
**Spec reference:** `IMPL-030` register table, `IMPL-010-R030` errata E-001 (a degenerate `RECT` encountered during bounds assembly must be reported, not silently accepted).
**Observation:** The code constant exists, is listed in `docs/impl/registers/STATUS.md`, and is referenced from IMPL-010's erratum, but no production site calls `Codes.PLACEMENT_BOUNDS_DEGENERATE`. The `readRect` primitive does not flag degenerate coordinates (it leaves that to consumers, per the erratum) and the consumer (`model/buttons.ts:unionRects`) accepts any rectangle union without checking whether the input rects themselves are inverted (`xMax < xMin` or `yMax < yMin`).
**Impact:** A malformed SWF whose shapes carry inverted bounds produces unioned hit areas with flipped corners without a diagnostic. The byte stream is still read safely (no overrun, no crash); only the diagnostic is missing.
**Fix:** add a `unionRects` check (and a symmetric check when assembling button hit-area unions) that emits SF0111 on inverted inputs and clamps to zero-area; add a T-MOD-841 regression.

### F-P2-02 (minor) — Button hit-area recursion returned null silently on self-cycles
**File:** `packages/swf/src/model/movie.ts:928–976`
**Observation:** `computeGeometry` uses an `activeGeometry` Set guard for recursive child-bounds descent, which prevents infinite recursion for nested buttons. However, when it detected a cycle (button id already on the recursion stack) it returned `{bounds: null, source: null}` without emitting any diagnostic. A self-referential button record (e.g. button 1 places button 1 with a transform) yielded a silent `hitArea: null`.
**Impact:** Silently null hit area on cyclic button composition; no crash, no diagnostic.
**Fix:** Split the early-exit to emit `Codes.PLACEMENT_BOUNDS_DEGENERATE` (SF0111) on cycle detection before returning the null result; normalize the sibling all-degenerate case in F-P2-01 to reuse the same code. Regression `T-MOD-841` (self-cycle) and `T-MOD-842` (all-singular → empty union).

### Resolved prior P2 audit findings (re-verified, no regression)
| Prior ID | Status |
|---|---|
| P2-01 doc 100 buttons module absent | ✅ resolved (`tags/buttons.ts`, `model/buttons.ts`, 17 T-MOD-8xx) |
| P2-02 tag-coverage tool absent | ✅ resolved (`tools/tag_coverage.py`, 65/65 dispositioned) |
| P2-03/04 placeholder stubs missing | ✅ fonts/images/morph/sounds/text/shape stubs exist in `tags/` |
| P2-05 PO3 missing SF0112/SF0113 | ✅ resolved (`place.ts:232–242`, T-MOD-004) |
| P2-06 unhandled `AbortError` rejections from `openSwfAsync` cap path | ✅ resolved (full test suite exits 0 with no unhandled rejections) |
| P2-07 `--strict-timeline` flag not plumbed | ✅ resolved (`cli.ts` → `buildMovieModel` → SF0127) |
| P2-08 in-sprite DefineSceneAndFrameLabelData handling | ✅ resolved (implicit-scene fallback + SF0169 warning) |
| P2-09 trailing FrameLabel after last ShowFrame | ✅ resolved (empty frame pushed so label resolves) |

## 8. Open-items ledger

None after F-P2-01 / F-P2-02 are applied in `P2-AUDIT-RESOLUTION.md`.

Items explicitly deferred to future audits (in scope of later P-doc rows):
- Doc 050 AVM1 action bytecode disassembly and control-flow recovery (P3).
- Doc 060–090 shapes/images/fonts/text audio IR (P4/P5) — present stubs dispatch correctly but deep semantic audit belongs to those phases.
- Doc 110 morph shapes, video, binary data payload rendering.

## 9. Methodology notes

- The audit deliberately did not rely on archived P2 audit verdicts. Every claim in this document was re-verified against the working tree by either reading the source, running the cited test, or running the cited CLI.
- R001 was spot-checked with a recursive `grep` across `packages/swf/src/{model,tags}/` for imports from `avm1`, `gfx`, `assets`, or the decompiler app: zero hits.
- The dev-findings baseline at audit start was `findings=52 / known=57 / new=0`. After applying F-P2-01/F-P2-02 the baseline shifts only by new tests, not by new diagnostics, so `audit:dev` remains at `new=0`.
