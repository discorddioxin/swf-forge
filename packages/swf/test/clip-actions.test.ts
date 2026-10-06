/**
 * CLIPACTIONS / CLIPEVENTFLAGS wire framing — T-MOD-007/008, APP-§10.1.
 */

import { describe, expect, it } from 'vitest';

import { Cursor, Tag, buildMovieModel, decodeClipActions, decodeClipEventFlags, openSwf } from '@swf-forge/swf';
import { buildSwf, concat, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

function u16(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function clipActions(
  version: 5 | 6 | 7,
  options: {
    reserved?: number;
    allEvents?: number;
    flags?: number;
    size?: number;
    keyCode?: number;
    action?: Uint8Array;
    end?: number;
  } = {},
): Uint8Array {
  const width = version <= 5 ? 2 : 4;
  const field = (value: number): Uint8Array => (width === 2 ? u16(value) : u32(value));
  const flags = options.flags ?? (version <= 5 ? 0x0002 : 0x00020000);
  const keyPress = (flags & (version <= 5 ? 0 : 0x00020000)) !== 0;
  const action = options.action ?? Uint8Array.of(0);
  const keyCode = keyPress ? Uint8Array.of(options.keyCode ?? 65) : new Uint8Array(0);
  const size = options.size ?? keyCode.length + action.length;
  return concat(
    u16(options.reserved ?? 0),
    field(options.allEvents ?? flags),
    field(flags),
    u32(size),
    keyCode,
    action,
    field(options.end ?? 0),
  );
}

describe('clip event flags and action framing', () => {
  it('T-MOD-007 reads the 2-byte/4-byte masks little-endian and preserves reserved bits', () => {
    const legacy = new Cursor(Uint8Array.of(0x03, 0x02), 0, 2, { version: 5 });
    const legacyFlags = decodeClipEventFlags(legacy);
    expect(legacyFlags).toMatchObject({ width: 2, raw: 0x0203, load: true, enterFrame: true, reserved: 0x0200 });
    expect(legacy.sink.codes()).toContain('SF0114');

    const modern = new Cursor(Uint8Array.of(0x01, 0, 0, 0), 0, 4, { version: 6 });
    const modernFlags = decodeClipEventFlags(modern);
    expect(modernFlags).toMatchObject({ width: 4, raw: 1, load: true, data: false });

    const construct = new Cursor(Uint8Array.of(0, 0, 4, 0), 0, 4, { version: 7 });
    expect(decodeClipEventFlags(construct).construct).toBe(true);
  });

  it('T-MOD-008 reads v5 and v6 records, optional key codes, byte ranges, and width-matched terminators', () => {
    const v5 = new Cursor(clipActions(5, { flags: 0x0002, action: Uint8Array.of(0) }), 0, undefined, { version: 5 });
    const legacy = decodeClipActions(v5);
    expect(legacy).toMatchObject({
      reserved: 0,
      allEvents: { enterFrame: true, width: 2 },
      records: [{ events: { enterFrame: true }, keyCode: null, sizeBytes: 1, actions: { length: 1 } }],
      endFlagWidth: 2,
      endFlag: 0,
    });
    expect(v5.offset).toBe(v5.limit);

    const v6 = new Cursor(clipActions(6), 0, undefined, { version: 6 });
    const modern = decodeClipActions(v6);
    expect(modern).toMatchObject({
      allEvents: { keyPress: true, width: 4 },
      records: [{ events: { keyPress: true }, keyCode: 65, sizeBytes: 2, actions: { length: 1 } }],
      endFlagWidth: 4,
      endFlag: 0,
    });
    expect(v6.offset).toBe(v6.limit);
  });

  it('T-MOD-008 reports nonzero reserved fields, empty dispatch masks, and bounded size overruns', () => {
    const reserved = new Cursor(clipActions(6, { reserved: 7, flags: 2, allEvents: 0 }), 0, undefined, { version: 6 });
    const decoded = decodeClipActions(reserved);
    expect(decoded.reserved).toBe(7);
    expect(reserved.sink.codes()).toContain('SF0119');
    expect(reserved.sink.codes()).toContain('SF0115');

    const overrun = new Cursor(clipActions(6, { flags: 2, allEvents: 2, size: 99 }), 0, undefined, { version: 6 });
    const malformed = decodeClipActions(overrun);
    expect(malformed.records[0]?.actions.length).toBeGreaterThan(0);
    expect(overrun.sink.codes()).toContain('SF0118');
    expect(overrun.sink.codes()).toContain('SF0119');
  });

  it('T-MOD-008 reports clip actions on a non-sprite character after model resolution', () => {
    const clip = clipActions(6, { flags: 2, allEvents: 2 });
    const place = concat(Uint8Array.of(0x82), u16(1), u16(1), clip);
    const file = openSwf(
      buildSwf({
        version: 8,
        body: concat(tag(Tag.DefineShape, u16(1)), tag(Tag.PlaceObject2, place), showFrames(1), endTag()),
        frameCount: 1,
      }),
    );
    const model = buildMovieModel(file);
    expect(model.mainTimeline.frames[0]?.ops[0]).toMatchObject({ kind: 'place', characterId: 1 });
    expect(file.sink.codes()).toContain('SF0125');
  });
});
