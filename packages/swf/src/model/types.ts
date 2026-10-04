/**
 * Model types — `CMP` §3 (the design contract) and `IMPL-030` §7/§8, `IMPL-040` §5 (the decoder's
 * view of the same structures).
 *
 * The model is the *only* thing later stages consume: encoders and the runtime never re-read SWF
 * bytes (`IMPL-020-R005`). Types here are data-only and readonly; assembly functions live in
 * `timeline.ts` and `movie.ts`.
 */

import type { TagRef } from '../container/tag-stream.js';
import type { Rect } from '../io/types.js';
import type { FileAttributesInfo } from '../tags/control.js';
import type { ActionBlockRef, PlacementOp, RemovalOp } from '../tags/place.js';

/** `FIXED8_8` as a branded alias, per `CMP` §3 — the raw 8.8 value, not a float. */
export type Fixed8_8 = number;

/** `SetTabIndex` (66) inside a frame's op list (`IMPL-030` §7, `IMPL-040-R043`). */
export interface SetTabIndexOp {
  readonly kind: 'tabIndex';
  readonly index: number;
  readonly depth: number;
  readonly tabIndex: number;
  readonly tagOffset: number;
}

/** Everything a frame can do to the display list, in file order (`IMPL-030-R031`). */
export type DisplayOp = PlacementOp | RemovalOp | SetTabIndexOp;

export interface FrameModel {
  readonly index: number;
  /** Placements, removals and tab-index ops interleaved in file order. */
  readonly ops: readonly DisplayOp[];
  /** `DoAction` blocks in file order; the AVM1 front end splits them (doc 050). */
  readonly actions: readonly ActionBlockRef[];
  /** From `FrameLabel` (43); the tag names the frame it appears in. */
  readonly label: string | null;
  /** First `SoundStreamBlock` (19) inside this frame, as a byte range. */
  readonly soundStreamBlock: { readonly offset: number; readonly length: number } | null;
  readonly videoFrames: readonly TagRef[];
}

/** One `SoundStreamHead*` (18/45) with the `SoundStreamBlock`s (19) that follow it. */
export interface StreamSoundSpan {
  readonly headTag: TagRef;
  readonly blockTags: readonly TagRef[];
}

export interface StreamSoundModel {
  readonly head: TagRef;
  readonly blocks: readonly TagRef[];
}

export interface TimelineModel {
  readonly frames: readonly FrameModel[];
  /** label → frame index; the first occurrence wins (`SF0153` reports duplicates). */
  readonly labels: ReadonlyMap<string, number>;
  /** The first stream-sound span, in the shape `CMP` §3 names. */
  readonly sounds: StreamSoundModel | null;
  /** All spans, including the ones inside sprites (`IMPL-030` §8). */
  readonly streamSoundSpans: readonly StreamSoundSpan[];
  /** Declared frame count (movie header or `DefineSprite`), when known. */
  readonly declaredFrameCount: number | null;
  readonly observedFrameCount: number;
}

export interface SpriteModel {
  readonly characterId: number;
  readonly declaredFrameCount: number;
  readonly timeline: TimelineModel;
  /** This sprite's slice of the tag index (the `DefineSprite` tag itself excluded). */
  readonly tags: readonly TagRef[];
  /** Export name, else `sprite_<id>` — a *character* name, never the instance name. */
  readonly characterName: string;
  readonly streamSoundSpans: readonly StreamSoundSpan[];
}

export type CharacterKind =
  | 'shape'
  | 'shape4'
  | 'morphShape'
  | 'sprite'
  | 'button'
  | 'text'
  | 'editText'
  | 'font'
  | 'font2'
  | 'font3'
  | 'font4'
  | 'bitmap'
  | 'bitmapLossless'
  | 'sound'
  | 'video'
  | 'binaryData'
  | 'unknown'
  | 'missing';

/** A dictionary entry or a placement-created missing-character placeholder. */
export interface CharacterModel {
  readonly id: number;
  readonly kind: CharacterKind;
  readonly tagCode: number | null;
  readonly tagName: string;
  readonly index: TagRef | null;
  readonly sprite: SpriteModel | null;
}

export interface StageModel {
  readonly widthTwips: number;
  readonly heightTwips: number;
  readonly frameRate: Fixed8_8;
}

export interface FileAttributesModel extends FileAttributesInfo {
  /** The tag this came from, so a report can name it (`IMPL-040-R043`). */
  readonly origin: TagRef;
}

export interface InitActionBlock {
  readonly spriteId: number;
  readonly block: ActionBlockRef;
  readonly index: TagRef;
}

export interface ImportEntry {
  readonly url: string;
  /** Local alias (the name inside this movie). */
  readonly name: string;
  /** Character id the alias maps to locally. */
  readonly localId: number;
  /** False until a resolver matches the URL against another movie. */
  readonly applied: boolean;
}

export interface MovieControlModel {
  /** 0xRRGGBB; `0xFFFFFF` when no tag set it. */
  readonly background: number;
  readonly backgroundSource: 'default' | 'tag';
  readonly backgroundChanges: readonly { readonly frame: number; readonly rgb: number }[];
  readonly scenes: readonly { readonly name: string; readonly frameOffset: number }[];
  /** Control tag label sequence in file order; duplicates and scene-data entries are retained. */
  readonly labelEntries: readonly { readonly name: string; readonly frame: number; readonly namedAnchor: boolean }[];
  /** Compact scene-relative to absolute mapping: `absolute = frameOffset + sceneFrame`. */
  readonly sceneFrameRemap: readonly {
    readonly sceneIndex: number;
    readonly frameOffset: number;
    readonly frameCount: number;
  }[];
  /** Every label on the main timeline, in file order; duplicates kept. */
  readonly labels: ReadonlyMap<string, readonly { readonly frame: number; readonly namedAnchor: boolean }[]>;
  readonly exports: ReadonlyMap<string, number>;
  readonly exportsById: ReadonlyMap<number, string>;
  readonly rootClassName: string | null;
  readonly imports: readonly ImportEntry[];
  readonly scalingGrids: ReadonlyMap<number, Rect>;
  readonly tabIndexOps: readonly SetTabIndexOp[];
  readonly scriptLimits: { readonly maxRecursionDepth: number | null; readonly scriptTimeout: number | null };
  readonly attributes: FileAttributesModel | null;
  /** `Metadata` (77) as `{ xmp }`; empty when the tag is absent. */
  readonly metadata: Readonly<Record<string, string>>;
}

/** One SWF file, ready for the pipeline (`CMP` §3, `IMPL-040-R043`). */
export interface MovieModel {
  /** Content-hash-derived stable id (`sha256:<hex>` when the caller supplied one). */
  readonly id: string;
  readonly stage: StageModel;
  readonly frameCount: number;
  readonly background: number;
  readonly characters: ReadonlyMap<number, CharacterModel>;
  /** Export name → character id. */
  readonly exported: ReadonlyMap<string, number>;
  readonly mainTimeline: TimelineModel;
  readonly initActions: readonly InitActionBlock[];
  readonly metadata: Readonly<Record<string, string>>;
  readonly control: MovieControlModel;
}
