# ADPCM packet length — 4095 or 4096 samples?

Status: **RESOLVED — reading A, and integrated.** Evidence below; code, docs and errata updated.
Raised by: `audits/P3-C5-AUDIT.md` §9. Owner for resolution: P3 C7.
Tooling: `tools/adpcm_probe.py` and `tools/adpcm_hunt.py`, validated by their `test_*.py` siblings.

---

## 1. The question

An ADPCM packet begins with a per-channel header: `InitialSample` SI16 and `InitialIndex` UB[6],
followed by a run of code words. The disagreement is whether `InitialSample` is **output**.

| | Reading A — ours | Reading B — ruffle's |
| --- | --- | --- |
| `InitialSample` | is the packet's first output sample | seeds the predictor only; never emitted |
| Coded frames per packet | 4095 | 4095 |
| **Output samples per packet** | **4096** | **4095** |
| Source of the reading | `ADPCMPACKET` as printed in the SWF 19 reference: one `InitialSample`, one `InitialIndex`, `ADPCMMANTISSA[4095]` | `adpcm.rs`: `sample_num = (sample_num + 1) % 4095`, and a code is consumed on the same call that returns the header sample |

Both readings consume **identical bits**, so neither desynchronises and a hex dump of one packet
cannot distinguish them. Playing the file cannot distinguish them either: the difference is one
sample in 4096, about 0.09 ms, and the predictor state is the same afterwards. This is why the
question survived C5.

## 2. Why it is decidable without decoding anything

The readings disagree about **how many packets a given sample count needs**, and therefore about
how long the payload must be:

```
reading A:  packets = ceil(N / 4096)    codes = N − packets
reading B:  packets = ceil(N / 4095)    codes = N

bits  = 2 + packets × 22 × channels + codes × codeWidth × channels
bytes = ceil(bits / 8)
```

(The leading 2 bits are `ADPCMCodeSize`; 22 = SI16 + UB[6] per channel per packet. The packet
header is **not** byte-aligned.)

Reading A always needs **fewer or equal** bytes, because it spends one sample per packet on the
header instead of coding it. (`tools/test_adpcm_probe.py` asserts this ordering holds across every
sample count, channel count and code width — the verdict logic depends on it.) So:

> **A payload that is long enough for reading A but too short for reading B proves reading A.**
> There is no room for the data reading B would require. No audio comparison, no reference
> decoder, no listening.

Conversely, a payload that lands **exactly** on reading B's prediction — leaving reading A with
unexplained trailing bytes — is strong evidence for B.

Worked examples, mono, 4-bit codes:

| Declared `N` | A: packets → bytes | B: packets → bytes | Gap |
| --- | --- | --- | --- |
| 4 096 | 1 → **2 051** | 2 → **2 054** | 3 B |
| 10 000 | 3 → **5 007** | 3 → **5 009** | 2 B |
| 44 100 | 11 → **22 075** | 11 → **22 081** | 6 B |
| 3 675 (one 44.1 kHz frame at 12 fps) | 1 → **1 840** | 1 → **1 841** | 1 B |

The gap is small but it is a *whole number of bytes*, and a file is either long enough or it is
not. Stream blocks are the best evidence of all: every `SoundStreamBlock` restarts the decoder, so
a single streamed sound yields one independent test per frame — hundreds of observations from one
file, all of which must agree.

## 3. What the tool does

```bash
pnpm adpcm:probe -- --census ~/swfs    # does this pile of SWFs contain any ADPCM at all?
pnpm adpcm:probe -- ~/swfs             # verdicts
pnpm adpcm:probe -- --json ~/swfs      # machine-readable, for pasting back
```

`python3 tools/adpcm_probe.py ...` works identically and needs nothing but Python 3.9+ — no
`node_modules`, no build, no network. It can be copied to any machine that holds a corpus.

