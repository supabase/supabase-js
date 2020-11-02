;(function (a, b) {
  if ('function' == typeof define && define.amd)
    define(['exports', '@babel/runtime/helpers/asyncToGenerator', 'superagent'], b)
  else if ('undefined' != typeof exports)
    b(exports, require('@babel/runtime/helpers/asyncToGenerator'), require('superagent'))
  else {
    var c = { exports: {} }
    b(c.exports, a.asyncToGenerator, a.superagent), (a.Auth = c.exports)
  }
})(
  'undefined' == typeof globalThis ? ('undefined' == typeof self ? this : self) : globalThis,
  function (a, b, c) {
    'use strict'
    var d = require('@babel/runtime/helpers/interopRequireDefault')
    Object.defineProperty(a, '__esModule', { value: !0 }), (a.Auth = void 0), (b = d(b)), (c = d(c))
    var e = () => 'undefined' != typeof window,
      f = 'supabase.auth.token'
    a.Auth = class a {
      constructor(a, d) {
        var g = Math.round,
          h = this,
          i =
            2 < arguments.length && void 0 !== arguments[2]
              ? arguments[2]
              : { autoRefreshToken: !0, persistSession: !0 }
        ;(this.authUrl = a),
          (this.accessToken = d),
          (this.refreshToken = null),
          (this.supabaseKey = d),
          (this.currentUser = null),
          (this.autoRefreshToken = !(i.autoRefreshToken !== void 0) || i.autoRefreshToken),
          (this.persistSession = !(i.persistSession !== void 0) || i.persistSession),
          (this.signup = /*#__PURE__*/ (function () {
            var d = (0, b.default)(function* (b, d) {
              h.removeSavedSession() // clean out the old session before attempting
              var e = yield c.default
                .post(''.concat(a, '/signup'), { email: b, password: d })
                .set('accept', 'json')
                .set('apikey', h.supabaseKey)
              if (200 === e.status && e.body.user.confirmed_at) {
                ;(h.accessToken = e.body.access_token),
                  (h.refreshToken = e.body.refresh_token),
                  (h.currentUser = e.body.user)
                var f = e.body.expires_in
                if (
                  (h.autoRefreshToken && f && setTimeout(h.callRefreshToken, 1e3 * (f - 60)),
                  h.persistSession)
                ) {
                  var i = g(Date.now() / 1e3)
                  h.saveSession(h.accessToken, h.refreshToken, i + f, h.currentUser)
                }
              }
              return e
            })
            return function () {
              return d.apply(this, arguments)
            }
          })()),
          (this.login = /*#__PURE__*/ (function () {
            var d = (0, b.default)(function* (b, d) {
              h.removeSavedSession() // clean out the old session before attempting
              var e = yield c.default
                .post(''.concat(a, '/token?grant_type=password'), { email: b, password: d })
                .set('accept', 'json')
                .set('apikey', h.supabaseKey)
              if (200 === e.status) {
                ;(h.accessToken = e.body.access_token),
                  (h.refreshToken = e.body.refresh_token),
                  (h.currentUser = e.body.user)
                var f = e.body.expires_in
                if (
                  (h.autoRefreshToken && f && setTimeout(h.callRefreshToken, 1e3 * (f - 60)),
                  h.persistSession)
                ) {
                  var i = g(Date.now() / 1e3)
                  h.saveSession(h.accessToken, h.refreshToken, i + f, h.currentUser)
                }
              }
              return e
            })
            return function () {
              return d.apply(this, arguments)
            }
          })()),
          (this.callRefreshToken = /*#__PURE__*/ (0, b.default)(function* () {
            var b = yield c.default
              .post(''.concat(a, '/token?grant_type=refresh_token'), {
                refresh_token: h.refreshToken,
              })
              .set('accept', 'json')
              .set('apikey', h.supabaseKey)
            if (200 === b.status) {
              ;(h.accessToken = b.body.access_token), (h.refreshToken = b.body.refresh_token)
              var d = b.body.expires_in
              if (
                (h.autoRefreshToken && d && setTimeout(h.callRefreshToken, 1e3 * (d - 60)),
                h.persistSession)
              ) {
                var e = g(Date.now() / 1e3)
                h.saveSession(h.accessToken, h.refreshToken, e + d, h.currentUser)
              }
            }
            return b
          })),
          (this.logout = /*#__PURE__*/ (0, b.default)(function* () {
            yield c.default
              .post(''.concat(a, '/logout'))
              .set('Authorization', 'Bearer '.concat(h.accessToken))
              .set('apikey', h.supabaseKey),
              h.removeSavedSession()
          })),
          (this.user = /*#__PURE__*/ (0, b.default)(function* () {
            if (h.currentUser) return h.currentUser
            var b = yield c.default
              .get(''.concat(a, '/user'))
              .set('Authorization', 'Bearer '.concat(h.accessToken))
              .set('apikey', h.supabaseKey)
            return (
              200 === b.status &&
                ((h.currentUser = b.body),
                (h.currentUser.access_token = h.accessToken),
                (h.currentUser.refresh_token = h.refreshToken)),
              h.currentUser
            )
          })),
          (this.saveSession = (a, b, c, d) => {
            e() &&
              localStorage.setItem(
                f,
                JSON.stringify({ accessToken: a, refreshToken: b, expiresAt: c, currentUser: d })
              )
          }),
          (this.removeSavedSession = () => {
            ;(this.currentUser = null),
              (this.refreshToken = null),
              (this.accessToken = this.supabaseKey),
              e() && localStorage.removeItem(f)
          }),
          (this.authHeader = () => {
            var a = e() && localStorage.getItem(f),
              b = a ? JSON.parse(a) : null
            return (null === b || void 0 === b ? void 0 : b.accessToken)
              ? 'Bearer '.concat(b.accessToken)
              : this.accessToken
              ? 'Bearer '.concat(this.accessToken)
              : null
          }),
          (this.recoverSession = () => {
            var a = e() && localStorage.getItem(f)
            if (a)
              try {
                var b = JSON.parse(a),
                  { accessToken: c, refreshToken: d, currentUser: h, expiresAt: i } = b,
                  j = g(Date.now() / 1e3)
                i < j
                  ? (console.log('saved session has expired'), this.removeSavedSession())
                  : ((this.accessToken = c),
                    (this.refreshToken = d),
                    (this.currentUser = h),
                    setTimeout(this.callRefreshToken, 1e3 * (i - j - 60)))
              } catch (a) {
                return console.error(a), null
              }
            return null
          }),
          this.recoverSession()
      }
    }
  }
)
