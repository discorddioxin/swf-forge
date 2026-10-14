/**
 * Stage `read` — `CMP` §2 S0 Load + S1 Parse, `IMPL-120` §2's `read → openSwf, index, dictionary`.
 *
 * One stage, not two: `WP-020-10`'s `SwfFile` facade decompresses, validates the header, builds the tag
 * index and collects the dictionary in a single pass, and re-doing the parse here would mean a second
 * reader. What this stage adds is the pipeline's own accounting — the sha256 that keys everything
 * downstream (`IMPL-120-R021`) and the counts the report needs.
 *
 * Recovery policy: `soft`, so a malformed input yields a partial model plus diagnostics rather than a
 * throw, and `inspect` still works on input whose later stages would fail (`IMPL-120-R027`). Strict mode
 * is a caller choice (`SwfOpenOptions.mode`) and surfaces as a `SwfReadError`, which the runner records
 * as a failed stage.
 */

import { compressionOf } from '@swf-forge/swf';
import { openSwfNodeSync } from '@swf-forge/swf/node';

import type { PipelineState, ReadArtifact, Stage, StageContext, StageOutcome } from '../pipeline.js';

export interface ReadStageOptions {
  readonly strict?: boolean;
  readonly strictLength?: boolean;
}

/** @param inputName the input path as the run knows it — declared as this stage's read effect (`CMP-R003`). */
export function readStage(inputName: string, options: ReadStageOptions = {}): Stage {
  return {
    id: 'read',
    effects: { reads: [inputName], writes: [] },
    run(_state: PipelineState, ctx: StageContext): StageOutcome {
      const file = openSwfNodeSync(ctx.input.bytes, {
        mode: options.strict === true ? 'strict' : 'soft',
        strictLength: options.strictLength ?? false,
        sink: ctx.diagnostics,
      });
      const artifact: ReadArtifact = {
        file,
        bytes: ctx.input.bytes,
        sha256: file.sha256,
        version: file.version,
        compression: compressionOf(ctx.input.bytes) ?? 'none',
        tagCount: file.tagIndex.tags.length,
        definitionCount: file.definitions.length,
        spriteRangeCount: file.tagIndex.spriteRanges.size,
      };
      return { state: { read: artifact } };
    },
  };
}
