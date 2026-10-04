# Development integrity audit — `packages/*` and `apps/*` against the specification set

**Date:** 2026-10-04 · **Branch:** `arena/01a107c6-swf-forge` · **Tree at audit:** clean, HEAD `a76f2ea`
(one commit after the slice-6 `dump` commit `1c97217`) · **Auditor:** the same AI agent that authored the
slices, re-reading the code as an adversarial reviewer · **Mode:** read-only for the repository; the only
write in this audit is this folder.

This folder is **audit evidence, not specification**. Where an audit finding conflicts with
`docs/specs` or `docs/impl`, the specification wins and the code is what must change — except where the
finding itself is a documentation defect, which is marked as such.

## 1. Scope

In scope: every TypeScript source file currently in the repository, i.e. the implemented vertical slice

| Unit | Files | Lines (approx.) |
| --- | --- | --- |
| `packages/swf/src/io` (primitive readers) | 8 | ~1 100 |
| `packages/swf/src/container` (open, header, tag stream) | 3 | ~600 |
| `packages/swf/src/tags` (shape, place, control) | 3 | ~1 100 |
| `packages/swf/src/model` (movie, timeline, types, index) | 4 | ~800 |
| `packages/swf/src/diagnostics` | 3 | ~350 |
| `packages/swf/src/node`, `src/test-support` | ~7 | ~450 |
| `apps/decompiler` (`inspect`, `dump`) | 6 | ~1 300 |
| `packages/gfx` | 8 | ~1 400 |
| tests | 9 files | ~900 |

Out of scope (nothing to audit yet): `apps/transpiler`, `apps/code-inspector`, `apps/engine-flash`,
`apps/engine-clean`, `docs/impl/harness`, and every `docs/impl` WP that has not been started. Coverage
against those documents is recorded in `02-conformance.md` §3 rather than as findings.

Authority used, in order: `docs/specs/*` (design specs) and `docs/impl/*` (implementation specs) as
written, then SWF Specification 19 chapter text where an impl spec quotes it (§6 of
`02-conformance.md` records every such cross-check).

## 2. Method and evidence

The audit was evidence-driven, not checklist-driven. Three passes:

1. **Rule inventory.** Every `IMPL-NNN-Rnnn` rule in `docs/impl/*/*.md` was enumerated per document, and
   every requirement was either located in code or recorded as unimplemented. Test-id definitions were
   counted and matched against citations in code and tests.
2. **Diagnostic registry conformance.** All 87 codes in `packages/swf/src/diagnostics/codes.ts` were
   parsed (registry rows wrap across lines — a line regex mis-parses them; parse
   `\bSF(\d{4}): \{ … \}` blocks instead) and compared against (a) every `emit`/`case` site outside
   `codes.ts` and (b) the §8 severity tables of the owning impl doc. 17 codes are never emitted or
   matched anywhere; 3 codes disagree with their call site on severity.
3. **Behavioural probes.** Where a rule is decidable by execution, a throwaway script was run against
   the built `dist/` to decide it. Every probe is listed in §6 with its exact result.

Commands (all run at HEAD `a76f2ea`; `pnpm install` was required first because `node_modules` was absent
in this sandbox):

```bash
pnpm install && pnpm build            # dist/ for the probes
node probe-shape4.mjs                 # DefineShape4 flag bits        -> finding F-01
node probe-coverage.mjs               # analytic AA coverage vs F3    -> clean, see 02 §1
python3 tools/verify_docs.py          # docs-only gate               -> ISSUES: 0 (not evidence here)
pnpm typecheck && pnpm test && pnpm lint   # baseline: green at HEAD
```

Reproduction scripts for the two probes are in §6; they are deliberately not committed as tests because
they are evidence for findings that the fix will invalidate. Both probes, plus ten static checks, now
live in `tools/audit_dev.py` and re-run on every `pnpm audit:dev` — see `03-mechanical-checks.md`.

## 3. Verdict

**The implemented slice is broadly sound but not yet specification-conformant.** The layering, the
determinism discipline, the diagnostics funnel and the container/framing core all hold up under
inspection — 40 checks listed in `02-conformance.md` §1 passed with no change needed. Against that:

- **2 blocker findings** (`F-01`, `F-02`) are silent wrong-output defects on legal input. `F-01` is the
  most serious: the `DefineShape4` hinting/winding flag bits are read at the wrong offsets, so
  `UsesFillWindingRule` is *never* honoured and a shape that should tessellate with the non-zero rule is
  rendered with even-odd — and a spurious `SF0188` warning is emitted for legal flag bytes.
