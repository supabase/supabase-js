module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  ollectCoverage: true,
  coverageDirectory: './test/coverage',
  coverageReporters: ['lcov'],
  collectCoverageFrom: [
    './src/**/*.{js,ts}',
    './tests/**/*.test.ts',
    '!**/node_modules/**',
    '!**/vendor/**',
    '!**/vendor/**',
  ],
}
