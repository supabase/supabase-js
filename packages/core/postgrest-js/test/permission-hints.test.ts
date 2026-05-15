import { PostgrestClient } from '../src/index'
import { Database } from './types.override'

// Simulates the JSON body PostgREST returns when supautils injects a hint
// for a 42501 (permission denied) error at the PostgreSQL executor level.
// See: https://github.com/supabase/supautils (enhanced hints feature)
const SUPAUTILS_42501_BODY = {
  code: '42501',
  message: 'permission denied for table users',
  details: null,
  hint: 'GRANT SELECT ON public.users TO anon;',
}

function mockFetch(body: object, status: number) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: 'Forbidden',
    headers: new Headers(),
    text: async () => JSON.stringify(body),
  })
}

describe('postgres hint passthrough', () => {
  test('hint from supautils is passed through to error', async () => {
    const postgrest = new PostgrestClient<Database>('https://example.com', {
      fetch: mockFetch(SUPAUTILS_42501_BODY, 403) as any,
    })

    const { error } = await postgrest.from('users').select()

    expect(error).toMatchInlineSnapshot(`
      {
        "code": "42501",
        "details": null,
        "hint": "GRANT SELECT ON public.users TO anon;",
        "message": "permission denied for table users",
      }
    `)
  })

  test('hint is included on thrown PostgrestError', async () => {
    const postgrest = new PostgrestClient<Database>('https://example.com', {
      fetch: mockFetch(SUPAUTILS_42501_BODY, 403) as any,
    })

    await expect(postgrest.from('users').select().throwOnError()).rejects.toMatchObject({
      hint: 'GRANT SELECT ON public.users TO anon;',
    })
  })

  test('null hint is passed through unchanged (supautils not active for this role)', async () => {
    const postgrest = new PostgrestClient<Database>('https://example.com', {
      fetch: mockFetch({ ...SUPAUTILS_42501_BODY, hint: null }, 403) as any,
    })

    const { error } = await postgrest.from('users').select()

    expect(error?.hint).toBeNull()
  })
})
