import { SupabaseAuthClient } from '../src/lib/SupabaseAuthClient'

const DEFAULT_OPTIONS = {
  schema: 'public',
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  headers: {},
}
const settings = { ...DEFAULT_OPTIONS }

test('it should create a new instance of the class', () => {
  const authClient = new SupabaseAuthClient(settings)
  expect(authClient).toBeInstanceOf(SupabaseAuthClient)
})
