/**
 * `forge-decompile render` — the P4 production path (`IMPL-130` §5.1, `T-GFX-070`/`T-GFX-071`).
 *
 * These are the *pixel-level* assertions behind the golden suite: a golden hash proves a frame is
 * stable, not that it is right, so every fixture whose output is analytically known is checked here
 * against the colour the chapter says must be there (and the colour that must not be). The tests
 * cover the scene builder (sprites, masks, visibility, removals), the `--frames` parser, the
 * documented refusal to render scripted movies, and the bundle/manifest contract.
 */

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { createFrameRenderer, parseStaticScene, sceneDrawItems, type StaticScene } from '@swf-forge/gfx';
import { buildMovieModel, openSwf } from '@swf-forge/swf';
import { actionBlock, buildSwf, concat, endTag, showFrames, staticFixtures, tag } from '@swf-forge/swf/test-support';

import { runRender, parseFrameRange } from '../src/commands/render.js';
import { buildStaticScene } from '../src/render/scene-build.js';
import type { CliIo } from '../src/exit.js';

const WORK = mkdtempSync(join(tmpdir(), 'swf-forge-render-'));
afterAll(() => rmSync(WORK, { recursive: true, force: true }));

const fixtures = staticFixtures();
const fixture = (name: string): (typeof fixtures)[number] => {
  const found = fixtures.find((candidate) => candidate.name === name);
  if (!found) throw new Error(`no fixture ${name}`);
  return found;
};

function sceneFor(name: string): StaticScene {
  const bytes = fixture(name).bytes;
  return buildStaticScene(buildMovieModel(openSwf(bytes))).scene;
}

function capture(): { io: CliIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (line) => out.push(line), err: (line) => err.push(line) }, out, err };
}

interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

function pixel(scene: StaticScene, frame: number, x: number, y: number): Rgba {
  const renderer = createFrameRenderer({
    width: Math.round(scene.stage.width),
    height: Math.round(scene.stage.height),
    background: scene.stage.background,
  });
  const image = renderer.render(sceneDrawItems(scene, frame));
  const at = (Math.round(y) * image.width + Math.round(x)) * 4;
  return {
    r: image.data[at] ?? -1,
    g: image.data[at + 1] ?? -1,
    b: image.data[at + 2] ?? -1,
    a: image.data[at + 3] ?? -1,
  };
}

const RED = { r: 220, g: 40, b: 40 };
const GREEN = { r: 30, g: 160, b: 70 };
const BLUE = { r: 40, g: 80, b: 220 };
const YELLOW = { r: 250, g: 210, b: 40 };

/** Interior pixel (avoiding the AA edge) must be the authored colour; `near` allows the fill's AA. */
function expectColor(actual: Rgba, expected: { r: number; g: number; b: number }, tolerance = 2): void {
  expect({
    r: Math.abs(actual.r - expected.r) <= tolerance,
    g: Math.abs(actual.g - expected.g) <= tolerance,
    b: Math.abs(actual.b - expected.b) <= tolerance,
  }).toEqual({
    r: true,
    g: true,
    b: true,
  });
}

