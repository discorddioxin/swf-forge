/**
 * Container obligations — `T-SWF-002` (truncation at every offset), `T-SWF-008` (sprite nesting
 * 31/32/33), `T-SWF-010` (emitted codes inside their documented ranges), `T-SWF-011` (cap abort),
 * `T-SWF-012` (open determinism), `T-SWF-021` (zero-copy tag views).
 */
import { deflateSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { buildMovieModel, openSwf, openSwfAsync } from '@swf-forge/swf';
import type { SwfFile } from '@swf-forge/swf';
import { codeInfo } from '@swf-forge/swf';
import { nodeInflate, nodeInflateLzma, openSwfNodeAsync, openSwfNodeSync } from '@swf-forge/swf/node';
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

/** The tag stream shared by every fixture in this file. */
function corpusBody(): Uint8Array {
  const inner = defineSprite(3, 1, concat(placeObject2(1, 2), showFrames(1), endTag()));
  const sprite = defineSprite(2, 2, concat(placeObject2(1, 1), inner, showFrames(2), endTag()));
  return concat(defineTag(2, 1), sprite, placeObject2(2, 1), tag(1), tag(1), endTag());
}

/** A synthetic file with two sprites (one nested), placements and a sound. */
function corpus(): Uint8Array {
  return buildSwf({ body: corpusBody(), frameCount: 2 });
}

function fingerprint(file: SwfFile): string {
  const tags = file.tagIndex.tags.map((t) => `${t.code}@${t.offset}+${t.length}/d${t.depth}/s${t.inSprite}`);
  const definitions = file.definitions.map((d) => `${d.id}:${d.tagCode}@${d.offset}`);
  const diagnostics = file.diagnostics.map((d) => `${d.code}@${d.offset}x${d.count}`);
  return JSON.stringify([tags, definitions, diagnostics]);
}

describe('T-SWF-002 truncation at every byte offset', () => {
  it('opens every prefix with no exception, diagnostics present, and indexed tags as a prefix', () => {
    const full = corpus();
    const baseline = openSwf(full);
    const baselineTags = baseline.tagIndex.tags;
    // `TagRef` offsets are relative to the tag stream (`baseline.body`); the tag stream starts
    // at this file offset. A truncation before it tears the header, not the tag stream.
    const bodyStart = baseline.body.byteOffset;
    let checked = 0;
    for (let length = 0; length <= full.length; length += 1) {
      const file = openSwf(full.subarray(0, length));
      checked += 1;
      if (length < full.length) {
        // A truncated file is never silent: FileLength mismatch, past-end, or missing End.
        expect(file.diagnostics.length).toBeGreaterThanOrEqual(1);
      }
      if (length < bodyStart) continue; // the header itself is torn; no tag-level contract
      // `tagIndex.tags` is flat (top-level and nested, distinguished by `inSprite`). Every
      // top-level baseline tag whose full byte range is present must be indexed, in order, with
      // the same code and length. A truncation inside a tag body yields at most one extra
      // past-end tag; one inside a tag header yields at most one soft-read End — so at most one
      // recovery tag total. Nested tags of a sprite whose body is torn are not indexed.
      const topBaseline = baselineTags.filter((t) => t.inSprite === null);
      const completeTop = topBaseline.filter((t) => bodyStart + t.offset + t.length <= length).length;
      const completeAll = baselineTags.filter((t) => bodyStart + t.offset + t.length <= length).length;
      const indexedTop = file.tagIndex.tags.filter((t) => t.inSprite === null);
      expect(indexedTop.length).toBeLessThanOrEqual(completeTop + 1);
      for (let i = 0; i < completeTop; i += 1) {
        expect(indexedTop[i]?.code).toBe(topBaseline[i]?.code);
        expect(indexedTop[i]?.length).toBe(topBaseline[i]?.length);
      }
      expect(file.tagIndex.tags.length).toBeLessThanOrEqual(completeAll + 1);
    }
    expect(checked).toBe(full.length + 1);
  });
});

describe('T-SWF-008 sprite nesting at depths 31/32/33', () => {
  it('indexes to depth 32, abandons depth 33 with SF0103, and never recurses', () => {
    // Sprite 33's body, then each enclosing sprite: its body is [DefineSprite(child), End].
    let level = concat(showFrames(1), endTag());
    for (let id = 33; id >= 2; id -= 1) {
      level = concat(defineSprite(id, 1, level), endTag());
    }
    const body = concat(defineTag(2, 1), defineSprite(1, 1, level), showFrames(1), endTag());
    const file = openSwf(buildSwf({ body, frameCount: 1 }), { inflate: nodeInflate });

    const diagnostic = file.diagnostics.find((d) => String(d.code) === 'SF0103');
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.message).toContain('sprite 33');

    const depths = file.tagIndex.tags.map((t) => t.depth);
    expect(Math.max(...depths)).toBe(32);
    // The depth-33 DefineSprite (sprite 33) is indexed but its body was abandoned.
    const sprite33 = file.tagIndex.tags.find((t) => t.code === 39 && t.depth === 32);
    expect(sprite33).toBeDefined();
    const innermost = file.tagIndex.tags.find((t) => t.depth === 33);
    expect(innermost).toBeUndefined();
  });
});

