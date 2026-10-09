/** Static and editable text tag models (IMPL-080 P3 decode slice). */

import { Codes, type Code } from '../diagnostics/codes.js';
import type { Severity } from '../diagnostics/types.js';
import type { Cursor } from '../io/cursor.js';
import { readRect, readMatrix } from '../io/records.js';
import { readRgb, readRgba } from '../io/colour.js';
import type { Mat2D, Rect, Rgba } from '../io/types.js';
import type { DefineFontModel } from './fonts.js';
import { Tag } from './tag-codes.js';

export interface TextGlyphModel {
  readonly glyphIndex: number;
  readonly advance: number;
}

export interface StaticTextRunModel {
  /** Style values persist when a later TEXTRECORD omits their Has* bit. */
  readonly fontId: number | null;
  readonly color: Rgba | null;
  /** Per-record absolute offsets; omitted fields are zero, not accumulated. */
  readonly xOffset: number;
  readonly yOffset: number;
  readonly textHeight: number | null;
  readonly glyphs: readonly TextGlyphModel[];
  /** Populated only when every glyph has a unique one-to-one code mapping. */
  readonly recoveredText: string | null;
}

export interface StaticTextModel {
  readonly id: number;
  readonly version: 1 | 2;
  readonly tagCode: 11 | 33;
  readonly bounds: Rect;
  readonly matrix: Mat2D;
  readonly glyphBits: number;
  readonly advanceBits: number;
  readonly runs: readonly StaticTextRunModel[];
}

export interface EditTextFlags {
  readonly hasText: boolean;
  readonly wordWrap: boolean;
  readonly multiline: boolean;
  readonly password: boolean;
  readonly readOnly: boolean;
  readonly hasTextColor: boolean;
  readonly hasMaxLength: boolean;
  readonly hasFont: boolean;
  readonly hasFontClass: boolean;
  readonly autoSize: boolean;
  readonly hasLayout: boolean;
  readonly noSelect: boolean;
  readonly border: boolean;
  readonly wasStatic: boolean;
  readonly html: boolean;
  readonly useOutlines: boolean;
}

export interface EditTextLayoutModel {
  readonly align: number;
  readonly leftMargin: number;
  readonly rightMargin: number;
  readonly indent: number;
  readonly leading: number;
}

export interface EditTextModel {
  readonly id: number;
  readonly bounds: Rect;
  readonly flags: EditTextFlags;
  readonly fontId: number | null;
  readonly fontClass: string | null;
  readonly fontHeight: number | null;
  readonly color: Rgba | null;
  readonly maxLength: number | null;
  readonly layout: EditTextLayoutModel | null;
  /** Kept byte-for-byte semantically; AVM1 dot/slash paths are not normalised. */
  readonly variableName: string;
  readonly initialText: string | null;
}

export interface TextRecoveryDiagnostic {
  readonly code: typeof Codes.FONT_GLYPH_INDEX_INVALID | typeof Codes.FONT_GLYPH_CODE_MISSING;
  readonly severity: Severity;
  readonly message: string;
}

export interface TextRecoveryResult {
  readonly text: StaticTextModel;
  readonly diagnostics: readonly TextRecoveryDiagnostic[];
}

/** Report sink for text recovery, which resolves across tags and so has no single cursor. */
export type TextRecoveryEmit = (code: Code, severity: Severity, message: string) => void;

