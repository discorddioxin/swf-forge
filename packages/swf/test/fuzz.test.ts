/**
 * Fuzz smoke — `IMPL-140` §7 / WP-020-11: a bounded, reproducible 10⁴-mutation pass over the
 * container with **zero uncaught exceptions** (soft mode must never throw), plus regression tests
 * for every crasher under `test/fuzz/corpus/` (`IMPL-140-R016`).
 *
 * The seed is fixed so the pass is reproducible from the recorded seed; a new crash is added to
 * the corpus with a failing assertion removed from this file and pinned there instead.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { openSwf } from '@swf-forge/swf';
import { nodeInflate } from '@swf-forge/swf/node';
import {
  buildSwf,
  concat,
  defineSprite,
  defineTag,
  endTag,
  placeObject2,
  showFrames,
  tag,
} from '@swf-forge/swf/test-support';

const SEED = 0x534f_5746; // 'SOWF'
const MUTATIONS = 10_000;

/** Deterministic LCG so the corpus is reproducible from the recorded seed. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function corpusFile(): Uint8Array {
  const sprite = defineSprite(2, 2, concat(placeObject2(1, 1), showFrames(2), endTag()));
  const body = concat(defineTag(2, 1), sprite, placeObject2(2, 1), tag(1), tag(1), endTag());
  return buildSwf({ body, frameCount: 2 });
}

function mutate(bytes: Uint8Array, rng: () => number): Uint8Array {
  let out = Uint8Array.from(bytes);
  const operations = 1 + Math.floor(rng() * 3);
  for (let i = 0; i < operations; i += 1) {
    const op = Math.floor(rng() * 4);
    if (out.length === 0) break;
    const at = Math.floor(rng() * (out.length + 1));
    if (op === 0) {
      out[at % out.length] = Math.floor(rng() * 256); // flip
    } else if (op === 1) {
      const next = new Uint8Array(out.length + 1);
      next.set(out.subarray(0, at), 0);
      next[at] = Math.floor(rng() * 256);
      next.set(out.subarray(at), at + 1);
      out = next;
    } else if (op === 2) {
      const cut = Math.min(at, out.length - 1);
      const next = new Uint8Array(Math.max(0, out.length - 1));
      next.set(out.subarray(0, cut), 0);
      next.set(out.subarray(at + 1 > out.length ? out.length : at + 1), cut);
      out = next;
    } else {
      const from = Math.floor(rng() * out.length);
      const to = Math.floor(rng() * out.length);
      out[to] = out[from] ?? 0; // copy
    }
  }
  return out;
}

describe('fuzz smoke (bounded CI pass, IMPL-140-R018)', () => {
  it(`survives ${MUTATIONS} seeded mutations with zero uncaught exceptions`, () => {
    const base = corpusFile();
    const rng = makeRng(SEED);
    let crashed: string | null = null;
    for (let i = 0; i < MUTATIONS && crashed === null; i += 1) {
      const bytes = mutate(base, rng);
      try {
        const file = openSwf(bytes, { inflate: nodeInflate });
        // Soft mode must always produce a file object (with diagnostics), never throw.
        expect(file.tagIndex).toBeDefined();
      } catch (error) {
        crashed = `mutation ${i} (seed ${SEED}) threw: ${error instanceof Error ? error.message : String(error)}`;
      }
    }
    expect(crashed).toBeNull();
  });
});

describe('crasher corpus regressions (IMPL-140-R016)', () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const corpusDir = join(here, 'fuzz', 'corpus');
  const files = (() => {
    try {
      return readdirSync(corpusDir).filter((name) => name.endsWith('.swf'));
    } catch {
      return [];
    }
  })();

  it(`opens every crasher under test/fuzz/corpus without throwing (${files.length} file(s))`, () => {
    // A missing or empty corpus fails the suite instead of passing vacuously (O-04r): the
    // regression obligation only holds if there is at least one pinned crasher to regress.
    expect(files.length).toBeGreaterThanOrEqual(1);
    for (const name of files) {
      const bytes = new Uint8Array(readFileSync(join(corpusDir, name)));
      expect(() => openSwf(bytes, { inflate: nodeInflate })).not.toThrow();
    }
  });
});
