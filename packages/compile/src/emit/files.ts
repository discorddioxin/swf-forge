/**
 * The emitted file set: `src/symbols.ts`, `src/frames/*`, `src/classes/*`, `src/buttons/*`, and the project
 * scaffolding (`WP-120-08`, doc 120 §4's tree).
 *
 * Two rules decide most of what you see here. `CMP-R017` requires placement ops to be **declarative data**
 * rather than calls, so a timeline module is a table of plain objects the runtime can pre-batch and a human can
 * diff. `IMPL-120-R012` requires the name table to be *closed before* emission, so nothing in this file is
 * allowed to mint a name: every identifier comes out of `NameTable`, and a block with no entry is refused with
 * a reason rather than renamed on the spot.
 *
 * `REPO-R016`'s three orderings are applied literally, and they are the reason the file list is returned
 * sorted rather than assembled in discovery order: manifest keys lexicographic, resource modules by handle
 * name, timeline modules by character id. A `Map` iteration order reaching an output byte is `T-CMP-003`
 * failing on someone else's machine.
 */

import type { ActionIR } from '@swf-forge/avm1';
import type { Cxform, DisplayOp, Mat2D } from '@swf-forge/swf';
import type { CharacterModel, MovieModel, SwfFile } from '@swf-forge/swf';

import type { NameTable } from '../passes/names.js';
import type { FramePlan } from '../passes/frames.js';
import type { ShakePlan } from '../passes/shake.js';
import { ownerCharacterOf } from '../passes/names.js';

import { scaffoldFiles } from './scaffold.js';
import { assessBlock, defineParams, definePrelude, lowerFunction, type Refusal } from './lower.js';
import {
  emittedFunction,
  emittedPath,
  formatBytes,
  formatNumber,
  formatString,
  generatedHeader,
  objectLiteral,
  objectLiteralInline,
  render,
  sortedTable,
  type Chunk,
} from './source.js';
import { surfaceImports } from './surface.js';

/** A module's rendered chunks are a list; the printer accepts both, and so do these helpers. */
type Chunks = Chunk[];

export interface EmitHeader {
  readonly toolVersion: string;
  readonly inputName: string;
  readonly sha256: string;
  readonly movie: string;
}

export interface EmitInput {
  readonly file: SwfFile;
  readonly model: MovieModel;
  /** The blocks that survive `WP-120-03`; a pruned block is not emitted. */
  readonly blocks: readonly ActionIR[];
  readonly table: NameTable;
  readonly frames: FramePlan | null;
  readonly shake: ShakePlan | null;
  readonly header: EmitHeader;
}

export interface EmittedText {
  readonly path: string;
  readonly text: string;
}

export interface EmittedBlock {
  readonly subjectId: string;
  readonly path: string;
  readonly name: string;
}

export interface RefusedBlock {
  readonly subjectId: string;
  readonly refusal: Refusal;
}

export interface EmitPlan {
  readonly files: readonly EmittedText[];
  readonly emitted: readonly EmittedBlock[];
  readonly refused: readonly RefusedBlock[];
  /** Per-block decisions in `IMPL-120-R013`'s shape, assembled from `emitted`/`refused`. */
  readonly decisions: readonly { readonly subject: string; readonly action: string; readonly reason: string }[];
  readonly counts: {
    readonly blocks: number;
    readonly emitted: number;
    readonly refused: number;
    readonly files: number;
    readonly bytes: number;
  };
}

function moduleText(header: EmitHeader, timeline: string, chunks: readonly Chunk[]): string {
  const rendered = render([chunks.map((chunk, index) => (index === 0 ? chunk : ['', chunk]))]);
  const imports = surfaceImports(rendered);
  return `${generatedHeader({ ...header, timeline })}\n\n${imports.length === 0 ? '' : `${imports.join('\n')}\n\n`}${rendered}`;
}

