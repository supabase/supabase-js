import { expectError, expectType } from 'tsd'
import { PostgrestSingleResponse, SupabaseClient, createClient } from '../../src/index'
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
  expectError(supabase.from('updatable_view').update({ non_updatable_column: 0 }))
}

// cannot update non-updatable columns
{
  expectError(supabase.from('updatable_view').update({ non_updatable_column: 0 }))
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
  const { data, error } = await supabase.rpc('get_status', { name_param: 'supabot' })
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
  // @ts-expect-error should raise error if providing __InternalSupabase as schema name
  createClient<DatabaseWithInternals, '__InternalSupabase'>('HTTP://localhost:3000', KEY)
  // @ts-expect-error should raise error if providing __InternalSupabase as schema name
  new SupabaseClient<DatabaseWithInternals, '__InternalSupabase'>('HTTP://localhost:3000', KEY)
  const pg12Client = createClient<Database>('HTTP://localhost:3000', KEY)
  const res13 = await pg13Client.from('shops').update({ id: 21 }).maxAffected(1)
  const res12 = await pg12Client.from('shops').update({ id: 21 }).maxAffected(1)
  const pg13ClientNew = new SupabaseClient<DatabaseWithInternals>('HTTP://localhost:3000', KEY)
  const res13New = await pg13ClientNew.from('shops').update({ id: 21 }).maxAffected(1)
  expectType<typeof res13.data>(null)
  expectType<typeof res13New.data>(null)
  expectType<typeof res12.Error>('maxAffected method only available on postgrest 13+')
  // Explicitly set PostgrestVersion should override the inferred __InternalSupabase schema version
  const internal13Set12 = new SupabaseClient<DatabaseWithInternals, { PostgrestVersion: '12' }>(
    URL,
    KEY
  )
  const resinternal13Set12 = await internal13Set12.from('shops').update({ id: 21 }).maxAffected(1)
  // The explicitly set PostgrestVersion should override the inferred __InternalSupabase schema version
  expectType<typeof resinternal13Set12.Error>('maxAffected method only available on postgrest 13+')
}

// createClient with custom schema
{
  const pg12CustomSchemaClient = createClient<Database, 'personal'>(URL, KEY, {
    db: { schema: 'personal' },
  })
  const pg12CustomSchemaNewClient = new SupabaseClient<Database, 'personal'>(URL, KEY, {
    db: { schema: 'personal' },
  })
  const res12new = await pg12CustomSchemaNewClient
    .from('users')
    .update({ username: 'test' })
    .maxAffected(1)
  const res12 = await pg12CustomSchemaClient
    .from('users')
    .update({ username: 'test' })
    .maxAffected(1)
  expectType<typeof res12.Error>('maxAffected method only available on postgrest 13+')
  expectType<typeof res12new.Error>('maxAffected method only available on postgrest 13+')
  // @ts-expect-error should raise error if providing table name not in the schema
  pg12CustomSchemaClient.from('channels_details')
  // @ts-expect-error should raise error if providing table name not in the schema
  pg12CustomSchemaNewClient.from('channels_details')
}

// createClient with custom schema and PostgrestVersion explicitly set
{
  const pg13CustomSchemaClient = createClient<Database, { PostgrestVersion: '13' }, 'personal'>(
    URL,
    KEY,
    {
      db: { schema: 'personal' },
    }
  )
  const pg12CustomSchemaNewClient = new SupabaseClient<
    Database,
    { PostgrestVersion: '12' },
    'personal'
  >(URL, KEY, {
    db: { schema: 'personal' },
  })
  const res12new = await pg12CustomSchemaNewClient
    .from('users')
    .update({ username: 'test' })
    .maxAffected(1)
  const res13 = await pg13CustomSchemaClient
    .from('users')
    .update({ username: 'test' })
    .maxAffected(1)
  expectType<typeof res13.data>(null)
  expectType<typeof res12new.Error>('maxAffected method only available on postgrest 13+')
  // @ts-expect-error should raise error if providing table name not in the schema
  pg12CustomSchemaClient.from('channels_details')
  // @ts-expect-error should raise error if providing table name not in the schema
  pg13CustomSchemaClient.from('channels_details')
}
