/**
 * Movie-level integration — `IMPL-050` §3.3/§3.4 and §8
 * (`T-AVM1-011` requirement extraction, `T-AVM1-012` name/class recovery determinism,
 * `T-AVM1-027` `DoInitAction` scheduling, `T-AVM1-028` `DoAction` at the `ShowFrame` boundary).
 */

import { describe, expect, it } from 'vitest';

import { Tag, buildMovieModel, openSwf } from '@swf-forge/swf';
import { analyzeMovie } from '../src/index.js';
import { actionBlock, buildSwf, concat, defineSprite, endTag, showFrames, tag } from '@swf-forge/swf/test-support';

import { analyze, block } from './harness.js';
import {
  buildActionSchedule,
  candidatesFromFunctions,
  detectClasses,
  extractRequirements,
  recoverNames,
} from '../src/index.js';
import type { Candidate } from '../src/index.js';
import type { FunctionDef } from '../src/frontend/ir.js';

// ---- byte helpers --------------------------------------------------------------------------------------

/** Push string — type 0, NUL-terminated. */
const pushStr = (s: string): number[] => [0x96, s.length + 2, 0, 0, ...[...s].map((c) => c.charCodeAt(0)), 0];
/** Push int — type 7, 4-byte little-endian. */
const pushInt = (v: number): number[] => [0x96, 5, 0, 7, v & 0xff, (v >> 8) & 0xff, (v >> 16) & 0xff, (v >> 24) & 0xff];
const pushEmptyString = [0x96, 2, 0, 0, 0];

const END = 0x00;

function u16(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]);
}

/** `DoInitAction` (59) payload: sprite id UI16 + action block. */
const doInitAction = (spriteId: number, records: readonly number[]): Uint8Array => {
  const blockBytes = actionBlock(records);
  const out = new Uint8Array(2 + blockBytes.length);
  out[0] = spriteId & 0xff;
  out[1] = (spriteId >>> 8) & 0xff;
  out.set(blockBytes, 2);
  return tag(Tag.DoInitAction, out);
};

describe('button action block integration (IMPL-100)', () => {
  it('analyzes the v1 click-and-release action array as a button block at its raw source offset', () => {
    const actionBytes = Uint8Array.of(0x07, 0x00); // Stop; ActionEndFlag
    const record = concat(Uint8Array.of(0x01), u16(1), u16(1), Uint8Array.of(0));
    const body = concat(
      tag(Tag.DefineButton, concat(u16(20), record, Uint8Array.of(0), actionBytes)),
      showFrames(1),
      endTag(),
    );
    const file = openSwf(buildSwf({ version: 8, body, frameCount: 1 }));
    const model = buildMovieModel(file);
    const actionOffset = model.characters.get(20)?.button?.actions[0]?.actionBytes.offset;
    const analysis = analyzeMovie(file, model, { emit: () => undefined });
    const buttonBlock = analysis.blocks.find((item) => item.ir.kind === 'button');
    expect(buttonBlock?.ir.id).toBe('button_20_0');
    expect(buttonBlock?.ir.byteRange.start).toBe(actionOffset);
    expect(
      buttonBlock?.ir.blocks
        .flatMap((block) => block.ops)
        .some((op) => op.kind === 'timeline' && op.timeline.op === 'stop'),
    ).toBe(true);
  });

  it('T-MOD-817 analyzes each v2 CONDACTION as one button block and preserves source ranges', () => {
    const actionBytes = Uint8Array.of(0x07, 0x00);
    const conditionActions = concat(
      u16(6),
      Uint8Array.of(0x01, 0x00),
      actionBytes,
      u16(0),
      Uint8Array.of(0x00, 65 << 1),
      actionBytes,
    );
    const buttonBody = concat(u16(20), Uint8Array.of(0), u16(3), Uint8Array.of(0), conditionActions);
    const body = concat(tag(Tag.DefineButton2, buttonBody), showFrames(1), endTag());
    const file = openSwf(buildSwf({ version: 8, body, frameCount: 1 }));
    const model = buildMovieModel(file);
    const handlers = model.characters.get(20)?.button?.actions ?? [];
    const blocks = analyzeMovie(file, model, { emit: () => undefined }).blocks.filter(
      (item) => item.ir.kind === 'button',
    );
    expect(handlers).toHaveLength(2);
    expect(handlers[1]?.keyCode).toBe(65);
    expect(blocks.map((item) => item.ir.id)).toEqual(['button_20_0', 'button_20_1']);
    expect(blocks.map((item) => item.ir.byteRange.start)).toEqual(handlers.map((entry) => entry.actionBytes.offset));
    expect(
      blocks.every((item) =>
        item.ir.blocks.flatMap((block) => block.ops).some((op) => op.kind === 'timeline' && op.timeline.op === 'stop'),
      ),
    ).toBe(true);
  });
});

