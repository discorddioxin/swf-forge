# IMPL-120 — Compiler Pipeline, Emitter, and Build Output

**Doc ID:** IMPL-120 · **Status:** ready (design-spec-driven; no format chapters needed) · **Packages:** `@swf-forge/compile`, `@swf-forge/cli`
**Format spec:** none (consumes the model produced by IMPL-010…IMPL-110)
**Design specs:** CMP (whole), REPO-§4–§6, AVM1-§6/§7 (emitted shape), GFX-§5/§14, AST-§7, RT-§3
(app shell), SEC-§3 (CSP and hardening), MS-§2 (CLI surface)

---

## 1. Deliverables

1. The pipeline runner: staged, cached, cancellable, deterministic; the wiring that turns
   `game.swf` into a project directory.
2. Passes after the model: dead-code analysis, requirement tree-shaking, tier finalisation, name
   assignment, frame-script scheduling, asset planning.
3. The emitter: TypeScript sources for AVM1 behaviour, the manifest, the asset files, the project
   scaffolding, and the build-info/divergence reports.
4. Deterministic output discipline: stable ordering, stable names, no timestamps/paths/randomness
   (REPO-§6, CMP-R020).
5. `swfforge build` CLI end to end, including `--dry-run` (plan only) and `--report-only`.
6. `verify` (structural checks on an emitted project) and `inspect` (model dumps).

**Non-goals:** the runtime library's internals (doc 130) and the test harness (doc 140).

## 2. Pipeline stages

```
read        → openSwf, index, dictionary                       (IMPL-020)
model       → frames, sprites, control model                    (IMPL-030/040)
decode      → shapes, images, fonts, sounds, video, buttons     (IMPL-060…110)
analyze     → AVM1 front end → IR → tiers → requirements        (IMPL-050)
plan        → assets plan, budgets, tree-shake decisions        (this doc)
emit        → TS sources + manifest + assets + reports          (this doc)
verify      → structural re-checks on the emitted output        (this doc + doc 140)
```

- **IMPL-120-R001** Every stage MUST be a pure function of `(inputs, config, previous stage
  outputs)`; no stage may read the clock, the filesystem outside its declared inputs, or the
  environment. This is what makes `--cache` and byte-identical rebuilds possible.
- **IMPL-120-R002** Stage outputs MUST be serialisable to the cache directory keyed by a content hash
  of `(stage, inputs, config, code version)`. A cache hit MUST be provably equivalent: the
  `--verify-cache` mode recomputes and diffs.
- **IMPL-120-R003** The pipeline MUST be cancellable at stage boundaries and inside asset loops
  (a 30-minute asset encode must respond to Ctrl-C within 2 s). Cancellation is not a special case;
  it is a signal threaded through the runner.
- **IMPL-120-R004** `--dry-run` MUST run through `plan` and print the expected outputs, sizes, and
  budgets without writing files or invoking external tools.

## 3. Post-model passes

| Pass | Job | Rules |
| --- | --- | --- |
| Dead code | Remove unreachable frames/actions never held by any reachable character, with roots = frame scripts + exports + `_root`-reachable names | `IMPL-120-R005`, opt-in via `--prune-dead-code`; default on for *unreferenced characters only* |
| Requirement shake | Compute the union of host-API requirements per entry point; emit only used runtime modules | `IMPL-120-R006` |
| Tier finalise | Merge per-function tier verdicts with the *call graph*: a T0 function that calls a T2 function stays T0 (it calls into the interpreter) | `IMPL-120-R007` |
| Name assignment | Deterministic symbol names: recovered name → `sanitised` → `_2`, `_3` suffixes by sorted order | `IMPL-120-R008` |
| Frame scripts | Group frame action blocks into per-frame functions; hoist blocks identical across frames | `IMPL-120-R009` |
| Asset plan | Order of asset encodes, parallelism cap, budget accounting, fallback ladder selection | `IMPL-120-R010` |

- **IMPL-120-R011** Symbol names MUST be assigned in a single pass over a *sorted* list of candidates
  (by source range, then character id), never by traversal order of a Map. Recovered names are a
  user-facing feature (readable output); instability across runs is a bug (`T-CMP-001`).
- **IMPL-120-R012** The emitter MUST NOT create a symbol for a construct it decided not to emit; the
  name table is closed *before* emission so that two passes cannot disagree.
- **IMPL-120-R013** Dead-code pruning MUST be reported per character and per action block, with
  reasons; pruning is never silent (design `CMP-D07`).

## 4. Emitter: output layout

