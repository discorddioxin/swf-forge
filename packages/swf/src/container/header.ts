/**
 * Container header — `IMPL-020` §4.4.
 *
 * Parse order (Ch.2): Signature (3) -> Version (UI8) -> FileLength (UI32) -> FrameSize (RECT) ->
 * FrameRate (UI16 8.8) -> FrameCount (UI16).
 */

import { Codes } from '../diagnostics/codes.js';
import type { DiagnosticSink } from '../diagnostics/sink.js';
import { Cursor } from '../io/cursor.js';
import { readRect } from '../io/records.js';
import { TWIPS_PER_PIXEL, type Rect } from '../io/types.js';

export type Compression = 'none' | 'zlib' | 'lzma';

export interface SwfHeader {
  readonly compression: Compression;
  readonly version: number;
  /** Total length including the header, as declared. */
  readonly fileLength: number;
  /** Frame size in twips. */
  readonly frameSize: Rect;
  /** Frame size in CSS px at 1x (twips / 20). */
  readonly frameSizePx: { width: number; height: number };
  /** Frames per second from the 8.8 fixed field. */
  readonly frameRate: number;
  /** Raw 8.8 value, preserved for reporting. */
  readonly frameRateRaw: number;
  readonly frameCount: number;
}

export interface HeaderResult {
  readonly header: SwfHeader;
  /** Offset of the first tag header inside `payload`. */
  readonly tagStreamOffset: number;
}

export const SIGNATURES: Readonly<Record<string, Compression>> = {
  FWS: 'none',
  CWS: 'zlib',
  ZWS: 'lzma',
};

export function compressionOf(bytes: Uint8Array): Compression | undefined {
  if (bytes.length < 3) return undefined;
  const sig = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0, bytes[2] ?? 0);
  return SIGNATURES[sig];
}

export function parseHeader(
  payload: Uint8Array,
  fileLength: number,
  compression: Compression,
  fileSize: number,
  sink: DiagnosticSink,
  opts: { mode?: 'soft' | 'strict'; declaredVersion?: number; reportPaddingBits?: boolean } = {},
): HeaderResult {
  const version = opts.declaredVersion ?? 0;
  if (fileLength < 8 || fileLength > 2 ** 31) {
    sink.emit({
      code: Codes.FILE_LENGTH_IMPLAUSIBLE,
      severity: 'warning',
      message: `declared FileLength ${fileLength} is implausible; using the actual sizes`,
      offset: 4,
      context: 'header',
    });
  }
  if (version > 0 && version < 4) {
    sink.emit({
      code: Codes.VERSION_BELOW_BASELINE,
      severity: 'warning',
      message: `SWF version ${version} is below the AVM1 baseline (4); decoding continues`,
      offset: 3,
      context: 'header',
    });
  }
  if (compression === 'zlib' && version > 0 && version < 6) {
    sink.emit({
      code: Codes.NON_CANONICAL_COMPRESSION,
      severity: 'info',
      message: `CWS container used by version ${version} (zlib arrived in SWF 6)`,
      offset: 0,
      context: 'header',
    });
  }

  const c = new Cursor(payload, 0, payload.length, {
    mode: opts.mode ?? 'soft',
    sink,
    context: 'header',
    ...(opts.reportPaddingBits !== undefined ? { reportPaddingBits: opts.reportPaddingBits } : {}),
  });
  const frameSize = readRect(c);
  const frameRateRaw = c.u16();
  const frameCount = c.u16();
  const frameRate = frameRateRaw / 256;

  if (frameSize.xMin !== 0 || frameSize.yMin !== 0) {
    sink.emit({
      code: Codes.FRAME_SIZE_OFFSET,
      severity: 'warning',
      message: `FrameSize has non-zero Xmin/Ymin (${frameSize.xMin}, ${frameSize.yMin}); kept as stored`,
      offset: 8,
      context: 'FrameSize',
    });
  }
  const width = frameSize.xMax - frameSize.xMin;
  const height = frameSize.yMax - frameSize.yMin;
  if (width <= 0 || height <= 0) {
    sink.emit({
      code: Codes.FRAME_SIZE_NONPOSITIVE,
      severity: 'error',
      message: `FrameSize has non-positive extent (${width} x ${height} twips)`,
      offset: 8,
      context: 'FrameSize',
    });
  }
  if (frameRateRaw === 0 || frameRate > 240) {
    sink.emit({
      code: Codes.FRAME_RATE_IMPLAUSIBLE,
      severity: 'info',
      message: `frame rate ${frameRate} fps (raw ${frameRateRaw}) is outside the plausible range`,
      offset: c.offset,
      context: 'FrameRate',
    });
  }
  if (compression !== 'none' && payload.length !== fileLength - 8) {
    // `IMPL-020-R011`: the declared length and the decompressed payload are cross-checked.
    sink.emit({
      code: payload.length > fileLength - 8 ? Codes.DECOMPRESSED_LONGER : Codes.DECOMPRESSED_SHORTER,
      severity: 'warning',
      message: `decompressed payload is ${payload.length} byte(s); FileLength ${fileLength} + 8-byte header implies ${Math.max(0, fileLength - 8)}`,
      offset: 0,
      context: 'container',
    });
  }
  if (compression === 'none' && fileSize !== fileLength) {
    sink.emit({
      code: fileSize > fileLength ? Codes.DECOMPRESSED_LONGER : Codes.DECOMPRESSED_SHORTER,
      severity: 'warning',
      message: `file is ${fileSize} byte(s) on disk; FileLength declares ${fileLength}`,
      offset: 4,
      context: 'container',
    });
  }

  const header: SwfHeader = {
    compression,
    version,
    fileLength,
    frameSize,
    frameSizePx: { width: width / TWIPS_PER_PIXEL, height: height / TWIPS_PER_PIXEL },
    frameRate,
    frameRateRaw,
    frameCount,
  };
  return { header, tagStreamOffset: c.offset };
}
