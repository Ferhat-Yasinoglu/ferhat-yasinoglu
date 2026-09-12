import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js', 'worker/test/**/*.test.js'],
    exclude: ['node_modules/**', 'test/e2e/**'],
  },
});
