/**
 * The dead-code pass — `WP-120-03`, `IMPL-120-R005`, `R013`.
 *
 * The pass produces a **proof**, not a heuristic. That distinction is the whole design: a character may be
 * called dead only when nothing can reach it, and "nothing can reach it" is only as good as the list of ways
 * something *can*. The model records most of them — timeline placements and removals, button records,
 * button and `StartSound` ids, shape and morph fills (including `FILL_CLIP`, whose clip character the decoder
 * keeps under the same `bitmapId` field, so a shape that clips a text character holds it alive), and text
 * `fontId` — but a payload it could not parse records nothing at all, and "no reference recorded" is exactly
 * what a missed reference looks like. So a *reachable* referencer with an incomplete payload (`DefineSprite`
 * with no `sprite`, a quarantined shape or morph, a `DefineText` with no runs, an unknown tag) means the
 * closure is not a proof, and pruning is disabled for the whole movie rather than applied to whichever
 * characters happened to look safe. Partial application of an unsound proof is the failure mode this rule
 * exists to prevent.
 *
 * Removal is opt-in (`--prune-dead-code`, `CMP` §4.6 step 5 and §12). Without the flag the pass still runs
 * and still reports every candidate, because the report is what makes the eventual "0 suppressions" claim
 * reviewable (`R013`). Doc 120 formerly said character pruning was *default on*, which the design spec does
 * not permit; the correction and the reason are recorded as errata `E-046`.
 *
 * Name-based addressing is handled by making it a root rule rather than an analysis: `attachMovie`,
 * `StartSound2` and `DefineEditText`'s `fontClass` all resolve through `ExportAssets`, so every exported
 * character is a root by construction and no dynamic string can name a character this pass would prune.
 */

import type { ActionIR } from '@swf-forge/avm1';
import type { CharacterModel, FillStyle, MovieModel, SwfFile, TimelineModel, VectorShape } from '@swf-forge/swf';

import { PipelineError } from '../pipeline.js';
import type { Pass, PassDecision, PassOutcome, PipelineState, StageContext } from '../pipeline.js';
import { ownerCharacterOf } from './names.js';

/**
 * The kinds that can name another character. Anything outside this set is a leaf — a bitmap, font, sound,
 * video, binary blob or import alias carries no reference to a character in this movie — and leaves are what
 * make an unreferenced-character proof finish in one pass over the dictionary.
 */
const REFERENCER_KINDS: ReadonlySet<CharacterModel['kind']> = new Set<CharacterModel['kind']>([
  'sprite',
  'button',
  'shape',
  'shape4',
  'morphShape',
  'text',
  'editText',
]);

/** Why a verdict says what it says. The `reason` strings reach the build report, so they are wording. */
export type CharacterVerdictState =
  /** Placed on the main timeline, or exported: nothing may remove it. */
  | 'root'
  /** Named by a reachable character. */
  | 'reachable'
  /** Proved unreferenced, and removed because `--prune-dead-code` is set. */
  | 'pruned'
  /** Proved unreferenced, kept because the flag is off. */
  | 'prunable'
  /** Kept because this pass cannot prove it dead: the reference closure is incomplete. */
  | 'kept-unproven';

export interface CharacterVerdict {
  readonly characterId: number;
  readonly kind: CharacterModel['kind'];
  readonly state: CharacterVerdictState;
  readonly reason: string;
  /** The character(s) that keep it alive, for `reachable` verdicts, ascending. */
  readonly referencedBy: readonly number[];
}

export type BlockVerdictState = 'kept' | 'pruned' | 'prunable' | 'partially-unreachable';

export interface BlockVerdict {
  readonly irId: string;
  readonly kind: ActionIR['kind'];
  readonly state: BlockVerdictState;
  readonly reason: string;
  /** Basic blocks the front end flagged `unreachable` (`IMPL-050-R052`); the emitter skips these anyway. */
  readonly unreachableBlocks: readonly number[];
}

export interface DeadCodeInput {
  readonly model: MovieModel;
  readonly file: SwfFile;
  readonly blocks: readonly ActionIR[];
  readonly prune: boolean;
  /**
   * Entries whose payload the reader could not finish (`ModelArtifact.readInterruptions`). A payload with a
   * hole in it names nothing *as far as the model knows*, which is not the same statement as "names nothing".
   */
  readonly interrupted?: ReadonlyMap<number, readonly string[]> | undefined;
}

