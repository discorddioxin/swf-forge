/**
 * `Cursor` — `IMPL-010` §3.1, §4.
 *
 * A bounds-checked reader over a byte buffer. One instance per parse; never shared across tags.
 * Byte order: little-endian for every integer. Bit order: MSB-first inside each byte.
 * Bounds policy: `soft` records `SF0013` and yields 0, `strict` throws `SwfReadError`.
 */

import { Codes } from '../diagnostics/codes.js';
import { DiagnosticSink } from '../diagnostics/sink.js';
import type { Code } from '../diagnostics/codes.js';
import type { Diagnostic, Severity } from '../diagnostics/types.js';
import { SwfReadError } from './errors.js';
import { encodedU32, s8, s16, s32, s64, u16, u24, u32, u64 } from './integers.js';
import { fixed16_16, fixed8_8, float16 } from './real.js';
import { maskFor, signExtend } from './bits.js';
import { decodeString, type StringReadOptions } from './strings.js';

export interface CursorOptions {
  /** 'soft' (default) records a diagnostic and yields 0; 'strict' throws SwfReadError. */
  mode?: 'soft' | 'strict';
  /** Diagnostics sink to append to (defaults to the cursor's own). */
  sink?: DiagnosticSink;
  /** Used in diagnostic scopes, e.g. "RECT in FrameSize". */
  context?: string;
  /** Report discarded non-zero padding bits at `align()` (`SF0008`, `--strict-bits`). */
  reportPaddingBits?: boolean;
  /** Movie version, for string decoding. */
  version?: number;
  /** Fallback encoding for legacy strings (`IMPL-010-R023`). */
  legacyEncoding?: 'windows-1252' | 'latin1' | 'shift-jis';
  /** Tag being decoded: attached to every diagnostic this cursor emits. */
  tagCode?: number;
  /** Character (or sprite) owning the bytes, for per-character report grouping. */
  characterId?: number;
}

export class Cursor {
  readonly bytes: Uint8Array;
  #pos: number;
  #bit = 0;
  readonly limit: number;
  readonly mode: 'soft' | 'strict';
  readonly sink: DiagnosticSink;
  readonly context: string;
  readonly reportPaddingBits: boolean;
  version: number;
  legacyEncoding: 'windows-1252' | 'latin1' | 'shift-jis';
  readonly tagCode: number | undefined;
  readonly characterId: number | undefined;

  constructor(bytes: Uint8Array, offset = 0, limit = bytes.length, opts: CursorOptions = {}) {
    this.bytes = bytes;
    this.#pos = offset;
    this.limit = limit;
    this.mode = opts.mode ?? 'soft';
    this.sink = opts.sink ?? new DiagnosticSink();
    this.context = opts.context ?? '';
    this.reportPaddingBits = opts.reportPaddingBits ?? false;
    this.version = opts.version ?? 6;
    this.legacyEncoding = opts.legacyEncoding ?? 'windows-1252';
    this.tagCode = opts.tagCode;
    this.characterId = opts.characterId;
  }

  get offset(): number {
    return this.#pos;
  }

  get bitOffset(): number {
    return this.#bit;
  }

  get remaining(): number {
    return Math.max(0, this.limit - this.#pos);
  }

  get isByteAligned(): boolean {
    return this.#bit === 0;
  }

  get diagnostics(): readonly Diagnostic[] {
    return this.sink.list();
  }

  /** A bounded window sharing this buffer (zero copy). The parent position is untouched. */
  subCursor(length: number, opts: CursorOptions = {}): Cursor {
    const start = this.#pos;
    const available = Math.max(0, this.limit - start);
    const requested = Number.isFinite(length) ? Math.trunc(length) : 0;
    const clampedLength = Math.min(Math.max(0, requested), available);
    if (!Number.isFinite(length) || requested !== length || requested < 0 || requested > available) {
      this.emit(
        Codes.READ_PAST_BOUNDS,
        'warning',
        `subCursor requested ${String(length)} byte(s); clamped to ${clampedLength} byte(s) (${available} remain)`,
        start,
      );
    }
    const end = start + clampedLength;
    const sub = new Cursor(this.bytes, start, end, {
      mode: opts.mode ?? this.mode,
      sink: opts.sink ?? this.sink,
      context: opts.context ?? this.context,
      reportPaddingBits: opts.reportPaddingBits ?? this.reportPaddingBits,
      version: opts.version ?? this.version,
      legacyEncoding: opts.legacyEncoding ?? this.legacyEncoding,
      ...(opts.tagCode !== undefined
        ? { tagCode: opts.tagCode }
        : this.tagCode !== undefined
          ? { tagCode: this.tagCode }
          : {}),
      ...(opts.characterId !== undefined
        ? { characterId: opts.characterId }
        : this.characterId !== undefined
          ? { characterId: this.characterId }
          : {}),
    });
    return sub;
  }

  /** Advance the parent to the end of a sub-cursor created from it. */
  advanceTo(cursor: Cursor): void {
    this.#pos = cursor.offset;
    this.#bit = cursor.bitOffset;
  }

  emit(
    code: Code,
    severity: Severity,
    message: string,
    offset = this.#pos,
    extra: Partial<Pick<Diagnostic, 'tagCode' | 'decision' | 'context'>> & { characterId?: number | null } = {},
  ): void {
    this.sink.emit({
      code,
      severity,
      message,
      offset,
      context: extra.context ?? this.context,
      ...(extra.characterId === null
        ? {}
        : extra.characterId !== undefined
          ? { characterId: extra.characterId }
          : this.characterId !== undefined
            ? { characterId: this.characterId }
            : {}),
      ...(extra.tagCode !== undefined
        ? { tagCode: extra.tagCode }
        : this.tagCode !== undefined
          ? { tagCode: this.tagCode }
          : {}),
      ...(extra.decision !== undefined ? { decision: extra.decision } : {}),
    });
  }

  /** Bounds guard for byte-aligned reads of `n` bytes. Returns false when short. */
  #need(n: number): boolean {
    if (this.#pos + n > this.limit) {
      this.#outOfBounds(`read of ${n} byte(s) at offset ${this.#pos} past limit ${this.limit}`);
      return false;
    }
    return true;
  }

