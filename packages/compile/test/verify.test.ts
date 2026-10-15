/**
 * `verify`, the checks (`WP-120-12`).
 *
 * Three obligations drive this file. `T-CMP-002` is the forbidden-construct lint, and "one fixture per rule" is
 * taken literally: every entry in `EMITTED_BANS` has its own snippet, so a ban that was added to the prose but never
 * implemented has no fixture and the parity assertion fails. `T-CMP-007`'s three cases are re-proven *through*
 * `verifyProject` here — `WP-120-10` proved them against the two pure functions, and this is the layer that decides
 * whether they run at all, in what order, and with what severity. `T-CMP-009`'s `IMPL-120-R032` half runs against
 * the real emitted output of a fixture carrying a named anchor, then against the same output with one `location`
 * read injected, which is the shape the rule prohibits.
 *
 * Everything is a call over `{path, text}` fixtures rather than a temp directory on purpose: `verifyProject` is
 * pure, and `WP-120-13`'s CLI is the only thing that touches disk. A test that built a directory would be testing
 * the walker, which does not exist yet, instead of the checks.
 */

import { describe, expect, it } from 'vitest';

import { Tag } from '@swf-forge/swf';
import { sha256Hex } from '@swf-forge/swf/node';
import {
  actionBlock,
  buildSwf,
  concat,
  defineSprite,
  defineTag,
  endTag,
  placeObject2,
  showFrames,
  tag,
} from '@swf-forge/swf/test-support';

import {
  EMITTED_BANS,
  analyzeStage,
  codeOnly,
  emitStage,
  framesPass,
  modelStage,
  namesPass,
  readStage,
  resolveForgeConfig,
  runBans,
  runPipeline,
  scaffoldFiles,
  verifyProject,
} from '../src/index.js';
import type { VerifyFile, VerifyFinding, ForgeConfig } from '../src/index.js';

const STOP = 0x07;
const END = 0x00;
const GET_VARIABLE = 0x1c;
const TRACE = 0x26;

const CONFIG: ForgeConfig = resolveForgeConfig({ input: 'game.swf', outDir: 'out' });

function project(files: Readonly<Record<string, string>>): VerifyFile[] {
  return Object.entries(files).map(([path, text]) => ({ path, text }));
}

function findings(result: ReturnType<typeof verifyProject>, check: string): VerifyFinding[] {
  return result.findings.filter((entry) => entry.check === check);
}

/** The scaffolded config text, so the ban-marker assertions run against what a real project ships. */
function scaffoldedConfig(): string {
  const files = scaffoldFiles({
    toolVersion: 'test-1',
    inputName: 'game.swf',
    sha256: 'ab'.repeat(32),
    movie: 'movie 1 frame',
  });
  const config = files.find((entry) => entry.path === 'eslint.config.mjs');
  if (config === undefined) throw new Error('the scaffold wrote no eslint.config.mjs');
  return config.text;
}

