#!/usr/bin/env node
/**
 * Browser-lane provisioning and capability probe.
 *
 * `IMPL-010` §11 criterion 1 requires every §8 primitive vector to pass "on Node and in the browser
 * test runner"; `REPO-§10` defines a `browser` CI stage and `TECH-SPEC` §3.3/§4.2 name
 * `*.browser.test.ts` + vitest browser mode as the mechanism. This tool makes that lane runnable.
 *
 * Two provisioning paths are supported, because they have different network requirements:
 *
 *   1. Normal development / CI:  `pnpm exec playwright install chromium`
 *      Playwright downloads an engine build into `~/.cache/ms-playwright`. This probe finds it.
 *   2. Restricted-network hosts (only `registry.npmjs.org`, `pypi.org` and `github.com` reachable —
 *      Playwright's browser CDN is not):  `node tools/browser-lane.mjs install`
 *      Fetches the `@sparticuz/chromium` npm tarball (which ships a brotli-compressed headless
 *      Chromium *and* its NSS/NSPR runtime libraries inside the package), unpacks it into
 *      `~/.cache/swf-forge-browser`, and verifies it executes.
 *
 * Neither path commits a browser binary: `REPO-R017`'s "fetch, do not commit" policy for large
 * third-party artifacts applies to engines too. The cache directory is outside the repository.
 *
 * Subcommands:
 *   probe    print a JSON capability report; exit 0 when a usable engine was found, 3 when not
 *   install  provision path 2 (linux x64 only), then re-probe
 *   env      print `export` lines for the resolved engine (for shell/CI use)
 *
 * Node >= 20, no third-party dependencies (this file lives under `tools/`, which the root TS
 * project and the ESLint flat config both exclude — same standing as `tools/avm1-restart-probe.mjs`).
 */

import { createBrotliDecompress } from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { chmodSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { get as httpsGet } from 'node:https';
import { pipeline } from 'node:stream/promises';

const CACHE = join(homedir(), '.cache', 'swf-forge-browser');
const PLAYWRIGHT_CACHE = join(homedir(), '.cache', 'ms-playwright');
const BINARY = join(CACHE, 'headless-chromium');
const LIBDIR = join(CACHE, 'lib');
const NPM_PACKAGE = '@sparticuz/chromium';
const REGISTRY = 'https://registry.npmjs.org';

/** A usable engine, or `null`. `libraryPath` is set when the build needs bundled shared objects. */
function resolveEngine() {
  // 1. Explicit override — what CI and unusual layouts should set.
  const override = process.env.SWF_FORGE_BROWSER_EXECUTABLE;
  if (override) {
    if (!existsSync(override)) return { error: `SWF_FORGE_BROWSER_EXECUTABLE points at a missing file: ${override}` };
    return {
      source: 'env:SWF_FORGE_BROWSER_EXECUTABLE',
      executablePath: override,
      libraryPath: process.env.SWF_FORGE_BROWSER_LIBRARY_PATH ?? null,
    };
  }

  // 2. The restricted-network recipe this tool installs.
  if (existsSync(BINARY)) {
    return {
      source: `cache:${CACHE}`,
      executablePath: BINARY,
      libraryPath: existsSync(LIBDIR) ? LIBDIR : null,
    };
  }

  // 3. Playwright's own registry (the normal `playwright install chromium` result).
  if (existsSync(PLAYWRIGHT_CACHE)) {
    const builds = readdirSync(PLAYWRIGHT_CACHE).filter((d) => d.startsWith('chromium-')).sort().reverse();
    for (const build of builds) {
      for (const rel of ['chrome-linux/headless_shell', 'chrome-linux/chrome', 'chrome-win/chrome.exe']) {
        const candidate = join(PLAYWRIGHT_CACHE, build, rel);
        if (existsSync(candidate)) {
          return { source: `playwright:${build}`, executablePath: candidate, libraryPath: null };
        }
      }
    }
  }

  // 4. A system browser already on PATH.
  for (const name of ['headless_shell', 'chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    const found = spawnSync('command', ['-v', name], { encoding: 'utf8', shell: '/bin/bash' });
    const path = (found.stdout ?? '').trim();
    if (path) return { source: `path:${name}`, executablePath: path, libraryPath: null };
  }

  return null;
}

/** Run `<engine> --version` with the bundled libraries on `LD_LIBRARY_PATH`, if any. */
function verify(engine) {
  const env = { ...process.env };
  if (engine.libraryPath) env.LD_LIBRARY_PATH = [engine.libraryPath, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  const run = spawnSync(engine.executablePath, ['--version'], { encoding: 'utf8', env, timeout: 60_000 });
  if (run.status === 0 && run.stdout?.trim()) return { ok: true, version: run.stdout.trim() };
  return {
    ok: false,
    version: null,
    error: (run.stderr ?? run.stdout ?? `exit ${run.status}`).trim().split('\n').slice(0, 3).join(' | '),
  };
}

function report() {
  const engine = resolveEngine();
  if (!engine) {
    return {
      available: false,
      reason:
        'no browser engine found. Run `pnpm exec playwright install chromium`, or on a host that ' +
        'cannot reach the Playwright CDN run `node tools/browser-lane.mjs install`.',
    };
  }
  if (engine.error) return { available: false, reason: engine.error };
  const check = verify(engine);
  return {
    available: check.ok,
    engine: 'chromium',
    source: engine.source,
    executablePath: engine.executablePath,
    libraryPath: engine.libraryPath,
    version: check.version,
    reason: check.ok ? undefined : check.error,
  };
}

// ---- install (restricted-network recipe) -------------------------------------------------------

function fetch(url, destination, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error(`too many redirects for ${url}`));
    httpsGet(url, { headers: { 'user-agent': 'swf-forge-browser-lane' } }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        return resolve(fetch(new URL(res.headers.location, url).toString(), destination, redirects + 1));
      }
      if (status !== 200) {
        res.resume();
        return reject(new Error(`${status} for ${url}`));
      }
      const out = createWriteStream(destination);
      res.pipe(out);
      out.on('finish', () => out.close(() => resolve(statSync(destination).size)));
      out.on('error', reject);
    }).on('error', reject);
  });
}

