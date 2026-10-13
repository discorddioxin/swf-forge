/**
 * Test doubles and scene builders shipped with the renderer
 * (`pnpm`-visible only; the browser bundle never imports this entry).
 *
 * The WebGL2 backend is written against a structural `GlContextLike` subset so a recording stub can
 * exercise the exact code path a browser takes (`T-GFX-020`, `T-GFX-060`, `T-GFX-072`). It lives
 * here rather than in `test/` because more than one package's tests need it, mirroring the
 * sibling-package `test-support` entry pattern.
 */

export { perfStaticScene } from './perf-static.js';
export { createStubGl } from './stub-gl.js';
export type { GlCall, StubGl } from './stub-gl.js';
