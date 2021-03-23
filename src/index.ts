import SupabaseClient from './SupabaseClient'
import { SupabaseClientOptions, SupabaseRealtimePayload } from './lib/types'
import type { User as AuthUser } from '@supabase/gotrue-js'
import type { SchemaBase } from '@supabase/postgrest-js'

export * from '@supabase/gotrue-js'
export * from '@supabase/realtime-js'

/**
 * Creates a new Supabase Client.
 */
const createClient = <S extends SchemaBase = SchemaBase>(
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions
) => {
  return new SupabaseClient<S>(supabaseUrl, supabaseKey, options)
}

export { createClient, SupabaseClient, SupabaseClientOptions, SupabaseRealtimePayload, AuthUser }
