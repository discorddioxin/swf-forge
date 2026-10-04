# AUD — Flash Audio → Web Audio Subsystem

**Doc ID:** AUD · **Status:** Draft 1.2 · **Normative:** yes
**Depends on:** SWF (tag parsing), CMP (pipeline), AVM1 (Sound API semantics), AST (manifest)

---

## 1. Scope and goals

Flash audio arrives in four shapes, each with different semantics:

1. **Event sounds** (`DefineSound` 14) — a complete clip in one tag, triggered by `StartSound` (15),
   `DefineButtonSound` (17), `StartSound2` (89), or the AS2 `Sound` API.
2. **Stream sounds** (`SoundStreamHead` 18 / `SoundStreamHead2` 45 + `SoundStreamBlock` 19) —
   audio interleaved with frames, locked to the timeline playhead.
3. **Sound *events* with envelopes** — `SOUNDINFO` in `StartSound`/`DefineButtonSound`, carrying
   in/out points, loop count, and a multi-point envelope (volume/pan over time).
4. **Runtime-loaded audio** — `Sound.loadSound(url, isStreaming)`, `loadSound`, `LoadVars`-adjacent
   patterns, mapped through the asset pipeline (CMP-§10).

This document specifies how each is decoded at build time, re-encoded for the web, played back
sample-accurately, and synchronised to the timeline.

**Goals**

- **AUD-G1 — Sample-accurate semantics.** Loop points, in/out points, envelope timing, and stream
  sync are expressed in *samples*, not in "close enough" wall-clock seconds.
- **AUD-G2 — Loudness fidelity.** No unrequested compression, limiting, or normalisation. A game's
  authored mix must survive the port. (Off-by-a-few-percent volume differences are the kind of thing
  players notice; "remastering" a 2004 game is not our job.)
- **AUD-G3 — Bounded memory and CPU.** Music is streamed in chunks; voices are capped with a
  documented stealing policy; the mixer runs in an `AudioWorklet` (not on the main thread).
- **AUD-G4 — No dead air, no broken callbacks.** Muted, backgrounded, or auto-play-blocked states
  must still advance positions and fire `onSoundComplete` on schedule.
- **AUD-G5 — Deterministic and testable.** Decoding and encoding are reproducible; playback is
  verified with offline renders, null tests, and drift measurements.

**Non-goals**

- MIDI, `System.capabilities` audio queries beyond what AS2 exposes, 3D/positional audio (not in
  AVM1's `Sound`), `SoundMixer.computeSpectrum` (AS3), and live `Microphone`/`Camera` capture
  (reported unsupported, `SF0309`).
- Bit-exact reproduction of Flash's mixer (Flash's internal mixing is fixed-point and undocumented).
  Our target is **sample-accurate scheduling with ≥ 16-bit-equivalent quality** and no audible
  artefacts (AUD-§9.5).

## 2. Source formats and the decode matrix

SWF sound formats (4-bit `SoundFormat` field), with our build-time action:

| Code | Format | Spec notes | Build action | Runtime codec |
| --- | --- | --- | --- | --- |
| 0 | Uncompressed, platform endian | 8/16-bit, mono/stereo; endianness "as the player's CPU" (in practice: little-endian on all relevant platforms) | Decode as little-endian; `SF0302` (info) if 8-bit | Opus/AAC |
| 1 | ADPCM | SWF-flavoured IMA ADPCM, 2–5 bits per sample (AUD-§3.3) | Decode with the SWF table set | Opus/AAC |
| 2 | MP3 | Stream = "MPEG-1/2 Layer III" frames; event sounds = a raw MP3 bitstream | Passthrough when unmodified, else decode→re-encode. Streams use the block headers (AUD-§6.2) | MP3 passthrough or Opus |
| 3 | Uncompressed little-endian | Always LE regardless of platform | Same as 0 | Opus/AAC |
| 4 | Nellymoser 16 kHz | A-law-ish proprietary codec, mono, 16 kHz | Decode via an adapted open decoder (SEC-§5); never ship | Opus (mono) |
| 5 | Nellymoser 8 kHz | as above, 8 kHz | as above | Opus (mono, 16 kHz output) |
| 6 | Nellymoser | as above, rate from the rate field | as above | Opus |
| 11 | Speex | 16 kHz mono, Speex-encoded | Decode via an adapted open decoder | Opus (mono) |
| 7–10, 12–15 | Reserved | — | `SF0301` error; emit a silent stub so the game still builds (CMP-R007) | — |

**AUD-R001** All decoders MUST be robust to truncated payloads: decode what is present, pad with
silence to the declared `SoundSampleCount`, and emit one `warning` per sound (`SF0304`) rather than
failing the build.

**AUD-R002** The declared sample counts are authoritative:
- `DefineSound.SoundSampleCount` is the per-channel sample count (a "sample" is one *frame*: in stereo
  it counts left/right *pairs*).
- The decoded PCM MUST be trimmed or padded to exactly that many frames, because games position
  sounds against it (loops, `Sound.position`, `onSoundComplete`).

**AUD-R003** Sample rates are 5512, 11025, 22050, 44100 (codes 0–3). A `SoundStreamHead`'s
*playback* rate/size/stereo fields may differ from the *source* fields; the decode stage MUST apply
the playback parameters (resample/downmix/mono→stereo as specified) so the runtime never has to
(AUD-§6.4).

## 3. Decoding (build time)

### 3.1 PCM (formats 0 and 3)

**AUD-R004** 8-bit samples are signed (−128…127); 16-bit samples are signed little-endian. Stereo is
interleaved L,R. Conversion to float MUST be exact: `s8 / 128`, `s16 / 32768` (never `/32767`,
which would clip positive full-scale).

### 3.2 ADPCM (format 1)

