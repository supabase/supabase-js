/**
 * @deprecated This auto-detection export will be removed in v3.0.0
 *
 * This export provides backward compatibility for Node.js < 22 environments
 * by using the auto-detection version of realtime-js which includes dynamic imports.
 *
 * For production builds, use the main export instead:
 * import { createClient } from '@supabase/supabase-js'
 */

import SupabaseClient from './SupabaseClient.auto'
import type { GenericSchema, SupabaseClientOptions } from './lib/types'

export * from '@supabase/auth-js'
export type { User as AuthUser, Session as AuthSession } from '@supabase/auth-js'
export {
  type PostgrestResponse,
  type PostgrestSingleResponse,
  type PostgrestMaybeSingleResponse,
  PostgrestError,
} from '@supabase/postgrest-js'
export {
  FunctionsHttpError,
  FunctionsFetchError,
  FunctionsRelayError,
  FunctionsError,
  type FunctionInvokeOptions,
  FunctionRegion,
} from '@supabase/functions-js'

// Import from realtime-js/auto instead of main export
// @ts-ignore - TypeScript doesn't understand package.json exports with Node moduleResolution
export * from '@supabase/realtime-js/auto'

export { default as SupabaseClient } from './SupabaseClient.auto'
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
  return new SupabaseClient<Database, SchemaName, Schema>(supabaseUrl, supabaseKey, options)
}
