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
