var Supabase = (function (e) {
  var t = {}
  function r(n) {
    if (t[n]) return t[n].exports
    var o = (t[n] = { i: n, l: !1, exports: {} })
    return e[n].call(o.exports, o, o.exports, r), (o.l = !0), o.exports
  }
  return (
    (r.m = e),
    (r.c = t),
    (r.d = function (e, t, n) {
      r.o(e, t) || Object.defineProperty(e, t, { enumerable: !0, get: n })
    }),
    (r.r = function (e) {
      'undefined' != typeof Symbol &&
        Symbol.toStringTag &&
        Object.defineProperty(e, Symbol.toStringTag, { value: 'Module' }),
        Object.defineProperty(e, '__esModule', { value: !0 })
    }),
    (r.t = function (e, t) {
      if ((1 & t && (e = r(e)), 8 & t)) return e
      if (4 & t && 'object' == typeof e && e && e.__esModule) return e
      var n = Object.create(null)
      if (
        (r.r(n),
        Object.defineProperty(n, 'default', { enumerable: !0, value: e }),
        2 & t && 'string' != typeof e)
      )
        for (var o in e)
          r.d(
            n,
            o,
            function (t) {
              return e[t]
            }.bind(null, o)
          )
      return n
    }),
    (r.n = function (e) {
      var t =
        e && e.__esModule
          ? function () {
              return e.default
            }
          : function () {
              return e
            }
      return r.d(t, 'a', t), t
    }),
    (r.o = function (e, t) {
      return Object.prototype.hasOwnProperty.call(e, t)
    }),
    (r.p = ''),
    r((r.s = 8))
  )
})([
  function (e, t, r) {
    'use strict'
    Object.defineProperty(t, '__esModule', { value: !0 }),
      (t.objectToQueryString = function (e) {
        return Object.keys(e)
          .map(function (t) {
            return ''.concat(t, '=').concat(e[t])
          })
          .join('&')
      }),
      (t.cleanFilterArray = function (e) {
        return e.map(function (e) {
          return 'string' == typeof e && (e.includes(',') || e.includes('(') || e.includes(')'))
            ? '"'.concat(e, '"')
            : e
        })
      }),
      (t.cleanColumnName = function (e) {
        var t = e,
          r = null
        return (
          e.includes('.') && ((t = e.split('.')[1]), (r = e.split('.')[0])),
          { cleanedColumnName: t, foreignTableName: r }
        )
      })
  },
  function (e, t, r) {
    const { CHANNEL_EVENTS: n, CHANNEL_STATES: o } = r(2),
      i = r(12),
      s = r(3)
    e.exports = class {
      constructor(e, t, r) {
        ;(this.state = o.closed),
          (this.topic = e),
          (this.params = t || {}),
          (this.socket = r),
          (this.bindings = []),
          (this.timeout = this.socket.timeout),
          (this.joinedOnce = !1),
          (this.joinPush = new i(this, n.join, this.params, this.timeout)),
          (this.pushBuffer = []),
          (this.rejoinTimer = new s(
            () => this.rejoinUntilConnected(),
            this.socket.reconnectAfterMs
          )),
          this.joinPush.receive('ok', () => {
            ;(this.state = o.joined),
              this.rejoinTimer.reset(),
              this.pushBuffer.forEach((e) => e.send()),
              (this.pushBuffer = [])
          }),
          this.onClose(() => {
            this.rejoinTimer.reset(),
              this.socket.log('channel', `close ${this.topic} ${this.joinRef()}`),
              (this.state = o.closed),
              this.socket.remove(this)
          }),
          this.onError((e) => {
            this.isLeaving() ||
              this.isClosed() ||
              (this.socket.log('channel', 'error ' + this.topic, e),
              (this.state = o.errored),
              this.rejoinTimer.scheduleTimeout())
          }),
          this.joinPush.receive('timeout', () => {
            this.isJoining() &&
              (this.socket.log('channel', 'timeout ' + this.topic, this.joinPush.timeout),
              (this.state = o.errored),
              this.rejoinTimer.scheduleTimeout())
          }),
          this.on(n.reply, (e, t) => {
            this.trigger(this.replyEventName(t), e)
          })
      }
      rejoinUntilConnected() {
        this.rejoinTimer.scheduleTimeout(), this.socket.isConnected() && this.rejoin()
      }
      join(e = this.timeout) {
        if (this.joinedOnce)
          throw "tried to join multiple times. 'join' can only be called a single time per channel instance"
        return (this.joinedOnce = !0), this.rejoin(e), this.joinPush
      }
      onClose(e) {
        this.on(n.close, e)
      }
      onError(e) {
        this.on(n.error, (t) => e(t))
      }
      on(e, t) {
        this.bindings.push({ event: e, callback: t })
      }
      off(e) {
        this.bindings = this.bindings.filter((t) => t.event !== e)
      }
      canPush() {
        return this.socket.isConnected() && this.isJoined()
      }
      push(e, t, r = this.timeout) {
        if (!this.joinedOnce)
          throw `tried to push '${e}' to '${this.topic}' before joining. Use channel.join() before pushing events`
        let n = new i(this, e, t, r)
        return this.canPush() ? n.send() : (n.startTimeout(), this.pushBuffer.push(n)), n
      }
      leave(e = this.timeout) {
        this.state = o.leaving
        let t = () => {
            this.socket.log('channel', 'leave ' + this.topic),
              this.trigger(n.close, 'leave', this.joinRef())
          },
          r = new i(this, n.leave, {}, e)
        return (
          r.receive('ok', () => t()).receive('timeout', () => t()),
          r.send(),
          this.canPush() || r.trigger('ok', {}),
          r
        )
      }
      onMessage(e, t, r) {
        return t
      }
      isMember(e) {
        return this.topic === e
      }
      joinRef() {
        return this.joinPush.ref
      }
      sendJoin(e) {
        ;(this.state = o.joining), this.joinPush.resend(e)
      }
      rejoin(e = this.timeout) {
        this.isLeaving() || this.sendJoin(e)
      }
      trigger(e, t, r) {
        let { close: o, error: i, leave: s, join: a } = n
        if (r && [o, i, s, a].indexOf(e) >= 0 && r !== this.joinRef()) return
        let c = this.onMessage(e, t, r)
        if (t && !c)
          throw 'channel onMessage callbacks must return the payload, modified or unmodified'
        this.bindings.filter((t) => t.event === e).map((e) => e.callback(c, r))
      }
      replyEventName(e) {
        return 'chan_reply_' + e
      }
      isClosed() {
        return this.state === o.closed
      }
      isErrored() {
        return this.state === o.errored
      }
      isJoined() {
        return this.state === o.joined
      }
      isJoining() {
        return this.state === o.joining
      }
      isLeaving() {
        return this.state === o.leaving
      }
    }
  },
  function (e, t) {
    e.exports = {
      VSN: '1.0.0',
      SOCKET_STATES: { connecting: 0, open: 1, closing: 2, closed: 3 },
      DEFAULT_TIMEOUT: 1e4,
      WS_CLOSE_NORMAL: 1e3,
      CHANNEL_STATES: {
        closed: 'closed',
        errored: 'errored',
        joined: 'joined',
        joining: 'joining',
        leaving: 'leaving',
      },
      CHANNEL_EVENTS: {
        close: 'phx_close',
        error: 'phx_error',
        join: 'phx_join',
        reply: 'phx_reply',
        leave: 'phx_leave',
      },
      TRANSPORTS: { websocket: 'websocket' },
    }
  },
  function (e, t) {
    e.exports = class {
      constructor(e, t) {
        ;(this.callback = e), (this.timerCalc = t), (this.timer = null), (this.tries = 0)
      }
      reset() {
        ;(this.tries = 0), clearTimeout(this.timer)
      }
      scheduleTimeout() {
        clearTimeout(this.timer),
          (this.timer = setTimeout(() => {
            ;(this.tries = this.tries + 1), this.callback()
          }, this.timerCalc(this.tries + 1)))
      }
    }
  },
  function (e, t, r) {
    'use strict'
    function n(e) {
      return (n =
        'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
          ? function (e) {
              return typeof e
            }
          : function (e) {
              return e &&
                'function' == typeof Symbol &&
                e.constructor === Symbol &&
                e !== Symbol.prototype
                ? 'symbol'
                : typeof e
            })(e)
    }
    var o
    'undefined' != typeof window
      ? (o = window)
      : 'undefined' == typeof self
      ? (console.warn('Using browser-only version of superagent in non-browser environment'),
        (o = void 0))
      : (o = self)
    var i = r(28),
      s = r(29),
      a = r(30),
      c = r(5),
      u = r(31),
      l = r(33)
    function h() {}
    e.exports = function (e, r) {
      return 'function' == typeof r
        ? new t.Request('GET', e).end(r)
        : 1 === arguments.length
        ? new t.Request('GET', e)
        : new t.Request(e, r)
    }
    var f = (t = e.exports)
    ;(t.Request = g),
      (f.getXHR = function () {
        if (
          o.XMLHttpRequest &&
          (!o.location || 'file:' !== o.location.protocol || !o.ActiveXObject)
        )
          return new XMLHttpRequest()
        try {
          return new ActiveXObject('Microsoft.XMLHTTP')
        } catch (e) {}
        try {
          return new ActiveXObject('Msxml2.XMLHTTP.6.0')
        } catch (e) {}
        try {
          return new ActiveXObject('Msxml2.XMLHTTP.3.0')
        } catch (e) {}
        try {
          return new ActiveXObject('Msxml2.XMLHTTP')
        } catch (e) {}
        throw new Error('Browser-only version of superagent could not find XHR')
      })
    var p = ''.trim
      ? function (e) {
          return e.trim()
        }
      : function (e) {
          return e.replace(/(^\s*|\s*$)/g, '')
        }
    function d(e) {
      if (!c(e)) return e
      var t = []
      for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && y(t, r, e[r])
      return t.join('&')
    }
    function y(e, t, r) {
      if (void 0 !== r)
        if (null !== r)
          if (Array.isArray(r))
            r.forEach(function (r) {
              y(e, t, r)
            })
          else if (c(r))
            for (var n in r)
              Object.prototype.hasOwnProperty.call(r, n) &&
                y(e, ''.concat(t, '[').concat(n, ']'), r[n])
          else e.push(encodeURI(t) + '=' + encodeURIComponent(r))
        else e.push(encodeURI(t))
    }
    function m(e) {
      for (var t, r, n = {}, o = e.split('&'), i = 0, s = o.length; i < s; ++i)
        -1 === (r = (t = o[i]).indexOf('='))
          ? (n[decodeURIComponent(t)] = '')
          : (n[decodeURIComponent(t.slice(0, r))] = decodeURIComponent(t.slice(r + 1)))
      return n
    }
    function b(e) {
      return /[/+]json($|[^-\w])/.test(e)
    }
    function v(e) {
      ;(this.req = e),
        (this.xhr = this.req.xhr),
        (this.text =
          ('HEAD' !== this.req.method &&
            ('' === this.xhr.responseType || 'text' === this.xhr.responseType)) ||
          void 0 === this.xhr.responseType
            ? this.xhr.responseText
            : null),
        (this.statusText = this.req.xhr.statusText)
      var t = this.xhr.status
      1223 === t && (t = 204),
        this._setStatusProperties(t),
        (this.headers = (function (e) {
          for (var t, r, n, o, i = e.split(/\r?\n/), s = {}, a = 0, c = i.length; a < c; ++a)
            -1 !== (t = (r = i[a]).indexOf(':')) &&
              ((n = r.slice(0, t).toLowerCase()), (o = p(r.slice(t + 1))), (s[n] = o))
          return s
        })(this.xhr.getAllResponseHeaders())),
        (this.header = this.headers),
        (this.header['content-type'] = this.xhr.getResponseHeader('content-type')),
        this._setHeaderProperties(this.header),
        null === this.text && e._responseType
          ? (this.body = this.xhr.response)
          : (this.body =
              'HEAD' === this.req.method
                ? null
                : this._parseBody(this.text ? this.text : this.xhr.response))
    }
    function g(e, t) {
      var r = this
      ;(this._query = this._query || []),
        (this.method = e),
        (this.url = t),
        (this.header = {}),
        (this._header = {}),
        this.on('end', function () {
          var e,
            t = null,
            n = null
          try {
            n = new v(r)
          } catch (e) {
            return (
              ((t = new Error('Parser is unable to parse the response')).parse = !0),
              (t.original = e),
              r.xhr
                ? ((t.rawResponse =
                    void 0 === r.xhr.responseType ? r.xhr.responseText : r.xhr.response),
                  (t.status = r.xhr.status ? r.xhr.status : null),
                  (t.statusCode = t.status))
                : ((t.rawResponse = null), (t.status = null)),
              r.callback(t)
            )
          }
          r.emit('response', n)
          try {
            r._isResponseOK(n) ||
              (e = new Error(n.statusText || n.text || 'Unsuccessful HTTP response'))
          } catch (t) {
            e = t
          }
          e
            ? ((e.original = t), (e.response = n), (e.status = n.status), r.callback(e, n))
            : r.callback(null, n)
        })
    }
    function _(e, t, r) {
      var n = f('DELETE', e)
      return 'function' == typeof t && ((r = t), (t = null)), t && n.send(t), r && n.end(r), n
    }
    ;(f.serializeObject = d),
      (f.parseString = m),
      (f.types = {
        html: 'text/html',
        json: 'application/json',
        xml: 'text/xml',
        urlencoded: 'application/x-www-form-urlencoded',
        form: 'application/x-www-form-urlencoded',
        'form-data': 'application/x-www-form-urlencoded',
      }),
      (f.serialize = { 'application/x-www-form-urlencoded': d, 'application/json': s }),
      (f.parse = { 'application/x-www-form-urlencoded': m, 'application/json': JSON.parse }),
      u(v.prototype),
      (v.prototype._parseBody = function (e) {
        var t = f.parse[this.type]
        return this.req._parser
          ? this.req._parser(this, e)
          : (!t && b(this.type) && (t = f.parse['application/json']),
            t && e && (e.length > 0 || e instanceof Object) ? t(e) : null)
      }),
      (v.prototype.toError = function () {
        var e = this.req,
          t = e.method,
          r = e.url,
          n = 'cannot '.concat(t, ' ').concat(r, ' (').concat(this.status, ')'),
          o = new Error(n)
        return (o.status = this.status), (o.method = t), (o.url = r), o
      }),
      (f.Response = v),
      i(g.prototype),
      a(g.prototype),
      (g.prototype.type = function (e) {
        return this.set('Content-Type', f.types[e] || e), this
      }),
      (g.prototype.accept = function (e) {
        return this.set('Accept', f.types[e] || e), this
      }),
      (g.prototype.auth = function (e, t, r) {
        1 === arguments.length && (t = ''),
          'object' === n(t) && null !== t && ((r = t), (t = '')),
          r || (r = { type: 'function' == typeof btoa ? 'basic' : 'auto' })
        var o = function (e) {
          if ('function' == typeof btoa) return btoa(e)
          throw new Error('Cannot use basic auth, btoa is not a function')
        }
        return this._auth(e, t, r, o)
      }),
      (g.prototype.query = function (e) {
        return 'string' != typeof e && (e = d(e)), e && this._query.push(e), this
      }),
      (g.prototype.attach = function (e, t, r) {
        if (t) {
          if (this._data) throw new Error("superagent can't mix .send() and .attach()")
          this._getFormData().append(e, t, r || t.name)
        }
        return this
      }),
      (g.prototype._getFormData = function () {
        return this._formData || (this._formData = new o.FormData()), this._formData
      }),
      (g.prototype.callback = function (e, t) {
        if (this._shouldRetry(e, t)) return this._retry()
        var r = this._callback
        this.clearTimeout(),
          e && (this._maxRetries && (e.retries = this._retries - 1), this.emit('error', e)),
          r(e, t)
      }),
      (g.prototype.crossDomainError = function () {
        var e = new Error(
          'Request has been terminated\nPossible causes: the network is offline, Origin is not allowed by Access-Control-Allow-Origin, the page is being unloaded, etc.'
        )
        ;(e.crossDomain = !0),
          (e.status = this.status),
          (e.method = this.method),
          (e.url = this.url),
          this.callback(e)
      }),
      (g.prototype.agent = function () {
        return console.warn('This is not supported in browser version of superagent'), this
      }),
      (g.prototype.ca = g.prototype.agent),
      (g.prototype.buffer = g.prototype.ca),
      (g.prototype.write = function () {
        throw new Error('Streaming is not supported in browser version of superagent')
      }),
      (g.prototype.pipe = g.prototype.write),
      (g.prototype._isHost = function (e) {
        return (
          e &&
          'object' === n(e) &&
          !Array.isArray(e) &&
          '[object Object]' !== Object.prototype.toString.call(e)
        )
      }),
      (g.prototype.end = function (e) {
        this._endCalled &&
          console.warn('Warning: .end() was called twice. This is not supported in superagent'),
          (this._endCalled = !0),
          (this._callback = e || h),
          this._finalizeQueryString(),
          this._end()
      }),
      (g.prototype._setUploadTimeout = function () {
        var e = this
        this._uploadTimeout &&
          !this._uploadTimeoutTimer &&
          (this._uploadTimeoutTimer = setTimeout(function () {
            e._timeoutError('Upload timeout of ', e._uploadTimeout, 'ETIMEDOUT')
          }, this._uploadTimeout))
      }),
      (g.prototype._end = function () {
        if (this._aborted)
          return this.callback(
            new Error('The request has been aborted even before .end() was called')
          )
        var e = this
        this.xhr = f.getXHR()
        var t = this.xhr,
          r = this._formData || this._data
        this._setTimeouts(),
          (t.onreadystatechange = function () {
            var r = t.readyState
            if (
              (r >= 2 && e._responseTimeoutTimer && clearTimeout(e._responseTimeoutTimer), 4 === r)
            ) {
              var n
              try {
                n = t.status
              } catch (e) {
                n = 0
              }
              if (!n) {
                if (e.timedout || e._aborted) return
                return e.crossDomainError()
              }
              e.emit('end')
            }
          })
        var n = function (t, r) {
          r.total > 0 &&
            ((r.percent = (r.loaded / r.total) * 100),
            100 === r.percent && clearTimeout(e._uploadTimeoutTimer)),
            (r.direction = t),
            e.emit('progress', r)
        }
        if (this.hasListeners('progress'))
          try {
            t.addEventListener('progress', n.bind(null, 'download')),
              t.upload && t.upload.addEventListener('progress', n.bind(null, 'upload'))
          } catch (e) {}
        t.upload && this._setUploadTimeout()
        try {
          this.username && this.password
            ? t.open(this.method, this.url, !0, this.username, this.password)
            : t.open(this.method, this.url, !0)
        } catch (e) {
          return this.callback(e)
        }
        if (
          (this._withCredentials && (t.withCredentials = !0),
          !this._formData &&
            'GET' !== this.method &&
            'HEAD' !== this.method &&
            'string' != typeof r &&
            !this._isHost(r))
        ) {
          var o = this._header['content-type'],
            i = this._serializer || f.serialize[o ? o.split(';')[0] : '']
          !i && b(o) && (i = f.serialize['application/json']), i && (r = i(r))
        }
        for (var s in this.header)
          null !== this.header[s] &&
            Object.prototype.hasOwnProperty.call(this.header, s) &&
            t.setRequestHeader(s, this.header[s])
        this._responseType && (t.responseType = this._responseType),
          this.emit('request', this),
          t.send(void 0 === r ? null : r)
      }),
      (f.agent = function () {
        return new l()
      }),
      ['GET', 'POST', 'OPTIONS', 'PATCH', 'PUT', 'DELETE'].forEach(function (e) {
        l.prototype[e.toLowerCase()] = function (t, r) {
          var n = new f.Request(e, t)
          return this._setDefaults(n), r && n.end(r), n
        }
      }),
      (l.prototype.del = l.prototype.delete),
      (f.get = function (e, t, r) {
        var n = f('GET', e)
        return 'function' == typeof t && ((r = t), (t = null)), t && n.query(t), r && n.end(r), n
      }),
      (f.head = function (e, t, r) {
        var n = f('HEAD', e)
        return 'function' == typeof t && ((r = t), (t = null)), t && n.query(t), r && n.end(r), n
      }),
      (f.options = function (e, t, r) {
        var n = f('OPTIONS', e)
        return 'function' == typeof t && ((r = t), (t = null)), t && n.send(t), r && n.end(r), n
      }),
      (f.del = _),
      (f.delete = _),
      (f.patch = function (e, t, r) {
        var n = f('PATCH', e)
        return 'function' == typeof t && ((r = t), (t = null)), t && n.send(t), r && n.end(r), n
      }),
      (f.post = function (e, t, r) {
        var n = f('POST', e)
        return 'function' == typeof t && ((r = t), (t = null)), t && n.send(t), r && n.end(r), n
      }),
      (f.put = function (e, t, r) {
        var n = f('PUT', e)
        return 'function' == typeof t && ((r = t), (t = null)), t && n.send(t), r && n.end(r), n
      })
  },
  function (e, t, r) {
    'use strict'
    function n(e) {
      return (n =
        'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
          ? function (e) {
              return typeof e
            }
          : function (e) {
              return e &&
                'function' == typeof Symbol &&
                e.constructor === Symbol &&
                e !== Symbol.prototype
                ? 'symbol'
                : typeof e
            })(e)
    }
    e.exports = function (e) {
      return null !== e && 'object' === n(e)
    }
  },
  function (e, t) {
    e.exports = function (e) {
      return e && e.__esModule ? e : { default: e }
    }
  },
  function (e, t, r) {
    'use strict'
    Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = void 0)
    var n = r(4),
      o = a(r(36)),
      i = a(r(0))
    function s() {
      if ('function' != typeof WeakMap) return null
      var e = new WeakMap()
      return (
        (s = function () {
          return e
        }),
        e
      )
    }
    function a(e) {
      if (e && e.__esModule) return e
      if (null === e || ('object' !== c(e) && 'function' != typeof e)) return { default: e }
      var t = s()
      if (t && t.has(e)) return t.get(e)
      var r = {},
        n = Object.defineProperty && Object.getOwnPropertyDescriptor
      for (var o in e)
        if (Object.prototype.hasOwnProperty.call(e, o)) {
          var i = n ? Object.getOwnPropertyDescriptor(e, o) : null
          i && (i.get || i.set) ? Object.defineProperty(r, o, i) : (r[o] = e[o])
        }
      return (r.default = e), t && t.set(e, r), r
    }
    function c(e) {
      return (c =
        'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
          ? function (e) {
              return typeof e
            }
          : function (e) {
              return e &&
                'function' == typeof Symbol &&
                e.constructor === Symbol &&
                e !== Symbol.prototype
                ? 'symbol'
                : typeof e
            })(e)
    }
    function u(e, t) {
      if (!(e instanceof t)) throw new TypeError('Cannot call a class as a function')
    }
    function l(e, t) {
      for (var r, n = 0; n < t.length; n++)
        ((r = t[n]).enumerable = r.enumerable || !1),
          (r.configurable = !0),
          'value' in r && (r.writable = !0),
          Object.defineProperty(e, r.key, r)
    }
    function h(e, t, r) {
      return (h =
        'undefined' != typeof Reflect && Reflect.get
          ? Reflect.get
          : function (e, t, r) {
              var n = (function (e, t) {
                for (; !Object.prototype.hasOwnProperty.call(e, t) && null !== (e = y(e)); );
                return e
              })(e, t)
              if (n) {
                var o = Object.getOwnPropertyDescriptor(n, t)
                return o.get ? o.get.call(r) : o.value
              }
            })(e, t, r || e)
    }
    function f(e, t) {
      return (f =
        Object.setPrototypeOf ||
        function (e, t) {
          return (e.__proto__ = t), e
        })(e, t)
    }
    function p(e) {
      var t = (function () {
        if ('undefined' == typeof Reflect || !Reflect.construct) return !1
        if (Reflect.construct.sham) return !1
        if ('function' == typeof Proxy) return !0
        try {
          return Date.prototype.toString.call(Reflect.construct(Date, [], function () {})), !0
        } catch (e) {
          return !1
        }
      })()
      return function () {
        var r,
          n = y(e)
        if (t) {
          var o = y(this).constructor
          r = Reflect.construct(n, arguments, o)
        } else r = n.apply(this, arguments)
        return d(this, r)
      }
    }
    function d(e, t) {
      return !t || ('object' !== c(t) && 'function' != typeof t)
        ? (function (e) {
            if (void 0 === e)
              throw new ReferenceError("this hasn't been initialised - super() hasn't been called")
            return e
          })(e)
        : t
    }
    function y(e) {
      return (y = Object.setPrototypeOf
        ? Object.getPrototypeOf
        : function (e) {
            return e.__proto__ || Object.getPrototypeOf(e)
          })(e)
    }
    var m = /^(\d+)-(\d+)\/(\d+)$/,
      b = (function (e) {
        function t(e, n) {
          var o,
            i = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : {}
          if ((u(this, t), (o = r.call(this, e, n)).set('Accept', 'application/json'), {} != i))
            for (var s in i) o.set(s, i[s])
          return o.get || (o.get = o.getHeader), o
        }
        !(function (e, t) {
          if ('function' != typeof t && null !== t)
            throw new TypeError('Super expression must either be null or a function')
          ;(e.prototype = Object.create(t && t.prototype, {
            constructor: { value: e, writable: !0, configurable: !0 },
          })),
            t && f(e, t)
        })(t, e)
        var r = p(t)
        return (
          (function (e, t, r) {
            t && l(e.prototype, t), r && l(e, r)
          })(t, [
            {
              key: 'auth',
              value: function (e, r) {
                return 'string' == typeof e && null == r
                  ? (this.set('Authorization', 'Bearer '.concat(e)), this)
                  : ('object' === c(e) && null == r && ((r = e.pass), (e = e.user)),
                    h(y(t.prototype), 'auth', this).call(this, e, r))
              },
            },
            {
              key: 'filter',
              value: function (e, t, r) {
                if (
                  ['in', 'cs', 'cd', 'ova', 'ovr', 'sl', 'sr', 'nxr', 'nxl', 'adj'].includes(t) &&
                  !Array.isArray(r)
                )
                  return {
                    body: null,
                    status: 400,
                    statusCode: 400,
                    statusText: '.'.concat(
                      t,
                      '() cannot be invoked with criteria that is not an Array.'
                    ),
                  }
                if (['ovr', 'sl', 'sr', 'nxr', 'nxl', 'adj'].includes(t) && 2 != r.length)
                  return {
                    body: null,
                    status: 400,
                    statusCode: 400,
                    statusText: '.'.concat(
                      t,
                      '() can only be invoked with a criteria that is an Array of length 2.'
                    ),
                  }
                if (['fts', 'plfts', 'phfts', 'wfts'].includes(t) && void 0 === r.queryText)
                  return {
                    body: null,
                    status: 400,
                    statusCode: 400,
                    statusText: '.'.concat(
                      t,
                      '() can only be invoked with a criteria that is an Object with key queryText.'
                    ),
                  }
                var n = o['_'.concat(t.toLowerCase())](e, r)
                return this.query(n)
              },
            },
            {
              key: 'not',
              value: function (e, t, r) {
                var n = o['_'.concat(t.toLowerCase())](e, r),
                  i = ''.concat(n.split('=')[0], '=not.').concat(n.split('=')[1])
                return this.query(i)
              },
            },
            {
              key: 'match',
              value: function (e) {
                var t = this
                return (
                  Object.keys(e).forEach(function (r) {
                    t.query(''.concat(r, '=eq.').concat(e[r]))
                  }),
                  this
                )
              },
            },
            {
              key: 'select',
              value: function (e) {
                return e && this.query({ select: e.replace(/\s/g, '') }), this
              },
            },
            {
              key: 'order',
              value: function (e) {
                var t = !!(1 < arguments.length && void 0 !== arguments[1]) && arguments[1],
                  r = !!(2 < arguments.length && void 0 !== arguments[2]) && arguments[2],
                  n = i.cleanColumnName(e),
                  o = n.cleanedColumnName,
                  s = n.foreignTableName
                return (
                  this.query(
                    ''
                      .concat(null == s ? '' : ''.concat(s, '.'), 'order=')
                      .concat(o, '.')
                      .concat(t ? 'asc' : 'desc', '.')
                      .concat(r ? 'nullsfirst' : 'nullslast')
                  ),
                  this
                )
              },
            },
            {
              key: 'limit',
              value: function (e) {
                var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : null
                return 'number' == typeof e
                  ? (this.query(''.concat(null == t ? '' : ''.concat(t, '.'), 'limit=').concat(e)),
                    this)
                  : {
                      body: null,
                      status: 400,
                      statusCode: 400,
                      statusText: '.limit() cannot be invoked with criteria that is not a number.',
                    }
              },
            },
            {
              key: 'offset',
              value: function (e) {
                var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : null
                return 'number' == typeof e
                  ? (this.query(''.concat(null == t ? '' : ''.concat(t, '.'), 'offset=').concat(e)),
                    this)
                  : {
                      body: null,
                      status: 400,
                      statusCode: 400,
                      statusText: '.offset() cannot be invoked with criteria that is not a number.',
                    }
              },
            },
            {
              key: 'range',
              value: function (e) {
                var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : null
                if ('number' != typeof e || ('number' != typeof t && null != t))
                  return {
                    body: null,
                    status: 400,
                    statusCode: 400,
                    statusText: '.range() cannot be invoked with parameters that are not numbers.',
                  }
                var r = null == t ? '' : t
                return (
                  this.set('Range-Unit', 'items'),
                  this.set('Range', ''.concat(e, '-').concat(r)),
                  this
                )
              },
            },
            {
              key: 'single',
              value: function () {
                return (
                  this.set('Accept', 'application/vnd.pgrst.object+json'),
                  this.set('Prefer', 'return=representation'),
                  this
                )
              },
            },
            {
              key: 'end',
              value: function () {
                var e = this
                return new Promise(function (r, n) {
                  if (['DELETE', 'PATCH'].includes(e.method) && 0 == e._query.length) {
                    var o = 'DELETE' === e.method ? '.delete()' : '.update()'
                    return r({
                      body: null,
                      status: 400,
                      statusCode: 400,
                      statusText: ''.concat(o, ' cannot be invoked without any filters.'),
                    })
                  }
                  h(y(t.prototype), 'end', e).call(e, function (e, t) {
                    if (e) return n(e)
                    var o = t.body,
                      i = t.headers,
                      s = t.status,
                      a = t.statusCode,
                      c = t.statusText,
                      u = i['content-range']
                    return (
                      Array.isArray(o) &&
                        u &&
                        m.test(u) &&
                        (o.fullLength = parseInt(m.exec(u)[3], 10)),
                      r({ body: o, status: s, statusCode: a, statusText: c })
                    )
                  })
                })
              },
            },
            {
              key: 'then',
              value: function (e, t) {
                return this.end().then(e, t)
              },
            },
            {
              key: 'catch',
              value: function (e) {
                return this.end().catch(e)
              },
            },
          ]),
          t
        )
      })(n.Request)
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
      'fts',
      'plfts',
      'phfts',
      'wfts',
      'cs',
      'cd',
      'ova',
      'ovr',
      'sl',
      'sr',
      'nxr',
      'nxl',
      'adj',
      'or',
    ].forEach(function (e) {
      return (b.prototype[e] = function (t, r) {
        return this.filter(t, e, r)
      })
    })
    var v = b
    t.default = v
  },
  function (e, t, r) {
    var n, o, i
    'undefined' == typeof globalThis ? 'undefined' == typeof self || self : globalThis,
      (o = [t, r(9), r(10), r(26), r(34)]),
      void 0 ===
        (i =
          'function' ==
          typeof (n = function (e, t, n, o, i) {
            'use strict'
            var s = r(6)
            Object.defineProperty(e, '__esModule', { value: !0 }),
              (e.createClient = void 0),
              (n = s(n))
            class a {
              constructor(e, t) {
                var r =
                  2 < arguments.length && void 0 !== arguments[2]
                    ? arguments[2]
                    : { autoRefreshToken: !0 }
                ;(this.supabaseUrl = null),
                  (this.supabaseKey = null),
                  (this.restUrl = null),
                  (this.realtimeUrl = null),
                  (this.authUrl = null),
                  (this.schema = 'public'),
                  (this.subscriptions = {}),
                  (this.tableName = null),
                  (this.queryFilters = []),
                  r.schema && (this.schema = r.schema),
                  this.authenticate(e, t),
                  (this.auth = new o.Auth(this.authUrl, t, {
                    autoRefreshToken: r.autoRefreshToken,
                  }))
              }
              authenticate(e, t) {
                ;(this.supabaseUrl = e),
                  (this.supabaseKey = t),
                  (this.restUrl = ''.concat(e, '/rest/v1')),
                  (this.realtimeUrl = ''.concat(e, '/realtime/v1').replace('http', 'ws')),
                  (this.authUrl = ''.concat(e, '/auth/v1'))
              }
              clear() {
                ;(this.tableName = null), (this.queryFilters = [])
              }
              from(e) {
                return (this.tableName = e), this
              }
              on(e, r) {
                var o = (0, t.uuid)()
                return (
                  (this.subscriptions[o] = new n.default(
                    this.tableName,
                    this.realtimeUrl,
                    this.schema,
                    this.supabaseKey,
                    o,
                    e,
                    r,
                    this.queryFilters
                  )),
                  this.clear(),
                  this.subscriptions[o]
                )
              }
              getSubscriptions() {
                return Object.values(this.subscriptions)
              }
              removeSubscription(e) {
                e.unsubscribe(), delete this.subscriptions[e.uuid]
              }
              rpc(e) {
                var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : null
                return new i.PostgrestClient(this.restUrl, {
                  headers: { apikey: this.supabaseKey },
                  schema: this.schema,
                }).rpc(e, t)
              }
              initClient() {
                var e = { apikey: this.supabaseKey }
                45 < this.supabaseKey.length &&
                  this.auth.authHeader() &&
                  (e.Authorization = this.auth.authHeader())
                var t = new i.PostgrestClient(this.restUrl, {
                  headers: e,
                  schema: this.schema,
                }).from(this.tableName)
                return (
                  this.queryFilters.forEach((e) => {
                    switch (e.filter) {
                      case 'filter':
                        t.filter(e.columnName, e.operator, e.criteria)
                        break
                      case 'match':
                        t.match(e.query)
                        break
                      case 'order':
                        t.order(e.property, e.ascending, e.nullsFirst)
                        break
                      case 'range':
                        t.range(e.from, e.to)
                        break
                      case 'single':
                        t.single()
                    }
                  }),
                  this.clear(),
                  t
                )
              }
              select() {
                var e = 0 < arguments.length && void 0 !== arguments[0] ? arguments[0] : '*',
                  t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : {}
                return this.initClient().select(e, t)
              }
              insert(e) {
                var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : {}
                return this.initClient().insert(e, t)
              }
              update(e) {
                var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : {}
                return this.initClient().update(e, t)
              }
              delete() {
                var e = 0 < arguments.length && void 0 !== arguments[0] ? arguments[0] : {}
                return this.initClient().delete(e)
              }
              filter(e, t, r) {
                return (
                  this.queryFilters.push({
                    filter: 'filter',
                    columnName: e,
                    operator: t,
                    criteria: r,
                  }),
                  this
                )
              }
              match(e) {
                return this.queryFilters.push({ filter: 'match', query: e }), this
              }
              order(e) {
                var t = !!(1 < arguments.length && void 0 !== arguments[1]) && arguments[1],
                  r = !!(2 < arguments.length && void 0 !== arguments[2]) && arguments[2]
                return (
                  this.queryFilters.push({
                    filter: 'order',
                    property: e,
                    ascending: t,
                    nullsFirst: r,
                  }),
                  this
                )
              }
              range(e, t) {
                return this.queryFilters.push({ filter: 'range', from: e, to: t }), this
              }
              single() {
                return this.queryFilters.push({ filter: 'single' }), this
              }
            }
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
              (e) =>
                (a.prototype[e] = function (t, r) {
                  return this.filter(t, e, r)
                })
            ),
              (e.createClient = function (e, t) {
                var r = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : {}
                return new a(e, t, r)
              })
          })
            ? n.apply(t, o)
            : n) || (e.exports = i)
  },
  function (e, t, r) {
    var n, o, i
    'undefined' == typeof globalThis ? 'undefined' == typeof self || self : globalThis,
      (o = [t]),
      void 0 ===
        (i =
          'function' ==
          typeof (n = function (e) {
            'use strict'
            Object.defineProperty(e, '__esModule', { value: !0 }),
              (e.uuid = function () {
                function e() {
                  return Math.floor(65536 * (1 + Math.random()))
                    .toString(16)
                    .substring(1)
                }
                return e() + e() + '-' + e() + '-' + e() + '-' + e() + '-' + e() + e() + e()
              })
          })
            ? n.apply(t, o)
            : n) || (e.exports = i)
  },
  function (e, t, r) {
    var n, o, i
    'undefined' == typeof globalThis ? 'undefined' == typeof self || self : globalThis,
      (o = [t, r(11), r(23)]),
      void 0 ===
        (i =
          'function' ==
          typeof (n = function (e, t, n) {
            'use strict'
            var o = r(24)
            Object.defineProperty(e, '__esModule', { value: !0 }),
              (e.default = void 0),
              (n = o(n)),
              (e.default = class {
                constructor(e, t, r, n, o, i, s, a) {
                  ;(this.tableName = e),
                    (this.realtimeUrl = t),
                    (this.schema = r),
                    (this.apikey = n),
                    (this.uuid = o),
                    (this.socket = null),
                    (this.channel = null),
                    (this.listeners = {}),
                    (this.queryFilters = a),
                    this.on(i, s)
                }
                createListener() {
                  var e = ''.concat(this.realtimeUrl),
                    r = ''
                  this.queryFilters.forEach((e) => {
                    switch (e.filter) {
                      case 'filter':
                        'eq' === e.operator &&
                          (r = ':'
                            .concat(e.columnName, '=')
                            .concat(e.operator, '.')
                            .concat(e.criteria))
                    }
                  })
                  var n =
                    '*' == this.tableName
                      ? 'realtime:*'
                      : 'realtime:'.concat(this.schema, ':').concat(this.tableName).concat(r)
                  ;(this.socket = new t.Socket(e, { params: { apikey: this.apikey } })),
                    (this.channel = this.socket.channel(n)),
                    this.socket.onOpen(() => {
                      console.debug(''.concat(this.realtimeUrl, ': REALTIME CONNECTED'))
                    }),
                    this.socket.onClose(() => {
                      console.debug(''.concat(this.realtimeUrl, ': REALTIME DISCONNECTED'))
                    })
                }
                on(e, t) {
                  return (
                    null == this.socket && this.createListener(),
                    this.channel.on(e, (e) => {
                      var r = {
                          schema: e.schema,
                          table: e.table,
                          commit_timestamp: e.commit_timestamp,
                        },
                        o = {},
                        i = {},
                        s = {}
                      switch (e.type) {
                        case 'INSERT':
                          ;(o = n.convertChangeData(e.columns, e.record)),
                            (r.eventType = 'INSERT'),
                            (r.new = o)
                          break
                        case 'UPDATE':
                          ;(i = n.convertChangeData(e.columns, e.old_record)),
                            (o = n.convertChangeData(e.columns, e.record)),
                            Object.keys(i).forEach((e) => {
                              null != i[e] && (s[e] = i[e])
                            }),
                            (r.eventType = 'UPDATE'),
                            (r.old = s),
                            (r.new = o)
                          break
                        case 'DELETE':
                          ;(i = n.convertChangeData(e.columns, e.old_record)),
                            Object.keys(i).forEach((e) => {
                              null != i[e] && (s[e] = i[e])
                            }),
                            (r.eventType = 'DELETE'),
                            (r.old = s)
                      }
                      t(r)
                    }),
                    (this.listeners[e] = t),
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
                        .receive('ok', (e) =>
                          console.debug(
                            ''.concat(this.realtimeUrl, ': Joined Realtime successfully '),
                            e
                          )
                        )
                        .receive('error', (e) =>
                          console.debug(''.concat(this.realtimeUrl, ': Unable to join '), e)
                        )
                        .receive('timeout', () =>
                          console.debug(
                            ''.concat(this.realtimeUrl, ': Network timeout. Still waiting...')
                          )
                        ),
                    this
                  )
                }
                unsubscribe() {
                  return this.socket && this.socket.disconnect(), this
                }
              })
          })
            ? n.apply(t, o)
            : n) || (e.exports = i)
  },
  function (e, t, r) {
    e.exports = { Channel: r(1), Socket: r(13), Presence: r(22) }
  },
  function (e, t) {
    e.exports = class {
      constructor(e, t, r, n) {
        ;(this.channel = e),
          (this.event = t),
          (this.payload = r || {}),
          (this.receivedResp = null),
          (this.timeout = n),
          (this.timeoutTimer = null),
          (this.recHooks = []),
          (this.sent = !1)
      }
      resend(e) {
        ;(this.timeout = e),
          this.cancelRefEvent(),
          (this.ref = null),
          (this.refEvent = null),
          (this.receivedResp = null),
          (this.sent = !1),
          this.send()
      }
      send() {
        this.hasReceived('timeout') ||
          (this.startTimeout(),
          (this.sent = !0),
          this.channel.socket.push({
            topic: this.channel.topic,
            event: this.event,
            payload: this.payload,
            ref: this.ref,
          }))
      }
      receive(e, t) {
        return (
          this.hasReceived(e) && t(this.receivedResp.response),
          this.recHooks.push({ status: e, callback: t }),
          this
        )
      }
      matchReceive({ status: e, response: t, ref: r }) {
        this.recHooks.filter((t) => t.status === e).forEach((e) => e.callback(t))
      }
      cancelRefEvent() {
        this.refEvent && this.channel.off(this.refEvent)
      }
      cancelTimeout() {
        clearTimeout(this.timeoutTimer), (this.timeoutTimer = null)
      }
      startTimeout() {
        this.timeoutTimer ||
          ((this.ref = this.channel.socket.makeRef()),
          (this.refEvent = this.channel.replyEventName(this.ref)),
          this.channel.on(this.refEvent, (e) => {
            this.cancelRefEvent(),
              this.cancelTimeout(),
              (this.receivedResp = e),
              this.matchReceive(e)
          }),
          (this.timeoutTimer = setTimeout(() => {
            this.trigger('timeout', {})
          }, this.timeout)))
      }
      hasReceived(e) {
        return this.receivedResp && this.receivedResp.status === e
      }
      trigger(e, t) {
        this.channel.trigger(this.refEvent, { status: e, response: t })
      }
    }
  },
  function (e, t, r) {
    const {
        VSN: n,
        CHANNEL_EVENTS: o,
        TRANSPORTS: i,
        SOCKET_STATES: s,
        DEFAULT_TIMEOUT: a,
        WS_CLOSE_NORMAL: c,
      } = r(2),
      u = r(14),
      l = r(18).w3cwebsocket,
      h = r(3),
      f = r(1)
    e.exports = class {
      constructor(e, t = {}) {
        ;(this.stateChangeCallbacks = { open: [], close: [], error: [], message: [] }),
          (this.channels = []),
          (this.sendBuffer = []),
          (this.ref = 0),
          (this.timeout = t.timeout || a),
          (this.transport = t.transport || l),
          (this.defaultEncoder = (e, t) => t(JSON.stringify(e))),
          (this.defaultDecoder = (e, t) => t(JSON.parse(e))),
          (this.encode = t.encode || this.defaultEncoder),
          (this.decode = t.decode || this.defaultDecoder),
          (this.heartbeatIntervalMs = t.heartbeatIntervalMs || 3e4),
          (this.reconnectAfterMs =
            t.reconnectAfterMs ||
            function (e) {
              return [1e3, 2e3, 5e3, 1e4][e - 1] || 1e4
            }),
          (this.logger = t.logger || function () {}),
          (this.longpollerTimeout = t.longpollerTimeout || 2e4),
          (this.params = t.params || {}),
          (this.headers = t.headers || {}),
          (this.endPoint = `${e}/${i.websocket}`),
          (this.heartbeatTimer = null),
          (this.pendingHeartbeatRef = null),
          (this.reconnectTimer = new h(() => {
            this.disconnect(() => this.connect())
          }, this.reconnectAfterMs))
      }
      endPointURL() {
        return this.appendParams(this.endPoint, Object.assign({}, this.params, { vsn: n }))
      }
      appendParams(e, t) {
        if (0 === Object.keys(t).length) return e
        let r = e.match(/\?/) ? '&' : '?'
        return `${e}${r}${u.stringify(t)}`
      }
      disconnect(e, t, r) {
        this.conn &&
          ((this.conn.onclose = function () {}),
          t ? this.conn.close(t, r || '') : this.conn.close(),
          (this.conn = null)),
          e && e()
      }
      connect() {
        this.conn ||
          ((this.conn = new this.transport(this.endPointURL(), [], null, this.headers)),
          (this.conn.timeout = this.longpollerTimeout),
          (this.conn.onopen = () => this.onConnOpen()),
          (this.conn.onerror = (e) => this.onConnError(e)),
          (this.conn.onmessage = (e) => this.onConnMessage(e)),
          (this.conn.onclose = (e) => this.onConnClose(e)))
      }
      log(e, t, r) {
        this.logger(e, t, r)
      }
      onOpen(e) {
        this.stateChangeCallbacks.open.push(e)
      }
      onClose(e) {
        this.stateChangeCallbacks.close.push(e)
      }
      onError(e) {
        this.stateChangeCallbacks.error.push(e)
      }
      onMessage(e) {
        this.stateChangeCallbacks.message.push(e)
      }
      onConnOpen() {
        this.log('transport', 'connected to ' + this.endPointURL()),
          this.flushSendBuffer(),
          this.reconnectTimer.reset(),
          this.conn.skipHeartbeat ||
            (clearInterval(this.heartbeatTimer),
            (this.heartbeatTimer = setInterval(
              () => this.sendHeartbeat(),
              this.heartbeatIntervalMs
            ))),
          this.stateChangeCallbacks.open.forEach((e) => e())
      }
      onConnClose(e) {
        this.log('transport', 'close', e),
          this.triggerChanError(),
          clearInterval(this.heartbeatTimer),
          this.reconnectTimer.scheduleTimeout(),
          this.stateChangeCallbacks.close.forEach((t) => t(e))
      }
      onConnError(e) {
        this.log('transport', e),
          this.triggerChanError(),
          this.stateChangeCallbacks.error.forEach((t) => t(e))
      }
      triggerChanError() {
        this.channels.forEach((e) => e.trigger(o.error))
      }
      connectionState() {
        switch (this.conn && this.conn.readyState) {
          case s.connecting:
            return 'connecting'
          case s.open:
            return 'open'
          case s.closing:
            return 'closing'
          default:
            return 'closed'
        }
      }
      isConnected() {
        return 'open' === this.connectionState()
      }
      remove(e) {
        this.channels = this.channels.filter((t) => t.joinRef() !== e.joinRef())
      }
      channel(e, t = {}) {
        let r = new f(e, t, this)
        return this.channels.push(r), r
      }
      push(e) {
        let { topic: t, event: r, payload: n, ref: o } = e,
          i = () => {
            this.encode(e, (e) => {
              this.conn.send(e)
            })
          }
        this.log('push', `${t} ${r} (${o})`, n), this.isConnected() ? i() : this.sendBuffer.push(i)
      }
      makeRef() {
        let e = this.ref + 1
        return e === this.ref ? (this.ref = 0) : (this.ref = e), this.ref.toString()
      }
      sendHeartbeat() {
        if (this.isConnected()) {
          if (this.pendingHeartbeatRef)
            return (
              (this.pendingHeartbeatRef = null),
              this.log('transport', 'heartbeat timeout. Attempting to re-establish connection'),
              void this.conn.close(c, 'hearbeat timeout')
            )
          ;(this.pendingHeartbeatRef = this.makeRef()),
            this.push({
              topic: 'phoenix',
              event: 'heartbeat',
              payload: {},
              ref: this.pendingHeartbeatRef,
            })
        }
      }
      flushSendBuffer() {
        this.isConnected() &&
          this.sendBuffer.length > 0 &&
          (this.sendBuffer.forEach((e) => e()), (this.sendBuffer = []))
      }
      onConnMessage(e) {
        this.decode(e.data, (e) => {
          let { topic: t, event: r, payload: n, ref: o } = e
          o && o === this.pendingHeartbeatRef && (this.pendingHeartbeatRef = null),
            this.log('receive', `${n.status || ''} ${t} ${r} ${(o && '(' + o + ')') || ''}`, n),
            this.channels.filter((e) => e.isMember(t)).forEach((e) => e.trigger(r, n, o)),
            this.stateChangeCallbacks.message.forEach((t) => t(e))
        })
      }
    }
  },
  function (e, t, r) {
    'use strict'
    const n = r(15),
      o = r(16),
      i = r(17)
    function s(e) {
      if ('string' != typeof e || 1 !== e.length)
        throw new TypeError('arrayFormatSeparator must be single character string')
    }
    function a(e, t) {
      return t.encode ? (t.strict ? n(e) : encodeURIComponent(e)) : e
    }
    function c(e, t) {
      return t.decode ? o(e) : e
    }
    function u(e) {
      const t = e.indexOf('#')
      return -1 !== t && (e = e.slice(0, t)), e
    }
    function l(e) {
      const t = (e = u(e)).indexOf('?')
      return -1 === t ? '' : e.slice(t + 1)
    }
    function h(e, t) {
      return (
        t.parseNumbers && !Number.isNaN(Number(e)) && 'string' == typeof e && '' !== e.trim()
          ? (e = Number(e))
          : !t.parseBooleans ||
            null === e ||
            ('true' !== e.toLowerCase() && 'false' !== e.toLowerCase()) ||
            (e = 'true' === e.toLowerCase()),
        e
      )
    }
    function f(e, t) {
      s(
        (t = Object.assign(
          {
            decode: !0,
            sort: !0,
            arrayFormat: 'none',
            arrayFormatSeparator: ',',
            parseNumbers: !1,
            parseBooleans: !1,
          },
          t
        )).arrayFormatSeparator
      )
      const r = (function (e) {
          let t
          switch (e.arrayFormat) {
            case 'index':
              return (e, r, n) => {
                ;(t = /\[(\d*)\]$/.exec(e)),
                  (e = e.replace(/\[\d*\]$/, '')),
                  t ? (void 0 === n[e] && (n[e] = {}), (n[e][t[1]] = r)) : (n[e] = r)
              }
            case 'bracket':
              return (e, r, n) => {
                ;(t = /(\[\])$/.exec(e)),
                  (e = e.replace(/\[\]$/, '')),
                  t ? (void 0 !== n[e] ? (n[e] = [].concat(n[e], r)) : (n[e] = [r])) : (n[e] = r)
              }
            case 'comma':
            case 'separator':
              return (t, r, n) => {
                const o =
                  'string' == typeof r && r.split('').indexOf(e.arrayFormatSeparator) > -1
                    ? r.split(e.arrayFormatSeparator).map((t) => c(t, e))
                    : null === r
                    ? r
                    : c(r, e)
                n[t] = o
              }
            default:
              return (e, t, r) => {
                void 0 !== r[e] ? (r[e] = [].concat(r[e], t)) : (r[e] = t)
              }
          }
        })(t),
        n = Object.create(null)
      if ('string' != typeof e) return n
      if (!(e = e.trim().replace(/^[?#&]/, ''))) return n
      for (const o of e.split('&')) {
        let [e, s] = i(t.decode ? o.replace(/\+/g, ' ') : o, '=')
        ;(s = void 0 === s ? null : ['comma', 'separator'].includes(t.arrayFormat) ? s : c(s, t)),
          r(c(e, t), s, n)
      }
      for (const e of Object.keys(n)) {
        const r = n[e]
        if ('object' == typeof r && null !== r) for (const e of Object.keys(r)) r[e] = h(r[e], t)
        else n[e] = h(r, t)
      }
      return !1 === t.sort
        ? n
        : (!0 === t.sort ? Object.keys(n).sort() : Object.keys(n).sort(t.sort)).reduce((e, t) => {
            const r = n[t]
            return (
              Boolean(r) && 'object' == typeof r && !Array.isArray(r)
                ? (e[t] = (function e(t) {
                    return Array.isArray(t)
                      ? t.sort()
                      : 'object' == typeof t
                      ? e(Object.keys(t))
                          .sort((e, t) => Number(e) - Number(t))
                          .map((e) => t[e])
                      : t
                  })(r))
                : (e[t] = r),
              e
            )
          }, Object.create(null))
    }
    ;(t.extract = l),
      (t.parse = f),
      (t.stringify = (e, t) => {
        if (!e) return ''
        s(
          (t = Object.assign(
            { encode: !0, strict: !0, arrayFormat: 'none', arrayFormatSeparator: ',' },
            t
          )).arrayFormatSeparator
        )
        const r = (r) => (t.skipNull && null == e[r]) || (t.skipEmptyString && '' === e[r]),
          n = (function (e) {
            switch (e.arrayFormat) {
              case 'index':
                return (t) => (r, n) => {
                  const o = r.length
                  return void 0 === n ||
                    (e.skipNull && null === n) ||
                    (e.skipEmptyString && '' === n)
                    ? r
                    : null === n
                    ? [...r, [a(t, e), '[', o, ']'].join('')]
                    : [...r, [a(t, e), '[', a(o, e), ']=', a(n, e)].join('')]
                }
              case 'bracket':
                return (t) => (r, n) =>
                  void 0 === n || (e.skipNull && null === n) || (e.skipEmptyString && '' === n)
                    ? r
                    : null === n
                    ? [...r, [a(t, e), '[]'].join('')]
                    : [...r, [a(t, e), '[]=', a(n, e)].join('')]
              case 'comma':
              case 'separator':
                return (t) => (r, n) =>
                  null == n || 0 === n.length
                    ? r
                    : 0 === r.length
                    ? [[a(t, e), '=', a(n, e)].join('')]
                    : [[r, a(n, e)].join(e.arrayFormatSeparator)]
              default:
                return (t) => (r, n) =>
                  void 0 === n || (e.skipNull && null === n) || (e.skipEmptyString && '' === n)
                    ? r
                    : null === n
                    ? [...r, a(t, e)]
                    : [...r, [a(t, e), '=', a(n, e)].join('')]
            }
          })(t),
          o = {}
        for (const t of Object.keys(e)) r(t) || (o[t] = e[t])
        const i = Object.keys(o)
        return (
          !1 !== t.sort && i.sort(t.sort),
          i
            .map((r) => {
              const o = e[r]
              return void 0 === o
                ? ''
                : null === o
                ? a(r, t)
                : Array.isArray(o)
                ? o.reduce(n(r), []).join('&')
                : a(r, t) + '=' + a(o, t)
            })
            .filter((e) => e.length > 0)
            .join('&')
        )
      }),
      (t.parseUrl = (e, t) => {
        t = Object.assign({ decode: !0 }, t)
        const [r, n] = i(e, '#')
        return Object.assign(
          { url: r.split('?')[0] || '', query: f(l(e), t) },
          t && t.parseFragmentIdentifier && n ? { fragmentIdentifier: c(n, t) } : {}
        )
      }),
      (t.stringifyUrl = (e, r) => {
        r = Object.assign({ encode: !0, strict: !0 }, r)
        const n = u(e.url).split('?')[0] || '',
          o = t.extract(e.url),
          i = t.parse(o, { sort: !1 }),
          s = Object.assign(i, e.query)
        let c = t.stringify(s, r)
        c && (c = '?' + c)
        let l = (function (e) {
          let t = ''
          const r = e.indexOf('#')
          return -1 !== r && (t = e.slice(r)), t
        })(e.url)
        return e.fragmentIdentifier && (l = '#' + a(e.fragmentIdentifier, r)), `${n}${c}${l}`
      })
  },
  function (e, t, r) {
    'use strict'
    e.exports = (e) =>
      encodeURIComponent(e).replace(
        /[!'()*]/g,
        (e) => '%' + e.charCodeAt(0).toString(16).toUpperCase()
      )
  },
  function (e, t, r) {
    'use strict'
    var n = new RegExp('%[a-f0-9]{2}', 'gi'),
      o = new RegExp('(%[a-f0-9]{2})+', 'gi')
    function i(e, t) {
      try {
        return decodeURIComponent(e.join(''))
      } catch (e) {}
      if (1 === e.length) return e
      t = t || 1
      var r = e.slice(0, t),
        n = e.slice(t)
      return Array.prototype.concat.call([], i(r), i(n))
    }
    function s(e) {
      try {
        return decodeURIComponent(e)
      } catch (o) {
        for (var t = e.match(n), r = 1; r < t.length; r++) t = (e = i(t, r).join('')).match(n)
        return e
      }
    }
    e.exports = function (e) {
      if ('string' != typeof e)
        throw new TypeError('Expected `encodedURI` to be of type `string`, got `' + typeof e + '`')
      try {
        return (e = e.replace(/\+/g, ' ')), decodeURIComponent(e)
      } catch (t) {
        return (function (e) {
          for (var t = { '%FE%FF': '��', '%FF%FE': '��' }, r = o.exec(e); r; ) {
            try {
              t[r[0]] = decodeURIComponent(r[0])
            } catch (e) {
              var n = s(r[0])
              n !== r[0] && (t[r[0]] = n)
            }
            r = o.exec(e)
          }
          t['%C2'] = '�'
          for (var i = Object.keys(t), a = 0; a < i.length; a++) {
            var c = i[a]
            e = e.replace(new RegExp(c, 'g'), t[c])
          }
          return e
        })(e)
      }
    }
  },
  function (e, t, r) {
    'use strict'
    e.exports = (e, t) => {
      if ('string' != typeof e || 'string' != typeof t)
        throw new TypeError('Expected the arguments to be of type `string`')
      if ('' === t) return [e]
      const r = e.indexOf(t)
      return -1 === r ? [e] : [e.slice(0, r), e.slice(r + t.length)]
    }
  },
  function (e, t, r) {
    var n
    try {
      n = r(19)
    } catch (e) {
    } finally {
      if ((n || 'undefined' == typeof window || (n = window), !n))
        throw new Error('Could not determine global this')
    }
    var o = n.WebSocket || n.MozWebSocket,
      i = r(20)
    function s(e, t) {
      return t ? new o(e, t) : new o(e)
    }
    o &&
      ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'].forEach(function (e) {
        Object.defineProperty(s, e, {
          get: function () {
            return o[e]
          },
        })
      }),
      (e.exports = { w3cwebsocket: o ? s : null, version: i })
  },
  function (e, t) {
    var r = function () {
      if ('object' == typeof self && self) return self
      if ('object' == typeof window && window) return window
      throw new Error('Unable to resolve global `this`')
    }
    e.exports = (function () {
      if (this) return this
      if ('object' == typeof globalThis && globalThis) return globalThis
      try {
        Object.defineProperty(Object.prototype, '__global__', {
          get: function () {
            return this
          },
          configurable: !0,
        })
      } catch (e) {
        return r()
      }
      try {
        return __global__ || r()
      } finally {
        delete Object.prototype.__global__
      }
    })()
  },
  function (e, t, r) {
    e.exports = r(21).version
  },
  function (e) {
    e.exports = JSON.parse(
      '{"_from":"websocket@^1.0.31","_id":"websocket@1.0.31","_inBundle":false,"_integrity":"sha512-VAouplvGKPiKFDTeCCO65vYHsyay8DqoBSlzIO3fayrfOgU94lQN5a1uWVnFrMLceTJw/+fQXR5PGbUVRaHshQ==","_location":"/websocket","_phantomChildren":{},"_requested":{"type":"range","registry":true,"raw":"websocket@^1.0.31","name":"websocket","escapedName":"websocket","rawSpec":"^1.0.31","saveSpec":null,"fetchSpec":"^1.0.31"},"_requiredBy":["/@supabase/realtime-js"],"_resolved":"https://registry.npmjs.org/websocket/-/websocket-1.0.31.tgz","_shasum":"e5d0f16c3340ed87670e489ecae6144c79358730","_spec":"websocket@^1.0.31","_where":"/Users/copple/Projects/Supabase/supabase-js/node_modules/@supabase/realtime-js","author":{"name":"Brian McKelvey","email":"theturtle32@gmail.com","url":"https://github.com/theturtle32"},"browser":"lib/browser.js","bugs":{"url":"https://github.com/theturtle32/WebSocket-Node/issues"},"bundleDependencies":false,"config":{"verbose":false},"contributors":[{"name":"Iñaki Baz Castillo","email":"ibc@aliax.net","url":"http://dev.sipdoc.net"}],"dependencies":{"debug":"^2.2.0","es5-ext":"^0.10.50","nan":"^2.14.0","typedarray-to-buffer":"^3.1.5","yaeti":"^0.0.6"},"deprecated":false,"description":"Websocket Client & Server Library implementing the WebSocket protocol as specified in RFC 6455.","devDependencies":{"buffer-equal":"^1.0.0","faucet":"^0.0.1","gulp":"^4.0.2","gulp-jshint":"^2.0.4","jshint":"^2.0.0","jshint-stylish":"^2.2.1","tape":"^4.9.1"},"directories":{"lib":"./lib"},"engines":{"node":">=0.10.0"},"homepage":"https://github.com/theturtle32/WebSocket-Node","keywords":["websocket","websockets","socket","networking","comet","push","RFC-6455","realtime","server","client"],"license":"Apache-2.0","main":"index","name":"websocket","repository":{"type":"git","url":"git+https://github.com/theturtle32/WebSocket-Node.git"},"scripts":{"gulp":"gulp","install":"(node-gyp rebuild 2> builderror.log) || (exit 0)","test":"faucet test/unit"},"version":"1.0.31"}'
    )
  },
  function (e, t) {
    var r = {
      syncState(e, t, r, n) {
        let o = this.clone(e),
          i = {},
          s = {}
        return (
          this.map(o, (e, r) => {
            t[e] || (s[e] = r)
          }),
          this.map(t, (e, t) => {
            let r = o[e]
            if (r) {
              let n = t.metas.map((e) => e.phx_ref),
                o = r.metas.map((e) => e.phx_ref),
                a = t.metas.filter((e) => o.indexOf(e.phx_ref) < 0),
                c = r.metas.filter((e) => n.indexOf(e.phx_ref) < 0)
              a.length > 0 && ((i[e] = t), (i[e].metas = a)),
                c.length > 0 && ((s[e] = this.clone(r)), (s[e].metas = c))
            } else i[e] = t
          }),
          this.syncDiff(o, { joins: i, leaves: s }, r, n)
        )
      },
      syncDiff(e, { joins: t, leaves: r }, n, o) {
        let i = this.clone(e)
        return (
          n || (n = function () {}),
          o || (o = function () {}),
          this.map(t, (e, t) => {
            let r = i[e]
            ;(i[e] = t), r && i[e].metas.unshift(...r.metas), n(e, r, t)
          }),
          this.map(r, (e, t) => {
            let r = i[e]
            if (!r) return
            let n = t.metas.map((e) => e.phx_ref)
            ;(r.metas = r.metas.filter((e) => n.indexOf(e.phx_ref) < 0)),
              o(e, r, t),
              0 === r.metas.length && delete i[e]
          }),
          i
        )
      },
      list(e, t) {
        return (
          t ||
            (t = function (e, t) {
              return t
            }),
          this.map(e, (e, r) => t(e, r))
        )
      },
      map: (e, t) => Object.getOwnPropertyNames(e).map((r) => t(r, e[r])),
      clone: (e) => JSON.parse(JSON.stringify(e)),
    }
    e.exports = r
  },
  function (e, t, r) {
    var n, o, i
    'undefined' == typeof globalThis ? 'undefined' == typeof self || self : globalThis,
      (o = [t]),
      void 0 ===
        (i =
          'function' ==
          typeof (n = function (e) {
            'use strict'
            Object.defineProperty(e, '__esModule', { value: !0 }),
              (e.toTimestampString = e.toArray = e.toJson = e.toIntRange = e.toInt = e.toFloat = e.toDateRange = e.toDate = e.toBoolean = e.noop = e.convertCell = e.convertColumn = e.convertChangeData = void 0),
              (e.convertChangeData = function (e, r) {
                var n = 2 < arguments.length && void 0 !== arguments[2] ? arguments[2] : {},
                  o = {},
                  i = void 0 === n.skipTypes ? [] : n.skipTypes
                return (
                  Object.entries(r).map((n) => {
                    var [s, a] = n
                    o[s] = t(s, e, r, i)
                  }),
                  o
                )
              })
            var t = (e, t, o, i) => {
              var s = t.find((t) => t.name == e)
              return i.includes(s.type) ? n(o[e]) : r(s.type, o[e])
            }
            e.convertColumn = t
            var r = (e, t) => {
              try {
                if (null === t) return null
                if ('_' === e.charAt(0)) {
                  var r = e.slice(1, e.length)
                  return l(t, r)
                }
                return 'abstime' === e
                  ? n(t)
                  : 'bool' === e
                  ? o(t)
                  : 'date' === e
                  ? n(t)
                  : 'daterange' === e
                  ? i(t)
                  : 'float4' === e || 'float8' === e
                  ? s(t)
                  : 'int2' === e || 'int4' === e
                  ? a(t)
                  : 'int4range' === e
                  ? c(t)
                  : 'int8' === e
                  ? a(t)
                  : 'int8range' === e
                  ? c(t)
                  : 'json' === e || 'jsonb' === e
                  ? u(t)
                  : 'money' === e || 'numeric' === e
                  ? s(t)
                  : 'oid' === e
                  ? a(t)
                  : 'reltime' === e || 'time' === e
                  ? n(t)
                  : 'timestamp' === e
                  ? h(t)
                  : 'timestamptz' === e || 'timetz' === e
                  ? n(t)
                  : 'tsrange' === e || 'tstzrange' === e
                  ? i(t)
                  : n(t)
              } catch (r) {
                return (
                  console.log('Could not convert cell of type '.concat(e, ' and value ').concat(t)),
                  console.log('This is the error: '.concat(r)),
                  t
                )
              }
            }
            e.convertCell = r
            var n = (e) => e
            e.noop = n
            var o = (e) => 't' === e || ('f' !== e && null)
            ;(e.toBoolean = o), (e.toDate = (e) => new Date(e))
            var i = (e) => {
              var t = JSON.parse(e)
              return [new Date(t[0]), new Date(t[1])]
            }
            e.toDateRange = i
            var s = (e) => parseFloat(e)
            e.toFloat = s
            var a = (e) => parseInt(e)
            e.toInt = a
            var c = (e) => {
              var t = JSON.parse(e)
              return [parseInt(t[0]), parseInt(t[1])]
            }
            e.toIntRange = c
            var u = (e) => JSON.parse(e)
            e.toJson = u
            var l = (e, t) => {
              var n = e.slice(1, e.length - 1)
              return (0 < n.length ? n.split(',') : []).map((e) => r(t, e))
            }
            e.toArray = l
            var h = (e) => e.replace(' ', 'T')
            e.toTimestampString = h
          })
            ? n.apply(t, o)
            : n) || (e.exports = i)
  },
  function (e, t, r) {
    var n = r(25)
    function o() {
      if ('function' != typeof WeakMap) return null
      var e = new WeakMap()
      return (
        (o = function () {
          return e
        }),
        e
      )
    }
    e.exports = function (e) {
      if (e && e.__esModule) return e
      if (null === e || ('object' !== n(e) && 'function' != typeof e)) return { default: e }
      var t = o()
      if (t && t.has(e)) return t.get(e)
      var r = {},
        i = Object.defineProperty && Object.getOwnPropertyDescriptor
      for (var s in e)
        if (Object.prototype.hasOwnProperty.call(e, s)) {
          var a = i ? Object.getOwnPropertyDescriptor(e, s) : null
          a && (a.get || a.set) ? Object.defineProperty(r, s, a) : (r[s] = e[s])
        }
      return (r.default = e), t && t.set(e, r), r
    }
  },
  function (e, t) {
    function r(t) {
      return (
        'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
          ? (e.exports = r = function (e) {
              return typeof e
            })
          : (e.exports = r = function (e) {
              return e &&
                'function' == typeof Symbol &&
                e.constructor === Symbol &&
                e !== Symbol.prototype
                ? 'symbol'
                : typeof e
            }),
        r(t)
      )
    }
    e.exports = r
  },
  function (e, t, r) {
    var n, o, i
    'undefined' == typeof globalThis ? 'undefined' == typeof self || self : globalThis,
      (o = [t, r(27), r(4)]),
      void 0 ===
        (i =
          'function' ==
          typeof (n = function (e, t, n) {
            'use strict'
            var o = r(6)
            Object.defineProperty(e, '__esModule', { value: !0 }),
              (e.Auth = void 0),
              (t = o(t)),
              (n = o(n))
            var i = () => 'undefined' != typeof window,
              s = 'supabase.auth.token'
            e.Auth = class {
              constructor(e, r) {
                var o = Math.round,
                  a = this,
                  c =
                    2 < arguments.length && void 0 !== arguments[2]
                      ? arguments[2]
                      : { autoRefreshToken: !0, persistSession: !0 }
                ;(this.authUrl = e),
                  (this.accessToken = r),
                  (this.refreshToken = null),
                  (this.supabaseKey = r),
                  (this.currentUser = null),
                  (this.autoRefreshToken = !(void 0 !== c.autoRefreshToken) || c.autoRefreshToken),
                  (this.persistSession = !(void 0 !== c.persistSession) || c.persistSession),
                  (this.signup = (function () {
                    var r = (0, t.default)(function* (t, r) {
                      a.removeSavedSession()
                      var i = yield n.default
                        .post(''.concat(e, '/signup'), { email: t, password: r })
                        .set('accept', 'json')
                        .set('apikey', a.supabaseKey)
                      if (200 === i.status && i.body.user.confirmed_at) {
                        ;(a.accessToken = i.body.access_token),
                          (a.refreshToken = i.body.refresh_token),
                          (a.currentUser = i.body.user)
                        var s = i.body.expires_in
                        if (
                          (a.autoRefreshToken &&
                            s &&
                            setTimeout(a.callRefreshToken, 1e3 * (s - 60)),
                          a.persistSession)
                        ) {
                          var c = o(Date.now() / 1e3)
                          a.saveSession(a.accessToken, a.refreshToken, c + s, a.currentUser)
                        }
                      }
                      return i
                    })
                    return function () {
                      return r.apply(this, arguments)
                    }
                  })()),
                  (this.login = (function () {
                    var r = (0, t.default)(function* (t, r) {
                      a.removeSavedSession()
                      var i = yield n.default
                        .post(''.concat(e, '/token?grant_type=password'), { email: t, password: r })
                        .set('accept', 'json')
                        .set('apikey', a.supabaseKey)
                      if (200 === i.status) {
                        ;(a.accessToken = i.body.access_token),
                          (a.refreshToken = i.body.refresh_token),
                          (a.currentUser = i.body.user)
                        var s = i.body.expires_in
                        if (
                          (a.autoRefreshToken &&
                            s &&
                            setTimeout(a.callRefreshToken, 1e3 * (s - 60)),
                          a.persistSession)
                        ) {
                          var c = o(Date.now() / 1e3)
                          a.saveSession(a.accessToken, a.refreshToken, c + s, a.currentUser)
                        }
                      }
                      return i
                    })
                    return function () {
                      return r.apply(this, arguments)
                    }
                  })()),
                  (this.callRefreshToken = (0, t.default)(function* () {
                    var t = yield n.default
                      .post(''.concat(e, '/token?grant_type=refresh_token'), {
                        refresh_token: a.refreshToken,
                      })
                      .set('accept', 'json')
                      .set('apikey', a.supabaseKey)
                    if (200 === t.status) {
                      ;(a.accessToken = t.body.access_token),
                        (a.refreshToken = t.body.refresh_token)
                      var r = t.body.expires_in
                      if (
                        (a.autoRefreshToken && r && setTimeout(a.callRefreshToken, 1e3 * (r - 60)),
                        a.persistSession)
                      ) {
                        var i = o(Date.now() / 1e3)
                        a.saveSession(a.accessToken, a.refreshToken, i + r, a.currentUser)
                      }
                    }
                    return t
                  })),
                  (this.logout = (0, t.default)(function* () {
                    yield n.default
                      .post(''.concat(e, '/logout'))
                      .set('Authorization', 'Bearer '.concat(a.accessToken))
                      .set('apikey', a.supabaseKey),
                      a.removeSavedSession()
                  })),
                  (this.user = (0, t.default)(function* () {
                    if (a.currentUser) return a.currentUser
                    var t = yield n.default
                      .get(''.concat(e, '/user'))
                      .set('Authorization', 'Bearer '.concat(a.accessToken))
                      .set('apikey', a.supabaseKey)
                    return (
                      200 === t.status &&
                        ((a.currentUser = t.body),
                        (a.currentUser.access_token = a.accessToken),
                        (a.currentUser.refresh_token = a.refreshToken)),
                      a.currentUser
                    )
                  })),
                  (this.saveSession = (e, t, r, n) => {
                    i() &&
                      localStorage.setItem(
                        s,
                        JSON.stringify({
                          accessToken: e,
                          refreshToken: t,
                          expiresAt: r,
                          currentUser: n,
                        })
                      )
                  }),
                  (this.removeSavedSession = () => {
                    ;(this.currentUser = null),
                      (this.refreshToken = null),
                      (this.accessToken = this.supabaseKey),
                      i() && localStorage.removeItem(s)
                  }),
                  (this.authHeader = () => {
                    var e = i() && localStorage.getItem(s),
                      t = e ? JSON.parse(e) : null
                    return (null == t ? void 0 : t.accessToken)
                      ? 'Bearer '.concat(t.accessToken)
                      : this.accessToken
                      ? 'Bearer '.concat(this.accessToken)
                      : null
                  }),
                  (this.recoverSession = () => {
                    var e = i() && localStorage.getItem(s)
                    if (e)
                      try {
                        var t = JSON.parse(e),
                          { accessToken: r, refreshToken: n, currentUser: a, expiresAt: c } = t,
                          u = o(Date.now() / 1e3)
                        c < u
                          ? (console.log('saved session has expired'), this.removeSavedSession())
                          : ((this.accessToken = r),
                            (this.refreshToken = n),
                            (this.currentUser = a),
                            setTimeout(this.callRefreshToken, 1e3 * (c - u - 60)))
                      } catch (e) {
                        return console.error(e), null
                      }
                    return null
                  }),
                  this.recoverSession()
              }
            }
          })
            ? n.apply(t, o)
            : n) || (e.exports = i)
  },
  function (e, t) {
    function r(e, t, r, n, o, i, s) {
      try {
        var a = e[i](s),
          c = a.value
      } catch (e) {
        return void r(e)
      }
      a.done ? t(c) : Promise.resolve(c).then(n, o)
    }
    e.exports = function (e) {
      return function () {
        var t = this,
          n = arguments
        return new Promise(function (o, i) {
          var s = e.apply(t, n)
          function a(e) {
            r(s, o, i, a, c, 'next', e)
          }
          function c(e) {
            r(s, o, i, a, c, 'throw', e)
          }
          a(void 0)
        })
      }
    }
  },
  function (e, t, r) {
    function n(e) {
      if (e)
        return (function (e) {
          for (var t in n.prototype) e[t] = n.prototype[t]
          return e
        })(e)
    }
    ;(e.exports = n),
      (n.prototype.on = n.prototype.addEventListener = function (e, t) {
        return (
          (this._callbacks = this._callbacks || {}),
          (this._callbacks['$' + e] = this._callbacks['$' + e] || []).push(t),
          this
        )
      }),
      (n.prototype.once = function (e, t) {
        function r() {
          this.off(e, r), t.apply(this, arguments)
        }
        return (r.fn = t), this.on(e, r), this
      }),
      (n.prototype.off = n.prototype.removeListener = n.prototype.removeAllListeners = n.prototype.removeEventListener = function (
        e,
        t
      ) {
        if (((this._callbacks = this._callbacks || {}), 0 == arguments.length))
          return (this._callbacks = {}), this
        var r,
          n = this._callbacks['$' + e]
        if (!n) return this
        if (1 == arguments.length) return delete this._callbacks['$' + e], this
        for (var o = 0; o < n.length; o++)
          if ((r = n[o]) === t || r.fn === t) {
            n.splice(o, 1)
            break
          }
        return 0 === n.length && delete this._callbacks['$' + e], this
      }),
      (n.prototype.emit = function (e) {
        this._callbacks = this._callbacks || {}
        for (
          var t = new Array(arguments.length - 1), r = this._callbacks['$' + e], n = 1;
          n < arguments.length;
          n++
        )
          t[n - 1] = arguments[n]
        if (r) {
          n = 0
          for (var o = (r = r.slice(0)).length; n < o; ++n) r[n].apply(this, t)
        }
        return this
      }),
      (n.prototype.listeners = function (e) {
        return (this._callbacks = this._callbacks || {}), this._callbacks['$' + e] || []
      }),
      (n.prototype.hasListeners = function (e) {
        return !!this.listeners(e).length
      })
  },
  function (e, t) {
    ;(e.exports = o), (o.default = o), (o.stable = s), (o.stableStringify = s)
    var r = [],
      n = []
    function o(e, t, o) {
      var i
      for (
        !(function e(t, o, i, s) {
          var a
          if ('object' == typeof t && null !== t) {
            for (a = 0; a < i.length; a++)
              if (i[a] === t) {
                var c = Object.getOwnPropertyDescriptor(s, o)
                return void (void 0 !== c.get
                  ? c.configurable
                    ? (Object.defineProperty(s, o, { value: '[Circular]' }), r.push([s, o, t, c]))
                    : n.push([t, o])
                  : ((s[o] = '[Circular]'), r.push([s, o, t])))
              }
            if ((i.push(t), Array.isArray(t))) for (a = 0; a < t.length; a++) e(t[a], a, i, t)
            else {
              var u = Object.keys(t)
              for (a = 0; a < u.length; a++) {
                var l = u[a]
                e(t[l], l, i, t)
              }
            }
            i.pop()
          }
        })(e, '', [], void 0),
          i = 0 === n.length ? JSON.stringify(e, t, o) : JSON.stringify(e, a(t), o);
        0 !== r.length;

      ) {
        var s = r.pop()
        4 === s.length ? Object.defineProperty(s[0], s[1], s[3]) : (s[0][s[1]] = s[2])
      }
      return i
    }
    function i(e, t) {
      return e < t ? -1 : e > t ? 1 : 0
    }
    function s(e, t, o) {
      var s,
        c =
          (function e(t, o, s, a) {
            var c
            if ('object' == typeof t && null !== t) {
              for (c = 0; c < s.length; c++)
                if (s[c] === t) {
                  var u = Object.getOwnPropertyDescriptor(a, o)
                  return void (void 0 !== u.get
                    ? u.configurable
                      ? (Object.defineProperty(a, o, { value: '[Circular]' }), r.push([a, o, t, u]))
                      : n.push([t, o])
                    : ((a[o] = '[Circular]'), r.push([a, o, t])))
                }
              if ('function' == typeof t.toJSON) return
              if ((s.push(t), Array.isArray(t))) for (c = 0; c < t.length; c++) e(t[c], c, s, t)
              else {
                var l = {},
                  h = Object.keys(t).sort(i)
                for (c = 0; c < h.length; c++) {
                  var f = h[c]
                  e(t[f], f, s, t), (l[f] = t[f])
                }
                if (void 0 === a) return l
                r.push([a, o, t]), (a[o] = l)
              }
              s.pop()
            }
          })(e, '', [], void 0) || e
      for (
        s = 0 === n.length ? JSON.stringify(c, t, o) : JSON.stringify(c, a(t), o);
        0 !== r.length;

      ) {
        var u = r.pop()
        4 === u.length ? Object.defineProperty(u[0], u[1], u[3]) : (u[0][u[1]] = u[2])
      }
      return s
    }
    function a(e) {
      return (
        (e =
          void 0 !== e
            ? e
            : function (e, t) {
                return t
              }),
        function (t, r) {
          if (n.length > 0)
            for (var o = 0; o < n.length; o++) {
              var i = n[o]
              if (i[1] === t && i[0] === r) {
                ;(r = '[Circular]'), n.splice(o, 1)
                break
              }
            }
          return e.call(this, t, r)
        }
      )
    }
  },
  function (e, t, r) {
    'use strict'
    function n(e) {
      return (n =
        'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
          ? function (e) {
              return typeof e
            }
          : function (e) {
              return e &&
                'function' == typeof Symbol &&
                e.constructor === Symbol &&
                e !== Symbol.prototype
                ? 'symbol'
                : typeof e
            })(e)
    }
    var o = r(5)
    function i(e) {
      if (e)
        return (function (e) {
          for (var t in i.prototype)
            Object.prototype.hasOwnProperty.call(i.prototype, t) && (e[t] = i.prototype[t])
          return e
        })(e)
    }
    ;(e.exports = i),
      (i.prototype.clearTimeout = function () {
        return (
          clearTimeout(this._timer),
          clearTimeout(this._responseTimeoutTimer),
          clearTimeout(this._uploadTimeoutTimer),
          delete this._timer,
          delete this._responseTimeoutTimer,
          delete this._uploadTimeoutTimer,
          this
        )
      }),
      (i.prototype.parse = function (e) {
        return (this._parser = e), this
      }),
      (i.prototype.responseType = function (e) {
        return (this._responseType = e), this
      }),
      (i.prototype.serialize = function (e) {
        return (this._serializer = e), this
      }),
      (i.prototype.timeout = function (e) {
        if (!e || 'object' !== n(e))
          return (this._timeout = e), (this._responseTimeout = 0), (this._uploadTimeout = 0), this
        for (var t in e)
          if (Object.prototype.hasOwnProperty.call(e, t))
            switch (t) {
              case 'deadline':
                this._timeout = e.deadline
                break
              case 'response':
                this._responseTimeout = e.response
                break
              case 'upload':
                this._uploadTimeout = e.upload
                break
              default:
                console.warn('Unknown timeout option', t)
            }
        return this
      }),
      (i.prototype.retry = function (e, t) {
        return (
          (0 !== arguments.length && !0 !== e) || (e = 1),
          e <= 0 && (e = 0),
          (this._maxRetries = e),
          (this._retries = 0),
          (this._retryCallback = t),
          this
        )
      })
    var s = ['ECONNRESET', 'ETIMEDOUT', 'EADDRINFO', 'ESOCKETTIMEDOUT']
    ;(i.prototype._shouldRetry = function (e, t) {
      if (!this._maxRetries || this._retries++ >= this._maxRetries) return !1
      if (this._retryCallback)
        try {
          var r = this._retryCallback(e, t)
          if (!0 === r) return !0
          if (!1 === r) return !1
        } catch (e) {
          console.error(e)
        }
      if (t && t.status && t.status >= 500 && 501 !== t.status) return !0
      if (e) {
        if (e.code && s.includes(e.code)) return !0
        if (e.timeout && 'ECONNABORTED' === e.code) return !0
        if (e.crossDomain) return !0
      }
      return !1
    }),
      (i.prototype._retry = function () {
        return (
          this.clearTimeout(),
          this.req && ((this.req = null), (this.req = this.request())),
          (this._aborted = !1),
          (this.timedout = !1),
          (this.timedoutError = null),
          this._end()
        )
      }),
      (i.prototype.then = function (e, t) {
        var r = this
        if (!this._fullfilledPromise) {
          var n = this
          this._endCalled &&
            console.warn(
              'Warning: superagent request was sent twice, because both .end() and .then() were called. Never call .end() if you use promises'
            ),
            (this._fullfilledPromise = new Promise(function (e, t) {
              n.on('abort', function () {
                if (!(r._maxRetries && r._maxRetries > r._retries))
                  if (r.timedout && r.timedoutError) t(r.timedoutError)
                  else {
                    var e = new Error('Aborted')
                    ;(e.code = 'ABORTED'),
                      (e.status = r.status),
                      (e.method = r.method),
                      (e.url = r.url),
                      t(e)
                  }
              }),
                n.end(function (r, n) {
                  r ? t(r) : e(n)
                })
            }))
        }
        return this._fullfilledPromise.then(e, t)
      }),
      (i.prototype.catch = function (e) {
        return this.then(void 0, e)
      }),
      (i.prototype.use = function (e) {
        return e(this), this
      }),
      (i.prototype.ok = function (e) {
        if ('function' != typeof e) throw new Error('Callback required')
        return (this._okCallback = e), this
      }),
      (i.prototype._isResponseOK = function (e) {
        return !!e && (this._okCallback ? this._okCallback(e) : e.status >= 200 && e.status < 300)
      }),
      (i.prototype.get = function (e) {
        return this._header[e.toLowerCase()]
      }),
      (i.prototype.getHeader = i.prototype.get),
      (i.prototype.set = function (e, t) {
        if (o(e)) {
          for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && this.set(r, e[r])
          return this
        }
        return (this._header[e.toLowerCase()] = t), (this.header[e] = t), this
      }),
      (i.prototype.unset = function (e) {
        return delete this._header[e.toLowerCase()], delete this.header[e], this
      }),
      (i.prototype.field = function (e, t) {
        if (null == e) throw new Error('.field(name, val) name can not be empty')
        if (this._data)
          throw new Error(
            ".field() can't be used if .send() is used. Please use only .send() or only .field() & .attach()"
          )
        if (o(e)) {
          for (var r in e) Object.prototype.hasOwnProperty.call(e, r) && this.field(r, e[r])
          return this
        }
        if (Array.isArray(t)) {
          for (var n in t) Object.prototype.hasOwnProperty.call(t, n) && this.field(e, t[n])
          return this
        }
        if (null == t) throw new Error('.field(name, val) val can not be empty')
        return 'boolean' == typeof t && (t = String(t)), this._getFormData().append(e, t), this
      }),
      (i.prototype.abort = function () {
        return (
          this._aborted ||
            ((this._aborted = !0),
            this.xhr && this.xhr.abort(),
            this.req && this.req.abort(),
            this.clearTimeout(),
            this.emit('abort')),
          this
        )
      }),
      (i.prototype._auth = function (e, t, r, n) {
        switch (r.type) {
          case 'basic':
            this.set('Authorization', 'Basic '.concat(n(''.concat(e, ':').concat(t))))
            break
          case 'auto':
            ;(this.username = e), (this.password = t)
            break
          case 'bearer':
            this.set('Authorization', 'Bearer '.concat(e))
        }
        return this
      }),
      (i.prototype.withCredentials = function (e) {
        return void 0 === e && (e = !0), (this._withCredentials = e), this
      }),
      (i.prototype.redirects = function (e) {
        return (this._maxRedirects = e), this
      }),
      (i.prototype.maxResponseSize = function (e) {
        if ('number' != typeof e) throw new TypeError('Invalid argument')
        return (this._maxResponseSize = e), this
      }),
      (i.prototype.toJSON = function () {
        return { method: this.method, url: this.url, data: this._data, headers: this._header }
      }),
      (i.prototype.send = function (e) {
        var t = o(e),
          r = this._header['content-type']
        if (this._formData)
          throw new Error(
            ".send() can't be used if .attach() or .field() is used. Please use only .send() or only .field() & .attach()"
          )
        if (t && !this._data)
          Array.isArray(e) ? (this._data = []) : this._isHost(e) || (this._data = {})
        else if (e && this._data && this._isHost(this._data))
          throw new Error("Can't merge these send calls")
        if (t && o(this._data))
          for (var n in e) Object.prototype.hasOwnProperty.call(e, n) && (this._data[n] = e[n])
        else
          'string' == typeof e
            ? (r || this.type('form'),
              (r = this._header['content-type']),
              (this._data =
                'application/x-www-form-urlencoded' === r
                  ? this._data
                    ? ''.concat(this._data, '&').concat(e)
                    : e
                  : (this._data || '') + e))
            : (this._data = e)
        return !t || this._isHost(e) || r || this.type('json'), this
      }),
      (i.prototype.sortQuery = function (e) {
        return (this._sort = void 0 === e || e), this
      }),
      (i.prototype._finalizeQueryString = function () {
        var e = this._query.join('&')
        if (
          (e && (this.url += (this.url.includes('?') ? '&' : '?') + e),
          (this._query.length = 0),
          this._sort)
        ) {
          var t = this.url.indexOf('?')
          if (t >= 0) {
            var r = this.url.slice(t + 1).split('&')
            'function' == typeof this._sort ? r.sort(this._sort) : r.sort(),
              (this.url = this.url.slice(0, t) + '?' + r.join('&'))
          }
        }
      }),
      (i.prototype._appendQueryString = function () {
        console.warn('Unsupported')
      }),
      (i.prototype._timeoutError = function (e, t, r) {
        if (!this._aborted) {
          var n = new Error(''.concat(e + t, 'ms exceeded'))
          ;(n.timeout = t),
            (n.code = 'ECONNABORTED'),
            (n.errno = r),
            (this.timedout = !0),
            (this.timedoutError = n),
            this.abort(),
            this.callback(n)
        }
      }),
      (i.prototype._setTimeouts = function () {
        var e = this
        this._timeout &&
          !this._timer &&
          (this._timer = setTimeout(function () {
            e._timeoutError('Timeout of ', e._timeout, 'ETIME')
          }, this._timeout)),
          this._responseTimeout &&
            !this._responseTimeoutTimer &&
            (this._responseTimeoutTimer = setTimeout(function () {
              e._timeoutError('Response timeout of ', e._responseTimeout, 'ETIMEDOUT')
            }, this._responseTimeout))
      })
  },
  function (e, t, r) {
    'use strict'
    var n = r(32)
    function o(e) {
      if (e)
        return (function (e) {
          for (var t in o.prototype)
            Object.prototype.hasOwnProperty.call(o.prototype, t) && (e[t] = o.prototype[t])
          return e
        })(e)
    }
    ;(e.exports = o),
      (o.prototype.get = function (e) {
        return this.header[e.toLowerCase()]
      }),
      (o.prototype._setHeaderProperties = function (e) {
        var t = e['content-type'] || ''
        this.type = n.type(t)
        var r = n.params(t)
        for (var o in r) Object.prototype.hasOwnProperty.call(r, o) && (this[o] = r[o])
        this.links = {}
        try {
          e.link && (this.links = n.parseLinks(e.link))
        } catch (e) {}
      }),
      (o.prototype._setStatusProperties = function (e) {
        var t = (e / 100) | 0
        ;(this.statusCode = e),
          (this.status = this.statusCode),
          (this.statusType = t),
          (this.info = 1 === t),
          (this.ok = 2 === t),
          (this.redirect = 3 === t),
          (this.clientError = 4 === t),
          (this.serverError = 5 === t),
          (this.error = (4 === t || 5 === t) && this.toError()),
          (this.created = 201 === e),
          (this.accepted = 202 === e),
          (this.noContent = 204 === e),
          (this.badRequest = 400 === e),
          (this.unauthorized = 401 === e),
          (this.notAcceptable = 406 === e),
          (this.forbidden = 403 === e),
          (this.notFound = 404 === e),
          (this.unprocessableEntity = 422 === e)
      })
  },
  function (e, t, r) {
    'use strict'
    ;(t.type = function (e) {
      return e.split(/ *; */).shift()
    }),
      (t.params = function (e) {
        return e.split(/ *; */).reduce(function (e, t) {
          var r = t.split(/ *= */),
            n = r.shift(),
            o = r.shift()
          return n && o && (e[n] = o), e
        }, {})
      }),
      (t.parseLinks = function (e) {
        return e.split(/ *, */).reduce(function (e, t) {
          var r = t.split(/ *; */),
            n = r[0].slice(1, -1)
          return (e[r[1].split(/ *= */)[1].slice(1, -1)] = n), e
        }, {})
      }),
      (t.cleanHeader = function (e, t) {
        return (
          delete e['content-type'],
          delete e['content-length'],
          delete e['transfer-encoding'],
          delete e.host,
          t && (delete e.authorization, delete e.cookie),
          e
        )
      })
  },
  function (e, t, r) {
    'use strict'
    function n(e) {
      return (
        (function (e) {
          if (Array.isArray(e)) return o(e)
        })(e) ||
        (function (e) {
          if ('undefined' != typeof Symbol && Symbol.iterator in Object(e)) return Array.from(e)
        })(e) ||
        (function (e, t) {
          if (!e) return
          if ('string' == typeof e) return o(e, t)
          var r = Object.prototype.toString.call(e).slice(8, -1)
          'Object' === r && e.constructor && (r = e.constructor.name)
          if ('Map' === r || 'Set' === r) return Array.from(e)
          if ('Arguments' === r || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(r))
            return o(e, t)
        })(e) ||
        (function () {
          throw new TypeError(
            'Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.'
          )
        })()
      )
    }
    function o(e, t) {
      ;(null == t || t > e.length) && (t = e.length)
      for (var r = 0, n = new Array(t); r < t; r++) n[r] = e[r]
      return n
    }
    function i() {
      this._defaults = []
    }
    ;[
      'use',
      'on',
      'once',
      'set',
      'query',
      'type',
      'accept',
      'auth',
      'withCredentials',
      'sortQuery',
      'retry',
      'ok',
      'redirects',
      'timeout',
      'buffer',
      'serialize',
      'parse',
      'ca',
      'key',
      'pfx',
      'cert',
      'disableTLSCerts',
    ].forEach(function (e) {
      i.prototype[e] = function () {
        for (var t = arguments.length, r = new Array(t), n = 0; n < t; n++) r[n] = arguments[n]
        return this._defaults.push({ fn: e, args: r }), this
      }
    }),
      (i.prototype._setDefaults = function (e) {
        this._defaults.forEach(function (t) {
          e[t.fn].apply(e, n(t.args))
        })
      }),
      (e.exports = i)
  },
  function (e, t, r) {
    'use strict'
    function n(e) {
      return (n =
        'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
          ? function (e) {
              return typeof e
            }
          : function (e) {
              return e &&
                'function' == typeof Symbol &&
                e.constructor === Symbol &&
                e !== Symbol.prototype
                ? 'symbol'
                : typeof e
            })(e)
    }
    Object.defineProperty(t, '__esModule', { value: !0 }), (t.PostgrestClient = void 0)
    var o = c(r(35)),
      i = c(r(7)),
      s = (function (e) {
        if (e && e.__esModule) return e
        if (null === e || ('object' !== n(e) && 'function' != typeof e)) return { default: e }
        var t = a()
        if (t && t.has(e)) return t.get(e)
        var r = {},
          o = Object.defineProperty && Object.getOwnPropertyDescriptor
        for (var i in e)
          if (Object.prototype.hasOwnProperty.call(e, i)) {
            var s = o ? Object.getOwnPropertyDescriptor(e, i) : null
            s && (s.get || s.set) ? Object.defineProperty(r, i, s) : (r[i] = e[i])
          }
        return (r.default = e), t && t.set(e, r), r
      })(r(0))
    function a() {
      if ('function' != typeof WeakMap) return null
      var e = new WeakMap()
      return (
        (a = function () {
          return e
        }),
        e
      )
    }
    function c(e) {
      return e && e.__esModule ? e : { default: e }
    }
    function u(e, t) {
      if (!(e instanceof t)) throw new TypeError('Cannot call a class as a function')
    }
    function l(e, t) {
      for (var r, n = 0; n < t.length; n++)
        ((r = t[n]).enumerable = r.enumerable || !1),
          (r.configurable = !0),
          'value' in r && (r.writable = !0),
          Object.defineProperty(e, r.key, r)
    }
    var h = (function () {
      function e(t) {
        var r = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : {}
        u(this, e),
          (this.restUrl = t),
          (this.headers = {}),
          (this.queryString = null),
          (this.schema = null),
          r.headers && (this.headers = r.headers),
          r.queryParams && (this.queryString = s.objectToQueryString(r.queryParams)),
          r.schema && (this.schema = r.schema)
      }
      return (
        (function (e, t, r) {
          t && l(e.prototype, t), r && l(e, r)
        })(e, [
          {
            key: 'from',
            value: function (e) {
              var t = ''.concat(this.restUrl, '/').concat(e)
              return (
                this.queryString && (t += '?'.concat(this.queryString)),
                new o.default(t, this.headers, this.schema)
              )
            },
          },
          {
            key: 'rpc',
            value: function (e) {
              var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : null,
                r = ''.concat(this.restUrl, '/rpc/').concat(e),
                n = this.headers
              this.queryString && (r += '?'.concat(this.queryString)),
                this.schema && (n['Content-Profile'] = this.schema)
              var o = new i.default('post', r, n)
              return null != t && o.send(t), o
            },
          },
        ]),
        e
      )
    })()
    t.PostgrestClient = h
  },
  function (e, t, r) {
    'use strict'
    var n,
      o = (n = r(7)) && n.__esModule ? n : { default: n }
    function i(e, t) {
      if (!(e instanceof t)) throw new TypeError('Cannot call a class as a function')
    }
    function s(e, t) {
      for (var r, n = 0; n < t.length; n++)
        ((r = t[n]).enumerable = r.enumerable || !1),
          (r.configurable = !0),
          'value' in r && (r.writable = !0),
          Object.defineProperty(e, r.key, r)
    }
    Object.defineProperty(t, '__esModule', { value: !0 }), (t.default = void 0)
    var a = (function () {
      function e(t) {
        var r = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : {},
          n = 2 < arguments.length ? arguments[2] : void 0
        i(this, e), (this.url = t), (this.queryFilters = []), (this.headers = r), (this.schema = n)
      }
      return (
        (function (e, t, r) {
          t && s(e.prototype, t), r && s(e, r)
        })(e, [
          {
            key: 'request',
            value: function (e) {
              return (
                this.schema &&
                  ('GET' == e
                    ? (this.headers['Accept-Profile'] = this.schema)
                    : (this.headers['Content-Profile'] = this.schema)),
                new o.default(e, this.url, this.headers)
              )
            },
          },
          {
            key: 'addFilters',
            value: function (e) {
              this.queryFilters.forEach(function (t) {
                switch (t.filter) {
                  case 'filter':
                    e.filter(t.columnName, t.operator, t.criteria)
                    break
                  case 'not':
                    e.not(t.columnName, t.operator, t.criteria)
                    break
                  case 'or':
                    e.or(t.filters)
                    break
                  case 'match':
                    e.match(t.query)
                    break
                  case 'order':
                    e.order(t.columnName, t.ascending, t.nullsFirst)
                    break
                  case 'limit':
                    e.limit(t.criteria, t.columnName)
                    break
                  case 'offset':
                    e.offset(t.criteria, t.columnName)
                    break
                  case 'range':
                    e.range(t.from, t.to)
                    break
                  case 'single':
                    e.single()
                }
              })
            },
          },
          {
            key: 'filter',
            value: function (e, t, r) {
              return (
                this.queryFilters.push({
                  filter: 'filter',
                  columnName: e,
                  operator: t,
                  criteria: r,
                }),
                this
              )
            },
          },
          {
            key: 'not',
            value: function (e, t, r) {
              return (
                this.queryFilters.push({ filter: 'not', columnName: e, operator: t, criteria: r }),
                this
              )
            },
          },
          {
            key: 'or',
            value: function (e) {
              return this.queryFilters.push({ filter: 'or', filters: e }), this
            },
          },
          {
            key: 'match',
            value: function (e) {
              return this.queryFilters.push({ filter: 'match', query: e }), this
            },
          },
          {
            key: 'order',
            value: function (e) {
              var t = !!(1 < arguments.length && void 0 !== arguments[1]) && arguments[1],
                r = !!(2 < arguments.length && void 0 !== arguments[2]) && arguments[2]
              return (
                this.queryFilters.push({
                  filter: 'order',
                  columnName: e,
                  ascending: t,
                  nullsFirst: r,
                }),
                this
              )
            },
          },
          {
            key: 'limit',
            value: function (e) {
              var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : null
              return this.queryFilters.push({ filter: 'limit', criteria: e, columnName: t }), this
            },
          },
          {
            key: 'offset',
            value: function (e) {
              var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : null
              return this.queryFilters.push({ filter: 'offset', columnName: t, criteria: e }), this
            },
          },
          {
            key: 'range',
            value: function (e) {
              var t = 1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : null
              return this.queryFilters.push({ filter: 'range', from: e, to: t }), this
            },
          },
          {
            key: 'single',
            value: function () {
              return this.queryFilters.push({ filter: 'single' }), this
            },
          },
          {
            key: 'select',
            value: function () {
              var e = 0 < arguments.length && void 0 !== arguments[0] ? arguments[0] : '*',
                t = this.request('GET')
              return t.select(e), this.addFilters(t), t
            },
          },
          {
            key: 'insert',
            value: function (e) {
              var t =
                  1 < arguments.length && void 0 !== arguments[1] ? arguments[1] : { upsert: !1 },
                r = this.request('POST'),
                n = t.upsert
                  ? 'return=representation,resolution=merge-duplicates'
                  : 'return=representation'
              return r.set('Prefer', n), r.send(e), this.addFilters(r), r
            },
          },
          {
            key: 'update',
            value: function (e) {
              var t = this.request('PATCH')
              return Array.isArray(e)
                ? {
                    body: null,
                    status: 400,
                    statusCode: 400,
                    statusText: 'Data type should be an object.',
                  }
                : (t.set('Prefer', 'return=representation'), t.send(e), this.addFilters(t), t)
            },
          },
          {
            key: 'delete',
            value: function () {
              var e = this.request('DELETE')
              return this.addFilters(e), e
            },
          },
        ]),
        e
      )
    })()
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
      'fts',
      'plfts',
      'phfts',
      'wfts',
      'cs',
      'cd',
      'ova',
      'ovr',
      'sl',
      'sr',
      'nxr',
      'nxl',
      'adj',
    ].forEach(function (e) {
      return (a.prototype[e] = function (t, r) {
        return this.filter(t, e, r), this
      })
    })
    var c = a
    t.default = c
  },
  function (e, t, r) {
    'use strict'
    var n = (function (e) {
      if (e && e.__esModule) return e
      if (null === e || ('object' !== o(e) && 'function' != typeof e)) return { default: e }
      var t = i()
      if (t && t.has(e)) return t.get(e)
      var r = {},
        n = Object.defineProperty && Object.getOwnPropertyDescriptor
      for (var s in e)
        if (Object.prototype.hasOwnProperty.call(e, s)) {
          var a = n ? Object.getOwnPropertyDescriptor(e, s) : null
          a && (a.get || a.set) ? Object.defineProperty(r, s, a) : (r[s] = e[s])
        }
      return (r.default = e), t && t.set(e, r), r
    })(r(0))
    function o(e) {
      return (o =
        'function' == typeof Symbol && 'symbol' == typeof Symbol.iterator
          ? function (e) {
              return typeof e
            }
          : function (e) {
              return e &&
                'function' == typeof Symbol &&
                e.constructor === Symbol &&
                e !== Symbol.prototype
                ? 'symbol'
                : typeof e
            })(e)
    }
    function i() {
      if ('function' != typeof WeakMap) return null
      var e = new WeakMap()
      return (
        (i = function () {
          return e
        }),
        e
      )
    }
    Object.defineProperty(t, '__esModule', { value: !0 }),
      (t._eq = function (e, t) {
        return ''.concat(e, '=eq.').concat(t)
      }),
      (t._gt = function (e, t) {
        return ''.concat(e, '=gt.').concat(t)
      }),
      (t._lt = function (e, t) {
        return ''.concat(e, '=lt.').concat(t)
      }),
      (t._gte = function (e, t) {
        return ''.concat(e, '=gte.').concat(t)
      }),
      (t._lte = function (e, t) {
        return ''.concat(e, '=lte.').concat(t)
      }),
      (t._like = function (e, t) {
        var r = t.replace(/%/g, '*')
        return ''.concat(e, '=like.').concat(r)
      }),
      (t._ilike = function (e, t) {
        var r = t.replace(/%/g, '*')
        return ''.concat(e, '=ilike.').concat(r)
      }),
      (t._is = function (e, t) {
        return ''.concat(e, '=is.').concat(t)
      }),
      (t._in = function (e, t) {
        var r = n.cleanFilterArray(t)
        return ''.concat(e, '=in.(').concat(r.join(','), ')')
      }),
      (t._neq = function (e, t) {
        return ''.concat(e, '=neq.').concat(t)
      }),
      (t._fts = function (e, t) {
        return void 0 === t.config
          ? ''.concat(e, '=fts.').concat(t.queryText)
          : ''.concat(e, '=fts(').concat(t.config, ').').concat(t.queryText)
      }),
      (t._plfts = function (e, t) {
        return void 0 === t.config
          ? ''.concat(e, '=plfts.').concat(t.queryText)
          : ''.concat(e, '=plfts(').concat(t.config, ').').concat(t.queryText)
      }),
      (t._phfts = function (e, t) {
        return void 0 === t.config
          ? ''.concat(e, '=phfts.').concat(t.queryText)
          : ''.concat(e, '=phfts(').concat(t.config, ').').concat(t.queryText)
      }),
      (t._wfts = function (e, t) {
        return void 0 === t.config
          ? ''.concat(e, '=wfts.').concat(t.queryText)
          : ''.concat(e, '=wfts(').concat(t.config, ').').concat(t.queryText)
      }),
      (t._cs = function (e, t) {
        if (Array.isArray(t)) {
          var r = n.cleanFilterArray(t)
          return ''.concat(e, '=cs.{').concat(r.join(','), '}')
        }
        return ''.concat(e, '=cs.').concat(JSON.stringify(t))
      }),
      (t._cd = function (e, t) {
        if (Array.isArray(t)) {
          var r = n.cleanFilterArray(t)
          return ''.concat(e, '=cd.{').concat(r.join(','), '}')
        }
        return ''.concat(e, '=cd.').concat(JSON.stringify(t))
      }),
      (t._ova = function (e, t) {
        var r = n.cleanFilterArray(t)
        return ''.concat(e, '=ov.{').concat(r.join(','), '}')
      }),
      (t._ovr = function (e, t) {
        return ''.concat(e, '=ov.(').concat(t.join(','), ')')
      }),
      (t._sl = function (e, t) {
        return ''.concat(e, '=sl.(').concat(t.join(','), ')')
      }),
      (t._sr = function (e, t) {
        return ''.concat(e, '=sr.(').concat(t.join(','), ')')
      }),
      (t._nxl = function (e, t) {
        return ''.concat(e, '=nxl.(').concat(t.join(','), ')')
      }),
      (t._nxr = function (e, t) {
        return ''.concat(e, '=nxr.(').concat(t.join(','), ')')
      }),
      (t._adj = function (e, t) {
        return ''.concat(e, '=adj.(').concat(t.join(','), ')')
      }),
      (t._or = function (e) {
        return 'or=('.concat(e, ')')
      })
  },
])
