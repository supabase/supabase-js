/**
 * Bundle compatibility test — Hermes, browser CSP, and bundler safety.
 *
 * The architectural invariant: OpenTelemetry code lives ONLY in the opt-in
 * `dist/tracing.*` entries, as a static import of `@opentelemetry/api`. The
 * main bundle (and the UMD build) must contain no reference to it at all —
 * that reference is what historically broke Hermes (parse-time rejection of
 * `import()`), Metro with package exports enabled, and SSR/Edge bundlers
 * resolving an uninstalled optional dependency.
 *
 * Checks:
 *
 * 1. No `import(` expression in any shipped `.cjs` or `.mjs` file.
 *    hermesc (the Hermes bytecode compiler used by React Native release
 *    builds) rejects `import()` at parse time, before dead-code elimination.
 *    With the OTel import now static, no entry needs dynamic import at all.
 *
 * 2. No `new Function(` in shipped CJS files.
 *    Browsers with a strict Content-Security-Policy (no `'unsafe-eval'`)
 *    block `new Function()` identically to `eval()` at runtime.
 *
 * 3. Zero `@opentelemetry` references (outside comments) in dist/index.cjs,
 *    dist/index.mjs, and dist/umd/supabase.js — the invariant that makes the
 *    whole bundler-compat class of failures impossible in the main bundle.
 *
 * 4. dist/tracing.mjs imports `@opentelemetry/api` via a static top-level
 *    `import ... from`, and dist/tracing.cjs via `require()` — proving the
 *    dependency stayed external AND statically analyzable (Metro/webpack
 *    can bundle it for opt-in consumers).
 *
 * 5. `package.json` `exports` has a `"react-native"` condition for `.`,
 *    `./cors`, and `./tracing`, resolving to the CJS build. Metro (React
 *    Native's bundler) checks `"react-native"` before `"import"`/`"require"`
 *    when package exports are enabled (the default on newer Expo SDKs).
 *
 * 6. Every `./dist/*` path listed in `package.json` `"sideEffects"` exists —
 *    a renamed entry would silently re-enable tree-shaking of the tracing
 *    registration side effect.
 *
 * Run with: node test/bundle-hermes-compat.test.cjs
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')

console.log('Testing bundle compatibility (Hermes / CSP / OTel isolation)...\n')

const read = (rel) => fs.readFileSync(path.join(__dirname, '..', rel), 'utf8')

const bundles = {
  'dist/index.cjs': read('dist/index.cjs'),
  'dist/index.mjs': read('dist/index.mjs'),
  'dist/tracing.cjs': read('dist/tracing.cjs'),
  'dist/tracing.mjs': read('dist/tracing.mjs'),
  'dist/umd/supabase.js': read('dist/umd/supabase.js'),
}

// Strip /* block */ comments and whole-line // comments so JSDoc that
// rolldown preserves into the bundle doesn't trip the reference scans.
// Trailing same-line comments are left alone — removing them naively can
// eat string literals containing `//` (URLs), hiding real references.
const stripComments = (code) => code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

// Check 1: no import() expressions in any shipped bundle (breaks hermesc)
for (const [file, code] of Object.entries(bundles)) {
  if (file === 'dist/umd/supabase.js') continue // browser-only, never compiled by hermesc
  assert.ok(
    !stripComments(code).includes('import('),
    `${file} contains import() — breaks hermesc (Hermes bytecode compiler for React Native)`
  )
}
console.log('1. No import() expressions in any shipped .cjs/.mjs bundle')
console.log('   Hermes-safe (React Native compatible)\n')

// Check 2: no new Function() in CJS bundles (breaks browser strict CSP)
for (const file of ['dist/index.cjs', 'dist/tracing.cjs']) {
  assert.ok(
    !bundles[file].includes('new Function('),
    `${file} contains new Function() — breaks browser strict Content-Security-Policy (unsafe-eval)`
  )
}
console.log('2. No new Function() in shipped CJS bundles')
console.log('   CSP-safe (no unsafe-eval required)\n')

