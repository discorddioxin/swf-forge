/**
 * `forge-decompile dump` — the model dump verb (`TECH-SPEC` §5.2, `IMPL-040` §3.6).
 *
 * Tests `T-MOD-037`…`T-MOD-040`: the documented field order, sorted maps and byte-determinism
 * (`R045`/`R046`), the `--out` contract (`R048`), the appendix fixture's structure and the dual
 * `SetTabIndex` emission (`R047`), and `CMP-R029`'s exit codes.
 *
 * The second fixture is built byte by byte so every map in the dump has more than one entry and is
 * declared *out* of order: characters 7/3/5 and exports `zebra`/`apple`/`mango`.
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';

import { EXIT, exitForDiagnostics, runCli, type CliIo } from '@swf-forge/decompiler';
import { Tag } from '@swf-forge/swf';
import { buildSwf, concat, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

const FIXTURE = fileURLToPath(new URL('../../../fixtures/appendix-a.swf', import.meta.url));
const WORK = mkdtempSync(join(tmpdir(), 'swf-forge-dump-'));
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

/** Runs the verb and parses its JSON. */
function loadDump(args: readonly string[]): { dump: Record<string, unknown>; exit: number; text: string } {
  const captured = capture();
  const exit = runCli(args, captured.io);
  const text = captured.out.join('\n');
  return { dump: JSON.parse(text) as Record<string, unknown>, exit, text };
}

function u16(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]);
}

function asciiZ(text: string): Uint8Array {
  return Uint8Array.from([...text].map((ch) => ch.charCodeAt(0)).concat(0));
}

/** DefineShape-ish body: a character id and filler (the model never decodes the shape here). */
function shapeBody(id: number): Uint8Array {
  return Uint8Array.from([id & 0xff, (id >>> 8) & 0xff, 0x00, 0x00]);
}

/** `PlaceObject2` with `HasCharacter` only. */
function placeBody(depth: number, characterId: number): Uint8Array {
  return Uint8Array.from([0x02, ...u16(depth), ...u16(characterId)]);
}

/** Characters 7/3/5 declared out of id order, exports out of name order, one tab-index op. */
function messySwf(): Uint8Array {
  const body = concat(
    tag(Tag.DefineShape, shapeBody(7)),
    tag(Tag.DefineShape, shapeBody(3)),
    tag(Tag.DefineShape, shapeBody(5)),
    tag(Tag.ExportAssets, concat(u16(3), u16(7), asciiZ('zebra'), u16(5), asciiZ('apple'), u16(3), asciiZ('mango'))),
    tag(Tag.SetTabIndex, concat(u16(4), u16(2))),
    tag(Tag.PlaceObject2, placeBody(1, 3)),
    showFrames(1),
    endTag(),
  );
  return buildSwf({ version: 8, body, frameCount: 1 });
}

const MESSY = write('messy.swf', messySwf());

