# P3 Checkpoint C5 — Audio decode + asset emit

Auditor: Arena.ai Agent Mode
Branch: `arena/07fdceae-swf-forge`
Baseline: `25dff19` (C4)
Scope: `audits/P3-CHECKPOINTS.md` C5 and `docs/impl/decompiler/090-sounds.md` (WP-090-01…08, 10, 11).
Frame-subdivision emulation (WP-090-09, `T-AUD-114`) is P8 and transcode budgets (WP-090-12,
`SF0329`) are P6 — both out of scope.

## 1. Verdict

C5 is **complete and exit-ready**, and it is the worst checkpoint so far. Four defects in shipped
decode code, three of them in the ADPCM/PCM sample path — the part of the system whose entire job
is to produce the right numbers. The original C5 cut raised `E-030`; the scoped exit-readiness
follow-up added `E-031`/`E-032` and is recorded in §10.

The reason they survived is a single structural failure, and it is the finding that matters most:

> **`T-AUD-101` claims ADPCM is "bit-exact against reference vectors". Its "independent integer
> reference" was a second copy of our own decoder** — same step table, same delta formula, written
> out again in the test file. It could not disagree with the implementation about anything, and it
> did not. Two arithmetic defects sat underneath it through P1 and P2.

| Area | Expected | Actual |
|---|---|---|
| ADPCM | verify bit-exactness | step table wrong in 3 entries (`F-P3-19`); delta formula wrong for 33% of inputs (`F-P3-20`); the test that should have caught both was circular (`F-P3-21`) |
| PCM | verify endianness | 8-bit read as signed — silence decoded as full-scale negative (`F-P3-22`); format 0 read big-endian against all evidence (`E-030`) |
| MP3 | verify pass-through | correct; needed a hash test, not a fix |
| Stream model | verify splitting | correct; `T-AUD-108`'s codec-change half was untested |
| Chunking / peak / RMS | extend | **not implemented at all** — genuinely new (`measure.ts`) |

## 2. The ADPCM arithmetic

### 2.1 `F-P3-19` — three wrong entries in the step table

The 89-entry IMA/DVI step table is shared verbatim by every ADPCM implementation. Ours had:

| index | ours | IMA / `ruffle` |
|---|---|---|
| 69 | 5360 | **5358** |
| 70 | 5897 | **5894** |
| 71 | 6487 | **6484** |

Any sound whose predictor reaches that part of the table — ordinary mid-level content — decoded
differently from every other player. `T-AUD-004` checked `[0]`, `[88]` and the length, which is
exactly the shape of check that cannot find this. It now compares all 89 entries against a
separately-sourced copy.

### 2.2 `F-P3-20` — the delta formula was the idealisation, not the algorithm

`decodeCode` computed

```
delta = floor(((2 * magnitude + 1) * step) / 2^(bits - 1))
```

citing it as "SWF Ch.11's DELTA_FN". That expression is what IMA's reconstruction *approximates*;
it is not what IMA computes. IMA accumulates right-shifted terms and truncates **each one
separately**:

```
delta = step >> (bits - 1)
for bit k in 0 .. bits - 2:  if magnitude & (1 << k):  delta += step >> (bits - 2 - k)
```

For `bits = 4`, `step = 7`, `magnitude = 1`: the closed form gives `floor(21/8) = 2`; IMA gives
`(7>>3) + (7>>2) = 0 + 1 = 1`.

Across the 89 steps and all four code widths the two disagree on **884 of 2670** (step, magnitude)
pairs, by up to 3 LSB. Because the result feeds a recursive predictor, those errors accumulate
along the stream rather than averaging out — and they also perturb nothing else, so the output
stays plausible-looking audio. This is the failure mode a bit-exactness test exists to catch.

The production decoder now uses one generalised loop. That generalisation was itself verified
against `ruffle`'s four hand-written per-width closures over every `(step, magnitude)` pair:
**0 mismatches**.

### 2.3 `F-P3-21` — the reference was not a reference

`packages/audio/test/adpcm.test.ts` contained `referenceDecode`, introduced by `T-AUD-101` as "an
independent integer reference" checked over 200 seeded packets. It declared its own
`REFERENCE_STEP_TABLE` — with the same three wrong entries — and its own delta line — the same
closed form. The two agreed perfectly, because they were the same thing written twice.

A test like this is worse than no test. It consumes the budget of the obligation it names, reports
green, and makes the claim "bit-exact against reference" look discharged in the audit trail.

