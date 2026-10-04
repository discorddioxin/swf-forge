import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const r = (p: string): string => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      '@swf-forge/swf/test-support': r('packages/swf/src/test-support/index.ts'),
      '@swf-forge/swf/node': r('packages/swf/src/node/index.ts'),
      '@swf-forge/swf': r('packages/swf/src/index.ts'),
      '@swf-forge/decompiler': r('apps/decompiler/src/cli.ts'),
    },
  },
  test: {
    include: ['packages/*/test/**/*.test.ts', 'apps/*/test/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
  },
});
