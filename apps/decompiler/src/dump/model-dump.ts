/**
 * The model dump — `IMPL-040` §3.6 (`forge-decompile dump`).
 *
 * One pure function from `(file, model)` to a plain JSON-able value. Every map is emitted as an array
 * sorted by key, sequences that exist in file order keep it, and nothing carries a timestamp or a path
 * (`IMPL-040-R045`/`R046`), so a re-run over the same bytes is byte-identical (`REPO-R015`). The human
 * summary is a view over the same object: one serializer, two renderings, no second source of truth.
 */

import type {
  ActionBlockRef,
  Cxform,
  Diagnostic,
  DisplayOp,
  FilterSpec,
  Mat2D,
  MovieModel,
  PlacementOp,
  Rect,
  Rgba,
  SwfFile,
  TagRef,
  TimelineModel,
} from '@swf-forge/swf';

export const DUMP_FORMAT = 'swf-forge/model-dump';
export const DUMP_FORMAT_VERSION = 1;

export interface DumpTagRef {
  readonly code: number;
  readonly offset: number;
  readonly length: number;
  readonly depth: number;
  readonly inSprite: number | null;
  readonly index: number;
  readonly headerOffset: number;
}

export interface DumpRect {
  readonly xMin: number;
  readonly xMax: number;
  readonly yMin: number;
  readonly yMax: number;
}

export interface DumpMatrix {
  readonly a: number;
  readonly b: number;
  readonly c: number;
  readonly d: number;
  readonly tx: number;
  readonly ty: number;
}

export interface DumpCxform {
  readonly rm: number;
  readonly gm: number;
  readonly bm: number;
  readonly am: number;
  readonly ra: number;
  readonly ga: number;
  readonly ba: number;
  readonly aa: number;
}

export interface DumpRgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export interface DumpAction {
  readonly offset: number;
  readonly length: number;
}

type SerializedFilter<F> = F extends unknown
  ? F extends { readonly kind: 'unknown'; readonly raw: Uint8Array }
    ? Omit<F, 'raw'> & { readonly raw: readonly number[] }
    : F
  : never;

export type DumpFilter = SerializedFilter<FilterSpec>;

export interface DumpPlacement {
  readonly kind: 'place';
  readonly tag: string;
  readonly index: number;
  readonly depth: number;
  readonly move: boolean;
  readonly characterId: number | null;
  readonly name: string | null;
  readonly matrix: DumpMatrix | null;
  readonly cxform: DumpCxform | null;
  readonly ratio: number | null;
  readonly clipDepth: number | null;
  readonly className: string | null;
  readonly image: { readonly kind: 'class' | 'characterId' } | null;
  readonly filters: readonly DumpFilter[] | null;
  readonly blendMode: number | null;
  readonly cacheAsBitmap: boolean;
  readonly rawCacheValue: number | null;
  readonly visible: boolean | null;
  readonly opaqueBackground: DumpRgba | null;
  readonly clipActions: DumpAction | null;
  readonly tagOffset: number;
}

export interface DumpRemoval {
  readonly kind: 'remove';
  readonly tag: string;
  readonly index: number;
  readonly depth: number;
  readonly characterId: number | null;
  readonly tagOffset: number;
}

export interface DumpTabIndex {
  readonly kind: 'tabIndex';
  readonly index: number;
  readonly depth: number;
  readonly tabIndex: number;
  readonly tagOffset: number;
}

export type DumpOp = DumpPlacement | DumpRemoval | DumpTabIndex;

export interface DumpLabel {
  readonly name: string;
  readonly frame: number;
  readonly namedAnchor: boolean;
}

export interface DumpFrame {
  readonly index: number;
  readonly label: string | null;
  readonly ops: readonly DumpOp[];
  readonly actions: readonly DumpAction[];
  readonly soundStreamBlock: { readonly offset: number; readonly length: number } | null;
  readonly videoFrames: readonly DumpTagRef[];
}

export interface DumpStreamSoundSpan {
  readonly head: DumpTagRef;
  readonly blocks: readonly DumpTagRef[];
}

