/**
 * Model types — `CMP` §3 (the design contract) and `IMPL-030` §7/§8, `IMPL-040` §5 (the decoder's
 * view of the same structures).
 *
 * The model is the *only* thing later stages consume: encoders and the runtime never re-read SWF
 * bytes (`IMPL-020-R005`). Types here are data-only and readonly; assembly functions live in
 * `timeline.ts` and `movie.ts`.
 */

import type { TagRef } from '../container/tag-stream.js';
import type { Cxform, Mat2D, Rect } from '../io/types.js';
import type { FileAttributesInfo, PasswordState } from '../tags/control.js';
import type { ActionBlockRef, PlacementOp, RemovalOp } from '../tags/place.js';
import type { FilterSpec } from '../tags/filters.js';
import type { VectorShape } from '../tags/shape.js';
import type { BitmapAssetModel } from '../tags/images.js';
import type { DefineFontModel } from '../tags/fonts.js';
import type { MorphShapeModel } from '../tags/morph.js';
import type { EditTextModel, StaticTextModel } from '../tags/text.js';
import type { DefineSoundModel, SoundStreamHeadModel, TimelineSoundEvent } from '../tags/sounds.js';

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
  /** `StartSound` and `StartSound2` scheduling records authored in this frame. */
  readonly soundEvents: readonly TimelineSoundEvent[];
}

/** One `SoundStreamHead*` (18/45) with the `SoundStreamBlock`s (19) that follow it. */
export interface StreamSoundBlockRecord {
  readonly tag: TagRef;
  /** Zero-based frame index containing this block, including empty/silent blocks. */
  readonly frameIndex: number;
  readonly sampleOffset: number;
  readonly sampleCount: number;
  readonly seekSamples: number | null;
  readonly dataOffset: number;
  readonly dataLength: number;
}

