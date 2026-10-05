/**
 * Tag codes — the subset of Appendix B this package understands, with the two facts the indexer
 * needs: is it a *definition* tag (it introduces a character id) and is it valid inside a sprite.
 *
 * The table is deliberately small; `APP-§2` (docs/specs/reference/110-appendices-reference-tables.md)
 * is the full index and the authority. Codes absent here take the unknown-tag path (`SF0104`).
 */

export interface TagInfo {
  readonly code: number;
  readonly name: string;
  /** SWF version that introduced the tag (Appendix B's first column). */
  readonly since: number;
  /** True when the tag body starts with a UI16 character id. */
  readonly definition: boolean;
  /** True when the tag is valid inside a DefineSprite timeline (Ch.13's closed set). */
  readonly inSprite: boolean;
}

export const Tag = {
  End: 0,
  ShowFrame: 1,
  DefineShape: 2,
  PlaceObject: 4,
  RemoveObject: 5,
  DefineBits: 6,
  DefineButton: 7,
  JPEGTables: 8,
  SetBackgroundColor: 9,
  DefineFont: 10,
  DefineText: 11,
  DoAction: 12,
  DefineFontInfo: 13,
  DefineSound: 14,
  StartSound: 15,
  DefineButtonSound: 17,
  SoundStreamHead: 18,
  SoundStreamBlock: 19,
  DefineBitsLossless: 20,
  DefineBitsJPEG2: 21,
  DefineShape2: 22,
  DefineButtonCxform: 23,
  Protect: 24,
  PlaceObject2: 26,
  RemoveObject2: 28,
  DefineShape3: 32,
  DefineText2: 33,
  DefineButton2: 34,
  DefineBitsJPEG3: 35,
  DefineBitsLossless2: 36,
  DefineEditText: 37,
  DefineSprite: 39,
  FrameLabel: 43,
  SoundStreamHead2: 45,
  DefineMorphShape: 46,
  DefineFont2: 48,
  ExportAssets: 56,
  ImportAssets: 57,
  EnableDebugger: 58,
  DoInitAction: 59,
  DefineVideoStream: 60,
  VideoFrame: 61,
  DefineFontInfo2: 62,
  EnableDebugger2: 64,
  ScriptLimits: 65,
  DoABC: 82,
  SetTabIndex: 66,
  FileAttributes: 69,
  PlaceObject3: 70,
  ImportAssets2: 71,
  DefineFontAlignZones: 73,
  CSMTextSettings: 74,
  DefineFont3: 75,
  SymbolClass: 76,
  Metadata: 77,
  DefineScalingGrid: 78,
  DefineShape4: 83,
  DefineMorphShape2: 84,
  DefineSceneAndFrameLabelData: 86,
  DefineBinaryData: 87,
  DefineFontName: 88,
  StartSound2: 89,
  DefineBitsJPEG4: 90,
  DefineFont4: 91,
  EnableTelemetry: 93,
} as const;

/** Tags valid on a sprite timeline (Ch.13's closed list, plus what our indexer tolerates). */
const IN_SPRITE = new Set<number>([
  Tag.ShowFrame,
  Tag.PlaceObject,
  Tag.RemoveObject,
  Tag.PlaceObject2,
  Tag.RemoveObject2,
  Tag.PlaceObject3,
  Tag.DoAction,
  Tag.StartSound,
  Tag.FrameLabel,
  Tag.SoundStreamHead,
  Tag.SoundStreamHead2,
  Tag.SoundStreamBlock,
  Tag.End,
]);

/** Definition tags whose body begins with a UI16 character id. */
const DEFINITIONS = new Set<number>([
  Tag.DefineShape,
  Tag.DefineBits,
  Tag.DefineButton,
  Tag.DefineFont,
  Tag.DefineText,
  Tag.DefineSound,
  Tag.DefineBitsLossless,
  Tag.DefineBitsJPEG2,
  Tag.DefineShape2,
  Tag.DefineText2,
  Tag.DefineButton2,
  Tag.DefineBitsJPEG3,
  Tag.DefineBitsLossless2,
  Tag.DefineEditText,
  Tag.DefineSprite,
  Tag.DefineMorphShape,
  Tag.DefineFont2,
  Tag.DefineVideoStream,
  Tag.DefineFontInfo2,
  Tag.DefineFontAlignZones,
  Tag.DefineFont3,
  Tag.DefineShape4,
  Tag.DefineMorphShape2,
  Tag.DefineBinaryData,
  Tag.DefineFontName,
  Tag.DefineBitsJPEG4,
  Tag.DefineFont4,
]);