/** The id tables: symbol ↔ character id, both directions, plus the export set. */
function symbolsModule(input: EmitInput): Chunk {
  const byName = new Map<string, string>();
  const byId = new Map<string, string>();
  for (const symbol of input.table.symbols) {
    if (symbol.kind !== 'character' && symbol.kind !== 'class') continue;
    const id = Number(symbol.subjectId.replace(/^\D+/u, ''));
    if (!Number.isFinite(id)) continue;
    byName.set(symbol.name, String(id));
    const kinds = input.model.characters.get(id)?.kind ?? 'unknown';
    byId.set(String(id), formatString(`${symbol.name}:${kinds}`));
  }
  return [
    sortedTable('characterIdByName', 'number', byName),
    sortedTable('characterByName', 'string', byId),
    // `ExportedAssets` is a map in the model and a map in the output; sorted by name so the bytes do not
    // depend on insertion order (REPO-R016).
    sortedTable(
      'exportedAssets',
      'number',
      new Map([...input.model.exported].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([name, id]) => [name, String(id)])),
    ),
  ];
}

/** One `const` per frame's script list, in execution order, calling the lowered functions by name. */
/**
 * The frame table. A frame script is one executable unit — the runtime gives a frame a single entry point — so
 * a frame containing a block this phase cannot lower is deferred *whole* to `WP-120-09`'s residual-blob path
 * rather than emitted with a hole in it. The row is still counted, and the reason travels in the decisions.
 *
 * Frame numbers are 1-based in the output, matching the timeline tables and the SWF's own numbering; the plan
 * is 0-based, and an off-by-one between two emitted tables is the kind of bug a reader never finds.
 */
function frameModule(
  input: EmitInput,
  groups: readonly FramePlan['frames'][number][],
  refused: ReadonlySet<string>,
): Chunks {
  const chunks: Chunk[] = [];
  const rows: string[] = [];
  const deferred: string[] = [];
  for (const group of groups) {
    const blocked = group.units.filter((unit) => unit.hoisted !== true && refused.has(unit.subjectId));
    if (blocked.length > 0) {
      deferred.push(`frame ${group.frame + 1}: ${blocked.map((unit) => unit.subjectId).join(', ')}`);
      continue;
    }
    const calls = group.units.map((unit) => {
      const name = input.table.bySubject.get(unit.subjectId) ?? 'unresolved';
      return `${name}(vm, target, frame);`;
    });
    chunks.push(
      emittedFunction({
        name: group.name,
        params: ['vm: Vm', 'target: Clip', 'frame: FrameCtx'],
        returns: null,
        docs: [`frame ${group.frame + 1}`, `${group.units.length} action block(s) in schedule order`],
        body: calls.length === 0 ? ['// (no scripts on this frame)'] : calls,
      }),
    );
    rows.push(`{ frame: ${group.frame + 1}, run: ${group.name} }`);
  }
  if (deferred.length > 0) {
    chunks.push(`// deferred to WP-120-09 (its blocks need the residual blob): ${deferred.join('; ')}`);
  }
  chunks.push(
    `export const frameScripts: readonly FrameScript[] = ${
      rows.length === 0 ? '[]' : `[\n${rows.map((row) => `  ${row},`).join('\n')}\n]`
    };`,
  );
  return chunks;
}

/**
 * A timeline's placements as *data* (`CMP-R017`): the runtime pre-batches them and the file stays diffable.
 * Nulls are dropped rather than written, because the emitted project builds with
 * `exactOptionalPropertyTypes`.
 */
function timelineTable(model: MovieModel, character: CharacterModel): Chunks {
  const timeline = character.sprite?.timeline ?? model.mainTimeline;
  const frames = timeline.frames.map((frame) => {
    const entries = frame.ops.map((op) => placementEntry(op));
    return `{ frame: ${frame.index + 1}, ops: [${entries.join(', ')}] }`;
  });
  if (frames.length === 0) return ['export const timeline: readonly TimelineTables[] = [];'];
  return [`export const timeline: readonly TimelineTables[] = [\n${frames.map((row) => `  ${row},`).join('\n')}\n];`];
}

function placementEntry(op: DisplayOp): string {
  if (op.kind === 'remove') {
    return objectLiteralInline([
      ['remove', String(op.depth)],
      ['character', op.characterId === null ? 'null' : String(op.characterId)],
    ]);
  }
  if (op.kind !== 'place') {
    // `SetTabIndex` has no runtime contract yet (it belongs to the focus work in doc 130), so it is recorded
    // as an inert entry the runtime can ignore rather than dropped: a dropped op silently changes the layering.
    return objectLiteral([['setTabIndex', String(op.tagOffset)]]);
  }
  const placement = op;
  const entries: [string, string | null][] = [
    ['place', 'true'],
    ['depth', String(placement.depth)],
    ['character', placement.characterId === null ? null : String(placement.characterId)],
    ['name', placement.name === null ? null : formatString(placement.name)],
    ['matrix', placement.matrix === null ? null : matrixLiteral(placement.matrix)],
    ['ratio', placement.ratio === null ? null : String(placement.ratio)],
    ['clipDepth', placement.clipDepth === null ? null : String(placement.clipDepth)],
    ['blendMode', placement.blendMode === null ? null : String(placement.blendMode)],
    ['cacheAsBitmap', placement.cacheAsBitmap ? 'true' : null],
    ['color', placement.cxform === null ? null : cxformLiteral(placement.cxform)],
  ];
  return objectLiteralInline(entries);
}

