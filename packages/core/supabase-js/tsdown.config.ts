import { defineConfig } from 'tsdown'

export default defineConfig([
  // CJS and ESM builds - keep @supabase/* external
  {
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
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
    fixedExtension: true,
    hash: false,
    target: 'es2017',
  },
  // IIFE build for CDN (jsdelivr/unpkg) - bundles EVERYTHING
  {
    entry: { supabase: 'src/index.ts' },
    format: ['iife'],
    globalName: 'supabase',
    outDir: 'dist/umd',
    // Bundle all dependencies including @supabase/*
    noExternal: [/.*/],
    minify: true,
    platform: 'browser',
    // Rename to supabase.js for backward compatibility (can remove in v3)
    onSuccess: async () => {
      const { rename } = await import('fs/promises')
      await rename('dist/umd/supabase.iife.js', 'dist/umd/supabase.js')
    },
  },
])
