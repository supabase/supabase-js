import { PostgrestClient } from '../src/index'
import { Database } from './types.override'

const REST_URL = 'https://example.com'

// Status codes and Content-Range values as sent by PostgREST for `Prefer: count=planned`
const respond = (status: number, contentRange: string) => ({
  ok: true,
  status,
  statusText: status === 201 ? 'Created' : status === 204 ? 'No Content' : 'OK',
  text: () => Promise.resolve(status === 204 ? '' : '[]'),
  headers: new Headers({ 'content-range': contentRange }),
})

describe('count when the total is unknown', () => {
  const client = (status: number, contentRange: string) =>
    new PostgrestClient<Database>(REST_URL, {
      fetch: jest.fn().mockResolvedValue(respond(status, contentRange)) as any,
    })

  test.each([
    [
      'insert',
      201,
      '*/*',
      (p: PostgrestClient<Database>) =>
        p.from('users').insert({ username: 'supabot' }, { count: 'planned' }),
    ],
    [
      'update',
      204,
      '0-0/*',
      (p: PostgrestClient<Database>) =>
        p
          .from('users')
          .update({ status: 'ONLINE' }, { count: 'planned' })
          .eq('username', 'supabot'),
    ],
    [
      'delete',
      204,
      '*/*',
      (p: PostgrestClient<Database>) =>
        p.from('users').delete({ count: 'planned' }).eq('username', 'supabot'),
    ],
  ])('%s with count: planned returns a null count', async (_, status, contentRange, call) => {
    const res = await call(client(status, contentRange))

    expect(res.error).toBeNull()
    expect(res.count).toBeNull()
  })

  test('a numeric total is still parsed', async () => {
    const res = await client(200, '0-0/42').from('users').select('*', { count: 'exact' })

    expect(res.count).toBe(42)
  })
})
