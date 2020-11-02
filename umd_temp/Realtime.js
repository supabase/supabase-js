;(function (a, b) {
  if ('function' == typeof define && define.amd)
    define(['exports', '@supabase/realtime-js', './utils/ChangeMapper'], b)
  else if ('undefined' != typeof exports)
    b(exports, require('@supabase/realtime-js'), require('./utils/ChangeMapper'))
  else {
    var c = { exports: {} }
    b(c.exports, a.realtimeJs, a.ChangeMapper), (a.Realtime = c.exports)
  }
})(
  'undefined' == typeof globalThis ? ('undefined' == typeof self ? this : self) : globalThis,
  function (a, b, c) {
    'use strict'
    var d = require('@babel/runtime/helpers/interopRequireWildcard')
    Object.defineProperty(a, '__esModule', { value: !0 }), (a.default = void 0), (c = d(c))
    a.default = class a {
      constructor(a, b, c, d, e, f, g, h) {
        ;(this.tableName = a),
          (this.realtimeUrl = b),
          (this.schema = c),
          (this.apikey = d),
          (this.uuid = e),
          (this.socket = null),
          (this.channel = null),
          (this.listeners = {}),
          (this.queryFilters = h),
          this.on(f, g)
      }
      /**
       * REALTIME FUNCTIONALITY
       */ createListener() {
        var a = ''.concat(this.realtimeUrl),
          c = ''
        this.queryFilters.forEach((a) => {
          switch (a.filter) {
            case 'filter':
              'eq' === a.operator &&
                (c = ':'.concat(a.columnName, '=').concat(a.operator, '.').concat(a.criteria))
              break
            default:
          }
        })
        var d =
          '*' == this.tableName
            ? 'realtime:*'
            : 'realtime:'.concat(this.schema, ':').concat(this.tableName).concat(c)
        ;(this.socket = new b.Socket(a, { params: { apikey: this.apikey } })),
          (this.channel = this.socket.channel(d)),
          this.socket.onOpen(() => {
            console.debug(''.concat(this.realtimeUrl, ': REALTIME CONNECTED'))
          }),
          this.socket.onClose(() => {
            console.debug(''.concat(this.realtimeUrl, ': REALTIME DISCONNECTED'))
          })
      }
      on(a, b) {
        return (
          null == this.socket && this.createListener(),
          this.channel.on(a, (a) => {
            var d = { schema: a.schema, table: a.table, commit_timestamp: a.commit_timestamp },
              e = {},
              f = {},
              g = {}
            switch (a.type) {
              case 'INSERT':
                ;(e = c.convertChangeData(a.columns, a.record)),
                  (d.eventType = 'INSERT'),
                  (d.new = e)
                break
              case 'UPDATE':
                ;(f = c.convertChangeData(a.columns, a.old_record)),
                  (e = c.convertChangeData(a.columns, a.record)),
                  Object.keys(f).forEach((a) => {
                    null != f[a] && (g[a] = f[a])
                  }),
                  (d.eventType = 'UPDATE'),
                  (d.old = g),
                  (d.new = e)
                break
              case 'DELETE':
                ;(f = c.convertChangeData(a.columns, a.old_record)),
                  Object.keys(f).forEach((a) => {
                    null != f[a] && (g[a] = f[a])
                  }),
                  (d.eventType = 'DELETE'),
                  (d.old = g)
                break
              default:
            }
            b(d)
          }),
          (this.listeners[a] = b),
          this
        )
      }
      subscribe() {
        return (
          null == this.socket && this.createListener(),
          this.socket.connect(),
          'joined' !== this.channel.state &&
            this.channel
              .join()
              .receive('ok', (a) =>
                console.debug(''.concat(this.realtimeUrl, ': Joined Realtime successfully '), a)
              )
              .receive('error', (a) =>
                console.debug(''.concat(this.realtimeUrl, ': Unable to join '), a)
              )
              .receive('timeout', () =>
                console.debug(''.concat(this.realtimeUrl, ': Network timeout. Still waiting...'))
              ),
          this
        )
      }
      unsubscribe() {
        return this.socket && this.socket.disconnect(), this
      }
    }
  }
)
