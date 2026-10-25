import { generateDeclarations, type AcquiredSchema } from '../../src'
import { plannerWasmPath } from './acquired'
import { createTempProject } from './project'

/**
 * The declarations generated for a temp project holding `source` as `src/app.ts` and `acquired` as its snapshot,
 * with no diagnostics. The project is removed before returning: only the text outlives the call.
 */
export async function generateText(acquired: AcquiredSchema, source: string): Promise<string> {
  const p = await createTempProject(acquired, { 'src/app.ts': source })
  try {
    const result = await generateDeclarations({
      configFileName: p.configFileName,
      options: { ...p.options, defaultSchema: 'public', unplanned: 'error' },
      deps: { wasmPath: plannerWasmPath(), cacheDirectory: false },
    })
    expect(result.diagnostics).toEqual([])
    return result.text
  } finally {
    p.remove()
  }
}

/** `users.data` constrained to `{ theme: 'light' | 'dark' }`, as `jsonb_matches_schema` writes it */
export function withThemeCheck(acquired: AcquiredSchema): AcquiredSchema {
  const schema =
    '{"type":"object","properties":{"theme":{"enum":["light","dark"]}},"required":["theme"],"additionalProperties":false}'
  return {
    ...acquired,
    supplementary: {
      ...acquired.supplementary,
      jsonSchemaChecks: [
        {
          schema: 'public',
          table: 'users',
          constraint: 'users_data_theme',
          definition: `CHECK (((data IS NULL) OR extensions.jsonb_matches_schema('${schema}'::json, data)))`,
          columns: ['data'],
          validated: true,
        },
      ],
    },
  }
}
