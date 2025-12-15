// Direct package re-exports - these work correctly in:
// - Node.js (resolves via node_modules)
// - jsDelivr (bundles with named exports)
// - esm.sh (bundles correctly)
// - Bundlers (webpack, vite, etc.)
export * from '@supabase/auth-js'
export { PostgrestError } from '@supabase/postgrest-js'
export {
  FunctionsHttpError,
  FunctionsFetchError,
  FunctionsRelayError,
  FunctionsError,
  FunctionRegion,
} from '@supabase/functions-js'
export * from '@supabase/realtime-js'

// Local exports from CJS build (Node.js can import CJS from ESM)
import main from '../main/index.js'
export const { SupabaseClient, createClient } = main

// Default export
export default main
