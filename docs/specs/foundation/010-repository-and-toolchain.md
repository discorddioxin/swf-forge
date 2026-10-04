# REPO — Repository Layout, Packages, and Toolchain

**Doc ID:** REPO · **Status:** Draft 1.1 · **Normative:** yes

---

## 1. Scope

This document fixes the physical and logical shape of the codebase: directory layout, package
boundaries, dependency direction, TypeScript configuration, build and test tooling, determinism
rules, and contribution mechanics. It exists so that eleven other specs can reference concrete
paths and package names instead of inventing them independently.

## 2. Layout

```
swf-forge/
├─ README.md
├─ docs/specs/                     ← this specification set
├─ packages/
│  ├─ swf/          @swf-forge/swf          SWF container + tag parser, shapes/audio/font bit readers
│  ├─ avm1/         @swf-forge/avm1          AVM1 bytecode decode, IR, and the runtime semantics
│  ├─ compiler/     @swf-forge/compiler      Passes, codegen, asset compilation, reporters
│  ├─ cli/          @swf-forge/cli           `swfforge` executable
│  ├─ runtime/      @swf-forge/runtime       Boot shell, asset loading, clock, input, embedding API
│  ├─ gfx/          @swf-forge/gfx           WebGL2 renderer, tessellation, text, filters
│  ├─ audio/        @swf-forge/audio         Web Audio engine, worklet, stream sync
│  ├─ assets/       @swf-forge/assets        Manifest types, loaders, integrity checks
│  └─ testing/      @swf-forge/testing       Oracle harness, golden-image tools, fixture utils
├─ fixtures/                       ← test inputs only; see §8 for size policy
├─ tools/                          ← repo scripts (codegen of tables, release helpers)
└─ examples/                       ← tiny hand-written games exercising the host API directly
```

Rules:

- **REPO-R001** Every package MUST have `package.json` with `"type": "module"`, an `exports` map, and
  `"sideEffects": false` unless it provably has side effects (documented in its README).
- **REPO-R002** Packages MUST NOT import from another package's `src/` path; only published entry
  points via the `exports` map. ESLint enforces this (`no-restricted-imports`).
- **REPO-R003** `packages/*/src` MUST be free of browser globals unless the package's README declares
  it browser-only (`gfx`, `audio`, `runtime` are browser-only; `swf`, `avm1` front end, `compiler`
  MUST run in Node without DOM shims).
- **REPO-R004** No package outside `cli` and `compiler` may read the filesystem or spawn processes.

## 3. Dependency direction

```
            cli
             │
         compiler ─────────────► swf
             │  │                 │
             │  └────► avm1 (front end) ◄┘
             │
     runtime (host shell) ──► avm1 (runtime) ──► gfx, audio, assets
                                 │
                              assets
```

- **REPO-R005** Edges MUST point downward in the diagram above; cycles are forbidden, including
  type-only cycles (use `import type` and, if a genuine cycle remains, split the package).
- **REPO-R006** `@swf-forge/gfx` and `@swf-forge/audio` MUST NOT depend on `@swf-forge/avm1`.
  They expose plain data APIs; the AVM1 runtime adapts to them. This keeps the renderer and mixer
  reusable and independently testable (and keeps GFX/AUD specs free of VM concerns).
- **REPO-R007** `@swf-forge/avm1` MUST NOT depend on `@swf-forge/compiler` at runtime, and
  `@swf-forge/compiler` MUST NOT depend on `@swf-forge/runtime`. The emitter may import *types*
  from `runtime` only via a dedicated `@swf-forge/runtime/contract` entry point that contains no
  code (interfaces, const enums as literals).

The `contract` entry point is the single place where build-time and run-time agree on shapes. It
contains Zod-free, dependency-free TypeScript interfaces mirroring AST-§5 and AVM1-§8.

## 4. Naming

