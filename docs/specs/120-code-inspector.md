# INS — Code Inspector (IDE-like Navigation)

**Doc ID:** INS · **Status:** Draft 1.0 · **Normative:** yes · **Kind:** design specification
**Component:** `apps/code-inspector` · `@swf-forge/inspector` (TECH-§2)
**Depends on:** CMP (emitted contract, source maps), AVM1 (recovered names), SWF/APP (tag model),
AST (manifest), RT (dev hooks for the run view), SEC (threat model), TST (fixture/oracle policy)
**Implementation doc:** [impl/150](../impl/150-code-inspector.md)

---

## 1. Scope

The inspector is the **navigation half of the product**: a browser app that opens a swf-forge
project and makes both sides of the toolchain legible — the original `.swf` (tags, timeline,
dictionary, AVM1 IR) and the generated TypeScript (files, symbols, resources, diagnostics,
rewrites). It is what makes a compiled title *auditable* by a human (ARCH-G6) and what makes the
compiler's output *feasible to hand-polish*.

It provides, at minimum:

1. a **file explorer** over the project workspace with provenance for every file;
2. **syntax highlighting** for the code it shows (TypeScript, JSON/JSONC, Markdown, GLSL, and its own
   SWF-tag and AVM1-listing views);
3. **navigation**: go-to-definition, find-references, symbol search, breadcrumbs, and
   **SWF↔TypeScript cross-navigation** in both directions;
4. **diagnostics and report browsing** with jump-to-source;
5. **asset preview** (textures, sounds, fonts/glyphs, video frames) straight from the manifest;
6. a **run view** (dev builds only) that embeds either engine with frame stepping and state/graph
   inspection tied to the current source position.

### 1.1 Non-goals

**INS-R001** The inspector MUST NOT load or execute a `.swf` for *game* purposes (TECH-R013). It
decodes SWF for *display* in a worker; execution of transpiled code happens only in the run view,
through an engine, and only in dev builds (`INS-D06`).

**INS-R002** The inspector is not a general text editor or a git client. It shows, explains, and
(opt-in) edits project files; version control stays outside (`INS-D01`).

**INS-R003** The inspector MUST NOT require a build step to open a project: it works from
`forge.project.json` + the output directory as written (ZIP, directory handle, or served path).

## 2. Inputs and project model

**INS-R004** The inspector opens exactly one thing: a `forge.project.json` (TECH-§3.5). From it, the
following are required or optional:

| Artifact | Requirement | Consequence when absent |
| --- | --- | --- |
| `forge.manifest.json` | required | open fails with `SF0901` (error) and a "rebuild the project" action |
| `src/**` | required | empty explorer with `SF0902` (warning) |
| `porting-notes.json` | optional | diagnostics panel disabled, `SF0903` (info) |
| `map/` source maps | optional | cross-navigation degrades to symbol-name matching, `SF0904` (warning) |
| the source `.swf` (`source.file`) | optional | SWF view disabled; every TS→SWF jump shows "source not present" |
| `diagnostics/rewrite-log.json` | optional (clean builds) | rewrites panel hidden |
| `assets/**` | optional | previews show placeholders with sizes from the manifest |

**INS-R005** Opening MUST be read-only unless authoring mode is explicitly enabled for a file
(`INS-D01`). The inspector MUST NOT create, delete, or move files outside authoring mode, and MUST
NOT write inside `assets/` or `map/` under any circumstances.

**INS-R006** A project opened from a newer `formatVersion` than the app supports MUST open with a
banner naming the version, in read-only mode.

## 3. Workspace: explorer, editors, highlighting

### 3.1 File explorer

**INS-R007** The explorer tree MUST be derived from the project directory, annotated with provenance
badges: `generated` (untouched compiler output), `rewritten` (clean-engine output), `edited` (a
generated file whose bytes differ from the `build-info.json` record), `authored` (not produced by
any tool), `asset`, `report`.

**INS-R008** The explorer MUST support: filter by provenance, filter by symbol/resource usage, reveal
in SWF view, copy path, and "open the file that defines this symbol".

**INS-R009** Directory listings and file reads MUST be virtualised and lazy: a project with 20 000
files and 200 MB of assets MUST open without reading asset payloads (`INS-R023`).

### 3.2 Editor surface and highlighting

