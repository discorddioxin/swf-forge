/** Synthetic disassembly conformance — `IMPL-050` §10 (`T-AVM1-FE-032`). */

import { describe, expect, it } from 'vitest';

import { disassembleBlock } from '@swf-forge/avm1';
import { analyze, block, defineFunction, pushString, rec, tryRegion, withRegion } from './harness.js';

describe('T-AVM1-FE-032 synthetic disassembly conformance', () => {
  it('renders string escapes and the same stable text on repeated passes', () => {
    const bytes = block(pushString('say "go"\\now\n'), rec(0x17));
    const { block: analyzed } = analyze(bytes);
    const first = disassembleBlock(analyzed, 0x20);
    const second = disassembleBlock(analyzed, 0x20);

    expect(first).toEqual(second);
    expect(first).toEqual([
      '== test (timeline) tier T0 @ 0x0020..0x0034',
      '  block 0 @ 0..20 stack 0→0 → end',
      '    Push "say \\"go\\"\\\\now\\n"',
      '    Pop "say \\"go\\"\\\\now\\n"',
      '    End',
    ]);
  });

  it('renders nested With/Try regions and a function body with stable indentation', () => {
    const bytes = block(
      pushString('scope'),
      withRegion(1, [0x07]),
      tryRegion({ try: [0x06], catchName: 'e', catch: [0x07], finallyPresent: true, finally: [0x06] }),
      defineFunction({ name: 'f', params: ['x'], body: [0x07, 0x00] }),
      rec(0x17),
    );
    const { block: analyzed } = analyze(bytes);
    const first = disassembleBlock(analyzed, 0x100);

    expect(disassembleBlock(analyzed, 0x100)).toEqual(first);
    expect(first).toEqual([
      '== test (timeline) tier T0 @ 0x0100..0x012E',
      // Control flows *through* a region (errata E-040): the block holding the region op falls into
      // the body, the body falls into the region's `finally` when it has one, and the last body falls
      // back to the record after the region op — so the continuation is entered from the bodies and
      // carries the depth they left. Each body is entered from its region op at the depth that op saw
      // (`With` after its pop, `Try` before any of its three bodies), so these depths are verified
      // rather than unknown, and the catch and finally bodies carry their own records (errata E-039).
      '  block 0 @ 0..15 stack 0→0 → block 3',
      '    Push "scope"',
      '    With (depth 1)',
      '      block 3 @ 15..16 stack 0→0 → block 1',
      '        Stop',
      '  block 1 @ 16..28 stack 0→0 → block 4',
      '    Try catch "e" finally',
      '      block 4 @ 28..29 stack 0→0 → block 6',
      '        Play',
      '      // catch',
      '        block 5 @ 29..30 stack 0→0 → block 6',
      '          Stop',
      '      // finally',
      '        block 6 @ 30..31 stack 0→0 → block 2',
      '          Play',
      '  block 2 @ 31..46 stack 0→0 → end',
      '    DefineFunction "f" (x) regs=0',
      '      block 0 @ 0..2 stack 0→0 → end',
      '        Stop',
      '        End',
      '    Pop t0',
      '    End',
      '  block 3 @ 15..16 stack 0→0 → block 1',
      '    Stop',
      '  block 4 @ 28..29 stack 0→0 → block 6',
      '    Play',
      '  block 5 @ 29..30 stack 0→0 → block 6',
      '    Stop',
      '  block 6 @ 30..31 stack 0→0 → block 2',
      '    Play',
    ]);
  });
});
