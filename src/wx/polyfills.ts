// @ts-nocheck

if (!globalThis.AbortController) {
  class AbortSignalPolyfill {
    aborted = false
    reason = undefined
    onabort = null
    throwIfAborted() {
      if (this.aborted) {
        throw this.reason
      }
    }
    addEventListener(type, callback) {
      if (type === 'abort' && !this.aborted) {
        this._callback = callback
      }
    }
    removeEventListener() {
      this._callback = null
    }
    dispatchEvent() {
      if (this._callback) this._callback()
      if (this.onabort) this.onabort()
    }
  }
  class AbortControllerPolyfill {
    signal = new AbortSignalPolyfill()
    abort(reason) {
      if (this.signal.aborted) return
      this.signal.aborted = true
      this.signal.reason = reason || new Error('This operation was aborted')
      this.signal.dispatchEvent()
    }
  }
  globalThis.AbortSignal = AbortSignalPolyfill
  globalThis.AbortController = AbortControllerPolyfill
}

if (!globalThis.Headers) {
  globalThis.Headers = require('headers-polyfill').Headers
}
