;(function (a, b) {
  if ('function' == typeof define && define.amd) define(['exports'], b)
  else if ('undefined' != typeof exports) b(exports)
  else {
    var c = { exports: {} }
    b(c.exports), (a.Helpers = c.exports)
  }
})(
  'undefined' == typeof globalThis ? ('undefined' == typeof self ? this : self) : globalThis,
  function (a) {
    'use strict'
    Object.defineProperty(a, '__esModule', { value: !0 }),
      (a.uuid = function () {
        function a() {
          return Math.floor(65536 * (1 + Math.random()))
            .toString(16)
            .substring(1)
        }
        return a() + a() + '-' + a() + '-' + a() + '-' + a() + '-' + a() + a() + a()
      })
  }
)
