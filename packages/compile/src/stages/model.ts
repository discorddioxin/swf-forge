/**
 * Stage `model` — `CMP` §2 S2 Analyse, `IMPL-120` §2's `model → frames, sprites, control model`.
 *
 * Supplied by `WP-030-09` (P2): `buildMovieModel` assembles the timelines, the sprite tree, the symbol
 * table and the linkage map. This stage adds nothing to that work; it exists so the pipeline has a
 * stage boundary here — a cache key, a cancellation point, and a place for the counts the report needs.
 *
 * The model id is left to the model builder, which derives it from the content hash the `read` stage
 * already computed. Supplying one here would create a second notion of identity for the same bytes.
 */

import { buildMovieModel, type SwfFile } from '@swf-forge/swf';

import { requireArtifact } from '../pipeline.js';
import type { ModelArtifact, PipelineState, Stage, StageContext, StageOutcome } from '../pipeline.js';

export interface ModelStageOptions {
  /** `--strict-timeline`: a removal at an empty depth is reported instead of being a silent no-op. */
  readonly strictTimeline?: boolean;
  /** External SWFs keyed by their exact published URL; only these participate in import linking. */
  readonly imports?: ReadonlyMap<string, SwfFile>;
}

export function modelStage(options: ModelStageOptions = {}): Stage {
  return {
    id: 'model',
    effects: { reads: [], writes: [] },
    run(state: PipelineState, _ctx: StageContext): StageOutcome {
      const read = requireArtifact(state.read, 'model', 'read');
      const model = buildMovieModel(read.file, {
        strictTimeline: options.strictTimeline ?? false,
        ...(options.imports === undefined ? {} : { imports: options.imports }),
      });
      const artifact: ModelArtifact = {
        model,
        frameCount: model.frameCount,
        characterCount: model.characters.size,
        initActionCount: model.initActions.length,
      };
      return { state: { model: artifact } };
    },
  };
}
