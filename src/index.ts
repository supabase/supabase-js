import SupabaseClient from './SupabaseClient'
import { SupabaseClientOptions } from './lib/types'


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

export { createClient }
