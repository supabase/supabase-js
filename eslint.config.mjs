import nx from '@nx/eslint-plugin'
import globals from 'globals'
import { docsRules } from './eslint.docs.config.mjs'

export default [
  {
    ignores: [
      '**/dist',
      '**/node_modules',
      '**/coverage',
      '**/.nx',
      '**/build',
      '**/.next',
      '**/out-tsc',
    ],
  },
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    languageOptions: { parserOptions: { tsconfigRootDir: import.meta.dirname } },
  },
  docsRules,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: [],
          depConstraints: [
            {
              sourceTag: '*',
              onlyDependOnLibsWithTags: ['*'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.spec.ts', '**/*.spec.tsx', '**/*.spec.js', '**/*.spec.jsx'],
    languageOptions: {
      globals: { ...globals.jest },
    },
  },
]
