/**
 * Node inflater for `CWS` payloads — the synchronous counterpart of `openSwfAsync`'s
 * `DecompressionStream('deflate')` (`IMPL-020-R002`).
 *
 * `maxOutputLength` makes the cap enforced by the runtime rather than by us: the module cannot be
 * made to allocate past the configured ceiling, and hitting it is reported as `truncated` so the
 * container emits `SF0007` (a hard error) instead of parsing a half file.
 */

import { inflateSync } from 'node:zlib';

import type { InflateResult } from '../container/open.js';

export function nodeInflate(data: Uint8Array, maxBytes: number): InflateResult {
  try {
    const out = inflateSync(data, { maxOutputLength: maxBytes });
    return { bytes: new Uint8Array(out.buffer, out.byteOffset, out.byteLength), truncated: false };
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = error instanceof Error ? error.message : String(error);
    if (code === 'ERR_BUFFER_TOO_LARGE' || code === 'ERR_OUT_OF_RANGE') {
      return { bytes: new Uint8Array(0), truncated: true, error: message };
    }
    return { bytes: new Uint8Array(0), truncated: false, error: message };
  }
}
