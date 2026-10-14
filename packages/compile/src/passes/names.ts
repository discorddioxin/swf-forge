/**
 * The name-assignment pass — `WP-120-05`, `IMPL-120-R008`, `R011`, `R012`, `CMP-D02`.
 *
 * This pass owns the **emission** namespace: one closed table mapping every symbol the emitter will
 * create to one identifier, built before emission so two passes cannot disagree (`R012`). The front end's
 * recovered names are an *input signal*, not the output — see the note on `functionBase` for why the
 * emitted name cannot simply be `MovieAnalysis.names`.
 *
 * Three rules do the work:
 *
 * - `R008` — a symbol's name is: recovered name → sanitised → `_2`, `_3` suffixes in sorted order.
 * - `R011` — suffixes are assigned in a *single* pass over a sorted candidate list (by source range, then
 *   character id), never by Map traversal order. This is what `T-CMP-001` measures: 100 shuffled dictionary
 *   orders must yield the same table.
 * - `CMP-D02` — collisions resolve by deterministic suffix, **never by hash** (unreadable), never by
 *   timestamp or counter that depends on run order.
 *
 * A synthetic name therefore derives from the *owning character id* and an ordinal within that owner, and
 * never from a byte offset: a dictionary reorder moves offsets, and a name that embeds one changes when
 * nothing about the symbol did. `IMPL-120-R033` states that as a rule; the front end's synthetic pattern
 * (`avm1_fn_<hex-offset>_<index>`, errata `E-044`) is what this pass declines to inherit.
 */

import type { ActionIR, FunctionDef } from '@swf-forge/avm1';
import type { MovieModel, SwfFile } from '@swf-forge/swf';

import { PipelineError } from '../pipeline.js';
import type { PassDecision } from '../pipeline.js';

export type SymbolKind =
  | 'character'
  | 'class'
  | 'function'
  | 'frameScript'
  | 'initScript'
  | 'clipEvent'
  | 'button'
  | 'residualBlob'
  | 'hoistedBlock';

/** `doc 120` §4's file-per-kind layout, so a symbol kind and an emitted file type agree. */
const KIND_LABEL: Readonly<Record<SymbolKind, string>> = {
  character: 'Character',
  class: 'Class',
  function: 'fn',
  frameScript: 'frame',
  initScript: 'init',
  clipEvent: 'clipEvent',
  button: 'btn',
  residualBlob: 'blob',
  hoistedBlock: 'shared',
};

/**
 * Identifiers an emitted function may not use. The language set because TypeScript inherits it;
 * `vm`/`target`/`frame` because `IMPL-120-R017` gives every frame script those three parameters, and a
 * recovered name shadowing one would silently change what the emitted body refers to.
 */
export const RESERVED_IDENTIFIERS: ReadonlySet<string> = new Set([
  'arguments',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'constructor',
  'continue',
  'debugger',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'eval',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'frame',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'package',
  'private',
  'protected',
  'public',
  'return',
  'static',
  'super',
  'switch',
  'target',
  'this',
  'throw',
  'true',
  'try',
  'typeof',
  'undefined',
  'var',
  'vm',
  'void',
  'while',
  'with',
  'yield',
]);

const IDENTIFIER_START = /[A-Za-z_$]/;
const IDENTIFIER_PART = /[A-Za-z0-9_$]/;

/**
 * Turns an authored name into a legal, non-reserved TypeScript identifier.
 *
 * Applied in order: characters outside `[A-Za-z0-9_$]` become separators (an SWF export name may hold
 * spaces, dots, hyphens or `/` paths); runs of separators collapse to one `_`; leading and trailing
 * separators are trimmed — but `_` is an identifier character, not a separator, so `_foo_` survives
 * intact and AS1's `_root`, `_global` and `_level0` keep the spelling that makes them work; a leading
 * digit gets an `_` prefix
 * (`3rd Prize` → `_3rd_Prize`); a reserved word gets `_` appended (`class` → `class_`); an empty result
 * falls back to `callerSuppliedDefault`. A name that is *only* separators (`"---"`) yields that fallback
 * too, which keeps `Character---` and `Character___` from colliding on nothing.
 */
