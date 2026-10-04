/**
 * Node entry point: `openSwf` with a real content hash and a zlib inflater, so `CWS` files open
 * synchronously without the caller wiring either (`TECH-SPEC` §3.3).
 */
import { openSwf, openSwfAsync, type SwfFile, type SwfOpenOptions } from '../container/open.js';
import { sha256Hex } from './hash.js';
import { nodeInflate } from './inflate.js';

export interface NodeOpenOptions extends Omit<SwfOpenOptions, 'inflate' | 'sha256'> {
  /** Skip the content hash (the model id then falls back to a sampled content hash). */
  readonly hash?: boolean;
}

function wire(input: Uint8Array, options: NodeOpenOptions): SwfOpenOptions {
  const { hash = true, ...rest } = options;
  return { ...rest, inflate: nodeInflate, ...(hash ? { sha256: sha256Hex(input) } : {}) };
}

export function openSwfNodeSync(input: Uint8Array, options: NodeOpenOptions = {}): SwfFile {
  return openSwf(input, wire(input, options));
}

export async function openSwfNodeAsync(input: Uint8Array, options: NodeOpenOptions = {}): Promise<SwfFile> {
  return openSwfAsync(input, wire(input, options));
}
