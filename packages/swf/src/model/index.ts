/** The model layer (`CMP` §3): timelines, sprites and the movie aggregate. */
export { assembleTimeline, openTagCursor } from './timeline.js';
export { buildMovieModel, fallbackId } from './movie.js';
export type { AssembleTimelineOptions } from './timeline.js';
export type { BuildMovieOptions } from './movie.js';
export type {
  CharacterModel,
  DisplayOp,
  FileAttributesModel,
  Fixed8_8,
  FrameModel,
  ImportEntry,
  InitActionBlock,
  MovieControlModel,
  MovieModel,
  SetTabIndexOp,
  SpriteModel,
  StageModel,
  StreamSoundModel,
  StreamSoundSpan,
  TimelineModel,
} from './types.js';
