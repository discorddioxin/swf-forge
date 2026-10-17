/**
 * The emitted file set: `src/symbols.ts`, `src/frames/*`, `src/classes/*`, `src/buttons/*`, `src/residual/*`,
 * and the project scaffolding (`WP-120-08`, doc 120 §4's tree).
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

import { buildManifest } from './manifest.js';
import { scaffoldFiles } from './scaffold.js';
import { assessBlock, defineParams, definePrelude, lowerFunction, type Refusal } from './lower.js';
import {
  buildResidualBlobs,
  residualImport,
  type ResidualBlob,
  type ResidualBuildResult,
  type ResidualPolicy,
  type ResidualRequest,
} from './residual.js';
import {
  emittedFunction,
  emittedPath,
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

/**
 * The emitted symbols that exist **for the host application**, so `IMPL-120-R024`'s "referenced at least once"
 * requirement is satisfied by declaration rather than by a caller that cannot exist yet. `src/manifest.ts`'s
 * `manifest` is the case the emitter cannot close from inside: `CMP` §5's example has the app shell read the typed
 * manifest, and nothing in the generated project imports it, so a check that walked only `src/**` would warn on
 * every build until a porter silenced it — and a check that always warns is a check that gets turned off.
 * `verify` treats this list as the project's own `--allow-unreferenced` default.
 *
 * `E-054` settled the rest of the surface, and the settlement is a principle rather than a paste: `IMPL-120` §4
 * emits **no bootstrap module**. Every file under `src/` is a table the runtime or the app shell addresses — the
 * id tables, the frame and routing tables, the recovered classes, the button handlers, the residual blobs — so
 * their being unreferenced inside the project is the design working, not a hole in it. Two shapes follow from
 * that:
 *
 * - a **fixed** module is named per export, so a stray `export` the emitter did not intend stays reportable;
 * - a **family** (one timeline module per sprite, one per button, one per refused block — the count is a
 *   property of the movie, so no list of names can finish it) is named as a trailing-slash directory prefix,
 *   which covers every file the emitter generates there and no file a porter writes.
 *
 * A porter-authored module under `src/` is therefore still checked, and the check `E-054` refused to weaken is
 * the one that catches a project whose own wiring came apart.
 */
export const EMITTED_PUBLIC_EXPORTS: readonly string[] = [
  'src/manifest.ts#manifest',
  'src/symbols.ts#characterByName',
  'src/symbols.ts#characterIdByName',
  'src/symbols.ts#exportedAssets',
  'src/assets/',
  'src/buttons/',
  'src/classes/',
  'src/frames/',
  'src/residual/',
];

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
  /**
   * `ForgeConfig.vm.residual`, and it decides only what the *emitter* does with a block it cannot lower:
   * `on-demand` gives it a blob, `always` gives every block one so the two paths can be compared, `forbid`
   * gives none and the stage reports the failure. Default `on-demand`.
   */
  readonly residualPolicy?: ResidualPolicy;
  /** `configHash(config, 'emit')`, for the manifest's `tool` section (`IMPL-120-R019`). */
  readonly toolConfigHash?: string;
  /** `AST-R043`'s `--manifest=compact`. Default: pretty, 2-space indent, because a diffable manifest is the point. */
  readonly manifestCompact?: boolean;
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

/**
 * What a module builder needs to route a block to the interpreter: the blobs that exist, and a `bind` that
 * records the import the module will need and hands back the symbol to reference. Returning `null` is how the
 * hooks say "there is no blob for that subject", which keeps every caller from having to know why.
 */
export interface ResidualHooks {
  readonly blobs: ReadonlyMap<string, ResidualBlob>;
  readonly bind: (fromPath: string, subjectId: string) => ResidualBlob | null;
}

export interface EmitPlan {
  readonly files: readonly EmittedText[];
  readonly emitted: readonly EmittedBlock[];
  readonly refused: readonly RefusedBlock[];
  /** The residual entries `IMPL-120-R018`, one per block that is executed as a blob. */
  readonly residual: readonly ResidualBlob[];
  /** Blocks whose descriptor would have lied (`SF0505`): no blob was written, so the block stays deferred. */
  readonly invalidResidual: readonly { readonly subjectId: string; readonly error: string }[];
  /**
   * The manifest pair (`IMPL-120-R019`), or `null` when it was not written; `manifestError` then says why. The
   * two artifacts are not described twice — they are in `files`, and this is the metadata the report needs.
   */
  readonly manifest: { readonly withheld: readonly string[]; readonly json: string } | null;
  readonly manifestError: string | null;
  /** Per-block decisions in `IMPL-120-R013`'s shape, assembled from `emitted`/`refused`. */
  readonly decisions: readonly { readonly subject: string; readonly action: string; readonly reason: string }[];
  readonly counts: {
    readonly blocks: number;
    readonly emitted: number;
    readonly refused: number;
    readonly residual: number;
    readonly residualBytes: number;
    readonly files: number;
    readonly bytes: number;
  };
}

