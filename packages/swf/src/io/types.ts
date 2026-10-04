/** Primitive record types — `IMPL-010` §6. Twips unless a name says otherwise. */

export interface Rect {
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

/** Affine 2x3. `tx`/`ty` are in twips; `a`,`b`,`c`,`d` are unitless. */
export interface Mat2D {
  a: number;
  b: number;
  c: number;
  d: number;
  tx: number;
  ty: number;
}

export interface MatrixDecomposition {
  /** Clock-positive in y-down space (`E-005`). */
  rotationDeg: number;
  scaleX: number;
  /** Signed: a negative value preserves a reflection. */
  scaleY: number;
  skewXDeg: number;
  translatePx: { x: number; y: number };
}

/** Colour transform. `m` terms are 8.8 (256 = 1.0); `a` terms are raw 0..255 offsets. */
export interface Cxform {
  rm: number;
  gm: number;
  bm: number;
  am: number;
  ra: number;
  ga: number;
  ba: number;
  aa: number;
}

export interface Rgba {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const IDENTITY_CXFORM: Cxform = {
  rm: 256,
  gm: 256,
  bm: 256,
  am: 256,
  ra: 0,
  ga: 0,
  ba: 0,
  aa: 0,
};

export const IDENTITY_MATRIX: Mat2D = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 };

/** `LanguageCode` — Ch.1 table; unknown values are preserved (`IMPL-010-R027`). */
export const enum LanguageCode {
  None = 0,
  Latin = 1,
  Japanese = 2,
  Korean = 3,
  SimplifiedChinese = 4,
  TraditionalChinese = 5,
}

export const TWIPS_PER_PIXEL = 20;

export function toPixels(twips: number): number {
  return twips / TWIPS_PER_PIXEL;
}

/** Matrix decomposition — `IMPL-010` §5.7 (sign convention of `E-005`). */
export function decomposeMatrix(m: Mat2D): MatrixDecomposition {
  const rotationDeg = (Math.atan2(m.c, m.a) * 180) / Math.PI;
  const scaleX = Math.hypot(m.a, m.c);
  const det = m.a * m.d - m.b * m.c;
  const scaleY = scaleX === 0 ? 0 : det / scaleX;
  const skewXDeg = det === 0 ? 0 : (Math.atan2(m.a * m.b + m.c * m.d, det) * 180) / Math.PI;
  return {
    rotationDeg,
    scaleX,
    scaleY,
    skewXDeg,
    translatePx: { x: m.tx / TWIPS_PER_PIXEL, y: m.ty / TWIPS_PER_PIXEL },
  };
}
