/**
 * `inspect` — the first decompiler verb (`TECH-SPEC` §5.2, `CMP` §8).
 *
 * Opens a file through the Node entry point, builds the movie model and prints either a human report
 * or a JSON summary. Nothing here writes to disk: `inspect` is read-only by construction, which is why
 * it can be pointed at untrusted content (`SEC` §7).
 */

import { readFileSync } from 'node:fs';

import { analyzeMovie, disassembleMovie } from '@swf-forge/avm1';
import { buildMovieModel, codeInfo, DiagnosticSink, tagName } from '@swf-forge/swf';
import type { Diagnostic, MovieModel, SwfFile } from '@swf-forge/swf';
import { SwfReadError } from '@swf-forge/swf';
import { openSwfNodeSync, sha256Hex } from '@swf-forge/swf/node';

import { EXIT, exitForDiagnostics, type CliIo } from '../exit.js';

export interface InspectRequest {
  readonly file: string;
  readonly json: boolean;
  readonly verbose: boolean;
  readonly actions?: boolean;
  readonly strict?: boolean;
  readonly strictLength?: boolean;
  readonly strictTimeline?: boolean;
  /** `--tags`: list every indexed tag (index, code, depth, sprite, offset, length). */
  readonly tags?: boolean;
  /** `--symbols`: print the export/import name tables in full. */
  readonly symbols?: boolean;
}

/** The `--actions` payload, computed before the summary so the summary's shape stays `readonly`. */
export interface InspectActions {
  readonly avm2: { readonly present: boolean; readonly reason: string | null };
  readonly t2FrameScripts: readonly { readonly id: string; readonly reason: string | null }[];
  readonly blockCount: number;
  readonly disassembly: string;
}

export interface InspectSummary {
  readonly file: { readonly path: string; readonly bytes: number; readonly sha256: string };
  readonly compression: 'none' | 'zlib' | 'lzma';
  readonly version: number;
  readonly fileLength: number;
  readonly stage: {
    readonly widthPx: number;
    readonly heightPx: number;
    readonly widthTwips: number;
    readonly heightTwips: number;
  };
  readonly frameRate: number;
  readonly frameCount: number;
  readonly background: number;
  readonly id: string;
  readonly counts: {
    readonly tags: number;
    readonly definitions: number;
    readonly characters: number;
    readonly sprites: number;
    readonly frames: number;
    readonly exports: number;
  };
  readonly tags: readonly { readonly code: number; readonly name: string; readonly count: number }[];
  readonly characters: readonly { readonly id: number; readonly tag: string; readonly sprite: boolean }[];
  /** Export name → character id, in id order (always present; the human report prints the names). */
  readonly exports: readonly { readonly id: number; readonly name: string }[];
  /** Every definition in stream order, including shadowed duplicate ids. */
  readonly definitions: readonly {
    readonly id: number;
    readonly tag: string;
    readonly offset: number;
    readonly shadowed: boolean;
  }[];
  readonly labels: readonly string[];
  /** `--tags` only: the full tag index in file order. */
  readonly tagIndex?: readonly {
    readonly index: number;
    readonly code: number;
    readonly name: string;
    readonly depth: number;
    readonly inSprite: number | null;
    readonly offset: number;
    readonly length: number;
  }[];
  /** `--symbols` only: exports (with kinds) and the import table. */
  readonly symbols?: {
    readonly exports: readonly { readonly id: number; readonly name: string; readonly kind: string }[];
    readonly imports: readonly { readonly name: string; readonly url: string; readonly localId: number }[];
  };
  /** `--actions` only: the AVM1 front end's view of every action block. */
  readonly actions?: InspectActions;
  readonly diagnostics: {
    readonly total: number;
    readonly errors: number;
    readonly warnings: number;
    readonly infos: number;
    readonly items: readonly {
      readonly code: string;
      readonly severity: string;
      readonly offset: number;
      readonly count: number;
      readonly message: string;
    }[];
  };
}

function hex(value: number): string {
  return `#${(value & 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`;
}

