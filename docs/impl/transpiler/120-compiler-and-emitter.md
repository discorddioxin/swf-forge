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

`IMPL-120` §2's seven stage names are the build spine; `CMP` §2's S0–S10 are the same spine at a finer
grain, and the two are not one-to-one. `read` is S0 **and** S1, because the delivered `SwfFile` facade
(`WP-020-10`) builds the tag index and the dictionary in the same pass. `decode` is S3 **and** S4, which
`CMP-R001` permits to interleave per asset as long as the observable output is as if they were ordered.
`analyze` is S5 **and** S6, because the delivered `analyzeMovie` produces the IR and the tier verdicts in
one pass. `report` is S9. S10 `verify` is **not** a build stage: §6 makes it a command over an emitted
project (`WP-120-12`), runnable against output this process did not produce. The five §3 passes are not
stages either — they are pure functions over the model and the IR, run on their own spine between
`analyze` and `plan`, in the order dead code → requirement shake → tier finalise → names → frames.

### 2.1 Pipeline diagnostics

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0500` | info | a pipeline stage has no implementation in this build; the run report names every such stage |
| `SF0503` | warning | `--verify-cache` recomputed a cached stage and the bytes differed; the entry is evicted and the recomputed output is used |

A stage with no registered implementation is reported, never skipped silently — the same principle
`IMPL-120-R013` applies to pruning. The code exists so that a partially built compiler says what it
cannot do instead of reporting success over an empty output directory. §7.1's `SF0501`/`SF0502` are the
rest of the `SF05xx` compile range.

### 2.2 The stage cache

R002's cache is one JSON file per key under `.forge/cache/` (`CMP` §12; gitignored, never committed). The
key is `CMP` §12's `sha256(stageId ‖ stageInputHash ‖ toolVersion ‖ relevantConfigHash)` and the entry
stores the full stage output **plus** the metadata that makes it falsifiable: the declared effect set, the
tool version, the input hash and the relevant-config hash (`CMP-R038`).

- **The effect set is not in the key, and that is the point.** A stage that starts writing an extra file
  keeps the key it always had, so comparing the recorded effects is what detects the entry as stale; the
  run report names the reason (`cacheEvicted`) and the stage re-runs.
- **A stage's own options are inputs.** A cacheable stage folds them into its input hash: `analyze` is keyed
  on the movie's hash *and* its `legacyEncoding`, because a key that ignored the option would serve an
  analysis decoded with the wrong string semantics. `RELEVANT_CONFIG_KEYS` covers only what a stage reads
  from the config; `analyze` reads none, and `--verify-cache` is what catches an under-declared path (the
  recomputation under the new config would no longer match the entry the old key still points at).
- **A corrupt or unreadable entry is a miss, never a failure**, and it is evicted. The cache is an
  optimisation and a build must not break because of it. Writes go to a temp name in the same directory and
  are renamed, so a cancelled run leaves no partial entry (the same property R023 requires of asset writes).
- **Serialisation is structural, not per-stage.** A hand-written codec per stage would drop whatever field
  the IR grows next, and the drop would be silent because the reconstructed value still type-checks.
  `Map`, `Set` and `Uint8Array` are tagged (entries, not objects, so `schedule.initBySprite`'s number keys
  keep their type) and every object key is sorted, so identical content always writes identical bytes
  (`CMP-R040`). A stage whose output is a live object — `read`, `model` — declares no codec and is not
  cached; `analyze` is the first cacheable stage and also the most expensive one a porting loop repeats.
- **`--verify-cache` does not prove the codec lossless.** It compares the *serialised* recomputation with
  the stored payload, so a codec that loses information in both directions matches itself. The property
  that catches that is cold-versus-warm **output** equivalence (`T-CMP-005`) — measured against a
  projection that does not go through the codec. Both are required, for different failures: one detects a
  stale or tampered entry, the other detects a lossy cache format.

## 3. Post-model passes

| Pass | Job | Rules |
| --- | --- | --- |
| Dead code | Prove which characters and action blocks nothing can reach, report it, and remove it only when `--prune-dead-code` is set | `R005` |
| Requirement shake | Compute the union of host-API requirements per entry point; emit only used runtime modules | `R006` |
| Tier finalise | Merge per-function tier verdicts with the *call graph*: a T0 function that calls a T2 function stays T0 (it calls into the interpreter) | `R007` |
| Name assignment | Deterministic symbol names: recovered name → `sanitised` → `_2`, `_3` suffixes by sorted order | `R008` |
| Frame scripts | Group frame action blocks into per-frame functions; hoist blocks identical across frames | `R009` |
| Asset plan | Order of asset encodes, parallelism cap, budget accounting, fallback ladder selection | `R010` |

- **IMPL-120-R011** Symbol names MUST be assigned in a single pass over a *sorted* list of candidates
  (by source range, then character id), never by traversal order of a Map. Recovered names are a
  user-facing feature (readable output); instability across runs is a bug (`T-CMP-001`).
- **IMPL-120-R012** The emitter MUST NOT create a symbol for a construct it decided not to emit; the
  name table is closed *before* emission so that two passes cannot disagree.
- **IMPL-120-R013** Dead-code pruning MUST be reported per character and per action block, with
  reasons; pruning is never silent (design `CMP-D07`).
- **IMPL-120-R005** Removal of unreachable code or unreferenced characters MUST be opt-in through
  `--prune-dead-code` (`CMP` §4.6 step 5, §12's config table); without the flag the pass MUST still run and
  MUST still report what it *would* remove, because the report is what makes a "0 suppressions" claim
  reviewable. A character may be reported as prunable only on a **proof**, not on the absence of a known
  reference: every character that could reference another (`DefineSprite`, `DefineButton*`,
  `DefineShape1–4`, `DefineMorphShape`, `DefineText`, `DefineEditText`) must have been *fully* decoded by
  the model — a quarantined shape or morph, or an unparsed payload of a referencer kind, disables pruning for
  the whole movie and says so — because a payload this pass cannot read is a payload that may name anything.
  References the model *does* record cover placements, removals, button records and button/timeline sound
  ids, shape and morph fill/line bitmaps (including `FILL_CLIP`'s clip character, which the decoder stores as
  the same `bitmapId`), and text `fontId`; name-based addressing (`StartSound2`, `EditText` `fontClass`,
  `attachMovie`) resolves through `ExportAssets`, so exported characters are roots by construction.
  An action block is prunable only when it is statically unreachable — a basic block the front end flagged
  `unreachable`, or a block owned by a character this pass proves dead — never because a heuristic expected
  the frame not to play. Three consequences of reading the rule literally are recorded here because each one
  was found by writing the test rather than the code. (a) A payload that can name a character id the model does
  not record is an unparsed referencer for this purpose, which is why `DefineFont2`/`3` (bitmap glyph ids) and
  `DefineVideo4` (a deblocking bitmap) block pruning movie-wide while the flavours whose payload holds no
  character id at all — `DefineFont` v1, `DefineFont4`, bitmap, sound, `DefineBinaryData`, `imported`,
  `missing` — are explicitly allowed (errata `E-046`). (b) A reference the decoder could not resolve is not
  evidence of absence: a placement whose target the display list did not name, a text run with no readable
  `fontId`, and edit text naming no font by id or export name each count as incomplete, not as an empty
  reference set. (c) A `DoInitAction` tag sits at *movie level* but belongs to the sprite it initialises, so the
  owning character comes from the schedule's `spriteId` and never from the tag's `inSprite`, which is null;
  without that link an init action would outlive the sprite it was written into, and the group only it required
  would be emitted forever (`IMPL-050-R073`, errata `E-040`).
- **IMPL-120-R006** The shake pass MUST compute, per entry point, the union of the host-API requirement
  groups of every block that entry point can reach, and MUST emit only the runtime modules for the union of
  all entry points; `requirements` is the sole input (no re-scan of ops). Entry points are the
  scheduled blocks — frame scripts, init actions, clip-event and button handlers — plus the functions their
  call graph can reach, which until the call graph is resolved means *every* kept block in the movie:
  a per-entry-point union that dropped a group a `CallFunction` needed would be a runtime crash reported as
  a size win. The union MUST stay over-approximating in exactly one further place: a **T2** block requires
  every group, because its residual blob can call anything at runtime. Over-approximation from dynamic
  *operands* is `IMPL-050-R061`'s job, not this pass's — the group list is already widened there ("when a
  dynamic operand could reach a group, the group is required"), and re-widening it here would hide which of
  the two conservatisms is responsible (`T-CMP-013`). Where the IR's group vocabulary is wider than §8.1's
  table — `HostApiGroup` carries `timeline`, which the spec's "Movie objects" row covers without naming
  (errata `E-045`) — the pass MUST fold the unmapped group onto the row that owns the surface through a total
  map over the IR's values, and MUST report the fold as a decision. §8.1's list stays the only set of modules
  the emitter can ask for; a fold that is not reported is indistinguishable from a dropped module.
- **IMPL-120-R007** Tier verdicts MUST be merged with the call graph before emission: a T0 function that
  calls a T2 function stays T0 (it calls into the interpreter), and the *reason* strings of both functions
  MUST be carried on the merged verdict, so the emitter can explain a downgrade. No function's tier may be
  raised by a caller's verdict.
- **IMPL-120-R008** A symbol's base name MUST be resolved in `AVM1-R036`'s order — export name, then
  declared name, then the synthetic default `<kind><CharacterId>_<n>` — and the result MUST be legal as an
  ECMAScript identifier (see §3.1's sanitisation table). The table MUST be closed before emission.
- **IMPL-120-R009** Frame scripts MUST be grouped per frame in schedule order and emitted as
  `frame<N>(vm, target, frame)`-shaped functions (`IMPL-120-R017`); a block that is byte-for-byte the same
  code on two or more frames — and carries the same tier verdict and reasons (§3.1, `IMPL-120-R034`) — MUST
  be hoisted into one shared function that each frame calls, and MUST be reported as hoisted with the frame
  list it serves.
- **IMPL-120-R010** The asset planner MUST order encodes deterministically (by asset identity, never by
  concurrency-finish order), cap parallelism from the config, choose each asset's fallback ladder before
  encoding, and account every choice into `budgets.json` — with `IMPL-120-R028`/`R031`'s source-extent
  reading for video bytes.
- **IMPL-120-R033** A synthetic identifier MUST NOT embed a byte offset or any other source position.
  Offsets shift under editing, under a re-ordered dictionary, and under any change to an unrelated tag, so
  a name that contains one is unstable across runs and defeats `IMPL-120-R011` at its root: the sort order
  can be stable while the *name* is not. The default form is `<kind><CharacterId>_<n>` (R008), and
  `IMPL-050-R062` step 3 is read the same way — the base is `<kind>_<blockId>`, never a hex offset
  (recorded defect: errata `E-044`).
- **IMPL-120-R034** A hoist candidate MUST be identified by a projection that is position-independent but
  content-complete: offsets are rebased relative to the block start, never dropped, and a block carrying a
  T2 residual blob is never hoisted at all, because such a block is emitted as its own bytes and two blobs
  of equal extent can hold different code. `T-CMP-010` and `T-CMP-011` are the obligations, and they exist
  as a pair on purpose: a "same code, different position" test alone passes for a projection that throws
  the targets away, which would merge blocks that branch differently.

- **IMPL-120-R035** A post-model pass MUST take its inputs from stage artifacts, never from the live
  diagnostic sink. A signal a verdict depends on is computed in the stage that owns the data and carried on
  that stage's artifact — for the dead-code proof, `ModelArtifact.readInterruptions` — because a stage whose
  result is served from the cache re-runs nothing and therefore re-emits nothing into the sink: a pass reading
  the sink would see a clean slate on a warm build and make a decision the cold build refused to make. That is
  `CMP-R040`'s "a cache hit must not change output bytes" broken by an input that was never in the key, and it
  does not fail: it silently disagrees with itself. Reporting MAY still read the sink, since a report is not a
  verdict; the boundary is whether removing the input would change what the pass *does*.

### 3.1 Name assignment and frame-script grouping (as delivered by `WP-120-05`/`WP-120-06`)

The two passes live in `packages/compile/src/passes/{names,frames}.ts` and register as `namesPass()` and
`framesPass()` on the `runPipeline` spine, which places them after `tier-finalise`, `shake` and `dead-code`
(the latter two registered by `WP-120-03`/`WP-120-04`; `tier-finalise` still is not, and is reported as
unregistered). The position comes from `CMP` §2's stage order — passes
run between `analyze` and `plan` — and it is `IMPL-120-R001`'s purity rule that makes the position stable
rather than incidental: a pass that read the clock or the filesystem would have its output change with
*where* it sits. Five decisions the pass table left
open:

- **`CMP-D-CMP-N1`** — *the base name*: export name → declared name (the front end's recovered map) →
  synthetic `<kind><CharacterId>_<n>` (R008), **with the export name consulted here rather than inside the
  front-end pass**. `IMPL-050-R062` requires `WP-050-10`'s pass to run over "the IR plus the dictionary's
  export map" and it does not: `recoverNames` takes `exportMap` and discards it, `T-AVM1-FE-012` shuffles
  the candidate list with an *empty* map, and on the licensed corpus 0 of 20 exported character names appear
  among 149 recovered function names (`E-044`). Step (1) of `AVM1-R036` is therefore unimplemented at P5, so
  this pass resolves the whole three-step order itself; when P5's fix lands, the consulted name arrives
  through `recoveredName` instead and the result is identical.
- **`CMP-D-CMP-N2`** — *ownership*: the rule speaks of "the character or frame that owns the construct"
  without saying where that fact comes from, and `ActionIR` carries no owning-character field, so the pass
  derives it from `TagRef.inSprite` over `read.file.tags` — `null` is the timeline, a number is the owning
  `DefineSprite`'s character id — matching blocks to tags by byte range. A frame script inside a sprite is
  named for that sprite's id, not for the frame.
- **`CMP-D-CMP-N3`** — *sanitisation*: characters outside `[A-Za-z0-9_$]` (and a digit at the head) become
  `_`, runs of separators inside a name collapse, and leading or trailing separators are trimmed **only when
  they are not underscores**, so the legitimate `_root`-shaped names survive while `"1st prize"` →
  `_1st_prize`; an empty result falls back to the kind default; the reserved set `vm`, `target`, `frame`
  comes from `IMPL-120-R017`, which gives every frame script those three parameters. Collisions advance
  `_2`, `_3`, … over the sorted candidate list (R011), and a candidate whose name was taken as another
  symbol's **base** counts as a collision too — otherwise a name recovered from `ExportAssets` would be
  handed to a second symbol while the first still claims it, and two exports naming one function is common.
  Ordering is by source range first and owner second, exactly as R011 words it; the two disagree in
  practice, and `names.test.ts` pins a case where owner-first would assign the opposite names.
- **`CMP-D-CMP-N4`** — *the table is closed once*: `assignNames` throws when two candidates share a subject
  id rather than merging them, because merging would silently drop one symbol's name; the frames pass needs
  to add one entry per shared unit after grouping, which it does through `extendNameTable` — a re-run over
  the combined candidate list, never a second allocator — so `IMPL-120-R012`'s "closed before emission"
  property stays true and a shared unit's name still respects the reserved set.
- **`CMP-D-CMP-N5`** — *grouping*: only `timeline`-kind blocks enter a frame group, because R009's
  signature (`frame<N>`, no parameters) describes a timeline frame; clip-event, button and sprite-init
  blocks are reported as not grouped with that reason. A shared unit takes the name of the earliest frame it
  serves and the per-frame functions (`IMPL-120-R017`) still call into it, so the shared body is a genuine
  dedupe rather than a rename. Tier verdicts and their reasons are part of the identity, because
  "identical" has to mean "identical for the same reason", not "identical once the reason is discarded".

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
- **IMPL-120-R031** R028's *video bytes* are **source extents** at P6: the plan pass sums the
  `DefineVideoStream` header and the `VideoFrame` payload lengths supplied by `WP-110-12` (doc 110,
  P6-owned) and reports no re-encode delta. Whether a stream is alpha-paired — which doubles the emitted
  assets — is knowable only from packet headers, so at P6 it is a labelled worst-case estimate carried
  with an info-severity diagnostic that names it as an estimate; `WP-110-06` (P10) replaces the estimate
  with the measured figure. R028 is satisfied by the extent at P6 and by the alpha-resolved measurement
  from P10 onward, and `budgets.json` MUST record which of the two it holds.
- **IMPL-120-R032** Emitted code MUST NOT read `location`, or any URL/fragment-derived navigation state,
  to resolve a frame, scene, or named anchor. Navigation comes from the decoded `NamedAnchor` and scene
  data carried in the manifest, so frame addressing is identical whether the project is served from a
  path, a fragment, or a `file:` URL. `WP-120-12`'s forbidden-construct lint fails the build on a
  `location` read in emitted output. This receives the emitter half of doc 040's `T-MOD-030`, whose
  decode half P2 delivered and whose forward was previously recorded only in an archived audit.

### 7.1 Budget diagnostics

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0501` | warning | total transferred bytes over budget (per the AST-§4 table) |
| `SF0502` | info | atlas-page count over budget |