The rebuild keeps the 200-packet structure but changes what it compares against:

- `REFERENCE_STEP_TABLE` is transcribed from the IMA reference and cross-checked against `ruffle`.
- `REFERENCE_DELTA` is `ruffle`'s **four explicit closures**, transliterated one per code width.
  The production code is one loop; the reference is four unrolled functions. They are structurally
  different statements, so a generalisation bug in either shows up as a disagreement.
- The frozen mono/stereo vectors are worked out by hand in a comment, from the algorithm, not
  captured from a run.
- A new case pins the closed form as *wrong*: it asserts the 884-pair disagreement count, so
  "simplifying" the loop back to the one-line formula fails here rather than quietly detuning
  every ADPCM asset.

The packet-length question was open at the original C5 audit and has since been settled by `E-031`:
`InitialSample` is emitted, for 4096 samples per packet. In the decisive real `DefineSound` corpus,
412 payloads match the 4096 prediction and none match `ruffle`'s 4095 reading. Both readings consume
the same bits, so neither desynchronises; they differ by one output sample per packet. The separate
short-payload residual exposed a diagnostic false-positive and is resolved by `E-032`/§10; its
precise authoring cause remains unproven, not the packet length.

## 3. The PCM defects (`E-030`)

### 3.1 `F-P3-22` — 8-bit samples are unsigned

`decodeSwfPcm` read 8-bit `SoundData` as two's complement. SWF 8-bit PCM is **unsigned**, as in
RIFF/WAV and as `ruffle`'s `PcmDecoder` reads it. The consequence is not subtle:

| byte | meaning | ours (before) | correct |
|---|---|---|---|
| `0x80` | silence | **−32768** (full-scale negative) | 0 |
| `0x00` | negative rail | 0 | −32768 |

Every 8-bit uncompressed sound decoded to an inverted, half-scale-offset waveform. `T-AUD-103`
pinned it, in a test whose title announced the bug: *"expands **signed** 8-bit samples"*.

We expand as `(byte - 128) * 256`, the standard full-scale conversion. `ruffle` uses
`(byte - 127) * 128`, which spans only [−16256, +16384] — half scale. For a preview WAV, full
scale is the right choice; the divergence is documented at the call site.

### 3.2 Format 0 endianness — a judgement call, not a bug

Ch.11 calls format 0 "uncompressed, **native-endian**". That names the *authoring* machine and is
not recoverable from the file. `REPO-R013` forbids using the build host's order, so one order must
be fixed — but the repo had fixed it to **big-endian**, and determinism is the only argument that
supports that choice. Correctness points the other way:

- `ruffle` routes `UncompressedUnknownEndian` into the same little-endian decoder as format 3, with
  the comment *"Cross fingers that it's little endian."*
- Format 3 exists because format 0 was unusable; Flash wrote little-endian from SWF 4 onward.
- Picking the losing side of this coin flip does not make output non-deterministic — it makes it
  deterministically byte-swapped noise.

Changed to little-endian. `SF0302` survives but is reworded: it no longer claims 8-bit has an
endianness, and it now records *that an assumption was made* rather than asserting a decision.
Raised as **`E-030`**, with `IMPL-090-R006` rewritten and the registry entry corrected.

I want to be straight about the status of this one: it is a choice between two defensible readings
where the evidence strongly favours one. It is not in the same category as §2 and §3.1, which are
simply wrong.

## 4. New: `packages/audio/src/codecs/measure.ts` (WP-090-11)

Chunking, levels and loop/trim metadata did not exist. `IMPL-090-R030`–`R033` now have an
implementation.

| Export | Purpose | Rule |
|---|---|---|
| `measureAudio(options)` | peak, RMS, dBFS, null gate, chunk table, trimmed loop | `R030`–`R033` |
| `CANONICAL_SAMPLE_RATE`, `CHUNK_SECONDS` | 48 000 / 10 s | `R030`, `AST-R031` |

Two decisions worth stating:

**The trim is applied before everything else.** `IMPL-090-R032` requires `trim.lead` to be removed
*before* loop points are computed, because a loop point measured against the untrimmed stream lands
`lead` samples late and clicks. So the measured duration, the chunk boundaries, the levels and the
loop are all expressed against the trimmed timeline — and a loop the trim destroys is reported as
`loop: null, loopClamped: true` rather than silently inverted into a negative range.

