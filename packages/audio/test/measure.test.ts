/**
 * T-AUD-111/112 — WP-090-11: 10 s chunk boundaries, loop points that survive trimming, and
 * peak/RMS metadata on fixtures with known amplitude (`IMPL-090-R030`–`R033`).
 */

import { describe, expect, it } from 'vitest';

import { CANONICAL_SAMPLE_RATE, CHUNK_SECONDS, measureAudio } from '../src/codecs/measure.js';

const CHUNK_FRAMES = CANONICAL_SAMPLE_RATE * CHUNK_SECONDS;

function constant(value: number, count: number): Int16Array {
  return Int16Array.from({ length: count }, () => value);
}

/** A ±amplitude square wave, so peak and RMS are both exactly `amplitude / 32768`. */
function square(amplitude: number, count: number): Int16Array {
  return Int16Array.from({ length: count }, (_unused, index) => (index % 2 === 0 ? amplitude : -amplitude));
}

describe('T-AUD-112 peak and RMS on known amplitudes', () => {
  it('reports full scale for a square wave at the negative rail', () => {
    const { levels } = measureAudio({ channels: [square(32768 - 1, 64)] });

    expect(levels.peak).toBeCloseTo(32767 / 32768, 6);
    expect(levels.rms).toBeCloseTo(32767 / 32768, 6);
    expect(levels.silent).toBe(false);
    expect(levels.belowNullGate).toBe(false);
  });

  it('reports exactly −6.02 dBFS for a half-scale square wave', () => {
    // A square wave has |sample| constant, so RMS == peak; halving the amplitude is −6.02 dB.
    const { levels } = measureAudio({ channels: [square(16384, 128)] });

    expect(levels.peak).toBe(0.5);
    expect(levels.rms).toBe(0.5);
    expect(levels.rmsDbfs).toBe(-6.02);
  });

  it('separates peak from RMS when the signal is mostly quiet', () => {
    // One full-scale sample in 100: peak = 1, RMS = sqrt(1/100) = 0.1.
    const channel = new Int16Array(100);
    channel[7] = 32768 - 1;
    const { levels } = measureAudio({ channels: [channel] });

    expect(levels.peak).toBeCloseTo(1, 4);
    expect(levels.rms).toBeCloseTo(0.1, 4);
  });

  it('averages RMS across both channels rather than taking the louder one', () => {
    const loudLeftOnly = measureAudio({ channels: [square(32767, 64), new Int16Array(64)] });

    expect(loudLeftOnly.levels.peak).toBeCloseTo(1, 4);
    // Half the samples are zero, so RMS is 1/sqrt(2) of the peak, not equal to it.
    expect(loudLeftOnly.levels.rms).toBeCloseTo(Math.SQRT1_2, 4);
  });

  it('flags digital silence and trips the −60 dBFS null gate', () => {
    const { levels } = measureAudio({ channels: [new Int16Array(4800)] });

    expect(levels).toMatchObject({ peak: 0, rms: 0, rmsDbfs: null, silent: true, belowNullGate: true });
  });

  it('trips the null gate for audible-but-negligible content that is not silent', () => {
    // 20 LSB is about −64 dBFS: not zero, so `silent` stays false, but below the gate.
    const { levels } = measureAudio({ channels: [square(20, 64)] });

    expect(levels.silent).toBe(false);
    expect(levels.belowNullGate).toBe(true);
    expect(levels.rmsDbfs).toBeLessThan(-60);
  });

  it('is identical across runs for identical input', () => {
    const channels = [square(12345, 999)];

    expect(measureAudio({ channels })).toEqual(measureAudio({ channels }));
  });
});

