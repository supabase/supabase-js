import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { GoTrueAdminApi, GoTrueClient, type GoTrueClientOptions } from '../../src/index'
import { SupportedStorage } from '../../src/lib/types'

// Supabase CLI Auth endpoint
export const GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON = 'http://127.0.0.1:54321/auth/v1'

// Supabase CLI JWT secret
export const GOTRUE_JWT_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long'

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

// Load RSA private key from signing_keys.json and generate JWTs dynamically
const signingKeysPath = path.join(__dirname, '../supabase/signing_keys.json')
const signingKeys = JSON.parse(fs.readFileSync(signingKeysPath, 'utf8'))
const rsaKey = signingKeys[0]
const privateKeyObject = crypto.createPrivateKey({
  key: rsaKey,
  format: 'jwk'
})
const privateKey = privateKeyObject.export({ type: 'pkcs8', format: 'pem' })

// Generate anon key dynamically from signing keys (RS256-signed, required for API gateway)
const SUPABASE_ANON_KEY = jwt.sign(
  {
    iss: 'supabase-demo',
    role: 'anon',
    exp: 1983812996,
    iat: 1768925145
  },
  privateKey,
  { algorithm: 'RS256', keyid: rsaKey.kid }
)

// Generate service role key dynamically from signing keys (RS256-signed)
const SUPABASE_SERVICE_ROLE_KEY = jwt.sign(
  {
    iss: 'supabase-demo',
    role: 'service_role',
    exp: 1983812996,
    iat: 1768925145
  },
  privateKey,
  { algorithm: 'RS256', keyid: rsaKey.kid }
)

// Generate admin JWT dynamically from signing keys
const AUTH_ADMIN_JWT = jwt.sign(
  {
    sub: '1234567890',
    role: 'supabase_admin',
  },
  privateKey,
  { algorithm: 'RS256', keyid: rsaKey.kid }
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
