/**
 * The static-render scene bundle — the P4 build artifact (`IMPL-130` §5.1, `T-GFX-070`).
 *
 * A *no-script* movie is fully determined by the decoded model: every frame's display list can be
 * walked at build time and every placed character resolved to Vector IR. The bundle is that walk
 * serialised — stages, one geometry table shared by all frames, and per-frame draw items — so the
 * browser renderer never reads SWF bytes (`IMPL-130-R001`) and never executes a VM.
 *
 * A sprite instance's placeholders are resolved here too (the sprite's own timeline is walked and
 * its items flattened into the parent frame), which is only valid because the movie has no script:
 * once AVM1 can move a playhead, the display list must be live, and that is the P7 runtime's job
 * (`TECH-R029`). The bundle therefore carries a `scripted` flag and the builder refuses to emit a
 * scene for a movie with action blocks.
 */

import type { ClipRect } from '../raster/scanline.js';
import type { CxformLike, DrawItem, Transform2D } from '../render/scene.js';
import { IDENTITY } from '../render/scene.js';
import type { ShapeGeometry } from '../vector/geometry.js';

export const STATIC_SCENE_FORMAT = 'swf-forge/static-scene';
export const STATIC_SCENE_VERSION = 1;

export interface StaticSceneStage {
  readonly width: number;
  readonly height: number;
  /** Stage background as `0xRRGGBB`. */
  readonly background: number;
  /** Authored frame rate (`8.8` fixed-point value, as in the model). */
  readonly frameRate: number;
}

export interface StaticSceneItem {
  /** Key into `StaticScene.shapes`. */
  readonly shape: string;
  readonly matrix: Transform2D;
  readonly cxform: CxformLike | null;
  /** Clip rectangle in device px (`clipDepth` masks; real stencil masks are `T-GFX-015`, P9). */
  readonly clip: ClipRect | null;
  readonly depth: number;
}

export interface StaticScene {
  readonly format: typeof STATIC_SCENE_FORMAT;
  readonly formatVersion: typeof STATIC_SCENE_VERSION;
  /** Content-hash-derived id of the source (`sha256:<hex>`); provenance, never a path. */
  readonly id: string;
  readonly stage: StaticSceneStage;
  readonly frameCount: number;
  readonly shapes: readonly ShapeGeometry[];
  readonly frames: readonly (readonly StaticSceneItem[])[];
  /** Always `false` for a bundle this builder emits; a `true` bundle is not renderable (P7). */
  readonly scripted: boolean;
}

export class SceneFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SceneFormatError';
  }
}

/** Frame items as CPU reference draw items (`renderFrame`'s input). */
export function sceneDrawItems(scene: StaticScene, frameIndex: number): DrawItem[] {
  const frame = scene.frames[frameIndex];
  if (!frame) throw new SceneFormatError(`frame ${frameIndex} is outside 0…${scene.frames.length - 1}`);
  const byId = new Map(scene.shapes.map((shape) => [shape.id, shape]));
  const items: DrawItem[] = [];
  for (const item of frame) {
    const shape = byId.get(item.shape);
    if (!shape) throw new SceneFormatError(`frame ${frameIndex} references unknown shape "${item.shape}"`);
    items.push({ shape, matrix: item.matrix, cxform: item.cxform, clip: item.clip, depth: item.depth });
  }
  return items;
}

