/** Deterministic P3 asset-preview bundle writer. It never invents output for undecoded media. */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { BitmapDecodeError, decodeBitmap, encodeBitmapPng, encodeFontWoff2 } from '@swf-forge/assets';
import {
  decodeSwfAdpcm,
  decodeSwfPcm,
  encodePcm16Wav,
  measureAudio,
  parseSwfMp3EventData,
  resamplePcm16,
  silentPcm,
} from '@swf-forge/audio';
import { buildMovieModel, Codes, tagName } from '@swf-forge/swf';
import type { BitmapAssetModel, CharacterModel, DefineSoundModel, MorphShapeModel, SwfFile } from '@swf-forge/swf';
import { openSwfNodeSync } from '@swf-forge/swf/node';

import { EXIT, exitForDiagnostics, type CliIo } from '../exit.js';
import { renderShapePreview } from './shape-preview.js';
import { buildFontAtlas } from './font-atlas.js';

export interface AssetsDumpRequest {
  readonly file: string;
  readonly out: string;
}

interface AssetDiagnostic {
  readonly code: string;
  readonly severity: 'error' | 'warning' | 'info';
  readonly message: string;
}

interface AssetRecord {
  readonly characterId: number;
  readonly kind: string;
  readonly sourceTag: string;
  readonly outputType: string | null;
  readonly path: string | null;
  readonly status: 'written' | 'fallback' | 'unsupported';
  readonly sha256: string | null;
  readonly metadata?: Readonly<Record<string, number | string | boolean>>;
  /** `IMPL-090-R030`/`R031` levels and chunk table for PCM-backed WAV previews. */
  readonly audio?: AssetAudioMeta;
  readonly diagnostics: readonly AssetDiagnostic[];
}

interface AssetAudioMeta {
  readonly durationSamples: number;
  readonly peak: number;
  readonly rms: number;
  readonly rmsDbfs: number | null;
  readonly silent: boolean;
  readonly belowNullGate: boolean;
  readonly chunks: readonly { readonly startSample: number; readonly frames: number; readonly peak: number }[];
}

