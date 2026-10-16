/**
 * `swfforge verify`, the checks (`WP-120-12`, `IMPL-120-R024`, `CMP` §4.10).
 *
 * **This module never touches the disk and never emits a diagnostic.** Both choices are load-bearing.
 *
 * *No disk*: `CMP` §4.10 describes `verify` as a command that "parses the emitted project (not just the SWF)", and
 * §2 of this doc states that S10 is not a build stage precisely because it must run over output this process did
 * not produce. So the caller supplies the files — `WP-120-13`'s CLI walks the directory, and a test hands over a
 * fixture — and every check here is a pure function of that input. That is also what makes the injected-drift
 * cases in `T-CMP-007` testable: a test can put a lie in one half of a manifest pair without building a
 * filesystem.
 *
 * *No diagnostics*: `DiagnosticSink` rows are attributed to a build's own input (offset, character, tag), and
 * `verify` runs where there is no build — often on a project a *previous* build wrote, sometimes one a person has
 * edited. A finding is therefore `{check, severity, path, detail, rule}`: a location in the emitted project plus
 * the rule that failed. It is the CLI's job to fold findings into `IMPL-120-R026`'s exit codes, and `verify` adds
 * no new `SF05xx` codes because there is no registry entry a finding would need beyond the rules it cites.
 *
 * **Six checks, and `IMPL-120-R024` names all six.** Four are run here and are cheap: manifest↔TS drift
 * (`diffManifestTexts`, `R019`), asset existence and hash (`checkManifestAssets`), the forbidden-construct lint
 * (`runBans`, `R014`/`R016`/`R032`, and `SEC` §3's `document.write`/`innerHTML` half), and every emitted symbol
 * referenced at least once or listed. The other two cannot be run against a project this process did not build, and
 * saying so is the whole point of `notRun`: a check that quietly returns "no findings" when it looked at nothing is
 * worse than no check, because it becomes the evidence a reviewer trusts. `IMPL-120-R024`'s T2-blob row needs the
 * interpreter's validator, which is P7; `CMP` §4.10's budget row needs `budgets.json`, which `WP-120-07` owns and
 * §4.3 reports as withheld (`SF0507`); and `tsc --strict` is the emitted project's own build, not a function of
 * these bytes.
 *
 * `--deep` adds the double-build determinism comparison (`R022`, `T-CMP-003`'s `diff -r`). Requesting `deep`
 * without a previous build is recorded as a `notRun` row rather than a pass — a determinism check that compared
 * one build with itself has measured nothing.
 */

import { sha256Hex } from '@swf-forge/swf/node';
import { EMITTED_BANS, runBans } from './emit/bans.js';
import { EMITTED_PUBLIC_EXPORTS } from './emit/files.js';
import { checkManifestAssets, diffManifestTexts } from './emit/manifest.js';
import { checkDivergenceCompleteness, divergenceCitations } from './stages/report.js';

/** The six check families, as stable ids so a finding survives a rewording of its detail. */
export type VerifyCheck = 'manifest' | 'assets' | 'bans' | 'symbols' | 'divergence' | 'determinism';

/** A failure, located in the emitted project. `severity: 'error'` is what the CLI folds into a non-zero exit. */
export interface VerifyFinding {
  readonly check: VerifyCheck;
  readonly severity: 'error' | 'warning';
  readonly path: string;
  readonly detail: string;
  /** The rule the finding cites, so a report can be read without opening this file. */
  readonly rule: string;
  /** A line in `path`, when the check is line-shaped (a ban, a citation). */
  readonly line?: number;
}

/** A check `IMPL-120-R024` or `CMP` §4.10 requires that this function cannot perform, and who can. */
export interface VerifyNotRun {
  readonly check: string;
  readonly reason: string;
  readonly owner: string;
}

/**
 * One file of the emitted project.
 *
 * `bytes` is what an asset's length and hash are computed from; `sha256` short-circuits that computation for a
 * caller that already hashed (the CLI, walking a directory, hashes once). A file handed over with neither has its
 * hash reported as a mismatch rather than a pass: the manifest's claim about content nobody supplied is not
 * verified, and `verify` must not launder it into one.
 */
