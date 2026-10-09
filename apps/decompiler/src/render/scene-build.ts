/**
 * Static-scene builder — `MovieModel` → `StaticScene` (`IMPL-130` §5.1, `T-GFX-070`).
 *
 * P4 renders *no-script* movies, so the whole timeline can be walked at build time:
 *
 * - each timeline (the main one and every sprite) is stepped frame by frame with `applyOps`, giving
 *   one display-list snapshot per frame;
 * - every sprite instance keeps its own playhead: a sprite placed while the parent showed frame `p`
 *   displays its local frame `(parentFrame - p) mod spriteFrameCount`, and nested sprites recurse on
 *   that local frame;
 * - `clipDepth` becomes a clip range over depths (`collectDrawItems` semantics: a masker bounds-clips
 *   the entries in `(depth, clipDepth]`, and is not itself drawn), which is the bounds-rect
 *   approximation `T-GFX-015` tracks for the real stencil upgrade;
 * - `_visible = false` placements are pruned (`IMPL-130-R009` lets *scripts* keep running; there is
 *   none here, so pruning is exact).
 *
 * The builder refuses movies with action blocks: those need the live display list P7 provides, and a
 * silently-wrong static frame is worse than a refusal (`TECH-R029`).
 */

import {
  IDENTITY,
  SceneFormatError,
  sceneDrawItems,
  shapeClip,
  intersectClip,
  serializeStaticScene,
  STATIC_SCENE_FORMAT,
  STATIC_SCENE_VERSION,
  type ClipRect,
  type CxformLike,
  type DisplayEntry,
  type ShapeGeometry,
  type StaticScene,
  type StaticSceneItem,
  type TimelineOpLike,
  type Transform2D,
} from '@swf-forge/gfx';
import { applyOps, multiply } from '@swf-forge/gfx';
import type { CharacterModel, MovieModel, SpriteModel, TimelineModel } from '@swf-forge/swf';

import { matrixToTransform, shapeToGeometry, unsupportedPaintCount } from './vector-ir.js';

export interface BuildStaticSceneOptions {
  /** Cap on rendered frames (fixtures stay small; the CLI exposes `--frames`). */
  readonly maxFrames?: number;
}

export interface BuildStaticSceneResult {
  readonly scene: StaticScene;
  /** Analysis for the render manifest; never affects the pixels. */
  readonly report: {
    readonly frames: number;
    readonly items: number;
    readonly shapes: number;
    readonly sprites: number;
    readonly unsupportedPaints: number;
    readonly maxNesting: number;
  };
}

/** A display list plus the frame each depth's instance was (re)placed at — the instance playhead. */
interface TimelineState {
  readonly entries: readonly DisplayEntry[];
  readonly starts: ReadonlyMap<number, number>;
}

