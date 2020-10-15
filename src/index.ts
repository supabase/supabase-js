import Client from './Client'
import { SupabaseClientOptions } from './lib/types'


/**
 * Creates a new Supabase Client.
 */
const createClient = (
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions
) => {
  return new Client(supabaseUrl, supabaseKey, options)
}

export { createClient }
