/** SWF-flavoured IMA ADPCM decoder (APP reference table §9, AUD-R005–R008, IMPL-090-R012–R015). */

import { SWF_ADPCM_INDEX_TABLES, SWF_ADPCM_STEP_TABLE } from './adpcm-tables.js';

export type AdpcmChannels = 1 | 2;
export type AdpcmBitDepth = 2 | 3 | 4 | 5;

export interface DecodeSwfAdpcmOptions {
  readonly channels: AdpcmChannels;
  /** Authoritative per-channel frame count from DefineSound or a stream block. */
  readonly sampleCount: number;
  /** Safety ceiling for untrusted frame counts; defaults to ten million frames per channel. */
  readonly maxSampleCount?: number;
}

export interface DecodedSwfAdpcm {
  readonly bitsPerCode: AdpcmBitDepth | null;
  /** One signed-16 array per channel, trimmed or zero-padded to `sampleCount`. */
  readonly channels: readonly Int16Array[];
  readonly sampleCount: number;
  /** Number of frames with a complete predictor/header and code payload. */
  readonly decodedSampleCount: number;
  /** True when the declared frame count requires more complete bits than the payload contains. */
  readonly truncated: boolean;
}

const MAX_SAMPLE_COUNT = 10_000_000;
const PACKET_FRAMES = 4096;
const PACKET_CODES = PACKET_FRAMES - 1;

class BitReader {
  #position = 0;

  constructor(readonly bytes: Uint8Array) {}

  get position(): number {
    return this.#position;
  }

  set position(value: number) {
    this.#position = value;
  }

  get remaining(): number {
    return this.bytes.length * 8 - this.#position;
  }

  read(width: number): number | null {
    if (width < 0 || width > 32 || this.remaining < width) return null;
    let value = 0;
    for (let i = 0; i < width; i += 1) {
      const position = this.#position + i;
      const byte = this.bytes[position >>> 3] ?? 0;
      value = value * 2 + ((byte >>> (7 - (position & 7))) & 1);
    }
    this.#position += width;
    return value;
  }
}

function signed16(value: number): number {
  return value >= 0x8000 ? value - 0x10000 : value;
}

function clamp16(value: number): number {
  return Math.max(-32768, Math.min(32767, value));
}

function clampIndex(value: number): number {
  return Math.max(0, Math.min(88, value));
}

/**
 * IMA's delta reconstruction: a base term plus one right-shifted term per set magnitude bit, each
 * truncated **independently**.
 *
 *     delta = step >> (bits - 1)
 *     for bit k in 0 .. bits - 2:  if magnitude & (1 << k):  delta += step >> (bits - 2 - k)
 *
 * This approximates `(magnitude + 0.5) * step / 2^(bits - 2)`, but it is not equal to it, and the
 * difference is not negligible: across the 89 steps and all code widths, the closed form
 * `floor(((2*magnitude + 1) * step) / 2^(bits - 1))` disagrees on **884 of 2670** (step, magnitude)
 * pairs by up to 3 LSB — and because the result feeds a recursive predictor, the error accumulates
 * rather than averaging out. Every IMA implementation, including `ruffle`'s
 * `SAMPLE_DELTA_CALCULATOR`, uses the shift form; so must we, or "bit-exact" is meaningless
 * (`F-P3-20`).
 */
function imaDelta(step: number, magnitude: number, bits: AdpcmBitDepth): number {
  let delta = step >> (bits - 1);
  for (let bit = 0; bit <= bits - 2; bit += 1) {
    if (magnitude & (1 << bit)) delta += step >> (bits - 2 - bit);
  }
  return delta;
}

function decodeCode(
  prediction: number,
  index: number,
  code: number,
  bits: AdpcmBitDepth,
): { prediction: number; index: number } {
  const signMask = 1 << (bits - 1);
  const magnitude = code & (signMask - 1);
  const step = SWF_ADPCM_STEP_TABLE[index] ?? 7;
  // The code is sign-magnitude, not two's complement: the top bit is the sign only.
  const delta = imaDelta(step, magnitude, bits);
  const nextPrediction = clamp16(prediction + (code & signMask ? -delta : delta));
  const indexDelta = SWF_ADPCM_INDEX_TABLES[bits][magnitude] ?? -1;
  return { prediction: nextPrediction, index: clampIndex(index + indexDelta) };
}