These are the codes the design spec `AST-§4` budget table cites; they live in the emitter range
because the report is produced by the plan pass (`budgets.json`).

## 8. Test obligations

| ID | Test | Level | Phase owner |
| --- | --- | --- | --- |
| `T-CMP-001` | name assignment stability across 100 shuffled dictionary orders | F1 | P6 |
| `T-CMP-002` | forbidden-construct lint over emitted output (one fixture per rule) | F1 | P6 |
| `T-CMP-003` | double build → `diff -r` is empty (incl. assets) | F1 | P6 |
| `T-CMP-004` | exit codes per failure class (5 fixtures) | F1 | P6 |
| `T-CMP-005` | cache equivalence: cold vs warm builds produce identical outputs | F1 | P6 |
| `T-CMP-006` | cancellation: SIGINT during an asset encode returns within 2 s, no partial files left | F1 | P6 |
| `T-CMP-007` | `verify --deep` detects an injected manifest↔TS drift, a missing asset, a tampered hash | F1 | P6 |
| `T-CMP-008` | `plan` output matches the real build's `budgets.json` within tolerance | F2 | P6 |
| `T-CMP-009` | emitted output for a fixture carrying `NamedAnchor` and scene data contains no `location` read (R032), and the forbidden-construct lint fails the build on an injected one | F1 | P6 |
| `T-CMP-010` | name assignment is a pure function of content and order: the serialised table is identical under 100 permutations of the `ExportAssets` dictionary **dealt into slots interleaved between the control tags**, so the claim cannot be satisfied by absolute offsets that happen not to move — the test asserts those offsets take several distinct tuples — plus the sanitisation table, the base-claim and `_2`/`_3` collisions, and `IMPL-120-R033`'s ban on offset-bearing names | F1 | P6 |
| `T-CMP-012` | dead-code pass: with `--prune-dead-code` off nothing is removed and every candidate is reported with its proof; with it on, a quarantined shape or an unparsed referencer payload disables pruning for the whole movie rather than proceeding partially, and a block is called unreachable only on the front end's own flag | F1 | P6 |
| `T-CMP-013` | shake: the emitted group set equals the union over every block that survives pruning, an entry point's own union is reported beside it, a T2 block forces the full set, and no group is dropped while any kept block names it | F1 | P6 |
| `T-CMP-011` | hoisting is sound: blocks differing only in position canonicalise equal, blocks differing only in a rebased jump or branch target do not (`IMPL-120-R034`), a T2 block is never hoisted, and every ungrouped or unhoisted block carries a reason | F1 | P6 |

