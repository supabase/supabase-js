import type { AcquiredSchema } from '../src'
import { acquireFromStack } from './support/acquired'
import { TYPE_HELPERS, typecheckConsumer } from './support/consumer'
import { generateText, withThemeCheck } from './support/declarations'

let acquired: AcquiredSchema
beforeAll(async () => {
  acquired = await acquireFromStack()
}, 120_000)

const declarationsOf = (source: string, schema: AcquiredSchema = acquired): Promise<string> =>
  generateText(schema, source)

/** The entry printed for `key`, from `'key': {` to its closing brace. */
function entryOf(text: string, key: string): string {
  const start = text.indexOf(`'${key}': {`)
  expect(start).toBeGreaterThanOrEqual(0)
  return text.slice(start, text.indexOf('\n    }', start))
}

describe('duplicate output names', () => {
  // `JSON.parse` keeps the last value of a repeated name: the row, and what is known about it, follow that one
  it('keeps provenance of the winning expression only', async () => {
    const text = await declarationsOf(`
      supabase.from('messages').select('x:id,x:message::text').not('id', 'is', null)
      supabase.from('messages').select('x:id,x:message')
      supabase.from('messages').select('x:message,x:id')
    `)
    // the cast wins: a computed value has no source column
    expect(entryOf(text, 'r|public|messages|x:id,x:message::text')).toContain('sources: {}')
    // a plain projection wins: its own column, once
    const plain = entryOf(text, 'r|public|messages|x:id,x:message')
    expect(plain).toContain("sources: { x: 'message' }")
    expect(entryOf(text, 'r|public|messages|x:message,x:id')).toContain("sources: { x: 'id' }")
    const checked = typecheckConsumer({ files: { 'db.d.ts': text } })
    expect(checked.byFile.get('db.d.ts') ?? []).toEqual([])
  }, 120_000)
})

describe('quoted type names', () => {
  /** `public.user_status` renamed to the type `public."mood(1)"`, next to an unrelated `public.mood` of other labels */
  function withModifierLikeName(): AcquiredSchema {
    const rename = (value: unknown): unknown => {
      if (value === 'public.user_status') return 'public."mood(1)"'
      if (Array.isArray(value)) return value.map(rename)
      if (value !== null && typeof value === 'object') {
        const object = value as Record<string, unknown>
        const isEnum = object['schema'] === 'public' && object['name'] === 'user_status'
        return Object.fromEntries(
          Object.entries(object).map(([k, v]) => [
            k,
            isEnum && k === 'name' ? 'mood(1)' : rename(v),
          ])
        )
      }
      return value
    }
    const supplementary = rename(acquired.supplementary) as AcquiredSchema['supplementary']
    return {
      ...acquired,
      dump: JSON.stringify(rename(JSON.parse(acquired.dump))),
      supplementary: {
        ...supplementary,
        enums: [...supplementary.enums, { schema: 'public', name: 'mood', labels: ['happy'] }],
      },
    }
  }

  it('looks a type up by its name as written, not with the modifier-like part removed', async () => {
    const text = await declarationsOf(
      `supabase.from('users').select('status')`,
      withModifierLikeName()
    )
    expect(entryOf(text, 'r|public|users|status')).toContain(
      "SupabaseDatabase['public']['Enums']['mood(1)']"
    )
    expect(entryOf(text, 'r|public|users|status')).not.toContain("['Enums']['mood']")
  }, 120_000)
})

describe('JSON Schema of a CHECK constraint', () => {
  // a function the tracer cannot read can return rows its table's CHECK would refuse, however the select reads them
  it('is not applied to a JSON path or an aggregate over the rows of a function', async () => {
    const text = await declarationsOf(
      `
      supabase.from('users').select('theme:data->>theme')
      supabase.rpc('set_users_offline', { name_param: 'x' }).select('theme:data->>theme')
      supabase.rpc('set_users_offline', { name_param: 'x' }).select('theme:data->theme')
      supabase.rpc('set_users_offline', { name_param: 'x' }).select('latest:data->>theme.max()')
    `,
      withThemeCheck(acquired)
    )
    const derived = (key: string): string =>
      /SupabaseColumnType<'public\.users\.data', (.*?)>, \[/.exec(entryOf(text, key))?.[1] ?? ''
    // the table's own rows satisfy the CHECK
    expect(derived('r|public|users|theme:data->>theme')).toContain("'light' | 'dark'")
    // the rows of a function do not have to
    for (const key of [
      'f|public|set_users_offline|theme:data->>theme',
      'f|public|set_users_offline|theme:data->theme',
      'f|public|set_users_offline|latest:data->>theme.max()',
    ]) {
      expect(derived(key)).toBe('Json')
    }
  }, 120_000)
})

describe('min and max of a JSON path', () => {
  const OVERRIDE = `
import type { Equal, Expect } from './helpers'
declare global {
  interface SupabaseColumnTypes {
    'public.users.data': { theme: 'light' | 'dark' }
  }
}
type Selects = SupabaseSelects
export type Plain = Expect<Equal<Selects['r|public|users|theme:data->>theme']['row']['theme'], 'light' | 'dark' | null>>
export type Latest = Expect<Equal<Selects['r|public|users|latest:data->>theme.max()']['row']['latest'], 'light' | 'dark' | null>>
`

  // the aggregate keeps the type of the value it aggregates, and the override of its column is part of that type
  it('keeps the override of the column the path reads', async () => {
    const text = await declarationsOf(`
      supabase.from('users').select('theme:data->>theme')
      supabase.from('users').select('latest:data->>theme.max()')
      supabase.from('users').select('first:data->>theme.min()')
    `)
    for (const key of [
      'r|public|users|latest:data->>theme.max()',
      'r|public|users|first:data->>theme.min()',
    ]) {
      expect(entryOf(text, key)).toContain(
        "PgrstJsonText<SupabaseColumnType<'public.users.data', Json>, ['theme']>"
      )
    }
    const checked = typecheckConsumer({
      files: {
        'db.d.ts': text,
        'helpers.ts': `import type { Json } from './db'\n${TYPE_HELPERS}export type { Json }\n`,
        'override.ts': OVERRIDE,
      },
    })
    expect(checked.byFile.get('override.ts') ?? []).toEqual([])
    expect(checked.byFile.get('db.d.ts') ?? []).toEqual([])
  }, 120_000)
})
