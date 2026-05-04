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

test('_initSupabaseAuthClient should pass through lockAcquireTimeout option', () => {
  const client = new SupabaseClient('https://example.supabase.com', 'supabaseKey')
  const authClient = client['_initSupabaseAuthClient'](
    { ...authSettings, lockAcquireTimeout: 30_000 },
    undefined,
    undefined
  )

  expect((authClient as any).lockAcquireTimeout).toBe(30_000)
})

test('createClient should accept auth.lockAcquireTimeout and wire it to auth client', () => {
  const supa = new SupabaseClient('https://example.supabase.com', 'supabaseKey', {
    auth: { lockAcquireTimeout: 30_000 },
  })
  expect((supa.auth as any).lockAcquireTimeout).toBe(30_000)
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