describe('the forbidden-construct lint (T-CMP-002)', () => {
  // One snippet per ban. The parity assertion below is what makes "one fixture per rule" enforceable: a ban added
  // without a fixture, or a fixture whose ban was removed, fails here rather than leaving a rule untested.
  const SAMPLES: Readonly<Record<string, string>> = {
    eval: 'const code = "x";\neval(code);\n',
    'function-synthesis': 'const twice = new Function("a", "return a + a");\nexport { twice };\n',
    'implied-eval': 'setTimeout("tick()", 0);\n',
    with: 'with (target) {\n  x = 1;\n}\n',
    await: 'const value = await load();\nexport { value };\n',
    'for-in': 'for (const key in target) {\n  visit(key);\n}\n',
    proxy: 'const guard = new Proxy(target, {});\nexport { guard };\n',
    'math-random': 'const roll = Math.random();\nexport { roll };\n',
    'explicit-any': 'function go(value: any): void {\n  visit(value);\n}\nexport { go };\n',
    location: 'const hash = window.location.hash;\nexport { hash };\n',
    'document-write': 'document.write("<b>hi</b>");\n',
    'html-injection': 'target.innerHTML = text;\n',
  };

  it('has one fixture for every ban, and one ban for every fixture', () => {
    expect(Object.keys(SAMPLES).sort()).toEqual(EMITTED_BANS.map((ban) => ban.id).sort());
    expect(EMITTED_BANS.length).toBeGreaterThanOrEqual(12);
  });

  for (const [id, sample] of Object.entries(SAMPLES)) {
    const ban = EMITTED_BANS.find((entry) => entry.id === id);
    it(`flags \`${id}\``, () => {
      expect(ban, `${id} is in the fixture table but not in EMITTED_BANS`).toBeDefined();
      const hits = runBans(sample);
      expect(
        hits.map((hit) => hit.id),
        `${sample} must trip ${id}`,
      ).toContain(id);
      const result = verifyProject({ files: project({ 'src/ban.ts': sample }) });
      const reported = findings(result, 'bans');
      expect(reported.length).toBeGreaterThan(0);
      expect(reported[0]?.detail).toContain(`\`${id}\``);
      expect(reported[0]?.rule).toBe(id === 'location' ? 'IMPL-120-R032' : 'IMPL-120-R014');
      expect(result.clean).toBe(false);
    });
  }

  it('reports the line and column of the construct, not just the file', () => {
    const hits = runBans('export const ok = 1;\nconst hash = window.location.hash;\n');
    const hit = hits.find((entry) => entry.id === 'location');
    expect(hit?.line).toBe(2);
    expect(hit?.column).toBe(14);
    expect(hit?.excerpt).toContain('window.location.hash');
  });

  it('reads the code, not the text: a `//` inside a string does not hide a call', () => {
    // The naive stripper this replaces cut from the first `//` to end of line, which makes
    // `const u = "//"; eval(code)` an empty line to a matcher and a real call to the runtime.
    const hits = runBans('const u = "//";\neval(u);\n');
    expect(hits.map((entry) => entry.id)).toEqual(['eval']);
  });

  it('does not fire on a comment, on inert movie text, or on a word that merely contains a ban', () => {
    expect(runBans('// eval(code);\n/* setTimeout("x", 0) */\nexport const a = 1;\n')).toEqual([]);
    // Movie data is the emitter's own string output: it is content, not code, and cannot trip a ban.
    expect(runBans('export const label = "eval( : any // innerHTML";\n')).toEqual([]);
    // A word boundary is the whole difference between a banned call and a modelled method.
    expect(runBans('export function defineFunction2(): number {\n  return 2;\n}\n')).toEqual([]);
    expect(runBans('export const half = bounds.width / 2;\n')).toEqual([]);
    expect(runBans('export const t = /\\/[*/]/u;\n')).toEqual([]);
  });

  it('blanks comments and strings at identical offsets, so a column still means something', () => {
    const source = 'const s = "eval(x)"; // setTimeout("y", 0)\n';
    const blanked = codeOnly(source);
    expect(blanked).toHaveLength(source.length);
    expect(blanked).not.toContain('eval');
    expect(blanked).not.toContain('setTimeout');
    expect(source.indexOf('s')).toBe(blanked.indexOf('s'));
  });

  it('falls back to the raw text when a string or comment never closes', () => {
    const broken = 'export const s = "unterminated\n';
    expect(codeOnly(broken)).toBe(broken);
    expect(runBans('eval("a\n').map((entry) => entry.id)).toContain('eval');
  });

  it('fails when the emitted project relaxed its own config (IMPL-120-R016)', () => {
    const config = scaffoldedConfig();
    for (const ban of EMITTED_BANS) {
      expect(config.includes(ban.marker), `eslint.config.mjs must carry the \`${ban.id}\` ban`).toBe(true);
    }
    const result = verifyProject({
      files: project({
        'eslint.config.mjs': config.replace(`'no-eval': 'error',`, ''),
      }),
    });
    const reported = findings(result, 'bans');
    expect(reported).toHaveLength(1);
    expect(reported[0]?.detail).toContain('no longer carries the `eval` ban');
    expect(reported[0]?.rule).toBe('IMPL-120-R016');
  });

  it('carries the two bans CMP §4.10 names that the config had not: document.write and innerHTML', () => {
    const config = scaffoldedConfig();
    expect(config).toContain('"name": "document"');
    expect(config).toContain('insertAdjacentHTML');
  });
});

