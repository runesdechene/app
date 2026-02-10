import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';

export default defineConfig({
  test: {
    globals: true,
    include: [
      'tests/suites/functional/**/*.int.test.ts',
      'tests/suites/functional/**/*.e2e.test.ts',
    ],
    globalSetup: 'tests/config/global-setup.ts',
    setupFiles: ['tests/config/unit-setup.ts'],
    fileParallelism: false,
    maxWorkers: 1,
    maxConcurrency: 1,
  },
  plugins: [swc.vite()],
});