/** `DefineText` (11) and `DefineText2` (33), retaining glyph positions and persistent text styles. */
export function decodeDefineText(tagCode: number, c: Cursor): StaticTextModel {
  if (tagCode !== Tag.DefineText && tagCode !== Tag.DefineText2) {
    throw new RangeError(`tag ${tagCode} is not DefineText/DefineText2`);
  }
  const id = c.u16();
  const bounds = readRect(c);
  const matrix = readMatrix(c);
  const glyphBits = c.u8();
  const advanceBits = c.u8();
  let fontId: number | null = null;
  let color: Rgba | null = null;
  let textHeight: number | null = null;
  const runs: StaticTextRunModel[] = [];
  for (let guard = 0; guard < 65_536 && c.remaining > 0; guard += 1) {
    const recordType = c.ub(1);
    if (recordType === 0) {
      c.align();
      break;
    }
    c.ub(3); // StyleFlagsReserved
    const hasFont = c.ub(1) === 1;
    const hasColor = c.ub(1) === 1;
    const hasYOffset = c.ub(1) === 1;
    const hasXOffset = c.ub(1) === 1;
    if (hasFont) fontId = c.u16();
    if (hasColor) color = tagCode === Tag.DefineText2 ? readRgba(c) : { ...readRgb(c), a: 255 };
    const xOffset = hasXOffset ? c.s16() : 0;
    const yOffset = hasYOffset ? c.s16() : 0;
    if (hasFont) {
      textHeight = c.u16();
      if (textHeight === 0) {
        c.emit(
          Codes.FONT_TEXT_HEIGHT_MISSING,
          'warning',
          `text ${id} run ${runs.length} has TextHeight 0; downstream metrics fallback is required`,
        );
      }
    }
    const glyphCount = c.u8();
    const glyphs: TextGlyphModel[] = [];
    const safeGlyphBits = glyphBits <= 32 ? glyphBits : 32;
    const safeAdvanceBits = advanceBits <= 32 ? advanceBits : 32;
    for (let index = 0; index < glyphCount; index += 1) {
      const glyphIndex = c.ub(safeGlyphBits);
      const advance = c.sb(safeAdvanceBits);
      glyphs.push({ glyphIndex, advance });
    }
    c.align();
    runs.push({ fontId, color, xOffset, yOffset, textHeight, glyphs, recoveredText: null });
  }
  return {
    id,
    version: tagCode === Tag.DefineText2 ? 2 : 1,
    tagCode: tagCode as 11 | 33,
    bounds,
    matrix,
    glyphBits,
    advanceBits,
    runs,
  };
}

/** Attach unambiguous one-to-one text only; authored glyph indices/advances remain authoritative. */
export function recoverStaticTextCodes(
  text: StaticTextModel,
  fonts: ReadonlyMap<number, DefineFontModel>,
  reporter?: TextRecoveryEmit,
): TextRecoveryResult {
  const diagnostics: TextRecoveryDiagnostic[] = [];
  // Reported at the point of detection rather than handed back for a caller to forward. The
  // forwarding form let `SF0272`/`SF0273` be computed and then dropped on the floor by any caller
  // that forgot, and made the emission invisible to the diagnostic-coverage scanner, which reads
  // literal `Codes.*` tokens at `emit` call sites (F-P3-17).
  // Bound to a plain identifier called `emit`, and called with literal `Codes.*` tokens, so the
  // diagnostic-coverage scanner can see the site. `reporter?.(code, …)` would work at runtime and
  // be invisible to the gate — which is precisely how SF0272/SF0273 sat on the deferred list while
  // emitting correctly in production (F-P3-17).
  const emit: TextRecoveryEmit = reporter ?? ((): void => {});
  const report = (code: TextRecoveryDiagnostic['code'], message: string): void => {
    diagnostics.push({ code, severity: 'warning', message });
    if (code === Codes.FONT_GLYPH_INDEX_INVALID) emit(Codes.FONT_GLYPH_INDEX_INVALID, 'warning', message);
    else emit(Codes.FONT_GLYPH_CODE_MISSING, 'warning', message);
  };
  const runs = text.runs.map((run, runIndex): StaticTextRunModel => {
    const font = run.fontId === null ? undefined : fonts.get(run.fontId);
    if (font === undefined) {
      if (run.glyphs.length > 0) {
        report(
          Codes.FONT_GLYPH_CODE_MISSING,
          `text ${text.id} run ${runIndex} references missing font ${run.fontId ?? '(no FontID)'}`,
        );
      }
      return { ...run, recoveredText: null };
    }
    const frequencies = new Map<number, number>();
    for (const glyph of font.glyphs) {
      if (glyph.code === null) continue;
      frequencies.set(glyph.code, (frequencies.get(glyph.code) ?? 0) + 1);
    }
    let invalidIndex = false;
    let missingCode = false;
    let ambiguous = false;
    const codepoints: number[] = [];
    for (const entry of run.glyphs) {
      const glyph = font.glyphs[entry.glyphIndex];
      if (glyph === undefined) {
        invalidIndex = true;
        continue;
      }
      if (glyph.code === null || !Number.isInteger(glyph.code) || glyph.code < 0 || glyph.code > 0xffff) {
        missingCode = true;
        continue;
      }
      if ((frequencies.get(glyph.code) ?? 0) !== 1) ambiguous = true;
      codepoints.push(glyph.code);
    }
    if (invalidIndex) {
      report(
        Codes.FONT_GLYPH_INDEX_INVALID,
        `text ${text.id} run ${runIndex} contains a glyph index outside font ${font.id}`,
      );
    }
    if (missingCode) {
      report(
        Codes.FONT_GLYPH_CODE_MISSING,
        `text ${text.id} run ${runIndex} contains a glyph without a valid character code`,
      );
    }
    const recoveredText = !invalidIndex && !missingCode && !ambiguous ? String.fromCharCode(...codepoints) : null;
    return { ...run, recoveredText };
  });
  return { text: { ...text, runs }, diagnostics };
}