| Kind | Convention | Example |
| --- | --- | --- |
| Files | `kebab-case.ts` | `tag-reader.ts` |
| Emitted game files | `PascalCase.ts` for timelines/classes, `kebab-case` for runtime glue | `Main.ts`, `Main.symbols.ts` |
| Types/interfaces | `PascalCase`, no `I` prefix | `SwfShape` |
| Functions | `camelCase`, verb-first | `readStyleChangeRecord` |
| Constants | `SCREAMING_SNAKE_CASE` for true constants | `TWIPS_PER_PIXEL` |
| Diagnostics | `SF####` numeric codes | `SF0501` (CMP-§9) |
| Test IDs | `T-<DOC>-<nnn>` | `T-GFX-015` |
| Decisions | `<DOC>-D<nn>` | `ARCH-D03` |

**REPO-R008** `TWIPS_PER_PIXEL = 20` MUST be defined exactly once per package lineage in
`@swf-forge/swf` and re-exported; no literal `20` for twip conversion may appear elsewhere.

## 5. TypeScript configuration

The root `tsconfig.base.json`:

```jsonc
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitReturns": true,
    "useUnknownInCatchVariables": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": false,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "incremental": true
  }
}
```

Rules:

- **REPO-R009** `strict` MUST be on. `// @ts-ignore`, `// @ts-expect-error` (outside tests), `any`
  (outside FFI boundaries), and non-null assertions MUST be justified inline with a decision or
  requirement ID. ESLint bans them by default.
- **REPO-R010** Floating-point-sensitive code (AVM1 coercion, tessellation, resampling) MUST NOT
  rely on `Math.fround`/fast-math flags; JS doubles are the semantic model. Where float32 precision
  matters (GPU upload), the narrowing point MUST be explicit and documented.
- **REPO-R011** Emitted game code MUST compile under the same `strict` settings with **zero**
  suppressions. If the emitter cannot produce clean code for a construct, that is a compiler bug
  (or a residual-interpreter case), not a reason to emit `any`.
- **REPO-R012** `lib: ["ES2022"]` for non-browser packages; browser packages add `DOM` and
  `WebWorker`/`AudioWorklet` libs. `AudioWorklet` code is a separate tsconfig with
  `lib: ["ES2022", "WebWorker"]` and MUST NOT reference `window`.

## 6. Build and test tooling

| Concern | Choice | Notes |
| --- | --- | --- |
| Package bundling | `tsup` (esbuild) → ESM + `.d.ts` | CLI ships a Node build; browser packages ship ESM only |
| Type checking | `tsc --build` project references | CI runs `tsc -b --force` |
| Unit tests | `vitest` (node + jsdom + browser mode) | Browser-mode for GFX/AUD |
| Visual tests | Playwright + custom image diff | TST-§6 |
| Audio tests | `OfflineAudioContext` in Chromium via Playwright | AUD-§9 |
| Lint/format | ESLint (flat config) + Prettier | Import boundaries, no-`any`, unused-exports |
| API surface | API Extractor report in `etc/*.api.md` | Prevents accidental public API growth |
| Coverage | `vitest --coverage`, thresholds per package | Compiler ≥ 90%, gfx/audio ≥ 80% (`v8` provider) |
| Perf | `vitest bench` + Playwright perf harness | Gates in TST-§7 |

**REPO-R013** The emitted project MUST use only: the runtime packages, the standard library, and
zero third-party runtime dependencies. If a game needs a helper, it goes in the runtime, not in the
emitted tree.

**REPO-R014** The runtime packages MUST have zero third-party runtime dependencies, with exactly
these permitted exceptions, each isolated behind an adapter and licensed per SEC-§5:
audio codecs that cannot be implemented in-repo (e.g. an Opus or Speex decoder), and a
WASM-based image/font decoder if required. Every exception needs an entry in SEC-§5's table.

## 7. Determinism rules

**REPO-R015** Any process that writes build output MUST be deterministic: identical inputs produce
byte-identical outputs. Concretely:

