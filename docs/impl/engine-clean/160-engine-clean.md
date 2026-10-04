# IMPL-160 — Clean Engine: Transforms and Runtime

**Doc ID:** IMPL-160 · **Status:** ready (design-driven; depends on 050/120/130) · **Packages:** `@swf-forge/clean` (library), `@swf-forge/engine-clean` (`apps/engine-clean`)
**Format spec:** none (consumes the analysed model)
**Design specs:** CLN (whole), AVM1-§6/§9 (recovery, tiers), CMP-§5/§7 (model, codegen contract), RT-§4 (loop policy it replaces), GFX/AUD (behaviour to preserve), AST-§5 (manifest), TST-§6 (side-by-side probes)

---

## 1. Deliverables

1. **`@swf-forge/clean`** — the transform engine: rule framework, the default rule families, the
   rewrite log and migration-report emitters, the refusal policy.
2. **`@swf-forge/engine-clean`** — the clean runtime (`loop`, `scene`, `entity`, `input`, `render`,
   plus reused `assets`/`audio`) and the `createApp()` entry.
3. **`forge-clean`** — the CLI (`clean`, `report`, `apply`) with `--from <flash-out>` and policy
   loading, plus the `--target clean` path inside `swfforge build`.
4. Clean-project emitters: `game/loop.ts`, `game/state.ts`, `game/scenes/*.ts`, `game/entities/*.ts`,
   `game/input.ts`, `game/audio.ts`, `games/assets.ts`, `diagnostics/{REWRITES.md, rewrite-log.json,
   migration-report.json}` (TECH-§3.4b).
5. The **probe runner**: side-by-side flash-vs-clean execution for a scripted play-through (CLN-R021).

## 2. Module layout

```
packages/clean/src/
  pipeline.ts             runClean(model, policy) → CleanResult (fixed stage order, idempotent)
  rules/registry.ts       rule ids, families, preconditions DSL, enable/disable
  rules/timeline/*.ts     static-scene, keyframe-state-machine, data-driven-tier, goto-mapping
  rules/state/*.ts        property→field, singleton extraction, initial-value recovery, dynamic bag
  rules/types/*.ts        prototype→class bridge, enum/literal recovery, dead-branch pruning
  rules/input/*.ts        key polling → action map, button handlers → commands
  rules/audio/*.ts        attachSound/start → handles, stream → scene music state
  rules/format/*.ts       Prettier pass, import ordering, name finalisation
  emit/{scenes,entities,loop,state,audio,assets}.ts     clean-project writers
  log.ts                  rewrite-log.json + REWRITES.md (stable ordering, byte-identical rebuild)
  report.ts               migration-report.json (deviations + probes + refusals)
  policy.ts               forge.clean.json schema + validation
apps/engine-clean/src/
  cli.ts                  forge-clean verbs, exit codes (incl. 6)
  runtime/loop.ts         fixed step + interpolation + pause/visibility + determinism
  runtime/scene.ts        scene contract, transitions, scene stack
  runtime/entity.ts       entity contract, update ordering, pooling
  runtime/input.ts        action map, keyboard/pointer/gamepad, focus policy
  runtime/render.ts       thin draw API over @swf-forge/gfx
  runtime/index.ts        createApp() + public types
```

**IMPL-160-R001** Transforms consume the analysed model and AVM1 IR (`TECH-D10`, `CLN-D01`); the only
pass that reads emitted TS text is `format.*` (Prettier + import ordering), and it MUST NOT change
semantics.

**IMPL-160-R002** `@swf-forge/clean` MUST NOT import `@swf-forge/runtime`, `@swf-forge/gfx`, or
`@swf-forge/audio` except in tests (`TECH-R016`); the clean runtime MAY import `gfx`/`audio`/`assets`.

**IMPL-160-R003** `forge-clean` MUST accept either `--from <flash-out>` (re-using the transpiler's
model dump + manifest) or a direct SWF, and MUST produce identical output for both paths
(`T-CLN-104`).

## 3. Transform pipeline (stages C0–C6)

| Stage | Input → output | Notes |
| --- | --- | --- |
| **C0 Load** | `forge.project.json` + model dump + IR + manifest → `CleanInput` | validates the artefacts; `SF0801` when a required input is missing |
| **C1 Plan** | rule candidates + timeline tiers → `CleanPlan` | every scene gets a tier (T-A/T-B/T-C) or a refusal; no transformation runs before the plan exists |
| **C2 State** | property/field recovery, state graph → owned types | `state.*` family; refusals recorded |
| **C3 Structure** | timeline→scene/entity emission per tier; event mapping | `timeline.*`, `input.*`, `types.*` |
| **C4 Media** | audio/video/asset wiring against the *same* manifest | `audio.*`, `assets.*`; must not re-encode assets (`CLN-D08`) |
| **C5 Emit** | clean project tree + `format.*` pass | deterministic writers; Prettier last |
| **C6 Report** | rewrite log, `REWRITES.md`, migration report, refusals | `CLN-R014`/`R015`; exit 6 when a blocking pattern exists |

