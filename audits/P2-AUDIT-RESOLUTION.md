# P2 Audit Resolution

Auditor: Arena.ai Agent Mode
Branch: `arena/07fdceae-swf-forge`
Baseline commit: `1f3016b` (P1 audit closed)
Source audit: `audits/P2-AUDIT.md`

## 1. Per-finding disposition

### F-P2-01 (minor) — SF0111 `PLACEMENT_BOUNDS_DEGENERATE` declared but never emitted
**Audit observation:** `Codes.PLACEMENT_BOUNDS_DEGENERATE` was registered and documented in IMPL-030 (with a reference in IMPL-010 errata E-001) but had no production emission site, so an authoring error that produced inverted hit-area rects was silently accepted instead of reported.

**Fix applied:**
1. `packages/swf/src/model/buttons.ts`
   - Added `isRectDegenerate(rect)` helper that returns true when `xMax < xMin` or `yMax < yMin` (strictly inverted; zero-area rects are tolerated).
   - Rewrote `unionRects` to tolerate and normalize inverted corners (takes `min/max` over both endpoints of each input) and returns `null` only when the input list is empty or every normalized coordinate is still non-finite.
2. `packages/swf/src/model/movie.ts` (`computeGeometry`, the button hit-area assembler)
   - Imports `isRectDegenerate`.
   - After `transformRect` for each contributing record, tests the transformed rect; when degenerate, emits `SF0111` (warning, context `"button hit-area"`) and excludes the record from the union.
   - After the union step, when `source !== null` and `useRecords.length > 0` but every record was unusable (e.g. all singular matrices, or all degenerate), emits a second `SF0111` describing the failure and leaves `hitArea: null`.
3. Removed SF0111 from `DEFERRED_DIAGNOSTIC_WPS` in `tools/audit_dev.py` so `audit:dev` tracks it as a live diagnostic.
4. Doc bookkeeping: added `T-MOD-842` to `docs/impl/decompiler/100-buttons.md` test-id table and to the `WP-100-05` row.

**Flip evidence:**
- Before fix: `SF0111` appeared in the deferred list; `computeGeometry` never referenced `Codes.PLACEMENT_BOUNDS_DEGENERATE`.
- After fix: `grep -rn "Codes.PLACEMENT_BOUNDS_DEGENERATE" packages/swf/src/` returns the new two emission sites in `model/movie.ts`; `corepack pnpm audit:dev` reports `findings=52 / known=57 / new=0` (i.e., SF0111 is now recognized as live, no stale deferred entry).
- Regression: `packages/swf/test/buttons.test.ts` → `T-MOD-842` constructs a button whose single hitTest record uses a singular matrix; asserts `SF0131` (singular) AND `SF0111` (union collapsed to null) appear and `hitArea` is null.

### F-P2-02 (minor) — Button hit-area recursion returned null silently on self-cycles
**Audit observation:** `computeGeometry` in `model/movie.ts` already guarded against infinite recursion via an `activeGeometry` Set, but when it detected a cycle (button id already on the recursion stack) it returned `{bounds: null, source: null}` without emitting any diagnostic. A self-referential button (e.g. button 1 places button 1 at depth 1 in its hitTest record) produced a silently null hit area.

**Fix applied:**
- In `packages/swf/src/model/movie.ts`, split the early-exit check so an `undefined` entry still returns null quietly, but an `activeGeometry.has(buttonId)` cycle now emits `SF0111` (warning: "references itself (or an ancestor) in its hit-area records; hit area cannot be assembled") before returning `{bounds: null, source: null}`.
- Doc bookkeeping: added `T-MOD-841` to `docs/impl/decompiler/100-buttons.md` test-id table and to the `WP-100-05` row.

**Flip evidence:**
- Before fix: the cycle branch had no `file.sink.emit` call.
- After fix: `corepack pnpm vitest run packages/swf/test/buttons.test.ts` reports 19/19 passed. `T-MOD-841` constructs button 20 whose only hitTest record places character 20; asserts `hitArea` is null and `SF0111` is present.

## 2. New regression tests

| Test ID | File:case | Coverage |
|---|---|---|
| T-MOD-841 | `packages/swf/test/buttons.test.ts` "P2 audit regressions > T-MOD-841 emits SF0111 for a self-cyclic button" | F-P2-02 |
| T-MOD-842 | `packages/swf/test/buttons.test.ts` "P2 audit regressions > T-MOD-842 emits SF0111 when every contributing record resolves to an inverted or unusable child bounds" | F-P2-01 (all-records-unusable branch) |

Test count: **47 files / 458 tests**, up from 456 at P1 close (+2).

## 3. Gate re-run (post-fix)

| Gate | Command | Result |
|---|---|---|
| Typecheck (8 projects) | `corepack pnpm typecheck` | ✅ exit 0, no errors |
| Unit tests | `corepack pnpm test` | ✅ **47 files / 458 tests pass** (0 flaky, 0 unhandled rejections) |
| Lint + Prettier | `corepack pnpm lint` | ✅ exit 0, "All matched files use Prettier code style!" |
| Build | `corepack pnpm build` | ✅ `tsc -b` + both app builds succeed |
| Spec doc cross-check | `corepack pnpm spec:verify` | ✅ ISSUES: 0 |
| Dev diagnostic audit | `corepack pnpm audit:dev` | ✅ findings=52 known=57 **new=0** fixed=5 |
| Tag coverage | `corepack pnpm tag:coverage` | ✅ 50 decoded / 7 pending / 5 retained / 3 structural = 65; "All registered tags are dispositioned" |
| Fuzz 10⁴ seeded mutations | `corepack pnpm vitest run packages/swf/test/fuzz.test.ts` | ✅ zero uncaught exceptions |

## 4. Final done-criteria status

All P2 charter criteria remain at ✅ as listed in `P2-AUDIT.md` §2, with the additional updates:

- SF0111 is now a live, tested diagnostic (was previously declared-but-dormant).
- Self-cyclic button references now emit `SF0111` rather than silently nulling `hitArea`.
- Doc bookkeeping (`100-buttons.md` test-id table + WP-100-05 row, `audit_dev.py` deferred map) matches the new code.

## 5. Verdict

P2 audit **closed with 2 minor findings fixed and zero open items**. The repository state is ready to commit.
