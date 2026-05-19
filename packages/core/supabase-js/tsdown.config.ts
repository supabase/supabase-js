import { defineConfig } from 'tsdown'
import { createRequire } from 'module'
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
    // NOTE: @supabase/tracing intentionally omitted — it gets bundled via noExternal
    external: [
      '@supabase/auth-js',
      '@supabase/functions-js',
      '@supabase/postgrest-js',
      '@supabase/realtime-js',
      '@supabase/storage-js',
    ],
    noExternal: ['@supabase/tracing'],
    fixedExtension: true,
    hash: false,
    target: 'es2017',
    inputOptions: (_options, format) => {
      if (format === 'cjs') {
        // Rolldown inlines @supabase/tracing's ESM source (with native
        // `import()`) into dist/index.cjs even when emitting CJS — its
        // `import` export condition wins because Rolldown prefers ESM
        // source for tree-shaking, regardless of `resolve.conditionNames`.
        // hermesc (Hermes bytecode compiler for React Native release
        // builds) rejects `import()` at parse time, before dead-code
        // elimination, so the syntax has to be physically absent from the
        // CJS bundle.
        //
        // Alias @supabase/tracing directly to its `main`-field file. This
        // bypasses exports-conditions resolution entirely and pins the CJS
        // bundle to tsc's CJS output (dist/main/index.js), where the
        // dynamic `import()` has been lowered to a runtime `require()`.
        // dist/index.mjs intentionally keeps the native `import()` — it's
        // valid ESM, isn't blocked by browser CSP, and Hermes never sees
        // the ESM bundle (Metro pulls the `require` condition).
        return {
          resolve: {
            alias: {
              '@supabase/tracing': createRequire(import.meta.url).resolve('@supabase/tracing'),
            },
          },
        }
      }
    },
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