export interface DeadCodePlan {
  readonly characters: readonly CharacterVerdict[];
  readonly blocks: readonly BlockVerdict[];
  /** Character ids removed (flag on) or reported (flag off); empty whenever the proof is incomplete. */
  readonly removed: readonly number[];
  readonly proofComplete: boolean;
  readonly blockers: readonly { readonly characterId: number; readonly reason: string }[];
  readonly counts: {
    readonly characters: number;
    readonly roots: number;
    readonly reachable: number;
    readonly candidates: number;
    readonly removed: number;
    readonly blockCandidates: number;
    readonly blocksRemoved: number;
    readonly unreachableBasicBlocks: number;
  };
}

/** Outgoing character references of one dictionary entry, and whether the read was complete. */
interface References {
  readonly ids: number[];
  readonly complete: boolean;
  readonly blocker: string | null;
}

const INCOMPLETE = (blocker: string): References => ({ ids: [], complete: false, blocker });

/**
 * A shape's or morph's style table names bitmaps, and `FILL_CLIP`'s clip character under the same field.
 *
 * Lines are read too, and only through `LineStyle.fill`: a `LINESTYLE2` carries a full `FillStyle`, so a
 * thick stroke tiled with a bitmap holds that bitmap alive exactly as a fill does. The flat `color` field on
 * `LineStyle` is the v1/v2 case, where no style list can name a character.
 */
function styleIds(shape: VectorShape, into: number[]): void {
  const push = (style: FillStyle | null | undefined): void => {
    if (style !== null && style !== undefined && style.kind === 'bitmap') into.push(style.bitmapId);
  };
  for (const fill of shape.styles.fills) push(fill);
  for (const line of shape.styles.lines) {
    if (line !== null) push(line.fill);
  }
}

/** Reads one character's payload for the ids it names. An unreadable payload is reported, never assumed. */
export function referencesOf(character: CharacterModel): References {
  const ids: number[] = [];
  switch (character.kind) {
    case 'sprite': {
      const sprite = character.sprite;
      if (sprite === null) return INCOMPLETE('a `DefineSprite` with no decoded timeline');
      for (const frame of sprite.timeline.frames) {
        for (const op of frame.ops) {
          if (op.kind === 'place' || op.kind === 'remove') {
            // A `RemoveObject2` may name only a depth, which P2 resolves against the display list it builds
            // while reading. A placement whose target cannot be resolved is still a reference in the file: the
            // character it points at is live, and an empty id list would be a licence to prune it.
            if (typeof op.characterId !== 'number') {
              return INCOMPLETE(`a placement in character ${character.id} names no resolvable character id`);
            }
            ids.push(op.characterId);
          }
        }
        for (const event of frame.soundEvents) {
          // `null` here is the encoding's own "stop playing" entry (sound id 0xffff), not a failed read, so it
          // is skipped rather than treated as an unresolved reference.
          if (event.soundId !== null) ids.push(event.soundId);
        }
      }
      return { ids, complete: true, blocker: null };
    }
    case 'button': {
      const button = character.button;
      if (button === null) return INCOMPLETE('a `DefineButton*` with no decoded records');
      for (const record of button.records) ids.push(record.characterId);
      for (const sound of button.sounds) ids.push(sound.soundId);
      return { ids, complete: true, blocker: null };
    }
    case 'shape':
    case 'shape4': {
      const shape = character.vectorShape;
      if (shape === null) return INCOMPLETE('a shape with no decoded style table');
      if (shape.quarantined === true)
        return INCOMPLETE(`shape ${character.id} is quarantined; its later records are unread`);
      styleIds(shape, ids);
      return { ids, complete: true, blocker: null };
    }
    case 'morphShape': {
      const morph = character.morph;
      if (morph === null) return INCOMPLETE('a morph with no decoded shapes');
      if (morph.quarantined === true)
        return INCOMPLETE(`morph ${character.id} is quarantined; its later records are unread`);
      styleIds(morph.start, ids);
      styleIds(morph.end, ids);
      return { ids, complete: true, blocker: null };
    }
    case 'text': {
      const text = character.text;
      if (text === null) return INCOMPLETE('a `DefineText` with no decoded runs');
      for (const run of text.runs) {
        // A `TEXTRECORD` whose style fields could not be read carries `fontId: null`, and a run with no font
        // is not evidence that no font is needed. The colour in a text run is an inline RGBA value, never a
        // fill style, so `fontId` is the only character id a static text payload can name.
        if (run.fontId === null) {
          return INCOMPLETE(`a text run in character ${character.id} has no readable font id`);
        }
        ids.push(run.fontId);
      }
      return { ids, complete: true, blocker: null };
    }
    case 'editText': {
      const edit = character.editText;
      if (edit === null) return INCOMPLETE('a `DefineEditText` with no decoded payload');
      // `fontClass` names a font through `ExportAssets`, and every exported character is a root, so a null
      // `fontId` is only safe when the name took its place.
      if (edit.fontId !== null) ids.push(edit.fontId);
      else if (edit.fontClass === null) {
        return INCOMPLETE(`character ${character.id} is editable text naming no font by id or export name`);
      }
      return { ids, complete: true, blocker: null };
    }
    case 'video':
      // `DefineVideo4`'s payload ends with `DeblockCharacterID`, naming a bitmap used to smooth the decoded
      // frames, and P2 decodes no video payload at all (`CharacterModel` has no video field). A bitmap
      // pruned out from under a video character would surface as missing smoothing, not as a diagnostic.
      return INCOMPLETE('a `DefineVideo4` names a deblocking bitmap the model does not decode (E-046)');
    case 'font2':
    case 'font3':
      // `HaveBitmaps` on DefineFont2/3 gives every glyph outline a `BitmapCharacterID` naming a
      // `DefineBitsJPEG`-family character. `DefineFontModel` decodes glyphs, codes and metrics and carries no
      // such field, so the reference set of a bitmap font is unknowable here. DefineFont v1 and DefineFont4
      // have no character id anywhere in their payload, which is why the block is not widened to them.
      return INCOMPLETE('a `DefineFont2/3` can name bitmap glyphs the model does not decode (E-046)');
    case 'binaryData':
      // An attached movie lives in the container's own dictionary, so it cannot reach an id in this one.
      // Sound, bitmap, font-v1, font4 and `missing` placeholders are leaves for the same kind of reason.
      return { ids, complete: true, blocker: null };
    case 'unknown':
      // The payload was never parsed, so it could name any character id. Leaf-hood cannot be assumed here.
      return INCOMPLETE(`character ${character.id} has an unparsed (unknown) tag payload`);
    default:
      return { ids, complete: true, blocker: null };
  }
}

