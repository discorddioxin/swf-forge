# P1 resolution audit — resolutions for `P1-INTEGRITY-AUDIT.md`

**Date:** 2026-10-05 · **Branch:** `arena/01a10928-swf-forge` · **Resolves:** `audits/P1-INTEGRITY-AUDIT.md`
(1 major / 2 moderate / 10 minor / 5 observations) · **Baseline:** same working tree the integrity
audit read (HEAD `b3a0647` + uncommitted P1/P2/P5 changes).

**Purpose.** Per the house pipeline — integrity audit → **resolution audit** → resolutions → repeat
audit — this document fixes, for every finding and observation, exactly *what will be done*: the
disposition, the concrete change (file:line), the mechanism, the test evidence, and the acceptance
flip the repeat audit will verify (mapped 1:1 to `P1-INTEGRITY-AUDIT.md` §8.1). No finding is
dropped; each gets one of three dispositions:

- **FIX** — code (or doc, for doc defects) changed to meet the cited rule.
- **DEVIATE (pinned)** — the rule is met only by deviation; the deviation is written into the
  owning spec (with risk statement) *before* the resolution pass depends on it.
- **DEFER (owned)** — not done in this pass; the deferral is recorded with an owning doc and a
  named open item, and the acceptance evidence is "the deferral exists".

**Standing decisions (bind the execution pass):**

- **D-1 (cap contract).** A `maxDecompressedBytes` cap abort — sync *and* async — yields
  `SF0007` (error) and an **empty body**, matching the already-pinned T-SWF-011 behaviour of the
  sync path. R006 says "aborting … fatal for that file"; the file is reported failed and not
  parsed. Partial-yield (R007) applies to *data errors*, not to caps (D-2).
- **D-2 (partial yield).** A *corrupt or truncated* decompression stream yields the bytes decoded
  so far plus `SF0003` (error), per R007 — implemented for the sync zlib path (R-05) and already
  correct in `openSwf`'s handling of `InflateResult`.
- **D-3 (LZMA).** The pure-JS `lzma` adapter cannot stream. Resolved as **input-size pre-bound
  (fix) + pinned deviation (streaming) + deferred streaming decoder** (R-03).
