/**
 * Control and metadata tags — `IMPL-040` §3.5/§5 decoders and their diagnostics: `DefineBinaryData`
 * (T-MOD-022/036), `Protect`/`EnableDebugger*`/`EnableTelemetry` (T-MOD-031/032/033/035),
 * `FileAttributes` reserved bits (T-MOD-032) and ordering (SF0172), plus the structural
 * missing-`End` (`SF0173`) and `FileAttributes`-in-a-sprite (`SF0175`) rules.
 *
 * Control-tag decoders run in the model layer, so `buildMovieModel` is invoked before asserting on
 * the sink; the container-level rules (SF0173/SF0175) are emitted by `openSwf` itself.
 */

import { describe, expect, it } from 'vitest';

import { Cursor, Tag, buildMovieModel, decodeFrameLabel, openSwf, type MovieModel } from '@swf-forge/swf';
import { buildSwf, concat, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

function u16(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

/** Opens `bytes` and runs the model pass, so control-tag diagnostics land on the shared sink. */
function modelOf(bytes: Uint8Array): { file: ReturnType<typeof openSwf>; model: MovieModel } {
  const file = openSwf(bytes);
  return { file, model: buildMovieModel(file) };
}

/** A well-formed single-frame main timeline wrapping `extra` before the ShowFrame/End. */
function movie(version: number, extra: Uint8Array, frameCount = 1): Uint8Array {
  return buildSwf({ version, body: concat(extra, showFrames(1), endTag()), frameCount });
}

describe('DefineBinaryData (87)', () => {
  it('T-MOD-022/036 ships the payload as bytes with size + digest, never as a string', () => {
    const payload = Uint8Array.from([0xde, 0xad, 0xbe, 0xef, 0x00, 0x01]);
    const { model } = modelOf(movie(9, tag(Tag.DefineBinaryData, concat(u16(42), u32(0), payload))));
    const asset = model.control.binaryData.find((a) => a.characterId === 42);
    expect(asset).toBeDefined();
    expect(asset?.length).toBe(6);
    expect(asset?.reserved).toBe(0);
    expect(asset?.digest).toMatch(/^[0-9a-f]{16}$/);
    // The bytes are registered as a character with kind 'binaryData' and stay in the payload.
    expect(model.characters.get(42)?.kind).toBe('binaryData');
    // The payload is never inlined as a string in the emitted model.
    expect(JSON.stringify(model)).not.toContain('deadbeef');
  });

  it('a zero-length Data is legal (up to the end of the tag)', () => {
    const { model } = modelOf(movie(9, tag(Tag.DefineBinaryData, concat(u16(7), u32(0)))));
    expect(model.control.binaryData.find((a) => a.characterId === 7)?.length).toBe(0);
  });

  it('a non-zero reserved word is recorded verbatim (SF0178)', () => {
    const { file, model } = modelOf(movie(9, tag(Tag.DefineBinaryData, concat(u16(8), u32(1), Uint8Array.from([1])))));
    expect(file.sink.codes()).toContain('SF0178');
    expect(model.control.binaryData.find((a) => a.characterId === 8)?.reserved).toBe(1);
  });
});

describe('Protect (24) / debugger / telemetry passwords', () => {
  it('T-MOD-031 records the Protect password as present + digest, never the text', () => {
    const password = Uint8Array.from([...'sekrit-password'.split('').map((ch) => ch.charCodeAt(0)), 0]);
    const { model } = modelOf(movie(8, tag(Tag.Protect, password)));
    expect(model.control.protect?.present).toBe(true);
    expect(model.control.protect?.passwordPresent).toBe(true);
    expect(model.control.protect?.digest).toMatch(/^[0-9a-f]{16}$/);
    expect(JSON.stringify(model)).not.toContain('sekrit-password');
  });

  it('an empty Protect body means "not importable" with no password', () => {
    const { model } = modelOf(movie(8, tag(Tag.Protect, new Uint8Array(0))));
    expect(model.control.protect?.present).toBe(true);
    expect(model.control.protect?.passwordPresent).toBe(false);
    expect(model.control.protect?.digest).toBeNull();
  });

  it('T-MOD-033: EnableDebugger (58) is recorded (SF0151) with a redacted password', () => {
    const password = Uint8Array.from([0x41, 0x42, 0x43, 0x00]);
    const { file, model } = modelOf(movie(5, tag(Tag.EnableDebugger, password)));
    expect(file.sink.codes()).toContain('SF0151');
    expect(model.control.debugger?.version).toBe(1);
    expect(model.control.debugger?.passwordPresent).toBe(true);
    expect(JSON.stringify(model)).not.toContain('ABC');
  });

  it('T-MOD-032: a non-zero EnableDebugger2 Reserved is recorded (SF0171)', () => {
    const { file, model } = modelOf(movie(6, tag(Tag.EnableDebugger2, concat(u16(1), Uint8Array.from([0x00])))));
    expect(file.sink.codes()).toContain('SF0171');
    expect(model.control.debugger?.version).toBe(2);
    expect(model.control.debugger?.reserved).toBe(1);
  });

  it('T-MOD-035: EnableTelemetry 2-byte body has no hash; 34-byte body reports SF0177', () => {
    const plain = modelOf(movie(11, tag(Tag.EnableTelemetry, u16(0))));
    expect(plain.model.control.telemetry?.hashPresent).toBe(false);
    expect(plain.model.control.telemetry?.digest).toBeNull();

    const hashed = modelOf(movie(11, tag(Tag.EnableTelemetry, concat(u16(0), new Uint8Array(32).fill(7)))));
    expect(hashed.file.sink.codes()).toContain('SF0177');
    expect(hashed.model.control.telemetry?.hashPresent).toBe(true);
    expect(hashed.model.control.telemetry?.digest).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('FileAttributes reserved bits and placement', () => {
  it('T-MOD-032: reserved bits are recorded verbatim (SF0171) and the legacy bit (SF0176)', () => {
    // 0x80 (top reserved bit) + 0x02 (lower reserved bit).
    const reserved = modelOf(movie(8, tag(Tag.FileAttributes, u32(0x80 | 0x02))));
    expect(reserved.file.sink.codes()).toContain('SF0171');

    // 0x04 is the legacy SWF 9 NoCrossDomainCache bit.
    const legacy = modelOf(movie(8, tag(Tag.FileAttributes, u32(0x04))));
    expect(legacy.file.sink.codes()).toContain('SF0176');
  });

  it('SF0172: a FileAttributes that is not the first tag is reported (SWF 8+)', () => {
    const attrs = tag(Tag.FileAttributes, u32(0x01));
    // FileAttributes after a ShowFrame: the model-level SF0172 and the stream-level SF0025 both fire.
    const reordered = modelOf(
      buildSwf({ version: 8, body: concat(tag(Tag.ShowFrame), attrs, endTag()), frameCount: 1 }),
    );
    expect(reordered.file.sink.codes()).toContain('SF0172');
    expect(reordered.file.sink.codes()).toContain('SF0025');
    // Control: FileAttributes first is fine.
    const first = modelOf(buildSwf({ version: 8, body: concat(attrs, showFrames(1), endTag()), frameCount: 1 }));
    expect(first.file.sink.codes()).not.toContain('SF0172');
  });
});

describe('structural: sprite End and FileAttributes-in-sprite', () => {
  it('SF0173: a sprite body that ends without an End tag is reported', () => {
    // DefineSprite 5 declares 1 frame but its body has no trailing End.
    const sprite = tag(Tag.DefineSprite, concat(u16(5), u16(1), tag(Tag.ShowFrame)));
    const file = openSwf(buildSwf({ version: 8, body: concat(sprite, showFrames(1), endTag()), frameCount: 1 }));
    expect(file.sink.codes()).toContain('SF0173');
  });

  it('a well-formed sprite does not trigger SF0173', () => {
    const sprite = tag(Tag.DefineSprite, concat(u16(5), u16(1), tag(Tag.ShowFrame), endTag()));
    const file = openSwf(buildSwf({ version: 8, body: concat(sprite, showFrames(1), endTag()), frameCount: 1 }));
    expect(file.sink.codes()).not.toContain('SF0173');
  });

  it('SF0175: a FileAttributes inside a sprite is ignored and named', () => {
    const sprite = tag(
      Tag.DefineSprite,
      concat(u16(5), u16(1), tag(Tag.FileAttributes, u32(0x01)), tag(Tag.ShowFrame), endTag()),
    );
    const file = openSwf(buildSwf({ version: 8, body: concat(sprite, showFrames(1), endTag()), frameCount: 1 }));
    expect(file.sink.codes()).toContain('SF0175');
  });
});

describe('FrameLabel named-anchor byte (IMPL-040-R009)', () => {
  const name = Uint8Array.from(['a', 'n', 'c', 'h', 0].map((ch) => (typeof ch === 'string' ? ch.charCodeAt(0) : ch)));

  it('T-MOD-014: a byte of 1 after the null terminator anchors the frame, no diagnostic', () => {
    const cursor = new Cursor(concat(name, Uint8Array.from([1])));
    expect(decodeFrameLabel(cursor)).toEqual({ name: 'anch', namedAnchor: true });
    expect(cursor.sink.codes()).not.toContain('SF0165');
  });

  it('T-MOD-014: an anchor byte of 0 is still an anchor (the byte is present) and reports SF0165', () => {
    const cursor = new Cursor(concat(name, Uint8Array.from([0])));
    expect(decodeFrameLabel(cursor)).toEqual({ name: 'anch', namedAnchor: true });
    expect(cursor.sink.codes()).toContain('SF0165');
  });

  it('T-MOD-014: a stray non-1 anchor byte still anchors and reports SF0165', () => {
    const cursor = new Cursor(concat(name, Uint8Array.from([7])));
    expect(decodeFrameLabel(cursor)).toEqual({ name: 'anch', namedAnchor: true });
    expect(cursor.sink.codes()).toContain('SF0165');
  });

  it('T-MOD-014: no byte after the null terminator means not anchored', () => {
    const cursor = new Cursor(name);
    expect(decodeFrameLabel(cursor)).toEqual({ name: 'anch', namedAnchor: false });
    expect(cursor.sink.codes()).not.toContain('SF0165');
  });
});

describe('DefineSceneAndFrameLabelData inside a sprite (IMPL-040-R013)', () => {
  it('T-MOD-015: scene data in a sprite is a single implicit scene and reports SF0169', () => {
    // SceneCount=1, Offset=0, Name="scene", LabelCount=0 (encodedU32 single bytes).
    const sceneData = Uint8Array.from([1, 0, 115, 99, 101, 110, 101, 0, 0]);
    const sprite = tag(
      Tag.DefineSprite,
      concat(u16(5), u16(1), tag(Tag.DefineSceneAndFrameLabelData, sceneData), tag(Tag.ShowFrame), endTag()),
    );
    const file = openSwf(buildSwf({ version: 9, body: concat(sprite, showFrames(1), endTag()), frameCount: 1 }));
    const movie = buildMovieModel(file);
    // The rule fires during model assembly (the sprite timeline is walked there).
    expect(file.sink.codes()).toContain('SF0169');
    const timeline = movie.characters.get(5)?.sprite?.timeline;
    expect(timeline?.implicitScene).toEqual({ name: 'scene' });
    // The main timeline is unaffected.
    expect(movie.mainTimeline.implicitScene).toBeNull();
  });

  it('T-MOD-015: a main-timeline scene still normalises (no implicit scene)', () => {
    const sceneData = Uint8Array.from([1, 0, 115, 99, 101, 110, 101, 0, 0]);
    const file = openSwf(
      buildSwf({
        version: 9,
        body: concat(tag(Tag.DefineSceneAndFrameLabelData, sceneData), showFrames(2), endTag()),
        frameCount: 3,
      }),
    );
    const movie = buildMovieModel(file);
    expect(movie.mainTimeline.implicitScene).toBeNull();
    expect(movie.control.scenes).toEqual([{ name: 'scene', frameOffset: 0 }]);
  });
});
