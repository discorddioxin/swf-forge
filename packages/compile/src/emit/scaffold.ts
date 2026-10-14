/**
 * The generated project scaffolding (`WP-120-08`, `IMPL-120-R014`/`R015`).
 *
 * Two docs ask for the same thing from different sides. `IMPL-120-R014` says the *emitter* is what enforces
 * the ban list — no `eval`, no `Function`, no `with`, no `await` in emitted code, no `for...in`, no `Math.random`,
 * no `Proxy` — and that a reviewer must be able to read that enforcement off a file in the output. `R015` says
 * the ESLint config and the `tsconfig` are *generated* rather than copied from a template, because a copied
 * template drifts from the emitter's own behaviour within a release and then the gate checks a fiction.
 *
 * So these files are printed here, from the same rule list the emitter obeys, and `verify` (`WP-120-12`)
 * re-runs them against whatever a human may have edited in between.
 *
 * The `tsconfig` mirrors the toolchain's own strictness (`REPO-R013`): an emitted project that compiles under
 * looser rules than the compiler is a project whose types were not checked by the same standards the code was
 * written to.
 */

import { generatedHeader } from './source.js';
import type { EmitHeader } from './files.js';

function head(header: EmitHeader, timeline: string): string {
  return generatedHeader({ ...header, timeline });
}

/**
 * The bans, as data. A test asserts each entry here appears in the written config, so adding a rule to the
 * prose without wiring it into the emitted project fails loudly rather than quietly.
 */
/**
 * The bans, as data with the exact text the written config must contain. A test asserts every `marker` appears
 * in `eslint.config.mjs`, so adding a ban to prose — or to this list — without wiring it into the emitted
 * project fails loudly instead of quietly.
 */
export const EMITTED_BANS: readonly { readonly rule: string; readonly marker: string; readonly why: string }[] = [
  { rule: 'no-eval', marker: "'no-eval': 'error'", why: 'IMPL-120-R014: nothing may synthesise code from a string' },
  { rule: 'no-implied-eval', marker: "'no-implied-eval': 'error'", why: 'the same ban, for the timer string forms' },
  {
    rule: 'no-new-func',
    marker: "'no-new-func': 'error'",
    why: 'IMPL-120-R014: `Function(...)` is eval by another name',
  },
  {
    rule: 'no-with',
    marker: "'no-with': 'error'",
    why: 'AVM1-R034: scope chains are modelled, not spelled with `with`',
  },
  {
    rule: 'AwaitExpression',
    marker: '"selector": "AwaitExpression"',
    why: 'AVM1-R039: AVM1 has no suspension point, so awaiting would reschedule frames',
  },
  {
    rule: 'ForInStatement',
    marker: '"selector": "ForInStatement"',
    why: 'AVM1-R038: JS property order is not the AVM1 enumeration order',
  },
  { rule: 'Proxy', marker: '"name": "Proxy"', why: 'AVM1-R037: AVM1 objects are modelled with slot maps, not proxied' },
  {
    rule: 'Math.random',
    marker: '"property": "random"',
    why: 'REPO-R015: determinism, and the runtime owns the seeded generator',
  },
  {
    rule: 'no-explicit-any',
    marker: "'@typescript-eslint/no-explicit-any': 'error'",
    why: 'IMPL-120-R014: `any` hides a tier decision from the reader',
  },
];

/** `IMPL-120-R015`: the three files a generated project needs to build, lint and be opened in an editor. */
export function scaffoldFiles(header: EmitHeader): { readonly path: string; readonly text: string }[] {
  const eslint = `${head(header, 'tooling')}
/**
 * Generated, never template-copied. Each rule here is a ban on the *emitted* code; \`verify\` re-checks the same
 * list so a hand-edited project cannot quietly relax its own config.
 */
export default [
  {
    files: ['src/**/*.ts'],
    language: { parserOptions: { project: ['./tsconfig.json'], ecmaVersion: 2022, sourceType: 'module' } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-with': 'error',
      'no-underscore-dangle': 'off',
      'no-restricted-globals': [
        'error',
        { "name": "Proxy", "message": "AVM1 objects are modelled, not proxied (AVM1-R037)." },
        { "name": "location", "message": "navigation comes from the manifest, not from a global (IMPL-120-R032)." },
      ],
      'no-restricted-properties': [
        'error',
        { "object": "Math", "property": "random", "message": "nondeterministic (REPO-R015); use the runtime\u2019s seeded generator." },
      ],
      'no-restricted-syntax': [
        'error',
        { "selector": "AwaitExpression", "message": "AVM1 is synchronous (AVM1-R039)." },
        { "selector": "ForInStatement", "message": "JS enumeration order is not AVM1 order (AVM1-R038)." },
        { "selector": "NewExpression[callee.name='Function']", "message": "no code synthesis (IMPL-120-R014)." },
        { "selector": "CallExpression[callee.object.name='eval']", "message": "no code synthesis (IMPL-120-R014)." },
      ],
    },
  },
];
`;

  const tsconfig = `${head(header, 'tooling')}
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "sourceMap": true,
    "declaration": true,
    "outDir": "dist"
  },
  "include": ["src/**/*.ts"]
}
`;

  const pkg = `${head(header, 'tooling')}
{
  "name": "swfforge-output",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "eslint src --max-warnings=0"
  },
  "dependencies": {
    "@swf-forge/avm1": "workspace:*",
    "@swf-forge/runtime": "workspace:*"
  }
}
`;

  return [
    { path: 'eslint.config.mjs', text: eslint },
    { path: 'package.json', text: pkg },
    { path: 'tsconfig.json', text: tsconfig },
  ];
}
