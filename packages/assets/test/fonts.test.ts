/** T-AST-023: deterministic WOFF2, normalized metrics, stable names, and no timestamps. */

import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

import opentype from 'opentype.js';
import type { DefineFontModel } from '@swf-forge/swf';
import { encodeFontWoff2 } from '../src/index.js';

const require = createRequire(import.meta.url);
const woff2 = require('wawoff2') as { decompress(bytes: Uint8Array): Promise<Uint8Array> };

const FONT: DefineFontModel = {
  id: 9,
  version: 2,
  tagCode: 48,
  name: 'Pinned Family',
  languageCode: 0,
  unitsPerEm: 1024,
  italic: false,
  bold: false,
  wideCodes: true,
  shiftJIS: false,
  ansi: false,
  smallText: false,
  codes: [65],
  glyphs: [{ index: 0, code: 65, shape: null, advance: 600, bounds: null, quarantined: false }],
  ascent: 800,
  descent: 200,
  leading: -40,
  kerning: [],
};

function u16be(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function u32be(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

describe('deterministic WOFF2 font output', () => {
  it('T-AST-023: repeats bytes, preserves normalized family/upem, and zeroes sfnt timestamps', async () => {
    const first = encodeFontWoff2(FONT);
    const second = encodeFontWoff2(FONT);
    expect(first.bytes.subarray(0, 4)).toEqual(Uint8Array.from([0x77, 0x4f, 0x46, 0x32]));
    expect(first.bytes).toEqual(second.bytes);
    expect(first.familyName).toBe('Pinned Family');
    expect(first.unitsPerEm).toBe(1024);

    const sfnt = await woff2.decompress(first.bytes);
    const parsed = opentype.parse(sfnt.buffer.slice(sfnt.byteOffset, sfnt.byteOffset + sfnt.byteLength));
    expect(parsed.getEnglishName('fontFamily')).toBe('Pinned Family');
    expect(parsed.unitsPerEm).toBe(1024);

    const tableCount = u16be(sfnt, 4);
    let headOffset = -1;
    for (let index = 0; index < tableCount; index += 1) {
      const record = 12 + index * 16;
      if (new TextDecoder().decode(sfnt.subarray(record, record + 4)) === 'head') {
        headOffset = u32be(sfnt, record + 8);
        break;
      }
    }
    expect(headOffset).toBeGreaterThanOrEqual(0);
    expect(sfnt.subarray(headOffset + 20, headOffset + 36)).toEqual(new Uint8Array(16));
    const printable = new TextDecoder().decode(sfnt);
    expect(printable).not.toContain('opentype.js');
    expect(printable).not.toContain('wawoff2');
  });
});
