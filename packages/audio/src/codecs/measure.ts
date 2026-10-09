/**
 * Audio asset measurement and chunking (`IMPL-090-R030`–`R033`, WP-090-11).
 *
 * Everything here operates on canonical 48 kHz PCM16 planes and produces metadata only — no
 * samples are rewritten, re-encoded or re-ordered. The numbers must be identical across runs and
 * hosts, so every quantity is computed with integer arithmetic and a fixed rounding rule.
 */

/** Canonical emission rate (`IMPL-090-R030`, `AUD-R041`). */
export const CANONICAL_SAMPLE_RATE = 48_000;

/** Canonical chunk length in seconds (`IMPL-090-R030`, `AST-R031`). */
export const CHUNK_SECONDS = 10;

export interface AudioChunk {
  readonly index: number;
  /** First sample of the chunk, relative to the trimmed start. */
  readonly startSample: number;
  /** Sample frames in this chunk; only the final chunk may be short. */
  readonly frames: number;
  /** Largest absolute sample in the chunk, normalised to 0…1. */
  readonly peak: number;
}

export interface AudioLevels {
  /** Largest absolute sample over the whole asset, normalised to 0…1. */
  readonly peak: number;
  /** Root-mean-square over every sample of every channel, normalised to 0…1. */
  readonly rms: number;
  /** `rms` as dBFS, rounded to 2 dp; `null` for digital silence. */
  readonly rmsDbfs: number | null;
  /** `IMPL-090-R031`'s null gate: true when the asset is silent or below −60 dBFS. */
  readonly belowNullGate: boolean;
  /** True when every sample of every channel is exactly zero. */
  readonly silent: boolean;
}

export interface AudioTrim {
  /** Samples removed from the head (encoder latency / `SeekSamples`). */
  readonly lead: number;
  /** Samples removed from the tail (decoder padding). */
  readonly tail: number;
}

export interface AudioLoop {
  readonly start: number;
  readonly end: number;
}

export interface MeasureAudioOptions {
  readonly channels: readonly Int16Array[];
  readonly sampleRate?: number;
  readonly chunkSeconds?: number;
  /** Trim applied *before* measuring, chunking and loop rebasing (`IMPL-090-R032`). */
  readonly trim?: AudioTrim;
  /** Loop points in untrimmed samples; rebased onto the trimmed timeline. */
  readonly loop?: AudioLoop | null;
}

export interface MeasuredAudio {
  readonly sampleRate: number;
  /** Frames after trimming — the duration every other field is expressed against. */
  readonly durationSamples: number;
  readonly chunks: readonly AudioChunk[];
  readonly levels: AudioLevels;
  readonly trim: AudioTrim;
  /** Loop rebased onto the trimmed timeline, clamped to it; `null` when none survives. */
  readonly loop: AudioLoop | null;
  /** True when a non-empty authored loop was clamped or dropped by the trim. */
  readonly loopClamped: boolean;
}

/** −60 dBFS as a linear amplitude ratio. `IMPL-090-R031`'s null-RMS gate. */
const NULL_GATE_LINEAR = 10 ** (-60 / 20);

/** Full scale for the *negative* rail; `Int16Array` is asymmetric and 32768 is the real maximum. */
const FULL_SCALE = 32_768;

function round(value: number, places: number): number {
  const scale = 10 ** places;
  // `Math.round` is half-up and asymmetric about zero; these values are non-negative, so that is
  // not a hazard here, but the explicit scale keeps the result independent of printf formatting.
  return Math.round(value * scale) / scale;
}

function sliceChannels(channels: readonly Int16Array[], start: number, end: number): readonly Int16Array[] {
  return channels.map((channel) => channel.subarray(start, end));
}

function peakOf(channels: readonly Int16Array[]): number {
  let peak = 0;
  for (const channel of channels) {
    for (const sample of channel) {
      const magnitude = sample < 0 ? -sample : sample;
      if (magnitude > peak) peak = magnitude;
    }
  }
  return peak / FULL_SCALE;
}

