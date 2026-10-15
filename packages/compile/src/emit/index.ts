/**
 * The `emit` stage (`WP-120-08`).
 *
 * The stage is deliberately thin: every decision lives in `files.ts`/`lower.ts` as a pure function over the
 * artifacts, so the emitter can be exercised without a filesystem and `T-CMP-003`'s double-build claim rests
 * on a function rather than on a writer. Writing is `WP-120-13`'s job — the runner collects `EmittedFile`s and
 * the CLI owns the disk, which is what lets `--dry-run` print a plan without touching a directory.
 *
 * `IMPL-120-R012` is the precondition this stage enforces: emission may not begin before the name table is
 * closed, because a file written from a table that can still grow is a file whose symbols the next pass cannot
 * agree with. Hence `names` is required here and `frames` is not: the frame plan refines what a movie module
 * looks like, but a missing plan is a *less* grouped output, not an inconsistent one.
 */

import { Codes } from '@swf-forge/swf';

import { configHash } from '../config.js';
import { requireArtifact } from '../pipeline.js';
import type { Stage, StageContext, StageOutcome } from '../pipeline.js';
import type { EmitInput, EmitPlan } from './files.js';
import { emitFiles } from './files.js';
import type { ResidualPolicy } from './residual.js';

/** What the stage produced, in a shape the report passes (`WP-120-11`) can consume without re-deriving. */
export interface EmitArtifact {
  readonly plan: EmitPlan;
  readonly fileCount: number;
  readonly bytes: number;
  /** True when at least one block was deferred to `WP-120-09`; the exit gate reads this. */
  readonly hasDeferred: boolean;
  /** The residual entries the run emitted, for `CMP-R026`'s `reports/` entry (byte count + reason travel in it). */
  readonly residualCount: number;
  readonly residualBytes: number;
  /** The `--vm.residual` value the plan honoured, echoed so the report never has to re-read the config. */
  readonly residualPolicy: ResidualPolicy;
}

export interface EmitStageOptions {
  /**
   * The `--sourcemap` value. `CMP-R014` defaults to `file`, and this phase cannot honour that yet: statement
   * maps need a byte offset per op and `ActionIR` records ranges per block only (errata `E-047`). A build
   * asking for maps therefore gets a warning naming the gap rather than a `.map` file that would be wrong.
   */
  readonly sourceMaps?: 'file' | 'inline' | 'none';
}

/** The emitter's file effects. Globs, because the set is a function of the movie: one timeline module per sprite. */
const EMIT_EFFECTS = {
  reads: [],
  writes: ['src/**', 'assets/**', 'tsconfig.json', 'eslint.config.mjs', 'package.json'],
} as const;

const encoder = new TextEncoder();

