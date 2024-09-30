import { expectError, expectType } from 'tsd'
import { PostgrestClient } from '../src/index'
import { Prettify } from '../src/types'
import { Database, Json } from './types'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient<Database>(REST_URL)

// table invalid type
{
  expectError(postgrest.from(42))
  expectError(postgrest.from('nonexistent_table'))
}

// `null` can't be used with `.eq()`
{
  postgrest.from('users').select().eq('username', 'foo')
  expectError(postgrest.from('users').select().eq('username', null))

  const nullableVar = 'foo' as string | null
  expectError(postgrest.from('users').select().eq('username', nullableVar))
}

// can override result type
{
  const { data, error } = await postgrest
    .from('users')
    .select('*, messages(*)')
    .returns<{ messages: { foo: 'bar' }[] }[]>()
  if (error) {
    throw new Error(error.message)
  }
  expectType<{ foo: 'bar' }[]>(data[0].messages)
}
{
  const { data, error } = await postgrest
    .from('users')
    .insert({ username: 'foo' })
    .select('*, messages(*)')
    .returns<{ messages: { foo: 'bar' }[] }[]>()
  if (error) {
    throw new Error(error.message)
  }
  expectType<{ foo: 'bar' }[]>(data[0].messages)
}

// cannot update non-updatable views
{
  expectError(postgrest.from('updatable_view').update({ non_updatable_column: 0 }))
}

// cannot update non-updatable columns
{
  expectError(postgrest.from('updatable_view').update({ non_updatable_column: 0 }))
}

// spread resource with single column in select query
{
  const { data, error } = await postgrest
    .from('messages')
    .select('message, ...users(status)')
    .single()
  if (error) {
    throw new Error(error.message)
  }
  expectType<{ message: string | null; status: Database['public']['Enums']['user_status'] | null }>(
    data
  )
}

// spread resource with all columns in select query
{
  const { data, error } = await postgrest.from('messages').select('message, ...users(*)').single()
  if (error) {
    throw new Error(error.message)
  }
  expectType<Prettify<{ message: string | null } & Database['public']['Tables']['users']['Row']>>(
    data
  )
}

// `count` in embedded resource
{
  const { data, error } = await postgrest.from('messages').select('message, users(count)').single()
  if (error) {
    throw new Error(error.message)
  }
  expectType<{ message: string | null; users: { count: number } }>(data)
}

// json accessor in select query
{
  const { data, error } = await postgrest
    .from('users')
    .select('data->foo->bar, data->foo->>baz')
    .single()
  if (error) {
    throw new Error(error.message)
  }
  // getting this w/o the cast, not sure why:
  // Parameter type Json is declared too wide for argument type Json
  expectType<Json>(data.bar as Json)
  expectType<string>(data.baz)
}

// rpc return type
{
  const { data, error } = await postgrest.rpc('get_status')
  if (error) {
    throw new Error(error.message)
  }
  expectType<'ONLINE' | 'OFFLINE'>(data)
}

// PostgrestBuilder's children retains class when using inherited methods
{
  const x = postgrest.from('channels').select()
  const y = x.throwOnError()
  const z = x.setHeader('', '')
  expectType<typeof x>(y)
  expectType<typeof x>(z)
}
