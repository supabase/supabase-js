/**
 * PostgREST Client Helpers for E2E Tests
 */
import { PostgrestClient } from '@supabase/postgrest-js'

const SUPABASE_URL = process.env.SUPABASE_URL || 'http://127.0.0.1:54321'
const REST_URL = `${SUPABASE_URL}/rest/v1`
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

/**
 * Create a PostgREST client with anon key (default)
 * This respects RLS policies
 */
export function createPostgrestClient<Database = any>(): PostgrestClient<Database> {
  return new PostgrestClient<Database>(REST_URL, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  })
}

/**
 * Create a PostgREST client with service_role key
 * This bypasses RLS policies
 */
export function createServiceRolePostgrestClient<Database = any>(): PostgrestClient<Database> {
  return new PostgrestClient<Database>(REST_URL, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  })
}

/**
 * Get PostgREST connection info
 */
export function getPostgrestInfo() {
  return {
    url: REST_URL,
    supabaseUrl: SUPABASE_URL,
    anonKey: SUPABASE_ANON_KEY,
    serviceRoleKey: SUPABASE_SERVICE_ROLE_KEY,
  }
}

// Export REST_URL for tests that need it
export const REST_URL_EXPORT = REST_URL
