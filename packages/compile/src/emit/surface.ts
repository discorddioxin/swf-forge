/**
 * The emitted-code surface: every identifier this phase's emitter can write into a generated file.
 *
 * `REPO-R013` forbids the emitted tree from depending on anything but the runtime packages and the standard
 * library, and `REPO-R007` allows only *types*, from `@swf-forge/runtime/contract`. So the moment the emitter
 * writes `avm1.add(a, b)` it is **naming a function the runtime must have**, and P7 has to be able to find the
 * list without reading four emitters. That list is this table, and `emit.test.ts` fails if a file the emitter
 * produced mentions a surface name that is not in it.
 *
 * The `from` column is where the name is *specified*, not where it is implemented: `AVM1-R032` and `CMP-R018`
 * give most of these in their mapping tables. Where the specs stop short of naming something, the entry says
 * `P6 proposal`, because a reviewer needs to be able to tell "the spec said so" from "the emitter decided",
 * and P7 is entitled to push back on the second group only.
 */

/** One member of the surface: how emitted code spells it, and who owns the decision. */
export interface SurfaceEntry {
  readonly name: string;
  readonly kind: 'type' | 'function' | 'method' | 'value';
  readonly from: string;
}

/** Module-level imports, keyed by the specifier the emitted file writes. */
export const SURFACE_MODULES: ReadonlyMap<string, readonly SurfaceEntry[]> = new Map([
  [
    '@swf-forge/runtime/contract',
    [
      { name: 'Value', kind: 'type', from: 'AVM1-R032' },
      { name: 'Clip', kind: 'type', from: 'CMP-R018' },
      { name: 'Scope', kind: 'type', from: 'AVM1-R032' },
      { name: 'Vm', kind: 'type', from: 'IMPL-120-R017' },
      { name: 'FrameCtx', kind: 'type', from: 'IMPL-120-R017' },
      { name: 'Avm1Object', kind: 'type', from: 'AVM1-R018' },
      { name: 'Placement', kind: 'type', from: 'CMP-R017' },
      { name: 'Removal', kind: 'type', from: 'CMP-R017' },
      { name: 'ButtonHandler', kind: 'type', from: 'IMPL-120-R009' },
      { name: 'ClassEntry', kind: 'type', from: 'IMPL-050-R063' },
      { name: 'TimelineTables', kind: 'type', from: 'P6 proposal' },
      { name: 'FrameScript', kind: 'type', from: 'IMPL-120-R017' },
      { name: 'Entry', kind: 'type', from: 'IMPL-120-R018' },
    ],
  ],
  [
    '@swf-forge/avm1',
    [
      { name: '$', kind: 'value', from: 'CMP-R018' },
      { name: 'avm1', kind: 'value', from: 'AVM1-R032' },
    ],
  ],
]);

/**
 * The `avm1.*` helpers, in the order a reader of AVM1-§6.1's table will look for them. `add` is here and `mul`
 * is not because `+` is the one operator where JS and AVM1 disagree (JS concatenates on a string operand, AVM1
 * `ActionAdd2` coerces both sides — `IMPL-050-R021`); `-`, `*`, `/` and `%` agree, so `CMP-R019`'s preference
 * for direct forms applies to them and a helper would hide the arithmetic from the bundler.
 */
