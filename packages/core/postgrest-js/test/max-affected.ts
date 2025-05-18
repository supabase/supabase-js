import { PostgrestClient } from '../src/index'
import { Database } from './types.override'
import { expectType } from 'tsd'
import { InvalidMethodError } from '../src/PostgrestFilterBuilder'

const REST_URL_13 = 'http://localhost:3001'
const postgrest13 = new PostgrestClient<Database>(REST_URL_13)

describe('maxAffected', () => {
  // Type checking tests
  test('maxAffected should show warning on non update / delete', async () => {
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

  // Runtime behavior tests
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
    expect(error?.message).toBe('Query result exceeds max-affected preference constraint')
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
    expect(error?.message).toBe('Query result exceeds max-affected preference constraint')
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
})
