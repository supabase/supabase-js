import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['tests/**/*.ts', '!tests/**/*.d.ts'],
  // Run tests sequentially to prevent database side effects and race conditions
  maxWorkers: 1,
  // Use local Prettier v2 only for Jest inline snapshots
  prettierPath: require.resolve('prettier'),
  // Increase timeout for E2E tests (includes network calls, database operations)
  testTimeout: 60000,
  // Global setup/teardown
  globalSetup: '<rootDir>/helpers/global-setup.ts',
  globalTeardown: '<rootDir>/helpers/global-teardown.ts',
  // Module paths
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@fixtures/(.*)$': '<rootDir>/fixtures/$1',
    '^@helpers/(.*)$': '<rootDir>/helpers/$1',
  },
  // Coverage configuration
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  // Test pattern
  testMatch: ['<rootDir>/tests/**/*.test.ts'],
  globals: {
    'ts-jest': {
      tsconfig: 'tsconfig.json',
    },
  },
}

export default config
