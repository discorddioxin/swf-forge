/**
 * Node inflater for `CWS` payloads — the synchronous counterpart of `openSwfAsync`'s
 * `DecompressionStream('deflate')` (`IMPL-020-R002`).
 *
 * `maxOutputLength` makes the cap enforced by the runtime rather than by us: the module cannot be
 * made to allocate past the configured ceiling, and hitting it is reported as `truncated` so the
 * container emits `SF0007` (a hard error) instead of parsing a half file.
 *
 * **Synchronous limitation (pinned deviation — doc 020 §12 item 8).** `node:zlib`'s synchronous
 * API cannot retain partial output from a corrupt stream: `inflateSync` throws without returning
 * what it already decoded, and the stream API's partial output is delivered on tick, which a
 * synchronous caller cannot await (verified empirically against Node 22). So `nodeInflate`
 * reports `SF0003` (via `error`) with an empty body on a corrupt stream; the `IMPL-020-R007`
 * partial yield ("the bytes decoded so far plus `SF0003`") is served by `nodeInflateAsync`, which
 * `openSwfNodeAsync` uses for `CWS` — that is the path `inspect` runs on.
 */

import { createInflate, inflateSync } from 'node:zlib';

import type { InflateResult } from '../container/open.js';

function concatChunks(chunks: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const chunk of chunks) total += chunk.length;
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return bytes;
}

const CAP_ERROR_CODES = new Set(['ERR_BUFFER_TOO_LARGE', 'ERR_OUT_OF_RANGE']);

const isCapError = (code: string | undefined): boolean => code !== undefined && CAP_ERROR_CODES.has(code);

export function nodeInflate(data: Uint8Array, maxBytes: number): InflateResult {
  try {
    const out = inflateSync(data, { maxOutputLength: maxBytes });
    return { bytes: new Uint8Array(out.buffer, out.byteOffset, out.byteLength), truncated: false };
  } catch (error) {
    const code = (error as { code?: string }).code;
    const message = error instanceof Error ? error.message : String(error);
    if (isCapError(code)) {
      return { bytes: new Uint8Array(0), truncated: true, error: message };
    }
    // Corrupt stream: the synchronous API cannot keep the bytes already decoded (see the module
    // note). `openSwf` maps `error` to `SF0003` and assembles the (empty) body.
    return { bytes: new Uint8Array(0), truncated: false, error: message };
  }
}

/**
 * Asynchronous `CWS` inflater for `openSwfNodeAsync` — the `IMPL-020-R007` partial-yield path.
 * A corrupt or truncated stream resolves (never rejects) with the bytes decoded so far plus
 * `error`, so the container reports `SF0003` and still indexes the recoverable prefix.
 *
 * The cap is enforced by the pump itself: on this platform `createInflate({ maxOutputLength })`
 * does **not** error when the limit is exceeded (it simply keeps emitting), so counting the
 * output and aborting at the cap is what makes `maxDecompressedBytes` real here (D-1: the cap
 * hit yields `SF0007` with an empty body, sync and async alike).
 */
export function nodeInflateAsync(data: Uint8Array, maxBytes: number): Promise<InflateResult> {
  const stream = createInflate();
  const chunks: Uint8Array[] = [];
  let total = 0;
  return new Promise((resolve) => {
    let settled = false;
    let overCap = false;
    const finish = (result: InflateResult): void => {
      if (settled) return;
      settled = true;
      stream.destroy();
      resolve(result);
    };
    stream.on('data', (chunk: Buffer) => {
      if (overCap) return;
      total += chunk.length;
      if (total > maxBytes) {
        // Cap abort — the unified contract (`P1-RESOLUTION-AUDIT` D-1): `SF0007`, empty body.
        overCap = true;
        finish({
          bytes: new Uint8Array(0),
          truncated: true,
          error: `decompressed output exceeds the configured cap of ${maxBytes} byte(s); aborted`,
        });
        return;
      }
      chunks.push(chunk);
    });
    stream.on('end', () => finish({ bytes: concatChunks(chunks), truncated: false }));
    stream.on('error', (error: Error & { code?: string }) => {
      if (overCap) return;
      // R007: yield the bytes decoded so far; the container emits `SF0003` and keeps parsing
      // the recoverable prefix.
      finish({ bytes: concatChunks(chunks), truncated: false, error: error.message });
    });
    stream.write(data);
    stream.end();
  });
}
