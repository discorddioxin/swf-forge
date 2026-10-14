/**
 * `IMPL-010` §8 primitive vectors — **cross-lane** suite (`T-SWF-004`).
 *
 * This file is deliberately named `*.lanes.test.ts`: it is collected by the Node lane
 * (`vitest.config.ts`) *and* by the browser lane (`vitest.browser.config.ts`, headless Chromium via
 * `tools/browser-lane.mjs`), so the two lanes assert **the identical cases against the identical
 * production readers** — `IMPL-010` §11 criterion 1 ("every vector in §8 passes with exact equality
 * on Node and in the browser test runner") and `audits/P0-AUDIT-RESOLUTION.md` `R-P0-02`
 * ("reusing the same vector definitions so Node and browser run identical cases").
 *
 * The cross-engine claim is carried by `EXPECTED_FINGERPRINT`, not by coincidence: both lanes
 * compute one canonical string over every row and compare it to the same pinned constant, so a
 * divergence in `-0`, `NaN`, `DataView` endianness, `>>> 0`, or `TextDecoder('windows-1252')`
 * between V8-on-Node and V8-in-Chromium fails the browser lane outright.
 *
 * ## What this suite is, and is not
 *
 * It is the lane-equivalence proof plus a row-by-row assertion of every §8 row whose bytes the
 * documents state (verbatim hex, or the Appendix A worked example) and of the bit-field rows whose
 * packing follows mechanically from `IMPL-010` §4.1. It does **not** by itself close `T-SWF-004` or
 * `IMPL-010` §11 criterion 1: `R-P0-02` also requires the host matrix to be visible in CI and the
 * remaining §8 rows that need a paired writer (`RECT` with arbitrary `Nbits`, `MATRIX` scale/rotate,
 * `CXFORMWITHALPHA`), which is `WP-010-11` work. It does surface one documentation discrepancy that
 * blocks a literal row-by-row reading of §8 — see the last `describe`.
 *
 * No filesystem, no `node:` imports, no DOM types: the package tsconfig compiles with
 * `lib: ["ES2022"]` (`REPO-R012`), and the browser lane has no `fs`.
 */
import { describe, expect, it } from 'vitest';

import { Cursor } from '@swf-forge/swf';

import {
  EXPECTED_FINGERPRINT,
  VECTOR_ROWS,
  VECTOR_TABLE_DISCREPANCIES,
  docTableDiscrepancies,
  laneName,
  vectorFingerprint,
} from './support/vector-table.js';

/** Injected by `vitest.browser.config.ts` only; `typeof` keeps the Node lane safe. */
declare const __SWF_FORGE_BROWSER_LANE__: boolean;

describe('T-SWF-004: IMPL-010 §8 primitive vectors (runs identically in the Node and browser lanes)', () => {
  for (const row of VECTOR_ROWS) {
    it(`${row.id} — ${row.row} [${row.provenance}, ${row.source}]`, () => {
      const cursor = new Cursor(Uint8Array.from(row.bytes));

      expect(row.read(cursor)).toBe(row.expected);

      // The §8 rows that name a diagnostic require it: the value alone is not the obligation
      // (IMPL-010-R013/019/023). Codes come from the registry, never as literals (IMPL-010-R002).
      const codes = cursor.diagnostics.map((d) => d.code).sort();
      expect(codes).toEqual([...row.diagnostics].sort());
    });
  }

  it('every §8 row in this table is asserted, and the table is not empty', () => {
    // Guards against a silent shrink: a row deleted from vector-table.ts changes the fingerprint.
    expect(VECTOR_ROWS.length).toBe(26);
    expect(new Set(VECTOR_ROWS.map((r) => r.id)).size).toBe(VECTOR_ROWS.length);
  });

  it('the whole table reduces to the pinned cross-engine fingerprint', () => {
    // Same constant in both lanes => Node and headless Chromium agree on every row, including the
    // exact-equality cases the audit calls out (signed zero, NaN, infinities, legacy decoding).
    expect(vectorFingerprint()).toBe(EXPECTED_FINGERPRINT);
  });

  it('runs in the lane it claims to run in', () => {
    // Asserted, not logged: a mis-wired browser lane that silently ran under Node must fail rather
    // than pass as browser evidence (audits/P0-AUDIT.md F-P0-01).
    const globals = globalThis as Record<string, unknown>;
    const configuredAsBrowser = typeof __SWF_FORGE_BROWSER_LANE__ !== 'undefined';

    expect(laneName()).toBe(configuredAsBrowser ? 'browser' : 'node');

    if (configuredAsBrowser) {
      // A real page context, and not a Node one.
      expect(typeof globals['window']).toBe('object');
      expect(typeof globals['document']).toBe('object');
      expect(globals['Buffer']).toBeUndefined();

      // Name the host in the run log: R-P0-02 wants the browser half of T-SWF visible, and an
      // engine identity in CI output is what makes a browser-lane pass auditable after the fact.
      // (No DOM types here — the package compiles with `lib: ["ES2022"]`, REPO-R012.)
      const userAgent = (globals['navigator'] as { userAgent?: string } | undefined)?.userAgent ?? '';
      expect(userAgent).toMatch(/Chrome|Chromium|Firefox|Safari|WebKit/);
      console.info(`[io-vectors] lane=browser engine=${userAgent}`);
    }
  });
});

describe('IMPL-010 §8 documentation self-audit (discrepancies are reported, never absorbed)', () => {
  it('every Expected cell that disagrees with its own bytes has a pinned disposition', () => {
    const derived = docTableDiscrepancies()
      .map((r) => r.id)
      .sort();
    const pinned = VECTOR_TABLE_DISCREPANCIES.map((d) => d.id).sort();

    // Fails in both directions: a new discrepancy must be dispositioned here (and resolved in the
    // owning document), and fixing §8 requires removing the now-stale entry.
    expect(derived).toEqual(pinned);
  });

  it('each pinned discrepancy states what the bytes require and what the document prints', () => {
    for (const discrepancy of VECTOR_TABLE_DISCREPANCIES) {
      expect(discrepancy.note.length).toBeGreaterThan(0);
      expect(discrepancy.requiredByBytes.length).toBeGreaterThan(0);
      expect(discrepancy.docExpected).not.toBe(discrepancy.requiredByBytes);
    }
  });
});
