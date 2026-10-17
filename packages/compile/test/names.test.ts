/**
 * Name assignment — `WP-120-05`, and the evidence for **`T-CMP-001`**: name assignment stability across 100
 * shuffled dictionary orders.
 *
 * The shuffle is a real one: five definition tags of *different sizes*, permuted 100 ways with a seeded PRNG
 * ahead of a fixed control section. Permuting them shifts the absolute offset of every action block that
 * follows, so a name that embedded an offset — or a table built by walking a Map — cannot survive it. The
 * control tags keep their relative order, because moving those would change the movie rather than its
 * dictionary.
 *
 * A second group of cases pins the parts of `IMPL-120-R008`/`R011`/`CMP-D02` that a stability test cannot
 * see: sanitisation, the `_2`/`_3` convention, and the case a suffix rule usually gets wrong — when the
 * suffixed name is itself somebody's base name.
 */

import { describe, expect, it } from 'vitest';

import { Tag, buildMovieModel, type SwfFile } from '@swf-forge/swf';
import { openSwfNodeSync } from '@swf-forge/swf/node';
import { DiagnosticSink } from '@swf-forge/swf';
import { analyzeMovie } from '@swf-forge/avm1';
import {
  ByteWriter,
  actionBlock,
  buildSwf,
  concat,
  defineSprite,
  defineTag,
  endTag,
  showFrames,
  tag,
} from '@swf-forge/swf/test-support';

import { RESERVED_IDENTIFIERS, assignNames, buildNameTable, ownerCharacterOf, sanitiseName } from '../src/index.js';
import type { NameCandidate } from '../src/index.js';

const TRACE = 0x26;
const STOP = 0x07;

function nul(text: string): number[] {
  return [...new TextEncoder().encode(text), 0];
}

function rec(code: number, body: readonly number[]): number[] {
  return [code, body.length & 0xff, (body.length >> 8) & 0xff, ...body];
}

function pushString(text: string): number[] {
  return rec(0x96, [0x00, ...nul(text)]);
}

function defineFunction(name: string, body: readonly number[]): number[] {
  const header = [...nul(name), ...[0, 0], ...[body.length & 0xff, (body.length >> 8) & 0xff]];
  return [...rec(0x9b, header), ...body];
}

/** `ExportAssets` (56): `UI16 Count` then `UI16 TagId` + name per entry. */
function exportAssets(entries: readonly [number, string][]): Uint8Array {
  const w = new ByteWriter();
  w.u16(entries.length);
  for (const [id, name] of entries) {
    w.u16(id).bytes(nul(name));
  }
  return tag(Tag.ExportAssets, w.toUint8Array());
}

/** A definition body of exactly `size` bytes, so ordering the list changes every later offset. */
function shapeOf(id: number, size: number): Uint8Array {
  return defineTag(Tag.DefineShape, id, new Uint8Array(size));
}

const DEFINITIONS: readonly Uint8Array[] = [
  shapeOf(1, 3),
  shapeOf(2, 11),
  shapeOf(3, 27),
  defineSprite(
    7,
    1,
    concat(
      tag(Tag.DoAction, Uint8Array.from(actionBlock([...pushString('inside'), TRACE, STOP]))),
      showFrames(1),
      endTag(),
    ),
  ),
  shapeOf(9, 5),
];

/**
 * The control section, split into the gaps that definitions are dealt into. Placing the definitions in
 * different *slots* — not just in a different order within one fixed block — is what moves every control
 * tag's absolute offset, because the definitions have different sizes. Permuting them inside a single
 * contiguous prefix would leave the total prefix length constant, and the stability assertion below would
 * pass for the wrong reason (offsets never having moved).
 */
function controlsAround(defs: readonly Uint8Array[]): Uint8Array {
  const [d0, d1, d2, d3, d4] = defs as [Uint8Array, Uint8Array, Uint8Array, Uint8Array, Uint8Array];
  return concat(
    d0,
    exportAssets([
      [2, 'Ball'],
      [1, 'Ball'], // the same id exported twice, out of lexical order
      [3, '3rd Prize!'],
      [9, 'class'],
    ]),
    d1,
    // A movie-level block carrying a named function and an unnamed one.
    tag(
      Tag.DoAction,
      Uint8Array.from(
        actionBlock([
          ...defineFunction('init', [...pushString('a'), TRACE, STOP]),
          ...defineFunction('', [...pushString('anon'), TRACE, STOP]),
          TRACE,
          STOP,
        ]),
      ),
    ),
    d2,
    showFrames(1),
    tag(Tag.DoAction, Uint8Array.from(actionBlock([...pushString('b'), TRACE, STOP]))),
    d3,
    showFrames(1),
    tag(Tag.DoInitAction, Uint8Array.from([7 & 0xff, 0, ...actionBlock([...pushString('init7'), TRACE, STOP])])),
    d4,
    showFrames(1),
    endTag(),
  );
}

