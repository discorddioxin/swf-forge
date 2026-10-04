# CLN — Clean Engine (modern restructuring)

**Doc ID:** CLN · **Status:** Draft 1.0 · **Normative:** yes · **Kind:** design specification
**Components:** `apps/engine-clean` · `@swf-forge/engine-clean` + `@swf-forge/clean` (TECH-§2)
**Depends on:** AVM1 (semantics, tiers, recovery), CMP (model, config, reports), AST (manifest),
RT (loop and platform rules it replaces), GFX/AUD (rendering and audio behaviour it must preserve),
TST (conformance gates), TECH (structure and cross-component rules)
**Implementation doc:** [impl/160](../../impl/engine-clean/160-engine-clean.md)

---

## 1. Scope

`engine-clean` is the second target of the toolchain. Where `engine-flash` reproduces Flash
semantics exactly, `engine-clean` **restructures** a compiled title into a modern, conventional
TypeScript application and runs it on a small purpose-built runtime.

The user-facing promise: *the same game, as code a modern game developer would have written* —
**no MovieClip system, no frame/timeline semantics, no depth lists, no `_root`/`_parent` chains, no
`onEnterFrame` polling**; instead an explicit fixed-timestep game loop, scenes and entities as
classes/modules, typed state, and typed asset imports.

It has two halves:

| Half | Deliverable | Runs | Owns |
| --- | --- | --- | --- |
| **Transform engine** | `forge-clean` CLI → a clean project tree | build time (Node) | heuristics, rewrite log, migration report, refusal policy (§5) |
| **Clean runtime** | `@swf-forge/engine-clean` | browser | loop, scene/entity lifecycle, input, audio, asset loading (§7) |

### 1.1 Non-goals

**CLN-R001** The clean engine MUST NOT attempt to *redesign* a game: no new gameplay, no balance
changes, no asset substitution, no "improvements" that change observable behaviour without being
declared (CLN-§8).

**CLN-R002** The clean engine MUST NOT ship or import a residual AVM1 interpreter by default
(CLN-D02). Titles whose code does not reach T0/T1 (`AVM1-§9`) are refused with a report, not silently
compiled.

**CLN-R003** The clean engine MUST NOT guess through ambiguity: every rewrite is either proven by the
model or the title is refused (`TECH-D08`).

**CLN-R004** `engine-clean` MUST NOT embed, import, or shim the flash engine, the timeline model, or
the AVM1 object model (TECH-R003, TECH-R021).

## 2. What "clean" means (definition of done)

A clean build is accepted only when all of the following hold for the emitted project:

| # | Property | Enforced by |
| --- | --- | --- |
| 1 | No `MovieClip`/`Timeline`/`_root`/`_parent`/`onEnterFrame`/depth-list/frame-script vocabulary anywhere in `src/` | `T-CLN-101` |
| 2 | Exactly one loop owner (`game/loop.ts`), fixed timestep + interpolation, no clock reads elsewhere | `T-CLN-102`, `TECH-R022` |
| 3 | Scenes and entities are explicit modules/classes with `init/update/dispose`; no hidden globals | `T-CLN-105`, `T-CLN-108` |
| 4 | State is typed and owned (fields on scenes/entities), never reached through a string path | `T-CLN-108`, `T-CLN-112` |
| 5 | Input is event-driven through a typed action map; no per-frame key polling in render code | `T-CLN-108` |
| 6 | Assets are typed handles from the same manifest schema as the flash target | `T-CLN-109` |
| 7 | Compiles under `strict` with zero suppressions; no `any`; Prettier-formatted; lint-clean | `T-CLN-114` |
| 8 | Every rewrite is recorded (`rewrite-log.json`) and every deviation from Flash behaviour is declared (`migration-report.json`) | `T-CLN-112` |
| 9 | The project runs on a browser engine set with no Flash-semantics helpers in the bundle | `T-CLN-101`, `T-CLN-103` |

**CLN-R005** Properties 1–9 are gates, not aspirations: a build that fails any of them fails the
`clean` target and leaves the flash target untouched (`TECH-R030`).

## 3. The loop

**CLN-R006** Clean output MUST own a single fixed-timestep loop with interpolation:

```ts
// src/game/loop.ts (generated shape, not a template to copy)
const app = createApp({
  scene: () => new LevelOne(),                    // explicit construction, no timeline
  loop: { fixedStepMs: 1000 / 60, maxSubSteps: 5, interpolate: true },
  input: inputMap,                                 // typed actions (§5.4)
});
app.start();
```

