module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: './coverage',
  coverageReporters: ['lcov'],
  collectCoverageFrom: [
    './src/**/*.{js,ts}',
    './tests/**/*.test.ts',
    '!**/node_modules/**',
    '!**/vendor/**',
    '!**/vendor/**',
  ],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.test.json' }],
  },
}