/**
 * Twips and 8.8 fractions stay numbers, so the runtime does the twip-to-pixel division once at start-up
 * (`IMPL-120-R026`) rather than parsing strings. Printing goes through `formatNumber`, which is the only
 * spelling of `Infinity`/`-0`/`NaN` this codebase allows in emitted output (`REPO-R015`).
 */
function matrixLiteral(matrix: Mat2D): string {
  return objectLiteralInline([
    ['a', formatNumber(matrix.a)],
    ['b', formatNumber(matrix.b)],
    ['c', formatNumber(matrix.c)],
    ['d', formatNumber(matrix.d)],
    ['tx', formatNumber(matrix.tx)],
    ['ty', formatNumber(matrix.ty)],
  ]);
}

function cxformLiteral(cxform: Cxform): string {
  return objectLiteralInline([
    [
      'multiply',
      objectLiteralInline([
        ['r', formatNumber(cxform.rm)],
        ['g', formatNumber(cxform.gm)],
        ['b', formatNumber(cxform.bm)],
        ['a', formatNumber(cxform.am)],
      ]),
    ],
    [
      'add',
      objectLiteralInline([
        ['r', formatNumber(cxform.ra)],
        ['g', formatNumber(cxform.ga)],
        ['b', formatNumber(cxform.ba)],
        ['a', formatNumber(cxform.aa)],
      ]),
    ],
  ]);
}

/** One lowered function for one root block, or a comment when the block is refused. */
/** Lowers one root action block to a `function` declaration, or says why it could not be lowered. */
function blockFunction(
  ir: ActionIR,
  input: EmitInput,
  extraDocs: readonly string[],
): { text: string | null; refusal: Refusal | null; name: string } {
  const name = input.table.bySubject.get(`block:${ir.id}`);
  if (name === undefined) {
    return {
      text: null,
      refusal: { reason: 'unbound-temp', detail: 'the closed name table has no entry for this block (IMPL-120-R012)' },
      name: `block_${ir.id}`,
    };
  }
  const assessment = assessBlock(ir);
  if (!assessment.emittable) {
    return { text: null, refusal: assessment.refusal, name };
  }
  const lowered = lowerFunction(ir, {
    pool: ir.constants.length > 0 ? ir.constants : null,
    nameForBlock: (subject) => input.table.bySubject.get(subject) ?? 'anon',
  });
  if (lowered.refusal !== null) return { text: null, refusal: lowered.refusal, name };
  const isFrameScript = ir.kind === 'timeline' || ir.kind === 'init' || ir.kind === 'clipEvent' || ir.kind === 'button';
  const params = isFrameScript ? ['vm: Vm', 'target: Clip', 'frame: FrameCtx'] : defineParams(ir.params, ir.preloads);
  const prelude = definePrelude(ir, (value) => value);
  return {
    text: emittedFunction({
      name,
      params,
      returns: isFrameScript ? null : 'Value',
      docs: [`block ${ir.id}`, `${ir.byteRange.start}..${ir.byteRange.end}`, `T${ir.tier}`, ...extraDocs],
      body: [...lowered.declarations, ...prelude, ...lowered.statements],
    }),
    refusal: null,
    name,
  };
}