```
<out>/
  src/
    manifest.ts            typed manifest (generated, referenced by the runtime)
    symbols.ts             character/timeline id tables
    frames/
      movie.ts             top-level frame scripts
      sprite_<id>.ts       per-sprite timeline tables + frame scripts
    classes/
      <ClassName>.ts       recovered AS1 prototypes + methods
    buttons/
      button_<id>.ts       condition handler tables
    residual/
      <fn>.bytecode.ts     T2 blobs + interpreter entry descriptors
    assets/
      index.ts             asset registry (typed)
  assets/                  ktx2/png/webp/ogg/mp4/... (content-hashed filenames)
  forge.manifest.json      full manifest (runtime + tooling)
  build-info.json          tool versions, chapter-pin status, gate states, budgets
  porting-notes.json       every diagnostic, decision, and [verify] item
  divergence.json          expected-divergence declarations for the harness
```

- **IMPL-120-R014** Emitted TypeScript MUST compile under the project's `tsconfig` with `strict`,
  `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, and **no `any`** (ESLint-enforced,
  `IMPL-120-R015`). Warnings are errors in the emitted project's own build.
- **IMPL-120-R015** The emitted project MUST ship an ESLint flat config that makes the R014/R016
  bans *errors* (`@typescript-eslint/no-explicit-any`, `no-eval`, `no-implied-eval`,
  `no-new-func`, `no-with`, `no-restricted-globals` for `Proxy`, `no-restricted-properties` for
  `Math.random`, plus the project's own `no-plain-avm1-objects` rule). The config is generated, never
  template-copied, and `verify` runs it over `src/` before the harness gate.
- **IMPL-120-R016** Emitted code MUST NOT contain: `eval`/`Function`, `with`, `Proxy`, plain-object
  stand-ins for AVM1 objects, global current-target state, promise/microtask delivery of host
  completions, timestamps, absolute paths, or `Math.random()` (all from AVM1/CMP design decisions).
  Each is a lint rule in the emitted project *and* a check in `verify` (`T-CMP-002`).
- **IMPL-120-R017** Frame scripts MUST be emitted as functions taking an explicit
  `(vm, target, frame)` context; the runtime invokes them from its frame loop (RT-§4). No emitted
  function may reach for ambient module state.
- **IMPL-120-R018** Residual bytecode blobs MUST be encoded as plain `Uint8Array` literals with an
  entry descriptor (params, registers, preloads, constants) so the interpreter needs no parsing.
- **IMPL-120-R019** The manifest MUST be emitted twice: as TypeScript (for the runtime, type-checked)
  and as `forge.manifest.json` (for tooling/tests). Both MUST come from the same in-memory object, and
  `verify` MUST diff them.
- **IMPL-120-R020** Asset filenames MUST be content-hashed (`<name>.<hash8>.<ext>`) and the manifest
  MUST reference them; duplicate payloads MUST be deduplicated to one file with multiple manifest
  entries (design `REPO-D06`).

## 5. Determinism and provenance

- **IMPL-120-R021** `build-info.json` MUST record: tool name/version, the SWF's sha256, per-chapter pin
  status (which impl docs are ✅ vs ⏳), the state of every gate flag (`--video-native`, `--vm.residual`,
  …), and the budget summary. It MUST NOT contain the build host's name, the absolute input path, or a
  wall-clock timestamp (the *duration* may be recorded in a separate, non-hashed telemetry file).
- **IMPL-120-R022** Byte-identical rebuilds: two builds on the same machine (and across machines with
  the same tool versions) MUST produce identical `src/`, `assets/`, and manifest bytes. CI enforces
  this with a double build + `diff -r`; the test is `T-CMP-003`.
- **IMPL-120-R023** Optional encode parallelism MUST NOT affect output bytes: assets are emitted to
  content-addressed temp names and sorted before writing.
- **IMPL-120-R024** `verify` MUST check: manifest↔TS drift, every referenced asset exists and matches
  its recorded hash, every emitted symbol referenced at least once (or listed as intentionally
  unreferenced), every T2 blob decodes under the interpreter's validator, no forbidden constructs, and
  the double-build determinism check in `--deep` mode.

## 6. CLI surface (build-side)

```
swfforge build <input.swf> --out <dir> [--config forge.config.json]
swfforge inspect <input.swf> [--tags|--symbols|--timeline|--actions|--shapes|--images|--fonts|--sounds|--video]
swfforge plan <input.swf>                      # budget/asset plan, no writes
swfforge verify <out-dir> [--deep]
swfforge report <out-dir> [--json]
```

- **IMPL-120-R025** Every command MUST honour `--json` with a stable schema (versioned under
  `REPO-§7`) and plain-text output MUST be the human-readable projection of the same data.
- **IMPL-120-R026** Exit codes: 0 success; 1 build failure (our bug); 2 input invalid (a diagnostic
  with severity `error` attributable to the file); 3 unsupported content (AVM2, `SF1000`); 4 external
  tool missing; 5 budget exceeded under `--budget-strict`. Codes are part of the CLI contract
  (`T-CMP-004`).
- **IMPL-120-R027** `inspect` MUST work on inputs whose later stages would fail (e.g. an AVM2 file:
  tag listing still works, then the error is reported) so it is usable as the first diagnostic tool.

## 7. Budgets and gating

- **IMPL-120-R028** The plan pass MUST compute: bundle bytes by module group, texture bytes, audio
  bytes, video bytes, residual bytecode bytes, and the runtime's estimated first-frame work. These are
  written to `budgets.json` and surfaced in `build-info.json`.
- **IMPL-120-R029** `--budget-strict` turns budget overruns into failures (exit 5). Default is warn:
  budgets are targets from GFX-§16/AST-§4, and a real title may exceed them with a documented reason.
- **IMPL-120-R030** A budget overrun MUST name the top contributors (per-asset and per-module), not just
  the total — the report is a work list, not a verdict.

### 7.1 Budget diagnostics

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0501` | warning | total transferred bytes over budget (per the AST-§4 table) |
| `SF0502` | info | atlas-page count over budget |

