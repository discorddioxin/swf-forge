/**
 * Cancellation — `IMPL-120-R003`.
 *
 * Cancellation is not a special case in the runner; it is a signal threaded through it. The runner
 * checkpoints at every stage and pass boundary, and a long body of work — an asset encode loop, a
 * per-character decode — checkpoints per item by calling `throwIfCancelled()`. The requirement that
 * shapes the API is the 2 s one: a 30-minute encode must respond to Ctrl-C quickly, which it can only
 * do if the loop that owns the work asks, so the token is passed *into* stages rather than polled from
 * outside them.
 *
 * A cancelled run leaves no partial output because the runner never writes: stages return the files they
 * would emit (`IMPL-120-R004` keeps `--dry-run` on the same path), and the writer that eventually puts
 * them on disk writes content-addressed temp names and sorts before renaming (`IMPL-120-R023`).
 */

/** Thrown by `throwIfCancelled`. The runner catches it and records `cancelled`; it never escapes. */
export class PipelineCancelled extends Error {
  readonly reason: string;

  constructor(reason: string) {
    super(`pipeline cancelled: ${reason}`);
    this.name = 'PipelineCancelled';
    this.reason = reason;
  }
}

export interface CancellationToken {
  /** True once `cancel` has been called. Idempotent: the first reason wins. */
  readonly cancelled: boolean;
  readonly reason: string | null;
  /** Requests cancellation. Safe to call from a signal handler; never throws. */
  cancel(reason: string): void;
  /**
   * The checkpoint. Call it at every stage boundary (the runner does) and per item inside any loop whose
   * total duration a user would notice (`IMPL-120-R003`).
   */
  throwIfCancelled(): void;
}

/** A token that is never cancelled, for callers that do not wire one (tests, `--no-cancel`). */
export function createCancellationToken(): CancellationToken {
  let reason: string | null = null;
  return {
    get cancelled(): boolean {
      return reason !== null;
    },
    get reason(): string | null {
      return reason;
    },
    cancel(next: string): void {
      if (reason === null) reason = next;
    },
    throwIfCancelled(): void {
      if (reason !== null) throw new PipelineCancelled(reason);
    },
  };
}

/**
 * Bridges a platform interruption — the CLI's `SIGINT`, an editor task's `AbortSignal` — to a token.
 * Returns the unsubscribe function so a run can detach without leaking a listener.
 */
export function linkAbortSignal(token: CancellationToken, signal: AbortSignal, reason = 'interrupted'): () => void {
  if (signal.aborted) {
    token.cancel(reason);
    return (): void => {};
  }
  const onAbort = (): void => {
    token.cancel(reason);
  };
  signal.addEventListener('abort', onAbort, { once: true });
  return (): void => {
    signal.removeEventListener('abort', onAbort);
  };
}