/**
 * The reachability closure, then the per-block verdicts. Pure (`IMPL-120-R001`): every output is sorted, no
 * `Map` iteration order reaches a verdict, and no clock or filesystem is read.
 */
export function analyseDeadCode(input: DeadCodeInput): DeadCodePlan {
  const { model, file, blocks, prune, interrupted } = input;
  const timeline: TimelineModel = model.mainTimeline;

  const roots = new Map<number, string>();
  for (const frame of timeline.frames) {
    for (const op of frame.ops) {
      const id = op.kind === 'place' || op.kind === 'remove' ? op.characterId : null;
      if (typeof id === 'number' && !roots.has(id)) {
        roots.set(id, `placed on the main timeline (frame ${frame.index + 1})`);
      }
    }
    for (const event of frame.soundEvents) {
      if (event.soundId !== null && !roots.has(event.soundId)) {
        roots.set(event.soundId, `started by a StartSound on frame ${frame.index + 1}`);
      }
    }
  }
  for (const [name, id] of model.exported) {
    if (!roots.has(id)) roots.set(id, `exported as ${JSON.stringify(name)} (name-based lookup can reach it)`);
  }

  // Fixed point over the dictionary. `edges` caches each reachable referencer's read, and records the
  // incompleteness that the closure could not see past.
  const reachable = new Map<number, { via: number; edge: string }>();
  const blockers = new Map<number, string>();
  const work: number[] = [...roots.keys()].sort((a, b) => a - b);
  for (const id of work) reachable.set(id, { via: id, edge: roots.get(id) ?? 'root' });
  for (let cursor = 0; cursor < work.length; cursor += 1) {
    const current = work[cursor] as number;
    const character = model.characters.get(current);
    if (character === undefined) continue; // a `missing` placeholder with no dictionary entry
    const read = referencesOf(character);
    const holes = interrupted?.get(current) ?? [];
    if (holes.length > 0) {
      blockers.set(current, `its payload was not fully read (${[...new Set(holes)].sort().join(', ')})`);
    } else if (!read.complete && read.blocker !== null) {
      blockers.set(current, read.blocker);
    }
    for (const id of read.ids) {
      if (reachable.has(id)) continue;
      reachable.set(id, { via: current, edge: `${character.kind} ${current}` });
      work.push(id);
    }
  }
  work.sort((a, b) => a - b);

  // A referencer that the model could not fully read, *and that is live*, breaks the proof for everything.
  const blockingIds = [...blockers.keys()].filter((id) => reachable.has(id)).sort((a, b) => a - b);
  const proofComplete = blockingIds.length === 0;

  const incoming = new Map<number, number[]>();
  for (const [id, link] of reachable) {
    if (link.via === id) continue;
    const list = incoming.get(id) ?? [];
    list.push(link.via);
    incoming.set(id, list);
  }

  const characters: CharacterVerdict[] = [];
  const candidates: number[] = [];
  for (const character of [...model.characters.values()].sort((a, b) => a.id - b.id)) {
    if (character.kind === 'missing') continue; // the model's own placeholder for a dangling reference
    const link = reachable.get(character.id);
    if (link !== undefined) {
      const via = [...(incoming.get(character.id) ?? [])].sort((a, b) => a - b);
      characters.push({
        characterId: character.id,
        kind: character.kind,
        state: 'reachable',
        reason: roots.has(character.id) ? (roots.get(character.id) as string) : `named by ${via.join(', ')}`,
        referencedBy: via,
      });
      continue;
    }
    if (!proofComplete) {
      characters.push({
        characterId: character.id,
        kind: character.kind,
        state: 'kept-unproven',
        reason: 'unreferenced, but the reference closure is incomplete for this movie (see the pass blockers)',
        referencedBy: [],
      });
      continue;
    }
    const isReferencer = REFERENCER_KINDS.has(character.kind) || (interrupted?.has(character.id) ?? false);
    const own = referencesOf(character);
    const selfSafe = !isReferencer || (own.complete && (interrupted?.get(character.id) ?? []).length === 0);
    if (!selfSafe) {
      characters.push({
        characterId: character.id,
        kind: character.kind,
        state: 'kept-unproven',
        reason: own.blocker ?? 'its own payload could not be read, so nothing about it is provable',
        referencedBy: [],
      });
      continue;
    }
    candidates.push(character.id);
    characters.push({
      characterId: character.id,
      kind: character.kind,
      state: prune ? 'pruned' : 'prunable',
      reason: prune
        ? `no placement, no export, and no reachable character names it (removed under --prune-dead-code)`
        : `no placement, no export, and no reachable character names it (kept: --prune-dead-code is off)`,
      referencedBy: [],
    });
  }

  const removed = prune && proofComplete ? candidates : [];
  const removedSet = new Set(removed);

  // A `DoInitAction` tag lives at movie level but belongs to the sprite it initialises, so the tag's own
  // `inSprite` answer ("nobody") is the wrong owner here: nothing would ever be allowed to die with its
  // sprite. The schedule is the authoritative link (`IMPL-050-R073`, errata `E-040`).
  const initOwner = new Map<number, number>();
  for (const entry of model.initActions) initOwner.set(entry.block.offset, entry.spriteId);

  const blockVerdicts: BlockVerdict[] = [];
  const blockCandidates: string[] = [];
  let unreachableBasicBlocks = 0;
  for (const ir of [...blocks].sort((a, b) => a.id.localeCompare(b.id))) {
    const unreachable = ir.blocks.filter((block) => block.unreachable).map((block) => block.id);
    unreachableBasicBlocks += unreachable.length;
    const owner = initOwner.get(ir.byteRange.start) ?? ownerCharacterOf(file, ir.byteRange.start);
    const dead = owner !== null && removedSet.has(owner);
    const beyondEnd =
      ir.kind === 'timeline' &&
      ir.frameAssociations.length > 0 &&
      ir.frameAssociations.every((frame) => frame >= model.frameCount);
    if (dead || beyondEnd) {
      blockCandidates.push(ir.id);
      blockVerdicts.push({
        irId: ir.id,
        kind: ir.kind,
        state: prune ? 'pruned' : 'prunable',
        reason: dead
          ? `its owning character ${owner} is ${prune ? 'removed' : 'unreferenced'}, so nothing schedules this block`
          : `every frame it is associated with (${ir.frameAssociations.map((frame) => frame + 1).join(', ')}) is at or past the movie's ${model.frameCount}-frame length`,
        unreachableBlocks: unreachable,
      });
      continue;
    }
    if (unreachable.length > 0) {
      blockVerdicts.push({
        irId: ir.id,
        kind: ir.kind,
        state: 'partially-unreachable',
        reason: `${unreachable.length} basic block(s) the front end flagged unreachable; the emitter does not emit them, so nothing is pruned here`,
        unreachableBlocks: unreachable,
      });
      continue;
    }
    blockVerdicts.push({
      irId: ir.id,
      kind: ir.kind,
      state: 'kept',
      reason: 'scheduled content',
      unreachableBlocks: [],
    });
  }

  return {
    characters,
    blocks: blockVerdicts,
    removed,
    proofComplete,
    blockers: blockingIds.map((characterId) => ({ characterId, reason: blockers.get(characterId) as string })),
    counts: {
      characters: model.characters.size,
      roots: roots.size,
      reachable: reachable.size,
      candidates: candidates.length,
      removed: removed.length,
      blockCandidates: blockCandidates.length,
      blocksRemoved: prune && proofComplete ? blockCandidates.length : 0,
      unreachableBasicBlocks,
    },
  };
}

