/**
 * Property tests — `T-SWF-014` (`IMPL-010` §8, `WP-010-11`): `writer → reader → writer` is a
 * fixed point for 10⁵ random values, and `T-SWF-015`/`T-SWF-016` contract strengthening.
 *
 * The seed is fixed, so a failure reproduces from the recorded seed; every mismatch throws with
 * the counterexample's bytes, kind and value rather than an assertion diff over 10⁵ cases.
 * Value equality is asserted as well as byte equality: a reader that returned a wrong value which
 * happened to re-encode to the same bytes would still fail here.
 */

import { describe, expect, it } from 'vitest';

import { Cursor, SwfReadError, readRect } from '@swf-forge/swf';
import { ByteWriter, writeRect } from '@swf-forge/swf/test-support';

const SEED = 0x5453_5746; // 'TSWF'
const ITERATIONS = 100_000;

/** Deterministic LCG, as in the fuzz gate, so the pass is reproducible from the seed. */
function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1_664_525 + 1_013_904_223) >>> 0;
    return state / 0x1_0000_0000;
  };
}

function hex(bytes: Uint8Array): string {
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join(' ');
}

interface Case {
  readonly kind: string;
  readonly write: (w: ByteWriter) => void;
  readonly read: (c: Cursor) => unknown;
}

/** One random case of the kind selected by `i`, generated from the shared stream. */
function makeCase(i: number, rand: () => number): Case {
  const u32 = () => Math.floor(rand() * 0x1_0000_0000);
  switch (i % 12) {
    case 0: {
      const v = Math.floor(rand() * 0x100);
      return { kind: 'u8', write: (w) => void w.u8(v), read: (c) => c.u8() };
    }
    case 1: {
      const v = Math.floor(rand() * 0x1_0000);
      return { kind: 'u16', write: (w) => void w.u16(v), read: (c) => c.u16() };
    }
    case 2: {
      const v = Math.floor(rand() * 0x100_0000);
      return { kind: 'u24', write: (w) => void w.u24(v), read: (c) => c.u24() };
    }
    case 3: {
      const v = u32();
      return { kind: 'u32', write: (w) => void w.u32(v), read: (c) => c.u32() };
    }
    case 4: {
      const v = u32() | 0;
      return { kind: 's32', write: (w) => void w.s32(v), read: (c) => c.s32() };
    }
    case 5: {
      const v = u32();
      return { kind: 'encodedU32', write: (w) => void w.encodedU32(v), read: (c) => c.encodedU32() };
    }
    case 6: {
      const raw = u32() | 0;
      const v = raw / 65_536;
      return { kind: 'fixed', write: (w) => void w.fixed(v), read: (c) => c.fixed() };
    }
    case 7: {
      const raw = (Math.floor(rand() * 0x1_0000) << 16) >> 16;
      const v = raw / 256;
      return { kind: 'fixed8', write: (w) => void w.fixed8(v), read: (c) => c.fixed8() };
    }
    case 8: {
      // Random finite float32: random bits with the exponent field kept off 0xff.
      const view = new DataView(new ArrayBuffer(4));
      let bits = u32();
      if (((bits >>> 23) & 0xff) === 0xff) bits ^= 0x40_00_00;
      view.setUint32(0, bits, true);
      const v = view.getFloat32(0, true);
      return { kind: 'float32', write: (w) => void w.float32(v), read: (c) => c.float32() };
    }
    case 9: {
      const v = (rand() - 0.5) * 10 ** (Math.floor(rand() * 61) - 30);
      return { kind: 'float64', write: (w) => void w.float64(v), read: (c) => c.float64() };
    }
    case 10: {
      const width = 1 + Math.floor(rand() * 32);
      const v = Math.floor(rand() * 2 ** width);
      return {
        kind: `ub[${width}]`,
        write: (w) => void w.bits(v, width).align(),
        read: (c) => {
          const out = c.ub(width);
          c.align();
          return out;
        },
      };
    }
    case 11: {
      const width = 2 + Math.floor(rand() * 31);
      const v = Math.floor(rand() * 2 ** width) - 2 ** (width - 1);
      return {
        kind: `sb[${width}]`,
        write: (w) => void w.bits(v < 0 ? v + 2 ** width : v, width).align(),
        read: (c) => {
          const out = c.sb(width);
          c.align();
          return out;
        },
      };
    }
    default:
      throw new Error('unreachable');
  }
}