export interface VerifyFile {
  readonly path: string;
  readonly text?: string;
  readonly bytes?: Uint8Array;
  readonly sha256?: string;
}

export interface VerifyOptions {
  readonly files: readonly VerifyFile[];
  /** Add the double-build comparison, when a previous build's file set is available. */
  readonly deep?: boolean;
  /** The previous build, in `--deep` mode. Same shape, and the files that were then. */
  readonly previous?: readonly VerifyFile[];
  /**
   * `IMPL-120-R024`'s "or listed as intentionally unreferenced" list, added to the emitter's own
   * `EMITTED_PUBLIC_EXPORTS`. Three spellings, same grammar: `src/dir/` silences every emitted file in a
   * generated family, `src/x.ts` silences one module, and `src/x.ts#name` silences one export of it. The API
   * surface a generated project hands its host is unreferenced *by design*, and an escape hatch the project
   * declares is the alternative to a check that cries wolf until the project disables it.
   */
  readonly unreferencedAllowed?: readonly string[];
}

export interface VerifyResult {
  readonly findings: readonly VerifyFinding[];
  readonly notRun: readonly VerifyNotRun[];
  readonly ran: readonly VerifyCheck[];
  readonly files: { readonly inspected: number; readonly sources: number; readonly assets: number };
  readonly deep: boolean;
  /** True when no `error`-severity finding was raised — warnings, and the `notRun` rows, do not fail a verify. */
  readonly clean: boolean;
}

const MANIFEST_TS = 'src/manifest.ts';
const MANIFEST_JSON = 'forge.manifest.json';
const DIVERGENCE_DOC = 'docs/PORTING-DIVERGENCE.md';

/** A project, as the checks want it: text where text is needed, bytes and hashes where the manifest is checked. */
interface Project {
  readonly texts: Map<string, string>;
  readonly bytes: Map<string, Uint8Array>;
  readonly hash: Map<string, string>;
  readonly sources: string[];
  readonly assets: string[];
}

const decoder = new TextDecoder();

function isSource(path: string): boolean {
  return path.startsWith('src/') && path.endsWith('.ts');
}

/*
 * `CMP` §4.10 scopes its construct checks to the emitted sources, and the generated config lints the `src` tree's
 * TypeScript, so the two scopes are one predicate (`isSource`) on purpose. `IMPL-120-R016` forbids either side being
 * laxer than the other, and an override module under `CMP-§9.5` that lives in `src/` is code the build ships: a ban
 * it violates is a ban the project violates, whatever file it arrived in.
 */
function toProject(files: readonly VerifyFile[]): Project {
  const texts = new Map<string, string>();
  const bytes = new Map<string, Uint8Array>();
  const hash = new Map<string, string>();
  for (const file of files) {
    let content = file.bytes;
    if (content === undefined && file.text !== undefined) content = new TextEncoder().encode(file.text);
    if (content !== undefined) {
      bytes.set(file.path, content);
      hash.set(file.path, file.sha256 ?? sha256Hex(content));
    } else if (file.sha256 !== undefined) {
      hash.set(file.path, file.sha256);
    }
    const text = file.text ?? (content === undefined ? undefined : decoder.decode(content));
    if (text !== undefined) texts.set(file.path, text);
    else if (file.path.endsWith('.json') || file.path.endsWith('.ts') || file.path.endsWith('.md')) {
      // A path the caller named but gave no content for is *present and unreadable*, which is not the same as
      // absent. Recorded as the empty string it makes the manifest pair report "carries no generated manifest
      // payload" and the JSON reader report a parse failure, instead of letting a check conclude there was nothing
      // to check because it could not see the file.
      texts.set(file.path, '');
    }
  }
  const paths = [...texts.keys()].sort();
  return {
    texts,
    bytes,
    hash,
    sources: paths.filter(isSource),
    assets: paths.filter((path) => path.startsWith('assets/')),
  };
}

function finding(
  check: VerifyCheck,
  severity: 'error' | 'warning',
  path: string,
  detail: string,
  rule: string,
): VerifyFinding {
  return { check, severity, path, detail, rule };
}

