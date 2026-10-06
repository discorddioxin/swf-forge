/** Shape decoder regression fixtures for Shape4 flags, style counts, and diagnostic ceilings. */

import { describe, expect, it } from 'vitest';

import { Cursor, DiagnosticSink, Tag, decodeDefineShapeVersion } from '@swf-forge/swf';
import { ByteWriter, writeRect } from '@swf-forge/swf/test-support';

const BOUNDS = { xMin: 0, xMax: 100, yMin: 0, yMax: 100 };

function shape4(flags: number, version = 10): { bytes: Uint8Array; sink: DiagnosticSink } {
  const writer = new ByteWriter();
  writer.u16(7);
  writeRect(writer, BOUNDS);
  writeRect(writer, BOUNDS);
  writer.u8(flags);
  writer.u8(0).u8(0); // no fill/line styles
  writer.bits(0, 4).bits(0, 4); // no style indices
  writer.bits(0, 6).align(); // EndShapeRecord
  const bytes = writer.toUint8Array();
  const sink = new DiagnosticSink();
  decodeDefineShapeVersion(Tag.DefineShape4, new Cursor(bytes, 0, bytes.length, { version, sink }));
  return { bytes, sink };
}

function shape1WithEmptyMoveTo(): Uint8Array {
  const writer = new ByteWriter();
  writer.u16(5);
  writeRect(writer, BOUNDS);
  writer.u8(0).u8(0); // no fill/line styles
  writer.bits(0, 4).bits(0, 4);
  writer.bits(0, 1).bits(0, 4).bits(1, 1); // StyleChange with MoveTo only
  writer.bits(1, 5).bits(0, 1).bits(0, 1); // MoveBits=1, move to origin
  writer.bits(0, 6).align(); // EndShapeRecord
  return writer.toUint8Array();
}

function shape1With255Styles(): Uint8Array {
  const writer = new ByteWriter();
  writer.u16(3);
  writeRect(writer, BOUNDS);
  writer.u8(0xff); // literal 255 in DefineShape v1; no extended UI16 follows
  for (let i = 0; i < 255; i += 1) writer.u8(0).u8(i).u8(0).u8(0);
  writer.u8(0xff); // literal 255 line styles in v1
  for (let i = 0; i < 255; i += 1) writer.u16(20).u8(0).u8(i).u8(0);
  writer.bits(0, 4).bits(0, 4).bits(0, 6).align();
  return writer.toUint8Array();
}

function shape1WithLargeStyleArrays(count: number, duplicates: boolean, lineStyles = false): Uint8Array {
  const writer = new ByteWriter();
  writer.u16(4);
  writeRect(writer, BOUNDS);
  writer.u8(lineStyles ? 0 : count);
  if (!lineStyles) {
    for (let i = 0; i < count; i += 1) {
      const value = duplicates ? 7 : i;
      writer
        .u8(0)
        .u8(value & 0xff)
        .u8((value >>> 8) & 0xff)
        .u8(0);
    }
  }
  writer.u8(lineStyles ? count : 0);
  if (lineStyles) {
    for (let i = 0; i < count; i += 1) {
      const value = duplicates ? 7 : i;
      writer
        .u16(20)
        .u8(value & 0xff)
        .u8((value >>> 8) & 0xff)
        .u8(0);
    }
  }
  writer.bits(0, 4).bits(0, 4).bits(0, 6).align();
  return writer.toUint8Array();
}

function shape4LineStyle2(startCap: number, endCap: number, join: number): Uint8Array {
  const writer = new ByteWriter();
  writer.u16(8);
  writeRect(writer, BOUNDS);
  writeRect(writer, BOUNDS);
  writer.u8(0); // Shape4 flags
  writer.u8(0); // no fills
  writer.u8(1).u16(20); // one LineStyle2, 20 twips wide
  writer.bits(startCap, 2).bits(join, 2).bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 1);
  writer.bits(0, 5).bits(0, 1).bits(endCap, 2);
  if (join === 2) writer.u16(0x0200); // unsigned 2.0 miter limit
  writer.u8(0).u8(0).u8(0).u8(255);
  writer.bits(0, 4).bits(1, 4).bits(0, 6).align();
  return writer.toUint8Array();
}