These are the codes the design spec `AST-§4` budget table cites; they live in the emitter range
because the report is produced by the plan pass (`budgets.json`).

## 8. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| `T-CMP-001` | name assignment stability across 100 shuffled dictionary orders | F1 |
| `T-CMP-002` | forbidden-construct lint over emitted output (one fixture per rule) | F1 |
| `T-CMP-003` | double build → `diff -r` is empty (incl. assets) | F1 |
| `T-CMP-004` | exit codes per failure class (5 fixtures) | F1 |
| `T-CMP-005` | cache equivalence: cold vs warm builds produce identical outputs | F1 |
| `T-CMP-006` | cancellation: SIGINT during an asset encode returns within 2 s, no partial files left | F1 |
| `T-CMP-007` | `verify --deep` detects an injected manifest↔TS drift, a missing asset, a tampered hash | F1 |
| `T-CMP-008` | `plan` output matches the real build's `budgets.json` within tolerance | F2 |

## 9. Work packages

| WP | Title | Depends | Est | Deliverable |
| --- | --- | --- | --- | --- |
| WP-120-01 | Pipeline runner: stages, context, cancellation | WP-020-10 | 4 | `packages/compile/src/pipeline.ts` |
| WP-120-02 | Cache: content-keyed stage cache + `--verify-cache` | WP-120-01 | 3 | T-CMP-005 |
| WP-120-03 | Dead-code pass + reporting | WP-120-01, WP-050-08 | 3 | `passes/dead-code.ts` |
| WP-120-04 | Requirement tree-shaking + module grouping | WP-120-01, WP-050-09 | 3 | `passes/shake.ts` |
| WP-120-05 | Name assignment pass | WP-120-01, WP-050-10 | 2 | `passes/names.ts`, T-CMP-001 |
| WP-120-06 | Frame-script grouping/hoisting | WP-120-01, WP-030-09 | 3 | `passes/frames.ts` |
| WP-120-07 | Asset planner + encoding scheduler | WP-070-07, WP-080-10, WP-090-10, WP-110-06 | 4 | `passes/assets.ts` |
| WP-120-08 | Emitter: symbols, frames, classes, buttons | WP-120-05 | 6 | `emit/*.ts` |
| WP-120-09 | Emitter: residual blobs + entry descriptors | WP-120-08, WP-050-08 | 2 | `emit/residual.ts` |
| WP-120-10 | Manifest emission (TS + JSON) + drift check | WP-120-08 | 3 | T-CMP-007 |
| WP-120-11 | Reports: build-info, porting-notes, divergence | WP-120-10 | 3 | report writers |
| WP-120-12 | `verify` implementation + forbidden-construct lint | WP-120-10 | 4 | T-CMP-002/007 |
| WP-120-13 | CLI: build/plan/inspect/verify/report + exit codes | WP-120-12 | 4 | `packages/cli`, T-CMP-004 |
| WP-120-14 | Determinism hardening + double-build CI job | WP-120-13 | 2 | T-CMP-003 |
| | **Total** | | **46** | |

## 10. Done criteria

1. `swfforge build` on the reference title produces a project that type-checks, passes `verify`, and
   rebuilds byte-identically.
2. Every CLI command works on a partial/failing input without crashing, with the documented exit code.
3. Cache warm/cold equivalence holds over the whole corpus.
4. Every emitted symbol is either referenced or listed; no orphaned code paths in the manifest.
5. `porting-notes.json` names every diagnostic, every `[verify]` item, and every gate and its state.

## 11. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Full pipeline/emitter/CLI specification derived from CMP/REPO/MS design specs |
| 1.1 | 2026-10-04 | §7.1 added: budget diagnostics `SF0501`/`SF0502` in the emitter range, matching the design spec's budget table (which previously cited font codes `SF0230`/`SF0231`); errata `E-016` |
| 1.2 | 2026-10-04 | Citation fix: `REPO-D09` -> `REPO-D06`, a decision that now exists (`specs/010` §11; errata `E-024`) |
