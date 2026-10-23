// @supabase/pg-parser's CommonJS entry `require`s an ESM wasm loader (it uses `import.meta`), which Jest's
// CommonJS runtime can't load. Load it through Node's own `require` (`require(esm)`, Node >= 20.19 / 22.12)
// instead; jest.config.js maps `@supabase/pg-parser` here. Test-only. Same pattern as the oxc-parser shim.
const { createRequire } = process.getBuiltinModule('node:module')
module.exports = createRequire(__filename)('@supabase/pg-parser')