function assemble(defs: readonly Uint8Array[]): Uint8Array {
  return buildSwf({ version: 8, body: controlsAround(defs), frameCount: 4 });
}

/** Seeded, so a failure reproduces exactly. */
function shuffle<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  const next = (): number => (state = (state * 16807) % 2147483647) / 2147483647;
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    const a = out[i] as T;
    const b = out[j] as T;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

function tableFor(bytes: Uint8Array): { names: [string, string][]; file: SwfFile } {
  const sink = new DiagnosticSink();
  const file = openSwfNodeSync(bytes, { sink });
  const model = buildMovieModel(file, {});
  const analysis = analyzeMovie(file, model, { emit: () => {} });
  const { table } = buildNameTable({
    model,
    file,
    blocks: analysis.blocks.map((block) => block.ir),
    classes: analysis.names.classes,
  });
  return { names: [...table.bySubject.entries()].sort((a, b) => a[0].localeCompare(b[0])), file };
}

describe('T-CMP-001 / T-CMP-010 — stability across 100 shuffled dictionary orders', () => {
  const reference = tableFor(assemble(DEFINITIONS));

  it('assigns the same name to the same subject under every permutation', () => {
    const offsets: number[] = [];
    for (let seed = 1; seed <= 100; seed += 1) {
      const shuffled = shuffle(DEFINITIONS, seed);
      if (shuffled.every((def, i) => def === DEFINITIONS[i])) continue; // identity permutation adds nothing
      const { names } = tableFor(assemble(shuffled));
      expect(names, `seed ${seed}`).toEqual(reference.names);
      offsets.push(assemble(shuffled).length);
    }
    // The permutations must actually move bytes around, or the test proves nothing.
    expect(offsets.length).toBeGreaterThan(90);
    // Total file length cannot change under a permutation, so the diversity check is on the *control*
    // tags' offsets — see the guard below.
    expect(reference.file.tagIndex.tags.length).toBeGreaterThan(0);
  });

  it('shifts the absolute offset of every action block between orderings', () => {
    // A guard on the guard: if all permutations produced identical offsets, the shuffle would be a no-op
    // and the stability claim above would be vacuous.
    const control = (bytes: Uint8Array): number[] =>
      tableFor(bytes)
        .file.tagIndex.tags.filter((item) => item.code === Tag.DoAction && item.inSprite === null)
        .map((item) => item.offset);
    const seen = new Set<string>();
    for (let seed = 1; seed <= 100; seed += 1) seen.add(JSON.stringify(control(assemble(shuffle(DEFINITIONS, seed)))));
    // Without this, the stability result above would be vacuous: it is only interesting *because* the
    // blocks move, and a name that embedded an offset would change with them.
    expect(seen.size).toBeGreaterThan(3);
    expect(control(assemble(DEFINITIONS))).toHaveLength(2);
  });

  it('derives synthetic names from the character id, never from an offset', () => {
    for (const [subject, name] of reference.names) {
      // A legal identifier: `[\w$]` throughout, and not starting with a digit (a leading `_` is exactly how
      // that rule is satisfied, as in `_3rd_Prize`).
      expect(/^[\w$]+$/.test(name) && !/^\d/.test(name), `${subject} = ${name}`).toBe(true);
      // A hex run of the kind `avm1_fn_1c_0` (errata E-044) would mean an offset leaked into a name.
      expect(name, subject).not.toMatch(/_[0-9a-f]{2,}_/);
    }
    const characterNames = reference.names.filter(([subject]) => subject.startsWith('char:')).map(([, name]) => name);
    expect(characterNames).toContain('Ball'); // the export name wins over a synthetic
    expect(characterNames.some((name) => /^Character\d+_\d{2}$/.test(name))).toBe(true);
    expect(characterNames).toContain('_3rd_Prize');
    expect(characterNames).toContain('class_'); // a reserved word is not usable as an identifier
  });

  it('attributes a block to the character that encloses it, from the tag index', () => {
    // `ownerCharacterOf` is the fact R011's "then character id" needs, so it is pinned directly: a tag
    // inside `DefineSprite(7)` reports 7, a top-level one reports null.
    const sink = new DiagnosticSink();
    const file = openSwfNodeSync(assemble(DEFINITIONS), { sink });
    const sprite = file.tagIndex.tags.find((item) => item.code === Tag.DefineSprite);
    // `inSprite === null` matters: the *first* DoAction in the stream is the one inside `DefineSprite(7)`.
    const topLevel = file.tagIndex.tags.find((item) => item.code === Tag.DoAction && item.inSprite === null);
    expect(sprite).toBeDefined();
    expect(topLevel).toBeDefined();
    if (sprite === undefined || topLevel === undefined) return;
    expect(file.tagIndex.tags.filter((item) => item.inSprite === 7).length).toBeGreaterThan(0);
    const inside = file.tagIndex.tags.find((item) => item.inSprite === 7);
    expect(inside).toBeDefined();
    if (inside !== undefined) expect(ownerCharacterOf(file, inside.offset)).toBe(7);
    expect(ownerCharacterOf(file, topLevel.offset)).toBeNull();
  });
});

