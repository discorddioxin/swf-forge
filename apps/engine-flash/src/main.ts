/**
 * Demo entry point — `index.html` loads this module and it fetches `./scene.json`.
 *
 * The page is deliberately boring: one canvas, a status line and keyboard controls. Its job is to be
 * the P4 demo the roadmap describes ("a no-script SWF renders its main timeline in the browser") and
 * the reference for later phases, not to be a product UI (that is the inspector, P12).
 */

import { parseStaticScene, SceneFormatError, type StaticScene } from '@swf-forge/gfx';

import { mountStaticViewer } from './viewer.js';

interface DemoState {
  readonly canvas: HTMLCanvasElement;
  readonly status: HTMLElement;
}

async function loadScene(url: string): Promise<StaticScene> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`cannot load ${url}: HTTP ${response.status}`);
  return parseStaticScene(await response.json());
}

function connectUpgrade(handle: ReturnType<typeof mountStaticViewer>, state: DemoState, scene: StaticScene): void {
  const { player } = handle;
  window.addEventListener('keydown', (event) => {
    if (event.key === ' ') {
      player.toggle();
      event.preventDefault();
    } else if (event.key === 'ArrowRight') {
      player.step(1);
      handle.renderNow();
    } else if (event.key === 'ArrowLeft') {
      player.step(-1);
      handle.renderNow();
    } else if (event.key === 'Home') {
      player.seek(0);
      handle.renderNow();
    }
  });
  const line = (): string => {
    const stats = handle.renderer?.stats;
    const draws = stats ? ` · draws ${stats.drawCalls}` : '';
    const context = handle.renderer?.contextLost ? ' · context lost' : '';
    return `${scene.stage.width}×${scene.stage.height} @ ${(scene.stage.frameRate / 256).toFixed(1)} fps · frame ${player.frameIndex + 1}/${player.frameCount}${player.playing ? ' ▶' : ' ❚❚'}${draws}${context}`;
  };
  setInterval(() => {
    state.status.textContent = line();
  }, 250);
}

async function boot(): Promise<void> {
  const canvas = document.getElementById('stage');
  const status = document.getElementById('status');
  if (!(canvas instanceof HTMLCanvasElement) || !status) {
    throw new Error('index.html is missing #stage or #status');
  }
  const scene = await loadScene('./scene.json');
  const handle = mountStaticViewer({ canvas, scene });
  connectUpgrade(handle, { canvas, status }, scene);
  if (handle.errors.length > 0) {
    status.textContent = handle.errors.join(' · ');
  }
}

boot().catch((error: unknown) => {
  const status = document.getElementById('status');
  const message =
    error instanceof SceneFormatError ? `scene.json is not a valid static scene: ${error.message}` : String(error);
  if (status) status.textContent = message;
});