describe('the manifest and the asset list (T-CMP-007)', () => {
  const MANIFEST = { schema: 1, movie: { frameCount: 240, frameRate: 24 } };

  function withManifest(overrides: Readonly<Record<string, string>> = {}): VerifyFile[] {
    return project({
      'src/manifest.ts': `// AUTO-GENERATED\nexport const manifest = ${JSON.stringify(MANIFEST)} as const;\n`,
      'forge.manifest.json': `${JSON.stringify(MANIFEST, null, 2)}\n`,
      ...overrides,
    });
  }

  it('passes a pair that agrees, even when the two halves spell the same object differently', () => {
    // `IMPL-120-R019`'s diff is structural: a formatter that reordered keys changed nothing a porter acts on, and
    // reporting it would teach people to ignore the drift check.
    const reordered = project({
      'src/manifest.ts':
        '// AUTO-GENERATED\nexport const manifest = {"movie":{"frameRate":24,"frameCount":240},"schema":1} as const;\n',
      'forge.manifest.json': '{\n  "schema": 1,\n  "movie": {\n    "frameCount": 240,\n    "frameRate": 24\n  }\n}\n',
    });
    expect(findings(verifyProject({ files: reordered }), 'manifest')).toEqual([]);
    expect(verifyProject({ files: withManifest() }).findings).toEqual([]);
  });

  it('reports an injected drift as an error naming the path that differs', () => {
    const files = project({
      'src/manifest.ts': `// AUTO-GENERATED\nexport const manifest = ${JSON.stringify(MANIFEST)} as const;\n`,
      'forge.manifest.json': `${JSON.stringify({ ...MANIFEST, movie: { frameCount: 241, frameRate: 24 } }, null, 2)}\n`,
    });
    const reported = findings(verifyProject({ files }), 'manifest');
    expect(reported).toHaveLength(1);
    expect(reported[0]?.severity).toBe('error');
    expect(reported[0]?.detail).toContain('movie.frameCount');
    expect(reported[0]?.rule).toBe('IMPL-120-R019');
  });

  it('reports a pair with a missing half, in either direction', () => {
    const jsonOnly = findings(
      verifyProject({ files: project({ 'forge.manifest.json': `${JSON.stringify(MANIFEST)}\n` }) }),
      'manifest',
    );
    expect(jsonOnly).toHaveLength(1);
    expect(jsonOnly[0]?.detail).toContain('src/manifest.ts is not');
    const tsOnly = findings(
      verifyProject({ files: project({ 'src/manifest.ts': 'export const manifest = {} as const;\n' }) }),
      'manifest',
    );
    expect(tsOnly).toHaveLength(1);
    expect(tsOnly[0]?.detail).toContain('forge.manifest.json');
  });

  it('reports a TS half that is not the shape the emitter wrote', () => {
    const reported = findings(
      verifyProject({
        files: project({
          'src/manifest.ts': 'export const manifest = null;\n',
          'forge.manifest.json': `${JSON.stringify(MANIFEST)}\n`,
        }),
      }),
      'manifest',
    );
    expect(reported).toHaveLength(1);
    expect(reported[0]?.detail).toContain('carries no generated manifest payload');
  });

  it('catches a missing asset, a tampered hash and a lying byte count', () => {
    const data = new TextEncoder().encode('data');
    const asset = { path: 'assets/sounds/hit.mp3', bytes: data.length, sha256: sha256Hex(data) };
    const manifest = { schema: 1, sounds: [asset] };
    const ts = `// AUTO-GENERATED\nexport const manifest = ${JSON.stringify(manifest)} as const;\n`;
    const json = `${JSON.stringify(manifest, null, 2)}\n`;

    const missing = findings(
      verifyProject({ files: project({ 'src/manifest.ts': ts, 'forge.manifest.json': json }) }),
      'assets',
    );
    expect(missing).toHaveLength(1);
    expect(missing[0]?.path).toBe('assets/sounds/hit.mp3');
    expect(missing[0]?.detail).toContain('this build did not write');

    const tampered = { ...asset, sha256: 'ff'.repeat(32) };
    const tamperedManifest = JSON.stringify({ schema: 1, sounds: [tampered] });
    const flagged = findings(
      verifyProject({
        files: [
          {
            path: 'src/manifest.ts',
            text: `// AUTO-GENERATED\nexport const manifest = ${tamperedManifest} as const;\n`,
          },
          { path: 'forge.manifest.json', text: `${tamperedManifest}\n` },
          { path: 'assets/sounds/hit.mp3', bytes: data },
        ],
      }),
      'assets',
    );
    expect(flagged).toHaveLength(1);
    expect(flagged[0]?.detail).toContain('sha256');

    const grown = findings(
      verifyProject({
        files: [
          { path: 'src/manifest.ts', text: ts },
          { path: 'forge.manifest.json', text: json },
          { path: 'assets/sounds/hit.mp3', bytes: new TextEncoder().encode('data!') },
        ],
      }),
      'assets',
    );
    expect(grown.some((entry) => entry.detail.includes('the manifest says 4 bytes'))).toBe(true);

    const extra = findings(
      verifyProject({
        files: [
          { path: 'src/manifest.ts', text: ts },
          { path: 'forge.manifest.json', text: json },
          { path: 'assets/sounds/hit.mp3', bytes: data },
          { path: 'assets/stray.png', bytes: new Uint8Array([1, 2, 3]) },
        ],
      }),
      'assets',
    );
    expect(extra).toHaveLength(1);
    expect(extra[0]?.detail).toContain('the manifest never names it');
  });

  it('treats a manifest hash with no file content supplied as unverified, not as a pass', () => {
    const asset = { path: 'assets/sounds/hit.mp3', bytes: 4, sha256: 'ab'.repeat(32) };
    const text = JSON.stringify({ schema: 1, sounds: [asset] });
    const reported = findings(
      verifyProject({ files: project({ 'forge.manifest.json': `${text}\n`, 'assets/sounds/hit.mp3': '' }) }),
      'assets',
    );
    expect(reported.length).toBeGreaterThan(0);
    expect(reported.every((entry) => entry.severity === 'error')).toBe(true);
  });

  it('refuses to read a manifest that does not parse', () => {
    const reported = findings(verifyProject({ files: project({ 'forge.manifest.json': '{ oops' }) }), 'assets');
    expect(reported).toHaveLength(1);
    expect(reported[0]?.detail).toContain('does not parse');
  });
});

