import jwt from 'jsonwebtoken'
import { GoTrueApi, GoTrueClient } from '../../src/index'

export const AUTO_CONFIRM_ENABLED_GOTRUE_PORT = 9999
export const SIGNUP_ENABLED_AUTO_CONFIRM_ENABLED_PORT = 9998
export const AUTO_CONFIRM_DISABLED_GOTRUE_PORT = 9997

export const GOTRUE_URL_AUTO_CONFIRM_ENABLED = `http://localhost:${AUTO_CONFIRM_ENABLED_GOTRUE_PORT}`
export const GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ENABLED = `http://localhost:${SIGNUP_ENABLED_AUTO_CONFIRM_ENABLED_PORT}`
export const GOTRUE_URL_AUTO_CONFIRM_DISABLED = `http://localhost:${AUTO_CONFIRM_DISABLED_GOTRUE_PORT}`

export const GOTRUE_JWT_SECRET = '37c304f8-51aa-419a-a1af-06154e63707a'

const AUTH_ADMIN_JWT = jwt.sign(
  {
    sub: '1234567890',
    role: 'supabase_admin',
  },
  GOTRUE_JWT_SECRET
)

export const authClient = new GoTrueClient({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ENABLED,
  autoRefreshToken: false,
  persistSession: true,
})

export const authClientWithSession = new GoTrueClient({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ENABLED,
  autoRefreshToken: false,
  persistSession: false,
})

export const authSubscriptionClient = new GoTrueClient({
  url: GOTRUE_URL_SIGNUP_ENABLED_AUTO_CONFIRM_ENABLED,
  autoRefreshToken: false,
  persistSession: true,
})

export const clientApiAutoConfirmEnabledClient = new GoTrueClient({
  url: GOTRUE_URL_AUTO_CONFIRM_ENABLED,
  autoRefreshToken: false,
  persistSession: true,
})

export const clientApiAutoConfirmDisabledClient = new GoTrueClient({
  url: GOTRUE_URL_AUTO_CONFIRM_DISABLED,
  autoRefreshToken: false,
  persistSession: true,
})

export const authAdminApiAutoConfirmEnabledClient = new GoTrueApi({
  url: GOTRUE_URL_AUTO_CONFIRM_ENABLED,
  headers: {
    Authorization: `Bearer ${AUTH_ADMIN_JWT}`,
  },
})

export const authAdminApiAutoConfirmDisabledClient = new GoTrueApi({
  url: GOTRUE_URL_AUTO_CONFIRM_DISABLED,
  headers: {
    Authorization: `Bearer ${AUTH_ADMIN_JWT}`,
  },
})

const SERVICE_ROLE_JWT = jwt.sign(
  {
    sub: 's2rv1c2-r0l3-k3y',
    // role: 'service_role',
    role: 'supabase_admin',
  },
  GOTRUE_JWT_SECRET
)

export const serviceRoleApiClient = new GoTrueApi({
  url: GOTRUE_URL_AUTO_CONFIRM_ENABLED,
  headers: {
    Authorization: `Bearer ${SERVICE_ROLE_JWT}`,
  },
})
