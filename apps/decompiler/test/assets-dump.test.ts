/** Deterministic `forge-decompile assets dump` bundle and unsupported-media behavior. */

import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';

import { encodeBitmapPng } from '@swf-forge/assets';
import { EXIT, runCli, type CliIo } from '@swf-forge/decompiler';
import { Tag } from '@swf-forge/swf';
import { ByteWriter, buildSwf, concat, endTag, showFrames, tag, writeRect } from '@swf-forge/swf/test-support';

const WORK = mkdtempSync(join(tmpdir(), 'swf-forge-assets-'));
afterAll(() => rmSync(WORK, { recursive: true, force: true }));

function capture(): { io: CliIo; out: string[]; err: string[] } {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { out: (line) => out.push(line), err: (line) => err.push(line) }, out, err };
}

function shapeBody(id: number): Uint8Array {
  const writer = new ByteWriter();
  writer.u16(id);
  writeRect(writer, { xMin: 0, xMax: 40, yMin: 0, yMax: 40 });
  writer.u8(1).u8(0).u8(240).u8(24).u8(12).u8(255); // one opaque-red solid fill
  writer.u8(0); // no line styles
  writer.bits(1, 4).bits(0, 4); // one-bit fill index, no line index
  writer.bits(0, 1).bits(0, 1).bits(0, 1).bits(1, 1).bits(0, 1).bits(0, 1).bits(1, 1); // FillStyle1 = 1
  const straight = (dx: number, dy: number): void => {
    writer.bits(1, 1).bits(1, 1).bits(5, 4).bits(1, 1); // straight, 7-bit deltas, general
    const signed = (value: number): void => {
      writer.bits(value < 0 ? 128 + value : value, 7);
    };
    signed(dx);
    signed(dy);
  };
  straight(40, 0);
  straight(0, 40);
  straight(-40, 0);
  straight(0, -40);
  writer.bits(0, 6).align(); // EndShapeRecord
  return writer.toUint8Array();
}

function shapeSwf(): Uint8Array {
  return buildSwf({
    version: 8,
    body: concat(tag(Tag.DefineShape3, shapeBody(7)), showFrames(1), endTag()),
    frameCount: 1,
  });
}

function morphEndpoint(length: number, withStyleChange: boolean): Uint8Array {
  const writer = new ByteWriter();
  writer.bits(withStyleChange ? 1 : 0, 4).bits(0, 4); // start has one fill index; end edge header is zeroed
  if (withStyleChange) {
    writer.bits(0, 1).bits(0, 1).bits(0, 1).bits(1, 1).bits(0, 1).bits(0, 1).bits(1, 1);
  }
  const straight = (dx: number, dy: number): void => {
    writer.bits(1, 1).bits(1, 1).bits(6, 4).bits(1, 1);
    writer.bits(dx < 0 ? 256 + dx : dx, 8).bits(dy < 0 ? 256 + dy : dy, 8);
  };
  straight(length, 0);
  straight(0, length);
  straight(-length, 0);
  straight(0, -length);
  writer.bits(0, 6).align();
  return writer.toUint8Array();
}

function morphSwf(): Uint8Array {
  const fills = new ByteWriter();
  fills.u8(1).u8(0x00); // one solid MorphFillStyle
  fills.u8(240).u8(25).u8(10).u8(255); // start red
  fills.u8(10).u8(60).u8(245).u8(255); // end blue
  fills.u8(0); // no MorphLineStyles
  const start = morphEndpoint(80, true);
  const end = morphEndpoint(160, false);
  const body = new ByteWriter();
  body.u16(8);
  writeRect(body, { xMin: 0, xMax: 80, yMin: 0, yMax: 80 });
  writeRect(body, { xMin: 0, xMax: 160, yMin: 0, yMax: 160 });
  body
    .u32(fills.length + start.length)
    .bytes(fills.toUint8Array())
    .bytes(start)
    .bytes(end);
  return buildSwf({
    version: 10,
    body: concat(tag(Tag.DefineMorphShape, body.toUint8Array()), showFrames(1), endTag()),
    frameCount: 1,
  });
}

