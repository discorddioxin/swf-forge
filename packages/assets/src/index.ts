/** Deterministic build-time asset decoding; runtime rendering remains with downstream phases. */

export { BitmapDecodeError, decodeBitmap, encodeBitmapPng } from './images/decode.js';
export type { BitmapDecodeResult, BitmapDiagnostic, CanonicalBitmap } from './images/decode.js';
export { encodeFontWoff2 } from './fonts.js';
export type { FontWoff2Result } from './fonts.js';
