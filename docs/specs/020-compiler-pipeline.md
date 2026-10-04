# CMP — Compiler Pipeline, IR, Codegen Contract, CLI

**Doc ID:** CMP · **Status:** Draft 1.1 · **Normative:** yes

---

## 1. Scope

`swfforge` reads a `.swf` (plus optional configuration and overrides) and writes a TypeScript
project, an asset directory, a manifest, and reports. This document specifies the pipeline stages,
their inputs/outputs, the intermediate representations, the emitted-code contract, the command
line, the diagnostics model, and the guarantees (determinism, caching, incremental builds).

Graphics conversion is specified in GFX, audio in AUD, other assets in AST, VM semantics in AVM1.
This document specifies how those are *sequenced and wired*.

## 2. Pipeline overview

```
 S0  Load            read bytes, detect SWF, decompress, validate header
 S1  Parse           tag stream → TagIndex; dictionary of characters as lazy views
 S2  Analyse         build timeline model, sprite tree, symbol table, linkage map
 S3  Media decode    shapes→Vector IR · sounds→PCM · bitmaps→raw · fonts→glyphs · video→frames
 S4  Media encode    Vector IR (kept) · PCM→Opus/AAC/MP3 · bitmaps→KTX2/WebP · fonts→WOFF2/MSDF
 S5  VM front end    AVM1 bytes → ActionIR (CFG, SSA-lite) per action block
 S6  VM analyse      name/type recovery, host-API binding, tier assignment, residual marking
 S7  Emit TS         timelines, classes, resources, entry point, source maps
 S8  Emit assets     files + manifest (hashes, metadata, stream tables, sprite rects)
 S9  Report          diagnostics, porting notes, divergence list, budgets, risk summary
 S10 Verify          `swfforge verify` re-parses the emitted project and checks invariants (TST-§4)
```

**CMP-R001** Stages MUST execute in this order. S3–S4 MAY be interleaved per asset for memory
reasons, but observable output MUST be as if the order above were used.

**CMP-R002** Every stage MUST be a pure function of its declared inputs. Stages MUST NOT read
global state, environment variables (except as recorded in `forge.config.json`), or the clock.

**CMP-R001b** The stages above are the **flash target**. The **clean target** (`CLN`) consumes the
same model and `ActionIR` and emits a different project shape (scenes/entities, one fixed-step loop,
no timeline model); both targets share assets byte-for-byte (`TECH-R006`). Target selection is a
configuration value (`--target flash|clean|both`), and the decompilation half (S0–S2, S5–S6) MUST be
identical for both.

**CMP-R003** Every stage MUST declare an explicit *effect set* (files read/written) so the cache
key of a stage is computable from content hashes alone.

## 3. Configuration

`swf-forge.config.ts` (preferred) or `swf-forge.config.json` at the project root, plus CLI flags
which take precedence. Type shape (abridged; the full type lives in `@swf-forge/runtime/contract`):

```ts
export interface ForgeConfig {
  /** Input SWF or a directory of SWFs (multi-movie titles). */
  input: string | { main: string; others?: string[] };
  /** Output project directory. */
  outDir: string;
  /** Target runtime feature level. */
  target: 'baseline-2020' | 'modern';
  graphics: {
    /** Master switch for the WebGL path (see GFX-§2). */
    maxDrawCalls: number;
    textureFormat: 'auto' | 'ktx2-etc2' | 'ktx2-astc' | 'webp' | 'png';
    atlas: { enabled: boolean; maxSize: 2048 | 4096 | 8192; padding: number };
    /** Pixel-snapping behaviour: 'flash' emulates Flash Player, 'none' for crisp modern output. */
    settle: 'flash' | 'none';
    antialias: 'msaa4' | 'msaa8' | 'analytic';
    filters: 'on' | 'off' | 'tolerance';
  };
  audio: {
    sampleRate: 44100 | 48000;
    codec: 'auto' | 'opus' | 'aac' | 'mp3-passthrough';
    bitrate: { music: number; sfx: number };     // kbps
    resampler: 'swr' | 'internal';
    /** Loudness handling; default preserves authored levels (AUD-§4.6). */
    loudness: 'off' | 'ebu';
    streamLookaheadMs: number;
  };
  vm: {
    /** Interpreter fallback policy for residual code (AVM1-§9). */
    residual: 'forbid' | 'on-demand' | 'always';
    /** Acceptable AVM1 skews, each with a diagnostic code (AVM1-§11). */
    allow: string[];
  };
  network: {
    /** Runtime network policy for URLs the compiler cannot virtualise (RT-§6). */
    policy: 'deny' | 'allowlist' | 'all';
    allowlist?: string[];
  };
  diagnostics: { maxWarnings: number; failOn: 'error' | 'warning' | 'risk' };
  reproducible: boolean;
}
```

