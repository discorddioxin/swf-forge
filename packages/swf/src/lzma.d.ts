/** Ambient declaration for the optional pure-JS `lzma` package (LZMA_alone in/out, synchronous). */
declare module 'lzma' {
  export function compress(input: Uint8Array | number[]): number[];
  export function decompress(input: Uint8Array | number[]): number[];
  export const LZMA: unknown;
}
