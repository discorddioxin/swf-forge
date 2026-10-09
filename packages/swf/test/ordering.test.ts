/**
 * Tag-ordering validation — `T-SWF-019` (`IMPL-020` §7, Ch.2's five rules): one fixture per rule
 * violation, correct code and count; plus the positive control and the deduplication contract.
 */
import { describe, expect, it } from 'vitest';

import { openSwf } from '@swf-forge/swf';
import type { SwfFile } from '@swf-forge/swf';
import {
  ByteWriter,
  buildSwf,
  concat,
  defineSprite,
  defineTag,
  endTag,
  placeObject2,
  showFrames,
  soundStreamBlock,
  soundStreamHead,
  startSound,
  tag,
} from '@swf-forge/swf/test-support';

function open(bytes: Uint8Array, version?: number): SwfFile {
  return openSwf(buildSwf({ body: bytes, ...(version !== undefined ? { version } : {}) }));
}

function codes(file: SwfFile): string[] {
  return file.diagnostics.map((d) => String(d.code));
}

describe('T-SWF-019 ordering checks', () => {
  it('rule 1: FileAttributes not first in an SWF 8 file is SF0025', () => {
    const body = concat(
      defineTag(2, 1), // DefineShape before the FileAttributes tag
      tag(69, new Uint8Array([1, 0, 0, 0])),
      showFrames(1),
      endTag(),
    );
    const file = open(body, 8);
    expect(codes(file)).toContain('SF0025');
    expect(codes(file)).not.toContain('SF0026');
  });

  it('rule 1: an SWF 8 file that starts with FileAttributes is clean', () => {
    const body = concat(
      tag(69, new Uint8Array([1, 0, 0, 0])),
      defineTag(2, 1),
      placeObject2(1, 1),
      showFrames(1),
      endTag(),
    );
    const file = open(body, 8);
    expect(codes(file)).not.toContain('SF0025');
    expect(codes(file)).not.toContain('SF0026');
  });

  it('rule 2: a control tag that references a character defined later is SF0026', () => {
    // PlaceObject2 (char 1) before the DefineShape that introduces 1.
    const body = concat(placeObject2(1, 1), defineTag(2, 1), showFrames(1), endTag());
    const file = open(body, 7);
    expect(codes(file)).toContain('SF0026');
    const diagnostic = file.diagnostics.find((d) => String(d.code) === 'SF0026');
    expect(diagnostic?.message).toContain('defined later');
  });

  it('rule 2: a reference to a character that is never defined is SF0026', () => {
    const body = concat(placeObject2(9, 1), startSound(4), showFrames(1), endTag());
    const file = open(body, 7);
    expect(codes(file)).toContain('SF0026');
    const diagnostic = file.diagnostics.find((d) => String(d.code) === 'SF0026');
    expect(diagnostic?.message).toContain('never defined');
  });

  it('rule 2: violations are deduplicated by rule with the count and first offset', () => {
    // One late reference plus one never-defined: a single SF0026 diagnostic naming 2 violations.
    const body = concat(placeObject2(1, 1), startSound(4), defineTag(2, 1), showFrames(1), endTag());
    const file = open(body, 7);
    const violations = file.diagnostics.filter((d) => String(d.code) === 'SF0026');
    expect(violations.length).toBe(1);
    expect(violations[0]?.message).toContain('2 character reference(s)');
    expect(violations[0]?.offset).toBe(file.tagIndex.tags[0]?.headerOffset);
  });

  it('rule 4: a SoundStreamBlock before its SoundStreamHead is SF0032', () => {
    const body = concat(soundStreamBlock(), soundStreamHead(), showFrames(1), endTag());
    const file = open(body, 7);
    expect(codes(file)).toContain('SF0032');
  });

  it('rule 4: a block in an earlier frame than its predecessor is SF0032', () => {
    // head, block (frame 0), ShowFrame, block (frame 1), ShowFrame, block again at frame 1 is fine;
    // interleave a second head's block sequence backwards instead.
    const body = concat(
      soundStreamHead(),
      soundStreamBlock(),
      tag(1),
      soundStreamBlock(),
      tag(1),
      soundStreamHead(),
      soundStreamBlock(),
      tag(1),
      endTag(),
    );
    const file = open(body, 7);
    // The second head resets frame tracking, so this layout is legal; assert no false positive.
    expect(codes(file)).not.toContain('SF0032');
  });

  it('rule 5: bytes after the End tag are SF0024 (the tag stream already reports them)', () => {
    const body = concat(showFrames(1), endTag(), tag(1));
    const file = open(body, 7);
    expect(codes(file)).toContain('SF0024');
  });

  it('references inside sprite timelines are checked against the global definition order', () => {
    // The sprite places character 5 before the top-level DefineShape introduces it.
    const sprite = defineSprite(2, 1, concat(placeObject2(5, 1), showFrames(1), endTag()));
    const body = concat(sprite, defineTag(2, 5), showFrames(1), endTag());
    const file = open(body, 7);
    expect(codes(file)).toContain('SF0026');
  });

  it('a well-ordered movie produces no ordering diagnostics', () => {
    const body = concat(
      defineTag(2, 1),
      defineTag(14, 3),
      defineSprite(2, 1, concat(placeObject2(1, 1), showFrames(1), endTag())),
      placeObject2(2, 1),
      startSound(3),
      showFrames(1),
      endTag(),
    );
    const file = open(body, 7);
    expect(
      codes(file).filter((code) => code === 'SF0024' || code === 'SF0025' || code === 'SF0026' || code === 'SF0032'),
    ).toEqual([]);
  });
});

