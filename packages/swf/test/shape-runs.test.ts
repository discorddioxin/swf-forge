/**
 * Style-run chaining — `IMPL-060-R030` (fill styles accumulate on both sides of the edge sequence)
 * and `IMPL-060-R031` (runs are closed explicitly; an unclosed fill run is reported as `SF0186`).
 *
 * Regression: the first decoder closed only the `FillStyle0` run and flushed *before* reading the
 * final `End` record, so the last run of every shape was dropped and `FillStyle1` runs were never
 * built at all. The appendix fixture — one line style, no fills — decoded to four edges and zero
 * runs because of it.
 */

import { describe, expect, it } from 'vitest';

import { Cursor, DiagnosticSink, decodeDefineShapeVersion, Tag, type VectorShape } from '@swf-forge/swf';

/** Bit-level writer for `SHAPEWITHSTYLE` bodies (MSB-first inside each byte, like the format). */
class Bits {
  readonly #bits: number[] = [];

  ub(value: number, bits: number): this {
    for (let i = bits - 1; i >= 0; i -= 1) this.#bits.push((value >> i) & 1);
    return this;
  }

  sb(value: number, bits: number): this {
    return this.ub(value < 0 ? value + 2 ** bits : value, bits);
  }

  bytes(): number[] {
    const out: number[] = [];
    for (let i = 0; i < this.#bits.length; i += 8) {
      let byte = 0;
      for (let k = 0; k < 8; k += 1) byte = (byte << 1) | (this.#bits[i + k] ?? 0);
      out.push(byte);
    }
    return out;
  }
}

interface ShapeOptions {
  /** Styles the style-change record selects (0 = none). */
  readonly fill0?: number;
  readonly fill1?: number;
  readonly line?: number;
  /** Number of 100-twip edges to emit before the end record (the rectangle needs four). */
  readonly edges?: number;
}

/** A 100×100 twip square (or an open run of `edges` sides), one solid fill and one 20-twip stroke. */
function shapeBytes(options: ShapeOptions = {}): Uint8Array {
  const { fill0 = 0, fill1 = 0, line = 0, edges = 4 } = options;
  const bytes: number[] = [1, 0]; // ShapeId = 1 (UI16)

  // RECT ShapeBounds = (0, 0, 100, 100). Signed fields need Nbits 8: SB[7] tops out at 63.
  bytes.push(...new Bits().ub(8, 5).sb(0, 8).sb(100, 8).sb(0, 8).sb(100, 8).bytes());

  // FILLSTYLEARRAY / LINESTYLEARRAY: only declare what the records reference, so `SF0189` stays out.
  const wantsFill = fill0 !== 0 || fill1 !== 0;
  if (wantsFill)
    bytes.push(1, 0x00, 255, 0, 0); // one solid red fill
  else bytes.push(0);
  if (line !== 0)
    bytes.push(1, 20, 0, 0, 0, 0); // one 20-twip black stroke
  else bytes.push(0);

  const bits = new Bits();
  bits.ub(1, 4); // NumFillBits
  bits.ub(1, 4); // NumLineBits

  // StyleChange with MoveTo (0, 0) — this is where every run starts.
  bits.ub(0, 1); // TypeFlag: non-edge
  bits.ub(0, 1); // StateNewStyles
  bits.ub(line ? 1 : 0, 1);
  bits.ub(fill1 ? 1 : 0, 1);
  bits.ub(fill0 ? 1 : 0, 1);
  bits.ub(1, 1); // StateMoveTo
  bits.ub(5, 5); // MoveBits
  bits.sb(0, 5).sb(0, 5); // MoveDeltaX/Y
  if (fill0) bits.ub(fill0, 1);
  if (fill1) bits.ub(fill1, 1);
  if (line) bits.ub(line, 1);

  const sides: readonly (readonly [number, number])[] = [
    [100, 0],
    [0, 100],
    [-100, 0],
    [0, -100],
  ];
  for (let i = 0; i < edges; i += 1) {
    const side = sides[i % sides.length] ?? [0, 0];
    const [dx, dy] = side;
    bits.ub(1, 1); // TypeFlag: edge
    bits.ub(1, 1); // StraightFlag
    bits.ub(6, 4); // NumBits − 2: the 100-twip deltas need 8 bits signed
    bits.ub(0, 1); // GeneralLineFlag: axis-aligned
    if (dy !== 0) {
      bits.ub(1, 1); // VertLineFlag
      bits.sb(dy, 8);
    } else {
      bits.ub(0, 1);
      bits.sb(dx, 8);
    }
  }

  bits.ub(0, 6); // EndOfShape
  bytes.push(...bits.bytes());
  return Uint8Array.from(bytes);
}

function decode(options: ShapeOptions = {}): { shape: VectorShape; sink: DiagnosticSink } {
  const body = shapeBytes(options);
  const sink = new DiagnosticSink();
  // DefineShape2: the style arrays use RGB, which is what `shapeBytes` writes.
  const cursor = new Cursor(body, 0, body.length, { sink, version: 2, tagCode: Tag.DefineShape2 });
  const result = decodeDefineShapeVersion(Tag.DefineShape2, cursor);
  return { shape: result.shape, sink };
}

describe('style runs', () => {
  it('closes the final run and emits both a fill and a stroke path (IMPL-060-R030)', () => {
    const { shape } = decode({ fill0: 1, line: 1 });
    expect(shape.edges).toHaveLength(4);
    expect(shape.paths).toEqual([{ styleId: 1, edgeRefs: [0, 1, 2, 3], closed: true, implicitClose: false }]);
    expect(shape.strokes).toEqual([{ styleId: 1, edgeRefs: [0, 1, 2, 3], closed: true }]);
    expect(shape.fillRule).toBe('evenOdd');
  });

  it('builds a FillStyle1 run: the same edges, one style on the other side', () => {
    const { shape } = decode({ fill1: 1 });
    expect(shape.paths).toEqual([{ styleId: 1, edgeRefs: [0, 1, 2, 3], closed: true, implicitClose: false }]);
    expect(shape.strokes).toEqual([]);
  });

  it('keeps a fill-less shape: no paths, but the stroke run survives', () => {
    const { shape, sink } = decode({ line: 1 });
    expect(shape.paths).toEqual([]);
    expect(shape.strokes).toEqual([{ styleId: 1, edgeRefs: [0, 1, 2, 3], closed: true }]);
    expect(sink.list()).toEqual([]);
  });

  it('reports an unclosed fill run as SF0186 and records the implicit close (IMPL-060-R031)', () => {
    const { shape, sink } = decode({ fill0: 1, edges: 3 });
    expect(shape.paths).toEqual([{ styleId: 1, edgeRefs: [0, 1, 2], closed: false, implicitClose: true }]);
    expect(sink.list().map((d) => [d.code, d.severity])).toEqual([['SF0186', 'warning']]);
  });

  it('leaves an unclosed stroke run unflagged — caps render the difference', () => {
    const { shape, sink } = decode({ line: 1, edges: 3 });
    expect(shape.strokes).toEqual([{ styleId: 1, edgeRefs: [0, 1, 2], closed: false }]);
    expect(sink.list()).toEqual([]);
  });
});
