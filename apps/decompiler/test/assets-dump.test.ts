/** Deterministic `forge-decompile assets dump` bundle and unsupported-media behavior. */

import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { afterAll, describe, expect, it } from 'vitest';

import { encodeBitmapPng, spliceJpegTables } from '@swf-forge/assets';
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

function morphBody(id: number): Uint8Array {
  const fills = new ByteWriter();
  fills.u8(1).u8(0x00); // one solid MorphFillStyle
  fills.u8(240).u8(25).u8(10).u8(255); // start red
  fills.u8(10).u8(60).u8(245).u8(255); // end blue
  fills.u8(0); // no MorphLineStyles
  const start = morphEndpoint(80, true);
  const end = morphEndpoint(160, false);
  const body = new ByteWriter();
  body.u16(id);
  writeRect(body, { xMin: 0, xMax: 80, yMin: 0, yMax: 80 });
  writeRect(body, { xMin: 0, xMax: 160, yMin: 0, yMax: 160 });
  body
    .u32(fills.length + start.length)
    .bytes(fills.toUint8Array())
    .bytes(start)
    .bytes(end);
  return body.toUint8Array();
}

function morphSwf(id = 8): Uint8Array {
  return buildSwf({
    version: 10,
    body: concat(tag(Tag.DefineMorphShape, morphBody(id)), showFrames(1), endTag()),
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

function fontBody(id: number): Uint8Array {
  const glyph = fontGlyphShape();
  const name = new TextEncoder().encode('Test Font');
  const font = new ByteWriter();
  font.u16(id).u8(0x84).u8(0).u8(name.length).bytes(name).u16(1);
  font
    .u16(4)
    .u16(4 + glyph.length)
    .bytes(glyph)
    .u16(65);
  font.u16(800).u16(200).s16(-50).s16(600);
  writeRect(font, { xMin: 0, xMax: 80, yMin: 0, yMax: 80 });
  font.u16(0);
  return font.toUint8Array();
}

function fontSwf(id = 17): Uint8Array {
  return buildSwf({
    version: 10,
    body: concat(tag(Tag.DefineFont2, fontBody(id)), showFrames(1), endTag()),
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

const PROGRESSIVE_JPEG = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wgARCAACAAIDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAA//EABUBAQEAAAAAAAAAAAAAAAAAAAUH/9oADAMBAAIQAxAAAAEwZx//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAn//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AX//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AX//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAY/An//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/IX//2gAMAwEAAgADAAAAEH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EH//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EH//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EH//2Q==',
  'base64',
);

function splitJpegTables(jpeg: Uint8Array): { readonly tables: Uint8Array; readonly image: Uint8Array } {
  const tableSegments: Uint8Array[] = [];
  const imageSegments: Uint8Array[] = [];
  let offset = 2;
  while (offset + 4 < jpeg.length) {
    if (jpeg[offset] !== 0xff) throw new Error(`invalid JPEG marker at ${offset}`);
    const start = offset;
    while (jpeg[offset] === 0xff) offset += 1;
    const marker = jpeg[offset++] ?? 0;
    if (marker === 0xda || marker === 0xd9) {
      imageSegments.push(jpeg.subarray(start));
      break;
    }
    const length = ((jpeg[offset] ?? 0) << 8) | (jpeg[offset + 1] ?? 0);
    const end = offset + length;
    if (length < 2 || end > jpeg.length) throw new Error(`invalid JPEG segment at ${start}`);
    const segment = jpeg.subarray(start, end);
    if (marker === 0xdb || marker === 0xc4 || marker === 0xdd) tableSegments.push(segment);
    else imageSegments.push(segment);
    offset = end;
  }
  return {
    tables: concat(Uint8Array.from([0xff, 0xd8]), ...tableSegments, Uint8Array.from([0xff, 0xd9])),
    image: concat(Uint8Array.from([0xff, 0xd8]), ...imageSegments),
  };
}

function digest(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

function treeHash(directory: string): string {
  const hash = createHash('sha256');
  for (const name of readdirSync(directory).sort()) {
    const nameBytes = Buffer.from(name, 'utf8');
    const bytes = readFileSync(join(directory, name));
    hash.update(u32(nameBytes.length)).update(nameBytes).update(u32(bytes.length)).update(bytes);
  }
  return hash.digest('hex');
}

function multiKindSwf(): Uint8Array {
  const jpeg = new Uint8Array(PROGRESSIVE_JPEG);
  const split = splitJpegTables(jpeg);
  const embeddedPng = encodeBitmapPng({ width: 1, height: 1, pixels: Uint8Array.from([12, 34, 56, 255]) });
  const embeddedGif = new Uint8Array(Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'));
  const lossless = concat(
    u16(35),
    Uint8Array.from([5]),
    u16(1),
    u16(1),
    new Uint8Array(deflateSync(Uint8Array.from([0, 80, 160, 240]))),
  );
  const jpegAlpha = concat(
    u16(34),
    u32(jpeg.length),
    jpeg,
    new Uint8Array(deflateSync(Uint8Array.from([255, 128, 64, 0]))),
  );
  const adpcm = new Bits().bits(0, 2).signed(1000, 16).bits(0, 6).bits(1, 2).bits(2, 2).bytes();
  const mp3 = concat(u16(0xfffd), mp3Frame());
  return buildSwf({
    version: 10,
    body: concat(
      tag(Tag.JPEGTables, split.tables),
      tag(Tag.DefineSound, soundBody(43, 2, 3, true, false, 1152, mp3)),
      tag(Tag.DefineBitsJPEG3, jpegAlpha),
      tag(Tag.DefineBits, concat(u16(31), split.image)),
      tag(Tag.DefineBitsLossless, lossless),
      tag(Tag.DefineShape3, shapeBody(11)),
      tag(Tag.DefineSound, soundBody(41, 3, 3, true, false, 3, Uint8Array.from([0x00, 0x80, 0xff, 0x7f, 0x34, 0x12]))),
      tag(Tag.DefineFont2, fontBody(17)),
      tag(Tag.DefineBitsJPEG2, concat(u16(33), embeddedGif)),
      tag(Tag.DefineMorphShape, morphBody(22)),
      tag(Tag.DefineSound, soundBody(42, 1, 2, true, false, 3, adpcm)),
      tag(Tag.DefineBitsJPEG2, concat(u16(32), embeddedPng)),
      showFrames(1),
      endTag(),
    ),
    frameCount: 1,
  });
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

  it('T-AST-025: golden multi-kind bundle has sorted records, direct passthroughs, and source metadata', () => {
    const swf = multiKindSwf();
    const source = write('multi-kind-golden.swf', swf);
    const outDir = join(WORK, 'multi-kind-golden');
    const captured = capture();
    expect(runCli(['assets', 'dump', source, '--out', outDir], captured.io)).toBe(EXIT.ok);
    expect(captured.err).toEqual([
      'SF0256 #31: progressive JPEG payload passed to the configured decoder',
      'SF0256 #34: progressive JPEG payload passed to the configured decoder',
    ]);
    expect(readdirSync(outDir).sort()).toEqual([
      'bitmap-31.jpg',
      'bitmap-32.png',
      'bitmap-33.gif',
      'bitmap-34.png',
      'bitmap-35.png',
      'font-17-atlas-0.png',
      'font-17-atlas.json',
      'font-17.woff2',
      'manifest.json',
      'morph-22-end.png',
      'morph-22-start.png',
      'shape-11.png',
      'sound-41.wav',
      'sound-42.wav',
      'sound-43.mp3',
    ]);

    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8')) as {
      format: string;
      formatVersion: number;
      source: { bytes: number; sha256: string; compression: string; version: number };
      assets: readonly {
        characterId: number;
        kind: string;
        sourceTag: string;
        outputType: string | null;
        path: string | null;
        status: string;
        sha256: string | null;
        metadata?: Record<string, unknown>;
        diagnostics: readonly { code: string; severity: string }[];
      }[];
    };
    expect(manifest.format).toBe('swf-forge/assets-manifest');
    expect(manifest.formatVersion).toBe(1);
    expect(manifest.source).toEqual({
      bytes: swf.length,
      sha256: digest(swf),
      compression: 'none',
      version: 10,
    });
    expect(
      manifest.assets.map(({ characterId, kind, sourceTag, outputType, path, status }) => ({
        characterId,
        kind,
        sourceTag,
        outputType,
        path,
        status,
      })),
    ).toEqual([
      {
        characterId: 11,
        kind: 'shape',
        sourceTag: 'DefineShape3',
        outputType: 'image/png',
        path: 'shape-11.png',
        status: 'written',
      },
      {
        characterId: 17,
        kind: 'font2',
        sourceTag: 'DefineFont2',
        outputType: 'font/woff2',
        path: 'font-17.woff2',
        status: 'written',
      },
      {
        characterId: 22,
        kind: 'morphShape',
        sourceTag: 'DefineMorphShape',
        outputType: 'image/png',
        path: 'morph-22-start.png',
        status: 'written',
      },
      {
        characterId: 22,
        kind: 'morphShape',
        sourceTag: 'DefineMorphShape',
        outputType: 'image/png',
        path: 'morph-22-end.png',
        status: 'written',
      },
      {
        characterId: 31,
        kind: 'bitmap',
        sourceTag: 'DefineBits',
        outputType: 'image/jpeg',
        path: 'bitmap-31.jpg',
        status: 'written',
      },
      {
        characterId: 32,
        kind: 'bitmap',
        sourceTag: 'DefineBitsJPEG2',
        outputType: 'image/png',
        path: 'bitmap-32.png',
        status: 'written',
      },
      {
        characterId: 33,
        kind: 'bitmap',
        sourceTag: 'DefineBitsJPEG2',
        outputType: 'image/gif',
        path: 'bitmap-33.gif',
        status: 'written',
      },
      {
        characterId: 34,
        kind: 'bitmap',
        sourceTag: 'DefineBitsJPEG3',
        outputType: 'image/png',
        path: 'bitmap-34.png',
        status: 'written',
      },
      {
        characterId: 35,
        kind: 'bitmapLossless',
        sourceTag: 'DefineBitsLossless',
        outputType: 'image/png',
        path: 'bitmap-35.png',
        status: 'written',
      },
      {
        characterId: 41,
        kind: 'sound',
        sourceTag: 'DefineSound',
        outputType: 'audio/wav',
        path: 'sound-41.wav',
        status: 'written',
      },
      {
        characterId: 42,
        kind: 'sound',
        sourceTag: 'DefineSound',
        outputType: 'audio/wav',
        path: 'sound-42.wav',
        status: 'written',
      },
      {
        characterId: 43,
        kind: 'sound',
        sourceTag: 'DefineSound',
        outputType: 'audio/mpeg',
        path: 'sound-43.mp3',
        status: 'written',
      },
    ]);
    expect(
      manifest.assets.map((asset) => ({
        characterId: asset.characterId,
        codes: asset.diagnostics.map(({ code, severity }) => ({ code, severity })),
      })),
    ).toEqual([
      { characterId: 11, codes: [] },
      { characterId: 17, codes: [] },
      { characterId: 22, codes: [] },
      { characterId: 22, codes: [] },
      { characterId: 31, codes: [{ code: 'SF0256', severity: 'warning' }] },
      { characterId: 32, codes: [] },
      { characterId: 33, codes: [] },
      { characterId: 34, codes: [{ code: 'SF0256', severity: 'warning' }] },
      { characterId: 35, codes: [] },
      { characterId: 41, codes: [] },
      { characterId: 42, codes: [] },
      { characterId: 43, codes: [] },
    ]);
    for (const asset of manifest.assets) {
      expect(asset.path).not.toBeNull();
      expect(asset.sha256).toBe(digest(readFileSync(join(outDir, asset.path ?? ''))));
    }

    const split = splitJpegTables(PROGRESSIVE_JPEG);
    expect(readFileSync(join(outDir, 'bitmap-31.jpg'))).toEqual(
      Buffer.from(spliceJpegTables(split.image, split.tables)),
    );
    expect(readFileSync(join(outDir, 'bitmap-32.png'))).toEqual(
      Buffer.from(encodeBitmapPng({ width: 1, height: 1, pixels: Uint8Array.from([12, 34, 56, 255]) })),
    );
    expect(readFileSync(join(outDir, 'bitmap-33.gif'))).toEqual(
      Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64'),
    );
    expect(readFileSync(join(outDir, 'bitmap-34.png')).subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
    expect(manifest.assets.find((asset) => asset.characterId === 34)?.metadata).toMatchObject({
      contentType: 'jpeg',
      alphaPixels: 3,
    });
    expect(readFileSync(join(outDir, 'font-17.woff2')).subarray(0, 4).toString('ascii')).toBe('wOF2');
    const atlas = JSON.parse(readFileSync(join(outDir, 'font-17-atlas.json'), 'utf8')) as {
      pages: readonly { path: string; sha256: string; width: number; height: number }[];
    };
    expect(atlas.pages).toEqual([
      {
        path: 'font-17-atlas-0.png',
        sha256: digest(readFileSync(join(outDir, 'font-17-atlas-0.png'))),
        width: 512,
        height: 512,
      },
    ]);
    expect(readFileSync(join(outDir, 'sound-43.mp3'))).toEqual(Buffer.from(mp3Frame()));
    expect(treeHash(outDir)).toBe('4432382826b1715e1614f0e57768e4d73bc5fc7da050f9b68f09e9c7c23b4d2c');
  });

  it('T-AST-026: repeats the complete multi-kind asset tree byte-for-byte', () => {
    const source = write('multi-kind-repeat.swf', multiKindSwf());
    const firstDir = join(WORK, 'multi-kind-repeat-a');
    const secondDir = join(WORK, 'multi-kind-repeat-b');
    expect(runCli(['assets', 'dump', source, '--out', firstDir], capture().io)).toBe(EXIT.ok);
    expect(runCli(['assets', 'dump', source, '--out', secondDir], capture().io)).toBe(EXIT.ok);
    expect(readdirSync(secondDir).sort()).toEqual(readdirSync(firstDir).sort());
    expect(treeHash(secondDir)).toBe(treeHash(firstDir));
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

  it('T-AST-027: records quarantined bitmap/font inputs and exact-duration silent audio fallbacks', () => {
    const noJpegTables = concat(u16(61), Uint8Array.from([0xff, 0xd8]));
    const unknownLossless = concat(u16(62), Uint8Array.from([9]), u16(1), u16(1), Uint8Array.from([0]));
    const cffFont = concat(u16(63), Uint8Array.from([0x04, 0]));
    const malformedJpeg = concat(u16(64), Uint8Array.from([0xff, 0xd8]));
    const source = write(
      'unsupported-fallbacks.swf',
      buildSwf({
        version: 10,
        body: concat(
          tag(Tag.DefineSound, soundBody(75, 7, 3, true, false, 2, Uint8Array.from([1, 2]))),
          tag(Tag.DefineBits, noJpegTables),
          tag(Tag.DefineFont4, cffFont),
          tag(Tag.DefineSound, soundBody(72, 5, 3, true, false, 2, Uint8Array.from([3, 4]))),
          tag(Tag.DefineBitsLossless, unknownLossless),
          tag(Tag.DefineSound, soundBody(74, 11, 0, true, false, 2, Uint8Array.from([5, 6]))),
          tag(Tag.DefineBitsJPEG2, malformedJpeg),
          tag(Tag.DefineSound, soundBody(71, 4, 3, true, false, 2, Uint8Array.from([7, 8]))),
          tag(Tag.DefineSound, soundBody(73, 6, 3, true, false, 2, Uint8Array.from([9, 10]))),
          showFrames(1),
          endTag(),
        ),
        frameCount: 1,
      }),
    );
    const outDir = join(WORK, 'unsupported-fallbacks');
    const captured = capture();
    expect(runCli(['assets', 'dump', source, '--out', outDir], captured.io)).toBe(EXIT.failed);
    expect(readdirSync(outDir).sort()).toEqual([
      'manifest.json',
      'sound-71.wav',
      'sound-72.wav',
      'sound-73.wav',
      'sound-74.wav',
      'sound-75.wav',
    ]);

    const manifest = JSON.parse(readFileSync(join(outDir, 'manifest.json'), 'utf8')) as {
      assets: readonly {
        characterId: number;
        sourceTag: string;
        outputType: string | null;
        path: string | null;
        status: string;
        metadata?: Record<string, unknown>;
        diagnostics: readonly { code: string; severity: string }[];
      }[];
    };
    expect(
      manifest.assets.map((asset) => ({
        characterId: asset.characterId,
        sourceTag: asset.sourceTag,
        status: asset.status,
        outputType: asset.outputType,
        path: asset.path,
        codes: asset.diagnostics.map((diagnostic) => diagnostic.code),
      })),
    ).toEqual([
      {
        characterId: 61,
        sourceTag: 'DefineBits',
        status: 'unsupported',
        outputType: null,
        path: null,
        codes: ['SF0251'],
      },
      {
        characterId: 62,
        sourceTag: 'DefineBitsLossless',
        status: 'unsupported',
        outputType: null,
        path: null,
        codes: ['SF0260'],
      },
      {
        characterId: 63,
        sourceTag: 'DefineFont4',
        status: 'unsupported',
        outputType: null,
        path: null,
        codes: ['SF0270'],
      },
      {
        characterId: 64,
        sourceTag: 'DefineBitsJPEG2',
        status: 'unsupported',
        outputType: null,
        path: null,
        codes: ['SF0255', 'SF0252'],
      },
      {
        characterId: 71,
        sourceTag: 'DefineSound',
        status: 'fallback',
        outputType: 'audio/wav',
        path: 'sound-71.wav',
        codes: ['SF0307'],
      },
      {
        characterId: 72,
        sourceTag: 'DefineSound',
        status: 'fallback',
        outputType: 'audio/wav',
        path: 'sound-72.wav',
        codes: ['SF0307'],
      },
      {
        characterId: 73,
        sourceTag: 'DefineSound',
        status: 'fallback',
        outputType: 'audio/wav',
        path: 'sound-73.wav',
        codes: ['SF0307'],
      },
      {
        characterId: 74,
        sourceTag: 'DefineSound',
        status: 'fallback',
        outputType: 'audio/wav',
        path: 'sound-74.wav',
        codes: ['SF0303'],
      },
      {
        characterId: 75,
        sourceTag: 'DefineSound',
        status: 'fallback',
        outputType: 'audio/wav',
        path: 'sound-75.wav',
        codes: ['SF0301'],
      },
    ]);
    expect(manifest.assets.find((asset) => asset.characterId === 63)?.diagnostics[0]?.severity).toBe('error');
    expect(
      manifest.assets.filter((asset) => asset.characterId >= 71).every((asset) => asset.metadata?.silent === true),
    ).toBe(true);
    for (const id of [71, 72, 73, 74, 75]) {
      const wav = readFileSync(join(outDir, `sound-${id}.wav`));
      expect(wav.subarray(0, 4).toString('ascii')).toBe('RIFF');
      expect(wav.subarray(44).every((sample) => sample === 0)).toBe(true);
    }
    expect(captured.err.join('\n')).toContain('SF0251 #61');
    expect(captured.err.join('\n')).toContain('SF0260 #62');
    expect(captured.err.join('\n')).toContain('SF0270 #63');
    expect(captured.err.join('\n')).toContain('SF0301 #75');
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
