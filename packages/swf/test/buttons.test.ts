/**
 * Button dictionary decoding and data-only hit-area rules — T-MOD-801–817 (`IMPL-100`).
 *
 * These tests pin wire decoding/model assembly; they do not simulate renderer or pointer events.
 */

import { describe, expect, it } from 'vitest';

import {
  BUTTON_TRANSITIONS,
  Tag,
  buildMovieModel,
  buttonRecordsForState,
  buttonTransitionsForTracking,
  openSwf,
} from '@swf-forge/swf';
import { ByteWriter, buildSwf, concat, endTag, showFrames, tag, writeRect } from '@swf-forge/swf/test-support';

function u16(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function shapeBody(id: number, bounds: { xMin: number; xMax: number; yMin: number; yMax: number }): Uint8Array {
  const writer = new ByteWriter();
  writeRect(writer, bounds);
  return concat(u16(id), writer.toUint8Array());
}

function identityMatrix(): Uint8Array {
  return Uint8Array.of(0);
}

function translatedMatrix(tx: number, ty: number): Uint8Array {
  const signedBits = (value: number): number => {
    let bits = 1;
    while (bits < 31 && (value < -(2 ** (bits - 1)) || value >= 2 ** (bits - 1))) bits += 1;
    return bits;
  };
  const count = Math.max(signedBits(tx), signedBits(ty));
  const encode = (value: number): number => (value < 0 ? value + 2 ** count : value);
  return new ByteWriter()
    .bits(0, 1)
    .bits(0, 1)
    .bits(count, 5)
    .bits(encode(tx), count)
    .bits(encode(ty), count)
    .toUint8Array();
}

function scaledMatrix(scaleX: number, scaleY: number): Uint8Array {
  const fixedX = Math.round(scaleX * 65536);
  const fixedY = Math.round(scaleY * 65536);
  let count = 1;
  while (count < 31 && (fixedX >= 2 ** (count - 1) || fixedY >= 2 ** (count - 1))) count += 1;
  return new ByteWriter()
    .bits(1, 1)
    .bits(count, 5)
    .bits(fixedX, count)
    .bits(fixedY, count)
    .bits(0, 1)
    .bits(0, 5)
    .bits(0, 0)
    .bits(0, 0)
    .toUint8Array();
}

function halfAlphaCxform(): Uint8Array {
  return new ByteWriter()
    .bits(0, 1)
    .bits(1, 1)
    .bits(10, 4)
    .bits(256, 10)
    .bits(256, 10)
    .bits(256, 10)
    .bits(128, 10)
    .toUint8Array();
}

function singularMatrix(): Uint8Array {
  return new ByteWriter().bits(1, 1).bits(1, 5).bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 5).toUint8Array();
}

function buttonRecordV1(flags: number, characterId: number, depth: number, matrix = identityMatrix()): Uint8Array {
  return concat(Uint8Array.of(flags), u16(characterId), u16(depth), matrix);
}

function buttonRecordV2(
  flags: number,
  characterId: number,
  depth: number,
  options: { matrix?: Uint8Array; cxform?: Uint8Array; filters?: Uint8Array; blendMode?: number } = {},
): Uint8Array {
  return concat(
    Uint8Array.of(flags),
    u16(characterId),
    u16(depth),
    options.matrix ?? identityMatrix(),
    options.cxform ?? identityMatrix(), // CXFORMWITHALPHA
    (flags & 0x10) !== 0 ? (options.filters ?? Uint8Array.of(0)) : new Uint8Array(0),
    (flags & 0x20) !== 0 ? Uint8Array.of(options.blendMode ?? 0) : new Uint8Array(0),
  );
}

function buttonV1Body(
  id: number,
  records: readonly Uint8Array[] = [],
  actions: Uint8Array = Uint8Array.of(0),
): Uint8Array {
  return concat(u16(id), ...records, Uint8Array.of(0), actions);
}

function conditionAction(size: number, first: number, second: number, actions = Uint8Array.of(0)): Uint8Array {
  return concat(u16(size), Uint8Array.of(first, second), actions);
}

function buttonV2Body(
  id: number,
  records: readonly Uint8Array[] = [],
  actions: Uint8Array = new Uint8Array(0),
  trackAsMenu = false,
): Uint8Array {
  const flag = trackAsMenu ? 1 : 0;
  const recordBytes = concat(...records, Uint8Array.of(0));
  const actionOffset = actions.length === 0 ? 0 : 2 + 1 + 2 + recordBytes.length - 3;
  return concat(u16(id), Uint8Array.of(flag), u16(actionOffset), recordBytes, actions);
}

