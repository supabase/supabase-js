import type { AuthChangeEvent } from '@supabase/auth-js'
import { FunctionsClient } from '@supabase/functions-js'
import {
  type DefaultDatabase,
  PostgrestClient,
  type DefaultSchemaNameOf,
  type PostgrestClientOptions,
  type SchemaNameOf,
  type PostgrestOpenApiSpec,
  type PostgrestSingleResponse,
} from '@supabase/postgrest-js'
import {
  type RealtimeChannel,
  type RealtimeChannelOptions,
  RealtimeClient,
  type RealtimeClientOptions,
  type RealtimeRemoveChannelResponse,
} from '@supabase/realtime-js'
import { StorageClient as SupabaseStorageClient } from '@supabase/storage-js'
import {
  DEFAULT_AUTH_OPTIONS,
  DEFAULT_DB_OPTIONS,
  DEFAULT_GLOBAL_OPTIONS,
  DEFAULT_REALTIME_OPTIONS,
  DEFAULT_TRACE_PROPAGATION_OPTIONS,
} from './lib/constants'
import { checkApiKeyFormat, fetchWithAuth } from './lib/fetch'
import {
  applySettingDefaults,
  checkTopLevelSchemaOption,
  validateSupabaseUrl,
  type ResolvedSupabaseClientOptions,
} from './lib/helpers'
import { SupabaseAuthClient } from './lib/SupabaseAuthClient'
import type { Fetch, SupabaseAuthClientOptions, SupabaseClientOptions } from './lib/types'

/**
 * Supabase Client.
 *
 * An isomorphic Javascript client for interacting with Postgres.
 */
