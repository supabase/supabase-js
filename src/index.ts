import { wxFetchSb } from './wx/fetch'
import { createWxCloudFetchSb } from './wx/fetch-cloud'
import { WxSocketTask } from './wx/socket-task'
import { navigatorLockNoOp } from './wx/navigator-lock'
import { wxLocalStorage } from './wx/local-storage'

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
  options = {} as {
    wxFetch?:
      | {
          type: 'wx'
        }
      | {
          type: 'wxCloud'
          wxCloudFnName: string
        }
  } & SupabaseClientOptions<SchemaName>
): SupabaseClient<Database, SchemaName, Schema> => {
  const { wxFetch, ...extraOptions } = options

  require('./wx/polyfills')

  let customFetch: typeof fetch | undefined = undefined
  if (wxFetch?.type === 'wx') {
    customFetch = wxFetchSb
  }
  if (wxFetch?.type === 'wxCloud') {
    customFetch = createWxCloudFetchSb(wxFetch.wxCloudFnName)
  }

  return new SupabaseClient<Database, SchemaName, Schema>(supabaseUrl, supabaseKey, {
    ...extraOptions,
    realtime: {
      transport: WxSocketTask,
      ...(extraOptions.realtime ?? {}),
    },
    auth: {
      storage: wxLocalStorage,
      ...(extraOptions.auth ?? {}),
      lock: navigatorLockNoOp,
    },
    global: {
      fetch: customFetch,
      ...(extraOptions.global ?? {}),
    },
  })
}
