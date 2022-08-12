import { FunctionsClient } from '@supabase/functions-js'
import { AuthChangeEvent } from '@supabase/gotrue-js'
import {
  PostgrestClient,
  PostgrestFilterBuilder,
  PostgrestQueryBuilder,
} from '@supabase/postgrest-js'
import { RealtimeChannel, RealtimeClient, RealtimeClientOptions } from '@supabase/realtime-js'
import { SupabaseStorageClient } from '@supabase/storage-js'
import { DEFAULT_HEADERS } from './lib/constants'
import { fetchWithAuth } from './lib/fetch'
import { stripTrailingSlash } from './lib/helpers'
import { SupabaseAuthClient } from './lib/SupabaseAuthClient'
import { SupabaseRealtimeChannel } from './lib/SupabaseRealtimeChannel'
import { Fetch, GenericSchema, SupabaseClientOptions, SupabaseAuthClientOptions } from './lib/types'

const DEFAULT_OPTIONS = {
  schema: 'public',
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
  headers: DEFAULT_HEADERS,
}

/**
 * Supabase Client.
 *
 * An isomorphic Javascript client for interacting with Postgres.
 */
export default class SupabaseClient<
  Database = any,
  SchemaName extends string & keyof Database = 'public' extends keyof Database
    ? 'public'
    : string & keyof Database,
  Schema extends GenericSchema = Database[SchemaName] extends GenericSchema
    ? Database[SchemaName]
    : any
