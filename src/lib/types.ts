import { GoTrueClient } from '@supabase/gotrue-js'
import { RealtimeClientOptions } from '@supabase/realtime-js'

type GoTrueClientOptions = ConstructorParameters<typeof GoTrueClient>[0]

export interface SupabaseAuthClientOptions extends GoTrueClientOptions {}

export type Fetch = typeof fetch

export type SupabaseClientOptions<SchemaName> = {
  /**
   * The Postgres schema which your tables belong to. Must be on the list of exposed schemas in Supabase. Defaults to `public`.
   */
  db?: {
    schema?: SchemaName
  }

  auth?: {
    /**
     * Automatically refreshes the token for logged-in users. Defaults to true.
     */
    autoRefreshToken?: boolean
    /**
     * Optional key name used for storing tokens in local storage.
     */
    storageKey?: string
    /**
     * Whether to persist a logged-in session to storage. Defaults to true.
     */
    persistSession?: boolean
    /**
     * Detect a session from the URL. Used for OAuth login callbacks. Defaults to true.
     */
    detectSessionInUrl?: boolean
    /**
     * A storage provider. Used to store the logged-in session.
     */
    storage?: SupabaseAuthClientOptions['storage']
    /**
     * OAuth flow to use - defaults to implicit flow. PKCE is recommended for mobile and server-side applications.
     */
    flowType?: SupabaseAuthClientOptions['flowType']
    /**
     * If debug messages for authentication client are emitted. Can be used to inspect the behavior of the library.
     */
    debug?: SupabaseAuthClientOptions['debug']
    /**
     * Provide your own locking mechanism based on the environment. By default no locking is done at this time.
     *
     * @experimental
     */
    lock?: SupabaseAuthClientOptions['lock']
  }
  /**
   * Options passed to the realtime-js instance
   */
  realtime?: RealtimeClientOptions
  global?: {
    /**
     * A custom `fetch` implementation.
     */
    fetch?: Fetch
    /**
     * Optional headers for initializing the client.
     */
    headers?: Record<string, string>
  }
}

export type GenericTable = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
}

export type GenericUpdatableView = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
}

export type GenericNonUpdatableView = {
  Row: Record<string, unknown>
}

export type GenericView = GenericUpdatableView | GenericNonUpdatableView

export type GenericFunction = {
  Args: Record<string, unknown>
  Returns: unknown
}

export type GenericSchema = {
  Tables: Record<string, GenericTable>
  Views: Record<string, GenericView>
  Functions: Record<string, GenericFunction>
}
