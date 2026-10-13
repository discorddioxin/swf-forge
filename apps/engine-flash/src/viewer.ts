/**
 * Static scene viewer — the P4 browser surface (`GFX` §3.2, `IMPL-130-R017`).
 *
 * It owns the canvas, the WebGL2 context (stencil + MSAA are requested explicitly; WebGL2 has no
 * stencil buffer unless asked for), the frame loop and the context-loss wiring. The renderer itself
 * lives in `@swf-forge/gfx` so the same code paints in the browser and in Node tests.
 *
 * No SWF is ever fetched: the viewer loads a `StaticScene` bundle (`scene.json`) produced by
 * `forge-decompile render --demo` (`ARCH-R001`).
 */

import { createGlRenderer, GlProgramError, type GlRenderer, type StaticScene } from '@swf-forge/gfx';

import { createScenePlayer, type ScenePlayer } from './player.js';

export interface StaticViewerOptions {
  readonly canvas: HTMLCanvasElement;
  readonly scene: StaticScene;
  /** Overrides `devicePixelRatio` (tests and the demo's `?dpr=` knob). */
  readonly maxDpr?: number;
  /** Start paused. */
  readonly paused?: boolean;
}

export interface StaticViewerHandle {
  readonly player: ScenePlayer;
  readonly renderer: GlRenderer | null;
  /** Non-fatal problems (missing WebGL2, program build errors) in the order they happened. */
  readonly errors: readonly string[];
  /** Renders the current frame immediately (used after seeking or a context restore). */
  renderNow(): void;
  dispose(): void;
}

export function mountStaticViewer(options: StaticViewerOptions): StaticViewerHandle {
  const { canvas, scene } = options;
  const errors: string[] = [];
  const maxDpr = options.maxDpr ?? 2;
  const dpr = Math.max(1, Math.min(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, maxDpr));
  const width = Math.max(1, Math.round(scene.stage.width * dpr));
  const height = Math.max(1, Math.round(scene.stage.height * dpr));
  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${scene.stage.width}px`;
  canvas.style.height = `${scene.stage.height}px`;

  const context = canvas.getContext('webgl2', {
    alpha: false,
    antialias: true,
    depth: false,
    stencil: true,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
  });
  if (!context) {
    // `GFX-R004`: fail loudly with an actionable message rather than falling back to 2D.
    errors.push('WebGL2 is not available in this browser; the static renderer requires it (GFX-R004)');
  }

  let renderer: GlRenderer | null = null;
  if (context) {
    try {
      renderer = createGlRenderer(context, { width, height, scale: dpr });
    } catch (error) {
      errors.push(error instanceof GlProgramError ? error.message : `renderer init failed: ${String(error)}`);
    }
  }

  const player = createScenePlayer(scene, { paused: options.paused ?? false });
  let disposed = false;
  let rafHandle = 0;

  function renderNow(): void {
    if (!renderer || disposed) return;
    try {
      renderer.drawFrame(scene, player.frameIndex);
      player.acknowledge();
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      disposed = true;
    }
  }

  function tick(nowMs: number): void {
    if (disposed) return;
    const frame = player.advance(nowMs);
    if (player.dirty || frame !== player.frameIndex) renderNow();
    rafHandle = requestAnimationFrame(tick);
  }

  function onContextLost(event: Event): void {
    event.preventDefault();
    renderer?.handleContextLost();
    errors.push('WebGL2 context lost; waiting for restore');
  }

  function onContextRestored(): void {
    renderer?.handleContextRestored();
    renderNow();
  }

  canvas.addEventListener('webglcontextlost', onContextLost as EventListener);
  canvas.addEventListener('webglcontextrestored', onContextRestored);
  renderNow();
  rafHandle = requestAnimationFrame(tick);

  return {
    player,
    get renderer(): GlRenderer | null {
      return renderer;
    },
    errors,
    renderNow,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(rafHandle);
      canvas.removeEventListener('webglcontextlost', onContextLost as EventListener);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      renderer?.dispose();
    },
  };
}