describe('T-AVM1-011 requirement extraction matches a hand-written expectation', () => {
  it('groups appear in fixed order with the first requiring op named in `via`', () => {
    const bytes = block(
      pushInt(1),
      pushInt(2),
      [0x0a], // Add → core-objects
      pushEmptyString,
      pushInt(2),
      [0x22], // GetProperty id=_xscale → movie-objects + geometry
      pushEmptyString, // object ""
      pushStr('onEnterFrame'), // name
      pushInt(1), // value
      [0x4f], // SetMember → events
      [0x07], // Stop → timeline
      [END],
    );
    const { block: b } = analyze(bytes);
    expect(extractRequirements(b.ir.blocks)).toEqual([
      { group: 'core-objects', via: 'push', offset: null },
      { group: 'movie-objects', via: 'getProperty', offset: null },
      { group: 'events', via: 'setMember:onEnterFrame', offset: null },
      { group: 'geometry', via: 'getProperty:_xscale', offset: null },
      { group: 'timeline', via: 'timeline:stop', offset: null },
    ]);
  });

  it('a stop-only script requires only core-objects and timeline', () => {
    const { block: b } = analyze(block(pushEmptyString, [0x07], [END]));
    expect(extractRequirements(b.ir.blocks)).toEqual([
      { group: 'core-objects', via: 'push', offset: null },
      { group: 'timeline', via: 'timeline:stop', offset: null },
    ]);
  });
});

describe('T-AVM1-012 name and class recovery: deterministic across input order', () => {
  const CANDIDATES: Candidate[] = [
    { id: 'fn00', declared: 'init', offset: 100, index: 0 },
    { id: 'fn01', declared: 'init', offset: 200, index: 1 },
    { id: 'fn02', declared: 'tick', offset: 100, index: 2 },
    { id: 'fn03', declared: null, offset: 300, index: 3 },
    { id: 'fn04', declared: null, offset: 400, index: 4 },
    { id: 'fn05', declared: null, offset: 500, index: 5 },
    { id: 'fn06', declared: null, offset: 600, index: 6 },
    { id: 'fn07', declared: null, offset: 700, index: 7 },
    { id: 'fn08', declared: null, offset: 800, index: 8 },
    { id: 'fn09', declared: null, offset: 900, index: 9 },
    { id: 'fn10', declared: null, offset: 1000, index: 10 },
    { id: 'fn11', declared: null, offset: 1100, index: 11 },
  ];

  /** Deterministic PRNG (mulberry32) so a regression is reproducible. */
  const mulberry32 = (seed: number): (() => number) => {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const shuffle = (arr: readonly Candidate[], rnd: () => number): Candidate[] => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = out[i] as Candidate;
      out[i] = out[j] as Candidate;
      out[j] = tmp;
    }
    return out;
  };

  const asSortedEntries = (m: ReadonlyMap<string, string>): [string, string][] =>
    [...m.entries()].sort((x, y) => x[0].localeCompare(y[0]));

  it('100 shuffles of the candidate order yield identical names', () => {
    const reference = asSortedEntries(recoverNames(CANDIDATES, new Map()).names);
    for (let trial = 0; trial < 100; trial += 1) {
      const shuffled = shuffle(CANDIDATES, mulberry32(0x9e3779b9 + trial));
      expect(asSortedEntries(recoverNames(shuffled, new Map()).names)).toEqual(reference);
    }
  });

  it('duplicate declared names are suffixed in (offset, id) order, not input order', () => {
    const names = recoverNames(CANDIDATES, new Map()).names;
    expect(names.get('fn00')).toBe('init'); // offset 100 wins the bare name
    expect(names.get('fn01')).toBe('init__1'); // offset 200 gets the suffix
    expect(names.get('fn02')).toBe('tick');
    expect(names.get('fn03')).toBe('avm1_fn_12c_3'); // synthetic: offset 0x12c, index 3
  });

  it('candidatesFromFunctions maps id, declared name, and offset', () => {
    const cands = candidatesFromFunctions([
      { id: 'f1', fn: { name: 'onLoad', bodyStart: 42 } as unknown as FunctionDef },
      { id: 'f2', fn: { name: '', bodyStart: 99 } as unknown as FunctionDef, offset: 7 },
    ]);
    expect(cands).toEqual([
      { id: 'f1', declared: 'onLoad', offset: 42, index: 0 },
      { id: 'f2', declared: '', offset: 7, index: 1 },
    ]);
  });

  it('an Extends over string literals recovers a class with the function as constructor', () => {
    // Push "Sub" (subclass, bottom), Push "Base" (superclass, top); Extends pops superclass first.
    const { block: b } = analyze(block(pushStr('Sub'), pushStr('Base'), [0x69], [END]));
    const names = new Map([['sub-fn', 'MySub']]);
    const classes = detectClasses(new Map([['sub-fn', b.ir.blocks]]), names);
    expect(classes.get('MySub')).toEqual({
      name: 'MySub',
      superclass: 'Base',
      constructorId: 'sub-fn',
      methods: new Map(),
    });
  });
});

