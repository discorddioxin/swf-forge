# P1 integrity & completion audit — Container, Tag Stream, Dictionary, Processing

**Date:** 2026-10-05 · **Branch:** `arena/01a10928-swf-forge` · **Baseline:** HEAD `b3a0647` plus the
uncommitted working tree (41 modified/untracked files: the P1 closeout, P2 control-tag work, and
in-progress P5 AVM1 work). P1's own layer (`packages/swf/src/container/*`, `src/node/*`,
`packages/swf/test/{container,framing,fixture,ordering,fuzz}.test.ts`,
`apps/decompiler` `inspect` verb) is fully present in the working tree and is what this audit reads.
· **Auditor:** AI agent, adversarial re-read of the code as written

**Scope:** phase **P1 — Container & dictionary** (`IMPL-000` §2: format-spec Ch.2; primary doc
`IMPL-020`, supporting doc 140), i.e. everything under

| Deliverable | Location |
| --- | --- |
| `openSwf` / `openSwfAsync` / `openSwfNodeSync` | `packages/swf/src/container/open.ts`, `src/node/open.ts` |
| header parse + validation | `packages/swf/src/container/header.ts` |
| tag framing, indexing, sprite walk, dictionary registration | `packages/swf/src/container/tag-stream.ts` |
| Ch.2 ordering rules | `packages/swf/src/container/ordering.ts` |
| per-frame processing order (R034) | `packages/swf/src/container/processing.ts` |
| zlib / LZMA adapters | `packages/swf/src/node/{inflate,lzma}.ts` |
| CLI surface (WP-020-12) | `apps/decompiler/src/commands/inspect.ts` |

**Authority, in order:** `IMPL-020` (the phase's implementation spec, including its §8/§9
diagnostics tables, §10 test obligations, §11 work packages, §13 done criteria); the format spec
`docs/specs/format/030-swf-format-and-io.md` and `docs/specs/reference/110-appendices-reference-tables.md`
(Ch.2/Appendix B tag table); `IMPL-000` §2/§6 P1 exit criteria; `IMPL-010` for the primitive readers
the container consumes. Where a finding conflicts with the specification, the specification wins —
except where the finding is itself a documentation defect, which is marked as such.

**Method.** Four passes: (1) rule-by-rule read of `IMPL-020` R001–R037 against the code, each rule
located or recorded as unmet; (2) diagnostic-registry conformance for all 26 container codes
(registered? emitted? severity vs §9? test-referenced?); (3) behavioural probes run through vitest
(verbatim outputs in §6); (4) work-package, test-obligation and done-criteria ledgers. The mechanical
house checker `tools/audit_dev.py` was run as well (its ledger is scoped to the earlier `audits/dev`
audit; P1-relevant output in §4.6). `packages/swf` typechecks clean in isolation; the full vitest
suite is green (208/208) after fixing one P5-WIP test assertion in
`packages/avm1/test/movie.test.ts` (SF0422 is emitted during `buildMovieModel`, so the sink check
must run after it — the test was checking before the model build). The tree-wide `pnpm typecheck`
still carries 18 errors, all in in-progress P5 files (7 in
`apps/decompiler/src/commands/inspect.ts`, 5 in `packages/avm1/src/frontend/analyze.ts`, 6 in
`packages/avm1/src/frontend/disassemble.ts`); zero are in P1 code (see §8.2).

---

## 1. Verdict

**P1 is substantively complete and its core is solid — the framing, the explicit-stack sprite walk,
the lazy/memoised `readTag`, the dictionary duplicate policy, all five ordering rules, the LZMA
adapter and the 10⁴-mutation fuzz smoke are implemented and pinned by tests. Against that: one major
data-integrity defect on the malformed-input path (sprite ranges empty for End-less sprites), one
robustness defect in the `--strict` CLI path (uncaught exception where the spec promises a report
and a failure exit), one bounded-memory deviation (LZMA cap checked after full decompression),
and a set of test-evidence and demo-surface gaps that fail or dilute three of the six `IMPL-020`
§13 done criteria.**

| Severity | Count | Ids |
| --- | --- | --- |
| major | 1 | F-01 |
| moderate | 2 | F-02, F-03 |
| minor | 10 | F-04 … F-13 |
| observation | 5 | O-01 … O-05 |

Severity definition (house convention, `audits/dev`): **major** = silent wrong data on input the
specification covers; **moderate** = a `MUST` requirement met only by deviation, or a user-facing
robustness contract broken; **minor** = a single diagnostic, flag, field or test-evidence gap;
**observation** = process/registry risk with no current user-visible effect. No finding is a
security vulnerability, a determinism violation or an `IMPL-020-R001` dependency violation.

---

## 2. Work-package ledger (`IMPL-020` §11)

