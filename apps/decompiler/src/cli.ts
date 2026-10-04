/**
 * `forge-decompile` argument table and wiring (`TECH-SPEC` §3.2: no business logic in this file).
 *
 * Verbs (`TECH-SPEC` §5.2): `inspect` and `dump` (implemented), `diff`, `assets` (their own work
 * packages). Unknown verbs are rejected rather than guessed at, and every failure path returns one of
 * `CMP-R029`'s exit codes.
 */

import { runDump } from './commands/dump.js';
import { runInspect } from './commands/inspect.js';
import { EXIT, type CliIo } from './exit.js';

export { EXIT, exitForDiagnostics } from './exit.js';
export type { CliIo } from './exit.js';

export const USAGE = `forge-decompile — inspect a SWF and report what it contains

Usage:
  forge-decompile inspect <file.swf> [--json] [--verbose]
  forge-decompile dump <file.swf> [--json] [--verbose] [--out <dir>]
  forge-decompile <command> --help

Commands:
  inspect   header, timeline, dictionary and diagnostics for one file
  dump      the whole movie model: header, dictionary, every frame, control tags, diagnostics

Options:
  --json        machine-readable output on stdout (stable field order)
  --verbose     include info-level diagnostics and per-frame sprite detail
  --out <dir>   dump: write <dir>/model.json (same bytes as --json) and print a summary

Exit codes:
  0 ok · 1 error diagnostics · 2 unreadable or not a SWF · 3 AVM2 content · 5 internal error`;

/** Flags that take a value, so `--out dir` does not turn `dir` into a file argument. */
const VALUE_FLAGS = new Set(['--out']);

interface ParsedArgs {
  readonly flags: ReadonlySet<string>;
  readonly values: ReadonlyMap<string, string>;
  readonly files: readonly string[];
}

function parseArgs(args: readonly string[]): ParsedArgs {
  const flags = new Set<string>();
  const values = new Map<string, string>();
  const files: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    const argument = args[i] ?? '';
    if (!argument.startsWith('--')) {
      files.push(argument);
      continue;
    }
    const eq = argument.indexOf('=');
    const name = eq === -1 ? argument : argument.slice(0, eq);
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
  return { flags, values, files };
}

export function runCli(argv: readonly string[], io: CliIo): number {
  const [verb, ...rest] = argv;
  const { flags, values, files } = parseArgs(rest);

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
        return runInspect({ file, json: flags.has('--json'), verbose: flags.has('--verbose') }, io);
      }
      case 'dump': {
        const file = files[0];
        if (file === undefined || flags.has('--help')) {
          io.out(USAGE);
          return file === undefined ? EXIT.unreadable : EXIT.ok;
        }
        return runDump(
          { file, json: flags.has('--json'), verbose: flags.has('--verbose'), out: values.get('--out') ?? null },
          io,
        );
      }
      case 'diff':
      case 'assets':
        io.err(`${verb}: not implemented yet (see docs/impl/decompiler/070)`);
        return EXIT.internal;
      default:
        io.err(`unknown command "${verb}"`);
        io.err(USAGE);
        return EXIT.unreadable;
    }
  } catch (error) {
    io.err(`internal error: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
    return EXIT.internal;
  }
}
