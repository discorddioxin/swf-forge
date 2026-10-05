/**
 * Node entry point: `openSwf` with a real content hash and the Node inflaters, so `CWS` files open
 * synchronously without the caller wiring anything and `ZWS` files open through the optional
 * `lzma` package when it is installed (`TECH-SPEC` §3.3, `IMPL-020-R002`).
 */
import { compressionOf } from '../container/header.js';
import { openSwf, openSwfAsync, type SwfFile, type SwfOpenOptions } from '../container/open.js';
import { sha256Hex } from './hash.js';
import { nodeInflate, nodeInflateAsync } from './inflate.js';
import { nodeInflateLzma, nodeInflateLzmaAsync, tryLoadLzma } from './lzma.js';

export interface NodeOpenOptions extends Omit<SwfOpenOptions, 'inflate' | 'inflateAsync' | 'sha256'> {
  /** Skip the content hash (the model id then falls back to a sampled content hash). */
  readonly hash?: boolean;
}

function wireSync(input: Uint8Array, options: NodeOpenOptions): SwfOpenOptions {
  const { hash = true, ...rest } = options;
  const isLzma = compressionOf(input) === 'lzma';
  const wireLzma = isLzma && tryLoadLzma() !== null;
  const wired: SwfOpenOptions = {
    ...rest,
    ...(hash ? { sha256: sha256Hex(input) } : {}),
  };
  // A missing optional LZMA package leaves `inflate` unset for ZWS so the container reports
  // `SF0006` (adapter unavailable) instead of a decompression failure.
  if (!isLzma) wired.inflate = nodeInflate;
  else if (wireLzma) wired.inflate = nodeInflateLzma;
  return wired;
}

function wireAsync(input: Uint8Array, options: NodeOpenOptions): SwfOpenOptions {
  const { hash = true, ...rest } = options;
  const isLzma = compressionOf(input) === 'lzma';
  const wired: SwfOpenOptions = {
    ...rest,
    ...(hash ? { sha256: sha256Hex(input) } : {}),
  };
  // `CWS` goes through `nodeInflateAsync` — the `IMPL-020-R007` partial-yield pump (`zlib`
  // stream events, which a synchronous `inflateSync` cannot retain). `ZWS` uses the lazy
  // optional LZMA adapter. No sync `inflate` is wired here: `openSwfAsync` takes the
  // `inflateAsync` branch precisely when it is absent.
  wired.inflateAsync = isLzma ? nodeInflateLzmaAsync : nodeInflateAsync;
  return wired;
}

export function openSwfNodeSync(input: Uint8Array, options: NodeOpenOptions = {}): SwfFile {
  return openSwf(input, wireSync(input, options));
}

export async function openSwfNodeAsync(input: Uint8Array, options: NodeOpenOptions = {}): Promise<SwfFile> {
  return openSwfAsync(input, wireAsync(input, options));
}
