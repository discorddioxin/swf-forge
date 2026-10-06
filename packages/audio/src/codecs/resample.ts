/** Deterministic integer-rational PCM16 resampling for build-time sound previews. */

export interface ResamplePcm16Options {
  readonly channels: readonly Int16Array[];
  readonly inputRate: number;
  readonly outputRate: number;
}

export interface ResampledPcm16 {
  readonly channels: readonly Int16Array[];
  readonly sampleRate: number;
  readonly sampleCount: number;
}

const MAX_SAMPLE_COUNT = 10_000_000;

function roundedDivide(numerator: number, denominator: number): number {
  return numerator < 0
    ? -Math.floor((-numerator + Math.floor(denominator / 2)) / denominator)
    : Math.floor((numerator + Math.floor(denominator / 2)) / denominator);
}

/**
 * Linearly interpolates with integer rational weights. No floating-point phase accumulator or host
 * codec is involved, so identical input planes and rates produce identical PCM16 bytes.
 */
export function resamplePcm16(options: ResamplePcm16Options): ResampledPcm16 {
  const { channels, inputRate, outputRate } = options;
  if (!Number.isSafeInteger(inputRate) || inputRate < 1 || inputRate > 384_000) {
    throw new RangeError(`invalid input sample rate ${inputRate}`);
  }
  if (!Number.isSafeInteger(outputRate) || outputRate < 1 || outputRate > 384_000) {
    throw new RangeError(`invalid output sample rate ${outputRate}`);
  }
  if (channels.length < 1 || channels.length > 2) {
    throw new RangeError(`invalid PCM channel count ${channels.length}`);
  }
  const inputCount = channels[0]?.length ?? 0;
  if (channels.some((channel) => channel.length !== inputCount)) {
    throw new RangeError('PCM channel planes have different sample counts');
  }
  const sampleCount = Math.floor((inputCount * outputRate + Math.floor(inputRate / 2)) / inputRate);
  if (!Number.isSafeInteger(sampleCount) || sampleCount > MAX_SAMPLE_COUNT) {
    throw new RangeError(`resampled sample count ${sampleCount} exceeds limit ${MAX_SAMPLE_COUNT}`);
  }
  if (inputCount === 0) {
    return { channels: channels.map(() => new Int16Array()), sampleRate: outputRate, sampleCount: 0 };
  }
  if (inputRate === outputRate) {
    return { channels: channels.map((channel) => channel.slice()), sampleRate: outputRate, sampleCount };
  }

  const result = channels.map(() => new Int16Array(sampleCount));
  for (let outputIndex = 0; outputIndex < sampleCount; outputIndex += 1) {
    const sourcePosition = outputIndex * inputRate;
    const sourceIndex = Math.min(inputCount - 1, Math.floor(sourcePosition / outputRate));
    const remainder = sourceIndex === inputCount - 1 ? 0 : sourcePosition % outputRate;
    const nextIndex = Math.min(inputCount - 1, sourceIndex + 1);
    for (let channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
      const source = channels[channelIndex];
      const target = result[channelIndex];
      if (!source || !target) continue;
      const first = source[sourceIndex] ?? 0;
      const second = source[nextIndex] ?? first;
      const numerator = first * (outputRate - remainder) + second * remainder;
      target[outputIndex] = Math.max(-32768, Math.min(32767, roundedDivide(numerator, outputRate)));
    }
  }
  return { channels: result, sampleRate: outputRate, sampleCount };
}
