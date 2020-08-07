import { uuid } from './utils/Helpers'
import Realtime from './Realtime'
import { Auth } from './Auth'
import { PostgrestClient } from '@supabase/postgrest-js'

const DEPRICATED_KEY_LENGTH = 45

class SupabaseClient {
  constructor(supabaseUrl, supabaseKey, options = { autoRefreshToken: true }) {
    this.supabaseUrl = null
    this.supabaseKey = null
    this.restUrl = null
    this.realtimeUrl = null
    this.authUrl = null
    this.schema = 'public'
    this.subscriptions = {}

    this.tableName = null

    if (options.schema) this.schema = options.schema

    this.authenticate(supabaseUrl, supabaseKey)

    this.auth = new Auth(this.authUrl, supabaseKey, { autoRefreshToken: options.autoRefreshToken })
  }

  /**
   * General Functionalities
   */

  authenticate(supabaseUrl, supabaseKey) {
    this.supabaseUrl = supabaseUrl
    this.supabaseKey = supabaseKey
    this.restUrl = `${supabaseUrl}/rest/v1`
    this.realtimeUrl = `${supabaseUrl}/realtime/v1`.replace('http', 'ws')
    this.authUrl = `${supabaseUrl}/auth/v1`
  }

  clear() {
    this.tableName = null
    this.queryFilters = []
  }

  from(tableName) {
    this.tableName = tableName
    this.initPostgrest()

    return this
  }

  /**
   * Realtime Functionalities
   */

  on(eventType, callbackFunction) {
    let identifier = uuid()

    this.subscriptions[identifier] = new Realtime(
      this.tableName,
      this.realtimeUrl,
      this.schema,
      this.supabaseKey,
      identifier,
      eventType,
      callbackFunction,
      this.queryFilters
    )

    this.clear()
    return this.subscriptions[identifier]
  }

  getSubscriptions() {
    return Object.values(this.subscriptions)
  }

  removeSubscription(mySubscription) {
    mySubscription.unsubscribe()
    delete this.subscriptions[mySubscription.uuid]
  }

  /**
   * REST Functionalities
   */

  rpc(functionName, functionParameters = null) {
    let rest = new PostgrestClient(this.restUrl, {
      headers: { apikey: this.supabaseKey },
      schema: this.schema,
    })
    return rest.rpc(functionName, functionParameters)
  }

  /**
   * HACK(soedirgo): We want SupabaseClient to act like PostgrestClient (sort
   * of). At the same time, we want to be able to use `on()` after a `from()`.
   * Unfortunately, the cleanest way to do this that I can think of is to have
   * `this`'s prototype inherit postgrest-js's `Builder`.
   *
   * Say we have `const supabase = createClient(<supabase url>, <supabase
   * key>)`. The inheritance hierarchy starts out like so:
   *
   *             SupabaseClient { authenticate: [Function]
   *                              from: [Function],
   *                              on: [Function],
   *                              ... }
   *
   *                              ▲
   *                              │
   *
   *                         supabase {}
   *
   * To allow using postgrest-js features without reimplementing the methods
   * (or, select, order, etc.), we let `this`'s prototype (a SupabaseClient
   * instance) inherit the `Builder` object we created through
   * `initPostgrest()`:
   *
   *             { url: <supabase url>/rest/v1/<some table>,
   *               queryFilters: [],
   *               ...,
   *               select: [Function],
   *               eq: [Function],
   *               ... }
   *
   *                              ▲
   *                              │
   *
   *             SupabaseClient { authenticate: [Function]
   *                              from: [Function],
   *                              on: [Function],
   *                              ... }
   *
   *                              ▲
   *                              │
   *
   *                         supabase {}
   *
   * Caveat: we end up having to do this song and dance even though we only want
   * to use Realtime (`on()`), and we create a new PostgrestClient on every
   * `from()` which is unnecessary. initPostgrest also modifies state by
   * renewing its prototype's prototype.
   */
  initPostgrest() {
    let headers = { apikey: this.supabaseKey }
    if (this.supabaseKey.length > DEPRICATED_KEY_LENGTH && this.auth.authHeader()) {
      headers['Authorization'] = this.auth.authHeader()
    }

    let rest = new PostgrestClient(this.restUrl, {
      headers,
      schema: this.schema,
    })
    let builder = rest.from(this.tableName)

    Object.setPrototypeOf(Object.getPrototypeOf(this), builder)
  }
}

const createClient = (supabaseUrl, supabaseKey, options = {}) => {
  return new SupabaseClient(supabaseUrl, supabaseKey, options)
}

export { createClient }
