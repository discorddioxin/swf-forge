# P1 / P2 Integrity Audit

**Date:** 2026-10-04 · **Auditor:** agent · **Branch:** `arena/01a10928-swf-forge`
**Scope:** P1 (Container & dictionary — `IMPL-020`) and P2 (Model & timeline — `IMPL-030`, `IMPL-040`, `IMPL-100`)
**Authorities:** `docs/impl/000-roadmap.md` (§2 phase table, §2.2 "implemented so far", §6 exit criteria, §10 WP index),
`docs/impl/foundation/020-container-tag-stream-dictionary.md`, `docs/impl/decompiler/030|040|100-*.md` (test obligations, done criteria),
`docs/impl/harness/140-conformance-harness.md` (writer/fuzz), `.github/workflows/ci.yml`.

**Method:** every work package and test obligation was cross-referenced against code (`packages/swf/src/**`,
`apps/decompiler/src/**`), tests (`packages/swf/test/**`, `apps/decompiler/test/**`), the diagnostic registry
(`packages/swf/src/diagnostics/codes.ts`), tooling (`tools/`, CI), and then executed:
`vitest run packages/swf apps/decompiler` → **69/69 pass (10 files)**.
The working tree contains only in-progress P5 (AVM1) changes (`packages/avm1/`, additive `SF04xx` codes); P1/P2 code is unmodified.

---

## 1. Verdict summary

| Phase | Verdict | Exit criteria met (roadmap §6) |
| --- | --- | --- |
| **P1** Container & dictionary | **Substantially implemented, but NOT complete.** Core open/framing/index/dictionary/CLI path is real, tested, and faithful to `IMPL-020`. Two work packages are missing entirely (ordering validation, LZMA adapter — both admitted as open in roadmap §2.2), the ZWS container cannot be parsed, and 9 of 14 test obligations are absent. | 1 of 4: length policy ✅ · lazy index ✅ (within "FWS/CWS/ZWS all parse" — ZWS ❌) · ordering ❌ · fuzz ❌ |
| **P2** Model & timeline | **The placement/timeline/control-tag/model/dump core is implemented well and matches spec; buttons (doc 100) are entirely absent.** Of the four §6 exit criteria: ordered `PlacementOp[]` ✅, sprite/labels/scenes/exports ✅ (dump golden exists), buttons ❌, tag-coverage report ❌. Test-obligation coverage: doc 030 6/16 labeled, doc 040 7/28 labeled, doc 100 0/17. | 2 of 4 |

**Bottom line:** P1 is roughly 75–80% of its documented scope in *code* but fails its exit gate on ordering,
ZWS, and fuzz. P2's *model* work is solid and honest (the roadmap's §2.2 evidence claims are accurate for what it
lists), but the P2 **phase** is not exitable: doc 100 (buttons, 10 WPs / 26 d / 17 tests) has no implementation,
no diagnostics, no tests, and the `tools/tag-coverage` deliverable does not exist.

---

## 2. P1 — Container & dictionary (`IMPL-020`)

### 2.1 Work-package status

