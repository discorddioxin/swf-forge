# P2 Integrity Audit

**Date:** 2026-10-05 · **Auditor:** agent · **Branch:** `arena/01a10928-swf-forge`
**Scope:** P2 — Model & timeline (`IMPL-030` display list/placements/filters/sprites, `IMPL-040` control tags & metadata, `IMPL-100` buttons)
**Authorities:** `docs/impl/000-roadmap.md` §6 P2 exit criteria (L216–L221) and §2.2 evidence table;
`docs/impl/decompiler/030-display-list-and-sprites.md` (v1.4: R001–R042, §3 data model, §6 diagnostics `SF0110`–`SF0129`, §10 tests `T-MOD-001`–`012`/`601`–`604`, §13 done criteria);
`docs/impl/decompiler/040-control-tags-and-metadata.md` (v1.3: R001–R048, §5 model fields, §6 diagnostics `SF0150`–`SF0179`, §7 tests `T-MOD-013`–`040`, §10 done criteria);
`docs/impl/decompiler/100-buttons.md` (v1.1: R001–R026, §7 diagnostics `SF0130`–`SF0138`, §8 tests `T-MOD-801`–`817`, §11 done criteria);
`docs/impl/harness/140-conformance-harness.md`; `APP` §10.1/§10.2 (field orders); SWF Reference Ch.3/4/12/13/15.

**Method:** every rule (R001–R042 / R001–R048 / R001–R026), diagnostic table row, work package, and test
obligation was cross-referenced against code (`packages/swf/src/tags/{place,control,filters,tag-codes}.ts`,
`packages/swf/src/model/{movie,timeline,types}.ts`, `apps/decompiler/src/dump/model-dump.ts`,
`apps/decompiler/src/commands/dump.ts`, `apps/decompiler/src/cli.ts`), the diagnostic registry
(`packages/swf/src/diagnostics/codes.ts`), tests (`packages/swf/test/{model,place-filters,control}.test.ts`,
`apps/decompiler/test/dump.test.ts`), and tooling (`tools/`); then the gate was executed:
`corepack pnpm typecheck` → **pass**; `corepack pnpm lint` → **pass**; `corepack pnpm test` →
**238/238 tests pass, but the process exits 1 (3 unhandled rejections — finding P2-06)**;
`tsc -b --force` (covers `packages/swf`) → **pass**; `python3 tools/audit_dev.py` →
**findings=81 known=81 new=0 fixed=0**.
The working tree carries uncommitted P5 (AVM1) WIP; P2 code was not modified during this audit.

**Baseline note:** the prior combined audit `audits/archive/P1-P2-INTEGRITY-AUDIT.md` (2026-10-04) already
flagged buttons (doc 100), `tools/tag-coverage`, clip actions, and multi-movie imports as missing. Since then
the doc 040 control-tag residue was largely implemented (`DefineBinaryData`, `EnableDebugger(2)`,
`EnableTelemetry`, sprite-level missing-`End` `SF0173`, `FileAttributes` legacy bit `SF0176`,
not-first `SF0172`, in-sprite `SF0175` — all with tests). This audit re-verifies the full P2 surface
freshly; items marked **known** were already open and unchanged, **new** items were not in the prior audit.

---

## 1. Verdict summary

**P2's model core is implemented well and is largely faithful to spec; the phase is NOT exitable.**
Of the four §6 exit criteria: ordered `PlacementOp[]` ✅, sprite tree/labels/scenes/exports ✅ (with
two low-severity model gaps), buttons ❌ (doc 100 entirely absent), tag-coverage report ❌ (tool absent).
Two medium findings are new since the prior audit: `PlaceObject3` omits the two placement checks
(`SF0112`/`SF0113`) that `PlaceObject2` performs, and the shared test process is red (exit 1) due to three
unhandled `AbortError` rejections leaking from the `openSwfAsync` cap path.

| # | Exit criterion (roadmap §6, P2) | Met? |
| --- | --- | --- |
| 1 | `PlaceObject`/`2`/`3` produce ordered `PlacementOp[]` per frame (unit + model-dump golden) | ✅ — `assembleTimeline` (`model/timeline.ts`) keeps placements/removals/tab-index ops interleaved in file order per `IMPL-030-R031`; pinned by `dump.test.ts` T-MOD-037/038/039 goldens and `model.test.ts`. Caveat: PO3 missing `SF0112`/`SF0113` (P2-05). |
| 2 | Sprite tree, frame labels, scenes, exports resolved (model dump on synthetic corpus) | ✅ with caveats — sprite timelines, `SF0128`/`SF0129`, declared-wins padding (`T-MOD-601`), scenes/labels/exports in the dump. Caveats: in-sprite scene data unparsed (P2-08); trailing-`FrameLabel` quirk (P2-09); "synthetic corpus" = the test fixtures, not a broader conformance corpus (WP-140-01 still open). |
| 3 | Buttons decoded into records + conditions (unit tests) | ❌ — see §4. |
| 4 | Tag coverage report: every AVM1-era tag dispositioned (`tools/tag-coverage` output) | ❌ — see §5. |

