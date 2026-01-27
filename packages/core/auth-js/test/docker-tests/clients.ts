import jwt from 'jsonwebtoken'
import { GoTrueAdminApi, GoTrueClient } from '../../src/index'

// Docker Compose GoTrue URLs (different ports for different configurations)
export const DOCKER_URLS = {
  SIGNUP_ENABLED_AUTO_CONFIRM_OFF: 'http://localhost:9999',
  SIGNUP_ENABLED_AUTO_CONFIRM_ON: 'http://localhost:9998',
  SIGNUP_DISABLED_AUTO_CONFIRM_OFF: 'http://localhost:9997',
  SIGNUP_ENABLED_ASYMMETRIC_AUTO_CONFIRM_ON: 'http://localhost:9996',
} as const

// Docker JWT secret
const DOCKER_JWT_SECRET = '37c304f8-51aa-419a-a1af-06154e63707a'

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

const SERVICE_ROLE_JWT = jwt.sign(
  {
    role: 'service_role',
    iat: Math.floor(Date.now() / 1000) - 60,
  },
  DOCKER_JWT_SECRET
)

// Client for signup disabled instance
export const signupDisabledClient = new GoTrueClient({
  url: DOCKER_URLS.SIGNUP_DISABLED_AUTO_CONFIRM_OFF,
  autoRefreshToken: false,
  persistSession: true,
  storage: new MemoryStorage(),
})

// Client for asymmetric JWT instance (RS256)
export const asymmetricClient = new GoTrueClient({
  url: DOCKER_URLS.SIGNUP_ENABLED_ASYMMETRIC_AUTO_CONFIRM_ON,
  autoRefreshToken: false,
  persistSession: true,
  storage: new MemoryStorage(),
})

// Client for phone/SMS tests (autoconfirm OFF with SMS enabled)
export const phoneClient = new GoTrueClient({
  url: DOCKER_URLS.SIGNUP_ENABLED_AUTO_CONFIRM_OFF,
  autoRefreshToken: false,
  persistSession: true,
  storage: new MemoryStorage(),
})

// Client for autoconfirm ON (standard Docker instance)
export const autoConfirmClient = new GoTrueClient({
  url: DOCKER_URLS.SIGNUP_ENABLED_AUTO_CONFIRM_ON,
  autoRefreshToken: false,
  persistSession: true,
  storage: new MemoryStorage(),
})

// Service role API for autoconfirm OFF instance
export const serviceRoleApiClient = new GoTrueAdminApi({
  url: DOCKER_URLS.SIGNUP_ENABLED_AUTO_CONFIRM_OFF,
  headers: {
    Authorization: `Bearer ${SERVICE_ROLE_JWT}`,
  },
})