/** The button handler tables: `ButtonActionRecord`s, with the lowered arm attached by byte range. */
function buttonModule(input: EmitInput, character: CharacterModel): Chunks {
  const button = character.button;
  if (button === null) return [`// character ${character.id}: no decoded button payload`];
  const chunks: Chunk[] = [];
  const handlerRows: string[] = [];
  for (const record of button.actions) {
    const ir = input.blocks.find((block) => block.byteRange.start === record.actionBytes.offset);
    const conditions = Object.entries(record.conditions)
      .filter(([, on]) => on === true)
      .map(([name]) => formatString(name));
    if (record.keyCode !== null) conditions.push(formatString(`keyPress(${record.keyCode})`));
    const conditionList = `[${conditions.join(', ')}]`;
    if (ir === undefined) {
      // The record had no block scheduled, so there is nothing to lower. `E-044` explains why that is not rare.
      handlerRows.push(
        objectLiteral([
          ['conditions', conditionList],
          ['refused', '"no action block was scheduled for this button record"'],
        ]),
      );
      continue;
    }
    const lowered = blockFunction(ir, input, [`button ${character.id}`, `handler [${conditions.join(', ')}]`]);
    if (lowered.refusal !== null || lowered.text === null) {
      handlerRows.push(
        objectLiteral([
          ['conditions', conditionList],
          ['refused', formatString(lowered.refusal?.detail ?? 'block could not be lowered')],
        ]),
      );
      continue;
    }
    chunks.push(lowered.text);
    handlerRows.push(
      objectLiteral([
        ['conditions', conditionList],
        ['run', lowered.name],
      ]),
    );
  }
  chunks.push(
    `export const handlers: readonly ButtonHandler[] = ${
      handlerRows.length === 0 ? '[]' : `[\n${handlerRows.map((row) => `  ${row},`).join('\n')}\n]`
    };`,
  );
  return chunks;
}

/**
 * The class tables (`CMP-R019`), in the declaration-first order the contract asks for: `name`, `methods`,
 * `members`, `parent`, `traits`, then the constructor and method bodies. This phase emits *what P5 can see*:
 * class names come from the name table, and member/trait records need `detectClasses`, which reports zero on
 * every corpus input (`E-044`). Writing plausible members from the AST would be inventing semantics, so the
 * gap is printed as a comment naming the erratum, and `porting-notes.json` (`WP-120-11`) carries it outward.
 */
/**
 * The class tables (`CMP-R019`), in the declaration-first order the contract asks for: `name`, `methods`,
 * `members`, `parent`, `traits`, then the constructor and method bodies. This phase emits only what P5 can
 * see — a name — because member and trait records need `detectClasses`, which reports zero on every corpus
 * input (`E-044`). Plausible members synthesised from call sites would put semantics in the output that the
 * analysis never proved, so the gap is a comment naming the erratum, and `porting-notes.json` (`WP-120-11`)
 * carries it outward as a work item.
 */
function classModule(className: string): Chunks {
  return [
    [
      `export const ${className}: ClassEntry = `,
      {
        lines: [
          `${objectLiteralInline([
            ['name', formatString(className)],
            ['methods', '{}'],
          ])},`,
        ],
      },
      ';',
    ].flat(),
    '// methods: {} — class recovery reports no members (E-044); the shape is left to the runtime contract',
    '// rather than guessed here.',
  ];
}

