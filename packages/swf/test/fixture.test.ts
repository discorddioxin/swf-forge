/**
 * Golden fixture — Appendix A worked example, byte-for-byte (`IMPL-140` §2.1, `T-TST-101`).
 *
 * The file is checked in at `fixtures/appendix-a.swf`; the assertions below pin every value the
 * appendix states, so the fixture and the decoder drift apart loudly rather than silently.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { openSwf, toPixels } from '@swf-forge/swf';
import { buildSwf, showFrames } from '@swf-forge/swf/test-support';

const FIXTURE = fileURLToPath(new URL('../../../fixtures/appendix-a.swf', import.meta.url));

function fixture(): Uint8Array {
  return new Uint8Array(readFileSync(FIXTURE));
}

describe('fixtures/appendix-a.swf', () => {
  it('is the appendix bytes: FWS, version 3, FileLength 79', () => {
    const bytes = fixture();
    expect(bytes.length).toBe(79);
    expect(String.fromCharCode(...bytes.subarray(0, 3))).toBe('FWS');
    expect(bytes[3]).toBe(3);
    const declared = (bytes[4] ?? 0) | ((bytes[5] ?? 0) << 8) | ((bytes[6] ?? 0) << 16) | ((bytes[7] ?? 0) << 24);
    expect(declared).toBe(79);
  });

  it('decodes the header: 550x400 px, 12 fps, one frame', () => {
    const file = openSwf(fixture());
    expect(file.header.version).toBe(3);
    expect(file.header.fileLength).toBe(79);
    expect(file.header.frameRate).toBeCloseTo(12, 6);
    expect(file.header.frameCount).toBe(1);
    expect(file.header.frameSizePx.width).toBe(550);
    expect(file.header.frameSizePx.height).toBe(400);
    expect(toPixels(file.header.frameSize.xMax)).toBe(550);
    expect(file.header.frameSize.xMin).toBe(0);
    expect(file.header.frameSize.yMin).toBe(0);
  });

  it('walks the five tags in order and finds the one definition', () => {
    const file = openSwf(fixture());
    expect(file.tagIndex.tags.map((t) => t.code)).toEqual([9, 2, 26, 1, 0]);
    expect(file.definitions.map((d) => d.id)).toEqual([1]);
    expect(file.definitions.map((d) => d.tagCode)).toEqual([2]);
    // The DefineShape is the long-header tag: a 35-byte body does not fit the short form.
    const shapeTag = file.tagIndex.tags[1];
    expect(shapeTag?.longHeader).toBe(true);
    expect(shapeTag?.length).toBe(35);
    expect(file.tagIndex.tags[0]?.longHeader).toBe(false);
  });

  it('T-SWF-018 lazily builds the index on first access and memoizes the raw tag payload', () => {
    const bytes = buildSwf({ body: showFrames(1), frameCount: 1 });
    const file = openSwf(bytes, { indexStrategy: 'lazy' });
    expect(file.diagnostics.map((entry) => entry.code)).not.toContain('SF0102');
    expect(file.tagIndex.tags.map((entry) => entry.code)).toEqual([1]);
    expect(file.diagnostics.map((entry) => entry.code)).toContain('SF0102');
    const tag = file.tagIndex.tags[0];
    if (!tag) throw new Error('missing tag after lazy index');
    expect(file.readTag(tag)).toBe(file.readTag(tag));
  });

  it('reports no errors and re-reads the SetBackgroundColor payload', () => {
    const file = openSwf(fixture());
    expect(file.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    const first = file.tagIndex.tags[0];
    expect(first).toBeDefined();
    if (!first) throw new Error('missing first tag');
    const payload = file.readTag(first);
    expect(file.readTag(first)).toBe(payload);
    expect(payload.kind).toBe('bytes');
    if (payload.kind === 'bytes') {
      expect(Array.from(payload.view)).toEqual([0xff, 0xff, 0xff]);
    }
  });
});
