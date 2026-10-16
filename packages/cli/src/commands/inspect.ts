/**
 * `swfforge inspect` — a printer over the read, model and analyse views, and nothing else (`IMPL-120-R027`).
 *
 * It runs the pipeline with `dryRun` rather than calling `openSwfNodeSync` itself, because the alternative is a
 * second, smaller reader inside the CLI that would report a different file from the one `build` compiled. The
 * `--tags`/`--symbols`/`--timeline`/`--actions` views are then projections of stages that already ran, and a view
 * that needs a stage this build does not register (`decode`) is *reported as unavailable* rather than answered with
 * the closest thing that happens to work.
 *
 * `inspect` still works on input whose later stages would fail — that is the whole point of the verb, and it is why
 * the header is printed before any verdict is computed. A file that fails to read at all prints its own error line
 * and contributes its exit class; the other files on the command line are still inspected.
 *
 * No cache: `--out`-less, read-only, and `fileStageCache` writes.
 */

import { createCancellationToken, PipelineError } from '@swf-forge/compile';
import type { CancellationToken, JsonObject, RunResult } from '@swf-forge/compile';
import { tagName } from '@swf-forge/swf';

import type { Invocation } from '../args.js';
import { EXIT, exitForRun, runFacts, worseExit } from '../exit.js';
import type { CommandContext, CommandResult } from '../context.js';
import { configToJson } from '../config.js';
import { diagnosticRows, tick } from '../json.js';
import { runBuild } from '../run.js';
import { formatSize, tableView } from '../view.js';
import { prepareInvocation } from './prepare.js';

interface Inspection {
  readonly exit: number;
  readonly file: string;
  readonly lines: string[];
  readonly view: JsonObject;
}

export async function inspectCommand(
  ctx: CommandContext,
  request: { readonly cwd: string; readonly invocation: Invocation; readonly cancel?: CancellationToken },
): Promise<CommandResult> {
  if (request.invocation.files.length === 0) {
    return { body: {}, exit: EXIT.unreadable, lines: ['error: swfforge inspect needs at least one .swf file'] };
  }
  const cancel = request.cancel ?? createCancellationToken();
  const inspections: Inspection[] = [];
  for (const file of request.invocation.files) {
    inspections.push(inspectOne(request.cwd, file, request.invocation, cancel, ctx.verbose));
    // A yield between files, so a Ctrl-C during an inspection of forty files is observed rather than queued.
    await tick();
  }
  const exit = inspections.reduce<number>((worst, entry) => worseExit(worst, entry.exit), EXIT.ok);
  const lines = inspections.flatMap((entry) => entry.lines);
  return {
    body: {
      files: inspections.map((entry) => entry.view),
      status: exit === EXIT.ok ? 'ok' : 'reported',
    },
    exit,
    lines,
  };
}

