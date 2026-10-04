/**
 * Strings — `IMPL-010` §5.4.
 *
 * A string is a NUL-terminated byte run. Version >= 6 is UTF-8; versions 1–5 carried no encoding tag
 * and the player guessed from the locale, so we apply the documented fallback ladder and say so
 * (`SF0012`).
 */

export interface DecodedString {
  readonly value: string;
  readonly byteLength: number;
  /** True when the raw bytes were not valid UTF-8. */
  readonly invalidUtf8: boolean;
  /** Encoding actually used, for the diagnostic message. */
  readonly encoding: 'utf-8' | 'windows-1252' | 'latin1' | 'shift-jis';
}

/** Windows-1252 differences from Latin-1 in the 0x80–0x9F band. */
const CP1252_HIGH: Readonly<Record<number, number>> = {
  0x80: 0x20ac, 0x82: 0x201a, 0x83: 0x0192, 0x84: 0x201e, 0x85: 0x2026, 0x86: 0x2020, 0x87: 0x2021,
  0x88: 0x02c6, 0x89: 0x2030, 0x8a: 0x0160, 0x8b: 0x2039, 0x8c: 0x0152, 0x8e: 0x017d, 0x91: 0x2018,
  0x92: 0x2019, 0x93: 0x201c, 0x94: 0x201d, 0x95: 0x2022, 0x96: 0x2013, 0x97: 0x2014, 0x98: 0x02dc,
  0x99: 0x2122, 0x9a: 0x0161, 0x9b: 0x203a, 0x9c: 0x0153, 0x9e: 0x017e, 0x9f: 0x0178,
};

export function decodeLegacy(bytes: Uint8Array, encoding: 'windows-1252' | 'latin1'): string {
  let out = '';
  for (const byte of bytes) {
    const code = encoding === 'windows-1252' ? CP1252_HIGH[byte] ?? byte : byte;
    out += String.fromCharCode(code);
  }
  return out;
}

export function decodeUtf8(bytes: Uint8Array): { value: string; invalid: boolean } {
  const decoder = new TextDecoder('utf-8', { fatal: false });
  const value = decoder.decode(bytes);
  return { value, invalid: value.includes('\uFFFD') };
}

export interface StringReadOptions {
  /** Movie version; decides UTF-8 (>= 6) vs legacy decoding (<= 5). */
  version?: number;
  /** How to decode when version <= 5 and no better signal exists. Default 'windows-1252'. */
  legacyEncoding?: 'windows-1252' | 'latin1' | 'shift-jis';
  /** Hard cap on raw bytes. Default 65536. */
  maxBytes?: number;
}

/**
 * Decode a NUL-terminated byte run (the terminator is not part of `bytes`).
 */
export function decodeString(
  bytes: Uint8Array,
  opts: StringReadOptions = {},
): { decoded: DecodedString; truncated: boolean } {
  const maxBytes = opts.maxBytes ?? 65536;
  const truncated = bytes.length > maxBytes;
  const slice = truncated ? bytes.subarray(0, maxBytes) : bytes;
  const version = opts.version ?? 6;

  if (version >= 6) {
    const { value, invalid } = decodeUtf8(slice);
    return {
      decoded: { value, byteLength: slice.length, invalidUtf8: invalid, encoding: 'utf-8' },
      truncated,
    };
  }

  const legacy = opts.legacyEncoding ?? 'windows-1252';
  if (legacy === 'shift-jis') {
    // Shift-JIS is supplied by a pre-scan of DefineFontInfo (doc 080); TextDecoder handles it.
    const value = new TextDecoder('shift-jis', { fatal: false }).decode(slice);
    return {
      decoded: { value, byteLength: slice.length, invalidUtf8: false, encoding: 'shift-jis' },
      truncated,
    };
  }
  const encoding = legacy === 'latin1' ? 'latin1' : 'windows-1252';
  return {
    decoded: {
      value: decodeLegacy(slice, encoding),
      byteLength: slice.length,
      invalidUtf8: false,
      encoding,
    },
    truncated,
  };
}
