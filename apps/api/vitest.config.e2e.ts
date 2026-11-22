import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    testTimeout: 30_000,
    hookTimeout: 30_000,
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    // Rate limiting is off in e2e tests (many requests from one IP).
    // test/rate-limit.e2e-spec.ts switches it back on.
    env: { RATE_LIMIT_DISABLED: 'true' },
  },
});
