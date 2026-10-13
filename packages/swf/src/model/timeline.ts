/**
 * Frame/timeline assembly — `IMPL-030` §7.
 *
 * Assembly is a pure function of the tag index: it reads tag bodies through fresh cursors and never
 * mutates the file (`IMPL-030-R032`). `ShowFrame` (1) closes a frame; a trailing group of ops with no
 * `ShowFrame` after it still forms a frame. The declared `FrameCount` pads the main timeline and
 * sprite timelines (`IMPL-030-R033`): declared values win; observed extra frames are appended.
 */

import { decodeSwfAdpcm, decodeSwfPcm, parseMp3Frames } from '@swf-forge/audio';
import type { SwfFile } from '../container/open.js';
import type { TagRef } from '../container/tag-stream.js';
import { Codes } from '../diagnostics/codes.js';
import { Cursor } from '../io/cursor.js';
import { decodeFrameLabel, decodeSceneAndFrameLabelData, decodeSetTabIndex } from '../tags/control.js';
import {
  decodePlaceObject,
  decodePlaceObject2,
  decodePlaceObject3,
  decodeRemoveObject,
  decodeRemoveObject2,
  type ActionBlockRef,
} from '../tags/place.js';
import { Tag, tagName } from '../tags/tag-codes.js';
import type { DisplayOp, FrameModel, StreamSoundBlockRecord, StreamSoundSpan, TimelineModel } from './types.js';
import {
  decodeStartSound,
  decodeSoundStreamBlock,
  decodeSoundStreamHead,
  type TimelineSoundEvent,
} from '../tags/sounds.js';

export interface AssembleTimelineOptions {
  /** Declared frame count for this level (movie header or `DefineSprite`). */
  readonly declaredFrameCount?: number | null;
  /** Append empty frames until `declaredFrameCount` is reached (main timeline only). */
  readonly padToDeclared?: boolean;
  readonly mode?: 'soft' | 'strict';
  /** `--strict-timeline`: report removals at empty depths (`SF0127`, info). */
  readonly strictTimeline?: boolean;
  /** Resolved ImportAssets local ids do not produce undefined-character diagnostics. */
  readonly importedCharacterIds?: ReadonlySet<number>;
  /** Sound channel metadata used to normalise mono envelope records. */
  readonly soundChannels?: (soundId: number) => 1 | 2 | null;
  /** Called for every `FrameLabel`, so the model layer can build its own label index. */
  readonly onFrameLabel?: (name: string, namedAnchor: boolean, frameIndex: number) => void;
}

/** A cursor bounded to one tag body, with the tag's code and owner already in its diagnostics. */
export function openTagCursor(file: SwfFile, ref: TagRef, mode: 'soft' | 'strict' = 'soft'): Cursor {
  return new Cursor(file.body, ref.offset, ref.offset + ref.length, {
    mode,
    sink: file.sink,
    context: `tag ${ref.code} (${tagName(ref.code)}) #${ref.index}`,
    version: file.version,
    tagCode: ref.code,
    ...(ref.inSprite !== null ? { characterId: ref.inSprite } : {}),
  });
}