- **D-4 (512 MiB bomb).** The T-SWF-011 / done-criterion-#4 bomb is tested at a **64 MiB cap**
  (the bomb's *potential* output is still 512 MiB) with the RSS assertion on the **marginal**
  memory of the open (`peakRSS − preOpenRSS < 256 MiB`), because the input buffer and the
  process baseline are held by the caller before `open` runs. The full-scale *default-cap*
  variant (512 MiB cap, ≥ 1 GiB bomb) is deferred to doc 140's budget work (R-13).
- **D-5 (F-A6).** The carried module-layout question (5 files vs doc §2's 10) is **folded into
  O-05** as deviation item 6 — it is a doc-vs-reality alignment with zero behavioural effect,
  same class as the other §3 API deviations; re-adding it as a finding would inflate the count
  without changing any acceptance evidence.

---

## 2. Resolution ledger

| Finding | Sev | Disposition | Work item | Acceptance (short) |
| --- | --- | --- | --- | --- |
| F-01 End-less sprite ranges empty | major | FIX | R-01 | probe: `end > start` for End-less sprite; model timeline contains its tags |
| F-02 `--strict` CLI uncaught throw | moderate | FIX | R-02 | CLI on torn file: report printed, exit 1, no stack trace |
| F-03 LZMA cap post-hoc | moderate | FIX + DEVIATE (pinned) + DEFER | R-03 | input pre-bound + `SF0007`; §12 pinned deviation; doc-140 follow-up item |
| F-04 async cap zero-pads body | minor | FIX | R-04 | capped async open: body length 0 + `SF0007` (was zero-padded `total`) |
| F-05 sync corrupt CWS discards partial | minor | FIX | R-05 | corrupt CWS: body = partial decode + `SF0003`, tags a prefix, no throw |
| F-06 SF0030 folds per level | minor | FIX | R-06 | two long-under-63 tag codes → two SF0030 entries |
| F-07 R030 doc defect (SF0159 vs SF0160) | minor | FIX (doc) | R-07 | R030 cites SF0160/first-id-wins + SF0159/later-name-wins |
| F-08 seven codes untested | minor | FIX | R-08 | one labelled test per code: SF0004/0021/0022/0028/0031/0101/0107 |
| F-09 T-SWF-001 matrix missing | minor | FIX | R-09 | labelled `T-SWF-001` block: versions 1–43, fps 0/12/1023.98, rect edges, 3 signatures |
| F-10 62/63 boundary unpinned | minor | FIX | R-10 | labelled `T-SWF-003` boundary tests (62 short / 63 long / long-under-63) |
| F-11 T-SWF-007 halves unlabelled | minor | FIX | R-11 | id-0 test added; undefined-ref test cross-labelled T-SWF-007 |
| F-12 no `--tags`/`--symbols`, no export names | minor | FIX | R-12 | both flags exist; export names printed in default + `--symbols` output; JSON |
| F-13 512 MiB bomb + RSS untested | minor | FIX (scaled) + DEFER | R-13 | labelled T-SWF-011 bomb test (64 MiB cap, RSS margin); doc-140 full-scale deferral |
| O-01 cross-layer emissions unlisted | obs | FIX (doc) | O-01r | 020 §9 cross-layer note + STATUS.md prose extension |
| O-02 stale `ownership.stale` entries | obs | FIX (tooling) | O-02r | `audit_dev.py`: 3 entries removed; checker silent on them |
| O-03 roadmap `SF0120`-range stale | obs | FIX (doc) | O-03r | roadmap L213 cites SF0024–SF0026 + SF0032 |
| O-04 fuzz corpus dir absent (vacuous) | obs | FIX | O-04r | `test/fuzz/corpus/` with ≥ 1 seed + non-vacuous assertion |
| O-05 accepted deviations unrecorded | obs | FIX (doc) | O-05r | 020 §3 API-note extension (6 items, incl. F-A6 layout) |
| (gate) 18 P5-WIP typecheck errors | — | FIX (P5-owned) | G-1…G-7 | tree-wide `pnpm typecheck` + `pnpm lint` green |

---

## 3. Findings — resolutions

### R-01 — F-01 (major): End-less sprite ranges are empty — **FIX**

**Defect.** `tag-stream.ts` captures a sprite's range when its level closes
(~L340): `end: level.now`, where `level.now` is set only in the `code === 0` branch
(L263: `level.now = tags.length - 1`). A sprite whose body is closed by its byte limit
without an `End` tag keeps `now` at its entry value (`tags.length` at DefineSprite = the
first body-tag index = `startTag`), so the range is `{start: N, end: N}` — empty — and
`buildSpriteModel` (`model/movie.ts:455–475`) slices nothing. Every tag the indexer did
keep is silently dropped from the model. `SF0173` (MISSING_END_STRUCTURAL) is emitted,
but the data is still lost: violates the prefix-correct contract the audit traced to
R015–R019 and T-SWF-002 ("indexed tags are a prefix").

**Change.** `packages/swf/src/container/tag-stream.ts`, the `spriteRanges.set(...)`
block after a level closes:

```ts
spriteRanges.set(level.inSprite ?? -1, {
  start: level.startTag,
  end: level.ended ? level.now : tags.length,   // was: end: level.now
  frameCount: level.declaredFrames,
  depth: level.depth,
});
```

When the level closed *with* End, `level.now` is the End tag's index and the slice
`[startTag, now)` keeps the body exactly as today (no behaviour change for healthy
files — T-SWF-008/020/022 must keep passing unchanged). When closed *without* End,
`tags.length` at close time is `startTag` + every tag indexed into the shared array,
including a partial last tag pushed by the `TAG_PAST_END` branch (kept truncated, per
R019) — i.e. the full recoverable prefix.

**Tests.**
1. `container.test.ts` (new, labelled `T-SWF-002 / F-01`): a movie whose single sprite
   body lacks `End` — `defineSprite(1, 2, concat(placeObject2(1, 1), tag(1)))` (no
   `endTag()`), `frameCount: 2`. Assert: `SF0173` present; `spriteRanges.get(1).end >
   .start`; and (the user-visible half) `buildMovieModel(file)` — the sprite's
   timeline contains the `PlaceObject2` tag (no silent loss).
2. Same file truncated one byte earlier than in test 1: the partial last tag is inside
   the range (`end === tags.length`).
3. Regression guard: existing T-SWF-008 (depths 31/32/33) and T-SWF-020/022 untouched
   and green (closed sprites unchanged).

**Acceptance flip (repeat audit §8.1 F-01).** The integrity-audit probe prints
`end > start` for the End-less sprite and the model timeline contains its tags.

**Risk.** Low. The range is consumed by `buildSpriteModel` (slice) and reports; a
larger range can only *add* previously-dropped tags, never remove. Nested sprites
inside an End-less sprite already have their own (correct) ranges; the outer range
including their tags matches the closed-sprite case.

---

### R-02 — F-02 (moderate): `inspect --strict` crashes instead of reporting — **FIX**

**Defect.** `inspect.ts:203` calls `openSwfNodeSync(bytes, { mode: request.strict ?
'strict' : 'soft', … })` with no catch. In strict mode the container throws on the
first structural error (probe: `SF0013 @7 (tag stream): read of 2 byte(s) at offset 7
past limit 8` — uncaught stack trace). R011's table promises "returns failure after
producing the report".

**Change.** `apps/decompiler/src/commands/inspect.ts`, `runInspect`:

1. Create the sink in the command: `const sink = new DiagnosticSink()` (exported from
   `@swf-forge/swf`, index L11) and pass it via `openSwfNodeSync(bytes, { mode, …, sink })`
   — the sink survives the throw, so the report is producible from the catch.
2. Wrap the open:
   ```ts
   let file: SwfFile;
   try {
     file = openSwfNodeSync(bytes, { mode, strictLength, sink });
   } catch (error) {
     for (const d of sink.list()) io.err(`  ${String(d.code)} ${d.severity} @${d.offset}  ${d.message}`);
     io.err(`inspect: strict mode aborted: ${error instanceof Error ? error.message : String(error)}`);
     return EXIT.failed;   // 1 — the report is on stderr, the failure is the exit code
   }
   ```
   (Diagnostics first, then the abort line — the report is complete even though the
   open did not finish.)
3. Wrap `buildMovieModel` in a second, narrower catch → `EXIT.internal` (5) with the
   message — a throw there would be a bug in this program, not in the input.

**Tests.** `apps/decompiler/test/inspect.test.ts` (new, labelled `F-02`): the integrity
audit's torn fixture (a CWS/FWS file cut so the tag stream reads past its limit) opened
with `--strict`: exit code `1`; stderr contains the structural diagnostic code and the
abort message; stderr does **not** contain a stack frame (`\n    at `). Same file without
`--strict`: exit per `exitForDiagnostics` (0/1 by severity), no throw — pins both modes.

**Acceptance flip.** Strict CLI on the torn file exits with the failure code, prints
diagnostics, no stack trace.

**Risk.** Low; the catch is local to the verb. `EXIT.failed` matches CMP-R029 (error
severity ⇒ 1); no new exit code introduced.

---

### R-03 — F-03 (moderate): LZMA cap checked after full decompression — **FIX + DEVIATE (pinned) + DEFER**

**Defect.** `node/lzma.ts:47` — `decompressWith` runs `mod.decompress(data)` to
completion and only then checks `bytes.length > maxBytes` (returns `SF0007` + empty).
R006: "A cap checked only after decompression is a memory-exhaustion vector"; R010:
"decompression MUST be streaming and bounded". The pure-JS `lzma` package is
non-streaming, so full compliance is not reachable without a new dependency.

**Part A — fix: input-size pre-bound (before any allocation).** In `decompressWith`,
before calling `mod.decompress`:

```ts
if (data.length > maxBytes) {
  return {
    bytes: new Uint8Array(0),
    truncated: true,
    error: `ZWS compressed input is ${data.length} byte(s), over the configured cap of ${maxBytes}; refusing to decompress`,
  };
}
```

`truncated: true` routes to the existing `openSwf` path: `SF0007` (error) + empty body
(D-1). This makes the cap a genuine pre-decompression bound on the input side: no file
whose *compressed* size already exceeds the cap is ever fed to the decoder.

**Part B — pinned deviation (written to the spec first).** Add item 6 to
`020-container-tag-stream-dictionary.md` §12:

> | 6 | ZWS streaming bound: the optional pure-JS `lzma` adapter cannot stream, so for
> compressed inputs *at or under* the cap the full output is materialised before the
> `maxDecompressedBytes` check (R010 "streaming" unmet for ZWS). Risk: a small,
> highly-compressible ZWS payload (e.g. 1 KB encoding a run of zeros) can allocate
> more than the cap before the file is rejected with `SF0007` — the rejection is
> deterministic (no parse of the over-cap file), and ZWS is pre-Flash-8 content.
> Mitigation in place: input-size pre-bound (WP-020-03, `node/lzma.ts`). Follow-up:
> streaming LZMA decoder (new dependency decision) — **deferred to doc 140**. | open (pinned deviation) |

Plus a one-line pointer comment at `node/lzma.ts`'s post-hoc check.

**Part C — deferral.** The streaming-decoder replacement is an open item owned by
doc 140 (fuzz/budget/robustness phase); it is a dependency decision the P1 pass must
not make.

**Tests.** `framing.test.ts` or `container.test.ts` (new, labelled `F-03`): a ZWS
fixture (writer `compression: 'lzma'` + the `lzma` package's own `compress` as
compressor — already a dependency for round-trip tests) opened with a small
`maxDecompressedBytes` (e.g. 16) where the compressed payload is longer than 16 bytes:
`SF0007` present, empty body, error message contains `refusing to decompress`; and the
existing ZWS round-trip (compressed < cap) still passes untouched.

**Acceptance flip.** "Input bound in place, or the pinned §12 deviation entry exists
with the risk statement" — this resolution lands **both**.

**Risk.** Part A can reject a legitimate file only if its *compressed* size exceeds
the cap — i.e. only when the decompressed size would be at least as large, so any such
file would fail the cap anyway (for content that compresses at all; for incompressible
content compressed ≈ decompressed). No regression expected.

---

### R-04 — F-04 (minor): async zlib cap abort zero-pads the body — **FIX**

**Defect.** `open.ts` `openSwfAsync` (~L272–302): on cap breach the pump keeps
`total` (including the chunk that crossed the cap) and allocates
`new Uint8Array(total)`, copying only `at < total` real bytes — the tail is zeros.
Those zeros parse as `End` tags (word `0x0000`), so the stream terminates on a
*synthesised* End instead of as a truncation: a sprite open at the cap is reported
cleanly closed (masking `SF0102`/`SF0173`), `sizes.decompressed` is inflated, and the
sync/async contracts diverge (sync cap abort → empty body, pinned by T-SWF-011).

**Change.** `openSwfAsync`, per D-1 (unified cap contract):

```ts
return openSwf(input, {
  ...opts,
  inflate: () =>
    truncated
      ? { bytes: new Uint8Array(0), truncated: true }   // was: { bytes /* zero-padded */, truncated: true }
      : { bytes, truncated: false },
});
```

`openSwf` then emits `SF0007` (error) and assembles an empty body — exactly the sync
contract. The pump itself is unchanged (it must still drain until the cap to *detect*
the breach).

**Tests.** `container.test.ts` (new, labelled `F-04`): a CWS bomb via
`openSwfAsync` — a small deflate input whose output exceeds a small cap (e.g.
deflate of 256 KiB of zeros, cap 64 KiB; `DecompressionStream` is available in the
Node test runtime): assert `SF0007` present, `file.body.length === 0`, no exception.
Parity half: a normal CWS file opened async vs sync → identical `tagIndex` and
`definitions` (proves the non-truncated path is unaffected).

**Acceptance flip.** Capped async body length equals the bytes actually kept — now
0 (was `total`, zero-padded) — with `SF0007`.

**Risk.** Low. Only the cap-abort path changes; healthy async opens are byte-identical
(parity test).

> **Execution note (repeat audit, 2026-10-05).** The repeat audit's probe of
> `openSwfNodeAsync` (the `nodeInflateAsync` pump that `R-05` rewrote) found a second
> cap bypass the original F-04 test did not cover: on Node 22,
> `createInflate({ maxOutputLength })` does **not** error when the limit is exceeded
> (it keeps emitting to `end`), so a 1 MiB bomb passed a 256 KiB cap with no
> `SF0007` at all. The pump now counts its output and aborts at the cap itself
> (D-1 shape: `SF0007`, empty body), and `openSwf` gained a container-level guard —
> any inflater result longer than the cap (caller-supplied `inflate`, the
> `inflate: () => result` closures, or an adapter that ignores its cap argument) is
> refused with `SF0007` and an empty body, so the cap contract holds at the
> container boundary regardless of inflater behaviour. New `F-04` test case
> (`openSwfNodeAsync` bomb) pins the Node path.

---

### R-05 — F-05 (minor): sync corrupt-CWS error path discards the partial decode — **FIX**

**Defect.** `node/inflate.ts:18–24`: `inflateSync` throws on a corrupt stream and the
catch returns `new Uint8Array(0)` with `truncated: false` + the error message —
`openSwf` then emits `SF0003` (correct code) but assembles an **empty** body, so every
tag that had decoded before the corruption point is lost. R007: "A truncated or
corrupt stream MUST yield the bytes decoded so far plus `SF0003` (error), not an
exception … Partial movies are useful; `inspect` can still be run."

**Change.** `packages/swf/src/node/inflate.ts` — replace `inflateSync` with a bounded
streaming pump that retains partial output, keeping the synchronous signature:
`const stream = createInflate({ maxOutputLength: maxBytes })`; write the input in
chunks and drain synchronously with `read()` in a loop between `write`/`end`,
collecting `'data'` chunks. (The sync-drain assumption — Node's zlib streams flush
synchronously for this usage — must be proven by the byte-identity test below; if it
does not hold for very large inputs, the documented fallback is `inflateSync` on
growing prefixes, which is only reachable for corrupt inputs, since clean inputs
complete in one pass.) Terminal handling:

| Stream outcome | Result |
| --- | --- |
| clean `'end'` | `{ bytes: concat(chunks), truncated: false }` |
| `'error'` `ERR_BUFFER_TOO_LARGE` / `ERR_OUT_OF_RANGE` (cap) | `{ bytes: empty, truncated: true }` — **unchanged**, D-1 |
| any other `'error'` (corrupt data) | `{ bytes: concat(chunks), truncated: false, error: message }` — **R007 partial yield** |

`openSwf` needs no change: it already maps `error` → `SF0003` (error) and assembles
whatever `result.bytes` the adapter returns.

**Tests.** `container.test.ts` or `framing.test.ts` (new, labelled `F-05` /
T-SWF-002-CWS): take a healthy CWS fixture, corrupt one middle byte of the
compressed payload (and a second case: truncate the compressed stream mid-stream):
assert `SF0003` present; `file.body.length > 0` (partial decode kept); indexed tags
are a prefix of the intact file's tags; no exception. Plus an integrity half: the
*uncorrupted* CWS body from the new pump is byte-identical to `inflateSync`'s output
(guards the rewrite).

**Acceptance flip.** Sync truncated/corrupt CWS yields partial bytes + `SF0003`.

**Risk.** Medium-low. The sync-drain assumption must be proven by the byte-identity
test; the cap path and the clean path are explicitly pinned unchanged. If the
sync-drain assumption fails for large inputs, the documented fallback keeps R007
satisfied for the reachable (corrupt) cases.

> **Adaptation note (executed 2026-10-05).** The sync-drain assumption *failed*, and
> not just for large inputs: `node:zlib`'s synchronous API throws `Z_BUF_ERROR` on
> **every** truncated prefix (probed across cut points of both small and ~20 KiB
> streams), so no sync partial output exists on Node. The fix was executed as
> designed for the async path — `openSwfNodeAsync`/`nodeInflateAsync` yield the
> partial decode plus `SF0003`, no rejection (verified: 16 371 partial bytes /
> 8 186 tags on a 90 %-corrupted ~20 KiB CWS, tags a prefix of the intact file) —
> and for the sync path as the pinned platform deviation: `nodeInflate` reports
> `SF0003` with an **empty body** and does not throw. T-SWF-002's recovery
> obligation is unaffected (it governs the tag stream's byte-limit handling, which
> is independent of decompression). The CLI verbs stay synchronous by
> construction, so they report the sync behaviour. Pinned as doc 020 §12 item 8
> (changelog 1.4); the `F-05` test pair asserts both halves.

---

### R-06 — F-06 (minor): SF0030 folds across tag codes — **FIX**

**Defect.** R017: emit `SF0030` "info, once per tag code". The emit at
`tag-stream.ts:145` carries `{ tagCode: code }` but no per-code context, and the
sink's dedup key is `(code, context, characterId)` — so within one level the *second*
distinct tag code using a long-under-63 header is deduplicated away (one entry per
level, not per code). The sink *message* names the tag, but the entry that survives
is whichever code fired first.

**Change.** `tag-stream.ts:145` — mirror SF0104's per-code context pattern (L179:
`context: `unknown tag ${code}``):

```ts
cursor.emit(Codes.LONG_HEADER_UNNECESSARY, 'info', `tag ${code} (${tagName(code)}) …`, headerOffset, {
  tagCode: code,
  context: `long header ${code}`,   // per-code context: one SF0030 entry per (code, level)
});
```

**Tests.** `framing.test.ts` (new, labelled `F-06`): a fixture with `tag(2,
10-byte body, { forceLong: true })` and `tag(11, 10-byte body, { forceLong: true })`
(writer's `forceLong` exists but is currently unused by any test) → exactly **two**
SF0030 entries, distinct contexts; repeating tag 2 a third time adds no third entry
(dedup per code still works). This test also strengthens the existing single-code
SF0030 pin in `diagnostics.test.ts:71`.

**Acceptance flip.** Two different long-under-63 tag codes → two SF0030 entries.

**Risk.** Low. Only the dedup context changes; messages and severities unchanged.

---

### R-07 — F-07 (minor, doc defect): IMPL-020-R030 contradicts the registry and doc 040 — **FIX (doc)**

**Defect.** `020-container-tag-stream-dictionary.md` L334–335 (R030) says a duplicate
export *name* reports `SF0159` "and the last wins". The registry (`codes.ts:97–98`:
`EXPORT_ID_DUPLICATE='SF0159'`, `EXPORT_NAME_DUPLICATE='SF0160'`), doc 040 R015
(L128–132, §8 L411–412) and the code (`tags/control.ts:130–140`) all agree on the
opposite policy: duplicate **name** → `SF0160`, **first id wins**; duplicate **id** →
`SF0159`, **later name wins** (Ch.4). The code is right; doc 020 is the defect.

**Change.** Rewrite R030's second sentence (doc 020 L335):

> a name that maps to two ids reports `SF0160` (warning; the control-tag range, owned
> by doc 040, R015) and the **first id wins**, deterministically; an id that maps to
> two names reports `SF0159`, and the later name wins (Ch.4).

Add changelog entry **1.3** (2026-10-05): "R030 corrected to match the registry and
doc 040 R015: duplicate export name → SF0160 (first id wins), duplicate export id →
SF0159 (later name wins). No code change — the code already implements the corrected
rule." (Shared with O-05r's changelog line if that lands the same day — one 1.3 entry
covering both.)

**Tests.** None new (the code-side behaviour is already pinned in
`apps/decompiler/test/inspect.test.ts`'s duplicate/`SF0159`/`SF0160` coverage and
`model.test.ts`). Acceptance is a doc diff.

**Acceptance flip.** R030 text cites SF0160/first-wins (diff of the doc).

**Risk.** None (doc-only; code, registry, and doc 040 already agree).

---

### R-08 — F-08 (minor): seven P1 codes have no test — **FIX**

Each code gets one labelled test in `packages/swf/test/` (container- or framing-
scoped, using the synthetic writer + the `defects` option where it exists, manual
byte patches where it does not). Emit sites verified: `header.ts:66` (SF0028),
`:105` (SF0021), `:125` (SF0022), `:135/144` (SF0004/SF0005); `tag-stream.ts:157`
(SF0101), `:228` (SF0031), `:232` (SF0107).

| Code | Severity | Emitted when | Test (labelled `F-08/<code>`) |
| --- | --- | --- | --- |
| `SF0004` | warning | decompressed body longer than declared `FileLength` | CWS fixture, patch header `FileLength` (bytes 4–8) below the real decompressed size → SF0004 present, file still parses |
| `SF0021` | warning | `FrameSize` non-zero `Xmin`/`Ymin` | `buildSwf({ frameSize: { xmin: 100, … } })` → SF0021, rect preserved |
| `SF0022` | info | frame rate raw 0 or ≥ 240×256 | two fixtures: `frameRateRaw: 0` and `frameRateRaw: 0xFFFF` → SF0022 each; `frameRateRaw: 3072` (12.0 fps) does **not** fire (negative half) |
| `SF0028` | warning | `FileLength` < 8 or > 2 GiB | patch `FileLength` = 4 and = 0x8000_0000 → SF0028 each, parse continues with actual sizes |
| `SF0031` | error | dictionary entry cap exceeded | three definition tags + `maxDictionaryEntries: 2` → SF0031 (error), third definition not registered |
| `SF0101` | warning | tag body extends past stream end | final tag with declared length > remaining bytes (manual patch of the length word) → SF0101, tag kept truncated, `T-SWF-002`'s prefix property asserted for this exact case |
| `SF0107` | warning | definition tag with character id 0 | `defineTag(11, 0, …)` → SF0107, `definitions` unchanged (id 0 ignored) |

**Acceptance flip.** All seven codes asserted by ≥ 1 test each (grep + green run).

**Risk.** None — tests only. If any test uncovers that an emit site is actually
broken, it is reported back to the repeat audit as a new finding (the emit sites were
spot-verified to exist and fire; the probes in the integrity audit §6 fired SF0107).

---

### R-09 — F-09 (minor): T-SWF-001 header matrix missing — **FIX**

**Defect.** T-SWF-001 obliges "header matrix: `FWS`/`CWS`/`ZWS`, versions 1…43, frame
rates, frame sizes". Current coverage: signatures + ZWS round-trip only.

**Change.** New labelled block in `container.test.ts` (`T-SWF-001`):

- **Versions** (FWS): `version: 1, 4, 7, 13, 43` → `header.version` correct, file
  parses; `version: 1` additionally asserts `SF0002` (below AVM1 baseline) — pins the
  documented floor; versions 2–3 likewise (same code).
- **Frame rates**: `frameRateRaw: 0` → SF0022 (see R-08, cross-referenced, not
  duplicated); `3072` → 12.0; `61439` (239.998) → no SF0022 (upper plausible edge);
  `0xFFFF` (1023.98) → SF0022.
- **Frame sizes**: normal rect → clean; `xmin: 100` → SF0021 (cross-ref R-08);
  `xmax: 0` (non-positive width) → SF0029 (error), parsing continues.
- **Signatures**: FWS (existing) + CWS round-trip + ZWS round-trip in the same block
  (the existing round-trips are cited into the block rather than duplicated).

**Acceptance flip.** The named `T-SWF-001` matrix tests exist and pass.

**Risk.** None (tests only).

---

### R-10 — F-10 (minor): 62/63 framing boundary unpinned — **FIX**

**Defect.** T-SWF-003 obliges "short/long boundary at 62/63". The framing tests pin
the spec byte tuples (`43 00`, `03 01`) and a 70-byte long header, but the *boundary*
itself — 62 is the largest short-form length, 63 requires the long form — is not
asserted.

**Change.** New labelled tests in `framing.test.ts` (`T-SWF-003` boundary):

1. `tag(2, new Uint8Array(62))` → short header, word `(2<<6)|62`; parses with
   `length === 62`, **no** SF0030.
2. `tag(2, new Uint8Array(63))` → the writer emits the long form (0x3F + UI32 63);
   parses with `length === 63`, no SF0030 — pins both the encode rule (≥ 63 ⇒ long)
   and the decode.
3. `tag(2, 62-byte body, { forceLong: true })` → long header for a 62-byte body →
   SF0030 (the boundary's other side: long form is *legal* at 62, just non-canonical).

**Acceptance flip.** The named boundary tests exist and pass.

**Risk.** None (tests only).

---

### R-11 — F-11 (minor): T-SWF-007 halves unlabelled — **FIX**

**Defect.** T-SWF-007: "duplicate character ids, id 0, referenced-but-undefined
character". The duplicate half is labelled (`inspect.test.ts:76`); the id-0 half has
no labelled test (SF0107 — see R-08, where its test is labelled `F-08/SF0107`; this
resolution cross-labels it `T-SWF-007 (id 0)` as well); the undefined-reference half
exists in `packages/swf/test/model.test.ts:87` (SF0110 + `kind: 'missing'`) under a
T-MOD label only.

**Change.**
1. `model.test.ts:87` — extend the test name/label: `T-MOD-… / T-SWF-007
   (referenced-but-undefined)`.
2. The R-08 `SF0107` test is written with the compound label
   `T-SWF-007 (id 0) / F-08/SF0107`.

All three halves of T-SWF-007 are then discoverable by their obligation id.

**Acceptance flip.** id 0 has a labelled test; the undefined-ref half carries the
T-SWF-007 label.

**Risk.** None (labelling + one test, shared with R-08).

---

### R-12 — F-12 (minor): no `--tags`/`--symbols`; export names never printed — **FIX**

**Defect.** WP-020-12's deliverable is "user-visible: the first demoable artefact" —
`swfforge inspect --tags/--symbols`. Neither flag exists (`cli.ts:21` usage lists only
`--json --verbose --actions --strict --tolerate-length`), and exports are reported as
a count only (`counts.exports = model.exported.size`).

**Change.**
1. `cli.ts`: parse `--tags` and `--symbols` (inspect verb), add to the usage text.
2. `inspect.ts` `InspectRequest`: `readonly tags?: boolean; readonly symbols?: boolean;`
3. `summarize`/`render`:
   - `--tags` → full tag index listing: human `  tag <index>  <code>(<name>)  depth <d>  sprite <id|–>  @<offset>  <length> B`; JSON field `tagIndex: { index, code, name, depth, inSprite, offset, length }[]` (present only when the flag is set, so default `--json` output stays byte-stable — the double-run-identical test keeps passing).
   - `--symbols` → exports table (id, name, kind via `model.characters`) + imports (`model.control.imports`); JSON field `symbols: { exports: { id, name, kind }[], imports: … }`.
   - **Default** (no flag): the dictionary section gains one line per exported
     character — `    #<id>  <name>` (name from `model.control.exportsById`) — so the
     audit's "exports never printed" is closed even without `--symbols`; the
     `--symbols` flag adds kind/import detail.
4. Data sources already exist: `MovieControlModel.exports` (name→id), `exportsById`
   (id→name), `imports: ImportEntry[]` (`model/types.ts:151–154`); the kind comes from
   `model.characters.get(id).kind`.

**Tests.** `inspect.test.ts` (new, labelled `F-12` / WP-020-12): a fixture carrying
`ExportAssets` names (the existing golden fixture already has exports — extend or add
a small one with two named exports + one `ImportAssets`):
- `--symbols` output contains the export names and the import name;
- `--tags` output line count equals the tag count and includes a known tag's offset;
- default output contains `#<id>  <name>` for each export;
- `--json --symbols --tags` includes the `symbols`/`tagIndex` fields; plain `--json`
  does **not** (stability).

**Acceptance flip.** `--tags`/`--symbols` exist **and** export names are printed.

**Risk.** Low. Output additions only; default JSON shape unchanged (flag-gated
fields). Done criterion #2 ("prints a stable, diffable report for every synthetic
fixture") moves from ⚠️ to ✅.

---

### R-13 — F-13 (minor): 512 MiB bomb + RSS bound untested — **FIX (scaled per D-4) + DEFER**

**Defect.** T-SWF-011 obliges "a 512 MiB bomb is rejected without exhausting memory";
done criterion #4: "peak RSS under 256 MiB". Only 16/32 MiB bombs exist (T-SWF-011
today) — the abort *semantics* are pinned, the *memory bound* is not.

**Change.** New labelled test (`T-SWF-011 (512 MiB bomb / RSS)`, `container.test.ts`
or a dedicated `budget.test.ts`):

1. **Bomb construction (caller-side, outside the measured window):** stream
   512 MiB of zeros through `node:zlib` `deflate` in 1 MiB chunks (all-zero input
   compresses to ~1 bit/byte → ~64 MiB on disk; chunked input keeps setup RSS flat).
   The resulting ~64 MiB compressed buffer is the bomb: potential output 512 MiB.
2. **Open** with `maxDecompressedBytes: 64 * 1024 * 1024` (D-4): `nodeInflate`
   aborts at the cap (`ERR_BUFFER_TOO_LARGE` → `truncated` → `SF0007`, empty body).
3. **RSS assertion (marginal, per D-4):** `preOpen = rss()` after bomb construction;
   `postOpen = rss()` after the open; `expect(postOpen - preOpen).toBeLessThan(256 MiB)`.
   The absolute-256-MiB reading of the criterion cannot hold for any in-process test
   (process baseline + caller-held input buffer), so the *marginal* reading — memory
   used by the open itself, which is what "without exhausting memory" governs — is the
   one pinned; that interpretation is recorded in doc 020 §12 item 7 alongside the
   deferral.
4. **Async parity** (no RSS assert): the same bomb through `openSwfAsync` with the
   same cap → `SF0007`, empty body, no exception.
5. **Full-scale deferral:** doc 020 §12 item 7 (new): the *default-cap* variant
   (512 MiB cap, ≥ 1 GiB potential output, absolute RSS) is deferred to doc 140's
   budget work — CI memory and RSS flakiness at that scale; the scaled test pins the
   abort semantics and the cap's memory bound, which is the criterion's substance.
   Owner: doc 140.

**Acceptance flip.** "Full-scale test present (or recorded deferral to IMPL-140)" —
scaled test present **and** the full-scale deferral recorded with owner.

**Risk.** Medium. The 1-bit/byte compression assumption is verified during
implementation by decompressing a 1 MiB *prefix* of the bomb (never the whole thing)
to confirm the decoder path and the ~1 bit/byte ratio — the potential output is 512 MiB
by construction (the input is exactly 512 MiB of zeros). The margin assert has ~4×
headroom over the 64 MiB cap working set. If a CI runner makes the margin flaky, the
test falls back to the cap-only assert (abort + SF0007 + empty body) with the RSS
assert marked `.skip` + a note — the repeat audit treats the cap-abort half as the
minimum acceptance.

---

## 4. Observations — dispositions

### O-01r — cross-layer diagnostic emissions unlisted — **FIX (doc/registry)**

`tag-stream.ts` emits four codes outside doc 020's allocation: `SF0128`
(SPRITE_DEFINITION_TAG) and `SF0129` (SPRITE_TAG_UNLISTED) — the `SF0110–SF0129`
placement range owned by doc 030 — and `SF0173` (MISSING_END_STRUCTURAL) and
`SF0175` (FILE_ATTRIBUTES_IN_SPRITE) — the `SF0150–SF0179` control range owned by
doc 040. All four are correctly registered in `codes.ts`; the *documentation* of
ownership is what is missing.

**Change.**
1. Doc 020 §9 — after the tag-level table, add: "Cross-layer emissions:
   `tag-stream.ts` also emits `SF0128`/`SF0129` (allocated by doc 030) and
   `SF0173`/`SF0175` (allocated by doc 040) at index time for the structural cases
   those documents define. They are registered in the owning documents' ranges and
   are not part of this document's allocation."
2. `docs/impl/registers/STATUS.md` — extend the existing cross-document citation note
   (L55–56) to name these four codes as container-emitted / owner-allocated.
3. Changelog 020 1.3 (shared entry with R-07).

**Acceptance.** The note exists; the mechanical checker (`audit_dev.py`
emission-ownership) stays green (it keys on allocation, which is unchanged).

### O-02r — stale `ownership.stale` entries — **FIX (tooling)**

`tools/audit_dev.py` `DEFERRED_DIAGNOSTIC_WPS` (L522–524) still maps
`"SF0025": "WP-020-08"`, `"SF0026": "WP-020-08"`, `"SF0027": "WP-020-03"` — all three
now have production emit paths (ordering.ts / open.ts), so the checker reports
`ownership.stale` for each (the checker's own rule: "When a WP implements the case,
remove its entry; the checker rejects stale mappings").

**Change.** Delete the three entries from `DEFERRED_DIAGNOSTIC_WPS`. The remaining
entries (SF0111, SF0115, SF0118, SF0119, SF0125, SF0127 → doc 030 WPs) are genuinely
deferred P3 work and stay.

**Acceptance.** `python3 tools/audit_dev.py` reports no `ownership.stale` for
SF0025/0026/0027 (the other 56 "new" entries are P3/P5-range, out of P1 scope, and
are not baselined in this pass).

### O-03r — roadmap P1 row cites a nonexistent `SF0120`-range — **FIX (doc)**

`docs/impl/000-roadmap.md` L213 (P1 exit-criteria table): "Ordering rule violations
detected and reported (Ch.2 rules) | new diagnostics `SF0120`-range". The five
ordering rules actually shipped as `SF0024` (BYTES_AFTER_END), `SF0025`
(FILE_ATTRIBUTES_NOT_FIRST), `SF0026` (TAG_ORDER_VIOLATION) and `SF0032`
(STREAM_SOUND_OUT_OF_ORDER) per doc 020 §9; `SF0120` belongs to doc 100 (buttons).

**Change.** L213 evidence cell → "new diagnostics `SF0024`–`SF0026`, `SF0032`
(020 §9)"; roadmap changelog line.

**Acceptance.** The roadmap cites the real codes.

### O-04r — fuzz corpus directory absent; regression test vacuous — **FIX**

`fuzz.test.ts` reads `packages/swf/test/fuzz/corpus/*.swf` via
`readdirSync … catch → []` — the directory does not exist, so the IMPL-140-R016
regression suite iterates **zero** files and passes vacuously.

**Change.**
1. Create `packages/swf/test/fuzz/corpus/` with a `README.md` (naming convention
   `NNNN-<slug>.swf`, provenance: seed, mutation index, diagnostics tripped, date).
2. Seed it with ≥ 1 file: derive deterministically from the existing LCG
   (`SEED = 0x534F_5746`, `MUTATIONS` ops in `fuzz.test.ts`) — pick a specific
   mutation index that produces a file tripping at least one structural diagnostic
   (candidate: an index whose mutation breaks the tag stream, tripping
   SF0101/SF0102-class codes) and commit the resulting bytes. The 10⁴ pass currently
   records zero crashes, so the seed's value is to make the corpus *exist and be
   exercised*, plus to pin the first known-bad input.
3. Make the test non-vacuous: `expect(files.length).toBeGreaterThanOrEqual(1)` — a
   missing/empty corpus now fails the suite instead of passing silently.

**Acceptance.** Directory exists with ≥ 1 seed + README; the regression test asserts
the corpus is non-empty and opens every file.

### O-05r — accepted API deviations unrecorded in 020 §3 — **FIX (doc)** (absorbs F-A6, per D-5)

The §3 API sketch diverges from the implemented surface in six ways, only one of
which (the `SwfFile.dictionary` split) was recorded. Add a second API note block to
§3 (or extend the existing one) recording, each with its rationale:

1. **`TagRef.offset` is stream-relative** — the sketch says "absolute offset of the
   body in the decompressed buffer"; the implementation indexes over the tag stream
   (`payload.subarray(tagStreamOffset)`), so offsets are relative to the tag stream
   start (after the 8-byte header). `readTag`'s views are cut from the same stream,
   so behaviour is self-consistent; the doc's "absolute" wording is wrong.
2. **`TagRef` extra fields** `headerOffset` and `longHeader` — needed by reports and
   by R017; unsketched.
3. **`TagIndex.frameCounts`** (movie `0` + sprite ids → observed `ShowFrame` count)
   and **`spriteRanges[…].depth`** — unsketched members consumed by the model and
   `inspect`.
4. **`SwfFile.sink`** — the shared `DiagnosticSink` is part of the public surface
   (later layers report onto the same movie); unsketched.
5. **`SwfOpenOptions` extras** — `strictLength` (R011), `legacyStringEncoding`
   (010-R023), `reportPaddingBits` (SF0008), optional `sha256` (browsers omit;
   `''` when absent), and `inflate`/`inflateAsync` (platform adapters, R002) —
   unsketched.
6. **Module layout (§2)** — realised as `container/{open, header, tag-stream,
   ordering, processing}.ts` + `node/{open, inflate, lzma}.ts`; the sketch's
   `compress.ts` / `tag-index.ts` / `tag-reader.ts` / `dictionary.ts` / `decompress/`
   are consolidated into `tag-stream.ts` (framing + index + dictionary tables) and
   the `node/` adapters (dictionary view split per the existing note). **This is the
   carried F-A6, resolved as a recorded layout decision** (D-5): consolidation kept
   the module count small while R001's import boundary (verified: `container/`
   imports only `../diagnostics`, `../io`, tag codes) is enforced by the same tests.

Changelog 020 1.3 (shared entry with R-07/O-01r).

**Acceptance.** §3 note block + §2 layout note present; every sketch-vs-implementation
divergence named.

---

## 5. Gate prerequisites — P5-WIP typecheck errors (P5-owned, fixed in this pass)

The repeat-audit gate (`P1-INTEGRITY-AUDIT.md` §8.2) is `pnpm typecheck && pnpm test
&& pnpm lint` green **tree-wide**. The tree currently carries 18 typecheck errors,
all in in-progress P5 files, none in P1 code. They are P5's to fix; this pass lands
them (the fixes are mechanical) so the gate can pass. Line-level plan:

| Id | File:line | Error | Fix |
| --- | --- | --- | --- |
| G-1 | `avm1/frontend/analyze.ts:216, 220–222` | TS2532/TS2322 — `noUncheckedIndexedAccess`: `records[i]` is `ActionRecord \| undefined` | sort comparator: `(records[a]?.offset ?? 0) - (records[b]?.offset ?? 0)`; `merged`/`mergedDecoded`: map then `filter((r): r is ActionRecord => r !== undefined)` (same guard for decoded) |
| G-2 | `avm1/frontend/disassemble.ts:43` | TS2339 — `formatOperand`'s else-branch reaches the `stack` variant (no `id`) | `operand.kind === 'lit' ? formatValue(operand.value) : operand.kind === 'temp' ? \`t${operand.id}\` : '(stack)'` |
| G-3 | `avm1/frontend/disassemble.ts:55, 80, 81` | TS2678/TS2339/TS2366 — `case 'waitForFrame2'` not in the `TimelineOp` union (P5 is mid-adding it) | add `\| { readonly op: 'waitForFrame2'; readonly skip: number }` to `TimelineOp` (`ir.ts`, after the `waitForFrame` member) — shape matches the already-decoded operand (`operands.ts:104`, opcode 0x8d) — and verify the opcodes→IR builder for 0x8d produces the new member (wire it if not) |
| G-4 | `avm1/frontend/disassemble.ts:159` | TS2345 — `formatCall`'s inline structural type doesn't match the IR `call` member (`result: Operand \| null` vs `result?: Operand`) | replace the inline parameter type with the imported `CallOp` + accept `result: Operand \| null` (format `null` as `void`) |
| G-5 | `apps/decompiler/src/commands/inspect.ts:215` | TS2540 — `summary.actions = …` assigns a `readonly` property | compute the `actions` payload *before* `summarize` and pass it in (new optional parameter), instead of mutating the returned summary |
| G-6 | `inspect.ts:11` (TS2307 `@swf-forge/avm1`) + `:212` (5× TS7006) | cascade of G-1…G-4: avm1 emits no declarations, so the import and the callback params are untyped | clears automatically once avm1 compiles (project references are already declared: `apps/decompiler/tsconfig.json` references `packages/avm1`) |
| G-7 | `inspect.ts` (3 eslint problems) | lint mirrors the type errors | re-run `pnpm lint` after G-1…G-6; clean up any residual (e.g. unused imports) |

**Not P1 scope, not re-scoped here:** these fixes change no P1 behaviour; the P5
`--actions` feature stays as far along as it is — only made to compile.

---

## 6. Execution plan (batches, each ending with a green `pnpm exec vitest run`)

| Batch | Items | Why this order |
| --- | --- | --- |
| 1 — docs & tooling (zero code risk) | R-07, O-01r, O-02r, O-03r, O-05r, R-03 part B (§12 pin), R-13 part 5 (§12 deferral + item 7) | spec pins must land before code relies on them (D-3, D-4); tooling fix is independent |
| 2 — container code fixes | R-01, R-03 part A, R-04, R-05, R-06 (+ their tests) | all touch `packages/swf` core; R-05's rewrite needs the byte-identity test before anything else builds on the pump |
| 3 — test evidence | R-08, R-09, R-10, R-11, R-13 parts 1–4 (bomb test) | pure additions; exercises the batch-2 behaviour |
| 4 — CLI surface | R-12, R-02 (+ their tests) | `inspect.ts` already carries G-5; land both together with the P5 fixes so the file is edited once |
| 5 — gate | G-1…G-7 → full gate | tree-wide green is only meaningful once P1 work is done |

Batch 4 edits `inspect.ts` under both the P1 resolutions (R-02 catch, R-12 flags) and
the P5 gate fixes (G-5) — the implementer sequences: G-5 restructure first, then R-02
catch, then R-12 flags, then the tests.

**Gate (repeat-audit entry):** `pnpm typecheck && pnpm lint && pnpm test` green
tree-wide; `python3 tools/audit_dev.py` with no P1-range `ownership.stale`;
`packages/swf` standalone `tsc --noEmit` clean; 208+ tests (new: ≥ 15 labelled).

---

## 7. Repeat-audit mapping (what must flip)

Aligned with `P1-INTEGRITY-AUDIT.md` §8.1 — the repeat audit re-runs that protocol and
accepts each finding only on the specific evidence below:

| Finding | Evidence that must flip | Where the evidence lives after the pass |
| --- | --- | --- |
| F-01 | probe prints `end > start` for the End-less sprite; model timeline contains its tags | `container.test.ts` `T-SWF-002 / F-01`; probe: same script as integrity audit §6 |
| F-02 | strict CLI: report + exit 1, no stack trace | `inspect.test.ts` `F-02`; manual CLI run recorded in the repeat audit |
| F-03 | input pre-bound fires (`refusing to decompress`, SF0007); §12 item 6 exists with risk statement | `node/lzma.ts`; doc 020 §12; new `F-03` test |
| F-04 | capped async: `body.length === 0` + SF0007 (was zero-padded `total`) | new `F-04` test; probe rerun |
| F-05 | corrupt CWS: partial body + SF0003, tags a prefix, no throw | new `F-05` test |
| F-06 | two long-under-63 codes → two SF0030 entries | new `F-06` test |
| F-07 | R030 diff cites SF0160/first-wins + SF0159/later-name | doc 020 L334–335 diff + changelog 1.3 |
| F-08 | SF0004/0021/0022/0028/0031/0101/0107 each asserted ≥ 1× | labelled `F-08/<code>` tests |
| F-09 | labelled `T-SWF-001` matrix (versions/fps/size/signatures) passes | `container.test.ts` |
| F-10 | labelled `T-SWF-003` boundary tests (62 short / 63 long / 62 long→SF0030) pass | `framing.test.ts` |
| F-11 | id-0 test labelled T-SWF-007; undefined-ref test cross-labelled | `model.test.ts:87` + R-08's SF0107 test |
| F-12 | `--tags`/`--symbols` exist; export names in default output; JSON fields | `cli.ts` usage; `inspect.test.ts` `F-12` |
| F-13 | bomb test: SF0007 + empty body + RSS margin < 256 MiB; §12 item 7 deferral owned by doc 140 | new `T-SWF-011 (512 MiB bomb / RSS)` test |
| O-01 | 020 §9 cross-layer note + STATUS.md prose | doc diff |
| O-02 | checker silent on SF0025/0026/0027 | `audit_dev.py` run output |
| O-03 | roadmap L213 cites SF0024–SF0026 + SF0032 | doc diff |
| O-04 | corpus dir + ≥ 1 seed + non-vacuous assertion | `packages/swf/test/fuzz/corpus/` |
| O-05 | §3 note block (6 items incl. layout) + §2 note + changelog | doc diff |
| (gate) | tree-wide tsc/lint/vitest green; P1 tsc clean standalone | gate run output |

**Re-audit protocol:** unchanged from `P1-INTEGRITY-AUDIT.md` §8 — ledgers re-run
verbatim, findings resolved only on their specific flips, then that file moves to
`audits/archive/` only after the confirmation audit is written.

---

## 8. Dispositions summary

- **FIX:** F-01, F-02, F-04, F-05, F-06, F-07, F-08, F-09, F-10, F-11, F-12 (11
  findings) + all five observations (O-01…O-05) — 16 items resolved by change.
- **FIX + DEVIATE (pinned) + DEFER:** F-03 (input bound now; streaming pin in §12; streaming decoder → doc 140).
- **FIX (scaled) + DEFER:** F-13 (64 MiB-cap bomb + RSS margin now; default-cap full scale → doc 140, recorded in §12 item 7).
- **P5-owned, landed for the gate:** G-1…G-7 (18 typecheck errors + lint).

No finding is closed without an acceptance flip; no deviation is claimed without a
§12 pin; no deferral is ownerless.