export const AVM1_HELPERS: ReadonlyMap<string, string> = new Map([
  ['getMember', 'AVM1-R032 / CMP-R019 (generic arm)'],
  ['setMember', 'AVM1-R032 / CMP-R019 (generic arm)'],
  ['callFunction', 'AVM1-R032'],
  ['construct', 'AVM1-R032'],
  ['callMethod', 'AVM1-R032'],
  ['withScope', 'AVM1-R032'],
  ['withTarget', 'AVM1-R034'],
  ['resolveTarget', 'CMP-R019 (dynamic arm)'],
  ['keys', 'AVM1-R032'],
  ['randomInt', 'AVM1-R032'],
  ['add', 'IMPL-050-R021'],
  ['equals', 'IMPL-050-R022 (loose equality is not JS ==)'],
  ['strictEquals', 'IMPL-050-R022'],
  ['compare', 'IMPL-050-R022'],
  ['toBool', 'AVM1-R032 (branch condition)'],
  ['toString', 'AVM1-R038 / §5.3'],
  ['toNumber', '§5.2'],
  ['toInteger', '§5.2'],
  ['typeofOp', '§5.4'],
  ['getSlot', 'AVM1-R032 (scope.get on a non-clip base)'],
  ['setSlot', 'AVM1-R032'],
  ['deleteProp', 'AVM1-R038'],
  ['defineLocal', 'IMPL-050-R030'],
  ['instanceOf', 'IMPL-050-R047'],
  ['castTo', 'IMPL-050-R047'],
  ['extendsOp', 'IMPL-050-R047'],
  ['implementsOp', 'IMPL-050-R047'],
  ['startDrag', 'IMPL-050-R049 (documented `undefined` return)'],
  ['endDrag', 'IMPL-050-R049'],
  ['cloneSprite', 'IMPL-050-R049'],
  ['removeSprite', 'IMPL-050-R049'],
  ['trace', 'IMPL-050-R049'],
  ['throwOp', 'IMPL-050-R047'],
  ['strExtract', 'IMPL-050-R046'],
  ['storeRegister', 'AVM1-R033'],
  ['constant', 'IMPL-050-R022 (dynamic pool)'],
  ['entryDescriptor', 'IMPL-120-R018'],
  /*
   * Below: helpers the lowering needs that no spec section names yet. Each is a **proposal for the runtime
   * contract**, recorded here rather than invented in a template, for one reason — every one of them exists
   * because the JS operator would be *wrong*, and the alternative to naming a helper is inlining AVM1
   * semantics into emitted code, which is the thing §5 of doc 120 forbids. `WP-120-10`'s contract review
   * either adopts a name here or tells the emitter to use another; the emitter does not get to decide alone.
   */
  ['logicalNot', 'proposal: AVM1 `Not` yields 1/0 before SWF 5 and a boolean after (IMPL-050 version-sensitive table)'],
  ['negate', 'proposal: `Negate` is ToNumber then sign, keeping AVM1 result types'],
  ['divide', 'proposal: SWF 4 pushes the string `#ERROR#` on a zero divisor instead of a number'],
  ['numericEquals', 'proposal: `Equals` (0x0e) is a numeric compare with a version-sensitive result, not `==`'],
  ['numericLess', 'proposal: `Less` (0x0f), same reason'],
  ['logicalAnd', 'proposal: SWF 4 `And` is a non-zero test on both operands, not a short-circuit'],
  ['logicalOr', 'proposal: SWF 4 `Or`, same reason'],
  ['compareStrings', 'proposal: byte-by-byte AVM1 string order (`StringLess`/`StringGreater`/`StringEquals`)'],
  ['stringLength', 'proposal: `StringLength` units are unresolved for non-ASCII (FE-030), so the runtime answers it'],
  ['mbStringLength', 'proposal: `MBStringLength` counts characters, which is a different function'],
  ['charToAscii', 'proposal: `CharToAscii`/`MBCharToAscii` depend on the player code page, not on JS'],
  ['asciiToChar', 'proposal: `AsciiToChar`'],
  ['mbCharToAscii', 'proposal: double-byte variant, first byte high'],
  ['mbAsciiToChar', 'proposal: double-byte variant'],
  ['targetPath', 'proposal: `TargetPath` needs the clip tree, which the emitter has no business walking'],
  ['getTime', 'proposal: `GetTime` is player-relative time from the runtime clock (AVM1-R032 time source)'],
  ['newObject', 'proposal: `InitObject`/an `object` literal with an optional constructor name'],
  ['newArray', 'proposal: `InitArray`'],
  ['constructMethod', 'proposal: `NewMethod` needs the receiver and the constructor name together'],
  ['declare', 'proposal: `DefineLocal2` declares a slot in the local scope without a value'],
  ['getURL', 'proposal: `GetURL`/`GetURL2` navigation, which the runtime routes through the manifest (IMPL-120-R032)'],
  ['superOf', 'proposal: the `super` preload of a `DefineFunction2` body is the defining object’s prototype'],
  [
    'unsupported',
    'proposal: the trap emitted where lowering declined to invent behaviour, so a gap fails loudly at run time',
  ],
]);

/** Members the runtime's `Clip`/`Scope`/`Vm` types must expose, per the specs' own examples. */
export const RECEIVER_MEMBERS: ReadonlyMap<string, string> = new Map([
  ['getMember', 'AVM1-R032'],
  ['setMember', 'AVM1-R032'],
  ['getProperty', 'AVM1-R032'],
  ['setProperty', 'AVM1-R032'],
  ['callMethod', 'AVM1-R032'],
  ['get', 'AVM1-R032 (scope.get)'],
  ['set', 'AVM1-R032 (scope.set)'],
  ['gotoFrame', 'AVM1 §8.4 timeline control'],
  ['play', 'AVM1 §8.4'],
  ['stop', 'AVM1 §8.4'],
  ['toggleQuality', 'AVM1 §8.4'],
  ['stopSounds', 'AVM1 §8.4'],
  ['waitForFrame', 'AVM1 §8.4'],
  ['getURL', 'AVM1 §8.4 / CMP-R033'],
  ['callFrame', 'AVM1 §8.4'],
  ['frameRate', 'AVM1 §8.4'],
]);

/** Every name the surface publishes, for the "no undeclared identifier in emitted output" test. */
export function surfaceNames(): Set<string> {
  const out = new Set<string>();
  for (const entries of SURFACE_MODULES.values()) for (const entry of entries) out.add(entry.name);
  for (const name of AVM1_HELPERS.keys()) out.add(name);
  for (const name of RECEIVER_MEMBERS.keys()) out.add(name);
  return out;
}

/**
 * The import lines for one emitted module, derived from its own body and never from a template.
 *
 * `IMPL-120-R015` gives the emitted project `noUnusedLocals`, so an import the module does not reference is a
 * build error in the output — and a template import list is wrong for every module except the one it was
 * written for. Deriving the list also makes the surface self-checking: a name is only ever imported because the
 * contract publishes it, so `T-CMP-003`'s "emitted code references nothing off the surface" test has one source
 * of truth to read.
 */
export function surfaceImports(body: string): string[] {
  /**
   * A name counts as used only as a *free identifier*: `avm1.trace(...)` does not make `trace` an import, and
   * `target.stop()` does not make `stop` one. Property positions belong to the runtime contract's member list,
   * checked separately.
   */
  const used = (name: string): boolean =>
    new RegExp(`(?:^|[^\\w$.])${name.replace(/\$/gu, '\\$')}(?![\\w$])`, 'u').test(body);
  const lines: string[] = [];
  for (const [specifier, entries] of [...SURFACE_MODULES.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const types = entries.filter((entry) => entry.kind === 'type' && used(entry.name)).map((entry) => entry.name);
    const values = entries.filter((entry) => entry.kind !== 'type' && used(entry.name)).map((entry) => entry.name);
    if (types.length > 0) {
      lines.push(`import type { ${[...types].sort().join(', ')} } from '${specifier}';`);
    }
    if (values.length > 0) {
      lines.push(`import { ${[...values].sort().join(', ')} } from '${specifier}';`);
    }
  }
  return lines;
}
