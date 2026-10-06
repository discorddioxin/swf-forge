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
import { ByteWriter, buildSwf, concat, endTag, showFrames, tag, writeRect } from '@swf-forge/swf/test-support';

const FIXTURE = fileURLToPath(new URL('../../../fixtures/appendix-a.swf', import.meta.url));

function u16(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]);
}

/** NUL-terminated ASCII, for tag bodies that carry strings. */
function asciiZ(text: string): Uint8Array {
  return Uint8Array.from([...text].map((ch) => ch.charCodeAt(0)).concat(0));
}

/** A minimal valid DefineShape body; model assembly now decodes static vector geometry. */
function shapeBody(id: number): Uint8Array {
  const writer = new ByteWriter();
  writer.u16(id);
  writeRect(writer, { xMin: 0, xMax: 100, yMin: 0, yMax: 100 });
  writer.u8(0).u8(0).bits(0, 4).bits(0, 4).bits(0, 6).align();
  return writer.toUint8Array();
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

  it('T-MOD-601 / T-SWF-007 (referenced-but-undefined): pads the sprite timeline to its declared FrameCount; an undefined character is a missing placeholder with SF0110', () => {
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

  it('T-MOD-603 records independent main and sprite stream-sound spans', () => {
    const sprite = tag(
      Tag.DefineSprite,
      concat(
        u16(5),
        u16(1),
        tag(Tag.SoundStreamHead, Uint8Array.of(0)),
        tag(Tag.SoundStreamBlock, Uint8Array.of(1, 2)),
        tag(Tag.ShowFrame),
        endTag(),
      ),
    );
    const body = concat(
      sprite,
      tag(Tag.SoundStreamHead, Uint8Array.of(0)),
      tag(Tag.SoundStreamBlock, Uint8Array.of(3, 4)),
      showFrames(1),
      endTag(),
    );
    const model = buildMovieModel(openSwf(buildSwf({ version: 8, body, frameCount: 1 })));
    const mainSpan = model.mainTimeline.streamSoundSpans[0];
    const spriteTimeline = model.characters.get(5)?.sprite?.timeline;
    const spriteSpan = spriteTimeline?.streamSoundSpans[0];
    expect(model.mainTimeline.streamSoundSpans).toHaveLength(1);
    expect(mainSpan?.headTag.code).toBe(Tag.SoundStreamHead);
    expect(mainSpan?.blockTags).toHaveLength(1);
    expect(spriteTimeline?.streamSoundSpans).toHaveLength(1);
    expect(spriteSpan?.headTag.inSprite).toBe(5);
    expect(spriteSpan?.blockTags).toHaveLength(1);
  });

  it('T-MOD-011: models an empty sprite as a zero-frame timeline', () => {
    const sprite = tag(Tag.DefineSprite, concat(u16(5), u16(0), endTag()));
    const file = openSwf(buildSwf({ version: 8, body: concat(sprite, showFrames(1), endTag()), frameCount: 1 }));
    const model = buildMovieModel(file);
    expect(model.characters.get(5)?.sprite?.timeline.frames).toEqual([]);
    expect(model.characters.get(5)?.sprite?.declaredFrameCount).toBe(0);
    expect(file.sink.codes()).not.toContain('SF0173');
  });

  it('T-MOD-604 walks the Appendix A PlaceObject2 (short header, flags, depth, character, empty matrix)', () => {
    const file = openSwf(new Uint8Array(readFileSync(FIXTURE)));
    const ref = file.tagIndex.tags.find((t) => t.code === Tag.PlaceObject2);
    expect(ref).toBeDefined();
    // Short header `86 06` little-endian: word 0x0686 = code 26 (PlaceObject2), length 6.
    const word = (file.body[ref!.headerOffset] ?? 0) | ((file.body[ref!.headerOffset + 1] ?? 0) << 8);
    expect(word >>> 0).toBe(0x0686);
    expect(ref!.longHeader).toBe(false);
    expect(ref!.length).toBe(6);
    // Body: flags UI8, depth UI16, characterId UI16, then the one matrix byte.
    // PlaceObject2 flags: 0x01 Move, 0x02 HasCharacter, 0x04 HasMatrix, 0x08 HasCxform.
    const flags = file.body[ref!.offset] ?? 0;
    expect(flags).toBe(0x06); // HasMatrix (0x04) | HasCharacter (0x02)
    const depth = (file.body[ref!.offset + 1] ?? 0) | ((file.body[ref!.offset + 2] ?? 0) << 8);
    expect(depth).toBe(1);
    const characterId = (file.body[ref!.offset + 3] ?? 0) | ((file.body[ref!.offset + 4] ?? 0) << 8);
    expect(characterId).toBe(1);
    // NTranslateBits 0 => the matrix is the single byte 0x00 (identity).
    expect(file.body[ref!.offset + 5]).toBe(0x00);
    // And the model agrees: an identity-matrix placement of character 1 at depth 1.
    const movie = buildMovieModel(file);
    const op = movie.mainTimeline.frames[0]?.ops.find((o) => o.kind === 'place');
    expect(op).toMatchObject({ kind: 'place', depth: 1, characterId: 1 });
    expect(op?.kind === 'place' && op.matrix).toEqual({ a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 });
  });

  it('T-SWF-020: the sprite frame-count mismatch (SF0023) reports and pads to the declared count', () => {
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

/** `DoInitAction` (tag 9, SWF 6): `SpriteID` (UI16) then an opaque action block. */
function doInitAction(spriteId: number, actionBytes = new Uint8Array([0x00])): Uint8Array {
  return tag(Tag.DoInitAction, concat(u16(spriteId), actionBytes));
}

describe('DoInitAction duplicate / unknown-sprite policy', () => {
  it('SF0421: more than one DoInitAction for one sprite is reported, both kept in tag order', () => {
    const spriteBody = concat(u16(5), u16(1), endTag()); // DefineSprite 5, one frame
    const body = concat(
      tag(Tag.DefineSprite, spriteBody),
      doInitAction(5, new Uint8Array([0x01])),
      doInitAction(5, new Uint8Array([0x02])), // duplicate for sprite 5
      showFrames(1),
      endTag(),
    );
    const file = openSwf(buildSwf({ version: 8, body, frameCount: 1 }));
    const movie = buildMovieModel(file);
    expect(file.sink.codes()).toContain('SF0421');
    // `IMPL-050-R013`: the invariant is reported, not enforced — both execute in tag order.
    expect(movie.initActions.map((a) => a.spriteId)).toEqual([5, 5]);
  });

  it('SF0422: a DoInitAction for a sprite not in the dictionary is dropped', () => {
    const body = concat(
      tag(Tag.DefineShape, shapeBody(1)), // defines character 1 (a shape), not a sprite
      doInitAction(99), // sprite 99 is never defined
      showFrames(1),
      endTag(),
    );
    const file = openSwf(buildSwf({ version: 8, body, frameCount: 1 }));
    const movie = buildMovieModel(file);
    expect(file.sink.codes()).toContain('SF0422');
    expect(movie.initActions).toEqual([]); // dropped — it can never become reachable
  });

  it('a DoInitAction for a defined sprite is kept with no diagnostic', () => {
    const spriteBody = concat(u16(5), u16(1), endTag());
    const body = concat(tag(Tag.DefineSprite, spriteBody), doInitAction(5), showFrames(1), endTag());
    const file = openSwf(buildSwf({ version: 8, body, frameCount: 1 }));
    const movie = buildMovieModel(file);
    expect(file.sink.codes()).not.toContain('SF0421');
    expect(file.sink.codes()).not.toContain('SF0422');
    expect(movie.initActions.map((a) => a.spriteId)).toEqual([5]);
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

  it('T-MOD-013 models the appendix fixture: stage, background, one frame, one character', () => {
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

  it('T-SWF-020: the main timeline is padded to the declared FrameCount (declared wins)', () => {
    const body = concat(showFrames(1), endTag());
    const movie = buildMovieModel(openSwf(buildSwf({ version: 6, body, frameCount: 3 })));
    expect(movie.mainTimeline.observedFrameCount).toBe(1);
    expect(movie.mainTimeline.frames.length).toBe(3);
    expect(movie.mainTimeline.frames[1]?.ops).toEqual([]);
    expect(movie.mainTimeline.frames[2]?.ops).toEqual([]);
    expect(movie.mainTimeline.declaredFrameCount).toBe(3);
  });

  it('T-MOD-019: stores the ScriptLimits override alongside scenes, labels and metadata', () => {
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

  it('T-MOD-023: reports a Metadata/HasMetadata disagreement (SF0163)', () => {
    const body = concat(tag(Tag.Metadata, asciiZ('<xmp/>')), tag(Tag.ShowFrame), endTag());
    const file = openSwf(buildSwf({ version: 8, body, frameCount: 1 }));
    buildMovieModel(file);
    expect(file.sink.codes()).toContain('SF0163');
  });

  it('T-MOD-028: repeated Metadata keeps the first value and reports SF0164', () => {
    const body = concat(
      tag(Tag.FileAttributes, Uint8Array.from([0x10, 0, 0, 0])),
      tag(Tag.Metadata, asciiZ('<first/>')),
      tag(Tag.Metadata, asciiZ('<second/>')),
      showFrames(1),
      endTag(),
    );
    const file = openSwf(buildSwf({ version: 9, body, frameCount: 1 }));
    const model = buildMovieModel(file);
    expect(model.metadata).toEqual({ xmp: '<first/>' });
    expect(file.sink.codes()).toContain('SF0164');
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

describe('P2 integrity resolutions', () => {
  it('T-MOD-016: an export naming an undefined character id reports SF0174 and gets a missing placeholder', () => {
    // ExportAssets: Count=1, (Tag=77, Name="ghost") — 77 is not defined.
    const body = concat(tag(Tag.ExportAssets, concat(u16(1), u16(77), asciiZ('ghost'))), showFrames(1), endTag());
    const file = openSwf(buildSwf({ version: 8, body, frameCount: 1 }));
    const movie = buildMovieModel(file);
    expect(file.sink.codes()).toContain('SF0174');
    expect(movie.exported.get('ghost')).toBe(77);
    expect(movie.characters.get(77)?.kind).toBe('missing');
  });

  it('T-MOD-016 preserves duplicate export policy and reports both collision kinds', () => {
    const definitions = concat(
      tag(Tag.DefineSprite, concat(u16(7), u16(0), endTag())),
      tag(Tag.DefineSprite, concat(u16(8), u16(0), endTag())),
    );
    const exports = tag(
      Tag.ExportAssets,
      concat(u16(3), u16(7), asciiZ('OldName'), u16(7), asciiZ('NewName'), u16(8), asciiZ('NewName')),
    );
    const file = openSwf(
      buildSwf({ version: 8, body: concat(definitions, exports, showFrames(1), endTag()), frameCount: 1 }),
    );
    const movie = buildMovieModel(file);
    expect(movie.control.exports.get('OldName')).toBe(7);
    expect(movie.control.exports.get('NewName')).toBe(7);
    expect(movie.control.exportsById.get(7)).toBe('NewName');
    expect(movie.control.exportsById.get(8)).toBe('NewName');
    expect(file.sink.codes()).toContain('SF0159');
    expect(file.sink.codes()).toContain('SF0160');
  });

  it('T-MOD-014: a trailing FrameLabel after the final ShowFrame forms its own empty labelled frame (R008)', () => {
    const body = concat(showFrames(1), tag(Tag.FrameLabel, asciiZ('tail')), endTag());
    const file = openSwf(buildSwf({ version: 8, body, frameCount: 1 }));
    const movie = buildMovieModel(file);
    expect(movie.mainTimeline.frames.length).toBe(2);
    expect(movie.mainTimeline.frames[0]?.label).toBeNull();
    expect(movie.mainTimeline.frames[1]?.label).toBe('tail');
    // The labels map entry resolves to the pushed frame — no dangling index.
    expect(movie.mainTimeline.labels.get('tail')).toBe(1);
  });

  it('T-MOD-014: a mid-timeline FrameLabel still names the frame the next ShowFrame displays (R008 regression)', () => {
    const body = concat(showFrames(1), tag(Tag.FrameLabel, asciiZ('mid')), showFrames(1), endTag());
    const file = openSwf(buildSwf({ version: 8, body, frameCount: 2 }));
    const movie = buildMovieModel(file);
    expect(movie.mainTimeline.frames.length).toBe(2);
    expect(movie.mainTimeline.frames[0]?.label).toBeNull();
    expect(movie.mainTimeline.frames[1]?.label).toBe('mid');
    expect(movie.mainTimeline.labels.get('mid')).toBe(1);
  });

  it('T-MOD-020: a repeated DefineScalingGrid keeps the last rect and reports the shadowed one (R028)', () => {
    // Sprite 20 with one frame, the scaling-grid target.
    const sprite = tag(Tag.DefineSprite, concat(u16(20), u16(1), tag(Tag.ShowFrame), endTag()));
    // RECT (IMPL-010-R028): Nbits = ub(5), then the four SB[Nbits] coordinates packed
    // contiguously from bit 5 (no padding), align at the end. With Nbits = 2:
    // A: (-1, 0, -1, 0) — 1×1; B: (-2, 0, -1, 0) — 2×1.
    const gridA = tag(Tag.DefineScalingGrid, concat(u16(20), Uint8Array.from([0x16, 0x60])));
    const gridB = tag(Tag.DefineScalingGrid, concat(u16(20), Uint8Array.from([0x14, 0x60])));
    const body = concat(sprite, gridA, gridB, showFrames(1), endTag());
    const file = openSwf(buildSwf({ version: 8, body, frameCount: 1 }));
    const movie = buildMovieModel(file);
    expect(movie.control.scalingGrids.get(20)).toEqual({ xMin: -2, xMax: 0, yMin: -1, yMax: 0 });
    expect(movie.control.scalingGridsShadowed).toEqual([
      { characterId: 20, rect: { xMin: -1, xMax: 0, yMin: -1, yMax: 0 } },
    ]);
  });

  it('T-MOD-027: SymbolClass id zero populates rootClassName without adding an export', () => {
    const symbolClass = tag(Tag.SymbolClass, concat(u16(1), u16(0), asciiZ('app.Main')));
    const model = buildMovieModel(
      openSwf(buildSwf({ version: 9, body: concat(symbolClass, showFrames(1), endTag()), frameCount: 1 })),
    );
    expect(model.control.rootClassName).toBe('app.Main');
    expect(model.control.exports.size).toBe(0);
  });

  it('T-MOD-036: a DefineBinaryData character carries its payload bytes (R038)', () => {
    const payload = Uint8Array.from([0x01, 0x02, 0x03]);
    const body = concat(
      tag(Tag.DefineBinaryData, concat(u16(30), Uint8Array.from([0, 0, 0, 0]), payload)),
      showFrames(1),
      endTag(),
    );
    const file = openSwf(buildSwf({ version: 9, body, frameCount: 1 }));
    const movie = buildMovieModel(file);
    expect(movie.characters.get(30)?.kind).toBe('binaryData');
    expect(movie.characters.get(30)?.bytes).toEqual(payload);
  });

  it('a SymbolClass name pointing at a binary character in AVM1 content reports SF0179 (R038)', () => {
    const binary = tag(Tag.DefineBinaryData, concat(u16(30), Uint8Array.from([0, 0, 0, 0]), Uint8Array.from([9])));
    const symbolClass = tag(Tag.SymbolClass, concat(u16(1), u16(30), asciiZ('binAsset')));
    const body = concat(binary, symbolClass, showFrames(1), endTag());
    const file = openSwf(buildSwf({ version: 9, body, frameCount: 1 }));
    buildMovieModel(file);
    expect(file.sink.codes()).toContain('SF0179');
  });

  it('--strict-timeline: a removal at an empty depth is a silent no-op by default, SF0127 in strict mode', () => {
    const body = concat(
      tag(Tag.PlaceObject2, placeBody(1, 7)),
      tag(Tag.RemoveObject2, u16(2)), // depth 2 was never placed
      showFrames(1),
      endTag(),
    );
    const bytes = buildSwf({ version: 8, body, frameCount: 1 });
    const soft = openSwf(bytes);
    buildMovieModel(soft);
    expect(soft.sink.codes()).not.toContain('SF0127');

    const strict = openSwf(bytes);
    buildMovieModel(strict, { strictTimeline: true });
    expect(strict.sink.codes()).toContain('SF0127');
  });
});
