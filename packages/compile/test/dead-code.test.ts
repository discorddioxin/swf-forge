/**
 * The dead-code pass — `WP-120-03`, and the evidence for **`T-CMP-012`**.
 *
 * The obligation has two halves, and the tests below are arranged so they fail for *different* reasons:
 * report-but-remove-nothing while `--prune-dead-code` is off, and refuse to remove *anything* once the
 * reference closure can no longer be completed. The second half is the one a reader is tempted to skip,
 * because a partially applied proof is indistinguishable from a successful run — it reports the same shape of
 * answer and a smaller number.
 */

import { describe, expect, it } from 'vitest';

import {
  DiagnosticSink,
  Tag,
  buildMovieModel,
  type CharacterModel,
  type FillStyle,
  type MovieModel,
  type VectorShape,
} from '@swf-forge/swf';
import { openSwfNodeSync } from '@swf-forge/swf/node';
import { analyzeMovie, type ActionIR } from '@swf-forge/avm1';
import {
  actionBlock,
  buildSwf,
  concat,
  defineShape,
  defineSprite,
  defineTag,
  endTag,
  placeObject2,
  showFrames,
  startSound,
  tag,
} from '@swf-forge/swf/test-support';

import {
  analyseDeadCode,
  analyzeStage,
  deadCodeDecisions,
  deadCodePass,
  modelStage,
  readStage,
  referencesOf,
  resolveForgeConfig,
  runPipeline,
} from '../src/index.js';

const TRACE = 0x26;
const STOP = 0x07;
const PUSH_TRUE = [0x47]; // `Push(true)`: no length field, opcode < 0x80
const SCRIPT = (): Uint8Array => Uint8Array.from(actionBlock([...PUSH_TRUE, TRACE, STOP]));

/** A shape the model can fully decode, so it is never mistaken for an unreadable payload. */
function shape(id: number): Uint8Array {
  return defineShape({
    id,
    bounds: { x0: 0, y0: 0, x1: 4, y1: 4 },
    fills: [{ r: 255, g: 0, b: 0 }],
    paths: [{ start: { x: 0, y: 0 }, segments: [{ to: { x: 4, y: 4 } }], fill: 1 }],
  });
}

/** A shape the decoder will *not* complete: a `DefineShape` whose body is three filler bytes. */
function opaqueShape(id: number): Uint8Array {
  return defineTag(Tag.DefineShape, id, new Uint8Array(3));
}

function doAction(): Uint8Array {
  return tag(Tag.DoAction, SCRIPT());
}

function read(parts: readonly Uint8Array[], frameCount: number) {
  const bytes = buildSwf({ version: 8, body: concat(...parts), frameCount });
  const file = openSwfNodeSync(bytes, { sink: new DiagnosticSink() });
  const model = buildMovieModel(file, {});
  const irs = analyzeMovie(file, model, { emit: () => {} }).blocks.map((block) => block.ir);
  return { bytes, file, model, irs };
}

function plan(input: Parameters<typeof analyseDeadCode>[0]) {
  const result = analyseDeadCode(input);
  return { plan: result, decisions: deadCodeDecisions(result, input.prune) };
}

/** Copies a decoded character with overrides, so payload-shape cases need no binary authoring. */
function cloneCharacter(model: MovieModel, id: number, overrides: Partial<CharacterModel>): CharacterModel {
  const base = [...model.characters.values()][0] as CharacterModel;
  return { ...base, ...overrides, id };
}

function withCharacters(model: MovieModel, extra: readonly CharacterModel[]): MovieModel {
  const characters = new Map(model.characters);
  for (const character of extra) characters.set(character.id, character);
  return { ...model, characters };
}