describe('static scene building', () => {
  it('resolves shapes once and reports the frame inventory', () => {
    const built = buildStaticScene(buildMovieModel(openSwf(fixture('stress-grid').bytes)));
    expect(built.report).toMatchObject({ frames: 1, items: 24, shapes: 1, sprites: 0, unsupportedPaints: 0 });
    expect(built.scene.shapes).toHaveLength(1);
  });

  it('expands sprites, including nesting, into flat per-frame items', () => {
    const nested = buildStaticScene(buildMovieModel(openSwf(fixture('sprite-nested').bytes)));
    expect(nested.report.sprites).toBe(2);
    expect(nested.report.maxNesting).toBe(2);
    // One draw item (the leaf shape), with the three translations composed into its matrix.
    expect(nested.scene.frames[0]).toHaveLength(1);
    expect(nested.scene.frames[0]?.[0]?.matrix.tx).toBeCloseTo(30 + 10 + 5, 6);
  });

  it('runs a sprite playhead independently of the parent timeline', () => {
    const scene = sceneFor('sprite-loop');
    const shapeIds = scene.frames.map((frame) => frame.map((item) => item.shape).join(','));
    // The sprite's two frames alternate red/blue while the parent timeline keeps running.
    expect(shapeIds).toEqual(['shape-1', 'shape-2', 'shape-1', 'shape-2', 'shape-1']);
  });

  it('applies a clipDepth mask as a clip range and hides the masker', () => {
    const scene = sceneFor('clip-mask');
    const items = scene.frames[0] ?? [];
    expect(items).toHaveLength(1);
    expect(items[0]?.clip).toEqual({ x0: 40, y0: 30, x1: 100, y1: 80 });
  });

  it('drops invisible placements and applies removals', () => {
    expect(sceneFor('invisible-placement').frames[0]).toEqual([]);
    const timeline = sceneFor('timeline-frames');
    expect(timeline.frames.map((frame) => frame.length)).toEqual([1, 1, 0]);
    expect(timeline.frames[1]?.[0]?.matrix.tx).toBeCloseTo(100, 6);
  });

  it('refuses a scripted movie instead of guessing its frames', () => {
    const body = concat(
      tag(12, actionBlock([0x81, 0x00])), // DoAction
      showFrames(1),
      endTag(),
    );
    const file = openSwf(buildSwf({ version: 10, body }));
    const model = buildMovieModel(file);
    expect(() => buildStaticScene(model)).toThrow(/action block/);
  });
});

describe('render pixels', () => {
  it('paints an opaque fill at its authored position and leaves the stage alone elsewhere', () => {
    const scene = sceneFor('solid-rect');
    expectColor(pixel(scene, 0, 30, 30), RED);
    expectColor(pixel(scene, 0, 150, 120), { r: 255, g: 255, b: 255 });
    expectColor(pixel(scene, 0, 10, 10), { r: 255, g: 255, b: 255 });
  });

  it('leaves the even-odd hole empty but fills the nonzero one', () => {
    expectColor(pixel(sceneFor('two-fills-hole'), 0, 90, 70), { r: 255, g: 255, b: 255 });
    expectColor(pixel(sceneFor('two-fills-hole'), 0, 30, 20), BLUE);
    expectColor(pixel(sceneFor('nonzero-hole'), 0, 90, 70), GREEN);
  });

  it('paints strokes on the path, not beside it', () => {
    const scene = sceneFor('stroke-round-caps');
    expectColor(pixel(scene, 0, 100, 40), { r: 0, g: 0, b: 0 });
    expectColor(pixel(scene, 0, 100, 70), { r: 255, g: 255, b: 255 });
  });

  it('honours CXFORM multiply and add terms', () => {
    // 220 × 0.5 over white with alpha 0.5 → the red channel stays high, green/blue rise.
    const half = pixel(sceneFor('cxform-mult'), 0, 60, 60);
    expect(half.r).toBeGreaterThan(200);
    expect(half.g).toBeGreaterThan(100);
    expect(half.g).toBeLessThan(200);
    // Black + (0.4, 0.6, 0.8) → (102, 154, 205).
    expectColor(pixel(sceneFor('cxform-add'), 0, 60, 60), { r: 102, g: 154, b: 205 });
  });

  it('scales and rotates the geometry it was given', () => {
    expectColor(pixel(sceneFor('matrix-scale'), 0, 50, 50), YELLOW);
    expectColor(pixel(sceneFor('matrix-scale'), 0, 30, 30), { r: 255, g: 255, b: 255 });
    expectColor(pixel(sceneFor('matrix-rotate'), 0, 100, 75), BLUE);
  });

  it('orders overlaps by depth', () => {
    // Depth 5 (green) is in front of depth 2 (red) where the two overlap; the lower depth still
    // shows where the higher one has no geometry.
    expectColor(pixel(sceneFor('depth-order'), 0, 100, 60), GREEN);
    expectColor(pixel(sceneFor('depth-order'), 0, 160, 130), RED);
    expectColor(pixel(sceneFor('depth-order'), 0, 30, 25), GREEN);
  });

  it('renders the invisible fixture as a clean stage', () => {
    const scene = sceneFor('invisible-placement');
    expectColor(pixel(scene, 0, 60, 60), { r: 255, g: 255, b: 255 });
  });

  it('clips a masked instance to the masker bounds and hides the masker', () => {
    const scene = sceneFor('clip-mask');
    expectColor(pixel(scene, 0, 60, 50), GREEN); // inside both the mask and the green rect
    expectColor(pixel(scene, 0, 120, 50), { r: 255, g: 255, b: 255 }); // inside the green rect, outside the mask
    // The masker's own fill (yellow) must never appear: it is a mask, not content.
    const renderer = createFrameRenderer({ width: 200, height: 150, background: scene.stage.background });
    const image = renderer.render(sceneDrawItems(scene, 0));
    let yellow = 0;
    for (let i = 0; i < image.data.length; i += 4) {
      if ((image.data[i] ?? 0) > 220 && (image.data[i + 1] ?? 0) > 180 && (image.data[i + 2] ?? 0) < 90) yellow += 1;
    }
    expect(yellow).toBe(0);
  });
});

