/**
 * The only disk I/O in a build (`REPO-R004`, `IMPL-120-R023`).
 *
 * `@swf-forge/compile` returns the files a stage *wants* written and never writes them, so this module is where
 * the two rules about output files actually live:
 *
 * **Temp name, then rename** (`IMPL-120-R023`'s discipline, applied to writing). A file appears in the output
 * directory complete or not at all. That is what makes `T-CMP-006`'s "no partial files left" true rather than
 * lucky: a run interrupted mid-write leaves `*.swfforge-tmp` names behind, which no build script globs and which
 * the rollback deletes, instead of a half-written `src/frames/movie.ts` that compiles and is wrong.
 *
 * **Sorted before writing** (`REPO-R016`). The write *order* is observable in a directory listing and in the
 * `lstat` timestamps of an interrupted run, so the list is sorted here even though the emitter already sorts it —
 * two guarantees cost nothing, and a future parallel writer would otherwise get to choose.
 *
 * Reads are guarded too: `verify` and `report` are pointed at a directory a person may have made by hand, so
 * symlinks are skipped rather than followed (a link out of the tree would make `verify` audit files the build never
 * wrote) and an absurdly large file is refused with its name, because the alternative is an out-of-memory kill
 * reported as an internal error.
 */

import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';

import { TOOL_NAME } from './version.js';

import { insideOutDir } from './config.js';

export interface OutFile {
  readonly path: string;
  readonly bytes: Uint8Array;
}

export interface WriteOutcome {
  readonly written: readonly string[];
  readonly skipped: readonly string[];
}

const TEMP_SUFFIX = '.swfforge-tmp';

/** Directories a project's own layout never contains a build product in, and which must not be walked. */
const SKIPPED_DIRS = new Set(['.git', 'node_modules', '.forge', 'dist']);

export interface WriteOptions {
  readonly root: string;
  readonly files: readonly OutFile[];
  /** The paths this run may write. A refused or filtered file is reported, never silently dropped. */
  readonly filter?: (path: string) => boolean;
  /** Checked before each file: `true` stops the run, and what was already written is rolled back. */
  readonly shouldStop?: () => boolean;
}

/** A write interrupted by cancellation. The rollback has already run, so no partial file survives. */
export class WriteCancelled extends Error {
  constructor(readonly written: number) {
    super(`the run was cancelled after ${written} file(s) were written and before the rest were`);
    this.name = 'WriteCancelled';
  }
}

/**
 * Write `files` under `root`, sorted, each through a temp name.
 *
 * A failure part-way through removes every file this call created and every directory it made, then rethrows: a
 * caller that cannot finish a build should be left with the directory it had before, and the error it gets should
 * be the real one, not `ENOTEMPTY`.
 */
export function writeOut(options: WriteOptions): WriteOutcome {
  const root = resolve(options.root);
  const written: string[] = [];
  const skipped: string[] = [];
  const createdDirs: string[] = [];
  const ordered = [...options.files].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  try {
    for (const file of ordered) {
      if (options.shouldStop?.() === true) throw new WriteCancelled(written.length);
      if (!insideOutDir(root, file.path)) {
        throw new Error(`the build asked to write ${file.path}, which is outside ${options.root}`);
      }
      if (options.filter !== undefined && !options.filter(file.path)) {
        skipped.push(file.path);
        continue;
      }
      const target = join(root, file.path);
      let dir = dirname(target);
      const rootDir = resolve(root);
      const made: string[] = [];
      while (!existsSync(dir) && dir.startsWith(rootDir)) {
        made.push(dir);
        const parent = dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
      mkdirSync(rootDir, { recursive: true });
      for (const created of made.reverse()) {
        mkdirSync(created, { recursive: true });
        createdDirs.push(created);
      }
      const temp = `${target}${TEMP_SUFFIX}`;
      writeFileSync(temp, file.bytes);
      renameSync(temp, target);
      written.push(file.path);
    }
  } catch (cause) {
    for (const path of [...written].reverse()) rmSync(join(root, path), { force: true });
    for (const dir of [...createdDirs].reverse()) {
      try {
        rmSync(dir, { recursive: false, force: true });
      } catch {
        // A directory that is not empty was not made by this call; leaving it is the honest failure.
      }
    }
    throw cause;
  }
  return { written, skipped };
}

export interface ReadTreeOptions {
  readonly root: string;
  /** Refuse a larger file, naming it, rather than dying in the middle of a verification. */
  readonly maxBytes?: number;
}

export class ProjectTreeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProjectTreeError';
  }
}

/** Every regular file under `root`, with paths relative to it and `/` separators (`REPO-R015`). */
export function readTree(options: ReadTreeOptions): readonly OutFile[] {
  const root = resolve(options.root);
  const maxBytes = options.maxBytes ?? 64 * 1024 * 1024;
  if (!existsSync(root) || !lstatSync(root).isDirectory()) {
    throw new ProjectTreeError(
      `${options.root} is not a directory — run swfforge build first, or pass the project's output directory`,
    );
  }
  const files: OutFile[] = [];
  const walk = (dir: string, prefix: string): void => {
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1));
    for (const entry of entries) {
      const absolute = join(dir, entry.name);
      const path = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
      if (entry.isDirectory()) {
        if (SKIPPED_DIRS.has(entry.name)) continue;
        walk(absolute, path);
        continue;
      }
      // Not `isFile()` alone: a FIFO or socket would block the read, and a symlink could point outside the tree.
      if (!entry.isFile()) continue;
      // A dot-file is not a build product: the crash report a failed run leaves behind (`.swfforge-crash.txt`) and
      // any editor's droppings must not be walked by `verify`, or two builds would differ by whether one crashed.
      if (entry.name.startsWith('.')) continue;
      const size = lstatSync(absolute).size;
      if (size > maxBytes) {
        throw new ProjectTreeError(`${path} is ${size} bytes, over the ${maxBytes}-byte limit for a file verify reads`);
      }
      files.push({ path, bytes: new Uint8Array(readFileSync(absolute)) });
    }
  };
  walk(root, '');
  return files;
}

/**
 * The crash bundle for exit 5 (`CMP-R029`: "internal error — report the bug with the input").
 *
 * A bug in this tool is the one outcome the user cannot diagnose from a message, and the one input the run needs
 * to reproduce it is the file they just passed. So the tool writes both down, next to where the build was going to
 * put its output, in a dotted name so it is never mistaken for a project file and never globbed by a build
 * script — and `readTree` skips dot-files, which is why `verify` does not audit its own tool's crash report as a
 * project artifact. It is written through the same temp-name-then-rename discipline as everything else, and a
 * failure to write it is *not* an error: the stack is already on stderr, and a crash handler that crashes is worse
 * than a crash handler that stayed quiet.
 */
export function writeCrashBundle(root: string, report: string): string | null {
  const target = join(resolve(root), `.${TOOL_NAME}-crash.txt`);
  try {
    mkdirSync(resolve(root), { recursive: true });
    const temp = `${target}${TEMP_SUFFIX}`;
    writeFileSync(temp, report, 'utf8');
    renameSync(temp, target);
    return `.${TOOL_NAME}-crash.txt`;
  } catch {
    return null;
  }
}
