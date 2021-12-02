import { DEFAULT_HEADERS, STORAGE_KEY } from './lib/constants'
import { stripTrailingSlash, isBrowser } from './lib/helpers'
import { Fetch, SupabaseClientOptions } from './lib/types'
import { SupabaseAuthClient } from './lib/SupabaseAuthClient'
import { SupabaseQueryBuilder } from './lib/SupabaseQueryBuilder'
import { SupabaseStorageClient } from '@supabase/storage-js'
import { PostgrestClient } from '@supabase/postgrest-js'
import { AuthChangeEvent, Session, Subscription } from '@supabase/gotrue-js'
import { RealtimeClient, RealtimeSubscription, RealtimeClientOptions } from '@supabase/realtime-js'

const DEFAULT_OPTIONS = {
  schema: 'public',
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  multiTab: true,
  headers: DEFAULT_HEADERS,
}

/**
 * Supabase Client.
 *
 * An isomorphic Javascript client for interacting with Postgres.
 */
export default class SupabaseClient {
  /**
   * Supabase Auth allows you to create and manage user sessions for access to data that is secured by access policies.
   */
  auth: SupabaseAuthClient

  protected schema: string
  protected restUrl: string
  protected realtimeUrl: string
  protected authUrl: string
  protected storageUrl: string
  protected realtime: RealtimeClient
  protected multiTab: boolean
  protected fetch?: Fetch
  protected changedAccessToken: string | undefined
  protected headers: {
    [key: string]: string
  }

  /**
   * Create a new client for use in the browser.
   * @param supabaseUrl The unique Supabase URL which is supplied when you create a new project in your project dashboard.
   * @param supabaseKey The unique Supabase Key which is supplied when you create a new project in your project dashboard.
   * @param options.schema You can switch in between schemas. The schema needs to be on the list of exposed schemas inside Supabase.
   * @param options.autoRefreshToken Set to "true" if you want to automatically refresh the token before expiring.
   * @param options.persistSession Set to "true" if you want to automatically save the user session into local storage.
   * @param options.detectSessionInUrl Set to "true" if you want to automatically detects OAuth grants in the URL and signs in the user.
   * @param options.headers Any additional headers to send with each network request.
   * @param options.realtime Options passed along to realtime-js constructor.
   * @param options.multiTab Set to "false" if you want to disable multi-tab/window events.
   * @param options.fetch A custom fetch implementation.
   */
  constructor(
    protected supabaseUrl: string,
    protected supabaseKey: string,
    options?: SupabaseClientOptions
  ) {
    if (!supabaseUrl) throw new Error('supabaseUrl is required.')
    if (!supabaseKey) throw new Error('supabaseKey is required.')

    supabaseUrl = stripTrailingSlash(supabaseUrl)

    const settings = { ...DEFAULT_OPTIONS, ...options }
    this.restUrl = `${supabaseUrl}/rest/v1`
    this.realtimeUrl = `${supabaseUrl}/realtime/v1`.replace('http', 'ws')
    this.authUrl = `${supabaseUrl}/auth/v1`
    this.storageUrl = `${supabaseUrl}/storage/v1`
    this.schema = settings.schema
    this.multiTab = settings.multiTab
    this.fetch = settings.fetch
    this.headers = { ...DEFAULT_HEADERS, ...options?.headers }

    this.auth = this._initSupabaseAuthClient(settings)
    this.realtime = this._initRealtimeClient({ headers: this.headers, ...settings.realtime })

    this._listenForAuthEvents()
    this._listenForMultiTabEvents()

    // In the future we might allow the user to pass in a logger to receive these events.
    // this.realtime.onOpen(() => console.log('OPEN'))
    // this.realtime.onClose(() => console.log('CLOSED'))
    // this.realtime.onError((e: Error) => console.log('Socket error', e))
  }

  /**
   * Supabase Storage allows you to manage user-generated content, such as photos or videos.
   */
  get storage() {
    return new SupabaseStorageClient(this.storageUrl, this._getAuthHeaders(), this.fetch)
  }

  /**
   * Perform a table operation.
   *
   * @param table The table name to operate on.
   */
  from<T = any>(table: string): SupabaseQueryBuilder<T> {
    const url = `${this.restUrl}/${table}`
    return new SupabaseQueryBuilder<T>(url, {
      headers: this._getAuthHeaders(),
      schema: this.schema,
      realtime: this.realtime,
      table,
      fetch: this.fetch,
    })
  }

  /**
   * Perform a function call.
   *
   * @param fn  The function name to call.
   * @param params  The parameters to pass to the function call.
   * @param head   When set to true, no data will be returned.
   * @param count  Count algorithm to use to count rows in a table.
   *
   */
  rpc<T = any>(
    fn: string,
    params?: object,
    {
      head = false,
      count = null,
    }: { head?: boolean; count?: null | 'exact' | 'planned' | 'estimated' } = {}
  ) {
    const rest = this._initPostgRESTClient()
    return rest.rpc<T>(fn, params, { head, count })
  }

