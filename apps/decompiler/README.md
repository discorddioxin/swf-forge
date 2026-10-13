# `@swf-forge/decompiler` — `forge-decompile`

Reads a SWF and reports exactly what is in it: header, timeline, dictionary, tags and diagnostics.
This is the first component of the pipeline (`TECH-SPEC` §3.2) and the only one that is read-only by
construction.

## Run

```sh
pnpm build                       # tsc -b (builds workspace packages via project references)
node apps/decompiler/dist/main.js inspect path/to/movie.swf
node apps/decompiler/dist/main.js inspect path/to/movie.swf --json --actions
node apps/decompiler/dist/main.js analyze path/to/movie.swf --tiers --json
node apps/decompiler/dist/main.js dump    path/to/movie.swf --out dist/model
node apps/decompiler/dist/main.js render  path/to/movie.swf --out dist/scene --demo
```

## Options

- `--json`: stable machine-readable output.
- `--verbose`: include info diagnostics and detailed sprite output.
- `inspect --actions`: print AVM1 disassembly alongside the movie summary.
- `analyze --tiers`: report T0/T1/T2 for each top-level action block and recursively nested function; T2 rows include their reasons and residual byte counts.
- `--strict`: promote `FileLength` mismatches to errors and enable strict cursor failures where supported.
- `--tolerate-length`: keep `FileLength` mismatches as warnings; this is the default and overrides only the length part of `--strict`.
- `dump --out <dir>`: write the canonical `model.json` there.
- `render --out <dir> --demo`: write the static-scene bundle and browser viewer.

## Verbs

| Verb | Status | Spec |
| --- | --- | --- |
| `inspect` | implemented — movie summary, optional AVM1 disassembly (`--actions`) | `TECH-SPEC` §5.2, `CMP` §8, `IMPL-030` §7 |
| `analyze --tiers` | implemented — stable per-action-block and nested-function tier report | `IMPL-050` §7 and roadmap P5 |
| `dump` | implemented — movie model, `--json` / `--out <dir>` | `IMPL-040` §3.6 (`R044`–`R048`) |
| `assets dump` | implemented — deterministic P3 build-time previews | IMPL-060/070/080/090 |
| `render` | implemented — P4 static scene and browser demo | IMPL-130 §5, `specs/web/050` |
| `diff` | reserved | future work |

Exit codes are `CMP-R029`'s: `0` ok · `1` error diagnostics · `2` unreadable/not a SWF · `3` AVM2
content · `4` threshold · `5` internal error · `6` not cleanable (`clean` only).

## Non-goals

- No writing to the input and no generated TypeScript project: project emission belongs to P6/the
  transpiler. `analyze` constructs AVM1 front-end IR and tiers; it does not execute scripts.
- `render` is the P4 no-script/static path. It does not execute AVM1, play audio, or implement the
  P7 runtime.
- No network access or timestamps. Reports include the source path supplied by the caller and are
  byte-comparable for the same path and input (`REPO-R015`).

## Spec map

| Area | Document |
| --- | --- |
| CLI contract, exit codes | `docs/specs/foundation/020-compiler-pipeline.md` §8 |
| Container, tag stream, dictionary | `docs/impl/foundation/020-container-tag-stream-dictionary.md` |
| Frame assembly, placements, sprites | `docs/impl/decompiler/030-display-list-and-sprites.md` |
| Control tags, exports, metadata | `docs/impl/decompiler/040-control-tags-and-metadata.md` |
| Model dump (`dump` verb) | `docs/impl/decompiler/040-control-tags-and-metadata.md` §3.6 |
