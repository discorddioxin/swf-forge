/**
 * Allocation and copy budgets — `T-SWF-017` and the `SWF-R001` payload-copy bound
 * (`IMPL-010-R043`–`R045`), measured by the named deterministic counter
 * (`allocationCounter` in `packages/swf/src/io/counter.ts`), never by a heap delta.
 *
 * Measured-interval discipline (`IMPL-010-R044`): inputs and cursors are constructed before
 * measurement, each path is warmed first (the per-cursor `DataView` is created there), the
 * counter is reset at the start of the measured interval, and every loop folds its reads into
 * a checksum so the work is observable and cannot be optimised away.
 */

import { describe, expect, it } from 'vitest';

import {
  Cursor,
  allocationCounter,
  openSwf,
  readCxform,
  readMatrix,
  readRect,
  resetAllocationCounter,
} from '@swf-forge/swf';
import { ByteWriter, buildSwf, concat, endTag, showFrames, tag, writeRect } from '@swf-forge/swf/test-support';

const READS = 1_000_000;

describe('allocation counter (IMPL-010-R043–R045)', () => {
  it('T-SWF-017: zero primitive allocations over 10^6 warm byte-aligned reads', () => {
    const w = new ByteWriter();
    // Layout, in read order: u8 u16 u24 u32 s32 fixed fixed8 float16 float32 float64 encodedU32.
    w.u8(0x7f).u16(0x1234).u24(0x345678).u32(0x89ab_cdef).s32(-123_456);
    w.fixed(12.5).fixed8(-3.25);
    w.u16(0x3c00); // float16 1.0 (never a special, so no diagnostic on the measured path)
    w.float32(1.5).float64(-2.25);
    w.encodedU32(300);
    const block = w.toUint8Array();
    const cursor = new Cursor(block);
    const readBlock = (c: Cursor): number => {
      let sum = 0;
      sum += c.u8() + c.u16() + c.u24() + c.u32() + c.s32();
      sum += c.fixed() + c.fixed8() + c.float16() + c.float32() + c.float64();
      sum += c.encodedU32();
      return sum;
    };
    // Warm-up (constructs the cursor's DataView), then the measured interval.
    let checksum = 0;
    for (let i = 0; i < 1_000; i += 1) {
      if (cursor.remaining < block.length) cursor.seek(0);
      checksum += readBlock(cursor);
    }
    resetAllocationCounter();
    let reads = 0;
    while (reads < READS) {
      if (cursor.remaining < block.length) cursor.seek(0);
      checksum += readBlock(cursor);
      reads += 11;
    }
    expect(Number.isFinite(checksum)).toBe(true);
    expect(allocationCounter.primitiveAllocations).toBe(0);
  });

  it('T-SWF-017: zero primitive allocations over 10^6 warm bit reads (ub/sb/fb)', () => {
    const w = new ByteWriter();
    for (let i = 0; i < 64; i += 1) w.bits(0b101, 3);
    const cursor = new Cursor(w.align().toUint8Array());
    const readBits = (c: Cursor): number => c.ub(3) + c.sb(4) + c.fb(9);
    let checksum = 0;
    for (let i = 0; i < 1_000; i += 1) {
      if (cursor.remaining < 2) cursor.seek(0);
      checksum += readBits(cursor);
    }
    resetAllocationCounter();
    let reads = 0;
    while (reads < READS) {
      if (cursor.remaining < 2) cursor.seek(0);
      checksum += readBits(cursor);
      reads += 3;
    }
    expect(Number.isFinite(checksum)).toBe(true);
    expect(allocationCounter.primitiveAllocations).toBe(0);
  });

  it('T-SWF-017: record readers allocate exactly their one result object per read', () => {
    const rectWriter = new ByteWriter();
    writeRect(rectWriter, { xMin: -10, xMax: 500, yMin: 0, yMax: 400 });
    const rectBytes = rectWriter.toUint8Array();
    const matrixWriter = new ByteWriter();
    matrixWriter.bits(0, 1).bits(0, 1).bits(5, 5).bits(100, 5).bits(-50, 5).align();
    const matrixBytes = matrixWriter.toUint8Array();
    const cxWriter = new ByteWriter();
    cxWriter.bits(0, 1).bits(0, 1).bits(0, 4).align();
    const cxBytes = cxWriter.toUint8Array();

    const N = 10_000;
    resetAllocationCounter();
    let checksum = 0;
    for (let i = 0; i < N; i += 1) {
      const r = readRect(new Cursor(rectBytes));
      const m = readMatrix(new Cursor(matrixBytes));
      const x = readCxform(new Cursor(cxBytes));
      checksum += r.xMax + m.tx + x.rm;
    }
    expect(checksum).toBeGreaterThan(0);
    // Separately stated record budget (R045): exactly one fresh result object per read,
    // and nothing at all on the primitive counter.
    expect(allocationCounter.recordAllocations).toBe(3 * N);
    expect(allocationCounter.primitiveAllocations).toBe(0);
  });

  it('SWF-R001: a >=5 MiB FWS parse makes at most one payload copy, and views share the buffer', () => {
    const payload = new Uint8Array(5 * 1024 * 1024 + 16).fill(0x5a);
    const bytes = buildSwf({ body: concat(tag(87, payload), showFrames(1), endTag()) });
    expect(bytes.length).toBeGreaterThan(5 * 1024 * 1024);
    resetAllocationCounter();
    const file = openSwf(bytes);
    for (const ref of file.tagIndex.tags) {
      const payloadView = file.readTag(ref);
      if (payloadView.kind === 'bytes') {
        // Tag payloads are views into the movie's one buffer, never copies.
        expect(payloadView.view.buffer).toBe(bytes.buffer);
      }
    }
    expect(allocationCounter.payloadCopies).toBeLessThanOrEqual(1);

    // viewBytes shares; takeBytes is the classified, counted copy.
    const cursor = new Cursor(bytes);
    expect(cursor.viewBytes(8).buffer).toBe(bytes.buffer);
    const before = allocationCounter.payloadCopies;
    expect(cursor.takeBytes(8).length).toBe(8);
    expect(allocationCounter.payloadCopies).toBe(before + 1);
  });
});
