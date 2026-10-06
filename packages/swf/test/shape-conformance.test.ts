/** Shape byte-level conformance fixtures for T-SWF-005/006 and IMPL-060 edge/state obligations. */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { Cursor, DiagnosticSink, Tag, decodeDefineShapeVersion, openSwf, readRect } from '@swf-forge/swf';
import { ByteWriter, writeRect } from '@swf-forge/swf/test-support';

const EMPTY_BOUNDS = { xMin: 0, xMax: 0, yMin: 0, yMax: 0 };
const APPENDIX_FIXTURE = fileURLToPath(new URL('../../../fixtures/appendix-a.swf', import.meta.url));

type Point = readonly [number, number];

function boundsForPoints(points: readonly Point[]) {
  return {
    xMin: Math.min(...points.map(([x]) => x)),
    xMax: Math.max(...points.map(([x]) => x)),
    yMin: Math.min(...points.map(([, y]) => y)),
    yMax: Math.max(...points.map(([, y]) => y)),
  };
}

function signed(writer: ByteWriter, value: number, width: number): void {
  writer.bits(value < 0 ? 2 ** width + value : value, width);
}

function shapeStart(
  bounds = EMPTY_BOUNDS,
  fillStyles: (writer: ByteWriter) => void = (w) => w.u8(0),
  lineStyles: (writer: ByteWriter) => void = (w) => w.u8(0),
) {
  const writer = new ByteWriter();
  writer.u16(17);
  writeRect(writer, bounds);
  writer.bytes([]);
  fillStyles(writer);
  lineStyles(writer);
  writer.bits(0, 4).bits(0, 4); // no styles initially
  return writer;
}

function writeStraight(writer: ByteWriter, width: number, dx: number, dy: number): void {
  writer
    .bits(1, 1)
    .bits(1, 1)
    .bits(width - 2, 4); // edge, straight, NumBits
  writer.bits(1, 1); // GeneralLineFlag
  signed(writer, dx, width);
  signed(writer, dy, width);
}

function writeCurve(writer: ByteWriter, width: number, deltas: readonly [number, number, number, number]): void {
  writer
    .bits(1, 1)
    .bits(0, 1)
    .bits(width - 2, 4); // edge, curved, NumBits
  for (const delta of deltas) signed(writer, delta, width);
}

function decode(writer: ByteWriter, tagCode: number = Tag.DefineShape2) {
  writer.bits(0, 6).align();
  const bytes = writer.toUint8Array();
  const sink = new DiagnosticSink();
  const cursor = new Cursor(bytes, 0, bytes.length, { sink, version: 8, tagCode });
  const result = decodeDefineShapeVersion(tagCode, cursor);
  return { bytes, cursor, result, sink };
}

describe('SHAPERECORD edge encoding', () => {
  it('T-SWF-005 / T-MOD-101 / T-MOD-115 decodes straight widths, four quadrants and absolute endpoints', () => {
    const cases = [
      { width: 2, dx: 1, dy: 1 },
      { width: 4, dx: -7, dy: 7 },
      { width: 8, dx: -127, dy: -128 },
      { width: 16, dx: 30000, dy: -30000 },
    ] as const;
    for (const [index, testCase] of cases.entries()) {
      const writer = shapeStart(
        boundsForPoints([
          [0, 0],
          [testCase.dx, testCase.dy],
        ]),
      );
      writeStraight(writer, testCase.width, testCase.dx, testCase.dy);
      const { bytes, cursor, result, sink } = decode(writer);
      expect(result.shape.edges[0]).toMatchObject({
        fromX: 0,
        fromY: 0,
        toX: testCase.dx,
        toY: testCase.dy,
      });
      expect(cursor.offset).toBe(bytes.length);
      expect(cursor.bitOffset).toBe(0);
      expect(sink.codes()).toEqual([]);
      expect(index).toBeLessThan(cases.length);
    }
  });

  it('T-SWF-005 / T-MOD-101 / T-MOD-115 decodes all curved deltas at NumBits+2, including NumBits zero', () => {
    const cases = [
      { width: 2, deltas: [1, -2, -2, 1] },
      { width: 4, deltas: [-4, 5, 3, -2] },
      { width: 8, deltas: [63, -64, -55, 60] },
      { width: 16, deltas: [30000, -30000, -1000, 2000] },
    ] as const;
    for (const testCase of cases) {
      const [controlX, controlY, anchorX, anchorY] = testCase.deltas;
      const writer = shapeStart(
        boundsForPoints([
          [0, 0],
          [controlX, controlY],
          [controlX + anchorX, controlY + anchorY],
        ]),
      );
      writeCurve(writer, testCase.width, testCase.deltas);
      const { bytes, cursor, result, sink } = decode(writer);
      expect(result.shape.edges[0]).toMatchObject({
        fromX: 0,
        fromY: 0,
        controlX,
        controlY,
        toX: controlX + anchorX,
        toY: controlY + anchorY,
      });
      expect(cursor.offset).toBe(bytes.length);
      expect(cursor.bitOffset).toBe(0);
      expect(sink.codes()).toEqual([]);
    }
  });

  it('T-MOD-102 distinguishes general, horizontal, vertical and zero-length straight records', () => {
    const writer = shapeStart({ xMin: 0, xMax: 50, yMin: -50, yMax: 0 });
    // General line, then general zero-length, then vertical and horizontal flag forms.
    writeStraight(writer, 8, 40, -20);
    writer.bits(1, 1).bits(1, 1).bits(6, 4).bits(1, 1); // straight, NumBits, GeneralLineFlag
    signed(writer, 0, 8);
    writer.bits(0, 8);
    writer.bits(1, 1).bits(1, 1).bits(6, 4).bits(0, 1).bits(1, 1); // vertical
    signed(writer, -30, 8);
    writer.bits(1, 1).bits(1, 1).bits(6, 4).bits(0, 1).bits(0, 1); // horizontal
    signed(writer, 10, 8);
    const { bytes, cursor, result, sink } = decode(writer);
    expect(result.shape.edges).toEqual([
      { fromX: 0, fromY: 0, toX: 40, toY: -20 },
      { fromX: 40, fromY: -20, toX: 40, toY: -20 },
      { fromX: 40, fromY: -20, toX: 40, toY: -50 },
      { fromX: 40, fromY: -50, toX: 50, toY: -50 },
    ]);
    expect(cursor.offset).toBe(bytes.length);
    expect(sink.codes()).toEqual([]);
  });
});