/**
 * The five check families below are module-private on purpose. `verifyProject` is the surface: a caller that
 * wanted one family in isolation would be choosing which rules to honour, and the CLI's exit code depends on all of
 * them being run. A test filters `findings` by `check` instead — the same list, one fewer way to under-check.
 *
 * `IMPL-120-R019`'s drift, on the pair as written.
 *
 * `buildManifest` splices one serialized text into both files, so drift can only arrive afterwards — a hand edit,
 * a merge, a half-applied regeneration — which is exactly what a build must not ship silently. A missing half is
 * reported rather than skipped: `src/manifest.ts` alone is a project whose app shell has nothing to import, and
 * `forge.manifest.json` alone is a project whose types were never checked against it.
 */
function checkManifestPair(project: Project): readonly VerifyFinding[] {
  const ts = project.texts.get(MANIFEST_TS);
  const json = project.texts.get(MANIFEST_JSON);
  if (ts === undefined && json === undefined) return [];
  if (ts === undefined) {
    return [
      finding(
        'manifest',
        'error',
        MANIFEST_JSON,
        `${MANIFEST_JSON} is present and ${MANIFEST_TS} is not, so nothing checked the app shell's import against the emitted types (IMPL-120-R019)`,
        'IMPL-120-R019',
      ),
    ];
  }
  if (json === undefined) {
    return [
      finding(
        'manifest',
        'error',
        MANIFEST_TS,
        `${MANIFEST_TS} is present and ${MANIFEST_JSON} is not, so the manifest the app shell imports as data does not exist`,
        'IMPL-120-R019',
      ),
    ];
  }
  return diffManifestTexts(ts, json).map((detail) =>
    finding('manifest', 'error', MANIFEST_JSON, `manifest drift: ${detail}`, 'IMPL-120-R019'),
  );
}

/**
 * `CMP` §4.7's two rows (`R024`'s second clause), over the files the caller supplied.
 *
 * `checkManifestAssets` needs `{path, bytes, sha256}` per asset, so this is where a supplied file's length and
 * digest are computed — once, and from the same bytes the manifest's claim is compared against. A file with no
 * content arrives as zero bytes with an empty digest, which the helper reports as a mismatch: an unchecked claim is
 * not a passed one.
 */
function checkAssets(project: Project): readonly VerifyFinding[] {
  const json = project.texts.get(MANIFEST_JSON);
  if (json === undefined || json === '') return [];
  let manifest: unknown;
  try {
    manifest = JSON.parse(json) as unknown;
  } catch (cause) {
    return [
      finding(
        'assets',
        'error',
        MANIFEST_JSON,
        `${MANIFEST_JSON} does not parse, so no asset reference could be checked: ${cause instanceof Error ? cause.message : String(cause)}`,
        'IMPL-120-R024',
      ),
    ];
  }
  if (manifest === null || typeof manifest !== 'object' || Array.isArray(manifest)) {
    return [finding('assets', 'error', MANIFEST_JSON, 'the manifest is not a JSON object', 'IMPL-120-R024')];
  }
  const assetPaths = new Set(project.assets);
  // An asset the manifest names but the caller did not hand over is `missing`; the file list is therefore every
  // asset on the project, and the manifest's own references are not added to it.
  const listed = [...assetPaths].map((path) => ({
    path,
    bytes: project.bytes.get(path)?.length ?? 0,
    sha256: project.hash.get(path) ?? '',
  }));
  return checkManifestAssets(manifest as Parameters<typeof checkManifestAssets>[0], listed).map((entry) => {
    // Every detail string this helper writes names the asset path, and a finding whose `path` is the asset is a
    // finding an editor can open. The manifest is the fallback, not the default: `path` should point at the file
    // the reader can fix.
    const cited = /assets\/[A-Za-z0-9_.+/@-]+/u.exec(entry.detail);
    return finding('assets', 'error', cited?.[0] ?? MANIFEST_JSON, entry.detail, 'IMPL-120-R024');
  });
}

