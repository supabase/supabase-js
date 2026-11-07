import { PostgrestClient } from '../src/index'
import { Database } from './types.override'

const postgrest = new PostgrestClient<Database>('http://localhost:54321/rest/v1')

describe.each(['update', 'delete'] as const)('maybeSingle after %s', (method) => {
  const usernames = [`maybe-single-${method}-a`, `maybe-single-${method}-b`]

  beforeEach(async () => {
    await postgrest
      .from('users')
      .insert(usernames.map((username) => ({ username, status: 'ONLINE' as const })))
      .throwOnError()
  })

  afterEach(async () => {
    await postgrest.from('users').delete().in('username', usernames).throwOnError()
  })

  const mutation = () =>
    method === 'update'
      ? postgrest.from('users').update({ status: 'OFFLINE' })
      : postgrest.from('users').delete()

  test.each([false, true])('rolls back multiple rows (throwOnError: %s)', async (throwOnError) => {
    const query = mutation().in('username', usernames).select().maybeSingle()

    if (throwOnError) {
      await expect(query.throwOnError()).rejects.toMatchObject({ code: 'PGRST116' })
    } else {
      expect(await query).toMatchObject({
        data: null,
        error: { code: 'PGRST116' },
        status: 406,
      })
    }

    const { data } = await postgrest
      .from('users')
      .select('username,status')
      .in('username', usernames)
      .order('username')
      .throwOnError()

    expect(data).toEqual(usernames.map((username) => ({ username, status: 'ONLINE' })))
  })

  test.each([false, true])('accepts zero rows (throwOnError: %s)', async (throwOnError) => {
    const query = mutation().eq('username', `maybe-single-${method}-missing`).select().maybeSingle()
    const result = await (throwOnError ? query.throwOnError() : query)

    expect(result).toMatchObject({ data: null, error: null, status: 200, success: true })
  })

  test('commits a single row and returns an object', async () => {
    const { data } = await mutation()
      .eq('username', usernames[0])
      .select()
      .maybeSingle()
      .throwOnError()

    expect(data).toMatchObject({
      username: usernames[0],
      status: method === 'update' ? 'OFFLINE' : 'ONLINE',
    })
    const { data: remaining } = await postgrest
      .from('users')
      .select('username,status')
      .in('username', usernames)
      .order('username')
      .throwOnError()

    expect(remaining).toEqual(
      method === 'update'
        ? [
            { username: usernames[0], status: 'OFFLINE' },
            { username: usernames[1], status: 'ONLINE' },
          ]
        : [{ username: usernames[1], status: 'ONLINE' }]
    )
  })
})