describe('Appendix A shape record bit walk', () => {
  it('T-MOD-123 reads counts, style flags, MoveTo, four 13-bit edges, End, and padding without byte-aligning records', () => {
    const file = openSwf(new Uint8Array(readFileSync(APPENDIX_FIXTURE)));
    const ref = file.tagIndex.tags.find((tag) => tag.code === Tag.DefineShape);
    if (!ref) throw new Error('appendix-a DefineShape tag is missing');
    const cursor = new Cursor(file.body, ref.offset, ref.offset + ref.length, {
      version: file.version,
      tagCode: ref.code,
    });

    expect(cursor.u16()).toBe(1);
    expect(readRect(cursor)).toEqual({ xMin: 2010, xMax: 4910, yMin: 1670, yMax: 4010 });
    expect(cursor.u8()).toBe(0); // FillStyleCount
    expect(cursor.u8()).toBe(1); // LineStyleCount
    expect(cursor.u16()).toBe(20);
    expect(Array.from(cursor.takeBytes(3))).toEqual([0, 0, 0]);
    expect(cursor.ub(4)).toBe(0); // NumFillBits
    const numLineBits = cursor.ub(4);
    expect(numLineBits).toBe(1);

    expect(cursor.ub(1)).toBe(0); // StyleChangeRecord
    expect([cursor.ub(1), cursor.ub(1), cursor.ub(1), cursor.ub(1), cursor.ub(1)]).toEqual([0, 1, 0, 0, 1]);
    const moveBits = cursor.ub(5);
    expect(moveBits).toBe(14);
    expect([cursor.sb(moveBits), cursor.sb(moveBits)]).toEqual([4900, 1680]);
    expect(cursor.ub(numLineBits)).toBe(1);

    const deltas: [number, number][] = [];
    const bitOffsets: number[] = [];
    for (let index = 0; index < 4; index += 1) {
      expect(cursor.ub(1)).toBe(1); // EdgeRecord
      expect(cursor.ub(1)).toBe(1); // StraightEdgeRecord
      const width = cursor.ub(4) + 2;
      expect(width).toBe(13);
      const general = cursor.ub(1) === 1;
      if (general) {
        deltas.push([cursor.sb(width), cursor.sb(width)]);
      } else {
        const vertical = cursor.ub(1) === 1;
        const delta = cursor.sb(width);
        deltas.push(vertical ? [0, delta] : [delta, 0]);
      }
      bitOffsets.push(cursor.bitOffset);
    }
    expect(deltas).toEqual([
      [0, 2320],
      [-2880, 0],
      [0, -2320],
      [2880, 0],
    ]);
    expect(bitOffsets).toEqual([5, 2, 7, 4]); // records are contiguous; no alignment between edges
    expect(cursor.ub(1)).toBe(0); // EndShapeRecord
    expect(cursor.ub(5)).toBe(0);
    expect(cursor.bitOffset).toBe(2);
    expect(cursor.ub(6)).toBe(0); // six zero padding bits only after EndShapeRecord
    expect(cursor.bitOffset).toBe(0);
    expect(cursor.offset).toBe(ref.offset + ref.length);
  });
});

