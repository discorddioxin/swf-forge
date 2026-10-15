/**
 * Residual blobs and entry descriptors (`WP-120-09`, `IMPL-120-R018`).
 *
 * A block this phase cannot lower still has to run. The answer is not a half-translated function: it is the
 * block's **original bytes, verbatim**, plus a descriptor carrying what the interpreter would otherwise have to
 * recover by parsing — its parameters, its register slots, its preload flags and its constant pool. The
 * interpreter starts from a validated structure instead of a byte stream, which is what lets `IMPL-130-R025`
 * check a whole descriptor once at load rather than chase offsets while a frame is running.
 *
 * Three decisions here are not forced by the spec:
 *
 * 1. **The blob is the file's own tag stream, not a re-serialization.** `IMPL-050-R068` forbids re-emitting
 *    reserved or undefined opcodes, and bytes copied out of the decompressed stream are by definition not
 *    re-encoded. The `ActionIR` slice offsets are block-relative while `byteRange` is the block's absolute span,
 *    so the blob is `body.subarray(start, end)` and the slices already index it correctly — no rebasing step,
 *    and no second source of truth about where an action begins.
 * 2. **The emitter validates the descriptor instead of shipping one the runtime will refuse.** `IMPL-130-R025`
 *    is the backstop; a build that emits a descriptor the interpreter rejects has moved a front-end bug into
 *    the player, where it reads as a black screen. Every slice is checked against the blob and the block's own
 *    `residual` list (`IMPL-050-R057`) is cross-checked against the slices recomputed from the CFG. A
 *    disagreement emits no blob, is reported as `SF0505`, and leaves the block in the deferred set.
 * 3. **A residual module imports nothing but the contract type.** `CMP-R027` requires the interpreter to sit on
 *    a separate import path so a bundler can drop it, so the emitted side carries data only. The decision to
 *    interpret belongs to whoever reads the table; a movie with no residual entries tree-shakes the interpreter
 *    without the emitter knowing anything about it.
 *
 * The policy is `ForgeConfig.vm.residual`: `on-demand` emits a blob only where lowering failed, `always` emits
 * one for every block so the two execution paths can be compared, and `forbid` emits none and fails the build
 * (`IMPL-050-R060`, `CMP-R026`).
 */

import { residualSlices, type ActionIR } from '@swf-forge/avm1';
import type { SwfFile } from '@swf-forge/swf';

import { formatBytes, formatString, objectLiteral, objectLiteralInline, type Chunk } from './source.js';

/** `ForgeConfig.vm.residual`, spelled here so `files.ts` need not import the config module. */
export type ResidualPolicy = 'forbid' | 'on-demand' | 'always';

/** One block that needs a residual entry. */
export interface ResidualRequest {
  readonly ir: ActionIR;
  /** `block:<ir.id>`, the subject id the name table and the decision list use. */
  readonly subjectId: string;
  /** Why this block is residual: a lowering refusal, or `parity` under `--vm.residual=always`. */
  readonly reason: string;
}

export interface ResidualBlob {
  /** Path inside the emitted project, `src/residual/<file>.bytecode.ts`. */
  readonly path: string;
  /** The module body; `files.ts` wraps it in the generated header and the contract import. */
  readonly chunks: readonly Chunk[];
  readonly subjectId: string;
  /** The name an importing module binds `entry` to — unique per block, so one file can import many. */
  readonly entrySymbol: string;
  readonly reason: string;
  /** Blob length in bytes. `CMP-R026` requires a T2 function to be reported with its original byte count. */
  readonly bytes: number;
  readonly sliceCount: number;
  readonly tier: number;
}

export interface ResidualBuildResult {
  readonly blobs: readonly ResidualBlob[];
  /** One per block that could not get a blob: the report needs the reason, not only the count. */
  readonly invalid: readonly { readonly subjectId: string; readonly error: string }[];
}

