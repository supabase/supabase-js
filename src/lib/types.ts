import { GoTrueClient } from '@supabase/gotrue-js'
import { RealtimeClientOptions } from '@supabase/realtime-js'

type GoTrueClientOptions = ConstructorParameters<typeof GoTrueClient>[0]

export interface SupabaseAuthClientOptions extends GoTrueClientOptions {}

export type GenericObject = { [key: string]: any }

export type Fetch = typeof fetch

export type SupabaseClientOptions<SchemaName> = {
  /**
   * The Postgres schema which your tables belong to. Must be on the list of exposed schemas in Supabase. Defaults to 'public'.
   */
  db?: {
    schema?: SchemaName
  }

  auth?: {
    /**
     * Automatically refreshes the token for logged in users.
     */
    autoRefreshToken?: boolean
    /**
     * Optional key name used for storing tokens in local storage
     */
    storageKey?: string
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
    storage?: SupabaseAuthClientOptions['storage']
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

export type GenericFunction = {
  Args: Record<string, unknown>
  Returns: unknown
}

export type GenericSchema = {
  Tables: Record<string, GenericTable>
  Functions: Record<string, GenericFunction>
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

export type SupabaseEventTypes = 'INSERT' | 'UPDATE' | 'DELETE' | '*'
