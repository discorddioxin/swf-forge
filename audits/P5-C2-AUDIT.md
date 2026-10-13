# P5 C2 audit — semantics and obligation identity

- **Date:** 2026-10-10
- **Status:** Complete for C2; P5 remains in progress and is not exit-ready.
- **Scope:** Reconcile AVM1 language-semantic gates with the front-end obligations, confirm implementation ownership/evidence, and add only front-end conformance that the current phase can actually prove.

## Findings and changes

### 1. Front-end test IDs are now unambiguous

At C0, `docs/specs/language/040-avm1-to-typescript.md` and IMPL-050 each defined 30 `T-AVM1-*` IDs, with 25 overlapping identifiers that described different obligations. IMPL-050's 30 original obligations now use `T-AVM1-FE-001`…`T-AVM1-FE-030`; the language-spec IDs remain unchanged. `T-AVM1-FE-031` was added for a new static-folding regression obligation. Existing source/test references, the generated implementation status register, the register errata, and the archived integrity-audit citation were reconciled.

`tools/verify_docs.py` accepts the namespaced IDs, checks their IMPL-050 band, and now rejects duplicate AVM1 test definitions across specification and implementation documents. `tools/gen_status.py` also recognizes and reports the multi-segment front-end IDs. The language spec's §13 table was completed for eleven previously cited but undeclared IDs (`006`, `007`, `010`, `011`, `013`, `014`, `016`, `017`, `019`, `020`, `030`); this makes those existing references auditable and does not claim that their tests have been implemented.

### 2. Front-end literal-folding defect fixed; runtime coercion remains open

`packages/avm1/src/frontend/stack.ts` previously chose the `ActionAdd2` string-concatenation path whenever either operand could be converted to a string by the fold helper. That incorrectly let Boolean, `null`, and `undefined` literals select concatenation on their own. The branch now selects concatenation only if either primitive operand is a string; those other literals stringify only after a string operand selects that path. Numeric cases continue to use numeric coercion, and number-to-string folds remain deliberately dynamic because AVM1's 15-significant-digit formatting is runtime behavior.

IMPL-050 now records this boundary in R064 and `T-AVM1-FE-031`. The test checks all 81 pairs across nine literal kinds for each of `ActionAdd`, `ActionAdd2`, and `StringAdd` (243 opcode/pair combinations). It is a front-end folding test, **not** the language runtime's 60+ case `T-AVM1-008` suite.

### 3. Name recovery is distinct from enumeration

`T-AVM1-FE-012` is the IMPL-050 name/class-recovery obligation: `packages/avm1/src/frontend/names.ts` is exercised by `packages/avm1/test/movie.test.ts`, including 100 shuffled candidate orders and stable duplicate-name suffixing. It does **not** satisfy language-spec `T-AVM1-012`, which is the runtime `for…in` ordering/snapshot contract. Keeping the `FE` namespace makes that distinction machine-checkable.

### 4. Gate ownership and evidence

| Language gate | Semantic authority | Implementation owner / nearest work | Evidence in this checkout | Current disposition |
|---|---|---|---|---|
| `T-AVM1-008` | Language spec 040 §5.2, AVM1-R024: distinct `ActionAdd`, `ActionAdd2`, and forced `StringAdd` coercion | IMPL-130 R020, WP-130-02 (`coercion.ts` and operators) | P5 has conservative literal folds in `stack.ts`; FE-031 covers only static-fold behavior. No runtime coercion implementation or 60+ language matrix is present. | `scheduled-or-unwired`; not P5 evidence |
| `T-AVM1-009` | Language spec 040 §5.4, AVM1-R029: `isNaN(v)` via AVM1 `ToNumber`, with the specified fixtures | IMPL-130 R020, WP-130-02 | No AVM1 runtime `isNaN` implementation or language conformance fixture is present. | `scheduled-or-unwired`; not P5 evidence |
| `T-AVM1-012` | Language spec 040 §7.3, AVM1-R045/R046: own/prototype insertion order, shadowing, enumerable filtering, and mutation snapshot | IMPL-130 R033/WP-130-01; runtime test T-RT-121 | P5 `T-AVM1-FE-023` checks that `Enumerate` decodes to an IR op and preserves unknown stack depth; it does not execute enumeration semantics. IMPL-130 now explicitly owns the runtime rule and test, but runtime code is absent. | `scheduled-or-unwired`; not P5 evidence |
| `T-AVM1-025` | Language spec 040 §5.3, AVM1-R025–R027: 15-significant-digit formatting and observable numeric string conversion | IMPL-130 R020, WP-130-02 | The front-end comment explicitly excludes number-to-string folding; no runtime formatter or 200-vector golden suite is present. | `scheduled-or-unwired`; not P5 evidence |

The inspected `packages/avm1` tree contains the front end and its tests, but no runtime/coercion module. IMPL-130 describes the future runtime package; its addition of R033/T-RT-121 clarifies enumeration ownership, not implementation status. `audit_dev.py --json --no-probe` reports all four language gates above as `scheduled-or-unwired`; it also reports FE-024 (P7 runtime timeline execution) and FE-030 (DBCS byte/character behavior, dependent on the code-page authority in `docs/impl/decompiler/080-fonts-and-text.md`) that way. FE-031 is `test-cited` in `packages/avm1/test/semantics.test.ts`. Neither FE-024 nor FE-030 is P5 evidence. The current IMPL-050 result is **29/31 obligations test-cited**.

**Phase boundary:** P5's roadmap still names `T-AVM1-008`, `009`, `012`, and `025` as exit gates, while their implementation belongs to P7's runtime. C2 has recorded the ownership and left those gates open; it did not pull P7 implementation into P5 or claim the front-end tests as substitutes. P5 must not be reported exit-ready until the named gates have passing evidence or the roadmap is explicitly revised.

## Validation

- `corepack pnpm build` — passed.
- `corepack pnpm typecheck` — passed.
- `corepack pnpm exec vitest run packages/avm1/test apps/decompiler/test/actions.test.ts apps/decompiler/test/analyze.test.ts` — **10 files, 95 tests passed**.
- `corepack pnpm exec prettier --check packages/avm1/src/frontend/stack.ts packages/avm1/test/semantics.test.ts` — passed.
- `corepack pnpm exec eslint packages/avm1/src/frontend/stack.ts packages/avm1/test/semantics.test.ts` — passed.
- `python3 tools/verify_docs.py` — `ISSUES: 0`.
- `python3 -m unittest discover -s tools -p 'test_*.py'` — **78 tests passed**.
- `python3 tools/audit_dev.py --json --no-probe` — coverage report generated; the language gates above remain scheduled/unwired, and FE-031 is test-cited. This is an inventory, not a full P5 exit-gate pass.

## C2 exit

C2 is complete. Continue with C3 under the P5 checkpoint plan. Do not close P5 based on C2: the 10^6 action-stream mutation campaign, round-trip contract, corpus/tier review, and runtime-owned language gates remain open.
