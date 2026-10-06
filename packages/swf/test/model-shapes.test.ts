/** Production dictionary integration for the static-shape decoder (P3 R-P3-02). */

import { describe, expect, it } from 'vitest';

import { Tag, buildMovieModel, openSwf } from '@swf-forge/swf';
import { ByteWriter, buildSwf, concat, endTag, showFrames, tag, writeRect } from '@swf-forge/swf/test-support';

const BOUNDS = { xMin: -40, xMax: 240, yMin: -20, yMax: 180 };

function shapeBody(id: number, tagCode: number): Uint8Array {
  const writer = new ByteWriter();
  writer.u16(id);
  writeRect(writer, BOUNDS);
  if (tagCode === Tag.DefineShape4) {
    writeRect(writer, BOUNDS);
    writer.u8(0x04); // UsesFillWindingRule
  }
  writer.u8(0).u8(0); // empty fill and line arrays
  writer.bits(0, 4).bits(0, 4).bits(0, 6).align(); // zero style widths, EndShapeRecord
  return writer.toUint8Array();
}

describe('static shapes in the production movie model', () => {
  it('T-MOD-124 exposes decoded VectorShape for all four static shape tags without re-parsing raw tags', () => {
    const body = concat(
      ...[Tag.DefineShape, Tag.DefineShape2, Tag.DefineShape3, Tag.DefineShape4].map((tagCode, index) =>
        tag(tagCode, shapeBody(index + 1, tagCode)),
      ),
      showFrames(1),
      endTag(),
    );
    const file = openSwf(buildSwf({ version: 10, body, frameCount: 1 }));
    const model = buildMovieModel(file);

    for (const [index, tagCode] of [Tag.DefineShape, Tag.DefineShape2, Tag.DefineShape3, Tag.DefineShape4].entries()) {
      const id = index + 1;
      const character = model.characters.get(id);
      expect(character?.index?.code).toBe(tagCode);
      expect(character?.vectorShape).toMatchObject({
        id,
        bounds: BOUNDS,
        edges: [],
        paths: [],
      });
      expect(character?.bounds).toEqual(BOUNDS);
    }
    expect(file.sink.list().filter((item) => item.severity === 'error')).toEqual([]);
  });
});