**CMP-R004** The resolved configuration MUST be written to `forge.config.json` in the output,
omitting defaults that the tool version's own defaults would reproduce, and including a
`$schemaVersion`.

**CMP-R005** Unknown configuration keys MUST be errors, not warnings. Typos in config are the most
common cause of "the build ignored my setting".

## 4. Stage detail

### 4.1 S0 Load (SWF-§3)

- Reads the file as a `Uint8Array`; detects `FWS`/`CWS`/`ZWS`; decompresses `CWS` (zlib) and `ZWS`
  (LZMA) into a contiguous buffer; verifies `FileLength` against decompressed size.
- Does **not** yet interpret tags.

### 4.2 S1 Parse (SWF-§4)

- Produces `TagIndex`: an array of `{ code, offset, length }` plus a lazily decoded tag payload
  accessor. Payload decoding is demand-driven by later stages to bound memory.
- Builds the *dictionary*: character id → definition (lazy payload), and the sprite tree.
- Rejects files with AVM2 content (`DoABC` + `FileAttributes.AS3`) with a clear diagnostic
  (CMP-R030) rather than attempting a partial compile.

### 4.3 S2 Analyse

Produces the **Movie Model**:

```ts
/** One SWF file. */
export interface MovieModel {
  readonly id: string;                   // content-hash-derived, stable
  readonly stage: { widthTwips: number; heightTwips: number; frameRate: Fixed8_8 };
  readonly frameCount: number;
  readonly background: number;           // 0xRRGGBB
  readonly characters: ReadonlyMap<number, CharacterModel>;
  /** Linkage id → character id (ExportAssets / SymbolClass for AVM1 exports). */
  readonly exported: ReadonlyMap<string, number>;
  readonly mainTimeline: TimelineModel;
  readonly initActions: readonly ActionBlock[];    // DoInitAction
  readonly metadata: Readonly<Record<string, string>>;  // Metadata / ProductInfo / XMP if present
}

export interface TimelineModel {
  readonly frames: readonly FrameModel[];
  readonly labels: ReadonlyMap<string, number>;   // label → frame index
  readonly sounds: StreamSoundModel | null;       // SoundStreamHead*/Block
}

export interface FrameModel {
  readonly index: number;
  readonly placements: readonly PlacementOp[];    // PlaceObject*, RemoveObject*, in file order
  readonly actions: readonly ActionBlock[];       // DoAction, in file order
  readonly label: string | null;
  readonly soundBlock: { offset: number; length: number } | null;  // into the stream
}
```

**CMP-R006** `PlacementOp` MUST preserve file order and carry the SWF tag kind so the emitter can
distinguish `PlaceObject` (v1, implicit replace) from `PlaceObject2` (flags) from `PlaceObject3`
(filters/blend). Order is semantic: two placements at the same depth in one frame resolve by file
order.

### 4.4 S3 Media decode, S4 Media encode

Refer to GFX-§4 (shapes), AUD-§3 (sounds), AST-§3–§4 (bitmaps, fonts, video). Pipeline-level
requirements:

**CMP-R007** Decoders MUST be total: a malformed payload yields a diagnostic plus a defined
placeholder (empty shape, silent sound, 1×1 magenta texture) so that one broken asset cannot make
the whole title uncompilable.

**CMP-R008** Encoders MUST be deterministic and MUST record, per asset, an `EncodeReport`
(input hash, encoder version, settings, decoded duration/size) so that a re-encode is auditable and
cacheable.

**CMP-R009** Asset compilation MUST be parallelisable across assets with a bounded worker pool, but
output order and bytes MUST NOT depend on scheduling.

### 4.5 S5 VM front end (AVM1-§4)

- Splits action streams into `ActionBlock`s (one per `DoAction`, per button handler, per clip event,
  and per `DefineFunction*` body).