describe('T-SWF-010 emitted diagnostics inside their documented ranges', () => {
  it('every code this corpus emits is registered with a documented severity', () => {
    const body = concat(
      defineTag(2, 1),
      defineTag(2, 1), // duplicate
      defineTag(2, 0), // id zero
      placeObject2(9, 1), // undefined reference
      placeObject2(1, 1),
      tag(1),
      tag(1),
    );
    // No End: SF0102; the trailing placement past the End: build the "bytes after End" variant too.
    const fileA = openSwf(buildSwf({ body, frameCount: 2 }), { inflate: nodeInflate });
    const bodyB = concat(showFrames(1), endTag(), tag(1));
    const fileB = openSwf(buildSwf({ body: bodyB, frameCount: 1 }), { inflate: nodeInflate });
    const bodyC = concat(tag(31, new Uint8Array(3)), showFrames(1), endTag()); // unknown tag code 31
    const fileC = openSwf(buildSwf({ body: bodyC, frameCount: 1 }), { inflate: nodeInflate });

    for (const file of [fileA, fileB, fileC]) {
      expect(file.diagnostics.length).toBeGreaterThan(0);
      for (const diagnostic of file.diagnostics) {
        const info = codeInfo(String(diagnostic.code));
        expect(info, `unregistered code ${diagnostic.code}`).toBeDefined();
        expect(info?.severity).toBe(diagnostic.severity);
      }
    }
  });
});

/** A `CWS` file whose *decompressed* stream is `streamLength` zero bytes (a zip bomb for the cap). */
function cwsBomb(streamLength: number): Uint8Array {
  // All-zero decompressed stream: RECT (Nbits 0 → 1 byte) + FrameRate 0 + FrameCount 0 + End tag.
  const stream = new Uint8Array(streamLength);
  const compressed = deflateSync(stream);
  const cws = new Uint8Array(8 + compressed.length);
  cws[0] = 0x43; // 'C'
  cws[1] = 0x57; // 'W'
  cws[2] = 0x53; // 'S'
  cws[3] = 7; // version
  const fileLength = 8 + streamLength; // decompressed length
  cws[4] = fileLength & 0xff;
  cws[5] = (fileLength >>> 8) & 0xff;
  cws[6] = (fileLength >>> 16) & 0xff;
  cws[7] = (fileLength >>> 24) & 0xff;
  cws.set(compressed, 8);
  return cws;
}

