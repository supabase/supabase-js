module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*', '!src/types.ts'],
  // Run tests sequentially to prevent database side effects
  maxWorkers: 1,
  // Ensure deterministic test order
  testSequencer: '<rootDir>/test/testSequencer.js',
}
