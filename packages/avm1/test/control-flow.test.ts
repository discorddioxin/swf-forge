/**
 * CFG and `SetTarget` region splitting — `IMPL-050` §5.6/§7 (`T-AVM1-004`).
 */

import { describe, expect, it } from 'vitest';

import { analyze, block, pushString, rec, setTarget } from './harness.js';

describe('T-AVM1-004 SetTarget block splitting and region extent', () => {
  it('SetTarget ends a block and its target is a region parameter for the records that follow', () => {
    const bytes = block(pushString('x'), setTarget('/a'), rec(0x0a), setTarget(''), rec(0x0a));
    const { block: b } = analyze(bytes);
    const blocks = b.ir.blocks;
    // Blocks: [push, setTarget '/a'] · [Add, setTarget ''] · [Add, End].
    expect(blocks.length).toBe(3);

    // Block 0 ends in the SetTarget terminator.
    expect(blocks[0]?.terminator.kind).toBe('target');
    if (blocks[0]?.terminator.kind === 'target') {
      expect(blocks[0].terminator.target).toEqual({ kind: 'path', clips: ['a'], name: null });
    }

    // The Add inside the region carries the region's target as a parameter (never ambient).
    expect(blocks[1]?.target).toEqual({ kind: 'path', clips: ['a'], name: null });

    // The closing SetTarget "" restores the current file for the records that follow.
    if (blocks[1]?.terminator.kind === 'target') {
      expect(blocks[1].terminator.target).toEqual({ kind: 'file' });
    }
    expect(blocks[2]?.target).toEqual({ kind: 'file' });
  });

  it('nested target regions: the inner SetTarget wins until its own closing SetTarget', () => {
    const bytes = block(
      setTarget('/a'),
      setTarget('/a/b'),
      rec(0x0a),
      setTarget('/a'),
      rec(0x0a),
      setTarget(''),
      rec(0x0a),
    );
    const { block: b } = analyze(bytes);
    const blocks = b.ir.blocks;
    // Blocks: [/a] · [/a/b] · [Add, /a] · [Add, ''] · [Add, End]
    expect(blocks[2]?.target).toEqual({ kind: 'path', clips: ['a', 'b'], name: null });
    // After the mid-region SetTarget back to /a, the Add sees /a.
    expect(blocks[3]?.target).toEqual({ kind: 'path', clips: ['a'], name: null });
    // After the final closing SetTarget "", the Add sees the file.
    expect(blocks[4]?.target).toEqual({ kind: 'file' });
  });

  it('a Jump ends its block and opens a new one at the target', () => {
    // [Add@0, Jump+1@1, Add@6, Add@7]: the jump (ending at offset 6) targets offset 7, skipping
    // the Add at offset 6.
    const bytes = block(rec(0x0a), rec(0x99, [0x01, 0x00]), rec(0x0a), rec(0x0a));
    const { block: b } = analyze(bytes);
    const blocks = b.ir.blocks;
    expect(blocks[0]?.terminator.kind).toBe('jump');
    if (blocks[0]?.terminator.kind !== 'jump') return;
    const targetId = blocks[0].terminator.target;
    expect(targetId).not.toBeNull();
    // The jump's target block starts at offset 7 (the second Add).
    const targetBlock = blocks.find((blk) => blk.id === targetId);
    expect(targetBlock?.firstOffset).toBe(7);
  });
});
