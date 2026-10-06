# IMPL-090 — Sounds: Event, Streaming, and Codec Paths

**Doc ID:** IMPL-090 · **Status:** ✅ grounded in Ch.11 · **Package:** `@swf-forge/swf` + `@swf-forge/audio`
**Format spec:** Chapter 11 — Sounds (event vs streaming sound, the sample-rate and coding-format
tables, `DefineSound`, `StartSound`, `StartSound2`, `SOUNDINFO`/`SOUNDENVELOPE`,
`SoundStreamHead`/`SoundStreamHead2`, `SoundStreamBlock`, `MP3STREAMSOUNDDATA`, frame subdivision,
ADPCM packets, MP3 frames, Nellymoser, Speex)
**Design specs:** AUD (whole: codecs, resampling, mixing, streaming, latency), RT-§6 (audio
scheduling), CMP-§4.8 (audio pipeline), AST-§5 (asset emission), APP-§8/§9 (ADPCM tables)
**Pinned byte layouts:** APP-§10.9 (Ch.11 structures) — this document carries semantics, packet
framing, and the traps.

---

## 1. Deliverables

1. `DefineSound` (event sounds) with all codec paths: uncompressed 0/3, ADPCM, MP3, Nellymoser
   (4/5/6), Speex (11), and reserved foreign formats (silent stub + report).
2. `StartSound`/`StartSound2` + `SOUNDINFO` into scheduling records: sync flags, loop count,
   in/out points, envelopes.
3. Streaming sound: `SoundStreamHead`/`SoundStreamHead2` + the ordered `SoundStreamBlock` sequence
   with block↔frame association, `MP3STREAMSOUNDDATA` headers, and a frame→sample offset table.
4. The ADPCM decoder (`APP-§9` tables): the only codec we decompress ourselves — bit-exact.
5. MP3 handling: frame-header parsing (rate/bitrate/padding/size), **byte-identical pass-through**
   of the frames to the browser decoder, and correct latency/seek handling.
6. Nellymoser/Speex: detect, report, emit a correct-duration silent partial (or the optional
   build-time transcode hook, decision `AUD-D06`).
7. Audio asset emission: canonical 48 kHz, 10 s chunks (AST-§5), peak/RMS and loop metadata.
8. The runtime's scheduling data (doc 130/RT-§6): voice priority, envelope, loop points, stream
   offsets.

**Non-goals:** the mixer/DSP, browser playback/scheduling/stream synchronization (P8), and any new codec
(we decode ADPCM only). P3 owns the decoded sound models and deterministic build/preview assets; P8
owns playback and real-time behavior. Video is P10 (`IMPL-110`) and does not consume a P3 completion
claim from this document.

## 2. Module layout

```
packages/swf/src/sounds/
  define-sound.ts        DefineSound (14): format/rate/size/type/sampleCount + payload view
  sound-info.ts          SOUNDINFO + SOUNDENVELOPE
  start-sound.ts         StartSound (15), StartSound2 (89)
  stream-head.ts         SoundStreamHead (18), SoundStreamHead2 (45)
  stream-blocks.ts       SoundStreamBlock (19) ordering, frame association, MP3STREAMSOUNDDATA
  codec-detect.ts        format dispatch + reserved-format reporting
packages/audio/src/codecs/
  adpcm.ts               SWF IMA ADPCM: packets, predictors, 2–5-bit codes
  mp3-frames.ts          frame parser: sync, header fields, sample counts, frame size
  mp3-pass.ts            pass-through scheduling (no re-encode)
  nellymoser.ts          detect + report (+ optional transcode hook)
  speex.ts               detect + report
  resample.ts            48 kHz canonical conversion (deterministic)
  pcm.ts                 PCM emission + metadata (peak, RMS, loop points)
```

**IMPL-090-R001** `packages/audio` MUST be usable in the asset worker (build) and the browser
(streaming), so it MUST NOT touch DOM APIs outside a `platform/` adapter
(`AudioDecoder`/`AudioWorklet` vs Node).
**IMPL-090-R002** Payloads are decoded lazily: `DefineSound` keeps a compressed view; only the
asset pass (or the runtime, for streaming) decodes.

