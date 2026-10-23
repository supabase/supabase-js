import {
  buildDatabaseDeclarations,
  createPlannerHost,
  createTracer,
  type AcquiredSchema,
} from '../src'
import type { PlannerHost, Tracer } from '../src'
import { acquireFromStack, plannerWasmPath } from './support/acquired'
import { TYPE_HELPERS, typecheckConsumer, type ConsumerResult } from './support/consumer'

/**
 * Acquire the postgrest-js test stack, plan and print the `SupabaseDatabase` declarations, then type-check them with
 * the workspace TypeScript against postgrest-js `src`: the consumer files assert what a user of the emitted module sees
 * (`Equal` is exact, `@ts-expect-error` marks what must be rejected; an unused one is itself an error).
 */
const HELPERS = `import type { Json } from './db'\n${TYPE_HELPERS}export type { Json }\n`

let acquired: AcquiredSchema
let host: PlannerHost
let tracer: Tracer

beforeAll(async () => {
  acquired = await acquireFromStack()
  host = createPlannerHost({ wasmPath: plannerWasmPath() })
  tracer = await createTracer()
}, 120_000)
afterAll(async () => {
  await host?.close()
})

function expectClean(result: ConsumerResult, file: string): void {
  expect(result.byFile.get(file) ?? []).toEqual([])
}

