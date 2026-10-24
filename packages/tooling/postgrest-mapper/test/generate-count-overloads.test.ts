import { generateDeclarations, type AcquiredSchema } from '../src'
import { acquireFromStack, plannerWasmPath } from './support/acquired'
import { createTempProject, type TempProject } from './support/project'

/**
 * `count(x)` in a function body is the builtin aggregate (bigint, never NULL) unless a function or aggregate named
 * `count` of the body's search path takes the operand: PostgreSQL prefers it, and it may return NULL. The fixtures are
 * in the type-inference migration of postgrest-js: `arr_a.count(public.cast_mood)` returns a NULL text, and
 * `count_mood_shadowed` runs along `arr_a, public` (`count_mood_plain` along `public`) over `cast_cases.mood`.
 */
describe('count in a function body, through the generator', () => {
  let acquired: AcquiredSchema
  beforeAll(async () => {
    acquired = await acquireFromStack()
  }, 120_000)

  const projects: TempProject[] = []
  afterEach(() => {
    for (const p of projects.splice(0)) p.remove()
  })

  /** The schema with one function's body and search path replaced in the catalog */
  function withBody(name: string, source: string, searchPath: string): AcquiredSchema {
    return {
      ...acquired,
      supplementary: {
        ...acquired.supplementary,
        functions: acquired.supplementary.functions.map((f) =>
          f.name === name ? { ...f, source, searchPath } : f
        ),
      },
    }
  }

  async function rowOf(name: string, schema: AcquiredSchema = acquired): Promise<string> {
    const p = await createTempProject(schema, { 'src/app.ts': `supabase.rpc('${name}')` })
    projects.push(p)
    const result = await generateDeclarations({
      configFileName: p.configFileName,
      options: { ...p.options, defaultSchema: 'public', unplanned: 'error' },
      deps: { wasmPath: plannerWasmPath(), cacheDirectory: false },
    })
    expect(result.diagnostics).toEqual([])
    const row = new RegExp(`f\\|public\\|${name}\\|\\*'[\\s\\S]*?row: (.*)\\n`).exec(
      result.text
    )?.[1]
    expect(row).toBeDefined()
    return row!
  }

  test('is the builtin, never NULL, when the path has no function named count', async () => {
    expect(await rowOf('count_mood_plain')).toBe('{ n: number }')
  }, 180_000)

  test('may be a function of the path that takes the operand, which can return NULL', async () => {
    // arr_a is outside the schemas the catalog lists: the call stays nullable and the type it has is not claimed
    expect(await rowOf('count_mood_shadowed')).toBe('{ n: string | null }')
  }, 180_000)

  test('count(*) is the builtin even along a schema the catalog does not list', async () => {
    // count(*) takes no argument: no function of the path can be preferred to the aggregate
    const schema = withBody(
      'count_mood_plain',
      'SELECT count(*) FROM public.cast_cases',
      'arr_a, public'
    )
    expect(await rowOf('count_mood_plain', schema)).toBe('{ n: number }')
  }, 180_000)
})
