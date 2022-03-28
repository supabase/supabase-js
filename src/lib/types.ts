import { GoTrueClient } from '@supabase/gotrue-js'
import { RealtimeClientOptions } from '@supabase/realtime-js'

type GoTrueClientOptions = ConstructorParameters<typeof GoTrueClient>[0]

export interface SupabaseAuthClientOptions extends GoTrueClientOptions {}

export type GenericObject = { [key: string]: string }

export type Fetch = typeof fetch

export type SupabaseClientOptions = {
  /**
   * The Postgres schema which your tables belong to. Must be on the list of exposed schemas in Supabase. Defaults to 'public'.
   */
  schema?: string
  /**
   * Optional headers for initializing the client.
   */
  headers?: GenericObject
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
   * Options passed to the realtime-js instance
   */
  realtime?: RealtimeClientOptions

  /**
   * A custom `fetch` implementation.
   */
  fetch?: Fetch

  /**
   * Throw errors, instead of returning them.
   */
  shouldThrowOnError?: boolean

  /**
   * Options passed to the gotrue-js instance
   */
  cookieOptions?: SupabaseAuthClientOptions['cookieOptions']
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