describe('T-SWF-011 maxDecompressedBytes abort', () => {
  it('rejects a bomb that would decompress past the cap with SF0007', () => {
    // 16 MiB of zeros compresses to ~16 KiB; the cap is 8 MiB, so inflation must abort.
    const cws = cwsBomb(16 * 1024 * 1024);
    const file = openSwf(cws, { inflate: nodeInflate, maxDecompressedBytes: 8 * 1024 * 1024 });
    const diagnostic = file.diagnostics.find((d) => String(d.code) === 'SF0007');
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.severity).toBe('error');
    expect(file.body.length).toBe(0);
  });

  it('the default cap is the documented 512 MiB', () => {
    // 32 MiB < 512 MiB default: the file parses cleanly (decompressed stream is 32 MiB).
    const cws = cwsBomb(32 * 1024 * 1024);
    const file = openSwf(cws, { inflate: nodeInflate });
    expect(file.diagnostics.some((d) => String(d.code) === 'SF0007')).toBe(false);
    // Decompressed stream is 32 MiB; the header (RECT 1 byte + rate + count) consumes 5 bytes.
    expect(file.body.length).toBe(32 * 1024 * 1024 - 5);
  });
});

describe('T-SWF-012 determinism', () => {
  it('two opens of the same bytes produce identical indices, dictionary and diagnostics', () => {
    const bytes = corpus();
    const a = openSwf(bytes, { inflate: nodeInflate });
    const b = openSwf(bytes, { inflate: nodeInflate });
    expect(fingerprint(a)).toBe(fingerprint(b));
  });
});

describe('ZWS (LZMA) open path — `IMPL-020` §4.3', () => {
  it('T-SWF-001: a ZWS file round-trips through the Node lzma adapter and parses like FWS', async () => {
    const lzma = await import('lzma');
    const zws = buildSwf({
      body: corpusBody(),
      frameCount: 2,
      version: 13,
      compression: 'lzma',
      compressor: (payload) => Uint8Array.from(lzma.compress(payload)),
    });
    expect(String.fromCharCode(zws[0] ?? 0, zws[1] ?? 0, zws[2] ?? 0)).toBe('ZWS');

    const file = openSwf(zws, { inflate: nodeInflateLzma });
    expect(file.header.compression).toBe('lzma');
    expect(file.diagnostics.some((d) => String(d.code) === 'SF0006')).toBe(false);
    expect(file.diagnostics.some((d) => String(d.code) === 'SF0027')).toBe(false);
    expect(file.tagIndex.tags.map((t) => t.code)).toEqual(
      openSwf(corpus(), { inflate: nodeInflate }).tagIndex.tags.map((t) => t.code),
    );
    expect(file.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  });

  it('reports SF0027 when the advisory compressedLength disagrees with the bytes present', async () => {
    const lzma = await import('lzma');
    const zws = buildSwf({
      body: corpusBody(),
      frameCount: 2,
      version: 13,
      compression: 'lzma',
      compressor: (payload) => Uint8Array.from(lzma.compress(payload)),
      zwsLengthOverride: 7, // a writer that counts only the property bytes, say
    });
    const file = openSwf(zws, { inflate: nodeInflateLzma });
    const diagnostic = file.diagnostics.find((d) => String(d.code) === 'SF0027');
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.message).toContain('advisory');
    // …and the file still parses.
    expect(file.tagIndex.tags.length).toBeGreaterThan(0);
  });

  it('T-SWF-001: ZWS without any adapter is SF0006, not a crash', async () => {
    const lzma = await import('lzma');
    const zws = buildSwf({
      body: corpusBody(),
      frameCount: 2,
      version: 13,
      compression: 'lzma',
      compressor: (payload) => Uint8Array.from(lzma.compress(payload)),
    });
    const file = openSwf(zws); // no inflate wired
    const diagnostic = file.diagnostics.find((d) => String(d.code) === 'SF0006');
    expect(diagnostic).toBeDefined();
    expect(diagnostic?.severity).toBe('error');
    expect(file.tagIndex.tags.length).toBe(0);
  });
});