export interface DumpTimeline {
  readonly declaredFrameCount: number | null;
  readonly observedFrameCount: number;
  readonly frames: readonly DumpFrame[];
  readonly labels: readonly DumpLabel[];
  readonly streamSoundSpans: readonly DumpStreamSoundSpan[];
  /**
   * Scene data found inside a sprite, recorded as a single implicit scene
   * (`IMPL-040-R013`, `SF0169`). Always `null` on the main timeline.
   */
  readonly implicitScene: { readonly name: string } | null;
}

export interface DumpSprite {
  readonly characterName: string;
  readonly declaredFrameCount: number;
  readonly observedFrameCount: number;
  readonly tagCount: number;
  readonly timeline: DumpTimeline;
}

export interface DumpCharacter {
  readonly id: number;
  readonly tag: string;
  readonly tagCode: number | null;
  readonly tagOffset: number | null;
  readonly length: number | null;
  readonly sprite: DumpSprite | null;
}

export interface DumpInitAction {
  readonly spriteId: number;
  readonly tagOffset: number;
  readonly offset: number;
  readonly length: number;
}

export interface DumpControl {
  readonly background: number;
  readonly backgroundSource: 'default' | 'tag';
  readonly backgroundChanges: readonly { readonly frame: number; readonly rgb: number }[];
  readonly scenes: readonly { readonly name: string; readonly frameOffset: number }[];
  readonly sceneFrameRemap: readonly {
    readonly sceneIndex: number;
    readonly frameOffset: number;
    readonly frameCount: number;
  }[];
  readonly labels: readonly DumpLabel[];
  readonly exports: readonly { readonly name: string; readonly id: number }[];
  readonly rootClassName: string | null;
  readonly imports: readonly {
    readonly url: string;
    readonly name: string;
    readonly localId: number;
    readonly applied: boolean;
  }[];
  readonly scalingGrids: readonly { readonly id: number; readonly rect: DumpRect }[];
  /** Rects shadowed by repeated `DefineScalingGrid` tags (last wins; reported, IMPL-040-R028). */
  readonly scalingGridsShadowed: readonly { readonly id: number; readonly rect: DumpRect }[];
  readonly tabIndexOps: readonly DumpTabIndex[];
  readonly scriptLimits: {
    readonly maxRecursionDepth: number | null;
    readonly scriptTimeout: number | null;
  };
  readonly attributes: {
    readonly raw: number;
    readonly bitLength: number;
    readonly useNetwork: boolean;
    readonly as3: boolean;
    readonly hasMetadata: boolean;
    readonly useGPU: boolean;
    readonly useDirectBlit: boolean;
    readonly origin: DumpTagRef;
  } | null;
  readonly metadata: readonly { readonly key: string; readonly value: string }[];
  /** `Protect` (24): present/absent + digest only — the password is never serialized. */
  readonly protect: {
    readonly present: boolean;
    readonly passwordPresent: boolean;
    readonly digest: string | null;
  } | null;
  /** `EnableDebugger`(58)/`EnableDebugger2`(64): recorded, inert. */
  readonly debugger: {
    readonly version: 1 | 2;
    readonly reserved: number | null;
    readonly passwordPresent: boolean;
    readonly digest: string | null;
  } | null;
  /** `EnableTelemetry` (93): opt-in present; hash redacted to a digest. */
  readonly telemetry: {
    readonly reserved: number;
    readonly hashPresent: boolean;
    readonly digest: string | null;
  } | null;
  /**
   * `DefineBinaryData` (87) assets: size + digest, never the bytes (the payload stays in the
   * model's `Uint8Array`, SEC-R003). `bytesPresent` makes the registered `binary` asset (R038)
   * visible in the JSON dump without serialising the payload.
   */
  readonly binaryData: readonly {
    readonly characterId: number;
    readonly reserved: number;
    readonly length: number;
    readonly digest: string;
    readonly bytesPresent: boolean;
  }[];
}

export interface DumpDiagnostics {
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
    readonly context: string | null;
    readonly characterId: number | null;
    readonly tagCode: number | null;
  }[];
}

export interface DumpSource {
  readonly bytes: number;
  readonly sha256: string;
  readonly compression: 'none' | 'zlib' | 'lzma';
  readonly version: number;
  readonly fileLength: number;
  readonly frameRate: number;
  readonly stage: {
    readonly widthTwips: number;
    readonly heightTwips: number;
    readonly widthPx: number;
    readonly heightPx: number;
  };
}