## 3. The sound model

- **Two kinds of sound** (chapter): *event sounds* (defined with `DefineSound`, played by
  `StartSound`/`StartSound2`, must be downloaded before use, reusable, styled by `SOUNDINFO`) and
  *streaming sounds* (stored per frame with the timeline, played in tight sync).
- **Sample rates** are exactly `5512 / 11025 / 22050 / 44100 Hz` (5.5/11/22/44 kHz) — the encoded
  field is a 2-bit index (`0 = 5.5`, `1 = 11`, `2 = 22`, `3 = 44`).

| Format | Codec | Min SWF | Notes |
| --- | --- | --- | --- |
| 0 | Uncompressed, **native endian** | 1 | 8-bit identical to format 3; 16-bit is host-endian (we always decode big-endian, `SF0302`) |
| 1 | ADPCM | 1 | 2–5-bit codes; block/packet framed (below) |
| 2 | MP3 | 4 | whole MPEG frames; `5.5 kHz` is not allowed |
| 3 | Uncompressed, **little-endian** | 4 | preferred; player byte-swaps as needed |
| 4 / 5 | Nellymoser 16 kHz / 8 kHz | 10 | mono; `SoundRate`/`SoundType` ignored |
| 6 | Nellymoser | 6 | mono; `SoundRate`/`SoundType` ignored |
| 11 | Speex | 10 | always 16 kHz mono; `SoundRate`/`SoundSize`/`SoundType` ignored |
| 7–10, 12–15 | reserved | — | silent stub + `SF0301` |

**IMPL-090-R003** `SoundFormat` is the dispatch key, and each codec's payload is parsed by exactly
one module. A reserved format MUST produce a correctly lengthed silent asset plus `SF0301` (error
severity is about fidelity, not about failing the build — design CMP-R007).

## 4. `DefineSound` and the codec payloads

```
DefineSound (14, SWF 1):
  SoundId UI16
  SoundFormat UB[4]   SoundRate UB[2]   SoundSize UB[1]   SoundType UB[1]
  SoundSampleCount UI32      // NOT affected by mono/stereo: for stereo this is the number of PAIRS
  SoundData UI8[...]
```

- **IMPL-090-R004** `SoundRate` MUST be ignored for Nellymoser and Speex; `SoundSize` MUST be
  ignored for every compressed format (they all decode to 16-bit internally); the *effective* rate
  for those codecs comes from the codec (`16 kHz` for Speex and Nellymoser-16k, `8 kHz` for
  Nellymoser-8k, and the Nellymoser/MP3 frame data for the rest).