It parses the SWF container (uncompressed / zlib / LZMA), walks the tag stream including sprite
timelines, and for every ADPCM `DefineSound` and `SoundStreamBlock` prints the declared sample
count, the actual payload length, both predictions, and a verdict:

```
  DefineSound       id=7         ch=1 bits=4 N=44100 payload=22075 B
      reading A (4096/pkt):   11 pkt -> 22075 B   <= EXACT
      reading B (4095/pkt):   11 pkt -> 22081 B
      if the last packet is padded full: A 22553 B 22553 B
      exact size match: A
      verdict: A  (reading B needs 6 B more than the tag holds)
```

Per-asset verdicts are `A`, `B`, `inconclusive` (the payload fits both — trailing slack) or
`neither` (truncated, or an assumption is wrong). The run ends with a corpus verdict, and flags a
`CONFLICT` if different files prove different readings, which would mean the extractor is wrong
rather than the spec being ambiguous.

**The tool is validated, not merely written.** `tools/test_adpcm_probe.py` (24 tests, run by
`pnpm test:audit`) builds synthetic SWFs whose payloads are sized under reading A and under
reading B and asserts the probe names the correct one, across mono/stereo and all four code
widths, compressed and uncompressed, plus the boundary cases where the two readings coincide and
the probe must answer `inconclusive` rather than guess. This is deliberate: finding `F-P3-21` was
a reference implementation that had never been checked against anything independent.

### It also answers the second open question

`docs/impl/decompiler/090-sounds.md` line 371 (owned by `T-AUD-102`) asks whether a real encoder
stops coding at `SoundSampleCount` or always writes whole packets. The probe prints the
"last packet padded full" predictions alongside, and tallies exact matches corpus-wide. The same
files settle both questions.

## 4. The answer

**Reading A. `InitialSample` is an output sample; a packet emits 4096 samples.** The
implementation in `packages/audio/src/codecs/adpcm.ts` is correct as shipped and needs no change.
`ruffle` is wrong here, by one sample per 4096.

`tools/adpcm_hunt.py` searched GitHub for Flash *content* and harvested **71 ADPCM-bearing SWFs
from 11 independent repositories** — real games and arcade archives, not conformance fixtures.
Reduced to independent measurements (see §5 on why that reduction matters):

| | Reading A | Reading B |
| --- | --- | --- |
| Distinct `DefineSound` payloads matching the prediction **exactly** | **412** | **0** |
| Files whose sounds are consistent with the reading | **65** | **0** |

There are 623 distinct `DefineSound` measurements: **412 exact fits for A and 0 for B**, with no
payload anywhere that reading B explains and reading A does not. The fresh residual recount below
finds 163 distinct measurements below A. The older split of 53 non-discriminating + 158 anomalies
is preliminary and is superseded by that recount; those old category totals must not be combined
with it. The sample spans code widths 2, 3, 4 and 5, mono and stereo, and declared counts from 455
to 6,491,338 samples. Reading B was outright *impossible* — the payload physically too short for
the data it requires — in 556 of the decisive measurements.

412 independent payloads landing byte-exactly on a prediction is not a coincidence that admits an
alternative explanation.

### The second question, also answered

Of the exact matches, **nine** also matched the "trailing packet padded out to a full one"
prediction — and in all nine the padded and unpadded predictions are *the same number*, because
the sample count happened to fill the last packet exactly. Genuine evidence of padding: **zero**.

> Encoders stop coding at `SoundSampleCount`. They do not write whole packets past it.

That closes the open item at `docs/impl/decompiler/090-sounds.md` line 371, owned by `T-AUD-102`.

### Residual: 163 distinct payloads shorter than reading A

A fresh reparse of all 71 SWFs found 643 ADPCM `DefineSound` tags; 165 are below the reading-A
payload prediction. After de-duplicating by measurement signature, that is **163 of 623 distinct
measurements**: 138 are one byte short, 23 are two bytes short, and 2 are three bytes short. This
supersedes the preliminary 158-payload / 1–2-byte tally. The tag-level shortfall costs 1–6 output
frames.

