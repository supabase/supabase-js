import SupabaseClient from './SupabaseClient'
import { SupabaseClientOptions, SupabaseRealtimePayload } from './lib/types'
import { User as AuthUser, Session as AuthSession } from '@supabase/gotrue-js'
export * from '@supabase/gotrue-js'
export {
  PostgrestResponse,
  PostgrestSingleResponse,
  PostgrestMaybeSingleResponse,
  PostgrestError,
} from '@supabase/postgrest-js'
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

export {
  createClient,
  SupabaseClient,
  SupabaseClientOptions,
  SupabaseRealtimePayload,
  AuthUser,
  AuthSession,
}
