import SupabaseClient from './SupabaseClient'
import type { GenericSchema, SupabaseClientOptions } from './lib/types'

export * from '@supabase/gotrue-js'
export type { User as AuthUser, Session as AuthSession } from '@supabase/gotrue-js'
export type {
  PostgrestResponse,
  PostgrestSingleResponse,
  PostgrestMaybeSingleResponse,
  PostgrestError,
} from '@supabase/postgrest-js'
export {
  FunctionsHttpError,
  FunctionsFetchError,
  FunctionsRelayError,
  FunctionsError,
} from '@supabase/functions-js'
export * from '@supabase/realtime-js'
export { default as SupabaseClient } from './SupabaseClient'
export type { SupabaseClientOptions, QueryResult, QueryData, QueryError } from './lib/types'

/**
 * Creates a new Supabase Client.
 */
export const createClient = <
  Database = any,
  SchemaName extends string & keyof Database = 'public' extends keyof Database
    ? 'public'
    : string & keyof Database,
  Schema extends GenericSchema = Database[SchemaName] extends GenericSchema
    ? Database[SchemaName]
    : any
>(
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions<SchemaName>
): SupabaseClient<Database, SchemaName, Schema> => {
  return new SupabaseClient(supabaseUrl, supabaseKey, options)
}