SWF ADPCM is IMA ADPCM with 2–5 bit codes (the variable width is what makes it unlike standard
IMA). The sound data is a **bit stream**: 2 bits of code size (top of the first byte — once per
sound, and once per `SoundStreamBlock` for streams), then contiguous *packets* with **no byte
alignment** between them (errata `E-018`):

```
AdpcmCodeSize UB[2]       // bits per code = field + 2  → 2, 3, 4, 5
packet = 22 bits/channel + 4095 codes/channel   (4096 samples per channel)
mono:   SI16 firstSample;  UB[6] firstIndex;  then 4095 codes of `bits` bits
stereo: SI16 firstSampleL; UB[6] firstIndexL;
        SI16 firstSampleR; UB[6] firstIndexR;  then 8190 codes, interleaved L,R
codes are sign-magnitude: top bit = sign, low bits-1 bits index the tables
```

Decoding a code `k`:

```
predicted = prediction[ch]
index     = stepIndex[ch]
step      = STEP_TABLE[index]                     // 89-entry IMA step table
diff      = MULT_TABLE[bits][k]                   // magnitude table for this code value
prediction = clamp16(predicted + (k < half ? +diff*step : -diff*step) >> 3)
stepIndex  = clamp(index + IDX_TABLE[bits][k], 0, 88)
```

**AUD-R005** The tables MUST be transcribed from the SWF specification's ADPCM section (the *step*
table is the standard 89-entry IMA table; the per-bit-depth multiplier and index tables are SWF
specific) into a single generated file with a provenance header, and MUST NOT be re-derived
arithmetically. The verified per-code **index** tables are:

```
2 bits: {-1, 2}
3 bits: {-1, -1, 2, 4}
4 bits: {-1, -1, -1, -1, 2, 4, 6, 8}            // standard IMA layout
5 bits: {-1, -1, -1, -1, -1, -1, -1, -1, 1, 2, 4, 6, 8, 10, 13, 16}
```

and the **multiplier** tables follow the same shape (2 entries for 2-bit … 16 entries for 5-bit) with
the values scaled so that the 4-bit case reproduces standard IMA. Constants live in
`adpcm-tables.ts` and are validated by `T-AUD-004` against an oracle decode.

**AUD-R006** For **stereo**, both channels MUST be decoded with independent predictors and indices,
resolved *per sample pair* (the codes interleave L,R,L,R…).

**AUD-R007** For **event sounds** (`DefineSound`), the block header appears once and decoding runs
until the declared frame count is produced (the tail of the final 4096-code block is discarded).
For **stream** sounds (`SoundStreamBlock`), *every frame's block carries its own header*, so the
predictor resets per block; this is a frequent implementation bug and MUST be covered by a fixture
with a deliberately continuous waveform across frames (`T-AUD-005`) — a reset produces an audible
click and is the classic "ADPCM stream crackle" defect.

**AUD-R008** Clamping MUST match IMA semantics: prediction clamps to int16, step index clamps to
[0, 88]. No dithering, no noise shaping.

### 3.3 MP3 (format 2)

**AUD-R009** Event-sound MP3 data is passed to the platform decoder only in **passthrough** mode
(AUD-§4.3). Otherwise it is decoded at build time with a fixed decoder (deterministic version
pinned in the toolchain; SEC-§5).

**AUD-R010** MP3 decoding MUST account for encoder delay and padding:
- `SoundStreamHead2`'s `LatencySeek` (present when compression = MP3) is the number of samples to
  skip at the start of the first block. It MUST be applied, and it is *signed* in practice: treat a
  positive value as skip, a negative value as "the first |n| samples are overlap from before the
  stream start" (discard the overlapping part from the decoder output, not from the timeline).
- The declared frame sample counts (AUD-§6.2) are the ground truth for trimming decoder output.

**AUD-R011** Grouped-format quirks (bitrate changes mid-stream, mono/stereo switches) MUST be handled
by decoding with a streaming decoder rather than assuming uniform frame parameters; `SF0305` (info)
records the observation.

**AUD-R012** MP3 that is *pure passthrough* MUST NOT be re-encoded (generational loss) and MUST be
played with an explicit sample offset so that the first audible sample aligns with the SWF's declared
start: `source.start(when, offsetSeconds)` where `offsetSeconds = encoderDelayFrames / rate`.
Encoder delay is read from the LAME/Xing header when present, else from the decoder.

### 3.4 Nellymoser and Speex

**AUD-R013** Both codecs are decode-only at build time and MUST NOT appear in shipped assets. Use an
audited open decoder adapted behind the `AudioDecoderAdapter` interface (SEC-§5). Decode output is
mono float32; Nellymoser 8 kHz MUST be decoded at its native rate then resampled (AUD-§3.5).

**AUD-R014** Where a decoder is unavailable in a given build (missing optional dependency), the
compiler MUST fail only for sounds that actually use that format, naming the sound ids, and MUST
offer `--audio.missing=stub` to substitute silence (so a title with one broken old sound can still
ship).

### 3.5 Resampling and channel handling (build time)

**AUD-R015** All decoded PCM MUST be resampled once, at build time, to the **canonical project rate**
(`audio.sampleRate`, default 48000) using a high-quality polyphase windowed-sinc resampler with:
- ≥ 32 taps at quality `high` (default), ≥ 16 at `medium`,
- stopband attenuation ≥ 90 dB, passband ripple ≤ 0.1 dB,
- linear-phase (no audible phase smearing; required so null tests against the source pass),
- deterministic float arithmetic with documented rounding (float64 accumulation, output rounded to
  float32).

**AUD-R016** Mono sources MUST stay mono (no upmix) and stereo stay stereo; the runtime's mixer
applies SWF's `SoundTransform`-era stereo rules (AVM1 has per-sound pan only).
If a source is mono and the SWF `SoundStreamHead` declares stereo playback, the decode stage MUST
duplicate to both channels (that is the one legitimate upmix).

