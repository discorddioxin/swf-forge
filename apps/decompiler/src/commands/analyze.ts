/**
 * `analyze --tiers` — deterministic per-action-block and per-function AVM1 tier report.
 *
 * The analysis engine owns the AVM1 semantics; this command only opens the movie, builds its model,
 * and presents every root action block plus each recursively nested `DefineFunction*` body. A nested
 * T2 body is reported independently and never hidden by its parent's tier (IMPL-050-R059).
 */

import { readFileSync } from 'node:fs';

import { analyzeMovie, type ActionIR, type BlockKind, type TierReason } from '@swf-forge/avm1';
import { buildMovieModel, DiagnosticSink, SwfReadError, type Diagnostic, type SwfFile } from '@swf-forge/swf';
import { openSwfNodeSync, sha256Hex } from '@swf-forge/swf/node';

import { EXIT, exitForDiagnostics, type CliIo } from '../exit.js';

export interface AnalyzeRequest {
  readonly file: string;
  readonly tiers: boolean;
  readonly json: boolean;
  readonly strict?: boolean;
  readonly strictLength?: boolean;
  readonly strictTimeline?: boolean;
}

export interface TierReportEntry {
  readonly id: string;
  readonly kind: BlockKind;
  readonly role: 'actionBlock' | 'function';
  readonly parentId: string | null;
  readonly name: string | null;
  readonly tier: 0 | 1 | 2;
  readonly reasons: readonly TierReason[];
  readonly residualBytes: number;
  readonly byteRange: { readonly start: number; readonly end: number };
  readonly frameAssociations: readonly number[];
}

export interface AnalyzeTierReport {
  readonly schemaVersion: 1;
  readonly file: { readonly path: string; readonly bytes: number; readonly sha256: string };
  readonly movie: { readonly swfVersion: number; readonly compression: string; readonly frameCount: number };
  readonly avm2: { readonly present: boolean; readonly reason: string | null; readonly offset: number | null };
  readonly counts: {
    readonly actionBlocks: number;
    readonly functions: number;
    readonly T0: number;
    readonly T1: number;
    readonly T2: number;
  };
  /** Stable analysis order: schedule order, then nested functions depth-first. */
  readonly entries: readonly TierReportEntry[];
  readonly diagnostics: {
    readonly total: number;
    readonly errors: number;
    readonly warnings: number;
    readonly infos: number;
    readonly items: readonly Diagnostic[];
  };
}

function pushIrEntry(
  ir: ActionIR,
  role: TierReportEntry['role'],
  parentId: string | null,
  names: ReadonlyMap<string, string>,
  entries: TierReportEntry[],
  visited: Set<string>,
): void {
  // Function ids are source-offset based. The guard also prevents accidental double reporting if
  // a structured region points at the same nested IR through more than one block path.
  if (visited.has(ir.id)) return;
  visited.add(ir.id);

  const name = names.get(ir.id) ?? ir.sourceName;
  entries.push({
    id: ir.id,
    kind: ir.kind,
    role,
    parentId,
    name,
    tier: ir.tier,
    reasons: ir.tierReasons,
    residualBytes: ir.residual?.reduce((sum, slice) => sum + slice.length, 0) ?? 0,
    byteRange: ir.byteRange,
    frameAssociations: ir.frameAssociations,
  });

  const visitBlocks = (blocks: ActionIR['blocks']): void => {
    for (const block of blocks) {
      for (const op of block.ops) {
        if (op.kind === 'define' && op.fn.ir !== null) {
          pushIrEntry(op.fn.ir, 'function', ir.id, names, entries, visited);
        } else if (op.kind === 'try') {
          visitBlocks(op.region.tryBlocks);
          if (op.region.catchBlocks !== null) visitBlocks(op.region.catchBlocks);
          if (op.region.finallyBlocks !== null) visitBlocks(op.region.finallyBlocks);
        } else if (op.kind === 'with') {
          visitBlocks(op.region.bodyBlocks);
        }
      }
    }
  };
  visitBlocks(ir.blocks);
}

function printDiagnostics(sink: DiagnosticSink, io: CliIo): void {
  for (const diagnostic of sink.list()) {
    io.err(
      `  ${String(diagnostic.code)}  ${diagnostic.severity.padEnd(7)} @${diagnostic.offset}  ${diagnostic.message}`,
    );
  }
}

