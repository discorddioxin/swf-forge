/** Test-support entry point (`./test-support`): deterministic fixture builders, no reader imports. */
export {
  ByteWriter,
  actionBlock,
  buildSwf,
  concat,
  defineSprite,
  defineTag,
  endTag,
  minimalSwf,
  placeObject2,
  placeObjectV1,
  showFrames,
  soundStreamBlock,
  soundStreamHead,
  startSound,
  tag,
  writeRect,
} from './writer.js';
export type { SwfFixtureOptions, WriterDefect } from './writer.js';
export {
  FIXTURE_TWIPS,
  backgroundColor,
  defineShape,
  place,
  removeObject2,
  staticFixtures,
} from './static-fixtures.js';
export type {
  LineSpec,
  PathSpec,
  PlacementSpec,
  Pt,
  Segment,
  ShapeSpec,
  Solid,
  StaticFixture,
} from './static-fixtures.js';
