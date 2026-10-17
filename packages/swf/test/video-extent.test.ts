/**
 * `DefineVideoStream` headers and summed `VideoFrame` extents (`IMPL-110` §3, `WP-110-12`).
 *
 * @spec doc=IMPL-110 §3 — the two tag layouts, and `IMPL-120` §4 `IMPL-120-R031` for why the
 * measurement exists at P6: the video budget is summed from bytes, never from a transcode.
 */

import { describe, expect, it } from 'vitest';

import {
  Cursor,
  Tag,
  DEFINE_VIDEO_STREAM_BYTES,
  VIDEO_FRAME_BYTES,
  readVideoFrameExtent,
  readVideoStreamHeader,
  summariseVideoStreams,
} from '@swf-forge/swf';
import { ByteWriter } from '@swf-forge/swf/test-support';

import type { VideoFrameExtent, VideoStreamHeader } from '@swf-forge/swf';

function cursorFor(body: Uint8Array, tagCode: number): Cursor {
  return new Cursor(body, 0, body.length, { tagCode });
}

function defineVideoStream(input: {
  id: number;
  numFrames: number;
  width?: number;
  height?: number;
  reserved?: number;
  deblocking?: number;
  smoothing?: boolean;
  codecId?: number;
}): Uint8Array {
  const w = new ByteWriter();
  w.u16(input.id)
    .u16(input.numFrames)
    .u16(input.width ?? 120)
    .u16(input.height ?? 90);
  w.bits(input.reserved ?? 0, 4)
    .bits(input.deblocking ?? 0, 3)
    .bits(input.smoothing ? 1 : 0, 1);
  w.u8(input.codecId ?? 4);
  return w.toUint8Array();
}

function videoFrame(streamId: number, frameNum: number, payloadBytes: number): Uint8Array {
  const w = new ByteWriter();
  w.u16(streamId).u16(frameNum);
  for (let i = 0; i < payloadBytes; i += 1) w.u8(0xff);
  return w.toUint8Array();
}

function header(body: Uint8Array): VideoStreamHeader {
  return readVideoStreamHeader(cursorFor(body, Tag.DefineVideoStream));
}

describe('DefineVideoStream header decode (T-MOD-917)', () => {
  it('T-MOD-917: decodes every documented field of the header', () => {
    const body = defineVideoStream({
      id: 17,
      numFrames: 3,
      width: 320,
      height: 240,
      deblocking: 2,
      smoothing: true,
      codecId: 4,
    });
    expect(body.length).toBe(DEFINE_VIDEO_STREAM_BYTES);
    expect(header(body)).toEqual({
      id: 17,
      numFrames: 3,
      width: 320,
      height: 240,
      reserved: 0,
      deblocking: 2,
      smoothing: true,
      codecId: 4,
    });
  });

  it('T-MOD-917: splits the flags byte 4/3/1 so smoothing is the last bit', () => {
    const w = new ByteWriter();
    w.u16(1).u16(0).u16(0).u16(0);
    w.bits(0b0000, 4).bits(0b101, 3).bits(0, 1);
    w.u8(3);
    const model = readVideoStreamHeader(cursorFor(w.toUint8Array(), Tag.DefineVideoStream));
    expect(model).toMatchObject({ reserved: 0, deblocking: 5, smoothing: false });
    const flagged = defineVideoStream({ id: 1, numFrames: 0, reserved: 0b0010, deblocking: 0, codecId: 2 });
    expect(header(flagged).reserved).toBe(2);
  });

  it('T-MOD-917: never validates the codec id, so an unknown one costs no diagnostic', () => {
    for (const codecId of [0, 1, 6, 7, 200, 255]) {
      const cursor = cursorFor(defineVideoStream({ id: 9, numFrames: 0, codecId }), Tag.DefineVideoStream);
      expect(readVideoStreamHeader(cursor).codecId).toBe(codecId);
      expect(cursor.diagnostics).toEqual([]);
    }
  });

  it("T-MOD-917: a body shorter than twelve bytes is the cursor's diagnostic, not a throw", () => {
    const truncated = defineVideoStream({ id: 5, numFrames: 1 }).subarray(0, 6);
    const cursor = cursorFor(truncated, Tag.DefineVideoStream);
    expect(() => readVideoStreamHeader(cursor)).not.toThrow();
    const model = readVideoStreamHeader(cursorFor(truncated, Tag.DefineVideoStream));
    expect(model.id).toBe(5);
    expect(model.numFrames).toBe(1);
    expect(cursor.diagnostics.map((d) => d.code)).toContain('SF0013');
  });
});

