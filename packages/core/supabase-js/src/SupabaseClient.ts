import type { AuthChangeEvent } from '@supabase/auth-js'
import { FunctionsClient } from '@supabase/functions-js'
import {
  PostgrestClient,
  type PostgrestFilterBuilder,
  type PostgrestQueryBuilder,
} from '@supabase/postgrest-js'
import {
  type RealtimeChannel,
  type RealtimeChannelOptions,
  RealtimeClient,
  type RealtimeClientOptions,
} from '@supabase/realtime-js'
import { StorageClient as SupabaseStorageClient } from '@supabase/storage-js'
import {
  DEFAULT_AUTH_OPTIONS,
  DEFAULT_DB_OPTIONS,
  DEFAULT_GLOBAL_OPTIONS,
  DEFAULT_REALTIME_OPTIONS,
} from './lib/constants'
import { fetchWithAuth } from './lib/fetch'
import { applySettingDefaults, validateSupabaseUrl } from './lib/helpers'
import { SupabaseAuthClient } from './lib/SupabaseAuthClient'
import type {
  Fetch,
  GenericSchema,
  SupabaseAuthClientOptions,
  SupabaseClientOptions,
} from './lib/types'
import { GetRpcFunctionFilterBuilderByArgs } from './lib/rest/types/common/rpc'

/**
 * Supabase Client.
 *
 * An isomorphic Javascript client for interacting with Postgres.
 */
export default class SupabaseClient<
  Database = any,
  // The second type parameter is also used for specifying db_schema, so we
  // support both cases.
  // TODO: Allow setting db_schema from ClientOptions.
  SchemaNameOrClientOptions extends
    | (string & keyof Omit<Database, '__InternalSupabase'>)
    | { PostgrestVersion: string } = 'public' extends keyof Omit<Database, '__InternalSupabase'>
    ? 'public'
    : string & keyof Omit<Database, '__InternalSupabase'>,
  SchemaName extends string &
    keyof Omit<Database, '__InternalSupabase'> = SchemaNameOrClientOptions extends string &
    keyof Omit<Database, '__InternalSupabase'>
    ? SchemaNameOrClientOptions
    : 'public' extends keyof Omit<Database, '__InternalSupabase'>
      ? 'public'
      : string & keyof Omit<Omit<Database, '__InternalSupabase'>, '__InternalSupabase'>,
  Schema extends Omit<Database, '__InternalSupabase'>[SchemaName] extends GenericSchema
    ? Omit<Database, '__InternalSupabase'>[SchemaName]
    : never = Omit<Database, '__InternalSupabase'>[SchemaName] extends GenericSchema
    ? Omit<Database, '__InternalSupabase'>[SchemaName]
    : never,
  ClientOptions extends { PostgrestVersion: string } = SchemaNameOrClientOptions extends string &
    keyof Omit<Database, '__InternalSupabase'>
    ? // If the version isn't explicitly set, look for it in the __InternalSupabase object to infer the right version
      Database extends { __InternalSupabase: { PostgrestVersion: string } }
      ? Database['__InternalSupabase']
      : // otherwise default to 12
        { PostgrestVersion: '12' }
    : SchemaNameOrClientOptions extends { PostgrestVersion: string }
      ? SchemaNameOrClientOptions
      : never,