describe('T-CMP-010 — sanitisation (IMPL-120-R008)', () => {
  it.each([
    ['3rd Prize', '_3rd_Prize'],
    ['foo bar', 'foo_bar'],
    ['a--b', 'a_b'],
    ['..foo..', 'foo'],
    ['_foo_', '_foo_'], // `_` is an identifier character, not a separator: `_root` must survive
    ['_root', '_root'],
    ['_global', '_global'],
    ['with', 'with_'],
    ['vm', 'vm_'],
    ['target', 'target_'],
    ['frame', 'frame_'],
    ['constructor', 'constructor_'],
    ['$$safe$$', '$$safe$$'],
    ['///', 'symbol'],
    ['', 'symbol'],
    ['héllo', 'h_llo'],
  ] as const)('%s becomes %s', (input, expected) => {
    expect(sanitiseName(input, 'symbol')).toBe(expected);
  });

  it('keeps the emitted namespace away from R017’s parameter names', () => {
    for (const reserved of ['vm', 'target', 'frame']) {
      expect(RESERVED_IDENTIFIERS.has(reserved)).toBe(true);
      expect(sanitiseName(reserved, 'x')).toBe(`${reserved}_`);
    }
  });

  it('leaves an already-legal name alone', () => {
    expect(sanitiseName('onEnterFrame', 'symbol')).toBe('onEnterFrame');
    expect(sanitiseName('$OK_9', 'symbol')).toBe('$OK_9');
  });
});

describe('collision resolution (CMP-D02, IMPL-120-R011)', () => {
  const cand = (
    subjectId: string,
    base: string | null,
    orderKey: number,
    owner: number | null = null,
  ): NameCandidate => ({
    kind: 'function',
    subjectId,
    ownerCharacterId: owner,
    base,
    orderKey,
  });

  it('gives the first claimant the bare name and later ones _2, _3 in sorted order', () => {
    const table = assignNames([cand('c', 'tick', 300), cand('a', 'tick', 100), cand('b', 'tick', 200)]);
    expect(table.bySubject.get('a')).toBe('tick');
    expect(table.bySubject.get('b')).toBe('tick_2');
    expect(table.bySubject.get('c')).toBe('tick_3');
    expect(table.suffixedCount).toBe(2);
  });

  it('sorts by source range FIRST, then character id, exactly as R011 reads', () => {
    // An owner-first comparator (a tempting misreading) would give this pair the opposite assignment.
    const table = assignNames([cand('later-in-stream', 'same', 10, 9), cand('earlier-in-stream', 'same', 900, 1)]);
    expect(table.symbols[0]?.subjectId).toBe('later-in-stream');
    expect(table.bySubject.get('later-in-stream')).toBe('same');
    expect(table.bySubject.get('earlier-in-stream')).toBe('same_2');
  });

  it('never resolves a collision by hash', () => {
    const table = assignNames([cand('a', 'dup', 1), cand('b', 'dup', 2), cand('c', 'dup', 3)]);
    expect(table.symbols.map((symbol) => symbol.name)).toEqual(['dup', 'dup_2', 'dup_3']);
    expect(table.symbols.every((symbol) => /[0-9a-f]{8}/.test(symbol.name) === false)).toBe(true);
  });

  it('advances past a name that a later symbol claims as its own base', () => {
    // Two `dup`s plus a symbol literally exported as `dup_2`: the suffixed `dup` and the base `dup_2`
    // contend for the same identifier, and only a loop that keeps advancing resolves it without a rename.
    const table = assignNames([cand('a', 'dup', 1), cand('b', 'dup_2', 2), cand('c', 'dup', 3)]);
    expect(table.bySubject.get('a')).toBe('dup');
    expect(table.bySubject.get('b')).toBe('dup_2');
    expect(table.bySubject.get('c')).toBe('dup_3');
    expect(new Set(table.symbols.map((symbol) => symbol.name)).size).toBe(3);
  });

  it('is independent of the order candidates arrive in, which is the whole point of the sort', () => {
    const list = [cand('x', 'n', 1), cand('y', 'n', 2), cand('z', 'n', 3)];
    const forward = assignNames(list);
    const backward = assignNames([...list].reverse());
    const rotated = assignNames([list[1] as NameCandidate, list[2] as NameCandidate, list[0] as NameCandidate]);
    expect(backward.symbols).toEqual(forward.symbols);
    expect(rotated.symbols).toEqual(forward.symbols);
    expect(forward.symbols.map((symbol) => symbol.name)).toEqual(['n', 'n_2', 'n_3']);
  });

  it('reports a subject declared twice rather than letting a later pass rename it', () => {
    const dup = [cand('x', 'a', 1), cand('x', 'b', 2)];
    expect(() => assignNames(dup)).toThrow(/share the subject id/);
  });
});