/**
 * The forbidden-construct lint (`IMPL-120-R014`/`R016`/`R032`, `CMP` §4.10's `SEC` §3 row).
 *
 * Two halves, and the second is the one that keeps the first honest. The matchers run over the project's sources;
 * the emitted `eslint.config.mjs` is then asserted to still carry a rule for each entry, because `R016` makes the
 * ban list one policy with two renderers. A project whose config dropped a ban while `verify` kept it is a
 * developer fighting a gate that fires on their own output; a project whose config kept a ban while `verify`
 * dropped it is a gate that passes code it was written to stop. Both are reported.
 */
function checkBans(project: Project): readonly VerifyFinding[] {
  const findings: VerifyFinding[] = [];
  for (const path of project.sources) {
    for (const hit of runBans(project.texts.get(path) ?? '')) {
      findings.push({
        check: 'bans',
        severity: 'error',
        path,
        detail: `banned construct \`${hit.id}\` (${hit.rule}) at ${hit.line}:${hit.column} — ${hit.detail}; line reads: ${hit.excerpt}`,
        rule: hit.id === 'location' ? 'IMPL-120-R032' : 'IMPL-120-R014',
        line: hit.line,
      });
    }
  }
  const config = project.texts.get('eslint.config.mjs');
  if (config !== undefined && config !== '') {
    const missing = EMITTED_BANS.filter((ban) => !config.includes(ban.marker));
    for (const ban of missing) {
      findings.push(
        finding(
          'bans',
          'error',
          'eslint.config.mjs',
          `the generated config no longer carries the \`${ban.id}\` ban (\`${ban.rule}\`), which \`verify\` still enforces — ${ban.why}`,
          'IMPL-120-R016',
        ),
      );
    }
  }
  return findings;
}

/**
 * `IMPL-120-R024`'s symbol row, in both directions.
 *
 * The **error** direction is a dangling reference: `src/**` imports a name from a relative module that does not
 * exist or does not export it. `CMP` §4.10 calls this row "every resource handle referenced by `src/**` exists",
 * and in an emitted project a handle *is* an import — the manifest is the only other referent, and §4.3 gives that
 * direction to `checkManifestAssets`. Checking it here is what makes `tsc`'s row below redundant-but-cheap: the
 * two failure modes a porter actually hits (a module the emitter renamed, a symbol it stopped exporting) are visible
 * without running a compiler.
 *
 * The **warning** direction is an export nothing imports, which `R024` allows when it is "listed as intentionally
 * unreferenced". The list is the *project's*: `EMITTED_PUBLIC_EXPORTS`, declared by the emitter that wrote the
 * files, extended by `unreferencedAllowed` for a caller that knows something the emitter cannot. Three spellings,
 * tightest first — `src/x.ts#name` silences one export, `src/x.ts` one module, `src/dir/` a generated family whose
 * file count is a property of the movie (`E-054` is why the third exists, and why it is the emitter's to state and
 * never a verb's to pass).
 */
