import { expectError, expectType } from 'tsd'
import { PostgrestClient, PostgrestSingleResponse } from '../src/index'
import { SelectQueryError } from '../src/select-query-parser'
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

// embedded resource with no fields
{
  const { data, error } = await postgrest.from('messages').select('message, users()').single()
  if (error) {
    throw new Error(error.message)
  }
  expectType<{ message: string | null }>(data)
}

// `count` in embedded resource
{
  const { data, error } = await postgrest.from('messages').select('message, users(count)').single()
  if (error) {
    throw new Error(error.message)
  }
  expectType<{ message: string | null; users: { count: number } | null }>(data)
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

// typecasting and aggregate functions
{
  const { data, error } = await postgrest
    .from('messages')
    .select(
      'message, users.count(), casted_message:message::int4, casted_count:users.count()::text'
    )
    .single()
  if (error) {
    throw new Error(error.message)
  }
  expectType<{
    message: string | null
    count: number
    casted_message: number
    casted_count: string
  }>(data)
}

// rpc return type
{
  const { data, error } = await postgrest.rpc('get_status')
  if (error) {
    throw new Error(error.message)
  }
  expectType<'ONLINE' | 'OFFLINE'>(data)
}

// many-to-one relationship
{
  const { data: message, error } = await postgrest.from('messages').select('user:users(*)').single()
  if (error) {
    throw new Error(error.message)
  }
  expectType<Database['public']['Tables']['users']['Row'] | null>(message.user)
}

// !inner relationship
{
  const { data: message, error } = await postgrest
    .from('messages')
    .select('channels!inner(*, channel_details!inner(*))')
    .single()
  if (error) {
    throw new Error(error.message)
  }
  type ExpectedType = Prettify<
    Database['public']['Tables']['channels']['Row'] & {
      channel_details: Database['public']['Tables']['channel_details']['Row']
    }
  >

  expectType<ExpectedType>(message.channels)
}

// one-to-many relationship
{
  const { data: user, error } = await postgrest.from('users').select('messages(*)').single()
  if (error) {
    throw new Error(error.message)
  }
  expectType<Database['public']['Tables']['messages']['Row'][]>(user.messages)
}

// referencing missing column
{
  const res = await postgrest.from('users').select('username, dat')
  expectType<PostgrestSingleResponse<SelectQueryError<`Referencing missing column \`dat\``>[]>>(res)
}

// one-to-one relationship
{
  const { data: channels, error } = await postgrest
    .from('channels')
    .select('channel_details(*)')
    .single()
  if (error) {
    throw new Error(error.message)
  }
  expectType<Database['public']['Tables']['channel_details']['Row'] | null>(
    channels.channel_details
  )
}

// PostgrestBuilder's children retains class when using inherited methods
{
  const x = postgrest.from('channels').select()
  const y = x.throwOnError()
  const z = x.setHeader('', '')
  expectType<typeof x>(y)
  expectType<typeof x>(z)
}

// !left oneToOne
{
  const { data: oneToOne, error } = await postgrest
    .from('channel_details')
    .select('channels!left(*)')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // TODO: this should never be nullable
  expectType<Database['public']['Tables']['channels']['Row'] | null>(oneToOne.channels)
}

// !left oneToMany
{
  const { data: oneToMany, error } = await postgrest
    .from('users')
    .select('messages!left(*)')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  expectType<Array<Database['public']['Tables']['messages']['Row']>>(oneToMany.messages)
}

// !left zeroToOne
{
  const { data: zeroToOne, error } = await postgrest
    .from('user_profiles')
    .select('users!left(*)')
    .single()

  if (error) {
    throw new Error(error.message)
  }

  expectType<Database['public']['Tables']['users']['Row'] | null>(zeroToOne.users)
}

// join over a 1-1 relation with both nullables and non-nullables fields
{
  const { data: bestFriends, error } = await postgrest
    .from('best_friends')
    .select(
      'first_user:users!best_friends_first_user_fkey(*), second_user:users!best_friends_second_user_fkey(*), third_wheel:users!best_friends_third_wheel_fkey(*)'
    )
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // TODO: Those two fields shouldn't be nullables
  expectType<Database['public']['Tables']['users']['Row'] | null>(bestFriends.first_user)
  expectType<Database['public']['Tables']['users']['Row'] | null>(bestFriends.second_user)
  // The third wheel should be nullable
  expectType<Database['public']['Tables']['users']['Row'] | null>(bestFriends.third_wheel)
}
// join over a 1-M relation with both nullables and non-nullables fields
{
  const { data: users, error } = await postgrest
    .from('users')
    .select(
      `first_friend_of:best_friends_first_user_fkey(*),
      second_friend_of:best_friends_second_user_fkey(*),
      third_wheel_of:best_friends_third_wheel_fkey(*)`
    )
    .single()

  if (error) {
    throw new Error(error.message)
  }
  // TODO: type properly the result for this kind of queries
  expectType<Array<{}>>(users.first_friend_of)
}