describe('T-SWF-021 zero-copy tag views', () => {
  it('readTag returns a view into the decompressed buffer, not a copy', () => {
    const bytes = corpus();
    const file = openSwf(bytes, { inflate: nodeInflate });
    const ref = file.tagIndex.tags[0];
    expect(ref).toBeDefined();
    const payload = file.readTag(ref as (typeof file.tagIndex.tags)[number]);
    expect(payload.kind).toBe('bytes');
    if (payload.kind !== 'bytes') return;
    expect(payload.view.buffer).toBe(file.body.buffer);
    expect(payload.view.byteOffset).toBeGreaterThanOrEqual(file.body.byteOffset);
    expect(payload.view.byteOffset + payload.view.length).toBeLessThanOrEqual(file.body.byteOffset + file.body.length);
    // And memoised: the identical object on a second read.
    expect(file.readTag(ref as (typeof file.tagIndex.tags)[number])).toBe(payload);
  });
});

// ---------------------------------------------------------------------------
// P1 resolution pass (`audits/archive/P1-RESOLUTION-AUDIT.md`) — R-01…R-09, R-13
// ---------------------------------------------------------------------------

/** Patch the declared `FileLength` (bytes 4..8, little-endian UI32) of a synthetic file. */
function withFileLength(bytes: Uint8Array, length: number): Uint8Array {
  const out = Uint8Array.from(bytes);
  out[4] = length & 0xff;
  out[5] = (length >>> 8) & 0xff;
  out[6] = (length >>> 16) & 0xff;
  out[7] = (length >>> 24) & 0xff;
  return out;
}

describe('T-SWF-002 / F-01 — a sprite body closed without its End tag', () => {
  it('keeps the sprite range non-empty and the model timeline holds the indexed tags', () => {
    // Sprite 1's body is `PlaceObject2, ShowFrame` with no `End` — the level closes at the
    // stream's byte limit instead of on its End tag.
    const sprite = defineSprite(1, 2, concat(placeObject2(1, 1), tag(1)));
    const file = openSwf(buildSwf({ body: concat(sprite, tag(1), tag(1), endTag()), frameCount: 2 }));
    expect(file.sink.codes()).toContain('SF0173'); // the structural missing-End report
    const range = file.tagIndex.spriteRanges.get(1);
    expect(range).toBeDefined();
    // Regression: the range used to be {start: N, end: N} — an empty slice.
    expect(range!.end).toBeGreaterThan(range!.start);
    // The tags the indexer kept must reach the model, not be silently dropped.
    const movie = buildMovieModel(file);
    const spriteModel = movie.characters.get(1)?.sprite;
    expect(spriteModel).toBeDefined();
    const ops = spriteModel!.timeline.frames.flatMap((f) => f.ops.map((o) => o.kind));
    expect(ops).toContain('place');
  });

  it('a nested sprite whose body lacks an End tag keeps its range; the closed outer is unaffected', () => {
    const inner = defineSprite(2, 1, concat(placeObject2(1, 2))); // no End in sprite 2's body
    const sprite = defineSprite(1, 1, concat(inner, endTag())); // sprite 1 closes properly
    const file = openSwf(buildSwf({ body: concat(sprite, endTag()), frameCount: 1 }));
    expect(file.sink.codes()).toContain('SF0173'); // sprite 2 closed without its End tag
    const innerRange = file.tagIndex.spriteRanges.get(2)!;
    expect(innerRange.start).toBe(2); // the PlaceObject2
    expect(innerRange.end).toBe(3); // up to the last indexed tag at close
    expect(innerRange.end).toBeGreaterThan(innerRange.start);
    // The nested tags are inside the range (the regression sliced them away).
    const inRange = file.tagIndex.tags.slice(innerRange.start, innerRange.end);
    expect(inRange.map((t) => [t.code, t.inSprite])).toEqual([[26, 2]]);
    // The properly closed outer sprite's range is untouched by the fix (End-tag semantics).
    const outerRange = file.tagIndex.spriteRanges.get(1)!;
    expect(outerRange.end).toBe(3); // the outer's End tag index
  });
});

