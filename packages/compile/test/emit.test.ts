/**
 * The emitter — `WP-120-08`.
 *
 * These tests read the emitted *text*, because that is the artifact: a claim about the emitter that only holds
 * for an internal data structure is worth nothing to the person who has to review the generated project. So the
 * assertions are written the way a reviewer reads — "does this file call `avm1.add` for `+` and `-` for
 * subtraction, and does it import only what it uses".
 *
 * Two of them exist because the failure modes are silent. `every frame-script call names a function that
 * exists` catches the emitter writing a call into a module for a block that was deferred (a project that does
 * not compile). `nothing off the runtime surface` catches the emitter assuming a runtime helper that nobody has
 * specified — which type-checks fine in this repo, because the runtime package is `WP-120-10`'s, and fails on
 * the first emitted build.
 */

import { existsSync, rmSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { tmpdir } from 'node:os';

import { Tag, buildMovieModel } from '@swf-forge/swf';
import { DiagnosticSink } from '@swf-forge/swf';
import { openSwfNodeSync, sha256Hex } from '@swf-forge/swf/node';
import { analyzeMovie } from '@swf-forge/avm1';
import {
  actionBlock,
  buildSwf,
  concat,
  defineSprite,
  defineTag,
  endTag,
  placeObject2,
  showFrames,
  tag,
} from '@swf-forge/swf/test-support';
import { describe, expect, it } from 'vitest';
import ts from 'typescript';

import {
  AVM1_HELPERS,
  EMITTED_BANS,
  analyzeStage,
  assessBlock,
  buildNameTable,
  emitFiles,
  emitStage,
  groupFrameScripts,
  lowerFunction,
  modelStage,
  namesPass,
  readStage,
  render,
  resolveForgeConfig,
  runPipeline,
  surfaceNames,
} from '../src/index.js';
import type { ActionIR, BasicBlock, Operand, Op, Terminator } from '@swf-forge/avm1';
import type { CharacterModel } from '@swf-forge/swf';
import type { EmitPlan } from '../src/index.js';

const TRACE = 0x26;
const STOP = 0x07;
const END = 0x00;
const GET_VARIABLE = 0x1c;
const SET_VARIABLE = 0x1d;
const ADD = 0x0a;
const SUBTRACT = 0x0b;

/** A record whose opcode has the high bit set carries a UI16 `Length` of its body (`IMPL-050` R018). */
function rec(code: number, body: readonly number[]): number[] {
  return [code, body.length & 0xff, (body.length >> 8) & 0xff, ...body];
}
function pushString(text: string): number[] {
  return rec(0x96, [0x00, ...new TextEncoder().encode(text), 0x00]);
}
/** Push type 6 is a float64; type 1 would be float32 and type 7 an SI32. */
function pushNumber(value: number): number[] {
  const view = new DataView(new ArrayBuffer(8));
  view.setFloat64(0, value, true);
  const bytes: number[] = [];
  for (let i = 0; i < 8; i += 1) bytes.push(view.getUint8(i));
  return rec(0x96, [0x06, ...bytes]);
}
function u16(value: number): number[] {
  return [value & 0xff, (value >> 8) & 0xff];
}

function outDir(): string {
  return join(tmpdir(), 'swf-forge-emit-must-not-write');
}

function doAction(records: readonly number[]): Uint8Array {
  return tag(Tag.DoAction, Uint8Array.from(actionBlock(records)));
}

/** The three operand spellings the tests need, spelled once. */
function lit(value: string): Operand {
  return { kind: 'lit', value: { type: 'string', value } };
}
function temp(id: number): Operand {
  return { kind: 'temp', id };
}

/** One live block, with the fields the emitter's refusal gate reads set to the neutral value. */
function block(id: number, ops: readonly Op[], terminator: Terminator): BasicBlock {
  return {
    id,
    ops,
    terminator,
    stackIn: 0,
    stackOut: 0,
    unreachable: false,
    target: null,
    firstOffset: id * 4,
    endOffset: id * 4 + 4,
  };
}

/** A whole `ActionIR` around the given blocks, with every field the emitter reads at its neutral default. */
function timelineIr(blocks: readonly BasicBlock[]): ActionIR {
  return {
    kind: 'timeline',
    id: 'probe_block',
    byteRange: { start: 0, end: 16 },
    blocks,
    registers: 0,
    params: [],
    preloads: { this: false, arguments: false, super: false, root: false, parent: false, global: false },
    suppress: { this: false, arguments: false, super: false },
    constants: [],
    poolIsDynamic: false,
    tier: 0,
    residualReason: null,
    tierReasons: [],
    requirements: [],
    sourceName: null,
    frameAssociations: [],
    initOrder: 0,
    terminated: true,
    residual: null,
  };
}

interface Fixture {
  readonly bytes: Uint8Array;
  readonly plan: EmitPlan;
  readonly file: ReturnType<typeof openSwfNodeSync>;
  readonly model: ReturnType<typeof buildMovieModel>;
  readonly irs: readonly ActionIR[];
  readonly table: ReturnType<typeof buildNameTable>['table'];
  readonly frames: ReturnType<typeof groupFrameScripts>;
}

/**
 * A movie: one exported shape, a `DoAction` block on frame 1, a sprite with a placement and an `init` script,
 * and a `DoInitAction` pointing at that sprite. The frames argument supplies extra movie-level blocks.
 */
function fixture(records: readonly number[] | null, extra: readonly (readonly number[])[] = []): Fixture {
  const parts = [
    defineTag(Tag.DefineShape, 10),
    defineSprite(11, 1, concat(placeObject2(10, 1), showFrames(1), endTag())),
  ];
  if (records !== null) parts.push(doAction([...records]));
  for (const block of extra) parts.push(doAction([...block]));
  parts.push(
    tag(
      Tag.DoInitAction,
      Uint8Array.from(concat(Uint8Array.from(u16(11)), actionBlock([...pushString('inside'), TRACE, STOP]))),
    ),
  );
  parts.push(showFrames(1), endTag());
  const bytes = buildSwf({ version: 8, body: concat(...parts), frameCount: 1 });

  const sink = new DiagnosticSink();
  const file = openSwfNodeSync(bytes, { sink });
  const model = buildMovieModel(file, {});
  const analysis = analyzeMovie(file, model, { emit: () => {} });
  const irs = analysis.blocks.map((block) => block.ir);
  const { table } = buildNameTable({ model, file, blocks: irs, classes: analysis.names.classes });
  const frames = groupFrameScripts({ blocks: irs, frameCount: model.frameCount, table });
  const plan = emitFiles({
    file,
    model,
    blocks: irs,
    table,
    frames,
    shake: null,
    header: { toolVersion: 'test-1', inputName: 'game.swf', sha256: sha256Hex(bytes), movie: 'main' },
  });
  return { bytes, plan, file, model, irs, table, frames };
}

function textOf(plan: EmitPlan, path: string): string {
  const file = plan.files.find((entry) => entry.path === path);
  if (file === undefined) throw new Error(`no emitted file at ${path}: ${plan.files.map((f) => f.path).join(', ')}`);
  return file.text;
}

const ARITHMETIC = [...pushString('count'), GET_VARIABLE, ...pushNumber(1), ADD, ...pushString('count'), SET_VARIABLE];
const HELLO = [...pushString('hello'), TRACE];

describe('lowering to statements', () => {
  it('turns a T0 timeline block into a frame script body', () => {
    const { plan } = fixture([...ARITHMETIC, ...HELLO, STOP, END]);
    const movie = textOf(plan, 'src/frames/movie.ts');

    expect(movie).toContain('export function frame_01(vm: Vm, target: Clip, frame: FrameCtx): void {');
    expect(movie).toContain('t0 = frame.scope.get("count");');
    expect(movie).toContain('avm1.add(t0, 1)');
    expect(movie).toContain('frame.scope.set("count", t1);');
    expect(movie).toContain('avm1.trace("hello");');
    expect(movie).toContain('target.stop();');
    expect(movie).toContain('{ frame: 1, run: frame_1 }');
  });

  it('uses a JS operator where AVM1 agrees and a helper where it does not', () => {
    // `Subtract` is "B−A" in the manual and `a - b` in our IR, because `stack.ts:1400` pops the top value into
    // `b`; `Add` is a helper because AVM1 coerces both sides while JS `+` concatenates when either is a string.
    // The left operand is a `GetVariable` result so the front end cannot fold the arithmetic into a literal,
    // which is what makes the emitted *form* observable.
    const store = [...pushString('n'), SET_VARIABLE, STOP, END];
    const minus = fixture([...pushString('n'), GET_VARIABLE, ...pushNumber(3), SUBTRACT, ...store]);
    expect(textOf(minus.plan, 'src/frames/movie.ts')).toContain('(t0 - 3)');
    expect(textOf(minus.plan, 'src/frames/movie.ts')).not.toContain('avm1.subtract');

    const plus = fixture([...pushString('n'), GET_VARIABLE, ...pushNumber(3), ADD, ...store]);
    expect(textOf(plus.plan, 'src/frames/movie.ts')).toContain('avm1.add(t0, 3)');
  });

  it('drops a folded value nobody reads instead of emitting a bare expression', () => {
    const { plan } = fixture([...pushNumber(2), ...pushNumber(3), SUBTRACT, STOP, END]);
    const movie = textOf(plan, 'src/frames/movie.ts');
    expect(movie).not.toContain('(2 - 3)');
    expect(movie).toContain('target.stop();');
  });

  it('drives several basic blocks through the pc/switch form, with the locals hoisted above it', () => {
    // `t0` is bound in block 0 and read in block 2, which both edges reach. Declaring it at its first use puts
    // the declaration inside one `case`, where the other edge cannot see it, so every temp the script binds is
    // declared before the loop. Written at the `lowerFunction` level rather than through a `.swf` fixture: a
    // hand-framed `If` record measures the *front end*'s block splitting, not the emitter's.
    const ir = timelineIr([
      // `GetTime` pushes a value and records no `result` (`E-047`), so `t1` is bound by the implicit-push
      // recovery rather than by a field on the op — the case the reconciliation gate exists to allow.
      block(0, [{ kind: 'getVariable', name: lit('n'), result: temp(0) }, { kind: 'getTime' }], {
        kind: 'branch',
        condition: temp(1),
        ifTrue: 1,
        ifFalse: 2,
      }),
      block(1, [{ kind: 'trace', value: lit('m') }], { kind: 'fallthrough', next: 2 }),
      block(2, [{ kind: 'setVariable', name: lit('k'), value: temp(0) }], { kind: 'jump', target: null }),
    ]);
    const lowered = lowerFunction(ir, { pool: null, nameForBlock: () => 'block_01' });
    expect(lowered.refusal).toBeNull();
    const text = render([...lowered.declarations, ...lowered.statements]);

    expect(text).toContain('let t0: Value = undefined;');
    expect(text.indexOf('let t0')).toBeLessThan(text.indexOf('switch (pc)'));
    expect(text).toContain('while (pc >= 0) {');
    expect(text).toContain('case 0: {');
    expect(text).toContain('case 2: {');
    expect(text).toContain('if (avm1.toBool(t1)) { pc = 1; } else { pc = 2; }');
    expect(text).toContain('default: pc = -1;');
    expect(text).toContain('frame.scope.set("k", t0);');
  });

  it('prints the constant pool only where the IR resolved it', () => {
    const { plan } = fixture([...pushString('via pool'), TRACE, STOP, END]);
    // SWF 8 pushes strings through the pool: the printer resolves `pool{index, resolved}` to the literal and
    // never to `pool[i]` when the value is known at build time.
    expect(textOf(plan, 'src/frames/movie.ts')).toMatch(/avm1\.trace\("via pool"\)/u);
  });
});

describe('deferring what cannot be lowered (WP-120-09)', () => {
  it('refuses `Enumerate` rather than inventing the iteration cursor', () => {
    // `Enumerate`'s stack effect is `1→k+1`: how many keys it pushes is a property of the runtime value, and
    // the cursor that `Pop`/`GetMember` sequences walk afterwards is state the IR does not carry. The honest
    // output is a refusal that sends the block to `WP-120-09`, not a `for (const k of avm1.keys(o))` loop that
    // happens to look right and is not AVM1.
    const ir = timelineIr([
      block(0, [{ kind: 'enumerate', code: 0x46, obj: temp(0) }], { kind: 'jump', target: null }),
    ]);
    expect(assessBlock(ir).refusal?.reason).toBe('unmodeled-op');
  });

  it('refuses a block whose operand is an unnamed stack slot', () => {
    // Emitted code is SSA: every value has a name. A `stack` operand says "whatever is on top", and giving it
    // a name is the interpreter's job, not the printer's (`040` §7 keeps the operand stack out of output).
    const ir = timelineIr([
      block(0, [{ kind: 'getMember', name: lit('k'), object: { kind: 'stack' }, result: temp(0) }], {
        kind: 'jump',
        target: null,
      }),
    ]);
    expect(assessBlock(ir).refusal?.reason).toBe('stack-operand');
  });

  it('refuses a block whose temp uses cannot be attributed to a def site', () => {
    // `t5` is read with nothing binding it: the front end pushed it from a handler that records no `result`.
    // The recovery counts implicit pushes and refuses when the numbers do not reconcile (`E-047`).
    const ir = timelineIr([
      block(0, [{ kind: 'getMember', name: lit('k'), object: temp(5), result: temp(6) }], {
        kind: 'jump',
        target: null,
      }),
    ]);
    expect(assessBlock(ir).refusal?.reason).toBe('unbound-temp');
  });

  it('drops a frame whose only block was deferred instead of emitting a dangling call', () => {
    // An unbalanced `Push` (a string with no NUL) tiers the block T2, so nothing is lowerable for frame 1.
    const { plan } = fixture([0x96, 0x03, 0x00, 0x61, STOP, END]);
    const movie = textOf(plan, 'src/frames/movie.ts');
    expect(movie).toContain('// deferred to WP-120-09');
    expect(movie).toContain('export const frameScripts: readonly FrameScript[] = [];');
    expect(plan.refused.length).toBeGreaterThan(0);
    for (const call of movie.match(/(\w+)\(vm, target, frame\);/gu) ?? []) {
      const name = call.slice(0, call.indexOf('('));
      expect(movie, `frame script calls ${name}, which is not declared in the module`).toContain(`function ${name}(`);
    }
  });

  it('reports one decision per block, with a reason, so nothing is silently missing', () => {
    const { plan } = fixture([...ARITHMETIC, ...HELLO, STOP, END]);
    const subjects = plan.decisions.map((entry) => entry.subject);
    expect(new Set(subjects).size).toBe(subjects.length);
    for (const entry of plan.decisions) {
      expect(entry.reason.length).toBeGreaterThan(0);
      expect(['emitted', 'deferred to WP-120-09']).toContain(entry.action);
    }
    expect(plan.counts.emitted + plan.counts.refused).toBe(plan.counts.blocks);
  });
});

describe('placement is data (CMP-R017)', () => {
  it('writes a sprite timeline as table rows, not as calls', () => {
    const { plan } = fixture([...ARITHMETIC, STOP, END]);
    const sprite = textOf(plan, 'src/frames/sprite_11.ts');
    expect(sprite).toContain('export const timeline: readonly TimelineTables[] = [');
    expect(sprite).toContain('{ place: true, depth: 1, character: 10');
    expect(sprite).toContain('export const initScript: FrameScript | null = init_01;');
    expect(sprite).not.toMatch(/vm\.place\(|placeObject2\(/u);
  });
});

describe('the emitted source is valid, self-contained source', () => {
  const { plan } = fixture([...ARITHMETIC, ...HELLO, STOP, END]);
  const modules = plan.files.filter((entry) => entry.path.endsWith('.ts'));

  it('parses as TypeScript', () => {
    for (const file of modules) {
      const result = ts.transpileModule(file.text, {
        reportDiagnostics: true,
        fileName: file.path,
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, isolatedModules: true },
      });
      const syntactic = (result.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error);
      expect(
        syntactic.map((d) => d.messageText),
        file.path,
      ).toEqual([]);
    }
  });

  it('imports only the names its own body references', () => {
    for (const file of modules) {
      const body = file.text.slice(file.text.indexOf('\n\n'));
      for (const line of file.text.split('\n').filter((l) => l.startsWith('import '))) {
        const names = (line.match(/\{([^}]*)\}/u)?.[1] ?? '')
          .split(',')
          .map((n) => n.trim())
          .filter((n) => n.length > 0);
        expect(names.length, `empty import in ${file.path}`).toBeGreaterThan(0);
        for (const name of names) {
          expect(
            new RegExp(`(?:^|[^\\w$.])${name}(?![\\w$])`, 'u').test(body),
            `${name} imported but unused in ${file.path}`,
          ).toBe(true);
        }
      }
    }
  });

  it('mentions no runtime identifier outside the published surface', () => {
    const allowed = surfaceNames();
    for (const file of modules) {
      for (const helper of file.text.match(/avm1\.([a-zA-Z][\w$]*)/gu) ?? []) {
        const name = helper.slice('avm1.'.length);
        expect(allowed.has(name), `${file.path} calls avm1.${name}, which no spec section publishes`).toBe(true);
        expect(AVM1_HELPERS.has(name)).toBe(true);
      }
    }
  });

  it('carries no construct the emitted project bans', () => {
    for (const file of modules) {
      expect(file.text).not.toMatch(/\beval\s*\(/u);
      expect(file.text).not.toMatch(/new Function\s*\(/u);
      expect(file.text).not.toMatch(/\bwith\s*\(/u);
      expect(file.text).not.toMatch(/new Proxy\s*\(/u);
      expect(file.text).not.toMatch(/\bawait\b/u);
      expect(file.text).not.toMatch(/\bfor\s*\(\s*(const|let|var)?\s*\w+\s+in\s/u);
      expect(file.text).not.toContain('Math.random');
      // The header may not mute the linter: the bans have to be seen by the emitted project's own build.
      expect(file.text).not.toContain('eslint-disable');
    }
  });
});

describe('the printer', () => {
  it('is deterministic across builds and does not depend on parse order', () => {
    const a = fixture([...ARITHMETIC, ...HELLO, STOP, END]);
    const b = fixture([...ARITHMETIC, ...HELLO, STOP, END]);
    expect(a.plan.files).toEqual(b.plan.files);
    expect(a.plan.files.map((entry) => entry.path)).toEqual([...a.plan.files.map((entry) => entry.path)].sort());
  });

  it('names numbers the way JS prints them, not the locale’s', () => {
    // A `.` decimal separator is what a `String()` round-trip gives, and it is what an ECMAScript source file
    // has to contain; a locale-sensitive printer would write `0,333…` and the emitted project would not parse.
    const { plan } = fixture([...pushNumber(1 / 3), ...pushString('n'), SET_VARIABLE, STOP, END]);
    expect(textOf(plan, 'src/frames/movie.ts')).toContain('frame.scope.set("n", 0.3333333333333333);');

    const negZero = fixture([...pushNumber(-0), ...pushString('z'), SET_VARIABLE, STOP, END]);
    // `-0` survives: `String(-0)` is `"0"`, which would silently change the value the movie stored.
    expect(textOf(negZero.plan, 'src/frames/movie.ts')).toContain('frame.scope.set("z", -0);');
  });

  it('writes the generated header on every module, and none of it in JSON', () => {
    for (const file of plan_files()) {
      if (file.path.endsWith('.json') || file.path.endsWith('.mjs')) {
        expect(file.text).toContain(`AUTO-GENERATED by swf-forge test-1`);
      } else {
        expect(file.text.startsWith('// AUTO-GENERATED')).toBe(true);
        expect(file.text).toContain('Source: game.swf (sha256:');
      }
    }
  });
});

function plan_files(): readonly { path: string; text: string }[] {
  return fixture([...ARITHMETIC, STOP, END]).plan.files;
}

describe('scaffolding (IMPL-120-R014/R015)', () => {
  it('ships the ban list as errors, generated from the same entries the tests read', () => {
    const { plan } = fixture([...ARITHMETIC, STOP, END]);
    const eslint = textOf(plan, 'eslint.config.mjs');
    for (const ban of EMITTED_BANS) {
      expect(eslint, `missing emitted-project rule ${ban.rule}`).toContain(ban.marker);
    }
    expect(EMITTED_BANS.length).toBeGreaterThanOrEqual(9);
    expect(eslint).toContain("'error'");

    const tsconfig = JSON.parse(readText(plan, 'tsconfig.json'));
    expect(tsconfig.compilerOptions).toMatchObject({
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      noImplicitOverride: true,
      verbatimModuleSyntax: true,
    });

    const pkg = JSON.parse(readText(plan, 'package.json'));
    expect(Object.keys(pkg.dependencies).sort()).toEqual(['@swf-forge/avm1', '@swf-forge/runtime']);
  });
});

function readText(plan: EmitPlan, path: string): string {
  const stripped = textOf(plan, path)
    .split('\n')
    .filter((line) => !line.startsWith('//'))
    .join('\n');
  return stripped;
}

describe('buttons and classes', () => {
  it('emits a handler table for a button whose record has no block, and a name-only class entry', () => {
    // These two modules are the files a `.swf` fixture cannot reach without hand-framing a `DefineButton2`,
    // and a hand-framed button measures my guessing rather than the emitter. So the model is extended with a
    // real decoded character re-labelled: a `ButtonActionRecord` whose `actionBytes.offset` names no block is
    // the corpus state `E-044` describes (a button record whose block was never scheduled), and the output has
    // to say so rather than write an empty handler. The class symbol is added the same way because P5's
    // recovery finds none anywhere to test against.
    const base = fixture([...ARITHMETIC, STOP, END]);
    const shape = base.model.characters.get(10);
    if (shape?.index === null || shape?.index === undefined) throw new Error('fixture lost its shape character');
    const conditions = {
      idleToOverUp: true,
      overUpToIdle: false,
      overUpToOverDown: false,
      overDownToOverUp: false,
      outDownToOverDown: false,
      overDownToOutDown: false,
      outDownToIdle: false,
      idleToOverDown: false,
      overDownToIdle: false,
    };
    const button: CharacterModel = {
      ...shape,
      id: 42,
      kind: 'button' as const,
      button: {
        id: 42,
        version: 2 as const,
        trackAsMenu: false,
        records: [],
        characterCxform: null,
        sounds: [],
        hitArea: null,
        hitAreaSource: null,
        keyPressRequiresFocus: false,
        origin: shape.index,
        actions: [
          {
            conditions,
            rawConditionWord: 0x01,
            keyCode: null,
            actionBytes: { offset: 9999, length: 4 },
            tagOffset: 9999,
            origin: shape.index,
          },
        ],
      },
    };
    const plan = emitFiles({
      file: base.file,
      model: { ...base.model, characters: new Map([...base.model.characters, [42, button]]) },
      blocks: base.irs,
      table: {
        ...base.table,
        symbols: [
          ...base.table.symbols,
          {
            kind: 'class',
            subjectId: 'class:ScoreBoard',
            name: 'ScoreBoard',
            source: 'recovered',
            ownerCharacterId: null,
            orderKey: 999,
          },
        ],
      },
      frames: base.frames,
      shake: null,
      header: { toolVersion: 'test-1', inputName: 'game.swf', sha256: 'sha', movie: 'main' },
    });

    const buttonText = textOf(plan, 'src/buttons/button_42.ts');
    expect(buttonText).toContain('export const handlers: readonly ButtonHandler[] = [');
    expect(buttonText).toContain('idleToOverUp');
    expect(buttonText).toContain('no action block was scheduled for this button record');

    const classText = textOf(plan, 'src/classes/ScoreBoard.ts');
    expect(classText).toContain('export const ScoreBoard: ClassEntry = ');
    expect(classText).toContain('methods: {}');
    expect(classText).toContain('E-044');

    // The invariants the rest of the suite checks hold for these two shapes as well.
    for (const file of plan.files.filter(
      (entry) => entry.path.startsWith('src/buttons/') || entry.path.startsWith('src/classes/'),
    )) {
      expect(file.text, file.path).not.toMatch(/\beval\s*\(|new Function\s*\(|\bwith\s*\(|\bnew Proxy\b/u);
      for (const helper of file.text.match(/avm1\.([a-zA-Z][\w$]*)/gu) ?? []) {
        expect(surfaceNames().has(helper.slice('avm1.'.length)), `${file.path}: ${helper}`).toBe(true);
      }
    }
  });
});

describe('the emit stage', () => {
  function run(stages: 'full' | 'no-names') {
    const { bytes } = fixture([...ARITHMETIC, ...HELLO, STOP, END]);
    rmSync(outDir(), { recursive: true, force: true });
    const sink = new DiagnosticSink();
    const result = runPipeline({
      input: bytes,
      inputName: 'game.swf',
      config: resolveForgeConfig({ input: 'game.swf', outDir: outDir() }),
      toolVersion: 'test-1',
      stages:
        stages === 'full'
          ? [readStage('game.swf'), modelStage(), analyzeStage(), emitStage()]
          : [readStage('game.swf'), modelStage(), analyzeStage(), emitStage()],
      passes: stages === 'full' ? [namesPass()] : [],
      diagnostics: sink,
    });
    return { result, sink };
  }

  it('registers emit on the spine, so the run is complete rather than unregistered', () => {
    const { result } = run('full');
    expect(result.status).toBe('complete');
    const stage = result.stages.find((entry) => entry.id === 'emit');
    expect(stage?.status).toBe('ran');
    expect(result.files.map((file) => file.path)).toContain('src/frames/movie.ts');
    expect(result.state.emit?.plan.counts.emitted).toBeGreaterThan(0);
    expect(existsSync(outDir())).toBe(false);
    // `decode`, `plan` and `report` are still unregistered, so `SF0500` is expected — just not for `emit`.
    expect(result.diagnostics.items.filter((d) => d.code === 'SF0500').some((d) => d.message.includes('emit'))).toBe(
      false,
    );
  });

  it('reports the withheld source maps instead of writing a wrong file', () => {
    const { result } = run('full');
    const warning = result.diagnostics.items.find((d) => d.code === 'SF0504');
    expect(warning?.severity).toBe('warning');
    expect(warning?.message).toContain('sourcemap');
    expect(result.files.some((file) => file.path.endsWith('.map'))).toBe(false);
  });

  it('refuses to emit before the name table is closed', () => {
    const { result } = run('no-names');
    expect(result.status).toBe('failed');
    const stage = result.stages.find((entry) => entry.id === 'emit');
    expect(stage?.error?.message ?? '').toContain('names');
  });

  it('returns bytes rather than touching a disk', () => {
    const { result } = run('full');
    expect(result.files.length).toBeGreaterThan(0);
    for (const file of result.files) {
      expect(file.bytes).toBeInstanceOf(Uint8Array);
      // `REPO-R016`: an emitted path is relative to the project root, and the root is `--out`, not here.
      expect(isAbsolute(file.path)).toBe(false);
      expect(existsSync(outDir()), `the stage wrote into ${outDir()}`);
      expect(new TextDecoder().decode(file.bytes)).toContain('AUTO-GENERATED by swf-forge test-1');
    }
  });
});
