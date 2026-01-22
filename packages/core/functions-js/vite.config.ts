import { defineConfig } from 'vite'

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../node_modules/.vite/packages/core/functions-js',
  test: {
    name: '@supabase/functions-js',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['test/**/*.{test,spec}.{js,ts}'],
    setupFiles: ['./test/utils/vitest-setup.ts'],
    testTimeout: 60000,
    // Retry failed tests up to 3 times in CI
    retry: process.env.CI ? 3 : 0,
    // Run tests sequentially to prevent Docker resource conflicts
    maxConcurrency: 1,
    reporters: ['default'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/version.ts', 'src/index.ts', '**/*.d.ts'],
      thresholds: {
        branches: 0,
        functions: 0,
        lines: 0,
        statements: 0,
      },
    },
  },
})
