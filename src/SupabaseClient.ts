import { FunctionsClient } from '@supabase/functions-js'
import { AuthChangeEvent } from '@supabase/gotrue-js'
import {
  PostgrestClient,
  PostgrestFilterBuilder,
  PostgrestQueryBuilder,
} from '@supabase/postgrest-js'
import {
  RealtimeChannel,
  RealtimeChannelOptions,
  RealtimeClient,
  RealtimeClientOptions,
} from '@supabase/realtime-js'
import { StorageClient as SupabaseStorageClient } from '@supabase/storage-js'
import { DEFAULT_HEADERS } from './lib/constants'
import { fetchWithAuth } from './lib/fetch'
import { stripTrailingSlash, applySettingDefaults } from './lib/helpers'
import { SupabaseAuthClient } from './lib/SupabaseAuthClient'
import { Fetch, GenericSchema, SupabaseClientOptions, SupabaseAuthClientOptions } from './lib/types'

const DEFAULT_GLOBAL_OPTIONS = {
  headers: DEFAULT_HEADERS,
}

const DEFAULT_DB_OPTIONS = {
  schema: 'public',
}

const DEFAULT_AUTH_OPTIONS: SupabaseAuthClientOptions = {
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: true,
}

const DEFAULT_REALTIME_OPTIONS: RealtimeClientOptions = {}

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
   * @param options.db.schema You can switch in between schemas. The schema needs to be on the list of exposed schemas inside Supabase.
   * @param options.auth.autoRefreshToken Set to "true" if you want to automatically refresh the token before expiring.
   * @param options.auth.persistSession Set to "true" if you want to automatically save the user session into local storage.
   * @param options.auth.detectSessionInUrl Set to "true" if you want to automatically detects OAuth grants in the URL and signs in the user.
   * @param options.realtime Options passed along to realtime-js constructor.
   * @param options.global.fetch A custom fetch implementation.
   * @param options.global.headers Any additional headers to send with each network request.
   */
  constructor(
    protected supabaseUrl: string,
    protected supabaseKey: string,
    options?: SupabaseClientOptions<SchemaName>
  ) {
    if (!supabaseUrl) throw new Error('supabaseUrl is required.')
    if (!supabaseKey) throw new Error('supabaseKey is required.')

    const _supabaseUrl = stripTrailingSlash(supabaseUrl)

    this.realtimeUrl = `${_supabaseUrl}/realtime/v1`.replace(/^http/i, 'ws')
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
    const DEFAULTS = {
      db: DEFAULT_DB_OPTIONS,
      realtime: DEFAULT_REALTIME_OPTIONS,
      auth: { ...DEFAULT_AUTH_OPTIONS, storageKey: defaultStorageKey },
      global: DEFAULT_GLOBAL_OPTIONS,
    }

    const settings = applySettingDefaults(options ?? {}, DEFAULTS)

    this.storageKey = settings.auth?.storageKey ?? ''
    this.headers = settings.global?.headers ?? {}

    this.auth = this._initSupabaseAuthClient(
      settings.auth ?? {},
      this.headers,
      settings.global?.fetch
    )
    this.fetch = fetchWithAuth(supabaseKey, this._getAccessToken.bind(this), settings.global?.fetch)

    this.realtime = this._initRealtimeClient({ headers: this.headers, ...settings.realtime })
    this.rest = new PostgrestClient(`${_supabaseUrl}/rest/v1`, {
      headers: this.headers,
      schema: settings.db?.schema,
      fetch: this.fetch,
    })

    this._listenForAuthEvents()
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
  >(relation: TableName): PostgrestQueryBuilder<Schema, Table>
  from<ViewName extends string & keyof Schema['Views'], View extends Schema['Views'][ViewName]>(
    relation: ViewName
  ): PostgrestQueryBuilder<Schema, View>
  from(relation: string): PostgrestQueryBuilder<Schema, any>
  from(relation: string): PostgrestQueryBuilder<Schema, any> {
    return this.rest.from(relation)
  }

  /**
   * Perform a function call.
   *
   * @param fn  The function name to call.
   * @param args  The parameters to pass to the function call.
   * @param options.head   When set to true, no data will be returned.
   * @param options.count  Count algorithm to use to count rows in a table.
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
    Schema,
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
   * Creates a Realtime channel with Broadcast, Presence, and Postgres Changes.
   *
   * @param {string} name - The name of the Realtime channel.
   * @param {Object} opts - The options to pass to the Realtime channel.
   *
   */
  channel(name: string, opts: RealtimeChannelOptions = { config: {} }): RealtimeChannel {
    return this.realtime.channel(name, opts)
  }

  /**
   * Returns all Realtime channels.
   */
  getChannels(): RealtimeChannel[] {
    return this.realtime.getChannels()
  }

  /**
   * Unsubscribes and removes Realtime channel from Realtime client.
   *
   * @param {RealtimeChannel} channel - The name of the Realtime channel.
   *
   */
  removeChannel(channel: RealtimeChannel): Promise<'ok' | 'timed out' | 'error'> {
    return this.realtime.removeChannel(channel)
  }

  /**
   * Unsubscribes and removes all Realtime channels from Realtime client.
   */
  removeAllChannels(): Promise<('ok' | 'timed out' | 'error')[]> {
    return this.realtime.removeAllChannels()
  }

  private async _getAccessToken() {
    const { data } = await this.auth.getSession()

    return data.session?.access_token ?? null
  }

  private _initSupabaseAuthClient(
    {
      autoRefreshToken,
      persistSession,
      detectSessionInUrl,
      storage,
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
      headers: { ...authHeaders, ...headers },
      storageKey: storageKey,
      autoRefreshToken,
      persistSession,
      detectSessionInUrl,
      storage,
      fetch,
    })
  }

  private _initRealtimeClient(options: RealtimeClientOptions) {
    return new RealtimeClient(this.realtimeUrl, {
      ...options,
      params: { ...{ apikey: this.supabaseKey }, ...options?.params },
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
      this.realtime.setAuth(token ?? null)

      this.changedAccessToken = token
    } else if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
      // Token is removed
      this.realtime.setAuth(this.supabaseKey)
      if (source == 'STORAGE') this.auth.signOut()
      this.changedAccessToken = undefined
    }
  }
}