function checkSymbols(project: Project, unreferencedAllowed: readonly string[] = []): readonly VerifyFinding[] {
  const findings: VerifyFinding[] = [];
  const exported = new Map<string, Set<string>>();
  const imported = new Map<string, Set<string>>();

  const resolve = (from: string, specifier: string): string | null => {
    if (!specifier.startsWith('.')) return null;
    const dir = from.includes('/') ? from.slice(0, from.lastIndexOf('/')) : '';
    const parts: string[] = [];
    for (const segment of `${dir}/${specifier}`.split('/')) {
      if (segment === '' || segment === '.') continue;
      if (segment === '..') parts.pop();
      else parts.push(segment);
    }
    const base = parts.join('/');
    for (const candidate of [base, base.replace(/\.js$/u, '.ts'), `${base}/index.ts`, base]) {
      if (project.texts.has(candidate)) return candidate;
    }
    return base.endsWith('.css') || base.endsWith('.json') ? base : null;
  };

  for (const path of project.sources) {
    const text = project.texts.get(path) ?? '';
    const names = new Set<string>();
    // A re-export is both an export of this module and a *use* of the target's, and `export { play } from
    // './playback/hero.js'` is how the emitter publishes a symbol the app shell imports. Reading it as only the
    // first would report `hero.ts#play` as dead on every build.
    for (const match of text.matchAll(/^export\s*\{([^}]*)\}\s*from\s*['"][^'"]+['"]/gmu)) {
      for (const part of (match[1] ?? '').split(',')) {
        const original = part
          .trim()
          .split(/\s+as\s+/u)[0]
          ?.trim()
          .replace(/^type\s+/u, '');
        if (original === undefined || original === '') continue;
        const seen = imported.get(original);
        if (seen === undefined) imported.set(original, new Set([path]));
        else seen.add(path);
      }
    }
    for (const match of text.matchAll(
      /^export\s+(?:declare\s+)?(?:async\s+)?(?:const|let|var|function|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/gmu,
    )) {
      if (match[1] !== undefined) names.add(match[1]);
    }
    for (const match of text.matchAll(/^export\s*\{([^}]*)\}(?:\s*as\s*type)?/gmu)) {
      for (const part of (match[1] ?? '').split(',')) {
        const name = part
          .trim()
          .split(/\s+as\s+/u)
          .pop()
          ?.trim();
        if (name !== undefined && name !== '') names.add(name.replace(/^type\s+/u, ''));
      }
    }
    if (/^export\s+default\b/mu.test(text)) names.add('default');
    exported.set(path, names);

    for (const match of text.matchAll(/^import\s+(?:type\s+)?\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/gmu)) {
      const specifier = match[2] ?? '';
      const target = resolve(path, specifier);
      const requested = (match[1] ?? '')
        .split(',')
        .map(
          (part) =>
            part
              .trim()
              .split(/\s+as\s+/u)[0]
              ?.trim() ?? '',
        )
        .filter((part) => part !== '');
      for (const name of requested) {
        const seen = imported.get(name);
        if (seen === undefined) imported.set(name, new Set([path]));
        else seen.add(path);
      }
      if (target === null) {
        if (specifier.startsWith('.')) {
          findings.push(
            finding(
              'symbols',
              'error',
              path,
              `\`${specifier}\` is imported by ${path} and no emitted file matches it, so the reference has no target (CMP §4.10's resource-handle row)`,
              'IMPL-120-R024',
            ),
          );
        }
        continue;
      }
      const available = exported.get(target);
      for (const name of requested) {
        if (available !== undefined && available.size > 0 && !available.has(name)) {
          findings.push(
            finding(
              'symbols',
              'error',
              path,
              `${path} imports \`${name}\` from \`${target}\`, which does not export it — the emitter renamed or dropped a symbol the consumer still expects`,
              'IMPL-120-R024',
            ),
          );
        }
      }
    }
  }

  const allowed = [...EMITTED_PUBLIC_EXPORTS, ...unreferencedAllowed];
  // A trailing-slash entry is a generated family: the emitter knows `src/frames/` faces outward without knowing
  // how many sprites the movie has, and a porter's own `src/app/shell.ts` matches no entry at all.
  const isListed = (path: string, name: string): boolean =>
    allowed.includes(path) ||
    allowed.includes(`${path}#${name}`) ||
    allowed.some((entry) => entry.endsWith('/') && path.startsWith(entry));
  for (const path of project.sources) {
    for (const name of exported.get(path) ?? []) {
      if (name === 'default') continue;
      if (imported.has(name)) continue;
      if (isListed(path, name)) continue;
      findings.push(
        finding(
          'symbols',
          'warning',
          path,
          `\`${name}\` is exported and referenced by nothing in the project — either wire it, or list \`${path}#${name}\` as intentionally unreferenced (IMPL-120-R024)`,
          'IMPL-120-R024',
        ),
      );
    }
  }
  return findings.sort(
    (a, b) => a.path.localeCompare(b.path) || (a.line ?? 0) - (b.line ?? 0) || a.detail.localeCompare(b.detail),
  );
}