> {
  /**
   * Supabase Auth allows you to create and manage user sessions for access to data that is secured by access policies.
   */
  auth: SupabaseAuthClient

  protected realtimeUrl: string
  protected authUrl: string
  protected storageUrl: string
  protected functionsUrl: string
  protected realtime: RealtimeClient
  protected rest: PostgrestClient<Database, SchemaName>
  protected storageKey: string
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
   * @param options.fetch A custom fetch implementation.
   */
  constructor(
    protected supabaseUrl: string,
    protected supabaseKey: string,
    options?: SupabaseClientOptions<SchemaName>
  ) {
    if (!supabaseUrl) throw new Error('supabaseUrl is required.')
    if (!supabaseKey) throw new Error('supabaseKey is required.')

    const _supabaseUrl = stripTrailingSlash(supabaseUrl)

    this.realtimeUrl = `${_supabaseUrl}/realtime/v1`.replace('http', 'ws')
    this.authUrl = `${_supabaseUrl}/auth/v1`
    this.storageUrl = `${_supabaseUrl}/storage/v1`

    const isPlatform = _supabaseUrl.match(/(supabase\.co)|(supabase\.in)/)
    if (isPlatform) {
      const urlParts = _supabaseUrl.split('.')
      this.functionsUrl = `${urlParts[0]}.functions.${urlParts[1]}.${urlParts[2]}`
    } else {
      this.functionsUrl = `${_supabaseUrl}/functions/v1`
    }
    // default storage key uses the supabase project ref as a namespace
    const defaultStorageKey = `sb-${new URL(this.authUrl).hostname.split('.')[0]}-auth-token`
    this.storageKey = options?.auth?.storageKey ?? defaultStorageKey

    const settings = { ...DEFAULT_OPTIONS, ...options, storageKey: this.storageKey }

    this.headers = { ...DEFAULT_HEADERS, ...options?.headers }

    this.auth = this._initSupabaseAuthClient(settings.auth || {}, this.headers, settings.fetch)
    this.fetch = fetchWithAuth(supabaseKey, this._getAccessToken.bind(this), settings.fetch)

    this.realtime = this._initRealtimeClient({ headers: this.headers, ...settings.realtime })
    this.rest = new PostgrestClient(`${_supabaseUrl}/rest/v1`, {
      headers: this.headers,
      schema: options?.db?.schema,
      fetch: this.fetch,
    })

    this._listenForAuthEvents()

    // In the future we might allow the user to pass in a logger to receive these events.
    // this.realtime.onOpen(() => console.log('OPEN'))
    // this.realtime.onClose(() => console.log('CLOSED'))
    // this.realtime.onError((e: Error) => console.log('Socket error', e))
  }

  /**
   * Supabase Functions allows you to deploy and invoke edge functions.
   */
  get functions() {
    return new FunctionsClient(this.functionsUrl, {
      headers: this.headers,
      customFetch: this.fetch,
    })
  }

  /**
   * Supabase Storage allows you to manage user-generated content, such as photos or videos.
   */
  get storage() {
    return new SupabaseStorageClient(this.storageUrl, this.headers, this.fetch)
  }

  /**
   * Perform a table operation.
   *
   * @param table The table name to operate on.
   */
  from<
    TableName extends string & keyof Schema['Tables'],
    Table extends Schema['Tables'][TableName]
  >(table: TableName): PostgrestQueryBuilder<Table> {
    return this.rest.from(table)
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
  rpc<
    FunctionName extends string & keyof Schema['Functions'],
    Function_ extends Schema['Functions'][FunctionName]
  >(
    fn: FunctionName,
    args: Function_['Args'] = {},
    options?: {
      head?: boolean
      count?: 'exact' | 'planned' | 'estimated'
    }
  ): PostgrestFilterBuilder<
    Function_['Returns'] extends any[]
      ? Function_['Returns'][number] extends Record<string, unknown>
        ? Function_['Returns'][number]
        : never
      : never,
    Function_['Returns']
  > {
    return this.rest.rpc(fn, args, options)
  }

  /**
   * Creates a channel with Broadcast and Presence.
   */
  channel(name: string, opts?: { [key: string]: any }): SupabaseRealtimeChannel {
    if (!this.realtime.isConnected()) {
      this.realtime.connect()
    }

    return new SupabaseRealtimeChannel(name, opts, this.realtime)
  }

  /**
   * Closes and removes all channels and returns a list of removed
   * channels and their errors.
   */
  async removeAllChannels(): Promise<
    { data: { channels: RealtimeChannel }; error: Error | null }[]
  > {
    const allChans: RealtimeChannel[] = this.getChannels().slice()
    const allChanPromises = allChans.map((chan) => this.removeChannel(chan))
    const allRemovedChans = await Promise.all(allChanPromises)

    return allRemovedChans.map(({ error }, i) => {
      return {
        data: { channels: allChans[i] },
        error,
      }
    })
  }

  /**
   * Closes and removes a channel and returns the number of open channels.
   *
   * @param channel The channel you want to close and remove.
   */
  async removeChannel(
    channel: RealtimeChannel
  ): Promise<{ data: { openChannels: number }; error: Error | null }> {
    const { error } = await this._closeChannel(channel)
    const allChans: RealtimeChannel[] = this.getChannels()
    const openChanCount = allChans.filter((chan) => chan.isJoined()).length

    if (allChans.length === 0) await this.realtime.disconnect()

    return { data: { openChannels: openChanCount }, error }
  }

  private async _getAccessToken() {
    const { session } = await this.auth.getSession()

    return session?.access_token ?? null
  }

  private async _closeChannel(channel: RealtimeChannel): Promise<{ error: Error | null }> {
    let error = null

    if (!channel.isClosed()) {
      const { error: unsubError } = await this._unsubscribeChannel(channel)
      error = unsubError
    }

    this.realtime.remove(channel)

    return { error }
  }

  private _unsubscribeChannel(channel: RealtimeChannel): Promise<{ error: Error | null }> {
    return new Promise((resolve) => {
      channel
        .unsubscribe()
        .receive('ok', () => resolve({ error: null }))
        .receive('error', (error: Error) => resolve({ error }))
        .receive('timeout', () => resolve({ error: new Error('timed out') }))
    })
  }

  /**
   * Returns an array of all your channels.
   */
  getChannels(): RealtimeChannel[] {
    return this.realtime.channels as RealtimeChannel[]
  }

  private _initSupabaseAuthClient(
    {
      autoRefreshToken,
      persistSession,
      detectSessionInUrl,
      storage,
      cookieOptions,
      storageKey,
    }: SupabaseAuthClientOptions,
    headers?: Record<string, string>,
    fetch?: Fetch
  ) {
    const authHeaders = {
      Authorization: `Bearer ${this.supabaseKey}`,
      apikey: `${this.supabaseKey}`,
    }
    return new SupabaseAuthClient({
      url: this.authUrl,
      headers: { ...headers, ...authHeaders },
      storageKey: storageKey,
      autoRefreshToken,
      persistSession,
      detectSessionInUrl,
      storage,
      fetch,
      cookieOptions,
    })
  }

  private _initRealtimeClient(options?: RealtimeClientOptions) {
    return new RealtimeClient(this.realtimeUrl, {
      ...options,
      params: { ...{ apikey: this.supabaseKey, vsndate: '2022' }, ...options?.params },
    })
  }

  private _listenForAuthEvents() {
    let data = this.auth.onAuthStateChange((event, session) => {
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

      this.changedAccessToken = token
    } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
      // Token is removed
      this.realtime.setAuth(this.supabaseKey)
      if (source == 'STORAGE') this.auth.signOut()
    }
  }
}
