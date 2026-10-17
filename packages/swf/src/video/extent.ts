/**
 * Video stream headers and byte extents (`IMPL-110` §3, `WP-110-12`, `T-MOD-917`).
 *
 * Ch.14's packet rules are `WP-110-01`'s and the codec decoders' (P10). What an earlier phase
 * needs is only the *size* of each stream, because `IMPL-120-R031` budgets video the way
 * `CMP` §4.4 budgets sound — the `DefineVideoStream` header plus the summed `VideoFrame` payload
 * lengths, with no transcode and no decoder in the loop. That is what this module does, and
 * deliberately nothing more: it reads the two tag headers and adds the payloads up.
 *
 * The exclusions are the requirement, not an oversight. `T-MOD-917` asks for the measurement
 * "with no packet payload parsed and no codec validation attempted", so an unknown `CodecID`
 * costs `SF0240` in the codec dispatch (`WP-110-01`) and never here; a `NumFrames` disagreement
 * is `IMPL-110-R006`'s `SF0242` and is reported there too, as a *judgement* — here the declared
 * count and the counted frames are both returned so the judgement stays elsewhere. `Width` and
 * `Height` are the placement size (`IMPL-110-R008`), so nothing here may compare them to a
 * coded frame's own dimensions.
 */

import type { Cursor } from '../io/cursor.js';

/**
 * `CharacterID…CodecID`: four `UI16`s (8 bytes), the flags byte (UB[4]+UB[3]+UB[1]) and the
 * `CodecID` byte (`APP-§10.12`).
 */
export const DEFINE_VIDEO_STREAM_BYTES = 10;

/** The `StreamID` + `FrameNum` prefix every `VideoFrame` payload follows. */
export const VIDEO_FRAME_BYTES = 4;

export interface VideoStreamHeader {
  /** The `CharacterID` that `VideoFrame.StreamID` refers back to. */
  readonly id: number;
  /** Frames the stream *declares*; the count actually present is `VideoStreamExtent.frameCount`. */
  readonly numFrames: number;
  /** Placement size in stage pixels, not the coded size (`IMPL-110-R008`). */
  readonly width: number;
  readonly height: number;
  /** `VideoFlagsReserved`, documented as 0; preserved so the model can report a non-zero one. */
  readonly reserved: number;
  /** `VideoFlagsDeblocking`, 0 = take the value from the packet (`IMPL-110-R009`). */
  readonly deblocking: number;
  readonly smoothing: boolean;
  /** Raw `CodecID`. Validation of this byte is `WP-110-01`'s (`SF0240`). */
  readonly codecId: number;
}

export interface VideoFrameExtent {
  readonly streamId: number;
  readonly frameNum: number;
  /** Payload bytes: the tag body less the four header bytes. Never inspected. */
  readonly payloadBytes: number;
}

export interface VideoStreamExtent {
  readonly header: VideoStreamHeader;
  readonly frames: readonly VideoFrameExtent[];
  /** `VideoFrame` tags attributed to this stream. */
  readonly frameCount: number;
  /** Declared frame count, echoed so a caller can compare without re-reading the header. */
  readonly declaredFrames: number;
  /** Σ payload bytes of the attributed frames. */
  readonly payloadBytes: number;
  /** The header's own bytes plus `payloadBytes` — the figure `IMPL-120-R031` budgets. */
  readonly totalBytes: number;
}

export interface VideoExtentSummary {
  readonly streams: readonly VideoStreamExtent[];
  /** `VideoFrame` tags whose `StreamID` matched no `DefineVideoStream`. */
  readonly unclaimed: readonly VideoFrameExtent[];
  /** Σ over streams; unclaimed frames are measured but not budgeted. */
  readonly payloadBytes: number;
  readonly totalBytes: number;
}

/**
 * Read the `DefineVideoStream` (60) header. A body shorter than the ten documented bytes is
 * the cursor's problem: `soft` mode records `SF0013` (`READ_PAST_BOUNDS`) and yields zeroes.
 */
export function readVideoStreamHeader(c: Cursor): VideoStreamHeader {
  const id = c.u16();
  const numFrames = c.u16();
  const width = c.u16();
  const height = c.u16();
  const reserved = c.ub(4);
  const deblocking = c.ub(3);
  const smoothing = c.ub(1) === 1;
  c.align();
  const codecId = c.u8();
  return { id, numFrames, width, height, reserved, deblocking, smoothing, codecId };
}

/**
 * Read the `VideoFrame` (61) header and measure the payload without reading it.
 *
 * `payloadBytes` is `remaining` after the four header bytes, so a frame truncated inside the tag
 * bounds measures what is there rather than what the codec would want — which is the point: the
 * extent is what the file actually carries.
 */
export function readVideoFrameExtent(c: Cursor): VideoFrameExtent {
  const streamId = c.u16();
  const frameNum = c.u16();
  return { streamId, frameNum, payloadBytes: c.remaining };
}

/**
 * Group frames under their stream by `StreamID` and sum the extents.
 *
 * Frames are attributed by id, not by adjacency, because `IMPL-110-R011` lets video tags sit in
 * sprites and `IMPL-110-R010` spreads a stream across timeline frames where other tags intervene.
 * A stream with no frames is still returned (a `DefineVideoStream` is a byte cost on its own), and
 * a duplicate `DefineVideoStream` id keeps the **first** header, so the summary is a function of
 * the file rather than of scan order for the frames and of definition order for the headers.
 */
export function summariseVideoStreams(
  headers: readonly VideoStreamHeader[],
  frames: readonly VideoFrameExtent[],
): VideoExtentSummary {
  const streams: VideoStreamExtent[] = [];
  const byId = new Map<number, VideoStreamExtent>();
  const attributed = new Map<number, VideoFrameExtent[]>();
  for (const header of headers) {
    if (byId.has(header.id)) continue;
    const extent: VideoStreamExtent = {
      header,
      frames: [],
      frameCount: 0,
      declaredFrames: header.numFrames,
      payloadBytes: 0,
      totalBytes: DEFINE_VIDEO_STREAM_BYTES,
    };
    streams.push(extent);
    byId.set(header.id, extent);
    attributed.set(header.id, []);
  }
  const unclaimed: VideoFrameExtent[] = [];
  for (const frame of frames) {
    const own = attributed.get(frame.streamId);
    if (own === undefined) unclaimed.push(frame);
    else own.push(frame);
  }
  for (const [index, stream] of streams.entries()) {
    const own = attributed.get(stream.header.id) ?? [];
    const payloadBytes = own.reduce((sum, frame) => sum + frame.payloadBytes, 0);
    Object.assign(stream, {
      frames: Object.freeze([...own]),
      frameCount: own.length,
      payloadBytes,
      totalBytes: DEFINE_VIDEO_STREAM_BYTES + payloadBytes,
    });
    Object.freeze(streams[index]);
  }
  return Object.freeze({
    streams: Object.freeze(streams),
    unclaimed: Object.freeze(unclaimed),
    payloadBytes: streams.reduce((sum, stream) => sum + stream.payloadBytes, 0),
    totalBytes: streams.reduce((sum, stream) => sum + stream.totalBytes, 0),
  });
}