export interface ModelDump {
  readonly format: typeof DUMP_FORMAT;
  readonly formatVersion: number;
  readonly source: DumpSource;
  readonly model: {
    readonly id: string;
    readonly background: number;
    readonly backgroundSource: 'default' | 'tag';
    readonly metadata: readonly { readonly key: string; readonly value: string }[];
  };
  readonly dictionary: readonly DumpCharacter[];
  readonly timeline: DumpTimeline;
  readonly initActions: readonly DumpInitAction[];
  readonly control: DumpControl;
  readonly diagnostics: DumpDiagnostics;
}

function tagRef(ref: TagRef): DumpTagRef {
  return {
    code: ref.code,
    offset: ref.offset,
    length: ref.length,
    depth: ref.depth,
    inSprite: ref.inSprite,
    index: ref.index,
    headerOffset: ref.headerOffset,
  };
}

function rect(value: Rect): DumpRect {
  return { xMin: value.xMin, xMax: value.xMax, yMin: value.yMin, yMax: value.yMax };
}

function matrix(value: Mat2D): DumpMatrix {
  return { a: value.a, b: value.b, c: value.c, d: value.d, tx: value.tx, ty: value.ty };
}

function cxform(value: Cxform): DumpCxform {
  return {
    rm: value.rm,
    gm: value.gm,
    bm: value.bm,
    am: value.am,
    ra: value.ra,
    ga: value.ga,
    ba: value.ba,
    aa: value.aa,
  };
}

function rgba(value: Rgba): DumpRgba {
  return { r: value.r, g: value.g, b: value.b, a: value.a };
}

function action(value: ActionBlockRef | null): DumpAction | null {
  return value === null ? null : { offset: value.offset, length: value.length };
}

function filterDump(value: FilterSpec): DumpFilter {
  return value.kind === 'unknown' ? { ...value, raw: Array.from(value.raw) } : value;
}

function opDump(op: DisplayOp): DumpOp {
  if (op.kind === 'place') {
    const place: PlacementOp = op;
    return {
      kind: 'place',
      tag: place.tag,
      index: place.index,
      depth: place.depth,
      move: place.move,
      characterId: place.characterId,
      name: place.name,
      matrix: place.matrix === null ? null : matrix(place.matrix),
      cxform: place.cxform === null ? null : cxform(place.cxform),
      ratio: place.ratio,
      clipDepth: place.clipDepth,
      className: place.className,
      image: place.image,
      filters: place.filters === null ? null : place.filters.map(filterDump),
      blendMode: place.blendMode,
      cacheAsBitmap: place.cacheAsBitmap,
      rawCacheValue: place.rawCacheValue,
      visible: place.visible,
      opaqueBackground: place.opaqueBackground === null ? null : rgba(place.opaqueBackground),
      clipActions: action(place.clipActions),
      tagOffset: place.tagOffset,
    };
  }
  if (op.kind === 'remove') {
    return {
      kind: 'remove',
      tag: op.tag,
      index: op.index,
      depth: op.depth,
      characterId: op.characterId,
      tagOffset: op.tagOffset,
    };
  }
  return { kind: 'tabIndex', index: op.index, depth: op.depth, tabIndex: op.tabIndex, tagOffset: op.tagOffset };
}

/**
 * One timeline. `anchors` (the main timeline's label map) supplies `namedAnchor`; sprite timelines have
 * no control block, so their labels report `namedAnchor: false`.
 */
