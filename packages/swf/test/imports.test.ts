/**
 * Multi-movie ImportAssets alias linking — T-MOD-017/018/026 (`IMPL-040` §3.3).
 */

import { describe, expect, it } from 'vitest';

import { Tag, buildMovieModel, openSwf } from '@swf-forge/swf';
import { buildSwf, concat, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

function u16(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]);
}

function asciiZ(value: string): Uint8Array {
  return Uint8Array.from([...value].map((char) => char.charCodeAt(0)).concat(0));
}

function exportAsset(name: string, id: number): Uint8Array {
  return tag(Tag.ExportAssets, concat(u16(1), u16(id), asciiZ(name)));
}

function importAssets(url: string, name: string, id: number, code: number = Tag.ImportAssets): Uint8Array {
  const extra = code === Tag.ImportAssets2 ? Uint8Array.of(1, 0) : new Uint8Array(0);
  return tag(code, concat(asciiZ(url), extra, u16(1), u16(id), asciiZ(name)));
}

function movie(tags: readonly Uint8Array[], version = 7): ReturnType<typeof openSwf> {
  return openSwf(buildSwf({ version, body: concat(...tags, showFrames(1), endTag()), frameCount: 1 }));
}

describe('external symbol aliases', () => {
  it('T-MOD-017 resolves an export against the supplied movie set without copying its payload', () => {
    const source = movie([tag(Tag.DefineShape, u16(7)), exportAsset('Symbol', 7)]);
    const main = movie([
      importAssets('https://cdn.example/Source.swf', 'Symbol', 9),
      tag(Tag.PlaceObject2, concat(Uint8Array.of(0x02), u16(1), u16(9))),
    ]);
    const model = buildMovieModel(main, {
      imports: new Map([['https://cdn.example/Source.swf', source]]),
    });
    const entry = model.control.imports[0];
    expect(entry).toMatchObject({
      url: 'https://cdn.example/Source.swf',
      name: 'Symbol',
      localId: 9,
      applied: true,
      sourceMovieId: buildMovieModel(source).id,
      sourceId: 7,
    });
    expect(model.characters.get(9)).toMatchObject({
      id: 9,
      kind: 'imported',
      alias: { sourceMovieId: buildMovieModel(source).id, sourceId: 7 },
      bytes: null,
      sprite: null,
      button: null,
    });
    expect(source.definitions.map((definition) => definition.id)).toEqual([7]);
    expect(main.sink.codes()).not.toContain('SF0150');
  });

  it('T-MOD-017 leaves unresolved aliases unapplied and creates a shared missing placeholder', () => {
    const main = movie([
      importAssets('missing.swf', 'Absent', 9),
      tag(Tag.PlaceObject2, concat(Uint8Array.of(0x02), u16(1), u16(9))),
    ]);
    const model = buildMovieModel(main);
    expect(model.control.imports[0]).toMatchObject({ applied: false, sourceMovieId: null, sourceId: null });
    expect(model.characters.get(9)?.kind).toBe('missing');
    expect(main.sink.codes()).toContain('SF0150');
    expect(main.sink.codes()).toContain('SF0110');
  });

  it('T-MOD-018 follows transitive aliases to a terminal movie and preserves the source id', () => {
    const terminal = movie([tag(Tag.DefineShape, u16(7)), exportAsset('primitive', 7)]);
    const middle = movie([importAssets('C.swf', 'primitive', 2), exportAsset('forwarded', 2)]);
    const main = movie([importAssets('B.swf', 'forwarded', 1)]);
    const model = buildMovieModel(main, {
      imports: new Map([
        ['B.swf', middle],
        ['C.swf', terminal],
      ]),
    });
    expect(model.control.imports[0]).toMatchObject({
      applied: true,
      sourceMovieId: buildMovieModel(terminal).id,
      sourceId: 7,
    });
    expect(model.characters.get(1)?.alias).toEqual({ sourceMovieId: buildMovieModel(terminal).id, sourceId: 7 });
    expect(model.characters.get(1)?.bytes).toBeNull();
    expect(main.sink.codes()).not.toContain('SF0150');
  });

  it('T-MOD-018 detects an A→B→A alias cycle and leaves the local alias unapplied', () => {
    const movieA = movie([tag(Tag.DefineShape, u16(7)), exportAsset('Asym', 7), importAssets('B.swf', 'Bsym', 1)]);
    const movieB = movie([importAssets('A.swf', 'Asym', 2), exportAsset('Bsym', 2)]);
    const model = buildMovieModel(movieA, {
      imports: new Map([
        ['A.swf', movieA],
        ['B.swf', movieB],
      ]),
    });
    expect(model.control.imports[0]).toMatchObject({ applied: false, sourceMovieId: null, sourceId: null });
    expect(model.characters.get(1)?.kind).toBe('missing');
    expect(movieA.sink.codes()).toContain('SF0155');
  });

  it('T-MOD-026 keeps deprecated ImportAssets (57) inert in SWF 8+ while ImportAssets2 can resolve', () => {
    const source = movie([tag(Tag.DefineShape, u16(7)), exportAsset('Symbol', 7)]);
    const oldForm = movie([importAssets('Source.swf', 'Symbol', 1)], 8);
    const oldModel = buildMovieModel(oldForm, { imports: new Map([['Source.swf', source]]) });
    expect(oldModel.control.imports[0]?.applied).toBe(false);
    expect(oldForm.sink.codes()).toContain('SF0161');
    expect(oldForm.sink.codes()).not.toContain('SF0150');

    const newForm = movie([importAssets('Source.swf', 'Symbol', 2, Tag.ImportAssets2)], 8);
    const newModel = buildMovieModel(newForm, { imports: new Map([['Source.swf', source]]) });
    expect(newModel.control.imports[0]?.applied).toBe(true);
  });
});