  #outOfBounds(message: string): void {
    const offset = this.#pos;
    this.emit(Codes.READ_PAST_BOUNDS, 'warning', message, offset);
    if (this.mode === 'strict') {
      throw new SwfReadError(Codes.READ_PAST_BOUNDS, message, offset, this.context);
    }
    this.#pos = this.limit;
    this.#bit = 0;
  }

  #validBitWidth(bits: number): boolean {
    if (Number.isInteger(bits) && bits >= 0 && bits <= 32) return true;
    const message = `bit field width ${String(bits)} is outside the supported range 0..32`;
    if (this.mode === 'strict') {
      throw new SwfReadError(Codes.BIT_WIDTH_TOO_WIDE, message, this.#pos, this.context);
    }
    this.emit(Codes.VALUE_OUT_OF_RANGE, 'info', message, this.#pos);
    return false;
  }

  takeBytes(length: number): Uint8Array {
    if (!this.#need(length)) return new Uint8Array(0);
    const copy = this.bytes.slice(this.#pos, this.#pos + length);
    this.#pos += length;
    return copy;
  }

  viewBytes(length: number): Uint8Array {
    if (!this.#need(length)) return new Uint8Array(0);
    const view = this.bytes.subarray(this.#pos, this.#pos + length);
    this.#pos += length;
    return view;
  }

  rest(): Uint8Array {
    const copy = this.bytes.slice(this.#pos, this.limit);
    this.#pos = this.limit;
    return copy;
  }

  seek(absoluteOffset: number): void {
    this.#pos = Math.max(0, absoluteOffset);
    this.#bit = 0;
  }

  skip(bytes: number): void {
    this.#pos += bytes;
    this.#bit = 0;
  }

  /** Discard remaining bits in the current byte (padding per Ch.1). */
  align(): void {
    if (this.#bit === 0) return;
    const discarded = this.#bit;
    const byte = this.bytes[this.#pos] ?? 0;
    const padding = byte & maskFor(discarded);
    if (padding !== 0 && this.reportPaddingBits) {
      this.emit(Codes.PADDING_BITS_DISCARDED, 'warning', `non-zero padding bits (${discarded} bit(s)) discarded`);
    }
    this.#bit = 0;
    this.#pos += 1;
  }

  // ---- byte-aligned readers -------------------------------------------------------------------

  u8(): number {
    if (!this.#need(1)) return 0;
    const v = this.bytes[this.#pos] ?? 0;
    this.#pos += 1;
    return v;
  }

  s8(): number {
    if (!this.#need(1)) return 0;
    const v = s8(this.bytes, this.#pos);
    this.#pos += 1;
    return v;
  }

  u16(): number {
    if (!this.#need(2)) return 0;
    const v = u16(this.bytes, this.#pos);
    this.#pos += 2;
    return v;
  }

  s16(): number {
    if (!this.#need(2)) return 0;
    const v = s16(this.bytes, this.#pos);
    this.#pos += 2;
    return v;
  }

  u24(): number {
    if (!this.#need(3)) return 0;
    const v = u24(this.bytes, this.#pos);
    this.#pos += 3;
    return v;
  }

  u32(): number {
    if (!this.#need(4)) return 0;
    const v = u32(this.bytes, this.#pos);
    this.#pos += 4;
    return v;
  }

  s32(): number {
    if (!this.#need(4)) return 0;
    const v = s32(this.bytes, this.#pos);
    this.#pos += 4;
    return v;
  }

  u64(): bigint {
    if (!this.#need(8)) return 0n;
    const v = u64(this.bytes, this.#pos);
    this.#pos += 8;
    return v;
  }

  s64(): bigint {
    if (!this.#need(8)) return 0n;
    const v = s64(this.bytes, this.#pos);
    this.#pos += 8;
    return v;
  }

  /** 32-bit 16.16 fixed point. */
  fixed(): number {
    return fixed16_16(this.s32());
  }

  /** 16-bit 8.8 fixed point. */
  fixed8(): number {
    return fixed8_8(this.s16());
  }

  /** IEEE binary16 -> float64. */
  float16(): number {
    const raw = this.u16();
    const { value, special } = float16(raw);
    if (special !== 'none') {
      this.emit(Codes.FLOAT16_SPECIAL, 'info', `FLOAT16 ${special} payload 0x${raw.toString(16)} canonicalised`);
    }
    return value;
  }

  float32(): number {
    if (!this.#need(4)) return 0;
    const v = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.#pos, 4).getFloat32(0, true);
    this.#pos += 4;
    return v;
  }

  float64(): number {
    if (!this.#need(8)) return 0;
    const v = new DataView(this.bytes.buffer, this.bytes.byteOffset + this.#pos, 8).getFloat64(0, true);
    this.#pos += 8;
    return v;
  }

  /** Little-endian base-128, 1–5 bytes (`IMPL-010-R013`). */
  encodedU32(): number {
    const at = this.#pos;
    const res = encodedU32(this.bytes, at);
    this.#pos += res.bytesRead;
    if (res.overlong || res.overflow || res.danglingContinuation) {
      const what = res.overflow
        ? 'value exceeds 32 bits'
        : res.danglingContinuation
          ? 'continuation bit set on the 5th byte'
          : 'encoding longer than necessary';
      this.emit(Codes.ENCODED_U32_OVERLONG, 'info', `EncodedU32 ${what} at offset ${at}`);
    }
    return res.value;
  }

  /** NUL-terminated string (`IMPL-010-R021`–`R025`). Reads up to and including the terminator. */
  string(opts: StringReadOptions = {}): string {
    const start = this.#pos;
    let end = start;
    while (end < this.limit && (this.bytes[end] ?? 0) !== 0) {
      end += 1;
    }
    const raw = this.bytes.subarray(start, end);
    const terminated = end < this.limit;
    this.#pos = terminated ? end + 1 : this.limit;

    const { decoded, truncated } = decodeString(raw, {
      version: opts.version ?? this.version,
      ...((opts.legacyEncoding ?? this.legacyEncoding)
        ? { legacyEncoding: opts.legacyEncoding ?? this.legacyEncoding }
        : {}),
      ...(opts.maxBytes !== undefined ? { maxBytes: opts.maxBytes } : {}),
    });

    if (truncated) {
      this.emit(Codes.STRING_TRUNCATED, 'warning', `string truncated at ${opts.maxBytes ?? 65536} bytes`, start);
    }
    if (decoded.invalidUtf8) {
      this.emit(Codes.INVALID_UTF8, 'warning', 'invalid UTF-8 replaced with U+FFFD', start);
    }
    if (decoded.encoding !== 'utf-8') {
      this.emit(Codes.LEGACY_STRING_ENCODING, 'info', `legacy string decoded as ${decoded.encoding}`, start);
    }
    return decoded.value;
  }

  // ---- bit readers ----------------------------------------------------------------------------

  ub(bits: number): number {
    if (!this.#validBitWidth(bits) || bits === 0) return 0;
    const bytesNeeded = Math.ceil((this.#bit + bits) / 8);
    if (this.#pos + bytesNeeded > this.limit) {
      this.#outOfBounds(`bit read of ${bits} bit(s) at offset ${this.#pos} past limit ${this.limit}`);
      return 0;
    }
    let value = 0;
    let remaining = bits;
    while (remaining > 0) {
      const byte = this.bytes[this.#pos] ?? 0;
      const available = 8 - this.#bit;
      const take = Math.min(available, remaining);
      const shift = available - take;
      const chunk = (byte >> shift) & maskFor(take);
      value = value * 2 ** take + chunk;
      this.#bit += take;
      remaining -= take;
      if (this.#bit === 8) {
        this.#bit = 0;
        this.#pos += 1;
      }
    }
    return value;
  }

  /** Two's-complement bit field (`IMPL-010-R016`). */
  sb(bits: number): number {
    if (!this.#validBitWidth(bits)) return 0;
    return signExtend(this.ub(bits), bits);
  }

  /** Fixed-point bit field with `bits - 16` integer bits (`IMPL-010-R017`). */
  fb(bits: number): number {
    if (!this.#validBitWidth(bits)) return 0;
    return signExtend(this.ub(bits), bits) / 65536;
  }
}
