/**
 * Tag framing — `IMPL-020` §4.1 (`T-SWF-003`) and the bit-level reader contract of `IMPL-010`.
 *
 * `43 00` is the tag word `0x0043`: code 1 (`ShowFrame`), length 3. `03 01` is `0x0103`: code 4
 * (`PlaceObject`), length 3. Both are the exact tuples the spec test table pins.
 */

import { describe, expect, it } from 'vitest';

import { Cursor, DiagnosticSink, buildTagIndex, openSwf, readTagHeader } from '@swf-forge/swf';
import { ByteWriter, buildSwf, concat, endTag, showFrames, tag, writeRect } from '@swf-forge/swf/test-support';

describe('container decompression diagnostics', () => {
  it('T-SWF-001 reports SF0006 for ZWS when no LZMA decoder is installed', () => {
    const zws = Uint8Array.from([0x5a, 0x57, 0x53, 13, 8, 0, 0, 0]);
    const file = openSwf(zws);
    expect(file.sink.codes()).toContain('SF0006');
    expect(file.sink.codes()).not.toContain('SF0003');
  });
});

describe('openSwf tag payload sentinel', () => {
  it('T-SWF-018 marks a not-a-SWF read as not-a-swf, not not-requested', () => {
    const file = openSwf(new Uint8Array(8));
    expect(
      file.readTag({
        code: 0,
        offset: 0,
        length: 0,
        depth: 0,
        inSprite: null,
        index: 0,
        headerOffset: 0,
        longHeader: false,
      }),
    ).toEqual({ kind: 'skipped', reason: 'not-a-swf' });
  });
});

describe('readTagHeader', () => {
  it('reads code 1 / length 3 from 43 00', () => {
    const c = new Cursor(Uint8Array.from([0x43, 0x00]));
    const header = readTagHeader(c);
    expect(header.code).toBe(1);
    expect(header.length).toBe(3);
    expect(header.longHeader).toBe(false);
    expect(header.headerOffset).toBe(0);
  });

  it('reads code 4 / length 3 from 03 01', () => {
    const c = new Cursor(Uint8Array.from([0x03, 0x01]));
    const header = readTagHeader(c);
    expect(header.code).toBe(4);
    expect(header.length).toBe(3);
  });

  it('reads the long form: 0x3F length + UI32 body length', () => {
    const body = new Uint8Array(70);
    const c = new Cursor(tag(26, body));
    const header = readTagHeader(c);
    expect(header.code).toBe(26);
    expect(header.length).toBe(70);
    expect(header.longHeader).toBe(true);
  });
});

describe('buildTagIndex', () => {
  it('walks tags with stable offsets and finds the End', () => {
    const sink = new DiagnosticSink();
    const body = concat(tag(4, Uint8Array.from([1, 2, 3])), tag(1, Uint8Array.from([9, 9, 9])), endTag());
    const result = buildTagIndex(body, sink, {});
    expect(result.index.tags.map((t: { code: number }) => t.code)).toEqual([4, 1, 0]);
    expect(result.index.tags.map((t) => t.length)).toEqual([3, 3, 0]);
    expect(result.index.tags.map((t) => t.headerOffset)).toEqual([0, 5, 10]);
    expect(result.index.tags.map((t) => t.offset)).toEqual([2, 7, 12]);
    expect(result.index.tags.map((t) => t.index)).toEqual([0, 1, 2]);
    expect(sink.list()).toEqual([]);
  });

  it('reports a missing End tag (SF0102)', () => {
    const sink = new DiagnosticSink();
    const body = concat(showFrames(1));
    const result = buildTagIndex(body, sink, {});
    expect(result.index.tags.map((t) => t.code)).toEqual([1]);
    expect(sink.codes()).toContain('SF0102');
  });

  it('skips an unknown tag by its declared length (SF0104)', () => {
    const sink = new DiagnosticSink();
    const body = concat(tag(999, Uint8Array.from([1, 2])), endTag());
    const result = buildTagIndex(body, sink, {});
    expect(result.index.tags.map((t) => t.code)).toEqual([999, 0]);
    expect(sink.codes()).toContain('SF0104');
  });
});

