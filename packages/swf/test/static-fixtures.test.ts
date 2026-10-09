/**
 * The P4 fixture corpus checks itself against the production decoder before any golden is taken
 * from it (`IMPL-140` §2, `T-RT-111`-style "one artifact, two consumers" rule for fixtures).
 *
 * The encoders in `test-support/static-fixtures.ts` are written from the chapter, not from the
 * decoder, so these assertions are the place where the two meet: what the encoder wrote is what the
 * model reports — frame counts, placements, matrices, `CXFORM`, caps/joins and the `clipDepth` mask.
 */

import { describe, expect, it } from 'vitest';

import { buildMovieModel, openSwf, type PlacementOp } from '@swf-forge/swf';
import { staticFixtures } from '@swf-forge/swf/test-support';

const fixtures = staticFixtures();
const byName = (name: string): (typeof fixtures)[number] => {
  const fixture = fixtures.find((candidate) => candidate.name === name);
  if (!fixture) throw new Error(`no fixture named ${name}`);
  return fixture;
};

function modelOf(name: string) {
  const fixture = byName(name);
  const file = openSwf(fixture.bytes);
  return { fixture, file, model: buildMovieModel(file) };
}

function placements(name: string, frameIndex: number): PlacementOp[] {
  const { model } = modelOf(name);
  return (model.mainTimeline.frames[frameIndex]?.ops ?? []).filter((op): op is PlacementOp => op.kind === 'place');
}

