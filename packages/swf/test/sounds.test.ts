/** Sound tag parsing, zero-copy asset storage and timeline-media layouts (IMPL-090 P3 decode slice). */

import { describe, expect, it } from 'vitest';

import {
  Cursor,
  Tag,
  buildMovieModel,
  decodeDefineSound,
  decodeSoundStreamBlock,
  decodeSoundStreamHead,
  decodeStartSound,
  openSwf,
} from '@swf-forge/swf';
import { ByteWriter, buildSwf, concat, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

function defineSoundBody(id: number, data: Uint8Array): Uint8Array {
  const writer = new ByteWriter();
  writer.u16(id).bits(3, 4).bits(2, 2).bits(1, 1).bits(1, 1).u32(4).bytes(data);
  return writer.toUint8Array();
}

describe('sound tag structures', () => {
  it('T-AUD-109: decodes DefineSound metadata and retains the payload as a zero-copy view', () => {
    const payload = Uint8Array.from([0x10, 0x20, 0x30, 0x40]);
    const body = defineSoundBody(17, payload);
    const cursor = new Cursor(body, 0, body.length, { tagCode: Tag.DefineSound });
    const sound = decodeDefineSound(cursor);
    expect(sound).toMatchObject({
      id: 17,
      format: 3,
      rateCode: 2,
      sampleRate: 22050,
      bitsPerSample: 16,
      channels: 2,
      sampleCount: 4,
    });
    expect(sound.data).toEqual(payload);
    expect(sound.data.buffer).toBe(body.buffer);
    expect(sound.data.byteOffset).toBe(body.byteOffset + 7);
    expect(cursor.offset).toBe(body.length);
  });

  it('T-AUD-109: decodes SOUNDINFO fields in MSB-first order and preserves envelope units', () => {
    const writer = new ByteWriter();
    writer.u16(17).bits(0, 2).bits(1, 1).bits(0, 1).bits(1, 1).bits(1, 1).bits(1, 1).bits(1, 1);
    writer.u32(100).u32(200).u16(3).u8(1).u32(4410).u16(32768).u16(16384);
    const bytes = writer.toUint8Array();
    const start = decodeStartSound(new Cursor(bytes, 0, bytes.length, { tagCode: Tag.StartSound }));
    expect(start.soundId).toBe(17);
    expect(start.info).toEqual({
      reserved: 0,
      syncStop: true,
      syncNoMultiple: false,
      inPoint: 100,
      outPoint: 200,
      loopCount: 3,
      envelope: [{ position44: 4410, leftLevel: 32768, rightLevel: 16384 }],
    });

    const start2Bytes = new ByteWriter().text('class.Sound').bits(0, 8).toUint8Array();
    const start2 = decodeStartSound(new Cursor(start2Bytes, 0, start2Bytes.length, { version: 10 }), true);
    expect(start2).toMatchObject({ soundId: null, className: 'class.Sound', info: { reserved: 0 } });
  });

  it('T-AUD-113: decodes SoundStreamHead2 playback/source fields and MP3-only LatencySeek', () => {
    const writer = new ByteWriter().bits(0, 4).bits(7, 4).bits(2, 4).bits(15, 4).u16(512).s16(-5);
    const bytes = writer.toUint8Array();
    const head = decodeSoundStreamHead(new Cursor(bytes, 0, bytes.length, { tagCode: Tag.SoundStreamHead2 }), 45);
    expect(head).toMatchObject({
      reserved: 0,
      playbackRateCode: 1,
      playbackRate: 11025,
      playbackBitsPerSample: 16,
      playbackChannels: 2,
      format: 2,
      rateCode: 3,
      sampleRate: 44100,
      bitsPerSample: 16,
      channels: 2,
      sampleCount: 512,
      latencySeek: -5,
    });

    const noLatencyBytes = new ByteWriter().bits(0, 4).bits(7, 4).bits(0, 4).bits(15, 4).u16(512).toUint8Array();
    const noLatency = decodeSoundStreamHead(
      new Cursor(noLatencyBytes, 0, noLatencyBytes.length, { tagCode: Tag.SoundStreamHead }),
      18,
    );
    expect(noLatency.latencySeek).toBeNull();
  });

  it('T-AUD-106: decodes MP3 stream SampleCount/SeekSamples and leaves frame bytes zero-copy', () => {
    const body = new ByteWriter().u16(1152).s16(-9).bytes([0xff, 0xfb, 0x90, 0x00, 1, 2]).toUint8Array();
    const cursor = new Cursor(body, 0, body.length, { tagCode: Tag.SoundStreamBlock });
    const block = decodeSoundStreamBlock(cursor, 2);
    expect(block.sampleCount).toBe(1152);
    expect(block.seekSamples).toBe(-9);
    expect(block.data).toEqual(Uint8Array.from([0xff, 0xfb, 0x90, 0x00, 1, 2]));
    expect(block.data.buffer).toBe(body.buffer);
  });

  it('T-AUD-109: buildMovieModel exposes a zero-copy DefineSound payload view', () => {
    const body = concat(
      tag(Tag.DefineSound, defineSoundBody(3, Uint8Array.from([1, 2, 3, 4]))),
      showFrames(1),
      endTag(),
    );
    const file = openSwf(buildSwf({ version: 8, body, frameCount: 1 }));
    const character = buildMovieModel(file).characters.get(3);
    expect(character?.sound).toMatchObject({ id: 3, format: 3, sampleRate: 22050, sampleCount: 4 });
    expect(character?.sound?.data).toEqual(Uint8Array.from([1, 2, 3, 4]));
    expect(character?.sound?.data.buffer).toBe(file.body.buffer);
  });
});
