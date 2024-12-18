import SupabaseClient from './SupabaseClient'
import type { GenericSchema, SupabaseClientOptions } from './lib/types'

export * from '@supabase/auth-js'
export type { User as AuthUser, Session as AuthSession } from '@supabase/auth-js'
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
  type FunctionInvokeOptions,
  FunctionRegion,
} from '@supabase/functions-js'
export * from '@supabase/realtime-js'
export { default as SupabaseClient } from './SupabaseClient'
export type { SupabaseClientOptions, QueryResult, QueryData, QueryError } from './lib/types'

interface JwtPayload {
  role: string
  iss: string
  iat: number
  exp: number
}

function decodeJWT(jwt: string): JwtPayload | null {
  try {
    const base64Url = jwt.split('.')[1]
    if (!base64Url) return null

    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    )

    return JSON.parse(jsonPayload)
  } catch (e) {
    return null
  }
}

const isServiceKey = (supabaseKey: string): boolean => {
  // First try to decode the JWT
  const payload = decodeJWT(supabaseKey)
  if (payload) {
    return payload.role === 'service_role'
  }

  // Fallback to string matching if JWT parsing fails
  return supabaseKey.includes('service_role')
}

/**
 * Creates a new Supabase Client for public usage.
 * @throws Error if a service role key is used
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
  if (isServiceKey(supabaseKey)) {
    throw new Error(
      'Service role API keys should only be used with createAdminClient(). ' +
        'Use createClient() with an anon key when authenticating users.'
    )
  }
  return new SupabaseClient<Database, SchemaName, Schema>(supabaseUrl, supabaseKey, options)
}

/**
 * Creates a new Supabase Admin Client with service role privileges.
 * @throws Error if a non-service-role key is used
 */
export const createAdminClient = <
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
  if (!isServiceKey(supabaseKey)) {
    throw new Error(
      'createAdminClient() requires a service role API key. ' +
        'Use createClient() for non-admin operations.'
    )
  }
  return new SupabaseClient<Database, SchemaName, Schema>(supabaseUrl, supabaseKey, options)
}
