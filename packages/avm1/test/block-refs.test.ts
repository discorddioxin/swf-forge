/**
 * `T-AVM1-FE-036` — a `DoAction`/`DoInitAction` payload carries **no** block-level length prefix
 * (`E-034`; `IMPL-030-R029`, `IMPL-050-R003`/`R006`, doc 050 §5.1).
 *
 * The front end slices an action block from the `ActionBlockRef` the container hands it, at the ref's
 * own offset: `DoAction`'s payload *is* the `ACTIONRECORD` stream, and `decodeDoInitAction` has
 * already consumed the `UI16 SpriteID`. `IMPL-050-R003`'s `Length` is the *per-record* `UI16` that
 * follows an `ActionCode` whose high bit is set — the only `UI32` size in this area is
 * `CLIPACTIONRECORD.ActionRecordSize`, which belongs to clip actions.
 *
 * Skipping a phantom four-byte prefix here, and refusing refs shorter than four bytes, made the front
 * end agree with a test-support generator that emitted the same phantom prefix: self-consistent, and
 * both wrong. On real content every frame and init script desynchronised — `Push "// frame 3 A"` was
 * read from its fifth byte as `unknown-opcode 0x2f`, and a 726-byte script reported as a lone `End`
 * with 725 bytes dropped. No committed fixture contains an action block, so the whole suite stayed
 * green; only the open-corpus screen behind `IMPL-050` §13 criterion 3 exposed it.
 */

import { describe, expect, it } from 'vitest';

import { Tag, buildMovieModel, openSwf } from '@swf-forge/swf';
import { analyzeMovie } from '../src/index.js';
import { actionBlock, buildSwf, concat, defineSprite, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

import type { ActionIR } from '../src/frontend/ir.js';

/** Push string — type 0, NUL-terminated; the UI16 length covers the type byte, text and NUL. */
const pushStr = (s: string): number[] => [0x96, s.length + 2, 0, 0, ...[...s].map((c) => c.charCodeAt(0)), 0];
/** `Trace` (0x26): a sub-0x80 opcode, so it carries no length field at all. */
const trace = 0x26;
const u16 = (value: number): Uint8Array => Uint8Array.of(value & 0xff, (value >>> 8) & 0xff);

const analyze = (body: Uint8Array, version = 7) => {
  const file = openSwf(buildSwf({ version, body, frameCount: 1 }));
  const model = buildMovieModel(file);
  return { file, model, analysis: analyzeMovie(file, model, { emit: () => undefined }) };
};

const opsOf = (ir: ActionIR | undefined) => (ir === undefined ? [] : ir.blocks.flatMap((b) => b.ops));

const pushedStrings = (ir: ActionIR | undefined) =>
  opsOf(ir)
    .flatMap((op) => (op.kind === 'push' ? op.values : []))
    .flatMap((operand) => (operand.kind === 'lit' && operand.value.type === 'string' ? [operand.value.value] : []));

describe('E-034 / T-AVM1-FE-036: blocks are sliced from the ref the container hands over', () => {
  it('the generator emits ACTIONRECORD bytes only, with no UI32 block prefix', () => {
    expect([...actionBlock([])]).toEqual([0x00]);
    expect([...actionBlock([trace])]).toEqual([trace, 0x00]);
    // The first byte is the ActionCode (Push, 0x96), not the low byte of a length.
    expect([...actionBlock(pushStr('hi'))][0]).toBe(0x96);
    expect(actionBlock(pushStr('hi')).length).toBe(pushStr('hi').length);
  });

  it('parses a frame script from byte 0 of the DoAction payload, at the ref offset', () => {
    const text = '// frame 3 A';
    const { model, analysis } = analyze(
      concat(tag(Tag.DoAction, actionBlock([...pushStr(text), trace])), showFrames(1), endTag()),
    );
    const ref = model.mainTimeline.frames[0]?.actions[0];
    expect(ref).toBeDefined();

    const block = analysis.blocks.find((entry) => entry.ir.kind === 'timeline');
    expect(block?.ir.byteRange.start).toBe(ref?.offset);
    expect(block?.ir.byteRange.end).toBe((ref?.offset ?? 0) + (ref?.length ?? 0));
    expect(block?.decision.tier).toBe(0);
    expect(block?.reasons).toEqual([]);
    // The pushed text survives verbatim: reading from byte 4 would have landed inside it.
    expect(pushedStrings(block?.ir)).toContain(text);
    expect(opsOf(block?.ir).some((op) => op.kind === 'unknown')).toBe(false);
  });

  it('reports a one-byte End-only block instead of dropping it', () => {
    const { analysis } = analyze(concat(tag(Tag.DoAction, actionBlock([])), showFrames(1), endTag()));
    const blocks = analysis.blocks.filter((entry) => entry.ir.kind === 'timeline');
    expect(blocks).toHaveLength(1);
    expect(blocks[0]?.ir.byteRange.end).toBe((blocks[0]?.ir.byteRange.start ?? 0) + 1);
    expect(blocks[0]?.decision.tier).toBe(0);
  });

  it('starts a DoInitAction script after its UI16 sprite id, not four bytes in', () => {
    const { model, analysis } = analyze(
      concat(
        defineSprite(1, 1, concat(showFrames(1), endTag())),
        tag(Tag.DoInitAction, concat(u16(1), actionBlock([...pushStr('init'), trace]))),
        showFrames(1),
        endTag(),
      ),
    );
    const ref = model.initActions[0]?.block;
    expect(ref).toBeDefined();

    const block = analysis.blocks.find((entry) => entry.ir.kind === 'init');
    expect(block?.ir.id).toBe('init_1_0');
    expect(block?.ir.byteRange.start).toBe(ref?.offset);
    expect(block?.ir.byteRange.end).toBe((ref?.offset ?? 0) + (ref?.length ?? 0));
    expect(block?.decision.tier).toBe(0);
    expect(pushedStrings(block?.ir)).toContain('init');
    expect(opsOf(block?.ir).some((op) => op.kind === 'unknown')).toBe(false);
  });
});
