import { PostgrestQueryBuilder } from '@supabase/postgrest-js'
import { SupabaseRealtimeClient } from './SupabaseRealtimeClient'
import { RealtimeClient } from '@supabase/realtime-js'
import { Fetch, GenericObject, SupabaseEventTypes, SupabaseRealtimePayload } from './types'

export class SupabaseQueryBuilder<T> extends PostgrestQueryBuilder<T> {
  private _subscription: SupabaseRealtimeClient | null = null
  private _realtime: RealtimeClient
  private _headers: GenericObject
  private _schema: string
  private _table: string

  constructor(
    url: string,
    {
      headers = {},
      schema,
      realtime,
      table,
      fetch,
      shouldThrowOnError,
    }: {
      headers?: GenericObject
      schema: string
      realtime: RealtimeClient
      table: string
      fetch?: Fetch
      shouldThrowOnError?: boolean
    }
  ) {
    super(url, { headers, schema, fetch, shouldThrowOnError })

    this._realtime = realtime
    this._headers = headers
    this._schema = schema
    this._table = table
  }

  /**
   * Subscribe to realtime changes in your database.
   * @param event The database event which you would like to receive updates for, or you can use the special wildcard `*` to listen to all changes.
   * @param callback A callback that will handle the payload that is sent whenever your database changes.
   */
  on(
    event: SupabaseEventTypes,
    callback: (payload: SupabaseRealtimePayload<T>) => void
  ): SupabaseRealtimeClient {
    if (!this._realtime.isConnected()) {
      this._realtime.connect()
    }
    if (!this._subscription) {
      this._subscription = new SupabaseRealtimeClient(
        this._realtime,
        this._headers,
        this._schema,
        this._table
      )
    }
    return this._subscription.on(event, callback)
  }
}