function timelineDump(
  timeline: TimelineModel,
  anchors?: ReadonlyMap<string, readonly { readonly frame: number; readonly namedAnchor: boolean }[]>,
): DumpTimeline {
  const labels: DumpLabel[] = [...timeline.labels.entries()]
    .map(([name, frame]) => ({
      name,
      frame,
      namedAnchor: anchors?.get(name)?.some((entry) => entry.frame === frame && entry.namedAnchor) ?? false,
    }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.frame - b.frame));

  return {
    declaredFrameCount: timeline.declaredFrameCount,
    observedFrameCount: timeline.observedFrameCount,
    frames: timeline.frames.map((frame) => ({
      index: frame.index,
      label: frame.label,
      ops: frame.ops.map(opDump),
      actions: frame.actions.map((block) => ({ offset: block.offset, length: block.length })),
      soundStreamBlock:
        frame.soundStreamBlock === null
          ? null
          : { offset: frame.soundStreamBlock.offset, length: frame.soundStreamBlock.length },
      videoFrames: frame.videoFrames.map(tagRef),
    })),
    labels,
    streamSoundSpans: timeline.streamSoundSpans.map((span) => ({
      head: tagRef(span.headTag),
      blocks: span.blockTags.map(tagRef),
    })),
    implicitScene: timeline.implicitScene,
  };
}

function metadataEntries(metadata: Readonly<Record<string, string>>): { key: string; value: string }[] {
  return Object.keys(metadata)
    .sort()
    .map((key) => ({ key, value: metadata[key] ?? '' }));
}

function diagnosticsDump(diagnostics: readonly Diagnostic[]): DumpDiagnostics {
  const items = diagnostics.map((d) => ({
    code: String(d.code),
    severity: d.severity,
    offset: d.offset,
    count: d.count,
    message: d.message,
    context: d.context ?? null,
    characterId: d.characterId ?? null,
    tagCode: d.tagCode ?? null,
  }));
  return {
    total: items.length,
    errors: items.filter((d) => d.severity === 'error').length,
    warnings: items.filter((d) => d.severity === 'warning').length,
    infos: items.filter((d) => d.severity === 'info').length,
    items,
  };
}

/** The whole dump, in the field order `IMPL-040-R045` fixes. */
export function buildModelDump(file: SwfFile, model: MovieModel, sha256: string): ModelDump {
  const attributes = model.control.attributes;
  const control: DumpControl = {
    background: model.control.background,
    backgroundSource: model.control.backgroundSource,
    backgroundChanges: model.control.backgroundChanges.map((change) => ({
      frame: change.frame,
      rgb: change.rgb,
    })),
    scenes: model.control.scenes.map((scene) => ({ name: scene.name, frameOffset: scene.frameOffset })),
    sceneFrameRemap: model.control.sceneFrameRemap.map((entry) => ({ ...entry })),
    labels: model.control.labelEntries.map((entry) => ({
      name: entry.name,
      frame: entry.frame,
      namedAnchor: entry.namedAnchor,
    })),
    exports: [...model.control.exports.entries()]
      .map(([name, id]) => ({ name, id }))
      .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : a.id - b.id)),
    rootClassName: model.control.rootClassName,
    imports: model.control.imports.map((entry) => ({
      url: entry.url,
      name: entry.name,
      localId: entry.localId,
      applied: entry.applied,
    })),
    scalingGrids: [...model.control.scalingGrids.entries()]
      .map(([id, value]) => ({ id, rect: rect(value) }))
      .sort((a, b) => a.id - b.id),
    scalingGridsShadowed: model.control.scalingGridsShadowed.map((entry) => ({
      id: entry.characterId,
      rect: rect(entry.rect),
    })),
    tabIndexOps: model.control.tabIndexOps.map((op) => ({
      kind: 'tabIndex' as const,
      index: op.index,
      depth: op.depth,
      tabIndex: op.tabIndex,
      tagOffset: op.tagOffset,
    })),
    scriptLimits: {
      maxRecursionDepth: model.control.scriptLimits.maxRecursionDepth,
      scriptTimeout: model.control.scriptLimits.scriptTimeout,
    },
    attributes:
      attributes === null
        ? null
        : {
            raw: attributes.raw,
            bitLength: attributes.bitLength,
            useNetwork: attributes.useNetwork,
            as3: attributes.as3,
            hasMetadata: attributes.hasMetadata,
            useGPU: attributes.useGPU,
            useDirectBlit: attributes.useDirectBlit,
            origin: tagRef(attributes.origin),
          },
    metadata: metadataEntries(model.control.metadata),
    protect: model.control.protect,
    debugger: model.control.debugger,
    telemetry: model.control.telemetry,
    binaryData: model.control.binaryData.map((entry) => ({
      characterId: entry.characterId,
      reserved: entry.reserved,
      length: entry.length,
      digest: entry.digest,
      // The payload is registered on the character model as a `Uint8Array` (R038); the JSON dump
      // carries size + digest + presence, never the bytes.
      bytesPresent: model.characters.get(entry.characterId)?.bytes !== null,
    })),
  };

  const dictionary: DumpCharacter[] = [...model.characters.values()]
    .sort((a, b) => a.id - b.id)
    .map((character) => ({
      id: character.id,
      tag: character.tagName,
      tagCode: character.index?.code ?? null,
      tagOffset: character.index?.headerOffset ?? null,
      length: character.index?.length ?? null,
      sprite:
        character.sprite === null
          ? null
          : {
              characterName: character.sprite.characterName,
              declaredFrameCount: character.sprite.declaredFrameCount,
              observedFrameCount: character.sprite.timeline.observedFrameCount,
              tagCount: character.sprite.tags.length,
              timeline: timelineDump(character.sprite.timeline),
            },
    }));

  return {
    format: DUMP_FORMAT,
    formatVersion: DUMP_FORMAT_VERSION,
    source: {
      bytes: file.sizes.file,
      sha256,
      compression: file.header.compression,
      version: file.header.version,
      fileLength: file.header.fileLength,
      frameRate: file.header.frameRate,
      stage: {
        widthTwips: model.stage.widthTwips,
        heightTwips: model.stage.heightTwips,
        widthPx: file.header.frameSizePx.width,
        heightPx: file.header.frameSizePx.height,
      },
    },
    model: {
      id: model.id,
      background: model.background,
      backgroundSource: model.control.backgroundSource,
      metadata: metadataEntries(model.metadata),
    },
    dictionary,
    timeline: timelineDump(model.mainTimeline, model.control.labels),
    initActions: model.initActions.map((entry) => ({
      spriteId: entry.spriteId,
      tagOffset: entry.index.headerOffset,
      offset: entry.block.offset,
      length: entry.block.length,
    })),
    control,
    diagnostics: diagnosticsDump(file.diagnostics),
  };
}