function requiredBits(sampleCount: number, channels: AdpcmChannels, bits: AdpcmBitDepth): number {
  if (sampleCount === 0) return 2;
  const packetCount = Math.ceil(sampleCount / PACKET_FRAMES);
  const codedFrames = sampleCount - packetCount;
  return 2 + packetCount * 22 * channels + codedFrames * bits * channels;
}

/**
 * Decode the SWF ADPCM bitstream into signed 16-bit PCM. The 2-bit code-size field and packet headers
 * are MSB-first; stereo codes are interleaved L/R, and each packet resets both predictors.
 *
 * `sampleCount` is authoritative. A truncated packet yields its complete decoded prefix and the
 * pre-zeroed remainder, allowing the caller to emit `SF0304`/`SF0328` without fabricating samples.
 */
export function decodeSwfAdpcm(bytes: Uint8Array, options: DecodeSwfAdpcmOptions): DecodedSwfAdpcm {
  const { channels: channelCount, sampleCount } = options;
  const maxSampleCount = options.maxSampleCount ?? MAX_SAMPLE_COUNT;
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 0 || sampleCount > maxSampleCount) {
    throw new RangeError(`invalid ADPCM sampleCount ${sampleCount} (limit ${maxSampleCount})`);
  }
  if (channelCount !== 1 && channelCount !== 2) throw new RangeError(`invalid ADPCM channel count ${channelCount}`);

  const output = Array.from({ length: channelCount }, () => new Int16Array(sampleCount));
  const reader = new BitReader(bytes);
  const codeSize = reader.read(2);
  if (codeSize === null) {
    return { bitsPerCode: null, channels: output, sampleCount, decodedSampleCount: 0, truncated: sampleCount > 0 };
  }
  const bits = (codeSize + 2) as AdpcmBitDepth;
  const truncatedByLength = reader.remaining + 2 < requiredBits(sampleCount, channelCount, bits);
  let decodedSampleCount = 0;
  let truncated = truncatedByLength;

  while (decodedSampleCount < sampleCount) {
    const headerBits = 22 * channelCount;
    if (reader.remaining < headerBits) {
      truncated = true;
      break;
    }
    const predictions: number[] = [];
    const indices: number[] = [];
    let validHeader = true;
    for (let channel = 0; channel < channelCount; channel += 1) {
      const sample = reader.read(16);
      const index = reader.read(6);
      if (sample === null || index === null) {
        validHeader = false;
        break;
      }
      predictions.push(signed16(sample));
      indices.push(index);
    }
    if (!validHeader) {
      truncated = true;
      break;
    }

    for (let channel = 0; channel < channelCount; channel += 1) {
      const plane = output[channel];
      if (plane) plane[decodedSampleCount] = predictions[channel] ?? 0;
    }
    const framesInPacket = Math.min(PACKET_FRAMES, sampleCount - decodedSampleCount);
    let framesDecoded = 1;
    while (framesDecoded < framesInPacket && framesDecoded <= PACKET_CODES) {
      const frameStart = reader.position;
      const codes: number[] = [];
      let complete = true;
      for (let channel = 0; channel < channelCount; channel += 1) {
        const code = reader.read(bits);
        if (code === null) {
          complete = false;
          break;
        }
        codes.push(code);
      }
      if (!complete) {
        reader.position = frameStart;
        truncated = true;
        break;
      }
      for (let channel = 0; channel < channelCount; channel += 1) {
        const decoded = decodeCode(predictions[channel] ?? 0, indices[channel] ?? 0, codes[channel] ?? 0, bits);
        predictions[channel] = decoded.prediction;
        indices[channel] = decoded.index;
        const plane = output[channel];
        if (plane) plane[decodedSampleCount + framesDecoded] = decoded.prediction;
      }
      framesDecoded += 1;
    }
    decodedSampleCount += framesDecoded;
    if (framesDecoded < framesInPacket) break;
  }

  return {
    bitsPerCode: bits,
    channels: output,
    sampleCount,
    decodedSampleCount,
    truncated,
  };
}
