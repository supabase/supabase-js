module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Use local Prettier v2 for consistent inline snapshot formatting across Jest 29
  prettierPath: require.resolve('prettier'),
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  collectCoverage: true,
  coverageDirectory: 'test/coverage',
  coverageReporters: ['json', 'html', 'lcov'],
  collectCoverageFrom: [
    'src/**/*.{js,ts}',
    'src/**/*.unit.test.ts',
    '!**/node_modules/**',
    '!**/vendor/**',
  ],
  rootDir: '.',
  silent: true,
}