describe('P4 static fixtures', () => {
  it('is a 20-fixture corpus with unique names and deterministic bytes', () => {
    expect(fixtures).toHaveLength(20);
    expect(new Set(fixtures.map((fixture) => fixture.name)).size).toBe(20);
    for (const fixture of fixtures) {
      const again = byName(fixture.name).bytes;
      expect(again).toEqual(fixture.bytes);
    }
  });

  it('decodes without error diagnostics and has no script in either timeline', () => {
    for (const fixture of fixtures) {
      const file = openSwf(fixture.bytes);
      const model = buildMovieModel(file);
      const errors = file.sink.list().filter((item) => item.severity === 'error');
      expect({ fixture: fixture.name, errors: errors.map((item) => String(item.code)) }).toEqual({
        fixture: fixture.name,
        errors: [],
      });
      expect(model.frameCount).toBe(fixture.frameCount);
      expect(model.mainTimeline.frames.every((frame) => frame.actions.length === 0)).toBe(true);
      expect(model.initActions).toEqual([]);
      for (const character of model.characters.values()) {
        if (!character.sprite) continue;
        for (const frame of character.sprite.timeline.frames) {
          expect({ fixture: fixture.name, sprite: character.id, actions: frame.actions.length }).toEqual({
            fixture: fixture.name,
            sprite: character.id,
            actions: 0,
          });
        }
      }
    }
  });

  it('writes the frame counts the header promises', () => {
    for (const fixture of fixtures) {
      const file = openSwf(fixture.bytes);
      const model = buildMovieModel(file);
      expect(model.mainTimeline.observedFrameCount).toBe(fixture.frameCount);
      expect(file.header.frameCount).toBe(fixture.frameCount);
    }
  });

  it('round-trips fills, holes and the DefineShape4 winding rule', () => {
    const evenOdd = modelOf('two-fills-hole').model.characters.get(1)?.vectorShape;
    expect(evenOdd?.fillRule).toBe('evenOdd');
    expect(evenOdd?.paths).toHaveLength(2);
    expect(evenOdd?.styles.fills[1]).toMatchObject({ kind: 'solid', color: { r: 40, g: 80, b: 220 } });

    const nonZero = modelOf('nonzero-hole').model.characters.get(1)?.vectorShape;
    expect(nonZero?.fillRule).toBe('nonZero');
    expect(nonZero?.paths).toHaveLength(2);
  });

  it('round-trips quadratic edges', () => {
    const shape = modelOf('quad-curves').model.characters.get(1)?.vectorShape;
    expect(shape?.edges).toHaveLength(4); // three straight + one curve closes the path
    expect(shape?.edges.filter((edge) => edge.controlX !== undefined)).toHaveLength(2);
  });

  it('round-trips line styles: caps, joins, miter factor and the hairline width', () => {
    const round = modelOf('stroke-round-caps').model.characters.get(1)?.vectorShape;
    expect(round?.styles.lines[1]).toMatchObject({ width: 160, caps: { start: 0, end: 0 }, join: 0 });
    const square = modelOf('stroke-square-caps').model.characters.get(1)?.vectorShape;
    expect(square?.styles.lines[1]).toMatchObject({ width: 160, caps: { start: 2, end: 2 }, join: 1 });
    const miter = modelOf('stroke-miter-join').model.characters.get(1)?.vectorShape;
    // The decoder divides the 8.8 MiterLimitFactor once; 3.0 must come back as 3, not 768 or 0.01.
    expect(miter?.styles.lines[1]).toMatchObject({ width: 200, join: 2, miterLimit: 3 });
    const hairline = modelOf('hairline-stroke').model.characters.get(1)?.vectorShape;
    expect(hairline?.styles.lines[1]?.width).toBe(0);
  });

  it('round-trips CXFORM multiply and add terms', () => {
    const mult = placements('cxform-mult', 0)[0];
    expect(mult?.cxform).toMatchObject({ rm: 256, gm: 256, bm: 256, am: 128 });
    const add = placements('cxform-add', 0)[0];
    expect(add?.cxform).toMatchObject({ ra: 102, ga: 154, ba: 205, aa: 0 });
  });

  it('round-trips matrices: translation, scale and rotation', () => {
    const scale = placements('matrix-scale', 0)[0];
    expect(scale?.matrix).toMatchObject({ a: 2, b: 0, c: 0, d: 2, tx: 800, ty: 800 });
    const rotate = placements('matrix-rotate', 0)[0];
    expect(rotate?.matrix?.a).toBeCloseTo(46341 / 65536, 6);
    expect(rotate?.matrix?.b).toBeCloseTo(-46341 / 65536, 6);
    expect(rotate?.matrix?.tx).toBe(2000);
    expect(rotate?.matrix?.ty).toBe(1500);
  });

  it('round-trips depth order, removals and visibility', () => {
    const ordered = modelOf('depth-order').model.mainTimeline.frames[0]?.ops ?? [];
    expect(ordered.map((op) => op.depth)).toEqual([2, 5]);
    const frames = modelOf('timeline-frames').model.mainTimeline.frames;
    expect(frames.map((frame) => frame.ops.length)).toEqual([1, 1, 1]);
    expect(frames[1]?.ops[0]).toMatchObject({ kind: 'place', move: true, depth: 1 });
    expect(frames[2]?.ops[0]).toMatchObject({ kind: 'remove', depth: 1 });
    const invisible = placements('invisible-placement', 0)[0];
    expect(invisible?.visible).toBe(false);
  });

  it('round-trips the clipDepth mask and the stress grid', () => {
    const mask = placements('clip-mask', 0);
    expect(mask[0]).toMatchObject({ depth: 1, clipDepth: 4 });
    expect(placements('stress-grid', 0)).toHaveLength(24);
  });

  it('round-trips sprite structure: nesting and per-sprite frame counts', () => {
    const nested = modelOf('sprite-nested').model;
    expect(nested.characters.get(6)?.sprite?.declaredFrameCount).toBe(1);
    const loop = modelOf('sprite-loop').model;
    expect(loop.characters.get(5)?.sprite?.declaredFrameCount).toBe(2);
    // Frame 2 of the sprite does two things: drop the red square and place the blue one.
    expect(loop.characters.get(5)?.sprite?.timeline.frames.map((frame) => frame.ops.length)).toEqual([1, 2]);
  });
});
