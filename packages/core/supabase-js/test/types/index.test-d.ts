import { expectError, expectType } from 'tsd'
import { SupabaseClient, createClient } from '../../src/index'
import type { DatabaseWithoutInternals, DefaultDatabase, GenericDatabase } from '../../src/index'
import { Database, Json } from '../types'

const URL = 'http://localhost:3000'
const KEY = 'some.fake.key'
const supabase = createClient<Database>(URL, KEY)

// table invalid type
{
  expectError(supabase.from(42))
  expectError(supabase.from('some_table_that_does_not_exist'))
}

// `null` can't be used with `.eq()`
{
  supabase.from('users').select().eq('username', 'foo')
  expectError(supabase.from('users').select().eq('username', null))

  const nullableVar = 'foo' as string | null
  expectError(supabase.from('users').select().eq('username', nullableVar))
}

// cannot update non-updatable views
{
  expectError(supabase.from('updatable_view').update({ non_updatable_column: 0 }))
}

// cannot update non-updatable columns
{
  expectError(supabase.from('updatable_view').update({ non_updatable_column: 0 }))
}

// rpc with no planned call: the result is the function's `Returns`
{
  const { data, error } = await supabase.rpc('get_status', { name_param: 'supabot' })
  if (error) {
    throw new Error(error.message)
  }
  expectType<'ONLINE' | 'OFFLINE'>(data)
  expectError(supabase.rpc('get_status', { name_param: 1 }))
}

// createClient with custom schema
{
  const customSchemaClient = createClient<Database, 'personal'>(URL, KEY, {
    db: { schema: 'personal' },
  })
  const customSchemaNewClient = new SupabaseClient<Database, 'personal'>(URL, KEY, {
    db: { schema: 'personal' },
  })
  customSchemaClient.from('users')
  customSchemaNewClient.from('users')
  // @ts-expect-error should raise error if providing table name not in the schema
  customSchemaClient.from('channels_details')
  // @ts-expect-error should raise error if providing table name not in the schema
  customSchemaNewClient.from('channels_details')
  // @ts-expect-error should raise error if providing a schema name not in the database
  createClient<Database, 'unknown_schema'>(URL, KEY)
}

// without a Database generic the client reads the default database: the global `SupabaseDatabase` when the postgrest
// mapper declares it, the untyped `GenericDatabase` otherwise (nothing declares it in this package's tests)
{
  const untyped = createClient(URL, KEY)
  expectType<SupabaseClient<DefaultDatabase>>(untyped)
  expectType<SupabaseClient<GenericDatabase>>(untyped)
  untyped.from('any_table')
  untyped.schema('any_schema').from('any_table')
  untyped.rpc('any_function', { any: 'argument' })
}

// from, schema and rpc delegate with postgrest-js types
{
  expectType<ReturnType<typeof supabase.schema<'personal'>>['from']>(
    supabase.schema('personal').from
  )
  supabase.schema('personal').from('users')
  // @ts-expect-error a table of another schema
  supabase.schema('personal').from('messages')
  // @ts-expect-error a schema that isn't in the database
  supabase.schema('unknown_schema')
  expectError(supabase.rpc('function_that_does_not_exist'))
}

// `.cast<T>()` replaces `.returns<T>()` and `.overrideTypes<T>()`
{
  const { data, error } = await supabase.from('users').select().cast<{ foo: 'bar' }>()
  if (error) {
    throw new Error(error.message)
  }
  expectType<{ foo: 'bar' }[]>(data)
}

