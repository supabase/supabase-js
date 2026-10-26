import {
  generateDeclarations,
  type AcquiredSchema,
  type GenerateDeclarationsResult,
  type GeneratorDeps,
} from '../../src'
import { plannerWasmPath } from './acquired'
import { createTempProject } from './project'

/**
 * What the generator makes of a temp project holding `source` as `src/app.ts` and `acquired` as its snapshot
 * (`unplanned: 'error'`). `deps` replaces the planner host, tracer or logger. The project is removed before returning.
 */
export async function generateResult(
  acquired: AcquiredSchema,
  source: string,
  deps: Pick<GeneratorDeps, 'createHost' | 'createTracer' | 'logger'> = {}
): Promise<GenerateDeclarationsResult> {
  const p = await createTempProject(acquired, { 'src/app.ts': source })
  try {
    return await generateDeclarations({
      configFileName: p.configFileName,
      options: { ...p.options, defaultSchema: 'public', unplanned: 'error' },
      deps: { wasmPath: plannerWasmPath(), cacheDirectory: false, ...deps },
    })
  } finally {
    p.remove()
  }
}

/**
 * The declarations generated for `source` and `acquired`, with no diagnostics. Only the text outlives the call.
 */
export async function generateText(
  acquired: AcquiredSchema,
  source: string,
  deps?: Pick<GeneratorDeps, 'createHost' | 'createTracer' | 'logger'>
): Promise<string> {
  const result = await generateResult(acquired, source, deps)
  expect(result.diagnostics).toEqual([])
  return result.text
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