**Full scale is 32768, not 32767.** `Int16Array` is asymmetric; using 32767 would make a sample at
the negative rail report a peak above 1.0.

Wired into `assets dump`: PCM-backed WAV assets carry `audio.{peak, rms, rmsDbfs, silent,
belowNullGate, durationSamples, chunks[]}`. MP3 is deliberately not decoded or re-encoded: its
manifest retains frame/sample/seek metadata and now explicitly marks PCM measurement as
`unavailable-pass-through`, rather than claiming zero levels.

## 5. Scope items

| # | Item | Status |
|---|---|---|
| 1 | Codec dispatch, lazy payload, `SF0301` | ✅ pre-existing |
| 2 | ADPCM bit-exact; framing, 4096-packet boundary, real payload lengths, short-final vs malformed truncation | ✅ **two arithmetic fixes**; `T-AUD-101` rebuilt; `T-AUD-102` extended for E-031/E-032, including final- and earlier-packet cases |
| 3 | PCM format 0 vs 3 | ✅ **two fixes** (`E-030`), `T-AUD-103` rewritten |
| 4 | MP3 frame header parse, 414-byte example | ✅ pre-existing `T-AUD-104`, verified against `IMPL-090-R009` |
| 5 | MP3 pass-through, hash equality, latency trim | ✅ correct; `T-AUD-105` written |
| 6 | Nellymoser/Speex/reserved fallback | ✅ pre-existing `T-AUD-115` |
| 7 | `SOUNDINFO` | ✅ pre-existing `T-AUD-109` |
| 8 | Stream model, offsets, splitting, codec change | ✅ `T-AUD-108` written (codec-change half was untested) |
| 9 | Resample to 48 kHz, deterministic | ✅ pre-existing `T-AUD-110` |
| 10 | Chunking + loop/trim + peak/RMS | ✅ **new** `measure.ts` + manifest wiring |
| 11 | WP-090-09 / WP-090-12 | deferred, as scoped |

## 6. Tests

| Suite | Tests | Covers |
|---|---|---|
| `packages/audio/test/measure.test.ts` (new) | 18 | `T-AUD-111`, `T-AUD-112` |
| `apps/decompiler/test/audio-assets.test.ts` (new) | 10 | `T-AUD-105`; manifest half of `111`/`112` |
| `packages/swf/test/sound-stream-split.test.ts` (new) | 6 | `T-AUD-108` incl. codec change |
| `packages/audio/test/adpcm.test.ts` | rebuilt | `T-AUD-101` de-circularised; `T-AUD-004` full table |
| `packages/audio/test/media-codecs.test.ts` | rewritten | `T-AUD-103` per `E-030` |

Suite totals: **55 files / 640 tests → 58 files / 676 tests**, all passing. Test-cited ids
205 → 210.

Two fixture notes, because both were initially wrong in a way that would have made the test
meaningless:

- The level fixtures use a **DC** signal, not a square wave. An alternating-sample square sits
  exactly at Nyquist and the 44.1 → 48 kHz linear resampler attenuates it to ~0.29 RMS; asserting
  0.5 there would have been a test of the resampler's frequency response wearing a metadata test's
  name. DC passes through linear interpolation unchanged, so peak and RMS are exactly 0.5.
- The chunk-boundary fixture asserts boundaries on the **resampled** timeline (528 000 frames from
  11 s of 44.1 kHz audio, splitting at 480 000), because a boundary computed on the source rate
  would land somewhere else and still look round.

## 7. Gate sweep

| Gate | Result |
|---|---|
| `typecheck` | clean |
| `lint` (eslint + prettier) | clean |
| `vitest run` | 58 files, 676 tests, all pass |
| `spec:verify` | `ISSUES: 0` |
| `tag:coverage` | all 65 tags dispositioned |
| `test:audit` | 20 tests, OK |
| `audit:dev` | `findings=52 known=57 new=0 fixed=5` |

Diagnostic census unchanged at 188 registry codes / 173 sink-emitted / 2 deferred (`SF0279` → P9,
`SF0329` → P6). All eighteen `SF03xx` audio codes were already live; `SF0302`'s *wording* changed,
not its status.

## 8. Findings ledger

