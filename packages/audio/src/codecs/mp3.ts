/** Runtime-neutral MP3 frame header parser and SWF MP3SOUNDDATA view; frame bytes are never rewritten. */

export interface Mp3FrameHeader {
  readonly offset: number;
  readonly length: number;
  readonly version: 'mpeg1' | 'mpeg2' | 'mpeg2.5';
  readonly sampleRate: number;
  readonly bitrateKbps: number;
  readonly channelMode: 0 | 1 | 2 | 3;
  readonly sampleCount: 1152 | 576;
}

export interface Mp3FrameParseResult {
  readonly frames: readonly Mp3FrameHeader[];
  readonly valid: boolean;
  readonly consumedBytes: number;
  readonly errorOffset: number | null;
  readonly reason: string | null;
  /** Sum of samples per channel across complete frames. */
  readonly sampleCount: number;
  /** Number of adjacent frames whose version/rate/bitrate/channel mode changes. */
  readonly parameterChanges: number;
}

export interface SwfMp3EventData extends Mp3FrameParseResult {
  readonly seekSamples: number;
  /** Byte-for-byte view of MP3 frames after the SWF SI16 SeekSamples prefix. */
  readonly frameBytes: Uint8Array;
}

const MPEG1_LAYER3_KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320, 0] as const;
const MPEG2_LAYER3_KBPS = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160, 0] as const;

function parseHeader(bytes: Uint8Array, offset: number): Omit<Mp3FrameHeader, 'offset'> | { reason: string } | null {
  if (offset + 4 > bytes.length) return { reason: 'truncated MPEG header' };
  const b0 = bytes[offset] ?? 0;
  const b1 = bytes[offset + 1] ?? 0;
  const b2 = bytes[offset + 2] ?? 0;
  const b3 = bytes[offset + 3] ?? 0;
  const word = (b0 * 0x1000000 + (b1 << 16) + (b2 << 8) + b3) >>> 0;
  if ((word & 0xffe00000) >>> 0 !== 0xffe00000) return { reason: 'MPEG frame sync missing' };

  const versionCode = (word >>> 19) & 0x3;
  const layerCode = (word >>> 17) & 0x3;
  const bitrateIndex = (word >>> 12) & 0xf;
  const sampleRateIndex = (word >>> 10) & 0x3;
  const padding = (word >>> 9) & 1;
  const channelMode = ((word >>> 6) & 0x3) as 0 | 1 | 2 | 3;
  if (versionCode === 1) return { reason: 'reserved MPEG version' };
  if (layerCode !== 1) return { reason: 'SWF MP3 payload is not Layer III' };
  if (bitrateIndex === 0 || bitrateIndex === 15) return { reason: 'free or invalid MPEG bitrate index' };
  if (sampleRateIndex === 3) return { reason: 'reserved MPEG sample-rate index' };

  const version = versionCode === 3 ? 'mpeg1' : versionCode === 2 ? 'mpeg2' : 'mpeg2.5';
  const rates =
    version === 'mpeg1' ? [44100, 48000, 32000] : version === 'mpeg2' ? [22050, 24000, 16000] : [11025, 12000, 8000];
  const sampleRate = rates[sampleRateIndex];
  const table = version === 'mpeg1' ? MPEG1_LAYER3_KBPS : MPEG2_LAYER3_KBPS;
  const bitrateKbps = table[bitrateIndex];
  if (sampleRate === undefined || bitrateKbps === undefined || bitrateKbps === 0) {
    return { reason: 'invalid MPEG frame header table index' };
  }
  const coefficient = version === 'mpeg1' ? 144 : 72;
  const length = Math.floor((coefficient * bitrateKbps * 1000) / sampleRate) + padding;
  if (length < 4) return { reason: 'invalid MPEG frame length' };
  return {
    length,
    version,
    sampleRate,
    bitrateKbps,
    channelMode,
    sampleCount: version === 'mpeg1' ? 1152 : 576,
  };
}

/** Parses consecutive Layer III frames; a bad/truncated frame stops at its first byte. */
export function parseMp3Frames(bytes: Uint8Array): Mp3FrameParseResult {
  const frames: Mp3FrameHeader[] = [];
  let offset = 0;
  let sampleCount = 0;
  let parameterChanges = 0;
  const result = (valid: boolean, errorOffset: number | null, reason: string | null): Mp3FrameParseResult => ({
    frames,
    valid,
    consumedBytes: offset,
    errorOffset,
    reason,
    sampleCount,
    parameterChanges,
  });
  while (offset < bytes.length) {
    const parsed = parseHeader(bytes, offset);
    if (parsed === null || 'reason' in parsed) {
      return result(false, offset, parsed === null ? 'MPEG frame header missing' : parsed.reason);
    }
    if (parsed.length > bytes.length - offset) {
      return result(false, offset, 'truncated MPEG frame payload');
    }
    const previous = frames.at(-1);
    if (
      previous &&
      (previous.version !== parsed.version ||
        previous.sampleRate !== parsed.sampleRate ||
        previous.bitrateKbps !== parsed.bitrateKbps ||
        previous.channelMode !== parsed.channelMode)
    ) {
      parameterChanges += 1;
    }
    frames.push({ offset, ...parsed });
    sampleCount += parsed.sampleCount;
    offset += parsed.length;
  }
  return result(
    frames.length > 0,
    frames.length === 0 ? 0 : null,
    frames.length === 0 ? 'MP3 payload contains no frames' : null,
  );
}

/** Reads SWF event MP3's signed little-endian SeekSamples then returns the untouched frame-byte view. */
export function parseSwfMp3EventData(bytes: Uint8Array): SwfMp3EventData {
  if (bytes.length < 2) {
    const empty = bytes.subarray(bytes.length);
    return {
      seekSamples: 0,
      frameBytes: empty,
      frames: [],
      valid: false,
      consumedBytes: 0,
      errorOffset: 0,
      reason: 'truncated SWF MP3 SeekSamples field',
      sampleCount: 0,
      parameterChanges: 0,
    };
  }
  const rawSeek = (bytes[0] ?? 0) | ((bytes[1] ?? 0) << 8);
  const seekSamples = rawSeek >= 0x8000 ? rawSeek - 0x10000 : rawSeek;
  const frameBytes = bytes.subarray(2);
  return { ...parseMp3Frames(frameBytes), seekSamples, frameBytes };
}
