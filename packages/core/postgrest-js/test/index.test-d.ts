import { TypeEqual } from 'ts-expect'
import { expectError, expectType } from 'tsd'
import { PostgrestClient, PostgrestError } from '../src/index'
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

// `.eq()`, '.neq()' and `.in()` validate provided filter value when column is an enum.
// Behaves the same for simple columns, as well as relationship filters.
{
  expectError(postgrest.from('users').select().eq('status', 'invalid'))
  expectError(postgrest.from('users').select().neq('status', 'invalid'))
  expectError(postgrest.from('users').select().in('status', ['invalid']))

  expectError(
    postgrest.from('best_friends').select('users!first_user(status)').eq('users.status', 'invalid')
  )
  expectError(
    postgrest.from('best_friends').select('users!first_user(status)').neq('users.status', 'invalid')
  )
  expectError(
    postgrest
      .from('best_friends')
      .select('users!first_user(status)')
      .in('users.status', ['invalid'])
  )
  // Validate deeply nested embedded tables
  expectError(
    postgrest.from('users').select('messages(channels(*))').eq('messages.channels.id', 'invalid')
  )
  expectError(
    postgrest.from('users').select('messages(channels(*))').neq('messages.channels.id', 'invalid')
  )
  expectError(
    postgrest.from('users').select('messages(channels(*))').in('messages.channels.id', ['invalid'])
  )

  {
    const result = await postgrest.from('users').select('status').eq('status', 'ONLINE')
    if (result.error) {
      throw new Error(result.error.message)
    }
    expectType<{ status: Database['public']['Enums']['user_status'] | null }[]>(result.data)
  }

  {
    const result = await postgrest.from('users').select('status').neq('status', 'ONLINE')
    if (result.error) {
      throw new Error(result.error.message)
    }
    expectType<{ status: Database['public']['Enums']['user_status'] | null }[]>(result.data)
  }

  {
    const result = await postgrest
      .from('users')
      .select('status')
      .in('status', ['ONLINE', 'OFFLINE'])
    if (result.error) {
      throw new Error(result.error.message)
    }
    expectType<{ status: Database['public']['Enums']['user_status'] | null }[]>(result.data)
  }

  {
    const result = await postgrest
      .from('best_friends')
      .select('users!first_user(status)')
      .eq('users.status', 'ONLINE')
    if (result.error) {
      throw new Error(result.error.message)
    }
    expectType<{ users: { status: Database['public']['Enums']['user_status'] | null } }[]>(
      result.data
    )
  }

  {
    const result = await postgrest
      .from('best_friends')
      .select('users!first_user(status)')
      .neq('users.status', 'ONLINE')
    if (result.error) {
      throw new Error(result.error.message)
    }
    expectType<{ users: { status: Database['public']['Enums']['user_status'] | null } }[]>(
      result.data
    )
  }

  {
    const result = await postgrest
      .from('best_friends')
      .select('users!first_user(status)')
      .in('users.status', ['ONLINE', 'OFFLINE'])
    if (result.error) {
      throw new Error(result.error.message)
    }
    expectType<{ users: { status: Database['public']['Enums']['user_status'] | null } }[]>(
      result.data
    )
  }
}

// can override result type
{
  const result = await postgrest
    .from('users')
    .select('*, messages(*)')
    .returns<{ messages: { foo: 'bar' }[] }[]>()
  if (result.error) {
    throw new Error(result.error.message)
  }
  expectType<{ foo: 'bar' }[]>(result.data[0].messages)
}
{
  const result = await postgrest
    .from('users')
    .insert({ username: 'foo' })
    .select('*, messages(*)')
    .returns<{ messages: { foo: 'bar' }[] }[]>()
  if (result.error) {
    throw new Error(result.error.message)
  }
  expectType<{ foo: 'bar' }[]>(result.data[0].messages)
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
  const result = await postgrest.from('messages').select('message, ...users(status)').single()
  if (result.error) {
    throw new Error(result.error.message)
  }
  expectType<{ message: string | null; status: Database['public']['Enums']['user_status'] | null }>(
    result.data
  )
}

