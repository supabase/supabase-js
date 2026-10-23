import { expectError, expectType } from 'tsd'
import { SupabaseClient, createClient } from '../../src/index'
import type { DefaultDatabase, GenericDatabase } from '../../src/index'
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

// rpc: the result is `unknown` until the postgrest mapper plans the call
{
  const { data, error } = await supabase.rpc('get_status', { name_param: 'supabot' })
  if (error) {
    throw new Error(error.message)
  }
  expectType<unknown>(data)
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

// the removed second generic (a PostgrestVersion options object) is gone: the second generic is the schema name
{
  // @ts-expect-error
  createClient<Database, { PostgrestVersion: '13' }>(URL, KEY)
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
