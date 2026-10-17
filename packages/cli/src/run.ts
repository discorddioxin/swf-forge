/**
 * Pipeline assembly: the CLI's one job, stated as the list of stages and passes this build registers.
 *
 * The order is `CMP-§2`'s, and the runner enforces it (`STAGE_ORDER`, `PASS_ORDER`), so what the CLI decides is
 * only *which* stages exist. `read`, `model`, `analyze`, `emit` and `report` are the five whose suppliers have
 * landed; `decode` and `plan` stay unregistered, and the runner turns that into the `STAGE_UNIMPLEMENTED` info
 * diagnostic naming them — which is not noise but the plan's own headline: media is not decoded in this build.
 *
 * The passes are all four that exist, in `PASS_ORDER` minus `tier-finalise`, which the runner documents as a pass
 * nothing in P6 supplies. A plan runs them too: `--dry-run` skips the stages after `plan`, and the "what would be
 * shaken out" answer *is* the pass decisions, so skipping them would leave the dry run with nothing to say.
 *
 * The cache lives at `<cwd>/.forge/cache`, never inside `--out`. `CMP-§12` puts it in the project's `.forge/`,
 * which is right for a project; for a tool pointed at any input, a cache in `--out` would make two builds into
 * two different directories (`build-info.json` records the cache), and `verify --deep`'s determinism comparison is
 * a byte-for-byte diff over exactly those directories. `CMP-R015`'s key derivation does not care where the entries
 * sit, so the location is free to be the one that keeps both claims true.
 */
import { hostname as hostnameOf } from 'node:os';
import { join } from 'node:path';

import {
  CACHE_DIRNAME,
  analyzeStage,
  deadCodePass,
  emitStage,
  fileStageCache,
  framesPass,
  modelStage,
  namesPass,
  nullCache,
  readStage,
  reportStage,
  runPipeline,
  shakePass,
} from '@swf-forge/compile';
import type { CancellationToken, ForgeConfig, Pass, RunResult, Stage, StageCache } from '@swf-forge/compile';
import { DiagnosticSink } from '@swf-forge/swf';

import type { StageFlags, SwitchPatch } from './args.js';
import { TOOL_VERSION } from './version.js';

export interface BuildRunOptions {
  readonly name: string;
  readonly bytes: Uint8Array;
  readonly config: ForgeConfig;
  readonly switches: SwitchPatch;
  readonly stage: StageFlags;
  /** Where cache entries go; `null` disables the cache without disabling the run. */
  readonly cacheDir: string | null;
  readonly cancel?: CancellationToken;
  readonly cwd: string;
}

/** The cache directory a run uses — `CMP-§12`'s location, resolved against the working directory. */
export function cacheDirectory(cwd: string): string {
  return join(cwd, CACHE_DIRNAME);
}

/** The stages this build registers, in `CMP-§2`'s order (the runner re-sorts, so the order here is documentation). */
export function stagesFor(options: BuildRunOptions): readonly Stage[] {
  return [
    // `CMP-§5`'s recovery ladder, with the strictness the flags asked for.
    readStage(options.name, { strict: options.stage.strict, strictLength: options.stage.strictLength }),
    modelStage({ strictTimeline: options.stage.strictTimeline }),
    // `legacyEncoding` has no flag and no `forge.config.json` field (`CMP-§3` does not name one), so the stage
    // keeps its own default and `--verbose` prints what that default resolved to.
    analyzeStage({}),
    emitStage({ sourceMaps: options.stage.sourceMaps }),
    // The report stage's other four inputs have no flag and no config key in this build; see `SF0509` and
    // `E-053`. `hostName` is the one the CLI can supply honestly, and only because the process knows its own host.
    reportStage({ hostName: hostname() }),
  ];
}

/** The passes this build registers. `tier-finalise` is absent because nothing in P6 supplies it. */
export function passesFor(): readonly Pass[] {
  return [deadCodePass(), shakePass(), namesPass(), framesPass()];
}

function hostname(): string {
  try {
    // `os.hostname()` is the only environment read the CLI performs, and it is read *for the report*, whose
    // whole job is to name the host a project was built on (`IMPL-120-R020`).
    return hostnameOf();
  } catch {
    return 'unknown host';
  }
}

/**
 * Run the pipeline over one input.
 *
 * Nothing here catches: `runPipeline` records a stage that throws as `failed` with the error's message, and a
 * `PipelineError` that escapes the *runner* (a duplicate registration, a missing supplier artifact) is our bug,
 * which `cli.ts` reports at exit 5. The sink is passed in so a test can assert the run's diagnostics without a
 * second read of the result.
 */
export function runBuild(options: BuildRunOptions, cache?: StageCache): RunResult {
  const switches: SwitchPatch = { ...options.switches };
  // `CMP-§8`'s `--dry-run` is a stage-order fact, not a separate code path: the runner skips everything after
  // `plan` and reports `status: 'dry-run'`, which is the same verdict the verb `plan` prints.
  const sink = new DiagnosticSink();
  return runPipeline({
    input: options.bytes,
    inputName: options.name,
    config: options.config,
    toolVersion: TOOL_VERSION,
    stages: stagesFor(options),
    passes: passesFor(),
    switches,
    diagnostics: sink,
    ...(options.cancel === undefined ? {} : { cancel: options.cancel }),
    cache:
      cache !== undefined
        ? cache
        : switches.noCache === true || options.cacheDir === null
          ? nullCache()
          : fileStageCache({ dir: options.cacheDir }),
  });
}
