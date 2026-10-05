import { PostgrestClient } from '../src/index'
import PostgrestError from '../src/PostgrestError'
import { Database } from './types.override'

const REST_URL = 'https://example.com'

const okJson = (payload: unknown) => ({
  ok: true,
  status: 200,
  statusText: 'OK',
  text: () => Promise.resolve(JSON.stringify(payload)),
  headers: new Headers(),
})

describe('maybeSingle cardinality handling', () => {
  test('unwraps a single row', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okJson([{ username: 'supabot' }]))
    const postgrest = new PostgrestClient<Database>(REST_URL, { fetch: fetchMock as any })

    const res = await postgrest.from('users').select('username').maybeSingle()

    expect(res.error).toBeNull()
    expect(res.data).toEqual({ username: 'supabot' })
    expect(res.status).toBe(200)
  })

  test('returns null data when no rows match', async () => {
    const fetchMock = jest.fn().mockResolvedValue(okJson([]))
    const postgrest = new PostgrestClient<Database>(REST_URL, { fetch: fetchMock as any })

    const res = await postgrest.from('users').select('username').maybeSingle()

    expect(res.error).toBeNull()
    expect(res.data).toBeNull()
  })

  test('returns a PGRST116 error when multiple rows are returned', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(okJson([{ username: 'supabot' }, { username: 'kiwicopple' }]))
    const postgrest = new PostgrestClient<Database>(REST_URL, { fetch: fetchMock as any })

    const res = await postgrest.from('users').select('username').maybeSingle()

    expect(res.data).toBeNull()
    expect(res.status).toBe(406)
    expect(res.statusText).toBe('Not Acceptable')
    expect(res.error?.code).toBe('PGRST116')
  })

  test('honours throwOnError() when multiple rows are returned', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(okJson([{ username: 'supabot' }, { username: 'kiwicopple' }]))
    const postgrest = new PostgrestClient<Database>(REST_URL, { fetch: fetchMock as any })

    await expect(
      postgrest.from('users').select('username').maybeSingle().throwOnError()
    ).rejects.toThrow(PostgrestError)
  })
})