describe('reachability (IMPL-120-R005)', () => {
  it('reports every unreferenced character and removes none while the flag is off', () => {
    const { file, model, irs } = read([shape(100), shape(101), doAction(), showFrames(1), endTag()], 1);
    const { plan: result, decisions } = plan({ model, file, blocks: irs, prune: false });

    expect(result.removed).toEqual([]);
    expect(result.counts.candidates).toBeGreaterThanOrEqual(2);
    for (const id of [100, 101]) {
      const verdict = result.characters.find((entry) => entry.characterId === id);
      expect(verdict?.state).toBe('prunable');
      expect(verdict?.reason).toContain('no placement, no export');
      expect(verdict?.reason).toContain('--prune-dead-code is off');
      expect(decisions.some((entry) => entry.subject.startsWith(`character ${id} `))).toBe(true);
    }
    expect(result.proofComplete).toBe(true);
  });

  it('removes exactly the candidates when the flag is on', () => {
    const { file, model, irs } = read([shape(100), shape(101), doAction(), showFrames(1), endTag()], 1);
    const result = analyseDeadCode({ model, file, blocks: irs, prune: true });

    expect([...result.removed].sort((a, b) => a - b)).toEqual(
      result.characters.filter((verdict) => verdict.state === 'pruned').map((verdict) => verdict.characterId),
    );
    expect(result.removed).toContain(100);
    expect(result.counts.removed).toBe(result.removed.length);
  });

  it('keeps a character the main timeline places, naming the frame that places it', () => {
    const { file, model, irs } = read(
      [shape(100), shape(101), placeObject2(100, 1), doAction(), showFrames(1), endTag()],
      1,
    );
    const result = analyseDeadCode({ model, file, blocks: irs, prune: true });

    expect(result.removed).toEqual([101]);
    const kept = result.characters.find((verdict) => verdict.characterId === 100);
    expect(kept?.state).toBe('reachable');
    expect(kept?.reason).toContain('main timeline (frame 1)');
  });

  it('follows the closure into a reachable sprite, and prunes what only dead content names', () => {
    // 121 is defined in the *top-level* dictionary and named only from inside the sprite, which is the
    // shape of reference a main-timeline scan alone would prune by accident.
    const inner = concat(placeObject2(121, 1), showFrames(1), endTag());
    const { file, model, irs } = read(
      [shape(121), defineSprite(110, 1, inner), placeObject2(110, 2), shape(130), endTag()],
      1,
    );
    const result = analyseDeadCode({ model, file, blocks: irs, prune: true });

    // 121 is named only by the sprite, and the sprite only by the stage: both survive. 130 names nothing
    // and is named by nothing.
    expect(result.removed).toEqual([130]);
    const nested = result.characters.find((verdict) => verdict.characterId === 121);
    expect(nested?.state).toBe('reachable');
    expect(nested?.referencedBy).toEqual([110]);
  });

  it('treats an exported character as a root, because a name can reach it', () => {
    const { file, model, irs } = read([shape(100), endTag()], 1);
    const exported: MovieModel = { ...model, exported: new Map([['Butterfly', 100]]) };
    const result = analyseDeadCode({ model: exported, file, blocks: irs, prune: true });

    expect(result.removed).not.toContain(100);
    const verdict = result.characters.find((entry) => entry.characterId === 100);
    expect(verdict?.reason).toContain('exported as "Butterfly"');
  });

  it('roots a sound through a StartSound tag', () => {
    const { file, model, irs } = read([shape(140), startSound(140), endTag()], 1);
    const result = analyseDeadCode({ model, file, blocks: irs, prune: true });

    // The fixture points the sound event at a shape on purpose: the rule under test is "a timeline event that
    // names an id makes it a root", which must hold for whatever that id turns out to be.
    expect(result.removed).not.toContain(140);
    expect(result.characters.find((verdict) => verdict.characterId === 140)?.reason).toContain('StartSound');
  });
});