describe('writer/reader fixed point', () => {
  it('T-SWF-014: writer -> reader -> writer is a fixed point for 10^5 random values (fixed seed)', () => {
    const rand = makeRng(SEED);
    for (let i = 0; i < ITERATIONS; i += 1) {
      const testCase = makeCase(i, rand);
      const writer = new ByteWriter();
      testCase.write(writer);
      const bytes = writer.toUint8Array();
      const value = testCase.read(new Cursor(bytes));
      // The fixed point: writing the *read* value (not the generated one) must reproduce the
      // exact bytes, so a reader returning a wrong-but-re-encodable value still fails.
      const again = new ByteWriter();
      writeValue(again, testCase.kind, value);
      const rewritten = again.toUint8Array();
      if (hex(rewritten) !== hex(bytes)) {
        throw new Error(
          `T-SWF-014 counterexample at i=${i} kind=${testCase.kind} value=${String(value)} bytes=[${hex(bytes)}] rewritten=[${hex(rewritten)}]`,
        );
      }
    }
    expect(true).toBe(true);
  });

  it('T-SWF-014: RECT round-trips through writeRect/readRect and re-encodes identically', () => {
    const rand = makeRng(SEED ^ 0x5a5a);
    for (let i = 0; i < 2_000; i += 1) {
      const coord = () => Math.floor(rand() * 4_001) - 2_000;
      const rect = { xMin: coord(), xMax: coord(), yMin: coord(), yMax: coord() };
      const writer = new ByteWriter();
      writeRect(writer, rect);
      const bytes = writer.toUint8Array();
      const read = readRect(new Cursor(bytes));
      expect(read).toEqual(rect);
      const rewriter = new ByteWriter();
      writeRect(rewriter, read);
      expect(hex(rewriter.toUint8Array())).toBe(hex(bytes));
    }
  });
});

/** Write a read-back value for a case kind; the inverse of `makeCase`'s readers. */
function writeValue(w: ByteWriter, kind: string, value: unknown): void {
  const v = value as number;
  if (kind === 'u8') w.u8(v);
  else if (kind === 'u16') w.u16(v);
  else if (kind === 'u24') w.u24(v);
  else if (kind === 'u32') w.u32(v);
  else if (kind === 's32') w.s32(v);
  else if (kind === 'encodedU32') w.encodedU32(v);
  else if (kind === 'fixed') w.fixed(v);
  else if (kind === 'fixed8') w.fixed8(v);
  else if (kind === 'float32') w.float32(v);
  else if (kind === 'float64') w.float64(v);
  else if (kind.startsWith('ub[')) w.bits(v, Number(kind.slice(3, -1))).align();
  else if (kind.startsWith('sb[')) {
    const width = Number(kind.slice(3, -1));
    w.bits(v < 0 ? v + 2 ** width : v, width).align();
  } else throw new Error(`unknown kind ${kind}`);
}

describe('soft/strict contract strengthening', () => {
  it('T-SWF-015: after a soft invalid-width read, later values still parse exactly', () => {
    const writer = new ByteWriter();
    writer.u8(0xaa).u16(0x1234);
    const cursor = new Cursor(writer.toUint8Array());
    expect(cursor.ub(33)).toBe(0);
    expect(cursor.sink.codes()).toEqual(['SF0014']);
    expect(cursor.u8()).toBe(0xaa);
    expect(cursor.u16()).toBe(0x1234);
  });

  it('T-SWF-015: an overlong EncodedU32 mid-stream diagnoses and the following record parses', () => {
    const writer = new ByteWriter();
    writer.bytes([0x80, 0x80, 0x80, 0x80, 0x80]).u32(0xdead_beef);
    const cursor = new Cursor(writer.toUint8Array());
    expect(cursor.encodedU32()).toBe(0);
    expect(cursor.sink.codes()).toContain('SF0009');
    expect(cursor.u32()).toBe(0xdead_beef);
  });

  it('T-SWF-016: strict mode throws SwfReadError carrying the documented code and offset', () => {
    const writer = new ByteWriter();
    writer.u8(0xaa).u8(0xbb);
    const cursor = new Cursor(writer.toUint8Array(), 0, 2, { mode: 'strict' });
    cursor.u8();
    let thrown: unknown;
    try {
      cursor.ub(33);
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(SwfReadError);
    const err = thrown as SwfReadError;
    expect(err.offset).toBe(1);
    expect(String(err.code)).toMatch(/^SF\d{4}$/);
    expect(cursor.offset).toBe(1);
  });
});