interface AssetManifest {
  readonly format: 'swf-forge/assets-manifest';
  readonly formatVersion: 1;
  readonly source: {
    readonly bytes: number;
    readonly sha256: string;
    readonly compression: string;
    readonly version: number;
  };
  readonly assets: readonly AssetRecord[];
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function needsBuildAsset(character: CharacterModel): boolean {
  return (
    character.vectorShape !== null ||
    character.kind === 'shape' ||
    character.kind === 'shape4' ||
    character.kind === 'morphShape' ||
    character.kind === 'bitmap' ||
    character.kind === 'bitmapLossless' ||
    character.kind === 'font' ||
    character.kind === 'font2' ||
    character.kind === 'font3' ||
    character.kind === 'font4' ||
    character.kind === 'sound'
  );
}

function unsupported(character: CharacterModel): AssetRecord {
  const sourceTag = character.index?.code ?? character.tagCode;
  const message =
    character.kind === 'shape' || character.kind === 'shape4'
      ? 'static shape geometry was not decoded; no PNG was written'
      : `${character.kind} asset decoding is not available in this build; no output was written`;
  return {
    characterId: character.id,
    kind: character.kind,
    sourceTag: sourceTag === null || sourceTag === undefined ? character.tagName : tagName(sourceTag),
    outputType: null,
    path: null,
    status: 'unsupported',
    sha256: null,
    diagnostics: [{ code: 'ASSET_UNSUPPORTED', severity: 'error', message }],
  };
}

function recordShape(character: CharacterModel, out: string): AssetRecord {
  const shape = character.vectorShape;
  if (shape === null) return unsupported(character);
  const preview = renderShapePreview(shape);
  const path = `shape-${character.id}.png`;
  writeFileSync(join(out, path), preview.png);
  const unresolvedBitmapIds = new Set<number>();
  for (const style of shape.styles.fills) {
    if (style?.kind === 'bitmap') unresolvedBitmapIds.add(style.bitmapId);
  }
  const diagnostics: AssetDiagnostic[] = [...unresolvedBitmapIds]
    .sort((a, b) => a - b)
    .map((bitmapId) => ({
      code: 'ASSET_BITMAP_PREVIEW_MISSING',
      severity: 'warning',
      message: `bitmap fill references character ${bitmapId}; its preview is transparent until bitmap decoding is available`,
    }));
  return {
    characterId: character.id,
    kind: character.kind,
    sourceTag: character.index?.code === undefined ? character.tagName : tagName(character.index.code),
    outputType: 'image/png',
    path,
    status: 'written',
    sha256: digest(preview.png),
    diagnostics,
  };
}

function recordMorph(character: CharacterModel, out: string): AssetRecord[] {
  const morph: MorphShapeModel | null = character.morph;
  if (morph === null) return [unsupported(character)];
  const sourceTag = character.index?.code === undefined ? character.tagName : tagName(character.index.code);
  const endpoints = [
    { name: 'start', shape: morph.start, edgeCount: morph.edgeCounts.start },
    { name: 'end', shape: morph.end, edgeCount: morph.edgeCounts.end },
  ] as const;
  return endpoints.map(({ name, shape, edgeCount }) => {
    const preview = renderShapePreview(shape);
    const path = `morph-${character.id}-${name}.png`;
    writeFileSync(join(out, path), preview.png);
    const unresolvedBitmapIds = [
      ...new Set(shape.styles.fills.flatMap((style) => (style?.kind === 'bitmap' ? [style.bitmapId] : []))),
    ].sort((a, b) => a - b);
    const diagnostics: AssetDiagnostic[] = unresolvedBitmapIds.map((bitmapId) => ({
      code: 'ASSET_BITMAP_PREVIEW_MISSING',
      severity: 'warning',
      message: `bitmap fill references character ${bitmapId}; its morph preview is transparent until bitmap decoding is available`,
    }));
    return {
      characterId: character.id,
      kind: character.kind,
      sourceTag,
      outputType: 'image/png',
      path,
      status: 'written',
      sha256: digest(preview.png),
      metadata: { endpoint: name, edgeCount, pairedEdgeCount: morph.pairs.length, offsetMatches: morph.offsetMatches },
      diagnostics,
    };
  });
}

function jpegTablesForFile(model: ReturnType<typeof buildMovieModel>, file: SwfFile): Uint8Array | null {
  // JPEG-tables multiplicity SF0257 is reported by `collectControl`; the chosen payload is surfaced
  // directly on the control model to avoid a second tag-index scan here.
  void file;
  return model.control.jpegTables;
}

function recordBitmap(
  character: CharacterModel,
  out: string,
  jpegTables: Uint8Array | null,
  swfVersion: number,
): AssetRecord {
  const model: BitmapAssetModel | null = character.bitmap;
  if (model === null) return unsupported(character);
  try {
    const decoded = decodeBitmap(model, { jpegTables, swfVersion });
    const png = encodeBitmapPng(decoded.bitmap);
    const path = `bitmap-${character.id}.png`;
    writeFileSync(join(out, path), png);
    return {
      characterId: character.id,
      kind: character.kind,
      sourceTag: sourceTag(character),
      outputType: 'image/png',
      path,
      status: 'written',
      sha256: digest(png),
      metadata: {
        width: decoded.bitmap.width,
        height: decoded.bitmap.height,
        source: model.source,
        contentType: decoded.bitmap.contentType,
        classification: decoded.bitmap.classification,
        distinctColors: decoded.bitmap.distinctColors,
        alphaPixels: decoded.bitmap.alphaPixels,
        frameCount: decoded.bitmap.frameCount,
        sourcePremultiplied: decoded.bitmap.sourcePremultiplied,
        alphaDataOffset: model.alphaDataOffset ?? -1,
        deblocking: model.deblocking ?? -1,
      },
      diagnostics: decoded.diagnostics,
    };
  } catch (error) {
    const code = error instanceof BitmapDecodeError ? error.code : 'ASSET_BITMAP_DECODE_FAILED';
    const message = error instanceof Error ? error.message : String(error);
    const severity: AssetDiagnostic['severity'] =
      code === 'SF0255' || code === 'SF0256' || code === 'SF0257' ? 'warning' : 'error';
    return {
      characterId: character.id,
      kind: character.kind,
      sourceTag: sourceTag(character),
      outputType: null,
      path: null,
      status: 'unsupported',
      sha256: null,
      diagnostics: [
        ...(error instanceof BitmapDecodeError ? error.diagnostics.filter((item) => item.code !== code) : []),
        { code, severity, message },
      ],
    };
  }
}

function forwardBitmapDiagnostics(file: SwfFile, assets: readonly AssetRecord[]): void {
  for (const asset of assets) {
    for (const diagnostic of asset.diagnostics) {
      const context = `assets dump character ${asset.characterId}`;
      switch (diagnostic.code) {
        case Codes.IMAGE_LOSSLESS_SIZE_MISMATCH:
          file.sink.emit({
            code: Codes.IMAGE_LOSSLESS_SIZE_MISMATCH,
            severity: 'error',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.IMAGE_JPEG_TABLES_MISSING:
          file.sink.emit({
            code: Codes.IMAGE_JPEG_TABLES_MISSING,
            severity: 'error',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.IMAGE_JPEG_UNDECODABLE:
          file.sink.emit({
            code: Codes.IMAGE_JPEG_UNDECODABLE,
            severity: 'error',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.IMAGE_ALPHA_LENGTH_MISMATCH:
          file.sink.emit({
            code: Codes.IMAGE_ALPHA_LENGTH_MISMATCH,
            severity: 'error',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.IMAGE_DEBLOCK_RECORDED:
          file.sink.emit({
            code: Codes.IMAGE_DEBLOCK_RECORDED,
            severity: 'info',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.IMAGE_JPEG_MARKER_MISSING:
          file.sink.emit({
            code: Codes.IMAGE_JPEG_MARKER_MISSING,
            severity: 'warning',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.IMAGE_PROGRESSIVE_JPEG:
          file.sink.emit({
            code: Codes.IMAGE_PROGRESSIVE_JPEG,
            severity: 'warning',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.IMAGE_MULTIPLE_JPEG_TABLES:
          file.sink.emit({
            code: Codes.IMAGE_MULTIPLE_JPEG_TABLES,
            severity: 'warning',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.IMAGE_JPEG_PREFIX_SKIPPED:
          file.sink.emit({
            code: Codes.IMAGE_JPEG_PREFIX_SKIPPED,
            severity: 'info',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.IMAGE_LOSSLESS2_FORMAT4:
          file.sink.emit({
            code: Codes.IMAGE_LOSSLESS2_FORMAT4,
            severity: 'info',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.IMAGE_FORMAT_UNKNOWN:
          file.sink.emit({
            code: Codes.IMAGE_FORMAT_UNKNOWN,
            severity: 'error',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.IMAGE_ALPHA_ON_PNG_GIF:
          file.sink.emit({
            code: Codes.IMAGE_ALPHA_ON_PNG_GIF,
            severity: 'error',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
      }
    }
  }
}

function sourceTag(character: CharacterModel): string {
  return character.index?.code === undefined ? character.tagName : tagName(character.index.code);
}

function recordFont(character: CharacterModel, out: string): AssetRecord {
  if (character.font === null) return unsupported(character);
  try {
    const converted = encodeFontWoff2(character.font);
    const atlas = buildFontAtlas(character.font);
    const path = `font-${character.id}.woff2`;
    writeFileSync(join(out, path), converted.bytes);
    for (const page of atlas.pages) writeFileSync(join(out, page.path), page.bytes);
    writeFileSync(join(out, atlas.manifestPath), atlas.manifestBytes);
    return {
      characterId: character.id,
      kind: character.kind,
      sourceTag: sourceTag(character),
      outputType: 'font/woff2',
      path,
      status: 'written',
      sha256: digest(converted.bytes),
      metadata: {
        familyName: converted.familyName,
        glyphCount: converted.glyphCount,
        unitsPerEm: converted.unitsPerEm,
        italic: character.font.italic,
        bold: character.font.bold,
        atlasManifest: atlas.manifestPath,
        atlasManifestSha256: atlas.manifestSha256,
        atlasPageCount: atlas.pages.length,
        atlasGlyphCount: atlas.glyphs.filter((glyph) => glyph.page !== null).length,
        atlasPageSize: atlas.pageSize,
      },
      diagnostics: [],
    };
  } catch (error) {
    return {
      characterId: character.id,
      kind: character.kind,
      sourceTag: sourceTag(character),
      outputType: null,
      path: null,
      status: 'unsupported',
      sha256: null,
      diagnostics: [
        {
          code: 'FONT_WOFF2_CONVERSION_FAILED',
          severity: 'error',
          message: error instanceof Error ? error.message : String(error),
        },
      ],
    };
  }
}

function soundSampleRate(sound: DefineSoundModel): number {
  if (sound.format === 4) return 16000;
  if (sound.format === 5) return 8000;
  if (sound.format === 11) return 16000;
  return sound.sampleRate;
}

function soundChannels(sound: DefineSoundModel): 1 | 2 {
  return sound.format === 4 || sound.format === 5 || sound.format === 6 || sound.format === 11 ? 1 : sound.channels;
}

function soundUnsupported(
  character: CharacterModel,
  message: string,
  code = 'ASSET_SOUND_DECODE_FAILED',
  severity: AssetDiagnostic['severity'] = 'error',
): AssetRecord {
  return {
    characterId: character.id,
    kind: character.kind,
    sourceTag: sourceTag(character),
    outputType: null,
    path: null,
    status: 'unsupported',
    sha256: null,
    diagnostics: [{ code, severity, message }],
  };
}

function writeSoundWav(
  character: CharacterModel,
  sound: DefineSoundModel,
  channels: readonly Int16Array[],
  out: string,
  options: {
    readonly status?: 'written' | 'fallback';
    readonly sampleRate?: number;
    readonly diagnostics?: readonly AssetDiagnostic[];
    readonly metadata?: Readonly<Record<string, number | string | boolean>>;
  } = {},
): AssetRecord {
  const sampleRate = options.sampleRate ?? soundSampleRate(sound);
  const wav = encodePcm16Wav({ channels, sampleRate });
  const path = `sound-${character.id}.wav`;
  writeFileSync(join(out, path), wav);
  // `IMPL-090-R031`: every asset carries peak/RMS and a chunk table. These are flat scalars plus a
  // compact chunk list so the manifest stays diffable and byte-stable run to run.
  const measured = measureAudio({ channels, sampleRate });
  return {
    characterId: character.id,
    kind: character.kind,
    sourceTag: sourceTag(character),
    outputType: 'audio/wav',
    path,
    status: options.status ?? 'written',
    sha256: digest(wav),
    ...(options.metadata !== undefined ? { metadata: options.metadata } : {}),
    audio: {
      durationSamples: measured.durationSamples,
      peak: measured.levels.peak,
      rms: measured.levels.rms,
      rmsDbfs: measured.levels.rmsDbfs,
      silent: measured.levels.silent,
      belowNullGate: measured.levels.belowNullGate,
      chunks: measured.chunks.map((chunk) => ({
        startSample: chunk.startSample,
        frames: chunk.frames,
        peak: chunk.peak,
      })),
    },
    diagnostics: options.diagnostics ?? [],
  };
}

function forwardSoundDiagnostics(file: SwfFile, assets: readonly AssetRecord[]): void {
  for (const asset of assets) {
    for (const diagnostic of asset.diagnostics) {
      const context = `assets dump character ${asset.characterId}`;
      switch (diagnostic.code) {
        case Codes.SOUND_FORMAT_RESERVED:
          file.sink.emit({
            code: Codes.SOUND_FORMAT_RESERVED,
            severity: 'error',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.SOUND_SPEEX_UNAVAILABLE:
          file.sink.emit({
            code: Codes.SOUND_SPEEX_UNAVAILABLE,
            severity: 'warning',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.SOUND_NELLYMOSER_UNAVAILABLE:
          file.sink.emit({
            code: Codes.SOUND_NELLYMOSER_UNAVAILABLE,
            severity: 'warning',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.SOUND_MP3_SYNC_LOST:
          file.sink.emit({
            code: Codes.SOUND_MP3_SYNC_LOST,
            severity: 'warning',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.SOUND_ADPCM_MALFORMED:
          file.sink.emit({
            code: Codes.SOUND_ADPCM_MALFORMED,
            severity: 'error',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.SOUND_MP3_PARAMETER_CHANGE:
          file.sink.emit({
            code: Codes.SOUND_MP3_PARAMETER_CHANGE,
            severity: 'info',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.SOUND_MP3_SEEK_DISCONTINUITY:
          file.sink.emit({
            code: Codes.SOUND_MP3_SEEK_DISCONTINUITY,
            severity: 'warning',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.SOUND_SAMPLE_COUNT_MISMATCH:
          file.sink.emit({
            code: Codes.SOUND_SAMPLE_COUNT_MISMATCH,
            severity: 'warning',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
        case Codes.SOUND_ZERO_PAYLOAD:
          file.sink.emit({
            code: Codes.SOUND_ZERO_PAYLOAD,
            severity: 'warning',
            message: diagnostic.message,
            offset: 0,
            context,
            characterId: asset.characterId,
          });
          break;
      }
    }
  }
}

function zeroPayloadDiagnostic(
  source: Uint8Array,
  channels: readonly Int16Array[],
  codec: string,
): AssetDiagnostic | null {
  if (source.every((byte) => byte === 0) || channels.length === 0) return null;
  if (!channels.every((channel) => channel.every((sample) => sample === 0))) return null;
  return {
    code: Codes.SOUND_ZERO_PAYLOAD,
    severity: 'warning',
    message: `nonzero ${codec} payload decodes to all-zero audio`,
  };
}

function recordSound(character: CharacterModel, out: string): AssetRecord {
  const sound = character.sound;
  if (sound === null) return soundUnsupported(character, 'DefineSound metadata was not decoded');
  try {
    if (sound.format === 0 || sound.format === 3) {
      const decoded = decodeSwfPcm(sound.data, {
        format: sound.format,
        bitsPerSample: sound.bitsPerSample,
        channels: sound.channels,
        sampleCount: sound.sampleCount,
      });
      const diagnostics: AssetDiagnostic[] = [];
      if (decoded.truncated) {
        diagnostics.push({
          code: 'ASSET_SOUND_TRUNCATED',
          severity: 'warning',
          message: `decoded ${decoded.decodedSampleCount} of ${decoded.sampleCount} declared PCM frame(s); remainder padded with silence`,
        });
      }
      const zeroPayload = zeroPayloadDiagnostic(sound.data, decoded.channels, 'PCM');
      if (zeroPayload) diagnostics.push(zeroPayload);
      const resampled = resamplePcm16({ channels: decoded.channels, inputRate: sound.sampleRate, outputRate: 48000 });
      return writeSoundWav(character, sound, resampled.channels, out, {
        sampleRate: resampled.sampleRate,
        metadata: {
          codec: 'pcm',
          sampleRate: resampled.sampleRate,
          sourceSampleRate: sound.sampleRate,
          sampleCount: sound.sampleCount,
          outputSampleCount: resampled.sampleCount,
        },
        diagnostics,
      });
    }
    if (sound.format === 1) {
      const decoded = decodeSwfAdpcm(sound.data, { channels: sound.channels, sampleCount: sound.sampleCount });
      const diagnostics: AssetDiagnostic[] = [];
      if (decoded.truncated) {
        diagnostics.push({
          code: 'ASSET_SOUND_TRUNCATED',
          severity: 'warning',
          message: `decoded ${decoded.decodedSampleCount} of ${decoded.sampleCount} declared ADPCM frame(s); remainder padded with silence`,
        });
        // Only a stream that cannot be split into whole packets is malformed (`IMPL-090-R013`,
        // and the registry's own wording: "a packet truncated before the last one"). A final
        // packet a few frames short is an authoring artefact present in 26% of real ADPCM sounds
        // — reporting it as an error would condemn a quarter of shipped Flash content.
        if (!decoded.shortFinalPacket) {
          diagnostics.push({
            code: Codes.SOUND_ADPCM_MALFORMED,
            severity: 'error',
            message: 'ADPCM packet data ends before the declared sample count',
          });
        }
      }
      const zeroPayload = zeroPayloadDiagnostic(sound.data, decoded.channels, 'ADPCM');
      if (zeroPayload) diagnostics.push(zeroPayload);
      const resampled = resamplePcm16({ channels: decoded.channels, inputRate: sound.sampleRate, outputRate: 48000 });
      return writeSoundWav(character, sound, resampled.channels, out, {
        sampleRate: resampled.sampleRate,
        metadata: {
          codec: 'adpcm',
          bitsPerCode: decoded.bitsPerCode ?? 0,
          sampleRate: resampled.sampleRate,
          sourceSampleRate: sound.sampleRate,
          sampleCount: sound.sampleCount,
          outputSampleCount: resampled.sampleCount,
        },
        diagnostics,
      });
    }
    if (sound.format === 2) {
      const parsed = parseSwfMp3EventData(sound.data);
      if (!parsed.valid) {
        return soundUnsupported(
          character,
          parsed.reason ?? 'invalid MP3 event payload',
          Codes.SOUND_MP3_SYNC_LOST,
          'warning',
        );
      }
      const path = `sound-${character.id}.mp3`;
      writeFileSync(join(out, path), parsed.frameBytes);
      const diagnostics: AssetDiagnostic[] = [];
      if (parsed.parameterChanges > 0) {
        diagnostics.push({
          code: Codes.SOUND_MP3_PARAMETER_CHANGE,
          severity: 'info',
          message: `${parsed.parameterChanges} MP3 parameter change(s) detected; original frames retained`,
        });
      }
      const frameSampleCount = parsed.sampleCount;
      const durationDifference = Math.abs(frameSampleCount - sound.sampleCount) / Math.max(1, sound.sampleCount);
      if (durationDifference > 0.05) {
        diagnostics.push({
          code: Codes.SOUND_SAMPLE_COUNT_MISMATCH,
          severity: 'warning',
          message: `MP3 frames contain ${frameSampleCount} sample frame(s), differing from declared SoundSampleCount ${sound.sampleCount} by more than 5%`,
        });
      } else if (frameSampleCount < sound.sampleCount) {
        diagnostics.push({
          code: 'ASSET_MP3_SAMPLE_COUNT_SHORT',
          severity: 'warning',
          message: `MP3 frames contain ${frameSampleCount} sample frame(s), below declared SoundSampleCount ${sound.sampleCount}; seek/trim metadata is retained`,
        });
      }
      if (Math.abs(parsed.seekSamples) > sound.sampleCount) {
        diagnostics.push({
          code: Codes.SOUND_MP3_SEEK_DISCONTINUITY,
          severity: 'warning',
          message: `MP3 SeekSamples ${parsed.seekSamples} exceeds declared SoundSampleCount ${sound.sampleCount}`,
        });
      }
      return {
        characterId: character.id,
        kind: character.kind,
        sourceTag: sourceTag(character),
        outputType: 'audio/mpeg',
        path,
        status: 'written',
        sha256: digest(parsed.frameBytes),
        metadata: {
          codec: 'mp3-pass-through',
          // C5 deliberately does not decode/re-encode MP3. PCM-domain metrics and PCM chunk peaks
          // are therefore unavailable; record that explicitly rather than inventing zeros.
          measurement: 'unavailable-pass-through',
          sampleRate: parsed.frames[0]?.sampleRate ?? sound.sampleRate,
          sampleCount: sound.sampleCount,
          seekSamples: parsed.seekSamples,
          frameCount: parsed.frames.length,
          decodedFrameSamples: frameSampleCount,
          parameterChanges: parsed.parameterChanges,
        },
        diagnostics,
      };
    }

    const channels = soundChannels(sound);
    const sourceRate = soundSampleRate(sound);
    const silent = resamplePcm16({
      channels: silentPcm(sound.sampleCount, channels),
      inputRate: sourceRate,
      outputRate: 48000,
    });
    const codec =
      sound.format === 4
        ? 'nellymoser-16k'
        : sound.format === 5
          ? 'nellymoser-8k'
          : sound.format === 6
            ? 'nellymoser'
            : sound.format === 11
              ? 'speex'
              : `reserved-${sound.format}`;
    const formatUnavailable =
      sound.format === 11 ? sound.format : sound.format >= 4 && sound.format <= 6 ? sound.format : null;
    const code =
      sound.format === 11
        ? Codes.SOUND_SPEEX_UNAVAILABLE
        : formatUnavailable !== null
          ? Codes.SOUND_NELLYMOSER_UNAVAILABLE
          : Codes.SOUND_FORMAT_RESERVED;
    const severity = code === Codes.SOUND_FORMAT_RESERVED ? 'error' : 'warning';
    return writeSoundWav(character, sound, silent.channels, out, {
      status: 'fallback',
      sampleRate: silent.sampleRate,
      metadata: {
        codec,
        sampleRate: silent.sampleRate,
        sourceSampleRate: sourceRate,
        sampleCount: sound.sampleCount,
        outputSampleCount: silent.sampleCount,
        silent: true,
      },
      diagnostics: [
        {
          code,
          severity,
          message: `${codec} decoder is unavailable; emitted an exact-duration silent WAV fallback`,
        },
      ],
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (sound.format === 1) return soundUnsupported(character, message, Codes.SOUND_ADPCM_MALFORMED, 'error');
    return soundUnsupported(character, message);
  }
}

/** Writes a shape-preview bundle and an explicit manifest for all P3 media characters in a movie. */
export function runAssetsDump(request: AssetsDumpRequest, io: CliIo): number {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(request.file));
  } catch (error) {
    io.err(`cannot read ${request.file}: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT.unreadable;
  }

  const file = openSwfNodeSync(bytes);
  const model = buildMovieModel(file);
  const assets: AssetRecord[] = [];
  try {
    mkdirSync(request.out, { recursive: true });
    const jpegTables = jpegTablesForFile(model, file);
    for (const character of [...model.characters.values()].sort((a, b) => a.id - b.id)) {
      if (!needsBuildAsset(character)) continue;
      if (character.vectorShape !== null) assets.push(recordShape(character, request.out));
      else if (character.morph !== null) assets.push(...recordMorph(character, request.out));
      else if (character.bitmap !== null) assets.push(recordBitmap(character, request.out, jpegTables, file.version));
      else if (character.font !== null) assets.push(recordFont(character, request.out));
      else if (character.sound !== null) assets.push(recordSound(character, request.out));
      else assets.push(unsupported(character));
    }
    forwardBitmapDiagnostics(file, assets);
    forwardSoundDiagnostics(file, assets);
    const manifest: AssetManifest = {
      format: 'swf-forge/assets-manifest',
      formatVersion: 1,
      source: {
        bytes: file.sizes.file,
        sha256: digest(bytes),
        compression: file.header.compression,
        version: file.header.version,
      },
      assets,
    };
    writeFileSync(join(request.out, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  } catch (error) {
    io.err(`cannot write assets to ${request.out}: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT.internal;
  }

  const unsupportedCount = assets.filter((asset) => asset.status === 'unsupported').length;
  const fallbackCount = assets.filter((asset) => asset.status === 'fallback').length;
  const writtenCount = assets.filter((asset) => asset.status === 'written').length;
  io.out(
    `${join(request.out, 'manifest.json')} — ${assets.length} asset(s), ${writtenCount} written, ${fallbackCount} fallback, ${unsupportedCount} unsupported`,
  );
  for (const asset of assets) {
    for (const diagnostic of asset.diagnostics) {
      io.err(`${diagnostic.code} #${asset.characterId}: ${diagnostic.message}`);
    }
  }

  const fileExit = exitForDiagnostics(file.diagnostics);
  return fileExit !== EXIT.ok || unsupportedCount > 0 ? EXIT.failed : EXIT.ok;
}