function summarize(
  file: SwfFile,
  model: MovieModel,
  path: string,
  sha256: string,
  options: { readonly tags?: boolean; readonly symbols?: boolean; readonly actions?: InspectActions },
): InspectSummary {
  const histogram = new Map<number, number>();
  for (const tag of file.tagIndex.tags) histogram.set(tag.code, (histogram.get(tag.code) ?? 0) + 1);
  const tags = [...histogram.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([code, count]) => ({ code, name: tagName(code), count }));

  const characters = [...model.characters.values()]
    .sort((a, b) => a.id - b.id)
    .map((character) => ({ id: character.id, tag: character.tagName, sprite: character.sprite !== null }));
  const lastDefinitionIndex = new Map<number, number>();
  file.definitions.forEach((definition, index) => lastDefinitionIndex.set(definition.id, index));
  const definitions = file.definitions.map((definition, index) => ({
    id: definition.id,
    tag: tagName(definition.tagCode),
    offset: definition.offset,
    shadowed: lastDefinitionIndex.get(definition.id) !== index,
  }));
  // Export names in id order (WP-020-12: the names are part of the report, not just a count).
  const exports = [...(model.control.exportsById ?? new Map<number, string>()).entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, name]) => ({ id, name }));

  const items = file.diagnostics.map((d: Diagnostic) => ({
    code: String(d.code),
    severity: d.severity,
    offset: d.offset,
    count: d.count,
    message: d.message,
  }));

  const tagIndex =
    options.tags === true
      ? file.tagIndex.tags.map((t) => ({
          index: t.index,
          code: t.code,
          name: tagName(t.code),
          depth: t.depth,
          inSprite: t.inSprite,
          offset: t.offset,
          length: t.length,
        }))
      : undefined;

  const symbols =
    options.symbols === true
      ? {
          exports: exports.map(({ id, name }) => ({ id, name, kind: model.characters.get(id)?.kind ?? 'missing' })),
          imports: model.control.imports.map((entry) => ({
            name: entry.name,
            url: entry.url,
            localId: entry.localId,
          })),
        }
      : undefined;

  return {
    file: { path, bytes: file.sizes.file, sha256 },
    compression: file.header.compression,
    version: file.header.version,
    fileLength: file.header.fileLength,
    stage: {
      widthPx: file.header.frameSizePx.width,
      heightPx: file.header.frameSizePx.height,
      widthTwips: model.stage.widthTwips,
      heightTwips: model.stage.heightTwips,
    },
    frameRate: file.header.frameRate,
    frameCount: file.header.frameCount,
    background: model.background,
    id: model.id,
    counts: {
      tags: file.tagIndex.tags.length,
      definitions: file.definitions.length,
      characters: characters.length,
      sprites: characters.filter((c) => c.sprite).length,
      frames: model.mainTimeline.frames.length,
      exports: model.exported.size,
    },
    tags,
    characters,
    exports,
    definitions,
    labels: [...model.mainTimeline.labels.keys()].sort(),
    ...(tagIndex !== undefined ? { tagIndex } : {}),
    ...(symbols !== undefined ? { symbols } : {}),
    ...(options.actions !== undefined ? { actions: options.actions } : {}),
    diagnostics: {
      total: file.diagnostics.length,
      errors: file.diagnostics.filter((d) => d.severity === 'error').length,
      warnings: file.diagnostics.filter((d) => d.severity === 'warning').length,
      infos: file.diagnostics.filter((d) => d.severity === 'info').length,
      items,
    },
  };
}

function render(summary: InspectSummary, verbose: boolean): string[] {
  const s = summary;
  const lines: string[] = [];
  lines.push(
    `${s.file.path} — ${s.compression === 'none' ? 'FWS' : s.compression === 'zlib' ? 'CWS' : 'ZWS'}, version ${s.version}`,
  );
  lines.push(`  file size      ${s.file.bytes} byte(s) (declared ${s.fileLength})`);
  lines.push(
    `  stage          ${s.stage.widthPx} x ${s.stage.heightPx} px (${s.stage.widthTwips} x ${s.stage.heightTwips} twips), ${s.frameRate} fps`,
  );
  lines.push(`  frames         ${s.frameCount} declared, ${s.counts.frames} observed`);
  lines.push(`  background     ${hex(s.background)}`);
  lines.push(`  id             ${s.id}`);
  lines.push(`  characters     ${s.counts.characters} (${s.counts.sprites} sprite(s))`);
  for (const character of s.characters) {
    lines.push(`    #${character.id}  ${character.tag}${character.sprite ? ' (sprite)' : ''}`);
  }
  if (s.exports.length > 0) {
    lines.push(`  exports        ${s.exports.length}`);
    for (const entry of s.exports) {
      lines.push(`    #${entry.id}  ${entry.name}`);
    }
  }
  const duplicateIds = new Set(
    s.definitions.filter((definition) => definition.shadowed).map((definition) => definition.id),
  );
  if (duplicateIds.size > 0) {
    lines.push('  duplicate definitions');
    for (const definition of s.definitions.filter((entry) => duplicateIds.has(entry.id))) {
      lines.push(
        `    #${definition.id}  ${definition.tag} @${definition.offset}${definition.shadowed ? ' (shadowed)' : ' (winner)'}`,
      );
    }
  }
  if (s.labels.length > 0) lines.push(`  labels         ${s.labels.join(', ')}`);
  lines.push(`  tags           ${s.tags.map((t) => `${t.code}(${t.name})x${t.count}`).join(' ')}`);
  if (s.tagIndex !== undefined) {
    lines.push('  tag index');
    for (const entry of s.tagIndex) {
      lines.push(
        `    ${String(entry.index).padStart(4)}  ${String(entry.code).padStart(3)} (${entry.name.padEnd(16)})  d${entry.depth}  sprite ${entry.inSprite === null ? '–' : `#${entry.inSprite}`}  @${entry.offset}  ${entry.length} B`,
      );
    }
  }
  if (s.symbols !== undefined) {
    lines.push(`  symbols        ${s.symbols.exports.length} export(s), ${s.symbols.imports.length} import(s)`);
    for (const entry of s.symbols.exports) {
      lines.push(`    export  #${entry.id}  ${entry.name}  (${entry.kind})`);
    }
    for (const entry of s.symbols.imports) {
      lines.push(`    import  ${entry.name}  <- ${entry.url}  (local #${entry.localId})`);
    }
  }
  lines.push(
    `  diagnostics    ${s.diagnostics.total} (${s.diagnostics.errors} error(s), ${s.diagnostics.warnings} warning(s), ${s.diagnostics.infos} info)`,
  );
  for (const item of s.diagnostics.items) {
    if (!verbose && item.severity === 'info') continue;
    const meaning = codeInfo(item.code)?.meaning ?? '';
    lines.push(
      `    ${item.code}  ${item.severity.padEnd(7)} @${item.offset}${item.count > 1 ? ` x${item.count}` : ''}  ${item.message}${verbose && meaning ? ` — ${meaning}` : ''}`,
    );
  }
  return lines;
}