- Builds a CFG, performs stack-effect analysis, constant-pool resolution (`ConstantPool`), register
  promotion (`DefineFunction2` registers), and produces `ActionIR`: typed basic blocks with a
  stack model that has been partially evaluated into *named temporaries*.

**CMP-R010** The front end MUST be conservative: if a block cannot be analysed (dynamic jump,
unknown opcode, stack underflow that could be intentional obfuscation), it MUST mark the enclosing
function `residual` rather than guessing.

**CMP-R011** Unknown opcodes MUST be reported with byte offset and a byte dump (≤32 bytes) and MUST
make the enclosing function residual; they MUST NOT be silently skipped.

### 4.6 S6 VM analyse

For each function/block:

1. **Host-API binding** — resolve `MovieClip.prototype.gotoAndPlay` style call sites and
   `Object.registerClass` mappings to host API entries (AVM1-§8). Unknown host calls become
   residual or a diagnostic depending on reachability.
2. **Name recovery** — from `SymbolClass`, `ExportAssets`, frame labels, `__proto__`/prototype
   chains, `Object.registerClass` string literals, and `#initclip`-style patterns; unmatched names
   get deterministic synthetic names (`Clip_12`, `fn_0007_03`).
3. **Tier assignment** — T0/T1/T2 per function (AVM1-§9).
4. **Semantics checks** — flag patterns that are known to be sensitive (dynamic `eval`, `call()`
   with a computed target, `with` over a computed object, `for…in` mutation during iteration,
   `sort` comparators that are not total orders).
5. **Dead code** — only statically-unreachable blocks may be removed, and only when
   `--prune-dead-code` is set, with the removal listed in the report.

### 4.7 S7 Emit TypeScript

Output tree (fixed order for determinism):

```
outDir/
  forge.config.json
  forge.manifest.json
  assets/…
  src/
    main.ts
    movies/<Name>.ts            one per timeline (main, sprites, button timelines)
    movies/<Name>.symbols.ts    linkage table for that timeline's symbols
    movies/<Name>.events.ts     button/clip event bindings
    classes/<ClassName>.ts      recovered AS2 classes
    resources/textures.ts
    resources/sounds.ts
    resources/fonts.ts
    resources/videos.ts
    resources/index.ts
  reports/porting-notes.md
  reports/divergence.json
  reports/budgets.json
  reports/risk.json
```

**CMP-R012** Emitted modules MUST be valid TypeScript under `strict` with no suppressions
(REPO-R011) and MUST import only from `@swf-forge/*` and each other.

**CMP-R013** Every emitted file MUST begin with a generated header:

```ts
/* eslint-disable */
// AUTO-GENERATED by swf-forge <version> — DO NOT EDIT.
// Source: game.swf (sha256:1f0c…)  Movie: main  Timeline: Main (sprite 12)
// Regenerate: npx swfforge build game.swf --out .
// Manual edits are overwritten. To patch behaviour, use swf-forge.overrides.ts (CMP-§9.5).
```

**CMP-R014** Source maps MUST map emitted statements to `{ file: 'game.swf', offset: <byte> }`
plus a symbolic scope name. `--sourcemap=inline|file|none` controls emission (default `file`).

### 4.8 S8 Emit assets (AST-§5)

Manifest entries are content-addressed: `assets/tex/<sha256[0:16]>.ktx2` with a stable logical name
in the manifest. Logical names come from linkage ids, export names, or `id_<characterId>`.

### 4.9 S9 Report

`reports/divergence.json` — machine-readable, one entry per known divergence:

```jsonc
{
  "$schema": "https://swf-forge.dev/schema/divergence-1.json",
  "movie": { "file": "game.swf", "sha256": "…" },
  "entries": [
    {
      "decision": "GFX-D04",              // Decision register ID
      "fidelity": "F3",                    // declared level
      "scope": { "kind": "character", "id": 42, "name": "heroIdle" },
      "summary": "Gaussian blur approximated by 3 box passes; σ=blurX/2",
      "measured": { "metric": "ssim", "value": 0.997, "threshold": 0.99 },
      "actionRequired": false
    },
    {
      "decision": "AVM1-D07",
      "fidelity": "F4",
      "scope": { "kind": "function", "offset": 18422 },
      "summary": "residual bytecode retained for dynamic eval(); interpreter linked",
      "actionRequired": true
    }
  ]
}
```

