'use strict'
var _interopRequireDefault = require('@babel/runtime/helpers/interopRequireDefault')
Object.defineProperty(exports, '__esModule', { value: !0 }), (exports.createClient = void 0)
var _Helpers = require('./utils/Helpers'),
  _Realtime = _interopRequireDefault(require('./Realtime')),
  _Auth = require('./Auth'),
  _postgrestJs = require('@supabase/postgrest-js'),
  DEPRICATED_KEY_LENGTH = 45
class SupabaseClient {
  constructor(a, b) {
    var c =
      2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : { autoRefreshToken: !0 }
    ;(this.supabaseUrl = null),
      (this.supabaseKey = null),
      (this.restUrl = null),
      (this.realtimeUrl = null),
      (this.authUrl = null),
      (this.schema = 'public'),
      (this.subscriptions = {}),
      (this.tableName = null),
      (this.queryFilters = []),
      c.schema && (this.schema = c.schema),
      this.authenticate(a, b),
      (this.auth = new _Auth.Auth(this.authUrl, b, { autoRefreshToken: c.autoRefreshToken }))
  }
  /**
   * General Functionalities
   */ authenticate(a, b) {
    ;(this.supabaseUrl = a),
      (this.supabaseKey = b),
      (this.restUrl = ''.concat(a, '/rest/v1')),
      (this.realtimeUrl = ''.concat(a, '/realtime/v1').replace('http', 'ws')),
      (this.authUrl = ''.concat(a, '/auth/v1'))
  }
  clear() {
    ;(this.tableName = null), (this.queryFilters = [])
  }
  from(a) {
    return (this.tableName = a), this
  }
  /**
   * Realtime Functionalities
   */ on(a, b) {
    var c = (0, _Helpers.uuid)()
    return (
      (this.subscriptions[c] = new _Realtime.default(
        this.tableName,
        this.realtimeUrl,
        this.schema,
        this.supabaseKey,
        c,
        a,
        b,
        this.queryFilters
      )),
      this.clear(),
      this.subscriptions[c]
    )
  }
  getSubscriptions() {
    return Object.values(this.subscriptions)
  }
  removeSubscription(a) {
    a.unsubscribe(), delete this.subscriptions[a.uuid]
  }
  /**
   * REST Functionalities
   */ rpc(a) {
    var b = 1 < arguments.length && arguments[1] !== void 0 ? arguments[1] : null,
      c = new _postgrestJs.PostgrestClient(this.restUrl, {
        headers: { apikey: this.supabaseKey },
        schema: this.schema,
      })
    return c.rpc(a, b)
  }
  initClient() {
    var a = { apikey: this.supabaseKey }
    this.supabaseKey.length > DEPRICATED_KEY_LENGTH &&
      this.auth.authHeader() &&
      (a.Authorization = this.auth.authHeader())
    var b = new _postgrestJs.PostgrestClient(this.restUrl, { headers: a, schema: this.schema }),
      c = b.from(this.tableName)
    return (
      this.queryFilters.forEach((a) => {
        switch (a.filter) {
          case 'filter':
            c.filter(a.columnName, a.operator, a.criteria)
            break
          case 'match':
            c.match(a.query)
            break
          case 'order':
            c.order(a.property, a.ascending, a.nullsFirst)
            break
          case 'range':
            c.range(a.from, a.to)
            break
          case 'single':
            c.single()
            break
          default:
        }
      }),
      this.clear(),
      c
    )
  }
  select() {
    var a = 0 < arguments.length && arguments[0] !== void 0 ? arguments[0] : '*',
      b = 1 < arguments.length && arguments[1] !== void 0 ? arguments[1] : {},
      c = this.initClient()
    return c.select(a, b)
  }
  insert(a) {
    var b = 1 < arguments.length && arguments[1] !== void 0 ? arguments[1] : {},
      c = this.initClient()
    return c.insert(a, b)
  }
  update(a) {
    var b = 1 < arguments.length && arguments[1] !== void 0 ? arguments[1] : {},
      c = this.initClient()
    return c.update(a, b)
  }
  delete() {
    var a = 0 < arguments.length && arguments[0] !== void 0 ? arguments[0] : {},
      b = this.initClient()
    return b.delete(a)
  }
  filter(a, b, c) {
    return (
      this.queryFilters.push({ filter: 'filter', columnName: a, operator: b, criteria: c }), this
    )
  }
  match(a) {
    return this.queryFilters.push({ filter: 'match', query: a }), this
  }
  order(a) {
    var b = !!(1 < arguments.length && void 0 !== arguments[1]) && arguments[1],
      c = !!(2 < arguments.length && void 0 !== arguments[2]) && arguments[2]
    return (
      this.queryFilters.push({ filter: 'order', property: a, ascending: b, nullsFirst: c }), this
    )
  }
  range(a, b) {
    return this.queryFilters.push({ filter: 'range', from: a, to: b }), this
  }
  single() {
    return this.queryFilters.push({ filter: 'single' }), this
  }
} // pre-empts if any of the filters are used before select
var advancedFilters = [
  'eq',
  'neq',
  'gt',
  'lt',
  'gte',
  'lte',
  'like',
  'ilike',
  'is',
  'in',
  'cs',
  'cd',
  'ova',
  'ovr',
  'sl',
  'sr',
  'nxr',
  'nxl',
  'adj',
]
advancedFilters.forEach(
  (a) =>
    (SupabaseClient.prototype[a] = function (b, c) {
      return this.filter(b, a, c)
    })
)
var createClient = function (a, b) {
  var c = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : {}
  return new SupabaseClient(a, b, c)
}
exports.createClient = createClient
