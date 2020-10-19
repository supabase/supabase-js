import { PostgrestClient, PostgrestFilterBuilder } from '@supabase/postgrest-js'
import { SupabaseRealtimeClient } from './SupabaseRealtimeClient'

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

export type SupabaseQueryClient<T> = {
  rest: PostgrestClient
  subscription: SupabaseRealtimeClient
  /**
   * Read data.
   */
  select(
    /**
     * A comma separated list of columns. For example `.select('id, name')`.
     *
     * Omitting `columnQuery` is equal to `.select('*')`.
     */
    columnQuery?: string
  ): PostgrestFilterBuilder<T>
  /**
   * Insert or upsert data.
   */
  insert(
    /**
     * A single object or an array of rows of type object which contain information to be saved into the selected table.
     */
    data: T | T[],
    /**
     * For upsert, if set to true, primary key columns would need to be included in the data parameter in order for an update to properly happen. Also, primary keys used must be natural, not surrogate.
     */
    options?: { upsert?: boolean }
  ): PostgrestFilterBuilder<T>
  /**
   * Update data.
   *
   * It is to note that it is required to apply filters when using `.update()`. Not using filters would result in an error.
   *
   * Example: `supabase.from('cities').update({ name: 'Middle Earth' }).match({ name: 'Auckland' })`
   */
  update(data: T): PostgrestFilterBuilder<T>
  /**
   * Delete data.
   *
   * It is required to apply filters when using `.delete()`. Not using filters would result in an error.
   *
   * Example: `supabase.from('cities').delete().match({ name: 'Bielefeld' })`
   */
  delete(): PostgrestFilterBuilder<T>
  /**
   * Subscribe to realtime changes in your databse.
   */
  on(
    /** The database event which you would like to receive updates for, or you can use the special wildcard `*` to listen to all changes. */
    eventType: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    callbackFunction: (payload: SupabaseRealtimePayload<T>) => void
  ): SupabaseRealtimeClient
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
}
