import { GoTrueClient } from '@supabase/gotrue-js'
import { RealtimeClientOptions } from '@supabase/realtime-js'

type GoTrueClientOptions = ConstructorParameters<typeof GoTrueClient>[0]

export interface SupabaseAuthClientOptions extends GoTrueClientOptions {}

export type Fetch = typeof fetch

export type SupabaseClientOptions<SchemaName> = {
  /**
   * The Postgres schema which your tables belong to. Must be on the list of exposed schemas in Supabase. Defaults to 'public'.
   */
  db?: {
    schema?: string
  }

  auth?: {
    /**
     * Automatically refreshes the token for logged in users.
     */
    autoRefreshToken?: boolean
    /**
     * Allows to enable/disable multi-tab/window events
     */
    multiTab?: boolean
    /**
     * Whether to persist a logged in session to storage.
     */
    persistSession?: boolean
    /**
     * Detect a session from the URL. Used for OAuth login callbacks.
     */
    detectSessionInUrl?: boolean
    /**
     * A storage provider. Used to store the logged in session.
     */
    localStorage?: SupabaseAuthClientOptions['localStorage']
    /**
     * Options passed to the gotrue-js instance
     */
    cookieOptions?: SupabaseAuthClientOptions['cookieOptions']
  }
  /**
   * Options passed to the realtime-js instance
   */
  realtime?: RealtimeClientOptions
  /**
   * Options passed to the storage-js instance
   */
  // TODO: Add StorageOptions once ready
  storage?: Record<string, string>
  /**
   * Options passed to the functions-js instance
   */
  // TODO: Add Function Options once ready
  functions?: Record<string, string>
  /**
   * A custom `fetch` implementation.
   */
  fetch?: Fetch
  /**
   * Optional headers for initializing the client.
   */
  headers?: Record<string, string>
  /**
   * Throw errors, instead of returning them.
   */
  shouldThrowOnError?: boolean
}

export type SupabaseRealtimePayload<T> = {
  commit_timestamp: string
  eventType: 'INSERT' | 'UPDATE' | 'DELETE'
  schema: string
  table: string
  /** The new record. Present for 'INSERT' and 'UPDATE' events. */
  new: T
  /** The previous record. Present for 'UPDATE' and 'DELETE' events. */
  old: T
  errors: string[] | null
}

export type GenericTable = {
  Row: Record<string, unknown>
  Insert: Record<string, unknown>
  Update: Record<string, unknown>
}

export type GenericFunction = {
  Args: Record<string, unknown>
  Returns: unknown
}

export type GenericSchema = {
  Tables: Record<string, GenericTable>
  Functions: Record<string, GenericFunction>
}