**Gate table (2026-10-05, this audit):**

| Gate | Result |
| --- | --- |
| `corepack pnpm typecheck` (`tsc -b --force` + all test configs) | ✅ pass |
| `corepack pnpm lint` (eslint + prettier check) | ✅ pass |
| `corepack pnpm test` | ⚠️ **238/238 tests pass (25 files) but process exit = 1** — 3 unhandled rejections (`AbortError`) from the `openSwfAsync` decompression cap path (P2-06). Note: `audits/P1-REPEAT-AUDIT.md` §3 recorded "238/238 ✅" for the same suite — the count was right, the exit code was not. |
| `audit_dev.py` | ✅ findings=81 known=81 new=0 fixed=0 (all 81 baseline entries are P3/P5-range) |

---

## 2. Doc 030 — placements, filters, sprites (`IMPL-030`)

### 2.1 Work-package status

| WP | Title | Status | Evidence |
| --- | --- | --- | --- |
| 030-01 | Shared placement field reader | ✅ | `tags/place.ts` — field order verified byte-for-byte against APP-§10.1 for all three placement forms (PO3: v2 flags, v3 flags, `Depth`, `ClassName` iff `HasClassName‖(HasImage∧HasCharacter)`, `CharacterId`, `Matrix`, `CxformWithAlpha`, `Ratio`, `Name`, `ClipDepth`, `FilterList`, `BlendMode`, `BitmapCache`, `Visible`, `BackgroundColor` iff `HasOpaqueBackground`, `ClipActions` last). |
| 030-02 | PlaceObject v1 + CXFORM tail + id-0 tolerance | ✅ code / ❌ test | `decodePlaceObject` (tail CXFORM iff ≥ 3 bytes; `SF0117` id-0 move per E-010). **T-MOD-001 absent.** |
| 030-03 | PlaceObject2 move matrix | ✅ code / ⚠️ test / ⚠️ rule | All 8 flags; `SF0112` (depth ≥ 16384), `SF0113` (clipDepth ≤ depth), `SF0126` no-op present. **T-MOD-002 absent**; the done-criterion 32-combination flag corpus does not exist (§2.3 #2). |
| 030-04 | PlaceObject3 | ⚠️ code / ✅ test | `decodePlaceObject3` complete incl. E-008 (HasVisible-only consumes no RGBA), class/image distinction, `SF0114` reserved bits, `SF0120`/`SF0124`/`SF0123`. **Missing: the `SF0112` and `SF0113` checks that PO2 performs (P2-05)** — the §6 table rows are phrased generically ("placement depth ≥ 16384"; "clip-depth value does not exceed its own depth"), so the rule applies to all placement forms. |
| 030-05 | All 8 filters | ✅ | `tags/filters.ts` — all eight layouts, field orders and bit widths match §5; authored units preserved (FIXED/FIXED8/float32); unknown id → `{kind:'unknown'}` + raw tail + `SF0121`, list marked incomplete (no-length-prefix reality respected); `CompositeSource=0` → `SF0122` with the value still honoured (R025). T-MOD-005/006 ✅. |
| 030-06 | CLIPEVENTFLAGS + CLIPACTIONS framing | ❌ **MISSING** | Clip actions are kept as a raw byte range (`ActionBlockRef`) for the AVM1 stage; no CLIPEVENTFLAGS record decode, no CLIPACTIONS framing, no `ActionRecordSize` validation. `SF0115`/`SF0118`/`SF0119`/`SF0125` are **dead codes** (registered, never emitted; confirmed by exhaustive registry sweep). T-MOD-007/008 absent; done-criterion #3 (round-trip incl. deliberately wrong `ActionRecordSize`) unmet. The §3 model contract's `clipActions: ClipActions` is realised as `clipActions: ActionBlockRef` (surface deviation, §6.3). |
| 030-07 | Remove/ShowFrame decoders | ✅ | `decodeRemoveObject(2)`; `SF0127` (removal of an empty depth, `--strict-timeline`-only per R025) is **not emitted** — no `--strict-timeline` mode exists; the display list is tracked in `assembleTimeline` but the diagnostic is never raised. T-MOD-003 ✅. |
| 030-08 | Sprite model + nested timelines | ✅ | `model/movie.ts` — one nested timeline per `DefineSprite`; `SF0128` (definition tag inside sprite), `SF0129` (tag not in the accepted sprite set — chapter's pre-PO3 omissions reported, not rejected), `SF0023` mismatch + declared-wins padding. T-MOD-601 ✅; T-MOD-011 (empty sprite / missing `End`) covered in content (T-SWF-020 padding, SF0173 test) but unlabeled; T-MOD-603 (stream-sound spans) untested (span-recording code exists, `streamSoundSpans`). |
| 030-09 | Frame assembly, ordered ops | ✅ | `assembleTimeline`: single ordered `ops` list (R031), pure per-tag cursors (R032), padding policy (R033), `SF0110` undefined-character + model placeholder, `SF0166` empty-depth `SetTabIndex`, `SF0153` duplicate label (first wins), stream-sound spans with `SF0032` ordering check. |
| 030-10 | `inspect --timeline` + goldens | ⚠️ Replaced | No `--timeline` flag in `cli.ts` (flags: `--actions/--tags/--symbols/--strict/--tolerate-length/--json/--verbose/--out`). The functionality lives in the `dump` verb (`model-dump.ts` renders every frame's ops for main + each sprite; T-MOD-037–040 ✅). The roadmap demo line and done-criterion #4 ("`inspect --timeline` … `verify` reconstitutes identical frames") are not literally satisfied; no `verify` verb exists. |
| 030-11 | Ch.3 conformance corpus (flag combos) | ❌ | No systematic PlaceObject2 (32-combo) / PlaceObject3 (16-bit) flag-combination fixture suite. |
| 030-12 | Sprite naming + SetTarget grammar + sound spans | ⚠️ Partial | Tag-set rule ✅; `Name` decoded verbatim ✅; sound spans ✅ (untested); SetTarget path grammar over a nested fixture (T-MOD-602) absent — resolution sits in P5 (`packages/avm1`), the model records the name only. |

### 2.2 Doc 030 test obligations (16)

| Obligation | Status | Where |
| --- | --- | --- |
| T-MOD-001 (PlaceObject v1, CXFORM tail, id-0) | ❌ | — (code exists, untested) |
| T-MOD-002 (PO2 move matrix; 32-combo corpus) | ❌ | — (code exists; no corpus) |
| T-MOD-003 (removals keep CharacterId / null) | ✅ | `place-filters.test.ts:245` |
| T-MOD-004 (clip-depth range boundary) | ❌ | — (code exists, untested) |
| T-MOD-005 (all 8 filter layouts, authored units) | ✅ | `place-filters.test.ts:122` |
| T-MOD-006 (unknown filter id + raw tail; CompositeSource) | ✅ | `place-filters.test.ts:177,190` (the second test is the R025/`SF0122` case) |
| T-MOD-007 (CLIPEVENTFLAGS 2/4-byte layouts) | ❌ | no code |
| T-MOD-008 (CLIPACTIONS framing + wrong `ActionRecordSize`) | ❌ | no code |
| T-MOD-009 (PO3 full field order, class/image) | ✅ | `place-filters.test.ts:207,234` |
| T-MOD-010 (E-008 opaque background; HasVisible-only consumes no bytes) | ⚠️ | Cited in the file header comment only; the E-008 case rides inside T-MOD-009's backing-field assertions — no dedicated test |
| T-MOD-011 (empty sprite, missing `End`, frame-count mismatch) | ⚠️ | Content covered (T-SWF-020 padding ×2; SF0173 test) but unlabeled |
| T-MOD-012 (model round-trip assemble → serialize → re-assemble) | ❌ | — |
| T-MOD-601 (referenced-but-undefined → placeholder + padding) | ✅ | `model.test.ts:73` |
| T-MOD-602 (instance naming + SetTarget path grammar) | ❌ | — (grammar is P5) |
| T-MOD-603 (sprite-local stream-sound spans) | ❌ | — (recording code exists, untested) |
| T-MOD-604 (Appendix A PlaceObject2 walkthrough) | ✅ | `model.test.ts:90` |

**Labeled and passing: 6/16. Content-covered-unlabeled: 2 (010, 011). Missing: 8.**

### 2.3 Done criteria (doc 030 §13)

1. Every placement form and every filter decodes from writer fixtures, byte-exact — ⚠️ PO3 + filters ✅; PlaceObject v1 and the PO2 matrix untested.
2. 32-combination PO2 flag corpus + 16-bit PO3 flag corpus decode without desynchronisation — ❌ no corpus.
3. Clip actions round-trip incl. deliberately wrong `ActionRecordSize` (`SF0118` path) — ❌ no decoder.
4. `inspect --timeline` stable/diffable; `verify` reconstitutes identical frames — ⚠️ `dump` is stable and byte-deterministic (T-MOD-037/038) but neither verb name exists.
5. Every §12 row settled (v1.2 exit criterion) — ✅ per the document's own changelog.

---

## 3. Doc 040 — control tags & metadata (`IMPL-040`)

### 3.1 Work-package status

| WP | Title | Status | Evidence |
| --- | --- | --- | --- |
| 040-01 | Background | ✅ | `decodeSetBackgroundColor` (exactly 3 bytes; trailing bytes reported); `backgroundSource: 'default'‖'tag'` (R006); `backgroundChanges` in file order. Content tested in the appendix model test (T-MOD-013 unlabeled). |
| 040-02 | Frame labels + named anchors | ⚠️ | `decodeFrameLabel`; `SF0153` duplicate (first wins, R008) ✅; `control.labels` + `labelEntries` keep all occurrences (T-MOD-029 ✅). **R009 deviation (P2-11):** the anchor byte is detected by "one byte remaining after the null terminator" and R009 says a byte *other than 1* is `SF0165` **but still treated as an anchor**; the implementation sets `namedAnchor = (byte === 1)` (so a stray `0` is silently "no anchor" with no diagnostic, and any other value yields `namedAnchor: false` despite the byte's presence). |
| 040-03 | Scenes + merge order | ⚠️ | `decodeSceneAndFrameLabelData` + `normalizeScenes`: offsets not starting at 0, decreasing, repeating, or beyond the frame count → `SF0169` + clamped (R013 main-timeline half ✅); scene-relative label remap (`sceneFrameRemap`) ✅; merged label lists in tag-order-then-scene order (R012) ✅. **R013 sprite half unmet (P2-08):** scene data *inside a sprite* MUST be recorded as a single implicit scene + `SF0169` (the §6 row explicitly says "…or inside a sprite") — sprite timelines never see `DefineSceneAndFrameLabelData` (`collectControl` iterates top-level tags only), so it is silently dropped. |
| 040-04 | Export map hardening | ⚠️ | `decodeExportAssets`/`decodeSymbolClass`: `SF0154` empty name, `SF0159` duplicate id (later name wins, shadowed kept), `SF0160` duplicate name (first id wins), `SF0174` **dead** — an entry naming a character id that is not in the dictionary is neither reported nor resolved through the `missing`-placeholder policy (R015, P2-07). `mergeExports` in the model: first-wins-by-name / last-wins-by-id ✅. |
| 040-05 | Imports + multi-movie + alias cycle | ⚠️ Partial | `decodeImportAssets(2)`: `SF0161` (SWF 8+ deprecation, R017), `SF0162` reserved bytes (R019) ✅. **Multi-movie resolution, no-copy aliasing `{localId, sourceMovie, sourceId}`, and cycle detection (R020/R021) are absent** — `buildMovieModel` takes a single `SwfFile`; every `ImportEntry.applied` is `false`; `SF0150` (unresolved) and `SF0155` (alias cycle, error) are dead. T-MOD-017/018 absent; done-criterion #3 unmet. |
| 040-06 | FileAttributes + AVM2 detection | ✅ | Little-endian word over available bytes (R032 bit-order traps); reserved bits → `SF0171` (recorded verbatim); legacy SWF 9 `NoCrossDomainCache` bit → `SF0176` (R031, E-022) — both tested (`control.test.ts:108`); not-first in SWF 8+ → `SF0172` (tested); in-sprite → `SF0175` (emitted at container level, tested); AS3 flag **or** `DoABC` → `SF1000` with the offset named, exit 3 (T-MOD-021 ✅). |
| 040-07 | ScriptLimits | ⚠️ | `decodeScriptLimits` + `SF0170` for depth `0` and timeout `0` (R022); recorded as authored (model keeps the raw value ✅). Not enforced: "timeout outside our supported window" (only `0` is checked) and the clamping lives in the P5 budget mapping (AVM1-R073) — acceptable for P2, but T-MOD-019 (budget override) is out of P2 scope and absent. |
| 040-08 | SetTabIndexOp | ✅ | `kind: 'tabIndex'` op in `FrameModel.ops` in file order + `control.tabIndexOps`; empty depth → `SF0166` with the op kept (T-MOD-025 ✅); T-MOD-039 asserts both places. |
| 040-09 | DefineScalingGrid | ⚠️ | `SF0167` (splitter < 1 twip per side, dropped — R028 ✅, emitted by the decoder, dropped by the model) and `SF0168` (target not sprite/button or unknown, dropped ✅). **R028 residue (P2-10):** "repeated tags for one character: the last one wins **and the shadowed rect is reported**" — `scalingGrids.set` overwrites silently. The doc §6 `SF0156` row ("invalid scaling grid (dropped: < 1 twip, bad rect order)") duplicates `SF0167`'s case and is absent from the code registry entirely — a doc/registry error (P2-15a). |
| 040-10 | DefineBinaryData | ⚠️ New since prior audit | `decodeDefineBinaryData` exists (R038 layout: `CharacterID`, `Reserved UI32` → `SF0178`, data to end; 16 MiB blob cap with truncation warning) and is tested (T-MOD-022/036: bytes + size + digest, never a string). **Residue (P2-12):** R038 requires a `binary` asset `{id, bytes}` registered in the dictionary; the model retains only `length` + `digest` in `control.binaryData` — the payload bytes are discarded. `SF0179` (a `SymbolClass` name pointing at a binary character in an AVM1 movie — inert info) is dead. |
| 040-11 | Metadata/Protect/debugger/telemetry | ✅ | `SF0163` biconditional (tested), `SF0164` at-most-once (first kept) ✅; `Protect`/`EnableDebugger`/`EnableDebugger2` passwords recorded as present + FNV-1a digest only, never the text (R039/R040 — T-MOD-031/033 ✅, redaction asserted); `EnableTelemetry` 2-byte reserved + optional 32-byte hash → `SF0152` opt-in + `SF0177` hash-present (T-MOD-035 ✅, R041). |
| 040-12 | SymbolClass + root class | ✅ | `id = 0` → `rootClassName`, excluded from the export pairs (R016) ✅ (T-MOD-027 unlabeled). `SF0174` unknown-id gap applies here too (P2-07). |
| 040-13 | End validation file + sprite | ✅ (fixed since prior audit) | File-level `SF0102` in `tag-stream.ts`; sprite-level missing `End` → `SF0173` (`control.test.ts:133,140`, well-formed control case included). T-MOD-024 unlabeled. |
| 040-14 | Model integration + dump | ✅ | `dump` verb + `model-dump.ts` conform to §3.6 (R044–R048): three modes, field order `format, formatVersion, source, model, dictionary, timeline, initActions, control, diagnostics`, maps → sorted arrays, no timestamps/paths, `--out` writes exactly `model.json`, exit codes via CMP-R029. T-MOD-037/038/039/040 ✅. |

### 3.2 Doc 040 test obligations (28)

**Labeled and passing: 13** — T-MOD-021, 022, 025, 029, 031, 032 (×2), 033, 035, 036 (shared `T-MOD-022/036` label), 037, 038, 039, 040.

**Content-covered but unlabeled (11):** 013 (background), 014 (label association/dup — SF0153 probed), 015 (scene collapse — `model.test.ts:280`), 016 (export map — model tests), 020 (scaling grid — code only, no test), 023 (metadata biconditional — SF0163 test), 024 (missing `End` — SF0173 test), 026 (ImportAssets SWF 8+ — code only), 027 (root class — code only), 028 (metadata at-most-once — SF0163 test; `SF0164` duplicate untested), 034 (FileAttributes placement/legacy bit — SF0175/SF0176 tests).

**Missing (4):** 017, 018 (no code — P2-04), 019 (P5 scope), 030 (named-anchor shell data — no test for the anchor byte; see P2-11).

### 3.3 Done criteria (doc 040 §10)

1. Every tag has a decoder, an `apply`, and a fixture — ⚠️ decoders ✅ for all §1 rows; imports decode but are never applied/resolved (P2-04).
2. FileAttributes per R031/R032 with the bit-order traps tested; AVM2 detection either-signal, offset named, exit 3 — ✅ (T-MOD-021 + `control.test.ts:108,118`).
3. Multi-movie imports resolve without copying; SWF 8+ deprecation honoured; cycle detected — ❌ (P2-04).
4. `SetTabIndexOp` exported, in `FrameModel.ops` file order, empty-depth no-op reported — ✅.
5. Manifest carries background+changes, scenes, anchors, metadata verbatim, tab-index ops, scaling grids, binary assets; `verify` checks references — ⚠️ all fields present in the dump; the `verify` verb does not exist; binary assets are size+digest, not bytes (P2-12).
6. No password or reserved-bit value lost or leaked — ✅ digests only; reserved bits recorded verbatim; redaction asserted by tests.

---

## 4. Doc 100 — buttons (`IMPL-100`) — entirely unimplemented (known, re-verified)

**❌ No implementation exists.** There is no `buttons/` module anywhere in `packages/swf/src` (no
`button-record.ts`, `define-button.ts`, `define-button2.ts`, `button-cond-action.ts`,
`button-model.ts`, `button-sounds.ts` or equivalents). `DefineButton` (7), `DefineButton2` (34),
`DefineButtonSound` (17) and `DefineButtonCxform` (23) are registered in `tag-codes.ts` and
`movie.ts` assigns `kind: 'button'` via `BUTTON_TAGS`, but **the button bodies are never decoded** — a
button character is a kind label with an opaque payload. Consequences:

- All nine `SF0130`–`SF0138` codes are registered (`severity` matching the doc §7 table) but **dead** —
  confirmed by the exhaustive registry sweep in §6.2.
- All 17 tests `T-MOD-801`–`T-MOD-817` are absent; all 10 WPs (26 d) unstarted.
- Doc 100 §11 done criteria 1–4 are all unmet.
- `SF0110` is shared with doc 100 ("a button state refers to an unknown character id") — the button-state
  half is likewise unmet.
- The roadmap §2.2 "implemented so far" P2 row still omits doc 100 from the open list without flagging it
  (the prior audit's documentation complaint, still standing).

This unmet criterion is the phase's single largest gap (~26 d per the document's own estimate).

---

## 5. Exit criterion 4 — `tools/tag-coverage` (known, re-verified)

`tools/` contains only `audit_dev.py`, `gen_status.py`, `test_audit_dev.py`, `verify_docs.py`, `README.md`.
There is **no `tools/tag-coverage`** and no equivalent report anywhere in the repo, so "every AVM1-era tag
dispositioned" has no machine-checkable output. The data the report needs exists
(`TagIndex.histogram` + the accepted-in-sprite tag set used for `SF0129`), so this is a ~1 d tooling gap,
not a data gap.

---

## 6. Findings (input to the Resolution Audit)

Severity: **H**igh (exit criterion) / **M**edium (spec rule unmet with user-visible reporting gap) /
**L**ow (edge-case rule unmet or surface deviation) / **I**nfo (documentation/label hygiene).

| ID | Sev | Finding | Spec authority | Status |
| --- | --- | --- | --- | --- |
| **P2-01** | H | Buttons entirely unimplemented — no decoders, no `ButtonModel`, no `SF0130`–`SF0138` emission, no `T-MOD-801`–`817`. Exit criterion 3 unmet. | IMPL-100 in full; roadmap §6 P2 row 3 | known (prior audit §3.3) — re-verified, no change |
| **P2-02** | H | `tools/tag-coverage` absent — no all-AVM1-era-tags-dispositioned report. Exit criterion 4 unmet. | roadmap §6 P2 row 4; IMPL-140 | known — re-verified, no change |
| **P2-03** | M | Clip events/actions unimplemented (WP-030-06): no CLIPEVENTFLAGS record, no CLIPACTIONS framing, no `ActionRecordSize` validation; clip actions kept as a raw `ActionBlockRef` instead of the §3 `ClipActions` type; `SF0115`/`SF0118`/`SF0119`/`SF0125` dead; done-criterion 030#3 and T-MOD-007/008 unmet. | IMPL-030 §5 (R026–R030), §6 rows, §13#3 | known — re-verified, no change |
| **P2-04** | M | Multi-movie import resolution absent: no input set, no no-copy aliasing `{localId, sourceMovie, sourceId}`, no cycle detection; `applied` always `false`; `SF0150`/`SF0155` dead; done-criterion 040#3 and T-MOD-017/018 unmet. (The CLI currently has no multi-movie input at all — the resolution must also decide the input-set surface, e.g. `forge.config.input.others` per IMPL-040 §3.3.) | IMPL-040 R020/R021, §6, §10#3 | known — re-verified, no change |
| **P2-05** | M | `PlaceObject3` omits the two placement checks `PlaceObject2` performs: depth ≥ 16384 → `SF0112` (info) and `ClipDepth` ≤ own depth → `SF0113` (warning). The §6 rows are phrased generically ("placement depth ≥ 16384"; "clip-depth value does not exceed its own depth"), so the rule covers all placement forms. `place.ts` PO2 branch emits both; the PO3 branch emits neither. | IMPL-030 §6 rows `SF0112`/`SF0113`, R012/R013 | **new** |
| **P2-06** | M | Test process is red: `corepack pnpm test` exits **1** with 3 unhandled rejections (`AbortError: The operation was aborted`) leaking from `openSwfAsync`'s decompression-cap path (`open.ts:318`, `reader.cancel()` on Node's webstreams adapter) — triggered by the container cap tests (`container.test.ts:355` 256 KiB cap; `:564`). All 238 tests pass; the leak is process-level. CI's test job will fail on this alone. P1-scope code, but it breaks the shared gate today. | REPO gate hygiene; R007 cap path | **new** (prior audits recorded "238/238 ✅" without the exit code) |
| **P2-07** | L | `SF0174` dead: `ExportAssets`/`SymbolClass` entries naming a character id absent from the dictionary are neither reported nor resolved through the `missing`-placeholder policy. | IMPL-040 R015, §6 row `SF0174` | new (prior audit listed it only as an unmet rule, not as a dead code) |
| **P2-08** | L | Scene data inside a sprite is silently dropped — never recorded as the single implicit scene R013 mandates, and `SF0169` is only ever emitted for offset inconsistencies on the main timeline. The §6 row explicitly names the in-sprite case ("…or inside a sprite"). | IMPL-040 R013, §6 row `SF0169` | **new** |
| **P2-09** | L | Trailing `FrameLabel` after the final `ShowFrame`: the per-timeline `labels` map gets an entry pointing at a frame index that is never pushed (dangling lookup), and the label is then retroactively renamed onto the *previous* frame (`timeline.ts` else-if, with a comment stating the inverse of the rule — R008 says a `FrameLabel` associates its name with the **next** `ShowFrame`, "the frame about to be shown"). Mid-timeline label association is correct (label at frame index N, frame N pushed by the next `ShowFrame`); only the trailing edge case is inconsistent — the retroactive rename onto frame N−1 directly contradicts R008, and the dangling `labels` entry does not resolve. | IMPL-040 R008; IMPL-030 §3 `FrameModel.label` | **new** |
| **P2-10** | L | Repeated `DefineScalingGrid` for one character: the shadowed rect is not reported (silent `Map.set` overwrite). | IMPL-040 R028 ("the last one wins and the shadowed rect is reported") | **new** |
| **P2-11** | L | Named-anchor byte semantics deviate from R009: R009 defines presence by *one byte remaining after the null terminator* and says any value other than 1 is `SF0165` **but still treated as an anchor**. The implementation: byte `0` → silently "no anchor", no diagnostic; any other stray value → `SF0165` emitted but `namedAnchor = false`. | IMPL-040 R009, §6 row `SF0165` | **new** |
| **P2-12** | L | `DefineBinaryData` payload bytes are discarded — the model retains `length` + `digest` in `control.binaryData` but no `binary` asset `{id, bytes}` is registered in the dictionary, and `SF0179` (a `SymbolClass` name pointing at a binary character, inert in AVM1) is dead. The decoder itself (added since the prior audit) is correct and tested. | IMPL-040 R038, §6 row `SF0179` | partly known (prior audit: decoder absent; now present, asset registration still missing) |
| **P2-13** | I | Surface model-API deviations from the spec interfaces: `PlacementOp`/`RemovalOp` `origin: TagRef` → `tagOffset: number` (byte offset); `clipActions: ClipActions` → `ActionBlockRef`; `blendMode: BlendMode` (APP-§6 named union) → `number`. Same pattern as the P1 audit's `SwfFile.dictionary` → `SwfFile.definitions` finding — behaviour-equivalent, documented type absent. | IMPL-030 §3 | known pattern (P1 audit §4.4); enumerated precisely here |
| **P2-14** | I | Test-label debt: doc 030 6/16 labeled, doc 040 13/28, doc 100 0/17; 11 doc-040 obligations are content-covered but unlabeled; doc 030 done-criterion #2 (flag-combination corpora) has no fixtures at all; `SF0127` (strict-timeline empty-depth removal) unemittable — no `--strict-timeline` mode exists. | IMPL-030 §10/§13, IMPL-040 §7 | known (prior audit §5 item 9) — counts updated |
| **P2-15** | I | Doc/registry errors: (a) IMPL-040 §6 row `SF0156` ("invalid scaling grid (dropped: < 1 twip, bad rect order)") duplicates the `SF0167` case that R028 assigns to `SF0167` — and `SF0156` is **absent from the code registry** (`codes.ts` has no row; the T-SWF-024 parity test only checks registry→doc, so a doc-defined code missing from the registry slips through); (b) roadmap §2.2 P2 row omits doc 100 from the open list; (c) roadmap demo lines `inspect --timeline` / `verify` name verbs that do not exist (the `dump` verb provides the timeline view). | IMPL-040 §6; roadmap §2.2/§6 | partly known (b, c from prior audit §5) — (a) new |

### 6.1 Exit-criterion consequence

The phase is **not exitable**: criteria 3 and 4 are hard-fail; criterion 1 carries P2-05; criterion 2
carries P2-08/P2-09. P2-06 independently fails the CI test job.

### 6.2 Dead P2-range diagnostic codes (registered but zero src/test usage outside `codes.ts`; plus one doc-defined code never registered)

Verified by exhaustive sweep of every P2-range code in the registry (`SF0110`–`SF0179`) against every
file in `packages/swf/src|test` and `apps/decompiler/src|test`:

| Code | Name | Owner | Why dead |
| --- | --- | --- | --- |
| `SF0111` | `PLACEMENT_BOUNDS_DEGENERATE` | 030 (renderer half) | bounds assembly is P4 (GFX) — not a P2 defect; noted for the sweep |
| `SF0115` | `CLIP_ACTIONS_NO_FLAGS` | 030 | P2-03 |
| `SF0118` | `CLIP_RECORD_SIZE_MISMATCH` | 030 | P2-03 |
| `SF0119` | `CLIP_ACTIONS_RESERVED` | 030 | P2-03 |
| `SF0125` | `CLIP_ACTIONS_NON_SPRITE` | 030 | P2-03 |
| `SF0127` | `REMOVAL_EMPTY_DEPTH` | 030 | no `--strict-timeline` mode (P2-14) |
| `SF0130`–`SF0138` | (9 button codes) | 100 | P2-01 |
| `SF0150` | `IMPORT_UNRESOLVED` | 040 | P2-04 |
| `SF0155` | `IMPORT_ALIAS_CYCLE` | 040 | P2-04 |
| `SF0156` | — (no registry row) | 040 | defined in doc §6 but absent from `codes.ts`; duplicates the `SF0167` case (P2-15a) |
| `SF0174` | `EXPORT_ID_UNDEFINED` | 040 | P2-07 |
| `SF0179` | `SYMBOLCLASS_BINARY_DATA` | 040 | P2-12 |

18 P2-scoped dead codes (5 × doc 030, 9 × doc 100, 4 × doc 040) + 1 renderer-scope (`SF0111`) +
1 doc-defined-but-unregistered code (`SF0156`).
`audit_dev.py`'s baseline carries the `SF0130`–`0138`/`SF0150`/`SF0155`/`SF0174`/`SF0179` subset as
`ownership.unmapped`; this sweep is the authoritative list for the resolution audit.

---

## 7. Ranked gap list (what "done" still requires — input to the Resolution Audit)

1. **P2-01 — doc 100 buttons, entire phase (≈26 d):** BUTTONRECORD v1/v2 reader (state bits, filters/blend
   parity with PlaceObject3), `DefineButton` (incl. the v1-only trailing action records — per doc 100 v1.1
   changelog) / `DefineButton2` (`TrackAsMenu`, `ActionOffset` base), CONDACTION chain + condition/key table
   (nine transitions, push-vs-menu tracking, keys 1–19 + ASCII 32–126), `DefineButtonSound`
   (four-transition order), `ButtonModel` state/hit-area; `SF0130`–`SF0138`; T-MOD-801–817.
2. **P2-04 — multi-movie imports (≈2–3 d):** input-set surface (CLI/config), no-copy aliasing with
   transitive resolution, cycle detection → `SF0155`, unresolved → `SF0150`; T-MOD-017/018. Decide and
   document the input-set shape (IMPL-040 §3.3) as part of the resolution.
3. **P2-03 — clip events/actions (≈3 d):** CLIPEVENTFLAGS 2/4-byte record, CLIPACTIONS framing with
   `ActionRecordSize` validation → `SF0118`, reserved → `SF0119`, no-handler-flags → `SF0115`,
   non-sprite target → `SF0125`; round-trip incl. a deliberately wrong `ActionRecordSize` (T-MOD-007/008).
4. **P2-06 — test gate (≈0.5 d):** contain the `AbortError` from `openSwfAsync`'s cap path (the
   `reader.cancel()` after the cap trip rejects inside Node's webstreams adapter); re-run must exit 0 with
   0 unhandled rejections. This also corrects the gate record in `P1-REPEAT-AUDIT.md` §3.
5. **P2-05 — PO3 checks (≈0.5 d):** emit `SF0112` (depth ≥ 16384) and `SF0113` (`ClipDepth` ≤ own depth)
   in `decodePlaceObject3`, matching PO2; one fixture each.
6. **P2-02 — `tools/tag-coverage` (≈1 d):** consume `TagIndex.histogram` + the accepted-tag sets; emit the
   all-AVM1-era-tags-dispositioned report; wire into CI (`audit` job) with a baseline.
7. **P2-07/08/09/10/11/12 — rule completions (≈1.5 d total):** `SF0174` unknown-export-id (placeholder
   policy); in-sprite scene data → implicit scene + `SF0169`; trailing-`FrameLabel` frame formation (drop
   the dangling `labels` entry or push the empty frame); shadowed scaling-grid rect report; anchor-byte
   presence semantics per R009; `binary` asset `{id, bytes}` registration + `SF0179`.
8. **P2-14 — test labels (≈2 d):** relabel the 11 content-covered doc-040 tests + the doc-030 edge tests
   (T-MOD-010/011/012/603); write the genuinely missing ones (T-MOD-001/002/004 corpora incl. the
   32-combo PO2 / 16-bit PO3 flag corpora); decide the `--strict-timeline` mode or amend R025/SF0127.
9. **P2-15 — doc fixes (≈0.5 d):** remove/retarget the `SF0156` row; roadmap §2.2 P2 row → flag doc 100
   open; roadmap demo lines → name `dump` (or add the missing flags).

Total ≈ 38–41 d per the documents' own estimates (doc 100 alone is 26 d).

---

## 8. What is genuinely solid (to protect from regression)

- **PO3 field order** verified byte-for-byte against APP-§10.1, including the conditional `ClassName`,
  `HasImage` class-vs-character distinction, the E-008 opaque-background rule (HasVisible-only consumes no
  RGBA), and `ClipActions` last — pinned by T-MOD-009.
- **All 8 filters** decode with authored units (FIXED/FIXED8/float32, pass-bit widths per §5), unknown-id
  raw-tail retention with list-incomplete marking, and `CompositeSource=0` honoured with `SF0122`.
- **Timeline assembly**: single ordered `ops` list in file order (R031), per-tag bounded cursors,
  declared-wins frame padding (T-SWF-020/T-MOD-601), `SF0110` undefined-character placeholder, `SF0153`
  duplicate-label first-wins, stream-sound spans with `SF0032` ordering check.
- **Control-tag decoders** (completed since the prior audit): `DefineBinaryData` (reserved word, blob cap,
  bytes never strings), `Protect`/`EnableDebugger(2)`/`EnableTelemetry` (digest-only passwords, redaction
  asserted), `FileAttributes` LE word + legacy `NoCrossDomainCache` bit (`SF0176`), not-first (`SF0172`),
  in-sprite (`SF0175`), sprite missing-`End` (`SF0173`), AVM2 dual-signal `SF1000` with named offset.
- **Export/label/scene policies**: duplicate-id last-name-wins with shadow kept, duplicate-name
  first-id-wins, main-timeline scene normalization (start-at-0/monotonic/deduped/clamped, `SF0169`),
  scene-relative label remap, merged label lists in deterministic order.
- **Dump contract** (R044–R048): byte-deterministic JSON, sorted maps, fixed field order, `--out` writes
  exactly `model.json`, CMP-R029 exit codes — all four dump tests pass.
- **Registry hygiene**: every *emitted* P2 code is registered with the owning doc's severity
  (`diagnostics.test.ts` enforces registry↔doc parity); range split matches STATUS.md §2.

*Evidence paths are relative to the repository root. All test IDs and diagnostic codes cited were grepped
across `packages/**` and `apps/**` (excluding `dist/`); "absent"/"dead" means zero references anywhere in
code or tests outside `packages/swf/src/diagnostics/codes.ts`.*