/** One file, one run, one set of lines. `verbose` comes from the context because a command owns the printing. */
function inspectOne(
  cwd: string,
  file: string,
  invocation: Invocation,
  cancel: CancellationToken,
  verbose: number,
): Inspection {
  const prepared = prepareInvocation('inspect', cwd, { ...invocation, files: [file] } as Invocation);
  if ('error' in prepared) {
    return {
      exit: EXIT.unreadable,
      file,
      lines: [`${file}: ${prepared.error}`],
      view: { error: prepared.error, file },
    };
  }
  const setup = prepared.prepared;
  let result: RunResult;
  try {
    result = runBuild({
      bytes: setup.input.bytes,
      cacheDir: null,
      cancel,
      config: setup.config,
      cwd,
      name: setup.input.name,
      stage: setup.stage,
      switches: { ...setup.switches, dryRun: true },
    });
  } catch (cause) {
    const stack = cause instanceof Error ? (cause.stack ?? cause.message) : String(cause);
    // `PipelineError` here means the runner refused the wiring, not the file — a caller of `inspect` on a bad SWF
    // must still get a header, and an internal fault must still be visible, so the class is named and kept.
    const label = cause instanceof PipelineError ? 'pipeline error' : 'internal error';
    return {
      exit: EXIT.internal,
      file,
      lines: [`${file}: ${label}: ${stack.split('\n')[0] ?? stack}`],
      view: { error: stack, file },
    };
  }

  const read = result.state.read;
  const lines: string[] = [];
  const view: JsonObject = { diagnostics: [], model: null, read: null };
  if (read === undefined) {
    // The read stage failed, so there is no header to print — but the run's own diagnostics say why, and `R027`
    // is about printing what *was* recovered, not inventing a header from nothing.
    lines.push(`${file}: unreadable`);
  } else {
    const header = read.file.header;
    lines.push(
      `${file}: SWF ${read.version} ${read.compression === 'zlib' ? 'Z' : read.compression === 'lzma' ? 'LZMA' : 'uncompressed'}, ${formatSize(read.bytes.length)} on disk, sha256 ${read.sha256.slice(0, 16)}…`,
      `  stage ${header.frameSizePx.width}×${header.frameSizePx.height} px, ${header.frameRate.toFixed(2)} fps, ${header.frameCount} frame(s)`,
      `  declared length ${header.fileLength} bytes, decompressed ${formatSize(read.file.sizes.decompressed)} (${read.file.sizes.ratio.toFixed(2)}×), ${read.tagCount} tag(s), ${read.definitionCount} definition(s), ${read.spriteRangeCount} sprite(s)`,
    );
    view['read'] = {
      compression: read.compression,
      definitions: read.definitionCount,
      frameCount: header.frameCount,
      frameRate: header.frameRate,
      frameSizePx: { height: header.frameSizePx.height, width: header.frameSizePx.width },
      sha256: read.sha256,
      size: { bytes: read.bytes.length, decompressed: read.file.sizes.decompressed, fileLength: header.fileLength },
      sprites: read.spriteRangeCount,
      tagCount: read.tagCount,
      version: read.version,
    };
  }

  const model = result.state.model;
  if (model !== undefined) {
    lines.push(`  model: ${model.characterCount} character(s), ${model.initActionCount} init action block(s)`);
    if (invocation.flags.has('--tags')) lines.push(...tagLines(result));
    if (invocation.flags.has('--symbols')) lines.push(...symbolLines(result));
    if (invocation.flags.has('--timeline')) lines.push(...timelineLines(result));
    if (invocation.flags.has('--actions')) lines.push(...actionLines(result));
    view['model'] = {
      characters: model.characterCount,
      frames: model.frameCount,
      initActions: model.initActionCount,
      ...(invocation.flags.has('--tags') ? { tags: tagRows(result) } : {}),
      ...(invocation.flags.has('--symbols') ? { symbols: symbolRows(result) } : {}),
      ...(invocation.flags.has('--timeline') ? { timeline: timelineRows(result) } : {}),
    };
  }
  const analysis = result.state.analysis;
  if (analysis !== undefined) {
    view['analysis'] = {
      actionBlocks: analysis.actionBlockCount,
      functions: analysis.functionCount,
      requirements: analysis.requirements.map((entry) => ({
        group: entry.group,
        offset: entry.offset ?? 0,
        via: entry.via,
      })),
      tiers: { T0: analysis.tiers.T0, T1: analysis.tiers.T1, T2: analysis.tiers.T2 },
    };
  }
  view['diagnostics'] = result.diagnostics.items.map((item) => ({
    code: item.code,
    context: item.context,
    message: item.message,
    offset: item.offset,
    severity: item.severity,
  }));
  const diagnostics = result.diagnostics.items.filter((item) => item.severity !== 'info');
  if (diagnostics.length > 0) {
    lines.push('  diagnostics:', ...diagnosticRows(diagnostics).text.map((line) => `  ${line}`));
  }
  const decision = exitForRun(runFacts(result, { dryRun: true }, setup.config));
  const exit = decision.exit;
  // The header above is the useful part of a refused run, so the refusal is printed after it rather than instead.
  lines.push(`  verdict: exit ${exit}${decision.reason === null ? '' : ` — ${decision.reason}`}`);
  if (result.status === 'refused' && read === undefined) lines.push(`  ${file}: refused`);
  return {
    exit,
    file,
    lines: [...lines, ...(verbose > 0 ? [`  config: ${JSON.stringify(configToJson(setup.config))}`] : [])],
    view,
  };
}