**AUD-R017** Dithering MUST NOT be applied when converting to float32 (float is the working format);
dithering is applied once, only if the final deliverable is 16-bit (AUD-§4.3) and only with a fixed
TPDF + seeded noise generator so builds remain reproducible.

**AUD-R018** The resampler MUST preserve the *absolute* sample alignment: output frame 0 corresponds
to input frame 0 (zero group delay compensated). Loop points must remain sample-exact after
resampling (AUD-§4.4).

## 4. Encoding and packaging (build time)

### 4.1 Codec ladder

| Priority | Codec | Container | When | Notes |
| --- | --- | --- | --- | --- |
| 1 | Opus | WebM (or Ogg for maximal support) | Default for everything except MP3 passthrough | Royalty-free; best quality/bitrate |
| 2 | AAC-LC | MP4 (`.m4a`) | Safari/older-browser fallback when Opus-in-container is unsupported | Licensing: caller's responsibility (SEC-§6) |
| 3 | MP3 (passthrough) | raw `.mp3` | Source is MP3 *and* unmodified and no trimming beyond sample offset is needed | Zero generational loss |
| 4 | PCM WAV | `.wav` | Short SFX in test builds only | Never in production builds (size) |

**AUD-R019** The manifest MUST declare every codec variant present for a sound and the runtime MUST
select the first supported variant (RT-§4.4). A build MUST contain at least one *universally*
supported variant for each sound — for Opus that means either (a) WebM/Opus, accepted by all current
evergreen browsers, or (b) an AAC fallback when `target: 'baseline-2020'` and specific engine support
is required.

**AUD-R020** Encoding settings MUST be recorded per asset (`EncodeReport`) and MUST be a deterministic
function of config + source hash. Defaults:

| Class | Codec settings | Rationale |
| --- | --- | --- |
| SFX (≤ 3 s, ≤ 2 ch) | Opus, 96–128 kbps, VBR, 20 ms frames, no forced mono for stereo sources | Transparency for impacts/jingles |
| Music (> 3 s) | Opus, 128–160 kbps, VBR, 20 ms | Preserves authored mix dynamics |
| Speech/Nellymoser-origin | Opus, 48–64 kbps, mono | Source was already low-rate |
| MP3-origin (passthrough) | none | Lossless of intent |

**AUD-R021** Encoders MUST be invoked with "no automatic gain", "no loudness normalisation", and no
metadata injection beyond what is needed for gapless playback (Opus preskip, LAME delay). Any
loudness processing is opt-in via `audio.loudness` (AUD-R026).

**AUD-R022** Opus pre-skip and codec delay MUST be preserved and exposed in the manifest so the
runtime can trim the *decoded* output to the exact intended sample range
(`codecDelayFrames`, `endPaddingFrames`). Without this, every sound gains a few ms of leading
silence and stream syncs drift.

### 4.2 Chunked streaming for long audio

**AUD-R023** Music and other long assets MUST be split at build time into **chunks** of
~`audio.chunkSeconds` (default 10 s, configurable 2–30 s) with a **chunk table** in the manifest
giving, per chunk: file, encoded byte offset (for passthrough MP3), and the *exact* start frame in
canonical PCM. Requirements:
- chunk boundaries MUST fall on independent decode boundaries (Opus/AAC frames are independent;
  for MP3 passthrough use frame-aligned splits, never mid-frame),
- the union of chunks MUST be sample-exact (no gaps, no overlap) — validated by decoding all chunks
  individually and concatenating (`T-AUD-010`),
- each chunk MUST decode standalone (no cross-chunk state), which excludes long-window predictive
  codecs; Opus and AAC-LC with proper priming satisfy this.

Rationale: a 4-minute stereo music track is ~46 MB as float32 PCM; holding it in an `AudioBuffer` is
wasteful on mobile. Chunks let the player keep a bounded ring buffer (AUD-§5.4) and let seeking be an
index operation instead of a decode-all operation.

### 4.3 Exact lengths and trimming

**AUD-R024** Every encoded asset MUST be accompanied by `frameCount` and `startFrame` metadata so the
runtime can compute durations and loop points without decoding:
`durationSeconds = (frameCount − startFrame) / sampleRate`.

**AUD-R025** The encoding pipeline MUST verify, per asset, that decoding the encoded file yields
exactly `frameCount` frames after trimming (tolerance: 0 frames; if a codec cannot achieve it, the
asset is rejected with `SF0310` and the codec falls back down the ladder).

### 4.4 Loop points

