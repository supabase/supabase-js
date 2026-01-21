import type { Config } from '@jest/types'

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  transform: {
    '^.+\\.ts?$': [
      'ts-jest',
      {
        tsconfig: {
          composite: false,
          outDir: '$$ts-jest$$',
          rootDir: '.',
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],
  collectCoverageFrom: ['!**/node_modules/**', 'src/**/*.ts', '!**/*.d.ts'],
  coverageProvider: 'v8',
}

export default config
