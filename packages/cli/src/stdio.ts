/**
 * Stdio that survives a pipeline (`swfforge build game.swf | head`, which is how a person looks at a tool).
 *
 * Node's `process.stdout.write` reports a closed reader as an *asynchronous* `error` event on the stream, and a
 * `Writable` with no `error` listener throws from the event emitter — so the first CLI in this repository that
 * printed its report into `head` died with an `EPIPE` stack instead of exiting. That is not a corner case: `| head`
 * is how a log gets read, `| grep` is how a CI job compares two runs, and a tool that crashes when the reader
 * leaves early is a tool whose output cannot be looked at.
 *
 * The rule chosen here is the narrow one: a write that failed because the *reader* went away is not an error worth
 * reporting — there is nobody left to report it to, and the exit code has already been computed — while any other
 * stream failure (a full disk on a redirected log, an I/O error on a device) is rethrown so the caller still turns
 * it into a verdict. And the synchronous path is guarded too, because a destroyed stream can throw from `write`
 * itself depending on the Node version; a CLI must not have its behaviour depend on that.
 *
 * The writer is a function over a `Writable`, not a read of `process.stdout`, so a test can hand it a stream it
 * owns and emit the error itself. That is the whole reason this is a module rather than three lines in `main.ts`.
 */

import type { Writable } from 'node:stream';

/** The error codes that mean "the reader is gone", which is not a fact about the build. */
const READER_GONE = new Set(['EPIPE', 'ERR_STREAM_DESTROYED', 'ERR_STREAM_WRITE_AFTER_END']);

export type LineWriter = (line: string) => void;

/**
 * A line writer over `stream`, with the pipe-closed noise absorbed.
 *
 * The listener is attached once, when the writer is made, and never removed: `main()` may print after the promise
 * it returns has resolved (a rejected-write flush), and a handler that had been detached would crash the process at
 * that moment with nothing left to report it.
 */
export function stdioWriter(stream: Writable): LineWriter {
  stream.on('error', (error: unknown) => {
    const code = typeof error === 'object' && error !== null ? (error as { code?: string }).code : undefined;
    if (code !== undefined && READER_GONE.has(code)) return;
    throw error;
  });
  return (line: string): void => {
    try {
      stream.write(`${line}\n`);
    } catch (error) {
      const code = typeof error === 'object' && error !== null ? (error as { code?: string }).code : undefined;
      if (code !== undefined && READER_GONE.has(code)) return;
      throw error;
    }
  };
}
