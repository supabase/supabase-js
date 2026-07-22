import SupabaseClient from './SupabaseClient'
import type { AnySupabasePlugin, PluginNamespaces } from './lib/plugins'
import type { SupabaseClientOptions } from './lib/types'

export * from '@supabase/auth-js'
export type { User as AuthUser, Session as AuthSession } from '@supabase/auth-js'
export type {
  PostgrestResponse,
  PostgrestSingleResponse,
  PostgrestMaybeSingleResponse,
  PostgrestBuilder,
  PostgrestFilterBuilder,
  PostgrestTransformBuilder,
  PostgrestQueryBuilder,
} from '@supabase/postgrest-js'
export { PostgrestError } from '@supabase/postgrest-js'
export { StorageApiError } from '@supabase/storage-js'
export type { FunctionInvokeOptions } from '@supabase/functions-js'
export {
  FunctionsHttpError,
  FunctionsFetchError,
  FunctionsRelayError,
  FunctionsError,
  FunctionRegion,
} from '@supabase/functions-js'
export * from '@supabase/realtime-js'
export { default as SupabaseClient } from './SupabaseClient'
export type {
  SupabaseClientOptions,
  TracePropagationOptions,
  QueryResult,
  QueryData,
  QueryError,
  DatabaseWithoutInternals,
} from './lib/types'
export { defineSupabasePlugin } from './lib/plugins'
export type { SupabasePlugin, AnySupabasePlugin, PluginNamespaces } from './lib/plugins'

/**
 * Creates a new Supabase Client.
 *
 * @example Creating a Supabase client
 * ```ts
 * import { createClient } from '@supabase/supabase-js'
 *
 * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
 * const { data, error } = await supabase.from('profiles').select('*')
 * ```
 */
export function createClient<
  Database = any,
  SchemaNameOrClientOptions extends
    | (string & keyof Omit<Database, '__InternalSupabase'>)
    | { PostgrestVersion: string } = 'public' extends keyof Omit<Database, '__InternalSupabase'>
    ? 'public'
    : string & keyof Omit<Database, '__InternalSupabase'>,
  SchemaName extends string & keyof Omit<Database, '__InternalSupabase'> =
    SchemaNameOrClientOptions extends string & keyof Omit<Database, '__InternalSupabase'>
      ? SchemaNameOrClientOptions
      : 'public' extends keyof Omit<Database, '__InternalSupabase'>
        ? 'public'
        : string & keyof Omit<Omit<Database, '__InternalSupabase'>, '__InternalSupabase'>,
>(
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions<SchemaName> & { plugins?: never }
): SupabaseClient<Database, SchemaNameOrClientOptions, SchemaName>
/**
 * Creates a new Supabase Client with plugins. Each plugin contributes a
 * typed namespace at `supabase.<name>`, inferred from the `plugins` array.
 *
 * Type note: if you pass an explicit `Database` type argument, TypeScript
 * cannot partially infer the rest, so plugin namespaces fall back to
 * untyped. To combine an explicit `Database` with typed namespaces, pass
 * the plugins tuple as the fourth type argument:
 * `const plugins = [myPlugin()] as const` then
 * `createClient<Database, 'public', 'public', typeof plugins>(url, key, { plugins })`.
 *
 * @example Creating a Supabase client with plugins
 * ```ts
 * import { createClient } from '@supabase/supabase-js'
 * import { guestbookPlugin } from '@example/supabase-plugin-guestbook'
 *
 * const supabase = createClient(url, key, { plugins: [guestbookPlugin()] })
 * await supabase.guestbook.list() // typed, inferred from the plugins array
 * ```
 */
export function createClient<
  Database = any,
  SchemaNameOrClientOptions extends
    | (string & keyof Omit<Database, '__InternalSupabase'>)
    | { PostgrestVersion: string } = 'public' extends keyof Omit<Database, '__InternalSupabase'>
    ? 'public'
    : string & keyof Omit<Database, '__InternalSupabase'>,
  SchemaName extends string & keyof Omit<Database, '__InternalSupabase'> =
    SchemaNameOrClientOptions extends string & keyof Omit<Database, '__InternalSupabase'>
      ? SchemaNameOrClientOptions
      : 'public' extends keyof Omit<Database, '__InternalSupabase'>
        ? 'public'
        : string & keyof Omit<Omit<Database, '__InternalSupabase'>, '__InternalSupabase'>,
  const Plugins extends readonly AnySupabasePlugin[] = readonly AnySupabasePlugin[],
>(
  supabaseUrl: string,
  supabaseKey: string,
  options: SupabaseClientOptions<SchemaName> & { plugins: Plugins }
): SupabaseClient<Database, SchemaNameOrClientOptions, SchemaName> & PluginNamespaces<Plugins>
export function createClient(
  supabaseUrl: string,
  supabaseKey: string,
  options?: SupabaseClientOptions<string>
): any {
  return new SupabaseClient(supabaseUrl, supabaseKey, options)
}

// Check for Node.js <= 20 deprecation
function shouldShowDeprecationWarning(): boolean {
  // Skip in browser and Deno environments
  if (typeof window !== 'undefined' || (globalThis as any)['Deno'] !== undefined) {
    return false
  }

  // Skip if process is not available (e.g., Edge Runtime)
  // Use dynamic property access to avoid Next.js Edge Runtime static analysis warnings
  const _process = (globalThis as any)['process']
  if (!_process) {
    return false
  }

  const processVersion = _process['version']
  if (processVersion === undefined || processVersion === null) {
    return false
  }

  const versionMatch = processVersion.match(/^v(\d+)\./)
  if (!versionMatch) {
    return false
  }

  const majorVersion = parseInt(versionMatch[1], 10)
  return majorVersion <= 20
}

if (shouldShowDeprecationWarning()) {
  console.warn(
    `⚠️  Node.js 20 and below are deprecated and will no longer be supported in future versions of @supabase/supabase-js. ` +
      `Please upgrade to Node.js 22 or later. ` +
      `For more information, visit: https://github.com/orgs/supabase/discussions/45715`
  )
}