export function sanitiseName(raw: string, fallback: string): string {
  let out = '';
  let pendingSeparator = false;
  for (const char of raw) {
    if (IDENTIFIER_PART.test(char)) {
      if (out !== '' && pendingSeparator) out += '_';
      out += char;
      pendingSeparator = false;
      continue;
    }
    if (out === '' && IDENTIFIER_START.test(char)) {
      out += char;
      continue;
    }
    pendingSeparator = out !== '';
  }
  if (out === '') return sanitiseName(fallback, 'symbol');
  if (!IDENTIFIER_START.test(out[0] ?? '0')) out = `_${out}`;
  if (RESERVED_IDENTIFIERS.has(out)) out = `${out}_`;
  return out;
}

export interface NameCandidate {
  readonly kind: SymbolKind;
  /** Stable identity of the thing being named (character id, IR id, class name…). */
  readonly subjectId: string;
  /** The owning character id for a symbol inside a character; `null` for a movie-level symbol. */
  readonly ownerCharacterId: number | null;
  /** The name to start from: an export name or a declared name. `null` ⇒ synthetic. */
  readonly base: string | null;
  /** R011's sort key: the symbol's source range start, in its owner's action stream. */
  readonly orderKey: number;
  /** Extra provenance for the porting notes. */
  readonly note?: string;
}

export interface NamedSymbol {
  readonly kind: SymbolKind;
  readonly subjectId: string;
  readonly name: string;
  /** What the name came from, for `porting-notes.json` (R030's "the report is a work list"). */
  readonly source: 'export' | 'declared' | 'recovered' | 'synthetic';
  readonly ownerCharacterId: number | null;
  /** The R011 sort key it was assigned with; `extendNameTable` needs it to re-run the same order. */
  readonly orderKey: number;
}

export interface NameTable {
  /** The closed table, in assignment order. */
  readonly symbols: readonly NamedSymbol[];
  readonly bySubject: ReadonlyMap<string, string>;
  /** Per-kind counts, so the report can say what was named from where. */
  readonly counts: Readonly<Record<SymbolKind, number>>;
  readonly syntheticCount: number;
  readonly suffixedCount: number;
}

function compareCandidates(a: NameCandidate, b: NameCandidate): number {
  // R011 reads "by source range, then character id", in that order, with `subjectId` last so the order is
  // total and never depends on the insertion order that produced the candidate list.
  if (a.orderKey !== b.orderKey) return a.orderKey - b.orderKey;
  if (a.ownerCharacterId !== b.ownerCharacterId) {
    if (a.ownerCharacterId === null) return -1;
    if (b.ownerCharacterId === null) return 1;
    return a.ownerCharacterId - b.ownerCharacterId;
  }
  if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
  return a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : 0;
}

/**
 * Assigns names in one pass over the sorted candidate list (`R011`).
 *
 * Within one owner, a synthetic name is numbered by its position among that owner's synthetics, and a
 * collision is resolved by a per-base counter that starts at 2 for the second user of a name. Both counters
 * are properties of the sorted order, so the table is invariant under any reordering that preserves each
 * symbol's owner, source range and id.
 */