function inspectStreamSoundBlock(
  c: Cursor,
  head: ReturnType<typeof decodeSoundStreamHead>,
  block: ReturnType<typeof decodeSoundStreamBlock>,
  sampleCount: number,
): void {
  if (head.format === 2) {
    const parsed = parseMp3Frames(block.data);
    if (!parsed.valid) {
      c.emit(Codes.SOUND_MP3_SYNC_LOST, 'warning', parsed.reason ?? 'MP3 stream block contains no complete frames');
      return;
    }
    if (parsed.parameterChanges > 0) {
      c.emit(
        Codes.SOUND_MP3_PARAMETER_CHANGE,
        'info',
        `${parsed.parameterChanges} MP3 parameter change(s) in this stream block`,
      );
    }
    if (sampleCount > 0 && Math.abs(parsed.sampleCount - sampleCount) / sampleCount > 0.05) {
      c.emit(
        Codes.SOUND_SAMPLE_COUNT_MISMATCH,
        'warning',
        `MP3 frames contain ${parsed.sampleCount} samples but the stream block declares ${sampleCount} (>5% difference)`,
      );
    }
    if (block.seekSamples !== null && Math.abs(block.seekSamples) > sampleCount) {
      c.emit(
        Codes.SOUND_MP3_SEEK_DISCONTINUITY,
        'warning',
        `MP3 SeekSamples ${block.seekSamples} exceeds the block's ${sampleCount}-sample extent`,
      );
    }
    return;
  }

  if (head.format === 0 || head.format === 3) {
    const decoded = decodeSwfPcm(block.data, {
      format: head.format,
      bitsPerSample: head.bitsPerSample,
      channels: head.channels,
      sampleCount,
    });
    if (decoded.truncated) {
      c.emit(
        Codes.SOUND_DATA_TRUNCATED,
        'warning',
        `PCM stream block is short by ${sampleCount - decoded.decodedSampleCount} sample frame(s)`,
      );
    }
    if (
      block.data.some((byte) => byte !== 0) &&
      decoded.channels.every((channel) => channel.every((sample) => sample === 0))
    ) {
      c.emit(Codes.SOUND_ZERO_PAYLOAD, 'warning', 'nonzero PCM stream payload decodes to all-zero audio');
    }
    return;
  }

  if (head.format === 1) {
    const decoded = decodeSwfAdpcm(block.data, { channels: head.channels, sampleCount });
    // `sampleCount` here comes from the head's *average* samples per block, so a small final-packet
    // shortfall is expected, not malformed (`IMPL-090-R013`, errata `E-031`/`E-032`).
    if (decoded.truncated && !decoded.shortFinalPacket) {
      c.emit(Codes.SOUND_ADPCM_MALFORMED, 'error', 'ADPCM stream block is truncated before the declared sample count');
    }
    if (
      block.data.some((byte) => byte !== 0) &&
      decoded.channels.every((channel) => channel.every((sample) => sample === 0))
    ) {
      c.emit(Codes.SOUND_ZERO_PAYLOAD, 'warning', 'nonzero ADPCM stream payload decodes to all-zero audio');
    }
  }
}

function emptyFrame(index: number): FrameModel {
  return { index, ops: [], actions: [], label: null, soundStreamBlock: null, videoFrames: [], soundEvents: [] };
}

/**
 * Assembles one timeline from `refs` (the tags of a level, in file order, `End` excluded).
 */
