import { expectType } from 'tsd'
import { PostgrestSingleResponse, createClient } from '../../src/index'
import { Database, Json } from '../types'

const URL = 'http://localhost:3000'
const KEY = 'some.fake.key'
const supabase = createClient<Database>(URL, KEY)

// table invalid type
{
  // @ts-expect-error invalid table type
  supabase.from(42)
  // @ts-expect-error table does not exist
  supabase.from('some_table_that_does_not_exist')
}

// `null` can't be used with `.eq()`
{
  supabase.from('users').select().eq('username', 'foo')
  // @ts-expect-error null cannot be used with eq()
  supabase.from('users').select().eq('username', null)

  const nullableVar = 'foo' as string | null
  // @ts-expect-error nullable variable cannot be used with eq()
  supabase.from('users').select().eq('username', nullableVar)
}

// can override result type
{
  const { data, error } = await supabase
    .from('users')
    .select('*, messages(*)')
    .returns<{ messages: { foo: 'bar' }[] }[]>()
  if (error) {
    throw new Error(error.message)
  }
  expectType<{ foo: 'bar' }[]>(data[0].messages)
}
{
  const { data, error } = await supabase
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
  // @ts-expect-error cannot update non-updatable views
  supabase.from('updatable_view').update({ non_updatable_column: 0 })
}

// cannot update non-updatable columns
{
  // @ts-expect-error cannot update non-updatable columns
  supabase.from('updatable_view').update({ non_updatable_column: 0 })
}

// json accessor in select query
{
  const { data, error } = await supabase
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
  const { data, error } = await supabase.rpc('get_status')
  if (error) {
    throw new Error(error.message)
  }
  expectType<'ONLINE' | 'OFFLINE'>(data)
}

// many-to-one relationship
{
  const { data: message, error } = await supabase.from('messages').select('user:users(*)').single()
  if (error) {
    throw new Error(error.message)
  }
  expectType<Database['public']['Tables']['users']['Row']>(message.user)
}

// one-to-many relationship
{
  const { data: user, error } = await supabase.from('users').select('messages(*)').single()
  if (error) {
    throw new Error(error.message)
  }
  expectType<Database['public']['Tables']['messages']['Row'][]>(user.messages)
}

// referencing missing column
{
  type SelectQueryError<Message extends string> = { error: true } & Message

  const res = await supabase.from('users').select('username, dat')
  expectType<
    PostgrestSingleResponse<SelectQueryError<"column 'dat' does not exist on 'users'.">[]>
  >(res)
}

// one-to-one relationship
{
  const { data: channels, error } = await supabase
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

// throwOnError in chaining
{
  const { data: channels, error } = await supabase
    .from('channels')
    .select('channel_details(*)')
    .throwOnError()
  expectType<typeof error>(null)
  expectType<
    {
      channel_details: {
        details: string | null
        id: number
      } | null
    }[]
  >(channels)
}
// Test Postgrest13
// should be able to declare specific PostgrestVersion
{
  // @ts-expect-error should raise error if provinding invalid version
  createClient<Database, { PostgrestVersion: 42 }>('HTTP://localhost:3000', KEY)
}
//  should be able to infer PostgrestVersion from Database __InternalSupabase
{
  type DatabaseWithInternals = {
    __InternalSupabase: {
      PostgrestVersion: '13'
    }
    public: {
      Tables: {
        shops: {
          Row: {
            address: string | null
            id: number
            shop_geom: unknown | null
          }
          Insert: {
            address?: string | null
            id: number
            shop_geom?: unknown | null
          }
          Update: {
            address?: string | null
            id?: number
            shop_geom?: unknown | null
          }
          Relationships: []
        }
      }
      Views: {
        [_ in never]: never
      }
      Functions: {
        [_ in never]: never
      }
      Enums: {
        [_ in never]: never
      }
      CompositeTypes: {
        [_ in never]: never
      }
    }
  }
  // Note: The template argument properties (PostgrestVersion) will not be autocompleted
  // due to a Typescript bug tracked here: https://github.com/microsoft/TypeScript/issues/56299
  const pg13Client = createClient<DatabaseWithInternals>('HTTP://localhost:3000', KEY)
  const pg12Client = createClient<Database>('HTTP://localhost:3000', KEY)
  const res13 = await pg13Client.from('shops').update({ id: 21 }).maxAffected(1)
  const res12 = await pg12Client.from('shops').update({ id: 21 }).maxAffected(1)
  expectType<typeof res13.data>(null)
  expectType<typeof res12.Error>('maxAffected method only available on postgrest 13+')
}
