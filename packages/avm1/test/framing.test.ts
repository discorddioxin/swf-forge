/**
 * Action-record framing and the opcode table — `IMPL-050` §3/§4 (`T-AVM1-001`, `T-AVM1-029`,
 * `T-AVM1-017`). The table is the single source of payload layout (R002/R003); this test is
 * table-driven over every defined code and the enumerated undefined ranges.
 */

import { describe, expect, it } from 'vitest';

import {
  OPCODES,
  SWF3_ONLY_CODES,
  UNDEFINED_CODES,
  expectedPayloadLength,
  isDefinedCode,
  isObservedCode,
  opcode,
  scanRecords,
} from '@swf-forge/avm1';
import { block, collector, rec } from './harness.js';

describe('T-AVM1-001 opcode table framing', () => {
  it('every defined code has a spec and a computable or open payload length', () => {
    const expected: Record<string, number | null> = {
      none: 0,
      fixed: null, // depends on the fixed length
      jump: 2,
      if: 2,
      gotoFrame: 2,
      getURL: null,
      setTarget: null,
      gotoLabel: null,
      waitForFrame: 3,
      waitForFrame2: 1,
      storeRegister: 1,
      getURL2: 1,
      gotoFrame2: 1,
      constantPool: null,
      push: null,
      with: null,
      defineFunction: null,
      defineFunction2: null,
      try: null,
    };
    for (const spec of OPCODES.values()) {
      const got = expectedPayloadLength(spec.code);
      if (spec.payload.kind === 'none') expect(got, spec.name).toBe(0);
      else if (spec.payload.kind === 'fixed') expect(got, spec.name).toBe(spec.payload.length);
      else if (spec.payload.kind in expected) expect(got, spec.name).toBe(expected[spec.payload.kind]);
      else throw new Error(`unexpected payload kind ${spec.payload.kind}`);
    }
  });

  it('the undefined ranges are enumerated so a new opcode cannot slip in', () => {
    expect(UNDEFINED_CODES.length).toBe(256 - OPCODES.size);
    for (const code of UNDEFINED_CODES) {
      expect(isDefinedCode(code), `0x${code.toString(16)}`).toBe(false);
    }
    for (const spec of OPCODES.values()) {
      expect(UNDEFINED_CODES, spec.name).not.toContain(spec.code);
    }
  });

  it('the two observed-but-undocumented codes are the only sanctioned exceptions (R016)', () => {
    expect(isObservedCode(0x89)).toBe(true);
    expect(isObservedCode(0x2d)).toBe(true);
    let observedCount = 0;
    for (const spec of OPCODES.values()) if (spec.observed) observedCount += 1;
    expect(observedCount).toBe(2);
  });

  it('scanRecords frames a block and reports the terminator', () => {
    const diag = collector();
    const bytes = block(rec(0x0a), rec(0x99, [0x02, 0x00]), rec(0x0a));
    const scan = scanRecords(bytes, diag.fn);
    expect(scan.records.map((r) => r.code)).toEqual([0x0a, 0x99, 0x0a, 0x00]);
    expect(scan.terminated).toBe(true);
    expect(scan.desync).toBe(false);
    // Jump (0x99) has a length field; the others do not.
    expect(scan.records[1]?.hasLength).toBe(true);
    expect(scan.records[0]?.hasLength).toBe(false);
    expect(scan.records[1]?.length).toBe(2);
  });

  it('a 0x80+ record whose length overruns the block desyncs (SF0401, R004)', () => {
    const diag = collector();
    // Jump declaring 0x1000 payload bytes but the block is shorter.
    const bytes = Uint8Array.from([0x99, 0x00, 0x10, 0x01, 0x02, 0x00]);
    const scan = scanRecords(bytes, diag.fn);
    expect(scan.desync).toBe(true);
    expect(diag.has('SF0401')).toBe(true);
  });

  it('a stream with no terminating End is tolerated with SF0420 (R006)', () => {
    const diag = collector();
    const bytes = Uint8Array.from([0x0a, 0x0b]);
    const scan = scanRecords(bytes, diag.fn);
    expect(scan.terminated).toBe(false);
    expect(scan.records.map((r) => r.code)).toEqual([0x0a, 0x0b]);
    expect(diag.has('SF0420')).toBe(true);
  });

  it('a truncated length field is SF0400 (R000)', () => {
    const diag = collector();
    const bytes = Uint8Array.from([0x99, 0x02]); // length field cut off
    const scan = scanRecords(bytes, diag.fn);
    expect(scan.desync).toBe(true);
    expect(diag.has('SF0400')).toBe(true);
  });
});

describe('T-AVM1-029 observed-but-undocumented opcodes', () => {
  it('0x89 and 0x2D decode inert with diagnostics', () => {
    const diag = collector();
    const bytes = block(rec(0x89), rec(0x2d));
    const scan = scanRecords(bytes, diag.fn);
    // records are 0x89, 0x2D, End — only the first two are the R016 exceptions.
    expect(scan.records.map((r) => r.observed)).toEqual([true, true, false]);
    const byCode = new Map(scan.records.map((r) => [r.code, r]));
    expect(byCode.get(0x89)?.observed).toBe(true);
    expect(byCode.get(0x2d)?.observed).toBe(true);
    expect(byCode.get(0x89)?.name).toBe('StrictMode');
    expect(byCode.get(0x2d)?.name).toBe('FsCommand2');
  });
});

describe('T-AVM1-017 WaitForFrame / WaitForFrame2', () => {
  it('WaitForFrame is frame-then-skip, payload length 3', () => {
    const diag = collector();
    const rec1 = rec(0x8a, [0x05, 0x00, 0x03]); // frame 5, skip 3
    const bytes = block(rec1);
    const scan = scanRecords(bytes, diag.fn);
    const w = scan.records[0];
    expect(w?.code).toBe(0x8a);
    expect(w?.length).toBe(3);
    expect(expectedPayloadLength(0x8a)).toBe(3);
  });

  it('WaitForFrame2 is skip-only, payload length 1', () => {
    const diag = collector();
    const bytes = block(rec(0x8d, [0x07]));
    const scan = scanRecords(bytes, diag.fn);
    const w = scan.records[0];
    expect(w?.code).toBe(0x8d);
    expect(w?.length).toBe(1);
    expect(expectedPayloadLength(0x8d)).toBe(1);
  });
});

describe('SWF3-era model detection', () => {
  it('the SWF 3 control set is enumerated', () => {
    for (const code of [0x00, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x81, 0x83, 0x8a, 0x8b, 0x8c, 0x8d]) {
      expect(SWF3_ONLY_CODES.has(code)).toBe(true);
      expect(opcode(code)?.minVersion).toBe(3);
    }
  });
});
