/**
 * The P4 golden suite — the "20 no-script fixtures within tolerance" exit criterion
 * (`IMPL-000` §6 P4, `TST` §6.1, `IMPL-140-R013`).
 *
 * For every fixture in the corpus this test:
 *
 * 1. checks the committed `.swf` bytes against the generator (`T-…`: the fixture is frozen, so a
 *    golden can never drift silently with its input);
 * 2. runs the production CLI path (`runRender`) and compares the manifest — per-frame RGBA and PNG
 *    hashes, draw-call/vertex counters, source and scene hashes — with the committed golden;
 * 3. runs it a second time and asserts the manifest and the scene bundle are byte-identical, which
 *    is the two-run reproducibility rule the P3 asset bundle also uses.
 *
 * Re-generate after an *intended* renderer change with `P4_UPDATE_GOLDENS=1 pnpm vitest run
 * apps/decompiler/test/render-goldens.test.ts`; the diff is then reviewable in git like any other
 * golden change (a golden that changes without a renderer change is a renderer bug).
 */

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { staticFixtures } from '@swf-forge/swf/test-support';

import { runRender, type RenderManifest } from '../src/commands/render.js';
import type { CliIo } from '../src/exit.js';

const FIXTURE_DIR = fileURLToPath(new URL('../../../fixtures/static/', import.meta.url));
const GOLDEN_DIR = fileURLToPath(new URL('../../../fixtures/goldens/static/', import.meta.url));
const UPDATE = process.env['P4_UPDATE_GOLDENS'] === '1';
const WORK = mkdtempSync(join(tmpdir(), 'swf-forge-p4-'));
afterAll(() => rmSync(WORK, { recursive: true, force: true }));

const fixtures = staticFixtures();

function capture(): { io: CliIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (line) => out.push(line), err: (line) => err.push(line) }, out, err };
}

/** Writes the fixture (when updating) and returns the path the CLI should read. */
function fixturePath(name: string, bytes: Uint8Array): string {
  mkdirSync(FIXTURE_DIR, { recursive: true });
  const path = join(FIXTURE_DIR, `${name}.swf`);
  if (UPDATE) writeFileSync(path, bytes);
  return path;
}

function renderInto(fixture: (typeof fixtures)[number], dir: string): RenderManifest {
  const path = fixturePath(fixture.name, fixture.bytes);
  const { io, err } = capture();
  const code = runRender({ file: path, out: dir, images: true }, io);
  expect({ fixture: fixture.name, code, err }).toEqual({ fixture: fixture.name, code: 0, err: [] });
  return JSON.parse(readFileSync(join(dir, 'render-manifest.json'), 'utf8')) as RenderManifest;
}

describe('P4 golden suite', () => {
  it('has a fixture corpus of exactly twenty movies', () => {
    expect(fixtures).toHaveLength(20);
  });

  it('matches the committed fixture bytes for every movie', () => {
    const missing: string[] = [];
    for (const fixture of fixtures) {
      const path = join(FIXTURE_DIR, `${fixture.name}.swf`);
      try {
        expect(readFileSync(path)).toEqual(Buffer.from(fixture.bytes));
      } catch {
        missing.push(fixture.name);
      }
    }
    // A missing file means the corpus was never committed; an unequal file means the encoder moved
    // under a golden, which is exactly what freezing the bytes is meant to catch.
    expect(missing).toEqual([]);
  });

  for (const fixture of fixtures) {
    it(`golden: ${fixture.name} — ${fixture.covers}`, () => {
      const first = join(WORK, `${fixture.name}-a`);
      const manifest = renderInto(fixture, first);
      const sceneBytes = readFileSync(join(first, 'scene.json'));
      const manifestBytes = readFileSync(join(first, 'render-manifest.json'));

      expect(manifest.frames).toHaveLength(fixture.frameCount);
      expect(manifest.source.sha256).toMatch(/^sha256:[0-9a-f]{64}$/);
      for (const frame of manifest.frames) {
        expect(frame.rgba).toMatch(/^[0-9a-f]{64}$/);
        expect(frame.png).toMatch(/^[0-9a-f]{64}$/);
      }

      // 2. determinism: a second run in a fresh directory is byte-identical.
      const second = join(WORK, `${fixture.name}-b`);
      const repeat = renderInto(fixture, second);
      expect(repeat).toEqual(manifest);
      expect(readFileSync(join(second, 'scene.json'))).toEqual(sceneBytes);
      expect(readFileSync(join(second, 'render-manifest.json'))).toEqual(manifestBytes);

      // 3. the committed golden.
      const goldenPath = join(GOLDEN_DIR, `${fixture.name}.json`);
      if (UPDATE) {
        mkdirSync(GOLDEN_DIR, { recursive: true });
        writeFileSync(goldenPath, manifestBytes);
        return;
      }
      const golden = JSON.parse(readFileSync(goldenPath, 'utf8')) as RenderManifest;
      expect(golden.source).toEqual(manifest.source);
      expect(golden.stage).toEqual(manifest.stage);
      expect(golden.report).toEqual(manifest.report);
      expect(golden.scene).toEqual(manifest.scene);
      expect(golden.frames).toEqual(manifest.frames);
    });
  }

  it('keeps every fixture inside the per-frame draw-call budget it records', () => {
    const goldens = fixtures.map(
      (fixture) => JSON.parse(readFileSync(join(GOLDEN_DIR, `${fixture.name}.json`), 'utf8')) as RenderManifest,
    );
    for (const golden of goldens) {
      // GFX §16 worst-case fixture budget (2000 desktop) is the hard cap; the P4 corpus is small
      // enough that the batcher keeps every fixture two orders of magnitude below it.
      const worst = Math.max(...golden.frames.map((frame) => frame.drawCalls));
      expect(worst).toBeLessThanOrEqual(2000);
    }
  });
});
