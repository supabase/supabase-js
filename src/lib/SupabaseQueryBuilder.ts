import { PostgrestQueryBuilder } from '@supabase/postgrest-js'
import { SupabaseRealtimeClient } from './SupabaseRealtimeClient'
import { RealtimeClient } from '@supabase/realtime-js'
import { Fetch, GenericTable, SupabaseEventTypes, SupabaseRealtimePayload } from './types'

export class SupabaseQueryBuilder<Table extends GenericTable> extends PostgrestQueryBuilder<Table> {
  private _subscription: SupabaseRealtimeClient | null = null
  private _realtime: RealtimeClient
  private _headers: Record<string, string>
  private _schema: string
  private _table: string

  constructor(
    url: URL,
    {
      headers = {},
      fetch,
      realtime,
      schema,
      table,
    }: {
      headers: Record<string, string>
      realtime: RealtimeClient
      table: string
      schema?: string
      fetch?: Fetch
    }
  ) {
    super(new URL(url), { headers, schema, fetch })

    this._realtime = realtime
    this._headers = headers
    this._schema = schema ?? 'public'
    this._table = table
  }

  /**
   * Subscribe to realtime changes in your database.
   * @param event The database event which you would like to receive updates for, or you can use the special wildcard `*` to listen to all changes.
   * @param callback A callback that will handle the payload that is sent whenever your database changes.
   */
  on(
    event: SupabaseEventTypes,
    callback: (payload: SupabaseRealtimePayload<any>) => void
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
