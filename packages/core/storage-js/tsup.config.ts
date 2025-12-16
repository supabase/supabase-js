import { defineConfig } from 'tsup'

export default defineConfig([
  // CJS and ESM builds
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: {
      compilerOptions: {
        composite: false,
        incremental: false,
      },
    },
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    external: ['iceberg-js'],
    outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
    target: 'es2017',
  },
  // IIFE build for CDN (jsdelivr/unpkg)
  {
    entry: { supabase: 'src/index.ts' },
    format: ['iife'],
    globalName: 'supabase',
    outDir: 'dist/umd',
    outExtension: () => ({ js: '.js' }),
    noExternal: [/.*/],
    minify: true,
    platform: 'browser',
  },
])
