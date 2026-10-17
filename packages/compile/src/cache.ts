/**
 * The content-keyed stage cache — `WP-120-02`, `IMPL-120-R002`, `CMP` §12, `CMP-R038`–`R040`.
 *
 * Layout is one JSON file per key under `.forge/cache/` (`CMP` §12; gitignored — a cache is never
 * committed, and a stale one on a fresh clone is worse than none). The key is `CMP` §12's
 * `sha256(stageId ‖ stageInputHash ‖ toolVersion ‖ relevantConfigHash)`, computed by the runner
 * (`stageCacheKey`), so the store never has to know what went into it.
 *
 * An entry stores the full stage output *plus* the metadata that makes it falsifiable (`CMP-R038`): the
 * declared effect set, the tool version, the input hash and the relevant-config hash. The key already
 * covers the last three, so a mismatch on them means the store was moved between projects or the key
 * derivation changed — either way the entry is not the one this run asked for, and the runner evicts it
 * rather than trusting it. The effect set is *not* in the key, and that is the point: a stage that starts
 * writing an extra file has the same key it always had, so comparing effects is what detects that entry as
 * stale.
 *
 * This is the only module in the package that touches the filesystem. Stages stay pure
 * (`IMPL-120-R001`) and the runner only ever sees the injected `StageCache`, so a test can substitute an
 * in-memory one and a browser-side consumer could substitute something else entirely.
 *
 * Writes are atomic: a temp file in the same directory, then a rename. A cancelled or crashed build leaves
 * no half-written entry, which is the same property `IMPL-120-R023` requires of asset writes.
 *
 * A corrupt or unreadable entry is a **miss**, never a failure. The cache is an optimisation; a build must
 * not break because of it, and the entry is evicted so the next run is clean.
 */

import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import type { StageCache, StageCacheEntry, StageEffects, StageId } from './pipeline.js';

/** `CMP` §12's cache directory, relative to the project root. */
export const CACHE_DIRNAME = '.forge/cache';

/** Bumped when the on-disk entry shape changes; every older entry is then stale. */
export const CACHE_ENTRY_SCHEMA_VERSION = 1;

export interface FileCacheOptions {
  /** Cache directory; the CLI passes an absolute path. Defaults to `CMP` §12's `.forge/cache`. */
  readonly dir?: string;
}

export interface FileStageCache extends StageCache {
  readonly dir: string;
  /** Every key currently stored, sorted — for `swfforge report` and for tests. */
  keys(): string[];
  /** Drops every entry whose schema version is not current; returns how many were dropped. */
  prune(): number;
}

interface EntryFile {
  readonly $schemaVersion: number;
  readonly stage: StageId;
  readonly key: string;
  readonly toolVersion: string;
  readonly inputHash: string;
  readonly configHash: string;
  readonly effects: StageEffects;
  readonly payload: unknown;
}

export function fileStageCache(options: FileCacheOptions = {}): FileStageCache {
  const dir = options.dir ?? CACHE_DIRNAME;
  const pathFor = (key: string): string => join(dir, `${key}.json`);

  const read = (key: string): StageCacheEntry | null => {
    let text: string;
    try {
      text = readFileSync(pathFor(key), 'utf8');
    } catch {
      return null; // absent or unreadable: a miss, and there is nothing to evict
    }
    let parsed: EntryFile;
    try {
      const value: unknown = JSON.parse(text);
      if (typeof value !== 'object' || value === null) throw new Error('not an object');
      parsed = value as EntryFile;
    } catch {
      rmSync(pathFor(key), { force: true }); // corrupt: evict so the next run rebuilds it
      return null;
    }
    if (parsed.$schemaVersion !== CACHE_ENTRY_SCHEMA_VERSION) {
      rmSync(pathFor(key), { force: true });
      return null;
    }
    return {
      stage: parsed.stage,
      key: parsed.key,
      toolVersion: parsed.toolVersion,
      inputHash: parsed.inputHash,
      configHash: parsed.configHash,
      effects: parsed.effects,
      payload: parsed.payload,
    };
  };

  return {
    dir,
    get: (key) => read(key),
    put: (key, entry) => {
      const file: EntryFile = {
        $schemaVersion: CACHE_ENTRY_SCHEMA_VERSION,
        stage: entry.stage,
        key,
        toolVersion: entry.toolVersion,
        inputHash: entry.inputHash,
        configHash: entry.configHash,
        effects: entry.effects,
        payload: entry.payload,
      };
      mkdirSync(dir, { recursive: true });
      const temp = pathFor(`${key}.tmp-${process.pid}`);
      writeFileSync(temp, `${JSON.stringify(file, null, 1)}\n`, 'utf8');
      renameSync(temp, pathFor(key));
    },
    delete: (key) => {
      rmSync(pathFor(key), { force: true });
    },
    keys: () => storedNames(dir).map((name) => name.slice(0, -'.json'.length)),
    prune: () => {
      let dropped = 0;
      for (const name of storedNames(dir)) {
        const path = join(dir, name);
        try {
          const parsed = JSON.parse(readFileSync(path, 'utf8')) as { $schemaVersion?: unknown };
          if (parsed.$schemaVersion !== CACHE_ENTRY_SCHEMA_VERSION) {
            rmSync(path, { force: true });
            dropped += 1;
          }
        } catch {
          rmSync(path, { force: true });
          dropped += 1;
        }
      }
      return dropped;
    },
  };
}

/** The sorted entry filenames in a cache directory; empty when there is no directory yet. */
function storedNames(dir: string): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return [];
  }
  return names.filter((name) => name.endsWith('.json')).sort();
}
