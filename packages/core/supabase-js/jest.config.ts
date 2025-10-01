import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  clearMocks: true,
  collectCoverage: false,
  coverageDirectory: './test/coverage',
  coverageReporters: ['json', 'html', 'lcov'],
  collectCoverageFrom: [
    './src/**/*.{js,ts}',
    './src/**/*.unit.test.ts',
    '!**/node_modules/**',
    '!**/vendor/**',
    '!**/vendor/**',
  ],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/examples/',
    '/test/deno/', // Deno tests should be run with Deno
    '/test/integration/bun/', // Bun tests should be run with Bun
    '/test/integration/expo/', // Expo tests have their own runner
    '/test/integration/next/', // Next.js tests have their own setup
    '/test/integration/node-browser/', // Playwright tests
    '\.spec\.ts$', // Playwright spec files
    'integration\.browser\.test\.ts', // Browser integration tests for Deno
  ],
}
export default config
