/**
 * The model dump — `IMPL-040` §3.6 (`forge-decompile dump`).
 *
 * One pure function from `(file, model)` to a plain JSON-able value. Every map is emitted as an array
 * sorted by key, sequences that exist in file order keep it, and nothing carries a timestamp or a path
 * (`IMPL-040-R045`/`R046`), so a re-run over the same bytes is byte-identical (`REPO-R015`). The human
 * summary is a view over the same object: one serializer, two renderings, no second source of truth.
 */

import { createHash } from 'node:crypto';

import type {
  ActionBlockRef,
  BitmapAssetModel,
  ButtonModel,
  ButtonConditions,
  ButtonState,
  CharacterAlias,
  ClipActions,
  ClipEventFlags,
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
  VectorShape,
  DefineSoundModel,
  DefineFontModel,
  StaticTextModel,
  EditTextModel,
  TimelineSoundEvent,
} from '@swf-forge/swf';

export const DUMP_FORMAT = 'swf-forge/model-dump';
export const DUMP_FORMAT_VERSION = 4;

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

export interface DumpClipActionRecord {
  readonly events: ClipEventFlags;
  readonly keyCode: number | null;
  readonly actions: DumpAction;
  readonly sizeBytes: number;
}

export interface DumpClipActions {
  readonly reserved: number;
  readonly allEvents: ClipEventFlags;
  readonly records: readonly DumpClipActionRecord[];
  readonly endFlagWidth: 2 | 4;
  readonly endFlag: number | null;
  readonly raw: DumpAction;
}

export interface DumpButtonRecord {
  readonly states: readonly ButtonState[];
  readonly depth: number;
  readonly characterId: number;
  readonly matrix: DumpMatrix;
  readonly cxform: DumpCxform | null;
  readonly blendMode: number | null;
  readonly filters: readonly DumpFilter[] | null;
  readonly rawFlags: number;
  readonly tagOffset: number;
}

export interface DumpButtonAction {
  readonly conditions: ButtonConditions;
  readonly rawConditionWord: number;
  readonly keyCode: number | null;
  readonly actions: DumpAction;
  readonly tagOffset: number;
  readonly origin: DumpTagRef;
}

export interface DumpButtonSound {
  readonly transition: 'overUpToIdle' | 'idleToOverUp' | 'overUpToOverDown' | 'overDownToOverUp';
  readonly soundId: number;
  readonly info: {
    readonly rawFlags: number;
    readonly reserved: number;
    readonly syncStop: boolean;
    readonly syncNoMultiple: boolean;
    readonly inPoint: number | null;
    readonly outPoint: number | null;
    readonly loopCount: number | null;
    readonly envelope: readonly {
      readonly position44: number;
      readonly leftLevel: number;
      readonly rightLevel: number;
    }[];
  } | null;
}

