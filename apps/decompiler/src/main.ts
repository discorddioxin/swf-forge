#!/usr/bin/env node
/** `forge-decompile` entry point (`TECH-SPEC` §3.2). All logic lives in `cli.ts` and `commands/`. */
import { runCli } from './cli.js';

process.exitCode = runCli(process.argv.slice(2), {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
});
