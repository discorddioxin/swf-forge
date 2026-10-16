# IMPL-120 — Compiler Pipeline, Emitter, and Build Output

**Doc ID:** IMPL-120 · **Status:** ready (design-spec-driven; no format chapters needed) · **Packages:** `@swf-forge/compile`, `@swf-forge/cli`
**Format spec:** none (consumes the model produced by IMPL-010…IMPL-110)
**Design specs:** CMP (whole), REPO-§4–§6, AVM1-§6/§7 (emitted shape), GFX-§5/§14, AST-§7, RT-§3
(app shell), SEC-§3 (CSP and hardening), CMP-§8 (CLI surface)

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
| `SF0507` | warning | the manifest was written, but without the `AST` §6 sections whose inputs this phase does not have (`WP-120-07`'s asset planner): the report names the sections, because an omitted key says something different from an empty map |
| `SF0508` | error | no manifest was written at all, because a value it would have carried has no JSON spelling — a non-finite number, which `JSON.stringify` would have turned into `null` and a reader would have taken for a missing asset rather than a broken build |
| `SF0509` | warning | a report input the build was not given — the pin register, the `[verify]` items, the fidelity tier, or the divergence declarations — so the report states the gap instead of a value (`WP-120-11`) |
| `SF0510` | error | a divergence declaration did not validate against `CMP` §4.9, so the harness was not told to expect the divergence it describes and the entry was dropped |
| `SF0511` | error | a report document would have carried build-host identity — an absolute path, a host name, or a wall-clock timestamp — so no report file was written; the prohibition is `IMPL-120-R021`'s |
| `SF0505` | warning | a residual entry descriptor did not validate against its own blob (a slice outside it, or a front-end `residual` list that disagrees with the CFG), so no blob was written and the block stays deferred with the reason in its decision row. A rejected descriptor is a front-end bug, and this is where it surfaces rather than at load time (`IMPL-130-R025`) |
| `SF0506` | error | `--vm.residual=forbid` and the movie has a tier-2 function: no blob is written, so the build fails and every such function is listed with its original byte count and its tier reason (`IMPL-050-R060`, `CMP-R026`) |
| `SF0504` | warning | an artifact the run asked for on the emitted side was not written. So far only `--sourcemap`: `CMP-R014` defaults to writing maps, but `ActionIR` records byte ranges per action block and not per statement, so statement-level mappings would attribute lines to offsets they did not come from (`E-047`). The report names the artifact and the reason; a build that treats warnings as failures fails |

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
      <block>.bytecode.ts  blob + interpreter entry descriptor, per block the emitter cannot lower
    assets/
      index.ts             asset registry (typed)
  assets/                  ktx2/png/webp/ogg/mp4/... (content-hashed filenames)
  tsconfig.json            strictness the emitted code is compiled under (R014; generated)
  eslint.config.mjs        the ban list as errors (R015; generated, never template-copied)
  package.json             runtime dependency pins and the build/lint scripts (generated)
  forge.manifest.json      full manifest (runtime + tooling)
  build-info.json          tool versions, chapter-pin status, gate states, budgets
  porting-notes.json       every diagnostic, decision, and [verify] item
  divergence.json          expected-divergence declarations for the harness
  forge.config.json          the resolved config minus this version's defaults (CMP-R004; written by
                             the CLI and never read back as input -- see §6.1)
  reports/
    porting-notes.md         the human projection of porting-notes.json (CMP §4.9, ARCH-R003's tier claim)
```

### 4.1 The surface emitted code may name

Nothing under `src/` may reference a runtime identifier that a spec section has not published, and the
enforcement is structural rather than a lint: `emit/surface.ts` holds the one list — the types and values
imported from the runtime contract module, the `avm1.*` helper names, and the members the contract's
`Clip`/`Scope`/`Vm` types must expose — and every entry cites the rule that requires it (`AVM1-R032`'s
explicit forms, `R033`'s registers, `R034`'s target scope, `IMPL-050`'s coercion rules) or marks itself a
proposal awaiting the runtime's review. The reviewers are named rather than implied: `WP-130-12`'s interpreter is
what calls an `avm1.*` helper and `WP-130-01`'s object model is what makes a `Clip`/`Scope`/`Vm` member exist, so
a proposal is ratified by P7 adopting it and by nothing P6 can do — the emitter ships the entry as a proposal,
with the review recorded as open, rather than widening the list silently. A helper the emitter needs and no rule
names is therefore visible as a proposal in one file, instead of inlined as AVM1 semantics across a hundred
generated ones.

`emit/files.ts` derives each module's import list from that module's own rendered body. A template import list
is wrong for every module except the one it was written for, and an unused import is a build error under the
`noUnusedLocals` the emitted project ships with, so deriving the list is the only spelling that compiles. Two
tests hold the line: emitted output names nothing off the list, and every import in an emitted module is
referenced by that module.

The frame-script signature is the one place the specs disagree with each other, and the emitter resolves it in
favour of `IMPL-120-R017`: `(vm: Vm, target: Clip, frame: FrameCtx)`, with `AVM1-R035`'s four inputs reached
through that single parameter set — `frame.scope`, `frame.root`, `frame.global`, and `target` as the script's
own object. A signature taking the scope, the root and `_global` beside `vm` duplicates state the runtime
already owns and lets a caller hand a script a root from another movie, which is the class of bug a generated
project should be unable to express. `CMP-R018`'s worked example carries the other signature, a different
path, and `Clip` imported from `@swf-forge/avm1`; that conflict is `E-048` rather than a silent divergence, and
the file the example shows is not the file this document's tree names.

### 4.2 What the residual path emits

`IMPL-120-R018` fixes the shape — the block's original bytes plus a descriptor carrying its parameters,
registers, preloads and constants — and leaves the file layout, the routing table and the policy semantics to
this document. `emit/residual.ts` writes one module per blob at `src/residual/<block>.bytecode.ts`: a
`Uint8Array` literal of the bytes as they sit in the decompressed tag stream, and an `entry` object. Nothing
re-encodes an opcode — `IMPL-050-R068` forbids that for reserved and undefined codes, and copying is the only
spelling that cannot invent a byte — and the slices the interpreter enters are the block-relative ones
`IMPL-050-R057` already computes, which is why there is no rebasing step between a blob and its descriptor.

Two checks run before a blob is written: every slice must lie inside the blob, and the front end's own
`residual` list must agree with the slices recomputed from the CFG. A disagreement is `SF0505` and the block
stays in the deferred set with the reason in its decision row, because emitting a descriptor the runtime would
reject at load (`IMPL-130-R025`) moves a front-end bug into the player, where it reads as a black screen.

Routing is a second table in the same timeline module, `residualEntries`: one row per trigger, keyed
`frame:<n>` or `init`, naming the entries the interpreter runs in schedule order. A frame whose blocks all lower
keeps its `frameScripts` row; a frame with any residual block moves whole, because the runtime gives a frame one
entry point and a frame split between a call and a blob would need the emitted side to reach into the
interpreter — a dependency `CMP-R027` makes visible to bundlers. So a residual module imports `Entry` from the
contract and nothing else, and a movie with no residual row leaves the interpreter droppable. A sprite's own
frame scripts are routed by the frames the front end records as referencing each block, and a frame association
list that is empty gives the block no row: an exported function nobody calls is a smaller lie than a table that
guesses when it runs. A clip-event handler on a placement still has no table, so its block is refused rather
than given an unreferenced blob; that seam belongs to `WP-120-10` with the runtime's own entry API.

`vm.residual` has three answers and the emitter is one of its two consumers (the tier-finalise pass is the
other). `on-demand` writes a blob for a block a table can route — a blob nobody references executes nothing, so
it would be output the build cannot defend. `always` writes one for every block, which is what makes
`T-RT-101`'s claim of identical observable state on both paths measurable inside one build instead of across
two configurations. `forbid` writes none and turns each tier-2 function into an error naming its size and reason.
The byte count and reason also travel in `state.emit.residual`, so the report stage can render the `reports/`
half of `CMP-R026` without re-deriving anything (`IMPL-120-R035`).

Three things are deliberately absent. `IMPL-050-R068` permits caching blobs by content hash, which in a build
that writes nothing is a per-run win only, so it waits for `WP-120-13`'s disk. The mixed frame form — lowered
calls and interpreted blobs in one frame — needs the interpreter's entry API, `WP-120-10`'s. And the
descriptor's field names are the emitter's proposal: `Entry` is in §4.1's surface list marked as awaiting the
contract review that ratifies or renames it. Every boolean in a descriptor is written out, `false` included,
because a field the runtime defaults is a field the two execution paths can disagree about; the drop-nulls
convention that keeps the placement rows short does not cross into descriptors for that reason.

### 4.3 The manifest pair

`IMPL-120-R019` asks for the manifest twice — a typed `src/manifest.ts` for the runtime and `forge.manifest.json`
for tooling — from one in-memory object, with `verify` diffing them. `emit/manifest.ts` therefore serializes
**once** and splices the same text into both files, which is the only construction in which the rule's "same
object" cannot rot: a future field added on one side appears on the other in the same commit or the pair's test
fails. The drift check (`diffManifestTexts`) parses both payloads and compares them structurally, so a formatter
that re-indents one file is not drift and a value that changed is reported as a path (`$.movie.frameCount: 1 in
the TS manifest, 240 in the JSON`) — the shape `-12`'s `verify --deep` needs, since that command reports to a
human who has to know which file to look at.

Three formatting decisions come from who reads the files. The JSON artifact carries **no generated header**: `CMP`
§5's app-shell example imports it with a `type: 'json'` attribute, so a `//` line is a parse error, and its
provenance lives in `tool` instead; `tsconfig.json` is the only JSON-family artifact allowed to keep the header,
because `tsc` reads its own config as JSONC; and `package.json`, which npm parses strictly, now states its
provenance in a `"//"` field rather than a comment (`emit/scaffold.ts`, found while writing this pair — the
emitter had been heading its JSON artifacts the way it heads sources, which is valid for exactly one of them).
Keys are sorted at every depth by the emitter's own serializer rather than by `JSON.stringify`'s
insertion-order behaviour (`AST-R043`, `REPO-R016`), and the serializer refuses a value it cannot write: a
non-finite number would reach JSON as `null`, so `SF0508` refuses the artifact instead, while `-0` is written as
`0` because JSON has no negative zero — the opposite of `REPO-R015`'s rule for emitted *source*, where `-0` is a
value the movie stored. `stage.frameRate` reaches the manifest divided by 256, since the model keeps the header's
raw FIXED8 and `AST` §6's example value is frames per second; the division is exact because 256 is a power of two,
and rounding to two decimals would silently retime the movie.

The manifest states only what this phase can prove: `$schema`, `schemaVersion`, `tool` (with the **emit stage's**
config hash, because the manifest describes the emitted project), and `movie`. The asset sections — `textures`,
`atlases`, `gradients`, `fonts`, `sounds`, `videos`, `binary`, `streams`, `budgets` — are **absent**, not empty,
and `SF0507` names them: an empty `textures` map is a claim that the movie has no textures, which is exactly the
kind of statement a runtime caches. `movie.scaleMode` and `movie.align` are absent for a different reason — no
input carries them (`E-050`) — and `movie.metadata` follows `AST` §6's "if any". `checkManifestAssets` implements
`CMP` §4.7's two verification rows as a pure function over the manifest and a file list, so `WP-120-12`'s command
reads a directory and calls it rather than re-deriving the rules; a reference is verified where the manifest
states `bytes` or `sha256` beside it and merely counted where it does not, which is what keeps a font-atlas entry
from reading as a passed hash check. `T-CMP-007` is wired at that library boundary: the drift, missing-asset and
tampered-hash cases are proven here, and the `verify --deep` *command*, its exit code and its disk walk stay with
`WP-120-12`.

### 4.4 The report files

`IMPL-120-R021`'s `build-info.json`, §4's `porting-notes.json` and `divergence.json`, and `CMP` §4.9's
`reports/porting-notes.md` are one stage — `stages/report.ts` — and one projection of data the run already had. Four
rules decide its shape, and each is a place where the obvious implementation is wrong.

**Rows come from stage artifacts, not from the live sink.** A cached stage restores its outcome and does not replay
its diagnostics, so a report reading `ctx.diagnostics` would print a different file for a warm build than for a cold
one — and `T-CMP-003`'s proof is `diff -r` over the whole output directory, so the report would fail the determinism
gate for a reason nobody could see in the compiler. Every row is derived from an artifact
(`ModelArtifact.readInterruptions`, the emit plan's invalid descriptors and manifest refusal), and where a message is
needed it is the code registry's `meaning`, which reads the same on both paths. `porting-notes.json` carries a
`diagnosticsScope` line saying as much: the rule leaves out the diagnostics only the sink carried, and `E-051` asks
the sink to record which stage spoke so the list can become exhaustive. Each row also names its own origin, because
the model stage's attribution is by offset span while a container-level diagnostic carries an offset in the *input
file* — so a row can be an attribution rather than a claim the reader made, and the file does not pretend otherwise.

**A gate list is obtained by walking the config, not by naming gates.** `R021` asks for "the state of every gate
flag", and any enumeration of keys is a list that goes stale the day a config field is added. `gatesOf` flattens every
scalar leaf of `ForgeConfig` and `RunSwitches` into dotted keys, and the emit stage echoes the two source-map answers
it owns (`CMP-R014` asks for a file this phase refuses, which `SF0504` says in prose and the gate map says in data).
A test asserts the flattened set equals an independent walk of the config object, so completeness is what is proven
rather than assumed.

**Withheld, not zero-filled** — §4.3's rule for the manifest, applied to the four inputs a stage may not go and
fetch: the pin register, the `[verify]` items `T-TST-003` requires, `ARCH-R003`'s tier claim, and the project's
divergence declarations. Each absence is one `SF0509` naming what is missing, and the artifact itself carries
`{ "state": "withheld", "what": …, "reason": … }` so a reader of the file alone learns the same thing. The budgets are
that story split in two: `IMPL-120-R028`'s residual-bytecode line is known and stated, and the other five lines are
withheld until `WP-120-07` computes them.

**`R021`'s MUST NOT is a check, not a hope.** `findHostLeaks` scans each composed document for an absolute path, an
ISO-8601 or epoch timestamp, and — when the caller passes one — the build host's name; a hit suppresses *every*
report file with `SF0511` rather than shipping the ones that happened to be clean, because the three are read
together and a partial set is what gets mistaken for "the build had nothing to say". The run itself still completes:
the defect is in what the build tried to publish, and the porter needs to know which document to fix.

Two further gaps are recorded instead of guessed at, both of them the `E-050` pattern repeating. `R021` names a
`--video-native` gate that exists in no config, so the flattened list states the gates that are real and the missing
one is `E-051`'s business; and §4 puts the notes at the root as `.json` while `CMP` §4.9 and `ARCH-R003` put them in
`reports/` as `.md`, so this phase writes both — the JSON for `INS-R022`'s panel and the harness, and the markdown as
a projection of the same object, which is `IMPL-120-R025`'s `--json` rule applied to a file and the reason the human
document cannot contradict the machine one. `divergence.json` carries only what the project declared: it is the
harness's *expectation*, and a compiler manufacturing entries from its own refusals would be setting its own
tolerance, which is what the decision register exists to prevent. `CMP` §4.10's completeness row is exposed as
`divergenceCitations` and `checkDivergenceCompleteness`, pure functions for `WP-120-12`'s `verify`, in the shape
`checkManifestAssets` set for the manifest.

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

### 4.5 `verify`, over a project rather than a build

`IMPL-120-R024` names six things `verify` MUST check. `CMP` §4.10 gives seven rows and calls it a command that
"parses the emitted project (not just the SWF)". §2 placed S10 outside the spine, and that placement fixes four
properties of `src/verify.ts` that are easy to lose under time pressure.

**It is a function over files, not a walk of a directory.** `verifyProject({files, deep?, previous?,
unreferencedAllowed?})` takes `{path, text|bytes, sha256?}` records and returns `{findings, notRun, ran, files,
deep, clean}`; `WP-120-13`'s CLI owns the disk, the report format and the mapping onto `R026`'s exit codes. The
split is what makes `T-CMP-007` testable at all — putting a lie into one half of a manifest pair is an edit to a
`Record<string, string>`, not a temp tree — and it keeps §2's promise: the same function can check output this
process never wrote, including output a person edited afterwards, which is the only case where drift exists.

**It reports findings, not diagnostics.** A `Diagnostic` is addressed to a build: an offset in the input, a
character id, a code with a registry severity. `verify` normally runs with no build in progress — often against a
directory whose build finished yesterday — so a finding is `{check, severity, path, detail, line?, rule}`: a
location in the emitted project and the rule that failed, so a porter reading `IMPL-120-R032` in the file they are
told about knows what to change. No new §2.1 code joins this work package, deliberately: a registry entry would
imply a message the pipeline prints, and there is no pipeline. An `error` finding is what the CLI folds into exit 2;
warnings and the `notRun` rows are output, not failure.

**Four checks run here, and the ones that cannot are named.** `R024`'s clauses, with what a P6 build can actually
verify:

| The clause, in this build |
| --- | --- |
| manifest↔TS drift | `check: 'manifest'`, over `src/manifest.ts` and `forge.manifest.json`, one error per differing path; a pair with a **missing half** is an error in either direction |
| every referenced asset exists and matches its recorded hash | `check: 'assets'`, §4.3's `checkManifestAssets` over the assets the caller supplied; a hash the manifest states for a file whose content was not handed over is a **mismatch, not a pass** |
| every emitted symbol referenced at least once, or listed | `check: 'symbols'`: an error when a relative import names no emitted module, or names one that does not export it; a warning for an export nothing imports, silenced by the project's own list |
| no forbidden constructs | `check: 'bans'`, below — the matchers over `src/**`, and the emitted config asserted to still carry each entry |
| the double-build determinism check in `--deep` mode | `check: 'determinism'`, only when a previous build was supplied; otherwise a `notRun` row, because comparing one build with itself measures nothing |
| every T2 blob decodes under the interpreter's validator | `notRun`, owner `WP-130-12`: `@swf-forge/avm1` publishes `validateRegister`, an operand helper, so there is no callable validator to hand a blob to |
| budgets, and the project compiling under `tsc --strict` | `notRun`, owners `WP-120-07` and `WP-120-13`: a P6 build writes no `budgets.json` (the same missing input as §4.3's `SF0507`), and running a compiler here would hide its diagnostics behind a finding |
| `CMP` §4.10's divergence completeness row | `check: 'divergence'`, warnings, over the emitted project's own `PORTING-DIVERGENCE.md` and the citations §4.4 counts |

**The ban list is one policy with two renderers, so it has one home.** `R016`'s sentence — "a lint rule in the
emitted project *and* a check in `verify`" — is the whole design problem: two encodings of one list drift, and the
drift is invisible in exactly the case that matters. `emit/bans.ts` now holds `EMITTED_BANS`, where each entry
carries the ESLint rule, the **marker text** the generated `eslint.config.mjs` must contain, and the matcher `verify`
runs; `test/emit.test.ts` asserts every marker appears in the scaffolded config and `test/verify.test.ts` asserts
every matcher fires on its fixture, so an entry wired on one side only fails. Writing the list down exposed three
gaps in the config `WP-120-08` had been generating: `CMP` §4.10 requires `document.write` and `innerHTML` to be
checked and neither had a rule, and `location` had a `no-restricted-globals` entry with no matcher behind it — the
ban `R032` and `T-CMP-009` depend on was decoration. All three are entries now.

**Matchers run on code, not on text.** `codeOnly` blanks comments and string/template contents while preserving every
offset, which fixes two problems a regex over source has at once. A naive comment-strip reads `const u = "//";
eval(code);` as a comment and passes the call — a bypass anyone can type — and a naive string-strip lets a movie's own
text trip a ban, since `pushString("rating: any")` is the movie's content and not the build's code. Blanking rather
than deleting keeps a finding's column honest, because a porter jumps to it. When the scanner cannot finish — an
unterminated quote, a stray backtick, a mis-read regex literal — it hands back the **original text**: for a security
ban a false positive is a reworded comment and a false negative is what gets shipped.

**The symbol clause reads a re-export as a use, and the project declares its own public surface.**
`export { play } from './playback/hero.js'` is how the emitter publishes something the app shell imports, so it
counts as a reference *and* as an export of the module that writes it. And `src/manifest.ts`'s `manifest` is
exported for the host and imported by nothing inside the project, which `R024` permits by "or listed as
intentionally unreferenced" — so `emit/files.ts` declares `EMITTED_PUBLIC_EXPORTS`, owned by the module that knows
which files face outward, and `unreferencedAllowed` extends it. A check that warns on every build about a symbol
whose entire purpose is to be imported from outside is a check that gets switched off within a release.

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

Delivered in `packages/cli` as `@swf-forge/cli`, with one bin, `swfforge`. The parser is one table
(`src/args.ts`) that states, for every flag, where it lands: a `ForgeConfig` path, a `RunSwitches` key, a
stage option, or nowhere with a printed reason. `--help` renders that table, so the manual and the parser
cannot disagree.

```
swfforge build <input.swf> [--out <dir>] [--config <file|->] [CMP §8 flags] [--dry-run] [--report-only]
swfforge inspect <input.swf>… [--tags|--symbols|--timeline|--actions|--shapes|--images|--fonts|--sounds|--video] [--strict]
swfforge plan <input.swf>                      # the run above with --dry-run: budgets, decisions, no writes
swfforge verify <out-dir> [--deep [--against <dir>]]
swfforge report <out-dir> [--budgets|--divergence]
```

All five verbs take `--json`, `--verbose`, `--quiet`, `--help` and `--version`; `CMP` §8's dotted flags are
accepted with their spec spelling. Two equivalences are deliberate. `build --dry-run` *is* `plan`: one code
path prints both, because the design doc describes one capability in two places and two printings of the same
run drift. And `inspect` is a printer over the same pipeline a build runs (in dry-run mode), not a second
reader, so it cannot report a different file from the one `build` compiled.

- **IMPL-120-R025** Every command MUST honour `--json` with a stable schema and plain-text output MUST be the
  human-readable projection of the same data. The envelope is `{command, exit, schemaVersion: 1, tool, …}`
  rendered through the emitter's canonical JSON writer (sorted keys, no timestamps), and every command builds
  `{data, text}` row pairs so the two halves are projections of one set of rows. `REPO-§7` is the doc's
  pointer for the schema version and is a testing section; the version lives in the CLI until a spec owns it
  (`E-053`).
- **IMPL-120-R026** Exit codes follow `CMP-R029`, which is the table `apps/decompiler` already implements:
  `0` success; `1` an `error` diagnostic, a failed stage, or a cancelled run; `2` input unreadable or not a
  SWF, a config that does not parse, and a usage error; `3` AVM2 content (`SF1000`); `4` a threshold exceeded
  (`--max-warnings` and `--fail-on`, both counted in warning *occurrences* — §7 — and budgets under `--budget-strict`, which P6 has none of); `5` an internal error. Codes are part of
  the CLI contract (`T-CMP-004`). The precedence the table does not state is stated in `src/exit.ts`: internal
  first, then unreadable input, then the AVM2 refusal, then errors, then thresholds — a crash explains why
  nothing else could be measured, and a warning threshold explains nothing about a broken build. `E-053`
  records that this rule's earlier numbers (1 "our bug", 4 "external tool missing", 5 "budget exceeded")
  contradicted `CMP-R029` and that `swfforge` follows the design spec.
- **IMPL-120-R027** `inspect` MUST work on inputs whose later stages would fail (e.g. an AVM2 file: tag
  listing still works, then the error is reported) so it is usable as the first diagnostic tool. It runs
  read/model/analyse in dry-run mode, prints the header and whichever views were asked for, and reports the
  verdict after them — so a refused file still shows its tag table, and a view that needs the unregistered
  `decode` stage says so instead of printing an empty table.

### 6.1 What the CLI owns, and what P6 leaves it unable to honour

The CLI is the only package that touches the disk (`REPO-R004`), so four decisions that are not visible in any
stage are made here:

- **A clean run is the only run that writes.** `refused`, `failed`, and any run carrying an `error` diagnostic
  leave the output directory untouched — including not creating it. `CMP` §5's recovery ladder is about a
  movie with problems; bytes that `SF0001` calls "not a SWF" still produce twelve well-formed files about an
  empty movie, and a project directory is what a build script then trusts.
- **The config file is read from the working directory only.** `CMP-R004` has the build *write*
  `forge.config.json` into the output, so a reader that looked in `--out` would let a previous build's pruned
  config become this build's file layer, under the flags the user just typed. `--config -` means "read none".
- **The stage cache is at `<cwd>/.forge/cache`, never inside `--out`.** `CMP` §12 puts it in the project, which
  is right for a project; for a tool pointed at any input, a cache in the output directory would make two builds
  into two different directory listings, and `verify --deep`'s determinism comparison is a byte comparison over
  exactly those directories.
- **Writes are sorted, temp-named, and rolled back.** `REPO-R016`'s order and `IMPL-120-R023`'s atomicity are
  properties of this module alone; a cancelled or failed write removes the files and directories the call
  created, so `T-CMP-006`'s "no partial files left" is a rule rather than a hope.

Five flags in `CMP` §8's table have nothing to act on in this phase, and each is accepted, reported as inert
with a reason, and named here: `--jobs` (no parallel encode before `WP-120-07`), `--fail-on=risk` (the
diagnostic registry has three severities), `--sourcemap` (consumed as an emit-stage option; `E-047`), and
`--budget-strict` (recorded in the report's gate map; what it will gate is §7's decision). The report stage's four
withheld inputs — `pins`, `verifyItems`, `tier`, `divergences` — have no flag and no config field, which is
exactly why `SF0509` reports them as gaps; `E-053` asks the owners for either.

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

**What the phase's last package decided about budgets, and what it left to `WP-120-07`.** `R028` names six
quantities and `R029` says `--budget-strict` turns an overrun into a failure; in P6 exactly one of the six is
computable. `build-info.json`'s `budgetSummary` carries `residualBytecodeBytes` — the emitter knows the size of
every blob it wrote — and lists `audioBytes`, `bundleBytesByModuleGroup`, `firstFrameWork`, `textureBytes` and
`videoBytes` under `withheld`, with the owner named in the same object, so a reader of the file alone learns
which numbers are missing and who produces them. Three consequences follow, and all three are the shipped
behaviour rather than an intention:

- `--budget-strict` is **accepted, recorded in the gate map, and inert**. A flag that can never be satisfied is
  worse than a flag that says so, and `SF0501`/`SF0502` stay withheld rather than being aimed at a number nothing
  computes. `R030`'s top-contributor list travels with the budget it explains, so it is withheld too — the exit-4
  verdict for the budget P6 *does* have states the contributor instead: the code, its row count and its
  occurrence count.
- The live threshold is `--max-warnings`, and it is measured in **occurrences**, not in rows. The sink folds a
  repeated diagnostic into one row with a `count`, so a row-count budget would call a 52-byte fuzz input that
  warned 92,680 times "6 warning(s), within budget" — which is what it did until the corpus lane met it
  (`E-055`). `crash-005-shape-edge-past-limit.swf` now exits 4 on a default build, and it is the only file in
  the corpus that does.
- `T-CMP-008` (`plan` matches `budgets.json` within tolerance) stays **unwired**, owned by `WP-120-07` along with
  the table it compares against, and `R031`'s video extents stay behind `WP-110-06`. A test id invented to grade
  an artifact that does not exist yet is worth more left scheduled than satisfied by a stub.

## 8. Test obligations

| ID | Test | Level | Phase owner |
| --- | --- | --- | --- |
| `T-CMP-001` | name assignment stability across 100 shuffled dictionary orders | F1 | P6 |
| `T-CMP-002` | forbidden-construct lint over emitted output (one fixture per rule) — wired in `packages/compile/test/verify.test.ts`, which pairs each `EMITTED_BANS` entry with a snippet and asserts the pairing is exhaustive in both directions, so a ban cannot be added to the prose without a fixture nor to the config without a matcher | F1 | P6 |
| `T-CMP-003` | double build → `diff -r` is empty (incl. assets) — wired in `packages/cli/test/corpus.test.ts`, which compares three builds of every committed `.swf` as data (a cold build, the same build on a warm cache, the same build in a second workspace), and again on purpose by the `determinism` CI job, which runs `tools/corpus-roundtrip.mjs check` plus the literal `diff -r` over two workspaces and then asks `swfforge verify --deep` to agree with the shell, because a green diff and a red verify would mean the checker is wrong | F1 | P6 |
| `T-CMP-004` | exit codes per failure class (5 fixtures) — wired in `packages/cli/test/cli.test.ts`, which runs five real invocations against temp projects rather than unit-testing a classifier: a clean build (0), a file with no SWF signature (2, and no output directory created), a missing input (2), a `DoABC` movie (3, nothing written), a `--max-warnings=0` movie the reader warns about (4). Class 5 is not reachable from an argument — a stage fault is recorded in the run result and a disk fault is class 2 — so it is proven by the crash report's content and by `exitForRun`'s precedence, and the classes a fixture cannot produce are named in the test file rather than faked | F1 | P6 |
| `T-CMP-005` | cache equivalence: cold vs warm builds produce identical outputs — wired in `packages/compile/test/cache.test.ts` per stage, and re-proven corpus-wide in `packages/cli/test/corpus.test.ts`, which requires the warm build to report a `cached` stage as well as byte-identical output: equality alone cannot tell a hit cache from an inert one | F1 | P6 |
| `T-CMP-006` | cancellation: SIGINT during an asset encode returns within 2 s, no partial files left | F1 | P6 |
| `T-CMP-007` | `verify --deep` detects an injected manifest↔TS drift, a missing asset, a tampered hash — the three cases are proven against `diffManifestTexts` and `checkManifestAssets` as pure functions (`WP-120-10`); the command, its exit code and its disk walk stay with `WP-120-13` and are wired there now: `verify` walks the directory, reads both halves of the manifest pair, an injected edit to `forge.manifest.json` is exit 1, and `--deep --against` proves the double-build comparison runs at all. `WP-120-12` re-proves all three cases one layer up, through `verifyProject`, where the question is not whether the two functions notice but whether `verify` runs them at all, at what severity, and with what the caller had to hand over | F1 | P6 |
| `T-CMP-008` | `plan` output matches the real build's `budgets.json` within tolerance — scheduled, not stubbed: no `budgets.json` exists until `WP-120-07`, and §7 records what P6 measures instead | F2 | P6 |
| `T-CMP-009` | emitted output for a fixture carrying `NamedAnchor` and scene data contains no `location` read (R032), and the forbidden-construct lint fails the build on an injected one — wired in `test/verify.test.ts`: a `FrameLabel` carrying the anchor byte is emitted and verifies clean, then one injected `window.location.hash` read in that same output is a `bans` error citing `IMPL-120-R032`. The first half proves an absence, and an absence the emitter cannot violate: no emitted line addresses an anchor, since anchors reach the runtime through the manifest. `E-052` records that so the row is not read as stronger | F1 | P6 |
| `T-CMP-010` | name assignment is a pure function of content and order: the serialised table is identical under 100 permutations of the `ExportAssets` dictionary **dealt into slots interleaved between the control tags**, so the claim cannot be satisfied by absolute offsets that happen not to move — the test asserts those offsets take several distinct tuples — plus the sanitisation table, the base-claim and `_2`/`_3` collisions, and `IMPL-120-R033`'s ban on offset-bearing names | F1 | P6 |
| `T-CMP-012` | dead-code pass: with `--prune-dead-code` off nothing is removed and every candidate is reported with its proof; with it on, a quarantined shape or an unparsed referencer payload disables pruning for the whole movie rather than proceeding partially, and a block is called unreachable only on the front end's own flag | F1 | P6 |
| `T-CMP-013` | shake: the emitted group set equals the union over every block that survives pruning, an entry point's own union is reported beside it, a T2 block forces the full set, and no group is dropped while any kept block names it | F1 | P6 |
| `T-CMP-011` | hoisting is sound: blocks differing only in position canonicalise equal, blocks differing only in a rebased jump or branch target do not (`IMPL-120-R034`), a T2 block is never hoisted, and every ungrouped or unhoisted block carries a reason | F1 | P6 |
| `T-CMP-014` | a residual blob is the block's own bytes: the emitted literal re-derives to the same array as the tag stream's slice, the descriptor carries parameters, registers, preloads, constants and the CFG's slices, a descriptor failing either check (a slice outside the blob, or a front-end `residual` list that disagrees with the CFG) writes no blob and leaves the block deferred, and the module imports only the contract type so a build with no residual row keeps the interpreter droppable (`IMPL-120-R018`, `CMP-R027`) | F1 | P6 |
| `T-CMP-016` | report determinism and completeness: a cold build and a warm one print byte-identical report files even though the sink holds an extra error row on one path (asserted as data, not assumed); keys are sorted at every depth; the gate list equals an independent walk of the config and the switches; and the markdown is the projection of the JSON it names | F1 | P6 |
| `T-CMP-017` | the `IMPL-120-R021` prohibitions are a check: an absolute path, a host name, or a wall-clock or epoch timestamp in any composed document suppresses every report file with `SF0511`, and a clean build's reports carry a hash, a frame count and a byte total without tripping it | F1 | P6 |
| `T-CMP-015` | `--vm.residual` changes the emitted set in three distinguishable ways: `on-demand` writes a blob only where a table routes it, `always` writes one per block and keeps the lowered function beside it, `forbid` writes none, strands the frame with the reason, and fails the build with one error per tier-2 function naming its byte count and reason (`IMPL-050-R060`, `CMP-R026`) | F1 | P6 |

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
| WP-120-08 | Emitter: symbols, frames, classes, buttons | WP-120-05 | 6 | `emit/source.ts`, `emit/surface.ts`, `emit/lower.ts`, `emit/files.ts`, `emit/scaffold.ts`, `emit/index.ts` — **Done**; statement-level source maps are withheld and reported (`SF0504`, `E-047`), blocks this phase cannot lower go to `WP-120-09`'s residual path, and the double-build CI proof stays `WP-120-14` |
| WP-120-09 | Emitter: residual blobs + entry descriptors | WP-120-08, WP-050-08 | 2 | `emit/residual.ts` — **Done**, `T-CMP-014`/`T-CMP-015` wired: blobs are copied out of the tag stream and never re-encoded, a descriptor that would lie is refused with `SF0505`, all three `vm.residual` modes are honoured by the stage, and a frame carrying a residual block now runs interpreted instead of being dropped. Clip-event routing, the mixed frame form and the content-hash blob cache stay open, as §4.2 names |
| WP-120-10 | Manifest emission (TS + JSON) + drift check | WP-120-08 | 3 | `emit/manifest.ts` — **Done**, `T-CMP-007` wired at the library boundary: one serialization spliced into `src/manifest.ts` and `forge.manifest.json`, `diffManifestTexts` and `checkManifestAssets` as pure functions for `WP-120-12`'s `verify --deep`, `AST` §6's asset sections omitted and reported (`SF0507`), and an unspeakable value refusing the pair (`SF0508`). §4.3 records the header, key-order, number and fixed-point rules the pair forced, and `emit/scaffold.ts` now writes `package.json` as strict JSON |
| WP-120-11 | Reports: build-info, porting-notes, divergence | WP-120-10 | 3 | `stages/report.ts` — **Done**, `T-CMP-016`/`T-CMP-017` wired: the three root artifacts and the markdown projection come from one pure `buildReport` over the stage artifacts, `gatesOf` enumerates every config leaf and switch so a new gate cannot skip the report, an input the build was not given is stated as withheld (`SF0509`) rather than zero-filled, a declaration that does not fit `CMP` §4.9 is dropped (`SF0510`), and a value carrying host identity suppresses all four files (`SF0511`). §4.4 records why the rows come from artifacts and not from the sink; the CLI that registers the stage and owns the disk stays `WP-120-13` |
| WP-120-12 | `verify` implementation + forbidden-construct lint | WP-120-10 | 4 | `src/verify.ts`, `src/emit/bans.ts` — **Done**, `T-CMP-002`/`T-CMP-007`/`T-CMP-009` wired: `verifyProject` is a pure function over `{path, text\|bytes}` records reporting findings rather than diagnostics (it runs outside a build, so there is no offset to attribute and no code to register), `R024`'s six clauses are four checks plus named `notRun` rows, and the ban list became one table with two renderers — which added `document.write`, `innerHTML` and a real matcher for `location` to the generated ESLint config. The CLI that walks a directory and picks an exit code stays `WP-120-13` |
| WP-120-13 | CLI: build/plan/inspect/verify/report + exit codes | WP-120-12 | 4 | `packages/cli` — **Done**, `T-CMP-004` wired (43 tests): one flag table for `CMP` §8 with a mechanical parity test that feeds every entry through `resolveForgeConfig`, the five verbs over real temp projects, sorted-and-rolled-back writes, `./forge.config.json` auto-detection that never reads the copy it wrote, the stage cache kept outside `--out`, and §6.1's four decisions. `--dry-run` is `plan`; `report` is a printer, not a judge. `E-053` files the exit-table and flag-home conflicts it found; `E-054` the emitted project's own unreferenced-export warnings |
| WP-120-14 | Determinism hardening + double-build CI job | WP-120-13 | 2 | `tools/corpus-roundtrip.mjs`, the `determinism` CI job, `audits/P6-CORPUS-ROUNDTRIP.json` + `audits/P6-C4-ROUNDTRIP.json`, and `packages/cli/test/corpus.test.ts` — **Done** (26 tests): 99 inputs round-tripped (21 fixtures, 5 fuzz crashers, 73 C4-c movies), 85 projects written, zero crashes, zero stderr, byte-identical cold/warm/fresh `85/85`, report files agreeing `85/85` over 2,720 gate rows, `verify` findings `0`; `E-054` closed by the emitter's outward-surface declaration, `E-055` closed by counting budgets in occurrences; §7 records the budget decision and `--budget-strict` stays inert | T-CMP-003, `T-CMP-005` |
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

**Measured by `WP-120-14`, on the corpus `registers/corpus.md` bounds.** Criterion 2 holds: every one of the 99
inputs the lane runs (C1's 21 fixtures, its 5 fuzz crashers, C4-c's 73 licensed movies) exits 0, 1, 2, 3 or 4 and
none exits 5, no invocation wrote to stderr, and the one file that could not be read left no project behind.
Criterion 3 holds over C1 and C2 — byte-identical cold, warm and second-workspace builds for all 85 projects that
were written — over the corpus the register bounds, and criterion 4 and 5 hold as asserted data: `verify` reports
zero findings on every written project (`E-054` is what made that sentence true), and the two report files agree
with each other on 2,720 gate rows while every row's value is the one the run resolved.

Criterion 1 is **not measurable in this repository yet** and is recorded rather than waived: it names the C3
reference title, which `registers/corpus.md` §2 lists as OPEN, with no `fixtures/PROVENANCE.md` to admit anything
against and its own two-reviewer requirement unmet. Its second clause — that the produced project "type-checks" —
has a second blocker behind it: the emitted `src/**` imports its runtime contract from `@swf-forge/runtime`, which
is `WP-130-01`, so `verify`'s `strict-build` row stays `notRun` with that owner named rather than being satisfied
by type-checking a project whose one dependency is missing. The half of `R014` that *is* decidable here — the
strictness of the emitted `tsconfig.json`, which is what makes the claim testable at all — is asserted in
`packages/compile/test/emit.test.ts`, in the describe block that carries `R014` and `R015`.

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
| 1.8 | 2026-10-14 | `WP-120-08` (the emitter) lands in four files under `src/emit/`. `source.ts` is the deterministic printer: number, string and table spelling (`REPO-R015`) and `CMP-R017`-shaped placement data. `surface.ts` is the closed contract of runtime identifiers emitted code may reference (§4.1), each entry citing the spec rule or marking itself a proposal, and a test fails if emitted output names anything off it. `lower.ts` lowers `ActionIR` to statements and refuses what it cannot lower. `files.ts` assembles the module set plus the generated `tsconfig.json`/`eslint.config.mjs`/`package.json` (`R014` bans, `R015` generated-not-copied). `emitStage` registers `emit` on the spine and returns files only: writing stays `WP-120-13`. A block that cannot be lowered is refused with a reason and deferred to `WP-120-09` residual-blob path rather than half-emitted, and `enumerate` plus `stack` operands are the two big deferrals. `SF0504` joins 2.1 for the withheld source maps |
| 1.9 | 2026-10-14 | `WP-120-09` (residual blobs and entry descriptors) lands as `emit/residual.ts` plus routing in `emit/files.ts` and policy in `emit/index.ts`. A block the emitter cannot lower now ships its original bytes as a `Uint8Array` literal and an `entry` descriptor — parameters, registers, preloads, constants, the CFG's slices, the source range — so the interpreter parses nothing (`IMPL-120-R018`); the bytes are copied from the decompressed tag stream, which is what keeps `IMPL-050-R068`'s ban on re-serializing reserved codes unreachable by construction. A frame carrying a residual block moves to `residualEntries` and runs interpreted instead of being dropped, which shrinks the deferred set to blocks with no residual path either; sprite frame scripts are routed by the front end's frame associations, so an exported sprite function is no longer unreachable. Two codes join §2.1 — `SF0505` for a descriptor that failed to validate, `SF0506` for `--vm.residual=forbid` — and §4.2 records the four things this package deliberately leaves open. `T-CMP-014`/`T-CMP-015` are wired to the 10 new tests (34 in `emit.test.ts`). The residual set the emitter uses is wider than the tier-2 set `IMPL-050-R057` names, which is `E-049` |
| 1.10 | 2026-10-14 | `WP-120-10` (manifest emission) lands as `emit/manifest.ts`: `buildManifest` composes the sections this phase can state, `serializeManifest` is the one writer (sorted keys, checked numbers, no header in the JSON), and `diffManifestTexts` plus `checkManifestAssets` give `WP-120-12`'s `verify --deep` its rules as pure functions. `IMPL-120-R019`'s "same in-memory object" is satisfied by splicing one serialized text into both artifacts, so the pair cannot drift by construction and the diff is about later edits. Two codes join §2.1 (`SF0507` for the sections withheld pending `WP-120-07`, `SF0508` for a value with no JSON spelling), `emit/scaffold.ts` stops writing a comment header into `package.json` (npm parses it strictly; `tsconfig.json` is the only JSON artifact whose reader allows comments), the manifest divides the raw FIXED8 frame rate by 256 because `AST` §6 wants frames per second, and `T-CMP-007` is wired to 11 new tests (44 in `emit.test.ts`). `E-050` filed: `CMP-R013`'s mandated header opens with `/* eslint-disable */`, a suppression the emitted project may not carry, and `AST` §6 asks for `movie.scaleMode`/`movie.align` that no input provides |
| 1.11 | 2026-10-15 | `WP-120-11` (the report files) lands as `stages/report.ts`: `buildReport` is one pure projection of the stage artifacts into `build-info.json`, `porting-notes.json`, `divergence.json` and the `reports/porting-notes.md` projection, and `reportStage` turns its gaps into `SF0509`/`SF0510`/`SF0511`. The rows never read the live sink, because a cached stage does not replay its diagnostics and `T-CMP-003`'s `diff -r` covers the report files too; `gatesOf` walks the config and the switches instead of naming gates, and `findHostLeaks` turns `IMPL-120-R021`'s MUST NOT list into a check that suppresses all four files. §4.4 records those four rules and the two omissions `E-051` files; `EmitArtifact` gained the source-map pair the gate list reports; the JSON writer moved to `emit/json.ts` so the reports and the manifest cannot fork a canonical form; `T-CMP-016`/`T-CMP-017` are added and wired by 17 new tests in `report.test.ts` |
| 1.12 | 2026-10-15 | `WP-120-12` (`verify` + the forbidden-construct lint) lands as `src/verify.ts` and `src/emit/bans.ts`. `verifyProject` is a pure function over `{path, text}` or `{path, bytes}` records that answers with **findings**, not diagnostics — `check`, `severity`, `path`, `detail`, `line`, `rule` — because S10 is a command over a project and there is no build in progress to attribute an offset to, so no §2.1 code is added and `WP-120-13` owns the exit codes. `IMPL-120-R024`'s six clauses became four checks plus rows recorded as not run with their owner named: the T2-blob validator (`WP-130-12`, which is all `@swf-forge/avm1` publishes today is `validateRegister`), budgets (`WP-120-07`, the missing input behind `SF0507`), and the emitted project's `tsc --strict`. `EMITTED_BANS` is now one list rendered twice — a matcher and the marker the generated `eslint.config.mjs` must carry, each asserted from a different side — and writing it down found three gaps in what `WP-120-08` had been generating: `document.write` and `innerHTML` had no rule though `CMP` §4.10 names both, and `location` had a rule and no matcher, so the ban `R032` and `T-CMP-009` depend on was decoration. Matchers run over `codeOnly` text, which blanks comments and string contents at identical offsets: `const u = "//"; eval(x)` cannot hide a call, a movie's text cannot trip a ban, and an unterminated construct returns the raw file rather than a blind spot. `emit/files.ts` gained `EMITTED_PUBLIC_EXPORTS`, the project's own "intentionally unreferenced" list, and a re-export now counts as a use of what it re-exports. New §4.5 records the four properties S10's placement forces; `T-CMP-002`, `T-CMP-007` and `T-CMP-009` are wired by 38 tests in `test/verify.test.ts`; `E-052` files what the specs cannot answer |
| 1.13 | 2026-10-15 | `WP-120-13` lands as `packages/cli` (`@swf-forge/cli`, bin `swfforge`): the argument table, the disk walk, the report output and `CMP-R029`'s exit codes. §6 is rewritten to the delivered surface — `build`/`plan`/`inspect`/`verify`/`report`, with `--dry-run` defined as `plan` and `inspect` defined as a printer over the pipeline's own dry run, so no verb has a second reader — and new §6.1 records the four things only the CLI can decide: a clean run is the only run that writes, the config file is read from the working directory only, the stage cache lives outside `--out` so two output directories stay diffable, and writes are sorted, temp-named and rolled back. §4's tree gains `forge.config.json`, which `CMP-R004` mandates and the tree did not list. `IMPL-120-R026`'s exit table is reworded to `CMP-R029`'s, because `apps/decompiler` already implements that one and two CLIs in one repository cannot mean different things by `1`; the header's `MS-§2` citation is corrected to `CMP-§8`, the spec that has the flag table. `T-CMP-004` is wired by five real invocations and `T-CMP-007`'s command half is wired here; `E-053` files the exit-table conflict, the phantom doc id, `R025`'s `REPO-§7` pointer, the four flags with no config home and the `@swf-forge/compiler` name `REPO-§2` still carries, and `E-054` the eight `symbols` warnings a clean emitted project carries |
| 1.14 | 2026-10-15 | `WP-120-14` (hardening + the double-build job) lands as `tools/corpus-roundtrip.mjs` and the `determinism` CI job, with `packages/cli/test/corpus.test.ts` as the always-on half: every committed `.swf` and every C4-c movie goes through `plan`, `inspect`, a cold build, a warm build, a build in a second workspace, `verify` and `verify --deep`, and the evidence is committed as `audits/P6-CORPUS-ROUNDTRIP.json` (C1: 26 inputs) and `audits/P6-C4-ROUNDTRIP.json` (99 with C4-c). Findings: 0 crashes, 0 stderr, 85/85 projects byte-identical across all three runs, 0 `verify` findings, report files agreeing on all 2,720 gate rows, 14 C4-c files correctly refused. Two defects closed: `E-054` (the emitter declares its outward surface — `EMITTED_PUBLIC_EXPORTS` gained the id/timeline/class/button/residual/asset families, precise where the module is fixed and directory-wide where the count is data-dependent, because §4 emits no bootstrap module) and `E-055` (a budget is counted in diagnostic *occurrences*, not sink rows — the 52-byte fuzz input that warned 92,680 times exited 0 before this). §7 records the phase's budget decision: `residualBytecodeBytes` is computed, five rows stay withheld with their owner, `--budget-strict` stays inert, `T-CMP-008` stays scheduled; §8 marks `T-CMP-003` wired and `T-CMP-005` re-proven corpus-wide; §10 records which criteria the corpus can measure and that criterion 1 waits on C3 and on `WP-130-01` |