describe('F-03 — ZWS input-size pre-bound (R006/R010, §12 item 6)', () => {
  it('refuses a compressed payload already over the cap, before any decode', async () => {
    const lzma = await import('lzma');
    const zws = buildSwf({
      body: corpusBody(),
      frameCount: 2,
      version: 13,
      compression: 'lzma',
      compressor: (payload) => Uint8Array.from(lzma.compress(payload)),
    });
    // The compressed payload is a few dozen bytes; a cap of 4 makes the pre-bound fire.
    const file = openSwf(zws, { inflate: nodeInflateLzma, maxDecompressedBytes: 4 });
    const overCap = file.diagnostics.find((d) => String(d.code) === 'SF0007');
    expect(overCap).toBeDefined();
    expect(overCap!.severity).toBe('error');
    expect(file.diagnostics.some((d) => d.message.includes('refusing to decompress'))).toBe(true);
    expect(file.body.length).toBe(0);
    expect(file.tagIndex.tags.length).toBe(0);
  });
});

describe('F-04 — async cap abort (unified contract, D-1)', () => {
  it('openSwfNodeAsync reports SF0007 with an empty body, never a zero-padded one', async () => {
    // The Node path (`nodeInflateAsync`) enforces the cap in the pump — `createInflate`'s
    // `maxOutputLength` does not error on this platform, so a bypassing pump would parse the
    // whole bomb.
    const cws = buildSwf({
      body: new Uint8Array(1024 * 1024),
      frameCount: 1,
      compression: 'zlib',
      compressor: (payload) => new Uint8Array(deflateSync(payload)),
    });
    const file = await openSwfNodeAsync(cws, { maxDecompressedBytes: 256 * 1024 });
    expect(file.diagnostics.find((d) => String(d.code) === 'SF0007')).toBeDefined();
    expect(file.body.length).toBe(0);
    expect(file.sizes.decompressed).toBe(0);
    expect(file.tagIndex.tags.length).toBe(0);
  });

  it('reports SF0007 with an empty body, never a zero-padded one', async () => {
    // A 1 MiB run of zeros compresses to well under a KiB and decompresses back to 1 MiB.
    const cws = buildSwf({
      body: new Uint8Array(1024 * 1024),
      frameCount: 1,
      compression: 'zlib',
      compressor: (payload) => new Uint8Array(deflateSync(payload)),
    });
    const file = await openSwfAsync(cws, { maxDecompressedBytes: 256 * 1024 });
    const overCap = file.diagnostics.find((d) => String(d.code) === 'SF0007');
    expect(overCap).toBeDefined();
    expect(overCap!.severity).toBe('error');
    // The regression was a body of length `total` with a zero-padded tail (the zeros parsed as
    // `End` tags). The contract is an empty body: nothing is parsed from a cap-aborted stream.
    expect(file.body.length).toBe(0);
    expect(file.sizes.decompressed).toBe(0);
    expect(file.tagIndex.tags.length).toBe(0);
  });
});

/** A ~20 KiB CWS tag stream so a 90%-in corruption leaves a large decodable prefix. */
function bigCwsFixture(): Uint8Array {
  const parts: Uint8Array[] = [];
  for (let i = 0; i < 200; i += 1) parts.push(showFrames(50));
  parts.push(endTag());
  return buildSwf({
    body: concat(...parts),
    frameCount: 10000,
    compression: 'zlib',
    compressor: (payload) => new Uint8Array(deflateSync(payload)),
  });
}

function corruptAt(bytes: Uint8Array, fraction: number): Uint8Array {
  const out = Uint8Array.from(bytes);
  const index = Math.floor(out.length * fraction);
  out[index] = (out[index] ?? 0) ^ 0xff;
  return out;
}