describe('database declarations of the postgrest-js test stack', () => {
  let text: string
  let diagnostics: { severity: string; message: string }[]
  let result: ConsumerResult

  const consumers: Record<string, string> = {
    'users.ts': `
import type { Equal, Expect, Json } from './helpers'
type Status = 'ONLINE' | 'OFFLINE'
type T = SupabaseDatabase['public']['Tables']['users']

export type Row = Expect<Equal<T['Row'], {
  username: string
  data: Json | null
  age_range: unknown
  status: Status | null
  catchphrase: unknown
}>>
// username is the only required column of an insert; the rest has a default or is nullable
export type Insert = Expect<Equal<T['Insert'], {
  username: string
  data?: Json | null
  age_range?: unknown
  status?: Status | null
  catchphrase?: unknown
}>>
export type Update = Expect<Equal<T['Update'], Partial<T['Insert']>>>
export type Facts = Expect<Equal<T['FactColumns'], 'age_range' | 'catchphrase' | 'status' | 'username'>>
export type Rels = Expect<Equal<T['Relationships'], []>>

export const insertOk: T['Insert'] = { username: 'a' }
// @ts-expect-error username is required
export const insertEmpty: T['Insert'] = {}
export const updateEmpty: T['Update'] = {}
// @ts-expect-error not a status
export const badStatus: T['Update'] = { status: 'AWAY' }
`,
    'messages-channels.ts': `
import type { Equal, Expect, Json } from './helpers'
type M = SupabaseDatabase['public']['Tables']['messages']
type C = SupabaseDatabase['public']['Tables']['channels']

// an int8 identity column is a number, and not required by an insert
export type MRow = Expect<Equal<M['Row'], {
  id: number
  data: Json | null
  message: string | null
  username: string
  channel_id: number
}>>
export type MInsert = Expect<Equal<M['Insert'], {
  id?: number
  data?: Json | null
  message?: string | null
  username: string
  channel_id: number
}>>
export type MUpdate = Expect<Equal<M['Update'], Partial<M['Insert']>>>
export type MFacts = Expect<Equal<M['FactColumns'], 'channel_id' | 'id' | 'message' | 'username'>>
export type CRow = Expect<Equal<C['Row'], { id: number; data: Json | null; slug: string | null }>>
export type CInsert = Expect<Equal<C['Insert'], { id?: number; data?: Json | null; slug?: string | null }>>

// a foreign key is a relationship with the columns on both sides
type ToChannels = Extract<M['Relationships'][number], { referencedRelation: 'channels' }>
export type Fk = Expect<Equal<ToChannels, {
  foreignKeyName: 'messages_channel_id_fkey'
  columns: ['channel_id']
  isOneToOne: false
  referencedRelation: 'channels'
  referencedColumns: ['id']
}>>
`,
    'view.ts': `
import type { Equal, Expect, Json } from './helpers'
type V = SupabaseDatabase['public']['Views']
type Status = 'ONLINE' | 'OFFLINE'

// the planner reports every view column nullable; tracing finds username comes from users.username (not null)
export type Active = Expect<Equal<V['active_users']['Row'], {
  username: string
  data: Json | null
  age_range: unknown
  status: Status | null
  catchphrase: unknown
}>>
// an updatable view takes writes, with every column optional
export const insert: V['active_users']['Insert'] = {}
export const update: V['active_users']['Update'] = { status: 'ONLINE' }
// a read-only view has neither
// @ts-expect-error recent_messages is not updatable
export type NoInsert = V['recent_messages']['Insert']
// @ts-expect-error non_updatable_view is not updatable
export type NoUpdate = V['non_updatable_view']['Update']
export type Recent = Expect<Equal<keyof V['recent_messages'], 'Row' | 'FactColumns' | 'Relationships'>>
`,
    'enum-composite.ts': `
import type { Equal, Expect } from './helpers'
type P = SupabaseDatabase['public']
export type Enum = Expect<Equal<P['Enums']['user_status'], 'ONLINE' | 'OFFLINE'>>
export type EnumPersonal = Expect<Equal<SupabaseDatabase['personal']['Enums']['user_status'], 'ONLINE' | 'OFFLINE'>>
// every attribute of a composite can be NULL
export type Address = Expect<Equal<P['CompositeTypes']['address'], { street: string | null; city: string | null }>>
// a column of a composite type refers to it
export type Col = Expect<Equal<
  P['Tables']['inference_cases']['Row']['shipping_address'],
  P['CompositeTypes']['address'] | null
>>
`,
    'rpc.ts': `
import type { Equal, Expect } from './helpers'
import type { JsonIn } from './db'
type F = SupabaseDatabase['public']['Functions']
export type GetStatus = Expect<Equal<F['get_status'], {
  Args: { name_param: string }
  Returns: SupabaseDatabase['public']['Enums']['user_status'] | null
}>>
export type EchoAddress = Expect<Equal<F['echo_address'], {
  Args: { address: SupabaseDatabase['public']['CompositeTypes']['address'] }
  Returns: SupabaseDatabase['public']['CompositeTypes']['address']
}>>
// a function without arguments takes none
export type NoArgs = Expect<Equal<F['void_func'], { Args: Record<string, never>; Returns: undefined }>>
// a table's row used as a function's value is a composite value, not a stored row: PostgreSQL enforces the table's
// constraints on its rows only, so every attribute can be null
type Value<R> = { [K in keyof R]: R[K] | null }
// a set-returning function over a table returns composite values
export type SetOf = Expect<Equal<F['get_user_messages']['Returns'], Value<SupabaseDatabase['public']['Tables']['messages']['Row']>[]>>
// a function of a table row takes the composite value
type UserRow = SupabaseDatabase['public']['Tables']['users']['Row']
export type RowArg = Expect<Equal<F['get_user_messages']['Args'], { user_row: { [K in keyof UserRow]: (K extends 'data' ? JsonIn : UserRow[K]) | null } }>>
// an argument with a default is optional
export type Optional = Expect<Equal<F['function_with_optional_param']['Args'], { param?: string }>>
`,
    'client.ts': `
import type { PostgrestClient } from '@supabase/postgrest-js'
declare const supabase: PostgrestClient

// the client reads the global database: writes are typed by Insert / Update
supabase.from('users').insert({ username: 'x', status: 'ONLINE' })
// @ts-expect-error username is required
supabase.from('users').insert({ status: 'ONLINE' })
// @ts-expect-error not a status
supabase.from('users').update({ status: 'AWAY' })
export {}
`,
  }

  beforeAll(async () => {
    const built = await buildDatabaseDeclarations({ acquired, host, tracer })
    text = built.text
    diagnostics = built.diagnostics
    result = typecheckConsumer({
      files: { 'db.d.ts': text, 'helpers.ts': HELPERS, ...consumers },
    })
  }, 180_000)

  test('prints a complete module without errors, leaving partitions out with an info note', () => {
    expect(diagnostics.filter((d) => d.severity !== 'info')).toEqual([])
    expect(diagnostics.map((d) => d.message).join('\n')).toMatch(/events_2024/)
    expect(text).toContain('declare global {')
    expect(text).toContain("import type { SupabaseColumnType } from '@supabase/postgrest-js'")
    expect(text).toContain('export type Json =')
    expect(text).toContain('export type JsonIn =')
    expect(text).toMatch(/interface SupabasePgrstStatus \{\s+state: 'ready'/)
    // the printer is deterministic
    expect(text).not.toMatch(/events_20/)
  })

  test('the declarations are sound on their own and against postgrest-js', () => {
    expectClean(result, 'db.d.ts')
    expectClean(result, 'helpers.ts')
  })

  test.each(Object.keys(consumers))('consumer %s sees what the database declares', (file) => {
    expectClean(result, file)
  })

  test('every source column value is wrapped, with its own nullability outside the wrapper', () => {
    expect(text).toContain("username: SupabaseColumnType<'public.users.username', string>\n")
    expect(text).toContain("data: SupabaseColumnType<'public.users.data', Json> | null\n")
    // a view column carries the key of the base column it was traced to
    expect(text).toMatch(
      /active_users: \{\s+Row: \{\s+username: SupabaseColumnType<'public\.users\.username', string>/
    )
  })

  test('printing twice gives the same text', async () => {
    const again = await buildDatabaseDeclarations({ acquired, host, tracer })
    expect(again.text).toBe(text)
  }, 60_000)
})

describe('declarations when the planner cannot load', () => {
  test('a planner that fails to load is an error diagnostic and an empty module, not an exception', async () => {
    const broken = createPlannerHost({ wasmPath: '/nonexistent/postgrest-planner.wasm' })
    try {
      const built = await buildDatabaseDeclarations({ acquired, host: broken, tracer })
      expect(built.text).toBe('')
      expect(built.diagnostics).toEqual([
        { severity: 'error', message: expect.stringContaining('could not load the schema') },
      ])
    } finally {
      await broken.close()
    }
  }, 60_000)
})

describe('JSON Schema CHECKs and column type overrides', () => {
  // A scratch database is not needed: the acquisition reads the CHECK definition as pg_get_constraintdef prints it
  const SCHEMA =
    '{"type":"object","properties":{"theme":{"enum":["light","dark"]}},"required":["theme"],"additionalProperties":false}'
  let result: ConsumerResult

  const consumers: Record<string, string> = {
    'json.ts': `
import type { Equal, Expect } from './helpers'
type Theme = { theme: 'light' | 'dark' }
type U = SupabaseDatabase['public']['Tables']['users']
type A = SupabaseDatabase['public']['Views']['active_users']

// the CHECK on users.data types the column; the column stays nullable, and the view column traced to it follows
export type Row = Expect<Equal<U['Row']['data'], Theme | null>>
export type Insert = Expect<Equal<U['Insert']['data'], Theme | null | undefined>>
export type View = Expect<Equal<A['Row']['data'], Theme | null>>
// FactColumns keeps json columns out: their values are not what was stored
export type Facts = Expect<Equal<Extract<U['FactColumns'], 'data'>, never>>
// other json columns are untouched (the overrides of the sibling file leave messages alone)
type Json = import('./helpers').Json
export type Other = Expect<Equal<SupabaseDatabase['public']['Tables']['messages']['Row']['data'], Json | null>>
`,
    'overrides.ts': `
import type { Equal, Expect } from './helpers'
declare global {
  interface SupabaseColumnTypes {
    'public.channels.data': { color: string }
    'public.users.username': 'alice' | 'bob'
  }
}
type P = SupabaseDatabase['public']

// the override replaces the derived type; the column's own nullability is not the override's to drop
export type Channel = Expect<Equal<P['Tables']['channels']['Row']['data'], { color: string } | null>>
export type ChannelInsert = Expect<Equal<P['Tables']['channels']['Insert']['data'], { color: string } | null | undefined>>
// in Row, Insert, Update and in the view column that traces to it
export type UserRow = Expect<Equal<P['Tables']['users']['Row']['username'], 'alice' | 'bob'>>
export type UserInsert = Expect<Equal<P['Tables']['users']['Insert']['username'], 'alice' | 'bob'>>
export type UserUpdate = Expect<Equal<P['Tables']['users']['Update']['username'], 'alice' | 'bob' | undefined>>
export type ViewColumn = Expect<Equal<P['Views']['active_users']['Row']['username'], 'alice' | 'bob'>>
// columns without an override keep their derived type
export type Untouched = Expect<Equal<P['Tables']['messages']['Row']['username'], string>>
// @ts-expect-error carol is not an allowed username any more
export const carol: P['Tables']['users']['Insert'] = { username: 'carol' }
export const alice: P['Tables']['users']['Insert'] = { username: 'alice' }
`,
  }

  beforeAll(async () => {
    const withCheck: AcquiredSchema = {
      ...acquired,
      supplementary: {
        ...acquired.supplementary,
        jsonSchemaChecks: [
          {
            schema: 'public',
            table: 'users',
            constraint: 'users_data_theme',
            definition: `CHECK (((data IS NULL) OR extensions.jsonb_matches_schema('${SCHEMA}'::json, data)))`,
            columns: ['data'],
            validated: true,
          },
        ],
      },
    }
    const built = await buildDatabaseDeclarations({ acquired: withCheck, host, tracer })
    expect(built.diagnostics.filter((d) => d.severity !== 'info')).toEqual([])
    result = typecheckConsumer({
      files: { 'db.d.ts': built.text, 'helpers.ts': HELPERS, ...consumers },
    })
  }, 180_000)

  test('the declarations still type-check', () => {
    expectClean(result, 'db.d.ts')
  })

  test.each(Object.keys(consumers))('consumer %s', (file) => {
    expectClean(result, file)
  })
})
