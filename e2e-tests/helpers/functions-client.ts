/**
 * Functions Client Helpers for E2E Tests
 */
import { FunctionsClient } from '@supabase/functions-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

/**
 * Create a Functions client with anon key (default)
 */
export function createFunctionsClient(options?: any): FunctionsClient {
  return new FunctionsClient(FUNCTIONS_URL, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    ...options,
  })
}

/**
 * Create a Functions client with service_role key
 */
export function createServiceRoleFunctionsClient(options?: any): FunctionsClient {
  return new FunctionsClient(FUNCTIONS_URL, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    ...options,
  })
}

/**
 * Create a Functions client with custom API key
 */
export function createFunctionsClientWithKey(apiKey: string, options?: any): FunctionsClient {
  return new FunctionsClient(FUNCTIONS_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    ...options,
  })
}

/**
 * Get Functions connection info
 */
export function getFunctionsInfo() {
  return {
    url: FUNCTIONS_URL,
    supabaseUrl: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  }
}

// Export for tests that need it
export const FUNCTIONS_URL_EXPORT = FUNCTIONS_URL