describe('T-AVM1-027 DoInitAction scheduling (once-only, per-sprite, frame-associated)', () => {
  const swf = buildSwf({
    version: 7,
    frameCount: 2,
    body: concat(
      defineSprite(1, 1, concat(showFrames(1), endTag())),
      doInitAction(1, []), // init 0 — sprite 1, first
      doInitAction(1, []), // init 1 — sprite 1 again (SF0421)
      doInitAction(99, []), // unknown sprite — dropped at the model layer (SF0422)
      tag(Tag.DoAction, actionBlock([])), // frame 0 action (before the first ShowFrame)
      showFrames(1),
      tag(Tag.DoAction, actionBlock([])), // frame 1 action
      showFrames(1),
      endTag(),
    ),
  });

  it('builds the init schedule with duplicate diagnostics and frame association', () => {
    const file = openSwf(swf);
    const model = buildMovieModel(file);
    // The unknown sprite's DoInitAction is dropped at the model layer.
    expect(file.sink.codes()).toContain('SF0422');
    const codes: string[] = [];
    const schedule = buildActionSchedule(file, model, (code) => {
      codes.push(code);
    });

    expect(schedule.initScripts.length).toBe(2);
    expect(schedule.initScripts.map((s) => s.initOrder)).toEqual([0, 1]);
    expect(schedule.initScripts[0]).toMatchObject({ spriteId: 1, duplicate: false, unknownSprite: false, frame: 0 });
    expect(schedule.initScripts[1]).toMatchObject({ spriteId: 1, duplicate: true, unknownSprite: false });
    expect(schedule.initBySprite.get(1)).toEqual([0, 1]);
    expect(codes.filter((c) => c === 'SF0421')).toHaveLength(1);
    expect(schedule.frameScripts.map((s) => s.frame)).toEqual([0, 1]);
  });
});

describe('T-AVM1-028 DoAction at the ShowFrame boundary, in tag order per frame', () => {
  const swf = buildSwf({
    version: 7,
    frameCount: 2,
    body: concat(
      tag(Tag.DoAction, actionBlock([])), // A — frame 0
      tag(Tag.DoAction, actionBlock([])), // B — frame 0, second in tag order
      showFrames(1), // terminates frame 0
      tag(Tag.DoAction, actionBlock([])), // C — frame 1
      showFrames(1), // terminates frame 1
      endTag(),
    ),
  });

  it('frame scripts carry their frame index and tag order; each block is distinct', () => {
    const file = openSwf(swf);
    const model = buildMovieModel(file);
    const schedule = buildActionSchedule(file, model, () => {});

    expect(schedule.frameScripts.map((s) => s.frame)).toEqual([0, 0, 1]);
    expect(schedule.frameScripts.map((s) => s.order)).toEqual([0, 1, 0]);
    const offsets = schedule.frameScripts.map((s) => s.block.offset);
    expect(new Set(offsets).size).toBe(3);
  });
});