export function assignNames(candidates: readonly NameCandidate[]): NameTable {
  const sorted = [...candidates].sort(compareCandidates);
  const taken = new Set<string>();
  const baseUses = new Map<string, number>();
  const syntheticOrdinals = new Map<string, number>();
  const symbols: NamedSymbol[] = [];
  let suffixed = 0;

  for (const candidate of sorted) {
    const ownerKey = candidate.ownerCharacterId === null ? 'movie' : `char${candidate.ownerCharacterId}`;
    const isSynthetic = candidate.base === null || candidate.base === '';
    let base: string;
    let source: NamedSymbol['source'];
    if (isSynthetic) {
      const ordinal = (syntheticOrdinals.get(`${ownerKey}:${candidate.kind}`) ?? 0) + 1;
      syntheticOrdinals.set(`${ownerKey}:${candidate.kind}`, ordinal);
      // `AVM1-R036`'s pattern: `<kind><CharacterId>_<n>`, zero-padded to 2 so ordering reads correctly.
      const idPart = candidate.ownerCharacterId === null ? '' : String(candidate.ownerCharacterId);
      base = `${KIND_LABEL[candidate.kind]}${idPart}_${String(ordinal).padStart(2, '0')}`;
      source = 'synthetic';
    } else {
      base = sanitiseName(candidate.base, `${KIND_LABEL[candidate.kind]}${candidate.ownerCharacterId ?? 0}`);
      source = candidate.note === 'export' ? 'export' : candidate.note === 'recovered' ? 'recovered' : 'declared';
    }

    // CMP-D02: the first claimant of a base keeps it; later ones get `_2`, `_3` in sorted order — never a
    // hash, never a counter that depends on input order. A suffixed candidate can itself collide with a
    // symbol whose base literally *is* `foo_2`, so the loop keeps advancing until the name is free.
    let uses = (baseUses.get(base) ?? 0) + 1;
    baseUses.set(base, uses);
    let name = uses === 1 ? base : `${base}_${uses}`;
    while (taken.has(name)) {
      uses = (baseUses.get(base) ?? uses) + 1;
      baseUses.set(base, uses);
      name = `${base}_${uses}`;
    }
    if (uses > 1) suffixed += 1;
    taken.add(name);

    symbols.push({
      kind: candidate.kind,
      subjectId: candidate.subjectId,
      name,
      source,
      ownerCharacterId: candidate.ownerCharacterId,
      orderKey: candidate.orderKey,
    });
  }

  const bySubject = new Map<string, string>();
  for (const symbol of symbols) {
    if (bySubject.has(symbol.subjectId)) {
      throw new PipelineError(`two name candidates share the subject id ${symbol.subjectId}`);
    }
    bySubject.set(symbol.subjectId, symbol.name);
  }

  const counts = {
    character: 0,
    class: 0,
    function: 0,
    frameScript: 0,
    initScript: 0,
    clipEvent: 0,
    button: 0,
    residualBlob: 0,
  } as Record<SymbolKind, number>;
  for (const symbol of symbols) counts[symbol.kind] += 1;

  return {
    symbols,
    bySubject,
    counts,
    syntheticCount: symbols.filter((symbol) => symbol.source === 'synthetic').length,
    suffixedCount: suffixed,
  };
}

/**
 * Every `FunctionDef` in a block tree, with its own source range.
 *
 * The position is the function's, not its containing block's: a basic block may declare several functions,
 * and keying them all on the block start gives them one order key and one subject id, which the closed
 * table then (correctly) refuses. `ActionIR.blocks` is already flat, so a function declared inside a `Try`
 * body is reached the same way as one at the top of the block.
 */
function functionsOf(ir: ActionIR): readonly { readonly fn: FunctionDef; readonly offset: number }[] {
  const out: { fn: FunctionDef; offset: number }[] = [];
  for (const block of ir.blocks) {
    for (const op of block.ops) {
      if (op.kind === 'define') out.push({ fn: op.fn, offset: op.fn.bodyStart });
    }
  }
  return out;
}