This does not weaken the conclusion, and it is worth being precise about why: **reading B never
needs fewer bytes than reading A**, so a payload too short for A is further still from B. Every
short measurement excludes B. It records an authoring/count discrepancy, not a different packet
length; the cause remains a correlation rather than a proven encoder algorithm (see §8).

## 5. Two corrections the real data forced

Both of these changed the answer's basis, and both are now pinned by tests
(`TestEvidenceWeighting` in `tools/test_adpcm_probe.py`).

**The first run reported `CONFLICT`** — 85 observations apparently proving reading B. All 85 were
the *same* `SoundStreamBlock` of one looping sound in one file, counted once per repetition. Raw
observation counts are not independent evidence; the tool now de-duplicates by
`(file, kind, channels, width, declared count, payload length)`. In the final corpus 27,747 raw
observations collapse to 611 distinct ones.

**And those stream blocks could not have settled anything anyway.**
`SoundStreamHead.StreamSoundSampleCount` is defined as the *average* samples per block — our own
`090-sounds.md` line 252 describes encoders writing "one-under block sizes so the running average
stays exact". So a block's declared count carries a ±1-sample uncertainty, which is the same size
as the effect being measured. The conflicting block declared 229 samples and held 147 bytes;
reading B predicts 147 at N=229, but **reading A predicts 147 at N=230** — a block one sample
above the average, exactly what the format permits. It was never evidence for B.

Stream blocks are now evaluated with a ±1 tolerance, marked advisory, and excluded from the
verdict by default. Only `DefineSound`, whose `SoundSampleCount` is exact for that sound, decides
the question.

The general lesson, and the reason the tool reports `CONFLICT` loudly rather than averaging it
away: when two readings are both "proved", the extractor is wrong, not the format ambiguous.

## 6. Reproducing it

```bash
python3 tools/adpcm_hunt.py --max-sources 120     # harvest (network; ~20 min)
python3 tools/adpcm_probe.py /tmp/adpcm-hunt      # verdict over what it found
```

The hunt is resumable and keeps only ADPCM-bearing SWFs. The probe works offline on any corpus:

```bash
python3 tools/adpcm_probe.py --census /path/to/swfs   # is there ADPCM here at all?
python3 tools/adpcm_probe.py --json /path/to/swfs     # machine-readable evidence
```

Nothing needs `node_modules` or a build. If you have Flash-era content of your own, pointing the
probe at it is still worthwhile — more independent encoders is better evidence, and the 163-measurement
residual in §4 would benefit from a wider sample.

## 7. Integration — done

No decoder change was needed: `packages/audio` already implemented reading A. What landed is the
*evidence*, so the behaviour is pinned and the next person does not re-litigate it.

| Item | Status |
| --- | --- |
| `packages/audio/src/codecs/adpcm.ts` | `PACKET_FRAMES` carries the reasoning, the `ruffle` divergence and the corpus result |
| `packages/audio/test/adpcm.test.ts` | `T-AUD-102` pins ten real `(N, channels, bits, payload)` measurements |
| `IMPL-090-R012` | Restated as measured, not inferred, with the corpus figures |
| `IMPL-090-R034` (new) | Encoders do not pad the trailing partial packet |
| `090-sounds.md` §11 item 1 | The old 158 count was superseded by the 163-distinct-measurement recount; §8 now characterises the residual and documents the `SF0328` correction |
| `errata.md` `E-031` (new) | The `ruffle` divergence, the method, and the stream-block caveat |

### The test earns its place

A regression that passes under both readings would be worthless, so it was checked by mutation:
setting `PACKET_FRAMES = 4095` and `codedFrames = sampleCount` — i.e. implementing `ruffle`'s
reading — fails 5 tests including this one. The pin works because each fixture asserts the real
payload is **minimal**: one byte shorter no longer decodes. Reading B would have needed between 1
and 560 bytes *more* than these files contain, so under B a byte could always have been spared.

