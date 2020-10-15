// types.ts

export type SupabaseClientOptions = {
  /**
   * The Postgres schema which your tables belong to. Must be on the list of exposed schemas in Supabase.
   */
  schema: string
  /**
   * Optional headers for initializing the client.
   */
  headers?: { [key: string]: string }
  /**
   * Automatically refreshes the token for logged in users.
   */
  autoRefreshToken?: boolean
  /**
   * Whether to persist a logged in session to storage.
   */
  persistSession?: boolean
  /**
   * Detect a session from the URL. Used for OAuth login callbacks.
   */
  detectSessionInUrl?: boolean
}