const SINCE: Readonly<Record<number, number>> = {
  [Tag.End]: 1,
  [Tag.ShowFrame]: 1,
  [Tag.DefineShape]: 1,
  [Tag.PlaceObject]: 1,
  [Tag.RemoveObject]: 1,
  [Tag.DefineBits]: 1,
  [Tag.DefineButton]: 1,
  [Tag.JPEGTables]: 1,
  [Tag.SetBackgroundColor]: 1,
  [Tag.DefineFont]: 1,
  [Tag.DefineText]: 1,
  [Tag.DoAction]: 3,
  [Tag.DefineFontInfo]: 1,
  [Tag.DefineSound]: 1,
  [Tag.StartSound]: 1,
  [Tag.DefineButtonSound]: 1,
  [Tag.SoundStreamHead]: 1,
  [Tag.SoundStreamBlock]: 1,
  [Tag.DefineBitsLossless]: 2,
  [Tag.DefineBitsJPEG2]: 2,
  [Tag.DefineShape2]: 2,
  [Tag.DefineButtonCxform]: 2,
  [Tag.Protect]: 2,
  [Tag.PlaceObject2]: 3,
  [Tag.RemoveObject2]: 3,
  [Tag.DefineShape3]: 3,
  [Tag.DefineText2]: 3,
  [Tag.DefineButton2]: 3,
  [Tag.DefineBitsJPEG3]: 3,
  [Tag.DefineBitsLossless2]: 3,
  [Tag.DefineEditText]: 4,
  [Tag.DefineSprite]: 3,
  [Tag.FrameLabel]: 3,
  [Tag.SoundStreamHead2]: 3,
  [Tag.DefineMorphShape]: 3,
  [Tag.DefineFont2]: 3,
  [Tag.ExportAssets]: 5,
  [Tag.ImportAssets]: 5,
  [Tag.EnableDebugger]: 5,
  [Tag.DoInitAction]: 6,
  [Tag.DefineVideoStream]: 6,
  [Tag.VideoFrame]: 6,
  [Tag.DefineFontInfo2]: 6,
  [Tag.EnableDebugger2]: 6,
  [Tag.ScriptLimits]: 7,
  [Tag.SetTabIndex]: 7,
  [Tag.FileAttributes]: 8,
  [Tag.PlaceObject3]: 8,
  [Tag.ImportAssets2]: 8,
  [Tag.DefineFontAlignZones]: 8,
  [Tag.CSMTextSettings]: 8,
  [Tag.DefineFont3]: 8,
  [Tag.SymbolClass]: 9,
  [Tag.Metadata]: 9,
  [Tag.DefineScalingGrid]: 9,
  [Tag.DefineShape4]: 8,
  [Tag.DefineMorphShape2]: 8,
  [Tag.DoABC]: 9,
  [Tag.DefineSceneAndFrameLabelData]: 9,
  [Tag.DefineBinaryData]: 9,
  [Tag.DefineFontName]: 9,
  [Tag.StartSound2]: 9,
  [Tag.DefineBitsJPEG4]: 10,
  [Tag.DefineFont4]: 10,
  [Tag.EnableTelemetry]: 9,
};

const NAMES = new Map<number, string>();
for (const [name, code] of Object.entries(Tag)) {
  if (!NAMES.has(code)) NAMES.set(code, name);
}

export function tagInfo(code: number): TagInfo | undefined {
  const name = NAMES.get(code);
  if (name === undefined) return undefined;
  return {
    code,
    name,
    since: SINCE[code] ?? 1,
    definition: DEFINITIONS.has(code),
    inSprite: IN_SPRITE.has(code),
  };
}

export function isKnownTag(code: number): boolean {
  return NAMES.has(code);
}

export function tagName(code: number): string {
  return NAMES.get(code) ?? `Unknown(${code})`;
}
