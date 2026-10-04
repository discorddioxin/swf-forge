# IMPL-140 — Conformance Harness, Fixtures, and Fuzzing

**Doc ID:** IMPL-140 · **Status:** ready (design-spec-driven; grows with every impl doc) · **Packages:** `@swf-forge/test-support`, `tools/`
**Format spec:** Appendices A–C (the worked example, the reverse tag index, the Screen Video v2 palette); chapters are covered by the docs it validates
**Design specs:** TST (whole: metrics, gates C0/C1/C2, golden policy), CMP-§7 (goldens), GFX-§13.4
(tolerances), SEC-§7 (fuzzing), REPO-§8 (CI)

---

## 1. Deliverables

1. The **synthetic writer** that produces SWF files (valid and deliberately invalid) from declarative
   descriptions — the single source of fixtures for every impl doc.
2. The **oracle runner**: a scripted Flash reference run for titles that have a reference player, with
   capture of pixels, audio, and observable state.
3. Metric implementations: SSIM, alpha RMS, audio null-RMS, click detection, timeline drift,
   state-diff — exactly the TST-§5 definitions.
4. Gate runner for C0/C1/C2 over the corpus, with per-metric reports and waivers.
5. Golden management: generate, review, update, and reject flows, with provenance per golden.
6. Fuzzers: container (doc 020), tags (all decoders), action streams (doc 050), and the emitted-output
   verifier's own robustness.
7. Coverage accountability: which impl doc's codes/tests are exercised, so "written but never executed"
   specs are visible.

## 2. Synthetic writer (`packages/swf/src/test-support`)

```ts
export const movie: MovieBuilder;     // declarative: tags[], version, compression, frameRate, defects[]
export const tag = {
  fileAttributes, defineShape, defineSprite, placeObject, placeObject2, placeObject3,
  removeObject, showFrame, doAction, doInitAction, frameLabel, exportAssets, defineText,
  defineEditText, defineFont2, defineSound, soundStreamHead, soundStreamBlock, defineBitsLossless2,
  defineButton2, defineVideoStream, videoFrame, metadata, end, unknown(code, bytes),
  // …one helper per tag this repo can decode
};
export interface WriterOptions {
  version?: number;
  compression?: 'none' | 'zlib' | 'lzma';
  frameRate?: number; frameCount?: number; frameSize?: [number, number];
  defects?: Defect[];        // 'bad-signature' | 'truncate-at:n' | 'wrong-filelength' | 'missing-end' |
                             // 'long-header-under-63' | 'tag-past-end' | 'duplicate-character' |
                             // 'sprite-depth:40' | 'stream-block-out-of-order' | 'unknown-opcode:0xAB' | …
}
```