function fontGlyphShape(): Uint8Array {
  const writer = new ByteWriter();
  writer.bits(1, 4).bits(0, 4);
  writer.bits(0, 1).bits(0, 1).bits(0, 1).bits(0, 1).bits(1, 1).bits(1, 1);
  writer.bits(1, 5).bits(0, 1).bits(0, 1).bits(1, 1); // move to origin, then FillStyle0=1
  const line = (vertical: boolean, delta: number): void => {
    writer
      .bits(1, 1)
      .bits(1, 1)
      .bits(6, 4)
      .bits(0, 1)
      .bits(vertical ? 1 : 0, 1);
    writer.bits(delta < 0 ? 256 + delta : delta, 8);
  };
  line(false, 80);
  line(true, 80);
  line(false, -80);
  line(true, -80);
  writer.bits(0, 6).align();
  return writer.toUint8Array();
}

function fontSwf(): Uint8Array {
  const glyph = fontGlyphShape();
  const name = new TextEncoder().encode('Test Font');
  const font = new ByteWriter();
  font.u16(17).u8(0x84).u8(0).u8(name.length).bytes(name).u16(1);
  font
    .u16(4)
    .u16(4 + glyph.length)
    .bytes(glyph)
    .u16(65);
  font.u16(800).u16(200).s16(-50).s16(600);
  writeRect(font, { xMin: 0, xMax: 80, yMin: 0, yMax: 80 });
  font.u16(0);
  return buildSwf({
    version: 10,
    body: concat(tag(Tag.DefineFont2, font.toUint8Array()), showFrames(1), endTag()),
    frameCount: 1,
  });
}

function u16(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff]);
}

function u32(value: number): Uint8Array {
  return Uint8Array.from([value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff]);
}

function soundBody(
  id: number,
  format: number,
  rateCode: number,
  bits16: boolean,
  stereo: boolean,
  sampleCount: number,
  data: Uint8Array,
): Uint8Array {
  const flags = (format << 4) | (rateCode << 2) | (bits16 ? 2 : 0) | (stereo ? 1 : 0);
  return concat(Uint8Array.from([id & 0xff, (id >>> 8) & 0xff, flags]), u32(sampleCount), data);
}

class Bits {
  #out: number[] = [];
  #partial = 0;
  #count = 0;

  bits(value: number, width: number): this {
    for (let i = width - 1; i >= 0; i -= 1) {
      this.#partial = ((this.#partial << 1) | ((value >>> i) & 1)) & 0xff;
      this.#count += 1;
      if (this.#count === 8) {
        this.#out.push(this.#partial);
        this.#partial = 0;
        this.#count = 0;
      }
    }
    return this;
  }

  signed(value: number, width: number): this {
    return this.bits(value < 0 ? 2 ** width + value : value, width);
  }

