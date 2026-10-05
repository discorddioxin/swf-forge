/**
 * The per-frame processing order — `IMPL-020` §8 / `IMPL-020-R034`.
 *
 * Exported as **data** so that the model builder and the runtime consume the same sequence
 * instead of re-deriving an order locally. Duplicated ordering logic between build and run time is
 * how "it plays differently than it was compiled" bugs happen.
 *
 * `DoInitAction` collection itself happens in the model pass (`model/movie.ts`), which is the first
 * consumer that knows which characters are sprites; this module owns only the shared order.
 */

/** One step of the per-frame order (Ch.2 "Processing a SWF file"). */
export const ProcessStep = {
  /** 1. Apply the frame's display-list operations in file order (place and remove tags). */
  ApplyDisplayList: 'apply-display-list',
  /** 2. Dispatch clip events for objects entering/leaving the frame (onLoad/onUnload/onEnterFrame). */
  DispatchClipEvents: 'dispatch-clip-events',
  /** 3. Execute the frame's DoAction blocks in file order. */
  ExecuteActions: 'execute-actions',
  /** 4. Dispatch queued asynchronous completions and timers. */
  DispatchAsync: 'dispatch-async',
  /** 5. Advance child timelines (depth order), each recursively performing steps 1–4. */
  AdvanceChildTimelines: 'advance-child-timelines',
  /** 6. Present the frame; the stream sound position for this frame is committed. */
  PresentFrame: 'present-frame',
} as const;

export type ProcessStep = (typeof ProcessStep)[keyof typeof ProcessStep];

/** The normative per-frame sequence, in order. */
export const PROCESSING_ORDER: readonly ProcessStep[] = [
  ProcessStep.ApplyDisplayList,
  ProcessStep.DispatchClipEvents,
  ProcessStep.ExecuteActions,
  ProcessStep.DispatchAsync,
  ProcessStep.AdvanceChildTimelines,
  ProcessStep.PresentFrame,
];
