/**
 * Action-record framing and the opcode table — `IMPL-050` §3/§4 (`T-AVM1-FE-001`, `T-AVM1-FE-029`,
 * `T-AVM1-FE-017`). The table is the single source of payload layout (R002/R003); this test is
 * table-driven over every defined code and the enumerated undefined ranges.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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
import { analyze, block, collector, rec } from './harness.js';

const IMPL050 = readFileSync(
  fileURLToPath(new URL('../../../docs/impl/transpiler/050-actions-and-avm1.md', import.meta.url)),
  'utf8',
);

interface OpcodeCatalogRow {
  readonly code: number;
  readonly name: string;
  readonly minVersion: number;
  readonly payload: string;
  readonly stack: string;
}

function parseOpcodeCatalog(): OpcodeCatalogRow[] {
  const rows: OpcodeCatalogRow[] = [];
  let version: number | null = null;
  for (const line of IMPL050.split('\n## 5. Operands', 1)[0]?.split('\n') ?? []) {
    const heading = /^### 4\.[1-4] SWF (\d+)/.exec(line);
    if (heading?.[1] !== undefined) {
      version = Number(heading[1]);
      continue;
    }
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const codeCell = cells[0];
    if (codeCell === undefined || !/^0x[0-9a-f]{2}$/i.test(codeCell)) continue;
    if (version === null || (cells.length !== 4 && cells.length !== 5)) {
      throw new Error(`invalid IMPL-050 opcode row: ${line}`);
    }
    const nameCell = cells[1];
    if (nameCell === undefined) throw new Error(`missing opcode name: ${line}`);
    rows.push({
      code: Number.parseInt(codeCell.slice(2), 16),
      name: nameCell.replaceAll('`', ''),
      minVersion: version,
      payload: cells.length === 5 ? (cells[2] ?? '—') : '—',
      stack: cells.length === 5 ? (cells[3] ?? '—') : (cells[2] ?? '—'),
    });
  }
  return rows;
}

const EXPECTED_RESERVED_RANGES: readonly (readonly [number, number])[] = [
  [0x01, 0x03],
  [0x16, 0x16],
  [0x19, 0x1b],
  [0x1e, 0x1f],
  [0x2e, 0x2f],
  [0x38, 0x39],
  [0x56, 0x5f],
  [0x6a, 0x80],
  [0x82, 0x82],
  [0x84, 0x86],
  [0x90, 0x93],
  [0x95, 0x95],
  [0x97, 0x98],
  [0x9c, 0x9c],
  [0xa0, 0xff],
];

function expandRanges(ranges: readonly (readonly [number, number])[]): number[] {
  return ranges.flatMap(([first, last]) => Array.from({ length: last - first + 1 }, (_, i) => first + i));
}

function parseDocumentedReservedRanges(): [number, number][] {
  const section = IMPL050.match(/\*\*IMPL-050-R016\*\*([\s\S]*?)(?=\n\n)/)?.[1];
  const list = section?.match(/ranges are exactly ([\s\S]*?)\. These/)?.[1];
  if (list === undefined) throw new Error('could not parse IMPL-050-R016 reserved ranges');
  return [...list.matchAll(/0x([0-9a-f]{2})(?:[–-]0x([0-9a-f]{2}))?/gi)].map((match) => [
    Number.parseInt(match[1] ?? '', 16),
    Number.parseInt(match[2] ?? match[1] ?? '', 16),
  ]);
}

function documentedPayloadLength(payload: string): number | null {
  if (payload === '—') return 0;
  const explicitLength = /length always (\d+)/i.exec(payload);
  if (explicitLength?.[1] !== undefined) return Number(explicitLength[1]);
  if (/RegisterNumber UI8/.test(payload)) return 1;
  if (payload === '`SI16`') return 2;
  return null;
}

function normalizedStackEffect(stack: string): string {
  return stack === '—' ? '0→0' : stack.replace(/\s/g, '');
}

function effectCount(expression: string): number | 'var' {
  return /[nk]/.test(expression) ? 'var' : Number(expression);
}

describe('T-AVM1-FE-001 opcode table framing', () => {
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

  it('the full opcode catalog matches IMPL-050 by code, name, version, schema, and stack effect', () => {
    const catalog = parseOpcodeCatalog();
    expect(catalog).toHaveLength(102);
    expect(new Set(catalog.map((row) => row.code)).size).toBe(102);
    expect(OPCODES.size).toBe(102);
    const payloadKinds: Readonly<Record<string, string>> = {
      GotoFrame: 'gotoFrame',
      GetURL: 'getURL',
      WaitForFrame: 'waitForFrame',
      SetTarget: 'setTarget',
      GotoLabel: 'gotoLabel',
      WaitForFrame2: 'waitForFrame2',
      StoreRegister: 'fixed',
      ConstantPool: 'constantPool',
      With: 'with',
      Push: 'push',
      Jump: 'jump',
      GetURL2: 'getURL2',
      DefineFunction: 'defineFunction',
      If: 'if',
      GotoFrame2: 'gotoFrame2',
      DefineFunction2: 'defineFunction2',
      Try: 'try',
    };
    const counts = new Map<number, number>();
    for (const row of catalog) {
      const spec = OPCODES.get(row.code);
      expect(spec, `opcode 0x${row.code.toString(16).padStart(2, '0')}`).toBeDefined();
      if (spec === undefined) continue;
      expect(spec.name).toBe(row.name);
      expect(spec.minVersion).toBe(row.minVersion);
      expect(expectedPayloadLength(row.code)).toBe(documentedPayloadLength(row.payload));
      const expectedPayloadKind = payloadKinds[row.name] ?? 'none';
      expect(spec.payload.kind).toBe(expectedPayloadKind);

      const stackEffect = spec.stackEffect ?? `${spec.pops}→${spec.pushes}`;
      expect(stackEffect.replace(/\s/g, '')).toBe(normalizedStackEffect(row.stack));
      const primary = /^(.+?)→(.+?)(?:\(|$)/.exec(stackEffect.replace(/\s/g, ''));
      if (primary?.[1] !== undefined && primary[2] !== undefined) {
        expect(spec.pops).toBe(effectCount(primary[1]));
        expect(spec.pushes).toBe(effectCount(primary[2]));
      } else {
        throw new Error(`invalid stack formula for ${spec.name}: ${stackEffect}`);
      }
      counts.set(row.minVersion, (counts.get(row.minVersion) ?? 0) + 1);
    }
    expect([...OPCODES.keys()].sort((a, b) => a - b)).toEqual(catalog.map((row) => row.code).sort((a, b) => a - b));
    expect([...counts.entries()].sort(([a], [b]) => a - b)).toEqual([
      [3, 12],
      [4, 79],
      [6, 3],
      [7, 8],
    ]);
    expect([...SWF3_ONLY_CODES].sort((a, b) => a - b)).toEqual(
      catalog
        .filter((row) => row.minVersion === 3)
        .map((row) => row.code)
        .sort((a, b) => a - b),
    );
  });

  it('the exact reserved ranges match R016 and form the 256-code complement', () => {
    expect(parseDocumentedReservedRanges()).toEqual(EXPECTED_RESERVED_RANGES);
    const expectedUndefined = expandRanges(EXPECTED_RESERVED_RANGES);
    expect(UNDEFINED_CODES).toEqual(expectedUndefined);
    expect(UNDEFINED_CODES.length).toBe(256 - OPCODES.size);
    for (const code of UNDEFINED_CODES) {
      expect(isDefinedCode(code), `0x${code.toString(16)}`).toBe(false);
    }
    for (const spec of OPCODES.values()) {
      expect(UNDEFINED_CODES, spec.name).not.toContain(spec.code);
    }
    expect(new Set([...OPCODES.keys(), ...UNDEFINED_CODES]).size).toBe(256);
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

  it('the first End terminates framing; bytes after it are ignored (R006)', () => {
    const diag = collector();
    const bytes = Uint8Array.from([0x07, 0x00, 0x01, 0x0a]); // Stop; End; undefined and Add suffix
    const scan = scanRecords(bytes, diag.fn);

    expect(scan.records.map((record) => record.code)).toEqual([0x07, 0x00]);
    expect(scan.terminated).toBe(true);
    expect(scan.stoppedAt).toBe(2);
    expect(scan.desync).toBe(false);
    expect(diag.all).toEqual([]);
  });

  it('the analyzer does not decode or tier bytes after End', () => {
    const { block: analyzed, diag } = analyze(Uint8Array.from([0x07, 0x00, 0x01]));
    const ops = analyzed.ir.blocks.flatMap((basic) => basic.ops);

    expect(analyzed.decision.tier).toBe(0);
    expect(analyzed.reasons).toEqual([]);
    expect(ops.map((op) => (op.kind === 'timeline' ? op.timeline.op : op.kind))).toEqual(['stop', 'end']);
    expect(diag.has('SF0402')).toBe(false);
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

describe('T-AVM1-FE-029 observed-but-undocumented opcodes', () => {
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

describe('T-AVM1-FE-017 WaitForFrame / WaitForFrame2', () => {
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
    expect(opcode(0x8d)?.minVersion).toBe(4);
  });
});

describe('SWF3-era model detection', () => {
  it('the SWF 3 control set is enumerated', () => {
    for (const code of [0x00, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x81, 0x83, 0x8a, 0x8b, 0x8c]) {
      expect(SWF3_ONLY_CODES.has(code)).toBe(true);
      expect(opcode(code)?.minVersion).toBe(3);
    }
  });
});
