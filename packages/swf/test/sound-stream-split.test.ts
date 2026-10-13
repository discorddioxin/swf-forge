/**
 * T-AUD-108 — stream splitting on a second `SoundStreamHead`, including a codec change mid-movie
 * (`IMPL-090-R022`–`R024`, WP-090-08).
 *
 * The existing stream test cites this id as `T-AUD-106/108` and covers the two-segment case for a
 * single codec. The obligation also names a *codec change*, which is the part that can silently
 * corrupt output: blocks after the second head must be parsed with the second head's format, and
 * their sample offsets must restart rather than continue the first segment's running total.
 */

import { describe, expect, it } from 'vitest';

import { Tag, buildMovieModel, openSwf } from '@swf-forge/swf';
import { buildSwf, concat, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

function u16(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]);
}

/** `SoundStreamHead2`: playback flags byte, stream flags byte, SampleCount, optional LatencySeek. */
function streamHead(format: number, sampleCount: number, latencySeek: number | null): Uint8Array {
  const playbackFlags = (3 << 2) | 0b10; // 44.1 kHz, 16-bit, mono
  const streamFlags = (format << 4) | (3 << 2) | 0b10;
  return concat(
    Uint8Array.from([playbackFlags, streamFlags]),
    u16(sampleCount),
    ...(latencySeek === null ? [] : [u16(latencySeek & 0xffff)]),
  );
}

/** An ADPCM/PCM stream block is raw payload; only MP3 blocks carry the SampleCount/SeekSamples pair. */
function mp3Block(sampleCount: number, seekSamples: number, data: Uint8Array): Uint8Array {
  return concat(u16(sampleCount), u16(seekSamples & 0xffff), data);
}

function analyse(tags: readonly Uint8Array[]) {
  const file = openSwf(buildSwf({ version: 10, body: concat(...tags, showFrames(1), endTag()), frameCount: 1 }));
  return { file, model: buildMovieModel(file) };
}

describe('T-AUD-108 a second SoundStreamHead splits the stream', () => {
  it('reports SF0325 and starts a new span rather than extending the first', () => {
    const { file, model } = analyse([
      tag(Tag.SoundStreamHead2, streamHead(2, 1152, 0)),
      tag(Tag.SoundStreamBlock, mp3Block(1152, 0, new Uint8Array(8))),
      tag(Tag.SoundStreamHead2, streamHead(2, 576, 0)),
      tag(Tag.SoundStreamBlock, mp3Block(576, 0, new Uint8Array(4))),
    ]);

    expect(model.mainTimeline.streamSoundSpans).toHaveLength(2);
    expect(file.sink.codes()).toContain('SF0325');
  });

  it('restarts sample offsets at zero in the second segment', () => {
    // The failure this guards against is a single running counter across segments, which would
    // place the second segment's first block at 1152 and desynchronise every later block.
    const { model } = analyse([
      tag(Tag.SoundStreamHead2, streamHead(2, 1152, 0)),
      tag(Tag.SoundStreamBlock, mp3Block(1152, 0, new Uint8Array(8))),
      tag(Tag.SoundStreamBlock, mp3Block(1152, 0, new Uint8Array(8))),
      tag(Tag.SoundStreamHead2, streamHead(2, 576, 0)),
      tag(Tag.SoundStreamBlock, mp3Block(576, 0, new Uint8Array(4))),
      tag(Tag.SoundStreamBlock, mp3Block(576, 0, new Uint8Array(4))),
    ]);
    const [first, second] = model.mainTimeline.streamSoundSpans;

    expect(first?.blocks.map((block) => block.sampleOffset)).toEqual([0, 1152]);
    expect(second?.blocks.map((block) => block.sampleOffset)).toEqual([0, 576]);
    expect([first?.sampleCount, second?.sampleCount]).toEqual([2304, 1152]);
  });

  it('carries a codec change across the split, so each span reports its own format', () => {
    // Format 2 (MP3) then format 1 (ADPCM). A decoder that caches the first head's codec would
    // read the ADPCM blocks' first four bytes as an MP3 SampleCount/SeekSamples pair.
    const { model } = analyse([
      tag(Tag.SoundStreamHead2, streamHead(2, 1152, 0)),
      tag(Tag.SoundStreamBlock, mp3Block(1152, 0, new Uint8Array(8))),
      tag(Tag.SoundStreamHead2, streamHead(1, 4096, null)),
      tag(Tag.SoundStreamBlock, Uint8Array.from([0x00, 0x11, 0x22, 0x33])),
    ]);
    const [first, second] = model.mainTimeline.streamSoundSpans;

    expect(first?.head.format).toBe(2);
    expect(second?.head.format).toBe(1);
  });

  it('does not read an MP3 block header out of a non-MP3 segment', () => {
    // For format 1 the whole block body is payload: no SampleCount, no SeekSamples. If the decoder
    // consumed four bytes as a header here it would both lose payload and invent a sample count.
    const payload = Uint8Array.from([0xde, 0xad, 0xbe, 0xef, 0x01, 0x02]);
    const { model } = analyse([
      tag(Tag.SoundStreamHead2, streamHead(1, 4096, null)),
      tag(Tag.SoundStreamBlock, payload),
    ]);
    const block = model.mainTimeline.streamSoundSpans[0]?.blocks[0];

    expect(block?.seekSamples).toBeNull();
    expect(block?.dataLength).toBe(payload.length);
  });

  it('keeps LatencySeek on the MP3 head and omits it from the ADPCM head', () => {
    // IMPL-090-R024 / E-018: LatencySeek is present only when the stream format is MP3.
    const { model } = analyse([
      tag(Tag.SoundStreamHead2, streamHead(2, 1152, 529)),
      tag(Tag.SoundStreamBlock, mp3Block(1152, 529, new Uint8Array(8))),
      tag(Tag.SoundStreamHead2, streamHead(1, 4096, null)),
      tag(Tag.SoundStreamBlock, Uint8Array.from([0x00, 0x11])),
    ]);
    const [first, second] = model.mainTimeline.streamSoundSpans;

    expect(first?.head.latencySeek).toBe(529);
    expect(second?.head.latencySeek).toBeNull();
  });

  it('associates each block with the head that precedes it, by tag order', () => {
    const { model } = analyse([
      tag(Tag.SoundStreamHead2, streamHead(2, 1152, 0)),
      tag(Tag.SoundStreamHead2, streamHead(2, 576, 0)),
      tag(Tag.SoundStreamBlock, mp3Block(576, 0, new Uint8Array(4))),
    ]);
    const spans = model.mainTimeline.streamSoundSpans;

    // An immediately-superseded head owns no blocks; it is still recorded, not dropped.
    expect(spans).toHaveLength(2);
    expect(spans[0]?.blocks).toEqual([]);
    expect(spans[1]?.blocks).toHaveLength(1);
  });
});