function renderReport(report: AnalyzeTierReport): string[] {
  const { counts } = report;
  const lines = [
    `${report.file.path} — SWF ${report.movie.swfVersion}, ${report.movie.compression}, ${report.file.bytes} byte(s)`,
    `AVM1 tiers: ${counts.actionBlocks} action block(s), ${counts.functions} nested function(s); T0=${counts.T0}, T1=${counts.T1}, T2=${counts.T2}`,
  ];
  if (report.avm2.present) {
    lines.push(
      `AVM2 content: ${report.avm2.reason ?? 'detected'} (SF1000 @${report.avm2.offset ?? 0}); AVM1 analysis refused`,
    );
  }
  for (const entry of report.entries) {
    const label = entry.role === 'function' ? 'function' : entry.kind;
    const name = entry.name === null ? '' : ` "${entry.name}"`;
    const parent = entry.parentId === null ? '' : ` parent=${entry.parentId}`;
    const reasons = entry.reasons.length > 0 ? ` — ${entry.reasons.map((reason) => reason.reason).join(', ')}` : '';
    const residual = entry.tier === 2 ? ` residual=${entry.residualBytes}B` : '';
    lines.push(`  T${entry.tier} ${label} ${entry.id}${name}${parent}${residual}${reasons}`);
  }
  const { total, errors, warnings, infos } = report.diagnostics;
  lines.push(`Diagnostics: ${total} (${errors} error(s), ${warnings} warning(s), ${infos} info)`);
  return lines;
}

export function runAnalyze(request: AnalyzeRequest, io: CliIo): number {
  if (!request.tiers) {
    io.err('analyze currently requires --tiers');
    return EXIT.unreadable;
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(request.file));
  } catch (error) {
    io.err(`cannot read ${request.file}: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT.unreadable;
  }

  const sink = new DiagnosticSink();
  let file: SwfFile;
  try {
    file = openSwfNodeSync(bytes, {
      mode: request.strict ? 'strict' : 'soft',
      strictLength: request.strictLength ?? false,
      sink,
    });
  } catch (error) {
    printDiagnostics(sink, io);
    const message = error instanceof Error ? error.message : String(error);
    if (error instanceof SwfReadError) {
      io.err(`analyze: strict mode aborted: ${message}`);
      return EXIT.failed;
    }
    io.err(`analyze: ${message}`);
    return EXIT.unreadable;
  }

  const model = buildMovieModel(file, { strictTimeline: request.strictTimeline ?? false });
  // Keep the model build and the report on the same strict-timeline policy.
  const analysis = analyzeMovie(file, model, {
    emit: (code, severity, message, offset, context) => {
      file.sink.emit({
        code: code as `SF${number}`,
        severity,
        message,
        offset,
        context: context ?? 'avm1',
      });
    },
  });

  const report = makeReportFromAnalysis(file, request.file, bytes, analysis);
  if (request.json) io.out(JSON.stringify(report, null, 2));
  else for (const line of renderReport(report)) io.out(line);
  return exitForDiagnostics(file.sink.list());
}

function makeReportFromAnalysis(
  file: SwfFile,
  filePath: string,
  fileBytes: Uint8Array,
  analysis: ReturnType<typeof analyzeMovie>,
): AnalyzeTierReport {
  const entries: TierReportEntry[] = [];
  const visited = new Set<string>();
  for (const block of analysis.blocks) {
    pushIrEntry(
      block.ir,
      block.ir.kind === 'function' || block.ir.kind === 'classMethod' ? 'function' : 'actionBlock',
      null,
      analysis.names.names,
      entries,
      visited,
    );
  }
  const diagnostics = file.sink.list();
  const digest = sha256Hex(fileBytes);
  return {
    schemaVersion: 1,
    file: { path: filePath, bytes: fileBytes.length, sha256: digest },
    movie: {
      swfVersion: file.version,
      compression: file.header.compression,
      frameCount: file.header.frameCount,
    },
    avm2: {
      present: analysis.avm2.present,
      reason: analysis.avm2.present ? analysis.avm2.reason : null,
      offset: analysis.avm2.present ? analysis.avm2.offset : null,
    },
    counts: {
      actionBlocks: entries.filter((entry) => entry.role === 'actionBlock').length,
      functions: entries.filter((entry) => entry.role === 'function').length,
      T0: entries.filter((entry) => entry.tier === 0).length,
      T1: entries.filter((entry) => entry.tier === 1).length,
      T2: entries.filter((entry) => entry.tier === 2).length,
    },
    entries,
    diagnostics: {
      total: diagnostics.length,
      errors: diagnostics.filter((item) => item.severity === 'error').length,
      warnings: diagnostics.filter((item) => item.severity === 'warning').length,
      infos: diagnostics.filter((item) => item.severity === 'info').length,
      items: diagnostics,
    },
  };
}
