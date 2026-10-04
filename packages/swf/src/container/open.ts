/**
 * `openSwf` — `IMPL-020` §3–§5. The entry point of the package.
 *
 * Compression policy (`IMPL-020-R006`/`R007`): the sync entry point needs an inflater for `CWS`/`ZWS`,
 * because the platform's `DecompressionStream` is asynchronous. `swf/node` ships a `node:zlib`-based
 * inflater, and `openSwfAsync` uses `DecompressionStream` in any environment that has it.
 */

import { Codes } from '../diagnostics/codes.js';
import { DiagnosticSink } from '../diagnostics/sink.js';
import type { Diagnostic } from '../diagnostics/types.js';
import { compressionOf, parseHeader, type Compression, type SwfHeader } from './header.js';
import { buildTagIndex, type DefinitionEntry, type TagIndex, type TagRef, type TagStreamResult } from './tag-stream.js';

export interface SwfOpenOptions {
  /** Hard cap on decompressed bytes. Default 512 MiB (design SWF-R043). */
  maxDecompressedBytes?: number;
  /** Hard cap on dictionary entries. Default 2_000_000. */
  maxDictionaryEntries?: number;
  /** Parser mode: 'soft' recovers, 'strict' throws on the first structural error. */
  mode?: 'soft' | 'strict';
  /** Promote a FileLength mismatch from warning to error (`SWF-R009`). */
  strictLength?: boolean;
  /** Diagnostics sink; one per movie. */
  sink?: DiagnosticSink;
  /** Whether to build the full tag index eagerly (default) or on first access. */
  indexStrategy?: 'eager' | 'lazy';
  /** Synchronous inflater for `CWS`/`ZWS` payloads (see `@swf-forge/swf/node`). */
  inflate?: (data: Uint8Array, maxBytes: number) => InflateResult;
  /** Legacy string encoding for versions <= 5 (`IMPL-010-R023`). */
  legacyStringEncoding?: 'windows-1252' | 'latin1' | 'shift-jis';
  /** Report non-zero padding bits discarded by `align()` (`SF0008`). */
  reportPaddingBits?: boolean;
  /** Optional content hash (Node callers pass a sha256; browsers may omit it). */
  sha256?: string;
}

export interface InflateResult {
  readonly bytes: Uint8Array;
  /** True when the cap was hit and the output is incomplete. */
  readonly truncated: boolean;
  readonly error?: string;
}

export type TagPayload =
  | { kind: 'bytes'; view: Uint8Array }
  | { kind: 'skipped'; reason: 'unknown' | 'unsupported' | 'not-requested' | 'not-a-swf' };

export interface SwfFile {
  readonly header: SwfHeader;
  /** The decompressed body: everything after the 8-byte header. Views, not copies. */
  readonly body: Uint8Array;
  readonly tagIndex: TagIndex;
  /** Definition tags in stream order (the dictionary). */
  readonly definitions: readonly DefinitionEntry[];
  readonly diagnostics: readonly Diagnostic[];
  readonly sink: DiagnosticSink;
  /** Raw file size and decompressed size, for reporting. */
  readonly sizes: { file: number; decompressed: number; ratio: number };
  readonly sha256: string;
  readonly version: number;
  /** Re-reads a tag payload; memoised per `TagRef.index` (`IMPL-020-R004`). */
  readTag(ref: TagRef): TagPayload;
}

function emptyIndex(): TagIndex {
  return {
    tags: [],
    spriteRanges: new Map(),
    histogram: new Map(),
    frameCounts: new Map(),
  };
}

function assemble(
  input: Uint8Array,
  payload: Uint8Array,
  compression: Compression,
  sink: DiagnosticSink,
  opts: SwfOpenOptions,
): SwfFile {
  const version = input.length > 3 ? (input[3] ?? 0) : 0;
  const fileLength =
    input.length >= 8
      ? ((input[4] ?? 0) | ((input[5] ?? 0) << 8) | ((input[6] ?? 0) << 16) | ((input[7] ?? 0) << 24)) >>> 0
      : 0;
  const { header, tagStreamOffset } = parseHeader(payload, fileLength, compression, input.length, sink, {
    mode: opts.mode ?? 'soft',
    strictLength: opts.strictLength ?? false,
    declaredVersion: version,
    reportPaddingBits: opts.reportPaddingBits ?? false,
  });

  let stream: TagStreamResult | undefined =
    opts.indexStrategy === 'lazy'
      ? undefined
      : buildTagIndex(payload.subarray(tagStreamOffset), sink, {
          mode: opts.mode ?? 'soft',
          declaredFrames: header.frameCount,
          ...(opts.maxDictionaryEntries !== undefined ? { maxDictionaryEntries: opts.maxDictionaryEntries } : {}),
        });
  const ensureStream = (): TagStreamResult => {
    stream ??= buildTagIndex(payload.subarray(tagStreamOffset), sink, {
      mode: opts.mode ?? 'soft',
      declaredFrames: header.frameCount,
      ...(opts.maxDictionaryEntries !== undefined ? { maxDictionaryEntries: opts.maxDictionaryEntries } : {}),
    });
    return stream;
  };
  const memo = new Map<number, TagPayload>();
  const body = payload.subarray(tagStreamOffset);

  const file: SwfFile = {
    header,
    body,
    get tagIndex() {
      return ensureStream().index;
    },
    get definitions() {
      return ensureStream().definitions;
    },
    get diagnostics() {
      return sink.list();
    },
    sink,
    sizes: {
      file: input.length,
      decompressed: payload.length,
      ratio: input.length === 0 ? 0 : payload.length / input.length,
    },
    sha256: opts.sha256 ?? '',
    version,
    readTag(ref: TagRef): TagPayload {
      const cached = memo.get(ref.index);
      if (cached) return cached;
      const value: TagPayload = { kind: 'bytes', view: body.subarray(ref.offset, ref.offset + ref.length) };
      memo.set(ref.index, value);
      return value;
    },
  };
  return file;
}

