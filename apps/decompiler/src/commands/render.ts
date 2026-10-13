/**
 * `render` — the P4 static-render verb (`IMPL-130` §5.1, `T-GFX-070`/`T-GFX-071`).
 *
 * `forge-decompile render <file.swf> --out <dir>` walks a no-script movie into a static scene
 * bundle, paints every frame with the CPU reference renderer, and writes:
 *
 * ```
 * <out>/
 *   scene.json            the bundle the browser renderer loads (`StaticScene` v1)
 *   render-manifest.json  per-frame RGBA/PNG hashes + draw-call/vertex counters + source hash
 *   frames/frame-000.png  the reference frames (committed as goldens by the harness)
 * ```
 *
 * It never writes absolute paths or timestamps (`REPO-R015`), never re-writes the input, and refuses
 * scripted movies rather than producing frames whose display lists a VM would have moved
 * (`TECH-R029`).
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { buildMovieModel, type MovieModel } from '@swf-forge/swf';
import { openSwfNodeSync, sha256Hex } from '@swf-forge/swf/node';

import { EXIT, type CliIo } from '../exit.js';
import { buildStaticScene, sceneJson } from '../render/scene-build.js';
import { digest, renderSceneFrames, type FrameRecord } from '../render/render-frames.js';
import { writeDemoBundle } from '../render/demo.js';

export interface RenderRequest {
  readonly file: string;
  /** Directory to write; created when missing. */
  readonly out: string;
  /** Frame range `a-b` or single index; all frames by default. */
  readonly frames?: string | null;
  /** Emit `frames/frame-NNN.png` next to the manifest. */
  readonly images?: boolean;
  /** Also write `<out>/demo/`: the browser viewer plus the scene bundle. */
  readonly demo?: boolean;
}

export interface RenderResult {
  readonly model: MovieModel;
  readonly scene: ReturnType<typeof buildStaticScene>['scene'];
  readonly report: ReturnType<typeof buildStaticScene>['report'];
  readonly manifest: RenderManifest;
}

export interface RenderManifest {
  readonly format: 'swf-forge/render-manifest';
  readonly formatVersion: 1;
  readonly source: { readonly bytes: number; readonly sha256: string; readonly frameCount: number };
  readonly stage: {
    readonly width: number;
    readonly height: number;
    readonly background: number;
    readonly frameRate: number;
  };
  readonly report: {
    readonly frames: number;
    readonly items: number;
    readonly shapes: number;
    readonly sprites: number;
    readonly unsupportedPaints: number;
    readonly maxNesting: number;
  };
  readonly scene: { readonly path: string; readonly sha256: string };
  readonly frames: readonly FrameRecord[];
}

/** Parses `--frames`: `a-b` (inclusive), `n`, or null for every frame. */
export function parseFrameRange(spec: string | null | undefined, frameCount: number): { start: number; end: number } {
  if (!spec) return { start: 0, end: frameCount };
  const match = /^(\d+)(?:-(\d+))?$/.exec(spec.trim());
  if (!match) throw new Error(`invalid --frames ${JSON.stringify(spec)}; expected N or A-B`);
  const first = Number(match[1]);
  const last = match[2] === undefined ? first : Number(match[2]);
  if (first > last) throw new Error(`invalid --frames ${spec}: start is after end`);
  return { start: first, end: Math.min(frameCount, last + 1) };
}

export function runRender(request: RenderRequest, io: CliIo): number {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(request.file));
  } catch (error) {
    io.err(`cannot read ${request.file}: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT.unreadable;
  }
  const unit = openSwfNodeSync(bytes);
  const model = buildMovieModel(unit);
  const sourceHash = `sha256:${sha256Hex(bytes)}`;

  let range: { start: number; end: number };
  try {
    range = parseFrameRange(request.frames, Math.max(1, model.frameCount));
  } catch (error) {
    io.err(error instanceof Error ? error.message : String(error));
    return EXIT.unreadable;
  }
  if (range.start >= range.end) {
    io.err(`--frames ${String(request.frames)} selects no frames (movie has ${model.frameCount})`);
    return EXIT.unreadable;
  }

  let built: ReturnType<typeof buildStaticScene>;
  try {
    built = buildStaticScene(model, { maxFrames: range.end });
  } catch (error) {
    io.err(`${request.file}: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT.failed;
  }
  const { scene, report } = built;

  // Restrict the bundle to the selected range, keeping indices `start`-based (`--frames` is an
  // inspection aid, not a second scene format).
  const selected = {
    ...scene,
    frames: scene.frames.slice(range.start),
    frameCount: scene.frames.length - range.start,
  };

  const rendered = renderSceneFrames(selected);
  const json = sceneJson(selected);

  mkdirSync(join(request.out, 'frames'), { recursive: true });
  writeFileSync(join(request.out, 'scene.json'), json, 'utf8');
  if (request.images === true) {
    for (const image of rendered.images) {
      writeFileSync(join(request.out, 'frames', `frame-${String(image.index).padStart(3, '0')}.png`), image.png);
    }
  }

  const manifest: RenderManifest = {
    format: 'swf-forge/render-manifest',
    formatVersion: 1,
    source: { bytes: bytes.length, sha256: sourceHash, frameCount: model.frameCount },
    stage: {
      width: scene.stage.width,
      height: scene.stage.height,
      background: scene.stage.background,
      frameRate: scene.stage.frameRate,
    },
    report,
    scene: { path: 'scene.json', sha256: digest(new TextEncoder().encode(json)) },
    frames: rendered.frames,
  };
  writeFileSync(join(request.out, 'render-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

  io.out(`rendered ${selected.frameCount} frame(s) of ${request.file} → ${request.out}`);
  io.out(
    `stage ${scene.stage.width}×${scene.stage.height} · ${report.shapes} shape(s) · ${report.items} item(s) · ${report.sprites} sprite instance(s)`,
  );
  if (report.unsupportedPaints > 0) {
    io.err(
      `warning: ${report.unsupportedPaints} gradient/bitmap paint(s) fell back to solid grey (GFX §6.3/§6.4 are open; T-GFX-010/011/035)`,
    );
  }
  io.out(`scene.json sha256 ${manifest.scene.sha256.slice(0, 16)}…`);
  if (request.demo === true) {
    const demo = writeDemoBundle(request.out, sceneJson(scene));
    if (demo.written) {
      io.out(`demo: ${join(request.out, 'demo')} — serve the directory and open index.html`);
    } else {
      io.err(`demo not written: ${demo.reason ?? 'unknown reason'}`);
    }
  }
  return EXIT.ok;
}
