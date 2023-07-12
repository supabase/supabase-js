import jwt from 'jsonwebtoken'
import { GoTrueAdminApi, GoTrueClient } from '../../src/index'

export const SIGNUP_ENABLED_AUTO_CONFIRM_OFF_PORT = 9999

export const SIGNUP_ENABLED_AUTO_CONFIRM_ON_PORT = 9998
export const SIGNUP_DISABLED_AUTO_CONFIRM_OFF_PORT = 9997

export const GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_OFF = `http://localhost:${SIGNUP_ENABLED_AUTO_CONFIRM_OFF_PORT}`
export const GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON = `http://localhost:${SIGNUP_ENABLED_AUTO_CONFIRM_ON_PORT}`
export const GOTRUE_URL_SIGNUP_DISABLED_AUTO_CONFIRM_OFF = `http://localhost:${SIGNUP_DISABLED_AUTO_CONFIRM_OFF_PORT}`

export const GOTRUE_JWT_SECRET = '37c304f8-51aa-419a-a1af-06154e63707a'

const AUTH_ADMIN_JWT = jwt.sign(
  {
    sub: '1234567890',
    role: 'supabase_admin',
  },
  GOTRUE_JWT_SECRET
)

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

export const authClient = new GoTrueClient({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  autoRefreshToken: false,
  persistSession: true,
  storage: new MemoryStorage(),
})

export const authClientWithSession = new GoTrueClient({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  autoRefreshToken: false,
  persistSession: false,
})

export const authSubscriptionClient = new GoTrueClient({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  autoRefreshToken: false,
  persistSession: true,
  storage: new MemoryStorage(),
})

export const clientApiAutoConfirmEnabledClient = new GoTrueClient({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  autoRefreshToken: false,
  persistSession: true,
  storage: new MemoryStorage(),
})

export const clientApiAutoConfirmOffSignupsEnabledClient = new GoTrueClient({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_OFF,
  autoRefreshToken: false,
  persistSession: true,
  storage: new MemoryStorage(),
})

export const clientApiAutoConfirmDisabledClient = new GoTrueClient({
  url: GOTRUE_URL_SIGNUP_DISABLED_AUTO_CONFIRM_OFF,
  autoRefreshToken: false,
  persistSession: true,
  storage: new MemoryStorage(),
})

export const authAdminApiAutoConfirmEnabledClient = new GoTrueAdminApi({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  headers: {
    Authorization: `Bearer ${AUTH_ADMIN_JWT}`,
  },
})

export const authAdminApiAutoConfirmDisabledClient = new GoTrueAdminApi({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_OFF,
  headers: {
    Authorization: `Bearer ${AUTH_ADMIN_JWT}`,
  },
})

const SERVICE_ROLE_JWT = jwt.sign(
  {
    role: 'service_role',
  },
  GOTRUE_JWT_SECRET
)

export const serviceRoleApiClient = new GoTrueAdminApi({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  headers: {
    Authorization: `Bearer ${SERVICE_ROLE_JWT}`,
  },
})

export const serviceRoleApiClientWithSms = new GoTrueAdminApi({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_OFF,
  headers: {
    Authorization: `Bearer ${SERVICE_ROLE_JWT}`,
  },
})

export const serviceRoleApiClientNoSms = new GoTrueAdminApi({
  url: GOTRUE_URL_SIGNUP_DISABLED_AUTO_CONFIRM_OFF,
  headers: {
    Authorization: `Bearer ${SERVICE_ROLE_JWT}`,
  },
})
