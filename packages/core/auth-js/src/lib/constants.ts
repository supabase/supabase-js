import { version } from './version'
export const GOTRUE_URL = 'http://localhost:9999'
export const AUDIENCE = ''
export const DEFAULT_HEADERS = { 'X-Client-Info': `gotrue-js/${version}` }
export const EXPIRY_MARGIN = 10 // in seconds
export const NETWORK_FAILURE = {
  ERROR_MESSAGE: 'Request Failed',
  MAX_RETRIES: 10,
  RETRY_INTERVAL: 2, // in deciseconds
}
export const STORAGE_KEY = 'supabase.auth.token'
export const COOKIE_OPTIONS = {
  name: 'sb',
  lifetime: 60 * 60 * 8,
  domain: '',
  path: '/',
  sameSite: 'lax',
}
