/**
 * Block scheduling contract for doc 130 (IMPL-050 §3.3/§3.4, R009–R015, WP-050-12).
 *
 * The front end hands the runtime a single *schedule*: the frame scripts (in tag order per frame)
 * and the init scripts (a movie-level, once-only list with a per-frame "before this frame" flag).
 * Doc 130 MUST run frame scripts at the `ShowFrame` boundary, in tag order, after that frame's
 * display-list ops (R009), and MUST run each init script once — before the normal actions of the
 * frame in which its `DoInitAction` tag appears, and before implicit sprite creation (R012).
 * Revisiting a frame never re-runs its init scripts (R014).
 */

import { Tag } from '@swf-forge/swf';
import type { ActionBlockRef, MovieModel, SwfFile } from '@swf-forge/swf';

/** One frame script (`DoAction`), in its frame's tag order. */
export interface FrameScriptEntry {
  /** The frame index (0-based) whose `ShowFrame` boundary runs this script. */
  readonly frame: number;
  readonly block: ActionBlockRef;
  /** Position within the frame's tag order (0-based). */
  readonly order: number;
}

/** One init script (`DoInitAction`), once-only at movie level. */
export interface InitScriptEntry {
  readonly spriteId: number;
  readonly block: ActionBlockRef;
  /** The frame in which the tag appears; the script runs before that frame's normal actions. */
  readonly frame: number;
  /** Movie-level execution index (the order doc 130's boot sequence consumes). */
  readonly initOrder: number;
  /** `true` when this is the 2nd+ `DoInitAction` for the sprite (`SF0421`). */
  readonly duplicate: boolean;
  /** `true` when the sprite id is not in the dictionary (`SF0422`, dropped). */
  readonly unknownSprite: boolean;
}

export interface ActionSchedule {
  readonly frameScripts: readonly FrameScriptEntry[];
  readonly initScripts: readonly InitScriptEntry[];
  /** sprite id → the initOrder indices for its scripts (in execution order). */
  readonly initBySprite: ReadonlyMap<number, readonly number[]>;
}

/**
 * Builds the schedule from the movie model. Frame scripts come from `mainTimeline.frames[].actions`
 * (already in file order). Init scripts come from `model.initActions` (file order); their frame is
 * recovered by walking the top-level tag stream and counting `ShowFrame` boundaries.
 *
 * Diagnostics: `SF0421` for a 2nd+ `DoInitAction` per sprite, `SF0422` for an unknown sprite id.
 */
export function buildActionSchedule(file: SwfFile, model: MovieModel, emit: EmitFn): ActionSchedule {
  const frameScripts: FrameScriptEntry[] = [];
  for (const frame of model.mainTimeline.frames) {
    frame.actions.forEach((block, order) => {
      frameScripts.push({ frame: frame.index, block, order });
    });
  }

  const frameByTagIndex = topLevelFrameByTag(file);

  const seenBySprite = new Map<number, number>();
  const initScripts: InitScriptEntry[] = [];
  const initBySprite = new Map<number, number[]>();
  let initOrder = 0;
  for (const entry of model.initActions) {
    const frame = frameByTagIndex.get(entry.index.index) ?? 0;
    const seen = seenBySprite.get(entry.spriteId) ?? 0;
    seenBySprite.set(entry.spriteId, seen + 1);
    const duplicate = seen >= 1;
    const unknownSprite = model.characters.get(entry.spriteId) === undefined;
    if (duplicate) {
      emit(
        'SF0421',
        'warning',
        `more than one DoInitAction for sprite ${entry.spriteId}; all run in tag order`,
        entry.index.headerOffset,
      );
    }
    if (unknownSprite) {
      emit(
        'SF0422',
        'warning',
        `DoInitAction for unknown sprite id ${entry.spriteId}; dropped`,
        entry.index.headerOffset,
      );
    }
    const myOrder = initOrder;
    initOrder += 1;
    initScripts.push({
      spriteId: entry.spriteId,
      block: entry.block,
      frame,
      initOrder: myOrder,
      duplicate,
      unknownSprite,
    });
    const list = initBySprite.get(entry.spriteId);
    if (list === undefined) initBySprite.set(entry.spriteId, [myOrder]);
    else list.push(myOrder);
  }

  return { frameScripts, initScripts, initBySprite };
}

/**
 * The frame index each top-level (depth 0, not-in-sprite) tag belongs to, keyed by the tag's index
 * into the tag stream. A `ShowFrame` (1) starts a new frame; tags before the first `ShowFrame` are
 * frame 0.
 */
function topLevelFrameByTag(file: SwfFile): Map<number, number> {
  const out = new Map<number, number>();
  let frame = 0;
  let seenFirstShowFrame = false;
  for (const tag of file.tagIndex.tags) {
    if (tag.depth !== 0 || tag.inSprite !== null) continue;
    if (tag.code === Tag.ShowFrame) {
      if (seenFirstShowFrame) frame += 1;
      seenFirstShowFrame = true;
    }
    out.set(tag.index, frame);
  }
  return out;
}

export type EmitFn = (
  code: string,
  severity: 'error' | 'warning' | 'info',
  message: string,
  offset: number,
  context?: string,
) => void;