describe('the proof, not the heuristic', () => {
  it('disables pruning for the whole movie when a live character could not be read', () => {
    const { file, model, irs } = read([shape(100), shape(101), shape(102), endTag()], 1);
    const clean = analyseDeadCode({ model, file, blocks: irs, prune: true });
    expect(clean.removed.length).toBeGreaterThan(0); // the same fixture prunes fine without the ghost

    const ghost = cloneCharacter(model, 900, { kind: 'shape', vectorShape: null });
    const withGhost = {
      ...withCharacters(model, [ghost]),
      exported: new Map<string, number>([['ghost', 900]]),
    };
    const result = analyseDeadCode({ model: withGhost, file, blocks: irs, prune: true });

    expect(result.proofComplete).toBe(false);
    expect(result.removed).toEqual([]); // not "the safe ones": a partial proof prunes nothing
    expect(result.blockers.map((entry) => entry.characterId)).toEqual([900]);
    expect(result.blockers[0]?.reason).toContain('no decoded style table');
    expect(result.characters.filter((verdict) => verdict.state === 'kept-unproven')).toHaveLength(3);
  });

  it('does not treat an unread payload on an *unreachable* character as a blocker', () => {
    // Pruning C never depends on what C references — only on whether anything names C. If this rule were
    // reversed, one opaque tag anywhere would make the pass useless on real content.
    const { file, model, irs } = read([shape(100), shape(101), endTag()], 1);
    const ghost = cloneCharacter(model, 901, { kind: 'unknown', vectorShape: null });
    const result = analyseDeadCode({ model: withCharacters(model, [ghost]), file, blocks: irs, prune: true });

    expect(result.proofComplete).toBe(true);
    expect(result.blockers).toEqual([]);
    expect(result.removed).toContain(901);
  });

  it('reads a bitmap through a line style, and takes a solid line for no reference', () => {
    // A real decoded shape, with its style list swapped: hand-building `VectorShape` would pin P2's field
    // list into this test, and every new field there would break it for a reason unrelated to dead code.
    const model = read([shape(100), endTag()], 1).model;
    const decoded = model.characters.get(100) as CharacterModel;
    const real = decoded.vectorShape as VectorShape;
    const style = (fill: FillStyle | undefined): VectorShape => ({
      ...real,
      styles: {
        fills: [],
        lines: [
          fill === undefined
            ? { width: 1, color: { r: 0, g: 0, b: 0, a: 255 } }
            : { width: 1, color: { r: 0, g: 0, b: 0, a: 255 }, fill },
        ],
      },
    });
    const bitmap: FillStyle = {
      kind: 'bitmap',
      bitmapId: 77,
      repeat: false,
      smoothed: false,
      matrix: { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 },
    };
    const withFill = referencesOf(cloneCharacter(model, 910, { kind: 'shape', vectorShape: style(bitmap) }));
    expect(withFill.ids).toEqual([77]);
    expect(withFill.complete).toBe(true);

    const plain = referencesOf(cloneCharacter(model, 911, { kind: 'shape', vectorShape: style(undefined) }));
    expect(plain.ids).toEqual([]);
    expect(plain.complete).toBe(true);

    const quarantined = referencesOf(
      cloneCharacter(model, 912, {
        kind: 'shape',
        vectorShape: { ...style(bitmap), quarantined: true },
      }),
    );
    expect(quarantined.complete).toBe(false);
    expect(quarantined.ids).toEqual([]);
    expect(quarantined.blocker).toContain('quarantined');
  });

  it('calls a block dead only on the movie’s own evidence', () => {
    const { file, model, irs } = read([doAction(), showFrames(1), doAction(), showFrames(1), endTag()], 2);
    const whole = analyseDeadCode({ model, file, blocks: irs, prune: true });
    expect(whole.blocks.every((verdict) => verdict.state === 'kept')).toBe(true);

    // The same blocks past a shortened movie: the second frame never plays, and that is the evidence.
    const short: MovieModel = { ...model, frameCount: 1 };
    const trimmed = analyseDeadCode({ model: short, file, blocks: irs, prune: true });
    expect(trimmed.counts.blockCandidates).toBe(1);
    expect(trimmed.blocks.filter((verdict) => verdict.state === 'pruned')).toHaveLength(1);
    expect(trimmed.blocks.find((verdict) => verdict.state === 'pruned')?.reason).toContain(
      "at or past the movie's 1-frame length",
    );
  });

  it('reports basic blocks the front end flagged, without pretending to prune them', () => {
    const { file, model, irs } = read([doAction(), showFrames(1), endTag()], 1);
    const withUnreachable: readonly ActionIR[] = irs.map((ir, index) =>
      index === 0
        ? {
            ...ir,
            blocks: ir.blocks.map((block, position) => (position === 0 ? block : { ...block, unreachable: true })),
          }
        : ir,
    );
    const result = analyseDeadCode({ model, file, blocks: withUnreachable, prune: true });
    if (withUnreachable[0]?.blocks.length === 1) {
      expect(result.counts.unreachableBasicBlocks).toBe(0); // one block, still the entry block: no tail to flag
    } else {
      expect(result.counts.unreachableBasicBlocks).toBeGreaterThan(0);
      const verdict = result.blocks.find((entry) => entry.state === 'partially-unreachable');
      expect(verdict?.reason).toContain('the emitter does not emit them');
      expect(verdict?.unreachableBlocks.length).toBeGreaterThan(0);
    }
  });
});