function shape4RectWithStroke(): Uint8Array {
  const writer = new ByteWriter();
  writer.u16(9);
  writeRect(writer, { xMin: -10, xMax: 3010, yMin: -10, yMax: 2010 });
  writeRect(writer, { xMin: 0, xMax: 3000, yMin: 0, yMax: 2000 });
  writer.u8(0); // Shape4 flags
  writer.u8(0); // no fills
  writer.u8(1).u16(20); // one round-capped/round-joined line
  writer.bits(0, 2).bits(0, 2).bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 1);
  writer.bits(0, 5).bits(0, 1).bits(0, 2);
  writer.u8(0).u8(0).u8(0).u8(255);
  writer.bits(0, 4).bits(1, 4);
  writer.bits(0, 1).bits(0, 1).bits(1, 1).bits(0, 1).bits(0, 1).bits(1, 1);
  writer.bits(1, 5).bits(0, 1).bits(0, 1).bits(1, 1); // move to origin, select line 1
  const edge = (dx: number, dy: number): void => {
    writer.bits(1, 1).bits(1, 1).bits(11, 4).bits(1, 1); // straight, 13-bit general edge
    writer.bits(dx < 0 ? 2 ** 13 + dx : dx, 13).bits(dy < 0 ? 2 ** 13 + dy : dy, 13);
  };
  edge(3000, 0);
  edge(0, 2000);
  edge(-3000, 0);
  edge(0, -2000);
  writer.bits(0, 6).align();
  return writer.toUint8Array();
}

function shapeWithExtendedCounts(tagCode: number): Uint8Array {
  const writer = new ByteWriter();
  writer.u16(10);
  writeRect(writer, BOUNDS);
  if (tagCode === Tag.DefineShape4) {
    writeRect(writer, BOUNDS);
    writer.u8(0); // Shape4 flags
  }
  const version = tagCode === Tag.DefineShape2 ? 2 : tagCode === Tag.DefineShape3 ? 3 : 4;
  const color = version >= 3 ? [0, 0, 0, 255] : [0, 0, 0];
  writer.u8(0xff).u16(256);
  for (let index = 0; index < 256; index += 1) writer.u8(0).bytes(Uint8Array.from(color));
  writer.u8(0xff).u16(256);
  for (let index = 0; index < 256; index += 1) {
    writer.u16(20);
    if (version === 4) {
      writer.bits(0, 2).bits(0, 2).bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 1);
      writer.bits(0, 5).bits(0, 1).bits(0, 2);
    }
    writer.bytes(Uint8Array.from(color));
  }
  writer.bits(0, 4).bits(0, 4).bits(0, 6).align();
  return writer.toUint8Array();
}

describe('DefineShape4 flag byte', () => {
  it('decodes all named Shape4 flag bits 0x00–0x07 and keeps reserved flags separate', () => {
    for (let flags = 0; flags <= 7; flags += 1) {
      const { bytes, sink } = shape4(flags);
      const result = decodeDefineShapeVersion(
        Tag.DefineShape4,
        new Cursor(bytes, 0, bytes.length, { version: 10, sink }),
      );
      expect(result.shape.rawShape4Flags).toBe(flags);
      expect(result.shape.fillRule).toBe((flags & 0x04) !== 0 ? 'nonZero' : 'evenOdd');
      expect(result.shape.nonScalingStrokes).toBe((flags & 0x02) !== 0);
      expect(result.shape.scalingStrokes).toBe((flags & 0x01) !== 0);
      expect(sink.codes()).not.toContain('SF0188');
    }
  });

  it('T-MOD-126 preserves the reserved mask and raw byte in one per-file diagnostic', () => {
    const sink = new DiagnosticSink();
    const bytes = shape4(0xa0).bytes;
    const first = decodeDefineShapeVersion(Tag.DefineShape4, new Cursor(bytes, 0, bytes.length, { version: 10, sink }));
    decodeDefineShapeVersion(Tag.DefineShape4, new Cursor(bytes, 0, bytes.length, { version: 10, sink }));
    expect(first.shape.rawShape4Flags).toBe(0xa0);
    const diagnostic = sink.list().find((entry) => entry.code === 'SF0188');
    expect(diagnostic?.message).toContain('0xa0');
    expect(sink.list().filter((entry) => entry.code === 'SF0188')).toHaveLength(1);
    expect(diagnostic?.count).toBe(2);
  });

  it('T-MOD-126 reports Shape4 in a pre-SWF-8 file without a character scope', () => {
    const { bytes, sink } = shape4(0x04, 5);
    decodeDefineShapeVersion(Tag.DefineShape4, new Cursor(bytes, 0, bytes.length, { version: 5, sink }));
    const diagnostic = sink.list().find((entry) => entry.code === 'SF0183');
    expect(diagnostic?.severity).toBe('info');
    expect(diagnostic?.characterId).toBeUndefined();
  });
});

