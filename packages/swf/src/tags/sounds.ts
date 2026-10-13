/** Sound tag structures — `IMPL-090` §§4–6, Ch.11 and APP reference §10.9. */

import { Codes } from '../diagnostics/codes.js';
import type { Cursor } from '../io/cursor.js';

export type SoundFormat = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15;

export const SOUND_SAMPLE_RATES = [5512, 11025, 22050, 44100] as const;

export interface DefineSoundModel {
  readonly id: number;
  readonly format: SoundFormat;
  readonly rateCode: 0 | 1 | 2 | 3;
  readonly sampleRate: number;
  readonly bitsPerSample: 8 | 16;
  readonly channels: 1 | 2;
  /** Per-channel sample frames; stereo counts L/R pairs. */
  readonly sampleCount: number;
  /** Zero-copy view into the bounded SWF tag body. */
  readonly data: Uint8Array;
  readonly dataOffset: number;
}

export interface SoundEnvelopePoint {
  readonly position44: number;
  readonly leftLevel: number;
  readonly rightLevel: number;
}

export interface SoundInfoModel {
  readonly reserved: number;
  readonly syncStop: boolean;
  readonly syncNoMultiple: boolean;
  readonly inPoint: number | null;
  readonly outPoint: number | null;
  readonly loopCount: number | null;
  readonly envelope: readonly SoundEnvelopePoint[];
}

export interface StartSoundModel {
  readonly soundId: number | null;
  readonly className: string | null;
  readonly info: SoundInfoModel;
}

export interface TimelineSoundEvent extends StartSoundModel {
  readonly tagOffset: number;
}

export interface SoundStreamHeadModel {
  readonly reserved: number;
  readonly playbackRateCode: 0 | 1 | 2 | 3;
  readonly playbackRate: number;
  readonly playbackBitsPerSample: 8 | 16;
  readonly playbackChannels: 1 | 2;
  readonly format: SoundFormat;
  readonly rateCode: 0 | 1 | 2 | 3;
  readonly sampleRate: number;
  readonly bitsPerSample: 8 | 16;
  readonly channels: 1 | 2;
  readonly sampleCount: number;
  readonly latencySeek: number | null;
}

export interface SoundStreamBlockModel {
  readonly sampleCount: number | null;
  readonly seekSamples: number | null;
  /** Zero-copy view into the bounded SoundStreamBlock tag body. */
  readonly data: Uint8Array;
  readonly dataOffset: number;
}

function rate(rateCode: number): 5512 | 11025 | 22050 | 44100 {
  return SOUND_SAMPLE_RATES[rateCode as 0 | 1 | 2 | 3] ?? 5512;
}

function soundInfo(c: Cursor): SoundInfoModel {
  const reserved = c.ub(2);
  const syncStop = c.ub(1) === 1;
  const syncNoMultiple = c.ub(1) === 1;
  const hasEnvelope = c.ub(1) === 1;
  const hasLoops = c.ub(1) === 1;
  const hasOutPoint = c.ub(1) === 1;
  const hasInPoint = c.ub(1) === 1;
  const inPoint = hasInPoint ? c.u32() : null;
  const outPoint = hasOutPoint ? c.u32() : null;
  const loopCount = hasLoops ? c.u16() : null;
  const envelopeCount = hasEnvelope ? c.u8() : 0;
  const envelope: SoundEnvelopePoint[] = [];
  for (let i = 0; i < envelopeCount; i += 1) {
    envelope.push({ position44: c.u32(), leftLevel: c.u16(), rightLevel: c.u16() });
  }
  return { reserved, syncStop, syncNoMultiple, inPoint, outPoint, loopCount, envelope };
}

