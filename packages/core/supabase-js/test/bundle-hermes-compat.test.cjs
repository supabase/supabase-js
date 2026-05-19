/**
 * Hermes Compatibility Test
 *
 * Asserts dist/index.cjs contains no bare import() expressions.
 * hermesc (React Native bytecode compiler) rejects import() at parse time —
 * before dead-code elimination — so the syntax must be physically absent.
 * The only allowed occurrence is inside a new Function() string body, which
 * is opaque to all static parsers including hermesc.
 *
 * Run with: node test/bundle-hermes-compat.test.cjs
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')

console.log('Testing Hermes (React Native) compatibility...\n')

const cjsPath = path.join(__dirname, '../dist/index.cjs')
const cjs = fs.readFileSync(cjsPath, 'utf8')
const lines = cjs.split('\n')

let bareImportCount = 0
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  if (!line.includes('import(')) continue
  if (!line.includes('new Function(')) {
    bareImportCount++
    console.error(
      `❌ Bare import() at line ${i + 1}:\n   ${line.trim()}\n` +
        `   This breaks hermesc (Hermes bytecode compiler for React Native).`
    )
  }
}

assert.strictEqual(
  bareImportCount,
  0,
  `${bareImportCount} bare import() expression(s) in dist/index.cjs — breaks React Native Hermes builds.`
)

console.log('1. No bare import() expressions in dist/index.cjs')
console.log('   ✅ Hermes-safe (React Native compatible)\n')
console.log('🎉 Hermes compatibility test passed!')
