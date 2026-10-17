/**
 * `@swf-forge/cli` — the `swfforge` command line, exported as a library.
 *
 * The barrel exists because the CLI's pieces are worth testing and reusing individually, and because
 * `REPO-R002` says nothing outside a package reaches into `src/`: a test that imported `../src/args.js` directly
 * would be a test that could not be run against a published tarball. `main.ts` is deliberately *not* re-exported
 * through a value that its module body touches — see its header for the guard — so importing this barrel never
 * starts a build.
 *
 * The bin itself is `dist/main.js`; nothing in here is on the emission path, so a consumer that imports the
 * library gets pure functions plus the two `node:fs`-using modules (`disk.ts`, `commands/prepare.ts`) that the
 * package exists to own.
 */

export { FLAGS, VERBS, flagNames, flagHelp, parseInvocation } from './args.js';
export type { FlagSpec, Invocation, SourceMapMode, StageFlags, Verb } from './args.js';

export { runCli, usageText } from './cli.js';
export type { CliRequest } from './cli.js';

export {
  CONFIG_FILENAME,
  configArtifact,
  configToJson,
  insideOutDir,
  loadConfigFile,
  mergeConfig,
  resolveLayers,
} from './config.js';
export type { LoadedConfig } from './config.js';

export type { CommandContext, CommandResult } from './context.js';

export { EXIT, USAGE_EXIT, exitForRun, exitForVerify, worseExit } from './exit.js';
export type { CliIo, ExitDecision, FailOn, RunFacts } from './exit.js';

export { KILLED_BY_INTERRUPT, invokedAsBin, main } from './main.js';

export { stdioWriter } from './stdio.js';
export type { LineWriter } from './stdio.js';

export { CLI_JSON_SCHEMA_VERSION, diagnosticRows, envelope } from './json.js';

export { ProjectTreeError, readTree, writeCrashBundle, writeOut, WriteCancelled } from './disk.js';
export type { OutFile, ReadTreeOptions, WriteOptions, WriteOutcome } from './disk.js';

export { cacheDirectory, passesFor, runBuild, stagesFor } from './run.js';
export type { BuildRunOptions } from './run.js';

export { TOOL_NAME, TOOL_VERSION } from './version.js';

export { REPORT_FILES, displayName, prepareInvocation } from './commands/prepare.js';
export type { Prepared, PreparedResult } from './commands/prepare.js';
export { buildCommand, crashReport } from './commands/build.js';
export { planCommand, planView } from './commands/plan.js';
export { inspectCommand } from './commands/inspect.js';
export { verifyCommand } from './commands/verify.js';
export { reportCommand } from './commands/report.js';

export { formatSize, passView, rows, runSummary, runView, stageView, tableView } from './view.js';
export type { View } from './view.js';