| # | Finding | Status |
|---|---|---|
| **F-P3-19** | ADPCM step table entries 69-71 wrong (`5360/5897/6487` for `5358/5894/6484`) | ✅ fixed; full table now pinned |
| **F-P3-20** | ADPCM delta used the closed form instead of IMA's truncated shift accumulation — 884/2670 pairs differ, error compounds through the predictor | ✅ fixed; verified against `ruffle`'s four closures, 0 mismatches |
| **F-P3-21** | `T-AUD-101`'s "independent reference" was a copy of the implementation, with the same table and formula; the bit-exactness claim was circular and hid `F-P3-19`/`F-P3-20` | ✅ rebuilt against an independently-sourced table and `ruffle`-shaped delta |
| **F-P3-22** | 8-bit uncompressed PCM read as two's complement; `0x80` (silence) decoded as full-scale negative, waveform inverted | ✅ fixed (`E-030`) |
| **E-030** | Format 0 "native endian" is undecodable; big-endian was the wrong coin flip | ✅ little-endian, `IMPL-090-R006` and `SF0302` corrected |

## 9. Items carried forward / resolved since C5

- ADPCM packet length (4096 vs 4095) is resolved as **4096** by `E-031`: 412 exact matches and 0
  for 4095 across the decisive real `DefineSound` corpus. The 1–6-frame short-payload residual and
  its diagnostic false-positive are resolved by `E-032`; the decoder now marks a short final packet
  only when the incomplete codes are in the last packet required by `sampleCount`. See §10 for the
  C5 recheck and the non-final-packet regression.
- **`F-P3-17` gate hardening** (`audit_dev` blind to `emit?.(`) — still open from C4. → C7.
- **`SF0281` registry wording** (quarantine implies discard) — still open from C4. → C7.
- C3 items still open: `IMPL-070-R027`/`R034` `SF0260` citations, `padEdges` anchor choice,
  duplicated `T-MOD-401`…`408` rows, `F-P3-11`, `F-P3-14`. → C7.

### Process note

Mid-checkpoint the sandbox lost its local git history and `node_modules`; `HEAD` reverted to the
pre-C0 branch point while the working tree kept its contents. Because C0-C4 had been pushed, the
history was recovered intact with `git fetch` + `git reset 25dff19`, leaving exactly the C5 diff in
the working tree. Nothing was lost. Worth recording as an argument for pushing each checkpoint
rather than batching.

## 10. C5 exit-readiness recheck (2026-10-09)

The post-C5 ADPCM investigation was brought back to C5's exit bar before moving on. It exposed
one safety edge in `shortFinalPacket`: the earlier predicate inferred "final packet" from the
number of frames left (<4096), which could classify a truncated first packet as benign when a
multi-packet sound had a short remainder. The decoder now records the packet start where code
reading stopped and compares it to the final packet start implied by the declared sample count.

`T-AUD-102` includes the regression: a 5,000-frame sound whose first packet stops after 4,001
decoded frames has 999 frames left (less than one packet) but is **not** the final packet; it must
remain truncated/malformed. The asset-dump test covers this through to `SF0328`, alongside a benign
short final packet and a missing packet header. This pins both sides at decoder and CLI levels.

The MP3/metrics boundary is also explicit: no MP3 decoder is in the C5 scope, so the pass-through
record reports parsed `frameCount`, `sampleCount`, and `seekSamples` and marks PCM measurement as
`unavailable-pass-through`; it never lies with zero peak/RMS. PCM-derived WAVs alone carry the exact
sample-boundary chunk table and measured peak/RMS. `P3-CHECKPOINTS.md` and `IMPL-090` now state this
exception, plus that runtime streaming chunk files (`AUD-R023`) and P8 playback/drift are not C5
preview gates.

**Decision: C5 is exit-ready; no C5 blockers remain.** Closure gates after these changes:

| Gate | Final result |
|---|---|
| build | clean |
| typecheck | clean across the 8 workspace projects and their test configs |
| `pnpm test` | **58 files / 678 tests passed**, including the 10,000-mutation fuzz smoke |
| lint | clean (`eslint` + Prettier) |
| `spec:verify` | `ISSUES: 0` |
| `audit:dev` | `findings=52 known=57 new=0 fixed=5`; probes built and run (`shape4 5/5`, dump check passes) |
| `tag:coverage` | all **65/65** tags dispositioned |
| `test:audit` | **75** Python tests passed |
| `git diff --check` | clean |

## 11. Next checkpoint

**C6 — `forge-decompile assets dump` integration (WP-060-11, 070-15, 080-13, 090-11).** The
PCM-backed `audio` metadata block and the MP3 pass-through measurement marker added here are
manifest fields C6 must preserve deterministically end-to-end.
