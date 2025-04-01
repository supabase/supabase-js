module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  collectCoverage: true,
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
