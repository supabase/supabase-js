module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  prettierPath: require.resolve('prettier'),
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.test.json' }],
  },
  collectCoverage: false,
  testMatch: ['**/docker-tests/**/*.test.ts'],
  rootDir: '.',
  silent: true,
}
