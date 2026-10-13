/**
 * Frame rendering and the golden record (`T-GFX-071`, `IMPL-140-R013`).
 *
 * The CPU reference renderer paints every frame of a `StaticScene`; each frame gets a hash of its
 * **RGBA bytes** (the comparison surface the tolerance gate uses) and of its **PNG bytes** (the
 * reproducibility check `REPO-R015` names). Draw-call and triangle counters are recorded alongside,
 * which is what makes the P4 budget gates auditable from the committed golden file alone.
 *
 * Everything here is deterministic: no timestamps, no paths beyond the caller's own, no clocks.
 */

import { createHash } from 'node:crypto';

import {
  createFrameRenderer,
  createStats,
  encodePng,
  sceneDrawItems,
  type RenderStats,
  type StaticScene,
} from '@swf-forge/gfx';

export interface FrameRecord {
  readonly index: number;
  /** SHA-256 of the frame's straight-alpha RGBA8 bytes. */
  readonly rgba: string;
  /** SHA-256 of the deterministic PNG encoding of the frame. */
  readonly png: string;
  readonly drawCalls: number;
  /** Contour points submitted — the CPU/GPU comparable geometry counter (`T-GFX-072`). */
  readonly vertices: number;
  readonly bytes: number;
}

export interface RenderedScene {
  readonly frames: readonly FrameRecord[];
  readonly images: readonly { readonly index: number; readonly png: Uint8Array }[];
  readonly stats: Readonly<RenderStats>;
}

export interface RenderFramesOptions {
  /** Device scale applied to the stage (`IMPL-130-R016`); 1 by default. */
  readonly scale?: number;
}

export function renderSceneFrames(scene: StaticScene, options: RenderFramesOptions = {}): RenderedScene {
  const scale = options.scale ?? 1;
  const stats = createStats();
  const renderer = createFrameRenderer({
    width: Math.max(1, Math.round(scene.stage.width * scale)),
    height: Math.max(1, Math.round(scene.stage.height * scale)),
    background: scene.stage.background,
    stats,
  });
  const frames: FrameRecord[] = [];
  const images: { index: number; png: Uint8Array }[] = [];

  for (let frame = 0; frame < scene.frameCount; frame += 1) {
    const items = sceneDrawItems(scene, frame);
    const image = renderer.render(items);
    const png = encodePng(image);
    frames.push({
      index: frame,
      rgba: digest(image.data),
      png: digest(png),
      drawCalls: renderer.stats.drawCalls,
      vertices: renderer.stats.vertices,
      bytes: png.length,
    });
    images.push({ index: frame, png });
  }

  return { frames, images, stats };
}

/** SHA-256 hex of a byte buffer — the hash format every golden and manifest entry uses. */
export function digest(bytes: Uint8Array | Uint8ClampedArray): string {
  return createHash('sha256').update(bytes).digest('hex');
}