## 9. Work packages

| WP | Title | Depends | Est | Deliverable |
| --- | --- | --- | --- | --- |
| WP-120-01 | Pipeline runner: stages, context, cancellation | WP-020-10 | 4 | `packages/compile/src/pipeline.ts` |
| WP-120-02 | Cache: content-keyed stage cache + `--verify-cache` | WP-120-01 | 5 | `codec.ts`, `cache.ts`, cacheable `analyze`; T-CMP-005 — **Done**, evidence in §2.2 |
| WP-120-03 | Dead-code pass + reporting | WP-120-01, WP-050-08 | 3 | `passes/dead-code.ts`, §3 `R005` — **Done**, `T-CMP-012` wired; a payload the model cannot read disables pruning movie-wide (`E-046`), and the inputs come from stage artifacts (`R035`) |
| WP-120-04 | Requirement tree-shaking + module grouping | WP-120-01, WP-050-09 | 3 | `passes/shake.ts`, §3 `R006` — **Done**, `T-CMP-013` wired; the 14th IR group is folded onto the §8.1 row that owns it and reported (`E-045`) |
| WP-120-05 | Name assignment pass | WP-120-01, WP-050-10 | 2 | `passes/names.ts`, §3.1 — **Done**, T-CMP-001/010 wired; the P5-side obligations stay open under `E-044` |
| WP-120-06 | Frame-script grouping/hoisting | WP-120-01, WP-030-09 | 3 | `passes/frames.ts`, §3.1 — **Done**, T-CMP-011 wired |
| WP-120-07 | Asset planner + encoding scheduler | WP-070-07, WP-080-10, WP-090-10, WP-110-12 | 4 | `passes/assets.ts` |
| WP-120-08 | Emitter: symbols, frames, classes, buttons | WP-120-05 | 6 | `emit/*.ts` |
| WP-120-09 | Emitter: residual blobs + entry descriptors | WP-120-08, WP-050-08 | 2 | `emit/residual.ts` |
| WP-120-10 | Manifest emission (TS + JSON) + drift check | WP-120-08 | 3 | T-CMP-007 |
| WP-120-11 | Reports: build-info, porting-notes, divergence | WP-120-10 | 3 | report writers |
| WP-120-12 | `verify` implementation + forbidden-construct lint | WP-120-10 | 4 | T-CMP-002/007/009 |
| WP-120-13 | CLI: build/plan/inspect/verify/report + exit codes | WP-120-12 | 4 | `packages/cli`, T-CMP-004 |
| WP-120-14 | Determinism hardening + double-build CI job | WP-120-13 | 2 | T-CMP-003 |
| | **Total** | | **48** | |

