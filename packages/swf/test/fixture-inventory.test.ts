/**
 * Fixture inventory — `T-SWF-009` (`IMPL-010` §8): two parses of every fixture produce identical
 * offsets and values.
 *
 * "Every fixture" is bounded by roadmap §4.2 to the in-repo corpus (C1 in
 * `docs/impl/registers/corpus.md` §1): the 21 committed `.swf` files under `fixtures/` plus the 5
 * crasher-corpus files under `test/fuzz/corpus/`. The list below is the checked-in inventory: the
 * directory walk must match it exactly, so adding or removing a fixture without updating this
 * inventory (and the register) fails here rather than silently changing what "every" means. The
 * register's own count line is asserted as well, so the two inventories cannot drift apart.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

import { openSwf, type SwfFile } from '@swf-forge/swf';
import { nodeInflate } from '@swf-forge/swf/node';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '..', '..', '..');
const fixtureRoot = join(repoRoot, 'fixtures');
const crasherRoot = join(here, 'fuzz', 'corpus');

/** The C1 inventory, repo-relative, sorted. 21 committed fixtures + 5 crasher-corpus files = 26. */
const EXPECTED_C1: readonly string[] = [
  'fixtures/appendix-a.swf',
  'fixtures/static/clip-mask.swf',
  'fixtures/static/cxform-add.swf',
  'fixtures/static/cxform-mult.swf',
  'fixtures/static/depth-order.swf',
  'fixtures/static/hairline-stroke.swf',
  'fixtures/static/invisible-placement.swf',
  'fixtures/static/matrix-rotate.swf',
  'fixtures/static/matrix-scale.swf',
  'fixtures/static/nonzero-hole.swf',
  'fixtures/static/quad-curves.swf',
  'fixtures/static/solid-rect.swf',
  'fixtures/static/sprite-loop.swf',
  'fixtures/static/sprite-nested.swf',
  'fixtures/static/stress-grid.swf',
  'fixtures/static/stroke-bevel-join.swf',
  'fixtures/static/stroke-miter-join.swf',
  'fixtures/static/stroke-round-caps.swf',
  'fixtures/static/stroke-square-caps.swf',
  'fixtures/static/timeline-frames.swf',
  'fixtures/static/two-fills-hole.swf',
  'packages/swf/test/fuzz/corpus/crash-001-truncated-body.swf',
  'packages/swf/test/fuzz/corpus/crash-002-tag-length-past-eof.swf',
  'packages/swf/test/fuzz/corpus/crash-003-sprite-missing-end.swf',
  'packages/swf/test/fuzz/corpus/crash-004-zlib-invalid-stream.swf',
  'packages/swf/test/fuzz/corpus/crash-005-shape-edge-past-limit.swf',
];

function walkSwf(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .flatMap((entry) => {
      const full = join(root, entry.name);
      if (entry.isDirectory()) return walkSwf(full);
      return entry.isFile() && entry.name.endsWith('.swf') ? [full] : [];
    })
    .map((full) => relative(repoRoot, full).split(sep).join('/'))
    .sort();
}

/** The parse projection `T-SWF-009` compares: header values, tag offsets, dictionary, diagnostics. */
function projection(file: SwfFile): unknown {
  return {
    header: {
      version: file.header.version,
      fileLength: file.header.fileLength,
      frameRateRaw: file.header.frameRateRaw,
      frameCount: file.header.frameCount,
      frameSize: file.header.frameSize,
    },
    sizes: file.sizes,
    sha256: file.sha256,
    tags: file.tagIndex.tags.map((t) => ({
      code: t.code,
      offset: t.offset,
      headerOffset: t.headerOffset,
      length: t.length,
      depth: t.depth,
      inSprite: t.inSprite,
      index: t.index,
    })),
    definitions: file.definitions.map((d) => ({ id: d.id, tagCode: d.tagCode })),
    diagnostics: file.diagnostics.map((d) => ({ code: d.code, offset: d.offset })),
  };
}

describe('fixture inventory (C1)', () => {
  it('T-SWF-009: the directory walk matches the checked-in inventory and the register count', () => {
    const found = [...walkSwf(fixtureRoot), ...walkSwf(crasherRoot)].sort();
    expect(found).toEqual([...EXPECTED_C1]);
    const register = readFileSync(join(repoRoot, 'docs/impl/registers/corpus.md'), 'utf8');
    expect(register).toContain('21 + 5 = **26**');
    expect(EXPECTED_C1.length).toBe(26);
  });

  it('T-SWF-009: two parses of every fixture produce identical offsets and values', () => {
    for (const rel of EXPECTED_C1) {
      const bytes = new Uint8Array(readFileSync(join(repoRoot, rel)));
      const first = projection(openSwf(bytes, { inflate: nodeInflate }));
      const second = projection(openSwf(bytes, { inflate: nodeInflate }));
      expect(second).toEqual(first);
    }
  });
});
