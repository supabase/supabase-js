import { isBrowser } from './helpers'
import { SupportedStorage } from './types'

const localStorageAdapter: SupportedStorage = {
  getItem: (key) => {
    if (!isBrowser()) {
      return null
    }

    return globalThis.localStorage.getItem(key)
  },
  setItem: (key, value) => {
    if (!isBrowser()) {
      return
    }

    globalThis.localStorage.setItem(key, value)
  },
  removeItem: (key) => {
    if (!isBrowser()) {
      return
    }

    globalThis.localStorage.removeItem(key)
  },
}

export default localStorageAdapter
