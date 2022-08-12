import { SupabaseAuthClient } from '../src/lib/SupabaseAuthClient'
import { SupabaseClientOptions } from '../src/lib/types'

const DEFAULT_OPTIONS: SupabaseClientOptions<'public'> = {
  db: {
    schema: 'public',
  },
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  headers: {},
}
const settings = { ...DEFAULT_OPTIONS }

test('it should create a new instance of the class', () => {
  const authClient = new SupabaseAuthClient(settings)
  expect(authClient).toBeInstanceOf(SupabaseAuthClient)
})
