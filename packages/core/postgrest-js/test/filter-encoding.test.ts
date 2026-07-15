import { PostgrestClient } from '../src/index'
import { Database } from './types.override'

const REST_URL = 'http://localhost:54321/rest/v1'
const API_KEY = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH'

const postgrest = new PostgrestClient<Database>(REST_URL, {
  headers: { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` },
})

/**
 * E2E tests for PostgREST filter reserved-character escaping.
 *
 * These run against a REAL PostgREST server (Supabase CLI local, port 54321)
 * and prove the escaping survives the full pipeline: URL → PostgREST parser →
 * PostgreSQL. A wrong escape would either be rejected by PostgREST (HTTP 4xx)
 * or match the wrong rows.
 *
 * PostgREST reserved chars: , . : ( ) — must be wrapped in double quotes.
 * Inside double quotes, " is escaped with backslash \", and \ with \\.
 * https://postgrest.org/en/stable/references/api/url_grammar.html#reserved-characters
 */

describe('E2E: in() filter with reserved chars and double quotes', () => {
  const testUsernames = ['a"b,c', 'plain', 'x(y)', 'with"quote']

  beforeAll(async () => {
    // Insert rows with tricky usernames (upsert with onConflict for PK)
    await postgrest
      .from('users')
      .upsert(
        testUsernames.map((u) => ({ username: u })),
        { onConflict: 'username' }
      )
      .select()
  })

  afterAll(async () => {
    await postgrest.from('users').delete().in('username', testUsernames)
  })

  test('in() matches a value containing both " and ,', async () => {
    const res = await postgrest.from('users').select('username').in('username', ['a"b,c'])
    expect(res.error).toBeNull()
    expect(res.data).toEqual([{ username: 'a"b,c' }])
  })

  test('in() matches a value containing ( )', async () => {
    const res = await postgrest.from('users').select('username').in('username', ['x(y)'])
    expect(res.error).toBeNull()
    expect(res.data).toEqual([{ username: 'x(y)' }])
  })

  test('in() matches multiple values, some with reserved chars', async () => {
    const res = await postgrest
      .from('users')
      .select('username')
      .in('username', ['a"b,c', 'plain', 'x(y)'])
    expect(res.error).toBeNull()
    const names = (res.data as any[]).map((r) => r.username).sort()
    expect(names).toEqual(['a"b,c', 'plain', 'x(y)'])
  })

  test('notIn() excludes a value containing " and ,', async () => {
    const res = await postgrest
      .from('users')
      .select('username')
      .in('username', ['a"b,c', 'plain', 'x(y)', 'with"quote'])
      .notIn('username', ['a"b,c'])
    expect(res.error).toBeNull()
    const names = (res.data as any[]).map((r) => r.username).sort()
    expect(names).toEqual(['plain', 'with"quote', 'x(y)'])
  })
})

describe('E2E: likeAllOf/likeAnyOf with comma in pattern', () => {
  const tricky = ['foo,bar', 'foobar', 'foo,baz']

  beforeAll(async () => {
    await postgrest
      .from('users')
      .upsert(
        tricky.map((u) => ({ username: u })),
        { onConflict: 'username' }
      )
      .select()
  })

  afterAll(async () => {
    await postgrest.from('users').delete().in('username', tricky)
  })

  test('likeAllOf with comma pattern matches the literal-comma row only', async () => {
    // %foo,bar% must be treated as ONE pattern containing a comma.
    // Without quoting, PostgREST splits on , → patterns %foo and bar%,
    // which matches nothing (or the wrong rows).
    const res = await postgrest
      .from('users')
      .select('username')
      .likeAllOf('username', ['%foo,bar%'])
    expect(res.error).toBeNull()
    const names = (res.data as any[]).map((r) => r.username).sort()
    expect(names).toEqual(['foo,bar'])
  })

  test('likeAnyOf with comma pattern matches literal-comma rows only', async () => {
    const res = await postgrest
      .from('users')
      .select('username')
      .likeAnyOf('username', ['%foo,bar%', '%foo,baz%'])
    expect(res.error).toBeNull()
    const names = (res.data as any[]).map((r) => r.username).sort()
    expect(names).toEqual(['foo,bar', 'foo,baz'])
  })

  test('ilikeAllOf with comma pattern matches literal-comma row only', async () => {
    const res = await postgrest
      .from('users')
      .select('username')
      .ilikeAllOf('username', ['%FOO,BAR%'])
    expect(res.error).toBeNull()
    const names = (res.data as any[]).map((r) => r.username).sort()
    expect(names).toEqual(['foo,bar'])
  })

  test('ilikeAnyOf with comma pattern matches literal-comma rows only', async () => {
    const res = await postgrest
      .from('users')
      .select('username')
      .ilikeAnyOf('username', ['%FOO,BAR%', '%FOO,BAZ%'])
    expect(res.error).toBeNull()
    const names = (res.data as any[]).map((r) => r.username).sort()
    expect(names).toEqual(['foo,bar', 'foo,baz'])
  })
})
