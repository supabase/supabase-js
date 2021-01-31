import SupabaseClient from './SupabaseClient'
import { SupabaseBaseSchema, SupabaseClientOptions, SupabaseRealtimePayload } from './lib/types'
import { User as AuthUser } from '@supabase/gotrue-js'
export * from '@supabase/gotrue-js'
export * from '@supabase/realtime-js'

/**
 * Creates a new Supabase Client.
 */
const createClient = <Schema extends SupabaseBaseSchema = SupabaseBaseSchema>(
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions
) => {
  return new SupabaseClient<Schema>(supabaseUrl, supabaseKey, options)
}

export { createClient, SupabaseClient, SupabaseClientOptions, SupabaseRealtimePayload, AuthUser }