describe('determinism and the runner (IMPL-120-R001)', () => {
  it('is a pure function of the dictionary, not of its iteration order', () => {
    const { file, model, irs } = read([shape(100), shape(101), doAction(), showFrames(1), endTag()], 1);
    const forward = analyseDeadCode({ model, file, blocks: irs, prune: true });
    const reversed: MovieModel = {
      ...model,
      characters: new Map([...model.characters.entries()].reverse()),
    };
    const backward = analyseDeadCode({ model: reversed, file, blocks: irs, prune: true });

    expect(JSON.stringify(backward)).toBe(JSON.stringify(forward));
    expect(forward.characters.map((verdict) => verdict.characterId)).toEqual(
      [...forward.characters.map((verdict) => verdict.characterId)].sort((a, b) => a - b),
    );
  });

  it('runs as a registered pass and leaves its plan on the pipeline state', () => {
    const { bytes } = read([shape(100), shape(101), doAction(), showFrames(1), endTag()], 1);
    const result = runPipeline({
      input: bytes,
      inputName: 'game.swf',
      config: resolveForgeConfig({ input: 'game.swf', outDir: 'out' }),
      toolVersion: 'test-1',
      stages: [readStage('game.swf'), modelStage(), analyzeStage()],
      passes: [deadCodePass()],
    });

    expect(result.status).toBe('complete');
    expect(result.passes.map((entry) => [entry.id, entry.status])).toEqual([
      ['dead-code', 'ran'],
      ['shake', 'unregistered'],
      ['tier-finalise', 'unregistered'],
      ['names', 'unregistered'],
      ['frames', 'unregistered'],
    ]);
    // The CLI default is report-only, whatever the pass can prove.
    expect(result.state.deadCode?.counts.candidates).toBeGreaterThan(0);
    expect(result.state.deadCode?.removed).toEqual([]);
  });

  it('honours --prune-dead-code from the resolved switches', () => {
    const { bytes } = read([shape(100), shape(101), doAction(), showFrames(1), endTag()], 1);
    const result = runPipeline({
      input: bytes,
      inputName: 'game.swf',
      config: resolveForgeConfig({ input: 'game.swf', outDir: 'out' }),
      switches: { pruneDeadCode: true },
      toolVersion: 'test-1',
      stages: [readStage('game.swf'), modelStage(), analyzeStage()],
      passes: [deadCodePass()],
    });

    expect(result.state.deadCode?.counts.removed).toBeGreaterThan(0);
    expect(result.state.deadCode?.proofComplete).toBe(true);
  });

  it('names the stages it needs when one is missing', () => {
    const { bytes } = read([shape(100), endTag()], 1);
    const result = runPipeline({
      input: bytes,
      inputName: 'game.swf',
      config: resolveForgeConfig({ input: 'game.swf', outDir: 'out' }),
      toolVersion: 'test-1',
      stages: [readStage('game.swf')],
      passes: [deadCodePass()],
    });

    expect(result.status).toBe('failed');
    expect(result.passes[0]?.error?.message).toContain('needs the `read` and `model` stages');
  });

  it('treats a hole in a live payload as a blocker even when the model filled it in', () => {
    // The reader's soft mode zeroes a value and keeps going, so `vectorShape` is non-null and *looks*
    // complete. What the bytes did not contain is still unknown, and `interrupted` is how the pass learns it.
    const { file, model, irs } = read([shape(100), shape(101), placeObject2(100, 1), endTag()], 1);
    const clean = analyseDeadCode({ model, file, blocks: irs, prune: true });
    expect(clean.removed).toContain(101);

    const hole = analyseDeadCode({
      model,
      file,
      blocks: irs,
      prune: true,
      interrupted: new Map([[100, ['SF0013']]]),
    });
    expect(hole.proofComplete).toBe(false);
    expect(hole.removed).toEqual([]);
    expect(hole.blockers).toEqual([{ characterId: 100, reason: 'its payload was not fully read (SF0013)' }]);
    expect(hole.characters.find((verdict) => verdict.characterId === 101)?.state).toBe('kept-unproven');
  });

  it('takes its obstructions from the artifact, never from the live sink (IMPL-120-R035)', () => {
    // The first version of this pass asked `ctx.diagnostics` directly. That is wrong on a warm build: the
    // `model` stage is cached, so its re-run emits nothing and the pass would see a clean slate and prune what
    // the cold run refused to — `CMP-R040`'s "a hit must not change output bytes" broken by an input that was
    // never in the key. The list is therefore computed in the stage and carried on the artifact.
    const clean = read([shape(100), shape(101), placeObject2(100, 1), endTag()], 1);
    const result = runPipeline({
      input: clean.bytes,
      inputName: 'game.swf',
      config: resolveForgeConfig({ input: 'game.swf', outDir: 'out' }),
      switches: { pruneDeadCode: true },
      toolVersion: 'test-1',
      stages: [readStage('game.swf'), modelStage(), analyzeStage()],
      passes: [deadCodePass()],
    });

    expect(result.state.model?.readInterruptions).toEqual([]);
    expect(result.state.deadCode?.proofComplete).toBe(true);
    expect(result.state.deadCode?.removed).toContain(101);
  });

  it('PINS a gap: a silently truncated payload still reads as complete (errata E-046)', () => {
    // Three filler bytes as a `DefineShape` body makes the reader overrun its own limit. It reports `SF0013`
    // — a *warning*, at an offset that lies in the *next* tag's span — and returns a shape with
    // `quarantined` unset, so nothing in the model distinguishes it from a payload that was read to the end.
    // This assertion is deliberately on the wrong side of what is true: it exists so the test suite fails
    // loudly when `WP-020-*` starts marking partial payloads, at which point the expectation flips and this
    // comment is deleted. Do not "fix" the pass to guess from diagnostic offsets instead.
    const { file, model, irs } = read([opaqueShape(105), placeObject2(105, 1), shape(106), endTag()], 1);
    const result = analyseDeadCode({ model, file, blocks: irs, prune: true });

    expect(
      (model.characters.get(105) as CharacterModel).vectorShape?.quarantined,
      'a partial payload should be marked by the reader (E-045)',
    ).toBeUndefined();
    expect(result.proofComplete).toBe(true);
    expect(result.removed).toEqual([106]);
  });
});

