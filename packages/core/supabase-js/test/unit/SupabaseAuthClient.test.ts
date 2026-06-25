import { GoTrueClient } from '@supabase/auth-js'
import { SupabaseAuthClient } from '../../src/lib/SupabaseAuthClient'
import SupabaseClient from '../../src/SupabaseClient'
import { DEFAULT_HEADERS } from '../../src/lib/constants'

const DEFAULT_OPTIONS = {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: DEFAULT_HEADERS,
  },
  db: {
    schema: 'public',
  },
}
const settings = { ...DEFAULT_OPTIONS }

const authSettings = { ...settings.global, ...settings.auth }

test('it should create a new instance of the class', () => {
  const authClient = new SupabaseAuthClient(authSettings)
  expect(authClient).toBeInstanceOf(SupabaseAuthClient)
})

test('_initSupabaseAuthClient should overwrite authHeaders if headers are provided', () => {
  const authClient = new SupabaseClient('https://example.supabase.com', 'supabaseKey')[
    '_initSupabaseAuthClient'
  ](authSettings, {
    Authorization: 'Bearer custom-auth-header',
  })
  expect(authClient['headers']['Authorization']).toBe('Bearer custom-auth-header')
  expect(authClient['headers']['apikey']).toBe('supabaseKey')
})

test('_initSupabaseAuthClient should pass through throwOnError option', () => {
  const client = new SupabaseClient('https://example.supabase.com', 'supabaseKey')
  const authClient = client['_initSupabaseAuthClient'](
    { ...authSettings, throwOnError: true },
    undefined,
    undefined
  )

  expect((authClient as any).isThrowOnErrorEnabled()).toBe(true)
})

test('createClient should accept auth.throwOnError and wire it to auth client', () => {
  const supa = new SupabaseClient('https://example.supabase.com', 'supabaseKey', {
    auth: { throwOnError: true },
  })
  expect((supa.auth as any).isThrowOnErrorEnabled()).toBe(true)
})

test('createClient gates passkey methods when auth.experimental.passkey is not set', async () => {
  const supa = new SupabaseClient('https://example.supabase.com', 'supabaseKey')
  await expect(supa.auth.passkey.list()).rejects.toThrow(/experimental.*passkey/)
})

test('createClient gates admin passkey methods when auth.experimental.passkey is not set', async () => {
  const supa = new SupabaseClient('https://example.supabase.com', 'supabaseKey')
  await expect(
    supa.auth.admin.passkey.listPasskeys({ userId: '00000000-0000-0000-0000-000000000000' })
  ).rejects.toThrow(/experimental.*passkey/)
})

test('createClient with auth.experimental.passkey enables the passkey API', async () => {
  const optionsResponse = {
    challenge_id: '00000000-0000-0000-0000-000000000000',
    options: { challenge: 'Y2hhbGxlbmdl', rpId: 'example.supabase.com' },
    expires_at: 1900000000,
  }
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: () => Promise.resolve(optionsResponse),
  })
  const supa = new SupabaseClient('https://example.supabase.com', 'supabaseKey', {
    auth: { experimental: { passkey: true }, persistSession: false, autoRefreshToken: false },
    global: { fetch: mockFetch },
  })

  const { data, error } = await supa.auth.passkey.startAuthentication()

  expect(error).toBeNull()
  expect(data).toEqual(optionsResponse)
  const [url, params] = mockFetch.mock.calls[0]
  expect(url).toBe('https://example.supabase.com/auth/v1/passkeys/authentication/options')
  expect(params.method).toBe('POST')
})

test('createClient with auth.experimental.passkey enables the admin passkey API', async () => {
  const userId = '00000000-0000-0000-0000-000000000000'
  const mockFetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    headers: new Headers(),
    json: () => Promise.resolve([]),
  })
  const supa = new SupabaseClient('https://example.supabase.com', 'supabaseKey', {
    auth: { experimental: { passkey: true }, persistSession: false, autoRefreshToken: false },
    global: { fetch: mockFetch },
  })

  const { data, error } = await supa.auth.admin.passkey.listPasskeys({ userId })

  expect(error).toBeNull()
  expect(data).toEqual([])
  const [url, params] = mockFetch.mock.calls[0]
  expect(url).toBe(`https://example.supabase.com/auth/v1/admin/users/${userId}/passkeys`)
  expect(params.method).toBe('GET')
})

// The two tests below verify that `lockAcquireTimeout` flows from
// `createClient({ auth: { lockAcquireTimeout: ... }})` through to the
// constructed `GoTrueClient` instance. The field is `protected`, so we
// cast through `unknown` to a precise shape rather than using `as any`.
// The targeted cast is deliberate: when the legacy lock path is removed in
// v3 (see `// TODO(v3): remove …` markers in `GoTrueClient.ts` and the
// SDK Linear ticket for the v3 cleanup), `grep -rn "lockAcquireTimeout"`
// surfaces both the production code AND these tests together so the
// removal is mechanical.

test('_initSupabaseAuthClient should pass through lockAcquireTimeout option', () => {
  const client = new SupabaseClient('https://example.supabase.com', 'supabaseKey')
  const authClient = client['_initSupabaseAuthClient'](
    { ...authSettings, lockAcquireTimeout: 30_000 },
    undefined,
    undefined
  )

  expect((authClient as unknown as { lockAcquireTimeout: number }).lockAcquireTimeout).toBe(30_000)
})

test('createClient should accept auth.lockAcquireTimeout and wire it to auth client', () => {
  const supa = new SupabaseClient('https://example.supabase.com', 'supabaseKey', {
    auth: { lockAcquireTimeout: 30_000 },
  })
  expect((supa.auth as unknown as { lockAcquireTimeout: number }).lockAcquireTimeout).toBe(30_000)
})

test('createClient should accept auth.skipAutoInitialize and wire it to auth client', async () => {
  const initializeSpy = jest.spyOn(GoTrueClient.prototype, 'initialize')
  try {
    const supa = new SupabaseClient('https://example.supabase.com', 'supabaseKey', {
      auth: { skipAutoInitialize: true },
    })
    // Wait a tick to let any auto-initialization run
    await new Promise((resolve) => setTimeout(resolve, 10))
    expect(initializeSpy).not.toHaveBeenCalled()
    expect(supa.auth).toBeInstanceOf(SupabaseAuthClient)
  } finally {
    initializeSpy.mockRestore()
  }
})