describe('empty shape subpaths', () => {
  it('reports and drops a MoveTo with no edges (SF0185)', () => {
    const sink = new DiagnosticSink();
    const bytes = shape1WithEmptyMoveTo();
    const result = decodeDefineShapeVersion(Tag.DefineShape, new Cursor(bytes, 0, bytes.length, { sink }));
    expect(result.shape.edges).toEqual([]);
    expect(result.shape.paths).toEqual([]);
    expect(sink.codes()).toContain('SF0185');
  });
});

describe('LINESTYLE2 caps and joins', () => {
  it('T-MOD-116 covers every cap × join pair and reads miter only for miter joins', () => {
    for (let startCap = 0; startCap <= 2; startCap += 1) {
      for (let endCap = 0; endCap <= 2; endCap += 1) {
        for (let join = 0; join <= 2; join += 1) {
          const bytes = shape4LineStyle2(startCap, endCap, join);
          const result = decodeDefineShapeVersion(
            Tag.DefineShape4,
            new Cursor(bytes, 0, bytes.length, { version: 10 }),
          );
          const style = result.shape.styles.lines[1];
          expect(style?.caps).toEqual({ start: startCap, end: endCap });
          expect(style?.join).toBe(join);
          expect(style?.miterLimit).toBe(join === 2 ? 2 : undefined);
        }
      }
    }
  });
});

describe('DefineShape4 bounds', () => {
  it('T-MOD-118 retains edge bounds and recomputes the four-edge stroke geometry', () => {
    const bytes = shape4RectWithStroke();
    const sink = new DiagnosticSink();
    const result = decodeDefineShapeVersion(
      Tag.DefineShape4,
      new Cursor(bytes, 0, bytes.length, { version: 10, sink }),
    );
    expect(result.shape.bounds).toEqual({ xMin: -10, xMax: 3010, yMin: -10, yMax: 2010 });
    expect(result.shape.edgeBounds).toEqual({ xMin: 0, xMax: 3000, yMin: 0, yMax: 2000 });
    expect(result.shape.recomputedBounds).toEqual(result.shape.edgeBounds);
    expect(result.shape.strokes).toEqual([{ styleId: 1, edgeRefs: [0, 1, 2, 3], closed: true }]);
    expect(sink.codes()).not.toContain('SF0187');
  });
});

describe('DefineShape v1 style counts', () => {
  it('T-MOD-113 treats 0xFF as a literal 255 in both arrays and consumes the whole tag', () => {
    const bytes = shape1With255Styles();
    const cursor = new Cursor(bytes);
    const result = decodeDefineShapeVersion(Tag.DefineShape, cursor);
    expect(result.shape.styles.fills).toHaveLength(256);
    expect(result.shape.styles.lines).toHaveLength(256);
    expect(cursor.offset).toBe(bytes.length);
    expect(cursor.sink.codes()).not.toContain('SF0191');
  });

  it('T-MOD-113 reads extended 0xFF counts in Shape2, Shape3, and Shape4', () => {
    for (const tagCode of [Tag.DefineShape2, Tag.DefineShape3, Tag.DefineShape4]) {
      const bytes = shapeWithExtendedCounts(tagCode);
      const cursor = new Cursor(bytes);
      const result = decodeDefineShapeVersion(tagCode, cursor);
      expect(result.shape.styles.fills).toHaveLength(257);
      expect(result.shape.styles.lines).toHaveLength(257);
      expect(cursor.offset).toBe(bytes.length);
      expect(cursor.bitOffset).toBe(0);
    }
  });

  it('T-MOD-127 emits SF0190 only for byte-identical fills at the named ceiling', () => {
    const distinctSink = new DiagnosticSink();
    const distinct = shape1WithLargeStyleArrays(250, false);
    decodeDefineShapeVersion(Tag.DefineShape, new Cursor(distinct, 0, distinct.length, { sink: distinctSink }));
    expect(distinctSink.codes()).not.toContain('SF0190');

    const duplicateSink = new DiagnosticSink();
    const duplicates = shape1WithLargeStyleArrays(250, true);
    decodeDefineShapeVersion(Tag.DefineShape, new Cursor(duplicates, 0, duplicates.length, { sink: duplicateSink }));
    expect(duplicateSink.codes()).toContain('SF0190');
    expect(duplicateSink.list().find((entry) => entry.code === 'SF0190')?.severity).toBe('warning');
  });

  it('T-MOD-127 applies the same byte-identity ceiling to line styles', () => {
    const sink = new DiagnosticSink();
    const bytes = shape1WithLargeStyleArrays(250, true, true);
    decodeDefineShapeVersion(Tag.DefineShape, new Cursor(bytes, 0, bytes.length, { sink }));
    expect(sink.codes()).toContain('SF0190');
  });
});
