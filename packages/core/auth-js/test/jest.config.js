module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'test/coverage',
  coverageReporters: ['json', 'html', 'lcov'],
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    'src/**/*.unit.test.ts',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
  rootDir: '..',
  silent: true,
}
