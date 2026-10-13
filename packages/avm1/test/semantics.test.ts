/**
 * Version-sensitive and AS2-era semantics at the decode level — `IMPL-050` §5
 * (`T-AVM1-FE-019` GotoFrame2 flags, `T-AVM1-FE-021` property ids, `T-AVM1-FE-022` SWF 4 vs SWF 5
 * result types, `T-AVM1-FE-023` Enumerate, `T-AVM1-FE-026` Extends/ImplementsOp/CastOp stack effects).
 */

import { describe, expect, it } from 'vitest';

import { analyze, block, pair, push } from './harness.js';
import { foldBin, foldUn, PROPERTY_NAMES, isDefinedPropertyId, propertyName } from '../src/index.js';
import type { Avm1Value, Op } from '../src/index.js';

const num = (value: number): Avm1Value => ({ type: 'number', value });

/** Push int — type 7, 4-byte little-endian payload. */
const pushInt = (v: number): number[] => [0x96, 5, 0, 7, v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];
/** Push "" — type 0, NUL-terminated. */
const pushEmptyString = [0x96, 2, 0, 0, 0];

describe('T-AVM1-FE-019 GotoFrame2 play flag + scene bias resolution', () => {
  /**
   * GotoFrame2 (0x9f) pops the frame from the stack; the payload carries only the flag byte and,
   * when SceneBiasFlag (0x02) is set, a UI16 scene bias (R039).
   */
  const gotoFrame2 = (flags: number, sceneBias: number | null): number[] =>
    sceneBias === null ? [0x9f, 1, 0, flags] : [0x9f, 3, 0, flags, sceneBias & 0xff, (sceneBias >> 8) & 0xff];

  it('play flag and scene bias decode from the payload', () => {
    const bytes = block(pushInt(7), gotoFrame2(0x03, 1), [0x00]);
    const { block: b } = analyze(bytes, { version: 8 });
    const op = b.ir.blocks[0]?.ops.find((o) => o.kind === 'timeline');
    expect(op).toBeDefined();
    if (op && op.kind === 'timeline' && op.timeline.op === 'goto' && op.timeline.target.kind === 'frame2') {
      expect(op.timeline.target.play).toBe(true);
      expect(op.timeline.target.sceneBias).toBe(1);
    } else {
      expect(op).toBeUndefined();
    }
  });

  it('no flags: no play, no scene bias', () => {
    const bytes = block(pushInt(3), gotoFrame2(0x00, null), [0x00]);
    const { block: b } = analyze(bytes);
    const op = b.ir.blocks[0]?.ops.find((o) => o.kind === 'timeline');
    expect(op).toBeDefined();
    if (op && op.kind === 'timeline' && op.timeline.op === 'goto' && op.timeline.target.kind === 'frame2') {
      expect(op.timeline.target.play).toBe(false);
      expect(op.timeline.target.sceneBias).toBeNull();
    } else {
      expect(op).toBeUndefined();
    }
  });
});

describe('T-AVM1-FE-021 property ids 0-21 and the >=22 policy', () => {
  it('all 22 defined ids map to their names; 0 and 21 are the endpoints', () => {
    expect(PROPERTY_NAMES.length).toBe(22);
    expect(propertyName(0)).toBe('_x');
    expect(propertyName(21)).toBe('_ymouse');
    for (let id = 0; id <= 21; id += 1) {
      expect(isDefinedPropertyId(id)).toBe(true);
    }
    expect(isDefinedPropertyId(22)).toBe(false);
  });

  it('a GetProperty with an undefined id (>= 22) reports SF0417; defined ids do not', () => {
    // GetProperty (0x22) has no payload: it pops the id (top), then the target (R038).
    const { diag: diagBad } = analyze(block(pushEmptyString, pushInt(22), [0x22], [0x00]));
    expect(diagBad.has('SF0417')).toBe(true);

    const { diag: diagGood, block: b } = analyze(block(pushEmptyString, pushInt(0), [0x22], [0x00]));
    expect(diagGood.has('SF0417')).toBe(false);
    const op = b.ir.blocks[0]?.ops.find((o) => o.kind === 'getProperty');
    expect(op).toBeDefined();
  });
});

