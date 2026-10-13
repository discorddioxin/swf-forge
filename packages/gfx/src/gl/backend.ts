/**
 * WebGL2 backend — `GFX` §3.1/§3.3, the renderer half of `engine-flash` (P4).
 *
 * Scope of this backend (P4): a *static* scene bundle (`static/scene.ts`) drawn with the
 * stencil-then-cover fill path (`vector/tessellate.ts`), solid colours with CXFORM applied once per
 * run, scissor clipping for `clipDepth` masks, MSAA from the context's own antialias attribute, and
 * the budget counters of `GFX-R103`.
 *
 * Batching (`GFX-R053`…`R056`, `gl/batcher.ts`): consecutive runs that share a material key and are
 * fully opaque merge into one stencil pass + one cover quad, so a frame of *n* identical sprites
 * costs 2 draws instead of 2n (`T-GFX-050`). The planner is deterministic, which is what `T-GFX-020`
 * asserts by recording the command list twice.
 *
 * Deliberately deferred, and recorded as open items in `IMPL-130` §5.1: gradient/bitmap paints
 * (`GFX` §6.3/§6.4), atlas/texture material keys with the sort-by-material rule (`GFX-R054`'s first
 * row, which needs textures), filters (`GFX` §11) and stencil *masks* (`GFX-R046`; the clip rect
 * here is the mask's bounds). None of these change the draw path's shape: a batch is `(stencil pass,
 * cover pass, scissor state)`.
 *
 * Context loss (`IMPL-130-R017`): the CPU-side description (the scene + the mesh cache) is never
 * discarded. `handleContextLost` drops every GPU handle; `handleContextRestored` rebuilds the
 * program and buffers lazily on the next frame. A lost context makes `drawFrame` return `false`
 * rather than throwing, so the shell can hold the last frame `GFX-R004` asks for.
 */

import type { ClipRect } from '../raster/scanline.js';
import { applyCxformInto } from '../render/renderer.js';
import { MeshCache } from '../render/mesh.js';
import { beginFrame, createStats, endFrame, type RenderStats } from '../render/stats.js';
import type { MutableRgba } from '../raster/image.js';
import type { ShapeGeometry } from '../vector/geometry.js';
import type { StaticScene, StaticSceneItem } from '../static/scene.js';
import { BatchPlanner, type DrawBatch } from './batcher.js';
import { FRAGMENT_SHADER, VERTEX_SHADER } from './shaders.js';

/** The subset of `WebGL2RenderingContext` this backend uses, so a stub can stand in for tests. */
export interface GlContextLike {
  createShader(type: number): unknown;
  shaderSource(shader: unknown, source: string): void;
  compileShader(shader: unknown): void;
  getShaderParameter(shader: unknown, pname: number): unknown;
  getShaderInfoLog(shader: unknown): string | null;
  deleteShader(shader: unknown): void;
  createProgram(): unknown;
  attachShader(program: unknown, shader: unknown): void;
  linkProgram(program: unknown): void;
  getProgramParameter(program: unknown, pname: number): unknown;
  getProgramInfoLog(program: unknown): string | null;
  useProgram(program: unknown): void;
  deleteProgram(program: unknown): void;
  getAttribLocation(program: unknown, name: string): number;
  getUniformLocation(program: unknown, name: string): unknown;
  createBuffer(): unknown;
  bindBuffer(target: number, buffer: unknown): void;
  bufferData(target: number, data: ArrayBufferView, usage: number): void;
  deleteBuffer(buffer: unknown): void;
  createVertexArray(): unknown;
  bindVertexArray(vertexArray: unknown): void;
  deleteVertexArray(vertexArray: unknown): void;
  enableVertexAttribArray(index: number): void;
  vertexAttribPointer(
    index: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
  ): void;
  uniform4f(location: unknown, x: number, y: number, z: number, w: number): void;
  enable(cap: number): void;
  disable(cap: number): void;
  clearColor(r: number, g: number, b: number, a: number): void;
  clear(mask: number): void;
  colorMask(r: boolean, g: boolean, b: boolean, a: boolean): void;
  blendFunc(source: number, destination: number): void;
  stencilFunc(func: number, ref: number, mask: number): void;
  stencilOp(fail: number, zfail: number, zpass: number): void;
  stencilOpSeparate(face: number, fail: number, zfail: number, zpass: number): void;
  stencilMask(mask: number): void;
  clearStencil(value: number): void;
  viewport(x: number, y: number, width: number, height: number): void;
  scissor(x: number, y: number, width: number, height: number): void;
  drawArrays(mode: number, first: number, count: number): void;
}

