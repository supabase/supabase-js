import jwt from 'jsonwebtoken'
import { GoTrueAdminApi, GoTrueClient, type GoTrueClientOptions } from '../../src/index'
import { SupportedStorage } from '../../src/lib/types'

// Supabase CLI Auth endpoint
export const GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON = 'http://127.0.0.1:54321/auth/v1'

// Supabase CLI JWT secret
export const GOTRUE_JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long'

// Supabase CLI default anon key (required for API gateway)
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

// Supabase CLI default service role key
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

class MemoryStorage {
  private _storage: { [name: string]: string } = {}

  async setItem(name: string, value: string) {
    this._storage[name] = value
  }

  async getItem(name: string): Promise<string | null> {
    return this._storage[name] || null
  }

  async removeItem(name: string) {
    delete this._storage[name]
  }
}

const AUTH_ADMIN_JWT = jwt.sign(
  {
    sub: '1234567890',
    role: 'supabase_admin',
  },
  GOTRUE_JWT_SECRET
)

export const authClient = new GoTrueClient({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  headers: { apikey: SUPABASE_ANON_KEY },
  autoRefreshToken: false,
  persistSession: true,
  storage: new MemoryStorage(),
})

export const authClientWithSession = new GoTrueClient({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  headers: { apikey: SUPABASE_ANON_KEY },
  autoRefreshToken: false,
  persistSession: true,
  storage: new MemoryStorage(),
})

export const authSubscriptionClient = new GoTrueClient({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  headers: { apikey: SUPABASE_ANON_KEY },
  autoRefreshToken: false,
  persistSession: true,
  storage: new MemoryStorage(),
})

export const clientApiAutoConfirmEnabledClient = new GoTrueClient({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  headers: { apikey: SUPABASE_ANON_KEY },
  autoRefreshToken: false,
  persistSession: true,
  storage: new MemoryStorage(),
})

export const pkceClient = new GoTrueClient({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  headers: { apikey: SUPABASE_ANON_KEY },
  autoRefreshToken: false,
  persistSession: true,
  storage: new MemoryStorage(),
  flowType: 'pkce',
})

export const autoRefreshClient = new GoTrueClient({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  headers: { apikey: SUPABASE_ANON_KEY },
  autoRefreshToken: true,
  persistSession: true,
})

export const authAdminApiAutoConfirmEnabledClient = new GoTrueAdminApi({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  headers: {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${AUTH_ADMIN_JWT}`,
  },
})

export const serviceRoleApiClient = new GoTrueAdminApi({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  headers: {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
  },
})

export function getClientWithSpecificStorage(storage: SupportedStorage) {
  return new GoTrueClient({
    url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
    headers: { apikey: SUPABASE_ANON_KEY },
    storageKey: 'test-specific-storage',
    autoRefreshToken: false,
    persistSession: true,
    storage,
  })
}

export function getClientWithSpecificStorageKey(
  storageKey: string,
  opts: GoTrueClientOptions = {}
) {
  return new GoTrueClient({
    url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
    headers: { apikey: SUPABASE_ANON_KEY },
    autoRefreshToken: false,
    persistSession: true,
    storageKey,
    ...opts,
  })
}