/** Builds the whole emitted file set. Pure: same input, byte-identical output. */
export function emitFiles(input: EmitInput): EmitPlan {
  const files = new Map<string, Chunk[]>();
  const emitted: EmittedBlock[] = [];
  const refused: RefusedBlock[] = [];
  const add = (path: string, chunk: Chunk): void => {
    const key = emittedPath(path);
    const list = files.get(key) ?? [];
    list.push(chunk);
    files.set(key, list);
  };

  add('src/symbols.ts', symbolsModule(input));

  // Timeline modules in character-id order (REPO-R016); the main timeline first, as `movie.ts`.
  const byCharacter = new Map<number, ActionIR[]>();
  for (const ir of input.blocks) {
    const owner = ir.kind === 'timeline' ? null : ownerCharacterId(input, ir);
    const list = byCharacter.get(owner ?? -1) ?? [];
    list.push(ir);
    byCharacter.set(owner ?? -1, list);
  }

  const movieChunks: Chunks = [];
  for (const ir of byCharacter.get(-1) ?? []) {
    const lowered = blockFunction(ir, input, ['main timeline']);
    if (lowered.refusal !== null || lowered.text === null) {
      refused.push({
        subjectId: `block:${ir.id}`,
        refusal: lowered.refusal ?? { reason: 'unbound-temp', detail: 'block produced no text' },
      });
      continue;
    }
    movieChunks.push(lowered.text);
    emitted.push({ subjectId: `block:${ir.id}`, path: 'src/frames/movie.ts', name: lowered.name });
  }
  // The frame table is assembled after the functions it calls, because a frame whose block was refused has to be
  // deferred whole: emitting `frame_7(...)` for a function that was never written would produce a project that
  // does not build, and a broken build is a worse report than a missing frame.
  if (input.frames !== null) {
    movieChunks.push(...frameModule(input, input.frames.frames, new Set(refused.map((entry) => entry.subjectId))));
  }
  if (movieChunks.length > 0) add('src/frames/movie.ts', movieChunks);

  const spriteIds = [...byCharacter.keys()].filter((id) => id >= 0).sort((a, b) => a - b);
  for (const id of spriteIds) {
    const character = input.model.characters.get(id);
    if (character === undefined) continue;
    const chunks: Chunks = [...timelineTable(input.model, character)];
    let initName: string | null = null;
    for (const ir of byCharacter.get(id) ?? []) {
      const lowered = blockFunction(ir, input, [`sprite ${id}`]);
      if (lowered.refusal !== null || lowered.text === null) {
        refused.push({
          subjectId: `block:${ir.id}`,
          refusal: lowered.refusal ?? { reason: 'unbound-temp', detail: 'unknown' },
        });
        continue;
      }
      chunks.push(lowered.text);
      if (ir.kind === 'init') initName = lowered.name;
      emitted.push({ subjectId: `block:${ir.id}`, path: `src/frames/sprite_${id}.ts`, name: lowered.name });
    }
    // `DoInitAction` runs once when the sprite is created, so the runtime needs a named handle for it. Without
    // this line the lowered init function is exported but unreachable, which is the failure mode the
    // entry-descriptor work (`WP-120-09`) exists to close; clip-event handlers belong to that same seam.
    chunks.push(`export const initScript: FrameScript | null = ${initName ?? 'null'};`);
    add(`src/frames/sprite_${id}.ts`, chunks);
  }

  for (const character of [...input.model.characters.values()].sort((a, b) => a.id - b.id)) {
    if (character.kind !== 'button' || character.button === null) continue;
    add(`src/buttons/button_${character.id}.ts`, [
      `export const buttonId: number = ${character.id};`,
      buttonModule(input, character),
    ]);
  }

  const classNames = input.table.symbols.filter((symbol) => symbol.kind === 'class');
  if (classNames.length === 0) {
    add('src/classes/index.ts', [
      `/** No class was recovered: P5's \`detectClasses\` reports zero on every input (\`E-044\`). */`,
      'export const classes: readonly ClassEntry[] = [];',
    ]);
  } else {
    for (const entry of [...classNames].sort((a, b) => (a.name < b.name ? -1 : 1))) {
      add(`src/classes/${entry.name}.ts`, classModule(entry.name));
    }
  }

  const all: EmittedText[] = [
    ...[...files.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([path, chunks]) => ({ path, text: moduleText(input.header, path, chunks) })),
    ...scaffoldFiles(input.header),
  ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  const decisions = [
    ...emitted.map((entry) => ({
      subject: entry.subjectId,
      action: 'emitted',
      reason: `written to ${entry.path} as ${entry.name}()`,
    })),
    ...refused.map((entry) => ({
      subject: entry.subjectId,
      action: 'deferred to WP-120-09',
      reason: `${entry.refusal.reason}: ${entry.refusal.detail}`,
    })),
  ].sort((a, b) => (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0));

  const bytes = all.reduce((sum, file) => sum + Buffer.byteLength(file.text, 'utf8'), 0);
  return {
    files: all,
    emitted,
    refused,
    decisions,
    counts: {
      blocks: input.blocks.length,
      emitted: emitted.length,
      refused: refused.length,
      files: all.length,
      bytes,
    },
  };
}

function ownerCharacterId(input: EmitInput, ir: ActionIR): number | null {
  if (ir.kind === 'init') {
    const entry = input.model.initActions.find((candidate) => candidate.block.offset === ir.byteRange.start);
    if (entry !== undefined) return entry.spriteId;
  }
  const owner = ownerCharacterOf(input.file, ir.byteRange.start);
  return owner;
}

/** `IMPL-120-R018`'s blob form, kept here so the residual pass and the frame emitter agree on the spelling. */
export function residualBytesLiteral(bytes: readonly number[]): string {
  return formatBytes(bytes);
}
