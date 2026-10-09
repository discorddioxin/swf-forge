/**
 * Demo bundle emission for `render --demo` — the browser half of the P4 gate.
 *
 * The demo is a static site: the scene bundle plus the compiled `engine-flash` viewer and the
 * compiled `@swf-forge/gfx` modules it imports. There is no bundler in this repository on purpose
 * (`TECH-SPEC` §4: `tsc` is the whole toolchain), so the viewer's bare `@swf-forge/gfx` import is
 * resolved by an **import map** that points at the copied vendor tree. That keeps the demo a plain
 * static directory any file server can serve.
 *
 * Missing build output is a diagnosed no-op, never a half-written demo.
 */

import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface DemoResult {
  readonly written: boolean;
  readonly reason: string | null;
}

/** Absolute path of the repository root, from wherever this module runs (src or dist). */
function repoRoot(): string {
  // `apps/decompiler/{src|dist}/render/demo.js` → four levels up.
  return dirname(dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url))))));
}

/**
 * Writes `<out>/demo/` with `index.html`, `scene.json`, the viewer and the vendored renderer.
 */
export function writeDemoBundle(out: string, sceneJson: string): DemoResult {
  const root = repoRoot();
  const viewerEntry = join(root, 'apps', 'engine-flash', 'dist', 'main.js');
  const gfxDist = join(root, 'packages', 'gfx', 'dist');
  if (!existsSync(viewerEntry) || !existsSync(gfxDist)) {
    return {
      written: false,
      reason: 'engine-flash and @swf-forge/gfx must be built first (corepack pnpm build)',
    };
  }

  const demo = join(out, 'demo');
  mkdirSync(join(demo, 'vendor', 'gfx'), { recursive: true });
  cpSync(gfxDist, join(demo, 'vendor', 'gfx'), { recursive: true });
  // The viewer's compiled modules sit next to `index.html` so its relative imports resolve, and the
  // bare `@swf-forge/gfx` specifier is resolved by the import map written below.
  cpSync(join(root, 'apps', 'engine-flash', 'dist'), demo, { recursive: true });
  cpSync(join(root, 'apps', 'engine-flash', 'index.html'), join(demo, 'index.html'));
  writeFileSync(join(demo, 'scene.json'), sceneJson, 'utf8');
  const importMap = {
    imports: {
      '@swf-forge/gfx': './vendor/gfx/index.js',
    },
  };
  writeFileSync(join(demo, 'importmap.json'), `${JSON.stringify(importMap, null, 2)}\n`, 'utf8');
  // The HTML carries the import map inline: it must be parsed before the module graph loads.
  const html = readFileSync(join(demo, 'index.html'), 'utf8').replace(
    '</head>',
    `  <script type="importmap">${JSON.stringify(importMap)}</script>\n</head>`,
  );
  writeFileSync(join(demo, 'index.html'), html, 'utf8');
  return { written: true, reason: null };
}
