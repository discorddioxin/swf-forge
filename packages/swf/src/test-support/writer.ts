/**
 * Test-support byte writer — `IMPL-140` §2 (deterministic fixtures).
 *
 * Tests build their SWF bytes through this writer rather than pasting hex, so a fixture stays
 * readable and a spec change is a one-line edit here. Nothing in `src/` imports this module: it is a
 * separate entry point (`./test-support`) and ships only to the test graph.
 */

import type { Rect } from '../io/types.js';

/** MSB-first bit writer with byte-level helpers. Little-endian for `u16`/`u32`. */
export class ByteWriter {
  readonly #out: number[] = [];
  #partial = 0;
  #bitCount = 0;

  get length(): number {
    return this.#out.length + (this.#bitCount > 0 ? 1 : 0);
  }

  u8(value: number): this {
    this.align();
    this.#out.push(value & 0xff);
    return this;
  }

  u16(value: number): this {
    return this.u8(value & 0xff).u8((value >>> 8) & 0xff);
  }

  s16(value: number): this {
    return this.u16(value & 0xffff);
  }

  u32(value: number): this {
    return this.u16(value & 0xffff).u16((value >>> 16) & 0xffff);
  }

  s32(value: number): this {
    return this.u32(value >>> 0);
  }

  bytes(source: ArrayLike<number>): this {
    this.align();
    for (let i = 0; i < source.length; i += 1) {
      this.#out.push((source[i] ?? 0) & 0xff);
    }
    return this;
  }

  /** NUL-terminated ASCII/Latin-1 string. */
  text(value: string): this {
    for (let i = 0; i < value.length; i += 1) {
      this.u8(value.charCodeAt(i));
    }
    return this.u8(0);
  }

  /** `count` bits of `value`, most-significant first. */
  bits(value: number, count: number): this {
    for (let i = count - 1; i >= 0; i -= 1) {
      this.#partial = ((this.#partial << 1) | ((value >> i) & 1)) & 0xff;
      this.#bitCount += 1;
      if (this.#bitCount === 8) {
        this.#out.push(this.#partial);
        this.#partial = 0;
        this.#bitCount = 0;
      }
    }
    return this;
  }

  align(): this {
    if (this.#bitCount > 0) {
      this.#out.push((this.#partial << (8 - this.#bitCount)) & 0xff);
      this.#partial = 0;
      this.#bitCount = 0;
    }
    return this;
  }

  toUint8Array(): Uint8Array {
    const aligned = this.#bitCount > 0 ? this.#out.concat((this.#partial << (8 - this.#bitCount)) & 0xff) : this.#out;
    return Uint8Array.from(aligned);
  }
}

const NBITS_MIN = 1;

/** `RECT` (`IMPL-010` §5.6): `Nbits UB[5]` then four `SB[Nbits]`, zero-padded to a byte. */
export function writeRect(w: ByteWriter, rect: Rect): ByteWriter {
  const values = [rect.xMin, rect.xMax, rect.yMin, rect.yMax];
  let bits = NBITS_MIN;
  for (const value of values) {
    let needed = 1;
    while (needed < 32 && (value >= 1 << (needed - 1) || value < -(1 << (needed - 1)))) needed += 1;
    if (needed > bits) bits = needed;
  }
  w.bits(bits, 5);
  for (const value of values) w.bits(value < 0 ? value + (1 << bits) : value, bits);
  return w.align();
}

/**
 * A tag: `UI16` little-endian (`code << 6 | length`), with the long form when the body does not fit
 * in the six-bit length field (`IMPL-020` §4.1).
 */
export function tag(
  code: number,
  body: Uint8Array = new Uint8Array(0),
  options: { forceLong?: boolean } = {},
): Uint8Array {
  const w = new ByteWriter();
  const long = options.forceLong === true || body.length >= 0x3f;
  if (long) {
    w.u16((code << 6) | 0x3f).u32(body.length);
  } else {
    w.u16((code << 6) | body.length);
  }
  return w.bytes(body).toUint8Array();
}

export function showFrames(count: number): Uint8Array {
  const w = new ByteWriter();
  for (let i = 0; i < count; i += 1) w.bytes(tag(1));
  return w.toUint8Array();
}