**INS-R010** Syntax highlighting MUST be token-based and synchronous with scrolling: a shipped
grammar set (TypeScript, JSON/JSONC, Markdown, GLSL, YAML) plus a **SWF listing grammar** for tag
dumps and AVM1 disassembly. Highlighting MUST NOT block on the language service.

**INS-R011** Highlighting of *generated* TypeScript MUST mark provenance inline: identifiers whose
name was recovered from AS source carry a subtle marker; synthesised names (`movie_3`, `_func17`)
carry another. Hovering shows the recovery source (`AS2 source`, `inferred`, `synthesised`).

**INS-R012** The editor MUST be read-only in the default mode, with `readOnly` semantics that still
allow: selecting, copying, following links, and opening the same file in the user's real editor when
the project is opened from a directory handle.

**INS-R013** For files above 2 MB or 50 000 lines the editor MUST switch to a non-syntax-highlighted
plain view with a banner (large-file policy), preserving navigation.

### 3.3 Search

**INS-R014** Text search MUST work over the workspace (ripgrep-like semantics implemented in the
worker for directory handles, `fetch` ranges for served projects) and over the SWF model fields
(tag names, character ids, linkage names, string constants, action opcodes).

**INS-R015** Symbol search (fuzzy, keyboard-first) MUST be able to jump to: TS declarations, SWF
characters, tags by offset, resources by name, and diagnostics by code.

## 4. Navigation (the core promise)

**INS-R016** **Go-to-definition** MUST resolve, for generated code: local symbols, imported symbols,
resource handles (→ manifest entry → asset → SWF character), class names (→ recovered class →
defining tags), and runtime host names (→ AVM1 host API table entry in APP-§…).

**INS-R017** **Find-references** MUST return four kinds, each labelled: TS references, resource uses,
SWF character uses (frames, buttons, texts, morphs), and diagnostics referencing the position.

**INS-R018** **SWF↔TS cross-navigation** is mandatory in both directions and MUST use the source maps
(CMP-§7) plus the model dump:

| From | To | Shown |
| --- | --- | --- |
| TS position | SWF tag + byte offset (and sprite/frame for timeline code) | highlighted tag bytes in the tag view |
| SWF tag/character | every TS site that reads it | list, jump to first |
| Timeline frame (scrubber) | the frame script emitted for that frame | selection in `frames/*.ts` |
| AVM1 opcode in the listing | the emitted TS expression(s) it became | side-by-side, synchronised scroll |
| Resource handle | manifest entry + asset file | preview panel |

**INS-R019** When a mapping is unavailable (no source map, residual bytecode, synthesised code),
the inspector MUST say so in the jump target (`unmapped: residual T2`) rather than jumping to a guess.