const EDIT_FLAGS = [
  'hasText',
  'wordWrap',
  'multiline',
  'password',
  'readOnly',
  'hasTextColor',
  'hasMaxLength',
  'hasFont',
  'hasFontClass',
  'autoSize',
  'hasLayout',
  'noSelect',
  'border',
  'wasStatic',
  'html',
  'useOutlines',
] as const;

/** `DefineEditText` (37); runtime behaviours are recorded, never interpreted here. */
export function decodeDefineEditText(c: Cursor): EditTextModel {
  const id = c.u16();
  const bounds = readRect(c);
  const rawFlags = c.u16();
  const flagValues = Object.fromEntries(
    EDIT_FLAGS.map((name, bit) => [name, (rawFlags & (1 << bit)) !== 0]),
  ) as unknown as EditTextFlags;
  const fontId = flagValues.hasFont ? c.u16() : null;
  const fontClass = flagValues.hasFontClass ? c.string() : null;
  const fontHeight = flagValues.hasFont || flagValues.hasFontClass ? c.u16() : null;
  const color = flagValues.hasTextColor ? readRgba(c) : null;
  const maxLength = flagValues.hasMaxLength ? c.u16() : null;
  let layout: EditTextLayoutModel | null = null;
  if (flagValues.hasLayout) {
    layout = {
      align: c.u8(),
      leftMargin: c.u16(),
      rightMargin: c.u16(),
      indent: c.u16(),
      leading: c.s16(),
    };
  }
  const variableName = c.string();
  const initialText = flagValues.hasText ? c.string() : null;
  if (fontHeight === 0) {
    c.emit(
      Codes.FONT_TEXT_HEIGHT_MISSING,
      'warning',
      `editable text ${id} has FontHeight 0; downstream metrics fallback is required`,
    );
  }
  if (flagValues.hasFontClass && fontHeight !== null) {
    c.emit(Codes.FONT_HEIGHT_CLASS_TOLERATED, 'info', `editable text ${id} has FontHeight alongside HasFontClass`);
  }
  if (!flagValues.useOutlines && (flagValues.hasFont || flagValues.hasFontClass)) {
    c.emit(
      Codes.FONT_DEVICE_FIELD_UNSUPPORTED,
      'warning',
      `editable text ${id} uses device-font rendering; platform-dependent output is retained`,
    );
  }
  return {
    id,
    bounds,
    flags: flagValues,
    fontId,
    fontClass,
    fontHeight,
    color,
    maxLength,
    layout,
    variableName,
    initialText,
  };
}
