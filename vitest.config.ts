import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      include: ['packages/*/src/**/*.ts', 'integrations/*/src/**/*.ts'],
      reporter: ['text', 'json', 'html'],
    },
    include: ['packages/*/src/**/*.test.ts', 'integrations/*/src/**/*.test.ts'],
  },
});
