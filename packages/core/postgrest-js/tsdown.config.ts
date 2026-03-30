import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: { cjsReexport: true },
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  external: ['tslib'],
  fixedExtension: true,
  hash: false,
  target: 'es2017',
})
