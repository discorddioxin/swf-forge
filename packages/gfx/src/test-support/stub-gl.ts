/**
 * Recording stub for `GlContextLike` — the WebGL2 backend's test double.
 *
 * The backend is written against a structural subset of `WebGL2RenderingContext` precisely so it can
 * run in Node: this stub records every call, counts draws and validates the invariants the depth
 * buffer no longer hides (a program must be current before a draw; a VAO must be bound; stencil
 * masking must bracket the cover pass). A real context satisfies the same interface structurally, so
 * the tests and the browser take the same code path (`T-GFX-020`, `T-GFX-060`).
 */

import type { GlContextLike } from '@swf-forge/gfx';

export interface GlCall {
  readonly name: string;
  readonly args: readonly unknown[];
}

export interface StubGl {
  readonly gl: GlContextLike;
  readonly calls: GlCall[];
  readonly draws: { mode: number; count: number }[];
  readonly deleted: { program: number; buffer: number; vertexArray: number; shader: number };
  reset(): void;
  /** True when every observed draw happened with a current program and a bound VAO. */
  readonly drawsWereBound: boolean;
}

export function createStubGl(): StubGl {
  let nextObject = 1;
  let currentProgram: unknown = null;
  let boundVertexArray: unknown = null;
  let anyDrawUnbound = false;
  const calls: GlCall[] = [];
  const draws: { mode: number; count: number }[] = [];
  const deleted = { program: 0, buffer: 0, vertexArray: 0, shader: 0 };
  const shaderResults = new Map<unknown, boolean>();

  function record(name: string, ...args: unknown[]): void {
    calls.push({ name, args });
  }

  const gl: GlContextLike = {
    createShader(type) {
      record('createShader', type);
      const shader = { id: nextObject++ };
      shaderResults.set(shader, true);
      return shader;
    },
    shaderSource(shader, source) {
      record('shaderSource', shader, source);
    },
    compileShader(shader) {
      record('compileShader', shader);
    },
    getShaderParameter(shader, pname) {
      record('getShaderParameter', shader, pname);
      return shaderResults.get(shader) ?? false;
    },
    getShaderInfoLog() {
      return null;
    },
    deleteShader(shader) {
      deleted.shader += 1;
      record('deleteShader', shader);
    },
    createProgram() {
      record('createProgram');
      return { id: nextObject++ };
    },
    attachShader(program, shader) {
      record('attachShader', program, shader);
    },
    linkProgram(program) {
      record('linkProgram', program);
    },
    getProgramParameter() {
      return true;
    },
    getProgramInfoLog() {
      return null;
    },
    useProgram(program) {
      currentProgram = program;
      record('useProgram', program);
    },
    deleteProgram(program) {
      deleted.program += 1;
      record('deleteProgram', program);
    },
    getAttribLocation() {
      return 0;
    },
    getUniformLocation(program, name) {
      return { program, name };
    },
    createBuffer() {
      record('createBuffer');
      return { id: nextObject++ };
    },
    bindBuffer(target, buffer) {
      record('bindBuffer', target, buffer);
    },
    bufferData(target, data, usage) {
      record('bufferData', target, data, usage);
    },
    deleteBuffer(buffer) {
      deleted.buffer += 1;
      record('deleteBuffer', buffer);
    },
    createVertexArray() {
      record('createVertexArray');
      return { id: nextObject++ };
    },
    bindVertexArray(vertexArray) {
      boundVertexArray = vertexArray;
      record('bindVertexArray', vertexArray);
    },
    deleteVertexArray(vertexArray) {
      deleted.vertexArray += 1;
      record('deleteVertexArray', vertexArray);
    },
    enableVertexAttribArray(index) {
      record('enableVertexAttribArray', index);
    },
    vertexAttribPointer(...args) {
      record('vertexAttribPointer', ...args);
    },
    uniform4f(location, x, y, z, w) {
      record('uniform4f', location, x, y, z, w);
    },
    enable(cap) {
      record('enable', cap);
    },
    disable(cap) {
      record('disable', cap);
    },
    clearColor(r, g, b, a) {
      record('clearColor', r, g, b, a);
    },
    clear(mask) {
      record('clear', mask);
    },
    colorMask(r, g, b, a) {
      record('colorMask', r, g, b, a);
    },
    blendFunc(source, destination) {
      record('blendFunc', source, destination);
    },
    stencilFunc(func, ref, mask) {
      record('stencilFunc', func, ref, mask);
    },
    stencilOp(fail, zfail, zpass) {
      record('stencilOp', fail, zfail, zpass);
    },
    stencilOpSeparate(face, fail, zfail, zpass) {
      record('stencilOpSeparate', face, fail, zfail, zpass);
    },
    stencilMask(mask) {
      record('stencilMask', mask);
    },
    clearStencil(value) {
      record('clearStencil', value);
    },
    viewport(x, y, width, height) {
      record('viewport', x, y, width, height);
    },
    scissor(x, y, width, height) {
      record('scissor', x, y, width, height);
    },
    drawArrays(mode, first, count) {
      if (currentProgram === null || boundVertexArray === null) anyDrawUnbound = true;
      draws.push({ mode, count });
      record('drawArrays', mode, first, count);
    },
  };

  return {
    gl,
    calls,
    draws,
    deleted,
    reset() {
      calls.length = 0;
      draws.length = 0;
    },
    get drawsWereBound() {
      return !anyDrawUnbound;
    },
  };
}