describe('T-AVM1-FE-022 SWF 4 vs SWF 5 result types', () => {
  it('Equals/Less/And/Or: numbers in SWF 4, booleans in SWF 5+', () => {
    for (const code of [0x0e, 0x0f, 0x10, 0x11]) {
      const v4 = foldBin(code, num(1), num(1), 4);
      const v5 = foldBin(code, num(1), num(1), 5);
      expect(v4?.type).toBe('number');
      expect(v5?.type).toBe('boolean');
    }
  });

  it('Not: numeric in SWF 4, boolean in SWF 5+', () => {
    expect(foldUn(0x12, num(0), 4)).toMatchObject({ type: 'number', value: 1 });
    expect(foldUn(0x12, num(0), 5)).toMatchObject({ type: 'boolean', value: true });
    expect(foldUn(0x12, num(1), 4)).toMatchObject({ type: 'number', value: 0 });
  });

  it('Divide by zero: #ERROR# string in SWF 4, Infinity in SWF 5+', () => {
    const v4 = foldBin(0x0d, num(1), num(0), 4);
    const v5 = foldBin(0x0d, num(1), num(0), 5);
    expect(v4).toMatchObject({ type: 'string', value: '#ERROR#' });
    expect(v5?.type).toBe('number');
    expect(Number.isFinite((v5 as { value: number }).value)).toBe(false);
  });
});

describe('T-AVM1-FE-031 Add / Add2 / StringAdd literal-fold coercion matrix', () => {
  const literals: Array<{ readonly name: string; readonly value: Avm1Value }> = [
    { name: 'empty string', value: { type: 'string', value: '' } },
    { name: 'numeric string', value: { type: 'string', value: '2.5' } },
    { name: 'non-numeric string', value: { type: 'string', value: 'nope' } },
    { name: 'number', value: num(2.5) },
    { name: 'integer', value: { type: 'integer', value: 2, bits: 32 } },
    { name: 'true', value: { type: 'boolean', value: true } },
    { name: 'false', value: { type: 'boolean', value: false } },
    { name: 'null', value: { type: 'null' } },
    { name: 'undefined', value: { type: 'undefined' } },
  ];

  const toNumber = (value: Avm1Value): number | null => {
    switch (value.type) {
      case 'number':
      case 'integer':
        return value.value;
      case 'boolean':
        return value.value ? 1 : 0;
      case 'null':
        return 0;
      case 'undefined':
        return Number.NaN;
      case 'string':
        return value.value.trim() === '' ? 0 : Number(value.value.trim());
      default:
        return null;
    }
  };

  // Mirrors the contract's deliberately conservative constant-fold boundary: string conversions
  // of number literals stay dynamic because their AVM1 15-digit formatting belongs to runtime.
  const toFoldableString = (value: Avm1Value): string | null => {
    switch (value.type) {
      case 'string':
        return value.value;
      case 'boolean':
        return value.value ? 'true' : 'false';
      case 'null':
        return 'null';
      case 'undefined':
        return 'undefined';
      default:
        return null;
    }
  };

  const expected = (opcode: number, lhs: Avm1Value, rhs: Avm1Value): Avm1Value | null => {
    if (opcode === 0x0a && lhs.type === 'string') {
      const rhsString = toFoldableString(rhs);
      return rhsString === null ? null : { type: 'string', value: lhs.value + rhsString };
    }
    if ((opcode === 0x47 && (lhs.type === 'string' || rhs.type === 'string')) || opcode === 0x21) {
      const lhsString = toFoldableString(lhs);
      const rhsString = toFoldableString(rhs);
      return lhsString === null || rhsString === null ? null : { type: 'string', value: lhsString + rhsString };
    }
    const lhsNumber = toNumber(lhs);
    const rhsNumber = toNumber(rhs);
    return lhsNumber === null || rhsNumber === null ? null : { type: 'number', value: lhsNumber + rhsNumber };
  };

  for (const [opcode, name] of [
    [0x0a, 'ActionAdd'],
    [0x47, 'ActionAdd2'],
    [0x21, 'StringAdd'],
  ] as const) {
    it(`${name}: all 81 pairs across nine known literal kinds`, () => {
      for (const lhs of literals) {
        for (const rhs of literals) {
          expect(foldBin(opcode, lhs.value, rhs.value, 8), `${name}: ${lhs.name} + ${rhs.name}`).toEqual(
            expected(opcode, lhs.value, rhs.value),
          );
        }
      }
    });
  }
});

