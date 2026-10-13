/** `forge-decompile analyze --tiers` (P5-C1): stable tier rows for action blocks and nested functions. */

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';

import { EXIT, runCli, type CliIo } from '@swf-forge/decompiler';
import { Tag } from '@swf-forge/swf';
import { actionBlock, buildSwf, concat, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

const WORK = mkdtempSync(join(tmpdir(), 'swf-forge-analyze-'));
afterAll(() => rmSync(WORK, { recursive: true, force: true }));

interface Captured {
  readonly io: CliIo;
  readonly out: string[];
  readonly err: string[];
}

function capture(): Captured {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (line) => out.push(line), err: (line) => err.push(line) }, out, err };
}

function write(name: string, bytes: Uint8Array): string {
  const path = join(WORK, name);
  writeFileSync(path, bytes);
  return path;
}

function functionRecord(name: string, body: readonly number[]): number[] {
  const payload = [
    ...[...name].map((character) => character.charCodeAt(0) & 0xff),
    0, // function name
    0,
    0, // NumParams
    body.length & 0xff,
    (body.length >>> 8) & 0xff, // CodeSize
    ...body,
  ];
  return [0x9b, payload.length & 0xff, (payload.length >>> 8) & 0xff, ...payload];
}

function sampleMovie(): Uint8Array {
  // The outer frame script is T0. Its nested named function contains an unknown opcode and is T2;
  // R059 requires these decisions to remain independent.
  const actions = [...functionRecord('residualBody', [0x01, 0x00]), 0x00];
  const body = concat(tag(Tag.DoAction, actionBlock(actions)), showFrames(1), endTag());
  return buildSwf({ version: 7, body, frameCount: 1 });
}

function run(args: readonly string[]): { readonly exit: number; readonly out: string[]; readonly err: string[] } {
  const captured = capture();
  const exit = runCli(args, captured.io);
  return { exit, out: captured.out, err: captured.err };
}

describe('analyze --tiers', () => {
  it('reports the action block and nested function independently, including the T2 reason', () => {
    const path = write('nested-residual.swf', sampleMovie());
    const result = run(['analyze', path, '--tiers', '--json']);
    expect(result.exit).toBe(EXIT.ok);
    expect(result.err).toEqual([]);

    const report = JSON.parse(result.out.join('\n')) as {
      schemaVersion: number;
      counts: { actionBlocks: number; functions: number; T0: number; T1: number; T2: number };
      entries: readonly {
        id: string;
        role: string;
        parentId: string | null;
        name: string | null;
        tier: number;
        reasons: readonly { reason: string }[];
        residualBytes: number;
      }[];
      diagnostics: { items: readonly { code: string }[] };
    };

    expect(report.schemaVersion).toBe(1);
    expect(report.counts).toEqual({ actionBlocks: 1, functions: 1, T0: 1, T1: 0, T2: 1 });
    const action = report.entries.find((entry) => entry.role === 'actionBlock');
    const nested = report.entries.find((entry) => entry.role === 'function');
    expect(action).toMatchObject({ id: 'frame_0_0', tier: 0, parentId: null });
    expect(nested).toMatchObject({ role: 'function', name: 'residualBody', tier: 2, parentId: 'frame_0_0' });
    expect(nested?.reasons.map((reason) => reason.reason)).toContain('unknown-opcode:0x01');
    expect(nested?.residualBytes).toBeGreaterThan(0);
    expect(report.diagnostics.items.some((item) => item.code === 'SF0402')).toBe(true);
  });

  it('is deterministic in JSON and includes a concise human report', () => {
    const path = write('stable.swf', sampleMovie());
    const first = run(['analyze', path, '--tiers', '--json']);
    const second = run(['analyze', path, '--tiers', '--json']);
    expect(first.out).toEqual(second.out);

    const human = run(['analyze', path, '--tiers']);
    expect(human.exit).toBe(EXIT.ok);
    expect(human.out.join('\n')).toContain('T0=1, T1=0, T2=1');
    expect(human.out.join('\n')).toContain('T2 function');
    expect(human.out.join('\n')).toContain('unknown-opcode:0x01');
  });

  it('T-AVM1-FE-010: the AVM2 gate reports SF1000 and exits 3', () => {
    const doAbc = tag(Tag.DoABC, Uint8Array.from([0, 0, 0, 0, 0, 0, 0, 0]));
    const path = write(
      'avm2.swf',
      buildSwf({ version: 9, body: concat(doAbc, showFrames(1), endTag()), frameCount: 1 }),
    );
    const result = run(['analyze', path, '--tiers', '--json']);
    expect(result.exit).toBe(EXIT.avm2);
    const report = JSON.parse(result.out.join('\n')) as {
      avm2: { present: boolean; reason: string; offset: number };
      entries: readonly unknown[];
      diagnostics: { items: readonly { code: string }[] };
    };
    expect(report.avm2.present).toBe(true);
    expect(report.avm2.reason).toContain('DoABC tag at offset 0');
    expect(report.avm2.offset).toBe(0);
    expect(report.entries).toEqual([]);
    expect(report.diagnostics.items.some((item) => item.code === 'SF1000')).toBe(true);
  });

  it('prints command help and requires --tiers for a report', () => {
    const help = capture();
    expect(runCli(['analyze', '--help'], help.io)).toBe(EXIT.ok);
    expect(help.out.join('\n')).toContain('analyze <file.swf> --tiers');

    const noTiers = capture();
    expect(runCli(['analyze', 'movie.swf'], noTiers.io)).toBe(EXIT.unreadable);
    expect(noTiers.err.join('\n')).toContain('requires --tiers');

    const missing = capture();
    expect(runCli(['analyze', join(WORK, 'missing.swf'), '--tiers'], missing.io)).toBe(EXIT.unreadable);
    expect(missing.err.join('\n')).toContain('cannot read');
  });
});
