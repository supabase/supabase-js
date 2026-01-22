module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  prettierPath: require.resolve('prettier'),
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  collectCoverage: true,
  coverageDirectory: './coverage',
  coverageReporters: ['json', 'html', 'lcov'],
  collectCoverageFrom: ['src/**/*.{js,ts}', '!**/node_modules/**', '!**/vendor/**'],
  testPathIgnorePatterns: ['/node_modules/', '/docker-tests/'],
  rootDir: '.',
  silent: true,
}
