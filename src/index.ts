import SupabaseClient from './SupabaseClient'
import { SupabaseClientOptions, SupabaseRealtimePayload } from './lib/types'
export * from '@supabase/gotrue-js'
export * from '@supabase/realtime-js'

/**
 * Creates a new Supabase Client.
 */
const createClient = (
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions
) => {
  return new SupabaseClient(supabaseUrl, supabaseKey, options)
}

export { createClient, SupabaseClient, SupabaseClientOptions, SupabaseRealtimePayload }