/** Deterministic JSON: fixed key order, coordinates quantised to 1/1000 px. */
export function serializeStaticScene(scene: StaticScene): string {
  const q = (value: number): number => Math.round(value * 1000) / 1000;
  const payload = {
    format: scene.format,
    formatVersion: scene.formatVersion,
    id: scene.id,
    scripted: scene.scripted,
    stage: {
      width: q(scene.stage.width),
      height: q(scene.stage.height),
      background: scene.stage.background,
      frameRate: scene.stage.frameRate,
    },
    frameCount: scene.frameCount,
    shapes: scene.shapes.map((shape) => ({
      id: shape.id,
      fills: shape.fills.map((fill) => ({
        rule: fill.rule,
        paint: roundPaint(fill.paint, q),
        paths: fill.paths.map((path) => ({
          closed: path.closed,
          edges: path.edges.map((edge) =>
            edge.kind === 'line'
              ? {
                  kind: 'line',
                  from: { x: q(edge.from.x), y: q(edge.from.y) },
                  to: { x: q(edge.to.x), y: q(edge.to.y) },
                }
              : {
                  kind: 'quad',
                  from: { x: q(edge.from.x), y: q(edge.from.y) },
                  control: { x: q(edge.control.x), y: q(edge.control.y) },
                  to: { x: q(edge.to.x), y: q(edge.to.y) },
                },
          ),
        })),
      })),
      strokes: shape.strokes.map((stroke) => ({
        width: q(stroke.width),
        startCap: stroke.startCap,
        endCap: stroke.endCap,
        join: stroke.join,
        miterLimit: q(stroke.miterLimit),
        noClose: stroke.noClose,
        paint: roundPaint(stroke.paint, q),
        paths: stroke.paths.map((path) => ({
          closed: path.closed,
          edges: path.edges.map((edge) =>
            edge.kind === 'line'
              ? {
                  kind: 'line',
                  from: { x: q(edge.from.x), y: q(edge.from.y) },
                  to: { x: q(edge.to.x), y: q(edge.to.y) },
                }
              : {
                  kind: 'quad',
                  from: { x: q(edge.from.x), y: q(edge.from.y) },
                  control: { x: q(edge.control.x), y: q(edge.control.y) },
                  to: { x: q(edge.to.x), y: q(edge.to.y) },
                },
          ),
        })),
      })),
    })),
    frames: scene.frames.map((frame) =>
      frame.map((item) => ({
        shape: item.shape,
        matrix: {
          a: q(item.matrix.a),
          b: q(item.matrix.b),
          c: q(item.matrix.c),
          d: q(item.matrix.d),
          tx: q(item.matrix.tx),
          ty: q(item.matrix.ty),
        },
        cxform: item.cxform,
        clip: item.clip ? { x0: q(item.clip.x0), y0: q(item.clip.y0), x1: q(item.clip.x1), y1: q(item.clip.y1) } : null,
        depth: item.depth,
      })),
    ),
  };
  return `${JSON.stringify(payload, null, 2)}\n`;
}

/** Solid paints only today; gradient/bitmap paints are `GFX` §6.3/§6.4 work (`IMPL-130` open item). */
function roundPaint(paint: ShapeGeometry['fills'][number]['paint'], _q: (value: number) => number): unknown {
  return { kind: paint.kind, r: paint.r, g: paint.g, b: paint.b, a: paint.a };
}

/**
 * Validating loader for the bundle. Everything a browser or a CI job needs to reject is rejected
 * here with a path-bearing message; unknown extra fields are ignored (forward compatibility).
 */
export function parseStaticScene(input: unknown): StaticScene {
  const root = expectObject(input, '$');
  if (root['format'] !== STATIC_SCENE_FORMAT) {
    throw new SceneFormatError(`$: format must be "${STATIC_SCENE_FORMAT}"`);
  }
  if (root['formatVersion'] !== STATIC_SCENE_VERSION) {
    throw new SceneFormatError(`$: unsupported formatVersion ${String(root['formatVersion'])}`);
  }
  const stage = expectObject(root['stage'], '$.stage');
  const frameCount = expectInteger(root['frameCount'], '$.frameCount');
  const shapes = expectArray(root['shapes'], '$.shapes').map((shape, i) => parseShape(shape, `$.shapes[${i}]`));
  const frames = expectArray(root['frames'], '$.frames').map((frame, i) =>
    expectArray(frame, `$.frames[${i}]`).map((item, j) => parseItem(item, `$.frames[${i}][${j}]`)),
  );
  if (frames.length !== frameCount) {
    throw new SceneFormatError(`$.frames: ${frames.length} frames but frameCount is ${frameCount}`);
  }
  const ids = new Set(shapes.map((shape) => shape.id));
  for (let i = 0; i < frames.length; i += 1) {
    for (const item of frames[i] ?? []) {
      if (!ids.has(item.shape)) {
        throw new SceneFormatError(`$.frames[${i}]: unknown shape "${item.shape}"`);
      }
    }
  }
  return {
    format: STATIC_SCENE_FORMAT,
    formatVersion: STATIC_SCENE_VERSION,
    id: expectString(root['id'], '$.id'),
    scripted: root['scripted'] === true,
    stage: {
      width: expectNumber(stage['width'], '$.stage.width'),
      height: expectNumber(stage['height'], '$.stage.height'),
      background: expectInteger(stage['background'], '$.stage.background'),
      frameRate: expectInteger(stage['frameRate'], '$.stage.frameRate'),
    },
    frameCount,
    shapes,
    frames,
  };
}

