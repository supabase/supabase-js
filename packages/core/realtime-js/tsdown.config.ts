import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  external: ['tslib', 'ws', '@types/ws', '@types/phoenix'], // External peer/type dependencies
  fixedExtension: true,
  hash: false,
  target: 'es2017',
})
