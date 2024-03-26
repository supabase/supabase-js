import { version } from './version'
export const GOTRUE_URL = 'http://localhost:9999'
export const STORAGE_KEY = 'supabase.auth.token'
export const AUDIENCE = ''
export const DEFAULT_HEADERS = { 'X-Client-Info': `gotrue-js/${version}` }
export const EXPIRY_MARGIN = 10 // in seconds
export const NETWORK_FAILURE = {
  MAX_RETRIES: 10,
  RETRY_INTERVAL: 2, // in deciseconds
}

export const API_VERSION_HEADER_NAME = 'X-Supabase-Api-Version'
export const API_VERSIONS = {
  '2024-01-01': {
    timestamp: Date.parse('2024-01-01T00:00:00.0Z'),
    name: '2024-01-01',
  },
}