describe('T-AUD-111 chunking at exact 10 s boundaries', () => {
  it('splits exactly on the sample boundary, with only the last chunk short', () => {
    const count = CHUNK_FRAMES * 2 + 5;
    const { chunks, durationSamples } = measureAudio({ channels: [new Int16Array(count)] });

    expect(durationSamples).toBe(count);
    expect(chunks.map((chunk) => [chunk.startSample, chunk.frames])).toEqual([
      [0, CHUNK_FRAMES],
      [CHUNK_FRAMES, CHUNK_FRAMES],
      [CHUNK_FRAMES * 2, 5],
    ]);
  });

  it('produces one exact chunk when the asset is exactly 10 s, not an empty trailing chunk', () => {
    const { chunks } = measureAudio({ channels: [new Int16Array(CHUNK_FRAMES)] });

    expect(chunks).toHaveLength(1);
    expect(chunks[0]).toMatchObject({ index: 0, startSample: 0, frames: CHUNK_FRAMES });
  });

  it('emits no chunks for an empty asset', () => {
    expect(measureAudio({ channels: [new Int16Array()] })).toMatchObject({ chunks: [], durationSamples: 0 });
  });

  it('gives each chunk its own peak so a loud chunk is not hidden by a quiet neighbour', () => {
    const channel = new Int16Array(CHUNK_FRAMES * 2);
    channel.set(square(32767, 16), CHUNK_FRAMES); // loud content only in the second chunk
    const { chunks, levels } = measureAudio({ channels: [channel] });

    expect(chunks[0]?.peak).toBe(0);
    expect(chunks[1]?.peak).toBeCloseTo(1, 4);
    expect(levels.peak).toBeCloseTo(1, 4);
  });

  it('chunks the trimmed timeline, not the authored one', () => {
    // 10 s + 100 frames of audio with a 100-frame lead trim is exactly one chunk, not two.
    const { chunks, durationSamples } = measureAudio({
      channels: [new Int16Array(CHUNK_FRAMES + 100)],
      trim: { lead: 100, tail: 0 },
    });

    expect(durationSamples).toBe(CHUNK_FRAMES);
    expect(chunks).toHaveLength(1);
  });
});

describe('T-AUD-111 loop points survive trimming', () => {
  it('rebases loop points onto the trimmed start (IMPL-090-R032)', () => {
    // The authored loop is at 5000..9000; removing a 1200-sample encoder delay moves it to
    // 3800..7800. Leaving it at 5000 would start the loop 1200 samples late and click.
    const result = measureAudio({
      channels: [new Int16Array(20_000)],
      trim: { lead: 1200, tail: 300 },
      loop: { start: 5000, end: 9000 },
    });

    expect(result.loop).toEqual({ start: 3800, end: 7800 });
    expect(result.loopClamped).toBe(false);
    expect(result.durationSamples).toBe(20_000 - 1200 - 300);
  });

  it('clamps a loop that extends into the trimmed tail and says so', () => {
    const result = measureAudio({
      channels: [new Int16Array(10_000)],
      trim: { lead: 0, tail: 2000 },
      loop: { start: 100, end: 9500 },
    });

    expect(result.loop).toEqual({ start: 100, end: 8000 });
    expect(result.loopClamped).toBe(true);
  });

  it('drops a loop that the trim removes entirely, rather than inverting it', () => {
    const result = measureAudio({
      channels: [new Int16Array(10_000)],
      trim: { lead: 6000, tail: 0 },
      loop: { start: 1000, end: 2000 },
    });

    expect(result.loop).toBeNull();
    expect(result.loopClamped).toBe(true);
  });

  it('keeps loop null and unflagged when none was authored', () => {
    const result = measureAudio({ channels: [new Int16Array(1000)], trim: { lead: 10, tail: 10 } });

    expect(result.loop).toBeNull();
    expect(result.loopClamped).toBe(false);
  });

  it('measures levels after the trim, so trimmed-away content does not count', () => {
    const channel = new Int16Array(200);
    channel.set(square(32767, 100), 0); // loud lead-in that the trim removes
    const trimmed = measureAudio({ channels: [channel], trim: { lead: 100, tail: 0 } });

    expect(trimmed.levels.peak).toBe(0);
    expect(trimmed.levels.silent).toBe(true);
    expect(measureAudio({ channels: [channel] }).levels.peak).toBeCloseTo(1, 4);
  });

  it('clamps a trim wider than the asset instead of reporting a negative duration', () => {
    const result = measureAudio({ channels: [constant(1000, 50)], trim: { lead: 80, tail: 80 } });

    expect(result).toMatchObject({ durationSamples: 0, chunks: [] });
    expect(result.trim).toEqual({ lead: 50, tail: 0 });
  });
});