export function assembleTimeline(
  file: SwfFile,
  refs: readonly TagRef[],
  options: AssembleTimelineOptions = {},
): TimelineModel {
  const mode = options.mode ?? 'soft';
  const frames: FrameModel[] = [];
  const labels = new Map<string, number>();
  const spans: StreamSoundSpan[] = [];
  const definedCharacterIds = new Set([
    ...file.definitions.map((definition) => definition.id),
    ...(options.importedCharacterIds ?? []),
  ]);
  const displayList = new Map<number, number>();

  let ops: DisplayOp[] = [];
  let actions: ActionBlockRef[] = [];
  let label: string | null = null;
  let soundStreamBlock: { offset: number; length: number } | null = null;
  let videoFrames: TagRef[] = [];
  let soundEvents: TimelineSoundEvent[] = [];
  let currentSpan: {
    headTag: TagRef;
    head: ReturnType<typeof decodeSoundStreamHead>;
    blockTags: TagRef[];
    blocks: StreamSoundBlockRecord[];
    sampleCount: number;
  } | null = null;
  // Scene data found inside a sprite is a single implicit scene (`IMPL-040-R013`, `SF0169`);
  // main-timeline scene data is owned by the model layer (`collectControl`).
  let implicitScene: { readonly name: string } | null = null;

  const pushFrame = (): void => {
    frames.push({
      index: frames.length,
      ops,
      actions,
      label,
      soundStreamBlock,
      videoFrames,
      soundEvents,
    });
    ops = [];
    actions = [];
    label = null;
    soundStreamBlock = null;
    videoFrames = [];
    soundEvents = [];
  };

  for (const ref of refs) {
    const c = openTagCursor(file, ref, mode);
    switch (ref.code) {
      case Tag.ShowFrame:
        pushFrame();
        break;
      case Tag.PlaceObject:
      case Tag.PlaceObject2:
      case Tag.PlaceObject3: {
        const op =
          ref.code === Tag.PlaceObject
            ? decodePlaceObject(c, ops.length, ref.offset)
            : ref.code === Tag.PlaceObject2
              ? decodePlaceObject2(c, ops.length, ref.offset)
              : decodePlaceObject3(c, ops.length, ref.offset);
        const placedCharacterId = op.characterId ?? displayList.get(op.depth);
        if (op.clipActions !== null && placedCharacterId !== undefined && placedCharacterId !== null) {
          let placedTagCode: number | null = null;
          for (let i = file.definitions.length - 1; i >= 0; i -= 1) {
            const definition = file.definitions[i];
            if (definition?.id === placedCharacterId) {
              placedTagCode = definition.tagCode;
              break;
            }
          }
          if (placedTagCode !== null && placedTagCode !== Tag.DefineSprite) {
            c.emit(
              Codes.CLIP_ACTIONS_NON_SPRITE,
              'warning',
              `clip actions are attached to non-sprite character ${placedCharacterId}; bytes retained`,
              ref.headerOffset,
              { characterId: placedCharacterId },
            );
          }
        }
        if (op.characterId !== null) {
          if (!definedCharacterIds.has(op.characterId)) {
            c.emit(
              Codes.UNDEFINED_CHARACTER_REF,
              'warning',
              `placement references undefined character id ${op.characterId}`,
              ref.headerOffset,
              { characterId: op.characterId },
            );
          }
          displayList.set(op.depth, op.characterId);
        }
        ops.push(op);
        break;
      }
      case Tag.RemoveObject:
      case Tag.RemoveObject2: {
        const op =
          ref.code === Tag.RemoveObject
            ? decodeRemoveObject(c, ops.length, ref.offset)
            : decodeRemoveObject2(c, ops.length, ref.offset);
        const current = displayList.get(op.depth);
        if (current !== undefined && (op.characterId === null || op.characterId === current)) {
          displayList.delete(op.depth);
        } else if (current === undefined && options.strictTimeline === true) {
          // Ch.4 makes the removal a silent no-op; `--strict-timeline` reports it (`SF0127`, info).
          c.emit(
            Codes.REMOVAL_EMPTY_DEPTH,
            'info',
            `RemoveObject${op.tag === 'RemoveObject2' ? '2' : ''} at empty depth ${op.depth} is a no-op`,
          );
        }
        ops.push(op);
        break;
      }
      case Tag.SetTabIndex: {
        const { depth, tabIndex } = decodeSetTabIndex(c);
        if (!displayList.has(depth)) {
          c.emit(Codes.SETTABINDEX_NO_CHARACTER, 'info', `SetTabIndex at empty depth ${depth} ignored`);
        }
        ops.push({ kind: 'tabIndex', index: ops.length, depth, tabIndex, tagOffset: ref.offset });
        break;
      }
      case Tag.FrameLabel: {
        const { name, namedAnchor } = decodeFrameLabel(c);
        const at = frames.length;
        if (labels.has(name)) {
          c.emit(
            Codes.FRAME_LABEL_DUPLICATE,
            'warning',
            `frame label "${name}" appears again at frame ${at}; the first wins`,
          );
        } else {
          labels.set(name, at);
        }
        label = label ?? name;
        options.onFrameLabel?.(name, namedAnchor, at);
        break;
      }
      case Tag.DoAction:
        actions.push({ offset: ref.offset, length: ref.length });
        break;
      case Tag.StartSound:
      case Tag.StartSound2: {
        const event = decodeStartSound(c, ref.code === Tag.StartSound2, options.soundChannels);
        soundEvents.push({ ...event, tagOffset: ref.offset });
        break;
      }
      case Tag.SoundStreamHead:
      case Tag.SoundStreamHead2: {
        if (currentSpan !== null) {
          c.emit(Codes.SOUND_STREAM_SPLIT, 'info', 'new SoundStreamHead starts a separate audio segment');
        }
        const head = decodeSoundStreamHead(c, ref.code as 18 | 45);
        currentSpan = { headTag: ref, head, blockTags: [], blocks: [], sampleCount: 0 };
        spans.push(currentSpan);
        break;
      }
      case Tag.SoundStreamBlock:
        if (currentSpan === null) {
          c.emit(Codes.STREAM_SOUND_OUT_OF_ORDER, 'warning', 'SoundStreamBlock with no preceding SoundStreamHead');
        } else {
          currentSpan.blockTags.push(ref);
          const block = decodeSoundStreamBlock(c, currentSpan.head.format);
          const sampleCount = block.sampleCount ?? currentSpan.head.sampleCount;
          const firstBlock = currentSpan.blocks.length === 0;
          currentSpan.blocks.push({
            tag: ref,
            frameIndex: frames.length,
            sampleOffset: currentSpan.sampleCount,
            sampleCount,
            seekSamples: block.seekSamples,
            dataOffset: block.dataOffset,
            dataLength: block.data.length,
          });
          currentSpan.sampleCount += sampleCount;
          if (firstBlock && currentSpan.head.format === 2) {
            if (currentSpan.head.latencySeek === null || currentSpan.head.latencySeek !== block.seekSamples) {
              c.emit(
                Codes.SOUND_LATENCY_SEEK_MISMATCH,
                'warning',
                `LatencySeek ${currentSpan.head.latencySeek ?? 'absent'} differs from first block SeekSamples ${block.seekSamples ?? 'absent'}; first block wins`,
              );
            }
          }
          inspectStreamSoundBlock(c, currentSpan.head, block, sampleCount);
        }
        if (soundStreamBlock === null) soundStreamBlock = { offset: ref.offset, length: ref.length };
        break;
      case Tag.VideoFrame:
        videoFrames.push(ref);
        break;
      case Tag.DefineSceneAndFrameLabelData: {
        // Main-timeline scene data is consumed by the model layer (`collectControl`); only the
        // in-sprite form is handled here, per `IMPL-040-R013`.
        if (ref.inSprite !== null && implicitScene === null) {
          const data = decodeSceneAndFrameLabelData(c);
          implicitScene = { name: data.scenes[0]?.name ?? '' };
          c.emit(
            Codes.SCENE_DATA_INCONSISTENT,
            'warning',
            `DefineSceneAndFrameLabelData inside sprite ${ref.inSprite}; recorded as a single implicit scene`,
          );
        }
        break;
      }
      default:
        // Definitions, sprite headers and tags owned by other docs are not frame operations.
        break;
    }
  }

  // A `FrameLabel` after the final `ShowFrame` names the frame that ShowFrame is about to show
  // (`IMPL-040-R008`: a label associates its name with the *next* `ShowFrame`). Push that frame —
  // empty — so the `labels` entry resolves to a real frame, instead of retroactively renaming the
  // previous one (P2-RESOLUTION-AUDIT R-P2-09).
  if (
    ops.length > 0 ||
    actions.length > 0 ||
    videoFrames.length > 0 ||
    soundEvents.length > 0 ||
    soundStreamBlock !== null ||
    label !== null
  ) {
    pushFrame();
  }

  const observedFrameCount = frames.length;
  const declared = options.declaredFrameCount ?? null;
  if (options.padToDeclared === true && declared !== null) {
    while (frames.length < declared) frames.push(emptyFrame(frames.length));
  }

  const first = spans[0];
  return {
    frames,
    labels,
    sounds: first ? { head: first.headTag, blocks: spans.flatMap((span) => span.blockTags) } : null,
    streamSoundSpans: spans,
    implicitScene,
    declaredFrameCount: declared,
    observedFrameCount,
  };
}
