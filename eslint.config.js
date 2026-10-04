// Flat ESLint config (`TECH-SPEC` §4.1). Rules here are the *forbidden* constructs the specs name:
// plain-JS AVM1 objects, eval/with/Proxy/Function, and `any` at a module boundary. Type-aware rules
// are deliberately not enabled: the whole tree is already checked by `tsc -b` under `strict`.
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', 'docs/**', 'fixtures/**', 'coverage/**', 'tools/**', '**/*.d.ts'],
  },
  ...tseslint.configs.recommended,
  {
    files: ['**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-with': 'error',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'NewExpression[callee.name="Proxy"]',
          message: 'Proxy is banned: AVM1 objects are modelled explicitly (AVM1-R014).',
        },
        { selector: 'WithStatement', message: 'with is banned for the same reason.' },
      ],
    },
  },
);