describe('F-05 — corrupt CWS: partial yield (R007) vs the sync platform limit', () => {
  it('openSwfNodeAsync yields the bytes decoded so far plus SF0003, no rejection', async () => {
    const file = await openSwfNodeAsync(corruptAt(bigCwsFixture(), 0.9));
    const codes = file.diagnostics.map((d) => String(d.code));
    expect(codes).toContain('SF0003');
    expect(file.body.length).toBeGreaterThan(0); // the recoverable prefix is kept
    expect(file.tagIndex.tags.length).toBeGreaterThan(0);
    // …and the indexed tags are a prefix of the intact file's tags. The final indexed tag is
    // the cut itself (kept truncated, per T-SWF-002), so the prefix holds up to the last one.
    const intact = openSwfNodeSync(bigCwsFixture());
    const complete = file.tagIndex.tags.slice(0, -1);
    expect(complete.map((t) => [t.code, t.offset, t.length])).toEqual(
      intact.tagIndex.tags.slice(0, complete.length).map((t) => [t.code, t.offset, t.length]),
    );
    const last = file.tagIndex.tags[file.tagIndex.tags.length - 1]!;
    expect(last.offset + last.length).toBe(file.body.length); // runs to the end of the partial body
  });

  it('the sync entry reports SF0003 with an empty body and never throws (pinned §12 item 8)', () => {
    const file = openSwfNodeSync(corruptAt(bigCwsFixture(), 0.9));
    const codes = file.diagnostics.map((d) => String(d.code));
    expect(codes).toContain('SF0003');
    expect(file.body.length).toBe(0);
  });

  it('intact CWS: async and sync opens agree', async () => {
    const bytes = bigCwsFixture();
    const sync = openSwfNodeSync(bytes);
    const asyncFile = await openSwfNodeAsync(bytes);
    expect(asyncFile.tagIndex.tags.length).toBe(sync.tagIndex.tags.length);
    expect(asyncFile.body.length).toBe(sync.body.length);
    expect(asyncFile.diagnostics).toEqual([]);
  });
});

describe('F-08 — every P1 diagnostic code is exercised by a test', () => {
  it('F-08/SF0004: decompressed body longer than declared FileLength', () => {
    const file = openSwf(withFileLength(corpus(), Math.floor(corpus().length / 2)));
    expect(file.sink.codes()).toContain('SF0004');
    // …and the file still parses with the actual bytes present.
    expect(file.tagIndex.tags.length).toBeGreaterThan(0);
  });

  it('F-08/SF0021: FrameSize with a non-zero Xmin is reported and preserved', () => {
    const file = openSwf(
      buildSwf({
        body: corpusBody(),
        frameCount: 2,
        frameSize: { xMin: 100, xMax: 200, yMin: 0, yMax: 100 },
      }),
    );
    expect(file.sink.codes()).toContain('SF0021');
    expect(file.header.frameSize.xMin).toBe(100);
  });

  it('F-08/SF0022: frame rate raw 0 and ≥ 240 fps are implausible; 12 fps is not', () => {
    for (const raw of [0, 0xffff]) {
      const file = openSwf(buildSwf({ body: corpusBody(), frameCount: 2, frameRateRaw: raw }));
      expect(file.sink.codes()).toContain('SF0022');
    }
    const fine = openSwf(buildSwf({ body: corpusBody(), frameCount: 2, frameRateRaw: 3072 }));
    expect(fine.sink.codes()).not.toContain('SF0022');
    expect(fine.header.frameRate).toBe(12);
  });

  it('F-08/SF0028: an implausible FileLength is reported and ignored', () => {
    // Implausible: < 8 or > 2 GiB (= 2^31); 2^31 itself is the boundary and is not reported.
    for (const declared of [4, 0x8000_0001]) {
      const file = openSwf(withFileLength(corpus(), declared));
      expect(file.sink.codes()).toContain('SF0028');
      expect(file.tagIndex.tags.length).toBeGreaterThan(0);
    }
  });

  it('F-08/SF0031: the dictionary entry cap is enforced and reported', () => {
    const body = concat(defineTag(11, 1), defineTag(11, 2), defineTag(11, 3), endTag());
    const file = openSwf(buildSwf({ body, frameCount: 1 }), { maxDictionaryEntries: 2 });
    expect(file.sink.codes()).toContain('SF0031');
    expect(file.definitions.map((d) => d.id)).toEqual([1, 2]);
  });

  it('F-08/SF0101: a final tag running past the stream end is kept truncated', () => {
    // The 256-byte tag comes *before* the `End` so it is part of the stream, not trailing bytes.
    const body = concat(defineTag(11, 1), tag(1), tag(1, new Uint8Array(256)), endTag());
    const full = buildSwf({ body, frameCount: 1 });
    const file = openSwf(full.subarray(0, full.length - 64)); // cut 64 of the final tag's 256-byte body
    expect(file.sink.codes()).toContain('SF0101');
    const last = file.tagIndex.tags[file.tagIndex.tags.length - 1];
    expect(last).toBeDefined();
    expect(last!.code).toBe(1);
    expect(last!.length).toBeLessThan(256); // kept with the bytes present
  });

  it('T-SWF-007 (id 0) / F-08/SF0107: a definition tag with character id 0 is ignored', () => {
    const body = concat(defineTag(11, 0, new Uint8Array(16)), defineTag(11, 1), endTag());
    const file = openSwf(buildSwf({ body, frameCount: 1 }));
    expect(file.sink.codes()).toContain('SF0107');
    expect(file.definitions.map((d) => d.id)).toEqual([1]); // id 0 never registered
  });
});

