module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  // oxc-parser is ESM-only and pg-parser's wasm loader uses import.meta; Jest's CommonJS runtime can't load
  // either directly (see the shims)
  moduleNameMapper: {
    '^oxc-parser$': '<rootDir>/test/support/oxc-parser.cjs',
    '^@supabase/pg-parser$': '<rootDir>/test/support/pg-parser.cjs',
  },
}