| WP | Title | Status | Evidence / gap |
| --- | --- | --- | --- |
| WP-020-01 | Signature detect + FWS/CWS open | ✅ done | `open.ts` R005 3-byte case-sensitive match; CWS via `nodeInflate`; ZWS-no-adapter → SF0006 pinned (`framing.test.ts`, `container.test.ts`) |
| WP-020-02 | Bounded, incremental decompression + caps | ✅ done (2 deviations) | `maxOutputLength` (sync zlib), streaming cap (async zlib); T-SWF-011 cap abort + default-cap tests. Deviations: F-03 (LZMA), F-04 (async zero-pad), F-05 (sync partial discard) |
| WP-020-03 | ZWS/LZMA adapter (optional, lazy) | ✅ done | `node/lzma.ts` sync + async lazy load; `openSwfNodeSync` wires SF0006 when the package is absent; SF0027 advisory pinned; round-trip test vs FWS |
| WP-020-04 | Header parse + validation | ✅ done (test gaps) | R011–R014 all implemented (`header.ts`); test evidence partial — F-08, F-09 |
| WP-020-05 | Tag framing + index build | ✅ done | R015–R021; T-SWF-003 pins `43 00`/`03 01` + long form; boundary 62/63 not pinned — F-10 |
| WP-020-06 | Sprite nesting walk (explicit stack, depth cap) | ✅ done (1 defect) | R022–R025; explicit stack, T-SWF-008 depths 31/32/33 + SF0103. Defect: F-01 (range end for End-less sprites) |
| WP-020-07 | Dictionary + export map + placeholders | ✅ done (1 doc defect) | R027 (SF0107), R028 (SF0109 last-wins, both offsets named, shadowed kept — CLI shows it), R029 (`kind: 'missing'` + SF0110 in the model layer, tested), R031 (SF0031). Doc defect: F-07 (R030). Test gap: F-11 |
| WP-020-08 | Ordering validation (5 rules) | ✅ done | `ordering.ts`; T-SWF-019 one fixture per rule incl. dedup + sprite-nested refs; R032 non-fatal, R033 reference scope verified (PlaceObject 4/26/70, StartSound 15/89, DoInitAction 59, buttons 7/34, JPEG tables 21/35/90, DefineText 11) |
| WP-020-09 | Processing-order contract + DoInitAction collection | ✅ done | `processing.ts` exports `ProcessStep` + `PROCESSING_ORDER` (R034, data not logic); DoInitAction collected in `model/movie.ts` with SF0421/SF0422 (R035; deviation recorded in module docstring) |
| WP-020-10 | `SwfFile` facade, lazy memoised `readTag` | ✅ done | T-SWF-018 (lazy index on first access + memoised identical object), T-SWF-021 (view, `byteOffset` inside the buffer, zero-copy) |
| WP-020-11 | Truncation/fuzz corpus generator + `swffuzz` wiring | ⚠️ partial | T-SWF-002 every-byte-offset truncation ✅; 10⁴ seeded mutations, zero uncaught exceptions ✅ (in-repo CI via `pnpm test:fuzz`). No standalone `swffuzz` tool/wiring exists; crasher corpus dir absent — O-04 |
| WP-020-12 | `inspect --tags/--symbols` CLI surface | ⚠️ partial | `inspect` prints the dictionary, sprite markers, duplicate/shadowed definitions and ordering diagnostics; `--json` output is double-run identical. The `--tags`/`--symbols` flags themselves do not exist and export names are not printed (count only) — F-12 |

## 3. Test-obligation ledger (`IMPL-020` §10)

| ID | Obligation | Status | Location |
| --- | --- | --- | --- |
| T-SWF-001 | header matrix: FWS/CWS/ZWS, versions 1…43, frame rates, frame sizes | ⚠️ partial | signatures + ZWS round-trip covered (`container.test.ts`, `framing.test.ts`); the version 1–43 / frame-rate / frame-size matrices are not — F-09 |
| T-SWF-002 | truncation at every byte offset | ✅ | `container.test.ts` — every prefix, no exception, diagnostics present, indexed tags a prefix |
| T-SWF-003 | RECORDHEADER framing: `43 00`, `03 01`, short/long 62/63, long-under-63 | ⚠️ partial | `framing.test.ts` pins the spec byte tuples + a 70-byte long header; the 62/63 boundary is not explicitly pinned — F-10 |
| T-SWF-007 | duplicate ids, id 0, referenced-but-undefined | ⚠️ partial | duplicates + last-wins pinned in `apps/decompiler/test/inspect.test.ts` (labelled); id 0 (SF0107) has no labelled test; the undefined-reference half exists as SF0110/`kind:'missing'` under T-MOD labels in `model.test.ts` — F-11 |
| T-SWF-008 | sprite nesting at 31/32/33, explicit stack | ✅ | `container.test.ts` — max depth 32, SF0103, depth-33 body abandoned |
| T-SWF-010 | every emitted code inside its documented range | ✅ | `container.test.ts` — every emitted code registered with matching registry severity across three malformed corpora |
| T-SWF-011 | `maxDecompressedBytes` abort | ✅ | `container.test.ts` — 16 MiB bomb vs 8 MiB cap → SF0007 error, empty body; 32 MiB vs default 512 MiB cap parses. Full-scale 512 MiB + RSS assertion: F-13 |
| T-SWF-012 | determinism across opens | ✅ | `container.test.ts` — fingerprint (tags, definitions, diagnostics) identical |
| T-SWF-018 | lazy index + memoised payload views | ✅ | `fixture.test.ts` (SF0102 only after first `tagIndex` access; `readTag` identity) + `framing.test.ts` sentinel |
| T-SWF-019 | ordering: one fixture per rule, correct code and count | ✅ | `ordering.test.ts` — rules 1–5 each trip exactly one diagnostic; dedup-with-count pinned; sprite-nested references checked against global order; well-ordered control clean |
| T-SWF-020 | `ShowFrame`/`FrameCount` mismatch policy (declared wins, padding) | ✅ | `model.test.ts` — SF0023 for main timeline and sprites; `padToDeclared` behaviour (T-MOD-601) |
| T-SWF-021 | zero-copy tag bodies | ✅ | `container.test.ts` — `view.buffer === file.body.buffer`, byteOffset bounds, memo identity |
| T-SWF-022 | Appendix A tag-stream walk (incl. long-header DefineShape, 35-byte body) | ✅ | `fixture.test.ts` — tags `[9, 2, 26, 1, 0]`, long-header flag + length |
| T-SWF-023 | Appendix A header (v3, 79 B, Nbits 15 rect, raw 3072 = 12.0 fps, 1 frame) | ✅ | `fixture.test.ts` — every value pinned |

