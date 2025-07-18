import { PostgrestClient } from '../src/index'
import { Database } from './types.override'
import { Database as DatabasePostgrest13 } from './types.override-with-options-postgrest13'
import { expectType } from 'tsd'
import { InvalidMethodError } from '../src/PostgrestFilterBuilder'
import { Json } from './types.generated'

const REST_URL_13 = 'http://localhost:3001'
const postgrest13 = new PostgrestClient<DatabasePostgrest13>(REST_URL_13)
const postgrest12 = new PostgrestClient<Database>(REST_URL_13)

describe('maxAffected', () => {
  test('types: maxAffected should show type warning on postgrest 12 clients', async () => {
    const resUpdate = await postgrest12
      .from('messages')
      .update({ channel_id: 2 })
      .eq('message', 'foo')
      .maxAffected(1)
    expectType<InvalidMethodError<'maxAffected method only available on postgrest 13+'>>(resUpdate)
  })
  test('types: maxAffected should show type warning on non update / delete', async () => {
    const resSelect = await postgrest13.from('messages').select('*').maxAffected(10)
    const resInsert = await postgrest13
      .from('messages')
      .insert({ message: 'foo', username: 'supabot', channel_id: 1 })
      .maxAffected(10)
    const resUpsert = await postgrest13
      .from('messages')
      .upsert({ id: 3, message: 'foo', username: 'supabot', channel_id: 2 })
      .maxAffected(10)
    const resUpdate = await postgrest13
      .from('messages')
      .update({ channel_id: 2 })
      .eq('message', 'foo')
      .maxAffected(1)
      .select()
    const resDelete = await postgrest13
      .from('messages')
      .delete()
      .eq('message', 'foo')
      .maxAffected(1)
      .select()
    expectType<InvalidMethodError<'maxAffected method only available on update or delete'>>(
      resSelect
    )
    expectType<InvalidMethodError<'maxAffected method only available on update or delete'>>(
      resInsert
    )
    expectType<InvalidMethodError<'maxAffected method only available on update or delete'>>(
      resUpsert
    )
    expectType<InvalidMethodError<'maxAffected method only available on update or delete'>>(
      // @ts-expect-error update method shouldn't return an error
      resUpdate
    )
    expectType<InvalidMethodError<'maxAffected method only available on update or delete'>>(
      // @ts-expect-error delete method shouldn't return an error
      resDelete
    )
  })

  test('update should fail when maxAffected is exceeded', async () => {
    // First create multiple rows
    await postgrest13.from('messages').insert([
      { message: 'test1', username: 'supabot', channel_id: 1 },
      { message: 'test1', username: 'supabot', channel_id: 1 },
      { message: 'test1', username: 'supabot', channel_id: 1 },
    ])

    // Try to update all rows with maxAffected=2
    const result = await postgrest13
      .from('messages')
      .update({ message: 'updated' })
      .eq('message', 'test1')
      .maxAffected(2)

    const { error } = result
    expect(error).toBeDefined()
    expect(error?.code).toBe('PGRST124')
  })

  test('update should succeed when within maxAffected limit', async () => {
    // First create a single row
    await postgrest13
      .from('messages')
      .insert([{ message: 'test2', username: 'supabot', channel_id: 1 }])

    // Try to update with maxAffected=2
    const { data, error } = await postgrest13
      .from('messages')
      .update({ message: 'updated' })
      .eq('message', 'test2')
      .maxAffected(2)
      .select()
    expectType<
      | {
          channel_id: number
          data: Json | null
          id: number
          message: string | null
          username: string
        }[]
      | null
    >(data)
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0].message).toBe('updated')
  })

  test('delete should fail when maxAffected is exceeded', async () => {
    // First create multiple rows
    await postgrest13.from('messages').insert([
      { message: 'test3', username: 'supabot', channel_id: 1 },
      { message: 'test3', username: 'supabot', channel_id: 1 },
      { message: 'test3', username: 'supabot', channel_id: 1 },
    ])

    // Try to delete all rows with maxAffected=2
    const { error } = await postgrest13
      .from('messages')
      .delete()
      .eq('message', 'test3')
      .maxAffected(2)
      .select()
    expect(error).toBeDefined()
    expect(error?.code).toBe('PGRST124')
  })

  test('delete should succeed when within maxAffected limit', async () => {
    // First create a single row
    await postgrest13
      .from('messages')
      .insert([{ message: 'test4', username: 'supabot', channel_id: 1 }])

    // Try to delete with maxAffected=2
    const { data, error } = await postgrest13
      .from('messages')
      .delete()
      .eq('message', 'test4')
      .maxAffected(2)
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0].message).toBe('test4')
  })

  test('should be able to use .maxAffected with setof records returning rpc', async () => {
    // First create a user that will be returned by the RPC
    await postgrest13.from('users').insert([{ username: 'testuser', status: 'ONLINE' }])
    // Call the RPC function that returns a set of records
    const { data, error } = await postgrest13
      .rpc('set_users_offline', { name_param: 'testuser' })
      .maxAffected(1)
      .select()

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data).toEqual([
      {
        username: 'testuser',
        data: null,
        age_range: null,
        status: 'OFFLINE',
        catchphrase: null,
      },
    ])
  })

  test('should fail when rpc returns more results than maxAffected', async () => {
    // First create multiple users that will be returned by the RPC
    await postgrest13.from('users').insert([
      { username: 'testuser1', status: 'ONLINE' },
      { username: 'testuser2', status: 'ONLINE' },
      { username: 'testuser3', status: 'ONLINE' },
    ])

    // Call the RPC function that returns a set of records
    const { data, error } = await postgrest13
      .rpc('set_users_offline', { name_param: 'testuser%' })
      .maxAffected(1)
      .select()

    expect(error).toBeDefined()
    expect(error?.code).toBe('PGRST124')
    expect(data).toBeNull()
  })
})