function movie(tags: readonly Uint8Array[], version = 8): ReturnType<typeof buildMovieModel> {
  const body = concat(...tags, showFrames(1), endTag());
  return buildMovieModel(openSwf(buildSwf({ version, body, frameCount: 1 })));
}

function baseShapes(): Uint8Array[] {
  return [
    tag(Tag.DefineShape, shapeBody(1, { xMin: 0, xMax: 10, yMin: 0, yMax: 20 })),
    tag(Tag.DefineShape, shapeBody(2, { xMin: 100, xMax: 120, yMin: 20, yMax: 30 })),
  ];
}

describe('button state records and hit geometry', () => {
  it('T-MOD-801: unions transformed up-state geometry when no explicit hitTest state exists', () => {
    const built = movie([
      ...baseShapes(),
      tag(
        Tag.DefineButton2,
        buttonV2Body(20, [
          buttonRecordV2(0x01, 1, 1, { matrix: scaledMatrix(2, 2), cxform: halfAlphaCxform() }),
          buttonRecordV2(0x01, 2, 2, { matrix: translatedMatrix(-5, 1), cxform: halfAlphaCxform() }),
        ]),
      ),
    ]);
    const button = built.characters.get(20)?.button;
    expect(button?.hitAreaSource).toBe('up');
    expect(button?.records[0]?.cxform?.am).toBe(128);
    expect(button?.records[1]?.cxform?.am).toBe(128);
    expect(button?.hitArea).toEqual({ xMin: 0, xMax: 115, yMin: 0, yMax: 40 });
  });

  it('T-MOD-802: explicit hitTest geometry wins, multi-state records remain shared and depth order is stable', () => {
    const built = movie([
      ...baseShapes(),
      tag(
        Tag.DefineButton,
        buttonV1Body(20, [buttonRecordV1(0x03, 1, 2), buttonRecordV1(0x08, 2, 1, translatedMatrix(-5, 1))]),
      ),
    ]);
    const button = built.characters.get(20)?.button;
    expect(button?.hitAreaSource).toBe('hitTest');
    expect(button?.hitArea).toEqual({ xMin: 95, xMax: 115, yMin: 21, yMax: 31 });
    expect(button?.records[0]?.states).toEqual(['up', 'over']);
    expect(buttonRecordsForState(button?.records ?? [], 'up').map((record) => record.depth)).toEqual([2]);
    expect(buttonRecordsForState(button?.records ?? [], 'over')).toHaveLength(1);
  });

  it('T-MOD-807 resolves nested button geometry without flattening the child records', () => {
    const built = movie([
      ...baseShapes(),
      tag(Tag.DefineButton, buttonV1Body(20, [buttonRecordV1(0x01, 1, 1)])),
      tag(Tag.DefineButton, buttonV1Body(21, [buttonRecordV1(0x01, 20, 1, translatedMatrix(5, 7))])),
      tag(Tag.DefineButton, buttonV1Body(22, [buttonRecordV1(0x01, 21, 1, translatedMatrix(-2, 3))])),
    ]);
    expect(built.characters.get(21)?.button?.hitArea).toEqual({ xMin: 5, xMax: 15, yMin: 7, yMax: 27 });
    expect(built.characters.get(22)?.button?.hitArea).toEqual({ xMin: 3, xMax: 13, yMin: 10, yMax: 30 });
    expect(built.characters.get(21)?.button?.records[0]?.characterId).toBe(20);
    expect(built.characters.get(22)?.button?.records[0]?.characterId).toBe(21);
  });

  it('T-MOD-809 keeps singular hit-area matrices non-interactive and reports SF0131', () => {
    const file = openSwf(
      buildSwf({
        version: 8,
        body: concat(
          tag(Tag.DefineShape, shapeBody(1, { xMin: 0, xMax: 10, yMin: 0, yMax: 10 })),
          tag(Tag.DefineButton, buttonV1Body(20, [buttonRecordV1(0x01, 1, 1, singularMatrix())])),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    const built = buildMovieModel(file);
    expect(built.characters.get(20)?.button?.hitArea).toBeNull();
    expect(file.sink.codes()).toContain('SF0131');
  });
});

describe('button conditions and action offsets', () => {
  it('T-MOD-803 decodes each of the nine condition bits to exactly one named transition', () => {
    const cases = [
      ['idleToOverDown', 0x80, 0],
      ['outDownToIdle', 0x40, 0],
      ['outDownToOverDown', 0x20, 0],
      ['overDownToOutDown', 0x10, 0],
      ['overDownToOverUp', 0x08, 0],
      ['overUpToOverDown', 0x04, 0],
      ['overUpToIdle', 0x02, 0],
      ['idleToOverUp', 0x01, 0],
      ['overDownToIdle', 0, 0x01],
    ] as const;
    for (const [condition, first, second] of cases) {
      const built = movie([tag(Tag.DefineButton2, buttonV2Body(20, [], conditionAction(0, first, second)))]);
      const action = built.characters.get(20)?.button?.actions[0];
      expect(
        Object.entries(action?.conditions ?? {})
          .filter(([, active]) => active)
          .map(([name]) => name),
      ).toEqual([condition]);
      expect(BUTTON_TRANSITIONS.filter((entry) => entry.condition === condition)).toHaveLength(1);
    }
  });

  it('T-MOD-803/T-MOD-814 exposes the nine normative transitions for push and menu tracking', () => {
    expect(BUTTON_TRANSITIONS).toHaveLength(9);
    expect(buttonTransitionsForTracking(false).map((entry) => entry.condition)).toEqual([
      'idleToOverUp',
      'overUpToIdle',
      'overUpToOverDown',
      'overDownToOverUp',
      'outDownToOverDown',
      'overDownToOutDown',
      'outDownToIdle',
    ]);
    expect(buttonTransitionsForTracking(true).map((entry) => entry.condition)).toEqual([
      'idleToOverUp',
      'overUpToIdle',
      'overUpToOverDown',
      'overDownToOverUp',
      'idleToOverDown',
      'overDownToIdle',
    ]);
  });

  it('T-MOD-804 retains documented key codes, composite ASCII codes, and no-focus semantics', () => {
    const documentedKeys = [1, 2, 3, 4, 5, 6, 8, 13, 14, 15, 16, 17, 18, 19];
    const keys = [...documentedKeys, ...Array.from({ length: 95 }, (_, index) => index + 32)];
    const actions = concat(
      ...keys.map((key, index) => conditionAction(index === keys.length - 1 ? 0 : 5, 0, key << 1)),
    );
    const built = movie([tag(Tag.DefineButton2, buttonV2Body(20, [], actions))], 4);
    const button = built.characters.get(20)?.button;
    expect(button?.actions.map((action) => action.keyCode)).toEqual(keys);
    expect(button?.actions.at(-1)?.rawConditionWord).toBe(126 << 1);
    expect(button?.keyPressRequiresFocus).toBe(false);

    const invalidKeyFile = openSwf(
      buildSwf({
        version: 4,
        body: concat(
          tag(Tag.DefineButton2, buttonV2Body(21, [], conditionAction(0, 0, 7 << 1))),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    buildMovieModel(invalidKeyFile);
    expect(invalidKeyFile.sink.codes()).toContain('SF0135');
  });

  it('T-MOD-808 routes menu-only drag transitions by the TrackAsMenu flag', () => {
    const action = conditionAction(0, 0x80, 0x01);
    const menu = movie([tag(Tag.DefineButton2, buttonV2Body(20, [], action, true))]);
    const button = menu.characters.get(20)?.button;
    const menuConditions = buttonTransitionsForTracking(button?.trackAsMenu ?? false).map((entry) => entry.condition);
    expect(button?.trackAsMenu).toBe(true);
    expect(button?.actions[0]?.conditions).toMatchObject({ idleToOverDown: true, overDownToIdle: true });
    expect(menuConditions).toContain('idleToOverDown');
    expect(menuConditions).toContain('overDownToIdle');
    expect(menuConditions).not.toContain('outDownToIdle');
  });

  it('T-MOD-805 records v1 button actions as click-and-release and reports SF0138', () => {
    const file = openSwf(
      buildSwf({
        version: 8,
        body: concat(
          ...baseShapes(),
          tag(Tag.DefineButton, buttonV1Body(20, [buttonRecordV1(0x01, 1, 1)], Uint8Array.of(0x06, 0))),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    const built = buildMovieModel(file);
    const button = built.characters.get(20)?.button;
    expect(button?.version).toBe(1);
    expect(button?.actions).toHaveLength(1);
    expect(button?.actions[0]?.conditions.overDownToOverUp).toBe(true);
    expect(button?.actions[0]?.actionBytes.length).toBe(2);
    expect(built.characters.get(20)?.button?.records).toHaveLength(1);
    expect(file.sink.codes()).toContain('SF0138');
  });

  it('T-MOD-810/817 reads CondActionSize chains, the ninth bit after key code, and one block per handler', () => {
    const actions = concat(conditionAction(5, 0x01, 0x01), conditionAction(0, 0, (65 << 1) | 1));
    const body = buttonV2Body(20, [], actions);
    const built = movie([tag(Tag.DefineButton2, body)]);
    const button = built.characters.get(20)?.button;
    expect(button?.actions).toHaveLength(2);
    expect(button?.actions[0]?.conditions.idleToOverUp).toBe(true);
    expect(button?.actions[0]?.conditions.overDownToIdle).toBe(true);
    expect(button?.actions[0]?.tagOffset).toBeLessThan(button?.actions[1]?.tagOffset ?? 0);
    expect(button?.actions[1]?.keyCode).toBe(65);
    expect(button?.actions[1]?.conditions.overDownToIdle).toBe(true);
    expect(button?.actions[1]?.actionBytes.length).toBe(1);
    expect(built.characters.get(20)?.button?.trackAsMenu).toBe(false);
    // The offset is relative to the first byte of the ActionOffset field (body offset 3).
    const storedOffset = (body[3] ?? 0) | ((body[4] ?? 0) << 8);
    expect(storedOffset).toBe(body.length - actions.length - 3);
  });

  it('T-MOD-810 reports a CondActionSize that overruns the bounded tag', () => {
    const file = openSwf(
      buildSwf({
        version: 8,
        body: concat(
          tag(Tag.DefineButton2, buttonV2Body(20, [], conditionAction(99, 0x01, 0))),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    buildMovieModel(file);
    expect(file.sink.codes()).toContain('SF0130');
  });

  it('T-MOD-811 handles zero ActionOffset and reports AS3 condition actions', () => {
    const zeroOffset = movie([tag(Tag.DefineButton2, buttonV2Body(20))]);
    expect(zeroOffset.characters.get(20)?.button?.actions).toEqual([]);
    const file = openSwf(
      buildSwf({
        version: 9,
        body: concat(
          tag(Tag.FileAttributes, Uint8Array.of(8, 0, 0, 0)),
          tag(Tag.DefineButton2, buttonV2Body(20, [], conditionAction(5, 1, 0))),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    buildMovieModel(file);
    expect(file.sink.codes()).toContain('SF0133');
  });

  it('T-MOD-816 drops no-state records and reports inert empty condition actions', () => {
    const emptyStateRecord = buttonRecordV1(0x10, 1, 1);
    const action = conditionAction(0, 0, 0, Uint8Array.of(0));
    const file = openSwf(
      buildSwf({
        version: 8,
        body: concat(
          tag(Tag.DefineButton, buttonV1Body(20, [emptyStateRecord])),
          tag(Tag.DefineButton2, buttonV2Body(21, [], action)),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    const built = buildMovieModel(file);
    expect(built.characters.get(20)?.button?.records).toEqual([]);
    expect(built.characters.get(21)?.button?.actions[0]?.keyCode).toBeNull();
    expect(file.sink.codes()).toContain('SF0134');
    expect(file.sink.codes()).toContain('SF0137');
  });
});

describe('button auxiliary tags', () => {
  it('T-MOD-806/T-MOD-815 reads SOUNDINFO and preserves all four transition pairs in appendix order', () => {
    const info = concat(
      Uint8Array.of(0x3f),
      u32(100),
      u32(200),
      u16(3),
      Uint8Array.of(1),
      u32(44),
      u16(32768),
      u16(16000),
    );
    const soundTag = concat(u16(20), ...[10, 11, 12, 13].flatMap((id) => [u16(id), info]));
    const built = movie([
      tag(Tag.DefineButton, buttonV1Body(20)),
      ...[10, 11, 12, 13].map((id) => tag(Tag.DefineSound, u16(id))),
      tag(Tag.DefineButtonSound, soundTag),
    ]);
    const sounds = built.characters.get(20)?.button?.sounds;
    expect(sounds?.map((entry) => entry.transition)).toEqual([
      'overUpToIdle',
      'idleToOverUp',
      'overUpToOverDown',
      'overDownToOverUp',
    ]);
    expect(sounds?.[0]?.info).toMatchObject({
      rawFlags: 0x3f,
      syncStop: true,
      syncNoMultiple: true,
      inPoint: 100,
      outPoint: 200,
      loopCount: 3,
      envelope: [{ position44: 44, leftLevel: 32768, rightLevel: 16000 }],
    });
  });

  it('T-MOD-806 reports truncated SOUNDINFO and non-sound button sound references', () => {
    const buttons = concat(tag(Tag.DefineButton, buttonV1Body(20)), tag(Tag.DefineButton, buttonV1Body(21)));
    const unknownSound = tag(Tag.DefineButtonSound, concat(u16(20), u16(0), u16(99), Uint8Array.of(0), u16(0), u16(0)));
    const truncatedInfo = tag(
      Tag.DefineButtonSound,
      concat(
        u16(21),
        u16(0),
        u16(1),
        Uint8Array.of(0x01), // HasInPoint but the UI32 is missing
      ),
    );
    const file = openSwf(
      buildSwf({
        version: 8,
        body: concat(buttons, unknownSound, truncatedInfo, showFrames(1), endTag()),
        frameCount: 1,
      }),
    );
    buildMovieModel(file);
    expect(file.sink.codes()).toContain('SF0132');
  });

  it('T-MOD-812 applies the RGB-only v1 button transform and leaves v2 without it', () => {
    const v1 = movie([
      tag(Tag.DefineButton, buttonV1Body(20)),
      tag(Tag.DefineButtonCxform, concat(u16(20), identityMatrix())),
    ]);
    expect(v1.characters.get(20)?.button?.characterCxform).toMatchObject({ rm: 256, gm: 256, bm: 256, am: 256 });

    const v2File = openSwf(
      buildSwf({
        version: 8,
        body: concat(
          tag(Tag.DefineButton2, buttonV2Body(21)),
          tag(Tag.DefineButtonCxform, concat(u16(21), identityMatrix())),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    const v2 = buildMovieModel(v2File);
    expect(v2.characters.get(21)?.button?.characterCxform).toBeNull();
    expect(v2File.sink.codes()).toContain('SF0136');
  });

  it('T-MOD-813 shares v2 filter and blend field decoding with PlaceObject3', () => {
    const body = buttonV2Body(20, [buttonRecordV2(0x31, 1, 3, { filters: Uint8Array.of(0), blendMode: 4 })]);
    const built = movie([
      tag(Tag.DefineShape, shapeBody(1, { xMin: 0, xMax: 10, yMin: 0, yMax: 10 })),
      tag(Tag.DefineButton2, body),
    ]);
    expect(built.characters.get(20)?.button?.records[0]).toMatchObject({
      states: ['up'],
      filters: [],
      blendMode: 4,
    });
  });
});

describe('P2 audit regressions (T-MOD-841 / T-MOD-842)', () => {
  // F-P2-01: SF0111 must be emitted when a button record's transformed child bounds are degenerate
  // (e.g. a singular/reflective matrix over a shape collapses an axis) AND for self-cycles
  // (F-P2-02).
  it('T-MOD-841 emits SF0111 for a self-cyclic button (button references itself via a record)', () => {
    // Button 20 has a single record that places character 20 (itself) at depth 1.
    const cyclic = tag(
      Tag.DefineButton2,
      buttonV2Body(20, [buttonRecordV2(0x08, 20, 1)]), // 0x08 = hitTest
    );
    const file = openSwf(
      buildSwf({
        version: 8,
        body: concat(cyclic, showFrames(1), endTag()),
        frameCount: 1,
      }),
    );
    const model = buildMovieModel(file);
    expect(model.characters.get(20)?.button?.hitArea).toBeNull();
    expect(file.sink.codes()).toContain('SF0111');
  });

  it('T-MOD-842 emits SF0111 when button hit-area assembly resolves to no usable rect (all records filtered out)', () => {
    // Singular-matrix records are filtered out (SF0131), leaving the rects[] list empty; when
    // source is nonetheless requested (useRecords non-empty but every entry singular), we raise
    // SF0111 and leave hitArea null.
    const singular = singularMatrix();
    const file = openSwf(
      buildSwf({
        version: 8,
        body: concat(
          tag(Tag.DefineShape, shapeBody(1, { xMin: 0, xMax: 10, yMin: 0, yMax: 10 })),
          tag(Tag.DefineButton2, buttonV2Body(21, [buttonRecordV2(0x08, 1, 1, { matrix: singular })])),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    const model = buildMovieModel(file);
    expect(file.sink.codes()).toContain('SF0131'); // singular matrix warning
    expect(file.sink.codes()).toContain('SF0111'); // every record unusable
    expect(model.characters.get(21)?.button?.hitArea).toBeNull();
  });
});
