/**
 * Hermes + CSP Compatibility Test
 *
 * Asserts dist/index.cjs contains:
 *   - No import() expressions  -> hermesc (React Native bytecode compiler) rejects
 *     import() at parse time, before dead-code elimination.
 *   - No new Function() calls  -> browsers with a strict Content-Security-Policy
 *     (no 'unsafe-eval') block new Function() identically to eval() at runtime.
 *
 * Both constraints are satisfied by aliasing @supabase/tracing to its
 * `main`-field file (dist/main/index.js) for the CJS bundle — see
 * tsdown.config.ts. That file is tsc's CJS output, where the dynamic
 * `import()` has already been lowered to a runtime `require()`.
 *
 * Run with: node test/bundle-hermes-compat.test.cjs
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')

console.log('Testing Hermes + CSP compatibility of dist/index.cjs...\n')

const cjsPath = path.join(__dirname, '../dist/index.cjs')
const cjs = fs.readFileSync(cjsPath, 'utf8')

// Check 1: no import() expressions (breaks hermesc / React Native)
assert.ok(
  !cjs.includes('import('),
  'dist/index.cjs contains import() — breaks hermesc (Hermes bytecode compiler for React Native)'
)
console.log('1. No import() expressions in dist/index.cjs')
console.log('   Hermes-safe (React Native compatible)\n')

// Check 2: no new Function() (breaks browser strict CSP)
assert.ok(
  !cjs.includes('new Function('),
  'dist/index.cjs contains new Function() — breaks browser strict Content-Security-Policy (unsafe-eval)'
)
console.log('2. No new Function() in dist/index.cjs')
console.log('   CSP-safe (no unsafe-eval required)\n')

console.log('All Hermes + CSP compatibility checks passed.')
