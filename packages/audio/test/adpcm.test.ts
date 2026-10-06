/** T-AUD-002/004/101/102: frozen SWF ADPCM vectors, packet framing and truncation behavior. */

import { describe, expect, it } from 'vitest';

import { decodeSwfAdpcm } from '../src/codecs/adpcm.js';
import { SWF_ADPCM_INDEX_TABLES, SWF_ADPCM_STEP_TABLE } from '../src/codecs/adpcm-tables.js';

class BitWriter {
  readonly #bytes: number[] = [];
  #partial = 0;
  #count = 0;

  bits(value: number, width: number): this {
    for (let i = width - 1; i >= 0; i -= 1) {
      this.#partial = ((this.#partial << 1) | ((value >>> i) & 1)) & 0xff;
      this.#count += 1;
      if (this.#count === 8) {
        this.#bytes.push(this.#partial);
        this.#partial = 0;
        this.#count = 0;
      }
    }
    return this;
  }

  signed(value: number, width: number): this {
    return this.bits(value < 0 ? 2 ** width + value : value, width);
  }

  align(): this {
    if (this.#count > 0) {
      this.#bytes.push((this.#partial << (8 - this.#count)) & 0xff);
      this.#partial = 0;
      this.#count = 0;
    }
    return this;
  }

  toBytes(): Uint8Array {
    this.align();
    return Uint8Array.from(this.#bytes);
  }
}

function soundData(
  bits: 2 | 3 | 4 | 5,
  headers: readonly { readonly sample: number; readonly index: number }[],
  codeFrames: readonly (readonly number[])[],
): Uint8Array {
  const writer = new BitWriter().bits(bits - 2, 2);
  for (const header of headers) writer.signed(header.sample, 16).bits(header.index, 6);
  for (const frame of codeFrames) for (const code of frame) writer.bits(code, bits);
  return writer.toBytes();
}

const monoCodes: Readonly<Record<2 | 3 | 4 | 5, readonly number[]>> = {
  2: [1, 2, 0, 3],
  3: [1, 4, 2, 7],
  4: [3, 11, 6, 15],
  5: [7, 23, 12, 31],
};

const monoReference: Readonly<Record<2 | 3 | 4 | 5, readonly number[]>> = {
  2: [1000, 1010, 1006, 1010, 1000],
  3: [1000, 1005, 1004, 1012, 997],
  4: [1000, 1006, 1000, 1011, 987],
  5: [1000, 1006, 1000, 1010, 979],
};

const stereoCodes: Readonly<Record<2 | 3 | 4 | 5, readonly (readonly number[])[]>> = {
  2: [
    [1, 3],
    [0, 2],
    [3, 1],
    [2, 0],
  ],
  3: [
    [1, 7],
    [0, 4],
    [7, 1],
    [4, 0],
  ],
  4: [
    [1, 15],
    [0, 8],
    [15, 1],
    [8, 0],
  ],
  5: [
    [1, 31],
    [0, 16],
    [31, 1],
    [16, 0],
  ],
};

const stereoReference: Readonly<Record<2 | 3 | 4 | 5, readonly (readonly number[])[]>> = {
  2: [
    [1000, 1010, 1014, 1002, 997],
    [-1000, -1010, -1014, -1002, -997],
  ],
  3: [
    [1000, 1005, 1006, 994, 992],
    [-1000, -1012, -1014, -1007, -1005],
  ],
  4: [
    [1000, 1002, 1002, 989, 987],
    [-1000, -1013, -1015, -1010, -1009],
  ],
  5: [
    [1000, 1001, 1001, 988, 986],
    [-1000, -1013, -1015, -1010, -1009],
  ],
};

const REFERENCE_STEP_TABLE = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118,
  130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060,
  1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5360, 5897, 6487,
  7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
] as const;
const REFERENCE_INDEX_TABLES: Readonly<Record<2 | 3 | 4 | 5, readonly number[]>> = {
  2: [-1, 2],
  3: [-1, -1, 2, 4],
  4: [-1, -1, -1, -1, 2, 4, 6, 8],
  5: [-1, -1, -1, -1, -1, -1, -1, -1, 1, 2, 4, 6, 8, 10, 13, 16],
};

class ReferenceBitReader {
  #position = 0;

  constructor(readonly bytes: Uint8Array) {}

  read(width: number): number {
    let value = 0;
    for (let bit = 0; bit < width; bit += 1) {
      const position = this.#position++;
      value = (value << 1) | (((this.bytes[position >>> 3] ?? 0) >>> (7 - (position & 7))) & 1);
    }
    return value;
  }
}

function referenceDecode(bytes: Uint8Array, channels: 1 | 2, sampleCount: number): readonly Int16Array[] {
  const reader = new ReferenceBitReader(bytes);
  const bits = (reader.read(2) + 2) as 2 | 3 | 4 | 5;
  const sign = 1 << (bits - 1);
  const output = Array.from({ length: channels }, () => new Int16Array(sampleCount));
  let written = 0;
  while (written < sampleCount) {
    const prediction: number[] = [];
    const index: number[] = [];
    for (let channel = 0; channel < channels; channel += 1) {
      const raw = reader.read(16);
      prediction.push(raw >= 0x8000 ? raw - 0x10000 : raw);
      index.push(reader.read(6));
      const plane = output[channel];
      if (plane) plane[written] = prediction[channel] ?? 0;
    }
    written += 1;
    const framesInPacket = Math.min(4096, sampleCount - (written - 1));
    for (let frameIndex = 1; frameIndex < framesInPacket; frameIndex += 1) {
      for (let channel = 0; channel < channels; channel += 1) {
        const code = reader.read(bits);
        const magnitude = code & (sign - 1);
        const step = REFERENCE_STEP_TABLE[index[channel] ?? 0] ?? 7;
        const delta = Math.floor(((2 * magnitude + 1) * step) / 2 ** (bits - 1));
        const direction = code & sign ? -1 : 1;
        prediction[channel] = Math.max(-32768, Math.min(32767, (prediction[channel] ?? 0) + direction * delta));
        const table = REFERENCE_INDEX_TABLES[bits];
        index[channel] = Math.max(0, Math.min(88, (index[channel] ?? 0) + (table[magnitude] ?? -1)));
        const plane = output[channel];
        if (plane) plane[written + frameIndex - 1] = prediction[channel] ?? 0;
      }
    }
    written += framesInPacket - 1;
  }
  return output;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };
}