describe('LINESTYLE2 byte layout', () => {
  it('T-MOD-112 reads the unsigned miter before the RGBA colour/fill payload', () => {
    const writer = new ByteWriter();
    writer.u16(18);
    writeRect(writer, { xMin: 0, xMax: 50, yMin: 0, yMax: 0 });
    writeRect(writer, { xMin: 0, xMax: 50, yMin: 0, yMax: 0 });
    writer.u8(0); // Shape4 flags
    writer.u8(0); // no fills
    writer.u8(1).u16(120); // one LineStyle2, 120 twips wide
    writer.bits(1, 2).bits(2, 2).bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 1);
    writer.bits(0, 5).bits(1, 1).bits(2, 2); // reserved, NoClose, square end cap
    writer.u16(0x0380); // unsigned 3.5 in 8.8
    writer.u8(10).u8(20).u8(30).u8(255);
    writer.bits(0, 4).bits(1, 4); // one line-index bit
    writer.bits(0, 1).bits(0, 1).bits(1, 1).bits(0, 1).bits(0, 1).bits(0, 1).bits(1, 1);
    writeStraight(writer, 8, 50, 0);
    const { result, sink } = decode(writer, Tag.DefineShape4);
    expect(result.shape.styles.lines[1]).toMatchObject({
      width: 120,
      color: { r: 10, g: 20, b: 30, a: 255 },
      caps: { start: 1, end: 2 },
      join: 2,
      miterLimit: 3.5,
      noClose: true,
    });
    expect(result.shape.strokes).toEqual([{ styleId: 1, edgeRefs: [0], closed: false }]);
    expect(sink.codes()).toEqual([]);
  });
});

describe('StateNewStyles', () => {
  it('T-SWF-006 / T-MOD-106 / T-MOD-114 reads record indices before arrays and rebases new bitmap styles', () => {
    const writer = shapeStart(
      { xMin: 0, xMax: 20, yMin: 0, yMax: 20 },
      (w) => w.u8(1).u8(0).u8(255).u8(0).u8(0), // old style 1 = opaque red
      (w) => w.u8(0),
    );
    // Initial widths are 0 in shapeStart; declare width 1 for the old solid fill.
    // (Rewrite the last byte's high nibble by rebuilding this small prefix below.)
    const bytesBeforeRecords = writer.toUint8Array();
    const prefix = new ByteWriter();
    prefix.bytes(bytesBeforeRecords.subarray(0, bytesBeforeRecords.length - 1));
    prefix.bits(1, 4).bits(0, 4);
    const records = prefix;

    // Select old fill 1 and draw a closed two-edge run.
    records.bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 1).bits(1, 1).bits(0, 1).bits(1, 1);
    writeStraight(records, 8, 20, 0);
    writeStraight(records, 8, -20, 0);

    // StateNewStyles + FillStyle0: its UI1 value is still encoded using the old width,
    // before the new fill/line arrays and new widths.
    records.bits(0, 1).bits(1, 1).bits(0, 1).bits(0, 1).bits(1, 1).bits(0, 1).bits(1, 1);
    // New style 1 is a repeating bitmap fill (id 9) with an identity matrix.
    records.u8(1).u8(0x40).u16(9);
    records.bits(0, 1).bits(0, 1).bits(0, 5).align();
    records.u8(0); // no new line styles
    records.bits(1, 4).bits(0, 4); // new NumFillBits/NumLineBits

    // New local fill index 1 rebases to global VectorShape style index 2; draw a second edge.
    records.bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 1).bits(1, 1).bits(0, 1).bits(1, 1);
    writeStraight(records, 8, 0, 20);
    writeStraight(records, 8, 0, -20);

    const { bytes, cursor, result, sink } = decode(records);
    expect(cursor.offset).toBe(bytes.length);
    expect(cursor.bitOffset).toBe(0);
    expect(result.shape.styles.fills).toHaveLength(3);
    expect(result.shape.styles.fills[1]).toMatchObject({ kind: 'solid', color: { r: 255, g: 0, b: 0 } });
    expect(result.shape.styles.fills[2]).toMatchObject({ kind: 'bitmap', bitmapId: 9, repeat: true });
    expect(result.shape.paths.map((path) => path.styleId)).toEqual([1, 2]);
    expect(result.shape.edges).toHaveLength(4);
    expect(result.shape.paths.map((path) => path.edgeRefs)).toEqual([
      [0, 1],
      [2, 3],
    ]);
    expect(result.shape.paths.every((path) => path.closed && !path.implicitClose)).toBe(true);
    expect(sink.codes()).toEqual([]);
  });
});