`reports/porting-notes.md` — the human summary: what was recovered, what was approximated, what
needs a human decision, plus a table of **porting hooks** (CMP-§9.5) the porter may override.

`reports/budgets.json` — predicted budgets per TST-§7 (draw calls, texture memory, audio decode
time, bundle size) with estimates marked as estimates.

### 4.10 S10 Verify

`swfforge verify <project>` parses the emitted project (not just the SWF) and checks:

| Check | Failure |
| --- | --- |
| Every `assets/` file is referenced by the manifest and vice versa | error |
| Every manifest hash matches the file | error |
| Every resource handle referenced by `src/**` exists | error |
| No emitted file contains `eval`, `new Function`, `document.write`, `innerHTML` | error (SEC-§3) |
| Emitted project compiles under `tsc --strict` | error in CI |
| Declared budgets are within TST-§7 targets | warning |
| Divergence list is complete w.r.t. decision IDs cited in emitted code | warning |

## 5. Intermediate representations

### 5.1 Vector IR (owned by GFX, produced here)

```ts
export interface VectorShape {
  readonly id: number;
  readonly fillStyles: readonly FillStyle[];
  readonly lineStyles: readonly LineStyle[];
  /** Subpaths in shape coordinates (twips, Y down). */
  readonly paths: readonly Path[];
  readonly bounds: Rect;
  /** Morph targets, when this shape came from DefineMorphShape*. */
  readonly morph?: { start: VectorShape; end: VectorShape };
  readonly scalingGrid?: Rect;              // DefineScalingGrid (9-slice)
}

export interface Path {
  readonly start: Vec2;
  readonly segments: readonly Segment[];    // MoveTo folded into start
  readonly fill0: number | null;            // style index (1-based) or null
  readonly fill1: number | null;
  readonly line: number | null;
  readonly closed: boolean;                 // true when the run was implicitly closed
}

export type Segment =
  | { kind: 'line'; to: Vec2 }
  | { kind: 'quad'; control: Vec2; to: Vec2 };   // SWF curved edges are quadratic
```

**CMP-R015** The Vector IR MUST NOT bake in a tessellation resolution. Tessellation happens at
runtime (GFX-§5) or, optionally, at build time only for shapes explicitly marked static by config.

**CMP-R016** Fill runs MUST be preserved exactly as authored (style-change boundaries), because
Flash's even-odd/nonzero behaviour and its anti-aliasing seams depend on run structure
(GFX-D02).

### 5.2 Action IR (owned by AVM1, produced here)

Defined in AVM1-§5.3. From the pipeline's perspective: an `ActionIR` unit is either a
`TimelineScript`, a `ClipEventHandler`, a `ButtonHandler`, a `FunctionBody`, or a `ClassMethod`,
and carries `tier`, `residual`, `sourceRange`, and `requirements` (which host API groups it uses,
used for tree-shaking and budgets).

## 6. Emitted code contract

### 6.1 Structure of a compiled timeline

```ts
// src/movies/Main.ts  (generated)
import { defineTimeline, type Timeline } from '@swf-forge/runtime/contract';
import { frame0Actions, frame12Actions } from './Main.actions';
import { onEnterFrame_hero } from './Main.events';

export const Main: Timeline = defineTimeline({
  id: 'main',
  frameRate: 24,
  frameCount: 240,
  background: 0x000000,
  labels: { intro: 0, play: 12 },
  frames: [
    { labels: ['intro'], ops: [ /* placements */ ], actions: [frame0Actions] },
    // …
  ],
  sounds: { stream: 'music_intro', frames: [/* … */] },
});
```

**CMP-R017** Placement ops in emitted code MUST be declarative data (arrays of plain objects), not
imperative calls, so that the runtime can pre-process and batch them (GFX-§11) and so that the
emitted file is diffable.

**CMP-R018** Action scripts MUST be emitted as ordinary exported functions with explicit
parameters:

```ts
// src/movies/Main.actions.ts (generated)
import { $ } from '@swf-forge/avm1';         // memoised globals/scope helpers
import type { Clip } from '@swf-forge/avm1';

export function frame12Actions(self: Clip, root: Clip, _global: Global): void {
  const hero = self.getMember('hero');            // literal member access → direct
  hero.setMember('_x', 120 + 20 * Math.sin($.getTimer() / 1000));
  if (self.getMember('score') > 10) {
    self.callMethod('gotoAndStop', ['win']);
  }
}
```

