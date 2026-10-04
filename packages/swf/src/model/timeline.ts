/**
 * Frame/timeline assembly — `IMPL-030` §7.
 *
 * Assembly is a pure function of the tag index: it reads tag bodies through fresh cursors and never
 * mutates the file (`IMPL-030-R032`). `ShowFrame` (1) closes a frame; a trailing group of ops with no
 * `ShowFrame` after it still forms a frame. The declared `FrameCount` pads the main timeline
 * (`IMPL-030-R033`): the header value wins there, the observed count wins inside sprites.
 */

import type { SwfFile } from '../container/open.js';
import type { TagRef } from '../container/tag-stream.js';
import { Codes } from '../diagnostics/codes.js';
import { Cursor } from '../io/cursor.js';
import { decodeFrameLabel, decodeSetTabIndex } from '../tags/control.js';
import {
  decodePlaceObject,
  decodePlaceObject2,
  decodePlaceObject3,
  decodeRemoveObject,
  decodeRemoveObject2,
  type ActionBlockRef,
} from '../tags/place.js';
import { Tag, tagName } from '../tags/tag-codes.js';
import type { DisplayOp, FrameModel, StreamSoundSpan, TimelineModel } from './types.js';

export interface AssembleTimelineOptions {
  /** Declared frame count for this level (movie header or `DefineSprite`). */
  readonly declaredFrameCount?: number | null;
  /** Append empty frames until `declaredFrameCount` is reached (main timeline only). */
  readonly padToDeclared?: boolean;
  readonly mode?: 'soft' | 'strict';
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

function emptyFrame(index: number): FrameModel {
  return { index, ops: [], actions: [], label: null, soundStreamBlock: null, videoFrames: [] };
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

  let ops: DisplayOp[] = [];
  let actions: ActionBlockRef[] = [];
  let label: string | null = null;
  let soundStreamBlock: { offset: number; length: number } | null = null;
  let videoFrames: TagRef[] = [];
  let currentSpan: { headTag: TagRef; blockTags: TagRef[] } | null = null;

  const pushFrame = (): void => {
    frames.push({
      index: frames.length,
      ops,
      actions,
      label,
      soundStreamBlock,
      videoFrames,
    });
    ops = [];
    actions = [];
    label = null;
    soundStreamBlock = null;
    videoFrames = [];
  };

  for (const ref of refs) {
    const c = openTagCursor(file, ref, mode);
    switch (ref.code) {
      case Tag.ShowFrame:
        pushFrame();
        break;
      case Tag.PlaceObject:
        ops.push(decodePlaceObject(c, ops.length, ref.offset));
        break;
      case Tag.PlaceObject2:
        ops.push(decodePlaceObject2(c, ops.length, ref.offset));
        break;
      case Tag.PlaceObject3:
        ops.push(decodePlaceObject3(c, ops.length, ref.offset));
        break;
      case Tag.RemoveObject:
        ops.push(decodeRemoveObject(c, ops.length, ref.offset));
        break;
      case Tag.RemoveObject2:
        ops.push(decodeRemoveObject2(c, ops.length, ref.offset));
        break;
      case Tag.SetTabIndex: {
        const { depth, tabIndex } = decodeSetTabIndex(c);
        ops.push({ kind: 'tabIndex', index: ops.length, depth, tabIndex, tagOffset: ref.offset });
        break;
      }
      case Tag.FrameLabel: {
        const { name, namedAnchor } = decodeFrameLabel(c);
        const at = frames.length;
        if (labels.has(name)) {
          c.emit(Codes.FRAME_LABEL_DUPLICATE, 'warning', `frame label "${name}" appears again at frame ${at}; the first wins`);
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
      case Tag.SoundStreamHead:
      case Tag.SoundStreamHead2:
        currentSpan = { headTag: ref, blockTags: [] };
        spans.push(currentSpan);
        break;
      case Tag.SoundStreamBlock:
        if (currentSpan === null) {
          c.emit(Codes.STREAM_SOUND_OUT_OF_ORDER, 'warning', 'SoundStreamBlock with no preceding SoundStreamHead');
        } else {
          currentSpan.blockTags.push(ref);
        }
        if (soundStreamBlock === null) soundStreamBlock = { offset: ref.offset, length: ref.length };
        break;
      case Tag.VideoFrame:
        videoFrames.push(ref);
        break;
      default:
        // Definitions, sprite headers and tags owned by other docs are not frame operations.
        break;
    }
  }

  if (ops.length > 0 || actions.length > 0 || videoFrames.length > 0 || soundStreamBlock !== null) {
    pushFrame();
  } else if (label !== null && frames.length > 0) {
    // A `FrameLabel` at the very start of a frame names the frame the previous `ShowFrame` opened.
    const last = frames[frames.length - 1];
    if (last && last.label === null) frames[frames.length - 1] = { ...last, label };
  }

  const declared = options.declaredFrameCount ?? null;
  if (options.padToDeclared === true && declared !== null) {
    while (frames.length < declared) frames.push(emptyFrame(frames.length));
  }

  const first = spans[0];
  return {
    frames,
    labels,
    sounds: first
      ? { head: first.headTag, blocks: spans.flatMap((span) => span.blockTags) }
      : null,
    streamSoundSpans: spans,
    declaredFrameCount: declared,
    observedFrameCount: frames.length,
  };
}