/** The dump as it is written: 2-space indent, LF, one trailing newline (`IMPL-040-R048`). */
export function dumpJson(dump: ModelDump): string {
  return `${JSON.stringify(dump, null, 2)}\n`;
}

function hex(value: number): string {
  return `#${(value & 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`;
}

function describeOp(op: DumpOp, nameOf: (id: number) => string): string {
  if (op.kind === 'remove') return `remove depth ${op.depth} (${op.tag})`;
  if (op.kind === 'tabIndex') return `tabIndex ${op.tabIndex} at depth ${op.depth}`;
  const target = op.characterId === null ? 'move' : `#${op.characterId} ${nameOf(op.characterId)}`;
  const parts = [`place ${target} at depth ${op.depth}`];
  if (op.name !== null) parts.push(`name "${op.name}"`);
  if (op.matrix !== null) {
    const m = op.matrix;
    parts.push(`matrix(${m.a}, ${m.b}, ${m.c}, ${m.d}, ${m.tx}, ${m.ty})`);
  }
  if (op.cxform !== null) parts.push('cxform');
  if (op.ratio !== null) parts.push(`ratio ${op.ratio}`);
  if (op.clipDepth !== null) parts.push(`clipDepth ${op.clipDepth}`);
  if (op.className !== null) parts.push(`class ${op.className}`);
  if (op.blendMode !== null) parts.push(`blend ${op.blendMode}`);
  if (op.visible === false) parts.push('hidden');
  if (op.clipActions !== null) parts.push(`clipActions @${op.clipActions.offset} ${op.clipActions.length} B`);
  return parts.join(', ');
}