**CMP-R019** The emitter MUST prefer *direct* forms over generic ones wherever the front end proves
the operand kind:

| Situation | Emit | Do not emit |
| --- | --- | --- |
| Static property read | `clip.prop` via generated getter | `getMember("prop")` |
| Static method call | `clip.gotoAndPlay(3)` | `callMethod('gotoAndPlay', [3])` |
| Known numeric literal | `Math.round(x * 3)` | runtime helper call |
| Known `_root`/`_parent` chain | `root`, `self.parent` | `resolveTarget('_root')` |
| Dynamic member | `obj.getMember(expr)` | — |

**CMP-R020** Member access MUST still route through runtime accessors when the object may be a
dynamic AVM1 object (because `getMember` participates in prototype chains and `__resolve`). Only
typed host-API objects (a `MovieClip` with a statically-known property from a closed set) may use
direct property syntax. The exact rule set is AVM1-§7.6.

**CMP-R021** Emitted code MUST NOT use `eval`, `with`, `arguments` introspection, `Function`
constructors, or `Proxy`. Residual behaviour is handled by the interpreter module, not by clever
JS.

**CMP-R022** Emitted code MUST be free of per-frame allocations where avoidable; timelines use
frozen literal arrays, and per-frame temporaries appear in a `const` pool inside the frame function.

### 6.2 Emitted project entry point

```ts
// src/main.ts (generated)
import { createGame } from '@swf-forge/runtime';
import manifest from '../forge.manifest.json' with { type: 'json' };
import { Main } from './movies/Main';
import * as resources from './resources';

export const game = createGame({
  manifest,
  resources,
  timelines: { main: Main },
  stage: { width: 550, height: 400, scaleMode: 'showAll', align: 'center' },
});

// Opt-in embedding hooks (RT-§8)
if (import.meta.env?.PROD !== true) { void game.run(); }
```

**CMP-R023** `src/main.ts` MUST be side-effect-free on import except for registering the game; the
integrator calls `game.run()` (or uses the generated `<swf-forge-game>` custom element, RT-§8.3).

### 6.3 Resource modules

```ts
// src/resources/textures.ts (generated)
import { defineTextures } from '@swf-forge/assets';
export const textures = defineTextures({
  heroIdle: { file: 'assets/tex/9c1e77b0a4f2d318.ktx2', size: [64, 64], variants: ['etc2', 'astc-fallback'] },
  tileset:  { file: 'assets/tex/1ab3c05de9a7b264.ktx2', size: [1024, 1024], mips: 11 },
} as const);
export type TextureName = keyof typeof textures;   // 'heroIdle' | 'tileset'
```

**CMP-R024** Resource modules MUST export a `const` object plus a derived name union type, so that
`textures.heroIdl` is a compile error (AST-§5.4).

## 7. Residual handling and tiering

**CMP-R025** Tier assignment rules (implemented in S6, specified in AVM1-§9):

| Tier | Condition | Emitted as |
| --- | --- | --- |
| T0 | Fully static control flow, all operands provably resolvable | TS statements |
| T1 | Static control flow graph, dynamic values | TS block state machine (`switch (block)` loop) |
| T2 | `eval`-like, `call()` on dynamic target, `with` on dynamic object, unknown opcode | Bytecode blob + interpreter |

**CMP-R026** A `T2` function MUST be accompanied by: the original byte count, the reason, and a
`reports/` entry citing the decision ID. `--vm.residual=forbid` MUST fail the build instead.

**CMP-R027** The interpreter MUST be a separate import path so bundlers can drop it:

```ts
import { createInterpreter } from '@swf-forge/avm1/interp';  // only emitted when needed
```

## 8. CLI

```
swfforge build <input.swf> [options]
swfforge inspect <input.swf> [--tags] [--symbols] [--actions] [--json]
swfforge verify <projectDir>
swfforge report <projectDir> [--budgets] [--divergence]
swfforge diff <a.swf> <b.swf> [--structural]
swfforge fetch-fixtures                 # test fixtures only
```