export function endTag(): Uint8Array {
  return tag(0);
}

/** Deliberate corruptions the fixture writer can emit (`IMPL-020-R037`). */
export type WriterDefect = 'missing-end' | 'bad-file-length' | 'overlong-encoded-u32' | 'out-of-order-stream';

export interface SwfFixtureOptions {
  readonly version?: number;
  /** Header frame size in twips; defaults to 550 × 400 px. */
  readonly frameSize?: Rect;
  /** Frames per second as written (`8.8` fixed) — 12 by default. */
  readonly frameRateRaw?: number;
  readonly frameCount?: number;
  /** Tag stream, including the `End` tag. */
  readonly body: Uint8Array;
  /** Compress the tag stream: `CWS` (zlib) or `ZWS` (LZMA). Requires `compressor`. */
  readonly compression?: 'none' | 'zlib' | 'lzma';
  /** The compressor (e.g. `node:zlib` `deflateSync`, or the `lzma` package — LZMA_alone). */
  readonly compressor?: (payload: Uint8Array) => Uint8Array;
  /** For `lzma`: the advisory `compressedLength` UI32 to write (defaults to the actual length). */
  readonly zwsLengthOverride?: number;
  /** Deliberate corruptions (applied to the tag stream before compression). */
  readonly defects?: readonly WriterDefect[];
}

/** A definition tag: `UI16 CharacterId` + the tag's own body. */
export function defineTag(code: number, id: number, body: Uint8Array = new Uint8Array(0)): Uint8Array {
  const w = new ByteWriter();
  return tag(code, w.u16(id).bytes(body).toUint8Array());
}

/** `PlaceObject` (4) v1: `CharacterId`, `Depth`, an empty (zero) matrix. */
export function placeObjectV1(characterId: number, depth: number): Uint8Array {
  const w = new ByteWriter();
  return tag(4, w.u16(characterId).u16(depth).u8(0).toUint8Array());
}

/** `PlaceObject2` (26): `HasCharacter | HasMatrix` flags, `Depth`, `CharacterId`, zero matrix. */
export function placeObject2(characterId: number, depth: number): Uint8Array {
  const w = new ByteWriter();
  return tag(26, w.u8(0x06).u16(depth).u16(characterId).u8(0).toUint8Array());
}

/** `StartSound` (15): `SoundId` + a minimal `SOUNDINFO` (event, no loops, no envelope). */
export function startSound(id: number): Uint8Array {
  const w = new ByteWriter();
  return tag(15, w.u16(id).u8(0x01).u8(0).u16(0).u16(0).u8(0).toUint8Array());
}

/** `DefineSprite` (39): `SpriteID`, `FrameCount`, the sprite's tags (including its `End`). */
export function defineSprite(id: number, frameCount: number, inner: Uint8Array): Uint8Array {
  const w = new ByteWriter();
  return tag(39, w.u16(id).u16(frameCount).bytes(inner).toUint8Array());
}

/** `SoundStreamHead` (18) with an empty `SOUNDSTREAMHEAD2`-free v1 body. */
export function soundStreamHead(): Uint8Array {
  const w = new ByteWriter();
  return tag(18, w.u8(0).u8(0).u8(0).u8(0).u8(0).u32(0).toUint8Array());
}

/** `SoundStreamBlock` (19) with a single zero data byte. */
export function soundStreamBlock(): Uint8Array {
  return tag(19, new Uint8Array([0]));
}

/** Applies the R037 defects to a tag stream. */
function applyDefects(body: Uint8Array, defects: readonly WriterDefect[]): Uint8Array {
  let out = body;
  for (const defect of defects) {
    switch (defect) {
      case 'missing-end': {
        // Drop the trailing two-byte `End` tag when present.
        if (out.length >= 2 && (out[out.length - 1] ?? 0) === 0 && (out[out.length - 2] ?? 0) === 0) {
          out = out.subarray(0, out.length - 2);
        }
        break;
      }
      case 'out-of-order-stream': {
        // A SoundStreamBlock before its SoundStreamHead, just before the End.
        out = concat(out, soundStreamBlock(), soundStreamHead());
        break;
      }
      case 'overlong-encoded-u32': {
        // DefineSceneAndFrameLabelData whose scene count is a 5-byte (overlong) zero EncodedU32.
        const w = new ByteWriter();
        out = concat(out, tag(86, w.bytes([0, 0, 0, 0, 0x80]).u8(0).toUint8Array()));
        break;
      }
      case 'bad-file-length':
        break; // applied to the header below
    }
  }
  return out;
}