describe('buildSwf test-support writer', () => {
  it('writes a FileLength that matches the bytes', () => {
    const bytes = buildSwf({ body: concat(showFrames(2), endTag()), frameCount: 2 });
    expect(String.fromCharCode(...bytes.subarray(0, 3))).toBe('FWS');
    const declared = (bytes[4] ?? 0) | ((bytes[5] ?? 0) << 8) | ((bytes[6] ?? 0) << 16) | ((bytes[7] ?? 0) << 24);
    expect(declared).toBe(bytes.length);
  });

  it('writes a RECT whose bit width is the minimum the values need', () => {
    const w = new ByteWriter();
    writeRect(w, { xMin: 0, xMax: 11000, yMin: 0, yMax: 8000 });
    const bytes = w.toUint8Array();
    // Nbits = 15 (11000 needs 15 signed bits) => 5 + 4*15 = 65 bits => 9 bytes.
    expect(bytes.length).toBe(9);
    expect(bytes[0]! >> 3).toBe(15);
  });
});

// ---------------------------------------------------------------------------
// P1 resolution pass (`audits/archive/P1-RESOLUTION-AUDIT.md`) — R-06, R-10
// ---------------------------------------------------------------------------

describe('F-06 — SF0030 is reported once per tag code, not per level', () => {
  it('two distinct long-under-63 tag codes produce two entries; a repeat dedups', () => {
    const sink = new DiagnosticSink();
    const body = concat(
      tag(2, new Uint8Array(10), { forceLong: true }),
      tag(11, new Uint8Array(10), { forceLong: true }),
      tag(2, new Uint8Array(8), { forceLong: true }),
      endTag(),
    );
    const result = buildTagIndex(body, sink, {});
    const entries = sink.list().filter((d) => String(d.code) === 'SF0030');
    expect(entries).toHaveLength(2); // tag 2 and tag 11 — the repeat of tag 2 adds nothing
    expect(entries.map((d) => d.context).sort()).toEqual(['long header 11', 'long header 2']);
    expect(result.index.tags.map((t) => t.code)).toEqual([2, 11, 2, 0]);
  });
});

describe('T-SWF-003 boundary — short form tops out at 62, long form from 63', () => {
  it('a 62-byte body uses the short header and parses without SF0030', () => {
    const sink = new DiagnosticSink();
    const encoded = tag(2, new Uint8Array(62));
    // Short form: single UI16 word, six-bit field = 62 (0x3E), no long length follows.
    expect(encoded.length).toBe(2 + 62);
    expect(encoded[0]! & 0x3f).toBe(62);
    const result = buildTagIndex(concat(encoded, endTag()), sink, {});
    expect(result.index.tags[0]!.length).toBe(62);
    expect(result.index.tags[0]!.longHeader).toBe(false);
    expect(sink.codes()).not.toContain('SF0030');
  });

  it('a 63-byte body takes the long form (the six-bit field cannot hold 63)', () => {
    const sink = new DiagnosticSink();
    const encoded = tag(2, new Uint8Array(63));
    expect(encoded.length).toBe(6 + 63); // UI16 (field 0x3F) + UI32 length
    expect(encoded[0]! & 0x3f).toBe(0x3f);
    const length = (encoded[2]! | (encoded[3]! << 8) | (encoded[4]! << 16) | (encoded[5]! << 24)) >>> 0;
    expect(length).toBe(63);
    const result = buildTagIndex(concat(encoded, endTag()), sink, {});
    expect(result.index.tags[0]!.length).toBe(63);
    expect(result.index.tags[0]!.longHeader).toBe(true);
    // 63 is the smallest legal long-form length — not an SF0030 case.
    expect(sink.codes()).not.toContain('SF0030');
  });

  it('a 62-byte body forced into the long form is legal but non-canonical (SF0030)', () => {
    const sink = new DiagnosticSink();
    const result = buildTagIndex(concat(tag(2, new Uint8Array(62), { forceLong: true }), endTag()), sink, {});
    expect(result.index.tags[0]!.length).toBe(62);
    expect(result.index.tags[0]!.longHeader).toBe(true);
    expect(sink.codes()).toContain('SF0030');
  });
});