export interface DumpButton {
  readonly id: number;
  readonly version: 1 | 2;
  readonly trackAsMenu: boolean;
  readonly records: readonly DumpButtonRecord[];
  readonly characterCxform: DumpCxform | null;
  readonly actions: readonly DumpButtonAction[];
  readonly sounds: readonly DumpButtonSound[];
  readonly hitArea: DumpRect | null;
  readonly hitAreaSource: 'hitTest' | 'up' | null;
  readonly keyPressRequiresFocus: false;
  readonly origin: DumpTagRef;
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
  readonly clipActions: DumpClipActions | null;
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

export interface DumpSoundEvent {
  readonly tagOffset: number;
  readonly soundId: number | null;
  readonly className: string | null;
  readonly info: {
    readonly reserved: number;
    readonly syncStop: boolean;
    readonly syncNoMultiple: boolean;
    readonly inPoint: number | null;
    readonly outPoint: number | null;
    readonly loopCount: number | null;
    readonly envelope: readonly {
      readonly position44: number;
      readonly leftLevel: number;
      readonly rightLevel: number;
    }[];
  };
}

export interface DumpFrame {
  readonly index: number;
  readonly label: string | null;
  readonly ops: readonly DumpOp[];
  readonly actions: readonly DumpAction[];
  readonly soundStreamBlock: { readonly offset: number; readonly length: number } | null;
  readonly soundEvents: readonly DumpSoundEvent[];
  readonly videoFrames: readonly DumpTagRef[];
}

export interface DumpStreamSoundBlock {
  readonly tag: DumpTagRef;
  readonly sampleOffset: number;
  readonly sampleCount: number;
  readonly seekSamples: number | null;
  readonly dataOffset: number;
  readonly dataLength: number;
}

export interface DumpStreamSoundSpan {
  readonly head: DumpTagRef;
  readonly format: number;
  readonly sampleRate: number;
  readonly channels: number;
  readonly latencySeek: number | null;
  readonly sampleCount: number;
  readonly blocks: readonly DumpStreamSoundBlock[];
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
  readonly kind: string;
  readonly tag: string;
  readonly tagCode: number | null;
  readonly tagOffset: number | null;
  readonly length: number | null;
  readonly bounds: DumpRect | null;
  /** Stable shape IR summary; full geometry stays available through buildMovieModel, not JSON. */
  readonly vectorShape: {
    readonly version: number;
    readonly bounds: DumpRect;
    readonly fillRule: 'evenOdd' | 'nonZero';
    readonly edgeCount: number;
    readonly fillPathCount: number;
    readonly strokePathCount: number;
    readonly fillStyleCount: number;
    readonly lineStyleCount: number;
    readonly geometrySha256: string;
  } | null;
  /** Bitmap header + compressed payload digest; image bytes remain outside JSON. */
  readonly bitmap: {
    readonly source: string;
    readonly payloadBytes: number;
    readonly payloadSha256: string;
    readonly alphaBytes: number;
    readonly alphaSha256: string | null;
    readonly declaredSize: { readonly width: number; readonly height: number } | null;
    readonly bitmapFormat: number | null;
    readonly paletteSize: number | null;
    readonly alphaDataOffset: number | null;
    readonly deblocking: number | null;
    readonly sourcePremultiplied: boolean;
  } | null;
  /** Embedded font metadata and stable table digests; outline geometry stays in the typed model. */
  readonly font: {
    readonly version: number;
    readonly name: string;
    readonly languageCode: number;
    readonly unitsPerEm: number;
    readonly italic: boolean;
    readonly bold: boolean;
    readonly glyphCount: number;
    readonly ascent: number | null;
    readonly descent: number | null;
    readonly leading: number | null;
    readonly codeTableSha256: string;
  } | null;
  /** Static glyph runs retain authored advances; each glyph has a compact index/advance pair. */
  readonly text: {
    readonly version: number;
    readonly bounds: DumpRect;
    readonly matrix: DumpMatrix;
    readonly glyphBits: number;
    readonly advanceBits: number;
    readonly runs: readonly {
      readonly fontId: number | null;
      readonly color: DumpRgba | null;
      readonly xOffset: number;
      readonly yOffset: number;
      readonly textHeight: number | null;
      readonly glyphs: readonly { readonly glyphIndex: number; readonly advance: number }[];
      readonly recoveredText: string | null;
    }[];
  } | null;
  /** Editable text fields preserve all authored flags/fields; runtime behavior is not applied. */
  readonly editText: {
    readonly bounds: DumpRect;
    readonly flags: EditTextModel['flags'];
    readonly fontId: number | null;
    readonly fontClass: string | null;
    readonly fontHeight: number | null;
    readonly color: DumpRgba | null;
    readonly maxLength: number | null;
    readonly layout: EditTextModel['layout'];
    readonly variableName: string;
    readonly initialText: string | null;
  } | null;
  /** Sound header + compressed payload summary; media bytes remain outside JSON. */
  readonly sound: {
    readonly format: number;
    readonly rateCode: number;
    readonly sampleRate: number;
    readonly bitsPerSample: number;
    readonly channels: number;
    readonly sampleCount: number;
    readonly dataBytes: number;
    readonly dataSha256: string;
  } | null;
  readonly alias: CharacterAlias | null;
  readonly button: DumpButton | null;
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
    readonly sourceMovieId: string | null;
    readonly sourceId: number | null;
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

function vectorShapeSummary(shape: VectorShape | null): DumpCharacter['vectorShape'] {
  if (shape === null) return null;
  const canonical = JSON.stringify(shape);
  return {
    version: shape.version,
    bounds: rect(shape.bounds),
    fillRule: shape.fillRule,
    edgeCount: shape.edges.length,
    fillPathCount: shape.paths.length,
    strokePathCount: shape.strokes.length,
    fillStyleCount: Math.max(0, shape.styles.fills.length - 1),
    lineStyleCount: Math.max(0, shape.styles.lines.length - 1),
    geometrySha256: createHash('sha256').update(canonical, 'utf8').digest('hex'),
  };
}

function bitmapSummary(bitmap: BitmapAssetModel | null): DumpCharacter['bitmap'] {
  if (bitmap === null) return null;
  return {
    source: bitmap.source,
    payloadBytes: bitmap.payload.length,
    payloadSha256: createHash('sha256').update(bitmap.payload).digest('hex'),
    alphaBytes: bitmap.alpha?.length ?? 0,
    alphaSha256: bitmap.alpha === null ? null : createHash('sha256').update(bitmap.alpha).digest('hex'),
    declaredSize: bitmap.declaredSize,
    bitmapFormat: bitmap.bitmapFormatCode,
    paletteSize: bitmap.paletteSize,
    alphaDataOffset: bitmap.alphaDataOffset,
    deblocking: bitmap.deblocking,
    sourcePremultiplied: bitmap.sourcePremultiplied,
  };
}

function fontSummary(font: DefineFontModel | null): DumpCharacter['font'] {
  if (font === null) return null;
  const codeTable = JSON.stringify(
    font.glyphs.map((glyph) => ({
      code: glyph.code,
      advance: glyph.advance,
      bounds: glyph.bounds,
    })),
  );
  return {
    version: font.version,
    name: font.name,
    languageCode: font.languageCode,
    unitsPerEm: font.unitsPerEm,
    italic: font.italic,
    bold: font.bold,
    glyphCount: font.glyphs.length,
    ascent: font.ascent,
    descent: font.descent,
    leading: font.leading,
    codeTableSha256: createHash('sha256').update(codeTable, 'utf8').digest('hex'),
  };
}

function staticTextSummary(text: StaticTextModel | null): DumpCharacter['text'] {
  if (text === null) return null;
  return {
    version: text.version,
    bounds: rect(text.bounds),
    matrix: matrix(text.matrix),
    glyphBits: text.glyphBits,
    advanceBits: text.advanceBits,
    runs: text.runs.map((run) => ({
      fontId: run.fontId,
      color: run.color === null ? null : rgba(run.color),
      xOffset: run.xOffset,
      yOffset: run.yOffset,
      textHeight: run.textHeight,
      glyphs: run.glyphs.map((glyph) => ({ glyphIndex: glyph.glyphIndex, advance: glyph.advance })),
      recoveredText: run.recoveredText,
    })),
  };
}

function editTextSummary(text: EditTextModel | null): DumpCharacter['editText'] {
  if (text === null) return null;
  return {
    bounds: rect(text.bounds),
    flags: text.flags,
    fontId: text.fontId,
    fontClass: text.fontClass,
    fontHeight: text.fontHeight,
    color: text.color === null ? null : rgba(text.color),
    maxLength: text.maxLength,
    layout: text.layout,
    variableName: text.variableName,
    initialText: text.initialText,
  };
}

function soundSummary(sound: DefineSoundModel | null): DumpCharacter['sound'] {
  if (sound === null) return null;
  return {
    format: sound.format,
    rateCode: sound.rateCode,
    sampleRate: sound.sampleRate,
    bitsPerSample: sound.bitsPerSample,
    channels: sound.channels,
    sampleCount: sound.sampleCount,
    dataBytes: sound.data.length,
    dataSha256: createHash('sha256').update(sound.data).digest('hex'),
  };
}

function action(value: ActionBlockRef | null): DumpAction | null {
  return value === null ? null : { offset: value.offset, length: value.length };
}

function clipActionsDump(value: ClipActions | null): DumpClipActions | null {
  if (value === null) return null;
  return {
    reserved: value.reserved,
    allEvents: value.allEvents,
    records: value.records.map((record) => ({
      events: record.events,
      keyCode: record.keyCode,
      actions: action(record.actions) ?? { offset: record.actions.offset, length: record.actions.length },
      sizeBytes: record.sizeBytes,
    })),
    endFlagWidth: value.endFlagWidth,
    endFlag: value.endFlag,
    raw: { offset: value.raw.offset, length: value.raw.length },
  };
}

function buttonDump(value: ButtonModel | null): DumpButton | null {
  if (value === null) return null;
  return {
    id: value.id,
    version: value.version,
    trackAsMenu: value.trackAsMenu,
    records: value.records.map((record) => ({
      states: record.states,
      depth: record.depth,
      characterId: record.characterId,
      matrix: matrix(record.matrix),
      cxform: record.cxform === null ? null : cxform(record.cxform),
      blendMode: record.blendMode,
      filters: record.filters === null ? null : record.filters.map(filterDump),
      rawFlags: record.rawFlags,
      tagOffset: record.tagOffset,
    })),
    characterCxform: value.characterCxform === null ? null : cxform(value.characterCxform),
    actions: value.actions.map((entry) => ({
      conditions: entry.conditions,
      rawConditionWord: entry.rawConditionWord,
      keyCode: entry.keyCode,
      actions: { offset: entry.actionBytes.offset, length: entry.actionBytes.length },
      tagOffset: entry.tagOffset,
      origin: tagRef(entry.origin),
    })),
    sounds: value.sounds.map((entry) => ({ ...entry })),
    hitArea: value.hitArea === null ? null : rect(value.hitArea),
    hitAreaSource: value.hitAreaSource,
    keyPressRequiresFocus: value.keyPressRequiresFocus,
    origin: tagRef(value.origin),
  };
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
      clipActions: clipActionsDump(place.clipActions),
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
function soundEventDump(event: TimelineSoundEvent): DumpSoundEvent {
  return {
    tagOffset: event.tagOffset,
    soundId: event.soundId,
    className: event.className,
    info: {
      reserved: event.info.reserved,
      syncStop: event.info.syncStop,
      syncNoMultiple: event.info.syncNoMultiple,
      inPoint: event.info.inPoint,
      outPoint: event.info.outPoint,
      loopCount: event.info.loopCount,
      envelope: event.info.envelope.map((point) => ({
        position44: point.position44,
        leftLevel: point.leftLevel,
        rightLevel: point.rightLevel,
      })),
    },
  };
}

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
      soundEvents: frame.soundEvents.map(soundEventDump),
      videoFrames: frame.videoFrames.map(tagRef),
    })),
    labels,
    streamSoundSpans: timeline.streamSoundSpans.map((span) => ({
      head: tagRef(span.headTag),
      format: span.head.format,
      sampleRate: span.head.sampleRate,
      channels: span.head.channels,
      latencySeek: span.head.latencySeek,
      sampleCount: span.sampleCount,
      blocks: span.blocks.map((block) => ({
        tag: tagRef(block.tag),
        sampleOffset: block.sampleOffset,
        sampleCount: block.sampleCount,
        seekSamples: block.seekSamples,
        dataOffset: block.dataOffset,
        dataLength: block.dataLength,
      })),
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
      sourceMovieId: entry.sourceMovieId,
      sourceId: entry.sourceId,
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
      kind: character.kind,
      tag: character.tagName,
      tagCode: character.index?.code ?? character.tagCode,
      tagOffset: character.index?.headerOffset ?? null,
      length: character.index?.length ?? null,
      bounds: character.bounds === null ? null : rect(character.bounds),
      vectorShape: vectorShapeSummary(character.vectorShape),
      bitmap: bitmapSummary(character.bitmap),
      font: fontSummary(character.font),
      text: staticTextSummary(character.text),
      editText: editTextSummary(character.editText),
      sound: soundSummary(character.sound),
      alias: character.alias,
      button: buttonDump(character.button),
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
  if (op.clipActions !== null) parts.push(`clipActions @${op.clipActions.raw.offset} ${op.clipActions.raw.length} B`);
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
    const alias = character.alias;
    lines.push(
      `    #${character.id}  ${character.tag}  @${character.tagOffset} ${character.length} B${sprite === null ? '' : `  ${sprite.characterName} frames=${sprite.declaredFrameCount}/${sprite.observedFrameCount} tags=${sprite.tagCount}`}${alias === null ? '' : `  alias=${alias.sourceMovieId}#${alias.sourceId}`}`,
    );
    if (character.button !== null) {
      const button = character.button;
      const hitArea =
        button.hitArea === null
          ? 'none'
          : `${button.hitArea.xMin},${button.hitArea.yMin}…${button.hitArea.xMax},${button.hitArea.yMax} (${button.hitAreaSource})`;
      lines.push(
        `        button v${button.version} ${button.trackAsMenu ? 'menu' : 'push'}: ${button.records.length} record(s), ${button.actions.length} handler(s), ${button.sounds.length} sound(s), hit=${hitArea}`,
      );
    }
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
