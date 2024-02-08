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

// many-to-one relationship
{
  const { data: message, error } = await postgrest.from('messages').select('user:users(*)').single()
  if (error) {
    throw new Error(error.message)
  }
  expectType<Database['public']['Tables']['users']['Row'] | null>(message.user)
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