## 8. The residual, investigated

§7 left **165 of 643 raw tags** short of their declared `SoundSampleCount`; signature
re-deduplication leaves **163 of 623 distinct measurements**. The shortfall is 1–6 decoded frames,
not just the 1–3 first reported. Investigating it turned up a defect worth more than the curiosity
that led to it.

### It is not random, but its cause is not proven

| Signal | Short | Complete |
| --- | --- | --- |
| `SoundSampleCount` is a multiple of 4 | **1 of 165** | **284 of 478** |
| 22 kHz mono | 157 of 364 (43%) | — |
| 5.5 kHz | 0 of 91 | — |
| Stereo | 0 of 21 | — |

A sound whose declared count divides by four is essentially never short. `emitted = 4·floor(N/4)`
reproduces 92 of the 165 exactly, so group-of-four coding is a plausible authoring-path explanation
but not a complete model. The remainder are not explained by a single offset. The concentration in
22 kHz mono and absence from stereo suggest a default-settings authoring path, but that is a
correlation, not a format rule. Ruled out: a different packet length (no packet count explains the
payloads), a dropped final byte (fits 95 of 165), and an off-by-one declared count (61 of 165).

### The defect it exposed

Our decoder set `truncated` for these, and both call sites turned that into **`SF0328`, severity
`error`**. So we were reporting **26% of shipped, playable Flash content as malformed** over a
shortfall of at most 6 samples (<0.28 ms at 22.05 kHz).

`IMPL-090-R013` had anticipated the distinction — "report `SF0328` (warning)" for a short final
packet versus "`SF0328` (error)" for an unsplittable stream. But a registered code carries one
severity, and `audit_dev` check 2 enforces that call sites match it, so the warning arm was
unimplementable and the implementation made everything an error. `SF0328`'s own registered meaning
("a packet truncated *before the last one*") had excluded this case all along.

### Fixed

`DecodedSwfAdpcm.shortFinalPacket` is now true only when code reading stops inside the **last
packet required by the declared sample count**, after that packet's header is complete. That is an
`ASSET_SOUND_TRUNCATED` warning and no `SF0328`. Missing/incomplete headers or code truncation in an
earlier required packet remain `SF0328` errors. The stream-block call site is fixed too, where the
error was doubly wrong because `SoundStreamHead` declares an average count.

The C5 exit recheck caught why packet position must be explicit: a 5,000-frame sound can stop in
its first packet with 999 frames still declared (<4096); a remaining-count heuristic calls that
"final" even though a second packet is required. The decoder now compares the failure packet's
start against `floor((sampleCount - 1) / 4096) * 4096`. `T-AUD-102` covers this exact 5,000/4,001
case, and the asset-dump regression asserts `SF0328` reaches the user-facing diagnostic.

The built decoder was run over all 71 corpus files before the final packet-position refinement:

```
ADPCM event sounds decoded : 643
  truncated                : 165
  -> benign short final pkt: 165   (no SF0328)
  -> genuinely malformed   : 0     (SF0328 error)
false-error rate: 25.7% -> 0.0%
```

That corpus replay used the initial `missing < 4096` predicate. The C5 exit recheck below narrowed
it to the actual last packet and added a regression for a truncated earlier packet with only 999
frames left; the raw SWFs are no longer present in this workspace for another replay. The corpus
residual is only 1–3 bytes below the expected payload, and the observed shortfall is at the very
end of the payload after a complete final header, so this narrower check preserves the 165 benign
classifications without accepting a short earlier packet. The synthetic regression independently
pins that latter malformed case.

The zero false-error result is the right answer for the corpus of shipped games, with that
reproduction limitation stated explicitly. Recorded as errata `E-032`, pinned by `T-AUD-102`, and
`090-sounds.md` open item 1 now carries the characterisation instead of the question.
