import { generateDeclarations, type AcquiredSchema } from '../src'
import { acquireFromStack, plannerWasmPath } from './support/acquired'
import { typecheckConsumer } from './support/consumer'
import { createTempProject, type TempProject } from './support/project'

let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

const projects: TempProject[] = []
afterEach(() => {
  for (const p of projects.splice(0)) p.remove()
})

async function declarationsOf(source: string, schema: AcquiredSchema = acquired): Promise<string> {
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

/** The entry printed for `key`, from `'key': {` to its closing brace. */
function entryOf(text: string, key: string): string {
  const start = text.indexOf(`'${key}': {`)
  expect(start).toBeGreaterThanOrEqual(0)
  return text.slice(start, text.indexOf('\n    }', start))
}

/** The `row:` line of the first call of an entry */
function rowOf(text: string, key: string): string {
  const row = /row: (.*)\n/.exec(entryOf(text, key))?.[1]
  expect(row).toBeDefined()
  return row!
}

/** The same schema with one function's volatility changed in the catalog */
function withVolatility(name: string, volatility: string): AcquiredSchema {
  return {
    ...acquired,
    supplementary: {
      ...acquired.supplementary,
      functions: acquired.supplementary.functions.map((f) =>
        f.name === name ? { ...f, volatility } : f
      ),
    },
  }
}

/** `users.data` constrained to `{ theme: 'light' | 'dark' }`, as `jsonb_matches_schema` writes it */
function withThemeCheck(): AcquiredSchema {
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

describe('the rows of a function the tracer proves', () => {
  it('keeps the nullability of the table for a SETOF table function with a single query body', async () => {
    const text = await declarationsOf(`
      supabase.rpc('get_messages_by_username', { search_username: 'x' }).select('id, username, channel_id, message, data')
      supabase.rpc('get_messages_by_username', { search_username: 'x' })
    `)
    const row = rowOf(
      text,
      'f|public|get_messages_by_username|id, username, channel_id, message, data'
    )
    // NOT NULL columns pass through `SELECT * FROM messages` untouched, nullable ones stay nullable
    expect(row).toContain("id: SupabaseColumnType<'public.messages.id', number>;")
    expect(row).toContain("username: SupabaseColumnType<'public.messages.username', string>;")
    expect(row).toContain("channel_id: SupabaseColumnType<'public.messages.channel_id', number>;")
    expect(row).toContain("message: SupabaseColumnType<'public.messages.message', string> | null;")
    expect(row).toContain("data: SupabaseColumnType<'public.messages.data', Json> | null")
    expect(rowOf(text, 'f|public|get_messages_by_username|*')).toContain(
      "username: SupabaseColumnType<'public.messages.username', string>;"
    )
    const checked = typecheckConsumer({ files: { 'db.d.ts': text } })
    expect(checked.byFile.get('db.d.ts') ?? []).toEqual([])
  }, 180_000)

  it('types the columns of RETURNS TABLE from the columns the body selects', async () => {
    const text = await declarationsOf(`
      supabase.rpc('get_username_and_status', { name_param: 'x' })
    `)
    expect(rowOf(text, 'f|public|get_username_and_status|*')).toBe(
      "{ username: SupabaseColumnType<'public.users.username', string>; status: SupabaseColumnType<'public.users.status', SupabaseDatabase['public']['Enums']['user_status']> | null }"
    )
  }, 180_000)

  it('applies the JSON Schema of a column the body passes through, and not to a function it cannot trace', async () => {
    const text = await declarationsOf(
      `
      supabase.rpc('function_returning_set_of_rows').select('theme:data->>theme')
      supabase.rpc('function_returning_row').select('theme:data->>theme')
      supabase.rpc('set_users_offline', { name_param: 'x' }).select('theme:data->>theme')
    `,
      withThemeCheck()
    )
    const derived = (key: string): string =>
      /SupabaseColumnType<'public\.users\.data', (.*?)>, \[/.exec(entryOf(text, key))?.[1] ?? ''
    // a set returned by `SELECT * FROM users` holds stored rows
    expect(derived('f|public|function_returning_set_of_rows|theme:data->>theme')).toContain(
      "'light' | 'dark'"
    )
    // so does the one row of a single query body
    expect(derived('f|public|function_returning_row|theme:data->>theme')).toContain(
      "'light' | 'dark'"
    )
    // an UPDATE ... RETURNING is not a query the tracer reads: the rows may be anything
    expect(derived('f|public|set_users_offline|theme:data->>theme')).toBe('Json')
  }, 180_000)

  it('keeps every field of a single composite nullable', async () => {
    const text = await declarationsOf(`supabase.rpc('function_returning_row')`)
    const row = rowOf(text, 'f|public|function_returning_row|*')
    expect(row).toContain("username: SupabaseColumnType<'public.users.username', string> | null;")
  }, 180_000)

  it('keeps the columns of a function the tracer cannot read nullable', async () => {
    const text = await declarationsOf(`supabase.rpc('set_users_offline', { name_param: 'x' })`)
    const row = rowOf(text, 'f|public|set_users_offline|*')
    expect(row).toContain("username: SupabaseColumnType<'public.users.username', string> | null;")
  }, 180_000)
})

describe('the to-one embeds of the rows of a function', () => {
  const SELECT = 'id, users(username), channels(id)'
  const KEY = `f|public|get_messages_by_username|${SELECT}`
  const SOURCE = `supabase.rpc('get_messages_by_username', { search_username: 'x' }).select('${SELECT}')`

  it('are restored by a foreign key for a STABLE function', async () => {
    const text = await declarationsOf(SOURCE)
    const row = rowOf(text, KEY)
    expect(row).toContain('users: { username: SupabaseColumnType<')
    expect(row).not.toMatch(/users: \{[^}]*\} \| null/)
    expect(row).not.toMatch(/channels: \{[^}]*\} \| null/)
  }, 180_000)

  it('stay nullable for a VOLATILE function, which sees a newer snapshot for each query', async () => {
    const text = await declarationsOf(SOURCE, withVolatility('get_messages_by_username', 'v'))
    const row = rowOf(text, KEY)
    expect(row).toMatch(/users: \{[^}]*\} \| null/)
    expect(row).toMatch(/channels: \{[^}]*\} \| null/)
    // the columns it passes through are still the table's
    expect(row).toContain("id: SupabaseColumnType<'public.messages.id', number>;")
  }, 180_000)
})

describe('a JSON path or an aggregate over a column of the rows of a function', () => {
  const SELECT = 'kind:payload->>kind, name.max()'
  const KEY = `f|public|users_payload_and_name|${SELECT}`
  const SOURCE = `supabase.rpc('users_payload_and_name').select('${SELECT}')`

  it('keeps the stored column the body passes through, so its JSON Schema and overrides apply', async () => {
    const text = await declarationsOf(SOURCE, withThemeCheck())
    const row = rowOf(text, KEY)
    expect(row).toMatch(
      /PgrstJsonText<SupabaseColumnType<'public\.users\.data', [^>]*'light' \| 'dark'[^>]*>, \['kind'\]>/
    )
    expect(row).toContain("max: SupabaseColumnType<'public.users.username', string> | null")
    expect(typecheckConsumer({ files: { 'db.d.ts': text } }).byFile.get('db.d.ts') ?? []).toEqual(
      []
    )
  }, 180_000)
})
