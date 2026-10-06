/** T-AUD-103–105: PCM byte order, exact WAV fields, and MP3 pass-through framing. */

import { describe, expect, it } from 'vitest';

import { decodeSwfPcm } from '../src/codecs/pcm.js';
import { parseMp3Frames, parseSwfMp3EventData } from '../src/codecs/mp3.js';
import { resamplePcm16 } from '../src/codecs/resample.js';
import { encodePcm16Wav } from '../src/codecs/wav.js';

function frame(header: readonly number[], length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes.set(header);
  for (let i = 4; i < bytes.length; i += 1) bytes[i] = (i * 31) & 0xff;
  return bytes;
}

describe('SWF event audio codecs', () => {
  it('T-AUD-103: expands signed 8-bit samples and deinterleaves stereo frames exactly', () => {
    const mono = decodeSwfPcm(Uint8Array.from([0x80, 0x00, 0x7f]), {
      format: 3,
      bitsPerSample: 8,
      channels: 1,
      sampleCount: 3,
    });
    expect(Array.from(mono.channels[0] ?? [])).toEqual([-32768, 0, 32512]);

    const stereo = decodeSwfPcm(Uint8Array.from([0x80, 0x7f, 0x00, 0xff]), {
      format: 3,
      bitsPerSample: 8,
      channels: 2,
      sampleCount: 2,
    });
    expect(stereo.channels.map((channel) => Array.from(channel))).toEqual([
      [-32768, 0],
      [32512, -256],
    ]);
  });

  it('T-AUD-103: reads format 0 as deterministic big-endian and format 3 as little-endian', () => {
    const options = { bitsPerSample: 16 as const, channels: 1 as const, sampleCount: 2 };
    const bigEndian = decodeSwfPcm(Uint8Array.from([0x12, 0x34, 0x80, 0x00]), { ...options, format: 0 });
    const littleEndian = decodeSwfPcm(Uint8Array.from([0x34, 0x12, 0x00, 0x80]), { ...options, format: 3 });
    expect(Array.from(bigEndian.channels[0] ?? [])).toEqual([0x1234, -32768]);
    expect(Array.from(littleEndian.channels[0] ?? [])).toEqual([0x1234, -32768]);
  });

  it('T-AUD-104/105: parses Layer III header fields and preserves event frame bytes unchanged', () => {
    // MPEG1 Layer III, 128 kbps, 44.1 kHz, one padding slot, mono: 418 bytes total.
    const sourceFrame = frame([0xff, 0xfb, 0x92, 0xc0], 418);
    const parsed = parseMp3Frames(sourceFrame);
    expect(parsed).toMatchObject({ valid: true, consumedBytes: 418, errorOffset: null, reason: null });
    expect(parsed.frames).toEqual([
      {
        offset: 0,
        length: 418,
        version: 'mpeg1',
        sampleRate: 44100,
        bitrateKbps: 128,
        channelMode: 3,
        sampleCount: 1152,
      },
    ]);

    const event = new Uint8Array(sourceFrame.length + 2);
    event.set([0xfd, 0xff]); // SI16 SeekSamples = -3
    event.set(sourceFrame, 2);
    const decoded = parseSwfMp3EventData(event);
    expect(decoded.seekSamples).toBe(-3);
    expect(decoded.valid).toBe(true);
    expect(decoded.frameBytes).toEqual(sourceFrame);
  });

  it('T-AUD-109: records MP3 parameter changes without rewriting pass-through frames', () => {
    const first = frame([0xff, 0xfb, 0x92, 0xc0], 418); // MPEG1, 44.1 kHz
    const second = frame([0xff, 0xfb, 0x96, 0xc0], 385); // MPEG1, 48 kHz
    const payload = new Uint8Array(first.length + second.length);
    payload.set(first);
    payload.set(second, first.length);
    const parsed = parseMp3Frames(payload);
    expect(parsed.valid).toBe(true);
    expect(parsed.sampleCount).toBe(2304);
    expect(parsed.parameterChanges).toBe(1);
    expect(parsed.frames.map((item) => item.sampleRate)).toEqual([44100, 48000]);
  });

  it('T-AUD-104: stops safely when an MP3 frame payload is truncated', () => {
    const result = parseMp3Frames(frame([0xff, 0xfb, 0x92, 0xc0], 417));
    expect(result.valid).toBe(false);
    expect(result.frames).toEqual([]);
    expect(result.errorOffset).toBe(0);
    expect(result.reason).toBe('truncated MPEG frame payload');
  });

  it('T-AUD-110: resamples PCM with deterministic integer-rational interpolation', () => {
    const input = [Int16Array.from([0, 12000, -12000]), Int16Array.from([-32768, 0, 32767])];
    const first = resamplePcm16({ channels: input, inputRate: 24000, outputRate: 48000 });
    const second = resamplePcm16({ channels: input, inputRate: 24000, outputRate: 48000 });
    expect(first.sampleRate).toBe(48000);
    expect(first.sampleCount).toBe(6);
    expect(first.channels.map((channel) => Array.from(channel))).toEqual([
      [0, 6000, 12000, 0, -12000, -12000],
      [-32768, -16384, 0, 16384, 32767, 32767],
    ]);
    expect(second.channels).toEqual(first.channels);
  });

  it('writes stable PCM16 WAV bytes with correct little-endian RIFF metadata', () => {
    const bytes = encodePcm16Wav({
      sampleRate: 22050,
      channels: [Int16Array.from([-32768, 0, 32767]), Int16Array.from([0x1234, -1, 0])],
    });
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    expect(String.fromCharCode(...bytes.subarray(0, 4))).toBe('RIFF');
    expect(view.getUint32(4, true)).toBe(bytes.length - 8);
    expect(String.fromCharCode(...bytes.subarray(8, 12))).toBe('WAVE');
    expect(view.getUint16(22, true)).toBe(2);
    expect(view.getUint32(24, true)).toBe(22050);
    expect(view.getUint16(34, true)).toBe(16);
    expect(Array.from(bytes.subarray(44))).toEqual([
      0x00, 0x80, 0x34, 0x12, 0x00, 0x00, 0xff, 0xff, 0xff, 0x7f, 0x00, 0x00,
    ]);
    expect(
      encodePcm16Wav({
        sampleRate: 22050,
        channels: [Int16Array.from([-32768, 0, 32767]), Int16Array.from([0x1234, -1, 0])],
      }),
    ).toEqual(bytes);
  });
});
