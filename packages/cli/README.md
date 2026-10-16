# `@swf-forge/cli` — `swfforge`

The command layer for `IMPL-120` §6: `build`, `plan`, `inspect`, `verify`, `report`. `REPO-R004` makes
this package and the compiler the only ones allowed to touch the filesystem, so every byte-level decision
about *what* a build produces lives in `@swf-forge/compile` and this package owns only *where* it goes, what
the run reports, and which exit code a caller sees. That is not a thin layer: "only a clean run writes", "the
config file is read from the working directory only", "the stage cache is not inside `--out`" and "writes are
sorted, temp-named and rolled back" are four rules no stage can express, and they are the four this package
exists to hold (`IMPL-120` §6.1).

`"sideEffects"` lists the two entry points that run on import — `src/main.ts` and its compiled
`dist/main.js` — because a bin is a program: it reads `process.argv`, writes stdio and installs the `SIGINT`
handler. `main.ts` guards its own entry with `invokedAsBin()` so importing the library never starts a build.
Every other module is side-effect-free, which is what lets `test/cli.test.ts` call
`runCli({argv, cwd, io})` in-process with a captured sink, no child process, and no signal handlers.

## Commands

```
swfforge build <input.swf> [--out <dir>] [--config <file|->] [CMP §8 flags] [--dry-run] [--report-only]
swfforge plan <input.swf>                      # the run above in --dry-run: nothing is written
swfforge inspect <input.swf>… [--tags|--symbols|--timeline|--actions|--shapes|--images|--fonts|--sounds|--video] [--strict]
swfforge verify [dir] [--deep [--against <other-out-dir>]]
swfforge report [dir] [--budgets|--divergence]
```

All five take `--json`, `--verbose`, `--quiet`, `--help` and `--version`. `CMP` §8's dotted
(`--graphics.max-draw-calls`, `--vm.residual`, …) spellings are the parser's own names, and each entry in
`src/args.ts` states which `ForgeConfig` path, `RunSwitches` key or stage option it sets — a test feeds every
one of them through `resolveForgeConfig`, so `CMP-R028`'s "every flag has a config field" is a check rather
than an intention. A flag that cannot honour it is still accepted, and reported inert with its reason on every
run: `--jobs` and `--fail-on=risk` today, `--budget-strict` because only the residual-bytes budget is computed
in this phase (the other five rows are named as withheld in `build-info.json`), and
`--sourcemap`, which is consumed as an emit-stage option (`E-047`).

`--json` prints one envelope — `{command, exit, schemaVersion: 1, tool, …}` — with sorted keys and no
timestamps, and the human output is the same rows with their values formatted, never a second computation.

## Exit codes (`CMP-R029`)

| Code | Meaning |
| --- | --- |
| 0 | success |
| 1 | an `error`-severity diagnostic, a stage that threw, or a cancelled run |
| 2 | input unreadable or not a SWF (`SF0001`), a config that does not parse, a usage error, an unwritable output directory |
| 3 | AVM2 content (`SF1000`) |
| 4 | a threshold exceeded: `--max-warnings` and `--fail-on`, both counted in warning *occurrences* rather than table rows, and budgets under `--budget-strict` (inert in P6) |
| 5 | internal error — our bug, reported with the input that triggered it |

Precedence, which the table leaves open and a caller depends on: internal, then unreadable input, then the
AVM2 refusal, then errors, then thresholds. A crash explains why nothing else could be measured; a warning
threshold explains nothing about a broken build. A cancelled run is class 1, because the table has no
cancellation class and "the user stopped it" is not a failure of the input.

`IMPL-120`'s own exit rule printed a different table (1 "our bug", 4 "external tool missing", 5 "budget
exceeded"); `errata.md` `E-053` records the conflict, and this package follows the design spec that the
sibling `forge-decompile` already implements. A run interrupted by a second `SIGINT` exits `130` — the
shell's convention for "died of SIGINT" — rather than pretending to be one of these six verdicts.

## The crash bundle

Exit 5 is the code that says "report this", and the one fact a maintainer needs is the file that triggered it.
So a crash inside `build` writes `<outDir>/.swfforge-crash.txt` containing the tool version, the input's path,
size and sha256, and the stack. A dot-prefixed name in the output directory, because a crash report is not a
project file and no build script should glob it; `verify` skips dot-files for the same reason, so a crash
cannot become a finding about somebody's tree. `plan`, `inspect`, `verify` and `report` write nothing at all
and print the stack to stderr instead — a read-only verb that creates a directory to complain about a crash
would break the one promise that makes it safe to run anywhere.

## What a build writes

Only a run that completed with no `error` diagnostic writes, and it writes `@swf-forge/compile`'s file list
plus `forge.config.json` (the resolved config minus this version's defaults, `CMP-R004`). Nothing is created
otherwise: not a directory, not a partial project. `--report-only` narrows the write set to the report files,
which is the fastest way to see what a build decided without taking its output.

## Corpus evidence

`pnpm corpus:roundtrip` (and `:check`, which also diffs the committed report) runs this CLI over every committed
`.swf`, and `:open` adds the licensed corpus after re-hashing the cache: `plan`, `inspect`, a cold build, the same
build on a warm stage cache, the same build in a second workspace, `verify`, then `verify --deep --against`. The
answer is `audits/P6-CORPUS-ROUNDTRIP.json`, and the `determinism` CI job re-runs it. Two rules are worth knowing
from the inside: a project written by a clean run must verify **silent** (zero findings, not zero errors — that is
what `verify`'s symbol clause was fixed to mean), and the warning budgets above are counted in occurrences so that
one 52-byte fuzz input warning 92,680 times cannot pass as six warnings.
