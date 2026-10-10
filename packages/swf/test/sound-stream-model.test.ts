/** P3 sound-stream model diagnostics and deterministic block/sample association coverage. */

import { describe, expect, it } from 'vitest';

import { Tag, buildMovieModel, openSwf } from '@swf-forge/swf';
import { buildSwf, concat, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

function u16(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]);
}

function mp3Frame(header: readonly number[], length: number): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes.set(header);
  return bytes;
}

function streamHead(format: number, sampleCount: number, latencySeek: number | null): Uint8Array {
  const playbackFlags = (3 << 2) | 0b10; // 44.1 kHz, 16-bit mono playback
  const streamFlags = (format << 4) | (3 << 2) | 0b10; // 44.1 kHz, 16-bit mono stream
  return concat(
    Uint8Array.from([playbackFlags, streamFlags]),
    u16(sampleCount),
    ...(latencySeek === null ? [] : [u16(latencySeek & 0xffff)]),
  );
}

function streamBlock(sampleCount: number, seekSamples: number, data: Uint8Array): Uint8Array {
  return concat(u16(sampleCount), u16(seekSamples & 0xffff), data);
}

function analyze(tags: readonly Uint8Array[]) {
  const file = openSwf(
    buildSwf({
      version: 10,
      body: concat(...tags, showFrames(1), endTag()),
      frameCount: 1,
    }),
  );
  const model = buildMovieModel(file);
  return { file, model };
}

describe('P3 streaming-sound model', () => {
  it('T-AUD-106/108: records stream segments and cumulative per-block sample offsets', () => {
    const firstHead = tag(Tag.SoundStreamHead, streamHead(0, 1, null));
    const firstBlock = tag(Tag.SoundStreamBlock, Uint8Array.from([0, 0]));
    const secondHead = tag(Tag.SoundStreamHead2, streamHead(0, 3, null));
    const secondBlock = tag(Tag.SoundStreamBlock, Uint8Array.from([0, 0, 0, 0, 0, 0]));
    const { file, model } = analyze([firstHead, firstBlock, tag(Tag.ShowFrame), secondHead, secondBlock]);
    expect(model.mainTimeline.streamSoundSpans).toHaveLength(2);
    expect(model.mainTimeline.streamSoundSpans.map((span) => span.sampleCount)).toEqual([1, 3]);
    expect(model.mainTimeline.streamSoundSpans[0]?.blocks[0]).toMatchObject({
      frameIndex: 0,
      sampleOffset: 0,
      sampleCount: 1,
    });
    expect(model.mainTimeline.streamSoundSpans[1]?.blocks[0]).toMatchObject({
      frameIndex: 1,
      sampleOffset: 0,
      sampleCount: 3,
    });
    expect(model.mainTimeline.frames).toHaveLength(2);
    expect(file.sink.codes()).toContain('SF0325');
  });

  it('T-AUD-107 keeps zero-sample blocks in their frame slots without advancing sample offsets', () => {
    const { model } = analyze([
      tag(Tag.SoundStreamHead2, streamHead(2, 2, 0)),
      tag(Tag.SoundStreamBlock, streamBlock(2, 0, new Uint8Array())),
      tag(Tag.ShowFrame),
      tag(Tag.SoundStreamBlock, streamBlock(0, 0, new Uint8Array())),
      tag(Tag.ShowFrame),
      tag(Tag.SoundStreamBlock, streamBlock(1, 0, new Uint8Array())),
    ]);
    expect(model.mainTimeline.streamSoundSpans[0]?.blocks).toMatchObject([
      { frameIndex: 0, sampleOffset: 0, sampleCount: 2 },
      { frameIndex: 1, sampleOffset: 2, sampleCount: 0 },
      { frameIndex: 2, sampleOffset: 2, sampleCount: 1 },
    ]);
    expect(model.mainTimeline.streamSoundSpans[0]?.sampleCount).toBe(3);
  });

  it('reports MP3 parameter changes, decoded-duration mismatch, excessive seek, and absent latency', () => {
    const first = mp3Frame([0xff, 0xfb, 0x92, 0xc0], 418); // MPEG1, 44.1 kHz
    const second = mp3Frame([0xff, 0xfb, 0x96, 0xc0], 385); // MPEG1, 48 kHz
    const frames = concat(first, second);
    const head = tag(Tag.SoundStreamHead2, streamHead(2, 1000, null));
    const block = tag(Tag.SoundStreamBlock, streamBlock(1000, 1001, frames));
    const { file, model } = analyze([head, block]);
    expect(model.mainTimeline.streamSoundSpans[0]?.blocks[0]).toMatchObject({
      sampleOffset: 0,
      sampleCount: 1000,
      seekSamples: 1001,
      dataLength: 803,
    });
    expect(file.sink.codes()).toEqual(expect.arrayContaining(['SF0305', 'SF0306', 'SF0324', 'SF0330']));
  });

  it('reports zero-block padding and malformed ADPCM without losing the sample-offset record', () => {
    const mp3 = analyze([
      tag(Tag.SoundStreamHead2, streamHead(2, 0, 0)),
      tag(Tag.SoundStreamBlock, streamBlock(0, 0, new Uint8Array())),
    ]);
    expect(mp3.file.sink.codes()).toContain('SF0331');
    expect(mp3.model.mainTimeline.streamSoundSpans[0]?.blocks[0]).toMatchObject({ sampleOffset: 0, sampleCount: 0 });

    // A block carrying a complete packet header but short of its declared frame count is NOT
    // malformed: SoundStreamHead declares an *average* sample count, and 26% of real ADPCM sounds
    // run a frame or two short (errata E-031/E-032). 3 bytes = 2-bit code size + one 22-bit
    // header exactly, so one frame of the declared two is present.
    const shortTail = analyze([
      tag(Tag.SoundStreamHead2, streamHead(1, 2, null)),
      tag(Tag.SoundStreamBlock, Uint8Array.from([0, 0, 1])),
    ]);
    expect(shortTail.file.sink.codes()).not.toContain('SF0328');

    // A block that cannot even complete a packet header is malformed: 2 bytes leave 14 bits after
    // the code-size field, and a header needs 22.
    const headerless = analyze([
      tag(Tag.SoundStreamHead2, streamHead(1, 2, null)),
      tag(Tag.SoundStreamBlock, Uint8Array.from([0, 1])),
    ]);
    expect(headerless.file.sink.codes()).toContain('SF0328');
  });

  it('T-AUD-109: models StartSound2 class controls and reports the unsupported class lookup', () => {
    const { file, model } = analyze([
      tag(Tag.StartSound2, Uint8Array.from([...new TextEncoder().encode('library.Sound'), 0, 0])),
    ]);
    expect(model.mainTimeline.frames[0]?.soundEvents[0]).toMatchObject({
      soundId: null,
      className: 'library.Sound',
      info: { reserved: 0 },
    });
    expect(file.sink.codes()).toContain('SF0309');
  });

  it('reports nonzero ADPCM bytes that decode as silent audio', () => {
    const { file } = analyze([
      tag(Tag.SoundStreamHead2, streamHead(1, 1, null)),
      tag(Tag.SoundStreamBlock, Uint8Array.from([0, 0, 1])),
    ]);
    expect(file.sink.codes()).toContain('SF0327');
  });
});
