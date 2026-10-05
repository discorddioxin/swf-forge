/**
 * `ACTIONRECORD` framing — `IMPL-050` §3.1 (R003–R007).
 *
 * The chapter's rule is exactly this: the high bit of the ActionCode decides whether a `UI16`
 * `Length` follows, and the opcode table (not the stream) decides the payload layout. `Length`
 * counts only the payload bytes. All offsets here are *block-relative*; the caller adds the
 * block's base offset for file-absolute positions.
 */

import { Codes } from '@swf-forge/swf';
import type { Severity } from '@swf-forge/swf';

import { isDefinedCode, opcode } from './opcodes.js';

export type Emit = (code: string, severity: Severity, message: string, offset: number, context?: string) => void;

/** One framed record. `spec` is `null` for an unknown opcode (R005). */
export interface ActionRecord {
  /** Block-relative offset of the ActionCode byte. */
  readonly offset: number;
  readonly code: number;
  readonly name: string;
  readonly hasLength: boolean;
  /** Declared `Length` when `hasLength`, else the table's payload length (0 for fixed ops). */
  readonly length: number;
  /** Block-relative offset just past the record. */
  readonly end: number;
  /** `true` when the record's declared payload overruns the block (R004). */
  readonly overrun: boolean;
  /** `true` when the length field itself could not be read (R000/SF0400). */
  readonly truncated: boolean;
  /** `true` for the R016 exceptions (0x89/0x2D). */
  readonly observed: boolean;
}

export interface ScanResult {
  readonly records: readonly ActionRecord[];
  /** `true` when an `End` (0x00) record was present. */
  readonly terminated: boolean;
  /** Where scanning stopped, block-relative (the block end unless a fatal stop cut it short). */
  readonly stoppedAt: number;
  /** `true` when a `SF0400`/`SF0401` desynchronised the stream — the block is untrusted (R004). */
  readonly desync: boolean;
}

function hexDump(bytes: Uint8Array, from: number, count: number): string {
  const end = Math.min(bytes.length, from + count);
  const parts: string[] = [];
  for (let i = from; i < end; i += 1) {
    parts.push((bytes[i] ?? 0).toString(16).padStart(2, '0'));
  }
  return parts.join(' ');
}

/**
 * Walks a block's byte range, framing every record. Never throws: every malformed shape is
 * reported through `emit` and the scan stops with `desync` or a tolerated diagnostic.
 */
export interface ScanOptions {
  /**
   * `true` (default): a missing `End` is `SF0420` (R006, tolerated). Region bodies are
   * length-delimited and contain no `End` at all (R008), so they scan with `requireEnd: false`.
   */
  readonly requireEnd?: boolean;
}

export function scanRecords(bytes: Uint8Array, emit: Emit, options: ScanOptions = {}): ScanResult {
  const requireEnd = options.requireEnd ?? true;
  const records: ActionRecord[] = [];
  let terminated = false;
  let desync = false;
  let pos = 0;
  const length = bytes.length;

  while (pos < length) {
    const offset = pos;
    const code = bytes[pos] ?? 0;
    pos += 1;

    if (code >= 0x80) {
      if (pos + 2 > length) {
        emit(
          Codes.ACTION_STREAM_TRUNCATED,
          'error',
          `opcode 0x${code.toString(16)} at block offset ${offset} has no room for its Length field`,
          offset,
        );
        // Leave a stub record so the tier pass can still see the truncation (R000).
        const spec = opcode(code);
        records.push({
          offset,
          code,
          name: spec?.name ?? 'Unknown',
          hasLength: true,
          length: 0,
          end: length,
          overrun: false,
          truncated: true,
          observed: false,
        });
        desync = true;
        break;
      }
      const declared = (bytes[pos] ?? 0) | ((bytes[pos + 1] ?? 0) << 8);
      const end = pos + 2 + declared;
      pos += 2;
      if (end > length) {
        emit(
          Codes.ACTION_RECORD_OVERRUN,
          'error',
          `opcode 0x${code.toString(16)} at block offset ${offset} declares ${declared} payload byte(s) but only ${length - pos} remain`,
          offset,
        );
        const spec = opcode(code);
        records.push({
          offset,
          code,
          name: spec?.name ?? 'Unknown',
          hasLength: true,
          length: declared,
          end: length,
          overrun: true,
          truncated: false,
          observed: spec?.observed === true,
        });
        desync = true;
        break;
      }
      const spec = opcode(code);
      records.push({
        offset,
        code,
        name: spec?.name ?? 'Unknown',
        hasLength: true,
        length: declared,
        end,
        overrun: false,
        truncated: false,
        observed: spec?.observed === true,
      });
      pos = end;
    } else {
      if (code === 0x00) {
        terminated = true;
        records.push({
          offset,
          code,
          name: 'End',
          hasLength: false,
          length: 0,
          end: pos,
          overrun: false,
          truncated: false,
          observed: false,
        });
        continue;
      }
      const spec = opcode(code);
      if (spec === undefined) {
        // R005/R007: an undefined sub-0x80 code is a zero-payload unknown record — it still
        // advances the stream by one byte, and the whole function becomes residual.
        emit(
          Codes.UNKNOWN_OPCODE,
          'warning',
          `undefined opcode 0x${code.toString(16).padStart(2, '0')} at block offset ${offset}: ${hexDump(bytes, offset, 32)}`,
          offset,
        );
        records.push({
          offset,
          code,
          name: 'Unknown',
          hasLength: false,
          length: 0,
          end: pos,
          overrun: false,
          truncated: false,
          observed: false,
        });
        continue;
      }
      if (spec.observed) {
        emit(
          Codes.UNKNOWN_OPCODE,
          'warning',
          `observed-but-undocumented opcode 0x${code.toString(16).padStart(2, '0')} (${spec.name}) at block offset ${offset}; semantics inert`,
          offset,
        );
      }
      records.push({
        offset,
        code,
        name: spec.name,
        hasLength: false,
        length: 0,
        end: pos,
        overrun: false,
        truncated: false,
        observed: spec.observed === true,
      });
    }
  }

  // Region bodies are length-delimited and contain no `End` at all (R008), so the missing-End
  // tolerance only applies to real blocks.
  if (!terminated && requireEnd) {
    emit(
      Codes.ACTION_BLOCK_TERMINATOR,
      'warning',
      'action block has no terminating End (0x00); tolerated (R006)',
      length,
    );
  }
  return { records, terminated, stoppedAt: length, desync };
}

export { isDefinedCode };