**IMPL-140-R001** The writer MUST be able to emit *every* construct that any decoder reads, or the
decoder's coverage cannot be tested. When a new impl doc lands, its author adds the writer helpers in
the same PR (the DoD's "documented API + tests" applies to the fixture surface too).
**IMPL-140-R002** Defects MUST be declarative and MUST be applied to an otherwise valid file, so each
malformed fixture differs from its healthy twin in exactly the declared way. The test asserts the
*delta* of diagnostics, not a full expected list (brittle) — with one exception: code-range checks
(`T-SWF-010`) assert every code emitted is inside its documented range.
**IMPL-140-R003** The writer MUST be deterministic and MUST NOT depend on the runtime's locale or
randomness. Fixture bytes are content-hashed and the hash is part of the golden metadata.
**IMPL-140-R004** A `--emit-fixtures <dir>` mode MUST write the fixtures to disk for use by external
tooling (and for the oracle run), named `<suite>__<case>.swf`.

### 2.1 Appendix fixtures (App A–C)

The three appendices are the only upstream *test vectors* in the document, so they are fixtures with
a special standing: written by the specification, not by us (TST-§3.2).

**Appendix A — the 79-byte worked example.** Committed verbatim; the writer must reproduce it exactly
and the decoders must reproduce every value the appendix annotates.

```text
000000 46 57 53 03 4F 00 00 00 78 00 05 5F 00 00 0F A0
000010 00 00 0C 01 00 43 02 FF FF FF BF 00 23 00 00 00
000020 01 00 70 FB 49 97 0D 0C 7D 50 00 01 14 00 00 00
000030 00 01 25 C9 92 0D 21 ED 48 87 65 30 3B 6D E1 D8
000040 B4 00 00 86 06 06 01 00 01 00 00 40 00 00 00
```

| Field (appendix page) | Bytes | Asserted value |
| --- | --- | --- |
| Signature / version (p.223) | `46 57 53 03` | `FWS`, version 3 |
| `FileLength` (p.224) | `4F 00 00 00` | 79 (whole file below) |
| `FrameSize` `RECT` (pp.224–225) | `78 00 05 5F 00 00 0F A0 00` | `Nbits` 15; Xmin 0, Xmax 11000, Ymin 0, Ymax 8000 twips (550×400 px) |
| `FrameRate` (p.225) | `00 0C` | raw 3072 = 12.0 fps (`raw / 256`) |
| `FrameCount` (p.225) | `01 00` | 1 |
| `SetBackgroundColor` (pp.226) | `43 02 FF FF FF` | tag 9, length 3, RGB white |
| `DefineShape` header (pp.226–227) | `BF 00 23 00 00 00` | tag 2, length field 63 ⇒ **long header**, body 35 bytes |
| `ShapeId`, bounds (p.227) | `01 00 70 FB 49 97 0D 0C 7D 50` | id 1; bounds `Nbits` 14 = 2010, 4910, 1670, 4010 twips (100.5, 245.5, 83.5, 200.5 px) |
| Styles (pp.228–229) | `00 01 14 00 00 00 00` | FillStyleCount 0; LineStyleCount 1; width 20 twips (1 px), RGB black |
| Index widths (p.229) | `01` (bits) | NumFillBits 0, NumLineBits 1 |
| Style change (p.232) | `25 C9 92 0D 21` | flags `0 1 0 0 1` (LineStyle, MoveTo); `MoveBits` 14; Δ (4900, 1680) twips; line style 1 |
| Four edges (pp.232–233) | `ED 48 87 65 30 3B 6D E1 D8 B4` | straight: +2320 vertical, −2880 horizontal, −2320 vertical, +2880 horizontal (13-bit deltas) |
| End record + padding (p.234) | `00 00` | ENDSHAPERECORD then byte-align padding |
| `PlaceObject2` (pp.234–235) | `86 06 06 01 00 01 00 00` | tag 26, length 6; flags `HasMatrix | HasCharacter`; depth 1; character 1; empty matrix byte `00` |
| `ShowFrame`, `End` (p.236) | `40 00 00 00` | tag 1 length 0; tag 0 length 0 |

**Appendix B — reverse tag index.** `APP-§2` is generated-checked against it (65 entries, see the test
table below). The gaps are as important as the entries: every code the appendix omits must take the
unknown-tag path (`SF0104`), so a fixture per *gap cluster* (3, 16, 25, 27, 29–31, 38, 40–42, 44, 47,
49–55, 63, 67, 68, 72, 79–81, 85, 92) is generated to prove we never guess a tag by proximity.

**Appendix C — Screen Video v2 palette.** Compared entry-for-entry, order-sensitive, against the frozen
tables shipped by `IMPL-110` §6 and `APP-§10.12`.

| ID | Test | Level |
| --- | --- | --- |
| `T-TST-101` | Appendix A writer round-trip: emit the file, byte-identical to the 79 bytes (all five lines) | F1 |
| `T-TST-102` | Appendix A decode: header, tag sequence, shape walk and placement walk match the assertion table above | F1 |
| `T-TST-103` | Appendix B equality: `APP-§2` = the appendix's 65 entries; each unassigned code skipped by length with `SF0104` | F1 |
| `T-TST-104` | Appendix C equality: 128 palette values in appendix order, `IMPL-110` §6 = `APP-§10.12` | F1 |

These four are cited by the design spec as `T-TST-004`–`006` (`TST-§3.2`); the ids above are this
document's implementation-level obligations.

## 3. Oracle runner

- **IMPL-140-R005** Oracle runs MUST be recorded as machine-readable artefacts:
  `{title, build, frameCount, frames: [{index, timestampMs, hash}], audio: {chunks, peaks}, state: {...}}`
  plus the raw captures (PNG sequences, WAV) stored outside the repo (external storage convention,
  REPO-§9).
- **IMPL-140-R006** Where no reference player is available, the oracle MUST be replaced by a *second
  independent decoder* (e.g. a stock SWF library) for structure-level checks only, and the
  corresponding gates degrade to C0/C1 with an explicit waiver recorded in `build-info.json`. Silently
  skipping a gate is forbidden.
- **IMPL-140-R007** Captures MUST carry the exact input hash and tool versions so a golden can never be
  attributed to a different input or a different player build.

## 4. Metrics (TST-§5 definitions, implemented once)

| Metric | Definition (implemented exactly) | Threshold |
| --- | --- | --- |
| SSIM | Windowed SSIM over luma, 8×8 windows, on the frame pair, computed in float64 | ≥ 0.995 (GFX gate) |
| Alpha RMS | RMS of per-pixel alpha difference, normalised to 0…1 then scaled to 0…255 | ≤ 3/255 |
| Null-RMS | RMS of the *difference* signal between our audio and the reference, in dBFS | ≤ −60 dBFS |
| Click delta | Max sample-to-sample jump at loop/segment boundaries, in full-scale units | ≤ 0.05 FS |
| Timeline drift | Max absolute difference between our frame timestamp and the reference's, over a run | ≤ 12 ms |
| State diff | Count of observable state fields that differ at scripted checkpoints | 0 for C2 |

- **IMPL-140-R008** The audio comparison MUST be sample-aligned by cross-correlation before the null
  test, and MUST report the alignment offset (a constant offset is a scheduling bug, not noise).
- **IMPL-140-R009** Metric implementations MUST have unit tests against hand-constructed signals where
  the expected value is analytically known (e.g. two identical frames → SSIM exactly 1.0, a DC offset
  → known RMS), because a broken metric that always passes is worse than no metric (`T-TST-001`).
- **IMPL-140-R010** Gates MUST be reported per frame/scenario with the worst case named; a run reports
  `worstFrame`, `worstMetric`, and the top-10 offenders.

## 5. Gate runner and waivers

```
tools/conformance run --title <name> --gate C1 [--json]
tools/conformance compare --ours <dir> --oracle <dir> [--write-report]
tools/conformance waive --metric <m> --reason <text> --scope <frames>
```

- **IMPL-140-R011** A waiver MUST name a metric, a scope, a reason, and an expiry (the next milestone);
  expired waivers fail the gate (`T-TST-002`). Waivers are the only legitimate way to pass a failing
  gate, and they are visible in `build-info.json`.
- **IMPL-140-R012** Gates C0/C1/C2 map to the roadmap milestones M0–M7 (roadmap §6): C0 = structural,
  C1 = visual/audio single-title, C2 = full-corpus fidelity. The runner MUST support running a gate on
  a single title (fast loop) and on the corpus (milestone).

## 6. Goldens

- **IMPL-140-R013** Goldens live with the code they pin, are content-hashed, and carry a provenance
  header: generator (the writer's case name or the oracle's build id), input hash, and the *reason the
  golden is authoritative* (chapter-pinned, oracle-pinned, or our decision).
- **IMPL-140-R014** A golden update MUST require `--update-goldens` **and** a human-written
  justification in the commit message; CI MUST reject a golden-only diff that changes a
  chapter-pinned value without touching the corresponding impl doc.
- **IMPL-140-R015** Every `[oracle-pinned]` and `[verify]` item in the design specs MUST have either a
  golden or an entry in the divergence report; the harness MUST print the count of unresolved
  `[verify]` items as part of its summary (`T-TST-003`).

## 7. Fuzzing (SEC-§7)

| Target | Mutator | Invariants |
| --- | --- | --- |
| Container (`openSwf`) | byte flips, truncations, length-field tampering, zlib bombs | no uncaught exception; bounded memory; diagnostics in range; every ref inside file bounds |
| Tag decoders | structure-aware mutations (lengths, indices, counts) | no crash; every error path yields a diagnostic; no infinite loop (per-decoder timeout) |
| Action streams | opcode-level mutations, branch-target tampering, pool corruption | no crash; residual fallback always available; ir never contains out-of-range offsets |
| Emitter/verify | mutated manifests/assets | `verify` reports, never throws |

- **IMPL-140-R016** Fuzz runs MUST be reproducible from a recorded seed and MUST keep a corpus of
  crashers under `test/fuzz/corpus/` (with a regression test per crasher).
- **IMPL-140-R017** Memory and time bounds per case: 256 MiB RSS and 5 s wall clock (doc 020's caps);
  a violation is a bug, not a slow test.
- **IMPL-140-R018** The harness MUST run a bounded fuzz pass in CI (e.g. 60 s per target) and a long
  pass nightly, reporting coverage guidance rather than a pass/fail on the nightly run.

## 8. Coverage accountability

- **IMPL-140-R019** Every diagnostic code defined across `docs/impl/*` MUST be listed in a registry
  (`tools/impl-status --codes`) with: emitter location, at least one test that triggers it, and its
  severity. A code with no test fails the `T-SWF-010`-style range/coverage check at milestone gates.
- **IMPL-140-R020** Every `T-*` test id appearing in an impl doc MUST exist in the test tree, and every
  test MUST reference its `T-*` id in its name; the tool diffs the two directions
  ("documented but not implemented", "implemented but not documented").
- **IMPL-140-R021** `tools/impl-status` generates `docs/impl/STATUS.md` (per-doc WP counts, done/total,
  dev-day totals, open-item counts, ✅/⏳ state, diagnostic codes, and test ids) and MUST be
  deterministic so it can live in review diffs.

## 9. Work packages

| WP | Title | Depends | Est | Deliverable |
| --- | --- | --- | --- | --- |
| WP-140-01 | Writer core: movie/tag builders, defect application | WP-010-12 | 5 | `test-support/*`, T-SWF-003 fixtures |
| WP-140-02 | Writer coverage for all decoders (per impl doc) | grows with each doc | 8 | helpers per tag |
| WP-140-03 | Oracle runner + capture format + external storage layout | REPO-§9 | 6 | `tools/oracle/*` |
| WP-140-04 | Metrics: SSIM, alpha RMS, null-RMS, clicks, drift, state diff | — | 6 | `metrics/*`, T-TST-001 |
| WP-140-05 | Gate runner + waivers + report | WP-140-04 | 4 | `tools/conformance/*`, T-TST-002 |
| WP-140-06 | Golden management (provenance, update flow, CI guard) | WP-140-05 | 3 | T-TST-003 |
| WP-140-07 | Fuzzers: container, tags, actions | WP-140-01, doc decoders | 6 | `test/fuzz/*`, crasher corpus |
| WP-140-08 | `impl-status` tool: WP index, STATUS.md, code/test registries | docs/impl | 4 | `tools/impl-status` |
| WP-140-09 | CI wiring: bounded fuzz, double-build determinism, gate selection | REPO-§8 | 3 | CI jobs |
| WP-140-10 | Appendix A fixture: writer recipe, decoder assertions, committed bytes | WP-140-01, docs 010/020/030/060 | 2 | `fixtures/appendix-a.swf` + goldens, T-TST-101/102 |
| WP-140-11 | Appendix B/C machine checks wired into the gate (tag index, palette) | WP-140-05, docs 020/110 | 1.5 | `tools/appendix-check`, T-TST-103/104 |
| | **Total** | | **48.5** | |

## 10. Done criteria

1. Every fixture in every impl doc is produced by the writer, and the writer covers every construct a
   decoder reads.
2. Metrics have analytic unit tests; gates run on the corpus and report worst-case offenders.
3. Waivers exist only where listed in `build-info.json`, with expiry dates.
4. The Appendix A bytes are committed and re-emitted byte-identically; the Appendix B and C checks
   run in CI and fail on any drift of `APP-§2`, `APP-§10.12` or `IMPL-110` §6.
4. Fuzzers run clean for their bounded CI budget, with a crasher regression test for every historical
   finding.
5. `docs/impl/STATUS.md` is generated, deterministic, and up to date at every merge.

## 11. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Harness specification derived from TST/SEC/REPO design specs; writer is the load-bearing component |
| 1.1 | 2026-10-04 | Appendix pass: §2.1 added (Appendix A byte-exact fixture with the byte/field assertion table, Appendix B tag-index check, Appendix C palette check); `T-TST-101`–`104` defined; WP-140-10/11 added (48.5 d) |
