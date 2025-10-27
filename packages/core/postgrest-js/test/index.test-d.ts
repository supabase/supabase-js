import { expectType, TypeEqual } from './types'
import { PostgrestClient, PostgrestError } from '../src/index'
import { Prettify } from '../src/types/types'
import { Json } from '../src/select-query-parser/types'
import { Database } from './types.override'
import { Database as DatabaseWithOptions } from './types.override-with-options-postgrest14'

const REST_URL = 'http://localhost:3000'
const postgrest = new PostgrestClient<Database>(REST_URL)
const postgrestWithOptions = new PostgrestClient<DatabaseWithOptions>(REST_URL)

// table invalid type
{
  // @ts-expect-error Argument of type '42' is not assignable to parameter of type
  postgrest.from(42)
  // @ts-expect-error Argument of type '"nonexistent_table"' is not assignable to parameter of type
  postgrest.from('nonexistent_table')
}

// `null` can't be used with `.eq()`
{
  postgrest.from('users').select().eq('username', 'foo')
  // @ts-expect-error  Argument of type 'null' is not assignable to parameter of type 'string'
  postgrest.from('users').select().eq('username', null)

  const nullableVar = 'foo' as string | null
  // @ts-expect-error Argument of type 'string | null' is not assignable to parameter of type 'string'
  postgrest.from('users').select().eq('username', nullableVar)
}

// `.eq()`, '.neq()' and `.in()` validate provided filter value when column is an enum.
// Behaves the same for simple columns, as well as relationship filters.
{
  // @ts-expect-error Argument of type '"invalid"' is not assignable to parameter
  postgrest.from('users').select().eq('status', 'invalid')
  // @ts-expect-error Argument of type '"invalid"' is not assignable to parameter of type '"ONLINE" | "OFFLINE" | null'
  postgrest.from('users').select().neq('status', 'invalid')
  // @ts-expect-error Type '"invalid"' is not assignable to type '"ONLINE" | "OFFLINE" | null'
  postgrest.from('users').select().in('status', ['invalid'])

  // @ts-expect-error Argument of type '"invalid"' is not assignable to parameter
  postgrest.from('best_friends').select('users!first_user(status)').eq('users.status', 'invalid')
  // @ts-expect-error Argument of type '"invalid"' is not assignable to parameter of type '"ONLINE" | "OFFLINE" | null'
  postgrest.from('best_friends').select('users!first_user(status)').neq('users.status', 'invalid')
  postgrest
    .from('best_friends')
    .select('users!first_user(status)')
    // @ts-expect-error Type '"invalid"' is not assignable to type '"ONLINE" | "OFFLINE" | null'
    .in('users.status', ['invalid'])

  // Validate deeply nested embedded tables
  // @ts-expect-error Argument of type 'string' is not assignable to parameter of type 'number'
  postgrest.from('users').select('messages(channels(*))').eq('messages.channels.id', 'invalid')
  // @ts-expect-error Argument of type 'string' is not assignable to parameter of type 'number'
  postgrest.from('users').select('messages(channels(*))').neq('messages.channels.id', 'invalid')
  // @ts-expect-error Type 'string' is not assignable to type 'number'
  postgrest.from('users').select('messages(channels(*))').in('messages.channels.id', ['invalid'])

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
  // @ts-expect-error Type 'number' is not assignable to type 'undefined'
  postgrest.from('updatable_view').update({ non_updatable_column: 0 })
}

// cannot update non-updatable columns
{
  // @ts-expect-error Type 'number' is not assignable to type 'undefined'
  postgrest.from('updatable_view').update({ non_updatable_column: 0 })
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
  expectType<Json>(result.data.bar)
  expectType<string>(result.data.baz)
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
  let expected: {
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
  let expected: {
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
    TypeEqual<
      typeof result.data,
      {
        baz: number
        en: 'ONE' | 'TWO' | 'THREE'
        bar: {
          baz: number
        }
      }[]
    >
  >(true)
}

// Check that client options __InternalSupabase isn't considered like the other schemas
{
  await postgrestWithOptions
    // @ts-expect-error Argument of type '"__InternalSupabase"' is not assignable to parameter of type '"personal" | "public"'
    .schema('__InternalSupabase')
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