describe('render verb', () => {
  it('parses frame ranges', () => {
    expect(parseFrameRange(null, 5)).toEqual({ start: 0, end: 5 });
    expect(parseFrameRange('2', 5)).toEqual({ start: 2, end: 3 });
    expect(parseFrameRange('1-3', 5)).toEqual({ start: 1, end: 4 });
    expect(parseFrameRange('3-99', 5)).toEqual({ start: 3, end: 5 });
    expect(() => parseFrameRange('9-2', 5)).toThrow(/start is after end/);
    expect(() => parseFrameRange('x', 5)).toThrow(/expected N or A-B/);
  });

  it('writes a parseable bundle, a manifest and the images it promises', () => {
    const out = join(WORK, 'bundle');
    const { io, err } = capture();
    const code = runRender({ file: writeFixture('solid-rect', WORK), out, images: true }, io);
    expect({ code, err }).toEqual({ code: 0, err: [] });
    const scene = parseStaticScene(JSON.parse(readFileSync(join(out, 'scene.json'), 'utf8')));
    expect(scene.frameCount).toBe(1);
    const manifest = JSON.parse(readFileSync(join(out, 'render-manifest.json'), 'utf8')) as {
      frames: { png: string }[];
    };
    const png = readFileSync(join(out, 'frames', 'frame-000.png'));
    expect(manifest.frames[0]?.png).toBe(createHashHex(png));
  });

  it('restricts the bundle with --frames and rejects an empty range', () => {
    const out = join(WORK, 'range');
    const file = writeFixture('timeline-frames', WORK);
    const { io } = capture();
    expect(runRender({ file, out, frames: '1-2' }, io)).toBe(0);
    const scene = parseStaticScene(JSON.parse(readFileSync(join(out, 'scene.json'), 'utf8')));
    expect(scene.frameCount).toBe(2);
    const clipped = capture();
    expect(runRender({ file, out: join(WORK, 'range-empty'), frames: '3-3' }, clipped.io)).toBe(2);
    expect(clipped.err.join('\n')).toMatch(/selects no frames/);
  });

  it('reports a scripted movie as a failure, not as empty frames', () => {
    const out = join(WORK, 'scripted');
    const path = join(WORK, 'scripted.swf');
    writeFileSync(
      path,
      buildSwf({ version: 10, body: concat(tag(12, actionBlock([0x81, 0x00])), showFrames(1), endTag()) }),
    );
    const { io, err } = capture();
    expect(runRender({ file: path, out }, io)).toBe(1);
    expect(err.join('\n')).toMatch(/action block/);
  });
});

function writeFixture(name: string, dir: string): string {
  const path = join(dir, `${name}.swf`);
  writeFileSync(path, fixture(name).bytes);
  return path;
}

function createHashHex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}