**14 declared, 10 fully met, 4 partial (all partials are test-evidence gaps, not missing behaviour).**

## 4. Diagnostic ledger (`IMPL-020` §9)

All 26 container codes are registered in `packages/swf/src/diagnostics/codes.ts` with registry
severity equal to the §9 table (verified mechanically; see §4.6 for the house-checker run). All 26
have a production emit site. Test reference is the gap:

| Code | §9 severity | Registry | Emit site | Test evidence |
| --- | --- | --- | --- | --- |
| SF0001 | error | ✅ | `open.ts` (not-a-SWF) | `dump.test.ts` |
| SF0003 | error | ✅ | `open.ts` (decompression failed / no inflater) | `framing.test.ts` |
| SF0004 | warning | ✅ | `header.ts` (decompressed/actual > declared) | **none — F-08** |
| SF0005 | warning | ✅ | `header.ts` (< declared) | `inspect.test.ts` (`--strict`/`--tolerate-length` pair) |
| SF0006 | error | ✅ | `open.ts` (ZWS, no LZMA) | `container.test.ts`, `framing.test.ts` |
| SF0007 | error | ✅ | `open.ts` (cap abort) | `container.test.ts` |
| SF0021 | warning | ✅ | `header.ts` (Xmin/Ymin ≠ 0) | **none — F-08** |
| SF0022 | info | ✅ | `header.ts` (frame rate implausible) | **none — F-08** |
| SF0023 | warning | ✅ | `tag-stream.ts` (declared vs observed) | `model.test.ts` |
| SF0024 | info | ✅ | `tag-stream.ts` (bytes after End) | `ordering.test.ts` |
| SF0025 | warning | ✅ | `ordering.ts` (FileAttributes not first) | `ordering.test.ts`, `control.test.ts` |
| SF0026 | warning | ✅ | `ordering.ts` (definition after use / never) | `ordering.test.ts` |
| SF0027 | warning | ✅ | `open.ts` (ZWS advisory length) | `container.test.ts` |
| SF0028 | warning | ✅ | `header.ts` (FileLength implausible) | **none — F-08** |
| SF0029 | error | ✅ | `header.ts` (non-positive frame size) | `dump.test.ts` |
| SF0030 | info | ✅ | `tag-stream.ts` (long header, body < 63) | `diagnostics.test.ts` (registry severity only — see F-06) |
| SF0031 | error | ✅ | `tag-stream.ts` (dictionary cap) | **none — F-08** |
| SF0032 | warning | ✅ | `ordering.ts` (stream sound order) | `ordering.test.ts` |
| SF0033 | info | ✅ | `header.ts` (CWS on version < 6) | **none — F-08** |
| SF0101 | warning | ✅ | `tag-stream.ts` (tag past end) | **none — F-08** (T-SWF-002's truncated-file contract covers it implicitly, no code assertion) |
| SF0102 | info | ✅ | `tag-stream.ts` (missing End) | `container.test.ts`, `framing.test.ts`, `fixture.test.ts` |
| SF0103 | warning | ✅ | `tag-stream.ts` (nesting > 32) | `container.test.ts` |
| SF0104 | info | ✅ | `tag-stream.ts` (unknown tag skipped) | `framing.test.ts`, `diagnostics.test.ts` |
| SF0107 | warning | ✅ | `tag-stream.ts` (definition id 0) | **none — F-08** (fires in probes, no test asserts it) |
| SF0109 | warning | ✅ | `tag-stream.ts` (duplicate id, both offsets) | `inspect.test.ts` (SF0109 message "offsets 2 and 6") |
| SF0110 | warning (shared with 030) | ✅ | `model/timeline.ts` (undefined char ref) | `model.test.ts` |

**Done criterion 5 ("every diagnostic code in §9 is emitted by at least one test") fails: 7 codes
(SF0004, SF0021, SF0022, SF0028, SF0031, SF0101, SF0107) have no test asserting them** — F-08.

### 4.1 Rule-by-rule read (R001–R037)

| Rule | Verdict | Note |
| --- | --- | --- |
| R001 (no payload-decoder imports) | ✅ | container imports only `diagnostics/`, `io/` primitives and the `tag-codes` metadata table |
| R002 (LZMA lazily imported) | ✅ | `createRequire` sync + `await import` async; absent package → SF0006 at the Node entry point |
| R003 (tags in file order) | ✅ | single append-only walk; consumers sort copies (CLI sorts the histogram) |
| R004 (zero-copy memoised `readTag`; lazy index) | ✅ | T-SWF-018/021; the `decoded` variant is explicitly deferred (doc note honoured) |
| R005 (3-byte case-sensitive signature) | ✅ | `String.fromCharCode` + exact map lookup; lowercase → SF0001 |
| R006 (incremental bounded decompression) | ⚠️ | zlib: bounded while producing (sync `maxOutputLength`, async per-chunk). LZMA: **cap checked after full decompression — F-03** |
| R007 (truncated/corrupt stream → partial + SF0003, no exception) | ⚠️ | async path keeps partial bytes (with the F-04 zero-pad defect); sync `nodeInflate` discards all partial output — **F-05** |
| R008 (ZWS `compressedLength` advisory + SF0027) | ✅ | `open.ts` emits once; `container.test.ts` pins the disagreeing-writer case |
| R009 (property bytes to decoder; SF0006 + empty body when unavailable) | ✅ | LZMA_alone framing carries the 5 property bytes; `openSwfNodeSync` leaves `inflate` unset so SF0006 fires |
| R010 (LZMA streaming, bounded, tolerate missing end marker) | ⚠️ | missing end marker tolerated ✅; streaming/bounded — **F-03** (documented deviation in `lzma.ts` comment; the pure-JS `lzma` cannot stream) |
| R011 (FileLength policy table, `--strict` promotion) | ✅ | all four situations emit the right code; `strictLength` promotes warning→error; CLI wires `--strict`/`--tolerate-length` (tested). (The strict *parser mode* crash is CLI-level — F-02.) |
| R012 (frame rate raw + `raw/256`, no clamp, SF0022 at 0 or > 240 fps) | ✅ | `header.ts`; Appendix A raw 3072 = 12.0 pinned (T-SWF-023) |
| R013 (FrameSize via `readRect`, SF0021 preserve, SF0029 continue) | ✅ | both diagnostics emitted with correct severity; rect preserved |
| R014 (`frameSizePx` = twips/20 float) | ✅ | `TWIPS_PER_PIXEL` = 20 |
| R015 (UI16-LE then shifts; `43 00`/`03 01` pins) | ✅ | T-SWF-003 |
| R016 (long Length excludes header; E-007) | ✅ | E-007 applied to `docs/specs/format/030` line 89 (done criterion 6 ✅) |
| R017 (SF0030 once per tag code) | ⚠️ | emitted for every long-header-under-63 tag but the sink folds them once per stream level, not per tag code — **F-06** |
| R018 (unknown tags skipped by length, SF0104 dedup by code with count) | ✅ | dedup context includes the code (`unknown tag N`) |
| R019 (body past end → SF0101, prior tags kept) | ✅ | tag kept with clipped length, walk stops |
| R020 (End terminates; missing → SF0102; bytes after → SF0024) | ✅ | all three pinned |
| R021 (tag bodies as views; explicit copies only) | ✅ | T-SWF-021 |
| R022 (walk sprites recursively, record depth/inSprite/range+frameCount) | ⚠️ | depth/inSprite/frameCount ✅; **the range `end` is wrong for End-less sprites — F-01** |
| R023 (depth cap 32, SF0103, explicit stack, sub-stream skipped) | ✅ | T-SWF-008; `stack` array, no recursion |
| R024 (sprite `ShowFrame` vs declared → SF0023, declared wins) | ✅ | `tag-stream.ts` + model padding (T-SWF-020/T-MOD-601) |
| R025 (top-level same rule) | ✅ | `tag-stream.ts` (suppressed only when declared = 0) |
| R026 (definition-before-use reported, still resolved) | ✅ | SF0026 warning; resolution unaffected |
| R027 (id 0 → SF0107, ignored) | ✅ | not registered in `definitionsById` |
| R028 (duplicate: last wins, SF0109 names both offsets, first reachable) | ✅ | verified in probe (§6) and CLI (shadowed/winner markers) |
| R029 (undefined ref → `kind:'missing'` placeholder + SF0110) | ✅ | realised in the model layer (recorded API split); tested in `model.test.ts` |
| R030 (exports merge; duplicate name → SF0159, last wins) | ❌ **doc defect** | the code (and doc 040, and the registry) say duplicate *name* is **SF0160, first id wins**; R030 mis-cites the code and the policy — **F-07** |
| R031 (`maxDictionaryEntries` in registered definitions, SF0031) | ✅ | `tag-stream.ts` (no test — F-08) |
| R032 (ordering non-fatal, no reordering) | ✅ | pure report pass over the built index |
| R033 (rule limited to structural character references) | ✅ | the extractor list in `ordering.ts` matches the rule (PlaceObject*, StartSound*, DoInitAction, buttons, JPEG tables, DefineText fonts); `DefineButton2` filter-bearing records conservatively stop the walk (recorded in the module docstring) |
| R034 (processing order exported as data, shared) | ✅ | `processing.ts` (`ProcessStep` enum + `PROCESSING_ORDER`) |
| R035 (DoInitAction collected separately, sprite-associated) | ✅ | `model/movie.ts` (`initActions`, SF0421/SF0422) |
| R036 (parsing executes nothing) | ✅ | `openSwf` is structural; the only work done is framing/indexing/ordering |
| R037 (writer emits deliberately invalid files via `defects`) | ✅ | `test-support/writer.ts` `defects` (`missing-end`, `bad-file-length`, `overlong-encoded-u32`, `out-of-order-stream`) |

### 4.2 Done criteria (`IMPL-020` §13)

| # | Criterion | Verdict |
| --- | --- | --- |
| 1 | `openSwf` over the fixture corpus in both modes, no uncaught exception; T-SWF-002 | ⚠️ soft mode: ✅ (corpus + 10⁴ fuzz). "Both modes": strict mode throws by API contract (`SwfOpenOptions.mode`), and the **CLI** `--strict` path crashes uncaught on damaged files — F-02. (The criterion's "both modes" wording also conflicts with §3's "strict throws"; the intent is recover-never-throw for soft, which holds.) |
| 2 | `inspect --tags --symbols` stable diffable report for every synthetic fixture | ⚠️ report is stable (double-run JSON identity pinned) and carries the dictionary/sprites/ordering diagnostics, but the `--tags`/`--symbols` flags do not exist and exports are counted, not printed — F-12 |
| 3 | all five ordering rules have a fixture tripping exactly one | ✅ `ordering.test.ts` (rules 2–3 share the mandated scan, same diagnostic, per the §7 table) |
| 4 | 512 MiB bomb rejected with peak RSS < 256 MiB | ⚠️ cap abort proven at 16 MiB/8 MiB and 32 MiB/default; no full-scale 512 MiB run and no RSS assertion — F-13 |
| 5 | every §9 code emitted by ≥ 1 test | ❌ 7 of 26 codes untested — F-08 |
| 6 | E-007 correction applied to `docs/specs/format/030` | ✅ line 89 ("body length, EXCLUDES the 6-byte header (E-007)") |

### 4.3 P1 exit criteria (`IMPL-000` §6)

| Criterion | Verdict |
| --- | --- |
| FWS/CWS/ZWS parse; length-mismatch policy per SWF-R009 | ✅ all three signatures open (FWS direct, CWS sync/async zlib, ZWS via the optional adapter); policy + `--strict`/`--tolerate-length` tested |
| Tag index built lazily; sprite ranges recorded | ⚠️ laziness ✅ (T-SWF-018); sprite ranges — F-01 |
| Ordering rule violations detected and reported ("new diagnostics SF0120-range") | ✅ five rules, correct codes. (The roadmap's "SF0120-range" phrasing is stale: `IMPL-020` §9 allocates the ordering diagnostics to the container range SF0024–SF0026/SF0032; SF0120 is owned by doc 030 — see O-03.) |
| Fuzz smoke: 10⁴ mutations, zero uncaught exceptions (CI job) | ✅ `fuzz.test.ts` (seeded LCG, in-repo) + CI `pnpm test:fuzz` |

### 4.4 Cross-check against the format spec

- **Tag table.** `tag-codes.ts` and `specs/reference/110 §2` were cross-checked against the public
  SWF references (Alexis' SWF Reference; independent summaries): the table matches the canonical
  values for the codes this package understands (DoAction 12, DefineSprite 39, FrameLabel 43,
  DoInitAction 59, DoABC 82, FileAttributes 69, …), including the codes omitted by Appendix B being
  treated as unassigned/unknown per the `E-025`/`E-026` reconciliation. **No discrepancy.**
- **PlaceObject3 reference extraction** (`ordering.ts`): the `ClassName`-string skip condition
  (`HasClassName` or `HasImage && HasCharacter`) matches `specs/reference/110` line 394 exactly.
- **Appendix A golden** (`fixtures/appendix-a.swf`, 79 bytes): every annotated value pinned by
  T-SWF-022/023; the file opens with zero errors.

### 4.5 Open items carried by the spec itself (`IMPL-020` §12)

4 open (not findings — the spec marks them as such): the ZWS chapter confirmation (item 1, low-risk
by the advisory handling), the Ch.2 "Processing"/"compression strategy" sections (item 2, errata
E-006), the normative wording of the five ordering rules (item 3), and whether the FileAttributes
violation is error vs warning for SWF ≥ 8 (item 4 — the code warns, per the doc's own note).

### 4.6 House mechanical checker

`python3 tools/audit_dev.py` (ledger scoped to the earlier `audits/dev` audit): **no registry,
callsite-severity, doc-§8-severity, coverage or import-restriction findings in the container range**.
P1-relevant mechanical output: three `ownership.stale` entries — `SF0025`/`SF0026` (WP-020-08) and
`SF0027` (WP-020-03) "now have a production report path; remove their deferred mapping" — i.e. the
`audits/dev/baseline.json` ledger predates the P1 closeout and needs its P1 entries retired (O-02).
The checker's 56 other "new" entries are P3/P5-range codes (buttons, AVM1) outside this audit's
scope.

**Post-resolution re-run (2026-10-05, `P1-REPEAT-AUDIT.md`):** after the resolution pass retired
the three deferred mappings (O-02r) and re-baselined, `python3 tools/audit_dev.py` reports
`findings=81 known=81 new=0 fixed=0` — **zero `ownership.stale`, zero new findings**, the shape4
probe passes (5/5), and the dump synth probe's clean fixture stays diagnostic-free. The remaining
81 baseline entries are P3/P5-range codes (buttons, AVM1) accepted for the time being; none is in
the P1 range.

---

## 5. Findings

### F-01 — Sprite timeline range is empty for a sprite whose body has no `End` tag — **major**

- **Spec:** `IMPL-020` §3 (`TagIndex.spriteRanges`: "the slice of `tags` that belongs to its
  timeline") and §5.2 R022 ("MUST record the sprite's tag range").
- **Code:** `packages/swf/src/container/tag-stream.ts:263,340`. `level.now` is updated only in the
  `code === 0` branch (line 263: `level.now = tags.length - 1`); a level closed by hitting its byte
  limit (`!level.ended`) keeps its initial `now = startTag`, and line 340 records
  `spriteRanges.set(id, { start: level.startTag, end: level.now, … })` → `start === end`.
- **Evidence** (probe, verbatim): a sprite 5 with declared 1 frame, body `ShowFrame + PlaceObject2`,
  no `End`:
  ```
  RANGE {"start":2,"end":2,"frameCount":1,"depth":1}
  TAGS 2/snull@0 39/snull@1 1/s5@2 26/s5@3 1/snull@4 1/snull@5 0/snull@6
  DIAG SF0107,SF0173,SF0026
  ```
  The sprite's tags **are indexed** (indices 2–3, `inSprite: 5`) but the range covers nothing.
- **Effect:** `model/movie.ts:462-465` slices `tags.slice(range.start, range.end)` → `[]`; the
  sprite timeline is assembled from zero tags (only the declared-frame padding survives). The
  malformed-input path that the P1 exit criteria exist for (truncation must recover, not lose)
  silently drops the sprite's content from the model while the container itself recovered it.
- **Fix:** at the sprite close (tag-stream.ts ~340), use `end: level.ended ? level.now : tags.length`
  — every tag appended up to the close belongs to this sprite (nested bodies included). Add a test:
  End-less sprite → range covers all indexed sprite tags; model timeline sees them.

### F-02 — `inspect --strict` crashes with an uncaught exception on structurally damaged files — **moderate**

- **Spec:** `IMPL-020` R011 ("`--strict` … returns failure after producing the report") and the CLI
  usage line `apps/decompiler/src/cli.ts:33` ("fail on FileLength mismatch and structural read
  errors where supported").
- **Code:** `inspect.ts:203` calls `openSwfNodeSync(bytes, { mode: request.strict ? 'strict' : 'soft', … })`
  with no catch; `openSwf` in strict mode throws on the first structural cursor violation.
- **Evidence** (probe, verbatim): a file whose tag 2 declares a 5-byte body with 3 bytes present:
  ```
  STRICT-THREW SF0013 @7 (tag stream): read of 2 byte(s) at offset 7 past limit 8
  ```
- **Effect:** `forge-decompile inspect --strict damaged.swf` prints a stack trace instead of a
  report + failure exit code; the P1 exit criterion "no uncaught exception … in both modes" fails at
  the CLI layer.
- **Fix:** catch the strict-mode throw in `runInspect`, emit the diagnostics collected so far on the
  shared sink, return the failure exit code (`EXIT.failed`). Pin with a CLI test (strict + torn tag →
  exit code, no throw, diagnostics printed).

### F-03 — LZMA decompression cap is enforced after full decompression — **moderate**

- **Spec:** `IMPL-020` R010 ("decompression MUST be streaming and bounded") and R006's stated
  principle: "A cap checked only after decompression is a memory-exhaustion vector."
- **Code:** `packages/swf/src/node/lzma.ts:47` — `mod.decompress(data)` runs to completion, then
  `bytes.length > maxBytes` discards the result and reports the cap. The code comment acknowledges
  the deviation ("the pure-JS decoder cannot stream").
- **Effect:** a hostile `ZWS` file whose LZMA payload expands past `maxDecompressedBytes` still
  allocates the full expansion before the cap is noticed. The zlib paths honour the cap while
  producing output; the LZMA path does not.
- **Fix options:** (a) bound the *input* — reject (with SF0007) compressed inputs larger than
  `maxBytes × worstCaseRatio` before decompressing (LZMA-alone's practical expansion factor is
  bounded; even a conservative 1024× bound keeps the allocation argument); (b) record the accepted
  deviation in `IMPL-020` §12 as a pinned open item with the risk statement. A pure post-hoc check
  should not be the whole story.

### F-04 — Async zlib cap abort produces a zero-padded body — **minor**

- **Spec:** `IMPL-020` R006 ("aborting as soon as the cap is exceeded (SF0007, error, fatal for
  that file)").
- **Code:** `container/open.ts:284-292` — when `total > cap` the loop breaks *before* pushing the
  offending chunk, but the result buffer is `new Uint8Array(total)`, i.e. sized to include the chunk
  it never copied: the tail is zero bytes that are then parsed as header/tags.
- **Effect:** after a cap abort the file still "parses" a buffer padded with zeros (garbage
  diagnostics on a file that is already fatal). Bounded, but wrong.
- **Fix:** track the actually-copied length and size the buffer to it (or return the partial
  `chunks` join) when `truncated`.

### F-05 — Sync CWS truncation discards all partial output — **minor**

- **Spec:** `IMPL-020` R007: "A truncated or corrupt stream MUST yield the bytes decoded so far
  plus `SF0003` (error), not an exception. Partial movies are useful; `inspect` can still be run."
- **Code:** `node/inflate.ts:18-24` — on any `inflateSync` error the result is
  `{ bytes: new Uint8Array(0), error }`; the container then assembles an empty body. The async path
  keeps partial bytes (modulo F-04); the sync path keeps none.
- **Fix:** switch the Node sync inflater to the streaming `zlib.inflate` with a manual pump that
  accumulates output until the error, returning the partial bytes + SF0003; or record the deviation
  in `IMPL-020` §12.

### F-06 — SF0030 folds once per stream level instead of once per tag code — **minor**

- **Spec:** `IMPL-020` R017 ("Emit `SF0030` (info, once per tag code) so the coverage report can
  note non-canonical writers").
- **Code:** `tag-stream.ts:145` emits without a per-code dedup context; the sink folds by
  `(code, context, characterId)` (`sink.ts` `keyOf`), so *all* long-header-under-63 tags in a level
  merge into one entry whose message names only the first tag code. (Contrast SF0104, which passes
  `context: 'unknown tag N'` and correctly dedups per code.)
- **Fix:** pass a per-tag-code context, e.g. `extra: { context: 'long header tag ' + code, tagCode: code }`.

### F-07 — `IMPL-020` R030 mis-states the duplicate-export policy — **minor (documentation defect)**

- **Spec text:** R030: "a name that maps to two ids reports `SF0159` (warning …) and **the last
  wins**".
- **Authority:** the registry and doc 040 R015 define **SF0159 = duplicate export *character id***
  (later name wins, per Ch.4) and **SF0160 = duplicate export *name*** (first id wins, "the chapter
  is silent"). The code (`tags/control.ts:130-140`) implements doc 040 exactly (first id wins for a
  duplicate name, SF0160; later name wins for a duplicate id, SF0159).
- **Fix:** correct R030 to cite SF0160/first-wins for duplicate *names* (and point to SF0159 for
  duplicate *ids*), so the P1 doc no longer contradicts the owned definition and the implementation.

### F-08 — Seven container codes have no test asserting them — **minor**

- **Spec:** `IMPL-020` §13 done criterion 5.
- **Codes:** SF0004 (decompressed longer than declared), SF0021 (non-zero Xmin/Ymin), SF0022
  (implausible frame rate), SF0028 (implausible FileLength), SF0031 (dictionary cap), SF0101 (tag
  body past end), SF0107 (definition id 0). All have working emit sites (verified in probes — e.g.
  SF0107 fires on a DefineShape with id 0).
- **Fix:** one small probe test per code (header-field variants for SF0004/0021/0022/0028; a
  `maxDictionaryEntries: 2` fixture for SF0031; a torn final tag for SF0101; an id-0 definition for
  SF0107), labelled under the owning T-SWF id.

### F-09 — T-SWF-001 "header matrix" is a signature test, not a matrix — **minor**

- **Spec:** T-SWF-001: "header matrix: `FWS`/`CWS`/`ZWS`, versions 1…43, frame rates, frame sizes".
- **State:** the three signatures are exercised (FWS everywhere; CWS via the Node inflater incl. the
  CLI test; ZWS round-trip), but no test walks the version 1–43 range (e.g. SF0033 at CWS v5, the
  version-below-baseline note at v1–3) or the frame-rate boundaries (0, 240×256, 241×256 → SF0022)
  or the frame-size validations (non-zero min → SF0021; non-positive extent → SF0029).
- **Fix:** parameterised header cases feeding `buildSwf`/`parseHeader` with (version, rate, size)
  triples and asserting the expected code set.

### F-10 — T-SWF-003 does not pin the 62/63 short/long boundary — **minor**

- **Spec:** T-SWF-003 includes "short/long boundary at 62/63, long-form-under-63".
- **State:** `43 00`/`03 01` and a 70-byte long header are pinned; the 62-byte (short) / 63-byte
  (long) boundary and the R017 long-under-63 accept path are not explicitly asserted.
- **Fix:** add `readTagHeader` vectors for body lengths 62 and 63 (plus an SF0030 assertion for the
  long-under-63 case, which also closes F-06's evidence gap).

### F-11 — T-SWF-007's three sub-obligations are only one labelled test — **minor**

- **Spec:** T-SWF-007: "duplicate character ids, id 0, referenced-but-undefined character".
- **State:** duplicate ids + last-wins: ✅ labelled in `apps/decompiler/test/inspect.test.ts:76`.
  id 0: unlabelled (SF0107 — see F-08). Referenced-but-undefined: behaves (SF0110 + `kind:'missing'`,
  `model.test.ts:87`) but labelled under T-MOD ids, not T-SWF-007.
- **Fix:** add the container-level labelled tests (or a single T-SWF-007 test covering all three).

### F-12 — P1 demo surface: no `--tags`/`--symbols` flags; exports not printed — **minor**

- **Spec:** `IMPL-000` P1 demo: "`inspect --tags --symbols` prints dictionary, sprites, exports,
  ordering violations"; done criterion 2.
- **State:** `inspect` prints the tag histogram, characters (with `(sprite)` markers),
  duplicate/shadowed definitions and ordering diagnostics by default, and `--json` is stable. But
  the named flags do not exist and export *names* are not printed anywhere (JSON carries
  `counts.exports` only).
- **Fix:** either add the two flags (selecting sections, everything on by default) or record the
  deviation in `IMPL-020` §3 like the dictionary split; add `exports: [{ name, id }]` to the summary
  and a line to the human render.

### F-13 — Done criterion 4 has no full-scale evidence — **minor**

- **Spec:** "a 512 MiB decompression bomb is rejected with peak RSS under 256 MiB".
- **State:** T-SWF-011 proves the cap aborts (16 MiB bomb vs 8 MiB cap → SF0007) and that the
  default 512 MiB cap is in effect (32 MiB parses). No test runs a 512 MiB-scale bomb, and none
  measures peak RSS.
- **Fix:** a nightly-tagged (skipped in fast CI) test: 512 MiB bomb vs default cap → SF0007, plus a
  `process.memoryUsage()`-or-`child_process` RSS assertion under 256 MiB; or record the criterion as
  measured by the (not yet built) harness per IMPL-140.

### O-01 — Container emits four codes outside its §9 table

`tag-stream.ts` emits SF0128 (`SPRITE_DEFINITION_TAG`), SF0129 (`SPRITE_TAG_UNLISTED`) — owned by
doc 030 per the STATUS register — and SF0173 (`MISSING_END_STRUCTURAL`), SF0175
(`FILE_ATTRIBUTES_IN_SPRITE`) — owned by doc 040. The behaviours are correct and useful; the
registry's range ownership should record the cross-layer emissions (or `IMPL-020` §9 should list
them as borrowed codes), so the ownership ledger stops flagging them.

### O-02 — Stale P1 entries in the `audits/dev` baseline

`tools/audit_dev.py` reports `ownership.stale:SF0025/SF0026/SF0027` — the baseline still maps these
container codes to deferred WPs (WP-020-08/WP-020-03) although all three now have production
emission paths. Retire the entries (baseline update belongs to the resolution pass).

### O-03 — Roadmap wording drift on the ordering diagnostics

`IMPL-000` §6 P1 says ordering violations use "new diagnostics `SF0120`-range"; `IMPL-020` §9
allocates the five-rule diagnostics to SF0024–SF0026/SF0032 (the container range), and SF0120 is
doc 030's. The roadmap line is stale prose; the implementation follows `IMPL-020`.

### O-04 — Fuzz crasher corpus is an empty mechanism

`packages/swf/test/fuzz/corpus/` does not exist; the IMPL-140-R016 regression test passes
vacuously (0 files). Acceptable while no crasher has been found; create the directory (or a
README) so the first crasher lands in the right place.

### O-05 — Accepted API deviations worth a record, not all of them recorded

The §3 "accepted deviation" note covers only the `dictionary` split. Also deviating from the §3
sketch (all benign, all consistent in code and tests): `TagRef.offset` is relative to the tag
stream, not "absolute in the decompressed buffer"; `SwfFile.body` is the tag-stream region, not
"everything after the 8-byte header"; a not-a-SWF soft open returns a zero header object rather
than an undefined one; `sha256` is an optional input (computed at the Node entry point, `''` in
browsers); `TagRef` gains `headerOffset`/`longHeader` and `TagIndex` gains `frameCounts`. Add them
to the §3 note (or adjust the sketch) so the next auditor does not have to re-derive them.

---

## 6. Probe evidence (verbatim)

Probes ran as throwaway vitest files against the working tree (deleted after capture; re-runnable
from the descriptions — resolution should pin each as a permanent test):

**P1 (F-01)** — sprite 5, declared 1 frame, body `ShowFrame, PlaceObject2(char 2)`, no `End`:
```
RANGE {"start":2,"end":2,"frameCount":1,"depth":1}
TAGS 2/snull@0 39/snull@1 1/s5@2 26/s5@3 1/snull@4 1/snull@5 0/snull@6
DIAG SF0107,SF0173,SF0026
```

**P2 (F-02)** — tag 2 declares a 5-byte body, 3 bytes present, `mode: 'strict'`:
```
STRICT-THREW SF0013 @7 (tag stream): read of 2 byte(s) at offset 7 past limit 8
```
(soft mode on the same bytes: no throw, SF0101/SF0102-class diagnostics, prior tags kept.)

**P3 (F-08/SF0107)** — `DefineShape` with a zero-filled 20-byte body (CharacterId 0):
`DIAG` includes `SF0107`; the id is not registered in `definitions`.

**P4 (R028)** — `DefineShape` id 1 then `DefineShape2` id 1: SF0109 message names both offsets;
`definitions` keeps both in stream order; lookup map holds the second.

**P5 (tag table)** — `tag-codes.ts` vs Alexis' SWF Reference / public summaries: DoAction 12,
SetBackgroundColor 9, DefineFont 10, DefineSprite 39, FrameLabel 43, DoInitAction 59, DoABC 82,
FileAttributes 69 — all agree; Appendix-B-omitted codes take the unknown path (SF0104). No
discrepancy.

**P6 (mechanical)** — severity cross-check: all 26 container codes, registry severity ==
`IMPL-020` §9 severity == callsite literal (the two `strictLength`-promoted sites are
warning-by-default/error-under-strict exactly per R011).

## 7. What this audit does not cover

- **P2/P5 code** in the same working tree (control tags, model, AVM1 front end) — audited under
  their own phases; only its interaction with P1 (SF0421/422 collection, SF0110 placeholders) is
  recorded here as the R035/R029 realisation.
- **`packages/gfx`, `apps/transpiler`, unimplemented docs** — roadmap, not P1.
- **Performance/budget claims** — no harness exists yet (IMPL-140); T-SWF-011's scaled bombs are
  the only cap evidence (F-13).
- **The four `IMPL-020` §12 open items** (upstream-chapter confirmations) — spec status, tracked in
  the doc itself, not defects.
- **Security review** beyond the bounded-decompression property (R006/R009/R010), which is part of
  this phase's contract (F-03/F-04/F-05 are its findings).

## 8. Re-audit protocol (for the resolution confirmation pass)

1. Re-run this audit's ledgers verbatim: §2 WP table, §3 test-obligation table, §4.1 rule table,
   §4.2/§4.3 criteria tables. A finding is **resolved** only when its specific evidence flips:
   - F-01: P1's probe prints `end: 4` (or the model timeline contains the sprite's tags).
   - F-02: strict CLI on the torn file exits with the failure code, prints diagnostics, no stack trace.
   - F-03: input bound in place, or the pinned §12 deviation entry exists with the risk statement.
   - F-04: capped async body length equals the bytes actually produced (no zero tail).
   - F-05: sync truncated CWS yields partial bytes + SF0003, or the pinned deviation.
   - F-06: two different long-under-63 tag codes → two SF0030 entries (or per-code contexts).
   - F-07: R030 text cites SF0160/first-wins (diff of the doc).
   - F-08: all 7 codes asserted by ≥ 1 test each.
   - F-09/F-10/F-11: the named matrix/boundary/label tests exist and pass.
   - F-12: `--tags`/`--symbols` exist (or deviation recorded) **and** export names are printed.
   - F-13: full-scale test present (or recorded deferral to IMPL-140).
2. Full gate: `pnpm typecheck && pnpm test && pnpm lint` green (note: the current tree's 18
   typecheck errors are all P5 WIP — 7 in `apps/decompiler/src/commands/inspect.ts`, 5 in
   `packages/avm1/src/frontend/analyze.ts`, 6 in `packages/avm1/src/frontend/disassemble.ts` —
   none in P1; the resolution pass should land those P5 fixes or the gate will not pass
   tree-wide), `python3 tools/audit_dev.py` with the retired P1 baseline entries (O-02).
3. Update `audits/dev/baseline.json` and this file's §4.6, and move this audit to
   `audits/archive/` only after the confirmation audit is written.
