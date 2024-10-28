// @ts-nocheck

if (!window.AbortController) {
  window.AbortController = require('abortcontroller-polyfill/dist/cjs-ponyfill').AbortController
}
if (!globalThis.AbortController) {
  globalThis.AbortController = require('abortcontroller-polyfill/dist/cjs-ponyfill').AbortController
}

globalThis.localStorage = {
  getItem: (key) => wx.getStorageSync(key),
  setItem: (key, value) => {
    wx.setStorage({ key, data: value })
  },
  removeItem: (key) => {
    wx.removeStorage({ key })
  },
}

if (!window.Headers) {
  window.Headers = require('headers-polyfill').Headers
}
