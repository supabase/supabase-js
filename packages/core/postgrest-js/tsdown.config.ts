import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  external: ['tslib'],
  noExternal: ['@supabase/utils-fetch'],
  fixedExtension: true,
  hash: false,
  target: 'es2017',
})