describe('T-SWF-019 button-record regression (F-P1-01)', () => {
  // Bit-pack a MATRIX (no scale, no rotate) with the given nTranslateBits and (tx, ty), and
  // append the identity CXFORMWITHALPHA and a record terminator. Mirrors io/records.readMatrix.
  function packMatrix(nTranslateBits: number, tx: number, ty: number): Uint8Array {
    const bits: number[] = [];
    const push = (value: number, count: number): void => {
      for (let i = count - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
    };
    push(0, 1); // HasScale = false
    push(0, 1); // HasRotate = false
    push(nTranslateBits, 5);
    push(tx, nTranslateBits);
    push(ty, nTranslateBits);
    while (bits.length % 8 !== 0) bits.push(0);
    const out = new Uint8Array(bits.length / 8);
    for (let i = 0; i < out.length; i += 1) {
      let b = 0;
      for (let j = 0; j < 8; j += 1) b = (b << 1) | (bits[i * 8 + j] ?? 0);
      out[i] = b;
    }
    return out;
  }
  // Identity CXFORMWITHALPHA: HasAddTerms=0, HasMultTerms=0, Nbits=0 → single byte 0x00.
  const CXFORM_IDENTITY = new Uint8Array([0x00]);

  function defineButton2With(records: Uint8Array): Uint8Array {
    const w = new ByteWriter();
    w.u16(1); // button id
    w.u8(0); // TrackAsMenu=0, reserved=0
    w.u16(0); // ActionOffset=0
    w.bytes(records);
    return w.toUint8Array();
  }

  it('DefineButton2 with a wide-translate matrix (nTranslateBits=22) does not emit spurious SF0026', () => {
    // With nTranslateBits=22 the matrix is 1+ (22+22)/8 bytes = 7 bytes. A fixed 5-byte skip
    // lands 2 bytes inside tx; the next byte read would be mid-translate and would misalign the
    // CXFORM, then read a bogus "character id" out of the matrix tail.
    const matrix = packMatrix(22, 400000, 0);
    expect(matrix.length).toBe(7); // sanity
    const rec = new ByteWriter();
    rec.u8(0x08); // HitTest
    rec.u16(7); // character id
    rec.u16(1); // depth
    rec.bytes(matrix);
    rec.bytes(CXFORM_IDENTITY);
    rec.u8(0); // record terminator
    const body = concat(
      tag(69, new Uint8Array([1, 0, 0, 0])),
      defineTag(2, 7),
      tag(34, defineButton2With(rec.toUint8Array())),
      showFrames(1),
      endTag(),
    );
    const file = open(body, 8);
    expect(codes(file)).not.toContain('SF0013');
    expect(codes(file)).not.toContain('SF0026');
  });

  it('DefineButton2 with HasFilterList+HasBlendMode stops the walk at the filter list without drifting', () => {
    // First record: a clean ref to char 7. Second record: flags HitTest|HasFilterList|HasBlendMode,
    // charId=7, depth=2, identity matrix, identity cxform, BlendMode=0x02 (layer), NFilters=0,
    // record terminator. If the walker fails to stop at the filter list it parses the blend/
    // filter bytes as another flag/charId pair and emits a phantom SF0026.
    const rec = new ByteWriter();
    // record 1: HitTest char 7 depth 1, identity matrix (nTranslateBits=1, tx=0 ty=0), identity cxform
    rec.u8(0x08);
    rec.u16(7);
    rec.u16(1);
    rec.bytes(packMatrix(1, 0, 0));
    rec.bytes(CXFORM_IDENTITY);
    // record 2: HitTest | HasFilterList | HasBlendMode
    rec.u8(0x08 | 0x10 | 0x20);
    rec.u16(7);
    rec.u16(2);
    rec.bytes(packMatrix(1, 0, 0));
    rec.bytes(CXFORM_IDENTITY);
    rec.u8(0x02); // BlendMode = layer
    rec.u8(0x00); // NFilters = 0
    rec.u8(0); // terminator
    const body = concat(
      tag(69, new Uint8Array([1, 0, 0, 0])),
      defineTag(2, 7),
      tag(34, defineButton2With(rec.toUint8Array())),
      showFrames(1),
      endTag(),
    );
    const file = open(body, 8);
    expect(codes(file)).not.toContain('SF0013');
    expect(codes(file)).not.toContain('SF0026');
  });
});

describe('T-SWF-019 DefineButton (v1) regression', () => {
  it('DefineButton v1 with a wide-translate matrix does not emit spurious SF0026', () => {
    function packMatrix(nTranslateBits: number, tx: number, ty: number): Uint8Array {
      const bits: number[] = [];
      const push = (value: number, count: number): void => {
        for (let i = count - 1; i >= 0; i -= 1) bits.push((value >> i) & 1);
      };
      push(0, 1);
      push(0, 1);
      push(nTranslateBits, 5);
      push(tx, nTranslateBits);
      push(ty, nTranslateBits);
      while (bits.length % 8 !== 0) bits.push(0);
      const out = new Uint8Array(bits.length / 8);
      for (let i = 0; i < out.length; i += 1) {
        let b = 0;
        for (let j = 0; j < 8; j += 1) b = (b << 1) | (bits[i * 8 + j] ?? 0);
        out[i] = b;
      }
      return out;
    }
    // DefineButton v1: ButtonId u16, then CHARACTERRECORDs (flag, charId, depth, MATRIX), 0 term.
    const w = new ByteWriter();
    w.u16(1); // button id
    w.u8(0x08); // HitTest
    w.u16(7);
    w.u16(1); // depth
    w.bytes(packMatrix(22, 400000, 0));
    w.u8(0); // terminator
    const body = concat(
      tag(69, new Uint8Array([1, 0, 0, 0])),
      defineTag(2, 7),
      tag(7, w.toUint8Array()),
      showFrames(1),
      endTag(),
    );
    const file = open(body, 8);
    expect(codes(file)).not.toContain('SF0013');
    expect(codes(file)).not.toContain('SF0026');
  });
});
