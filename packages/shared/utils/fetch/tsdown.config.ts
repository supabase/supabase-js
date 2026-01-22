import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  sourcemap: true,
  clean: true,
  outDir: 'dist',
  external: ['tslib'],
  fixedExtension: true, // Automatically adds .js/.mjs extensions to all imports
  hash: false,
  target: 'es2017',
})