// the generated types of `supabase gen types typescript`, with no generated postgrest entries: results read them
// (the row's columns keep their types, any other key of a select is `any`, an rpc returns its `Returns`)
type GenTypes = {
  __InternalSupabase: { PostgrestVersion: '12' }
  public: {
    Tables: {
      todos: {
        Row: { id: number; title: string; done: boolean | null; meta: Json | null }
        Insert: { id?: number; title: string; done?: boolean | null; meta?: Json | null }
        Update: { id?: number; title?: string; done?: boolean | null; meta?: Json | null }
        Relationships: []
      }
    }
    Views: {
      open_todos: {
        Row: { id: number | null; title: string | null }
        Relationships: []
      }
    }
    Functions: {
      count_todos: { Args: { done_only: boolean }; Returns: number }
      list_todos: { Args: { owner: string }; Returns: { id: number; title: string }[] }
      no_args: { Args: Record<PropertyKey, never>; Returns: undefined }
    }
    Enums: { priority: 'low' | 'high' }
    CompositeTypes: { pair: { a: number; b: string } }
  }
  audit: {
    Tables: {
      events: {
        Row: { id: number; kind: string }
        Insert: { id?: number; kind: string }
        Update: { id?: number; kind?: string }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: { [_ in never]: never }
    Enums: { [_ in never]: never }
    CompositeTypes: { [_ in never]: never }
  }
}
{
  const typed = createClient<GenTypes>(URL, KEY)

  const { data: rows } = await typed.from('todos').select('id, title, label:title, tags(id)')
  const row = rows![0]
  expectType<number>(row.id)
  expectType<string>(row.title)
  expectType<boolean | null>(row.done)
  expectType<any>(row.label)
  expectType<any>(row.tags)

  const { data: one } = await typed.from('todos').select('id').eq('id', 1).single()
  expectType<number>(one!.id)
  const { data: maybe } = await typed.from('todos').select('id').maybeSingle()
  expectType<number | undefined>(maybe?.id)
  const { data: inserted } = await typed.from('todos').insert({ title: 'a' }).select('id')
  expectType<number>(inserted![0].id)

  expectError(typed.from('todos').insert({ title: 1 }))
  expectError(typed.from('todos').update({ done: 'yes' }))
  expectError(typed.from('not_a_table'))

  const { data: count } = await typed.rpc('count_todos', { done_only: true })
  expectType<number | null>(count)
  const { data: list } = await typed.rpc('list_todos', { owner: 'me' })
  expectType<{ id: number; title: string }[] | null>(list)
  const { data: first } = await typed.rpc('list_todos', { owner: 'me' }).single()
  expectType<{ id: number; title: string } | null>(first)
  const { data: nothing } = await typed.rpc('no_args')
  expectType<undefined | null>(nothing)
  expectError(typed.rpc('count_todos', { done_only: 'yes' }))
  expectError(typed.rpc('no_such_function'))
}

// the v2 generic forms compile unchanged: `<Database>`, `<Database, SchemaName>`, `<Database, Options>` and
// `<Database, Options, SchemaName>`, on `createClient`, `new SupabaseClient` and the `SupabaseClient` type. The options
// object (`PostgrestVersion`) is ignored; `__InternalSupabase` is never a schema.
{
  const bare = createClient<GenTypes>(URL, KEY)
  const named = createClient<GenTypes, 'audit'>(URL, KEY, { db: { schema: 'audit' } })
  const options = createClient<GenTypes, { PostgrestVersion: '12' }>(URL, KEY)
  const optionsAndSchema = createClient<GenTypes, { PostgrestVersion: '12' }, 'audit'>(URL, KEY, {
    db: { schema: 'audit' },
  })
  const constructed = new SupabaseClient<GenTypes, { PostgrestVersion: '12' }, 'audit'>(URL, KEY, {
    db: { schema: 'audit' },
  })

  // the options form reads the `public` schema, the schema name or the third argument picks another
  expectType<SupabaseClient<GenTypes, 'public', 'public'>>(bare)
  expectType<SupabaseClient<GenTypes, 'audit', 'audit'>>(named)
  expectType<SupabaseClient<GenTypes, { PostgrestVersion: '12' }, 'public'>>(options)
  expectType<SupabaseClient<GenTypes, { PostgrestVersion: '12' }, 'audit'>>(optionsAndSchema)
  expectType<SupabaseClient<GenTypes, { PostgrestVersion: '12' }, 'audit'>>(constructed)

  // results still read the database through the generated types
  const { data: todos } = await options.from('todos').select('id, title')
  expectType<number>(todos![0].id)
  expectType<string>(todos![0].title)
  const { data: open } = await options.from('open_todos').select('id')
  expectType<number | null>(open![0].id)
  const { data: events } = await optionsAndSchema.from('events').select('kind')
  expectType<string>(events![0].kind)
  const { data: count } = await options.rpc('count_todos', { done_only: true })
  expectType<number | null>(count)
  const { data: list } = await options.rpc('list_todos', { owner: 'me' })
  expectType<{ id: number; title: string }[] | null>(list)
  expectError(options.from('events'))
  expectError(optionsAndSchema.from('todos'))
  expectError(options.rpc('no_such_function'))

  // a schema switch carries the database
  const { data: switched } = await options.schema('audit').from('events').select('id')
  expectType<number>(switched![0].id)

  // a database without a `public` schema defaults to its first schema, never to `__InternalSupabase`
  type OnlyAudit = { __InternalSupabase: { PostgrestVersion: '12' }; audit: GenTypes['audit'] }
  const noPublic = createClient<OnlyAudit, { PostgrestVersion: '12' }>(URL, KEY)
  noPublic.from('events')
  expectError(noPublic.from('todos'))

  // `__InternalSupabase` is not a schema name, in any position
  // @ts-expect-error not a schema of the database
  createClient<GenTypes, '__InternalSupabase'>(URL, KEY)
  // @ts-expect-error not a schema of the database
  createClient<GenTypes, { PostgrestVersion: '12' }, '__InternalSupabase'>(URL, KEY)
  // @ts-expect-error not a schema of the database
  new SupabaseClient<GenTypes, { PostgrestVersion: '12' }, '__InternalSupabase'>(URL, KEY)
  // @ts-expect-error not a schema of the database
  options.schema('__InternalSupabase')
}

// DatabaseWithoutInternals strips the internal metadata key
{
  type X = { Tables: { t: { Row: { id: number } } } }
  type WithInternals = { public: X; __InternalSupabase: { PostgrestVersion: '12' } }
  expectType<{ public: X }>({} as DatabaseWithoutInternals<WithInternals>)
  expectType<DatabaseWithoutInternals<WithInternals>>({} as { public: X })
}