> {
  /**
   * Supabase Auth allows you to create and manage user sessions for access to data that is secured by access policies.
   */
  auth: SupabaseAuthClient
  realtime: RealtimeClient
  /**
   * Supabase Storage allows you to manage user-generated content, such as photos or videos.
   */
  storage: SupabaseStorageClient

  protected realtimeUrl: URL
  protected authUrl: URL
  protected storageUrl: URL
  protected functionsUrl: URL
  protected rest: PostgrestClient<Database, ClientOptions, SchemaName>
  protected storageKey: string
  protected fetch?: Fetch
  protected changedAccessToken?: string
  protected accessToken?: () => Promise<string | null>

  protected headers: Record<string, string>

  /**
   * Create a new client for use in the browser.
   *
   * @category Initializing
   *
   * @param supabaseUrl The unique Supabase URL which is supplied when you create a new project in your project dashboard.
   * @param supabaseKey The unique Supabase Key which is supplied when you create a new project in your project dashboard.
   * @param options.db.schema You can switch in between schemas. The schema needs to be on the list of exposed schemas inside Supabase.
   * @param options.auth.autoRefreshToken Set to "true" if you want to automatically refresh the token before expiring.
   * @param options.auth.persistSession Set to "true" if you want to automatically save the user session into local storage.
   * @param options.auth.detectSessionInUrl Set to "true" if you want to automatically detects OAuth grants in the URL and signs in the user.
   * @param options.realtime Options passed along to realtime-js constructor.
   * @param options.storage Options passed along to the storage-js constructor.
   * @param options.global.fetch A custom fetch implementation.
   * @param options.global.headers Any additional headers to send with each network request.
   *
   * @example Creating a client
   * ```js
   * import { createClient } from '@supabase/supabase-js'
   *
   * // Create a single supabase client for interacting with your database
   * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key')
   * ```
   *
   * @example With a custom domain
   * ```js
   * import { createClient } from '@supabase/supabase-js'
   *
   * // Use a custom domain as the supabase URL
   * const supabase = createClient('https://my-custom-domain.com', 'publishable-or-anon-key')
   * ```
   *
   * @example With additional parameters
   * ```js
   * import { createClient } from '@supabase/supabase-js'
   *
   * const options = {
   *   db: {
   *     schema: 'public',
   *   },
   *   auth: {
   *     autoRefreshToken: true,
   *     persistSession: true,
   *     detectSessionInUrl: true
   *   },
   *   global: {
   *     headers: { 'x-my-custom-header': 'my-app-name' },
   *   },
   * }
   * const supabase = createClient("https://xyzcompany.supabase.co", "publishable-or-anon-key", options)
   * ```
   *
   * @exampleDescription With custom schemas
   * By default the API server points to the `public` schema. You can enable other database schemas within the Dashboard.
   * Go to [Settings > API > Exposed schemas](/dashboard/project/_/settings/api) and add the schema which you want to expose to the API.
   *
   * Note: each client connection can only access a single schema, so the code above can access the `other_schema` schema but cannot access the `public` schema.
   *
   * @example With custom schemas
   * ```js
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key', {
   *   // Provide a custom schema. Defaults to "public".
   *   db: { schema: 'other_schema' }
   * })
   * ```
   *
   * @exampleDescription Custom fetch implementation
   * `supabase-js` uses the [`cross-fetch`](https://www.npmjs.com/package/cross-fetch) library to make HTTP requests,
   * but an alternative `fetch` implementation can be provided as an option.
   * This is most useful in environments where `cross-fetch` is not compatible (for instance Cloudflare Workers).
   *
   * @example Custom fetch implementation
   * ```js
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'publishable-or-anon-key', {
   *   global: { fetch: fetch.bind(globalThis) }
   * })
   * ```
   *
   * @exampleDescription React Native options with AsyncStorage
   * For React Native we recommend using `AsyncStorage` as the storage implementation for Supabase Auth.
   *
   * @example React Native options with AsyncStorage
   * ```js
   * import 'react-native-url-polyfill/auto'
   * import { createClient } from '@supabase/supabase-js'
   * import AsyncStorage from "@react-native-async-storage/async-storage";
   *
   * const supabase = createClient("https://xyzcompany.supabase.co", "publishable-or-anon-key", {
   *   auth: {
   *     storage: AsyncStorage,
   *     autoRefreshToken: true,
   *     persistSession: true,
   *     detectSessionInUrl: false,
   *   },
   * });
   * ```
   *
   * @exampleDescription React Native options with Expo SecureStore
   * If you wish to encrypt the user's session information, you can use `aes-js` and store the encryption key in Expo SecureStore.
   * The `aes-js` library, a reputable JavaScript-only implementation of the AES encryption algorithm in CTR mode.
   * A new 256-bit encryption key is generated using the `react-native-get-random-values` library.
   * This key is stored inside Expo's SecureStore, while the value is encrypted and placed inside AsyncStorage.
   *
   * Please make sure that:
   * - You keep the `expo-secure-store`, `aes-js` and `react-native-get-random-values` libraries up-to-date.
   * - Choose the correct [`SecureStoreOptions`](https://docs.expo.dev/versions/latest/sdk/securestore/#securestoreoptions) for your app's needs.
   *   E.g. [`SecureStore.WHEN_UNLOCKED`](https://docs.expo.dev/versions/latest/sdk/securestore/#securestorewhen_unlocked) regulates when the data can be accessed.
   * - Carefully consider optimizations or other modifications to the above example, as those can lead to introducing subtle security vulnerabilities.
   *
   * @example React Native options with Expo SecureStore
   * ```ts
   * import 'react-native-url-polyfill/auto'
   * import { createClient } from '@supabase/supabase-js'
   * import AsyncStorage from '@react-native-async-storage/async-storage';
   * import * as SecureStore from 'expo-secure-store';
   * import * as aesjs from 'aes-js';
   * import 'react-native-get-random-values';
   *
   * // As Expo's SecureStore does not support values larger than 2048
   * // bytes, an AES-256 key is generated and stored in SecureStore, while
   * // it is used to encrypt/decrypt values stored in AsyncStorage.
   * class LargeSecureStore {
   *   private async _encrypt(key: string, value: string) {
   *     const encryptionKey = crypto.getRandomValues(new Uint8Array(256 / 8));
   *
   *     const cipher = new aesjs.ModeOfOperation.ctr(encryptionKey, new aesjs.Counter(1));
   *     const encryptedBytes = cipher.encrypt(aesjs.utils.utf8.toBytes(value));
   *
   *     await SecureStore.setItemAsync(key, aesjs.utils.hex.fromBytes(encryptionKey));
   *
   *     return aesjs.utils.hex.fromBytes(encryptedBytes);
   *   }
   *
   *   private async _decrypt(key: string, value: string) {
   *     const encryptionKeyHex = await SecureStore.getItemAsync(key);
   *     if (!encryptionKeyHex) {
   *       return encryptionKeyHex;
   *     }
   *
   *     const cipher = new aesjs.ModeOfOperation.ctr(aesjs.utils.hex.toBytes(encryptionKeyHex), new aesjs.Counter(1));
   *     const decryptedBytes = cipher.decrypt(aesjs.utils.hex.toBytes(value));
   *
   *     return aesjs.utils.utf8.fromBytes(decryptedBytes);
   *   }
   *
   *   async getItem(key: string) {
   *     const encrypted = await AsyncStorage.getItem(key);
   *     if (!encrypted) { return encrypted; }
   *
   *     return await this._decrypt(key, encrypted);
   *   }
   *
   *   async removeItem(key: string) {
   *     await AsyncStorage.removeItem(key);
   *     await SecureStore.deleteItemAsync(key);
   *   }
   *
   *   async setItem(key: string, value: string) {
   *     const encrypted = await this._encrypt(key, value);
   *
   *     await AsyncStorage.setItem(key, encrypted);
   *   }
   * }
   *
   * const supabase = createClient("https://xyzcompany.supabase.co", "publishable-or-anon-key", {
   *   auth: {
   *     storage: new LargeSecureStore(),
   *     autoRefreshToken: true,
   *     persistSession: true,
   *     detectSessionInUrl: false,
   *   },
   * });
   * ```
   *
   * @example With a database query
   * ```ts
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key')
   *
   * const { data } = await supabase.from('profiles').select('*')
   * ```
   */
  constructor(
    protected supabaseUrl: string,
    protected supabaseKey: string,
    options?: SupabaseClientOptions<SchemaName>
  ) {
    const baseUrl = validateSupabaseUrl(supabaseUrl)
    if (!supabaseKey) throw new Error('supabaseKey is required.')

    this.realtimeUrl = new URL('realtime/v1', baseUrl)
    this.realtimeUrl.protocol = this.realtimeUrl.protocol.replace('http', 'ws')
    this.authUrl = new URL('auth/v1', baseUrl)
    this.storageUrl = new URL('storage/v1', baseUrl)
    this.functionsUrl = new URL('functions/v1', baseUrl)

    // default storage key uses the supabase project ref as a namespace
    const defaultStorageKey = `sb-${baseUrl.hostname.split('.')[0]}-auth-token`
    const DEFAULTS = {
      db: DEFAULT_DB_OPTIONS,
      realtime: DEFAULT_REALTIME_OPTIONS,
      auth: { ...DEFAULT_AUTH_OPTIONS, storageKey: defaultStorageKey },
      global: DEFAULT_GLOBAL_OPTIONS,
    }

    const settings = applySettingDefaults(options ?? {}, DEFAULTS)

    this.storageKey = settings.auth.storageKey ?? ''
    this.headers = settings.global.headers ?? {}

    if (!settings.accessToken) {
      this.auth = this._initSupabaseAuthClient(
        settings.auth ?? {},
        this.headers,
        settings.global.fetch
      )
    } else {
      this.accessToken = settings.accessToken

      this.auth = new Proxy<SupabaseAuthClient>({} as any, {
        get: (_, prop) => {
          throw new Error(
            `@supabase/supabase-js: Supabase Client is configured with the accessToken option, accessing supabase.auth.${String(
              prop
            )} is not possible`
          )
        },
      })
    }

    this.fetch = fetchWithAuth(supabaseKey, this._getAccessToken.bind(this), settings.global.fetch)
    this.realtime = this._initRealtimeClient({
      headers: this.headers,
      accessToken: this._getAccessToken.bind(this),
      ...settings.realtime,
    })
    if (this.accessToken) {
      // Start auth immediately to avoid race condition with channel subscriptions
      // Wrap Promise to avoid Firefox extension cross-context Promise access errors
      Promise.resolve(this.accessToken())
        .then((token) => this.realtime.setAuth(token))
        .catch((e) => console.warn('Failed to set initial Realtime auth token:', e))
    }

    this.rest = new PostgrestClient(new URL('rest/v1', baseUrl).href, {
      headers: this.headers,
      schema: settings.db.schema,
      fetch: this.fetch,
      timeout: settings.db.timeout,
      urlLengthLimit: settings.db.urlLengthLimit,
    })

    this.storage = new SupabaseStorageClient(
      this.storageUrl.href,
      this.headers,
      this.fetch,
      options?.storage
    )

    if (!settings.accessToken) {
      this._listenForAuthEvents()
    }
  }

  /**
   * Supabase Functions allows you to deploy and invoke edge functions.
   */
  get functions(): FunctionsClient {
    return new FunctionsClient(this.functionsUrl.href, {
      headers: this.headers,
      customFetch: this.fetch,
    })
  }

  // NOTE: signatures must be kept in sync with PostgrestClient.from
  from<
    TableName extends string & keyof Schema['Tables'],
    Table extends Schema['Tables'][TableName],
  >(relation: TableName): PostgrestQueryBuilder<ClientOptions, Schema, Table, TableName>
  from<ViewName extends string & keyof Schema['Views'], View extends Schema['Views'][ViewName]>(
    relation: ViewName
  ): PostgrestQueryBuilder<ClientOptions, Schema, View, ViewName>
  /**
   * Perform a query on a table or a view.
   *
   * @param relation - The table or view name to query
   */
  from(relation: string): PostgrestQueryBuilder<ClientOptions, Schema, any> {
    return this.rest.from(relation)
  }

  // NOTE: signatures must be kept in sync with PostgrestClient.schema
  /**
   * Select a schema to query or perform an function (rpc) call.
   *
   * The schema needs to be on the list of exposed schemas inside Supabase.
   *
   * @param schema - The schema to query
   */
  schema<DynamicSchema extends string & keyof Omit<Database, '__InternalSupabase'>>(
    schema: DynamicSchema
  ): PostgrestClient<
    Database,
    ClientOptions,
    DynamicSchema,
    Database[DynamicSchema] extends GenericSchema ? Database[DynamicSchema] : any
  > {
    return this.rest.schema<DynamicSchema>(schema)
  }

  // NOTE: signatures must be kept in sync with PostgrestClient.rpc
  /**
   * Perform a function call.
   *
   * @param fn - The function name to call
   * @param args - The arguments to pass to the function call
   * @param options - Named parameters
   * @param options.head - When set to `true`, `data` will not be returned.
   * Useful if you only need the count.
   * @param options.get - When set to `true`, the function will be called with
   * read-only access mode.
   * @param options.count - Count algorithm to use to count rows returned by the
   * function. Only applicable for [set-returning
   * functions](https://www.postgresql.org/docs/current/functions-srf.html).
   *
   * `"exact"`: Exact but slow count algorithm. Performs a `COUNT(*)` under the
   * hood.
   *
   * `"planned"`: Approximated but fast count algorithm. Uses the Postgres
   * statistics under the hood.
   *
   * `"estimated"`: Uses exact count for low numbers and planned count for high
   * numbers.
   */
  rpc<
    FnName extends string & keyof Schema['Functions'],
    Args extends Schema['Functions'][FnName]['Args'] = never,
    FilterBuilder extends GetRpcFunctionFilterBuilderByArgs<
      Schema,
      FnName,
      Args
    > = GetRpcFunctionFilterBuilderByArgs<Schema, FnName, Args>,
  >(
    fn: FnName,
    args: Args = {} as Args,
    options: {
      head?: boolean
      get?: boolean
      count?: 'exact' | 'planned' | 'estimated'
    } = {
      head: false,
      get: false,
      count: undefined,
    }
  ): PostgrestFilterBuilder<
    ClientOptions,
    Schema,
    FilterBuilder['Row'],
    FilterBuilder['Result'],
    FilterBuilder['RelationName'],
    FilterBuilder['Relationships'],
    'RPC'
  > {
    return this.rest.rpc(fn, args, options) as unknown as PostgrestFilterBuilder<
      ClientOptions,
      Schema,
      FilterBuilder['Row'],
      FilterBuilder['Result'],
      FilterBuilder['RelationName'],
      FilterBuilder['Relationships'],
      'RPC'
    >
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
    if (this.accessToken) {
      return await this.accessToken()
    }

    const { data } = await this.auth.getSession()

    return data.session?.access_token ?? this.supabaseKey
  }

  private _initSupabaseAuthClient(
    {
      autoRefreshToken,
      persistSession,
      detectSessionInUrl,
      storage,
      userStorage,
      storageKey,
      flowType,
      lock,
      debug,
      throwOnError,
    }: SupabaseAuthClientOptions,
    headers?: Record<string, string>,
    fetch?: Fetch
  ) {
    const authHeaders = {
      Authorization: `Bearer ${this.supabaseKey}`,
      apikey: `${this.supabaseKey}`,
    }
    return new SupabaseAuthClient({
      url: this.authUrl.href,
      headers: { ...authHeaders, ...headers },
      storageKey: storageKey,
      autoRefreshToken,
      persistSession,
      detectSessionInUrl,
      storage,
      userStorage,
      flowType,
      lock,
      debug,
      throwOnError,
      fetch,
      // auth checks if there is a custom authorizaiton header using this flag
      // so it knows whether to return an error when getUser is called with no session
      hasCustomAuthorizationHeader: Object.keys(this.headers).some(
        (key) => key.toLowerCase() === 'authorization'
      ),
    })
  }

  private _initRealtimeClient(options: RealtimeClientOptions) {
    return new RealtimeClient(this.realtimeUrl.href, {
      ...options,
      params: { ...{ apikey: this.supabaseKey }, ...options?.params },
    })
  }

  private _listenForAuthEvents() {
    const data = this.auth.onAuthStateChange((event, session) => {
      this._handleTokenChanged(event, 'CLIENT', session?.access_token)
    })
    return data
  }

  private _handleTokenChanged(
    event: AuthChangeEvent,
    source: 'CLIENT' | 'STORAGE',
    token?: string
  ) {
    if (
      (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') &&
      this.changedAccessToken !== token
    ) {
      this.changedAccessToken = token
      this.realtime.setAuth(token)
    } else if (event === 'SIGNED_OUT') {
      this.realtime.setAuth()
      if (source == 'STORAGE') this.auth.signOut()
      this.changedAccessToken = undefined
    }
  }
}
