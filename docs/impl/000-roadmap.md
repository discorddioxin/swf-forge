# IMPL-000 — Implementation Roadmap

**Doc ID:** IMPL-000 · **Status:** Draft 1.44 · **Audience:** everyone building swf-forge
**Companion docs:** the per-area implementation specs in this directory; design specs in `docs/specs/`

---

## 1. What "the app" is

swf-forge ships as one product with two halves that are released together:

```
swfforge (CLI, Node ≥ 20)          @swf-forge/* (runtime, browser)
  parse → analyse → emit   ───────► shell + AVM1 runtime + WebGL2 renderer + Web Audio engine
```

A release is "done" when a real AS1/AS2 game can be turned into a TypeScript project that compiles,
boots, plays its critical path, and reports its divergences — on three browser engines, inside the
performance and bundle budgets of the design specs.

The roadmap below is ordered so that **every phase produces something demonstrable**, and so that the
riskiest unknowns (the AVM1 front end and the renderer) are attacked with the cheapest possible
apparatus in place first.

### 1.1 The five components (TECH-SPEC §2)

The product ships as five named components; the roadmap builds the libraries they compose, then the
components themselves. Each is a thin app over `packages/` (`TECH-SPEC.md` §3):

| Component | Package / app | Built by | Phase |
| --- | --- | --- | --- |
| `decompiler` | `apps/decompiler` | 010, 020, 030, 040, 050, 060, 070, 080, 090, 100, 110 | P0–P3 |
| `transpiler` | `apps/transpiler` | 120 (+ the decoders' outputs) | P5–P6 |
| `code-inspector` | `apps/code-inspector` + `@swf-forge/analysis`, `@swf-forge/project` | 150 | **P12** |
| `engine-flash` | `apps/engine-flash` + `runtime`/`gfx`/`audio`/`avm1` | 130 | P4, P7–P10 |
| `engine-clean` | `apps/engine-clean` + `@swf-forge/clean` | 160 | **P13** |

## 2. Phase plan

| Phase | Name | Status | Format-spec chapters | Primary outcome (the demo) | Exit gate |
| --- | --- | --- | --- | --- | --- |
| **P0** | Foundations | **In progress** | Ch.1 | `swfforge inspect game.swf` prints header + tag list; byte readers proven in **both** the Node and browser lanes | T-SWF-001…004, 009, 014–017 (§6 P0) |
| **P1** | Container & dictionary | **Completed** | Ch.2 | `inspect --tags --symbols` prints dictionary, sprites, exports, ordering violations | T-SWF-002, 003, 007, 008, 010–012 |
| **P2** | Model & timeline | **Completed** | Ch.3, 4, 12, 13, 15 | `forge-decompile dump` prints stable, diffable model JSON; ordered placements, sprites, control tags, button records/conditions, and tag dispositions have tests | T-MOD-001–040/601–604/801–817 + `tools/tag_coverage.py` |
| **P3** | Media decode and build assets | **Completed** | Ch.6–10 + Ch.11 decode/build subset | `forge-decompile assets dump <file.swf> --out <dir>` emits deterministic shape/bitmap PNG debug previews, supported-font WOFF2, PCM/ADPCM WAV previews, MP3 pass-through, and explicit diagnosed fallbacks | T-SWF-005/006 + P3-owned T-MOD/T-AST/T-AUD decode and asset-dump gates |
| **P4** | Static render (no VM) | **Completed** | — | A no-script SWF renders its main timeline in the browser, frame-accurate | T-GFX-001…005, 020, 021 |
| **P5** | AVM1 front end | **In progress** | Ch.5 | Front-end acceptance: audited opcode/IR/tier contract, byte round trip, corpus review, and FE-030 disposition | IMPL-050 §13; open P5 evidence remains explicit |
| **P6** | Emitter | **In progress** | — | `swfforge build` emits a project that compiles with zero suppressions | T-CMP-001…005, T-AVM1-026 |
| **P7** | First playable | **Not started** | — | A real open-corpus game boots and plays its first 60 frames with AVM1 runtime gates exercised | C1 (TST-§9.1), T-AVM1-008/009/012/025/027, IMPL-130 runtime execution gates |
| **P8** | Audio runtime | **Not started** | Ch.11 playback/sync | Music + SFX play, Web Audio scheduling and stream sound stay in sync for 10 minutes | T-AUD-001…010, 020…027 (runtime gates only; decode/build tests are P3) |
| **P9** | Fidelity hardening | **Not started** | all | Filters, blends, masks, dynamic text, hit testing, device fonts | T-GFX-010…041, T-AST-* |
| **P10** | Video & long tail | **Not started** | Ch.14 | Video plays; controls/metadata/system tags resolved; consumes P0's primitive-consumer register for the 24-bit field inventory (§4.1) | T-AST-021, T-RT-* |
| **P11** | Release engineering | **In progress** | App. A–C | Fuzzing, budgets, three-engine CI (extends the P0-owned browser lane, §4.2), docs, example titles | TST-§9.2, SEC-§9 |
| **P12** | Inspector | **Not started** | — | Open a built project: file explorer, highlighting, SWF↔TS navigation, diagnostics panels, dev run view | T-INS-101…114 |
| **P13** | Clean engine | **Not started** | — | The same title runs on a fixed-step loop with no MovieClip/timeline, with a rewrite log and probes | T-CLN-101…114 |

**Status basis (checked 2026-10-11).** These labels describe phase acceptance, not document readiness or a code/test count. **Completed** requires a reviewed phase exit verdict or audited green exit gates; **In progress** means work is underway but a phase-owned criterion remains open; **Not started** means phase-specific delivery/acceptance work has not begun. Code presence or a test citation alone does not close an obligation. Completed phases can retain explicitly accepted non-blocking deferrals, which remain visible in the owning spec.

- **P0 — In progress:** the [P0 audit](../../audits/P0-AUDIT.md) found incomplete `T-SWF-004` vector/browser evidence; no all-fixture `T-SWF-009` or 10⁵-case `T-SWF-014`; `T-SWF-015/016` tests that do not assert their full recovery/error contracts; no `T-SWF-017` allocation counter or 5 MiB SWF-R001 copy-budget measurement; and no `WP-010-12` reader fuzzer or required diagnostic-literal lint rule. The general suite passing does not close these obligations. The ordered [P0 resolution plan](../../audits/P0-AUDIT-RESOLUTION.md) records the evidence required before this status can change. Since that audit the browser half of the vector obligation is unblocked at the infrastructure layer: a browser lane now runs the shared §8 vector table in headless Chromium as its own CI job (§4.2), and building it found a real reader defect — `EncodedU32` values ≥ 2³¹ were misreported as overlong and emitted a spurious `SF0009`, now fixed with a regression test (§4.5). Vector *completeness*, `T-SWF-009`'s inventory, the allocation contract, `WP-010-12`, and the diagnostic-literal rule all remain open, so the phase stays **In progress**. **Dependency position (2026-10-13, §4.6):** P0 has no dependency-direction defect — doc 010's WP graph is entirely intra-P0 and the automated check reports no inversion — and every open item is evidence, not sequencing. Its three uncited obligations now carry live `Phase owner` dispositions in doc 010's test table, and `WP-010-11` is recorded as the only P0 package on P6's transitive path (§4.6 item F).
- **P1 — Completed:** the P1 audit and resolution report all six exit criteria green. This is phase exit readiness, not closure of every work package: standalone `swffuzz`/crasher-corpus tooling, streaming LZMA, the full-scale absolute-RSS follow-up, and the synchronous-zlib partial-yield deviation remain explicitly deferred or pinned in [the P1 resolution](../../audits/P1-AUDIT-RESOLUTION.md) §4–5.
- **P2 — Completed:** the P2 resolution closes its two minor findings with zero open audit findings; see [P2 audit](../../audits/P2-AUDIT.md) and [resolution](../../audits/P2-AUDIT-RESOLUTION.md).
- **P3 — Completed:** the C7 closeout records all P3 acceptance gates green and names later-phase forwards; see [P3 audit](../../audits/P3-AUDIT.md) and [resolution](../../audits/P3-AUDIT-RESOLUTION.md).
- **P4 — Completed:** its three exit gates are green; gradient/bitmap fills, full stencil masks, filters, and WebGPU remain later-phase scope, not an open P4 exit gate. See the [P4 diagnosis](../../audits/archive/P4-DIAGNOSIS.md).
- **P5 — In progress:** C0–C4 are complete as audit/evidence checkpoints, but P5 remains open for byte round trip, licensed/provenanced open-corpus evidence with two reviewers, and FE-030's unresolved `ActionStringLength` oracle. Route A keeps executable runtime semantics, interpreter/budget, and runtime call/unwind/scheduling acceptance in P7; those gates remain mandatory there. See [P5 resolution](../../audits/P5-AUDIT-RESOLUTION.md). **Dependency position (2026-10-13, §4.6):** the retained byte-round-trip gate is now specified and schedulable — `IMPL-050` v1.10 §5.7 defines the lossless inverse format in five canonical-encoding rules, `WP-050-18` (5 d) and `T-AVM1-FE-034` carry it, and §13 criterion 2 records the decision to keep the lossy disassembly surface out of the byte-identity path — so what remains is implementation plus the two external-evidence gates, which no amount of implementation closes. Doc 050's test table now carries the Route A forwards (`T-AVM1-FE-024` → P7 and the split FE-025/027/028 halves) as live dispositions.
- **P6 — In progress:** `WP-120-01` is delivered. `@swf-forge/compile` (`packages/compile/`) now holds the
  pipeline runner: the stage spine in the order the design spec mandates whatever order stages are
  registered in, the five post-model passes of doc 120 §3 on their own spine between `analyze` and `plan`, a
  run context carrying the resolved config, the diagnostic sink and a cancellation token threaded *through*
  every stage and loop rather than polled from outside, the cache seam the design spec's key formula needs,
  and `--dry-run` stopping after `plan` without writing a file. Three stage adapters wire the suppliers that
  exist (`WP-020-10`, `WP-030-09`, `WP-050-*`) including the AVM2 refusal, and a stage with no
  implementation is reported (`SF0500`, the first code in doc 120's compile range) instead of skipped
  silently. 24 tests. `WP-120-02` followed the same day: the content-keyed stage cache (`.forge/cache/`, one JSON entry
  per `CMP` §12 key, effect-set comparison for staleness, atomic writes, a corrupt entry degrading to a miss)
  and a structural serialisation that tags `Map`/`Set`/`Uint8Array` instead of enumerating fields, so a field
  the IR grows later cannot be silently dropped. `analyze` is the first cacheable stage; **`T-CMP-005`** is
  wired by it — cold and warm builds compared as bytes, proven over all 73 licensed corpus movies and
  negative-controlled by breaking the codec (49 mismatches on exactly the 49 movies carrying `Map` entries,
  0 with the honest one), which also established that `--verify-cache` cannot detect a lossy cache format
  and only output equivalence can (doc 120 §2.2). `WP-120-05` and `WP-120-06` followed: `passes/names.ts` and
  `passes/frames.ts` are the first two objects on the runner's **pass** spine, wiring `T-CMP-001` — 100
  permutations of the `ExportAssets` dictionary dealt into slots *interleaved between* the control tags, so
  no absolute offset can sit still — and adding `T-CMP-010`/`T-CMP-011` for two new rules: a synthetic name
  never embeds a source position (doc 120's new `R033`), and a hoist candidate is position-independent but
  content-complete, with T2 blocks excluded outright because a residual blob's identity is its bytes (its new
  `R034`). Each rule is negative-controlled by breaking exactly what it forbids. Doc 120 v1.6
  records the five decisions those passes had to make, including the reading of doc 050's `R062` and
  `AVM1-R036` step 1 the phase had to adopt because P5's pass discards the export map — a measured gap (0 of 20 exported
  names appear among 149 recovered ones, `E-044`), not a stylistic preference; the P5-side fix is `WP-050-10`
  and `WP-050-11` work, not something P6 may patch. **What remains:** the other 6 work packages. `decode` waits on P6's own asset chain
  (`WP-070-06`…`-09`, `WP-080-10`'s KTX2 half, `WP-080-11`, `WP-090-12`, `WP-110-12`), `emit` waits on P5's
  `WP-050-18` serializer for the losslessness claim it has to prove, and `WP-120-07` transitively on P0's
  unbuilt `WP-010-11` (§4.6 item F). P6's exit gate — a project that compiles with zero suppressions — is
  not approached by this work package, and the phase is **In progress**, not near closure. Starting it also
  found two document defects, both recorded: `E-042` (the design spec's acceptance table and doc 120's test
  table gave six `T-CMP-*` ids different meanings; the impl doc owns the band now) and `E-043` (the
  diagnostic model has three severities and no `requirement` field, so `--fail-on=risk`, `risk.json` and the
  design spec's CI default are unimplementable until P0 extends the model — P6 rejects the config value
  loudly in the meantime). `WP-120-03` and `WP-120-04` are the next two passes, and they are different in kind
  from the first two: `passes/dead-code.ts` decides what may be *deleted*, and `passes/shake.ts` decides what
  may be *omitted*, so every input either cannot read becomes a blocker rather than a gap in a table.
  `dead-code` proves reachability by closure over placements, removals, button records and sound ids, shape and
  morph fill/line bitmaps (clip fills included) and text font ids, with exports as roots; `shake` selects the
  emitted runtime modules as the union of host-API requirement groups over the kept blocks. **`WP-120-08`**
  (the emitter) is the seventh package delivered and the first that produces output: `emit/source.ts` prints,
  `emit/surface.ts` publishes the closed set of runtime identifiers emitted code may name, `emit/lower.ts`
  lowers `ActionIR` to statements, `emit/files.ts` assembles the modules in `REPO-R016`'s order, and
  `emit/scaffold.ts` generates the emitted project's own `tsconfig.json`/`eslint.config.mjs`/`package.json`, so
  the bans doc 120 puts on emitted code are enforceable *in the output* instead of promised about it. Both of its findings are
  refusals rather than workarounds. Emitted code is SSA-only, because `pushValueOperand` (`stack.ts:924`) inlines
  every pushed constant and a `pop` of a value nobody binds is simply nothing: a block carrying a `stack` operand
  cannot be printed at all (1 block of 93 corpus T0 root blocks, 5 of 7 T1, 19 of 19 T2) and goes to
  `WP-120-09`'s residual blob; and 17 of those 93 T0 blocks read a temp no op records a `result` for, so the
  emitter reconciles implicit pushes against unbound ids and refuses when the counts do not match, with
  `Enumerate` refused outright because its iteration cursor is interpreter state. Statement-level source maps are
  the second: `ActionIR` has byte ranges per block and none per op, so `emit` writes no `.map` and reports the
  new `SF0504` warning rather than a file that would attribute a line to an offset it did not come from (`E-047`).
  Net coverage on the corpus is 99 of 163 blocks (root and nested) lowerable, the largest single deferral being
  the 37 nested bodies whose constant pool is replaced at run time. 24 tests read the output as text, including
  that every frame-script call names a function the module declares and that no emitted file mentions an
  identifier off the surface. 33 tests, all over
  *decoded* fixtures, and the fixtures are what found the three things worth reading before `WP-120-08`: a
  `DoInitAction` block's owner is its schedule entry's sprite and not the tag's `inSprite`, which is null at
  movie level; `HostApiGroup` names a 14th group, `timeline`, that AVM1 §8.1's 13-row table cannot — reached by
  `ActionStop` alone, so 17 of 119 corpus blocks in 11 of 73 movies ask for a module that does not exist
  (`E-045`, folded and reported at the P6 boundary); and `DefineFont2/3`'s bitmap glyph ids, `DefineVideo4`'s
  deblocking bitmap and a payload our own reader over-ran leave nothing for a proof to read (`E-046`), so all
  three fail closed movie-wide. The fourth item is `IMPL-120`'s new `R035`, and it came from a defect in the first draft:
  reading `ctx.diagnostics` for a verdict makes a cached warm build prune what a cold build refused, so derived
  signals belong on the stage artifact (`ModelArtifact.readInterruptions`). Doc 120 v1.7 carries the clauses. **`WP-120-09`** (residual blobs and entry descriptors) is the eighth, and it turns the emitter's refusals
  into output rather than into gaps: a block the lowering tables cannot print ships as its own module holding that
  block's original bytes, copied from the decompressed tag stream, plus an entry descriptor — parameters, register
  slots, preload flags, the constant pool, the control-flow graph's block slices and the source range it came from
  — so the interpreter parses nothing, and the re-encoding P5 forbids for reserved and undefined opcodes is
  unreachable by construction. A frame carrying such a block is no longer dropped: it moves to a second table in the
  same module and runs interpreted, and a sprite's own frame scripts are now routed by the frames the front end
  records as referencing each block, so an exported sprite function is no longer unreachable. No blob is written
  until its descriptor is checked against it — a slice past the blob's end, or a front-end residual list that
  disagrees with the graph, is `SF0505`, and the block stays deferred rather than shipping a program counter that
  can walk off the end. The residual mode decides the rest and the emitter honours all three settings: on-demand
  writes a blob only where a table can route one (an unreferenced blob runs nothing), always writes one for every
  block so the emitted and interpreted paths can be compared inside a single build, and forbid writes none and
  fails the build with one error per tier-2 function naming its byte count and reason (`SF0506`). Over the 73
  corpus inputs every one of the 87 refused root blocks gets a blob — 105 283 bytes — and none is left with no way
  to run; the refusals are 68 unmodelled-op and 19 tier-2, which is also why the set the emitter treats as
  residual is 87 blocks where P5's front end records 19 (`E-049`, open). Ten more tests, 34 in `emit.test.ts`, and
  the surface list gains the descriptor type the runtime review still has to ratify. **`WP-120-10`** (manifest emission) is the ninth, and it is where `IMPL-120`'s `R019` (emit the manifest twice) is made unrottable: `emit/manifest.ts` serializes the manifest **once** and splices that text into both `src/manifest.ts` and `forge.manifest.json`, so the two cannot disagree about a value in any build, and `diffManifestTexts` parses both payloads and compares them structurally — a formatter re-indenting one file is not drift, a changed number is, reported as a path (`$.movie.frameCount: 1 in the TS manifest, 240 in the JSON`) for `WP-120-12`'s `verify --deep` to print. `checkManifestAssets` is the other half of that command's rules as a pure function over the manifest and a file list: a reference is hash-verified where `bytes` or `sha256` sits beside it and only counted where it does not, so a font-atlas entry cannot read as a passed hash check. What the manifest *says* is bounded by what P6 has: `$schema`, `schemaVersion`, `tool` — carrying the **emit stage's** config hash, since the artifact describes the emitted project — and `movie`; `AST` §6's nine asset sections are absent rather than empty and `SF0507` names them, because an empty `textures` map is a claim a runtime would cache, and `movie.metadata` follows §6's "if any". Writing the pair turned up three things the specs leave unsaid, all of them now visible: a non-finite number would reach JSON as `null`, which reads as a missing asset rather than a broken build, so `SF0508` refuses to write a manifest at all; `CMP-R013`'s mandated header opens with `/* eslint-disable */`, a suppression `IMPL-120`'s `R014` forbids in emitted code that would mute the very lint `WP-120-12` runs on generated files; and `AST` §6 asks `movie.scaleMode`/`movie.align` of a build whose only source for them is a player parameter (`RT-R040` routes `allowscale` to `Stage.scaleMode`), while `CMP` §5 puts the same pair under `stage` — the two fields are omitted and `E-050` asks the owners for one home and one nesting. The emitter also had to stop prefixing its JSON artifacts with the `//` header it puts on sources: `tsc` reads `tsconfig.json` as JSONC but npm and the shell's `type: 'json'` import do not, so `package.json` now states its provenance in a `"//"` field and `forge.manifest.json` states none, with a test parsing every emitted `.json` strictly. One unit bug the fixture caught: `StageModel.frameRate` is the header's raw FIXED8, so the manifest divides by 256 (`AST` §6's 24 is frames per second) exactly, because rounding a 6110-raw rate to 23.87 retimes the movie without showing a wrong number. 11 more tests — 45 in `emit.test.ts`, 943 repo-wide — and `T-CMP-007` moves from unwired to cited at the library boundary. **`WP-120-11`** (the report files) is the ninth's neighbour and the tenth package: `stages/report.ts` projects `build-info.json`, `porting-notes.json`, `divergence.json` and `reports/porting-notes.md` out of the stage artifacts, and the choice of source *is* the design — a cached stage restores its outcome without replaying its diagnostics, so a report that read the live sink would print a different file for a warm build than for a cold one, and `T-CMP-003`'s proof is a `diff -r` over the whole output directory. The test for it is honest about the asymmetry: the cold run's sink carries an `SF0406` the warm run's does not, and the report files are byte-equal anyway. The gate list is a walk of `ForgeConfig` and `RunSwitches` rather than a list of names, so a config key added next month cannot skip the report, and the emit stage now echoes its own two source-map answers (`CMP-R014`'s default is a file this phase refuses to write, which `SF0504` says in prose and the gate map says in data). Four inputs a stage may not read from disk — the pin register, the `[verify]` items `T-TST-003` requires, `ARCH-R003`'s tier claim, the project's divergence declarations — are stated as *withheld* with a reason and reported once (`SF0509`) rather than zero-filled; `IMPL-120`'s `R028` budget line for residual bytecode is known and stated, the other five wait for `WP-120-07`; a divergence declaration that does not fit `CMP` §4.9 is dropped so the harness is never told to forgive a divergence it cannot check (`SF0510`); and `R021`'s MUST NOT list became a check — `findHostLeaks` looks for an absolute path, a wall-clock or epoch timestamp, and the host name, and a hit suppresses every report file (`SF0511`) instead of shipping the clean ones. `E-051` files what the specs cannot answer: `ARCH-R003` is defined twice in `000-architecture.md` and no gate can see it, `R021` requires the state of a `--video-native` flag that exists nowhere, doc 120 §4 and `CMP` §4.9 give the porting notes two different homes (both are written, the markdown as a projection of the JSON's object), and "every diagnostic" is not achievable in a build artifact until the sink records which stage spoke — asked of `WP-120-14`. 17 tests, two new obligations (`T-CMP-016`, `T-CMP-017`) wired the day they were added, and the JSON writer moved to `emit/json.ts` so the reports and the manifest cannot fork a canonical form. **`WP-120-12`** (`verify` and the forbidden-construct lint) is the eleventh, and it is the package that turns the emitter's *promises* into a command: `verifyProject({files, deep?, previous?, unreferencedAllowed?})` in `src/verify.ts` is pure over a file map, because S10 must be runnable against output this process did not write, and it answers with findings — `{check, severity, path, detail, line?, rule}` — rather than diagnostics, because there is no build in progress to attribute an offset to and no code in the registry to speak. That choice is why this work package adds no `SF05xx` entry and why the CLI owns `R026`'s exit codes. `IMPL-120`'s `R024` names six checks and a P6 build can run four of them over the bytes it is given; the other three are `notRun` rows that name their owner — the interpreter's blob validator (`WP-130-12`, since `@swf-forge/avm1` publishes only the operand-level `validateRegister` today), budgets (`WP-120-07`, the same missing input as `SF0507`), and the emitted project's own `tsc --strict` (`WP-120-13`) — because a check that silently returns nothing when it looked at nothing becomes the evidence a reviewer trusts. `R016`'s "a lint rule in the emitted project *and* a check in `verify`" is one policy with two renderers, so `emit/bans.ts` now holds `EMITTED_BANS`, each entry carrying its ESLint rule, the marker text the generated config must contain and the matcher `verify` runs, with a test on each side of the pair; writing the list down exposed three gaps in the scaffolding `WP-120-08` shipped — no rule for `document.write`, none for `innerHTML`/`outerHTML`/`insertAdjacentHTML` though `CMP` §4.10 requires both, and a `location` entry with no matcher behind it, which is the ban `R032` and `T-CMP-009` stand on. Matchers run on code, not text: `codeOnly` blanks comments and string/template contents at identical offsets, so `const u = "//"; eval(x)` cannot hide a call inside what a naive stripper calls a comment, a movie's own text cannot trip a ban, and an unterminated construct falls back to the raw file — for a security check a false positive costs a reworded comment and a false negative ships. 38 tests in `test/verify.test.ts` wire `T-CMP-002` (one fixture per ban, with the pairing asserted exhaustive both ways), `T-CMP-007` (drift, missing asset, tampered hash, now proven one layer up at the `verifyProject` boundary) and `T-CMP-009` (an anchor fixture verifies clean; one injected `location` read in the same output does not). `E-052` records that three rows of §4.10 are not properties of these bytes and that `T-CMP-009`'s first half proves an absence the emitter cannot violate. **`WP-120-13`** (the CLI) is the twelfth, and it is the package where the phase's promises become a program: `packages/cli`, `@swf-forge/cli`, one bin `swfforge`, five verbs (`build`, `plan`, `inspect`, `verify`, `report`), and 43 tests that run the real thing against temp projects rather than a mock filesystem. Its parser is a single flag table in which every entry names its own destination — a `ForgeConfig` path, a `RunSwitches` key, a stage option, or nowhere with a printed reason — and one test feeds every entry with a config path through `resolveForgeConfig`, which turns `CMP-R028`'s "every flag MUST have a matching `forge.config.json` field" from prose into a check; the flags that cannot satisfy it (`--jobs`, `--fail-on=risk`, `--budget-strict`, and `--sourcemap`, which the emit stage consumes as a stage option) are accepted, reported inert with their reason on every run, and filed as `E-053` rather than silently ignored. `--dry-run` *is* `plan`, one code path printing both, and `inspect` is a printer over the pipeline's own dry run rather than a second reader, so no verb can report a different file from the one `build` compiled. Four decisions belong to this package alone because no stage can see them: **only a clean run writes** (a `refused` run, a failed one, and any run carrying an `error` diagnostic leave no output directory at all, because `SF0001` input still produces twelve well-formed files about an empty movie and a directory is what a build script trusts); **`forge.config.json` is read from the working directory only**, because `CMP-R004` has the build write a copy into `--out` and a naive reader would let the previous build's pruned config become this build's file layer; **the stage cache lives at `<cwd>/.forge/cache` and never in `--out`**, because `CMP` §12's project-local cache would make two output directories differ and `verify --deep`'s determinism claim is a byte comparison over exactly those; and **writes are sorted, temp-named, and rolled back**, which is what makes `T-CMP-006`'s "no partial files left" a rule. Exit codes follow `CMP-R029` — the table `apps/decompiler` already implements — and `IMPL-120`'s contradicting exit table (`R026`: 1 "our bug", 4 "external tool missing", 5 "budget exceeded") is reworded to it with the precedence the design spec omits written into `src/exit.ts`, `E-053` recording the conflict, the phantom `MS-§2` citation doc 120's header had been carrying, `R025`'s pointer to a testing section for a JSON schema version, and the four report inputs that have no flag or field to set, beside a repository layout that still names the compiler package `@swf-forge/compiler`. Running `verify` over what `build` had just written also found a defect this phase owns but `WP-120-13` must not silence: eight of the emitted project's own exports are referenced by nothing, which is either a gap in `EMITTED_PUBLIC_EXPORTS` or a missing bootstrap module, and `E-054` gives the decision to `WP-120-14` with the check left able to fail. Doc 120 → v1.13 (§6 rewritten to the delivered surface, new §6.1, `forge.config.json` added to §4's tree, `T-CMP-004` and `T-CMP-007`'s command half wired); `errata.md` → 2.22 with two entries (54 open); 1041 tests in 77 files, 460 ids with 249 test-cited, `new=0`. P6 stands at 12 of 14 packages delivered: `WP-120-07` still waits on its asset inputs with `plan` unregistered, and `WP-120-14` is the hardening pass that closes the phase. The `IMPL-120-R0xx`-versus-`CMP` exit-table conflict is the second time P6 has had to choose between the two documents' tables, which is worth a line in the phase review rather than another silent adjudication. **`WP-120-14`** (hardening and the double-build job) is the thirteenth and, but for `WP-120-07`, the last. `tools/corpus-roundtrip.mjs` round-trips the corpus `registers/corpus.md` bounds — `plan`, `inspect`, a cold build, the same build on a warm stage cache, the same build in a second workspace, `verify`, `verify --deep` — over C1's 26 committed movies and, with `--with-open`, C4-c's 73 hash-checked ones, and `determinism` is a CI job that re-runs the lane and diffs `audits/P6-CORPUS-ROUNDTRIP.json` against the bytes this code produces, then does the literal `diff -r` and asks the verifier to agree with the shell. 99 inputs: 85 projects written, zero crashes, zero stderr, all three runs byte-identical on every project, `verify` silent on all 85, the two report files agreeing on 2,720 gate rows, and the 14 C4-c files the P5 report already names as error-bearing exactly the 14 this lane refuses to write. Two findings it produced were worth fixing, not recording. `E-054` resolves on the emitter's side: §4 emits no bootstrap module, so every file under `src/` is a table the runtime or the app shell addresses, and `EMITTED_PUBLIC_EXPORTS` now declares the id, timeline, class, button, residual and asset families — per export where the module is fixed, per directory where the count is a property of the movie — with the porter-authored dead export still reportable, so `swfforge verify` over a clean `swfforge build` now prints `clean` and nothing else. `E-055` is what the corpus was for: the diagnostic sink folds a repeated warning into one row carrying a count, so `--max-warnings 200` read as *rows* let a 52-byte fuzz input warn 92,680 times and exit 0; budgets are now counted in occurrences, that file exits 4, and it is the only one in the corpus that does. The phase's budget decision is written into doc 120 §7 — `residualBytecodeBytes` computed, five rows withheld with their owner named in the same object, `--budget-strict` accepted and inert, `T-CMP-008` left scheduled rather than satisfied by a stub — and §10 records which criteria the corpus can measure now (2, 3, 4, 5) and that criterion 1 waits on the reference title, with its type-check clause waiting behind it on `WP-130-01` because the emitted project imports a runtime contract this repository does not ship. Doc 120 → v1.14; `errata.md` → 2.23 with `E-054` closed and `E-055` opened (55 entries); 1070 tests in 78 files, 460 ids with 249 test-cited, `new=0`. P6 stands at **13 of 14 packages delivered**: `WP-120-07` is the only one left, still blocked on its asset inputs with `plan` unregistered, and every criterion the phase can close without it is now measured rather than asserted.
- **P7–P10 — Not started:** phase-owned acceptance has not begun. P3 decoders/assets and the P4 no-script renderer are prerequisites, not proof of P7 runtime execution, P8 playback/sync, P9 fidelity, or P10 video gates.
- **P11 — In progress:** CI currently runs spec verification, typecheck, tests, a 10⁴-mutation smoke fuzz gate, build, lint, development audit, tag coverage, and a **browser lane** (headless Chromium over the shared §8 vectors — the P0-owned minimal lane of §4.2, which P11 extends into the three-engine matrix). The P11 release gates remain open: 24-hour fuzz history, the security suite, bundle/texture/audio/manifest budgets, and a decision register with no un-triaged entries.
- **P12–P13 — Not started:** the design specs exist, but inspector and clean-engine phase acceptance has not begun.

**Shared verification snapshot (2026-10-14):** `corepack pnpm build`, `typecheck` (now including
`packages/compile/tsconfig.test.json`), `test` (**74 files / 960 tests**), `audit:dev`
(**198 codes**, **597 rules**, **460 test ids — 246 cited / 211 unwired / 3 source-only**, `new=0`), `corpus:verify`
(73/73 against the pinned manifest), `test:avm1-restart` (both reports identical), `test:browser` (**31 cases in headless Chromium 153.0.8010.0**, the same 26 vectors and the same pinned fingerprint as the Node lane), and `lint` pass. Carried forward from the 2026-10-11 snapshot: `python3 tools/verify_docs.py` (`ISSUES: 0`) and `corepack pnpm test:avm1-fuzz` (1,000,000 seeded mutations). These shared checks do not supersede the phase-specific open criteria above.

Each phase's document-level detail lives in the per-area implementation specs; this document owns
sequencing, dependencies, and the definition of done at phase granularity.

**Phase → implementation documents.** The phases above are sequencing; the work packages live in the
per-area documents. This table is the map between them:

| Phase | Primary doc(s) | Supporting docs |
| --- | --- | --- |
| P0 | [010](foundation/010-binary-io-and-records.md) | 140 (writer) |
| P1 | [020](foundation/020-container-tag-stream-dictionary.md) | 140 |
| P2 | [030](decompiler/030-display-list-and-sprites.md), [040](decompiler/040-control-tags-and-metadata.md), [100](decompiler/100-buttons.md) | 140 |
| P3 | [060](decompiler/060-shapes-and-gradients.md), [070](decompiler/070-images-and-morphs.md), [080](decompiler/080-fonts-and-text.md), [090](decompiler/090-sounds.md) (decode/build subset only) | 140 |
| P4 | [130](engine-flash/130-runtime-and-renderer.md) §5 (renderer half) | 060 (Vector IR), 080 (atlases) |
| P5 | [050](transpiler/050-actions-and-avm1.md) | 130 §6 (shared object-model interface only; runtime acceptance is P7) |
| P6 | [120](transpiler/120-compiler-and-emitter.md) | 130 §6 |
| P7 | [130](engine-flash/130-runtime-and-renderer.md) | 120 |
| P8 | 090 (runtime/playback subset) + [130](engine-flash/130-runtime-and-renderer.md) §7 | AUD design spec |
| P9 | 030, 060, 080, 100 (fidelity/runtime text paths) | 130, 140 |
| P10 | [110](decompiler/110-video.md) | 040, P3 media models, P4 renderer |
| P11 | [140](harness/140-conformance-harness.md) | 120, 130 |
| P12 | [150](code-inspector/150-code-inspector.md) | 120 (maps, reports), 020/050 (model, disassembly) |
| P13 | [160](engine-clean/160-engine-clean.md) | 050 (IR, tiers), 120 (emitter contract), 130 (renderer/audio bridges) |

A phase is not a document: several phases draw on the same document, and one document (130) spans two
phases. The dependency graph in §4 and the work-package tables in each document are the authority for
what can start when.

### 2.1 Why this order

| Ordering decision | Rationale |
| --- | --- |
| Byte readers first (P0) | Every other subsystem's bugs look like "weird data" if the readers are wrong. Cheap to over-test. |
| Container before anything semantic (P1) | Enables `inspect`, which becomes the debugging tool for every later phase. Also unlocks fuzz testing early. |
| Dictionary/model before media (P2) | Media work needs somewhere to put results; the model dump provides the stable inspection and comparison surface. |
| Media decode before renderer (P3) | You cannot debug a renderer against data you cannot see. PNG/WAV dumps are the fastest feedback loop in the project. |
| Static render before the VM (P4) | Isolates renderer bugs from VM bugs. A no-script SWF has a deterministic expected output, which makes the golden harness possible. |
| AVM1 front end before emitter (P5) | The emitter's hardest decisions (tiering, host-API binding) are made in the front end. Emitting before the analysis is right produces throwaway code. |
| Emitter before runtime polish (P6) | Emitted code is the runtime's test input. Building the runtime against hand-written examples first is a dead end (see `examples/` note in REPO-§2). |
| Audio after first playable (P8) | Game logic and rendering dominate "is this game playable"; audio is a large subsystem that can follow without blocking C1. |
| Fidelity hardening late (P9) | Filters/blends/text need the golden harness to be built and trustworthy, which requires P4–P7. |

### 2.2 Implemented so far (code ↔ spec)

This table records which slice of the plan exists as code and where its evidence lives. It is a
progress note, not a second contract: the work-package tables in each document remain authoritative.
Code presence or a test citation alone is not closure; an acceptance obligation is complete only when
its full, phase-owned outcome is demonstrated by the gate evidence.

| Slice | Code | Owning docs | Evidence |
| --- | --- | --- | --- |
| P0 byte readers | `packages/swf/src/io/*` | [010](foundation/010-binary-io-and-records.md) | `io.test.ts`, `framing.test.ts`, `container.test.ts`, and `diagnostics.test.ts` provide partial primitive/framing/registry evidence; full vector/browser coverage, T-SWF-009/014/015/016/017, the 5 MiB SWF-R001 measurement, WP-010-12 reader fuzzing, and diagnostic-literal lint remain open. See [P0 audit](../../audits/P0-AUDIT.md) and [resolution plan](../../audits/P0-AUDIT-RESOLUTION.md). |
| P1 container, tag stream, dictionary | `packages/swf/src/container/*` | [010](foundation/010-binary-io-and-records.md), [020](foundation/020-container-tag-stream-dictionary.md) | `framing.test.ts`, `fixture.test.ts`, `container.test.ts`, `ordering.test.ts`, `diagnostics.test.ts`, and `fuzz.test.ts` cover headers, lazy tag index/payload, length handling, missing `End`, duplicate ids, ordering, and the 10⁴ mutation smoke; **P1 exit gate is Completed** per [audit](../../audits/P1-AUDIT.md) and [resolution](../../audits/P1-AUDIT-RESOLUTION.md), with the listed non-blocking deferrals retained |
| P2 model & timeline | `packages/swf/src/model/*`, `src/tags/{place,clip-actions,control,buttons}.ts` | [030](decompiler/030-display-list-and-sprites.md), [040](decompiler/040-control-tags-and-metadata.md), [100](decompiler/100-buttons.md) | `model.test.ts`, `placement-corpus.test.ts`, `place-filters.test.ts`, `clip-actions.test.ts`, `control.test.ts`, `buttons.test.ts`, `imports.test.ts` (ordered display ops, exhaustive PO2/PO3 flags, sprites/End, labels/anchors, scenes, imports, button records/conditions/sounds, metadata, binary assets); `tools/tag_coverage.py` and `apps/decompiler/test/dump.test.ts` cover tag disposition and deterministic dump round-trip; **P2 exit gate is Completed** per its [audit resolution](../../audits/P2-AUDIT-RESOLUTION.md) |
| `inspect` verb | `apps/decompiler/src/commands/inspect.ts` | [060](decompiler/060-shapes-and-gradients.md) §5 reporting | `apps/decompiler/test/inspect.test.ts` (duplicate definitions, strict length handling, exit codes, `--json`) |
| `dump` verb | `apps/decompiler/src/commands/dump.ts`, `src/dump/model-dump.ts` | [040](decompiler/040-control-tags-and-metadata.md) §3.6 | `apps/decompiler/test/dump.test.ts` and audit synthetic probes (field order, sorted maps, file-order labels, op fields, `--out` bytes) |
| P3 media decode & build assets | `packages/swf/src/tags/*`, `packages/audio/*`, `packages/assets/*`, `apps/decompiler/src/assets/*` | [060](decompiler/060-shapes-and-gradients.md), [070](decompiler/070-images-and-morphs.md), [080](decompiler/080-fonts-and-text.md), [090](decompiler/090-sounds.md) | **P3 exit gate green.** Production shape/image/morph/font/text/sound decode paths and deterministic `assets dump` previews are closed; see `audits/P3-AUDIT.md` and `audits/P3-AUDIT-RESOLUTION.md`. Explicit forwards are P4 renderer integration, P6 asset build/subsetting, P8 runtime sound, and P9 runtime text/layout. |
| P4 static-render reference path | `packages/gfx/*`, `apps/decompiler/src/render/*`, `apps/engine-flash/*` | [130](engine-flash/130-runtime-and-renderer.md) §5, [`specs/web/050`](../specs/web/050-graphics-webgl.md) | P4 exit gate green: 20 golden no-script frames (`apps/decompiler/test/render-goldens.test.ts`), perf-static draw-call + allocation budgets (`T-GFX-020`/`021`/`050`/`051`) with `fixtures/goldens/perf-static.expect.json`, context-loss recovery (`T-GFX-060`), and a WebGL2 browser demo (`forge-decompile render --demo`); confirmed by the [archived P4 diagnosis](../../audits/archive/P4-DIAGNOSIS.md). P4's remaining renderer work is deferred to P9: gradients/bitmaps/real stencil masks (WP-130-08), filters (WP-130-09), WebGPU backend (WP-130-17). |
| P5 AVM1 front end | `packages/avm1/src/frontend/*`, `apps/decompiler/src/commands/analyze.ts` | [050](transpiler/050-actions-and-avm1.md) | **C0–C4 are complete as audit/evidence checkpoints; P5 remains open.** The 102-row opcode catalog and reserved complement are audited, synthetic disassembly and the seeded 10^6 mutation/truncation gate are covered, and the synthetic restart probe is deterministic. The P5-owned byte-round-trip surface, open-corpus/two-reviewer evidence, and FE-030 `ActionStringLength` oracle remain open. Runtime semantics/interpreter/scheduling execution (including T-AVM1-008/009/012/025/027) are P7 gates, not P5 closeout criteria. The mechanical 32/33 test-citation count is not a completion percentage. See `audits/P5-CHECKPOINTS.md`, `audits/P5-AUDIT.md`, and `audits/P5-AUDIT-RESOLUTION.md`. |

Current gate notes (evidence is local and synthetic; this does not claim the open-corpus exit gates):

- The Appendix-A gate found a style-run defect in the shape decoder (only the `FillStyle0` run was
  closed, and the final run was flushed before the end record was read): a fill-less, stroke-only shape
  decoded to four edges and zero runs. `IMPL-060` §6.1 already specifies the correct behaviour; the
  decoder was fixed and `packages/swf/test/shape-runs.test.ts` pins closed runs, `FillStyle1` runs, and
  `SF0186` on an unclosed fill run.
- P0–P2 local regression coverage includes shape flags/counts, duplicate definitions, missing-character
  placeholders, ordered timeline ops/labels, control metadata, strict FileLength diagnostics and the
  model dump. `SF1000` is emitted independently for `FileAttributes.ActionScript3` and `DoABC`; the CLI
  still maps it to exit 3. P1's 10⁴ seeded mutation smoke and P2's exit audit are green. P0 remains in
  progress: the focused audit found missing or partial P0 acceptance for vector/browser coverage,
  repeat-parse/property/recovery/allocation obligations, and the reader-fuzz/diagnostic-lint work; see
  `audits/P0-AUDIT.md`. The broader open-corpus/conformance and long-duration release gates belong to
  P5/P7/P11 and remain open; they do not reopen the completed P1/P2 gates.
- P4 (static render) is resolved per its archived diagnosis: 20 no-script fixtures render within TST-§6.1 tolerance against committed goldens (`fixtures/goldens/static/*.json`), `perf-static` budgets for `T-GFX-020`/`021`/`050`/`051` are bound in `fixtures/goldens/perf-static.expect.json`, and `T-GFX-060` exercises context-loss/restore on the GL backend. The production VectorShape→ShapeGeometry bridge lives in `apps/decompiler/src/render/vector-ir.ts`; `packages/gfx/test/adapter.ts` is now used only by the Appendix-A gate and will be deleted once that fixture routes through the production bridge. The browser surface is `apps/engine-flash` mounted by `forge-decompile render --demo`. P5 C0–C4 are complete as audit/evidence checkpoints, but P5 remains open: no action serializer/parser exists for the required byte round trip, the open-corpus/two-reviewer criterion remains unmet, and FE-030 lacks an oracle for `ActionStringLength`. Runtime-owned language, interpreter, and scheduling execution gates are assigned to P7 and do not become P5 passes. No P6/P7 implementation is started.
- PlaceObject3 filter/image/cache metadata is now decoded and dumped in P2's model, but the renderer
  does not implement filters, gradients, bitmaps or real stencil masks — those are gated by P9 (WP-130-08/09). Non-solid paints currently degrade to mid-grey (128) so they show up as wrong pixels, not wrong draw calls.

## 3. Milestones

| Milestone | Definition | Phase | Verifiable by |
| --- | --- | --- | --- |
| **M0 — Reader** | `swfforge inspect` runs over the whole fixture corpus without an uncaught exception, prints a tag list, and diffs clean twice | P0–P2 | CI job `inspect-corpus` |
| **M1 — Model complete** | Every AVM1-era tag in the corpus is either modelled or explicitly reported (`I`/`E` per APP-§2) | P2 | coverage report: 0 unknown-tag warnings on synthetic corpus |
| **M2 — Pixels** | The static-render demo matches archival captures within TST-§6.1 tolerances for 20 fixtures | P4 | visual golden suite |
| **M3 — Language front end** | P5 front-end acceptance passes; tier report on a suitable open corpus is reviewed by two people | P5 | IMPL-050 §13 and `T-AVM1-FE-*` suite |
| **M4 — Compile** | `swfforge build` output compiles under `strict` with zero suppressions for all synthetic fixtures; `swfforge verify` clean | P6 | `emit` CI stage |
| **M5 — Play** | Runtime coercion/format/enumeration/interpreter gates pass; three titles from the open corpus reach C1 (scripted play-through, no errors) | P7 | T-AVM1-008/009/012/025/027, IMPL-130 execution gates, `conformance` CI job |
| **M6 — Sound** | Stream sync ≤ 12 ms drift over 10 minutes; no click artifacts in the transition suite | P8 | T-AUD-027, T-AUD-022 |
| **M7 — Faithful** | Corpus reaches C2 on the declared tolerances; perf and bundle budgets met on both baselines | P9–P11 | TST-§7, TST-§9 |
| **M8 — Inspect** | A built project opens in the inspector: provenance badges, SWF↔TS jumps resolve, diagnostics export | P12 | T-INS-101…114 |
| **M9 — Clean** | One open-corpus title runs on the clean engine with probes passing and a rewrite log | P13 | T-CLN-101…114 |

Milestones are cumulative gates: M4 cannot be claimed while M2 is failing.

## 4. Dependency graph

```
P0 readers ──► P1 container ──► P2 model/timeline ──┬──► P3 shapes/gradients ──┐
                                                   ├──► P3 bitmaps/fonts ─────┤
                                                   ├──► P3 sounds ────────────┤
                                                   └──► P5 AVM1 front end ────┤
                                                                              │
                        P4 renderer (needs shapes/bitmaps/text) ◄─────────────┤
                        P6 emitter   (needs P2 + P5 + assets)   ◄─────────────┤
                        P7 first playable (needs P4 + P6)       ◄─────────────┘
                        P8 audio runtime (needs P3 sound assets + AUD runtime contract)
                        P9 fidelity (needs P4 + P7 + golden harness)
                        P10 video (video decode/build owned here; needs P3 infrastructure + P4 renderer)
                        P11 release (needs everything — including P0's writer and reader fuzz target)
                        P12 inspector (needs P6 + P4/P7 + P5)
                        P13 clean engine (needs P2 + P3 + P4/P7 + P5 + P6 + P11)

  measured edges that run against this order (§4.3):
                        P2 ──► P3, P4/P7, P5      P3 ──► P4/P7, P5, P11      P6 ──► P10
  capabilities relocated to the earliest phase that needs them (§4.2):
                        browser lane · reader fuzz target · measurement counters · fixture inventory ──► P0
```

The spine is the *declared* order. The measured work-package graph — 211 rows, 183 intra-document and
70 cross-document edges, extracted mechanically in [`audits/P0-PHASE-DEPENDENCY-MAP.md`](../../audits/P0-PHASE-DEPENDENCY-MAP.md)
§3 — differs from it in two ways this section now pins: twelve edges run against the phase order
(§4.3, and `tools/audit_dev.py`'s `dependency-direction` check now enforces the list on every run),
and the harness coupling `WP-140-01 → WP-010-12` pointed back into P0 while P0's own
deliverable pointed forward into the harness. That reciprocal pair existed only as prose inside a
`Deliverable` cell, so it appeared in no dependency table and was invisible to `tools/audit_dev.py`
and to this index. §4.2 breaks it by ownership relocation; §4.1 states the rule that keeps it broken.

Hard edges that are easy to get wrong:

- **P6 emitter → P2 model**: emitted code is generated *from the Movie Model*, not from re-parsing tags.
  If the model is lossy, the emitter invents workarounds that later become permanent. Get the model
  right (CMP-§3 `MovieModel`).
- **P4 renderer → P3 Vector IR**: the renderer consumes `VectorShape` (CMP-§5.1), never SWF bytes.
  This boundary is what makes the renderer testable and reusable (REPO-R006). Do not breach it.
- **P7 → P6 + P4 together**: "first playable" is an integration milestone, not a component milestone.
  Budget integration time; it is consistently the largest single line item in projects of this shape.
- **P9 → P2**: filter/blend *metadata* comes from `PlaceObject3` in the model (Ch.3), even though the
  implementation lands in P9. Do not defer parsing it — defer *rendering* it.

### 4.1 Dependency direction rule (supply-forward)

**Normative.** An artifact, capability, definition, or piece of information that a phase's exit gate
requires is owned by that phase or an earlier one. A later phase may *consume* it or *extend* it; a
later phase may never be the *supplier* of an earlier phase's gate evidence.

Where a gate input was found to live in a later phase, the input is re-homed in the phase that needs
it, and the later phase becomes a consumer of the earlier copy. The information then flows forward
through the graph instead of being pulled backwards across it.

Corollaries:

1. **Capability.** If phase N's gate needs capability C, the minimal form of C is a phase-N (or
   earlier) deliverable. The later phase previously assumed to own C is recorded as its *extender*,
   with the extension scope named. N never inherits the extender's scope.
2. **Information.** If phase N's gate needs information I that is documented in a later phase's spec,
   I is re-homed in phase N as a maintained artifact and the later phase cites N's copy. A later
   document may be where I was *discovered*; it may not be where I is *owned*.
3. **Work packages.** A `Depends` cell may name a later-phase work package only when the row also
   carries a `Phase owner` annotation re-attributing that row to the later phase (the pattern docs
   060/070/080/090 already use), or an explicit accepted-forward entry in the phase closeout. A
   silent inversion is a specification defect, corrected the way P3 corrected `WP-070-13`'s
   accidental P6 dependency — by removing the citation, not by waiting for the later phase.
4. **Cross-cutting infrastructure** (CI stages, harness, fixture program, measurement counters) is
   owned by the earliest phase whose exit gate needs it — see §4.2.
5. **Reciprocity must be declared.** If a later-phase package depends on an earlier-phase
   deliverable, and that deliverable's own text points back at the later phase, the pair is a cycle.
   One direction must be removed by relocating ownership; the surviving edge is recorded in a
   `Depends` cell in both documents, never in prose only.

**Worked example — P0 needing data documented at P10.** `IMPL-010` §10 item 4 requires confirming
that no `SI24` type exists before P0 may close. The only 24-bit field in the encoded spec set is
`VP6SWFALPHAVIDEOPACKET.OffsetToAlpha UI24`, documented in doc 110 → **P10, Not started**. Read the
old way, P0's exit gate needed information owned by an undeveloped phase, and P0 could not close
until P10 was written.

Under corollary 2 that is inverted. The **field-type inventory is P0-owned**: P0 maintains the
primitive-consumer register — which primitive types exist, which have no consumer yet, and which
structure consumes each — answers §10 items 3–4 from it, and records `OffsetToAlpha UI24` as the
sole 24-bit consumer, satisfied by the existing unsigned `u24` reader. **P10 later consumes that
register** when it implements the VP6 alpha path; it does not supply it. P0 waits on nobody, and P10
inherits a checked answer instead of re-deriving one.

Item 3 has the same shape and the opposite sign: the `FLOAT16` consumer is `DefineFontAlignZones`
(tag 73), decoded in production by doc 080 → **P3, Completed**. The consumer is *recorded in P0's
register*; the discovery site does not own it. That positive answer falsifies errata `E-004`'s
sentence "`FLOAT16` does not appear in any AVM1-era tag we parse", which must be re-opened under its
own re-open clause. `Cursor.u24()` having no production consumer today is likewise a register fact,
not an open question.

### 4.2 Cross-cutting infrastructure: relocated ownership

Four capabilities blocked P0 while being scheduled at P11. Relocated per §4.1 corollaries 1 and 4.
"Delivered" means gate evidence exists in this checkout; "Open" means the roadmap decision is made
and the implementing edit is listed in §4.4.

| Capability | Previously assumed owner | Now owned by | Later extender (named scope) | State |
| --- | --- | --- | --- | --- |
| Browser test lane — the §8 vector table executed in a real browser engine | P11 ("three-engine CI") | **P0** — one browser project running the *shared* vector definitions, as its own CI job | P11 — the three-engine matrix, `engine-skip` annotations, `reports/engine-matrix.md` (`TST-R020/021`) | **Delivered** — `vitest.browser.config.ts`, `packages/swf/test/support/vector-table.ts`, `packages/swf/test/io-vectors.lanes.test.ts`, CI job `browser`. 26 vectors / 31 cases pass in headless Chromium 153.0.8010.0 *and*, identically, under Node, tied together by one pinned cross-engine fingerprint |
| Reader fuzz target (`WP-010-12`) | prose: "`tools/fuzz/readers.ts`, wired into doc 140's harness" | **P0** — re-sited inside the gated tree (`packages/swf/test/fuzz/`), so it is typechecked, linted, and CI-runnable, and can run in both lanes | P11 / doc 140 — hosts the target in the long-run and nightly harness beside the container/tag/action fuzzers | **Open** — file absent; `tools/**` is outside both `eslint.config.js` and the root `tsconfig.json`, and doc 140 has no host work package |
| Allocation / copy counters (`T-SWF-017`; `SWF-R001` 5 MiB) | unspecified in every document | **P0** — adopts the already-accepted P4 instrumented-counter pattern (`packages/gfx/src/render/stats.ts`, `T-GFX-021`): exact per-site counted allocations are the proof; a coarse heap delta is permitted only as a secondary guard; warm-up and measured interval stated | P11 — runs the same counters as CI budget gates (`TST-R016`) | **Open** — the contract is not yet written into `IMPL-010`; `R-P0-06` correctly forbids the `heapUsed` fudge and tells the agent to stop, which is why it needs a normative home |
| Fixture inventory ("every fixture", `T-SWF-009`) | `TST-§3.1`'s three fixture classes → P11 corpus program | **P0** — bounded to the in-repo corpus: the 21 committed `.swf` files + the 5 crasher-corpus files + an enumerated deterministic registry of generated synthetic fixtures, checked in as an inventory artifact | P11 — the `open` and `archive` classes, `fixtures/open/`, `fixtures/PROVENANCE.md`, external hash-fetch (`REPO-R017`) | **Open** — no inventory artifact exists, and `IMPL-020` §10's "not committed as opaque binaries" still contradicts the 21 committed files |
| Browser engine acquisition for the lane | — (unowned) | **P0** — fetched, never committed: `pnpm exec playwright install chromium` on ordinary hosts, `node tools/browser-lane.mjs install` where only the npm registry is reachable | P11 — pins and versions the engine matrix | **Delivered** — registry-only install, 3.2 s, engine verified on arrival. The cache is disposable: a sandbox restore on 2026-10-13 deleted both `node_modules` and the 203 MB engine, and `pnpm install` + `browser-lane install` reproduced the whole lane in under 10 s. No binary is committed (`REPO-R017`) |

Two scope rulings travel with this table, because both were live contradictions:

- **The 5 MiB `SWF-R001` measurement may *drive* P1's container read paths.** `R-P0-07` requires
  exercising the paths that own payload bytes; those live in `packages/swf/src/container/*` (doc 020 →
  P1, **Completed**), while the P0 resolution plan's guardrail §1.5 forbids pulling in P1 container
  work. Ruling: driving completed P1 code as a *read-only consumer* is in scope for P0; changing any
  P1 behaviour is not, and would reopen P1's exit gate. The ≥5 MiB input must be **generated in
  memory** by the writer, never committed (`REPO-R017`'s 20 MiB fixture cap and its external-fetch
  mechanism both stay untouched).
- **P0 does not inherit P11's scope.** P0 needs *a* browser runner executing *its* vectors, not the
  three-engine matrix; *an* inventory of the fixtures it has, not the licensed open-corpus program
  whose failure is recorded as an open **P5** criterion. Reading either obligation against the P11
  gate would convert P0 from internally blocked to externally blocked, for no engineering reason.

### 4.3 Measured inversions and their disposition

Twelve edges run against the phase order; none has P0 on the depending side. Each is dispositioned
here instead of being left implicit, and the list is **machine-enforced**: `check_dependency_direction()`
in `tools/audit_dev.py` re-derives it from every `Depends` cell on every run, fails on an inversion
that is not dispositioned here, and fails on a disposition whose edge no longer exists (stale
paperwork hides the next real one). Measurement and the full edge list:
[`audits/P0-PHASE-DEPENDENCY-MAP.md`](../../audits/P0-PHASE-DEPENDENCY-MAP.md) §3.4 and Appendix A.

Three further inversions are *already* resolved by the `Phase owner` mechanism and so never appear in
the table: `WP-060-12` and `WP-060-14` (re-attributed to P4) and `WP-080-11` (re-attributed to P6).

| Depending phase | Later phase | Edges | Disposition |
| --- | --- | --- | --- |
| P2 | P5 | 3 — `WP-030-06`←`WP-050-01`, `WP-030-12`←`WP-050-05`, `WP-100-04`←`WP-050-03` | **Accepted forward.** P2 decodes the *records* (`CLIPEVENTFLAGS`, `CLIPACTIONS`, `BUTTONCONDACTION`); P5 owns action *semantics*. Re-attribute the three rows via `Phase owner` so the semantic half is visibly P5's |
| P2 | P3 | 2 — `WP-040-15`←`WP-090-07`, `WP-100-06`←`WP-090-07` | **Accepted forward**, both on the same supplier (`SOUNDINFO` + `StartSound`). P3 is **Completed**, so nothing is blocked; record the edge so the P2 rows are not read as unstartable |
| P2 | P4/P7 | 1 — `WP-040-09`←`WP-130-08` | **Accepted forward.** `DefineScalingGrid` metadata is parsed at P2; the renderer handoff is P4/P9 work, per the `P9 → P2` hard edge above |
| P3 | P4/P7 | 2 — `WP-060-12`←`WP-130-04`, `WP-060-14`←`WP-130-04` | **Already re-attributed.** Both rows carry `Phase owner: P4` in doc 060; P3's closeout lists them as explicit forwards |
| P3 | P5 | 1 — `WP-080-11`←`WP-050-08` | **Already re-attributed** (`Phase owner: P6` in doc 080); the font subsetter's reachability input is P5 tier assignment |
| P3 | P11 | 1 — `WP-070-14`←`WP-140-03` | **Accepted forward.** The morph corpus needs doc 140's oracle runner; P3 closed with the forward declared |
| P6 | P10 | 0 — was 1 (`WP-120-07`←`WP-110-06`) | **Inversion removed 2026-10-13** by the §4.1 supply-forward rule (`IMPL-110` v1.4, `IMPL-120` v1.3). The edge was real: the plan pass must report video bytes, but no video tag was decoded anywhere and the named supplier was P10's packet-header validation. `WP-110-12` now re-homes the *header + byte-extent* decode to P6, `WP-120-07` depends on it, and `WP-110-01` (P10) consumes it in turn — a legal forward. Packet-header validation, alpha pairing, transcode, native decoders, emission and verification stay P10; doc 120's R031 records that alpha pairing is a labelled estimate until then |
| P3 | P6 | 1 — `WP-080-10`←`WP-070-07` | **Defect corrected 2026-10-13** (`IMPL-080` v1.3). Found by the automated check on its first run, and missed by the original measurement because both rows sit in P3-era documents — the inversion only exists once `WP-070-07`'s `Phase owner: P6` is honoured. The delivered code shows the edge was **false**, not merely early: `apps/decompiler/src/assets/font-atlas.ts` rasterises and packs deterministic monochrome PNG pages + JSON (`T-MOD-509`/`T-AST-023`) with no KTX2, no `.sfa` and no mip generation, so it consumes nothing from `WP-070-07`'s re-encode ladder. The `Depends` cell is corrected and the KTX2/`.sfa` + mip half recorded as an explicit P6 forward. Same defect class P3 removed from `WP-070-13` |

The P3 rows show the mechanism that the other rows lack: docs 060/070/080/090 have a `Phase owner`
column, so an inversion is *re-attributed* rather than argued about. Doc 010 has no such column,
which is why P0 had no vocabulary for the same move — §4.4 item 1 adds it.

The reciprocal harness pair is **not** in this table because it is no longer an inversion: §4.2
relocates the reader fuzz target into P0, leaving only the legal forward edge `WP-140-01` (P11)
depends on `WP-010-12` (P0) — a later phase consuming an earlier phase's deliverable, which is the
direction §4.1 requires.

### 4.4 Required follow-up edits in the per-area documents

This document owns sequencing and phase-level definition of done; the work-package tables stay
authoritative for buildable units. The decisions above required these matching edits, each traceable
to a disposition in
[`audits/P0-PHASE-DEPENDENCY-MAP.md`](../../audits/P0-PHASE-DEPENDENCY-MAP.md) §7. **All ten were
applied on 2026-10-13**; the Status column records where each landed.

| # | Document | Edit | Disposition | Status |
| --- | --- | --- | --- | --- |
| 1 | `010` §9 | Add a `Phase owner` column (the doc 060/070/080/090 pattern); re-site `WP-010-12`'s deliverable from `tools/fuzz/readers.ts` to `packages/swf/test/fuzz/`, and record the divergence in the changelog | D-P0-DEP-03, D-P0-DEP-04 | Applied — `IMPL-010` v1.6 (all rows P0; `WP-010-12` re-sited) |
| 2 | `010` §8 | Write the allocation-counter contract normatively, citing the P4 instrumented-counter precedent and enumerating the counted classes separately for `T-SWF-017` (hot-read object allocations) and `SWF-R001` (payload-byte copies) | D-P0-DEP-02 | Applied — three counter rules in `IMPL-010` §8 (v1.6) |
| 3 | `010` §8, §10 | Add the primitive-consumer register (§4.1); close §10 items 3–4 on the `DefineFontAlignZones` positive and the `SI24` negative | D-P0-DEP-08 | Applied — `IMPL-010` v1.6, §10 items 3–4 closed |
| 4 | `010` §11.1 | Cite the delivered browser lane as the criterion-1 browser evidence, with P11's matrix recorded as the extension | D-P0-DEP-06 | Applied — `IMPL-010` v1.6 §11 criteria 1 and 4 |
| 5 | `140` | Amend `WP-140-07` (or add a work package) to host the raw-reader fuzz target, and declare the `WP-140-01 → WP-010-12` edge in both documents so the coupling is machine-visible | D-P0-DEP-05 | Applied — `IMPL-140` v1.2 (§1 deliverable 6 + `WP-140-07`) |
| 6 | `020` §10 | Resolve "all container fixtures are generated by the synthetic writer, not committed as opaque binaries" against the 21 committed `.swf` files; the `T-SWF-009` inventory cannot be pinned until this is settled | D-P0-DEP-01 | Applied — a fixture-provenance rule in `IMPL-020` §10 (v1.5) |
| 7 | `errata.md` | Re-open `E-004` under its own clause and correct the "`FLOAT16` does not appear in any AVM1-era tag we parse" sentence | D-P0-DEP-08 | Applied — `E-004` corrected, `E-033` filed, errata 2.7 |
| 8 | `tools/audit_dev.py` | Add a permanent inversion check over the §4.3 edge list, and admit P11 to `DEFERRED_FORWARD_PHASES` once doc 010 carries `Phase owner` forwards | D-P0-DEP-03 | Applied — see the note below this table |
| 9 | `specs/foundation/010` §10, `TECH-SPEC` §4.3 | Record that the `browser` CI stage now exists as the P0-owned minimal lane, keeping the three-engine matrix at P11 | D-P0-DEP-06 | Applied — `REPO` 1.2, `TECH` 1.3 |
| 10 | `010` §8 | **Blocking, needs a decision before the row-by-row matrix can be pinned:** the `UI32` row's Expected cell prints `1163342112`, but its own bytes `20 71 6e 45` are `0x456E7120` = `1164865824`, and the row's hex label agrees with the bytes, not with the decimal. Every other mechanically checkable §8 row is self-consistent. This is a document defect (upstream typesetting, `E-025` class, or our transcription) and must be dispositioned in `errata.md`, not silently absorbed into a test | new — see §4.5 | Applied as far as the evidence allows — see the note below |

Two of the ten need a note rather than a table cell:

- **Item 8 — what the check does, and the one part deliberately not done.** `check_dependency_direction()`
  re-derives every edge from every `Depends` cell, resolves each row's *effective* phase (its
  `Phase owner` cell when present, otherwise its document's phase from `DOC_PHASE`), and fails on (a) an
  inversion absent from `DISPOSITIONED_INVERSIONS`, (b) a disposition whose edge no longer exists,
  (c) a `Depends` id that is not a work package anywhere, and (d) a row with no resolvable phase.
  Ten unit tests in `tools/test_audit_dev.py` cover it, including the negative controls — a check that
  cannot fire is worse than no check. On its first run it found the twelfth inversion (§4.3, P3→P6),
  which the original hand measurement missed because both rows sit in P3-era documents.
  The `DEFERRED_FORWARD_PHASES` admission of **P11 was deliberately not made**: that set validates
  which phase owns a *deferred diagnostic code*, and no entry in `DEFERRED_DIAGNOSTIC_WPS` maps to a
  P11-owned work package. Doc 010's rows are all P0 and its P11 forward is declared on doc 140's
  `WP-140-07`, so there is nothing to admit; widening the set would have weakened the check for no
  consumer. The reasoning is recorded in a comment at the definition site.
- **Item 10 — applied as far as the in-repo evidence allows, and left open.** The `UI32` discrepancy is
  filed as **`E-033` (open)**: `IMPL-010` §8's row is annotated `⚠ disputed, E-033` with the
  byte-derived value printed beside the transcribed one, so nothing was silently overwritten. The
  provisional resolution applies the rule `E-025` already established for upstream worked examples —
  the bytes are authoritative — giving `1164865824`, which is what both lanes assert. Settling it
  permanently needs the upstream Ch.1 text, which this repository does not contain, so the entry stays
  open and the vector table fails if the discrepancy is ever dropped without being resolved.

### 4.5 Reader defect found while building the browser lane

Delivering the §4.2 browser lane produced the first row-by-row execution of `IMPL-010` §8 against
the production readers, and it found a real defect — the failure mode `audits/P0-AUDIT.md` F-P0-01
predicted when it recorded that the vector matrix had never been run.

`EncodedU32` values with bit 31 set were misreported as overlong and emitted a spurious `SF0009`.
Cause: `packages/swf/src/io/integers.ts` accumulated into a signed int32 with `|=`, then tested
minimality (`value < 2 ** (7 * (count - 1))`) *before* the `>>> 0` normalisation, so the maximal
`ff ff ff ff 0f` compared as `-1`. Five groups carry exactly 32 bits, so that encoding is minimal and
`IMPL-010` §8 expects the value with no diagnostic. Fixed by comparing the unsigned result; covered
by a regression case in `packages/swf/test/io.test.ts` and by the `encoded-u32-max` row of the shared
vector table, which both lanes execute. No existing test asserted either behaviour, so nothing
regressed — which is itself the evidence for F-P0-01's "untested reader" claim.

### 4.6 P0–P5 completion audit: dependency dispositions and open structural items

[`audits/P0-P5-COMPLETION-AND-P6-READINESS.md`](../../audits/P0-P5-COMPLETION-AND-P6-READINESS.md)
(2026-10-13) re-measured P0–P5 against their own acceptance text and every `Depends` supplier of every
`WP-120-*` row. Its dependency conclusion is narrow and worth stating plainly: **neither P0 nor P5 has a
dependency-direction defect.** `tools/audit_dev.py` reports zero inversion findings for both, doc 010's
WP graph is entirely intra-P0, and doc 050's only cross-document edges point *backwards* to P1
(`WP-020-04/05/07`). What kept both phases open was structural: obligations whose owner was named in
archived audit prose and nowhere live, and one P5 exit gate with no work package.

**Dispositions applied 2026-10-13** (all machine-checked; the gates are green):

| # | Change | Where | Why |
| --- | --- | --- | --- |
| 1 | The byte-round-trip gate is now specified and schedulable: §5.7 defines the lossless inverse format (`ActionIR` + canonical encoding, bytes → IR → bytes) in five canonical-encoding rules; `WP-050-18` (5 d, `frontend/serialize.ts`) and `T-AVM1-FE-034` carry it; §13 criterion 2 records the decision to drop the disassembly leg from the byte-identity path | `IMPL-050` v1.10 | P5 could not be scheduled to closure: its retained exit gate had no WP, no test id, and no estimate, and `WP-050-16` explicitly disclaims a parser/assembler |
| 2 | Every numbered impl document's test-obligation table carries a `Phase owner` column (215 rows annotated; docs 080/090 already had one) | `010`–`160` | A deferral must remain visible in the owning spec (§2 status basis). P2 closed with `T-MOD-030`/`T-MOD-602` uncited and their forwards only in `audits/archive/P2-RESOLUTION-AUDIT.md` |
| 3 | `audit_dev.check_test_dispositions()` fails the build on an uncited impl-declared obligation with no `Phase owner` cell (`tests.undispositioned:*`), or on one whose document is owned by a phase §2 lists as **Completed** while the cell names no later phase (`tests.openincompleted:*`). Phase labels are read from §2, not hardcoded. Both paths were negative-controlled | `tools/audit_dev.py` | The 212-id "scheduled-or-unwired" bucket could not distinguish a documented deferral from a missing test; that is how two P2 forwards stayed invisible through two closeouts |
| 4 | Doc 130's obligations are attributed per row (`T-RT-111` → P4 §5 renderer; five rows → P9; three → P8 §7; the rest → P7) | `130` §8 | `DOC_PHASE[130] = P4` made 19 P7 obligations count against a Completed phase. The conservative P4 pin stays for *dependency direction* — doc 130 has out-degree 0, so nothing is missed |
| 5 | `verify_docs.py` cross-checks §7's prose developer-day total against the §10 index | `tools/verify_docs.py` | §7 said 646.5 while §10 said 658.5; the index was right and the prose was unchecked |
| 6 | §7 reconciled: P0, P1, P2, P6, P10, P11 restated from their phase-owned WP sums, P12/P13 rows added (the Total had excluded 92 d of indexed work), and the four doc-130-sharing rows marked **not reconciled** instead of guessed | §7 | P6 was sized 30–45 d against an authoritative 64 d spread over four documents |

**Open structural items** (owners named; none is a dependency inversion):

| # | Item | Owner | Status |
| --- | --- | --- | --- |
| A | Doc 130's 17 WP rows need a `Phase owner` column. Its test obligations are now attributed per row, but the WP table is not, so §7's P4/P7/P8/P9 rows stay unreconciled and `WP-040-09 → WP-130-08` stays allowlisted as "P2 → P4" when the renderer handoff is P9's | `130` §9 | **Open** — the only remaining item that §7's reconciliation waits on |
| B | "The reference title" is named by P6 §10.1, P7 §10.1 and `T-RT-118` and defined nowhere; `examples/` (REPO §2 tree) does not exist and `fixtures/PROVENANCE.md` (`REPO-R017`) is still missing. P6 §10.3's "the whole corpus" is unbounded, while `T-SWF-009`'s "every fixture" was bounded to the in-repo corpus (§4.2) | [`registers/corpus.md`](registers/corpus.md) | **Applied 2026-10-13** — the register defines four corpus classes, bounds §10.3 as C1 + C2, and states the reference title's six admission requirements. **Extended the same day by the retried screen:** class C4 is now populated — 73 ActionScript-bearing AVM1 conformance movies from `ruffle-rs/ruffle@2372a4e1` (Apache-2.0 OR MIT, each shipped with its own `test.as`/`test.fla` source and expected trace), hash-pinned in `fixtures/open/manifest.json` and fetched into `.forge-cache/` rather than committed, because doc 020 sanctions exactly three roles for a committed binary and an external movie is none of them. That produced the project's first tier evidence over real action blocks (`audits/P5-C4-CORPUS-EXTERNAL.json`) and found five defects: `E-034` (a phantom four-byte block prefix), `E-035` (`DefineFunction*` carry `Code[CodeSize]` past the record's `Length`), and — found while fixing `E-035` — `E-036` (`With` and `Try` do the same, and doc 050's `Try` tiling rule said the opposite), `E-037` (a function body is not `End`-terminated, so a phantom block-terminator warning fired for every function) and `E-038` (an error-severity region overrun left the block claiming tier 0). All four are **fixed** under doc 050's new region rule and wired by three new obligations, and `E-039` — a `Try`'s catch and finally bodies were decoded and then dropped from the IR — was fixed the same day under a second new rule in doc 050 (each region body is entered from its region op at the stack depth the player gives it, which for a `finally` body is the join of the try and catch bodies' exits) and wired by `T-AVM1-FE-040`. Fixing it exposed two more: `E-040` (a region body's leftover stack never reaches the code after the region, so a pop directly after a `Try` was a false `SF0406` and a false tier 2) — **fixed the same day** under a third new rule in doc 050 (control flows *through* a region: the block holding a `Try`/`With` record falls into the body, a body falls into the region's `finally` and then into the record after the region, so the continuation is a join over the bodies' exits) and wired by `T-AVM1-FE-041`, whose fix also uncovered a latent stall — a predecessor that never settled blocked the join forever, so every block downstream of unreachable code was silently absent from the IR — and `E-041` (a diagnostic emitted inside a nested block carries a block-relative offset, so four distinct underflows all report `@0`), still **open**. The regenerated report reads 119 blocks, **153** functions, **T0=119 T1=130 T2=23**, error-severity diagnostics **60 → 14** (all semantic), clean exits **21 → 60 of 73**, and zero of the three framing diagnostic families the screen had found; the ten entries that moved T0 → T1 are recovered statements rather than lost fidelity (`string_coercion.swf`'s disassembly grew 119 → 654 lines). The reference title stays **OPEN** — C4 members are conformance tests, not titles — and the second reviewer is still owed |
| C | Doc 120 §7's budget rule (R028) requires video bytes in `budgets.json`, but no video tag is decoded anywhere (`DefineVideoStream`/`VideoFrame` exist only as tag codes and switch cases) and the named supplier `WP-110-06` is P10's | `110`, `120` | **Applied 2026-10-13** — `WP-110-12` re-homes the header/extent decode to P6, `WP-120-07` depends on it, doc 120's new R031 gives R028 its P6 reading, and the §4.3 inversion is gone |
| D | `T-MOD-030`'s second half ("the emitted bundle never reads `location`") is dispositioned to P6 in doc 040's row, but doc 120 has no requirement, WP or `T-CMP-*` obligation that receives it | `120` §7/§8 | **Applied 2026-10-13** — doc 120's new R032 states the prohibition and `T-CMP-009` owns it on `WP-120-12`'s forbidden-construct lint |
| E | Doc 050 §5.6's target-path prefix rule (R037) — the grammar (`/abs`, `..`, relative, `""`, dot form, `:`-suffixed prefix) — is specified and implemented in `frontend/properties.ts`, consumed by `control-flow.ts`/`stack.ts`, and owned by **no test id**; `WP-130-03` (`SetTarget` resolution) carried none either, and `disassemble.ts` defines a second `formatTarget` beside the exported one | `050` §10, `130` §8/§9 | **Applied 2026-10-13 (documents)** — `T-AVM1-FE-035` (`IMPL-050` v1.11) and `T-RT-122` (`IMPL-130` v1.4) now own the two halves. **The tests themselves are not written**, and the duplicate formatter is still there |
| F | `WP-010-11` (P0, 3 d: test writer, 10⁵ property test, allocation test) is unbuilt and is the only P0 package on P6's transitive path — `WP-070-01` depends on it, and `WP-070-06/07/08/09` are P6-owned. P3 reviewed that edge and proceeded, which §5's ordering rule allows | `010` §9 | **Open** — implementation work, not a document fix |

**Closure conditions.** P0 closes when its five unevidenced obligations have evidence — `WP-010-11`
(`T-SWF-014`/`017`), `WP-010-12`'s reader fuzz target, the `T-SWF-009` in-repo inventory, the
`T-SWF-015`/`016` recovery/error contract strengthening, and the diagnostic-literal lint rule of §11
criterion 5 — plus the `E-033` `UI32` decision. P5 closes when `T-AVM1-FE-034` is green (item 1 above)
and its two external-evidence gates are satisfied: an admissible licensed open-title corpus with tier
evidence reviewed by two people, and an oracle for `ActionStringLength`'s SWF ≤ 5 byte-versus-character
result. Neither external gate is closable by implementation work; the 2026-10-11 GitHub screen admitted
no candidate and three emulator cross-checks did not establish Flash Player behaviour, so both remain
open and P5 stays **In progress** until they are met or explicitly re-scoped by a recorded decision.

## 5. Parallelisation

The graph above is deliberately wide after P2. Recommended splits:

| Team size | Plan |
| --- | --- |
| **1 engineer** | Strictly sequential P0→P11. Do not start P4 before P3 lands; the renderer needs data. |
| **2 engineers** | A: P0→P2→P5→P6 (compile path). B: P3→P4→P8 (media path). Merge at P7. |
| **3 engineers** | A: P0→P2→P5. B: P3 (shapes/bitmaps/fonts)→P4. C: P6→runtime shell (RTP) + harness, then P8. |
| **4+** | Add a dedicated harness/testing owner from day one (the synthetic SWF writer pays for itself by P3), and a separate owner for audio from P8. |

Cross-cutting roles that must exist regardless of team size: an **owner for the conformance harness**
(140) from P1 onward; an **owner for the P0-side test infrastructure** from P0 onward — the browser
lane, the fixture inventory, the measurement counters, and the reader fuzz target of §4.2, all of
which are P0 exit-gate inputs and therefore cannot be picked up later; and a **decision-register
maintainer** (the design specs' decision tables) who ensures every measurement lands in the table it
belongs to.

## 6. Phase exit criteria detail

### P0 — Foundations

Every criterion below is owned by P0 or an earlier phase (§4.1). Where a capability used to be
assumed to belong to P11, §4.2 names the relocation and P11's extension scope.

| Criterion | Evidence |
| --- | --- |
| `ByteReader`/`BitReader` pass T-SWF-001…004 with hand-computed vectors | unit tests |
| EncodedU32, FLOAT16, FB[n], RECT, MATRIX, CXFORM, RGBA/ARGB all implemented | unit tests incl. the §10 erratum case |
| Every §8 vector asserted row-by-row, **on Node and in a browser engine**, from one shared definition | **Partly delivered** — `packages/swf/test/support/vector-table.ts` (26 provenance-tagged rows) runs as `io-vectors.lanes.test.ts` in both lanes, tied together by a pinned cross-engine fingerprint covering signed zero, NaN/infinity, `>>> 0`, and `TextDecoder('windows-1252')`. **Open:** the §8 rows needing a paired writer (`RECT` at arbitrary `Nbits`, `MATRIX` scale/rotate, `CXFORMWITHALPHA`) are `WP-010-11`, and the §8 `UI32` row's Expected cell must be dispositioned first (§4.4 item 10) |
| Zero-copy contract honoured (REPO/R001 equivalent for the parser) | a test that allocates a 5 MiB buffer and asserts allocation count. **Ruling (§4.2):** the input is generated in memory and never committed; the measurement may *drive* P1's completed container read paths, and may not change them |
| Allocation and copy counts are measured by a named, deterministic counter | **Delivered** — `allocationCounter` (`packages/swf/src/io/counter.ts`, doc 010 §8's instrumented-counter pattern) with the classes doc 010 §8 enumerates, asserted in `packages/swf/test/io-allocations.test.ts` (2026-10-16): 0 primitive allocations over 10⁶ warm reads, exactly 1 result object per record read, ≤ 1 payload copy over a ≥ 5 MiB `FWS` parse |
| "Every fixture" in `T-SWF-009` is a checked-in inventory of the in-repo corpus | **Delivered (C1)** — `packages/swf/test/fixture-inventory.test.ts` (2026-10-16) asserts the 26-file C1 inventory against the directory walk and the register count, with repeat-parse identity over all 26. C2's synthetic set remains enumerated as tests, not files (`registers/corpus.md` §4 item 4); `TST-§3.1`'s `open`/`archive` classes are P11's corpus program, with the forward recorded |
| The primitive-consumer register answers §10 items 3–4 without consulting a later phase | **Open** — P0 owns it (§4.1): `FLOAT16` → `DefineFontAlignZones` (tag 73, decoded by doc 080 → P3); no `SI24` exists in the encoded set; the sole 24-bit field is doc 110's `OffsetToAlpha UI24`, which **consumes** this register rather than supplying it |
| The reader fuzz target (`WP-010-12`) lives inside the gated tree | **Delivered** — `packages/swf/test/fuzz.test.ts` (+ `fuzz/corpus/`), typechecked, linted and run by `pnpm test:fuzz` in the gated tree; doc 140's long-run hosting (`WP-140-07`) remains the P11 forward, not a P0 obligation |
| The diagnostic-literal lint rule exists (`IMPL-010` §11.5) | **Delivered** — `tools/check_codes.py` (`pnpm code:lint`, CI), scope ruled production-only in `IMPL-010` §11.5 (v1.9): R1 every production literal registered, R2 no raw `code:` literal outside `codes.ts`, R3 no computed code |
| Diagnostic framework emits `SF` codes with scope | unit tests |

### P1 — Container & dictionary

| Criterion | Evidence |
| --- | --- |
| FWS/CWS/ZWS all parse; length mismatch policy matches SWF-R009 | unit + fixture tests |
| Tag index built lazily; sprite ranges recorded | unit tests |
| Ordering rule violations detected and reported (Ch.2 rules) | new diagnostics `SF0024`–`SF0026`, `SF0032` (020 §9) |
| Fuzz smoke: 10⁴ mutations, zero uncaught exceptions | CI job |

### P2 — Model & timeline

| Criterion | Evidence |
| --- | --- |
| `PlaceObject`/`2`/`3` produce ordered `PlacementOp[]` per frame | unit + model-dump golden |
| Sprite tree, frame labels, scenes, exports resolved | model dump on synthetic corpus |
| Buttons decoded into records + conditions | unit tests |
| Tag coverage report: every AVM1-era tag dispositioned | `tools/tag-coverage` output |

### P3 — Media decode and build assets

| Criterion | Evidence |
| --- | --- |
| `forge-decompile assets dump <file.swf> --out <dir>` emits deterministic shape/bitmap debug PNGs, supported-font WOFF2, PCM/ADPCM WAV previews, MP3 pass-through, and explicit diagnosed fallbacks | CLI golden: manifest schema, hashes, and two-run byte comparison |
| Production model exposes decoded `VectorShape`; edge widths, fill rules, and style-change records are covered | T-SWF-005/006; P3-owned T-MOD-101…123 |
| P3-owned image/morph tags, font/text records, and sound metadata decode into typed models | T-MOD-301…313/401…408/501…506/511…518; T-AUD-103…115 decode/build cases |
| SWF ADPCM output matches independent reference vectors at every bit width; JPEG/PNG/lossless output matches an independent decoder | T-AUD-002; T-AST-001…004 |
| WOFF2 and supported build-time atlas outputs are reproducible; CFF and intentionally unsupported codecs are explicit fallbacks | T-AST-023; font/audio fallback fixtures |
| Runtime text/input, audio playback/sync, full-timeline rendering, and video are not P3 criteria | P7–P9/P8/P4/P10 gates respectively |

### P4 — Static render

| Criterion | Evidence |
| --- | --- |
| Golden frames for 20 no-script fixtures within tolerance | visual suite (TST-§6.1) |
| Draw-call and allocation budgets met on `perf-static` | T-GFX-050, T-GFX-021 |
| Context-loss recovery works | T-GFX-060 |

### P5 — AVM1 front end

| Criterion | Evidence |
| --- | --- |
| Front-end opcode inventory covers all 256 byte values: 102 defined rows, exact reserved complement, and unknown-opcode residual fallback | T-AVM1-FE-001/033 |
| Defined-opcode bytes → IR → disassembly → bytes round trip | **Retained P5 criterion; open** — no AVM1 disassembly parser or action-byte serializer exists; IMPL-050 §13.2; FE-032 is one-way only |
| Tier reasons are exercised and reviewed on a suitable open corpus by two people | **Open P5 criterion** — `forge-decompile analyze --tiers --json`; C4's local corpus has no AVM1 action blocks or T2 rows |
| Seeded 10⁶ action-stream mutations/truncations have zero uncaught exceptions and safe residual fallback | Pass locally — `T-AVM1-FE-033`, `corepack pnpm test:avm1-fuzz` |
| Requirement extraction and name recovery are deterministic across process restarts | Pass on the synthetic restart probe; open-corpus evidence remains separate |
| FE-030's DBCS frontend case is source-bounded and the `ActionStringLength` result is resolved | **Open P5 criterion** — current fixture pins only the supported decode/`MBStringLength` behavior; no authoritative byte/character oracle |
| `DoAction`/`DoInitAction` schedule metadata is preserved at the frontend boundary | FE-027/028 metadata tests; these do not claim runtime ordering/execution |
| Runtime coercion/enumeration/format semantics, residual interpretation/budget, and observable call/unwind/scheduling execution | P7 / IMPL-130 gates: T-AVM1-008/009/012/025/027 plus runtime execution evidence; not P5 acceptance |

### P6 — Emitter

| Criterion | Evidence |
| --- | --- |
| Emitted projects compile under `strict` with zero suppressions | `emit` CI stage |
| Determinism: two clean builds byte-identical | T-CMP-001 |
| `swfforge verify` clean; manifest hash checks pass | T-CMP-005 |
| Golden diffs reviewed and small | golden suite |

### P7 — First playable (integration)

| Criterion | Evidence |
| --- | --- |
| Runtime AVM1 coercion, `isNaN`, enumeration, and number-format semantics pass without weakening the normative language requirements | T-AVM1-008/009/012/025; `T-RT-121` additionally pins enumeration |
| Residual interpreter executes T2 blocks and honors the instruction budget | T-AVM1-027; IMPL-130 WP-130-12 |
| Runtime executes frame calls, exception unwinding, and the `DoInitAction`/`DoAction` schedule; frontend IR/metadata citations alone are insufficient | IMPL-130 WP-130-05/12 runtime evidence; forward from FE-024/025/027/028 |
| Three open-corpus titles reach C1 | `conformance` job |
| No placeholder assets rendered in the first 60 frames | instrumentation assertion |
| Denied-URL count matches the build report | runtime vs build cross-check |

### P8 — Audio runtime

| Criterion | Evidence |
| --- | --- |
| Runtime selection/scheduling and playback are deterministic over the prepared P3 assets | T-AUD-010 and runtime playback suite |
| Stream sync drift ≤ 12 ms over 10 min with jumps | T-AUD-027 |
| No clicks across start/stop/steal/loop/re-anchor | T-AUD-025 |
| Web Audio/worklet mixer budgets met | TST-§7.2 `perf-audio` |

P3 owns sound tag/model decoding, ADPCM/PCM conversion, MP3 framing/pass-through, codec-appropriate
preview artifacts, and deterministic build metadata. P8 owns playback, voice management, mixer/DSP,
real-time scheduling, and stream-sync behavior; P3 does not close those runtime gates.

### P9 — Fidelity hardening

| Criterion | Evidence |
| --- | --- |
| Filters/blends/masks/text within declared tolerances | T-GFX-010…041, T-AST-020 |
| Hit testing parity at bbox level exactly and shape level within tolerance | T-GFX-030 |
| Device-font substitution table complete and reported | AST-§4.6 report |

### P10 — Video & long tail

| Criterion | Evidence |
| --- | --- |
| Video frame timing preserved; SSIM ≥ 0.98 vs source decode | T-AST-021 |
| `fscommand`, `System.capabilities`, `ExternalInterface` mappings documented and tested | T-RT-013 |
| The 24-bit field inventory P10 needs is already answered upstream | **Consumes** P0's primitive-consumer register (§4.1): `OffsetToAlpha UI24` is the only 24-bit field in the encoded spec set and is read by the existing unsigned `Cursor.u24()`. P10 does not supply this information to P0, and P0 does not wait for P10 |

### P11 — Release engineering

| Criterion | Evidence |
| --- | --- |
| 24 h fuzz with zero crashes | nightly job history |
| Security suite green (T-SEC-001…011) | CI |
| Bundle, texture, audio, manifest budgets met | `budgets.json` |
| Decision register: 0 un-triaged entries | `tools/decisions status` |
| Three-engine browser matrix green with skips documented | **Extends** the P0-owned browser lane (§4.2), which already runs the shared §8 vectors in headless Chromium as CI job `browser`. P11 adds the remaining engines, `engine-skip` annotations, and `reports/engine-matrix.md` (`TST-R020/021`); it does not re-own the minimal lane |
| The long-run harness hosts every fuzz target, including P0's reader target | doc 140 `WP-140-07`, amended per §4.4 item 5, beside the container/tag/action fuzzers |

## 7. Effort model

Planning figures, to be corrected in place as packages complete (IMPL-R003). Developer-days,
implementation + unit tests:

| Phase | Content | Est. (d) | Notes |
| --- | --- | --- | --- |
| P0 | readers, records, diagnostics skeleton | 20–24 | 20 d summed from the 12 P0-owned WPs in doc 010 (its v1.6 `Phase owner` column makes every row P0); upper 4 d is integration. Highest leverage per line of code in the project. **Reconciled 2026-10-13** — was 12–18, below its own WP sum. |
| P1 | container, compression, tag index, dictionary | 26–31 | 26 d summed from doc 020's 12 WPs; upper 5 d integration. LZMA is optional; zlib is 2 d. **Reconciled 2026-10-13** — was 15–22. |
| P2 | model, timeline, place/remove, sprites, buttons, control tags | 82–97 | 82 d summed from the P2-owned WPs: 030 (30), 040 (26), 100 (26); upper 15 d integration. Wide but shallow. **Reconciled 2026-10-13** — was 25–35, written before the WP tables were detailed. |
| P3 | shapes/gradients, bitmaps/morphs, font/text decode + WOFF2/atlas build, and sound decode/build assets | 146–173 | 146 d summed from P3-owned WPs: 060 (38), 070 (40 incl. asset-dump integration), 080 (36), 090 (32); upper 27 d is phase integration/conformance overhead. Video is P10; runtime audio is P8. This is gross phase scope, not remaining effort. |
| P4 | renderer core: tessellation, batching, text, atlases | 60–90 | **Not reconciled.** Doc 130 spans P4 (§5 renderer half), P7, P8 (§7) and P9, and its *WP* table has no `Phase owner` column, so the split is not machine-derivable. P4's delivered slice is §5's `WP-130-06`/`-07` (14 d) and its exit gate is the 20-golden no-script path (§2); only `T-RT-111` of doc 130's 20 obligations is P4's. |
| P5 | AVM1 decode, IR, tiers, host binding | 45–65 | Front end only; runtime semantics are P7. 52 d summed from doc 050's 19 WPs — `WP-050-18` (byte round trip, §5.7 contract) and `WP-050-19` (open-corpus lane) were both added 2026-10-13 — still inside this range, whose lower bound predates both. |
| P6 | emitter, resources, manifest, CLI, reports, verify | 68–80 | **68 d summed from every `Phase owner: P6` row, which spans five documents:** 120 (48) + 070 (`WP-070-06/07/08/09`, 13) + 080 (`WP-080-11`, 3) + 090 (`WP-090-12`, 2) + 110 (`WP-110-12`, 2, re-homed 2026-10-13); upper 12 d integration. **Reconciled 2026-10-13** — was 30–45, i.e. below its own WP sum by 19 d, and it hid 18 d of P6 work inside three P3-era documents (which is why `WP-120-07`'s supplier `WP-070-07` reads as a P3 leftover when it is P6's own row). |
| P7 | runtime shell + AVM1 runtime + integration | 50–75 | **Not reconciled** — shares doc 130 with P4/P8/P9. 19 of doc 130's 20 test obligations are P7's per its `Phase owner` column. Integration alone is typically 20–30% of this. |
| P8 | audio build pipeline + worklet mixer + sync | 35–50 | **Not reconciled** — only 2 d of P8-owned WP rows exist today (doc 090's runtime subset); the rest is doc 130 §7 (`WP-130-13/14/15`), whose rows are not phase-attributed. |
| P9 | filters, blends, masks, dynamic text, hit testing | 35–55 | **Not reconciled** — 6 d of P9-owned rows today, plus doc 130 §5's later-scope renderer rows (`WP-130-08`/`-09`) and doc 130's five P9 obligations (`T-RT-106/107/108/109/110`). Tolerance-driven; expect iteration. |
| P10 | video, system/long-tail API | 34–40 | 34 d summed from doc 110's 11 P10-owned WPs (its 12th, `WP-110-12`, is P6's — the header/byte-extent decode the emitter's plan pass needs); upper 6 d integration. **Reconciled 2026-10-13** — was 15–25. |
| P11 | fuzz, security, budgets, docs, examples | 48.5–57 | 48.5 d summed from doc 140's 11 WPs; upper 8.5 d integration. **Reconciled 2026-10-13** — was 20–30. |
| P12 | code inspector: indexing, navigation, run view | 41–48 | 41 d summed from doc 150's 12 WPs. **Added 2026-10-13** — §7 had no P12/P13 rows, so the Total excluded 92 d of scoped, indexed work. |
| P13 | clean engine: transforms and runtime | 51–60 | 51 d summed from doc 160's 13 WPs. **Added 2026-10-13.** |
| **Total** | | **≈ 737.5–941** | One engineer: 35–45 months. Three: 12–15 months, at the ~21 d/month the previous Total implied. |

The work-package tables in the per-area documents (indexed in §10) total **≈ 668.5 developer-days**
for implementation plus unit tests; `tools/verify_docs.py` cross-checks that figure against the §10
index, because this prose drifted 12 d behind it (646.5 vs 658.5) while the index stayed correct.
P3's corrected phase estimate is derived from the P3-owned WP slices (148 d gross) after removing
P4/P8/P9/P10 work; it is not a claim about remaining effort. Phase ranges also include integration,
conformance, and release-engineering overhead that is not attributed to any single package, which is
why the Total's lower bound (737.5) sits above the WP sum (668.5).

**Reconciliation rule (2026-10-13).** A row is *reconciled* when its lower bound equals the sum of the
`Phase owner: <phase>` WP rows for that phase (falling back to the §3 doc→phase map where a document
carries no `Phase owner` column), following the template P3's row established. Four rows are marked
**not reconciled** because they all draw on doc 130, which the §3 map splits P4 (§5 renderer half) /
P7 (whole document) / P8 (§7) / P9 (fidelity) while its WP table has no `Phase owner` column: the split
is real but not machine-derivable. Giving doc 130's 17 WP rows a `Phase owner` column is the single
change that would reconcile all four, and it is recorded as an open item in §4.4 rather than guessed
here.

These numbers assume the harness (doc 140) is built as part of P0–P2 rather than retrofitted; retrofitting
a corpus + oracle harness costs roughly the same as building it, but only after you have already paid
for the bugs it would have caught.

## 8. Risk-ordered work

| Risk | Probability | Impact | Mitigation | Owning doc |
| --- | --- | --- | --- | --- |
| AVM1 semantics unknowable for some patterns | high | high | Decision registers + oracle harness; tiering keeps failures local; residual interpreter as a correctness floor | 050, 140 |
| Renderer cannot reach Flash fidelity on AA/curves | medium | high | Tolerance policy declared up front; supersampled fallback; goldens from archival captures | 130 |
| Filter/blend performance cliffs | medium | medium | Group budgets; cache keys; degrade to unfiltered with a reported risk | 130 |
| Stream audio sync drift | medium | medium | Sample-accurate scheduling + frame table + drift instrumentation from day one | 090, 130 |
| Obsolete codecs (VP6/Nellymoser/Speex) | high | low | Decode-only at build time; per-asset failure with stub policy | 090, 110 |
| Corpus licensing | medium | medium | Synthetic writer first; external fixtures fetched by hash, never committed | 140 |
| Scope creep into "player" | medium | high | ARCH-R001 is normative: no runtime SWF loading path | 000 (design) |
| Chapter intake slows implementation | medium | low | Partial documents carry explicit open-item tables; work that does not depend on them proceeds | all |

## 9. Chapter intake process

Chapters of the format spec arrive incrementally. The intake procedure is fixed so that receiving a
chapter is a mechanical, reviewable event:

1. **Locate** the affected implementation docs via §2's document map (chapter → doc).
2. **Reconcile** each row of the doc's §Open items table: confirm, correct, or add. Corrections to
   byte layout go into *our* tables; the reasoning goes in the doc's changelog.
3. **Correct the design specs** if the chapter contradicts them (IMPL-R001), including any decision
   register entry that the chapter settles — mark it `[SETTLED: <ref>]`.
4. **Adjust work packages** if the chapter reveals work that was not scoped (record it; do not silently
   absorb it).
5. **Fold erratum findings** into `docs/impl/registers/errata.md`: upstream examples that contradict upstream
   field definitions, with our resolution and the test that encodes it. (The RECT worked example in
   Ch.1 already provides one entry.)

### 9.1 Appendix intake (complete, 2026-10-04)

The v19 document ends with three appendices. They are not narrative chapters, and each lands where its
content belongs rather than in a new doc:

1. **Appendix A — the worked example (pp. 223–236).** A complete 79-byte `FWS` v3 file, annotated
   bit by bit. It becomes the **committed golden fixture** (`IMPL-140` §2.1): the writer must re-emit
   the bytes exactly, and the readers must reproduce every annotated value — asserted by `T-TST-101`/
   `T-TST-102` and decomposed into `T-SWF-022`/`T-SWF-023` (header, tag framing, long header),
   `T-MOD-604` (placement walk) and `T-MOD-123` (shape walk, including the resolution of the
   shape-record alignment question). Its printed *tables* carry typesetting defects, recorded in
   `E-025`; the bytes are authoritative.
2. **Appendix B — the reverse tag index (pp. 237–239).** The tag-value authority: `specs/110` §2 is
   now exactly its 65 entries (`E-026` removed six invented names), unknown codes take the skip-by-length
   path, and `T-TST-103` machine-checks the equality.
3. **Appendix C — the Screen Video v2 palette (pp. 240–243).** 128 default colours, shipped as a frozen
   constant by `IMPL-110` §6 and mirrored in `specs/110` §10.12; `T-TST-104` compares all 128 values in
   appendix order.

With §9.1 done, **every section of the v19 document — Ch.1–Ch.15 and Appendices A–C — is encoded**
in `docs/specs` + `docs/impl`. Remaining open items are oracle-, corpus- or policy-pinned, never
"chapter not read yet".

## 10. Work package index

Generated from the per-area documents. Regenerate with `tools/impl-status --index`.

<!-- WP-INDEX:BEGIN -->
| Doc | Area | WPs | Dev-days |
| --- | --- | --- | --- |
| [010](foundation/010-binary-io-and-records.md) | Binary IO and Primitive Records | 12 | 20 |
| [020](foundation/020-container-tag-stream-dictionary.md) | Container, Tag Stream, Dictionary, and Processing | 12 | 26 |
| [030](decompiler/030-display-list-and-sprites.md) | Display List, Placements, Filters, and Sprites | 12 | 30 |
| [040](decompiler/040-control-tags-and-metadata.md) | Control Tags and Metadata | 15 | 26 |
| [050](transpiler/050-actions-and-avm1.md) | Action Decoding and the AVM1 Front End | 19 | 52 |
| [060](decompiler/060-shapes-and-gradients.md) | Shapes, Paths, and Gradients | 14 | 42 |
| [070](decompiler/070-images-and-morphs.md) | Bitmaps, Lossless Images, and Shape Morphing | 15 | 53 |
| [080](decompiler/080-fonts-and-text.md) | Fonts and Text | 14 | 45 |
| [090](decompiler/090-sounds.md) | Sounds: Event, Streaming, and Codec Paths | 12 | 36 |
| [100](decompiler/100-buttons.md) | Buttons and Hit Testing | 10 | 26 |
| [110](decompiler/110-video.md) | Video: Embedded Codecs and Transcoded Delivery | 12 | 36 |
| [120](transpiler/120-compiler-and-emitter.md) | Compiler Pipeline, Emitter, and Build Output | 14 | 48 |
| [130](engine-flash/130-runtime-and-renderer.md) | Runtime, Renderer, and Interpreter | 17 | 88 |
| [140](harness/140-conformance-harness.md) | Conformance Harness, Fixtures, and Fuzzing | 11 | 48.5 |
| [150](code-inspector/150-code-inspector.md) | Code Inspector: Indexing, Navigation, Run View | 12 | 41 |
| [160](engine-clean/160-engine-clean.md) | Clean Engine: Transforms and Runtime | 13 | 51 |
| **Total** | | **214** | **≈ 668.5** |

These 211 work packages are the buildable units. The roadmap's phase table adds integration, conformance, and release-engineering work on top; the total remains inside the class estimate in §7. Test ids and per-document work totals are summarized in `docs/impl/registers/STATUS.md`, regenerated with `python3 tools/gen_status.py`.

**Ordering rule:** a package may start when every `Depends` id is *reviewed*, not necessarily complete; the roadmap's phases (§2) already encode the cross-document ordering.

**Direction rule (§4.1):** a `Depends` cell may not name a later-phase package unless the row also carries a `Phase owner` re-attribution or an explicit accepted forward (§4.3). Where a phase's gate input was found to live in a later phase, the input is re-homed in the phase that needs it and the later phase becomes its consumer (§4.2). Silent inversions and prose-only reciprocal edges are specification defects.
<!-- WP-INDEX:END -->

## 11. Release definition

v1.0 is released when, for at least three titles of differing character (timeline animation with light
scripting; bitmap-heavy action game with streamed music; UI-heavy title with dynamic text and vector
art):

| Requirement | Source |
| --- | --- |
| C2 tier with all divergences listed and decision IDs cited | ARCH-§9, TST-§9.1 |
| Compiles from a clean checkout with one command, deterministic output | REPO-§5, CMP-R041 |
| Perf and bundle budgets met on `baseline-desktop` and `baseline-mobile` | TST-§7, RT-§9 |
| Three-engine browser matrix green with skips documented | TST-§8 |
| Security suite green; `THIRD_PARTY.md` complete | SEC-§9 |
| Every design-spec decision entry either settled or explicitly accepted | APP-§12, IMPL-R002 |
| `docs/impl/registers/errata.md` current | §9.5 |

## 12. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | Roadmap created; chapters 1–2 grounded; phases P0–P11 defined |
| 1.1 | 2026-10-04 | Ch.3/Ch.4 pass folded in: WP index re-derived for 030 (11/27) and 040 (14/21.5); totals 165 WPs / ≈495.5 d |
| 1.2 | 2026-10-04 | Ch.5/Ch.6 pass folded in: 050 (17/46) and 060 (13/39) re-derived; totals 171 WPs / ≈508.5 d; chapter-intake notes updated to the Ch.7 backlog |
| 1.3 | 2026-10-04 | Ch.7/Ch.8/Ch.9 pass folded in: 060 re-derived (14/42) with the gradient structures, 070 rewritten against Ch.8/Ch.9 (14/47); totals 174 WPs / ≈520.5 d; chapter-intake notes now point at Ch.10–Ch.15 as the remaining input |
| 1.4 | 2026-10-04 | Ch.10/Ch.11 pass folded in: 080 rewritten against Ch.10 (13/41) and 090 against Ch.11 (12/36); totals 176 WPs / ≈529.5 d; remaining input is Ch.12–Ch.15 (buttons, sprites, video, metadata) |
| 1.5 | 2026-10-04 | Ch.12–Ch.15 pass folded in — the final chapter batch: 100 re-derived against Ch.12 (10/26), 110 against Ch.14 (11/34), 030 gains the Ch.13 sprite model (12/30), 040 the Ch.15 tag bodies (14/24); totals 181 WPs / ≈551 d; the chapter map is complete for Ch.1–Ch.15 |
| 1.6 | 2026-10-04 | Appendix pass: §9.1 added (Appendix A golden fixture, Appendix B tag-index authority, Appendix C palette — the upstream document is now fully encoded); `IMPL-140` gains WP-140-10/11 (11 WPs / 48.5 d), totals re-derived to 183 WPs / ≈554.5 d |
| 1.7 | 2026-10-04 | Tech-spec pass: the five components are mapped in §1.1; phases **P12 (inspector)** and **P13 (clean engine)** added with their doc-map rows and milestones; WP index gains 150 (12/41) and 160 (13/51); totals re-derived to 208 WPs / ≈646.5 d |
| 1.8 | 2026-10-04 | Folder reorganisation: the document map now points at `foundation/`, `decompiler/`, `transpiler/`, `engine-flash/`, `code-inspector/`, `engine-clean/`, `harness/` and the registers directory; document ids, work packages and totals unchanged; verification moved to `tools/verify_docs.py` + `tools/gen_status.py` |
| 1.9 | 2026-10-04 | Implementation started (Phase 10): §2.2 added to record the code that exists and where its evidence lives — P0 readers, P1 container/dictionary, P2 model, the `inspect` verb and the P4 reference renderer (`packages/gfx`), with the Appendix-A gate and the shape style-run defect it found; the phase tables and the work-package index are unchanged |
| 1.10 | 2026-10-04 | `dump` implemented (`WP-040-14`): §2.2 gains its row; the P0–P2 gate note records what is closed locally and what still needs the corpus harness and the AVM2 signals |
| 1.11 | 2026-10-05 | P1 resolution pass: the P1 exit-criteria row for ordering-rule diagnostics cited a nonexistent `SF0120`-range; corrected to `SF0024`–`SF0026`, `SF0032` (020 §9 — `SF0120` belongs to doc 100) |
| 1.12 | 2026-10-05 | P2 integrity resolutions (R-P2-15): the P2 demo/exit rows now cite the `forge-decompile dump` verb instead of the never-built `inspect --timeline`/`verify`; §2.2 records the `control.test.ts` evidence and that buttons (doc 100) remain open until their resolution lands |
| 1.13 | 2026-10-05 | P2 repeat audit: mark the model/data-level button criterion resolved with `buttons.test.ts` + AVM1 action-block integration evidence; add the exhaustive placement corpus, clip-action/import model suites, and tag-coverage tool to the §2.2 evidence row; retain runtime pointer/hit-test work as a P4/P7 boundary, not as a P2 decoder gap |
| 1.14 | 2026-10-10 | P5 C1/C2 progress recorded: tier-report CLI and 95-test focused suite; IMPL-050 test IDs are isolated as `T-AVM1-FE-*`, while language gates `T-AVM1-008/009/012/025` remain runtime-owned and open; C3/C4 robustness and corpus gates remain outstanding |
| 1.15 | 2026-10-10 | P5 C3 audited: reconcile the 102-row AVM1 catalog and exact reserved ranges; pin payload/version/stack metadata and synthetic disassembly; the seeded 10^6 mutation/truncation gate passes. Explicitly retain the missing byte parser/serializer round trip as an open P5 criterion; C4 and runtime-owned language gates remain open |
| 1.16 | 2026-10-11 | Record the P5/P7 phase-boundary decision: P5 front-end acceptance remains open for its own byte-round-trip, corpus/reviewer, and FE-030 gates; runtime semantics/interpreter/scheduling execution move to P7. Mark C0–C4 complete as audit checkpoints without closing P5. |
| 1.17 | 2026-10-11 | Record the byte-round-trip scope decision: retain the existing inverse criterion as a P5 gate; keep it open and require a separate lossless contract/work package before implementation. |
| 1.18 | 2026-10-11 | Add explicit Completed/In progress/Not started phase labels, reconcile P1's audited exit readiness and accepted deferrals, keep P5/P7 ownership and open gates explicit, and mark P0 in progress because T-SWF-009/014/017 and the parser allocation acceptance lack current gate evidence. |
| 1.19 | 2026-10-11 | Add the P0 acceptance-bottleneck audit and AI-readable resolution plan; expand the P0 in-progress basis to include partial vector/recovery tests, missing browser/fuzz/allocation evidence, and the unimplemented diagnostic-literal lint gate. |
| 1.20 | 2026-10-13 | Resolve the phase dependency conflicts measured in [`audits/P0-PHASE-DEPENDENCY-MAP.md`](../../audits/P0-PHASE-DEPENDENCY-MAP.md): add the normative **supply-forward rule** (§4.1) — a gate input owned by a later phase is re-homed in the phase that needs it, with the P0←P10 24-bit field inventory as the worked example; relocate the four cross-cutting capabilities that blocked P0 from P11 to P0 and name each later extender (§4.2), ruling the 5 MiB `SWF-R001` measurement may drive but not change P1's completed container paths; disposition all eleven measured inversions and break the undeclared P0↔P11 harness cycle by ownership relocation (§4.3); list the ten matching per-document edits (§4.4); record the delivered browser lane and the `EncodedU32` ≥ 2³¹ spurious-`SF0009` defect it found and fixed (§4.5); extend the §6 P0/P10/P11 exit criteria and the §10 direction rule accordingly. P0 remains **In progress**. |
| 1.21 | 2026-10-13 | All ten §4.4 follow-ups applied, so the roadmap's decisions are now matched in the documents they govern: `IMPL-010` v1.6 (a `Phase owner` column with every row P0; `WP-010-12` re-sited from the ungated `tools/fuzz/readers.ts` into `packages/swf/test/fuzz/`; the normative allocation/copy counter contract (three new rules) adopting P4's instrumented-counter precedent; the primitive-consumer register; §10 items 3–4 closed — item 3 **positively**, item 4 negatively — and §11 criteria 1 and 4 updated); `IMPL-140` v1.2 (`WP-140-07` and §1 deliverable 6 now **host** the reader fuzz target, and the reciprocal edge is declared in both documents); `IMPL-020` v1.5 (a new fixture-provenance rule replaces the fixture sentence that contradicted the 21 committed binaries, naming the three sanctioned roles and bounding `T-SWF-009` to the in-repo corpus); errata 2.7 (`E-004` re-opened under its own clause and corrected — `FLOAT16` **is** consumed by tag 73; `E-033` filed open for the §8 `UI32` row); `REPO` 1.2 and `TECH` 1.3 (the `browser` CI stage recorded as delivered in its P0-owned minimal form, and `TECH-R008`'s `test:browser` corrected to the command that actually exists); `IMPL-080` v1.3 (a false `Depends` edge removed). §4.3 gains the twelfth inversion, found by the new `dependency-direction` check in `tools/audit_dev.py`, which now enforces the disposition list on every run with ten unit tests and negative controls. No phase status changed |
| 1.22 | 2026-10-13 | P0–P5 completion audit ([`audits/P0-P5-COMPLETION-AND-P6-READINESS.md`](../../audits/P0-P5-COMPLETION-AND-P6-READINESS.md)) applied: new §4.6 records the dependency dispositions and six open structural items with owners, plus explicit P0/P5 closure conditions; §2's P0 and P5 bullets gain their dependency position; §7 is reconciled from the phase-owned WP sums (P0 20–24, P1 26–31, P2 82–97, **P6 64–76** across four documents, P10 34–40, P11 48.5–57), gains the missing P12/P13 rows, marks the four doc-130-sharing rows **not reconciled** rather than guessing them, and its prose total moves 646.5 → 663.5 under a new `verify_docs.py` cross-check; §10 index follows `IMPL-050` v1.10 (`WP-050-18`) to 212 WPs / ≈663.5 d |
| 1.23 | 2026-10-13 | §4.6 items B–E applied in the documents they govern, and the last P6 → P10 inversion is gone: `registers/corpus.md` v1.0 defines the four corpus classes, bounds `IMPL-120` §10.3's "whole corpus" and states the reference title's admission requirements (title still OPEN); `IMPL-110` v1.4 re-homes the video header/byte-extent decode to P6 as `WP-110-12` with `T-MOD-917`, so `IMPL-120` v1.3 points `WP-120-07` at it and gains its new R031 (R028's P6 video reading) and its new R032 + `T-CMP-009` (the `location` prohibition receiving doc 040's `T-MOD-030`); `IMPL-050` v1.11 adds `T-AVM1-FE-035` for the target-path grammar and `IMPL-130` v1.4 adds `T-RT-122` for `SetTarget` resolution. §4.3's P6 → P10 row records the removal, §7's P6 row moves to 66 d across five documents, and the index follows to 213 WPs / ≈665.5 d |
| 1.24 | 2026-10-13 | §4.6 item B's retried corpus screen admitted class C4 and ran it: 73 licensed AVM1 conformance movies from `ruffle-rs/ruffle@2372a4e1`, hash-pinned in `fixtures/open/manifest.json` and fetched into `.forge-cache/` (never committed — doc 020 sanctions exactly three roles for a committed binary and an external movie is none of them). First real tier evidence: 119 action blocks, 93 functions, T0=191 T1=3 T2=18, zero phantom `unknown-opcode` reasons (`audits/P5-C4-CORPUS-EXTERNAL.json`). It found `E-034` — a four-byte phantom block prefix that `sliceBlock` skipped and `test-support`'s `actionBlock()` manufactured, so 750 tests passed while every real file mis-parsed — now fixed and pinned by doc 050's new block-ref rule and `T-AVM1-FE-036`, with a reverting negative control; and `E-035`, measured at 146 of 146 in-sync records placing `Code[CodeSize]` past the record's `Length`, which leaves 48 of 73 files reporting our `SF0400` and blocks doc 050 §13 criterion 3 (`T-AVM1-FE-037` unwired). `WP-050-19` (1 d) owns the lane: doc 050 → 1.12, index 19/52, Total 214 / ≈666.5 |
| 1.25 | 2026-10-13 | `E-035` fixed and the corpus lane re-run: doc 050 gained a region rule (`frontend/extents.ts`, one parser for the four opcodes that own bytes past their record's `Length`), its `Try` tiling rule was corrected, its `End`-terminator rule was narrowed to the block kinds an `End` actually closes, and a truncated region now makes its block residual. Fixing `E-035` exposed and fixed `E-036` (`With`/`Try`), `E-037` (function bodies are not `End`-terminated) and `E-038` (an error diagnostic with no tier consequence), and exposed `E-039` (open: a `Try`'s catch/finally bodies are decoded and then dropped from the IR, so R035's "reconstruct the structure from the IR alone" does not hold). Both fixture generators — the AVM1 test harness and `tools/avm1-restart-probe.mjs` — moved to the real shape, region bytes past `Length`; the probe's artifact is byte-identical in 15 of 17 keys, `directReportSha256` unchanged. New obligations `T-AVM1-FE-038`/`039` wired with `-037` in `packages/avm1/test/region-framing.test.ts`, `T-AVM1-FE-040` left deliberately unwired for `E-039`. Corpus after: 150 functions (was 93), T1 121 (was 3), errors 15 (was 60), `SF0400`/`SF0404`/`SF0420` all at zero files (were 48/5/49). |
| 1.26 | 2026-10-13 | `E-039` fixed and wired by `T-AVM1-FE-040` (`packages/avm1/test/try-bodies.test.ts`, six cases): a `Try`'s catch and finally bodies were decoded and then dropped from the IR, because the depth fixpoint seeded one region body per region *record* and every region body latched an unknown depth before its own region op had run. Doc 050 gained the region-entry rule (1.14) and its §13 criterion 3 was refreshed to the regenerated report — T0 123 → 124, three residual reasons down, errors 15 → 15 with `SF0406` identical file by file. §4.6 row B and the corpus register (1.3) record the two defects the same measurement exposed: `E-040` and `E-041`, both open |
| 1.27 | 2026-10-13 | `E-040` fixed and wired by `T-AVM1-FE-041` (`packages/avm1/test/region-flow.test.ts`, five cases): doc 050 v1.15 gained a third region rule — a region op falls into its body, a body falls into the region's `finally` and then into the record after the region, so the code after a region joins the bodies' exits — plus a dead-predecessor relaxation in the stack fixpoint, which had been dropping every block downstream of unreachable code from the IR. `T-AVM1-FE-032`'s golden and `T-AVM1-FE-008`'s dynamic-`With` fixture were re-pointed at the corrected CFG; the negative control fails 6 tests in 3 files. C4-c re-run: T0 124 → 119, T1 120 → 130, T2 25 → **23**, errors 15 → **14**, functions 150 → **153**, clean exits 59 → **60 of 73**, `SF0406` 13 items → 12, both files the errata entry named clear. Corpus register v1.4, errata v2.11 |
| 1.28 | 2026-10-14 | **P6 started**: §2's P6 row is **In progress** and the P6–P10 bullet is split. `WP-120-01` delivered as `@swf-forge/compile` — the pipeline runner (stage spine, pass spine, run context, threaded cancellation, cache seam, `--dry-run`), stage adapters for `read`/`model`/`analyze` over the delivered suppliers with the AVM2 refusal, and `SF0500` so an unimplemented stage is reported rather than skipped; 24 tests, all gates green. Doc 120 v1.4 records the stage-spine mapping to the design spec's S0–S10 and registers the code. Two defects found by starting the phase: `E-042` (the design spec's §13 and doc 120 §8 gave six `T-CMP-*` ids different meanings — the design spec no longer mints them, and its unowned build-time criterion is recorded) and `E-043` (no `risk` severity and no `requirement` field in the diagnostic model, so `--fail-on=risk` is unimplementable; P6 rejects the value and the model extension is dispositioned to P0). CMP is now Draft 1.2, errata v2.12 |
| 1.29 | 2026-10-14 | P6's second work package: `WP-120-02` (stage cache + structural codec) delivered, `T-CMP-005` wired — P6's first cited obligation — and the shared snapshot refreshed. The cache was proven by cold-versus-warm byte equivalence over the 73-title corpus and negative-controlled by deliberately losing data; the control is what showed `--verify-cache` cannot see a consistently lossy format, and `IMPL-120` v1.5 §2.2 records both mechanisms and that division. `RELEVANT_CONFIG_KEYS.analyze` was over-declared in v1.28 and is corrected to what the stage reads (nothing); `.gitignore` gains `CMP` §12's `.forge/` |
| 1.30 | 2026-10-14 | P6's third and fourth work packages: `WP-120-05` (name assignment) and `WP-120-06` (frame-script grouping and hoisting) delivered as the first passes on the runner's pass spine, `T-CMP-001` wired and `T-CMP-010`/`T-CMP-011` added for doc 120's two new rules `R033`/`R034`, each negative-controlled by injecting the defect it forbids. `IMPL-120` → 1.6: §3.1 records the five decisions those passes had to make, and its `WP-120-02` row is aligned to the roadmap's 5 days — the drift `verify_docs.py`'s §7↔§10 cross-check caught when this document moved. The index follows to ≈ 668.5 d and §7's P6 row to 68 d |
| 1.31 | 2026-10-14 | `WP-120-03` (dead-code pass) and `WP-120-04` (requirement shake) delivered as the next two objects on the pass spine, wiring `T-CMP-012`/`T-CMP-013`; `packages/compile` is at 117 tests across six files and the suite at 73/898. `IMPL-120` → 1.7: `R005` gains the three clauses the fixtures forced, `R006` gains the fold rule, and one new rule (`IMPL-120`'s `R035`: a pass takes its inputs from stage artifacts, never the live diagnostic sink — a cache hit re-emits nothing, so a sink-reading pass would prune on a warm build what it refused on a cold one). Two errata filed, both owned by P2 and neither patched from P6: `E-045` (the IR's `timeline` group has no §8.1 row; 17 of 119 corpus blocks in 11 of 73 movies) and `E-046` (`DefineFont2/3` bitmap glyph ids, `DefineVideo4`'s `DeblockCharacterID`, and an over-read that leaves `quarantined` unset while `SF0013` reports a *warning* at an offset inside the *next* tag — so no consumer can tell a partial payload from a complete one and no offset rule can attribute it). `errata.md` → 2.14, §2's P6 bullet now carries 6 of 14 work packages, and the shared snapshot is re-measured. |
| 1.32 | 2026-10-14 | `WP-120-08` (the emitter) delivered as `packages/compile/src/emit/` — printer, runtime-surface contract, lowering, module assembly, generated scaffolding — and `emit` is registered on the spine, so a build returns files instead of reporting `SF0500`. Doc 120 → 1.8: `SF0504` joins §2.1 for the withheld source maps, §4's output tree gains the three generated project files the emitter must ship, §4.1 states the surface contract, and the §9 row records what the phase owns versus what `WP-120-09` and `WP-120-14` still owe. `E-047` filed (open, owned by P5's stack model and doc 020's map decision): the IR binds some pushed values without recording a `result`, and has no per-op offsets. `E-048` filed (open, owned by docs 020/120 jointly and `WP-120-10`): `CMP-R018`'s worked example contradicts the output tree, the frame-script signature and the contract module, and its import line does not resolve against the package it names — doc 120's new §4.1 records which way the emitter went and why. `errata.md` → 2.16. Shared snapshot re-measured: 922 tests in 74 files, 191 codes, `new=0`, `ISSUES: 0`, corpus 73/73. |
| 1.33 | 2026-10-14 | `WP-120-09` (residual blobs and entry descriptors) delivered as `emit/residual.ts` with routing in `emit/files.ts` and policy in `emit/index.ts`: a block the emitter cannot lower ships as a `Uint8Array` of its own bytes from the decompressed tag stream plus a descriptor carrying parameters, registers, preloads, constants and the CFG's slices, so the interpreter parses nothing and nothing is re-encoded. A frame carrying such a block now runs interpreted instead of being dropped; a sprite's frame scripts are routed by the front end's frame associations; the three residual modes are honoured at the stage, with `forbid` failing the build per tier-2 function. `SF0505` (a descriptor that would lie) and `SF0506` (forbid) join doc 120's code table, `T-CMP-014`/`T-CMP-015` are wired to the 10 new tests, and doc 120 → 1.9 with a new §4.2 recording the routing shape and what stays open. `E-049` filed (open, owned by docs 050/120 jointly): the residual set is the tier-2 set doc 050 records and the lowering-refusal set doc 120 writes, and on the corpus that is 19 blocks against 87, 68 of them T0/T1 with no front-end slice list at all; `errata.md` → 2.17. Shared snapshot re-measured: 932 tests in 74 files, 193 codes, `new=0`, `ISSUES: 0`, corpus 73/73. P6 stands at 8 of 14 packages delivered, and `decode`/`plan`/`report` are still unregistered. |
| 1.34 | 2026-10-14 | P6's ninth work package: **`WP-120-10`** (manifest emission + drift check) delivered as `packages/compile/src/emit/manifest.ts` and wired into `emitFiles`. One serialization feeds both artifacts, so `IMPL-120`'s "same in-memory object" is a construction rather than a habit; `diffManifestTexts` and `checkManifestAssets` give `WP-120-12`'s `verify --deep` its rules as pure functions; `AST` §6's nine asset sections are omitted and reported (`SF0507`) instead of emitted empty, and a value with no JSON spelling refuses the pair (`SF0508`). `emit/scaffold.ts` stops writing a comment header into `package.json` (strict JSON), and the manifest carries frames per second rather than the model's raw FIXED8. `T-CMP-007` wired (243 cited, 212 unwired), 195 registry codes, 943 tests; doc 120 v1.10 adds §4.3, `E-050` filed (50 open)
| 1.35 | 2026-10-15 | P6's tenth work package: **`WP-120-11`** (build-info, porting notes, divergence list) delivered as `packages/compile/src/stages/report.ts` — three root artifacts plus the `reports/porting-notes.md` projection from one pure `buildReport`, artifact-sourced rows so a warm build prints the same bytes as a cold one, a gate list obtained by walking the config, withheld inputs named instead of zero-filled, and `IMPL-120`'s `R021` host-identity prohibitions turned into a check that suppresses the whole report. Three codes join the emitter's range (`SF0509`/`SF0510`/`SF0511`), two test obligations are added and wired (`T-CMP-016`/`T-CMP-017`), `emit/json.ts` now holds the one JSON writer, and `E-051` is filed (51 open). Doc 120 v1.11 adds §4.4; 960 tests, 198 codes, 460 ids (246 cited)
| 1.36 | 2026-10-15 | P6's eleventh work package: **`WP-120-12`** (`verify` + forbidden-construct lint) delivered as `packages/compile/src/verify.ts` and `src/emit/bans.ts`. `verifyProject` is pure over `{path, text}` records and returns findings, not diagnostics — S10 is a command, so there is no build to attribute an offset to, no new §2.1 code, and the exit codes stay `WP-120-13`. Four of `IMPL-120`'s `R024` clauses run (manifest drift, asset hash/size, symbols, bans) plus `CMP` §4.10's divergence row; three are `notRun` with owners (`WP-130-12` blob validator, `WP-120-07` budgets, `WP-120-13` strict build), and `--deep` adds the double-build comparison only when a previous build is supplied. `EMITTED_BANS` became one list rendered twice, which added `document.write`, `innerHTML` and a real `location` matcher to the generated ESLint config; matchers run over `codeOnly` text. `emit/files.ts` declares `EMITTED_PUBLIC_EXPORTS` and a re-export counts as a use. Doc 120 → v1.12 with a new §4.5; 38 tests wire `T-CMP-002`/`T-CMP-007`/`T-CMP-009`; `E-052` filed (52 open). Shared snapshot: 998 tests in 76 files, 198 codes, 597 rules, 460 ids (248 test-cited), `new=0`, `ISSUES: 0`, ledger `214 668.5 70 300 265`, corpus 73/73 |
| 1.37 | 2026-10-15 | P6's twelfth work package: **`WP-120-13`** (the CLI) delivered as `packages/cli` (`@swf-forge/cli`, bin `swfforge`) — the argument table, the disk walk, the report output and `CMP-R029`'s exit codes. One flag table names each entry's config path, run-switch key, stage option or inert reason, and a test proves the config half against `resolveForgeConfig`; `build`/`plan`/`inspect`/`verify`/`report` all run over real temp projects, `--dry-run` is `plan`, `inspect` is a printer over the pipeline's dry run, only a clean run writes, `./forge.config.json` is the only auto-detected config (never the copy in `--out`), and the stage cache sits at `<cwd>/.forge/cache` so two output directories stay diffable. Doc 120 → v1.13: §6 rewritten, new §6.1, §4's tree gains `forge.config.json`, `IMPL-120`'s `R026` reworded to `CMP-R029`, the header's `MS-§2` citation corrected to `CMP-§8`. 43 tests wire `T-CMP-004` and `T-CMP-007`'s command half; `E-053` (the exit table, the flag homes, and `REPO-§2`'s stale package name) and `E-054` (eight unreferenced exports in a clean emitted project) filed, `errata.md` → 2.22, 54 open. Shared snapshot: 1041 tests in 77 files, 198 codes, 597 rules, 460 ids (249 test-cited), `new=0`, `ISSUES: 0`, ledger `214 668.5 70 300 265`, corpus 73/73 |
| 1.38 | 2026-10-15 | P6's thirteenth work package: **`WP-120-14`** (hardening + the double-build CI job) delivered as `tools/corpus-roundtrip.mjs`, the `determinism` job, `audits/P6-CORPUS-ROUNDTRIP.json` and `audits/P6-C4-ROUNDTRIP.json`, with `packages/cli/test/corpus.test.ts` as the always-on half. 99 corpus inputs (C1 21, fuzz 5, C4-c 73) round-tripped through seven invocations each: 85 projects written, 0 crashes, 0 stderr, cold/warm/fresh byte-identical on all 85, `verify` findings 0, report files agreeing on 2,720 gate rows, 14 correctly refused. `E-054` closed by the emitter's outward-surface declaration (§4 emits no bootstrap module); `E-055` opened and fixed by counting budgets in warning *occurrences* rather than sink rows, which moves `crash-005-shape-edge-past-limit.swf` from 0 to 4. §4.6's B-item corpus bounds are now a gate rather than a description; doc 120 → v1.14 (§7 the budget decision, §8 `T-CMP-003` wired and `T-CMP-005` re-proven corpus-wide, §9 `-14` Done, §10 which criteria the corpus can measure), `errata.md` → 2.23 (55), `registers/corpus.md` → v1.5. P6 at 13 of 14 with `WP-120-07` the only open package |
| 1.39 | 2026-10-15 | Errata `E-056` closed. `IMPL-120-09`'s config-alignment clause was *asserted* met by `WP-120-13` but never applied: `DEFAULT_FORGE_CONFIG.graphics.maxDrawCalls` was 200 where `CMP-§8` prints a default of 700 (`docs/specs/foundation/020-compiler-pipeline.md:486`), and the flag table test only proved `--graphics.max-draw-calls` writes that config slot, so an unset run enforced a budget no specification names. The default is now 700, and the `CMP-R028` block pins every Default-column value `CMP` §8 prints to the config slot it resolves through (7 config-backed rows, the two `off` switches asserted against `DEFAULT_RUN_SWITCHES`, `--budget-strict` asserted as recorded-and-non-decisive), so the table cannot silently re-drift; `maxDrawCalls` was the only drift. `IMPL-120`'s delivery count is unchanged at 13 of 14 |
| 1.40 | 2026-10-15 | P6's remaining lane is *wider than `IMPL-120`'s table*, and saying so plainly: seven packages across the roadmap carry `Phase owner: P6`, six of them in docs 070/080/090/110, so "13 of 14 delivered" describes one document only. `WP-110-12` is now delivered — the `DefineVideoStream` header plus summed  `VideoFrame` byte extents that doc 120's video-budget rule (`IMPL-120` §4) names as the P6 reading (`packages/swf/src/video/extent.ts`, `T-MOD-917`, 13 tests; doc 110 1.5, doc 120 1.16). What keeps `WP-120-07` open is the encode side, not the reading side: `WP-070-06/07/08/09` (classify, re-encode ladder + mips, `.sfa` writer, texture budgets), `WP-080-11` (glyph subsetter) and `WP-090-12` (audio budgets section) are all still open, and `budgets.json` is composed from the last of each. Repo-wide: 79 test files / 1,084 tests, type-check 0, verify_docs and audit_dev clean |
| 1.41 | 2026-10-16 | Temporary P0–P6 close-out roadmap Wave 0 (doc hygiene only, no phase status changed): `WP-120-01`'s row in `IMPL-120` §9 gains its **Done** marker (doc 120 v1.17), and `WP-010-12`'s deliverable is re-pointed at the delivered fuzz target `packages/swf/test/fuzz.test.ts` (doc 010 v1.7; roadmap §6's P0 fuzz row now reads Delivered). Both items were done in substance and mis-described in the ledger |
| 1.42 | 2026-10-16 | Temporary P0–P6 close-out roadmap P0-1: `T-SWF-009` delivered and wired to its inventory (`packages/swf/test/fixture-inventory.test.ts`), so the last uncited P0 inventory obligation is evidence rather than a substance claim. P0 stays **In progress**: `T-SWF-014/015/016/017`, the diagnostic-literal lint and the `UI32` disposition (`E-033`) remain |
| 1.43 | 2026-10-16 | Temporary P0–P6 close-out roadmap P0-4: the diagnostic-literal lint (`IMPL-010` §11.5) delivered and scope-ruled, and roadmap §6's P0 lint row now reads Delivered. The lint's first run migrated the 10 raw `code:` literals in `packages/assets/src/images/decode.ts` to `Codes.*` constants with no emitted value changed |
| 1.44 | 2026-10-16 | Temporary P0–P6 close-out roadmap P0-2 + P0-3: `WP-010-11` completed — `T-SWF-014`'s 10⁵-value fixed-point property test (writer extended with six encoders), `T-SWF-015`/`016` strengthened to their full contracts, and `T-SWF-017`/`SWF-R001` measured by the new named counter `allocationCounter` after three hot read paths (`float16`, `encodedU32`, `float32`/`float64`) were made allocation-free. P0's remaining items are the `UI32` disposition (`E-033`, a ruling) and the fresh closeout audit |