- **IMPL-160-R004** The pipeline MUST be restartable from C0 with identical results; no stage may
  depend on process state, environment, or iteration order (`TECH-R010`).
- **IMPL-160-R005** A refusal at any stage MUST leave no partial output: the writers write to a temp
  directory and publish atomically (`SF0802` when publishing fails).

## 4. Timeline tiering

- **IMPL-160-R006** Tier selection is a pure function of the sprite/timeline's placement table, its
  label map, and the statically resolved `goto*` targets; the plan records the evidence (frame
  numbers, label names, placement diffs) verbatim for the rewrite log (`CLN-R008`).
- **IMPL-160-R007** T-A emits one scene class whose `init()` runs frame-1 scripts in order and whose
  later frame scripts become methods invoked from the scene's update (in original frame order);
  placement state becomes typed fields.
- **IMPL-160-R008** T-B emits a `states` enum (labels first, `frame_<n>` otherwise) plus
  `enterState()/leaveState()` and a transition table; `gotoAndPlay` maps to `enterState(name)` and
  `play()/stop()` map to explicit `running` flags. Sprites that are pure sub-animations keep an
  `animationTimeMs` field and a `frameAt(t)` helper *inside the entity*, never a global frame clock
  (`CLN-R009`).
- **IMPL-160-R009** T-C emits entity factories plus data modules (level/wave tables); every factory
  call site becomes an explicit construction with the arguments recovered at the call site. If a
  construction argument is computed at runtime and not recoverable, the rule refuses
  (`SF0803`, blocking) unless the policy sets `allowDynamicConstruction: true`, in which case the
  call is emitted as a documented data-driven factory invocation and reported.
- **IMPL-160-R010** Depth ordering: when the original display list order is observable (hit testing,
  `getDepth`, z-order changes), the scene emits an explicit `order: Entity[]` array maintained by
  `bringToFront/sendToBack/swap`. When it is not observable, ordering is dropped with a rewrite note.

## 5. Rule contract and default families

- **IMPL-160-R011** Every rule exposes `{ id, family, preconditions(model), apply(model), evidence,
  diagnostics }`; `preconditions` MUST be total over the model (never throw) and MUST NOT mutate.
  Rules are pure functions returning new facts, applied in the stages above.
- **IMPL-160-R012** Rules MUST be idempotent: applying a rule to its own output is a no-op
  (`T-CLN-106`). Rule ids are stable forever; retiring a rule means adding a tombstone entry.
- **IMPL-160-R013** Each applied rule emits exactly one rewrite entry per affected source range,
  with the evidence it used (`CLN-§6`). Rules that cannot prove a rewrite MUST refuse
  (`SF08xx`, blocking or degradation per family) rather than approximate.
- **IMPL-160-R014** Policy (`forge.clean.json`) can disable rule families and set tolerances, but
  cannot make a blocking pattern non-blocking except through its documented escape
  (`allowDynamicConstruction`, `allowResidual` — both off by default).

## 6. Rewrite log and migration report

- **IMPL-160-R015** `rewrite-log.json` entries are ordered by (file, source offset, rule id) and
  contain: `rule`, `source` (sprite/frame/tag/function), `evidence`, `effect`, `deviation` (null or
  class D-A/D-B/D-C). No timestamps, no absolute paths (`TECH-R007`).
- **IMPL-160-R016** `REWRITES.md` is generated from the log only (no extra information) so the two can
  be diffed; headers group by file, then rule family, with counts.
- **IMPL-160-R017** `migration-report.json` lists: refusals (with the diagnostic and the flash-path
  fallback), deviations (with class, tolerance, and probe id), and unmodernised constructs
  (dynamic bags, retained data-driven factories).
- **IMPL-160-R018** The probe runner MUST be able to run a probe against both engines, record the
  observations, and compare them within tolerances (visual per TST-§6.1, audio ≤ 12 ms per TST-§7);
  probe results are attached to the report (`CLN-R021`).

## 7. Clean runtime

