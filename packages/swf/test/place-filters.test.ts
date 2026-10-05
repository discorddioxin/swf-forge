/**
 * PlaceObject3 and FILTERLIST conformance: `T-MOD-005`, `T-MOD-006`, `T-MOD-009`, `T-MOD-010`.
 */

import { describe, expect, it } from 'vitest';

import {
  Cursor,
  decodePlaceObject,
  decodePlaceObject3,
  decodeRemoveObject,
  decodeRemoveObject2,
  readFilterList,
} from '@swf-forge/swf';
import { ByteWriter } from '@swf-forge/swf/test-support';

function rgba(writer: ByteWriter, value = [1, 2, 3, 4]): ByteWriter {
  return writer.bytes(value);
}

function fixed(writer: ByteWriter, value: number): ByteWriter {
  return writer.s32(Math.round(value * 65536));
}

function fixed8(writer: ByteWriter, value: number): ByteWriter {
  return writer.s16(Math.round(value * 256));
}

function float32(writer: ByteWriter, value: number): ByteWriter {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setFloat32(0, value, true);
  return writer.bytes(bytes);
}

function flags3(writer: ByteWriter, inner: number, knockout: number, composite: number, passes: number): ByteWriter {
  return writer.bits(inner, 1).bits(knockout, 1).bits(composite, 1).bits(passes, 5).align();
}

function flags4(
  writer: ByteWriter,
  inner: number,
  knockout: number,
  composite: number,
  onTop: number,
  passes: number,
): ByteWriter {
  return writer.bits(inner, 1).bits(knockout, 1).bits(composite, 1).bits(onTop, 1).bits(passes, 4).align();
}

function filterList(id: number, writeFields: (writer: ByteWriter) => void): Uint8Array {
  const writer = new ByteWriter();
  writer.u8(1).u8(id);
  writeFields(writer);
  return writer.toUint8Array();
}

function allEightFilters(): readonly Uint8Array[] {
  return [
    filterList(0, (w) => {
      rgba(w);
      fixed(w, 1);
      fixed(w, 2);
      fixed(w, 0.5);
      fixed(w, 3);
      fixed8(w, 1);
      flags3(w, 1, 0, 1, 17);
    }),
    filterList(1, (w) => {
      fixed(w, 4);
      fixed(w, 5);
      w.bits(6, 5).bits(0, 3).align();
    }),
    filterList(2, (w) => {
      rgba(w);
      fixed(w, 7);
      fixed(w, 8);
      fixed8(w, 0.75);
      flags3(w, 1, 1, 1, 9);
    }),
    filterList(3, (w) => {
      rgba(w, [5, 6, 7, 8]);
      rgba(w, [9, 10, 11, 12]);
      fixed(w, 1);
      fixed(w, 2);
      fixed(w, 0.25);
      fixed(w, 4);
      fixed8(w, 1.5);
      flags4(w, 1, 0, 1, 1, 12);
    }),
    filterList(4, (w) => {
      w.u8(2);
      rgba(w, [1, 2, 3, 4]);
      rgba(w, [5, 6, 7, 8]);
      w.u8(10).u8(240);
      fixed(w, 1);
      fixed(w, 2);
      fixed(w, 0.5);
      fixed(w, 3);
      fixed8(w, 1);
      flags4(w, 1, 0, 1, 0, 7);
    }),
    filterList(5, (w) => {
      w.u8(2).u8(1);
      float32(w, 1);
      float32(w, -0.5);
      float32(w, 0.25);
      float32(w, 0.75);
      rgba(w, [9, 8, 7, 6]);
      w.bits(0, 6).bits(1, 1).bits(1, 1).align();
    }),
    filterList(6, (w) => {
      for (let i = 0; i < 20; i += 1) float32(w, i + 0.5);
    }),
    filterList(7, (w) => {
      w.u8(1);
      rgba(w, [2, 4, 6, 8]);
      w.u8(128);
      fixed(w, 3);
      fixed(w, 4);
      fixed(w, 1);
      fixed(w, 5);
      fixed8(w, 2);
      flags4(w, 0, 1, 1, 1, 15);
    }),
  ];
}