/** Print the diagnostics a partial open accumulated, one line each (`IMPL-020-R011`). */
function printDiagnostics(sink: DiagnosticSink, io: CliIo): void {
  for (const d of sink.list()) {
    io.err(`  ${String(d.code)}  ${d.severity.padEnd(7)} @${d.offset}  ${d.message}`);
  }
}

export function runInspect(request: InspectRequest, io: CliIo): number {
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(readFileSync(request.file));
  } catch (error) {
    io.err(`cannot read ${request.file}: ${error instanceof Error ? error.message : String(error)}`);
    return EXIT.unreadable;
  }

  const sha256 = sha256Hex(bytes);
  // The command owns the sink so the report is producible even when a strict open throws
  // (`IMPL-020-R011`: failure *after* producing the report).
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
      io.err(`inspect: strict mode aborted: ${message}`);
      return EXIT.failed; // structural read error — the soft-mode counterpart exits 1 too
    }
    // The strict not-a-SWF throw is a plain Error; the soft-mode counterpart exits 2 (SF0001).
    io.err(`inspect: ${message}`);
    return EXIT.unreadable;
  }
  const model = buildMovieModel(file, { strictTimeline: request.strictTimeline ?? false });

  let actions: InspectActions | undefined;
  if (request.actions === true) {
    const analysis = analyzeMovie(file, model, {
      emit: (code, severity, message, offset, context) => {
        // avm1's registry only issues SF#### codes (its own code table); the sink narrows them.
        file.sink.emit({
          code: code as `SF${number}`,
          severity,
          message,
          offset,
          context: context ?? 'avm1',
        });
      },
    });
    actions = {
      avm2: { present: analysis.avm2.present, reason: analysis.avm2.present ? analysis.avm2.reason : null },
      t2FrameScripts: analysis.t2FrameScripts,
      blockCount: analysis.blocks.length,
      disassembly: disassembleMovie(analysis),
    };
  }

  const summary = summarize(file, model, request.file, sha256, {
    ...(request.tags !== undefined ? { tags: request.tags } : {}),
    ...(request.symbols !== undefined ? { symbols: request.symbols } : {}),
    ...(actions !== undefined ? { actions } : {}),
  });

  if (request.json) {
    io.out(JSON.stringify(summary, null, 2));
  } else {
    for (const line of render(summary, request.verbose)) io.out(line);
    if (summary.actions !== undefined) {
      io.out('');
      if (summary.actions.avm2.present) {
        io.out(
          `actions        AVM2 content (${summary.actions.avm2.reason}); the AVM1 front end refuses this movie (SF1000)`,
        );
      } else if (summary.actions.blockCount === 0) {
        io.out('actions        (none)');
      } else {
        io.out(`actions        ${summary.actions.blockCount} block(s):`);
        for (const line of summary.actions.disassembly.split('\n')) io.out(line);
        for (const script of summary.actions.t2FrameScripts) {
          io.out(`   (T2 frame script: ${script.id}${script.reason !== null ? ` — ${script.reason}` : ''})`);
        }
      }
    }
  }
  return exitForDiagnostics(file.diagnostics);
}