/**
 * Peak, RMS, chunk table and trimmed loop points for one canonical PCM asset.
 *
 * The trim is applied first and everything downstream is expressed against the trimmed timeline:
 * `IMPL-090-R032` requires `trim.lead` to be removed *before* loop points are computed, because a
 * loop point measured against the untrimmed stream lands `lead` samples late and clicks.
 */
export function measureAudio(options: MeasureAudioOptions): MeasuredAudio {
  const sampleRate = options.sampleRate ?? CANONICAL_SAMPLE_RATE;
  const chunkSeconds = options.chunkSeconds ?? CHUNK_SECONDS;
  if (!Number.isSafeInteger(sampleRate) || sampleRate < 1) {
    throw new RangeError(`invalid sample rate ${sampleRate}`);
  }
  if (!Number.isSafeInteger(chunkSeconds) || chunkSeconds < 1) {
    throw new RangeError(`invalid chunk length ${chunkSeconds}s`);
  }
  if (options.channels.length < 1 || options.channels.length > 2) {
    throw new RangeError(`invalid channel count ${options.channels.length}`);
  }
  const rawCount = options.channels[0]?.length ?? 0;
  if (options.channels.some((channel) => channel.length !== rawCount)) {
    throw new RangeError('PCM channel planes have different sample counts');
  }

  const requestedLead = options.trim?.lead ?? 0;
  const requestedTail = options.trim?.tail ?? 0;
  if (
    requestedLead < 0 ||
    requestedTail < 0 ||
    !Number.isSafeInteger(requestedLead) ||
    !Number.isSafeInteger(requestedTail)
  ) {
    throw new RangeError(`invalid trim {lead: ${requestedLead}, tail: ${requestedTail}}`);
  }
  // A trim wider than the asset leaves nothing; clamp rather than produce a negative duration.
  const lead = Math.min(requestedLead, rawCount);
  const tail = Math.min(requestedTail, rawCount - lead);
  const durationSamples = rawCount - lead - tail;
  const trimmed = sliceChannels(options.channels, lead, lead + durationSamples);

  let squareSum = 0;
  let sampleTotal = 0;
  for (const channel of trimmed) {
    for (const sample of channel) squareSum += sample * sample;
    sampleTotal += channel.length;
  }
  const peak = peakOf(trimmed);
  const rmsRaw = sampleTotal === 0 ? 0 : Math.sqrt(squareSum / sampleTotal) / FULL_SCALE;
  const silent = squareSum === 0;

  const chunkFrames = sampleRate * chunkSeconds;
  const chunks: AudioChunk[] = [];
  for (let start = 0, index = 0; start < durationSamples; start += chunkFrames, index += 1) {
    const frames = Math.min(chunkFrames, durationSamples - start);
    chunks.push({ index, startSample: start, frames, peak: peakOf(sliceChannels(trimmed, start, start + frames)) });
  }

  let loop: AudioLoop | null = null;
  let loopClamped = false;
  if (options.loop) {
    // Rebase onto the trimmed timeline, then clamp. A loop entirely inside the removed lead or
    // tail does not survive; reporting that is better than emitting an inverted range.
    const start = Math.min(Math.max(options.loop.start - lead, 0), durationSamples);
    const end = Math.min(Math.max(options.loop.end - lead, 0), durationSamples);
    loopClamped = start !== options.loop.start - lead || end !== options.loop.end - lead;
    loop = end > start ? { start, end } : null;
    if (loop === null && options.loop.end > options.loop.start) loopClamped = true;
  }

  return {
    sampleRate,
    durationSamples,
    chunks,
    levels: {
      peak: round(peak, 6),
      rms: round(rmsRaw, 6),
      rmsDbfs: rmsRaw === 0 ? null : round(20 * Math.log10(rmsRaw), 2),
      belowNullGate: rmsRaw <= NULL_GATE_LINEAR,
      silent,
    },
    trim: { lead, tail },
    loop,
    loopClamped,
  };
}
