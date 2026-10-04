/**
 * Model assembly — `IMPL-030` §7/§8 and `IMPL-040` §5.
 *
 * The sprite fixture is built byte by byte so the two structural rules with teeth are exercised:
 * a definition tag inside a sprite must not enter the dictionary (`SF0128`), and a tag outside
 * Chapter 13's sprite list is reported once per kind (`SF0129`) while still decoding.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { Tag, buildMovieModel, openSwf } from '@swf-forge/swf';
import { buildSwf, concat, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

const FIXTURE = fileURLToPath(new URL('../../../fixtures/appendix-a.swf', import.meta.url));

function u16(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]);
}

/** NUL-terminated ASCII, for tag bodies that carry strings. */
function asciiZ(text: string): Uint8Array {
  return Uint8Array.from([...text].map((ch) => ch.charCodeAt(0)).concat(0));
}

/** DefineShape-ish body: a character id and two filler bytes (the model never decodes it). */
function shapeBody(id: number): Uint8Array {
  return Uint8Array.from([id & 0xff, (id >>> 8) & 0xff, 0x00, 0x00]);
}

/** `PlaceObject2` with only `HasCharacter` (an add at that depth). */
function placeBody(depth: number, characterId: number): Uint8Array {
  return Uint8Array.from([0x02, ...u16(depth), ...u16(characterId)]);
}

function spriteSwf(): Uint8Array {
  const spriteBody = concat(
    u16(5), // SpriteID
    u16(2), // declared FrameCount (one ShowFrame only => SF0023)
    tag(Tag.DefineShape, shapeBody(9)), // definition inside a sprite => SF0128, not in the dictionary
    tag(Tag.PlaceObject3, Uint8Array.from([0x00, 0x00, 0x0a, 0x00])), // not in Ch.13's list => SF0129
    tag(Tag.PlaceObject2, placeBody(1, 9)),
    tag(Tag.FrameLabel, asciiZ('intro')),
    tag(Tag.ShowFrame),
    endTag(),
  );
  const body = concat(
    tag(Tag.DefineSprite, spriteBody),
    tag(Tag.PlaceObject2, placeBody(1, 5)),
    showFrames(1),
    endTag(),
  );
  return buildSwf({ version: 8, body, frameCount: 1 });
}

describe('sprite handling', () => {
  it('keeps definitions inside a sprite out of the dictionary and reports SF0128', () => {
    const file = openSwf(spriteSwf());
    expect(file.definitions.map((d) => d.id)).toEqual([5]);
    expect(file.tagIndex.tags.filter((t) => t.inSprite === 5).map((t) => t.code)).toEqual([
      Tag.DefineShape,
      Tag.PlaceObject3,
      Tag.PlaceObject2,
      Tag.FrameLabel,
      Tag.ShowFrame,
      Tag.End,
    ]);
    expect(file.sink.codes()).toContain('SF0128');
    expect(file.sink.codes()).toContain('SF0129');
  });

  it('T-MOD-601 pads the sprite timeline to its declared FrameCount', () => {
    const file = openSwf(spriteSwf());
    const movie = buildMovieModel(file);
    const sprite = movie.characters.get(5)?.sprite;
    expect(sprite).toBeDefined();
    expect(sprite?.declaredFrameCount).toBe(2);
    expect(sprite?.characterName).toBe('sprite_5');
    expect(sprite?.timeline.frames.length).toBe(2);
    expect(sprite?.timeline.observedFrameCount).toBe(1);
    expect(sprite?.timeline.labels.get('intro')).toBe(0);
    const ops = sprite?.timeline.frames[0]?.ops ?? [];
    expect(ops.map((op) => op.kind)).toEqual(['place', 'place']);
    expect(ops[1]).toMatchObject({ kind: 'place', depth: 1, characterId: 9 });
    expect(movie.characters.get(9)?.kind).toBe('missing');
    expect(file.sink.codes()).toContain('SF0110');
  });

  it('reports the sprite frame-count mismatch (SF0023) and pads to the declared count', () => {
    const file = openSwf(spriteSwf());
    const mismatch = file.sink.list().find((d) => d.code === 'SF0023');
    expect(mismatch?.message).toContain('sprite 5');
    const movie = buildMovieModel(file);
    expect(movie.mainTimeline.frames.length).toBe(1);
    expect(movie.mainTimeline.frames[0]?.ops[0]).toMatchObject({ kind: 'place', depth: 1, characterId: 5 });
  });

  it('exports the sprite under its export name through the dictionary view', () => {
    const exported = concat(
      tag(Tag.DefineSprite, concat(u16(7), u16(1), tag(Tag.ShowFrame), endTag())),
      tag(Tag.ExportAssets, concat(u16(1), u16(7), asciiZ('Hero'))),
      tag(Tag.ShowFrame),
      endTag(),
    );
    const movie = buildMovieModel(openSwf(buildSwf({ version: 8, body: exported, frameCount: 1 })));
    expect(movie.exported.get('Hero')).toBe(7);
    expect(movie.characters.get(7)?.sprite?.characterName).toBe('Hero');
  });
});