// Check 3: the main bundle and UMD build contain zero @opentelemetry
// references outside comments. This is the invariant that keeps every
// bundler-resolution failure mode out of the default install.
for (const file of ['dist/index.cjs', 'dist/index.mjs', 'dist/umd/supabase.js']) {
  assert.ok(
    !stripComments(bundles[file]).includes('@opentelemetry'),
    `${file} references @opentelemetry outside comments — OTel code must only be reachable ` +
      `from the opt-in dist/tracing.* entries`
  )
}
console.log('3. Zero @opentelemetry references in dist/index.* and dist/umd/supabase.js')
console.log('   OTel code is only reachable via the opt-in ./tracing subpath\n')

// Check 4: the tracing entries reference @opentelemetry/api statically, so
// the dependency stays external and bundlers can resolve and include it for
// consumers who opt in.
assert.ok(
  /from\s*["']@opentelemetry\/api["']/.test(stripComments(bundles['dist/tracing.mjs'])),
  `dist/tracing.mjs must import @opentelemetry/api with a static top-level import`
)
assert.ok(
  /require\(\s*["']@opentelemetry\/api["']\s*\)/.test(stripComments(bundles['dist/tracing.cjs'])),
  `dist/tracing.cjs must load @opentelemetry/api with require()`
)
console.log('4. dist/tracing.* loads @opentelemetry/api statically (external, analyzable)')
console.log('   Metro/webpack bundle the OTel API for opt-in consumers\n')

// Check 5: package.json `exports` has a `"react-native"` condition that
// resolves to the CJS bundle for every public subpath. Metro with package
// exports enabled resolves the ESM bundle otherwise.
const pkg = require('../package.json')
for (const entry of ['.', './cors', './tracing']) {
  const conds = pkg.exports[entry]
  assert.ok(
    conds && typeof conds === 'object',
    `package.json exports["${entry}"] must be a conditions object`
  )
  assert.ok(
    conds['react-native'],
    `package.json exports["${entry}"] is missing the "react-native" condition — ` +
      `Metro with package exports enabled resolves the ESM bundle by default.`
  )
  const rnKeys = Object.keys(conds)
  const rnIdx = rnKeys.indexOf('react-native')
  const importIdx = rnKeys.indexOf('import')
  const requireIdx = rnKeys.indexOf('require')
  assert.ok(
    rnIdx < importIdx && rnIdx < requireIdx,
    `package.json exports["${entry}"]: "react-native" must appear before "import" and "require" — ` +
      `Node-style conditional exports resolve in key order.`
  )
  const rnTarget = conds['react-native'].default || conds['react-native']
  assert.ok(
    typeof rnTarget === 'string' && rnTarget.endsWith('.cjs'),
    `package.json exports["${entry}"]["react-native"] must resolve to a .cjs file. ` +
      `Got: ${JSON.stringify(rnTarget)}`
  )
}
console.log('5. package.json exports has "react-native" condition for ".", "./cors", "./tracing"')
console.log('   Metro resolves dist/*.cjs instead of dist/*.mjs\n')

// Check 6: every dist file whitelisted in "sideEffects" exists. A renamed
// entry would silently re-enable tree-shaking of the tracing registration.
assert.ok(
  Array.isArray(pkg.sideEffects),
  'package.json "sideEffects" must be an array whitelisting the tracing entries'
)
for (const entry of pkg.sideEffects) {
  if (!entry.startsWith('./dist/')) continue
  assert.ok(
    fs.existsSync(path.join(__dirname, '..', entry)),
    `package.json "sideEffects" lists ${entry}, which does not exist after the build — ` +
      `bundlers would tree-shake the tracing side-effect import`
  )
}
console.log('6. All ./dist/* paths in package.json "sideEffects" exist on disk\n')

console.log('All bundle compatibility checks passed.')