  /**
   * Remove all active subscriptions.
   */
  removeAllSubscriptions() {
    this.realtime.channels.forEach((sub) => {
      this.removeSubscription(sub)
    })
  }

  /**
   * Removes an active subscription and returns the number of open connections.
   *
   * @param subscription The subscription you want to remove.
   */
  removeSubscription(subscription: RealtimeSubscription) {
    return new Promise(async (resolve) => {
      try {
        await this._closeSubscription(subscription)

        const openSubscriptions = this.getSubscriptions().length
        if (!openSubscriptions) {
          const { error } = await this.realtime.disconnect()
          if (error) return resolve({ error })
        }
        return resolve({ error: null, data: { openSubscriptions } })
      } catch (error) {
        return resolve({ error })
      }
    })
  }

  private async _closeSubscription(subscription: RealtimeSubscription) {
    if (!subscription.isClosed()) {
      await this._closeChannel(subscription)
    }
  }

  /**
   * Returns an array of all your subscriptions.
   */
  getSubscriptions(): RealtimeSubscription[] {
    return this.realtime.channels
  }

  private _initSupabaseAuthClient({
    autoRefreshToken,
    persistSession,
    detectSessionInUrl,
    localStorage,
    headers,
    fetch,
  }: SupabaseClientOptions) {
    const authHeaders = {
      Authorization: `Bearer ${this.supabaseKey}`,
      apikey: `${this.supabaseKey}`,
    }
    return new SupabaseAuthClient({
      url: this.authUrl,
      headers: { ...headers, ...authHeaders },
      autoRefreshToken,
      persistSession,
      detectSessionInUrl,
      localStorage,
      fetch,
    })
  }

  private _initRealtimeClient(options?: RealtimeClientOptions) {
    return new RealtimeClient(this.realtimeUrl, {
      ...options,
      params: { ...options?.params, apikey: this.supabaseKey },
    })
  }

  private _initPostgRESTClient() {
    return new PostgrestClient(this.restUrl, {
      headers: this._getAuthHeaders(),
      schema: this.schema,
      fetch: this.fetch,
    })
  }

  private _getAuthHeaders(): { [key: string]: string } {
    const headers: { [key: string]: string } = this.headers
    const authBearer = this.auth.session()?.access_token ?? this.supabaseKey
    headers['apikey'] = this.supabaseKey
    headers['Authorization'] = `Bearer ${authBearer}`
    return headers
  }

  private _closeChannel(subscription: RealtimeSubscription) {
    return new Promise((resolve, reject) => {
      subscription
        .unsubscribe()
        .receive('ok', () => {
          this.realtime.remove(subscription)
          return resolve(true)
        })
        .receive('error', (e: Error) => reject(e))
    })
  }

  private _listenForMultiTabEvents() {
    if (!this.multiTab || !isBrowser() || !window?.addEventListener) {
      return null
    }

    try {
      return window?.addEventListener('storage', (e: StorageEvent) => {
        if (e.key === STORAGE_KEY) {
          const newSession = JSON.parse(String(e.newValue))
          const accessToken: string | undefined =
            newSession?.currentSession?.access_token ?? undefined
          const previousAccessToken = this.auth.session()?.access_token
          if (!accessToken) {
            this._handleTokenChanged('SIGNED_OUT', accessToken, 'STORAGE')
          } else if (!previousAccessToken && accessToken) {
            this._handleTokenChanged('SIGNED_IN', accessToken, 'STORAGE')
          } else if (previousAccessToken !== accessToken) {
            this._handleTokenChanged('TOKEN_REFRESHED', accessToken, 'STORAGE')
          }
        }
      })
    } catch (error) {
      console.error('_listenForMultiTabEvents', error)
      return null
    }
  }

  private _listenForAuthEvents() {
    let { data } = this.auth.onAuthStateChange((event, session) => {
      this._handleTokenChanged(event, session?.access_token, 'CLIENT')
    })
    return data
  }

  private _handleTokenChanged(
    event: AuthChangeEvent,
    token: string | undefined,
    source: 'CLIENT' | 'STORAGE'
  ) {
    if (
      (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') &&
      this.changedAccessToken !== token
    ) {
      // Token has changed
      this.realtime.setAuth(token!)
      // Ideally we should call this.auth.recoverSession() - need to make public
      // to trigger a "SIGNED_IN" event on this client.
      if (source == 'STORAGE') this.auth.setAuth(token!)

      this.changedAccessToken = token
    } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
      // Token is removed
      this.removeAllSubscriptions()
      if (source == 'STORAGE') this.auth.signOut()
    }
  }
}