/**
 * The report entries (`R013`). Per-character entries are emitted only for the verdicts a reader has to
 * review — removed, removal candidates, and kept-unproven — not for the roots, because a movie with 300
 * characters and no dead code would otherwise spend its whole report saying so. One summary entry always
 * states the counts and the flag's effect.
 */
export function deadCodeDecisions(plan: DeadCodePlan, prune: boolean): PassDecision[] {
  const decisions: PassDecision[] = [];
  for (const verdict of plan.characters) {
    if (verdict.state === 'root' || verdict.state === 'reachable') continue;
    decisions.push({
      subject: `character ${verdict.characterId} (${verdict.kind})`,
      action:
        verdict.state === 'pruned' ? 'pruned' : verdict.state === 'prunable' ? 'reported as unreferenced' : 'kept',
      reason: verdict.reason,
    });
  }
  for (const verdict of plan.blocks) {
    if (verdict.state === 'kept') continue;
    decisions.push({
      subject: `action block ${verdict.irId}`,
      action:
        verdict.state === 'pruned' ? 'pruned' : verdict.state === 'prunable' ? 'reported as unreachable' : 'reported',
      reason: verdict.reason,
    });
  }
  for (const blocker of plan.blockers) {
    decisions.push({
      subject: `character ${blocker.characterId} (${blocker.reason})`,
      action: 'pruning disabled for the movie',
      reason: 'the reference closure cannot be completed past this payload, so no character is provable',
    });
  }
  decisions.push({
    subject: 'dead code',
    action: `${plan.counts.candidates} character(s), ${plan.counts.blockCandidates} block(s)`,
    reason: prune
      ? `--prune-dead-code is set and the proof is complete: ${plan.counts.removed} character(s) and ${plan.counts.blocksRemoved} block(s) removed`
      : `--prune-dead-code is off, so every candidate above is reported and nothing is removed; proof complete: ${plan.proofComplete ? 'yes' : 'no'}`,
  });
  return decisions;
}

