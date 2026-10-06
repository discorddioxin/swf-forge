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
import { Tag } from '@swf-forge/swf';
import { buildSwf, concat, defineSprite, endTag, placeObject2, tag } from '@swf-forge/swf/test-support';

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

  it('T-SWF-007 exposes duplicate definitions and marks the last definition as the lookup winner', () => {
    const body = concat(
      tag(Tag.DefineShape, Uint8Array.from([1, 0])),
      tag(Tag.DefineShape2, Uint8Array.from([1, 0])),
      endTag(),
    );
    const path = write('duplicate-definitions.swf', buildSwf({ version: 8, body, frameCount: 0 }));
    const json = capture();
    expect(runCli(['inspect', path, '--json'], json.io)).toBe(EXIT.ok);
    const summary = JSON.parse(json.out.join('\n')) as {
      definitions: readonly { id: number; tag: string; offset: number; shadowed: boolean }[];
      diagnostics: { items: readonly { code: string; message: string }[] };
    };
    expect(summary.definitions).toEqual([
      { id: 1, tag: 'DefineShape', offset: 2, shadowed: true },
      { id: 1, tag: 'DefineShape2', offset: 6, shadowed: false },
    ]);
    expect(summary.diagnostics.items.find((item) => item.code === 'SF0109')?.message).toContain('offsets 2 and 6');

    const human = capture();
    expect(runCli(['inspect', path], human.io)).toBe(EXIT.ok);
    expect(human.out.join('\n')).toContain('duplicate definitions');
    expect(human.out.join('\n')).toContain('(shadowed)');
    expect(human.out.join('\n')).toContain('(winner)');
  });

  it('supports --strict and --tolerate-length for a FileLength mismatch', () => {
    const bytes = new Uint8Array(readFileSync(FIXTURE));
    bytes[4] = (bytes[4] ?? 0) + 1;
    const path = write('wrong-length.swf', bytes);
    const strict = capture();
    expect(runCli(['inspect', path, '--strict', '--json'], strict.io)).toBe(EXIT.failed);
    const strictSummary = JSON.parse(strict.out.join('\n')) as {
      diagnostics: { items: readonly { code: string; severity: string }[] };
    };
    expect(strictSummary.diagnostics.items.find((item) => item.code === 'SF0005')?.severity).toBe('error');

    const tolerant = capture();
    expect(runCli(['inspect', path, '--strict', '--tolerate-length', '--json'], tolerant.io)).toBe(EXIT.ok);
    const tolerantSummary = JSON.parse(tolerant.out.join('\n')) as {
      diagnostics: { items: readonly { code: string; severity: string }[] };
    };
    expect(tolerantSummary.diagnostics.items.find((item) => item.code === 'SF0005')?.severity).toBe('warning');
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

  it('F-02: --strict on a structurally torn file prints the report and fails without a stack trace', () => {
    const original = new Uint8Array(readFileSync(FIXTURE));
    const compressed = deflateSync(original.subarray(8));
    const cws = new Uint8Array(8 + compressed.length);
    cws.set(original.subarray(0, 8));
    cws.set(compressed, 8);
    cws[0] = 0x43;
    // Tear the compressed stream: the decoded tag stream no longer reaches its declared end.
    const torn = write('torn-cws.swf', cws.subarray(0, cws.length - 12));

    const strict = capture();
    expect(runCli(['inspect', torn, '--strict'], strict.io)).toBe(EXIT.failed);
    // The accumulated diagnostics are printed (R011: failure after producing the report)…
    expect(strict.err.join('\n')).toMatch(/SF00\d\d/);
    // …the abort is reported as an input problem, not an internal error…
    expect(strict.err.join('\n')).toContain('strict mode aborted');
    expect(strict.err.join('\n')).not.toContain('internal error');
    // …and no stack trace escapes.
    expect(strict.err.join('\n')).not.toContain('\n    at ');
  });

  it('F-02: --strict on a non-SWF file fails cleanly with the soft-mode exit code', () => {
    const path = write('not-a-swf-strict.bin', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5]));
    const strict = capture();
    expect(runCli(['inspect', path, '--strict'], strict.io)).toBe(EXIT.unreadable);
    expect(strict.err.join('\n')).toContain('SF0001');
    expect(strict.err.join('\n')).not.toContain('internal error');
    expect(strict.err.join('\n')).not.toContain('\n    at ');
  });

  /** A movie with one sprite, one export and one import — the WP-020-12 demo surface. */
  function symbolFixture(): string {
    const ascii = (s: string): Uint8Array => {
      const bytes = new Uint8Array(s.length + 1);
      for (let i = 0; i < s.length; i += 1) bytes[i] = s.charCodeAt(i);
      return bytes;
    };
    const sprite = defineSprite(2, 1, concat(tag(1), endTag()));
    // ExportAssets (56): `UI16 Count` + (`UI16 Id`, `STRING Name`)…
    const exportAssets = tag(Tag.ExportAssets, concat(new Uint8Array([0x01, 0x00, 0x02, 0x00]), ascii('mySprite')));
    // ImportAssets (57): `STRING Url` + `UI16 Count` + (`UI16 Id`|0x0000, `STRING Name`)…
    const importAssets = tag(
      Tag.ImportAssets,
      concat(ascii('other.swf'), new Uint8Array([0x01, 0x00, 0x00, 0x00]), ascii('other')),
    );
    const body = concat(sprite, exportAssets, importAssets, placeObject2(2, 1), tag(1), endTag());
    return write('symbols.swf', buildSwf({ body, frameCount: 1 }));
  }

  it('F-12: the default report prints export names, not just a count', () => {
    const path = symbolFixture();
    const { io, out } = capture();
    expect(runCli(['inspect', path], io)).toBe(EXIT.ok);
    expect(out.join('\n')).toContain('#2  mySprite');
  });

  it('F-12: --symbols prints the export and import tables; --tags lists the tag index', () => {
    const path = symbolFixture();
    const { io, out } = capture();
    expect(runCli(['inspect', path, '--symbols', '--tags'], io)).toBe(EXIT.ok);
    const text = out.join('\n');
    expect(text).toContain('export  #2  mySprite  (sprite)');
    expect(text).toContain('import  other  <- other.swf');
    expect(text).toContain('tag index');
    // Eight tags: DefineSprite, ShowFrame, End (sprite body), ExportAssets, ImportAssets,
    // PlaceObject2, ShowFrame, End.
    const indexLines = out.filter((line) => /^\s+\d+\s+\d+ \(/.test(line));
    expect(indexLines).toHaveLength(8);
  });

  it('F-12: --json carries symbols/tagIndex only when requested (default output stays stable)', () => {
    const path = symbolFixture();
    const plain = capture();
    expect(runCli(['inspect', path, '--json'], plain.io)).toBe(EXIT.ok);
    const plainSummary = JSON.parse(plain.out.join('\n')) as Record<string, unknown>;
    expect('tagIndex' in plainSummary).toBe(false);
    expect('symbols' in plainSummary).toBe(false);
    expect((plainSummary.exports as readonly { id: number; name: string }[])[0]).toEqual({ id: 2, name: 'mySprite' });

    const full = capture();
    expect(runCli(['inspect', path, '--json', '--symbols', '--tags'], full.io)).toBe(EXIT.ok);
    const summary = JSON.parse(full.out.join('\n')) as {
      tagIndex: readonly unknown[];
      symbols: {
        exports: readonly { id: number; name: string; kind: string }[];
        imports: readonly { name: string; url: string; localId: number }[];
      };
    };
    expect(summary.tagIndex).toHaveLength(8);
    expect(summary.symbols.exports).toEqual([{ id: 2, name: 'mySprite', kind: 'sprite' }]);
    expect(summary.symbols.imports).toEqual([{ name: 'other', url: 'other.swf', localId: 0 }]);
  });

  it('T-MOD-125: --shapes reports the model VectorShape summary and stable geometry digest', () => {
    const plain = capture();
    expect(runCli(['inspect', FIXTURE, '--json'], plain.io)).toBe(EXIT.ok);
    expect('shapes' in (JSON.parse(plain.out.join('\n')) as Record<string, unknown>)).toBe(false);

    const first = capture();
    expect(runCli(['inspect', FIXTURE, '--json', '--shapes'], first.io)).toBe(EXIT.ok);
    const summary = JSON.parse(first.out.join('\n')) as {
      shapes: readonly {
        id: number;
        version: number;
        edgeCount: number;
        fillPathCount: number;
        strokePathCount: number;
        geometrySha256: string;
      }[];
    };
    expect(summary.shapes).toHaveLength(1);
    expect(summary.shapes[0]).toMatchObject({ id: 1, version: 1, edgeCount: 4, fillPathCount: 0, strokePathCount: 1 });
    expect(summary.shapes[0]?.geometrySha256).toMatch(/^[a-f0-9]{64}$/);

    const second = capture();
    expect(runCli(['inspect', FIXTURE, '--json', '--shapes'], second.io)).toBe(EXIT.ok);
    expect(second.out).toEqual(first.out);

    const human = capture();
    expect(runCli(['inspect', FIXTURE, '--shapes'], human.io)).toBe(EXIT.ok);
    expect(human.out.join('\n')).toContain('shapes         1 decoded static VectorShape(s)');
    expect(human.out.join('\n')).toContain('sha256:');
  });
});
