/**
 * The P4 gate, end to end over a real file: `fixtures/appendix-a.swf` decoded, modelled, flattened and
 * rendered to pixels — then encoded to PNG twice to prove the bytes are identical (`REPO-R015`).
 *
 * The appendix shape is a 1-pixel black rectangle outline from (101, 84) to (245, 200) px with no
 * fill, so the expectations below are exact: the four edges land on those pixel rows and columns.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { Cursor, buildMovieModel, decodeDefineShapeVersion, openSwf, type SwfFile, type TagRef } from '@swf-forge/swf';
import {
  applyOps,
  collectDrawItems,
  encodePng,
  readPixel,
  renderFrame,
  type DrawItem,
  type ShapeGeometry,
} from '@swf-forge/gfx';

import { cxformToGfx, matrixToTransform, shapeToGeometry } from './adapter.js';

const WHITE = { r: 255, g: 255, b: 255, a: 255 };

const FIXTURE = fileURLToPath(new URL('../../../fixtures/appendix-a.swf', import.meta.url));

function fixtureBytes(): Uint8Array {
  return new Uint8Array(readFileSync(FIXTURE));
}

function decodeShape(file: SwfFile, ref: TagRef): ShapeGeometry {
  const cursor = new Cursor(file.body, ref.offset, ref.offset + ref.length, {
    sink: file.sink,
    version: file.version,
    tagCode: ref.code,
  });
  return shapeToGeometry(String(ref.index), decodeDefineShapeVersion(ref.code, cursor).shape);
}

/** Frame 0 of the main timeline, flattened to draw items (matrices converted twips → px). */
function frameZero(file: SwfFile): DrawItem[] {
  const movie = buildMovieModel(file);
  const frame = movie.mainTimeline.frames[0];
  if (!frame) throw new Error('fixture has no frame 0');

  const ops = frame.ops.map((op) =>
    op.kind === 'place'
      ? {
          ...op,
          matrix: op.matrix ? matrixToTransform(op.matrix) : null,
          cxform: cxformToGfx(op.cxform),
        }
      : op,
  );
  const entries = applyOps([], ops);

  const geometries = new Map<number, ShapeGeometry>();
  for (const [id, character] of movie.characters) geometries.set(id, decodeShape(file, character.index));

  return collectDrawItems(entries, (characterId) => {
    const geometry = geometries.get(characterId);
    return geometry ? { geometry } : null;
  });
}

describe('appendix-a static render', () => {
  it('renders the shape as a closed black rectangle outline on the white stage', () => {
    const file = openSwf(fixtureBytes());
    const image = renderFrame(frameZero(file), { width: 550, height: 400, background: 0xffffff });

    expect(readPixel(image, 0, 0)).toEqual(WHITE);
    expect(readPixel(image, 549, 399)).toEqual(WHITE);
    // Interior stays empty: the appendix shape declares no fill styles.
    expect(readPixel(image, 150, 140)).toEqual(WHITE);

    // The stroke is 20 twips wide (1 px) and centred on the path, so each edge lands half on each of
    // two pixel rows/columns: the outline spans x = 100..102 and 244..246, y = 83..85 and 199..201.
    const GREY = { r: 128, g: 128, b: 128, a: 255 };
    expect(readPixel(image, 100, 150)).toEqual(GREY);
    expect(readPixel(image, 101, 150)).toEqual(GREY);
    expect(readPixel(image, 99, 150)).toEqual(WHITE);
    expect(readPixel(image, 102, 150)).toEqual(WHITE);

    expect(readPixel(image, 244, 150)).toEqual(GREY);
    expect(readPixel(image, 245, 150)).toEqual(GREY);
    expect(readPixel(image, 243, 150)).toEqual(WHITE);
    expect(readPixel(image, 246, 150)).toEqual(WHITE);

    expect(readPixel(image, 150, 83)).toEqual(GREY);
    expect(readPixel(image, 150, 84)).toEqual(GREY);
    expect(readPixel(image, 150, 82)).toEqual(WHITE);
    expect(readPixel(image, 150, 85)).toEqual(WHITE);

    expect(readPixel(image, 150, 199)).toEqual(GREY);
    expect(readPixel(image, 150, 200)).toEqual(GREY);
    expect(readPixel(image, 150, 198)).toEqual(WHITE);
    expect(readPixel(image, 150, 201)).toEqual(WHITE);
  });

  it('reports the shape geometry the appendix describes: one stroke run, four edges, no fills', () => {
    const file = openSwf(fixtureBytes());
    const movie = buildMovieModel(file);
    const character = movie.characters.get(1);
    expect(character).toBeDefined();
    const cursor = new Cursor(file.body, character!.index.offset, character!.index.offset + character!.index.length, {
      sink: file.sink,
      version: file.version,
    });
    const { shape } = decodeDefineShapeVersion(character!.index.code, cursor);
    expect(shape.paths).toEqual([]);
    expect(shape.strokes).toEqual([{ styleId: 1, edgeRefs: [0, 1, 2, 3], closed: true }]);
    expect(shape.styles.lines[1]).toMatchObject({ width: 20, color: { r: 0, g: 0, b: 0, a: 255 } });
    expect(shape.fillRule).toBe('evenOdd');
  });

  it('encodes the frame deterministically', () => {
    const file = openSwf(fixtureBytes());
    const image = renderFrame(frameZero(file), { width: 550, height: 400, background: 0xffffff });
    const first = encodePng(image);
    const second = encodePng(image);
    expect(Array.from(first)).toEqual(Array.from(second));
    expect(first.length).toBeGreaterThan(100);
  });
});
