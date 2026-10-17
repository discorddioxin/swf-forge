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

import { buildMovieModel, type Diagnostic, type SwfFile, type TagRef } from '@swf-forge/swf';

/**
 * Only `error`-severity diagnostics are attributed to a payload, and only when their offset falls inside the
 * tag's own span.
 *
 * The temptation is to widen this to the soft-read codes (`SF0013`, `SF0010`), which mean "a value was zeroed
 * so the reader could continue" — exactly the hole `IMPL-120-R005` cannot tolerate. It cannot be done from an
 * offset: a soft over-read records where the cursor *ended up*, which is past the tag's declared limit and
 * usually inside the *next* tag's bytes. Measured on a three-byte `DefineShape`: the tag spans `[0, 5)` and
 * the diagnostic reports offset `7`. Attribution therefore has to come from the reader, which is errata
 * `E-046`; until that lands, a silently truncated payload stays invisible to every consumer, and this pass
 * says so in its report rather than guessing.
 */
function isReadInterruption(diagnostic: Diagnostic): boolean {
  return diagnostic.severity === 'error';
}

export function readInterruptionsFor(
  diagnostics: readonly Diagnostic[],
  characters: Iterable<[number, { readonly index: TagRef | null }]>,
): { readonly characterId: number; readonly code: string }[] {
  const flagged = diagnostics.filter(isReadInterruption);
  if (flagged.length === 0) return [];
  const out: { characterId: number; code: string }[] = [];
  for (const [characterId, character] of characters) {
    const index = character.index;
    if (index === null) continue;
    // `offset` is the payload start and `length` covers the header too, so the span is header→payload end.
    const start = index.headerOffset ?? index.offset;
    const end = start + index.length;
    for (const diagnostic of flagged) {
      if (diagnostic.offset >= start && diagnostic.offset < end) {
        out.push({ characterId, code: diagnostic.code });
        break;
      }
    }
  }
  return out.sort((a, b) => a.characterId - b.characterId);
}

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
    run(state: PipelineState, ctx: StageContext): StageOutcome {
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
        readInterruptions: readInterruptionsFor(
          ctx.diagnostics.list(),
          [...model.characters].map(([id, character]) => [id, { index: character.index }]),
        ),
      };
      return { state: { model: artifact } };
    },
  };
}
