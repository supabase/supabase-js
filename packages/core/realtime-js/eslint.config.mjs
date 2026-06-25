import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import globals from 'globals'

export default [
  {
    ignores: ['dist/**', 'coverage/**', 'example/**', 'docs/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        window: 'readonly',
      },
    },
    rules: {
      curly: 'error',
      'no-eq-null': 'error',
      'comma-dangle': ['error', 'always-multiline'],
      'no-caller': 'error',
      'dot-notation': 'off',
      'no-debugger': 'error',
      'no-undef': 'error',
    },
  },
]