| WP | Title | Status | Evidence |
| --- | --- | --- | --- |
| 020-01 | Signature detect + FWS/CWS open | ✅ | `packages/swf/src/container/open.ts` (`openSwf`, `openSwfAsync`, `compressionOf`), `container/header.ts`, `node/inflate.ts` (zlib), CWS exercised in `apps/decompiler/test/inspect.test.ts` ("opens a CWS file through the Node inflater") |
| 020-02 | Bounded/incremental decompression + caps | ✅ (code) / ❌ (test) | `nodeInflate` uses `inflateSync({ maxOutputLength })` → `SF0007`; `openSwfAsync` caps per-chunk. **No 512 MiB bomb test** (`T-SWF-011` absent) |
| 020-03 | ZWS/LZMA adapter | ❌ **MISSING** | No `compress/lzma.ts` / `decompress/lzma.ts`; `node/` ships zlib only. Graceful degradation exists (`SF0006` + empty body, `open.ts:186–199`) satisfying R009's fallback, but **no ZWS file can actually be parsed** — P1 exit criterion "FWS/CWS/ZWS all parse" fails on ZWS. Roadmap §2.2 admits this |
| 020-04 | Header parse + validation | ✅ | `header.ts`: `SF0021`/`SF0022`/`SF0028`/`SF0029`/`SF0033`, version floor `SF0002`, R011 length policy with `--strict` promotion (`DECOMPRESSED_LONGER/SHORTER`), raw 8.8 `FrameRate` kept (`T-SWF-023` content pinned in `fixture.test.ts`) |
| 020-05 | Tag framing + index build | ✅ | `tag-stream.ts`: short/long `RECORDHEADER` (R015 word-split), `SF0030` long-under-63, `SF0101` past-end, `SF0104` unknown-by-length. Framing pinned by `framing.test.ts` `readTagHeader` tests (`43 00`/`03 01`/long form); **62/63 boundary case not explicitly pinned** |
| 020-06 | Sprite nesting walk | ✅ (code) / ❌ (test) | Explicit stack (no recursion), depth cap 32 → `SF0103` (`tag-stream.ts` sprite branch). **No T-SWF-008 depth 31/32/33 fixture**; deepest fixture nesting is 1 level (`model.test.ts:61`) |
| 020-07 | Dictionary + exports + placeholders | ✅ (re-homed) / ⚠️ API deviates | Definition entries in stream order, `SF0107` id-0, `SF0109` duplicate last-wins (tested: `inspect.test.ts` T-SWF-007), cap `SF0031`, `SF0110` undefined-reference + `kind: 'missing'` placeholder (`movie.ts:444`). **Deviation:** doc 020 §3's `SwfFile.dictionary: Dictionary` public API does not exist — `SwfFile` exposes `definitions: DefinitionEntry[]` and the `CharacterModel`/export map moved into the P2 model layer (`model/movie.ts`). Functionally equivalent; API-wise a spec deviation |
| 020-08 | **Ordering validation (5 rules)** | ❌ **MISSING** | No `container/ordering.ts`. `Codes.TAG_ORDER_VIOLATION` (SF0026) and `Codes.FILE_ATTRIBUTES_NOT_FIRST` (SF0025) are **registered but never emitted anywhere** (grep: only `codes.ts`). Rule status: (1) FileAttributes-first — **not checked**; (2/3) definition-before-use — **not checked**; (4) stream sound order — partial, model-level only (`timeline.ts:167`, head-before-block, no ascending-frame check); (5) End-last — ✅ `SF0024` in `tag-stream.ts`. **T-SWF-019 absent.** Doc 020 done-criterion #3 ("all five rules have a fixture") fails |
| 020-09 | Processing-order contract + DoInitAction | ⚠️ Partial | `DoInitAction` collected into `model.initActions` (`movie.ts:309`, `InitActionBlock[]`) — but in the model layer, not `container/processing.ts`. The R034 processing-order enum/sequence contract is **not exported anywhere**. `SF0421`/`SF0422` (duplicate/unknown-sprite DoInitAction) are **dead codes — never emitted** |
| 020-10 | `SwfFile` facade, lazy memoised `readTag` | ✅ | `open.ts`: `indexStrategy: 'lazy'`, memo per `TagRef.index`, zero-copy views. Tested by `T-SWF-018` (`fixture.test.ts:56`, `framing.test.ts:23`) |
| 020-11 | Truncation/fuzz corpus generator + `swffuzz` | ❌ **MISSING** | No `test/fuzz/`, no fuzzer, no crasher corpus. `ci.yml` has **no fuzz job** (only verify/spec/test/build/lint/audit). The `IMPL-020-R037` writer `defects:` option is absent — `test-support/writer.ts` builds FWS files from raw bodies only (no `defects`, no zlib fixtures in the writer). **T-SWF-002 (truncation at every byte offset) absent** |
| 020-12 | `inspect --tags/--symbols` CLI | ✅ (functional) / ⚠️ flags absent | `apps/decompiler/src/commands/inspect.ts` always prints tag histogram, characters, definitions (with shadowed/winner), labels, diagnostics — i.e. `--tags --symbols` content with no flags (`cli.ts` has only `--json/--verbose/--strict/--tolerate-length/--out`) |