/** `block:frame_0_7` → `frame_0_7`. A subject the printer cannot carry through a path survives as `block_…`. */
function idPart(subjectId: string, ir: ActionIR): string {
  const raw = subjectId.startsWith('block:') ? subjectId.slice('block:'.length) : ir.id;
  const safe = raw.replace(/[^A-Za-z0-9_$]/gu, '_');
  return safe.length > 0 ? safe : `block_${ir.id.replace(/[^A-Za-z0-9_$]/gu, '_')}`;
}

function paramLiteral(name: string, register: number | null): string {
  return objectLiteralInline([
    ['name', formatString(name)],
    ['register', register === null ? 'null' : String(register)],
  ]);
}

/**
 * The entry descriptor: `IMPL-120-R018`'s four fields (`params`, `registers`, `preloads`, `constants`) plus the
 * block-relative slices the interpreter enters, the source range it came from, and the reason it is residual.
 *
 * `bytecode` names the module's own `bytes` export rather than repeating the literal, so a blob has exactly one
 * spelling in the output and a diff of the table never touches the bytes. `sourceOffset`/`sourceLength` are not
 * needed to execute anything: they are there so `verify` can re-derive a blob from the source file and prove the
 * emitter did not drift (`IMPL-120-R002`'s idea applied to a residual path).
 */
export function descriptorLiteral(ir: ActionIR, reason: string): string {
  const slices = residualSlices(ir.blocks).map((slice) =>
    objectLiteralInline([
      ['block', String(slice.blockId)],
      ['offset', String(slice.offset)],
      ['length', String(slice.length)],
      // `residualSlices` drops zero-length slices, so this flag only ever marks a region the interpreter has to
      // step over without entering it. It is written for every slice: a field the runtime defaults is a field the
      // emitted and interpreted paths can disagree about, and `exactOptionalPropertyTypes` in the output would
      // make an omitted required boolean a type error rather than a false.
      ['unreachable', slice.unreachable === true ? 'true' : 'false'],
    ]),
  );
  const preloads = ir.preloads;
  return objectLiteral([
    ['kind', formatString(ir.kind)],
    ['subject', formatString(`block:${ir.id}`)],
    ['bytecode', 'bytes'],
    ['sourceOffset', String(ir.byteRange.start)],
    ['sourceLength', String(ir.byteRange.end - ir.byteRange.start)],
    ['params', `[${ir.params.map((param) => paramLiteral(param.name, param.register)).join(', ')}]`],
    ['registers', String(ir.registers)],
    [
      'preloads',
      objectLiteralInline([
        ['this', preloads.this === true ? 'true' : 'false'],
        ['arguments', preloads.arguments === true ? 'true' : 'false'],
        ['super', preloads.super === true ? 'true' : 'false'],
        ['root', preloads.root === true ? 'true' : 'false'],
        ['parent', preloads.parent === true ? 'true' : 'false'],
        ['global', preloads.global === true ? 'true' : 'false'],
      ]),
    ],
    ['constants', `[${ir.constants.map((value) => formatString(value)).join(', ')}]`],
    ['slices', `[${slices.join(', ')}]`],
    // `AVM1-R006`: a block whose terminating `End` was missing has to stop at the length, not at a sentinel
    // that is not there, so the flag is always written.
    ['terminated', ir.terminated === true ? 'true' : 'false'],
    ['residualReason', formatString(reason)],
  ]);
}

/**
 * Everything that would make a descriptor lie about its blob, or a blob about the file it came from. `null`
 * means the pair is sound. The bounds are checked against the blob because that is the coordinate system the
 * slices live in.
 */
