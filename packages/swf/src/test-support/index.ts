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