describe('VideoFrame extents (T-MOD-917)', () => {
  it('T-MOD-917: measures the payload as the body less the four header bytes', () => {
    const body = videoFrame(17, 2, 4096);
    const frame = readVideoFrameExtent(cursorFor(body, Tag.VideoFrame));
    expect(frame).toEqual({ streamId: 17, frameNum: 2, payloadBytes: body.length - VIDEO_FRAME_BYTES });
    expect(frame.payloadBytes).toBe(4096);
  });

  it('T-MOD-917: an empty payload still counts as a frame', () => {
    const body = videoFrame(3, 0, 0);
    expect(readVideoFrameExtent(cursorFor(body, Tag.VideoFrame))).toEqual({
      streamId: 3,
      frameNum: 0,
      payloadBytes: 0,
    });
  });

  it('T-MOD-917: never parses the packet, so bytes no codec would accept are measured untouched', () => {
    const w = new ByteWriter();
    w.u16(8).u16(0);
    for (const byte of [0x00, 0x80, 0x01, 0xff, 0x00]) w.u8(byte);
    const body = w.toUint8Array();
    const cursor = cursorFor(body, Tag.VideoFrame);
    expect(readVideoFrameExtent(cursor)).toEqual({ streamId: 8, frameNum: 0, payloadBytes: 5 });
    expect(cursor.diagnostics).toEqual([]);
  });
});

function frame(streamId: number, frameNum: number, payloadBytes: number): VideoFrameExtent {
  return { streamId, frameNum, payloadBytes };
}

describe('video byte extents summed per stream (T-MOD-917)', () => {
  it('T-MOD-917: attributes frames by StreamID across interleaved streams', () => {
    const a = header(defineVideoStream({ id: 1, numFrames: 2 }));
    const b = header(defineVideoStream({ id: 2, numFrames: 1 }));
    const summary = summariseVideoStreams([a, b], [frame(2, 0, 700), frame(1, 0, 100), frame(1, 1, 200)]);
    expect(summary.streams.map((s) => [s.header.id, s.frameCount, s.payloadBytes, s.totalBytes])).toEqual([
      [1, 2, 300, DEFINE_VIDEO_STREAM_BYTES + 300],
      [2, 1, 700, DEFINE_VIDEO_STREAM_BYTES + 700],
    ]);
    expect(summary.payloadBytes).toBe(1000);
    expect(summary.totalBytes).toBe(2 * DEFINE_VIDEO_STREAM_BYTES + 1000);
    expect(summary.unclaimed).toEqual([]);
  });

  it('T-MOD-917: reports the declared and counted frame counts without judging them', () => {
    const declared = header(defineVideoStream({ id: 4, numFrames: 3 }));
    const [stream] = summariseVideoStreams([declared], [frame(4, 0, 10), frame(4, 1, 10)]).streams;
    expect(stream).toMatchObject({ declaredFrames: 3, frameCount: 2 });
    expect(stream?.header.numFrames).toBe(3);
  });

  it('T-MOD-917: keeps extra frames in the extents, since the count is a judgement for the model', () => {
    const declared = header(defineVideoStream({ id: 4, numFrames: 1 }));
    const [stream] = summariseVideoStreams([declared], [frame(4, 0, 10), frame(4, 1, 20), frame(4, 2, 30)]).streams;
    expect(stream).toMatchObject({ frameCount: 3, payloadBytes: 60 });
  });

  it('T-MOD-917: a stream with no frames still costs its header bytes; orphans are measured separately', () => {
    const declared = header(defineVideoStream({ id: 6, numFrames: 4 }));
    const orphan = frame(7, 0, 500);
    const summary = summariseVideoStreams([declared], [orphan]);
    expect(summary.streams[0]).toMatchObject({ frameCount: 0, payloadBytes: 0, totalBytes: DEFINE_VIDEO_STREAM_BYTES });
    expect(summary.unclaimed).toEqual([orphan]);
    expect(summary.payloadBytes).toBe(0);
    expect(summary.totalBytes).toBe(DEFINE_VIDEO_STREAM_BYTES);
  });

  it('T-MOD-917: a duplicate character id keeps the first definition, so the summary is scan-order-free', () => {
    const first = header(defineVideoStream({ id: 2, numFrames: 1, width: 100, codecId: 4 }));
    const second = header(defineVideoStream({ id: 2, numFrames: 9, width: 640, codecId: 3 }));
    const summary = summariseVideoStreams([first, second], [frame(2, 0, 40)]);
    expect(summary.streams.length).toBe(1);
    expect(summary.streams[0]).toMatchObject({
      header: { width: 100, codecId: 4 },
      declaredFrames: 1,
      frameCount: 1,
      payloadBytes: 40,
    });
  });

  it('T-MOD-917: the frozen summary is a pure function of the inputs', () => {
    const declared = header(defineVideoStream({ id: 1, numFrames: 1 }));
    const one = summariseVideoStreams([declared], [frame(1, 0, 12)]);
    const two = summariseVideoStreams([declared], [frame(1, 0, 12)]);
    expect(one).toEqual(two);
    expect(Object.isFrozen(one) && Object.isFrozen(one.streams[0])).toBe(true);
  });
});
