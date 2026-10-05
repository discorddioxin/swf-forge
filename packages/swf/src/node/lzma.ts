/**
 * Node LZMA adapter for `ZWS` payloads — `IMPL-020` §4.3 / WP-020-03.
 *
 * The pure-JS `lzma` package is an *optional* dependency (`IMPL-020-R002`): it is loaded lazily
 * (first on a sync require, and the async path uses `await import`) so a build without it still
 * parses `FWS`/`CWS` files and reports `SF0006` only when a `ZWS` file is actually opened.
 *
 * The adapter speaks the `LZMA_alone` stream (5 property bytes + compressed data), which is
 * exactly what a `ZWS` payload is once the advisory `UI32 compressedLength` has been stripped —
 * `container/open.ts` frames that layout and reports `SF0027` on disagreement.
 */

import { createRequire } from 'node:module';

import type { InflateResult } from '../container/open.js';

interface LzmaModule {
  readonly compress: (input: Uint8Array) => number[];
  readonly decompress: (input: Uint8Array) => number[];
}

let cached: LzmaModule | null | undefined;

/** Lazily loads the optional `lzma` package; `null` when it is not installed. */
export function tryLoadLzma(): LzmaModule | null {
  if (cached !== undefined) return cached;
  try {
    const require = createRequire(import.meta.url);
    cached = require('lzma') as LzmaModule;
  } catch {
    cached = null;
  }
  return cached;
}

function decompressWith(mod: LzmaModule, data: Uint8Array, maxBytes: number): InflateResult {
  // Input-size pre-bound (WP-020-03, `P1-RESOLUTION-AUDIT` R-03): a compressed payload already
  // larger than the decompression cap would only ever expand further, so refuse before any
  // allocation. The post-hoc cap check below remains for inputs at or under the cap — the
  // pure-JS decoder cannot stream, which is the pinned deviation in doc 020 §12 item 6.
  if (data.length > maxBytes) {
    return {
      bytes: new Uint8Array(0),
      truncated: true,
      error: `ZWS compressed input is ${data.length} byte(s), over the configured cap of ${maxBytes}; refusing to decompress`,
    };
  }
  let out: number[];
  try {
    out = mod.decompress(data);
  } catch (error) {
    return {
      bytes: new Uint8Array(0),
      truncated: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
  const bytes = new Uint8Array(out);
  if (bytes.length > maxBytes) {
    // The pure-JS decoder cannot stream; the cap is enforced on the (bounded) output instead of
    // aborting mid-output (pinned deviation — doc 020 §12 item 6).
    return {
      bytes: new Uint8Array(0),
      truncated: true,
      error: `decompressed output is ${bytes.length} byte(s), over the configured cap of ${maxBytes}`,
    };
  }
  return { bytes, truncated: false };
}

/** Synchronous `ZWS` inflater for `openSwfNodeSync` (delegates to the cached optional package). */
export function nodeInflateLzma(data: Uint8Array, maxBytes: number): InflateResult {
  const mod = tryLoadLzma();
  if (mod === null) {
    return { bytes: new Uint8Array(0), truncated: false, error: 'the optional "lzma" package is not installed' };
  }
  return decompressWith(mod, data, maxBytes);
}

/** Asynchronous `ZWS` inflater — the `IMPL-020-R002` lazy-import form. */
export async function nodeInflateLzmaAsync(data: Uint8Array, maxBytes: number): Promise<InflateResult> {
  let mod: LzmaModule;
  try {
    mod = (await import('lzma')) as unknown as LzmaModule;
  } catch {
    return { bytes: new Uint8Array(0), truncated: false, error: 'the optional "lzma" package is not installed' };
  }
  return decompressWith(mod, data, maxBytes);
}
