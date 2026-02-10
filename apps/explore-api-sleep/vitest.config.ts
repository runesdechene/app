import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/suites/unit/**/*.test.ts'],
    setupFiles: ['tests/config/unit-setup.ts'],
  },
});