describe('the symbol and divergence checks (IMPL-120-R024)', () => {
  const pair = {
    'src/index.ts': 'export { play } from "./playback/hero.js";\n',
    'src/playback/hero.ts':
      'import { clip } from "./clip.js";\nexport function play(target: object): void {\n  clip(target);\n}\n',
    'src/playback/clip.ts': 'export function clip(target: object): void {\n  void target;\n}\n',
  };

  it('passes a project where every import resolves and every export is used', () => {
    const result = verifyProject({ files: project(pair) });
    expect(findings(result, 'symbols')).toEqual([]);
  });

  it('errors when an import names a module the build did not write', () => {
    const reported = findings(
      verifyProject({ files: project({ 'src/index.ts': 'import { play } from "./gone.js";\nplay();\n' }) }),
      'symbols',
    );
    expect(reported).toHaveLength(1);
    expect(reported[0]?.severity).toBe('error');
    expect(reported[0]?.detail).toContain('./gone.js');
  });

  it('errors when an import names a symbol the module does not export', () => {
    const reported = findings(
      verifyProject({
        files: project({
          'src/index.ts': 'import { play, stage } from "./hero.js";\nvoid play; void stage;\n',
          'src/hero.ts': 'export function play(): void {}\n',
        }),
      }),
      'symbols',
    );
    expect(reported).toHaveLength(1);
    expect(reported[0]?.detail).toContain('`stage`');
  });

  it('warns on an unreferenced export and silences it when the caller lists it', () => {
    const files = project({ ...pair, 'src/playback/debug.ts': 'export function traceOnly(): void {}\n' });
    const reported = findings(verifyProject({ files }), 'symbols');
    expect(reported).toHaveLength(1);
    expect(reported[0]?.severity).toBe('warning');
    expect(reported[0]?.path).toBe('src/playback/debug.ts');
    expect(
      findings(verifyProject({ files, unreferencedAllowed: ['src/playback/debug.ts#traceOnly'] }), 'symbols'),
    ).toEqual([]);
    expect(findings(verifyProject({ files, unreferencedAllowed: ['src/playback/debug.ts'] }), 'symbols')).toEqual([]);
  });

  it('warns both ways when the divergence list and the citations disagree', () => {
    const cited = { 'src/hero.ts': '// DIVERGENCE GFX-D09: blur is three box passes\nexport const passes = 3;\n' };
    const orphan = findings(verifyProject({ files: project(cited) }), 'divergence');
    expect(orphan).toHaveLength(1);
    expect(orphan[0]?.detail).toContain('GFX-D09');
    expect(orphan[0]?.severity).toBe('warning');

    const declared = { ...cited, 'docs/PORTING-DIVERGENCE.md': '### GFX-D04\n\nNothing.\n' };
    const both = findings(verifyProject({ files: project(declared) }), 'divergence');
    expect(both).toHaveLength(2);
    expect(both.every((entry) => entry.severity === 'warning')).toBe(true);
    expect(both.some((entry) => entry.detail.includes('`GFX-D04` is declared'))).toBe(true);
    expect(both.some((entry) => entry.detail.includes('`GFX-D09` is cited'))).toBe(true);

    const agreed = {
      ...cited,
      'docs/PORTING-DIVERGENCE.md': '### GFX-D09\n\nblur is three box passes\n',
    };
    expect(findings(verifyProject({ files: project(agreed) }), 'divergence')).toEqual([]);
  });
});

