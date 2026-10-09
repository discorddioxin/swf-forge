# Open question: ADPCM packet length — 4095 or 4096 samples?

Status: **open, instrumented, blocked on sample files.**
Raised by: `audits/P3-C5-AUDIT.md` §9. Owner for resolution: P3 C7.
Tooling: `tools/adpcm_probe.py`, validated by `tools/test_adpcm_probe.py`.

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

## 4. What I have already ruled out

I scanned every SWF I can reach from this sandbox. **5,656 files, zero ADPCM.**

| Corpus | Files | ADPCM |
| --- | --- | --- |
| `ruffle-rs/ruffle` test suite | 5,012 | 0 |
| `mozilla/shumway` + `jindrapetrik/jpexs-decompiler` | 644 | 0 |

The scan is trustworthy rather than silently broken: over the ruffle corpus the same walker found
35 MP3 `DefineSound`s, 5 PCM ones, 42 PCM `SoundStreamHead`s, one Speex and two unknown formats.
The tag walk works; those corpora genuinely contain no ADPCM.

That is an informative negative. ADPCM was Flash authoring's default for *short effect sounds* in
the Flash 4–8 era and is almost absent from developer test suites, which test player behaviour
with whatever audio was cheapest to embed. It survives in shipped content, not in test fixtures.

**Do not** repeat these searches. `raw.githubusercontent.com` is also blocked from this sandbox;
GitHub blobs must come through `api.github.com/.../contents/` or `codeload.github.com` tarballs.

## 5. What I need you to do

In rough order of how likely each is to settle it quickly.

### Step 1 — point the census at any SWFs you already have

If you have a Flash archive anywhere — an old games folder, a Flashpoint install, a downloaded
`.swf` collection, anything from `archive.org`'s Flash collections:

```bash
python3 tools/adpcm_probe.py --census /path/to/swfs
```

It prints a sound-format breakdown and lists the files containing ADPCM. This is fast and
read-only. If the ADPCM count is zero, move to step 2; if it is non-zero, jump to step 4.

**Best hunting grounds, in order:** Flash *games* from 2000–2006 (menu clicks, coin and jump
effects were nearly always ADPCM), banner ads of the same era, e-learning and "interactive CD-ROM"
content, and anything authored in Flash MX or earlier. Files from 2008 onward are mostly MP3.

### Step 2 — make one file, if you have any Flash authoring tool

This is the most reliable route, because it produces a file whose intent is known. In Flash
Professional / Animate: import any sound longer than about half a second, set its Publish
compression to **ADPCM**, 4-bit, and export. One file is enough. Anything over 4096 samples
(≈0.37 s at 11 kHz) discriminates.

If you have `swfmill`, `ming`, `haxe`/OpenFL or JPEXS Free Flash Decompiler available, each can
produce or re-compress an ADPCM sound; JPEXS can also *re-encode an existing* MP3 sound to ADPCM,
which turns any SWF you already have into a usable sample.

### Step 3 — if neither works, tell me and I will widen the net

I can fetch from `github.com`, `codeload.github.com`, `api.github.com`, `registry.npmjs.org` and
`pypi.org`. If you know of a repository or npm/PyPI package that vendors Flash content with
sound — an old game's source, a Flash-era asset pack, a decompiler's sample set — give me the
name and I will pull and scan it. I cannot reach `archive.org`, Flashpoint's CDN, or the general
web from here, so for anything outside those five hosts you would need to download it.

### Step 4 — run the probe and paste the result back

```bash
python3 tools/adpcm_probe.py --json /path/to/swfs > adpcm-evidence.json
```

Paste the JSON, or just the summary block if the file is large. What I need from it is the
`verdict`, the `counts`, and a handful of `observations` rows. **A single file with one ADPCM
sound longer than 4096 samples is enough to close this.**

If the verdict comes back `UNRESOLVED` because every sound was short, say so — the tool will have
told you — and send the files anyway; several short sounds in one SWF can still add up to a
decisive aggregate.

## 6. What happens with the answer

| Outcome | Consequence |
| --- | --- |
| **A confirmed** | `packages/audio/src/codecs/adpcm.ts` is correct as shipped. Record the evidence against `IMPL-090-R0xx`, close the C5 §9 item, and note ruffle's divergence as a known player bug in `docs/impl/registers/errata.md`. |
| **B confirmed** | The decoder emits one extra sample per 4096 and every ADPCM duration in the manifest is long by `ceil(N/4096)` samples. Fix the packet loop, re-pin `T-AUD-101`/`T-AUD-102`, correct the `measureAudio` durations, and file an erratum against the reference spec's `ADPCMPACKET` structure. |
| **Still unresolved at C7** | Keep reading A (it matches the published structure), but demote the behaviour from "verified" to a recorded assumption with this document cited, exactly as `SF0302` was handled for the format-0 endianness question in `E-030`. |

Either way the resolution belongs in `audits/P3-C7-AUDIT.md` with the evidence attached, and the
probe stays in `tools/` as the reproduction.
