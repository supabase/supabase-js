import SupabaseClient from './SupabaseClient'
import type { GenericSchema, SupabaseClientOptions } from './lib/types'
import type { ServicesOptions } from './SupabaseClient'
import type { GetGenericDatabaseWithOptions } from '@supabase/postgrest-js'

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
export * from '@supabase/realtime-js'
export { default as SupabaseClient } from './SupabaseClient'
export type { SupabaseClientOptions, QueryResult, QueryData, QueryError } from './lib/types'

/**
 * Creates a new Supabase Client.
 */
export const createClient = <
  Database = any,
  ClientOptions extends ServicesOptions = GetGenericDatabaseWithOptions<Database>['options'],
  SchemaName extends string &
    keyof GetGenericDatabaseWithOptions<Database>['db'] = 'public' extends keyof GetGenericDatabaseWithOptions<Database>['db']
    ? 'public'
    : string & keyof GetGenericDatabaseWithOptions<Database>['db'],
  Schema = GetGenericDatabaseWithOptions<Database>['db'][SchemaName] extends GenericSchema
    ? GetGenericDatabaseWithOptions<Database>['db'][SchemaName]
    : any
>(
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions<SchemaName>
): SupabaseClient<
  Database,
  ClientOptions,
  SchemaName,
  Schema extends GenericSchema ? Schema : any
> => {
  return new SupabaseClient<
    Database,
    ClientOptions,
    SchemaName,
    Schema extends GenericSchema ? Schema : any
  >(supabaseUrl, supabaseKey, options)
}

// Check for Node.js <= 18 deprecation
function shouldShowDeprecationWarning(): boolean {
  if (
    typeof window !== 'undefined' ||
    typeof process === 'undefined' ||
    process.version === undefined ||
    process.version === null
  ) {
    return false
  }

  const versionMatch = process.version.match(/^v(\d+)\./)
  if (!versionMatch) {
    return false
  }

  const majorVersion = parseInt(versionMatch[1], 10)
  return majorVersion <= 18
}

if (shouldShowDeprecationWarning()) {
  console.warn(
    `⚠️  Node.js 18 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. ` +
      `Please upgrade to Node.js 20 or later. ` +
      `For more information, visit: https://github.com/orgs/supabase/discussions/37217`
  )
}