/** Human summary — the same data, rendered for a terminal (`IMPL-040-R044`). */
export function renderDump(dump: ModelDump, input: string, verbose: boolean): string[] {
  const lines: string[] = [];
  const { source: s } = dump;
  const signature = s.compression === 'none' ? 'FWS' : s.compression === 'zlib' ? 'CWS' : 'ZWS';
  const nameOf = (id: number): string => dump.dictionary.find((character) => character.id === id)?.tag ?? 'unknown';

  lines.push(
    `${input} — ${signature}, version ${s.version}, ${s.stage.widthPx} x ${s.stage.heightPx} px, ${s.frameRate} fps`,
  );
  lines.push(`  id            ${dump.model.id}`);
  lines.push(`  bytes         ${s.bytes} (declared ${s.fileLength}), sha256 ${s.sha256.slice(0, 16)}`);
  lines.push(
    `  background    ${hex(dump.model.background)} (${dump.model.backgroundSource})${dump.control.backgroundChanges.length > 0 ? `, ${dump.control.backgroundChanges.length} change(s)` : ''}`,
  );
  lines.push(`  dictionary    ${dump.dictionary.length} character(s)`);
  for (const character of dump.dictionary) {
    const sprite = character.sprite;
    lines.push(
      `    #${character.id}  ${character.tag}  @${character.tagOffset} ${character.length} B${sprite === null ? '' : `  ${sprite.characterName} frames=${sprite.declaredFrameCount}/${sprite.observedFrameCount} tags=${sprite.tagCount}`}`,
    );
    if (sprite !== null && verbose) {
      for (const frame of sprite.timeline.frames) {
        lines.push(
          `        frame ${frame.index}${frame.label === null ? '' : ` "${frame.label}"`}: ${frame.ops.length} op(s)`,
        );
      }
    }
  }

  const timeline = dump.timeline;
  lines.push(
    `  timeline      ${timeline.frames.length} frame(s), declared ${timeline.declaredFrameCount ?? '?'}, ${timeline.labels.length} label(s), ${timeline.streamSoundSpans.length} stream span(s)`,
  );
  for (const frame of timeline.frames) {
    const head = `    frame ${frame.index}${frame.label === null ? '' : ` "${frame.label}"`}`;
    if (frame.ops.length === 0 && frame.actions.length === 0 && frame.videoFrames.length === 0) {
      lines.push(`${head}: empty`);
      continue;
    }
    lines.push(head);
    for (const op of frame.ops) lines.push(`      ${describeOp(op, nameOf)}  @${op.tagOffset}`);
    for (const block of frame.actions) lines.push(`      action @${block.offset} ${block.length} B`);
    if (frame.soundStreamBlock !== null) {
      lines.push(`      sound stream @${frame.soundStreamBlock.offset} ${frame.soundStreamBlock.length} B`);
    }
    for (const video of frame.videoFrames) lines.push(`      video frame tag @${video.headerOffset}`);
  }

  const control = dump.control;
  lines.push(
    `  control       scenes ${control.scenes.length}, exports ${control.exports.length}, imports ${control.imports.length}, metadata ${control.metadata.length}, tabIndex ${control.tabIndexOps.length}, scaling grids ${control.scalingGrids.length}`,
  );
  for (const scene of control.scenes) lines.push(`    scene "${scene.name}" at frame ${scene.frameOffset}`);
  for (const label of control.labels) {
    lines.push(`    label "${label.name}" at frame ${label.frame}${label.namedAnchor ? ' (named anchor)' : ''}`);
  }
  for (const entry of control.exports) lines.push(`    export "${entry.name}" -> #${entry.id}`);
  if (control.rootClassName !== null) lines.push(`    root class ${control.rootClassName}`);
  if (control.attributes !== null) {
    const a = control.attributes;
    lines.push(
      `    attributes    0x${a.raw.toString(16).padStart(8, '0')} (${a.bitLength} bit) as3=${a.as3} metadata=${a.hasMetadata} network=${a.useNetwork}`,
    );
  }
  if (dump.initActions.length > 0) lines.push(`  initActions   ${dump.initActions.length}`);

  const diagnostics = dump.diagnostics;
  lines.push(
    `  diagnostics   ${diagnostics.total} (${diagnostics.errors} error(s), ${diagnostics.warnings} warning(s), ${diagnostics.infos} info)`,
  );
  for (const item of diagnostics.items) {
    if (!verbose && item.severity === 'info') continue;
    lines.push(
      `    ${item.code}  ${item.severity.padEnd(7)} @${item.offset}${item.count > 1 ? ` x${item.count}` : ''}  ${item.message}`,
    );
  }
  return lines;
}
