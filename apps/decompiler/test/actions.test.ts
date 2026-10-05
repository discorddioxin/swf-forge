/**
 * `forge-decompile inspect --actions` — the AVM1 front end surfaced in the decompiler
 * (WP-050-16, `IMPL-050` §1.8). Pins the disassembly text for a hand-built action block,
 * the JSON shape of `--actions`, and the AVM2 gate's hard failure (`T-AVM1-010`: `SF1000`,
 * exit 3, offset named).
 */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { EXIT, runCli, type CliIo } from '@swf-forge/decompiler';
import { Tag } from '@swf-forge/swf';
import { actionBlock, buildSwf, concat, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

const WORK = mkdtempSync(join(tmpdir(), 'swf-forge-actions-'));
afterAll(() => rmSync(WORK, { recursive: true, force: true }));

interface Captured {
  readonly io: CliIo;
  readonly out: string[];
  readonly err: string[];
}

function capture(): Captured {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (l) => out.push(l), err: (l) => err.push(l) }, out, err };
}

function write(name: string, bytes: Uint8Array): string {
  const path = join(WORK, name);
  writeFileSync(path, bytes);
  return path;
}

function run(args: readonly string[]): { exit: number; text: string } {
  const captured = capture();
  const exit = runCli(args, captured.io);
  return { exit, text: captured.out.join('\n') };
}

/** Push 1, 2; Add; Push 5; GotoFrame2 (play, frame from stack = 5); End. */
function sampleProgram(): number[] {
  const pushTwoInts = [0x96, 10, 0, 7, 1, 0, 0, 0, 7, 2, 0, 0, 0];
  const add = [0x0a]; // Add (AVM1: 0x0a, not 0x01)
  const pushFive = [0x96, 5, 0, 7, 5, 0, 0, 0];
  const gotoFrame2Play = [0x9f, 3, 0, 1, 2, 0];
  const end = [0x00];
  return [...pushTwoInts, ...add, ...pushFive, ...gotoFrame2Play, ...end];
}

describe('inspect --actions', () => {
  it('disassembles a hand-built action block with named ops and values', () => {
    const body = concat(tag(Tag.DoAction, actionBlock(sampleProgram())), showFrames(1), endTag());
    const path = write('sample.swf', buildSwf({ version: 7, body, frameCount: 1 }));
    const { exit, text } = run(['inspect', path, '--actions']);

    expect(exit).toBe(EXIT.ok);
    expect(text).toContain('actions');
    // The block header names the id, kind and tier.
    expect(text).toMatch(/== frame_0_0 \(timeline\) tier T\d/);
    // Every op is printed by the opcode table's name with its operands.
    expect(text).toContain('Push 1, 2');
    expect(text).toContain('Add ');
    expect(text).toContain('Push 5');
    expect(text).toContain('GotoFrame2 5 play');
    // Blocks are structured, with a terminator line.
    expect(text).toMatch(/block \d+ @ \d+\.\.\d+/);
    expect(text).toMatch(/→ (end|block \d+)/);
  });

  it('is byte-deterministic across runs', () => {
    const body = concat(tag(Tag.DoAction, actionBlock(sampleProgram())), showFrames(1), endTag());
    const path = write('sample-det.swf', buildSwf({ version: 7, body, frameCount: 1 }));
    expect(run(['inspect', path, '--actions']).text).toBe(run(['inspect', path, '--actions']).text);
  });

  it('exposes the analysis as structured JSON', () => {
    const body = concat(tag(Tag.DoAction, actionBlock(sampleProgram())), showFrames(1), endTag());
    const path = write('sample-json.swf', buildSwf({ version: 7, body, frameCount: 1 }));
    const { exit, text } = run(['inspect', path, '--actions', '--json']);
    expect(exit).toBe(EXIT.ok);
    const dump = JSON.parse(text) as {
      actions?: { avm2: { present: boolean }; blockCount: number; disassembly: string; t2FrameScripts: unknown[] };
    };
    expect(dump.actions).toBeDefined();
    expect(dump.actions?.avm2.present).toBe(false);
    expect(dump.actions?.blockCount).toBe(1);
    expect(dump.actions?.disassembly).toContain('Push 5');
  });

  it('T-AVM1-010: DoABC -> SF1000, exit 3, offset named', () => {
    // DoABC body: name-length 0, then a handful of ABC bytes (content is irrelevant to the gate).
    const doAbc = tag(Tag.DoABC, Uint8Array.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]));
    const body = concat(doAbc, showFrames(1), endTag());
    const path = write('avm2.swf', buildSwf({ version: 9, body, frameCount: 1 }));
    const { exit, text } = run(['inspect', path, '--actions']);
    expect(exit).toBe(EXIT.avm2);
    expect(text).toContain('AVM2 content');
    expect(text).toContain('SF1000');
  });
});