describe('movie model', () => {
  it('T-MOD-021 detects FileAttributes AS3 and DoABC independently as SF1000', () => {
    const as3Only = openSwf(
      buildSwf({
        version: 10,
        body: concat(tag(Tag.FileAttributes, Uint8Array.from([8, 0, 0, 0])), endTag()),
        frameCount: 0,
      }),
    );
    buildMovieModel(as3Only);
    expect(as3Only.diagnostics.filter((diagnostic) => diagnostic.code === 'SF1000')).toHaveLength(1);

    const doAbcOnly = openSwf(
      buildSwf({
        version: 10,
        body: concat(tag(Tag.DoABC, Uint8Array.from([0, 0, 0, 0, 0])), endTag()),
        frameCount: 0,
      }),
    );
    buildMovieModel(doAbcOnly);
    expect(doAbcOnly.diagnostics.filter((diagnostic) => diagnostic.code === 'SF1000')).toHaveLength(1);

    const both = openSwf(
      buildSwf({
        version: 10,
        body: concat(
          tag(Tag.FileAttributes, Uint8Array.from([8, 0, 0, 0])),
          tag(Tag.DoABC, Uint8Array.from([0, 0, 0, 0, 0])),
          endTag(),
        ),
        frameCount: 0,
      }),
    );
    buildMovieModel(both);
    expect(both.diagnostics.filter((diagnostic) => diagnostic.code === 'SF1000')).toHaveLength(2);
  });

  it('T-MOD-025 reports SetTabIndex at an empty depth and keeps the op', () => {
    const emptyBody = concat(tag(Tag.SetTabIndex, Uint8Array.from([1, 0, 3, 0])), showFrames(1), endTag());
    const emptyFile = openSwf(buildSwf({ version: 7, body: emptyBody, frameCount: 1 }));
    const emptyMovie = buildMovieModel(emptyFile);
    expect(emptyMovie.mainTimeline.frames[0]?.ops).toEqual([
      { kind: 'tabIndex', index: 0, depth: 1, tabIndex: 3, tagOffset: 2 },
    ]);
    expect(emptyFile.sink.codes()).toContain('SF0166');

    const placedBody = concat(
      tag(Tag.DefineShape, shapeBody(1)),
      tag(Tag.PlaceObject2, placeBody(1, 1)),
      tag(Tag.SetTabIndex, Uint8Array.from([1, 0, 3, 0])),
      showFrames(1),
      endTag(),
    );
    const placedFile = openSwf(buildSwf({ version: 7, body: placedBody, frameCount: 1 }));
    buildMovieModel(placedFile);
    expect(placedFile.sink.codes()).not.toContain('SF0166');
  });

  it('models the appendix fixture: stage, background, one frame, one character', () => {
    const movie = buildMovieModel(openSwf(new Uint8Array(readFileSync(FIXTURE))));
    expect(movie.frameCount).toBe(1);
    expect(movie.stage).toEqual({ widthTwips: 11000, heightTwips: 8000, frameRate: 12 * 256 });
    expect(movie.background).toBe(0xffffff);
    expect(movie.control.backgroundSource).toBe('tag');
    expect(movie.control.backgroundChanges).toEqual([{ frame: 0, rgb: 0xffffff }]);
    expect(movie.mainTimeline.frames.length).toBe(1);
    expect(movie.mainTimeline.frames[0]?.ops.map((op) => op.kind)).toEqual(['place']);
    expect([...movie.characters.keys()]).toEqual([1]);
    expect(movie.characters.get(1)?.tagName).toBe('DefineShape');
    expect(movie.exported.size).toBe(0);
    expect(movie.metadata).toEqual({});
  });

  it('uses sha256 for the id when the caller supplies one', () => {
    const file = openSwf(new Uint8Array(readFileSync(FIXTURE)), { sha256: 'abc123' });
    expect(buildMovieModel(file).id).toBe('sha256:abc123');
  });

  it('is deterministic: the same bytes produce the same fallback id', () => {
    const bytes = new Uint8Array(readFileSync(FIXTURE));
    const a = buildMovieModel(openSwf(bytes)).id;
    const b = buildMovieModel(openSwf(bytes)).id;
    expect(a).toBe(b);
    expect(a.startsWith('fnv1a64:')).toBe(true);
  });

  it('pads the main timeline to the declared frame count', () => {
    const body = concat(showFrames(1), endTag());
    const movie = buildMovieModel(openSwf(buildSwf({ version: 6, body, frameCount: 3 })));
    expect(movie.mainTimeline.observedFrameCount).toBe(1);
    expect(movie.mainTimeline.frames[1]?.ops).toEqual([]);
    const mismatch = movie.mainTimeline.declaredFrameCount;
    expect(mismatch).toBe(3);
  });

  it('collects scenes, labels, script limits and metadata from control tags', () => {
    const sceneData = concat(
      Uint8Array.from([2]), // SceneCount (EncodedU32)
      Uint8Array.from([0]),
      asciiZ('Intro'),
      Uint8Array.from([1]),
      asciiZ('Level 1'),
      Uint8Array.from([1]), // FrameLabelCount
      Uint8Array.from([1]),
      asciiZ('start'),
    );
    const body = concat(
      tag(Tag.SetBackgroundColor, Uint8Array.from([0x10, 0x20, 0x30])),
      tag(Tag.ScriptLimits, Uint8Array.from([0x00, 0x01, 0x0f, 0x00])),
      tag(Tag.DefineSceneAndFrameLabelData, sceneData),
      tag(Tag.Metadata, asciiZ('<xmp/>')),
      tag(Tag.FileAttributes, Uint8Array.from([0x10, 0x00, 0x00, 0x00])),
      tag(Tag.ShowFrame),
      endTag(),
    );
    const file = openSwf(buildSwf({ version: 8, body, frameCount: 1 }));
    const movie = buildMovieModel(file);
    expect(movie.background).toBe(0x102030);
    expect(movie.control.scenes).toEqual([
      { name: 'Intro', frameOffset: 0 },
      { name: 'Level 1', frameOffset: 1 },
    ]);
    expect(movie.control.sceneFrameRemap).toEqual([
      { sceneIndex: 0, frameOffset: 0, frameCount: 1 },
      { sceneIndex: 1, frameOffset: 1, frameCount: 0 },
    ]);
    expect(movie.control.labels.get('start')?.[0]).toEqual({ frame: 1, namedAnchor: false });
    expect(movie.control.scriptLimits).toEqual({ maxRecursionDepth: 256, scriptTimeout: 15 });
    expect(movie.metadata).toEqual({ xmp: '<xmp/>' });
    expect(movie.control.attributes?.hasMetadata).toBe(true);
    expect(file.sink.codes()).not.toContain('SF0163');
  });

  it('reports a Metadata/HasMetadata disagreement (SF0163)', () => {
    const body = concat(tag(Tag.Metadata, asciiZ('<xmp/>')), tag(Tag.ShowFrame), endTag());
    const file = openSwf(buildSwf({ version: 8, body, frameCount: 1 }));
    buildMovieModel(file);
    expect(file.sink.codes()).toContain('SF0163');
  });
});

describe('movie model — rectangles in the header', () => {
  it('reports the stage in twips from the header rect', () => {
    const movie = buildMovieModel(
      openSwf(
        buildSwf({
          version: 6,
          frameSize: { xMin: 0, xMax: 8000, yMin: 0, yMax: 6000 },
          body: concat(showFrames(1), endTag()),
          frameCount: 1,
        }),
      ),
    );
    expect(movie.stage.widthTwips).toBe(8000);
    expect(movie.stage.heightTwips).toBe(6000);
    expect(movie.stage.frameRate).toBe(12 * 256);
  });
});
