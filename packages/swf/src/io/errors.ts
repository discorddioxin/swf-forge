/** Errors thrown in `strict` mode — `IMPL-010` §4.3 (soft recovers, strict throws). */

import type { Code } from '../diagnostics/codes.js';

export class SwfReadError extends Error {
  readonly code: Code | string;
  readonly offset: number;
  readonly context: string;

  constructor(code: Code | string, message: string, offset: number, context = '') {
    super(`${code} @${offset}${context ? ` (${context})` : ''}: ${message}`);
    this.name = 'SwfReadError';
    this.code = code;
    this.offset = offset;
    this.context = context;
  }
}