export function emitStage(options: EmitStageOptions = {}): Stage {
  const sourceMaps = options.sourceMaps ?? 'file';
  return {
    id: 'emit',
    effects: EMIT_EFFECTS,
    run(state, ctx: StageContext): StageOutcome {
      const read = requireArtifact(state.read, 'emit', 'read');
      const model = requireArtifact(state.model, 'emit', 'model');
      const analysis = requireArtifact(state.analysis, 'emit', 'analyze');
      if (state.names === undefined) {
        throw new Error('stage emit needs the `names` pass to have closed the symbol table (IMPL-120-R012)');
      }

      // A block the pruning pass *removed* is not emitted. The distinction from `WP-120-04` matters: a block
      // that was a candidate but survived still runs, so it must still be emitted.
      const pruned = new Set(
        (state.deadCode?.blocks ?? []).filter((verdict) => verdict.state === 'pruned').map((verdict) => verdict.irId),
      );
      const blocks = analysis.analysis.blocks.map((entry) => entry.ir).filter((ir) => !pruned.has(ir.id));

      const input: EmitInput = {
        file: read.file,
        model: model.model,
        blocks,
        table: state.names,
        frames: state.frames ?? null,
        shake: state.shake ?? null,
        residualPolicy: ctx.config.vm.residual,
        toolConfigHash: configHash(ctx.config, 'emit'),
        header: {
          toolVersion: ctx.toolVersion,
          inputName: ctx.input.name,
          sha256: ctx.input.sha256,
          movie: 'main',
        },
      };
      const plan = emitFiles(input);

      // `SF0507`/`SF0508`: the manifest's two partial states. A section whose inputs live in the asset planner
      // is reported as withheld rather than zero-filled (`IMPL-120-R019` forbids the two artifacts disagreeing,
      // and an empty `textures` map is a claim about the movie this build cannot make); a value with no JSON
      // spelling is a defect in what the emitter tried to say, and a manifest of `null`s would be worse than none.
      if (plan.manifest !== null && plan.manifest.withheld.length > 0) {
        ctx.diagnostics.emit({
          code: Codes.MANIFEST_SECTIONS_WITHHELD ?? 'SF0507',
          severity: 'warning',
          message:
            `forge.manifest.json omits ${plan.manifest.withheld.join(', ')}: those sections come from the asset ` +
            'planner (WP-120-07), which this phase has not built, and an empty map would state something about the movie that no input proves',
          offset: 0,
          context: 'compile',
        });
      }
      if (plan.manifestError !== null) {
        ctx.diagnostics.emit({
          code: Codes.MANIFEST_UNSERIALIZABLE ?? 'SF0508',
          severity: 'error',
          message: `no manifest was written: ${plan.manifestError}`,
          offset: 0,
          context: 'compile',
        });
      }

      // `SF0505`: a descriptor that would have lied. The block stays in the deferred set, which is the same
      // outcome the emitter had before the residual path existed, but the reason is a front-end bug rather than
      // a lowering limit and has to be visible as one.
      for (const entry of plan.invalidResidual) {
        ctx.diagnostics.emit({
          code: Codes.RESIDUAL_DESCRIPTOR_INVALID ?? 'SF0505',
          severity: 'warning',
          message: `no residual blob for ${entry.subjectId}: ${entry.error}`,
          offset: 0,
          context: 'compile',
        });
      }

      // `--vm.residual=forbid` (`IMPL-050-R060`, `CMP-R026`): no blob is written, so every T2 function is a
      // build failure rather than a note, and the list has to name each one with its size and reason.
      if (ctx.config.vm.residual === 'forbid') {
        for (const ir of blocks) {
          if (ir.tier !== 2) continue;
          const subject = `block:${ir.id}`;
          ctx.diagnostics.emit({
            code: Codes.RESIDUAL_FORBIDDEN ?? 'SF0506',
            severity: 'error',
            message:
              `--vm.residual=forbid: ${state.names.bySubject.get(subject) ?? subject} is tier 2 ` +
              `(${ir.byteRange.end - ir.byteRange.start} bytes: ${ir.tierReasons.join(', ') || 'no reason recorded'}) ` +
              'and cannot be emitted as TypeScript',
            offset: 0,
            context: 'compile',
          });
        }
      }

      ctx.diagnostics.emit({
        code: Codes.SOURCEMAP_WITHHELD ?? 'SF0504',
        severity: 'warning',
        message:
          `--sourcemap=${sourceMaps} was requested but no map was written: the IR records byte ranges per action block, ` +
          'not per statement, so statement-level mappings would attribute lines to offsets they did not come from (E-047)',
        offset: 0,
        context: 'compile',
      });

      const files = [];
      for (const file of plan.files) {
        // Cancellation inside the render loop (`IMPL-120-R003`): a movie with 400 sprites should stop between
        // files rather than after the whole stage. The runner turns the throw into a `cancelled` status and
        // writes nothing, which is why a half-emitted run cannot reach the disk.
        ctx.cancel.throwIfCancelled();
        files.push({ path: file.path, bytes: encoder.encode(file.text) });
      }

      const artifact: EmitArtifact = {
        plan,
        fileCount: plan.files.length,
        bytes: plan.counts.bytes,
        // A block that ended up as a residual entry runs, so it is not "deferred": what the exit gate reads is
        // whether anything is left with neither a lowered function nor a blob.
        hasDeferred: plan.decisions.some((entry) => entry.action === 'deferred to WP-120-09'),
        residualCount: plan.residual.length,
        residualBytes: plan.counts.residualBytes,
        residualPolicy: input.residualPolicy ?? 'on-demand',
      };
      return { state: { emit: artifact }, files };
    },
  };
}
