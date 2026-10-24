import { generateDeclarations, type AcquiredSchema } from '../src'
import { acquireFromStack, plannerWasmPath } from './support/acquired'
import { createTempProject, type TempProject } from './support/project'

let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

const projects: TempProject[] = []
afterEach(() => {
  for (const p of projects.splice(0)) p.remove()
})

async function declarationsOf(source: string, schema: AcquiredSchema): Promise<string> {
  const p = await createTempProject(schema, { 'src/app.ts': source })
  projects.push(p)
  const result = await generateDeclarations({
    configFileName: p.configFileName,
    options: { ...p.options, defaultSchema: 'public', unplanned: 'error' },
    deps: { wasmPath: plannerWasmPath(), cacheDirectory: false },
  })
  expect(result.diagnostics).toEqual([])
  return result.text
}

/** `public.users.data` constrained to a string, with the suffix `pg_get_constraintdef` writes after the expression */
function withStringCheck(suffix: string): AcquiredSchema {
  return {
    ...acquired,
    supplementary: {
      ...acquired.supplementary,
      jsonSchemaChecks: [
        {
          schema: 'public',
          table: 'users',
          constraint: 'users_data_is_string',
          definition: `CHECK (((data IS NULL) OR extensions.jsonb_matches_schema('{"type":"string"}'::json, data)))${suffix}`,
          columns: ['data'],
          validated: true,
        },
      ],
    },
  }
}

/** The `data` member of the row of `public.users` */
const dataOf = (text: string): string =>
  /\bpublic: \{\s+Tables: \{[\s\S]*?\busers: \{\s+Row: \{[^}]*?\bdata: ([^\n]*)\n/.exec(
    text
  )?.[1] ?? ''

describe('JSON Schema CHECK constraints as facts about stored rows', () => {
  const SOURCE = `supabase.from('users').select('data')`

  it('types a column by the constraint of its table', async () => {
    const text = await declarationsOf(SOURCE, withStringCheck(''))
    expect(dataOf(text)).toMatch(/SupabaseColumnType<'public\.users\.data', string>/)
  }, 180_000)

  it('does not type a column by a NO INHERIT constraint, which says nothing about the rows of the tables inheriting it', async () => {
    const text = await declarationsOf(SOURCE, withStringCheck(' NO INHERIT'))
    expect(dataOf(text)).toMatch(/SupabaseColumnType<'public\.users\.data', Json>/)
    expect(dataOf(text)).not.toContain('string')
  }, 180_000)
})
