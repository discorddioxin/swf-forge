/**
 * Scene playback clock — the P4 static path's frame cursor (`IMPL-130` §3, minus the VM phases).
 *
 * The player never reads a clock: `advance(nowMs)` is handed the time, and the tests hand it
 * synthetic values, so frame timing is deterministic and reviewable (`RT-R006`'s authored-rate rule:
 * frames advance at exactly the movie's frame rate and the index loops).
 */

import type { StaticScene } from '@swf-forge/gfx';

export interface ScenePlayerOptions {
  /** Start paused (default `false`: the demo autoplays). */
  readonly paused?: boolean;
}

export interface ScenePlayer {
  readonly frameCount: number;
  readonly frameIndex: number;
  readonly playing: boolean;
  /** Authored frame duration in milliseconds, from the movie's `8.8` frame rate. */
  readonly frameDurationMs: number;
  play(): void;
  pause(): void;
  toggle(): void;
  /** Jumps to `frame`, wrapping; marks the last rendered frame stale. */
  seek(frame: number): number;
  /** Moves `delta` frames (negative allowed), wrapping. */
  step(delta: number): number;
  /**
   * Advances to the frame `nowMs` selects and returns it. Returns the current frame without
   * advancing when paused or when less than one frame duration has passed.
   */
  advance(nowMs: number): number;
  /** True when the frame index changed since the last `acknowledge()`. */
  readonly dirty: boolean;
  acknowledge(): void;
}

export function createScenePlayer(scene: StaticScene, options: ScenePlayerOptions = {}): ScenePlayer {
  const frameCount = Math.max(1, scene.frameCount);
  const fps = scene.stage.frameRate / 256;
  const frameDurationMs = fps > 0 ? 1000 / fps : 1000 / 12;
  let frameIndex = 0;
  let playing = !(options.paused ?? false);
  let dirty = true;
  let lastTick: number | null = null;
  let accumulator = 0;

  function setFrame(next: number): number {
    const wrapped = ((next % frameCount) + frameCount) % frameCount;
    if (wrapped !== frameIndex) dirty = true;
    frameIndex = wrapped;
    return frameIndex;
  }

  return {
    get frameCount(): number {
      return frameCount;
    },
    get frameIndex(): number {
      return frameIndex;
    },
    get playing(): boolean {
      return playing;
    },
    get frameDurationMs(): number {
      return frameDurationMs;
    },
    get dirty(): boolean {
      return dirty;
    },
    play(): void {
      playing = true;
      lastTick = null;
      accumulator = 0;
    },
    pause(): void {
      playing = false;
    },
    toggle(): void {
      if (playing) this.pause();
      else this.play();
    },
    seek(frame: number): number {
      lastTick = null;
      accumulator = 0;
      return setFrame(frame);
    },
    step(delta: number): number {
      lastTick = null;
      accumulator = 0;
      return setFrame(frameIndex + delta);
    },
    advance(nowMs: number): number {
      if (!playing) return frameIndex;
      if (lastTick === null) {
        lastTick = nowMs;
        return frameIndex;
      }
      const elapsed = nowMs - lastTick;
      lastTick = nowMs;
      if (elapsed <= 0) return frameIndex;
      accumulator += elapsed;
      const frames = Math.floor(accumulator / frameDurationMs);
      if (frames <= 0) return frameIndex;
      accumulator -= frames * frameDurationMs;
      return setFrame(frameIndex + frames);
    },
    acknowledge(): void {
      dirty = false;
    },
  };
}
