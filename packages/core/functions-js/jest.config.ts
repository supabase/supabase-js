import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'cjs', 'json', 'node'],
  setupFilesAfterEnv: ['./test/utils/jest-custom-reporter.ts'],
  testTimeout: 60000,
  // Retry failed tests up to 3 times in CI
  ...(process.env.CI && { retryTimes: 3 }),
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
