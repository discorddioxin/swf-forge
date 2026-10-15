/**
 * The manifest: one object, two artifacts, and the drift check between them (`WP-120-10`).
 *
 * `IMPL-120-R019` requires the manifest twice — as TypeScript for the runtime, type-checked, and as
 * `forge.manifest.json` for tooling and tests — with both coming from the same in-memory object and `verify`
 * diffing them. The obvious way to satisfy that is to build the object, serialize it once, and splice the same
 * text into both files. Then "the two artifacts agree" is true by construction rather than by a convention two
 * writers have to keep up, and the drift check is a check on the *files* — what a hand edit, a formatter, or a
 * half-copied build leaves behind — instead of a re-derivation of what the builder already decided.
 *
 * Three consequences are worth naming, because each is a place a plausible implementation goes wrong:
 *
 * 1. **The JSON is strict JSON.** The app-shell example in `CMP` §5 reads the manifest with
 *    `import manifest from '../forge.manifest.json' with { type: 'json' }`, so the generated header comment the
 *    `.ts` artifacts carry — and that `tsconfig.json` tolerates as JSONC — would break the manifest's only
 *    reader. The JSON side therefore has no header, and its provenance lives in `tool` instead.
 * 2. **A section with no input is omitted, not zero-filled.** `AST` §6's schema is the runtime's complete view of
 *    the game, and most of it is *asset* data: atlas rects, font atlases, encoded sound variants, budgets. That
 *    comes from the asset planner (`WP-120-07`), which this phase has not built. `"textures": {}` would read as
 *    "this movie has no textures" — a false statement a runtime could cache — while an absent key reads as "this
 *    build said nothing about textures", which is what the run report then names.
 * 3. **Numbers are checked, not formatted.** A non-finite number refuses the whole artifact rather than becoming
 *    a zero, and `-0` is written as `0`. That rule and the sorted-key rule (`AST-R043`, `REPO-R016`) live in
 *    `emit/json.ts`, because the report files of §4 are hashed build outputs exactly like the manifest is, and a
 *    second JSON policy is how two artifacts start disagreeing about what "canonical" means.
 */

import type { MovieModel } from '@swf-forge/swf';

import type { EmitHeader } from './files.js';
import { isJsonObject, writeJson, type JsonLike, type JsonObject } from './json.js';

/** `AST` §6's schema identity. The schema text lives in the design spec; there is no schema file to validate against. */
export const MANIFEST_SCHEMA_VERSION = 1;
export const MANIFEST_SCHEMA_URL = 'https://swf-forge.dev/schema/manifest-1.json';

/**
 * The `AST` §6 sections whose inputs belong to the asset planner. Listed rather than emitted empty, so the gap is
 * a statement about the build and not about the movie.
 */
export const MANIFEST_WITHHELD_SECTIONS: readonly string[] = [
  'textures',
  'atlases',
  'gradients',
  'fonts',
  'sounds',
  'videos',
  'binary',
  'streams',
  'budgets',
];

/** The manifest's JSON types alias `emit/json.ts`, so every hashed artifact shares one value grammar. */
export type ManifestObject = JsonObject;

export type ManifestValue = JsonLike;

export interface ManifestArtifact {
  readonly ok: true;
  /** The canonical JSON text: sorted keys, 2-space indent (one line when `compact`). No trailing newline. */
  readonly json: string;
  /** The `src/manifest.ts` body: the same text under `export const manifest = … as const;`. */
  readonly ts: string;
  readonly value: ManifestObject;
  readonly withheld: readonly string[];
}

export type ManifestOutcome = { readonly ok: false; readonly error: string } | ManifestArtifact;

const TWIPS_PER_PIXEL = 20;

/** `StageModel.frameRate` is the header's raw FIXED8 (`movie.ts` carries it as `frameRateRaw`); a manifest
 * reader wants frames per second, which is what `AST` §6's example value of 24 means. Dividing by a power of two
 * is exact, so 6110 raw still reads as 23.8671875 rather than a rounded 23.87. */
const FIXED8_SCALE = 256;

/** `json.ts`'s guard, under the name the manifest's structural comparisons read best with. */
const isPlainObject = isJsonObject;

/**
 * Sorted-key JSON with the manifest's rules, delegated to the emitter's one JSON writer (`emit/json.ts`) so the
 * manifest and the report files cannot disagree about what a canonical artifact looks like.
 */
export function serializeManifest(
  value: ManifestValue,
  compact = false,
): { readonly text: string } | { readonly error: string } {
  return writeJson(value, { compact, subject: 'manifest' });
}