export interface StreamSoundSpan {
  readonly headTag: TagRef;
  readonly head: SoundStreamHeadModel;
  readonly blockTags: readonly TagRef[];
  readonly blocks: readonly StreamSoundBlockRecord[];
  readonly sampleCount: number;
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
  /**
   * Scene data found inside a sprite — recorded as a single implicit scene covering this
   * timeline (`IMPL-040-R013`, `SF0169`). Always `null` on the main timeline (its scene data is
   * normalised into `MovieControlModel.scenes`).
   */
  readonly implicitScene: { readonly name: string } | null;
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

export type ButtonState = 'up' | 'over' | 'down' | 'hitTest';

export interface ButtonConditions {
  readonly idleToOverUp: boolean;
  readonly overUpToIdle: boolean;
  readonly overUpToOverDown: boolean;
  readonly overDownToOverUp: boolean;
  readonly outDownToOverDown: boolean;
  readonly overDownToOutDown: boolean;
  readonly outDownToIdle: boolean;
  readonly idleToOverDown: boolean;
  readonly overDownToIdle: boolean;
}

export interface ButtonRecord {
  readonly states: readonly ButtonState[];
  readonly depth: number;
  readonly characterId: number;
  readonly matrix: Mat2D;
  readonly cxform: Cxform | null;
  readonly blendMode: number | null;
  readonly filters: readonly FilterSpec[] | null;
  readonly rawFlags: number;
  readonly tagOffset: number;
}

export interface ButtonActionRecord {
  readonly conditions: ButtonConditions;
  readonly rawConditionWord: number;
  readonly keyCode: number | null;
  readonly actionBytes: ActionBlockRef;
  readonly tagOffset: number;
  readonly origin: TagRef;
}

export interface ButtonSoundInfo {
  readonly rawFlags: number;
  readonly reserved: number;
  readonly syncStop: boolean;
  readonly syncNoMultiple: boolean;
  readonly inPoint: number | null;
  readonly outPoint: number | null;
  readonly loopCount: number | null;
  readonly envelope: readonly {
    readonly position44: number;
    readonly leftLevel: number;
    readonly rightLevel: number;
  }[];
}

export interface ButtonSoundRecord {
  readonly transition: 'overUpToIdle' | 'idleToOverUp' | 'overUpToOverDown' | 'overDownToOverUp';
  readonly soundId: number;
  readonly info: ButtonSoundInfo | null;
}

export interface ButtonModel {
  readonly id: number;
  readonly version: 1 | 2;
  readonly trackAsMenu: boolean;
  readonly records: readonly ButtonRecord[];
  readonly characterCxform: Cxform | null;
  readonly actions: readonly ButtonActionRecord[];
  readonly sounds: readonly ButtonSoundRecord[];
  /** Resolved hit-area bounds in the button's local coordinate space. */
  readonly hitArea: Rect | null;
  /** Explicit hitTest geometry wins; otherwise up-state geometry is used. */
  readonly hitAreaSource: 'hitTest' | 'up' | null;
  /** Ch.12 keyPress conditions fire without input focus. */
  readonly keyPressRequiresFocus: false;
  readonly origin: TagRef;
}

export interface CharacterAlias {
  readonly sourceMovieId: string;
  readonly sourceId: number;
}

export type CharacterKind =
  | 'shape'
  | 'shape4'
  | 'morphShape'
  | 'sprite'
  | 'button'
  | 'imported'
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
  readonly button: ButtonModel | null;
  /** Decoded shape-local bounds; morph bounds are retained even before morph IR is assembled. */
  readonly bounds: Rect | null;
  /** Production vector IR for static DefineShape(1–4) tags; media rasterisation stays lazy. */
  readonly vectorShape: VectorShape | null;
  /** Paired start/end vector geometry for morph characters; Ratio remains placement-owned. */
  readonly morph: MorphShapeModel | null;
  /** Decoded bitmap tag header and zero-copy compressed payload; pixel decoding stays in `packages/assets`. */
  readonly bitmap: BitmapAssetModel | null;
  /** DefineFont2/3 outlines, code mappings and authored metrics; rasterisation stays in `packages/assets`. */
  readonly font: DefineFontModel | null;
  /** Authored static glyph runs; advances/matrices stay authoritative and no layout is recomputed. */
  readonly text: StaticTextModel | null;
  /** Editable text flags/fields are preserved for later runtime-owned layout. */
  readonly editText: EditTextModel | null;
  /** Decoded DefineSound header and zero-copy payload view; codec decoding remains lazy. */
  readonly sound: DefineSoundModel | null;
  /** Imported characters alias another movie's dictionary entry without copying its payload. */
  readonly alias: CharacterAlias | null;
  /**
   * The `binary` asset of a `DefineBinaryData` character — the payload as bytes, never a string
   * (`IMPL-040-R038`, SEC-R003). `null` for every other kind (and for `missing` placeholders).
   */
  readonly bytes: Uint8Array | null;
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
  /** True only when the supplied input set resolves this alias to a source character. */
  readonly applied: boolean;
  /** Stable content id and dictionary id of the terminal source, null when unresolved. */
  readonly sourceMovieId: string | null;
  readonly sourceId: number | null;
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
  /**
   * Rects shadowed by a repeated `DefineScalingGrid` for the same character (the last one wins in
   * `scalingGrids`; the shadowed rects are reported, `IMPL-040-R028`).
   */
  readonly scalingGridsShadowed: readonly { readonly characterId: number; readonly rect: Rect }[];
  readonly tabIndexOps: readonly SetTabIndexOp[];
  readonly scriptLimits: { readonly maxRecursionDepth: number | null; readonly scriptTimeout: number | null };
  readonly attributes: FileAttributesModel | null;
  /** `Metadata` (77) as `{ xmp }`; empty when the tag is absent. */
  readonly metadata: Readonly<Record<string, string>>;
  /** `Protect` (24) state: present/absent + digest, never the password text (`IMPL-040-R039`). */
  readonly protect: PasswordState | null;
  /** `EnableDebugger` (58, `version: 1`) / `EnableDebugger2` (64, `version: 2`) — recorded, inert. */
  readonly debugger: {
    readonly version: 1 | 2;
    readonly reserved: number | null;
    readonly passwordPresent: boolean;
    readonly digest: string | null;
  } | null;
  /** `EnableTelemetry` (93) — telemetry opt-in; hash redacted to a digest (`IMPL-040-R041`). */
  readonly telemetry: {
    readonly reserved: number;
    readonly hashPresent: boolean;
    readonly digest: string | null;
  } | null;
  /** `DefineBinaryData` (87) assets: size + digest, the bytes stay in the tag payload (`SEC-R003`). */
  readonly binaryData: readonly {
    readonly characterId: number;
    readonly reserved: number;
    readonly length: number;
    readonly digest: string;
  }[];
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