describe('FILTERLIST', () => {
  it('T-MOD-005 decodes all eight filter layouts and keeps authored units', () => {
    const decoded = allEightFilters().map((bytes) => readFilterList(new Cursor(bytes)).filters[0]);
    expect(decoded.map((filter) => filter?.kind)).toEqual([
      'dropShadow',
      'blur',
      'glow',
      'bevel',
      'gradientGlow',
      'convolution',
      'colorMatrix',
      'gradientBevel',
    ]);
    expect(decoded[0]).toMatchObject({
      kind: 'dropShadow',
      blurX: 1,
      angle: 0.5,
      distance: 3,
      strength: 1,
      passes: 17,
    });
    expect(decoded[1]).toMatchObject({ kind: 'blur', blurX: 4, blurY: 5, passes: 6, reserved: 0 });
    expect(decoded[2]).toMatchObject({ kind: 'glow', strength: 0.75, innerGlow: true, passes: 9 });
    expect(decoded[3]).toMatchObject({
      kind: 'bevel',
      shadowColor: { r: 5, g: 6, b: 7, a: 8 },
      onTop: true,
      passes: 12,
    });
    expect(decoded[4]).toMatchObject({
      kind: 'gradientGlow',
      ratios: [10, 240],
      colors: [
        { r: 1, g: 2, b: 3, a: 4 },
        { r: 5, g: 6, b: 7, a: 8 },
      ],
    });
    expect(decoded[5]).toMatchObject({
      kind: 'convolution',
      matrixX: 2,
      matrixY: 1,
      divisor: 1,
      bias: -0.5,
      matrix: [0.25, 0.75],
      clamp: true,
      preserveAlpha: true,
    });
    expect(decoded[6]).toMatchObject({
      kind: 'colorMatrix',
      matrix: [
        0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5, 13.5, 14.5, 15.5, 16.5, 17.5, 18.5, 19.5,
      ],
    });
    expect(decoded[7]).toMatchObject({ kind: 'gradientBevel', ratios: [128], strength: 2, passes: 15 });
  });

  it('T-MOD-006 keeps an unknown filter id and its undecodable tail raw', () => {
    const sinkCursor = new Cursor(Uint8Array.from([1, 99, 0xaa, 0xbb, 0xcc]));
    const decoded = readFilterList(sinkCursor);
    expect(decoded.complete).toBe(false);
    expect(decoded.filters[0]).toMatchObject({
      kind: 'unknown',
      filterId: 99,
      raw: Uint8Array.from([99, 0xaa, 0xbb, 0xcc]),
    });
    expect(sinkCursor.offset).toBe(sinkCursor.limit);
    expect(sinkCursor.sink.codes()).toContain('SF0121');
  });

  it('T-MOD-006 reports a noncanonical CompositeSource parameter', () => {
    const bytes = filterList(0, (w) => {
      rgba(w);
      fixed(w, 0);
      fixed(w, 0);
      fixed(w, 0);
      fixed(w, 0);
      fixed8(w, 1);
      flags3(w, 0, 0, 0, 0);
    });
    const cursor = new Cursor(bytes);
    readFilterList(cursor);
    expect(cursor.sink.codes()).toContain('SF0122');
  });
});