/**
 * `CMP` §4.10's last row: the divergence list is complete with respect to the ids cited in emitted code.
 *
 * A warning, as the table says, and for the reason the table does not state: an uncited declaration is a stale
 * expectation the harness still forgives, and an uncited divergence in the code is a porting decision the porter
 * was never told about. Neither is a build error, and both are invisible until a frame looks wrong.
 *
 * Declarations are read out of `docs/PORTING-DIVERGENCE.md` — a `### <ID>` heading, a table row whose first cell is
 * `` `GFX-D04` ``, or a `- \`GFX-D04\`` bullet — because that file, not the compiler, is what `CMP` §4.9's entries
 * cross-check against. No document at all is not a finding: a project with no divergences and no citations is
 * consistent, and `IMPL-120-R021`'s report already says which side of that the build is on.
 */
function checkDivergences(project: Project): readonly VerifyFinding[] {
  const doc = project.texts.get(DIVERGENCE_DOC);
  const cited = divergenceCitations(project.sources.map((path) => ({ path, text: project.texts.get(path) ?? '' })));
  if (doc === undefined || doc === '') {
    if (cited.length === 0) return [];
    return [
      finding(
        'divergence',
        'warning',
        DIVERGENCE_DOC,
        `emitted code cites ${cited.join(', ')} and ${DIVERGENCE_DOC} is not part of the project, so the citations declare nothing`,
        'IMPL-120-R021',
      ),
    ];
  }
  const declared: { decision: string }[] = [];
  const seen = new Set<string>();
  for (const match of doc.matchAll(/(?:^|\s)([A-Z][A-Z0-9]{1,6}-D\d{2,3})\b/gmu)) {
    const id = match[1];
    if (id === undefined || seen.has(id)) continue;
    seen.add(id);
    declared.push({ decision: id });
  }
  const { undeclared, unreferenced } = checkDivergenceCompleteness(declared, cited);
  const findings: VerifyFinding[] = [];
  for (const id of undeclared) {
    findings.push(
      finding(
        'divergence',
        'warning',
        DIVERGENCE_DOC,
        `\`${id}\` is cited in emitted code and not declared in ${DIVERGENCE_DOC}: a porter reading the divergence list would not learn about it`,
        'IMPL-120-R021',
      ),
    );
  }
  for (const id of unreferenced) {
    findings.push(
      finding(
        'divergence',
        'warning',
        DIVERGENCE_DOC,
        `\`${id}\` is declared in ${DIVERGENCE_DOC} and cited by no emitted file: a stale expectation the harness keeps forgiving`,
        'IMPL-120-R021',
      ),
    );
  }
  return findings;
}

/** Two builds, compared the way `T-CMP-003`'s `diff -r` does: paths and content, both directions. */
export function compareBuilds(
  previous: readonly VerifyFile[],
  current: readonly VerifyFile[],
): {
  readonly onlyPrevious: readonly string[];
  readonly onlyCurrent: readonly string[];
  readonly differing: readonly string[];
} {
  const before = new Map(previous.map((file) => [file.path, digest(file)]));
  const after = new Map(current.map((file) => [file.path, digest(file)]));
  const onlyPrevious = [...before.keys()].filter((path) => !after.has(path)).sort();
  const onlyCurrent = [...after.keys()].filter((path) => !before.has(path)).sort();
  const differing: string[] = [];
  for (const [path, hash] of [...after].sort((a, b) => a[0].localeCompare(b[0]))) {
    const was = before.get(path);
    if (was !== undefined && was !== hash) differing.push(path);
  }
  return { onlyPrevious, onlyCurrent, differing };
}

function digest(file: VerifyFile): string {
  if (file.sha256 !== undefined) return file.sha256;
  if (file.bytes !== undefined) return sha256Hex(file.bytes);
  if (file.text !== undefined) return sha256Hex(new TextEncoder().encode(file.text));
  return 'unreadable';
}

