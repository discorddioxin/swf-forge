/**
 * The named, deterministic allocation counter (`IMPL-010-R043`–`R045`).
 *
 * `T-SWF-017` and the `SWF-R001` copy budget are measured by this counter, never by a heap or
 * RSS delta: measured code increments a class at each allocation site, and tests snapshot the
 * counter before and after the measured interval (`IMPL-010-R044`). The classes are kept
 * separate because the two obligations measure different things (`IMPL-010-R045`):
 *
 * - `primitiveAllocations` — objects created per read on the warm steady-state primitive path
 *   (bound: exactly 0). Sites: the per-cursor `DataView` (created once, at warm-up), and each
 *   diagnostic object a read emits.
 * - `recordAllocations` — fresh result objects from the record readers (`RECT`/`MATRIX`/
 *   `CXFORM`), which must return a new object per read (bound: exactly 1 per read).
 * - `payloadCopies` / `payloadCopyBytes` — byte copies out of the movie's single input buffer
 *   (`takeBytes`/`rest`); views (`viewBytes`, tag payloads) share the buffer and are not copies
 *   (bound for a whole ≥ 5 MiB `FWS` parse: at most 1).
 */

export interface AllocationCounter {
  primitiveAllocations: number;
  recordAllocations: number;
  payloadCopies: number;
  payloadCopyBytes: number;
}

/** The one counter instance; tests snapshot and reset it around a measured interval. */
export const allocationCounter: AllocationCounter = {
  primitiveAllocations: 0,
  recordAllocations: 0,
  payloadCopies: 0,
  payloadCopyBytes: 0,
};

export function resetAllocationCounter(): void {
  allocationCounter.primitiveAllocations = 0;
  allocationCounter.recordAllocations = 0;
  allocationCounter.payloadCopies = 0;
  allocationCounter.payloadCopyBytes = 0;
}

export function notePrimitiveAllocation(): void {
  allocationCounter.primitiveAllocations += 1;
}

export function noteRecordAllocation(): void {
  allocationCounter.recordAllocations += 1;
}

export function notePayloadCopy(bytes: number): void {
  allocationCounter.payloadCopies += 1;
  allocationCounter.payloadCopyBytes += bytes;
}