- **10 major findings** are documented `MUST` requirements that are absent, inverted or wired to the
  wrong diagnostic: the duplicate-character-id policy is inverted, `SF0006` is never used for a `ZWS`
  file with no decoder, the shape style-array escape is decoded for `DefineShape` v1 (the doc's named
  "shapes explode into noise" failure), `bits > 32` takes neither the strict nor the soft branch the doc
  mandates, the `kind: 'missing'` placeholder and `SF0110` do not exist, sprite timelines ignore the
  declared `FrameCount`, the lazy/decode `readTag()` contract is a stub, and `SF0183`/`SF0185` are dead
  codes.
- **8 minor findings** are single-code, single-flag or single-field divergences, all listed with the
  exact edit needed.
- **3 observations** record systemic process risk rather than defects: 17 registry codes are never
  emitted, only 10 of the 382 defined test ids are cited anywhere, and the green document gate cannot
  detect any of the above.

Severity definition used throughout: **blocker** = wrong output for input the specification covers;
**major** = a `MUST` requirement missing, inverted or mis-wired, with user-visible effect;
**minor** = a single diagnostic, flag, field name or dead-code divergence;
**observation** = process or coverage risk with no current user-visible effect.

| Severity | Count | Ids |
| --- | --- | --- |
| blocker | 2 | F-01, F-02 |
| major | 10 | F-03 … F-09, F-12 … F-14 |
| minor | 8 | F-10, F-11, F-15 … F-20 |
| observation | 3 | O-01 … O-03 |

No finding is a security issue, a determinism violation (`TECH-R010`) or an architecture violation
(`TECH-R029` gate order, `ARCH-R001`). Nothing in this audit was caused by a missing dependency or a
broken toolchain.

## 4. Findings index

| Id | Area | Rule / code | File (primary) | Severity | One line |
| --- | --- | --- | --- | --- | --- |
| F-01 | shapes | `IMPL-060-R005`, SWF Ch.6 field table | `packages/swf/src/tags/shape.ts:556` | blocker | `DefineShape4` flag bits read at the wrong offsets; winding rule never honoured |
| F-02 | shapes | `IMPL-060-R006` | `packages/swf/src/tags/shape.ts:197` | blocker | `0xFF` style count decoded as an escape in `DefineShape` v1 → cursor desync |
| F-03 | container | `IMPL-020` §5.2 `SF0006` | `packages/swf/src/container/open.ts:177` | major | `ZWS` without a decoder emits `SF0003`, not `SF0006` |
| F-04 | container | `IMPL-020-R028` | `packages/swf/src/container/tag-stream.ts:212` | major | Duplicate id policy inverted: first wins, last not reachable, one offset named |
| F-05 | diagnostics | `IMPL-060` §8 | `packages/swf/src/diagnostics/codes.ts:247` | major | `SF0190`/`SF0191` registry severities are swapped relative to the doc |
| F-06 | container | `IMPL-020-R004` | `packages/swf/src/container/open.ts:93` | major | `indexStrategy: 'lazy'` yields an empty index; `readTag` never returns a decoded payload |
| F-07 | container | `IMPL-020-R029` | `packages/swf/src/model/types.ts:120` | major | No `kind: 'missing'` placeholder; `SF0110` never emitted |
| F-08 | io | `IMPL-010-R008` | `packages/swf/src/io/cursor.ts:352` | major | `bits > 32`: soft must be `0 + SF0014`, strict must throw; code warns `SF0016` and reads 32 bits |
| F-09 | shapes | `IMPL-060-R005`, §8 `SF0183`/`SF0185` | `packages/swf/src/tags/shape.ts:546` | major | `SF0183` (Shape4 in a pre-8 file) and `SF0185` (empty subpath) never emitted |
| F-10 | io | `IMPL-010-R009`/`R011` | `packages/swf/src/io/cursor.ts:150` | minor | Soft violation leaves `#pos` below `limit`; `subCursor` clamps without `SF0013` |
| F-11 | diagnostics | `IMPL-010` §8 `SF0009` | `packages/swf/src/diagnostics/codes.ts:128` | minor | Registry says `warning`; the only severity sentence in doc 010 says `info` |
| F-12 | docs | `IMPL-020` §8 table vs `R028` | `docs/impl/foundation/020-…md:404` | minor | §8 row says "first definition wins", contradicting `R028` |
| F-13 | model | `IMPL-030-R033` / `R024` | `packages/swf/src/model/movie.ts:253` | major | Sprites assembled with `padToDeclared: false` — declared `FrameCount` loses |
| F-14 | model | `IMPL-040-R011` | `packages/swf/src/model/types.ts:119` | minor | Scene table field is `startFrame`, doc says `frameOffset`; no scene remap |
| F-15 | shapes | `IMPL-060-R041` | `packages/swf/src/tags/shape.ts:216` | minor | `SF0190` fires on count alone, without the duplicate condition; fill array only |
| F-16 | model | `IMPL-040` §8 `SF0166` | `packages/swf/src/model/timeline.ts:110` | minor | `SetTabIndex` at an empty depth is not reported |
| F-17 | cli | `SWF-D03` / `specs/format/030:66` | `apps/decompiler/src/cli.ts` | minor | `--tolerate-length` / `--strict` are documented flags that no CLI implements |
| F-18 | tests | `IMPL-010` §10 | `packages/swf/test/` | minor | No number-IO test file; `T-SWF-004/013/015/016` have no implementation |
| F-19 | tests | `TECH-R009` | `packages/swf/test/diagnostics.test.ts:27` | minor | Severity regression test pins only `SF0001`–`SF0020`, which is why F-05 shipped |
| F-20 | io | — | `packages/swf/src/io/bits.ts:19` | minor | `fixedFromSigned()` is an exported helper with no caller |
| O-01 | coverage | — | `packages/swf/src/diagnostics/codes.ts` | observation | 17 registry codes are never emitted or matched; 9 have no owning WP |
| O-02 | process | `TECH-R009` | `docs/**` | observation | 382 test ids are defined, 10 are cited in code or tests |
| O-03 | process | — | `tools/verify_docs.py` | observation | The green doc gate audits documents only; it cannot detect any finding here |

