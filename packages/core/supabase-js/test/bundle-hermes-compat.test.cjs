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
 * 3. Every `import(` in `dist/index.mjs` is flanked by bundler-ignore
 *    magic comments (`webpackIgnore`, `@vite-ignore`, `turbopackIgnore`).
 *    Without these, Turbopack (Next.js Edge), webpack, and Vite each
 *    fail to build downstream consumers with
 *    `Module not found: Can't resolve '@opentelemetry/api'` when the
 *    optional peer dep is not installed.
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

// Check 3: every import() in dist/index.mjs has the bundler-ignore magic
// comments so downstream SSR/Edge bundlers (Turbopack, webpack, Vite) don't
// try to statically resolve the optional `@opentelemetry/api` peer dep.
const requiredIgnoreTags = ['webpackIgnore', '@vite-ignore', 'turbopackIgnore']
const importMatches = [...mjs.matchAll(/import\s*\(([\s\S]{0,400}?)\)/g)]
assert.ok(
  importMatches.length > 0,
  'Expected at least one import() in dist/index.mjs (sanity check — if the bundle was refactored to remove all dynamic imports, this test needs updating)'
)
for (const m of importMatches) {
  const body = m[1]
  for (const tag of requiredIgnoreTags) {
    assert.ok(
      body.includes(tag),
      `dist/index.mjs has an import() expression missing /* ${tag} */ — downstream bundlers will try to statically resolve it (e.g. Next.js Edge fails with "Module not found: Can't resolve '@opentelemetry/api'"). Expression: ${m[0].slice(0, 200)}`
    )
  }
}
console.log(`3. All ${importMatches.length} import() expressions in dist/index.mjs carry`)
console.log(`   /* ${requiredIgnoreTags.join(' */ /* ')} */`)
console.log('   SSR/Edge bundlers will not try to statically resolve them\n')

console.log('All bundle compatibility checks passed.')
