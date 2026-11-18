import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import globals from 'globals'
import { docsRules } from '../../../eslint.docs.config.mjs'

export default [
  {
    ignores: ['**/*.md', 'test/__snapshots__/**', 'example/**', 'dist/**', 'docs/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  docsRules,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { tsconfigRootDir: import.meta.dirname },
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      'comma-dangle': 'off',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    files: ['test/**/*.ts', 'test/**/*.tsx', '**/*.test.ts', '**/*.spec.ts'],
    languageOptions: {
      globals: {
        ...globals.jest,
        ...globals.node,
      },
    },
  },
]