/**
 * Reference sets are only as complete as the payloads P2 decodes. These pin the two kinds where a payload can
 * name a character id that never reaches the model (errata `E-046`), and the neighbouring kinds where it
 * provably cannot — the second half matters as much, because a rule that blocks on every font would be
 * quietly unusable.
 */
describe('what a payload can hide (E-046)', () => {
  function bareCharacter(kind: string, extra: Record<string, unknown> = {}): CharacterModel {
    return { id: 120, kind, tagCode: null, tagName: kind, index: null, ...extra } as unknown as CharacterModel;
  }

  it('refuses to promise leaf-hood for the payloads that carry hidden ids', () => {
    for (const kind of ['font2', 'font3', 'video']) {
      const result = referencesOf(bareCharacter(kind));
      expect(result.complete, kind).toBe(false);
      expect(result.blocker, kind).toBeTruthy();
      expect(result.ids, kind).toEqual([]);
    }
  });

  it('does not block on the flavours whose payloads contain no character id at all', () => {
    for (const kind of ['font', 'font4', 'bitmap', 'bitmapLossless', 'sound', 'binaryData', 'imported', 'missing']) {
      const result = referencesOf(bareCharacter(kind));
      expect(result.complete, kind).toBe(true);
      expect(result.blocker, kind).toBeNull();
      expect(result.ids, kind).toEqual([]);
    }
  });

  it('disables pruning for the whole movie when one font could carry bitmap glyphs', () => {
    // The kind comes from the tag code, so an unread payload still lands in `font2` — which is the point: the
    // pass cannot tell a bitmap font from an outline font, so neither can it prune around one.
    const font = defineTag(Tag.DefineFont2, 130, Uint8Array.from([0, 0]));
    const bytes = buildSwf({
      version: 8,
      // The font must be a root for the hole to matter: a dead referencer cannot hold anything alive, which is
      // why the first draft of this fixture (font unreferenced) proved nothing.
      body: concat(shape(100), shape(101), font, placeObject2(100, 1), placeObject2(130, 2), endTag()),
      frameCount: 1,
    });
    const file = openSwfNodeSync(bytes, { sink: new DiagnosticSink() });
    const model = buildMovieModel(file, {});
    expect((model.characters.get(130) as CharacterModel).kind).toBe('font2'); // the premise, not the conclusion

    const result = analyseDeadCode({ model, file, blocks: [], prune: true });

    expect(result.proofComplete).toBe(false);
    expect(result.blockers).toEqual([{ characterId: 130, reason: expect.stringContaining('E-046') }]);
    expect(result.removed).toEqual([]);
    expect(result.characters.find((entry) => entry.characterId === 101)?.state).toBe('kept-unproven');
    expect(result.characters.find((entry) => entry.characterId === 100)?.state).toBe('reachable');
    expect(result.counts.removed).toBe(0);
  });
});