**INS-R020** The tag view MUST be a real view over the model, not a text dump: tags are selectable,
expandable (bodies decode field-by-field), and searchable; the underlying bytes of a selection are
shown as a hex run with the field boundaries highlighted (Appendix A's dissection style).

**INS-R021** Breadcrumbs MUST be present in both views: `project ▸ sprite 12 ▸ frame 7 ▸ script` and
`src/classes/Hero.ts ▸ method update ▸ (was AVM1 fn #214)`, and clicking any crumb navigates.

## 5. Diagnostics and reports

**INS-R022** Diagnostics from `porting-notes.json` MUST be listable, filterable by severity and code,
sortable by file/symbol, and mapped to source positions where available; the inspector MUST show the
rule that produced them (`ARCH-R…`, `SWF-R…`, `IMPL-…`) with a link into the specification text
shipped alongside the app.

**INS-R023** Divergences (`divergence.json`), waivers, and clean-engine rewrites (`rewrite-log.json`)
MUST be presented as first-class lists with the same jump behaviour, and MUST be exportable as
Markdown for a bug report.

**INS-R024** Budget reports (`budgets.json`) MUST be rendered as a table with thresholds from the
owning spec (TST-§7), showing pass/fail and the largest offenders; for clean builds the table MUST
also show the flash-vs-clean comparison when both outputs are present.

## 6. Run view (dev builds only)

**INS-R025** The run view MUST be available only in dev builds of the inspector (`INS-D06`) and MUST
load a project served from the same origin; it MUST NOT fetch from third-party origins.

**INS-R026** The run view MUST provide: play/pause, frame step, timeline scrubber, run-to-frame,
reset, and a "show me where this was emitted from" action that jumps to the TS position being
executed.

**INS-R027** With the debug hooks enabled (RT-§10), the run view MUST be able to inspect the live AVM1
frame (locals, registers, scope chain) and the display list (depth-ordered with character ids), each
linked to source positions.

**INS-R028** The run view MUST be blocked with an explanatory banner when the project's engine is
`clean` and the clean runtime is not present in the served output (`SF0905`, warning).

## 7. Security, privacy, performance

**INS-R029** Decoding of the source `.swf` and indexing MUST run in workers with no DOM access, a
time budget per file, and a memory cap; on violation the worker is terminated and the view degrades
(`SF0906`, warning) — SEC-§7 applies to the inspector as much as to the compiler.

**INS-R030** The app MUST NOT use `innerHTML`/`outerHTML` with decoded strings; all rendering of
decoded content MUST go through text nodes or an escaped template layer.

**INS-R031** The inspector MUST NOT make network requests except to its own origin and the configured
local `serve` endpoint; no telemetry, no fonts/CDN dependencies, all assets bundled (`SEC-§8`).

**INS-R032** Authoring mode (when enabled) MUST write only files the user explicitly opened for
editing, MUST NOT touch generated assets, and MUST keep a session-local edit log shown in the
explorer (so a user can see what the inspector changed).

**INS-R033** Opening a project MUST meet: cold open of a 200-file project ≤ 1.5 s (first paint), full
index ≤ 10 s on the baseline device, and ≤ 300 MB peak memory for a 200 MB project; the worker index
MUST be rebuilt incrementally when files change on disk.

## 8. Test obligations (design level)

| ID | Test | Level |
| --- | --- | --- |
| `T-INS-001` | Open/parse matrix: every row of §2 (missing manifest, missing maps, missing source, future format version) yields the documented degradation and code | F1 |
| `T-INS-002` | Provenance badges: a fixture project with one file of each provenance class is classified correctly, including the `edited` case | F1 |
| `T-INS-003` | Cross-navigation round trip: for 50 fixture positions, TS → SWF → TS returns the original range or an explicitly `unmapped` result | F1 |
| `T-INS-004` | Reference kinds: `find-references` on a resource handle and on a character id returns TS, resource, SWF and diagnostic kinds, correctly labelled | F1 |
| `T-INS-005` | Highlighting: recovered vs synthesised markers appear for the documented name classes and hover names the recovery source | F2 |
| `T-INS-006` | Security: a malformed/malicious fixture set (SEC-§7 corpus) never escapes the worker, never renders markup, and never reaches the network | F1 |
| `T-INS-007` | Performance: the §7 budget assertions on the large synthetic project (cold open, full index, memory, incremental rebuild) | F3 |
| `T-INS-008` | Run view: frame step, scrubber and jump-to-emitted-code stay synchronised over a 600-frame fixture; blocked correctly for a missing clean runtime | F2 |

## 9. Decision register

| ID | Decision | Default | Rationale |
| --- | --- | --- | --- |
| `INS-D01` | Write policy | Read-only; authoring mode is explicit, per-file, session-logged | decoded content must not mutate a project implicitly (TECH-D07) |
| `INS-D02` | Index location | `.forge-cache/` inside the project, disposable and never committed | rebuildable from `forge.project.json` + sources |
| `INS-D03` | Navigation substrate | source maps + model dump; no bespoke binary index | one artefact set, already produced by the transpiler |
| `INS-D04` | Highlighting engine | shipped grammars (token-based), not a plugin ecosystem | offline, deterministic, no third-party runtime deps |
| `INS-D05` | Language service | TypeScript compiler API in a worker, project-scoped | accurate TS semantics with zero server dependency |
| `INS-D06` | Run view availability | dev builds only, same-origin | avoids shipping a player and sidesteps hostile-content execution (INS-R001) |
| `INS-D07` | Keyboard model | VS Code conventions where they exist | zero learning cost for the target user |
| `INS-D08` | Editing | Plain text edits with generated-file guard rails (a diff banner before save) | hand-polish is a first-class workflow (ARCH-G3) |
| `INS-D09` | Reference-kind labels | fixed four kinds (TS, resource, SWF, diagnostic) | makes "why is this here" answerable at a glance |

## 10. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-10-04 | Initial design specification: scope and non-goals, project inputs and degradation matrix, explorer/editor/highlighting rules, the four-kind navigation model with mandatory SWF↔TS cross-navigation, diagnostics/report browsing, dev-only run view with frame and VM inspection, security/privacy/performance budgets, `T-INS-001`–`008` and the `INS-D01`–`D09` register |
