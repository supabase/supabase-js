// constants.ts
import { version } from './version'
export const CLIENT_VERSION = `supabase-js/${version}`
export const DEFAULT_HEADERS = { 'X-Client-Info': CLIENT_VERSION }
export const STORAGE_KEY = 'supabase.auth.token'
