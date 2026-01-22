import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  transform: {
    '^.+\\.ts?$': [
      'ts-jest',
      {
        tsconfig: 'tsconfig.test.json',
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'cjs', 'json', 'node'],
  moduleNameMapper: {
    '^@supabase/utils-fetch$': '<rootDir>/../../shared/utils/fetch/src/lib/fetch.ts',
  },
  setupFilesAfterEnv: ['./test/utils/jest-custom-reporter.ts'],
  testTimeout: 60000,
  // Retry failed tests up to 3 times in CI
  ...(process.env.CI && { retryTimes: 3 }),
  // Run tests sequentially to prevent Docker resource conflicts
  maxWorkers: 1,
  collectCoverageFrom: [
    '!**/node_modules/**',
    'src/**/*.{ts,tsx}',
    '!src/version.ts',
    '!src/index.ts',
    '!**/*.d.ts',
  ],
  coverageProvider: 'v8',
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
}
export default config