describe('T-AVM1-FE-030 DBCS string-length folding boundary', () => {
  const dbcsPush = push(pair(0, [0x82, 0xa0, 0])); // SWF 5 Shift-JIS: U+3042 (あ), then NUL.

  const analyzeLength = (code: 0x14 | 0x31) => {
    const { block: analyzed } = analyze(block(dbcsPush, [code]), { version: 5, legacyEncoding: 'shift-jis' });
    const op = analyzed.ir.blocks
      .flatMap((basic) => basic.ops)
      .find((candidate) => candidate.kind === 'unop' && candidate.code === code);
    if (op?.kind !== 'unop') throw new Error(`expected unary length action 0x${code.toString(16)}`);
    return op;
  };

  it('decodes the raw Shift-JIS fixture and folds only the spec-backed DBCS character count', () => {
    const stringLength = analyzeLength(0x14);
    expect(stringLength.a).toEqual({ kind: 'lit', value: { type: 'string', value: 'あ' } });
    // Adobe specifies MBStringLength's DBCS character count, but does not state ActionStringLength's
    // unit explicitly; keep the latter dynamic rather than asserting an unsupported byte result.
    expect(stringLength.result.kind).toBe('temp');

    const mbStringLength = analyzeLength(0x31);
    expect(mbStringLength.a).toEqual({ kind: 'lit', value: { type: 'string', value: 'あ' } });
    expect(mbStringLength.result).toEqual({ kind: 'lit', value: { type: 'number', value: 1 } });
  });
});

describe('T-AVM1-FE-023 Enumerate / Enumerate2', () => {
  it('decodes with one popped operand and an unknown-depth marker (order is undefined)', () => {
    const { block: b } = analyze(block(pushEmptyString, [0x46], [0x00]));
    const op = b.ir.blocks[0]?.ops.find((o) => o.kind === 'enumerate') as
      Extract<Op, { kind: 'enumerate' }> | undefined;
    expect(op).toBeDefined();
    expect(op?.code).toBe(0x46);
    // Enumerate pushes null + k names with k unknown: the block's exit depth is unverified (-1).
    expect(b.ir.blocks[0]?.stackOut).toBe(-1);
  });

  it('Enumerate2 (0x55) decodes the same way', () => {
    const { block: b } = analyze(block(pushEmptyString, [0x55], [0x00]));
    const op = b.ir.blocks[0]?.ops.find((o) => o.kind === 'enumerate');
    expect(op).toBeDefined();
    if (op && op.kind === 'enumerate') expect(op.code).toBe(0x55);
  });
});

describe('T-AVM1-FE-026 Extends / ImplementsOp / CastOp stack effects', () => {
  it('Extends pops superclass then subclass and pushes nothing', () => {
    const { block: b } = analyze(block(pushInt(1), pushInt(1), [0x69], [0x00]));
    const op = b.ir.blocks[0]?.ops.find((o) => o.kind === 'extends');
    expect(op).toBeDefined();
    expect(b.ir.blocks[0]?.stackIn).toBe(0);
    expect(b.ir.blocks[0]?.stackOut).toBe(0);
  });

  it('ImplementsOp pops constructor, count, then interfaces; no result', () => {
    // Stack (bottom -> top): count, constructor — k = 0 interfaces.
    const { block: b } = analyze(block(pushInt(0), pushInt(1), [0x2c], [0x00]));
    const op = b.ir.blocks[0]?.ops.find((o) => o.kind === 'implementsOp');
    expect(op).toBeDefined();
    if (op && op.kind === 'implementsOp') expect(op.numInterfaces).toBe(0);
  });

  it('CastOp pops object then constructor and pushes the result (or null)', () => {
    const { block: b } = analyze(block(pushInt(1), pushInt(1), [0x2b], [0x00]));
    const op = b.ir.blocks[0]?.ops.find((o) => o.kind === 'castOp');
    expect(op).toBeDefined();
    expect(b.ir.blocks[0]?.stackOut).toBe(1);
  });
});