const unbrotli = (input, output) =>
  pipeline(createReadStream(input), createBrotliDecompress(), createWriteStream(output));

function sh(command, args, opts = {}) {
  const run = spawnSync(command, args, { encoding: 'utf8', ...opts });
  if (run.status !== 0) throw new Error(`${command} ${args.join(' ')} failed: ${(run.stderr ?? '').trim()}`);
  return run.stdout;
}

async function install() {
  if (process.platform !== 'linux' || process.arch !== 'x64') {
    console.error(
      `install supports linux/x64 only (this host: ${process.platform}/${process.arch}).\n` +
        'Elsewhere use `pnpm exec playwright install chromium`; the probe finds that build automatically.',
    );
    process.exit(2);
  }

  console.log(`resolving ${NPM_PACKAGE} from ${REGISTRY}`);
  const packumentPath = join(tmpdir(), `swf-forge-packument-${process.pid}.json`);
  await fetch(`${REGISTRY}/${encodeURIComponent(NPM_PACKAGE).replace('%40', '@')}`, packumentPath);
  const packument = JSON.parse(await import('node:fs').then((m) => m.promises.readFile(packumentPath, 'utf8')));
  const version = packument['dist-tags']?.latest;
  const tarball = version && packument.versions?.[version]?.dist?.tarball;
  if (!tarball) throw new Error(`could not resolve a tarball URL for ${NPM_PACKAGE}`);
  console.log(`  ${NPM_PACKAGE}@${version}\n  ${tarball}`);

  const staging = join(tmpdir(), `swf-forge-browser-${process.pid}`);
  rmSync(staging, { recursive: true, force: true });
  mkdirSync(staging, { recursive: true });

  const tgz = join(staging, 'package.tgz');
  console.log(`downloading (${tarball.startsWith(REGISTRY) ? 'allowed host' : 'external host'})`);
  const bytes = await fetch(tarball, tgz);
  console.log(`  ${(bytes / 1e6).toFixed(1)} MB`);

  sh('tar', ['-xzf', tgz, '-C', staging]);
  const bin = join(staging, 'package', 'bin');
  if (!existsSync(join(bin, 'chromium.br'))) throw new Error(`unexpected package layout: ${bin}`);

  mkdirSync(CACHE, { recursive: true });
  console.log(`unpacking into ${CACHE}`);
  await unbrotli(join(bin, 'chromium.br'), BINARY);
  chmodSync(BINARY, 0o755);
  console.log(`  headless-chromium  ${(statSync(BINARY).size / 1e6).toFixed(1)} MB`);

  // The engine build needs NSS/NSPR; the package ships them for Amazon Linux 2023, which runs on
  // glibc >= 2.34 and therefore on Debian 12 / Ubuntu 22.04+ as well.
  mkdirSync(LIBDIR, { recursive: true });
  if (existsSync(join(bin, 'al2023.tar.br'))) {
    const libs = join(staging, 'al2023.tar');
    await unbrotli(join(bin, 'al2023.tar.br'), libs);
    sh('tar', ['-xf', libs, '-C', CACHE]);
    console.log(`  lib/               ${readdirSync(LIBDIR).length} shared objects`);
  }
  // Software GL, so a future gfx lane can request a rasteriser without a GPU.
  if (existsSync(join(bin, 'swiftshader.tar.br'))) {
    const sw = join(staging, 'swiftshader.tar');
    await unbrotli(join(bin, 'swiftshader.tar.br'), sw);
    try {
      sh('tar', ['-xf', sw, '-C', CACHE]);
      console.log('  swiftshader/       software rasteriser');
    } catch {
      console.log('  swiftshader/       skipped (unexpected layout)');
    }
  }

  rmSync(staging, { recursive: true, force: true });
  rmSync(packumentPath, { force: true });

  const result = report();
  console.log(result.available ? `\nverified: ${result.version} (${result.source})` : `\nFAILED: ${result.reason}`);
  process.exit(result.available ? 0 : 3);
}

// ---- entry ------------------------------------------------------------------------------------

const command = process.argv[2] ?? 'probe';
if (command === 'install') {
  await install();
} else if (command === 'env') {
  const result = report();
  if (!result.available) {
    console.error(result.reason ?? 'no browser engine available');
    process.exit(3);
  }
  console.log(`export SWF_FORGE_BROWSER_EXECUTABLE=${result.executablePath}`);
  if (result.libraryPath) console.log(`export SWF_FORGE_BROWSER_LIBRARY_PATH=${result.libraryPath}`);
} else if (command === 'probe') {
  const result = report();
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.available ? 0 : 3);
} else {
  console.error(`unknown subcommand: ${command} (expected probe | install | env)`);
  process.exit(2);
}
