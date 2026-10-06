/**
 * `forge-decompile` argument table and wiring (`TECH-SPEC` §3.2: no business logic in this file).
 *
 * Verbs (`TECH-SPEC` §5.2): `inspect` and `dump` (implemented), `diff`, `assets` (their own work
 * packages). Unknown verbs are rejected rather than guessed at, and every failure path returns one of
 * `CMP-R029`'s exit codes.
 */

import { SwfReadError } from '@swf-forge/swf';

import { runDump } from './commands/dump.js';
import { runInspect } from './commands/inspect.js';
import { runAssetsDump } from './assets/dump.js';
import { EXIT, type CliIo } from './exit.js';

export { EXIT, exitForDiagnostics } from './exit.js';
export type { CliIo } from './exit.js';

export const USAGE = `forge-decompile — inspect a SWF and report what it contains

Usage:
  forge-decompile inspect <file.swf> [--json] [--verbose] [--actions] [--tags] [--symbols] [--shapes] [--strict] [--tolerate-length] [--strict-timeline]
  forge-decompile dump <file.swf> [--json] [--verbose] [--strict] [--tolerate-length] [--strict-timeline] [--import <url>=<file.swf>]... [--out <dir>]
  forge-decompile assets dump <file.swf> --out <dir>
  forge-decompile <command> --help

Commands:
  inspect   header, timeline, dictionary and diagnostics for one file
  dump      the whole movie model: header, dictionary, every frame, control tags, diagnostics
  assets dump  deterministic build-time previews and a relative asset manifest

Options:
  --json        machine-readable output on stdout (stable field order)
  --verbose     include info-level diagnostics and per-frame sprite detail
  --actions     inspect: run the AVM1 front end and print the disassembly (SF1000 -> exit 3)
  --tags        inspect: list every indexed tag (index, code, depth, sprite, offset, length)
  --symbols     inspect: print the export/import name tables in full
  --shapes      inspect: report decoded static-shape bounds, path counts and stable geometry hashes
  --strict      fail on FileLength mismatch and structural read errors where supported
  --tolerate-length  keep FileLength mismatch as a warning (default; overrides --strict for length only)
  --strict-timeline  report removals at empty depths (SF0127, info) instead of silent no-ops
  --import URL=FILE  dump: add a SWF to the import input set under its published URL (repeatable)
  --out <dir>   dump: write <dir>/model.json (same bytes as --json) and print a summary

Exit codes:
  0 ok · 1 error diagnostics · 2 unreadable or not a SWF · 3 AVM2 content · 5 internal error`;

/** Flags that take a value, so `--out dir` does not turn `dir` into a file argument. */
const VALUE_FLAGS = new Set(['--out']);

interface ParsedArgs {
  readonly flags: ReadonlySet<string>;
  readonly values: ReadonlyMap<string, string>;
  readonly imports: readonly string[];
  readonly files: readonly string[];
}

function parseArgs(args: readonly string[]): ParsedArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const imports: string[] = [];
  const files: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const argument = args[i] ?? '';
    if (!argument.startsWith('--')) {
      files.push(argument);
      continue;
    }
    const eq = argument.indexOf('=');
    const name = eq === -1 ? argument : argument.slice(0, eq);
    if (name === '--import') {
      if (eq !== -1) {
        imports.push(argument.slice(eq + 1));
      } else {
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          imports.push(next);
          i += 1;
        } else {
          imports.push('');
        }
      }
      continue;
    }
    if (VALUE_FLAGS.has(name)) {
      if (eq !== -1) {
        values.set(name, argument.slice(eq + 1));
      } else {
        const next = args[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          values.set(name, next);
          i += 1;
        }
      }
      continue;
    }
    flags.add(name);
  }
  return { flags, values, imports, files };
}

export function runCli(argv: readonly string[], io: CliIo): number {
  const [verb, ...rest] = argv;
  const { flags, values, imports, files } = parseArgs(rest);

  if (verb === undefined || verb === '--help' || verb === '-h') {
    io.out(USAGE);
    return verb === undefined ? EXIT.unreadable : EXIT.ok;
  }

  if (verb === '--version' || verb === '-v') {
    io.out('forge-decompile 0.0.0');
    return EXIT.ok;
  }

  try {
    switch (verb) {
      case 'inspect': {
        const file = files[0];
        if (file === undefined || flags.has('--help')) {
          io.out(USAGE);
          return file === undefined ? EXIT.unreadable : EXIT.ok;
        }
        return runInspect(
          {
            file,
            json: flags.has('--json'),
            verbose: flags.has('--verbose'),
            actions: flags.has('--actions'),
            tags: flags.has('--tags'),
            symbols: flags.has('--symbols'),
            shapes: flags.has('--shapes'),
            strict: flags.has('--strict'),
            strictLength: flags.has('--strict') && !flags.has('--tolerate-length'),
            strictTimeline: flags.has('--strict-timeline'),
          },
          io,
        );
      }
      case 'dump': {
        const file = files[0];
        if (file === undefined || flags.has('--help')) {
          io.out(USAGE);
          return file === undefined ? EXIT.unreadable : EXIT.ok;
        }
        return runDump(
          {
            file,
            json: flags.has('--json'),
            verbose: flags.has('--verbose'),
            strict: flags.has('--strict'),
            strictLength: flags.has('--strict') && !flags.has('--tolerate-length'),
            strictTimeline: flags.has('--strict-timeline'),
            out: values.get('--out') ?? null,
            imports,
          },
          io,
        );
      }
      case 'assets': {
        if (flags.has('--help')) {
          io.out(USAGE);
          return EXIT.ok;
        }
        if (files[0] !== 'dump') {
          io.err('assets requires the `dump` subcommand');
          io.err(USAGE);
          return EXIT.unreadable;
        }
        const file = files[1];
        const out = values.get('--out');
        if (file === undefined || out === undefined || files.length !== 2) {
          io.err('usage: forge-decompile assets dump <file.swf> --out <dir>');
          return EXIT.unreadable;
        }
        return runAssetsDump({ file, out }, io);
      }
      case 'diff':
        io.err('diff: not implemented yet');
        return EXIT.internal;
      default:
        io.err(`unknown command "${verb}"`);
        io.err(USAGE);
        return EXIT.unreadable;
    }
  } catch (error) {
    if (error instanceof SwfReadError) {
      io.err(error.message);
      return EXIT.failed;
    }
    io.err(`internal error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    return EXIT.internal;
  }
}
