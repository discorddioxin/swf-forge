/**
 * Browser lane — `IMPL-010` §11 criterion 1, `REPO-§10`'s `browser` CI stage, `TECH-SPEC` §4.2.
 *
 * Runs the cross-lane suites (`*.lanes.test.ts`) in a real headless browser engine instead of Node,
 * so the same vector definitions are executed by both hosts. Deliberately a **separate config**: the
 * default lane (`vitest.config.ts`, `pnpm test`) is untouched, and this one is opt-in via
 * `pnpm test:browser`.
 *
 * Engine resolution is delegated to `tools/browser-lane.mjs probe`, which finds, in order:
 * `SWF_FORGE_BROWSER_EXECUTABLE`, the restricted-network cache this repo's installer fills
 * (`~/.cache/swf-forge-browser`), Playwright's own registry (`~/.cache/ms-playwright`, the normal CI
 * path), then a system browser on `PATH`. When the engine is not Playwright's own managed build the
 * resolved executable is passed through `providerOptions.launch.executablePath`, together with the
 * bundled NSS/NSPR library path the restricted-network build needs.
 *
 * A missing engine is a hard, explained failure rather than a silent skip: an absent browser lane
 * that reports green is exactly the failure mode `audits/P0-AUDIT.md` F-P0-01 records.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

interface ProbeReport {
  readonly available: boolean;
  readonly engine?: string;
  readonly source?: string;
  readonly executablePath?: string;
  readonly libraryPath?: string | null;
  readonly version?: string | null;
  readonly reason?: string;
}

function probe(): ProbeReport {
  const parse = (text: string): ProbeReport => {
    const start = text.indexOf('{');
    return start < 0
      ? { available: false, reason: `no JSON from the browser probe: ${text.slice(0, 200)}` }
      : (JSON.parse(text.slice(start)) as ProbeReport);
  };
  try {
    return parse(execFileSync(process.execPath, [r('tools/browser-lane.mjs'), 'probe'], { encoding: 'utf8' }));
  } catch (error) {
    // The probe exits 3 when no engine is usable; its JSON report is on stdout either way.
    const stdout = (error as { stdout?: string }).stdout ?? '';
    return stdout.includes('{') ? parse(stdout) : { available: false, reason: String(error) };
  }
}

const report = probe();
if (!report.available) {
  throw new Error(
    `[browser lane] no usable browser engine.\n  reason: ${report.reason ?? 'unknown'}\n` +
      '  fix (normal hosts):   pnpm exec playwright install chromium\n' +
      '  fix (restricted net):   node tools/browser-lane.mjs install\n' +
      '  fix (explicit path):    SWF_FORGE_BROWSER_EXECUTABLE=/path/to/chrome pnpm test:browser',
  );
}

// Playwright's own managed build already matches the driver's expected revision, so only override
// the executable when the engine came from somewhere else.
const managedByPlaywright = (report.source ?? '').startsWith('playwright:');
const launch: Record<string, unknown> = {
  // Container/CI friendly: no sandbox daemon and no dependence on a large /dev/shm.
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
};
if (!managedByPlaywright) {
  launch.executablePath = report.executablePath;
  if (report.libraryPath) {
    launch.env = {
      ...process.env,
      LD_LIBRARY_PATH: [report.libraryPath, process.env.LD_LIBRARY_PATH].filter(Boolean).join(':'),
    };
  }
}

// Built as a variable, not an inline literal: `BrowserProviderOptions` is an open interface in
// Vitest 2.1 and the provider reads `providerOptions.launch` directly.
const browser = {
  enabled: true,
  provider: 'playwright' as const,
  name: 'chromium' as const,
  headless: true,
  providerOptions: { launch },
};

process.stdout.write(`[browser lane] ${report.version ?? report.engine} via ${report.source}\n`);

export default defineConfig({
  // Injected marker. The cross-lane suite asserts it, so a browser lane that silently executed
  // under Node cannot pass as browser evidence — the failure mode `audits/P0-AUDIT.md` F-P0-01
  // records ("no browser evidence in this environment").
  define: { __SWF_FORGE_BROWSER_LANE__: 'true' },
  resolve: {
    // Mirrors `vitest.config.ts` for the reader package, and resolves to *source* rather than the
    // built `dist/` so the browser lane never depends on a prior `pnpm build`.
    //
    // `@swf-forge/audio` is aliased because `packages/swf/src/model/timeline.ts` imports it, and its
    // `package.json` exports map points at `dist/`. It is browser-safe: `packages/audio/src` has no
    // `node:` imports. (`@swf-forge/assets` is *not* reachable from this graph — the only mention in
    // `packages/swf/src` is a comment in `tags/images.ts` — and it is not browser-bundleable, since
    // `assets/src/fonts.ts` shells out via `node:child_process`. Keep it out of any browser lane.)
    alias: {
      '@swf-forge/swf/test-support': r('packages/swf/src/test-support/index.ts'),
      '@swf-forge/swf/node': r('packages/swf/src/node/index.ts'),
      '@swf-forge/swf': r('packages/swf/src/index.ts'),
      '@swf-forge/audio': r('packages/audio/src/index.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.lanes.test.ts', 'apps/*/test/**/*.lanes.test.ts'],
    reporters: ['default'],
    browser,
  },
});