describe('T-SWF-001 — header matrix (versions, frame rates, frame sizes, signatures)', () => {
  it('accepts versions 1…43; below the AVM1 baseline reports SF0002', () => {
    for (const version of [1, 4, 7, 13, 43]) {
      const file = openSwf(buildSwf({ body: corpusBody(), frameCount: 2, version }));
      expect(file.header.version).toBe(version);
      expect(file.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    }
    const below = openSwf(buildSwf({ body: corpusBody(), frameCount: 2, version: 1 }));
    expect(below.sink.codes()).toContain('SF0002');
  });

  it('frame-rate edges: raw 0 and 1023.98 fps implausible, 239.99 fps plausible', () => {
    expect(openSwf(buildSwf({ body: corpusBody(), frameCount: 2, frameRateRaw: 0 })).sink.codes()).toContain('SF0022');
    expect(openSwf(buildSwf({ body: corpusBody(), frameCount: 2, frameRateRaw: 0xffff })).sink.codes()).toContain(
      'SF0022',
    );
    const edge = openSwf(buildSwf({ body: corpusBody(), frameCount: 2, frameRateRaw: 61439 }));
    expect(edge.sink.codes()).not.toContain('SF0022');
  });

  it('frame-size edges: non-zero origin SF0021, non-positive width SF0029', () => {
    const offset = openSwf(
      buildSwf({ body: corpusBody(), frameCount: 2, frameSize: { xMin: 100, xMax: 200, yMin: 0, yMax: 100 } }),
    );
    expect(offset.sink.codes()).toContain('SF0021');
    const zero = openSwf(
      buildSwf({ body: corpusBody(), frameCount: 2, frameSize: { xMin: 0, xMax: 0, yMin: 0, yMax: 100 } }),
    );
    expect(zero.sink.codes()).toContain('SF0029');
    // …and parsing continues in both cases.
    expect(offset.tagIndex.tags.length).toBeGreaterThan(0);
    expect(zero.tagIndex.tags.length).toBeGreaterThan(0);
  });

  it('all three signatures parse (FWS here; CWS and ZWS round-trips in the sibling blocks)', () => {
    const fws = openSwf(corpus());
    expect(fws.header.compression).toBe('none');
    const cws = openSwf(
      buildSwf({
        body: corpusBody(),
        frameCount: 2,
        compression: 'zlib',
        compressor: (p) => new Uint8Array(deflateSync(p)),
      }),
      { inflate: nodeInflate },
    );
    expect(cws.header.compression).toBe('zlib');
    expect(cws.tagIndex.tags.length).toBe(fws.tagIndex.tags.length);
  });
});

describe('T-SWF-011 (512 MiB bomb / RSS) — the memory bound, D-4', () => {
  it('a 512 MiB potential-output bomb is rejected at the cap with bounded RSS', () => {
    const zeros = new Uint8Array(512 * 1024 * 1024);
    const bomb = new Uint8Array(deflateSync(zeros)); // ~0.5 MiB on disk, 512 MiB potential
    expect(bomb.length).toBeLessThan(8 * 1024 * 1024);
    const preOpen = process.memoryUsage().rss;
    const file = openSwf(
      buildSwf({ body: new Uint8Array(0), frameCount: 1, compression: 'zlib', compressor: () => bomb }),
      {
        inflate: nodeInflate,
        maxDecompressedBytes: 64 * 1024 * 1024,
      },
    );
    const postOpen = process.memoryUsage().rss;
    expect(file.diagnostics.some((d) => String(d.code) === 'SF0007')).toBe(true);
    expect(file.body.length).toBe(0);
    // The open's marginal memory stays under the criterion's 256 MiB (the caller-held input
    // buffer and the process baseline are measured as the pre-open baseline, per D-4).
    expect(postOpen - preOpen).toBeLessThan(256 * 1024 * 1024);
  });

  it('the same bomb aborts through the async path with SF0007 and an empty body', async () => {
    const zeros = new Uint8Array(512 * 1024 * 1024);
    const bomb = new Uint8Array(deflateSync(zeros));
    const cws = buildSwf({ body: new Uint8Array(0), frameCount: 1, compression: 'zlib', compressor: () => bomb });
    const file = await openSwfAsync(cws, { maxDecompressedBytes: 64 * 1024 * 1024 });
    expect(file.diagnostics.some((d) => String(d.code) === 'SF0007')).toBe(true);
    expect(file.body.length).toBe(0);
  });
});

describe('T-SWF-018 lazy index strategy', () => {
  it('indexStrategy=lazy defers tag-index construction until first access', () => {
    // A file with an out-of-order FileAttributes produces SF0025 — and ordering diagnostics are
    // only emitted during buildStream, which is what we want to confirm is deferred.
    const outOfOrder = buildSwf({
      version: 8,
      body: concat(defineTag(2, 7), tag(69, new Uint8Array([1, 0, 0, 0])), placeObject2(7, 1), showFrames(1), endTag()),
    });
    const lazy = openSwf(outOfOrder, { indexStrategy: 'lazy' });
    // Before any access, ordering diagnostics are absent.
    expect(lazy.diagnostics.map((d) => String(d.code))).not.toContain('SF0025');
    expect(lazy.diagnostics.map((d) => String(d.code))).not.toContain('SF0026');
    expect(lazy.tagIndex.tags.length).toBeGreaterThan(0);
    // After access, ordering diagnostics appear.
    expect(lazy.diagnostics.map((d) => String(d.code))).toContain('SF0025');
    // Sanity: definitions is lazy too.
    const eager = openSwf(outOfOrder);
    expect(eager.definitions.length).toBe(lazy.definitions.length);
  });
});

describe('T-SWF-001 header matrix', () => {
  it('accepts versions across the SWF 1…43 range without implausible-version diagnostics', () => {
    // FileAttributes arrived in v8, so versions < 8 omit FileAttributes and should produce no
    // version-specific errors. Versions ≥ 8 need FileAttributes first; we provide it.
    for (const version of [1, 3, 4, 6, 8, 10, 15, 20, 32, 43]) {
      const body =
        version >= 8
          ? concat(tag(69, new Uint8Array([1, 0, 0, 0])), showFrames(1), endTag())
          : concat(showFrames(1), endTag());
      const file = openSwf(buildSwf({ version, body }));
      const codes = file.diagnostics.map((d) => String(d.code));
      expect(codes).not.toContain('SF0029'); // non-positive frame size
      expect(codes.filter((c) => c.startsWith('SF00') && c !== 'SF0002' && c !== 'SF0033')).toEqual([]);
    }
  });

  it('reports SF0022 for an implausible frame rate (0 fps) and accepts a normal one', () => {
    const zeroRate = buildSwf({
      version: 8,
      body: concat(tag(69, new Uint8Array([1, 0, 0, 0])), endTag()),
      frameRateRaw: 0,
    });
    expect(openSwf(zeroRate).diagnostics.map((d) => String(d.code))).toContain('SF0022');
    const normal = buildSwf({
      version: 8,
      body: concat(tag(69, new Uint8Array([1, 0, 0, 0])), showFrames(1), endTag()),
      frameRateRaw: 31 * 256,
    });
    expect(openSwf(normal).diagnostics.map((d) => String(d.code))).not.toContain('SF0022');
  });
});
