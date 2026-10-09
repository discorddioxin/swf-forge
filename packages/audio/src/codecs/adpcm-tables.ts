/**
 * SWF ADPCM tables (SWF File Format Specification, Ch. 11; APP reference table §9; AUD-R005).
 *
 * The 89-entry step table is the IMA/DVI ADPCM standard table, which SWF adopts unchanged. It is
 * transcribed here from the IMA reference and cross-checked against `ruffle`'s `STEP_TABLE`
 * (`core/src/backend/audio/decoders/adpcm.rs`); entries 69-71 are `5358, 5894, 6484`, which three
 * earlier transcriptions in this repo got wrong (`F-P3-19`).
 *
 * The magnitude-index tables are SWF's, keyed by code width.
 *
 * The delta reconstruction does **not** live here, and deliberately is not the closed form
 * `floor(((2*magnitude + 1) * step) / 2^(bits - 1))`. IMA accumulates right-shifted terms and
 * truncates each one separately, which is not the same number — see `adpcm.ts`.
 */

export const SWF_ADPCM_STEP_TABLE: readonly number[] = [
  7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 19, 21, 23, 25, 28, 31, 34, 37, 41, 45, 50, 55, 60, 66, 73, 80, 88, 97, 107, 118,
  130, 143, 157, 173, 190, 209, 230, 253, 279, 307, 337, 371, 408, 449, 494, 544, 598, 658, 724, 796, 876, 963, 1060,
  1166, 1282, 1411, 1552, 1707, 1878, 2066, 2272, 2499, 2749, 3024, 3327, 3660, 4026, 4428, 4871, 5358, 5894, 6484,
  7132, 7845, 8630, 9493, 10442, 11487, 12635, 13899, 15289, 16818, 18500, 20350, 22385, 24623, 27086, 29794, 32767,
];

export const SWF_ADPCM_INDEX_TABLES: Readonly<Record<2 | 3 | 4 | 5, readonly number[]>> = {
  2: [-1, 2],
  3: [-1, -1, 2, 4],
  4: [-1, -1, -1, -1, 2, 4, 6, 8],
  5: [-1, -1, -1, -1, -1, -1, -1, -1, 1, 2, 4, 6, 8, 10, 13, 16],
};
