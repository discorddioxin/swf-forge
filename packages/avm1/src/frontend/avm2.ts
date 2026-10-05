/**
 * AVM2 detection (IMPL-050 §9 `SF1000`, WP-050-15).
 *
 * The AVM1 front end must *fail hard* when the movie contains AVM2 content: a `DoABC` tag (82) or
 * `FileAttributes.ActionScript3` (0x08). The check is top-level — it inspects the tag stream and the
 * `FileAttributes` tag, not individual action blocks — and it reports the *first* offending tag so
 * the offset is named. The caller maps the verdict to exit code 3 (doc 010 §7).
 */

import { Tag } from '@swf-forge/swf';
import type { MovieModel, SwfFile } from '@swf-forge/swf';

export interface Avm2Verdict {
  readonly present: boolean;
  /** The first offending tag's offset (file-absolute), or `null` when absent. */
  readonly offset: number | null;
  /** `DoABC` / `ActionScript3` — which signal fired first. */
  readonly source: 'doAbc' | 'fileAttributes' | null;
  readonly reason: string;
}

const DO_ABC = Tag.DoABC; // 82
const AS3_FLAG = 0x08;

/**
 * Scans for AVM2 content. `FileAttributes` is checked first (it is the earliest in the file when
 * present); then the tag stream for any `DoABC`. Returns a hard-error verdict when AVM2 is present.
 */
export function detectAvm2(file: SwfFile, model: MovieModel): Avm2Verdict {
  const attributes = model.control.attributes;
  if (attributes !== null && (attributes.as3 || (attributes.raw & AS3_FLAG) !== 0)) {
    return {
      present: true,
      offset: attributes.origin.offset,
      source: 'fileAttributes',
      reason: 'FileAttributes.ActionScript3 is set (0x08)',
    };
  }

  for (const tag of file.tagIndex.tags) {
    if (tag.code === DO_ABC) {
      return {
        present: true,
        offset: tag.headerOffset,
        source: 'doAbc',
        reason: `DoABC tag at offset ${tag.headerOffset}`,
      };
    }
  }

  return { present: false, offset: null, source: null, reason: '' };
}