describe('PlaceObject3 full field order', () => {
  it('T-MOD-009 preserves image/class, filters, implied cache and backing fields', () => {
    const writer = new ByteWriter();
    writer.u8(0x82).u8(0x7f).u16(4).text('external.Asset').u16(7);
    writer.bytes(allEightFilters()[1]!); // one Blur filter, then BlendMode/BitmapCache/Visible/BackgroundColor
    writer.u8(4).u8(0).u8(0).bytes([1, 2, 3, 4]).bytes([0xaa, 0xbb]);
    const bytes = writer.toUint8Array();
    const cursor = new Cursor(bytes);
    const placement = decodePlaceObject3(cursor, 2, 12);
    expect(placement).toMatchObject({
      kind: 'place',
      tag: 'PlaceObject3',
      index: 2,
      depth: 4,
      characterId: 7,
      className: 'external.Asset',
      image: { kind: 'characterId' },
      filters: [{ kind: 'blur', blurX: 4, blurY: 5, passes: 6 }],
      blendMode: 4,
      cacheAsBitmap: true,
      rawCacheValue: 0,
      visible: false,
      opaqueBackground: { r: 1, g: 2, b: 3, a: 4 },
      clipActions: { length: 2 },
    });
    expect(cursor.sink.codes()).toContain('SF0116');
  });

  it('T-MOD-009 distinguishes HasImage class records from character-id image records', () => {
    const writer = new ByteWriter();
    writer.u8(0).u8(0x18).u16(2).text('remote.BitmapClass');
    const placement = decodePlaceObject3(new Cursor(writer.toUint8Array()), 0, 0);
    expect(placement.image).toEqual({ kind: 'class' });
    expect(placement.className).toBe('remote.BitmapClass');
    expect(placement.characterId).toBeNull();
  });
});

describe('placement depth/clip-depth conventions (SF0112/SF0113)', () => {
  it('T-MOD-004: PlaceObject3 reports depth ≥ 16384 (SF0112) like PlaceObject2 does', () => {
    // v2 flags 0, v3 flags 0, Depth = 16384 (0x4000 little-endian).
    const cursor = new Cursor(Uint8Array.from([0x00, 0x00, 0x00, 0x40]));
    decodePlaceObject3(cursor, 0, 0);
    expect(cursor.sink.codes()).toContain('SF0112');
  });

  it('T-MOD-004: PlaceObject3 reports an empty mask range (SF0113) when ClipDepth does not exceed Depth', () => {
    // v2 flags: HasClipDepth (0x40) | HasCharacter (0x02); v3 flags 0;
    // Depth = 10, CharacterId = 1, ClipDepth = 5 (≤ 10 => empty mask range).
    const cursor = new Cursor(Uint8Array.from([0x42, 0x00, 10, 0, 1, 0, 5, 0]));
    const placement = decodePlaceObject3(cursor, 0, 0);
    expect(placement.clipDepth).toBe(5);
    expect(cursor.sink.codes()).toContain('SF0113');
    expect(cursor.sink.codes()).not.toContain('SF0112');
  });

  it('T-MOD-004: a legal clip depth above its own depth and a conventional depth report nothing', () => {
    // Depth = 10, CharacterId = 1, ClipDepth = 12 (> 10 => non-empty range).
    const cursor = new Cursor(Uint8Array.from([0x42, 0x00, 10, 0, 1, 0, 12, 0]));
    decodePlaceObject3(cursor, 0, 0);
    expect(cursor.sink.codes()).not.toContain('SF0113');
    expect(cursor.sink.codes()).not.toContain('SF0112');
  });

  it('T-MOD-004: PlaceObject v1 reports the dynamic depth range (SF0112) too', () => {
    // CharacterId = 1, Depth = 16384, then a 4-byte identity-ish MATRIX tail (Nbits byte 0).
    const cursor = new Cursor(Uint8Array.from([1, 0, 0x00, 0x40, 0x00]));
    decodePlaceObject(cursor, 0, 0);
    expect(cursor.sink.codes()).toContain('SF0112');
  });
});

describe('RemoveObject payloads', () => {
  it('T-MOD-003 retains CharacterId for RemoveObject and null for RemoveObject2', () => {
    expect(decodeRemoveObject(new Cursor(Uint8Array.from([5, 0, 2, 0])), 3, 20)).toMatchObject({
      kind: 'remove',
      tag: 'RemoveObject',
      characterId: 5,
      depth: 2,
    });
    expect(decodeRemoveObject2(new Cursor(Uint8Array.from([2, 0])), 4, 30)).toMatchObject({
      kind: 'remove',
      tag: 'RemoveObject2',
      characterId: null,
      depth: 2,
    });
  });
});