describe('forge-decompile dump', () => {
  it('T-MOD-037: emits the documented order, sorts every map, and is byte-identical on every run', () => {
    const { dump, exit } = loadDump(['dump', MESSY, '--json']);
    expect(exit).toBe(EXIT.ok);
    expect(Object.keys(dump)).toEqual([
      'format',
      'formatVersion',
      'source',
      'model',
      'dictionary',
      'timeline',
      'initActions',
      'control',
      'diagnostics',
    ]);
    expect(dump.format).toBe('swf-forge/model-dump');
    expect(dump.formatVersion).toBe(1);

    const control = dump.control as Record<string, unknown>;
    expect(Object.keys(control)).toEqual([
      'background',
      'backgroundSource',
      'backgroundChanges',
      'scenes',
      'sceneFrameRemap',
      'labels',
      'exports',
      'rootClassName',
      'imports',
      'scalingGrids',
      'tabIndexOps',
      'scriptLimits',
      'attributes',
      'metadata',
    ]);

    // Declared out of order on purpose: ids ascending, names alphabetical.
    expect((dump.dictionary as { id: number }[]).map((entry) => entry.id)).toEqual([3, 5, 7]);
    expect((control.exports as { name: string }[]).map((entry) => entry.name)).toEqual(['apple', 'mango', 'zebra']);

    const runs = Array.from({ length: 5 }, () => loadDump(['dump', MESSY, '--json']).text);
    expect(new Set(runs).size).toBe(1);
    expect(runs[0]).not.toContain(WORK);
    expect(runs[0]).not.toContain(MESSY);
  });

  it('T-MOD-029 preserves same-frame FrameLabel order in control.labels and keeps the timeline map sorted', () => {
    const body = concat(tag(Tag.FrameLabel, asciiZ('z')), tag(Tag.FrameLabel, asciiZ('a')), showFrames(1), endTag());
    const path = write('ordered-labels.swf', buildSwf({ version: 8, body, frameCount: 1 }));
    const { dump } = loadDump(['dump', path, '--json']);
    const control = dump.control as { labels: { name: string; frame: number }[] };
    const timeline = dump.timeline as { labels: { name: string; frame: number }[] };
    expect(control.labels).toEqual([
      { name: 'z', frame: 0, namedAnchor: false },
      { name: 'a', frame: 0, namedAnchor: false },
    ]);
    expect(timeline.labels).toEqual([
      { name: 'a', frame: 0, namedAnchor: false },
      { name: 'z', frame: 0, namedAnchor: false },
    ]);
  });

  it('T-MOD-038: --out writes exactly model.json, byte-identical to --json', () => {
    const dir = join(WORK, 'out-a');
    const captured = capture();
    expect(runCli(['dump', FIXTURE, '--out', dir], captured.io)).toBe(EXIT.ok);
    expect(readdirSync(dir)).toEqual(['model.json']);
    expect(captured.out.join('\n')).toContain('model.json');

    const json = capture();
    expect(runCli(['dump', FIXTURE, '--json'], json.io)).toBe(EXIT.ok);
    const written = readFileSync(join(dir, 'model.json'), 'utf8');
    expect(written).toBe(`${json.out.join('\n')}\n`);
    expect(written.endsWith('}\n')).toBe(true);

    // `--out=<dir>` parses the same way and produces the same bytes.
    const dir2 = join(WORK, 'out-b');
    expect(runCli(['dump', FIXTURE, `--out=${dir2}`], capture().io)).toBe(EXIT.ok);
    expect(readFileSync(join(dir2, 'model.json'), 'utf8')).toBe(written);
  });

  it('T-MOD-039: dumps the appendix fixture, and a SetTabIndex op appears in both places', () => {
    const { dump } = loadDump(['dump', FIXTURE, '--json']);
    expect(dump.dictionary).toEqual([
      { id: 1, tag: 'DefineShape', tagCode: 2, tagOffset: 5, length: 35, sprite: null },
    ]);

    const timeline = dump.timeline as {
      declaredFrameCount: number;
      observedFrameCount: number;
      frames: { index: number; label: string | null; ops: Record<string, unknown>[] }[];
      labels: unknown[];
    };
    expect(timeline.declaredFrameCount).toBe(1);
    expect(timeline.observedFrameCount).toBe(1);
    expect(timeline.frames).toHaveLength(1);
    expect(timeline.frames[0]?.index).toBe(0);
    expect(timeline.labels).toEqual([]);
    expect(timeline.frames[0]?.ops[0]).toMatchObject({
      kind: 'place',
      tag: 'PlaceObject2',
      characterId: 1,
      depth: 1,
      move: false,
    });

    const source = dump.source as { stage: Record<string, number> };
    expect(source.stage).toMatchObject({ widthPx: 550, heightPx: 400, widthTwips: 11000, heightTwips: 8000 });
    expect(dump.model).toMatchObject({ background: 0xffffff, backgroundSource: 'tag' });
    expect((dump.diagnostics as { errors: number }).errors).toBe(0);

    // The human rendering of the same object, so the default mode is exercised too.
    const human = capture();
    expect(runCli(['dump', FIXTURE], human.io)).toBe(EXIT.ok);
    const text = human.out.join('\n');
    expect(text).toContain('#1  DefineShape');
    expect(text).toContain('frame 0');
    expect(text).toContain('place #1 DefineShape at depth 1');

    // SetTabIndex is serialised twice by design: once in the frame's ops, once in the control block.
    const messy = loadDump(['dump', MESSY, '--json']);
    const ops = (messy.dump.timeline as { frames: { ops: Record<string, unknown>[] }[] }).frames[0]?.ops ?? [];
    const tabIndexOps = ops.filter((op) => op.kind === 'tabIndex');
    expect(tabIndexOps).toHaveLength(1);
    expect(tabIndexOps[0]).toMatchObject({ depth: 4, tabIndex: 2 });
    expect((messy.dump.control as { tabIndexOps: unknown[] }).tabIndexOps).toEqual(tabIndexOps);
  });

  it('T-MOD-040: follows CMP-R029 for exit codes', () => {
    const missing = capture();
    expect(runCli(['dump', join(WORK, 'nope.swf')], missing.io)).toBe(EXIT.unreadable);
    expect(missing.err.join('\n')).toContain('cannot read');

    const notSwf = write('not-a-swf.bin', Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 4, 5]));
    expect(runCli(['dump', notSwf], capture().io)).toBe(EXIT.unreadable);

    // A zero-width FrameSize is an error-severity diagnostic (`SF0029`), not an unreadable file.
    const zeroStage = write(
      'zero-stage.swf',
      buildSwf({
        frameSize: { xMin: 0, xMax: 0, yMin: 0, yMax: 8000 },
        body: concat(showFrames(1), endTag()),
      }),
    );
    const failed = capture();
    expect(runCli(['dump', zeroStage], failed.io)).toBe(EXIT.failed);
    expect(failed.out.join('\n')).toContain('SF0029');

    expect(runCli(['dump', FIXTURE], capture().io)).toBe(EXIT.ok);

    // AVM2 content → 3 is the shared mapper's rule; `WP-040-06`/`T-MOD-021` owns the decoder signals.
    expect(exitForDiagnostics([{ code: 'SF1000', severity: 'error' }])).toBe(EXIT.avm2);
    expect(exitForDiagnostics([{ code: 'SF0001', severity: 'error' }])).toBe(EXIT.unreadable);
    expect(exitForDiagnostics([{ code: 'SF0029', severity: 'error' }])).toBe(EXIT.failed);
    expect(exitForDiagnostics([])).toBe(EXIT.ok);
  });
});
