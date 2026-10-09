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
 * Decode uncompressed SWF SoundData.
 *
 * **8-bit samples are unsigned** (0…255, 0x80 = silence), as in WAV and as `ruffle`'s `PcmDecoder`
 * reads them; they expand to `(byte - 128) * 256`. Reading them as two's complement — which this
 * decoder used to do — maps silence (0x80) to full-scale negative and inverts the waveform
 * (`F-P3-22`).
 *
 * We expand by 256 rather than `ruffle`'s `(byte - 127) * 128`, which spans only
 * [-16256, +16384] — half scale, 6 dB down. 256 is the standard full-scale expansion (ffmpeg,
 * sox) and matters here because these samples are written straight into a WAV preview.
 *
 * **Format 0 16-bit is read little-endian**, like format 3. The format is nominally
 * "native-endian", which is not a decodable instruction; `REPO-R013` requires us to fix one order,
 * and little-endian is the one every real file was almost certainly authored in and the one
 * `ruffle` assumes outright ("Cross fingers that it's little endian"). `SF0302` records the
 * assumption. See errata `E-030`.
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
        sample = ((bytes[offset] ?? 0) - 128) * 256;
      } else {
        const raw = (bytes[offset] ?? 0) | ((bytes[offset + 1] ?? 0) << 8);
        sample = raw >= 0x8000 ? raw - 0x10000 : raw;
      }
      const plane = planes[channel];
      if (plane) plane[frame] = sample;
    }
  }
  return { channels: planes, sampleCount, decodedSampleCount, truncated: decodedSampleCount < sampleCount };
}