export function openSwf(input: Uint8Array, opts: SwfOpenOptions = {}): SwfFile {
  const sink = opts.sink ?? new DiagnosticSink();
  const compression = compressionOf(input);
  if (input.length < 8 || compression === undefined) {
    sink.emit({
      code: Codes.NOT_A_SWF,
      severity: 'error',
      message: `input is not a SWF (signature ${input.length >= 3 ? String.fromCharCode(input[0] ?? 0, input[1] ?? 0, input[2] ?? 0) : '<short>'})`,
      offset: 0,
      context: 'container',
    });
    if ((opts.mode ?? 'soft') === 'strict') {
      throw new Error(`${Codes.NOT_A_SWF}: not a SWF`);
    }
    const empty = new Uint8Array(0);
    const header: SwfHeader = {
      compression: 'none',
      version: input.length > 3 ? (input[3] ?? 0) : 0,
      fileLength: 0,
      frameSize: { xMin: 0, xMax: 0, yMin: 0, yMax: 0 },
      frameSizePx: { width: 0, height: 0 },
      frameRate: 0,
      frameRateRaw: 0,
      frameCount: 0,
    };
    return {
      header,
      body: empty,
      tagIndex: emptyIndex(),
      definitions: [],
      diagnostics: sink.list(),
      sink,
      sizes: { file: input.length, decompressed: 0, ratio: 0 },
      sha256: opts.sha256 ?? '',
      version: header.version,
      readTag: () => ({ kind: 'skipped', reason: 'not-a-swf' }),
    };
  }

  const maxBytes = opts.maxDecompressedBytes ?? 512 * 1024 * 1024;
  const payloadPart = input.subarray(8);

  if (compression === 'none') {
    return assemble(input, payloadPart, 'none', sink, opts);
  }

  if (!opts.inflate) {
    const isLzma = compression === 'lzma';
    sink.emit({
      code: isLzma ? Codes.NO_LZMA_DECODER : Codes.DECOMPRESSION_FAILED,
      severity: 'error',
      message: isLzma
        ? 'ZWS payload needs an LZMA decoder; pass opts.inflate (Node: @swf-forge/swf/node) or use a supported openSwfAsync path'
        : 'CWS payload needs a zlib inflater; pass opts.inflate (Node: @swf-forge/swf/node) or use openSwfAsync',
      offset: 0,
      context: 'container',
    });
    return assemble(input, new Uint8Array(0), compression, sink, opts);
  }

  const result = opts.inflate(payloadPart, maxBytes);
  if (result.error) {
    sink.emit({
      code: Codes.DECOMPRESSION_FAILED,
      severity: 'error',
      message: result.error,
      offset: 0,
      context: 'container',
    });
  }
  if (result.truncated) {
    sink.emit({
      code: Codes.DECOMPRESSED_OVER_CAP,
      severity: 'error',
      message: `decompressed output exceeded the configured cap of ${maxBytes} byte(s); aborted`,
      offset: 0,
      context: 'container',
    });
  }
  return assemble(input, result.bytes, compression, sink, opts);
}

/** Uses the platform `DecompressionStream('deflate')`; the async counterpart of `openSwf`. */
export async function openSwfAsync(input: Uint8Array, opts: SwfOpenOptions = {}): Promise<SwfFile> {
  const compression = compressionOf(input);
  if (compression !== 'zlib' || opts.inflate) {
    return openSwf(input, opts);
  }
  const stream = new DecompressionStream('deflate');
  const writer = stream.writable.getWriter();
  void writer.write(input.subarray(8));
  void writer.close();
  const chunks: Uint8Array[] = [];
  let total = 0;
  const cap = opts.maxDecompressedBytes ?? 512 * 1024 * 1024;
  const reader = stream.readable.getReader();
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      total += value.length;
      if (total > cap) {
        truncated = true;
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.length;
  }
  return openSwf(input, {
    ...opts,
    inflate: () => (truncated ? { bytes, truncated } : { bytes, truncated: false }),
  });
}
