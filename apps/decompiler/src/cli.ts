/**
 * `forge-decompile` argument table and wiring (`TECH-SPEC` §3.2: no business logic in this file).
 *
 * Verbs (`TECH-SPEC` §5.2): `inspect` (implemented), `dump`, `diff`, `assets` (their own work
 * packages). Unknown verbs are rejected rather than guessed at, and every failure path returns one of
 * `CMP-R029`'s exit codes.
 */

import { runInspect } from './commands/inspect.js';
import { EXIT, type CliIo } from './exit.js';

export { EXIT } from './exit.js';
export type { CliIo } from './exit.js';

export const USAGE = `forge-decompile — inspect a SWF and report what it contains

Usage:
  forge-decompile inspect <file.swf> [--json] [--verbose]
  forge-decompile <command> --help

Commands:
  inspect   header, timeline, dictionary and diagnostics for one file

Options:
  --json      machine-readable summary on stdout (stable field order)
  --verbose   include info-level diagnostics and their registry meanings

Exit codes:
  0 ok · 1 error diagnostics · 2 unreadable or not a SWF · 3 AVM2 content · 5 internal error`;

function isFlag(argument: string): boolean {
  return argument.startsWith('--');
}

export function runCli(argv: readonly string[], io: CliIo): number {
  const [verb, ...rest] = argv;
  const flags = new Set(rest.filter(isFlag));
  const files = rest.filter((argument) => !isFlag(argument));

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
      case 'dump':
      case 'diff':
      case 'assets':
        io.err(`${verb}: not implemented yet (see docs/impl/decompiler/040 and 070)`);
        return EXIT.internal;
      default:
        io.err(`unknown command "${verb}"`);
        io.err(USAGE);
        return EXIT.unreadable;
    }
  } catch (error) {
    io.err(`internal error: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
    return EXIT.internal;
  }
}