### 2.2 P1 test obligations (doc 020 §10 — 14 tests)

| Obligation | Status | Where |
| --- | --- | --- |
| T-SWF-001 header matrix | ⚠️ Partial | FWS/CWS covered; version/fps matrix not systematic; `framing.test.ts` T-SWF-001 label is actually the SF0006/ZWS test |
| T-SWF-002 truncation at every offset | ❌ | — |
| T-SWF-003 framing | ✅ | `framing.test.ts` `readTagHeader` (62/63 boundary not explicit) |
| T-SWF-007 duplicate/missing chars | ✅ | `inspect.test.ts:76` |
| T-SWF-008 sprite nesting 31/32/33 | ❌ | — |
| T-SWF-010 all emitted codes in range | ⚠️ Close | `diagnostics.test.ts` checks registry↔doc severity (labeled T-SWF-024) and row-per-code; not an emitted-in-range run |
| T-SWF-011 512 MiB bomb | ❌ | — |
| T-SWF-012 determinism (open) | ⚠️ Weak | `model.test.ts:190` covers model id fallback only, not tag index/dictionary/diagnostics |
| T-SWF-018 lazy index + memo | ✅ | `fixture.test.ts:56` |
| T-SWF-019 ordering fixtures | ❌ | — |
| T-SWF-020 showFrame/FrameCount policy | ⚠️ Content only | `model.test.ts:90,198` (sprite + main padding to declared) — unlabeled |
| T-SWF-021 zero-copy views | ❌ | No `byteOffset`-inside-buffer assertion |
| T-SWF-022 Appendix A tag walk | ⚠️ Content only | `fixture.test.ts:44` pins `[9, 2, 26, 1, 0]` + long-header tag 2 — unlabeled (file header says T-TST-101) |
| T-SWF-023 Appendix A header | ⚠️ Content only | `fixture.test.ts:22,31` (v3, 79 B, 550×400, 12.0 fps, 1 frame) — unlabeled |

**Labeled-and-passing: 4 (003, 007, 018 + 001-partial). Content-covered-unlabeled: 3 (020, 022, 023). Missing: 7 (002, 008, 010, 011, 012, 019, 021).**

### 2.3 P1 exit criteria (roadmap §6)

| Criterion | Met? | Notes |
| --- | --- | --- |
| FWS/CWS/ZWS all parse; length-mismatch policy = SWF-R009 | ❌ | FWS ✅, CWS ✅, **ZWS ❌** (no LZMA decoder; `SF0006` error path only). Length policy ✅ (`header.ts`, tested via `--strict`/`--tolerate-length`) |
| Tag index lazy; sprite ranges recorded | ✅ | T-SWF-018; `spriteRanges`/`frameCounts` in `TagIndex`, consumed by `movie.ts:379` |
| Ordering violations detected and reported ("SF0120 range") | ❌ | No checks exist (see 020-08). **Doc error:** the "SF0120 range" in roadmap §6 contradicts doc 020 §9, which assigns the ordering diagnostics to `SF0025`/`SF0026`/`SF0032` — `SF0110–SF0129` is the *placement* range owned by doc 030. The code registry follows doc 020; the roadmap line is the one that is wrong |
| Fuzz smoke: 10⁴ mutations, zero uncaught, CI | ❌ | No fuzzer, no CI job |

---

## 3. P2 — Model & timeline (`IMPL-030`, `IMPL-040`, `IMPL-100`)

### 3.1 Doc 030 — placements, filters, sprites (12 WPs)