/** `DefineSound` (14): preserves the compressed data as a view; decoding is deferred to the asset pass. */
export function decodeDefineSound(c: Cursor): DefineSoundModel {
  const id = c.u16();
  const format = c.ub(4) as SoundFormat;
  const rateCode = c.ub(2) as 0 | 1 | 2 | 3;
  const bitsPerSample = c.ub(1) === 1 ? 16 : 8;
  const channels = c.ub(1) === 1 ? 2 : 1;
  const sampleCount = c.u32();
  const dataOffset = c.offset;
  const data = c.bytes.subarray(dataOffset, c.limit);
  if (format === 0 && bitsPerSample === 16) {
    c.emit(
      Codes.SOUND_PCM_ENDIAN_ASSUMED,
      'info',
      'uncompressed format 0 declares no byte order; decoded little-endian like format 3 (E-030)',
    );
  }
  if (format === 2 && rateCode === 0) {
    c.emit(
      Codes.SOUND_MP3_NONCANONICAL,
      'warning',
      'MP3 sound declares the unsupported 5.5 kHz rate; MP3 frame headers win',
    );
  }
  if (
    format !== 0 &&
    format !== 1 &&
    format !== 2 &&
    format !== 3 &&
    format !== 4 &&
    format !== 5 &&
    format !== 6 &&
    format !== 11
  ) {
    c.emit(
      Codes.SOUND_FORMAT_RESERVED,
      'error',
      `reserved SoundFormat ${format}; a duration-correct silent fallback is required`,
    );
  }
  if (format === 0 || format === 3) {
    const expectedBytes = BigInt(sampleCount) * BigInt(channels) * BigInt(bitsPerSample / 8);
    if (expectedBytes > BigInt(data.length)) {
      c.emit(
        Codes.SOUND_DATA_TRUNCATED,
        'warning',
        `PCM payload has ${data.length} byte(s), shorter than ${expectedBytes} declared`,
      );
    }
  }
  c.skip(c.remaining);
  return {
    id,
    format,
    rateCode,
    sampleRate: rate(rateCode),
    bitsPerSample,
    channels,
    sampleCount,
    data,
    dataOffset,
  };
}

/** `StartSound` (15) and `StartSound2` (89), including their common `SOUNDINFO` tail. */
export function decodeStartSound(
  c: Cursor,
  withClassName = false,
  channelsForSound?: (soundId: number) => 1 | 2 | null,
): StartSoundModel {
  const soundId = withClassName ? null : c.u16();
  const className = withClassName ? c.string() : null;
  if (withClassName)
    c.emit(
      Codes.SOUND_CLASS_UNSUPPORTED,
      'info',
      `StartSound2 sound class ${JSON.stringify(className)} is preserved but not resolved`,
    );
  let info = soundInfo(c);
  if (
    soundId !== null &&
    channelsForSound?.(soundId) === 1 &&
    info.envelope.some((point) => point.leftLevel !== point.rightLevel)
  ) {
    c.emit(
      Codes.SOUND_MONO_ENVELOPE_MISMATCH,
      'info',
      `mono sound ${soundId} has differing envelope L/R levels; levels averaged`,
    );
    info = {
      ...info,
      envelope: info.envelope.map((point) => {
        const level = Math.round((point.leftLevel + point.rightLevel) / 2);
        return { ...point, leftLevel: level, rightLevel: level };
      }),
    };
  }
  return { soundId, className, info };
}

/** `SoundStreamHead` (18) and `SoundStreamHead2` (45). */
export function decodeSoundStreamHead(c: Cursor, tagCode: 18 | 45): SoundStreamHeadModel {
  const reserved = c.ub(4);
  const playbackRateCode = c.ub(2) as 0 | 1 | 2 | 3;
  const playbackBitsPerSample = c.ub(1) === 1 ? 16 : 8;
  const playbackChannels = c.ub(1) === 1 ? 2 : 1;
  const format = c.ub(4) as SoundFormat;
  const rateCode = c.ub(2) as 0 | 1 | 2 | 3;
  const bitsPerSample = c.ub(1) === 1 ? 16 : 8;
  const channels = c.ub(1) === 1 ? 2 : 1;
  const sampleCount = c.u16();
  const latencySeek = format === 2 && c.remaining >= 2 ? c.s16() : null;
  if (playbackRateCode !== rateCode) {
    c.emit(
      Codes.SOUND_RATE_MISMATCH,
      'info',
      `playback rate ${rate(playbackRateCode)} Hz differs from stream rate ${rate(rateCode)} Hz`,
    );
  }
  // `tagCode` is retained in the signature because the caller's tag dispatch is part of the boundary.
  void tagCode;
  return {
    reserved,
    playbackRateCode,
    playbackRate: rate(playbackRateCode),
    playbackBitsPerSample,
    playbackChannels,
    format,
    rateCode,
    sampleRate: rate(rateCode),
    bitsPerSample,
    channels,
    sampleCount,
    latencySeek,
  };
}

/** `SoundStreamBlock` (19); MP3 blocks begin with `SampleCount UI16` and `SeekSamples SI16`. */
export function decodeSoundStreamBlock(c: Cursor, format: SoundFormat): SoundStreamBlockModel {
  const sampleCount = format === 2 ? c.u16() : null;
  const seekSamples = format === 2 ? c.s16() : null;
  if (sampleCount === 0)
    c.emit(Codes.SOUND_ZERO_BLOCK, 'info', 'empty MP3 stream block advances the timeline without samples');
  const dataOffset = c.offset;
  return { sampleCount, seekSamples, data: c.bytes.subarray(dataOffset, c.limit), dataOffset };
}
