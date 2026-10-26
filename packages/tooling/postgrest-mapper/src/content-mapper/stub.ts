import { hashOptions } from './hash'
import type { ProjectGenerator } from './generator'

/**
 * Placeholder until the real scanner, planner and printer are wired in: declares one `SupabaseSelects` entry
 * whose row carries the `postgrest` option, so a test can see the options reach the generator.
 */
export const stubGenerator: ProjectGenerator = async ({ options }) => ({
  identity: hashOptions(options),
  watchedFiles: [],
  text: [
    'export {}',
    'declare global {',
    '  interface SupabaseSelects {',
    "    'r|public|stub|*': {",
    `      row: { id: number; postgrest: ${JSON.stringify(options.postgrest)} }`,
    '      sources: {}',
    '      embeds: {}',
    '    }',
    '  }',
    '}',
    '',
  ].join('\n'),
  diagnostics: [],
  optionDiagnostics: [],
})
