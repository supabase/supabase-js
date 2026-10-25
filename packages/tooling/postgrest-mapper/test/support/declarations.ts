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