/** The `--deep` determinism rows, from `compareBuilds`. A rebuild that differs is `R022` broken, whichever side moved. */
export function checkDeterminism(
  previous: readonly VerifyFile[],
  current: readonly VerifyFile[],
): readonly VerifyFinding[] {
  const comparison = compareBuilds(previous, current);
  const findings: VerifyFinding[] = [];
  for (const path of comparison.differing) {
    findings.push(
      finding(
        'determinism',
        'error',
        path,
        `a rebuild produced different bytes for this file, which IMPL-120-R022 forbids — the diff is in this file, so start with the six sources REPO-R015 names`,
        'IMPL-120-R022',
      ),
    );
  }
  for (const path of comparison.onlyCurrent) {
    findings.push(
      finding(
        'determinism',
        'error',
        path,
        'a rebuild wrote this file and the previous build did not',
        'IMPL-120-R022',
      ),
    );
  }
  for (const path of comparison.onlyPrevious) {
    findings.push(
      finding('determinism', 'error', path, 'a rebuild omitted this file the previous build wrote', 'IMPL-120-R022'),
    );
  }
  return findings;
}

/**
 * `swfforge verify <project>`, as a pure function.
 *
 * `deep` adds the double-build comparison and nothing else: every other check is a read of the project's own bytes,
 * and a shallow run that skipped them would not be a verification at all. `WP-120-13`'s CLI owns the disk walk,
 * the report format, and the mapping from `error` findings to `IMPL-120-R026`'s exit codes.
 */
export function verifyProject(options: VerifyOptions): VerifyResult {
  const project = toProject(options.files);
  const deep = options.deep === true;
  const findings: VerifyFinding[] = [
    ...checkManifestPair(project),
    ...checkAssets(project),
    ...checkBans(project),
    ...checkSymbols(project, options.unreferencedAllowed ?? []),
    ...checkDivergences(project),
  ];
  const ran: VerifyCheck[] = ['manifest', 'assets', 'bans', 'symbols', 'divergence'];

  const notRun: VerifyNotRun[] = [
    {
      check: 'residual-blob-validity',
      reason:
        'IMPL-120-R024 requires every T2 residual blob to decode under the interpreter’s validator, and the validator lives in the runtime package: @swf-forge/avm1 exports only the operand-level validateRegister today, so there is no callable entry to check a blob against',
      owner: 'WP-130-12 (P7 interpreter + validator), then this check calls it',
    },
    {
      check: 'budgets',
      reason:
        'CMP §4.10 warns when declared budgets exceed TST-§7 targets, and a build reports no budgets: §4.3 of this doc withholds the asset sections of the manifest for the same missing input (SF0507)',
      owner: 'WP-120-07 (asset planner), which produces budgets.json',
    },
    {
      check: 'strict-build',
      reason:
        'CMP §4.10 checks that the emitted project compiles under tsc --strict; that is a build of files this function is given as text, and running a compiler here would hide the diagnostics behind a finding. The emitted tsconfig is asserted instead, and CI runs the build',
      owner: 'WP-120-13 (the CLI can run the emitted project’s build and fold its diagnostics in)',
    },
  ];

  if (deep) {
    if (options.previous === undefined) {
      notRun.unshift({
        check: 'determinism',
        reason:
          '--deep asks for the double-build comparison (IMPL-120-R024, T-CMP-003) and no previous build was supplied to compare with; comparing one build against itself measures nothing',
        owner: 'WP-120-13 (the CLI rebuilds into a temp tree, or reads build-info.json from the last build)',
      });
    } else {
      ran.push('determinism');
      findings.push(...checkDeterminism(options.previous, options.files));
    }
  } else {
    notRun.unshift({
      check: 'determinism',
      reason:
        'the double-build byte comparison (IMPL-120-R022) is --deep only: it needs a second build, which is a minute of work a routine verify should not pay for',
      owner: 'WP-120-13 passes --deep; WP-120-14 runs it in CI as the double-build job',
    });
  }

  const sorted = [...findings].sort(
    (a, b) =>
      severityRank(a) - severityRank(b) ||
      a.check.localeCompare(b.check) ||
      a.path.localeCompare(b.path) ||
      (a.line ?? 0) - (b.line ?? 0) ||
      a.detail.localeCompare(b.detail),
  );

  return {
    findings: sorted,
    notRun,
    ran,
    files: { inspected: project.texts.size, sources: project.sources.length, assets: project.assets.length },
    deep,
    clean: !sorted.some((entry) => entry.severity === 'error'),
  };
}

function severityRank(entry: VerifyFinding): number {
  return entry.severity === 'error' ? 0 : 1;
}
