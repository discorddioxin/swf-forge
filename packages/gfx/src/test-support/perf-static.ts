/**
 * The standard `perf-static` scene (`TST` §7.2): 800 static sprites drawn from 4 atlases, no
 * scripting — the P4 draw-call and allocation budget gate's input (`T-GFX-050`, `T-GFX-021`).
 *
 * It lives in test-support because it is harness data, not renderer code: the same scene definition
 * must be what the GPU budget test, the CPU steady-state test and (later) the perf job all render,
 * or the counters in `fixtures/goldens/perf-static.expect.json` would be measuring different scenes.
 *
 * Layout: a 16-column grid on a 800×1024 stage with a 48 px pitch and 20 px rows over 18 px sprites,
 * so sprite bounds are disjoint. Disjoint opaque runs are what the segment batcher may reorder
 * (`GFX-R103`/`T-GFX-020`); overlapping opaque runs would legitimately fall back to consecutive
 * merging and produce a different, no less correct, batch count.
 */

import type { Pt } from '../vector/geometry.js';
import type { ShapeGeometry } from '../vector/geometry.js';
import type { StaticScene, StaticSceneItem } from '../static/scene.js';
import { IDENTITY } from '../render/scene.js';

export interface PerfStaticOptions {
  /** Sprite count (TST §7.2: 800). */
  readonly sprites?: number;
  /** Distinct materials drawn from the atlas set (TST §7.2: 4). */
  readonly atlases?: number;
  readonly stageWidth?: number;
  readonly stageHeight?: number;
  /** Horizontal distance between sprite origins. */
  readonly pitchX?: number;
  /** Vertical distance between sprite origins. */
  readonly pitchY?: number;
  /** Sprite edge length in px. */
  readonly spriteSize?: number;
  readonly spritesPerRow?: number;
}

function closedRect(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
): { readonly edges: readonly { readonly kind: 'line'; readonly from: Pt; readonly to: Pt }[]; readonly closed: true } {
  const corner = (x: number, y: number): Pt => ({ x, y });
  return {
    edges: [
      { kind: 'line', from: corner(x0, y0), to: corner(x1, y0) },
      { kind: 'line', from: corner(x1, y0), to: corner(x1, y1) },
      { kind: 'line', from: corner(x1, y1), to: corner(x0, y1) },
      { kind: 'line', from: corner(x0, y1), to: corner(x0, y0) },
    ],
    closed: true,
  };
}

/** The 800-sprite / 4-atlas `perf-static` bundle described by `TST` §7.2. */
export function perfStaticScene(options: PerfStaticOptions = {}): StaticScene {
  const sprites = options.sprites ?? 800;
  const atlases = options.atlases ?? 4;
  const stageWidth = options.stageWidth ?? 800;
  const stageHeight = options.stageHeight ?? 1024;
  const pitchX = options.pitchX ?? 48;
  const pitchY = options.pitchY ?? 20;
  const spriteSize = options.spriteSize ?? 18;
  const spritesPerRow = options.spritesPerRow ?? 16;

  const shapes: ShapeGeometry[] = Array.from({ length: atlases }, (_, index) => ({
    id: `atlas-${index}`,
    fills: [
      {
        rule: 'nonZero',
        paths: [closedRect(0, 0, spriteSize, spriteSize)],
        paint: { kind: 'solid', r: 32 + index * 24, g: 200 - index * 16, b: 64 + index * 8, a: 255 },
      },
    ],
    strokes: [],
  }));

  const frames: StaticSceneItem[][] = [
    Array.from({ length: sprites }, (_, index) => ({
      shape: `atlas-${index % atlases}`,
      matrix: { ...IDENTITY, tx: (index % spritesPerRow) * pitchX, ty: Math.floor(index / spritesPerRow) * pitchY },
      cxform: null,
      clip: null,
      depth: index + 1,
    })),
  ];

  return {
    format: 'swf-forge/static-scene',
    formatVersion: 1,
    id: 'perf-static',
    stage: { width: stageWidth, height: stageHeight, background: 0xffffff, frameRate: 12 * 256 },
    frameCount: 1,
    shapes,
    frames,
    scripted: false,
  };
}