| Flag | Default | Meaning |
| --- | --- | --- |
| `--out <dir>` | `./out` | Output project directory |
| `--config <file>` | auto-detect | Config file |
| `--graphics.max-draw-calls <n>` | 700 | Batch budget target (GFX-§16) |
| `--audio.codec <c>` | `auto` | Force codec (AUD-§4) |
| `--vm.residual <mode>` | `on-demand` | `forbid`, `on-demand`, `always` |
| `--network.policy <p>` | `deny` | RT-§6 |
| `--sourcemap <m>` | `file` | `none`, `file`, `inline` |
| `--prune-dead-code` | off | Remove statically unreachable action blocks |
| `--max-warnings <n>` | 200 | Fail after n warnings |
| `--fail-on <level>` | `error` | `error`, `warning`, `risk` |
| `--reproducible` | on | REPO-R015 |
| `--jobs <n>` | `cpus-1` | Worker pool size |
| `--dry-run` | off | Analyse and report, write nothing |

**CMP-R028** Every flag MUST have a matching `forge.config.json` field, and the CLI MUST print the
fully resolved effective configuration at `--verbose` level 1.

**CMP-R029** Exit codes: `0` success; `1` build failed (error diagnostics); `2` input unreadable or
not a SWF; `3` AVM2 content; `4` budget/`fail-on` threshold exceeded; `5` internal error (always
accompanied by a crash bundle the user can attach to an issue).

## 9. Diagnostics model

### 9.1 Shape

```ts
export interface Diagnostic {
  code: `SF${number}`;              // stable, see APP-§8
  severity: 'error' | 'warning' | 'info' | 'risk';
  message: string;                  // one sentence, no trailing period
  detail?: string;                  // multi-line context: hex dump, tag dump, call stack
  scope: DiagnosticScope;           // { file, offset, tag, character, symbol, actionOffset }
  decision?: string;                // decision register ID when divergence-related
  requirement?: string;             // e.g. 'GFX-R044'
  hints: readonly string[];         // concrete next actions, e.g. '--vm.residual=forbid'
  docs?: string;                    // URL to the spec anchor
}
```

**CMP-R030** Diagnostics MUST be emitted as `json` with `--json`, as human text otherwise, and MUST
be sorted by (severity, file offset). Never by discovery order.

### 9.2 Severity policy

| Severity | Meaning | Build outcome |
| --- | --- | --- |
| `error` | Output would be wrong or unusable | Fail (exit 1) unless `--fail-on` loosened by explicit user choice |
| `warning` | Output likely wrong in some paths; user should look | Continue; counts toward `--max-warnings` |
| `info` | Noteworthy, expected | Continue |
| `risk` | Compiles, but a known fidelity risk exists (e.g. unstable sort, dynamic depth) | Continue; counted in `risk.json`; `--fail-on=risk` promotes |

**CMP-R031** AVM2 detection is a hard error (exit 3) with code `SF1000` and a message naming the
`DoABC` tag offset and the `FileAttributes` flags — because silently compiling nothing is worse
than refusing.

### 9.3 Stable code ranges

| Range | Area |
| --- | --- |
| `SF0001–0099` | IO, container, compression |
| `SF0100–0199` | Tags, shapes, dictionary |
| `SF0200–0299` | Bitmaps, fonts, video |
| `SF0300–0399` | Audio |
| `SF0400–0499` | AVM1 decode/analysis |
| `SF0500–0599` | Emitter/codegen |
| `SF0600–0699` | Runtime contract, manifest |
| `SF0700–0799` | Security/policy |
| `SF1000+` | Reserved for fatal, non-recoverable conditions |

## 10. Network and URL virtualisation

Old games call `loadMovieNum("levels/level2.swf", 1)`, `loadVariables("scores.php")`,
`new XMLSocket("…")`, `getURL("http://…")`.

**CMP-R032** The compiler MUST classify every literal URL it can prove:

| Class | Example | Compile-time action |
| --- | --- | --- |
| Bundled sibling SWF | `loadMovie("part2.swf")` | Compile sibling if present in `input.others`; emit `loadMovie('part2')` against the manifest |
| Bundled asset | `loadSound("music.mp3")` | Hash to a `SoundHandle` if present in the input set |
| Data endpoint | `.php`, `.asp`, `.cgi`, unknown | Rewrite to a `NetworkPolicy`-gated `fetch`; diagnostic `SF0703` (warning) |
| External site | `http://`, `https://` | `getURL` → `openExternal()` gated by policy; diagnostic `SF0702` (info/risk) |
| Local file / `file:` | rare | Diagnostic `SF0704` (error under default policy) |