/**
 * Builds the manifest from the model and the run header. `toolConfigHash` is `configHash(config, 'emit')`: the
 * manifest describes the *emitted* project, so the hash that reproduces it is the emit stage's rather than the
 * whole pipeline's, and a caller with no config (a plan run, a test) omits the field instead of guessing it.
 */
export function buildManifest(input: {
  readonly header: EmitHeader;
  readonly model: MovieModel;
  readonly toolConfigHash?: string;
  readonly compact?: boolean;
}): ManifestOutcome {
  const stage = input.model.stage;
  const movie: ManifestObject = {
    file: input.header.inputName,
    sha256: input.header.sha256,
    stage: {
      widthTwips: stage.widthTwips,
      heightTwips: stage.heightTwips,
      widthPx: stage.widthTwips / TWIPS_PER_PIXEL,
      heightPx: stage.heightTwips / TWIPS_PER_PIXEL,
    },
    frameRate: stage.frameRate / FIXED8_SCALE,
    frameCount: input.model.frameCount,
    background: input.model.background,
    // `AST` §6 marks metadata "if any", so an empty dictionary is absent rather than `{}`.
    ...(Object.keys(input.model.metadata).length > 0 ? { metadata: { ...input.model.metadata } } : {}),
  };
  const tool: ManifestObject = {
    name: 'swf-forge',
    version: input.header.toolVersion,
    ...(input.toolConfigHash === undefined ? {} : { configHash: input.toolConfigHash }),
  };
  const value: ManifestObject = {
    $schema: MANIFEST_SCHEMA_URL,
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    tool,
    movie,
  };
  const serialized = serializeManifest(value, input.compact === true);
  if ('error' in serialized) return { ok: false, error: serialized.error };
  const json = serialized.text;
  return {
    ok: true,
    json,
    ts: `export const manifest = ${json} as const;\n`,
    value,
    withheld: MANIFEST_WITHHELD_SECTIONS,
  };
}

/** The payload a generated `.ts` manifest carries, or `null` when the file is not the shape the emitter wrote. */
export function manifestPayload(tsText: string): string | null {
  const marker = 'export const manifest = ';
  const start = tsText.indexOf(marker);
  if (start < 0) return null;
  const body = tsText.slice(start + marker.length);
  const end = body.lastIndexOf(' as const;');
  return end < 0 ? null : body.slice(0, end).trim();
}

/**
 * `IMPL-120-R019`'s diff, on the two file texts. Each payload is parsed and compared structurally, so the answer
 * is a list of paths a person can act on rather than the first differing byte offset: `$.movie.frameCount: 240
 * in the TS manifest, 241 in the JSON`. Reordering and re-indenting are therefore *not* drift, and a value that
 * appears on one side and not the other is reported per key rather than as a whole-subtree mismatch.
 */
export function diffManifestTexts(tsText: string, jsonText: string): readonly string[] {
  const tsPayload = manifestPayload(tsText);
  if (tsPayload === null) {
    return ['src/manifest.ts carries no generated manifest payload (`export const manifest = … as const;`)'];
  }
  const left = parse(tsPayload);
  const right = parse(jsonText);
  if ('error' in left) return [`src/manifest.ts payload does not parse: ${left.error}`];
  if ('error' in right) return [`forge.manifest.json does not parse: ${right.error}`];
  const differences: string[] = [];
  compare(left.value, right.value, '', differences);
  return differences;
}

function parse(text: string): { readonly value: ManifestValue } | { readonly error: string } {
  try {
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return { error: 'the payload is not a JSON object' };
    }
    return { value: value as ManifestValue };
  } catch (cause) {
    return { error: cause instanceof Error ? cause.message : String(cause) };
  }
}

function compare(left: ManifestValue, right: ManifestValue, path: string, into: string[]): void {
  if (left === right) return;
  const at = path === '' ? '$' : path;
  const leftArray = Array.isArray(left);
  const rightArray = Array.isArray(right);
  if (leftArray || rightArray) {
    if (!leftArray || !rightArray) {
      into.push(`${at}: a ${shape(left)} in the TS manifest, a ${shape(right)} in the JSON`);
      return;
    }
    const length = Math.max(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
      const child = `${path}[${index}]`;
      if (index >= left.length) into.push(`${child}: missing from the TS manifest`);
      else if (index >= right.length) into.push(`${child}: missing from the JSON manifest`);
      else compare(left[index] as ManifestValue, right[index] as ManifestValue, child, into);
    }
    return;
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = [...new Set([...Object.keys(left), ...Object.keys(right)])].sort();
    for (const key of keys) {
      const child = path === '' ? `$.${key}` : `${path}.${key}`;
      const a = left[key];
      const b = right[key];
      if (a === undefined) into.push(`${child}: absent in the TS manifest`);
      else if (b === undefined) into.push(`${child}: absent in the JSON manifest`);
      else compare(a, b, child, into);
    }
    return;
  }
  if (isPlainObject(left) || isPlainObject(right)) {
    into.push(`${at}: a ${shape(left)} in the TS manifest, a ${shape(right)} in the JSON`);
    return;
  }
  into.push(`${at}: ${JSON.stringify(left)} in the TS manifest, ${JSON.stringify(right)} in the JSON`);
}