## 5. What this audit does not cover

- **Unimplemented documents.** `docs/impl/decompiler/070`, `080`, `090`, `100`, `110`, `transpiler/*`,
  `engine-flash/130`, `engine-clean/160`, `code-inspector/150`, `harness/140` describe behaviour that no
  code claims to implement yet; their absence is roadmap, not defect. `02-conformance.md` §3 records
  which are partially touched.
- **Fidelity claims.** `packages/gfx` was checked for structural conformance and for the two rules that
  are decidable in isolation (anti-aliasing coverage vs the `GFX-§13.4` budget; `nonzero`/`evenodd`
  selection). Flash-oracle comparison (`T-GFX-001`…) needs fixtures that do not exist.
- **Performance budgets** (`draws ≤ 700/350`, `cold frame ≤ 900 ms`): no harness exists yet
  (`docs/impl/harness/140`), so no claim is made either way.
- **Security review.** Only `SEC-R011`-adjacent behaviour (no `window`/`location` access from packages)
  was spot-checked; a full pass belongs to `docs/specs/quality/100`.

## 6. Probe scripts (evidence for F-01 and the clean AA result)

Both scripts import built `dist/` output. They are kept here as the audit's raw evidence; the two
probes are now embedded in `tools/audit_dev.py` (check 12) so they are re-runnable rather than
one-off.

`probe-shape4.mjs` — builds a minimal `DefineShape4` body with a chosen flag byte and prints the decoded
flags plus emitted codes. Used for F-01:

```js
// ShapeId=1, 0..100 twip bounds, empty style arrays; the byte after EdgeBounds is the flag byte.
for (const flags of [0x00, 0x01, 0x02, 0x04, 0x05, 0x07]) { /* decode, print fillRule/flags/diags */ }
```

Result (verbatim):

```text
flags 0x00 -> fillRule=evenOdd nonScaling=false scaling=false diags=[]
flags 0x01 -> fillRule=evenOdd nonScaling=false scaling=false diags=[SF0188]
flags 0x02 -> fillRule=evenOdd nonScaling=false scaling=false diags=[SF0188]
flags 0x04 -> fillRule=evenOdd nonScaling=false scaling=false diags=[SF0188]
flags 0x05 -> fillRule=evenOdd nonScaling=false scaling=false diags=[SF0188]
flags 0x07 -> fillRule=evenOdd nonScaling=false scaling=false diags=[SF0188]
```

`0x04` is `UsesFillWindingRule` per the chapter and must yield `nonZero`; `0x01` is
`UsesScalingStrokes` and must not warn. Neither holds.

`probe-coverage.mjs` — compares `fillRun` coverage against the exact polygon/pixel intersection area for
a triangle. Result: max error 0.5/255, RMS 0.09/255 — inside the `GFX-§13.4` budget (≤ 3/255 RMS for
anti-aliased content), so the analytic coverage model is **not** a finding.

## 7. Reading order

1. `01-findings.md` — the 20 findings in detail, each with the doc sentence it violates and the exact fix.
2. `02-conformance.md` — what was checked and passed (§1), the never-emitted code table (§2), unimplemented
   document coverage (§3), the SWF-Spec-19 cross-checks (§4) and the traceability numbers (§5).
3. `03-mechanical-checks.md` — the twelve re-runnable checks (`tools/audit_dev.py`), the recorded run,
   the reconciliation of every finding with its mechanical key, and the checker blind spots found while
   hardening it. `baseline.json` is the ledger the tool compares against.