describe('SWF ADPCM', () => {
  it('T-AUD-002 / T-AUD-101: decodes frozen mono vectors at all four code widths', () => {
    for (const bits of [2, 3, 4, 5] as const) {
      const bytes = soundData(
        bits,
        [{ sample: 1000, index: 0 }],
        monoCodes[bits].map((code) => [code]),
      );
      const decoded = decodeSwfAdpcm(bytes, { channels: 1, sampleCount: 5 });
      expect(decoded.bitsPerCode).toBe(bits);
      expect(decoded.decodedSampleCount).toBe(5);
      expect(decoded.truncated).toBe(false);
      expect(Array.from(decoded.channels[0] ?? [])).toEqual(monoReference[bits]);
    }
  });

  it('T-AUD-002 / T-AUD-101: decodes stereo codes L/R interleaved with independent predictors', () => {
    for (const bits of [2, 3, 4, 5] as const) {
      const bytes = soundData(
        bits,
        [
          { sample: 1000, index: 0 },
          { sample: -1000, index: 0 },
        ],
        stereoCodes[bits],
      );
      const decoded = decodeSwfAdpcm(bytes, { channels: 2, sampleCount: 5 });
      expect(decoded.truncated).toBe(false);
      expect(decoded.channels.map((channel) => Array.from(channel))).toEqual(stereoReference[bits]);
    }
  });

  it('T-AUD-101: matches an independent integer reference on 200 seeded packets', () => {
    const random = seededRandom(0x53574631);
    for (let vector = 0; vector < 200; vector += 1) {
      const bits = ([2, 3, 4, 5] as const)[vector % 4] ?? 2;
      const channels = (vector % 2 === 0 ? 1 : 2) as 1 | 2;
      const sampleCount = 2 + (random() % 127);
      const headers = Array.from({ length: channels }, () => {
        const raw = random() & 0xffff;
        return { sample: raw >= 0x8000 ? raw - 0x10000 : raw, index: random() % 89 };
      });
      const codeFrames = Array.from({ length: sampleCount - 1 }, () =>
        Array.from({ length: channels }, () => random() % 2 ** bits),
      );
      const bytes = soundData(bits, headers, codeFrames);
      const expected = referenceDecode(bytes, channels, sampleCount);
      const actual = decodeSwfAdpcm(bytes, { channels, sampleCount });
      expect(actual.truncated, `packet ${vector} unexpectedly truncated`).toBe(false);
      expect(
        actual.channels.map((plane) => Array.from(plane)),
        `packet ${vector} differs from reference`,
      ).toEqual(expected.map((plane) => Array.from(plane)));
    }
  });

  it('T-AUD-102: starts a new predictor packet at the 4096-frame boundary', () => {
    const writer = new BitWriter().bits(0, 2); // 2-bit codes
    writer.signed(1000, 16).bits(0, 6);
    for (let i = 0; i < 4095; i += 1) writer.bits(2, 2); // negative zero-magnitude codes saturate low
    writer.signed(-2222, 16).bits(0, 6); // packet 2 restarts from its own header
    const decoded = decodeSwfAdpcm(writer.toBytes(), { channels: 1, sampleCount: 4097 });
    expect(decoded.decodedSampleCount).toBe(4097);
    expect(decoded.truncated).toBe(false);
    expect(decoded.channels[0]?.[0]).toBe(1000);
    expect(decoded.channels[0]?.[4095]).toBe(-11285);
    expect(decoded.channels[0]?.[4096]).toBe(-2222);
  });

  it('T-AUD-102: emits an exact-length zero-padded result for a truncated packet header', () => {
    const bytes = new BitWriter().bits(1, 2).toBytes();
    const decoded = decodeSwfAdpcm(bytes, { channels: 1, sampleCount: 32 });
    expect(decoded.sampleCount).toBe(32);
    expect(decoded.channels[0]).toHaveLength(32);
    expect(decoded.decodedSampleCount).toBe(0);
    expect(decoded.truncated).toBe(true);
    expect(Array.from(decoded.channels[0] ?? [])).toEqual(Array.from({ length: 32 }, () => 0));
  });

  it('T-AUD-004: pins the SWF/IMA reference table lengths and boundary entries', () => {
    expect(SWF_ADPCM_STEP_TABLE).toHaveLength(89);
    expect(SWF_ADPCM_STEP_TABLE[0]).toBe(7);
    expect(SWF_ADPCM_STEP_TABLE[88]).toBe(32767);
    expect(SWF_ADPCM_INDEX_TABLES[2]).toEqual([-1, 2]);
    expect(SWF_ADPCM_INDEX_TABLES[5]).toEqual([-1, -1, -1, -1, -1, -1, -1, -1, 1, 2, 4, 6, 8, 10, 13, 16]);
  });

  it('rejects impossible sample counts before allocating untrusted PCM buffers', () => {
    expect(() => decodeSwfAdpcm(new Uint8Array(), { channels: 2, sampleCount: 10, maxSampleCount: 4 })).toThrow(
      RangeError,
    );
  });
});
