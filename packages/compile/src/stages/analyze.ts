/**
 * Stage `analyze` — `CMP` §2 S5 VM front end + S6 VM analyse, `IMPL-120` §2's
 * `analyze → AVM1 front end → IR → tiers → requirements`.
 *
 * One stage, not two: `WP-050-*` delivers `analyzeMovie`, which decodes every action block to `ActionIR`,
 * assigns tier verdicts and recovers names in a single pass. Splitting S5 from S6 here would mean either
 * re-running the front end or inventing a seam the supplier does not have.
 *
 * What this stage adds is the pipeline-level projection the passes and the emitter consume: the host-API
 * requirement union over *every* basic block including nested function bodies and region bodies
 * (`IMPL-120-R006`'s input), and the tier counts. The AVM2 gate is `CMP-R031`'s: `analyzeMovie` emits
 * `SF1000` and this stage stops the run with `refused`, because silently compiling nothing is worse than
 * refusing.
 *
 * `legacyEncoding` is the caller's choice and stays one: doc 050 §13 criterion 3's `ActionStringLength`
 * question (byte versus character length for SWF ≤ 5) has no oracle yet, so P6 inherits the library
 * default rather than guessing a second time.
 */

import { analyzeMovie, extractRequirements } from '@swf-forge/avm1';
import type { ActionIR, AnalyzedBlock, BasicBlock, LegacyStringEncoding } from '@swf-forge/avm1';
import { sha256Hex } from '@swf-forge/swf/node';

import { structuralStageCodec } from '../codec.js';
import { requireArtifact } from '../pipeline.js';
import type { AnalysisArtifact, PipelineState, Stage, StageContext, StageOutcome } from '../pipeline.js';

export interface AnalyzeStageOptions {
  readonly legacyEncoding?: LegacyStringEncoding;
}

/**
 * Every `ActionIR` in the movie: the root action blocks, then each nested `DefineFunction*` body,
 * depth-first. `ActionIR.blocks` is already flat — it carries a region's bodies as well as its own blocks
 * — so only function nesting needs walking. The `visited` guard is the one the decompiler's tier report
 * uses: a structured region can reach the same nested IR through more than one block path.
 *
 * `apps/decompiler/src/commands/analyze.ts` carries an equivalent recursion. Collapsing the two into an
 * exported walker in `@swf-forge/avm1` is recorded as a P6 open item rather than done here, because it
 * changes P5's public surface.
 */
export function nestedIrs(roots: readonly AnalyzedBlock[]): ActionIR[] {
  const out: ActionIR[] = [];
  const visited = new Set<string>();

  const visit = (ir: ActionIR): void => {
    if (visited.has(ir.id)) return;
    visited.add(ir.id);
    out.push(ir);
    for (const block of ir.blocks) {
      for (const op of block.ops) {
        if (op.kind === 'define' && op.fn.ir !== null) visit(op.fn.ir);
      }
    }
  };

  for (const root of roots) visit(root.ir);
  return out;
}

function allBlocks(irs: readonly ActionIR[]): BasicBlock[] {
  const out: BasicBlock[] = [];
  for (const ir of irs) out.push(...ir.blocks);
  return out;
}

/** The library default, named here so the cache key moves if a caller overrides it. */
const DEFAULT_LEGACY_ENCODING: LegacyStringEncoding = 'windows-1252';

export function analyzeStage(options: AnalyzeStageOptions = {}): Stage {
  const legacyEncoding = options.legacyEncoding ?? DEFAULT_LEGACY_ENCODING;
  return {
    id: 'analyze',
    effects: { reads: [], writes: [] },
    /**
     * The whole `MovieAnalysis` is data — the IR has no `Map`, `Set`, function or byte field, and the three
     * `ReadonlyMap`s around it (the schedule's sprite index and the two name tables) are what
     * `structuralStageCodec` exists for. This is the first stage worth caching: whole-movie IR construction,
     * stack simulation and tiering are the expensive part of a decompilation pass, and a porting workflow
     * re-runs it on every edit.
     *
     * The input hash covers the movie bytes (the model is derived from them, so one hash covers both) *and*
     * this stage's own options. Options are inputs; a key that did not move when `legacyEncoding` changed
     * would serve an analysis decoded with the wrong string semantics.
     */
    codec: structuralStageCodec,
    inputHash: (state, ctx) => {
      const movie = state.read?.sha256 ?? ctx.input.sha256;
      return sha256Hex(new TextEncoder().encode(`${movie}\u0000${legacyEncoding}`));
    },
    run(state: PipelineState, ctx: StageContext): StageOutcome {
      const read = requireArtifact(state.read, 'analyze', 'read');
      const model = requireArtifact(state.model, 'analyze', 'model');

      const analysis = analyzeMovie(read.file, model.model, {
        // `Emit` carries the code as a plain string; the sink wants the registry's branded form.
        emit: (code, severity, message, offset, context) => {
          ctx.diagnostics.emit({
            code: code as `SF${number}`,
            severity,
            message,
            offset,
            context: context ?? 'avm1',
          });
        },
        legacyEncoding,
      });

      const irs = nestedIrs(analysis.blocks);
      const tiers = { T0: 0, T1: 0, T2: 0 };
      for (const ir of irs) {
        if (ir.tier === 0) tiers.T0 += 1;
        else if (ir.tier === 1) tiers.T1 += 1;
        else tiers.T2 += 1;
      }

      const artifact: AnalysisArtifact = {
        analysis,
        requirements: extractRequirements(allBlocks(irs)),
        actionBlockCount: analysis.blocks.length,
        functionCount: irs.length - analysis.blocks.length,
        tiers,
      };

      if (analysis.avm2.present) {
        return {
          state: { analysis: artifact },
          stop: 'refused',
          stopReason: analysis.avm2.reason === '' ? 'AVM2 content detected' : analysis.avm2.reason,
        };
      }
      return { state: { analysis: artifact } };
    },
  };
}