function shape(value: ManifestValue): string {
  if (Array.isArray(value)) return 'list';
  if (value === null) return 'null';
  return isPlainObject(value) ? 'object' : typeof value;
}

/** One file the build wrote, as the CLI reads it from disk (`WP-120-12`'s `verify --deep` supplies these). */
export interface ManifestAssetFile {
  readonly path: string;
  readonly bytes: number;
  readonly sha256: string;
}

export interface ManifestFinding {
  readonly kind: 'unreferenced' | 'missing' | 'mismatch';
  readonly detail: string;
}

/**
 * `CMP` §4.7's two verification rows as a pure function over a manifest and a file list: every `assets/` file is
 * referenced by the manifest and vice versa, and every byte count and hash the manifest states matches the file
 * it points at.
 *
 * A reference is a string value beginning `assets/`; `AST-R043`'s ban on absolute paths is enforced in the same
 * walk, because that is where an absolute path would do damage. Where the object holding the reference also
 * states `bytes` or `sha256` — the atlas, sound and video variant shapes — those are checked; where it states
 * neither, as a font atlas or a gradient ramp does, the reference is counted and not verified, which is the
 * honest result rather than a pass that looked like a hash check.
 */
export function checkManifestAssets(
  manifest: ManifestValue,
  files: readonly ManifestAssetFile[],
): readonly ManifestFinding[] {
  const references = new Map<string, { bytes: number | null; sha256: string | null }>();
  const absolute: string[] = [];
  const visit = (node: ManifestValue): void => {
    if (typeof node === 'string') {
      // A reference can also stand alone — a list of chunk paths, say — and where it has no enclosing object to
      // state a hash, it is counted without being verified. The guard is what matters: an object branch may
      // already have recorded this path *with* its `bytes`/`sha256`, and overwriting that would silently turn a
      // verifiable reference into an unverifiable one.
      if (node.startsWith('assets/') && !references.has(node)) references.set(node, { bytes: null, sha256: null });
      if (isAbsolutePath(node)) absolute.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item);
      return;
    }
    if (!isPlainObject(node)) return;
    const bytes = typeof node.bytes === 'number' ? node.bytes : null;
    const sha256 = typeof node.sha256 === 'string' ? node.sha256 : null;
    for (const value of Object.values(node)) {
      if (typeof value === 'string' && value.startsWith('assets/')) {
        references.set(value, { bytes, sha256 });
      }
      visit(value);
    }
  };
  visit(manifest);

  const findings: ManifestFinding[] = [];
  const written = new Map<string, ManifestAssetFile>();
  for (const file of files) {
    written.set(file.path, file);
    if (!references.has(file.path)) {
      findings.push({ kind: 'unreferenced', detail: `${file.path} is on disk but the manifest never names it` });
    }
  }
  for (const value of absolute) {
    findings.push({ kind: 'mismatch', detail: `${value} is an absolute path, which AST-R043 forbids in a manifest` });
  }
  for (const [reference, stated] of references) {
    const file = written.get(reference);
    if (file === undefined) {
      findings.push({ kind: 'missing', detail: `the manifest names ${reference}, which this build did not write` });
      continue;
    }
    if (stated.bytes !== null && stated.bytes !== file.bytes) {
      findings.push({
        kind: 'mismatch',
        detail: `${reference}: the manifest says ${stated.bytes} bytes, the file is ${file.bytes}`,
      });
    }
    if (stated.sha256 !== null && stated.sha256 !== file.sha256) {
      findings.push({
        kind: 'mismatch',
        detail: `${reference}: the manifest says sha256 ${stated.sha256.slice(0, 12)}…, the file is ${file.sha256.slice(0, 12)}…`,
      });
    }
  }
  return findings.sort((a, b) => (a.detail < b.detail ? -1 : a.detail > b.detail ? 1 : 0));
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith('/') || value.startsWith('\\') || /^[A-Za-z]:[\\/]/u.test(value);
}