export default class SupabaseClient<
  // The database types the client reads: the global `SupabaseDatabase` when the postgrest mapper is set up,
  // `GenericDatabase` (untyped) otherwise. Mirrors `PostgrestClient`.
  Database = DefaultDatabase,
  // A schema name, or the v2 options object (`{ PostgrestVersion: string }`, ignored)
  SchemaNameOrClientOptions extends SchemaNameOf<Database> | PostgrestClientOptions =
    DefaultSchemaNameOf<Database>,
  SchemaName extends SchemaNameOf<Database> =
    SchemaNameOrClientOptions extends SchemaNameOf<Database>
      ? SchemaNameOrClientOptions
      : DefaultSchemaNameOf<Database>,
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
  protected rest: PostgrestClient<Database, SchemaName, SchemaName>
  protected storageKey: string
  protected fetch?: Fetch
  protected functionsFetch?: Fetch
  protected changedAccessToken?: string
  protected accessToken?: () => Promise<string | null>

  protected headers: Record<string, string>
  protected settings?: ResolvedSupabaseClientOptions<SchemaName>

  /**
   * Create a new client for use in the browser.
   *
   * @category Initializing
   *
   * @param supabaseUrl The unique Supabase URL which is supplied when you create a new project in your project dashboard.
   * @param supabaseKey The unique Supabase Key which is supplied when you create a new project in your project dashboard.
   * @param options Optional configuration for the client:
   * - `db.schema` — You can switch in between schemas. The schema needs to be on the list of exposed schemas inside Supabase.
   * - `auth.autoRefreshToken` — Set to `true` if you want to automatically refresh the token before expiring.
   * - `auth.persistSession` — Set to `true` if you want to automatically save the user session into local storage.
   * - `auth.detectSessionInUrl` — Set to `true` if you want to automatically detect OAuth grants in the URL and sign in the user.
   * - `realtime` — Options passed along to the realtime-js constructor.
   * - `storage` — Options passed along to the storage-js constructor.
   * - `global.fetch` — A custom fetch implementation.
   * - `global.headers` — Any additional headers to send with each network request.
   *
   * @example Creating a client
   * ```js
   * import { createClient } from '@supabase/supabase-js'
   *
   * // Create a single supabase client for interacting with your database
   * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
   * ```
   *
   * @example With a custom domain
   * ```js
   * import { createClient } from '@supabase/supabase-js'
   *
   * // Use a custom domain as the supabase URL
   * const supabase = createClient('https://my-custom-domain.com', 'your-publishable-key')
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
   * const supabase = createClient("https://xyzcompany.supabase.co", "your-publishable-key", options)
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
   * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key', {
   *   // Provide a custom schema. Defaults to "public".
   *   db: { schema: 'other_schema' }
   * })
   * ```
   *
   * @exampleDescription Custom fetch implementation
   * `supabase-js` uses the runtime's global `fetch` to make HTTP requests,
   * but an alternative `fetch` implementation can be provided as an option.
   * This is useful in environments where the global `fetch` is unavailable or where you want to customize request behavior.
   *
   * @example Custom fetch implementation
   * ```js
   * import { createClient } from '@supabase/supabase-js'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key', {
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
   * const supabase = createClient("https://xyzcompany.supabase.co", "your-publishable-key", {
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
   * const supabase = createClient("https://xyzcompany.supabase.co", "your-publishable-key", {
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
   * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key')
   *
   * const { data } = await supabase.from('profiles').select('*')
   * ```
   *
   * @exampleDescription With OpenTelemetry tracing
   * Opt in to W3C trace context propagation so the `trace_id` from your
   * client-side spans is attached to Supabase requests and appears in API
   * Gateway and Edge Function logs. Requires `@opentelemetry/api` to be
   * installed in your application and the tracing runtime to be loaded via
   * `import '@supabase/supabase-js/tracing'`. See [Tracing with the JS SDK](https://supabase.com/docs/guides/telemetry/client-side-tracing).
   *
   * @example With OpenTelemetry tracing
   * ```ts
   * import '@supabase/supabase-js/tracing'
   * import { createClient } from '@supabase/supabase-js'
   * import { trace } from '@opentelemetry/api'
   *
   * const supabase = createClient('https://xyzcompany.supabase.co', 'your-publishable-key', {
   *   tracePropagation: true,
   * })
   *
   * const tracer = trace.getTracer('my-app')
   *
   * await tracer.startActiveSpan('fetch-users', async (span) => {
   *   // Outgoing request carries the active trace context.
   *   const { data, error } = await supabase.from('users').select('*')
   *   span.end()
   * })
   * ```
   */
  constructor(
    protected supabaseUrl: string,
    protected supabaseKey: string,
    options?: SupabaseClientOptions<SchemaName>
  ) {
    const baseUrl = validateSupabaseUrl(supabaseUrl)
    if (!supabaseKey) throw new Error('supabaseKey is required.')
    checkApiKeyFormat(supabaseKey)
    checkTopLevelSchemaOption(options)

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
      tracePropagation: DEFAULT_TRACE_PROPAGATION_OPTIONS,
    }

    const settings = applySettingDefaults(options ?? {}, DEFAULTS)
    this.settings = settings

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

    // The fetch wrappers receive the raw session token (null when there is no session) and
    // decide the `Authorization` fallback themselves, so the API-key fallback lives in one place.
    this.fetch = fetchWithAuth(
      supabaseKey,
      supabaseUrl,
      this._getSessionToken.bind(this),
      settings.global.fetch,
      settings.tracePropagation
    )
    // Edge Functions use a dedicated fetch that never falls back to a new-format API key in
    // the Authorization header (see `isNewApiKey` in ./lib/fetch). Other services use `this.fetch`.
    this.functionsFetch = fetchWithAuth(
      supabaseKey,
      supabaseUrl,
      this._getSessionToken.bind(this),
      settings.global.fetch,
      settings.tracePropagation,
      { omitApiKeyAsBearer: true }
    )
    this.realtime = this._initRealtimeClient({
      headers: this.headers,
      accessToken: this._getAccessToken.bind(this),
      fetch: this.fetch,
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
      retry: settings.db.retry,
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
      customFetch: this.functionsFetch,
    })
  }

  /**
   * Perform a query on a table or a view.
   *
   * Typed exactly like `PostgrestClient.from`: the select, filters and mutations are planned from the generated
   * declarations of `@supabase/postgrest-mapper`.
   *
   * @param relation - The table or view name to query
   */
  from: PostgrestClient<Database, SchemaName, SchemaName>['from'] = (relation) =>
    this.rest.from(relation as any)

  /**
   * Select a schema to query or perform an function (rpc) call.
   *
   * The schema needs to be on the list of exposed schemas inside Supabase.
   *
   * @param schema - The schema to query
   */
  schema: PostgrestClient<Database, SchemaName, SchemaName>['schema'] = (schema) =>
    this.rest.schema(schema)

  // NOTE: signatures must be kept in sync with PostgrestClient.getOpenApiSpec
  /**
   * Fetch the OpenAPI description PostgREST publishes for this client's schema.
   *
   * The document lists only the tables, views and functions the caller's role
   * holds privileges on. The request carries the same `apikey` and
   * `Authorization` headers as every other query, so the description is scoped
   * to the signed-in user. Call `.schema()` first to describe a schema other
   * than the client default.
   *
   * @example
   * ```ts
   * const { data, error } = await supabase.getOpenApiSpec()
   * ```
   */
  getOpenApiSpec(): Promise<PostgrestSingleResponse<PostgrestOpenApiSpec>> {
    return this.rest.getOpenApiSpec()
  }

  /**
   * Perform a function call.
   *
   * Typed exactly like `PostgrestClient.rpc`. The request is a `POST` by default, a `GET` with `get: true` and a
   * `HEAD` with `head: true`, and never switches method on its own. A `GET` or `HEAD` request the query string can't
   * carry faithfully (a reserved key, an object value, a string value PostgREST would read as a filter) is refused
   * client-side with a `PGRSTJS01` error.
   *
   * @param fn - The function name to call
   * @param args - The arguments to pass to the function call
   * @param options - Named parameters
   * @param options.head - When set to `true`, the function is called with `HEAD`: `data` will not be returned.
   * Useful if you only need the count.
   * @param options.get - When set to `true`, the function is called with `GET`, which gives it read-only access
   * mode.
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
  rpc: PostgrestClient<Database, SchemaName, SchemaName>['rpc'] = ((...args: [any, any?, any?]) =>
    this.rest.rpc(...args)) as any

  /**
   * Creates a Realtime channel with Broadcast, Presence, and Postgres Changes.
   *
   * @param {string} name - The name of the Realtime channel.
   * @param {Object} opts - The options to pass to the Realtime channel.
   *
   * @category Realtime
   */
  channel(name: string, opts: RealtimeChannelOptions = { config: {} }): RealtimeChannel {
    return this.realtime.channel(name, opts)
  }

  /**
   * Returns all Realtime channels.
   *
   * @category Realtime
   *
   * @example Get all channels
   * ```js
   * const channels = supabase.getChannels()
   * ```
   */
  getChannels(): RealtimeChannel[] {
    return this.realtime.getChannels()
  }

  /**
   * Unsubscribes and removes Realtime channel from Realtime client.
   *
   * @param {RealtimeChannel} channel - The name of the Realtime channel.
   *
   *
   * @category Realtime
   *
   * @remarks
   * - Removing a channel is a great way to maintain the performance of your project's Realtime service as well as your database if you're listening to Postgres changes. Supabase will automatically handle cleanup 30 seconds after a client is disconnected, but unused channels may cause degradation as more clients are simultaneously subscribed.
   *
   * @example Removes a channel
   * ```js
   * supabase.removeChannel(myChannel)
   * ```
   */
  removeChannel(channel: RealtimeChannel): Promise<RealtimeRemoveChannelResponse> {
    return this.realtime.removeChannel(channel)
  }

  /**
   * Unsubscribes and removes all Realtime channels from Realtime client.
   *
   * @category Realtime
   *
   * @remarks
   * - Removing channels is a great way to maintain the performance of your project's Realtime service as well as your database if you're listening to Postgres changes. Supabase will automatically handle cleanup 30 seconds after a client is disconnected, but unused channels may cause degradation as more clients are simultaneously subscribed.
   *
   * @example Remove all channels
   * ```js
   * supabase.removeAllChannels()
   * ```
   */
  removeAllChannels(): Promise<RealtimeRemoveChannelResponse[]> {
    return this.realtime.removeAllChannels()
  }

  /**
   * The raw session token — the custom `accessToken` result or the signed-in user's JWT —
   * or `null` when there is no session. Unlike {@link _getAccessToken} it does not fall back
   * to `supabaseKey`, so callers can distinguish "no session" from "has session".
   */
  private async _getSessionToken(): Promise<string | null> {
    if (this.accessToken) {
      return await this.accessToken()
    }

    const { data } = await this.auth.getSession()

    return data.session?.access_token ?? null
  }

  private async _getAccessToken() {
    return (await this._getSessionToken()) ?? this.supabaseKey
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
      experimental,
      lockAcquireTimeout,
      skipAutoInitialize,
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
      experimental,
      fetch,
      lockAcquireTimeout,
      skipAutoInitialize,
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
      (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN' || event === 'INITIAL_SESSION') &&
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
