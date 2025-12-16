import { defineConfig } from 'tsdown'

export default defineConfig([
  // CJS and ESM builds
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    sourcemap: true,
    clean: true,
    outDir: 'dist',
    external: ['iceberg-js'],
    fixedExtension: true,
    hash: false,
    target: 'es2017',
  },
  // IIFE build for CDN (jsdelivr/unpkg)
  {
    entry: { supabase: 'src/index.ts' },
    format: ['iife'],
    globalName: 'supabase',
    outDir: 'dist/umd',
    noExternal: [/.*/],
    minify: true,
    platform: 'browser',
  },
])
