/**
 * Placement-body flag corpus and PlaceObject v1 boundary — T-MOD-001/002/004.
 */

import { describe, expect, it } from 'vitest';

import { Cursor, decodePlaceObject, decodePlaceObject2, decodePlaceObject3 } from '@swf-forge/swf';
import { ByteWriter } from '@swf-forge/swf/test-support';

function identityMatrix(): Uint8Array {
  return Uint8Array.of(0);
}

function identityCxform(): Uint8Array {
  return Uint8Array.of(0);
}

function clipActions(): Uint8Array {
  const writer = new ByteWriter();
  writer.u16(0).u32(1).u32(1).u32(1).u8(0).u32(0);
  return writer.toUint8Array();
}

function placeObject2(flags: number): Uint8Array {
  const writer = new ByteWriter().u8(flags).u16(1);
  if ((flags & 0x02) !== 0) writer.u16(1);
  if ((flags & 0x04) !== 0) writer.bytes(identityMatrix());
  if ((flags & 0x08) !== 0) writer.bytes(identityCxform());
  if ((flags & 0x10) !== 0) writer.u16(7);
  if ((flags & 0x20) !== 0) writer.text('instance');
  if ((flags & 0x40) !== 0) writer.u16(2);
  if ((flags & 0x80) !== 0) writer.bytes(clipActions());
  return writer.toUint8Array();
}

function placeObject3(v2: number, v3: number): Uint8Array {
  const writer = new ByteWriter().u8(v2).u8(v3).u16(1);
  const hasCharacter = (v2 & 0x02) !== 0;
  const hasImage = (v3 & 0x10) !== 0;
  const hasClassName = (v3 & 0x08) !== 0;
  if (hasClassName || (hasImage && hasCharacter)) writer.text('ClassName');
  if (hasCharacter) writer.u16(1);
  if ((v2 & 0x04) !== 0) writer.bytes(identityMatrix());
  if ((v2 & 0x08) !== 0) writer.bytes(identityCxform());
  if ((v2 & 0x10) !== 0) writer.u16(7);
  if ((v2 & 0x20) !== 0) writer.text('instance');
  if ((v2 & 0x40) !== 0) writer.u16(2);
  if ((v3 & 0x01) !== 0) writer.u8(0); // empty FILTERLIST
  if ((v3 & 0x02) !== 0) writer.u8(0); // normal BlendMode
  if ((v3 & 0x04) !== 0) writer.u8(1); // BitmapCache
  if ((v3 & 0x20) !== 0) writer.u8(1); // Visible
  if ((v3 & 0x40) !== 0) writer.bytes([1, 2, 3, 4]); // RGBA
  if ((v2 & 0x80) !== 0) writer.bytes(clipActions());
  return writer.toUint8Array();
}

describe('placement flag corpora', () => {
  it('T-MOD-001 decodes PlaceObject v1 with and without its optional CXFORM tail and id-zero move', () => {
    const withTransform = decodePlaceObject(new Cursor(Uint8Array.of(3, 0, 2, 0, 0, 0, 0, 0)), 0, 0);
    expect(withTransform).toMatchObject({ characterId: 3, depth: 2, cxform: { rm: 256, gm: 256, bm: 256 } });

    const withoutTransform = decodePlaceObject(new Cursor(Uint8Array.of(3, 0, 2, 0, 0)), 0, 0);
    expect(withoutTransform.cxform).toBeNull();

    const moved = new Cursor(Uint8Array.of(0, 0, 2, 0, 0));
    expect(decodePlaceObject(moved, 0, 0)).toMatchObject({ move: true, characterId: null, depth: 2 });
    expect(moved.sink.codes()).toContain('SF0117');
  });

  it('T-MOD-002 exhausts every PlaceObject2 optional-field flag combination without desynchronizing', () => {
    for (let flags = 0; flags <= 0xff; flags += 1) {
      const body = placeObject2(flags);
      const cursor = new Cursor(body, 0, body.length, { version: 8 });
      decodePlaceObject2(cursor, flags, 0);
      expect(cursor.offset, `PlaceObject2 flags 0x${flags.toString(16)}`).toBe(cursor.limit);
    }
  });

  it('T-MOD-002 exhausts all 65,536 PlaceObject3 flag-byte pairs without desynchronizing', () => {
    for (let first = 0; first <= 0xff; first += 1) {
      for (let second = 0; second <= 0xff; second += 1) {
        const body = placeObject3(first, second);
        const cursor = new Cursor(body, 0, body.length, { version: 8 });
        decodePlaceObject3(cursor, (first << 8) | second, 0);
        expect(cursor.offset, `PlaceObject3 flags 0x${first.toString(16)} 0x${second.toString(16)}`).toBe(cursor.limit);
      }
    }
  });
});