function parseShape(input: unknown, path: string): ShapeGeometry {
  const shape = expectObject(input, path);
  const fills = expectArray(shape['fills'], `${path}.fills`).map((fill, i) => {
    const f = expectObject(fill, `${path}.fills[${i}]`);
    return {
      rule: expectRule(f['rule'], `${path}.fills[${i}].rule`),
      paths: expectArray(f['paths'], `${path}.fills[${i}].paths`).map((p, j) =>
        parsePath(p, `${path}.fills[${i}].paths[${j}]`),
      ),
      paint: parsePaint(f['paint'], `${path}.fills[${i}].paint`),
    };
  });
  const strokes = expectArray(shape['strokes'], `${path}.strokes`).map((stroke, i) => {
    const s = expectObject(stroke, `${path}.strokes[${i}]`);
    return {
      width: expectNumber(s['width'], `${path}.strokes[${i}].width`),
      startCap: expectCap(s['startCap'], `${path}.strokes[${i}].startCap`),
      endCap: expectCap(s['endCap'], `${path}.strokes[${i}].endCap`),
      join: expectJoin(s['join'], `${path}.strokes[${i}].join`),
      miterLimit: expectNumber(s['miterLimit'], `${path}.strokes[${i}].miterLimit`),
      noClose: s['noClose'] === true,
      paths: expectArray(s['paths'], `${path}.strokes[${i}].paths`).map((p, j) =>
        parsePath(p, `${path}.strokes[${i}].paths[${j}]`),
      ),
      paint: parsePaint(s['paint'], `${path}.strokes[${i}].paint`),
    };
  });
  return { id: expectString(shape['id'], `${path}.id`), fills, strokes };
}

function parsePath(
  input: unknown,
  path: string,
): { closed: boolean; edges: ShapeGeometry['fills'][number]['paths'][number]['edges'] } {
  const p = expectObject(input, path);
  const closed = p['closed'] === true;
  const edges = expectArray(p['edges'], `${path}.edges`).map((edge, i) => {
    const e = expectObject(edge, `${path}.edges[${i}]`);
    const from = parsePoint(e['from'], `${path}.edges[${i}].from`);
    const to = parsePoint(e['to'], `${path}.edges[${i}].to`);
    if (e['kind'] === 'line') return { kind: 'line' as const, from, to };
    if (e['kind'] === 'quad') {
      return { kind: 'quad' as const, from, control: parsePoint(e['control'], `${path}.edges[${i}].control`), to };
    }
    throw new SceneFormatError(`${path}.edges[${i}].kind: unknown edge kind ${JSON.stringify(e['kind'])}`);
  });
  return { closed, edges };
}

function parsePoint(input: unknown, path: string): { x: number; y: number } {
  const p = expectObject(input, path);
  return { x: expectNumber(p['x'], `${path}.x`), y: expectNumber(p['y'], `${path}.y`) };
}

function parsePaint(input: unknown, path: string): ShapeGeometry['fills'][number]['paint'] {
  const paint = expectObject(input, path);
  if (paint['kind'] === 'solid') {
    return {
      kind: 'solid',
      r: expectInteger(paint['r'], `${path}.r`),
      g: expectInteger(paint['g'], `${path}.g`),
      b: expectInteger(paint['b'], `${path}.b`),
      a: expectInteger(paint['a'], `${path}.a`),
    };
  }
  throw new SceneFormatError(`${path}.kind: paint "${String(paint['kind'])}" is not renderable by this build`);
}

