import { DEFAULT_HEADERS } from './lib/constants'
import { SupabaseClientOptions } from './lib/types'
import { Client as GoTrueClient } from '@supabase/gotrue-js'
import { PostgrestClient } from '@supabase/postgrest-js'
import { Socket as RealtimeSocket } from '@supabase/realtime-js'

const DEFAULT_OPTIONS = {
  schema: 'public',
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  headers: DEFAULT_HEADERS,
}

export default class Client {
  schema: string
  restUrl: string
  realtimeUrl: string
  authUrl: string
  auth: GoTrueClient
  realtime: RealtimeSocket

  /**
   * Create a new client for use in the browser.
   * @param supabaseUrl The unique Supabase URL which is supplied when you create a new project in your project dashboard.
   * @param supabaseKey The unique Supabase Key which is supplied when you create a new project in your project dashboard.
   * @param options.schema You can switch in between schemas. The schema needs to be on the list of exposed schemas inside Supabase.
   * @param options.autoRefreshToken Set to "true" if you want to automatically refresh the token before expiring.
   * @param options.persistSession Set to "true" if you want to automatically save the user session into local storage.
   * @param options.detectSessionInUrl Set to "true" if you want to automatically detects OAuth grants in the URL and signs in the user.
   * @param options.headers Any additional headers to send with each network request.
   */
  constructor(
    public supabaseUrl: string,
    public supabaseKey: string,
    options?: SupabaseClientOptions
  ) {
    if (!supabaseUrl) throw new Error('supabaseUrl is required.')
    if (!supabaseKey) throw new Error('supabaseKey is required.')

    const settings = { ...DEFAULT_OPTIONS, ...options }
    this.restUrl = `${supabaseUrl}/rest/v1`
    this.realtimeUrl = `${supabaseUrl}/realtime/v1`.replace('http', 'ws')
    this.authUrl = `${supabaseUrl}/auth/v1`
    this.schema = settings.schema

    this.auth = this._initGoTrueClient(settings)
    this.realtime = this._initRealtimeClient()

    this.realtime.onOpen(() => console.log('OPEN'))
    this.realtime.onClose(() => console.log('CLOSED'))
    this.realtime.onError((e: Error) => console.log('Socket error', e.message))
  }

  rpc(tableName: string): any {
    return this._initPostgRESTClient().rpc(tableName)
  }

  from(tableName: string): any {
    // At this point, we don't know whether the user is going to
    // make a call to Realtime or to PostgREST, so we need to do
    // an intermdiary step where we return both.
    // We have to make sure "this" is bound correctly on each part.
    let realtimeTopic =
      tableName == '*'
        ? `realtime:${this.schema}`
        : `realtime:${this.schema}:${tableName}`
    let rest = this._initPostgRESTClient()
    let subscription = this.realtime.channel(realtimeTopic)
    const builder = {
      rest,
      subscription,
      select: (columns: string) => {
        return rest.from(tableName).select(columns)
      },
      insert: (values: any, options: any) => {
        return rest.from(tableName).insert(values, options)
      },
      update: (values: any) => {
        return rest.from(tableName).update(values)
      },
      delete: () => {
        return rest.from(tableName).delete()
      },
      on: (event: string, callback: Function) => {
        if (!this.realtime.isConnected()) {
          this.realtime.connect()
        }
        subscription.on(event, callback)
        // Phoenix doesn't allow multiple subscriptions to the same topic (table)
        // so we return the channel so that we can chain on() events.
        return builder
      },
      subscribe(callback: Function = () => {}) {
        subscription.onError((e: Error) => callback('SUBSCRIPTION_ERROR', e))
        subscription.onClose(() => callback('CLOSED'))
        subscription
          .subscribe()
          .receive('ok', () => callback('SUBSCRIBED'))
          .receive('error', (e: Error) => callback('SUBSCRIPTION_ERROR', e))
          .receive('timeout', () => callback('RETRYING_AFTER_TIMEOUT'))
        return builder
      },
      unsubscribe() {
        if (!subscription.isClosed()) {
          subscription.unsubscribe()
          return { error: null }
        } else {
          return { error: new Error('Subscription already closed.') }
        }
      },
    }
    return builder
  }

  private _initGoTrueClient(settings: SupabaseClientOptions) {
    return new GoTrueClient({
      url: this.authUrl,
      headers: {
        Authorization: `Bearer ${this.supabaseKey}`,
        apikey: `${this.supabaseKey}`,
      },
      autoRefreshToken: settings.autoRefreshToken,
      persistSession: settings.persistSession,
      detectSessionInUrl: settings.detectSessionInUrl,
    })
  }
  private _initRealtimeClient() {
    return new RealtimeSocket(this.realtimeUrl, {
      params: { apikey: this.supabaseKey },
    })
  }
  private _initPostgRESTClient() {
    return new PostgrestClient(this.restUrl, {
      headers: this._getAuthHeaders(),
      schema: this.schema,
    })
  }

  private _getAuthHeaders(): { [key: string]: string } {
    let headers: { [key: string]: string } = {}
    let authBearer = this.auth.currentSession?.access_token || this.supabaseKey
    headers['apikey'] = this.supabaseKey
    headers['Authorization'] = `Bearer ${authBearer}`
    return headers
  }
}
