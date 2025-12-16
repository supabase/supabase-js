import { defineConfig } from 'tsup'

export default defineConfig([
  // CJS and ESM builds - keep @supabase/* external
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
    // CRITICAL: Keep @supabase/* packages external - not bundled
    external: [
      '@supabase/auth-js',
      '@supabase/functions-js',
      '@supabase/postgrest-js',
      '@supabase/realtime-js',
      '@supabase/storage-js',
    ],
    outExtension: ({ format }) => ({ js: format === 'esm' ? '.mjs' : '.cjs' }),
    target: 'es2017',
  },
  // IIFE build for CDN (jsdelivr/unpkg) - bundles EVERYTHING
  {
    entry: { supabase: 'src/index.ts' },
    format: ['iife'],
    globalName: 'supabase',
    outDir: 'dist/umd',
    outExtension: () => ({ js: '.js' }),
    // Bundle all dependencies including @supabase/*
    noExternal: [/.*/],
    minify: true,
    platform: 'browser',
  },
])
