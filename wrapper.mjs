import cjsModule from '../cjs/index.js'

export * from '@supabase/auth-js'
export {
  FunctionsHttpError,
  FunctionsFetchError,
  FunctionsRelayError,
  FunctionsError,
  FunctionRegion,
} from '@supabase/functions-js'
export * from '@supabase/realtime-js'
export { default as SupabaseClient } from '../cjs/SupabaseClient.js'
export const createClient = cjsModule.createClient