**AUD-R026** Loop points are authored in the SWF as:
- `SOUNDINFO` `InPoint`/`OutPoint` (in 1/44 100 s units; **not** in the source's sample rate) for
  event sounds,
- `DefineSound` implicitly (whole clip) with `LoopCount` in `SOUNDINFO`,
- stream sounds loop with the timeline.

The compiler MUST record, per sound, a **canonical loop region** in canonical-rate frames:
`{ loopStartFrame, loopEndFrame }`, converted from 44.1 kHz units by
`frame = round(unit × sampleRate / 44100)` with a documented rounding rule (`round-half-up`) and
validated (`loopStart < loopEnd`, both within `[0, frameCount]`).

**AUD-R027** `loopEndFrame` is **exclusive** in our metadata (the first frame *after* the loop), to
make arithmetic exact. A loop over the whole sound is `{0, frameCount}`.

**AUD-R028** For sample-accurate looping the runtime MUST use its own mixer (AUD-§5.4) rather than
`AudioBufferSourceNode.loop`, because:
- `loopStart`/`loopEnd` are expressed in seconds (float) and accumulate error over long loops,
- the native loop cannot apply SWF's envelope automation across loop boundaries,
- the native loop cannot be interleaved with the stream-sync playhead.

Where the native loop *is* used (a long ambient bed with no envelope and no sync), the loop must be
scheduled with explicit `loopStart`/`loopEnd` in seconds derived from frames, and the decision
recorded (`AUD-D06`).

**AUD-R029** Loop *counting* MUST be exact and normalised at the AVM1 boundary. The committed model,
to be confirmed by `T-AUD-011` before v1:

| Source | Value | Meaning |
| --- | --- | --- |
| `SOUNDINFO` | `HasLoops = 0` (field absent) | Play once |
| `SOUNDINFO` | `n ≥ 1` | Play `n` times total (initial play + `n−1` repeats) |
| `SOUNDINFO` | `0` | Play once (defensive default) unless the oracle measures otherwise |
| `SOUNDINFO` | `0xFFFF` | Loop forever |
| `Sound.start(offset, loops)` | omitted | Play once |
| `Sound.start(offset, loops)` | `0` | Play once (documented AS2 behaviour) |
| `Sound.start(offset, loops)` | `n ≥ 1` | Play `n` times total |
| `Sound.start(offset, loops)` | `65535` | Loop forever (documented AS2 behaviour) |

Because the two encodings are documented differently and no upstream document is authoritative for
the tag case, an implementation MUST route every loop count through a single `normaliseLoops()`
function that encodes this table, so the convention is changeable in exactly one place when the
oracle measurement lands (`AUD-D01`, `[oracle-pinned]` `T-AUD-011`).

**AUD-R030** At every loop point the mixer MUST NOT introduce a click: if the audio at
`loopEndFrame−1` and `loopStartFrame` are not continuous, apply a **micro-crossfade** of
`audio.loopCrossfadeMs` (default 3 ms, 0 disables) *inside the mixer* — read both regions and blend.
The crossfade MUST NOT alter the loop period (it consumes loop-region samples, it does not extend
time). Default is *on* because authored loops are frequently not sample-continuous and Flash's own
player applied a short ramp.

### 4.5 Asset naming and dedupe

**AUD-R031** Assets are content-addressed: `assets/aud/<sha256-16>.<ext>`; the manifest maps logical
names (`sound_<characterId>`, linkage ids, or `music_loop`) to variants. Identical decoded content
(very common: the same click reused 40 times) MUST be deduplicated by hash of the *decoded PCM*, not
the source bytes, so that two different MP3 encodings of the same sound collapse to one asset
(`SF0311` reports the savings).

### 4.6 Loudness policy

**AUD-R032** `audio.loudness: 'off'` (default) means the compiler MUST NOT alter levels. The build
report MUST include per-asset peak and RMS dBFS, plus a "clipping risk" flag when the decoded source
itself exceeds 0 dBFS (which happens after lossy decode: MP3 overshoot). Clipping risk MUST be
reported, never silently corrected.

**AUD-R033** `audio.loudness: 'ebu'` MAY apply a documented EBU R128 normalisation to music *only*
(never SFX), with the target (-14 LUFS integrated) recorded in the manifest, and MUST emit a
`risk` diagnostic because it changes the authored mix.

## 5. Playback engine (run time)

### 5.1 Architecture

```
main thread                        audio worklet thread
───────────                        ─────────────────────
AssetLoader ──decoded PCM chunks──►  MixerProcessor
SoundService                         ├─ Voice[] (event sounds)
  · schedules, positions             ├─ StreamVoice[] (timeline streams)
  · API surface (AVM1)               ├─ master gain + limiter (peak guard only)
  · manifest lookups                 └─ renders 128-frame quanta → outputs
Clock ◄── position reports (atomic/SharedArrayBuffer or postMessage every 100 ms)
```

**AUD-R034** The mixer MUST run in an `AudioWorkletProcessor`. `ScriptProcessorNode` MUST NOT be used
(disabled on many platforms, runs on the main thread). A no-worklet fallback exists only for
non-production preview builds and MUST log a `risk` diagnostic.

**AUD-R035** The worklet module MUST be loaded from the same origin as the app (not a `blob:` URL) so
that CSP `worker-src`/`script-src` rules can be satisfied (SEC-§3), and its build MUST be a separate
tsconfig target (`lib: WebWorker`, REPO-R012).

**AUD-R036** Communication MUST be a small, versioned message protocol with *sample-accurate*
timestamps expressed relative to `AudioContext.currentTime`:

```ts
type MixerCommand =
  | { t: 'play'; id: number; sound: SoundId; startFrame: number; endFrame: number;
      loop: { start: number; end: number; count: number } | null;
      gain: number; pan: number; envelope: EnvelopePoint[] | null;
      when: number /* ctx time, seconds */ }
  | { t: 'stop'; id: number; when: number; fadeMs: number }
  | { t: 'update'; id: number; gain?: number; pan?: number }
  | { t: 'chunk'; id: number; index: number; data: Float32Array /* transferred */ }
  | { t: 'setMasterVolume'; gain: number }
  | { t: 'stopAll'; when: number };
```

**AUD-R037** Commands MUST be applied at their `when` timestamp inside the render loop, not at the
time the message is observed, so that scheduling is jitter-free even when the main thread stalls
(GC, layout, long frame).

**AUD-R038** Every sound started by game code within the same frame MUST be scheduled at the *same*
`when` value (the frame boundary time) so that simultaneous sounds stay phase-aligned (games use
this for chords and layered hits). `[oracle-pinned]` `T-AUD-012`.

### 5.2 Voice model

```ts
interface Voice {
  id: number;
  frames: ChunkedPcm;        // ring buffer of decoded chunks with frame-accurate indexing
  position: number;          // canonical-rate frame index
  loop: LoopRegion | null;
  loopsRemaining: number;    // Infinity for forever
  gain: number;              // linear, from volume/100
  pan: number;               // -1..1 after mapping from -100..100
  envelope: EnvelopePoint[] | null;
  envelopeCursor: number;
  fade: { from: number; to: number; frames: number; elapsed: number } | null;
  state: 'playing' | 'ending' | 'done';
}
```

**AUD-R039** Voice limit: `audio.maxVoices` (default 32; mobile 16). When exceeded, the mixer MUST
steal by this priority order, and MUST log a one-time `risk` diagnostic with the count of steals:
1. voices in `ending` state,
2. quietest voices (lowest instantaneous envelope×gain),
3. the oldest non-looping voice,
4. never steal a voice with `loopsRemaining === Infinity` if a non-looping voice exists.
A stolen voice MUST be faded out over ≥ 8 ms, never cut (clicks).

**AUD-R040** Volume mapping MUST be **linear in amplitude**: `gain = volume / 100`, matching Flash's
`Sound.setVolume`. Do not apply perceptual (dB) conversions; doing so makes a 50-volume sound sound
different from the original.

**AUD-R041** Pan mapping: `pan = pan100 / 100` with an **equal-power** law for the stereo image
(`gainL = cos(θ)`, `gainR = sin(θ)`, `θ = (pan + 1) × π/4`). Flash's internal pan law is
undocumented; equal-power matches the measured behaviour at the extremes and keeps the centre at
unity (`AUD-D02`, `[oracle-pinned]` `T-AUD-013`).

**AUD-R042** Envelopes (from `SOUNDINFO`) use **44 100 Hz positions** regardless of the sound's rate:
`Pos44` is a `UI32` sample position (not a 0…32767 grid — corrected from the Ch.11 text, `E-018`);
`LeftLevel`/`RightLevel` are 0…32768 per channel, with 32768 = unity. Conversion:

```
frame = round(pos44 × canonicalRate / 44100)        // exact integer arithmetic
level = level / 32768                               // per channel, 32768 = unity
```

Two-point envelopes (the common case: fade-in/fade-out) MUST be applied as linear ramps between
points; more than two points MUST be applied by piecewise-linear interpolation with the *last* point
holding to the end of the sound (Flash semantics). `[oracle-pinned]` `T-AUD-014`.

**AUD-R043** Envelope application MUST be per-sample inside the mixer (not via `AudioParam`
automation) because envelopes combine multiplicatively with the voice's own gain/pan and must survive
looping. This is a deliberate cost: envelopes are rare, so the fast path (no envelope) MUST skip the
per-sample multiply entirely.

### 5.3 Mixing quality

**AUD-R044** Mixing MUST be float32 with **no rounding between voices** (accumulate in a float32
bus; the worklet output is float32). Sums MUST be computed with a *neutral* order (voice id order)
so renders are deterministic.

**AUD-R045** The master bus MUST include a **peak guard only**: if the mixed sample exceeds ±1.0,
apply a single soft-knee limiter with a fixed 1 ms attack / 50 ms release and a maximum gain
reduction of 6 dB, and report `SF0320` (risk, once) naming the frame. This prevents the harsh
clipping that would otherwise occur on cheap speakers, and it is *not* a mastering compressor (it
does nothing when the mix is sane).

**AUD-R046** The engine MUST support at least 48 kHz output; if the `AudioContext` runs at 44.1 kHz
(device default), the mixer MUST resample its own output using a documented high-quality path rather
than letting the browser's implicit resampler degrade transient fidelity. Implementations SHOULD
prefer requesting `new AudioContext({ sampleRate: 48000, latencyHint: 'interactive' })` and MUST
handle a browser that ignores the request by falling back to mixing at the context's rate from
pre-resampled-*from*-canonical PCM (double resample avoided by keeping the canonical rate in the
manifest).

### 5.4 Decoded PCM cache and streaming

**AUD-R047** Decoded PCM for SFX (< `audio.chunkSeconds`) is held in a bounded LRU byte pool
(`audio.pcmCacheMb`, default 64 desktop / 32 mobile) and shared across identical sounds and across
voices.

**AUD-R048** Streaming voices hold a ring buffer of at most `streamAheadSeconds` (default 12 s) of
decoded PCM, refilled by the main thread posting `chunk` messages. The worklet MUST render silence
(and keep time) if it runs dry, and MUST report an underrun counter (`SF0321`, risk, rate-limited) —
an underrun is a bug in the prefetch policy, not a normal condition.

**AUD-R049** Prefetch policy: on `play`, request the chunk containing the start frame plus the next
chunk; then keep `streamAheadSeconds` buffered ahead of the play position; on `seek`/loop, re-request
from the target chunk. Chunk requests MUST be prioritised by "audible within N ms".

**AUD-R050** Decoding of *compressed* chunks (Opus/AAC/MP3) MUST happen on the main thread using
`AudioContext.decodeAudioData` (or the codec's WASM decoder when the browser cannot decode a
variant), then be posted to the worklet. Decoding MUST NOT happen in the worklet thread (worklets
have no `decodeAudioData`, and blocking the audio thread is unacceptable).

### 5.5 Position reporting and the clock

**AUD-R051** `Sound.position` MUST be reported in **milliseconds**, computed from the canonical frame
position (`position × 1000 / canonicalRate`), floored to an integer as Flash does.

**AUD-R052** Position MUST be maintained by the mixer from its *scheduled start time and the audio
clock*, not from a callback: `position = (ctx.currentTime − startTime) × rate + startFrame`, clamped
to the sound's range and stopped at `loopEnd`/`frameCount`. This guarantees correct positions when
the context is suspended, when the tab is hidden, and when the output is muted (AUD-G4).

**AUD-R053** `AudioContext` suspension MUST pause positions: on `statechange → suspended`, the mixer
freezes its audio clock offset; on resume, it re-anchors and reports the gap as a `pause` event so
the AVM1 layer can (optionally) fire `onSoundComplete` late rather than early.

**AUD-R054** `onSoundComplete` MUST fire exactly once per non-looping playback, at the frame whose
scheduled end time has passed *in the audio clock*, dispatched into the runtime's event queue as an
AVM1 async completion (AVM1-R082). If audio is unavailable (autoplay blocked, no device), the event
MUST still fire on the timeline clock so game logic cannot deadlock.

## 6. SWF-specific playback semantics

### 6.1 Event sounds

**AUD-R055** `StartSound` (`SOUNDINFO`) MUST honour:
- `SoundId` → the compiled sound asset,
- `InPoint`/`OutPoint` → the played region (canonical frames),
- `LoopCount` → repetitions (AUD-R029),
- `StopPlayback` → stop (no `NoMultiple` interplay),
- `NoMultiple` → if the same sound is already playing on the same *owner clip*, do not start another,
- `Envelope` → per-channel ramps (AUD-R042).

**AUD-R056** `DefineButtonSound` MUST be honoured for all four button states (up/over/down/hit-test)
with the documented trigger order (a button's "over" sound plays on roll-over even while another
sound is playing unless `NoMultiple`).

**AUD-R057** Flash's timeline `StartSound` is *not* re-triggered when the playhead loops back over the
frame unless the frame is re-entered — same as any other frame action (AVM1-§3.3). This is handled by
emitting the `startSound` call from the frame's action block, not by a per-frame scan.

### 6.2 Stream sounds

**AUD-R058** A stream sound is *not* an asset until the compiler reconstructs it. The reconstruction:

```
1. Read SoundStreamHead2 (or SoundStreamHead): format, source rate/size/stereo,
   playback rate/size/stereo, SampleSize (average samples/frame), LatencySeek (MP3 only).
2. Walk the timeline in frame order; each SoundStreamBlock's payload is appended to the
   stream's byte stream, tagged with the frame index it belongs to.
3. For MP3, each block starts with a 4-byte header:
       UI16 sampleCount    // frames in this block (canonical-ish, see below)
       SI16 seekSamples    // signed adjustment for this block
   The remaining bytes are raw MPEG frames.
4. For ADPCM, each block begins with its own per-block ADPCM header and decodes to
   `sampleCount` frames (AUD-R007).
5. For PCM, blocks are raw frames.
6. Build a *frame → canonical start frame* table as the running sum of block sample counts,
   adjusted by seek samples, then trim the concatenated decode to the timeline's length.
```

**AUD-R059** The `sampleCount`/`seekSamples` header applies **only to MP3** stream blocks; treating
ADPCM blocks as if they had this header is a known and common defect. `[verify]` `AUD-D03`.

**AUD-R060** `seekSamples` semantics: positive = skip that many decoded frames at the start of this
block's contribution; negative = the previous block's tail overlaps this block by |n| frames; the
compiler MUST apply it while building the concatenated PCM and MUST record any resulting
discontinuity (a sign of a malformed stream) as `SF0306`.

**AUD-R061** The playback rate/size/stereo fields MUST be applied during reconstruction
(AUD-R003): e.g. a 22 050 Hz source with playback rate 11 025 MUST be resampled to half, and a mono
source with stereo playback duplicated.

**AUD-R062** The reconstructed stream is then normalised exactly like an event sound: resampled to
canonical rate, trimmed to the declared length, encoded as one logical asset **with a frame table**:

```jsonc
"stream_music_intro": {
  "kind": "stream",
  "frameCount": 4_320_000,                 // canonical frames
  "sampleRate": 48000,
  "frameTable": { "fps": 24, "entries": [0, 2000, 4000, /* … */] },   // per timeline frame
  "chunks": [ /* as for any long asset */ ]
}
```

**AUD-R063** The frame table MUST be delta-encoded or run-length-encoded when dense (a 30-minute
stream at 24 fps is 43 200 entries — acceptable, but RLE of repeated deltas keeps the manifest small).

**AUD-R064** Playback: on entering a frame with a stream sound, the runtime starts the stream voice at
`frameTable[currentFrame]`; on the next frame it verifies the voice's expected position against
`frameTable[nextFrame]` and, if the drift exceeds `audio.syncToleranceMs` (default 12 ms), it MUST
re-anchor the voice by a *hard seek with a 2 ms crossfade* rather than by adjusting the rate
(rate adjustment produces audible pitch wobble). Drift events are counted and reported
(`SF0322`, info, rate-limited).

**AUD-R065** On a playhead jump (`gotoAndPlay`, loop, `_root.gotoAndStop`), the stream MUST restart at
the destination frame's table entry, stopping the previous voice with a ≤ 2 ms fade (Flash restarts
streams at frame boundaries; it does not continue mid-air).

