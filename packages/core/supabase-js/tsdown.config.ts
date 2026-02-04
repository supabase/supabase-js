import { defineConfig } from 'tsdown'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig([
  // CJS and ESM builds - keep @supabase/* external
  {
    entry: ['src/index.ts', 'src/cors.ts'],
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
      const { rename, access } = await import('fs/promises')
      const { constants } = await import('fs')
      const sourceFile = join(__dirname, 'dist/umd/supabase.iife.js')
      const destFile = join(__dirname, 'dist/umd/supabase.js')

      try {
        // Check if source file exists before renaming
        await access(sourceFile, constants.F_OK)
        await rename(sourceFile, destFile)
      } catch (err: any) {
        // Ignore ENOENT errors (file already renamed by parallel build)
        if (err?.code !== 'ENOENT') {
          throw err
        }
      }
    },
  },
])
