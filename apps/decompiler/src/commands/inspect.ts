/**
 * `inspect` — the first decompiler verb (`TECH-SPEC` §5.2, `CMP` §8).
 *
 * Opens a file through the Node entry point, builds the movie model and prints either a human report
 * or a JSON summary. Nothing here writes to disk: `inspect` is read-only by construction, which is why
 * it can be pointed at untrusted content (`SEC` §7).
 */

import { readFileSync } from 'node:fs';

import { buildMovieModel, codeInfo, tagName } from '@swf-forge/swf';
import type { Diagnostic, MovieModel, SwfFile } from '@swf-forge/swf';
import { openSwfNodeSync, sha256Hex } from '@swf-forge/swf/node';

import { EXIT, type CliIo } from '../exit.js';

export interface InspectRequest {
  readonly file: string;
  readonly json: boolean;
  readonly verbose: boolean;
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
  readonly labels: readonly string[];
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

function summarize(file: SwfFile, model: MovieModel, path: string, sha256: string): InspectSummary {
  const histogram = new Map<number, number>();
  for (const tag of file.tagIndex.tags) histogram.set(tag.code, (histogram.get(tag.code) ?? 0) + 1);
  const tags = [...histogram.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([code, count]) => ({ code, name: tagName(code), count }));

  const characters = [...model.characters.values()]
    .sort((a, b) => a.id - b.id)
    .map((character) => ({ id: character.id, tag: character.tagName, sprite: character.sprite !== null }));

  const items = file.diagnostics.map((d: Diagnostic) => ({
    code: String(d.code),
    severity: d.severity,
    offset: d.offset,
    count: d.count,
    message: d.message,
  }));

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
    labels: [...model.mainTimeline.labels.keys()].sort(),
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
  if (s.labels.length > 0) lines.push(`  labels         ${s.labels.join(', ')}`);
  lines.push(`  tags           ${s.tags.map((t) => `${t.code}(${t.name})x${t.count}`).join(' ')}`);
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

/** Exit code for a report: `CMP-R029`'s table, mapped from the diagnostics present. */
function exitFor(diagnostics: readonly Diagnostic[]): number {
  const codes = new Set(diagnostics.map((d) => String(d.code)));
  if (codes.has('SF0001')) return EXIT.unreadable;
  if (codes.has('SF1000')) return EXIT.avm2;
  if (diagnostics.some((d) => d.severity === 'error')) return EXIT.failed;
  return EXIT.ok;
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
  const file = openSwfNodeSync(bytes);
  const summary = summarize(file, buildMovieModel(file), request.file, sha256);

  if (request.json) {
    io.out(JSON.stringify(summary, null, 2));
  } else {
    for (const line of render(summary, request.verbose)) io.out(line);
  }
  return exitFor(file.diagnostics);
}