- The step is configurable (`--fps`, default 60); `maxSubSteps` bounds catch-up after tab stalls
  (replacing Flash's frame-dropping semantics — a declared deviation, CLN-R021).
- Physics/state updates run on the fixed step; rendering interpolates (alpha blending of the last
  two states) where the recovered motion is continuous (position/rotation/alpha), and snaps where it
  is not (boolean states, text, frame-indexed art) — declared per entity in the rewrite log.
- Pause/resume, tab-visibility clamping, and "resume without a catch-up burst" follow RT-§4.3's
  policy so both engines agree on user-visible behaviour.

**CLN-R007** The loop MUST be deterministic given the same input event sequence and the same seed
(`CLN-D03`); no wall-clock reads outside `loop.ts`, no timers, no microtask-driven game logic
(AVM1-R014 analogue).

## 4. Removing the timeline and the MovieClip system

### 4.1 Timeline → scene compilation (three tiers)

| Tier | When it applies | What is emitted |
| --- | --- | --- |
| **T-A static scene** | Every frame's display list is identical (or differs only by scripted state) | One `Scene` class; placements become field initialisers; frame scripts become `init()`/event handlers in order |
| **T-B state machine** | Placements change on keyframes, or `gotoAndPlay`/`gotoAndStop` targets a small, statically known set of labelled frames | A `Scene` with an explicit `states` enum + `enterState()/update()` transitions, one method per state |
| **T-C dynamic timeline** | Timeline content is data-driven at runtime (e.g. `attachMovie` per level, timeline scripts building menus) | Scene + entity factories; the timeline's structure becomes data (levels, waves) with explicit construction calls; still no frame semantics |

**CLN-R008** The chosen tier and its evidence MUST be recorded per scene in the rewrite log; a
timeline that matches no tier (e.g. `gotoAndPlay` on a computed frame label) is a **blocking
pattern** (`CLN-D04`, exit 6).

**CLN-R009** `gotoAndPlay` on a *sprite* timeline MUST become an explicit per-entity state machine
(`T-B`) or a method call on the entity; it MUST NOT become a timer or a counter that mimics frames.

### 4.2 Event model

| Flash-era construct | Clean equivalent |
| --- | --- |
| `onClipEvent(load)` / `onLoad` | constructor / `init()` |
| `onEnterFrame` | `update(dtMs)` on the entity, called by the scene in a defined order |
| `onClipEvent(enterFrame)` on a timeline | the scene's `update`, in the original child order |
| `on(press/release/rollOver…)` | input action bindings: `input.bind('shoot', () => this.fire())` |
| Button `on(release)` blocks | scene-level command handlers, named after the recovered label |
| `setInterval`/`setTimeout` | a `TimedAction` scheduled on the fixed step (declared deviation: drift) |
| `onData`/`loadVariables` | the manifest's data assets, awaited during scene load (no runtime network) |

**CLN-R010** Update order within a frame MUST be preserved from the original display list order
(parents before children, depth order within a parent) unless the rewrite log declares a change and
the conformance probe (`CLN-R021`) still passes.

### 4.3 Object model

- Recovered prototypes/classes become ES classes with methods (AVM1-§6 recovery output).
- `MovieClip`/`_root` state that is *statically* reachable becomes fields on the owner (scene, entity,
  or a `GameState` shared object when more than one owner touches it).
- Dynamic property bags (`obj[name] = …`, `for…in` over host objects) are preserved **only** as an
  explicitly typed `dynamic: Record<string, unknown>` with accessor helpers, and reported as
  "unmodernised" in the migration report (`CLN-D05`).
- `duplicateMovieClip`/`attachMovie`/`removeMovieClip` become entity factory calls on a typed
  registry; `getDepth`/`swapDepths` become explicit ordering operations **only when observable**
  (a `depthOrder` array on the scene) and are otherwise dropped with a rewrite note.

## 5. Heuristics and their contract

**CLN-R011** Every transformation MUST be a named rule with: an id (`CLN-xNN` or `SF08xx` diagnostic),
a precondition expressed over the analysed model, a deterministic effect, and a rewrite record.
Rules run in a fixed order (`clean/pipeline.ts` order is normative) and MUST be idempotent.

Default rule families (all disable-able via `forge.clean.json`, none silently optional):

| Family | Examples | Blocking when |
| --- | --- | --- |
| `timeline.*` | static-scene fold, keyframe→state machine, `gotoAndStop`→`enterState` | tier T-C fails (`CLN-D04`) |
| `types.*` | prototype→class, property→field, literal enum recovery | a property path is computed and cannot be proven |
| `state.*` | `_root.x` → `state.x`, singleton extraction, initial-value recovery | two owners write one recovered field and no owner can be proven |
| `input.*` | key polling → action map, button handlers → commands | key codes come from data at runtime |
| `audio.*` | `attachSound`/`start` → typed handles + policy, stream sound → scene music state | stream sync semantics are load-bearing for the title (declared deviation instead) |
| `assets.*` | `loadMovie`/`loadVariables` → manifest entries | target URL is computed or remote (network policy, RT-§6) |
| `format.*` | Prettier pass, import ordering, dead-code removal from provable branches | never (safe) |

**CLN-R012** A rewrite MUST NOT change an observable value unless the corresponding entry is in
`migration-report.json` with a tolerance and a probe (`CLN-R021`).

**CLN-R013** Determinism: identical input + policy ⇒ byte-identical clean tree and rewrite log
(`TECH-R010`), including rule ordering and generated names.

## 6. Rewrite log and migration report

```jsonc
// diagnostics/rewrite-log.json  (stable ordering: file, start offset, rule id)
{
  "formatVersion": 1,
  "rules": { "timeline.static-scene": { "applied": 12, "refused": 0 } },
  "entries": [
    { "file": "src/game/scenes/LevelOne.ts", "rule": "timeline.keyframe-state-machine",
      "source": { "sprite": 12, "frames": [1, 40, 88] },
      "evidence": "labelled frames + 3 placement diffs",
      "effect": "states enum + enterState() emitted",
      "deviation": null },
    { "file": "src/game/state.ts", "rule": "state.dynamic-bag",
      "evidence": "obj[name] with a computed name in fn #214",
      "effect": "typed dynamic bag with accessors", "deviation": "property enumeration order" }
  ]
}
```

**CLN-R014** `REWRITES.md` MUST be the readable projection of the same data: grouped by file, one
line per rewrite, plus a summary table per rule family. The engine MUST refuse to emit one without
the other.

**CLN-R015** `migration-report.json` MUST list, for each declared deviation: the affected scene(s),
what Flash did, what the clean app does, why (rule id), and the probe that measures the difference
(`CLN-R021`). Titles whose declared deviations exceed the policy's tolerance fail the clean build
(exit 6).

## 7. The clean runtime (`@swf-forge/engine-clean`)

Minimal, typed, tree-shakeable, and **small**:

| Module | Responsibility | Budget |
| --- | --- | --- |
| `loop` | fixed step, interpolation, pause/visibility, determinism (§3) | ≤ 3 KB gz |
| `scene` | scene contract (`init/update/dispose`), scene stack/transitions | ≤ 3 KB gz |
| `entity` | entity contract, update ordering, pooling helpers | ≤ 2 KB gz |
| `input` | action map, keyboard/pointer/gamepad bindings, focus policy | ≤ 4 KB gz |
| `audio` | typed handles over the AUD mixer (event sounds, music state) | shares `@swf-forge/audio` |
| `assets` | manifest loader + typed handles (same schema as flash) | shares `@swf-forge/assets` |
| `render` | thin scene-graph-free draw API over GFX (sprite/text/geometry batches) | ≤ 5 KB gz |
| `debug` | optional frame/state hooks for the inspector (dev builds only) | 0 in production |

**CLN-R016** The clean runtime MUST NOT expose timeline, depth, `_root`, or MovieClip vocabulary; a
game that needs them has not been transformed (CLN-R005 #1).

**CLN-R017** Core runtime budget: ≤ 20 KB gzipped for `loop + scene + entity + input + assets`
(render and audio excluded, they are shared with the flash target); exceeding it requires a
design-spec changelog entry with the measured numbers.

**CLN-R018** Runtime APIs MUST be synchronous with respect to game logic: `await` is permitted only
in asset loading and scene transitions, never inside `update`/`draw` (determinism, CLN-R007).

## 8. Fidelity: declared deviation, measured

**CLN-R019** Clean output is **not** bit-faithful by construction. The contract is: *same observable
game behaviour within declared tolerances*, measured by running both engines side by side
(TST-§6 harness) on the title's scripted play-through.

**CLN-R020** Deviations MUST be classified:

| Class | Example | Policy |
| --- | --- | --- |
| **D-A structure** | frame scripts → `update` methods; depth list → explicit order | always allowed (no behaviour change by construction) |
| **D-B timing** | fixed step + interpolation; no frame dropping; timer drift | allowed with tolerance: visual ≤ TST-§6.1, audio ≤ 12 ms (TST-§7) |
| **D-C dynamic semantics** | property enumeration order, dynamic bags, `eval`-like paths | allowed only if the probe passes; otherwise refuse |
| **D-D content** | nothing: content is never modernised (CLN-R001) | forbidden |

**CLN-R021** Every deviation MUST have a **probe**: a named, scripted check (input sequence → expected
observable) run against both engines; probes live with the project's conformance suite and are listed
in `migration-report.json`.

**CLN-R022** A title is *clean-ready* only when: all blocking patterns are absent, its `T-CLN` suite
passes, and its probes pass within tolerances. Until then the flash target is the shipping output
(`TECH-R030`).

## 9. Test obligations (design level)

| ID | Test | Level |
| --- | --- | --- |
| `T-CLN-001` | Vocabulary gate: generated clean trees for the fixture corpus contain no forbidden token (`MovieClip`, `_root`, `onEnterFrame`, …) in code, comments or strings | F1 |
| `T-CLN-002` | Loop contract: fixed step, `maxSubSteps`, pause/visibility behaviour, determinism across runs with the same input replay | F1 |
| `T-CLN-003` | Timeline tiers: T-A/T-B/T-C fixtures compile to the documented shapes; an untierable timeline refuses with exit 6 and a report | F1 |
| `T-CLN-004` | Event mapping: `onLoad`/`onEnterFrame`/button handlers map to the §4.2 equivalents in order | F1 |
| `T-CLN-005` | State recovery: static property paths become owned fields; computed paths become typed dynamic bags with a rewrite entry | F1 |
| `T-CLN-006` | Rewrite log/report schema: stable ordering, rule counts, deviations all carry probes; `REWRITES.md` regenerates identically | F1 |
| `T-CLN-007` | Refusal policy: each blocking pattern from §5 produces exit 6, leaves the flash target untouched, and names the pattern | F1 |
| `T-CLN-008` | Side-by-side fidelity: the flash and clean engines run the same scripted play-through; all probes pass within the declared tolerances | F2 |
| `T-CLN-009` | Runtime budget and API shape: size budgets hold; runtime exports no forbidden vocabulary; no `await` inside `update` | F1 |
| `T-CLN-010` | Determinism: two clean builds of the same title are byte-identical (including the logs) | F1 |

## 10. Decision register

| ID | Decision | Default | Rationale |
| --- | --- | --- | --- |
| `CLN-D01` | Clean output is generated from the analysed model/IR, not by rewriting emitted TS text | Model-driven passes; an optional Prettier/import pass runs last | the model knows semantics; text rewriting cannot |
| `CLN-D02` | Residual AVM1 in clean output | Forbidden; `--allow-residual` (off) wraps blobs as isolated modules with warnings | a clean app with a bytecode interpreter is not clean (CLN-R002) |
| `CLN-D03` | Loop semantics | Fixed step (60 Hz default) + interpolation + `maxSubSteps` 5 | conventional, deterministic, and probe-measurable |
| `CLN-D04` | Timeline tiering | T-A/T-B/T-C as in §4.1; no tier ⇒ refuse | structural decisions must be provable |
| `CLN-D05` | Dynamic property bags | Keep as typed `Record<string, unknown>` + accessors, reported | preserves semantics without inventing types |
| `CLN-D06` | Naming | Recovered AS names first; deterministic synthesis otherwise (`hero_2`, `LevelTwo`); never order-dependent | readability is the point of the target |
| `CLN-D07` | Formatting/lint | Prettier + project ESLint config; clean output lints clean | hand-editable output |
| `CLN-D08` | Assets | Byte-identical to the flash target's shared payloads (TECH-R006) | one asset pipeline, both targets |
| `CLN-D09` | Sound | Event sounds → mixer calls; stream sound → scene music state (declared timing deviation) | stream sync semantics do not survive de-timelining |
| `CLN-D10` | Where transforms live | `@swf-forge/clean` (library); app is CLI + bundle | testable without a CLI |
| `CLN-D11` | Policy file | `forge.clean.json`: rule on/off, tolerances, refusal policy | per-title control, checked into the project |

## 11. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-10-04 | Initial design specification: the clean target (transform engine + minimal runtime), definition of done (nine gates), fixed-step loop contract, timeline→scene tiering (T-A/T-B/T-C) and event/object-model mappings, the heuristic contract with rule families and refusal policy, rewrite log and migration report schemas, runtime module budgets and API rules, declared-deviation classes with probes, `T-CLN-001`–`010` and the `CLN-D01`–`D11` register |