/**
 * Assembles one module: the generated header, the contract imports the body actually names, then any import the
 * emitter owes for a *sibling* module (only the residual entries, `WP-120-09`). The contract list is derived
 * from the rendered body rather than declared by the caller, which is what makes §4.1 checkable: a chunk that
 * starts using a new helper drags its import with it, and a chunk that stops using one drops it, so the emitted
 * project never carries an unused import.
 */
function moduleText(
  header: EmitHeader,
  timeline: string,
  chunks: readonly Chunk[],
  localImports: readonly string[] = [],
): string {
  const rendered = render([chunks.map((chunk, index) => (index === 0 ? chunk : ['', chunk]))]);
  const imports = [...surfaceImports(rendered), ...localImports];
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
 * The frame table. A frame script is one executable unit — the runtime gives a frame a single entry point — so a
 * frame containing a block this phase cannot lower does not get a hole in it. Under `on-demand`/`always` such a
 * frame is routed to the interpreter as a whole, in schedule order, which is why the row moves to
 * `residualEntries` instead of `frameScripts`: the frame still runs, from its original bytes. Only a frame whose
 * residual block produced no blob stays out of both tables, and says so in a comment naming the reason.
 *
 * The mixed form — lowered units as calls, residual units as blobs, in one frame — is deliberately not here. It
 * would need the emitted code to reach into the interpreter, and `CMP-R027` makes that reach a bundler-visible
 * dependency; routing the whole frame keeps the interpreter droppable. Ratifying the split belongs to
 * `WP-120-10`, with the interpreter's own entry API.
 *
 * Frame numbers are 1-based in the output, matching the timeline tables and the SWF's own numbering; the plan
 * is 0-based, and an off-by-one between two emitted tables is the kind of bug a reader never finds.
 */
function frameModule(
  input: EmitInput,
  groups: readonly FramePlan['frames'][number][],
  refused: ReadonlySet<string>,
  residual: ResidualHooks,
  path: string,
): Chunks {
  const chunks: Chunk[] = [];
  const rows: string[] = [];
  const residualRows: string[] = [];
  const stranded: string[] = [];
  for (const group of groups) {
    const blocked = group.units.filter((unit) => unit.hoisted !== true && refused.has(unit.subjectId));
    if (blocked.length > 0) {
      const blobs = blocked.map((unit) => residual.bind(path, unit.subjectId)).filter((blob) => blob !== null);
      const unbound = blocked.length - blobs.length;
      if (blobs.length > 0 && unbound === 0) {
        residualRows.push(
          objectLiteral([
            ['on', formatString(`frame:${group.frame + 1}`)],
            ['entries', `[${blobs.map((blob) => blob.entrySymbol).join(', ')}]`],
          ]),
        );
        continue;
      }
      // Part of the frame cannot be interpreted either, so the frame cannot run: dropping the whole row and
      // naming it is honest, while running a frame with a missing unit would be a silent behaviour change.
      stranded.push(`frame ${group.frame + 1}: ${blocked.map((unit) => unit.subjectId).join(', ')}`);
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
  if (stranded.length > 0) {
    chunks.push(`// no residual blob for these frames, so they run nothing: ${stranded.join('; ')}`);
  }
  chunks.push(
    `export const frameScripts: readonly FrameScript[] = ${
      rows.length === 0 ? '[]' : `[\n${rows.map((row) => `  ${row},`).join('\n')}\n]`
    };`,
  );
  chunks.push(residualTable(residualRows));
  return chunks;
}

/** The residual routing table, shared by movie and sprite modules: what the interpreter runs, and when. */
function residualTable(rows: readonly string[]): string {
  const body = rows.length === 0 ? '[]' : `[\n${rows.map((row) => `  ${row},`).join('\n')}\n]`;
  return [
    '/**',
    ' * Scripts this build cannot lower, as blobs plus entry descriptors (`IMPL-120-R018`). `on` is the',
    ' * trigger the runtime matches: `frame:<n>` for a timeline frame, `init` for `DoInitAction`. A row with no',
    ' * entry here means the frame has no residual path either, and the comment above says why.',
    ' */',
    `export const residualEntries: readonly { readonly on: string; readonly entries: readonly Entry[] }[] = ${body};`,
  ].join('\n');
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

/** The button handler tables: `ButtonActionRecord`s, with the lowered arm — or the blob — attached by byte range. */
function buttonModule(input: EmitInput, character: CharacterModel, residual: ResidualHooks, path: string): Chunks {
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
      // A handler the emitter cannot lower still has its original bytes, so the button keeps working: the row
      // names the descriptor instead of the function, and the runtime hands that entry to the interpreter.
      const blob = residual.bind(path, `block:${ir.id}`);
      if (blob !== null) {
        handlerRows.push(
          objectLiteral([
            ['conditions', conditionList],
            ['entry', blob.entrySymbol],
          ]),
        );
        continue;
      }
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
  const imports = new Map<string, Set<string>>();
  const add = (path: string, chunk: Chunk): void => {
    const key = emittedPath(path);
    const list = files.get(key) ?? [];
    list.push(chunk);
    files.set(key, list);
  };

  // ---- the residual pass, before any module is written (`WP-120-09`) --------------------------------
  //
  // Deciding which blocks end up as blobs has to happen first, because the frame and handler tables route on
  // it: a row either calls a lowered function or names an entry, and it cannot know which until both answers
  // exist. So the blocks are probed once here — the same `blockFunction` the modules use, with no per-module
  // doc lines — and lowered again with those docs attached. The duplicate work is a pure function over the IR,
  // and paying it is what keeps "who runs this frame" a single decision instead of two that can disagree.
  const policy: ResidualPolicy = input.residualPolicy ?? 'on-demand';
  const probe = new Map<string, { name: string; refusal: Refusal | null }>();
  for (const ir of input.blocks) {
    const lowered = blockFunction(ir, input, []);
    probe.set(`block:${ir.id}`, { name: lowered.name, refusal: lowered.refusal });
  }
  // Timeline modules in character-id order (REPO-R016); the main timeline first, as `movie.ts`.
  const byCharacter = new Map<number, ActionIR[]>();
  for (const ir of input.blocks) {
    const owner = ir.kind === 'timeline' ? null : ownerCharacterId(input, ir);
    const list = byCharacter.get(owner ?? -1) ?? [];
    list.push(ir);
    byCharacter.set(owner ?? -1, list);
  }

  const requests: ResidualRequest[] = [];
  // Which blocks a module can actually route. A blob nobody references executes nothing, so `on-demand` gives
  // one only to a block a frame table or a handler table will name; `always` is the parity mode, where the
  // harness addresses every blob by subject and unreferenced output is the point.
  const routed = new Set<string>();
  if (input.frames !== null) {
    for (const group of input.frames.frames) for (const unit of group.units) routed.add(unit.subjectId);
  }
  for (const character of input.model.characters.values()) {
    if (character.kind !== 'button' || character.button === null) continue;
    for (const record of character.button.actions) {
      const ir = input.blocks.find((block) => block.byteRange.start === record.actionBytes.offset);
      if (ir !== undefined) routed.add(`block:${ir.id}`);
    }
  }
  for (const [owner, list] of byCharacter) {
    if (owner < 0) continue;
    for (const ir of list) {
      // A sprite's `onEnterFrame`-style clip handlers and nested functions have no table in this phase, so an
      // unlowerable one stays deferred rather than becoming an orphan blob (the routing seam is `WP-120-10`).
      if (ir.kind === 'init' || (ir.kind === 'timeline' && ir.frameAssociations.length > 0)) {
        routed.add(`block:${ir.id}`);
      }
    }
  }
  for (const ir of input.blocks) {
    const subjectId = `block:${ir.id}`;
    if (policy !== 'always' && !routed.has(subjectId)) continue;
    const refusal = probe.get(subjectId)?.refusal ?? null;
    if (refusal === null && policy !== 'always') continue;
    requests.push({
      ir,
      subjectId,
      reason:
        refusal === null
          ? 'parity: --vm.residual=always emits a blob for every block so both paths can be compared'
          : `${refusal.reason}: ${refusal.detail}`,
    });
  }
  requests.sort((a, b) => (a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : 0));
  const built: ResidualBuildResult =
    policy === 'forbid' ? { blobs: [], invalid: [] } : buildResidualBlobs(input.file, input.header.inputName, requests);
  const blobs = new Map<string, ResidualBlob>(built.blobs.map((blob) => [blob.subjectId, blob]));
  const residual: ResidualHooks = {
    blobs,
    bind(fromPath, subjectId) {
      const blob = blobs.get(subjectId);
      if (blob === undefined) return null;
      const list = imports.get(fromPath) ?? new Set<string>();
      list.add(residualImport(blob, fromPath));
      imports.set(fromPath, list);
      return blob;
    },
  };

  add('src/symbols.ts', symbolsModule(input));

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
  // The frame table is assembled after the functions it calls, because a row has to name something that exists:
  // emitting `frame_7(...)` for a function that was never written produces a project that does not build, which
  // is a worse report than the frame table the module actually has.
  if (input.frames !== null) {
    movieChunks.push(
      ...frameModule(
        input,
        input.frames.frames,
        new Set(refused.map((entry) => entry.subjectId)),
        residual,
        'src/frames/movie.ts',
      ),
    );
  }
  if (movieChunks.length > 0) add('src/frames/movie.ts', movieChunks);

  const spriteIds = [...byCharacter.keys()].filter((id) => id >= 0).sort((a, b) => a - b);
  for (const id of spriteIds) {
    const character = input.model.characters.get(id);
    if (character === undefined) continue;
    const path = `src/frames/sprite_${id}.ts`;
    const chunks: Chunks = [...timelineTable(input.model, character)];
    const frameRows: string[] = [];
    const residualRows: string[] = [];
    const scheduled: {
      readonly frames: readonly number[];
      readonly subjectId: string;
      readonly name: string | null;
    }[] = [];
    let initName: string | null = null;
    let initBlob: ResidualBlob | null = null;
    for (const ir of byCharacter.get(id) ?? []) {
      const subjectId = `block:${ir.id}`;
      const lowered = blockFunction(ir, input, [`sprite ${id}`]);
      if (lowered.refusal !== null || lowered.text === null) {
        refused.push({ subjectId, refusal: lowered.refusal ?? { reason: 'unbound-temp', detail: 'unknown' } });
        if (ir.kind === 'init') initBlob = residual.bind(path, subjectId);
        if (ir.kind === 'timeline' && ir.frameAssociations.length > 0) {
          scheduled.push({ frames: ir.frameAssociations, subjectId, name: null });
        }
        continue;
      }
      chunks.push(lowered.text);
      if (ir.kind === 'init') initName = lowered.name;
      if (ir.kind === 'timeline') scheduled.push({ frames: ir.frameAssociations, subjectId, name: lowered.name });
      emitted.push({ subjectId, path, name: lowered.name });
    }
    // A sprite's own frame scripts are routed by the frames that reference them (`AVM1-R052`'s association data,
    // which the front end records per block). A frame with more than one block runs them in stream order, the
    // order their `DoAction` tags appear in, and a block that belongs to no frame gets no row: an exported
    // function nobody calls is a smaller lie than a table that guesses when it runs.
    const perFrame = new Map<number, { readonly run: string[]; readonly entries: string[] }>();
    for (const unit of scheduled) {
      const blob = unit.name === null ? residual.bind(path, unit.subjectId) : null;
      for (const frame of unit.frames) {
        const row = perFrame.get(frame) ?? { run: [], entries: [] };
        if (unit.name !== null) row.run.push(unit.name);
        else if (blob !== null) row.entries.push(blob.entrySymbol);
        perFrame.set(frame, row);
      }
    }
    for (const frame of [...perFrame.keys()].sort((a, b) => a - b)) {
      const row = perFrame.get(frame);
      if (row === undefined) continue;
      if (row.entries.length > 0) {
        residualRows.push(
          objectLiteral([
            ['on', formatString(`frame:${frame + 1}`)],
            ['entries', `[${row.entries.join(', ')}]`],
          ]),
        );
        continue;
      }
      const calls = row.run.map((name) => `${name}(vm, target, frame);`);
      frameRows.push(
        `{ frame: ${frame + 1}, run: (${['vm: Vm', 'target: Clip', 'frame: FrameCtx'].join(', ')}) => { ${calls.join(' ')} } }`,
      );
    }
    if (frameRows.length > 0) {
      chunks.push(
        `export const frameScripts: readonly FrameScript[] = [\n${frameRows.map((row) => `  ${row},`).join('\n')}\n];`,
      );
    }
    if (initBlob !== null) {
      residualRows.push(
        objectLiteral([
          ['on', "'init'"],
          ['entries', `[${initBlob.entrySymbol}]`],
        ]),
      );
    }
    // `DoInitAction` runs once when the sprite is created, so the runtime needs a named handle for it. A lowered
    // init gets the handle directly; a refused one gets the descriptor row above, which is the seam
    // `WP-120-09` exists to close. Clip-event handlers on a *placement* still have no table (`WP-120-10`).
    chunks.push(`export const initScript: FrameScript | null = ${initName ?? 'null'};`);
    chunks.push(residualTable(residualRows));
    add(path, chunks);
  }

  // One module per blob, so a diff of the emitted project shows the interpreted code as data rather than as an
  // absent function. Sorted by path in the assembly below, like every other file.
  for (const blob of built.blobs) add(blob.path, blob.chunks);

  for (const character of [...input.model.characters.values()].sort((a, b) => a.id - b.id)) {
    if (character.kind !== 'button' || character.button === null) continue;
    const path = `src/buttons/button_${character.id}.ts`;
    add(path, [`export const buttonId: number = ${character.id};`, buttonModule(input, character, residual, path)]);
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

  // ---- the manifest pair (`IMPL-120-R019`) ---------------------------------------------------------------
  //
  // `src/manifest.ts` goes through the module pipeline so it carries the generated header like every source file;
  // `forge.manifest.json` is appended as a root artifact with no header at all, because the app shell imports it
  // as strict JSON (`CMP` §5's example) and a comment would break that reader. Both splice the *same* serialized
  // text, so the drift `verify` looks for can only come from something editing one of the files afterwards.
  const manifest = buildManifest({
    header: input.header,
    model: input.model,
    ...(input.toolConfigHash === undefined ? {} : { toolConfigHash: input.toolConfigHash }),
    compact: input.manifestCompact === true,
  });
  const rootFiles: EmittedText[] = [];
  if (manifest.ok) {
    add('src/manifest.ts', [manifest.ts.trimEnd()]);
    rootFiles.push({ path: 'forge.manifest.json', text: `${manifest.json}\n` });
  }

  const all: EmittedText[] = [
    ...[...files.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([path, chunks]) => ({
        path,
        text: moduleText(input.header, path, chunks, [...(imports.get(path) ?? [])].sort()),
      })),
    ...rootFiles,
    ...scaffoldFiles(input.header),
  ].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));

  // One row per block, whatever else happened to it (`IMPL-120-R013`): the decisions list is the report's
  // evidence that the emitter saw the block and chose, so a block missing from it is a bug in the emitter.
  // A parity blob rides along in the row's reason instead of becoming a second row, which is what keeps
  // `subject` unique in the list.
  const emittedBy = new Map(emitted.map((entry) => [entry.subjectId, entry]));
  const refusedBy = new Map(refused.map((entry) => [entry.subjectId, entry]));
  const invalidBy = new Map(built.invalid.map((entry) => [entry.subjectId, entry.error]));
  const decisions = input.blocks
    .map((ir) => {
      const subject = `block:${ir.id}`;
      const blob = blobs.get(subject) ?? null;
      const invalid = invalidBy.get(subject) ?? null;
      const written = emittedBy.get(subject) ?? null;
      const tail = invalid === null ? '' : `; no residual blob: ${invalid}`;
      if (written !== null) {
        const parity = policy === 'always' && blob !== null ? `, plus a parity blob at ${blob.path}` : '';
        return {
          subject,
          action: 'emitted',
          reason: `written to ${written.path} as ${written.name}()${parity}${tail}`,
        };
      }
      const failure = refusedBy.get(subject);
      const why = `${failure?.refusal.reason ?? 'unbound-temp'}: ${failure?.refusal.detail ?? 'unknown'}`;
      if (blob !== null) {
        return {
          subject,
          action: 'residual',
          reason: `${why} → ${blob.path} (${blob.bytes} bytes, ${blob.sliceCount} slice(s), T${blob.tier})`,
        };
      }
      return { subject, action: 'deferred to WP-120-09', reason: `${why}${tail}` };
    })
    .sort((a, b) => (a.subject < b.subject ? -1 : a.subject > b.subject ? 1 : 0));

  const bytes = all.reduce((sum, file) => sum + Buffer.byteLength(file.text, 'utf8'), 0);
  return {
    files: all,
    emitted,
    refused,
    residual: built.blobs,
    invalidResidual: built.invalid,
    manifest: manifest.ok ? { withheld: manifest.withheld, json: manifest.json } : null,
    manifestError: manifest.ok ? null : manifest.error,
    decisions,
    counts: {
      blocks: input.blocks.length,
      emitted: emitted.length,
      refused: refused.length,
      residual: built.blobs.length,
      residualBytes: built.blobs.reduce((sum, blob) => sum + blob.bytes, 0),
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
