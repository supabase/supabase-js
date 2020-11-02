;(function (a, b) {
  if ('function' == typeof define && define.amd)
    define(['exports', './utils/Helpers', './Realtime', './Auth', '@supabase/postgrest-js'], b)
  else if ('undefined' != typeof exports)
    b(
      exports,
      require('./utils/Helpers'),
      require('./Realtime'),
      require('./Auth'),
      require('@supabase/postgrest-js')
    )
  else {
    var c = { exports: {} }
    b(c.exports, a.Helpers, a.Realtime, a.Auth, a.postgrestJs), (a.index = c.exports)
  }
})(
  'undefined' == typeof globalThis ? ('undefined' == typeof self ? this : self) : globalThis,
  function (a, b, c, d, e) {
    'use strict'
    var f = require('@babel/runtime/helpers/interopRequireDefault')
    Object.defineProperty(a, '__esModule', { value: !0 }), (a.createClient = void 0), (c = f(c))
    class g {
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
          (this.auth = new d.Auth(this.authUrl, b, { autoRefreshToken: c.autoRefreshToken }))
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
       */ on(a, d) {
        var e = (0, b.uuid)()
        return (
          (this.subscriptions[e] = new c.default(
            this.tableName,
            this.realtimeUrl,
            this.schema,
            this.supabaseKey,
            e,
            a,
            d,
            this.queryFilters
          )),
          this.clear(),
          this.subscriptions[e]
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
          c = new e.PostgrestClient(this.restUrl, {
            headers: { apikey: this.supabaseKey },
            schema: this.schema,
          })
        return c.rpc(a, b)
      }
      initClient() {
        var a = { apikey: this.supabaseKey }
        45 < this.supabaseKey.length &&
          this.auth.authHeader() &&
          (a.Authorization = this.auth.authHeader())
        var b = new e.PostgrestClient(this.restUrl, { headers: a, schema: this.schema }),
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
          this.queryFilters.push({ filter: 'filter', columnName: a, operator: b, criteria: c }),
          this
        )
      }
      match(a) {
        return this.queryFilters.push({ filter: 'match', query: a }), this
      }
      order(a) {
        var b = !!(1 < arguments.length && void 0 !== arguments[1]) && arguments[1],
          c = !!(2 < arguments.length && void 0 !== arguments[2]) && arguments[2]
        return (
          this.queryFilters.push({ filter: 'order', property: a, ascending: b, nullsFirst: c }),
          this
        )
      }
      range(a, b) {
        return this.queryFilters.push({ filter: 'range', from: a, to: b }), this
      }
      single() {
        return this.queryFilters.push({ filter: 'single' }), this
      }
    } // pre-empts if any of the filters are used before select
    ;[
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
    ].forEach(
      (a) =>
        (g.prototype[a] = function (b, c) {
          return this.filter(b, a, c)
        })
    )
    a.createClient = function createClient(a, b) {
      var c = 2 < arguments.length && arguments[2] !== void 0 ? arguments[2] : {}
      return new g(a, b, c)
    }
  }
)