  bytes(): Uint8Array {
    if (this.#count > 0) this.#out.push((this.#partial << (8 - this.#count)) & 0xff);
    return Uint8Array.from(this.#out);
  }
}

function mp3Frame(): Uint8Array {
  const bytes = new Uint8Array(418);
  bytes.set([0xff, 0xfb, 0x92, 0xc0]);
  for (let i = 4; i < bytes.length; i += 1) bytes[i] = (i * 17) & 0xff;
  return bytes;
}

function mp3FrameAt48kHz(): Uint8Array {
  const bytes = new Uint8Array(385);
  bytes.set([0xff, 0xfb, 0x96, 0xc0]);
  return bytes;
}

function audioSwf(): Uint8Array {
  const adpcm = new Bits().bits(0, 2).signed(1000, 16).bits(0, 6).bits(1, 2).bits(2, 2).bytes();
  const mp3 = concat(Uint8Array.from([0xfd, 0xff]), mp3Frame());
  const body = concat(
    tag(Tag.DefineSound, soundBody(1, 3, 3, true, false, 3, Uint8Array.from([0x00, 0x80, 0xff, 0x7f, 0x34, 0x12]))),
    tag(Tag.DefineSound, soundBody(2, 1, 2, true, false, 3, adpcm)),
    tag(Tag.DefineSound, soundBody(3, 2, 3, true, false, 1152, mp3)),
    tag(Tag.DefineSound, soundBody(4, 6, 3, false, false, 5, Uint8Array.from([1, 2, 3]))),
    showFrames(1),
    endTag(),
  );
  return buildSwf({ version: 10, body, frameCount: 1 });
}

function write(name: string, bytes: Uint8Array): string {
  const path = join(WORK, name);
  writeFileSync(path, bytes);
  return path;
}

describe('forge-decompile assets dump', () => {
  it('writes deterministic relative shape PNGs and a sorted manifest', () => {
    const source = write('shape.swf', shapeSwf());
    const firstDir = join(WORK, 'bundle-a');
    const first = capture();
    expect(runCli(['assets', 'dump', source, '--out', firstDir], first.io)).toBe(EXIT.ok);
    expect(first.err).toEqual([]);
    expect(readdirSync(firstDir)).toEqual(['manifest.json', 'shape-7.png']);

    const manifestBytes = readFileSync(join(firstDir, 'manifest.json'));
    const manifest = JSON.parse(manifestBytes.toString('utf8')) as {
      format: string;
      formatVersion: number;
      assets: readonly {
        characterId: number;
        kind: string;
        sourceTag: string;
        outputType: string | null;
        path: string | null;
        status: string;
        sha256: string | null;
        diagnostics: readonly unknown[];
      }[];
    };
    expect(manifest.format).toBe('swf-forge/assets-manifest');
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.assets).toEqual([
      {
        characterId: 7,
        kind: 'shape',
        sourceTag: 'DefineShape3',
        outputType: 'image/png',
        path: 'shape-7.png',
        status: 'written',
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        diagnostics: [],
      },
    ]);
    expect(manifestBytes.toString('utf8')).not.toContain(WORK);
    expect(readFileSync(join(firstDir, 'shape-7.png')).subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );

    const secondDir = join(WORK, 'bundle-b');
    const second = capture();
    expect(runCli(['assets', 'dump', source, `--out=${secondDir}`], second.io)).toBe(EXIT.ok);
    expect(readdirSync(secondDir)).toEqual(readdirSync(firstDir));
    for (const name of readdirSync(firstDir)) {
      expect(readFileSync(join(secondDir, name))).toEqual(readFileSync(join(firstDir, name)));
    }
  });

  it('T-AST-024 writes deterministic start/end morph previews and paired-edge metadata', () => {
    const source = write('morph.swf', morphSwf());
    const firstDir = join(WORK, 'morph-bundle-a');
    const first = capture();
    expect(runCli(['assets', 'dump', source, '--out', firstDir], first.io)).toBe(EXIT.ok);
    expect(readdirSync(firstDir)).toEqual(['manifest.json', 'morph-8-end.png', 'morph-8-start.png']);
    const startPng = readFileSync(join(firstDir, 'morph-8-start.png'));
    const endPng = readFileSync(join(firstDir, 'morph-8-end.png'));
    expect(startPng.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(endPng.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    expect(startPng.readUInt32BE(16)).toBe(4);
    expect(endPng.readUInt32BE(16)).toBe(8);
    expect(startPng).not.toEqual(endPng);

    const manifestBytes = readFileSync(join(firstDir, 'manifest.json'));
    const manifest = JSON.parse(manifestBytes.toString('utf8')) as {
      assets: readonly {
        path: string | null;
        status: string;
        sha256: string | null;
        metadata?: Record<string, unknown>;
      }[];
    };
    expect(manifest.assets).toHaveLength(2);
    expect(manifest.assets.map((asset) => asset.path)).toEqual(['morph-8-start.png', 'morph-8-end.png']);
    expect(
      manifest.assets.every((asset) => asset.status === 'written' && /^[a-f0-9]{64}$/.test(asset.sha256 ?? '')),
    ).toBe(true);
    expect(manifest.assets[0]?.metadata).toMatchObject({
      endpoint: 'start',
      edgeCount: 4,
      pairedEdgeCount: 4,
      offsetMatches: true,
    });
    expect(manifest.assets[1]?.metadata).toMatchObject({
      endpoint: 'end',
      edgeCount: 4,
      pairedEdgeCount: 4,
      offsetMatches: true,
    });

    const secondDir = join(WORK, 'morph-bundle-b');
    const second = capture();
    expect(runCli(['assets', 'dump', source, '--out', secondDir], second.io)).toBe(EXIT.ok);
    for (const name of readdirSync(firstDir)) {
      expect(readFileSync(join(secondDir, name))).toEqual(readFileSync(join(firstDir, name)));
    }
  });

  it('T-AST-023/T-MOD-509 writes deterministic WOFF2 and glyph-atlas assets from DefineFont2', () => {
    const source = write('font.swf', fontSwf());
    const firstDir = join(WORK, 'font-bundle-a');
    const first = capture();
    expect(runCli(['assets', 'dump', source, '--out', firstDir], first.io)).toBe(EXIT.ok);
    expect(readdirSync(firstDir)).toEqual([
      'font-17-atlas-0.png',
      'font-17-atlas.json',
      'font-17.woff2',
      'manifest.json',
    ]);
    const fontBytes = readFileSync(join(firstDir, 'font-17.woff2'));
    expect(fontBytes.subarray(0, 4).toString('ascii')).toBe('wOF2');
    expect(readFileSync(join(firstDir, 'font-17-atlas-0.png')).subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    const atlas = JSON.parse(readFileSync(join(firstDir, 'font-17-atlas.json'), 'utf8')) as {
      format: string;
      pageSize: number;
      pages: readonly { path: string; width: number; height: number }[];
      glyphs: readonly { index: number; code: number; page: number | null; rect: unknown }[];
    };
    expect(atlas).toMatchObject({
      format: 'swf-forge/font-atlas',
      formatVersion: 1,
      fontId: 17,
      unitsPerEm: 1024,
      canonicalUnitsPerEm: 1024,
      pageSize: 512,
      gutter: 2,
      pages: [{ path: 'font-17-atlas-0.png', width: 512, height: 512 }],
    });
    expect(atlas.glyphs[0]).toMatchObject({ index: 0, code: 65, page: 0, rect: expect.any(Object) });
    const manifest = JSON.parse(readFileSync(join(firstDir, 'manifest.json'), 'utf8')) as {
      assets: readonly {
        characterId: number;
        kind: string;
        outputType: string | null;
        path: string | null;
        status: string;
        sha256: string | null;
        metadata?: Record<string, number | string | boolean>;
        diagnostics: readonly unknown[];
      }[];
    };
    expect(manifest.assets).toEqual([
      {
        characterId: 17,
        kind: 'font2',
        sourceTag: 'DefineFont2',
        outputType: 'font/woff2',
        path: 'font-17.woff2',
        status: 'written',
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        metadata: {
          familyName: 'Test Font',
          glyphCount: 1,
          unitsPerEm: 1024,
          italic: false,
          bold: false,
          atlasManifest: 'font-17-atlas.json',
          atlasManifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          atlasPageCount: 1,
          atlasGlyphCount: 1,
          atlasPageSize: 512,
        },
        diagnostics: [],
      },
    ]);

    const secondDir = join(WORK, 'font-bundle-b');
    expect(runCli(['assets', 'dump', source, '--out', secondDir], capture().io)).toBe(EXIT.ok);
    expect(readFileSync(join(secondDir, 'font-17.woff2'))).toEqual(fontBytes);
    expect(readFileSync(join(secondDir, 'manifest.json'))).toEqual(readFileSync(join(firstDir, 'manifest.json')));
  });

  it('T-AUD-101–105/115 writes PCM/ADPCM WAV, byte-identical MP3, and diagnosed silent fallbacks', () => {
    const source = write('audio.swf', audioSwf());
    const outDir = join(WORK, 'audio-bundle');
    const captured = capture();
    expect(runCli(['assets', 'dump', source, '--out', outDir], captured.io)).toBe(EXIT.ok);
    expect(readdirSync(outDir)).toEqual(['manifest.json', 'sound-1.wav', 'sound-2.wav', 'sound-3.mp3', 'sound-4.wav']);
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8')) as {
      assets: readonly {
        characterId: number;
        outputType: string | null;
        path: string | null;
        status: string;
        metadata?: Record<string, number | string | boolean>;
        diagnostics: readonly { code: string; severity: string }[];
      }[];
    };
    expect(
      manifest.assets.map(({ characterId, outputType, path, status }) => ({ characterId, outputType, path, status })),
    ).toEqual([
      { characterId: 1, outputType: 'audio/wav', path: 'sound-1.wav', status: 'written' },
      { characterId: 2, outputType: 'audio/wav', path: 'sound-2.wav', status: 'written' },
      { characterId: 3, outputType: 'audio/mpeg', path: 'sound-3.mp3', status: 'written' },
      { characterId: 4, outputType: 'audio/wav', path: 'sound-4.wav', status: 'fallback' },
    ]);
    expect(manifest.assets[0]?.metadata).toMatchObject({
      codec: 'pcm',
      sampleRate: 48000,
      sourceSampleRate: 44100,
      sampleCount: 3,
      outputSampleCount: 3,
    });
    expect(manifest.assets[1]?.metadata).toMatchObject({
      codec: 'adpcm',
      sampleRate: 48000,
      sourceSampleRate: 22050,
      sampleCount: 3,
      outputSampleCount: 7,
    });
    expect(manifest.assets[2]?.metadata).toMatchObject({ codec: 'mp3-pass-through', seekSamples: -3, frameCount: 1 });
    expect(manifest.assets[3]?.metadata).toMatchObject({
      codec: 'nellymoser',
      sampleRate: 48000,
      sourceSampleRate: 44100,
      sampleCount: 5,
      outputSampleCount: 5,
      silent: true,
    });
    expect(manifest.assets[3]?.diagnostics).toEqual([
      { code: 'SF0307', severity: 'warning', message: expect.any(String) },
    ]);

    const pcmWav = readFileSync(join(outDir, 'sound-1.wav'));
    expect(new DataView(pcmWav.buffer, pcmWav.byteOffset, pcmWav.byteLength).getUint32(24, true)).toBe(48000);
    const adpcmWav = readFileSync(join(outDir, 'sound-2.wav'));
    const adpcmView = new DataView(adpcmWav.buffer, adpcmWav.byteOffset, adpcmWav.byteLength);
    expect(adpcmView.getUint32(24, true)).toBe(48000);
    expect(adpcmView.getUint32(40, true)).toBe(7 * 2);
    const mp3Bytes = readFileSync(join(outDir, 'sound-3.mp3'));
    expect(mp3Bytes).toEqual(Buffer.from(mp3Frame()));
    expect(readFileSync(join(outDir, 'sound-4.wav')).subarray(44)).toEqual(Buffer.alloc(10));
  });

  it('T-AUD-115: emits duration-correct silent WAVs for Nellymoser, Speex, and reserved formats', () => {
    const source = write(
      'unsupported-audio.swf',
      buildSwf({
        version: 10,
        body: concat(
          tag(Tag.DefineSound, soundBody(11, 4, 3, true, false, 2, Uint8Array.from([1, 2]))),
          tag(Tag.DefineSound, soundBody(12, 11, 0, true, false, 2, Uint8Array.from([3, 4]))),
          tag(Tag.DefineSound, soundBody(13, 7, 3, true, false, 2, Uint8Array.from([5, 6]))),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    const outDir = join(WORK, 'unsupported-audio-bundle');
    expect(runCli(['assets', 'dump', source, '--out', outDir], capture().io)).toBe(EXIT.failed);
    expect(readdirSync(outDir)).toEqual(['manifest.json', 'sound-11.wav', 'sound-12.wav', 'sound-13.wav']);

    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8')) as {
      assets: readonly {
        characterId: number;
        status: string;
        metadata?: Record<string, number | string | boolean>;
        diagnostics: readonly { code: string; severity: string }[];
      }[];
    };
    expect(manifest.assets.map(({ characterId, status }) => ({ characterId, status }))).toEqual([
      { characterId: 11, status: 'fallback' },
      { characterId: 12, status: 'fallback' },
      { characterId: 13, status: 'fallback' },
    ]);
    expect(manifest.assets.map((asset) => asset.metadata)).toEqual([
      {
        codec: 'nellymoser-16k',
        sampleRate: 48000,
        sourceSampleRate: 16000,
        sampleCount: 2,
        outputSampleCount: 6,
        silent: true,
      },
      {
        codec: 'speex',
        sampleRate: 48000,
        sourceSampleRate: 16000,
        sampleCount: 2,
        outputSampleCount: 6,
        silent: true,
      },
      {
        codec: 'reserved-7',
        sampleRate: 48000,
        sourceSampleRate: 44100,
        sampleCount: 2,
        outputSampleCount: 2,
        silent: true,
      },
    ]);
    expect(manifest.assets.map((asset) => asset.diagnostics.map(({ code, severity }) => ({ code, severity })))).toEqual(
      [
        [{ code: 'SF0307', severity: 'warning' }],
        [{ code: 'SF0303', severity: 'warning' }],
        [{ code: 'SF0301', severity: 'error' }],
      ],
    );

    for (const id of [11, 12, 13]) {
      const wav = readFileSync(join(outDir, `sound-${id}.wav`));
      expect(wav.length).toBe(44 + (id === 13 ? 2 : 6) * 2);
      expect(wav.subarray(44).every((sample) => sample === 0)).toBe(true);
    }
  });

  it('reports MP3 parameter changes, duration mismatches, and seek discontinuities in the asset manifest', () => {
    const changedFrames = concat(mp3Frame(), mp3FrameAt48kHz());
    const changedMp3 = concat(u16(0), changedFrames);
    const discontinuousMp3 = concat(u16(1001), mp3Frame());
    const source = write(
      'mp3-diagnostics.swf',
      buildSwf({
        version: 10,
        body: concat(
          tag(Tag.DefineSound, soundBody(5, 2, 3, true, false, 2304, changedMp3)),
          tag(Tag.DefineSound, soundBody(6, 2, 3, true, false, 1000, discontinuousMp3)),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    const outDir = join(WORK, 'mp3-diagnostics');
    expect(runCli(['assets', 'dump', source, '--out', outDir], capture().io)).toBe(EXIT.ok);
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8')) as {
      assets: readonly { characterId: number; diagnostics: readonly { code: string; severity: string }[] }[];
    };
    expect(manifest.assets.find((asset) => asset.characterId === 5)?.diagnostics).toEqual([
      { code: 'SF0305', severity: 'info', message: expect.any(String) },
    ]);
    expect(manifest.assets.find((asset) => asset.characterId === 6)?.diagnostics).toEqual(
      expect.arrayContaining([
        { code: 'SF0306', severity: 'warning', message: expect.any(String) },
        { code: 'SF0324', severity: 'warning', message: expect.any(String) },
      ]),
    );
  });

  it('pads truncated PCM, diagnoses malformed ADPCM, and retains completed WAV previews', () => {
    const source = write(
      'truncated-audio.swf',
      buildSwf({
        version: 10,
        body: concat(
          tag(Tag.DefineSound, soundBody(7, 3, 3, true, false, 2, Uint8Array.from([0x12]))),
          // #8: a complete packet header but one frame short of the declared two. Benign — 26% of
          // real ADPCM sounds do this (errata E-032) — so a warning, never SF0328.
          tag(Tag.DefineSound, soundBody(8, 1, 3, true, false, 2, Uint8Array.from([0, 0, 1]))),
          // #9: 14 bits left after the code-size field, where a packet header needs 22. No packet
          // can be formed at all, which is what SF0328 means.
          tag(Tag.DefineSound, soundBody(9, 1, 3, true, false, 2, Uint8Array.from([0, 1]))),
          // #10: the first of two required packets runs out of codes after 4001 frames. Even though
          // 999 frames remain (<4096), this is an incomplete earlier packet and MUST be SF0328.
          tag(Tag.DefineSound, soundBody(10, 1, 3, true, false, 5000, new Uint8Array(1003))),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    const outDir = join(WORK, 'truncated-audio');
    const captured = capture();
    expect(runCli(['assets', 'dump', source, '--out', outDir], captured.io)).toBe(EXIT.failed);
    expect(readdirSync(outDir)).toEqual(['manifest.json', 'sound-10.wav', 'sound-7.wav', 'sound-8.wav', 'sound-9.wav']);
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8')) as {
      assets: readonly { characterId: number; diagnostics: readonly { code: string }[] }[];
    };
    const codesFor = (id: number) =>
      manifest.assets.find((asset) => asset.characterId === id)?.diagnostics.map((item) => item.code) ?? [];
    expect(codesFor(7)).toContain('ASSET_SOUND_TRUNCATED');
    // The short final packet is reported, but as a warning about missing frames — not as a
    // malformed stream. Pinning both halves: the warning present, the error absent.
    expect(codesFor(8)).toContain('ASSET_SOUND_TRUNCATED');
    expect(codesFor(8)).not.toContain('SF0328');
    expect(codesFor(9)).toContain('SF0328');
    expect(codesFor(10)).toContain('ASSET_SOUND_TRUNCATED');
    expect(codesFor(10)).toContain('SF0328');
    expect(captured.err.join('\n')).toContain('SF0328 #9');
    expect(captured.err.join('\n')).toContain('SF0328 #10');
    expect(captured.err.join('\n')).not.toContain('SF0328 #8');
  });

  it('decodes embedded PNG and lossless bitmap tags to deterministic preview PNGs', () => {
    const embeddedPng = encodeBitmapPng({
      width: 1,
      height: 1,
      pixels: Uint8Array.from([12, 34, 56, 255]),
    });
    const losslessPayload = new Uint8Array(deflateSync(Uint8Array.from([0, 255, 0, 0, 99, 99, 99])));
    const losslessBody = concat(u16(3), Uint8Array.from([3]), u16(1), u16(1), Uint8Array.from([0]), losslessPayload);
    const source = write(
      'bitmap-assets.swf',
      buildSwf({
        version: 10,
        body: concat(
          tag(Tag.DefineBitsJPEG2, concat(u16(2), embeddedPng)),
          tag(Tag.DefineBitsLossless, losslessBody),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    const firstDir = join(WORK, 'bitmap-assets-a');
    expect(runCli(['assets', 'dump', source, '--out', firstDir], capture().io)).toBe(EXIT.ok);
    expect(readdirSync(firstDir)).toEqual(['bitmap-2.png', 'bitmap-3.png', 'manifest.json']);
    const manifest = JSON.parse(readFileSync(join(firstDir, 'manifest.json'), 'utf8')) as {
      assets: readonly { characterId: number; status: string; metadata?: Record<string, unknown> }[];
    };
    expect(manifest.assets).toEqual([
      {
        characterId: 2,
        kind: 'bitmap',
        sourceTag: 'DefineBitsJPEG2',
        outputType: 'image/png',
        path: 'bitmap-2.png',
        status: 'written',
        sha256: expect.any(String),
        metadata: expect.objectContaining({ contentType: 'png', width: 1, height: 1 }),
        diagnostics: [],
      },
      {
        characterId: 3,
        kind: 'bitmapLossless',
        sourceTag: 'DefineBitsLossless',
        outputType: 'image/png',
        path: 'bitmap-3.png',
        status: 'written',
        sha256: expect.any(String),
        metadata: expect.objectContaining({ contentType: 'lossless-rgb', width: 1, height: 1 }),
        diagnostics: [],
      },
    ]);
    const secondDir = join(WORK, 'bitmap-assets-b');
    expect(runCli(['assets', 'dump', source, '--out', secondDir], capture().io)).toBe(EXIT.ok);
    for (const name of readdirSync(firstDir)) {
      expect(readFileSync(join(secondDir, name))).toEqual(readFileSync(join(firstDir, name)));
    }
  });

  it('marks malformed bitmap media unsupported with a specific diagnostic instead of emitting a false PNG', () => {
    const source = write(
      'bitmap.swf',
      buildSwf({
        version: 8,
        body: concat(tag(Tag.DefineBitsJPEG2, Uint8Array.from([9, 0, 0xff, 0xd8])), showFrames(1), endTag()),
        frameCount: 1,
      }),
    );
    const outDir = join(WORK, 'unsupported');
    const captured = capture();
    expect(runCli(['assets', 'dump', source, '--out', outDir], captured.io)).toBe(EXIT.failed);
    expect(captured.err.join('\n')).toContain('SF0252 #9');
    expect(readdirSync(outDir)).toEqual(['manifest.json']);
    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8')) as {
      assets: readonly { status: string; path: string | null; outputType: string | null; sha256: string | null }[];
    };
    expect(manifest.assets).toEqual([
      {
        characterId: 9,
        kind: 'bitmap',
        sourceTag: 'DefineBitsJPEG2',
        outputType: null,
        path: null,
        status: 'unsupported',
        sha256: null,
        diagnostics: [
          {
            code: 'SF0255',
            severity: 'warning',
            message: 'JPEG payload is missing its EOI marker; decoder recovery attempted',
          },
          {
            code: 'SF0252',
            severity: 'error',
            message: 'JPEG has no valid Start Of Frame dimensions',
          },
        ],
      },
    ]);
  });

  it('rejects incomplete syntax and malformed input with nonzero outcomes', () => {
    const missingFile = capture();
    expect(runCli(['assets', 'dump'], missingFile.io)).toBe(EXIT.unreadable);
    expect(missingFile.err.join('\n')).toContain('--out');

    const malformed = write('malformed.swf', Uint8Array.from([1, 2, 3, 4]));
    const failed = capture();
    expect(runCli(['assets', 'dump', malformed, '--out', join(WORK, 'malformed-out')], failed.io)).not.toBe(EXIT.ok);
  });
});