| WP | Title | Status | Evidence |
| --- | --- | --- | --- |
| 030-01 | Shared placement field reader | ✅ | `tags/place.ts` (order per APP-§10.1: depth → class → char → matrix → cxform → ratio → name → clipDepth → clip actions) |
| 030-02 | PlaceObject v1 + CXFORM tail + id-0 tolerance | ✅ code / ❌ test | `decodePlaceObject` (tail CXFORM iff ≥3 bytes, `SF0117` id-0 move per E-010). **T-MOD-001 absent** |
| 030-03 | PlaceObject2 move matrix | ✅ code / ❌ test | `decodePlaceObject2` (all 8 flags, `SF0113` clip-depth, `SF0112` dynamic depth, `SF0126` no-op). **T-MOD-002 absent**; no 32-combination flag corpus (doc 030 done-criterion #2) |
| 030-04 | PlaceObject3 | ✅ | `decodePlaceObject3`: second flag byte, ClassName-before-CharacterId, backing fields, E-008 (HasVisible-only consumes no RGBA). Tested: T-MOD-009 (two tests) + T-MOD-010 content in `place-filters.test.ts` |
| 030-05 | All 8 filters | ✅ | `tags/filters.ts` (332 lines, units preserved). Tested: T-MOD-005 (all 8 layouts) + T-MOD-006 (unknown id/params) |
| 030-06 | CLIPEVENTFLAGS + CLIPACTIONS framing | ❌ **MOSTLY MISSING** | Clip actions are preserved as a raw byte range (`ActionBlockRef`, `place.ts:112,177,283`) for the AVM1 stage. No CLIPEVENTFLAGS record decode, no CLIPACTIONS record framing, no `ActionRecordSize` validation. `SF0115`/`SF0118`/`SF0119`/`SF0125` are **dead codes — never emitted**. T-MOD-007/008 absent; done-criterion #3 (round-trip incl. wrong `ActionRecordSize`) unmet |
| 030-07 | Remove/ShowFrame decoders | ✅ | `decodeRemoveObject(2)`; frame closing in `assembleTimeline`. T-MOD-003 ✅ |
| 030-08 | Sprite model + nested timelines | ✅ | `movie.ts` (one nested timeline per `DefineSprite`), `SF0128`/`SF0129`, `SF0023` mismatch + declared-wins padding. T-MOD-601 ✅; **T-MOD-011 (empty sprite, missing End) and T-MOD-603 (stream-sound spans) untested** (span recording code exists: `timeline.ts` `streamSoundSpans`) |
| 030-09 | Frame assembly, ordered ops | ✅ | `model/timeline.ts` — `FrameModel.ops` in file order, labels, actions, spans. Gated by dump goldens (T-MOD-037) and model tests |
| 030-10 | `inspect --timeline` + goldens | ⚠️ Replaced | **No `--timeline` flag exists** (`cli.ts` flags: `--json/--verbose/--strict/--tolerate-length/--out`). The functionality lives in the `dump` verb (`dump/model-dump.ts:578–600` renders every frame's ops for main + each sprite; T-MOD-037/038/039/040 ✅). Phase demo line "inspect --timeline" is not literally satisfied |
| 030-11 | Ch.3 conformance corpus (flag combos) | ❌ | No systematic PlaceObject2/3 flag-combination fixture suite |
| 030-12 | Sprite naming + SetTarget grammar + sound spans | ⚠️ Partial | Tag-set rule ✅ (SF0128/0129); `Name` decoded verbatim ✅; sound spans ✅ (untested); **SetTarget path grammar over a nested fixture (T-MOD-602) absent** — SetTarget resolution sits in P5 (`packages/avm1`), not the model |

**Labeled tests: 003, 005, 006, 009, 010, 601 = 6/16. Missing: 001, 002, 004, 007, 008, 011, 012, 602, 603, 604.**

### 3.2 Doc 040 — control tags & metadata (14 WPs)

| WP | Title | Status | Evidence |
| --- | --- | --- | --- |
| 040-01 | Background | ✅ | `decodeSetBackgroundColor`; `model.background`; covered by `model.test.ts` appendix test (T-MOD-013 unlabeled) |
| 040-02 | Frame labels + named anchors | ✅ | `decodeFrameLabel` (anchor byte, `SF0165`); `control.labels` + `labelEntries`. T-MOD-029 ✅ (`dump.test.ts:133`); T-MOD-014/027 unlabeled |
| 040-03 | Scenes + merge order | ✅ | `decodeSceneAndFrameLabelData` + `normalizeScenes` (`SF0169`); tested in `model.test.ts:207` (T-MOD-015/026 unlabeled) |
| 040-04 | Export map hardening | ✅ | `decodeExportAssets`/`decodeSymbolClass` (dup id `SF0159`, dup name `SF0160`, `SF0154`); tested `model.test.ts:99` (T-MOD-016 unlabeled) |
| 040-05 | Imports + multi-movie + alias cycle | ⚠️ Partial | `decodeImportAssets` (`SF0161` SWF 8+ no-effect, `SF0162` reserved). **Multi-movie input-set resolution (T-MOD-017) and alias-cycle detection (T-MOD-018) absent** — `buildMovieModel` takes a single `SwfFile` |
| 040-06 | FileAttributes + AVM2 detection | ✅ | `decodeFileAttributes`; dual signal → `SF1000` exit 3. T-MOD-021 ✅ (`model.test.ts:113`). FileAttributes-not-first check is the missing P1 ordering rule (`SF0025` dead) |
| 040-07 | ScriptLimits | ✅ | `decodeScriptLimits` + `SF0170`; covered by `model.test.ts:207` (T-MOD-019 unlabeled) |
| 040-08 | SetTabIndexOp | ✅ | `decodeSetTabIndex` → `kind: 'tabIndex'` op in `FrameModel.ops` + `tabIndexOps`; empty-depth `SF0166`. T-MOD-025 ✅; T-MOD-039 asserts both places |
| 040-09 | DefineScalingGrid | ✅ | `decodeDefineScalingGrid` + `SF0167`/`SF0168` (T-MOD-020 unlabeled; no dedicated fixture) |
| 040-10 | DefineBinaryData | ❌ **MISSING** | No decoder. Recognised only as character kind `'binaryData'` (`movie.ts:87`, `tag-codes.ts`). T-MOD-022/036 absent |
| 040-11 | Metadata/Protect/debugger/telemetry | ⚠️ Partial | `decodeMetadata` (`SF0163` biconditional tested `model.test.ts:245`; `SF0164`) ✅; `decodeProtect` exists (T-MOD-031 unlabeled). **No decoders for `EnableDebugger`(58), `EnableDebugger2`(64), `EnableTelemetry`(93)** — T-MOD-032/035/033 absent |
| 040-12 | SymbolClass + root class | ✅ | `decodeSymbolClass` incl. `rootClassName` (T-MOD-027 unlabeled) |
| 040-13 | End validation file + sprite | ⚠️ Partial | File-level `SF0102` ✅ (`tag-stream.ts`); **sprite-level missing-`End` not reported** (a sprite level that hits its limit without `End` closes silently); T-MOD-024 absent |
| 040-14 | Model integration + dump | ✅ | `dump` verb + `model-dump.ts` (637 lines); T-MOD-037 (byte-deterministic, sorted maps) / 038 (`--out`) / 039 (appendix dump) / 040 (exit codes) ✅ |

**Labeled tests: 021, 025, 029, 037, 038, 039, 040 = 7/28. Missing (100% absent): 013–020, 022, 023, 024, 026, 027, 028, 030, 031, 032, 033, 034, 035, 036 — of which several have code but no test (013/014/015/016/019/020/023/027/028/031), and several have no code at all (017, 018, 032, 033, 034, 035 + part of 022/024/026/030).**

### 3.3 Doc 100 — buttons (10 WPs, 26 d, 17 tests)

**❌ Entirely unimplemented.** No button modules (`button-record.ts`, `define-button.ts`, `define-button2.ts`,
`button-cond-action.ts`, `button-model.ts`, `button-sounds.ts` — none exist). `tag-codes.ts` lists
`DefineButton`(7)/`DefineButton2`(34)/`DefineButtonSound`(17)/`DefineButtonCxform`(23) and `movie.ts` assigns
`kind: 'button'`, but **the button bodies are never decoded** — a button character is a kind label with an opaque
payload. No `T-MOD-801`–`817`, no `SF0130`–`SF0139` in the registry (doc 100 owns that range per STATUS.md §2).
The roadmap's §2.2 "implemented so far" table omits buttons from its P2 row *without* flagging them as open
(contrast with P1's explicit "ordering and LZMA adapter WPs remain open") — an understatement in the roadmap.

### 3.4 P2 exit criteria (roadmap §6)

| Criterion | Met? | Notes |
| --- | --- | --- |
| PlaceObject/2/3 → ordered `PlacementOp[]` per frame | ✅ | `timeline.ts` assembly; dump goldens T-MOD-037/039 |
| Sprite tree, labels, scenes, exports resolved (dump on corpus) | ✅ | `model.test.ts` + `dump.test.ts` T-MOD-039 (appendix) + sprite/scene/export tests; "corpus" = appendix fixture + synthetic `buildSwf` files (no broader conformance corpus) |
| Buttons decoded into records + conditions | ❌ | See §3.3 |
| Tag-coverage report, all AVM1-era tags dispositioned (`tools/tag-coverage`) | ❌ | `tools/` contains only `audit_dev.py`, `gen_status.py`, `test_audit_dev.py`, `verify_docs.py`. The `TagIndex.histogram` data needed for the report exists, but no tool consumes it |

---

## 4. Cross-cutting integrity findings

1. **Dead diagnostic codes (P1/P2 ranges):** registered in `codes.ts` but emitted by no code —
   `SF0025` (FileAttributes not first), `SF0026` (ordering violation), `SF0115`, `SF0118`, `SF0119`, `SF0125`
   (all four clip-action codes), `SF0421`, `SF0422` (DoInitAction dup/unknown — these are doc-050 range but
   belong to WP-020-09's collection). Each dead code is a spec promise with no implementation behind it.
2. **Doc/registry consistency is good** where code exists: every *emitted* code is registered, severities match
   the owning doc's table (`diagnostics.test.ts` enforces this against `docs/impl/**/*.md`), and the registry
   range split matches STATUS.md §2. The two doc errors found are in the roadmap, not the impl docs:
   - §6 P1 "new diagnostics `SF0120`-range" for ordering — contradicts doc 020 §9 (`SF0025`/`SF0026`/`SF0032`);
   - §2.2 P2 row omits doc 100 from the open list even though the phase includes it and §6 requires buttons.
3. **Module layout is consolidated, not as drawn:** doc 020 §2's eight container modules are three
   (`open.ts`, `header.ts`, `tag-stream.ts`) plus `node/`; doc 030's eight tag/model modules are
   `tags/{place,filters,control,tag-codes}.ts` + `model/{movie,timeline,types}.ts`. This is an acceptable
   implementation choice, but it means per-WP "deliverable file" claims in the docs no longer map 1:1 — future
   audits should track capabilities, not file names.
4. **Public API deviation:** `SwfFile.dictionary` (doc 020 §3) → `SwfFile.definitions` + model-layer
   `CharacterModel`/`exported` map. Behavior-equivalent; the documented type (`Dictionary.get/entries/failed`)
   does not exist.
5. **Writer/harness gap (doc 140):** the synthetic writer exists (`test-support/writer.ts`) but is FWS-only and
   lacks the `defects:` option doc 020 R037 requires; no fuzzers/corpus/CI fuzz (WP-140-07/09). This blocks
   T-SWF-002, T-SWF-011 and the P1 fuzz exit criterion.
6. **Test suite state:** P1/P2 suites green — `packages/swf` + `apps/decompiler` = **69/69 pass**. (The repo as a
   whole has 4 failing tests, all in the in-progress P5 `packages/avm1/test/regions.test.ts` — outside this
   audit's scope, noted for completeness.)

---

## 5. Ranked gap list (what "done" still requires)

**P1 (≈ 7–9 d of code + tests per the docs' own estimates):**
1. **WP-020-08 ordering validation** (2 d) — `ordering.ts` over the tag index: FileAttributes-first (SF0025),
   definition-before-use for character refs per R033 (SF0026), stream-sound ascending frames (SF0032); T-SWF-019
   with one fixture per rule.
2. **WP-020-03 LZMA adapter** (3 d) — optional lazy `lzma` decoder (e.g. `lzma-native`/`lzma` package behind the
   `inflate` option), `SF0027` advisory `compressedLength` handling; ZWS round-trip test; then "FWS/CWS/ZWS all
   parse" is met.
3. **WP-020-11 fuzz/truncation** (2 d) — writer `defects:` option + truncation-every-offset test (T-SWF-002),
   10⁴-mutation bounded pass in CI, crasher corpus (doc 140 R016/R018).
4. **Missing P1 tests** — T-SWF-008 (nesting 31/32/33), T-SWF-010 (emitted-in-range), T-SWF-011 (bomb; peak-RSS
   bound), T-SWF-012 (full open determinism), T-SWF-021 (zero-copy `byteOffset`), plus relabeling the
   content-covered Appendix A tests as T-SWF-022/023 and the padding tests as T-SWF-020.
5. **WP-020-09 residue** — export the R034 processing-order sequence as data; emit `SF0421`/`SF0422` from the
   DoInitAction collection.

**P2 (≈ 35+ d; doc 100 alone is 26 d):**
6. **Doc 100 buttons — entire phase** (26 d) — record reader (v1/v2, filter/blend parity with PlaceObject3),
   DefineButton/2 (+`ActionOffset`), CONDACTION chain + condition/key table, `ButtonModel` state/hit-area,
   `DefineButtonSound`; `SF0130`–`SF0139`; T-MOD-801–817.
7. **WP-030-06 clip events/actions** (3 d) — CLIPEVENTFLAGS record + CLIPACTIONS framing with `ActionRecordSize`
   validation; resurrect SF0115/0118/0119/0125; T-MOD-007/008.
8. **Doc 040 residue** (~4 d) — `DefineBinaryData` decoder (T-MOD-022/036), `EnableDebugger(2)`/`EnableTelemetry`
   decoders (T-MOD-032/033/034/035), multi-movie import resolution + alias cycle (T-MOD-017/018),
   sprite-level missing-`End` (T-MOD-024), `Metadata`-at-most-once (T-MOD-028), named-anchor shell data
   (T-MOD-030), `ImportAssets` SWF 8+ no-effect fixture (T-MOD-026).
9. **Unlabeled-but-existing P2 tests** — write/attach IDs for T-MOD-001/002 (PlaceObject v1 + move matrix),
   T-MOD-004 (clip-depth boundaries), T-MOD-011/603 (sprite edge cases, sound spans), T-MOD-602 (naming grammar),
   T-MOD-013–020/023/027/031 (control tags: code exists, tests don't).
10. **`tools/tag-coverage`** (~1 d) — consume `TagIndex.histogram` + APP-§2 disposition table; emit the
    all-AVM1-era-tags-dispositioned report required by the P2 exit gate.
11. **CLI shape** — either add `inspect --timeline`/`--tags`/`--symbols` flags (roadmap demo lines) or amend the
    roadmap to name `dump` as the timeline view.

**Documentation fixes (0.5 d):** roadmap §6 P1 "SF0120-range" → "SF0025/SF0026/SF0032 per IMPL-020 §9";
roadmap §2.2 P2 row → add "buttons (doc 100) remain open"; consider a doc 020 §3 note that the `Dictionary` API
is realised through the model layer.

---

## 6. What is genuinely solid (to protect from regression)

- Container core: word-split `RECORDHEADER` (R015), long-header semantics (E-007/R016), truncation keep-tags
  policy (R019), explicit-stack sprite walk with depth cap, lazy memoised zero-copy `readTag`, SF0007 cap
  enforcement inside the inflater, SWF-R009 length policy with `--strict` promotion.
- Appendix A fixture pinned byte-for-byte with header + tag-stream assertions (the project's golden anchor).
- PlaceObject2/3 field order per APP-§10.1 including the E-008/E-010 documented deviations; all 8 filters with
  authored units; PlaceObject3 class/image distinction.
- Frame assembly: file-order ops, declared-frame padding (declared wins), sprite timelines with declared/observed
  counts, scene normalization, export/label dedup policies, `SetTabIndexOp` in-frame.
- `dump` verb: byte-deterministic JSON, sorted maps, `--out` parity, CMP-R029 exit codes — all tested.

*Evidence paths are relative to the repository root. All test IDs cited were grepped across `packages/**` and
`apps/**` (excluding `dist/`); "absent" means zero references anywhere in code or tests.*
