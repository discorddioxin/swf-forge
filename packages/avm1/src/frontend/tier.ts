/**
 * Tier assignment (IMPL-050-R058..R060).
 *
 * The tier is a *function-level* verdict: any T2 condition anywhere in the function makes the whole
 * function residual, because the residual interpreter must be able to execute the entire function
 * (a T2 verdict must not force *callers* to T2 — R059). Reasons are machine-readable and part of
 * the report contract (`divergence.json`), so they are matched by exact string.
 */

/** T2: the function is residual — emitted as a bytecode blob for `@swf-forge/avm1/interp`. */
const T2_HEADS: ReadonlySet<string> = new Set([
  'unknown-opcode', // carries a `:0x##` suffix
  'record-truncated',
  'record-overrun',
  'push-malformed',
  'try-malformed',
  'branch-out-of-bounds',
  'stack-mismatch',
  'pool-index-out-of-range',
  'register-out-of-range',
  'avm2',
]);

/** T1: static CFG but dynamic values — emitted as a TypeScript block state machine. */
const T1_HEADS: ReadonlySet<string> = new Set([
  'dynamic-with',
  'dynamic-pool',
  'call-dynamic-target',
  'target-in-branch',
  'dynamic-args',
  'dynamic-stack',
  'frame-call-target-unresolved',
]);

export interface TierDecision {
  readonly tier: 0 | 1 | 2;
  /** The first T2 reason string for reports, or `null` below T2. */
  readonly residualReason: string | null;
}

/**
 * Assigns the tier from the collected reason strings (first-seen order, deduplicated). A reason
 * whose head (the part before `:`) is a known T2 head is T2; a known T1 head is T1. Unknown heads
 * are treated as T2 (conservative, R058) so a new reason cannot silently downgrade a function.
 */
export function assignTier(rawReasons: readonly string[]): TierDecision {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const reason of rawReasons) {
    if (seen.has(reason)) continue;
    seen.add(reason);
    ordered.push(reason);
  }

  let tier: 0 | 1 | 2 = 0;
  let residual: string | null = null;
  for (const reason of ordered) {
    if (reasonIsT2(reason)) {
      tier = 2;
      if (residual === null) residual = reason;
      break;
    }
    if (tier === 0) tier = 1;
  }
  return { tier, residualReason: residual };
}

/** True when `reason` (a full reason string such as `unknown-opcode:0x8b`) is T2-class. */
export function reasonIsT2(reason: string): boolean {
  const head = reason.split(':')[0] ?? reason;
  if (T1_HEADS.has(head)) return false;
  return T2_HEADS.has(head);
}