## 10. Done criteria

1. `swfforge build` on **the reference title** — the single title named in
   [`docs/impl/registers/corpus.md`](../registers/corpus.md), which records its provenance and
   licence — produces a project that type-checks, passes `verify`, and rebuilds
   byte-identically.
2. Every CLI command works on a partial/failing input without crashing, with the documented exit code.
3. Cache warm/cold equivalence holds over **the whole corpus**, bounded the same way `T-SWF-009`'s
   "every fixture" is (roadmap §4.2, [`registers/corpus.md`](../registers/corpus.md)): every
   committed `.swf`, the fuzz crasher corpus, the enumerated deterministic synthetic set, and
   the reference title. It is not the open-title corpus, which is P11's programme.
4. Every emitted symbol is either referenced or listed; no orphaned code paths in the manifest.
5. `porting-notes.json` names every diagnostic, every `[verify]` item, and every gate and its state.

## 11. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Full pipeline/emitter/CLI specification derived from CMP/REPO/MS design specs |
| 1.1 | 2026-10-04 | §7.1 added: budget diagnostics `SF0501`/`SF0502` in the emitter range, matching the design spec's budget table (which previously cited font codes `SF0230`/`SF0231`); errata `E-016` |
| 1.2 | 2026-10-04 | Citation fix: `REPO-D09` -> `REPO-D06`, a decision that now exists (`specs/010` §11; errata `E-024`) |
| 1.3 | 2026-10-13 | Roadmap §4.6 items B, C, D applied. `IMPL-120-R031` gives R028's video bytes a P6-scoped reading (source extents from the re-homed `WP-110-12`; alpha pairing a labelled estimate until P10's `WP-110-06`), and `WP-120-07` now depends on `WP-110-12` instead of P10's packet-header validation, which removes the P6 → P10 inversion. `IMPL-120-R032` receives the emitter half of doc 040's `T-MOD-030` — emitted code must not read `location` — with `T-CMP-009` as its obligation on `WP-120-12`'s forbidden-construct lint. §10 criteria 1 and 3 now name their subjects: the reference title and the bounded in-repo corpus both live in `docs/impl/registers/corpus.md` |
| 1.4 | 2026-10-14 | P6 started: `WP-120-01` delivered as `@swf-forge/compile` (`packages/compile/src/pipeline.ts`, `cancel.ts`, `config.ts`, `stages/*`). §2 gains the stage-spine mapping between this doc's seven stage names and `CMP` §2's S0–S10 (`read` = S0+S1, `decode` = S3+S4, `analyze` = S5+S6, `report` = S9, S10 `verify` is a command and not a stage), and states that the five §3 passes run on their own spine between `analyze` and `plan`. New §2.1 registers `SF0500` (info: a stage has no implementation in this build), the first code in the `SF05xx` compile range, added to the `IMPL-010` §7 registry |
| 1.5 | 2026-10-14 | `WP-120-02` delivered (`packages/compile/src/cache.ts`, `codec.ts`; `pipeline.ts`'s cache path), wiring `T-CMP-005` in `packages/compile/test/cache.test.ts`. New §2.2 records the entry format and the rules a reader needs to apply them (effects outside the key, stage options inside the input hash, corrupt-entry-is-a-miss, structural serialisation) and states that `--verify-cache` cannot prove the codec lossless while cold-vs-warm output equivalence can. `SF0503` (warning: a cached output did not match its recomputation) joins §2.1; `analyze` becomes the first cacheable real stage |
| 1.6 | 2026-10-14 | `WP-120-05` (name assignment) and `WP-120-06` (frame-script grouping and hoisting) delivered as pass objects on the runner spine, with §3.1 recording the five decisions the pass table left open. Two new rules: `IMPL-120-R033` (a synthetic name never embeds a source position) and `IMPL-120-R034` (a hoist candidate is position-independent but content-complete, and a T2 block is never hoisted), with obligations `T-CMP-010`/`T-CMP-011`. `T-CMP-001`'s dictionary permutation is what makes the first one measurable, and it is a test P5's `T-AVM1-FE-012` cannot be: shuffling a candidate array with an empty export map never moves a byte offset. The `WP-120-02` row here is corrected to 5 days with its deliverables, matching the roadmap. |
| 1.7 | 2026-10-14 | `WP-120-03` (dead-code pass) and `WP-120-04` (requirement shake) delivered as pass objects on the spine, with `packages/compile/src/passes/{dead-code,shake}.ts` and 33 tests over real decoded fixtures. `R005` grows three clauses the fixtures forced — model blind spots count as unparsed referencers (`E-046`), an unresolvable reference is never an absence of references, and a `DoInitAction` block's owner is its schedule entry's sprite, not the tag's `inSprite` — and `R006` gains the fold rule for `timeline`, the group 040's §8.1 table cannot name (`E-045`). One new rule: `IMPL-120-R035` (a pass reads stage artifacts, never the live diagnostic sink — a warm build would otherwise prune what a cold one refused), which is the shape `ModelArtifact.readInterruptions` exists to give. `T-CMP-012`/`T-CMP-013` are wired to the two test files. |
