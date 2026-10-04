# IMPL-150 — Code Inspector: Indexing, Navigation, Run View

**Doc ID:** IMPL-150 · **Status:** ready (design-driven; grows with the compiler docs it displays) · **Package:** `@swf-forge/inspector` (`apps/code-inspector`) + `@swf-forge/analysis` + `@swf-forge/project`
**Format spec:** none (consumes the other docs' artefacts)
**Design specs:** INS (whole), CMP-§7 (source maps), AVM1-§6 (recovered names), AST-§5 (manifest), RT-§10 (debug hooks), SEC-§8, TST-§3 (fixtures)

---

## 1. Deliverables

1. **`@swf-forge/project`** — the `forge.project.json` model, validation, and the file-system
   abstraction (directory handle, ZIP, served path) used by the inspector, `forge-clean`, and `verify`.
2. **`@swf-forge/analysis`** — the indexer: project scan, provenance classification, symbol graph,
   source-map resolution, reference index, and search indexes. Runs in a worker; no DOM.
3. **The inspector app** — explorer/editors/highlighting (INS-§3), navigation (INS-§4), diagnostics
   and reports (INS-§5), run view (INS-§6), all under the INS-§7 budgets.
4. **`forge-inspect serve`** — a tiny local static server for directory-backed projects (dev tool).
5. Golden projects under `fixtures/inspector/` covering every degradation row of INS-§2.

## 2. Module layout

```
packages/project/src/
  project-file.ts        forge.project.json model + zod-style validation (formatVersion gate)
  open.ts                openProject(): dir handle | zip | served path → ProjectHandle
  paths.ts               POSIX-relative path rules; traversal guards
  provenance.ts          file classification (generated/rewritten/edited/authored/asset/report)
packages/analysis/src/
  index.ts               buildIndex(project, {budgetMs, budgetBytes}) → ProjectIndex
  symbols.ts             declaration table + kind (class/method/field/resource/character/diagnostic)
  refs.ts                reference index (TS refs, resource uses, SWF character uses, diagnostics)
  sourcemap.ts           generated-position ↔ original-position resolution (CMP-§7 format)
  model-index.ts         SWF-side index over model.json (tags, characters, frames, functions)
  search.ts              text index (trigram) + fuzzy symbol matcher
  worker.ts              worker entry: request/response protocol, budgets, cancellation
apps/code-inspector/src/
  main.ts                mount(#app), route: project view | SWF view | run view
  ui/explorer.ts         tree, provenance filters, reveal-in-SWF, open-with
  ui/editor.ts           virtualised read-only editor, view zones, links, breadcrumbs
  ui/highlight/{ts,json,md,glsl,swf,avm1}.ts   tokenisers (INS-R010)
  ui/swf/{tags,timeline,hex}.ts                tag tree, scrubber, byte-run view
  ui/panels/{diagnostics,rewrites,budgets}.ts  report panels (INS-§5)
  ui/run/view.ts         engine embedding, frame stepping, debug hooks (INS-§6)
  state/*.ts             selection, navigation history, filters (no business logic)
  workers/{indexer,language}.worker.ts         @swf-forge/analysis + TS language service
```

**IMPL-150-R001** `@swf-forge/analysis` MUST NOT import `@swf-forge/compiler`'s emitter or any
engine (`TECH-R017`); it may import `@swf-forge/swf` for model types and the model dump reader.

**IMPL-150-R002** The app layer MUST contain no decoding, mapping, or indexing logic — only UI state
and rendering (`TECH-R004`); every such operation is an `analysis`/`project` call.

## 3. Loading and indexing

- **IMPL-150-R003** `openProject()` MUST validate `formatVersion` first and refuse a future version
  read-only (`INS-R006`), mapping every failure to `SF0901`–`SF0906`.
- **IMPL-150-R004** The index MUST be built lazily by tier: (a) file listing + provenance (first
  paint), (b) manifest + symbols, (c) references + model index, (d) full text search. Tiers past (a)
  report progress and are cancellable.
- **IMPL-150-R005** The index cache lives in `<project>/.forge-cache/` keyed by a content hash of
  `forge.project.json`, the source map files, and the TS file mtimes+sizes; it MUST be disposable and
  MUST NOT be required for correctness (`INS-D02`).
- **IMPL-150-R006** Provenance classification: a file is `generated` when it appears in
  `build-info.json`'s file digest table with a matching hash, `edited` when the entry exists but the
  hash differs, `rewritten` when it appears in `rewrite-log.json`, `authored` when it is neither a
  build artefact nor an asset, and `asset`/`report` by directory rule (`assets/`, `diagnostics/`).
- **IMPL-150-R007** Indexing of untrusted input MUST run in the worker with `budgetMs` (default
  10 s per tier) and `budgetBytes` (default 300 MB); exceeding either terminates the worker and
  degrades the view (`INS-R029`), never blocking the UI thread.

## 4. Workspace

- **IMPL-150-R008** The explorer and every list MUST be virtualised; a 20 000-file project MUST NOT
  read asset payloads to render the tree (`INS-R009`).
- **IMPL-150-R009** Highlighting uses the shipped tokenisers; the SWF and AVM1 tokenisers take their
  grammar from the model dump (tag names from APP-§2, opcode names from APP-§3) so the display can
  never disagree with the reference tables.
- **IMPL-150-R010** Name-provenance markers (`recovered` / `inferred` / `synthesised`) come from the
  `provenance` map AVM1-§6 emits per symbol; hover text is generated from that map, never guessed.
- **IMPL-150-R011** Large files (> 2 MB or > 50 000 lines) switch to the plain view with a banner
  (`INS-R013`) but keep links and breadcrumbs working.
- **IMPL-150-R012** Search: text search uses the trigram index over `src/` + `diagnostics/`; model
  search queries `model-index.ts`; both MUST be able to return the first page in ≤ 200 ms on the
  baseline (INS-R033).

## 5. Navigation

- **IMPL-150-R013** Go-to-definition and find-references are served from the reference index, with
  the four INS-R017 kinds labelled; the TS language service (worker, TS compiler API) is authoritative
  for TS-to-TS resolution, the reference index for cross-artifact resolution.
- **IMPL-150-R014** Source-map resolution MUST distinguish *exact*, *approximate* (line-only) and
  *unmapped* results and MUST surface that distinction (`INS-R019`); residual bytecode positions are
  always `unmapped` with a `residual T2` label.
- **IMPL-150-R015** The timeline scrubber maps frame → emitted frame script by consulting the model's
  frame table and the emitter's `frames/*.ts` symbol map; when a frame has no script the scrubber
  still positions and shows the placements.
- **IMPL-150-R016** The AVM1 listing view is generated from `actions/*.json` (IR, not source text) so
  the mapping from opcode → emitted expression is exact; the side-by-side view scrolls from that
  mapping, not from heuristics.
- **IMPL-150-R017** Navigation history (back/forward) MUST work across views and MUST persist for the
  session; deep links encode `file:line:col`, `tag:<offset>`, `char:<id>`, `diag:<code>:<index>`.

## 6. Diagnostics, reports, run view

- **IMPL-150-R018** Diagnostic rows render the owning spec id (rule/requirement) with a link into the
  shipped spec text; requirement titles come from a generated index (`tools/spec-index`) so links do
  not rot.
- **IMPL-150-R019** Export: any panel MUST export a Markdown summary (INS-R023) with the same content
  as the UI, using the project's relative paths (no absolute paths, no timestamps).
- **IMPL-150-R020** The run view embeds `@swf-forge/engine-flash` or `@swf-forge/engine-clean` from
  the *served project* (never a bundled copy in production builds), only in dev builds, same-origin
  (`INS-R025`/`INS-R028`), and drives RT-§10 debug hooks for frame/VM inspection.
- **IMPL-150-R021** "Where was this emitted from" MUST resolve via the same `sourcemap.ts` path as
  navigation (one implementation, two callers).

## 7. Diagnostics block (`SF0900`–`0999`)

| Code | Severity | Meaning |
| --- | --- | --- |
| `SF0901` | error | project cannot be opened (`forge.project.json` missing/invalid, or manifest missing) |
| `SF0902` | warning | `src/` missing or empty — explorer shows an empty workspace |
| `SF0903` | info | `porting-notes.json` absent — diagnostics panel disabled |
| `SF0904` | warning | source maps absent/partial — cross-navigation degrades to symbol matching |
| `SF0905` | warning | run view blocked (engine not present in the served output, or not a dev build) |
| `SF0906` | warning | worker terminated on a budget violation (time or memory) |
| `SF0907` | warning | index cache invalidated (format change) and rebuilt |
| `SF0908` | info | future `formatVersion` — read-only banner |
| `SF0909` | warning | authoring-mode write refused (generated asset or out-of-scope path) |

## 8. Test obligations

| ID | Test | Level |
| --- | --- | --- |
| `T-INS-101` | Open matrix: INS-§2 rows and `SF0901`–`SF0908` codes over the golden projects | F1 |
| `T-INS-102` | Provenance classification incl. an `edited` generated file and a `rewritten` file | F1 |
| `T-INS-103` | Index tiering: first paint before tier (b) completes; cancellation mid-tier leaves a usable UI | F2 |
| `T-INS-104` | Source-map resolution: exact/approximate/unmapped classification over 50 fixture positions, `T-INS-003` at implementation level | F1 |
| `T-INS-105` | Reference kinds: four labels, correct sets, on a resource handle and a character id | F1 |
| `T-INS-106` | Timeline scrubber → frame script selection over a 600-frame sprite | F2 |
| `T-INS-107` | AVM1 listing ↔ emitted expression side-by-side mapping for T0/T1/T2 fixtures (T2 shows `unmapped: residual`) | F1 |
| `T-INS-108` | Worker budgets: a 300 MB adversarial project terminates the worker with `SF0906` and keeps the UI alive | F1 |
| `T-INS-109` | Security: SEC-§7 corpus renders nothing as markup and makes no third-party request (`T-INS-006`) | F1 |
| `T-INS-110` | Run view synchronisation and the `SF0905` blocked cases | F2 |
| `T-INS-111` | Deep links + navigation history round-trip across views | F2 |
| `T-INS-112` | Performance: INS-R033 budgets on the large synthetic project | F3 |
| `T-INS-113` | Panels: diagnostics/rewrites/budgets filter, sort, jump-to-source and Markdown export; budget rows show flash-vs-clean when both outputs exist | F2 |
| `T-INS-114` | Highlighting: every shipped grammar tokenises its fixture; recovered/synthesised markers match the provenance map; the large-file plain-view switch fires at the documented thresholds | F2 |

## 9. Work packages

| WP | Title | Depends | Est | Deliverable |
| --- | --- | --- | --- | --- |
| WP-150-01 | `@swf-forge/project`: file model + open/validate + provenance | WP-120-10, WP-120-11 | 3 | `project/*`, T-INS-101/102 |
| WP-150-02 | `@swf-forge/analysis`: indexer tiers + worker protocol + budgets | WP-150-01, WP-120-08 | 5 | `analysis/*`, T-INS-103/108 |
| WP-150-03 | Symbol/reference index + search (text, fuzzy, model) | WP-150-02, WP-120-05 | 4 | `symbols.ts`, `refs.ts`, `search.ts`, T-INS-105 |
| WP-150-04 | Source-map resolution service (exact/approx/unmapped) | WP-150-03, WP-120-08 | 3 | `sourcemap.ts`, T-INS-104 |
| WP-150-05 | App shell: routing, explorer, virtualised editor, breadcrumbs | WP-150-01 | 4 | `ui/*`, T-INS-111 |
| WP-150-06 | Tokenisers: TS/JSON/MD/GLSL + SWF + AVM1 listings | WP-150-05, APP-§2/§3 | 3 | `ui/highlight/*`, T-INS-114 |
| WP-150-07 | SWF views: tag tree, hex run, timeline scrubber | WP-150-04, WP-150-06 | 4 | `ui/swf/*`, T-INS-106 |
| WP-150-08 | Diagnostics/rewrites/budgets panels + export | WP-150-05, WP-120-11 | 3 | `ui/panels/*`, T-INS-113 |
| WP-150-09 | AVM1 listing ↔ emitted-code side-by-side view | WP-150-04, WP-050-16 | 3 | `ui/swf/avm1.ts`, T-INS-107 |
| WP-150-10 | Run view: engine embedding, frame stepping, debug hooks | WP-150-05, WP-130-16 | 4 | `ui/run/*`, T-INS-110 |
| WP-150-11 | `forge-inspect serve` + ZIP/dir/served-path adapters | WP-150-01 | 2 | CLI verb, adapters |
| WP-150-12 | Fixtures, budgets, three-browser smoke suite | WP-150-03…10 | 3 | `fixtures/inspector/*`, T-INS-112 |
| | **Total** | | **41** | |

## 10. Done criteria

1. Every INS requirement id appears in the test table above or in `specs/120`'s, with a passing test.
2. The golden projects cover every degradation row of INS-§2, and `spec-verify` links resolve.
3. A 200-file project opens within the INS-R033 budgets on all three browser engines.
4. `forge-inspect serve` runs the app over a directory handle and over a ZIP with identical results.
5. No `innerHTML`, no third-party origin, no bundled engine in production builds (SEC checks green).

## 11. Changelog

| Version | Date | Change |
| --- | --- | --- |
| 1.0 | 2026-10-04 | Initial implementation spec: module layout for `project`/`analysis`/app, loading and tiered indexing with budgets, workspace and highlighting rules, the four-kind navigation implementation, diagnostics/reports/run-view wiring, `SF0901`–`SF0909`, `T-INS-101`–`112`, WP-150-01…12 (41 d) |
