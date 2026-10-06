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
import { Tag, buildMovieModel, openSwf } from '@swf-forge/swf';
import { sha256Hex } from '@swf-forge/swf/node';
import { buildModelDump, dumpJson, type ModelDump } from '../src/dump/model-dump.js';
import { ByteWriter, buildSwf, concat, endTag, showFrames, tag, writeRect } from '@swf-forge/swf/test-support';

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

function emptyFontBody(id: number): Uint8Array {
  const name = new TextEncoder().encode('Demo');
  return new ByteWriter()
    .u16(id)
    .u8(0)
    .u8(0)
    .u8(name.length)
    .bytes(name)
    .u16(0)
    .u16(2) // zero glyphs; CodeTableOffset still spans its own UI16 field
    .toUint8Array();
}

function emptyStaticTextBody(id: number): Uint8Array {
  const writer = new ByteWriter();
  writer.u16(id);
  writeRect(writer, { xMin: 0, xMax: 200, yMin: 0, yMax: 80 });
  writer.bits(0, 1).bits(0, 1).bits(0, 5).align(); // identity TextMatrix
  writer.u8(0).u8(0).u8(0); // zero bit widths and EndOfRecords
  return writer.toUint8Array();
}

function emptyEditTextBody(id: number): Uint8Array {
  const writer = new ByteWriter();
  writer.u16(id);
  writeRect(writer, { xMin: 0, xMax: 200, yMin: 0, yMax: 80 });
  writer.u16(0).text('field');
  return writer.toUint8Array();
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
  it('T-MOD-012: serialized model dumps re-parse and re-serialize byte-identically', () => {
    const bytes = messySwf();
    const file = openSwf(bytes);
    const model = buildMovieModel(file);
    const first = dumpJson(buildModelDump(file, model, sha256Hex(bytes)));
    const parsed = JSON.parse(first) as ModelDump;
    expect(dumpJson(parsed)).toBe(first);
  });

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
    expect(dump.formatVersion).toBe(4);

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
      'scalingGridsShadowed',
      'tabIndexOps',
      'scriptLimits',
      'attributes',
      'metadata',
      'protect',
      'debugger',
      'telemetry',
      'binaryData',
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
      {
        id: 1,
        kind: 'shape',
        tag: 'DefineShape',
        tagCode: 2,
        tagOffset: 5,
        length: 35,
        bounds: { xMin: 2010, xMax: 4910, yMin: 1670, yMax: 4010 },
        vectorShape: {
          version: 1,
          bounds: { xMin: 2010, xMax: 4910, yMin: 1670, yMax: 4010 },
          fillRule: 'evenOdd',
          edgeCount: 4,
          fillPathCount: 0,
          strokePathCount: 1,
          fillStyleCount: 0,
          lineStyleCount: 1,
          geometrySha256: '4b4c6358755154982c959883f4ad065ed7c6ceabcf455eae4b00e29e426ea77b',
        },
        bitmap: null,
        font: null,
        text: null,
        editText: null,
        sound: null,
        alias: null,
        button: null,
        sprite: null,
      },
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

  it('T-MOD-017: dump --import resolves a published URL and serializes alias provenance', () => {
    const sourceBytes = buildSwf({
      version: 7,
      body: concat(
        tag(Tag.DefineShape, shapeBody(7)),
        tag(Tag.ExportAssets, concat(u16(1), u16(7), asciiZ('Symbol'))),
        showFrames(1),
        endTag(),
      ),
      frameCount: 1,
    });
    const source = write('link-source.swf', sourceBytes);
    const url = 'https://cdn.example/Link.swf';
    const main = write(
      'link-main.swf',
      buildSwf({
        version: 7,
        body: concat(
          tag(Tag.ImportAssets, concat(asciiZ(url), u16(1), u16(9), asciiZ('Symbol'))),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    const { dump, exit } = loadDump(['dump', main, '--import', `${url}=${source}`, '--json']);
    expect(exit).toBe(EXIT.ok);
    expect((dump.control as { imports: Record<string, unknown>[] }).imports[0]).toMatchObject({
      url,
      name: 'Symbol',
      localId: 9,
      applied: true,
      sourceId: 7,
    });
    const imported = (dump.dictionary as Record<string, unknown>[]).find((entry) => entry.id === 9);
    expect(imported).toMatchObject({ kind: 'imported', alias: { sourceId: 7 } });
    expect(imported).not.toHaveProperty('bytes');
    expect(JSON.stringify(dump)).not.toContain(source);
  });

  it('T-MOD-041: model dumps expose sound metadata and payload digest without inlining compressed bytes', () => {
    const soundBody = concat(u16(9), Uint8Array.from([0x3a, 2, 0, 0, 0, 0x11, 0x22, 0x33, 0x44]));
    const path = write(
      'sound-summary.swf',
      buildSwf({ version: 8, body: concat(tag(Tag.DefineSound, soundBody), showFrames(1), endTag()), frameCount: 1 }),
    );
    const first = loadDump(['dump', path, '--json']);
    expect(first.exit).toBe(EXIT.ok);
    const character = (first.dump.dictionary as { sound: Record<string, unknown> | null }[])[0];
    expect(character?.sound).toMatchObject({
      format: 3,
      rateCode: 2,
      sampleRate: 22050,
      bitsPerSample: 16,
      channels: 1,
      sampleCount: 2,
      dataBytes: 4,
      dataSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(first.text).not.toContain('"data":');
    expect(loadDump(['dump', path, '--json']).text).toBe(first.text);
  });

  it('T-MOD-044: version-4 dictionary summarizes embedded fonts and typed text fields', () => {
    const source = write(
      'text-summary-v4.swf',
      buildSwf({
        version: 10,
        body: concat(
          tag(Tag.DefineFont2, emptyFontBody(31)),
          tag(Tag.DefineText, emptyStaticTextBody(32)),
          tag(Tag.DefineEditText, emptyEditTextBody(33)),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    const result = loadDump(['dump', source, '--json']);
    expect(result.exit).toBe(EXIT.ok);
    expect(result.dump.formatVersion).toBe(4);
    const dictionary = result.dump.dictionary as Record<string, unknown>[];
    expect(dictionary[0]).toMatchObject({
      id: 31,
      font: {
        version: 2,
        name: 'Demo',
        unitsPerEm: 1024,
        glyphCount: 0,
        codeTableSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      },
      text: null,
      editText: null,
    });
    expect(dictionary[1]).toMatchObject({
      id: 32,
      font: null,
      text: { version: 1, glyphBits: 0, advanceBits: 0, runs: [] },
      editText: null,
    });
    expect(dictionary[2]).toMatchObject({
      id: 33,
      font: null,
      text: null,
      editText: { variableName: 'field', initialText: null, flags: { hasText: false, html: false } },
    });
    expect(result.text).not.toContain('"shape":');
  });

  it('T-MOD-043: version-4 bitmap entries expose payload digests without inlining image bytes', () => {
    const payload = Uint8Array.from([0xff, 0xd8, 1, 2, 3, 0xff, 0xd9]);
    const source = write(
      'bitmap-summary-v3.swf',
      buildSwf({
        version: 10,
        body: concat(tag(Tag.DefineBitsJPEG2, concat(u16(12), payload)), showFrames(1), endTag()),
        frameCount: 1,
      }),
    );
    const result = loadDump(['dump', source, '--json']);
    expect(result.exit).toBe(EXIT.ok);
    const character = (result.dump.dictionary as { bitmap: Record<string, unknown> | null }[])[0];
    expect(character?.bitmap).toMatchObject({
      source: 'jpeg2',
      payloadBytes: payload.length,
      payloadSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      alphaBytes: 0,
      alphaSha256: null,
      declaredSize: null,
      bitmapFormat: null,
    });
    expect(result.text).not.toContain('"payload":');
    expect(result.text).not.toContain('"alpha":');
  });

  it('T-MOD-042: version-3 dump records sound events and exact stream-block sample offsets', () => {
    const frame = new Uint8Array(418);
    frame.set([0xff, 0xfb, 0x92, 0xc0]);
    const defineSound = concat(u16(10), Uint8Array.from([0x3e, 2, 0, 0, 0, 0x34, 0x12, 0x78, 0x56]));
    const startSound = concat(u16(10), Uint8Array.from([0x08, 1, 44, 0, 0, 0, 100, 0, 0, 0]));
    const streamHead = Uint8Array.from([0x0e, 0x2e, 0x80, 0x04, 0, 0]);
    const streamBlock = concat(u16(1152), u16(0), frame);
    const path = write(
      'sound-timeline-v3.swf',
      buildSwf({
        version: 10,
        body: concat(
          tag(Tag.DefineSound, defineSound),
          tag(Tag.StartSound, startSound),
          tag(Tag.SoundStreamHead2, streamHead),
          tag(Tag.SoundStreamBlock, streamBlock),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    const result = loadDump(['dump', path, '--json']);
    expect(result.exit).toBe(EXIT.ok);
    expect(result.dump.formatVersion).toBe(4);
    const timeline = result.dump.timeline as {
      frames: { soundEvents: Record<string, unknown>[] }[];
      streamSoundSpans: Record<string, unknown>[];
    };
    expect(timeline.frames[0]?.soundEvents[0]).toMatchObject({
      soundId: 10,
      info: { envelope: [{ position44: 44, leftLevel: 50, rightLevel: 50 }] },
    });
    expect(timeline.streamSoundSpans[0]).toMatchObject({
      format: 2,
      sampleRate: 44100,
      channels: 1,
      latencySeek: 0,
      sampleCount: 1152,
      blocks: [{ sampleOffset: 0, sampleCount: 1152, seekSamples: 0, dataLength: 418 }],
    });
    expect(result.text).toBe(loadDump(['dump', path, '--json']).text);
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
