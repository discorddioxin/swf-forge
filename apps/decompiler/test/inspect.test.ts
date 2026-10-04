/**
 * `forge-decompile inspect` — the first CLI surface (`TECH-SPEC` §3.2, `CMP-R029`).
 *
 * The tests run the dispatcher in process (no subprocess, no shell) and assert the exit codes and the
 * two output modes. The `CWS` case builds a compressed copy of the golden fixture, which is what
 * exercises the Node inflater wiring in `@swf-forge/swf/node`.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';

import { EXIT, runCli, type CliIo } from '@swf-forge/decompiler';

const FIXTURE = fileURLToPath(new URL('../../../fixtures/appendix-a.swf', import.meta.url));
const WORK = mkdtempSync(join(tmpdir(), 'swf-forge-'));
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

describe('forge-decompile inspect', () => {
  it('reports the golden fixture and exits 0', () => {
    const { io, out, err } = capture();
    const code = runCli(['inspect', FIXTURE], io);
    expect(code).toBe(EXIT.ok);
    expect(err).toEqual([]);
    const text = out.join('\n');
    expect(text).toContain('FWS, version 3');
    expect(text).toContain('550 x 400 px');
    expect(text).toContain('12 fps');
    expect(text).toContain('#1  DefineShape');
    expect(text).toContain('SF0002');
  });

  it('emits a stable JSON summary with --json', () => {
    const first = capture();
    expect(runCli(['inspect', FIXTURE, '--json'], first.io)).toBe(EXIT.ok);
    const summary = JSON.parse(first.out.join('\n')) as Record<string, unknown>;

    expect(summary.version).toBe(3);
    expect(summary.compression).toBe('none');
    expect(summary.file).toMatchObject({ bytes: 79 });
    expect(summary.stage).toEqual({ widthPx: 550, heightPx: 400, widthTwips: 11000, heightTwips: 8000 });
    expect(summary.counts).toEqual({ tags: 5, definitions: 1, characters: 1, sprites: 0, frames: 1, exports: 0 });
    expect(summary.characters).toEqual([{ id: 1, tag: 'DefineShape', sprite: false }]);
    expect(summary.background).toBe(0xffffff);
    expect(String(summary.id).startsWith('sha256:')).toBe(true);
    expect((summary.diagnostics as { errors: number }).errors).toBe(0);

    const second = capture();
    expect(runCli(['inspect', FIXTURE, '--json'], second.io)).toBe(EXIT.ok);
    expect(second.out).toEqual(first.out);
  });

  it('opens a CWS file through the Node inflater', () => {
    const original = new Uint8Array(readFileSync(FIXTURE));
    const compressed = deflateSync(original.subarray(8));
    const cws = new Uint8Array(8 + compressed.length);
    cws.set(original.subarray(0, 8));
    cws.set(compressed, 8);
    cws[0] = 0x43; // 'C'
    const path = write('fixture-cws.swf', cws);

    const { io, out } = capture();
    expect(runCli(['inspect', path, '--json'], io)).toBe(EXIT.ok);
    const summary = JSON.parse(out.join('\n')) as { compression: string; counts: { tags: number } };
    expect(summary.compression).toBe('zlib');
    expect(summary.counts.tags).toBe(5);
  });

  it('exits 2 for a missing file', () => {
    const { io, err } = capture();
    expect(runCli(['inspect', join(WORK, 'nope.swf')], io)).toBe(EXIT.unreadable);
    expect(err.join('\n')).toContain('cannot read');
  });

  it('exits 2 for a file that is not a SWF', () => {
    const path = write('not-a-swf.bin', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5]));
    const { io } = capture();
    expect(runCli(['inspect', path], io)).toBe(EXIT.unreadable);
  });

  it('rejects unknown verbs and prints usage for no arguments', () => {
    const unknown = capture();
    expect(runCli(['explode', FIXTURE], unknown.io)).toBe(EXIT.unreadable);
    expect(unknown.err.join('\n')).toContain('unknown command');

    const empty = capture();
    expect(runCli([], empty.io)).toBe(EXIT.unreadable);
    expect(empty.out.join('\n')).toContain('Usage:');

    const help = capture();
    expect(runCli(['--help'], help.io)).toBe(EXIT.ok);
  });
});
