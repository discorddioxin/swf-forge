declare module 'jpeg-js' {
  export interface JpegImage {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8Array;
  }
  export function decode(
    data: Uint8Array,
    options?: { readonly useTArray?: boolean; readonly formatAsRGBA?: boolean },
  ): JpegImage;
  export function encode(
    image: { readonly width: number; readonly height: number; readonly data: Uint8Array },
    quality?: number,
  ): JpegImage;
}

declare module 'pngjs' {
  export class PNG {
    readonly width: number;
    readonly height: number;
    readonly data: Uint8Array;
    static sync: {
      read(data: Uint8Array): PNG;
      write(image: { readonly width: number; readonly height: number; readonly data: Uint8Array }): Uint8Array;
    };
  }
}

declare module 'omggif' {
  export class GifReader {
    constructor(data: Uint8Array);
    readonly width: number;
    readonly height: number;
    numFrames(): number;
    decodeAndBlitFrameRGBA(frame: number, pixels: Uint8Array): number;
  }
}