describe('--deep determinism and the checks verify cannot run', () => {
  it('names every file a rebuild wrote differently, in either direction', () => {
    const previous = project({ 'src/index.ts': 'export const a = 1;\n', 'src/gone.ts': 'export const b = 2;\n' });
    const current = project({ 'src/index.ts': 'export const a = 2;\n', 'src/new.ts': 'export const c = 3;\n' });
    const result = verifyProject({ files: current, previous, deep: true });
    expect(
      findings(result, 'determinism')
        .map((entry) => entry.path)
        .sort(),
    ).toEqual(['src/gone.ts', 'src/index.ts', 'src/new.ts']);
    expect(result.ran).toContain('determinism');
    expect(result.deep).toBe(true);

    const identical = verifyProject({ files: current, previous: current, deep: true });
    expect(findings(identical, 'determinism')).toEqual([]);
    expect(identical.clean).toBe(true);
  });

  it('records `--deep` without a previous build as a check that did not run', () => {
    const result = verifyProject({ files: project({ 'src/index.ts': 'export const a = 1;\n' }), deep: true });
    const row = result.notRun.find((entry) => entry.check === 'determinism');
    expect(row?.reason).toContain('no previous build');
    expect(result.ran).not.toContain('determinism');
    expect(result.clean).toBe(true);
  });

  it('lists the three checks it cannot perform, each with the owner that can', () => {
    const result = verifyProject({ files: [] });
    const checks = result.notRun.map((entry) => entry.check);
    expect(checks).toEqual(
      expect.arrayContaining(['determinism', 'residual-blob-validity', 'budgets', 'strict-build']),
    );
    for (const row of result.notRun) {
      expect(row.owner).toMatch(/^WP-\d{3}-\d{2}/u);
      expect(row.reason.length).toBeGreaterThan(20);
    }
    expect(result.notRun.find((entry) => entry.check === 'residual-blob-validity')?.owner).toContain('WP-130-12');
  });
});

