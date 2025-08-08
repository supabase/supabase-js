import { expect, test } from 'tstyche'
import { PostgrestSingleResponse, createClient } from '../../src/index'
import { Database, Json } from '../types'

const URL = 'http://localhost:3000'
const KEY = 'some.fake.key'
const supabase = createClient<Database>(URL, KEY)

test('table invalid type', async () => {
  expect(supabase.from).type.not.toBeCallableWith(42)
  expect(supabase.from).type.not.toBeCallableWith('some_table_that_does_not_exist')
})

test('`null` cannot be used with `.eq()`', async () => {
  expect(supabase.from('users').select().eq).type.toBeCallableWith('username', 'foo')
  expect(supabase.from('users').select().eq).type.not.toBeCallableWith('username', null)

  const nullableVar = 'foo' as string | null
  expect(supabase.from('users').select().eq).type.not.toBeCallableWith('username', nullableVar)
})

test('can override result type', async () => {
  const { data, error } = await supabase
    .from('users')
    .select('*, messages(*)')
    .returns<{ messages: { foo: 'bar' }[] }[]>()
  if (error) {
    throw new Error(error.message)
  }
  expect(data[0].messages).type.toBe<{ foo: 'bar' }[]>()
})
test('can override result type', async () => {
  const { data, error } = await supabase
    .from('users')
    .insert({ username: 'foo' })
    .select('*, messages(*)')
    .returns<{ messages: { foo: 'bar' }[] }[]>()
  if (error) {
    throw new Error(error.message)
  }
  expect(data[0].messages).type.toBe<{ foo: 'bar' }[]>()
})

test('cannot update non-updatable views', async () => {
  expect(supabase.from('updatable_view').update).type.not.toBeCallableWith({
    non_updatable_column: 0,
  })
})

test('cannot update non-updatable columns', async () => {
  expect(supabase.from('updatable_view').update).type.not.toBeCallableWith({
    non_updatable_column: 0,
  })
})

test('json accessor in select query', async () => {
  const { data, error } = await supabase
    .from('users')
    .select('data->foo->bar, data->foo->>baz')
    .single()
  if (error) {
    throw new Error(error.message)
  }
  expect(data.bar).type.toBe<Json>()
  expect(data.baz).type.toBe<string>()
})

test('rpc return type', async () => {
  const { data, error } = await supabase.rpc('get_status')
  if (error) {
    throw new Error(error.message)
  }
  expect(data).type.toBe<'ONLINE' | 'OFFLINE'>()
})

test('many-to-one relationship', async () => {
  const { data: message, error } = await supabase.from('messages').select('user:users(*)').single()
  if (error) {
    throw new Error(error.message)
  }
  expect(message.user).type.toBe<Database['public']['Tables']['users']['Row']>()
})

test('one-to-many relationship', async () => {
  const { data: user, error } = await supabase.from('users').select('messages(*)').single()
  if (error) {
    throw new Error(error.message)
  }
  expect(user.messages).type.toBe<Database['public']['Tables']['messages']['Row'][]>()
})

test('referencing missing column', async () => {
  type SelectQueryError<Message extends string> = { error: true } & Message

  const res = await supabase.from('users').select('username, dat')
  expect(res).type.toBe<
    PostgrestSingleResponse<SelectQueryError<"column 'dat' does not exist on 'users'.">[]>
  >()
})

test('one-to-one relationship', async () => {
  const { data: channels, error } = await supabase
    .from('channels')
    .select('channel_details(*)')
    .single()
  if (error) {
    throw new Error(error.message)
  }
  expect(channels.channel_details).type.toBe<
    Database['public']['Tables']['channel_details']['Row'] | null
  >()
})

test('throwOnError in chaining', async () => {
  const { data: channels, error } = await supabase
    .from('channels')
    .select('channel_details(*)')
    .throwOnError()
  expect(error).type.toBe<null>()
  expect(channels).type.toBe<{ channel_details: { details: string | null; id: number } | null }[]>()
})
