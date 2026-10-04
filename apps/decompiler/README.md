# `@swf-forge/decompiler` — `forge-decompile`

Reads a SWF and reports exactly what is in it: header, timeline, dictionary, tags and diagnostics.
This is the first component of the pipeline (`TECH-SPEC` §3.2) and the only one that is read-only by
construction.

## Run

```sh
pnpm build                       # tsc -b (builds @swf-forge/swf first, via project references)
node apps/decompiler/dist/main.js inspect path/to/movie.swf
node apps/decompiler/dist/main.js inspect path/to/movie.swf --json
node apps/decompiler/dist/main.js dump    path/to/movie.swf --out dist/model
```

## Verbs

| Verb | Status | Spec |
| --- | --- | --- |
| `inspect` | implemented | `TECH-SPEC` §5.2, `CMP` §8, `IMPL-030` §7 |
| `dump` | implemented — movie model, `--json` / `--out <dir>` | `IMPL-040` §3.6 (`R044`–`R048`) |
| `diff`, `assets` | reserved | `docs/impl/decompiler/070` |

Exit codes are `CMP-R029`'s: `0` ok · `1` error diagnostics · `2` unreadable/not a SWF · `3` AVM2
content · `4` threshold · `5` internal error · `6` not cleanable (`clean` only).

## Non-goals

- No writing: the decompiler never modifies its input, and never writes a project (that is
  `@swf-forge/transpiler`).
- No action bytes, no rendering, no audio: `inspect` reports what the container and model layers know
  (`docs/impl/foundation/020`, `docs/impl/decompiler/030`); the other verbs and docs follow.
- No network access, no timestamps, no absolute paths in output: runs are byte-comparable
  (`REPO-R015`).

## Spec map

| Area | Document |
| --- | --- |
| CLI contract, exit codes | `docs/specs/foundation/020-compiler-pipeline.md` §8 |
| Container, tag stream, dictionary | `docs/impl/foundation/020-container-tag-stream-dictionary.md` |
| Frame assembly, placements, sprites | `docs/impl/decompiler/030-display-list-and-sprites.md` |
| Control tags, exports, metadata | `docs/impl/decompiler/040-control-tags-and-metadata.md` |
| Model dump (`dump` verb) | `docs/impl/decompiler/040-control-tags-and-metadata.md` §3.6 |
