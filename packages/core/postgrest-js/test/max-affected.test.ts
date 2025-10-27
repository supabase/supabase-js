import { PostgrestClient } from '../src/index'
import { Database } from './types.override'
import { Database as DatabasePostgrest14 } from './types.override-with-options-postgrest14'
import { expectType, TypeEqual } from './types'
import { InvalidMethodError } from '../src/PostgrestFilterBuilder'
import { z } from 'zod'
import { RequiredDeep } from 'type-fest'

const REST_URL_14 = 'http://localhost:3001'
const postgrest14 = new PostgrestClient<DatabasePostgrest14>(REST_URL_14)
const postgrest12 = new PostgrestClient<Database>(REST_URL_14)

const MessageRowSchema = z.object({
  channel_id: z.number(),
  data: z.unknown().nullable(),
  id: z.number(),
  message: z.string().nullable(),
  username: z.string(),
})

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
    const resSelect = postgrest14.from('messages').select('*').maxAffected(10)
    const resInsert = postgrest14
      .from('messages')
      .insert({ message: 'foo', username: 'supabot', channel_id: 1 })
      .maxAffected(10)
    const resUpsert = postgrest14
      .from('messages')
      .upsert({ id: 3, message: 'foo', username: 'supabot', channel_id: 2 })
      .maxAffected(10)
    const resUpdate = postgrest14
      .from('messages')
      .update({ channel_id: 2 })
      .eq('message', 'foo')
      .maxAffected(1)
      .select()
    const resDelete = postgrest14
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
      // @ts-expect-error InvalidMethodError<"maxAffected method only available on update or delete">
      resUpdate
    )
    expectType<InvalidMethodError<'maxAffected method only available on update or delete'>>(
      // @ts-expect-error InvalidMethodError<"maxAffected method only available on update or delete">
      resDelete
    )
  })

  test('update should fail when maxAffected is exceeded', async () => {
    // First create multiple rows
    await postgrest14.from('messages').insert([
      { message: 'test1', username: 'supabot', channel_id: 1 },
      { message: 'test1', username: 'supabot', channel_id: 1 },
      { message: 'test1', username: 'supabot', channel_id: 1 },
    ])

    // Try to update all rows with maxAffected=2
    const result = await postgrest14
      .from('messages')
      .update({ message: 'updated' })
      .eq('message', 'test1')
      .maxAffected(2)

    const { error } = result
    expect(error).toBeDefined()
    expect(error?.code).toBe('PGRST124')

    // cleanup
    await postgrest14.from('messages').delete().eq('message', 'test1')
  })

  test('update should succeed when within maxAffected limit', async () => {
    // First create a single row
    await postgrest14
      .from('messages')
      .insert([{ message: 'test2', username: 'supabot', channel_id: 1 }])

    // Try to update with maxAffected=2
    const { data, error } = await postgrest14
      .from('messages')
      .update({ message: 'updated' })
      .eq('message', 'test2')
      .maxAffected(2)
      .select()

    let result: Exclude<typeof data, null>
    const ExpectedSchema = z.array(MessageRowSchema)
    let expected: RequiredDeep<z.infer<typeof ExpectedSchema>>
    expectType<TypeEqual<typeof result, typeof expected>>(true)
    ExpectedSchema.parse(data)

    expect(error).toBeNull()
    expect(data).toHaveLength(1)
    expect(data?.[0].message).toBe('updated')

    // cleanup
    await postgrest14.from('messages').delete().eq('message', 'updated')
  })

  test('delete should fail when maxAffected is exceeded', async () => {
    // First create multiple rows
    await postgrest14.from('messages').insert([
      { message: 'test3', username: 'supabot', channel_id: 1 },
      { message: 'test3', username: 'supabot', channel_id: 1 },
      { message: 'test3', username: 'supabot', channel_id: 1 },
    ])

    // Try to delete all rows with maxAffected=2
    const { error } = await postgrest14
      .from('messages')
      .delete()
      .eq('message', 'test3')
      .maxAffected(2)
      .select()
    expect(error).toBeDefined()
    expect(error?.code).toBe('PGRST124')

    // cleanup
    await postgrest14.from('messages').delete().eq('message', 'test3')
  })

  test('delete should succeed when within maxAffected limit', async () => {
    // First create a single row
    await postgrest14
      .from('messages')
      .insert([{ message: 'test4', username: 'supabot', channel_id: 1 }])

    // Try to delete with maxAffected=2
    const { data, error } = await postgrest14
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
    await postgrest14.from('users').insert([{ username: 'testuser', status: 'ONLINE' }])
    // Call the RPC function that returns a set of records
    const { data, error } = await postgrest14
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

    // cleanup
    await postgrest14.from('users').delete().eq('username', 'testuser')
  })

  test('should fail when rpc returns more results than maxAffected', async () => {
    // First create multiple users that will be returned by the RPC
    await postgrest14.from('users').insert([
      { username: 'testuser1', status: 'ONLINE' },
      { username: 'testuser2', status: 'ONLINE' },
      { username: 'testuser3', status: 'ONLINE' },
    ])

    // Call the RPC function that returns a set of records
    const { data, error } = await postgrest14
      .rpc('set_users_offline', { name_param: 'testuser%' })
      .maxAffected(1)
      .select()

    expect(error).toBeDefined()
    expect(error?.code).toBe('PGRST124')
    expect(data).toBeNull()

    // cleanup
    await postgrest14.from('users').delete().in('username', ['testuser1', 'testuser2', 'testuser3'])
  })
})