- **IMPL-160-R019** `loop.ts` is the only module that reads the clock: it owns the accumulator,
  `fixedStepMs`, `maxSubSteps` (default 5), pause/visibility handling, interpolation alpha, and a
  deterministic input-replay mode for tests (`CLN-R007`).
- **IMPL-160-R020** `scene.ts` defines the scene contract (`init(ctx)`, `update(dtMs)`,
  `dispose()`), a scene stack (push/pop/replace) with transition hooks, and nothing else; scene
  code MUST NOT import the loop.
- **IMPL-160-R021** `entity.ts` defines the entity contract (`update(dtMs)`, optional `draw(alpha)`),
  the update order (scene children in `order`, parents before children), pooling helpers, and
  removal deferred to the end of the step.
- **IMPL-160-R022** `input.ts` exposes `bind(action, handler)` over a typed action map, with focus
  and capture rules; game code MUST NOT read raw key state from `KeyboardEvent` (`CLN-R005` #5).
- **IMPL-160-R023** `render.ts` draws through `@swf-forge/gfx` (batches, text, geometry) with no
  scene graph; it MUST NOT expose depth or MovieClip-shaped APIs (`CLN-R016`).
- **IMPL-160-R024** Runtime exports MUST be treeshake-able and MUST NOT reference `MovieClip`,
  `Timeline`, `_root`, `_parent`, `onEnterFrame`, or depth lists — enforced by a lint rule and
  `T-CLN-101`.
- **IMPL-160-R025** Budgets (`CLN-R017`): `loop ≤ 3 KB`, `scene ≤ 3 KB`, `entity ≤ 2 KB`,
  `input ≤ 4 KB`, core total ≤ 20 KB gz; `render` ≤ 5 KB gz. Budgets are CI gates
  (`T-CLN-102`).

## 8. Determinism and performance

- **IMPL-160-R026** Two clean builds of the same input + policy MUST be byte-identical, including
  `rewrite-log.json` and `REWRITES.md` (`T-CLN-110`).
- **IMPL-160-R027** Transform cost is bounded: ≤ 60 s for a 50 MB title on the baseline CI machine,
  with a per-stage report; the plan stage must not build full placement diffs for timelines that are
  provably static (early exit).
- **IMPL-160-R028** Generated clean code MUST be Prettier-formatted and lint-clean in the project's
  own config (`CLN-D07`); the emitter never emits `any`, suppressions, or `@ts-ignore`.

## 9. Diagnostics block (`SF0800`–`0899`)

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0801` | error | required clean input missing (model dump, IR, manifest) |
| `SF0802` | error | output publish failed (temp → final) |
| `SF0803` | error (blocking) | dynamic construction cannot be proven (`CLN-R009` refusal) |
| `SF0810` | error (blocking) | timeline tier cannot be determined for a scene |
| `SF0811` | warning | depth ordering not observable; ordering dropped |
| `SF0812` | warning | sprite sub-animation kept as an explicit time-based helper |
| `SF0820` | warning | state field reached through a computed path; typed dynamic bag emitted |
| `SF0821` | warning | two owners write one recovered field; no owner proven (bag + report) |
| `SF0830` | error (blocking) | computed key code / computed input mapping |
| `SF0831` | warning | key polling outside `onEnterFrame` mapped heuristically (evidence recorded) |
| `SF0840` | warning | stream sound replaced by scene music state (declared timing deviation) |
| `SF0841` | warning | `loadMovie`/`loadVariables` target computed; resolved to manifest entry |
| `SF0850` | error (blocking) | residual T2 code present and `allowResidual` is off (`CLN-D02`) |
| `SF0851` | warning | residual blobs wrapped as isolated modules (`allowResidual` on) |
| `SF0860` | warning | runtime bundle over budget (CI gate failure in release mode) |
| `SF0870` | info | rule disabled by policy |
| `SF0871` | info | unmodernised construct recorded in the migration report |

**IMPL-160-R029** Blocking codes MUST leave the flash target untouched and exit `6`
(`TECH-D08`, `T-CLN-107`).

## 10. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| `T-CLN-101` | Vocabulary gate over the whole fixture corpus (`CLN-R005` #1, `CLN-R016`) | F1 |
| `T-CLN-102` | Runtime budgets and treeshaking (per-module and core totals) | F1 |
| `T-CLN-103` | Loop: fixed step, catch-up bound, pause/visibility, replay determinism | F1 |
| `T-CLN-104` | Write-back: clean tree from `--from` and from SWF are identical (`IMPL-160-R003`) | F1 |
| `T-CLN-105` | T-A/T-B/T-C fixtures produce the documented shapes; evidence recorded | F1 |
| `T-CLN-106` | Rule idempotence + stable ordering of the rule set | F1 |
| `T-CLN-107` | Refusal matrix: each blocking code → exit 6, report, flash target intact | F1 |
| `T-CLN-108` | Event/state mapping over a 12-sprite fixture (load/enterFrame/press, fields, bags) | F1 |
| `T-CLN-109` | Asset byte-identity with the flash target for shared payloads (`TECH-R006`) | F1 |
| `T-CLN-110` | Byte determinism of the whole clean build incl. logs | F1 |
| `T-CLN-111` | Side-by-side probes: `T-CLN-008` at implementation level, tolerances enforced | F2 |
| `T-CLN-112` | Auditor pass: every rewrite entry has evidence and a rule id; every deviation has a probe | F1 |
| `T-CLN-113` | Performance: `IMPL-160-R027` bounds, with the static-timeline early exit measured | F3 |
| `T-CLN-114` | Output hygiene: clean `src/` compiles under `strict` with zero suppressions, contains no `any`, and is Prettier-clean in the project's config | F1 |

## 11. Work packages

| WP | Title | Depends | Est | Deliverable |
| --- | --- | --- | --- | --- |
| WP-160-01 | Rule framework + policy (`registry`, `pipeline`, `policy.ts`) | WP-050-08, WP-120-01 | 4 | `clean/pipeline.ts`, T-CLN-106 |
| WP-160-02 | Timeline tiering (plan stage, evidence, refusals) | WP-160-01 | 5 | `rules/timeline/*`, T-CLN-105/107 |
| WP-160-03 | State recovery (property→field, singletons, bags) | WP-160-01, WP-050-11 | 5 | `rules/state/*`, T-CLN-108 |
| WP-160-04 | Type/structure passes (prototype→class bridge, dead branches) | WP-160-01, WP-050-14 | 4 | `rules/types/*`, T-CLN-108 |
| WP-160-05 | Input mapping (polling → action map, button handlers) | WP-160-03, WP-100-05 | 3 | `rules/input/*`, T-CLN-108 |
| WP-160-06 | Media wiring (audio handles/music state, asset manifest reuse) | WP-160-01, WP-090-07 | 3 | `rules/audio/*`, T-CLN-109 |
| WP-160-07 | Clean-project emitters (scenes, entities, loop, state, audio, assets) | WP-160-02…06 | 5 | `emit/*`, T-CLN-101/104 |
| WP-160-08 | Rewrite log + `REWRITES.md` + migration report emitters | WP-160-07 | 3 | `log.ts`, `report.ts`, T-CLN-112 |
| WP-160-09 | Clean runtime: loop + scene + entity + input | WP-160-01 | 5 | `runtime/*`, T-CLN-102/103 |
| WP-160-10 | Clean renderer bridge over GFX + debug hooks | WP-160-09, WP-130-08 | 4 | `runtime/render.ts`, T-CLN-102 |
| WP-160-11 | `forge-clean` CLI (`clean`/`report`/`apply`, exit codes) | WP-160-07, WP-160-08 | 3 | `cli.ts`, T-CLN-107 |
| WP-160-12 | Probe runner + side-by-side conformance wiring | WP-160-10, WP-140-03 | 4 | probe runner, T-CLN-111 |
| WP-160-13 | Determinism/perf harnesses + CI gates | WP-160-11 | 3 | T-CLN-110/113 |
| | **Total** | | **51** | |

## 12. Done criteria

1. Every CLN requirement is covered by a test in this document or `specs/130`'s table.
2. The clean build is refused (exit 6) for every blocking pattern in the corpus of deliberately
   hostile fixtures, with the flash target untouched.
3. Two clean builds are byte-identical; a 50 MB title transforms inside `IMPL-160-R027`.
4. Probes pass for at least the three open-corpus titles that are declared clean-ready, within the
   declared tolerances (`CLN-R022`).
5. Runtime budgets hold and the vocabulary gate is green for the whole corpus.

## 13. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-10-04 | Initial implementation spec: `@swf-forge/clean` module layout, stages C0–C6, timeline tiering rules (T-A/T-B/T-C with evidence and refusals), the rule contract and default families, rewrite-log/migration-report emitters, the clean runtime modules and budgets, `SF0801`–`SF0871`, `T-CLN-101`–`113`, WP-160-01…13 (53 d) |
| 1.1 | 2026-10-04 | Tech-spec pass: WP table total corrected to the row sum (51 d); the document is now referenced by `TECH-SPEC.md` §2/§3 and the roadmap's P13 |