/** The end-to-end half of `T-CMP-009`: the emitted project, not a snippet. */
function movieBytes(): Uint8Array {
  const label = Uint8Array.from([...Array.from(new TextEncoder().encode('hero'), (byte) => byte), 0x00, 0x01]);
  return buildSwf({
    version: 8,
    frameCount: 1,
    body: concat(
      defineTag(Tag.DefineShape, 10),
      defineSprite(11, 1, concat(placeObject2(10, 1), showFrames(1), endTag())),
      tag(Tag.FrameLabel, label),
      tag(Tag.DoAction, Uint8Array.from(actionBlock([GET_VARIABLE, TRACE, STOP, END]))),
      showFrames(1),
      endTag(),
    ),
  });
}

describe('verify over a real emitted project (T-CMP-009)', () => {
  function emitted(): { readonly files: VerifyFile[] } {
    const result = runPipeline({
      input: movieBytes(),
      inputName: 'game.swf',
      config: CONFIG,
      toolVersion: 'test-1',
      stages: [readStage('game.swf'), modelStage(), analyzeStage(), emitStage()],
      passes: [namesPass(), framesPass()],
    });
    return { files: result.files.map((file) => ({ path: file.path, bytes: file.bytes })) };
  }

  it('runs clean over the output of a movie carrying a named anchor', () => {
    const { files } = emitted();
    expect(files.length).toBeGreaterThan(3);
    const sources = files.filter((file) => file.path.startsWith('src/'));
    expect(sources.length).toBeGreaterThan(0);
    // `IMPL-120-R032`: nothing in the emitted output reaches for the URL, so frame addressing is identical under
    // a path, a fragment and a `file:` URL.
    expect(sources.some((file) => new TextDecoder().decode(file.bytes ?? new Uint8Array()).includes('location'))).toBe(
      false,
    );
    const result = verifyProject({ files });
    expect(result.findings.filter((entry) => entry.severity === 'error')).toEqual([]);
    expect(result.files.sources).toBe(sources.length);
  });

  it('fails the build on an injected `location` read in that same output', () => {
    const { files } = emitted();
    const index = files.findIndex((file) => file.path.startsWith('src/') && file.path.endsWith('.ts'));
    expect(index, 'the emit stage wrote no TypeScript to inject into').toBeGreaterThanOrEqual(0);
    const target = index;
    const original = files[target] as VerifyFile;
    const text = new TextDecoder().decode(original.bytes ?? new Uint8Array());
    const edited: VerifyFile[] = [...files];
    edited[target] = { path: original.path, text: `${text}\nexport const anchor = window.location.hash;\n` };
    const result = verifyProject({ files: edited });
    const reported = findings(result, 'bans');
    expect(reported).toHaveLength(1);
    expect(reported[0]?.rule).toBe('IMPL-120-R032');
    expect(reported[0]?.path).toBe(original.path);
    expect(reported[0]?.detail).toContain('window.location.hash');
    expect(result.clean).toBe(false);
  });

  it('catches an injected manifest drift in that same output', () => {
    const { files } = emitted();
    const manifest = files.find((file) => file.path === 'forge.manifest.json');
    expect(manifest, 'the emit stage wrote no manifest for this fixture').toBeDefined();
    const text = new TextDecoder().decode((manifest as VerifyFile).bytes ?? new Uint8Array());
    const result = verifyProject({
      files: files.map((file) => (file.path === 'forge.manifest.json' ? { path: file.path, text: `${text}\n` } : file)),
    });
    expect(findings(result, 'manifest')).toEqual([]);
    const lying = JSON.parse(text) as Record<string, unknown>;
    lying['injected'] = true;
    const drifted = verifyProject({
      files: files.map((file) =>
        file.path === 'forge.manifest.json' ? { path: file.path, text: `${JSON.stringify(lying)}\n` } : file,
      ),
    });
    const reported = findings(drifted, 'manifest');
    expect(reported.length).toBeGreaterThan(0);
    expect(reported[0]?.detail).toContain('injected');
  });
});