export function descriptorProblem(file: SwfFile, ir: ActionIR, bytes: Uint8Array): string | null {
  if (bytes.length === 0) return 'the block covers no bytes, so there is nothing for the interpreter to run';
  if (ir.byteRange.end > file.body.length) {
    return `the block's byte range ends at ${ir.byteRange.end}, past the ${file.body.length}-byte tag stream`;
  }
  const slices = residualSlices(ir.blocks);
  if (slices.length === 0) return 'the block has no executable basic block, so no slice can be entered';
  for (const slice of slices) {
    if (slice.offset < 0 || slice.length <= 0 || slice.offset + slice.length > bytes.length) {
      return `slice ${slice.offset}+${slice.length} for block ${slice.blockId} is outside the ${bytes.length}-byte blob`;
    }
  }
  if (ir.residual !== null) {
    const key = (list: readonly { blockId: number; offset: number; length: number }[]): string =>
      list.map((slice) => `${slice.blockId}:${slice.offset}:${slice.length}`).join(',');
    const recorded = key([...ir.residual]);
    const recomputed = key(slices);
    if (recorded !== recomputed) {
      return `the front end's residual slices [${recorded}] disagree with the CFG's [${recomputed}]`;
    }
  }
  if (!Number.isInteger(ir.registers) || ir.registers < 0 || ir.registers > 256) {
    return `a register count of ${ir.registers} is outside the 0..256 a DefineFunction2 header can name`;
  }
  for (const param of ir.params) {
    if (param.register !== null && (param.register < 0 || param.register > ir.registers)) {
      return `parameter ${param.name} is bound to register ${param.register}, past the ${ir.registers} slots`;
    }
  }
  return null;
}

/**
 * Builds one residual module per request, in the order given — callers pass requests sorted by subject id, so
 * the file set never depends on `Map` insertion order (`REPO-R016`). A block whose descriptor will not validate
 * is left out and reported, which keeps it deferred exactly as it was before this module existed.
 */
export function buildResidualBlobs(
  file: SwfFile,
  inputName: string,
  requests: readonly ResidualRequest[],
): ResidualBuildResult {
  const blobs: ResidualBlob[] = [];
  const invalid: { readonly subjectId: string; readonly error: string }[] = [];
  const seen = new Set<string>();
  for (const request of requests) {
    if (seen.has(request.subjectId)) continue;
    const { ir } = request;
    const start = ir.byteRange.start;
    const end = ir.byteRange.end;
    if (start < 0 || end < start) {
      invalid.push({ subjectId: request.subjectId, error: `byte range ${start}..${end} is not a span` });
      continue;
    }
    const bytes = file.body.subarray(Math.min(start, file.body.length), Math.min(end, file.body.length));
    const problem = descriptorProblem(file, ir, bytes);
    if (problem !== null) {
      invalid.push({ subjectId: request.subjectId, error: problem });
      continue;
    }
    seen.add(request.subjectId);
    const id = idPart(request.subjectId, ir);
    const chunks: Chunk[] = [
      `/** The action stream of \`${id}\`: bytes ${start}..${end} of \`${inputName}\`, copied verbatim (\`IMPL-120-R018\`). */`,
      `export const bytes: Uint8Array = ${formatBytes([...bytes])};`,
      `/** ${ir.kind} block ${ir.id} — T${ir.tier}, ${request.reason}. The interpreter runs these bytes; nothing here is re-encoded. */`,
      `export const entry: Entry = ${descriptorLiteral(ir, request.reason)};`,
    ];
    blobs.push({
      path: `src/residual/${id}.bytecode.ts`,
      chunks,
      subjectId: request.subjectId,
      entrySymbol: `entry_${id}`,
      reason: request.reason,
      bytes: bytes.length,
      sliceCount: residualSlices(ir.blocks).length,
      tier: ir.tier,
    });
  }
  return { blobs, invalid };
}

/**
 * The import line binding a blob's descriptor inside another module. Extensionless in the source tree means a
 * `.js` specifier in the output, because the emitted project resolves with `NodeNext` like everything else
 * here; `fromPath` decides how many levels to climb.
 */
export function residualImport(blob: ResidualBlob, fromPath: string): string {
  const depth = fromPath.split('/').length - 2; // `src/frames/x.ts` and `src/buttons/x.ts` are one level down
  const up = depth > 0 ? '../'.repeat(depth) : './';
  const leaf = blob.path.slice('src/'.length).replace(/\.ts$/u, '.js');
  return `import { entry as ${blob.entrySymbol} } from '${up}${leaf}';`;
}
