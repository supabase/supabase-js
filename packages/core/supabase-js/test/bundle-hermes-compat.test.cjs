/**
 * Bundle compatibility test — Hermes, browser CSP, and SSR/Edge bundlers.
 *
 * Three constraints, each verified against the relevant dist file:
 *
 * 1. `dist/index.cjs` contains no `import(` expression.
 *    hermesc (the Hermes bytecode compiler used by React Native release
 *    builds) rejects `import()` at parse time, before dead-code elimination.
 *    Satisfied by aliasing @supabase/tracing to its `main`-field file
 *    (dist/main/index.js — tsc's CJS output, where dynamic `import()` is
 *    already lowered to `require()`). See `tsdown.config.ts`.
 *
 * 2. `dist/index.cjs` contains no `new Function(` call.
 *    Browsers with a strict Content-Security-Policy (no `'unsafe-eval'`)
 *    block `new Function()` identically to `eval()` at runtime.
 *
 * 3. Every `import(` in `dist/index.mjs` is immediately preceded by three
 *    distinct single-purpose magic-comment blocks, in this order:
 *      /* webpackIgnore: true *\/ /* turbopackIgnore: true *\/ /* @vite-ignore *\/
 *    Turbopack only honors /* turbopackIgnore: true *\/ when it occupies its
 *    own block (every Next.js internal usage is single-purpose); multi-keyword
 *    blocks are silently ignored. Without all three directives in this exact
 *    shape, Turbopack (Next.js Edge), webpack, and Vite each fail to build
 *    downstream consumers with `Module not found: Can't resolve
 *    '@opentelemetry/api'` when the optional peer dep is not installed.
 *
 *    Comments are injected by the `inject-bundler-ignore-comments` rolldown
 *    plugin in tsdown.config.ts — source-side magic comments don't survive
 *    rolldown's printer.
 *
 * Run with: node test/bundle-hermes-compat.test.cjs
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')

console.log('Testing bundle compatibility (Hermes / CSP / Edge bundlers)...\n')

const cjsPath = path.join(__dirname, '../dist/index.cjs')
const mjsPath = path.join(__dirname, '../dist/index.mjs')
const cjs = fs.readFileSync(cjsPath, 'utf8')
const mjs = fs.readFileSync(mjsPath, 'utf8')

// Check 1: dist/index.cjs has no import() expressions (breaks hermesc / React Native)
assert.ok(
  !cjs.includes('import('),
  'dist/index.cjs contains import() — breaks hermesc (Hermes bytecode compiler for React Native)'
)
console.log('1. No import() expressions in dist/index.cjs')
console.log('   Hermes-safe (React Native compatible)\n')

// Check 2: dist/index.cjs has no new Function() (breaks browser strict CSP)
assert.ok(
  !cjs.includes('new Function('),
  'dist/index.cjs contains new Function() — breaks browser strict Content-Security-Policy (unsafe-eval)'
)
console.log('2. No new Function() in dist/index.cjs')
console.log('   CSP-safe (no unsafe-eval required)\n')

// Check 3: every import() in dist/index.mjs is preceded by the three
// single-purpose magic-comment blocks Turbopack/webpack/Vite each expect.
// Multi-keyword blocks (e.g. `/* webpackIgnore: true turbopackIgnore: true */`)
// are NOT honored by Turbopack — Next.js's own internal usage is always
// single-purpose. The `inject-bundler-ignore-comments` plugin in
// tsdown.config.ts rewrites every import() into this canonical shape.
const canonicalImport =
  /import\(\s*\/\*\s*webpackIgnore:\s*true\s*\*\/\s*\/\*\s*turbopackIgnore:\s*true\s*\*\/\s*\/\*\s*@vite-ignore\s*\*\/\s*\w+\s*\)/
const importMatches = [...mjs.matchAll(/import\s*\([\s\S]{0,400}?\)/g)]
assert.ok(
  importMatches.length > 0,
  'Expected at least one import() in dist/index.mjs (sanity check — if the bundle was refactored to remove all dynamic imports, this test needs updating)'
)
for (const m of importMatches) {
  assert.ok(
    canonicalImport.test(m[0]),
    `dist/index.mjs has an import() expression not in the canonical form ` +
      `\`import(/* webpackIgnore: true */ /* turbopackIgnore: true */ /* @vite-ignore */ <ident>)\` — ` +
      `Turbopack ignores multi-keyword comment blocks (it only honors single-purpose blocks). ` +
      `Check the inject-bundler-ignore-comments plugin in tsdown.config.ts. Expression: ${m[0].slice(0, 200)}`
  )
}
console.log(
  `3. All ${importMatches.length} import() expressions in dist/index.mjs are in canonical form`
)
console.log('   /* webpackIgnore: true */ /* turbopackIgnore: true */ /* @vite-ignore */ <ident>')
console.log(
  '   Each bundler (webpack / turbopack / vite) sees its directive in a single-purpose block\n'
)

console.log('All bundle compatibility checks passed.')
