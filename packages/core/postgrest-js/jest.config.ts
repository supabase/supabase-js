import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverageFrom: ['src/**/*', '!src/types.ts'],
  // Run tests sequentially to prevent database side effects
  maxWorkers: 1,
  // Ensure deterministic test order
  testSequencer: '<rootDir>/test/testSequencer.js',
  // Use local Prettier v2 only for Jest inline snapshots
  prettierPath: require.resolve('prettier'),
  // Increase timeout for CI environments (default is 5000ms)
  testTimeout: 30000,
  globals: {
    // For consistency between VSCode and type-check
    // https://github.com/supabase/postgrest-js/pull/627#discussion_r2236995331
    'ts-jest': {
      tsconfig: 'tsconfig.test.json',
    },
  },
}
export default config