function parseItem(input: unknown, path: string): StaticSceneItem {
  const item = expectObject(input, path);
  const m = expectObject(item['matrix'], `${path}.matrix`);
  const clip = item['clip'];
  return {
    shape: expectString(item['shape'], `${path}.shape`),
    matrix: {
      a: expectNumber(m['a'], `${path}.matrix.a`),
      b: expectNumber(m['b'], `${path}.matrix.b`),
      c: expectNumber(m['c'], `${path}.matrix.c`),
      d: expectNumber(m['d'], `${path}.matrix.d`),
      tx: expectNumber(m['tx'], `${path}.matrix.tx`),
      ty: expectNumber(m['ty'], `${path}.matrix.ty`),
    },
    cxform: parseCxform(item['cxform'], `${path}.cxform`),
    clip: clip === null || clip === undefined ? null : parseClip(clip, `${path}.clip`),
    depth: expectInteger(item['depth'], `${path}.depth`),
  };
}

function parseCxform(input: unknown, path: string): CxformLike | null {
  if (input === null || input === undefined) return null;
  const c = expectObject(input, path);
  return {
    rm: expectInteger(c['rm'], `${path}.rm`),
    gm: expectInteger(c['gm'], `${path}.gm`),
    bm: expectInteger(c['bm'], `${path}.bm`),
    am: expectInteger(c['am'], `${path}.am`),
    ra: expectInteger(c['ra'], `${path}.ra`),
    ga: expectInteger(c['ga'], `${path}.ga`),
    ba: expectInteger(c['ba'], `${path}.ba`),
    aa: expectInteger(c['aa'], `${path}.aa`),
  };
}

function parseClip(input: unknown, path: string): ClipRect {
  const c = expectObject(input, path);
  return {
    x0: expectNumber(c['x0'], `${path}.x0`),
    y0: expectNumber(c['y0'], `${path}.y0`),
    x1: expectNumber(c['x1'], `${path}.x1`),
    y1: expectNumber(c['y1'], `${path}.y1`),
  };
}

function expectObject(input: unknown, path: string): Record<string, unknown> {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new SceneFormatError(`${path}: expected an object`);
  }
  return input as Record<string, unknown>;
}

function expectArray(input: unknown, path: string): unknown[] {
  if (!Array.isArray(input)) throw new SceneFormatError(`${path}: expected an array`);
  return input;
}

function expectString(input: unknown, path: string): string {
  if (typeof input !== 'string') throw new SceneFormatError(`${path}: expected a string`);
  return input;
}

function expectNumber(input: unknown, path: string): number {
  if (typeof input !== 'number' || !Number.isFinite(input))
    throw new SceneFormatError(`${path}: expected a finite number`);
  return input;
}

function expectInteger(input: unknown, path: string): number {
  const value = expectNumber(input, path);
  if (!Number.isInteger(value)) throw new SceneFormatError(`${path}: expected an integer`);
  return value;
}

function expectRule(input: unknown, path: string): 'evenOdd' | 'nonZero' {
  if (input === 'evenOdd' || input === 'nonZero') return input;
  throw new SceneFormatError(`${path}: expected "evenOdd" or "nonZero"`);
}

function expectCap(input: unknown, path: string): 'round' | 'butt' | 'square' {
  if (input === 'round' || input === 'butt' || input === 'square') return input;
  throw new SceneFormatError(`${path}: expected a cap`);
}

function expectJoin(input: unknown, path: string): 'round' | 'bevel' | 'miter' {
  if (input === 'round' || input === 'bevel' || input === 'miter') return input;
  throw new SceneFormatError(`${path}: expected a join`);
}

/** Default transform for an item whose placement carried no matrix. */
export const SCENE_IDENTITY: Transform2D = IDENTITY;
