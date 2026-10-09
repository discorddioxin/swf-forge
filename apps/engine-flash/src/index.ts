/**
 * `@swf-forge/engine-flash` — the faithful engine (`TECH-SPEC` §2, `IMPL-130`).
 *
 * **P4 scope (this file's current surface): the renderer half.** It loads a static scene bundle and
 * paints it with WebGL2; there is no AVM1, no display-list simulation and no audio yet, because the
 * roadmap builds those in P5–P8 and a static (no-script) movie cannot observe their absence.
 *
 * Later phases add the runtime re-exports (`@swf-forge/runtime`, `@swf-forge/avm1/runtime`,
 * `@swf-forge/audio`) here; the emitted project imports this package name only (`TECH-D04`).
 */

export { createScenePlayer } from './player.js';
export type { ScenePlayer, ScenePlayerOptions } from './player.js';
export { mountStaticViewer } from './viewer.js';
export type { StaticViewerHandle, StaticViewerOptions } from './viewer.js';
export {
  createGlRenderer,
  parseStaticScene,
  SceneFormatError,
  sceneDrawItems,
  STATIC_SCENE_FORMAT,
  STATIC_SCENE_VERSION,
} from '@swf-forge/gfx';
export type { GlRenderer, StaticScene } from '@swf-forge/gfx';
