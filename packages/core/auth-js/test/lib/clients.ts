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

// Supabase CLI default anon key (RS256-signed, required for API gateway)
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjYzOGM1NGI4LTI4YzItNGIxMi05NTk4LWJhMTJlZjYxMGEyOSJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTYsImlhdCI6MTc2ODkyNTE0NX0.sLtYGE4TkSCw_jgU-E5QwCHJKuEBIY3gxpQfhyH0GBM1-t2PNjxLD9K1P0cd2LnYJATW4iv-LCNnBTfqYbqIcs1-uuVHbHmtEYdLiy1OwDi8XdP_kG34TK3m2suZp7Y7LLNaNNEzo20k2VPLXPcQwYi03t6qbs8fJBOSUFfsTggWO_UusgpykH73k35wx7gITW7MFoynxACZw-jAiwD--Ito3RnJ_Uv-1ePg4elag7rh22WMi5R-oy6LA6qsGTFl6-FPaLAQeHybn5WuOfEf8sdXh4U8Y4xAeExSa_9oLjZUaK9eCgliy9mt0vA6-we6J1-GdooTf5pv_g-KSyIcnQ'

// Supabase CLI default service role key (RS256-signed)
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6IjYzOGM1NGI4LTI4YzItNGIxMi05NTk4LWJhMTJlZjYxMGEyOSJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5NiwiaWF0IjoxNzY4OTI1MTQ1fQ.LZ4AAocw8zIxsIdyp1sOkDU0s6Od30oGl5xVN2kFVdETSxgD482l-ocESf3AeEx-yrB99FmNVFtIetiYjsMTRgHmFUHbzQNDADW5uS4nwhmH-gOKo9sKWP5aYu2ZjuXdM4cS2SZnPmH4bQ7Xd2HCVmOHh7X2Bai9gj_5yUzO3_Tkl9SYxGQfwAnITPUTwL91mpC80bLRVZasXBldIIUsjw5OfWJDA5_h1sMvF_jNbXdhh1CjvUckVe1lGdxX5uI8J3qLDF2V7J9UnG8qldUn1EWQYIzhkqj_MKIXrcK-2TNBaQ5_p462DStgw4lOU_ChD1e30IU_J4559t6K11tZow'

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

// Load RSA private key from signing_keys.json and sign admin JWT with RS256
const signingKeysPath = path.join(__dirname, '../supabase/signing_keys.json')
const signingKeys = JSON.parse(fs.readFileSync(signingKeysPath, 'utf8'))
const rsaKey = signingKeys[0]
const privateKeyObject = crypto.createPrivateKey({
  key: rsaKey,
  format: 'jwk'
})
const privateKey = privateKeyObject.export({ type: 'pkcs8', format: 'pem' })

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
