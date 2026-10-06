/** Deterministic PCM16 WAV writer for build-time short-SFX previews and codec fallback assets. */

export interface EncodePcm16WavOptions {
  readonly channels: readonly Int16Array[];
  readonly sampleRate: number;
}

function ascii(bytes: Uint8Array, offset: number, value: string): void {
  for (let i = 0; i < value.length; i += 1) bytes[offset + i] = value.charCodeAt(i);
}

export function encodePcm16Wav(options: EncodePcm16WavOptions): Uint8Array {
  const channelCount = options.channels.length;
  const sampleCount = options.channels[0]?.length ?? 0;
  if (channelCount !== 1 && channelCount !== 2)
    throw new RangeError(`WAV channel count must be 1 or 2, got ${channelCount}`);
  if (!Number.isInteger(options.sampleRate) || options.sampleRate <= 0 || options.sampleRate > 384000) {
    throw new RangeError(`invalid WAV sample rate ${options.sampleRate}`);
  }
  if (options.channels.some((channel) => channel.length !== sampleCount)) {
    throw new RangeError('WAV channel planes must have equal sample counts');
  }
  const dataLength = sampleCount * channelCount * 2;
  if (!Number.isSafeInteger(dataLength) || dataLength > 0xffffffff - 36)
    throw new RangeError('WAV payload exceeds RIFF size limit');

  const bytes = new Uint8Array(44 + dataLength);
  const view = new DataView(bytes.buffer);
  ascii(bytes, 0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  ascii(bytes, 8, 'WAVE');
  ascii(bytes, 12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channelCount, true);
  view.setUint32(24, options.sampleRate, true);
  view.setUint32(28, options.sampleRate * channelCount * 2, true);
  view.setUint16(32, channelCount * 2, true);
  view.setUint16(34, 16, true);
  ascii(bytes, 36, 'data');
  view.setUint32(40, dataLength, true);
  let offset = 44;
  for (let frame = 0; frame < sampleCount; frame += 1) {
    for (const channel of options.channels) {
      view.setInt16(offset, channel[frame] ?? 0, true);
      offset += 2;
    }
  }
  return bytes;
}

export function silentPcm(sampleCount: number, channels: 1 | 2): readonly Int16Array[] {
  if (!Number.isSafeInteger(sampleCount) || sampleCount < 0 || sampleCount > 10_000_000) {
    throw new RangeError(`invalid silent PCM sampleCount ${sampleCount}`);
  }
  return Array.from({ length: channels }, () => new Int16Array(sampleCount));
}
