/**
 * `T-AUD-105` (MP3 pass-through: bytes unchanged, hash equality, trim metadata surfaced) and the
 * manifest half of `T-AUD-111`/`T-AUD-112` (chunk table, peak/RMS) — `IMPL-090-R008`, `R030`-`R032`.
 *
 * The existing bundle test checks that `sound-3.mp3` equals the authored frame. These cover what
 * that one cannot: that the *recorded digest* is the digest of the original bytes rather than of
 * something the writer produced, that `SeekSamples` is reported and never applied to the payload,
 * and that PCM-backed WAV assets carry levels and a chunk table (MP3 records its pass-through limitation).
 */

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { EXIT, runCli, type CliIo } from '@swf-forge/decompiler';
import { Tag } from '@swf-forge/swf';
import { buildSwf, concat, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

const WORK = mkdtempSync(join(tmpdir(), 'swf-forge-audio-'));
afterAll(() => rmSync(WORK, { recursive: true, force: true }));

interface ManifestAsset {
  readonly characterId: number;
  readonly path: string | null;
  readonly sha256: string | null;
  readonly status: string;
  readonly metadata?: Record<string, number | string | boolean>;
  readonly audio?: {
    readonly durationSamples: number;
    readonly peak: number;
    readonly rms: number;
    readonly rmsDbfs: number | null;
    readonly silent: boolean;
    readonly belowNullGate: boolean;
    readonly chunks: readonly { startSample: number; frames: number; peak: number }[];
  };
}

function capture(): CliIo {
  return { out: () => undefined, err: () => undefined };
}

function u32(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function soundBody(id: number, format: number, rateCode: number, sampleCount: number, data: Uint8Array): Uint8Array {
  const flags = (format << 4) | (rateCode << 2) | 2; // 16-bit, mono
  return concat(Uint8Array.from([id & 0xff, (id >>> 8) & 0xff, flags]), u32(sampleCount), data);
}

/** MPEG1 Layer III, 128 kbps, 44.1 kHz, padded: 418 bytes, with non-trivial payload. */
function mp3Frame(seed: number): Uint8Array {
  const bytes = new Uint8Array(418);
  bytes.set([0xff, 0xfb, 0x92, 0xc0]);
  for (let i = 4; i < bytes.length; i += 1) bytes[i] = (i * seed) & 0xff;
  return bytes;
}

/** MPEG1 Layer III, 128 kbps, 48 kHz: 385 bytes — a parameter change relative to `mp3Frame`. */
function mp3FrameAt48k(): Uint8Array {
  const bytes = new Uint8Array(385);
  bytes.set([0xff, 0xfb, 0x96, 0xc0]);
  for (let i = 4; i < bytes.length; i += 1) bytes[i] = (i * 23) & 0xff;
  return bytes;
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function runDump(name: string, swf: Uint8Array): { dir: string; assets: readonly ManifestAsset[] } {
  const source = join(WORK, `${name}.swf`);
  writeFileSync(source, swf);
  const dir = join(WORK, `${name}-out`);
  expect(runCli(['assets', 'dump', source, '--out', dir], capture())).toBe(EXIT.ok);
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as { assets: ManifestAsset[] };
  return { dir, assets: manifest.assets };
}

describe('T-AUD-105 MP3 pass-through', () => {
  const frames = concat(mp3Frame(17), mp3FrameAt48k());
  const payload = concat(Uint8Array.from([0xfd, 0xff]), frames); // SeekSamples = -3
  const swf = buildSwf({
    version: 10,
    body: concat(tag(Tag.DefineSound, soundBody(3, 2, 3, 2304, payload)), showFrames(1), endTag()),
    frameCount: 1,
  });

  it('writes the authored frames byte-for-byte, dropping only the SeekSamples prefix', () => {
    const { dir } = runDump('mp3-pass', swf);

    expect(readFileSync(join(dir, 'sound-3.mp3'))).toEqual(Buffer.from(frames));
  });

  it('records the digest of the original frames, not of a re-encode', () => {
    // IMPL-090-R008: the asset *is* the input. If the writer ever re-encoded, these would differ
    // while the file would still be a valid MP3 and every other assertion would still pass.
    const { assets } = runDump('mp3-hash', swf);

    expect(assets[0]?.sha256).toBe(sha256(frames));
  });

  it('surfaces SeekSamples as metadata without applying it to the payload', () => {
    // The trim is a scheduling instruction (IMPL-090-R007/R032). Applying it here would silently
    // shorten the asset and make the hash-equality guarantee unverifiable.
    const { dir, assets } = runDump('mp3-seek', swf);

    expect(assets[0]?.metadata).toMatchObject({
      codec: 'mp3-pass-through',
      measurement: 'unavailable-pass-through',
      seekSamples: -3,
      frameCount: 2,
    });
    expect(readFileSync(join(dir, 'sound-3.mp3')).length).toBe(frames.length);
  });

  it('keeps both frames across a parameter change and reports it', () => {
    const { assets } = runDump('mp3-param', swf);

    expect(assets[0]?.metadata).toMatchObject({ parameterChanges: 1, decodedFrameSamples: 2304 });
  });

  it('is byte-identical and hash-identical across two runs', () => {
    const first = runDump('mp3-run-a', swf);
    const second = runDump('mp3-run-b', swf);

    expect(readFileSync(join(first.dir, 'sound-3.mp3'))).toEqual(readFileSync(join(second.dir, 'sound-3.mp3')));
    expect(first.assets[0]?.sha256).toBe(second.assets[0]?.sha256);
  });
});

describe('T-AUD-111/112 the manifest carries levels and a chunk table', () => {
  /**
   * 16-bit mono PCM, format 3, at 44.1 kHz, held at a constant half scale.
   *
   * Deliberately not a square wave: an alternating-sample square sits exactly at Nyquist, and the
   * 44.1 -> 48 kHz linear resampler attenuates it to ~0.29 RMS. That would make this a test of the
   * resampler's frequency response rather than of the metadata. A DC level passes through linear
   * interpolation unchanged, so peak and RMS are both exactly 0.5 and any drift is the measurement's.
   */
  function pcmLevel(count: number): Uint8Array {
    const bytes = new Uint8Array(count * 2);
    const view = new DataView(bytes.buffer);
    for (let i = 0; i < count; i += 1) view.setInt16(i * 2, 16384, true);
    return bytes;
  }

  function pcmSwf(id: number, count: number, data: Uint8Array): Uint8Array {
    return buildSwf({
      version: 10,
      body: concat(tag(Tag.DefineSound, soundBody(id, 3, 3, count, data)), showFrames(1), endTag()),
      frameCount: 1,
    });
  }

  it('reports peak and RMS for a known half-scale signal', () => {
    const { assets } = runDump('levels', pcmSwf(1, 1024, pcmLevel(1024)));
    const audio = assets[0]?.audio;

    expect(audio?.peak).toBe(0.5);
    expect(audio?.rms).toBe(0.5);
    expect(audio?.rmsDbfs).toBe(-6.02);
    expect(audio?.silent).toBe(false);
    expect(audio?.belowNullGate).toBe(false);
  });

  it('marks a silent fallback asset as silent and below the null gate', () => {
    // Nellymoser has no decoder in this build, so the asset is a duration-correct silent WAV.
    const silentSwf = buildSwf({
      version: 10,
      body: concat(tag(Tag.DefineSound, soundBody(4, 6, 3, 5, Uint8Array.from([1, 2, 3]))), showFrames(1), endTag()),
      frameCount: 1,
    });
    const { assets } = runDump('silent', silentSwf);

    expect(assets[0]?.status).toBe('fallback');
    expect(assets[0]?.audio).toMatchObject({ peak: 0, rms: 0, rmsDbfs: null, silent: true, belowNullGate: true });
  });

  it('emits a single chunk for a short asset, sized to the resampled duration', () => {
    const { assets } = runDump('chunk-short', pcmSwf(1, 441, pcmLevel(441)));
    const audio = assets[0]?.audio;

    // 441 frames at 44.1 kHz is 10 ms, which resamples to 480 frames at 48 kHz.
    expect(audio?.durationSamples).toBe(480);
    expect(audio?.chunks).toEqual([{ startSample: 0, frames: 480, peak: audio?.chunks[0]?.peak }]);
  });

  it('splits on the exact 10 s boundary once the asset is longer than one chunk', () => {
    // 11 s at 44.1 kHz resamples to 528 000 frames at 48 kHz: one full 480 000-frame chunk and a
    // 48 000-frame remainder. A boundary computed on the *source* rate would land elsewhere.
    const sourceFrames = 44_100 * 11;
    const { assets } = runDump('chunk-long', pcmSwf(1, sourceFrames, pcmLevel(sourceFrames)));
    const audio = assets[0]?.audio;

    expect(audio?.durationSamples).toBe(528_000);
    expect(audio?.chunks.map((chunk) => [chunk.startSample, chunk.frames])).toEqual([
      [0, 480_000],
      [480_000, 48_000],
    ]);
  });

  it('writes an identical manifest on a second run', () => {
    const swf = pcmSwf(1, 2048, pcmLevel(2048));
    const first = runDump('levels-a', swf);
    const second = runDump('levels-b', swf);

    expect(readdirSync(first.dir)).toEqual(readdirSync(second.dir));
    expect(first.assets[0]?.audio).toEqual(second.assets[0]?.audio);
  });
});