**AUD-R066** Stream sounds MUST continue playing during the *same* frame's multiple advances
(catch-up frames, AVM1-R007) with their positions derived from the timeline, not from repeated
restarts: a catch-up of 3 frames may skip intermediate table entries but MUST land exactly on the
final frame's entry.

### 6.3 Runtime-loaded audio (`Sound.loadSound`)

**AUD-R067** `Sound.loadSound(url, isStreaming)` in compiled output MUST be resolved through the
asset manifest (CMP-R032). If the URL is not in the manifest:
- `network.policy: 'deny'` (default): the load fails, `onLoad(false)` fires, `SF0703` was already
  reported at compile time;
- `'allowlist'`: fetch, decode via `decodeAudioData`, and play through the same mixer (streaming
  variant buffers progressively);
- `'all'`: same, with a security warning (`SF0704`).

**AUD-R068** `Sound.getBytesLoaded`/`getBytesTotal` MUST report the *asset's* byte size from the
manifest for bundled sounds (so loading-progress UI shows sensible values), and real HTTP progress
for allowed network loads.

**AUD-R069** `Sound.duration` MUST return milliseconds from the manifest's `frameCount`
(not from a decoded buffer — the sound may not be decoded yet), and `Sound.position` MUST track even
while decoding is pending (position advances from the scheduled time).

