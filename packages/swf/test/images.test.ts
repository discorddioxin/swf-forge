/** P3 bitmap tag metadata and lazy, zero-copy model integration tests. */

import { describe, expect, it } from 'vitest';

import { Cursor, Tag, buildMovieModel, decodeDefineBitmap, openSwf } from '@swf-forge/swf';
import { ByteWriter, buildSwf, concat, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

function u16(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

describe('bitmap tag models', () => {
  it('splits JPEG4 image and alpha payloads and retains DeblockParam', () => {
    const body = concat(u16(7), u32(4), u16(0x0180), Uint8Array.from([0xff, 0xd8, 0xff, 0xd9, 0x78, 0x9c]));
    const cursor = new Cursor(body, 0, body.length, { tagCode: Tag.DefineBitsJPEG4 });
    const model = decodeDefineBitmap(Tag.DefineBitsJPEG4, cursor);
    expect(model).toMatchObject({
      id: 7,
      source: 'jpeg4',
      alphaDataOffset: 4,
      deblocking: 0x0180,
      payload: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]),
      alpha: Uint8Array.from([0x78, 0x9c]),
    });
    expect(cursor.sink.codes()).toContain('SF0254');
  });

  it('T-MOD-313: tolerates observed Lossless2 format 4 and quarantines unknown formats', () => {
    const format4 = new ByteWriter().u16(2).u8(4).u16(1).u16(1).bytes([1, 2, 3]).toUint8Array();
    const decoded = decodeDefineBitmap(Tag.DefineBitsLossless2, new Cursor(format4, 0, format4.length));
    expect(decoded).toMatchObject({ source: 'lossless2', bitmapFormatCode: 4, losslessFormat: 4 });
    expect(decoded.sourcePremultiplied).toBe(false);

    const unknown = new ByteWriter().u16(3).u8(9).u16(1).u16(1).bytes([4, 5]).toUint8Array();
    const unknownCursor = new Cursor(unknown, 0, unknown.length);
    expect(decodeDefineBitmap(Tag.DefineBitsLossless, unknownCursor).losslessFormat).toBeNull();
    expect(unknownCursor.sink.codes()).toContain('SF0260');
  });

  it('buildMovieModel retains bitmap payload bytes as a zero-copy view', () => {
    const payload = Uint8Array.from([0xff, 0xd8, 1, 2, 3]);
    const body = concat(tag(Tag.DefineBitsJPEG2, concat(u16(12), payload)), showFrames(1), endTag());
    const file = openSwf(buildSwf({ version: 10, body, frameCount: 1 }));
    const model = buildMovieModel(file).characters.get(12)?.bitmap;
    expect(model).toMatchObject({ source: 'jpeg2', id: 12, payload });
    expect(model?.payload.buffer).toBe(file.body.buffer);
  });
});