// spread resource with all columns in select query
{
  const result = await postgrest.from('messages').select('message, ...users(*)').single()
  if (result.error) {
    throw new Error(result.error.message)
  }
  expectType<Prettify<{ message: string | null } & Database['public']['Tables']['users']['Row']>>(
    result.data
  )
}

// `count` in embedded resource
{
  const result = await postgrest.from('messages').select('message, users(count)').single()
  if (result.error) {
    throw new Error(result.error.message)
  }
  expectType<{ message: string | null; users: { count: number } }>(result.data)
}

// json accessor in select query
{
  const result = await postgrest.from('users').select('data->foo->bar, data->foo->>baz').single()
  if (result.error) {
    throw new Error(result.error.message)
  }
  // getting this w/o the cast, not sure why:
  // Parameter type Json is declared too wide for argument type Json
  expectType<Json>(result.data.bar)
  expectType<string>(result.data.baz)
}

// rpc return type
{
  const result = await postgrest.rpc('get_status')
  if (result.error) {
    throw new Error(result.error.message)
  }
  expectType<'ONLINE' | 'OFFLINE'>(result.data)
}

// PostgrestBuilder's children retains class when using inherited methods
{
  const x = postgrest.from('channels').select()
  const y = x.throwOnError()
  const z = x.setHeader('', '')
  expectType<typeof y extends typeof x ? true : false>(true)
  expectType<typeof z extends typeof x ? true : false>(true)
}

// Should have nullable data and error field
{
  const result = await postgrest.from('users').select('username, messages(id, message)').limit(1)
  let expected:
    | {
        username: string
        messages: {
          id: number
          message: string | null
        }[]
      }[]
    | null
  const { data } = result
  const { error } = result
  expectType<TypeEqual<typeof data, typeof expected>>(true)
  let err: PostgrestError | null
  expectType<TypeEqual<typeof error, typeof err>>(true)
}

// Should have non nullable data and no error fields if throwOnError is added
{
  const result = await postgrest
    .from('users')
    .select('username, messages(id, message)')
    .limit(1)
    .throwOnError()
  const { data } = result
  const { error } = result
  let expected:
    | {
        username: string
        messages: {
          id: number
          message: string | null
        }[]
      }[]
  expectType<TypeEqual<typeof data, typeof expected>>(true)
  expectType<TypeEqual<typeof error, null>>(true)
  error
}

// Should work with throwOnError middle of the chaining
{
  const result = await postgrest
    .from('users')
    .select('username, messages(id, message)')
    .throwOnError()
    .eq('username', 'test')
    .limit(1)
  const { data } = result
  const { error } = result
  let expected:
    | {
        username: string
        messages: {
          id: number
          message: string | null
        }[]
      }[]
  expectType<TypeEqual<typeof data, typeof expected>>(true)
  expectType<TypeEqual<typeof error, null>>(true)
  error
}

// Json Accessor with custom types overrides
{
  const result = await postgrest
    .schema('personal')
    .from('users')
    .select('data->bar->baz, data->en, data->bar')
  if (result.error) {
    throw new Error(result.error.message)
  }
  expectType<
    {
      baz: number
      en: 'ONE' | 'TWO' | 'THREE'
      bar: {
        baz: number
      }
    }[]
  >(result.data)
}
// Json string Accessor with custom types overrides
{
  const result = await postgrest
    .schema('personal')
    .from('users')
    .select('data->bar->>baz, data->>en, data->>bar')
  if (result.error) {
    throw new Error(result.error.message)
  }
  expectType<
    {
      baz: string
      en: 'ONE' | 'TWO' | 'THREE'
      bar: string
    }[]
  >(result.data)
}
