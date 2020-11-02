'use strict'
var _interopRequireDefault = require('@babel/runtime/helpers/interopRequireDefault')
Object.defineProperty(exports, '__esModule', { value: !0 }), (exports.Auth = void 0)
var _asyncToGenerator2 = _interopRequireDefault(require('@babel/runtime/helpers/asyncToGenerator')),
  _superagent = _interopRequireDefault(require('superagent')),
  isBrowser = () => 'undefined' != typeof window,
  storageKey = 'supabase.auth.token'
class Auth {
  constructor(a, b) {
    var c = Math.round,
      d = this,
      e =
        2 < arguments.length && void 0 !== arguments[2]
          ? arguments[2]
          : { autoRefreshToken: !0, persistSession: !0 }
    ;(this.authUrl = a),
      (this.accessToken = b),
      (this.refreshToken = null),
      (this.supabaseKey = b),
      (this.currentUser = null),
      (this.autoRefreshToken = !(e.autoRefreshToken !== void 0) || e.autoRefreshToken),
      (this.persistSession = !(e.persistSession !== void 0) || e.persistSession),
      (this.signup = /*#__PURE__*/ (function () {
        var b = (0, _asyncToGenerator2.default)(function* (b, e) {
          d.removeSavedSession() // clean out the old session before attempting
          var f = yield _superagent.default
            .post(''.concat(a, '/signup'), { email: b, password: e })
            .set('accept', 'json')
            .set('apikey', d.supabaseKey)
          if (200 === f.status && f.body.user.confirmed_at) {
            ;(d.accessToken = f.body.access_token),
              (d.refreshToken = f.body.refresh_token),
              (d.currentUser = f.body.user)
            var g = f.body.expires_in
            if (
              (d.autoRefreshToken && g && setTimeout(d.callRefreshToken, 1e3 * (g - 60)),
              d.persistSession)
            ) {
              var h = c(Date.now() / 1e3)
              d.saveSession(d.accessToken, d.refreshToken, h + g, d.currentUser)
            }
          }
          return f
        })
        return function () {
          return b.apply(this, arguments)
        }
      })()),
      (this.login = /*#__PURE__*/ (function () {
        var b = (0, _asyncToGenerator2.default)(function* (b, e) {
          d.removeSavedSession() // clean out the old session before attempting
          var f = yield _superagent.default
            .post(''.concat(a, '/token?grant_type=password'), { email: b, password: e })
            .set('accept', 'json')
            .set('apikey', d.supabaseKey)
          if (200 === f.status) {
            ;(d.accessToken = f.body.access_token),
              (d.refreshToken = f.body.refresh_token),
              (d.currentUser = f.body.user)
            var g = f.body.expires_in
            if (
              (d.autoRefreshToken && g && setTimeout(d.callRefreshToken, 1e3 * (g - 60)),
              d.persistSession)
            ) {
              var h = c(Date.now() / 1e3)
              d.saveSession(d.accessToken, d.refreshToken, h + g, d.currentUser)
            }
          }
          return f
        })
        return function () {
          return b.apply(this, arguments)
        }
      })()),
      (this.callRefreshToken = /*#__PURE__*/ (0, _asyncToGenerator2.default)(function* () {
        var b = yield _superagent.default
          .post(''.concat(a, '/token?grant_type=refresh_token'), { refresh_token: d.refreshToken })
          .set('accept', 'json')
          .set('apikey', d.supabaseKey)
        if (200 === b.status) {
          ;(d.accessToken = b.body.access_token), (d.refreshToken = b.body.refresh_token)
          var e = b.body.expires_in
          if (
            (d.autoRefreshToken && e && setTimeout(d.callRefreshToken, 1e3 * (e - 60)),
            d.persistSession)
          ) {
            var f = c(Date.now() / 1e3)
            d.saveSession(d.accessToken, d.refreshToken, f + e, d.currentUser)
          }
        }
        return b
      })),
      (this.logout = /*#__PURE__*/ (0, _asyncToGenerator2.default)(function* () {
        yield _superagent.default
          .post(''.concat(a, '/logout'))
          .set('Authorization', 'Bearer '.concat(d.accessToken))
          .set('apikey', d.supabaseKey),
          d.removeSavedSession()
      })),
      (this.user = /*#__PURE__*/ (0, _asyncToGenerator2.default)(function* () {
        if (d.currentUser) return d.currentUser
        var b = yield _superagent.default
          .get(''.concat(a, '/user'))
          .set('Authorization', 'Bearer '.concat(d.accessToken))
          .set('apikey', d.supabaseKey)
        return (
          200 === b.status &&
            ((d.currentUser = b.body),
            (d.currentUser.access_token = d.accessToken),
            (d.currentUser.refresh_token = d.refreshToken)),
          d.currentUser
        )
      })),
      (this.saveSession = (a, b, c, d) => {
        isBrowser() &&
          localStorage.setItem(
            storageKey,
            JSON.stringify({ accessToken: a, refreshToken: b, expiresAt: c, currentUser: d })
          )
      }),
      (this.removeSavedSession = () => {
        ;(this.currentUser = null),
          (this.refreshToken = null),
          (this.accessToken = this.supabaseKey),
          isBrowser() && localStorage.removeItem(storageKey)
      }),
      (this.authHeader = () => {
        var a = isBrowser() && localStorage.getItem(storageKey),
          b = a ? JSON.parse(a) : null
        return (null === b || void 0 === b ? void 0 : b.accessToken)
          ? 'Bearer '.concat(b.accessToken)
          : this.accessToken
          ? 'Bearer '.concat(this.accessToken)
          : null
      }),
      (this.recoverSession = () => {
        var a = isBrowser() && localStorage.getItem(storageKey)
        if (a)
          try {
            var b = JSON.parse(a),
              { accessToken: d, refreshToken: e, currentUser: f, expiresAt: g } = b,
              h = c(Date.now() / 1e3)
            g < h
              ? (console.log('saved session has expired'), this.removeSavedSession())
              : ((this.accessToken = d),
                (this.refreshToken = e),
                (this.currentUser = f),
                setTimeout(this.callRefreshToken, 1e3 * (g - h - 60)))
          } catch (a) {
            return console.error(a), null
          }
        return null
      }),
      this.recoverSession()
  }
}
exports.Auth = Auth
