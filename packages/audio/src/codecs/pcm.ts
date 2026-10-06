/** SWF PCM formats 0/3 decoded into deterministic signed 16-bit interleaved-independent planes. */

export interface DecodeSwfPcmOptions {
  readonly format: 0 | 3;
  readonly bitsPerSample: 8 | 16;
  readonly channels: 1 | 2;
  readonly sampleCount: number;
}

export interface DecodedSwfPcm {
  readonly channels: readonly Int16Array[];
  readonly sampleCount: number;
  readonly decodedSampleCount: number;
  readonly truncated: boolean;
}

const MAX_SAMPLE_COUNT = 10_000_000;

/**
 * Decode uncompressed SWF SoundData. Format 0 16-bit samples are interpreted big-endian for
 * cross-host determinism (the documented SWF-native-endian ambiguity); format 3 is little-endian.
 * 8-bit input is signed and expanded exactly by 256.
 */
export function decodeSwfPcm(bytes: Uint8Array, options: DecodeSwfPcmOptions): DecodedSwfPcm {
  const { format, bitsPerSample, channels: channelCount, sampleCount } = options;
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 0 || sampleCount > MAX_SAMPLE_COUNT) {
    throw new RangeError(`invalid PCM sampleCount ${sampleCount} (limit ${MAX_SAMPLE_COUNT})`);
  }
  if (channelCount !== 1 && channelCount !== 2) throw new RangeError(`invalid PCM channel count ${channelCount}`);
  if (format !== 0 && format !== 3) throw new RangeError(`unsupported PCM format ${format}`);

  const planes = Array.from({ length: channelCount }, () => new Int16Array(sampleCount));
  const bytesPerSample = bitsPerSample / 8;
  const frameBytes = bytesPerSample * channelCount;
  const decodedSampleCount = Math.min(sampleCount, Math.floor(bytes.length / frameBytes));
  for (let frame = 0; frame < decodedSampleCount; frame += 1) {
    for (let channel = 0; channel < channelCount; channel += 1) {
      const offset = (frame * channelCount + channel) * bytesPerSample;
      let sample: number;
      if (bitsPerSample === 8) {
        const byte = bytes[offset] ?? 0;
        sample = (byte >= 0x80 ? byte - 0x100 : byte) * 256;
      } else {
        const low = bytes[offset] ?? 0;
        const high = bytes[offset + 1] ?? 0;
        const raw = format === 3 ? low | (high << 8) : (low << 8) | high;
        sample = raw >= 0x8000 ? raw - 0x10000 : raw;
      }
      const plane = planes[channel];
      if (plane) plane[frame] = sample;
    }
  }
  return { channels: planes, sampleCount, decodedSampleCount, truncated: decodedSampleCount < sampleCount };
}