| Source of nondeterminism | Rule |
| --- | --- |
| Object key order | Sort keys before serialising JSON; never rely on `for…in` for output |
| Set/Map iteration | Iterate in insertion order, and *establish* insertion order from sorted or source-ordered data |
| Parallel pass completion | Collect results into ordered arrays; never write files from worker completion callbacks |
| Timestamps | Never embed dates. `--reproducible` is the default; `--stamp` adds a version string only |
| Absolute paths | Emit paths relative to the project root; normalise `\` to `/` |
| Floating point | Avoid associative reordering of sums (e.g. atlas packing cost) across runs; if a sort is required, make it total by tie-breaking on a stable key |
| Randomness | Compiler MUST NOT use `Math.random`; any tie-break uses a seeded PRNG with a documented seed |
| Locale | Use `toFixed`/`toString` only with explicit radix/locale-independent formatting |

**REPO-R016** Emitted file order MUST be: manifest keys sorted lexicographically; resource modules
sorted by handle name; timeline modules in character-id order.

## 8. Fixtures policy

**REPO-R017** `fixtures/` MUST NOT contain assets we cannot redistribute. Default policy:

- Hand-authored and public-domain SWFs (own work, e.g. compiled from open-source AS2 examples
  with a compatible licence) are committed, under `fixtures/open/`, with provenance recorded in
  `fixtures/PROVENANCE.md`.
- Third-party SWFs used for oracle testing are **not** committed; `fixtures/external/*.md` records a
  URL, SHA-256, expected size, and licence note, and a fetch script populates a gitignored
  `fixtures/.cache/` at test time. Tests that need them are skipped, not failed, when absent —
  except in the `conformance` CI job, which fails if the fixture set is incomplete (TST-§3).
- No fixture may exceed 20 MiB committed; large ones use the external mechanism.

## 9. Contribution rules

- **REPO-R018** A change MUST reference the requirement IDs it implements or amends.
- **REPO-R019** A change that makes an implementation diverge from its spec MUST update that spec's
  Decision register in the same pull request, or the PR is rejected.
- **REPO-R020** New public API requires an API Extractor report update and a note in the package
  README.
- **REPO-R021** Commit messages follow `area: imperative summary` where `area` is a doc ID
  (`GFX`, `AUD`, …) or package name.

## 10. CI stages

| Stage | Runs | Gate |
| --- | --- | --- |
| `lint` | ESLint, Prettier check, API Extractor | zero errors |
| `types` | `tsc -b --force` | zero errors |
| `unit` | vitest node | 100% of tagged unit requirements |
| `browser` | vitest browser mode + Playwright smoke | zero failures |
| `conformance` | oracle harness on the conformance fixture set | TST-§6 thresholds |
| `perf` | perf harness on a fixed scene set | TST-§7 budgets, ≤ 5% regression vs. main |
| `emit` | build a fixture game, verify it compiles with zero suppressions and boots | C0 gate |

## 11. Decision register

| ID | Decision | Default | Verification | Notes |
| --- | --- | --- | --- | --- |
| REPO-D01 | pnpm vs npm workspaces | pnpm | CI consistency | npm workspaces acceptable if lockfile reproducible |
| REPO-D02 | Emit one file per timeline even for 1000-frame timelines? | Yes, with `//#region frame N` markers | Emitter review | Alternative: split at 2000 lines; revisit |
| REPO-D03 | `--stamp` default off but always on for release builds? | Off by default | REPO-R015 | Releases may stamp a version, never a date |
| REPO-D04 | Committed examples must compile in CI? | Yes | `emit` stage | Keeps the host API honest |
| REPO-D05 | Are `etc/*.api.md` review files committed? | Yes | CI `lint` | Prevents silent API growth |
| REPO-D06 | Asset deduplication in the emitted project | Content-hashed filenames; one file per unique payload, many manifest entries | byte-identical payload check in `verify` | Referenced by `IMPL-120` R020 |

## 12. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | initial | First draft |
| 1.1 | 2026-10-04 | Decision `REPO-D06` (asset deduplication: one file per unique payload, many manifest entries) added; it resolves the `REPO-D09` citation that `IMPL-120` R020 carried |
