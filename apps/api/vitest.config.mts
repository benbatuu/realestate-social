import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC emits decorator metadata, which Nest dependency injection needs (esbuild does not).
export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  test: {
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['src/**/*.test.ts'], exclude: ['**/*.int.test.ts'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['test/**/*.int.test.ts'],
          setupFiles: ['test/setup-env.ts'],
          globalSetup: ['test/global-setup.ts'],
          testTimeout: 20_000,
          hookTimeout: 30_000,
          // Integration tests share real Postgres/Redis/storage.
          fileParallelism: false,
        },
      },
    ],
  },
});
