module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  prettierPath: require.resolve('prettier'),
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  collectCoverage: true,
  coverageDirectory: './coverage-docker',
  coverageReporters: ['json', 'html', 'lcov'],
  collectCoverageFrom: [
    // Only collect coverage from files actually exercised by Docker tests
    'src/GoTrueClient.ts', // Core client tested in integration
    'src/lib/helpers.ts', // getClaims, base64url helpers
    'src/lib/fetch.ts', // HTTP requests
    'src/lib/errors.ts', // Error handling
    'src/lib/constants.ts', // Configuration
    'src/lib/types.ts', // Type definitions
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
  testMatch: ['**/docker-tests/**/*.test.ts'],
  rootDir: '.',
  silent: true,
}
