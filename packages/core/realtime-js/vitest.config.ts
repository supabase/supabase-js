import { defineConfig, configDefaults } from 'vitest/config'
export default defineConfig({
  test: {
    dangerouslyIgnoreUnhandledErrors: true,
    include: ['**/*.test.ts'],
    coverage: {
      exclude: [...configDefaults.exclude, 'index.ts', './example/*', './docs/*'],
      reporter: ['lcov'],
    },
    environment: 'jsdom',
  },
})
