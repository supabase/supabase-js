import baseConfig from '../../../eslint.config.mjs'

export default [
  ...baseConfig,
  // written by the mapper (`scripts/generate-postgrest-types.js`), not by hand
  { ignores: ['test/postgrest.generated.d.ts'] },
  {
    // The planner types compute with the empty object type: the identity of an intersection (`F & {}`), the "no
    // options" default of a generic (`O extends SelectOptions = {}`, which hovers show as `{}`) and the global
    // registries a generated file declaration-merges into (`interface SupabaseSelects {}`). `{}` is the exact type
    // in all of them, so the rules that read it as a mistake are off for the types and their tests.
    files: ['src/**/*.ts', 'test/types/**/*.ts'],
    rules: {
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-empty-interface': 'off',
    },
  },
]