/** Every tag in stream order, with its sprite nesting. `CMP-§4`'s `index` is the tag index, the cache key's unit. */
function tagRows(result: RunResult): readonly JsonObject[] {
  const tags = result.state.read?.file.tagIndex.tags ?? [];
  return tags.map((tag) => ({
    code: tag.code,
    depth: tag.depth,
    index: tag.index,
    length: tag.length,
    name: tagName(tag.code),
    offset: tag.offset,
    ...(tag.inSprite === null ? {} : { sprite: tag.inSprite }),
  }));
}

function tagLines(result: RunResult): readonly string[] {
  const rows = tagRows(result);
  if (rows.length === 0) return ['  tags: none'];
  return [
    `  tags (${rows.length}):`,
    ...tableView(
      ['#', 'tag', 'off', 'len', 'depth', 'sprite'],
      rows.map((row) => [
        String(row['index']),
        String(row['name']),
        String(row['offset']),
        String(row['length']),
        String(row['depth']),
        row['sprite'] === undefined ? '—' : String(row['sprite']),
      ]),
    ).map((line) => `    ${line}`),
  ];
}

/** The export name table, then the dictionary. A name that is exported twice is listed twice, on purpose. */
function symbolRows(result: RunResult): readonly JsonObject[] {
  const model = result.state.model?.model;
  if (model === undefined) return [];
  const names = [...model.exported].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  return names.map(([name, id]) => ({ characterId: id, name }));
}

function symbolLines(result: RunResult): readonly string[] {
  const rows = symbolRows(result);
  const definitions = result.state.read?.file.definitions ?? [];
  if (rows.length === 0) return [`  symbols: no export names; ${definitions.length} dictionary entries`];
  return [
    `  symbols: ${rows.length} exported name(s), ${definitions.length} dictionary entr(ies)`,
    ...tableView(
      ['name', 'character'],
      rows.map((row) => [String(row['name']), String(row['characterId'])]),
    ).map((line) => `    ${line}`),
  ];
}

function timelineRows(result: RunResult): readonly JsonObject[] {
  const model = result.state.model?.model;
  if (model === undefined) return [];
  // `FrameModel` keeps placements as `ops` (display ops in file order), so that is what a timeline view can count
  // honestly; a per-depth placement table belongs to a view that reads `DisplayOp` variants, which `decode` owns.
  return model.mainTimeline.frames.map((frame) => ({
    actions: frame.actions.length,
    displayOps: frame.ops.length,
    frame: frame.index,
    label: frame.label ?? '',
    soundEvents: frame.soundEvents.length,
    videoFrames: frame.videoFrames.length,
  }));
}

function timelineLines(result: RunResult): readonly string[] {
  const model = result.state.model?.model;
  if (model === undefined) return ['  timeline: unavailable (the model stage did not run)'];
  const labels = [...model.mainTimeline.labels].map(([name, frame]) => `${name}@${frame}`).join(', ');
  const scenes = model.control.scenes.map((scene) => `${scene.name}+${scene.frameOffset}`).join(', ');
  return [
    `  timeline: ${model.mainTimeline.frames.length} frame(s) of ${model.frameCount} declared, ${model.control.labelEntries.length} control label(s), ${model.mainTimeline.streamSoundSpans.length} stream-sound span(s)`,
    ...(labels === '' ? [] : [`  labels: ${labels}`]),
    ...(scenes === '' ? [] : [`  scenes: ${scenes}`]),
  ];
}

function actionLines(result: RunResult): readonly string[] {
  const analysis = result.state.analysis;
  if (analysis === undefined) return ['  actions: unavailable (the analyse stage did not run — read the diagnostics)'];
  return [
    `  actions: ${analysis.actionBlockCount} block(s), ${analysis.functionCount} function(s) — T0 ${analysis.tiers.T0}, T1 ${analysis.tiers.T1}, T2 ${analysis.tiers.T2}`,
    `  host requirements: ${analysis.requirements.length === 0 ? 'none' : analysis.requirements.map((entry) => `${entry.group} via ${entry.via}`).join(', ')}`,
  ];
}