const SIGNATURES: Readonly<Record<'none' | 'zlib' | 'lzma', [number, number, number]>> = {
  none: [0x46, 0x57, 0x53], // FWS
  zlib: [0x43, 0x57, 0x53], // CWS
  lzma: [0x5a, 0x57, 0x53], // ZWS
};

/**
 * Builds an SWF file (FWS by default, CWS/ZWS with `compression` + `compressor`).
 *
 * The *decompressed* stream is always `RECT` + `FrameRate` + `FrameCount` + the tag stream; for
 * `CWS`/`ZWS` the whole stream is what gets compressed (the 8-byte base header is stored raw).
 * `FileLength` is the decompressed length in every form.
 */
export function buildSwf(options: SwfFixtureOptions): Uint8Array {
  const version = options.version ?? 6;
  const frameSize = options.frameSize ?? { xMin: 0, xMax: 11000, yMin: 0, yMax: 8000 };
  const frameRateRaw = options.frameRateRaw ?? 12 * 256;
  const frameCount = options.frameCount ?? 1;
  const defects = options.defects ?? [];
  const compression = options.compression ?? 'none';

  const body = applyDefects(options.body, defects);

  const decompressed = new ByteWriter();
  writeRect(decompressed, frameSize);
  decompressed.u16(frameRateRaw).u16(frameCount);
  decompressed.bytes(body);
  const stream = decompressed.toUint8Array();

  let payload: Uint8Array;
  if (compression === 'none') {
    payload = stream;
  } else {
    if (options.compressor === undefined) throw new Error(`buildSwf: compression "${compression}" needs a compressor`);
    if (compression === 'lzma') {
      // The compressor emits `LZMA_alone` (5 property bytes + data). The ZWS base carries an
      // advisory `compressedLength` before the properties; open.ts expects it to equal the
      // property+data length it will hand to the decoder.
      const alone = options.compressor(stream);
      const w = new ByteWriter();
      w.u32(options.zwsLengthOverride ?? alone.length);
      w.bytes(alone);
      payload = w.toUint8Array();
    } else {
      payload = options.compressor(stream);
    }
  }

  const [s0, s1, s2] = SIGNATURES[compression];
  let fileLength = 8 + stream.length;
  if (defects.includes('bad-file-length')) fileLength += 10;
  const result = new Uint8Array(8 + payload.length);
  result[0] = s0;
  result[1] = s1;
  result[2] = s2;
  result[3] = version;
  result[4] = fileLength & 0xff;
  result[5] = (fileLength >>> 8) & 0xff;
  result[6] = (fileLength >>> 16) & 0xff;
  result[7] = (fileLength >>> 24) & 0xff;
  result.set(payload, 8);
  return result;
}

/**
 * A `DoAction`-style action block: a `UI32` `Length` then the record bytes. An `End` (0x00) is
 * appended when the caller did not supply one. (`IMPL-050-R003`/`R006`.)
 */
export function actionBlock(records: readonly number[]): Uint8Array {
  const body = [...records];
  if (body.length === 0 || body[body.length - 1] !== 0x00) body.push(0x00);
  const w = new ByteWriter();
  w.u32(body.length);
  for (const b of body) w.bytes(Uint8Array.from([b]));
  return w.toUint8Array();
}

/** Minimal valid file: header, one `ShowFrame`, `End`. */
export function minimalSwf(options: Omit<SwfFixtureOptions, 'body'> = {}): Uint8Array {
  return buildSwf({ ...options, body: concat(showFrames(1), endTag()) });
}

export function concat(...parts: readonly Uint8Array[]): Uint8Array {
  let total = 0;
  for (const part of parts) total += part.length;
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}
