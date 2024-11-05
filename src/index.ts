import { wxFetchSb } from './wx/wx-fetch'
import { createWxCloudFetchSb } from './wx/wxcloud-fetch'
import { WxSocketTask } from './wx/socket-task'

import SupabaseClient from './SupabaseClient'
import type { GenericSchema, SupabaseClientOptions } from './lib/types'

export * from '@supabase-wechat/auth-js'
export type { User as AuthUser, Session as AuthSession } from '@supabase-wechat/auth-js'
export type {
  PostgrestResponse,
  PostgrestSingleResponse,
  PostgrestMaybeSingleResponse,
  PostgrestError,
} from '@supabase-wechat/postgrest-js'
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
  const { wxFetch, ...optionsWithoutFetch } = options

  require('./wx/polyfills')

  let customFetch = options.global?.fetch
  if (!customFetch) {
    if (wxFetch?.type === 'wx') {
      customFetch = wxFetchSb
    }
    if (wxFetch?.type === 'wxCloud') {
      customFetch = createWxCloudFetchSb(wxFetch.wxCloudFnName)
    }
  }

  let customSocketTask = options.realtime?.transport
  if (!customSocketTask) {
    customSocketTask = WxSocketTask
  }

  return new SupabaseClient<Database, SchemaName, Schema>(supabaseUrl, supabaseKey, {
    ...optionsWithoutFetch,
    realtime: {
      ...(optionsWithoutFetch.realtime ?? {}),
      transport: customSocketTask,
    },
    global: {
      ...(optionsWithoutFetch.global ?? {}),
      fetch: customFetch,
    },
  })
}