/** GL enums used here, as literals: the package stays free of DOM types (Node builds it too). */
export const GL = {
  VERTEX_SHADER: 0x8b31,
  FRAGMENT_SHADER: 0x8b30,
  COMPILE_STATUS: 0x8b81,
  LINK_STATUS: 0x8b82,
  ARRAY_BUFFER: 0x8892,
  DYNAMIC_DRAW: 0x88e8,
  FLOAT: 0x1406,
  TRIANGLES: 0x0004,
  COLOR_BUFFER_BIT: 0x4000,
  STENCIL_BUFFER_BIT: 0x0400,
  STENCIL_TEST: 0x0b90,
  SCISSOR_TEST: 0x0c11,
  BLEND: 0x0be2,
  INVERT: 0x150a,
  INCR_WRAP: 0x8507,
  DECR_WRAP: 0x8508,
  EQUAL: 0x0202,
  NOTEQUAL: 0x0205,
  KEEP: 0x1e00,
  ALWAYS: 0x0207,
  SRC_ALPHA: 0x0302,
  ONE_MINUS_SRC_ALPHA: 0x0303,
  FRONT: 0x0404,
  BACK: 0x0405,
} as const;

export class GlProgramError extends Error {
  constructor(log: string) {
    super(`WebGL2 program failed to build: ${log}`);
    this.name = 'GlProgramError';
  }
}

export class GlContextLostError extends Error {
  constructor() {
    super('WebGL2 context lost; the renderer waits for handleContextRestored() (IMPL-130-R017)');
    this.name = 'GlContextLostError';
  }
}

export interface GlRendererOptions {
  readonly width: number;
  readonly height: number;
  /** Device-pixel scale applied to the stage; layout stays in stage px (`IMPL-130-R016`). */
  readonly scale?: number;
  readonly stats?: RenderStats;
  readonly meshCache?: MeshCache;
}

export interface GlRenderer {
  readonly stats: RenderStats;
  readonly contextLost: boolean;
  /** Program builds since creation; a second build proves the context-loss rebuild path. */
  readonly programBuilds: number;
  readonly width: number;
  readonly height: number;
  resize(width: number, height: number): void;
  drawFrame(scene: StaticScene, frameIndex: number): boolean;
  handleContextLost(): void;
  handleContextRestored(): void;
  dispose(): void;
}

interface Program {
  readonly handle: unknown;
  readonly position: number;
  readonly colour: unknown;
  readonly projection: unknown;
}

/** One reusable paint object: the per-run colour never allocates (`T-GFX-021`). */
const scratchColour: MutableRgba = { r: 0, g: 0, b: 0, a: 0 };

interface IndexedScene {
  readonly id: string;
  readonly byId: Map<string, ShapeGeometry>;
}

/**
 * Creates the backend. The canvas owns the *context* (attributes, DPR) and its loss/restore events;
 * this object owns the programs, buffers and one frame's draw sequence.
 */
