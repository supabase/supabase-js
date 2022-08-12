import { SupabaseAuthClient } from '../src/lib/SupabaseAuthClient'
import { SupabaseClientOptions } from '../src/lib/types'
import { DEFAULT_HEADERS } from '../src/lib/constants'

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