## 7. Autoplay, unlocking, and lifecycle

**AUD-R070** Audio contexts start suspended on most browsers. Boot MUST attempt `resume()` and, if
that fails, install a one-shot unlock listener on the first `pointerdown`/`keydown`/`touchstart`, then
`resume()`. The unlock MUST be surfaced to game code as `audio.unlocked = true` and MUST NOT change
game logic (games that gate on sound availability must still work — we accept the "no sound until
click" reality of the platform).

**AUD-R071** Playback requests made *before* unlock MUST be queued with their full parameters
(including loop and envelope state) and started at unlock time, with positions advanced as if they
had been playing silently from their requested start time (AUD-G4). Sound-triggering game logic must
never desynchronise from the visible state.

**AUD-R072** `document.visibilitychange` → hidden: the mixer MUST keep rendering (browsers may
throttle it) but MUST re-anchor positions on return; a hidden period longer than
`audio.maxBackgroundMs` (default 60 s) MUST stop non-looping voices and report them complete.

**AUD-R073** Device changes (`devicechange`, sample-rate change, output switch) MUST be handled by
recreating the context, transferring voice parameters, and re-anchoring; a `SF0323` (info) is
recorded. Mid-playback recreation MUST fade out/in over 20 ms to avoid clicks.

**AUD-R074** Global mute (`stopAllSounds`, `Sound.setVolume(0)`, integrator mute) MUST NOT pause the
mixer clock or stop voices; it sets master gain to 0. `Sound.position` and `onSoundComplete` continue
to behave as if audible (games use muted audio to advance timelines).

## 8. Diagnostics

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0301` | error | Reserved/unknown sound format code |
| `SF0302` | info | 8-bit PCM treated as little-endian (platform-endian source) |
| `SF0304` | warning | Truncated sound payload padded with silence |
| `SF0305` | info | MP3 parameter change mid-stream |
| `SF0306` | warning | MP3 stream seek/sample-count discontinuity |
| `SF0307` | warning | Nellymoser/Speex sound with no decoder in this build (silent partial asset; which codec is recorded). `IMPL-090` splits the two: `SF0307` Nellymoser, `SF0303` Speex |
| `SF0309` | info | `Microphone`/`Camera` referenced; unsupported |
| `SF0310` | error | Encoded asset failed the exact-length check; codec fallback used |
| `SF0311` | info | Deduplicated sounds (n sources → 1 asset) |
| `SF0320` | risk | Peak guard engaged (mix exceeded full scale) |
| `SF0321` | risk | Stream underrun |
| `SF0322` | info | Stream sync re-anchor |
| `SF0323` | info | Audio device/context recreated |

## 9. Testing and verification

### 9.1 Decode conformance

| ID | Test | Level |
| --- | --- | --- |
| T-AUD-001 | PCM decode: exact float conversion for all 8/16-bit patterns | F1 |
| T-AUD-002 | ADPCM: all four bit widths, mono/stereo, round-trip against reference vectors | F1 |
| T-AUD-003 | ADPCM: block-header-per-frame stream (no click; verified by derivative bound) | F1 |
| T-AUD-004 | ADPCM tables transcribed correctly (bit-exact vs oracle decode of a fixture) | F1 |
| T-AUD-005 | MP3 event sound: trim to declared frame count; passthrough offset correct | F2 |
| T-AUD-006 | MP3 stream: 4-byte block header handling; sample table sums to frameCount | F2 |
| T-AUD-007 | Nellymoser/Speex decode against reference vectors | F2 |
| T-AUD-008 | Resampler: passband/stopband specs met (swept sine + spectral check) | F3 |
| T-AUD-009 | Loop points survive resampling (frame-exact) | F1 |
| T-AUD-010 | Chunked asset: concatenated decode is sample-exact | F1 |
| T-AUD-011 | `LoopCount = 0` oracle pin: `SOUNDINFO` loops forever, AS `Sound.start(0)` plays once (`AUD-D01`) | F3 |
| T-AUD-012 | Layered/chord starts mix without dropping voices; peak guard engages only above the limit (`AUD-D08`) | F3 |
| T-AUD-013 | Pan law: equal-power curve vs oracle at 5 pan positions (`AUD-D02`) | F3 |
| T-AUD-014 | End-of-sound and `stop()` semantics: playback holds to the authored end, no early truncation | F2 |

### 9.2 Playback conformance (offline renders)

Playback tests run in Chromium via `OfflineAudioContext` at 48 kHz, rendering the mixer's output to a
buffer, then compare:

| ID | Test | Metric / threshold |
| --- | --- | --- |
| T-AUD-020 | Single voice, unity gain | bit-exact vs source PCM (±1 LSB if codec round-trip) |
| T-AUD-021 | Two voices, phase alignment at the same `when` | sample offset 0 |
| T-AUD-022 | Loop of a 1 s tone, 100 iterations | last loop's start frame exactly equals `loopStart` (no drift) |
| T-AUD-023 | Envelope with 3 points vs. computed expectation | ≤ −60 dBFS error |
| T-AUD-024 | Pan law at −100/0/+100 | equal-power curve within 0.5 dB |
| T-AUD-025 | Voice stealing: 48 simultaneous starts with `maxVoices = 32` | no discontinuity > −30 dBFS (click detect) |
| T-AUD-026 | Mute + position | `Sound.position` advances at exactly 1.0× real time |
| T-AUD-027 | Stream sync over 10 minutes with a jump every 30 s | drift ≤ 12 ms; re-anchor events logged |

**AUD-R075** Click detection MUST be part of CI: for any transition (start, stop, steal, loop,
re-anchor), the maximum absolute first difference in the rendered output MUST be below the
fixture's declared bound (default: no single-sample jump > 0.05 full scale, and no more than 32
consecutive samples above 0.01 in a region where the source is silent).

### 9.3 Performance gates

| Budget | Desktop | Mobile |
| --- | --- | --- |
| Mixer CPU per 128-frame quantum (32 voices, no envelopes) | ≤ 0.5 ms | ≤ 1.0 ms |
| Mixer CPU with 4 envelope voices | ≤ 0.7 ms | ≤ 1.4 ms |
| Main-thread audio work per frame (excluding decode) | ≤ 0.2 ms | ≤ 0.4 ms |
| Decode time at build (per minute of 44.1 kHz stereo MP3) | ≤ 0.9 s | — |
| Encode time at build (per minute, Opus 160 kbps) | ≤ 2.5 s | — |
| First-audio latency after `play()` (unlocked, cached) | ≤ 30 ms | ≤ 60 ms |
| First-audio latency (cold, streaming, chunked) | ≤ 250 ms | ≤ 500 ms |
| PCM memory (SFX cache) | ≤ 64 MB | ≤ 32 MB |
| Manifest audio metadata size per minute of music | ≤ 2 KB | — |

**AUD-R076** The mixer MUST be benchmarked on the baseline device with a synthetic 32-voice scene
(`vitest bench` + Playwright audio harness). A regression > 15% fails CI (TST-§7).

### 9.4 Determinism

**AUD-R077** Build-time decode/encode MUST be reproducible: identical input bytes and config produce
identical output bytes. This requires pinned encoder versions and settings recorded in
`EncodeReport`, and forbids encoder features that embed timestamps or random IDs.

**AUD-R078** The runtime mixer MUST render deterministically for a fixed command sequence (same
output buffer hash across runs) when the graph is offline; online output is not required to be
bit-identical (it depends on the audio device clock), but *positions* derived from the audio clock
must be reproducible in tests (T-AUD-026).

### 9.5 Declared tolerances

| Aspect | Level | Bound |
| --- | --- | --- |
| Decode (PCM/ADPCM) | F1 | bit-exact |
| Decode (MP3/Nellymoser/Speex) | F2 | bit-exact to the reference decoder version |
| Resample | F3 | ≥ 90 dB SNR vs. reference for 1 kHz tone |
| Opus/AAC encode | F3 | ≥ 95 dB SNR vs. source for SFX, ≥ 90 dB for music |
| Mixer arithmetic | F1 | deterministic float32 sums in voice order |
| Flash's original mixer | F4 | not reproduced (fixed-point internals undocumented) |

## 10. Decision register

| ID | Decision | Default | Verification | Notes |
| --- | --- | --- | --- | --- |
| AUD-D01 | `LoopCount = 0` semantics in `SOUNDINFO` vs AS `Sound.start(loops=0)` | SOUNDINFO 0 = forever; AS 0 = once | T-AUD-011 | Two conventions exist; normalise explicitly |
| AUD-D02 | Pan law | Equal-power | T-AUD-024 | Flash's law undocumented |
| AUD-D03 | MP3 stream block 4-byte header (`sampleCount`, `seekSamples`) | Applied to MP3 only | T-AUD-006 | `[verify]` against spec text |
| AUD-D04 | Canonical sample rate | 48000 | Manifest | 44.1 k sources resampled; test A/B for artefacts |
| AUD-D05 | Codec ladder default (Opus primary, AAC fallback) | Opus/WebM + optional AAC | RT-§4.4 | Licensing per SEC-§6 |
| AUD-D06 | Native `AudioBufferSourceNode.loop` for plain ambient beds | Allowed only without envelope/sync | T-AUD-022 | Must record per usage |
| AUD-D07 | Loop crossfade default | 3 ms, on | T-AUD-022 | Authored loops are often discontinuous |
| AUD-D08 | Peak guard on the master bus | On (1 ms/50 ms, ≤ 6 dB) | T-AUD-025 | Protects cheap speakers, no-op normally |
| AUD-D09 | `Sound.position` update source | Audio clock arithmetic (not callbacks) | T-AUD-026 | Required for muted correctness |
| AUD-D10 | Stream re-anchor policy | Hard seek + 2 ms crossfade, tolerance 12 ms | T-AUD-027 | Rate-follow rejected (pitch wobble) |
| AUD-D11 | Chunk size default | 10 s | Manifest | Tune for mobile memory vs request count |
| AUD-D12 | MP3 passthrough when only loop metadata changes | Allowed (offsets are metadata) | T-AUD-005 | Avoids re-encode |
| AUD-D13 | Nellymoser/Speex decoders | Optional dependency, fail per-asset with `--audio.missing=stub` | SEC-§5 | Keeps core dependency-free |
| AUD-D14 | Loudness normalisation | Off | AUD-R032 | Report peaks, never "fix" |

## 11. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | First draft |
| 1.1 | 2026-10-04 | Ch.11-grounded corrections: ADPCM framing (2-bit `AdpcmCodeSize` once per sound/per stream block, packets of one header sample + 4095 codes, bit-packed with no byte alignment, sign-magnitude codes — supersedes the "UI8 encoding + 4096 codes" wording, `E-018`); envelope `Pos44` is a `UI32` 44 100 Hz sample position, levels 0…32768 (corrects `AUD-R042`); `SoundSampleCount` stated as a per-channel count (pairs for stereo); `SF0307` scope clarified |
| 1.2 | 2026-10-04 | Test obligations `T-AUD-011`–`014` (the oracle-pinned loop, layering, pan-law and end-of-sound measurements cited throughout §3–§5) are now defined in §9 |
