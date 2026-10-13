/** `@swf-forge/audio` — deterministic build-time codec primitives and runtime-neutral PCM data. */

export { decodeSwfAdpcm } from './codecs/adpcm.js';
export type { AdpcmBitDepth, AdpcmChannels, DecodeSwfAdpcmOptions, DecodedSwfAdpcm } from './codecs/adpcm.js';
export { SWF_ADPCM_INDEX_TABLES, SWF_ADPCM_STEP_TABLE } from './codecs/adpcm-tables.js';
export { decodeSwfPcm } from './codecs/pcm.js';
export type { DecodeSwfPcmOptions, DecodedSwfPcm } from './codecs/pcm.js';
export { parseMp3Frames, parseSwfMp3EventData } from './codecs/mp3.js';
export type { Mp3FrameHeader, Mp3FrameParseResult, SwfMp3EventData } from './codecs/mp3.js';
export { resamplePcm16 } from './codecs/resample.js';
export type { ResamplePcm16Options, ResampledPcm16 } from './codecs/resample.js';
export { CANONICAL_SAMPLE_RATE, CHUNK_SECONDS, measureAudio } from './codecs/measure.js';
export type {
  AudioChunk,
  AudioLevels,
  AudioLoop,
  AudioTrim,
  MeasureAudioOptions,
  MeasuredAudio,
} from './codecs/measure.js';
export { encodePcm16Wav, silentPcm } from './codecs/wav.js';
export type { EncodePcm16WavOptions } from './codecs/wav.js';