export interface DeadCodePassOptions {
  /** Overrides `config.pruneDeadCode` (tests); otherwise the resolved config decides. */
  readonly prune?: boolean;
  readonly blocks?: readonly ActionIR[];
}

export function deadCodePass(options: DeadCodePassOptions = {}): Pass {
  return {
    id: 'dead-code',
    run: (state: PipelineState, ctx: StageContext): PassOutcome => {
      if (state.model === undefined || state.read === undefined) {
        throw new PipelineError('the dead-code pass needs the `read` and `model` stages');
      }
      const blocks = options.blocks ?? state.analysis?.analysis.blocks.map((block) => block.ir);
      if (blocks === undefined) {
        throw new PipelineError('the dead-code pass needs the `analyze` stage for its block verdicts');
      }
      const prune = options.prune ?? ctx.switches.pruneDeadCode;
      const interrupted = new Map<number, string[]>();
      for (const entry of state.model.readInterruptions) {
        const codes = interrupted.get(entry.characterId) ?? [];
        codes.push(entry.code);
        interrupted.set(entry.characterId, codes);
      }
      const plan = analyseDeadCode({
        model: state.model.model,
        file: state.read.file,
        blocks,
        prune,
        interrupted,
      });
      return { report: { id: 'dead-code', decisions: deadCodeDecisions(plan, prune) }, state: { deadCode: plan } };
    },
  };
}
