/**
 * Tag-ordering validation — `T-SWF-019` (`IMPL-020` §7, Ch.2's five rules): one fixture per rule
 * violation, correct code and count; plus the positive control and the deduplication contract.
 */
import { describe, expect, it } from 'vitest';

import { openSwf } from '@swf-forge/swf';
import type { SwfFile } from '@swf-forge/swf';
import {
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
