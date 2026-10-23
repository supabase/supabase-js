module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/test/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  // oxc-parser is ESM-only; Jest's CommonJS runtime can't load it directly (see the shim)
  moduleNameMapper: {
    '^oxc-parser$': '<rootDir>/test/support/oxc-parser.cjs',
  },
}