- **IMPL-090-R005** `SoundSampleCount` is a **per-channel sample count** ("for stereo, the number of
  sample pairs"). Duration = `SoundSampleCount / effectiveRate`; a payload that decodes to fewer
  samples than declared is padded with silence and reported (`SF0304`); more is truncated with
  `SF0324`. The three checks together are what catches a wrong rate.
- **IMPL-090-R006** Uncompressed 0 and 3 decode to identical PCM for 8-bit data; for 16-bit data,
  format 3 is little-endian and format 0 is native-endian. We always decode format 0 as
  **big-endian** regardless of build host (determinism, REPO-R013) and report `SF0302` (info); this
  is a documented deviation from the chapter's "native" wording, pinned by `T-AUD-103`.
- **IMPL-090-R007** MP3 event payloads are `MP3SOUNDDATA`: `SeekSamples SI16` followed by zero or
  more `MP3FRAME`s. There is **no sample-count field** in the event payload — the count comes from
  `DefineSound.SoundSampleCount`. `SeekSamples` for an event sound is limited to the **encoder
  latency** and is applied as a trim (AUD-R059's decision applies to streams only; keep one
  implementation in `mp3-frames.ts`).
- **IMPL-090-R008** MP3 frames are never re-encoded: the emitted asset keeps the original frames
  (hash equality, `T-AUD-105`) unless the platform forces a transcode, which MUST be recorded
  (`SF0329`, `budgets.json`).
- **IMPL-090-R009** The MP3 frame header is parsed field-by-field: 11-bit sync (all ones), version
  (`0 = MPEG 2.5`, `1 = reserved`, `2 = MPEG 2`, `3 = MPEG 1`), layer (**always 1 = Layer III** in
  SWF files), protection bit, 4-bit bitrate index (bitrates are *thousands of bits per second*:
  index × 1000 when used in the size formula), 2-bit rate index (`0 = 44.1/22.05/11.025 kHz`,
  `1 = 48/24/12`, `2 = 32/16/8`), padding bit, channel mode (`0` stereo, `1` joint stereo,
  `2` dual channel, `3` mono — the chapter's table prints "2" twice; errata `E-018`), mode
  extension, copyright, original, emphasis. Frame size, integer arithmetic:
  `size = ((version == MPEG1 ? 144 : 72) × bitrateBps) / sampleRate + paddingBit`;
  the *sample data* is `size − 4` bytes (the chapter's worked example: MPEG1, 128 kbps, 44.1 kHz,
  padding → 414 bytes of data). A frame whose header fails to parse drops the frame and reports
  `SF0308`.
- **IMPL-090-R010** Nellymoser (4/5/6) is single-channel and groups samples into **256-sample
  frames**; we do not implement the codec: emit a correct-duration silent partial, flag
  `audioUnsupported`, and report `SF0307`.
- **IMPL-090-R011** Speex (11) is always 16 kHz mono and always decodes internally to 16-bit; the
  `SoundRate`/`SoundSize`/`SoundType` fields are ignored. Same fallback policy as Nellymoser
  (`SF0303`).

### 4.1 ADPCM framing (format 1)

```
ADPCMSOUNDDATA:
  AdpcmCodeSize UB[2]        // 0 = 2, 1 = 3, 2 = 4, 3 = 5 bits per code (value + 2)
  ADPCMPACKET[]              // mono: ADPCMMONOPACKET; stereo: ADPCMSTEREOPACKET

ADPCMMONOPACKET:      InitialSample SI16, InitialIndex UB[6],
                      AdpcmCodeData UB[4095 × (AdpcmCodeSize + 2)]
ADPCMSTEREOPACKET:    InitialSampleLeft SI16, InitialIndexLeft UB[6],
                      InitialSampleRight SI16, InitialIndexRight UB[6],
                      AdpcmCodeData UB[8190 × (AdpcmCodeSize + 2)]   // L,R interleaved
```

- **IMPL-090-R012** A packet is **one header sample + 4095 codes** (4096 samples total) per channel
  — v1.0's "64 samples per block" was wrong (errata `E-018`). Codes are **sign-magnitude**, not
  two's complement: the top bit is the sign, the low `bits−1` bits index the chapter's tables
  (which give only the lower half; the upper half is its duplicate precisely because the sign is
  carried separately). The predictor and step index **restart from the packet header** for every
  packet; a decoder that carries state across packets clicks at every packet boundary (the classic
  "ADPCM stream crackle").
- **IMPL-090-R013** The payload is a **continuous bit stream with no byte alignment**: 2 bits of
  `AdpcmCodeSize` at the top of the first byte, then packets back to back, a packet being
  `22·channels + 4095·channels·bits` bits (the header sample starts at bit 2 and is not byte
  aligned; the next packet starts immediately after the last code). A payload that ends inside a
  packet is the *last* packet: its header is complete, so decode the codes present, pad to the
  declared sample count with silence, and report `SF0328` (warning) exactly once per sound. A
  payload that cannot be split into whole packets plus at most one header-complete partial packet is
  `SF0328` (error) — the bit stream is not decodable without inventing samples.
- **IMPL-090-R014** The decoder is integer-only and reproduces the chapter's tables
  (`APP-§9`: `stepIndex` 0–88, `INDEX_TABLE` per bit depth, the standard IMA step table), so
  `T-AUD-101` can be bit-exact against reference vectors. 8-bit ADPCM does not exist: output is
  always 16-bit PCM.
- **IMPL-090-R015** `AdpcmCodeSize` applies to the **whole sound**, not per packet; a mid-sound
  change is a malformed stream (`SF0328`).

## 5. `StartSound` / `StartSound2` / `SOUNDINFO`

```
StartSound (15, SWF 1):   SoundId UI16, SoundInfo SOUNDINFO
StartSound2 (89, SWF 9):  SoundClassName STRING, SoundInfo SOUNDINFO
                          (the chapter's prose is a copy of StartSound's; the field table is authoritative)

SOUNDINFO (8 flag bits, MSB-first):
  Reserved UB[2] = 0   SyncStop UB[1]   SyncNoMultiple UB[1]
  HasEnvelope UB[1]    HasLoops UB[1]   HasOutPoint UB[1]   HasInPoint UB[1]
  InPoint   if HasInPoint    UI32    // samples to skip at the start
  OutPoint  if HasOutPoint   UI32    // position (in samples) of the LAST sample to play
  LoopCount if HasLoops      UI16
  EnvPoints if HasEnvelope   UI8
  EnvelopeRecords SOUNDENVELOPE[EnvPoints]: Pos44 UI32, LeftLevel UI16, RightLevel UI16
```

- **IMPL-090-R016** The flag byte's bit order is MSB-first (`SyncStop` is bit 5, `HasInPoint`
  bit 0). Reading the flags as a little-endian byte reverses every condition and shifts the
  optional fields — `T-AUD-109` pins the byte.
- **IMPL-090-R017** `SyncStop` **stops** the sound now; `SyncNoMultiple` suppresses a start if the
  sound is already playing. `StartSound2` plays a *sound class* from another SWF (an AVM2-era
  feature); for AS1/AS2 content it is reported and the class name recorded (`SF0309`-class info).
- **IMPL-090-R018** `InPoint`/`OutPoint` are sample positions in the **sound's own rate**;
  `OutPoint` is the position of the *last sample to play* (inclusive), not a length. Both are
  converted to canonical samples as `position × 48000 / effectiveRate` with exact integer
  arithmetic, then used to trim the asset (`loop`/`trim` metadata, AUD-§4.4).
- **IMPL-090-R019** `SOUNDENVELOPE.Pos44` is a **44-kHz sample position** (a `UI32`, unbounded —
  not a 0…32767 grid; the design spec's `AUD-R042` said otherwise, errata `E-018`) and levels are
  `0…32768`, where **32768 = unity gain** and `gain = level / 32768`. Envelope points MUST be
  converted to *seconds* once (`pos44 / 44100`) and re-expressed in canonical samples; mixing
  44-kHz positions into a 48-kHz timeline is what makes envelopes fade at the wrong speed.
- **IMPL-090-R020** For a mono sound, `LeftLevel` and `RightLevel` are set to the same value;
  if they differ, the chapter says they "will be averaged" — we average (and record it once,
  `SF0332`-class info) so a mono asset never gets a phantom pan.
- **IMPL-090-R021** Loop count semantics: `LoopCount = 0` or `1` plays once; `n > 1` **repeats
  n times in total** (design AUD-R038 pinned the interpretation; the decoders here only carry the
  value through unchanged).
- **IMPL-090-R022** `StartSound` is frame-timed: the model attaches it to the frame index so the
  runtime schedules it on that frame's audio boundary, never a JS tick later (AUD-R052).

## 6. Streaming sound

```
SoundStreamHead (18, SWF 1) / SoundStreamHead2 (45, SWF 3):
  Reserved UB[4] = 0
  PlaybackSoundRate UB[2]  PlaybackSoundSize UB[1]  PlaybackSoundType UB[1]
  StreamSoundCompression UB[4]  StreamSoundRate UB[2]  StreamSoundSize UB[1]  StreamSoundType UB[1]
  StreamSoundSampleCount UI16      // average samples per block; PAIRS for stereo
  LatencySeek SI16                 // present ONLY when StreamSoundCompression == MP3

SoundStreamBlock (19, long header): StreamSoundData, one per SWF frame
  MP3 blocks: SampleCount UI16, then MP3SOUNDDATA (SeekSamples SI16, MP3FRAME[])
```

- **IMPL-090-R023** `SoundStreamHead`'s `PlaybackSoundSize` and `StreamSoundSize` are **always 1
  (16-bit)** for the v1 tag; `SoundStreamHead2` is the variant that allows 8-bit and arbitrary
  compression/size combinations (SWF 3+). Reading the head as a byte-aligned 2×UI16 instead of the
  bit layout above yields a plausible-but-wrong rate and is the single most common stream bug
  (`T-AUD-113`).
- **IMPL-090-R024** The playback triple (`PlaybackSoundRate/Size/Type`) is **advisory** — Flash may
  ignore it — and MUST NOT be used to decode the stream; the stream triple (plus the codec's own
  parameters) governs decoding. A mismatch between playback and stream rates is honoured by
  resampling on the playback path and reported (`SF0326`, info).
- **IMPL-090-R025** `LatencySeek` exists **only** for MP3 streams and must match the first block's
  `SeekSamples`. Files that omit it exist (the tag length tells); we read it when present, treat a
  mismatch or absence as a warning (`SF0330`) and use the first block's `SeekSamples` as the truth.
- **IMPL-090-R026** Streaming blocks are associated with frames **in file order, one per frame**;
  a frame without a block is a *silent frame*, not a gap (the timeline advances). Only one
  streaming sound may play on the main timeline at a time; each sprite may carry its own stream.
  A second `SoundStreamHead` splits the stream into segments (`SF0325`).
- **IMPL-090-R027** `MP3STREAMSOUNDDATA`'s `SampleCount` is the number of samples this block
  contributes (**sample pairs for stereo**): it is authoritative for building the frame→sample
  offset table (`frameOffsets`, exact sample counts, never byte estimates), and `SeekSamples` is
  applied when concatenating. A block with `SampleCount = 0` and no MP3 data is legal padding for a
  frame that cannot fit a whole MP3 frame — it MUST be preserved in the offset table (`SF0331`,
  info) rather than dropped.
- **IMPL-090-R028** Frame subdivision (the chapter's algorithm, emulated when we *write* streaming
  audio in tests or when re-chunking):
  1. ideal samples per SWF frame = `sampleRate / frameRate` (non-integer ⇒ alternate one-over /
     one-under block sizes so the running average stays exact);
  2. MP3 blocks must contain **whole MP3 frames** (576 or 1152 samples each), so a block's sample
     count is a multiple of 576/1152 — e.g. at 12 fps and 11 025 Hz, `(11025/12)/576 ≈ 1.6` frames
     per SWF frame, realised as blocks of one and two MP3 frames;
  3. when the ideal is below one MP3 frame, write an empty block (`SampleCount = 0`,
     `SeekSamples = 0`, no data);
  4. `SeekSamples` for each block = ideal − actual as of the end of the previous SWF frame
     (worked example: frame 2 carries two frames and seeks `919 − 576 = 343`);
  5. encoder latency goes into the **first** block's `SeekSamples`, and Flash adds it to every
     later seek (worked example with latency 940: frame 1 = three frames, frame 2 seeks
     `919 − (1728 − 940) = 131`).
- **IMPL-090-R029** Uncompressed and ADPCM streams use the same distribution logic without seek
  samples or latency — but an **ADPCM `SoundStreamBlock` restarts the codec state**: each block's
  data is a fresh `ADPCM` sound-data record, so the 2-bit code size and the packet headers are read
  again per block (a decoder that spans blocks drifts by a packet's worth of samples). Streams are assembled at build time per segment into canonical PCM with a
  frame→offset table so the runtime can start at any frame without re-decoding (AUD-R061).

## 7. Emission and metadata

```ts
export interface AudioAsset {
  readonly id: string;                       // sound_<soundId> or stream_<seq>
  readonly kind: 'event' | 'stream';
  readonly codec: 'pcm-s16' | 'pcm-f32' | 'adpcm-decoded' | 'mp3' | 'aac' | 'silent';
  readonly channels: 1 | 2;
  readonly sampleRate: 48000;                // canonical (AUD-R041)
  readonly durationSamples: number;
  readonly chunks: readonly { url: string; startSample: number; frames: number }[];
  readonly loop: { start: number; end: number } | null;    // canonical samples
  readonly trim: { lead: number; tail: number };           // latency / padding, samples
  readonly gain: number;
  readonly peak: number; readonly rms: number;
  readonly provenance: { source: 'defineSound' | 'stream'; codec: string; transcoded: boolean | string };
}
```

- **IMPL-090-R030** Emission is canonical 48 kHz / 10 s chunks (AST-R031) with deterministic
  resampling (fixed coefficients, integer-friendly, host-independent; `T-AUD-110`).
- **IMPL-090-R031** Every asset carries `peak`/`rms` and a per-chunk peak table, used by the
  null-RMS gate (`≤ −60 dBFS`) and to catch an all-zero payload that was not marked silent
  (`SF0327`).
- **IMPL-090-R032** Trim (encoder latency / decoded-from padding) is *scheduling* metadata, never a
  re-encode: `trim.lead` is removed before loop points are computed so loops do not click.
- **IMPL-090-R033** Loop points are expressed relative to the trimmed start; the runtime
  cross-fades only where the authored loop is longer than the cross-fade (AUD-R045), and the
  metadata records whether a cross-fade is permitted.

## 8. Diagnostics

Codes `SF0300`–`SF0309` keep the meanings the audio design spec
(`docs/specs/web/060-audio-web.md`) already gave them (shared, not duplicated); `SF0320`–`SF0323` are
that spec's runtime conditions (peak guard, stream underrun, sync re-anchor, device recreated);
`SF0324`–`SF0332` are this document's decode-side block (errata `E-011`, `E-019`).

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0300` | warning | MP3 with non-canonical rate/size fields (frame headers win) |
| `SF0301` | error | reserved/unknown sound format (silent stub emitted) |
| `SF0302` | info | 8-bit PCM treated as little-endian; format 0 decoded big-endian for determinism |
| `SF0303` | warning | Speex sound: no decoder in this build (silent partial asset) |
| `SF0304` | warning | payload shorter than `SoundSampleCount` (padded with silence) |
| `SF0305` | info | MP3 parameter change mid-stream |
| `SF0306` | warning | MP3 seek/sample-count discontinuity (stream reassembly) |
| `SF0307` | warning | Nellymoser sound: no decoder in this build (silent partial asset) |
| `SF0308` | warning | MP3 frame sync lost mid-payload (frames dropped, reported) |
| `SF0309` | info | `StartSound2`/sound-class or `Microphone`/`Camera` use; unsupported |
| `SF0324` | warning | `SoundSampleCount` disagrees with the decoded duration by > 5 % |
| `SF0325` | info | streaming sound split into segments (new head tag) |
| `SF0326` | info | playback/stream rate mismatch (playback path resamples) |
| `SF0327` | warning | all-zero audio payload for a non-silent asset |
| `SF0328` | error | ADPCM malformed: code size outside 2–5 bits, or a packet truncated before the last one |
| `SF0329` | info | transcode applied (codec pair recorded) |
| `SF0330` | warning | `LatencySeek` absent or different from the first block's `SeekSamples` (first block wins) |
| `SF0331` | info | stream block with `SampleCount = 0` (legal padding frame; kept in the offset table) |
| `SF0332` | info | mono envelope with differing L/R levels (averaged) |

## 9. Test obligations

The design spec owns `T-AUD-001…027`; this document's obligations use the `1xx` band, so the two
sets can never be confused in a test report.

| ID | Test | Level | Phase owner |
| --- | --- | --- | --- |
| `T-AUD-101` | ADPCM decode vs reference vectors on 200 packets (bit-exact) | F1 | P3 decode/build |
| `T-AUD-102` | ADPCM framing: 2–5-bit codes, mono/stereo packets, 4095-code boundary, short final packet | F1 | P3 decode/build |
| `T-AUD-103` | uncompressed 0 vs 3 produce identical PCM (8-bit) and byte-swapped PCM (16-bit) | F1 | P3 decode/build |
| `T-AUD-104` | MP3 frame parser: sync, version/layer/rate/bitrate/padding, size formula incl. the 414-byte example | F1 | P3 decode/build |
| `T-AUD-105` | MP3 pass-through: bytes unchanged (hash equality), latency trim applied at scheduling | F1 | P3 decode/build |
| `T-AUD-106` | stream block → frame offset table with exact sample offsets (silent frames, empty blocks) | F1 | P3 decode/build |
| `T-AUD-107` | silent frames advance the timeline; audio stays in sync (`SampleCount = 0` blocks) | F2 | P3 decode/build |
| `T-AUD-108` | stream splitting on a second head tag; codec change mid-movie | F1 | P3 decode/build |
| `T-AUD-109` | `SOUNDINFO` flag byte (MSB-first), in/out points, loop count, envelope conversion | F1 | P3 decode/build |
| `T-AUD-110` | resample determinism: same input → identical bytes across runs | F1 | P3 decode/build |
| `T-AUD-111` | chunking at 10 s with exact sample boundaries; loop points survive trimming | F1 | P3 decode/build |
| `T-AUD-112` | peak/RMS metadata on fixtures with known amplitude | F1 | P3 decode/build |
| `T-AUD-113` | `SoundStreamHead`/`Head2` bit layout (2-byte flags block, `LatencySeek` only for MP3) | F1 | P3 decode/build |
| `T-AUD-114` | frame subdivision emulation reproduces the chapter's worked examples (343 and 131) | F2 | P8 runtime |
| `T-AUD-115` | Nellymoser/Speex/reserved formats: correct duration, silent partial, manifest flag | F1 | P3 decode/build |

## 10. Work packages

| WP | Title | Depends | Est | Deliverable | Phase owner |
| --- | --- | --- | --- | --- | --- |
| WP-090-01 | `DefineSound` + codec dispatch + lazy payload model | WP-020-05 | 3 | `define-sound.ts`, `codec-detect.ts` | P3 |
| WP-090-02 | ADPCM packet decoder + parity tests | WP-090-01 | 5 | `adpcm.ts`, T-AUD-101/002 | P3 |
| WP-090-03 | Uncompressed (0/3) + PCM emission | WP-090-01 | 2 | `pcm.ts`, T-AUD-103 | P3 |
| WP-090-04 | MP3 frame parser (header fields, size formula, latency) | WP-090-01 | 4 | `mp3-frames.ts`, T-AUD-104 | P3 |
| WP-090-05 | MP3 pass-through + trim metadata | WP-090-04 | 2 | `mp3-pass.ts`, T-AUD-105 | P3 |
| WP-090-06 | Nellymoser/Speex/reserved fallback assets | WP-090-01 | 2 | `nellymoser.ts`, `speex.ts`, T-AUD-115 | P3 |
| WP-090-07 | `SOUNDINFO` + `StartSound`/`StartSound2` scheduling records | WP-090-01, WP-030-09 | 3 | `sound-info.ts`, `start-sound.ts`, T-AUD-109 | P3 |
| WP-090-08 | Stream heads/blocks, MP3STREAMSOUNDDATA, offset table, segmentation | WP-090-01 | 6 | `stream-*.ts`, T-AUD-106/007/008/013 | P3 |
| WP-090-09 | Frame-subdivision emulator (writer/tests) | WP-090-08 | 2 | T-AUD-114 | P8 |
| WP-090-10 | Resample to 48 kHz (deterministic) | WP-090-03 | 3 | `resample.ts`, T-AUD-110 | P3 |
| WP-090-11 | Chunking + loop/trim metadata + peak/RMS | WP-090-10 | 2 | T-AUD-111/012 | P3 |
| WP-090-12 | `budgets.json` audio section + transcode reporting | WP-090-11 | 2 | AST integration | P6 |
| | **Total** | | **36** | | |

## 11. Open items

| # | Item | Impact |
| --- | --- | --- |
| 1 | ADPCM packets in real files: is the final packet padded to the full bit count, and do any encoders emit exactly 4095 codes without the trailing byte-align | medium (`T-AUD-102`) |
| 2 | `SoundStreamHead`'s `LatencySeek` when absent: does its absence shorten the tag, and do any tools write a zero there | medium (`SF0330`) |
| 3 | Whether any AS1/AS2 title uses `StartSound2`/sound classes (it is AVM2-era) — current policy is report-and-ignore | low (`SF0309`) |
| 4 | Playback vs stream rate mismatches in the wild: how often `PlaybackSoundRate` should be honoured for ADPCM streams | low (`SF0326`) |
| 5 | Reserved formats (7–10, 12–15): whether any pre-SWF-10 content uses code 7 for a codec we could decode | low (`SF0301`) |
| 6 | Nellymoser 256-sample frame alignment for *stream* blocks (our fallback is content-blind silence, so only the duration matters today) | low (`SF0307`) |

The v1.0 open items (field widths, `SOUNDINFO` layout, ADPCM block layout, stream-head/MP3 header
shapes) are **settled** — see §4–§6 and APP-§10.9. The ADPCM "64 samples per block" and envelope
"0…32767 position" statements were wrong and are corrected here and in the design spec (errata
`E-018`).

## 12. Done criteria

1. ADPCM is bit-exact against reference vectors; MP3 is passed through byte-identically with
   correct latency handling.
2. Stream playback from an arbitrary frame is sample-accurate (drift ≤ 12 ms over a 10-minute
   fixture, TST-§6), including silent and empty blocks.
3. Every emitted asset has peak/RMS metadata and chunk boundaries on exact 10 s multiples.
4. Fallback paths (Nellymoser, Speex, reserved) produce correct-duration silent assets with a
   manifest flag and a report line — never a silent drop.
5. Loudness floors: the reference title's UI sounds measure within ±0.6 dB of the Flash oracle
   (AUD-R070).

## 13. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Scoped from Ch.11; ADPCM/MP3 stream-block details marked pending with a reference-vector mitigation |
| 1.1 | 2026-10-04 | Ch.11-grounded: coding-format table with SWF versions and the exact sample rates; `DefineSound` field semantics (`SoundSampleCount` = sample pairs; rate/size/type ignored per codec); **ADPCM packets of one header sample + 4095 codes** (corrects v1.0's "64 samples per block"), bit-packed and unaligned, with a short-final-packet policy, per-packet predictor reset; MP3 `MP3SOUNDDATA` (SeekSamples + frames, no count field) with the honest note that `SoundSampleCount` supplies duration, full frame-header parsing and the integer size formula; Nellymoser/Speex field-ignoring rules; `SOUNDINFO` MSB-first flag byte, `InPoint`/`OutPoint`/`LoopCount` semantics, envelope `Pos44` as a 44-kHz sample position and levels 0…32768; `SoundStreamHead`/`Head2` bit layout with `LatencySeek` only for MP3, advisory playback fields, one block per frame, `MP3STREAMSOUNDDATA` `SampleCount` semantics, the chapter's five-step frame-subdivision algorithm with both worked examples; diagnostics `SF0330`–`SF0332`, `SF0328` reworded; tests `T-AUD-101`–`115`; WPs re-shaped to 12 = 36 d |