export function buildStaticScene(model: MovieModel, options: BuildStaticSceneOptions = {}): BuildStaticSceneResult {
  const actionBlocks =
    model.mainTimeline.frames.reduce((sum, frame) => sum + frame.actions.length, 0) + model.initActions.length;
  if (actionBlocks > 0) {
    throw new SceneFormatError(
      `movie ${model.id} has ${actionBlocks} action block(s): static rendering is P4 scope, scripted playback is P7`,
    );
  }
  for (const character of model.characters.values()) {
    if (character.sprite && spriteActions(character.sprite) > 0) {
      throw new SceneFormatError(
        `sprite ${character.id} has action blocks; static rendering is P4 scope (P7 runs them)`,
      );
    }
  }

  const geometries = new Map<string, ShapeGeometry>();
  let unsupportedPaints = 0;
  let sprites = 0;
  let maxNesting = 0;
  const stateCache = new Map<TimelineModel, TimelineState[]>();

  function geometryFor(character: CharacterModel): ShapeGeometry | null {
    if (!character.vectorShape) return null;
    const id = `shape-${character.id}`;
    const existing = geometries.get(id);
    if (existing) return existing;
    const geometry = shapeToGeometry(id, character.vectorShape);
    geometries.set(id, geometry);
    unsupportedPaints += unsupportedPaintCount(character.vectorShape);
    return geometry;
  }

  /** Steps a timeline forward, caching one state per frame index (`GFX` §3.3 keeps the list order). */
  function statesFor(timeline: TimelineModel, frames: number): TimelineState[] {
    const cached = stateCache.get(timeline);
    if (cached && cached.length >= frames) return cached;
    const states: TimelineState[] = [];
    let entries: DisplayEntry[] = [];
    const starts = new Map<number, number>();
    for (let frame = 0; frame < frames; frame += 1) {
      const model = timeline.frames[frame];
      const ops: TimelineOpLike[] = model
        ? model.ops.map((op) =>
            op.kind === 'place'
              ? {
                  kind: 'place' as const,
                  depth: op.depth,
                  move: op.move,
                  characterId: op.characterId ?? null,
                  // Twips → stage px once, at the one boundary that owns the conversion
                  // (`GFX-R017`): everything downstream is stage pixels.
                  matrix: op.matrix ? matrixToTransform(op.matrix) : null,
                  cxform: op.cxform ?? null,
                  clipDepth: op.clipDepth ?? null,
                  visible: op.visible ?? null,
                }
              : { kind: 'remove' as const, depth: op.depth },
          )
        : [];
      for (const op of model?.ops ?? []) {
        if (op.kind === 'place') starts.set(op.depth, frame);
        if (op.kind === 'remove') starts.delete(op.depth);
      }
      entries = applyOps(entries, ops);
      states.push({ entries, starts: new Map(starts) });
    }
    stateCache.set(timeline, states);
    return states;
  }

  function flatten(
    states: TimelineState[],
    frameIndex: number,
    transform: Transform2D,
    cxform: CxformLike | null,
    clip: ClipRect | null,
    depthLimit: number,
    nesting: number,
    visiting: ReadonlySet<number>,
    out: StaticSceneItem[],
  ): void {
    const state = states[frameIndex];
    if (!state) return;
    let maskClip: ClipRect | null = null;
    let maskEndDepth: number | null = null;
    for (const entry of state.entries) {
      if (maskEndDepth !== null && entry.depth > maskEndDepth) {
        maskClip = null;
        maskEndDepth = null;
      }
      if (!entry.visible || entry.characterId === null) continue;
      const character = model.characters.get(entry.characterId);
      if (!character) continue;
      const matrix = multiply(transform, entry.matrix);
      const effectiveCxform = entry.cxform ?? cxform;
      const effectiveClip = maskClip ? intersectClip(clip, maskClip) : clip;
      const geometry = geometryFor(character);

      if (entry.clipDepth !== null) {
        maskClip = geometry ? shapeClip(geometry, matrix) : null;
        maskEndDepth = entry.clipDepth;
        continue; // the masker defines the clip; it is not drawn
      }

      if (geometry) {
        out.push({
          shape: geometry.id,
          matrix,
          cxform: effectiveCxform ?? null,
          clip: effectiveClip,
          depth: entry.depth,
        });
        continue;
      }
      if (character.sprite) {
        // A sprite that contains itself is illegal (`SF0103` caps real nesting at 32); refusing to
        // recurse keeps the builder from hanging on a corrupt file.
        if (visiting.has(character.id) || depthLimit <= 0) continue;
        sprites += 1;
        const nextNesting = nesting + 1;
        maxNesting = Math.max(maxNesting, nextNesting);
        const spriteFrames = Math.max(1, spriteFrameCount(character.sprite));
        const started = state.starts.get(entry.depth) ?? frameIndex;
        const local = modulo(frameIndex - started, spriteFrames);
        const nested = statesFor(character.sprite.timeline, spriteFrames);
        const nextVisiting = new Set(visiting);
        nextVisiting.add(character.id);
        flatten(nested, local, matrix, effectiveCxform, effectiveClip, depthLimit - 1, nextNesting, nextVisiting, out);
      }
    }
  }

  const frameCount = Math.max(0, Math.min(model.frameCount, options.maxFrames ?? Number.MAX_SAFE_INTEGER));
  const mainStates = statesFor(model.mainTimeline, Math.max(1, frameCount));
  const frames: StaticSceneItem[][] = [];
  let items = 0;
  for (let frame = 0; frame < frameCount; frame += 1) {
    const collected: StaticSceneItem[] = [];
    flatten(mainStates, frame, IDENTITY, null, null, 32, 0, new Set<number>(), collected);
    items += collected.length;
    frames.push(collected);
  }

  const scene: StaticScene = {
    format: STATIC_SCENE_FORMAT,
    formatVersion: STATIC_SCENE_VERSION,
    id: model.id,
    scripted: false,
    stage: {
      width: model.stage.widthTwips / 20,
      height: model.stage.heightTwips / 20,
      background: model.background,
      frameRate: model.stage.frameRate,
    },
    frameCount: frames.length,
    shapes: [...geometries.values()],
    frames,
  };

  return {
    scene,
    report: {
      frames: frames.length,
      items,
      shapes: geometries.size,
      sprites,
      unsupportedPaints,
      maxNesting,
    },
  };
}

/** Serialised scene for the CLI/demo: deterministic JSON (`REPO-R015`). */
export function sceneJson(scene: StaticScene): string {
  return serializeStaticScene(scene);
}

/** Draw items of one frame, for the CPU reference renderer. */
export function frameItems(scene: StaticScene, frameIndex: number): ReturnType<typeof sceneDrawItems> {
  return sceneDrawItems(scene, frameIndex);
}

function spriteFrameCount(sprite: SpriteModel): number {
  return sprite.declaredFrameCount > 0 ? sprite.declaredFrameCount : sprite.timeline.observedFrameCount;
}

function spriteActions(sprite: SpriteModel): number {
  return sprite.timeline.frames.reduce((sum, frame) => sum + frame.actions.length, 0);
}

function modulo(value: number, size: number): number {
  return ((value % size) + size) % size;
}
