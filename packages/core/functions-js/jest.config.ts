import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  transform: {
    '^.+\\.ts?$': 'ts-jest',
  },
  moduleFileExtensions: ['ts', 'js', 'cjs', 'json', 'node',],
  setupFilesAfterEnv: [
    './test/utils/jest-custom-reporter.ts',
  ],
  testEnvironment: 'jest-circus-allure-environment',
  testTimeout: 60000,
  coverageThreshold: {
    global: {
      branches: 0,
      functions: 0,
      lines: 0,
      statements: 0,
    },
  },
};
export default config;