**CMP-R033** Unprovable (computed) URLs MUST emit a runtime call into `NetworkPolicy` with the
computed string; the policy denies by default and logs once per distinct URL
(deduplicated) to avoid log floods.

**CMP-R034** `XMLSocket` / `LocalConnection` / `SharedObject` MUST be mapped to the documented
runtime shims (RT-§6.3) with a diagnostic explaining the behavioural delta.

## 11. Porting hooks (escape hatches)

**CMP-R035** The emitted project MUST support a hand-written sidecar that overrides compiled
behaviour without editing generated files:

```ts
// swf-forge.overrides.ts  (hand-written by the porter; NOT generated)
import { defineOverrides } from '@swf-forge/runtime';

export default defineOverrides({
  /** Replace an emitted timeline function. */
  'movies/Main.actions:frame12Actions': (ctx, next) => {
    if (ctx.config.get('difficulty') === 'easy') { ctx.root.setMember('lives', 9); }
    return next();
  },
  /** Patch a recovered class method. */
  'classes/Player:takeDamage': (ctx, next, amount: number) => next(Math.min(amount, 5)),
  /** Pin a decision explicitly (records it in the divergence report). */
  decisions: { 'AVM1-D07': 'accepted' },
});
```

**CMP-R036** Overrides MUST be applied by generated call sites that are *optional at build time*:
if `swf-forge.overrides.ts` is absent, the emitted code MUST NOT reference it (so the project still
compiles).

**CMP-R037** The override mechanism MUST be fail-loud: an override key that matches no emitted
symbol is an error at runtime boot, not a silent no-op.

## 12. Caching and incremental builds

- Cache directory: `.forge/cache/` (gitignored by default), keyed by
  `sha256(stageId ‖ stageInputHash ‖ toolVersion ‖ relevantConfigHash)`.
- **CMP-R038** A cache entry MUST store the full stage output plus its declared effect set so a
  stale entry can be detected and evicted.
- **CMP-R039** `--no-cache` MUST be available and MUST be used by CI's reproducibility job.
- **CMP-R040** Cache hits MUST NOT change output bytes (verify in CI by comparing cached and
  uncached builds).

## 13. Acceptance criteria

**CMP-R041** For the fixture set, the compiler MUST satisfy:

| Criterion | Target |
| --- | --- |
| Determinism | Two clean builds byte-identical (`T-CMP-001`) |
| Emitted TS quality | Zero suppressions; zero `any` outside `unknown`-guarded shims (`T-CMP-002`) |
| Diagnostics | Every `risk`/`warning` carries a decision ID or requirement ID (`T-CMP-003`) |
| Residual reporting | Every T2 function has a reason string and byte range (`T-CMP-004`) |
| Verify pass | `swfforge verify` clean on all C1 fixture builds (`T-CMP-005`) |
| Build time | ≤ 90 s for a 5 MiB SWF on the CI baseline runner, warm cache (`T-CMP-006`) |

## 14. Decision register

| ID | Decision | Default | Verification | Notes |
| --- | --- | --- | --- | --- |
| CMP-D01 | Placements emitted as data vs. imperative calls | Data | CMP-R017 | Needed for pre-batching |
| CMP-D02 | Name-recovery conflict resolution | Deterministic suffixes `_2`, `_3` by definition order | T-CMP-007 | Never by hash (unreadable) |
| CMP-D03 | Are sprites' timelines pre-flattened when statically constant? | No (v1) | GFX budget review | Possible optimisation later |
| CMP-D04 | Max emitted file size before splitting | 4000 lines | REPO-D02 | Emitter must warn at split |
| CMP-D05 | `--fail-on=risk` default in CI? | Yes for `main` | CI config | Risk-aware CI |
| CMP-D06 | Interpreter blob encoding (base64 vs. Uint8Array literal) | Uint8Array literal (smaller after gzip) | size gate | Measure |
| CMP-D07 | Tolerate `FileLength` mismatch by re-scanning tags? | Yes with `warning` (SWF-D03) | SWF-§3 | Some old tools write wrong lengths |

## 15. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | First draft |
| 1.1 | 2026-10-04 | Tech-spec pass: `CMP-R001b` added — the S0–S10 pipeline is the flash target; the clean target shares S0–S2/S5–S6 and assets, and differs only in emission (`CLN`, `TECH-R006`) |
