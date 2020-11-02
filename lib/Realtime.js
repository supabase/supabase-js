'use strict'
var _interopRequireWildcard = require('@babel/runtime/helpers/interopRequireWildcard')
Object.defineProperty(exports, '__esModule', { value: !0 }), (exports.default = void 0)
var _realtimeJs = require('@supabase/realtime-js'),
  ChangeMapper = _interopRequireWildcard(require('./utils/ChangeMapper'))
class Realtime {
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
      b = ''
    this.queryFilters.forEach((a) => {
      switch (a.filter) {
        case 'filter':
          'eq' === a.operator &&
            (b = ':'.concat(a.columnName, '=').concat(a.operator, '.').concat(a.criteria))
          break
        default:
      }
    })
    var c =
      '*' == this.tableName
        ? 'realtime:*'
        : 'realtime:'.concat(this.schema, ':').concat(this.tableName).concat(b)
    ;(this.socket = new _realtimeJs.Socket(a, { params: { apikey: this.apikey } })),
      (this.channel = this.socket.channel(c)),
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
        var c = { schema: a.schema, table: a.table, commit_timestamp: a.commit_timestamp },
          d = {},
          e = {},
          f = {}
        switch (a.type) {
          case 'INSERT':
            ;(d = ChangeMapper.convertChangeData(a.columns, a.record)),
              (c.eventType = 'INSERT'),
              (c.new = d)
            break
          case 'UPDATE':
            ;(e = ChangeMapper.convertChangeData(a.columns, a.old_record)),
              (d = ChangeMapper.convertChangeData(a.columns, a.record)),
              Object.keys(e).forEach((a) => {
                null != e[a] && (f[a] = e[a])
              }),
              (c.eventType = 'UPDATE'),
              (c.old = f),
              (c.new = d)
            break
          case 'DELETE':
            ;(e = ChangeMapper.convertChangeData(a.columns, a.old_record)),
              Object.keys(e).forEach((a) => {
                null != e[a] && (f[a] = e[a])
              }),
              (c.eventType = 'DELETE'),
              (c.old = f)
            break
          default:
        }
        b(c)
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
var _default = Realtime
exports.default = _default
