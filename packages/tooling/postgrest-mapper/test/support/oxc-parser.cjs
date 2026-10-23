// oxc-parser is ESM-only and Jest's CommonJS runtime can't load it. Load it through Node's own `require`
// (`require(esm)`, Node >= 20.19 / 22.12) instead; jest.config.js maps `oxc-parser` here. Test-only.
// `getBuiltinModule` bypasses Jest's `module` shim, whose `createRequire` would map back to this file.
const { createRequire } = process.getBuiltinModule('node:module')
module.exports = createRequire(__filename)('oxc-parser')
