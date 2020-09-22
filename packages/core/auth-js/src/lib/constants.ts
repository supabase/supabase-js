export const GOTRUE_URL = process.env.GOTRUE_URL || 'http://localhost:9999'
export const AUDIENCE = process.env.AUDIENCE || ''
export const DEFAULT_HEADERS = {}
export const EXPIRY_MARGIN = process.env.EXPIRY_MARGIN || 60 * 1000
export const STORAGE_KEY = process.env.STORAGE_KEY || 'supabase.auth.token'
