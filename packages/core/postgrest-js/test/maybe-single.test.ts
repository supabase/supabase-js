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

  test.each([
    'The result contains 0 rows',
    'Results contain 0 rows, application/vnd.pgrst.object+json requires 1 row',
  ])('accepts a zero-row singular response: %s', async (details) => {
    const fetchMock = jest.fn().mockResolvedValue({
      ...okJson({
        code: 'PGRST116',
        details,
        hint: null,
        message: 'Cannot coerce the result to a single JSON object',
      }),
      ok: false,
      status: 406,
      statusText: 'Not Acceptable',
    })
    const postgrest = new PostgrestClient<Database>(REST_URL, { fetch: fetchMock })

    const result = await postgrest.from('users').delete().select().maybeSingle().throwOnError()

    expect(result).toEqual({
      data: null,
      error: null,
      count: null,
      status: 200,
      statusText: 'OK',
      success: true,
    })
  })

  test.each([1, 10])('preserves a singular response error for %s rows', async (rows) => {
    const error = {
      code: 'PGRST116',
      details: `The result contains ${rows} rows`,
      hint: null,
      message: 'Cannot coerce the result to a single JSON object',
    }
    const fetchMock = jest.fn().mockResolvedValue({
      ...okJson(error),
      ok: false,
      status: 406,
      statusText: 'Not Acceptable',
    })
    const postgrest = new PostgrestClient<Database>(REST_URL, { fetch: fetchMock })

    expect(await postgrest.from('users').delete().select().maybeSingle()).toMatchObject({
      error,
      status: 406,
    })
  })
})

describe('maybeSingle RPC responses', () => {
  test.each([false, true])(
    'accepts empty results without requesting singular rollback (throwOnError: %s)',
    async (throwOnError) => {
      const fetchMock = jest.fn().mockResolvedValue(okJson([]))
      const client = new PostgrestClient(REST_URL, { fetch: fetchMock })
      const query = client.rpc('write_without_returning_rows').maybeSingle()
      expect(await (throwOnError ? query.throwOnError() : query)).toMatchObject({
        data: null,
        error: null,
        status: 200,
      })
      expect(new Headers(fetchMock.mock.calls[0][1].headers).get('Accept')).not.toBe(
        'application/vnd.pgrst.object+json'
      )
    }
  )

  test('does not suppress an RPC cardinality error with throwOnError', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ...okJson({
        code: 'PGRST116',
        details: 'The result contains 0 rows',
        hint: null,
        message: 'Cannot coerce the result to a single JSON object',
      }),
      ok: false,
      status: 406,
      statusText: 'Not Acceptable',
    })
    const client = new PostgrestClient(REST_URL, { fetch: fetchMock })
    await expect(
      client.rpc('write_without_returning_rows').maybeSingle().throwOnError()
    ).rejects.toMatchObject({ code: 'PGRST116' })
  })
})
