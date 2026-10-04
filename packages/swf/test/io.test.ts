/**
 * Numeric IO conformance: `T-SWF-004`, `T-SWF-013`, `T-SWF-015`, `T-SWF-016` (`IMPL-010` §10).
 */

import { describe, expect, it } from 'vitest';

import { Cursor, SwfReadError, decomposeMatrix, readMatrix } from '@swf-forge/swf';
import { ByteWriter } from '@swf-forge/swf/test-support';

function rawBits(value: number, width: number): Uint8Array {
  return new ByteWriter().bits(value, width).toUint8Array();
}

function quarterTurnMatrix(): Uint8Array {
  const writer = new ByteWriter();
  writer.bits(1, 1).bits(18, 5).bits(0, 18).bits(0, 18); // scale (zero)
  writer
    .bits(1, 1)
    .bits(18, 5)
    .bits(65536, 18)
    .bits(2 ** 18 - 65536, 18); // RotateSkew0/1 = +1/-1
  writer.bits(0, 5).bits(0, 0).bits(0, 0).align(); // no translation
  return writer.toUint8Array();
}

describe('numeric bit IO', () => {
  it('T-SWF-004 sign-extends the three sb(32) boundary vectors exactly', () => {
    expect(new Cursor(Uint8Array.from([0x7f, 0xff, 0xff, 0xff])).sb(32)).toBe(0x7fffffff);
    expect(new Cursor(Uint8Array.from([0x80, 0x00, 0x00, 0x00])).sb(32)).toBe(-0x80000000);
    expect(new Cursor(Uint8Array.from([0xff, 0xff, 0xff, 0xff])).sb(32)).toBe(-1);
  });

  it('T-SWF-004 interprets FB[19] value 0x30000 as exactly 3.0', () => {
    expect(new Cursor(rawBits(0x30000, 19)).fb(19)).toBe(3);
  });

  it('T-SWF-013 decodes +90 degrees as right-to-down in SWF y-down coordinates', () => {
    const cursor = new Cursor(quarterTurnMatrix());
    const matrix = readMatrix(cursor);
    const decomposition = decomposeMatrix(matrix);
    expect(matrix).toMatchObject({ a: 0, b: -1, c: 1, d: 0, tx: 0, ty: 0 });
    expect(decomposition.rotationDeg).toBe(90);
    expect({ x: matrix.a, y: matrix.c }).toEqual({ x: 0, y: 1 });
    expect(cursor.isByteAligned).toBe(true);
  });

  it('T-SWF-015 returns zero without consuming bytes for an invalid soft bit width', () => {
    const cursor = new Cursor(Uint8Array.from([0xaa, 0xbb]));
    expect(cursor.ub(33)).toBe(0);
    expect(cursor.sb(-1)).toBe(0);
    expect(cursor.offset).toBe(0);
    expect(cursor.sink.codes()).toEqual(['SF0014']);
  });

  it('T-SWF-015 advances soft out-of-bounds reads to limit and clamps sub-cursors with SF0013', () => {
    const cursor = new Cursor(Uint8Array.from([0xaa, 0xbb]));
    const sub = cursor.subCursor(5);
    expect(sub.limit).toBe(2);
    expect(cursor.offset).toBe(0);
    expect(cursor.sink.codes()).toContain('SF0013');

    const short = new Cursor(Uint8Array.from([0xaa]));
    expect(short.ub(9)).toBe(0);
    expect(short.offset).toBe(short.limit);
    expect(short.remaining).toBe(0);
    expect(short.sink.codes()).toContain('SF0013');
  });

  it('T-SWF-016 throws in strict mode before reading an invalid width', () => {
    const cursor = new Cursor(Uint8Array.from([0xaa, 0xbb]), 0, 2, { mode: 'strict' });
    expect(() => cursor.ub(33)).toThrow(SwfReadError);
    expect(cursor.offset).toBe(0);
  });
});