function reverseExports(model: MovieModel): Map<number, string> {
  // One character may be exported under several names; the lexicographically first wins, so the choice
  // cannot depend on Map order (`R011`).
  const out = new Map<number, string>();
  for (const [name, id] of [...model.exported.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (!out.has(id)) out.set(id, name);
  }
  return out;
}

export interface BuildNameTableInput {
  readonly model: MovieModel;
  /** The tag index, for the one ownership fact R011's "then character id" needs. */
  readonly file: SwfFile;
  readonly blocks: readonly ActionIR[];
  /** Recovered classes, when the front end reports any (see `E-044`: it does not yet). */
  readonly classes: ReadonlyMap<string, unknown>;
}

/**
 * The character that owns an action block, from the tag index's `inSprite` — the nesting fact the reader
 * already records for every tag. A block found in no tag body (or in a top-level one) is movie-level.
 */
export function ownerCharacterOf(file: SwfFile, start: number): number | null {
  let best: { length: number; inSprite: number | null } | null = null;
  for (const tag of file.tagIndex.tags) {
    if (tag.offset > start || tag.length < 0) continue;
    if (start >= tag.offset + tag.length) continue;
    if (best === null || tag.length < best.length) best = { length: tag.length, inSprite: tag.inSprite };
  }
  return best?.inSprite ?? null;
}

/**
 * Builds the candidate list for a movie: one symbol per character, per action block, per recovered class,
 * and per function. The block's `kind` selects the symbol kind, so the table matches the file layout in
 * `IMPL-120` §4 rather than a parallel taxonomy of P6's invention.
 */
export function buildCandidates(input: BuildNameTableInput): NameCandidate[] {
  const exportNames = reverseExports(input.model);
  const candidates: NameCandidate[] = [];

  for (const character of [...input.model.characters.values()].sort((a, b) => a.id - b.id)) {
    candidates.push({
      kind: 'character',
      subjectId: `char:${character.id}`,
      ownerCharacterId: character.id,
      base: exportNames.get(character.id) ?? null,
      orderKey: character.index?.offset ?? 0,
      ...(exportNames.has(character.id) ? { note: 'export' } : {}),
    });
  }

  for (const [name] of [...input.classes.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    candidates.push({ kind: 'class', subjectId: `class:${name}`, ownerCharacterId: null, base: name, orderKey: 0 });
  }

  for (const ir of input.blocks) {
    const ownerCharacterId = ownerCharacterOf(input.file, ir.byteRange.start);
    const kind: SymbolKind =
      ir.kind === 'init'
        ? 'initScript'
        : ir.kind === 'clipEvent'
          ? 'clipEvent'
          : ir.kind === 'button'
            ? 'button'
            : 'frameScript';
    candidates.push({
      kind,
      subjectId: `block:${ir.id}`,
      ownerCharacterId,
      base: ir.sourceName,
      orderKey: ir.byteRange.start,
      ...(ir.sourceName !== null ? { note: 'recovered' } : {}),
    });
    if (ir.tier === 2) {
      candidates.push({
        kind: 'residualBlob',
        subjectId: `blob:${ir.id}`,
        ownerCharacterId,
        base: null,
        orderKey: ir.byteRange.start,
      });
    }
    for (const { fn, offset } of functionsOf(ir)) {
      candidates.push({
        kind: 'function',
        subjectId: `fn:${ir.id}:${offset}`,
        ownerCharacterId: ownerCharacterOf(input.file, offset) ?? ownerCharacterId,
        base: fn.name,
        orderKey: offset,
      });
    }
  }

  return candidates;
}

export interface NamePassResult {
  readonly table: NameTable;
  readonly decisions: readonly PassDecision[];
}

/** Runs the pass over a movie's model + IR. `R013`'s principle applies to naming too: every decision is reported. */
export function buildNameTable(input: BuildNameTableInput): NamePassResult {
  const table = assignNames(buildCandidates(input));
  const decisions: PassDecision[] = table.symbols.map((symbol) => ({
    subject: symbol.subjectId,
    action: `named ${symbol.name}`,
    reason:
      symbol.source === 'synthetic'
        ? `no export or declared name; ${KIND_LABEL[symbol.kind]}-pattern synthetic per AVM1-R036 (offset-free, R033)`
        : `from the ${symbol.source} name`,
  }));
  if (input.classes.size === 0) {
    decisions.push({
      subject: 'classes',
      action: 'no class symbols allocated',
      reason: 'the front end reported no recovered classes (IMPL-050-R063; see errata E-044)',
    });
  }
  return { table, decisions };
}