export function createGlRenderer(gl: GlContextLike, options: GlRendererOptions): GlRenderer {
  const stats = options.stats ?? createStats();
  const meshCache = options.meshCache ?? new MeshCache();
  const planner = new BatchPlanner(stats);
  const scale = options.scale ?? 1;
  let width = options.width;
  let height = options.height;
  let program: Program | null = null;
  let vertexArray: unknown = null;
  let vertexBuffer: unknown = null;
  let contextLost = false;
  let disposed = false;
  let programBuilds = 0;
  let uploadBuffer = new Float32Array(1024);
  let scissorActive = false;
  let scissorEmpty = false;
  let indexed: IndexedScene | null = null;

  function buildProgram(): Program {
    const vertexShader = compile(gl, GL.VERTEX_SHADER, VERTEX_SHADER);
    const fragmentShader = compile(gl, GL.FRAGMENT_SHADER, FRAGMENT_SHADER);
    const handle = gl.createProgram();
    gl.attachShader(handle, vertexShader);
    gl.attachShader(handle, fragmentShader);
    gl.linkProgram(handle);
    if (!gl.getProgramParameter(handle, GL.LINK_STATUS)) {
      throw new GlProgramError(String(gl.getProgramInfoLog(handle) ?? 'link failed'));
    }
    gl.deleteShader(vertexShader);
    gl.deleteShader(fragmentShader);
    programBuilds += 1;
    return {
      handle,
      position: gl.getAttribLocation(handle, 'a_position'),
      colour: gl.getUniformLocation(handle, 'u_colour'),
      projection: gl.getUniformLocation(handle, 'u_projection'),
    };
  }

  function ensureResources(): Program {
    if (!program) {
      program = buildProgram();
      vertexArray = gl.createVertexArray();
      vertexBuffer = gl.createBuffer();
      gl.bindVertexArray(vertexArray);
      gl.bindBuffer(GL.ARRAY_BUFFER, vertexBuffer);
      gl.enableVertexAttribArray(program.position);
      gl.vertexAttribPointer(program.position, 2, GL.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
    }
    return program;
  }

  function uploadVertices(points: Float32Array): void {
    if (points.length > uploadBuffer.length) {
      uploadBuffer = new Float32Array(Math.max(points.length, uploadBuffer.length * 2));
      stats.bufferGrowths += 1;
    }
    uploadBuffer.set(points, 0);
    gl.bufferData(GL.ARRAY_BUFFER, uploadBuffer.subarray(0, points.length), GL.DYNAMIC_DRAW);
    stats.uploads += 1;
    stats.uploadBytes += points.length * 4;
  }

  function setScissor(rect: ClipRect | null): void {
    if (!rect) {
      if (scissorActive) {
        gl.disable(GL.SCISSOR_TEST);
        scissorActive = false;
      }
      scissorEmpty = false;
      return;
    }
    const bufferHeight = Math.floor(height * scale);
    const x0 = Math.max(0, Math.floor(rect.x0 * scale));
    const y0 = Math.max(0, Math.floor(rect.y0 * scale));
    const x1 = Math.min(Math.floor(width * scale), Math.ceil(rect.x1 * scale));
    const y1 = Math.min(bufferHeight, Math.ceil(rect.y1 * scale));
    const w = Math.max(0, x1 - x0);
    const h = Math.max(0, y1 - y0);
    // GL's scissor origin is bottom-left; the scene is authored top-left.
    gl.scissor(x0, bufferHeight - y1, w, h);
    scissorEmpty = w === 0 || h === 0;
    if (!scissorActive) {
      gl.enable(GL.SCISSOR_TEST);
      scissorActive = true;
    }
  }

  function drawBatch(batch: DrawBatch): void {
    const active = ensureResources();
    const positions = batch.positions;
    const cover = batch.cover;
    gl.useProgram(active.handle);
    gl.bindVertexArray(vertexArray);
    gl.bindBuffer(GL.ARRAY_BUFFER, vertexBuffer);
    // Device px (y down) → clip space (y up), for a viewport of the whole drawing buffer.
    gl.uniform4f(active.projection, (2 * scale) / width, (-2 * scale) / height, -1, 1);
    setScissor(batch.clip);
    if (scissorEmpty) return;

    // Pass 1 — stencil: geometry only, no colour writes.
    gl.colorMask(false, false, false, false);
    gl.disable(GL.BLEND);
    gl.enable(GL.STENCIL_TEST);
    gl.stencilMask(0xff);
    gl.clearStencil(0);
    gl.clear(GL.STENCIL_BUFFER_BIT);
    gl.stencilFunc(GL.ALWAYS, 0, 0xff);
    if (batch.rule === 'evenOdd') {
      gl.stencilOp(GL.KEEP, GL.KEEP, GL.INVERT);
    } else {
      // Winding number: +1 for one orientation, −1 for the other (`GFX-R019`).
      gl.stencilOpSeparate(GL.FRONT, GL.KEEP, GL.KEEP, GL.INCR_WRAP);
      gl.stencilOpSeparate(GL.BACK, GL.KEEP, GL.KEEP, GL.DECR_WRAP);
    }
    uploadVertices(positions);
    gl.drawArrays(GL.TRIANGLES, 0, positions.length / 2);
    stats.drawCalls += 1;
    stats.triangles += positions.length / 6;
    stats.vertices += positions.length / 2;

    // Pass 2 — cover: the batch's union bounds, painted once, so overlapping geometry cannot
    // double-darken and a merged batch paints exactly like its runs painted one at a time.
    const colour = batch.paint;
    gl.colorMask(true, true, true, true);
    gl.stencilFunc(
      batch.rule === 'evenOdd' ? GL.EQUAL : GL.NOTEQUAL,
      batch.rule === 'evenOdd' ? 1 : 0,
      batch.rule === 'evenOdd' ? 0x01 : 0xff,
    );
    gl.stencilMask(0x00);
    gl.stencilOp(GL.KEEP, GL.KEEP, GL.KEEP);
    gl.enable(GL.BLEND);
    gl.uniform4f(active.colour, colour.r / 255, colour.g / 255, colour.b / 255, colour.a / 255);
    uploadVertices(cover);
    gl.drawArrays(GL.TRIANGLES, 0, cover.length / 2);
    stats.drawCalls += 1;
    stats.triangles += cover.length / 6;
    stats.vertices += cover.length / 2;

    gl.stencilMask(0xff);
    gl.disable(GL.STENCIL_TEST);
  }

  function indexScene(scene: StaticScene): IndexedScene {
    if (indexed && indexed.id === scene.id) return indexed;
    const byId = new Map<string, ShapeGeometry>();
    for (const shape of scene.shapes) byId.set(shape.id, shape);
    indexed = { id: scene.id, byId };
    stats.allocations += 1;
    return indexed;
  }

  function planFrame(frame: readonly StaticSceneItem[], index: IndexedScene): void {
    planner.begin();
    let runs = 0;
    for (const item of frame) {
      const shape = index.byId.get(item.shape);
      if (!shape) continue;
      const clip: ClipRect | null = item.clip
        ? {
            x0: Math.max(0, Math.floor(item.clip.x0)),
            y0: Math.max(0, Math.floor(item.clip.y0)),
            x1: Math.min(width, Math.ceil(item.clip.x1)),
            y1: Math.min(height, Math.ceil(item.clip.y1)),
          }
        : null;
      if (clip && (clip.x1 <= clip.x0 || clip.y1 <= clip.y0)) continue;
      for (const run of meshCache.runs(shape, item.matrix)) {
        applyCxformInto(run.paint, item.cxform, scratchColour);
        planner.addRun(run, scratchColour, clip);
        runs += 1;
      }
    }
    stats.runs += runs;
  }

  return {
    stats,
    get contextLost(): boolean {
      return contextLost;
    },
    get programBuilds(): number {
      return programBuilds;
    },
    get width(): number {
      return width;
    },
    get height(): number {
      return height;
    },
    resize(nextWidth: number, nextHeight: number): void {
      width = nextWidth;
      height = nextHeight;
    },
    drawFrame(scene: StaticScene, frameIndex: number): boolean {
      if (disposed || contextLost) return false;
      const frame = scene.frames[frameIndex];
      if (!frame) return false;
      beginFrame(stats);
      const index = indexScene(scene);
      gl.viewport(0, 0, Math.floor(width * scale), Math.floor(height * scale));
      const background = scene.stage.background;
      gl.clearColor(((background >> 16) & 0xff) / 255, ((background >> 8) & 0xff) / 255, (background & 0xff) / 255, 1);
      gl.enable(GL.BLEND);
      gl.blendFunc(GL.SRC_ALPHA, GL.ONE_MINUS_SRC_ALPHA);
      gl.disable(GL.STENCIL_TEST);
      scissorActive = false;
      scissorEmpty = false;
      gl.disable(GL.SCISSOR_TEST);
      gl.clear(GL.COLOR_BUFFER_BIT | GL.STENCIL_BUFFER_BIT);
      planFrame(frame, index);
      planner.forEach(drawBatch);
      setScissor(null);
      gl.bindVertexArray(null);
      endFrame(stats);
      return true;
    },
    handleContextLost(): void {
      contextLost = true;
      program = null;
      vertexArray = null;
      vertexBuffer = null;
      indexed = null;
      scissorActive = false;
      scissorEmpty = false;
      // CPU-side descriptions (scene, mesh cache) survive on purpose: they rebuild the GPU state.
    },
    handleContextRestored(): void {
      contextLost = false;
    },
    dispose(): void {
      if (disposed) return;
      disposed = true;
      if (program) gl.deleteProgram(program.handle);
      if (vertexBuffer) gl.deleteBuffer(vertexBuffer);
      if (vertexArray) gl.deleteVertexArray(vertexArray);
      program = null;
      vertexBuffer = null;
      vertexArray = null;
    },
  };
}

function compile(gl: GlContextLike, type: number, source: string): unknown {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, GL.COMPILE_STATUS)) {
    throw new GlProgramError(String(gl.getShaderInfoLog(shader) ?? 'compile failed'));
  }
  return shader;
}
