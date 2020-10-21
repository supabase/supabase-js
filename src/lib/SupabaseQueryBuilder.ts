import { PostgrestQueryBuilder } from '@supabase/postgrest-js'
import { SupabaseRealtimeClient } from './SupabaseRealtimeClient'
import { RealtimeClient } from '@supabase/realtime-js'
import { SupabaseRealtimePayload } from './types'

export class SupabaseQueryBuilder<T> extends PostgrestQueryBuilder<T> {
  private _subscription: SupabaseRealtimeClient
  private _realtime: RealtimeClient

  constructor(
    url: string,
    {
      headers = {},
      schema,
      realtime,
      table,
    }: {
      headers?: { [key: string]: string }
      schema: string
      realtime: RealtimeClient
      table: string
    }
  ) {
    super(url, { headers, schema })

    this._subscription = new SupabaseRealtimeClient(realtime, schema, table)
    this._realtime = realtime
  }

  /**
   * Subscribe to realtime changes in your databse.
   */
  on(
    /** The database event which you would like to receive updates for, or you can use the special wildcard `*` to listen to all changes. */
    event: 'INSERT' | 'UPDATE' | 'DELETE' | '*',
    callback: (payload: SupabaseRealtimePayload<T>) => void
  ): SupabaseRealtimeClient {
    if (!this._realtime.isConnected()) {
      this._realtime.connect()
    }
    return this._subscription.on(event, callback)
  }
}
