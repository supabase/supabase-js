import baseConfig from '../../../eslint.config.mjs'

export default [
  ...baseConfig,
  // The Expo and Next.js integration apps carry their own eslint config and dependencies, installed only when their
  // suites run; the planner-types example is a standalone project with its own package.json and generated declarations.
  { ignores: ['test/integration/expo/**', 'test/integration/next/**', 'example/**'] },
  {
    // Deno code imports the published package through an import map (test/deno/deno.json), on purpose: it tests the
    // build a Deno user gets, not the sources a relative import would reach.
    files: ['supabase/functions/**/*.ts', 'test/deno/**/*.ts'],
    rules: { '@nx/enforce-module-boundaries': 'off' },
  },
]
