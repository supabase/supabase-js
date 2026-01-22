import { defineConfig } from 'vite'

export default defineConfig({
  root: __dirname,
  cacheDir: '../../../../node_modules/.vite/packages/shared/utils/fetch',
  test: {
    name: '@supabase/utils-fetch',
    watch: false,
    globals: true,
    environment: 'node',
    include: ['src/**/*.{test,spec}.{js,ts}'],
    reporters: ['default'],
    coverage: {
      reportsDirectory: './coverage',
      provider: 'v8',
    },
  },
})
